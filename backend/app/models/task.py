"""Task model (Step 5c, schema.sql "tasks and milestones" section).

Matches schema.sql exactly — no column deviations in this step.
Portable types (same policy as migrations 0003-0009): ``task_status``
and ``task_priority`` become VARCHAR + CHECK via
``Enum(native_enum=False)``, never native PG enums.

``readiness_id`` links a task to a readiness item of the same
organization. Step 5c created the column WITHOUT its foreign key on
purpose; Step 5f adds the FK (migration 0010) and exposes the field on
the task PATCH schema with a same-org validation.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TaskStatus(enum.StrEnum):
    """schema.sql ``task_status``. The UI maps its four columns onto
    these values (``blocked`` is kept but has no board column yet)."""

    todo = "todo"
    in_progress = "in_progress"
    in_review = "in_review"
    blocked = "blocked"
    done = "done"


class TaskPriority(enum.StrEnum):
    """schema.sql ``task_priority``."""

    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="task_status", native_enum=False, length=16),
        nullable=False,
        default=TaskStatus.todo,
        server_default="todo",
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, name="task_priority", native_enum=False, length=16),
        nullable=False,
        default=TaskPriority.medium,
        server_default="medium",
    )
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("milestones.id", ondelete="SET NULL"),
        nullable=True,
    )
    # FK added in Step 5f (migration 0010). Validated as a same-org
    # readiness item by task_service on every write.
    readiness_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_readiness.id", ondelete="SET NULL"),
        nullable=True,
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Server-managed: set when the task reaches ``done``, cleared when it
    # leaves ``done`` — never accepted from clients (plan D6).
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Per-(org, status) column order; written only by the move endpoint
    # (midpoint insert + per-column rebalance, plan D3).
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
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
        # schema.sql: CHECK (length(btrim(title)) > 0) — trim() instead of
        # btrim() so the constraint also evaluates on SQLite (identical
        # default space-trimming behaviour on PostgreSQL).
        CheckConstraint("length(trim(title)) > 0", name="tasks_title_check"),
    )
