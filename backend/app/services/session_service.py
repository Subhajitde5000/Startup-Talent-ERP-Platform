"""Step 8d service: mentoring sessions.

State machine::

    scheduled --confirm--> confirmed
        |                       |
        +------ cancel ---------+--> cancelled
        |
        +------ reschedule ------> scheduled (new instant, same row)
        |
        +------ complete --------> completed   (mentor only)
        +------ no_show ---------> no_show     (mentor only)

``proposed`` exists in the enum because schema.sql has it and 8d may later
let a startup propose an alternative time; this step creates sessions
already ``scheduled``, so no route produces ``proposed`` today. It is kept
in the enum and in ``LIVE_STATUSES`` so such a row would still hold its
slot — dropping it would mean a future migration.

Double booking, the two guarantees from the model docstring:

1. Same mentorship, same instant -> a partial UNIQUE index. The service
   catches IntegrityError and returns 409 ``SLOT_TAKEN``.
2. Same MENTOR, same instant across different mentorships -> the service
   locks the mentor's live session rows for the window and compares
   ``[start, end)`` overlap, inside the request transaction.

Authorization is the mentorship's: a session is visible to the mentor on
the row and to any active member of that startup. Everyone else gets 404.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    conflict,
    forbidden,
    not_found,
    rate_limited,
    validation_error,
)
from app.models.mentorship import Mentorship, MentorshipStatus
from app.models.organization import OrganizationMember
from app.models.session import (
    LIVE_STATUSES,
    AttendeeRole,
    MentoringSession,
    SessionAttendee,
    SessionStatus,
)
from app.models.session_review import SessionReview
from app.models.user import User
from app.schemas.session import (
    SessionAttendeeRead,
    SessionCreate,
    SessionPage,
    SessionRead,
    SessionReschedule,
)
from app.services import agreement_service, earning_service, mentorship_service, rate_limiter

# Statuses in which a session may still be changed.
EDITABLE: frozenset[SessionStatus] = frozenset(
    {SessionStatus.proposed, SessionStatus.scheduled, SessionStatus.confirmed}
)

# How close to the start the join link becomes useful.
JOIN_WINDOW_MINUTES = 15


def _aware(value: datetime | None) -> datetime | None:
    """Normalise a DB datetime to aware UTC.

    SQLite returns naive datetimes even for ``DateTime(timezone=True)``
    columns, so every comparison against ``datetime.now(UTC)`` must go
    through this. Same helper (and same reason) as ``auth_service._aware``.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


async def _enforce_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"session_write:user:{user.id}",
        settings.SESSION_WRITE_LIMIT,
        settings.SESSION_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many session changes. Please slow down.")


def _initials(name: str | None) -> str:
    parts = [p for p in (name or "?").split() if p]
    return "".join(p[0] for p in parts[:2]).upper() or "?"


async def _can_write(db: AsyncSession, mentorship: Mentorship, user: User) -> str:
    """Which side the caller is on for WRITE purposes, or 404/403.

    A viewer is an active member, so they can READ, but never move a
    session: the 5d/5g read-only rule, applied here.
    """
    if mentorship.mentor_id == user.id:
        return "mentor"
    role = (
        await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.org_id == mentorship.startup_org_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == "active",
            )
        )
    ).scalar_one_or_none()
    if role is None:
        raise not_found("Session not found.")
    if role == "viewer":
        raise forbidden("Viewers cannot change a session.")
    return "startup"


async def _load_mentorship(db: AsyncSession, mentorship_id: uuid.UUID) -> Mentorship:
    row = (
        await db.execute(
            select(Mentorship).where(
                Mentorship.id == mentorship_id, Mentorship.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Mentorship not found.")
    return row


def _require_working_mentorship(mentorship: Mentorship) -> None:
    """Sessions belong to a live engagement, not a declined request."""
    if MentorshipStatus(mentorship.status) not in (
        MentorshipStatus.active,
        MentorshipStatus.paused,
    ):
        raise conflict(
            "Sessions can only be scheduled on an active mentorship.",
            code="INVALID_STATE",
        )


def _validate_window(scheduled_at: datetime, duration_min: int) -> None:
    """Future, inside the booking horizon, sane duration."""
    settings = get_settings()
    now = datetime.now(UTC)
    if scheduled_at <= now:
        raise validation_error(
            "A session must be scheduled in the future.",
            details=[
                {
                    "loc": ["body", "scheduled_at"],
                    "msg": "Must be in the future.",
                    "type": "value_error",
                }
            ],
        )
    horizon = now + timedelta(days=settings.SESSION_MAX_DAYS_AHEAD)
    if scheduled_at > horizon:
        raise validation_error(
            f"A session may be booked at most {settings.SESSION_MAX_DAYS_AHEAD} days ahead.",
            details=[
                {
                    "loc": ["body", "scheduled_at"],
                    "msg": f"At most {settings.SESSION_MAX_DAYS_AHEAD} days ahead.",
                    "type": "value_error",
                }
            ],
        )


async def _mentor_conflict(
    db: AsyncSession,
    mentor_id: uuid.UUID,
    start: datetime,
    end: datetime,
    *,
    exclude_session_id: uuid.UUID | None = None,
) -> bool:
    """Is this mentor already in a session that overlaps [start, end)?

    ``with_for_update`` on the joined rows serialises two concurrent
    bookings for the same mentor, which is the guarantee a plain SELECT
    would not give. SQLite ignores it, which is fine: SQLite serialises
    writers anyway.
    """
    stmt = (
        select(MentoringSession.id)
        .join(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
        .where(
            Mentorship.mentor_id == mentor_id,
            MentoringSession.status.in_([s.value for s in LIVE_STATUSES]),
        )
        .with_for_update()
    )
    if exclude_session_id is not None:
        stmt = stmt.where(MentoringSession.id != exclude_session_id)

    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return False

    # Compare in Python: the overlap predicate needs each row's own
    # duration, which a single SQL range could not express without a
    # generated column. The candidate set is one mentor's live sessions.
    detail = (
        await db.execute(
            select(MentoringSession.scheduled_at, MentoringSession.duration_min).where(
                MentoringSession.id.in_(rows)
            )
        )
    ).all()
    for other_start, other_min in detail:
        # SQLite hands back naive datetimes; normalise before comparing.
        beg = _aware(other_start)
        if beg is None:  # pragma: no cover - scheduled_at is NOT NULL
            continue
        other_end = beg + timedelta(minutes=other_min)
        if beg < end and start < other_end:
            return True
    return False


async def _same_mentorship_conflict(
    db: AsyncSession,
    mentorship_id: uuid.UUID,
    scheduled_at: datetime,
    *,
    exclude_session_id: uuid.UUID | None = None,
) -> bool:
    stmt = (
        select(MentoringSession.id)
        .where(
            MentoringSession.mentorship_id == mentorship_id,
            MentoringSession.scheduled_at == scheduled_at,
            MentoringSession.status.in_([s.value for s in LIVE_STATUSES]),
        )
        .limit(1)
    )
    if exclude_session_id is not None:
        stmt = stmt.where(MentoringSession.id != exclude_session_id)
    return (await db.execute(stmt)).first() is not None


def _can_join(status: str, scheduled_at: datetime, duration_min: int) -> bool:
    if status != SessionStatus.confirmed.value:
        return False
    now = datetime.now(UTC)
    start = _aware(scheduled_at)
    if start is None:  # pragma: no cover - scheduled_at is NOT NULL
        return False
    end = start + timedelta(minutes=duration_min)
    return start - timedelta(minutes=JOIN_WINDOW_MINUTES) <= now <= end


async def _as_read(
    db: AsyncSession, row: MentoringSession, mentorship: Mentorship, user: User
) -> SessionRead:
    side = "mentor" if mentorship.mentor_id == user.id else "startup"

    attendee_rows = (
        await db.execute(
            select(
                SessionAttendee.user_id,
                SessionAttendee.role,
                User.display_name,
                OrganizationMember.role,
                SessionReview.id,
            )
            .join(User, User.id == SessionAttendee.user_id)
            .outerjoin(
                OrganizationMember,
                (OrganizationMember.user_id == SessionAttendee.user_id)
                & (OrganizationMember.org_id == mentorship.startup_org_id)
                & (OrganizationMember.status == "active")
                & OrganizationMember.deleted_at.is_(None),
            )
            .outerjoin(
                SessionReview,
                (SessionReview.session_id == SessionAttendee.session_id)
                & (SessionReview.reviewer_id == SessionAttendee.user_id),
            )
            .where(SessionAttendee.session_id == row.id)
            .order_by(SessionAttendee.created_at)
        )
    ).all()

    can_review = (
        side == "startup"
        and row.status == SessionStatus.completed
        and any(
            uid == user.id
            and role == AttendeeRole.startup
            and member_role in ("owner", "admin", "member")
            and review_id is None
            for uid, role, _, member_role, review_id in attendee_rows
        )
    )

    return SessionRead(
        id=row.id,
        mentorship_id=row.mentorship_id,
        status=SessionStatus(row.status),
        topic=row.topic,
        session_type=row.session_type,
        scheduled_at=row.scheduled_at,
        duration_min=row.duration_min,
        meeting_url=row.meeting_url,
        summary=row.summary,
        action_items=list(row.action_items or []),
        fee_amount=row.fee_amount,
        currency=row.currency,
        completed_at=row.completed_at,
        cancelled_reason=row.cancelled_reason,
        created_at=row.created_at,
        updated_at=row.updated_at,
        attendees=[
            SessionAttendeeRead(
                user_id=uid,
                display_name=name,
                role=AttendeeRole(role),
            )
            for uid, role, name, _, _ in attendee_rows
        ],
        viewer_side=side,  # type: ignore[arg-type]
        can_join=_can_join(row.status, row.scheduled_at, row.duration_min),
        can_review=can_review,
    )


async def _sync_mentorship_times(db: AsyncSession, mentorship: Mentorship) -> None:
    """Keep the denormalised next/last session stamps true.

    ``mentorships.next_session_at`` and ``last_session_at`` exist so the
    lists do not need a join; they are derived here and never client input.
    """
    now = datetime.now(UTC)
    next_at = (
        await db.execute(
            select(func.min(MentoringSession.scheduled_at)).where(
                MentoringSession.mentorship_id == mentorship.id,
                MentoringSession.status.in_([s.value for s in LIVE_STATUSES]),
                MentoringSession.scheduled_at > now,
            )
        )
    ).scalar_one_or_none()
    last_at = (
        await db.execute(
            select(func.max(MentoringSession.scheduled_at)).where(
                MentoringSession.mentorship_id == mentorship.id,
                MentoringSession.status == SessionStatus.completed.value,
            )
        )
    ).scalar_one_or_none()
    mentorship.next_session_at = next_at
    mentorship.last_session_at = last_at


# ------------------------------------------------------------------- create


async def schedule(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, payload: SessionCreate
) -> SessionRead:
    await _enforce_write_limit(user)
    mentorship = await _load_mentorship(db, mentorship_id)
    await _can_write(db, mentorship, user)
    _require_working_mentorship(mentorship)
    _validate_window(payload.scheduled_at, payload.duration_min)

    start = payload.scheduled_at
    end = start + timedelta(minutes=payload.duration_min)

    if await _same_mentorship_conflict(db, mentorship.id, start):
        raise conflict(
            "A session is already booked at that time for this mentorship.",
            code="SLOT_TAKEN",
        )
    if await _mentor_conflict(db, mentorship.mentor_id, start, end):
        raise conflict("The mentor already has a session at that time.", code="SLOT_TAKEN")

    # Step 8g (approved Q5): while a signed agreement is in force on the
    # session's day, the fee is the agreement's — never the client's — so a
    # session cannot be booked at a different price than both sides signed.
    fee_amount, currency = payload.fee_amount, payload.currency
    in_force = await agreement_service.fee_for_session(db, mentorship.id, start.date())
    if in_force is not None:
        if payload.fee_amount is not None or "currency" in payload.model_fields_set:
            raise validation_error(
                "The session fee comes from the signed agreement.",
                details=[
                    {
                        "loc": ["body", "fee_amount"],
                        "msg": "Leave the fee empty; the signed agreement sets it.",
                        "type": "value_error",
                    }
                ],
            )
        fee_amount, currency = in_force.fee_amount, in_force.currency

    # Nobody outside the pair may be added as an attendee. The mentor is
    # attached automatically with the right role, so a client cannot
    # mislabel them as an observer.
    attendee_ids: list[uuid.UUID] = []
    for extra in payload.attendees:
        if extra.user_id == mentorship.mentor_id:
            continue  # already added below with role=mentor
        member = (
            await db.execute(
                select(OrganizationMember.id).where(
                    OrganizationMember.org_id == mentorship.startup_org_id,
                    OrganizationMember.user_id == extra.user_id,
                    OrganizationMember.deleted_at.is_(None),
                    OrganizationMember.status == "active",
                )
            )
        ).first()
        if member is None:
            raise validation_error(
                "Attendees must be active members of this startup.",
                details=[
                    {
                        "loc": ["body", "attendees"],
                        "msg": f"User {extra.user_id} is not a member.",
                        "type": "value_error",
                    }
                ],
            )
        attendee_ids.append(extra.user_id)

    row = MentoringSession(
        mentorship_id=mentorship.id,
        topic=payload.topic,
        session_type=payload.session_type,
        status=SessionStatus.scheduled,
        scheduled_at=start,
        duration_min=payload.duration_min,
        meeting_url=payload.meeting_url,
        fee_amount=fee_amount,
        currency=currency,
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise conflict(
            "A session is already booked at that time for this mentorship.",
            code="SLOT_TAKEN",
        ) from None

    db.add(
        SessionAttendee(session_id=row.id, user_id=mentorship.mentor_id, role=AttendeeRole.mentor)
    )
    for uid in dict.fromkeys(attendee_ids):
        db.add(SessionAttendee(session_id=row.id, user_id=uid, role=AttendeeRole.startup))

    await _sync_mentorship_times(db, mentorship)
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, mentorship, user)


# --------------------------------------------------------------------- read


def _visible_query(user: User, mentorship_join: bool = True) -> Select:
    """Sessions in mentorships the caller is a participant in.

    Membership is expressed in SQL, so a caller can never list another
    tenant's sessions even with a forged query parameter.
    """
    member_orgs = select(OrganizationMember.org_id).where(
        OrganizationMember.user_id == user.id,
        OrganizationMember.deleted_at.is_(None),
        OrganizationMember.status == "active",
    )
    stmt = select(MentoringSession)
    if mentorship_join:
        stmt = stmt.join(Mentorship, Mentorship.id == MentoringSession.mentorship_id).where(
            Mentorship.deleted_at.is_(None),
            or_(
                Mentorship.mentor_id == user.id,
                Mentorship.startup_org_id.in_(member_orgs),
            ),
        )
    return stmt


async def list_for_mentorship(
    db: AsyncSession,
    user: User,
    mentorship_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
) -> SessionPage:
    mentorship = await _load_mentorship(db, mentorship_id)
    # Read access: the mentor or ANY active member (viewers included).
    if mentorship.mentor_id != user.id:
        await mentorship_service.require_can_read(db, mentorship, user)

    base = select(MentoringSession).where(MentoringSession.mentorship_id == mentorship_id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                base.order_by(MentoringSession.scheduled_at.desc()).limit(limit).offset(offset)
            )
        )
        .scalars()
        .all()
    )
    items = [await _as_read(db, r, mentorship, user) for r in rows]
    return SessionPage(items=items, total=total, limit=limit, offset=offset)


async def list_mine(
    db: AsyncSession, user: User, *, limit: int, offset: int, upcoming_only: bool
) -> SessionPage:
    base = _visible_query(user)
    if upcoming_only:
        base = base.where(
            MentoringSession.status.in_([s.value for s in LIVE_STATUSES]),
            MentoringSession.scheduled_at >= datetime.now(UTC),
        )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                base.order_by(MentoringSession.scheduled_at.desc()).limit(limit).offset(offset)
            )
        )
        .scalars()
        .all()
    )
    items = []
    for row in rows:
        mentorship = await _load_mentorship(db, row.mentorship_id)
        items.append(await _as_read(db, row, mentorship, user))
    return SessionPage(items=items, total=total, limit=limit, offset=offset)


async def _get_session(
    db: AsyncSession, user: User, session_id: uuid.UUID
) -> tuple[MentoringSession, Mentorship]:
    row = (
        await db.execute(select(MentoringSession).where(MentoringSession.id == session_id))
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Session not found.")
    mentorship = await _load_mentorship(db, row.mentorship_id)
    # A non-participant cannot tell a real session id from a made-up one.
    if mentorship.mentor_id != user.id:
        await mentorship_service.require_can_read(db, mentorship, user)
    return row, mentorship


async def get_one(db: AsyncSession, user: User, session_id: uuid.UUID) -> SessionRead:
    row, mentorship = await _get_session(db, user, session_id)
    return await _as_read(db, row, mentorship, user)


# --------------------------------------------------------------- transitions


async def confirm(db: AsyncSession, user: User, session_id: uuid.UUID) -> SessionRead:
    await _enforce_write_limit(user)
    row, mentorship = await _get_session(db, user, session_id)
    await _can_write(db, mentorship, user)
    if row.status not in (SessionStatus.scheduled.value, SessionStatus.proposed.value):
        raise conflict(f"Cannot confirm a session that is '{row.status}'.", code="INVALID_STATE")
    row.status = SessionStatus.confirmed
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, mentorship, user)


async def reschedule(
    db: AsyncSession, user: User, session_id: uuid.UUID, payload: SessionReschedule
) -> SessionRead:
    await _enforce_write_limit(user)
    row, mentorship = await _get_session(db, user, session_id)
    await _can_write(db, mentorship, user)
    if row.status not in {s.value for s in EDITABLE}:
        raise conflict(f"Cannot reschedule a session that is '{row.status}'.", code="INVALID_STATE")

    duration = payload.duration_min or row.duration_min
    _validate_window(payload.scheduled_at, duration)
    start = payload.scheduled_at
    end = start + timedelta(minutes=duration)

    if await _same_mentorship_conflict(db, mentorship.id, start, exclude_session_id=row.id):
        raise conflict("Another session already holds that time.", code="SLOT_TAKEN")
    if await _mentor_conflict(db, mentorship.mentor_id, start, end, exclude_session_id=row.id):
        raise conflict("The mentor already has a session at that time.", code="SLOT_TAKEN")

    row.scheduled_at = start
    row.duration_min = duration
    # A reschedule puts the session back to "scheduled": the other side has
    # not confirmed the new time yet.
    row.status = SessionStatus.scheduled
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise conflict("Another session already holds that time.", code="SLOT_TAKEN") from None

    await _sync_mentorship_times(db, mentorship)
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, mentorship, user)


async def cancel(db: AsyncSession, user: User, session_id: uuid.UUID, reason: str) -> SessionRead:
    await _enforce_write_limit(user)
    row, mentorship = await _get_session(db, user, session_id)
    await _can_write(db, mentorship, user)
    if row.status not in {s.value for s in EDITABLE}:
        raise conflict(f"Cannot cancel a session that is '{row.status}'.", code="INVALID_STATE")
    row.status = SessionStatus.cancelled
    row.cancelled_reason = reason
    await _sync_mentorship_times(db, mentorship)
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, mentorship, user)


async def complete(
    db: AsyncSession,
    user: User,
    session_id: uuid.UUID,
    summary: str,
    action_items: list[str],
) -> SessionRead:
    """Mentor-only: the record of what happened belongs to the advisor."""
    await _enforce_write_limit(user)
    row, mentorship = await _get_session(db, user, session_id)
    if mentorship.mentor_id != user.id:
        raise forbidden("Only the mentor can complete a session.")
    if row.status not in {s.value for s in EDITABLE}:
        raise conflict(f"Cannot complete a session that is '{row.status}'.", code="INVALID_STATE")
    row.status = SessionStatus.completed
    row.summary = summary
    row.action_items = list(action_items)
    row.completed_at = datetime.now(UTC)
    # Step 8h: a completed, paid session becomes money the mentor is owed.
    # Staged in THIS transaction, so the completion and the earning commit
    # or roll back together (see earning_service.record_for_session).
    await earning_service.record_for_session(db, row, mentorship.mentor_id)
    await _sync_mentorship_times(db, mentorship)
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, mentorship, user)


async def no_show(
    db: AsyncSession, user: User, session_id: uuid.UUID, note: str | None
) -> SessionRead:
    """Mentor-only, and only once the start time has actually passed."""
    await _enforce_write_limit(user)
    row, mentorship = await _get_session(db, user, session_id)
    if mentorship.mentor_id != user.id:
        raise forbidden("Only the mentor can mark a no-show.")
    if row.status not in {s.value for s in EDITABLE}:
        raise conflict(
            f"Cannot mark a no-show on a session that is '{row.status}'.",
            code="INVALID_STATE",
        )
    scheduled = _aware(row.scheduled_at)
    if scheduled is not None and scheduled > datetime.now(UTC):
        raise conflict(
            "A no-show can only be marked after the session was due to start.",
            code="INVALID_STATE",
        )
    row.status = SessionStatus.no_show
    if note:
        row.summary = note
    await _sync_mentorship_times(db, mentorship)
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, mentorship, user)


# ------------------------------------------------------------ 8c integration


async def is_instant_free(
    db: AsyncSession, mentor_id: uuid.UUID, start: datetime, end: datetime
) -> bool:
    """Public predicate 8c's slot read and the booking screen share."""
    return not await _mentor_conflict(db, mentor_id, start, end)
