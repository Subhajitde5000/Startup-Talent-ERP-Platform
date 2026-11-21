"""Step 9a: funding rounds (startup).

Revision ID: 0024_step9a_funding_rounds
Revises: 0023_step8i_session_reviews
Create Date: 2026-11-21

One new table mirroring schema.sql's ``funding_rounds`` (section 6),
including the ``round_amounts_non_negative`` CHECK and the
``funding_rounds_org_idx`` partial index verbatim.

Approved deviations (9a plan, user-approved):

- ``min_raise`` / ``min_ticket`` added (nullable NUMERIC(14,2)): the
  "Set up a fundraising round" modal collects Minimum raise and Minimum
  ticket, and schema.sql has no columns for either (plan D4).
- ``pre_money_valuation >= 0`` CHECK added (plan D8): schema.sql has no
  CHECK there.
- Enums (``funding_round_type``, ``round_status``, ``instrument_type``)
  are VARCHAR + named CHECKs, never native PG enums (project policy).
- ``currency`` is String(3) + length CHECK, not ``char(3)`` (SQLite has
  no ``char``; the value is a 3-letter ISO code either way).

``committed_amount`` starts at 0 and is server-only in 9a; only 9i/9j
(offers/commitments) will write it. Progress is derived in the service.

No data is inserted: demo rounds belong to the dev seed script, never to
a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0024_step9a_funding_rounds"
down_revision: str | None = "0023_step8i_session_reviews"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_LIVE = "deleted_at IS NULL"


def upgrade() -> None:
    op.create_table(
        "funding_rounds",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("round_type", sa.String(length=16), nullable=False),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "committed_amount",
            sa.Numeric(14, 2),
            server_default="0",
            nullable=False,
        ),
        sa.Column("currency", sa.String(length=3), server_default="INR", nullable=False),
        sa.Column("pre_money_valuation", sa.Numeric(14, 2), nullable=True),
        sa.Column("instrument", sa.String(length=16), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="draft", nullable=False),
        sa.Column("opens_on", sa.Date(), nullable=True),
        sa.Column("closes_on", sa.Date(), nullable=True),
        sa.Column("min_raise", sa.Numeric(14, 2), nullable=True),
        sa.Column("min_ticket", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "round_type IN ('pre_seed','seed','series_a','series_b','bridge','safe','other')",
            name="funding_round_type_valid",
        ),
        sa.CheckConstraint(
            "status IN ('draft','open','paused','closed','cancelled')",
            name="round_status_valid",
        ),
        sa.CheckConstraint(
            "instrument IS NULL OR instrument IN "
            "('equity','safe','convertible_note','ccd','ccps','debt','other')",
            name="funding_round_instrument_valid",
        ),
        # schema.sql verbatim.
        sa.CheckConstraint(
            "(target_amount IS NULL OR target_amount > 0) AND committed_amount >= 0",
            name="round_amounts_non_negative",
        ),
        sa.CheckConstraint(
            "pre_money_valuation IS NULL OR pre_money_valuation >= 0",
            name="funding_rounds_valuation_check",
        ),
        sa.CheckConstraint("length(currency) = 3", name="funding_rounds_currency_check"),
        sa.CheckConstraint(
            "min_raise IS NULL OR min_raise > 0",
            name="funding_rounds_min_raise_check",
        ),
        sa.CheckConstraint(
            "min_ticket IS NULL OR min_ticket > 0",
            name="funding_rounds_min_ticket_check",
        ),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200",
            name="funding_rounds_name_check",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "funding_rounds_org_idx",
        "funding_rounds",
        ["org_id", "status"],
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )


def downgrade() -> None:
    op.drop_index("funding_rounds_org_idx", table_name="funding_rounds")
    op.drop_table("funding_rounds")
