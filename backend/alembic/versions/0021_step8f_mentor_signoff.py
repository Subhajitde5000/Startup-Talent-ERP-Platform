"""Step 8f: mentor sign-off provenance on startup_readiness.

Revision ID: 0021_step8f_mentor_signoff
Revises: 0020_step8e_deliverables
Create Date: 2026-11-16

One nullable column. ``signed_off_by`` already records WHICH USER signed a
readiness item off (and already references ``users.id``, so a mentor fits
without any change). What schema.sql cannot express is WHICH ENGAGEMENT the
sign-off came from: one mentor can hold two mentorships with the same
startup, and a sign-off has to stay attributable to the one it happened
through. This adds that, with ON DELETE SET NULL so deleting the engagement
never deletes the startup's readiness row.

Additive and nullable, so it is safe on existing data: admin sign-offs
(Step 5f) and every pre-8f row simply have no mentorship behind them.
``downgrade`` drops the column again, so the revision is reversible.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0021_step8f_mentor_signoff"
down_revision: str | None = "0020_step8e_deliverables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "startup_readiness",
        sa.Column("signed_off_mentorship_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "startup_readiness_signed_off_mentorship_fkey",
        "startup_readiness",
        "mentorships",
        ["signed_off_mentorship_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "startup_readiness_signed_off_mentorship_idx",
        "startup_readiness",
        ["signed_off_mentorship_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "startup_readiness_signed_off_mentorship_idx",
        table_name="startup_readiness",
    )
    op.drop_constraint(
        "startup_readiness_signed_off_mentorship_fkey",
        "startup_readiness",
        type_="foreignkey",
    )
    op.drop_column("startup_readiness", "signed_off_mentorship_id")
