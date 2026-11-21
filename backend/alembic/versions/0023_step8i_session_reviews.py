"""Step 8i: session reviews, absent from schema.sql.

Revision ID: 0023_step8i_session_reviews
Revises: 0022_step8h_mentor_earnings
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0023_step8i_session_reviews"
down_revision: str | None = "0022_step8h_mentor_earnings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "session_reviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("mentoring_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reviewer_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("public_text", sa.String(2000)),
        sa.Column("private_feedback", sa.String(2000)),
        sa.Column("public_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("anonymous", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint(
            "session_id", "reviewer_id", name="session_reviews_session_reviewer_key"
        ),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="session_reviews_rating_check"),
        sa.CheckConstraint(
            "public_text IS NULL OR length(public_text) <= 2000",
            name="session_reviews_public_text_check",
        ),
        sa.CheckConstraint(
            "private_feedback IS NULL OR length(private_feedback) <= 2000",
            name="session_reviews_private_feedback_check",
        ),
    )
    op.create_index("session_reviews_reviewer_idx", "session_reviews", ["reviewer_id"])


def downgrade() -> None:
    op.drop_index("session_reviews_reviewer_idx", table_name="session_reviews")
    op.drop_table("session_reviews")
