"""Investor offer models (Step 9i: offers with versions and counters).

``investor_offers`` mirrors ``database/schema.sql`` verbatim (the table
is defined there but had no backend model yet). ``offer_status`` and
``instrument_type`` are stored as VARCHAR(16) through
``Enum(native_enum=False)`` per the portable-types policy (the native PG
enums do not exist on SQLite; the CHECK constraint carries the same
validity guarantee). Money is ``NUMERIC(14,2)`` + ISO-4217 ``currency``
(never float).

Versioning: a counter does not mutate the parent offer — it creates a
NEW row with ``parent_offer_id`` pointing at the current latest version
and ``version`` = parent.version + 1 (schema.sql's self-referencing
``parent_offer_id`` column). The startup-side view always shows the
latest version per investor (the ``MAX(version)`` subquery in the
service), and accept/decline act on that latest version only.

Status lifecycle (plan D1/D14 pattern): transitions are validated
against ``OFFER_TRANSITIONS``; ``accepted``, ``declined``, ``expired``
and ``withdrawn`` are terminal. Expiry is lazy on read (past
``expires_on`` + status sent/countered -> ``expired``), no scheduler.
"""

import enum
import uuid
from datetime import date, datetime, timezone
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
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

_LIVE = text("deleted_at IS NULL")


class OfferStatus(enum.StrEnum):
    """schema.sql ``offer_status``."""

    draft = "draft"
    sent = "sent"
    countered = "countered"
    accepted = "accepted"
    declined = "declined"
    expired = "expired"
    withdrawn = "withdrawn"


_STATUS_SQL = (
    "status IN ('draft','sent','countered','accepted','declined',"
    "'expired','withdrawn')"
)
_INSTRUMENT_SQL = (
    "instrument IN ('equity','safe','convertible_note','ccd','ccps',"
    "'debt','other')"
)

# Status lifecycle: the only transitions the service allows. ``accepted``,
# ``declined``, ``expired`` and ``withdrawn`` are terminal. A counter
# does not transition the parent — it creates the next version.
OFFER_TRANSITIONS: dict[OfferStatus, frozenset[OfferStatus]] = {
    OfferStatus.draft: frozenset({OfferStatus.sent, OfferStatus.withdrawn}),
    OfferStatus.sent: frozenset(
        {
            OfferStatus.accepted,
            OfferStatus.declined,
            OfferStatus.withdrawn,
            OfferStatus.expired,
        }
    ),
    OfferStatus.countered: frozenset(
        {
            OfferStatus.accepted,
            OfferStatus.declined,
            OfferStatus.withdrawn,
            OfferStatus.expired,
        }
    ),
    OfferStatus.accepted: frozenset(),
    OfferStatus.declined: frozenset(),
    OfferStatus.expired: frozenset(),
    OfferStatus.withdrawn: frozenset(),
}


class InvestorOffer(Base):
    """One version of an offer from an investor on a startup's round."""

    __tablename__ = "investor_offers"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    round_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("funding_rounds.id", ondelete="CASCADE"),
        nullable=False,
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
    instrument: Mapped[str] = mapped_column(String(16), nullable=False)
    valuation_cap: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    discount_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    version: Mapped[int] = mapped_column(
        nullable=False, default=1, server_default="1"
    )
    parent_offer_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_offers.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[OfferStatus] = mapped_column(
        SAEnum(OfferStatus, name="offer_status", native_enum=False, length=16),
        nullable=False,
        default=OfferStatus.draft,
        server_default="draft",
    )
    expires_on: Mapped[date | None] = mapped_column(nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="investor_offers_amount_check"),
        CheckConstraint(_STATUS_SQL, name="offer_status_valid"),
        CheckConstraint(_INSTRUMENT_SQL, name="investor_offers_instrument_valid"),
        CheckConstraint(
            "discount_pct IS NULL OR (discount_pct >= 0 AND discount_pct <= 100)",
            name="investor_offers_discount_check",
        ),
        CheckConstraint("version > 0", name="investor_offers_version_check"),
        CheckConstraint("length(currency) = 3", name="investor_offers_currency_check"),
        # schema.sql verbatim (partial index on live rows).
        Index(
            "investor_offers_round_idx",
            "round_id",
            "status",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index(
            "investor_offers_investor_idx",
            "investor_org_id",
            "created_at",
        ),
    )


__all__ = ["InvestorOffer", "OfferStatus", "OFFER_TRANSITIONS"]
