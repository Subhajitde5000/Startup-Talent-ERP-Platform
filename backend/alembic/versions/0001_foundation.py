"""Foundation: extensions + set_updated_at() (PostgreSQL only).

Revision ID: 0001_foundation
Revises:
Create Date: 2026-11-16

On SQLite (tests) this is a no-op. On PostgreSQL it creates the
pgcrypto/citext extensions and the set_updated_at() trigger function
from schema.sql section 0.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001_foundation"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # pgcrypto/citext back the schema.sql baseline conventions, but
        # nothing in the Alembic path references them (UUIDs are generated
        # client-side; citext columns are VARCHAR for portability). The
        # savepoint-guarded block lets migrations run on minimal PostgreSQL
        # builds without contrib (e.g. pgserver's bundled binary); on
        # standard PostgreSQL both extensions are still created.
        op.execute(
            """
            DO $$
            BEGIN
                CREATE EXTENSION IF NOT EXISTS pgcrypto;
                CREATE EXTENSION IF NOT EXISTS citext;
            EXCEPTION WHEN feature_not_supported THEN
                NULL;
            END $$;
            """
        )
        op.execute(
            """
            CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
              NEW.updated_at := now();
              RETURN NEW;
            END;
            $$
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
