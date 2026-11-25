"""Step 7e: scorecard templates, criteria and application scores.

Reference: database/schema.sql sections ``scorecards``,
``scorecard_criteria`` and ``application_scores``. Deviations, matching
the model module docstring:

- String columns + named CHECKs instead of PostgreSQL enum types (none
  are needed for these tables anyway — no enum columns here).
- ``scorecard_criteria.anchors`` is JSON instead of ``text[]`` (SQLite
  parity with ``mentorships.needs`` / ``action_items``).
- ``updated_at`` on the child tables (AGENTS.md section 6; 0039 did the
  same for ``application_notes``).
- ``scorecards.deleted_at`` added so a template can be soft-deleted
  without CASCADE-destroying ``application_scores`` evidence.
"""

import sqlalchemy as sa

from alembic import op

revision = "0040_step7e_scorecards"
down_revision = "0039_step7d_applicant_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scorecards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "org_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("job_id", sa.Uuid(), sa.ForeignKey("jobs.id", ondelete="SET NULL")),
        sa.Column("is_platform", sa.Boolean(), nullable=False, server_default=sa.false()),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="scorecards_name_check"),
    )
    op.create_index("scorecards_org_idx", "scorecards", ["org_id"])
    op.create_index("scorecards_job_idx", "scorecards", ["job_id"])
    op.create_index(
        "scorecards_org_created_idx",
        "scorecards",
        ["org_id", "created_at", "id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "scorecard_criteria",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "scorecard_id",
            sa.Uuid(),
            sa.ForeignKey("scorecards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("weight", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("anchors", sa.JSON(), nullable=True),
        sa.Column("display_order", sa.SmallInteger(), nullable=False, server_default="0"),
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
        sa.CheckConstraint("weight > 0", name="scorecard_criteria_weight_check"),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200",
            name="scorecard_criteria_name_check",
        ),
    )
    op.create_index(
        "scorecard_criteria_card_idx",
        "scorecard_criteria",
        ["scorecard_id", "display_order"],
    )

    op.create_table(
        "application_scores",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(),
            sa.ForeignKey("job_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "criterion_id",
            sa.Uuid(),
            sa.ForeignKey("scorecard_criteria.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "interviewer_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("note", sa.Text()),
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
        sa.CheckConstraint("score BETWEEN 1 AND 5", name="application_scores_score_check"),
        sa.CheckConstraint(
            "note IS NULL OR length(trim(note)) BETWEEN 1 AND 2000",
            name="application_scores_note_check",
        ),
    )
    op.create_index(
        "application_scores_unique",
        "application_scores",
        ["application_id", "criterion_id", "interviewer_id"],
        unique=True,
    )
    op.create_index("application_scores_interviewer_idx", "application_scores", ["interviewer_id"])


def downgrade() -> None:
    op.drop_table("application_scores")
    op.drop_table("scorecard_criteria")
    op.drop_table("scorecards")
