"""Step 5a tests: startup profile, permissions, visibility gates.

Covers happy path / validation / authentication / authorization (wrong
role, wrong organization), cross-organization access, the public-vs-private
gates and mass-assignment attempts on server-controlled fields, per
AGENTS.md section 7 and the 5a plan.
"""

import re
import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.services import email_service

PASSWORD = "Str0ng!Password99"


def _extract_code() -> str:
    assert email_service.SENT_EMAILS, "expected a verification email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"(\d{6})", body)
    assert match, f"no 6-digit code in email body: {body!r}"
    return match.group(1)


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
    code = _extract_code()
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
    client: AsyncClient, auth: dict, *, name: str = "Acme Rockets", type_: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": type_},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _get_profile(client: AsyncClient, auth: dict, org_id: str, expect: int = 200) -> dict:
    resp = await client.get(
        f"/api/v1/organizations/{org_id}/startup-profile", headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json()


async def _patch_profile(
    client: AsyncClient, auth: dict, org_id: str, payload: dict, expect: int = 200
) -> dict:
    resp = await client.patch(
        f"/api/v1/organizations/{org_id}/startup-profile",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


# --- member reads and writes ------------------------------------------------


@pytest.mark.asyncio
async def test_member_get_creates_default_profile(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)

    body = await _get_profile(client, auth, org["id"])
    assert body["org_id"] == org["id"]
    assert body["stage"] == "idea"
    assert body["profile_visibility"] == "mentors_and_investors"
    assert body["summary_public"] is True
    assert body["funding_public"] is False
    assert body["contacts_public"] is False
    assert body["ecosystem_goals"] == []
    assert body["mentor_verified"] is False
    assert body["readiness_score"] is None

    # created on demand exactly once: a second read returns the same row
    again = await _get_profile(client, auth, org["id"])
    assert again["org_id"] == body["org_id"]
    assert again["created_at"] == body["created_at"]


@pytest.mark.asyncio
async def test_member_patch_happy_and_persists(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder2@example.com")
    org = await _create_org(client, auth)

    payload = {
        "tagline": "Making finance effortless.",
        "stage": "growth",
        "sector": "Fintech",
        "business_model": "B2B SaaS",
        "problem": "Spreadsheets everywhere.",
        "solution": "One live workspace.",
        "market": "SMB finance · India first",
        "traction_summary": "₹4.8L MRR",
        "mrr_range": "₹4L - ₹10L",
        "funding_status": "Bootstrapped",
        "pitch_deck_url": "https://example.com/deck",
        "dpiit_status": "Applied / In Review",
        "legal_entity": "Private Limited (Pvt Ltd)",
        "demo_url": "https://app.example.com",
        "actively_raising": "Yes — currently raising",
        "target_raise": "₹1.5 Crores (~$180k)",
        "ecosystem_goals": ["Raise Seed Funding", "  Find Mentors  "],
        "profile_visibility": "public",
        "contacts_public": True,
        "funding_public": True,
    }
    body = await _patch_profile(client, auth, org["id"], payload)
    assert body["stage"] == "growth"
    assert body["profile_visibility"] == "public"
    assert body["contacts_public"] is True
    assert body["funding_public"] is True
    # blank text clears; goals are cleaned
    body = await _patch_profile(client, auth, org["id"], {"tagline": "   "})
    assert body["tagline"] is None
    assert body["sector"] == "Fintech"  # omitted key unchanged

    stored = await _get_profile(client, auth, org["id"])
    assert stored["stage"] == "growth"
    assert stored["ecosystem_goals"] == ["Raise Seed Funding", "Find Mentors"]
    assert stored["legal_entity"] == "Private Limited (Pvt Ltd)"
    assert stored["demo_url"] == "https://app.example.com"
    assert stored["actively_raising"] == "Yes — currently raising"
    assert stored["target_raise"] == "₹1.5 Crores (~$180k)"


@pytest.mark.asyncio
async def test_preview_reflects_visibility(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder3@example.com")
    org = await _create_org(client, auth, name="Preview Labs")
    await _patch_profile(
        client, auth, org["id"], {"summary_public": True, "traction_public": True}
    )
    # org summary lives on the organization (single source of truth)
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}",
        json={"summary": "We build things."},
        headers=auth["headers"],
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/startup-profile/preview",
        headers=auth["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["visible_to_public"] is False  # default visibility is mentors_and_investors
    assert body["summary"] is None
    assert body["problem"] is None
    assert body["tagline"] is None  # core present but empty by default

    await _patch_profile(client, auth, org["id"], {"profile_visibility": "public"})
    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/startup-profile/preview",
        headers=auth["headers"],
    )
    body = resp.json()
    assert body["visible_to_public"] is True
    assert body["summary"] == "We build things."


# --- public read ------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_read_happy(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder4@example.com")
    org = await _create_org(client, auth, name="Public Labs")
    await _patch_profile(
        client,
        auth,
        org["id"],
        {
            "tagline": "Public tagline",
            "stage": "prototype",
            "sector": "SaaS",
            "problem": "P",
            "solution": "S",
            "market": "M",
            "business_model": "B2B",
            "traction_summary": "10 customers",
            "profile_visibility": "public",
        },
    )

    resp = await client.get(f"/api/v1/public/startups/{org['slug']}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "Public Labs"
    assert body["slug"] == org["slug"]
    assert body["visible_to_public"] is True
    assert body["tagline"] == "Public tagline"
    assert body["stage"] == "prototype"
    assert body["problem"] == "P"
    assert body["traction_summary"] == "10 customers"


@pytest.mark.asyncio
async def test_public_read_section_toggles(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder5@example.com")
    org = await _create_org(client, auth, name="Toggle Labs")
    await _patch_profile(
        client,
        auth,
        org["id"],
        {
            "tagline": "Keep me",
            "problem": "Hidden problem",
            "traction_summary": "Hidden traction",
            "profile_visibility": "public",
            "summary_public": False,
            "traction_public": False,
        },
    )

    body = (await client.get(f"/api/v1/public/startups/{org['slug']}")).json()
    assert body["tagline"] == "Keep me"  # core survives the toggles
    assert body["problem"] is None
    assert body["solution"] is None
    assert body["market"] is None
    assert body["business_model"] is None
    assert body["summary"] is None
    assert body["traction_summary"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "visibility", ["private", "mentors", "mentors_and_investors"]
)
async def test_public_read_hidden_for_non_public_visibility(
    client: AsyncClient, visibility: str
) -> None:
    auth = await _signup_verified(client, f"founder-{visibility}@example.com")
    org = await _create_org(client, auth, name=f"Hidden {visibility}")
    await _patch_profile(client, auth, org["id"], {"profile_visibility": visibility})

    resp = await client.get(f"/api/v1/public/startups/{org['slug']}")
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_public_read_unknown_slug_404(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/public/startups/no-such-startup")
    assert resp.status_code == 404


# --- authentication and authorization ---------------------------------------


@pytest.mark.asyncio
async def test_member_endpoints_require_auth(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder6@example.com")
    org = await _create_org(client, auth)
    for method, path in (
        ("get", f"/api/v1/organizations/{org['id']}/startup-profile"),
        ("patch", f"/api/v1/organizations/{org['id']}/startup-profile"),
        ("get", f"/api/v1/organizations/{org['id']}/startup-profile/preview"),
    ):
        if method == "patch":
            resp = await client.patch(path, json={})
        else:
            resp = await client.get(path)
        assert resp.status_code == 401, (path, resp.text)


@pytest.mark.asyncio
async def test_non_member_forbidden(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    outsider = await _signup_verified(client, "outsider@example.com")

    await _get_profile(client, outsider, org["id"], expect=403)
    await _patch_profile(client, outsider, org["id"], {"tagline": "x"}, expect=403)
    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/startup-profile/preview",
        headers=outsider["headers"],
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_viewer_reads_but_cannot_patch(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner2@example.com")
    org = await _create_org(client, owner)
    viewer = await _signup_verified(client, "viewer@example.com")

    # invite the viewer (owner -> member invite with viewer role)
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": viewer["email"], "role": "viewer"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["token"]
    accept = await client.post(
        f"/api/v1/invites/{token}/accept", headers=viewer["headers"]
    )
    assert accept.status_code == 200, accept.text

    await _get_profile(client, viewer, org["id"], expect=200)
    await _patch_profile(client, viewer, org["id"], {"tagline": "nope"}, expect=403)


@pytest.mark.asyncio
async def test_cross_org_forbidden(client: AsyncClient) -> None:
    a = await _signup_verified(client, "member-a@example.com")
    b = await _signup_verified(client, "member-b@example.com")
    org_a = await _create_org(client, a, name="Org A")
    org_b = await _create_org(client, b, name="Org B")

    # A is a full member of Org A but has no membership in Org B.
    await _get_profile(client, a, org_a["id"], expect=200)
    await _get_profile(client, a, org_b["id"], expect=403)
    await _patch_profile(client, a, org_b["id"], {"tagline": "idor"}, expect=403)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("type_", "role"),
    [("employer", "employer"), ("investor_firm", "investor")],
)
async def test_non_startup_org_404(
    client: AsyncClient, type_: str, role: str
) -> None:
    auth = await _signup_verified(client, f"{type_}@example.com", role=role)
    org = await _create_org(client, auth, name=f"Not A Startup {type_}", type_=type_)
    await _get_profile(client, auth, org["id"], expect=404)
    await _patch_profile(client, auth, org["id"], {"tagline": "x"}, expect=404)


@pytest.mark.asyncio
async def test_deleted_and_suspended_org_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    auth = await _signup_verified(client, "founder7@example.com")
    org = await _create_org(client, auth, name="Doomed Labs")

    result = await db_session.execute(
        select(Organization).where(Organization.id == uuid.UUID(org["id"]))
    )
    row = result.scalar_one()
    row.status = "suspended"
    await db_session.commit()
    await _get_profile(client, auth, org["id"], expect=404)

    row.status = "active"
    row.deleted_at = datetime.now(UTC)
    await db_session.commit()
    await _get_profile(client, auth, org["id"], expect=404)


# --- validation and mass assignment -----------------------------------------


@pytest.mark.asyncio
async def test_validation_bad_stage(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder8@example.com")
    org = await _create_org(client, auth)
    # 'scaling' is a frontend-only label; the API accepts schema values only
    # (phase B maps scaling -> growth before sending).
    await _patch_profile(client, auth, org["id"], {"stage": "scaling"}, expect=422)
    await _patch_profile(client, auth, org["id"], {"stage": "early-revenue"}, expect=422)


@pytest.mark.asyncio
async def test_validation_bad_visibility_and_long_tagline(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder9@example.com")
    org = await _create_org(client, auth)
    await _patch_profile(
        client, auth, org["id"], {"profile_visibility": "friends"}, expect=422
    )
    await _patch_profile(
        client, auth, org["id"], {"tagline": "x" * 201}, expect=422
    )
    # migration0007 gap columns: length-capped like the rest
    await _patch_profile(
        client, auth, org["id"], {"legal_entity": "x" * 101}, expect=422
    )
    await _patch_profile(
        client, auth, org["id"], {"demo_url": "x" * 501}, expect=422
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("mentor_verified", True),
        ("readiness_score", 100),
        ("org_id", "00000000-0000-0000-0000-000000000001"),
        ("created_at", "2020-01-01T00:00:00Z"),
        ("updated_at", "2020-01-01T00:00:00Z"),
    ],
)
async def test_mass_assignment_server_controlled_fields(
    client: AsyncClient, field: str, value: object
) -> None:
    auth = await _signup_verified(client, "founder10@example.com")
    org = await _create_org(client, auth)
    await _patch_profile(client, auth, org["id"], {field: value}, expect=422)

    stored = await _get_profile(client, auth, org["id"])
    assert stored["mentor_verified"] is False
    assert stored["readiness_score"] is None
    assert stored["org_id"] == org["id"]
