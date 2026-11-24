"""Approved 7b/7c frontend contract gaps, using existing auth/workspace fixtures."""

import importlib
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models.job_application import JobApplication
from app.models.organization import Organization
from app.tests.test_job_applications import apply
from app.tests.test_job_discovery import hdr, marketplace
from app.tests.test_jobs import action, jobs_workspace, new_job

__all__ = ["marketplace", "jobs_workspace"]


async def test_multi_filters_and_verified_filter(client, marketplace, db_session):
    w = marketplace
    response = await client.get(
        "/api/v1/public/jobs",
        params=[
            ("work_modes", "remote"),
            ("work_modes", "hybrid"),
            ("employment_types", "full_time"),
        ],
    )
    assert response.status_code == 200 and response.json()["total"] == 1
    response = await client.get("/api/v1/public/jobs", params={"work_modes": "onsite"})
    assert response.json()["total"] == 0
    assert (await client.get("/api/v1/public/jobs", params={"verified_only": True})).json()[
        "total"
    ] == 0
    from datetime import UTC, datetime

    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    org.verified_at = datetime.now(UTC)
    await db_session.commit()
    assert (await client.get("/api/v1/public/jobs", params={"verified_only": True})).json()[
        "total"
    ] == 1
    assert (
        await client.get("/api/v1/public/jobs", params={"work_modes": "bogus"})
    ).status_code == 422
    assert (
        await client.get("/api/v1/public/jobs", params=[("stages", "idea")] * 6)
    ).status_code == 422


async def test_context_profile_is_typed_self_only(client, marketplace):
    w = marketplace
    response = await client.get(
        f"/api/v1/jobs/{w['job']['id']}/application-context", headers=hdr(w)
    )
    assert response.status_code == 200
    profile = response.json()["profile"]
    assert profile["contact"]["email"] == w["candidate"]["email"]
    assert isinstance(profile["skills"], list)
    assert "password_hash" not in profile and "submission_fingerprint" not in profile
    assert (
        await client.get(f"/api/v1/jobs/{w['job']['id']}/application-context", headers=w["headers"])
    ).status_code == 403


async def test_own_application_badge_never_leaks(client, marketplace):
    w = marketplace
    submitted = await apply(client, w)
    path = f"/api/v1/jobs/{w['job']['id']}"
    mine = (await client.get(path, headers=hdr(w))).json()
    assert (
        mine["own_application_id"] == submitted["id"] and mine["own_application_stage"] == "applied"
    )
    assert mine["can_apply"] is False
    for prefix, headers in [("/public", {}), ("", w["headers"])]:
        other = (await client.get(f"/api/v1{prefix}/jobs/{w['job']['id']}", headers=headers)).json()
        assert other["own_application_id"] is None and other["own_application_stage"] is None
    await client.post(f"/api/v1/applications/{submitted['id']}/withdraw", headers=hdr(w), json={})
    mine = (await client.get("/api/v1/jobs", headers=hdr(w))).json()["items"][0]
    assert mine["own_application_stage"] == "withdrawn" and not mine["can_apply"]


async def test_server_search_and_stage_counts_across_pages(client, marketplace, db_session):
    w = marketplace
    first = await apply(client, w)
    second = await new_job(client, w, title="Unique Search Role")
    await action(client, w, second, "publish")
    result = await client.post(
        f"/api/v1/jobs/{second['id']}/applications",
        headers=hdr(w),
        json={"accuracy_confirmed": True, "consent_share": True},
    )
    assert result.status_code == 201
    row = await db_session.get(JobApplication, uuid.UUID(first["id"]))
    row.stage = "review"
    await db_session.commit()
    page = (await client.get("/api/v1/applications", headers=hdr(w), params={"limit": 1})).json()
    assert (
        page["total"] == 2
        and page["has_more"]
        and page["stage_counts"] == {"review": 1, "applied": 1}
    )
    stage = (
        await client.get("/api/v1/applications", headers=hdr(w), params={"stage": "review"})
    ).json()
    assert stage["total"] == 1 and stage["stage_counts"] == page["stage_counts"]
    found = (
        await client.get("/api/v1/applications", headers=hdr(w), params={"q": "Unique Search"})
    ).json()
    assert found["total"] == 1 and found["items"][0]["job_id"] == second["id"]
    assert (await client.get("/api/v1/applications", headers=w["headers"])).status_code == 403
    assert (await client.get("/api/v1/applications", headers=hdr(w), params={"q": "%"})).json()[
        "total"
    ] == 0


@pytest.mark.parametrize("environment", ["test", "production", "staging", "Development"])
async def test_seed_literal_development_guard(monkeypatch, environment):
    seed = importlib.import_module("scripts.seed_dev")
    monkeypatch.setattr(seed, "get_settings", lambda: SimpleNamespace(ENVIRONMENT=environment))
    with pytest.raises(RuntimeError, match="ENVIRONMENT=development"):
        await seed.seed_step7bc_careers(None, None, None)


async def test_seed_idempotent_preserves_job_and_application_edits(
    client, marketplace, db_session, monkeypatch
):
    from app.models.job import Job
    from app.models.user import User

    seed = importlib.import_module("scripts.seed_dev")
    monkeypatch.setattr(seed, "get_settings", lambda: SimpleNamespace(ENVIRONMENT="development"))
    w = marketplace
    owner = await db_session.get(User, uuid.UUID(w["user_id"]))
    candidate = (
        await db_session.execute(select(User).where(User.primary_email == w["candidate"]["email"]))
    ).scalar_one()
    candidate.primary_email = "jobseeker@forma.dev"
    await db_session.commit()
    await seed.seed_step7bc_careers(db_session, owner, candidate)
    namespace = uuid.uuid5(uuid.NAMESPACE_URL, "forma:development:careers:7bc")
    job = await db_session.get(Job, uuid.uuid5(namespace, "job:senior-product-designer"))
    job.title = "Developer edited title"
    app = await db_session.get(
        JobApplication, uuid.uuid5(namespace, "application:senior-product-designer")
    )
    app.stage = "rejected"
    await db_session.commit()
    await seed.seed_step7bc_careers(db_session, owner, candidate)
    await db_session.refresh(job)
    await db_session.refresh(app)
    assert job.title == "Developer edited title" and app.stage == "rejected"
    response = await client.get("/api/v1/applications", headers=hdr(w))
    assert response.status_code == 200 and response.json()["total"] == 4
