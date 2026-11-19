"""Step 3d: team management completion — activity log, invite message.

Revision ID: 0015_step3d_team_management
Revises: 0014_step5kl_analytics
Create Date: 2026-11-16

Three changes, all additive:

1. ``activity_events`` — NEW table, exactly the shape schema.sql declares
   (id, org_id, user_id, event_type, entity_type, entity_id, summary,
   link_url, metadata, created_at + the two index). This is the audit log
   Step 3d item 8 asks for; the 15b audit table does not exist yet and
   schema.sql already ships this one, so nothing is invented.
   Portable deviations, same policy as earlier revisions: ``id`` is bigint
   on PostgreSQL but INTEGER on SQLite (only INTEGER autoincrements there),
   and ``metadata`` is JSON rather than jsonb.
2. ``organization_invites.message`` — nullable String(500). The invite form
   already collects a personal message; schema.sql has no column for it.
3. ``organization_invites.is_public`` — NOT NULL boolean, default true,
   server default true. The form's "show on public profile" toggle belongs
   to the member row, so the invite has to carry the choice until it is
   accepted; schema.sql has no column for it either.

Both invite columns are documented deviations from schema.sql (missing
there, required by the frontend form — reported before building).

No data is inserted and no row is rewritten, so this revision is fully
reversible: ``downgrade`` drops the two columns and the table.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015_step3d_team_management"
down_revision: str | None = "0014_step5kl_analytics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)


def upgrade() -> None:
    # bigint on PostgreSQL, INTEGER on SQLite (SQLite only autoincrements
    # an INTEGER PRIMARY KEY). Same treatment as login_attempts (0002).
    op.create_table(
        "activity_events",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("org_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=True),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("link_url", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", _DT, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["org_id"], ["organizations.id"], name="activity_events_org_id_fkey", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="activity_events_user_id_fkey", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # Both indexes feed a reverse-chronological feed; schema.sql declares
    # the same pair.
    op.create_index(
        "activity_events_org_idx",
        "activity_events",
        ["org_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "activity_events_user_idx",
        "activity_events",
        ["user_id", sa.text("created_at DESC")],
    )

    op.add_column(
        "organization_invites",
        sa.Column("message", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "organization_invites",
        sa.Column(
            "is_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("organization_invites", "is_public")
    op.drop_column("organization_invites", "message")
    op.drop_index("activity_events_user_idx", table_name="activity_events")
    op.drop_index("activity_events_org_idx", table_name="activity_events")
    op.drop_table("activity_events")
