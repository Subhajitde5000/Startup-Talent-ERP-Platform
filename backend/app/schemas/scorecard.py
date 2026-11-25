"""7e strict inputs, private own ratings, and aggregate-only peer evaluation."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.applicant_pipeline import ApplicantRead
from app.schemas.common import clean_text

Name = Annotated[str, Field(strict=True, min_length=1, max_length=200)]
Anchor = Annotated[str, Field(strict=True, min_length=1, max_length=500)]
CardSort = Literal["newest", "oldest", "name", "updated"]
CardKind = Literal["templates", "jobs", "all"]


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CriterionInput(StrictInput):
    name: Name
    weight: int = Field(default=1, ge=1, le=100, strict=True)
    anchors: list[Anchor] = Field(default_factory=list, max_length=5)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return required_text(value, 200)

    @field_validator("anchors")
    @classmethod
    def trim_anchors(cls, values: list[str]) -> list[str]:
        return [required_text(value, 500) for value in values]


def required_text(value: str, maximum: int) -> str:
    result = clean_text(value, maximum)
    if result is None:
        raise ValueError("Must not be blank.")
    return result


Criteria = Annotated[list[CriterionInput], Field(min_length=1, max_length=20)]


class CardCreate(StrictInput):
    name: Name
    criteria: Criteria

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return required_text(value, 200)

    @field_validator("criteria")
    @classmethod
    def unique_names(cls, values: list[CriterionInput]) -> list[CriterionInput]:
        if len({value.name.casefold() for value in values}) != len(values):
            raise ValueError("Criterion names must be unique within a scorecard.")
        return values


class CardPatch(StrictInput):
    name: Name | None = None
    criteria: Criteria | None = None

    @model_validator(mode="after")
    def valid_patch(self) -> Self:
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set
        ):
            raise ValueError("Supply a non-null name or criteria.")
        if self.name is not None:
            self.name = required_text(self.name, 200)
        if self.criteria is not None:
            CardCreate.unique_names(self.criteria)
        return self


class CardSelect(StrictInput):
    template_id: uuid.UUID


class RatingInput(StrictInput):
    criterion_id: uuid.UUID
    score: int = Field(ge=1, le=5, strict=True)
    note: str | None = Field(default=None, max_length=2000, strict=True)

    @field_validator("note")
    @classmethod
    def trim_note(cls, value: str | None) -> str | None:
        return clean_text(value, 2000)


class RatingsPut(StrictInput):
    scores: list[RatingInput] = Field(max_length=20)

    @field_validator("scores")
    @classmethod
    def unique_criteria(cls, values: list[RatingInput]) -> list[RatingInput]:
        if len({value.criterion_id for value in values}) != len(values):
            raise ValueError("Supply at most one score per criterion.")
        return values


class CriterionRead(StrictInput):
    model_config = ConfigDict(extra="forbid", from_attributes=True)
    id: uuid.UUID
    name: str
    weight: int
    anchors: list[str]
    display_order: int


class CardRead(StrictInput):
    id: uuid.UUID
    org_id: uuid.UUID
    job_id: uuid.UUID | None
    name: str
    is_platform: bool
    source_scorecard_id: uuid.UUID | None
    locked_at: datetime | None
    created_at: datetime
    updated_at: datetime
    criteria: list[CriterionRead]


class CardPage(StrictInput):
    items: list[CardRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class OwnRatingRead(RatingInput):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CriterionAggregate(StrictInput):
    criterion_id: uuid.UUID
    rating_count: int
    mean: Decimal | None


class EvaluationRead(StrictInput):
    application_id: uuid.UUID
    scorecard_id: uuid.UUID
    own_scores: list[OwnRatingRead]
    aggregates: list[CriterionAggregate]
    weighted_mean: Decimal | None
    rated_criteria: int
    total_criteria: int
    coverage_pct: Decimal


class ApplicationEvaluation(StrictInput):
    scorecard: CardRead
    evaluation: EvaluationRead


class ComparisonItem(StrictInput):
    applicant: ApplicantRead
    evaluation: EvaluationRead


class ComparisonRead(StrictInput):
    scorecard: CardRead
    items: list[ComparisonItem]
