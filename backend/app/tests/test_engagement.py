"""Tests for Step 9f: engagement requests and meetings.

Covers: happy paths (request lifecycle, decline hides reason from
startup view, withdraw, meeting lifecycle), validation errors, 401,
403 (viewer write), 404 for wrong organization (no existence oracle),
cross-organization reference attempts (deal/request refs),
mass-assignment attempts on server-controlled fields, lazy request
expiry, D5 re-proposal of confirmed meetings, and activity rows.
"""

import re
import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent, ActivityEventType
from app.models.investor_engagement import (
    InvestorEngagementRequest,
    RequestStatus,
)

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
    owner = await _signup_verified(client, f"eg-invowner{suffix}@test.dev", role="investor")
    member = await _signup_verified(client, f"eg-invmember{suffix}@test.dev", role="investor")
    viewer = await _signup_verified(client, f"eg-invviewer{suffix}@test.dev", role="investor")
    org = await _create_org(client, owner, name=f"Zenith{suffix or ''}", type_="investor_firm")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"owner": owner, "member": member, "viewer": viewer, "org": org}


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    founder = await _signup_verified(client, f"eg-founder{suffix}@test.dev", role="startup")
    org = await _create_org(client, founder, name=f"Acme{suffix or ''}", type_="startup")
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={"profile_visibility": "public"},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    return {"founder": founder, "org": org}


async def _user_id(client: AsyncClient, headers: dict) -> uuid.UUID:
    resp = await client.get("/api/v1/users/me", headers=headers)
    resp.raise_for_status()
    return uuid.UUID(resp.json()["id"])


async def _create_request(
    client: AsyncClient, headers: dict, startup_org_id: str, **overrides
):
    payload = {
        "startup_org_id": startup_org_id,
        "kind": "intro",
        "ask": "Would you be open to a conversation?",
        "message": "We invest in early-stage SaaS.",
    }
    payload.update(overrides)
    return await client.post("/api/v1/investors/requests", json=payload, headers=headers)


async def _create_meeting(
    client: AsyncClient, headers: dict, startup_org_id: str, **overrides
):
    payload = {
        "startup_org_id": startup_org_id,
        "meeting_type": "intro_call",
        "scheduled_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
        "duration_minutes": 30,
    }
    payload.update(overrides)
    return await client.post("/api/v1/investors/meetings", json=payload, headers=headers)


# --- requests --------------------------------------------------------------


async def test_request_lifecycle(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="a")
    startup = await _make_startup(client, suffix="a")

    resp = await _create_request(client, firm["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending"
    assert body["investor_org_id"] == firm["org"]["id"]
    assert body["startup_org_id"] == startup["org"]["id"]
    assert body["expires_on"] is not None
    assert body["owner_id"] == str(await _user_id(client, firm["owner"]["headers"]))

    # startup sees it (no decline_reason on the startup view)
    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-requests",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == body["id"]
    assert "decline_reason" not in items[0]

    # startup accepts
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/investor-requests/{body['id']}/respond",
        json={"decision": "accept", "response_note": "Yes, let's talk."},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "accepted"

    # investor sees the response
    resp = await client.get(
        f"/api/v1/investors/requests/{body['id']}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["response_note"] == "Yes, let's talk."

    # terminal: cannot withdraw an accepted request
    resp = await client.post(
        f"/api/v1/investors/requests/{body['id']}/withdraw",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 409


async def test_request_decline_hides_reason_from_startup(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="b")
    startup = await _make_startup(client, suffix="b")

    resp = await _create_request(
        client, firm["owner"]["headers"], startup["org"]["id"], kind="information"
    )
    assert resp.status_code == 201, resp.text
    request_id = resp.json()["id"]

    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/investor-requests/{request_id}/respond",
        json={"decision": "decline", "decline_reason": "Not a fit for this quarter."},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "declined"
    assert "decline_reason" not in resp.json()

    # the investor's own view DOES include the private reason
    resp = await client.get(
        f"/api/v1/investors/requests/{request_id}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["decline_reason"] == "Not a fit for this quarter."


async def test_request_withdraw_and_duplicate(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="c")
    startup = await _make_startup(client, suffix="c")

    resp = await _create_request(client, firm["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    request_id = resp.json()["id"]

    # duplicate open request of same kind -> 409
    resp = await _create_request(client, firm["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 409

    # withdraw
    resp = await client.post(
        f"/api/v1/investors/requests/{request_id}/withdraw",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "withdrawn"

    # now a new request is allowed
    resp = await _create_request(client, firm["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text


async def test_request_lazy_expiry(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    firm = await _make_investor_firm(client, suffix="d")
    startup = await _make_startup(client, suffix="d")

    resp = await _create_request(client, firm["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    request_id = uuid.UUID(resp.json()["id"])

    # force the expiry into the past
    result = await db_session.execute(
        select(InvestorEngagementRequest).where(
            InvestorEngagementRequest.id == request_id
        )
    )
    request = result.scalar_one()
    request.expires_on = datetime.now(UTC) - timedelta(days=1)
    await db_session.commit()
    # end this session's transaction: the shared in-memory connection
    # means an open transaction here would swallow the client's expiry commit
    await db_session.rollback()

    # next read expires it
    resp = await client.get("/api/v1/investors/requests", headers=firm["owner"]["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"][0]["status"] == "expired"

    # end the stale read snapshot held by this session and drop the
    # identity-mapped object so the next select re-reads from the DB
    await db_session.rollback()
    db_session.expire_all()
    result = await db_session.execute(
        select(InvestorEngagementRequest).where(
            InvestorEngagementRequest.id == request_id
        )
    )
    assert result.scalar_one().status == RequestStatus.expired


# --- meetings ---------------------------------------------------------------


async def test_meeting_lifecycle_and_reproposal(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="e")
    startup = await _make_startup(client, suffix="e")

    resp = await _create_meeting(client, firm["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    meeting = resp.json()
    assert meeting["status"] == "proposed"
    assert meeting["organizer_org_id"] == firm["org"]["id"]

    # confirm
    resp = await client.post(
        f"/api/v1/investors/meetings/{meeting['id']}/status",
        json={"status": "confirmed"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "confirmed"

    # startup re-schedules -> D5 re-proposal back to proposed
    new_time = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    resp = await client.patch(
        f"/api/v1/organizations/{startup['org']['id']}/investor-meetings/{meeting['id']}",
        json={"scheduled_at": new_time},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "proposed"

    # complete
    resp = await client.post(
        f"/api/v1/investors/meetings/{meeting['id']}/status",
        json={"status": "completed"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "completed"

    # terminal
    resp = await client.post(
        f"/api/v1/investors/meetings/{meeting['id']}/status",
        json={"status": "cancelled"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 409


# --- security --------------------------------------------------------------


async def test_engagement_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/investors/requests")
    assert resp.status_code == 401
    resp = await client.post("/api/v1/investors/meetings", json={})
    assert resp.status_code == 401


async def test_engagement_viewer_forbidden(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="f")
    startup = await _make_startup(client, suffix="f")

    # founder creates
    resp = await _create_request(client, firm["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    request_id = resp.json()["id"]

    # viewer cannot create or withdraw
    resp = await _create_request(client, firm["viewer"]["headers"], startup["org"]["id"])
    assert resp.status_code == 403
    resp = await client.post(
        f"/api/v1/investors/requests/{request_id}/withdraw",
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403
    # viewer CAN read
    resp = await client.get("/api/v1/investors/requests", headers=firm["viewer"]["headers"])
    assert resp.status_code == 200


async def test_engagement_cross_org_404(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="g")
    other = await _make_investor_firm(client, suffix="g2")
    startup = await _make_startup(client, suffix="g")

    # other investor creates a request against the same startup
    resp = await _create_request(client, other["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    foreign_id = resp.json()["id"]

    # our investor gets 404 (no existence oracle)
    resp = await client.get(
        f"/api/v1/investors/requests/{foreign_id}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 404
    resp = await client.post(
        f"/api/v1/investors/requests/{foreign_id}/withdraw",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 404

    # meetings too
    resp = await _create_meeting(client, other["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    foreign_meeting = resp.json()["id"]
    resp = await client.get(
        f"/api/v1/investors/meetings/{foreign_meeting}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 404


async def test_engagement_startup_cross_org_404(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="h")
    startup = await _make_startup(client, suffix="h")
    other_startup = await _make_startup(client, suffix="h2")

    # a request sent to the OTHER startup cannot be responded to here
    resp = await _create_request(client, firm["owner"]["headers"], other_startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    foreign_id = resp.json()["id"]

    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/investor-requests/{foreign_id}/respond",
        json={"decision": "accept"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404
    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-requests/{foreign_id}",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404


async def test_engagement_validation_errors(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="i")
    startup = await _make_startup(client, suffix="i")
    headers = firm["owner"]["headers"]
    org_id = startup["org"]["id"]

    # bad kind
    resp = await _create_request(client, headers, org_id, kind="bogus")
    assert resp.status_code == 422
    # blank ask
    resp = await _create_request(client, headers, org_id, ask="   ")
    assert resp.status_code == 422
    # ask too long
    resp = await _create_request(client, headers, org_id, ask="x" * 201)
    assert resp.status_code == 422
    # expires_in_days bounds
    resp = await _create_request(client, headers, org_id, expires_in_days=0)
    assert resp.status_code == 422
    resp = await _create_request(client, headers, org_id, expires_in_days=31)
    assert resp.status_code == 422

    # meeting validation
    resp = await _create_meeting(
        client, headers, org_id, duration_minutes=10, meeting_type="bogus"
    )
    assert resp.status_code == 422
    resp = await _create_meeting(client, headers, org_id, duration_minutes=500)
    assert resp.status_code == 422
    resp = await _create_meeting(client, headers, org_id, scheduled_at="not-a-date")
    assert resp.status_code == 422

    # unknown startup org
    resp = await _create_request(client, headers, str(uuid.uuid4()))
    assert resp.status_code == 404

    # respond with bogus decision
    resp = await _create_request(client, headers, org_id)
    assert resp.status_code == 201, resp.text
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/investor-requests/{resp.json()['id']}/respond",
        json={"decision": "maybe"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 422


async def test_engagement_mass_assignment_attempts(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="j")
    startup = await _make_startup(client, suffix="j")
    headers = firm["owner"]["headers"]

    # server-controlled fields are forbidden in create bodies
    resp = await client.post(
        "/api/v1/investors/requests",
        json={
            "startup_org_id": startup["org"]["id"],
            "kind": "intro",
            "ask": "Hello?",
            "status": "accepted",
            "investor_org_id": str(uuid.uuid4()),
            "owner_id": str(uuid.uuid4()),
            "created_at": "2020-01-01T00:00:00Z",
        },
        headers=headers,
    )
    assert resp.status_code == 422

    resp = await _create_request(client, headers, startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    request_id = resp.json()["id"]

    # status is not writable via PATCH
    resp = await client.patch(
        f"/api/v1/investors/requests/{request_id}",
        json={"status": "accepted", "ask": "still here?"},
        headers=headers,
    )
    assert resp.status_code == 422

    resp = await _create_meeting(client, headers, startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    meeting_id = resp.json()["id"]
    resp = await client.post(
        f"/api/v1/investors/meetings/{meeting_id}/status",
        json={"status": "confirmed", "organizer_org_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_engagement_reference_validation(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="k")
    other = await _make_investor_firm(client, suffix="k2")
    startup = await _make_startup(client, suffix="k")
    headers = firm["owner"]["headers"]

    # deal_id must be a live deal of this firm
    resp = await _create_request(
        client, headers, startup["org"]["id"], deal_id=str(uuid.uuid4())
    )
    assert resp.status_code == 422

    # meeting request_id must be a live request of this firm
    resp = await _create_request(client, other["owner"]["headers"], startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    foreign_request = resp.json()["id"]

    resp = await _create_meeting(
        client, headers, startup["org"]["id"], request_id=str(foreign_request)
    )
    assert resp.status_code == 422


async def test_engagement_investor_meets_itself_rejected(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="l")
    headers = firm["owner"]["headers"]

    # an investor firm cannot send itself a request or schedule a meeting
    resp = await _create_request(client, headers, firm["org"]["id"])
    assert resp.status_code in (400, 404, 422)
    resp = await _create_meeting(client, headers, firm["org"]["id"])
    assert resp.status_code in (400, 404, 422)


async def test_engagement_activity_rows(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    firm = await _make_investor_firm(client, suffix="m")
    startup = await _make_startup(client, suffix="m")
    headers = firm["owner"]["headers"]

    resp = await _create_request(client, headers, startup["org"]["id"])
    assert resp.status_code == 201, resp.text
    request_id = uuid.UUID(resp.json()["id"])
    resp = await _create_meeting(client, headers, startup["org"]["id"])
    meeting_id = uuid.UUID(resp.json()["id"])

    result = await db_session.execute(
        select(ActivityEvent).where(
            ActivityEvent.entity_type == "engagement_request",
            ActivityEvent.entity_id == request_id,
        )
    )
    events = result.scalars().all()
    assert any(
        e.event_type == ActivityEventType.engagement_request_created.value for e in events
    )

    result = await db_session.execute(
        select(ActivityEvent).where(
            ActivityEvent.entity_type == "meeting",
            ActivityEvent.entity_id == meeting_id,
        )
    )
    events = result.scalars().all()
    assert any(e.event_type == ActivityEventType.meeting_created.value for e in events)


async def test_engagement_no_investor_org_404(client: AsyncClient) -> None:
    user = await _signup_verified(client, "eg-noorg@test.dev", role="startup")
    resp = await client.get("/api/v1/investors/requests", headers=user["headers"])
    assert resp.status_code == 404
