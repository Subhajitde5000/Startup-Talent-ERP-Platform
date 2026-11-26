"""Employer hiring dashboard, analytics and activity (Step 7l).

Read-only. Three surfaces, all org-scoped to an employer OR startup hiring
organization, visible to any ACTIVE member (viewers included — the data is the
org's own pipeline, not personal PII; the candidate PII rules live in 7d):

- ``dashboard``   KPI strip + active jobs + "needs attention" + recent activity
- ``analytics``   hiring funnel (current stage distribution, per ``v_job_funnel``)
                  + time-to-hire / time-to-first-interview, per job and aggregate
- ``activity``    paginated ``activity_events`` feed for the org

Security model (BUILD_PLAN 7a/7r): the org must be an active employer or
startup (wrong type / suspended / deleted -> 404, no existence oracle); a
non-member of an existing org gets 403. The funnel is computed here from
``jobs`` + ``job_applications`` (see plan G1 — no SQL view), so it is portable
and runs under the SQLite ``create_all`` test harness.
"""

import uuid
from collections import defaultdict
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited
from app.models.activity import ActivityEvent
from app.models.job import Job
from app.models.job_application import ApplicationStageEvent, JobApplication
from app.models.organization import OrgType
from app.models.user import User
from app.services import organization_service
from app.services.rate_limiter import rate_limiter

# The five funnel stages, in order, matching schema.sql ``v_job_funnel``.
FUNNEL_STAGES: tuple[str, ...] = ("applied", "shortlisted", "interview", "offered", "hired")


# Hiring-only activity. Non-job events are summarized generically, avoiding
# application / interview / offer details and blind-review identity leaks.
JOB_EVENTS = {
    "job_created",
    "job_updated",
    "job_published",
    "job_paused",
    "job_closed",
    "job_archived",
}
HIRING_EVENTS = JOB_EVENTS | {
    "application_assigned",
    "application_stage_changed",
    "application_note_created",
    "application_note_deleted",
    "interview_scheduled",
    "interview_rescheduled",
    "interview_cancelled",
    "interview_completed",
    "interview_feedback_submitted",
    "offer_created",
    "offer_updated",
    "offer_sent",
    "offer_countered",
    "offer_accepted",
    "offer_declined",
    "offer_withdrawn",
    "offer_expired",
    "hire_created",
    "hire_updated",
}


async def _authorize(db: AsyncSession, user: User, org_id: uuid.UUID) -> object:
    """Active employer/startup org, caller is an active member (any role)."""
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await organization_service.require_membership(db, org.id, user)
    return org


async def _rate_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.check(
        f"employer_analytics:{user.id}",
        settings.EMPLOYER_ANALYTICS_READ_LIMIT,
        settings.EMPLOYER_ANALYTICS_READ_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many analytics requests. Please slow down.")


async def _org_job_rows(db: AsyncSession, org_id: uuid.UUID) -> list[Job]:
    return list(
        (
            await db.execute(
                select(Job)
                .where(
                    Job.org_id == org_id,
                    Job.deleted_at.is_(None),
                )
                .order_by(Job.created_at.desc(), Job.id)
            )
        )
        .scalars()
        .all()
    )


async def _stage_counts_by_job(
    db: AsyncSession, org_id: uuid.UUID
) -> dict[uuid.UUID, dict[str, int]]:
    """{job_id: {stage: count}} for every non-deleted application in the org."""
    rows = (
        await db.execute(
            select(JobApplication.job_id, JobApplication.stage, func.count())
            .join(Job, Job.id == JobApplication.job_id)
            .where(
                Job.org_id == org_id,
                Job.deleted_at.is_(None),
                JobApplication.deleted_at.is_(None),
            )
            .group_by(JobApplication.job_id, JobApplication.stage)
        )
    ).all()
    out: dict[uuid.UUID, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for job_id, stage, n in rows:
        out[job_id][stage] = n
    return out


async def _velocity_events(
    db: AsyncSession, org_id: uuid.UUID
) -> list[tuple[uuid.UUID, datetime, datetime, str]]:
    """(job_id, applied_at, stage_event_at, to_stage) for interview/hired events."""
    return list(
        (
            await db.execute(
                select(
                    JobApplication.job_id,
                    JobApplication.created_at,
                    func.min(ApplicationStageEvent.created_at),
                    ApplicationStageEvent.to_stage,
                )
                .join(
                    ApplicationStageEvent,
                    ApplicationStageEvent.application_id == JobApplication.id,
                )
                .join(Job, Job.id == JobApplication.job_id)
                .where(
                    Job.org_id == org_id,
                    Job.deleted_at.is_(None),
                    JobApplication.deleted_at.is_(None),
                    ApplicationStageEvent.to_stage.in_(["interview", "hired"]),
                )
                .group_by(
                    JobApplication.id,
                    JobApplication.job_id,
                    JobApplication.created_at,
                    ApplicationStageEvent.to_stage,
                )
            )
        ).all()
    )


def _avg_days(pairs: list[tuple[datetime, datetime]]) -> int | None:
    if not pairs:
        return None
    total = sum((ev - ap).days for ap, ev in pairs)
    return round(total / len(pairs))


async def dashboard(db: AsyncSession, user: User, org_id: uuid.UUID) -> dict:
    await _authorize(db, user, org_id)
    await _rate_limit(user)
    jobs = await _org_job_rows(db, org_id)
    counts = await _stage_counts_by_job(db, org_id)

    open_jobs = (
        await db.execute(
            select(func.count())
            .select_from(Job)
            .where(
                Job.org_id == org_id,
                Job.deleted_at.is_(None),
                Job.status == "open",
            )
        )
    ).scalar_one()

    total_applicants = sum(sum(c.values()) for c in counts.values())
    hires = sum(c.get("hired", 0) for c in counts.values())

    events = await _velocity_events(db, org_id)
    hired_pairs = [(ap, ev) for _, ap, ev, stage in events if stage == "hired"]
    avg_time_to_hire = _avg_days(hired_pairs)

    job_items = []
    attention = []
    for job in [j for j in jobs if j.status in {"open", "paused"}][:12]:
        c = counts.get(job.id, {})
        applicants = sum(c.values())
        job_hired = c.get("hired", 0)
        job_items.append(
            {
                "job_id": job.id,
                "title": job.title,
                "status": job.status,
                "applicants": applicants,
                "hires": job_hired,
            }
        )
        unreviewed = c.get("applied", 0)
        if unreviewed > 0:
            attention.append(
                {
                    "job_id": job.id,
                    "title": job.title,
                    "unreviewed_applicants": unreviewed,
                }
            )

    recent_activity = await _recent_activity(db, org_id, limit=5)

    return {
        "org_id": org_id,
        "kpis": {
            "open_jobs": open_jobs,
            "total_applicants": total_applicants,
            "hires": hires,
            "avg_time_to_hire_days": avg_time_to_hire,
        },
        "jobs": job_items,
        "attention": attention,
        "recent_activity": recent_activity,
    }


async def analytics(db: AsyncSession, user: User, org_id: uuid.UUID) -> dict:
    await _authorize(db, user, org_id)
    await _rate_limit(user)

    jobs = await _org_job_rows(db, org_id)
    counts = await _stage_counts_by_job(db, org_id)
    events = await _velocity_events(db, org_id)

    # Funnel = current stage distribution (per schema.sql ``v_job_funnel``).
    funnel = [
        {"stage": stage, "count": sum(c.get(stage, 0) for c in counts.values())}
        for stage in FUNNEL_STAGES
    ]
    total_applicants = sum(sum(c.values()) for c in counts.values())
    hires = sum(c.get("hired", 0) for c in counts.values())

    # Per-application velocity pairs, grouped by job, for Python-side averaging.
    by_job_pairs: dict[uuid.UUID, dict[str, list[tuple[datetime, datetime]]]] = defaultdict(
        lambda: {"interview": [], "hired": []}
    )
    for job_id, ap, ev, stage in events:
        by_job_pairs[job_id][stage].append((ap, ev))

    by_job = []
    for job in jobs:
        c = counts.get(job.id, {})
        by_job.append(
            {
                "job_id": job.id,
                "title": job.title,
                "status": job.status,
                "applicants": sum(c.values()),
                "hires": c.get("hired", 0),
                "avg_time_to_hire_days": _avg_days(by_job_pairs[job.id]["hired"]),
                "avg_time_to_first_interview_days": _avg_days(by_job_pairs[job.id]["interview"]),
            }
        )

    hired_pairs = [(ap, ev) for _, ap, ev, stage in events if stage == "hired"]
    interview_pairs = [(ap, ev) for _, ap, ev, stage in events if stage == "interview"]

    return {
        "funnel": funnel,
        "total_applicants": total_applicants,
        "hires": hires,
        "avg_time_to_hire_days": _avg_days(hired_pairs),
        "avg_time_to_first_interview_days": _avg_days(interview_pairs),
        "by_job": by_job,
    }


async def _recent_activity(
    db: AsyncSession, org_id: uuid.UUID, *, limit: int, offset: int = 0
) -> list[dict]:
    rows = (
        await db.execute(
            select(ActivityEvent, User)
            .outerjoin(User, User.id == ActivityEvent.user_id)
            .where(
                ActivityEvent.org_id == org_id,
                ActivityEvent.event_type.in_(HIRING_EVENTS),
            )
            .order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
            .offset(offset)
            .limit(limit)
        )
    ).all()
    return [
        {
            "event_type": event.event_type,
            "summary": event.summary
            if event.event_type in JOB_EVENTS
            else event.event_type.replace("_", " ").capitalize() + ".",
            "link_url": event.link_url if event.event_type in JOB_EVENTS else None,
            "actor_name": (
                actor.display_name if actor is not None and event.event_type in JOB_EVENTS else None
            ),
            "created_at": event.created_at,
        }
        for event, actor in rows
    ]


async def activity_feed(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
) -> dict:
    await _authorize(db, user, org_id)
    await _rate_limit(user)

    total = (
        await db.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(
                ActivityEvent.org_id == org_id,
                ActivityEvent.event_type.in_(HIRING_EVENTS),
            )
        )
    ).scalar_one()

    items = await _recent_activity(db, org_id, limit=limit, offset=offset)

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }
