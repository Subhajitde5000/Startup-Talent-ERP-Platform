"""Read-only review context and exact-development, fill-only 7d samples."""

import importlib
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from app.core.config import get_settings
from app.models.application_note import ApplicationNote
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.organization import Organization
from app.models.user import User
from app.tests.test_applicant_pipeline import base, path, pipeline
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import action, jobs_workspace

__all__ = ["pipeline", "marketplace", "jobs_workspace"]
seed_dev = importlib.import_module("scripts.seed_dev")


async def test_context_is_read_only_and_survives_archive(client, pipeline):
    w = pipeline
    detail = (await client.get(path(w), headers=w["headers"])).json()
    context = detail["context"]
    assert context["id"] == w["job"]["id"] and context["title"] == w["job"]["title"]
    assert context["owner_id"] == w["user_id"] and context["review_settings_locked"]
    assert not context["archived"] and context["status"] == "open"
    for payload in ({"context": {"archived": False}}, {"review_settings_locked": False}):
        assert (await client.patch(path(w), headers=w["headers"], json=payload)).status_code == 422
    await action(client, w, w["job"], "close")
    await action(client, w, w["job"], "archive")
    assert (await client.get(base(w), headers=w["headers"])).status_code == 404
    for url in (path(w), base(w) + "/applications"):
        response = await client.get(url, headers=w["headers"])
        assert response.status_code == 200
        assert response.json()["context"]["archived"]
        assert response.json()["context"]["status"] == "closed"


async def test_setting_lock_not_inferred_from_filtered_or_deleted_totals(
    client, pipeline, db_session
):
    w = pipeline
    response = await client.get(base(w) + "/applications?stage=hired", headers=w["headers"])
    assert response.json()["total"] == 0 and response.json()["context"]["review_settings_locked"]
    app = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
    app.deleted_at = datetime.now(UTC)
    await db_session.commit()
    page = (await client.get(base(w) + "/applications", headers=w["headers"])).json()
    assert page["total"] == 0 and page["context"]["review_settings_locked"]


@pytest.mark.parametrize("environment", ["dev", "test", "prod"])
async def test_7d_seed_requires_literal_development(monkeypatch, db_session, environment):
    monkeypatch.setattr(seed_dev, "get_settings", lambda: SimpleNamespace(ENVIRONMENT=environment))
    with pytest.raises(RuntimeError, match="ENVIRONMENT=development"):
        await seed_dev.seed_step7d_pipeline(db_session, None, None)


async def test_7d_seed_idempotent_and_does_not_overwrite_or_resurrect(
    client, jobs_workspace, db_session, monkeypatch
):
    w = jobs_workspace
    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    owner = await db_session.get(User, uuid.UUID(w["user_id"]))
    owner.primary_email = "employer@forma.dev"
    await db_session.commit()
    monkeypatch.setattr(get_settings(), "ENVIRONMENT", "development")
    await seed_dev.seed_step7a_jobs(db_session, org, owner)
    await seed_dev.seed_step7d_pipeline(db_session, org, owner)
    await seed_dev.seed_step7d_pipeline(db_session, org, owner)
    rows = list(
        (
            await db_session.execute(select(JobApplication).join(Job).where(Job.org_id == org.id))
        ).scalars()
    )
    assert len(rows) == 3
    assert sum(row.is_blind for row in rows) == 1
    assert {row.stage for row in rows} == {"applied", "shortlisted", "interview"}
    blind = next(row for row in rows if row.is_blind)
    original = blind.profile_snapshot
    blind.deleted_at = datetime.now(UTC)
    another = next(row for row in rows if row.stage == "applied")
    another.stage = "review"
    another.cover_note = "User edited this record"
    await db_session.commit()
    await seed_dev.seed_step7d_pipeline(db_session, org, owner)
    await db_session.refresh(blind)
    await db_session.refresh(another)
    assert blind.deleted_at and blind.profile_snapshot == original
    assert another.stage == "review" and another.cover_note == "User edited this record"
    assert (
        await db_session.execute(select(func.count()).select_from(JobApplication))
    ).scalar_one() == 3
    # No author is invented when the sample admin account is absent.
    assert (
        await db_session.execute(select(func.count()).select_from(ApplicationNote))
    ).scalar_one() == 0
