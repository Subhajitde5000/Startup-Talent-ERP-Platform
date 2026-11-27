"""Video-mode interview scores on practice_sessions.

Adds ``is_video_mode``, ``confidence_score``, ``body_language_score``, and
``communication_score`` to ``practice_sessions`` with 0-100 check constraints.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision = "0051_video_interview_scores"
down_revision = "0050_step7pq_practice_interviews"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "practice_sessions",
        sa.Column(
            "is_video_mode",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "practice_sessions",
        sa.Column("confidence_score", sa.SmallInteger(), nullable=True),
    )
    op.add_column(
        "practice_sessions",
        sa.Column("body_language_score", sa.SmallInteger(), nullable=True),
    )
    op.add_column(
        "practice_sessions",
        sa.Column("communication_score", sa.SmallInteger(), nullable=True),
    )
    op.create_check_constraint(
        "practice_session_confidence_valid",
        "practice_sessions",
        "confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "practice_session_body_language_valid",
        "practice_sessions",
        "body_language_score IS NULL OR body_language_score BETWEEN 0 AND 100",
    )
    op.create_check_constraint(
        "practice_session_communication_valid",
        "practice_sessions",
        "communication_score IS NULL OR communication_score BETWEEN 0 AND 100",
    )


def downgrade() -> None:
    op.drop_constraint(
        "practice_session_communication_valid", "practice_sessions", type_="check"
    )
    op.drop_constraint(
        "practice_session_body_language_valid", "practice_sessions", type_="check"
    )
    op.drop_constraint(
        "practice_session_confidence_valid", "practice_sessions", type_="check"
    )
    op.drop_column("practice_sessions", "communication_score")
    op.drop_column("practice_sessions", "body_language_score")
    op.drop_column("practice_sessions", "confidence_score")
    op.drop_column("practice_sessions", "is_video_mode")
