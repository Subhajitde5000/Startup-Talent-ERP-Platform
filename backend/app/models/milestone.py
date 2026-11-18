"""Milestone model (Step 5b, schema.sql "tasks and milestones" section).

Approved deviation from schema.sql (5b plan D2, user-approved):
- ``description`` added (nullable): the frontend's create-milestone
  modal collects a Description field ("What does success look like?");
  schema.sql has no column for it.

Portable types (same policy as migrations 0003-0007): ``status`` is
VARCHAR + the named CHECK from schema.sql (``milestone_status_valid``),
never a native PG enum.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MilestoneStatus(enum.StrEnum):
    """schema.sql CHECK on milestones.status."""

    on_track = "on_track"
    at_risk = "at_risk"
    off_track = "off_track"
    achieved = "achieved"
    missed = "missed"


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # Step 5b gap column (plan D2): the create modal's Description.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Enforced in the service: an active member of ``org_id`` (or NULL).
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[MilestoneStatus] = mapped_column(
        String(16),
        nullable=False,
        default=MilestoneStatus.on_track,
        server_default="on_track",
    )
    progress: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        default=0,
        server_default="0",
        info={"check": "progress >= 0 AND progress <= 100"},
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('on_track','at_risk','off_track','achieved','missed')",
            name="milestone_status_valid",
        ),
        CheckConstraint(
            "progress >= 0 AND progress <= 100",
            name="milestones_progress_check",
        ),
    )
