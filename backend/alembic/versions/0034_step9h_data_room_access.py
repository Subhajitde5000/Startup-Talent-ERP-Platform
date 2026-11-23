"""Step 9h: personal folder-scoped access, pinned NDA evidence and retrieval audit.

Only this batch's tables; no seed data or schema.sql execution.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0034_step9h_data_room_access"
down_revision: str | None = "0033_step9g_data_rooms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "data_room_access_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("data_room_id", sa.UUID(), nullable=False),
        sa.Column("requester_id", sa.UUID(), nullable=False),
        sa.Column("requester_org", sa.UUID(), nullable=True),
        sa.Column("scope", sa.JSON(), nullable=False),
        sa.Column("message", sa.String(length=2000), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("nda_required", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("nda_file_id", sa.UUID(), nullable=True),
        sa.Column("nda_checksum", sa.String(length=64), nullable=True),
        sa.Column("nda_signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("nda_legal_name", sa.String(length=160), nullable=True),
        sa.Column("nda_agreed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("purpose_agreed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("decided_by", sa.UUID(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
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
            "status <> 'approved' OR (expires_at IS NOT NULL AND decided_at IS NOT NULL)",
            name="data_room_approval_valid",
        ),
        sa.CheckConstraint(
            "status IN ('pending','approved','denied','expired','revoked')",
            name="data_room_request_status_valid",
        ),
        sa.CheckConstraint(
            "status <> 'approved' OR NOT nda_required OR (nda_file_id IS NOT NULL AND nda_checksum IS NOT NULL)",
            name="data_room_approved_nda_valid",
        ),
        sa.CheckConstraint(
            "nda_signed_at IS NULL OR (nda_file_id IS NOT NULL AND nda_checksum IS NOT NULL AND nda_legal_name IS NOT NULL AND nda_agreed AND purpose_agreed)",
            name="data_room_nda_evidence_valid",
        ),
        sa.ForeignKeyConstraint(["data_room_id"], ["data_rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["nda_file_id"], ["files.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_org"], ["organizations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "dradr_requester_idx",
        "data_room_access_requests",
        ["requester_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "dradr_status_idx",
        "data_room_access_requests",
        ["data_room_id", "status", "expires_at"],
        unique=False,
    )
    op.create_index(
        "dradr_unique_open",
        "data_room_access_requests",
        ["data_room_id", "requester_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending','approved')"),
        sqlite_where=sa.text("status IN ('pending','approved')"),
    )
    op.create_index(
        op.f("ix_data_room_access_requests_decided_by"),
        "data_room_access_requests",
        ["decided_by"],
        unique=False,
    )
    op.create_index(
        op.f("ix_data_room_access_requests_nda_file_id"),
        "data_room_access_requests",
        ["nda_file_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_data_room_access_requests_requester_org"),
        "data_room_access_requests",
        ["requester_org"],
        unique=False,
    )
    op.create_table(
        "document_views",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            sa.Identity(always=True),
            nullable=False,
        ),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("version_id", sa.UUID(), nullable=False),
        sa.Column("viewer_id", sa.UUID(), nullable=True),
        sa.Column(
            "ip", sa.String(length=45).with_variant(postgresql.INET(), "postgresql"), nullable=True
        ),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "viewed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["document_id"], ["data_room_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["version_id"], ["data_room_document_versions.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["viewer_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "document_views_doc_idx", "document_views", ["document_id", "viewed_at"], unique=False
    )
    op.create_index(
        op.f("ix_document_views_version_id"), "document_views", ["version_id"], unique=False
    )
    op.create_index(
        op.f("ix_document_views_viewer_id"), "document_views", ["viewer_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_document_views_viewer_id"), table_name="document_views")
    op.drop_index(op.f("ix_document_views_version_id"), table_name="document_views")
    op.drop_index("document_views_doc_idx", table_name="document_views")
    op.drop_table("document_views")
    op.drop_index(
        op.f("ix_data_room_access_requests_requester_org"), table_name="data_room_access_requests"
    )
    op.drop_index(
        op.f("ix_data_room_access_requests_nda_file_id"), table_name="data_room_access_requests"
    )
    op.drop_index(
        op.f("ix_data_room_access_requests_decided_by"), table_name="data_room_access_requests"
    )
    op.drop_index(
        "dradr_unique_open",
        table_name="data_room_access_requests",
        postgresql_where=sa.text("status IN ('pending','approved')"),
        sqlite_where=sa.text("status IN ('pending','approved')"),
    )
    op.drop_index("dradr_status_idx", table_name="data_room_access_requests")
    op.drop_index("dradr_requester_idx", table_name="data_room_access_requests")
    op.drop_table("data_room_access_requests")
