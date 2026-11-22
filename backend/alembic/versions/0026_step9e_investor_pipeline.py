"""Step 9e: investor pipeline (deals + stage history).

Revision ID: 0026_step9e_investor_pipeline
Revises: 0025_step9d_investor_search
Create Date: 2026-11-21

``investor_deals`` is created verbatim from ``database/schema.sql``
(the table is referenced there but had no backend migration yet). The
``pipeline_stage`` enum is materialized here as VARCHAR(16) + named
CHECK (the portable-types policy: the native PG enum does not exist on
SQLite), and includes ``diligence`` between ``data_room`` and
``offer`` (plan D5). Because no earlier backend migration created
``pipeline_stage``, it is created fresh WITH ``diligence`` — there is
no existing enum to ALTER.

``investor_deal_stage_history`` (plan D4) is the append-only stage
log, written in the same transaction as each stage change (the 5i
``startup_stage_history`` pattern).

Portable types (project policy): ``stage`` is VARCHAR(16) + CHECK,
never a native PG enum; ``probability`` is the ``score_100`` domain
-> SmallInteger + CHECK; money is ``NUMERIC(14,2)`` + ISO-4217
``currency`` (never float).

No data is inserted: demo records belong to the dev seed script, never
to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0026_step9e_investor_pipeline"
down_revision: str | None = "0025_step9d_investor_search"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_LIVE = "deleted_at IS NULL"

_STAGE_SQL = (
    "stage IN ('interested','intro','meeting','data_room','diligence',"
    "'offer','committed','passed','closed')"
)


def upgrade() -> None:
    op.create_table(
        "investor_deals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("investor_org_id", sa.Uuid(), nullable=False),
        sa.Column("startup_org_id", sa.Uuid(), nullable=False),
        sa.Column("round_id", sa.Uuid(), nullable=True),
        sa.Column("stage", sa.String(length=16), server_default="interested",
                  nullable=False),
        sa.Column("probability", sa.SmallInteger(), nullable=True),
        sa.Column("ticket_size", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default="INR",
                  nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("fit_note", sa.Text(), nullable=True),
        sa.Column("next_step", sa.Text(), nullable=True),
        sa.Column("next_step_on", sa.Date(), nullable=True),
        sa.Column("last_activity_at", _DT, nullable=True),
        sa.Column("passed_reason", sa.Text(), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        # schema.sql verbatim: an investor cannot be dealing with itself.
        sa.CheckConstraint(
            "investor_org_id <> startup_org_id", name="deal_distinct_parties"
        ),
        sa.CheckConstraint(_STAGE_SQL, name="investor_deals_stage_valid"),
        # score_100 domain.
        sa.CheckConstraint(
            "probability IS NULL OR (probability >= 0 AND probability <= 100)",
            name="investor_deals_probability_check",
        ),
        sa.CheckConstraint(
            "length(currency) = 3", name="investor_deals_currency_check"
        ),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["startup_org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["round_id"], ["funding_rounds.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "investor_deals_unique",
        "investor_deals",
        ["investor_org_id", "startup_org_id"],
        unique=True,
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )
    op.create_index(
        "investor_deals_stage_idx",
        "investor_deals",
        ["investor_org_id", "stage"],
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )
    op.create_index(
        "investor_deals_startup_idx",
        "investor_deals",
        ["startup_org_id"],
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )

    op.create_table(
        "investor_deal_stage_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("from_stage", sa.String(length=16), nullable=True),
        sa.Column("to_stage", sa.String(length=16), nullable=False),
        sa.Column("changed_by", sa.Uuid(), nullable=True),
        sa.Column("changed_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.CheckConstraint(
            "to_stage IN ('interested','intro','meeting','data_room','diligence',"
            "'offer','committed','passed','closed')",
            name="investor_deal_history_to_stage_valid",
        ),
        sa.ForeignKeyConstraint(
            ["deal_id"], ["investor_deals.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["changed_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "investor_deal_stage_history_deal_idx",
        "investor_deal_stage_history",
        ["deal_id", "changed_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "investor_deal_stage_history_deal_idx",
        table_name="investor_deal_stage_history",
    )
    op.drop_table("investor_deal_stage_history")
    op.drop_index("investor_deals_startup_idx", table_name="investor_deals")
    op.drop_index("investor_deals_stage_idx", table_name="investor_deals")
    op.drop_index("investor_deals_unique", table_name="investor_deals")
    op.drop_table("investor_deals")
