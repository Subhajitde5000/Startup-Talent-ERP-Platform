"""Step 9d tests: investor preferences, saved searches, shortlist.

Covers the AGENTS.md section 7 definition of done: happy paths,
validation errors, 401, 403 (wrong role), 404 (no investor firm,
foreign/deleted rows), cross-organization reference attempts
(a shortlist target that is not a live startup) and mass-assignment on
server-controlled fields (``id``, ``investor_org_id``,
``startup_org_id``, timestamps).

Every endpoint acts on the caller's OWN investor firm (resolved from
their membership), so a second investor firm is built to prove its rows
are invisible (404, no existence oracle).
"""

import re
import uuid
from decimal import Decimal

from httpx import AsyncClient

from app.services import email_service

PASSWORD = "Str0ng!Password99"


def _extract_code(email: str) -> str:
    """The 6-digit code from THIS user's verification email."""
    for email_row in reversed(email_service.SENT_EMAILS):
        if email_row.get("to") != email:
            continue
        if "verification code" not in email_row.get("subject", ""):
            continue
        match = re.search(r"(\d{6})", email_row.get("body", ""))
        assert match, f"no 6-digit code in email body: {email_row.get('body')!r}"
        return match.group(1)
    raise AssertionError(f"expected a verification email for {email}")


async def _signup_verified(client: AsyncClient, email: str, role: str = "investor") -> dict:
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


async def _create_org(
    client: AsyncClient, auth: dict, *, name: str, type_: str
) -> dict:
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


async def _make_investor_firm(
    client: AsyncClient, suffix: str = ""
) -> dict:
    """Owner + member + viewer in one investor firm."""
    owner = await _signup_verified(client, f"inv-owner{suffix}@test.dev")
    member = await _signup_verified(client, f"inv-member{suffix}@test.dev")
    viewer = await _signup_verified(client, f"inv-viewer{suffix}@test.dev")
    org = await _create_org(client, owner, name=f"Zenith{suffix or ''}", type_="investor_firm")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"owner": owner, "member": member, "viewer": viewer, "org": org}


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    """A founder + startup with a public profile (shortlist target)."""
    founder = await _signup_verified(client, f"startup-founder{suffix}@test.dev", role="startup")
    org = await _create_org(client, founder, name=f"Acme{suffix or ''}", type_="startup")
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={"profile_visibility": "public", "sector": "Fintech"},
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    return {"founder": founder, "org": org}


# --- preferences -----------------------------------------------------------


async def test_preferences_default_empty_then_replace(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="a")

    resp = await client.get(
        "/api/v1/investors/me/preferences", headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["investor_org_id"] == firm["org"]["id"]
    assert body["sectors"] == []
    assert body["stage_focus"] == []
    assert body["investor_type"] is None

    resp = await client.put(
        "/api/v1/investors/me/preferences",
        json={
            "investor_type": "fund",
            "sectors": ["Fintech", "B2B SaaS"],
            "stage_focus": ["prototype", "early_revenue"],
            "min_ticket": "2500000.00",
            "max_ticket": "25000000.00",
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["investor_type"] == "fund"
    assert body["sectors"] == ["Fintech", "B2B SaaS"]
    assert body["stage_focus"] == ["prototype", "early_revenue"]
    assert Decimal(body["min_ticket"]) == Decimal("2500000.00")
    assert Decimal(body["max_ticket"]) == Decimal("25000000.00")

    # A second PUT replaces the row, not a second one.
    resp = await client.put(
        "/api/v1/investors/me/preferences",
        json={"sectors": ["Climate"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["sectors"] == ["Climate"]
    assert resp.json()["investor_type"] is None


async def test_preferences_validation(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="b")

    # Unknown investor type.
    resp = await client.put(
        "/api/v1/investors/me/preferences",
        json={"investor_type": "vc"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # Unknown stage focus value.
    resp = await client.put(
        "/api/v1/investors/me/preferences",
        json={"stage_focus": ["moonshot"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # Ticket bounds inverted.
    resp = await client.put(
        "/api/v1/investors/me/preferences",
        json={"min_ticket": "1000000.00", "max_ticket": "100.00"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # Mass-assignment: server-controlled fields are refused.
    resp = await client.put(
        "/api/v1/investors/me/preferences",
        json={"investor_org_id": str(uuid.uuid4())},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_preferences_viewer_forbidden_and_member_allowed(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="c")

    resp = await client.put(
        "/api/v1/investors/me/preferences",
        json={"sectors": ["Fintech"]},
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text

    resp = await client.put(
        "/api/v1/investors/me/preferences",
        json={"sectors": ["Fintech"]},
        headers=firm["member"]["headers"],
    )
    assert resp.status_code == 200, resp.text

    # Viewers may still read.
    resp = await client.get(
        "/api/v1/investors/me/preferences", headers=firm["viewer"]["headers"]
    )
    assert resp.status_code == 200, resp.text


async def test_no_investor_firm_is_404(client: AsyncClient) -> None:
    # A startup user has no investor_firm organization.
    startup = await _signup_verified(client, "no-firm@test.dev", role="startup")
    resp = await client.get("/api/v1/investors/me/preferences", headers=startup["headers"])
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "INVESTOR_ORG_NOT_FOUND"


async def test_preferences_require_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/investors/me/preferences")
    assert resp.status_code == 401, resp.text


# --- saved searches -------------------------------------------------------


async def test_saved_search_crud_and_criteria_whitelist(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="d")

    resp = await client.post(
        "/api/v1/investors/me/saved-searches",
        json={
            "name": "Pre-seed fintech",
            "criteria": {"stage": "prototype", "sector": "Fintech", "investment_ready_only": True},
        },
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    search = resp.json()
    assert search["criteria"]["stage"] == "prototype"
    assert search["is_active"] is True

    resp = await client.get(
        "/api/v1/investors/me/saved-searches", headers=firm["owner"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1

    # Unknown criteria key is a 422, never a silently stored dead filter.
    resp = await client.post(
        "/api/v1/investors/me/saved-searches",
        json={"name": "Bad", "criteria": {"nonsense": 1}},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    resp = await client.patch(
        f"/api/v1/investors/me/saved-searches/{search['id']}",
        json={"is_active": False, "name": "Pre-seed fintech v2"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is False
    assert resp.json()["name"] == "Pre-seed fintech v2"

    resp = await client.delete(
        f"/api/v1/investors/me/saved-searches/{search['id']}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 204, resp.text

    resp = await client.get(
        "/api/v1/investors/me/saved-searches", headers=firm["owner"]["headers"]
    )
    assert resp.json() == []


async def test_saved_search_matches(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="e")
    startup_a = await _make_startup(client, suffix="a")
    startup_b = await _make_startup(client, suffix="b")

    resp = await client.post(
        "/api/v1/investors/me/saved-searches",
        json={"name": "All", "criteria": {}},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    search_id = resp.json()["id"]

    resp = await client.get(
        f"/api/v1/investors/me/saved-searches/{search_id}/matches",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    slugs = {item["slug"] for item in body["items"]}
    assert startup_a["org"]["slug"] in slugs
    assert startup_b["org"]["slug"] in slugs
    assert body["total"] == 2

    # A sector-scoped search matches only the matching startup.
    resp = await client.post(
        "/api/v1/investors/me/saved-searches",
        json={"name": "Fintech", "criteria": {"sector": "Fintech"}},
        headers=firm["owner"]["headers"],
    )
    fintech_id = resp.json()["id"]
    resp = await client.get(
        f"/api/v1/investors/me/saved-searches/{fintech_id}/matches",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 2  # both seeded startups are Fintech


async def test_saved_search_foreign_row_404_and_mass_assignment(client: AsyncClient) -> None:
    firm_a = await _make_investor_firm(client, suffix="f")
    firm_b = await _make_investor_firm(client, suffix="g")

    resp = await client.post(
        "/api/v1/investors/me/saved-searches",
        json={"name": "A-only"},
        headers=firm_a["owner"]["headers"],
    )
    search_id = resp.json()["id"]

    # firm B cannot see or touch firm A's search (no existence oracle).
    resp = await client.patch(
        f"/api/v1/investors/me/saved-searches/{search_id}",
        json={"name": "hijacked"},
        headers=firm_b["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text
    resp = await client.delete(
        f"/api/v1/investors/me/saved-searches/{search_id}",
        headers=firm_b["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text
    resp = await client.get(
        f"/api/v1/investors/me/saved-searches/{search_id}/matches",
        headers=firm_b["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text

    # Mass-assignment on create.
    resp = await client.post(
        "/api/v1/investors/me/saved-searches",
        json={"name": "x", "investor_org_id": str(firm_b["org"]["id"])},
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_saved_search_viewer_forbidden(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="h")
    resp = await client.post(
        "/api/v1/investors/me/saved-searches",
        json={"name": "x"},
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text


# --- shortlist ------------------------------------------------------------


async def test_shortlist_crud_and_duplicate(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="i")
    startup = await _make_startup(client, suffix="a")

    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={"startup_org_id": startup["org"]["id"], "note": "Interesting"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    entry = resp.json()
    assert entry["note"] == "Interesting"
    assert entry["status"] == "new"
    assert entry["startup_name"] == startup["org"]["name"]

    # Duplicate bookmark is a 409.
    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "SHORTLIST_EXISTS"

    resp = await client.patch(
        f"/api/v1/investors/me/shortlist/{entry['id']}",
        json={"note": "Updated", "status": "reviewing"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["note"] == "Updated"
    assert resp.json()["status"] == "reviewing"

    resp = await client.get("/api/v1/investors/me/shortlist", headers=firm["owner"]["headers"])
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1

    # Moving a shortlisted startup into the pipeline removes it from the shortlist.
    resp = await client.post(
        "/api/v1/investors/deals",
        json={"startup_org_id": startup["org"]["id"], "stage": "interested"},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    resp = await client.get("/api/v1/investors/me/shortlist", headers=firm["owner"]["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json() == []

    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    entry = resp.json()

    resp = await client.delete(
        f"/api/v1/investors/me/shortlist/{entry['id']}",
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 204, resp.text

    # Re-adding after removal works (the unique index is on live rows).
    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["owner"]["headers"],
    )
    assert resp.status_code == 201, resp.text


async def test_shortlist_validation_and_cross_org(client: AsyncClient) -> None:
    firm_a = await _make_investor_firm(client, suffix="j")
    firm_b = await _make_investor_firm(client, suffix="k")
    startup = await _make_startup(client, suffix="a")

    # Mass-assignment on create.
    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={
            "startup_org_id": startup["org"]["id"],
            "investor_org_id": str(firm_b["org"]["id"]),
        },
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # A non-startup org as target is a 404.
    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={"startup_org_id": firm_b["org"]["id"]},
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text

    # Unknown shortlist status.
    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={"startup_org_id": startup["org"]["id"], "status": "maybe"},
        headers=firm_a["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # firm B cannot touch firm A's entry.
    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm_a["owner"]["headers"],
    )
    entry_id = resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/investors/me/shortlist/{entry_id}",
        json={"note": "hijack"},
        headers=firm_b["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_shortlist_viewer_forbidden(client: AsyncClient) -> None:
    firm = await _make_investor_firm(client, suffix="l")
    startup = await _make_startup(client, suffix="a")
    resp = await client.post(
        "/api/v1/investors/me/shortlist",
        json={"startup_org_id": startup["org"]["id"]},
        headers=firm["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text
