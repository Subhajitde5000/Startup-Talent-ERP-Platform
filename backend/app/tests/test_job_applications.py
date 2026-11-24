"""7c uses real authentication/database fixtures; only file storage is faked upstream."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.core.config import get_settings
from app.models.activity import ActivityEvent
from app.models.file import File
from app.models.job import Job
from app.models.job_application import ApplicationStageEvent, JobApplication
from app.models.organization import Organization
from app.models.user import User, UserRole, UserRoleRow
from app.tests.conftest import TEST_DATABASE_URL
from app.tests.test_funding_rounds import _invite_member, _signup_verified
from app.tests.test_job_discovery import hdr, marketplace
from app.tests.test_jobs import action, jobs_workspace, new_job

__all__ = ["marketplace", "jobs_workspace"]


def payload(**changes):
    return {"accuracy_confirmed": True, "consent_share": True, **changes}


async def apply(client, w, expect=201, **changes):
    result = await client.post(
        f"/api/v1/jobs/{w['job']['id']}/applications", headers=hdr(w), json=payload(**changes)
    )
    assert result.status_code == expect, result.text
    return result.json()


async def test_submit_snapshot_context_history_and_withdraw(client, marketplace, db_session):
    w = marketplace
    context = await client.get(f"/api/v1/jobs/{w['job']['id']}/application-context", headers=hdr(w))
    assert context.status_code == 200, context.text
    assert context.json()["can_apply"] and context.json()["resume_optional"]
    row = await apply(
        client,
        w,
        cover_note="Why I want this role",
        salary_expectation="1400000.50",
        currency="INR",
    )
    assert row["stage"] == "applied" and row["source"] == "platform"
    assert (
        row["salary_expectation"] == "1400000.50"
        and row["profile_snapshot"]["contact"]["email"] == w["candidate"]["email"]
    )
    assert row["job_snapshot"]["company_name"] == w["org"]["name"] and row["consent_share"]
    for name in [
        "applicant_id",
        "submission_fingerprint",
        "rating",
        "match_score",
        "assignee_id",
        "rejected_reason",
    ]:
        assert name not in row
    assert (await client.get("/api/v1/applications", headers=hdr(w))).json()["total"] == 1
    other = await _signup_verified(client, "other@applications.dev", "jobseeker")
    assert (await client.get("/api/v1/applications", headers=other["headers"])).json()["total"] == 0
    id_ = row["id"]
    path = f"/api/v1/applications/{id_}"
    assert (await client.get(path, headers=hdr(w))).json() == row
    context = (
        await client.get(f"/api/v1/jobs/{w['job']['id']}/application-context", headers=hdr(w))
    ).json()
    assert not context["can_apply"] and context["existing_application_id"] == id_
    user = (
        await db_session.execute(select(User).where(User.primary_email == w["candidate"]["email"]))
    ).scalar_one()
    user.display_name = "Changed later"
    await db_session.commit()
    assert (await client.get(path, headers=hdr(w))).json()["profile_snapshot"] == row[
        "profile_snapshot"
    ]
    event = (await db_session.execute(select(ApplicationStageEvent))).scalar_one()
    event.note = "Private discussion"
    await db_session.commit()
    history = (await client.get(path + "/stage-events", headers=hdr(w))).json()
    assert history["total"] == 1 and history["items"][0]["to_stage"] == "applied"
    assert "actor_id" not in history["items"][0] and "note" not in history["items"][0]
    result = await client.post(path + "/withdraw", headers=hdr(w), json={})
    assert result.status_code == 200, result.text
    assert result.json()["stage"] == "withdrawn" and result.json()["withdrawn_at"]
    assert (await client.post(path + "/withdraw", headers=hdr(w))).json() == result.json()
    history = (
        await client.get(path + "/stage-events", headers=hdr(w), params={"limit": 1, "offset": 1})
    ).json()
    assert (
        history["total"] == 2
        and history["items"][0]["from_stage"] == "applied"
        and not history["has_more"]
    )
    assert (
        await client.get("/api/v1/applications", headers=hdr(w), params={"stage": "withdrawn"})
    ).json()["total"] == 1
    events = (
        (
            await db_session.execute(
                select(ActivityEvent).where(ActivityEvent.entity_type == "application")
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 2 and all(e.org_id is None for e in events)
    assert all("Why I want" not in str(e.data) for e in events)


async def test_identical_retry_diff_duplicate_and_archive_history(client, marketplace):
    w = marketplace
    row = await apply(client, w, cover_note="Same", salary_expectation="100.00")
    again = await apply(client, w, expect=200, cover_note="Same", salary_expectation="100")
    assert row == again
    await apply(client, w, expect=409, cover_note="Changed")
    await action(client, w, w["job"], "close")
    await action(client, w, w["job"], "archive")
    assert (await client.get(f"/api/v1/jobs/{w['job']['id']}", headers=hdr(w))).status_code == 404
    assert (
        await client.get(f"/api/v1/applications/{row['id']}", headers=hdr(w))
    ).status_code == 200
    assert (await apply(client, w, expect=200, cover_note="Same", salary_expectation="100"))[
        "id"
    ] == row["id"]
    await client.post(f"/api/v1/applications/{row['id']}/withdraw", headers=hdr(w))
    await apply(client, w, expect=409, cover_note="Please reapply")
    assert (await apply(client, w, expect=200, cover_note="Same", salary_expectation="100"))[
        "stage"
    ] == "withdrawn"


@pytest.mark.parametrize(
    "field",
    [
        "id",
        "job_id",
        "org_id",
        "applicant_id",
        "stage",
        "source",
        "match_score",
        "match_reason",
        "is_blind",
        "practice_verified",
        "assignee_id",
        "rating",
        "rejected_reason",
        "withdrawn_at",
        "deleted_at",
        "created_at",
        "updated_at",
        "stage_changed_at",
        "profile_snapshot",
        "job_snapshot",
        "submission_fingerprint",
        "consent_shared_at",
        "accuracy_confirmed_at",
    ],
)
async def test_mass_assignment_rejected(client, marketplace, field):
    await apply(client, marketplace, expect=422, **{field: "forged"})


@pytest.mark.parametrize(
    "changes",
    [
        {"accuracy_confirmed": False},
        {"consent_share": False},
        {"accuracy_confirmed": "true"},
        {"consent_share": 1},
        {"cover_note": "x" * 1001},
        {"salary_expectation": "-1"},
        {"salary_expectation": 1.25},
        {"salary_expectation": True},
        {"currency": "XX"},
        {"resume_file_id": "notuuid"},
        {"contact": {"name": "X", "email": "bad"}},
        {"contact": {"name": "  ", "email": "x@example.com"}},
        {
            "contact": {
                "name": "X",
                "email": "x@example.com",
                "portfolio_url": "javascript:alert(1)",
            }
        },
        {
            "contact": {
                "name": "X",
                "email": "x@example.com",
                "portfolio_url": "https://user:pass@example.com",
            }
        },
        {"screening_answers": [{"key": "remote_comfort", "value": 1}]},
        {"screening_answers": [{"key": "unknown", "value": "x"}]},
    ],
)
async def test_validation(client, marketplace, changes):
    await apply(client, marketplace, expect=422, **changes)


@pytest.mark.parametrize(
    "route,method",
    [
        ("context", "GET"),
        ("submit", "POST"),
        ("list", "GET"),
        ("detail", "GET"),
        ("history", "GET"),
        ("withdraw", "POST"),
    ],
)
async def test_auth_and_wrong_role(client, marketplace, route, method):
    w = marketplace
    paths = {
        "context": f"/jobs/{w['job']['id']}/application-context",
        "submit": f"/jobs/{w['job']['id']}/applications",
        "list": "/applications",
        "detail": f"/applications/{uuid.uuid4()}",
        "history": f"/applications/{uuid.uuid4()}/stage-events",
        "withdraw": f"/applications/{uuid.uuid4()}/withdraw",
    }
    path = "/api/v1" + paths[route]
    kwargs = {"json": payload()} if route == "submit" else {}
    assert (await client.request(method, path, **kwargs)).status_code == 401
    assert (await client.request(method, path, headers=w["headers"], **kwargs)).status_code == 403


async def test_other_applicant_and_hiring_member_cannot_read_or_mutate(client, marketplace):
    w = marketplace
    row = await apply(client, w)
    other = await _signup_verified(client, "other@privacy.dev", "jobseeker")
    for suffix, method in [("", "GET"), ("/stage-events", "GET"), ("/withdraw", "POST")]:
        assert (
            await client.request(
                method, f"/api/v1/applications/{row['id']}" + suffix, headers=other["headers"]
            )
        ).status_code == 404
        assert (
            await client.request(
                method, f"/api/v1/applications/{row['id']}" + suffix, headers=w["headers"]
            )
        ).status_code == 403
    response = await client.post(
        f"/api/v1/applications/{row['id']}/withdraw", headers=hdr(w), json={"stage": "hired"}
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "job_status", ["draft", "paused", "closed", "archived", "deadline", "org_suspended"]
)
async def test_submission_gates(client, marketplace, db_session, job_status):
    w = marketplace
    if job_status == "draft":
        w["job"] = await new_job(client, w)
    elif job_status == "paused":
        await action(client, w, w["job"], "pause")
    elif job_status in {"closed", "archived"}:
        await action(client, w, w["job"], "close")
        if job_status == "archived":
            await action(client, w, w["job"], "archive")
    elif job_status == "deadline":
        response = await client.patch(
            f"{w['base']}/{w['job']['id']}",
            headers=w["headers"],
            json={"application_deadline": (datetime.now(UTC) - timedelta(seconds=1)).isoformat()},
        )
        assert response.status_code == 200, response.text
    else:
        org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
        org.status = "suspended"
        await db_session.commit()
    await apply(
        client, w, expect=404 if job_status in {"draft", "archived", "org_suspended"} else 409
    )


async def test_own_org_membership_blocks_even_multirole(client, marketplace, db_session):
    w = marketplace
    await _invite_member(client, w["actor"], w["candidate"], w["org"], role="viewer")
    await apply(client, w, expect=409)
    ctx = (
        await client.get(f"/api/v1/jobs/{w['job']['id']}/application-context", headers=hdr(w))
    ).json()
    assert not ctx["can_apply"] and "own organization" in ctx["ineligible_reason"]
    assert (await client.get("/api/v1/jobs", headers=hdr(w))).json()["items"][0][
        "can_apply"
    ] is False
    # No admin/global role bypass into somebody else's applications.
    owner_id = uuid.UUID(w["user_id"])
    db_session.add(UserRoleRow(user_id=owner_id, role=UserRole.jobseeker))
    await db_session.commit()
    assert (
        await client.post(
            f"/api/v1/jobs/{w['job']['id']}/applications", headers=w["headers"], json=payload()
        )
    ).status_code == 409


async def test_required_screening_answers_and_question_snapshots(client, marketplace):
    w = marketplace
    config = [
        {"key": "notice_period", "required": True},
        {"key": "remote_comfort", "required": True},
        {"key": "relevant_experience", "required": False},
    ]
    response = await client.patch(
        f"{w['base']}/{w['job']['id']}", headers=w["headers"], json={"screening_questions": config}
    )
    assert response.status_code == 200, response.text
    ctx = (
        await client.get(f"/api/v1/jobs/{w['job']['id']}/application-context", headers=hdr(w))
    ).json()
    assert ctx["questions"][0]["prompt"] == "What is your notice period?"
    await apply(client, w, expect=422)
    for answers in [
        [{"key": "notice_period", "value": "bad"}],
        [{"key": "remote_comfort", "value": "yes"}, {"key": "notice_period", "value": "30_days"}],
        [
            {"key": "notice_period", "value": "30_days"},
            {"key": "notice_period", "value": "30_days"},
        ],
        [{"key": "work_authorization", "value": True}],
    ]:
        await apply(client, w, expect=422, screening_answers=answers)
    answers = [
        {"key": "notice_period", "value": "30_days"},
        {"key": "remote_comfort", "value": False},
    ]
    row = await apply(client, w, screening_answers=answers)
    assert row["screening_answers"][1]["value"] is False
    await client.patch(
        f"{w['base']}/{w['job']['id']}", headers=w["headers"], json={"screening_questions": []}
    )
    assert (await client.get(f"/api/v1/applications/{row['id']}", headers=hdr(w))).json()[
        "screening_answers"
    ] == row["screening_answers"]
    assert (await apply(client, w, expect=200, screening_answers=list(reversed(answers))))[
        "id"
    ] == row["id"]


@pytest.mark.parametrize(
    "changes",
    [
        {"screening_questions": [{"key": "gender"}]},
        {"screening_questions": [{"key": "remote_comfort", "prompt": "What is your religion?"}]},
        {"screening_questions": [{"key": "remote_comfort"}, {"key": "remote_comfort"}]},
        {"screening_questions": None},
        {"application_deadline": "2026-12-01T12:00:00"},
    ],
)
async def test_job_config_rejects_custom_or_invalid_questions(client, marketplace, changes):
    w = marketplace
    assert (
        await client.patch(f"{w['base']}/{w['job']['id']}", headers=w["headers"], json=changes)
    ).status_code == 422


@pytest.mark.parametrize(
    "file_state",
    [
        "ready",
        "foreign",
        "org",
        "pending",
        "infected",
        "deleted",
        "purged",
        "wrong_kind",
        "missing",
    ],
)
async def test_resume_reference_boundary(client, marketplace, db_session, file_state):
    w = marketplace
    user = (
        await db_session.execute(select(User).where(User.primary_email == w["candidate"]["email"]))
    ).scalar_one()
    id_ = uuid.uuid4()
    if file_state != "missing":
        file = File(
            id=id_,
            uploaded_by=user.id,
            kind="resume",
            file_name="resume.pdf",
            storage_key=f"personal/{user.id}/{id_}/resume.pdf",
            mime_type="application/pdf",
            byte_size=10,
            scan_status="clean",
            upload_status="ready",
            scanned_at=datetime.now(UTC),
            confirmed_at=datetime.now(UTC),
            checksum_sha256="a" * 64,
            upload_expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        if file_state == "foreign":
            file.uploaded_by = uuid.UUID(w["user_id"])
            file.storage_key = f"personal/{w['user_id']}/{id_}/resume.pdf"
        if file_state == "org":
            file.owner_org_id = uuid.UUID(w["org"]["id"])
        if file_state == "pending":
            file.upload_status = "pending"
        if file_state == "infected":
            file.scan_status = "infected"
            file.upload_status = "rejected"
        if file_state == "deleted":
            file.deleted_at = datetime.now(UTC)
        if file_state == "purged":
            file.purged_at = datetime.now(UTC)
        if file_state == "wrong_kind":
            file.kind = "document"
        db_session.add(file)
        await db_session.commit()
    result = await apply(
        client, w, expect=201 if file_state == "ready" else 422, resume_file_id=str(id_)
    )
    if file_state == "ready":
        assert result["resume_file_id"] == str(id_)
    else:
        assert result["error"]["details"][0]["loc"] == ["body", "resume_file_id"]


@pytest.mark.parametrize("stage", ["rejected", "hired"])
async def test_terminal_cannot_withdraw(client, marketplace, db_session, stage):
    w = marketplace
    row = await apply(client, w)
    stored = await db_session.get(JobApplication, uuid.UUID(row["id"]))
    stored.stage = stage
    await db_session.commit()
    assert (
        await client.post(f"/api/v1/applications/{row['id']}/withdraw", headers=hdr(w))
    ).status_code == 409


async def test_rate_limits_and_no_duplicate_events(client, marketplace, monkeypatch, db_session):
    w = marketplace
    monkeypatch.setattr(get_settings(), "APPLICATION_SUBMIT_LIMIT", 1)
    row = await apply(client, w)
    await apply(client, w, expect=200)
    another = await new_job(client, w)
    await action(client, w, another, "publish")
    await apply(client, {**w, "job": another}, expect=429)
    monkeypatch.setattr(get_settings(), "APPLICATION_WITHDRAW_LIMIT", 0)
    assert (
        await client.post(f"/api/v1/applications/{row['id']}/withdraw", headers=hdr(w))
    ).status_code == 429
    assert (
        await db_session.execute(select(func.count()).select_from(ApplicationStageEvent))
    ).scalar_one() == 1


async def test_body_limit_and_query_validation(client, marketplace):
    w = marketplace
    result = await client.post(
        f"/api/v1/jobs/{w['job']['id']}/applications",
        headers={**hdr(w), "content-type": "application/json"},
        content="x" * (65536 + 1),
    )
    assert result.status_code == 413
    for query in [{"limit": 101}, {"offset": -1}, {"stage": "forged"}]:
        assert (
            await client.get("/api/v1/applications", headers=hdr(w), params=query)
        ).status_code == 422


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"), reason="Real row-lock race requires PostgreSQL"
)
async def test_concurrent_identical_submission_and_withdrawal(client, marketplace, db_session):
    w = marketplace
    path = f"/api/v1/jobs/{w['job']['id']}/applications"
    results = await asyncio.gather(
        *[client.post(path, headers=hdr(w), json=payload()) for _ in range(2)]
    )
    assert sorted(r.status_code for r in results) == [200, 201], [r.text for r in results]
    assert results[0].json()["id"] == results[1].json()["id"]
    id_ = results[0].json()["id"]
    results = await asyncio.gather(
        *[client.post(f"/api/v1/applications/{id_}/withdraw", headers=hdr(w)) for _ in range(2)]
    )
    assert all(r.status_code == 200 for r in results)
    assert (
        await db_session.execute(select(func.count()).select_from(ApplicationStageEvent))
    ).scalar_one() == 2


async def test_contact_overrides_are_application_only(client, marketplace, db_session):
    w = marketplace
    before = (await client.get("/api/v1/users/me", headers=hdr(w))).json()
    submitted = {
        "name": "Application name",
        "email": "contact@example.com",
        "phone": "+919999999999",
        "portfolio_url": "https://example.com/portfolio",
    }
    row = await apply(client, w, contact=submitted)
    assert row["profile_snapshot"]["contact"]["email"] == "contact@example.com"
    assert (await client.get("/api/v1/users/me", headers=hdr(w))).json() == before


async def test_link_only_application_is_allowed_but_not_discoverable(client, marketplace):
    w = marketplace
    await client.patch(
        f"{w['base']}/{w['job']['id']}", headers=w["headers"], json={"visibility": "link_only"}
    )
    assert (await client.get("/api/v1/jobs", headers=hdr(w))).json()["total"] == 0
    assert (await apply(client, w))["stage"] == "applied"


async def test_startup_job_accepts_external_applicant(client, marketplace):
    from app.tests.test_funding_rounds import _create_org

    w = marketplace
    owner = await _signup_verified(client, "startup@apply.dev", "startup")
    org = await _create_org(client, owner)
    workspace = {"base": f"/api/v1/organizations/{org['id']}/jobs", "headers": owner["headers"]}
    job = await new_job(client, workspace)
    await action(client, workspace, job, "publish")
    row = await apply(client, {**w, "job": job})
    assert row["job_snapshot"]["org_id"] == org["id"]


@pytest.mark.parametrize("role", ["admin", "member", "viewer"])
async def test_new_job_settings_keep_existing_write_boundary(client, marketplace, role):
    w = marketplace
    teammate = await _signup_verified(client, f"{role}@settings.dev", "employer")
    await _invite_member(client, w["actor"], teammate, w["org"], role=role)
    result = await client.patch(
        f"{w['base']}/{w['job']['id']}",
        headers=teammate["headers"],
        json={
            "screening_questions": [{"key": "remote_comfort"}],
            "application_deadline": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        },
    )
    assert result.status_code == (200 if role == "admin" else 403)


@pytest.mark.parametrize("state", ["revoked", "suspended", "unverified"])
async def test_ineligible_account_cannot_submit(client, marketplace, db_session, state):
    w = marketplace
    user = (
        await db_session.execute(select(User).where(User.primary_email == w["candidate"]["email"]))
    ).scalar_one()
    if state == "revoked":
        role = (
            await db_session.execute(select(UserRoleRow).where(UserRoleRow.user_id == user.id))
        ).scalar_one()
        role.revoked_at = datetime.now(UTC)
    elif state == "suspended":
        user.status = "suspended"
    else:
        user.email_verified_at = None
    await db_session.commit()
    await apply(client, w, expect=403)


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"), reason="Native PostgreSQL locking"
)
async def test_close_and_submission_serialize(client, marketplace, db_session):
    w = marketplace
    submission, closing = await asyncio.gather(
        client.post(f"/api/v1/jobs/{w['job']['id']}/applications", headers=hdr(w), json=payload()),
        client.post(f"{w['base']}/{w['job']['id']}/close", headers=w["headers"]),
    )
    assert closing.status_code == 200
    assert submission.status_code in (201, 409), submission.text
    stored = await db_session.get(Job, uuid.UUID(w["job"]["id"]))
    assert stored.status == "closed"
    count = (
        await db_session.execute(select(func.count()).select_from(JobApplication))
    ).scalar_one()
    assert count == (1 if submission.status_code == 201 else 0)
    assert (
        await db_session.execute(select(func.count()).select_from(ApplicationStageEvent))
    ).scalar_one() == count
