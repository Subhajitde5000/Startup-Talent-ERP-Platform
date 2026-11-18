"""Step 5b: milestones.

Revision ID: 0008_step5b_milestones
Revises: 0007_step5a_onboarding_gaps
Create Date: 2026-11-18

Mirrors schema.sql's ``milestones`` table (named status CHECK
``milestone_status_valid``, partial org index) plus one approved gap
column: ``description`` (5b plan D2 — the create-milestone modal
collects it, schema.sql has no column for it).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_step5b_milestones"
down_revision: str | None = "0007_step5a_onboarding_gaps"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "milestones",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="on_track",
            nullable=False,
        ),
        sa.Column("progress", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "progress >= 0 AND progress <= 100",
            name="milestones_progress_check",
        ),
        sa.CheckConstraint(
            "status IN ('on_track','at_risk','off_track','achieved','missed')",
            name="milestone_status_valid",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "milestones_org_idx",
        "milestones",
        ["org_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("milestones_org_idx", table_name="milestones")
    op.drop_table("milestones")
