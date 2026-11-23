"""9g tests reuse real authentication, membership, database and Step 4 processing."""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.data_room import DataRoomDocumentVersion
from app.tests.conftest import TestSessionFactory
from app.tests.test_files import uploaded
from app.tests.test_task_labels import _create_org, _invite_member, _signup_verified

pytest_plugins = ["app.tests.test_files"]


@pytest_asyncio.fixture
async def workspace(client, file_env):
    storage, _ = file_env
    owner = await _signup_verified(client, "room-owner@test.dev")
    org = await _create_org(client, owner)
    base = f"/api/v1/organizations/{org['id']}/data-room"
    assert (await client.get(base, headers=owner["headers"])).status_code == 404
    room = await client.put(base, headers=owner["headers"], json={"nda_required": False})
    assert room.status_code == 200, room.text
    folder = await client.post(base + "/folders", headers=owner["headers"], json={"name": "Pitch"})
    assert folder.status_code == 201, folder.text
    file_id = await uploaded(client, owner, storage, org=org, kind="pitch_deck")
    document = await client.post(
        base + "/documents",
        headers=owner["headers"],
        json={
            "folder_id": folder.json()["id"],
            "file_id": file_id,
            "name": "Deck",
            "visibility": "approved_investors",
        },
    )
    assert document.status_code == 201, document.text
    return dict(
        owner=owner,
        org=org,
        base=base,
        room=room.json(),
        folder=folder.json(),
        doc=document.json(),
        file_id=file_id,
        storage=storage,
    )


async def test_core_version_lifecycle_and_file_retention(client, workspace):
    w = workspace
    h, base, doc = w["owner"]["headers"], w["base"], w["doc"]
    assert (await client.put(base, headers=h, json={})).json()["id"] == w["room"]["id"]
    newer = await uploaded(
        client, w["owner"], w["storage"], org=w["org"], kind="pitch_deck", name="new.pdf"
    )
    response = await client.post(
        f"{base}/documents/{doc['id']}/versions", headers=h, json={"file_id": newer}
    )
    assert response.status_code == 201, response.text
    assert response.json()["version_number"] == 2
    repeated = await client.post(
        f"{base}/documents/{doc['id']}/versions", headers=h, json={"file_id": newer}
    )
    assert repeated.json()["id"] == response.json()["id"]
    versions = (
        await client.get(f"{base}/documents/{doc['id']}/versions?limit=1", headers=h)
    ).json()
    assert versions["total"] == 2 and len(versions["items"]) == 1
    assert (await client.get(base + "/documents", headers=h)).json()["items"][0]["version"] == "v2"
    for ref in [newer, w["file_id"]]:
        result = await client.delete(f"/api/v1/files/{ref}", headers=h)
        assert result.status_code == 409 and result.json()["error"]["code"] == "FILE_IN_USE"
    assert (
        await client.delete(base + f"/folders/{w['folder']['id']}", headers=h)
    ).status_code == 409
    assert (await client.delete(base + f"/documents/{doc['id']}", headers=h)).status_code == 204
    assert (await client.get(base + "/documents", headers=h)).json()["total"] == 0
    assert (await client.delete(f"/api/v1/files/{w['file_id']}", headers=h)).status_code == 409
    assert (
        await client.delete(base + f"/folders/{w['folder']['id']}", headers=h)
    ).status_code == 204
    async with TestSessionFactory() as db:
        assert len((await db.execute(select(DataRoomDocumentVersion))).scalars().all()) == 2


@pytest.mark.parametrize("role", ["owner", "admin", "member", "viewer"])
async def test_startup_permissions(client, workspace, role):
    w = workspace
    actor = w["owner"]
    if role != "owner":
        actor = await _signup_verified(client, "actor@test.dev")
        await _invite_member(client, w["owner"], actor, w["org"], role)
    h, base = actor["headers"], w["base"]
    for suffix in ["", "/folders", "/documents", f"/documents/{w['doc']['id']}/versions"]:
        assert (await client.get(base + suffix, headers=h)).status_code == 200
    assert (await client.put(base, headers=h, json={"name": "New name"})).status_code == (
        200 if role in ["owner", "admin"] else 403
    )
    assert (
        await client.post(base + "/folders", headers=h, json={"name": "New folder"})
    ).status_code == (201 if role in ["owner", "admin"] else 403)
    assert (
        await client.patch(
            base + f"/documents/{w['doc']['id']}", headers=h, json={"name": "Renamed"}
        )
    ).status_code == (403 if role == "viewer" else 200)
    assert (
        await client.patch(
            base + f"/documents/{w['doc']['id']}", headers=h, json={"visibility": "private"}
        )
    ).status_code == (200 if role in ["owner", "admin"] else 403)
    created = await client.post(
        base + "/documents",
        headers=h,
        json={"folder_id": w["folder"]["id"], "file_id": w["file_id"], "name": "New private"},
    )
    assert created.status_code == (403 if role == "viewer" else 201), created.text
    assert (await client.delete(base + f"/documents/{w['doc']['id']}", headers=h)).status_code == (
        204 if role in ["owner", "admin"] else 403
    )


async def test_foreign_references_and_organization_isolation(client, workspace):
    w = workspace
    other = await _signup_verified(client, "other@test.dev")
    org = await _create_org(client, other, name="Other")
    foreign = await uploaded(client, other, w["storage"], org=org, kind="pitch_deck")
    personal = await uploaded(client, w["owner"], w["storage"], kind="pitch_deck")
    for ref in [foreign, personal, str(uuid.uuid4())]:
        response = await client.post(
            w["base"] + "/documents",
            headers=w["owner"]["headers"],
            json={"folder_id": w["folder"]["id"], "file_id": ref, "name": "Foreign"},
        )
        assert response.status_code == 422, response.text
    for method, suffix, body in [
        ("get", "", None),
        ("get", "/documents", None),
        ("patch", f"/documents/{w['doc']['id']}", {"name": "Stolen"}),
    ]:
        r = await client.request(method, w["base"] + suffix, headers=other["headers"], json=body)
        assert r.status_code == 404, r.text
    assert (
        await client.post(
            w["base"] + "/folders",
            headers=w["owner"]["headers"],
            json={"name": "Bad", "parent_id": str(uuid.uuid4())},
        )
    ).status_code == 422
    assert (
        await client.post(
            w["base"] + "/documents",
            headers=w["owner"]["headers"],
            json={"name": "Bad", "file_id": w["file_id"], "folder_id": str(uuid.uuid4())},
        )
    ).status_code == 404


async def test_hierarchy_cycle_depth_move_and_nonempty_delete(client, workspace):
    w = workspace
    h = w["owner"]["headers"]
    base = w["base"]
    parent = w["folder"]["id"]
    for depth in range(2, 9):
        r = await client.post(
            base + "/folders", headers=h, json={"name": str(depth), "parent_id": parent}
        )
        assert r.status_code == 201, r.text
        parent = r.json()["id"]
    assert (
        await client.post(
            base + "/folders", headers=h, json={"name": "Too deep", "parent_id": parent}
        )
    ).status_code == 422
    assert (
        await client.patch(
            base + f"/folders/{w['folder']['id']}", headers=h, json={"parent_id": parent}
        )
    ).status_code == 422
    assert (
        await client.delete(base + f"/folders/{w['folder']['id']}", headers=h)
    ).status_code == 409


@pytest.mark.parametrize(
    "suffix,method,body",
    [
        ("", "put", {"org_id": str(uuid.uuid4())}),
        ("", "put", {"is_active": None}),
        ("/folders", "post", {"name": "  "}),
        ("/folders", "post", {"name": "X", "data_room_id": str(uuid.uuid4())}),
        ("/folders", "post", {"name": "X", "display_order": -1}),
        ("/folders", "post", {"name": "X", "display_order": True}),
        (
            "/documents",
            "post",
            {
                "name": "X",
                "folder_id": str(uuid.uuid4()),
                "file_id": str(uuid.uuid4()),
                "version": "v100",
            },
        ),
        (
            "/documents",
            "post",
            {
                "name": "X",
                "folder_id": str(uuid.uuid4()),
                "file_id": str(uuid.uuid4()),
                "visibility": "public",
            },
        ),
    ],
)
async def test_validation_and_mass_assignment(client, workspace, suffix, method, body):
    w = workspace
    assert (
        await client.request(method, w["base"] + suffix, headers=w["owner"]["headers"], json=body)
    ).status_code == 422


async def test_core_limits_pagination_and_no_store(client, workspace, monkeypatch):
    from app.core.config import get_settings

    w = workspace
    h = w["owner"]["headers"]
    base = w["base"]
    result = await client.get(base + "/documents?limit=1&offset=1", headers=h)
    assert result.json()["total"] == 1 and result.json()["items"] == []
    assert result.headers["cache-control"] == "no-store"
    for query in ["limit=0", "limit=101", "offset=-1"]:
        assert (await client.get(base + "/folders?" + query, headers=h)).status_code == 422
    assert (await client.put(base, headers=h, content=b"x" * 8193)).status_code == 413
    monkeypatch.setattr(get_settings(), "DATA_ROOM_WRITE_LIMIT", 1)
    assert (await client.put(base, headers=h, json={})).status_code == 429


@pytest.mark.parametrize("invalid", ["pending", "infected", "deleted", "purged"])
async def test_unusable_files_rejected_for_documents_and_versions(client, workspace, invalid):
    from app.models.file import File
    from app.services.data_room_service import now

    w = workspace
    async with TestSessionFactory() as db:
        file = await db.get(File, uuid.UUID(w["file_id"]))
        if invalid == "pending":
            file.upload_status = "pending"
        elif invalid == "infected":
            file.scan_status = "infected"
            file.upload_status = "rejected"
        elif invalid == "deleted":
            file.deleted_at = now()
        else:
            file.purged_at = now()
        await db.commit()
    bodies = [
        ("/documents", {"name": "Bad", "folder_id": w["folder"]["id"], "file_id": w["file_id"]}),
        (f"/documents/{w['doc']['id']}/versions", {"file_id": w["file_id"]}),
    ]
    for suffix, body in bodies:
        result = await client.post(w["base"] + suffix, headers=w["owner"]["headers"], json=body)
        assert result.status_code == 422, result.text


async def test_foreign_room_folder_document_and_version_ids(client, workspace):
    w = workspace
    other = await _signup_verified(client, "second@test.dev")
    org = await _create_org(client, other, name="Second startup")
    base = f"/api/v1/organizations/{org['id']}/data-room"
    await client.put(base, headers=other["headers"], json={})
    folder = (
        await client.post(base + "/folders", headers=other["headers"], json={"name": "Foreign"})
    ).json()["id"]
    for method, suffix, body, status in [
        ("post", "/folders", {"name": "Bad", "parent_id": folder}, 422),
        ("patch", f"/folders/{w['folder']['id']}", {"parent_id": folder}, 422),
        ("patch", f"/documents/{w['doc']['id']}", {"folder_id": folder}, 404),
    ]:
        assert (
            await client.request(
                method, w["base"] + suffix, headers=w["owner"]["headers"], json=body
            )
        ).status_code == status
    for method, suffix, body in [
        ("delete", f"/folders/{w['folder']['id']}", None),
        ("patch", f"/documents/{w['doc']['id']}", {"name": "Bad"}),
        ("get", f"/documents/{w['doc']['id']}/versions", None),
        ("post", f"/documents/{w['doc']['id']}/versions", {"file_id": w["file_id"]}),
    ]:
        assert (
            await client.request(method, base + suffix, headers=other["headers"], json=body)
        ).status_code == 404


@pytest.mark.parametrize(
    "field,value",
    [
        ("view_count", 10),
        ("updated_by", str(uuid.uuid4())),
        ("version_number", 3),
        ("file_id", str(uuid.uuid4())),
        ("deleted_at", "2026-11-23T00:00:00Z"),
        ("created_at", "2026-11-23T00:00:00Z"),
    ],
)
async def test_document_update_mass_assignment(client, workspace, field, value):
    w = workspace
    assert (
        await client.patch(
            w["base"] + f"/documents/{w['doc']['id']}",
            headers=w["owner"]["headers"],
            json={field: value},
        )
    ).status_code == 422
