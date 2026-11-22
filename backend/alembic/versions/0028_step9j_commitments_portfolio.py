"""Step 9j: commitments and portfolio holdings.

Revision ID: 0028_step9j_commit_portfolio
Revises: 0027_step9i_offers
Create Date: 2026-11-21

``commitments`` and ``portfolio_holdings`` are created verbatim from
``database/schema.sql`` (both tables are defined there but had no
backend migration yet). Status columns are VARCHAR + named CHECK (the
portable-types policy: the native PG enums do not exist on SQLite).
Money is ``NUMERIC(14,2)`` + ISO-4217 ``currency`` (never float).

``commitments`` has NO ``deleted_at`` (schema.sql): cancellation is a
status (``cancelled``), never a soft delete.

No data is inserted: demo records belong to the dev seed script, never
to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0028_step9j_commit_portfolio"
down_revision: str | None = "0027_step9i_offers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()

_COMMITMENT_STATUS_SQL = (
    "status IN ('pledged','documented','funded','cancelled')"
)
_HOLDING_STATUS_SQL = (
    "status IN ('active','written_off','exited','partially_exited')"
)
_INSTRUMENT_SQL = (
    "instrument IN ('equity','safe','convertible_note','ccd','ccps',"
    "'debt','other')"
)


def upgrade() -> None:
    op.create_table(
        "commitments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("round_id", sa.Uuid(), nullable=False),
        sa.Column("offer_id", sa.Uuid(), nullable=True),
        sa.Column("investor_org_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="INR",
                  nullable=False),
        sa.Column("status", sa.String(length=16), server_default="pledged",
                  nullable=False),
        sa.Column("committed_on", sa.Date(), nullable=True),
        sa.Column("funded_on", sa.Date(), nullable=True),
        sa.Column("wired_at", _DT, nullable=True),
        sa.Column("reference", sa.Text(), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint("amount > 0", name="commitments_amount_check"),
        sa.CheckConstraint(_COMMITMENT_STATUS_SQL, name="commitment_status_valid"),
        sa.CheckConstraint(
            "length(currency) = 3", name="commitments_currency_check"
        ),
        sa.ForeignKeyConstraint(
            ["round_id"], ["funding_rounds.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["offer_id"], ["investor_offers.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "commitments_round_idx", "commitments", ["round_id", "status"]
    )
    op.create_index(
        "commitments_investor_idx", "commitments", ["investor_org_id"]
    )

    op.create_table(
        "portfolio_holdings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("investor_org_id", sa.Uuid(), nullable=False),
        sa.Column("startup_org_id", sa.Uuid(), nullable=False),
        sa.Column("commitment_id", sa.Uuid(), nullable=True),
        sa.Column("instrument", sa.String(length=16), nullable=False),
        sa.Column("invested_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="INR",
                  nullable=False),
        sa.Column("ownership_pct", sa.Numeric(6, 4), nullable=True),
        sa.Column("invested_on", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="active",
                  nullable=False),
        sa.Column("exited_on", sa.Date(), nullable=True),
        sa.Column("exit_value", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "investor_org_id <> startup_org_id", name="holding_distinct_parties"
        ),
        sa.CheckConstraint(_HOLDING_STATUS_SQL, name="holding_status_valid"),
        sa.CheckConstraint(_INSTRUMENT_SQL,
                           name="portfolio_holdings_instrument_valid"),
        sa.CheckConstraint(
            "invested_amount >= 0", name="portfolio_holdings_amount_check"
        ),
        sa.CheckConstraint(
            "ownership_pct IS NULL OR (ownership_pct >= 0 AND ownership_pct <= 100)",
            name="portfolio_holdings_ownership_check",
        ),
        sa.CheckConstraint(
            "length(currency) = 3", name="portfolio_holdings_currency_check"
        ),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["startup_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["commitment_id"], ["commitments.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "portfolio_holdings_investor_idx",
        "portfolio_holdings",
        ["investor_org_id", "status"],
    )


def downgrade() -> None:
    op.drop_index(
        "portfolio_holdings_investor_idx", table_name="portfolio_holdings"
    )
    op.drop_table("portfolio_holdings")
    op.drop_index("commitments_investor_idx", table_name="commitments")
    op.drop_index("commitments_round_idx", table_name="commitments")
    op.drop_table("commitments")
