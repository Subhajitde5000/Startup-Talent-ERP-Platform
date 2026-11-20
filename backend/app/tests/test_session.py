"""Step 8d tests: mentoring sessions.

Covers, per AGENTS.md section 7 and the 8d plan:

- happy path: schedule -> confirm -> complete, plus reschedule, cancel and
  no-show, and the derived ``next_session_at`` on the mentorship,
- validation: a naive datetime, a past time, beyond the booking horizon,
  a duration outside 5-480, a non-https meeting link, a too-short summary,
  too many action items, and an unknown body key,
- 401 on every route without a token,
- 403: a startup member cannot complete or mark a no-show (mentor-only),
  and a viewer cannot schedule or transition anything,
- 404: an outsider gets 404 on read and every transition; an attendee from
  another startup cannot be added,
- cross-organization: sessions are listed only inside mentorships the
  caller participates in,
- mass assignment: ``status``, ``completed_at``, ``cancelled_reason``,
  ``mentorship_id`` and the timestamps cannot be written by a client,
- double booking: the same instant twice on one mentorship is 409, and one
  mentor cannot be booked at the same instant across two startups,
- a session is only schedulable on an active or paused mentorship.
"""

import re
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

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


async def _pair(client: AsyncClient, tag: str = "d8") -> dict:
    """A founder, a mentor, an org and an ACTIVE mentorship between them."""
    founder = await _signup(client, f"founder-{tag}@d8.dev")
    mentor = await _mentor(client, f"mentor-{tag}@d8.dev")
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


def _at(days: int = 5, hour: int = 15, minute: int = 0) -> str:
    """An aware UTC instant N days out, rounded to the minute."""
    when = (datetime.now(UTC) + timedelta(days=days)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
    return when.isoformat()


# ------------------------------------------------------------------ happy path


async def test_schedule_confirm_complete(client: AsyncClient) -> None:
    ctx = await _pair(client, "happy")
    when = _at()

    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": when, "duration_min": 45, "topic": "Pricing"},
        headers=ctx["mentor"]["headers"],
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "scheduled"
    assert body["viewer_side"] == "mentor"
    assert body["topic"] == "Pricing"
    # The mentor is attached automatically with the right role.
    assert [a["role"] for a in body["attendees"]] == ["mentor"]
    assert body["attendees"][0]["user_id"] == ctx["mentor"]["id"]
    sid = body["id"]

    confirmed = await client.post(
        f"/api/v1/sessions/{sid}/confirm", headers=ctx["founder"]["headers"]
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"

    done = await client.post(
        f"/api/v1/sessions/{sid}/complete",
        json={"summary": "We covered pricing tiers and the next experiment.", "action_items": ["Draft tier page", "Test with 5 users"]},
        headers=ctx["mentor"]["headers"],
    )
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "completed"
    assert done.json()["completed_at"] is not None
    assert len(done.json()["action_items"]) == 2

    # The mentorship's derived stamp follows the completed session.
    m = await client.get(f"/api/v1/mentorships/{ctx['mid']}", headers=ctx["founder"]["headers"])
    assert m.json()["last_session_at"] is not None


async def test_reschedule_moves_the_row(client: AsyncClient) -> None:
    ctx = await _pair(client, "resch")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["founder"]["headers"],
    )
    sid = created.json()["id"]
    moved = await client.post(
        f"/api/v1/sessions/{sid}/reschedule",
        json={"scheduled_at": _at(7), "duration_min": 60, "reason": "Mentor away"},
        headers=ctx["mentor"]["headers"],
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["duration_min"] == 60
    assert moved.json()["id"] == sid
    # A reschedule returns the session to "scheduled" — the other side has
    # not confirmed the new time.
    assert moved.json()["status"] == "scheduled"


async def test_cancel_records_the_reason(client: AsyncClient) -> None:
    ctx = await _pair(client, "canc")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["founder"]["headers"],
    )
    sid = created.json()["id"]
    cancelled = await client.post(
        f"/api/v1/sessions/{sid}/cancel",
        json={"reason": "Scheduling clash"},
        headers=ctx["founder"]["headers"],
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["cancelled_reason"] == "Scheduling clash"


async def test_no_show_requires_a_started_session(client: AsyncClient) -> None:
    ctx = await _pair(client, "noshow")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    sid = created.json()["id"]
    early = await client.post(
        f"/api/v1/sessions/{sid}/no-show", json={}, headers=ctx["mentor"]["headers"]
    )
    assert early.status_code == 409, early.text
    assert early.json()["error"]["code"] == "INVALID_STATE"


async def test_next_session_at_is_derived(client: AsyncClient) -> None:
    ctx = await _pair(client, "stamp")
    await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(6)},
        headers=ctx["founder"]["headers"],
    )
    m = await client.get(f"/api/v1/mentorships/{ctx['mid']}", headers=ctx["founder"]["headers"])
    assert m.json()["next_session_at"] is not None


# ------------------------------------------------------------------ validation


@pytest.mark.parametrize(
    "body",
    [
        {"scheduled_at": "2030-01-01T10:00:00"},  # naive, no zone
        {"scheduled_at": _at(-2)},  # in the past
        {"scheduled_at": _at(5), "duration_min": 4},
        {"scheduled_at": _at(5), "duration_min": 481},
        {"scheduled_at": _at(5), "meeting_url": "http://insecure.example.com/x"},
        {"scheduled_at": _at(5), "meeting_url": "javascript:alert(1)"},
        {"scheduled_at": _at(5), "topic": "t" * 201},
        {"scheduled_at": _at(5), "currency": "rupees"},
        {"scheduled_at": _at(5), "status": "completed"},  # server-controlled
        {"scheduled_at": _at(5), "completed_at": "2030-01-01T10:00:00Z"},
        {"scheduled_at": _at(5), "cancelled_reason": "sneaky"},
    ],
)
async def test_create_validation(client: AsyncClient, body: dict) -> None:
    ctx = await _pair(client, "val")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json=body,
        headers=ctx["founder"]["headers"],
    )
    assert resp.status_code == 422, f"{body}: {resp.status_code} {resp.text}"


async def test_beyond_the_horizon_is_422(client: AsyncClient) -> None:
    ctx = await _pair(client, "hzn")
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(400)},
        headers=ctx["founder"]["headers"],
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.parametrize(
    "body",
    [
        {"summary": "short"},
        {"summary": "A perfectly reasonable summary of the session.", "action_items": ["x"] * 21},
        {"summary": "A perfectly reasonable summary of the session.", "action_items": ["y" * 201]},
        {"summary": "A perfectly reasonable summary of the session.", "status": "completed"},
    ],
)
async def test_complete_validation(client: AsyncClient, body: dict) -> None:
    ctx = await _pair(client, "cval")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    sid = created.json()["id"]
    resp = await client.post(
        f"/api/v1/sessions/{sid}/complete", json=body, headers=ctx["mentor"]["headers"]
    )
    assert resp.status_code == 422, f"{body}: {resp.text}"


async def test_cancel_requires_a_reason(client: AsyncClient) -> None:
    ctx = await _pair(client, "creas")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    resp = await client.post(
        f"/api/v1/sessions/{created.json()['id']}/cancel",
        json={"reason": "x"},
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 422, resp.text


# ------------------------------------------------------------------ state rules


async def test_cannot_schedule_on_a_pending_mentorship(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-pend@d8.dev")
    mentor = await _mentor(client, "mentor-pend@d8.dev")
    org_id = await _org(client, founder, "Pending Co")
    created = await client.post(
        f"/api/v1/organizations/{org_id}/mentorships",
        json={"mentor_id": mentor["id"], "goal": GOAL},
        headers=founder["headers"],
    )
    mid = created.json()["id"]  # still "requested"
    resp = await client.post(
        f"/api/v1/mentorships/{mid}/sessions",
        json={"scheduled_at": _at(5)},
        headers=founder["headers"],
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "INVALID_STATE"


async def test_cannot_complete_a_cancelled_session(client: AsyncClient) -> None:
    ctx = await _pair(client, "cstate")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    sid = created.json()["id"]
    await client.post(
        f"/api/v1/sessions/{sid}/cancel", json={"reason": "Gone"}, headers=ctx["mentor"]["headers"]
    )
    resp = await client.post(
        f"/api/v1/sessions/{sid}/complete",
        json={"summary": "Trying to complete a cancelled session."},
        headers=ctx["mentor"]["headers"],
    )
    assert resp.status_code == 409, resp.text


# ------------------------------------------------------------------ double book


async def test_same_instant_twice_on_one_mentorship_is_409(client: AsyncClient) -> None:
    ctx = await _pair(client, "dbl")
    when = _at(5)
    first = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": when},
        headers=ctx["founder"]["headers"],
    )
    assert first.status_code == 201, first.text
    second = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": when},
        headers=ctx["mentor"]["headers"],
    )
    assert second.status_code == 409, second.text
    assert second.json()["error"]["code"] == "SLOT_TAKEN"


async def test_one_mentor_cannot_be_in_two_places_at_once(client: AsyncClient) -> None:
    """Cross-mentorship: same mentor, two startups, overlapping windows."""
    mentor = await _mentor(client, "mentor-x2@d8.dev")

    rooms = []
    for tag in ("alpha", "beta"):
        founder = await _signup(client, f"founder-{tag}@d8.dev")
        org_id = await _org(client, founder, f"{tag.title()} Co")
        created = await client.post(
            f"/api/v1/organizations/{org_id}/mentorships",
            json={"mentor_id": mentor["id"], "goal": GOAL},
            headers=founder["headers"],
        )
        mid = created.json()["id"]
        await client.post(
            f"/api/v1/mentorships/{mid}/accept", json={}, headers=mentor["headers"]
        )
        rooms.append({"founder": founder, "mid": mid})

    when = _at(8)
    first = await client.post(
        f"/api/v1/mentorships/{rooms[0]['mid']}/sessions",
        json={"scheduled_at": when, "duration_min": 60},
        headers=mentor["headers"],
    )
    assert first.status_code == 201, first.text

    # A window that OVERLAPS but is not identical: 30 minutes later.
    overlap = (
        datetime.fromisoformat(when) + timedelta(minutes=30)
    ).isoformat()
    second = await client.post(
        f"/api/v1/mentorships/{rooms[1]['mid']}/sessions",
        json={"scheduled_at": overlap, "duration_min": 60},
        headers=mentor["headers"],
    )
    assert second.status_code == 409, second.text
    assert second.json()["error"]["code"] == "SLOT_TAKEN"

    # A window that does NOT overlap is fine.
    later = (datetime.fromisoformat(when) + timedelta(hours=3)).isoformat()
    third = await client.post(
        f"/api/v1/mentorships/{rooms[1]['mid']}/sessions",
        json={"scheduled_at": later, "duration_min": 60},
        headers=mentor["headers"],
    )
    assert third.status_code == 201, third.text


async def test_reschedule_into_a_taken_slot_is_409(client: AsyncClient) -> None:
    ctx = await _pair(client, "rmove")
    a = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    b = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(6)},
        headers=ctx["mentor"]["headers"],
    )
    assert a.status_code == 201 and b.status_code == 201
    clash = await client.post(
        f"/api/v1/sessions/{b.json()['id']}/reschedule",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    assert clash.status_code == 409, clash.text


# ---------------------------------------------------------------------- authz


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/v1/sessions"),
        ("GET", "/api/v1/sessions/00000000-0000-0000-0000-000000000000"),
        ("POST", "/api/v1/sessions/00000000-0000-0000-0000-000000000000/confirm"),
        ("POST", "/api/v1/sessions/00000000-0000-0000-0000-000000000000/cancel"),
        ("POST", "/api/v1/sessions/00000000-0000-0000-0000-000000000000/reschedule"),
        ("POST", "/api/v1/sessions/00000000-0000-0000-0000-000000000000/complete"),
        ("POST", "/api/v1/sessions/00000000-0000-0000-0000-000000000000/no-show"),
        ("GET", "/api/v1/mentorships/00000000-0000-0000-0000-000000000000/sessions"),
    ],
)
async def test_401_without_a_token(client: AsyncClient, method: str, path: str) -> None:
    resp = await client.request(method, path, json={})
    assert resp.status_code == 401, resp.text


async def test_outsider_gets_404_everywhere(client: AsyncClient) -> None:
    ctx = await _pair(client, "out")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    sid = created.json()["id"]
    outsider = await _signup(client, "outsider-d8@d8.dev", role="investor")

    calls = [
        ("GET", f"/api/v1/sessions/{sid}", None),
        ("GET", f"/api/v1/mentorships/{ctx['mid']}/sessions", None),
        ("POST", f"/api/v1/sessions/{sid}/confirm", {}),
        ("POST", f"/api/v1/sessions/{sid}/reschedule", {"scheduled_at": _at(9)}),
        ("POST", f"/api/v1/sessions/{sid}/cancel", {"reason": "nope"}),
        ("POST", f"/api/v1/sessions/{sid}/complete", {"summary": "Not allowed at all."}),
        ("POST", f"/api/v1/sessions/{sid}/no-show", {}),
    ]
    for method, path, body in calls:
        resp = await client.request(method, path, json=body, headers=outsider["headers"])
        assert resp.status_code == 404, f"{method} {path}: {resp.status_code} {resp.text}"

    listed = await client.get("/api/v1/sessions", headers=outsider["headers"])
    assert listed.status_code == 200
    assert listed.json()["total"] == 0


async def test_startup_cannot_complete_or_mark_no_show(client: AsyncClient) -> None:
    ctx = await _pair(client, "scomp")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["founder"]["headers"],
    )
    sid = created.json()["id"]
    for suffix, body in (
        ("complete", {"summary": "The founder should not be able to do this."}),
        ("no-show", {}),
    ):
        resp = await client.post(
            f"/api/v1/sessions/{sid}/{suffix}", json=body, headers=ctx["founder"]["headers"]
        )
        assert resp.status_code == 403, f"{suffix}: {resp.status_code} {resp.text}"


async def test_viewer_can_read_but_not_change(client: AsyncClient) -> None:
    ctx = await _pair(client, "view")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    sid = created.json()["id"]

    viewer = await _signup(client, "viewer-d8@d8.dev", role="investor")
    invite = await client.post(
        f"/api/v1/organizations/{ctx['org_id']}/invites",
        json={"email": viewer["email"], "role": "viewer"},
        headers=ctx["founder"]["headers"],
    )
    token = invite.json().get("token") or invite.json().get("invite_token")
    await client.post(f"/api/v1/invites/{token}/accept", json={}, headers=viewer["headers"])

    read = await client.get(f"/api/v1/sessions/{sid}", headers=viewer["headers"])
    assert read.status_code == 200, read.text
    assert read.json()["viewer_side"] == "startup"

    for suffix, body in (
        ("confirm", {}),
        ("reschedule", {"scheduled_at": _at(9)}),
        ("cancel", {"reason": "A viewer trying to cancel"}),
    ):
        blocked = await client.post(
            f"/api/v1/sessions/{sid}/{suffix}", json=body, headers=viewer["headers"]
        )
        assert blocked.status_code == 403, f"{suffix}: {blocked.status_code} {blocked.text}"

    # ...and cannot schedule a new one either.
    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(11)},
        headers=viewer["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_attendee_from_another_org_is_rejected(client: AsyncClient) -> None:
    ctx = await _pair(client, "att")
    stranger = await _signup(client, "stranger-d8@d8.dev")
    await _org(client, stranger, "Other Co")

    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5), "attendees": [{"user_id": stranger["id"]}]},
        headers=ctx["founder"]["headers"],
    )
    assert resp.status_code == 422, resp.text
    detail = resp.json()["error"]["details"]
    assert any(d.get("loc") == ["body", "attendees"] for d in detail)


async def test_a_valid_colleague_can_be_added_as_an_attendee(client: AsyncClient) -> None:
    ctx = await _pair(client, "att2")
    colleague = await _signup(client, "colleague-d8@d8.dev", role="investor")
    invite = await client.post(
        f"/api/v1/organizations/{ctx['org_id']}/invites",
        json={"email": colleague["email"], "role": "member"},
        headers=ctx["founder"]["headers"],
    )
    token = invite.json().get("token") or invite.json().get("invite_token")
    await client.post(f"/api/v1/invites/{token}/accept", json={}, headers=colleague["headers"])

    resp = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5), "attendees": [{"user_id": colleague["id"]}]},
        headers=ctx["founder"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    roles = {a["user_id"]: a["role"] for a in resp.json()["attendees"]}
    assert roles[ctx["mentor"]["id"]] == "mentor"
    assert roles[colleague["id"]] == "startup"


# ------------------------------------------------------------ mass assignment


async def test_mass_assignment_cannot_set_server_fields(client: AsyncClient) -> None:
    ctx = await _pair(client, "ma")
    created = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": _at(5)},
        headers=ctx["mentor"]["headers"],
    )
    sid = created.json()["id"]

    # extra="forbid": server-owned keys cannot even be expressed.
    for body in (
        {"scheduled_at": _at(6), "mentorship_id": str(uuid.uuid4())},
        {"scheduled_at": _at(6), "status": "completed"},
        {"scheduled_at": _at(6), "completed_at": "2030-01-01T10:00:00Z"},
        {"scheduled_at": _at(6), "cancelled_reason": "sneaky"},
        {"scheduled_at": _at(6), "created_at": "2030-01-01T10:00:00Z"},
    ):
        resp = await client.post(
            f"/api/v1/sessions/{sid}/reschedule", json=body, headers=ctx["mentor"]["headers"]
        )
        assert resp.status_code == 422, f"{body}: {resp.text}"

    after = await client.get(f"/api/v1/sessions/{sid}", headers=ctx["mentor"]["headers"])
    assert after.json()["status"] == "scheduled"
    assert after.json()["completed_at"] is None
    assert after.json()["mentorship_id"] == ctx["mid"]


# -------------------------------------------------------------------- listing


async def test_list_and_paging(client: AsyncClient) -> None:
    ctx = await _pair(client, "list")
    for day in (5, 6, 7):
        r = await client.post(
            f"/api/v1/mentorships/{ctx['mid']}/sessions",
            json={"scheduled_at": _at(day)},
            headers=ctx["founder"]["headers"],
        )
        assert r.status_code == 201, r.text

    mine = await client.get("/api/v1/sessions?limit=2", headers=ctx["founder"]["headers"])
    assert mine.status_code == 200, mine.text
    assert mine.json()["total"] == 3
    assert len(mine.json()["items"]) == 2

    upcoming = await client.get("/api/v1/sessions?upcoming=true", headers=ctx["mentor"]["headers"])
    assert upcoming.status_code == 200
    assert upcoming.json()["total"] == 3

    per_mentorship = await client.get(
        f"/api/v1/mentorships/{ctx['mid']}/sessions", headers=ctx["mentor"]["headers"]
    )
    assert per_mentorship.json()["total"] == 3


async def test_a_cancelled_session_frees_its_slot(client: AsyncClient) -> None:
    ctx = await _pair(client, "free")
    when = _at(5)
    first = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": when},
        headers=ctx["mentor"]["headers"],
    )
    await client.post(
        f"/api/v1/sessions/{first.json()['id']}/cancel",
        json={"reason": "Freed up"},
        headers=ctx["mentor"]["headers"],
    )
    again = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/sessions",
        json={"scheduled_at": when},
        headers=ctx["mentor"]["headers"],
    )
    assert again.status_code == 201, again.text
