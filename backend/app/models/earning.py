"""Mentor earning model (Step 8h, schema.sql "mentor_earnings").

Mirrors schema.sql exactly, including the ``mentor_earning_math`` CHECK —
the database, not the service, is what guarantees the net figure is
consistent. Two notes:

1. ``payout_batch_id`` is created as a PLAIN nullable UUID with **no
   foreign key**. ``payout_batches`` is Step 14f (BUILD_PLAN), so the
   table does not exist yet and the FK cannot be created; schema.sql itself
   adds it in section 14 for the same reason. 14f adds the constraint with
   nothing to backfill, because this column is never written before then.
2. ``status`` is ``String(16)`` + the named CHECK rather than the Postgres
   enum, matching every other status column here.

Money: ``NUMERIC(14,2)`` and an ISO-4217 ``currency`` defaulting to INR
(AGENTS.md section 6). Amounts are only ever written by
``earning_service.record_for_session`` — no client input reaches them.

Rows are created when a paid session is completed (8h plan). Nothing in 8h
moves a row past ``pending``: approval and payout are 14f's job.
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EarningStatus(enum.StrEnum):
    """schema.sql ``mentor_earning_status_valid``."""

    pending = "pending"
    approved = "approved"
    in_payout = "in_payout"
    paid = "paid"
    held = "held"
    reversed = "reversed"


# Open statuses the partial index covers: money still owed to the mentor.
OPEN_STATUSES: frozenset[EarningStatus] = frozenset(
    {EarningStatus.pending, EarningStatus.approved}
)

_STATUS_SQL = (
    "status IN ('pending','approved','in_payout','paid','held','reversed')"
)


class MentorEarning(Base):
    """One paid session's money owed to a mentor."""

    __tablename__ = "mentor_earnings"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    mentor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mentoring_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    tds_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    net_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    status: Mapped[EarningStatus] = mapped_column(
        String(16),
        nullable=False,
        default=EarningStatus.pending,
        server_default="pending",
    )
    earned_on: Mapped[date] = mapped_column(Date, nullable=False)
    # Step 14f owns payout_batches; see the module docstring.
    payout_batch_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
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
        CheckConstraint("gross_amount >= 0", name="mentor_earnings_gross_check"),
        CheckConstraint(
            "commission_amount >= 0", name="mentor_earnings_commission_check"
        ),
        CheckConstraint("tds_amount >= 0", name="mentor_earnings_tds_check"),
        CheckConstraint(
            "net_amount = gross_amount - commission_amount - tds_amount",
            name="mentor_earning_math",
        ),
        CheckConstraint(_STATUS_SQL, name="mentor_earning_status_valid"),
        CheckConstraint("length(currency) = 3", name="mentor_earnings_currency_check"),
        # schema.sql's two indexes, kept verbatim.
        Index(
            "mentor_earnings_mentor_idx",
            "mentor_id",
            text("earned_on DESC"),
        ),
        Index(
            "mentor_earnings_status_idx",
            "status",
            postgresql_where=text("status IN ('pending','approved')"),
            sqlite_where=text("status IN ('pending','approved')"),
        ),
    )


__all__ = ["OPEN_STATUSES", "EarningStatus", "MentorEarning"]
