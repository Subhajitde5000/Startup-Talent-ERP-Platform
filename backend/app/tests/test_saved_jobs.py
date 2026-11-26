"""Saved-job ownership, validation, privacy and lifecycle."""

import uuid

from app.tests.test_funding_rounds import _signup_verified
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import jobs_workspace, new_job

__all__ = ["marketplace", "jobs_workspace"]


async def test_saved_job_crud_and_security(client, marketplace):
    w = marketplace
    h = w["candidate"]["headers"]
    other = await _signup_verified(client, "another-seeker@saved.dev", "jobseeker")
    jid = w["job"]["id"]
    path = "/api/v1/saved-jobs"
    assert (await client.get(path)).status_code == 401
    assert (await client.get(path, headers=w["headers"])).status_code == 403
    assert (
        await client.post(path, headers=h, json={"job_id": str(uuid.uuid4())})
    ).status_code == 404
    for field in ("user_id", "created_at"):
        assert (
            await client.post(path, headers=h, json={"job_id": jid, field: "x"})
        ).status_code == 422
    assert (
        await client.post(path, headers=h, json={"job_id": jid, "note": "a" * 2001})
    ).status_code == 422
    r = await client.post(path, headers=h, json={"job_id": jid, "note": "first"})
    assert r.status_code == 201, r.text
    assert r.json()["job"]["title"] == w["job"]["title"]
    assert (await client.post(path, headers=h, json={"job_id": jid})).status_code == 409
    assert (await client.get(f"{path}/{jid}", headers=other["headers"])).status_code == 404
    assert (
        await client.patch(f"{path}/{jid}", headers=other["headers"], json={"note": "x"})
    ).status_code == 404
    assert (
        await client.patch(f"{path}/{jid}", headers=h, json={"user_id": str(uuid.uuid4())})
    ).status_code == 422
    assert (await client.patch(f"{path}/{jid}", headers=h, json={"note": "changed"})).json()[
        "note"
    ] == "changed"
    listed = (await client.get(path, headers=h)).json()
    assert listed["total"] == 1 and listed["items"][0]["note"] == "changed"
    assert (await client.delete(f"{path}/{jid}", headers=h)).status_code == 204
    assert (await client.get(f"{path}/{jid}", headers=h)).status_code == 404


async def test_private_and_hidden_salary_redacted(client, marketplace):
    w = marketplace
    h = w["candidate"]["headers"]
    draft = await new_job(client, w, title="Secret Draft")
    path = "/api/v1/saved-jobs"
    result = await client.post(path, headers=h, json={"job_id": draft["id"]})
    assert result.status_code == 201, result.text
    assert result.json()["job"] is None and result.json()["status"] == "draft"
    jid = w["job"]["id"]
    assert (
        await client.patch(
            f"{w['base']}/{jid}", headers=w["headers"], json={"show_salary_publicly": False}
        )
    ).status_code == 200
    result = await client.post(path, headers=h, json={"job_id": jid})
    assert result.json()["job"]["salary_min"] is None
    assert all(
        x["job"] is None or x["job"]["salary_min"] is None
        for x in (await client.get(path, headers=h)).json()["items"]
    )


async def test_saved_rate_limit_and_soft_delete(
    client, marketplace, db_session, settings, monkeypatch
):
    from datetime import UTC, datetime

    from sqlalchemy import select

    from app.models.job import Job

    w = marketplace
    path = "/api/v1/saved-jobs"
    h = w["candidate"]["headers"]
    jid = w["job"]["id"]
    monkeypatch.setattr(settings, "SAVED_JOBS_WRITE_LIMIT", 1)
    assert (await client.post(path, headers=h, json={"job_id": jid})).status_code == 201
    assert (await client.delete(f"{path}/{jid}", headers=h)).status_code == 429
    row = (await db_session.execute(select(Job).where(Job.id == uuid.UUID(jid)))).scalar_one()
    row.deleted_at = datetime.now(UTC)
    await db_session.commit()
    result = (await client.get(path, headers=h)).json()
    assert result["total"] == 0 and result["items"] == []
    assert (await client.get(f"{path}/{jid}", headers=h)).status_code == 404


async def test_all_saved_endpoints_require_auth_and_seeker_role(client, marketplace):
    w = marketplace
    path = "/api/v1/saved-jobs"
    jid = w["job"]["id"]
    for method, url, payload in (
        ("POST", path, {"job_id": jid}),
        ("GET", path, None),
        ("GET", f"{path}/{jid}", None),
        ("PATCH", f"{path}/{jid}", {"note": "x"}),
        ("DELETE", f"{path}/{jid}", None),
    ):
        assert (await client.request(method, url, json=payload)).status_code == 401
        assert (
            await client.request(method, url, headers=w["headers"], json=payload)
        ).status_code == 403
    assert (
        await client.patch(f"{path}/{jid}", headers=w["candidate"]["headers"], json={})
    ).status_code == 422


async def test_saved_job_deadline_respects_privacy(client, marketplace, db_session):
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import select

    from app.models.job import Job

    w = marketplace
    jid = w["job"]["id"]
    job = (await db_session.execute(select(Job).where(Job.id == uuid.UUID(jid)))).scalar_one()
    job.application_deadline = datetime.now(UTC) + timedelta(days=2)
    await db_session.commit()
    result = await client.post(
        "/api/v1/saved-jobs", headers=w["candidate"]["headers"], json={"job_id": jid}
    )
    assert result.status_code == 201, result.text
    assert result.json()["job"]["application_deadline"] is not None
