"""Step 7h document requests and explicit review records. No demo data.

Downgrade removes only document-request metadata, never Step 4 file objects.
"""

import sqlalchemy as sa

from alembic import op

revision = "0044_step7h_documents"
down_revision = "0043_step7h_onboarding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hire_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("hire_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("purpose", sa.String(length=1000), nullable=False),
        sa.Column("retention", sa.String(length=1000), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column("requested_by", sa.UUID(), nullable=True),
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_reason", sa.String(length=1000), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('requested','received','verified','rejected','expired') AND version > 0",
            name="hire_documents_status_check",
        ),
        sa.CheckConstraint(
            "status NOT IN ('received','verified','rejected') OR file_id IS NOT NULL",
            name="hire_documents_file_check",
        ),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["hire_id"], ["hires.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "hire_documents_retry_key", "hire_documents", ["hire_id", "request_id"], unique=True
    )
    op.create_index(op.f("ix_hire_documents_file_id"), "hire_documents", ["file_id"], unique=False)
    op.create_index(op.f("ix_hire_documents_hire_id"), "hire_documents", ["hire_id"], unique=False)


def downgrade() -> None:
    op.drop_table("hire_documents")
