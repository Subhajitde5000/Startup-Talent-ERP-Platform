"""Step 9g: private room core and immutable versions (approved version-history gap).

Only this batch's tables; no seed data or schema.sql execution.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0033_step9g_data_rooms"
down_revision: str | None = "0032_step4_org_file_selections"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "data_rooms",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), server_default="Data room", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("nda_required", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("nda_file_id", sa.UUID(), nullable=True),
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
        sa.CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="data_room_name_valid"),
        sa.ForeignKeyConstraint(["nda_file_id"], ["files.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("data_rooms_org_key", "data_rooms", ["org_id"], unique=True)
    op.create_index(op.f("ix_data_rooms_nda_file_id"), "data_rooms", ["nda_file_id"], unique=False)
    op.create_table(
        "data_room_folders",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("data_room_id", sa.UUID(), nullable=False),
        sa.Column("parent_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "display_order BETWEEN 0 AND 32767", name="data_room_folder_order_valid"
        ),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 200", name="data_room_folder_name_valid"
        ),
        sa.CheckConstraint(
            "parent_id IS NULL OR parent_id <> id", name="data_room_folder_not_self"
        ),
        sa.ForeignKeyConstraint(["data_room_id"], ["data_rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["data_room_folders.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "data_room_folders_room_idx",
        "data_room_folders",
        ["data_room_id", "parent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_data_room_folders_parent_id"), "data_room_folders", ["parent_id"], unique=False
    )
    op.create_table(
        "data_room_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("folder_id", sa.UUID(), nullable=False),
        sa.Column("file_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("visibility", sa.String(length=24), server_default="private", nullable=False),
        sa.Column("version", sa.String(length=32), server_default="v1", nullable=False),
        sa.Column("version_number", sa.Integer(), server_default="1", nullable=False),
        sa.Column("view_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "visibility IN ('private','approved_investors','public')",
            name="data_room_doc_visibility_valid",
        ),
        sa.CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="data_room_doc_name_valid"),
        sa.CheckConstraint(
            "view_count >= 0 AND version_number > 0", name="data_room_doc_counts_valid"
        ),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["folder_id"], ["data_room_folders.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "data_room_docs_folder_idx",
        "data_room_documents",
        ["folder_id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "data_room_docs_updater_idx", "data_room_documents", ["updated_by"], unique=False
    )
    op.create_index(
        op.f("ix_data_room_documents_file_id"), "data_room_documents", ["file_id"], unique=False
    )
    op.create_table(
        "data_room_document_versions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("file_id", sa.UUID(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), nullable=True),
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
        sa.CheckConstraint("version_number > 0", name="data_room_version_positive"),
        sa.ForeignKeyConstraint(["document_id"], ["data_room_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id", "version_number", name="data_room_version_unique"),
    )
    op.create_index(
        op.f("ix_data_room_document_versions_file_id"),
        "data_room_document_versions",
        ["file_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_data_room_document_versions_uploaded_by"),
        "data_room_document_versions",
        ["uploaded_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_data_room_document_versions_uploaded_by"), table_name="data_room_document_versions"
    )
    op.drop_index(
        op.f("ix_data_room_document_versions_file_id"), table_name="data_room_document_versions"
    )
    op.drop_table("data_room_document_versions")
    op.drop_index(op.f("ix_data_room_documents_file_id"), table_name="data_room_documents")
    op.drop_index("data_room_docs_updater_idx", table_name="data_room_documents")
    op.drop_index(
        "data_room_docs_folder_idx",
        table_name="data_room_documents",
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_table("data_room_documents")
    op.drop_index(op.f("ix_data_room_folders_parent_id"), table_name="data_room_folders")
    op.drop_index("data_room_folders_room_idx", table_name="data_room_folders")
    op.drop_table("data_room_folders")
    op.drop_index(op.f("ix_data_rooms_nda_file_id"), table_name="data_rooms")
    op.drop_index("data_rooms_org_key", table_name="data_rooms")
    op.drop_table("data_rooms")
