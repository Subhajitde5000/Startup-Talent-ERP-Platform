"""Step 7a contract/security tests; existing auth, invite and DB fixtures reused."""

import asyncio
import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.main import create_app
from app.models.activity import ActivityEvent
from app.models.job import Job, JobBenefit, JobSkill
from app.models.organization import MemberStatus, Organization, OrganizationMember, OrgType
from app.models.profile import Skill
from app.models.user import AccountStatus, User
from app.tests.conftest import TEST_DATABASE_URL, TestSessionFactory
from app.tests.test_funding_rounds import _create_org, _invite_member, _signup_verified


@pytest_asyncio.fixture
async def jobs_workspace(client: AsyncClient, db_session):
    actor = await _signup_verified(client, "jobs-owner@example.com", "employer")
    org = await _create_org(client, actor, type_="employer")
    user_id = (await client.get("/api/v1/users/me", headers=actor["headers"])).json()["id"]
    skill = Skill(name="Python", category="Engineering")
    db_session.add(skill)
    await db_session.commit()
    return {
        "actor": actor,
        "org": org,
        "user_id": user_id,
        "skill_id": str(skill.id),
        "base": f"/api/v1/organizations/{org['id']}/jobs",
        "headers": actor["headers"],
    }


def content(**overrides):
    return {
        "title": "Backend Engineer",
        "description": "Build reliable services.",
        "requirements": "Experience building APIs.",
        "work_mode": "remote",
        "fair_hiring_confirmed": True,
        "salary_min": "1000000.00",
        "salary_max": "2000000.00",
        "equity_min_pct": "0.10",
        "equity_max_pct": "1.00",
        "experience_min_yrs": 2,
        "experience_max_yrs": 5,
        **overrides,
    }


async def new_job(client, w, **overrides):
    response = await client.post(w["base"], headers=w["headers"], json=content(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


async def action(client, w, job, name, expect=200):
    response = await client.post(f"{w['base']}/{job['id']}/{name}", headers=w["headers"])
    assert response.status_code == expect, response.text
    return response.json()


async def test_create_read_edit_children_and_lifecycle(client, jobs_workspace, db_session):
    w = jobs_workspace
    job = await new_job(
        client,
        w,
        title="  Backend Engineer  ",
        skills=[{"skill_id": w["skill_id"], "is_required": False}],
        benefits=["  Health insurance  ", "Remote work"],
        visibility="link_only",
        salary_period="monthly",
        show_salary_publicly=False,
        currency=" inr ",
    )
    path = f"{w['base']}/{job['id']}"
    assert job["title"] == "Backend Engineer"
    assert job["status"] == "draft" and job["posted_at"] is None
    assert job["owner_id"] == w["user_id"]
    assert job["skills"] == [{"skill_id": w["skill_id"], "is_required": False, "name": "Python"}]
    assert [b["label"] for b in job["benefits"]] == ["Health insurance", "Remote work"]
    assert [b["display_order"] for b in job["benefits"]] == [0, 1]
    assert job["currency"] == "INR" and job["visibility"] == "link_only"
    assert Decimal(job["salary_min"]) == Decimal("1000000.00")
    assert isinstance(job["salary_min"], str)
    assert (await client.get(path, headers=w["headers"])).json() == job
    patched = await client.patch(
        path,
        headers=w["headers"],
        json={
            "title": "Senior Engineer",
            "responsibilities": "Own the API",
            "what_we_offer": "Mentorship",
            "benefits": ["Flexible hours"],
        },
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["skills"] == job["skills"]
    assert [b["label"] for b in patched.json()["benefits"]] == ["Flexible hours"]
    opened = await action(client, w, job, "publish")
    assert opened["status"] == "open" and opened["posted_at"]
    assert (await action(client, w, job, "publish"))["posted_at"] == opened["posted_at"]
    await action(client, w, job, "archive", 409)
    await action(client, w, job, "pause")
    assert (await action(client, w, job, "publish"))["posted_at"] == opened["posted_at"]
    closed = await action(client, w, job, "close")
    assert closed["closed_at"] and closed["status"] == "closed"
    assert (await action(client, w, job, "close"))["closed_at"] == closed["closed_at"]
    await action(client, w, job, "publish", 409)
    await action(client, w, job, "archive")
    assert (await client.get(path, headers=w["headers"])).status_code == 404
    assert (
        await client.patch(path, headers=w["headers"], json={"title": "Hidden"})
    ).status_code == 404
    await action(client, w, job, "archive", 404)
    assert (await client.get(w["base"], headers=w["headers"])).json()["total"] == 0
    row = await db_session.get(Job, uuid.UUID(job["id"]))
    assert row.deleted_at is not None and str(row.created_by) == w["user_id"]
    assert (await db_session.execute(select(func.count()).select_from(JobSkill))).scalar_one() == 1
    assert (
        await db_session.execute(select(func.count()).select_from(JobBenefit))
    ).scalar_one() == 1
    events = list(
        (
            await db_session.execute(
                select(ActivityEvent)
                .where(ActivityEvent.entity_id == row.id)
                .order_by(ActivityEvent.id)
            )
        ).scalars()
    )
    assert [event.event_type for event in events] == [
        "job_created",
        "job_updated",
        "job_published",
        "job_paused",
        "job_published",
        "job_closed",
        "job_archived",
    ]
    assert all(
        event.org_id == row.org_id and str(event.user_id) == w["user_id"] for event in events
    )
    assert all("Build reliable" not in str(event.data) for event in events)


async def test_startup_supported_and_verification_deferred(client):
    actor = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, actor)
    w = {"base": f"/api/v1/organizations/{org['id']}/jobs", "headers": actor["headers"]}
    job = await new_job(client, w)
    assert (await action(client, w, job, "publish"))["status"] == "open"


@pytest.mark.parametrize("role", ["admin", "member", "viewer"])
async def test_organization_roles(client, jobs_workspace, role):
    w = jobs_workspace
    member = await _signup_verified(client, f"jobs-{role}@example.com", "jobseeker")
    await _invite_member(client, w["actor"], member, w["org"], role)
    job = await new_job(client, w)
    path = f"{w['base']}/{job['id']}"
    for suffix in ("", "/summary", f"/{job['id']}"):
        assert (await client.get(w["base"] + suffix, headers=member["headers"])).status_code == 200
    expected = 201 if role == "admin" else 403
    assert (
        await client.post(w["base"], headers=member["headers"], json=content())
    ).status_code == expected
    assert (
        await client.patch(path, headers=member["headers"], json={"title": "Changed"})
    ).status_code == (200 if role == "admin" else 403)
    for name in ("publish", "pause", "close", "archive"):
        response = await client.post(path + "/" + name, headers=member["headers"])
        assert response.status_code == (200 if role == "admin" else 403), response.text


async def test_every_endpoint_401_outsider_and_deactivated(client, jobs_workspace, db_session):
    w = jobs_workspace
    job = await new_job(client, w)
    outsider = await _signup_verified(client, "outsider@example.com", "investor")
    requests = [
        ("GET", "", None),
        ("GET", "/summary", None),
        ("GET", f"/{job['id']}", None),
        ("POST", "", content()),
        ("PATCH", f"/{job['id']}", {"title": "No"}),
    ] + [("POST", f"/{job['id']}/{name}", {}) for name in ("publish", "pause", "close", "archive")]
    for method, suffix, payload in requests:
        for headers, status in (({}, 401), (outsider["headers"], 403)):
            response = await client.request(
                method, w["base"] + suffix, headers=headers, json=payload
            )
            assert response.status_code == status, response.text
            assert "error" in response.json()
    membership = (
        await db_session.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == uuid.UUID(w["org"]["id"]),
                OrganizationMember.user_id == uuid.UUID(w["user_id"]),
            )
        )
    ).scalar_one()
    membership.status = MemberStatus.deactivated
    await db_session.commit()
    for method, suffix, payload in requests:
        assert (
            await client.request(method, w["base"] + suffix, headers=w["headers"], json=payload)
        ).status_code == 403


async def test_wrong_org_job_ids_and_cross_org_owner(client, jobs_workspace):
    w = jobs_workspace
    actor = await _signup_verified(client, "foreign-owner@example.com", "startup")
    org = await _create_org(client, actor, name="Foreign")
    foreign = await new_job(
        client, {"base": f"/api/v1/organizations/{org['id']}/jobs", "headers": actor["headers"]}
    )
    path = f"{w['base']}/{foreign['id']}"
    for method, suffix, payload in [("GET", "", None), ("PATCH", "", {"title": "Stolen"})] + [
        ("POST", "/" + name, {}) for name in ("publish", "pause", "close", "archive")
    ]:
        response = await client.request(method, path + suffix, headers=w["headers"], json=payload)
        assert response.status_code == 404, response.text
    foreign_user = (await client.get("/api/v1/users/me", headers=actor["headers"])).json()["id"]
    assert (
        await client.post(w["base"], headers=w["headers"], json=content(owner_id=foreign_user))
    ).status_code == 422
    own = await new_job(client, w)
    assert (
        await client.patch(
            f"{w['base']}/{own['id']}", headers=w["headers"], json={"owner_id": foreign_user}
        )
    ).status_code == 422
    assert (await client.get(f"{w['base']}/{own['id']}", headers=w["headers"])).json()[
        "owner_id"
    ] == w["user_id"]


async def test_owner_reference_validation(client, jobs_workspace, db_session):
    w = jobs_workspace
    for role in ("member", "viewer"):
        actor = await _signup_verified(client, role + "@example.com", "jobseeker")
        await _invite_member(client, w["actor"], actor, w["org"], role)
        user_id = (await client.get("/api/v1/users/me", headers=actor["headers"])).json()["id"]
        response = await client.post(
            w["base"], headers=w["headers"], json=content(owner_id=user_id)
        )
        assert response.status_code == (201 if role == "member" else 422), response.text
        if role == "member":
            assert response.json()["owner_id"] == user_id
            membership = (
                await db_session.execute(
                    select(OrganizationMember).where(
                        OrganizationMember.user_id == uuid.UUID(user_id)
                    )
                )
            ).scalar_one()
            membership.status = MemberStatus.deactivated
            await db_session.commit()
            assert (
                await client.post(w["base"], headers=w["headers"], json=content(owner_id=user_id))
            ).status_code == 422
    assert (
        await client.post(w["base"], headers=w["headers"], json=content(owner_id=str(uuid.uuid4())))
    ).status_code == 422


@pytest.mark.parametrize(
    "changes",
    [
        {"title": " "},
        {"title": "x" * 201},
        {"description": "x" * 10001},
        {"location": "x" * 201},
        {"salary_min": "-1"},
        {"salary_max": "1.001"},
        {"salary_min": "9999999999999"},
        {"salary_min": 1.1},
        {"salary_min": "NaN"},
        {"salary_min": "3000000"},
        {"equity_min_pct": "-1"},
        {"equity_max_pct": "100.01"},
        {"equity_min_pct": "2"},
        {"experience_min_yrs": -1},
        {"experience_max_yrs": 1},
        {"experience_min_yrs": 2.5},
        {"openings": 0},
        {"openings": True},
        {"openings": 32768},
        {"currency": "IN"},
        {"currency": "123"},
        {"visibility": "secret"},
        {"salary_period": "hourly"},
        {"work_mode": "anything"},
        {"employment_type": "anything"},
        {"benefits": [" "]},
        {"benefits": ["x" * 101]},
        {"benefits": ["x"] * 31},
        {"skills": [{"skill_id": str(uuid.uuid4())}] * 31},
        {"show_salary_publicly": "false"},
        {"skills": None},
        {"benefits": None},
        {"title": None},
    ],
)
async def test_input_limits(client, jobs_workspace, changes):
    w = jobs_workspace
    response = await client.post(w["base"], headers=w["headers"], json=content(**changes))
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    "field,value",
    [
        ("id", str(uuid.uuid4())),
        ("org_id", str(uuid.uuid4())),
        ("created_by", str(uuid.uuid4())),
        ("status", "open"),
        ("posted_at", "2026-01-01T00:00:00Z"),
        ("closed_at", "2026-01-01T00:00:00Z"),
        ("featured_until", "2026-01-01T00:00:00Z"),
        ("created_at", "2026-01-01T00:00:00Z"),
        ("updated_at", "2026-01-01T00:00:00Z"),
        ("deleted_at", "2026-01-01T00:00:00Z"),
        ("request_id", str(uuid.uuid4())),
        ("total", 100),
    ],
)
async def test_mass_assignment_create_update_actions(client, jobs_workspace, field, value):
    w = jobs_workspace
    job = await new_job(client, w)
    path = f"{w['base']}/{job['id']}"
    for method, url, payload in [
        ("POST", w["base"], content(**{field: value})),
        ("PATCH", path, {field: value}),
    ] + [
        ("POST", path + "/" + name, {field: value})
        for name in ("publish", "pause", "close", "archive")
    ]:
        response = await client.request(method, url, headers=w["headers"], json=payload)
        assert response.status_code == 422, response.text
    assert (await client.get(path, headers=w["headers"])).json()["status"] == "draft"


async def test_nested_mass_assignment_unknown_and_duplicate_skills(client, jobs_workspace):
    w = jobs_workspace
    for skills in (
        [{"skill_id": str(uuid.uuid4())}],
        [{"skill_id": w["skill_id"]}] * 2,
        [{"skill_id": w["skill_id"], "job_id": str(uuid.uuid4())}],
        [{"skill_id": w["skill_id"], "created_at": "2026-01-01T00:00:00Z"}],
    ):
        assert (
            await client.post(w["base"], headers=w["headers"], json=content(skills=skills))
        ).status_code == 422
    job = await new_job(client, w, benefits=["Original"])
    response = await client.patch(
        f"{w['base']}/{job['id']}",
        headers=w["headers"],
        json={"skills": [{"skill_id": str(uuid.uuid4())}], "benefits": ["Not saved"]},
    )
    assert response.status_code == 422
    response = await client.get(f"{w['base']}/{job['id']}", headers=w["headers"])
    assert [b["label"] for b in response.json()["benefits"]] == ["Original"]
    for field in ("id", "display_order", "job_id"):
        assert (
            await client.patch(
                f"{w['base']}/{job['id']}",
                headers=w["headers"],
                json={"benefits": [{"label": "No", field: 1}]},
            )
        ).status_code == 422


async def test_patch_merges_ranges_and_null_rules(client, jobs_workspace):
    w = jobs_workspace
    job = await new_job(client, w, skills=[{"skill_id": w["skill_id"]}], benefits=["Health"])
    path = f"{w['base']}/{job['id']}"
    for payload in (
        {"salary_max": "1"},
        {"equity_min_pct": "2"},
        {"experience_max_yrs": 1},
        {"title": None},
        {"currency": None},
        {"work_mode": None},
        {"skills": None},
        {"benefits": None},
        {"openings": None},
    ):
        assert (await client.patch(path, headers=w["headers"], json=payload)).status_code == 422
    response = await client.patch(
        path,
        headers=w["headers"],
        json={
            "salary_min": None,
            "equity_max_pct": None,
            "owner_id": None,
            "skills": [],
            "benefits": [],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["salary_min"] is None and response.json()["owner_id"] is None
    assert response.json()["skills"] == [] and response.json()["benefits"] == []


async def test_publish_validation_and_state_failures(client, jobs_workspace):
    w = jobs_workspace
    incomplete = await new_job(client, w, description=None)
    await action(client, w, incomplete, "publish", 422)
    await action(client, w, incomplete, "pause", 409)
    await action(client, w, incomplete, "close", 409)
    await action(client, w, incomplete, "archive")
    onsite = await new_job(client, w, work_mode="onsite", location=None)
    await action(client, w, onsite, "publish", 422)
    path = f"{w['base']}/{onsite['id']}"
    assert (
        await client.patch(path, headers=w["headers"], json={"location": "Kolkata"})
    ).status_code == 200
    await action(client, w, onsite, "publish")
    assert (
        await client.patch(path, headers=w["headers"], json={"description": None})
    ).status_code == 422
    await action(client, w, onsite, "pause")
    await action(client, w, onsite, "pause")
    await action(client, w, onsite, "close")
    await action(client, w, onsite, "pause", 409)


async def test_filters_pagination_summary_and_team_open_jobs(client, jobs_workspace):
    w = jobs_workspace
    first = await new_job(client, w, title="Alpha", department="engineering", location="Kolkata")
    await new_job(
        client,
        w,
        title="Beta",
        work_mode="hybrid",
        department="product",
        location="Delhi",
        employment_type="contract",
    )
    archived = await new_job(client, w, title="Archived")
    await action(client, w, archived, "archive")
    await action(client, w, first, "publish")
    for query in (
        {"status": "open"},
        {"department": "engineering"},
        {"location": "kol"},
        {"q": "ALP"},
        {"work_mode": "remote"},
        {"employment_type": "full_time"},
    ):
        response = await client.get(w["base"], headers=w["headers"], params=query)
        assert response.status_code == 200, response.text
        assert [row["id"] for row in response.json()["items"]] == [first["id"]]
    page1 = (
        await client.get(w["base"], headers=w["headers"], params={"sort": "title", "limit": 1})
    ).json()
    page2 = (
        await client.get(
            w["base"], headers=w["headers"], params={"sort": "title", "limit": 1, "offset": 1}
        )
    ).json()
    assert page1["total"] == 2 and page1["has_more"] is True
    assert page1["items"][0]["title"] == "Alpha" and page2["items"][0]["title"] == "Beta"
    assert page2["has_more"] is False
    summary = (await client.get(w["base"] + "/summary", headers=w["headers"])).json()
    assert summary == {"total": 2, "by_status": {"draft": 1, "open": 1, "paused": 0, "closed": 0}}
    team = await client.get(
        f"/api/v1/organizations/{w['org']['id']}/team/summary", headers=w["headers"]
    )
    assert team.status_code == 200 and team.json()["open_jobs_count"] == 1
    await action(client, w, first, "pause")
    team = await client.get(
        f"/api/v1/organizations/{w['org']['id']}/team/summary", headers=w["headers"]
    )
    assert team.json()["open_jobs_count"] == 0
    assert (await client.get(w["base"], headers=w["headers"], params={"q": "%"})).json()[
        "total"
    ] == 0
    assert (
        await client.get(w["base"], headers=w["headers"], params={"owner_id": str(uuid.uuid4())})
    ).json()["total"] == 0
    for query in (
        {"limit": 101},
        {"limit": 0},
        {"offset": -1},
        {"sort": "injected"},
        {"q": "x" * 101},
        {"status": "archived"},
        {"owner_id": "invalid"},
    ):
        assert (await client.get(w["base"], headers=w["headers"], params=query)).status_code == 422


@pytest.mark.parametrize("org_state", ["suspended", "deleted", "wrong_type"])
async def test_unavailable_organizations(client, jobs_workspace, db_session, org_state):
    w = jobs_workspace
    job = await new_job(client, w)
    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    if org_state == "deleted":
        org.deleted_at = datetime.now(UTC)
    elif org_state == "wrong_type":
        org.type = OrgType.investor_firm
    else:
        org.status = "suspended"
    await db_session.commit()
    for method, suffix, payload in [
        ("GET", "", None),
        ("GET", "/summary", None),
        ("GET", f"/{job['id']}", None),
        ("POST", "", content()),
        ("PATCH", f"/{job['id']}", {"title": "No"}),
    ] + [("POST", f"/{job['id']}/{name}", {}) for name in ("publish", "pause", "close", "archive")]:
        assert (
            await client.request(method, w["base"] + suffix, headers=w["headers"], json=payload)
        ).status_code == 404


async def test_suspended_user(client, jobs_workspace, db_session):
    w = jobs_workspace
    user = await db_session.get(User, uuid.UUID(w["user_id"]))
    user.status = AccountStatus.suspended
    await db_session.commit()
    assert (await client.get(w["base"], headers=w["headers"])).status_code == 403


async def test_rate_limit_body_limit_and_cache_control(client, jobs_workspace, monkeypatch):
    w = jobs_workspace
    monkeypatch.setattr(get_settings(), "JOB_WRITE_LIMIT", 1)
    job = await new_job(client, w)
    response = await client.patch(
        f"{w['base']}/{job['id']}", headers=w["headers"], json={"title": "Too soon"}
    )
    assert response.status_code == 429 and response.json()["error"]["code"] == "RATE_LIMITED"
    assert (await client.get(w["base"], headers=w["headers"])).headers[
        "cache-control"
    ] == "no-store"
    response = await client.post(
        w["base"],
        headers={**w["headers"], "Content-Type": "application/json"},
        content=b" " * (256 * 1024 + 1),
    )
    assert response.status_code == 413 and response.json()["error"]["code"] == "REQUEST_TOO_LARGE"


async def test_failed_create_audit_rolls_back(client, jobs_workspace, monkeypatch, db_session):
    from app.services import activity_service

    w = jobs_workspace
    original = activity_service.record

    def fail_audit(*args, **kwargs):
        raise RuntimeError("Simulated audit failure")

    monkeypatch.setattr(activity_service, "record", fail_audit)
    with pytest.raises(RuntimeError, match="Simulated audit failure"):
        await new_job(client, w, benefits=["Must roll back"])
    monkeypatch.setattr(activity_service, "record", original)
    assert (await db_session.execute(select(func.count()).select_from(Job))).scalar_one() == 0
    assert (
        await db_session.execute(select(func.count()).select_from(JobBenefit))
    ).scalar_one() == 0


async def test_db_constraints(db_session, jobs_workspace):
    w = jobs_workspace
    for values in (
        {"salary_min": -1},
        {"salary_min": 2, "salary_max": 1},
        {"equity_max_pct": 101},
        {"experience_max_yrs": -1},
        {"openings": 0},
        {"status": "open"},
        {"visibility": "bad"},
    ):
        async with db_session.begin_nested():
            db_session.add(Job(org_id=uuid.UUID(w["org"]["id"]), title="Constraint test", **values))
            with pytest.raises(IntegrityError):
                await db_session.flush()
            await db_session.rollback()


def test_openapi_documents_only_management_jobs():
    spec = create_app().openapi()
    # Pipeline routes now share the parent path; count the management domain,
    # not every later-step operation nested below an organization job.
    paths = {
        path: {
            method: operation
            for method, operation in value.items()
            if "jobs" in operation.get("tags", [])
        }
        for path, value in spec["paths"].items()
        if path.startswith("/api/v1/organizations/{org_id}/jobs")
    }
    assert sum(len(operations) for operations in paths.values()) == 9
    for operations in paths.values():
        for operation in operations.values():
            assert "401" in operation["responses"] and "422" in operation["responses"]
    assert "status" not in spec["components"]["schemas"]["JobCreate"]["properties"]
    assert "org_id" not in spec["components"]["schemas"]["JobUpdate"]["properties"]


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"), reason="requires PostgreSQL row locks"
)
async def test_parallel_lifecycle_and_child_updates(client, jobs_workspace):
    w = jobs_workspace
    job = await new_job(client, w)
    path = f"{w['base']}/{job['id']}"
    results = await asyncio.gather(
        *(client.post(path + "/publish", headers=w["headers"]) for _ in range(3))
    )
    assert [r.status_code for r in results] == [200, 200, 200]
    async with TestSessionFactory() as db:
        assert (
            await db.execute(
                select(func.count())
                .select_from(ActivityEvent)
                .where(ActivityEvent.event_type == "job_published")
            )
        ).scalar_one() == 1
    results = await asyncio.gather(
        *(
            client.patch(
                path,
                headers=w["headers"],
                json={"skills": [{"skill_id": w["skill_id"]}], "benefits": [str(index)]},
            )
            for index in range(3)
        )
    )
    assert [r.status_code for r in results] == [200, 200, 200]
    response = await client.get(path, headers=w["headers"])
    assert len(response.json()["skills"]) == len(response.json()["benefits"]) == 1
