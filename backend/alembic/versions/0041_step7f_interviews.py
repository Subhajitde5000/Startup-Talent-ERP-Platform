"""Step 7f: interviews, participants and panel feedback.

Reference: database/schema.sql sections ``interviews``,
``interview_participants`` and ``interview_feedback``. Deviations, matching
the model module docstring: String + named CHECKs instead of PG enum
types, ``updated_at`` on the child tables, a partial UNIQUE
(interview_id, author_id) on feedback, the participant user index, and a
response/responded_at consistency CHECK. ``interviews_app_idx`` keeps
schema.sql's DESC sort key.
"""

import sqlalchemy as sa

from alembic import op

revision = "0041_step7f_interviews"
down_revision = "0040_step7e_scorecards"
branch_labels = None
depends_on = None

FORMATS = "'video','phone','onsite','async'"
STATUSES = "'scheduled','confirmed','completed','cancelled','no_show','rescheduled'"
SIDES = "'interviewer','candidate','observer'"
RESPONSES = "'accepted','declined','tentative'"
RECOMMENDATIONS = "'strong_yes','yes','no','strong_no'"


def upgrade() -> None:
    op.create_table(
        "interviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(),
            sa.ForeignKey("job_applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("round_name", sa.String(100)),
        sa.Column("format", sa.String(16), nullable=False, server_default="video"),
        sa.Column("status", sa.String(16), nullable=False, server_default="scheduled"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_min", sa.SmallInteger(), nullable=False, server_default="45"),
        sa.Column("location", sa.String(500)),
        sa.Column("meeting_url", sa.String(500)),
        sa.Column(
            "created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("cancelled_reason", sa.Text()),
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
        sa.CheckConstraint(f"format IN ({FORMATS})", name="interviews_format_check"),
        sa.CheckConstraint(f"status IN ({STATUSES})", name="interviews_status_check"),
        sa.CheckConstraint(
            "duration_min BETWEEN 5 AND 480", name="interviews_duration_check"
        ),
        sa.CheckConstraint(
            "round_name IS NULL OR length(trim(round_name)) BETWEEN 1 AND 100",
            name="interviews_round_check",
        ),
        sa.CheckConstraint(
            "location IS NULL OR length(trim(location)) BETWEEN 1 AND 500",
            name="interviews_location_check",
        ),
        sa.CheckConstraint(
            "meeting_url IS NULL OR length(trim(meeting_url)) BETWEEN 1 AND 500",
            name="interviews_meeting_url_check",
        ),
        sa.CheckConstraint(
            "cancelled_reason IS NULL OR length(trim(cancelled_reason)) BETWEEN 1 AND 500",
            name="interviews_cancelled_reason_check",
        ),
    )
    op.create_index(
        "interviews_app_idx",
        "interviews",
        ["application_id", sa.text("scheduled_at DESC")],
    )
    op.create_index(
        "interviews_upcoming_idx",
        "interviews",
        ["scheduled_at"],
        postgresql_where=sa.text("status IN ('scheduled','confirmed')"),
        sqlite_where=sa.text("status IN ('scheduled','confirmed')"),
    )

    op.create_table(
        "interview_participants",
        sa.Column(
            "interview_id",
            sa.Uuid(),
            sa.ForeignKey("interviews.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "side", sa.String(16), nullable=False, server_default="interviewer"
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.Column("response", sa.String(16)),
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
        sa.CheckConstraint(f"side IN ({SIDES})", name="interview_participants_side_check"),
        sa.CheckConstraint(
            f"response IS NULL OR response IN ({RESPONSES})",
            name="interview_participants_response_check",
        ),
        sa.CheckConstraint(
            "(response IS NULL AND responded_at IS NULL) OR "
            "(response IS NOT NULL AND responded_at IS NOT NULL)",
            name="interview_participants_responded_check",
        ),
    )
    op.create_index(
        "interview_participants_user_idx", "interview_participants", ["user_id"]
    )

    op.create_table(
        "interview_feedback",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "interview_id",
            sa.Uuid(),
            sa.ForeignKey("interviews.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("recommendation", sa.String(16)),
        sa.Column("summary", sa.Text()),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
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
        sa.CheckConstraint(
            f"recommendation IS NULL OR recommendation IN ({RECOMMENDATIONS})",
            name="interview_feedback_recommendation_check",
        ),
        sa.CheckConstraint(
            "summary IS NULL OR length(trim(summary)) BETWEEN 1 AND 5000",
            name="interview_feedback_summary_check",
        ),
    )
    op.create_index(
        "interview_feedback_interview_idx", "interview_feedback", ["interview_id"]
    )
    op.create_index(
        "interview_feedback_author_unique",
        "interview_feedback",
        ["interview_id", "author_id"],
        unique=True,
        postgresql_where=sa.text("author_id IS NOT NULL"),
        sqlite_where=sa.text("author_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_table("interview_feedback")
    op.drop_table("interview_participants")
    op.drop_table("interviews")
