"""Step 7e schemas: scorecard templates, criteria, scores and compare.

Strict Create / Update / Read split (AGENTS.md sections 4-5). Server-owned
fields are ABSENT from every input schema, so ``extra="forbid"`` turns an
attempt to set them into a 422 — ``scorecards.org_id``/``is_platform``,
``scorecard_criteria.id``/``scorecard_id``/``display_order``,
``application_scores.interviewer_id``/``application_id``/``criterion_id``
(path-derived or stamped by the service) and all timestamps.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import clean_text

NAME_MAX = 200
MAX_CRITERIA = 30
MAX_ANCHORS = 8
ANCHOR_MAX = 200
SCORE_NOTE_MAX = 2000
WEIGHT_MAX = 100


def _clean_name(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("must not be blank")
    return cleaned


def _clean_anchors(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in values:
        item = value.strip()
        if not item:
            raise ValueError("anchors must not contain blank entries")
        if len(item) > ANCHOR_MAX:
            raise ValueError(f"anchors must be at most {ANCHOR_MAX} characters")
        cleaned.append(item)
    return cleaned


class CriterionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=NAME_MAX)
    weight: int = Field(default=1, ge=1, le=WEIGHT_MAX)
    anchors: list[str] = Field(default_factory=list, max_length=MAX_ANCHORS)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("anchors")
    @classmethod
    def trim_anchors(cls, value: list[str]) -> list[str]:
        return _clean_anchors(value)


class ScorecardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=NAME_MAX)
    job_id: uuid.UUID | None = Field(
        default=None, description="Optional same-organization job to attach to."
    )
    criteria: list[CriterionCreate] = Field(min_length=1, max_length=MAX_CRITERIA)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return _clean_name(value)


class CriterionUpdate(BaseModel):
    """One replace-set item: ``id=None`` creates, an existing id updates."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=NAME_MAX)
    weight: int = Field(default=1, ge=1, le=WEIGHT_MAX)
    anchors: list[str] = Field(default_factory=list, max_length=MAX_ANCHORS)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("anchors")
    @classmethod
    def trim_anchors(cls, value: list[str]) -> list[str]:
        return _clean_anchors(value)


class ScorecardUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX)
    criteria: list[CriterionUpdate] | None = Field(
        default=None, min_length=1, max_length=MAX_CRITERIA
    )

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str | None) -> str | None:
        return _clean_name(value) if value is not None else None

    @model_validator(mode="after")
    def meaningful_change(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Supply a name or criteria change.")
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name must not be null.")
        if "criteria" in self.model_fields_set and self.criteria is None:
            raise ValueError("criteria must not be null.")
        if "criteria" in self.model_fields_set and self.criteria is not None:
            ids = [item.id for item in self.criteria if item.id is not None]
            if len(ids) != len(set(ids)):
                raise ValueError("criteria ids must be unique.")
        return self


class CriterionRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    name: str
    weight: int
    anchors: list[str] | None
    display_order: int


class ScorecardRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    job_id: uuid.UUID | None
    is_platform: bool
    criteria: list[CriterionRead]
    created_at: datetime
    updated_at: datetime


class ScorecardPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ScorecardRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class ScoreInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterion_id: uuid.UUID
    score: int = Field(strict=True, ge=1, le=5)
    note: str | None = Field(default=None, max_length=SCORE_NOTE_MAX)

    @field_validator("note")
    @classmethod
    def trim_note(cls, value: str | None) -> str | None:
        return clean_text(value, SCORE_NOTE_MAX)


class ScoresPut(BaseModel):
    """Replace-set of the caller's own scores; an empty list clears them."""

    model_config = ConfigDict(extra="forbid")

    scores: list[ScoreInput] = Field(max_length=MAX_CRITERIA)

    @model_validator(mode="after")
    def unique_criteria(self) -> Self:
        ids = [item.criterion_id for item in self.scores]
        if len(ids) != len(set(ids)):
            raise ValueError("criterion_id values must be unique.")
        return self


class ScoreEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    interviewer_id: uuid.UUID | None
    score: int
    note: str | None
    created_at: datetime
    updated_at: datetime


class CriterionScoresRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterion_id: uuid.UUID
    name: str
    weight: int
    scores: list[ScoreEntry]
    my_score: int | None
    average: float | None
    scored_count: int


class ApplicationScoresRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    application_id: uuid.UUID
    items: list[CriterionScoresRead]
    weighted_total: float | None
    my_weighted_total: float | None


class CompareCriterion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterion_id: uuid.UUID
    name: str
    weight: int


class CompareCell(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterion_id: uuid.UUID
    average: float | None
    scored_count: int
    my_score: int | None


class CompareApplicant(BaseModel):
    model_config = ConfigDict(extra="forbid")

    application_id: uuid.UUID
    stage: str
    is_blind: bool
    label: str
    salary_expectation: Decimal | None
    currency: str
    experience_years: str | None
    headline: str | None
    skills: list[str] | None
    weighted_total: float | None
    scored_count: int
    scores: list[CompareCell]


class CompareRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: uuid.UUID
    job_title: str
    criteria: list[CompareCriterion]
    items: list[CompareApplicant]
