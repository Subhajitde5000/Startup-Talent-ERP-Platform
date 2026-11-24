"""7d contracts/security with real auth and organization/application fixtures."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.main import create_app
from app.models.activity import ActivityEvent
from app.models.application_note import ApplicationNote
from app.models.file import File
from app.models.job import Job
from app.models.job_application import ApplicationStageEvent, JobApplication
from app.models.organization import Organization, OrganizationMember
from app.models.user import User, UserRoleRow
from app.tests.conftest import TEST_DATABASE_URL
from app.tests.test_funding_rounds import _create_org, _invite_member, _signup_verified
from app.tests.test_job_applications import apply
from app.tests.test_job_discovery import hdr, marketplace
from app.tests.test_jobs import action, jobs_workspace, new_job

__all__ = ["jobs_workspace", "marketplace"]


def base(w):
    return f"{w['base']}/{w['job']['id']}"


def path(w):
    return f"{base(w)}/applications/{w['app']['id']}"


@pytest_asyncio.fixture
async def pipeline(client, marketplace):
    return {**marketplace, "app": await apply(client, marketplace)}


async def member(client, w, *, role="member", global_role="employer", email=None):
    actor = await _signup_verified(client, email or f"pipeline-{role}@example.com", global_role)
    await _invite_member(client, w["actor"], actor, w["org"], role)
    actor["id"] = (await client.get("/api/v1/users/me", headers=actor["headers"])).json()["id"]
    return actor


async def move(client, w, stage, expected_stage="applied", headers=None, **extra):
    return await client.patch(
        path(w),
        headers=headers or w["headers"],
        json={"stage": stage, "expected_stage": expected_stage, **extra},
    )


async def test_pipeline_projection_stage_history_and_rejection_privacy(
    client, pipeline, db_session
):
    w = pipeline
    read = await client.get(path(w), headers=w["headers"])
    assert read.status_code == 200, read.text
    row = read.json()
    assert row["profile"]["contact"]["email"] == w["candidate"]["email"]
    assert row["is_blind"] is False and row["resume_available"] is False
    for key in (
        "applicant_id",
        "profile_snapshot",
        "job_snapshot",
        "submission_fingerprint",
        "resume_file_id",
    ):
        assert key not in row
    assert (await move(client, w, "review")).status_code == 200
    stale = await move(client, w, "interview")
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "STALE_STAGE"
    rejected = await move(
        client,
        w,
        "rejected",
        "review",
        rejected_reason="other",
        rejection_detail="Internal Zebra reason",
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["rejected_reason"] == "other: Internal Zebra reason"
    assert rejected.json()["rejected_at"]
    history = (await client.get(path(w) + "/stage-events", headers=w["headers"])).json()
    assert history["total"] == 3 and history["items"][-1]["to_stage"] == "rejected"
    assert "Zebra" not in str(history) and "actor_id" not in str(history)
    for suffix in ("", "/stage-events"):
        own = await client.get(f"/api/v1/applications/{w['app']['id']}{suffix}", headers=hdr(w))
        assert own.status_code == 200 and "Zebra" not in own.text
        assert "rejected_reason" not in own.text
    events = (
        (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.org_id == uuid.UUID(w["org"]["id"]),
                    ActivityEvent.event_type == "application_stage_changed",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 2 and all("Zebra" not in str(e.data) + e.summary for e in events)
    assert (await move(client, w, "review", "rejected")).status_code == 409


@pytest.mark.parametrize("role,expected", [("admin", 200), ("member", 404), ("viewer", 403)])
async def test_membership_roles_and_scoped_lists(client, pipeline, role, expected):
    w = pipeline
    actor = await member(client, w, role=role)
    response = await client.get(path(w), headers=actor["headers"])
    assert response.status_code == expected, response.text
    page = await client.get(base(w) + "/applications", headers=actor["headers"])
    assert page.status_code == (403 if role == "viewer" else 200)
    if role != "viewer":
        assert page.json()["total"] == (1 if role == "admin" else 0)
        assert page.json()["stage_counts"] == ({"applied": 1} if role == "admin" else {})


async def test_assignment_job_owner_and_revoked_access(client, pipeline, db_session):
    w = pipeline
    actor = await member(client, w)
    assigned = await client.patch(path(w), headers=w["headers"], json={"assignee_id": actor["id"]})
    assert assigned.status_code == 200, assigned.text
    assert (await client.get(path(w), headers=actor["headers"])).status_code == 200
    assert (await move(client, w, "review", headers=actor["headers"])).status_code == 403
    assert (
        await client.patch(path(w), headers=actor["headers"], json={"assignee_id": None})
    ).status_code == 403
    # Existing job owner reference is reused; a job-owning member may review stages.
    response = await client.patch(base(w), headers=w["headers"], json={"owner_id": actor["id"]})
    assert response.status_code == 200
    assert (await move(client, w, "review", headers=actor["headers"])).status_code == 200
    assert (
        await client.patch(
            base(w) + "/review-settings",
            headers=actor["headers"],
            json={"blind_review_enabled": True},
        )
    ).status_code == 403
    membership = (
        await db_session.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == uuid.UUID(w["org"]["id"]),
                OrganizationMember.user_id == uuid.UUID(actor["id"]),
            )
        )
    ).scalar_one()
    membership.status = "deactivated"
    await db_session.commit()
    assert (await client.get(path(w), headers=actor["headers"])).status_code == 403


@pytest.mark.parametrize("global_role", ["jobseeker", "investor", "mentor", "startup"])
async def test_org_membership_does_not_replace_hiring_role(
    client, pipeline, db_session, global_role
):
    w = pipeline
    actor = await member(client, w, role="admin", global_role=global_role)
    # Invite acceptance intentionally grants the organization's global role. Revoke it
    # to exercise membership-without-role rather than assume registration role is sole.
    hiring_role = (
        await db_session.execute(
            select(UserRoleRow).where(
                UserRoleRow.user_id == uuid.UUID(actor["id"]), UserRoleRow.role == "employer"
            )
        )
    ).scalar_one()
    hiring_role.revoked_at = datetime.now(UTC)
    await db_session.commit()
    assert (await client.get(path(w), headers=actor["headers"])).status_code == 403
    assert (
        await client.get(base(w) + "/applications", headers=actor["headers"])
    ).status_code == 403


async def test_revoked_global_role_denied(client, pipeline, db_session):
    w = pipeline
    role = (
        await db_session.execute(
            select(UserRoleRow).where(
                UserRoleRow.user_id == uuid.UUID(w["user_id"]),
                UserRoleRow.role == "employer",
            )
        )
    ).scalar_one()
    role.revoked_at = datetime.now(UTC)
    db_session.add(UserRoleRow(user_id=uuid.UUID(w["user_id"]), role="admin", is_primary=False))
    await db_session.commit()
    assert (await client.get(path(w), headers=w["headers"])).status_code == 403


@pytest.mark.parametrize(
    "method,suffix,payload",
    [
        ("get", "/applications", None),
        ("get", "/applications/{app}", None),
        ("patch", "/applications/{app}", {"stage": "review", "expected_stage": "applied"}),
        ("get", "/applications/{app}/stage-events", None),
        ("get", "/applications/{app}/notes", None),
        ("post", "/applications/{app}/notes", {"body": "private"}),
        ("delete", "/applications/{app}/notes/{note}", None),
        ("patch", "/review-settings", {"blind_review_enabled": True}),
        ("post", "/applications/{app}/resume-download", {}),
    ],
)
async def test_every_route_requires_auth(client, method, suffix, payload):
    suffix = suffix.format(app=uuid.uuid4(), note=uuid.uuid4())
    response = await client.request(
        method, f"/api/v1/organizations/{uuid.uuid4()}/jobs/{uuid.uuid4()}{suffix}", json=payload
    )
    assert response.status_code == 401, response.text


async def test_wrong_org_job_and_application_references(client, pipeline):
    w = pipeline
    outsider = await _signup_verified(client, "pipeline-outsider@example.com", "employer")
    assert (await client.get(path(w), headers=outsider["headers"])).status_code == 403
    assert (await client.get(path(w), headers=hdr(w))).status_code == 403
    other_job = await new_job(client, w)
    wrong_job = f"{w['base']}/{other_job['id']}/applications/{w['app']['id']}"
    for suffix in ("", "/stage-events", "/notes"):
        assert (await client.get(wrong_job + suffix, headers=w["headers"])).status_code == 404
    org = await _create_org(client, outsider, type_="employer")
    wrong_org = path(w).replace(w["org"]["id"], org["id"])
    assert (await client.get(wrong_org, headers=outsider["headers"])).status_code == 404
    assert (
        await client.patch(
            wrong_org,
            headers=outsider["headers"],
            json={"stage": "review", "expected_stage": "applied"},
        )
    ).status_code == 404
    for assignee in (str(uuid.uuid4()), w["app"].get("applicant_id", w["user_id"])):
        # Random reference must fail; the existing owner remains an eligible assignee.
        response = await client.patch(path(w), headers=w["headers"], json={"assignee_id": assignee})
        assert response.status_code == (200 if assignee == w["user_id"] else 422)
    response = await client.patch(
        path(w),
        headers=w["headers"],
        json={
            "assignee_id": (
                await client.get("/api/v1/users/me", headers=outsider["headers"])
            ).json()["id"]
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["loc"] == ["body", "assignee_id"]


@pytest.mark.parametrize("role,global_role", [("viewer", "employer"), ("member", "jobseeker")])
async def test_ineligible_assignee(client, pipeline, db_session, role, global_role):
    w = pipeline
    actor = await member(client, w, role=role, global_role=global_role)
    if global_role != "employer":
        hiring_role = (
            await db_session.execute(
                select(UserRoleRow).where(
                    UserRoleRow.user_id == uuid.UUID(actor["id"]), UserRoleRow.role == "employer"
                )
            )
        ).scalar_one()
        hiring_role.revoked_at = datetime.now(UTC)
        await db_session.commit()
    response = await client.patch(path(w), headers=w["headers"], json={"assignee_id": actor["id"]})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"stage": "review"},
        {"stage": None},
        {"stage": "hired", "expected_stage": "applied"},
        {"stage": "offered", "expected_stage": "applied"},
        {"stage": "withdrawn", "expected_stage": "applied"},
        {"stage": "rejected", "expected_stage": "applied"},
        {"stage": "rejected", "expected_stage": "applied", "rejected_reason": "other"},
        {"stage": "review", "expected_stage": "applied", "rejected_reason": "timing"},
        {"assignee_id": "not-uuid"},
        {"expected_stage": "applied", "assignee_id": None},
        {"is_blind": False},
        {"applicant_id": str(uuid.uuid4())},
        {"salary_expectation": "1"},
        {"rating": 5},
        {"rejected_at": "2026-11-23T00:00:00Z"},
        {"profile_snapshot": {}},
        {"stage_changed_at": "2026-11-23T00:00:00Z"},
    ],
)
async def test_patch_validation_and_mass_assignment(client, pipeline, payload):
    w = pipeline
    assert (await client.patch(path(w), headers=w["headers"], json=payload)).status_code == 422
    assert (await client.get(path(w), headers=w["headers"])).json()["stage"] == "applied"


async def test_atomic_invalid_assignment_does_not_move_or_append_history(client, pipeline):
    w = pipeline
    response = await move(client, w, "interview", assignee_id=str(uuid.uuid4()))
    assert response.status_code == 422
    assert (await client.get(path(w), headers=w["headers"])).json()["stage"] == "applied"
    assert (await client.get(path(w) + "/stage-events", headers=w["headers"])).json()["total"] == 1


async def test_private_notes_author_isolation_scoped_delete_and_audit(client, pipeline, db_session):
    w = pipeline
    admin = await member(client, w, role="admin")
    notes_path = path(w) + "/notes"
    note = await client.post(notes_path, headers=w["headers"], json={"body": "  Private Zebra  "})
    assert note.status_code == 201, note.text
    note = note.json()
    assert note["body"] == "Private Zebra" and note["author_id"] == w["user_id"]
    assert (await client.get(notes_path, headers=admin["headers"])).json()["total"] == 0
    assert (
        await client.delete(notes_path + "/" + note["id"], headers=admin["headers"])
    ).status_code == 404
    another_candidate = await _signup_verified(client, "another-pipeline@example.com", "jobseeker")
    other = await apply(client, {**w, "candidate": another_candidate})
    wrong_app_path = notes_path.replace(w["app"]["id"], other["id"])
    assert (
        await client.delete(wrong_app_path + "/" + note["id"], headers=w["headers"])
    ).status_code == 404
    for _ in range(2):
        assert (
            await client.delete(notes_path + "/" + note["id"], headers=w["headers"])
        ).status_code == 204
    assert (await client.get(notes_path, headers=w["headers"])).json()["total"] == 0
    stored = await db_session.get(ApplicationNote, uuid.UUID(note["id"]))
    assert stored.deleted_at and stored.body == "Private Zebra"
    events = (
        (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.event_type.in_(
                        ["application_note_created", "application_note_deleted"]
                    )
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 2 and all("Zebra" not in e.summary + str(e.data) for e in events)
    assert all(e.entity_id == uuid.UUID(w["app"]["id"]) for e in events)
    own = await client.get(f"/api/v1/applications/{w['app']['id']}", headers=hdr(w))
    assert "Zebra" not in own.text and "notes" not in own.json()


@pytest.mark.parametrize(
    "payload",
    [
        {"body": " "},
        {"body": "x" * 5001},
        {"body": 4},
        {"body": "test", "author_id": str(uuid.uuid4())},
        {"body": "test", "application_id": str(uuid.uuid4())},
        {"body": "test", "is_private": False},
        {"body": "test", "id": str(uuid.uuid4())},
    ],
)
async def test_note_validation(client, pipeline, payload):
    w = pipeline
    assert (
        await client.post(path(w) + "/notes", headers=w["headers"], json=payload)
    ).status_code == 422


async def test_applicant_and_note_pagination_filters_and_literal_search(client, pipeline):
    w = pipeline
    second = await _signup_verified(client, "pipeline-second@example.com", "jobseeker")
    row2 = await apply(client, {**w, "candidate": second})
    await move(client, {**w, "app": row2}, "review")
    listing = base(w) + "/applications"
    page = (
        await client.get(listing, headers=w["headers"], params={"limit": 1, "sort": "oldest"})
    ).json()
    assert page["total"] == 2 and page["has_more"] and len(page["items"]) == 1
    page2 = (
        await client.get(
            listing, headers=w["headers"], params={"limit": 1, "offset": 1, "sort": "oldest"}
        )
    ).json()
    assert not page2["has_more"]
    assert {page["items"][0]["id"], page2["items"][0]["id"]} == {w["app"]["id"], row2["id"]}
    filtered = (await client.get(listing, headers=w["headers"], params={"stage": "review"})).json()
    assert filtered["total"] == 1 and filtered["stage_counts"] == {"applied": 1, "review": 1}
    for q, total in (("Pipeline-Second", 1), ("%", 0), ("' OR 1=1--", 0)):
        assert (await client.get(listing, headers=w["headers"], params={"q": q})).json()[
            "total"
        ] == total
    assert (await client.get(listing, headers=w["headers"], params={"source": "agency"})).json()[
        "total"
    ] == 0
    for index in range(3):
        await client.post(path(w) + "/notes", headers=w["headers"], json={"body": f"Note {index}"})
    notes = (await client.get(path(w) + "/notes?limit=2", headers=w["headers"])).json()
    assert notes["total"] == 3 and notes["has_more"] and len(notes["items"]) == 2
    assert (await client.get(path(w) + "/notes?limit=2&offset=2", headers=w["headers"])).json()[
        "has_more"
    ] is False


async def test_blind_projection_search_reveal_and_locked_settings(client, marketplace, db_session):
    w = marketplace
    job_path = base(w)
    configured = await client.patch(
        job_path + "/review-settings", headers=w["headers"], json={"blind_review_enabled": True}
    )
    assert configured.status_code == 200 and configured.json()["locked"] is False
    assert (await client.get(job_path, headers=w["headers"])).json()["blind_review_enabled"] is True
    # Contact, links and all candidate-authored free text may identify someone.
    await client.patch(
        job_path,
        headers=w["headers"],
        json={
            "screening_questions": [
                {"key": "relevant_experience"},
                {"key": "remote_comfort"},
                {"key": "notice_period"},
            ]
        },
    )
    w = {
        **w,
        "app": await apply(
            client,
            w,
            contact={
                "name": "Zebra Person",
                "email": "zebra@example.com",
                "portfolio_url": "https://example.com/zebra",
            },
            cover_note="Zebra School",
            screening_answers=[
                {"key": "relevant_experience", "value": "Zebra University"},
                {"key": "remote_comfort", "value": False},
                {"key": "notice_period", "value": "immediate"},
            ],
            salary_expectation="1000000.25",
        ),
    }
    stored = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
    assert stored.is_blind
    for suffix in (f"/applications/{w['app']['id']}", "/applications"):
        response = await client.get(job_path + suffix, headers=w["headers"])
        assert response.status_code == 200 and "Zebra" not in response.text
        row = response.json() if suffix != "/applications" else response.json()["items"][0]
        assert row["is_blind"] and row["profile"] is None and row["cover_note"] is None
        assert row["salary_expectation"] == "1000000.25"
        assert [a["value"] for a in row["screening_answers"]] == [False, "immediate"]
        assert "resume_file_id" not in row and row["resume_available"] is False
    for q in ("Zebra", "%", "Person"):
        listing = await client.get(
            job_path + "/applications", headers=w["headers"], params={"q": q}
        )
        assert listing.json()["total"] == 0 and listing.json()["stage_counts"] == {}
    assert (
        await client.post(path(w) + "/resume-download", headers=w["headers"], json={})
    ).status_code == 403
    assert (
        await client.patch(
            job_path + "/review-settings",
            headers=w["headers"],
            json={"blind_review_enabled": False},
        )
    ).status_code == 409
    assert (
        await client.patch(
            job_path + "/review-settings", headers=w["headers"], json={"blind_review_enabled": True}
        )
    ).json()["locked"] is True
    assert (await move(client, w, "shortlisted")).json()["is_blind"] is True
    revealed = await move(client, w, "interview", "shortlisted")
    assert revealed.status_code == 200 and revealed.json()["is_blind"] is False
    assert revealed.json()["profile"]["contact"]["name"] == "Zebra Person"
    assert (await move(client, w, "review", "interview")).json()["is_blind"] is False


async def test_rejected_before_interview_remains_blind(client, marketplace):
    w = marketplace
    await client.patch(
        base(w) + "/review-settings", headers=w["headers"], json={"blind_review_enabled": True}
    )
    w = {**w, "app": await apply(client, w)}
    response = await move(client, w, "rejected", rejected_reason="timing")
    assert response.status_code == 200 and response.json()["is_blind"] is True
    assert response.json()["profile"] is None


async def test_deleted_application_still_locks_review_settings(client, pipeline, db_session):
    w = pipeline
    row = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
    row.deleted_at = datetime.now(UTC)
    await db_session.commit()
    assert (
        await client.patch(
            base(w) + "/review-settings", headers=w["headers"], json={"blind_review_enabled": True}
        )
    ).status_code == 409
    assert (await client.get(path(w), headers=w["headers"])).status_code == 404


@pytest.mark.parametrize("state", ["closed", "archived", "withdrawn", "rejected", "hired"])
async def test_readonly_pipelines_and_terminal_applications(client, pipeline, db_session, state):
    w = pipeline
    if state in {"closed", "archived"}:
        await action(client, w, w["job"], "close")
        if state == "archived":
            await action(client, w, w["job"], "archive")
    elif state == "withdrawn":
        await client.post(f"/api/v1/applications/{w['app']['id']}/withdraw", headers=hdr(w))
    elif state == "rejected":
        await move(client, w, "rejected", rejected_reason="timing")
    else:
        stored = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
        stored.stage = "hired"
        await db_session.commit()
    assert (await client.get(path(w), headers=w["headers"])).status_code == 200
    assert (await client.get(base(w) + "/applications", headers=w["headers"])).status_code == 200
    assert (
        await move(client, w, "review", state if state not in {"closed", "archived"} else "applied")
    ).status_code == 409
    assert (
        await client.post(path(w) + "/notes", headers=w["headers"], json={"body": "test"})
    ).status_code == 409


async def test_paused_job_review_allowed(client, pipeline):
    w = pipeline
    await action(client, w, w["job"], "pause")
    assert (await move(client, w, "review")).status_code == 200


@pytest.mark.parametrize("state", ["suspended", "deleted"])
async def test_inactive_organization_denied(client, pipeline, db_session, state):
    w = pipeline
    org = await db_session.get(Organization, uuid.UUID(w["org"]["id"]))
    if state == "deleted":
        org.deleted_at = datetime.now(UTC)
    else:
        org.status = "suspended"
    await db_session.commit()
    assert (await client.get(path(w), headers=w["headers"])).status_code == 404


async def test_rates_input_limits_and_openapi(client, pipeline, monkeypatch):
    w = pipeline
    for query in (
        "limit=101",
        "limit=0",
        "offset=-1",
        "sort=rating",
        "source=madeup",
        "q=" + "x" * 101,
    ):
        assert (
            await client.get(base(w) + "/applications?" + query, headers=w["headers"])
        ).status_code == 422
    assert (
        await client.post(path(w) + "/notes", headers=w["headers"], content=b"x" * 32769)
    ).status_code == 413
    for value in (1, "true", None):
        assert (
            await client.patch(
                base(w) + "/review-settings",
                headers=w["headers"],
                json={"blind_review_enabled": value},
            )
        ).status_code == 422
    assert (
        await client.patch(base(w), headers=w["headers"], json={"blind_review_enabled": True})
    ).status_code == 422
    monkeypatch.setattr(get_settings(), "APPLICANT_READ_LIMIT", 1)
    assert (await client.get(path(w), headers=w["headers"])).status_code == 200
    assert (await client.get(path(w), headers=w["headers"])).status_code == 429
    monkeypatch.setattr(get_settings(), "APPLICANT_WRITE_LIMIT", 1)
    assert (
        await client.post(path(w) + "/notes", headers=w["headers"], json={"body": "first"})
    ).status_code == 201
    assert (
        await client.post(path(w) + "/notes", headers=w["headers"], json={"body": "second"})
    ).status_code == 429
    schema = create_app().openapi()
    operations = [
        operation
        for item in schema["paths"].values()
        for operation in item.values()
        if isinstance(operation, dict) and "applicant-pipeline" in operation.get("tags", [])
    ]
    assert len(operations) == 9
    assert all(
        all(str(code) in op["responses"] for code in (401, 403, 404, 409, 413, 422, 429))
        for op in operations
    )


async def test_startup_hiring_uses_same_api_without_employer_role(client):
    owner = await _signup_verified(client, "pipeline-founder@example.com", "startup")
    org = await _create_org(client, owner)
    w = {"base": f"/api/v1/organizations/{org['id']}/jobs", "headers": owner["headers"]}
    job = await new_job(client, w)
    await action(client, w, job, "publish")
    candidate = await _signup_verified(
        client, "pipeline-startup-candidate@example.com", "jobseeker"
    )
    w = {**w, "job": job, "candidate": candidate}
    w["app"] = await apply(client, w)
    assert (await client.get(path(w), headers=w["headers"])).status_code == 200
    assert (await move(client, w, "review")).status_code == 200


@pytest.mark.parametrize(
    "state", ["ready", "infected", "pending", "deleted", "purged", "foreign", "org", "wrong_kind"]
)
async def test_resume_scope_readiness_and_generic_file_access(
    client, marketplace, db_session, state
):
    w = marketplace
    candidate = (
        await db_session.execute(select(User).where(User.primary_email == w["candidate"]["email"]))
    ).scalar_one()
    file_id = uuid.uuid4()
    file = File(
        id=file_id,
        uploaded_by=candidate.id,
        kind="resume",
        file_name="private.pdf",
        storage_key=f"personal/{candidate.id}/{file_id}/private.pdf",
        mime_type="application/pdf",
        byte_size=10,
        scan_status="clean",
        upload_status="ready",
        scanned_at=datetime.now(UTC),
        confirmed_at=datetime.now(UTC),
        checksum_sha256="a" * 64,
        upload_expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    db_session.add(file)
    await db_session.commit()
    w = {**w, "app": await apply(client, w, resume_file_id=str(file_id))}
    if state == "infected":
        file.scan_status = "infected"
        file.upload_status = "rejected"
    if state == "pending":
        file.upload_status = "pending"
    if state == "deleted":
        file.deleted_at = datetime.now(UTC)
    if state == "purged":
        file.purged_at = datetime.now(UTC)
    if state == "foreign":
        file.uploaded_by = uuid.UUID(w["user_id"])
    if state == "org":
        file.owner_org_id = uuid.UUID(w["org"]["id"])
    if state == "wrong_kind":
        file.kind = "document"
    await db_session.commit()
    response = await client.post(path(w) + "/resume-download", headers=w["headers"], json={})
    assert response.status_code == (200 if state == "ready" else 404), response.text
    assert (await client.get(path(w), headers=w["headers"])).json()["resume_available"] == (
        state == "ready"
    )
    if state == "ready":
        assert (
            response.json()["url"]
            and response.json()["expires_in"] == get_settings().FILE_DOWNLOAD_TTL_SECONDS
        )
        # No new blanket permission to candidate-owned files.
        assert (
            await client.get(f"/api/v1/files/{file_id}", headers=w["headers"])
        ).status_code == 404
        audit = (
            await db_session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.event_type == "application_resume_downloaded"
                )
            )
        ).scalar_one()
        assert audit.entity_id == uuid.UUID(w["app"]["id"]) and "private.pdf" not in str(audit.data)


async def test_note_database_constraint(db_session, pipeline):
    note = ApplicationNote(
        application_id=uuid.UUID(pipeline["app"]["id"]),
        author_id=uuid.UUID(pipeline["user_id"]),
        body=" ",
    )
    db_session.add(note)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"), reason="Real PostgreSQL row locks required"
)
async def test_concurrent_stage_writes_one_winner(client, pipeline, db_session):
    w = pipeline
    results = await asyncio.gather(move(client, w, "review"), move(client, w, "interview"))
    assert sorted(response.status_code for response in results) == [200, 409]
    count = (
        await db_session.execute(
            select(func.count())
            .select_from(ApplicationStageEvent)
            .where(ApplicationStageEvent.application_id == uuid.UUID(w["app"]["id"]))
        )
    ).scalar_one()
    assert count == 2


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"), reason="Real PostgreSQL row locks required"
)
async def test_settings_and_submit_serialize(client, marketplace, db_session):
    w = marketplace
    responses = await asyncio.gather(
        client.patch(
            base(w) + "/review-settings", headers=w["headers"], json={"blind_review_enabled": True}
        ),
        client.post(
            f"/api/v1/jobs/{w['job']['id']}/applications",
            headers=hdr(w),
            json={"accuracy_confirmed": True, "consent_share": True},
        ),
    )
    assert responses[0].status_code in (200, 409) and responses[1].status_code == 201
    row = (
        await db_session.execute(
            select(JobApplication).where(JobApplication.job_id == uuid.UUID(w["job"]["id"]))
        )
    ).scalar_one()
    job = await db_session.get(Job, uuid.UUID(w["job"]["id"]))
    assert row.is_blind == job.blind_review_enabled


async def test_all_actions_deny_viewer_and_nonmember(client, pipeline):
    w = pipeline
    viewer = await member(client, w, role="viewer")
    outsider = await _signup_verified(client, "pipeline-no-membership@example.com", "employer")
    operations = [
        ("GET", base(w) + "/applications", None),
        ("GET", path(w), None),
        ("PATCH", path(w), {"stage": "review", "expected_stage": "applied"}),
        ("GET", path(w) + "/stage-events", None),
        ("GET", path(w) + "/notes", None),
        ("POST", path(w) + "/notes", {"body": "not allowed"}),
        ("DELETE", path(w) + f"/notes/{uuid.uuid4()}", None),
        ("PATCH", base(w) + "/review-settings", {"blind_review_enabled": True}),
        ("POST", path(w) + "/resume-download", {}),
    ]
    for actor in (viewer, outsider):
        for method, url, payload in operations:
            response = await client.request(method, url, headers=actor["headers"], json=payload)
            assert response.status_code == 403, (method, url, response.text)


async def test_assigned_member_private_notes_and_scope_revocation(client, pipeline):
    w = pipeline
    actor = await member(client, w)
    assigned = await client.patch(path(w), headers=w["headers"], json={"assignee_id": actor["id"]})
    assert assigned.status_code == 200
    response = await client.post(
        path(w) + "/notes", headers=actor["headers"], json={"body": "Member's private note"}
    )
    assert response.status_code == 201
    assert (await client.get(path(w) + "/notes", headers=w["headers"])).json()["total"] == 0
    listing = (await client.get(base(w) + "/applications", headers=actor["headers"])).json()
    assert listing["total"] == 1 and listing["stage_counts"] == {"applied": 1}
    assert (
        await client.patch(path(w), headers=w["headers"], json={"assignee_id": None})
    ).status_code == 200
    for suffix in ("", "/notes", "/stage-events"):
        assert (await client.get(path(w) + suffix, headers=actor["headers"])).status_code == 404
    assert (
        await client.delete(path(w) + "/notes/" + response.json()["id"], headers=actor["headers"])
    ).status_code == 404


async def test_readonly_note_deletion_and_settings(client, pipeline):
    w = pipeline
    response = await client.post(
        path(w) + "/notes", headers=w["headers"], json={"body": "retain me"}
    )
    note_id = response.json()["id"]
    await action(client, w, w["job"], "close")
    assert (
        await client.delete(path(w) + f"/notes/{note_id}", headers=w["headers"])
    ).status_code == 409
    assert (
        await client.patch(
            base(w) + "/review-settings", headers=w["headers"], json={"blind_review_enabled": False}
        )
    ).status_code == 409
    assert (await client.get(path(w) + "/notes", headers=w["headers"])).json()["total"] == 1


async def test_offer_stage_reject_only_no_offer_workflow(client, pipeline, db_session):
    w = pipeline
    row = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
    row.stage = "offered"
    await db_session.commit()
    assert (await move(client, w, "review", "offered")).status_code == 409
    assert (
        await move(client, w, "rejected", "offered", rejected_reason="timing")
    ).status_code == 200


async def test_resume_payload_cannot_choose_another_file(client, pipeline):
    w = pipeline
    for key in ("file_id", "variant", "applicant_id", "is_blind"):
        response = await client.post(
            path(w) + "/resume-download", headers=w["headers"], json={key: str(uuid.uuid4())}
        )
        assert response.status_code == 422


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"), reason="Real PostgreSQL row locks required"
)
async def test_withdraw_and_review_serialize_without_reopening(client, pipeline, db_session):
    w = pipeline
    responses = await asyncio.gather(
        move(client, w, "interview"),
        client.post(f"/api/v1/applications/{w['app']['id']}/withdraw", headers=hdr(w)),
    )
    assert responses[0].status_code in (200, 409) and responses[1].status_code == 200
    row = await db_session.get(JobApplication, uuid.UUID(w["app"]["id"]))
    assert row.stage == "withdrawn"
    history = (await client.get(path(w) + "/stage-events", headers=w["headers"])).json()
    assert history["items"][-1]["to_stage"] == "withdrawn"


async def test_startup_multirole_hiring_guard_accepts_either_or_both_roles(client, db_session):
    owner = await _signup_verified(client, "pipeline-multirole@example.com", "startup")
    org = await _create_org(client, owner)
    identity = (await client.get("/api/v1/users/me", headers=owner["headers"])).json()
    db_session.add(
        UserRoleRow(user_id=uuid.UUID(identity["id"]), role="employer", is_primary=False)
    )
    await db_session.commit()
    w = {"base": f"/api/v1/organizations/{org['id']}/jobs", "headers": owner["headers"]}
    w["job"] = await new_job(client, w)
    response = await client.get(base(w) + "/applications", headers=w["headers"])
    assert response.status_code == 200 and response.json()["total"] == 0


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"),
    reason="PostgreSQL transaction timestamp semantics",
)
async def test_history_uses_mutation_time_not_waiting_transaction_start(
    client, pipeline, db_session
):
    from app.services import job_application_service

    w = pipeline
    # PostgreSQL now() stays at transaction start. An older withdrawal transaction
    # must not sort before a stage move that committed before its own mutation.
    await db_session.execute(select(func.now()))
    assert (await move(client, w, "review")).status_code == 200
    candidate = (
        await db_session.execute(select(User).where(User.primary_email == w["candidate"]["email"]))
    ).scalar_one()
    await job_application_service.withdraw(db_session, candidate, uuid.UUID(w["app"]["id"]))
    for url, headers in (
        (path(w) + "/stage-events", w["headers"]),
        (f"/api/v1/applications/{w['app']['id']}/stage-events", hdr(w)),
    ):
        response = await client.get(url, headers=headers)
        assert response.status_code == 200
        assert [row["to_stage"] for row in response.json()["items"]] == [
            "applied",
            "review",
            "withdrawn",
        ]
