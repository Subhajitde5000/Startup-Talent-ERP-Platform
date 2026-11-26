"""Job offer models (Step 7g: employer-side job offers).

``job_offers`` mirrors ``database/schema.sql`` (lines 984-1005) with the
plan-approved deviations documented in migration ``0042_step7g_offers``:

- ``status``/``currency`` are VARCHAR + named CHECKs instead of native
  PG enums (portable-types policy); values are identical to schema.sql's
  ``offer_status``.
- One live offer per application (plan D10): the partial unique index
  ``job_offers_live_unique`` covers draft/sent/countered only, so
  terminal history rows never collide with a fresh offer.
- No ``org_id`` column — reach the organization through
  application -> job -> org (plan decision).
- No versioning (plan D2): a single row; revise = PATCH while draft;
  negotiation history lives in stage events + the audit log.
- Money is NUMERIC(14,2) + ISO-4217 ``currency`` (never float).

Lifecycle (plan D3/D4): PATCH only on ``draft``; send -> ``sent`` (frozen
except extend-expiry); candidate accept/decline; employer withdraw;
lazy expiry on read (past ``expires_on`` + sent/countered -> ``expired``,
one audit row, no scheduler). ``countered`` exists in the vocabulary
(plan D4) but no endpoint sets it in this step — candidates counter
through Step 11 messaging.
"""

import enum
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
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

_LIVE = text("deleted_at IS NULL")
_ONE_LIVE = text(
    "status IN ('draft','sent','countered') AND deleted_at IS NULL"
)


class JobOfferStatus(enum.StrEnum):
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

# Status lifecycle (plan D3/D4): PATCH only while draft; send freezes the
# body; accepted/declined/expired/withdrawn are terminal. ``countered``
# has no setter in this step (plan D4) but would behave like ``sent``.
JOB_OFFER_TRANSITIONS: dict[JobOfferStatus, frozenset[JobOfferStatus]] = {
    JobOfferStatus.draft: frozenset(
        {JobOfferStatus.sent, JobOfferStatus.withdrawn}
    ),
    JobOfferStatus.sent: frozenset(
        {
            JobOfferStatus.accepted,
            JobOfferStatus.declined,
            JobOfferStatus.withdrawn,
            JobOfferStatus.expired,
        }
    ),
    JobOfferStatus.countered: frozenset(
        {
            JobOfferStatus.accepted,
            JobOfferStatus.declined,
            JobOfferStatus.withdrawn,
            JobOfferStatus.expired,
        }
    ),
    JobOfferStatus.accepted: frozenset(),
    JobOfferStatus.declined: frozenset(),
    JobOfferStatus.expired: frozenset(
        {JobOfferStatus.sent, JobOfferStatus.withdrawn}
    ),
    JobOfferStatus.withdrawn: frozenset(),
}


class JobOffer(Base):
    """One offer letter for one application (employer -> candidate)."""

    __tablename__ = "job_offers"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("job_applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    base_salary: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    bonus_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    equity_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    joining_bonus: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    start_date: Mapped[date | None] = mapped_column(nullable=True)
    expires_on: Mapped[date | None] = mapped_column(nullable=True)
    status: Mapped[JobOfferStatus] = mapped_column(
        String(16), nullable=False, default=JobOfferStatus.draft,
        server_default="draft",
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    document_file_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("files.id", ondelete="SET NULL"),
        nullable=True,
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    decline_reason_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("offer_decline_reasons.id", ondelete="SET NULL"),
        nullable=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=func.now(),
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "base_salary IS NULL OR base_salary >= 0",
            name="job_offers_base_salary_check",
        ),
        CheckConstraint(
            "bonus_amount IS NULL OR bonus_amount >= 0",
            name="job_offers_bonus_check",
        ),
        CheckConstraint(
            "equity_pct IS NULL OR (equity_pct >= 0 AND equity_pct <= 100)",
            name="job_offers_equity_check",
        ),
        CheckConstraint(
            "joining_bonus IS NULL OR joining_bonus >= 0",
            name="job_offers_joining_bonus_check",
        ),
        CheckConstraint("currency = upper(currency)", name="job_offers_currency_check"),
        CheckConstraint(_STATUS_SQL, name="job_offers_status_check"),
        CheckConstraint(
            "decline_reason_id IS NULL OR status = 'declined'",
            name="job_offers_decline_reason_check",
        ),
        Index(
            "job_offers_application_idx",
            "application_id",
            text("created_at DESC"),
        ),
        Index(
            "job_offers_status_idx",
            "status",
            postgresql_where=_LIVE,
            sqlite_where=_LIVE,
        ),
        # Plan D10: one live (draft/sent/countered) offer per application.
        Index(
            "job_offers_live_unique",
            "application_id",
            unique=True,
            postgresql_where=_ONE_LIVE,
            sqlite_where=_ONE_LIVE,
        ),
    )


class OfferDeclineReason(Base):
    """Platform-seeded lookup for job-offer decline reasons (plan D5)."""

    __tablename__ = "offer_decline_reasons"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=func.now(),
        server_default=func.now(),
    )


__all__ = ["JobOffer", "JobOfferStatus", "JOB_OFFER_TRANSITIONS", "OfferDeclineReason"]
