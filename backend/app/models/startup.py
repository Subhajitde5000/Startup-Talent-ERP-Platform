"""Startup profile model (Step 5a, schema.sql section 4).

Approved deviations from schema.sql (5a plan, confirmed by the user):
- ``location`` / ``founded_on`` dropped: ``organizations.city`` and
  ``organizations.founded_year`` are the single source of truth; team size
  is computed from members, never stored.
- ``tam_text`` renamed ``market``: the frontend field is "Target customer &
  market" and no TAM-specific input exists anywhere.
- ``contacts_public`` added: the profile page's "Team contacts" share toggle.
- Onboarding gap columns added: ``mrr_range``, ``funding_status``,
  ``pitch_deck_url``, ``dpiit_status``, ``ecosystem_goals``.

Portable types (same policy as migrations 0003-0005): the ``startup_stage``
ENUM becomes VARCHAR + CHECK via ``Enum(native_enum=False)``;
``profile_visibility`` is VARCHAR + CHECK exactly as schema.sql defines it.
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
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StartupStage(enum.StrEnum):
    """Schema.sql ``startup_stage``. The frontend's 'scaling' maps to
    ``growth`` in phase B (5a plan D1)."""

    idea = "idea"
    prototype = "prototype"
    early_revenue = "early_revenue"
    growth = "growth"
    mature = "mature"


class ProfileVisibility(enum.StrEnum):
    """Who may discover the startup profile (schema.sql CHECK values)."""

    private = "private"
    mentors = "mentors"
    mentors_and_investors = "mentors_and_investors"
    public = "public"


class StartupProfile(Base):
    __tablename__ = "startup_profiles"

    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tagline: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage: Mapped[StartupStage] = mapped_column(
        SAEnum(StartupStage, name="startup_stage", native_enum=False, length=16),
        nullable=False,
        default=StartupStage.idea,
        server_default="idea",
    )
    sector: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_model: Mapped[str | None] = mapped_column(Text, nullable=True)
    problem: Mapped[str | None] = mapped_column(Text, nullable=True)
    solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    market: Mapped[str | None] = mapped_column(Text, nullable=True)
    traction_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Step 5a onboarding gaps (plan D3): text/URL only, no files.
    mrr_range: Mapped[str | None] = mapped_column(String(100), nullable=True)
    funding_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pitch_deck_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pitch_deck_file_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("files.id", name="fk_startup_profiles_pitch_deck_file", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    dpiit_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Frontend gap columns (migration0007, Option A approved2026-11-18):
    # onboarding step1/2/3 + the profile page's Legal card.
    legal_entity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    demo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    actively_raising: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_raise: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ecosystem_goals: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    # Server-controlled: written by readiness (5f) and mentor/admin flows
    # (Step 8/15), never by a startup member — absent from Update schemas.
    mentor_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    readiness_score: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
        info={"check": "readiness_score >= 0 AND readiness_score <= 100"},
    )
    profile_visibility: Mapped[ProfileVisibility] = mapped_column(
        String(24),
        nullable=False,
        default=ProfileVisibility.mentors_and_investors,
        server_default="mentors_and_investors",
    )
    summary_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    traction_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    team_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    funding_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    round_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    readiness_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    contacts_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "profile_visibility IN ('private','mentors','mentors_and_investors','public')",
            name="startup_visibility_valid",
        ),
        CheckConstraint(
            "readiness_score IS NULL OR (readiness_score >= 0 AND readiness_score <= 100)",
            name="startup_profiles_readiness_check",
        ),
        # Step 5h discovery (migration 0012): the anonymous list always
        # filters on stage/sector under profile_visibility = 'public', so
        # the index is partial — non-public profiles never enter it.
        Index(
            "startup_discovery_public_idx",
            "stage",
            "sector",
            postgresql_where=text("profile_visibility = 'public'"),
            sqlite_where=text("profile_visibility = 'public'"),
        ),
    )
