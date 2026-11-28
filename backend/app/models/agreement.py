"""Mentor agreement model (Step 8g, schema.sql "mentor_agreements").

One row is one VERSION of the written terms for a mentorship. Deviations
from schema.sql, all approved in the 8g plan:

1. ``agreement_type`` and ``cadence`` are fixed sets (VARCHAR + CHECK),
   not free text (Q1): ``per_session`` / ``pro_bono`` and
   ``weekly`` / ``fortnightly`` / ``monthly`` (NULL = flexible). Equity is
   its own column and combines with either type.
2. ``status`` stores ``draft, sent, signed, superseded, terminated`` (Q2).
   schema.sql's ``active`` / ``expired`` depend only on the calendar, so
   storing them would need a scheduler; the read model derives a ``phase``
   (``scheduled`` / ``active`` / ``expired``) from the dates instead.
   ``superseded`` is new: a later version replaces an earlier one.
3. Versioning columns are added: ``version`` (assigned when a draft is
   SENT, so discarded drafts never leave gaps), ``previous_version_id``,
   ``proposed_by_side``, ``created_by``, ``change_reason`` and ``sent_at``.
4. ``startup_signed_by`` records which startup signer bound the company;
   the mentor side is always the mentorship's mentor.
5. ``ended_at`` / ``ended_by`` / ``end_reason`` record supersede/terminate.
6. ``currency`` is ``String(3)`` + CHECK (8b precedent, D-3).
7. ``document_file_id`` is NOT created: nothing in 8g writes it (the 8d
   ``readiness_id`` precedent). PDF export is out of scope.

Database-level guarantees (the service checks first so clients get a
field-level 422, these catch anything that slips past):

- per mentorship at most ONE ``sent`` and ONE ``signed`` version, and at
  most one ``draft`` per side (partial unique indexes);
- a per-session agreement has a positive fee, a pro bono one has none;
- a draft has no version and no signatures, every other row has a version;
- a ``signed`` row carries both signature timestamps.
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
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AgreementStatus(enum.StrEnum):
    draft = "draft"
    sent = "sent"
    signed = "signed"
    superseded = "superseded"
    terminated = "terminated"


class AgreementType(enum.StrEnum):
    per_session = "per_session"
    pro_bono = "pro_bono"


class AgreementCadence(enum.StrEnum):
    weekly = "weekly"
    fortnightly = "fortnightly"
    monthly = "monthly"


class AgreementSide(enum.StrEnum):
    mentor = "mentor"
    startup = "startup"


TERMS_MAX = 10_000
REASON_MIN = 20
REASON_MAX = 500


class MentorAgreement(Base):
    """One version of a mentorship's written terms."""

    __tablename__ = "mentor_agreements"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    mentorship_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mentorships.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    previous_version_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mentor_agreements.id", ondelete="SET NULL"),
        nullable=True,
    )
    proposed_by_side: Mapped[AgreementSide] = mapped_column(String(8), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    agreement_type: Mapped[AgreementType] = mapped_column(String(16), nullable=False)
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    equity_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    # Money is NUMERIC with a currency code, never float (AGENTS.md section 2).
    fee_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    cadence: Mapped[AgreementCadence | None] = mapped_column(String(16), nullable=True)
    status: Mapped[AgreementStatus] = mapped_column(
        String(16),
        nullable=False,
        default=AgreementStatus.draft,
        server_default="draft",
    )
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    change_reason: Mapped[str | None] = mapped_column(String(REASON_MAX), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mentor_signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    startup_signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    startup_signed_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    end_reason: Mapped[str | None] = mapped_column(String(REASON_MAX), nullable=True)
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
            "status IN ('draft','sent','signed','superseded','terminated')",
            name="mentor_agreements_status_valid",
        ),
        CheckConstraint(
            "agreement_type IN ('per_session','pro_bono')",
            name="mentor_agreements_type_valid",
        ),
        CheckConstraint(
            "cadence IS NULL OR cadence IN ('weekly','fortnightly','monthly')",
            name="mentor_agreements_cadence_valid",
        ),
        CheckConstraint(
            "proposed_by_side IN ('mentor','startup')",
            name="mentor_agreements_side_valid",
        ),
        CheckConstraint("length(currency) = 3", name="mentor_agreements_currency_check"),
        CheckConstraint(
            "equity_pct IS NULL OR (equity_pct >= 0 AND equity_pct <= 100)",
            name="mentor_agreements_equity_pct_check",
        ),
        CheckConstraint(
            "(agreement_type = 'per_session' AND fee_amount IS NOT NULL AND fee_amount > 0)"
            " OR (agreement_type = 'pro_bono' AND fee_amount IS NULL)",
            name="mentor_agreements_fee_check",
        ),
        CheckConstraint(
            "ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on",
            name="mentor_agreements_dates_check",
        ),
        CheckConstraint(
            "(status = 'draft' AND version IS NULL"
            " AND mentor_signed_at IS NULL AND startup_signed_at IS NULL)"
            " OR (status <> 'draft' AND version IS NOT NULL AND version >= 1)",
            name="mentor_agreements_version_check",
        ),
        CheckConstraint(
            "version IS NULL OR version = 1 OR change_reason IS NOT NULL",
            name="mentor_agreements_reason_required",
        ),
        CheckConstraint(
            "status <> 'signed' OR (mentor_signed_at IS NOT NULL AND startup_signed_at IS NOT NULL)",
            name="mentor_agreements_signed_check",
        ),
        CheckConstraint(
            f"terms IS NULL OR length(terms) <= {TERMS_MAX}",
            name="mentor_agreements_terms_check",
        ),
        CheckConstraint(
            f"change_reason IS NULL OR length(change_reason) BETWEEN {REASON_MIN} AND {REASON_MAX}",
            name="mentor_agreements_change_reason_check",
        ),
        CheckConstraint(
            f"end_reason IS NULL OR length(end_reason) <= {REASON_MAX}",
            name="mentor_agreements_end_reason_check",
        ),
        UniqueConstraint("mentorship_id", "version", name="mentor_agreements_version_key"),
        # schema.sql's list index, verbatim.
        Index("mentor_agreements_mentorship_idx", "mentorship_id", "status"),
        # At most one proposal out for signature per mentorship.
        Index(
            "mentor_agreements_one_sent",
            "mentorship_id",
            unique=True,
            postgresql_where=text("status = 'sent'"),
            sqlite_where=text("status = 'sent'"),
        ),
        # At most one version in force per mentorship.
        Index(
            "mentor_agreements_one_signed",
            "mentorship_id",
            unique=True,
            postgresql_where=text("status = 'signed'"),
            sqlite_where=text("status = 'signed'"),
        ),
        # Each side drafts at most one change at a time.
        Index(
            "mentor_agreements_one_draft_per_side",
            "mentorship_id",
            "proposed_by_side",
            unique=True,
            postgresql_where=text("status = 'draft'"),
            sqlite_where=text("status = 'draft'"),
        ),
    )


__all__ = [
    "REASON_MAX",
    "REASON_MIN",
    "TERMS_MAX",
    "AgreementCadence",
    "AgreementSide",
    "AgreementStatus",
    "AgreementType",
    "MentorAgreement",
]
