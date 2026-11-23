"""PostgreSQL-only row-lock guarantees; SQLite cannot prove these properties."""

import asyncio
import uuid

import pytest
from sqlalchemy import func, select

from app.models.data_room import DataRoomDocument, DataRoomDocumentVersion
from app.models.data_room_access import DataRoomAccessRequest, DocumentView
from app.tests.conftest import TEST_DATABASE_URL, TestSessionFactory
from app.tests.test_data_room_access import INVESTOR_REQUESTS, approve, content
from app.tests.test_files import uploaded

pytest_plugins = ["app.tests.test_data_room_access"]
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"), reason="requires PostgreSQL row locks"
)


async def test_parallel_version_append_is_sequential(client, workspace):
    w = workspace
    files = [
        await uploaded(
            client, w["owner"], w["storage"], org=w["org"], kind="pitch_deck", name=f"{n}.pdf"
        )
        for n in range(2)
    ]
    results = await asyncio.gather(
        *(
            client.post(
                w["base"] + f"/documents/{w['doc']['id']}/versions",
                headers=w["owner"]["headers"],
                json={"file_id": f},
            )
            for f in files
        )
    )
    assert all(r.status_code == 201 for r in results), [r.text for r in results]
    assert sorted(r.json()["version_number"] for r in results) == [2, 3]
    async with TestSessionFactory() as db:
        rows = (
            (
                await db.execute(
                    select(DataRoomDocumentVersion).order_by(DataRoomDocumentVersion.version_number)
                )
            )
            .scalars()
            .all()
        )
        assert [r.version_number for r in rows] == [1, 2, 3]
        doc = await db.get(DataRoomDocument, uuid.UUID(w["doc"]["id"]))
        assert doc.file_id == rows[-1].file_id and doc.version_number == 3


async def test_parallel_requests_and_decisions(client, workspace, applicant):
    w, a = workspace, applicant
    results = await asyncio.gather(
        *(
            client.post(
                INVESTOR_REQUESTS,
                headers=a["actor"]["headers"],
                json={"startup_org_id": w["org"]["id"]},
            )
            for _ in range(3)
        )
    )
    assert {r.json()["id"] for r in results} == {a["request"]["id"]}
    results = await asyncio.gather(
        *(
            client.post(
                w["base"] + f"/access-requests/{a['request']['id']}/decisions",
                headers=w["owner"]["headers"],
                json={"action": "approve", "scope": [w["folder"]["id"]]},
            )
            for _ in range(2)
        )
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    async with TestSessionFactory() as db:
        assert (await db.execute(select(func.count(DataRoomAccessRequest.id)))).scalar_one() == 1


async def test_revoke_serializes_with_inflight_audited_content(
    client, workspace, applicant, monkeypatch
):
    w, a = workspace, applicant
    await approve(client, w, a)
    entered, release = asyncio.Event(), asyncio.Event()
    original = w["storage"].read

    async def paused_read(key, max_size):
        entered.set()
        await asyncio.wait_for(release.wait(), timeout=10)
        return await original(key, max_size)

    monkeypatch.setattr(w["storage"], "read", paused_read)
    download = asyncio.create_task(client.get(content(w), headers=a["actor"]["headers"]))
    try:
        await asyncio.wait_for(entered.wait(), timeout=10)
        revoke = asyncio.create_task(
            client.post(
                w["base"] + f"/access-requests/{a['request']['id']}/decisions",
                headers=w["owner"]["headers"],
                json={"action": "revoke"},
            )
        )
        # PostgreSQL must not grant the room lock while content/audit is in flight.
        done, _ = await asyncio.wait([revoke], timeout=0.1)
        assert not done
        release.set()
        assert (await download).status_code == 200
        assert (await revoke).status_code == 200
        assert (await client.get(content(w), headers=a["actor"]["headers"])).status_code == 404
        async with TestSessionFactory() as db:
            assert (await db.execute(select(func.count(DocumentView.id)))).scalar_one() == 1
    finally:
        release.set()
        await download
