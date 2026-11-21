"""Step 9b directory: visibility, access, safe output, filters and limits."""
import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization, OrgType
from app.services.rate_limiter import rate_limiter
from app.tests.test_milestones import _create_org, _invite_member, _signup_verified


def base(org: dict) -> str:
    return f"/api/v1/organizations/{org['id']}/investors"


async def add_org(
    db: AsyncSession, *, name: str, slug: str, verified: bool = True,
    status: str = "active", type_: OrgType = OrgType.investor_firm,
    city: str = "Kolkata", country: str = "IN", deleted: bool = False,
) -> Organization:
    row = Organization(
        id=uuid.uuid4(), name=name, slug=slug, type=type_, status=status,
        verified_at=datetime.now(UTC) if verified else None,
        deleted_at=datetime.now(UTC) if deleted else None,
        city=city, country=country, summary="Public description",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def test_directory_visibility_search_pagination_and_safe_fields(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await _signup_verified(client, "founder9b@example.com")
    startup = await _create_org(client, owner)
    a = await add_org(db_session, name="Alpha Ventures", slug="alpha-ventures")
    b = await add_org(db_session, name="Beta Capital", slug="beta-capital", city="Mumbai")
    hidden = [
        await add_org(db_session, name="Unverified", slug="unverified", verified=False),
        await add_org(db_session, name="Suspended", slug="suspended", status="suspended"),
        await add_org(db_session, name="Deleted", slug="deleted", deleted=True),
        await add_org(db_session, name="Other type", slug="other-type", type_=OrgType.employer),
    ]
    res = await client.get(base(startup), headers=owner["headers"], params={"limit": 1})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total"] == 2 and body["limit"] == 1 and body["offset"] == 0
    assert body["items"][0]["id"] == str(a.id)
    assert set(body["items"][0]) == {"id", "name", "slug", "summary", "logo_url", "logo_initials", "website", "city", "region", "country", "founded_year", "verified"}
    assert body["items"][0]["verified"] is True
    second = await client.get(base(startup), headers=owner["headers"], params={"limit": 1, "offset": 1})
    assert second.json()["items"][0]["id"] == str(b.id)
    for params, expected in [({"q": "alpha kolkata"}, [str(a.id)]), ({"city": "mUmBaI"}, [str(b.id)]), ({"country": "IN"}, [str(a.id), str(b.id)]), ({"q": "%"}, [])]:
        result = await client.get(base(startup), headers=owner["headers"], params=params)
        assert [x["id"] for x in result.json()["items"]] == expected
    detail = await client.get(f"{base(startup)}/{a.id}", headers=owner["headers"])
    assert detail.status_code == 200 and detail.json() == body["items"][0]
    for row in hidden:
        result = await client.get(f"{base(startup)}/{row.id}", headers=owner["headers"])
        assert result.status_code == 404
    assert (await client.get(f"{base(startup)}/{uuid.uuid4()}", headers=owner["headers"])).status_code == 404


async def test_membership_roles_and_cross_org(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await _signup_verified(client, "owner9b@example.com")
    viewer = await _signup_verified(client, "viewer9b@example.com")
    member = await _signup_verified(client, "member9b@example.com")
    admin = await _signup_verified(client, "admin9b@example.com")
    outsider = await _signup_verified(client, "investor9b@example.com", role="investor")
    startup = await _create_org(client, owner)
    firm = await _create_org(client, outsider, type_="investor_firm")
    inv = await add_org(db_session, name="Verified Firm", slug="verified-firm")
    for actor, role in [(viewer, "viewer"), (member, "member"), (admin, "admin")]:
        await _invite_member(client, owner, actor, startup, role)
        for suffix in ("", f"/{inv.id}"):
            assert (await client.get(base(startup) + suffix, headers=actor["headers"])).status_code == 200
    for suffix in ("", f"/{inv.id}"):
        assert (await client.get(base(startup) + suffix)).status_code == 401
        assert (await client.get(base(startup) + suffix, headers=outsider["headers"])).status_code == 403
        assert (await client.get(base(firm) + suffix, headers=owner["headers"])).status_code == 404
    other = await _create_org(client, owner, name="Other startup")
    assert (await client.get(base(other), headers=viewer["headers"])).status_code == 403
    assert (await client.get(f"{base(other)}/{inv.id}", headers=viewer["headers"])).status_code == 403


@pytest.mark.parametrize("params", [
    {"limit": 0}, {"limit": 51}, {"offset": -1}, {"q": "x" * 101},
    {"city": "x" * 101}, {"country": "india"}, {"sort": "summary"}, {"order": "random"},
])
async def test_validation(client: AsyncClient, params: dict) -> None:
    owner = await _signup_verified(client, "validation9b@example.com")
    startup = await _create_org(client, owner)
    res = await client.get(base(startup), headers=owner["headers"], params=params)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_read_only_and_rate_limit(client: AsyncClient, db_session: AsyncSession, settings) -> None:
    owner = await _signup_verified(client, "ratelimit9b@example.com")
    startup = await _create_org(client, owner)
    firm = await add_org(db_session, name="Verified", slug="verified")
    for method, url in [("post", base(startup)), ("patch", f"{base(startup)}/{firm.id}"), ("delete", f"{base(startup)}/{firm.id}")]:
        response = await getattr(client, method)(url, headers=owner["headers"], json={"verified_at": "2020-01-01T00:00:00Z", "id": str(uuid.uuid4())}) if method != "delete" else await client.delete(url, headers=owner["headers"])
        assert response.status_code == 405
    rate_limiter.reset()
    for i in range(settings.INVESTOR_DIRECTORY_READ_LIMIT):
        url = base(startup) if i % 2 == 0 else f"{base(startup)}/{firm.id}"
        assert (await client.get(url, headers=owner["headers"])).status_code == 200
    assert (await client.get(base(startup), headers=owner["headers"])).status_code == 429
