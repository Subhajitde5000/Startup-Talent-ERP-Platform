"""Step 5d tests: task labels and the task label set.

Covers happy path / validation / authentication / authorization (wrong
role, wrong organization), cross-organization label references,
mass-assignment attempts on every server-controlled field, the case-
insensitive unique name, the 8-per-task and per-org caps, label deletion
cascading its links, the ``label_id`` task filter and the labels embedded
in ``TaskRead`` (loaded in one batched query).
"""

import re

import pytest
from httpx import AsyncClient

from app.models.task_label import MAX_LABELS_PER_ORG
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


def _labels_url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/task-labels"


async def _create_label(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    name: str = "Backend",
    color: str | None = "#4A5568",
    expect: int = 201,
) -> dict:
    resp = await client.post(
        _labels_url(org_id),
        json={"name": name, "color": color},
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 201 else {}


async def _create_task(client: AsyncClient, auth: dict, org_id: str, title: str) -> dict:
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/tasks",
        json={"title": title},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _set_labels(
    client: AsyncClient,
    auth: dict,
    org_id: str,
    task_id: str,
    label_ids: list[str],
    expect: int = 200,
) -> list:
    resp = await client.put(
        f"/api/v1/organizations/{org_id}/tasks/{task_id}/labels",
        json={"label_ids": label_ids},
        headers=auth["headers"],
    )
    assert resp.status_code == expect, resp.text
    return resp.json() if expect == 200 else []


@pytest.fixture
async def team(client: AsyncClient) -> dict:
    """Owner + member + viewer in one startup org, plus a second org."""
    owner = await _signup_verified(client, "owner@labels.dev")
    member = await _signup_verified(client, "member@labels.dev")
    viewer = await _signup_verified(client, "viewer@labels.dev")
    org = await _create_org(client, owner)
    await _invite_member(client, owner, member, org, role="member")
    await _invite_member(client, owner, viewer, org, role="viewer")

    outsider = await _signup_verified(client, "outsider@labels.dev")
    other_org = await _create_org(client, outsider, name="Other Co")
    return {
        "owner": owner,
        "member": member,
        "viewer": viewer,
        "outsider": outsider,
        "org": org,
        "other_org": other_org,
    }


# --- create -----------------------------------------------------------------


async def test_owner_creates_label(client: AsyncClient, team: dict) -> None:
    row = await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    assert row["name"] == "Backend"
    assert row["color"] == "#4A5568"
    assert row["org_id"] == team["org"]["id"]
    assert row["id"] and row["created_at"] and row["updated_at"]


async def test_label_without_color(client: AsyncClient, team: dict) -> None:
    row = await _create_label(client, team["owner"], team["org"]["id"], "Design", None)
    assert row["color"] is None


async def test_admin_can_create_label(client: AsyncClient, team: dict) -> None:
    admin = await _signup_verified(client, "admin@labels.dev")
    await _invite_member(client, team["owner"], admin, team["org"], role="admin")
    row = await _create_label(client, admin, team["org"]["id"], "Ops")
    assert row["name"] == "Ops"


async def test_member_cannot_create_label(client: AsyncClient, team: dict) -> None:
    """Approved D-7: the catalogue is owner/admin ("managed by admins")."""
    resp = await client.post(
        _labels_url(team["org"]["id"]),
        json={"name": "Backend"},
        headers=team["member"]["headers"],
    )
    assert resp.status_code == 403, resp.text
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_viewer_cannot_create_label(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _labels_url(team["org"]["id"]),
        json={"name": "Backend"},
        headers=team["viewer"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_outsider_cannot_create_label(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _labels_url(team["org"]["id"]),
        json={"name": "Backend"},
        headers=team["outsider"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_create_label_requires_auth(client: AsyncClient, team: dict) -> None:
    resp = await client.post(_labels_url(team["org"]["id"]), json={"name": "Backend"})
    assert resp.status_code == 401, resp.text


# --- validation -------------------------------------------------------------


async def test_blank_name_rejected(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _labels_url(team["org"]["id"]),
        json={"name": "   "},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_name_too_long_rejected(client: AsyncClient, team: dict) -> None:
    resp = await client.post(
        _labels_url(team["org"]["id"]),
        json={"name": "x" * 41},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


async def test_bad_color_rejected(client: AsyncClient, team: dict) -> None:
    for bad in ["red", "#GGGGGG", "4A5568", "#4A556"]:
        resp = await client.post(
            _labels_url(team["org"]["id"]),
            json={"name": "Backend", "color": bad},
            headers=team["owner"]["headers"],
        )
        assert resp.status_code == 422, f"{bad} accepted: {resp.text}"


async def test_name_is_trimmed_and_collapsed(client: AsyncClient, team: dict) -> None:
    row = await _create_label(client, team["owner"], team["org"]["id"], "  Front   end  ")
    assert row["name"] == "Front end"


async def test_duplicate_name_is_409(client: AsyncClient, team: dict) -> None:
    await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    resp = await client.post(
        _labels_url(team["org"]["id"]),
        json={"name": "Backend"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "LABEL_NAME_TAKEN"


async def test_duplicate_name_is_case_insensitive(client: AsyncClient, team: dict) -> None:
    """D-1: "Backend" and "backend" are the same label."""
    await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    resp = await client.post(
        _labels_url(team["org"]["id"]),
        json={"name": "backend"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "LABEL_NAME_TAKEN"


async def test_same_name_allowed_in_another_org(
    client: AsyncClient, team: dict
) -> None:
    await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    row = await _create_label(
        client, team["outsider"], team["other_org"]["id"], "Backend"
    )
    assert row["name"] == "Backend"


async def test_label_limit_per_org(client: AsyncClient, team: dict) -> None:
    for i in range(MAX_LABELS_PER_ORG):
        await _create_label(client, team["owner"], team["org"]["id"], f"Label {i}")
    resp = await client.post(
        _labels_url(team["org"]["id"]),
        json={"name": "One too many"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "LABEL_LIMIT_REACHED"


# --- mass assignment --------------------------------------------------------


async def test_server_fields_cannot_be_mass_assigned(
    client: AsyncClient, team: dict
) -> None:
    for payload in [
        {"name": "X", "id": "00000000-0000-0000-0000-000000000001"},
        {"name": "X", "org_id": team["other_org"]["id"]},
        {"name": "X", "created_at": "2020-01-01T00:00:00Z"},
        {"name": "X", "updated_at": "2020-01-01T00:00:00Z"},
    ]:
        resp = await client.post(
            _labels_url(team["org"]["id"]), json=payload, headers=team["owner"]["headers"]
        )
        assert resp.status_code == 422, f"{payload} accepted: {resp.text}"


# --- list -------------------------------------------------------------------


async def test_list_labels(client: AsyncClient, team: dict) -> None:
    await _create_label(client, team["owner"], team["org"]["id"], "Zeta")
    await _create_label(client, team["owner"], team["org"]["id"], "Alpha")
    resp = await client.get(_labels_url(team["org"]["id"]), headers=team["viewer"]["headers"])
    assert resp.status_code == 200, resp.text
    page = resp.json()
    assert [i["name"] for i in page["items"]] == ["Alpha", "Zeta"]  # name asc
    assert page["total"] == 2


async def test_list_labels_search_and_paging(client: AsyncClient, team: dict) -> None:
    for name in ["Backend", "backend-2", "Design"]:
        await _create_label(client, team["owner"], team["org"]["id"], name)
    resp = await client.get(
        _labels_url(team["org"]["id"]), params={"q": "BACK"}, headers=team["owner"]["headers"]
    )
    assert resp.status_code == 200
    assert {i["name"] for i in resp.json()["items"]} == {"Backend", "backend-2"}

    page = await client.get(
        _labels_url(team["org"]["id"]),
        params={"limit": 1, "offset": 1, "sort": "name", "order": "asc"},
        headers=team["owner"]["headers"],
    )
    assert page.status_code == 200
    assert page.json()["total"] == 3
    assert len(page.json()["items"]) == 1


async def test_list_labels_is_org_scoped(client: AsyncClient, team: dict) -> None:
    await _create_label(client, team["outsider"], team["other_org"]["id"], "Theirs")
    resp = await client.get(_labels_url(team["org"]["id"]), headers=team["owner"]["headers"])
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


async def test_list_labels_requires_auth(client: AsyncClient, team: dict) -> None:
    resp = await client.get(_labels_url(team["org"]["id"]))
    assert resp.status_code == 401


async def test_list_labels_outsider_403(client: AsyncClient, team: dict) -> None:
    resp = await client.get(
        _labels_url(team["org"]["id"]), headers=team["outsider"]["headers"]
    )
    assert resp.status_code == 403


# --- update -----------------------------------------------------------------


async def test_update_label(client: AsyncClient, team: dict) -> None:
    row = await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    resp = await client.patch(
        f"{_labels_url(team['org']['id'])}/{row['id']}",
        json={"name": "Server", "color": "#123456"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Server"
    assert resp.json()["color"] == "#123456"


async def test_update_label_clears_color(client: AsyncClient, team: dict) -> None:
    row = await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    resp = await client.patch(
        f"{_labels_url(team['org']['id'])}/{row['id']}",
        json={"color": None},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["color"] is None


async def test_update_label_duplicate_is_409(client: AsyncClient, team: dict) -> None:
    await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    other = await _create_label(client, team["owner"], team["org"]["id"], "Design")
    resp = await client.patch(
        f"{_labels_url(team['org']['id'])}/{other['id']}",
        json={"name": "bAcKeNd"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "LABEL_NAME_TAKEN"


async def test_update_label_member_403(client: AsyncClient, team: dict) -> None:
    row = await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    resp = await client.patch(
        f"{_labels_url(team['org']['id'])}/{row['id']}",
        json={"name": "Nope"},
        headers=team["member"]["headers"],
    )
    assert resp.status_code == 403, resp.text


async def test_update_label_other_org_is_404(client: AsyncClient, team: dict) -> None:
    """A label id from another organization is 404, never 403 (no oracle)."""
    theirs = await _create_label(client, team["outsider"], team["other_org"]["id"], "X")
    resp = await client.patch(
        f"{_labels_url(team['org']['id'])}/{theirs['id']}",
        json={"name": "Y"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


async def test_update_label_unknown_id_is_404(client: AsyncClient, team: dict) -> None:
    resp = await client.patch(
        f"{_labels_url(team['org']['id'])}/00000000-0000-0000-0000-000000000000",
        json={"name": "Y"},
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 404, resp.text


# --- delete -----------------------------------------------------------------


async def test_delete_label_removes_links_not_tasks(
    client: AsyncClient, team: dict
) -> None:
    org_id = team["org"]["id"]
    label = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await _set_labels(client, team["owner"], org_id, task["id"], [label["id"]])

    resp = await client.delete(
        f"{_labels_url(org_id)}/{label['id']}", headers=team["owner"]["headers"]
    )
    assert resp.status_code == 204, resp.text

    got = await client.get(
        f"/api/v1/organizations/{org_id}/tasks/{task['id']}", headers=team["owner"]["headers"]
    )
    assert got.status_code == 200, got.text
    assert got.json()["labels"] == []

    again = await client.delete(
        f"{_labels_url(org_id)}/{label['id']}", headers=team["owner"]["headers"]
    )
    assert again.status_code == 404


async def test_deleted_label_name_can_be_reused(client: AsyncClient, team: dict) -> None:
    """D-4: hard delete frees the unique name slot immediately."""
    org_id = team["org"]["id"]
    label = await _create_label(client, team["owner"], org_id, "Backend")
    await client.delete(f"{_labels_url(org_id)}/{label['id']}", headers=team["owner"]["headers"])
    row = await _create_label(client, team["owner"], org_id, "Backend")
    assert row["name"] == "Backend"


async def test_delete_label_member_403(client: AsyncClient, team: dict) -> None:
    label = await _create_label(client, team["owner"], team["org"]["id"], "Backend")
    resp = await client.delete(
        f"{_labels_url(team['org']['id'])}/{label['id']}", headers=team["member"]["headers"]
    )
    assert resp.status_code == 403, resp.text


async def test_delete_label_other_org_is_404(client: AsyncClient, team: dict) -> None:
    theirs = await _create_label(client, team["outsider"], team["other_org"]["id"], "X")
    resp = await client.delete(
        f"{_labels_url(team['org']['id'])}/{theirs['id']}", headers=team["owner"]["headers"]
    )
    assert resp.status_code == 404, resp.text


# --- task label set ---------------------------------------------------------


async def test_member_sets_task_labels(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    design = await _create_label(client, team["owner"], org_id, "Design")
    task = await _create_task(client, team["owner"], org_id, "Ship it")

    rows = await _set_labels(
        client, team["member"], org_id, task["id"], [backend["id"], design["id"]]
    )
    assert {r["name"] for r in rows} == {"Backend", "Design"}


async def test_replace_set_detaches(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    design = await _create_label(client, team["owner"], org_id, "Design")
    task = await _create_task(client, team["owner"], org_id, "Ship it")

    await _set_labels(client, team["owner"], org_id, task["id"], [backend["id"], design["id"]])
    rows = await _set_labels(client, team["owner"], org_id, task["id"], [design["id"]])
    assert [r["name"] for r in rows] == ["Design"]


async def test_replace_set_with_empty_list_clears(
    client: AsyncClient, team: dict
) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await _set_labels(client, team["owner"], org_id, task["id"], [backend["id"]])
    rows = await _set_labels(client, team["owner"], org_id, task["id"], [])
    assert rows == []


async def test_replace_set_is_idempotent(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await _set_labels(client, team["owner"], org_id, task["id"], [backend["id"]])
    rows = await _set_labels(client, team["owner"], org_id, task["id"], [backend["id"]])
    assert len(rows) == 1


async def test_replace_set_deduplicates(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    rows = await _set_labels(
        client, team["owner"], org_id, task["id"], [backend["id"], backend["id"]]
    )
    assert len(rows) == 1


async def test_cross_org_label_reference_is_422(client: AsyncClient, team: dict) -> None:
    """A label from another organization is a field error, not a 404."""
    org_id = team["org"]["id"]
    theirs = await _create_label(client, team["outsider"], team["other_org"]["id"], "X")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await _set_labels(client, team["owner"], org_id, task["id"], [theirs["id"]], expect=422)


async def test_unknown_label_id_is_422(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await _set_labels(
        client,
        team["owner"],
        org_id,
        task["id"],
        ["00000000-0000-0000-0000-000000000000"],
        expect=422,
    )


async def test_more_than_eight_labels_rejected(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    ids = [
        (await _create_label(client, team["owner"], org_id, f"L{i}"))["id"]
        for i in range(9)
    ]
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await _set_labels(client, team["owner"], org_id, task["id"], ids, expect=422)


async def test_viewer_cannot_set_labels(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await _set_labels(
        client, team["viewer"], org_id, task["id"], [backend["id"]], expect=403
    )


async def test_outsider_cannot_set_labels(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await _set_labels(
        client, team["outsider"], org_id, task["id"], [backend["id"]], expect=403
    )


async def test_set_labels_other_org_task_is_404(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    theirs = await _create_task(client, team["outsider"], team["other_org"]["id"], "Theirs")
    await _set_labels(
        client, team["owner"], org_id, theirs["id"], [backend["id"]], expect=404
    )


async def test_set_labels_on_deleted_task_is_404(
    client: AsyncClient, team: dict
) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    await client.delete(
        f"/api/v1/organizations/{org_id}/tasks/{task['id']}", headers=team["owner"]["headers"]
    )
    await _set_labels(
        client, team["owner"], org_id, task["id"], [backend["id"]], expect=404
    )


async def test_set_labels_unknown_task_is_404(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    await _set_labels(
        client,
        team["owner"],
        org_id,
        "00000000-0000-0000-0000-000000000000",
        [backend["id"]],
        expect=404,
    )


async def test_set_labels_requires_auth(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    resp = await client.put(
        f"/api/v1/organizations/{org_id}/tasks/{task['id']}/labels",
        json={"label_ids": []},
    )
    assert resp.status_code == 401


async def test_link_server_fields_cannot_be_mass_assigned(
    client: AsyncClient, team: dict
) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    resp = await client.put(
        f"/api/v1/organizations/{org_id}/tasks/{task['id']}/labels",
        json={
            "label_ids": [backend["id"]],
            "task_id": "00000000-0000-0000-0000-000000000000",
            "created_at": "2020-01-01T00:00:00Z",
        },
        headers=team["owner"]["headers"],
    )
    assert resp.status_code == 422, resp.text


# --- labels on tasks + the label filter -------------------------------------


async def test_task_read_carries_labels(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    task = await _create_task(client, team["owner"], org_id, "Ship it")
    assert task["labels"] == []  # a fresh task carries none
    await _set_labels(client, team["owner"], org_id, task["id"], [backend["id"]])

    got = await client.get(
        f"/api/v1/organizations/{org_id}/tasks/{task['id']}", headers=team["viewer"]["headers"]
    )
    assert got.status_code == 200, got.text
    assert [label["name"] for label in got.json()["labels"]] == ["Backend"]


async def test_task_list_carries_labels(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    design = await _create_label(client, team["owner"], org_id, "Design")
    first = await _create_task(client, team["owner"], org_id, "First")
    second = await _create_task(client, team["owner"], org_id, "Second")
    await _set_labels(client, team["owner"], org_id, first["id"], [backend["id"]])
    await _set_labels(client, team["owner"], org_id, second["id"], [design["id"]])

    page = await client.get(
        f"/api/v1/organizations/{org_id}/tasks", headers=team["owner"]["headers"]
    )
    assert page.status_code == 200
    by_title = {t["title"]: [label["name"] for label in t["labels"]] for t in page.json()["items"]}
    assert by_title == {"First": ["Backend"], "Second": ["Design"]}


async def test_task_list_filters_by_label(client: AsyncClient, team: dict) -> None:
    org_id = team["org"]["id"]
    backend = await _create_label(client, team["owner"], org_id, "Backend")
    design = await _create_label(client, team["owner"], org_id, "Design")
    first = await _create_task(client, team["owner"], org_id, "First")
    second = await _create_task(client, team["owner"], org_id, "Second")
    await _set_labels(client, team["owner"], org_id, first["id"], [backend["id"]])
    await _set_labels(client, team["owner"], org_id, second["id"], [design["id"]])

    page = await client.get(
        f"/api/v1/organizations/{org_id}/tasks",
        params={"label_id": backend["id"]},
        headers=team["owner"]["headers"],
    )
    assert page.status_code == 200, page.text
    body = page.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "First"


async def test_label_filter_from_another_org_returns_nothing(
    client: AsyncClient, team: dict
) -> None:
    """Filtering by a foreign label id is an empty page, not a leak."""
    org_id = team["org"]["id"]
    theirs = await _create_label(client, team["outsider"], team["other_org"]["id"], "X")
    await _create_task(client, team["owner"], org_id, "Ours")
    page = await client.get(
        f"/api/v1/organizations/{org_id}/tasks",
        params={"label_id": theirs["id"]},
        headers=team["owner"]["headers"],
    )
    assert page.status_code == 200
    assert page.json()["total"] == 0
