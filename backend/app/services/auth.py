import uuid
from datetime import UTC, datetime, timedelta

import redis.asyncio as aioredis
from fastapi import BackgroundTasks
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.core.email import send_email
from app.core.exceptions import (
    AppError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
)
from app.core.logging import get_logger
from app.core.rate_limit import (
    check_and_set_cooldown,
    clear_email_lockout,
    record_failed_login,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.user import (
    AccountStatus,
    AuthSession,
    EmailVerificationToken,
    LoginAttempt,
    PasswordResetToken,
    ReviewState,
    User,
    UserRole,
    UserRoleEnum,
)
from app.schemas.auth import (
    ChangeEmailRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserMeResponse,
    UserRoleRead,
)

logger = get_logger("auth_service")


def get_avatar_initials(name: str) -> str:
    parts = name.strip().split()
    if not parts:
        return "U"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()[:3]


def user_to_me_response(user: User) -> UserMeResponse:
    roles_read = [
        UserRoleRead(
            role=r.role.value,
            is_primary=r.is_primary,
            granted_at=r.granted_at,
        )
        for r in user.roles
        if r.revoked_at is None
    ]
    return UserMeResponse(
        id=user.id,
        primary_email=user.primary_email,
        email_verified=user.email_verified_at is not None,
        display_name=user.display_name,
        handle=user.handle,
        avatar_url=user.avatar_url,
        avatar_initials=user.avatar_initials,
        phone=user.phone,
        locale=user.locale,
        timezone=user.timezone,
        status=user.status.value,
        verification=user.verification.value,
        two_factor_enabled=user.two_factor_enabled,
        roles=roles_read,
        created_at=user.created_at,
    )


class AuthService:
    @staticmethod
    async def register(
        payload: RegisterRequest,
        db: AsyncSession,
        settings: Settings,
        background_tasks: BackgroundTasks,
    ) -> UserMeResponse:
        email_normalized = payload.email.lower().strip()

        # Check existing user
        query = select(User).where(
            User.primary_email == email_normalized,
            User.deleted_at.is_(None),
        )
        result = await db.execute(query)
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise ConflictError("An account with this email already exists.")

        # Create user
        initials = get_avatar_initials(payload.display_name)
        user = User(
            primary_email=email_normalized,
            password_hash=hash_password(payload.password),
            display_name=payload.display_name,
            avatar_initials=initials,
            phone=payload.phone,
            status=AccountStatus.pending,
            verification=ReviewState.unverified,
        )
        db.add(user)
        await db.flush()  # populate user.id

        # Assign requested role as primary role
        role_enum = UserRoleEnum(payload.role.value)
        user_role = UserRole(
            user_id=user.id,
            role=role_enum,
            is_primary=True,
        )
        db.add(user_role)

        # Generate verification token
        raw_token, token_h = generate_token(32)
        verification_token = EmailVerificationToken(
            user_id=user.id,
            token_hash=token_h,
            email=email_normalized,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        db.add(verification_token)
        await db.commit()

        # Queue verification email
        verify_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"
        email_html = (
            f"<p>Hello {user.display_name},</p>"
            f"<p>Thank you for registering on Forma. Please verify your email by clicking the link below:</p>"
            f"<p><a href='{verify_url}'>{verify_url}</a></p>"
            f"<p>This link expires in 24 hours.</p>"
        )
        background_tasks.add_task(
            send_email,
            to_email=email_normalized,
            subject="Verify your Forma account",
            html_content=email_html,
            settings=settings,
        )

        # Reload user with roles
        user_loaded = await db.scalar(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == user.id)
        )
        assert user_loaded is not None
        return user_to_me_response(user_loaded)

    @staticmethod
    async def login(
        payload: LoginRequest,
        ip: str | None,
        user_agent: str | None,
        db: AsyncSession,
        settings: Settings,
        redis_client: aioredis.Redis,
    ) -> tuple[TokenResponse, str]:
        email_normalized = payload.email.lower().strip()

        # Query user
        user = await db.scalar(
            select(User)
            .options(selectinload(User.roles))
            .where(
                User.primary_email == email_normalized,
                User.deleted_at.is_(None),
            )
        )

        if not user or not verify_password(payload.password, user.password_hash):
            # Record failed login attempt
            attempt = LoginAttempt(
                email=email_normalized,
                user_id=user.id if user else None,
                ip=ip,
                user_agent=user_agent,
                succeeded=False,
                failure_reason="invalid_credentials",
            )
            db.add(attempt)
            await db.commit()

            # Record in Redis lockout tracker
            await record_failed_login(
                redis_client,
                email_normalized,
                settings.LOGIN_LOCKOUT_WINDOW_SECONDS,
            )
            raise AuthenticationError("Invalid email or password.")

        # Account status checks
        if user.status == AccountStatus.suspended:
            raise AuthorizationError("Your account has been suspended. Please contact support.")
        if user.status in (AccountStatus.deactivated, AccountStatus.deleted):
            raise AuthenticationError("Invalid email or password.")

        # Record successful login attempt
        attempt = LoginAttempt(
            email=email_normalized,
            user_id=user.id,
            ip=ip,
            user_agent=user_agent,
            succeeded=True,
            failure_reason=None,
        )
        db.add(attempt)
        user.last_active_at = datetime.now(UTC)

        # Clear failed lockout attempts on success
        await clear_email_lockout(redis_client, email_normalized)

        # Create session with rotating refresh token
        raw_refresh, refresh_hash, refresh_expires = create_refresh_token(settings)
        session = AuthSession(
            user_id=user.id,
            refresh_token_hash=refresh_hash,
            user_agent=user_agent,
            ip=ip,
            expires_at=refresh_expires,
            last_used_at=datetime.now(UTC),
        )
        db.add(session)
        await db.commit()

        # Generate access token
        access_token = create_access_token(user.id, settings)

        token_response = TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_to_me_response(user),
        )
        return token_response, raw_refresh

    @staticmethod
    async def refresh_tokens(
        raw_refresh_token: str | None,
        ip: str | None,
        user_agent: str | None,
        db: AsyncSession,
        settings: Settings,
    ) -> tuple[TokenResponse, str]:
        if not raw_refresh_token:
            raise AuthenticationError("Refresh token missing.")

        token_h = hash_token(raw_refresh_token)
        session = await db.scalar(
            select(AuthSession).where(AuthSession.refresh_token_hash == token_h)
        )

        if not session:
            raise AuthenticationError("Invalid refresh token.")

        # REUSE DETECTION
        if session.revoked_at is not None:
            # Token was already revoked -> reuse detected!
            # Revoke all of that user's active sessions
            logger.error(
                "security_event_refresh_token_reuse",
                user_id=str(session.user_id),
                session_id=str(session.id),
                ip=ip,
            )
            await db.execute(
                update(AuthSession)
                .where(
                    AuthSession.user_id == session.user_id,
                    AuthSession.revoked_at.is_(None),
                )
                .values(
                    revoked_at=datetime.now(UTC),
                    revoked_reason="security_reuse_detected",
                )
            )
            await db.commit()
            raise AuthenticationError("Invalid refresh token.")

        # Check expiration
        now_utc = datetime.now(UTC)
        if session.expires_at < now_utc:
            session.revoked_at = now_utc
            session.revoked_reason = "expired"
            await db.commit()
            raise AuthenticationError("Refresh token has expired.")

        # Load user
        user = await db.scalar(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == session.user_id, User.deleted_at.is_(None))
        )
        if not user:
            raise AuthenticationError("User not found.")
        if user.status == AccountStatus.suspended:
            raise AuthorizationError("Account is suspended.")
        if user.status in (AccountStatus.deactivated, AccountStatus.deleted):
            raise AuthenticationError("Account is no longer active.")

        # Rotate refresh token: create new session, link old one
        new_raw_refresh, new_refresh_hash, new_refresh_expires = create_refresh_token(settings)
        new_session = AuthSession(
            user_id=user.id,
            refresh_token_hash=new_refresh_hash,
            user_agent=user_agent or session.user_agent,
            ip=ip or session.ip,
            expires_at=new_refresh_expires,
            last_used_at=now_utc,
        )
        db.add(new_session)
        await db.flush()

        session.revoked_at = now_utc
        session.revoked_reason = "rotated"
        session.replaced_by_session_id = new_session.id
        await db.commit()

        access_token = create_access_token(user.id, settings)
        token_response = TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_to_me_response(user),
        )
        return token_response, new_raw_refresh

    @staticmethod
    async def logout(
        raw_refresh_token: str | None,
        db: AsyncSession,
    ) -> None:
        if raw_refresh_token:
            token_h = hash_token(raw_refresh_token)
            session = await db.scalar(
                select(AuthSession).where(AuthSession.refresh_token_hash == token_h)
            )
            if session and session.revoked_at is None:
                session.revoked_at = datetime.now(UTC)
                session.revoked_reason = "user_logout"
                await db.commit()

    @staticmethod
    async def logout_all(
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> None:
        await db.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
            )
            .values(
                revoked_at=datetime.now(UTC),
                revoked_reason="logout_all",
            )
        )
        await db.commit()

    @staticmethod
    async def verify_email(
        raw_token: str,
        db: AsyncSession,
    ) -> None:
        token_h = hash_token(raw_token)
        token_record = await db.scalar(
            select(EmailVerificationToken).where(
                EmailVerificationToken.token_hash == token_h
            )
        )

        if not token_record or token_record.consumed_at is not None:
            raise AppError(
                code="invalid_token",
                message="Verification token is invalid or has already been used.",
            )

        now_utc = datetime.now(UTC)
        if token_record.expires_at < now_utc:
            raise AppError(
                code="token_expired",
                message="Verification token has expired. Please request a new one.",
            )

        token_record.consumed_at = now_utc
        user = await db.scalar(select(User).where(User.id == token_record.user_id))
        if user:
            user.email_verified_at = now_utc
            if user.status == AccountStatus.pending:
                user.status = AccountStatus.active
            if user.verification == ReviewState.unverified:
                user.verification = ReviewState.verified
        await db.commit()

    @staticmethod
    async def resend_verification(
        payload: ResendVerificationRequest,
        db: AsyncSession,
        settings: Settings,
        redis_client: aioredis.Redis,
        background_tasks: BackgroundTasks,
    ) -> None:
        email_normalized = payload.email.lower().strip()
        user = await db.scalar(
            select(User).where(
                User.primary_email == email_normalized,
                User.deleted_at.is_(None),
            )
        )

        if user:
            # Cooldown check
            await check_and_set_cooldown(
                redis_client,
                key_prefix="resend_verify",
                identifier=str(user.id),
                cooldown_seconds=settings.RESEND_VERIFICATION_COOLDOWN_SECONDS,
            )

            raw_token, token_h = generate_token(32)
            verification_token = EmailVerificationToken(
                user_id=user.id,
                token_hash=token_h,
                email=email_normalized,
                expires_at=datetime.now(UTC) + timedelta(hours=24),
            )
            db.add(verification_token)
            await db.commit()

            verify_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"
            email_html = (
                f"<p>Hello {user.display_name},</p>"
                f"<p>Please verify your email address by clicking the link below:</p>"
                f"<p><a href='{verify_url}'>{verify_url}</a></p>"
                f"<p>This link expires in 24 hours.</p>"
            )
            background_tasks.add_task(
                send_email,
                to_email=email_normalized,
                subject="Verify your Forma account",
                html_content=email_html,
                settings=settings,
            )

    @staticmethod
    async def forgot_password(
        payload: ForgotPasswordRequest,
        ip: str | None,
        db: AsyncSession,
        settings: Settings,
        background_tasks: BackgroundTasks,
    ) -> None:
        email_normalized = payload.email.lower().strip()
        user = await db.scalar(
            select(User).where(
                User.primary_email == email_normalized,
                User.deleted_at.is_(None),
            )
        )

        if user:
            raw_token, token_h = generate_token(32)
            reset_record = PasswordResetToken(
                user_id=user.id,
                token_hash=token_h,
                expires_at=datetime.now(UTC) + timedelta(hours=1),
                requested_ip=ip,
            )
            db.add(reset_record)
            await db.commit()

            reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
            email_html = (
                f"<p>Hello {user.display_name},</p>"
                f"<p>You requested a password reset. Click the link below to set a new password:</p>"
                f"<p><a href='{reset_url}'>{reset_url}</a></p>"
                f"<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>"
            )
            background_tasks.add_task(
                send_email,
                to_email=email_normalized,
                subject="Reset your Forma password",
                html_content=email_html,
                settings=settings,
            )

    @staticmethod
    async def reset_password(
        payload: ResetPasswordRequest,
        db: AsyncSession,
    ) -> None:
        token_h = hash_token(payload.token)
        reset_record = await db.scalar(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_h
            )
        )

        if not reset_record or reset_record.consumed_at is not None:
            raise AppError(
                code="invalid_token",
                message="Password reset token is invalid or has already been used.",
            )

        now_utc = datetime.now(UTC)
        if reset_record.expires_at < now_utc:
            raise AppError(
                code="token_expired",
                message="Password reset token has expired.",
            )

        reset_record.consumed_at = now_utc
        user = await db.scalar(select(User).where(User.id == reset_record.user_id))
        if not user:
            raise NotFoundError("User not found.")

        # Update password
        user.password_hash = hash_password(payload.new_password)

        # Requirement: reset password revokes all active sessions
        await db.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user.id,
                AuthSession.revoked_at.is_(None),
            )
            .values(
                revoked_at=now_utc,
                revoked_reason="password_reset",
            )
        )
        await db.commit()

    @staticmethod
    async def change_password(
        user: User,
        payload: ChangePasswordRequest,
        db: AsyncSession,
    ) -> None:
        if not verify_password(payload.current_password, user.password_hash):
            raise AuthenticationError("Current password is incorrect.")

        user.password_hash = hash_password(payload.new_password)
        # Revoke all other active sessions for this user
        now_utc = datetime.now(UTC)
        await db.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user.id,
                AuthSession.revoked_at.is_(None),
            )
            .values(
                revoked_at=now_utc,
                revoked_reason="password_changed",
            )
        )
        await db.commit()

    @staticmethod
    async def change_email(
        user: User,
        payload: ChangeEmailRequest,
        db: AsyncSession,
        settings: Settings,
        background_tasks: BackgroundTasks,
    ) -> None:
        if not verify_password(payload.current_password, user.password_hash):
            raise AuthenticationError("Current password is incorrect.")

        new_email_norm = payload.new_email.lower().strip()
        existing = await db.scalar(
            select(User).where(
                User.primary_email == new_email_norm,
                User.deleted_at.is_(None),
            )
        )
        if existing and existing.id != user.id:
            raise ConflictError("An account with that email already exists.")

        raw_token, token_h = generate_token(32)
        verification_token = EmailVerificationToken(
            user_id=user.id,
            token_hash=token_h,
            email=new_email_norm,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        db.add(verification_token)
        await db.commit()

        verify_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"
        email_html = (
            f"<p>Hello {user.display_name},</p>"
            f"<p>You requested to change your email to {new_email_norm}. Please confirm by clicking below:</p>"
            f"<p><a href='{verify_url}'>{verify_url}</a></p>"
            f"<p>This link expires in 24 hours.</p>"
        )
        background_tasks.add_task(
            send_email,
            to_email=new_email_norm,
            subject="Confirm your new Forma email",
            html_content=email_html,
            settings=settings,
        )
