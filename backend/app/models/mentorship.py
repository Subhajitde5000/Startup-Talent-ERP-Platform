"""Mentorship models (Step 8b, schema.sql "mentorships").

One table, mirroring schema.sql with four approved deviations:

1. ``needs`` is JSON, not ``text[]``. Postgres arrays have no SQLite
   equivalent and the codebase already stores list columns as JSON
   (``startup_profiles.ecosystem_goals``, ``mentor_profiles.expertise``),
   so both test backends behave identically (8b plan D-2).
2. ``currency`` is ``String(3)`` + CHECK rather than ``char(3)``: ``char``
   pads with spaces and behaves differently across backends (D-3).
3. ``fit_score`` is kept but NEVER written. It is the schema.sql column
   reserved for a future ranking; 8a established that a match score is
   computed from fields that actually matched and is never invented
   (D-4). Keeping the nullable column costs nothing and avoids a later
   migration if 8j wants one.
4. ``terms`` is accepted as free text on the request. The structured,
   versioned home for terms is ``mentor_agreements`` in Step 8g; this
   column is the "what we roughly agreed" note attached to the request,
   not a contract (D-5).

The partial unique index ``mentorships_active_unique`` is schema.sql's
"one active mentorship per pair" rule, kept verbatim: at most one row
per (mentor, startup) may be requested/active/paused at a time. A
declined, cancelled or completed row frees the pair to request again.
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MentorshipStatus(enum.StrEnum):
    """schema.sql ``mentorship_status``, kept as VARCHAR + CHECK."""

    requested = "requested"
    active = "active"
    paused = "paused"
    completed = "completed"
    declined = "declined"
    cancelled = "cancelled"


class MentorshipHealth(enum.StrEnum):
    """schema.sql ``mentorship_health_valid`` CHECK values."""

    on_track = "on_track"
    at_risk = "at_risk"
    stalled = "stalled"


# The states the partial unique index treats as "the pair is tied up".
# Kept next to the model so the index, the service's 409 check and the
# tests all read the same definition.
BUSY_STATUSES: tuple[MentorshipStatus, ...] = (
    MentorshipStatus.requested,
    MentorshipStatus.active,
    MentorshipStatus.paused,
)


class Mentorship(Base):
    """One startup's engagement with one mentor."""

    __tablename__ = "mentorships"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # The mentor is a USER, not a mentor_profiles row: the profile is keyed
    # by user_id (Step 3c) and can be deleted while the mentorship history
    # must survive, so users is the stable identity (same as schema.sql).
    mentor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    startup_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[MentorshipStatus] = mapped_column(
        String(16),
        nullable=False,
        default=MentorshipStatus.requested,
        server_default="requested",
    )
    # What the startup wants to work on (the request's own words).
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    needs: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    cadence: Mapped[str | None] = mapped_column(String(32), nullable=True)
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    equity_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    fee_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    # Plan D-4: reserved, never written by this step.
    fit_score: Mapped[int | None] = mapped_column(
        Numeric(5, 2), nullable=True, info={"check": "fit_score >= 0 AND fit_score <= 100"}
    )
    health: Mapped[str | None] = mapped_column(String(16), nullable=True)
    started_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ended_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Derived from mentoring_sessions (8d), never client input.
    last_session_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_session_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('requested','active','paused','completed',"
            "'declined','cancelled')",
            name="mentorships_status_valid",
        ),
        CheckConstraint(
            "health IS NULL OR health IN ('on_track','at_risk','stalled')",
            name="mentorship_health_valid",
        ),
        CheckConstraint(
            "equity_pct IS NULL OR (equity_pct >= 0 AND equity_pct <= 100)",
            name="mentorships_equity_pct_check",
        ),
        CheckConstraint(
            "fee_amount IS NULL OR fee_amount >= 0",
            name="mentorships_fee_amount_check",
        ),
        CheckConstraint(
            "fit_score IS NULL OR (fit_score >= 0 AND fit_score <= 100)",
            name="mentorships_fit_score_check",
        ),
        CheckConstraint(
            "ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on",
            name="mentorships_dates_check",
        ),
        # schema.sql's "one active mentorship per pair", verbatim.
        Index(
            "mentorships_active_unique",
            "mentor_id",
            "startup_org_id",
            unique=True,
            postgresql_where=text(
                "deleted_at IS NULL AND status IN ('requested','active','paused')"
            ),
            sqlite_where=text(
                "deleted_at IS NULL AND status IN ('requested','active','paused')"
            ),
        ),
        # List paths: a mentor's requests and a startup's requests.
        Index(
            "mentorships_mentor_idx",
            "mentor_id",
            "status",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index(
            "mentorships_startup_idx",
            "startup_org_id",
            "status",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )
