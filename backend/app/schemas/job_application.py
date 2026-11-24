"""Self-service application contracts; employer-internal fields are never exposed."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.job import Money, _JobValidation
from app.schemas.job_screening import ScreeningKey, ScreeningQuestionRead

ApplicationStage = Literal[
    "applied", "review", "shortlisted", "interview", "offered", "hired", "rejected", "withdrawn"
]


class ApplicationContact(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32)
    linkedin_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)
    github_url: str | None = Field(default=None, max_length=500)

    @field_validator("name", "phone")
    @classmethod
    def trim(cls, value):
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("Must not be blank.")
        return value

    @field_validator("linkedin_url", "portfolio_url", "github_url")
    @classmethod
    def safe_links(cls, value):
        if value is not None:
            from urllib.parse import urlsplit

            parsed = urlsplit(value)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
            ):
                raise ValueError("Use an HTTPS URL without embedded credentials.")
        return value


class ScreeningAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: ScreeningKey
    value: Annotated[str, Field(strict=True, max_length=1000)] | Annotated[bool, Field(strict=True)]


class ApplicationCreate(_JobValidation):
    contact: ApplicationContact | None = None
    resume_file_id: uuid.UUID | None = None
    cover_note: str | None = Field(default=None, max_length=1000)
    salary_expectation: Money | None = None
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    screening_answers: list[ScreeningAnswer] = Field(default_factory=list, max_length=8)
    accuracy_confirmed: bool = Field(strict=True)
    consent_share: bool = Field(strict=True)

    @field_validator("salary_expectation", mode="before")
    @classmethod
    def exact_money(cls, value):
        if isinstance(value, (float, bool)):
            raise ValueError("Use a decimal string or integer.")
        return value


class ProfileSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contact: ApplicationContact
    headline: str | None
    summary: str | None
    experience_years: str | None
    current_location: str | None
    skills: list[str]


class JobSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: uuid.UUID
    org_id: uuid.UUID
    title: str
    company_name: str


class AnswerSnapshot(ScreeningQuestionRead):
    value: str | bool


class ApplicationRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    job_id: uuid.UUID
    stage: ApplicationStage
    source: str
    resume_file_id: uuid.UUID | None
    cover_note: str | None
    salary_expectation: Decimal | None
    currency: str
    consent_share: bool
    accuracy_confirmed_at: datetime
    consent_shared_at: datetime
    profile_snapshot: ProfileSnapshot
    job_snapshot: JobSnapshot
    screening_answers: list[AnswerSnapshot]
    stage_changed_at: datetime
    withdrawn_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ApplicationPage(BaseModel):
    items: list[ApplicationRead]
    stage_counts: dict[ApplicationStage, int] = Field(default_factory=dict)
    total: int
    limit: int
    offset: int
    has_more: bool


class StageEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    from_stage: ApplicationStage | None
    to_stage: ApplicationStage
    created_at: datetime


class StageEventPage(BaseModel):
    items: list[StageEventRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class ApplicationContext(BaseModel):
    job_id: uuid.UUID
    contact: ApplicationContact
    profile: ProfileSnapshot
    questions: list[ScreeningQuestionRead]
    existing_application_id: uuid.UUID | None
    can_apply: bool
    ineligible_reason: str | None
    resume_optional: bool = True
