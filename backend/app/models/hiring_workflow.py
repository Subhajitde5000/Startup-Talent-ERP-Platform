"""7f–7h records. Private files remain in the existing Step 4 storage system."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Interview(Timestamps, Base):
    __tablename__ = "interviews"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_applications.id", ondelete="CASCADE"), index=True
    )
    round_name: Mapped[str] = mapped_column(String(200))
    format: Mapped[str] = mapped_column(String(16), default="video")
    status: Mapped[str] = mapped_column(String(16), default="scheduled", index=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_min: Mapped[int] = mapped_column(SmallInteger, default=45)
    location: Mapped[str | None] = mapped_column(String(500))
    meeting_url: Mapped[str | None] = mapped_column(String(2000))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    cancelled_reason: Mapped[str | None] = mapped_column(String(1000))
    version: Mapped[int] = mapped_column(Integer, default=1)
    request_id: Mapped[uuid.UUID] = mapped_column()
    fingerprint: Mapped[str] = mapped_column(String(64))
    __table_args__ = (
        CheckConstraint(
            "status IN ('scheduled','confirmed','completed','cancelled','no_show')",
            name="interviews_status_check",
        ),
        CheckConstraint(
            "format IN ('video','phone','onsite','async')", name="interviews_format_check"
        ),
        CheckConstraint(
            "duration_min BETWEEN 5 AND 480 AND version > 0", name="interviews_bounds_check"
        ),
        CheckConstraint("length(trim(round_name)) BETWEEN 1 AND 200", name="interviews_name_check"),
        Index("interviews_retry_key", "application_id", "request_id", unique=True),
    )


class InterviewParticipant(Timestamps, Base):
    __tablename__ = "interview_participants"
    interview_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interviews.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    side: Mapped[str] = mapped_column(String(16))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response: Mapped[str | None] = mapped_column(String(16))
    __table_args__ = (
        CheckConstraint(
            "side IN ('candidate','interviewer','observer')",
            name="interview_participants_side_check",
        ),
        CheckConstraint(
            "response IS NULL OR response IN ('accepted','declined','tentative')",
            name="interview_participants_response_check",
        ),
    )


class InterviewFeedback(Timestamps, Base):
    __tablename__ = "interview_feedback"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    interview_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interviews.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    recommendation: Mapped[str] = mapped_column(String(16))
    summary: Mapped[str] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    __table_args__ = (
        CheckConstraint(
            "recommendation IN ('strong_yes','yes','no','strong_no')",
            name="interview_feedback_recommendation_check",
        ),
        CheckConstraint(
            "length(trim(summary)) BETWEEN 1 AND 5000", name="interview_feedback_summary_check"
        ),
        Index("interview_feedback_author_key", "interview_id", "author_id", unique=True),
    )


class OfferDeclineReason(Timestamps, Base):
    __tablename__ = "offer_decline_reasons"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    label: Mapped[str] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))


class JobOffer(Timestamps, Base):
    __tablename__ = "job_offers"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_applications.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    base_salary: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    bonus_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    equity_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    joining_bonus: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    salary_period: Mapped[str] = mapped_column(String(16), default="annual")
    payment_terms: Mapped[str | None] = mapped_column(String(2000))
    bonus_terms: Mapped[str | None] = mapped_column(String(2000))
    probation_terms: Mapped[str | None] = mapped_column(String(2000))
    notice_terms: Mapped[str | None] = mapped_column(String(2000))
    vesting_terms: Mapped[str | None] = mapped_column(String(2000))
    exercise_price_terms: Mapped[str | None] = mapped_column(String(2000))
    joining_bonus_terms: Mapped[str | None] = mapped_column(String(2000))
    start_date: Mapped[date] = mapped_column(Date)
    expires_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    document_file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("files.id", ondelete="RESTRICT"), index=True
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decline_reason_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("offer_decline_reasons.id", ondelete="SET NULL")
    )
    decline_detail: Mapped[str | None] = mapped_column(String(1000))
    counter_note: Mapped[str | None] = mapped_column(String(2000))
    parent_offer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("job_offers.id", ondelete="RESTRICT"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    terms_version: Mapped[int] = mapped_column(Integer, default=1)
    request_id: Mapped[uuid.UUID] = mapped_column()
    fingerprint: Mapped[str] = mapped_column(String(64))
    job_snapshot: Mapped[dict] = mapped_column(JSON)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','sent','countered','accepted','declined','expired','withdrawn')",
            name="job_offers_status_check",
        ),
        CheckConstraint(
            "base_salary > 0 AND (bonus_amount IS NULL OR bonus_amount >= 0) AND (joining_bonus IS NULL OR joining_bonus >= 0)",
            name="job_offers_money_check",
        ),
        CheckConstraint(
            "equity_pct IS NULL OR equity_pct BETWEEN 0 AND 100", name="job_offers_equity_check"
        ),
        CheckConstraint(
            "length(currency) = 3 AND currency = upper(currency) AND salary_period IN ('annual','monthly')",
            name="job_offers_currency_check",
        ),
        CheckConstraint(
            "version > 0 AND terms_version > 0 AND expires_on < start_date",
            name="job_offers_dates_check",
        ),
        Index("job_offers_retry_key", "application_id", "request_id", unique=True),
        Index("job_offers_version_key", "application_id", "terms_version", unique=True),
        Index(
            "job_offers_live_key",
            "application_id",
            unique=True,
            postgresql_where=text(
                "deleted_at IS NULL AND superseded_at IS NULL AND status IN ('draft','sent','countered','accepted')"
            ),
            sqlite_where=text(
                "deleted_at IS NULL AND superseded_at IS NULL AND status IN ('draft','sent','countered','accepted')"
            ),
        ),
    )


class JobOfferApproval(Timestamps, Base):
    __tablename__ = "job_offer_approvals"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    offer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_offers.id", ondelete="CASCADE"), index=True
    )
    approver_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[str] = mapped_column(String(16), default="pending")
    note: Mapped[str | None] = mapped_column(String(1000))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        Index("job_offer_approvals_actor_key", "offer_id", "approver_id", unique=True),
        CheckConstraint(
            "status IN ('pending','approved','rejected')", name="job_offer_approvals_status_check"
        ),
    )


class OnboardingTemplate(Timestamps, Base):
    __tablename__ = "onboarding_templates"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    is_platform: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint(
            "is_platform = false AND length(trim(name)) BETWEEN 1 AND 200",
            name="onboarding_templates_bounds_check",
        ),
    )


class OnboardingTemplateItem(Timestamps, Base):
    __tablename__ = "onboarding_template_items"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("onboarding_templates.id", ondelete="CASCADE"), index=True
    )
    section: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))
    owner_role: Mapped[str | None] = mapped_column(String(16))
    due_offset_days: Mapped[int] = mapped_column(SmallInteger, default=0)
    display_order: Mapped[int] = mapped_column(SmallInteger)
    __table_args__ = (
        CheckConstraint(
            "due_offset_days BETWEEN -365 AND 365 AND display_order BETWEEN 0 AND 49",
            name="onboarding_template_items_bounds_check",
        ),
        CheckConstraint(
            "owner_role IS NULL OR owner_role IN ('owner','manager')",
            name="onboarding_template_items_owner_check",
        ),
        Index("onboarding_template_items_order_key", "template_id", "display_order", unique=True),
    )


class Hire(Timestamps, Base):
    __tablename__ = "hires"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_applications.id", ondelete="RESTRICT"), unique=True
    )
    offer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_offers.id", ondelete="RESTRICT"), unique=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    department: Mapped[str | None] = mapped_column(String(16))
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    start_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(24), default="pending_onboarding")
    fingerprint: Mapped[str] = mapped_column(String(64))
    version: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_onboarding','onboarding','active','no_show','cancelled') AND version > 0",
            name="hires_status_check",
        ),
    )


class HireOnboardingItem(Timestamps, Base):
    __tablename__ = "hire_onboarding_items"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hire_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hires.id", ondelete="CASCADE"), index=True
    )
    section: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    due_on: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    note: Mapped[str | None] = mapped_column(String(2000))
    version: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','in_progress','done','blocked','waived') AND version > 0",
            name="hire_onboarding_items_status_check",
        ),
    )


class HireDocument(Timestamps, Base):
    __tablename__ = "hire_documents"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hire_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("hires.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("files.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    purpose: Mapped[str] = mapped_column(String(1000))
    retention: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(16), default="requested")
    due_on: Mapped[date | None] = mapped_column(Date)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_reason: Mapped[str | None] = mapped_column(String(1000))
    version: Mapped[int] = mapped_column(Integer, default=1)
    request_id: Mapped[uuid.UUID] = mapped_column()
    fingerprint: Mapped[str] = mapped_column(String(64))
    __table_args__ = (
        Index("hire_documents_retry_key", "hire_id", "request_id", unique=True),
        CheckConstraint(
            "status IN ('requested','received','verified','rejected','expired') AND version > 0",
            name="hire_documents_status_check",
        ),
        CheckConstraint(
            "status NOT IN ('received','verified','rejected') OR file_id IS NOT NULL",
            name="hire_documents_file_check",
        ),
    )
