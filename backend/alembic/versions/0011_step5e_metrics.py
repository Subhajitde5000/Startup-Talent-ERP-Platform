"""Step 5e: startup metrics.

Revision ID: 0011_step5e_metrics
Revises: 0010_step5f_readiness
Create Date: 2026-11-19

Mirrors schema.sql's ``startup_metrics`` table: the two named CHECKs
(``startup_metric_key_valid`` / ``startup_metric_source_valid``), the
unique (org, key, period) index ``startup_metrics_key_period`` and the
latest-lookup index ``startup_metrics_latest_idx``.

Deliberate differences from schema.sql, all with reasons:
- ``currency`` is VARCHAR(3) instead of ``char(3)``: char pads with spaces
  and does not exist on SQLite; the value is a 3-letter ISO code either way
  (migration 0005/0006 already store currency as VARCHAR(3)).
- ``currency`` carries no server default: schema.sql leaves it nullable and
  the service writes 'INR' when the client omits it (plan E3).
- No ``updated_at``: schema.sql has none; a correction is the same upsert
  for that period, so historical rows are never edited in place.

No data is inserted here: demo metrics belong in ``scripts/seed_dev.py``
(dev-only), never in a migration.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_step5e_metrics"
down_revision: str | None = "0010_step5f_readiness"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "startup_metrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("metric_key", sa.String(length=24), nullable=False),
        sa.Column("value", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column(
            "source",
            sa.String(length=24),
            server_default="startup_reported",
            nullable=False,
        ),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "metric_key IN ('mrr','arr','customers','burn','runway_months',"
            "'growth_mom','headcount','active_users')",
            name="startup_metric_key_valid",
        ),
        sa.CheckConstraint(
            "source IN ('startup_reported','calculated','mentor_verified',"
            "'admin_verified')",
            name="startup_metric_source_valid",
        ),
        sa.ForeignKeyConstraint(
            ["org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "startup_metrics_key_period",
        "startup_metrics",
        ["org_id", "metric_key", "period_end"],
        unique=True,
    )
    op.create_index(
        "startup_metrics_latest_idx",
        "startup_metrics",
        ["org_id", "metric_key", sa.text("period_end DESC")],
    )


def downgrade() -> None:
    op.drop_index("startup_metrics_latest_idx", table_name="startup_metrics")
    op.drop_index("startup_metrics_key_period", table_name="startup_metrics")
    op.drop_table("startup_metrics")
