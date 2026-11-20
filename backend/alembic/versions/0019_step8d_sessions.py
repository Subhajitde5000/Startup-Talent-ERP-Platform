"""Step 8d: mentoring sessions and their attendees.

Revision ID: 0019_step8d_sessions
Revises: 0018_step8c_mentor_availability
Create Date: 2026-11-16

Two new tables, no data, so ``downgrade`` is a clean drop in reverse
dependency order.

Deviations from schema.sql (approved in the 8d plan, documented in the
model too):

- ``action_items`` is JSON rather than ``text[]`` (8b D-2, portability).
- ``readiness_id`` is NOT created. Nothing in 8d writes it; 8f/8e own the
  readiness link and can add it with a real writer (8d plan D-2).
- ``mentoring_sessions_slot_unique`` is added over schema.sql: a partial
  unique index on ``(mentorship_id, scheduled_at)`` for live statuses, so
  the database itself prevents the same mentorship being double-booked.
  schema.sql has only a non-unique index there.
- ``mentorship_id`` references ``mentorships.id`` (created by 0017) with
  ON DELETE CASCADE, exactly as schema.sql does.

Cross-mentorship double booking (one mentor, two startups, same instant)
cannot be expressed as an index here because ``mentor_id`` lives on
``mentorships``. ``session_service`` enforces it transactionally with a
row lock; see the 8d plan D-3 note in the model docstring.

No data is inserted here: demo sessions belong to the dev seed script,
never to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0019_step8d_sessions"
down_revision: str | None = "0018_step8c_mentor_availability"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_LIVE = "status IN ('proposed','scheduled','confirmed')"


def upgrade() -> None:
    op.create_table(
        "mentoring_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("mentorship_id", sa.Uuid(), nullable=False),
        sa.Column("topic", sa.String(length=200), nullable=True),
        sa.Column("session_type", sa.String(length=32), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="scheduled", nullable=False),
        sa.Column("scheduled_at", _DT, nullable=False),
        sa.Column("duration_min", sa.SmallInteger(), server_default="45", nullable=False),
        sa.Column("meeting_url", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("action_items", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("fee_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default="INR", nullable=False),
        sa.Column("completed_at", _DT, nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "status IN ('proposed','scheduled','confirmed','completed',"
            "'cancelled','no_show')",
            name="mentoring_sessions_status_valid",
        ),
        sa.CheckConstraint(
            "duration_min >= 5 AND duration_min <= 480",
            name="mentoring_sessions_duration_check",
        ),
        sa.CheckConstraint(
            "fee_amount IS NULL OR fee_amount >= 0",
            name="mentoring_sessions_fee_check",
        ),
        sa.CheckConstraint(
            "length(currency) = 3", name="mentoring_sessions_currency_check"
        ),
        sa.ForeignKeyConstraint(
            ["mentorship_id"], ["mentorships.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "mentoring_sessions_slot_unique",
        "mentoring_sessions",
        ["mentorship_id", "scheduled_at"],
        unique=True,
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )
    op.create_index(
        "mentoring_sessions_mentorship_idx",
        "mentoring_sessions",
        ["mentorship_id", "scheduled_at"],
    )
    op.create_index(
        "mentoring_sessions_upcoming_idx",
        "mentoring_sessions",
        ["scheduled_at"],
        postgresql_where=sa.text(_LIVE),
        sqlite_where=sa.text(_LIVE),
    )

    op.create_table(
        "session_attendees",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=16), server_default="startup", nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "role IN ('mentor','startup','observer')", name="session_attendees_role_check"
        ),
        sa.ForeignKeyConstraint(
            ["session_id"], ["mentoring_sessions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("session_id", "user_id"),
    )
    op.create_index("session_attendees_user_idx", "session_attendees", ["user_id"])


def downgrade() -> None:
    op.drop_index("session_attendees_user_idx", table_name="session_attendees")
    op.drop_table("session_attendees")
    op.drop_index("mentoring_sessions_upcoming_idx", table_name="mentoring_sessions")
    op.drop_index("mentoring_sessions_mentorship_idx", table_name="mentoring_sessions")
    op.drop_index("mentoring_sessions_slot_unique", table_name="mentoring_sessions")
    op.drop_table("mentoring_sessions")
