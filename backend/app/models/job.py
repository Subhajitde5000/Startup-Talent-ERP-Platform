"""Step 7a jobs. See backend/JOBS.md for approved reference-schema deviations."""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
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
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.organization import Department


class JobStatus(enum.StrEnum):
    draft = "draft"
    open = "open"
    paused = "paused"
    closed = "closed"


class WorkMode(enum.StrEnum):
    onsite = "onsite"
    hybrid = "hybrid"
    remote = "remote"


class EmploymentType(enum.StrEnum):
    full_time = "full_time"
    part_time = "part_time"
    contract = "contract"
    internship = "internship"
    temporary = "temporary"


class JobVisibility(enum.StrEnum):
    public = "public"
    platform_members = "platform_members"
    link_only = "link_only"


class SalaryPeriod(enum.StrEnum):
    annual = "annual"
    monthly = "monthly"


# Named checks are shared with the hand-written migration, not dynamically
# imported by it: applied revisions must remain immutable.
class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    blind_review_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    application_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    screening_questions: Mapped[list[dict]] = mapped_column(JSON, default=list, server_default="[]")
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    responsibilities: Mapped[str | None] = mapped_column(Text)
    requirements: Mapped[str | None] = mapped_column(Text)
    what_we_offer: Mapped[str | None] = mapped_column(Text)
    department: Mapped[Department | None] = mapped_column(String(16))
    location: Mapped[str | None] = mapped_column(String(200))
    work_mode: Mapped[str] = mapped_column(String(16), default="onsite", server_default="onsite")
    employment_type: Mapped[str] = mapped_column(
        String(16), default="full_time", server_default="full_time"
    )
    status: Mapped[str] = mapped_column(String(16), default="draft", server_default="draft")
    visibility: Mapped[str] = mapped_column(String(32), default="public", server_default="public")
    salary_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    salary_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")
    salary_period: Mapped[str] = mapped_column(
        String(16), default="annual", server_default="annual"
    )
    show_salary_publicly: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true")
    )
    fair_hiring_confirmed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    equity_min_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    equity_max_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    experience_min_yrs: Mapped[int | None] = mapped_column(SmallInteger)
    experience_max_yrs: Mapped[int | None] = mapped_column(SmallInteger)
    openings: Mapped[int] = mapped_column(SmallInteger, default=1, server_default="1")
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    featured_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # 7i: hiring request this job was converted from (schema.sql jobs
    # line 739, deferred by 7a and added by migration 0044). Deleting the
    # request leaves the job in place with request_id NULL.
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("hiring_requests.id", ondelete="SET NULL"), default=None
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="jobs_title_check"),
        CheckConstraint("status IN ('draft','open','paused','closed')", name="jobs_status_check"),
        CheckConstraint("work_mode IN ('onsite','hybrid','remote')", name="jobs_work_mode_check"),
        CheckConstraint(
            "employment_type IN ('full_time','part_time','contract','internship','temporary')",
            name="jobs_employment_type_check",
        ),
        CheckConstraint(
            "visibility IN ('public','platform_members','link_only')", name="jobs_visibility_check"
        ),
        CheckConstraint("salary_period IN ('annual','monthly')", name="jobs_salary_period_check"),
        CheckConstraint(
            "department IS NULL OR department IN ('engineering','product','design','sales','marketing','operations','finance','people','legal','support','other')",
            name="jobs_department_check",
        ),
        CheckConstraint(
            "length(currency) = 3 AND currency = upper(currency)", name="jobs_currency_check"
        ),
        CheckConstraint(
            "(salary_min IS NULL OR salary_min >= 0) AND (salary_max IS NULL OR salary_max >= 0)",
            name="jobs_salary_nonnegative",
        ),
        CheckConstraint(
            "salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min",
            name="jobs_salary_range",
        ),
        CheckConstraint(
            "(equity_min_pct IS NULL OR equity_min_pct BETWEEN 0 AND 100) AND (equity_max_pct IS NULL OR equity_max_pct BETWEEN 0 AND 100)",
            name="jobs_equity_bounds",
        ),
        CheckConstraint(
            "equity_min_pct IS NULL OR equity_max_pct IS NULL OR equity_max_pct >= equity_min_pct",
            name="jobs_equity_range",
        ),
        CheckConstraint(
            "(experience_min_yrs IS NULL OR experience_min_yrs >= 0) AND (experience_max_yrs IS NULL OR experience_max_yrs >= 0)",
            name="jobs_experience_nonnegative",
        ),
        CheckConstraint(
            "experience_min_yrs IS NULL OR experience_max_yrs IS NULL OR experience_max_yrs >= experience_min_yrs",
            name="jobs_experience_range",
        ),
        CheckConstraint("openings > 0", name="jobs_openings_check"),
        CheckConstraint("status <> 'open' OR posted_at IS NOT NULL", name="jobs_open_has_posted"),
        Index(
            "jobs_org_status_idx",
            "org_id",
            "status",
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "jobs_org_created_idx",
            "org_id",
            "created_at",
            "id",
            sqlite_where=text("deleted_at IS NULL"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "jobs_open_feed_idx",
            text("posted_at DESC"),
            sqlite_where=text("status = 'open' AND deleted_at IS NULL"),
            postgresql_where=text("status = 'open' AND deleted_at IS NULL"),
        ),
        Index(
            "jobs_mode_idx",
            "work_mode",
            "employment_type",
            sqlite_where=text("status = 'open'"),
            postgresql_where=text("status = 'open'"),
        ),
        # Reverse lookup for the request detail (converted job) — the
        # jobs_request_idx created by migration 0044.
        Index("jobs_request_idx", "request_id"),
    )


class JobSkill(Base):
    __tablename__ = "job_skills"

    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (Index("job_skills_skill_idx", "skill_id"),)


class JobBenefit(Base):
    __tablename__ = "job_benefits"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(100))
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        CheckConstraint("length(trim(label)) BETWEEN 1 AND 100", name="job_benefits_label_check"),
        CheckConstraint("display_order >= 0", name="job_benefits_order_check"),
        Index("job_benefits_job_idx", "job_id"),
    )
