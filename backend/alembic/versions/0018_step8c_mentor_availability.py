"""Step 8c: mentor weekly availability (a GAP table — proposed and approved).

Revision ID: 0018_step8c_mentor_availability
Revises: 0017_step8b_mentorships
Create Date: 2026-11-16

One new table, no data, so ``downgrade`` is a clean drop.

There is no ``mentor_availability`` in schema.sql: the plan marks 8c as a
GAP and requires the table to be proposed before it is built. The approved
shape is a WEEKLY RECURRING template (weekday + local start/end + IANA
timezone), not materialised dated slots, because 8d computes bookable
times from the template minus booked sessions and needs no generator job.

Not portable to a DB constraint: overlapping ranges. Postgres would need
EXCLUDE (no SQLite equivalent), so the service rejects overlaps with a 422
and the database guarantees only the exact-duplicate case through
``mentor_availability_unique`` on (mentor_id, weekday, start_time).

No data is inserted here: demo availability belongs to the dev seed
script, never to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0018_step8c_mentor_availability"
down_revision: str | None = "0017_step8b_mentorships"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "mentor_availability",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("mentor_id", sa.Uuid(), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "weekday >= 0 AND weekday <= 6", name="mentor_availability_weekday_check"
        ),
        sa.CheckConstraint("end_time > start_time", name="mentor_availability_range_check"),
        sa.ForeignKeyConstraint(["mentor_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "mentor_id", "weekday", "start_time", name="mentor_availability_unique"
        ),
    )
    op.create_index(
        "mentor_availability_mentor_idx",
        "mentor_availability",
        ["mentor_id", "weekday", "start_time"],
    )


def downgrade() -> None:
    op.drop_index("mentor_availability_mentor_idx", table_name="mentor_availability")
    op.drop_table("mentor_availability")
