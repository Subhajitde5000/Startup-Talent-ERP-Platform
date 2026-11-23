"""Strict, bounded Step 9g contracts. Ownership, counters and versions are server-owned."""

import uuid
from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("*", mode="before")
    @classmethod
    def reject_null(cls, value: object, info: ValidationInfo) -> object:
        if value is None and info.field_name not in {"parent_id", "nda_file_id"}:
            raise ValueError("must not be null")
        return value


class RoomPut(Input):
    name: str = Field(default="Data room", min_length=1, max_length=200)
    is_active: bool = Field(default=True, strict=True)
    nda_required: bool = Field(default=True, strict=True)
    nda_file_id: uuid.UUID | None = None


class FolderCreate(Input):
    name: str = Field(min_length=1, max_length=200)
    parent_id: uuid.UUID | None = None
    display_order: int = Field(default=0, ge=0, le=32767, strict=True)


class FolderUpdate(Input):
    name: str = Field(default="", min_length=1, max_length=200)
    parent_id: uuid.UUID | None = None
    display_order: int = Field(default=0, ge=0, le=32767, strict=True)


class DocumentCreate(Input):
    folder_id: uuid.UUID
    file_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    visibility: Literal["private", "approved_investors"] = "private"


class DocumentUpdate(Input):
    name: str = Field(default="", min_length=1, max_length=200)
    folder_id: uuid.UUID | None = None
    visibility: Literal["private", "approved_investors"] = "private"


class VersionCreate(Input):
    file_id: uuid.UUID


class Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class RoomRead(Read):
    org_id: uuid.UUID
    name: str
    is_active: bool
    nda_required: bool
    nda_file_id: uuid.UUID | None


class FolderRead(Read):
    data_room_id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    display_order: int


class DocumentRead(Read):
    folder_id: uuid.UUID
    file_id: uuid.UUID
    name: str
    visibility: str
    version: str
    version_number: int
    view_count: int
    updated_by: uuid.UUID | None


class VersionRead(Read):
    document_id: uuid.UUID
    file_id: uuid.UUID
    version_number: int
    uploaded_by: uuid.UUID | None


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
