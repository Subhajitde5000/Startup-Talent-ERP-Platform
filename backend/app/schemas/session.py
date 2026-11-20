"""Step 8d schemas: mentoring sessions.

Server-controlled fields, absent from every write schema:

- ``status`` — moved by the transition endpoints only.
- ``mentorship_id`` — from the path, membership-checked.
- ``completed_at`` — stamped by ``complete``.
- ``cancelled_reason`` — written by ``cancel`` alone.
- ``created_at`` / ``updated_at``.

``scheduled_at`` must be timezone-aware. A naive datetime is rejected
rather than assumed to be UTC: guessing a zone silently books the wrong
hour for someone, and the client always knows which zone it meant.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.session import AttendeeRole, SessionStatus

TOPIC_MAX = 200
SUMMARY_MAX = 2000
ACTION_ITEM_MAX = 200
ACTION_ITEMS_MAX = 20
MEETING_URL_MAX = 500
CURRENCY_PATTERN = r"^[A-Z]{3}$"


class SessionAttendeeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The client names a user; the service decides the role from the
    # mentorship, so ``role`` is deliberately not part of the payload.
    user_id: uuid.UUID


class SessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    scheduled_at: datetime
    duration_min: int = Field(default=45, ge=5, le=480)
    topic: str | None = Field(default=None, max_length=TOPIC_MAX)
    session_type: str | None = Field(default=None, max_length=32)
    meeting_url: str | None = Field(default=None, max_length=MEETING_URL_MAX)
    fee_amount: Decimal | None = Field(default=None, ge=0, le=Decimal("999999999999.99"))
    currency: str = Field(default="INR", pattern=CURRENCY_PATTERN)
    attendees: list[SessionAttendeeIn] = Field(default_factory=list, max_length=10)

    @field_validator("scheduled_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
            msg = "scheduled_at must include a timezone offset."
            raise ValueError(msg)
        return v.astimezone(UTC)

    @field_validator("meeting_url")
    @classmethod
    def _https_only(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        candidate = v.strip()
        if not candidate.startswith("https://"):
            msg = "meeting_url must be an https:// link."
            raise ValueError(msg)
        return candidate


class SessionReschedule(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    scheduled_at: datetime
    duration_min: int | None = Field(default=None, ge=5, le=480)
    reason: str | None = Field(default=None, max_length=SUMMARY_MAX)

    @field_validator("scheduled_at")
    @classmethod
    def _aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
            msg = "scheduled_at must include a timezone offset."
            raise ValueError(msg)
        return v.astimezone(UTC)


class SessionCancel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    reason: str = Field(min_length=3, max_length=SUMMARY_MAX)


class SessionComplete(BaseModel):
    """The mentor closes a session with what was covered and what is next."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    summary: str = Field(min_length=10, max_length=SUMMARY_MAX)
    action_items: list[str] = Field(default_factory=list, max_length=ACTION_ITEMS_MAX)

    @field_validator("action_items")
    @classmethod
    def _clean(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for raw in v:
            item = raw.strip()
            if not item:
                continue
            if len(item) > ACTION_ITEM_MAX:
                msg = f"Each action item must be {ACTION_ITEM_MAX} characters or fewer."
                raise ValueError(msg)
            if item.lower() in seen:
                continue
            seen.add(item.lower())
            out.append(item)
        return out


class SessionNoShow(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    note: str | None = Field(default=None, max_length=SUMMARY_MAX)


class SessionAttendeeRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    display_name: str
    role: AttendeeRole


class SessionRead(BaseModel):
    """One session. ``viewer_side`` tells the UI which actions to offer."""

    id: uuid.UUID
    mentorship_id: uuid.UUID
    status: SessionStatus
    topic: str | None
    session_type: str | None
    scheduled_at: datetime
    duration_min: int
    meeting_url: str | None
    summary: str | None
    action_items: list[str]
    fee_amount: Decimal | None
    currency: str
    completed_at: datetime | None
    cancelled_reason: str | None
    created_at: datetime
    updated_at: datetime
    attendees: list[SessionAttendeeRead]
    viewer_side: Literal["mentor", "startup"]
    # True when the session is close enough to start that a join link is
    # useful. Computed server-side so the client never guesses.
    can_join: bool = False


class SessionPage(BaseModel):
    items: list[SessionRead]
    total: int
    limit: int
    offset: int


__all__ = [
    "SessionAttendeeIn",
    "SessionAttendeeRead",
    "SessionCancel",
    "SessionComplete",
    "SessionCreate",
    "SessionNoShow",
    "SessionPage",
    "SessionRead",
    "SessionReschedule",
]
