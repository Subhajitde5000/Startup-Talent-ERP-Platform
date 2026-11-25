"""Scoped hiring workflow revision. Downgrade deletes only this phase's data.

Static schema: no application-model imports and no demo data.
"""

import sqlalchemy as sa

from alembic import op

revision = "0041_step7f_interviews"
down_revision = "0040_step7e_scorecards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("round_name", sa.String(length=200), nullable=False),
        sa.Column("format", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_min", sa.SmallInteger(), nullable=False),
        sa.Column("location", sa.String(length=500), nullable=True),
        sa.Column("meeting_url", sa.String(length=2000), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("cancelled_reason", sa.String(length=1000), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "format IN ('video','phone','onsite','async')", name="interviews_format_check"
        ),
        sa.CheckConstraint(
            "status IN ('scheduled','confirmed','completed','cancelled','no_show')",
            name="interviews_status_check",
        ),
        sa.CheckConstraint(
            "duration_min BETWEEN 5 AND 480 AND version > 0", name="interviews_bounds_check"
        ),
        sa.CheckConstraint(
            "length(trim(round_name)) BETWEEN 1 AND 200", name="interviews_name_check"
        ),
        sa.ForeignKeyConstraint(["application_id"], ["job_applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "interviews_retry_key", "interviews", ["application_id", "request_id"], unique=True
    )
    op.create_index(
        op.f("ix_interviews_application_id"), "interviews", ["application_id"], unique=False
    )
    op.create_index(
        op.f("ix_interviews_scheduled_at"), "interviews", ["scheduled_at"], unique=False
    )
    op.create_index(op.f("ix_interviews_status"), "interviews", ["status"], unique=False)
    op.create_table(
        "interview_participants",
        sa.Column("interview_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("side", sa.String(length=16), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response", sa.String(length=16), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "response IS NULL OR response IN ('accepted','declined','tentative')",
            name="interview_participants_response_check",
        ),
        sa.CheckConstraint(
            "side IN ('candidate','interviewer','observer')",
            name="interview_participants_side_check",
        ),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("interview_id", "user_id"),
    )
    op.create_index(
        op.f("ix_interview_participants_user_id"),
        "interview_participants",
        ["user_id"],
        unique=False,
    )
    op.create_table(
        "interview_feedback",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("interview_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=True),
        sa.Column("recommendation", sa.String(length=16), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "recommendation IN ('strong_yes','yes','no','strong_no')",
            name="interview_feedback_recommendation_check",
        ),
        sa.CheckConstraint(
            "length(trim(summary)) BETWEEN 1 AND 5000", name="interview_feedback_summary_check"
        ),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "interview_feedback_author_key",
        "interview_feedback",
        ["interview_id", "author_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_interview_feedback_author_id"), "interview_feedback", ["author_id"], unique=False
    )
    op.create_index(
        op.f("ix_interview_feedback_interview_id"),
        "interview_feedback",
        ["interview_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("interview_feedback")
    op.drop_table("interview_participants")
    op.drop_table("interviews")
