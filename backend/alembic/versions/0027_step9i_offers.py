"""Step 9i: investor offers (versions + counters).

Revision ID: 0027_step9i_offers
Revises: 0026_step9e_investor_pipeline
Create Date: 2026-11-21

``investor_offers`` is created verbatim from ``database/schema.sql``
(the table is defined there but had no backend migration yet).
``offer_status`` and ``instrument_type`` are materialized as
VARCHAR(16) + named CHECK (the portable-types policy: the native PG
enums do not exist on SQLite). Money is ``NUMERIC(14,2)`` + ISO-4217
``currency`` (never float).

No data is inserted: demo records belong to the dev seed script, never
to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0027_step9i_offers"
down_revision: str | None = "0026_step9e_investor_pipeline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_LIVE = "deleted_at IS NULL"

_STATUS_SQL = (
    "status IN ('draft','sent','countered','accepted','declined',"
    "'expired','withdrawn')"
)
_INSTRUMENT_SQL = (
    "instrument IN ('equity','safe','convertible_note','ccd','ccps',"
    "'debt','other')"
)


def upgrade() -> None:
    op.create_table(
        "investor_offers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("round_id", sa.Uuid(), nullable=False),
        sa.Column("investor_org_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="INR",
                  nullable=False),
        sa.Column("instrument", sa.String(length=16), nullable=False),
        sa.Column("valuation_cap", sa.Numeric(14, 2), nullable=True),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("parent_offer_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="draft",
                  nullable=False),
        sa.Column("expires_on", sa.Date(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint("amount > 0", name="investor_offers_amount_check"),
        sa.CheckConstraint(_STATUS_SQL, name="offer_status_valid"),
        sa.CheckConstraint(_INSTRUMENT_SQL, name="investor_offers_instrument_valid"),
        sa.CheckConstraint(
            "discount_pct IS NULL OR (discount_pct >= 0 AND discount_pct <= 100)",
            name="investor_offers_discount_check",
        ),
        sa.CheckConstraint("version > 0", name="investor_offers_version_check"),
        sa.CheckConstraint(
            "length(currency) = 3", name="investor_offers_currency_check"
        ),
        sa.ForeignKeyConstraint(
            ["round_id"], ["funding_rounds.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["parent_offer_id"], ["investor_offers.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "investor_offers_round_idx",
        "investor_offers",
        ["round_id", "status"],
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )
    op.create_index(
        "investor_offers_investor_idx",
        "investor_offers",
        ["investor_org_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("investor_offers_investor_idx", table_name="investor_offers")
    op.drop_index("investor_offers_round_idx", table_name="investor_offers")
    op.drop_table("investor_offers")
