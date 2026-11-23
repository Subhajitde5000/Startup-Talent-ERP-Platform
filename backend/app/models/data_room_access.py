"""Step 9h: per-user grants, pinned NDA evidence and append-only retrieval audit."""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DataRoomAccessRequest(Base):
    __tablename__ = "data_room_access_requests"
    __mapper_args__ = {"eager_defaults": True}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("data_rooms.id", ondelete="CASCADE"))
    requester_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    requester_org: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), index=True
    )
    scope: Mapped[list[str]] = mapped_column(JSON, default=list)
    message: Mapped[str | None] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
    nda_required: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    nda_file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("files.id", ondelete="RESTRICT"), index=True
    )
    nda_checksum: Mapped[str | None] = mapped_column(String(64))
    nda_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    nda_legal_name: Mapped[str | None] = mapped_column(String(160))
    nda_agreed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    purpose_agreed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','approved','denied','expired','revoked')",
            name="data_room_request_status_valid",
        ),
        CheckConstraint(
            "status <> 'approved' OR (expires_at IS NOT NULL AND decided_at IS NOT NULL)",
            name="data_room_approval_valid",
        ),
        CheckConstraint(
            "status <> 'approved' OR NOT nda_required OR (nda_file_id IS NOT NULL AND nda_checksum IS NOT NULL)",
            name="data_room_approved_nda_valid",
        ),
        CheckConstraint(
            "nda_signed_at IS NULL OR (nda_file_id IS NOT NULL AND nda_checksum IS NOT NULL AND nda_legal_name IS NOT NULL AND nda_agreed AND purpose_agreed)",
            name="data_room_nda_evidence_valid",
        ),
        Index("dradr_status_idx", "data_room_id", "status", "expires_at"),
        Index("dradr_requester_idx", "requester_id", "created_at"),
        Index(
            "dradr_unique_open",
            "data_room_id",
            "requester_id",
            unique=True,
            postgresql_where=text("status IN ('pending','approved')"),
            sqlite_where=text("status IN ('pending','approved')"),
        ),
    )


class DocumentView(Base):
    __tablename__ = "document_views"
    __mapper_args__ = {"eager_defaults": True}
    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), Identity(always=True), primary_key=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("data_room_documents.id", ondelete="CASCADE")
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("data_room_document_versions.id", ondelete="RESTRICT"), index=True
    )
    viewer_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    ip: Mapped[str | None] = mapped_column(String(45).with_variant(INET(), "postgresql"))
    user_agent: Mapped[str | None] = mapped_column(Text)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (Index("document_views_doc_idx", "document_id", "viewed_at"),)
