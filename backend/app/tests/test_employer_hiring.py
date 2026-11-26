"""Organization permissions, activity pagination and hiring aggregates."""

from app.tests.test_applicant_pipeline import member, pipeline
from app.tests.test_funding_rounds import _create_org, _signup_verified
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import jobs_workspace

__all__ = ["marketplace", "jobs_workspace", "pipeline"]


async def test_hiring_permissions_and_aggregates(client, pipeline):
    w = pipeline
    path = f"/api/v1/organizations/{w['org']['id']}/hiring"
    viewer = await member(client, w, role="viewer")
    outsider = await _signup_verified(client, "outside@hiring.dev", "employer")
    for suffix in ("dashboard", "analytics", "activity"):
        assert (await client.get(f"{path}/{suffix}")).status_code == 401
        assert (
            await client.get(f"{path}/{suffix}", headers=outsider["headers"])
        ).status_code == 403
        assert (await client.get(f"{path}/{suffix}", headers=viewer["headers"])).status_code == 200
    dashboard = (await client.get(f"{path}/dashboard", headers=w["headers"])).json()
    assert dashboard["kpis"]["open_jobs"] == 1
    assert dashboard["kpis"]["total_applicants"] == 1
    analytics = (await client.get(f"{path}/analytics", headers=w["headers"])).json()
    assert analytics["total_applicants"] == 1
    assert analytics["funnel"][0] == {"stage": "applied", "count": 1}
    first = (await client.get(f"{path}/activity?limit=1", headers=w["headers"])).json()
    second = (await client.get(f"{path}/activity?limit=1&offset=1", headers=w["headers"])).json()
    assert first["total"] >= 2 and second["items"] != first["items"]
    assert (await client.get(f"{path}/activity?limit=0", headers=w["headers"])).status_code == 422


async def test_wrong_org_type_and_cross_org(client, jobs_workspace):
    w = jobs_workspace
    outsider = await _signup_verified(client, "outside2@hiring.dev", "investor")
    org = await _create_org(client, outsider, name="Investment Firm", type_="investor_firm")
    assert (
        await client.get(
            f"/api/v1/organizations/{org['id']}/hiring/dashboard", headers=outsider["headers"]
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v1/organizations/{w['org']['id']}/hiring/dashboard", headers=outsider["headers"]
        )
    ).status_code == 403


async def test_startup_member_and_scoped_activity(client, db_session):
    import uuid

    from app.models.activity import ActivityEvent
    from app.tests.test_funding_rounds import _make_org_with_members

    w = await _make_org_with_members(client, "hiring-startup")
    path = f"/api/v1/organizations/{w['org']['id']}/hiring"
    db_session.add(
        ActivityEvent(
            org_id=uuid.UUID(w["org"]["id"]),
            event_type="application_stage_changed",
            summary="Private candidate and notes",
            link_url="/secret",
        )
    )
    await db_session.commit()
    r = await client.get(f"{path}/activity", headers=w["viewer"]["headers"])
    assert r.status_code == 200, r.text
    event = next(x for x in r.json()["items"] if x["event_type"] == "application_stage_changed")
    assert (
        "Private" not in event["summary"]
        and event["link_url"] is None
        and event["actor_name"] is None
    )
    assert (
        await client.get(f"{path}/analytics", headers=w["member"]["headers"])
    ).status_code == 200
    assert (
        await client.get(f"{path}/analytics", headers=w["outsider"]["headers"])
    ).status_code == 403


async def test_velocity_first_stage_event_and_closed_job(client, pipeline, db_session):
    import uuid
    from datetime import timedelta

    from sqlalchemy import select

    from app.models.job import Job
    from app.models.job_application import ApplicationStageEvent, JobApplication

    w = pipeline
    app = (
        await db_session.execute(
            select(JobApplication).where(JobApplication.id == uuid.UUID(w["app"]["id"]))
        )
    ).scalar_one()
    job = (await db_session.execute(select(Job).where(Job.id == app.job_id))).scalar_one()
    job.status = "closed"
    for stage, days in (("interview", 2), ("interview", 5), ("hired", 4), ("hired", 6)):
        db_session.add(
            ApplicationStageEvent(
                application_id=app.id,
                to_stage=stage,
                created_at=app.created_at + timedelta(days=days),
            )
        )
    await db_session.commit()
    path = f"/api/v1/organizations/{w['org']['id']}/hiring/analytics"
    result = await client.get(path, headers=w["headers"])
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["avg_time_to_hire_days"] == 4
    assert data["avg_time_to_first_interview_days"] == 2
    assert data["by_job"][0]["status"] == "closed"
