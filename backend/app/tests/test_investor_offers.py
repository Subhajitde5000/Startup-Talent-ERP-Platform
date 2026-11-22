"""Step 9i tests: investor offers (versions + counters).

Covers the AGENTS.md section 7 definition of done: happy paths
(create/send/counter/accept/decline/withdraw/history + the startup-side
latest-version view), validation errors, 401, 403 (viewer), 404 (foreign
offer, foreign org, no investor firm), cross-organization reference
attempts (round on another startup, owner not a member), invalid status
transitions (409), lazy expiry, mass-assignment on server-controlled
fields, and the confidentiality rule that the startup-side read strips
the investor's private fields (notes, owner_id).
"""

import re
import uuid
from datetime import date, timedelta

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
    owner = await _signup_verified(client, f"off-invowner{suffix}@test.dev", role="investor")
    member = await _signup_verified(client, f"off-invmember{suffix}@test.dev", role="investor")
    viewer = await _signup_verified(client, f"off-invviewer{suffix}@test.dev", role="investor")
    org = await _create_org(client, owner, name=f"Zenith{suffix or ''}", type_="investor_firm")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"owner": owner, "member": member, "viewer": viewer, "org": org}


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    founder = await _signup_verified(client, f"off-founder{suffix}@test.dev", role="startup")
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


async def _create_offer(client: AsyncClient, firm: dict, round_id: str, **extra) -> dict:
    payload = {
        "round_id": round_id,
        "amount": "2500000.00",
        "instrument": "safe",
    }
    payload.update(extra)
    resp = await client.post(
        "/api/v1/investors/offers", json=payload, headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _user_id(client: AsyncClient, auth: dict) -> str:
    resp = await client.get("/api/v1/users/me", headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


# --- investor side ---------------------------------------------------------


async def test_offer_create_send_and_list(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="a")
    startup = await _make_startup(client, suffix="a")
    round_id = await _make_open_round(client, startup)

    offer = await _create_offer(
        client, firm, round_id,
        amount="2500000.00", currency="INR", instrument="safe",
        valuation_cap="10000000.00", discount_pct="10.00",
        owner_id=await _user_id(client, firm["owner"]),
        notes="Private negotiation note",
    )
    assert offer["version"] == 1
    assert offer["status"] == "draft"
    assert offer["amount"] == "2500000.00"
    assert offer["startup_name"] == startup["org"]["name"]

    # Send: draft -> sent.
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/send",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "sent"

    # List with status filter.
    resp = await client.get(
        "/api/v1/investors/offers",
        params={"status": "sent"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == offer["id"]
    assert body["items"][0]["notes"] == "Private negotiation note"

    # Member (not owner) may also read.
    resp = await client.get(
        "/api/v1/investors/offers", headers=firm["member"]["headers"]
    )
    assert resp.status_code == 200, resp.text


async def test_offer_counter_creates_new_version(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="b")
    startup = await _make_startup(client, suffix="b")
    round_id = await _make_open_round(client, startup)

    offer = await _create_offer(client, firm, round_id)
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/send",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text

    # Counter: new version, parent untouched.
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/counter",
        json={"amount": "3000000.00", "instrument": "equity", "valuation_cap": "12000000.00"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    countered = resp.json()
    assert countered["version"] == 2
    assert countered["status"] == "countered"
    assert countered["parent_offer_id"] == offer["id"]
    assert countered["amount"] == "3000000.00"

    # Parent keeps its status.
    resp = await client.get(
        f"/api/v1/investors/offers/{offer['id']}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "sent"

    # Version history: both versions, ordered.
    resp = await client.get(
        f"/api/v1/investors/offers/{offer['id']}/history",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    history = resp.json()
    assert history["total"] == 2
    assert [item["version"] for item in history["items"]] == [1, 2]


async def test_offer_accept_decline_and_withdraw(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="c")
    startup = await _make_startup(client, suffix="c")
    round_id = await _make_open_round(client, startup)

    offer = await _create_offer(client, firm, round_id)
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/send",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text

    # Startup accepts the latest version.
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/investor-offers/{offer['id']}/accept",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "accepted"
    # Startup-side read strips investor-private fields.
    assert "notes" not in resp.json()
    assert "owner_id" not in resp.json()

    # Terminal state: cannot send again.
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/send",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text

    # Decline path on a fresh offer.
    offer2 = await _create_offer(client, firm, round_id, amount="1000000.00")
    resp = await client.post(
        f"/api/v1/investors/offers/{offer2['id']}/send",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/investor-offers/{offer2['id']}/decline",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "declined"

    # Withdraw path on a fresh offer.
    offer3 = await _create_offer(client, firm, round_id, amount="500000.00")
    resp = await client.post(
        f"/api/v1/investors/offers/{offer3['id']}/withdraw",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 204, resp.text
    resp = await client.get(
        f"/api/v1/investors/offers/{offer3['id']}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "withdrawn"


async def test_offer_lazy_expiry(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="d")
    startup = await _make_startup(client, suffix="d")
    round_id = await _make_open_round(client, startup)

    past = (date.today() - timedelta(days=1)).isoformat()
    offer = await _create_offer(
        client, firm, round_id, expires_on=past
    )
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/send",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "sent"

    # Reading the offer marks it expired (lazy expiry).
    resp = await client.get(
        f"/api/v1/investors/offers/{offer['id']}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "expired"

    # Terminal: cannot accept an expired offer.
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/investor-offers/{offer['id']}/accept",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 409, resp.text


# --- authorization ---------------------------------------------------------


async def test_offer_401_without_token(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/investors/offers")
    assert resp.status_code == 401, resp.text


async def test_offer_viewer_read_only(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="e")
    startup = await _make_startup(client, suffix="e")
    round_id = await _make_open_round(client, startup)
    offer = await _create_offer(client, firm, round_id)

    resp = await client.get(
        f"/api/v1/investors/offers/{offer['id']}",
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/send",
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_offer_foreign_org_404(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="f")
    other = await _make_investor_firm(client, suffix="f2")
    startup = await _make_startup(client, suffix="f")
    round_id = await _make_open_round(client, startup)
    offer = await _create_offer(client, firm, round_id)

    # Another investor firm cannot see or touch this offer.
    resp = await client.get(
        f"/api/v1/investors/offers/{offer['id']}",
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/send",
        headers=other["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_offer_no_investor_firm_404(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="g")
    round_id = await _make_open_round(client, startup)
    resp = await client.post(
        "/api/v1/investors/offers",
        json={"round_id": round_id, "amount": "100.00", "instrument": "safe"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_offer_cross_org_round_reference(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="h")
    startup_a = await _make_startup(client, suffix="h")
    startup_b = await _make_startup(client, suffix="h2")
    round_a = await _make_open_round(client, startup_a)
    round_b = await _make_open_round(client, startup_b)

    # An offer must reference a live round; the round's org is the target.
    resp = await client.post(
        "/api/v1/investors/offers",
        json={"round_id": str(uuid.uuid4()), "amount": "100.00", "instrument": "safe"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # A round of another startup is a valid round (its org is the target
    # startup), but the startup-side view is scoped to the caller's org.
    offer = await _create_offer(client, firm, round_b)
    resp = await client.get(
        f"/api/v1/organizations/{startup_a['org']['id']}/investor-offers/{offer['id']}",
        headers=startup_a["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text

    # round_a is unused here but keeps both rounds live for the fixture.
    assert round_a


async def test_offer_owner_must_be_member(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="i")
    startup = await _make_startup(client, suffix="i")
    round_id = await _make_open_round(client, startup)
    outsider = await _signup_verified(client, "off-outsider@test.dev", role="investor")
    outsider_id = await _user_id(client, outsider)

    resp = await client.post(
        "/api/v1/investors/offers",
        json={
            "round_id": round_id,
            "amount": "100.00",
            "instrument": "safe",
            "owner_id": outsider_id,
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_offer_mass_assignment_rejected(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="j")
    startup = await _make_startup(client, suffix="j")
    round_id = await _make_open_round(client, startup)

    for extra in (
        {"status": "sent", "version": 99, "investor_org_id": str(uuid.uuid4())},
        {"parent_offer_id": str(uuid.uuid4())},
        {"id": str(uuid.uuid4())},
    ):
        resp = await client.post(
            "/api/v1/investors/offers",
            json={
                "round_id": round_id,
                "amount": "100.00",
                "instrument": "safe",
                **extra,
            },
            headers=firm["owner"]["headers"],
        )
        assert resp.status_code == 422, (extra, resp.text)


async def test_offer_startup_latest_version_only(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="k")
    startup = await _make_startup(client, suffix="k")
    round_id = await _make_open_round(client, startup)

    offer = await _create_offer(client, firm, round_id)
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/send",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    resp = await client.post(
        f"/api/v1/investors/offers/{offer['id']}/counter",
        json={"amount": "3000000.00", "instrument": "equity"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    countered_id = resp.json()["id"]

    # Startup list shows only the latest version.
    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-offers",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == countered_id
    assert body["items"][0]["version"] == 2
    assert "notes" not in body["items"][0]
    assert "owner_id" not in body["items"][0]

    # The old version is not directly reachable through the startup view.
    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investor-offers/{offer['id']}",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_offer_startup_foreign_org_404(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="l")
    startup = await _make_startup(client, suffix="l")
    other = await _make_startup(client, suffix="l2")
    round_id = await _make_open_round(client, startup)
    offer = await _create_offer(client, firm, round_id)

    resp = await client.get(
        f"/api/v1/organizations/{other['org']['id']}/investor-offers",
        headers=other["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 0

    resp = await client.get(
        f"/api/v1/organizations/{other['org']['id']}/investor-offers/{offer['id']}",
        headers=other["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_offer_validation_errors(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="m")
    startup = await _make_startup(client, suffix="m")
    round_id = await _make_open_round(client, startup)

    # amount must be > 0.
    resp = await client.post(
        "/api/v1/investors/offers",
        json={"round_id": round_id, "amount": "0", "instrument": "safe"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # discount_pct bounds.
    resp = await client.post(
        "/api/v1/investors/offers",
        json={
            "round_id": round_id,
            "amount": "100.00",
            "instrument": "safe",
            "discount_pct": "101.00",
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # Unknown instrument.
    resp = await client.post(
        "/api/v1/investors/offers",
        json={
            "round_id": round_id,
            "amount": "100.00",
            "instrument": "moon_token",
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text
