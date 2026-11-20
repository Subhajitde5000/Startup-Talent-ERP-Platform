"""Step 5d tests: task comments.

Covers happy path / validation / authentication / authorization (wrong
role, wrong organization, wrong author), cross-organization and
cross-task comment ids, mass-assignment on every server-controlled field,
soft-delete semantics, the per-actor rate limit, pagination ordering and
the approved D-9b audit rows (create + delete).
"""

import re
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.activity import ActivityEvent, ActivityEventType
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
    client: AsyncClient, auth: dict, *, name: str = "Acme Rockets", type_: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/organizations", json={"name": name, "type": type_}, headers=auth["headers"]
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


def _comments_url(org_id: str, task_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/tasks/{task_id}/comments"


async def _create_task(client: AsyncClient, auth: dict, org_id: str, title: str = "Ship it") -> dict:
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/tasks",
        json={"title": title},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _comment(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    task_id: str,
    body: str = "Looks good to me.",
    expect: int = 201,
) -> dict:
    resp = await client.post(
        _comments_url(org_id, task_id), json={"body": body}, headers=auth["headers"]
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 201 else {}


@pytest.fixture
async def team(client: AsyncClient) -> dict:
    owner = await _signup_verified(client, "owner@comments.dev")
    member = await _signup_verified(client, "member@comments.dev")
    viewer = await _signup_verified(client, "viewer@comments.dev")
    org = await _create_org(client, owner)
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")
    task = await _create_task(client, owner, org["id"])

    outsider = await _signup_verified(client, "outsider@comments.dev")
    other_org = await _create_org(client, outsider, name="Other Co")
    other_task = await _create_task(client, outsider, other_org["id"], "Theirs")
    return {
        "owner": owner,
        "member": member,
        "viewer": viewer,
        "outsider": outsider,
        "org": org,
        "task": task,
        "other_org": other_org,
        "other_task": other_task,
    }


# --- create -----------------------------------------------------------------


async def test_member_creates_comment(client: AsyncClient, team: dict) -> None:
    row = await _comment(
        client, team["member"], team["org"]["id"], team["task"]["id"], "  Looks good.  "
    )
    assert row["body"] == "Looks good."  # trimmed
    assert row["task_id"] == team["task"]["id"]
    assert row["author_id"] == await _user_id(client, team["member"])
    assert row["author_name"]
    assert row["can_edit"] is True
    assert row["can_delete"] is True


async def test_owner_comment_is_editable_by_owner_only(
    client: AsyncClient, team: dict
) -> None:
    owner_msg = await _comment(client, team["owner"], team["org"]["id"], team["task"]["id"])
    assert owner_msg["can_edit"] is True

    page = await client.get(
        _comments_url(team["org"]["id"], team["task"]["id"]),
        headers=team["member"]["headers"],
    )
    assert page.status_code == 200, page.text
    row = page.json()["items"][0]
    # A member cannot edit or delete someone else's comment...
    assert row["can_edit"] is False
    assert row["can_delete"] is False


async def test_admin_can_delete_but_not_edit_others(
    client: AsyncClient, team: dict
) -> None:
    admin = await _signup_verified(client, "admin@comments.dev")
    await _invite_member(client, team["owner"], admin, team["org"], role="admin")
    await _comment(client, team["member"], team["org"]["id"], team["task"]["id"])

    page = await client.get(
        _comments_url(team["org"]["id"], team["task"]["id"]), headers=admin["headers"]
    )
    row = page.json()["items"][0]
    assert row["can_edit"] is False
    assert row["can_delete"] is True


async def test_viewer_cannot_comment(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _comments_url(team["org"]["id"], team["task"]["id"]),
        json={"body": "hi"},
        headers=team["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_outsider_cannot_comment(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _comments_url(team["org"]["id"], team["task"]["id"]),
        json={"body": "hi"},
        headers=team["outsider"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_comment_requires_auth(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _comments_url(team["org"]["id"], team["task"]["id"]), json={"body": "hi"}
    )
    assert resp.status_code == 401


async def test_comment_on_other_org_task_is_404(
    client: AsyncClient, team: dict
) -> None:
    resp = await client.post(
        _comments_url(team["org"]["id"], team["other_task"]["id"]),
        json={"body": "hi"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_comment_on_unknown_task_is_404(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _comments_url(team["org"]["id"], "00000000-0000-0000-0000-000000000000"),
        json={"body": "hi"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_comment_on_deleted_task_is_404(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    task = await _create_task(client, team["owner"], org_id, "Temp")
    await client.delete(
        f"/api/v1/organizations/{org_id}/tasks/{task['id']}", headers=team["owner"]["headers"]
    )
    resp = await client.post(
        _comments_url(org_id, task["id"]), json={"body": "hi"}, headers=team["owner"]["headers"]
    )
    assert resp.status_code == 404, resp.text


# --- validation -------------------------------------------------------------


async def test_blank_body_rejected(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _comments_url(team["org"]["id"], team["task"]["id"]),
        json={"body": "    "},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_body_too_long_rejected(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _comments_url(team["org"]["id"], team["task"]["id"]),
        json={"body": "x" * 5001},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_body_at_limit_accepted(client: AsyncClient, team: dict) -> None:
    row = await _comment(
        client, team["owner"], team["org"]["id"], team["task"]["id"], "x" * 5000
    )
    assert len(row["body"]) == 5000


async def test_multiline_body_kept(client: AsyncClient, team: dict) -> None:
    body = "First line.\n\nSecond paragraph."
    row = await _comment(client, team["owner"], team["org"]["id"], team["task"]["id"], body)
    assert row["body"] == body


async def test_server_fields_cannot_be_mass_assigned(
    client: AsyncClient, team: dict
) -> None:
    """author_id, id, task_id, timestamps and deleted_at are not writable."""
    for extra in [
        {"author_id": "00000000-0000-0000-0000-000000000001"},
        {"id": "00000000-0000-0000-0000-000000000002"},
        {"task_id": "00000000-0000-0000-0000-000000000003"},
        {"created_at": "2020-01-01T00:00:00Z"},
        {"updated_at": "2020-01-01T00:00:00Z"},
        {"deleted_at": "2020-01-01T00:00:00Z"},
    ]:
        resp = await client.post(
            _comments_url(team["org"]["id"], team["task"]["id"]),
            json={"body": "hi", **extra},
            headers=team["owner"]["headers"],
        )
        assert resp.status_code == 422, f"{extra} accepted: {resp.text}"


async def test_author_cannot_be_forged(client: AsyncClient, team: dict) -> None:
    """A 422 body with author_id never lands a comment under that author."""
    forged = await _user_id(client, team["owner"])
    resp = await client.post(
        _comments_url(team["org"]["id"], team["task"]["id"]),
        json={"body": "I am the owner", "author_id": forged},
        headers=team["member"]["headers"],
    )
    assert resp.status_code == 422, resp.text
    page = await client.get(
        _comments_url(team["org"]["id"], team["task"]["id"]), headers=team["owner"]["headers"]
    )
    assert page.json()["total"] == 0


# --- list -------------------------------------------------------------------


async def test_list_comments_oldest_first(client: AsyncClient, team: dict) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    await _comment(client, team["owner"], org_id, task_id, "first")
    await _comment(client, team["owner"], org_id, task_id, "second")
    resp = await client.get(
        _comments_url(org_id, task_id), headers=team["viewer"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    assert [c["body"] for c in resp.json()["items"]] == ["first", "second"]
    assert resp.json()["total"] == 2


async def test_list_comments_pagination(client: AsyncClient, team: dict) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    for i in range(3):
        await _comment(client, team["owner"], org_id, task_id, f"c{i}")
    page = await client.get(
        _comments_url(org_id, task_id),
        params={"limit": 2, "offset": 1},
        headers=team["owner"]["headers"],
    )
    assert page.status_code == 200
    assert page.json()["total"] == 3
    assert [c["body"] for c in page.json()["items"]] == ["c1", "c2"]


async def test_list_comments_is_task_scoped(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    other = await _create_task(client, team["owner"], org_id, "Another")
    await _comment(client, team["owner"], org_id, other["id"], "on another task")
    resp = await client.get(
        _comments_url(org_id, team["task"]["id"]), headers=team["owner"]["headers"]
    )
    assert resp.json()["total"] == 0


async def test_list_comments_requires_auth(client: AsyncClient, team: dict) -> None:
    resp = await client.get(_comments_url(team["org"]["id"], team["task"]["id"]))
    assert resp.status_code == 401


async def test_list_comments_outsider_403(client: AsyncClient, team: dict) -> None:
    resp = await client.get(
        _comments_url(team["org"]["id"], team["task"]["id"]),
        headers=team["outsider"]["headers"],
    )
    assert resp.status_code == 403


# --- update -----------------------------------------------------------------


async def test_author_edits_own_comment(client: AsyncClient, team: dict) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["member"], org_id, task_id, "draft")
    resp = await client.patch(
        f"{_comments_url(org_id, task_id)}/{row['id']}",
        json={"body": "final"},
        headers=team["member"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["body"] == "final"


async def test_others_cannot_edit(client: AsyncClient, team: dict) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["member"], org_id, task_id, "draft")
    for actor in ("owner", "viewer"):
        resp = await client.patch(
            f"{_comments_url(org_id, task_id)}/{row['id']}",
            json={"body": "hijacked"},
            headers=team[actor]["headers"],
        )
        assert resp.status_code == 403, f"{actor}: {resp.text}"


async def test_edit_blank_body_rejected(client: AsyncClient, team: dict) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["member"], org_id, task_id)
    resp = await client.patch(
        f"{_comments_url(org_id, task_id)}/{row['id']}",
        json={"body": "   "},
        headers=team["member"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_edit_other_task_comment_is_404(client: AsyncClient, team: dict) -> None:
    """A comment id under the wrong task in the same org is a 404."""
    org_id = team["org"]["id"]
    other = await _create_task(client, team["owner"], org_id, "Another")
    row = await _comment(client, team["owner"], org_id, other["id"])
    resp = await client.patch(
        f"{_comments_url(org_id, team['task']['id'])}/{row['id']}",
        json={"body": "moved"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_edit_other_org_comment_is_404(client: AsyncClient, team: dict) -> None:
    their_row = await _comment(
        client, team["outsider"], team["other_org"]["id"], team["other_task"]["id"]
    )
    resp = await client.patch(
        f"{_comments_url(team['org']['id'], team['task']['id'])}/{their_row['id']}",
        json={"body": "mine now"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_edit_requires_auth(client: AsyncClient, team: dict) -> None:
    row = await _comment(client, team["owner"], team["org"]["id"], team["task"]["id"])
    resp = await client.patch(
        f"{_comments_url(team['org']['id'], team['task']['id'])}/{row['id']}",
        json={"body": "x"},
    )
    assert resp.status_code == 401


# --- delete -----------------------------------------------------------------


async def test_author_soft_deletes_own_comment(client: AsyncClient, team: dict) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["member"], org_id, task_id)
    resp = await client.delete(
        f"{_comments_url(org_id, task_id)}/{row['id']}", headers=team["member"]["headers"]
    )
    assert resp.status_code == 204, resp.text

    page = await client.get(_comments_url(org_id, task_id), headers=team["owner"]["headers"])
    assert page.json()["total"] == 0

    again = await client.delete(
        f"{_comments_url(org_id, task_id)}/{row['id']}", headers=team["member"]["headers"]
    )
    assert again.status_code == 404


async def test_admin_deletes_any_comment(client: AsyncClient, team: dict) -> None:
    admin = await _signup_verified(client, "admin2@comments.dev")
    await _invite_member(client, team["owner"], admin, team["org"], role="admin")
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["member"], org_id, task_id)
    resp = await client.delete(
        f"{_comments_url(org_id, task_id)}/{row['id']}", headers=admin["headers"]
    )
    assert resp.status_code == 204, resp.text


async def test_member_cannot_delete_others(client: AsyncClient, team: dict) -> None:
    other = await _signup_verified(client, "member2@comments.dev")
    await _invite_member(client, team["owner"], other, team["org"], role="member")
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["member"], org_id, task_id)
    resp = await client.delete(
        f"{_comments_url(org_id, task_id)}/{row['id']}", headers=other["headers"]
    )
    assert resp.status_code == 403, resp.text


async def test_viewer_cannot_delete(client: AsyncClient, team: dict) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["member"], org_id, task_id)
    resp = await client.delete(
        f"{_comments_url(org_id, task_id)}/{row['id']}", headers=team["viewer"]["headers"]
    )
    assert resp.status_code == 403, resp.text


async def test_delete_unknown_comment_is_404(client: AsyncClient, team: dict) -> None:
    resp = await client.delete(
        f"{_comments_url(team['org']['id'], team['task']['id'])}"
        "/00000000-0000-0000-0000-000000000000",
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_deleted_comment_cannot_be_edited(client: AsyncClient, team: dict) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["owner"], org_id, task_id)
    await client.delete(f"{_comments_url(org_id, task_id)}/{row['id']}", headers=team["owner"]["headers"])
    resp = await client.patch(
        f"{_comments_url(org_id, task_id)}/{row['id']}",
        json={"body": "zombie"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


# --- rate limit -------------------------------------------------------------


async def test_comment_rate_limit(client: AsyncClient, team: dict) -> None:
    settings = get_settings()
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    for _ in range(settings.TASK_COMMENT_LIMIT):
        await _comment(client, team["owner"], org_id, task_id)
    resp = await client.post(
        _comments_url(org_id, task_id),
        json={"body": "one too many"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 429, resp.text
    assert resp.json()["error"]["code"] == "RATE_LIMITED"


async def test_rate_limit_is_per_actor(client: AsyncClient, team: dict) -> None:
    settings = get_settings()
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    for _ in range(settings.TASK_COMMENT_LIMIT):
        await _comment(client, team["owner"], org_id, task_id)
    # The owner is throttled; a different member still can post.
    await _comment(client, team["member"], org_id, task_id)


# --- audit (D-9b) -----------------------------------------------------------


async def test_comment_and_delete_are_audited(
    client: AsyncClient, team: dict, db_session: AsyncSession
) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["member"], org_id, task_id, "audit me")
    await client.delete(
        f"{_comments_url(org_id, task_id)}/{row['id']}", headers=team["member"]["headers"]
    )

    events = (
        (
            await db_session.execute(
                select(ActivityEvent)
                .where(
                    ActivityEvent.org_id == uuid.UUID(org_id),
                    ActivityEvent.event_type.like("task_comment%"),
                )
                .order_by(ActivityEvent.id)
            )
        )
        .scalars()
        .all()
    )
    kinds = [e.event_type for e in events]
    assert ActivityEventType.task_commented.value in kinds
    assert ActivityEventType.task_comment_deleted.value in kinds
    created = next(e for e in events if e.event_type == ActivityEventType.task_commented.value)
    assert "audit me" in created.summary
    assert created.entity_id is not None


async def test_editing_is_not_audited(
    client: AsyncClient, team: dict, db_session: AsyncSession
) -> None:
    org_id, task_id = team["org"]["id"], team["task"]["id"]
    row = await _comment(client, team["owner"], org_id, task_id, "first")
    await client.patch(
        f"{_comments_url(org_id, task_id)}/{row['id']}",
        json={"body": "edited"},
        headers=team["owner"]["headers"],
    )
    events = (
        (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.org_id == uuid.UUID(org_id),
                    # The fixture already wrote invite events; this test is
                    # about comment events only.
                    ActivityEvent.event_type.like("task_comment%"),
                )
            )
        )
        .scalars()
        .all()
    )
    assert [e.event_type for e in events] == [ActivityEventType.task_commented.value]
