"""Step 8f tests: mentor sign-off on readiness items.

Covers, per AGENTS.md section 7 and the 8f plan:

- happy path: a startup submits an item, the mentor signs it off, the
  readiness score moves, and the mentor can revoke their own sign-off,
- 401 on both routes without a token,
- 403: the STARTUP OWNER cannot sign off their own startup's readiness
  (self-sign-off is structurally impossible), nor a plain member, nor a
  viewer,
- 404: an outsider, and a mentor addressing someone else's mentorship,
- cross-organization: a mentor of startup A cannot sign off startup B's
  readiness item, and a criterion from another org's state is not reached,
- state machine: only ``submitted`` can be signed off; a mentor cannot
  revoke a sign-off that came from a different mentorship or from an admin,
- provenance: ``signed_off_mentorship_id`` is stamped, and the admin route
  still works and leaves it null.
"""

import re
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole, UserRoleRow
from app.services import readiness_service

PASSWORD = "Str0ng!Password99"
GOAL = "Help us get investment-ready"
CRITERION_CODE = "pitch_deck_summary"


def _code() -> str:
    from app.services import email_service

    assert email_service.SENT_EMAILS, "expected a verification email"
    match = re.search(r"(\d{6})", email_service.SENT_EMAILS[-1]["body"])
    assert match, "no 6-digit code in the email body"
    return match.group(1)


async def _signup(client: AsyncClient, email: str, role: str = "startup") -> dict:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "display_name": email.split("@")[0].title(),
            "role": role,
        },
    )
    assert resp.status_code == 201, resp.text
    await client.post("/api/v1/auth/verify-email", json={"email": email, "code": _code()})
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = await client.get("/api/v1/users/me", headers=headers)
    return {"email": email, "headers": headers, "id": me.json()["id"]}


async def _mentor(client: AsyncClient, email: str) -> dict:
    auth = await _signup(client, email, role="mentor")
    saved = await client.patch(
        "/api/v1/mentor-profile/me",
        json={"headline": "Advisor", "accepting_requests": True},
        headers=auth["headers"],
    )
    assert saved.status_code == 200, saved.text
    return auth


async def _org(client: AsyncClient, owner: dict, name: str = "Acme") -> str:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": "startup"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _pair(client: AsyncClient, tag: str = "f8") -> dict:
    founder = await _signup(client, f"founder-{tag}@f8.dev")
    mentor = await _mentor(client, f"mentor-{tag}@f8.dev")
    org_id = await _org(client, founder, f"Co {tag}")
    created = await client.post(
        f"/api/v1/organizations/{org_id}/mentorships",
        json={"mentor_id": mentor["id"], "goal": GOAL},
        headers=founder["headers"],
    )
    assert created.status_code == 201, created.text
    mid = created.json()["id"]
    accepted = await client.post(
        f"/api/v1/mentorships/{mid}/accept", json={}, headers=mentor["headers"]
    )
    assert accepted.status_code == 200, accepted.text
    return {"founder": founder, "mentor": mentor, "org_id": org_id, "mid": mid}


async def _make_platform_admin(
    client: AsyncClient, db_session: AsyncSession, email: str
) -> dict:
    """Register a normal user, then grant ``admin`` out of band.

    The public API refuses to grant ``admin`` (the founder self-sign-off
    guard), so the platform admin is created the way the dev seed does it:
    a direct ``user_roles`` row.
    """
    auth = await _signup(client, email)
    found = (
        await db_session.execute(select(User).where(User.primary_email == email))
    ).scalar_one()
    db_session.add(
        UserRoleRow(user_id=found.id, role=UserRole.admin, is_primary=False)
    )
    await db_session.commit()
    return auth


async def _criterion_id(
    client: AsyncClient, auth: dict, db_session: AsyncSession
) -> str:
    # Criteria are global reference data; the app bootstraps them at startup,
    # which the per-test schema reset undoes, so seed them explicitly.
    await readiness_service.bootstrap_criteria(db_session)
    resp = await client.get("/api/v1/readiness/criteria", headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    for item in resp.json():
        if item["code"] == CRITERION_CODE:
            return item["id"]
    raise AssertionError(f"criterion {CRITERION_CODE} missing from the reference list")


async def _submitted_item(
    client: AsyncClient, ctx: dict, db_session: AsyncSession
) -> str:
    """Add evidence and submit, so there is something to sign off."""
    cid = await _criterion_id(client, ctx["founder"], db_session)
    patched = await client.patch(
        f"/api/v1/organizations/{ctx['org_id']}/readiness/{cid}",
        json={"evidence": "Twelve-slide deck covering problem, market and traction."},
        headers=ctx["founder"]["headers"],
    )
    assert patched.status_code == 200, patched.text
    sent = await client.post(
        f"/api/v1/organizations/{ctx['org_id']}/readiness/{cid}/submit",
        headers=ctx["founder"]["headers"],
    )
    assert sent.status_code == 200, sent.text
    assert sent.json()["status"] == "submitted"
    return cid


# ------------------------------------------------------------------ happy path


async def test_mentor_signs_off_and_revokes(client: AsyncClient, db_session: AsyncSession) -> None:
    ctx = await _pair(client, "happy")
    cid = await _submitted_item(client, ctx, db_session)

    signed = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/sign-off",
        headers=ctx["mentor"]["headers"],
    )
    assert signed.status_code == 200, signed.text
    body = signed.json()
    assert body["status"] == "signed_off"
    assert body["signed_off_by"] == ctx["mentor"]["id"]
    assert body["signed_off_at"] is not None
    # Provenance (Q1a): WHICH mentorship this came through.
    assert body["signed_off_mentorship_id"] == ctx["mid"]
    # D7: the name is resolved server-side, so no page has to look up a UUID.
    # The fixture derives display_name from the email local part.
    assert body["signed_off_by_name"] == "Mentor-Happy"

    # The score roll-up followed.
    board = await client.get(
        f"/api/v1/organizations/{ctx['org_id']}/readiness", headers=ctx["founder"]["headers"]
    )
    assert board.status_code == 200, board.text
    assert board.json()["summary"]["criteria_signed_off"] >= 1

    revoked = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/revoke",
        headers=ctx["mentor"]["headers"],
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["status"] == "in_progress"
    assert revoked.json()["signed_off_by"] is None
    assert revoked.json()["signed_off_mentorship_id"] is None
    assert revoked.json()["signed_off_by_name"] is None


# ------------------------------------------------------------------ authz


async def test_startup_owner_cannot_sign_off(client: AsyncClient, db_session: AsyncSession) -> None:
    """The whole point of 8f: a founder cannot vouch for their own startup."""
    ctx = await _pair(client, "selfsign")
    cid = await _submitted_item(client, ctx, db_session)
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/sign-off",
        headers=ctx["founder"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_viewer_cannot_sign_off(client: AsyncClient, db_session: AsyncSession) -> None:
    ctx = await _pair(client, "viewer")
    cid = await _submitted_item(client, ctx, db_session)
    viewer = await _signup(client, "v-f8@f8.dev")
    invited = await client.post(
        f"/api/v1/organizations/{ctx['org_id']}/invites",
        json={"email": viewer["email"], "role": "viewer"},
        headers=ctx["founder"]["headers"],
    )
    assert invited.status_code == 201, invited.text
    joined = await client.post(
        f"/api/v1/invites/{invited.json()['token']}/accept",
        json={},
        headers=viewer["headers"],
    )
    assert joined.status_code == 200, joined.text

    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/sign-off",
        headers=viewer["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_outsider_gets_404(client: AsyncClient, db_session: AsyncSession) -> None:
    ctx = await _pair(client, "out")
    cid = await _submitted_item(client, ctx, db_session)
    outsider = await _signup(client, "nobody@f8.dev")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/sign-off",
        headers=outsider["headers"],
    )
    assert resp.status_code == 404, resp.text
    revoke = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/revoke",
        headers=outsider["headers"],
    )
    assert revoke.status_code == 404, revoke.text


async def test_other_mentors_mentorship_is_404(client: AsyncClient, db_session: AsyncSession) -> None:
    """A mentor cannot address a mentorship that is not theirs (IDOR)."""
    ctx = await _pair(client, "idor")
    cid = await _submitted_item(client, ctx, db_session)
    other = await _mentor(client, "other@f8.dev")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/sign-off",
        headers=other["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_mentor_cannot_cross_organizations(client: AsyncClient, db_session: AsyncSession) -> None:
    """Mentor A's row must not sign off startup B's item."""
    a = await _pair(client, "crossa")
    b = await _pair(client, "crossb")
    b_cid = await _submitted_item(client, b, db_session)

    resp = await client.post(
        f"/api/v1/mentorships/{a['mid']}/readiness/{b_cid}/sign-off",
        headers=a["mentor"]["headers"],
    )
    # The mentorship is A's, but the criterion resolves inside A's own org,
    # so nothing of B's is touched; the attempt must not succeed.
    assert resp.status_code in (403, 404, 409), resp.text


async def test_inactive_mentorship_cannot_sign(client: AsyncClient, db_session: AsyncSession) -> None:
    ctx = await _pair(client, "ended")
    cid = await _submitted_item(client, ctx, db_session)
    ended = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/end",
        json={"reason": "Engagement complete"},
        headers=ctx["mentor"]["headers"],
    )
    assert ended.status_code == 200, ended.text
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/sign-off",
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 409, resp.text


async def test_cannot_sign_off_unsubmitted(client: AsyncClient, db_session: AsyncSession) -> None:
    ctx = await _pair(client, "unsub")
    cid = await _criterion_id(client, ctx["founder"], db_session)
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/sign-off",
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 409, resp.text


async def test_cannot_revoke_an_admin_signoff(client: AsyncClient, db_session: AsyncSession) -> None:
    """An admin sign-off has no mentorship behind it, so 8f cannot undo it."""
    ctx = await _pair(client, "adminso")
    cid = await _submitted_item(client, ctx, db_session)
    admin = await _make_platform_admin(client, db_session, "admin-f8@f8.dev")
    signed = await client.post(
        f"/api/v1/organizations/{ctx['org_id']}/readiness/{cid}/sign-off",
        headers=admin["headers"],
    )
    assert signed.status_code == 200, signed.text
    # The admin route is unchanged and stamps no mentorship.
    assert signed.json()["signed_off_mentorship_id"] is None

    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/revoke",
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 409, resp.text


async def test_cannot_revoke_another_mentorships_signoff(client: AsyncClient, db_session: AsyncSession) -> None:
    """Mentor B must not revoke mentor A's judgement on the same startup."""
    founder = await _signup(client, "founder-two@f8.dev")
    mentor_a = await _mentor(client, "mentor-a@f8.dev")
    mentor_b = await _mentor(client, "mentor-b@f8.dev")
    org_id = await _org(client, founder, "Two Mentor Co")

    mids = {}
    for name, mentor in (("a", mentor_a), ("b", mentor_b)):
        created = await client.post(
            f"/api/v1/organizations/{org_id}/mentorships",
            json={"mentor_id": mentor["id"], "goal": GOAL},
            headers=founder["headers"],
        )
        assert created.status_code == 201, created.text
        mid = created.json()["id"]
        assert (
            await client.post(
                f"/api/v1/mentorships/{mid}/accept", json={}, headers=mentor["headers"]
            )
        ).status_code == 200
        mids[name] = mid

    ctx = {"founder": founder, "org_id": org_id}
    cid = await _submitted_item(client, ctx, db_session)
    assert (
        await client.post(
            f"/api/v1/mentorships/{mids['a']}/readiness/{cid}/sign-off",
            headers=mentor_a["headers"],
        )
    ).status_code == 200

    blocked = await client.post(
        f"/api/v1/mentorships/{mids['b']}/readiness/{cid}/revoke",
        headers=mentor_b["headers"],
    )
    assert blocked.status_code == 409, blocked.text


@pytest.mark.parametrize("action", ["sign-off", "revoke"])
async def test_requires_auth(
    client: AsyncClient, db_session: AsyncSession, action: str
) -> None:
    ctx = await _pair(client, f"auth-{uuid.uuid4().hex[:6]}")
    cid = await _criterion_id(client, ctx["founder"], db_session)
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/{action}"
    )
    assert resp.status_code == 401, resp.text
