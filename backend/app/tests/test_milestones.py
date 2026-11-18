"""Step 5b tests: milestones — CRUD, permissions, IDOR, validation.

Covers happy path / validation / authentication / authorization (wrong
role, wrong organization), cross-organization references (milestone id
and owner_id), soft-delete semantics, pagination/sort/filter and
mass-assignment attempts on server-controlled fields, per AGENTS.md
section 7 and the 5b plan.
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


async def _user_id(client: AsyncClient, auth: dict) -> str:
    resp = await client.get("/api/v1/users/me", headers=auth["headers"])
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


async def _invite_member(
    client: AsyncClient, owner: dict, invitee: dict, org: dict, role: str = "member"
) -> None:
    """Owner invites ``invitee``; they accept immediately (active member)."""
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


# --- milestone helpers ------------------------------------------------------


async def _create(
    client: AsyncClient, auth: dict, org_id: str, payload: dict, expect: int = 201
) -> dict:
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/milestones",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 201 else {}


async def _list(
    client: AsyncClient, auth: dict, org_id: str, params: dict | None = None, expect: int = 200
) -> dict:
    resp = await client.get(
        f"/api/v1/organizations/{org_id}/milestones",
        params=params or {},
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _get(
    client: AsyncClient, auth: dict, org_id: str, milestone_id: str, expect: int = 200
) -> dict:
    resp = await client.get(
        f"/api/v1/organizations/{org_id}/milestones/{milestone_id}",
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _patch(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    milestone_id: str,
    payload: dict,
    expect: int = 200,
) -> dict:
    resp = await client.patch(
        f"/api/v1/organizations/{org_id}/milestones/{milestone_id}",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _delete(
    client: AsyncClient, auth: dict, org_id: str, milestone_id: str, expect: int = 204
) -> None:
    resp = await client.delete(
        f"/api/v1/organizations/{org_id}/milestones/{milestone_id}",
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text


# --- create and read --------------------------------------------------------


@pytest.mark.asyncio
async def test_create_defaults_and_get(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    me_id = await _user_id(client, auth)

    created = await _create(client, auth, org["id"], {"name": "Launch MVP"})
    assert created["org_id"] == org["id"]
    assert created["name"] == "Launch MVP"
    assert created["status"] == "on_track"
    assert created["progress"] == 0
    assert created["description"] is None
    assert created["target_date"] is None
    # plan D4: owner defaults to the creator (an active member)
    assert created["owner_id"] == me_id
    assert "deleted_at" not in created

    fetched = await _get(client, auth, org["id"], created["id"])
    assert fetched == created


@pytest.mark.asyncio
async def test_create_full_fields_persist(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    mate = await _signup_verified(client, "mate@example.com")
    await _invite_member(client, auth, mate, org, role="member")
    mate_id = await _user_id(client, mate)

    created = await _create(
        client,
        auth,
        org["id"],
        {
            "name": "Investor readiness",
            "description": "Deck, data room and metrics in place.",
            "target_date": "2026-12-15",
            "owner_id": mate_id,
            "status": "at_risk",
            "progress": 40,
        },
    )
    assert created["name"] == "Investor readiness"
    assert created["description"] == "Deck, data room and metrics in place."
    assert created["target_date"] == "2026-12-15"
    assert created["owner_id"] == mate_id
    assert created["status"] == "at_risk"
    assert created["progress"] == 40


@pytest.mark.asyncio
async def test_create_explicit_null_owner_stays_null(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)

    created = await _create(
        client, auth, org["id"], {"name": "No owner yet", "owner_id": None}
    )
    # explicit null is honoured (not replaced by the D4 creator default)
    assert created["owner_id"] is None


@pytest.mark.asyncio
async def test_update_roundtrip_and_omitted_unchanged(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(
        client,
        auth,
        org["id"],
        {"name": "MVP test launch", "target_date": "2026-11-20", "progress": 10},
    )

    # patch a subset: name/progress change, target_date untouched
    updated = await _patch(
        client, auth, org["id"], created["id"], {"name": "MVP launch", "progress": 55}
    )
    assert updated["name"] == "MVP launch"
    assert updated["progress"] == 55
    assert updated["target_date"] == "2026-11-20"
    assert updated["status"] == "on_track"

    # explicit null clears nullable columns; status changes
    cleared = await _patch(
        client,
        auth,
        org["id"],
        created["id"],
        {
            "target_date": None,
            "description": None,
            "owner_id": None,
            "status": "achieved",
        },
    )
    assert cleared["target_date"] is None
    assert cleared["description"] is None
    assert cleared["owner_id"] is None
    assert cleared["status"] == "achieved"

    stored = await _get(client, auth, org["id"], created["id"])
    assert stored["name"] == "MVP launch"
    assert stored["progress"] == 55
    assert stored["status"] == "achieved"


# --- permissions -------------------------------------------------------------


@pytest.mark.asyncio
async def test_viewer_reads_but_cannot_write(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    created = await _create(client, owner, org["id"], {"name": "Viewable"})

    viewer = await _signup_verified(client, "viewer@example.com")
    await _invite_member(client, owner, viewer, org, role="viewer")

    page = await _list(client, viewer, org["id"])
    assert page["total"] == 1
    await _get(client, viewer, org["id"], created["id"])
    await _create(client, viewer, org["id"], {"name": "nope"}, expect=403)
    await _patch(
        client, viewer, org["id"], created["id"], {"name": "nope"}, expect=403
    )
    await _delete(client, viewer, org["id"], created["id"], expect=403)

    # nothing changed
    stored = await _get(client, owner, org["id"], created["id"])
    assert stored["name"] == "Viewable"


@pytest.mark.asyncio
async def test_outsider_forbidden_everywhere(client: AsyncClient) -> None:
    a = await _signup_verified(client, "member-a@example.com")
    org_a = await _create_org(client, a, name="Org A")
    created = await _create(client, a, org_a["id"], {"name": "Private plan"})

    b = await _signup_verified(client, "member-b@example.com")
    await _list(client, b, org_a["id"], expect=403)
    await _get(client, b, org_a["id"], created["id"], expect=403)
    await _create(client, b, org_a["id"], {"name": "x"}, expect=403)
    await _patch(
        client, b, org_a["id"], created["id"], {"name": "x"}, expect=403
    )
    await _delete(client, b, org_a["id"], created["id"], expect=403)


@pytest.mark.asyncio
async def test_anonymous_401(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(client, auth, org["id"], {"name": "Secured"})
    ghost_id = str(uuid.uuid4())

    resp = await client.get(f"/api/v1/organizations/{org['id']}/milestones")
    assert resp.status_code == 401, resp.text
    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/milestones/{created['id']}"
    )
    assert resp.status_code == 401, resp.text
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/milestones", json={"name": "x"}
    )
    assert resp.status_code == 401, resp.text
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/milestones/{created['id']}",
        json={"name": "x"},
    )
    assert resp.status_code == 401, resp.text
    resp = await client.delete(
        f"/api/v1/organizations/{org['id']}/milestones/{ghost_id}"
    )
    assert resp.status_code == 401, resp.text


# --- cross-organization ------------------------------------------------------


@pytest.mark.asyncio
async def test_cross_org_milestone_id_404(client: AsyncClient) -> None:
    """A member of org B cannot touch org A's milestone via org B's path
    (and vice versa): lookups are always scoped to the path org."""
    a = await _signup_verified(client, "multi@example.com")
    org_a = await _create_org(client, a, name="Org A")
    org_b = await _create_org(client, a, name="Org B")
    in_a = await _create(client, a, org_a["id"], {"name": "Only in A"})

    # caller IS a member of org B, so membership passes; the row is not
    # in org B -> 404 (never a 403 oracle, never a cross-org write)
    await _get(client, a, org_b["id"], in_a["id"], expect=404)
    await _patch(client, a, org_b["id"], in_a["id"], {"name": "x"}, expect=404)
    await _delete(client, a, org_b["id"], in_a["id"], expect=404)

    # sanity: still readable and unchanged in its own org
    stored = await _get(client, a, org_a["id"], in_a["id"])
    assert stored["name"] == "Only in A"


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["create", "patch"])
async def test_owner_must_be_active_member_of_same_org(
    client: AsyncClient, endpoint: str
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth, name="Org A")
    outsider = await _signup_verified(client, "outsider@example.com")
    other_org = await _create_org(client, outsider, name="Org B")
    outsider_id = await _user_id(client, outsider)

    payload = {"owner_id": outsider_id}
    if endpoint == "create":
        resp = await client.post(
            f"/api/v1/organizations/{org['id']}/milestones",
            json={"name": "Bad owner", **payload},
            headers=auth["headers"],
        )
    else:
        created = await _create(client, auth, org["id"], {"name": "Seed"})
        resp = await client.patch(
            f"/api/v1/organizations/{org['id']}/milestones/{created['id']}",
            json=payload,
            headers=auth["headers"],
        )
    assert resp.status_code == 422, resp.text
    details = resp.json()["error"]["details"]
    assert details[0]["loc"] == ["body", "owner_id"]

    # sanity: the other org still exists and works (no side effects)
    await _list(client, outsider, other_org["id"])


@pytest.mark.asyncio
async def test_owner_invited_but_not_active_rejected(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    pending = await _signup_verified(client, "pending@example.com")

    # invite created but NOT accepted -> not an active member yet
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": pending["email"], "role": "member"},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text

    created = await _create(
        client, auth, org["id"], {"name": "Needs an owner"}
    )
    patched = await _patch(
        client,
        auth,
        org["id"],
        created["id"],
        {"owner_id": await _user_id(client, pending)},
        expect=422,
    )
    assert patched == {}


@pytest.mark.asyncio
async def test_owner_accepted_member_allowed(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    mate = await _signup_verified(client, "mate@example.com")
    await _invite_member(client, auth, mate, org, role="member")

    created = await _create(
        client,
        auth,
        org["id"],
        {"name": "Owned", "owner_id": await _user_id(client, mate)},
    )
    assert created["owner_id"] == await _user_id(client, mate)


# --- non-startup and dead orgs ----------------------------------------------


@pytest.mark.asyncio
async def test_non_startup_org_404(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "employer@example.com", role="employer")
    org = await _create_org(client, auth, name="Acme Hiring", type_="employer")
    await _list(client, auth, org["id"], expect=404)
    await _create(client, auth, org["id"], {"name": "x"}, expect=404)


@pytest.mark.asyncio
async def test_suspended_and_deleted_org_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth, name="Doomed Labs")

    result = await db_session.execute(
        select(Organization).where(Organization.id == uuid.UUID(org["id"]))
    )
    row = result.scalar_one()
    row.status = "suspended"
    await db_session.commit()
    await _list(client, auth, org["id"], expect=404)

    row.status = "active"
    row.deleted_at = datetime.now(UTC)
    await db_session.commit()
    await _create(client, auth, org["id"], {"name": "x"}, expect=404)


# --- validation and mass assignment -----------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payload", "expect_field"),
    [
        ({"name": ""}, "name"),
        ({"name": "   "}, "name"),
        ({"name": "x" * 201}, "name"),
        ({"name": "ok", "progress": -1}, "progress"),
        ({"name": "ok", "progress": 101}, "progress"),
        ({"name": "ok", "status": "done"}, "status"),
        ({"name": "ok", "target_date": "not-a-date"}, "target_date"),
        ({"name": "ok", "owner_id": "not-a-uuid"}, "owner_id"),
        ({"name": "ok", "description": "x" * 5001}, "description"),
        ({"name": "ok", "unexpected": True}, "unexpected"),
    ],
)
async def test_create_validation_errors(
    client: AsyncClient, payload: dict, expect_field: str
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/milestones",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text
    details = resp.json()["error"]["details"]
    assert any(expect_field in entry.get("loc", ()) for entry in details), details


@pytest.mark.asyncio
async def test_patch_rejects_null_for_not_null_columns(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(client, auth, org["id"], {"name": "Keep me"})

    await _patch(client, auth, org["id"], created["id"], {"name": None}, expect=422)
    await _patch(client, auth, org["id"], created["id"], {"status": None}, expect=422)
    await _patch(client, auth, org["id"], created["id"], {"progress": None}, expect=422)

    stored = await _get(client, auth, org["id"], created["id"])
    assert stored["name"] == "Keep me"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("id", "00000000-0000-0000-0000-000000000001"),
        ("org_id", "00000000-0000-0000-0000-000000000002"),
        ("created_at", "2020-01-01T00:00:00Z"),
        ("updated_at", "2020-01-01T00:00:00Z"),
        ("deleted_at", "2020-01-01T00:00:00Z"),
    ],
)
async def test_mass_assignment_server_controlled_fields(
    client: AsyncClient, field: str, value: object
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)

    # create attempts
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/milestones",
        json={"name": "Sneaky", field: value},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    # patch attempts
    created = await _create(client, auth, org["id"], {"name": "Honest"})
    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/milestones/{created['id']}",
        json={field: value},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    stored = await _get(client, auth, org["id"], created["id"])
    assert stored["org_id"] == org["id"]
    assert stored["id"] == created["id"]
    # still live: not soft-deleted by the mass-assignment attempt
    page = await _list(client, auth, org["id"])
    assert page["total"] == 1


# --- list: pagination, sort, filter, soft delete -----------------------------


@pytest.mark.asyncio
async def test_list_pagination_sort_and_filter(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)

    await _create(
        client, auth, org["id"],
        {"name": "Bravo", "target_date": "2026-12-01", "status": "on_track"},
    )
    await _create(
        client, auth, org["id"],
        {"name": "Alpha", "target_date": "2026-11-01", "status": "at_risk"},
    )
    await _create(
        client, auth, org["id"],
        {"name": "Charlie", "target_date": None, "status": "on_track"},
    )
    await _create(
        client, auth, org["id"],
        {"name": "Delta", "target_date": "2026-11-15", "status": "on_track"},
    )

    # default sort: target_date asc, undated last
    page = await _list(client, auth, org["id"])
    assert page["total"] == 4
    assert [m["name"] for m in page["items"]] == ["Alpha", "Delta", "Bravo", "Charlie"]
    assert page["limit"] == 20 and page["offset"] == 0

    # limit/offset pages never overlap and keep the total
    first = await _list(client, auth, org["id"], {"limit": 2})
    assert [m["name"] for m in first["items"]] == ["Alpha", "Delta"]
    assert first["total"] == 4
    second = await _list(client, auth, org["id"], {"limit": 2, "offset": 2})
    assert [m["name"] for m in second["items"]] == ["Bravo", "Charlie"]

    # filter by status
    risky = await _list(client, auth, org["id"], {"status": "at_risk"})
    assert [m["name"] for m in risky["items"]] == ["Alpha"]
    assert risky["total"] == 1

    # whitelisted sort + order
    by_name = await _list(
        client, auth, org["id"], {"sort": "name", "order": "desc"}
    )
    assert [m["name"] for m in by_name["items"]] == [
        "Delta", "Charlie", "Bravo", "Alpha",
    ]

    # undated stays last in descending date order too
    desc = await _list(client, auth, org["id"], {"order": "desc"})
    assert [m["name"] for m in desc["items"]] == [
        "Bravo", "Delta", "Alpha", "Charlie",
    ]

    # whitelisted params enforced
    await _list(client, auth, org["id"], {"sort": "banana"}, expect=422)
    await _list(client, auth, org["id"], {"order": "sideways"}, expect=422)
    await _list(client, auth, org["id"], {"limit": 0}, expect=422)
    await _list(client, auth, org["id"], {"limit": 101}, expect=422)
    await _list(client, auth, org["id"], {"offset": -1}, expect=422)
    await _list(client, auth, org["id"], {"status": "zombie"}, expect=422)


@pytest.mark.asyncio
async def test_soft_delete_semantics(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    kept = await _create(client, auth, org["id"], {"name": "Survivor"})
    doomed = await _create(client, auth, org["id"], {"name": "Doomed"})

    await _delete(client, auth, org["id"], doomed["id"])

    # gone from reads and lists, row is recoverable server-side only
    await _get(client, auth, org["id"], doomed["id"], expect=404)
    await _patch(
        client, auth, org["id"], doomed["id"], {"name": "zombie"}, expect=404
    )
    await _delete(client, auth, org["id"], doomed["id"], expect=404)

    page = await _list(client, auth, org["id"])
    assert page["total"] == 1
    assert [m["name"] for m in page["items"]] == ["Survivor"]
    await _get(client, auth, org["id"], kept["id"])
