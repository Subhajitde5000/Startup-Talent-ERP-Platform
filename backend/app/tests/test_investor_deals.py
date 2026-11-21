"""Step 9e tests: investor pipeline (deals + stage history).

Covers the AGENTS.md section 7 definition of done: happy paths
(create/list/get/summary/update/delete/history + the startup-side
view and stage-only patch), validation errors, 401, 403 (viewer),
404 (foreign deal, foreign org, no investor firm), cross-organization
reference attempts (round not on the target startup, owner not a
member, self-deal), duplicate deal (409), mass-assignment on
server-controlled fields, and the confidentiality rule that the
startup-side read strips the investor's private fields (fit_note,
probability, passed_reason, owner_id).
"""

import re
import uuid

from httpx import AsyncClient

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
    owner = await _signup_verified(client, f"deal-invowner{suffix}@test.dev", role="investor")
    member = await _signup_verified(client, f"deal-invmember{suffix}@test.dev", role="investor")
    viewer = await _signup_verified(client, f"deal-invviewer{suffix}@test.dev", role="investor")
    org = await _create_org(client, owner, name=f"Zenith{suffix or ''}", type_="investor_firm")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"owner": owner, "member": member, "viewer": viewer, "org": org}


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    founder = await _signup_verified(client, f"deal-founder{suffix}@test.dev", role="startup")
    org = await _create_org(client, founder, name=f"Acme{suffix or ''}", type_="startup")
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={"profile_visibility": "public"},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    return {"founder": founder, "org": org}


async def _make_open_round(client: AsyncClient, startup: dict) -> str:
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/funding-rounds",
        json={"name": "Seed", "round_type": "seed", "target_amount": "3000000.00"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    round_id = resp.json()["id"]
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/funding-rounds/{round_id}/status",
        json={"status": "open"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    return round_id


async def _create_deal(client: AsyncClient, firm: dict, startup: dict, **extra) -> dict:
    payload = {"startup_org_id": startup["org"]["id"]}
    payload.update(extra)
    resp = await client.post(
        "/api/v1/investors/deals", json=payload, headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- investor side ---------------------------------------------------------


async def test_deal_crud_and_stage_history(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="a")
    startup = await _make_startup(client, suffix="a")
    round_id = await _make_open_round(client, startup)

    deal = await _create_deal(
        client, firm, startup,
        round_id=round_id, stage="meeting", probability=40,
        ticket_size="1500000.00", currency="USD",
        fit_note="Strong team", next_step="Follow up call",
    )
    assert deal["stage"] == "meeting"
    assert deal["probability"] == 40
    assert deal["startup_name"] == startup["org"]["name"]

    # Baseline history row on create.
    resp = await client.get(
        f"/api/v1/investors/deals/{deal['id']}/history",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["from_stage"] is None
    assert resp.json()["items"][0]["to_stage"] == "meeting"

    # Update stage -> a second history row.
    resp = await client.patch(
        f"/api/v1/investors/deals/{deal['id']}",
        json={"stage": "diligence"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["stage"] == "diligence"

    resp = await client.get(
        f"/api/v1/investors/deals/{deal['id']}/history",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    history = resp.json()["items"]
    assert resp.json()["total"] == 2
    assert {h["to_stage"] for h in history} == {"meeting", "diligence"}
    # The most recent entry is the diligence move.
    assert history[0]["to_stage"] == "diligence"
    assert history[0]["from_stage"] == "meeting"

    # List + summary.
    resp = await client.get("/api/v1/investors/deals", headers=firm["owner"]["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1

    resp = await client.get(
        "/api/v1/investors/deals/summary", headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["counts"]["diligence"] == 1
    assert resp.json()["total"] == 1

    # Delete (soft) -> gone from list, history still queryable? (deal 404)
    resp = await client.delete(
        f"/api/v1/investors/deals/{deal['id']}", headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 204, resp.text
    resp = await client.get(
        f"/api/v1/investors/deals/{deal['id']}", headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 404, resp.text


async def test_deal_duplicate_and_self_deal(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="b")
    startup = await _make_startup(client, suffix="b")

    await _create_deal(client, firm, startup)
    # Duplicate pair -> 409.
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text

    # The investor firm's own org is not a startup -> 404 (the
    # deal_distinct_parties CHECK is the DB-level self-deal guard).
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": firm["org"]["id"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_deal_validation_and_cross_org(client: AsyncClient) -> None:
    firm_a = await _make_investor_firm(client, suffix="c")
    firm_b = await _make_investor_firm(client, suffix="d")
    startup_a = await _make_startup(client, suffix="a")
    startup_b = await _make_startup(client, suffix="b")
    round_b = await _make_open_round(client, startup_b)

    # round_id must belong to the target startup.
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": startup_a["org"]["id"], "round_id": round_b},
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # owner_id must be an active member of the investor firm.
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": startup_a["org"]["id"], "owner_id": str(uuid.uuid4())},
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # probability out of range.
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": startup_a["org"]["id"], "probability": 150},
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # Mass-assignment on server-controlled fields.
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": startup_a["org"]["id"], "investor_org_id": str(firm_b["org"]["id"])},
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    deal = await _create_deal(client, firm_a, startup_a)
    # firm B cannot see or touch firm A's deal.
    resp = await client.get(
        f"/api/v1/investors/deals/{deal['id']}", headers=firm_b["owner"]["headers"]
    )
    assert resp.status_code == 404, resp.text
    resp = await client.patch(
        f"/api/v1/investors/deals/{deal['id']}",
        json={"stage": "offer"},
        headers=firm_b["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_deal_viewer_forbidden_and_no_firm_404(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="e")
    startup = await _make_startup(client, suffix="e")
    deal = await _create_deal(client, firm, startup)

    # Viewer is read-only on writes.
    resp = await client.patch(
        f"/api/v1/investors/deals/{deal['id']}",
        json={"stage": "offer"},
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text
    # Viewer can read.
    resp = await client.get("/api/v1/investors/deals", headers=firm["viewer"]["headers"])
    assert resp.status_code == 200, resp.text

    # A startup user has no investor firm -> 404.
    startup_user = await _signup_verified(client, "deal-nofirm@test.dev", role="startup")
    resp = await client.get("/api/v1/investors/deals", headers=startup_user["headers"])
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "INVESTOR_ORG_NOT_FOUND"


async def test_deal_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/investors/deals")
    assert resp.status_code == 401, resp.text


# --- startup side ---------------------------------------------------------


async def test_startup_sees_stripped_deal_and_updates_stage(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="f")
    startup = await _make_startup(client, suffix="f")
    deal = await _create_deal(
        client, firm, startup,
        stage="intro", probability=70, ticket_size="2000000.00",
        fit_note="Secret investor note", passed_reason="Not for startup",
    )

    # Startup reads the deal: private fields stripped.
    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-deals",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["investor_name"] == firm["org"]["name"]
    assert item["stage"] == "intro"
    # Stripped fields are absent.
    assert "fit_note" not in item
    assert "probability" not in item
    assert "passed_reason" not in item
    assert "owner_id" not in item

    # Startup updates the shared stage.
    resp = await client.patch(
        f"/api/v1/organizations/{startup['org']['id']}/investor-deals/{firm['org']['id']}",
        json={"stage": "data_room"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["stage"] == "data_room"

    # The stage change is recorded in the history (visible to the investor).
    resp = await client.get(
        f"/api/v1/investors/deals/{deal['id']}/history",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert any(h["to_stage"] == "data_room" for h in resp.json()["items"])


async def test_startup_deal_cross_org_and_auth(client: AsyncClient) -> None:
    firm_a = await _make_investor_firm(client, suffix="g")
    startup_a = await _make_startup(client, suffix="a")
    startup_b = await _make_startup(client, suffix="b")
    await _create_deal(client, firm_a, startup_a)

    # startup B has no deals (and cannot see startup A's).
    resp = await client.get(
        f"/api/v1/organizations/{startup_b['org']['id']}/investor-deals",
        headers=startup_b["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 0

    # A foreign org_id is 404 for the startup founder.
    resp = await client.get(
        f"/api/v1/organizations/{uuid.uuid4()}/investor-deals",
        headers=startup_a["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text

    # The investor firm's own user is not a member of the (existing)
    # startup -> 403.
    resp = await client.get(
        f"/api/v1/organizations/{startup_a['org']['id']}/investor-deals",
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 403, resp.text

    # Unknown investor_org_id on the startup deal -> 404.
    resp = await client.get(
        f"/api/v1/organizations/{startup_a['org']['id']}/investor-deals/{uuid.uuid4()}",
        headers=startup_a["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_deal_stage_enum_includes_diligence(client: AsyncClient) -> None:
    """D5: `diligence` is a valid stage between data_room and offer."""
    firm = await _make_investor_firm(client, suffix="h")
    startup = await _make_startup(client, suffix="h")
    deal = await _create_deal(client, firm, startup, stage="data_room")
    resp = await client.patch(
        f"/api/v1/investors/deals/{deal['id']}",
        json={"stage": "diligence"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["stage"] == "diligence"
    # Invalid stage value is a 422.
    resp = await client.patch(
        f"/api/v1/investors/deals/{deal['id']}",
        json={"stage": "moonshot"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text
