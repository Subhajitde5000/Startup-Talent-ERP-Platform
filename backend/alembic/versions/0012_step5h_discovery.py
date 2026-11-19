"""Step 5h: discovery index on startup_profiles.

Revision ID: 0012_step5h_discovery
Revises: 0011_step5e_metrics
Create Date: 2026-11-16

NO TABLES ARE CREATED by this step. Discovery is a filtered read over
``organizations`` JOIN ``startup_profiles``; schema.sql has no
discovery/search table (no tsvector column, no GIN index, no materialized
view) and this step does not invent one.

The only DDL here is one composite index supporting the public discovery
query, whose WHERE clause is always
``profile_visibility = 'public' [AND stage = ?] [AND sector = ?]`` plus a
join on ``org_id``. It is declared PARTIAL (``WHERE profile_visibility =
'public'``) because non-public profiles are invisible to the anonymous
list and should not occupy the index at all.

``startup_discovery_public_idx`` is added on top of schema.sql, not copied
from it: schema.sql declares no index on ``startup_profiles`` beyond the
primary key and the visibility CHECK. Reason: the same reason every other
list step indexes its filter columns (0005 organizations, 0009 tasks) —
an unindexed filter column is a sequential scan once the table grows.

Reversible: ``downgrade`` drops only this index. It removes no column and
no row, so a downgrade loses no data.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012_step5h_discovery"
down_revision: str | None = "0011_step5e_metrics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "startup_discovery_public_idx",
        "startup_profiles",
        ["stage", "sector"],
        unique=False,
        postgresql_where=sa.text("profile_visibility = 'public'"),
        sqlite_where=sa.text("profile_visibility = 'public'"),
    )


def downgrade() -> None:
    op.drop_index(
        "startup_discovery_public_idx",
        table_name="startup_profiles",
    )
