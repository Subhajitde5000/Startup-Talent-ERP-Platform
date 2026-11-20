"""Step 8c service: a mentor's weekly availability and the bookable slots.

Two responsibilities, kept apart:

- ``get_week`` / ``replace_week`` / ``add_slot`` / ``delete_slot`` manage
  the stored template. Only the owning mentor may write; a startup reads
  it through the public mentor view.
- ``bookable_slots`` turns the template into concrete instants for a date
  range, subtracting sessions already booked. This is the read 8d's booking
  screen and 8d's "is this instant free?" check both use, so the two can
  never disagree about what is free.

DST is handled by doing the arithmetic in the row's own zone and then
converting: a 18:00 weekly slot stays 18:00 local across a change, which is
what the mentor meant. Every instant handed out is timezone-aware UTC.
"""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, forbidden, not_found, rate_limited, validation_error
from app.models.availability import AvailabilitySlot
from app.models.user import User
from app.schemas.availability import (
    AvailabilitySlotIn,
    AvailabilitySlotRead,
    AvailabilityWeekIn,
    AvailabilityWeekRead,
    BookableSlot,
    BookableSlotsRead,
)
from app.services import rate_limiter

# The longest window ``bookable_slots`` will compute in one call. A month of
# slots is plenty for a booking screen; this also bounds the loop so a
# hostile ``to`` cannot make the endpoint do unbounded work.
MAX_RANGE_DAYS = 62
DEFAULT_RANGE_DAYS = 14
MIN_SLOT_MINUTES = 15


async def _enforce_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"availability_write:user:{user.id}",
        settings.AVAILABILITY_WRITE_LIMIT,
        settings.AVAILABILITY_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many availability changes. Please slow down.")


async def require_mentor_profile(db: AsyncSession, user: User) -> None:
    """Only a mentor has a week to publish."""
    from app.models.talent import MentorProfile

    profile = (
        await db.execute(select(MentorProfile.user_id).where(MentorProfile.user_id == user.id))
    ).scalar_one_or_none()
    if profile is None:
        raise forbidden("Only mentors can manage availability.")


def _overlaps(a: AvailabilitySlotIn, b: AvailabilitySlotIn) -> bool:
    """Two windows on the same weekday share more than an endpoint."""
    if a.weekday != b.weekday:
        return False
    return a.start_time < b.end_time and b.start_time < a.end_time


def _to_read(row: AvailabilitySlot) -> AvailabilitySlotRead:
    return AvailabilitySlotRead(
        id=row.id,
        weekday=row.weekday,
        start_time=row.start_time,
        end_time=row.end_time,
        timezone=row.timezone,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _my_slots(db: AsyncSession, mentor_id: uuid.UUID) -> list[AvailabilitySlot]:
    return list(
        (
            await db.execute(
                select(AvailabilitySlot)
                .where(AvailabilitySlot.mentor_id == mentor_id)
                .order_by(AvailabilitySlot.weekday, AvailabilitySlot.start_time)
            )
        )
        .scalars()
        .all()
    )


async def get_week(db: AsyncSession, user: User) -> AvailabilityWeekRead:
    rows = await _my_slots(db, user.id)
    zones = {r.timezone for r in rows}
    return AvailabilityWeekRead(
        slots=[_to_read(r) for r in rows],
        timezone=zones.pop() if len(zones) == 1 else None,
    )


async def replace_week(
    db: AsyncSession, user: User, payload: AvailabilityWeekIn
) -> AvailabilityWeekRead:
    """Replace the whole week atomically.

    The overlap check runs across the NEW set (not the stored one) and
    before anything is deleted, so a rejected payload leaves the previous
    week exactly as it was.
    """
    await _enforce_write_limit(user)
    await require_mentor_profile(db, user)

    for i, slot in enumerate(payload.slots):
        if (slot.end_time.hour * 60 + slot.end_time.minute) - (
            slot.start_time.hour * 60 + slot.start_time.minute
        ) < MIN_SLOT_MINUTES:
            raise validation_error(
                f"A slot must be at least {MIN_SLOT_MINUTES} minutes long.",
                details=[
                    {
                        "loc": ["body", "slots", i, "end_time"],
                        "msg": f"At least {MIN_SLOT_MINUTES} minutes.",
                        "type": "value_error",
                    }
                ],
            )
        for other in payload.slots[i + 1 :]:
            if _overlaps(slot, other):
                raise validation_error(
                    "Availability windows may not overlap.",
                    details=[
                        {
                            "loc": ["body", "slots", i],
                            "msg": "Overlaps another window.",
                            "type": "value_error",
                        }
                    ],
                )

    await db.execute(delete(AvailabilitySlot).where(AvailabilitySlot.mentor_id == user.id))
    for slot in payload.slots:
        db.add(
            AvailabilitySlot(
                mentor_id=user.id,
                weekday=slot.weekday,
                start_time=slot.start_time,
                end_time=slot.end_time,
                timezone=slot.timezone,
                is_active=slot.is_active,
            )
        )
    await db.commit()
    return await get_week(db, user)


async def add_slot(
    db: AsyncSession, user: User, payload: AvailabilitySlotIn
) -> AvailabilitySlotRead:
    await _enforce_write_limit(user)
    await require_mentor_profile(db, user)

    existing = await _my_slots(db, user.id)
    for row in existing:
        if _overlaps(
            payload,
            AvailabilitySlotIn(
                weekday=row.weekday,
                start_time=row.start_time,
                end_time=row.end_time,
                timezone=row.timezone,
                is_active=row.is_active,
            ),
        ):
            raise conflict(
                "That window overlaps availability you already published.",
                code="AVAILABILITY_OVERLAP",
            )

    row = AvailabilitySlot(
        mentor_id=user.id,
        weekday=payload.weekday,
        start_time=payload.start_time,
        end_time=payload.end_time,
        timezone=payload.timezone,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _to_read(row)


async def delete_slot(db: AsyncSession, user: User, slot_id: uuid.UUID) -> None:
    """Hard delete. A slot holds no history worth keeping (it is a template)."""
    await _enforce_write_limit(user)
    row = (
        await db.execute(
            select(AvailabilitySlot).where(
                AvailabilitySlot.id == slot_id, AvailabilitySlot.mentor_id == user.id
            )
        )
    ).scalar_one_or_none()
    # A slot that is not mine is a 404, not a 403: same no-oracle rule.
    if row is None:
        raise not_found("Availability slot not found.")
    await db.delete(row)
    await db.commit()


async def public_week(db: AsyncSession, mentor_id: uuid.UUID) -> AvailabilityWeekRead:
    """What a startup may see: active windows only, no ids needed but harmless."""
    rows = [r for r in await _my_slots(db, mentor_id) if r.is_active]
    zones = {r.timezone for r in rows}
    return AvailabilityWeekRead(
        slots=[_to_read(r) for r in rows],
        timezone=zones.pop() if len(zones) == 1 else None,
    )


def _combine_local(day: date, at: time, zone: ZoneInfo) -> datetime:
    """A local wall-clock time on a date, as an aware UTC instant.

    ``fold=0`` picks the first occurrence of an ambiguous time (the DST
    fall-back hour); a nonexistent time (spring-forward) is pushed forward
    by zoneinfo's own resolution, so the result is always a real instant.
    """
    local = datetime.combine(day, at, tzinfo=zone)
    return local.astimezone(UTC)


async def bookable_slots(
    db: AsyncSession,
    mentor_id: uuid.UUID,
    mentor_handle: str,
    *,
    from_date: date | None,
    days: int,
) -> BookableSlotsRead:
    """Concrete free instants in [from_date, from_date+days).

    "Free" = the weekly template says the mentor is available AND no
    session on that mentorship pair is already booked at that instant.
    Only an engaged pair has sessions at all, so this subtracts the
    caller's own bookings when there are any.

    Bookings that are already in the past are still returned for the
    current day only if they have not ended; the range floor is today.
    """
    if days < 1 or days > MAX_RANGE_DAYS:
        raise validation_error(
            f"`days` must be between 1 and {MAX_RANGE_DAYS}.",
            details=[
                {
                    "loc": ["query", "days"],
                    "msg": f"Must be between 1 and {MAX_RANGE_DAYS}.",
                    "type": "value_error",
                }
            ],
        )

    template = [r for r in await _my_slots(db, mentor_id) if r.is_active]
    today = datetime.now(UTC).date()
    start_day = from_date or today
    if start_day < today:
        # Never offer a slot in the past; clamp instead of erroring so the
        # UI can keep its default of "from today".
        start_day = today
    horizon = start_day + timedelta(days=days)

    # Booked instants for this mentor inside the window, in one query.
    booked = await _booked_instants(db, mentor_id, start_day, horizon)

    items: list[BookableSlot] = []
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        weekday = day.weekday()
        for row in template:
            if row.weekday != weekday:
                continue
            zone = ZoneInfo(row.timezone)
            start = _combine_local(day, row.start_time, zone)
            end = _combine_local(day, row.end_time, zone)
            if end <= datetime.now(UTC):
                continue
            if start in booked:
                continue
            items.append(
                BookableSlot(
                    start=start,
                    end=end,
                    local_date=day,
                    local_start=row.start_time,
                    local_end=row.end_time,
                    timezone=row.timezone,
                )
            )

    items.sort(key=lambda s: s.start)
    zones = {s.timezone for s in items}
    return BookableSlotsRead(
        mentor_handle=mentor_handle,
        timezone=zones.pop() if len(zones) == 1 else None,
        items=items,
        total=len(items),
    )


async def _booked_instants(
    db: AsyncSession, mentor_id: uuid.UUID, start_day: date, horizon: date
) -> set[datetime]:
    """Session start instants this mentor already has in the window.

    Imported lazily: 8d's session model must not be a hard dependency of
    8c, so a deployment that ships 8c alone still works.
    """
    try:
        from app.models.session import MentoringSession, SessionStatus
    except ImportError:  # pragma: no cover - 8c alone
        return set()

    from app.models.mentorship import Mentorship

    live = {
        SessionStatus.proposed.value,
        SessionStatus.scheduled.value,
        SessionStatus.confirmed.value,
    }
    rows = (
        await db.execute(
            select(MentoringSession.scheduled_at)
            .join(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
            .where(
                Mentorship.mentor_id == mentor_id,
                MentoringSession.scheduled_at >= datetime.combine(start_day, time.min, UTC),
                MentoringSession.scheduled_at < datetime.combine(horizon, time.min, UTC),
                MentoringSession.status.in_(live),
            )
        )
    ).scalars()
    return {r.astimezone(UTC) for r in rows}
