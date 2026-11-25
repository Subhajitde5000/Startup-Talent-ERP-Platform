"""Step 7f interviews: schedule, edit, cancel, complete, respond, feedback.

Reuse of earlier steps (no parallel systems):

- Organization gate mirrors 7d/7e: active employer/startup org, hiring
  global role, active membership with ``{owner, admin, member}``.
- ``applicant_pipeline_service.writable`` enforces the closed/archived
  job and terminal-application read-only rules.
- Scope rules follow the approved plan: scheduling and lifecycle actions
  are owner/admin/job-owner only (7d stage-write rule); reads are
  owner/admin for everything and ordinary members for their own jobs,
  assigned applications, or interviews they sit on as a participant;
  feedback is interviewer-participants only; the candidate sees only
  their own application's interviews, never feedback or internal notes.

Interview writes use their own rate-limit keys (INTERVIEW_*), not the 7d
applicant budget. Double-booking (plan D9) is a best-effort overlap check
per panelist inside the request transaction, same approach as 8d.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_role
from app.core.exceptions import conflict, forbidden, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.interview import Interview, InterviewFeedback, InterviewParticipant
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.organization import Organization, OrganizationMember, OrgRole, OrgType
from app.models.user import User, UserRole, UserRoleRow
from app.schemas.interview import (
    CandidateInterviewPage,
    CandidateInterviewRead,
    FeedbackPut,
    FeedbackRead,
    InterviewCancel,
    InterviewCreate,
    InterviewDetailRead,
    InterviewPage,
    InterviewRead,
    InterviewStatus,
    InterviewUpdate,
    ParticipantRead,
    RespondPut,
)
from app.schemas.job_application import ProfileSnapshot
from app.services import (
    activity_service,
    applicant_pipeline_service,
    job_service,
    organization_service,
)
from app.services.rate_limiter import rate_limiter

MANAGERS = {OrgRole.owner, OrgRole.admin}
_READ_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}
LIVE_STATUSES = ("scheduled", "confirmed")
_EMPLOYER = require_role(UserRole.employer)
_STARTUP_HIRING = require_role(UserRole.employer, UserRole.startup)

Window = Literal["upcoming", "past"]


def _aware(value: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; normalise before comparing."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


async def _org_member(db: AsyncSession, user: User, org_id: uuid.UUID) -> OrganizationMember:
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    return await organization_service.require_membership(db, org.id, user, roles=set(_READ_ROLES))


async def _limit(user: User, *, write: bool) -> None:
    settings = get_settings()
    if write:
        ok = await rate_limiter.check(
            f"interview_write:{user.id}",
            settings.INTERVIEW_WRITE_LIMIT,
            settings.INTERVIEW_WRITE_WINDOW_SECONDS,
        )
        message = "Too many interview changes. Please try again later."
    else:
        ok = await rate_limiter.check(
            f"interview_read:{user.id}", settings.INTERVIEW_READ_LIMIT, 60
        )
        message = "Too many interview requests. Please try again later."
    if not ok:
        raise rate_limited(message)


async def _read_gate(db: AsyncSession, user: User, org_id: uuid.UUID) -> OrganizationMember:
    member = await _org_member(db, user, org_id)
    await _limit(user, write=False)
    return member


async def _write_gate(db: AsyncSession, user: User, org_id: uuid.UUID) -> OrganizationMember:
    member = await _org_member(db, user, org_id)
    await _limit(user, write=True)
    return member


def _in_app_scope(member: OrganizationMember, job: Job, user: User, row: JobApplication) -> bool:
    return member.role in MANAGERS or job.owner_id == user.id or row.assignee_id == user.id


async def _app_scope(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    member: OrganizationMember,
    *,
    lock: bool = False,
) -> tuple[Job, JobApplication]:
    """7d ``scoped`` semantics (same shape, no rate limiter — 7f owns its budget)."""
    job = await job_service._job(db, org_id, job_id, lock=lock, include_archived=True)
    stmt = select(JobApplication).where(
        JobApplication.id == application_id,
        JobApplication.job_id == job.id,
        JobApplication.deleted_at.is_(None),
    )
    if member.role not in MANAGERS and job.owner_id != user.id:
        stmt = stmt.where(JobApplication.assignee_id == user.id)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Application not found.")
    return job, row


async def _interview_in_org(
    db: AsyncSession, org_id: uuid.UUID, interview_id: uuid.UUID, *, lock: bool = False
) -> tuple[Interview, JobApplication, Job]:
    stmt = (
        select(Interview, JobApplication, Job)
        .join(JobApplication, JobApplication.id == Interview.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .where(
            Interview.id == interview_id,
            Job.org_id == org_id,
            JobApplication.deleted_at.is_(None),
        )
    )
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    result = (await db.execute(stmt)).first()
    if result is None:
        raise not_found("Interview not found.")
    return result[0], result[1], result[2]


async def _eligible_panelist(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, index: int
) -> None:
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
        message = "Each interviewer must be an eligible hiring member of this organization."
        raise validation_error(
            message,
            details=[
                {
                    "loc": ["body", "interviewer_ids", index],
                    "msg": message,
                    "type": "value_error",
                }
            ],
        )


def _validate_future(scheduled_at: datetime) -> None:
    if scheduled_at <= datetime.now(UTC):
        raise validation_error(
            "An interview must be scheduled in the future.",
            details=[
                {
                    "loc": ["body", "scheduled_at"],
                    "msg": "Must be in the future.",
                    "type": "value_error",
                }
            ],
        )


async def _assert_no_conflict(
    db: AsyncSession,
    interviewer_ids: set[uuid.UUID],
    start: datetime,
    duration_min: int,
    *,
    exclude_interview_id: uuid.UUID | None = None,
) -> None:
    """Plan D9: best-effort per-panelist overlap check (8d approach)."""
    if not interviewer_ids:
        return
    end = start + timedelta(minutes=duration_min)
    stmt = (
        select(
            Interview.id,
            Interview.scheduled_at,
            Interview.duration_min,
            InterviewParticipant.user_id,
        )
        .join(InterviewParticipant, InterviewParticipant.interview_id == Interview.id)
        .where(
            InterviewParticipant.user_id.in_(interviewer_ids),
            Interview.status != "cancelled",
            Interview.scheduled_at < end,
            # Any overlapping row starts within max duration (480 min) of us.
            Interview.scheduled_at > start - timedelta(minutes=480),
        )
        .with_for_update()
    )
    if exclude_interview_id is not None:
        stmt = stmt.where(Interview.id != exclude_interview_id)
    for _, other_start, other_min, _user in (await db.execute(stmt)).all():
        beg = _aware(other_start)
        if beg is None:  # pragma: no cover - scheduled_at is NOT NULL
            continue
        other_end = beg + timedelta(minutes=other_min)
        if beg < end and start < other_end:
            raise conflict(
                "A panelist already has an overlapping interview at that time.",
                "INTERVIEWER_CONFLICT",
            )


async def _participants(
    db: AsyncSession, interview_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[ParticipantRead]]:
    if not interview_ids:
        return {}
    rows = (
        await db.execute(
            select(InterviewParticipant, User.display_name)
            .join(User, User.id == InterviewParticipant.user_id)
            .where(InterviewParticipant.interview_id.in_(interview_ids))
            .order_by(
                InterviewParticipant.side.desc(),
                User.display_name,
                InterviewParticipant.user_id,
            )
        )
    ).all()
    grouped: dict[uuid.UUID, list[ParticipantRead]] = {}
    for participant, display_name in rows:
        grouped.setdefault(participant.interview_id, []).append(
            ParticipantRead(
                user_id=participant.user_id,
                side=participant.side,  # type: ignore[arg-type]
                display_name=display_name,
                response=participant.response,  # type: ignore[arg-type]
                responded_at=_aware(participant.responded_at),
            )
        )
    return grouped


async def _feedback_rows(db: AsyncSession, interview_id: uuid.UUID) -> list[FeedbackRead]:
    rows = (
        await db.execute(
            select(InterviewFeedback, User.display_name)
            .join(User, User.id == InterviewFeedback.author_id)
            .where(InterviewFeedback.interview_id == interview_id)
            .order_by(InterviewFeedback.submitted_at, InterviewFeedback.id)
        )
    ).all()
    return [
        FeedbackRead(
            id=feedback.id,
            interview_id=feedback.interview_id,
            author_id=feedback.author_id,
            author_name=display_name,
            recommendation=feedback.recommendation,  # type: ignore[arg-type]
            summary=feedback.summary,
            submitted_at=feedback.submitted_at,
            updated_at=feedback.updated_at,
        )
        for feedback, display_name in rows
    ]


async def _my_feedback_authors(
    db: AsyncSession, interview_ids: list[uuid.UUID], user_id: uuid.UUID
) -> set[uuid.UUID]:
    if not interview_ids:
        return set()
    rows = (
        await db.execute(
            select(InterviewFeedback.interview_id).where(
                InterviewFeedback.interview_id.in_(interview_ids),
                InterviewFeedback.author_id == user_id,
            )
        )
    ).scalars()
    return set(rows)


def _label(row: JobApplication, blind: bool) -> str:
    if blind:
        return f"Candidate {row.id}"
    profile = ProfileSnapshot.model_validate(row.profile_snapshot)
    return profile.contact.name


async def _read(
    db: AsyncSession,
    user: User,
    interview: Interview,
    app: JobApplication,
    job: Job,
    participants: list[ParticipantRead],
    feedback_authors: set[uuid.UUID],
) -> InterviewRead:
    needs_my_feedback = (
        interview.status == "completed"
        and any(p.user_id == user.id and p.side == "interviewer" for p in participants)
        # ``feedback_authors`` holds interview ids where the caller has
        # already submitted (see _my_feedback_authors), not author ids.
        and interview.id not in feedback_authors
    )
    return InterviewRead(
        id=interview.id,
        application_id=interview.application_id,
        job_id=job.id,
        job_title=job.title,
        candidate_label=_label(app, app.is_blind),
        is_blind=app.is_blind,
        round_name=interview.round_name,
        format=interview.format,  # type: ignore[arg-type]
        status=interview.status,  # type: ignore[arg-type]
        scheduled_at=_aware(interview.scheduled_at) or interview.scheduled_at,
        duration_min=interview.duration_min,
        location=interview.location,
        meeting_url=interview.meeting_url,
        created_by=interview.created_by,
        cancelled_reason=interview.cancelled_reason,
        participants=participants,
        needs_my_feedback=needs_my_feedback,
        created_at=interview.created_at,
        updated_at=interview.updated_at,
    )


def _audit(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    event: ActivityEventType,
    entity_id: uuid.UUID,
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=event.value.replace("_", " ").capitalize() + ".",
        org_id=org_id,
        actor_id=user.id,
        entity_type="interview",
        entity_id=entity_id,
    )


async def detail(
    db: AsyncSession, user: User, org_id: uuid.UUID, interview_id: uuid.UUID
) -> InterviewDetailRead:
    member = await _read_gate(db, user, org_id)
    interview, app, job = await _interview_in_org(db, org_id, interview_id)
    if not (
        _in_app_scope(member, job, user, app)
        or any(
            p.user_id == user.id
            for p in (
                await db.execute(
                    select(InterviewParticipant).where(
                        InterviewParticipant.interview_id == interview.id,
                        InterviewParticipant.user_id == user.id,
                    )
                )
            ).scalars()
        )
    ):
        raise not_found("Interview not found.")
    participants = (await _participants(db, [interview.id])).get(interview.id, [])
    feedback_authors = await _my_feedback_authors(db, [interview.id], user.id)
    base = await _read(db, user, interview, app, job, participants, feedback_authors)
    return InterviewDetailRead(
        **base.model_dump(),
        feedback=await _feedback_rows(db, interview.id),
    )


async def list_interviews(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    window: Window | None,
    status: InterviewStatus | None,
    needs_feedback: bool,
    job_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> InterviewPage:
    member = await _read_gate(db, user, org_id)
    now = datetime.now(UTC)
    stmt = (
        select(Interview, JobApplication, Job)
        .join(JobApplication, JobApplication.id == Interview.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .where(Job.org_id == org_id, JobApplication.deleted_at.is_(None))
    )
    if member.role not in MANAGERS:
        # Ordinary members: their own jobs, assigned applications, or any
        # interview they sit on as a participant (panelist access).
        stmt = stmt.where(
            or_(
                Job.owner_id == user.id,
                JobApplication.assignee_id == user.id,
                exists(
                    select(InterviewParticipant.interview_id).where(
                        InterviewParticipant.interview_id == Interview.id,
                        InterviewParticipant.user_id == user.id,
                    )
                ),
            )
        )
    if job_id is not None:
        await job_service._job(db, org_id, job_id)
        stmt = stmt.where(JobApplication.job_id == job_id)
    if status is not None:
        stmt = stmt.where(Interview.status == status)
    if window == "upcoming":
        stmt = stmt.where(Interview.status.in_(list(LIVE_STATUSES)), Interview.scheduled_at >= now)
    elif window == "past":
        stmt = stmt.where(
            or_(
                ~Interview.status.in_(list(LIVE_STATUSES)),
                Interview.scheduled_at < now,
            )
        )
    if needs_feedback:
        stmt = stmt.where(
            Interview.status == "completed",
            exists(
                select(InterviewParticipant.interview_id).where(
                    InterviewParticipant.interview_id == Interview.id,
                    InterviewParticipant.user_id == user.id,
                    InterviewParticipant.side == "interviewer",
                )
            ),
            ~exists(
                select(InterviewFeedback.id).where(
                    InterviewFeedback.interview_id == Interview.id,
                    InterviewFeedback.author_id == user.id,
                )
            ),
        )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    if window == "upcoming":
        ordering = (Interview.scheduled_at.asc(), Interview.id.asc())
    else:
        ordering = (Interview.scheduled_at.desc(), Interview.id.desc())
    rows = (await db.execute(stmt.order_by(*ordering).limit(limit).offset(offset))).all()
    ids = [interview.id for interview, _, _ in rows]
    participant_map = await _participants(db, ids)
    mine = await _my_feedback_authors(db, ids, user.id)
    items = [
        await _read(db, user, interview, app, job, participant_map.get(interview.id, []), mine)
        for interview, app, job in rows
    ]
    return InterviewPage(
        items=items, total=total, limit=limit, offset=offset, has_more=offset + len(rows) < total
    )


async def schedule(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: InterviewCreate,
) -> InterviewDetailRead:
    member = await _write_gate(db, user, org_id)
    job, row = await _app_scope(db, user, org_id, job_id, application_id, member, lock=True)
    if member.role not in MANAGERS and job.owner_id != user.id:
        raise forbidden("Only owners, admins or the job owner can schedule interviews.")
    applicant_pipeline_service.writable(job, row)
    _validate_future(payload.scheduled_at)
    for index, panelist in enumerate(payload.interviewer_ids):
        await _eligible_panelist(db, org_id, panelist, index)
    if row.applicant_id in payload.interviewer_ids:
        raise validation_error(
            "The candidate cannot be an interviewer.",
            details=[
                {
                    "loc": ["body", "interviewer_ids"],
                    "msg": "The candidate cannot be an interviewer.",
                    "type": "value_error",
                }
            ],
        )
    await _assert_no_conflict(
        db, set(payload.interviewer_ids), payload.scheduled_at, payload.duration_min
    )
    interview = Interview(
        application_id=row.id,
        round_name=payload.round_name,
        format=payload.format,
        status="scheduled",
        scheduled_at=payload.scheduled_at,
        duration_min=payload.duration_min,
        location=payload.location,
        meeting_url=payload.meeting_url,
        created_by=user.id,
    )
    db.add(interview)
    await db.flush()
    db.add(
        InterviewParticipant(interview_id=interview.id, user_id=row.applicant_id, side="candidate")
    )
    for panelist in payload.interviewer_ids:
        db.add(
            InterviewParticipant(interview_id=interview.id, user_id=panelist, side="interviewer")
        )
    _audit(db, user, org_id, ActivityEventType.interview_scheduled, interview.id)
    await db.commit()
    return await detail(db, user, org_id, interview.id)


async def _lifecycle_scope(
    db: AsyncSession, user: User, org_id: uuid.UUID, interview_id: uuid.UUID, *, lock: bool
) -> tuple[Interview, JobApplication, Job, OrganizationMember]:
    member = await _write_gate(db, user, org_id)
    interview, app, job = await _interview_in_org(db, org_id, interview_id, lock=lock)
    if member.role not in MANAGERS and job.owner_id != user.id:
        raise forbidden("Only owners, admins or the job owner can change interviews.")
    return interview, app, job, member


def _require_editable(interview: Interview) -> None:
    if interview.status not in LIVE_STATUSES:
        raise conflict("Only scheduled or confirmed interviews can be changed.", "INVALID_STATE")


async def update(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: InterviewUpdate,
) -> InterviewDetailRead:
    interview, _, _, _ = await _lifecycle_scope(db, user, org_id, interview_id, lock=True)
    _require_editable(interview)
    fields = payload.model_fields_set
    if "scheduled_at" in fields and payload.scheduled_at is not None:
        _validate_future(payload.scheduled_at)
    slot_moved = False
    if "scheduled_at" in fields and payload.scheduled_at is not None:
        current = _aware(interview.scheduled_at)
        if current != payload.scheduled_at:
            interview.scheduled_at = payload.scheduled_at
            slot_moved = True
    if "duration_min" in fields and payload.duration_min is not None:
        if interview.duration_min != payload.duration_min:
            interview.duration_min = payload.duration_min
            slot_moved = True
    if "format" in fields and payload.format is not None:
        interview.format = payload.format
    if "round_name" in fields:
        interview.round_name = payload.round_name
    if "location" in fields:
        interview.location = payload.location
    if "meeting_url" in fields:
        interview.meeting_url = payload.meeting_url
    if slot_moved:
        await _assert_no_conflict(
            db,
            {
                p.user_id
                for p in (
                    await db.execute(
                        select(InterviewParticipant).where(
                            InterviewParticipant.interview_id == interview.id,
                            InterviewParticipant.side == "interviewer",
                        )
                    )
                ).scalars()
            },
            _aware(interview.scheduled_at) or interview.scheduled_at,
            interview.duration_min,
            exclude_interview_id=interview.id,
        )
        # D4: a moved slot must be re-confirmed by every participant.
        for participant in (
            await db.execute(
                select(InterviewParticipant).where(
                    InterviewParticipant.interview_id == interview.id
                )
            )
        ).scalars():
            participant.response = None
            participant.responded_at = None
        _audit(db, user, org_id, ActivityEventType.interview_rescheduled, interview.id)
    await db.commit()
    return await detail(db, user, org_id, interview.id)


async def cancel(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: InterviewCancel,
) -> InterviewDetailRead:
    interview, _, _, _ = await _lifecycle_scope(db, user, org_id, interview_id, lock=True)
    _require_editable(interview)
    interview.status = "cancelled"
    interview.cancelled_reason = payload.reason
    _audit(db, user, org_id, ActivityEventType.interview_cancelled, interview.id)
    await db.commit()
    return await detail(db, user, org_id, interview.id)


async def complete(
    db: AsyncSession, user: User, org_id: uuid.UUID, interview_id: uuid.UUID
) -> InterviewDetailRead:
    interview, _, _, _ = await _lifecycle_scope(db, user, org_id, interview_id, lock=True)
    _require_editable(interview)
    interview.status = "completed"
    _audit(db, user, org_id, ActivityEventType.interview_completed, interview.id)
    await db.commit()
    return await detail(db, user, org_id, interview.id)


async def respond(
    db: AsyncSession, user: User, interview_id: uuid.UUID, payload: RespondPut
) -> ParticipantRead:
    """Either side answers for an interview they sit on; outsiders get 404."""
    await _limit(user, write=True)
    interview = (
        await db.execute(
            select(Interview)
            .where(Interview.id == interview_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if interview is None:
        raise not_found("Interview not found.")
    _require_editable(interview)
    participant = (
        await db.execute(
            select(InterviewParticipant)
            .where(
                InterviewParticipant.interview_id == interview.id,
                InterviewParticipant.user_id == user.id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if participant is None:
        raise not_found("Interview not found.")
    participant.response = payload.response
    participant.responded_at = datetime.now(UTC)
    await db.commit()
    return ParticipantRead(
        user_id=user.id,
        side=participant.side,  # type: ignore[arg-type]
        display_name=user.display_name,
        response=participant.response,  # type: ignore[arg-type]
        responded_at=_aware(participant.responded_at),
    )


async def put_feedback(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: FeedbackPut,
) -> FeedbackRead:
    member = await _write_gate(db, user, org_id)
    interview, app, job = await _interview_in_org(db, org_id, interview_id, lock=True)
    participant = (
        await db.execute(
            select(InterviewParticipant).where(
                InterviewParticipant.interview_id == interview.id,
                InterviewParticipant.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if participant is None and not _in_app_scope(member, job, user, app):
        raise not_found("Interview not found.")
    if participant is None or participant.side != "interviewer":
        raise forbidden("Only panelists can submit interview feedback.")
    if interview.status != "completed":
        raise conflict(
            "Feedback can be submitted once the interview is completed.",
            "INVALID_STATE",
        )
    existing = (
        await db.execute(
            select(InterviewFeedback)
            .where(
                InterviewFeedback.interview_id == interview.id,
                InterviewFeedback.author_id == user.id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if existing is not None:
        existing.recommendation = payload.recommendation
        existing.summary = payload.summary
        existing.submitted_at = now
        feedback = existing
    else:
        feedback = InterviewFeedback(
            interview_id=interview.id,
            author_id=user.id,
            recommendation=payload.recommendation,
            summary=payload.summary,
            submitted_at=now,
        )
        db.add(feedback)
    _audit(db, user, org_id, ActivityEventType.interview_feedback_submitted, interview.id)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise conflict("Feedback was already submitted.", "FEEDBACK_EXISTS") from exc
    await db.refresh(feedback)
    return FeedbackRead(
        id=feedback.id,
        interview_id=feedback.interview_id,
        author_id=feedback.author_id,
        author_name=user.display_name,
        recommendation=feedback.recommendation,  # type: ignore[arg-type]
        summary=feedback.summary,
        submitted_at=feedback.submitted_at,
        updated_at=feedback.updated_at,
    )


async def _own_application(
    db: AsyncSession, user: User, application_id: uuid.UUID
) -> JobApplication:
    row = (
        await db.execute(
            select(JobApplication).where(
                JobApplication.id == application_id,
                JobApplication.applicant_id == user.id,
                JobApplication.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Application not found.")
    return row


async def _candidate_read(
    db: AsyncSession, interview: Interview, job: Job, company_name: str
) -> CandidateInterviewRead:
    participants = (await _participants(db, [interview.id])).get(interview.id, [])
    return CandidateInterviewRead(
        id=interview.id,
        application_id=interview.application_id,
        job_id=job.id,
        job_title=job.title,
        company_name=company_name,
        round_name=interview.round_name,
        format=interview.format,  # type: ignore[arg-type]
        status=interview.status,  # type: ignore[arg-type]
        scheduled_at=_aware(interview.scheduled_at) or interview.scheduled_at,
        duration_min=interview.duration_min,
        location=interview.location,
        meeting_url=interview.meeting_url,
        participants=participants,
        created_at=interview.created_at,
        updated_at=interview.updated_at,
    )


async def candidate_list(
    db: AsyncSession,
    user: User,
    application_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
) -> CandidateInterviewPage:
    app = await _own_application(db, user, application_id)
    stmt = select(Interview).where(Interview.application_id == app.id)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = list(
        (
            await db.execute(
                stmt.order_by(Interview.scheduled_at.desc(), Interview.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    job = await db.get(Job, app.job_id)
    if job is None:  # pragma: no cover - FK guarantees the job
        raise not_found("Application not found.")
    org = await db.get(Organization, job.org_id)
    if org is None:  # pragma: no cover - FK guarantees the organization
        raise not_found("Application not found.")
    items = [await _candidate_read(db, row, job, org.name) for row in rows]
    return CandidateInterviewPage(
        items=items, total=total, limit=limit, offset=offset, has_more=offset + len(rows) < total
    )


async def candidate_detail(
    db: AsyncSession, user: User, application_id: uuid.UUID, interview_id: uuid.UUID
) -> CandidateInterviewRead:
    app = await _own_application(db, user, application_id)
    interview = (
        await db.execute(
            select(Interview).where(
                Interview.id == interview_id, Interview.application_id == app.id
            )
        )
    ).scalar_one_or_none()
    if interview is None:
        raise not_found("Interview not found.")
    job = await db.get(Job, app.job_id)
    if job is None:  # pragma: no cover - FK guarantees the job
        raise not_found("Interview not found.")
    org = await db.get(Organization, job.org_id)
    if org is None:  # pragma: no cover - FK guarantees the organization
        raise not_found("Interview not found.")
    return await _candidate_read(db, interview, job, org.name)
