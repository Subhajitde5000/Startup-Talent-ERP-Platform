"""Step 8b tests: mentorship requests.

Covers, per AGENTS.md section 7 and the 8b plan:

- happy path: request -> accept -> end, and request -> decline, plus the
  pause/resume pair and the startup's own withdraw,
- validation: short goal, over-long goal, too many needs, a need that is
  too long, equity outside 0-100, a negative fee, an unknown currency,
  an unknown body key (``extra="forbid"``),
- 401 on every route without a token,
- 403: a viewer cannot request; a member of Startup B cannot act on
  Startup A's mentorship; a startup cannot accept its own request,
- 404: an outsider gets 404 (not 403) on read, edit and every
  transition, so the row's existence is not probeable,
- cross-organization: requests are scoped by the caller's memberships and
  the list never returns another tenant's rows,
- mass assignment: ``status``, ``mentor_id``, ``startup_org_id``,
  ``fit_score``, ``health``, ``started_on``/``ended_on`` and the session
  timestamps cannot be written through the create or update bodies,
- the "one active mentorship per pair" index: a second request is 409, but
  the pair may request again once the first is declined or cancelled.
"""

import re
import uuid

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
    verify = await client.post(
        "/api/v1/auth/verify-email", json={"email": email, "code": _code()}
    )
    assert verify.status_code == 200, verify.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    me = await client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    return {"email": email, "headers": headers, "id": me.json()["id"]}


async def _mentor(client: AsyncClient, email: str, *, accepting: bool = True, handle: str | None = None) -> dict:
    auth = await _signup(client, email, role="mentor")
    if handle:
        patched = await client.patch(
            "/api/v1/users/me",
            json={"handle": handle},
            headers=auth["headers"],
        )
        assert patched.status_code == 200, patched.text
    saved = await client.patch(
        "/api/v1/mentor-profile/me",
        json={"headline": "Advisor", "accepting_requests": accepting},
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


async def _request(client: AsyncClient, founder: dict, org_id: str, mentor_id: str, **body):
    payload = {"mentor_id": mentor_id, "goal": GOAL, **body}
    return await client.post(
        f"/api/v1/organizations/{org_id}/mentorships", json=payload, headers=founder["headers"]
    )


async def _flow(client: AsyncClient, *, accepting: bool = True):
    """A founder, a mentor and a live request between them."""
    founder = await _signup(client, "founder@b8.dev")
    mentor = await _mentor(client, "mentor@b8.dev", accepting=accepting)
    org_id = await _org(client, founder)
    created = await _request(client, founder, org_id, mentor["id"])
    assert created.status_code == 201, created.text
    return founder, mentor, org_id, created.json()


# ------------------------------------------------------------------ happy path


async def test_request_accept_end(client: AsyncClient) -> None:
    founder, mentor, _org_id, row = await _flow(client)
    assert row["status"] == "requested"
    assert row["viewer_side"] == "startup"
    assert row["viewer_role"] == "owner"
    assert row["mentor"]["user_id"] == mentor["id"]
    assert row["needs"] == []

    accepted = await client.post(
        f"/api/v1/mentorships/{row['id']}/accept", json={}, headers=mentor["headers"]
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "active"
    assert accepted.json()["started_on"] is not None
    assert accepted.json()["viewer_side"] == "mentor"

    ended = await client.post(
        f"/api/v1/mentorships/{row['id']}/end",
        json={"reason": "Goals met"},
        headers=founder["headers"],
    )
    assert ended.status_code == 200, ended.text
    assert ended.json()["status"] == "completed"
    assert ended.json()["ended_on"] is not None
    assert ended.json()["terms"] == "Goals met"


async def test_decline(client: AsyncClient) -> None:
    _founder, mentor, _org_id, row = await _flow(client)
    declined = await client.post(
        f"/api/v1/mentorships/{row['id']}/decline", json={}, headers=mentor["headers"]
    )
    assert declined.status_code == 200, declined.text
    assert declined.json()["status"] == "declined"


async def test_pause_and_resume(client: AsyncClient) -> None:
    _founder, mentor, _id, row = await _flow(client)
    await client.post(f"/api/v1/mentorships/{row['id']}/accept", json={}, headers=mentor["headers"])

    paused = await client.post(
        f"/api/v1/mentorships/{row['id']}/pause", json={"note": "Break"}, headers=mentor["headers"]
    )
    assert paused.status_code == 200, paused.text
    assert paused.json()["status"] == "paused"

    resumed = await client.post(
        f"/api/v1/mentorships/{row['id']}/resume", json={}, headers=mentor["headers"]
    )
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["status"] == "active"


async def test_startup_can_withdraw(client: AsyncClient) -> None:
    founder, _mentor_user, _id, row = await _flow(client)
    cancelled = await client.post(
        f"/api/v1/mentorships/{row['id']}/cancel",
        json={"note": "Chose a different advisor"},
        headers=founder["headers"],
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"


async def test_startup_edits_pending_request(client: AsyncClient) -> None:
    founder, _mentor_user, _id, row = await _flow(client)
    edited = await client.patch(
        f"/api/v1/mentorships/{row['id']}",
        json={"goal": "A sharper, narrower goal for this engagement", "needs": ["pricing"]},
        headers=founder["headers"],
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["needs"] == ["pricing"]
    assert edited.json()["goal"].startswith("A sharper")


# -------------------------------------------------------------- state machine


async def test_cannot_accept_twice(client: AsyncClient) -> None:
    _founder, mentor, _id, row = await _flow(client)
    first = await client.post(
        f"/api/v1/mentorships/{row['id']}/accept", json={}, headers=mentor["headers"]
    )
    assert first.status_code == 200
    again = await client.post(
        f"/api/v1/mentorships/{row['id']}/accept", json={}, headers=mentor["headers"]
    )
    assert again.status_code == 409, again.text
    assert again.json()["error"]["code"] == "INVALID_STATE"


async def test_cannot_end_a_pending_request(client: AsyncClient) -> None:
    founder, _mentor_user, _id, row = await _flow(client)
    resp = await client.post(
        f"/api/v1/mentorships/{row['id']}/end", json={}, headers=founder["headers"]
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "INVALID_STATE"


async def test_cannot_edit_after_accept(client: AsyncClient) -> None:
    founder, mentor, _id, row = await _flow(client)
    await client.post(f"/api/v1/mentorships/{row['id']}/accept", json={}, headers=mentor["headers"])
    resp = await client.patch(
        f"/api/v1/mentorships/{row['id']}",
        json={"goal": "Changed my mind about the goal here"},
        headers=founder["headers"],
    )
    assert resp.status_code == 409, resp.text


async def test_cannot_cancel_a_completed_mentorship(client: AsyncClient) -> None:
    founder, mentor, _id, row = await _flow(client)
    await client.post(f"/api/v1/mentorships/{row['id']}/accept", json={}, headers=mentor["headers"])
    await client.post(f"/api/v1/mentorships/{row['id']}/end", json={}, headers=founder["headers"])
    resp = await client.post(
        f"/api/v1/mentorships/{row['id']}/cancel", json={}, headers=founder["headers"]
    )
    assert resp.status_code == 409, resp.text


async def test_create_mentorship_by_handle(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-handle@b8.dev")
    mentor = await _mentor(client, "mentor-handle@b8.dev", handle="mentorhandle8b")
    org_id = await _org(client, founder)

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/mentorships",
        json={"mentor_handle": "mentorhandle8b", "goal": "Help us scale engineering and hiring."},
        headers=founder["headers"],
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "requested"
    assert body["mentor_id"] == mentor["id"]
    assert body["mentor"]["handle"] == "mentorhandle8b"


# ------------------------------------------------------------------ validation


@pytest.mark.parametrize(
    "body",
    [
        {"goal": "short"},  # < 10 chars
        {"goal": "x" * 501},  # > 500 chars
        {"goal": GOAL, "needs": [f"n{i}" for i in range(11)]},  # > 10 needs
        {"goal": GOAL, "needs": ["y" * 51]},  # item too long
        {"goal": GOAL, "equity_pct": 101},  # outside 0-100
        {"goal": GOAL, "fee_amount": -1},  # negative money
        {"goal": GOAL, "currency": "rupee"},  # not ISO-4217 shaped
        {"goal": GOAL, "cadence": "w" * 33},  # > 32 chars
    ],
)
async def test_create_validation(client: AsyncClient, body: dict) -> None:
    founder = await _signup(client, "founder-v@b8.dev")
    mentor = await _mentor(client, "mentor-v@b8.dev")
    org_id = await _org(client, founder)
    resp = await _request(client, founder, org_id, mentor["id"], **body)
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_unknown_body_key_is_rejected(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-x@b8.dev")
    mentor = await _mentor(client, "mentor-x@b8.dev")
    org_id = await _org(client, founder)
    resp = await _request(client, founder, org_id, mentor["id"], status="active")
    assert resp.status_code == 422, resp.text


async def test_request_to_a_non_mentor_is_422_on_the_field(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-nm@b8.dev")
    other = await _signup(client, "investor-nm@b8.dev", role="investor")
    org_id = await _org(client, founder)
    resp = await _request(client, founder, org_id, other["id"])
    assert resp.status_code == 422, resp.text
    detail = resp.json()["error"]["details"]
    assert any(d.get("loc") == ["body", "mentor_id"] for d in detail)


async def test_mentor_not_accepting_is_409(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-na@b8.dev")
    mentor = await _mentor(client, "mentor-na@b8.dev", accepting=False)
    org_id = await _org(client, founder)
    resp = await _request(client, founder, org_id, mentor["id"])
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "MENTOR_NOT_ACCEPTING"


async def test_needs_are_trimmed_and_deduplicated(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-nd@b8.dev")
    mentor = await _mentor(client, "mentor-nd@b8.dev")
    org_id = await _org(client, founder)
    resp = await _request(
        client, founder, org_id, mentor["id"], needs=["  pricing ", "Pricing", "", "gtm"]
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["needs"] == ["pricing", "gtm"]


# --------------------------------------------------------------------- authz


@pytest.mark.parametrize(
    "method,path,needs_id",
    [
        ("GET", "/api/v1/mentorships", False),
        ("GET", "/api/v1/mentor/startups", False),
        ("GET", "/api/v1/mentorships/{id}", True),
        ("PATCH", "/api/v1/mentorships/{id}", True),
        ("POST", "/api/v1/mentorships/{id}/accept", True),
        ("POST", "/api/v1/mentorships/{id}/decline", True),
        ("POST", "/api/v1/mentorships/{id}/cancel", True),
        ("POST", "/api/v1/mentorships/{id}/end", True),
        ("POST", "/api/v1/mentorships/{id}/pause", True),
        ("POST", "/api/v1/mentorships/{id}/resume", True),
    ],
)
async def test_401_without_a_token(
    client: AsyncClient, method: str, path: str, needs_id: bool
) -> None:
    url = path.format(id=uuid.uuid4())
    resp = await client.request(method, url, json={})
    assert resp.status_code == 401, resp.text


async def test_401_on_create(client: AsyncClient) -> None:
    resp = await client.post(
        f"/api/v1/organizations/{uuid.uuid4()}/mentorships",
        json={"mentor_id": str(uuid.uuid4()), "goal": GOAL},
    )
    assert resp.status_code == 401, resp.text


async def test_outsider_gets_404_not_403(client: AsyncClient) -> None:
    _founder, mentor, _id, row = await _flow(client)
    outsider = await _signup(client, "outsider@b8.dev", role="investor")

    # Note: each call sends a body the endpoint ACCEPTS, so a 422 cannot
    # mask the authorization result. Validation runs before authorization,
    # which is fine (it reveals nothing about whether the row exists) but
    # would make this test prove the wrong thing.
    calls = [
        ("GET", "", None),
        ("PATCH", "", {"goal": "Attempting an edit from outside"}),
        ("POST", "/accept", {}),
        ("POST", "/decline", {}),
        ("POST", "/cancel", {}),
        ("POST", "/end", {}),
        ("POST", "/pause", {}),
        ("POST", "/resume", {}),
    ]
    for method, suffix, body in calls:
        resp = await client.request(
            method,
            f"/api/v1/mentorships/{row['id']}{suffix}",
            json=body,
            headers=outsider["headers"],
        )
        assert resp.status_code == 404, f"{method} {suffix}: {resp.status_code} {resp.text}"

    # The mentor is a participant, so the same call is allowed for them.
    ok = await client.get(f"/api/v1/mentorships/{row['id']}", headers=mentor["headers"])
    assert ok.status_code == 200


async def test_startup_cannot_accept_or_decline(client: AsyncClient) -> None:
    founder, _mentor_user, _id, row = await _flow(client)
    for suffix in ("accept", "decline"):
        resp = await client.post(
            f"/api/v1/mentorships/{row['id']}/{suffix}", json={}, headers=founder["headers"]
        )
        assert resp.status_code == 403, f"{suffix}: {resp.status_code} {resp.text}"


async def test_mentor_cannot_edit_the_startups_request(client: AsyncClient) -> None:
    _founder, mentor, _id, row = await _flow(client)
    resp = await client.patch(
        f"/api/v1/mentorships/{row['id']}",
        json={"goal": "The mentor wants to rewrite the ask"},
        headers=mentor["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_viewer_cannot_request_and_cannot_transition(client: AsyncClient) -> None:
    owner = await _signup(client, "owner-v@b8.dev")
    mentor = await _mentor(client, "mentor-vw@b8.dev")
    org_id = await _org(client, owner)

    viewer = await _signup(client, "viewer-v@b8.dev", role="investor")
    invite = await client.post(
        f"/api/v1/organizations/{org_id}/invites",
        json={"email": viewer["email"], "role": "viewer"},
        headers=owner["headers"],
    )
    assert invite.status_code in (200, 201), invite.text
    token = invite.json().get("token") or invite.json().get("invite_token")
    accepted = await client.post(
        f"/api/v1/invites/{token}/accept", json={}, headers=viewer["headers"]
    )
    assert accepted.status_code in (200, 204), accepted.text

    resp = await _request(client, viewer, org_id, mentor["id"])
    assert resp.status_code == 403, resp.text

    created = await _request(client, owner, org_id, mentor["id"])
    assert created.status_code == 201, created.text
    mid = created.json()["id"]

    # A viewer may still READ the org's mentorships.
    read = await client.get(f"/api/v1/mentorships/{mid}", headers=viewer["headers"])
    assert read.status_code == 200, read.text
    assert read.json()["viewer_role"] == "viewer"

    # ...but not move one.
    for suffix in ("cancel", "end", "pause", "resume"):
        blocked = await client.post(
            f"/api/v1/mentorships/{mid}/{suffix}", json={}, headers=viewer["headers"]
        )
        assert blocked.status_code == 403, f"{suffix}: {blocked.status_code} {blocked.text}"


async def test_cross_organization_request_is_forbidden(client: AsyncClient) -> None:
    """A member of Startup B cannot create a request against Startup A."""
    owner_a = await _signup(client, "owner-a@b8.dev")
    owner_b = await _signup(client, "owner-b@b8.dev")
    mentor = await _mentor(client, "mentor-co@b8.dev")
    org_a = await _org(client, owner_a, "Alpha")
    await _org(client, owner_b, "Beta")

    # B's user tries to post into A's org id.
    resp = await _request(client, owner_b, org_a, mentor["id"])
    assert resp.status_code == 403, resp.text


async def test_list_never_returns_another_tenants_rows(client: AsyncClient) -> None:
    founder, mentor, _id, row = await _flow(client)
    other = await _signup(client, "other-tenant@b8.dev")
    await _org(client, other, "Other Co")

    listed = await client.get("/api/v1/mentorships?side=startup", headers=other["headers"])
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] == 0
    assert all(i["id"] != row["id"] for i in listed.json()["items"])

    # And the mentor side is keyed on the caller being the mentor.
    as_other = await client.get("/api/v1/mentorships?side=mentor", headers=other["headers"])
    assert as_other.json()["total"] == 0

    as_mentor = await client.get("/api/v1/mentorships?side=mentor", headers=mentor["headers"])
    assert as_mentor.json()["total"] == 1


# ------------------------------------------------------------ mass assignment


async def test_mass_assignment_on_create_is_ignored(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-ma@b8.dev")
    mentor = await _mentor(client, "mentor-ma@b8.dev")
    org_id = await _org(client, founder)

    # extra="forbid" turns every server-controlled key into a 422, which is
    # the stronger guarantee: none of them can even be expressed.
    for field, value in [
        ("status", "active"),
        ("fit_score", 99),
        ("health", "on_track"),
        ("started_on", "2026-01-01"),
        ("ended_on", "2026-02-01"),
        ("next_session_at", "2026-01-01T10:00:00Z"),
        ("deleted_at", "2026-01-01T10:00:00Z"),
    ]:
        resp = await _request(client, founder, org_id, mentor["id"], **{field: value})
        assert resp.status_code == 422, f"{field} was accepted: {resp.text}"

    # The legitimate request still lands in the server-chosen state.
    ok = await _request(client, founder, org_id, mentor["id"])
    assert ok.status_code == 201, ok.text
    assert ok.json()["status"] == "requested"
    assert ok.json()["started_on"] is None
    assert ok.json()["ended_on"] is None
    assert ok.json()["health"] is None
    assert ok.json()["next_session_at"] is None


async def test_mass_assignment_on_update_is_ignored(client: AsyncClient) -> None:
    founder, mentor, _id, row = await _flow(client)
    for field, value in [
        ("status", "active"),
        ("mentor_id", str(uuid.uuid4())),
        ("startup_org_id", str(uuid.uuid4())),
        ("fit_score", 88),
        ("health", "stalled"),
    ]:
        resp = await client.patch(
            f"/api/v1/mentorships/{row['id']}",
            json={field: value},
            headers=founder["headers"],
        )
        assert resp.status_code == 422, f"{field} was accepted: {resp.text}"

    after = await client.get(f"/api/v1/mentorships/{row['id']}", headers=founder["headers"])
    assert after.json()["status"] == "requested"
    assert after.json()["mentor_id"] == mentor["id"]


# --------------------------------------------------- one active pair per mentor


async def test_second_request_is_409_while_the_first_is_open(client: AsyncClient) -> None:
    founder, _mentor_user, org_id, _row = await _flow(client)
    mentor = await _signup(client, "mentor-dup@b8.dev", role="mentor")
    await client.patch(
        "/api/v1/mentor-profile/me", json={"accepting_requests": True}, headers=mentor["headers"]
    )
    first = await _request(client, founder, org_id, mentor["id"])
    assert first.status_code == 201, first.text
    second = await _request(client, founder, org_id, mentor["id"])
    assert second.status_code == 409, second.text
    assert second.json()["error"]["code"] == "MENTORSHIP_EXISTS"


async def test_pair_may_request_again_after_a_decline(client: AsyncClient) -> None:
    founder, mentor, org_id, row = await _flow(client)
    await client.post(f"/api/v1/mentorships/{row['id']}/decline", json={}, headers=mentor["headers"])

    again = await _request(client, founder, org_id, mentor["id"])
    assert again.status_code == 201, again.text
    assert again.json()["id"] != row["id"]


# ------------------------------------------------------------------- paging


async def test_paging_and_status_filter(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-pg@b8.dev")
    org_id = await _org(client, founder)
    # (mentor, mentorship id) pairs so the decline targets the right mentor.
    created_pairs = []
    for i in range(3):
        m = await _mentor(client, f"mentor-pg{i}@b8.dev")
        created = await _request(client, founder, org_id, m["id"])
        assert created.status_code == 201, created.text
        created_pairs.append((m, created.json()["id"]))

    page = await client.get("/api/v1/mentorships?side=startup&limit=2", headers=founder["headers"])
    assert page.status_code == 200, page.text
    assert page.json()["total"] == 3
    assert len(page.json()["items"]) == 2

    # Decline one and filter for it.
    target_mentor, target_id = created_pairs[0]
    declined_resp = await client.post(
        f"/api/v1/mentorships/{target_id}/decline",
        json={},
        headers=target_mentor["headers"],
    )
    assert declined_resp.status_code == 200, declined_resp.text
    declined = await client.get(
        "/api/v1/mentorships?side=startup&status=declined", headers=founder["headers"]
    )
    assert declined.status_code == 200, declined.text
    assert declined.json()["total"] >= 1


async def test_bad_status_filter_is_422(client: AsyncClient) -> None:
    founder = await _signup(client, "founder-bs@b8.dev")
    resp = await client.get(
        "/api/v1/mentorships?side=startup&status=banana", headers=founder["headers"]
    )
    assert resp.status_code == 422, resp.text
