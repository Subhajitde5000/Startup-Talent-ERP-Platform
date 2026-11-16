"""create auth tables

Revision ID: 0001
Revises: 
Create Date: 2026-11-16 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # 2. Enum Types
    user_role_enum = postgresql.ENUM(
        "startup", "mentor", "investor", "jobseeker", "employer", "admin",
        name="user_role",
        create_type=False,
    )
    user_role_enum.create(op.get_bind(), checkfirst=True)

    account_status_enum = postgresql.ENUM(
        "pending", "active", "suspended", "deactivated", "deleted",
        name="account_status",
        create_type=False,
    )
    account_status_enum.create(op.get_bind(), checkfirst=True)

    review_state_enum = postgresql.ENUM(
        "unverified", "pending", "verified", "rejected", "expired",
        name="review_state",
        create_type=False,
    )
    review_state_enum.create(op.get_bind(), checkfirst=True)

    # 3. Helper function set_updated_at()
    op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            NEW.updated_at := now();
            RETURN NEW;
        END;
        $$;
    """)

    # 4. Table: users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("primary_email", postgresql.CITEXT(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("handle", postgresql.CITEXT(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("avatar_initials", sa.String(length=3), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("locale", sa.Text(), nullable=False, server_default="en-IN"),
        sa.Column("timezone", sa.Text(), nullable=False, server_default="Asia/Kolkata"),
        sa.Column("status", account_status_enum, nullable=False, server_default="pending"),
        sa.Column("verification", review_state_enum, nullable=False, server_default="unverified"),
        sa.Column("region", sa.Text(), nullable=True),
        sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("onboarding_step", sa.Text(), nullable=True),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("position('@' IN primary_email) > 1", name="chk_users_email_format"),
        sa.CheckConstraint("length(btrim(display_name)) BETWEEN 1 AND 160", name="chk_users_display_name_len"),
    )
    op.create_index("users_primary_email_key", "users", ["primary_email"], unique=True, postgresql_where=sa.text("deleted_at IS NULL"))
    op.create_index("users_handle_key", "users", ["handle"], unique=True, postgresql_where=sa.text("handle IS NOT NULL AND deleted_at IS NULL"))
    op.create_index("users_status_idx", "users", ["status"])
    op.create_index("users_last_active_idx", "users", [sa.text("last_active_at DESC NULLS LAST")])
    op.execute("CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at()")

    # 5. Table: user_roles
    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", user_role_enum, primary_key=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("user_roles_one_primary_idx", "user_roles", ["user_id"], unique=True, postgresql_where=sa.text("is_primary = true AND revoked_at IS NULL"))
    op.create_index("user_roles_role_idx", "user_roles", ["role"], postgresql_where=sa.text("revoked_at IS NULL"))

    # 6. Table: auth_sessions
    op.create_table(
        "auth_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("region", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.Text(), nullable=True),
        sa.Column("replaced_by_session_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "auth_sessions_replaced_by_fk",
        "auth_sessions",
        "auth_sessions",
        ["replaced_by_session_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("auth_sessions_token_key", "auth_sessions", ["refresh_token_hash"], unique=True)
    op.create_index("auth_sessions_user_idx", "auth_sessions", ["user_id", sa.text("created_at DESC")])
    op.create_index("auth_sessions_active_idx", "auth_sessions", ["user_id"], postgresql_where=sa.text("revoked_at IS NULL"))
    op.execute("CREATE TRIGGER auth_sessions_set_updated_at BEFORE UPDATE ON auth_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at()")

    # 7. Table: email_verification_tokens
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("email_verification_token_key", "email_verification_tokens", ["token_hash"], unique=True)
    op.create_index("email_verification_user_idx", "email_verification_tokens", ["user_id", sa.text("created_at DESC")])

    # 8. Table: password_reset_tokens
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_ip", postgresql.INET(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("password_reset_token_key", "password_reset_tokens", ["token_hash"], unique=True)
    op.create_index("password_reset_user_idx", "password_reset_tokens", ["user_id", sa.text("created_at DESC")])

    # 9. Table: login_attempts
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("succeeded", sa.Boolean(), nullable=False),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("login_attempts_email_idx", "login_attempts", ["email", sa.text("created_at DESC")])
    op.create_index("login_attempts_ip_idx", "login_attempts", ["ip", sa.text("created_at DESC")])
    op.create_index("login_attempts_fail_idx", "login_attempts", [sa.text("created_at DESC")], postgresql_where=sa.text("NOT succeeded"))


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS auth_sessions_set_updated_at ON auth_sessions")
    op.execute("DROP TRIGGER IF EXISTS users_set_updated_at ON users")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")

    # Drop tables in reverse dependency order
    op.drop_table("login_attempts")
    op.drop_table("password_reset_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_table("auth_sessions")
    op.drop_table("user_roles")
    op.drop_table("users")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS review_state")
    op.execute("DROP TYPE IF EXISTS account_status")
    op.execute("DROP TYPE IF EXISTS user_role")
