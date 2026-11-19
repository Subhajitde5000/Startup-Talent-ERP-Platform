"""Step 5i + 5j: stage history, stage exit criteria flag, stage tools.

Revision ID: 0013_step5ij_stage
Revises: 0012_step5h_discovery
Create Date: 2026-11-16

Three changes:

1. ``readiness_criteria.is_exit_criterion`` (5i D1). Adds a NOT NULL
   boolean with ``server_default false``, so every existing row — the six
   5f readiness items — keeps its current meaning and ``readiness_score``
   is bit-identical after this migration.
2. ``startup_stage_history`` (5i item 3). NEW table: schema.sql has none.
3. ``stage_tool_progress`` (5j item 1). NEW table: schema.sql has none.

Items 2 and 3 are GAPs in schema.sql; both were proposed and approved
before building. No data is inserted here — the 25 stage exit criteria and
the tool vocabulary are reference data loaded by
``scripts/bootstrap_stage_criteria.py`` (idempotent by code), never by a
migration (AGENTS.md).

Downgrade drops both new tables and the flag column. The flag column
carries no data that exists elsewhere, so dropping it is lossless for the
six readiness items; the two new tables are step-local state.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013_step5ij_stage"
down_revision: str | None = "0012_step5h_discovery"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NOW = sa.func.now()


def upgrade() -> None:
    # 5i D1: distinguishes the 25 stage exit criteria from the six
    # readiness items without a second criteria table.
    op.add_column(
        "readiness_criteria",
        sa.Column(
            "is_exit_criterion",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "startup_stage_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("from_stage", sa.String(length=16), nullable=True),
        sa.Column("to_stage", sa.String(length=16), nullable=False),
        sa.Column("changed_by", sa.Uuid(), nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=_NOW,
        ),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(
            ["org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "startup_stage_history_org_idx",
        "startup_stage_history",
        ["org_id", "changed_at"],
    )

    op.create_table(
        "stage_tool_progress",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("stage", sa.String(length=16), nullable=False),
        sa.Column("tool_key", sa.String(length=48), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column(
            "progress", sa.SmallInteger(), nullable=False, server_default="0"
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=_NOW,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=_NOW,
        ),
        sa.ForeignKeyConstraint(
            ["org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "org_id", "stage", "tool_key", name="stage_tool_progress_unique"
        ),
        sa.CheckConstraint(
            "status IN ('not_started','in_progress','done')",
            name="stage_tool_progress_status_valid",
        ),
        sa.CheckConstraint(
            "progress >= 0 AND progress <= 100",
            name="stage_tool_progress_progress_check",
        ),
    )
    op.create_index(
        "stage_tool_progress_org_idx",
        "stage_tool_progress",
        ["org_id", "stage"],
    )


def downgrade() -> None:
    op.drop_index("stage_tool_progress_org_idx", table_name="stage_tool_progress")
    op.drop_table("stage_tool_progress")
    op.drop_index(
        "startup_stage_history_org_idx", table_name="startup_stage_history"
    )
    op.drop_table("startup_stage_history")
    op.drop_column("readiness_criteria", "is_exit_criterion")
