"""Commitment and portfolio-holding models (Step 9j).

``commitments`` and ``portfolio_holdings`` mirror
``database/schema.sql`` verbatim (both tables are defined there but had
no backend model yet). Status columns are VARCHAR + named CHECK per the
portable-types policy (the native PG enums do not exist on SQLite).
Money is ``NUMERIC(14,2)`` + ISO-4217 ``currency`` (never float).

``commitments`` follows schema.sql exactly: it has NO ``deleted_at``
(cancellation is a status, ``cancelled``), and its status lifecycle is
``pledged -> documented -> funded``, with ``cancelled`` reachable from
any non-terminal state (plan D1/D14 pattern, same as
``OFFER_TRANSITIONS`` in 9i).

``portfolio_holdings`` tracks the investor's position in a startup:
``active`` -> ``written_off`` / ``exited`` / ``partially_exited``.
``investor_org_id <> startup_org_id`` is enforced by a CHECK (schema.sql
verbatim: an investor cannot hold itself).
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CommitmentStatus(enum.StrEnum):
    """schema.sql ``commitments.status``."""

    pledged = "pledged"
    documented = "documented"
    funded = "funded"
    cancelled = "cancelled"


_COMMITMENT_STATUS_SQL = (
    "status IN ('pledged','documented','funded','cancelled')"
)
_HOLDING_STATUS_SQL = (
    "status IN ('active','written_off','exited','partially_exited')"
)
_INSTRUMENT_SQL = (
    "instrument IN ('equity','safe','convertible_note','ccd','ccps',"
    "'debt','other')"
)

# Status lifecycle: the only transitions the service allows. ``funded``
# and ``cancelled`` are terminal.
COMMITMENT_TRANSITIONS: dict[CommitmentStatus, frozenset[CommitmentStatus]] = {
    CommitmentStatus.pledged: frozenset(
        {CommitmentStatus.documented, CommitmentStatus.cancelled}
    ),
    CommitmentStatus.documented: frozenset(
        {CommitmentStatus.funded, CommitmentStatus.cancelled}
    ),
    CommitmentStatus.funded: frozenset(),
    CommitmentStatus.cancelled: frozenset(),
}

HOLDING_TRANSITIONS: dict[str, frozenset[str]] = {
    "active": frozenset({"written_off", "exited", "partially_exited"}),
    "written_off": frozenset(),
    "exited": frozenset(),
    "partially_exited": frozenset(),
}


class Commitment(Base):
    """One investor's pledge on a startup's round (9j)."""

    __tablename__ = "commitments"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    round_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("funding_rounds.id", ondelete="CASCADE"),
        nullable=False,
    )
    offer_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_offers.id", ondelete="SET NULL"),
        nullable=True,
    )
    investor_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    status: Mapped[CommitmentStatus] = mapped_column(
        SAEnum(
            CommitmentStatus, name="commitment_status", native_enum=False, length=16
        ),
        nullable=False,
        default=CommitmentStatus.pledged,
        server_default="pledged",
    )
    committed_on: Mapped[date | None] = mapped_column(nullable=True)
    funded_on: Mapped[date | None] = mapped_column(nullable=True)
    wired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reference: Mapped[str | None] = mapped_column(Text, nullable=True)
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
        CheckConstraint("amount > 0", name="commitments_amount_check"),
        CheckConstraint(_COMMITMENT_STATUS_SQL, name="commitment_status_valid"),
        CheckConstraint("length(currency) = 3", name="commitments_currency_check"),
        # schema.sql verbatim.
        Index("commitments_round_idx", "round_id", "status"),
        Index("commitments_investor_idx", "investor_org_id"),
    )


class PortfolioHolding(Base):
    """One investor's position in a startup (9j)."""

    __tablename__ = "portfolio_holdings"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    investor_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    startup_org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    commitment_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("commitments.id", ondelete="SET NULL"),
        nullable=True,
    )
    instrument: Mapped[str] = mapped_column(String(16), nullable=False)
    invested_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    ownership_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 4), nullable=True)
    invested_on: Mapped[date | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )
    exited_on: Mapped[date | None] = mapped_column(nullable=True)
    exit_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
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
        # schema.sql verbatim: an investor cannot hold itself.
        CheckConstraint(
            "investor_org_id <> startup_org_id", name="holding_distinct_parties"
        ),
        CheckConstraint(_HOLDING_STATUS_SQL, name="holding_status_valid"),
        CheckConstraint(_INSTRUMENT_SQL, name="portfolio_holdings_instrument_valid"),
        CheckConstraint(
            "invested_amount >= 0", name="portfolio_holdings_amount_check"
        ),
        CheckConstraint(
            "ownership_pct IS NULL OR (ownership_pct >= 0 AND ownership_pct <= 100)",
            name="portfolio_holdings_ownership_check",
        ),
        CheckConstraint("length(currency) = 3", name="portfolio_holdings_currency_check"),
        # schema.sql verbatim.
        Index("portfolio_holdings_investor_idx", "investor_org_id", "status"),
    )


__all__ = [
    "Commitment",
    "CommitmentStatus",
    "COMMITMENT_TRANSITIONS",
    "HOLDING_TRANSITIONS",
    "PortfolioHolding",
]
