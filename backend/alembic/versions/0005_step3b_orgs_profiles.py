"""Step 3b/3c: organizations, members, invites, talent/mentor profiles,
notification preferences.

Revision ID: 0005_step3b_orgs_profiles
Revises: 0004_step3_user_profile_gaps
Create Date: 2026-11-17

Notes (documented deviations from schema.sql, same policy as 0003/0004):
- Native ENUM types -> VARCHAR + named CHECK constraints (portable).
- citext -> VARCHAR; slug uniqueness via partial index on lower(slug)
  WHERE deleted_at IS NULL (matches schema.sql semantics on both engines).
- mentor_profiles text[] columns -> JSON lists (SQLite has no arrays).
- organization_invites gains updated_at (AGENTS.md section 6).
- talent_profiles gains hide_current_employer (approved in the Step 3
  wiring decisions; schema.sql has no column for the settings toggle).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_step3b_orgs_profiles"
down_revision: str | None = "0004_step3_user_profile_gaps"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DT = sa.DateTime(timezone=True)
_NOW = sa.func.now()


def _create_step3b_tables() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "startup", "employer", "investor_firm", "agency", "other",
                name="org_type", native_enum=False, length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("logo_initials", sa.String(length=3), nullable=True),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("region", sa.Text(), nullable=True),
        sa.Column(
            "country",
            sa.String(length=2),
            server_default=sa.text("'IN'"),
            nullable=True,
        ),
        sa.Column("founded_year", sa.SmallInteger(), nullable=True),
        sa.Column("verified_at", _DT, nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "founded_year IS NULL OR (founded_year BETWEEN 1900 AND 2100)",
            name="organizations_founded_year_check",
        ),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200",
            name="organizations_name_check",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "organizations_slug_key",
        "organizations",
        [sa.text("lower(slug)")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index("organizations_type_idx", "organizations", ["type", "status"])
    op.create_index("organizations_region_idx", "organizations", ["region"])

    op.create_table(
        "organization_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "owner", "admin", "member", "viewer",
                name="org_role", native_enum=False, length=16,
            ),
            server_default=sa.text("'member'"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "invited", "active", "deactivated",
                name="member_status", native_enum=False, length=16,
            ),
            server_default=sa.text("'invited'"),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column(
            "department",
            sa.Enum(
                "engineering", "product", "design", "sales", "marketing",
                "operations", "finance", "people", "legal", "support", "other",
                name="department", native_enum=False, length=16,
            ),
            nullable=True,
        ),
        sa.Column("seat_type", sa.Text(), nullable=True),
        sa.Column(
            "is_founder",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "is_public",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("invited_by", sa.Uuid(), nullable=True),
        sa.Column("invited_email", sa.String(length=320), nullable=True),
        sa.Column("joined_at", _DT, nullable=True),
        sa.Column("last_active_at", _DT, nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("deleted_at", _DT, nullable=True),
        sa.CheckConstraint(
            "status <> 'active' OR joined_at IS NOT NULL",
            name="org_members_active_needs_join",
        ),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "org_members_unique_user",
        "organization_members",
        ["org_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "org_members_user_idx",
        "organization_members",
        ["user_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "org_members_status_idx", "organization_members", ["org_id", "status"]
    )

    op.create_table(
        "organization_invites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "owner", "admin", "member", "viewer",
                name="org_role", native_enum=False, length=16,
            ),
            server_default=sa.text("'member'"),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column(
            "department",
            sa.Enum(
                "engineering", "product", "design", "sales", "marketing",
                "operations", "finance", "people", "legal", "support", "other",
                name="department", native_enum=False, length=16,
            ),
            nullable=True,
        ),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("invited_by", sa.Uuid(), nullable=True),
        sa.Column("expires_at", _DT, nullable=False),
        sa.Column("accepted_at", _DT, nullable=True),
        sa.Column("revoked_at", _DT, nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "org_invites_token_key", "organization_invites", ["token_hash"], unique=True
    )
    op.create_index(
        "org_invites_pending_idx",
        "organization_invites",
        ["org_id", "email"],
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
        sqlite_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )

    op.create_table(
        "talent_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("headline", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("total_experience_yrs", sa.Numeric(4, 1), nullable=True),
        sa.Column("current_location", sa.Text(), nullable=True),
        sa.Column(
            "preferred_mode",
            sa.Enum(
                "onsite", "hybrid", "remote",
                name="work_mode", native_enum=False, length=16,
            ),
            nullable=True,
        ),
        sa.Column(
            "availability",
            sa.Enum(
                "immediate", "two_weeks", "one_month", "flexible", "not_looking",
                name="availability_mode", native_enum=False, length=16,
            ),
            server_default=sa.text("'flexible'"),
            nullable=False,
        ),
        sa.Column("salary_expectation", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "currency",
            sa.String(length=3),
            server_default=sa.text("'INR'"),
            nullable=False,
        ),
        sa.Column(
            "open_to_relocate",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("resume_id", sa.Uuid(), nullable=True),
        sa.Column(
            "is_searchable",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "hide_current_employer",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "total_experience_yrs IS NULL OR total_experience_yrs >= 0",
            name="talent_profiles_experience_check",
        ),
        sa.CheckConstraint(
            "salary_expectation IS NULL OR salary_expectation >= 0",
            name="talent_profiles_salary_check",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(
        "talent_profiles_searchable_idx", "talent_profiles", ["is_searchable"]
    )

    op.create_table(
        "talent_profile_skills",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("skill_id", sa.Uuid(), nullable=False),
        sa.Column("years", sa.Numeric(4, 1), nullable=True),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["talent_profiles.user_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("user_id", "skill_id"),
    )

    op.create_table(
        "mentor_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("headline", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column(
            "expertise",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column("sectors", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
        sa.Column(
            "languages",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column("years_experience", sa.SmallInteger(), nullable=True),
        sa.Column("hourly_fee", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "currency",
            sa.String(length=3),
            server_default=sa.text("'INR'"),
            nullable=False,
        ),
        sa.Column("cadence", sa.Text(), nullable=True),
        sa.Column(
            "max_startups",
            sa.SmallInteger(),
            server_default=sa.text("3"),
            nullable=False,
        ),
        sa.Column(
            "accepting_requests",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("rating", sa.Numeric(3, 2), nullable=True),
        sa.Column(
            "sessions_completed",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "is_verified",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.CheckConstraint(
            "years_experience IS NULL OR years_experience >= 0",
            name="mentor_profiles_experience_check",
        ),
        sa.CheckConstraint(
            "hourly_fee IS NULL OR hourly_fee >= 0",
            name="mentor_profiles_fee_check",
        ),
        sa.CheckConstraint("max_startups > 0", name="mentor_profiles_max_startups_check"),
        sa.CheckConstraint(
            "rating IS NULL OR (rating >= 0 AND rating <= 5)",
            name="mentor_profiles_rating_check",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(
        "mentor_profiles_accepting_idx", "mentor_profiles", ["accepting_requests"]
    )

    op.create_table(
        "notification_preferences",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column(
            "channel",
            sa.Enum(
                "in_app", "email", "push",
                name="notification_channel", native_enum=False, length=16,
            ),
            nullable=False,
        ),
        sa.Column(
            "is_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("created_at", _DT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _DT, server_default=_NOW, nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "category", "channel"),
    )


def _drop_step3b_tables() -> None:
    op.drop_table("notification_preferences")
    op.drop_index("mentor_profiles_accepting_idx", table_name="mentor_profiles")
    op.drop_table("mentor_profiles")
    op.drop_table("talent_profile_skills")
    op.drop_index("talent_profiles_searchable_idx", table_name="talent_profiles")
    op.drop_table("talent_profiles")
    op.drop_index("org_invites_pending_idx", table_name="organization_invites")
    op.drop_index("org_invites_token_key", table_name="organization_invites")
    op.drop_table("organization_invites")
    op.drop_index("org_members_status_idx", table_name="organization_members")
    op.drop_index("org_members_user_idx", table_name="organization_members")
    op.drop_index("org_members_unique_user", table_name="organization_members")
    op.drop_table("organization_members")
    op.drop_index("organizations_region_idx", table_name="organizations")
    op.drop_index("organizations_type_idx", table_name="organizations")
    op.drop_index("organizations_slug_key", table_name="organizations")
    op.drop_table("organizations")


def upgrade() -> None:
    _create_step3b_tables()


def downgrade() -> None:
    _drop_step3b_tables()
