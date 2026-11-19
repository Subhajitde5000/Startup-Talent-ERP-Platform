"""Step 5k tests: the Business tab aggregate.

Covers the 5k plan (K1-K4) and AGENTS.md section 7:

- the vocabulary extension is ADDITIVE: every 5e key still round-trips and
  a 5k key is now accepted (the regression guard for K1);
- happy path: reported KPIs carry their source; ``ltv_cac``,
  ``payback_months`` and ``net_burn`` are derived from the reported values
  and match hand arithmetic;
- K3: a derived figure whose inputs are missing is ABSENT and named in
  ``missing`` — never 0, and dividing by zero never produces a number;
- the funnel is metrics, not a table (K2): five keys, in order, with step
  and total conversion; an unreported step is ``count=None``;
- K4: completeness is scoped to the Business keys, and ``sources`` names
  the source of every key that has a value;
- ``calculated`` values are never writable: the metric upsert still forces
  ``startup_reported``, and mass assignment on ``source`` is 422;
- 401 without a token, 403 for an outsider, 404 for a non-startup org.
"""

import re
import uuid

import pytest
from httpx import AsyncClient

from app.models.metric import CORE_METRIC_KEYS, FUNNEL_KEYS, MetricKey
from app.services import email_service

PASSWORD = "Str0ng!Password99"


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


def _period() -> str:
    """A month that has definitely ended."""
    return "2026-06-30"


async def _put_metric(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    key: str,
    value: str,
    *,
    expect: int = 200,
    **extra: object,
) -> dict:
    payload = {"metric_key": key, "value": value, "period_end": _period(), **extra}
    resp = await client.put(
        f"/api/v1/organizations/{org_id}/metrics", json=payload, headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


def _biz_url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/analytics/business"


async def _biz(client: AsyncClient, auth: dict, org_id: str, expect: int = 200) -> dict:
    resp = await client.get(_biz_url(org_id), headers=auth["headers"])
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


# --- K1: the vocabulary extension is additive --------------------------------


@pytest.mark.asyncio
async def test_every_5e_key_still_works_after_the_extension(
    client: AsyncClient,
) -> None:
    """K1 regression guard: widening the CHECK must not break 5e."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    for key in CORE_METRIC_KEYS:
        await _put_metric(client, founder, org["id"], key.value, "7")

    latest = await client.get(
        f"/api/v1/organizations/{org['id']}/metrics/latest", headers=founder["headers"]
    )
    assert latest.status_code == 200, latest.text
    assert [row["metric_key"] for row in latest.json()["items"]] == sorted(
        key.value for key in CORE_METRIC_KEYS
    )


@pytest.mark.asyncio
async def test_5k_keys_are_accepted_and_unknown_keys_still_rejected(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    for key in (
        MetricKey.churn_rate,
        MetricKey.cac,
        MetricKey.ltv,
        MetricKey.nrr,
        MetricKey.arpc,
        MetricKey.gross_margin,
        *FUNNEL_KEYS,
    ):
        await _put_metric(client, founder, org["id"], key.value, "10")

    # An invented key is still a 422 — the vocabulary is fixed, not open.
    await _put_metric(client, founder, org["id"], "cash_balance", "10", expect=422)


@pytest.mark.asyncio
async def test_5k_keys_cannot_be_negative_but_growth_mom_can(
    client: AsyncClient,
) -> None:
    """Only ``growth_mom`` is signed; a negative churn rate is nonsense."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(client, founder, org["id"], "growth_mom", "-12.5")
    await _put_metric(client, founder, org["id"], "churn_rate", "-1", expect=422)
    await _put_metric(client, founder, org["id"], "nps", "-1", expect=422)


# --- happy path: reported + derived -----------------------------------------


@pytest.mark.asyncio
async def test_business_reports_kpis_with_source_and_derives_unit_economics(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(client, founder, org["id"], "mrr", "500000", currency="INR")
    await _put_metric(client, founder, org["id"], "burn", "800000", currency="INR")
    await _put_metric(client, founder, org["id"], "cac", "8400", currency="INR")
    await _put_metric(client, founder, org["id"], "ltv", "42000", currency="INR")
    await _put_metric(client, founder, org["id"], "arpc", "3810", currency="INR")
    await _put_metric(client, founder, org["id"], "gross_margin", "72")
    await _put_metric(client, founder, org["id"], "customers", "131")

    body = await _biz(client, founder, org["id"])

    kpi_by_key = {row["key"]: row for row in body["kpis"]}
    assert kpi_by_key["mrr"]["value"] == "500000.0000"
    assert kpi_by_key["mrr"]["currency"] == "INR"
    # A startup can only ever produce startup_reported (5e rule, unchanged).
    assert kpi_by_key["mrr"]["source"] == "startup_reported"

    derived = {row["key"]: row for row in body["unit_economics"]}

    # LTV / CAC = 42000 / 8400 = 5
    assert derived["ltv_cac"]["value"] == "5"
    assert derived["ltv_cac"]["unit"] == "ratio"
    assert derived["ltv_cac"]["inputs"] == ["ltv", "cac"]

    # payback = CAC / (ARPC * margin/100) = 8400 / (3810*0.72) = 3.0621...
    assert derived["payback_months"]["value"] == "3.0621"
    assert derived["payback_months"]["unit"] == "months"
    assert derived["payback_months"]["inputs"] == ["cac", "arpc", "gross_margin"]

    # net burn = burn - mrr = 300000
    assert derived["net_burn"]["value"] == "300000"
    assert derived["net_burn"]["unit"] == "currency"


@pytest.mark.asyncio
async def test_derived_values_are_never_zero_when_inputs_are_missing(
    client: AsyncClient,
) -> None:
    """K3: an uncomputable figure is absent and named, never 0."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    # Only MRR: no CAC, no LTV, no ARPC, no margin.
    await _put_metric(client, founder, org["id"], "mrr", "100000")

    body = await _biz(client, founder, org["id"])
    assert body["unit_economics"] == []
    for key in ("ltv_cac", "payback_months", "net_burn"):
        assert key in body["missing"], key
    # No derived number leaks into the KPI row.
    assert all(row["key"] != "ltv_cac" for row in body["kpis"])


@pytest.mark.asyncio
async def test_zero_cac_never_divides(client: AsyncClient) -> None:
    """A zero denominator yields no value rather than an exception or 0."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(client, founder, org["id"], "cac", "0")
    await _put_metric(client, founder, org["id"], "ltv", "42000")

    body = await _biz(client, founder, org["id"])
    assert all(row["key"] != "ltv_cac" for row in body["unit_economics"])
    assert "ltv_cac" in body["missing"]


@pytest.mark.asyncio
async def test_payback_is_absent_when_gross_margin_is_zero(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(client, founder, org["id"], "cac", "8400")
    await _put_metric(client, founder, org["id"], "arpc", "3810")
    await _put_metric(client, founder, org["id"], "gross_margin", "0")

    body = await _biz(client, founder, org["id"])
    assert all(row["key"] != "payback_months" for row in body["unit_economics"])
    assert "payback_months" in body["missing"]


@pytest.mark.asyncio
async def test_arpc_is_derived_from_mrr_and_customers_when_not_reported(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(client, founder, org["id"], "mrr", "2600000")
    await _put_metric(client, founder, org["id"], "customers", "200")

    body = await _biz(client, founder, org["id"])
    assert body["retention"]["arpc"] is None
    assert body["retention"]["calculated_arpc"]["value"] == "13000"
    assert body["retention"]["calculated_arpc"]["inputs"] == ["mrr", "customers"]


# --- K2: the funnel ----------------------------------------------------------


@pytest.mark.asyncio
async def test_funnel_has_five_ordered_steps_with_conversions(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    for key, value in zip(
        FUNNEL_KEYS, ("100", "80", "40", "20", "10"), strict=True
    ):
        await _put_metric(client, founder, org["id"], key.value, value)

    body = await _biz(client, founder, org["id"])
    funnel = body["funnel"]

    assert [step["key"] for step in funnel] == [k.value for k in FUNNEL_KEYS]
    assert [step["label"] for step in funnel] == [
        "Lead",
        "Contacted",
        "Demo",
        "Proposal",
        "Won",
    ]
    assert [step["count"] for step in funnel] == [
        "100",
        "80",
        "40",
        "20",
        "10",
    ]

    # The first step has no predecessor, so no step conversion.
    assert funnel[0]["step_conversion_pct"] is None
    assert funnel[0]["total_conversion_pct"] is None

    # Contacted 80 from Lead 100 = 80%; Won 10 from Lead 100 = 10%.
    assert funnel[1]["step_conversion_pct"] == "80"
    assert funnel[2]["step_conversion_pct"] == "50"
    assert funnel[4]["step_conversion_pct"] == "50"
    assert funnel[4]["total_conversion_pct"] == "10"


@pytest.mark.asyncio
async def test_unreported_funnel_step_is_null_not_zero(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(client, founder, org["id"], "funnel_lead", "50")

    body = await _biz(client, founder, org["id"])
    funnel = {step["key"]: step for step in body["funnel"]}

    assert funnel["funnel_lead"]["count"] == "50"
    # Nothing was reported for the next stage: null, never "0".
    assert funnel["funnel_contacted"]["count"] is None
    assert funnel["funnel_contacted"]["step_conversion_pct"] is None
    for key in ("funnel_contacted", "funnel_demo", "funnel_proposal", "funnel_won"):
        assert key in body["missing"]


# --- K4: completeness and sources -------------------------------------------


@pytest.mark.asyncio
async def test_completeness_is_scoped_to_the_business_keys(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(client, founder, org["id"], "mrr", "1000")

    body = await _biz(client, founder, org["id"])
    completeness = body["completeness"]

    # Reported counts the one key; total is the Business vocabulary only, so
    # a founder is never told they are missing keys this tab never shows.
    assert completeness["reported"] == 1
    assert completeness["total"] == 20
    assert "mrr" not in completeness["missing"]
    assert MetricKey.funnel_won.value in completeness["missing"]


@pytest.mark.asyncio
async def test_sources_names_every_reported_key(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(client, founder, org["id"], "mrr", "1000")
    await _put_metric(client, founder, org["id"], "churn_rate", "2.4")

    body = await _biz(client, founder, org["id"])
    sources = {row["key"]: row["source"] for row in body["sources"]}

    assert sources["mrr"] == "startup_reported"
    assert sources["churn_rate"] == "startup_reported"


# --- server-controlled fields -----------------------------------------------


@pytest.mark.asyncio
async def test_calculated_source_cannot_be_mass_assigned(
    client: AsyncClient,
) -> None:
    """K3/5e: ``source`` is absent from the input schema, so it is a 422."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_metric(
        client, founder, org["id"], "ltv", "42000", expect=422, source="calculated"
    )

    # And the derived figures never appear in the metrics table at all.
    listing = await client.get(
        f"/api/v1/organizations/{org['id']}/metrics", headers=founder["headers"]
    )
    assert listing.status_code == 200, listing.text
    assert all(row["source"] == "startup_reported" for row in listing.json()["items"])


# --- auth / authorization ----------------------------------------------------


@pytest.mark.asyncio
async def test_business_requires_authentication(client: AsyncClient) -> None:
    resp = await client.get(_biz_url(str(uuid.uuid4())))
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_outsider_cannot_read_business_analytics(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    outsider = await _signup_verified(client, "outsider@example.com")

    await _biz(client, outsider, org["id"], expect=403)


@pytest.mark.asyncio
async def test_non_startup_org_is_404_not_403(client: AsyncClient) -> None:
    """No existence oracle: a wrong-type org looks nonexistent."""
    employer = await _signup_verified(client, "employer@example.com", role="employer")
    org = await _create_org(client, employer, name="Hire Co", type_="employer")

    await _biz(client, employer, org["id"], expect=404)


@pytest.mark.asyncio
async def test_unknown_org_is_404(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    await _biz(client, founder, str(uuid.uuid4()), expect=404)


@pytest.mark.asyncio
async def test_viewer_reads_business_but_cannot_write_metrics(
    client: AsyncClient,
) -> None:
    """Viewers read analytics; the 5e write gate still excludes them."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    viewer = await _signup_verified(client, "viewer@example.com")
    await _invite_member(client, founder, viewer, org, role="viewer")

    await _put_metric(client, founder, org["id"], "mrr", "1000")
    body = await _biz(client, viewer, org["id"])
    assert body["completeness"]["reported"] == 1

    await _put_metric(client, viewer, org["id"], "arr", "12000", expect=403)


@pytest.mark.asyncio
async def test_member_reads_and_writes_business_analytics(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    member = await _signup_verified(client, "member@example.com")
    await _invite_member(client, founder, member, org, role="member")

    await _put_metric(client, member, org["id"], "mrr", "2500")
    body = await _biz(client, member, org["id"])
    assert {row["key"] for row in body["kpis"]} == {"mrr"}
