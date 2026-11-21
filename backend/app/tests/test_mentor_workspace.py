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
        assert response.json()["health"] is None
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
