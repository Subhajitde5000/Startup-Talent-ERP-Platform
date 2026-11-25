"""Step 7f schemas: interviews, participants and feedback.

Strict Create / Update / Read split (AGENTS.md sections 4-5). Server-owned
fields are ABSENT from every input schema, so ``extra="forbid"`` turns an
attempt to set them into a 422 — ``id``, ``application_id``, ``status``
(action endpoints only), ``created_by``, ``cancelled_reason`` (cancel
only), participant ``side``/``user_id``/``responded_at`` (derived or
stamped by the service), ``feedback.id``/``interview_id``/``author_id``/
``submitted_at`` and all timestamps.

``scheduled_at`` must be timezone-aware (same rule as 8d): a naive
datetime is rejected rather than assumed, because guessing a zone books
the wrong hour.
"""

import uuid
from datetime import UTC, datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import clean_text

InterviewFormat = Literal["video", "phone", "onsite", "async"]
InterviewStatus = Literal[
    "scheduled", "confirmed", "completed", "cancelled", "no_show", "rescheduled"
]
ParticipantSide = Literal["interviewer", "candidate", "observer"]
ParticipantResponse = Literal["accepted", "declined", "tentative"]
Recommendation = Literal["strong_yes", "yes", "no", "strong_no"]

ROUND_MAX = 100
LOCATION_MAX = 500
MEETING_URL_MAX = 500
CANCEL_REASON_MAX = 500
SUMMARY_MAX = 5000
MAX_INTERVIEWERS = 10


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise ValueError("scheduled_at must include a timezone offset.")
    return value.astimezone(UTC)


def _https_only(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    candidate = value.strip()
    if not candidate.startswith("https://"):
        raise ValueError("meeting_url must be an https:// link.")
    return candidate


class InterviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    round_name: str | None = Field(default=None, max_length=ROUND_MAX)
    format: InterviewFormat = "video"
    scheduled_at: datetime
    duration_min: int = Field(default=45, ge=5, le=480)
    location: str | None = Field(default=None, max_length=LOCATION_MAX)
    meeting_url: str | None = Field(default=None, max_length=MEETING_URL_MAX)
    interviewer_ids: list[uuid.UUID] = Field(min_length=1, max_length=MAX_INTERVIEWERS)

    @field_validator("scheduled_at")
    @classmethod
    def _tz(cls, value: datetime) -> datetime:
        return _aware(value)

    @field_validator("round_name", "location")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        # Field-level max_length already capped each value; blank -> None.
        return clean_text(value, LOCATION_MAX)

    @field_validator("meeting_url")
    @classmethod
    def _url(cls, value: str | None) -> str | None:
        return _https_only(value)

    @field_validator("interviewer_ids")
    @classmethod
    def _unique(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("interviewer_ids must be unique.")
        return value


class InterviewUpdate(BaseModel):
    """Reschedule/edit. Only scheduled or confirmed interviews accept it."""

    model_config = ConfigDict(extra="forbid")

    scheduled_at: datetime | None = None
    duration_min: int | None = Field(default=None, ge=5, le=480)
    round_name: str | None = Field(default=None, max_length=ROUND_MAX)
    format: InterviewFormat | None = None
    location: str | None = Field(default=None, max_length=LOCATION_MAX)
    meeting_url: str | None = Field(default=None, max_length=MEETING_URL_MAX)

    @field_validator("scheduled_at")
    @classmethod
    def _tz(cls, value: datetime | None) -> datetime | None:
        return _aware(value) if value is not None else None

    @field_validator("round_name", "location")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return clean_text(value, LOCATION_MAX) if value is not None else None

    @field_validator("meeting_url")
    @classmethod
    def _url(cls, value: str | None) -> str | None:
        return _https_only(value)

    @model_validator(mode="after")
    def meaningful_change(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Supply at least one field to change.")
        if "scheduled_at" in self.model_fields_set and self.scheduled_at is None:
            raise ValueError("scheduled_at must not be null.")
        if "duration_min" in self.model_fields_set and self.duration_min is None:
            raise ValueError("duration_min must not be null.")
        if "format" in self.model_fields_set and self.format is None:
            raise ValueError("format must not be null.")
        return self


class InterviewCancel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str | None = Field(default=None, max_length=CANCEL_REASON_MAX)

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, value: str | None) -> str | None:
        return clean_text(value, CANCEL_REASON_MAX)


class RespondPut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    response: ParticipantResponse


class FeedbackPut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommendation: Recommendation
    summary: str = Field(min_length=1, max_length=SUMMARY_MAX)

    @field_validator("summary")
    @classmethod
    def trim_summary(cls, value: str) -> str:
        cleaned = clean_text(value, SUMMARY_MAX)
        if cleaned is None:
            raise ValueError("Summary must not be blank.")
        return cleaned


class ParticipantRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    side: ParticipantSide
    display_name: str
    response: ParticipantResponse | None
    responded_at: datetime | None


class FeedbackRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    interview_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str
    recommendation: Recommendation | None
    summary: str | None
    submitted_at: datetime
    updated_at: datetime


class InterviewRead(BaseModel):
    """Employer-side interview row (list and detail base)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    application_id: uuid.UUID
    job_id: uuid.UUID
    job_title: str
    candidate_label: str
    is_blind: bool
    round_name: str | None
    format: InterviewFormat
    status: InterviewStatus
    scheduled_at: datetime
    duration_min: int
    location: str | None
    meeting_url: str | None
    created_by: uuid.UUID | None
    cancelled_reason: str | None
    participants: list[ParticipantRead]
    needs_my_feedback: bool
    created_at: datetime
    updated_at: datetime


class InterviewDetailRead(InterviewRead):
    feedback: list[FeedbackRead]


class InterviewPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InterviewRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class CandidateInterviewRead(BaseModel):
    """Candidate-safe projection: never feedback, internal reason or ids
    they do not need."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    application_id: uuid.UUID
    job_id: uuid.UUID
    job_title: str
    company_name: str
    round_name: str | None
    format: InterviewFormat
    status: InterviewStatus
    scheduled_at: datetime
    duration_min: int
    location: str | None
    meeting_url: str | None
    participants: list[ParticipantRead]
    created_at: datetime
    updated_at: datetime


class CandidateInterviewPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CandidateInterviewRead]
    total: int
    limit: int
    offset: int
    has_more: bool
