"""Step 5a frontend gap columns (Option A, user-approved2026-11-18).

Revision ID: 0007_step5a_onboarding_gaps
Revises: 0006_step5a_startup_profile
Create Date: 2026-11-18

Small nullable columns the startup onboarding flow and the profile
page's Legal card collect but schema.sql section4 does not have:
legal entity type, product demo URL, raising status and target raise.
(Registration number / registered address stay deferred per D8;
team size stays dropped per D4.)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_step5a_onboarding_gaps"
down_revision: str | None = "0006_step5a_startup_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("startup_profiles", sa.Column("legal_entity", sa.String(length=100), nullable=True))
    op.add_column("startup_profiles", sa.Column("demo_url", sa.String(length=500), nullable=True))
    op.add_column("startup_profiles", sa.Column("actively_raising", sa.String(length=100), nullable=True))
    op.add_column("startup_profiles", sa.Column("target_raise", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("startup_profiles", "target_raise")
    op.drop_column("startup_profiles", "actively_raising")
    op.drop_column("startup_profiles", "demo_url")
    op.drop_column("startup_profiles", "legal_entity")
