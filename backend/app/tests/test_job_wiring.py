"""Only the Step 7a B API/seed gaps, using the established job/auth fixtures."""

import importlib
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models.job import Job
from app.models.organization import Organization
from app.models.user import User
from app.tests.test_jobs import action, content, jobs_workspace, new_job

# Re-export the established fixture; do not make a parallel workspace factory.
__all__ = ["jobs_workspace"]
seed_dev = importlib.import_module("scripts.seed_dev")


async def test_fair_hiring_required_and_field_errors(client, jobs_workspace):
    w = jobs_workspace
    job = await new_job(client, w, fair_hiring_confirmed=False)
    result = await action(client, w, job, "publish", 422)
    assert result["error"]["details"][0]["loc"] == ["body", "fair_hiring_confirmed"]
    path = f"{w['base']}/{job['id']}"
    result = await client.patch(path, headers=w["headers"], json={"fair_hiring_confirmed": True})
    assert result.status_code == 200 and result.json()["fair_hiring_confirmed"] is True
    await action(client, w, job, "publish")
    result = await client.patch(path, headers=w["headers"], json={"fair_hiring_confirmed": False})
    assert result.status_code == 422
    result = await client.patch(path, headers=w["headers"], json={"salary_max": "1"})
    assert result.status_code == 422
    assert result.json()["error"]["details"][0]["loc"] == ["body", "salary_max"]


async def test_confirmation_defaults_false_and_is_strict(client, jobs_workspace):
    w = jobs_workspace
    payload = content()
    payload.pop("fair_hiring_confirmed")
    result = await client.post(w["base"], headers=w["headers"], json=payload)
    assert result.status_code == 201 and result.json()["fair_hiring_confirmed"] is False
    for value in (None, "true", 1):
        result = await client.post(
            w["base"], headers=w["headers"], json=content(fair_hiring_confirmed=value)
        )
        assert result.status_code == 422


async def test_publish_missing_fields_have_locations(client, jobs_workspace):
    w = jobs_workspace
    job = await new_job(
        client, w, description=None, requirements=None, work_mode="onsite", location=None
    )
    response = await action(client, w, job, "publish", 422)
    assert {item["loc"][-1] for item in response["error"]["details"]} == {
        "description",
        "requirements",
        "location",
    }


@pytest.mark.parametrize("environment", ["dev", "test", "prod"])
async def test_job_seed_only_literal_development(monkeypatch, db_session, environment):
    monkeypatch.setattr(seed_dev, "get_settings", lambda: SimpleNamespace(ENVIRONMENT=environment))
    with pytest.raises(RuntimeError, match="ENVIRONMENT=development"):
        await seed_dev.seed_step7a_jobs(db_session, None, None)


async def test_job_seed_idempotent_and_preserves_archives(
    client, jobs_workspace, db_session, monkeypatch
):
    w = jobs_workspace
    monkeypatch.setattr(
        seed_dev, "get_settings", lambda: SimpleNamespace(ENVIRONMENT="development")
    )
    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    owner = await db_session.get(User, uuid.UUID(w["user_id"]))
    assert await seed_dev.seed_step7a_jobs(db_session, org, owner) == 4
    rows = list((await db_session.execute(select(Job).where(Job.org_id == org.id))).scalars())
    assert len(rows) == 4 and all(row.fair_hiring_confirmed for row in rows)
    assert {row.status for row in rows} == {"open", "draft"}
    draft = next(row for row in rows if row.status == "draft")
    await action(client, w, {"id": str(draft.id)}, "archive")
    # Deliberately edit a seed row; running the seed twice must never clobber it.
    edited = next(row for row in rows if row.status == "open")
    edited.title = "Developer-edited title"
    await db_session.commit()
    assert await seed_dev.seed_step7a_jobs(db_session, org, owner) == 0
    await db_session.refresh(draft)
    await db_session.refresh(edited)
    assert draft.deleted_at is not None and edited.title == "Developer-edited title"
    assert len(list((await db_session.execute(select(Job))).scalars())) == 4
