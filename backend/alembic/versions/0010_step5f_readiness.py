"""Step 5f: readiness criteria, per-startup readiness and the deferred
``tasks.readiness_id`` foreign key.

Revision ID: 0010_step5f_readiness
Revises: 0009_step5c_tasks
Create Date: 2026-11-18

Mirrors schema.sql's ``readiness_criteria`` and ``startup_readiness``
tables (named unique keys, the status CHECK) and adds the foreign key
that Step 5c deliberately omitted (BUILD_PLAN 5c item 4 / 5f item 5).

Deliberate differences from schema.sql, all with reasons:
- ``startup_readiness.score`` declares its own CHECK
  (``startup_readiness_score_check``) instead of the ``score_100``
  DOMAIN: domains do not exist on SQLite, and the other score columns
  already use SmallInteger + CHECK (5a ``startup_profiles``).
- ``readiness_criteria.weight`` gets a named CHECK
  (``readiness_criteria_weight_check``) for the same reason.
- The ``v_startup_readiness`` view is NOT created: it divides by the
  number of *touched* rows and therefore reports NULL for a fresh
  startup. The service computes signed-off / active criteria instead
  (plan D1).

The criteria rows themselves are NOT inserted here — a migration is not
a seeding mechanism (AGENTS.md). ``scripts/bootstrap_readiness.py``
bootstraps them idempotently (plan D2).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import Enum as SAEnum

from alembic import op

revision: str = "0010_step5f_readiness"
down_revision: str | None = "0009_step5c_tasks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "readiness_criteria",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "stage",
            SAEnum(
                "idea",
                "prototype",
                "early_revenue",
                "growth",
                "mature",
                name="startup_stage",
                native_enum=False,
                length=16,
            ),
            nullable=True,
        ),
        sa.Column("weight", sa.SmallInteger(), server_default="1", nullable=False),
        sa.Column(
            "display_order", sa.SmallInteger(), server_default="0", nullable=False
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint("weight > 0", name="readiness_criteria_weight_check"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="readiness_criteria_code_key"),
    )
    op.create_table(
        "startup_readiness",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("criterion_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status", sa.String(length=16), server_default="not_started", nullable=False
        ),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("score", sa.SmallInteger(), nullable=True),
        sa.Column("signed_off_by", sa.Uuid(), nullable=True),
        sa.Column("signed_off_at", _DT, nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "status IN ('not_started','in_progress','submitted',"
            "'signed_off','rejected')",
            name="startup_readiness_status_valid",
        ),
        sa.CheckConstraint(
            "score IS NULL OR (score >= 0 AND score <= 100)",
            name="startup_readiness_score_check",
        ),
        sa.ForeignKeyConstraint(
            ["org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["criterion_id"], ["readiness_criteria.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["signed_off_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "org_id", "criterion_id", name="startup_readiness_unique"
        ),
    )
    op.create_index(
        "startup_readiness_status_idx",
        "startup_readiness",
        ["org_id", "status"],
    )

    # Step 5c deferred this FK on purpose (BUILD_PLAN 5c item 4).
    with op.batch_alter_table("tasks") as batch:
        batch.create_foreign_key(
            "tasks_readiness_id_fkey",
            "startup_readiness",
            ["readiness_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.drop_constraint("tasks_readiness_id_fkey", type_="foreignkey")

    op.drop_index("startup_readiness_status_idx", table_name="startup_readiness")
    op.drop_table("startup_readiness")
    op.drop_table("readiness_criteria")
