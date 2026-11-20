"""Session models (Step 8d, schema.sql "mentoring_sessions" and friends).

Two tables, mirroring schema.sql with three approved deviations:

1. ``action_items`` is JSON, not ``text[]`` — the same portability reason
   every other list column in this codebase uses JSON (8b D-2).
2. ``readiness_id`` is DROPPED. 8f owns readiness sign-off and 8e owns
   deliverables; nothing in 8d's scope ever sets it, so keeping it would be
   a dangling FK and a reserved-null column nobody writes. If a later
   sub-step needs to link a session to a readiness item, it adds the column
   with a real writer (8d plan D-2).
3. ``meeting_url`` is validated as an https URL in Pydantic rather than
   being free text, so a ``javascript:`` link can never be stored and
   rendered to the other party.

Double-booking: "no double booking" needs two guarantees.

- The *same mentorship* cannot hold two live sessions at the same instant —
  a partial unique index on ``(mentorship_id, scheduled_at)`` covers this
  and is enforced by the database on both backends.
- The *same mentor* cannot be in two sessions at once across different
  startups. ``mentor_id`` lives on ``mentorships``, not here, so this needs
  a join; it is enforced in ``session_service`` inside the request
  transaction with a ``SELECT ... FOR UPDATE`` on the mentorship rows. A
  hard DB guarantee would mean denormalising ``mentor_id`` onto this table
  (8d plan D-3); the service check is the approved choice.
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SessionStatus(enum.StrEnum):
    """schema.sql ``session_status``."""

    proposed = "proposed"
    scheduled = "scheduled"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class AttendeeRole(enum.StrEnum):
    """schema.sql CHECK on ``session_attendees.role``."""

    mentor = "mentor"
    startup = "startup"
    observer = "observer"


# Sessions that hold a time slot. Used by the unique index, the service's
# conflict checks and 8c's free/busy read — one definition, three callers.
LIVE_STATUSES: tuple[SessionStatus, ...] = (
    SessionStatus.proposed,
    SessionStatus.scheduled,
    SessionStatus.confirmed,
)

_LIVE_SQL = "status IN ('proposed','scheduled','confirmed')"


class MentoringSession(Base):
    """One meeting between a mentor and a startup."""

    __tablename__ = "mentoring_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    mentorship_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mentorships.id", ondelete="CASCADE"),
        nullable=False,
    )
    topic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    session_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[SessionStatus] = mapped_column(
        String(16),
        nullable=False,
        default=SessionStatus.scheduled,
        server_default="scheduled",
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_min: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=45, server_default="45"
    )
    meeting_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_items: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    # Money is NUMERIC with a currency code, never float (AGENTS.md section 2).
    # It is a RECORD of the agreed fee; no payment is taken in this step.
    fee_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
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
        CheckConstraint(
            "status IN ('proposed','scheduled','confirmed','completed',"
            "'cancelled','no_show')",
            name="mentoring_sessions_status_valid",
        ),
        CheckConstraint(
            "duration_min >= 5 AND duration_min <= 480",
            name="mentoring_sessions_duration_check",
        ),
        CheckConstraint(
            "fee_amount IS NULL OR fee_amount >= 0",
            name="mentoring_sessions_fee_check",
        ),
        CheckConstraint("length(currency) = 3", name="mentoring_sessions_currency_check"),
        # Same-mentorship double booking, enforced by the DB.
        Index(
            "mentoring_sessions_slot_unique",
            "mentorship_id",
            "scheduled_at",
            unique=True,
            postgresql_where=text(_LIVE_SQL),
            sqlite_where=text(_LIVE_SQL),
        ),
        # The list path: one mentorship's sessions newest-first.
        Index("mentoring_sessions_mentorship_idx", "mentorship_id", "scheduled_at"),
        # 8c's free/busy read and any "upcoming" query filter on status.
        Index(
            "mentoring_sessions_upcoming_idx",
            "scheduled_at",
            postgresql_where=text(_LIVE_SQL),
            sqlite_where=text(_LIVE_SQL),
        ),
    )


class SessionAttendee(Base):
    """Who is expected on a session.

    schema.sql models this as an explicit table so a startup can bring a
    colleague and a mentor can bring an observer. The composite primary key
    is the natural one — a user attends a session at most once.
    """

    __tablename__ = "session_attendees"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mentoring_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[AttendeeRole] = mapped_column(
        String(16),
        nullable=False,
        default=AttendeeRole.startup,
        server_default="startup",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('mentor','startup','observer')", name="session_attendees_role_check"
        ),
        # FK index: "sessions this user attends" needs the reverse of the PK.
        Index("session_attendees_user_idx", "user_id"),
    )
