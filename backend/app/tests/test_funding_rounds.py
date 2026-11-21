"""Funding round lifecycle, validation and tenant isolation."""
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent
from app.models.funding_round import FundingRound
from app.services.rate_limiter import rate_limiter
from app.tests.test_milestones import _create_org, _invite_member, _signup_verified


def path(org: dict, rid: str = "") -> str:
    return f"/api/v1/organizations/{org['id']}/funding-rounds" + (f"/{rid}" if rid else "")


async def test_lifecycle(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, user)
    base = path(org)
    response = await client.post(base, headers=user["headers"], json={"name": " Seed ", "round_type": "seed", "target_amount": "1000.00", "minimum_raise": "100", "minimum_ticket": "20", "instrument": "safe"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Seed" and body["status"] == "draft"
    assert "committed_amount" not in body
    rid = body["id"]
    progress = await client.get(f"{base}/{rid}/progress", headers=user["headers"])
    assert progress.json()["available"] is False and progress.json()["committed_amount"] is None
    changed = await client.patch(f"{base}/{rid}", headers=user["headers"], json={"minimum_ticket": "25"})
    assert changed.status_code == 200 and changed.json()["minimum_ticket"] == "25.00"
    listing = await client.get(base, headers=user["headers"], params={"status": "draft", "limit": 1})
    assert listing.json()["total"] == 1 and listing.json()["items"][0]["id"] == rid
    for state in ["open", "paused", "open", "closed", "open"]:
        response = await client.post(f"{base}/{rid}/status", headers=user["headers"], json={"status": state})
        assert response.status_code == 200, response.text
    assert (await client.delete(f"{base}/{rid}", headers=user["headers"])).status_code == 409
    assert (await client.patch(f"{base}/{rid}", headers=user["headers"], json={"target_amount": None})).status_code == 422
    assert (await client.post(f"{base}/{rid}/status", headers=user["headers"], json={"status": "cancelled"})).status_code == 200
    assert (await client.post(f"{base}/{rid}/status", headers=user["headers"], json={"status": "open"})).status_code == 409
    assert (await client.patch(f"{base}/{rid}", headers=user["headers"], json={"name": "No"})).status_code == 409
    events = (await db_session.execute(select(ActivityEvent).where(ActivityEvent.entity_id == uuid.UUID(rid)))).scalars().all()
    assert len(events) == 8
    assert all("1000" not in e.summary for e in events)


async def test_validation_and_delete(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _signup_verified(client, "validation@example.com")
    org = await _create_org(client, user)
    base = path(org)
    valid = {"name": "Seed", "round_type": "seed"}
    invalid: list[dict[str, str | None]] = [
        {"name": "  "}, {"round_type": "unknown"}, {"currency": "A1A"},
        {"target_amount": "0"}, {"target_amount": "1000000000000"},
        {"minimum_ticket": "1.001"}, {"pre_money_valuation": "-1"},
        {"target_amount": "20", "minimum_raise": "21"},
        {"opens_on": "2026-03-01", "closes_on": "2026-02-01"},
        {"id": str(uuid.uuid4())}, {"org_id": str(uuid.uuid4())},
        {"committed_amount": "50"}, {"status": "open"}, {"deleted_at": None},
    ]
    for override in invalid:
        resp = await client.post(base, headers=user["headers"], json=valid | override)
        assert resp.status_code == 422, (override, resp.text)
    resp = await client.post(base, headers=user["headers"], json=valid)
    rid = resp.json()["id"]
    assert (await client.post(f"{base}/{rid}/status", headers=user["headers"], json={"status": "open"})).status_code == 409
    for payload in [{"status": "open"}, {"committed_amount": 100}, {"name": None}, {"currency": None}, {"created_at": "2020-01-01"}]:
        assert (await client.patch(f"{base}/{rid}", headers=user["headers"], json=payload)).status_code == 422
    assert (await client.delete(f"{base}/{rid}", headers=user["headers"])).status_code == 204
    assert (await client.get(f"{base}/{rid}", headers=user["headers"])).status_code == 404
    assert (await client.delete(f"{base}/{rid}", headers=user["headers"])).status_code == 404
    row = await db_session.get(FundingRound, uuid.UUID(rid))
    assert row is not None and row.deleted_at is not None


async def test_roles_and_idor(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    viewer = await _signup_verified(client, "viewer@example.com")
    member = await _signup_verified(client, "member@example.com")
    outsider = await _signup_verified(client, "outsider@example.com", role="investor")
    org = await _create_org(client, owner)
    other = await _create_org(client, owner, name="Other")
    await _invite_member(client, owner, viewer, org, "viewer")
    await _invite_member(client, owner, member, org, "member")
    base = path(org)
    assert (await client.get(base)).status_code == 401
    assert (await client.get(base, headers=viewer["headers"])).status_code == 403
    assert (await client.post(base, headers=viewer["headers"], json={"name": "x", "round_type": "seed"})).status_code == 403
    assert (await client.get(base, headers=outsider["headers"])).status_code == 403
    res = await client.post(base, headers=member["headers"], json={"name": "x", "round_type": "seed"})
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    for method, suffix, kwargs in [("get", "", {}), ("get", "/progress", {}), ("patch", "", {"json": {"name": "cross"}}), ("delete", "", {}), ("post", "/status", {"json": {"status": "open"}})]:
        resp = await getattr(client, method)(f"{path(other, rid)}{suffix}", headers=owner["headers"], **kwargs)
        assert resp.status_code == 404, resp.text


async def test_rate_limit(client: AsyncClient) -> None:
    user = await _signup_verified(client, "ratelimit@example.com")
    org = await _create_org(client, user)
    rate_limiter.reset()
    for _ in range(30):
        assert (await client.post(path(org), headers=user["headers"], json={"name": "Round", "round_type": "seed"})).status_code == 201
    assert (await client.post(path(org), headers=user["headers"], json={"name": "Round", "round_type": "seed"})).status_code == 429


async def test_org_type_and_all_unauthenticated_routes(client: AsyncClient) -> None:
    user = await _signup_verified(client, "orgtypes@example.com", role="employer")
    org = await _create_org(client, user, type_="employer")
    base = path(org)
    fake = str(uuid.uuid4())
    requests = [
        ("get", base, {}), ("post", base, {"json": {"name": "A", "round_type": "seed"}}),
        ("get", f"{base}/{fake}", {}), ("get", f"{base}/{fake}/progress", {}),
        ("patch", f"{base}/{fake}", {"json": {"name": "A"}}),
        ("delete", f"{base}/{fake}", {}),
        ("post", f"{base}/{fake}/status", {"json": {"status": "open"}}),
    ]
    for method, url, kwargs in requests:
        assert (await getattr(client, method)(url, **kwargs)).status_code == 401
        assert (await getattr(client, method)(url, headers=user["headers"], **kwargs)).status_code == 404


async def test_concurrent_open_postgresql(client: AsyncClient, db_session: AsyncSession) -> None:
    import asyncio

    import pytest

    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("Row locks require PostgreSQL")
    user = await _signup_verified(client, "race@example.com")
    org = await _create_org(client, user)
    base = path(org)
    res = await client.post(base, headers=user["headers"], json={"name": "A", "round_type": "seed", "target_amount": "100", "instrument": "equity"})
    assert res.status_code == 201
    url = f"{base}/{res.json()['id']}/status"
    results = await asyncio.gather(*[client.post(url, headers=user["headers"], json={"status": "open"}) for _ in range(2)])
    assert sorted(r.status_code for r in results) == [200, 409]
