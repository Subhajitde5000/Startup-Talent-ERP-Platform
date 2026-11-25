"""Step 7e scorecard templates, weighted criteria and per-application scores.

Reference: ``database/schema.sql`` sections ``scorecards``,
``scorecard_criteria`` and ``application_scores``. Documented deviations
(also in the 0040 migration and the step report):

- String + named CHECK instead of PostgreSQL enum types — same treatment
  as ``jobs.status`` and ``job_applications.stage`` (SQLite test parity).
- ``anchors`` is a JSON list instead of ``text[]`` — same treatment as
  ``mentorships.needs`` and ``mentoring_sessions.action_items``.
- ``updated_at`` on the child tables, required by AGENTS.md section 6;
  precedent: ``application_notes`` gained it in 0039.
- ``scorecards.deleted_at`` (soft delete) is added: hard-deleting a card
  would CASCADE ``scorecard_criteria`` and destroy ``application_scores``
  evidence through the FK chain.
"""

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
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Scorecard(Base):
    __tablename__ = "scorecards"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"))
    # Platform-wide cards are seeded by admin/content steps, never by an
    # organization API (mass-assignment test asserts this).
    is_platform: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="scorecards_name_check"),
        Index("scorecards_org_idx", "org_id"),
        Index("scorecards_job_idx", "job_id"),
        Index(
            "scorecards_org_created_idx",
            "org_id",
            "created_at",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )


class ScorecardCriterion(Base):
    __tablename__ = "scorecard_criteria"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    scorecard_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scorecards.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    weight: Mapped[int] = mapped_column(SmallInteger, default=1, server_default="1")
    anchors: Mapped[list | None] = mapped_column(JSON)
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("weight > 0", name="scorecard_criteria_weight_check"),
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200",
            name="scorecard_criteria_name_check",
        ),
        Index("scorecard_criteria_card_idx", "scorecard_id", "display_order"),
    )


class ApplicationScore(Base):
    __tablename__ = "application_scores"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_applications.id", ondelete="CASCADE")
    )
    criterion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scorecard_criteria.id", ondelete="CASCADE")
    )
    # Always stamped server-side with the scoring author; never client input.
    interviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    score: Mapped[int] = mapped_column(SmallInteger)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("score BETWEEN 1 AND 5", name="application_scores_score_check"),
        CheckConstraint(
            "note IS NULL OR length(trim(note)) BETWEEN 1 AND 2000",
            name="application_scores_note_check",
        ),
        # From schema.sql verbatim. interviewer_id is always set by the
        # server, so the PG NULLS DISTINCT quirk never applies here.
        Index(
            "application_scores_unique",
            "application_id",
            "criterion_id",
            "interviewer_id",
            unique=True,
        ),
        Index("application_scores_interviewer_idx", "interviewer_id"),
    )
