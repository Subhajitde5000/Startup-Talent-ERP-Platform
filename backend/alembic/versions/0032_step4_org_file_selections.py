"""Step 4 batch 1: durable logo/deck selections, never expiring URLs.

Only extends organizations/startup_profiles; no public file-sharing policy.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0032_step4_org_file_selections"
down_revision: str | None = "0031_step4_files"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table, column, constraint in (
        ("organizations", "logo_file_id", "fk_organizations_logo_file"),
        ("startup_profiles", "pitch_deck_file_id", "fk_startup_profiles_pitch_deck_file"),
    ):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column(column, postgresql.UUID(as_uuid=True), nullable=True))
            batch.create_foreign_key(constraint, "files", [column], ["id"], ondelete="SET NULL")
            batch.create_index(f"ix_{table}_{column}", [column])


def downgrade() -> None:
    for table, column, constraint in (
        ("startup_profiles", "pitch_deck_file_id", "fk_startup_profiles_pitch_deck_file"),
        ("organizations", "logo_file_id", "fk_organizations_logo_file"),
    ):
        with op.batch_alter_table(table) as batch:
            batch.drop_index(f"ix_{table}_{column}")
            batch.drop_constraint(constraint, type_="foreignkey")
            batch.drop_column(column)
