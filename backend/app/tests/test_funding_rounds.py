"""Step 9a tests: funding rounds — CRUD, transitions, permissions, IDOR.

Covers the AGENTS.md section 7 definition of done: happy path,
validation errors, 401, 403 (wrong role), 404 (wrong organization /
foreign id), cross-organization references, mass-assignment on
server-controlled fields, the status state machine (409s), pagination /
sort / filter, soft-delete and the summary roll-up.

Money is asserted with ``Decimal(...)`` on the decimal-string JSON
values, never floats.
"""

import re
import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.services import email_service

PASSWORD = "Str0ng!Password99"


def _extract_code(email: str) -> str:
    """The 6-digit code from THIS user's verification email.

    Matched by recipient so that building several orgs (several users)
    in one test cannot pick up another user's code.
    """
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
    token = resp.json()["token"]
    accept = await client.post(
        f"/api/v1/invites/{token}/accept", headers=invitee["headers"]
    )
    assert accept.status_code == 200, accept.text


async def _make_org_with_members(client: AsyncClient, suffix: str = "") -> dict:
    """Owner + member + viewer in one startup, plus an outsider user.

    Emails are unique per call (``suffix``) so two orgs built in one
    test are genuinely separate accounts — reusing an email would make
    the second "owner" the first org's already-verified user.
    """
    tag = suffix or uuid.uuid4().hex[:8]
    owner = await _signup_verified(client, f"rounds-owner-{tag}@example.com")
    member = await _signup_verified(client, f"rounds-member-{tag}@example.com")
    viewer = await _signup_verified(client, f"rounds-viewer-{tag}@example.com")
    outsider = await _signup_verified(client, f"rounds-outsider-{tag}@example.com")
    org = await _create_org(client, owner, name=f"Rounds Org {tag}")
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    return {"org": org, "owner": owner, "member": member, "viewer": viewer, "outsider": outsider}


# --- helpers ---------------------------------------------------------------


async def _create_round(client: AsyncClient, auth: dict, org_id: str, payload: dict, expect: int = 201) -> dict:
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/funding-rounds",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 201 else {}


async def _patch_round(client: AsyncClient, auth: dict, org_id: str, round_id: str, payload: dict, expect: int = 200) -> dict:
    resp = await client.patch(
        f"/api/v1/organizations/{org_id}/funding-rounds/{round_id}",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _transition(client: AsyncClient, auth: dict, org_id: str, round_id: str, status_value: str, expect: int = 200) -> dict:
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/funding-rounds/{round_id}/status",
        json={"status": status_value},
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


def _round_payload(**overrides) -> dict:
    payload = {
        "name": "Pre-Seed Round",
        "round_type": "pre_seed",
        "target_amount": "25000000.00",
        "currency": "INR",
        "pre_money_valuation": "80000000.00",
        "instrument": "equity",
        "opens_on": "2027-01-01",
        "closes_on": "2027-03-31",
        "min_raise": "10000000.00",
        "min_ticket": "500000.00",
    }
    payload.update(overrides)
    return payload


# --- happy path ------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_round_happy_path(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    body = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())

    assert body["name"] == "Pre-Seed Round"
    assert body["round_type"] == "pre_seed"
    assert body["status"] == "draft"
    assert body["currency"] == "INR"
    assert body["instrument"] == "equity"
    assert Decimal(body["target_amount"]) == Decimal("25000000.00")
    # Server-only: committed starts at 0 (plan D2).
    assert Decimal(body["committed_amount"]) == Decimal("0.00")
    assert Decimal(body["remaining_amount"]) == Decimal("25000000.00")
    assert Decimal(body["progress_pct"]) == Decimal("0.00")
    assert isinstance(body["target_amount"], str)  # decimal string, never float


@pytest.mark.asyncio
async def test_get_round_derives_progress(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    body = await _get(client, team["owner"], team["org"]["id"], created["id"])
    assert body["id"] == created["id"]
    assert body["opens_on"] == "2027-01-01"
    assert body["closes_on"] == "2027-03-31"
    assert Decimal(body["min_raise"]) == Decimal("10000000.00")
    assert Decimal(body["min_ticket"]) == Decimal("500000.00")


@pytest.mark.asyncio
async def test_update_round_happy_path(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    body = await _patch_round(
        client, team["member"], team["org"]["id"], created["id"], {"name": "Seed Round B", "target_amount": "40000000.00"}
    )
    assert body["name"] == "Seed Round B"
    assert Decimal(body["target_amount"]) == Decimal("40000000.00")
    # status untouched by PATCH.
    assert body["status"] == "draft"


@pytest.mark.asyncio
async def test_status_transition_and_reopen(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    opened = await _transition(client, team["member"], team["org"]["id"], created["id"], "open")
    assert opened["status"] == "open"
    closed = await _transition(client, team["owner"], team["org"]["id"], created["id"], "closed")
    assert closed["status"] == "closed"
    reopened = await _transition(client, team["owner"], team["org"]["id"], created["id"], "open")
    assert reopened["status"] == "open"


@pytest.mark.asyncio
async def test_cancelled_is_terminal(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    await _transition(client, team["owner"], team["org"]["id"], created["id"], "cancelled")
    # cancelled -> open is invalid (D14).
    await _transition(client, team["owner"], team["org"]["id"], created["id"], "open", expect=409)


@pytest.mark.asyncio
async def test_delete_round_soft_deletes(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    resp = await client.delete(
        f"/api/v1/organizations/{team['org']['id']}/funding-rounds/{created['id']}",
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 204, resp.text
    # gone from get and list.
    await _get(client, team["owner"], team["org"]["id"], created["id"], expect=404)
    listing = await _list(client, team["owner"], team["org"]["id"])
    assert listing["total"] == 0


@pytest.mark.asyncio
async def test_summary_rolls_up(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    await _create_round(
        client, team["owner"], team["org"]["id"], _round_payload(name="Second", target_amount="10000000.00")
    )
    resp = await client.get(
        f"/api/v1/organizations/{team['org']['id']}/funding-rounds/summary",
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert Decimal(body["total_target"]) == Decimal("35000000.00")
    assert Decimal(body["total_committed"]) == Decimal("0.00")
    assert body["open_rounds"] == 0
    assert body["by_status"] == {"draft": 2}


@pytest.mark.asyncio
async def test_list_pagination_sort_filter(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    for i in range(3):
        await _create_round(client, team["owner"], team["org"]["id"], _round_payload(name=f"Round {i}"))
    body = await _list(client, team["member"], team["org"]["id"], {"limit": 2, "offset": 0, "sort": "name"})
    assert body["total"] == 3
    assert body["has_more"] is True
    assert len(body["items"]) == 2
    assert body["items"][0]["name"] == "Round 0"
    # filter by status.
    filtered = await _list(client, team["member"], team["org"]["id"], {"status": "draft"})
    assert filtered["total"] == 3
    empty = await _list(client, team["member"], team["org"]["id"], {"status": "open"})
    assert empty["total"] == 0


# --- validation ------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_validation_errors(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    # blank name
    await _create_round(client, team["owner"], team["org"]["id"], _round_payload(name="   "), expect=422)
    # non-positive target
    await _create_round(client, team["owner"], team["org"]["id"], _round_payload(target_amount="0"), expect=422)
    # negative valuation
    await _create_round(client, team["owner"], team["org"]["id"], _round_payload(pre_money_valuation="-1"), expect=422)
    # unknown enum
    await _create_round(client, team["owner"], team["org"]["id"], _round_payload(round_type="series_z"), expect=422)
    # closes before opens
    await _create_round(
        client, team["owner"], team["org"]["id"], _round_payload(opens_on="2027-05-01", closes_on="2027-01-01"), expect=422
    )


@pytest.mark.asyncio
async def test_unknown_sort_key_is_422(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    await _list(client, team["member"], team["org"]["id"], {"sort": "nonsense"}, expect=422)


# --- authentication / authorization ---------------------------------------


@pytest.mark.asyncio
async def test_unauthenticated_gets_401(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    resp = await client.post(
        f"/api/v1/organizations/{team['org']['id']}/funding-rounds",
        json=_round_payload(),
    )
    assert resp.status_code == 401
    resp = await client.get(f"/api/v1/organizations/{team['org']['id']}/funding-rounds")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_viewer_can_read_but_not_write(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    # viewer reads.
    await _get(client, team["viewer"], team["org"]["id"], created["id"])
    await _list(client, team["viewer"], team["org"]["id"])
    # viewer cannot create / edit / transition / delete.
    await _create_round(client, team["viewer"], team["org"]["id"], _round_payload(), expect=403)
    await _patch_round(client, team["viewer"], team["org"]["id"], created["id"], {"name": "x"}, expect=403)
    await _transition(client, team["viewer"], team["org"]["id"], created["id"], "open", expect=403)
    resp = await client.delete(
        f"/api/v1/organizations/{team['org']['id']}/funding-rounds/{created['id']}",
        headers=team["viewer"]["headers"],
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_outsider_gets_403_on_org_path(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    await _list(client, team["outsider"], team["org"]["id"], expect=403)
    await _create_round(client, team["outsider"], team["org"]["id"], _round_payload(), expect=403)


@pytest.mark.asyncio
async def test_wrong_org_id_and_foreign_round_id(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    other_org = await _create_org(client, team["owner"], name="Other Startup")
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    # A foreign round id under this org's path -> 404 (no existence oracle).
    resp = await client.get(
        f"/api/v1/organizations/{team['org']['id']}/funding-rounds/{uuid.uuid4()}",
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404
    # An org the caller is not a member of -> 403 (not a member).
    await _list(client, team["member"], other_org["id"], expect=403)
    # The round itself is still readable under its own org.
    await _get(client, team["owner"], team["org"]["id"], created["id"], expect=200)


@pytest.mark.asyncio
async def test_cross_org_round_id_is_404(client: AsyncClient) -> None:
    """A round created in org A is invisible under org B's path (IDOR)."""
    team_a = await _make_org_with_members(client)
    team_b = await _make_org_with_members(client)
    created_a = await _create_round(client, team_a["owner"], team_a["org"]["id"], _round_payload())
    await _get(client, team_b["owner"], team_b["org"]["id"], created_a["id"], expect=404)
    await _transition(client, team_b["owner"], team_b["org"]["id"], created_a["id"], "open", expect=404)
    await _patch_round(client, team_b["owner"], team_b["org"]["id"], created_a["id"], {"name": "hijack"}, expect=404)


@pytest.mark.asyncio
async def test_repeated_delete_is_404(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    resp = await client.delete(
        f"/api/v1/organizations/{team['org']['id']}/funding-rounds/{created['id']}",
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 204
    resp = await client.delete(
        f"/api/v1/organizations/{team['org']['id']}/funding-rounds/{created['id']}",
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404


# --- mass-assignment -------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "field,value",
    [
        ("committed_amount", "5000000.00"),
        ("status", "open"),
        ("id", str(uuid.uuid4())),
        ("org_id", str(uuid.uuid4())),
        ("created_at", "2020-01-01T00:00:00Z"),
    ],
)
async def test_mass_assignment_on_server_fields(client: AsyncClient, field: str, value: str) -> None:
    team = await _make_org_with_members(client)
    payload = _round_payload()
    payload[field] = value
    await _create_round(client, team["owner"], team["org"]["id"], payload, expect=422)

    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    patch = {field: value}
    await _patch_round(client, team["owner"], team["org"]["id"], created["id"], patch, expect=422)


@pytest.mark.asyncio
async def test_invalid_state_transition_is_409(client: AsyncClient) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    # draft -> paused is not a legal transition (D1).
    await _transition(client, team["owner"], team["org"]["id"], created["id"], "paused", expect=409)


@pytest.mark.asyncio
async def test_audit_rows_written(client: AsyncClient, db_session) -> None:
    team = await _make_org_with_members(client)
    created = await _create_round(client, team["owner"], team["org"]["id"], _round_payload())
    await _transition(client, team["owner"], team["org"]["id"], created["id"], "open")
    from sqlalchemy import select

    from app.models.activity import ActivityEvent

    rows = (
        await db_session.execute(
            select(ActivityEvent)
            .where(ActivityEvent.org_id == uuid.UUID(team["org"]["id"]))
            .order_by(ActivityEvent.id)
        )
    ).scalars().all()
    kinds = {row.event_type for row in rows}
    assert "round_created" in kinds
    assert "round_status_changed" in kinds


# --- extra helpers used above ----------------------------------------------


async def _get(client: AsyncClient, auth: dict, org_id: str, round_id: str, expect: int = 200) -> dict:
    resp = await client.get(
        f"/api/v1/organizations/{org_id}/funding-rounds/{round_id}",
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _list(client: AsyncClient, auth: dict, org_id: str, params: dict | None = None, expect: int = 200) -> dict:
    resp = await client.get(
        f"/api/v1/organizations/{org_id}/funding-rounds",
        params=params or {},
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}
