import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import APIRouter, Depends
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import Settings
from app.core.dependencies import require_role
from app.core.security import create_access_token, generate_token, hash_token
from app.db.engine import get_session_factory
from app.main import app
from app.models.user import (
    AccountStatus,
    AuthSession,
    EmailVerificationToken,
    PasswordResetToken,
    User,
    UserRoleEnum,
)

# Test router for role checking
dummy_role_router = APIRouter(prefix="/test-roles", tags=["Test"])


@dummy_role_router.get("/mentor-only")
async def mentor_only_route(user: User = Depends(require_role(UserRoleEnum.mentor))) -> dict[str, str]:
    return {"message": "Welcome mentor"}


app.include_router(dummy_role_router, prefix="/api/v1")


@pytest.mark.asyncio
async def test_health_and_readiness(client: AsyncClient) -> None:
    health_resp = await client.get("/api/v1/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "healthy"

    ready_resp = await client.get("/api/v1/ready")
    assert ready_resp.status_code == 200
    assert ready_resp.json()["status"] == "ready"
    assert ready_resp.json()["database"] == "ok"
    assert ready_resp.json()["redis"] == "ok"


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient) -> None:
    payload = {
        "email": "candidate@example.com",
        "password": "SecurePassword123!",
        "display_name": "Candidate User",
        "role": "jobseeker",
        "phone": "+919876543210",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["primary_email"] == "candidate@example.com"
    assert data["status"] == "pending"
    assert data["verification"] == "unverified"
    assert data["avatar_initials"] == "CU"
    assert len(data["roles"]) == 1
    assert data["roles"][0]["role"] == "jobseeker"
    assert data["roles"][0]["is_primary"] is True

    user_id = uuid.UUID(data["id"])
    async with get_session_factory()() as session:
        token_record = await session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
        )
        assert token_record is not None
        assert token_record.email == "candidate@example.com"


@pytest.mark.asyncio
async def test_register_admin_rejected(client: AsyncClient) -> None:
    payload = {
        "email": "hacker@example.com",
        "password": "Password123!",
        "display_name": "Fake Admin",
        "role": "admin",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient) -> None:
    payload = {
        "email": "weak@example.com",
        "password": "weak",
        "display_name": "Weak User",
        "role": "jobseeker",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    payload = {
        "email": "dup@example.com",
        "password": "Password123!",
        "display_name": "User One",
        "role": "startup",
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "conflict"


@pytest.mark.asyncio
async def test_login_success_and_cookie(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["primary_email"] == "jobseeker@example.com"

    assert "refresh_token" in resp.cookies
    assert len(resp.cookies["refresh_token"]) > 20


@pytest.mark.asyncio
async def test_login_wrong_password_generic_error(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "WrongPassword123!"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["message"] == "Invalid email or password."


@pytest.mark.asyncio
async def test_login_user_not_found_generic_error(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "AnyPassword123!"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["message"] == "Invalid email or password."


@pytest.mark.asyncio
async def test_login_suspended_account(
    client: AsyncClient, suspended_user: User
) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "suspended@example.com", "password": "Password123!"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"


@pytest.mark.asyncio
async def test_login_per_email_lockout(
    client: AsyncClient, verified_jobseeker_user: User, settings: Settings
) -> None:
    for _ in range(settings.LOGIN_MAX_ATTEMPTS_PER_EMAIL):
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "jobseeker@example.com", "password": "WrongPassword123!"},
        )
        assert r.status_code == 401

    locked_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    assert locked_resp.status_code == 429
    assert locked_resp.json()["error"]["code"] == "account_locked"


@pytest.mark.asyncio
async def test_refresh_token_rotation(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    first_refresh = login_resp.cookies["refresh_token"]

    refresh_resp = await client.post("/api/v1/auth/refresh")
    assert refresh_resp.status_code == 200
    second_refresh = refresh_resp.cookies["refresh_token"]

    assert first_refresh != second_refresh

    old_hash = hash_token(first_refresh)
    async with get_session_factory()() as session:
        old_session = await session.scalar(
            select(AuthSession).where(AuthSession.refresh_token_hash == old_hash)
        )
        assert old_session is not None
        assert old_session.revoked_at is not None
        assert old_session.revoked_reason == "rotated"
        assert old_session.replaced_by_session_id is not None


@pytest.mark.asyncio
async def test_refresh_token_reuse_detection_revokes_all_sessions(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    stolen_refresh = login_resp.cookies["refresh_token"]

    # Legitimate refresh rotates the token
    await client.post("/api/v1/auth/refresh")

    # Attacker uses stolen (now revoked) token via body
    attacker_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": stolen_refresh},
    )
    assert attacker_resp.status_code == 401
    assert attacker_resp.json()["error"]["message"] == "Invalid refresh token."

    # Verify ALL active sessions for the user were revoked due to reuse detection
    async with get_session_factory()() as session:
        active_sessions = (
            await session.scalars(
                select(AuthSession).where(
                    AuthSession.user_id == verified_jobseeker_user.id,
                    AuthSession.revoked_at.is_(None),
                )
            )
        ).all()
        assert len(active_sessions) == 0


@pytest.mark.asyncio
async def test_logout_and_logout_all(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    # Logout
    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200

    # Refresh should now fail
    ref_resp = await client.post("/api/v1/auth/refresh")
    assert ref_resp.status_code == 401

    # Login again and test logout-all
    login_resp2 = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    new_access_token = login_resp2.json()["access_token"]
    logout_all_resp = await client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {new_access_token}"},
    )
    assert logout_all_resp.status_code == 200


@pytest.mark.asyncio
async def test_verify_email_flow_and_single_use(client: AsyncClient) -> None:
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "unverified@example.com",
            "password": "Password123!",
            "display_name": "Unverified User",
            "role": "jobseeker",
        },
    )
    user_id = uuid.UUID(reg_resp.json()["id"])

    raw_tok, tok_hash = generate_token()
    async with get_session_factory()() as session:
        token_record = await session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
        )
        assert token_record is not None
        token_record.token_hash = tok_hash
        await session.commit()

    # 1. First verification: must succeed
    v_resp = await client.post("/api/v1/auth/verify-email", json={"token": raw_tok})
    assert v_resp.status_code == 200

    async with get_session_factory()() as session:
        user = await session.scalar(select(User).where(User.id == user_id))
        assert user is not None
        assert user.status == AccountStatus.active
        assert user.email_verified_at is not None

    # 2. Second verification attempt with same token: single-use, must fail (400)
    v_resp2 = await client.post("/api/v1/auth/verify-email", json={"token": raw_tok})
    assert v_resp2.status_code == 400
    assert v_resp2.json()["error"]["code"] == "invalid_token"


@pytest.mark.asyncio
async def test_verify_email_expired(client: AsyncClient) -> None:
    raw_tok, tok_hash = generate_token()
    async with get_session_factory()() as session:
        user = User(
            primary_email="expired@example.com",
            password_hash="...",
            display_name="Expired User",
        )
        session.add(user)
        await session.flush()

        token_record = EmailVerificationToken(
            user_id=user.id,
            token_hash=tok_hash,
            email="expired@example.com",
            expires_at=datetime.now(UTC) - timedelta(hours=1),
        )
        session.add(token_record)
        await session.commit()

    resp = await client.post("/api/v1/auth/verify-email", json={"token": raw_tok})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "token_expired"


@pytest.mark.asyncio
async def test_resend_verification_generic_response_and_cooldown(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    # 1. Non-existent email returns generic message
    r1 = await client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "nobody@example.com"},
    )
    assert r1.status_code == 200
    assert "If that email is registered" in r1.json()["message"]

    # 2. Existing user returns same generic message
    r2 = await client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "jobseeker@example.com"},
    )
    assert r2.status_code == 200

    # 3. Second call immediately triggers cooldown (429)
    r3 = await client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "jobseeker@example.com"},
    )
    assert r3.status_code == 429
    assert r3.json()["error"]["code"] == "rate_limit_exceeded"


@pytest.mark.asyncio
async def test_forgot_and_reset_password_revokes_sessions(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    f_resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "jobseeker@example.com"},
    )
    assert f_resp.status_code == 200
    assert "If that email is registered" in f_resp.json()["message"]

    # Log in to establish an active session before reset
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200

    raw_reset, reset_hash = generate_token()
    async with get_session_factory()() as session:
        reset_record = PasswordResetToken(
            user_id=verified_jobseeker_user.id,
            token_hash=reset_hash,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
        session.add(reset_record)
        await session.commit()

    # Reset password
    r_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_reset, "new_password": "NewPassword456!"},
    )
    assert r_resp.status_code == 200

    # Verify old active sessions were revoked by password reset
    async with get_session_factory()() as session:
        active_sessions = (
            await session.scalars(
                select(AuthSession).where(
                    AuthSession.user_id == verified_jobseeker_user.id,
                    AuthSession.revoked_at.is_(None),
                )
            )
        ).all()
        assert len(active_sessions) == 0

    # Single-use check: second reset with same token fails (400)
    r_resp2 = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_reset, "new_password": "AnotherPassword789!"},
    )
    assert r_resp2.status_code == 400

    # Login with old password fails; new succeeds
    fail_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    assert fail_login.status_code == 401

    ok_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "NewPassword456!"},
    )
    assert ok_login.status_code == 200


@pytest.mark.asyncio
async def test_change_password(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]

    bad_resp = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "WrongPassword!", "new_password": "ChangedPass123!"},
    )
    assert bad_resp.status_code == 401

    ok_resp = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Password123!", "new_password": "ChangedPass123!"},
    )
    assert ok_resp.status_code == 200


@pytest.mark.asyncio
async def test_raw_tokens_never_stored_in_database(client: AsyncClient) -> None:
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "rawcheck@example.com",
            "password": "Password123!",
            "display_name": "Raw Check",
            "role": "startup",
        },
    )
    user_id = uuid.UUID(reg_resp.json()["id"])

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "rawcheck@example.com", "password": "Password123!"},
    )
    raw_refresh = login_resp.cookies["refresh_token"]

    async with get_session_factory()() as session:
        session_row = await session.scalar(
            select(AuthSession).where(AuthSession.user_id == user_id)
        )
        assert session_row is not None
        assert session_row.refresh_token_hash != raw_refresh
        assert session_row.refresh_token_hash == hash_token(raw_refresh)

        v_token = await session.scalar(
            select(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
        )
        assert v_token is not None
        assert len(v_token.token_hash) == 64


@pytest.mark.asyncio
async def test_get_current_user_account_status_checks(
    client: AsyncClient, suspended_user: User, settings: Settings
) -> None:
    token = create_access_token(suspended_user.id, settings)
    resp = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["message"] == "Account is suspended."


@pytest.mark.asyncio
async def test_users_me_and_roles(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]

    me_resp = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["primary_email"] == "jobseeker@example.com"
    assert me_resp.json()["roles"][0]["role"] == "jobseeker"

    roles_resp = await client.get(
        "/api/v1/users/me/roles",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert roles_resp.status_code == 200
    assert len(roles_resp.json()) == 1
    assert roles_resp.json()[0]["role"] == "jobseeker"


@pytest.mark.asyncio
async def test_require_role_authorization_forbidden(
    client: AsyncClient, verified_jobseeker_user: User
) -> None:
    # A jobseeker user attempting to access a mentor-only endpoint must receive HTTP 403 Forbidden
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "jobseeker@example.com", "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]

    resp = await client.get(
        "/api/v1/test-roles/mentor-only",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"
