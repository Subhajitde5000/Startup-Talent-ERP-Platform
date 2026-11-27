"""Step 7p/7q: practice_drills, practice_sessions, practice_transcript_turns.

Tables:
- ``practice_drills``: curated interview drill catalogue with prompts & rubric.
- ``practice_sessions``: job-seeker practice interview sessions + 4-dimension scores.
- ``practice_transcript_turns``: ordered interviewer & candidate turns per session.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision = "0050_step7pq_practice_interviews"
down_revision = "0049_step7o_ats_runs"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "practice_drills",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column(
            "difficulty",
            sa.String(length=16),
            nullable=False,
            server_default="medium",
        ),
        sa.Column("duration_min", sa.SmallInteger(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "prompts",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "rubric",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="true",
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
            "difficulty IN ('easy','medium','hard')",
            name="practice_difficulty_valid",
        ),
        sa.CheckConstraint(
            "duration_min IS NULL OR duration_min > 0",
            name="practice_duration_valid",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "practice_drills_category_idx",
        "practice_drills",
        ["category"],
        postgresql_where=sa.text("is_active"),
    )

    op.create_table(
        "practice_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("drill_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("target_role", sa.Text(), nullable=True),
        sa.Column("focus_area", sa.Text(), nullable=True),
        sa.Column(
            "difficulty",
            sa.String(length=16),
            nullable=False,
            server_default="medium",
        ),
        sa.Column(
            "question_count",
            sa.SmallInteger(),
            nullable=False,
            server_default="3",
        ),
        sa.Column(
            "questions",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="scheduled",
        ),
        sa.Column("score", sa.SmallInteger(), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("clarity", sa.SmallInteger(), nullable=True),
        sa.Column("structure", sa.SmallInteger(), nullable=True),
        sa.Column("empathy", sa.SmallInteger(), nullable=True),
        sa.Column("technical_rigor", sa.SmallInteger(), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "difficulty IN ('easy','medium','hard')",
            name="practice_session_difficulty_valid",
        ),
        sa.CheckConstraint(
            "question_count BETWEEN 1 AND 15",
            name="practice_session_question_count_valid",
        ),
        sa.CheckConstraint(
            "status IN ('scheduled','in_progress','completed','abandoned')",
            name="practice_session_status_valid",
        ),
        sa.CheckConstraint(
            "score IS NULL OR score BETWEEN 0 AND 100",
            name="practice_session_score_valid",
        ),
        sa.CheckConstraint(
            "duration_sec IS NULL OR duration_sec >= 0",
            name="practice_session_duration_valid",
        ),
        sa.CheckConstraint(
            "clarity IS NULL OR clarity BETWEEN 0 AND 100",
            name="practice_session_clarity_valid",
        ),
        sa.CheckConstraint(
            "structure IS NULL OR structure BETWEEN 0 AND 100",
            name="practice_session_structure_valid",
        ),
        sa.CheckConstraint(
            "empathy IS NULL OR empathy BETWEEN 0 AND 100",
            name="practice_session_empathy_valid",
        ),
        sa.CheckConstraint(
            "technical_rigor IS NULL OR technical_rigor BETWEEN 0 AND 100",
            name="practice_session_technical_rigor_valid",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["drill_id"], ["practice_drills.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "practice_sessions_user_idx",
        "practice_sessions",
        ["user_id", "created_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "practice_transcript_turns",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("speaker", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("question_index", sa.SmallInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "speaker IN ('interviewer','candidate')",
            name="practice_turn_speaker_valid",
        ),
        sa.ForeignKeyConstraint(["session_id"], ["practice_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "practice_turns_session_idx",
        "practice_transcript_turns",
        ["session_id", "id"],
    )


def downgrade() -> None:
    op.drop_index("practice_turns_session_idx", table_name="practice_transcript_turns")
    op.drop_table("practice_transcript_turns")
    op.drop_index("practice_sessions_user_idx", table_name="practice_sessions")
    op.drop_table("practice_sessions")
    op.drop_index("practice_drills_category_idx", table_name="practice_drills")
    op.drop_table("practice_drills")
