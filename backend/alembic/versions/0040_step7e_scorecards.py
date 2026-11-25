"""Step 7e: organization scorecards, immutable scored rubrics and private ratings.

No demo/catalogue records. Downgrade destroys only 7e data; backup before rollback.
"""

import sqlalchemy as sa

from alembic import op

revision = "0040_step7e_scorecards"
down_revision = "0039_step7d_applicant_pipeline"
branch_labels = None
depends_on = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    ]


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
        sa.Column("job_id", sa.Uuid(), sa.ForeignKey("jobs.id", ondelete="CASCADE")),
        sa.Column("is_platform", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "source_scorecard_id", sa.Uuid(), sa.ForeignKey("scorecards.id", ondelete="SET NULL")
        ),
        sa.Column("locked_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="scorecards_name_check"),
        sa.CheckConstraint("is_platform = false", name="scorecards_org_only_check"),
        sa.CheckConstraint("locked_at IS NULL OR job_id IS NOT NULL", name="scorecards_lock_check"),
    )
    op.create_index("ix_scorecards_org_id", "scorecards", ["org_id"])
    op.create_index("ix_scorecards_job_id", "scorecards", ["job_id"])
    op.create_index("ix_scorecards_source_scorecard_id", "scorecards", ["source_scorecard_id"])
    op.create_index(
        "scorecards_live_job_key",
        "scorecards",
        ["job_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index("scorecards_org_page_idx", "scorecards", ["org_id", "created_at", "id"])
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
        sa.Column("anchors", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("display_order", sa.SmallInteger(), nullable=False, server_default="0"),
        *timestamps(),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200", name="scorecard_criteria_name_check"
        ),
        sa.CheckConstraint("weight BETWEEN 1 AND 100", name="scorecard_criteria_weight_check"),
        sa.CheckConstraint("display_order BETWEEN 0 AND 19", name="scorecard_criteria_order_check"),
    )
    op.create_index(
        "scorecard_criteria_card_idx",
        "scorecard_criteria",
        ["scorecard_id", "display_order"],
        unique=True,
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
            sa.ForeignKey("scorecard_criteria.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("interviewer_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("note", sa.Text()),
        *timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("score BETWEEN 1 AND 5", name="application_scores_score_check"),
        sa.CheckConstraint(
            "note IS NULL OR length(trim(note)) BETWEEN 1 AND 2000",
            name="application_scores_note_check",
        ),
    )
    for column in ("application_id", "criterion_id", "interviewer_id"):
        op.create_index(f"ix_application_scores_{column}", "application_scores", [column])
    op.create_index(
        "application_scores_unique",
        "application_scores",
        ["application_id", "criterion_id", "interviewer_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("application_scores")
    op.drop_table("scorecard_criteria")
    op.drop_table("scorecards")
