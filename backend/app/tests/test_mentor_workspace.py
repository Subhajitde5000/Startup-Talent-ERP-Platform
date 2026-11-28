"""Workspace aggregation and isolation checks."""

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.readiness import StartupReadiness
from app.tests.test_session import _pair, _signup


async def test_workspace_is_scoped_and_readiness_accessible(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    ctx = await _pair(client, "workspace")
    outsider = await _signup(client, "outsider-workspace@d8.dev")
    url = f"/api/v1/mentorships/{ctx['mid']}/workspace"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=outsider["headers"])).status_code == 404
    before = (
        await db_session.execute(select(func.count()).select_from(StartupReadiness))
    ).scalar_one()
    for actor in (ctx["founder"], ctx["mentor"]):
        response = await client.get(url, headers=actor["headers"])
        assert response.status_code == 200, response.text
        assert "health" not in response.json()
        assert response.json()["agreement"] == {"current": None, "pending": None}
        assert response.json()["completed_sessions"] == 0
        response = await client.get(
            f"/api/v1/mentorships/{ctx['mid']}/readiness", headers=actor["headers"]
        )
        assert response.status_code == 200, response.text
    assert (
        await client.get(f"/api/v1/mentorships/{ctx['mid']}/readiness", headers=outsider["headers"])
    ).status_code == 404
    after = (
        await db_session.execute(select(func.count()).select_from(StartupReadiness))
    ).scalar_one()
    assert before == after
    assert (
        await client.get("/api/v1/mentor/dashboard", headers=ctx["founder"]["headers"])
    ).status_code == 403
    impact = await client.get("/api/v1/mentor/impact", headers=ctx["mentor"]["headers"])
    assert impact.status_code == 200, impact.text
    assert impact.json()["active_startups"] == 1
    overview = f"/api/v1/organizations/{ctx['org_id']}/mentorships/overview"
    assert (await client.get(overview, headers=outsider["headers"])).status_code == 403
    assert (await client.get(overview, headers=ctx["founder"]["headers"])).json()[
        "active_count"
    ] == 1


# --------------------------------------------------------- 8j close-out tests


async def test_impact_and_dashboard_are_derived(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    from app.tests.test_mentor_signoff import _submitted_item
    from app.tests.test_session_review import _completed

    ctx = await _pair(client, "impact8j")
    await _completed(client, ctx)
    cid = await _submitted_item(client, ctx, db_session)
    signed = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/readiness/{cid}/sign-off",
        headers=ctx["mentor"]["headers"],
    )
    assert signed.status_code == 200, signed.text
    impact = await client.get("/api/v1/mentor/impact", headers=ctx["mentor"]["headers"])
    assert impact.json() == {
        "startups_mentored": 1,
        "active_startups": 1,
        "sessions_delivered": 1,
        "current_signoffs": 1,
    }
    dash = await client.get("/api/v1/mentor/dashboard", headers=ctx["mentor"]["headers"])
    assert dash.status_code == 200, dash.text
    assert dash.json()["impact"]["sessions_delivered"] == 1
    assert dash.json()["mentorships"]["total"] == 1
    assert "earnings" in dash.json()
    for path in ("/api/v1/mentor/impact", "/api/v1/mentor/dashboard"):
        assert (await client.get(path)).status_code == 401
        assert (await client.get(path, headers=ctx["founder"]["headers"])).status_code == 403
    # Another mentor's numbers are their own.
    other = await _pair(client, "impact8j2")
    theirs = await client.get("/api/v1/mentor/impact", headers=other["mentor"]["headers"])
    assert theirs.json()["sessions_delivered"] == 0 and theirs.json()["current_signoffs"] == 0


async def test_workspace_and_readiness_roles(client: AsyncClient) -> None:
    from app.tests.test_deliverable import _member

    ctx = await _pair(client, "roles8j")
    viewer = await _member(client, ctx["founder"], ctx["org_id"], "roles8j-v@d8.dev", "viewer")
    other = await _pair(client, "roles8j2")
    ws = f"/api/v1/mentorships/{ctx['mid']}/workspace"
    rd = f"/api/v1/mentorships/{ctx['mid']}/readiness"
    assert (await client.get(ws, headers=viewer["headers"])).status_code == 200
    assert (await client.get(rd, headers=viewer["headers"])).status_code == 200
    for actor in (other["mentor"], other["founder"]):
        assert (await client.get(ws, headers=actor["headers"])).status_code == 404
        assert (await client.get(rd, headers=actor["headers"])).status_code == 404
    assert (await client.get(rd)).status_code == 401
    paused = await client.post(
        f"/api/v1/mentorships/{ctx['mid']}/pause", json={}, headers=ctx["mentor"]["headers"]
    )
    assert paused.status_code == 200, paused.text
    blocked = await client.get(rd, headers=ctx["mentor"]["headers"])
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "INVALID_STATE"
    assert (await client.get(rd, headers=ctx["founder"]["headers"])).status_code == 200


async def test_org_overview_scoping(client: AsyncClient) -> None:
    from app.tests.test_deliverable import _member
    from app.tests.test_session import GOAL, _mentor

    ctx = await _pair(client, "ov8j")
    second = await _mentor(client, "ov8j-second@d8.dev")
    created = await client.post(
        f"/api/v1/organizations/{ctx['org_id']}/mentorships",
        json={"mentor_id": second["id"], "goal": GOAL},
        headers=ctx["founder"]["headers"],
    )
    assert created.status_code == 201, created.text
    viewer = await _member(client, ctx["founder"], ctx["org_id"], "ov8j-v@d8.dev", "viewer")
    url = f"/api/v1/organizations/{ctx['org_id']}/mentorships/overview"
    assert (await client.get(url)).status_code == 401
    seen = await client.get(url, headers=viewer["headers"])
    assert seen.status_code == 200 and seen.json()["mentorships"]["total"] == 2
    assert seen.json()["active_count"] == 1
    page = await client.get(url, params={"limit": 1}, headers=ctx["founder"]["headers"])
    assert len(page.json()["mentorships"]["items"]) == 1
    other = await _pair(client, "ov8j2")
    assert (await client.get(url, headers=other["founder"]["headers"])).status_code == 403
    # The mentor is not a member of the startup and gets no org view.
    assert (await client.get(url, headers=ctx["mentor"]["headers"])).status_code == 403
    hirer = await _signup(client, "ov8j-hirer@d8.dev", role="employer")
    employer = await client.post(
        "/api/v1/organizations",
        json={"name": "Hiring Co ov8j", "type": "employer"},
        headers=hirer["headers"],
    )
    assert employer.status_code == 201, employer.text
    not_startup = await client.get(
        f"/api/v1/organizations/{employer.json()['id']}/mentorships/overview",
        headers=hirer["headers"],
    )
    assert not_startup.status_code == 404


async def test_removed_placeholders_are_absent(client: AsyncClient) -> None:
    ctx = await _pair(client, "noplace8j")
    impact = await client.get("/api/v1/mentor/impact", headers=ctx["mentor"]["headers"])
    for key in ("readiness_change", "badges_attributed"):
        assert key not in impact.json()
    ws = await client.get(
        f"/api/v1/mentorships/{ctx['mid']}/workspace", headers=ctx["mentor"]["headers"]
    )
    assert "agreements_available" not in ws.json() and "health" not in ws.json()
