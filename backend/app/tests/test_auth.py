"""Step 2 auth tests: happy path, validation, auth failures, authorization."""

import re
from datetime import UTC, datetime, timedelta
from typing import Annotated

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import hash_token
from app.models.auth import EmailVerificationToken
from app.models.user import AccountStatus, User
from app.services import email_service

PASSWORD = "Str0ng!Password99"
NEW_PASSWORD = "N3w!Password456"


def _extract_code() -> str:
    assert email_service.SENT_EMAILS, "expected a verification email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"(\d{6})", body)
    assert match, f"no 6-digit code in email body: {body!r}"
    return match.group(1)


def _extract_reset_token() -> str:
    assert email_service.SENT_EMAILS, "expected a reset email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"token=([A-Za-z0-9_\-]+)", body)
    assert match, f"no reset token in email body: {body!r}"
    return match.group(1)


async def _register(client: AsyncClient, email: str = "founder@example.com", role: str = "startup"):
    return await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "display_name": "Test Founder",
            "role": role,
        },
    )


async def _register_and_verify(
    client: AsyncClient, email: str = "founder@example.com", role: str = "startup"
):
    resp = await _register(client, email=email, role=role)
    assert resp.status_code == 201, resp.text
    code = _extract_code()
    verify = await client.post("/api/v1/auth/verify-email", json={"email": email, "code": code})
    assert verify.status_code == 200, verify.text
    return resp


async def _login(client: AsyncClient, email: str = "founder@example.com", password: str = PASSWORD):
    return await client.post("/api/v1/auth/login", json={"email": email, "password": password})


async def _login_ok(
    client: AsyncClient, email: str = "founder@example.com", password: str = PASSWORD
):
    resp = await _login(client, email=email, password=password)
    assert resp.status_code == 200, resp.text
    return resp.json()


# --- Register / validation ---


@pytest.mark.asyncio
async def test_register_happy_path(client: AsyncClient) -> None:
    resp = await _register(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["user_id"] is not None
    assert len(email_service.SENT_EMAILS) == 1


@pytest.mark.asyncio
async def test_register_rejects_admin_role(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "boss@example.com",
            "password": PASSWORD,
            "display_name": "Boss",
            "role": "admin",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_rejects_weak_password(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak@example.com",
            "password": "short",
            "display_name": "Weak",
            "role": "startup",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_rejects_common_password(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "common@example.com",
            "password": "password123",
            "display_name": "Common",
            "role": "startup",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_does_not_leak_existing_email(client: AsyncClient) -> None:
    first = await _register(client)
    assert first.status_code == 201
    second = await _register(client)
    # Same generic shape/status whether the email is new or existing.
    assert second.status_code == 201
    assert second.json()["message"] == first.json()["message"]


# --- Email verification ---


@pytest.mark.asyncio
async def test_verify_email_happy_path(client: AsyncClient) -> None:
    await _register(client)
    code = _extract_code()
    resp = await client.post(
        "/api/v1/auth/verify-email", json={"email": "founder@example.com", "code": code}
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_verify_email_wrong_code(client: AsyncClient) -> None:
    await _register(client)
    resp = await client.post(
        "/api/v1/auth/verify-email", json={"email": "founder@example.com", "code": "000000"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_verify_email_rejects_wrong_email(client: AsyncClient) -> None:
    """A code issued to one account must not verify a different account."""
    await _register(client, email="founder@example.com")
    code = _extract_code()
    await _register(client, email="second@example.com")
    resp = await client.post(
        "/api/v1/auth/verify-email", json={"email": "second@example.com", "code": code}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_verify_email_single_use(client: AsyncClient) -> None:
    await _register(client)
    code = _extract_code()
    first = await client.post(
        "/api/v1/auth/verify-email", json={"email": "founder@example.com", "code": code}
    )
    assert first.status_code == 200
    second = await client.post(
        "/api/v1/auth/verify-email", json={"email": "founder@example.com", "code": code}
    )
    assert second.status_code == 401


@pytest.mark.asyncio
async def test_verify_email_expired(client: AsyncClient, db_session) -> None:
    await _register(client)
    code = _extract_code()
    # Expire the stored token.
    result = await db_session.execute(select(EmailVerificationToken))
    token = result.scalar_one()
    token.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()
    resp = await client.post(
        "/api/v1/auth/verify-email", json={"email": "founder@example.com", "code": code}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "TOKEN_EXPIRED"


@pytest.mark.asyncio
async def test_resend_verification_cooldown(client: AsyncClient) -> None:
    await _register(client)
    resp = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "founder@example.com"}
    )
    assert resp.status_code == 429


@pytest.mark.asyncio
async def test_resend_verification_unknown_email_is_generic(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/auth/resend-verification", json={"email": "nobody@example.com"}
    )
    assert resp.status_code == 200


# --- Login / tokens ---


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    await _register_and_verify(client)
    resp = await _login(client, password="Wrong!Password99")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_unknown_email_same_error(client: AsyncClient) -> None:
    resp = await _login(client, email="ghost@example.com")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_happy_path_and_me(client: AsyncClient) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    assert tokens["token_type"] == "bearer"
    me = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "founder@example.com"
    assert body["roles"] == ["startup"]
    assert body["primary_role"] == "startup"
    assert "password_hash" not in body


@pytest.mark.asyncio
async def test_me_without_token_is_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_with_expired_token(client: AsyncClient) -> None:
    from app.core.security import create_access_token

    await _register_and_verify(client)
    # Create an already-expired access token by using negative expiry.
    from uuid import uuid4

    expired = create_access_token(uuid4(), expires_minutes=-1)
    resp = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "TOKEN_EXPIRED"


@pytest.mark.asyncio
async def test_refresh_rotation_and_reuse_revokes_chain(client: AsyncClient) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    refreshed = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()
    assert new_tokens["refresh_token"] != tokens["refresh_token"]
    # Reusing the old (revoked) refresh token must revoke the whole chain.
    reuse = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert reuse.status_code == 401
    assert reuse.json()["error"]["code"] == "TOKEN_REUSED"
    # The rotated token is now also revoked.
    after = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert after.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_session(client: AsyncClient) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    out = await client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert out.status_code == 204
    refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 401


@pytest.mark.asyncio
async def test_logout_all_revokes_everything(client: AsyncClient) -> None:
    await _register_and_verify(client)
    first = await _login_ok(client)
    second = await _login_ok(client)
    resp = await client.post(
        "/api/v1/auth/logout-all",
        headers={"Authorization": f"Bearer {first['access_token']}"},
    )
    assert resp.status_code == 200
    for tokens in (first, second):
        refresh = await client.post(
            "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
        )
        assert refresh.status_code == 401


# --- Account states ---


@pytest.mark.asyncio
async def test_suspended_user_rejected_everywhere(client: AsyncClient, db_session) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    result = await db_session.execute(select(User))
    user = result.scalar_one()
    user.status = AccountStatus.suspended
    await db_session.commit()
    me = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 403
    assert me.json()["error"]["code"] == "ACCOUNT_SUSPENDED"
    login = await _login(client)
    assert login.status_code == 403


# --- Password reset / change ---


@pytest.mark.asyncio
async def test_password_reset_flow_revokes_sessions(client: AsyncClient) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    forgot = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "founder@example.com"}
    )
    assert forgot.status_code == 200
    token = _extract_reset_token()
    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert reset.status_code == 200
    # Old refresh token is revoked.
    refresh = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 401
    # Old password fails, new password works.
    assert (await _login(client)).status_code == 401
    assert (await _login(client, password=NEW_PASSWORD)).status_code == 200


@pytest.mark.asyncio
async def test_password_reset_single_use(client: AsyncClient) -> None:
    await _register_and_verify(client)
    await client.post("/api/v1/auth/forgot-password", json={"email": "founder@example.com"})
    token = _extract_reset_token()
    first = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": NEW_PASSWORD},
    )
    assert first.status_code == 200
    second = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "An0ther!Password77"},
    )
    assert second.status_code == 401


@pytest.mark.asyncio
async def test_forgot_password_unknown_email_is_generic(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert resp.status_code == 200
    assert email_service.SENT_EMAILS == []


@pytest.mark.asyncio
async def test_change_password_requires_current(client: AsyncClient) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Wrong!Password99", "new_password": NEW_PASSWORD},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_change_password_happy_path(client: AsyncClient) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 200
    assert (await _login(client, password=NEW_PASSWORD)).status_code == 200


@pytest.mark.asyncio
async def test_change_email_requires_current_password(client: AsyncClient) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    resp = await client.post(
        "/api/v1/auth/change-email",
        json={"current_password": "Wrong!Password99", "new_email": "new@example.com"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 401


# --- Roles ---


@pytest.mark.asyncio
async def test_add_role_and_reject_admin(client: AsyncClient) -> None:
    await _register_and_verify(client)
    tokens = await _login_ok(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    added = await client.post("/api/v1/auth/add-role", json={"role": "mentor"}, headers=headers)
    assert added.status_code == 200
    me = await client.get("/api/v1/users/me", headers=headers)
    assert sorted(me.json()["roles"]) == ["mentor", "startup"]
    admin = await client.post("/api/v1/auth/add-role", json={"role": "admin"}, headers=headers)
    assert admin.status_code == 422


@pytest.mark.asyncio
async def test_require_role_wrong_role_forbidden(client: AsyncClient) -> None:
    from fastapi import Depends, FastAPI, Request
    from fastapi.responses import JSONResponse
    from httpx import ASGITransport

    from app.core.dependencies import require_role
    from app.core.exceptions import AppException, error_body
    from app.db.session import get_db
    from app.models.user import UserRole
    from app.tests.conftest import TestSessionFactory

    await _register_and_verify(client, role="startup")
    tokens = await _login_ok(client)

    probe = FastAPI()

    @probe.exception_handler(AppException)
    async def _handler(_request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, exc.details),
        )

    @probe.get("/probe")
    async def _probe(user: Annotated[object, Depends(require_role(UserRole.mentor))]):
        return {"ok": True}

    async def _override_db():
        async with TestSessionFactory() as session:
            yield session

    probe.dependency_overrides[get_db] = _override_db
    async with AsyncClient(transport=ASGITransport(app=probe), base_url="http://test") as ac:
        resp = await ac.get("/probe", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


# --- Rate limiting ---


@pytest.mark.asyncio
async def test_login_rate_limit(client: AsyncClient) -> None:
    await _register_and_verify(client)
    # Account limit is 10 per 300s in test settings (defaults).
    last_status = None
    for _ in range(12):
        resp = await _login(client, password="Wrong!Password99")
        last_status = resp.status_code
        if resp.status_code == 429:
            break
    assert last_status == 429


# --- Token storage hygiene ---


@pytest.mark.asyncio
async def test_tokens_stored_hashed(client: AsyncClient, db_session) -> None:
    await _register(client)
    code = _extract_code()
    result = await db_session.execute(select(EmailVerificationToken))
    token = result.scalar_one()
    assert token.token_hash == hash_token(code)
    assert token.token_hash != code
    assert token.consumed_at is None


@pytest.mark.asyncio
async def test_health_and_ready(client: AsyncClient) -> None:
    health = await client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}
    ready = await client.get("/ready")
    assert ready.status_code == 200


@pytest.mark.asyncio
async def test_openapi_lists_auth_endpoints(client: AsyncClient) -> None:
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    paths = resp.json()["paths"]
    for path in (
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/logout-all",
        "/api/v1/auth/verify-email",
        "/api/v1/auth/resend-verification",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/auth/change-password",
        "/api/v1/users/me",
    ):
        assert path in paths, f"missing {path}"
