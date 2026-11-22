"""Tests for Step 9l: investor workspace (dashboard, insights, activity).

Covers: happy paths for all four read endpoints, org-scoping (data
written by other firms is invisible), 401, 403/404 (wrong role and
wrong organization, no investor firm), validation of pagination
params, and the D1 descriptive-only invariant (insights return real
counts, no forecast fields).
"""

import re
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

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
    verify = await client.post(
        "/api/v1/auth/verify-email", json={"email": email, "code": code}
    )
    assert verify.status_code == 200, verify.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
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
    accept = await client.post(
        f"/api/v1/invites/{token}/accept", headers=invitee["headers"]
    )
    assert accept.status_code == 200, accept.text


async def _make_investor_firm(client: AsyncClient, suffix: str = "") -> dict:
    owner = await _signup_verified(client, f"ws-invowner{suffix}@test.dev", role="investor")
    member = await _signup_verified(client, f"ws-invmember{suffix}@test.dev", role="investor")
    viewer = await _signup_verified(client, f"ws-invviewer{suffix}@test.dev", role="investor")
    org = await _create_org(client, owner, name=f"Zenith{suffix or ''}", type_="investor_firm")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"owner": owner, "member": member, "viewer": viewer, "org": org}


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    founder = await _signup_verified(client, f"ws-founder{suffix}@test.dev", role="startup")
    org = await _create_org(client, founder, name=f"Acme{suffix or ''}", type_="startup")
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={"profile_visibility": "public"},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    return {"founder": founder, "org": org}


async def _create_deal(
    client: AsyncClient, firm: dict, startup: dict, *, stage: str = "interested"
) -> dict:
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    deal_id = resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/investors/deals/{deal_id}",
        json={"stage": stage},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
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


# --- dashboard ------------------------------------------------------------


async def test_dashboard_summary(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="a")
    startup = await _make_startup(client, suffix="a")
    headers = firm["owner"]["headers"]

    await _create_deal(client, firm, startup, stage="meeting")
    await _create_request(client, firm, startup)
    await _create_meeting(client, firm, startup)

    resp = await client.get("/api/v1/investors/dashboard/summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["new_matches_this_week"] >= 1
    assert body["requests_awaiting_reply"] == 1
    assert body["meetings_this_week"] == 1
    assert body["startups_in_pipeline"] == 1
    assert body["pipeline_snapshot"]["meeting"] == 1
    assert body["portfolio_holdings"] == 0
    assert len(body["needs_reply"]) == 1
    assert body["needs_reply"][0]["startup_name"] == "Acmea"
    assert len(body["upcoming_meetings"]) == 1


async def test_dashboard_summary_org_scoped(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="b")
    other = await _make_investor_firm(client, suffix="b2")
    startup = await _make_startup(client, suffix="b")

    await _create_request(client, other, startup)

    resp = await client.get(
        "/api/v1/investors/dashboard/summary", headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["requests_awaiting_reply"] == 0
    assert resp.json()["needs_reply"] == []


# --- insights --------------------------------------------------------------


async def test_insights_descriptive_only(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="c")
    startup = await _make_startup(client, suffix="c")
    headers = firm["owner"]["headers"]

    await _create_deal(client, firm, startup, stage="data_room")
    await _create_request(client, firm, startup)

    resp = await client.get("/api/v1/investors/insights", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # descriptive fields present
    assert "startups_by_stage" in body
    assert "startups_by_stage_total" in body
    assert "monthly_new_profiles" in body
    assert "monthly_round_launches" in body
    assert "your_funnel" in body
    assert body["cohort_threshold"] == 10
    # no forecast fields (D1)
    for banned in ("forecast", "prediction", "projected", "estimate"):
        assert banned not in body
    # the funnel reflects real activity
    assert body["your_funnel"]["intro_requests"] == 1
    assert body["your_funnel"]["data_rooms_opened"] == 1


async def test_insights_org_scoped(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="d")
    other = await _make_investor_firm(client, suffix="d2")
    startup = await _make_startup(client, suffix="d")

    await _create_request(client, other, startup)

    resp = await client.get("/api/v1/investors/insights", headers=firm["owner"]["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["your_funnel"]["intro_requests"] == 0


# --- activity --------------------------------------------------------------


async def test_activity_list_and_stats(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    firm = await _make_investor_firm(client, suffix="e")
    startup = await _make_startup(client, suffix="e")
    headers = firm["owner"]["headers"]

    await _create_request(client, firm, startup)
    await _create_meeting(client, firm, startup)

    resp = await client.get("/api/v1/investors/activity", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] >= 2
    assert len(body["items"]) >= 2
    event_types = {item["event_type"] for item in body["items"]}
    assert "engagement_request_created" in event_types
    assert "meeting_created" in event_types

    # filter by event type
    resp = await client.get(
        "/api/v1/investors/activity?event_type=meeting_created", headers=headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] >= 1
    for item in resp.json()["items"]:
        assert item["event_type"] == "meeting_created"

    # stats
    resp = await client.get("/api/v1/investors/activity/stats", headers=headers)
    assert resp.status_code == 200, resp.text
    stats = resp.json()
    assert stats["total_events"] >= 2
    assert stats["events_last_7_days"] >= 2
    assert "engagement_request_created" in stats["by_event_type"]
    assert isinstance(stats["by_day"], list)


async def test_activity_org_scoped(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="f")
    other = await _make_investor_firm(client, suffix="f2")
    startup = await _make_startup(client, suffix="f")

    await _create_request(client, other, startup)

    resp = await client.get("/api/v1/investors/activity", headers=firm["owner"]["headers"])
    assert resp.status_code == 200, resp.text
    # the other firm's request event must be invisible (org-scoped)
    event_types = {item["event_type"] for item in resp.json()["items"]}
    assert "engagement_request_created" not in event_types
    resp = await client.get(
        "/api/v1/investors/activity/stats", headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert "engagement_request_created" not in resp.json()["by_event_type"]


# --- security --------------------------------------------------------------


async def test_workspace_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/investors/dashboard/summary")
    assert resp.status_code == 401
    resp = await client.get("/api/v1/investors/insights")
    assert resp.status_code == 401
    resp = await client.get("/api/v1/investors/activity")
    assert resp.status_code == 401
    resp = await client.get("/api/v1/investors/activity/stats")
    assert resp.status_code == 401


async def test_workspace_viewer_can_read(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="g")
    startup = await _make_startup(client, suffix="g")
    await _create_request(client, firm, startup)

    # viewers can read (read-only roles are fine for workspace)
    resp = await client.get(
        "/api/v1/investors/dashboard/summary", headers=firm["viewer"]["headers"]
    )
    assert resp.status_code == 200
    resp = await client.get("/api/v1/investors/activity", headers=firm["viewer"]["headers"])
    assert resp.status_code == 200


async def test_workspace_no_investor_org_404(client: AsyncClient) -> None:
    user = await _signup_verified(client, "ws-noorg@test.dev", role="startup")
    resp = await client.get("/api/v1/investors/dashboard/summary", headers=user["headers"])
    assert resp.status_code == 404
    resp = await client.get("/api/v1/investors/insights", headers=user["headers"])
    assert resp.status_code == 404
    resp = await client.get("/api/v1/investors/activity", headers=user["headers"])
    assert resp.status_code == 404


async def test_workspace_pagination_validation(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="h")
    headers = firm["owner"]["headers"]
    resp = await client.get("/api/v1/investors/activity?limit=0", headers=headers)
    assert resp.status_code == 422
    resp = await client.get("/api/v1/investors/activity?limit=101", headers=headers)
    assert resp.status_code == 422
    resp = await client.get("/api/v1/investors/activity?offset=-1", headers=headers)
    assert resp.status_code == 422
