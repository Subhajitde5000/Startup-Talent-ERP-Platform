"""Submit/withdraw only as self. No employer access or arbitrary stage mutation."""

import hashlib
import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import AppException, conflict, forbidden, not_found, validation_error
from app.models.activity import ActivityEventType
from app.models.file import File
from app.models.job import Job
from app.models.job_application import ApplicationStageEvent, JobApplication
from app.models.organization import OrganizationMember
from app.models.profile import Skill
from app.models.talent import TalentProfile, TalentProfileSkill
from app.models.user import User
from app.schemas.job_application import (
    ApplicationContact,
    ApplicationContext,
    ApplicationCreate,
    ApplicationPage,
    ApplicationRead,
    ProfileSnapshot,
    StageEventPage,
    StageEventRead,
)
from app.schemas.job_screening import CATALOGUE, questions
from app.services import activity_service, file_service, job_discovery_service, job_service


async def require_seeker(db: AsyncSession, user: User) -> None:
    if not await job_discovery_service.seeker(db, user):
        raise forbidden("This action is for job seekers.")
    if user.email_verified_at is None or user.status != "active":
        raise forbidden("An active, email-verified account is required.")


async def own(db: AsyncSession, user: User, id_: uuid.UUID, *, lock=False) -> JobApplication:
    await require_seeker(db, user)
    stmt = select(JobApplication).where(
        JobApplication.id == id_,
        JobApplication.applicant_id == user.id,
        JobApplication.deleted_at.is_(None),
    )
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Application not found.")
    return row


async def existing(db: AsyncSession, user: User, job_id: uuid.UUID) -> JobApplication | None:
    return (
        await db.execute(
            select(JobApplication).where(
                JobApplication.job_id == job_id,
                JobApplication.applicant_id == user.id,
                JobApplication.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


def contact(user: User) -> ApplicationContact:
    return ApplicationContact(
        name=user.display_name,
        email=user.primary_email,
        phone=user.phone,
        linkedin_url=user.linkedin_url,
        github_url=user.github_url,
        portfolio_url=user.website_url,
    )


async def membership(db: AsyncSession, user: User, org_id: uuid.UUID) -> bool:
    return bool(
        (
            await db.execute(
                select(OrganizationMember.id).where(
                    OrganizationMember.org_id == org_id,
                    OrganizationMember.user_id == user.id,
                    OrganizationMember.status == "active",
                    OrganizationMember.deleted_at.is_(None),
                )
            )
        ).first()
    )


async def eligibility(db: AsyncSession, user: User, job: Job) -> str | None:
    if await membership(db, user, job.org_id):
        return "You cannot apply to your own organization."
    if job.status != "open":
        return "This job is not accepting applications."
    if job.application_deadline and file_service.aware(job.application_deadline) <= datetime.now(
        UTC
    ):
        return "The application deadline has passed."
    return None


async def context(db: AsyncSession, user: User, job_id: uuid.UUID) -> ApplicationContext:
    await require_seeker(db, user)
    job, _ = await job_discovery_service.get_pair(db, user, job_id)
    row = await existing(db, user, job.id)
    reason = "You have already applied to this job." if row else await eligibility(db, user, job)
    return ApplicationContext(
        job_id=job.id,
        contact=contact(user),
        profile=ProfileSnapshot.model_validate(await snapshot(db, user)),
        questions=questions(job.screening_questions),
        existing_application_id=row.id if row else None,
        can_apply=reason is None,
        ineligible_reason=reason,
    )


def invalid_field(field: str, message: str):
    return validation_error(
        message, details=[{"loc": ["body", field], "msg": message, "type": "value_error"}]
    )


def answer_snapshot(job: Job, payload: ApplicationCreate) -> list[dict]:
    answers = {a.key: a.value for a in payload.screening_answers}
    configured = {q["key"] for q in job.screening_questions}
    if len(answers) != len(payload.screening_answers) or set(answers) - configured:
        raise invalid_field(
            "screening_answers", "Answers must have unique keys configured for this job."
        )
    result = []
    for question in questions(job.screening_questions):
        if question.key not in answers:
            if question.required:
                raise invalid_field("screening_answers", f"Answer required: {question.key}.")
            continue
        value = answers[question.key]
        type_ = CATALOGUE[question.key][1]
        if type_ == "boolean":
            valid = isinstance(value, bool)
        elif type_ == "choice":
            valid = isinstance(value, str) and value in question.options
        else:
            valid = isinstance(value, str) and 1 <= len(value.strip()) <= 1000
        if not valid:
            raise invalid_field("screening_answers", f"Invalid answer for {question.key}.")
        result.append(
            {**question.model_dump(), "value": value.strip() if isinstance(value, str) else value}
        )
    return result


async def snapshot(db: AsyncSession, user: User, payload: ApplicationCreate | None = None) -> dict:
    profile = await db.get(TalentProfile, user.id)
    skills = (
        (
            await db.execute(
                select(Skill.name)
                .join(TalentProfileSkill, TalentProfileSkill.skill_id == Skill.id)
                .where(TalentProfileSkill.user_id == user.id)
                .order_by(Skill.name)
            )
        )
        .scalars()
        .all()
    )
    return {
        "contact": (payload.contact if payload and payload.contact else contact(user)).model_dump(
            mode="json"
        ),
        "headline": profile.headline if profile else user.headline,
        "summary": profile.summary if profile else user.bio,
        "experience_years": str(profile.total_experience_yrs)
        if profile and profile.total_experience_yrs is not None
        else None,
        "current_location": profile.current_location if profile else None,
        "skills": list(skills),
    }


def fingerprint(payload: ApplicationCreate) -> str:
    canonical = payload.model_dump(mode="json")
    canonical["screening_answers"] = sorted(canonical["screening_answers"], key=lambda a: a["key"])
    if payload.salary_expectation is not None:
        canonical["salary_expectation"] = f"{payload.salary_expectation:.2f}"
    return hashlib.sha256(
        json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def retry(row: JobApplication, digest: str) -> ApplicationRead:
    if row.submission_fingerprint == digest:
        return ApplicationRead.model_validate(row)
    raise conflict("An application for this job already exists.", "APPLICATION_EXISTS")


async def submit(
    db: AsyncSession, user: User, job_id: uuid.UUID, payload: ApplicationCreate
) -> tuple[ApplicationRead, bool]:
    await require_seeker(db, user)
    if not payload.accuracy_confirmed:
        raise invalid_field("accuracy_confirmed", "Confirm the information is accurate.")
    if not payload.consent_share:
        raise invalid_field("consent_share", "Explicit sharing consent is required.")
    # Serialize against close/archive/settings edits and concurrent submissions for this job.
    # Retry of a committed own application is safe even after the job is archived.
    digest = fingerprint(payload)
    prior = await existing(db, user, job_id)
    if prior:
        return retry(prior, digest), False
    job, org = await job_discovery_service.get_pair(db, user, job_id, lock=True)
    prior = await existing(db, user, job_id)
    if prior:
        return retry(prior, digest), False
    reason = await eligibility(db, user, job)
    if reason:
        raise conflict(reason, "APPLICATION_NOT_ALLOWED")
    answers = answer_snapshot(job, payload)
    if payload.resume_file_id:
        # Validate ownership before returning any state/existence information.
        try:
            file = await file_service.file_access(db, user, payload.resume_file_id)
        except AppException:
            raise invalid_field(
                "resume_file_id", "Select your own ready, clean personal resume."
            ) from None
        file = (
            await db.execute(
                select(File)
                .where(File.id == file.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()
        if (
            file.owner_org_id is not None
            or file.uploaded_by != user.id
            or file.deleted_at
            or file.purged_at
            or file.kind != "resume"
            or file.upload_status != "ready"
            or file.scan_status != "clean"
        ):
            raise invalid_field("resume_file_id", "Select your own ready, clean personal resume.")
    settings = get_settings()
    await file_service.enforce_limit(
        f"application_submit:{user.id}", settings.APPLICATION_SUBMIT_LIMIT, 86400
    )
    now = datetime.now(UTC)
    row = JobApplication(
        job_id=job.id,
        applicant_id=user.id,
        stage="applied",
        is_blind=job.blind_review_enabled,
        source="platform",
        resume_file_id=payload.resume_file_id,
        cover_note=payload.cover_note,
        salary_expectation=payload.salary_expectation,
        currency=payload.currency,
        consent_share=True,
        accuracy_confirmed_at=now,
        consent_shared_at=now,
        profile_snapshot=await snapshot(db, user, payload),
        job_snapshot={
            "id": str(job.id),
            "org_id": str(org.id),
            "title": job.title,
            "company_name": org.name,
        },
        screening_answers=answers,
        submission_fingerprint=digest,
        stage_changed_at=now,
    )
    db.add(row)
    try:
        await db.flush()
        db.add(
            ApplicationStageEvent(
                application_id=row.id,
                from_stage=None,
                to_stage="applied",
                actor_id=user.id,
                created_at=now,
            )
        )
        activity_service.record(
            db,
            event_type=ActivityEventType.application_submitted,
            actor_id=user.id,
            entity_type="application",
            entity_id=row.id,
            summary="Application submitted.",
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        winner = await existing(db, user, job_id)
        if winner:
            return retry(winner, digest), False
        raise
    await db.refresh(row)
    return ApplicationRead.model_validate(row), True


async def list_own(
    db: AsyncSession, user: User, stage: str | None, limit: int, offset: int, q: str | None = None
) -> ApplicationPage:
    await require_seeker(db, user)
    stmt = select(JobApplication).where(
        JobApplication.applicant_id == user.id, JobApplication.deleted_at.is_(None)
    )
    if q and q.strip():
        pattern = f"%{job_service._escape_like(q.strip())}%"
        stmt = stmt.where(
            or_(
                JobApplication.job_snapshot["title"].as_string().ilike(pattern, escape="\\"),
                JobApplication.job_snapshot["company_name"].as_string().ilike(pattern, escape="\\"),
            )
        )
    filtered = stmt.subquery()
    stage_counts: dict = dict(
        (await db.execute(select(filtered.c.stage, func.count()).group_by(filtered.c.stage))).all()
    )
    if stage:
        stmt = stmt.where(JobApplication.stage == stage)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                stmt.order_by(JobApplication.created_at.desc(), JobApplication.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return ApplicationPage(
        items=[ApplicationRead.model_validate(r) for r in rows],
        stage_counts=stage_counts,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def history(
    db: AsyncSession, user: User, id_: uuid.UUID, limit: int, offset: int
) -> StageEventPage:
    await own(db, user, id_)
    stmt = select(ApplicationStageEvent).where(ApplicationStageEvent.application_id == id_)
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
    return StageEventPage(
        items=[StageEventRead.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def withdraw(db: AsyncSession, user: User, id_: uuid.UUID) -> ApplicationRead:
    row = await own(db, user, id_, lock=True)
    if row.stage == "withdrawn":
        return ApplicationRead.model_validate(row)
    if row.stage in {"hired", "rejected"}:
        raise conflict("This application is already terminal.", "INVALID_STATE")
    await file_service.enforce_limit(
        f"application_withdraw:{user.id}", get_settings().APPLICATION_WITHDRAW_LIMIT, 3600
    )
    before = row.stage
    row.stage = "withdrawn"
    row.withdrawn_at = row.stage_changed_at = row.updated_at = datetime.now(UTC)
    from app.services.hiring_workflow_service import cancel_pending

    await cancel_pending(db, user, row, uuid.UUID(row.job_snapshot["org_id"]))
    db.add(
        ApplicationStageEvent(
            application_id=row.id,
            from_stage=before,
            to_stage="withdrawn",
            actor_id=user.id,
            created_at=row.stage_changed_at,
        )
    )
    activity_service.record(
        db,
        event_type=ActivityEventType.application_withdrawn,
        actor_id=user.id,
        entity_type="application",
        entity_id=row.id,
        summary="Application withdrawn.",
    )
    await db.commit()
    await db.refresh(row)
    return ApplicationRead.model_validate(row)
