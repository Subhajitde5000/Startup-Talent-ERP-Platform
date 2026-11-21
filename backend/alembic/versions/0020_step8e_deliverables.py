"""Step 8e: mentor deliverables.

Revision ID: 0020_step8e_deliverables
Revises: 0019_step8d_sessions
Create Date: 2026-11-16

One new table. ``downgrade`` drops it, so the revision is reversible.

Deviations from schema.sql (approved in the 8e plan, documented in the
model too):

- ``file_id`` is NOT created. It references ``files(id)``, which is Step 4
  and deliberately deferred (BUILD_PLAN line 164); a foreign key to a
  missing table cannot be created. Evidence is the ``evidence`` text
  column, exactly as 5f handled its own attachments (5f D6).
- ``status`` is VARCHAR(24) + the named CHECK rather than the Postgres
  ``deliverable_status`` enum, matching every other status column here and
  keeping the SQLite test backend identical. 24, not the customary 16:
  ``changes_requested`` is 17 characters.
- ``reviewed_by`` is ADDED over schema.sql: it records WHO accepted or
  asked for changes, information schema.sql drops on the floor and the
  startup page needs. Stamped from the token, never from a body.
- ``mentor_deliverables_owner_idx`` is added for "work assigned to me".

No data is inserted: demo deliverables belong to the dev seed script, never
to a migration (AGENTS.md section 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020_step8e_deliverables"
down_revision: str | None = "0019_step8d_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_OPEN = "deleted_at IS NULL"
_NOT_DONE = "deleted_at IS NULL AND status <> 'accepted'"


def upgrade() -> None:
    op.create_table(
        "mentor_deliverables",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("mentorship_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("linked_criterion", sa.Uuid(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("due_on", sa.Date(), nullable=True),
        # length 24: ``changes_requested`` is 17 characters. schema.sql uses
        # an enum, so there is no length there to copy; 16 (the convention
        # for the other status columns) silently truncates on PostgreSQL.
        sa.Column(
            "status", sa.String(length=24), server_default="not_started", nullable=False
        ),
        sa.Column("submitted_at", _DT, nullable=True),
        sa.Column("reviewed_at", _DT, nullable=True),
        sa.Column("reviewed_by", sa.Uuid(), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "status IN ('not_started','in_progress','submitted',"
            "'changes_requested','accepted','overdue')",
            name="mentor_deliverables_status_valid",
        ),
        sa.CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 200",
            name="mentor_deliverables_title_check",
        ),
        sa.ForeignKeyConstraint(
            ["mentorship_id"], ["mentorships.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["linked_criterion"], ["readiness_criteria.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "mentor_deliverables_mentorship_idx",
        "mentor_deliverables",
        ["mentorship_id", "status"],
        postgresql_where=sa.text(_OPEN),
        sqlite_where=sa.text(_OPEN),
    )
    op.create_index(
        "mentor_deliverables_due_idx",
        "mentor_deliverables",
        ["due_on"],
        postgresql_where=sa.text(_NOT_DONE),
        sqlite_where=sa.text(_NOT_DONE),
    )
    op.create_index(
        "mentor_deliverables_owner_idx", "mentor_deliverables", ["owner_id"]
    )


def downgrade() -> None:
    op.drop_index("mentor_deliverables_owner_idx", table_name="mentor_deliverables")
    op.drop_index("mentor_deliverables_due_idx", table_name="mentor_deliverables")
    op.drop_index(
        "mentor_deliverables_mentorship_idx", table_name="mentor_deliverables"
    )
    op.drop_table("mentor_deliverables")
