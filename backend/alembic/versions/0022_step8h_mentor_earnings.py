"""Step 8h: mentor earnings.

Revision ID: 0022_step8h_mentor_earnings
Revises: 0021_step8f_mentor_signoff
Create Date: 2026-11-16

One new table mirroring schema.sql's ``mentor_earnings``, including the
``mentor_earning_math`` CHECK that makes the database, not the service, the
guarantor of ``net = gross - commission - tds``.

One deviation, approved in the 8h plan: ``payout_batch_id`` is created as a
plain nullable UUID with NO foreign key. ``payout_batches`` belongs to Step
14f and does not exist yet; schema.sql itself defers this FK to its own
section 14 (``ALTER TABLE ... ADD CONSTRAINT mentor_earnings_batch_fk``).
Nothing writes the column before 14f, so the constraint can be added there
with nothing to backfill.

``status`` is VARCHAR(16) + the named CHECK rather than a Postgres enum,
matching every other status column in this schema.

No data is inserted: demo earnings belong to the dev seed script, never to a
migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0022_step8h_mentor_earnings"
down_revision: str | None = "0021_step8f_mentor_signoff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_OPEN = "status IN ('pending','approved')"


def upgrade() -> None:
    op.create_table(
        "mentor_earnings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("mentor_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=True),
        sa.Column("gross_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column(
            "commission_amount",
            sa.Numeric(14, 2),
            server_default="0",
            nullable=False,
        ),
        sa.Column("tds_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("net_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="INR", nullable=False),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("earned_on", sa.Date(), nullable=False),
        # 14f adds the FK to payout_batches when that table exists.
        sa.Column("payout_batch_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint("gross_amount >= 0", name="mentor_earnings_gross_check"),
        sa.CheckConstraint(
            "commission_amount >= 0", name="mentor_earnings_commission_check"
        ),
        sa.CheckConstraint("tds_amount >= 0", name="mentor_earnings_tds_check"),
        sa.CheckConstraint(
            "net_amount = gross_amount - commission_amount - tds_amount",
            name="mentor_earning_math",
        ),
        sa.CheckConstraint(
            "status IN ('pending','approved','in_payout','paid','held','reversed')",
            name="mentor_earning_status_valid",
        ),
        sa.CheckConstraint(
            "length(currency) = 3", name="mentor_earnings_currency_check"
        ),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["session_id"], ["mentoring_sessions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "mentor_earnings_mentor_idx",
        "mentor_earnings",
        ["mentor_id", sa.text("earned_on DESC")],
    )
    op.create_index(
        "mentor_earnings_status_idx",
        "mentor_earnings",
        ["status"],
        postgresql_where=sa.text(_OPEN),
        sqlite_where=sa.text(_OPEN),
    )


def downgrade() -> None:
    op.drop_index("mentor_earnings_status_idx", table_name="mentor_earnings")
    op.drop_index("mentor_earnings_mentor_idx", table_name="mentor_earnings")
    op.drop_table("mentor_earnings")
