"""Interview scheduling, participant consent, and author-private feedback."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import cast

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import conflict, forbidden, not_found, validation_error
from app.models.hiring_workflow import Interview, InterviewFeedback, InterviewParticipant
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.organization import Organization
from app.models.user import User
from app.schemas import hiring_workflow as s
from app.services import applicant_pipeline_service as pipeline
from app.services import hiring_workflow_service as common
from app.services import job_service

LIVE = {"scheduled", "confirmed"}


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


async def staff(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    write: bool = False,
    panel_access: bool = False,
) -> tuple[Job, JobApplication, Interview]:
    # Authorize before looking up IDs; then use exactly the 7d object boundary.
    member = await pipeline.authorize(db, user, org_id, write=write)
    hit = (
        await db.execute(
            select(Interview, JobApplication.job_id)
            .join(JobApplication, JobApplication.id == Interview.application_id)
            .join(Job, Job.id == JobApplication.job_id)
            .where(Interview.id == id_, Job.org_id == org_id)
        )
    ).one_or_none()
    if hit is None:
        raise not_found()
    # Recheck domain grants after waiting for the job lock, not from a pre-lock identity cache.
    job = await job_service._job(db, org_id, hit.job_id, lock=write, include_archived=True)
    invited = (
        (
            await db.execute(
                select(InterviewParticipant)
                .where(
                    InterviewParticipant.interview_id == id_,
                    InterviewParticipant.user_id == user.id,
                )
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()
        if panel_access
        else None
    )
    if invited is not None and invited.side in {"interviewer", "observer"}:
        # This grants the interview only, never 7d applicant detail/resume or scorecard access.
        stmt = select(JobApplication).where(
            JobApplication.id == hit.Interview.application_id, JobApplication.deleted_at.is_(None)
        )
        if write:
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
        app = (await db.execute(stmt)).scalar_one_or_none()
        if app is None:
            raise not_found()
    else:
        _, job, app = await pipeline.scoped(
            db, user, org_id, hit.job_id, hit.Interview.application_id, write=write, _member=member
        )
    row = (
        (
            await db.execute(
                select(Interview)
                .where(Interview.id == id_)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()
        if write
        else hit.Interview
    )
    return job, app, row


async def candidate(
    db: AsyncSession, user: User, id_: uuid.UUID, write: bool = False
) -> tuple[Job, JobApplication, Interview]:
    await common.seeker(db, user, write)
    hit = (
        await db.execute(
            select(Interview)
            .join(JobApplication, JobApplication.id == Interview.application_id)
            .where(
                Interview.id == id_,
                JobApplication.applicant_id == user.id,
                JobApplication.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if hit is None:
        raise not_found()
    job, app = await common.own_application(db, user, hit.application_id, lock=write)
    if write:
        hit = (
            await db.execute(
                select(Interview)
                .where(Interview.id == id_)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()
    return job, app, hit


async def project(
    db: AsyncSession, row: Interview, job: Job, app: JobApplication, user: User, own: bool = False
) -> s.InterviewRead:
    # Applicants see only their own attendance, never panel identities/responses.
    stmt = (
        select(InterviewParticipant, User.display_name)
        .join(User, User.id == InterviewParticipant.user_id)
        .where(InterviewParticipant.interview_id == row.id)
    )
    if own:
        stmt = stmt.where(InterviewParticipant.user_id == user.id)
    participants = (
        await db.execute(stmt.order_by(InterviewParticipant.side, InterviewParticipant.user_id))
    ).all()
    manager = False if own else await common.manager_role(db, user, job.org_id)
    return s.InterviewRead(
        company_name=app.job_snapshot["company_name"],
        can_manage=not own
        and (manager or user.id in {job.owner_id, app.assignee_id})
        and app.stage not in pipeline.TERMINAL
        and job.deleted_at is None
        and job.status != "closed",
        id=row.id,
        application_id=app.id,
        applicant_label="You" if own else common.label(app),
        job_title=job.title,
        round_name=row.round_name,
        format=cast(s.InterviewFormat, row.format),
        status=cast(s.InterviewStatus, row.status),
        scheduled_at=row.scheduled_at,
        duration_min=row.duration_min,
        location=row.location,
        meeting_url=row.meeting_url,
        cancelled_reason=row.cancelled_reason,
        version=row.version,
        participants=[
            s.ParticipantRead(
                user_id=p.user_id if p.side != "candidate" or not app.is_blind or own else None,
                display_name="You" if own else common.label(app) if p.side == "candidate" else name,
                side=p.side,
                response=cast(s.Attendance | None, p.response),
                responded_at=p.responded_at,
            )
            for p, name in participants
        ],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def panel(
    db: AsyncSession, org_id: uuid.UUID, app: JobApplication, values: list[s.ParticipantInput]
) -> None:
    if app.applicant_id in {p.user_id for p in values}:
        raise validation_error("The candidate cannot be a panel member.")
    for p in values:
        await pipeline.eligible_assignee(db, org_id, p.user_id)


async def availability(
    db: AsyncSession,
    ids: list[uuid.UUID],
    start: datetime,
    duration: int,
    exclude: uuid.UUID | None = None,
) -> None:
    # User rows serialize overlap checks across jobs/organizations. Deterministic lock order.
    await db.execute(select(User).where(User.id.in_(ids)).order_by(User.id).with_for_update())
    start = aware(start)
    if start <= common.now():
        raise validation_error("Schedule interviews in the future.")
    try:
        end = start + timedelta(minutes=duration)
    except OverflowError as exc:
        raise validation_error("Interview end is outside the supported calendar range.") from exc
    stmt = (
        select(Interview)
        .join(InterviewParticipant, InterviewParticipant.interview_id == Interview.id)
        .where(
            InterviewParticipant.user_id.in_(ids),
            Interview.status.in_(LIVE),
            Interview.scheduled_at < end,
            Interview.scheduled_at > start - timedelta(minutes=480),
        )
    )
    if exclude:
        stmt = stmt.where(Interview.id != exclude)
    for other in (await db.execute(stmt)).scalars().unique():
        if aware(other.scheduled_at) + timedelta(minutes=other.duration_min) > start:
            raise conflict("A participant has an overlapping interview.", "INTERVIEW_OVERLAP")


async def create(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: s.InterviewCreate
) -> s.InterviewRead:
    app = await db.get(JobApplication, payload.application_id)
    if app is None:
        await pipeline.authorize(db, user, org_id, write=True)
        raise not_found()
    _, job, app = await pipeline.scoped(db, user, org_id, app.job_id, app.id, write=True)
    old = (
        await db.execute(
            select(Interview).where(
                Interview.application_id == app.id, Interview.request_id == payload.request_id
            )
        )
    ).scalar_one_or_none()
    fingerprint = common.digest(payload)
    if old:
        common.retry(old, fingerprint)
        return await project(db, old, job, app, user)
    pipeline.writable(job, app)
    if app.stage == "offered":
        raise conflict("An offered application cannot return to interview.")
    await panel(db, org_id, app, payload.participants)
    ids = [app.applicant_id, *[p.user_id for p in payload.participants]]
    await availability(db, ids, payload.scheduled_at, payload.duration_min)
    row = Interview(
        application_id=app.id,
        created_by=user.id,
        request_id=payload.request_id,
        fingerprint=fingerprint,
        **payload.model_dump(exclude={"application_id", "request_id", "participants"}),
    )
    db.add(row)
    await db.flush()
    db.add(InterviewParticipant(interview_id=row.id, user_id=app.applicant_id, side="candidate"))
    db.add_all(
        [
            InterviewParticipant(interview_id=row.id, user_id=p.user_id, side=p.side)
            for p in payload.participants
        ]
    )
    app.is_blind = False
    common.stage(db, user, job, app, "interview")
    common.audit(db, user, org_id, "interview", row.id, "scheduled")
    await db.commit()
    return await project(db, row, job, app, user)


async def get(
    db: AsyncSession, user: User, id_: uuid.UUID, org_id: uuid.UUID | None = None
) -> s.InterviewRead:
    job, app, row = await (
        staff(db, user, org_id, id_, panel_access=True) if org_id else candidate(db, user, id_)
    )
    return await project(db, row, job, app, user, own=org_id is None)


async def listing(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID | None = None,
    *,
    status: s.InterviewStatus | None = None,
    view: s.InterviewView | None = None,
    q: str | None = None,
    scheduled_from: datetime | None = None,
    scheduled_until: datetime | None = None,
    job_id: uuid.UUID | None = None,
    application_id: uuid.UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> s.InterviewPage:
    stmt = (
        select(Interview, Job, JobApplication)
        .join(JobApplication, JobApplication.id == Interview.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .join(Organization, Organization.id == Job.org_id)
        .where(
            JobApplication.deleted_at.is_(None),
            Organization.status == "active",
            Organization.deleted_at.is_(None),
        )
    )
    if org_id:
        member = await pipeline.authorize(db, user, org_id)
        stmt = stmt.where(Job.org_id == org_id)
        if member.role not in pipeline.MANAGERS:
            stmt = stmt.where(
                or_(
                    Job.owner_id == user.id,
                    JobApplication.assignee_id == user.id,
                    Interview.id.in_(
                        select(InterviewParticipant.interview_id).where(
                            InterviewParticipant.user_id == user.id,
                            InterviewParticipant.side.in_(["interviewer", "observer"]),
                        )
                    ),
                )
            )
    else:
        await common.seeker(db, user)
        stmt = stmt.where(JobApplication.applicant_id == user.id)
    if view == "upcoming":
        stmt = stmt.where(Interview.status.in_(LIVE), Interview.scheduled_at >= common.now())
    elif view == "past":
        stmt = stmt.where(or_(Interview.status.not_in(LIVE), Interview.scheduled_at < common.now()))
    elif view == "needs_feedback":
        stmt = stmt.where(
            Interview.status == "completed",
            Interview.id.in_(
                select(InterviewParticipant.interview_id).where(
                    InterviewParticipant.user_id == user.id,
                    InterviewParticipant.side == "interviewer",
                )
            ),
            ~Interview.id.in_(
                select(InterviewFeedback.interview_id).where(InterviewFeedback.author_id == user.id)
            ),
        )
    elif view == "needs_action":
        stmt = stmt.where(
            Interview.status.in_(LIVE),
            Interview.scheduled_at > common.now(),
            Interview.id.in_(
                select(InterviewParticipant.interview_id).where(
                    InterviewParticipant.user_id == user.id, InterviewParticipant.response.is_(None)
                )
            ),
        )
    if q:
        pattern = "%" + job_service._escape_like(q.strip()) + "%"
        stmt = stmt.where(
            or_(
                Job.title.ilike(pattern, escape="\\"),
                Interview.round_name.ilike(pattern, escape="\\"),
                JobApplication.job_snapshot["company_name"].as_string().ilike(pattern, escape="\\"),
            )
        )
    if scheduled_from:
        stmt = stmt.where(Interview.scheduled_at >= scheduled_from)
    if scheduled_until:
        stmt = stmt.where(Interview.scheduled_at < scheduled_until)
    if status:
        stmt = stmt.where(Interview.status == status)
    if job_id:
        stmt = stmt.where(Job.id == job_id)
    if application_id:
        stmt = stmt.where(JobApplication.id == application_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (
        await db.execute(
            stmt.order_by(Interview.scheduled_at, Interview.id).limit(limit).offset(offset)
        )
    ).all()
    return s.InterviewPage(
        **common.page(
            [await project(db, row, job, app, user, own=org_id is None) for row, job, app in rows],
            total or 0,
            limit,
            offset,
        )
    )


async def patch(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.InterviewPatch
) -> s.InterviewRead:
    job, app, row = await staff(db, user, org_id, id_, True)
    pipeline.writable(job, app)
    values = payload.model_dump(exclude={"expected_version"})
    equal = all(
        aware(row.scheduled_at) == aware(v) if k == "scheduled_at" else getattr(row, k) == v
        for k, v in values.items()
    )
    if equal:
        return await project(db, row, job, app, user)
    common.expect(row, payload.expected_version)
    if row.status not in LIVE:
        raise conflict("Only pending interviews can be rescheduled.")
    ids = list(
        (
            await db.execute(
                select(InterviewParticipant.user_id).where(InterviewParticipant.interview_id == id_)
            )
        ).scalars()
    )
    await availability(db, ids, payload.scheduled_at, payload.duration_min, id_)
    for k, v in values.items():
        setattr(row, k, v)
    row.status = "scheduled"
    for p in (
        await db.execute(
            select(InterviewParticipant).where(InterviewParticipant.interview_id == id_)
        )
    ).scalars():
        p.response = p.responded_at = None
    common.touch(row)
    common.audit(db, user, org_id, "interview", id_, "rescheduled")
    await db.commit()
    return await project(db, row, job, app, user)


async def participants(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.ParticipantsPut
) -> s.InterviewRead:
    job, app, row = await staff(db, user, org_id, id_, True)
    pipeline.writable(job, app)
    old = list(
        (
            await db.execute(
                select(InterviewParticipant).where(
                    InterviewParticipant.interview_id == id_,
                    InterviewParticipant.side != "candidate",
                )
            )
        ).scalars()
    )
    if {(p.user_id, p.side) for p in old} == {(p.user_id, p.side) for p in payload.participants}:
        return await project(db, row, job, app, user)
    common.expect(row, payload.expected_version)
    if row.status not in LIVE:
        raise conflict("Only pending interviews can change participants.")
    await panel(db, org_id, app, payload.participants)
    await availability(
        db,
        [app.applicant_id, *[p.user_id for p in payload.participants]],
        row.scheduled_at,
        row.duration_min,
        id_,
    )
    await db.execute(
        delete(InterviewParticipant).where(
            InterviewParticipant.interview_id == id_, InterviewParticipant.side != "candidate"
        )
    )
    db.add_all(
        [
            InterviewParticipant(interview_id=id_, user_id=p.user_id, side=p.side)
            for p in payload.participants
        ]
    )
    row.status = "scheduled"
    common.touch(row)
    common.audit(db, user, org_id, "interview", id_, "participants_changed")
    await db.commit()
    return await project(db, row, job, app, user)


async def transition(
    db: AsyncSession, user: User, org_id: uuid.UUID, id_: uuid.UUID, payload: s.InterviewTransition
) -> s.InterviewRead:
    job, app, row = await staff(db, user, org_id, id_, True)
    common.active_application(app)
    target = {"cancel": "cancelled", "complete": "completed", "no_show": "no_show"}[payload.action]
    if row.status == target:
        return await project(db, row, job, app, user)
    common.expect(row, payload.expected_version)
    if row.status not in LIVE:
        raise conflict("This interview is terminal.")
    if (
        target != "cancelled"
        and aware(row.scheduled_at) + timedelta(minutes=row.duration_min) > common.now()
    ):
        raise conflict("Wait until the scheduled interview ends.")
    row.status = target
    row.cancelled_reason = payload.reason if target == "cancelled" else None
    common.touch(row)
    common.audit(db, user, org_id, "interview", id_, target)
    await db.commit()
    return await project(db, row, job, app, user)


async def attendance(
    db: AsyncSession,
    user: User,
    id_: uuid.UUID,
    payload: s.AttendancePut,
    org_id: uuid.UUID | None = None,
) -> s.InterviewRead:
    job, app, row = await (
        staff(db, user, org_id, id_, True, panel_access=True)
        if org_id
        else candidate(db, user, id_, True)
    )
    common.active_application(app)
    p = await db.get(InterviewParticipant, (id_, user.id))
    if p is None:
        raise forbidden("Only participants can respond.")
    if p.response == payload.response:
        return await project(db, row, job, app, user, own=org_id is None)
    common.expect(row, payload.expected_version)
    if row.status not in LIVE or aware(row.scheduled_at) <= common.now():
        raise conflict("Attendance is closed.")
    p.response, p.responded_at = payload.response, common.now()
    await db.flush()
    all_p = list(
        (
            await db.execute(
                select(InterviewParticipant).where(InterviewParticipant.interview_id == id_)
            )
        ).scalars()
    )
    row.status = "confirmed" if all(v.response == "accepted" for v in all_p) else "scheduled"
    common.touch(row)
    common.audit(db, user, job.org_id, "interview", id_, "attendance_changed")
    await db.commit()
    return await project(db, row, job, app, user, own=org_id is None)


async def feedback(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    id_: uuid.UUID,
    *,
    payload: s.FeedbackPut | None = None,
    limit: int = 20,
    offset: int = 0,
) -> s.FeedbackRead | s.FeedbackPage:
    job, app, row = await staff(db, user, org_id, id_, payload is not None, panel_access=True)
    stmt = select(InterviewFeedback).where(
        InterviewFeedback.interview_id == id_, InterviewFeedback.author_id == user.id
    )
    old = (await db.execute(stmt)).scalar_one_or_none()
    if payload is not None:
        common.active_application(app)
        p = await db.get(InterviewParticipant, (id_, user.id))
        if p is None or p.side != "interviewer" or user.id == app.applicant_id:
            raise forbidden("Only panel interviewers can submit feedback.")
        if row.status != "completed":
            raise conflict("Feedback requires a completed interview.")
        if old and old.recommendation == payload.recommendation and old.summary == payload.summary:
            return s.FeedbackRead.model_validate(old)
        if old is None:
            old = InterviewFeedback(
                interview_id=id_,
                author_id=user.id,
                recommendation=payload.recommendation,
                summary=payload.summary,
            )
            db.add(old)
        else:
            old.recommendation, old.summary, old.updated_at = (
                payload.recommendation,
                payload.summary,
                common.now(),
            )
        common.audit(db, user, org_id, "interview", id_, "feedback_saved")
        await db.commit()
        return s.FeedbackRead.model_validate(old)
    # Even organization owners cannot read another author's feedback.
    return s.FeedbackPage(
        **common.page(
            [s.FeedbackRead.model_validate(old)] if old and offset == 0 else [],
            int(old is not None),
            limit,
            offset,
        )
    )
