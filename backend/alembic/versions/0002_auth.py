"""Auth tables (Step 2): users, user_roles, auth_sessions,
email_verification_tokens, password_reset_tokens, login_attempts.

Revision ID: 0002_auth
Revises: 0001_foundation
Create Date: 2026-11-16

Derived from database/schema.sql section 2 (Step 2 subset only).
user_mfa_factors and admin_members are deferred to Step 15a.

Portability deviations (see app/models/user.py):
- citext/inet -> VARCHAR, native ENUM -> VARCHAR+CHECK (native_enum=False),
  partial unique indexes -> unique constraints. Same DDL runs on
  PostgreSQL (prod) and SQLite (tests). Production hardening (Step 17)
  may migrate to native types.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_auth"
down_revision: str | None = "0001_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("primary_email", sa.String(320), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("handle", sa.String(64), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("avatar_initials", sa.String(3), nullable=True),
        sa.Column("phone", sa.String(32), nullable=True),
        sa.Column("locale", sa.String(16), nullable=False, server_default="en-IN"),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="Asia/Kolkata"),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "active",
                "suspended",
                "deactivated",
                "deleted",
                name="account_status",
                native_enum=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "verification",
            sa.Enum(
                "unverified",
                "pending",
                "verified",
                "rejected",
                "expired",
                name="review_state",
                native_enum=False,
            ),
            nullable=False,
            server_default="unverified",
        ),
        sa.Column("region", sa.String(64), nullable=True),
        sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("onboarding_step", sa.String(64), nullable=True),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("primary_email"),
        sa.UniqueConstraint("handle"),
    )
    op.create_index("users_status_idx", "users", ["status"])
    op.create_index("users_last_active_idx", "users", ["last_active_at"])

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "startup",
                "mentor",
                "investor",
                "jobseeker",
                "employer",
                "admin",
                name="user_role",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "granted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role"),
    )
    op.create_index("user_roles_role_idx", "user_roles", ["role"])

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("refresh_token_hash", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("region", sa.String(64), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(64), nullable=True),
        sa.Column("replaced_by_session_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["replaced_by_session_id"], ["auth_sessions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token_hash"),
    )
    op.create_index("auth_sessions_user_idx", "auth_sessions", ["user_id", "created_at"])

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        "email_verification_user_idx", "email_verification_tokens", ["user_id", "created_at"]
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_ip", sa.String(45), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("password_reset_user_idx", "password_reset_tokens", ["user_id", "created_at"])

    op.create_table(
        "login_attempts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("succeeded", sa.Boolean(), nullable=False),
        sa.Column("failure_reason", sa.String(128), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("login_attempts_email_idx", "login_attempts", ["email", "created_at"])
    op.create_index("login_attempts_ip_idx", "login_attempts", ["ip", "created_at"])

    # updated_at triggers (PostgreSQL only; SQLite relies on onupdate).
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in ("users", "auth_sessions"):
            op.execute(
                f"""
                CREATE TRIGGER {table}_set_updated_at
                BEFORE UPDATE ON {table}
                FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                """
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in ("users", "auth_sessions"):
            op.execute(f"DROP TRIGGER IF EXISTS {table}_set_updated_at ON {table}")
    op.drop_table("login_attempts")
    op.drop_table("password_reset_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_table("auth_sessions")
    op.drop_table("user_roles")
    op.drop_table("users")
