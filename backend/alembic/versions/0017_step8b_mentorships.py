"""Step 8b: mentorship requests and engagements.

Revision ID: 0017_step8b_mentorships
Revises: 0016_step5d_task_labels_comments
Create Date: 2026-11-16

One new table, no data and no row rewrites, so ``downgrade`` is a clean
drop.

Deviations from schema.sql (approved in the 8b plan, documented in the
model too):

- ``needs`` is JSON rather than ``text[]``. Postgres arrays have no SQLite
  equivalent and the codebase already stores list columns as JSON, so both
  test backends behave identically (D-2).
- ``currency`` is ``String(3)`` + CHECK rather than ``char(3)``, which pads
  with spaces and differs across backends (D-3).
- ``fit_score`` stays as a nullable reserved column and is never written
  (D-4).
- ``terms`` is free text attached to the request; the versioned, structured
  home for terms is ``mentor_agreements`` in Step 8g (D-5).
- ``mentorships_status_valid`` / ``mentorship_health_valid`` /
  ``mentorships_dates_check`` / the money checks are real CHECK
  constraints, per AGENTS.md section 6.

``mentorships_active_unique`` is schema.sql's rule verbatim: at most one
row per (mentor, startup) may be requested/active/paused at a time, so a
declined, cancelled or completed row frees the pair to request again. It
is a PARTIAL unique index on both backends (``postgresql_where`` and
``sqlite_where``) so SQLite enforces the same rule as production.

No data is inserted here: demo rows belong to the dev seed script, never
to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_step8b_mentorships"
down_revision: str | None = "0016_step5d_task_labels_comments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_BUSY = "deleted_at IS NULL AND status IN ('requested','active','paused')"


def upgrade() -> None:
    op.create_table(
        "mentorships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("mentor_id", sa.Uuid(), nullable=False),
        sa.Column("startup_org_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="requested", nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("needs", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("cadence", sa.String(length=32), nullable=True),
        sa.Column("terms", sa.Text(), nullable=True),
        sa.Column("equity_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("fee_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default="INR", nullable=False),
        sa.Column("fit_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("health", sa.String(length=16), nullable=True),
        sa.Column("started_on", sa.Date(), nullable=True),
        sa.Column("ended_on", sa.Date(), nullable=True),
        sa.Column("last_session_at", _DT, nullable=True),
        sa.Column("next_session_at", _DT, nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "status IN ('requested','active','paused','completed',"
            "'declined','cancelled')",
            name="mentorships_status_valid",
        ),
        sa.CheckConstraint(
            "health IS NULL OR health IN ('on_track','at_risk','stalled')",
            name="mentorship_health_valid",
        ),
        sa.CheckConstraint(
            "equity_pct IS NULL OR (equity_pct >= 0 AND equity_pct <= 100)",
            name="mentorships_equity_pct_check",
        ),
        sa.CheckConstraint(
            "fee_amount IS NULL OR fee_amount >= 0",
            name="mentorships_fee_amount_check",
        ),
        sa.CheckConstraint(
            "fit_score IS NULL OR (fit_score >= 0 AND fit_score <= 100)",
            name="mentorships_fit_score_check",
        ),
        sa.CheckConstraint(
            "ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on",
            name="mentorships_dates_check",
        ),
        sa.CheckConstraint("length(currency) = 3", name="mentorships_currency_check"),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["startup_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # "One active mentorship per pair" — partial on both backends.
    op.create_index(
        "mentorships_active_unique",
        "mentorships",
        ["mentor_id", "startup_org_id"],
        unique=True,
        postgresql_where=sa.text(_BUSY),
        sqlite_where=sa.text(_BUSY),
    )
    op.create_index(
        "mentorships_mentor_idx",
        "mentorships",
        ["mentor_id", "status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "mentorships_startup_idx",
        "mentorships",
        ["startup_org_id", "status"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("mentorships_startup_idx", table_name="mentorships")
    op.drop_index("mentorships_mentor_idx", table_name="mentorships")
    op.drop_index("mentorships_active_unique", table_name="mentorships")
    op.drop_table("mentorships")
