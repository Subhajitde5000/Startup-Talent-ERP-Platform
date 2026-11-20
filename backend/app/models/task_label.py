"""Task labels and label links (Step 5d, schema.sql "tasks and milestones").

A label is an org-scoped catalogue row; a link attaches one label to one
task. Both live here because a link has no meaning without its label and
the two are always written together.

Deviations from schema.sql (all reported and approved in the 5d plan):

- ``task_labels.updated_at`` — AGENTS.md section 6 requires it on every
  table, and renaming or recolouring a label is a real update (D-2).
- The unique name index is on ``lower(name)`` instead of ``name``, so
  "Backend" and "backend" cannot coexist as two labels (D-1). A
  functional unique index works on PostgreSQL and on SQLite >= 3.9, so
  the dual-database test suite is unaffected.
- ``task_label_links`` gets an index on ``label_id`` (D-3). The composite
  primary key only serves ``task_id`` lookups; deleting a label (FK
  cascade) and filtering by label both need the reverse direction.
- Labels are HARD deleted (no ``deleted_at``, matching schema.sql): a
  soft-deleted label would keep its unique name slot forever, so the same
  name could never be created again (D-4). Deleting a label cascades its
  links and leaves the tasks untouched.

``color`` has no DB CHECK on purpose (D-5): a ``~`` regex is a PostgreSQL
operator with no portable SQLite equivalent, so the ``#RRGGBB`` shape is
validated in the Pydantic schema instead. Same reasoning as the enums
stored as VARCHAR + CHECK elsewhere.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Longest label name the API accepts (Design §18: compact pills).
MAX_LABEL_NAME = 40
# Design §18: "Up to 8 per task".
MAX_LABELS_PER_TASK = 8
# A sanity ceiling so one org cannot fill the picker with thousands of
# near-duplicate labels; generous for real teams.
MAX_LABELS_PER_ORG = 200


class TaskLabel(Base):
    __tablename__ = "task_labels"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # schema.sql omits this one; see D-2 in the module docstring.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "task_labels_org_name_key",
            "org_id",
            text("lower(name)"),
            unique=True,
        ),
        Index("task_labels_org_idx", "org_id"),
    )


class TaskLabelLink(Base):
    """Attach table: one label on one task (schema.sql ``task_label_links``)."""

    __tablename__ = "task_label_links"

    task_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    label_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("task_labels.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (Index("task_label_links_label_idx", "label_id"),)
