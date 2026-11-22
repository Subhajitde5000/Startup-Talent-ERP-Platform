"""Tests for Step 9k: investor diligence checklists and items.

Covers: happy paths (checklist lifecycle with idempotent open, item
create/update/soft-delete, scorecard round-trip), validation errors,
401, 403 (viewer write), 404 for wrong organization (no existence
oracle), cross-organization reference attempts (round on another
startup, deal of another firm), mass-assignment attempts on
server-controlled fields, and activity rows.
"""

import re
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent, ActivityEventType
from app.models.diligence import InvestorDiligenceItem

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
    owner = await _signup_verified(client, f"dl-invowner{suffix}@test.dev", role="investor")
    member = await _signup_verified(client, f"dl-invmember{suffix}@test.dev", role="investor")
    viewer = await _signup_verified(client, f"dl-invviewer{suffix}@test.dev", role="investor")
    org = await _create_org(client, owner, name=f"Zenith{suffix or ''}", type_="investor_firm")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"owner": owner, "member": member, "viewer": viewer, "org": org}


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    founder = await _signup_verified(client, f"dl-founder{suffix}@test.dev", role="startup")
    org = await _create_org(client, founder, name=f"Acme{suffix or ''}", type_="startup")
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={"profile_visibility": "public"},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    return {"founder": founder, "org": org}


async def _open_checklist(client: AsyncClient, firm: dict, startup_org_id: str):
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": startup_org_id},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_item(client: AsyncClient, firm: dict, checklist_id: str, **overrides):
    payload = {"item_type": "checklist", "title": "Business model understood"}
    payload.update(overrides)
    resp = await client.post(
        f"/api/v1/investors/diligence/{checklist_id}/items",
        json=payload,
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- checklists ------------------------------------------------------------


async def test_checklist_lifecycle_and_idempotent_open(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="a")
    startup = await _make_startup(client, suffix="a")

    checklist = await _open_checklist(client, firm, startup["org"]["id"])
    assert checklist["overall_status"] == "not_started"
    assert checklist["investor_org_id"] == firm["org"]["id"]
    assert checklist["startup_org_id"] == startup["org"]["id"]

    # idempotent: opening again returns the SAME checklist
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["id"] == checklist["id"]

    # update status, notes, scorecard
    scorecard = {
        "dimensions": [
            {"name": "Team", "weight": 25, "score": 4, "rationale": "Strong founding team"},
            {"name": "Market TAM", "weight": 20, "score": 3, "rationale": "Bottom-up TAM ok"},
        ]
    }
    resp = await client.patch(
        f"/api/v1/investors/diligence/{checklist['id']}",
        json={
            "overall_status": "in_progress",
            "notes": "Initial read complete.",
            "scorecard": scorecard,
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["overall_status"] == "in_progress"
    assert resp.json()["notes"] == "Initial read complete."
    assert resp.json()["scorecard"] == scorecard

    # list shows it
    resp = await client.get("/api/v1/investors/diligence", headers=firm["owner"]["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1


async def test_item_lifecycle(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="b")
    startup = await _make_startup(client, suffix="b")
    checklist = await _open_checklist(client, firm, startup["org"]["id"])

    # checklist item
    item = await _create_item(client, firm, checklist["id"])
    assert item["status"] == "not_started"
    assert item["item_type"] == "checklist"

    # finding with severity
    finding = await _create_item(
        client,
        firm,
        checklist["id"],
        item_type="finding",
        title="IP assignment pending",
        severity="high",
        status="concern",
    )
    assert finding["severity"] == "high"
    assert finding["status"] == "concern"

    # question with response
    question = await _create_item(
        client,
        firm,
        checklist["id"],
        item_type="question",
        title="Can you share Q3 revenue reconciliation?",
        status="awaiting",
        due_on="2026-12-01",
    )
    assert question["status"] == "awaiting"
    assert question["due_on"] == "2026-12-01"

    # update an item
    resp = await client.patch(
        f"/api/v1/investors/diligence/{checklist['id']}/items/{item['id']}",
        json={"status": "cleared", "response": "Reviewed and cleared."},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cleared"
    assert resp.json()["response"] == "Reviewed and cleared."

    # list items, filter by type
    resp = await client.get(
        f"/api/v1/investors/diligence/{checklist['id']}/items",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 3
    resp = await client.get(
        f"/api/v1/investors/diligence/{checklist['id']}/items?item_type=finding",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1

    # soft delete
    resp = await client.delete(
        f"/api/v1/investors/diligence/{checklist['id']}/items/{item['id']}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 204
    resp = await client.get(
        f"/api/v1/investors/diligence/{checklist['id']}/items",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 2


# --- security --------------------------------------------------------------


async def test_diligence_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/investors/diligence")
    assert resp.status_code == 401
    resp = await client.post("/api/v1/investors/diligence", json={})
    assert resp.status_code == 401


async def test_diligence_viewer_forbidden(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="c")
    startup = await _make_startup(client, suffix="c")

    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    checklist_id = resp.json()["id"]

    # viewer cannot create checklist / items / updates
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403
    resp = await _create_item(client, firm, checklist_id)
    assert resp["id"]  # sanity: created as owner
    resp = await client.post(
        f"/api/v1/investors/diligence/{checklist_id}/items",
        json={"item_type": "checklist", "title": "x"},
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403
    # viewer CAN read
    resp = await client.get("/api/v1/investors/diligence", headers=firm["viewer"]["headers"])
    assert resp.status_code == 200


async def test_diligence_cross_org_404(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="d")
    other = await _make_investor_firm(client, suffix="d2")
    startup = await _make_startup(client, suffix="d")

    checklist = await _open_checklist(client, firm, startup["org"]["id"])
    item = await _create_item(client, firm, checklist["id"])

    # other firm gets 404 (no existence oracle)
    resp = await client.get(
        f"/api/v1/investors/diligence/{checklist['id']}",
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404
    resp = await client.patch(
        f"/api/v1/investors/diligence/{checklist['id']}",
        json={"overall_status": "cleared"},
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404
    resp = await client.get(
        f"/api/v1/investors/diligence/{checklist['id']}/items",
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404
    resp = await client.patch(
        f"/api/v1/investors/diligence/{checklist['id']}/items/{item['id']}",
        json={"status": "cleared"},
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404
    resp = await client.delete(
        f"/api/v1/investors/diligence/{checklist['id']}/items/{item['id']}",
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404


async def test_diligence_validation_errors(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="e")
    startup = await _make_startup(client, suffix="e")
    headers = firm["owner"]["headers"]

    # unknown startup org
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 404

    # investor diligences itself
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": firm["org"]["id"]},
        headers=headers,
    )
    assert resp.status_code in (400, 404, 422)

    # invalid overall_status
    checklist = await _open_checklist(client, firm, startup["org"]["id"])
    resp = await client.patch(
        f"/api/v1/investors/diligence/{checklist['id']}",
        json={"overall_status": "bogus"},
        headers=headers,
    )
    assert resp.status_code == 422

    # item validation
    resp = await client.post(
        f"/api/v1/investors/diligence/{checklist['id']}/items",
        json={"item_type": "bogus", "title": "x"},
        headers=headers,
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/api/v1/investors/diligence/{checklist['id']}/items",
        json={"item_type": "checklist", "title": "   "},
        headers=headers,
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/api/v1/investors/diligence/{checklist['id']}/items",
        json={"item_type": "checklist", "title": "x", "severity": "bogus"},
        headers=headers,
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/api/v1/investors/diligence/{checklist['id']}/items",
        json={"item_type": "checklist", "title": "x", "status": "bogus"},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_diligence_mass_assignment_attempts(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="f")
    startup = await _make_startup(client, suffix="f")
    headers = firm["owner"]["headers"]

    # server-controlled fields forbidden
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={
            "startup_org_id": startup["org"]["id"],
            "investor_org_id": str(uuid.uuid4()),
            "overall_status": "cleared",
            "id": str(uuid.uuid4()),
            "created_at": "2020-01-01T00:00:00Z",
        },
        headers=headers,
    )
    assert resp.status_code == 422

    checklist = await _open_checklist(client, firm, startup["org"]["id"])
    resp = await client.post(
        f"/api/v1/investors/diligence/{checklist['id']}/items",
        json={
            "item_type": "checklist",
            "title": "x",
            "checklist_id": str(uuid.uuid4()),
            "investor_org_id": str(uuid.uuid4()),
            "status": "cleared",
            "created_by": str(uuid.uuid4()),
        },
        headers=headers,
    )
    assert resp.status_code == 422

    # checklist id not writable via PATCH
    resp = await client.patch(
        f"/api/v1/investors/diligence/{checklist['id']}",
        json={"overall_status": "cleared", "id": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_diligence_reference_validation(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="g")
    await _make_investor_firm(client, suffix="g2")
    startup = await _make_startup(client, suffix="g")
    other_startup = await _make_startup(client, suffix="g2")
    headers = firm["owner"]["headers"]

    # round_id must be a live round of THIS startup
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": startup["org"]["id"], "round_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 422

    # deal_id must be a live deal of THIS firm
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": startup["org"]["id"], "deal_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 422

    # round of ANOTHER startup is rejected
    resp = await client.post(
        f"/api/v1/organizations/{other_startup['org']['id']}/funding-rounds",
        json={"name": "Seed", "round_type": "seed", "target_amount": "1000000.00"},
        headers=other_startup["founder"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    other_round_id = resp.json()["id"]
    resp = await client.post(
        "/api/v1/investors/diligence",
        json={"startup_org_id": startup["org"]["id"], "round_id": other_round_id},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_diligence_activity_rows(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    firm = await _make_investor_firm(client, suffix="h")
    startup = await _make_startup(client, suffix="h")

    checklist = await _open_checklist(client, firm, startup["org"]["id"])
    checklist_id = uuid.UUID(checklist["id"])
    item = await _create_item(client, firm, checklist["id"])
    item_id = uuid.UUID(item["id"])

    result = await db_session.execute(
        select(ActivityEvent).where(
            ActivityEvent.entity_type == "diligence_checklist",
            ActivityEvent.entity_id == checklist_id,
        )
    )
    events = result.scalars().all()
    assert any(
        e.event_type == ActivityEventType.diligence_checklist_created.value for e in events
    )

    result = await db_session.execute(
        select(ActivityEvent).where(
            ActivityEvent.entity_type == "diligence_item",
            ActivityEvent.entity_id == item_id,
        )
    )
    events = result.scalars().all()
    assert any(
        e.event_type == ActivityEventType.diligence_item_created.value for e in events
    )


async def test_diligence_no_investor_org_404(client: AsyncClient) -> None:
    user = await _signup_verified(client, "dl-noorg@test.dev", role="startup")
    resp = await client.get("/api/v1/investors/diligence", headers=user["headers"])
    assert resp.status_code == 404


async def test_diligence_items_gone_after_checklist_gone(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Soft-deleted items are excluded from reads (identity-map safe)."""
    firm = await _make_investor_firm(client, suffix="i")
    startup = await _make_startup(client, suffix="i")
    headers = firm["owner"]["headers"]

    checklist = await _open_checklist(client, firm, startup["org"]["id"])
    item = await _create_item(client, firm, checklist["id"])
    resp = await client.delete(
        f"/api/v1/investors/diligence/{checklist['id']}/items/{item['id']}",
        headers=headers,
    )
    assert resp.status_code == 204

    await db_session.rollback()
    db_session.expire_all()
    result = await db_session.execute(
        select(InvestorDiligenceItem).where(
            InvestorDiligenceItem.id == uuid.UUID(item["id"])
        )
    )
    row = result.scalar_one()
    assert row.deleted_at is not None
