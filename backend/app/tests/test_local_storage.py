"""Tests for local disk storage adapter and endpoints (dev fallback when R2 is unset)."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.exceptions import AppException
from app.main import create_app
from app.services.storage_service import (
    LocalStorage,
    StorageInvalid,
    StorageMissing,
    get_storage,
)


@pytest.mark.asyncio
async def test_local_storage_put_read_delete(tmp_path, monkeypatch):
    storage = LocalStorage()
    # Direct base to temporary folder so test files are cleaned up
    storage._base = tmp_path

    key = "org-1/files/test.pdf"
    content = b"%PDF-1.4 test document"
    mime = "application/pdf"

    # Put
    await storage.put(key, content, mime)
    assert (tmp_path / key).exists()

    # Read
    data, stored_mime = await storage.read(key, max_size=1024)
    assert data == content
    assert stored_mime == mime

    # Read exceeds max size
    with pytest.raises(StorageInvalid):
        await storage.read(key, max_size=5)

    # Delete
    await storage.delete(key)
    assert not (tmp_path / key).exists()
    assert not (tmp_path / "org-1" / "files" / "test.pdf.metadata.json").exists()

    # Read missing
    with pytest.raises(StorageMissing):
        await storage.read(key, max_size=1024)


@pytest.mark.asyncio
async def test_local_storage_path_traversal_prevention(tmp_path):
    storage = LocalStorage()
    storage._base = tmp_path

    with pytest.raises(StorageInvalid):
        storage._local_path("../../../etc/passwd")

    with pytest.raises(StorageInvalid):
        storage._local_path("sub/../../outside")


@pytest.mark.asyncio
async def test_local_storage_tokens_and_expiration(tmp_path):
    storage = LocalStorage()
    storage._base = tmp_path

    # Valid upload token
    up_url = await storage.sign_upload("uploads/doc.pdf", "application/pdf", ttl=60)
    assert "/files/local-upload/" in up_url
    token = up_url.split("/files/local-upload/")[1]
    payload = storage.verify_upload_token(token)
    assert payload["k"] == "uploads/doc.pdf"
    assert payload["m"] == "application/pdf"

    # Valid download token
    dl_url = await storage.sign_download("uploads/doc.pdf", "doc.pdf", "application/pdf", ttl=60)
    assert "/files/local-serve/" in dl_url
    dl_token = dl_url.split("/files/local-serve/")[1]
    dl_payload = storage.verify_download_token(dl_token)
    assert dl_payload["k"] == "uploads/doc.pdf"
    assert dl_payload["n"] == "doc.pdf"

    # Action mismatch
    with pytest.raises(StorageInvalid, match="mismatch"):
        storage.verify_upload_token(dl_token)

    # Expired token
    expired_token = storage._make_token({"k": "a", "m": "b", "n": "", "a": "up"}, ttl=-10)
    with pytest.raises(StorageInvalid, match="expired"):
        storage.verify_upload_token(expired_token)

    # Tampered token
    b64, sig = token.rsplit(".", 1)
    tampered = f"{b64}x.{sig}"
    with pytest.raises(StorageInvalid):
        storage.verify_upload_token(tampered)


@pytest.mark.asyncio
async def test_local_storage_cleanup_prefix(tmp_path):
    storage = LocalStorage()
    storage._base = tmp_path

    old_time = datetime.now(UTC) - timedelta(hours=2)
    cutoff = datetime.now(UTC) - timedelta(hours=1)

    # Write two files
    f1 = tmp_path / "test-cleanup" / "old.txt"
    f2 = tmp_path / "test-cleanup" / "keep.txt"
    f1.parent.mkdir(parents=True, exist_ok=True)
    f1.write_bytes(b"old")
    f2.write_bytes(b"keep")

    # Set old timestamp on f1
    import os
    old_ts = old_time.timestamp()
    os.utime(f1, (old_ts, old_ts))

    await storage.cleanup_prefix("test-cleanup/", keep={"test-cleanup/keep.txt"}, before=cutoff)

    assert not f1.exists(), "Old file not in keep set should be removed"
    assert f2.exists(), "File in keep set should be retained"


@pytest.mark.asyncio
async def test_local_upload_and_serve_endpoints(tmp_path):
    storage = LocalStorage()
    storage._base = tmp_path

    app = create_app()
    app.dependency_overrides[get_storage] = lambda: storage

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Generate upload token
        up_url = await storage.sign_upload("documents/deck.pdf", "application/pdf", ttl=300)
        token = up_url.split("/files/local-upload/")[1]

        # PUT file bytes to local-upload
        content = b"%PDF-1.4 pitch deck content"
        res = await client.put(
            f"/api/v1/files/local-upload/{token}",
            content=content,
            headers={"Content-Type": "application/pdf"},
        )
        assert res.status_code == 204

        # Verify file is on disk
        assert (tmp_path / "documents" / "deck.pdf").read_bytes() == content

        # Generate download token
        dl_url = await storage.sign_download(
            "documents/deck.pdf", "deck.pdf", "application/pdf", ttl=300
        )
        dl_token = dl_url.split("/files/local-serve/")[1]

        # GET file bytes from local-serve
        res_dl = await client.get(f"/api/v1/files/local-serve/{dl_token}")
        assert res_dl.status_code == 200
        assert res_dl.content == content
        assert res_dl.headers["content-type"] == "application/pdf"
        assert 'filename*=UTF-8\'\'deck.pdf' in res_dl.headers["content-disposition"]


@pytest.mark.asyncio
async def test_production_fails_closed_without_r2(monkeypatch):
    """In production (ENVIRONMENT='prod'), get_storage() must fail with 503 if R2 is unconfigured."""
    settings = get_settings()
    monkeypatch.setattr(settings, "ENVIRONMENT", "prod")
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "")
    get_storage.cache_clear()

    with pytest.raises(AppException) as exc_info:
        get_storage()

    assert exc_info.value.status_code == 503
    assert exc_info.value.code == "STORAGE_UNAVAILABLE"
    get_storage.cache_clear()
