"""Step 4 tests; real auth/SQL, shared fixtures, fake R2 and scanner only."""

import hashlib
import io
import uuid
import zipfile
from datetime import timedelta

import pytest
import pytest_asyncio
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.models.activity import ActivityEvent
from app.models.file import File
from app.models.organization import MemberStatus, Organization, OrganizationMember
from app.services import file_processing_service as processing
from app.services.file_service import now
from app.services.storage_service import R2Storage, StorageInvalid, StorageMissing, get_storage
from app.tests.conftest import TestSessionFactory
from app.tests.test_task_labels import _create_org, _invite_member, _signup_verified, _user_id

PDF = b"%PDF-1.7\nexample\n%%EOF"


class MemoryStorage:
    def __init__(self):
        self.objects = {}
        self.uploads = []
        self.downloads = []
        self.fail = False

    async def sign_upload(self, key, mime, ttl):
        self.uploads.append((key, mime, ttl))
        return "https://storage.example.test/upload"

    async def sign_download(self, key, name, mime, ttl, *, image=False, inline=False):
        self.downloads.append((key, name, mime, ttl, image))
        return "https://storage.example.test/download"

    async def read(self, key, max_size):
        if self.fail:
            raise OSError("provider detail must not leak")
        if key not in self.objects:
            raise StorageMissing
        data, mime = self.objects[key]
        if len(data) > max_size:
            raise StorageInvalid
        return data, mime

    async def put(self, key, data, mime):
        self.objects[key] = (data, mime)

    async def delete(self, key):
        self.objects.pop(key, None)

    async def cleanup_prefix(self, prefix, keep, before):
        for key in list(self.objects):
            if key.startswith(prefix) and key not in keep:
                del self.objects[key]


class StubScanner:
    def __init__(self, status="clean"):
        self.status = status

    async def scan(self, data, mime):
        return self.status


@pytest_asyncio.fixture
async def file_env(monkeypatch):
    storage, scanner = MemoryStorage(), StubScanner()
    get_storage.cache_clear()
    monkeypatch.setattr("app.services.storage_service.R2Storage", lambda: storage)

    async def background(file_id, ignored_scanner, passed_storage):
        await processing.process_file(file_id, TestSessionFactory, passed_storage, scanner)

    monkeypatch.setattr(processing, "process_in_background", background)
    yield storage, scanner
    get_storage.cache_clear()


async def reserve(
    client, auth, *, org=None, kind="resume", data=PDF, name="resume.pdf", mime="application/pdf"
):
    path = (
        f"/api/v1/organizations/{org['id']}/files/upload-requests"
        if org
        else "/api/v1/users/me/files/upload-requests"
    )
    response = await client.post(
        path,
        headers=auth["headers"],
        json={"kind": kind, "file_name": name, "mime_type": mime, "byte_size": len(data)},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def uploaded(client, auth, storage, **kwargs):
    body = await reserve(client, auth, **kwargs)
    storage.objects[storage.uploads[-1][0]] = (
        kwargs.get("data", PDF),
        kwargs.get("mime", "application/pdf"),
    )
    response = await client.post(
        f"/api/v1/files/{body['file']['id']}/confirm", headers=auth["headers"]
    )
    assert response.status_code == 200, response.text
    return body["file"]["id"]


@pytest.mark.parametrize(
    "kind", ["resume", "pitch_deck", "legal", "financial_model", "document", "other"]
)
async def test_document_round_trip(client, file_env, kind):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    file_id = await uploaded(client, owner, storage, kind=kind)
    detail = await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])
    assert detail.status_code == 200
    assert detail.json()["upload_status"] == "ready"
    assert detail.json()["scan_status"] == "clean"
    assert detail.json()["checksum_sha256"] == hashlib.sha256(PDF).hexdigest()
    for key in (
        "storage_key",
        "upload_storage_key",
        "thumbnail_storage_key",
        "processing_token",
        "processing_expires_at",
        "purged_at",
    ):
        assert key not in detail.json()
    response = await client.post(
        f"/api/v1/files/{file_id}/download-url", headers=owner["headers"], json={}
    )
    assert response.status_code == 200
    assert response.json()["expires_in"] == 60
    assert storage.downloads[-1][-1] is False
    storage.objects[storage.uploads[-1][0]] = (b"malicious replacement", "application/pdf")
    assert storage.objects[storage.downloads[-1][0]][0] == PDF
    assert (
        await client.post(f"/api/v1/files/{file_id}/confirm", headers=owner["headers"])
    ).status_code == 200
    assert (
        await client.post(
            f"/api/v1/files/{file_id}/download-url",
            headers=owner["headers"],
            json={"variant": "thumbnail"},
        )
    ).status_code == 404
    async with TestSessionFactory() as db:
        events = list(
            (
                await db.execute(
                    select(ActivityEvent).where(ActivityEvent.entity_id == uuid.UUID(file_id))
                )
            ).scalars()
        )
    assert {e.event_type for e in events} >= {
        "file_upload_requested",
        "file_confirmed",
        "file_processed",
    }


@pytest.mark.parametrize("kind", ["image", "logo"])
async def test_images_and_thumbnails(client, file_env, kind):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner) if kind == "logo" else None
    out = io.BytesIO()
    Image.new("RGB", (500, 300), "red").save(out, format="PNG")
    file_id = await uploaded(
        client,
        owner,
        storage,
        org=org,
        kind=kind,
        data=out.getvalue(),
        mime="image/png",
        name="avatar.png",
    )
    response = await client.post(
        f"/api/v1/files/{file_id}/download-url",
        headers=owner["headers"],
        json={"variant": "thumbnail"},
    )
    assert response.status_code == 200, response.text
    with Image.open(io.BytesIO(storage.objects[storage.downloads[-1][0]][0])) as image:
        assert image.format == "WEBP" and max(image.size) <= 256
        assert not image.getexif()


@pytest.mark.parametrize("role", ["owner", "admin", "member", "viewer"])
async def test_org_permission_matrix(client, file_env, role):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    actor = owner if role == "owner" else await _signup_verified(client, "member@example.com")
    org = await _create_org(client, owner)
    if role != "owner":
        await _invite_member(client, owner, actor, org, role)
    owner_file = await uploaded(client, owner, storage, org=org)
    base = f"/api/v1/files/{owner_file}"
    assert (await client.get(base, headers=actor["headers"])).status_code == 200
    assert (
        await client.get(f"/api/v1/organizations/{org['id']}/files", headers=actor["headers"])
    ).json()["total"] == 1
    assert (
        await client.post(base + "/download-url", headers=actor["headers"], json={})
    ).status_code == 200
    manage = 200 if role in {"owner", "admin"} else 403
    assert (await client.post(base + "/confirm", headers=actor["headers"])).status_code == manage
    request = await client.post(
        f"/api/v1/organizations/{org['id']}/files/upload-requests",
        headers=actor["headers"],
        json={
            "kind": "resume",
            "file_name": "cv.pdf",
            "mime_type": "application/pdf",
            "byte_size": len(PDF),
        },
    )
    assert request.status_code == (403 if role == "viewer" else 201)
    if role == "member":
        own_id = request.json()["file"]["id"]
        storage.objects[storage.uploads[-1][0]] = (PDF, "application/pdf")
        assert (
            await client.post(f"/api/v1/files/{own_id}/confirm", headers=actor["headers"])
        ).status_code == 200
        assert (
            await client.delete(f"/api/v1/files/{own_id}", headers=actor["headers"])
        ).status_code == 204
    assert (await client.delete(base, headers=actor["headers"])).status_code == (
        204 if manage == 200 else 403
    )


async def test_cross_user_org_and_revoked_access(client, file_env):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    other = await _signup_verified(client, "other@example.com")
    org = await _create_org(client, owner)
    await _create_org(client, other, name="Other")
    personal_id = await uploaded(client, owner, storage)
    org_id = await uploaded(client, owner, storage, org=org)
    for file_id in (personal_id, org_id, str(uuid.uuid4())):
        for method, tail, kwargs in [
            ("get", "", {}),
            ("post", "/confirm", {}),
            ("post", "/download-url", {"json": {}}),
            ("delete", "", {}),
        ]:
            assert (
                await getattr(client, method)(
                    f"/api/v1/files/{file_id}{tail}", headers=other["headers"], **kwargs
                )
            ).status_code == 404
    assert (
        await client.get(f"/api/v1/organizations/{org['id']}/files", headers=other["headers"])
    ).status_code == 404
    response = await client.post(
        f"/api/v1/organizations/{org['id']}/files/upload-requests",
        headers=other["headers"],
        json={
            "kind": "resume",
            "file_name": "cv.pdf",
            "mime_type": "application/pdf",
            "byte_size": 20,
        },
    )
    assert response.status_code == 404
    await _invite_member(client, owner, other, org, "member")
    own_id = await uploaded(client, other, storage, org=org)
    uid = uuid.UUID(await _user_id(client, other))
    async with TestSessionFactory() as db:
        member = (
            await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.org_id == uuid.UUID(org["id"]),
                    OrganizationMember.user_id == uid,
                )
            )
        ).scalar_one()
        member.status = MemberStatus.deactivated
        await db.commit()
    assert (
        await client.get(f"/api/v1/files/{own_id}", headers=other["headers"])
    ).status_code == 404
    assert (await client.get("/api/v1/users/me/files", headers=other["headers"])).json()[
        "total"
    ] == 0


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("get", "/users/me/files", {}),
        ("get", f"/organizations/{uuid.uuid4()}/files", {}),
        ("post", "/users/me/files/upload-requests", {"json": {}}),
        ("post", f"/organizations/{uuid.uuid4()}/files/upload-requests", {"json": {}}),
        ("get", f"/files/{uuid.uuid4()}", {}),
        ("post", f"/files/{uuid.uuid4()}/confirm", {}),
        ("post", f"/files/{uuid.uuid4()}/download-url", {"json": {}}),
        ("delete", f"/files/{uuid.uuid4()}", {}),
    ],
)
async def test_401(client, file_env, method, path, kwargs):
    assert (await getattr(client, method)("/api/v1" + path, **kwargs)).status_code == 401


@pytest.mark.parametrize(
    "field,value",
    [
        ("id", str(uuid.uuid4())),
        ("owner_org_id", str(uuid.uuid4())),
        ("uploaded_by", str(uuid.uuid4())),
        ("storage_key", "foreign/key"),
        ("upload_storage_key", "foreign/key"),
        ("thumbnail_storage_key", "foreign/key"),
        ("checksum_sha256", "a" * 64),
        ("scan_status", "clean"),
        ("upload_status", "ready"),
        ("scanned_at", "2026-01-01T00:00:00Z"),
        ("created_at", "2026-01-01T00:00:00Z"),
        ("updated_at", "2026-01-01T00:00:00Z"),
        ("deleted_at", None),
        ("confirmed_at", None),
        ("upload_expires_at", "2030-01-01T00:00:00Z"),
        ("processing_token", str(uuid.uuid4())),
        ("processing_expires_at", None),
        ("purged_at", None),
    ],
)
async def test_mass_assignment(client, file_env, field, value):
    owner = await _signup_verified(client, "owner@example.com")
    payload = {
        "kind": "resume",
        "file_name": "cv.pdf",
        "mime_type": "application/pdf",
        "byte_size": 20,
        field: value,
    }
    response = await client.post(
        "/api/v1/users/me/files/upload-requests", headers=owner["headers"], json=payload
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "patch_",
    [
        {"file_name": "../cv.pdf"},
        {"file_name": "a\\cv.pdf"},
        {"file_name": "a\n.pdf"},
        {"file_name": "a" * 256 + ".pdf"},
        {"file_name": "cv.svg"},
        {"file_name": "cv.html"},
        {"mime_type": "text/html"},
        {"byte_size": 0},
        {"byte_size": -1},
        {"byte_size": True},
        {"byte_size": "25"},
        {"byte_size": 11 * 1024 * 1024},
        {"kind": "unknown"},
    ],
)
async def test_input_validation(client, file_env, patch_):
    owner = await _signup_verified(client, "owner@example.com")
    payload = {
        "kind": "resume",
        "file_name": "cv.pdf",
        "mime_type": "application/pdf",
        "byte_size": 20,
        **patch_,
    }
    response = await client.post(
        "/api/v1/users/me/files/upload-requests", headers=owner["headers"], json=payload
    )
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    "status,expected", [("infected", "rejected"), ("failed", "uploaded"), ("anything", "uploaded")]
)
async def test_scan_fail_closed(client, file_env, status, expected):
    storage, scanner = file_env
    scanner.status = status
    owner = await _signup_verified(client, "owner@example.com")
    file_id = await uploaded(client, owner, storage)
    detail = (await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])).json()
    assert detail["upload_status"] == expected
    assert (
        await client.post(
            f"/api/v1/files/{file_id}/download-url", headers=owner["headers"], json={}
        )
    ).status_code == 409
    assert not any(not key.startswith("staging/") for key in storage.objects)


@pytest.mark.parametrize(
    "data,mime",
    [(b"not a PDF", "application/pdf"), (PDF + b"extra", "application/pdf"), (PDF, "text/html")],
)
async def test_actual_content_validation(client, file_env, data, mime):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    body = await reserve(client, owner)
    storage.objects[storage.uploads[-1][0]] = (data, mime)
    file_id = body["file"]["id"]
    assert (
        await client.post(f"/api/v1/files/{file_id}/confirm", headers=owner["headers"])
    ).status_code == 200
    assert (await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])).json()[
        "upload_status"
    ] == "rejected"


async def test_expiry_missing_retry_cleanup_delete(client, file_env):
    storage, scanner = file_env
    owner = await _signup_verified(client, "owner@example.com")
    body = await reserve(client, owner)
    file_id = body["file"]["id"]
    await client.post(f"/api/v1/files/{file_id}/confirm", headers=owner["headers"])
    assert (await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])).json()[
        "scan_status"
    ] == "pending"
    storage.objects[storage.uploads[-1][0]] = (PDF, "application/pdf")
    assert (await processing.maintain_files(TestSessionFactory, storage, scanner, batch_size=1))[
        "retried"
    ] == 1
    assert (
        await client.delete(f"/api/v1/files/{file_id}", headers=owner["headers"])
    ).status_code == 204
    assert (
        await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])
    ).status_code == 404
    async with TestSessionFactory() as db:
        row = await db.get(File, uuid.UUID(file_id))
        assert row
        row.deleted_at = now() - timedelta(hours=24, minutes=1)
        # Deletion grace can end before upload-expiry + grace; staging must
        # still be removed before checkpointing a successful physical purge.
        row.upload_expires_at = now() - timedelta(hours=23, minutes=56)
        await db.commit()
    assert (await processing.maintain_files(TestSessionFactory, storage, scanner))["purged"] == 1
    assert not storage.objects
    assert (await processing.maintain_files(TestSessionFactory, storage, scanner))["purged"] == 0
    body = await reserve(client, owner)
    async with TestSessionFactory() as db:
        row = await db.get(File, uuid.UUID(body["file"]["id"]))
        assert row
        row.upload_expires_at = now() - timedelta(hours=25)
        await db.commit()
    assert (
        await client.post(f"/api/v1/files/{body['file']['id']}/confirm", headers=owner["headers"])
    ).status_code == 409
    await processing.maintain_files(TestSessionFactory, storage, scanner)
    assert (
        await client.get(f"/api/v1/files/{body['file']['id']}", headers=owner["headers"])
    ).json()["upload_status"] == "expired"


async def test_deleted_org_does_not_transfer_file_to_uploader(client, file_env):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    file_id = await uploaded(client, owner, storage, org=org)
    # Exercise the actual SET NULL FK on PostgreSQL; the shared SQLite
    # fixtures do not globally enable FK enforcement, so simulate it there.
    async with TestSessionFactory() as db:
        row = await db.get(File, uuid.UUID(file_id))
        assert row
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            organization = await db.get(Organization, uuid.UUID(org["id"]))
            assert organization is not None
            await db.delete(organization)
        else:
            row.owner_org_id = None
        await db.commit()
    assert (
        await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])
    ).status_code == 404
    assert (await client.get("/api/v1/users/me/files", headers=owner["headers"])).json()[
        "total"
    ] == 0


async def test_lists_limits_rate_limits_and_suspended_org(client, file_env, monkeypatch):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    org_file = await uploaded(client, owner, storage, org=org)
    await reserve(client, owner)
    page = await client.get(
        "/api/v1/users/me/files?limit=1&offset=0&kind=resume&sort=file_name&order=asc",
        headers=owner["headers"],
    )
    assert page.json()["total"] == 1 and len(page.json()["items"]) == 1
    for query in ("limit=101", "offset=-1", "sort=storage_key", "order=bad", "kind=bad"):
        assert (
            await client.get("/api/v1/users/me/files?" + query, headers=owner["headers"])
        ).status_code == 422
    settings = get_settings()
    monkeypatch.setattr(settings, "FILE_PENDING_LIMIT", 1)
    payload = {
        "kind": "resume",
        "file_name": "a.pdf",
        "mime_type": "application/pdf",
        "byte_size": 20,
    }
    assert (
        await client.post(
            "/api/v1/users/me/files/upload-requests", headers=owner["headers"], json=payload
        )
    ).status_code == 409
    monkeypatch.setattr(settings, "FILE_UPLOAD_USER_LIMIT", 1)
    assert (
        await client.post(
            "/api/v1/users/me/files/upload-requests", headers=owner["headers"], json=payload
        )
    ).status_code == 429
    async with TestSessionFactory() as db:
        row = await db.get(Organization, uuid.UUID(org["id"]))
        assert row
        row.status = "suspended"
        await db.commit()
    assert (
        await client.get(f"/api/v1/files/{org_file}", headers=owner["headers"])
    ).status_code == 404


async def test_production_scanner_safety():
    with pytest.raises(ValidationError):
        Settings(ENVIRONMENT="prod", FILE_SCANNER="dev_clean")
    assert await processing.ConfiguredScanner().scan(PDF, "application/pdf") == "failed"


@pytest.mark.parametrize(
    "ext,required",
    [
        (".docx", "word/document.xml"),
        (".pptx", "ppt/presentation.xml"),
        (".xlsx", "xl/workbook.xml"),
    ],
)
def test_office_structure(ext, required):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr(required, "<document/>")
    assert processing.validate_bytes(stream.getvalue(), "application/office", "file" + ext) is None
    with zipfile.ZipFile(stream, "a") as archive:
        archive.writestr("word/vbaProject.bin", b"macro")
    with pytest.raises(ValueError):
        processing.validate_bytes(stream.getvalue(), "application/office", "file" + ext)


def test_bad_image_text_office():
    for data, mime, name in [
        (b"<svg/>", "image/png", "a.png"),
        (b"bad", "application/office", "a.docx"),
        (b"abc\x00", "text/plain", "a.txt"),
    ]:
        with pytest.raises(ValueError):
            processing.validate_bytes(data, mime, name)


async def test_r2_signatures_no_network(monkeypatch):
    settings = get_settings()
    for name, value in {
        "R2_ACCOUNT_ID": "a" * 32,
        "R2_ACCESS_KEY_ID": "test",
        "R2_SECRET_ACCESS_KEY": "test-secret",
        "R2_BUCKET": "test-bucket",
    }.items():
        monkeypatch.setattr(settings, name, value)
    storage = R2Storage()
    url = await storage.sign_upload("staging/random", "application/pdf", 300)
    assert ".r2.cloudflarestorage.com/" in url and "X-Amz-Expires=300" in url
    assert "content-type" in url
    url = await storage.sign_download("personal/random", 'a".pdf', "application/pdf", 60)
    assert "X-Amz-Expires=60" in url and "attachment" in url
    storage.client.close()


async def test_unconfigured_storage_fails_closed(monkeypatch):
    monkeypatch.setattr(get_settings(), "R2_ACCOUNT_ID", "")
    from app.core.exceptions import AppException

    with pytest.raises(AppException) as exc:
        R2Storage()
    assert exc.value.status_code == 503


async def test_confirm_and_download_reject_mass_assignment(client, file_env):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    body = await reserve(client, owner)
    base = f"/api/v1/files/{body['file']['id']}"
    for field, value in (
        ("scan_status", "clean"),
        ("storage_key", "foreign/key"),
        ("owner_org_id", str(uuid.uuid4())),
        ("uploaded_by", str(uuid.uuid4())),
        ("upload_status", "ready"),
    ):
        for suffix in ("/confirm", "/download-url"):
            response = await client.post(
                base + suffix, headers=owner["headers"], json={field: value}
            )
            assert response.status_code == 422
    assert (await client.get(base, headers=owner["headers"])).json()["scan_status"] == "pending"
    assert not storage.objects


async def test_org_mass_assignment_and_reference_rejection(client, file_env):
    owner = await _signup_verified(client, "owner@example.com")
    other = await _signup_verified(client, "other@example.com")
    org, foreign = (
        await _create_org(client, owner),
        await _create_org(client, other, name="Foreign"),
    )
    response = await client.post(
        f"/api/v1/organizations/{org['id']}/files/upload-requests",
        headers=owner["headers"],
        json={
            "kind": "logo",
            "file_name": "logo.png",
            "mime_type": "image/png",
            "byte_size": 20,
            "owner_org_id": foreign["id"],
        },
    )
    assert response.status_code == 422
    assert (
        await client.get(f"/api/v1/organizations/{org['id']}/files", headers=owner["headers"])
    ).json()["total"] == 0


async def test_processing_failure_retry_and_lease_protection(client, file_env):
    storage, scanner = file_env
    owner = await _signup_verified(client, "owner@example.com")
    storage.fail = True
    file_id = await uploaded(client, owner, storage)
    assert (await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])).json()[
        "scan_status"
    ] == "failed"
    storage.fail = False
    async with TestSessionFactory() as db:
        row = await db.get(File, uuid.UUID(file_id))
        assert row
        row.processing_token = uuid.uuid4()
        row.processing_expires_at = now() + timedelta(minutes=10)
        await db.commit()
    await processing.process_file(uuid.UUID(file_id), TestSessionFactory, storage, scanner)
    assert (await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])).json()[
        "upload_status"
    ] == "uploaded"
    async with TestSessionFactory() as db:
        row = await db.get(File, uuid.UUID(file_id))
        assert row
        row.processing_expires_at = now() - timedelta(minutes=1)
        await db.commit()
    await processing.process_file(uuid.UUID(file_id), TestSessionFactory, storage, scanner)
    assert (await client.get(f"/api/v1/files/{file_id}", headers=owner["headers"])).json()[
        "upload_status"
    ] == "ready"


@pytest.mark.parametrize("interruption", ["delete", "lease_taken", "lease_expired"])
async def test_interrupted_worker_cannot_publish(client, file_env, interruption):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    body = await reserve(client, owner)
    file_id = uuid.UUID(body["file"]["id"])
    storage.objects[storage.uploads[-1][0]] = (PDF, "application/pdf")
    async with TestSessionFactory() as db:
        row = await db.get(File, file_id)
        assert row
        row.upload_status, row.confirmed_at = "uploaded", now()
        await db.commit()

    class InterruptingScanner:
        async def scan(self, data, mime):
            async with TestSessionFactory() as db:
                row = await db.get(File, file_id)
                assert row
                if interruption == "delete":
                    row.deleted_at = now()
                elif interruption == "lease_taken":
                    row.processing_token = uuid.uuid4()
                else:
                    row.processing_expires_at = now() - timedelta(seconds=1)
                await db.commit()
            return "clean"

    await processing.process_file(file_id, TestSessionFactory, storage, InterruptingScanner())
    async with TestSessionFactory() as db:
        row = await db.get(File, file_id)
        assert row and row.upload_status == "uploaded" and row.scan_status == "pending"
    assert all(key.startswith("staging/") for key in storage.objects)


async def test_ready_cleanup_keeps_published_objects_and_is_retryable(client, file_env):
    storage, scanner = file_env
    owner = await _signup_verified(client, "owner@example.com")
    file_id = await uploaded(client, owner, storage)
    async with TestSessionFactory() as db:
        row = await db.get(File, uuid.UUID(file_id))
        assert row
        row.upload_expires_at = now() - timedelta(hours=25)
        final = row.storage_key
        abandoned = final.rsplit("/", 1)[0] + "/crashed-attempt"
        storage.objects[abandoned] = (PDF, "application/pdf")
        await db.commit()
    assert (await processing.maintain_files(TestSessionFactory, storage, scanner))["failed"] == 0
    assert set(storage.objects) == {final}
    assert (await processing.maintain_files(TestSessionFactory, storage, scanner))["visited"] == 0


async def test_rate_limits_for_actions_downloads_and_org(client, file_env, monkeypatch):
    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    org = await _create_org(client, owner)
    settings = get_settings()
    monkeypatch.setattr(settings, "FILE_DOWNLOAD_LIMIT", 1)
    monkeypatch.setattr(settings, "FILE_ACTION_LIMIT", 1)
    monkeypatch.setattr(settings, "FILE_UPLOAD_ORG_LIMIT", 1)
    file_id = await uploaded(client, owner, storage, org=org)
    for expected in (200, 429):
        assert (
            await client.post(
                f"/api/v1/files/{file_id}/download-url", headers=owner["headers"], json={}
            )
        ).status_code == expected
    assert (
        await client.delete(f"/api/v1/files/{file_id}", headers=owner["headers"])
    ).status_code == 429
    response = await client.post(
        f"/api/v1/organizations/{org['id']}/files/upload-requests",
        headers=owner["headers"],
        json={
            "kind": "resume",
            "file_name": "a.pdf",
            "mime_type": "application/pdf",
            "byte_size": 20,
        },
    )
    assert response.status_code == 429


async def test_database_constraints(client, file_env):
    from sqlalchemy.exc import IntegrityError

    storage, _ = file_env
    owner = await _signup_verified(client, "owner@example.com")
    body = await reserve(client, owner)
    for invalid in (
        {"byte_size": 0},
        {"kind": "invented"},
        {"scan_status": "approved"},
        {"upload_status": "ready"},
        {"processing_token": uuid.uuid4()},
    ):
        async with TestSessionFactory() as db:
            row = await db.get(File, uuid.UUID(body["file"]["id"]))
            assert row
            for key, value in invalid.items():
                setattr(row, key, value)
            with pytest.raises(IntegrityError):
                await db.commit()
            await db.rollback()


@pytest.mark.parametrize(
    "kind,name,mime",
    [
        ("image", "a.png", "image/png"),
        ("resume", "a.pdf", "application/pdf"),
        ("pitch_deck", "a.pdf", "application/pdf"),
    ],
)
def test_kind_size_bounds(kind, name, mime):
    from app.schemas.file import FileUploadCreate, max_bytes

    assert FileUploadCreate(kind=kind, file_name=name, mime_type=mime, byte_size=max_bytes(kind))
    with pytest.raises(ValidationError):
        FileUploadCreate(kind=kind, file_name=name, mime_type=mime, byte_size=max_bytes(kind) + 1)


@pytest.mark.parametrize("attack", ["traversal", "bomb", "wrong_type", "duplicate"])
def test_office_container_attacks(attack):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<document/>")
        if attack == "traversal":
            archive.writestr("../bad", "bad")
        elif attack == "bomb":
            archive.writestr("word/bomb.xml", b"a" * (50 * 1024 * 1024 + 1))
        elif attack == "wrong_type":
            pass
        else:
            with pytest.warns(UserWarning):
                archive.writestr("word/document.xml", "<again/>")
    with pytest.raises(ValueError):
        processing.validate_bytes(
            stream.getvalue(),
            "application/office",
            "a.pptx" if attack == "wrong_type" else "a.docx",
        )


def test_pixel_limit_and_format_mismatch():
    stream = io.BytesIO()
    Image.new("RGB", (4500, 4500)).save(stream, format="PNG")
    with pytest.raises(ValueError):
        processing.validate_bytes(stream.getvalue(), "image/png", "big.png")
    stream = io.BytesIO()
    Image.new("RGB", (1, 1)).save(stream, format="PNG")
    with pytest.raises(ValueError):
        processing.validate_bytes(stream.getvalue(), "image/jpeg", "mismatch.jpg")


async def test_r2_reads_errors_and_paginated_cleanup(monkeypatch):
    from botocore.exceptions import ClientError
    from botocore.response import StreamingBody

    from app.core.exceptions import AppException

    for name, value in {
        "R2_ACCOUNT_ID": "a" * 32,
        "R2_ACCESS_KEY_ID": "test",
        "R2_SECRET_ACCESS_KEY": "test",
        "R2_BUCKET": "bucket",
    }.items():
        monkeypatch.setattr(get_settings(), name, value)
    storage = R2Storage()
    stream = StreamingBody(io.BytesIO(PDF), len(PDF))

    class FakeS3:
        def get_object(self, **kwargs):
            return {"Body": stream, "ContentLength": len(PDF), "ContentType": "application/pdf"}

    storage.client.close()
    storage.client = FakeS3()
    assert await storage.read("key", 100) == (PDF, "application/pdf")
    assert stream._raw_stream.closed
    with pytest.raises(StorageInvalid):
        await storage.read("key", 1)

    class BrokenS3:
        def get_object(self, **kwargs):
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")

        def put_object(self, **kwargs):
            raise ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "secret bucket key"}}, "PutObject"
            )

    storage.client = BrokenS3()
    with pytest.raises(StorageMissing):
        await storage.read("key", 100)
    with pytest.raises(AppException) as exc:
        await storage.put("key", PDF, "application/pdf")
    assert exc.value.status_code == 503 and "secret" not in exc.value.message
    deleted, pages = [], []

    class PaginatedS3:
        def list_objects_v2(self, **kwargs):
            pages.append(kwargs)
            if "ContinuationToken" not in kwargs:
                return {
                    "Contents": [{"Key": "keep", "LastModified": now() - timedelta(days=2)}],
                    "IsTruncated": True,
                    "NextContinuationToken": "page2",
                }
            return {"Contents": [{"Key": "delete", "LastModified": now() - timedelta(days=2)}]}

        def delete_object(self, **kwargs):
            deleted.append(kwargs["Key"])

    storage.client = PaginatedS3()
    await storage.cleanup_prefix("prefix/", {"keep"}, now())
    assert deleted == ["delete"] and len(pages) == 2


async def test_api_body_limits_and_signed_url_cache_policy(client, file_env):
    owner = await _signup_verified(client, "owner@example.com")
    response = await client.post(
        "/api/v1/users/me/files/upload-requests",
        headers=owner["headers"],
        json={"file_name": "a" * 9000},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"
    body = await reserve(client, owner)
    response = await client.get(f"/api/v1/files/{body['file']['id']}", headers=owner["headers"])
    assert response.headers["Cache-Control"] == "no-store"


async def test_openapi_documents_step4_inputs(client, file_env):
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    paths = schema["paths"]
    assert paths["/api/v1/users/me/files/upload-requests"]["post"]["responses"]["413"]
    assert schema["components"]["schemas"]["FileUploadCreate"]["additionalProperties"] is False
    assert schema["components"]["schemas"]["FileConfirmCreate"]["additionalProperties"] is False
    assert "storage_key" not in schema["components"]["schemas"]["FileRead"]["properties"]
