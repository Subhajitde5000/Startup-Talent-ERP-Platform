"""Steps 5i + 5j tests: stage summary, history, exit criteria, stage tools.

Covers, per AGENTS.md section 7 and the approved 5i/5j plan:

- the D1 regression guard — bootstrapping 25 exit criteria must leave the
  six-item ``readiness_score`` bit-identical (the whole reason D1 exists);
- happy path for stage read/change, history, exit criteria and tools;
- validation errors (bad stage, bad progress, over-long notes, mass
  assignment on server-controlled fields);
- 401 without a token, 403 for a viewer on writes, 404 for a wrong-type or
  foreign organization;
- cross-organization attempts: a tool key and an org id from another org;
- that a stage change never alters readiness sign-offs (5i item 4);
- that unknown tool keys are 404 and co-founder search is absent (D8).
"""

import re
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.readiness import ReadinessCriterion, ReadinessStatus, StartupReadiness
from app.models.stage import StageToolProgress, StartupStageHistory
from app.services import email_service, readiness_service
from app.tests.conftest import TestSessionFactory

PASSWORD = "Str0ng!Password99"


def _extract_code() -> str:
    assert email_service.SENT_EMAILS, "expected a verification email"
    body = email_service.SENT_EMAILS[-1]["body"]
    match = re.search(r"(\d{6})", body)
    assert match, f"no 6-digit code in email body: {body!r}"
    return match.group(1)


async def _signup_verified(
    client: AsyncClient, email: str, role: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "display_name": email.split("@")[0].title(),
            "role": role,
        },
    )
    assert resp.status_code == 201, resp.text
    code = _extract_code()
    verify = await client.post(
        "/api/v1/auth/verify-email", json={"email": email, "code": code}
    )
    assert verify.status_code == 200, verify.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    return {
        "email": email,
        "headers": {"Authorization": f"Bearer {login.json()['access_token']}"},
    }


async def _create_org(
    client: AsyncClient, auth: dict, *, name: str = "Acme Rockets", type_: str = "startup"
) -> dict:
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": name, "type": type_},
        headers=auth["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _invite(client: AsyncClient, owner: dict, invitee: dict, org: dict, role: str) -> None:
    resp = await client.post(
        f"/api/v1/organizations/{org['id']}/invites",
        json={"email": invitee["email"], "role": role},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
    accept = await client.post(
        f"/api/v1/invites/{resp.json()['token']}/accept", headers=invitee["headers"]
    )
    assert accept.status_code == 200, accept.text


async def _seed(db_session: AsyncSession) -> None:
    await readiness_service.bootstrap_criteria(db_session)


async def _startup(client: AsyncClient, db_session: AsyncSession, email: str) -> dict:
    auth = await _signup_verified(client, email)
    org = await _create_org(client, auth, name=f"Co {email.split('@')[0]}")
    await _seed(db_session)
    return {"auth": auth, "org": org}


def _stage_url(org_id: str) -> str:
    return f"/api/v1/organizations/{org_id}/stage"


# --- 5i D1: the score must not move ----------------------------------------


@pytest.mark.asyncio
async def test_exit_criteria_do_not_change_readiness_score(client: AsyncClient) -> None:
    """THE D1 guard: 25 extra criteria must leave the 6-item score alone."""
    auth = await _signup_verified(client, "founder@example.com")
    org = await _create_org(client, auth)

    # Before the exit criteria exist at all: bootstrap ONLY the six
    # readiness items, which is exactly what 5f did before 5i.
    async with TestSessionFactory() as session:
        for spec in readiness_service.CRITERIA_SPEC:
            session.add(ReadinessCriterion(**spec))
        await session.commit()

    board = await client.get(
        f"/api/v1/organizations/{org['id']}/readiness", headers=auth["headers"]
    )
    assert board.status_code == 200, board.text
    before_total = board.json()["summary"]["criteria_total"]
    assert before_total == 6
    before_pct = board.json()["summary"]["readiness_pct"]

    # Now add the 25 stage exit criteria.
    async with TestSessionFactory() as session:
        await readiness_service.bootstrap_criteria(session)

    after = await client.get(
        f"/api/v1/organizations/{org['id']}/readiness", headers=auth["headers"]
    )
    assert after.status_code == 200, after.text
    summary = after.json()["summary"]
    # Denominator unchanged, score unchanged, and the checklist itself is
    # still exactly the six items.
    assert summary["criteria_total"] == 6
    assert summary["readiness_pct"] == before_pct
    assert len(after.json()["items"]) == 6
    assert all(not item["is_exit_criterion"] for item in after.json()["items"])


@pytest.mark.asyncio
async def test_bootstrap_creates_31_criteria_and_is_idempotent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _seed(db_session)
    rows = (await db_session.execute(select(ReadinessCriterion))).scalars().all()
    exit_rows = [r for r in rows if r.is_exit_criterion]
    assert len(rows) == 31
    assert len(exit_rows) == 25
    # Five per stage, in page order.
    for stage in ("idea", "prototype", "early_revenue", "growth", "mature"):
        staged = [r for r in exit_rows if str(r.stage) == stage]
        assert len(staged) == 5, stage
        assert [r.display_order for r in staged] == [1, 2, 3, 4, 5]

    inserted, updated = await readiness_service.bootstrap_criteria(db_session)
    assert (inserted, updated) == (0, 0)  # second run is a no-op


# --- stage read and change -------------------------------------------------


@pytest.mark.asyncio
async def test_stage_summary_defaults_to_idea(client: AsyncClient, db_session: AsyncSession) -> None:
    s = await _startup(client, db_session, "s1@example.com")
    resp = await client.get(_stage_url(s["org"]["id"]), headers=s["auth"]["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["stage"] == "idea"
    assert body["exit_criteria_total"] == 5
    assert body["exit_criteria_signed_off"] == 0
    assert body["readiness_pct"] is None  # 5f has not scored this org yet


@pytest.mark.asyncio
async def test_change_stage_records_history(client: AsyncClient, db_session: AsyncSession) -> None:
    s = await _startup(client, db_session, "s2@example.com")
    org_id = s["org"]["id"]

    resp = await client.patch(
        _stage_url(org_id),
        json={"stage": "prototype", "note": "MVP shipped"},
        headers=s["auth"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["stage"] == "prototype"
    assert resp.json()["exit_criteria_total"] == 5  # prototype's own set

    hist = await client.get(
        f"{_stage_url(org_id)}/history", headers=s["auth"]["headers"]
    )
    assert hist.status_code == 200, hist.text
    page = hist.json()
    assert page["total"] == 1
    row = page["items"][0]
    assert row["from_stage"] == "idea"
    assert row["to_stage"] == "prototype"
    assert row["note"] == "MVP shipped"
    assert row["changed_by"] is not None


@pytest.mark.asyncio
async def test_same_stage_is_a_noop_without_history(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    s = await _startup(client, db_session, "s3@example.com")
    org_id = s["org"]["id"]
    resp = await client.patch(
        _stage_url(org_id), json={"stage": "idea"}, headers=s["auth"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    hist = await client.get(f"{_stage_url(org_id)}/history", headers=s["auth"]["headers"])
    assert hist.json()["total"] == 0


@pytest.mark.asyncio
async def test_profile_patch_also_records_history(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """The 5a PATCH is the endpoint the current UI calls; it must record
    history too or stage changes would go unrecorded (5i item 4)."""
    s = await _startup(client, db_session, "s4@example.com")
    org_id = s["org"]["id"]
    resp = await client.patch(
        f"/api/v1/organizations/{org_id}/startup-profile",
        json={"stage": "growth"},
        headers=s["auth"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    hist = await client.get(f"{_stage_url(org_id)}/history", headers=s["auth"]["headers"])
    assert hist.json()["total"] == 1
    assert hist.json()["items"][0]["to_stage"] == "growth"


@pytest.mark.asyncio
async def test_stage_change_never_alters_sign_offs(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """5i item 4: a stage change must not touch readiness state."""
    s = await _startup(client, db_session, "s5@example.com")
    org_id = s["org"]["id"]

    board = await client.get(
        f"/api/v1/organizations/{org_id}/readiness", headers=s["auth"]["headers"]
    )
    assert board.status_code == 200
    item = board.json()["items"][0]

    # Force THE asserted row to signed_off out of band (admin sign-off is
    # 5f's own flow, covered by test_readiness).
    async with TestSessionFactory() as session:
        row = (
            await session.execute(
                select(StartupReadiness).where(
                    StartupReadiness.org_id == uuid.UUID(org_id),
                    StartupReadiness.criterion_id
                    == uuid.UUID(item["criterion_id"]),
                )
            )
        ).scalar_one()
        row.status = ReadinessStatus.signed_off
        await session.commit()

    resp = await client.patch(
        _stage_url(org_id), json={"stage": "mature"}, headers=s["auth"]["headers"]
    )
    assert resp.status_code == 200, resp.text

    after = await client.get(
        f"/api/v1/organizations/{org_id}/readiness", headers=s["auth"]["headers"]
    )
    statuses = {i["criterion_id"]: i["status"] for i in after.json()["items"]}
    assert statuses[item["criterion_id"]] == "signed_off"


# --- exit criteria ---------------------------------------------------------


@pytest.mark.asyncio
async def test_exit_criteria_for_stage(client: AsyncClient, db_session: AsyncSession) -> None:
    s = await _startup(client, db_session, "s6@example.com")
    org_id = s["org"]["id"]
    resp = await client.get(
        f"{_stage_url(org_id)}/idea/criteria", headers=s["auth"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["stage"] == "idea"
    assert body["is_current_stage"] is True
    assert len(body["items"]) == 5
    assert body["items"][0]["title"] == (
        "Problem statement written and reviewed by a mentor"
    )
    assert all(i["is_exit_criterion"] for i in body["items"])
    assert all(i["status"] == "not_started" for i in body["items"])
    # Each item carries the startup_readiness row id (tasks can link to it).
    assert all(i["id"] for i in body["items"])


@pytest.mark.asyncio
async def test_exit_criteria_for_non_current_stage(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    s = await _startup(client, db_session, "s7@example.com")
    org_id = s["org"]["id"]
    resp = await client.get(
        f"{_stage_url(org_id)}/mature/criteria", headers=s["auth"]["headers"]
    )
    assert resp.status_code == 200
    assert resp.json()["is_current_stage"] is False
    assert len(resp.json()["items"]) == 5


@pytest.mark.asyncio
async def test_exit_criterion_uses_5f_state_machine(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """One source of truth: an exit criterion is a startup_readiness row,
    so the 5f submit endpoint drives it unchanged."""
    s = await _startup(client, db_session, "s8@example.com")
    org_id = s["org"]["id"]
    criteria = (
        await client.get(
            f"{_stage_url(org_id)}/idea/criteria", headers=s["auth"]["headers"]
        )
    ).json()
    criterion_id = criteria["items"][0]["criterion_id"]

    resp = await client.patch(
        f"/api/v1/organizations/{org_id}/readiness/{criterion_id}",
        json={"evidence": "10 interviews logged"},
        headers=s["auth"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    sub = await client.post(
        f"/api/v1/organizations/{org_id}/readiness/{criterion_id}/submit",
        headers=s["auth"]["headers"],
    )
    assert sub.status_code == 200, sub.text
    assert sub.json()["status"] == "submitted"

    # And submitting it did NOT move the readiness score denominator.
    board = await client.get(
        f"/api/v1/organizations/{org_id}/readiness", headers=s["auth"]["headers"]
    )
    assert board.json()["summary"]["criteria_total"] == 6


# --- stage tools (5j) ------------------------------------------------------


@pytest.mark.asyncio
async def test_tools_board_lists_vocabulary(client: AsyncClient, db_session: AsyncSession) -> None:
    s = await _startup(client, db_session, "t1@example.com")
    org_id = s["org"]["id"]
    resp = await client.get(
        f"{_stage_url(org_id)}/tools", params={"stage": "idea"}, headers=s["auth"]["headers"]
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 4
    assert body["completed"] == 0
    keys = [i["tool_key"] for i in body["items"]]
    assert keys == ["idea_canvas", "interview_tracker", "market_sizing", "customer_persona"]
    assert body["items"][3]["is_optional"] is True
    # D8: co-founder search is deliberately absent.
    assert "co_founder_search" not in keys


@pytest.mark.asyncio
async def test_tool_update_upserts(client: AsyncClient, db_session: AsyncSession) -> None:
    s = await _startup(client, db_session, "t2@example.com")
    org_id = s["org"]["id"]

    resp = await client.patch(
        f"{_stage_url(org_id)}/tools/idea_canvas",
        json={"status": "in_progress", "progress": 40, "notes": "Draft v1"},
        headers=s["auth"]["headers"],
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "in_progress"
    assert body["progress"] == 40
    assert body["notes"] == "Draft v1"

    # Second write updates the same row, never a duplicate.
    again = await client.patch(
        f"{_stage_url(org_id)}/tools/idea_canvas",
        json={"progress": 70},
        headers=s["auth"]["headers"],
    )
    assert again.status_code == 200
    assert again.json()["progress"] == 70
    assert again.json()["status"] == "in_progress"

    rows = (
        await db_session.execute(
            select(StageToolProgress).where(
                StageToolProgress.org_id == uuid.UUID(org_id)
            )
        )
    ).scalars().all()
    assert len(rows) == 1

    board = await client.get(
        f"{_stage_url(org_id)}/tools", params={"stage": "idea"}, headers=s["auth"]["headers"]
    )
    assert board.json()["items"][0]["progress"] == 70


@pytest.mark.asyncio
async def test_tool_status_progress_reconciled(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A contradictory pair can never be stored."""
    s = await _startup(client, db_session, "t3@example.com")
    org_id = s["org"]["id"]
    done = await client.patch(
        f"{_stage_url(org_id)}/tools/idea_canvas",
        json={"status": "done", "progress": 10},
        headers=s["auth"]["headers"],
    )
    assert done.status_code == 200
    assert done.json()["progress"] == 100  # done forces 100

    reset = await client.patch(
        f"{_stage_url(org_id)}/tools/idea_canvas",
        json={"status": "not_started", "progress": 80},
        headers=s["auth"]["headers"],
    )
    assert reset.json()["progress"] == 0


@pytest.mark.asyncio
async def test_unknown_tool_key_404(client: AsyncClient, db_session: AsyncSession) -> None:
    s = await _startup(client, db_session, "t4@example.com")
    org_id = s["org"]["id"]
    for key in ("no_such_tool", "co_founder_search"):
        resp = await client.patch(
            f"{_stage_url(org_id)}/tools/{key}",
            json={"progress": 10},
            headers=s["auth"]["headers"],
        )
        assert resp.status_code == 404, (key, resp.text)
        get = await client.get(
            f"{_stage_url(org_id)}/tools/{key}", headers=s["auth"]["headers"]
        )
        assert get.status_code == 404


@pytest.mark.asyncio
async def test_tool_readable_by_viewer_writable_only_by_member(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    s = await _startup(client, db_session, "t5@example.com")
    org_id = s["org"]["id"]
    viewer = await _signup_verified(client, "viewer@example.com")
    await _invite(client, s["auth"], viewer, s["org"], "viewer")

    read = await client.get(
        f"{_stage_url(org_id)}/tools/idea_canvas", headers=viewer["headers"]
    )
    assert read.status_code == 200, read.text
    assert read.json()["tool_key"] == "idea_canvas"

    write = await client.patch(
        f"{_stage_url(org_id)}/tools/idea_canvas",
        json={"progress": 10},
        headers=viewer["headers"],
    )
    assert write.status_code == 403, write.text


# --- authorization ---------------------------------------------------------


@pytest.mark.asyncio
async def test_requires_authentication(client: AsyncClient, db_session: AsyncSession) -> None:
    s = await _startup(client, db_session, "a1@example.com")
    org_id = s["org"]["id"]
    for path in (
        _stage_url(org_id),
        f"{_stage_url(org_id)}/history",
        f"{_stage_url(org_id)}/idea/criteria",
        f"{_stage_url(org_id)}/tools",
    ):
        assert (await client.get(path)).status_code == 401, path
    assert (
        await client.patch(_stage_url(org_id), json={"stage": "growth"})
    ).status_code == 401


@pytest.mark.asyncio
async def test_viewer_cannot_change_stage(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    s = await _startup(client, db_session, "a2@example.com")
    viewer = await _signup_verified(client, "v2@example.com")
    await _invite(client, s["auth"], viewer, s["org"], "viewer")
    resp = await client.patch(
        _stage_url(s["org"]["id"]),
        json={"stage": "growth"},
        headers=viewer["headers"],
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_non_member_gets_403_and_foreign_org_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Cross-organization: a valid org id the caller does not belong to is
    a 403 (they can guess it exists); a non-startup org is a 404."""
    owner = await _startup(client, db_session, "a3@example.com")
    outsider = await _signup_verified(client, "outsider@example.com")
    await _create_org(client, outsider, name="Outsider Co")

    resp = await client.get(_stage_url(owner["org"]["id"]), headers=outsider["headers"])
    assert resp.status_code == 403, resp.text

    employer = await _signup_verified(client, "emp@example.com", role="employer")
    emp_org = await _create_org(client, employer, name="Emp Co", type_="employer")
    resp2 = await client.get(_stage_url(emp_org["id"]), headers=employer["headers"])
    assert resp2.status_code == 404, resp2.text


@pytest.mark.asyncio
async def test_history_is_org_scoped(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """History of one org is never visible through another org's id."""
    a = await _startup(client, db_session, "h1@example.com")
    b = await _startup(client, db_session, "h2@example.com")
    await client.patch(
        _stage_url(a["org"]["id"]),
        json={"stage": "prototype"},
        headers=a["auth"]["headers"],
    )
    resp = await client.get(
        f"{_stage_url(b['org']['id'])}/history", headers=b["auth"]["headers"]
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


# --- validation ------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"stage": "series_z"},
        {"stage": "idea", "note": "x" * 501},
        {"stage": "idea", "unknown": True},
        {},
    ],
)
async def test_stage_change_validation(
    client: AsyncClient, db_session: AsyncSession, payload: dict
) -> None:
    s = await _startup(client, db_session, f"v-{abs(hash(str(payload)))%9999}@example.com")
    resp = await client.patch(
        _stage_url(s["org"]["id"]), json=payload, headers=s["auth"]["headers"]
    )
    assert resp.status_code == 422, (payload, resp.text)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"progress": -1},
        {"progress": 101},
        {"status": "half_done"},
        {"notes": "x" * 2001},
        {"stage": "growth"},  # path-owned, not body-owned
        {"tool_key": "other"},  # path-owned
        {"updated_by": "00000000-0000-0000-0000-000000000000"},
        {"org_id": "00000000-0000-0000-0000-000000000000"},
    ],
)
async def test_tool_update_rejects_mass_assignment(
    client: AsyncClient, db_session: AsyncSession, payload: dict
) -> None:
    s = await _startup(client, db_session, f"m-{abs(hash(str(payload)))%9999}@example.com")
    resp = await client.patch(
        f"{_stage_url(s['org']['id'])}/tools/idea_canvas",
        json=payload,
        headers=s["auth"]["headers"],
    )
    assert resp.status_code == 422, (payload, resp.text)


@pytest.mark.asyncio
async def test_invalid_stage_path_and_query_422(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    s = await _startup(client, db_session, "q1@example.com")
    org_id = s["org"]["id"]
    assert (
        await client.get(
            f"{_stage_url(org_id)}/scaling/criteria", headers=s["auth"]["headers"]
        )
    ).status_code == 422
    assert (
        await client.get(
            f"{_stage_url(org_id)}/tools",
            params={"stage": "scaling"},
            headers=s["auth"]["headers"],
        )
    ).status_code == 422


@pytest.mark.asyncio
async def test_server_controlled_fields_never_written(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """changed_by/updated_by come from the token, not the body."""
    s = await _startup(client, db_session, "sc1@example.com")
    org_id = s["org"]["id"]
    await client.patch(
        _stage_url(org_id), json={"stage": "prototype"}, headers=s["auth"]["headers"]
    )
    await client.patch(
        f"{_stage_url(org_id)}/tools/idea_canvas",
        json={"progress": 20},
        headers=s["auth"]["headers"],
    )

    me = await client.get("/api/v1/users/me", headers=s["auth"]["headers"])
    assert me.status_code == 200, me.text
    my_id = me.json()["id"]

    async with TestSessionFactory() as session:
        hist = (
            await session.execute(
                select(StartupStageHistory).where(
                    StartupStageHistory.org_id == uuid.UUID(org_id)
                )
            )
        ).scalars().one()
        assert str(hist.changed_by) == my_id

        tool = (
            await session.execute(
                select(StageToolProgress).where(
                    StageToolProgress.org_id == uuid.UUID(org_id)
                )
            )
        ).scalars().one()
        assert str(tool.updated_by) == my_id
        assert tool.stage == "idea"  # from the vocabulary, not the body


# --- no write surfaces beyond the two --------------------------------------


@pytest.mark.asyncio
async def test_only_declared_write_methods(client: AsyncClient, db_session: AsyncSession) -> None:
    s = await _startup(client, db_session, "w1@example.com")
    org_id = s["org"]["id"]
    for path in (
        f"{_stage_url(org_id)}/history",
        f"{_stage_url(org_id)}/idea/criteria",
        f"{_stage_url(org_id)}/tools",
    ):
        assert (await client.post(path, json={}, headers=s["auth"]["headers"])).status_code == 405
        assert (await client.delete(path, headers=s["auth"]["headers"])).status_code == 405

