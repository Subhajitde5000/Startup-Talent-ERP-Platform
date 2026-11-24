"""Strict employer contracts. Never serialize the applicant ORM or raw snapshot directly."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import clean_text
from app.schemas.job_application import (
    AnswerSnapshot,
    ApplicationStage,
    ProfileSnapshot,
)

PipelineSort = Literal["newest", "oldest", "stage_changed"]
RejectionReason = Literal[
    "skills_mismatch", "experience", "role_filled", "compensation", "timing", "other"
]
ReviewStage = Literal["applied", "review", "shortlisted", "interview", "rejected"]


class PipelinePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: ReviewStage | None = None
    expected_stage: ApplicationStage | None = None
    assignee_id: uuid.UUID | None = None
    rejected_reason: RejectionReason | None = None
    rejection_detail: str | None = Field(default=None, max_length=1000)

    @field_validator("rejection_detail")
    @classmethod
    def trim_detail(cls, value: str | None) -> str | None:
        return clean_text(value, 1000)

    @model_validator(mode="after")
    def valid_change(self) -> Self:
        fields = self.model_fields_set
        if not fields & {"stage", "assignee_id"}:
            raise ValueError("Supply a stage or assignee change.")
        if "stage" in fields and (self.stage is None or self.expected_stage is None):
            raise ValueError("A stage change requires stage and expected_stage.")
        if "expected_stage" in fields and "stage" not in fields:
            raise ValueError("expected_stage is only accepted with a stage change.")
        if self.stage == "rejected":
            if self.rejected_reason is None:
                raise ValueError("Rejection requires a reason.")
            if self.rejected_reason == "other" and not self.rejection_detail:
                raise ValueError("Other requires a rejection detail.")
        elif fields & {"rejected_reason", "rejection_detail"}:
            raise ValueError("Rejection fields are only accepted when rejecting.")
        return self


class ReviewSettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    blind_review_enabled: bool = Field(strict=True)


class ReviewSettingsRead(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_id: uuid.UUID
    blind_review_enabled: bool
    locked: bool


class JobReviewContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: uuid.UUID
    title: str
    status: str
    archived: bool
    owner_id: uuid.UUID | None
    blind_review_enabled: bool
    review_settings_locked: bool


class ApplicantRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: JobReviewContext
    id: uuid.UUID
    job_id: uuid.UUID
    stage: ApplicationStage
    source: str
    is_blind: bool
    label: str
    assignee_id: uuid.UUID | None
    profile: ProfileSnapshot | None
    experience_years: str | None
    cover_note: str | None
    screening_answers: list[AnswerSnapshot]
    salary_expectation: Decimal | None
    currency: str
    resume_available: bool
    resume_file_name: str | None = None
    resume_content_type: str | None = None
    rejected_reason: str | None
    rejected_at: datetime | None
    stage_changed_at: datetime
    created_at: datetime
    updated_at: datetime


class ApplicantPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    context: JobReviewContext
    items: list[ApplicantRead]
    stage_counts: dict[ApplicationStage, int]
    total: int
    limit: int
    offset: int
    has_more: bool


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    body: str = Field(min_length=1, max_length=5000, strict=True)

    @field_validator("body")
    @classmethod
    def trim_body(cls, value: str) -> str:
        cleaned = clean_text(value, 5000)
        if cleaned is None:
            raise ValueError("Note must not be blank.")
        return cleaned


class NoteRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    application_id: uuid.UUID
    author_id: uuid.UUID | None
    body: str
    created_at: datetime
    updated_at: datetime


class NotePage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[NoteRead]
    total: int
    limit: int
    offset: int
    has_more: bool
