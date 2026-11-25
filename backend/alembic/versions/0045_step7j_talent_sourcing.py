"""Step 7j: talent shortlists and outreach history.

Reference: database/schema.sql lines 812-831 for ``talent_shortlists``
and ``talent_shortlist_members``. ``talent_outreach`` does NOT exist in
schema.sql — it is the approved GAP table from the 7j plan (the
Invitations tab needs per-candidate history and KPIs), proposed with
columns/unique/indexes the plan listed and approved.

Deviations, matching the model module docstring:

- ``name`` is String(160) (schema.sql ``text``); the API validates 1-120.
- Extra index ``talent_shortlist_members_user_idx`` on the members FK
  ``user_id`` (AGENTS.md section 6 wants FK indexes; schema.sql has none
  — the composite PK already covers ``shortlist_id`` lookups).
- ``talent_outreach`` unique key is the plan's
  UNIQUE(org_id, candidate_user_id, job_id) — one live invite per
  candidate per job per org (dups -> 409 in the service).
"""

import sqlalchemy as sa

from alembic import op

revision = "0045_step7j_talent_sourcing"
down_revision = "0044_step7i_hiring_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "talent_shortlists",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "org_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column(
            "created_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    # schema.sql: partial index — deleted lists never appear in lookups.
    op.execute(
        "CREATE INDEX talent_shortlists_org_idx ON talent_shortlists "
        "(org_id) WHERE deleted_at IS NULL"
    )

    op.create_table(
        "talent_shortlist_members",
        sa.Column(
            "shortlist_id",
            sa.Uuid(),
            sa.ForeignKey("talent_shortlists.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "added_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "talent_shortlist_members_user_idx", "talent_shortlist_members", ["user_id"]
    )

    # GAP table (approved in the 7j plan): one row per invite sent.
    op.create_table(
        "talent_outreach",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "org_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "candidate_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            sa.Uuid(),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("note", sa.String(2000), nullable=True),
        sa.Column(
            "sent_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "org_id",
            "candidate_user_id",
            "job_id",
            name="talent_outreach_unique",
        ),
    )
    op.create_index(
        "talent_outreach_org_idx", "talent_outreach", ["org_id", sa.text("created_at DESC")]
    )
    op.create_index(
        "talent_outreach_sent_idx", "talent_outreach", ["sent_by", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("talent_outreach_sent_idx", table_name="talent_outreach")
    op.drop_index("talent_outreach_org_idx", table_name="talent_outreach")
    op.drop_table("talent_outreach")
    op.drop_index(
        "talent_shortlist_members_user_idx", table_name="talent_shortlist_members"
    )
    op.drop_table("talent_shortlist_members")
    op.drop_index("talent_shortlists_org_idx", table_name="talent_shortlists")
    op.drop_table("talent_shortlists")
