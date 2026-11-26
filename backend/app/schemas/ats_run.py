"""Pydantic schemas for Step 7o ATS check and AI tailoring."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import clean_text


class AtsRunCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: uuid.UUID | None = None
    job_description: Annotated[str | None, Field(max_length=4000)] = None

    @field_validator("job_description", mode="before")
    @classmethod
    def _clean_jd(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 4000)
        return v


class TailorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: uuid.UUID | None = None
    job_description: Annotated[str | None, Field(max_length=4000)] = None

    @field_validator("job_description", mode="before")
    @classmethod
    def _clean_jd(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 4000)
        return v

    @model_validator(mode="after")
    def _require_target(self) -> TailorRequest:
        if self.job_id is None and self.job_description is None:
            raise ValueError("Provide either job_id or job_description.")
        return self


class AtsSuggestionRead(BaseModel):
    section: Literal["summary", "experience", "education", "skills", "general"]
    original: str | None = None
    tailored: str | None = None
    rationale: str


class AtsRunRead(BaseModel):
    id: uuid.UUID
    resume_id: uuid.UUID
    job_id: uuid.UUID | None
    run_type: Literal["ats", "tailor"]
    score: int | None
    missing_keywords: list[str]
    matched_keywords: list[str]
    suggestions: list[AtsSuggestionRead]
    ai_notice: str | None = None
    created_at: datetime


class AtsRunPage(BaseModel):
    items: list[AtsRunRead]
    total: int
    limit: int
    offset: int
    has_more: bool
