"""Startup funding rounds. Minimum amounts are approved UI-driven additions."""
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
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.db.base import Base


class RoundType(enum.StrEnum):
    pre_seed = "pre_seed"
    seed = "seed"
    series_a = "series_a"
    series_b = "series_b"
    bridge = "bridge"
    safe = "safe"
    other = "other"


class Instrument(enum.StrEnum):
    equity = "equity"
    safe = "safe"
    convertible_note = "convertible_note"
    ccd = "ccd"
    ccps = "ccps"
    debt = "debt"
    other = "other"


class RoundStatus(enum.StrEnum):
    draft = "draft"
    open = "open"
    paused = "paused"
    closed = "closed"
    cancelled = "cancelled"


class FundingRound(Base):
    __tablename__ = "funding_rounds"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    round_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    committed_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    minimum_raise: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    minimum_ticket: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="INR")
    pre_money_valuation: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    instrument: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(12), nullable=False, server_default="draft")
    opens_on: Mapped[date | None] = mapped_column(Date)
    closes_on: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("round_type IN ('pre_seed','seed','series_a','series_b','bridge','safe','other')", name="funding_round_type_valid"),
        CheckConstraint("instrument IS NULL OR instrument IN ('equity','safe','convertible_note','ccd','ccps','debt','other')", name="funding_round_instrument_valid"),
        CheckConstraint("status IN ('draft','open','paused','closed','cancelled')", name="funding_round_status_valid"),
        CheckConstraint("(target_amount IS NULL OR target_amount > 0) AND committed_amount >= 0", name="round_amounts_non_negative"),
        CheckConstraint("(minimum_raise IS NULL OR minimum_raise > 0) AND (minimum_ticket IS NULL OR minimum_ticket > 0) AND (pre_money_valuation IS NULL OR pre_money_valuation >= 0)", name="funding_round_terms_valid"),
        CheckConstraint("minimum_raise IS NULL OR target_amount IS NULL OR minimum_raise <= target_amount", name="funding_round_minimum_target_valid"),
        CheckConstraint("opens_on IS NULL OR closes_on IS NULL OR opens_on <= closes_on", name="funding_round_dates_valid"),
        CheckConstraint("length(currency) = 3 AND currency = upper(currency) AND substr(currency, 1, 1) BETWEEN 'A' AND 'Z' AND substr(currency, 2, 1) BETWEEN 'A' AND 'Z' AND substr(currency, 3, 1) BETWEEN 'A' AND 'Z'", name="funding_round_currency_valid"),
        Index("funding_rounds_org_idx", "org_id", "status", postgresql_where=text("deleted_at IS NULL"), sqlite_where=text("deleted_at IS NULL")),
    )
