"""Mentor availability (Step 8c — a GAP: no such table in schema.sql).

Proposed in the 8c plan and approved, so this is the source of truth for
the shape rather than schema.sql.

Design: a **weekly recurring template**, not dated slots. The mentor says
"I'm free Tuesdays 18:00-20:00 IST" and 8d computes the concrete bookable
times from that template minus sessions already booked. The alternative —
materialising one row per future slot — needs a generator job and a way to
re-materialise when the template changes, which is a lot of machinery for
a page that shows "5 open slots this week".

Columns and why:

- ``mentor_id -> users.id``: the same stable identity ``mentorships`` uses.
  ``mentor_profiles`` is keyed by ``user_id`` and can be deleted while
  availability history need not survive it, so ``users`` is the right
  target.
- ``weekday`` 0..6 (Monday 0) — matches Python's ``date.weekday()`` so the
  8d slot computation needs no conversion table.
- ``start_time`` / ``end_time`` are LOCAL wall-clock ``time`` values in the
  row's own ``timezone``, not UTC. A recurring 18:00 slot stays at 18:00
  across a DST change, which is what a mentor means when they say it.
- ``timezone`` is a validated IANA name (``Asia/Kolkata``). Storing it per
  row means a mentor who moves or teaches across zones is still correct,
  and the API can return the instant plus the zone it was expressed in.
- ``is_active`` lets a mentor switch a slot off without losing the shape
  of their week.

``UNIQUE (mentor_id, weekday, start_time)`` blocks an exact duplicate.
*Overlapping* ranges (09:00-12:00 and 10:00-11:00) are rejected in the
service, because a range-overlap constraint would need Postgres EXCLUDE
(or a recursive CTE) with no portable SQLite equivalent, and the codebase
has no other EXCLUDE index.
"""

import uuid
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AvailabilitySlot(Base):
    """One recurring weekly window in which a mentor may be booked."""

    __tablename__ = "mentor_availability"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    mentor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 0 = Monday, matching date.weekday(); 6 = Sunday.
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        CheckConstraint("weekday >= 0 AND weekday <= 6", name="mentor_availability_weekday_check"),
        CheckConstraint("end_time > start_time", name="mentor_availability_range_check"),
        UniqueConstraint(
            "mentor_id", "weekday", "start_time", name="mentor_availability_unique"
        ),
        # The list path: "this mentor's week".
        Index("mentor_availability_mentor_idx", "mentor_id", "weekday", "start_time"),
    )
