"""Step 5a: startup_profiles.

Revision ID: 0006_step5a_startup_profile
Revises: 0005_step3b_orgs_profiles
Create Date: 2026-11-18

Approved deviations from schema.sql section 4 (5a plan, user-confirmed):
- Drop location / founded_on (organizations.city / founded_year are the
  single source of truth) and team_size (computed from members).
- Rename tam_text -> market (frontend field is "Target customer & market").
- Add contacts_public for the profile page's "Team contacts" share toggle.
- Add onboarding gap columns: mrr_range, funding_status, pitch_deck_url,
  dpiit_status, ecosystem_goals.
- Portable types: startup_stage ENUM -> VARCHAR + CHECK (native_enum=False);
  profile_visibility stays VARCHAR + CHECK exactly as schema.sql's
  startup_visibility_valid constraint names it.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import Enum as SAEnum

from alembic import op

revision: str = "0006_step5a_startup_profile"
down_revision: str | None = "0005_step3b_orgs_profiles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()


def upgrade() -> None:
    op.create_table(
        "startup_profiles",
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("tagline", sa.Text(), nullable=True),
        sa.Column(
            "stage",
            SAEnum(
                "idea",
                "prototype",
                "early_revenue",
                "growth",
                "mature",
                name="startup_stage",
                native_enum=False,
                length=16,
            ),
            server_default=sa.text("'idea'"),
            nullable=False,
        ),
        sa.Column("sector", sa.Text(), nullable=True),
        sa.Column("business_model", sa.Text(), nullable=True),
        sa.Column("problem", sa.Text(), nullable=True),
        sa.Column("solution", sa.Text(), nullable=True),
        sa.Column("market", sa.Text(), nullable=True),
        sa.Column("traction_summary", sa.Text(), nullable=True),
        sa.Column("mrr_range", sa.String(length=100), nullable=True),
        sa.Column("funding_status", sa.String(length=100), nullable=True),
        sa.Column("pitch_deck_url", sa.String(length=500), nullable=True),
        sa.Column("dpiit_status", sa.String(length=100), nullable=True),
        sa.Column(
            "ecosystem_goals",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column(
            "mentor_verified",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("readiness_score", sa.SmallInteger(), nullable=True),
        sa.Column(
            "profile_visibility",
            sa.String(length=24),
            server_default=sa.text("'mentors_and_investors'"),
            nullable=False,
        ),
        sa.Column(
            "summary_public",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "traction_public",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "team_public",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "funding_public",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "round_public",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "readiness_public",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "contacts_public",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "profile_visibility IN ('private','mentors','mentors_and_investors','public')",
            name="startup_visibility_valid",
        ),
        sa.CheckConstraint(
            "readiness_score IS NULL OR (readiness_score >= 0 AND readiness_score <= 100)",
            name="startup_profiles_readiness_check",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("org_id"),
    )
    # No extra indexes: the only lookups are by primary key (member reads)
    # and organizations.slug (already indexed), which join to this table.


def downgrade() -> None:
    op.drop_table("startup_profiles")
