"""Pydantic schemas for Step 7p/7q practice interviews and scoring."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import clean_text

PracticeDifficulty = Literal["easy", "medium", "hard"]
PracticeSessionStatus = Literal["scheduled", "in_progress", "completed", "abandoned"]
PracticeSpeaker = Literal["interviewer", "candidate"]


def _require_non_blank(value: str, max_len: int) -> str:
    cleaned = clean_text(value, max_len)
    if not cleaned:
        raise ValueError("Value must not be blank.")
    return cleaned


class PracticeDrillRead(BaseModel):
    id: uuid.UUID
    category: str
    title: str
    difficulty: PracticeDifficulty
    duration_min: int | None
    description: str | None
    prompts: list[str]
    rubric: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PracticeDrillPage(BaseModel):
    items: list[PracticeDrillRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class PracticeSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    drill_id: uuid.UUID | None = None
    title: Annotated[str | None, Field(max_length=160)] = None
    target_role: Annotated[str | None, Field(max_length=120)] = None
    focus_area: Annotated[str | None, Field(max_length=120)] = None
    difficulty: PracticeDifficulty = "medium"
    question_count: Annotated[int, Field(ge=1, le=15)] = 3
    is_video_mode: bool = False

    @field_validator("title", mode="before")
    @classmethod
    def _clean_title(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 160)
        return v

    @field_validator("target_role", "focus_area", mode="before")
    @classmethod
    def _clean_role_focus(cls, v: object) -> object:
        if isinstance(v, str) or v is None:
            return clean_text(v, 120)
        return v


class PracticeTurnRead(BaseModel):
    id: int
    session_id: uuid.UUID
    speaker: PracticeSpeaker
    content: str
    question_index: int | None
    created_at: datetime


class PracticeTurnCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: Annotated[str, Field(min_length=1, max_length=4000)]
    question_index: Annotated[int | None, Field(ge=0, le=14)] = None

    @field_validator("content", mode="before")
    @classmethod
    def _clean_content(cls, v: object) -> object:
        if isinstance(v, str):
            return _require_non_blank(v, 4000)
        return v


class PracticeTurnResponse(BaseModel):
    candidate_turn: PracticeTurnRead
    interviewer_turn: PracticeTurnRead | None = None
    is_final_question: bool
    ai_notice: str | None = None


class PracticeScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    duration_sec: Annotated[int | None, Field(ge=0, le=14400)] = None
    confidence_score: Annotated[int | None, Field(ge=0, le=100)] = None
    body_language_score: Annotated[int | None, Field(ge=0, le=100)] = None
    communication_score: Annotated[int | None, Field(ge=0, le=100)] = None


class PracticeSessionListItem(BaseModel):
    id: uuid.UUID
    drill_id: uuid.UUID | None
    title: str | None
    target_role: str | None
    focus_area: str | None
    difficulty: PracticeDifficulty
    question_count: int
    status: PracticeSessionStatus
    score: int | None
    duration_sec: int | None
    is_video_mode: bool
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PracticeSessionPage(BaseModel):
    items: list[PracticeSessionListItem]
    total: int
    limit: int
    offset: int
    has_more: bool


class PracticeSessionRead(PracticeSessionListItem):
    questions: list[str]
    clarity: int | None
    structure: int | None
    empathy: int | None
    technical_rigor: int | None
    confidence_score: int | None
    body_language_score: int | None
    communication_score: int | None
    feedback: str | None
    turns: list[PracticeTurnRead]


class PracticeSummaryRead(BaseModel):
    total_sessions: int
    completed_sessions: int
    avg_score: int | None
    best_score: int | None
    total_practice_min: int


class PracticeRubricLevel(BaseModel):
    label: str
    description: str


class PracticeRubricCriterion(BaseModel):
    key: str
    title: str
    weight_pct: int
    description: str
    levels: list[PracticeRubricLevel]


class PracticeRubricRead(BaseModel):
    criteria: list[PracticeRubricCriterion]


class PracticeDimensionScore(BaseModel):
    key: str
    label: str
    weight_pct: int
    score: int
    note: str


class PracticeReportRead(BaseModel):
    session: PracticeSessionRead
    dimensions: list[PracticeDimensionScore]
    ai_notice: str | None = None
