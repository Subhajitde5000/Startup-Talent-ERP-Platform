"""Organization-scoped applicant review. All projections and author checks are server-side."""

import uuid
from datetime import UTC, datetime
from typing import cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_role
from app.core.exceptions import conflict, forbidden, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.application_note import ApplicationNote
from app.models.file import File
from app.models.job import Job
from app.models.job_application import ApplicationStageEvent, JobApplication
from app.models.organization import OrganizationMember, OrgRole, OrgType
from app.models.user import User, UserRole, UserRoleRow
from app.schemas.applicant_pipeline import (
    ApplicantPage,
    ApplicantRead,
    JobReviewContext,
    NoteCreate,
    NotePage,
    NoteRead,
    PipelinePatch,
    PipelineSort,
    ReviewSettingsPatch,
    ReviewSettingsRead,
)
from app.schemas.file import FileDownloadRead
from app.schemas.job_application import (
    AnswerSnapshot,
    ApplicationStage,
    ProfileSnapshot,
    StageEventPage,
    StageEventRead,
)
from app.schemas.job_screening import CATALOGUE, questions
from app.services import activity_service, file_service, job_service, organization_service
from app.services.rate_limiter import rate_limiter
from app.services.storage_service import Storage

MANAGERS = {OrgRole.owner, OrgRole.admin}
_EMPLOYER = require_role(UserRole.employer)
_STARTUP_HIRING = require_role(UserRole.employer, UserRole.startup)
TERMINAL = {"withdrawn", "rejected", "hired"}


async def authorize(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False
) -> OrganizationMember:
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    member = await organization_service.require_membership(
        db, org.id, user, roles={*MANAGERS, OrgRole.member}
    )
    settings = get_settings()
    maximum = settings.APPLICANT_WRITE_LIMIT if write else settings.APPLICANT_READ_LIMIT
    action = "write" if write else "read"
    if not await rate_limiter.check(f"applicant_{action}:{user.id}", maximum, 60):
        raise rate_limited("Too many applicant operations. Please try again later.")
    return member


async def scoped(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    *,
    write: bool = False,
) -> tuple[OrganizationMember, Job, JobApplication]:
    member = await authorize(db, user, org_id, write=write)
    # Same lock order as job settings/application submission: job, then application.
    job = await job_service._job(db, org_id, job_id, lock=write, include_archived=True)
    stmt = select(JobApplication).where(
        JobApplication.id == application_id,
        JobApplication.job_id == job.id,
        JobApplication.deleted_at.is_(None),
    )
    if member.role not in MANAGERS and job.owner_id != user.id:
        stmt = stmt.where(JobApplication.assignee_id == user.id)
    if write:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Application not found.")
    return member, job, row


def writable(job: Job, row: JobApplication | None = None) -> None:
    if job.deleted_at is not None or job.status == "closed":
        raise conflict("This job's pipeline is read-only.", "PIPELINE_READ_ONLY")
    if row is not None and row.stage in TERMINAL:
        raise conflict("This application is read-only.", "APPLICATION_READ_ONLY")


def audit(
    db: AsyncSession,
    user: User,
    job: Job,
    event: ActivityEventType,
    entity_id: uuid.UUID,
    *,
    entity_type: str = "application",
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=event.value.replace("_", " ").capitalize() + ".",
        org_id=job.org_id,
        actor_id=user.id,
        entity_type=entity_type,
        entity_id=entity_id,
    )


def ready_resume(row: JobApplication, file: File | None) -> bool:
    return bool(
        file is not None
        and file.id == row.resume_file_id
        and file.uploaded_by == row.applicant_id
        and file.owner_org_id is None
        and file.storage_key.startswith(f"personal/{row.applicant_id}/")
        and file.kind == "resume"
        and file.deleted_at is None
        and file.purged_at is None
        and file.upload_status == "ready"
        and file.scan_status == "clean"
    )


async def review_context(db: AsyncSession, job: Job) -> JobReviewContext:
    locked = bool(
        (
            await db.execute(
                select(JobApplication.id).where(JobApplication.job_id == job.id).limit(1)
            )
        ).first()
    )
    return JobReviewContext(
        id=job.id,
        title=job.title,
        status=job.status,
        archived=job.deleted_at is not None,
        owner_id=job.owner_id,
        blind_review_enabled=job.blind_review_enabled,
        review_settings_locked=locked,
    )


def project(
    row: JobApplication, context: JobReviewContext, file: File | None = None
) -> ApplicantRead:
    # Never include applicant_id, raw snapshots, file IDs/keys, or the live user/profile.
    profile = None if row.is_blind else ProfileSnapshot.model_validate(row.profile_snapshot)
    answers: list[AnswerSnapshot] = []
    for answer in row.screening_answers:
        if not row.is_blind:
            answers.append(AnswerSnapshot.model_validate(answer))
            continue
        # Rebuild catalogue metadata, rather than trusting a potentially identifying prompt.
        key, value = answer["key"], answer["value"]
        if key in CATALOGUE:
            _, type_, options = CATALOGUE[key]
            if (type_ == "boolean" and isinstance(value, bool)) or (
                type_ == "choice" and isinstance(value, str) and value in options
            ):
                question = questions([{"key": key, "required": answer["required"]}])[0]
                answers.append(AnswerSnapshot(**question.model_dump(), value=value))
    return ApplicantRead(
        context=context,
        id=row.id,
        job_id=row.job_id,
        stage=cast(ApplicationStage, row.stage),
        source=row.source,
        is_blind=row.is_blind,
        label=f"Candidate {row.id}"
        if row.is_blind
        else profile.contact.name
        if profile
        else "Candidate",
        assignee_id=row.assignee_id,
        profile=profile,
        experience_years=row.profile_snapshot.get("experience_years"),
        cover_note=None if row.is_blind else row.cover_note,
        screening_answers=answers,
        salary_expectation=row.salary_expectation,
        currency=row.currency,
        resume_available=not row.is_blind and ready_resume(row, file),
        rejected_reason=row.rejected_reason,
        rejected_at=row.rejected_at,
        stage_changed_at=row.stage_changed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def projections(
    db: AsyncSession, rows: list[JobApplication], context: JobReviewContext
) -> list[ApplicantRead]:
    ids = {row.resume_file_id for row in rows if not row.is_blind and row.resume_file_id}
    files = (
        {
            file.id: file
            for file in (await db.execute(select(File).where(File.id.in_(ids)))).scalars()
        }
        if ids
        else {}
    )
    return [
        project(row, context, files.get(row.resume_file_id) if row.resume_file_id else None)
        for row in rows
    ]


async def detail(
    db: AsyncSession, user: User, org_id: uuid.UUID, job_id: uuid.UUID, application_id: uuid.UUID
) -> ApplicantRead:
    _, job, row = await scoped(db, user, org_id, job_id, application_id)
    return (await projections(db, [row], await review_context(db, job)))[0]


async def list_applicants(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    *,
    stage: str | None,
    source: str | None,
    assignee_id: uuid.UUID | None,
    q: str | None,
    sort: PipelineSort,
    limit: int,
    offset: int,
) -> ApplicantPage:
    member = await authorize(db, user, org_id)
    job = await job_service._job(db, org_id, job_id, include_archived=True)
    stmt = select(JobApplication).where(
        JobApplication.job_id == job.id, JobApplication.deleted_at.is_(None)
    )
    if member.role not in MANAGERS and job.owner_id != user.id:
        stmt = stmt.where(JobApplication.assignee_id == user.id)
    if source:
        stmt = stmt.where(JobApplication.source == source)
    if assignee_id:
        await organization_service.require_active_member_ref(
            db, org_id, assignee_id, field="assignee_id", label="Assignee"
        )
        stmt = stmt.where(JobApplication.assignee_id == assignee_id)
    if q and q.strip():
        # Blind rows are excluded for EVERY identity query, not filtered on hidden PII.
        stmt = stmt.where(
            JobApplication.is_blind.is_(False),
            JobApplication.profile_snapshot["contact"]["name"]
            .as_string()
            .ilike(f"%{job_service._escape_like(q.strip())}%", escape="\\"),
        )
    filtered = stmt.subquery()
    counts: dict = dict(
        (await db.execute(select(filtered.c.stage, func.count()).group_by(filtered.c.stage))).all()
    )
    if stage:
        stmt = stmt.where(JobApplication.stage == stage)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    ordering = {
        "newest": (JobApplication.created_at.desc(), JobApplication.id.desc()),
        "oldest": (JobApplication.created_at.asc(), JobApplication.id.asc()),
        "stage_changed": (JobApplication.stage_changed_at.desc(), JobApplication.id.desc()),
    }[sort]
    rows = list((await db.execute(stmt.order_by(*ordering).limit(limit).offset(offset))).scalars())
    context = await review_context(db, job)
    return ApplicantPage(
        context=context,
        items=await projections(db, rows, context),
        stage_counts=counts,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def eligible_assignee(db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID) -> None:
    await organization_service.require_active_member_ref(
        db, org_id, user_id, field="assignee_id", label="Assignee"
    )
    org = await organization_service.org_or_404(db, org_id)
    roles = (
        [UserRole.employer, UserRole.startup]
        if org.type == OrgType.startup
        else [UserRole.employer]
    )
    eligible = (
        await db.execute(
            select(User.id)
            .join(OrganizationMember, OrganizationMember.user_id == User.id)
            .join(UserRoleRow, UserRoleRow.user_id == User.id)
            .where(
                User.id == user_id,
                User.deleted_at.is_(None),
                User.status == "active",
                User.email_verified_at.is_not(None),
                OrganizationMember.org_id == org_id,
                OrganizationMember.role.in_([*MANAGERS, OrgRole.member]),
                OrganizationMember.status == "active",
                OrganizationMember.deleted_at.is_(None),
                UserRoleRow.role.in_(roles),
                UserRoleRow.revoked_at.is_(None),
            )
            .limit(1)
        )
    ).first()
    if eligible is None:
        raise validation_error(
            "Assignee must be an eligible hiring member.",
            details=[
                {
                    "loc": ["body", "assignee_id"],
                    "msg": "Assignee must be an eligible hiring member.",
                    "type": "value_error",
                }
            ],
        )


async def patch(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: PipelinePatch,
) -> ApplicantRead:
    member, job, row = await scoped(db, user, org_id, job_id, application_id, write=True)
    if member.role not in MANAGERS and job.owner_id != user.id:
        raise forbidden("Only managers or the job owner can change stages.")
    if "assignee_id" in payload.model_fields_set and member.role not in MANAGERS:
        raise forbidden("Only owners and admins can assign applicants.")
    writable(job, row)
    if payload.stage is not None and payload.expected_stage != row.stage:
        raise conflict("The application stage has changed. Reload before retrying.", "STALE_STAGE")
    if payload.stage is not None and row.stage == "offered" and payload.stage != "rejected":
        raise conflict("Offer workflow stages cannot be changed here.", "INVALID_STATE")
    if payload.assignee_id is not None:
        await eligible_assignee(db, org_id, payload.assignee_id)
    now = datetime.now(UTC)
    if "assignee_id" in payload.model_fields_set and row.assignee_id != payload.assignee_id:
        row.assignee_id = payload.assignee_id
        row.updated_at = now
        audit(db, user, job, ActivityEventType.application_assigned, row.id)
    if payload.stage is not None and row.stage != payload.stage:
        before = row.stage
        row.stage = payload.stage
        row.stage_changed_at = row.updated_at = now
        if row.stage == "interview":
            row.is_blind = False  # Identity reveal is permanent, even on a later backward move.
        if row.stage == "rejected":
            row.rejected_reason = payload.rejected_reason
            if payload.rejection_detail:
                row.rejected_reason = f"{payload.rejected_reason}: {payload.rejection_detail}"
            row.rejected_at = now
        db.add(
            ApplicationStageEvent(
                application_id=row.id,
                from_stage=before,
                to_stage=row.stage,
                actor_id=user.id,
                created_at=now,
            )
        )
        audit(db, user, job, ActivityEventType.application_stage_changed, row.id)
    await db.commit()
    await db.refresh(row)
    return (await projections(db, [row], await review_context(db, job)))[0]


async def history(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    limit: int,
    offset: int,
) -> StageEventPage:
    await scoped(db, user, org_id, job_id, application_id)
    stmt = select(ApplicationStageEvent).where(
        ApplicationStageEvent.application_id == application_id
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                stmt.order_by(ApplicationStageEvent.created_at, ApplicationStageEvent.id)
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    # Same safe history contract as 7c: no applicant actor IDs or internal rejection text.
    return StageEventPage(
        items=[StageEventRead.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def notes(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    limit: int,
    offset: int,
) -> NotePage:
    await scoped(db, user, org_id, job_id, application_id)
    stmt = select(ApplicationNote).where(
        ApplicationNote.application_id == application_id,
        ApplicationNote.author_id == user.id,
        ApplicationNote.deleted_at.is_(None),
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                stmt.order_by(ApplicationNote.created_at.desc(), ApplicationNote.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return NotePage(
        items=[NoteRead.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def create_note(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: NoteCreate,
) -> NoteRead:
    _, job, row = await scoped(db, user, org_id, job_id, application_id, write=True)
    writable(job, row)
    note = ApplicationNote(application_id=row.id, author_id=user.id, body=payload.body)
    db.add(note)
    await db.flush()
    audit(db, user, job, ActivityEventType.application_note_created, row.id)
    await db.commit()
    await db.refresh(note)
    return NoteRead.model_validate(note)


async def delete_note(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    note_id: uuid.UUID,
) -> None:
    _, job, row = await scoped(db, user, org_id, job_id, application_id, write=True)
    note = (
        await db.execute(
            select(ApplicationNote)
            .where(
                ApplicationNote.id == note_id,
                ApplicationNote.application_id == row.id,
                ApplicationNote.author_id == user.id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if note is None:
        raise not_found("Note not found.")
    writable(job, row)
    if note.deleted_at is None:
        note.deleted_at = note.updated_at = datetime.now(UTC)
        audit(db, user, job, ActivityEventType.application_note_deleted, row.id)
        await db.commit()


async def review_settings(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    payload: ReviewSettingsPatch,
) -> ReviewSettingsRead:
    member = await authorize(db, user, org_id, write=True)
    if member.role not in MANAGERS:
        raise forbidden("Only owners and admins can configure blind review.")
    job = await job_service._job(db, org_id, job_id, lock=True, include_archived=True)
    writable(job)
    locked = bool(
        (
            await db.execute(
                select(JobApplication.id).where(JobApplication.job_id == job.id).limit(1)
            )
        ).first()
    )
    if job.blind_review_enabled != payload.blind_review_enabled:
        if locked:
            raise conflict(
                "Blind review is locked after the first application.", "REVIEW_SETTINGS_LOCKED"
            )
        job.blind_review_enabled = payload.blind_review_enabled
        job.updated_at = datetime.now(UTC)
        audit(
            db, user, job, ActivityEventType.job_review_settings_changed, job.id, entity_type="job"
        )
        await db.commit()
    return ReviewSettingsRead(
        job_id=job.id, blind_review_enabled=job.blind_review_enabled, locked=locked
    )


async def resume_download(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    storage: Storage,
) -> FileDownloadRead:
    _, job, row = await scoped(db, user, org_id, job_id, application_id)
    if row.is_blind:
        raise forbidden("Resume downloads are unavailable during blind review.")
    file = await db.get(File, row.resume_file_id) if row.resume_file_id else None
    if not ready_resume(row, file) or file is None:
        raise not_found("Resume not available.")
    settings = get_settings()
    await file_service.enforce_limit(f"file_download:{user.id}", settings.FILE_DOWNLOAD_LIMIT, 300)
    url, ttl = await file_service.sign_ready_download(file, "original", storage)
    audit(db, user, job, ActivityEventType.application_resume_downloaded, row.id)
    await db.commit()
    return FileDownloadRead(url=url, expires_in=ttl)
