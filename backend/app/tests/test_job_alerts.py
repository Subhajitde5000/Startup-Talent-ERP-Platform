"""Saved-search lifecycle and owner isolation."""

import uuid

from app.tests.test_funding_rounds import _signup_verified
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import jobs_workspace

__all__ = ["marketplace", "jobs_workspace"]


async def test_alert_crud_validation_and_idor(client, marketplace):
    w = marketplace
    h = w["candidate"]["headers"]
    other = await _signup_verified(client, "other@alerts.dev", "jobseeker")
    path = "/api/v1/job-alerts"
    assert (await client.get(path)).status_code == 401
    assert (await client.post(path, headers=w["headers"], json={"title": "x"})).status_code == 403
    for payload in (
        {"title": " "},
        {"title": "x", "last_sent_at": "2020-01-01"},
        {"title": "x", "user_id": str(uuid.uuid4())},
        {"title": "x", "criteria": {"work_mode": "invalid"}},
        {"title": "x", "criteria": {"salary_min": "-1"}},
        {"title": "x", "criteria": {"extra": 1}},
    ):
        r = await client.post(path, headers=h, json=payload)
        assert r.status_code == 422, r.text
    r = await client.post(
        path,
        headers=h,
        json={"title": "Backend", "criteria": {"work_mode": "remote", "salary_min": "1000.00"}},
    )
    assert r.status_code == 201, r.text
    aid = r.json()["id"]
    assert r.json()["last_sent_at"] is None
    assert (await client.get(f"{path}/{aid}", headers=other["headers"])).status_code == 404
    assert (
        await client.patch(f"{path}/{aid}", headers=other["headers"], json={"title": "x"})
    ).status_code == 404
    assert (
        await client.patch(f"{path}/{aid}", headers=h, json={"last_sent_at": "2020-01-01"})
    ).status_code == 422
    assert (await client.patch(f"{path}/{aid}", headers=h, json={"title": None})).status_code == 422
    r = await client.patch(
        f"{path}/{aid}",
        headers=h,
        json={"criteria": {"location": "Kolkata"}, "frequency": "weekly"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["criteria"]["location"] == "Kolkata"
    assert (await client.get(path, headers=h)).json()["total"] == 1
    assert (await client.delete(f"{path}/{aid}", headers=other["headers"])).status_code == 404
    assert (await client.delete(f"{path}/{aid}", headers=h)).status_code == 204
    assert (await client.get(f"{path}/{aid}", headers=h)).status_code == 404


async def test_alert_rate_limit_and_pagination(client, marketplace, settings, monkeypatch):
    h = marketplace["candidate"]["headers"]
    path = "/api/v1/job-alerts"
    for n in range(3):
        assert (await client.post(path, headers=h, json={"title": f"Alert {n}"})).status_code == 201
    page = (await client.get(path + "?limit=1&offset=1", headers=h)).json()
    assert page["total"] == 3 and len(page["items"]) == 1 and page["has_more"]
    monkeypatch.setattr(settings, "JOB_ALERTS_READ_LIMIT", 2)
    assert (await client.get(path, headers=h)).status_code == 200
    assert (await client.get(path, headers=h)).status_code == 429


async def test_all_alert_endpoints_require_auth_and_seeker_role(client, marketplace):
    w = marketplace
    path = "/api/v1/job-alerts"
    aid = str(uuid.uuid4())
    for method, url, payload in (
        ("POST", path, {"title": "x"}),
        ("GET", path, None),
        ("GET", f"{path}/{aid}", None),
        ("PATCH", f"{path}/{aid}", {"title": "x"}),
        ("DELETE", f"{path}/{aid}", None),
    ):
        assert (await client.request(method, url, json=payload)).status_code == 401
        assert (
            await client.request(method, url, headers=w["headers"], json=payload)
        ).status_code == 403


async def test_development_seed_is_guarded_and_fill_only(
    client, marketplace, db_session, settings, monkeypatch
):
    from sqlalchemy import select

    from app.models.job_alert import JobAlert
    from app.models.user import User
    from scripts.seed_dev import seed_step7lm

    candidate = (
        await db_session.execute(
            select(User).where(User.primary_email == marketplace["candidate"]["email"])
        )
    ).scalar_one()
    import pytest

    with pytest.raises(RuntimeError):
        await seed_step7lm(db_session, candidate)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    await seed_step7lm(db_session, candidate)
    alerts = (
        (await db_session.execute(select(JobAlert).where(JobAlert.user_id == candidate.id)))
        .scalars()
        .all()
    )
    assert len(alerts) == 2
    alerts[0].title = "Changed by user"
    await db_session.commit()
    await seed_step7lm(db_session, candidate)
    rows = (
        (await db_session.execute(select(JobAlert).where(JobAlert.user_id == candidate.id)))
        .scalars()
        .all()
    )
    assert len(rows) == 2 and any(row.title == "Changed by user" for row in rows)
