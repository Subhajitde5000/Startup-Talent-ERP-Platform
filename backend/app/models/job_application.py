"""Step 7c application records and immutable applicant-visible stage history."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

STAGES = "'applied','review','shortlisted','interview','offered','hired','rejected','withdrawn'"


class JobApplication(Base):
    __tablename__ = "job_applications"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    applicant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    stage: Mapped[str] = mapped_column(String(16), default="applied", server_default="applied")
    source: Mapped[str] = mapped_column(String(16), default="platform", server_default="platform")
    resume_file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("files.id", ondelete="SET NULL"), index=True
    )
    cover_note: Mapped[str | None] = mapped_column(Text)
    salary_expectation: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")
    consent_share: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    accuracy_confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consent_shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    profile_snapshot: Mapped[dict] = mapped_column(JSON)
    job_snapshot: Mapped[dict] = mapped_column(JSON)
    screening_answers: Mapped[list] = mapped_column(JSON, default=list)
    submission_fingerprint: Mapped[str] = mapped_column(String(64))
    stage_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    is_blind: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    rejected_reason: Mapped[str | None] = mapped_column(Text)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint(
            "(rejected_reason IS NULL AND rejected_at IS NULL) OR "
            "(stage = 'rejected' AND rejected_reason IS NOT NULL AND rejected_at IS NOT NULL "
            "AND length(trim(rejected_reason)) BETWEEN 1 AND 1100)",
            name="job_applications_rejection_check",
        ),
        CheckConstraint(f"stage IN ({STAGES})", name="job_applications_stage_check"),
        CheckConstraint(
            "source IN ('platform','referral','marketplace','outreach','agency','other')",
            name="job_applications_source_check",
        ),
        CheckConstraint(
            "salary_expectation IS NULL OR salary_expectation >= 0",
            name="job_applications_salary_check",
        ),
        CheckConstraint(
            "length(currency) = 3 AND currency = upper(currency)",
            name="job_applications_currency_check",
        ),
        CheckConstraint("consent_share = true", name="job_applications_consent_check"),
        CheckConstraint(
            "stage <> 'withdrawn' OR withdrawn_at IS NOT NULL",
            name="job_applications_withdrawn_check",
        ),
        Index(
            "job_applications_unique",
            "job_id",
            "applicant_id",
            unique=True,
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "job_applications_job_stage_idx",
            "job_id",
            "stage",
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("job_applications_job_created_idx", "job_id", "created_at", "id"),
        Index("job_applications_job_assignee_idx", "job_id", "assignee_id", "created_at", "id"),
        Index("job_applications_applicant_idx", "applicant_id", "created_at", "id"),
    )


class ApplicationStageEvent(Base):
    __tablename__ = "application_stage_events"
    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_applications.id", ondelete="CASCADE")
    )
    from_stage: Mapped[str | None] = mapped_column(String(16))
    to_stage: Mapped[str] = mapped_column(String(16))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        CheckConstraint(
            f"to_stage IN ({STAGES}) AND (from_stage IS NULL OR from_stage IN ({STAGES}))",
            name="application_stage_events_stage_check",
        ),
        Index("app_stage_events_app_idx", "application_id", "created_at", "id"),
        Index("app_stage_events_actor_idx", "actor_id"),
    )
