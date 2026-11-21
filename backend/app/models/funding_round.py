"""Funding round model (Step 9a, schema.sql section 6 ``funding_rounds``).

Mirrors schema.sql, with the project's portable-type policy (same as
migrations 0003-0023):

- Native PG enums (``funding_round_type``, ``round_status``,
  ``instrument_type``) -> VARCHAR + named CHECK via
  ``Enum(native_enum=False)`` / ``String`` + CHECK, never native enums.
- ``currency char(3)`` -> ``String(3)`` + ``length(currency) = 3`` CHECK:
  ``char`` pads with spaces and does not exist on SQLite; the value is a
  3-letter ISO code either way (``talent.py``/``earning.py`` already do this).
- ``round_amounts_non_negative`` and ``funding_rounds_org_idx`` kept verbatim.

Approved deviations from schema.sql (9a plan, user-approved):

- ``min_raise`` / ``min_ticket`` added (nullable ``NUMERIC(14,2)``): the
  "Set up a fundraising round" modal collects Minimum raise and Minimum
  ticket, and schema.sql has no columns for either (plan D4).
- ``pre_money_valuation >= 0`` CHECK added (plan D8): schema.sql has no
  CHECK there; a negative valuation is nonsense.
- ``committed_amount`` is server-only in 9a (plan D2): it starts at 0 and
  only 9i/9j (offers/commitments) will ever write it. Progress
  (remaining / progress_pct) is derived in the service, never stored.

Money: ``NUMERIC(14,2)`` + ISO-4217 ``currency`` defaulting to INR
(AGENTS.md section 6). Amounts are serialized as decimal strings, never
floats (the 5e ``MetricRead`` pattern).
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


class FundingRoundType(enum.StrEnum):
    """schema.sql ``funding_round_type``."""

    pre_seed = "pre_seed"
    seed = "seed"
    series_a = "series_a"
    series_b = "series_b"
    bridge = "bridge"
    safe = "safe"
    other = "other"


class RoundStatus(enum.StrEnum):
    """schema.sql ``round_status``."""

    draft = "draft"
    open = "open"
    paused = "paused"
    closed = "closed"
    cancelled = "cancelled"


class InstrumentType(enum.StrEnum):
    """schema.sql ``instrument_type``."""

    equity = "equity"
    safe = "safe"
    convertible_note = "convertible_note"
    ccd = "ccd"
    ccps = "ccps"
    debt = "debt"
    other = "other"


# Status lifecycle (plan D1/D14): the only transitions the service allows.
# ``cancelled`` is terminal; ``closed`` may reopen to ``open`` (the
# round-detail page has a Reopen button).
ROUND_TRANSITIONS: dict[RoundStatus, frozenset[RoundStatus]] = {
    RoundStatus.draft: frozenset({RoundStatus.open, RoundStatus.cancelled}),
    RoundStatus.open: frozenset(
        {RoundStatus.paused, RoundStatus.closed, RoundStatus.cancelled}
    ),
    RoundStatus.paused: frozenset(
        {RoundStatus.open, RoundStatus.closed, RoundStatus.cancelled}
    ),
    RoundStatus.closed: frozenset({RoundStatus.open}),
    RoundStatus.cancelled: frozenset(),
}

_ROUND_TYPE_SQL = (
    "round_type IN ('pre_seed','seed','series_a','series_b','bridge','safe','other')"
)
_ROUND_STATUS_SQL = "status IN ('draft','open','paused','closed','cancelled')"
_INSTRUMENT_SQL = (
    "instrument IS NULL OR instrument IN "
    "('equity','safe','convertible_note','ccd','ccps','debt','other')"
)


class FundingRound(Base):
    """One fundraising round belonging to a startup organization."""

    __tablename__ = "funding_rounds"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    round_type: Mapped[FundingRoundType] = mapped_column(
        String(16),
        nullable=False,
    )
    target_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    # Server-only in 9a (plan D2): starts at 0, written only by 9i/9j.
    committed_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    pre_money_valuation: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    instrument: Mapped[InstrumentType | None] = mapped_column(
        String(16), nullable=True
    )
    status: Mapped[RoundStatus] = mapped_column(
        String(16),
        nullable=False,
        default=RoundStatus.draft,
        server_default="draft",
    )
    opens_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    closes_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Plan D4: the modal's Minimum raise / Minimum ticket.
    min_raise: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    min_ticket: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
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
        CheckConstraint(_ROUND_TYPE_SQL, name="funding_round_type_valid"),
        CheckConstraint(_ROUND_STATUS_SQL, name="round_status_valid"),
        CheckConstraint(_INSTRUMENT_SQL, name="funding_round_instrument_valid"),
        # schema.sql verbatim.
        CheckConstraint(
            "(target_amount IS NULL OR target_amount > 0) AND committed_amount >= 0",
            name="round_amounts_non_negative",
        ),
        # Plan D8: a negative valuation is nonsense.
        CheckConstraint(
            "pre_money_valuation IS NULL OR pre_money_valuation >= 0",
            name="funding_rounds_valuation_check",
        ),
        CheckConstraint("length(currency) = 3", name="funding_rounds_currency_check"),
        CheckConstraint(
            "min_raise IS NULL OR min_raise > 0",
            name="funding_rounds_min_raise_check",
        ),
        CheckConstraint(
            "min_ticket IS NULL OR min_ticket > 0",
            name="funding_rounds_min_ticket_check",
        ),
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200",
            name="funding_rounds_name_check",
        ),
        # schema.sql verbatim (partial index on live rows).
        Index(
            "funding_rounds_org_idx",
            "org_id",
            "status",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )


__all__ = [
    "FundingRound",
    "FundingRoundType",
    "InstrumentType",
    "ROUND_TRANSITIONS",
    "RoundStatus",
]
