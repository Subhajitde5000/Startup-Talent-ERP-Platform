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
        op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        op.execute("CREATE EXTENSION IF NOT EXISTS citext")
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
