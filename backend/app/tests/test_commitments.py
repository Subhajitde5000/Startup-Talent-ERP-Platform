"""Step 9j tests: commitments and portfolio holdings.

Covers the AGENTS.md section 7 definition of done: happy paths
(commitment create/status transitions/funding, holding create/status
transitions), validation errors, 401, 403 (viewer), 404 (foreign row,
foreign org, no investor firm), cross-organization reference attempts
(round on another startup, offer of another firm, commitment of another
firm, self-holding), invalid status transitions (409), mass-assignment
on server-controlled fields, and the round ``committed_amount``
bookkeeping (create adds, cancel subtracts, floor at zero).
"""

import re
import uuid
from datetime import date
from decimal import Decimal

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
    owner = await _signup_verified(client, f"cm-invowner{suffix}@test.dev", role="investor")
    member = await _signup_verified(client, f"cm-invmember{suffix}@test.dev", role="investor")
    viewer = await _signup_verified(client, f"cm-invviewer{suffix}@test.dev", role="investor")
    org = await _create_org(client, owner, name=f"Zenith{suffix or ''}", type_="investor_firm")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"owner": owner, "member": member, "viewer": viewer, "org": org}


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    founder = await _signup_verified(client, f"cm-founder{suffix}@test.dev", role="startup")
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


async def _create_commitment(client: AsyncClient, firm: dict, round_id: str, **extra) -> dict:
    payload = {"round_id": round_id, "amount": "1000000.00"}
    payload.update(extra)
    resp = await client.post(
        "/api/v1/investors/commitments", json=payload, headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_holding(client: AsyncClient, firm: dict, startup_org_id: str, **extra) -> dict:
    payload = {
        "startup_org_id": startup_org_id,
        "instrument": "equity",
        "invested_amount": "1000000.00",
    }
    payload.update(extra)
    resp = await client.post(
        "/api/v1/investors/portfolio", json=payload, headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- commitments -----------------------------------------------------------


async def test_commitment_lifecycle_and_round_progress(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="a")
    startup = await _make_startup(client, suffix="a")
    round_id = await _make_open_round(client, startup)

    commitment = await _create_commitment(
        client, firm, round_id,
        amount="1000000.00", currency="INR", committed_on=date.today().isoformat(),
        reference="Wire ref 1",
    )
    assert commitment["status"] == "pledged"
    assert commitment["amount"] == "1000000.00"
    assert commitment["startup_name"] == startup["org"]["name"]

    # The round's committed_amount grows by the pledge (9a plan D2).
    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/funding-rounds/{round_id}",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["committed_amount"]) == Decimal("1000000.00")

    # pledged -> documented -> funded.
    resp = await client.post(
        f"/api/v1/investors/commitments/{commitment['id']}/status",
        json={"status": "documented"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "documented"

    resp = await client.post(
        f"/api/v1/investors/commitments/{commitment['id']}/status",
        json={"status": "funded"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    funded = resp.json()
    assert funded["status"] == "funded"
    assert funded["wired_at"] is not None
    assert funded["funded_on"] is not None

    # Terminal: cannot transition a funded commitment.
    resp = await client.post(
        f"/api/v1/investors/commitments/{commitment['id']}/status",
        json={"status": "cancelled"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text


async def test_commitment_cancel_subtracts_round_progress(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="b")
    startup = await _make_startup(client, suffix="b")
    round_id = await _make_open_round(client, startup)

    commitment = await _create_commitment(client, firm, round_id, amount="1000000.00")
    resp = await client.post(
        f"/api/v1/investors/commitments/{commitment['id']}/status",
        json={"status": "cancelled"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/funding-rounds/{round_id}",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["committed_amount"]) == Decimal("0")


async def test_commitment_offer_ref_validation(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="c")
    startup = await _make_startup(client, suffix="c")
    round_id = await _make_open_round(client, startup)

    # Create an offer first so a valid ref exists.
    resp = await client.post(
        "/api/v1/investors/offers",
        json={"round_id": round_id, "amount": "500000.00", "instrument": "safe"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    offer_id = resp.json()["id"]

    commitment = await _create_commitment(
        client, firm, round_id, offer_id=offer_id
    )
    assert commitment["offer_id"] == offer_id

    # An offer of another firm on the same round is rejected.
    other = await _make_investor_firm(client, suffix="c2")
    resp = await client.post(
        "/api/v1/investors/offers",
        json={"round_id": round_id, "amount": "500000.00", "instrument": "safe"},
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    other_offer_id = resp.json()["id"]
    resp = await client.post(
        "/api/v1/investors/commitments",
        json={"round_id": round_id, "amount": "100.00", "offer_id": other_offer_id},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


# --- holdings --------------------------------------------------------------


async def test_holding_lifecycle(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="d")
    startup = await _make_startup(client, suffix="d")

    holding = await _create_holding(
        client, firm, startup["org"]["id"],
        instrument="equity", invested_amount="1000000.00",
        currency="INR", ownership_pct="5.5000", invested_on=date.today().isoformat(),
    )
    assert holding["status"] == "active"
    assert holding["invested_amount"] == "1000000.00"
    assert holding["ownership_pct"] == "5.5000"
    assert holding["startup_name"] == startup["org"]["name"]

    # active -> exited (with exit details).
    resp = await client.post(
        f"/api/v1/investors/portfolio/{holding['id']}/status",
        json={"status": "exited", "exited_on": date.today().isoformat(), "exit_value": "2500000.00"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    exited = resp.json()
    assert exited["status"] == "exited"
    assert exited["exited_on"] is not None
    assert exited["exit_value"] == "2500000.00"

    # Terminal: cannot re-activate.
    resp = await client.post(
        f"/api/v1/investors/portfolio/{holding['id']}/status",
        json={"status": "active"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text


async def test_holding_self_reference_rejected(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="e")
    resp = await client.post(
        "/api/v1/investors/portfolio",
        json={
            "startup_org_id": firm["org"]["id"],
            "instrument": "equity",
            "invested_amount": "100.00",
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_holding_commitment_ref_validation(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="f")
    startup = await _make_startup(client, suffix="f")
    other = await _make_investor_firm(client, suffix="f2")
    round_id = await _make_open_round(client, startup)

    commitment = await _create_commitment(client, firm, round_id, amount="100.00")
    resp = await client.post(
        "/api/v1/investors/portfolio",
        json={
            "startup_org_id": startup["org"]["id"],
            "instrument": "equity",
            "invested_amount": "100.00",
            "commitment_id": commitment["id"],
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["commitment_id"] == commitment["id"]

    # A commitment of another firm is rejected.
    other_commitment = await _create_commitment(client, other, round_id, amount="100.00")
    resp = await client.post(
        "/api/v1/investors/portfolio",
        json={
            "startup_org_id": startup["org"]["id"],
            "instrument": "equity",
            "invested_amount": "100.00",
            "commitment_id": other_commitment["id"],
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


# --- authorization ---------------------------------------------------------


async def test_commitment_401_without_token(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/investors/commitments")
    assert resp.status_code == 401, resp.text
    resp = await client.get("/api/v1/investors/portfolio")
    assert resp.status_code == 401, resp.text


async def test_commitment_viewer_read_only(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="g")
    startup = await _make_startup(client, suffix="g")
    round_id = await _make_open_round(client, startup)
    commitment = await _create_commitment(client, firm, round_id)

    resp = await client.get(
        f"/api/v1/investors/commitments/{commitment['id']}",
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        f"/api/v1/investors/commitments/{commitment['id']}/status",
        json={"status": "documented"},
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_commitment_foreign_org_404(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="h")
    other = await _make_investor_firm(client, suffix="h2")
    startup = await _make_startup(client, suffix="h")
    round_id = await _make_open_round(client, startup)
    commitment = await _create_commitment(client, firm, round_id)

    resp = await client.get(
        f"/api/v1/investors/commitments/{commitment['id']}",
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text
    resp = await client.post(
        f"/api/v1/investors/commitments/{commitment['id']}/status",
        json={"status": "documented"},
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_commitment_no_investor_firm_404(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="i")
    round_id = await _make_open_round(client, startup)
    resp = await client.post(
        "/api/v1/investors/commitments",
        json={"round_id": round_id, "amount": "100.00"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_commitment_mass_assignment_rejected(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="j")
    startup = await _make_startup(client, suffix="j")
    round_id = await _make_open_round(client, startup)

    for extra in (
        {"status": "funded", "investor_org_id": str(uuid.uuid4())},
        {"id": str(uuid.uuid4())},
    ):
        resp = await client.post(
            "/api/v1/investors/commitments",
            json={"round_id": round_id, "amount": "100.00", **extra},
            headers=firm["owner"]["headers"],
        )
        assert resp.status_code == 422, (extra, resp.text)

    # Status is not writable via PATCH either.
    commitment = await _create_commitment(client, firm, round_id)
    resp = await client.patch(
        f"/api/v1/investors/commitments/{commitment['id']}",
        json={"status": "funded"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_commitment_validation_errors(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="k")
    startup = await _make_startup(client, suffix="k")
    round_id = await _make_open_round(client, startup)

    # amount must be > 0.
    resp = await client.post(
        "/api/v1/investors/commitments",
        json={"round_id": round_id, "amount": "0"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # Unknown round.
    resp = await client.post(
        "/api/v1/investors/commitments",
        json={"round_id": str(uuid.uuid4()), "amount": "100.00"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # ownership_pct bounds on holdings.
    resp = await client.post(
        "/api/v1/investors/portfolio",
        json={
            "startup_org_id": startup["org"]["id"],
            "instrument": "equity",
            "invested_amount": "100.00",
            "ownership_pct": "101.0000",
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text
