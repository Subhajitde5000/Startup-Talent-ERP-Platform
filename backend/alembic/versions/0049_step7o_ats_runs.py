"""Step 7o only: resume_ats_runs and lightweight ai_usage_events.

Tables:
- ``resume_ats_runs``: stores both rule-based ATS checks (``run_type='ats'``) and
  AI tailoring suggestions (``run_type='tailor'``).
- ``ai_usage_events``: lightweight metering table for AI calls (anticipates Step 7v).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision = "0049_step7o_ats_runs"
down_revision = "0048_step7n_resumes"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resume_ats_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=True),
        sa.Column(
            "run_type",
            sa.String(length=16),
            nullable=False,
            server_default="ats",
        ),
        sa.Column("score", sa.SmallInteger(), nullable=True),
        sa.Column(
            "missing_keywords",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "matched_keywords",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "suggestions",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "run_type IN ('ats','tailor')",
            name="resume_ats_runs_type_check",
        ),
        sa.CheckConstraint(
            "score IS NULL OR (score >= 0 AND score <= 100)",
            name="resume_ats_runs_score_check",
        ),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "resume_ats_runs_resume_idx",
        "resume_ats_runs",
        ["resume_id", sa.text("created_at DESC")],
        unique=False,
    )

    op.create_table(
        "ai_usage_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("feature", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column(
            "input_tokens",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "output_tokens",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("input_tokens >= 0", name="ai_usage_events_input_tokens_check"),
        sa.CheckConstraint("output_tokens >= 0", name="ai_usage_events_output_tokens_check"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ai_usage_events_user_idx",
        "ai_usage_events",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ai_usage_events_user_idx", table_name="ai_usage_events")
    op.drop_table("ai_usage_events")
    op.drop_index("resume_ats_runs_resume_idx", table_name="resume_ats_runs")
    op.drop_table("resume_ats_runs")
