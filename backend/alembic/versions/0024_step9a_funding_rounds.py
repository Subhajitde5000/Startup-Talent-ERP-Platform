"""Step 9a: startup funding rounds.

Revision ID: 0024_step9a_funding_rounds
Revises: 0023_step8i_session_reviews
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0024_step9a_funding_rounds"
down_revision: str | None = "0023_step8i_session_reviews"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "funding_rounds",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("org_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("round_type", sa.String(20), nullable=False),
        sa.Column("target_amount", sa.Numeric(14, 2)),
        sa.Column("committed_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("minimum_raise", sa.Numeric(14, 2)),
        sa.Column("minimum_ticket", sa.Numeric(14, 2)),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("pre_money_valuation", sa.Numeric(14, 2)),
        sa.Column("instrument", sa.String(20)),
        sa.Column("status", sa.String(12), nullable=False, server_default="draft"),
        sa.Column("opens_on", sa.Date()), sa.Column("closes_on", sa.Date()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("round_type IN ('pre_seed','seed','series_a','series_b','bridge','safe','other')", name="funding_round_type_valid"),
        sa.CheckConstraint("instrument IS NULL OR instrument IN ('equity','safe','convertible_note','ccd','ccps','debt','other')", name="funding_round_instrument_valid"),
        sa.CheckConstraint("status IN ('draft','open','paused','closed','cancelled')", name="funding_round_status_valid"),
        sa.CheckConstraint("(target_amount IS NULL OR target_amount > 0) AND committed_amount >= 0", name="round_amounts_non_negative"),
        sa.CheckConstraint("(minimum_raise IS NULL OR minimum_raise > 0) AND (minimum_ticket IS NULL OR minimum_ticket > 0) AND (pre_money_valuation IS NULL OR pre_money_valuation >= 0)", name="funding_round_terms_valid"),
        sa.CheckConstraint("minimum_raise IS NULL OR target_amount IS NULL OR minimum_raise <= target_amount", name="funding_round_minimum_target_valid"),
        sa.CheckConstraint("opens_on IS NULL OR closes_on IS NULL OR opens_on <= closes_on", name="funding_round_dates_valid"),
        sa.CheckConstraint("length(currency) = 3 AND currency = upper(currency) AND substr(currency, 1, 1) BETWEEN 'A' AND 'Z' AND substr(currency, 2, 1) BETWEEN 'A' AND 'Z' AND substr(currency, 3, 1) BETWEEN 'A' AND 'Z'", name="funding_round_currency_valid"),
    )
    op.create_index("funding_rounds_org_idx", "funding_rounds", ["org_id", "status"], postgresql_where=sa.text("deleted_at IS NULL"), sqlite_where=sa.text("deleted_at IS NULL"))


def downgrade() -> None:
    op.drop_index("funding_rounds_org_idx", table_name="funding_rounds")
    op.drop_table("funding_rounds")
