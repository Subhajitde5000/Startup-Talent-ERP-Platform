"""Step 5k + 5l: extended metric keys, market size, competitors.

Revision ID: 0014_step5kl_analytics
Revises: 0013_step5ij_stage
Create Date: 2026-11-16

Three changes:

1. ``startup_metrics.startup_metric_key_valid`` is REPLACED so the CHECK
   covers the 23-key vocabulary (5e's eight + 5k's fifteen). This is
   additive in the only sense that matters: every key that was legal
   before is still legal, so no existing row is invalidated and no data is
   rewritten. The replacement is a drop+create of a named CHECK, which is
   how a constraint widens portably (0003 did the same for ``users``).
2. ``startup_market_size`` (5l item 1). NEW table: schema.sql only had
   ``startup_profiles.tam_text``, which is free text and cannot carry a
   value, unit, source, confidence or scenario.
3. ``startup_competitors`` (5l item 2). NEW table: schema.sql has none.

The key list is imported from ``app.models.metric`` rather than retyped, so
this migration and the model can never disagree about the allowed keys.

No data is inserted here: reference data and demo rows belong in the
idempotent bootstrap / dev-seed scripts, never in a migration (AGENTS.md).

Downgrade narrows the CHECK back to the 5e eight. That is lossy by nature:
rows written with a 5k key cannot survive a downgrade and are deleted first
so the narrowed constraint can be applied. The two new tables are dropped.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from app.models.metric import MetricKey

revision: str = "0014_step5kl_analytics"
down_revision: str | None = "0013_step5ij_stage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NOW = sa.func.now()

# 5e's original eight, frozen here so a future vocabulary change cannot
# silently change what this downgrade produces.
_STEP5E_KEYS = (
    "mrr",
    "arr",
    "customers",
    "burn",
    "runway_months",
    "growth_mom",
    "headcount",
    "active_users",
)

_UP_KEYS = tuple(key.value for key in MetricKey)
_DOWN_KEYS = _STEP5E_KEYS


def _key_check(keys: tuple[str, ...]) -> str:
    return "metric_key IN (" + ",".join(f"'{k}'" for k in keys) + ")"


def upgrade() -> None:
    # --- 5k: widen the metric vocabulary ---------------------------------
    op.drop_constraint(
        "startup_metric_key_valid", "startup_metrics", type_="check"
    )
    op.create_check_constraint(
        "startup_metric_key_valid", "startup_metrics", _key_check(_UP_KEYS)
    )

    # --- 5l item 1: market size ------------------------------------------
    op.create_table(
        "startup_market_size",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("metric", sa.String(length=8), nullable=False),
        sa.Column(
            "scenario",
            sa.String(length=16),
            nullable=False,
            server_default="base",
        ),
        sa.Column("value", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("unit", sa.String(length=16), nullable=False),
        sa.Column("estimate_year", sa.SmallInteger(), nullable=False),
        sa.Column(
            "source_type",
            sa.String(length=24),
            nullable=False,
            server_default="team_estimate",
        ),
        sa.Column("source_note", sa.String(length=500), nullable=True),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column(
            "confidence",
            sa.String(length=8),
            nullable=False,
            server_default="low",
        ),
        sa.Column("assumptions", sa.Text(), nullable=True),
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
        sa.CheckConstraint(
            "metric IN ('tam','sam','som')",
            name="startup_market_size_metric_valid",
        ),
        sa.CheckConstraint(
            "scenario IN ('conservative','base','optimistic')",
            name="startup_market_size_scenario_valid",
        ),
        sa.CheckConstraint(
            "source_type IN ('team_estimate','external_report','calculated','platform')",
            name="startup_market_size_source_valid",
        ),
        sa.CheckConstraint(
            "confidence IN ('high','medium','low')",
            name="startup_market_size_confidence_valid",
        ),
        sa.CheckConstraint(
            "unit IN ('currency','count')",
            name="startup_market_size_unit_valid",
        ),
        sa.CheckConstraint(
            "value >= 0", name="startup_market_size_value_check"
        ),
        sa.CheckConstraint(
            "estimate_year >= 1900 AND estimate_year <= 2100",
            name="startup_market_size_year_check",
        ),
        sa.ForeignKeyConstraint(
            ["org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "org_id", "metric", "scenario", name="startup_market_size_unique"
        ),
    )
    op.create_index(
        "startup_market_size_org_idx",
        "startup_market_size",
        ["org_id", "metric", "scenario"],
    )

    # --- 5l item 2: competitors ------------------------------------------
    op.create_table(
        "startup_competitors",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "type",
            sa.String(length=16),
            nullable=False,
            server_default="direct",
        ),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("target_customer", sa.String(length=200), nullable=True),
        sa.Column("positioning", sa.String(length=500), nullable=True),
        sa.Column("strengths", sa.String(length=1000), nullable=True),
        sa.Column("weaknesses", sa.String(length=1000), nullable=True),
        sa.Column("pricing_note", sa.String(length=200), nullable=True),
        sa.Column("last_reviewed_on", sa.Date(), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "type IN ('direct','indirect','substitute')",
            name="startup_competitors_type_valid",
        ),
        sa.ForeignKeyConstraint(
            ["org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Case-insensitive uniqueness per org, on LIVE rows only: a soft-deleted
    # competitor must not block re-adding the same company later.
    op.create_index(
        "startup_competitors_name_key",
        "startup_competitors",
        ["org_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "startup_competitors_org_idx",
        "startup_competitors",
        ["org_id", "deleted_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "startup_competitors_org_idx", table_name="startup_competitors"
    )
    op.drop_index(
        "startup_competitors_name_key", table_name="startup_competitors"
    )
    op.drop_table("startup_competitors")

    op.drop_index("startup_market_size_org_idx", table_name="startup_market_size")
    op.drop_table("startup_market_size")

    # Narrowing the CHECK would fail on any row holding a 5k key, so those
    # rows are removed first. This is the one genuinely lossy step and it is
    # stated here rather than discovered by the operator.
    op.execute(
        "DELETE FROM startup_metrics WHERE metric_key NOT IN ("
        + ",".join(f"'{k}'" for k in _DOWN_KEYS)
        + ")"
    )
    op.drop_constraint(
        "startup_metric_key_valid", "startup_metrics", type_="check"
    )
    op.create_check_constraint(
        "startup_metric_key_valid", "startup_metrics", _key_check(_DOWN_KEYS)
    )
