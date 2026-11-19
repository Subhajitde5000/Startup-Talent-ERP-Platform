"""Step 5l tests: market size and competitors.

Covers the 5l plan (L1-L4) and AGENTS.md section 7:

- market size: upsert per (metric, scenario) — a second write edits rather
  than duplicates; the three-scenario board and the ``missing`` list;
  currency/unit coherence; the value is a decimal string, never a float;
- competitors: create, list with a type filter and pagination, partial
  update, soft delete (the row survives, the list drops it), a duplicate
  name is 409 even across case, and re-adding a deleted name works;
- server-controlled fields: ``source_type`` ``calculated``/``platform`` is
  422, mass assignment on ``id``/``org_id``/``created_at``/``deleted_at``
  is 422;
- validation: bad metric/scenario/type, a non-http URL, over-long text,
  a negative market value, an out-of-range year;
- 401 without a token, 403 for a viewer writing, 403 for an outsider,
  404 for a non-startup org;
- cross-organization: another org's market-size id and competitor id are
  404, and a same-named competitor in a different org is allowed (names are
  unique per org, never globally).
"""

import re
import uuid

import pytest
from httpx import AsyncClient

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


def _market_url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/market-size"


def _competitor_url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/competitors"


def _market_payload(**overrides: object) -> dict:
    payload = {
        "metric": "tam",
        "scenario": "base",
        "value": "12000000000",
        "unit": "currency",
        "currency": "INR",
        "estimate_year": 2025,
        "source_type": "external_report",
        "source_note": "Industry report 2025",
        "confidence": "high",
    }
    payload.update(overrides)
    return payload


async def _put_market(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    payload: dict,
    expect: int = 200,
) -> dict:
    resp = await client.put(
        _market_url(org_id), json=payload, headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _create_competitor(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    payload: dict,
    expect: int = 201,
) -> dict:
    resp = await client.post(
        _competitor_url(org_id), json=payload, headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 201 else {}


# --- market size: happy path -------------------------------------------------


@pytest.mark.asyncio
async def test_market_size_upsert_is_one_row_per_metric_and_scenario(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    first = await _put_market(client, founder, org["id"], _market_payload())
    assert first["metric"] == "tam"
    assert first["scenario"] == "base"
    # NUMERIC -> decimal string, exactly as 5e does it.
    assert first["value"] == "12000000000.0000"
    assert first["currency"] == "INR"
    assert first["confidence"] == "high"

    # Same (metric, scenario) again: an edit, not a second row.
    second = await _put_market(
        client, founder, org["id"], _market_payload(value="15000000000")
    )
    assert second["id"] == first["id"]
    assert second["value"] == "15000000000.0000"

    board = await client.get(_market_url(org["id"]), headers=founder["headers"])
    assert board.status_code == 200, board.text
    body = board.json()
    assert len(body["items"]) == 1
    # 3 metrics x 3 scenarios = 9 possible figures, 1 reported.
    assert len(body["missing"]) == 8
    assert "tam:base" not in body["missing"]


@pytest.mark.asyncio
async def test_scenarios_are_separate_rows(client: AsyncClient) -> None:
    """L4: the Conservative/Base/Optimistic toggle is real stored data."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    ids = set()
    for scenario, value in (
        ("conservative", "8000000000"),
        ("base", "12000000000"),
        ("optimistic", "18000000000"),
    ):
        row = await _put_market(
            client,
            founder,
            org["id"],
            _market_payload(scenario=scenario, value=value),
        )
        assert row["scenario"] == scenario
        ids.add(row["id"])
    assert len(ids) == 3


@pytest.mark.asyncio
async def test_tam_sam_som_are_distinct_figures(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    for metric in ("tam", "sam", "som"):
        await _put_market(client, founder, org["id"], _market_payload(metric=metric))

    board = await client.get(_market_url(org["id"]), headers=founder["headers"])
    metrics = sorted(row["metric"] for row in board.json()["items"])
    assert metrics == ["sam", "som", "tam"]


@pytest.mark.asyncio
async def test_count_sized_market_needs_no_currency(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    row = await _put_market(
        client,
        founder,
        org["id"],
        _market_payload(unit="count", currency=None, value="45000"),
    )
    assert row["unit"] == "count"
    assert row["currency"] is None

    # A count figure that claims a currency is incoherent.
    await _put_market(
        client,
        founder,
        org["id"],
        _market_payload(metric="sam", unit="count", currency="INR"),
        expect=422,
    )


@pytest.mark.asyncio
async def test_currency_defaults_for_a_currency_figure(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    row = await _put_market(
        client, founder, org["id"], _market_payload(currency=None)
    )
    assert row["currency"] == "INR"


@pytest.mark.asyncio
async def test_market_share_is_none_without_inputs(client: AsyncClient) -> None:
    """Never a fabricated 0%: no ARR and no SAM means no share."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    board = await client.get(_market_url(org["id"]), headers=founder["headers"])
    body = board.json()
    assert body["market_share_pct"] is None
    assert body["competitors_tracked"] == 0


@pytest.mark.asyncio
async def test_market_share_is_derived_from_arr_and_sam(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_market(
        client,
        founder,
        org["id"],
        _market_payload(metric="sam", value="1200000000", currency="INR"),
    )
    await client.put(
        f"/api/v1/organizations/{org['id']}/metrics",
        json={
            "metric_key": "arr",
            "value": "480000",
            "currency": "INR",
            "period_end": "2026-06-30",
        },
        headers=founder["headers"],
    )

    board = await client.get(_market_url(org["id"]), headers=founder["headers"])
    # 480000 / 1200000000 = 0.04%
    assert board.json()["market_share_pct"] == "0.04"


@pytest.mark.asyncio
async def test_market_share_skips_a_count_sized_sam(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _put_market(
        client,
        founder,
        org["id"],
        _market_payload(metric="sam", unit="count", currency=None, value="45000"),
    )
    await client.put(
        f"/api/v1/organizations/{org['id']}/metrics",
        json={"metric_key": "arr", "value": "480000", "period_end": "2026-06-30"},
        headers=founder["headers"],
    )

    board = await client.get(_market_url(org["id"]), headers=founder["headers"])
    # Money divided by people is meaningless: no share, not a wrong number.
    assert board.json()["market_share_pct"] is None


@pytest.mark.asyncio
async def test_delete_market_size_removes_the_row(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    row = await _put_market(client, founder, org["id"], _market_payload())

    resp = await client.delete(
        f"{_market_url(org['id'])}/{row['id']}", headers=founder["headers"]
    )
    assert resp.status_code == 204, resp.text

    board = await client.get(_market_url(org["id"]), headers=founder["headers"])
    assert board.json()["items"] == []
    assert "tam:base" in board.json()["missing"]


# --- market size: validation -------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "overrides",
    [
        {"metric": "global"},  # not tam/sam/som
        {"scenario": "wild"},  # not the three scenarios
        {"unit": "people"},  # not currency/count
        {"value": "-1"},  # a market size is a magnitude
        {"value": "100000000000000000000"},  # exceeds NUMERIC(18,4)
        {"estimate_year": 1899},
        {"estimate_year": 2101},
        {"source_type": "calculated"},  # server-only
        {"source_type": "platform"},  # server-only
        {"confidence": "certain"},
        {"source_url": "javascript:alert(1)"},  # not http/https
        {"currency": "RUPEE"},
        {"assumptions": "x" * 2001},
    ],
)
async def test_market_size_rejects_bad_input(
    client: AsyncClient, overrides: dict
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    await _put_market(client, founder, org["id"], _market_payload(**overrides), expect=422)


@pytest.mark.asyncio
async def test_market_size_forbids_server_owned_fields(client: AsyncClient) -> None:
    """Mass assignment on id/org_id/timestamps is a 422, not ignored."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    for extra in (
        {"id": str(uuid.uuid4())},
        {"org_id": str(uuid.uuid4())},
        {"created_at": "2020-01-01T00:00:00Z"},
        {"updated_at": "2020-01-01T00:00:00Z"},
    ):
        await _put_market(
            client, founder, org["id"], _market_payload(**extra), expect=422
        )


# --- competitors: happy path -------------------------------------------------


@pytest.mark.asyncio
async def test_competitor_crud(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    created = await _create_competitor(
        client,
        founder,
        org["id"],
        {
            "name": "Finly",
            "type": "direct",
            "website": "https://finly.example.com",
            "target_customer": "SMBs",
            "positioning": "All-in-one finance for small firms",
            "strengths": "Brand, distribution",
            "weaknesses": "Thin enterprise features",
            "pricing_note": "₹₹",
            "last_reviewed_on": "2026-10-30",
        },
    )
    assert created["name"] == "Finly"
    assert created["type"] == "direct"
    assert created["website"] == "https://finly.example.com"
    assert created["last_reviewed_on"] == "2026-10-30"

    listing = await client.get(_competitor_url(org["id"]), headers=founder["headers"])
    assert listing.status_code == 200, listing.text
    body = listing.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Finly"

    updated = await client.patch(
        f"{_competitor_url(org['id'])}/{created['id']}",
        json={"pricing_note": "₹₹₹", "type": "indirect"},
        headers=founder["headers"],
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["pricing_note"] == "₹₹₹"
    assert updated.json()["type"] == "indirect"
    # Partial update: untouched fields survive.
    assert updated.json()["strengths"] == "Brand, distribution"

    deleted = await client.delete(
        f"{_competitor_url(org['id'])}/{created['id']}", headers=founder["headers"]
    )
    assert deleted.status_code == 204, deleted.text

    listing = await client.get(_competitor_url(org["id"]), headers=founder["headers"])
    assert listing.json()["total"] == 0


@pytest.mark.asyncio
async def test_soft_deleted_competitor_can_be_readded(
    client: AsyncClient,
) -> None:
    """The unique index is partial, so a deleted name is reusable."""
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    first = await _create_competitor(
        client, founder, org["id"], {"name": "LedgerLoop"}
    )
    await client.delete(
        f"{_competitor_url(org['id'])}/{first['id']}", headers=founder["headers"]
    )

    again = await _create_competitor(
        client, founder, org["id"], {"name": "LedgerLoop"}
    )
    assert again["id"] != first["id"]


@pytest.mark.asyncio
async def test_duplicate_competitor_name_is_409_case_insensitively(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    await _create_competitor(client, founder, org["id"], {"name": "SheetFlow"})
    resp = await client.post(
        _competitor_url(org["id"]),
        json={"name": "sheetflow"},
        headers=founder["headers"],
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_competitor_list_filters_by_type_and_paginates(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    for name, type_ in (
        ("Alpha", "direct"),
        ("Beta", "direct"),
        ("Gamma", "substitute"),
    ):
        await _create_competitor(
            client, founder, org["id"], {"name": name, "type": type_}
        )

    filtered = await client.get(
        f"{_competitor_url(org['id'])}?type=direct", headers=founder["headers"]
    )
    assert filtered.json()["total"] == 2

    page = await client.get(
        f"{_competitor_url(org['id'])}?limit=1&offset=0", headers=founder["headers"]
    )
    assert page.json()["total"] == 3
    assert len(page.json()["items"]) == 1


@pytest.mark.asyncio
async def test_competitors_tracked_counts_live_rows(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    first = await _create_competitor(client, founder, org["id"], {"name": "One"})
    await _create_competitor(client, founder, org["id"], {"name": "Two"})

    board = await client.get(_market_url(org["id"]), headers=founder["headers"])
    assert board.json()["competitors_tracked"] == 2

    await client.delete(
        f"{_competitor_url(org['id'])}/{first['id']}", headers=founder["headers"]
    )
    board = await client.get(_market_url(org["id"]), headers=founder["headers"])
    assert board.json()["competitors_tracked"] == 1


# --- competitors: validation -------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 121},
        {"name": "Ok", "type": "frenemy"},
        {"name": "Ok", "website": "javascript:alert(1)"},
        {"name": "Ok", "website": "not a url"},
        {"name": "Ok", "strengths": "x" * 1001},
        {"name": "Ok", "target_customer": "x" * 201},
        {"name": "Ok", "last_reviewed_on": "not-a-date"},
    ],
)
async def test_competitor_rejects_bad_input(
    client: AsyncClient, payload: dict
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    await _create_competitor(client, founder, org["id"], payload, expect=422)


@pytest.mark.asyncio
async def test_competitor_forbids_server_owned_fields(
    client: AsyncClient,
) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)

    for extra in (
        {"id": str(uuid.uuid4())},
        {"org_id": str(uuid.uuid4())},
        {"deleted_at": "2020-01-01T00:00:00Z"},
        {"created_at": "2020-01-01T00:00:00Z"},
    ):
        await _create_competitor(
            client, founder, org["id"], {"name": "Ok", **extra}, expect=422
        )


# --- authorization -----------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "suffix", "payload"),
    [
        ("put", "market-size", _market_payload()),
        ("get", "market-size", None),
        ("get", "competitors", None),
        ("post", "competitors", {"name": "Nope"}),
    ],
)
async def test_market_routes_require_authentication(
    client: AsyncClient, method: str, suffix: str, payload: dict | None
) -> None:
    url = f"/api/v1/organizations/{uuid.uuid4()}/{suffix}"
    resp = await getattr(client, method)(url, json=payload) if payload else await getattr(
        client, method
    )(url)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_viewer_reads_market_but_cannot_write(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    viewer = await _signup_verified(client, "viewer@example.com")
    await _invite_member(client, founder, viewer, org, role="viewer")

    row = await _put_market(client, founder, org["id"], _market_payload())
    competitor = await _create_competitor(
        client, founder, org["id"], {"name": "Finly"}
    )

    # Reads are allowed.
    assert (
        await client.get(_market_url(org["id"]), headers=viewer["headers"])
    ).status_code == 200
    assert (
        await client.get(_competitor_url(org["id"]), headers=viewer["headers"])
    ).status_code == 200

    # Writes are not.
    await _put_market(
        client, viewer, org["id"], _market_payload(), expect=403
    )
    await _create_competitor(client, viewer, org["id"], {"name": "X"}, expect=403)
    resp = await client.patch(
        f"{_competitor_url(org['id'])}/{competitor['id']}",
        json={"name": "Y"},
        headers=viewer["headers"],
    )
    assert resp.status_code == 403, resp.text
    resp = await client.delete(
        f"{_competitor_url(org['id'])}/{competitor['id']}", headers=viewer["headers"]
    )
    assert resp.status_code == 403, resp.text
    resp = await client.delete(
        f"{_market_url(org['id'])}/{row['id']}", headers=viewer["headers"]
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_member_writes_market(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    member = await _signup_verified(client, "member@example.com")
    await _invite_member(client, founder, member, org, role="member")

    await _put_market(client, member, org["id"], _market_payload())
    await _create_competitor(client, member, org["id"], {"name": "Member Co"})


@pytest.mark.asyncio
async def test_outsider_cannot_read_market(client: AsyncClient) -> None:
    founder = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, founder)
    outsider = await _signup_verified(client, "outsider@example.com")

    resp = await client.get(_market_url(org["id"]), headers=outsider["headers"])
    assert resp.status_code == 403, resp.text
    resp = await client.get(_competitor_url(org["id"]), headers=outsider["headers"])
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_non_startup_org_is_404(client: AsyncClient) -> None:
    employer = await _signup_verified(client, "employer@example.com", role="employer")
    org = await _create_org(client, employer, name="Hire Co", type_="employer")

    resp = await client.get(_market_url(org["id"]), headers=employer["headers"])
    assert resp.status_code == 404, resp.text
    resp = await client.get(_competitor_url(org["id"]), headers=employer["headers"])
    assert resp.status_code == 404, resp.text


# --- cross-organization (IDOR) ----------------------------------------------


@pytest.mark.asyncio
async def test_another_orgs_market_size_id_is_404(client: AsyncClient) -> None:
    owner_a = await _signup_verified(client, "a@example.com")
    org_a = await _create_org(client, owner_a, name="Alpha")
    row = await _put_market(client, owner_a, org_a["id"], _market_payload())

    owner_b = await _signup_verified(client, "b@example.com")
    org_b = await _create_org(client, owner_b, name="Bravo")

    # B owns org_b and may write there — but A's row id must not resolve.
    resp = await client.delete(
        f"{_market_url(org_b['id'])}/{row['id']}", headers=owner_b["headers"]
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_another_orgs_competitor_id_is_404(client: AsyncClient) -> None:
    owner_a = await _signup_verified(client, "a@example.com")
    org_a = await _create_org(client, owner_a, name="Alpha")
    competitor = await _create_competitor(
        client, owner_a, org_a["id"], {"name": "Alpha Co"}
    )

    owner_b = await _signup_verified(client, "b@example.com")
    org_b = await _create_org(client, owner_b, name="Bravo")

    resp = await client.patch(
        f"{_competitor_url(org_b['id'])}/{competitor['id']}",
        json={"name": "Hijacked"},
        headers=owner_b["headers"],
    )
    assert resp.status_code == 404, resp.text

    resp = await client.delete(
        f"{_competitor_url(org_b['id'])}/{competitor['id']}",
        headers=owner_b["headers"],
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_same_competitor_name_in_two_orgs_is_allowed(
    client: AsyncClient,
) -> None:
    """Names are unique per organization, never globally."""
    owner_a = await _signup_verified(client, "a@example.com")
    org_a = await _create_org(client, owner_a, name="Alpha")
    owner_b = await _signup_verified(client, "b@example.com")
    org_b = await _create_org(client, owner_b, name="Bravo")

    await _create_competitor(client, owner_a, org_a["id"], {"name": "Finly"})
    await _create_competitor(client, owner_b, org_b["id"], {"name": "Finly"})


@pytest.mark.asyncio
async def test_orgs_cannot_see_each_others_market_data(
    client: AsyncClient,
) -> None:
    owner_a = await _signup_verified(client, "a@example.com")
    org_a = await _create_org(client, owner_a, name="Alpha")
    await _put_market(client, owner_a, org_a["id"], _market_payload())
    await _create_competitor(client, owner_a, org_a["id"], {"name": "Alpha Co"})

    owner_b = await _signup_verified(client, "b@example.com")
    org_b = await _create_org(client, owner_b, name="Bravo")

    board = await client.get(_market_url(org_b["id"]), headers=owner_b["headers"])
    assert board.json()["items"] == []
    assert board.json()["competitors_tracked"] == 0

    listing = await client.get(
        _competitor_url(org_b["id"]), headers=owner_b["headers"]
    )
    assert listing.json()["total"] == 0
