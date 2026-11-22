"""Investor pipeline models (Step 9e).

``investor_deals`` mirrors ``database/schema.sql`` verbatim (the table
is referenced there but had no backend model yet). ``pipeline_stage``
is stored as VARCHAR(16) through ``Enum(native_enum=False)`` per the
portable-types policy (same as 5i ``startup_stage``): the native PG
enum does not exist on SQLite, and the CHECK constraint carries the
same validity guarantee. ``diligence`` is included between
``data_room`` and ``offer`` (plan D5).

``investor_deal_stage_history`` (plan D4) is the append-only log of
stage changes, written in the SAME transaction as the change (the 5i
``startup_stage_history`` pattern), so "time in stage" never sees a
stage that was never recorded.

Money: ``NUMERIC(14,2)`` + ISO-4217 ``currency`` (never float).
``probability`` is the ``score_100`` domain -> SmallInteger + CHECK.
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
    SmallInteger,
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


class PipelineStage(enum.StrEnum):
    """schema.sql ``pipeline_stage``, with ``diligence`` added (D5).

    ``diligence`` sits between ``data_room`` and ``offer``: after the
    data room opens and before an offer is made.
    """

    interested = "interested"
    intro = "intro"
    meeting = "meeting"
    data_room = "data_room"
    diligence = "diligence"
    offer = "offer"
    committed = "committed"
    passed = "passed"
    closed = "closed"


_STAGE_SQL = (
    "stage IN ('interested','intro','meeting','data_room','diligence',"
    "'offer','committed','passed','closed')"
)


class InvestorDeal(Base):
    """One investor's pipeline relationship with one startup (9e)."""

    __tablename__ = "investor_deals"

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
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    round_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("funding_rounds.id", ondelete="SET NULL"),
        nullable=True,
    )
    stage: Mapped[PipelineStage] = mapped_column(
        SAEnum(PipelineStage, name="pipeline_stage", native_enum=False, length=16),
        nullable=False,
        default=PipelineStage.interested,
        server_default="interested",
    )
    probability: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )
    ticket_size: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    fit_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_step: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_step_on: Mapped[date | None] = mapped_column(nullable=True)
    last_activity_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    passed_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
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
        # schema.sql verbatim: an investor cannot be dealing with itself.
        CheckConstraint(
            "investor_org_id <> startup_org_id", name="deal_distinct_parties"
        ),
        CheckConstraint(_STAGE_SQL, name="investor_deals_stage_valid"),
        # score_100 domain.
        CheckConstraint(
            "probability IS NULL OR (probability >= 0 AND probability <= 100)",
            name="investor_deals_probability_check",
        ),
        CheckConstraint("length(currency) = 3", name="investor_deals_currency_check"),
        # schema.sql verbatim (partial unique index on live rows).
        Index(
            "investor_deals_unique",
            "investor_org_id",
            "startup_org_id",
            unique=True,
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index(
            "investor_deals_stage_idx",
            "investor_org_id",
            "stage",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        Index(
            "investor_deals_startup_idx",
            "startup_org_id",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
    )


class InvestorDealStageHistory(Base):
    """Append-only log of investor-deal stage changes (plan D4)."""

    __tablename__ = "investor_deal_stage_history"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_deals.id", ondelete="CASCADE"),
        nullable=False,
    )
    # NULL only for the baseline row written when history starts.
    from_stage: Mapped[PipelineStage | None] = mapped_column(
        SAEnum(PipelineStage, name="pipeline_stage", native_enum=False, length=16),
        nullable=True,
    )
    to_stage: Mapped[PipelineStage] = mapped_column(
        SAEnum(PipelineStage, name="pipeline_stage", native_enum=False, length=16),
        nullable=False,
    )
    # Server-controlled: stamped from the authenticated actor, never input.
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("investor_deal_stage_history_deal_idx", "deal_id", "changed_at"),
    )


__all__ = ["InvestorDeal", "InvestorDealStageHistory", "PipelineStage"]
