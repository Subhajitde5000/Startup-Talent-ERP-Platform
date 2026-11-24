"""Strict file inputs. Ownership, storage locations and scan results are server-only."""

import uuid
from datetime import datetime
from pathlib import PurePosixPath
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.file import FileKind, ScanStatus, UploadStatus

# Extension/MIME pairs, not independent allowlists.
FORMATS = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
}
KIND_EXTENSIONS = {
    "logo": {".png", ".jpg", ".jpeg", ".webp"},
    "image": {".png", ".jpg", ".jpeg", ".webp"},
    "resume": {".pdf", ".docx"},
    "pitch_deck": {".pdf", ".pptx"},
    "financial_model": {".pdf", ".xlsx", ".csv"},
    "legal": {".pdf", ".docx"},
    "document": {".pdf", ".docx", ".txt"},
    "other": {".pdf", ".docx", ".txt"},
}


def max_bytes(kind: str) -> int:
    return (5 if kind in {"image", "logo"} else 10 if kind == "resume" else 25) * 1024 * 1024


class FileUploadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: FileKind
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=1, max_length=127)
    byte_size: int = Field(strict=True, gt=0, le=25 * 1024 * 1024)

    @field_validator("file_name")
    @classmethod
    def safe_filename(cls, value: str) -> str:
        if (
            value != value.strip()
            or any(c in value for c in ("/", "\\"))
            or any(ord(c) < 32 or ord(c) == 127 for c in value)
        ):
            raise ValueError("must be a plain filename without paths or control characters")
        return value

    @model_validator(mode="after")
    def validate_format(self) -> "FileUploadCreate":
        ext = PurePosixPath(self.file_name).suffix.lower()
        if ext not in KIND_EXTENSIONS[self.kind] or FORMATS.get(ext) != self.mime_type:
            raise ValueError("unsupported extension/MIME pair for this kind")
        if self.byte_size > max_bytes(self.kind):
            raise ValueError("file exceeds the size limit for this kind")
        return self


class FileRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    owner_org_id: uuid.UUID | None
    uploaded_by: uuid.UUID | None
    kind: FileKind
    file_name: str
    mime_type: str
    byte_size: int
    checksum_sha256: str | None
    scan_status: ScanStatus
    upload_status: UploadStatus
    scanned_at: datetime | None
    upload_expires_at: datetime
    confirmed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class FilePage(BaseModel):
    items: list[FileRead]
    total: int
    limit: int
    offset: int


class FileUploadRead(BaseModel):
    file: FileRead
    upload_url: str
    method: Literal["PUT"] = "PUT"
    headers: dict[str, str]
    expires_in: int


class FileConfirmCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FileDownloadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    variant: Literal["original", "thumbnail"] = "original"


class FileDownloadRead(BaseModel):
    url: str
    expires_in: int
    file_name: str | None = None
    mime_type: str | None = None
