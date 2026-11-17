"""Authentication business logic (no HTTP code here).

Covers BUILD_PLAN Step 2 parts 1-12 (admin auth deferred to Step 15a).
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    account_inactive,
    account_suspended,
    conflict,
    email_not_verified,
    invalid_credentials,
    invalid_token,
    rate_limited,
    token_expired,
    token_reused,
    validation_error,
)
from app.core.security import (
    create_access_token,
    generate_opaque_token,
    generate_verification_code,
    hash_password,
    hash_token,
    needs_rehash,
    verify_password,
)
from app.models.auth import (
    AuthSession,
    EmailVerificationToken,
    LoginAttempt,
    PasswordResetToken,
)
from app.models.user import AccountStatus, ReviewState, User, UserRoleRow
from app.schemas.auth import (
    SELF_REGISTER_ROLES,
    AddRoleRequest,
    ChangeEmailRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services import email_service
from app.services.rate_limiter import rate_limiter

logger = logging.getLogger("forma.auth")


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime | None) -> datetime | None:
    """Normalise DB datetimes to aware UTC (SQLite returns naive datetimes)."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def _placeholder_display_name(email: str) -> str:
    """Human-ish placeholder used until the user edits their profile (Step 3)."""
    local = email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip()
    return (local or "New member").title()[:160]


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Look up an account by email. Soft-deleted accounts never match."""
    result = await db.execute(
        select(User).where(
            User.primary_email == _normalise_email(email),
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _get_active_roles(db: AsyncSession, user_id: UUID) -> list[UserRoleRow]:
    result = await db.execute(
        select(UserRoleRow).where(UserRoleRow.user_id == user_id, UserRoleRow.revoked_at.is_(None))
    )
    return list(result.scalars().all())


async def _record_attempt(
    db: AsyncSession,
    *,
    email: str,
    user_id: UUID | None,
    ip: str | None,
    user_agent: str | None,
    succeeded: bool,
    failure_reason: str | None = None,
) -> None:
    db.add(
        LoginAttempt(
            email=_normalise_email(email),
            user_id=user_id,
            ip=ip,
            user_agent=user_agent,
            succeeded=succeeded,
            failure_reason=failure_reason,
        )
    )
    await db.flush()


async def _create_session(
    db: AsyncSession,
    *,
    user: User,
    user_agent: str | None,
    ip: str | None,
) -> tuple[AuthSession, str]:
    settings = get_settings()
    raw_refresh = generate_opaque_token()
    session = AuthSession(
        user_id=user.id,
        refresh_token_hash=hash_token(raw_refresh),
        user_agent=user_agent,
        ip=ip,
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.flush()
    return session, raw_refresh


def _token_response(access_token: str, raw_refresh: str) -> TokenResponse:
    settings = get_settings()
    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def _send_verification_code(db: AsyncSession, user: User, email: str) -> None:
    settings = get_settings()
    code = generate_verification_code()
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_token(code),
            email=_normalise_email(email),
            expires_at=_now() + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRE_MINUTES),
        )
    )
    await db.flush()
    await email_service.send_email(
        email,
        "Your Forma verification code",
        f"Your verification code is {code}. "
        f"It expires in {settings.VERIFICATION_CODE_EXPIRE_MINUTES} minutes. "
        "If you did not request this, ignore this email.",
    )


async def register(
    db: AsyncSession, payload: RegisterRequest, *, ip: str | None
) -> RegisterResponse:
    settings = get_settings()
    if not await rate_limiter.check(
        f"register:ip:{ip}", settings.REGISTER_IP_LIMIT, settings.REGISTER_IP_WINDOW_SECONDS
    ):
        raise rate_limited("Too many registration attempts. Please try again later.")

    email = _normalise_email(payload.email)
    existing = await _get_user_by_email(db, email)
    # No leaking whether an email exists: identical generic response.
    if existing is not None:
        return RegisterResponse()

    user = User(
        primary_email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name or _placeholder_display_name(email),
        locale=payload.locale,
        timezone=payload.timezone,
        status=AccountStatus.pending,
        verification=ReviewState.unverified,
    )
    db.add(user)
    await db.flush()
    db.add(UserRoleRow(user_id=user.id, role=payload.role, is_primary=True))
    await db.flush()
    await _send_verification_code(db, user, email)
    await db.commit()
    return RegisterResponse()


async def login(
    db: AsyncSession,
    payload: LoginRequest,
    *,
    ip: str | None,
    user_agent: str | None,
) -> TokenResponse:
    settings = get_settings()
    email = _normalise_email(payload.email)
    if not await rate_limiter.check(
        f"login:ip:{ip}", settings.LOGIN_IP_LIMIT, settings.LOGIN_IP_WINDOW_SECONDS
    ):
        await _record_attempt(
            db,
            email=email,
            user_id=None,
            ip=ip,
            user_agent=user_agent,
            succeeded=False,
            failure_reason="rate_limited_ip",
        )
        await db.commit()
        raise rate_limited("Too many login attempts. Please try again later.")
    if not await rate_limiter.check(
        f"login:acct:{email}", settings.LOGIN_ACCOUNT_LIMIT, settings.LOGIN_ACCOUNT_WINDOW_SECONDS
    ):
        await _record_attempt(
            db,
            email=email,
            user_id=None,
            ip=ip,
            user_agent=user_agent,
            succeeded=False,
            failure_reason="rate_limited_account",
        )
        await db.commit()
        raise rate_limited("Too many login attempts. Please try again later.")

    user = await _get_user_by_email(db, email)
    if user is None or not verify_password(payload.password, user.password_hash):
        await _record_attempt(
            db,
            email=email,
            user_id=user.id if user else None,
            ip=ip,
            user_agent=user_agent,
            succeeded=False,
            failure_reason="invalid_credentials",
        )
        await db.commit()
        raise invalid_credentials()

    if user.status == AccountStatus.suspended:
        await _record_attempt(
            db,
            email=email,
            user_id=user.id,
            ip=ip,
            user_agent=user_agent,
            succeeded=False,
            failure_reason="suspended",
        )
        await db.commit()
        raise account_suspended()
    if user.status in (AccountStatus.deactivated, AccountStatus.deleted):
        await _record_attempt(
            db,
            email=email,
            user_id=user.id,
            ip=ip,
            user_agent=user_agent,
            succeeded=False,
            failure_reason="inactive",
        )
        await db.commit()
        raise account_inactive()

    if user.password_hash and needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    user.last_active_at = _now()
    _, raw_refresh = await _create_session(db, user=user, user_agent=user_agent, ip=ip)
    await _record_attempt(
        db, email=email, user_id=user.id, ip=ip, user_agent=user_agent, succeeded=True
    )
    await db.commit()
    access = create_access_token(user.id)
    return _token_response(access, raw_refresh)


async def refresh(
    db: AsyncSession, payload: RefreshRequest, *, ip: str | None, user_agent: str | None
) -> TokenResponse:
    token_hash = hash_token(payload.refresh_token)
    result = await db.execute(
        select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise invalid_token("Invalid refresh token.")
    if session.revoked_at is not None:
        # Reuse of a revoked token: revoke the whole chain.
        await _revoke_chain(db, session)
        await db.commit()
        raise token_reused()
    if _aware(session.expires_at) < _now():  # type: ignore[operator]
        session.revoked_at = _now()
        session.revoked_reason = "expired"
        await db.commit()
        raise token_expired()

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise invalid_token("Invalid refresh token.")
    if user.status == AccountStatus.suspended:
        raise account_suspended()
    if user.status in (AccountStatus.deactivated, AccountStatus.deleted):
        raise account_inactive()

    # Rotate: new session row, link old via replaced_by_session_id.
    new_session, raw_refresh = await _create_session(db, user=user, user_agent=user_agent, ip=ip)
    session.revoked_at = _now()
    session.revoked_reason = "rotated"
    session.replaced_by_session_id = new_session.id
    session.last_used_at = _now()
    user.last_active_at = _now()
    await db.commit()
    access = create_access_token(user.id)
    return _token_response(access, raw_refresh)


async def _revoke_chain(db: AsyncSession, session: AuthSession) -> None:
    """Revoke a session and every session reachable via replaced_by links."""
    current: AuthSession | None = session
    seen: set[UUID] = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)
        if current.revoked_at is None:
            current.revoked_at = _now()
            current.revoked_reason = "reuse_detected"
        if current.replaced_by_session_id is None:
            break
        result = await db.execute(
            select(AuthSession).where(AuthSession.id == current.replaced_by_session_id)
        )
        current = result.scalar_one_or_none()


async def logout(db: AsyncSession, *, refresh_token: str) -> None:
    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
    )
    session = result.scalar_one_or_none()
    if session is not None and session.revoked_at is None:
        session.revoked_at = _now()
        session.revoked_reason = "logout"
        await db.commit()


async def logout_all(db: AsyncSession, *, user_id: UUID) -> None:
    result = await db.execute(
        select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
    )
    for session in result.scalars().all():
        session.revoked_at = _now()
        session.revoked_reason = "logout_all"
    await db.commit()


async def verify_email(
    db: AsyncSession, payload: VerifyEmailRequest, *, ip: str | None = None
) -> None:
    settings = get_settings()
    email = _normalise_email(payload.email)
    # Rate limit: a 6-digit code must not be brute-forceable.
    if not await rate_limiter.check(
        f"verify:ip:{ip}", settings.VERIFY_IP_LIMIT, settings.VERIFY_IP_WINDOW_SECONDS
    ):
        raise rate_limited("Too many attempts. Please try again later.")
    if not await rate_limiter.check(
        f"verify:acct:{email}",
        settings.VERIFY_ACCOUNT_LIMIT,
        settings.VERIFY_ACCOUNT_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many attempts. Please try again later.")

    user = await _get_user_by_email(db, email)
    if user is None:
        raise invalid_token("Invalid verification code.")
    token_hash = hash_token(payload.code)
    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.user_id == user.id,
        )
    )
    token = result.scalar_one_or_none()
    if token is None or token.consumed_at is not None:
        raise invalid_token("Invalid verification code.")
    if _aware(token.expires_at) < _now():  # type: ignore[operator]
        raise token_expired()
    token.consumed_at = _now()
    user.email_verified_at = _now()
    if user.status == AccountStatus.pending:
        user.status = AccountStatus.active
    if user.verification == ReviewState.unverified:
        user.verification = ReviewState.pending
    await db.commit()


async def resend_verification(
    db: AsyncSession, payload: ResendVerificationRequest, *, ip: str | None
) -> None:
    settings = get_settings()
    email = _normalise_email(payload.email)
    if not await rate_limiter.check(
        f"resend:ip:{ip}", settings.FORGOT_IP_LIMIT, settings.FORGOT_IP_WINDOW_SECONDS
    ):
        raise rate_limited("Too many requests. Please try again later.")
    user = await _get_user_by_email(db, email)
    if user is None or user.email_verified_at is not None:
        # Generic success: do not reveal account state.
        return
    # Cooldown: no new code if one was issued in the last N seconds.
    recent = await db.execute(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.user_id == user.id)
        .order_by(EmailVerificationToken.created_at.desc())
        .limit(1)
    )
    last = recent.scalar_one_or_none()
    if last is not None:
        age = (_now() - _aware(last.created_at)).total_seconds()  # type: ignore[operator]
        if age < settings.RESEND_COOLDOWN_SECONDS:
            raise rate_limited("Please wait before requesting another code.")
    await _send_verification_code(db, user, email)
    await db.commit()


async def forgot_password(
    db: AsyncSession, payload: ForgotPasswordRequest, *, ip: str | None
) -> None:
    settings = get_settings()
    email = _normalise_email(payload.email)
    if not await rate_limiter.check(
        f"forgot:ip:{ip}", settings.FORGOT_IP_LIMIT, settings.FORGOT_IP_WINDOW_SECONDS
    ):
        raise rate_limited("Too many requests. Please try again later.")
    user = await _get_user_by_email(db, email)
    if user is None:
        return  # Generic: do not reveal whether the email exists.
    raw_token = generate_opaque_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=_now() + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
            requested_ip=ip,
        )
    )
    await db.flush()
    reset_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={raw_token}"
    await email_service.send_email(
        email,
        "Reset your Forma password",
        f"Use this link to reset your password (expires in "
        f"{settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes): {reset_url}\n"
        "If you did not request this, ignore this email.",
    )
    await db.commit()


async def reset_password(db: AsyncSession, payload: ResetPasswordRequest) -> None:
    token_hash = hash_token(payload.token)
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    token = result.scalar_one_or_none()
    if token is None or token.consumed_at is not None:
        raise invalid_token("Invalid or already used reset token.")
    if _aware(token.expires_at) < _now():  # type: ignore[operator]
        raise token_expired()
    user_result = await db.execute(select(User).where(User.id == token.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise invalid_token("Invalid or already used reset token.")
    token.consumed_at = _now()
    user.password_hash = hash_password(payload.new_password)
    # Revoke all sessions on password reset.
    sessions = await db.execute(
        select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
    )
    for session in sessions.scalars().all():
        session.revoked_at = _now()
        session.revoked_reason = "password_reset"
    await db.commit()


async def change_password(db: AsyncSession, *, user: User, payload: ChangePasswordRequest) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise invalid_credentials()
    user.password_hash = hash_password(payload.new_password)
    sessions = await db.execute(
        select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
    )
    for session in sessions.scalars().all():
        session.revoked_at = _now()
        session.revoked_reason = "password_change"
    await db.commit()


async def change_email(db: AsyncSession, *, user: User, payload: ChangeEmailRequest) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise invalid_credentials()
    new_email = _normalise_email(payload.new_email)
    if new_email == _normalise_email(user.primary_email):
        raise validation_error("New email must be different from the current email.")
    existing = await _get_user_by_email(db, new_email)
    if existing is not None and existing.id != user.id:
        raise conflict("An account with this email already exists.")
    # Issue a verification token for the new email; the address changes
    # only after the code is verified (handled by verify_email flow in a
    # later step — for Step 2 we record the token and require re-verify).
    # To keep Step 2 self-contained, the email is updated immediately after
    # a fresh verification code is sent and the old address is cleared.
    # NOTE: full change-email confirmation flow is completed in Step 3.
    user.primary_email = new_email
    user.email_verified_at = None
    if user.status == AccountStatus.active:
        user.status = AccountStatus.pending
    await _send_verification_code(db, user, new_email)
    await db.commit()


async def add_role(db: AsyncSession, *, user: User, payload: AddRoleRequest) -> None:
    if payload.role not in SELF_REGISTER_ROLES:
        raise validation_error("This role cannot be added via self-service.")
    existing = await db.execute(
        select(UserRoleRow).where(
            UserRoleRow.user_id == user.id,
            UserRoleRow.role == payload.role,
            UserRoleRow.revoked_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise conflict("You already have this role.")
    roles = await _get_active_roles(db, user.id)
    is_primary = len(roles) == 0
    db.add(UserRoleRow(user_id=user.id, role=payload.role, is_primary=is_primary))
    await db.commit()


async def require_verified(user: User) -> None:
    if user.email_verified_at is None or user.status == AccountStatus.pending:
        raise email_not_verified()
