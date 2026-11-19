"""Step 5e tests: startup metrics — upsert, latest, history, list, delete.

Covers the 5e plan (E1-E8) and AGENTS.md section 7:

- happy path: a founder reports monthly values, the latest read returns one
  row per key with the missing keys named, history comes back newest first,
  a second report for the same period replaces the value (row id stable);
- ``source`` is server-assigned: the client can never produce
  ``mentor_verified`` / ``admin_verified`` / ``calculated``, and a period
  that already carries a verified source is a 409, not a silent overwrite;
- value rules: decimal strings in and out (never floats), NUMERIC bound,
  non-finite rejected, negative allowed only for ``growth_mom``,
  ``period_end`` cannot be in the future, ``currency`` is ISO-3 upper-cased;
- validation: unknown metric key, bad key/history key 422;
- 401 on every route, 403 for a viewer writing, 403 for an outsider,
  404 for a non-startup org, 404 for another organization's metric id;
- mass-assignment on server-owned fields (``source``, ``id``, ``org_id``,
  ``created_at``) is 422;
- pagination/filtering of the list, and delete removing a row for good.
"""

import re
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.metric import MetricKey, MetricSource, StartupMetric
from app.services import email_service

PASSWORD = "Str0ng!Password99"

# The full vocabulary. Derived from the enum rather than frozen as a
# literal: Step 5k extended the allowed keys additively, and a hard-coded
# list would make these contract tests fail for the wrong reason (the
# contract is "every allowed key round-trips", not "there are exactly 8").
ALL_KEYS = [key.value for key in MetricKey]


# --- helpers ----------------------------------------------------------------


def _extract_code() -> str:
    assert email_service.SENT_EMAILS, "expected a verification email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"(\d{6})", body)
    assert match, f"no 6-digit code in email body: {body!r}"
    return match.group(1)


async def _signup_verified(
    client: AsyncClient, email: str, role: str = "startup"
) -> dict:
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


async def _invite_member(
    client: AsyncClient, owner: dict, invitee: dict, org: dict, role: str = "member"
) -> None:
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": invitee["email"], "role": role},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
    accept = await client.post(
        f"/api/v1/invites/{resp.json()['token']}/accept", headers=invitee["headers"]
    )
    assert accept.status_code == 200, accept.text


def _url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/metrics"


def _month_end(offset: int = 1) -> str:
    """A period that has definitely ended (never the future)."""
    return (date.today() - timedelta(days=31 * offset)).replace(day=1).isoformat()


async def _put(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    payload: dict,
    expect: int = 200,
) -> dict:
    resp = await client.put(_url(org_id), json=payload, headers=auth["headers"])
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _latest(client: AsyncClient, auth: dict, org_id: str) -> dict:
    resp = await client.get(f"{_url(org_id)}/latest", headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _history(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    key: str,
    params: dict | None = None,
) -> dict:
    resp = await client.get(
        f"{_url(org_id)}/{key}/history", params=params or {}, headers=auth["headers"]
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _list(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    params: dict | None = None,
) -> dict:
    resp = await client.get(_url(org_id), params=params or {}, headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _delete(
    client: AsyncClient, auth: dict, org_id: str, metric_id: str, expect: int = 204
) -> None:
    resp = await client.delete(
        f"{_url(org_id)}/{metric_id}", headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text


# --- happy path --------------------------------------------------------------


@pytest.mark.asyncio
async def test_report_one_value_and_read_it_back(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    period = _month_end(1)

    created = await _put(
        client,
        founder,
        org["id"],
        {
            "metric_key": "mrr",
            "value": "480000.00",
            "unit": "inr",
            "period_end": period,
        },
    )
    assert created["org_id"] == org["id"]
    assert created["metric_key"] == "mrr"
    # Plan E1: a decimal *string*, never a float.
    assert isinstance(created["value"], str)
    assert created["value"] == "480000.0000"  # the column's scale
    assert created["source"] == "startup_reported"
    assert created["currency"] == "INR"  # plan E3: default
    assert created["period_end"] == period
    assert created["unit"] == "inr"

    page = await _list(client, founder, org["id"])
    assert page["total"] == 1
    assert page["items"][0]["id"] == created["id"]


@pytest.mark.asyncio
async def test_report_every_allowed_key(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    period = _month_end(1)

    for key in ALL_KEYS:
        await _put(
            client,
            founder,
            org["id"],
            {"metric_key": key, "value": "12", "unit": "%", "period_end": period},
        )

    latest = await _latest(client, founder, org["id"])
    assert [row["metric_key"] for row in latest["items"]] == sorted(ALL_KEYS)
    assert latest["missing"] == []


@pytest.mark.asyncio
async def test_latest_names_missing_keys_instead_of_zero(
    client: AsyncClient,
) -> None:
    """Plan E2: a key with no data is absent, never a fake 0."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": "1000", "period_end": _month_end(1)},
    )

    latest = await _latest(client, founder, org["id"])
    assert [row["metric_key"] for row in latest["items"]] == ["mrr"]
    assert latest["missing"] == [k for k in ALL_KEYS if k != "mrr"]
    assert all(row["metric_key"] != "burn" for row in latest["items"])


@pytest.mark.asyncio
async def test_latest_returns_the_newest_period_per_key(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    for offset in (3, 2, 1):
        await _put(
            client,
            founder,
            org["id"],
            {"metric_key": "mrr", "value": str(offset * 100), "period_end": _month_end(offset)},
        )

    latest = await _latest(client, founder, org["id"])
    row = next(r for r in latest["items"] if r["metric_key"] == "mrr")
    assert row["period_end"] == _month_end(1)
    assert row["value"] == "100.0000"


@pytest.mark.asyncio
async def test_upsert_replaces_the_same_period_and_keeps_the_row_id(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    period = _month_end(1)

    first = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": "100", "period_end": period},
    )
    second = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": "250", "unit": "inr", "period_end": period},
    )
    assert second["id"] == first["id"]
    assert second["value"] == "250.0000"
    assert second["unit"] == "inr"

    page = await _list(client, founder, org["id"])
    assert page["total"] == 1  # one row per (org, key, period)


@pytest.mark.asyncio
async def test_history_is_newest_first_and_paginated(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    for offset in (1, 2, 3, 4):
        await _put(
            client,
            founder,
            org["id"],
            {
                "metric_key": "mrr",
                "value": str(offset * 1000),
                "unit": "inr",
                "currency": "INR",
                "period_end": _month_end(offset),
            },
        )

    full = await _history(client, founder, org["id"], "mrr")
    assert full["total"] == 4
    assert [p["period_end"] for p in full["items"]] == [
        _month_end(1),
        _month_end(2),
        _month_end(3),
        _month_end(4),
    ]
    assert full["unit"] == "inr"
    assert full["currency"] == "INR"
    assert all(p["source"] == "startup_reported" for p in full["items"])

    window = await _history(client, founder, org["id"], "mrr", {"limit": 2, "offset": 2})
    assert window["total"] == 4
    assert [p["period_end"] for p in window["items"]] == [_month_end(3), _month_end(4)]

    empty = await _history(client, founder, org["id"], "burn")
    assert empty["total"] == 0
    assert empty["items"] == []


@pytest.mark.asyncio
async def test_list_filters_by_key_and_period_range(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    for offset in (1, 2, 3):
        await _put(
            client,
            founder,
            org["id"],
            {"metric_key": "mrr", "value": "100", "period_end": _month_end(offset)},
        )
        await _put(
            client,
            founder,
            org["id"],
            {"metric_key": "burn", "value": "50", "period_end": _month_end(offset)},
        )

    only_mrr = await _list(client, founder, org["id"], {"metric_key": "mrr"})
    assert only_mrr["total"] == 3
    assert {row["metric_key"] for row in only_mrr["items"]} == {"mrr"}

    ranged = await _list(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "period_from": _month_end(2), "period_to": _month_end(1)},
    )
    assert ranged["total"] == 2
    assert [row["period_end"] for row in ranged["items"]] == [
        _month_end(1),
        _month_end(2),
    ]

    paged = await _list(client, founder, org["id"], {"limit": 2, "offset": 0})
    assert paged["total"] == 6
    assert len(paged["items"]) == 2
    assert paged["items"][0]["period_end"] == _month_end(1)


@pytest.mark.asyncio
async def test_delete_removes_the_row(client: AsyncClient, db_session) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    created = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "burn", "value": "90", "period_end": _month_end(1)},
    )

    await _delete(client, founder, org["id"], created["id"])
    page = await _list(client, founder, org["id"])
    assert page["total"] == 0
    latest = await _latest(client, founder, org["id"])
    assert "burn" in latest["missing"]

    # Already gone -> 404, and the same id in another org is 404 too.
    await _delete(client, founder, org["id"], created["id"], expect=404)
    count = (
        await db_session.execute(select(func.count(StartupMetric.id)))
    ).scalar_one()
    assert count == 0


# --- the server-owned source -------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "source", ["mentor_verified", "admin_verified", "calculated", "startup_reported"]
)
async def test_source_can_never_be_sent_by_the_client(
    client: AsyncClient, source: str
) -> None:
    """Plan E1/E4: ``source`` is server-assigned, so even sending the value
    the server would pick is a 422 (extra="forbid")."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    await _put(
        client,
        founder,
        org["id"],
        {
            "metric_key": "mrr",
            "value": "100",
            "period_end": _month_end(1),
            "source": source,
        },
        expect=422,
    )


@pytest.mark.asyncio
async def test_verified_period_cannot_be_overwritten(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A mentor-verified value is not silently replaced by a re-report."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    period = _month_end(1)
    created = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": "100", "period_end": period},
    )

    # Verification is server-side only (mentor: Step 8, admin: 15a); emulate
    # it the way the service would write it.
    row = (
        await db_session.execute(
            select(StartupMetric).where(StartupMetric.id == uuid.UUID(created["id"]))
        )
    ).scalar_one()
    row.source = MetricSource.mentor_verified
    row.value = Decimal("123456")
    await db_session.commit()

    resp = await client.put(
        _url(org["id"]),
        json={"metric_key": "mrr", "value": "999", "period_end": period},
        headers=founder["headers"],
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "CONFLICT"

    # The verified value is untouched.
    latest = await _latest(client, founder, org["id"])
    row_out = next(r for r in latest["items"] if r["metric_key"] == "mrr")
    assert row_out["source"] == "mentor_verified"
    assert row_out["value"] == "123456.0000"


@pytest.mark.asyncio
async def test_upsert_downgrades_a_plain_row_to_startup_reported(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """An ordinary overwrite always writes ``startup_reported``."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    period = _month_end(1)
    created = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": "100", "period_end": period},
    )
    row = (
        await db_session.execute(
            select(StartupMetric).where(StartupMetric.id == uuid.UUID(created["id"]))
        )
    ).scalar_one()
    row.source = MetricSource.calculated
    await db_session.commit()

    # ``calculated`` is verified, so this is the 409 path...
    resp = await client.put(
        _url(org["id"]),
        json={"metric_key": "mrr", "value": "111", "period_end": period},
        headers=founder["headers"],
    )
    assert resp.status_code == 409, resp.text

    # ...and a fresh key written by the startup is ``startup_reported``.
    other = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "burn", "value": "10", "period_end": period},
    )
    assert other["source"] == "startup_reported"


# --- value and field rules ---------------------------------------------------


@pytest.mark.asyncio
async def test_value_is_stored_at_the_column_scale(client: AsyncClient) -> None:
    """NUMERIC(18,4): four places are kept exactly, a fifth is rejected
    rather than silently rounded away (money is never quietly changed)."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    created = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": "1234.5678", "period_end": _month_end(1)},
    )
    assert created["value"] == "1234.5678"

    await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": "1234.56789", "period_end": _month_end(2)},
        expect=422,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "value",
    ["NaN", "Infinity", "-Infinity", "1e20", "99999999999999999999"],
)
async def test_non_finite_and_out_of_range_values_are_422(
    client: AsyncClient, value: str
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": value, "period_end": _month_end(1)},
        expect=422,
    )


@pytest.mark.asyncio
async def test_negative_growth_is_allowed_but_counts_are_not(client: AsyncClient) -> None:
    """Plan E5: ``growth_mom`` may shrink; a count or amount may not."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    period = _month_end(1)

    ok = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "growth_mom", "value": "-7.5", "unit": "%", "period_end": period},
    )
    assert ok["value"] == "-7.5000"

    for key in ("mrr", "customers", "burn", "runway_months", "headcount", "active_users", "arr"):
        resp = await client.put(
            _url(org["id"]),
            json={"metric_key": key, "value": "-1", "period_end": period},
            headers=founder["headers"],
        )
        assert resp.status_code == 422, (key, resp.text)
        assert resp.json()["error"]["details"][0]["loc"] == ["body", "value"]


@pytest.mark.asyncio
async def test_future_period_is_422(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    future = (date.today() + timedelta(days=400)).isoformat()
    resp = await client.put(
        _url(org["id"]),
        json={"metric_key": "mrr", "value": "10", "period_end": future},
        headers=founder["headers"],
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["details"][0]["loc"] == ["body", "period_end"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"metric_key": "cash_balance", "value": "1", "period_end": "2026-01-01"},
        {"metric_key": "MRR", "value": "1", "period_end": "2026-01-01"},
        {"metric_key": "mrr", "value": "1", "period_end": "not-a-date"},
        {"metric_key": "mrr", "value": "1"},
        {"metric_key": "mrr", "value": "1", "period_end": "2026-01-01", "unit": "x" * 33},
        {"metric_key": "mrr", "value": "1", "period_end": "2026-01-01", "currency": "RUPEE"},
        {"metric_key": "mrr", "value": "1", "period_end": "2026-01-01", "currency": "1N3"},
    ],
)
async def test_field_validation(client: AsyncClient, payload: dict) -> None:
    """Only the 8 schema keys exist — 'cash balance' is not one of them."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    resp = await client.put(_url(org["id"]), json=payload, headers=founder["headers"])
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_currency_is_upper_cased(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    created = await _put(
        client,
        founder,
        org["id"],
        {
            "metric_key": "mrr",
            "value": "5",
            "currency": "usd",
            "period_end": _month_end(1),
        },
    )
    assert created["currency"] == "USD"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field,value",
    [
        ("id", "00000000-0000-0000-0000-000000000000"),
        ("org_id", "00000000-0000-0000-0000-000000000000"),
        ("created_at", "2026-01-01T00:00:00Z"),
    ],
)
async def test_mass_assignment_on_server_owned_fields_is_422(
    client: AsyncClient, field: str, value: str
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    await _put(
        client,
        founder,
        org["id"],
        {
            "metric_key": "mrr",
            "value": "1",
            "period_end": _month_end(1),
            field: value,
        },
        expect=422,
    )


# --- authentication and authorization ---------------------------------------


@pytest.mark.asyncio
async def test_all_routes_require_authentication(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    ghost = str(uuid.uuid4())

    assert (
        await client.put(
            _url(org["id"]),
            json={"metric_key": "mrr", "value": "1", "period_end": "2026-01-01"},
        )
    ).status_code == 401
    assert (await client.get(f"{_url(org['id'])}/latest")).status_code == 401
    assert (await client.get(f"{_url(org['id'])}/mrr/history")).status_code == 401
    assert (await client.get(_url(org["id"]))).status_code == 401
    assert (await client.delete(f"{_url(org['id'])}/{ghost}")).status_code == 401


@pytest.mark.asyncio
async def test_viewer_reads_but_cannot_write(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, owner)
    viewer = await _signup_verified(client, "viewer@example.com")
    await _invite_member(client, owner, viewer, org, role="viewer")

    created = await _put(
        client,
        owner,
        org["id"],
        {"metric_key": "mrr", "value": "42", "period_end": _month_end(1)},
    )

    latest = await _latest(client, viewer, org["id"])
    assert latest["items"][0]["value"] == "42.0000"
    await _history(client, viewer, org["id"], "mrr")
    await _list(client, viewer, org["id"])

    put = await client.put(
        _url(org["id"]),
        json={"metric_key": "burn", "value": "1", "period_end": _month_end(1)},
        headers=viewer["headers"],
    )
    assert put.status_code == 403, put.text
    await _delete(client, viewer, org["id"], created["id"], expect=403)


@pytest.mark.asyncio
async def test_member_can_write(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, owner)
    member = await _signup_verified(client, "member@example.com")
    await _invite_member(client, owner, member, org, role="member")
    created = await _put(
        client,
        member,
        org["id"],
        {"metric_key": "customers", "value": "126", "period_end": _month_end(1)},
    )
    assert created["value"] == "126.0000"
    await _delete(client, member, org["id"], created["id"])


@pytest.mark.asyncio
async def test_outsider_cannot_read_or_write(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    created = await _put(
        client,
        founder,
        org["id"],
        {"metric_key": "mrr", "value": "10", "period_end": _month_end(1)},
    )

    outsider = await _signup_verified(client, "outsider@example.com")

    for path in (f"{_url(org['id'])}/latest", f"{_url(org['id'])}/mrr/history", _url(org["id"])):
        resp = await client.get(path, headers=outsider["headers"])
        assert resp.status_code == 403, (path, resp.text)

    put = await client.put(
        _url(org["id"]),
        json={"metric_key": "mrr", "value": "11", "period_end": _month_end(1)},
        headers=outsider["headers"],
    )
    assert put.status_code == 403, put.text
    await _delete(client, outsider, org["id"], created["id"], expect=403)


@pytest.mark.asyncio
async def test_other_organization_metric_id_is_404(client: AsyncClient) -> None:
    """Cross-org IDOR: the same actor in two orgs, B's path cannot touch A."""
    founder = await _signup_verified(client, "founder@example.com")
    org_a = await _create_org(client, founder, name="Org A")
    org_b = await _create_org(client, founder, name="Org B")
    in_a = await _put(
        client,
        founder,
        org_a["id"],
        {"metric_key": "mrr", "value": "10", "period_end": _month_end(1)},
    )

    await _delete(client, founder, org_b["id"], in_a["id"], expect=404)

    # Still there in A.
    page = await _list(client, founder, org_a["id"])
    assert page["total"] == 1
    # B has nothing of its own.
    assert (await _list(client, founder, org_b["id"]))["total"] == 0


@pytest.mark.asyncio
async def test_non_startup_org_is_404(client: AsyncClient) -> None:
    employer = await _signup_verified(client, "employer@example.com", role="employer")
    company = await _create_org(client, employer, name="Hiring Co", type_="employer")

    for path in (
        f"{_url(company['id'])}/latest",
        f"{_url(company['id'])}/mrr/history",
        _url(company["id"]),
    ):
        resp = await client.get(path, headers=employer["headers"])
        assert resp.status_code == 404, (path, resp.text)

    put = await client.put(
        _url(company["id"]),
        json={"metric_key": "mrr", "value": "1", "period_end": _month_end(1)},
        headers=employer["headers"],
    )
    assert put.status_code == 404, put.text


@pytest.mark.asyncio
async def test_unknown_key_path_and_bad_ids_are_422(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    resp = await client.get(
        f"{_url(org['id'])}/cash_balance/history", headers=founder["headers"]
    )
    assert resp.status_code == 422, resp.text

    resp = await client.delete(
        f"{_url(org['id'])}/not-a-uuid", headers=founder["headers"]
    )
    assert resp.status_code == 422, resp.text

    resp = await client.get(
        f"{_url(org['id'])}/mrr/history",
        params={"limit": 101},
        headers=founder["headers"],
    )
    assert resp.status_code == 422, resp.text


# --- isolation between organizations ----------------------------------------


@pytest.mark.asyncio
async def test_each_organization_sees_only_its_own_metrics(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org_a = await _create_org(client, founder, name="Org A")
    org_b = await _create_org(client, founder, name="Org B")

    await _put(
        client,
        founder,
        org_a["id"],
        {"metric_key": "mrr", "value": "100", "period_end": _month_end(1)},
    )
    await _put(
        client,
        founder,
        org_b["id"],
        {"metric_key": "mrr", "value": "900", "period_end": _month_end(1)},
    )

    a = await _latest(client, founder, org_a["id"])
    b = await _latest(client, founder, org_b["id"])
    assert a["items"][0]["value"] == "100.0000"
    assert b["items"][0]["value"] == "900.0000"
