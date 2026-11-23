"""Step 4 batch 1: durable, same-organization logo/deck selections."""

import io
import uuid

import pytest
from PIL import Image

from app.models.file import File
from app.tests.conftest import TestSessionFactory
from app.tests.test_files import reserve, uploaded
from app.tests.test_task_labels import _create_org, _invite_member, _signup_verified

pytest_plugins = ["app.tests.test_files"]


def path(org, field):
    return f"/api/v1/organizations/{org['id']}" + (
        "/startup-profile" if field == "pitch_deck_file_id" else ""
    )


async def ready_file(client, owner, storage, org, field):
    if field == "logo_file_id":
        image = io.BytesIO()
        Image.new("RGB", (4, 4)).save(image, format="PNG")
        return await uploaded(
            client,
            owner,
            storage,
            org=org,
            kind="logo",
            name="logo.png",
            mime="image/png",
            data=image.getvalue(),
        )
    return await uploaded(client, owner, storage, org=org, kind="pitch_deck")


@pytest.mark.parametrize("field", ["logo_file_id", "pitch_deck_file_id"])
async def test_attach_read_clear_delete_and_public_privacy(client, file_env, field):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    file_id = await ready_file(client, owner, storage, org, field)
    response = await client.patch(path(org, field), headers=owner["headers"], json={field: file_id})
    assert response.status_code == 200, response.text
    assert response.json()[field] == file_id
    if field == "logo_file_id":
        assert (await client.get("/api/v1/organizations/mine", headers=owner["headers"])).json()[0][
            field
        ] == file_id
    assert (await client.get(path(org, field), headers=owner["headers"])).json()[field] == file_id
    await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        headers=owner["headers"],
        json={"profile_visibility": "public"},
    )
    public = await client.get(f"/api/v1/public/startups/{org['slug']}")
    assert public.status_code == 200
    assert field not in public.json()
    assert file_id not in public.text
    cleared = await client.patch(path(org, field), headers=owner["headers"], json={field: None})
    assert cleared.status_code == 200 and cleared.json()[field] is None
    await client.patch(path(org, field), headers=owner["headers"], json={field: file_id})
    assert (
        await client.delete(f"/api/v1/files/{file_id}", headers=owner["headers"])
    ).status_code == 204
    assert (await client.get(path(org, field), headers=owner["headers"])).json()[field] is None


@pytest.mark.parametrize("field", ["logo_file_id", "pitch_deck_file_id"])
@pytest.mark.parametrize("role", ["admin", "member", "viewer"])
async def test_selection_roles(client, file_env, field, role):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    actor = await _signup_verified(client, "actor@example.com")
    org = await _create_org(client, owner)
    await _invite_member(client, owner, actor, org, role)
    file_id = await ready_file(client, owner, storage, org, field)
    response = await client.patch(path(org, field), headers=actor["headers"], json={field: file_id})
    allowed = role == "admin" or (role == "member" and field == "pitch_deck_file_id")
    assert response.status_code == (200 if allowed else 403), response.text


@pytest.mark.parametrize("field", ["logo_file_id", "pitch_deck_file_id"])
async def test_reference_checks_and_auth(client, file_env, field):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    other = await _signup_verified(client, "other@example.com")
    org, foreign_org = (
        await _create_org(client, owner),
        await _create_org(client, other, name="Foreign"),
    )
    foreign = await ready_file(client, other, storage, foreign_org, field)
    personal = await uploaded(client, owner, storage, kind="pitch_deck")
    wrong_kind = await uploaded(client, owner, storage, org=org, kind="resume")
    pending = (await reserve(client, owner, org=org, kind="pitch_deck"))["file"]["id"]
    deleted = await ready_file(client, owner, storage, org, field)
    await client.delete(f"/api/v1/files/{deleted}", headers=owner["headers"])
    for ref in (foreign, personal, wrong_kind, pending, deleted, str(uuid.uuid4())):
        response = await client.patch(path(org, field), headers=owner["headers"], json={field: ref})
        assert response.status_code == 422, response.text
        assert response.json()["error"]["details"][0]["loc"] == ["body", field]
    assert (await client.patch(path(org, field), json={field: foreign})).status_code == 401
    assert (
        await client.patch(path(org, field), headers=other["headers"], json={field: foreign})
    ).status_code in (403, 404)
    assert (
        await client.patch(path(org, field), headers=owner["headers"], json={field: "not-a-uuid"})
    ).status_code == 422
    assert (
        await client.patch(
            path(org, field),
            headers=owner["headers"],
            json={"storage_key": "injected", "scan_status": "clean"},
        )
    ).status_code == 422


@pytest.mark.parametrize("field", ["logo_file_id", "pitch_deck_file_id"])
@pytest.mark.parametrize("scan", ["pending", "failed", "infected"])
async def test_unclean_file_cannot_be_selected(client, file_env, field, scan):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    file_id = await ready_file(client, owner, storage, org, field)
    async with TestSessionFactory() as db:
        row = await db.get(File, uuid.UUID(file_id))
        assert row
        row.scan_status, row.upload_status = scan, "uploaded"
        await db.commit()
    assert (
        await client.patch(path(org, field), headers=owner["headers"], json={field: file_id})
    ).status_code == 422
