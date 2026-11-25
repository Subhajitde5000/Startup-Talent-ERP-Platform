"""Step 7e: organization templates, copied job rubrics and author-private ratings."""

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
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), index=True
    )
    is_platform: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    source_scorecard_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scorecards.id", ondelete="SET NULL"), index=True
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="scorecards_name_check"),
        CheckConstraint("is_platform = false", name="scorecards_org_only_check"),
        CheckConstraint("locked_at IS NULL OR job_id IS NOT NULL", name="scorecards_lock_check"),
        Index(
            "scorecards_live_job_key",
            "job_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("scorecards_org_page_idx", "org_id", "created_at", "id"),
    )


class ScorecardCriterion(Base):
    __tablename__ = "scorecard_criteria"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    scorecard_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scorecards.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    weight: Mapped[int] = mapped_column(SmallInteger, default=1, server_default="1")
    anchors: Mapped[list[str]] = mapped_column(JSON, default=list, server_default="[]")
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200", name="scorecard_criteria_name_check"
        ),
        CheckConstraint("weight BETWEEN 1 AND 100", name="scorecard_criteria_weight_check"),
        CheckConstraint("display_order BETWEEN 0 AND 19", name="scorecard_criteria_order_check"),
        Index("scorecard_criteria_card_idx", "scorecard_id", "display_order", unique=True),
    )


class ApplicationScore(Base):
    __tablename__ = "application_scores"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_applications.id", ondelete="CASCADE"), index=True
    )
    criterion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scorecard_criteria.id", ondelete="RESTRICT"), index=True
    )
    interviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    score: Mapped[int] = mapped_column(SmallInteger)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("score BETWEEN 1 AND 5", name="application_scores_score_check"),
        CheckConstraint(
            "note IS NULL OR length(trim(note)) BETWEEN 1 AND 2000",
            name="application_scores_note_check",
        ),
        Index(
            "application_scores_unique",
            "application_id",
            "criterion_id",
            "interviewer_id",
            unique=True,
        ),
    )
