"""Step 9c tests: investor-side startup discovery.

Covers the AGENTS.md section 7 definition of done: happy paths (list,
detail, rounds, filters + every filter), validation errors, 401, and
the confidentiality/visibility rules — a startup that is not visible
is a 404 with no existence oracle, and round data is gated by the 5a
``round_public`` opt-in (rounds endpoint 404s for a caller the
startup did not opt in to).
"""

import re
import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.models.startup import StartupProfile
from app.tests.conftest import TestSessionFactory

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


async def _make_startup(
    client: AsyncClient,
    *,
    suffix: str,
    name: str = "Acme",
    visibility: str = "public",
    sector: str = "Fintech",
    stage: str = "growth",
) -> dict:
    founder = await _signup_verified(client, f"disc-founder{suffix}@test.dev", role="startup")
    org = await _create_org(client, founder, name=f"{name}{suffix}", type_="startup")
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        json={
            "profile_visibility": visibility,
            "sector": sector,
            "stage": stage,
            "tagline": f"Tagline {suffix}",
        },
        headers=founder["headers"],
    )
    assert resp.status_code == 200, resp.text
    return {"founder": founder, "org": org}


async def _set_stored_field(org_id: str, **values: object) -> None:
    """Write SERVER-CONTROLLED profile columns out of band."""
    async with TestSessionFactory() as session:
        profile = (
            await session.execute(
                select(StartupProfile).where(StartupProfile.org_id == uuid.UUID(org_id))
            )
        ).scalar_one()
        for key, value in values.items():
            setattr(profile, key, value)
        await session.commit()


async def _make_open_round(client: AsyncClient, startup: dict, *, name: str, target: str) -> dict:
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/funding-rounds",
        json={"name": name, "round_type": "seed", "target_amount": target, "currency": "INR"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 201, resp.text
    round_id = resp.json()["id"]
    # Move it to open (draft is the default; only open/paused count as raised).
    resp = await client.post(
        f"/api/v1/organizations/{startup['org']['id']}/funding-rounds/{round_id}/status",
        json={"status": "open"},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _enable_round_public(client: AsyncClient, startup: dict) -> None:
    resp = await client.patch(
        f"/api/v1/organizations/{startup['org']['id']}/startup-profile",
        json={"round_public": True},
        headers=startup["founder"]["headers"],
    )
    assert resp.status_code == 200, resp.text


async def _make_investor_viewer(client: AsyncClient, suffix: str = "v") -> dict:
    return await _signup_verified(client, f"disc-inv{suffix}@test.dev", role="investor")


async def test_list_startups_visible_to_investor(client: AsyncClient) -> None:
    viewer = await _make_investor_viewer(client, "l")
    a = await _make_startup(client, suffix="a", name="Alpha", sector="Fintech", stage="growth")
    b = await _make_startup(client, suffix="b", name="Beta", sector="Healthcare", stage="early_revenue")
    # A private startup is not visible.
    await _make_startup(client, suffix="c", name="Secret", visibility="private")

    resp = await client.get("/api/v1/investors/startups", headers=viewer["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 2
    slugs = {i["slug"] for i in body["items"]}
    assert a["org"]["slug"] in slugs
    assert b["org"]["slug"] in slugs

    by_slug = {i["slug"]: i for i in body["items"]}
    item = by_slug[a["org"]["slug"]]
    assert item["sector"] == "Fintech"
    assert item["investment_ready"] is False  # not mentor-verified yet


async def test_list_startups_filters(client: AsyncClient) -> None:
    viewer = await _make_investor_viewer(client, "f")
    await _make_startup(client, suffix="a", name="Alpha", sector="Fintech", stage="growth")
    await _make_startup(client, suffix="b", name="Beta", sector="Healthcare", stage="early_revenue")

    base = "/api/v1/investors/startups"
    resp = await client.get(f"{base}?sector=Fintech", headers=viewer["headers"])
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["Alphaa"]

    resp = await client.get(f"{base}?stage=early_revenue", headers=viewer["headers"])
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["Betab"]

    resp = await client.get(f"{base}?q=alpha", headers=viewer["headers"])
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["Alphaa"]

    resp = await client.get(f"{base}?sort=name&order=asc", headers=viewer["headers"])
    assert resp.status_code == 200, resp.text
    names = [i["name"] for i in resp.json()["items"]]
    assert names == sorted(names)


async def test_investment_ready_only_filter(client: AsyncClient) -> None:
    viewer = await _make_investor_viewer(client, "r")
    ready = await _make_startup(client, suffix="r", name="Ready", sector="Fintech")
    not_ready = await _make_startup(client, suffix="n", name="NotReady", sector="Fintech")

    # Mark one mentor-verified + readiness >= 70 out of band.
    await _set_stored_field(ready["org"]["id"], mentor_verified=True, readiness_score=75)
    await _set_stored_field(not_ready["org"]["id"], mentor_verified=False, readiness_score=40)

    resp = await client.get(
        "/api/v1/investors/startups?investment_ready_only=true",
        headers=viewer["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert [i["name"] for i in resp.json()["items"]] == ["Readyr"]

    # The item flag reflects the same definition.
    resp = await client.get("/api/v1/investors/startups", headers=viewer["headers"])
    assert resp.status_code == 200, resp.text
    by_name = {i["name"]: i for i in resp.json()["items"]}
    assert by_name["Readyr"]["investment_ready"] is True
    assert by_name["NotReadyn"]["investment_ready"] is False


async def test_detail_and_rounds_round_public_gating(client: AsyncClient) -> None:
    viewer = await _make_investor_viewer(client, "d")
    startup = await _make_startup(client, suffix="a", name="Alpha", sector="Fintech")
    await _enable_round_public(client, startup)
    await _make_open_round(client, startup, name="Seed Round", target="5000000.00")

    resp = await client.get(
        f"/api/v1/investors/startups/{startup['org']['slug']}",
        headers=viewer["headers"],
    )
    assert resp.status_code == 200, resp.text
    detail = resp.json()
    assert detail["name"] == "Alphaa"
    assert detail["round_visible"] is True
    assert detail["round_target"] == "5000000.00"
    assert detail["round_currency"] == "INR"

    resp = await client.get(
        f"/api/v1/investors/startups/{startup['org']['slug']}/rounds",
        headers=viewer["headers"],
    )
    assert resp.status_code == 200, resp.text
    rounds = resp.json()
    assert rounds["total"] == 1
    assert rounds["items"][0]["name"] == "Seed Round"
    assert rounds["items"][0]["status"] == "open"

    # A second startup with round_public OFF: detail is visible, but
    # round data is hidden and the rounds endpoint is a 404.
    hidden = await _make_startup(client, suffix="b", name="Beta", sector="Fintech")
    resp = await client.get(
        f"/api/v1/investors/startups/{hidden['org']['slug']}",
        headers=viewer["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["round_visible"] is False
    assert resp.json()["round_target"] is None
    assert resp.json()["round_currency"] is None

    resp = await client.get(
        f"/api/v1/investors/startups/{hidden['org']['slug']}/rounds",
        headers=viewer["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_detail_by_uuid_and_invisible_is_404(client: AsyncClient) -> None:
    viewer = await _make_investor_viewer(client, "u")
    startup = await _make_startup(client, suffix="a", name="Alpha", sector="Fintech")

    # UUID identifier works too.
    resp = await client.get(
        f"/api/v1/investors/startups/{startup['org']['id']}",
        headers=viewer["headers"],
    )
    assert resp.status_code == 200, resp.text

    # A private startup detail is a 404 (no existence oracle).
    private = await _make_startup(client, suffix="p", name="Private", visibility="private")
    resp = await client.get(
        f"/api/v1/investors/startups/{private['org']['slug']}",
        headers=viewer["headers"],
    )
    assert resp.status_code == 404, resp.text

    # Unknown identifier is a 404.
    resp = await client.get(
        f"/api/v1/investors/startups/{uuid.uuid4()}", headers=viewer["headers"]
    )
    assert resp.status_code == 404, resp.text


async def test_filters_facets(client: AsyncClient) -> None:
    viewer = await _make_investor_viewer(client, "x")
    await _make_startup(client, suffix="a", name="Alpha", sector="Fintech", stage="growth")
    await _make_startup(client, suffix="b", name="Beta", sector="Healthcare", stage="early_revenue")

    resp = await client.get("/api/v1/investors/startups/filters", headers=viewer["headers"])
    assert resp.status_code == 200, resp.text
    facets = resp.json()
    assert sorted(facets["stages"]) == ["early_revenue", "growth"]
    assert sorted(facets["sectors"]) == ["Fintech", "Healthcare"]


async def test_discovery_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/investors/startups")
    assert resp.status_code == 401, resp.text


async def test_discovery_validation_errors(client: AsyncClient) -> None:
    viewer = await _make_investor_viewer(client, "v")
    resp = await client.get("/api/v1/investors/startups?limit=500", headers=viewer["headers"])
    assert resp.status_code == 422, resp.text
    resp = await client.get("/api/v1/investors/startups?stage=moonshot", headers=viewer["headers"])
    assert resp.status_code == 422, resp.text
    resp = await client.get("/api/v1/investors/startups?sort=bogus", headers=viewer["headers"])
    assert resp.status_code == 422, resp.text
