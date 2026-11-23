"""Step 4: private files and retry-safe R2 upload lifecycle.

Only creates files; schema.sql is a reference, not executed.
Lifecycle, thumbnail, lease and purge columns are documented in backend/README.md.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0031_step4_files"
down_revision = "0030_step9k_diligence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "files",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("owner_org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("upload_storage_key", sa.String(512), nullable=True),
        sa.Column("thumbnail_storage_key", sa.String(512), nullable=True),
        sa.Column("mime_type", sa.String(127), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("checksum_sha256", sa.String(64), nullable=True),
        sa.Column("scan_status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("upload_status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("upload_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_token", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("processing_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("purged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_org_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "checksum_sha256 IS NULL OR length(checksum_sha256) = 64", name="file_checksum_valid"
        ),
        sa.CheckConstraint(
            "kind IN ('pitch_deck','financial_model','legal','resume','logo','document','image','other')",
            name="file_kind_valid",
        ),
        sa.CheckConstraint(
            "(processing_token IS NULL AND processing_expires_at IS NULL) OR (processing_token IS NOT NULL AND processing_expires_at IS NOT NULL)",
            name="file_lease_valid",
        ),
        sa.CheckConstraint(
            "length(file_name) BETWEEN 1 AND 255 AND length(mime_type) BETWEEN 1 AND 127 AND length(storage_key) BETWEEN 1 AND 512",
            name="file_metadata_valid",
        ),
        sa.CheckConstraint(
            "upload_status != 'ready' OR (scan_status = 'clean' AND scanned_at IS NOT NULL AND confirmed_at IS NOT NULL AND checksum_sha256 IS NOT NULL)",
            name="file_ready_valid",
        ),
        sa.CheckConstraint(
            "scan_status IN ('pending','clean','infected','failed')", name="file_scan_status_valid"
        ),
        sa.CheckConstraint("byte_size > 0 AND byte_size <= 26214400", name="file_size_valid"),
        sa.CheckConstraint(
            "upload_status IN ('pending','uploaded','ready','rejected','expired')",
            name="file_upload_status_valid",
        ),
    )
    op.create_index("files_cleanup_idx", "files", ["purged_at", "deleted_at"], unique=False)
    op.create_index(
        "files_owner_org_idx",
        "files",
        ["owner_org_id", "kind"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index("files_storage_key_key", "files", ["storage_key"], unique=True)
    op.create_index("files_uploaded_by_idx", "files", ["uploaded_by", "created_at"], unique=False)
    op.create_index("files_work_idx", "files", ["upload_status", "upload_expires_at"], unique=False)


def downgrade() -> None:
    op.drop_table("files")
