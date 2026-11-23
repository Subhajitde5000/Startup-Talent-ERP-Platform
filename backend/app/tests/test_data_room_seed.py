"""9g/h dev seed is gated, idempotent, and never invents file or legal evidence."""

import importlib
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from app.models.data_room import DataRoom, DataRoomDocument, DataRoomDocumentVersion
from app.models.data_room_access import DataRoomAccessRequest, DocumentView
from app.models.organization import Organization
from app.models.user import User
from app.services import file_processing_service
from app.tests.conftest import TestSessionFactory
from app.tests.test_files import StubScanner
from app.tests.test_task_labels import _create_org, _signup_verified, _user_id

seed_dev = importlib.import_module("scripts.seed_dev")
pytest_plugins = ["app.tests.test_files"]


@pytest.mark.parametrize("environment", ["test", "prod", "dev"])
async def test_data_room_seed_development_only(monkeypatch, environment):
    monkeypatch.setattr(seed_dev, "get_settings", lambda: SimpleNamespace(ENVIRONMENT=environment))
    async with TestSessionFactory() as db:
        with pytest.raises(RuntimeError, match="ENVIRONMENT=development"):
            await seed_dev.seed_step9_data_rooms(db, {}, None, {})


async def test_data_room_seed_real_files_idempotent(client, file_env, monkeypatch):
    storage, _ = file_env
    auth = await _signup_verified(client, "founder-seed@test.dev")
    org = await _create_org(client, auth, name="Acme Studio")
    investor = await _signup_verified(client, "investor@forma.dev", role="investor")
    firm = await _create_org(client, investor, name="Seed Firm", type_="investor_firm")
    monkeypatch.setattr(
        seed_dev,
        "get_settings",
        lambda: SimpleNamespace(
            ENVIRONMENT="development",
            R2_ACCOUNT_ID="test",
            R2_ACCESS_KEY_ID="test",
            R2_SECRET_ACCESS_KEY="test",
            R2_BUCKET="test",
            FILE_SCANNER="dev_clean",
        ),
    )
    monkeypatch.setattr(seed_dev, "async_session_factory", TestSessionFactory)
    monkeypatch.setattr(file_processing_service, "get_scanner", lambda: StubScanner())
    async with TestSessionFactory() as db:
        organization = await db.get(Organization, uuid.UUID(org["id"]))
        owner = await db.get(User, uuid.UUID(await _user_id(client, auth)))
        investor_firm = await db.get(Organization, uuid.UUID(firm["id"]))
        assert organization and owner and investor_firm
        for _ in range(2):
            await seed_dev.seed_step9_data_rooms(
                db, {"Acme Studio": organization}, owner, {"investor@forma.dev": investor_firm}
            )
        assert (await db.execute(select(func.count(DataRoom.id)))).scalar_one() == 2
        assert (await db.execute(select(func.count(DataRoomDocument.id)))).scalar_one() == 6
        assert (await db.execute(select(func.count(DataRoomDocumentVersion.id)))).scalar_one() == 6
        assert (await db.execute(select(func.count(DocumentView.id)))).scalar_one() == 0
        requests = (await db.execute(select(DataRoomAccessRequest))).scalars().all()
        assert len(requests) == 2 and {r.status for r in requests} == {"approved", "pending"}
        assert all(r.nda_signed_at is None for r in requests)
        assert storage.objects
