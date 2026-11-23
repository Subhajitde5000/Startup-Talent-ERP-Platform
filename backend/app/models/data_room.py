"""Step 9g: stable documents and immutable file versions in private data rooms."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DataRoom(Base):
    __tablename__ = "data_rooms"
    __mapper_args__ = {"eager_defaults": True}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200), default="Data room", server_default="Data room")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    nda_required: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    nda_file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("files.id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="data_room_name_valid"),
        Index("data_rooms_org_key", "org_id", unique=True),
    )


class DataRoomFolder(Base):
    __tablename__ = "data_room_folders"
    __mapper_args__ = {"eager_defaults": True}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("data_rooms.id", ondelete="CASCADE"))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("data_room_folders.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    display_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="data_room_folder_name_valid"),
        CheckConstraint("display_order BETWEEN 0 AND 32767", name="data_room_folder_order_valid"),
        CheckConstraint("parent_id IS NULL OR parent_id <> id", name="data_room_folder_not_self"),
        Index("data_room_folders_room_idx", "data_room_id", "parent_id"),
    )


class DataRoomDocument(Base):
    __tablename__ = "data_room_documents"
    __mapper_args__ = {"eager_defaults": True}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    folder_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("data_room_folders.id", ondelete="RESTRICT")
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("files.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    visibility: Mapped[str] = mapped_column(String(24), default="private", server_default="private")
    version: Mapped[str] = mapped_column(String(32), default="v1", server_default="v1")
    version_number: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    view_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('private','approved_investors','public')",
            name="data_room_doc_visibility_valid",
        ),
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="data_room_doc_name_valid"),
        CheckConstraint(
            "view_count >= 0 AND version_number > 0", name="data_room_doc_counts_valid"
        ),
        Index(
            "data_room_docs_folder_idx",
            "folder_id",
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("data_room_docs_updater_idx", "updated_by"),
    )


class DataRoomDocumentVersion(Base):
    __tablename__ = "data_room_document_versions"
    __mapper_args__ = {"eager_defaults": True}
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("data_room_documents.id", ondelete="CASCADE")
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("files.id", ondelete="RESTRICT"), index=True
    )
    version_number: Mapped[int] = mapped_column(Integer)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint("document_id", "version_number", name="data_room_version_unique"),
        CheckConstraint("version_number > 0", name="data_room_version_positive"),
    )
