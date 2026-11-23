"""Step 4 private file metadata; object bytes live only in Cloudflare R2.

Extra lifecycle/lease/purge columns make confirmation, background retries and
physical cleanup crash-safe. Personal ownership also requires a personal key
namespace: an ON DELETE SET NULL org FK must never transfer ownership.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FileKind(enum.StrEnum):
    pitch_deck = "pitch_deck"
    financial_model = "financial_model"
    legal = "legal"
    resume = "resume"
    logo = "logo"
    document = "document"
    image = "image"
    other = "other"


class ScanStatus(enum.StrEnum):
    pending = "pending"
    clean = "clean"
    infected = "infected"
    failed = "failed"


class UploadStatus(enum.StrEnum):
    pending = "pending"
    uploaded = "uploaded"
    ready = "ready"
    rejected = "rejected"
    expired = "expired"


class File(Base):
    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_org_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(24))
    file_name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(512))
    upload_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    thumbnail_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(127))
    byte_size: Mapped[int] = mapped_column(BigInteger)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scan_status: Mapped[str] = mapped_column(
        String(16), default="pending", server_default="pending"
    )
    upload_status: Mapped[str] = mapped_column(
        String(16), default="pending", server_default="pending"
    )
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    upload_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processing_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    processing_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "kind IN ('pitch_deck','financial_model','legal','resume','logo','document','image','other')",
            name="file_kind_valid",
        ),
        CheckConstraint(
            "scan_status IN ('pending','clean','infected','failed')", name="file_scan_status_valid"
        ),
        CheckConstraint(
            "upload_status IN ('pending','uploaded','ready','rejected','expired')",
            name="file_upload_status_valid",
        ),
        CheckConstraint("byte_size > 0 AND byte_size <= 26214400", name="file_size_valid"),
        CheckConstraint(
            "length(file_name) BETWEEN 1 AND 255 AND length(mime_type) BETWEEN 1 AND 127 AND length(storage_key) BETWEEN 1 AND 512",
            name="file_metadata_valid",
        ),
        CheckConstraint(
            "checksum_sha256 IS NULL OR length(checksum_sha256) = 64", name="file_checksum_valid"
        ),
        CheckConstraint(
            "upload_status != 'ready' OR (scan_status = 'clean' AND scanned_at IS NOT NULL AND confirmed_at IS NOT NULL AND checksum_sha256 IS NOT NULL)",
            name="file_ready_valid",
        ),
        CheckConstraint(
            "(processing_token IS NULL AND processing_expires_at IS NULL) OR (processing_token IS NOT NULL AND processing_expires_at IS NOT NULL)",
            name="file_lease_valid",
        ),
        Index("files_storage_key_key", "storage_key", unique=True),
        Index(
            "files_owner_org_idx",
            "owner_org_id",
            "kind",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("files_uploaded_by_idx", "uploaded_by", "created_at"),
        Index("files_work_idx", "upload_status", "upload_expires_at"),
        Index("files_cleanup_idx", "purged_at", "deleted_at"),
    )
