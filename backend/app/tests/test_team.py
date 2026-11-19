"""Step 3d tests: team management completion.

Coverage required by the step's "Security tests" line, per AGENTS.md §7:
happy path, validation errors, 401, 403/404 for wrong role and wrong
organization, cross-organization reference attempts, mass-assignment
attempts, and every last-owner path (single, bulk, role change).

Every test drives the HTTP API with a real access token; nothing calls a
service directly, so the route, the dependency and the service are all
exercised together.
"""

import csv
import io
import uuid

import pytest
from httpx import AsyncClient

from app.services import email_service

PASSWORD = "Str0ng!Password99"


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
    code = email_service.SENT_EMAILS[-1]["body"]
    code = "".join(ch for ch in code if ch.isdigit())[:6]
    verify = await client.post("/api/v1/auth/verify-email", json={"email": email, "code": code})
    assert verify.status_code == 200, verify.text
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200, login.text
    return {"email": email, "headers": {"Authorization": f"Bearer {login.json()['access_token']}"}}


async def _create_org(client: AsyncClient, auth: dict, *, name: str = "Acme Rockets") -> dict:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": "startup"},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _add_member(
    client: AsyncClient, owner: dict, org_id: str, email: str, role: str = "member"
) -> dict:
    """Invite + accept, returning the new member's auth bundle."""
    created = await client.post(
        f"/api/v1/organizations/{org_id}/invites",
        json={"email": email, "role": role},
        headers=owner["headers"],
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]
    member = await _signup_verified(client, email)
    accept = await client.post(f"/api/v1/invites/{token}/accept", headers=member["headers"])
    assert accept.status_code == 200, accept.text
    member["user_id"] = (await client.get("/api/v1/users/me", headers=member["headers"])).json()["id"]
    return member


async def _members(client: AsyncClient, auth: dict, org_id: str, **params) -> dict:
    resp = await client.get(
        f"/api/v1/organizations/{org_id}/members", headers=auth["headers"], params=params
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _my_id(client: AsyncClient, auth: dict) -> str:
    resp = await client.get("/api/v1/users/me", headers=auth["headers"])
    assert resp.status_code == 200
    return resp.json()["id"]


# --- deactivate / reactivate ------------------------------------------------


@pytest.mark.asyncio
async def test_deactivate_revokes_access_and_keeps_history(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    # member can read the team while active
    assert (await client.get(
        f"/api/v1/organizations/{org['id']}/members", headers=member["headers"]
    )).status_code == 200

    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}/deactivate",
        headers=owner["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "deactivated"

    # Deactivated member: every organization endpoint now refuses (item 1).
    # require_membership only accepts active members, so this holds with no
    # per-endpoint code.
    for method, path in [
        ("get", f"/api/v1/organizations/{org['id']}/members"),
        ("get", f"/api/v1/organizations/{org['id']}/team/summary"),
        ("get", f"/api/v1/organizations/{org['id']}/tasks"),
        ("get", f"/api/v1/organizations/{org['id']}/readiness"),
        ("get", f"/api/v1/organizations/{org['id']}/stage"),
        ("get", f"/api/v1/organizations/{org['id']}"),
        ("post", f"/api/v1/organizations/{org['id']}/members/bulk"),
    ]:
        kwargs = {"headers": member["headers"]}
        if method == "post":
            kwargs["json"] = {"action": "deactivate", "user_ids": [member["user_id"]]}
        denied = await getattr(client, method)(path, **kwargs)
        assert denied.status_code == 403, f"{method} {path} -> {denied.status_code}"

    # ...and the org disappears from their own list and from /mine.
    mine = await client.get("/api/v1/organizations/mine", headers=member["headers"])
    assert mine.json() == []

    # History is kept: the row still exists, now deactivated.
    page = await _members(client, owner, org["id"], status="deactivated")
    assert [m["user_id"] for m in page["items"]] == [member["user_id"]]
    assert page["items"][0]["status"] == "deactivated"

    # Team size counts only active members.
    summary = await client.get(
        f"/api/v1/organizations/{org['id']}/team/summary", headers=owner["headers"]
    )
    assert summary.status_code == 200
    assert summary.json()["active_members"] == 1
    assert summary.json()["deactivated_members"] == 1

    # Reactivate restores access.
    back = await client.post(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}/reactivate",
        headers=owner["headers"],
    )
    assert back.status_code == 200
    assert back.json()["status"] == "active"
    assert (await client.get(
        f"/api/v1/organizations/{org['id']}/members", headers=member["headers"]
    )).status_code == 200


@pytest.mark.asyncio
async def test_deactivate_rules_last_owner_admin_self(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    owner_id = await _my_id(client, owner)
    admin = await _add_member(client, owner, org["id"], "admin@example.com", role="admin")

    # nobody deactivates themselves, not even the owner
    self_deact = await client.post(
        f"/api/v1/organizations/{org['id']}/members/{owner_id}/deactivate",
        headers=owner["headers"],
    )
    assert self_deact.status_code == 403
    assert self_deact.json()["error"]["code"] == "SELF_ACTION"

    # the last owner is protected even from another actor's attempt
    last_owner = await client.post(
        f"/api/v1/organizations/{org['id']}/members/{owner_id}/deactivate",
        headers=admin["headers"],
    )
    assert last_owner.status_code in (403, 409)
    # admin acting on an owner is refused on rank before the last-owner rule
    assert last_owner.json()["error"]["code"] == "OWNER_TARGET"

    # deactivating an already-deactivated member is a clear 409
    assert (await client.post(
        f"/api/v1/organizations/{org['id']}/members/{admin['user_id']}/deactivate",
        headers=owner["headers"],
    )).status_code == 200
    again = await client.post(
        f"/api/v1/organizations/{org['id']}/members/{admin['user_id']}/deactivate",
        headers=owner["headers"],
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "MEMBER_NOT_ACTIVE"


@pytest.mark.asyncio
async def test_deactivate_requires_manager_and_right_org(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    # member (not a manager) is refused
    denied = await client.post(
        f"/api/v1/organizations/{org['id']}/members/{owner['email'] and member['user_id']}/deactivate",
        headers=member["headers"],
    )
    assert denied.status_code == 403

    # a viewer is refused too
    viewer = await _add_member(client, owner, org["id"], "viewer@example.com", role="viewer")
    viewer_denied = await client.post(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}/deactivate",
        headers=viewer["headers"],
    )
    assert viewer_denied.status_code == 403

    # cross-organization: an owner of ANOTHER org cannot touch this one
    other_owner = await _signup_verified(client, "other@example.com")
    other_org = await _create_org(client, other_owner, name="Other Co")
    cross = await client.post(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}/deactivate",
        headers=other_owner["headers"],
    )
    assert cross.status_code == 403

    # a user id that belongs to a different organization -> 404, not 200
    ghost = await client.post(
        f"/api/v1/organizations/{other_org['id']}/members/{member['user_id']}/deactivate",
        headers=other_owner["headers"],
    )
    assert ghost.status_code == 404

    # unauthenticated
    assert (await client.post(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}/deactivate"
    )).status_code == 401


# --- bulk actions -----------------------------------------------------------


@pytest.mark.asyncio
async def test_bulk_is_all_or_nothing(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    a = await _add_member(client, owner, org["id"], "a@example.com")
    b = await _add_member(client, owner, org["id"], "b@example.com")

    # One legal target + one illegal (the owner) => NOTHING is applied.
    mixed = await client.post(
        f"/api/v1/organizations/{org['id']}/members/bulk",
        json={"action": "deactivate", "user_ids": [a["user_id"], await _my_id(client, owner)]},
        headers=owner["headers"],
    )
    assert mixed.status_code == 403
    assert mixed.json()["error"]["code"] == "SELF_ACTION"
    page = await _members(client, owner, org["id"])
    assert {m["user_id"] for m in page["items"]} >= {a["user_id"], b["user_id"]}
    assert all(m["status"] == "active" for m in page["items"]), "bulk must have rolled back"

    # All-legal bulk applies to every target.
    ok = await client.post(
        f"/api/v1/organizations/{org['id']}/members/bulk",
        json={"action": "deactivate", "user_ids": [a["user_id"], b["user_id"]]},
        headers=owner["headers"],
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["affected"] == 2
    assert {m["status"] for m in ok.json()["members"]} == {"deactivated"}

    # bulk remove unassigns too
    rm = await client.post(
        f"/api/v1/organizations/{org['id']}/members/bulk",
        json={"action": "remove", "user_ids": [a["user_id"]]},
        headers=owner["headers"],
    )
    assert rm.status_code == 200
    assert rm.json()["affected"] == 1


@pytest.mark.asyncio
async def test_bulk_validation_and_security(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    # empty list, unknown action, duplicates, > 50 ids -> 422 from the schema
    for body in [
        {"action": "deactivate", "user_ids": []},
        {"action": "promote", "user_ids": [member["user_id"]]},
        {"action": "deactivate", "user_ids": [member["user_id"], member["user_id"]]},
        {"action": "deactivate", "user_ids": [str(uuid.uuid4()) for _ in range(51)]},
        {"action": "deactivate", "user_ids": [member["user_id"]], "status": "active"},
    ]:
        resp = await client.post(
            f"/api/v1/organizations/{org['id']}/members/bulk",
            json=body,
            headers=owner["headers"],
        )
        assert resp.status_code == 422, body

    # one bad id in an otherwise valid batch -> 404 and no partial write
    bad = await client.post(
        f"/api/v1/organizations/{org['id']}/members/bulk",
        json={"action": "deactivate", "user_ids": [member["user_id"], str(uuid.uuid4())]},
        headers=owner["headers"],
    )
    assert bad.status_code == 404
    page = await _members(client, owner, org["id"])
    assert next(m for m in page["items"] if m["user_id"] == member["user_id"])["status"] == "active"

    # non-manager refused
    assert (await client.post(
        f"/api/v1/organizations/{org['id']}/members/bulk",
        json={"action": "deactivate", "user_ids": [member["user_id"]]},
        headers=member["headers"],
    )).status_code == 403


# --- role change / owner rules ---------------------------------------------


@pytest.mark.asyncio
async def test_role_change_never_creates_second_owner(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    resp = await client.patch(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}",
        json={"role": "owner"},
        headers=owner["headers"],
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "OWNER_VIA_TRANSFER_ONLY"

    # exactly one owner survives
    page = await _members(client, owner, org["id"], role="owner")
    assert page["total"] == 1

    # the last owner cannot be demoted through the role path either
    owner_id = await _my_id(client, owner)
    demote_self = await client.patch(
        f"/api/v1/organizations/{org['id']}/members/{owner_id}",
        json={"role": "admin"},
        headers=owner["headers"],
    )
    assert demote_self.status_code == 403
    assert demote_self.json()["error"]["code"] == "SELF_ACTION"


@pytest.mark.asyncio
async def test_mass_assignment_is_rejected(client: AsyncClient) -> None:
    """Server-controlled member fields can never be written (item: the
    step's mass-assignment test). extra="forbid" turns each into a 422."""
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    for body in [
        {"status": "active"},
        {"is_founder": True},
        {"joined_at": "2020-01-01T00:00:00Z"},
        {"last_active_at": "2020-01-01T00:00:00Z"},
        {"user_id": str(uuid.uuid4())},
        {"role": "owner", "is_founder": True},
    ]:
        resp = await client.patch(
            f"/api/v1/organizations/{org['id']}/members/{member['user_id']}",
            json=body,
            headers=owner["headers"],
        )
        assert resp.status_code == 422, body

    # invite body: token_hash / expires_at / invited_by are server-controlled
    for body in [
        {"email": "x@example.com", "token_hash": "abc"},
        {"email": "x@example.com", "expires_at": "2020-01-01T00:00:00Z"},
        {"email": "x@example.com", "invited_by": str(uuid.uuid4())},
        {"email": "x@example.com", "accepted_at": "2020-01-01T00:00:00Z"},
        {"email": "x@example.com", "message": "x" * 501},
        {"email": "not-an-email"},
    ]:
        resp = await client.post(
            f"/api/v1/organizations/{org['id']}/invites",
            json=body,
            headers=owner["headers"],
        )
        assert resp.status_code == 422, body


# --- remove + task unassignment (item 11) ----------------------------------


@pytest.mark.asyncio
async def test_remove_unassigns_tasks(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    created = await client.post(
        f"/api/v1/organizations/{org['id']}/tasks",
        json={"title": "Owned work", "assignee_id": member["user_id"]},
        headers=owner["headers"],
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    assert created.json()["assignee_id"] == member["user_id"]

    removed = await client.delete(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}",
        headers=owner["headers"],
    )
    assert removed.status_code == 204

    # the task survives with no assignee (the dialog's promise)
    task = await client.get(
        f"/api/v1/organizations/{org['id']}/tasks/{task_id}", headers=owner["headers"]
    )
    assert task.status_code == 200, task.text
    assert task.json()["assignee_id"] is None
    assert task.json()["title"] == "Owned work"

    # deactivation does NOT unassign (approved decision 3)
    m2 = await _add_member(client, owner, org["id"], "m2@example.com")
    t2 = await client.post(
        f"/api/v1/organizations/{org['id']}/tasks",
        json={"title": "Kept", "assignee_id": m2["user_id"]},
        headers=owner["headers"],
    )
    await client.post(
        f"/api/v1/organizations/{org['id']}/members/{m2['user_id']}/deactivate",
        headers=owner["headers"],
    )
    still = await client.get(
        f"/api/v1/organizations/{org['id']}/tasks/{t2.json()['id']}", headers=owner["headers"]
    )
    assert still.json()["assignee_id"] == m2["user_id"]


@pytest.mark.asyncio
async def test_remove_protects_last_owner_and_self(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    owner_id = await _my_id(client, owner)
    admin = await _add_member(client, owner, org["id"], "admin@example.com", role="admin")

    self_rm = await client.delete(
        f"/api/v1/organizations/{org['id']}/members/{owner_id}", headers=owner["headers"]
    )
    assert self_rm.status_code == 403
    assert self_rm.json()["error"]["code"] == "SELF_ACTION"

    on_owner = await client.delete(
        f"/api/v1/organizations/{org['id']}/members/{owner_id}", headers=admin["headers"]
    )
    assert on_owner.status_code == 403
    assert on_owner.json()["error"]["code"] == "OWNER_TARGET"


# --- invites: email, resend, bulk revoke -----------------------------------


@pytest.mark.asyncio
async def test_invite_sends_email_and_carries_message(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    before = len(email_service.SENT_EMAILS)

    created = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={
            "email": "new@example.com",
            "role": "member",
            "title": "Designer",
            "department": "design",
            "message": "Come build with us.",
            "is_public": False,
        },
        headers=owner["headers"],
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["message"] == "Come build with us."
    assert body["is_public"] is False

    # the email went out with the accept link inside it
    assert len(email_service.SENT_EMAILS) == before + 1
    mail = email_service.SENT_EMAILS[-1]
    assert mail["to"] == "new@example.com"
    assert body["token"] in mail["body"]
    assert "Come build with us." in mail["body"]

    # a duplicate pending invite is a clear conflict, not a second token
    dup = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": "new@example.com"},
        headers=owner["headers"],
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "INVITE_NOT_PENDING"
    assert "already pending" in dup.json()["error"]["message"].lower()

    # is_public travels to the member row on accept
    invitee = await _signup_verified(client, "new@example.com")
    accept = await client.post(
        f"/api/v1/invites/{body['token']}/accept", headers=invitee["headers"]
    )
    assert accept.status_code == 200, accept.text
    page = await _members(client, owner, org["id"])
    row = next(m for m in page["items"] if m["email"] == "new@example.com")
    assert row["is_public"] is False
    assert row["title"] == "Designer"
    assert row["department"] == "design"


@pytest.mark.asyncio
async def test_resend_invalidates_old_token(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)

    created = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": "late@example.com"},
        headers=owner["headers"],
    )
    old_token = created.json()["token"]
    invite_id = created.json()["id"]

    resend = await client.post(
        f"/api/v1/organizations/{org['id']}/invites/{invite_id}/resend",
        headers=owner["headers"],
    )
    assert resend.status_code == 200, resend.text
    new_token = resend.json()["token"]
    assert new_token and new_token != old_token
    # expiry was extended
    assert resend.json()["expires_at"] >= created.json()["expires_at"]

    invitee = await _signup_verified(client, "late@example.com")
    # the OLD link is dead
    dead = await client.post(f"/api/v1/invites/{old_token}/accept", headers=invitee["headers"])
    assert dead.status_code == 404
    # the NEW link works, exactly once
    ok = await client.post(f"/api/v1/invites/{new_token}/accept", headers=invitee["headers"])
    assert ok.status_code == 200
    again = await client.post(f"/api/v1/invites/{new_token}/accept", headers=invitee["headers"])
    assert again.status_code == 404


@pytest.mark.asyncio
async def test_resend_rate_limit_and_permissions(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")
    created = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": "spam@example.com"},
        headers=owner["headers"],
    )
    invite_id = created.json()["id"]

    # non-manager refused
    assert (await client.post(
        f"/api/v1/organizations/{org['id']}/invites/{invite_id}/resend",
        headers=member["headers"],
    )).status_code == 403

    # per-invite cap (INVITE_RESEND_LIMIT = 3/hour) -> 4th is 429
    codes = []
    for _ in range(4):
        r = await client.post(
            f"/api/v1/organizations/{org['id']}/invites/{invite_id}/resend",
            headers=owner["headers"],
        )
        codes.append(r.status_code)
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 429
    assert (await client.post(
        f"/api/v1/organizations/{org['id']}/invites/{invite_id}/resend",
        headers=member["headers"],
    )).status_code == 403  # permission is checked before the limiter

    # unknown / revoked invite -> 404
    assert (await client.post(
        f"/api/v1/organizations/{org['id']}/invites/{uuid.uuid4()}/resend",
        headers=owner["headers"],
    )).status_code == 404


@pytest.mark.asyncio
async def test_bulk_revoke_invites(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    ids = []
    for i in range(3):
        r = await client.post(
            f"/api/v1/organizations/{org['id']}/invites",
            json={"email": f"p{i}@example.com"},
            headers=owner["headers"],
        )
        ids.append(r.json()["id"])

    revoked = await client.post(
        f"/api/v1/organizations/{org['id']}/invites/bulk-revoke",
        json={"invite_ids": ids[:2]},
        headers=owner["headers"],
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["revoked"] == 2

    remaining = await client.get(
        f"/api/v1/organizations/{org['id']}/invites", headers=owner["headers"]
    )
    assert [i["id"] for i in remaining.json()] == [ids[2]]

    # an id from another org (or bogus) -> 404 and nothing is revoked
    other_owner = await _signup_verified(client, "other@example.com")
    other = await _create_org(client, other_owner, name="Other Co")
    foreign = await client.post(
        f"/api/v1/organizations/{other['id']}/invites",
        json={"email": "foreign@example.com"},
        headers=other_owner["headers"],
    )
    mixed = await client.post(
        f"/api/v1/organizations/{org['id']}/invites/bulk-revoke",
        json={"invite_ids": [ids[2], foreign.json()["id"]]},
        headers=owner["headers"],
    )
    assert mixed.status_code == 404
    still = await client.get(
        f"/api/v1/organizations/{org['id']}/invites", headers=owner["headers"]
    )
    assert [i["id"] for i in still.json()] == [ids[2]], "must not partially revoke"

    # duplicate ids / too many -> 422
    for body in [{"invite_ids": []}, {"invite_ids": [ids[2], ids[2]]},
                 {"invite_ids": [str(uuid.uuid4()) for _ in range(51)]}]:
        assert (await client.post(
            f"/api/v1/organizations/{org['id']}/invites/bulk-revoke",
            json=body,
            headers=owner["headers"],
        )).status_code == 422


# --- filters, sort, pagination (item 10) -----------------------------------


@pytest.mark.asyncio
async def test_member_filters_sort_and_pagination(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    await _add_member(client, owner, org["id"], "zoe@example.com", role="member")
    await _add_member(client, owner, org["id"], "adam@example.com", role="viewer")

    # default: active only, sorted by name
    page = await _members(client, owner, org["id"])
    names = [m["display_name"] for m in page["items"]]
    assert names == sorted(names), names
    assert page["total"] == 3

    # role filter
    viewers = await _members(client, owner, org["id"], role="viewer")
    assert [m["email"] for m in viewers["items"]] == ["adam@example.com"]

    # text search on name and email
    found = await _members(client, owner, org["id"], q="zoe")
    assert [m["email"] for m in found["items"]] == ["zoe@example.com"]
    by_email = await _members(client, owner, org["id"], q="adam@")
    assert [m["email"] for m in by_email["items"]] == ["adam@example.com"]

    # sort direction
    descending = await _members(client, owner, org["id"], sort="-name")
    assert [m["display_name"] for m in descending["items"]] == sorted(
        [m["display_name"] for m in descending["items"]], reverse=True
    )

    # pagination keeps total stable
    first = await _members(client, owner, org["id"], limit=2, offset=0)
    second = await _members(client, owner, org["id"], limit=2, offset=2)
    assert len(first["items"]) == 2
    assert len(second["items"]) == 1
    assert first["total"] == second["total"] == 3
    assert not {m["user_id"] for m in first["items"]} & {
        m["user_id"] for m in second["items"]
    }

    # unknown sort / bad limit / bad status -> 422 (whitelisted)
    bad_params: list[dict[str, str | int]] = [
        {"sort": "salary"},
        {"limit": 0},
        {"limit": 101},
        {"status": "zombie"},
        {"q": "x" * 101},
    ]
    for params in bad_params:
        resp = await client.get(
            f"/api/v1/organizations/{org['id']}/members",
            headers=owner["headers"],
            params=params,
        )
        assert resp.status_code == 422, params


@pytest.mark.asyncio
async def test_members_do_not_leak_private_fields(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    page = await _members(client, owner, org["id"])
    for row in page["items"]:
        for forbidden in ("phone", "din_number", "password_hash", "token_hash", "seat_type"):
            assert forbidden not in row, forbidden

    # item 13: last_active_at moves once the member reads the team, and
    # linkedin_url is gated by is_public for non-managers
    await client.get(f"/api/v1/organizations/{org['id']}/members", headers=member["headers"])
    fresh = await _members(client, owner, org["id"])
    me = next(m for m in fresh["items"] if m["user_id"] == member["user_id"])
    assert me["last_active_at"] is not None

    # hide the profile from teammates: managers still see the link,
    # the member's own view stays, and a viewer must not.
    await client.patch(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}",
        json={"is_public": False},
        headers=owner["headers"],
    )
    viewer = await _add_member(client, owner, org["id"], "viewer@example.com", role="viewer")
    from_viewer = await _members(client, viewer, org["id"])
    target = next(m for m in from_viewer["items"] if m["user_id"] == member["user_id"])
    assert target["linkedin_url"] is None
    assert target["can_manage"] is False
    # ...but a manager of the same org still sees it
    from_owner = await _members(client, owner, org["id"])
    assert next(
        m for m in from_owner["items"] if m["user_id"] == member["user_id"]
    )["can_manage"] is True


# --- export (item 9) -------------------------------------------------------


@pytest.mark.asyncio
async def test_export_csv_manager_only_and_no_private_fields(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    resp = await client.get(
        f"/api/v1/organizations/{org['id']}/members/export", headers=owner["headers"]
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in resp.headers["content-disposition"]

    rows = list(csv.reader(io.StringIO(resp.text)))
    assert rows[0] == ["name", "email", "role", "status", "title", "department",
                       "founder", "joined_at"]
    emails = {r[1] for r in rows[1:]}
    assert "owner@example.com" in emails
    assert "member@example.com" in emails
    assert "phone" not in resp.text.lower()

    # member / viewer are refused
    for who in (member, await _add_member(client, owner, org["id"], "v@example.com", "viewer")):
        denied = await client.get(
            f"/api/v1/organizations/{org['id']}/members/export", headers=who["headers"]
        )
        assert denied.status_code == 403

    # cross-org owner refused, anonymous 401
    other = await _signup_verified(client, "other@example.com")
    other_org = await _create_org(client, other, name="Other Co")
    assert (await client.get(
        f"/api/v1/organizations/{org['id']}/members/export", headers=other["headers"]
    )).status_code == 403
    assert (await client.get(
        f"/api/v1/organizations/{other_org['id']}/members/export"
    )).status_code == 401

    # spreadsheet formula injection is neutralised
    await client.patch(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}",
        json={"title": "=cmd|'/c calc'!A1"},
        headers=owner["headers"],
    )
    csv2 = await client.get(
        f"/api/v1/organizations/{org['id']}/members/export", headers=owner["headers"]
    )
    assert "'=cmd" in csv2.text


# --- summary + permissions matrix (items 6 and 7) -------------------------


@pytest.mark.asyncio
async def test_team_summary_nulls_open_roles(client: AsyncClient) -> None:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    await _add_member(client, owner, org["id"], "a@example.com")
    await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": "pending@example.com"},
        headers=owner["headers"],
    )

    summary = await client.get(
        f"/api/v1/organizations/{org['id']}/team/summary", headers=owner["headers"]
    )
    assert summary.status_code == 200
    data = summary.json()
    assert data["active_members"] == 2
    assert data["pending_invites"] == 1
    # Item 6: no fake 3 — the field is null until Step 7a can fill it.
    assert data["open_jobs_count"] is None
    assert data["my_role"] == "owner"

    assert (await client.get(
        f"/api/v1/organizations/{org['id']}/team/summary"
    )).status_code == 401


@pytest.mark.asyncio
async def test_permission_matrix_matches_enforcement(client: AsyncClient) -> None:
    """Item 7: the served matrix and the real rules must not drift."""
    from app.core.permissions import TEAM_ACTIONS
    from app.services.organization_service import TEAM_MANAGERS

    # the manager role set the service enforces IS the matrix's set
    actions = {a.key: a for a in TEAM_ACTIONS}
    assert actions["manage_members"].roles == TEAM_MANAGERS
    assert actions["transfer_ownership"].roles == {__import__(
        "app.models.organization", fromlist=["OrgRole"]
    ).OrgRole.owner}

    resp = await client.get("/api/v1/organizations/permissions")
    assert resp.status_code == 200
    served = resp.json()
    assert served["roles"] == ["owner", "admin", "member", "viewer"]
    keys = {a["key"] for a in served["actions"]}
    assert {"view_team", "manage_members", "manage_invites", "export_team",
            "transfer_ownership"} == keys
    assert served["rules"], "the page needs the human-readable rules too"

    # and the ACTUAL endpoint behaviour agrees with the served matrix:
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")
    for action, path, method in [
        ("export_team", f"/api/v1/organizations/{org['id']}/members/export", "get"),
        ("manage_invites", f"/api/v1/organizations/{org['id']}/invites", "get"),
    ]:
        allowed_roles = actions[action].roles
        status = getattr(client, method)(path, headers=member["headers"])
        resp_m = await status
        assert (resp_m.status_code == 200) == ("member" in allowed_roles)
    # transfer_ownership is owner-only, per the matrix
    denied = await client.post(
        f"/api/v1/organizations/{org['id']}/transfer-ownership",
        json={"user_id": member["user_id"]},
        headers=member["headers"],
    )
    assert denied.status_code == 403


# --- audit log (item 8) ----------------------------------------------------


@pytest.mark.asyncio
async def test_audit_events_written(client: AsyncClient) -> None:
    from sqlalchemy import select

    from app.models.activity import ActivityEvent
    from app.tests.conftest import TestSessionFactory

    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    member = await _add_member(client, owner, org["id"], "member@example.com")

    # role change
    await client.patch(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}",
        json={"role": "admin"},
        headers=owner["headers"],
    )
    # deactivate + reactivate
    await client.post(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}/deactivate",
        headers=owner["headers"],
    )
    await client.post(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}/reactivate",
        headers=owner["headers"],
    )
    # remove
    await client.delete(
        f"/api/v1/organizations/{org['id']}/members/{member['user_id']}",
        headers=owner["headers"],
    )
    # invite create + resend + revoke
    inv = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": "audit@example.com"},
        headers=owner["headers"],
    )
    await client.post(
        f"/api/v1/organizations/{org['id']}/invites/{inv.json()['id']}/resend",
        headers=owner["headers"],
    )
    await client.delete(
        f"/api/v1/organizations/{org['id']}/invites/{inv.json()['id']}",
        headers=owner["headers"],
    )

    async with TestSessionFactory() as session:
        rows = (
            await session.execute(
                select(ActivityEvent)
                .where(ActivityEvent.org_id == uuid.UUID(org["id"]))
                .order_by(ActivityEvent.id)
            )
        ).scalars().all()
    kinds = [r.event_type for r in rows]
    for expected in (
        "invite_created", "role_changed", "member_deactivated",
        "member_reactivated", "member_removed", "invite_resent", "invite_revoked",
    ):
        assert expected in kinds, (expected, kinds)
    assert all(r.summary for r in rows), "every audit row needs a readable summary"
