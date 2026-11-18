"""Step 5c tests: tasks — CRUD, move/reorder, permissions, IDOR, validation.

Covers happy path / validation / authentication / authorization (wrong
role, wrong organization), cross-organization references (milestone id
and assignee id), soft-delete semantics, filters / sort / pagination,
the move endpoint's completion-time lifecycle (plan D6) and midpoint
reorder with per-column rebalance (plan D3), mass-assignment attempts on
server-controlled fields, and the per-member ``task_count`` (plan item 3).
"""

import re
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.task import Task
from app.services import email_service

PASSWORD = "Str0ng!Password99"


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
    client: AsyncClient,
    auth: dict,
    *,
    name: str = "Acme Rockets",
    type_: str = "startup",
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


# --- task helpers ------------------------------------------------------------


def _tasks_url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/tasks"


async def _create(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    payload: dict,
    expect: int = 201,
) -> dict:
    resp = await client.post(
        _tasks_url(org_id), json=payload, headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 201 else {}


async def _list(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    params: dict | None = None,
    expect: int = 200,
) -> dict:
    resp = await client.get(
        _tasks_url(org_id), params=params or {}, headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _get(
    client: AsyncClient, auth: dict, org_id: str, task_id: str, expect: int = 200
) -> dict:
    resp = await client.get(
        f"{_tasks_url(org_id)}/{task_id}", headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _patch(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    task_id: str,
    payload: dict,
    expect: int = 200,
) -> dict:
    resp = await client.patch(
        f"{_tasks_url(org_id)}/{task_id}",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _move(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    task_id: str,
    payload: dict,
    expect: int = 200,
) -> dict:
    resp = await client.patch(
        f"{_tasks_url(org_id)}/{task_id}/move",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else {}


async def _delete(
    client: AsyncClient, auth: dict, org_id: str, task_id: str, expect: int = 204
) -> None:
    resp = await client.delete(
        f"{_tasks_url(org_id)}/{task_id}", headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text


async def _create_milestone(
    client: AsyncClient, auth: dict, org_id: str, name: str = "Launch"
) -> dict:
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/milestones",
        json={"name": name},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _column_orders(page: dict, status: str) -> list[int]:
    """display_order values of one column, in the list's default order."""
    return [t["display_order"] for t in page["items"] if t["status"] == status]


# --- create and read --------------------------------------------------------


@pytest.mark.asyncio
async def test_create_defaults_and_get(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    me_id = await _user_id(client, auth)

    created = await _create(client, auth, org["id"], {"title": "Draft the deck"})
    assert created["org_id"] == org["id"]
    assert created["title"] == "Draft the deck"
    # D6: new tasks always start in the todo column
    assert created["status"] == "todo"
    assert created["priority"] == "medium"
    assert created["description"] is None
    assert created["milestone_id"] is None
    assert created["assignee_id"] is None
    assert created["due_on"] is None
    assert created["completed_at"] is None
    # server-owned, never client-supplied
    assert created["created_by"] == me_id
    assert created["display_order"] == 0
    # D1: the readiness column is not API-exposed in 5c
    assert "readiness_id" not in created
    assert "deleted_at" not in created

    fetched = await _get(client, auth, org["id"], created["id"])
    assert fetched["id"] == created["id"]
    assert fetched["title"] == "Draft the deck"


@pytest.mark.asyncio
async def test_create_full_fields_persist(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    mate = await _signup_verified(client, "mate@example.com")
    await _invite_member(client, auth, mate, org, role="member")
    mate_id = await _user_id(client, mate)
    milestone = await _create_milestone(client, auth, org["id"], "Seed round")

    created = await _create(
        client,
        auth,
        org["id"],
        {
            "title": "  Rewrite the landing page  ",
            "description": "Focus on the investor story.",
            "priority": "urgent",
            "milestone_id": milestone["id"],
            "assignee_id": mate_id,
            "due_on": "2026-12-01",
        },
    )
    assert created["title"] == "Rewrite the landing page"  # trimmed
    assert created["description"] == "Focus on the investor story."
    assert created["priority"] == "urgent"
    assert created["milestone_id"] == milestone["id"]
    assert created["assignee_id"] == mate_id
    assert created["due_on"] == "2026-12-01"


@pytest.mark.asyncio
async def test_create_appends_to_todo_column(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)

    first = await _create(client, auth, org["id"], {"title": "First"})
    second = await _create(client, auth, org["id"], {"title": "Second"})
    assert first["display_order"] == 0
    assert second["display_order"] == 1

    page = await _list(client, auth, org["id"])
    assert [t["title"] for t in page["items"]] == ["First", "Second"]


@pytest.mark.asyncio
async def test_update_roundtrip_and_omitted_unchanged(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(
        client,
        auth,
        org["id"],
        {"title": "Original", "description": "Keep", "priority": "high"},
    )

    updated = await _patch(
        client, auth, org["id"], created["id"], {"title": "Renamed"}
    )
    assert updated["title"] == "Renamed"
    assert updated["description"] == "Keep"  # omitted -> unchanged
    assert updated["priority"] == "high"

    cleared = await _patch(
        client,
        auth,
        org["id"],
        created["id"],
        {"description": None, "priority": "low"},
    )
    assert cleared["description"] is None
    assert cleared["priority"] == "low"

    # PATCH never touches status / display_order / completed_at (D6)
    assert cleared["status"] == "todo"
    assert cleared["display_order"] == created["display_order"]
    assert cleared["completed_at"] is None


# --- permissions -------------------------------------------------------------


@pytest.mark.asyncio
async def test_viewer_reads_but_cannot_write(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    created = await _create(client, owner, org["id"], {"title": "Viewable"})

    viewer = await _signup_verified(client, "viewer@example.com")
    await _invite_member(client, owner, viewer, org, role="viewer")

    page = await _list(client, viewer, org["id"])
    assert page["total"] == 1
    await _get(client, viewer, org["id"], created["id"])
    await _create(client, viewer, org["id"], {"title": "nope"}, expect=403)
    await _patch(
        client, viewer, org["id"], created["id"], {"title": "nope"}, expect=403
    )
    await _move(
        client, viewer, org["id"], created["id"], {"status": "done"}, expect=403
    )
    await _delete(client, viewer, org["id"], created["id"], expect=403)

    stored = await _get(client, owner, org["id"], created["id"])
    assert stored["title"] == "Viewable"
    assert stored["status"] == "todo"


@pytest.mark.asyncio
async def test_member_can_write(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    mate = await _signup_verified(client, "mate@example.com")
    await _invite_member(client, owner, mate, org, role="member")

    created = await _create(client, mate, org["id"], {"title": "Member task"})
    await _patch(client, mate, org["id"], created["id"], {"title": "Edited"})
    await _move(client, mate, org["id"], created["id"], {"status": "in_progress"})
    await _delete(client, mate, org["id"], created["id"])


@pytest.mark.asyncio
async def test_outsider_forbidden_everywhere(client: AsyncClient) -> None:
    a = await _signup_verified(client, "member-a@example.com")
    org_a = await _create_org(client, a, name="Org A")
    created = await _create(client, a, org_a["id"], {"title": "Private task"})

    b = await _signup_verified(client, "member-b@example.com")
    await _list(client, b, org_a["id"], expect=403)
    await _get(client, b, org_a["id"], created["id"], expect=403)
    await _create(client, b, org_a["id"], {"title": "x"}, expect=403)
    await _patch(
        client, b, org_a["id"], created["id"], {"title": "x"}, expect=403
    )
    await _move(
        client, b, org_a["id"], created["id"], {"status": "done"}, expect=403
    )
    await _delete(client, b, org_a["id"], created["id"], expect=403)


@pytest.mark.asyncio
async def test_anonymous_401(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(client, auth, org["id"], {"title": "Secured"})
    ghost_id = str(uuid.uuid4())

    resp = await client.get(_tasks_url(org["id"]))
    assert resp.status_code == 401, resp.text
    resp = await client.get(f"{_tasks_url(org['id'])}/{created['id']}")
    assert resp.status_code == 401, resp.text
    resp = await client.post(_tasks_url(org["id"]), json={"title": "x"})
    assert resp.status_code == 401, resp.text
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{created['id']}", json={"title": "x"}
    )
    assert resp.status_code == 401, resp.text
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{created['id']}/move", json={"status": "done"}
    )
    assert resp.status_code == 401, resp.text
    resp = await client.delete(f"{_tasks_url(org['id'])}/{ghost_id}")
    assert resp.status_code == 401, resp.text


# --- cross-organization ------------------------------------------------------


@pytest.mark.asyncio
async def test_cross_org_task_id_404(client: AsyncClient) -> None:
    """A member of org B cannot touch org A's task through org B's path."""
    a = await _signup_verified(client, "multi@example.com")
    org_a = await _create_org(client, a, name="Org A")
    org_b = await _create_org(client, a, name="Org B")
    in_a = await _create(client, a, org_a["id"], {"title": "Only in A"})

    await _get(client, a, org_b["id"], in_a["id"], expect=404)
    await _patch(client, a, org_b["id"], in_a["id"], {"title": "x"}, expect=404)
    await _move(
        client, a, org_b["id"], in_a["id"], {"status": "done"}, expect=404
    )
    await _delete(client, a, org_b["id"], in_a["id"], expect=404)

    stored = await _get(client, a, org_a["id"], in_a["id"])
    assert stored["title"] == "Only in A"
    assert stored["status"] == "todo"


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["create", "patch"])
async def test_assignee_must_be_active_member_of_same_org(
    client: AsyncClient, endpoint: str
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth, name="Org A")
    outsider = await _signup_verified(client, "outsider@example.com")
    other_org = await _create_org(client, outsider, name="Org B")
    outsider_id = await _user_id(client, outsider)

    if endpoint == "create":
        resp = await client.post(
            _tasks_url(org["id"]),
            json={"title": "Bad assignee", "assignee_id": outsider_id},
            headers=auth["headers"],
        )
    else:
        created = await _create(client, auth, org["id"], {"title": "Seed"})
        resp = await client.patch(
            f"{_tasks_url(org['id'])}/{created['id']}",
            json={"assignee_id": outsider_id},
            headers=auth["headers"],
        )
    assert resp.status_code == 422, resp.text
    details = resp.json()["error"]["details"]
    assert details[0]["loc"] == ["body", "assignee_id"]

    # sanity: the outsider's own org still works
    await _list(client, outsider, other_org["id"])


@pytest.mark.asyncio
async def test_assignee_invited_but_not_active_rejected(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    pending = await _signup_verified(client, "pending@example.com")

    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": pending["email"], "role": "member"},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text

    created = await _create(client, auth, org["id"], {"title": "Needs an owner"})
    await _patch(
        client,
        auth,
        org["id"],
        created["id"],
        {"assignee_id": await _user_id(client, pending)},
        expect=422,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["create", "patch"])
async def test_milestone_must_belong_to_same_org(
    client: AsyncClient, endpoint: str
) -> None:
    a = await _signup_verified(client, "multi@example.com")
    org_a = await _create_org(client, a, name="Org A")
    org_b = await _create_org(client, a, name="Org B")
    foreign = await _create_milestone(client, a, org_b["id"], "Only in B")

    if endpoint == "create":
        resp = await client.post(
            _tasks_url(org_a["id"]),
            json={"title": "Bad milestone", "milestone_id": foreign["id"]},
            headers=a["headers"],
        )
    else:
        created = await _create(client, a, org_a["id"], {"title": "Seed"})
        resp = await client.patch(
            f"{_tasks_url(org_a['id'])}/{created['id']}",
            json={"milestone_id": foreign["id"]},
            headers=a["headers"],
        )
    assert resp.status_code == 422, resp.text
    details = resp.json()["error"]["details"]
    assert details[0]["loc"] == ["body", "milestone_id"]


@pytest.mark.asyncio
async def test_milestone_soft_deleted_rejected(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    milestone = await _create_milestone(client, auth, org["id"], "Doomed")

    gone = await client.delete(
        f"/api/v1/organizations/{org['id']}/milestones/{milestone['id']}",
        headers=auth["headers"],
    )
    assert gone.status_code == 204, gone.text

    await _create(
        client,
        auth,
        org["id"],
        {"title": "Stale link", "milestone_id": milestone["id"]},
        expect=422,
    )


# --- non-startup and dead orgs ----------------------------------------------


@pytest.mark.asyncio
async def test_non_startup_org_404(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "employer@example.com", role="employer")
    org = await _create_org(client, auth, name="Acme Hiring", type_="employer")
    await _list(client, auth, org["id"], expect=404)
    await _create(client, auth, org["id"], {"title": "x"}, expect=404)


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
    await _create(client, auth, org["id"], {"title": "x"}, expect=404)


# --- validation and mass assignment -----------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payload", "expect_field"),
    [
        ({}, "title"),
        ({"title": ""}, "title"),
        ({"title": "   "}, "title"),
        ({"title": "x" * 201}, "title"),
        ({"title": "ok", "description": "x" * 5001}, "description"),
        ({"title": "ok", "priority": "whenever"}, "priority"),
        ({"title": "ok", "due_on": "not-a-date"}, "due_on"),
        ({"title": "ok", "assignee_id": "not-a-uuid"}, "assignee_id"),
        ({"title": "ok", "milestone_id": "not-a-uuid"}, "milestone_id"),
        ({"title": "ok", "unexpected": True}, "unexpected"),
    ],
)
async def test_create_validation_errors(
    client: AsyncClient, payload: dict, expect_field: str
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    resp = await client.post(
        _tasks_url(org["id"]), json=payload, headers=auth["headers"]
    )
    assert resp.status_code == 422, resp.text
    details = resp.json()["error"]["details"]
    assert any(expect_field in entry.get("loc", ()) for entry in details), details


@pytest.mark.asyncio
async def test_patch_rejects_null_for_not_null_columns(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(client, auth, org["id"], {"title": "Keep me"})

    await _patch(client, auth, org["id"], created["id"], {"title": None}, expect=422)
    await _patch(
        client, auth, org["id"], created["id"], {"priority": None}, expect=422
    )

    stored = await _get(client, auth, org["id"], created["id"])
    assert stored["title"] == "Keep me"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("id", "00000000-0000-0000-0000-000000000001"),
        ("org_id", "00000000-0000-0000-0000-000000000002"),
        ("created_by", "00000000-0000-0000-0000-000000000003"),
        ("readiness_id", "00000000-0000-0000-0000-000000000004"),
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

    # D1: readiness_id exists as a column but is absent from every 5c schema
    resp = await client.post(
        _tasks_url(org["id"]),
        json={"title": "Sneaky", field: value},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    created = await _create(client, auth, org["id"], {"title": "Honest"})
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{created['id']}",
        json={field: value},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    stored = await _get(client, auth, org["id"], created["id"])
    assert stored["org_id"] == org["id"]
    assert stored["id"] == created["id"]
    page = await _list(client, auth, org["id"])
    assert page["total"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("status", "done"),
        ("completed_at", "2026-01-01T00:00:00Z"),
        ("display_order", 5),
    ],
)
async def test_patch_rejects_move_only_fields(
    client: AsyncClient, field: str, value: object
) -> None:
    """D6: status / completed_at / display_order are written by /move only."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)

    resp = await client.post(
        _tasks_url(org["id"]),
        json={"title": "Sneaky", field: value},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    created = await _create(client, auth, org["id"], {"title": "Honest"})
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{created['id']}",
        json={field: value},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    stored = await _get(client, auth, org["id"], created["id"])
    assert stored["status"] == "todo"
    assert stored["completed_at"] is None
    assert stored["display_order"] == created["display_order"]


# --- move: column lifecycle (plan D6) ---------------------------------------


@pytest.mark.asyncio
async def test_move_column_lifecycle_completed_at(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(client, auth, org["id"], {"title": "Ship it"})

    done = await _move(client, auth, org["id"], created["id"], {"status": "done"})
    assert done["status"] == "done"
    assert done["completed_at"] is not None

    # moving inside done keeps the original completion time
    again = await _move(client, auth, org["id"], created["id"], {"status": "done"})
    assert again["completed_at"] == done["completed_at"]

    # leaving done clears it
    reopened = await _move(
        client, auth, org["id"], created["id"], {"status": "in_progress"}
    )
    assert reopened["status"] == "in_progress"
    assert reopened["completed_at"] is None

    back = await _move(client, auth, org["id"], created["id"], {"status": "done"})
    assert back["completed_at"] is not None


@pytest.mark.asyncio
async def test_move_done_without_status_self_heals_completed_at(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """D6: a done task must always carry a completion time."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(client, auth, org["id"], {"title": "Legacy row"})
    await _move(client, auth, org["id"], created["id"], {"status": "done"})

    # simulate a row written before the rule existed
    result = await db_session.execute(
        select(Task).where(Task.id == uuid.UUID(created["id"]))
    )
    row = result.scalar_one()
    row.completed_at = None
    await db_session.commit()

    healed = await _move(client, auth, org["id"], created["id"], {"status": "done"})
    assert healed["completed_at"] is not None


@pytest.mark.asyncio
async def test_move_to_column_end_appends(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    a = await _create(client, auth, org["id"], {"title": "A"})
    b = await _create(client, auth, org["id"], {"title": "B"})
    moved = await _move(client, auth, org["id"], a["id"], {"status": "in_review"})
    assert moved["display_order"] == 0  # empty column starts at 0

    page = await _list(client, auth, org["id"], {"status": "todo"})
    assert [t["title"] for t in page["items"]] == ["B"]
    assert page["items"][0]["display_order"] == b["display_order"]


# --- move: reorder (plan D3) ------------------------------------------------


@pytest.mark.asyncio
async def test_reorder_before_and_after_uses_midpoints(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    a = await _create(client, auth, org["id"], {"title": "A"})  # order 0
    b = await _create(client, auth, org["id"], {"title": "B"})  # order 1
    c = await _create(client, auth, org["id"], {"title": "C"})  # order 2

    # move C before A: new minimum -> order < 0
    moved = await _move(
        client, auth, org["id"], c["id"], {"before_id": a["id"]}
    )
    assert moved["display_order"] < a["display_order"]

    page = await _list(client, auth, org["id"])
    assert [t["title"] for t in page["items"]] == ["C", "A", "B"]

    # move A after B: append at the end -> max + 1
    moved = await _move(client, auth, org["id"], a["id"], {"after_id": b["id"]})
    page = await _list(client, auth, org["id"])
    assert [t["title"] for t in page["items"]] == ["C", "B", "A"]
    assert moved["display_order"] > b["display_order"]

    # gap now exists between C (-1) and B (1): midpoint insert
    moved = await _move(
        client, auth, org["id"], a["id"], {"before_id": b["id"]}
    )
    page = await _list(client, auth, org["id"])
    assert [t["title"] for t in page["items"]] == ["C", "A", "B"]
    orders = [t["display_order"] for t in page["items"]]
    assert orders[0] < moved["display_order"] < orders[2]


@pytest.mark.asyncio
async def test_reorder_rebalances_only_when_no_gap(client: AsyncClient) -> None:
    """Two adjacent tasks leave no integer gap, so the column is renumbered
    (x10) once and the slot recomputed — the D3 no-gap branch."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    await _create(client, auth, org["id"], {"title": "First"})  # 0
    await _create(client, auth, org["id"], {"title": "Second"})  # 1

    # A task living in ANOTHER column, parked at display_order 0: the
    # rebalance below must leave it (and its column) alone.
    spectator = await _create(client, auth, org["id"], {"title": "Spectator"})
    await _move(
        client, auth, org["id"], spectator["id"], {"status": "in_progress"}
    )

    mover = await _create(client, auth, org["id"], {"title": "Mover"})
    # park "Mover" in the other column too, so it is not in todo
    await _move(
        client, auth, org["id"], mover["id"], {"status": "in_progress"}
    )

    todo = await _list(client, auth, org["id"], {"status": "todo"})
    first, second = todo["items"][0], todo["items"][1]
    assert [first["display_order"], second["display_order"]] == [0, 1]

    # insert between two adjacent rows: next - prev > 1 is false -> rebalance
    moved = await _move(
        client,
        auth,
        org["id"],
        mover["id"],
        {"status": "todo", "after_id": first["id"]},
    )
    page = await _list(client, auth, org["id"], {"status": "todo"})
    assert [t["title"] for t in page["items"]] == ["First", "Mover", "Second"]
    assert _column_orders(page, "todo") == [0, 5, 10]
    assert moved["display_order"] == 5

    # the other column was NOT renumbered (per-column rebalance only):
    # the spectator keeps its own order untouched.
    other = await _list(client, auth, org["id"], {"status": "in_progress"})
    assert [t["title"] for t in other["items"]] == ["Spectator"]
    assert other["items"][0]["display_order"] == 0


@pytest.mark.asyncio
async def test_move_between_columns_with_anchor(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    target = await _create(client, auth, org["id"], {"title": "Target"})
    mover = await _create(client, auth, org["id"], {"title": "Mover"})

    await _move(
        client, auth, org["id"], target["id"], {"status": "in_progress"}
    )
    moved = await _move(
        client,
        auth,
        org["id"],
        mover["id"],
        {"status": "in_progress", "before_id": target["id"]},
    )
    assert moved["status"] == "in_progress"
    assert moved["display_order"] < target["display_order"]

    page = await _list(client, auth, org["id"], {"status": "in_progress"})
    assert [t["title"] for t in page["items"]] == ["Mover", "Target"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {},  # no action at all
        {"before_id": None, "after_id": None},  # both absent
        {"status": "zombie"},  # bad enum
    ],
)
async def test_move_validation_errors(
    client: AsyncClient, payload: dict
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    first = await _create(client, auth, org["id"], {"title": "First"})
    second = await _create(client, auth, org["id"], {"title": "Second"})

    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{first['id']}/move",
        json=payload,
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    # nothing moved
    stored = await _get(client, auth, org["id"], first["id"])
    assert stored["status"] == "todo"
    assert stored["display_order"] < second["display_order"]


@pytest.mark.asyncio
async def test_move_rejects_both_anchors(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    first = await _create(client, auth, org["id"], {"title": "First"})
    second = await _create(client, auth, org["id"], {"title": "Second"})

    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{first['id']}/move",
        json={"before_id": second["id"], "after_id": second["id"]},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_move_anchor_rules(client: AsyncClient) -> None:
    """Anchors must be open tasks of the TARGET column in the same org."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth, name="Org A")
    other_org = await _create_org(client, auth, name="Org B")
    mover = await _create(client, auth, org["id"], {"title": "Mover"})
    same_col = await _create(client, auth, org["id"], {"title": "Same column"})
    elsewhere = await _create(client, auth, org["id"], {"title": "Elsewhere"})
    await _move(
        client, auth, org["id"], elsewhere["id"], {"status": "in_progress"}
    )
    foreign = await _create(client, auth, other_org["id"], {"title": "Foreign"})
    doomed = await _create(client, auth, org["id"], {"title": "Doomed"})
    await _delete(client, auth, org["id"], doomed["id"])

    # self-anchor
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{mover['id']}/move",
        json={"before_id": mover["id"]},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    # anchor lives in another column than the target one
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{mover['id']}/move",
        json={"before_id": elsewhere["id"]},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text
    details = resp.json()["error"]["details"]
    assert details[0]["loc"] == ["body", "before_id"]

    # anchor from another organization
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{mover['id']}/move",
        json={"after_id": foreign["id"]},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    # deleted anchor
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{mover['id']}/move",
        json={"after_id": doomed["id"]},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    # unknown anchor id
    resp = await client.patch(
        f"{_tasks_url(org['id'])}/{mover['id']}/move",
        json={"before_id": str(uuid.uuid4())},
        headers=auth["headers"],
    )
    assert resp.status_code == 422, resp.text

    # nothing moved by any rejected attempt
    stored = await _get(client, auth, org["id"], mover["id"])
    assert stored["status"] == "todo"
    assert stored["display_order"] < same_col["display_order"]


@pytest.mark.asyncio
async def test_move_accepts_blocked_and_unknown_status_ok(client: AsyncClient) -> None:
    """The enum also has ``blocked`` (no board column yet) — it is accepted."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(client, auth, org["id"], {"title": "Waiting"})

    moved = await _move(
        client, auth, org["id"], created["id"], {"status": "blocked"}
    )
    assert moved["status"] == "blocked"
    assert moved["completed_at"] is None


# --- delete ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_soft_delete_semantics(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    kept = await _create(client, auth, org["id"], {"title": "Survivor"})
    doomed = await _create(client, auth, org["id"], {"title": "Doomed"})

    await _delete(client, auth, org["id"], doomed["id"])

    await _get(client, auth, org["id"], doomed["id"], expect=404)
    await _patch(
        client, auth, org["id"], doomed["id"], {"title": "zombie"}, expect=404
    )
    await _move(
        client, auth, org["id"], doomed["id"], {"status": "done"}, expect=404
    )
    await _delete(client, auth, org["id"], doomed["id"], expect=404)

    page = await _list(client, auth, org["id"])
    assert page["total"] == 1
    assert [t["title"] for t in page["items"]] == ["Survivor"]
    await _get(client, auth, org["id"], kept["id"])

    # a deleted task is not a valid move anchor either (see anchor rules);
    # and its slot no longer affects the column
    fresh = await _create(client, auth, org["id"], {"title": "Fresh"})
    assert fresh["display_order"] > kept["display_order"]


# --- list: filters, sort, pagination ---------------------------------------


@pytest.mark.asyncio
async def test_list_pagination_and_sort_whitelist(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)

    for title in ("Alpha", "Bravo", "Charlie", "Delta"):
        await _create(client, auth, org["id"], {"title": title})

    page = await _list(client, auth, org["id"])
    assert page["total"] == 4
    assert [t["title"] for t in page["items"]] == [
        "Alpha",
        "Bravo",
        "Charlie",
        "Delta",
    ]
    assert page["limit"] == 20 and page["offset"] == 0

    first = await _list(client, auth, org["id"], {"limit": 2})
    second = await _list(client, auth, org["id"], {"limit": 2, "offset": 2})
    assert [t["title"] for t in first["items"]] == ["Alpha", "Bravo"]
    assert [t["title"] for t in second["items"]] == ["Charlie", "Delta"]
    assert first["total"] == second["total"] == 4

    desc = await _list(client, auth, org["id"], {"order": "desc"})
    assert [t["title"] for t in desc["items"]] == [
        "Delta",
        "Charlie",
        "Bravo",
        "Alpha",
    ]

    by_created = await _list(client, auth, org["id"], {"sort": "created_at"})
    assert by_created["total"] == 4

    await _list(client, auth, org["id"], {"sort": "banana"}, expect=422)
    await _list(client, auth, org["id"], {"order": "sideways"}, expect=422)
    await _list(client, auth, org["id"], {"limit": 0}, expect=422)
    await _list(client, auth, org["id"], {"limit": 101}, expect=422)
    await _list(client, auth, org["id"], {"offset": -1}, expect=422)
    await _list(client, auth, org["id"], {"status": "zombie"}, expect=422)
    await _list(client, auth, org["id"], {"priority": "zombie"}, expect=422)


@pytest.mark.asyncio
async def test_list_sort_by_due_on_undated_last(client: AsyncClient) -> None:
    """Undated tasks sort last in both directions (5b convention)."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    await _create(client, auth, org["id"], {"title": "Later", "due_on": "2026-12-20"})
    await _create(client, auth, org["id"], {"title": "Undated"})
    await _create(client, auth, org["id"], {"title": "Sooner", "due_on": "2026-11-01"})

    asc = await _list(client, auth, org["id"], {"sort": "due_on"})
    assert [t["title"] for t in asc["items"]] == ["Sooner", "Later", "Undated"]

    desc = await _list(
        client, auth, org["id"], {"sort": "due_on", "order": "desc"}
    )
    assert [t["title"] for t in desc["items"]] == ["Later", "Sooner", "Undated"]


@pytest.mark.asyncio
async def test_list_filters_assignee_priority_milestone_status(
    client: AsyncClient,
) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    mate = await _signup_verified(client, "mate@example.com")
    await _invite_member(client, auth, mate, org, role="member")
    mate_id = await _user_id(client, mate)
    milestone = await _create_milestone(client, auth, org["id"], "Launch")

    await _create(
        client,
        auth,
        org["id"],
        {
            "title": "Mates urgent",
            "assignee_id": mate_id,
            "priority": "urgent",
            "milestone_id": milestone["id"],
        },
    )
    await _create(client, auth, org["id"], {"title": "Mine low"})
    in_review = await _create(
        client, auth, org["id"], {"title": "Review", "assignee_id": mate_id}
    )
    await _move(
        client, auth, org["id"], in_review["id"], {"status": "in_review"}
    )

    by_assignee = await _list(
        client, auth, org["id"], {"assignee_id": mate_id}
    )
    assert {t["title"] for t in by_assignee["items"]} == {"Mates urgent", "Review"}
    assert by_assignee["total"] == 2

    by_priority = await _list(client, auth, org["id"], {"priority": "urgent"})
    assert [t["title"] for t in by_priority["items"]] == ["Mates urgent"]

    by_milestone = await _list(
        client, auth, org["id"], {"milestone_id": milestone["id"]}
    )
    assert [t["title"] for t in by_milestone["items"]] == ["Mates urgent"]

    by_status = await _list(client, auth, org["id"], {"status": "in_review"})
    assert [t["title"] for t in by_status["items"]] == ["Review"]

    # AND-combinable
    combined = await _list(
        client,
        auth,
        org["id"],
        {"assignee_id": mate_id, "status": "in_review", "priority": "medium"},
    )
    assert [t["title"] for t in combined["items"]] == ["Review"]

    nothing = await _list(
        client, auth, org["id"], {"assignee_id": mate_id, "priority": "low"}
    )
    assert nothing["total"] == 0
    assert nothing["items"] == []


@pytest.mark.asyncio
async def test_list_assigned_to_me(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    mate = await _signup_verified(client, "mate@example.com")
    await _invite_member(client, owner, mate, org, role="member")
    owner_id = await _user_id(client, owner)
    mate_id = await _user_id(client, mate)

    await _create(
        client, owner, org["id"], {"title": "Owner task", "assignee_id": owner_id}
    )
    await _create(
        client, owner, org["id"], {"title": "Mate task", "assignee_id": mate_id}
    )
    await _create(client, owner, org["id"], {"title": "Unassigned"})

    mine = await _list(client, owner, org["id"], {"assigned_to_me": True})
    assert [t["title"] for t in mine["items"]] == ["Owner task"]
    theirs = await _list(client, mate, org["id"], {"assigned_to_me": True})
    assert [t["title"] for t in theirs["items"]] == ["Mate task"]


@pytest.mark.asyncio
async def test_list_due_this_week(client: AsyncClient) -> None:
    """D4: due today..+7 (server UTC) AND not done."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    today = datetime.now(UTC).date()

    await _create(
        client,
        auth,
        org["id"],
        {"title": "Due today", "due_on": today.isoformat()},
    )
    await _create(
        client,
        auth,
        org["id"],
        {"title": "Due in 7", "due_on": (today + timedelta(days=7)).isoformat()},
    )
    await _create(
        client,
        auth,
        org["id"],
        {"title": "Due in 8", "due_on": (today + timedelta(days=8)).isoformat()},
    )
    await _create(
        client,
        auth,
        org["id"],
        {"title": "Overdue", "due_on": (today - timedelta(days=1)).isoformat()},
    )
    await _create(client, auth, org["id"], {"title": "Undated"})
    done = await _create(
        client,
        auth,
        org["id"],
        {"title": "Finished", "due_on": today.isoformat()},
    )
    await _move(client, auth, org["id"], done["id"], {"status": "done"})

    page = await _list(client, auth, org["id"], {"due_this_week": True})
    assert {t["title"] for t in page["items"]} == {"Due today", "Due in 7"}
    assert page["total"] == 2


# --- per-member task count (plan item 3) -----------------------------------


@pytest.mark.asyncio
async def test_members_task_count(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    mate = await _signup_verified(client, "mate@example.com")
    await _invite_member(client, owner, mate, org, role="member")
    owner_id = await _user_id(client, owner)
    mate_id = await _user_id(client, mate)

    for title in ("One", "Two", "Three"):
        await _create(
            client, owner, org["id"], {"title": title, "assignee_id": mate_id}
        )
    kept = await _create(
        client, owner, org["id"], {"title": "Mine", "assignee_id": owner_id}
    )
    doomed = await _create(
        client, owner, org["id"], {"title": "Doomed", "assignee_id": mate_id}
    )
    await _delete(client, owner, org["id"], doomed["id"])
    await _create(client, owner, org["id"], {"title": "Unassigned"})

    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/members", headers=owner["headers"]
    )
    assert resp.status_code == 200, resp.text
    counts = {m["user_id"]: m["task_count"] for m in resp.json()}
    assert counts[mate_id] == 3  # deleted task excluded
    assert counts[owner_id] == 1

    # the update response reports the same number (same read path)
    patch = await client.patch(
        f"/api/v1/organizations/{org['id']}/members/{mate_id}",
        json={"title": "Engineer"},
        headers=owner["headers"],
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["task_count"] == 3
    assert kept["assignee_id"] == owner_id


@pytest.mark.asyncio
async def test_members_task_count_is_per_org(client: AsyncClient) -> None:
    a = await _signup_verified(client, "multi@example.com")
    org_a = await _create_org(client, a, name="Org A")
    org_b = await _create_org(client, a, name="Org B")
    a_id = await _user_id(client, a)

    await _create(client, a, org_a["id"], {"title": "In A", "assignee_id": a_id})
    await _create(client, a, org_b["id"], {"title": "In B1", "assignee_id": a_id})
    await _create(client, a, org_b["id"], {"title": "In B2", "assignee_id": a_id})

    resp_a = await client.get(
        f"/api/v1/organizations/{org_a['id']}/members", headers=a["headers"]
    )
    resp_b = await client.get(
        f"/api/v1/organizations/{org_b['id']}/members", headers=a["headers"]
    )
    assert {m["user_id"]: m["task_count"] for m in resp_a.json()}[a_id] == 1
    assert {m["user_id"]: m["task_count"] for m in resp_b.json()}[a_id] == 2


# --- ordering stability -----------------------------------------------------


@pytest.mark.asyncio
async def test_default_order_is_stable_across_pages(client: AsyncClient) -> None:
    """display_order repeats per column; paging must never repeat or skip."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = []
    for i in range(6):
        created.append(
            await _create(client, auth, org["id"], {"title": f"T{i}"})
        )
    # spread tasks across columns so several share display_order 0
    for row in created[:3]:
        await _move(
            client, auth, org["id"], row["id"], {"status": "in_progress"}
        )

    seen: list[str] = []
    for offset in range(0, 6, 2):
        page = await _list(client, auth, org["id"], {"limit": 2, "offset": offset})
        seen.extend(t["title"] for t in page["items"])
    assert len(seen) == 6
    assert len(set(seen)) == 6


@pytest.mark.asyncio
async def test_unknown_task_and_malformed_ids(client: AsyncClient) -> None:
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    ghost = str(uuid.uuid4())

    await _get(client, auth, org["id"], ghost, expect=404)
    await _patch(client, auth, org["id"], ghost, {"title": "x"}, expect=404)
    await _move(client, auth, org["id"], ghost, {"status": "done"}, expect=404)
    await _delete(client, auth, org["id"], ghost, expect=404)

    resp = await client.get(
        f"{_tasks_url(org['id'])}/not-a-uuid", headers=auth["headers"]
    )
    assert resp.status_code == 422, resp.text
    resp = await client.get(
        "/api/v1/organizations/not-a-uuid/tasks", headers=auth["headers"]
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_task_dates_are_json_safe(client: AsyncClient) -> None:
    """due_on is a plain date, completed_at an ISO timestamp (UI contract)."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)
    created = await _create(
        client, auth, org["id"], {"title": "Dated", "due_on": date(2026, 12, 1).isoformat()}
    )
    assert created["due_on"] == "2026-12-01"

    done = await _move(client, auth, org["id"], created["id"], {"status": "done"})
    completed = done["completed_at"]
    assert isinstance(completed, str) and "T" in completed
