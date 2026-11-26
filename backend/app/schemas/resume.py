"""Pydantic schemas for Step 7n resume builder.

``extra="forbid"`` on every write schema enforces the mass-assignment guard:
server-controlled fields (``user_id``, ``ats_score``, ``is_default``, ``source``,
``created_at``, ``updated_at``, ``deleted_at``) are rejected with 422.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import clean_text


def _require_non_blank(v: str, max_len: int) -> str:
    cleaned = v.strip()
    if not cleaned:
        raise ValueError("must not be blank")
    if len(cleaned) > max_len:
        raise ValueError(f"must be at most {max_len} characters")
    return cleaned


class ResumeExperienceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role_title: Annotated[str, Field(min_length=1, max_length=120)]
    company: Annotated[str, Field(min_length=1, max_length=120)]
    period_label: Annotated[str | None, Field(max_length=80)] = None
    started_on: date | None = None
    ended_on: date | None = None
    bullets: Annotated[list[str], Field(default_factory=list, max_length=15)]

    @field_validator("role_title", "company", mode="before")
    @classmethod
    def _clean_required(cls, v: object) -> object:
        if isinstance(v, str):
            return _require_non_blank(v, 120)
        return v

    @field_validator("period_label", mode="before")
    @classmethod
    def _clean_period(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 80)
        return v

    @field_validator("bullets", mode="before")
    @classmethod
    def _clean_bullets(cls, v: object) -> object:
        if not isinstance(v, list):
            return v
        out: list[str] = []
        for item in v:
            if not isinstance(item, str):
                raise ValueError("each bullet must be a string")
            cleaned = item.strip()
            if not cleaned:
                continue
            if len(cleaned) > 500:
                raise ValueError("each bullet must be at most 500 characters")
            out.append(cleaned)
        return out

    @model_validator(mode="after")
    def _check_dates(self) -> ResumeExperienceIn:
        if self.started_on and self.ended_on and self.ended_on < self.started_on:
            raise ValueError("ended_on must be on or after started_on")
        return self


class ResumeExperienceRead(BaseModel):
    id: uuid.UUID
    role_title: str
    company: str
    period_label: str | None
    started_on: date | None
    ended_on: date | None
    bullets: list[str]
    display_order: int
    created_at: datetime


class ResumeExperiencesReplace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: Annotated[list[ResumeExperienceIn], Field(max_length=20)]


class ResumeEducationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    degree: Annotated[str, Field(min_length=1, max_length=160)]
    school: Annotated[str, Field(min_length=1, max_length=160)]
    year_label: Annotated[str | None, Field(max_length=60)] = None

    @field_validator("degree", "school", mode="before")
    @classmethod
    def _clean_required(cls, v: object) -> object:
        if isinstance(v, str):
            return _require_non_blank(v, 160)
        return v

    @field_validator("year_label", mode="before")
    @classmethod
    def _clean_year(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 60)
        return v


class ResumeEducationRead(BaseModel):
    id: uuid.UUID
    degree: str
    school: str
    year_label: str | None
    display_order: int
    created_at: datetime


class ResumeEducationReplace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: Annotated[list[ResumeEducationIn], Field(max_length=10)]


class ResumeSkillRead(BaseModel):
    id: uuid.UUID
    name: str
    category: str | None = None


class ResumeSkillsReplace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill_ids: Annotated[list[uuid.UUID], Field(max_length=50)]


class ResumeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Annotated[str, Field(min_length=1, max_length=120)]
    target_role: Annotated[str | None, Field(max_length=120)] = None
    summary: Annotated[str | None, Field(max_length=4000)] = None
    template: Annotated[str | None, Field(max_length=64)] = None

    @field_validator("title", mode="before")
    @classmethod
    def _clean_title(cls, v: object) -> object:
        if isinstance(v, str):
            return _require_non_blank(v, 120)
        return v

    @field_validator("target_role", mode="before")
    @classmethod
    def _clean_target_role(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 120)
        return v

    @field_validator("summary", mode="before")
    @classmethod
    def _clean_summary(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 4000)
        return v

    @field_validator("template", mode="before")
    @classmethod
    def _clean_template(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 64)
        return v


class ResumeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Annotated[str | None, Field(min_length=1, max_length=120)] = None
    target_role: Annotated[str | None, Field(max_length=120)] = None
    summary: Annotated[str | None, Field(max_length=4000)] = None
    template: Annotated[str | None, Field(max_length=64)] = None

    @field_validator("title", mode="before")
    @classmethod
    def _clean_title(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            return _require_non_blank(v, 120)
        return v

    @field_validator("target_role", mode="before")
    @classmethod
    def _clean_target_role(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 120)
        return v

    @field_validator("summary", mode="before")
    @classmethod
    def _clean_summary(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 4000)
        return v

    @field_validator("template", mode="before")
    @classmethod
    def _clean_template(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 64)
        return v


class ResumeListItem(BaseModel):
    id: uuid.UUID
    title: str
    target_role: str | None
    template: str | None
    source: str
    ats_score: int | None
    is_default: bool
    created_at: datetime
    updated_at: datetime


class ResumeRead(ResumeListItem):
    summary: str | None
    experiences: list[ResumeExperienceRead]
    education: list[ResumeEducationRead]
    skills: list[ResumeSkillRead]


class ResumePage(BaseModel):
    items: list[ResumeListItem]
    total: int
    limit: int
    offset: int
    has_more: bool


class ResumeSummaryRead(BaseModel):
    total: int
    primary_count: int
    avg_ats_score: int | None


class ResumeExportRead(BaseModel):
    id: uuid.UUID
    title: str
    target_role: str | None
    template: str | None
    summary: str | None
    ats_score: int | None
    is_default: bool
    experiences: list[ResumeExperienceRead]
    education: list[ResumeEducationRead]
    skills: list[ResumeSkillRead]
    exported_at: datetime
