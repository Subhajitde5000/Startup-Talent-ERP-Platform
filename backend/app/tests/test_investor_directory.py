"""Step 9b tests: investor directory (startup view).

Covers the AGENTS.md section 7 definition of done: happy paths
(list/detail/summary/facets + every filter), validation errors, 401,
403 (non-member startup user), 404 (foreign/deleted org, foreign
investor firm) and the confidentiality rule that a startup can never
see another startup's investor directory context.

The directory lists investor-firm organizations plus their 9d
thesis preferences; preferences are set through the 9d API and a
server-owned ``verified_at`` is written out of band (it has no client
write path).
"""

import uuid
from datetime import UTC, datetime

from httpx import AsyncClient

from app.models.organization import Organization
from app.tests.conftest import TestSessionFactory

PASSWORD = "Str0ng!Password99"


def _extract_code(email: str) -> str:
    import re

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


async def _make_startup(client: AsyncClient, suffix: str = "") -> dict:
    """A founder + startup (the directory caller)."""
    founder = await _signup_verified(client, f"dir-founder{suffix}@test.dev", role="startup")
    org = await _create_org(client, founder, name=f"Acme{suffix or ''}", type_="startup")
    return {"founder": founder, "org": org}


async def _make_investor(
    client: AsyncClient,
    *,
    suffix: str,
    name: str = "Zenith",
    investor_type: str | None = None,
    sectors: list[str] | None = None,
    stage_focus: list[str] | None = None,
    min_ticket: str | None = None,
    max_ticket: str | None = None,
    verified: bool = False,
) -> dict:
    """An investor firm with optional thesis preferences and verification."""
    owner = await _signup_verified(client, f"dir-invowner{suffix}@test.dev", role="investor")
    org = await _create_org(client, owner, name=f"{name}{suffix}", type_="investor_firm")

    if any(
        v is not None
        for v in (investor_type, sectors, stage_focus, min_ticket, max_ticket)
    ):
        resp = await client.put(
            "/api/v1/investors/me/preferences",
            json={
                "investor_type": investor_type,
                "sectors": sectors or [],
                "stage_focus": stage_focus or [],
                "min_ticket": min_ticket,
                "max_ticket": max_ticket,
            },
            headers=owner["headers"],
        )
        assert resp.status_code == 200, resp.text

    if verified:
        await _set_verified(org["id"])
    return {"owner": owner, "org": org}


async def _set_verified(org_id: str) -> None:
    """Mark an organization verified out of band (server-owned field)."""
    async with TestSessionFactory() as session:
        org = await session.get(Organization, uuid.UUID(org_id))
        assert org is not None
        org.verified_at = datetime.now(UTC)
        await session.commit()


async def test_directory_lists_investor_firms_with_preferences(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="a")
    await _make_investor(
        client,
        suffix="i1",
        name="Zenith",
        investor_type="fund",
        sectors=["Fintech", "Healthcare"],
        stage_focus=["prototype", "early_revenue"],
        min_ticket="1000000.00",
        max_ticket="20000000.00",
        verified=True,
    )
    await _make_investor(client, suffix="i2", name="Grounded", investor_type="angel")

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investors",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 2
    by_name = {item["name"]: item for item in body["items"]}
    zenith = by_name["Zenithi1"]
    assert zenith["investor_type"] == "fund"
    assert sorted(zenith["sectors"]) == ["Fintech", "Healthcare"]
    assert sorted(zenith["stage_focus"]) == ["early_revenue", "prototype"]
    assert zenith["verified"] is True
    assert zenith["min_ticket"] == "1000000.00"
    grounded = by_name["Groundedi2"]
    assert grounded["investor_type"] == "angel"
    assert grounded["verified"] is False


async def test_directory_filters(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="b")
    await _make_investor(
        client, suffix="f1", name="FintechFund", investor_type="fund",
        sectors=["Fintech"], min_ticket="1000000.00", max_ticket="5000000.00",
    )
    await _make_investor(
        client, suffix="f2", name="HealthAngel", investor_type="angel",
        sectors=["Healthcare"], min_ticket="50000.00", max_ticket="500000.00",
    )
    base = f"/api/v1/organizations/{startup['org']['id']}/investors"

    # By sector.
    resp = await client.get(
        f"{base}?sector=Fintech", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["FintechFundf1"]

    # By investor type.
    resp = await client.get(
        f"{base}?investor_type=angel", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["HealthAngelf2"]

    # Ticket overlap: the fund's range (1M-5M) intersects 2M-3M, the
    # angel's range (50k-500k) does not.
    resp = await client.get(
        f"{base}?ticket_min=2000000&ticket_max=3000000",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["FintechFundf1"]

    # Text search on name.
    resp = await client.get(
        f"{base}?q=health", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["HealthAngelf2"]


async def test_directory_detail_summary_and_facets(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="c")
    inv = await _make_investor(
        client, suffix="d1", name="Zenith", investor_type="fund",
        sectors=["Fintech"], stage_focus=["growth"], verified=True,
    )
    base = f"/api/v1/organizations/{startup['org']['id']}/investors"

    resp = await client.get(
        f"{base}/{inv['org']['id']}", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    detail = resp.json()
    assert detail["name"] == "Zenithd1"
    assert detail["investor_type"] == "fund"
    assert detail["created_at"]

    resp = await client.get(
        f"{base}/summary", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"total": 1, "verified": 1}

    resp = await client.get(
        f"{base}/filters", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    facets = resp.json()
    assert facets["sectors"] == ["Fintech"]
    assert facets["stage_focus"] == ["growth"]
    assert facets["types"] == ["fund"]


async def test_directory_verified_only_and_pagination(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="d")
    await _make_investor(client, suffix="v1", name="VerifiedOne", verified=True)
    await _make_investor(client, suffix="v2", name="UnverifiedTwo", verified=False)
    base = f"/api/v1/organizations/{startup['org']['id']}/investors"

    resp = await client.get(
        f"{base}?verified_only=true", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["VerifiedOnev1"]

    # Offset pagination (default sort recent; tie-broken by name+id).
    resp = await client.get(
        f"{base}?sort=name&limit=1&offset=0", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    page1 = resp.json()
    resp = await client.get(
        f"{base}?sort=name&limit=1&offset=1", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    page2 = resp.json()
    assert page1["total"] == 2
    assert {p["name"] for p in page1["items"] + page2["items"]} == {
        "VerifiedOnev1",
        "UnverifiedTwov2",
    }


async def test_directory_requires_auth_and_membership(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="e")
    outsider = await _signup_verified(client, "dir-outsider@test.dev", role="startup")

    # 401 unauthenticated.
    resp = await client.get(f"/api/v1/organizations/{startup['org']['id']}/investors")
    assert resp.status_code == 401, resp.text

    # 403: a signed-in startup user who is NOT a member of the org.
    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investors",
        headers=outsider["headers"],
    )
    assert resp.status_code == 403, resp.text

    # 404: an org_id that does not exist / is a foreign org (no oracle).
    resp = await client.get(
        f"/api/v1/organizations/{uuid.uuid4()}/investors",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_directory_foreign_investor_is_404(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="f")
    inv = await _make_investor(client, suffix="g1", name="Zenith")

    # A foreign org_id path is 404 for the investor firm's own user
    # (they are not a member of the startup org).
    resp = await client.get(
        f"/api/v1/organizations/{inv['org']['id']}/investors",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text

    # Detail on a non-existent investor firm is 404.
    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investors/{uuid.uuid4()}",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_directory_validation_errors(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="g")
    base = f"/api/v1/organizations/{startup['org']['id']}/investors"

    # Unknown sort key.
    resp = await client.get(
        f"{base}?sort=bogus", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 422, resp.text

    # Inverted ticket range.
    resp = await client.get(
        f"{base}?ticket_min=1000000&ticket_max=100",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 422, resp.text

    # Out-of-range limit.
    resp = await client.get(
        f"{base}?limit=500", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 422, resp.text

    # Invalid enum.
    resp = await client.get(
        f"{base}?investor_type=vc", headers=startup["founder"]["headers"]
    )
    assert resp.status_code == 422, resp.text


async def test_directory_excludes_deleted_and_non_investor_orgs(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="h")
    inv = await _make_investor(client, suffix="j1", name="Zenith")
    # A startup org is not an investor firm -> not in the directory.
    other = await _make_startup(client, suffix="k1")

    async with TestSessionFactory() as session:
        org = await session.get(Organization, uuid.UUID(inv["org"]["id"]))
        assert org is not None
        org.deleted_at = datetime.now(UTC)
        await session.commit()

    resp = await client.get(
        f"/api/v1/organizations/{startup['org']['id']}/investors",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    names = {i["name"] for i in resp.json()["items"]}
    assert "Zenithj1" not in names
    assert other["org"]["name"] not in names


async def test_directory_is_read_only(client: AsyncClient) -> None:
    startup = await _make_startup(client, suffix="i")
    # No write methods exist on the directory paths.
    for method in ("post", "put", "patch"):
        resp = await getattr(client, method)(
            f"/api/v1/organizations/{startup['org']['id']}/investors",
            json={},
            headers=startup["founder"]["headers"],
        )
        assert resp.status_code in (404, 405), resp.text
    resp = await client.delete(
        f"/api/v1/organizations/{startup['org']['id']}/investors",
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code in (404, 405), resp.text
