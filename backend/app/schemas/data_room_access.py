"""Strict Step 9h actions; no client-controlled identities, timestamps or audit."""

import uuid
from datetime import datetime
from ipaddress import IPv4Address, IPv6Address
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AccessCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    startup_org_id: uuid.UUID
    message: str | None = Field(default=None, max_length=2000)


class AccessDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["approve", "deny", "revoke"]
    scope: list[uuid.UUID] | None = Field(default=None, min_length=1, max_length=50)
    expires_at: datetime | None = None

    @model_validator(mode="after")
    def valid_action_fields(self) -> "AccessDecision":
        if self.action == "approve":
            if not self.scope or len(set(self.scope)) != len(self.scope):
                raise ValueError("approval requires 1–50 distinct folder IDs")
        elif {"scope", "expires_at"} & self.model_fields_set:
            raise ValueError("scope and expiry apply only to approval")
        if self.expires_at is not None and self.expires_at.tzinfo is None:
            raise ValueError("expires_at must include a timezone")
        return self


class NDAAcceptance(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nda_file_id: uuid.UUID
    nda_checksum: str = Field(pattern=r"^[0-9a-f]{64}$")
    legal_name: str = Field(min_length=1, max_length=160)
    agreed: bool = Field(strict=True)
    purpose_agreed: bool = Field(strict=True)

    @field_validator("agreed", "purpose_agreed")
    @classmethod
    def require_true(cls, value: bool) -> bool:
        if not value:
            raise ValueError("acknowledgment is required")
        return value


class AccessRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    data_room_id: uuid.UUID
    startup_org_id: uuid.UUID | None = None
    startup_name: str | None = None
    requester_name: str | None = None
    requester_org_name: str | None = None
    requester_id: uuid.UUID
    requester_org: uuid.UUID | None
    scope: list[str]
    message: str | None
    status: str
    nda_required: bool
    nda_file_id: uuid.UUID | None
    nda_checksum: str | None
    nda_signed_at: datetime | None
    nda_legal_name: str | None
    nda_agreed: bool
    purpose_agreed: bool
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


class InvestorRoomRead(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    access_request_id: uuid.UUID
    expires_at: datetime


class InvestorFolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    # Parent IDs are deliberately omitted: parent may lie outside the approved scope.
    name: str
    display_order: int


class InvestorDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    folder_id: uuid.UUID
    name: str
    version: str
    # No raw file IDs, updater identities or aggregate viewer counts.
    updated_at: datetime


class ViewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    document_id: uuid.UUID
    document_name: str | None = None
    viewer_name: str | None = None
    version_id: uuid.UUID
    viewer_id: uuid.UUID | None
    ip: str | None
    user_agent: str | None
    viewed_at: datetime
    created_at: datetime

    @field_validator("ip", mode="before")
    @classmethod
    def normalize_ip(cls, value: str | IPv4Address | IPv6Address | None) -> str | None:
        # asyncpg returns address objects for PostgreSQL INET; SQLite returns strings.
        return str(value) if value is not None else None
