"""Step 9d: investor preferences, saved searches and shortlist.

Revision ID: 0025_step9d_investor_search
Revises: 0024_step9a_funding_rounds
Create Date: 2026-11-21

``schema.sql`` has NO tables for this step (BUILD_PLAN marks 9d a GAP:
"propose tables first"). The three tables below are the proposal the
user approved in the 9b-9e backend plan:

- ``investor_preferences`` — one row per investor firm: investment
  thesis filters (sectors, stage focus, ticket size range) plus the
  investor sub-type used by the 9b directory (``angel`` /
  ``angel_group`` / ``fund`` / ``other``). ``schema.sql`` has no
  investor-type column anywhere, so it lives here (plan D1).
- ``saved_searches`` — a named, re-runnable copy of the 9c discovery
  filter set (criteria stored as JSON; keys whitelisted by the schema).
- ``shortlist_entries`` — the investor's bookmarked startups with a
  private note and a review status. Partial unique pair, same pattern
  as ``investor_deals`` (9e) and ``talent_shortlists`` (Step 7).

Portable types (project policy, same as migrations 0003-0024):
- ``shortlist_status`` / ``investor_type`` are VARCHAR + named CHECKs,
  never native PG enums.
- ``currency`` is not used here; money is ``NUMERIC(14,2)`` only.
- ``sectors`` / ``stage_focus`` / ``criteria`` are JSON (the
  ``startup_profiles.ecosystem_goals`` pattern).

No data is inserted: demo records belong to the dev seed script, never
to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0025_step9d_investor_search"
down_revision: str | None = "0024_step9a_funding_rounds"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_LIVE = "deleted_at IS NULL"


def upgrade() -> None:
    op.create_table(
        "investor_preferences",
        sa.Column("investor_org_id", sa.Uuid(), nullable=False),
        sa.Column("investor_type", sa.String(length=16), nullable=True),
        sa.Column("sectors", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("stage_focus", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("min_ticket", sa.Numeric(14, 2), nullable=True),
        sa.Column("max_ticket", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "investor_type IS NULL OR investor_type IN "
            "('angel','angel_group','fund','other')",
            name="investor_type_valid",
        ),
        sa.CheckConstraint(
            "min_ticket IS NULL OR min_ticket > 0",
            name="investor_preferences_min_ticket_check",
        ),
        sa.CheckConstraint(
            "max_ticket IS NULL OR max_ticket > 0",
            name="investor_preferences_max_ticket_check",
        ),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("investor_org_id"),
    )

    op.create_table(
        "saved_searches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("investor_org_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("criteria", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200",
            name="saved_searches_name_check",
        ),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "saved_searches_org_idx",
        "saved_searches",
        ["investor_org_id"],
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )

    op.create_table(
        "shortlist_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("investor_org_id", sa.Uuid(), nullable=False),
        sa.Column("startup_org_id", sa.Uuid(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=24), server_default="new", nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "status IN ('new','reviewing','follow_up','waiting_for_startup')",
            name="shortlist_status_valid",
        ),
        sa.CheckConstraint(
            "investor_org_id <> startup_org_id",
            name="shortlist_distinct_parties",
        ),
        sa.ForeignKeyConstraint(
            ["investor_org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["startup_org_id"], ["startup_profiles.org_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "shortlist_entries_investor_idx",
        "shortlist_entries",
        ["investor_org_id"],
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )
    op.create_index(
        "shortlist_entries_unique",
        "shortlist_entries",
        ["investor_org_id", "startup_org_id"],
        unique=True,
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )


def downgrade() -> None:
    op.drop_index("shortlist_entries_unique", table_name="shortlist_entries")
    op.drop_index("shortlist_entries_investor_idx", table_name="shortlist_entries")
    op.drop_table("shortlist_entries")
    op.drop_index("saved_searches_org_idx", table_name="saved_searches")
    op.drop_table("saved_searches")
    op.drop_table("investor_preferences")
