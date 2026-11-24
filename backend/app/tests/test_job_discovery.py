"""7b visibility, redaction and search, using established jobs/auth/SQL fixtures."""

import uuid
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.organization import Organization
from app.models.startup import StartupProfile
from app.tests.test_funding_rounds import _create_org, _signup_verified
from app.tests.test_jobs import action, jobs_workspace, new_job

__all__ = ["jobs_workspace"]


@pytest_asyncio.fixture
async def marketplace(client, jobs_workspace):
    w = jobs_workspace
    candidate = await _signup_verified(client, "candidate@discovery.dev", "jobseeker")
    job = await new_job(client, w, skills=[{"skill_id": w["skill_id"]}], benefits=["Insurance"])
    await action(client, w, job, "publish")
    return {**w, "candidate": candidate, "job": job}


def hdr(w):
    return w["candidate"]["headers"]


@pytest.mark.parametrize(
    "visibility,public_count,member_count,direct",
    [("public", 1, 1, 200), ("platform_members", 0, 1, 200), ("link_only", 0, 0, 200)],
)
async def test_visibility_matrix(
    client, marketplace, visibility, public_count, member_count, direct
):
    w = marketplace
    id_ = w["job"]["id"]
    assert (
        await client.patch(
            f"{w['base']}/{id_}", headers=w["headers"], json={"visibility": visibility}
        )
    ).status_code == 200
    assert (await client.get("/api/v1/public/jobs")).json()["total"] == public_count
    assert (await client.get("/api/v1/jobs", headers=hdr(w))).json()["total"] == member_count
    assert (await client.get(f"/api/v1/jobs/{id_}", headers=hdr(w))).status_code == direct
    assert (await client.get(f"/api/v1/public/jobs/{id_}")).status_code == (
        200 if visibility == "public" else 404
    )
    # Signed-in other roles do not obtain the job-seeker member audience.
    assert (await client.get("/api/v1/jobs", headers=w["headers"])).json()["total"] == public_count
    assert (await client.get(f"/api/v1/jobs/{id_}", headers=w["headers"])).status_code == (
        200 if visibility == "public" else 404
    )


async def test_safe_projection_and_real_company_counts(client, marketplace):
    w = marketplace
    response = await client.get("/api/v1/public/jobs")
    assert response.status_code == 200, response.text
    row = response.json()["items"][0]
    assert row["company"]["id"] == w["org"]["id"] and row["company"]["open_jobs_count"] == 1
    assert row["skills"][0]["name"] == "Python" and row["benefits"][0]["label"] == "Insurance"
    assert row["salary_min"] == "1000000.00"
    for key in [
        "owner_id",
        "created_by",
        "org_id",
        "fair_hiring_confirmed",
        "deleted_at",
        "featured_until",
    ]:
        assert key not in row
    assert row["can_apply"] is False
    assert (await client.get("/api/v1/jobs", headers=hdr(w))).json()["items"][0][
        "can_apply"
    ] is True
    assert response.headers["cache-control"] == "no-store"
    company = await client.get(f"/api/v1/public/companies/{w['org']['id']}")
    assert company.status_code == 200 and company.json()["open_jobs_count"] == 1
    assert "my_role" not in company.json() and "members" not in company.json()


@pytest.mark.parametrize(
    "path",
    [
        "/jobs",
        "/jobs/00000000-0000-4000-8000-000000000001",
        "/companies/00000000-0000-4000-8000-000000000001",
        "/hiring-startups",
    ],
)
async def test_signed_routes_require_auth(client, path):
    assert (await client.get("/api/v1" + path)).status_code == 401


@pytest.mark.parametrize("status", ["draft", "paused", "closed", "archived"])
async def test_nonopen_jobs_excluded_from_feed(client, marketplace, status):
    w = marketplace
    job = w["job"]
    id_ = job["id"]
    if status == "draft":
        job = await new_job(client, w)
        id_ = job["id"]
        await action(client, w, w["job"], "close")
    elif status == "archived":
        await action(client, w, job, "close")
        await action(client, w, job, "archive")
    else:
        await action(client, w, job, "pause" if status == "paused" else "close")
    assert (await client.get("/api/v1/public/jobs")).json()["total"] == 0
    detail = await client.get(f"/api/v1/public/jobs/{id_}")
    assert detail.status_code == (404 if status in {"draft", "archived"} else 200)
    if detail.status_code == 200:
        assert detail.json()["can_apply"] is False


@pytest.mark.parametrize("org_state", ["suspended", "deleted"])
async def test_inactive_org_hidden_everywhere(client, marketplace, db_session, org_state):
    w = marketplace
    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    if org_state == "deleted":
        org.deleted_at = datetime.now(UTC)
    else:
        org.status = "suspended"
    await db_session.commit()
    assert (await client.get("/api/v1/public/jobs")).json()["total"] == 0
    assert (await client.get(f"/api/v1/jobs/{w['job']['id']}", headers=hdr(w))).status_code == 404
    assert (await client.get(f"/api/v1/public/companies/{org.id}")).status_code == 404


async def test_salary_hidden_no_filter_or_sort_oracle(client, marketplace):
    w = marketplace
    path = f"{w['base']}/{w['job']['id']}"
    assert (
        await client.patch(path, headers=w["headers"], json={"show_salary_publicly": False})
    ).status_code == 200
    for prefix, headers in [("/public", {}), ("", hdr(w))]:
        row = (await client.get(f"/api/v1{prefix}/jobs", headers=headers)).json()["items"][0]
        assert (
            row["salary_min"] is None
            and row["salary_max"] is None
            and row["salary_visible"] is False
        )
        for params in [{"sort": "salary"}, {"salary_min": "1"}, {"salary_max": "999999999"}]:
            assert (
                await client.get(f"/api/v1{prefix}/jobs", headers=headers, params=params)
            ).json()["total"] == 0


@pytest.mark.parametrize(
    "params,expected",
    [
        ({"q": "Python"}, 1),
        ({"q": "Backend"}, 1),
        ({"q": "Acme"}, 1),
        ({"q": "nonexistent"}, 0),
        ({"q": "%_\\"}, 0),
        ({"work_mode": "remote"}, 1),
        ({"work_mode": "onsite"}, 0),
        ({"employment_type": "contract"}, 0),
        ({"location": "remote"}, 1),
        ({"department": "design"}, 0),
        ({"experience_min": 6}, 0),
        ({"experience_max": 1}, 0),
        ({"salary_min": "1500000"}, 1),
        ({"salary_max": "999999"}, 0),
        ({"currency": "USD", "sort": "salary"}, 0),
        ({"salary_period": "monthly", "sort": "salary"}, 0),
        ({"equity_only": "true"}, 1),
        ({"posted_days": 1}, 1),
        ({"sort": "relevance", "q": "services"}, 1),
        ({"sort": "deadline"}, 1),
        ({"org_type": "startup"}, 0),
    ],
)
async def test_search_filters(client, marketplace, params, expected):
    response = await client.get("/api/v1/jobs", headers=hdr(marketplace), params=params)
    assert response.status_code == 200, response.text
    assert response.json()["total"] == expected


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
        {"q": "x" * 101},
        {"sort": "random"},
        {"currency": "x"},
        {"work_mode": "telepathy"},
        {"salary_min": "-1"},
        {"salary_min": "2", "salary_max": "1"},
        {"experience_min": 5, "experience_max": 2},
        {"skill_ids": "bad-uuid"},
        {"owner_id": str(uuid.uuid4())},
    ],
)
async def test_bad_filters(client, params):
    response = await client.get("/api/v1/public/jobs", params=params)
    assert response.status_code == 422, response.text


async def test_skills_and_pagination(client, marketplace):
    w = marketplace
    for i in range(2):
        job = await new_job(client, w, title=f"Other {i}")
        await action(client, w, job, "publish")
    params = {"skill_ids": w["skill_id"]}
    assert (await client.get("/api/v1/public/jobs", params=params)).json()["total"] == 1
    params["skill_ids"] = str(uuid.uuid4())
    assert (await client.get("/api/v1/public/jobs", params=params)).json()["total"] == 0
    pages = [
        (await client.get("/api/v1/public/jobs", params={"limit": 1, "offset": i})).json()
        for i in range(3)
    ]
    assert len({p["items"][0]["id"] for p in pages}) == 3
    assert pages[0]["total"] == 3 and pages[0]["has_more"] and not pages[2]["has_more"]


async def test_startup_privacy_and_hiring_directory(client, marketplace, db_session):
    w = marketplace
    owner = await _signup_verified(client, "startup@jobs.dev", "startup")
    org = await _create_org(client, owner, name="Private Startup")
    sw = {"base": f"/api/v1/organizations/{org['id']}/jobs", "headers": owner["headers"]}
    # Existing startup profile service owns creation/visibility validation.
    result = await client.patch(
        f"/api/v1/organizations/{org['id']}/startup-profile",
        headers=owner["headers"],
        json={"profile_visibility": "private", "sector": "SecretSector", "summary_public": False},
    )
    assert result.status_code == 200, result.text
    job = await new_job(client, sw)
    await action(client, sw, job, "publish")
    listing = (await client.get("/api/v1/public/jobs", params={"org_id": org["id"]})).json()
    assert listing["total"] == 1 and listing["items"][0]["company"]["sector"] is None
    assert (await client.get("/api/v1/public/jobs", params={"sector": "SecretSector"})).json()[
        "total"
    ] == 0
    assert (await client.get("/api/v1/public/hiring-startups")).json()["total"] == 0
    profile = (
        await db_session.execute(
            select(StartupProfile).where(StartupProfile.org_id == uuid.UUID(org["id"]))
        )
    ).scalar_one()
    profile.profile_visibility = "public"
    profile.problem = "InvisibleKeyword"
    profile.summary_public = False
    await db_session.commit()
    assert (await client.get("/api/v1/public/hiring-startups")).json()["total"] == 1
    assert (
        await client.get("/api/v1/public/hiring-startups", params={"q": "InvisibleKeyword"})
    ).json()["total"] == 0
    for prefix, headers in [("/public", {}), ("", hdr(w))]:
        result = await client.get(
            f"/api/v1{prefix}/hiring-startups",
            headers=headers,
            params={"stage": profile.stage, "sector": "SecretSector"},
        )
        assert result.status_code == 200, result.text
        assert result.json()["total"] == 1


async def test_discovery_rate_limited(client, marketplace, monkeypatch):
    from app.core.config import get_settings
    from app.services.rate_limiter import rate_limiter

    monkeypatch.setattr(get_settings(), "JOB_DISCOVERY_LIMIT", 1)
    rate_limiter.reset()
    assert (await client.get("/api/v1/public/jobs")).status_code == 200
    assert (await client.get("/api/v1/public/hiring-startups")).status_code == 429
    assert (await client.get("/api/v1/jobs", headers=hdr(marketplace))).status_code == 200
    assert (await client.get("/api/v1/jobs", headers=hdr(marketplace))).status_code == 429
