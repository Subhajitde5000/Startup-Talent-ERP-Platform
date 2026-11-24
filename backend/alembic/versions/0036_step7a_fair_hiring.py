"""Step 7a wiring gap: persist the editor's fair-hiring confirmation.

Existing jobs are not retrospectively certified. This is a job confirmation
flag, not a versioned legal consent record. No other step's schema changes.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0036_step7a_fair_hiring"
down_revision: str | None = "0035_step7a_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("fair_hiring_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("jobs", "fair_hiring_confirmed")
