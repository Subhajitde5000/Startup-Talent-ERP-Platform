"""Step 3 frontend-gap columns on users (approved in the wiring inventory).

Revision ID: 0004_step3_user_profile_gaps
Revises: 0003_step3a_user_profile
Create Date: 2026-11-16

Adds the fields the founder profile edit page needs that schema.sql's users
table lacks (documented deviation, approved with the frontend plan):
- headline, bio, education, prior_role, din_number: profile text.
- profile_public, allow_outreach: privacy toggles (default true, matching
  schema.sql's talent_profiles.is_searchable convention and the existing UI).
Company is NOT added: it is derived from the user's organization (3b).
All columns are nullable/ defaulted, so plain ALTERs work on both dialects.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_step3_user_profile_gaps"
down_revision: str | None = "0003_step3a_user_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS: tuple[sa.Column, ...] = (
    sa.Column("headline", sa.String(length=160), nullable=True),
    sa.Column("bio", sa.Text(), nullable=True),
    sa.Column("education", sa.Text(), nullable=True),
    sa.Column("prior_role", sa.Text(), nullable=True),
    sa.Column("founder_vision", sa.Text(), nullable=True),
    sa.Column("din_number", sa.String(length=64), nullable=True),
    sa.Column(
        "profile_public",
        sa.Boolean(),
        server_default=sa.text("true"),
        nullable=False,
    ),
    sa.Column(
        "allow_outreach",
        sa.Boolean(),
        server_default=sa.text("true"),
        nullable=False,
    ),
)


def upgrade() -> None:
    for column in _COLUMNS:
        op.add_column("users", column)


def downgrade() -> None:
    for column in reversed(_COLUMNS):
        op.drop_column("users", column.name)
