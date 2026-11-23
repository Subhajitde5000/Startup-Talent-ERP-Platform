"""Development records must never be phantom ready rows or run in production."""

import importlib
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models.file import File
from app.models.organization import Organization
from app.models.user import User
from app.services import file_processing_service
from app.tests.conftest import TestSessionFactory
from app.tests.test_files import StubScanner
from app.tests.test_task_labels import _create_org, _signup_verified, _user_id

# The seed is an executable script, not part of the application package.
seed_dev = importlib.import_module("scripts.seed_dev")

pytest_plugins = ["app.tests.test_files"]


@pytest.mark.parametrize("environment", ["dev", "test", "prod"])
async def test_seed_refuses_nonliteral_development(monkeypatch, environment):
    monkeypatch.setattr(seed_dev, "get_settings", lambda: SimpleNamespace(ENVIRONMENT=environment))
    with pytest.raises(SystemExit, match="Refusing to seed"):
        await seed_dev.seed()


async def test_file_seed_real_processing_and_idempotence(client, file_env, monkeypatch):
    storage, _ = file_env
    auth = await _signup_verified(client, "seed@example.com")
    org = await _create_org(client, auth)
    monkeypatch.setattr(
        seed_dev,
        "get_settings",
        lambda: SimpleNamespace(
            ENVIRONMENT="development",
            R2_ACCOUNT_ID="configured",
            R2_ACCESS_KEY_ID="configured",
            R2_SECRET_ACCESS_KEY="configured",
            R2_BUCKET="configured",
            FILE_SCANNER="dev_clean",
        ),
    )
    monkeypatch.setattr(seed_dev, "async_session_factory", TestSessionFactory)
    monkeypatch.setattr(file_processing_service, "get_scanner", lambda: StubScanner())
    async with TestSessionFactory() as db:
        organization = await db.get(Organization, uuid.UUID(org["id"]))
        owner = await db.get(User, uuid.UUID(await _user_id(client, auth)))
        assert organization is not None and owner is not None
        await seed_dev.seed_step4_files(db, organization, owner)
        await seed_dev.seed_step4_files(db, organization, owner)
        rows = list((await db.execute(select(File))).scalars())
        assert len(rows) == 3
        assert {row.file_name for row in rows} == {
            "Pitch deck v3.pdf",
            "Financial model.xlsx",
            "Product brief.pdf",
        }
        for row in rows:
            assert row.upload_status == "ready" and row.scan_status == "clean"
            assert row.checksum_sha256 and row.scanned_at
            data, mime = storage.objects[row.storage_key]
            assert row.byte_size == len(data) and row.mime_type == mime
