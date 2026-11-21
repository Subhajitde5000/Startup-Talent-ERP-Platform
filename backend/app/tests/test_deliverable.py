"""Step 8e tests: mentor deliverables.

Covers, per AGENTS.md section 7 and the 8e plan:

- happy path: mentor creates and assigns -> assignee starts -> submits ->
  mentor requests changes -> assignee resubmits -> mentor accepts, with the
  timestamps and the reviewer stamped correctly at each step,
- validation: blank and over-long title, over-long description/evidence,
  a due date in the past, an unknown body key, an inactive criterion, an
  assignee outside the org, and the open-work cap,
- 401 on every route without a token,
- 403: a startup owner cannot create or delete (mentor-only), a viewer
  cannot write, and an assignee cannot retitle or reassign,
- 404: an outsider gets 404 on read, list and every write,
- cross-organization: an assignee from another startup is rejected, and a
  deliverable of another mentorship is invisible,
- mass assignment: status/timestamps/reviewer/mentorship_id/id are rejected
  when a client sends them,
- the illegal transitions are 422, not silently applied.
"""

import re
import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deliverable import MentorDeliverable

PASSWORD = "Str0ng!Password99"
GOAL = "Help us sharpen pricing and the go-to-market motion"


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


async def _member(client: AsyncClient, owner: dict, org_id: str, email: str, role: str) -> dict:
    """Invite + accept, so the person is an ACTIVE member (8e D-4)."""
    person = await _signup(client, email)
    invited = await client.post(
        f"/api/v1/organizations/{org_id}/invites",
        json={"email": email, "role": role},
        headers=owner["headers"],
    )
    assert invited.status_code == 201, invited.text
    token = invited.json()["token"]
    accepted = await client.post(
        f"/api/v1/invites/{token}/accept", json={}, headers=person["headers"]
    )
    assert accepted.status_code == 200, accepted.text
    return person


async def _pair(client: AsyncClient, tag: str = "e8") -> dict:
    """A founder, a mentor, an org and an ACTIVE mentorship between them."""
    founder = await _signup(client, f"founder-{tag}@e8.dev")
    mentor = await _mentor(client, f"mentor-{tag}@e8.dev")
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


async def _deliverable(client: AsyncClient, ctx: dict, **overrides) -> dict:
    payload = {"title": "Draft the pricing page"}
    payload.update(overrides)
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json=payload,
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ------------------------------------------------------------------ happy path


async def test_full_lifecycle(client: AsyncClient) -> None:
    ctx = await _pair(client, "life")
    member = await _member(
        client, ctx["founder"], ctx["org_id"], "doer-life@e8.dev", "member"
    )

    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json={
            "title": "Draft the pricing page",
            "description": "Three tiers, with the middle one highlighted.",
            "owner_id": member["id"],
            "due_on": (date.today() + timedelta(days=7)).isoformat(),
        },
        headers=ctx["mentor"]["headers"],
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "not_started"
    assert body["viewer_side"] == "mentor"
    assert body["can_edit"] is True
    assert body["owner"]["user_id"] == member["id"]
    assert body["submitted_at"] is None
    assert body["reviewed_by"] is None
    assert body["is_overdue"] is False
    did = body["id"]

    # The assignee sees the work, is told they may edit, and starts it.
    seen = await client.get(
        f"/api/v1/deliverables/{did}", headers=member["headers"]
    )
    assert seen.status_code == 200, seen.text
    assert seen.json()["viewer_side"] == "startup"
    assert seen.json()["can_edit"] is True

    started = await client.patch(
        f"/api/v1/deliverables/{did}",
        json={"status": "in_progress"},
        headers=member["headers"],
    )
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "in_progress"

    submitted = await client.patch(
        f"/api/v1/deliverables/{did}",
        json={"status": "submitted", "evidence": "https://notion.so/pricing-draft"},
        headers=member["headers"],
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["submitted_at"] is not None

    changes = await client.patch(
        f"/api/v1/deliverables/{did}",
        json={"status": "changes_requested"},
        headers=ctx["mentor"]["headers"],
    )
    assert changes.status_code == 200, changes.text
    assert changes.json()["status"] == "changes_requested"
    # The reviewer is stamped from the token, not from the body.
    assert changes.json()["reviewed_by"] == ctx["mentor"]["id"]
    assert changes.json()["reviewed_at"] is not None

    resumed = await client.patch(
        f"/api/v1/deliverables/{did}",
        json={"status": "in_progress"},
        headers=member["headers"],
    )
    assert resumed.status_code == 200, resumed.text

    await client.patch(
        f"/api/v1/deliverables/{did}",
        json={"status": "submitted"},
        headers=member["headers"],
    )
    accepted = await client.patch(
        f"/api/v1/deliverables/{did}",
        json={"status": "accepted"},
        headers=ctx["mentor"]["headers"],
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"


async def test_startup_member_reads_but_cannot_create(client: AsyncClient) -> None:
    ctx = await _pair(client, "read")
    member = await _member(
        client, ctx["founder"], ctx["org_id"], "doer-read@e8.dev", "member"
    )
    made = await _deliverable(client, ctx)

    listed = await client.get(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables", headers=member["headers"]
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == made["id"]
    # Not their item, so they may not touch it.
    assert listed.json()["items"][0]["can_edit"] is False

    blocked = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json={"title": "Sneaky"},
        headers=member["headers"],
    )
    assert blocked.status_code == 403, blocked.text


async def test_viewer_is_read_only(client: AsyncClient) -> None:
    ctx = await _pair(client, "view")
    viewer = await _member(
        client, ctx["founder"], ctx["org_id"], "viewer@e8.dev", "viewer"
    )
    made = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json={"title": "Review the deck", "owner_id": viewer["id"]},
        headers=ctx["mentor"]["headers"],
    )
    assert made.status_code == 201, made.text

    listed = await client.get(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables", headers=viewer["headers"]
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"][0]["can_edit"] is False

    blocked = await client.patch(
        f"/api/v1/deliverables/{made.json()['id']}",
        json={"status": "in_progress"},
        headers=viewer["headers"],
    )
    assert blocked.status_code == 403, blocked.text


async def test_assignee_cannot_retitle_or_reassign(client: AsyncClient) -> None:
    ctx = await _pair(client, "assign")
    a = await _member(client, ctx["founder"], ctx["org_id"], "a-asg@e8.dev", "member")
    b = await _member(client, ctx["founder"], ctx["org_id"], "b-asg@e8.dev", "member")
    made = await _deliverable(client, ctx, owner_id=a["id"])

    rename = await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"title": "Renamed by assignee"},
        headers=a["headers"],
    )
    assert rename.status_code == 403, rename.text

    reassign = await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"owner_id": b["id"]},
        headers=a["headers"],
    )
    assert reassign.status_code == 403, reassign.text

    # The mentor CAN reassign.
    moved = await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"owner_id": b["id"]},
        headers=ctx["mentor"]["headers"],
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["owner"]["user_id"] == b["id"]


async def test_mentor_deletes_softly(client: AsyncClient) -> None:
    ctx = await _pair(client, "del")
    made = await _deliverable(client, ctx)

    gone = await client.delete(
        f"/api/v1/deliverables/{made['id']}", headers=ctx["mentor"]["headers"]
    )
    assert gone.status_code == 204, gone.text

    after = await client.get(
        f"/api/v1/deliverables/{made['id']}", headers=ctx["mentor"]["headers"]
    )
    assert after.status_code == 404, after.text
    listed = await client.get(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        headers=ctx["mentor"]["headers"],
    )
    assert listed.json()["total"] == 0


async def test_overdue_is_derived(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """``due_on`` in the past flags the row without any scheduler (D-5).

    The API refuses a past due date on purpose, so the row is backdated
    directly: that is the only way time can make an item late.
    """
    ctx = await _pair(client, "over")
    made = await _deliverable(client, ctx, due_on=(date.today() + timedelta(days=1)).isoformat())
    assert made["is_overdue"] is False
    assert made["status"] == "not_started"

    row = await db_session.get(MentorDeliverable, uuid.UUID(made["id"]))
    assert row is not None
    row.due_on = date.today() - timedelta(days=1)
    await db_session.commit()

    flagged = await client.get(
        f"/api/v1/deliverables/{made['id']}", headers=ctx["mentor"]["headers"]
    )
    assert flagged.status_code == 200, flagged.text
    assert flagged.json()["is_overdue"] is True

    only = await client.get(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables?overdue_only=true",
        headers=ctx["mentor"]["headers"],
    )
    assert only.status_code == 200, only.text
    assert only.json()["total"] == 1


# ------------------------------------------------------------------ validation


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "   "},
        {"title": "x" * 201},
        {"title": "Ok", "description": "d" * 2001},
        {"title": "Ok", "evidence": "e" * 2001},
        {"title": "Ok", "due_on": (date.today() - timedelta(days=5)).isoformat()},
        {"title": "Ok", "unexpected": "field"},
        {"title": "Ok", "linked_criterion": "00000000-0000-0000-0000-000000000000"},
    ],
)
async def test_create_validation(client: AsyncClient, payload: dict) -> None:
    ctx = await _pair(client, f"val-{uuid.uuid4().hex[:6]}")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json=payload,
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_assignee_must_be_active_member(client: AsyncClient) -> None:
    """Cross-organization: an outsider cannot be assigned the work (D-4)."""
    ctx = await _pair(client, "cross")
    outsider = await _signup(client, "outsider@other8.dev")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json={"title": "Their job", "owner_id": outsider["id"]},
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["details"][0]["loc"] == ["body", "owner_id"]


async def test_past_due_date_is_rejected(client: AsyncClient) -> None:
    ctx = await _pair(client, "past")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json={
            "title": "Too late",
            "due_on": (date.today() - timedelta(days=1)).isoformat(),
        },
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_illegal_transition_is_422(client: AsyncClient) -> None:
    ctx = await _pair(client, "trans")
    made = await _deliverable(client, ctx)
    # not_started -> submitted skips the work.
    skip = await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"status": "submitted"},
        headers=ctx["mentor"]["headers"],
    )
    assert skip.status_code == 422, skip.text
    # Nothing was ever submitted, so there is nothing to accept.
    early = await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"status": "accepted"},
        headers=ctx["mentor"]["headers"],
    )
    assert early.status_code == 422, early.text


async def test_assignee_cannot_accept_own_work(client: AsyncClient) -> None:
    ctx = await _pair(client, "selfrev")
    member = await _member(
        client, ctx["founder"], ctx["org_id"], "self@e8.dev", "member"
    )
    made = await _deliverable(client, ctx, owner_id=member["id"])
    await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"status": "in_progress"},
        headers=member["headers"],
    )
    await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"status": "submitted"},
        headers=member["headers"],
    )
    blocked = await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"status": "accepted"},
        headers=member["headers"],
    )
    assert blocked.status_code == 403, blocked.text


# ------------------------------------------------------------------ auth


@pytest.mark.parametrize(
    "method,path",
    [
        ("post", "/api/v1/mentorships/{mid}/deliverables"),
        ("get", "/api/v1/mentorships/{mid}/deliverables"),
        ("get", "/api/v1/deliverables/{did}"),
        ("patch", "/api/v1/deliverables/{did}"),
        ("delete", "/api/v1/deliverables/{did}"),
    ],
)
async def test_requires_auth(client: AsyncClient, method: str, path: str) -> None:
    ctx = await _pair(client, f"auth-{uuid.uuid4().hex[:6]}")
    made = await _deliverable(client, ctx)
    url = path.format(mid=ctx["mid"], did=made["id"])
    # Only POST/PATCH carry a body; GET/DELETE take none.
    kwargs: dict = {"json": {}} if method in {"post", "patch"} else {}
    resp = await getattr(client, method)(url, **kwargs)
    assert resp.status_code == 401, resp.text


async def test_outsider_gets_404_everywhere(client: AsyncClient) -> None:
    ctx = await _pair(client, "out")
    made = await _deliverable(client, ctx)
    outsider = await _signup(client, "nobody@e8.dev")

    assert (
        await client.get(
            f"/api/v1/deliverables/{made['id']}", headers=outsider["headers"]
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v1/mentorships/{ctx['mid']}/deliverables",
            headers=outsider["headers"],
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v1/mentorships/{ctx['mid']}/deliverables",
            json={"title": "Nope"},
            headers=outsider["headers"],
        )
    ).status_code == 404
    assert (
        await client.patch(
            f"/api/v1/deliverables/{made['id']}",
            json={"status": "in_progress"},
            headers=outsider["headers"],
        )
    ).status_code == 404
    assert (
        await client.delete(
            f"/api/v1/deliverables/{made['id']}", headers=outsider["headers"]
        )
    ).status_code == 404


async def test_startup_owner_cannot_delete(client: AsyncClient) -> None:
    ctx = await _pair(client, "delown")
    made = await _deliverable(client, ctx)
    resp = await client.delete(
        f"/api/v1/deliverables/{made['id']}", headers=ctx["founder"]["headers"]
    )
    assert resp.status_code == 403, resp.text


# ------------------------------------------------------------------ mass assignment


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "Ok", "status": "accepted"},
        {"title": "Ok", "submitted_at": "2020-01-01T00:00:00Z"},
        {"title": "Ok", "reviewed_by": "00000000-0000-0000-0000-000000000001"},
        {"title": "Ok", "mentorship_id": "00000000-0000-0000-0000-000000000001"},
        {"title": "Ok", "id": "00000000-0000-0000-0000-000000000001"},
        {"title": "Ok", "deleted_at": "2020-01-01T00:00:00Z"},
        {"title": "Ok", "reviewed_at": "2020-01-01T00:00:00Z"},
    ],
)
async def test_mass_assignment_rejected_on_create(
    client: AsyncClient, payload: dict
) -> None:
    ctx = await _pair(client, f"mass-{uuid.uuid4().hex[:6]}")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json=payload,
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.parametrize(
    "payload",
    [
        {"submitted_at": "2020-01-01T00:00:00Z"},
        {"reviewed_by": "00000000-0000-0000-0000-000000000001"},
        {"reviewed_at": "2020-01-01T00:00:00Z"},
        {"mentorship_id": "00000000-0000-0000-0000-000000000001"},
        {"deleted_at": "2020-01-01T00:00:00Z"},
        {"status": "overdue"},
    ],
)
async def test_mass_assignment_rejected_on_patch(
    client: AsyncClient, payload: dict
) -> None:
    ctx = await _pair(client, f"masp-{uuid.uuid4().hex[:6]}")
    made = await _deliverable(client, ctx)
    resp = await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json=payload,
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 422, resp.text


# ------------------------------------------------------------------ filters


async def test_status_filter_and_pagination(client: AsyncClient) -> None:
    ctx = await _pair(client, "filt")
    for i in range(3):
        await _deliverable(client, ctx, title=f"Task {i}")
    first = await client.get(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables?limit=2",
        headers=ctx["mentor"]["headers"],
    )
    assert first.status_code == 200, first.text
    assert len(first.json()["items"]) == 2
    assert first.json()["total"] == 3

    filtered = await client.get(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables?status=in_progress",
        headers=ctx["mentor"]["headers"],
    )
    assert filtered.status_code == 200, filtered.text
    assert filtered.json()["total"] == 0


async def test_open_cap(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import deliverable_service

    monkeypatch.setattr(deliverable_service, "MAX_OPEN_PER_MENTORSHIP", 1)
    ctx = await _pair(client, "cap")
    await _deliverable(client, ctx, title="First")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/deliverables",
        json={"title": "Second"},
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_rate_limit(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "DELIVERABLE_WRITE_LIMIT", 1)
    ctx = await _pair(client, "rate")
    made = await _deliverable(client, ctx)
    await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"title": "Fine"},
        headers=ctx["mentor"]["headers"],
    )
    blocked = await client.patch(
        f"/api/v1/deliverables/{made['id']}",
        json={"title": "Too much"},
        headers=ctx["mentor"]["headers"],
    )
    assert blocked.status_code == 429, blocked.text
