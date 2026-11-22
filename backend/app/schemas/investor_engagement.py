"""Pydantic schemas for investor engagement (Step 9f: requests + meetings).

All write schemas set ``extra="forbid"`` so a client cannot smuggle
server-controlled fields (org ids, status, organizer, owner, timestamps).
Free-text fields are cleaned with :func:`clean_text`, which strips,
maps blank -> None and enforces the length bound.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import clean_text


# ---------------------------------------------------------------------------
# Engagement requests
# ---------------------------------------------------------------------------
class EngagementRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    startup_org_id: uuid.UUID
    kind: str = Field(pattern="^(intro|meeting|information)$")
    ask: str = Field(min_length=1, max_length=200)
    message: str | None = Field(default=None, max_length=2000)
    expires_in_days: int = Field(default=14, ge=1, le=30)
    deal_id: uuid.UUID | None = None

    @field_validator("kind")
    @classmethod
    def _kind_known(cls, value: str) -> str:
        if value not in ("intro", "meeting", "information"):
            raise ValueError("kind must be one of intro, meeting, information")
        return value

    @field_validator("message")
    @classmethod
    def _message_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 2000)

    @field_validator("ask")
    @classmethod
    def _ask_clean(cls, value: str) -> str:
        cleaned = clean_text(value, 200)
        if not cleaned:
            raise ValueError("ask cannot be blank")
        return cleaned


class EngagementRequestUpdate(BaseModel):
    """Only the investor owning the request may change these fields."""

    model_config = ConfigDict(extra="forbid")

    ask: str | None = Field(default=None, min_length=1, max_length=200)
    message: str | None = Field(default=None, max_length=2000)

    @field_validator("ask")
    @classmethod
    def _ask_clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = clean_text(value, 200)
        if not cleaned:
            raise ValueError("ask cannot be blank")
        return cleaned

    @field_validator("message")
    @classmethod
    def _message_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 2000)


class EngagementRequestRespond(BaseModel):
    """Startup-side response to a request (D2: accept | decline)."""

    model_config = ConfigDict(extra="forbid")

    decision: str = Field(pattern="^(accept|decline)$")
    response_note: str | None = Field(default=None, max_length=2000)
    decline_reason: str | None = Field(default=None, max_length=2000)

    @field_validator("decision")
    @classmethod
    def _decision_known(cls, value: str) -> str:
        if value not in ("accept", "decline"):
            raise ValueError("decision must be accept or decline")
        return value

    @field_validator("response_note", "decline_reason")
    @classmethod
    def _text_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 2000)


class EngagementRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    investor_org_id: uuid.UUID
    startup_org_id: uuid.UUID
    # Counterparty snapshot (joined server-side so the investor's request
    # list renders the startup name without a second request).
    startup_name: str
    startup_slug: str
    deal_id: uuid.UUID | None
    kind: str
    ask: str
    message: str | None
    status: str
    response_note: str | None
    decline_reason: str | None
    expires_on: datetime | None
    owner_id: uuid.UUID | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class EngagementRequestPage(BaseModel):
    items: list[EngagementRequestRead]
    total: int
    limit: int
    offset: int


class EngagementRequestStartupRead(BaseModel):
    """Startup-side view: no investor-private decline_reason."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    investor_org_id: uuid.UUID
    startup_org_id: uuid.UUID
    # Counterparty snapshot: the investor firm that sent the request.
    investor_name: str
    investor_slug: str
    deal_id: uuid.UUID | None
    kind: str
    ask: str
    message: str | None
    status: str
    response_note: str | None
    expires_on: datetime | None
    created_at: datetime
    updated_at: datetime


class EngagementRequestStartupPage(BaseModel):
    items: list[EngagementRequestStartupRead]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Meetings
# ---------------------------------------------------------------------------
class MeetingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    startup_org_id: uuid.UUID
    meeting_type: str = Field(
        pattern="^(intro_call|pitch|diligence|follow_up|other)$"
    )
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=15, le=480)
    agenda: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=200)
    request_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None

    @field_validator("meeting_type")
    @classmethod
    def _type_known(cls, value: str) -> str:
        if value not in ("intro_call", "pitch", "diligence", "follow_up", "other"):
            raise ValueError(
                "meeting_type must be intro_call, pitch, diligence, follow_up or other"
            )
        return value

    @field_validator("agenda")
    @classmethod
    def _agenda_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 2000)

    @field_validator("location")
    @classmethod
    def _location_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 200)


class MeetingUpdate(BaseModel):
    """Both sides may edit a proposed meeting. Startup-side edits are
    re-proposals (status returns to ``proposed`` — D5)."""

    model_config = ConfigDict(extra="forbid")

    meeting_type: str | None = Field(
        default=None, pattern="^(intro_call|pitch|diligence|follow_up|other)$"
    )
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)
    agenda: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=200)

    @field_validator("meeting_type")
    @classmethod
    def _type_known(cls, value: str | None) -> str | None:
        if value is not None and value not in (
            "intro_call",
            "pitch",
            "diligence",
            "follow_up",
            "other",
        ):
            raise ValueError(
                "meeting_type must be intro_call, pitch, diligence, follow_up or other"
            )
        return value

    @field_validator("agenda")
    @classmethod
    def _agenda_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 2000)

    @field_validator("location")
    @classmethod
    def _location_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 200)


class MeetingStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^(proposed|confirmed|cancelled|completed)$")

    @field_validator("status")
    @classmethod
    def _status_known(cls, value: str) -> str:
        if value not in ("proposed", "confirmed", "cancelled", "completed"):
            raise ValueError(
                "status must be proposed, confirmed, cancelled or completed"
            )
        return value


class MeetingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    investor_org_id: uuid.UUID
    startup_org_id: uuid.UUID
    # Counterparty snapshots (joined server-side): the investor side renders
    # startup_name, the startup side renders investor_name.
    startup_name: str
    startup_slug: str
    investor_name: str
    investor_slug: str
    request_id: uuid.UUID | None
    deal_id: uuid.UUID | None
    meeting_type: str
    scheduled_at: datetime
    duration_minutes: int
    agenda: str | None
    status: str
    location: str | None
    organizer_org_id: uuid.UUID
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class MeetingPage(BaseModel):
    items: list[MeetingRead]
    total: int
    limit: int
    offset: int


__all__ = [
    "EngagementRequestCreate",
    "EngagementRequestPage",
    "EngagementRequestRead",
    "EngagementRequestRespond",
    "EngagementRequestStartupPage",
    "EngagementRequestStartupRead",
    "EngagementRequestUpdate",
    "MeetingCreate",
    "MeetingPage",
    "MeetingRead",
    "MeetingStatusUpdate",
    "MeetingUpdate",
]
