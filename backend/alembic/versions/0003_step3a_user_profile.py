"""Step 3a: profile columns on users, skills, user_readiness, data_requests.

Revision ID: 0003_step3a_user_profile
Revises: 0002_auth
Create Date: 2026-11-16

Item 4/5 specifics:
- The Step 2 unique constraints on users.primary_email / users.handle are
  replaced by PARTIAL unique indexes (WHERE deleted_at IS NULL) named exactly
  like schema.sql: users_primary_email_key, users_handle_key.
  - PostgreSQL: DROP CONSTRAINT (auto names verified against pg_catalog:
    users_primary_email_key / users_handle_key) then CREATE INDEX same names.
  - SQLite: those constraints are unnamed sqlite_autoindex_* (cannot be
    dropped by name), so the table is rewritten via batch mode with an
    explicit copy_from (alembic's recommended recipe); FK enforcement for the
  migration connection is disabled in env.py.
- CHECK (primary_email = lower(primary_email)) added (VARCHAR stays).
- data_requests keeps the exact schema.sql column shape; the FK to
  admin_members is deferred to Step 15a (that table does not exist yet).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic.operations import BatchOperations

from alembic import op

revision: str = "0003_step3a_user_profile"
down_revision: str | None = "0002_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_URL_COLUMNS = ("linkedin_url", "github_url", "twitter_url", "website_url")


def _add_url_columns(batch: BatchOperations) -> None:
    for name in _URL_COLUMNS:
        batch.add_column(sa.Column(name, sa.Text(), nullable=True))


def _users_copy_from(bind: sa.engine.Connection) -> sa.Table:
    """Reflect the pre-migration users table for SQLite batch mode.

    SQLite reflects the two legacy UNIQUE constraints with no name, which
    batch_alter_table cannot drop — assign the names alembic will emit on
    the recreated table (also the schema.sql index names).
    """
    meta = sa.MetaData()
    table = sa.Table("users", meta, autoload_with=bind)
    for constraint in list(table.constraints):
        if isinstance(constraint, sa.UniqueConstraint):
            cols = {c.name for c in constraint.columns}
            if cols == {"primary_email"}:
                constraint.name = "users_primary_email_key"
            elif cols == {"handle"}:
                constraint.name = "users_handle_key"
    return table


def _create_step3a_tables() -> None:
    op.create_table(
        "skills",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "skills_name_key", "skills", [sa.text("lower(name)")], unique=True
    )

    op.create_table(
        "user_readiness",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("profile_complete", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("resume_score", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("practice_score", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("overall_score", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "profile_complete BETWEEN 0 AND 100"
            " AND resume_score BETWEEN 0 AND 100"
            " AND practice_score BETWEEN 0 AND 100"
            " AND overall_score BETWEEN 0 AND 100",
            name="user_readiness_scores_100_check",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "data_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "request_type",
            sa.Enum(
                "access", "erasure", "rectification", "portability",
                "restriction", "objection",
                name="data_request_type", native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("authority", sa.String(length=160), nullable=True),
        sa.Column("data_subject_id", sa.Uuid(), nullable=True),
        sa.Column("data_subject_label", sa.String(length=320), nullable=True),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "received", "verifying", "in_progress", "fulfilled",
                "rejected", "expired",
                name="data_request_status", native_enum=False,
            ),
            server_default=sa.text("'received'"),
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum(
                "low", "normal", "high", "urgent", "critical",
                name="case_priority", native_enum=False,
            ),
            server_default=sa.text("'normal'"),
            nullable=False,
        ),
        sa.Column("records_identified", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fulfilled_at", sa.DateTime(timezone=True), nullable=True),
        # FK -> admin_members.assigned_to is added in Step 15a (table not yet
        # migrated); the column exists now. Named CHECKs below substitute for
        # schema.sql's native enum types (portable VARCHAR + CHECK).
        sa.Column("assigned_to", sa.Uuid(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "request_type IN ('access','erasure','rectification','portability','restriction','objection')",
            name="data_requests_request_type_check",
        ),
        sa.CheckConstraint(
            "status IN ('received','verifying','in_progress','fulfilled','rejected','expired')",
            name="data_requests_status_check",
        ),
        sa.CheckConstraint(
            "priority IN ('low','normal','high','urgent','critical')",
            name="data_requests_priority_check",
        ),
        sa.ForeignKeyConstraint(["data_subject_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("data_requests_queue_idx", "data_requests", ["status", "due_at"])
    op.create_index("data_requests_subject_idx", "data_requests", ["data_subject_id"])


def _drop_step3a_tables() -> None:
    op.drop_index("data_requests_subject_idx", table_name="data_requests")
    op.drop_index("data_requests_queue_idx", table_name="data_requests")
    op.drop_table("data_requests")
    op.drop_table("user_readiness")
    op.drop_index("skills_name_key", table_name="skills")
    op.drop_table("skills")


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        for name in _URL_COLUMNS:
            op.add_column("users", sa.Column(name, sa.Text(), nullable=True))
        op.drop_constraint("users_primary_email_key", "users", type_="unique")
        op.drop_constraint("users_handle_key", "users", type_="unique")
        op.create_check_constraint(
            "users_primary_email_lower_check",
            "users",
            "primary_email = lower(primary_email)",
        )
        op.create_index(
            "users_primary_email_key",
            "users",
            ["primary_email"],
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )
        op.create_index(
            "users_handle_key",
            "users",
            ["handle"],
            unique=True,
            postgresql_where=sa.text("handle IS NOT NULL AND deleted_at IS NULL"),
        )
    else:
        # SQLite: legacy uniques are unnamed autoindexes; rewrite the table
        # in batch mode (env.py disables FK checks for this connection).
        with op.batch_alter_table("users", copy_from=_users_copy_from(bind)) as batch:
            _add_url_columns(batch)
            batch.drop_constraint("users_primary_email_key", type_="unique")
            batch.drop_constraint("users_handle_key", type_="unique")
            batch.create_check_constraint(
                "users_primary_email_lower_check",
                "primary_email = lower(primary_email)",
            )
            batch.create_index(
                "users_primary_email_key",
                ["primary_email"],
                unique=True,
                sqlite_where=sa.text("deleted_at IS NULL"),
            )
            batch.create_index(
                "users_handle_key",
                ["handle"],
                unique=True,
                sqlite_where=sa.text("handle IS NOT NULL AND deleted_at IS NULL"),
            )

    _create_step3a_tables()


def downgrade() -> None:
    bind = op.get_bind()

    _drop_step3a_tables()

    if bind.dialect.name == "postgresql":
        op.drop_index("users_primary_email_key", table_name="users")
        op.drop_index("users_handle_key", table_name="users")
        op.drop_constraint("users_primary_email_lower_check", "users", type_="check")
        for name in _URL_COLUMNS:
            op.drop_column("users", name)
        op.create_unique_constraint("users_primary_email_key", "users", ["primary_email"])
        op.create_unique_constraint("users_handle_key", "users", ["handle"])
    else:
        with op.batch_alter_table("users", copy_from=_users_copy_from(bind)) as batch:
            batch.drop_index("users_primary_email_key")
            batch.drop_index("users_handle_key")
            batch.drop_constraint("users_primary_email_lower_check", type_="check")
            _drop_url_columns(batch)
            batch.create_unique_constraint("users_primary_email_key", ["primary_email"])
            batch.create_unique_constraint("users_handle_key", ["handle"])


def _drop_url_columns(batch: BatchOperations) -> None:
    for name in _URL_COLUMNS:
        batch.drop_column(name)
