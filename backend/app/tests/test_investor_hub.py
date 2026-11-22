"""Tests for Step 9m: startup investor hub (read-only aggregates).

Covers: happy paths for the four read endpoints (summary / rounds /
activity / activity stats), round-progress aggregation, pagination and
filter validation (422), 401, 403 (non-member), 404 (wrong org type,
deleted org), org-scoping of every aggregate (no cross-org leakage),
and the invariant that the hub exposes no write surface (POST/PATCH →
405).
"""

import re
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from httpx import AsyncClient

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization

PASSWORD = "Str0ng!Password99"


def _extract_code(email: str) -> str:
    from app.services import email_service

    for email_row in reversed(email_service.SENT_EMAILS):
        if email_row.get("to") != email:
            continue
        if "verification code" not in email_row.get("subject", ""):
            continue
        match = re.search(r"(\d{6})", email_row.get("body", ""))
        assert match, f"no 6-digit code in email body: {email_row.get('body')!r}"
        return match.group(1)
    raise AssertionError(f"expected a verification email for {email}")


async def _signup_verified(client: AsyncClient, email: str, role: str = "startup") -> dict:
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
    code = _extract_code(email)
    verify = await client.post("/api/v1/auth/verify-email", json={"email": email, "code": code})
    assert verify.status_code == 200, verify.text
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200, login.text
    return {
        "email": email,
        "headers": {"Authorization": f"Bearer {login.json()['access_token']}"},
    }


async def _create_org(client: AsyncClient, auth: dict, *, name: str, type_: str) -> dict:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": type_},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _invite_member(
    client: AsyncClient, owner: dict, invitee: dict, org: dict, role: str = "member"
) -> None:
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": invitee["email"], "role": role},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["token"]
    accept = await client.post(f"/api/v1/invites/{token}/accept", headers=invitee["headers"])
    assert accept.status_code == 200, accept.text


async def _make_investor_firm(client: AsyncClient, suffix: str = "") -> dict:
    owner = await _signup_verified(client, f"hub-invowner{suffix}@test.dev", role="investor")
    member = await _signup_verified(client, f"hub-invmember{suffix}@test.dev", role="investor")
    viewer = await _signup_verified(client, f"hub-invviewer{suffix}@test.dev", role="investor")
    org = await _create_org(client, owner, name=f"Zenith{suffix or ''}", type_="investor_firm")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"owner": owner, "member": member, "viewer": viewer, "org": org}


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    founder = await _signup_verified(client, f"hub-founder{suffix}@test.dev", role="startup")
    org = await _create_org(client, founder, name=f"Acme{suffix or ''}", type_="startup")
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={"profile_visibility": "public"},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    return {"founder": founder, "org": org}


async def _create_round(client: AsyncClient, startup: dict, *, name: str) -> dict:
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/funding-rounds",
        json={
            "name": name,
            "round_type": "seed",
            "target_amount": "1000000.00",
            "currency": "INR",
            "closes_on": (datetime.now(UTC).date() + timedelta(days=60)).isoformat(),
        },
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    round_row = resp.json()
    # Rounds start as draft; open them through the lifecycle endpoint.
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/funding-rounds/{round_row['id']}/status",
        json={"status": "open"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _create_deal(client: AsyncClient, firm: dict, startup: dict, *, round_id=None) -> dict:
    payload = {"startup_org_id": startup["org"]["id"]}
    if round_id is not None:
        payload["round_id"] = round_id
    resp = await client.post(
        "/api/v1/investors/deals",
        json=payload,
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_request(client: AsyncClient, firm: dict, startup: dict) -> dict:
    resp = await client.post(
        "/api/v1/investors/requests",
        json={
            "startup_org_id": startup["org"]["id"],
            "kind": "intro",
            "ask": "Open to a conversation?",
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_request_with_kind(
    client: AsyncClient, firm: dict, startup: dict, *, kind: str = "intro"
) -> dict:
    resp = await client.post(
        "/api/v1/investors/requests",
        json={
            "startup_org_id": startup["org"]["id"],
            "kind": kind,
            "ask": f"Open to a {kind}?",
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_meeting(client: AsyncClient, firm: dict, startup: dict) -> dict:
    resp = await client.post(
        "/api/v1/investors/meetings",
        json={
            "startup_org_id": startup["org"]["id"],
            "meeting_type": "intro_call",
            "scheduled_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
            "duration_minutes": 30,
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- summary --------------------------------------------------------------


async def test_summary_with_data(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="a")
    startup = await _make_startup(client, suffix="a")
    hub_headers = startup["founder"]["headers"]

    round_row = await _create_round(client, startup, name="Seed 2026")
    await _create_deal(client, firm, startup)
    await _create_request(client, firm, startup)
    await _create_meeting(client, firm, startup)
    # A startup-side action (accepting a request) records an activity
    # event on the startup's own org; investor-side actions are stamped
    # on the investor firm's org (see activity org-scoping test).
    pending = await _create_request_with_kind(client, firm, startup, kind="meeting")
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/investor-requests/{pending['id']}/respond",
        json={"decision": "accept", "response_note": "Let's talk"},
        headers=hub_headers,
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-hub/summary",
        headers=hub_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["open_rounds"] == 1
    assert body["deals_in_pipeline"] == 1
    assert body["pending_requests"] == 1  # the accepted request left the pending pool
    assert body["meetings_this_month"] == 1
    assert body["offers_received"] == 0
    assert body["commitments_received"] == 0

    # Primary round = the open round closing earliest.
    primary = body["primary_round"]
    assert primary is not None
    assert primary["id"] == round_row["id"]
    assert primary["name"] == "Seed 2026"
    assert primary["round_type"] == "seed"
    assert primary["target_amount"] == "1000000.00"
    assert primary["committed_amount"] == "0.00"
    assert primary["currency"] == "INR"
    assert primary["status"] == "open"
    assert primary["progress_pct"] == 0
    assert primary["closes_on"] == round_row["closes_on"]

    # Needs reply carries the investor's name (only the still-pending request).
    assert len(body["needs_reply"]) == 1
    assert body["needs_reply"][0]["investor_name"] == "Zenitha"
    assert body["needs_reply"][0]["kind"] == "intro"

    # Upcoming meetings carry the investor's name.
    assert len(body["upcoming_meetings"]) == 1
    assert body["upcoming_meetings"][0]["investor_name"] == "Zenitha"
    assert body["upcoming_meetings"][0]["meeting_type"] == "intro_call"
    assert body["upcoming_meetings"][0]["status"] == "proposed"

    # Recent activity reflects the startup's own org-scoped audit events:
    # the accepted request and the round creation — NOT investor-side
    # events (deal/request/meeting creation), which are stamped on the
    # investor firm's org and must not leak into the startup's feed.
    recent = body["recent_activity"]
    assert len(recent) >= 2
    event_types = {event["event_type"] for event in recent}
    assert "engagement_request_accepted" in event_types
    assert "round_created" in event_types
    assert "meeting_created" not in event_types
    assert "deal_created" not in event_types


async def test_summary_empty(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="empty")

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-hub/summary",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["open_rounds"] == 0
    assert body["deals_in_pipeline"] == 0
    assert body["pending_requests"] == 0
    assert body["meetings_this_month"] == 0
    assert body["offers_received"] == 0
    assert body["commitments_received"] == 0
    assert body["primary_round"] is None
    assert body["needs_reply"] == []
    assert body["upcoming_meetings"] == []
    assert body["recent_activity"] == []


async def test_summary_org_scoped(client: AsyncClient) -> None:
    firm_a = await _make_investor_firm(client, suffix="s1")
    await _make_investor_firm(client, suffix="s2")
    startup_a = await _make_startup(client, suffix="s1")
    startup_b = await _make_startup(client, suffix="s2")

    await _create_round(client, startup_a, name="Seed A")
    await _create_deal(client, firm_a, startup_a)
    await _create_meeting(client, firm_a, startup_a)

    # Hub B must not see firm A's deals / meetings against startup A.
    resp = await client.get(
        f"/api/v1/organizations/{startup_b['org']['id']}/investor-hub/summary",
        headers=startup_b["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["deals_in_pipeline"] == 0
    assert body["meetings_this_month"] == 0
    assert body["recent_activity"] == []

    # Startup A does see its own data, including its own audit events.
    resp_a = await client.get(
        f"/api/v1/organizations/{startup_a['org']['id']}/investor-hub/summary",
        headers=startup_a["founder"]["headers"],
    )
    assert resp_a.status_code == 200, resp_a.text
    assert resp_a.json()["deals_in_pipeline"] == 1
    assert resp_a.json()["meetings_this_month"] == 1
    assert len(resp_a.json()["recent_activity"]) >= 1


async def test_summary_viewer_can_read(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="viewer")
    firm = await _make_investor_firm(client, suffix="viewer")
    await _create_request(client, firm, startup)

    # The startup's viewer member is allowed read-only access.
    viewer = await _signup_verified(client, "hub-startviewer1@test.dev", role="startup")
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/invites",
        json={"email": viewer["email"], "role": "viewer"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["token"]
    accept = await client.post(f"/api/v1/invites/{token}/accept", headers=viewer["headers"])
    assert accept.status_code == 200, accept.text

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-hub/summary",
        headers=viewer["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["pending_requests"] == 1


# --- rounds --------------------------------------------------------------


async def test_rounds_page_with_progress(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="r1")
    startup = await _make_startup(client, suffix="r1")
    hub_headers = startup["founder"]["headers"]

    round_a = await _create_round(client, startup, name="Seed 2026")
    await _create_deal(client, firm, startup, round_id=round_a["id"])
    round_b = await _create_round(client, startup, name="Series A")

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-hub/rounds",
        headers=hub_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 2
    assert body["limit"] == 100
    assert body["offset"] == 0
    assert len(body["items"]) == 2

    by_name = {item["name"]: item for item in body["items"]}
    # Deals are counted per round they were created against.
    assert by_name["Seed 2026"]["deal_count"] == 1
    assert by_name["Series A"]["deal_count"] == 0
    # Both rounds start at committed 0 against a 1,000,000 target.
    for item in body["items"]:
        assert item["target_amount"] == "1000000.00"
        assert item["committed_amount"] == "0.00"
        assert item["progress_pct"] == 0
        assert item["offer_count"] == 0
        assert item["commitment_count"] == 0
        assert item["status"] == "open"
    assert by_name["Seed 2026"]["id"] == round_a["id"]
    assert by_name["Series A"]["id"] == round_b["id"]


async def test_rounds_pagination(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="r2")
    for i in range(3):
        await _create_round(client, startup, name=f"Round {i}")
    headers = startup["founder"]["headers"]

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-hub/rounds",
        params={"limit": 2, "offset": 0},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-hub/rounds",
        params={"limit": 2, "offset": 2},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 1


async def test_rounds_pagination_validation(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="r3")
    headers = startup["founder"]["headers"]
    base = f"/api/v1/organizations/{startup['org']['id']}/investor-hub/rounds"

    for bad_params in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        resp = await client.get(base, params=bad_params, headers=headers)
        assert resp.status_code == 422, f"{bad_params}: {resp.text}"


# --- activity -------------------------------------------------------------


async def test_activity_and_stats(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="act")
    startup = await _make_startup(client, suffix="act")
    hub_headers = startup["founder"]["headers"]

    await _create_round(client, startup, name="Seed act")
    request = await _create_request(client, firm, startup)
    await _create_deal(client, firm, startup)
    await _create_meeting(client, firm, startup)
    # Startup-side action -> event stamped on the startup's org.
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/investor-requests/{request['id']}/respond",
        json={"decision": "accept", "response_note": "Sure"},
        headers=hub_headers,
    )
    assert resp.status_code == 200, resp.text

    base = f"/api/v1/organizations/{startup['org']['id']}/investor-hub/activity"

    resp = await client.get(base, headers=hub_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Only the startup's own org-scoped events (round_created,
    # round_status_changed + accept); investor-side events are stamped
    # on the investor firm and excluded.
    assert body["total"] == 3
    assert body["limit"] == 20
    types = {event["event_type"] for event in body["items"]}
    assert "engagement_request_accepted" in types
    assert "round_created" in types
    assert "meeting_created" not in types

    # Newest first.
    created = [event["created_at"] for event in body["items"]]
    assert created == sorted(created, reverse=True)

    # Event-type filter.
    resp = await client.get(
        base, params={"event_type": "engagement_request_accepted"}, headers=hub_headers
    )
    assert resp.status_code == 200, resp.text
    filtered = resp.json()
    assert filtered["total"] == 1
    assert filtered["items"][0]["event_type"] == "engagement_request_accepted"

    # Stats aggregate the same scope.
    resp = await client.get(f"{base}/stats", headers=hub_headers)
    assert resp.status_code == 200, resp.text
    stats = resp.json()
    assert stats["total_events"] == 3
    assert stats["events_last_7_days"] == 3
    assert "engagement_request_accepted" in stats["by_event_type"]
    assert "round_created" in stats["by_event_type"]
    assert len(stats["by_day"]) >= 1


async def test_activity_org_scoped(client: AsyncClient) -> None:
    firm_a = await _make_investor_firm(client, suffix="act1")
    await _make_investor_firm(client, suffix="act2")
    startup_a = await _make_startup(client, suffix="act1")
    startup_b = await _make_startup(client, suffix="act2")

    await _create_round(client, startup_a, name="Seed A1")
    await _create_meeting(client, firm_a, startup_a)

    base_b = f"/api/v1/organizations/{startup_b['org']['id']}/investor-hub/activity"
    resp = await client.get(base_b, headers=startup_b["founder"]["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 0

    resp = await client.get(f"{base_b}/stats", headers=startup_b["founder"]["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["total_events"] == 0

    # Startup A sees its own round-creation event, but not the
    # investor-side meeting event (stamped on firm A's org).
    resp_a = await client.get(
        f"/api/v1/organizations/{startup_a['org']['id']}/investor-hub/activity",
        headers=startup_a["founder"]["headers"],
    )
    assert resp_a.status_code == 200, resp_a.text
    assert resp_a.json()["total"] == 2
    a_types = {event["event_type"] for event in resp_a.json()["items"]}
    assert "round_created" in a_types
    assert "round_status_changed" in a_types


async def test_activity_pagination_validation(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="actv")
    headers = startup["founder"]["headers"]
    base = f"/api/v1/organizations/{startup['org']['id']}/investor-hub/activity"

    for bad_params in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        resp = await client.get(base, params=bad_params, headers=headers)
        assert resp.status_code == 422, f"{bad_params}: {resp.text}"


# --- auth / authorization ---------------------------------------------------


async def test_summary_401(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="auth1")
    resp = await client.get(f"/api/v1/organizations/{startup['org']['id']}/investor-hub/summary")
    assert resp.status_code == 401, resp.text


async def test_summary_non_member_403(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="auth2")
    firm = await _make_investor_firm(client, suffix="auth2")

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-hub/summary",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_summary_wrong_org_type_404(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="auth3")
    # An investor_firm org is not a startup: 404, no existence oracle.
    resp = await client.get(
        f"/api/v1/organizations/{firm['org']['id']}/investor-hub/summary",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_summary_deleted_org_404(client: AsyncClient, db_session: "AsyncSession") -> None:
    from sqlalchemy import select

    startup = await _make_startup(client, suffix="auth4")
    # Soft-delete the org directly (there is no org-delete endpoint).
    import uuid as _uuid

    result = await db_session.execute(
        select(Organization).where(Organization.id == _uuid.UUID(startup["org"]["id"]))
    )
    org = result.scalar_one()
    org.deleted_at = datetime.now(UTC)
    await db_session.commit()

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-hub/summary",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text


# --- write surface ---------------------------------------------------------


async def test_hub_exposes_no_write_surface(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="write")
    headers = startup["founder"]["headers"]

    for path in ("summary", "rounds", "activity", "activity/stats"):
        for method in ("post", "patch", "put", "delete"):
            kwargs: dict = {} if method == "delete" else {"json": {}}
            resp = await getattr(client, method)(
                f"/api/v1/organizations/{startup['org']['id']}/investor-hub/{path}",
                headers=headers,
                **kwargs,
            )
            assert resp.status_code == 405, f"{method} /{path}: {resp.text}"
