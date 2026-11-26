"""Saved jobs (Step 7m, job-seeker side).

A bookmark: a seeker flags a job they are considering and may attach a private
note. Pure CRUD over a composite-PK join table; the only client-writable
fields are ``job_id`` (on create) and ``note`` (on update) — ``user_id`` and
``created_at`` are server-controlled and the schemas forbid extras, so a
cross-user write is impossible (every row is scoped to the authenticated user).

Security: the caller must be an active, email-verified job seeker (same gate as
7c applications). Saving references a *global* job id, so there is no org-IDOR
surface, but a non-existent / soft-deleted job is a 404, not a dangling row.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited
from app.models.job import Job
from app.models.organization import Organization
from app.models.saved_job import SavedJob
from app.models.user import User
from app.services import job_application_service
from app.services.rate_limiter import rate_limiter

_ALREADY_SAVED = "ALREADY_SAVED"


async def _rate_limit(user: User, limit: int, window: int, kind: str) -> None:
    if not await rate_limiter.check(f"saved_jobs:{kind}:{user.id}", limit, window):
        raise rate_limited("Too many requests. Please slow down.")


require_seeker = job_application_service.require_seeker


async def _job_or_404(db: AsyncSession, job_id: uuid.UUID) -> Job:
    job = (
        await db.execute(select(Job).where(Job.id == job_id, Job.deleted_at.is_(None)))
    ).scalar_one_or_none()
    if job is None:
        raise not_found("Job not found.")
    return job


def _projection(saved: SavedJob, job: Job, org: Organization | None) -> dict:
    # Match the existing job-detail audience. A bookmark is not access to a draft
    # or to an inactive organization; retain status so users can manage it.
    visible = (
        org is not None
        and org.deleted_at is None
        and org.status == "active"
        and org.type in {"startup", "employer"}
        and job.status in {"open", "paused", "closed"}
        and job.visibility in {"public", "platform_members", "link_only"}
    )
    details = None
    if visible and org is not None:
        details = {
            "id": job.id,
            "title": job.title,
            "status": job.status,
            "location": job.location,
            "application_deadline": job.application_deadline,
            "work_mode": job.work_mode,
            "employment_type": job.employment_type,
            "salary_min": str(job.salary_min)
            if job.show_salary_publicly and job.salary_min is not None
            else None,
            "salary_max": str(job.salary_max)
            if job.show_salary_publicly and job.salary_max is not None
            else None,
            "currency": job.currency,
            "salary_period": job.salary_period,
            "org_id": job.org_id,
            "org_name": org.name,
        }
    return {
        "job_id": saved.job_id,
        "note": saved.note,
        "created_at": saved.created_at,
        "status": job.status,
        "job": details,
    }


async def _project(db: AsyncSession, saved: SavedJob) -> dict:
    job = await _job_or_404(db, saved.job_id)
    org = (
        await db.execute(select(Organization).where(Organization.id == job.org_id))
    ).scalar_one_or_none()
    return _projection(saved, job, org)


async def save(db: AsyncSession, user: User, job_id: uuid.UUID, note: str | None) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.SAVED_JOBS_WRITE_LIMIT, settings.SAVED_JOBS_WRITE_WINDOW_SECONDS, "write"
    )
    await _job_or_404(db, job_id)

    existing = (
        await db.execute(
            select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job_id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise conflict("You have already saved this job.", _ALREADY_SAVED)

    user_id = user.id
    saved = SavedJob(user_id=user_id, job_id=job_id, note=note)
    db.add(saved)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if (
            await db.execute(
                select(SavedJob).where(SavedJob.user_id == user_id, SavedJob.job_id == job_id)
            )
        ).scalar_one_or_none():
            raise conflict("You have already saved this job.", _ALREADY_SAVED) from exc
        raise
    await db.refresh(saved)
    return await _project(db, saved)


async def list_(db: AsyncSession, user: User, *, limit: int, offset: int) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.SAVED_JOBS_READ_LIMIT, settings.SAVED_JOBS_READ_WINDOW_SECONDS, "read"
    )

    total = (
        await db.execute(
            select(func.count())
            .select_from(SavedJob)
            .join(Job, Job.id == SavedJob.job_id)
            .where(SavedJob.user_id == user.id, Job.deleted_at.is_(None))
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(SavedJob, Job, Organization)
            .join(Job, Job.id == SavedJob.job_id)
            .join(Organization, Organization.id == Job.org_id)
            .where(SavedJob.user_id == user.id, Job.deleted_at.is_(None))
            .order_by(SavedJob.created_at.desc(), SavedJob.job_id)
            .offset(offset)
            .limit(limit)
        )
    ).all()

    items = [_projection(saved, job, org) for saved, job, org in rows]
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


async def get(db: AsyncSession, user: User, job_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.SAVED_JOBS_READ_LIMIT, settings.SAVED_JOBS_READ_WINDOW_SECONDS, "read"
    )
    saved = (
        await db.execute(
            select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job_id)
        )
    ).scalar_one_or_none()
    if saved is None:
        raise not_found("Job not saved.")
    return await _project(db, saved)


async def update_note(db: AsyncSession, user: User, job_id: uuid.UUID, note: str | None) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.SAVED_JOBS_WRITE_LIMIT, settings.SAVED_JOBS_WRITE_WINDOW_SECONDS, "write"
    )
    saved = (
        await db.execute(
            select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job_id)
        )
    ).scalar_one_or_none()
    if saved is None:
        raise not_found("Job not saved.")
    await _job_or_404(db, job_id)
    saved.note = note
    await db.commit()
    return await _project(db, saved)


async def unsave(db: AsyncSession, user: User, job_id: uuid.UUID) -> None:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.SAVED_JOBS_WRITE_LIMIT, settings.SAVED_JOBS_WRITE_WINDOW_SECONDS, "write"
    )
    saved = (
        await db.execute(
            select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job_id)
        )
    ).scalar_one_or_none()
    if saved is None:
        raise not_found("Job not saved.")
    await db.delete(saved)
    await db.commit()
