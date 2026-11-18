"""Step 5c: tasks.

Revision ID: 0009_step5c_tasks
Revises: 0008_step5b_milestones
Create Date: 2026-11-18

Mirrors schema.sql's ``tasks`` table exactly (named title CHECK
``tasks_title_check``, the three partial indexes), with the one
instructed difference: ``readiness_id`` has NO foreign key yet — the FK
and its cross-org validation arrive with Step 5f (BUILD_PLAN 5c item 4).

Portability notes: the title CHECK uses trim() instead of btrim()
(identical default space-trimming; btrim does not exist on SQLite), and
the ``task_status`` / ``task_priority`` enum types become VARCHAR +
CHECK (same policy as migrations 0003-0008).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import Enum as SAEnum

from alembic import op

revision: str = "0009_step5c_tasks"
down_revision: str | None = "0008_step5b_milestones"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            SAEnum(
                "todo",
                "in_progress",
                "in_review",
                "blocked",
                "done",
                name="task_status",
                native_enum=False,
                length=16,
            ),
            server_default="todo",
            nullable=False,
        ),
        sa.Column(
            "priority",
            SAEnum(
                "low",
                "medium",
                "high",
                "urgent",
                name="task_priority",
                native_enum=False,
                length=16,
            ),
            server_default="medium",
            nullable=False,
        ),
        sa.Column("milestone_id", sa.Uuid(), nullable=True),
        # Step 5f adds FK -> startup_readiness (ON DELETE SET NULL).
        sa.Column("readiness_id", sa.Uuid(), nullable=True),
        sa.Column("assignee_id", sa.Uuid(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column("completed_at", _DT, nullable=True),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint("length(trim(title)) > 0", name="tasks_title_check"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["milestone_id"], ["milestones.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "tasks_org_status_idx",
        "tasks",
        ["org_id", "status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "tasks_assignee_idx",
        "tasks",
        ["assignee_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "tasks_due_idx",
        "tasks",
        ["org_id", "due_on"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("tasks_due_idx", table_name="tasks")
    op.drop_index("tasks_assignee_idx", table_name="tasks")
    op.drop_index("tasks_org_status_idx", table_name="tasks")
    op.drop_table("tasks")
