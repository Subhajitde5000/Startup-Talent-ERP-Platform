"""Step 3a tests: profile PATCH, readiness, data (delete) requests, skills.

Covers happy path / validation / auth failure / authorization failure per
AGENTS.md section 7, plus the Step 3 approval items (soft-delete email
re-registration, reserved handles, URL schemes, server-controlled fields).
"""

import re
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.profile import Skill, UserReadiness
from app.models.user import User
from app.services import email_service

PASSWORD = "Str0ng!Password99"


def _extract_code() -> str:
    assert email_service.SENT_EMAILS, "expected a verification email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"(\d{6})", body)
    assert match, f"no 6-digit code in email body: {body!r}"
    return match.group(1)


async def _register(client: AsyncClient, email: str, role: str = "startup"):
    return await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "display_name": "Test Founder",
            "role": role,
        },
    )


async def _signup_verified(client: AsyncClient, email: str, role: str = "startup") -> dict:
    """Register + verify; return {email, headers} with a Bearer token."""
    resp = await _register(client, email=email, role=role)
    assert resp.status_code == 201, resp.text
    code = _extract_code()
    verify = await client.post("/api/v1/auth/verify-email", json={"email": email, "code": code})
    assert verify.status_code == 200, verify.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"email": email, "headers": {"Authorization": f"Bearer {token}"}}


# --- GET /users/me (profile fields) ---


@pytest.mark.asyncio
async def test_get_me_includes_profile_fields(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    resp = await client.get("/api/v1/users/me", headers=auth["headers"])
    assert resp.status_code == 200
    body = resp.json()
    for field in (
        "handle",
        "avatar_url",
        "avatar_initials",
        "phone",
        "locale",
        "timezone",
        "region",
        "onboarding_step",
        "linkedin_url",
        "github_url",
        "twitter_url",
        "website_url",
    ):
        assert field in body, f"missing {field}"
    assert body["handle"] is None
    assert body["locale"] == "en-IN"
    assert body["timezone"] == "Asia/Kolkata"
    assert body["linkedin_url"] is None
    assert "password_hash" not in body


# --- PATCH /users/me ---


@pytest.mark.asyncio
async def test_patch_me_full_profile(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    payload = {
        "display_name": "Ananya Das",
        "handle": "ananya_das",
        "avatar_url": "https://cdn.example.com/a.png",
        "avatar_initials": "AD",
        "phone": "+91 98300 11223",
        "locale": "en-IN",
        "timezone": "Asia/Kolkata",
        "region": "Kolkata, IN",
        "onboarding_step": "role_select",
        "linkedin_url": "https://linkedin.com/in/ananya",
        "github_url": "https://github.com/ananya",
        "twitter_url": "https://x.com/ananya",
        "website_url": "https://ananya.dev",
    }
    resp = await client.patch("/api/v1/users/me", json=payload, headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    for key, value in payload.items():
        assert body[key] == value, key
    # server-owned fields unchanged (verification activated the account)
    assert body["email"] == "founder@example.com"
    assert body["status"] == "active"
    assert body["verification"] == "pending"  # admin review is Step 15

    me = (await client.get("/api/v1/users/me", headers=auth["headers"])).json()
    assert me["handle"] == "ananya_das"
    assert me["website_url"] == "https://ananya.dev"


@pytest.mark.asyncio
async def test_patch_me_partial_keeps_other_fields(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    first = await client.patch(
        "/api/v1/users/me", json={"display_name": "Original Name"}, headers=auth["headers"]
    )
    assert first.status_code == 200, first.text
    second = await client.patch(
        "/api/v1/users/me", json={"region": "Pune, IN"}, headers=auth["headers"]
    )
    assert second.status_code == 200, second.text
    body = second.json()
    assert body["region"] == "Pune, IN"
    assert body["display_name"] == "Original Name"


@pytest.mark.asyncio
async def test_patch_me_requires_auth(client: AsyncClient) -> None:
    resp = await client.patch("/api/v1/users/me", json={"region": "x"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_patch_me_rejects_server_controlled_and_unknown_fields(
    client: AsyncClient, db_session
) -> None:
    """Item 6: mass-assignment is impossible — status/roles/email/ids are
    rejected with 422 and never reach the database."""
    auth = await _signup_verified(client, "founder@example.com")
    before = (await client.get("/api/v1/users/me", headers=auth["headers"])).json()
    for bad in (
        {"status": "active"},
        {"primary_email": "attacker@example.com"},
        {"email": "attacker@example.com"},
        {"roles": ["admin"]},
        {"email_verified_at": "2020-01-01T00:00:00Z"},
        {"verification": "verified"},
        {"id": "00000000-0000-0000-0000-000000000000"},
        {"created_at": "2020-01-01T00:00:00Z"},
    ):
        resp = await client.patch("/api/v1/users/me", json=bad, headers=auth["headers"])
        assert resp.status_code == 422, (bad, resp.text)
    after = (await client.get("/api/v1/users/me", headers=auth["headers"])).json()
    assert after["email"] == before["email"]
    assert after["status"] == before["status"]
    assert after["roles"] == before["roles"]
    user = (
        await db_session.execute(select(User).where(User.primary_email == "founder@example.com"))
    ).scalar_one()
    assert user.status.value == "active"  # set by verification, not by PATCH


# --- handle rules ---


@pytest.mark.asyncio
@pytest.mark.parametrize("handle", ["ab", "has space", "dash-not-allowed", "x" * 31])
async def test_patch_me_rejects_invalid_handle(client: AsyncClient, handle: str) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    resp = await client.patch("/api/v1/users/me", json={"handle": handle}, headers=auth["headers"])
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_patch_me_lowercases_handle(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    resp = await client.patch(
        "/api/v1/users/me", json={"handle": "MyHandle_1"}, headers=auth["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["handle"] == "myhandle_1"


@pytest.mark.asyncio
@pytest.mark.parametrize("handle", ["admin", "root", "forma", "me", "support"])
async def test_patch_me_rejects_reserved_handle(client: AsyncClient, handle: str) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    resp = await client.patch("/api/v1/users/me", json={"handle": handle}, headers=auth["headers"])
    assert resp.status_code == 422, resp.text
    assert "reserved" in resp.text


@pytest.mark.asyncio
async def test_patch_me_handle_conflict_returns_409(client: AsyncClient) -> None:
    first = await _signup_verified(client, "one@example.com")
    second = await _signup_verified(client, "two@example.com")
    ok = await client.patch(
        "/api/v1/users/me", json={"handle": "taken_handle"}, headers=first["headers"]
    )
    assert ok.status_code == 200, ok.text
    conflict = await client.patch(
        "/api/v1/users/me", json={"handle": "taken_handle"}, headers=second["headers"]
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_patch_me_handle_reusable_after_soft_delete(
    client: AsyncClient, db_session
) -> None:
    """Partial unique indexes (WHERE deleted_at IS NULL): a soft-deleted
    user's handle becomes available again."""
    first = await _signup_verified(client, "one@example.com")
    second = await _signup_verified(client, "two@example.com")
    ok = await client.patch(
        "/api/v1/users/me", json={"handle": "gone_handle"}, headers=first["headers"]
    )
    assert ok.status_code == 200, ok.text
    user = (
        await db_session.execute(select(User).where(User.primary_email == "one@example.com"))
    ).scalar_one()
    user.deleted_at = datetime.now(UTC)
    await db_session.commit()
    again = await client.patch(
        "/api/v1/users/me", json={"handle": "gone_handle"}, headers=second["headers"]
    )
    assert again.status_code == 200, again.text


# --- item 2: soft delete then register the same email again ---


@pytest.mark.asyncio
async def test_register_same_email_after_account_deletion(
    client: AsyncClient, db_session
) -> None:
    first = await _register(client, "reuse@example.com")
    assert first.status_code == 201
    first_body = first.json()
    code = _extract_code()
    verify = await client.post(
        "/api/v1/auth/verify-email", json={"email": "reuse@example.com", "code": code}
    )
    assert verify.status_code == 200, verify.text

    old_user = (
        await db_session.execute(select(User).where(User.primary_email == "reuse@example.com"))
    ).scalar_one()
    old_id = old_user.id
    old_user.deleted_at = datetime.now(UTC)
    await db_session.commit()

    # login as the deleted account must fail (email lookup filters deleted_at)
    login = await client.post(
        "/api/v1/auth/login", json={"email": "reuse@example.com", "password": PASSWORD}
    )
    assert login.status_code == 401

    # re-registering the same email succeeds with the SAME body (no user_id)
    second = await _register(client, "reuse@example.com")
    assert second.status_code == 201, second.text
    assert second.json() == first_body

    # exactly one live account for the email; it is a different user
    live_count = (
        await db_session.execute(
            select(func.count())
            .select_from(User)
            .where(User.primary_email == "reuse@example.com", User.deleted_at.is_(None))
        )
    ).scalar_one()
    assert live_count == 1

    login2 = await client.post(
        "/api/v1/auth/login", json={"email": "reuse@example.com", "password": PASSWORD}
    )
    assert login2.status_code == 200, login2.text
    me = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {login2.json()['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["id"] != str(old_id)


@pytest.mark.asyncio
async def test_register_stores_email_lowercase(client: AsyncClient, db_session) -> None:
    resp = await _register(client, "Mixed.Case@EXAMPLE.COM")
    assert resp.status_code == 201, resp.text
    user = (
        await db_session.execute(
            select(User).where(User.primary_email == "mixed.case@example.com")
        )
    ).scalar_one()
    assert user.primary_email == user.primary_email.lower()


# --- URL and locale/timezone validation ---


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "ftp://files.example.com/x",
        "notaurl",
        "http:/broken.example.com",
        "https://example.com/" + "x" * 500,
    ],
)
async def test_patch_me_rejects_invalid_urls(client: AsyncClient, url: str) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    resp = await client.patch(
        "/api/v1/users/me", json={"website_url": url}, headers=auth["headers"]
    )
    assert resp.status_code == 422, (url[:40], resp.text)


@pytest.mark.asyncio
async def test_patch_me_accepts_http_and_https_and_clears_with_null(
    client: AsyncClient,
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    ok = await client.patch(
        "/api/v1/users/me",
        json={"linkedin_url": "https://www.linkedin.com/in/x", "github_url": "http://gh.example"},
        headers=auth["headers"],
    )
    assert ok.status_code == 200, ok.text
    cleared = await client.patch(
        "/api/v1/users/me", json={"github_url": None}, headers=auth["headers"]
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["github_url"] is None
    assert cleared.json()["linkedin_url"] == "https://www.linkedin.com/in/x"


@pytest.mark.asyncio
async def test_patch_me_rejects_invalid_timezone_and_locale(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    bad_tz = await client.patch(
        "/api/v1/users/me", json={"timezone": "Mars/Olympus"}, headers=auth["headers"]
    )
    assert bad_tz.status_code == 422
    bad_locale = await client.patch(
        "/api/v1/users/me", json={"locale": "english"}, headers=auth["headers"]
    )
    assert bad_locale.status_code == 422
    ok = await client.patch(
        "/api/v1/users/me",
        json={"timezone": "Europe/Berlin", "locale": "hi-IN"},
        headers=auth["headers"],
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["timezone"] == "Europe/Berlin"


@pytest.mark.asyncio
async def test_patch_me_null_not_allowed_for_required_fields(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    for field in ("display_name", "locale", "timezone"):
        resp = await client.patch(
            "/api/v1/users/me", json={field: None}, headers=auth["headers"]
        )
        assert resp.status_code == 422, (field, resp.text)


# --- readiness ---


@pytest.mark.asyncio
async def test_readiness_flow(client: AsyncClient, db_session) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    resp = await client.get("/api/v1/users/me/readiness", headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # fresh verified user: display_name + email_verified only (2 of 5)
    assert body["profile_complete"] == 40
    assert body["resume_score"] == 0
    assert body["practice_score"] == 0
    assert body["overall_score"] == 40

    patch = await client.patch(
        "/api/v1/users/me",
        json={
            "handle": "ready_one",
            "avatar_url": "https://cdn.example.com/me.png",
            "phone": "+91 90000 00001",
        },
        headers=auth["headers"],
    )
    assert patch.status_code == 200, patch.text
    resp2 = await client.get("/api/v1/users/me/readiness", headers=auth["headers"])
    scores = resp2.json()
    assert scores["profile_complete"] == 100
    assert scores["overall_score"] == 100

    # scores are persisted (user_readiness row upserted)
    me = (await client.get("/api/v1/users/me", headers=auth["headers"])).json()
    row = (
        await db_session.execute(
            select(UserReadiness).where(UserReadiness.user_id == uuid.UUID(me["id"]))
        )
    ).scalar_one_or_none()
    assert row is not None
    assert row.profile_complete == 100
    assert row.overall_score == 100


@pytest.mark.asyncio
async def test_patch_me_founder_profile_and_privacy_fields(client: AsyncClient) -> None:
    """0004 columns: headline/bio/education/prior_role/din_number + privacy
    toggles round-trip; defaults are true for a fresh user."""
    auth = await _signup_verified(client, "founder@example.com")
    fresh = (await client.get("/api/v1/users/me", headers=auth["headers"])).json()
    assert fresh["profile_public"] is True
    assert fresh["allow_outreach"] is True
    assert fresh["headline"] is None

    payload = {
        "headline": "Founder & Chief Executive Officer",
        "bio": "Building cross-border GST invoicing tooling.",
        "education": "B.Tech in Computer Science, IIT Bombay (2018)",
        "prior_role": "Ex-Lead Product Manager @ Razorpay",
        "founder_vision": "Automating treasury workflows.",
        "din_number": "DIN: 08942119",
        "profile_public": False,
        "allow_outreach": False,
    }
    resp = await client.patch("/api/v1/users/me", json=payload, headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    for key, value in payload.items():
        assert body[key] == value, key

    # explicit null on the booleans is rejected (NOT NULL columns)
    for field in ("profile_public", "allow_outreach"):
        bad = await client.patch(
            "/api/v1/users/me", json={field: None}, headers=auth["headers"]
        )
        assert bad.status_code == 422, (field, bad.text)


@pytest.mark.asyncio
async def test_startup_onboarding_founder_profile_payload_round_trips(client: AsyncClient) -> None:
    """The final startup-onboarding step writes personal founder data only.

    Startup/company fields belong to the startup profile in Step 5; this confirms
    the Step 3 user-profile API persists the exact founder payload plus completion
    state without exposing a cross-user write path.
    """
    auth = await _signup_verified(client, "founder-onboarding@example.com", role="startup")
    payload = {
        "display_name": "Aisha Khan",
        "handle": "aisha_khan",
        "phone": "+91 98765 43210",
        "headline": "Co-founder & CEO",
        "region": "Bengaluru, Karnataka, India",
        "bio": "Product builder focused on practical healthcare access.",
        "education": "B.Tech, IIT Bombay",
        "prior_role": "Ex-product lead at Acme",
        "founder_vision": "Make specialist care accessible to every family.",
        "onboarding_step": "completed",
    }
    saved = await client.patch("/api/v1/users/me", json=payload, headers=auth["headers"])
    assert saved.status_code == 200, saved.text
    for field, value in payload.items():
        assert saved.json()[field] == value, field

    fetched = await client.get("/api/v1/users/me", headers=auth["headers"])
    assert fetched.status_code == 200, fetched.text
    for field, value in payload.items():
        assert fetched.json()[field] == value, field


@pytest.mark.asyncio
async def test_readiness_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/users/me/readiness")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_readiness_response_shape(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    body = (await client.get("/api/v1/users/me/readiness", headers=auth["headers"])).json()
    assert set(body.keys()) == {
        "profile_complete",
        "resume_score",
        "practice_score",
        "overall_score",
    }


# --- data (delete) requests ---


@pytest.mark.asyncio
async def test_delete_request_flow(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    resp = await client.post("/api/v1/users/me/delete-request", headers=auth["headers"])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["request_type"] == "erasure"
    assert body["status"] == "received"
    assert body["priority"] == "normal"
    due = datetime.fromisoformat(body["due_at"])
    received = datetime.fromisoformat(body["received_at"])
    assert due - received == timedelta(days=30)

    again = await client.post("/api/v1/users/me/delete-request", headers=auth["headers"])
    assert again.status_code == 409

    got = await client.get("/api/v1/users/me/delete-request", headers=auth["headers"])
    assert got.status_code == 200
    assert got.json()["id"] == body["id"]


@pytest.mark.asyncio
async def test_delete_request_requires_auth(client: AsyncClient) -> None:
    assert (await client.post("/api/v1/users/me/delete-request")).status_code == 401
    assert (await client.get("/api/v1/users/me/delete-request")).status_code == 401


@pytest.mark.asyncio
async def test_delete_request_none_before_created(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    resp = await client.get("/api/v1/users/me/delete-request", headers=auth["headers"])
    assert resp.status_code == 200
    assert resp.json() is None


# --- skills ---


async def _seed_skills(db_session) -> None:
    db_session.add_all(
        [
            Skill(name="Python", category="Engineering"),
            Skill(name="Golang", category="Engineering"),
            Skill(name="Go", category="Engineering"),
            Skill(name="Product Management", category="Product"),
            Skill(name="Machine Learning", category="Data"),
        ]
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_skills_search(client: AsyncClient, db_session) -> None:
    await _seed_skills(db_session)
    resp = await client.get("/api/v1/skills")  # public read, no auth required
    assert resp.status_code == 200, resp.text
    names = [s["name"] for s in resp.json()]
    assert names == sorted(names, key=str.lower)
    assert len(names) == 5

    q = await client.get("/api/v1/skills", params={"q": "PYTH"})
    assert q.status_code == 200
    assert [s["name"] for s in q.json()] == ["Python"]

    go = await client.get("/api/v1/skills", params={"q": "go"})
    assert [s["name"] for s in go.json()] == ["Go", "Golang"]  # exact first

    none = await client.get("/api/v1/skills", params={"q": "zzz-no-match"})
    assert none.json() == []


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, 51, -1])
async def test_skills_limit_bounds(client: AsyncClient, limit: int) -> None:
    resp = await client.get("/api/v1/skills", params={"limit": limit})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_skills_post_does_not_exist(client: AsyncClient) -> None:
    """Item 8: POST /skills is removed in Step 3a (admin-only, Step 7)."""
    resp = await client.post("/api/v1/skills", json={"name": "Rust"})
    assert resp.status_code == 405
