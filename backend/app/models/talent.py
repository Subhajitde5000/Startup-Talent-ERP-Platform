"""Talent & mentor profile models (schema.sql sections 6 and 10).

Step 3c subset. Deviations from schema.sql (documented, for portability):
- Native ENUMs (work_mode, availability_mode) -> VARCHAR + CHECK.
- mentor_profiles.expertise/sectors/languages are text[] in schema.sql;
  SQLite has no arrays -> stored as JSON lists (portable, same API shape).
- talent_profile_skills keeps the schema.sql shape (PK + created_at only;
  no mutable columns, so no updated_at).
- talent_profiles gains hide_current_employer (approved in the Step 3
  wiring decisions: the jobseeker settings "hide from current employer"
  toggle needs a home; schema.sql has no column for it).
"""

import enum
import uuid
from datetime import datetime

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
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WorkMode(enum.StrEnum):
    onsite = "onsite"
    hybrid = "hybrid"
    remote = "remote"


class AvailabilityMode(enum.StrEnum):
    immediate = "immediate"
    two_weeks = "two_weeks"
    one_month = "one_month"
    flexible = "flexible"
    not_looking = "not_looking"


class TalentProfile(Base):
    __tablename__ = "talent_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    headline: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_experience_yrs: Mapped[float | None] = mapped_column(
        Numeric(4, 1), nullable=True, info={"check": "total_experience_yrs >= 0"}
    )
    current_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_mode: Mapped[WorkMode | None] = mapped_column(
        SAEnum(WorkMode, name="work_mode", native_enum=False, length=16),
        nullable=True,
    )
    availability: Mapped[AvailabilityMode] = mapped_column(
        SAEnum(
            AvailabilityMode, name="availability_mode", native_enum=False, length=16
        ),
        nullable=False,
        default=AvailabilityMode.flexible,
        server_default="flexible",
    )
    salary_expectation: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    open_to_relocate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="SET NULL", name="talent_profiles_resume_fk"),
        nullable=True,
    )
    is_searchable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    hide_current_employer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "total_experience_yrs IS NULL OR total_experience_yrs >= 0",
            name="talent_profiles_experience_check",
        ),
        CheckConstraint(
            "salary_expectation IS NULL OR salary_expectation >= 0",
            name="talent_profiles_salary_check",
        ),
        Index("talent_profiles_searchable_idx", "is_searchable"),
    )

    skills: Mapped[list["TalentProfileSkill"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class TalentProfileSkill(Base):
    __tablename__ = "talent_profile_skills"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("talent_profiles.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    years: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    profile: Mapped[TalentProfile] = relationship(back_populates="skills")


class MentorProfile(Base):
    __tablename__ = "mentor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    headline: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    expertise: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    sectors: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    languages: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    years_experience: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True, info={"check": "years_experience >= 0"}
    )
    hourly_fee: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR", server_default="INR"
    )
    cadence: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_startups: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=3, server_default="3"
    )
    accepting_requests: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    rating: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    sessions_completed: Mapped[int] = mapped_column(
        nullable=False, default=0, server_default="0"
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "years_experience IS NULL OR years_experience >= 0",
            name="mentor_profiles_experience_check",
        ),
        CheckConstraint(
            "hourly_fee IS NULL OR hourly_fee >= 0",
            name="mentor_profiles_fee_check",
        ),
        CheckConstraint("max_startups > 0", name="mentor_profiles_max_startups_check"),
        CheckConstraint(
            "rating IS NULL OR (rating >= 0 AND rating <= 5)",
            name="mentor_profiles_rating_check",
        ),
        Index("mentor_profiles_accepting_idx", "accepting_requests"),
    )
