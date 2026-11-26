"""Step 7n/7o resume builder and ATS/tailor run models (schema.sql section 8).

Approved differences from schema.sql:
- resumes omits file_id, view_count, download_count (deferred; file_id waits for Step 4).
- resumes adds nullable template (VARCHAR(64)) and source (VARCHAR(16), default 'manual').
- resume_experiences.bullets and resume_ats_runs arrays use portable JSON.
- resume_ats_runs adds run_type ('ats' | 'tailor') discriminator so both rule-based
  ATS checks and AI tailoring runs share one table.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

RESUME_SOURCES = "'manual','profile','ai','import'"
ATS_RUN_TYPES = "'ats','tailor'"


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    target_role: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    template: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default="manual", server_default="manual"
    )
    ats_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(f"source IN ({RESUME_SOURCES})", name="resumes_source_check"),
        CheckConstraint(
            "ats_score IS NULL OR (ats_score >= 0 AND ats_score <= 100)",
            name="resumes_ats_score_check",
        ),
        Index(
            "resumes_one_default",
            "user_id",
            unique=True,
            postgresql_where=text("is_default AND deleted_at IS NULL"),
            sqlite_where=text("is_default AND deleted_at IS NULL"),
        ),
        Index(
            "resumes_user_idx",
            "user_id",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )

    experiences: Mapped[list["ResumeExperience"]] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
        order_by="ResumeExperience.display_order, ResumeExperience.created_at, ResumeExperience.id",
    )
    education: Mapped[list["ResumeEducation"]] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
        order_by="ResumeEducation.display_order, ResumeEducation.created_at, ResumeEducation.id",
    )
    skills: Mapped[list["ResumeSkill"]] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
    )
    ats_runs: Mapped[list["ResumeAtsRun"]] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
    )


class ResumeExperience(Base):
    __tablename__ = "resume_experiences"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    resume_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False
    )
    role_title: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped[str] = mapped_column(Text, nullable=False)
    period_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ended_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    bullets: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("display_order >= 0", name="resume_experiences_order_check"),
        Index("resume_experiences_resume_idx", "resume_id", "display_order"),
    )

    resume: Mapped[Resume] = relationship(back_populates="experiences")


class ResumeEducation(Base):
    __tablename__ = "resume_education"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    resume_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False
    )
    degree: Mapped[str] = mapped_column(Text, nullable=False)
    school: Mapped[str] = mapped_column(Text, nullable=False)
    year_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("display_order >= 0", name="resume_education_order_check"),
        Index("resume_education_resume_idx", "resume_id", "display_order"),
    )

    resume: Mapped[Resume] = relationship(back_populates="education")


class ResumeSkill(Base):
    __tablename__ = "resume_skills"

    resume_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    resume: Mapped[Resume] = relationship(back_populates="skills")


class ResumeAtsRun(Base):
    __tablename__ = "resume_ats_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    resume_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )
    run_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default="ats", server_default="ats"
    )
    score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    missing_keywords: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    matched_keywords: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    suggestions: Mapped[list[dict]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(f"run_type IN ({ATS_RUN_TYPES})", name="resume_ats_runs_type_check"),
        CheckConstraint(
            "score IS NULL OR (score >= 0 AND score <= 100)",
            name="resume_ats_runs_score_check",
        ),
        Index("resume_ats_runs_resume_idx", "resume_id", "created_at"),
    )

    resume: Mapped[Resume] = relationship(back_populates="ats_runs")
