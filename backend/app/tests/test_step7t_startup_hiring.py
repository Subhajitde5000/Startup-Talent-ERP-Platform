"""Step 7t/7u API gaps found while wiring the startup hiring pages and the
job seeker dashboard (migration 0052):

- hiring requests: ``why_now = stage_plan`` and an optional Step 5i stage
  exit criterion (startup orgs only, 422 at the field otherwise);
- startup profile ``mission`` and the company page's ``tagline`` /
  ``mission`` (gated like the summary);
- talent search ``location`` / ``availability`` / ``preferred_mode``;
- ``GET /interviews/mine`` — the candidate's own interviews only.

Reuses the existing 7a-7j fixtures; no parallel fixture system.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models.readiness import ReadinessCriterion
from app.services import readiness_service
from app.tests.test_applicant_pipeline import member, pipeline
from app.tests.test_funding_rounds import _make_org_with_members, _signup_verified
from app.tests.test_job_discovery import marketplace
from app.tests.test_jobs import action, jobs_workspace, new_job
from app.tests.test_talent_sourcing import search_path, seeker

__all__ = ["jobs_workspace", "marketplace", "pipeline"]


def requests_path(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/hiring-requests"


async def _criteria(db_session) -> tuple[ReadinessCriterion, ReadinessCriterion]:
    """(an active exit criterion, a plain readiness item)."""
    await readiness_service.bootstrap_criteria(db_session)
    rows = list((await db_session.execute(select(ReadinessCriterion))).scalars())
    exit_row = next(r for r in rows if r.is_exit_criterion and r.is_active)
    plain = next(r for r in rows if not r.is_exit_criterion)
    return exit_row, plain


async def test_request_stage_plan_and_stage_criterion(client, marketplace, db_session):
    exit_row, plain = await _criteria(db_session)
    startup = await _make_org_with_members(client, suffix=uuid.uuid4().hex[:8])
    org_id = startup["org"]["id"]
    owner = startup["owner"]["headers"]

    created = await client.post(
        requests_path(org_id),
        headers=owner,
        json={
            "role_title": "Founding Engineer",
            "why_now": "stage_plan",
            "stage_criterion_id": str(exit_row.id),
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["why_now"] == "stage_plan"
    assert body["stage_criterion_id"] == str(exit_row.id)
    assert body["stage_criterion_title"] == exit_row.title
    assert body["stage_criterion_stage"] == (exit_row.stage.value if exit_row.stage else None)

    # The list carries the same projection (batched, no N+1).
    listing = await client.get(requests_path(org_id), headers=owner)
    assert listing.json()["items"][0]["stage_criterion_title"] == exit_row.title

    # Member edits and clears it while the request is open.
    request_url = f"/api/v1/hiring-requests/{body['id']}"
    cleared = await client.patch(
        request_url, headers=startup["member"]["headers"], json={"stage_criterion_id": None}
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["stage_criterion_id"] is None
    assert cleared.json()["stage_criterion_title"] is None

    # Not an exit criterion, unknown id -> 422 located on the field.
    for bad in (str(plain.id), str(uuid.uuid4())):
        for response in (
            await client.post(
                requests_path(org_id),
                headers=owner,
                json={"role_title": "X", "stage_criterion_id": bad},
            ),
            await client.patch(request_url, headers=owner, json={"stage_criterion_id": bad}),
        ):
            assert response.status_code == 422, response.text
            assert response.json()["error"]["details"][0]["loc"] == ["body", "stage_criterion_id"]

    # Employer orgs have no stages.
    employer = await client.post(
        requests_path(marketplace["org"]["id"]),
        headers=marketplace["headers"],
        json={"role_title": "X", "stage_criterion_id": str(exit_row.id)},
    )
    assert employer.status_code == 422, employer.text
    assert employer.json()["error"]["details"][0]["loc"] == ["body", "stage_criterion_id"]

    # Viewer and outsider stay blocked; unknown why_now is still a 422.
    assert (
        await client.post(
            requests_path(org_id), headers=startup["viewer"]["headers"], json={"role_title": "X"}
        )
    ).status_code == 403
    assert (
        await client.post(
            requests_path(org_id), headers=startup["outsider"]["headers"], json={"role_title": "X"}
        )
    ).status_code == 403
    bad_why = await client.post(
        requests_path(org_id), headers=owner, json={"role_title": "X", "why_now": "vibes"}
    )
    assert bad_why.status_code == 422
    assert bad_why.json()["error"]["details"][0]["loc"] == ["body", "why_now"]


async def test_startup_mission_and_company_page_lines(client, marketplace):
    owner = await _signup_verified(client, "mission-owner@example.com", "startup")
    created = await client.post(
        "/api/v1/organizations",
        headers=owner["headers"],
        json={"name": "Mission Labs", "type": "startup"},
    )
    assert created.status_code == 201, created.text
    org_id = created.json()["id"]
    profile_url = f"/api/v1/organizations/{org_id}/startup-profile"

    saved = await client.patch(
        profile_url,
        headers=owner["headers"],
        json={
            "tagline": "Finance tools for growing teams",
            "mission": "  Help every business decide better.  ",
            "profile_visibility": "public",
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["mission"] == "Help every business decide better."
    too_long = await client.patch(
        profile_url, headers=owner["headers"], json={"mission": "m" * 301}
    )
    assert too_long.status_code == 422
    assert too_long.json()["error"]["details"][0]["loc"] == ["body", "mission"]

    # The company page exists once a public job is open; tagline always,
    # mission only while the summary section is public.
    sw = {"base": f"/api/v1/organizations/{org_id}/jobs", "headers": owner["headers"]}
    job = await new_job(client, sw)
    await action(client, sw, job, "publish")
    page = await client.get(f"/api/v1/public/companies/{org_id}")
    assert page.status_code == 200, page.text
    assert page.json()["tagline"] == "Finance tools for growing teams"
    assert page.json()["mission"] == "Help every business decide better."
    hidden = await client.patch(
        profile_url, headers=owner["headers"], json={"summary_public": False}
    )
    assert hidden.status_code == 200
    page = await client.get(f"/api/v1/public/companies/{org_id}")
    assert page.json()["mission"] is None
    assert page.json()["tagline"] == "Finance tools for growing teams"

    # Employer company pages carry neither line.
    employer = await client.get(f"/api/v1/public/companies/{marketplace['org']['id']}")
    assert employer.status_code == 200
    assert employer.json()["tagline"] is None and employer.json()["mission"] is None


async def test_talent_search_location_availability_and_mode(client, marketplace):
    w = marketplace
    remote = await seeker(client, "filter-remote@example.com", location="Kolkata, India")
    other = await seeker(client, "filter-pune@example.com", location="Pune")
    changed = await client.patch(
        "/api/v1/talent-profile/me",
        headers=other["headers"],
        json={"preferred_mode": "onsite", "availability": "immediate"},
    )
    assert changed.status_code == 200, changed.text

    async def ids(**params):
        response = await client.get(
            search_path(w["org"]["id"]), headers=w["headers"], params=params
        )
        assert response.status_code == 200, response.text
        return {item["user_id"] for item in response.json()["items"]}

    assert await ids(location="kolkata") == {remote["id"]}
    assert await ids(location="%") == set()  # LIKE wildcards are escaped
    assert await ids(availability="immediate") == {other["id"]}
    assert await ids(preferred_mode="remote") == {remote["id"]}
    assert await ids(preferred_mode="onsite", location="pune") == {other["id"]}
    for bad in ({"availability": "tomorrow"}, {"preferred_mode": "moon"}, {"location": ""}):
        response = await client.get(search_path(w["org"]["id"]), headers=w["headers"], params=bad)
        assert response.status_code == 422, (bad, response.text)

    # Privacy gate still applies with the new filters.
    await client.patch(
        "/api/v1/users/me", headers=remote["headers"], json={"profile_public": False}
    )
    assert await ids(location="kolkata") == set()
    viewer = await member(client, w, role="viewer", email="filter-viewer@example.com")
    assert (
        await client.get(
            search_path(w["org"]["id"]), headers=viewer["headers"], params={"location": "pune"}
        )
    ).status_code == 403


async def test_my_interviews_across_applications(client, pipeline):
    w = pipeline
    owner_id = (await client.get("/api/v1/users/me", headers=w["headers"])).json()["id"]
    when = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    scheduled = await client.post(
        f"/api/v1/organizations/{w['org']['id']}/jobs/{w['job']['id']}"
        f"/applications/{w['app']['id']}/interviews",
        headers=w["headers"],
        json={
            "round_name": "Founder chat",
            "format": "video",
            "scheduled_at": when,
            "duration_min": 30,
            "interviewer_ids": [owner_id],
        },
    )
    assert scheduled.status_code == 201, scheduled.text

    mine = await client.get(
        "/api/v1/interviews/mine", headers=w["candidate"]["headers"], params={"window": "upcoming"}
    )
    assert mine.status_code == 200, mine.text
    page = mine.json()
    assert page["total"] == 1
    item = page["items"][0]
    assert item["round_name"] == "Founder chat"
    assert item["job_title"] == w["job"]["title"]
    assert item["company_name"]
    assert "feedback" not in item and "cancel_reason" not in item
    past = await client.get(
        "/api/v1/interviews/mine", headers=w["candidate"]["headers"], params={"window": "past"}
    )
    assert past.json()["total"] == 0

    # Someone else's interviews never appear; bad window 422; no auth 401.
    stranger = await _signup_verified(client, "mine-stranger@example.com", "jobseeker")
    assert (await client.get("/api/v1/interviews/mine", headers=stranger["headers"])).json()[
        "total"
    ] == 0
    assert (await client.get("/api/v1/interviews/mine", headers=w["headers"])).json()["total"] == 0
    assert (
        await client.get(
            "/api/v1/interviews/mine", headers=stranger["headers"], params={"window": "soon"}
        )
    ).status_code == 422
    assert (await client.get("/api/v1/interviews/mine")).status_code == 401
