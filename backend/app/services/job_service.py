"""Organization-scoped jobs, atomic nested edits and guarded lifecycle (7a)."""

import uuid
from datetime import UTC, datetime
from typing import Literal

from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.job import Job, JobBenefit, JobSkill, JobStatus, WorkMode
from app.models.organization import Department, Organization, OrganizationMember, OrgRole, OrgType
from app.models.profile import Skill
from app.models.user import User
from app.schemas.job import (
    JobCreate,
    JobPage,
    JobRead,
    JobSkillRead,
    JobSort,
    JobSummary,
    JobUpdate,
)
from app.services import activity_service, organization_service, rate_limiter

WRITE_ROLES = {OrgRole.owner, OrgRole.admin}
# Every persisted content field is explicit. Never derive this allowlist from
# request keys, ORM attributes or a response model.
CONTENT_FIELDS = (
    "application_deadline",
    "screening_questions",
    "title",
    "description",
    "responsibilities",
    "requirements",
    "what_we_offer",
    "department",
    "location",
    "work_mode",
    "employment_type",
    "visibility",
    "salary_min",
    "salary_max",
    "currency",
    "salary_period",
    "show_salary_publicly",
    "fair_hiring_confirmed",
    "equity_min_pct",
    "equity_max_pct",
    "experience_min_yrs",
    "experience_max_yrs",
    "openings",
    "owner_id",
)


async def _authorize(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False
) -> Organization:
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await organization_service.require_membership(
        db, org.id, user, roles=WRITE_ROLES if write else None
    )
    if write:
        settings = get_settings()
        if not await rate_limiter.rate_limiter.check(
            f"job_write:user:{user.id}", settings.JOB_WRITE_LIMIT, settings.JOB_WRITE_WINDOW_SECONDS
        ):
            raise rate_limited("Too many job changes. Please slow down.")
    return org


async def _job(
    db: AsyncSession,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    *,
    lock: bool = False,
    include_archived: bool = False,
) -> Job:
    query = select(Job).where(Job.id == job_id, Job.org_id == org_id)
    if not include_archived:
        query = query.where(Job.deleted_at.is_(None))
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(query)).scalar_one_or_none()
    if row is None:
        raise not_found("Job not found.")
    return row


async def _reads(db: AsyncSession, rows: list[Job]) -> list[JobRead]:
    """Two batched child queries per page, never one query per job."""
    if not rows:
        return []
    ids = [row.id for row in rows]
    skills: dict[uuid.UUID, list[JobSkillRead]] = {id_: [] for id_ in ids}
    benefits: dict[uuid.UUID, list[JobBenefit]] = {id_: [] for id_ in ids}
    links = await db.execute(
        select(JobSkill, Skill.name)
        .join(Skill, Skill.id == JobSkill.skill_id)
        .where(JobSkill.job_id.in_(ids))
        .order_by(Skill.name, Skill.id)
    )
    for link, name in links:
        skills[link.job_id].append(
            JobSkillRead(skill_id=link.skill_id, is_required=link.is_required, name=name)
        )
    labels = (
        (
            await db.execute(
                select(JobBenefit)
                .where(JobBenefit.job_id.in_(ids))
                .order_by(JobBenefit.display_order, JobBenefit.id)
            )
        )
        .scalars()
        .all()
    )
    for benefit in labels:
        benefits[benefit.job_id].append(benefit)
    return [
        JobRead.model_validate(
            {
                **{key: getattr(row, key) for key in CONTENT_FIELDS},
                "id": row.id,
                "org_id": row.org_id,
                "status": row.status,
                "blind_review_enabled": row.blind_review_enabled,
                "posted_at": row.posted_at,
                "closed_at": row.closed_at,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "skills": skills[row.id],
                "benefits": benefits[row.id],
            }
        )
        for row in rows
    ]


async def _references(
    db: AsyncSession, org_id: uuid.UUID, payload: JobCreate, fields: set[str]
) -> None:
    if "owner_id" in fields and payload.owner_id is not None:
        await organization_service.require_active_member_ref(
            db, org_id, payload.owner_id, field="owner_id", label="Job owner"
        )
        role = (
            await db.execute(
                select(OrganizationMember.role).where(
                    OrganizationMember.org_id == org_id,
                    OrganizationMember.user_id == payload.owner_id,
                    OrganizationMember.deleted_at.is_(None),
                )
            )
        ).scalar_one()
        if role == OrgRole.viewer:
            raise validation_error(
                "Job owner cannot be a viewer.",
                details=[
                    {
                        "loc": ["body", "owner_id"],
                        "msg": "Job owner cannot be a viewer.",
                        "type": "value_error",
                    }
                ],
            )
    if "skills" in fields:
        ids = {skill.skill_id for skill in payload.skills}
        found = set((await db.execute(select(Skill.id).where(Skill.id.in_(ids)))).scalars().all())
        if ids != found:
            raise validation_error(
                "One or more skills are not in the skills catalogue.",
                details=[
                    {
                        "loc": ["body", "skills"],
                        "msg": "Select skills from the catalogue.",
                        "type": "value_error",
                    }
                ],
            )


async def _replace_children(
    db: AsyncSession, row: Job, payload: JobCreate, fields: set[str]
) -> None:
    if "skills" in fields:
        await db.execute(delete(JobSkill).where(JobSkill.job_id == row.id))
        db.add_all(
            [
                JobSkill(job_id=row.id, skill_id=skill.skill_id, is_required=skill.is_required)
                for skill in payload.skills
            ]
        )
    if "benefits" in fields:
        await db.execute(delete(JobBenefit).where(JobBenefit.job_id == row.id))
        db.add_all(
            [
                JobBenefit(job_id=row.id, label=label, display_order=index)
                for index, label in enumerate(payload.benefits)
            ]
        )


def _publishable(payload: JobCreate) -> None:
    errors = []
    for field in ("description", "requirements"):
        if not getattr(payload, field):
            errors.append(
                {
                    "loc": ["body", field],
                    "msg": "Required to publish this job.",
                    "type": "value_error",
                }
            )
    if payload.work_mode != WorkMode.remote and not payload.location:
        errors.append(
            {
                "loc": ["body", "location"],
                "msg": "Location is required for onsite and hybrid jobs.",
                "type": "value_error",
            }
        )
    if not payload.fair_hiring_confirmed:
        errors.append(
            {
                "loc": ["body", "fair_hiring_confirmed"],
                "msg": "Confirm the fair-hiring terms before publishing.",
                "type": "value_error",
            }
        )
    if errors:
        raise validation_error(
            "Complete the required job fields before publishing.", details=errors
        )


def _audit(db: AsyncSession, user: User, row: Job, event: ActivityEventType) -> None:
    activity_service.record(
        db,
        event_type=event,
        org_id=row.org_id,
        actor_id=user.id,
        entity_type="job",
        entity_id=row.id,
        summary=f"Job {event.value.removeprefix('job_').replace('_', ' ')}.",
        data={"status": row.status},
    )


async def _finish(db: AsyncSession, row: Job) -> JobRead:
    await db.commit()
    await db.refresh(row)
    return (await _reads(db, [row]))[0]


async def create(db: AsyncSession, user: User, org_id: uuid.UUID, payload: JobCreate) -> JobRead:
    await _authorize(db, user, org_id, write=True)
    await _references(db, org_id, payload, {"owner_id", "skills"})
    row = Job(
        **{key: payload.model_dump()[key] for key in CONTENT_FIELDS if key != "owner_id"},
        org_id=org_id,
        created_by=user.id,
        owner_id=payload.owner_id or user.id,
        status=JobStatus.draft,
    )
    db.add(row)
    await db.flush()
    await _replace_children(db, row, payload, {"skills", "benefits"})
    _audit(db, user, row, ActivityEventType.job_created)
    return await _finish(db, row)


async def get(db: AsyncSession, user: User, org_id: uuid.UUID, job_id: uuid.UUID) -> JobRead:
    await _authorize(db, user, org_id)
    return (await _reads(db, [await _job(db, org_id, job_id)]))[0]


async def list_jobs(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    status: JobStatus | None,
    department: Department | None,
    owner_id: uuid.UUID | None,
    location: str | None,
    work_mode: str | None,
    employment_type: str | None,
    q: str | None,
    sort: JobSort,
    limit: int,
    offset: int,
) -> JobPage:
    await _authorize(db, user, org_id)
    where = [Job.org_id == org_id, Job.deleted_at.is_(None)]
    for column, value in (
        (Job.status, status),
        (Job.department, department),
        (Job.owner_id, owner_id),
        (Job.work_mode, work_mode),
        (Job.employment_type, employment_type),
    ):
        if value is not None:
            where.append(column == value)
    if location:
        where.append(Job.location.ilike(f"%{_escape_like(location.strip())}%", escape="\\"))
    if q:
        where.append(Job.title.ilike(f"%{_escape_like(q.strip())}%", escape="\\"))
    total = (await db.execute(select(func.count()).select_from(Job).where(*where))).scalar_one()
    sort_column = {
        "created_at": Job.created_at,
        "updated_at": Job.updated_at,
        "posted_at": Job.posted_at,
        "title": Job.title,
    }[sort]
    ordering = sort_column.asc() if sort == "title" else sort_column.desc().nulls_last()
    rows = list(
        (
            await db.execute(
                select(Job)
                .where(*where)
                .order_by(ordering, Job.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return JobPage(
        items=await _reads(db, rows),
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def summary(db: AsyncSession, user: User, org_id: uuid.UUID) -> JobSummary:
    await _authorize(db, user, org_id)
    rows = (
        await db.execute(
            select(Job.status, func.count())
            .where(Job.org_id == org_id, Job.deleted_at.is_(None))
            .group_by(Job.status)
        )
    ).all()
    counts = {status: 0 for status in JobStatus}
    for status, count in rows:
        counts[JobStatus(status)] = count
    return JobSummary(total=sum(counts.values()), by_status=counts)


async def update(
    db: AsyncSession, user: User, org_id: uuid.UUID, job_id: uuid.UUID, payload: JobUpdate
) -> JobRead:
    await _authorize(db, user, org_id, write=True)
    row = await _job(db, org_id, job_id, lock=True)
    changes = payload.model_dump(exclude_unset=True)
    # Validate the merged state BEFORE changing any ORM objects/collections:
    # a one-sided PATCH must not invert an existing persisted range.
    try:
        merged = JobCreate.model_validate(
            {**{key: getattr(row, key) for key in CONTENT_FIELDS}, **changes}
        )
    except ValidationError as exc:
        details = [
            {"loc": ["body", *error["loc"]], "msg": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]
        raise validation_error(
            "Changes would leave invalid job fields or ranges.", details=details
        ) from None
    await _references(db, org_id, merged, payload.model_fields_set)
    if row.status in {JobStatus.open, JobStatus.paused}:
        _publishable(merged)
    for key in CONTENT_FIELDS:
        if key in changes:
            setattr(row, key, merged.model_dump()[key])
    await _replace_children(db, row, merged, payload.model_fields_set)
    row.updated_at = datetime.now(UTC)
    _audit(db, user, row, ActivityEventType.job_updated)
    return await _finish(db, row)


async def transition(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    action: Literal["publish", "pause", "close", "archive"],
) -> JobRead:
    await _authorize(db, user, org_id, write=True)
    row = await _job(db, org_id, job_id, lock=True)
    target = {"publish": JobStatus.open, "pause": JobStatus.paused, "close": JobStatus.closed}.get(
        action
    )
    if row.status == target:
        return (await _reads(db, [row]))[0]
    allowed = {
        "publish": {JobStatus.draft, JobStatus.paused},
        "pause": {JobStatus.open},
        "close": {JobStatus.open, JobStatus.paused},
        "archive": {JobStatus.draft, JobStatus.closed},
    }
    if row.status not in allowed[action]:
        raise conflict("This action is not allowed in the current job state.", code="INVALID_STATE")
    now = datetime.now(UTC)
    if action == "archive":
        row.deleted_at = now
    else:
        if action == "publish":
            _publishable(
                JobCreate.model_validate({key: getattr(row, key) for key in CONTENT_FIELDS})
            )
            if row.posted_at is None:
                row.posted_at = now
        if action == "close":
            row.closed_at = now
        assert target is not None
        row.status = target
    row.updated_at = now
    event = {
        "publish": ActivityEventType.job_published,
        "pause": ActivityEventType.job_paused,
        "close": ActivityEventType.job_closed,
        "archive": ActivityEventType.job_archived,
    }[action]
    _audit(db, user, row, event)
    return await _finish(db, row)
