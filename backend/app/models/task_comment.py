"""Task comments (Step 5d, schema.sql "tasks and milestones").

Matches schema.sql exactly — no column deviations.

Scope (approved plan): flat comments only. Threading and ``@mentions``
from the design doc need a parent column and the notification pipeline
(Step 11), so neither is built here.

Soft delete is deliberate (BUILD_PLAN 5d: "Comments are soft-deleted"):
the row survives for audit and for the activity event that names it, and
every read path filters ``deleted_at IS NULL``.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Comment body bounds. The design doc asks for rich text; we store and
# return plain text and do no server-side rendering, so the cap is on raw
# characters.
MAX_COMMENT_BODY = 5000


class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
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
        # schema.sql: CHECK (length(btrim(body)) > 0). trim() instead of
        # btrim() so the constraint also evaluates on SQLite (identical
        # default space-trimming) — same treatment as tasks_title_check.
        CheckConstraint("length(trim(body)) > 0", name="task_comments_body_check"),
        # schema.sql: (task_id, created_at) WHERE deleted_at IS NULL — the
        # thread read is always "live comments of this task, oldest first".
        Index(
            "task_comments_task_idx",
            "task_id",
            "created_at",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )
