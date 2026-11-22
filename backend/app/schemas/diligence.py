"""Pydantic schemas for investor diligence (Step 9k: checklists + items).

All write schemas set ``extra="forbid"`` so a client cannot smuggle
server-controlled fields (org ids, checklist id, status, timestamps).
The scorecard is a free-form JSON document with a documented shape
(5 dimensions, each with weight/score/rationale) — validated loosely
(dict shape) rather than against a fixed schema so the frontend can
evolve the scorecard without migrations.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import clean_text


# ---------------------------------------------------------------------------
# Checklist
# ---------------------------------------------------------------------------
class DiligenceChecklistCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    startup_org_id: uuid.UUID
    round_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("notes")
    @classmethod
    def _notes_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 4000)


class DiligenceChecklistUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall_status: str | None = Field(
        default=None, pattern="^(not_started|in_progress|cleared|concern)$"
    )
    notes: str | None = Field(default=None, max_length=4000)
    scorecard: dict | None = None

    @field_validator("overall_status")
    @classmethod
    def _status_known(cls, value: str | None) -> str | None:
        if value is not None and value not in (
            "not_started",
            "in_progress",
            "cleared",
            "concern",
        ):
            raise ValueError(
                "overall_status must be not_started, in_progress, cleared or concern"
            )
        return value

    @field_validator("notes")
    @classmethod
    def _notes_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 4000)

    @field_validator("scorecard")
    @classmethod
    def _scorecard_shape(cls, value: dict | None) -> dict | None:
        if value is None:
            return None
        if not isinstance(value, dict):
            raise ValueError("scorecard must be a JSON object")
        return value


class DiligenceChecklistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    investor_org_id: uuid.UUID
    startup_org_id: uuid.UUID
    round_id: uuid.UUID | None
    deal_id: uuid.UUID | None
    overall_status: str
    notes: str | None
    scorecard: dict | None
    owner_id: uuid.UUID | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class DiligenceChecklistPage(BaseModel):
    items: list[DiligenceChecklistRead]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
class DiligenceItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_type: str = Field(pattern="^(checklist|question|finding)$")
    title: str = Field(min_length=1, max_length=200)
    severity: str | None = Field(default=None, pattern="^(high|medium|low|strength)$")
    status: str | None = Field(
        default=None,
        pattern="^(not_started|in_progress|needs_info|concern|cleared|na|answered|awaiting)$",
    )
    due_on: date | None = None
    response: str | None = Field(default=None, max_length=4000)

    @field_validator("item_type")
    @classmethod
    def _type_known(cls, value: str) -> str:
        if value not in ("checklist", "question", "finding"):
            raise ValueError("item_type must be checklist, question or finding")
        return value

    @field_validator("severity")
    @classmethod
    def _severity_known(cls, value: str | None) -> str | None:
        if value is not None and value not in ("high", "medium", "low", "strength"):
            raise ValueError("severity must be high, medium, low or strength")
        return value

    @field_validator("status")
    @classmethod
    def _status_known(cls, value: str | None) -> str | None:
        if value is not None and value not in (
            "not_started",
            "in_progress",
            "needs_info",
            "concern",
            "cleared",
            "na",
            "answered",
            "awaiting",
        ):
            raise ValueError(
                "status must be not_started, in_progress, needs_info, concern, "
                "cleared, na, answered or awaiting"
            )
        return value

    @field_validator("title")
    @classmethod
    def _title_clean(cls, value: str) -> str:
        cleaned = clean_text(value, 200)
        if not cleaned:
            raise ValueError("title cannot be blank")
        return cleaned

    @field_validator("response")
    @classmethod
    def _response_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 4000)


class DiligenceItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    severity: str | None = Field(default=None, pattern="^(high|medium|low|strength)$")
    status: str | None = Field(
        default=None,
        pattern="^(not_started|in_progress|needs_info|concern|cleared|na|answered|awaiting)$",
    )
    due_on: date | None = None
    response: str | None = Field(default=None, max_length=4000)

    @field_validator("severity")
    @classmethod
    def _severity_known(cls, value: str | None) -> str | None:
        if value is not None and value not in ("high", "medium", "low", "strength"):
            raise ValueError("severity must be high, medium, low or strength")
        return value

    @field_validator("status")
    @classmethod
    def _status_known(cls, value: str | None) -> str | None:
        if value is not None and value not in (
            "not_started",
            "in_progress",
            "needs_info",
            "concern",
            "cleared",
            "na",
            "answered",
            "awaiting",
        ):
            raise ValueError(
                "status must be not_started, in_progress, needs_info, concern, "
                "cleared, na, answered or awaiting"
            )
        return value

    @field_validator("title")
    @classmethod
    def _title_clean(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = clean_text(value, 200)
        if not cleaned:
            raise ValueError("title cannot be blank")
        return cleaned

    @field_validator("response")
    @classmethod
    def _response_clean(cls, value: str | None) -> str | None:
        return clean_text(value, 4000)


class DiligenceItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    checklist_id: uuid.UUID
    investor_org_id: uuid.UUID
    startup_org_id: uuid.UUID
    item_type: str
    title: str
    severity: str | None
    status: str
    due_on: date | None
    response: str | None
    owner_id: uuid.UUID | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class DiligenceItemPage(BaseModel):
    items: list[DiligenceItemRead]
    total: int
    limit: int
    offset: int


__all__ = [
    "DiligenceChecklistCreate",
    "DiligenceChecklistPage",
    "DiligenceChecklistRead",
    "DiligenceChecklistUpdate",
    "DiligenceItemCreate",
    "DiligenceItemPage",
    "DiligenceItemRead",
    "DiligenceItemUpdate",
]
