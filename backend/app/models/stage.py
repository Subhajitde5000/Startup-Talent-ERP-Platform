"""Stage models (Steps 5i + 5j).

Neither table exists in ``database/schema.sql`` — both sub-steps list them
as GAPs to be proposed first, and both proposals were approved:

``startup_stage_history`` (5i item 3)
    Every change of ``startup_profiles.stage``: who, when, from, to.
    Written in the SAME transaction as the stage change (5i item 4), so
    "time in stage" can never see a stage that was never recorded (5m).
    A stage change never touches ``startup_readiness`` rows — sign-offs
    survive a stage move (5i item 4, asserted by a test).

``stage_tool_progress`` (5j item 1)
    One generic table for the stage tools instead of 25 tables. The tool
    vocabulary is a fixed list in ``stage_service.TOOL_SPEC`` (D6), so
    ``tool_key`` is validated in the service, not by a reference table.
    Unique per (org, stage, tool_key) makes the write an idempotent upsert.

Portable types (same policy as 5a/5f): ``stage`` is VARCHAR(16) through
``Enum(native_enum=False)``; ``progress`` is SmallInteger + CHECK instead
of the ``score_100`` domain, which does not exist on SQLite.

``org_id`` references ``startup_profiles.org_id`` rather than
``organizations.id``, exactly like ``startup_readiness``: carrying stage
or tool state presupposes a startup profile row, which the service
creates on demand (the 5a ``_ensure_profile`` pattern).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.startup import StartupStage


class ToolStatus(enum.StrEnum):
    """Stage tool status (5j D6). Mirrors the readiness vocabulary shape
    without borrowing it: a tool is personal progress, not a review item."""

    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


class StartupStageHistory(Base):
    """Append-only log of stage changes (5i item 3)."""

    __tablename__ = "startup_stage_history"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    # NULL only for the baseline row written when history starts.
    from_stage: Mapped[StartupStage | None] = mapped_column(
        SAEnum(StartupStage, name="startup_stage", native_enum=False, length=16),
        nullable=True,
    )
    to_stage: Mapped[StartupStage] = mapped_column(
        SAEnum(StartupStage, name="startup_stage", native_enum=False, length=16),
        nullable=False,
    )
    # Server-controlled: stamped from the authenticated actor, never input.
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("startup_stage_history_org_idx", "org_id", "changed_at"),
    )


class StageToolProgress(Base):
    """Per (organization, stage, tool) progress (5j item 1)."""

    __tablename__ = "stage_tool_progress"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    stage: Mapped[StartupStage] = mapped_column(
        SAEnum(StartupStage, name="startup_stage", native_enum=False, length=16),
        nullable=False,
    )
    # Validated against stage_service.TOOL_SPEC (D6): unknown key is a 404,
    # never an auto-created row.
    tool_key: Mapped[str] = mapped_column(String(48), nullable=False)
    status: Mapped[ToolStatus] = mapped_column(
        String(16),
        nullable=False,
        default=ToolStatus.not_started,
        server_default="not_started",
    )
    progress: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 5j D9: reserved. The column exists (schema-size limit is enforced in
    # the service) but NO endpoint writes it in this step.
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Server-controlled: the authenticated actor of the last write.
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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

    __table_args__ = (
        # One row per tool per stage: the write is an upsert, never a
        # duplicate (5j item 1).
        UniqueConstraint(
            "org_id", "stage", "tool_key", name="stage_tool_progress_unique"
        ),
        CheckConstraint(
            "status IN ('not_started','in_progress','done')",
            name="stage_tool_progress_status_valid",
        ),
        CheckConstraint(
            "progress >= 0 AND progress <= 100",
            name="stage_tool_progress_progress_check",
        ),
        Index("stage_tool_progress_org_idx", "org_id", "stage"),
    )
