"""Startup profile schemas (Step 5a).

Conventions (AGENTS.md section 5): PATCH-only write, separate Read and
Public-Read shapes, server-owned fields (org_id, mentor_verified,
readiness_score, timestamps) ABSENT from StartupProfileUpdate so they
cannot be mass-assigned — extra="forbid" turns any attempt into a 422.

PATCH semantics: fields are applied with ``exclude_unset`` — an omitted
key leaves the stored value unchanged, an explicit ``null`` clears a
nullable text field, and NOT NULL fields (stage, visibility, booleans,
ecosystem_goals) are typed non-optional so ``null`` is rejected with 422.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from app.models.startup import ProfileVisibility, StartupStage
from app.schemas.common import clean_text

_MAX_TAGLINE = 200
_MAX_MISSION = 300
_MAX_SECTOR = 200
_MAX_BUSINESS_MODEL = 500
_MAX_LONG_TEXT = 5000
_MAX_STATUS = 100
_MAX_URL = 500
_MAX_GOALS = 20
_MAX_GOAL_LEN = 100

_TEXT_LIMITS: dict[str, int] = {
    "tagline": _MAX_TAGLINE,
    "mission": _MAX_MISSION,
    "sector": _MAX_SECTOR,
    "business_model": _MAX_BUSINESS_MODEL,
    "problem": _MAX_LONG_TEXT,
    "solution": _MAX_LONG_TEXT,
    "market": _MAX_LONG_TEXT,
    "traction_summary": _MAX_LONG_TEXT,
    "mrr_range": _MAX_STATUS,
    "funding_status": _MAX_STATUS,
    "pitch_deck_url": _MAX_URL,
    "dpiit_status": _MAX_STATUS,
    "legal_entity": _MAX_STATUS,
    "demo_url": _MAX_URL,
    "actively_raising": _MAX_STATUS,
    "target_raise": _MAX_STATUS,
}


class StartupProfileUpdate(BaseModel):
    """Member patch. Server-controlled fields are structurally absent."""

    model_config = ConfigDict(extra="forbid")

    tagline: str | None = Field(default=None, max_length=_MAX_TAGLINE)
    # Step 7t GAP (0052): employer page "Mission" line.
    mission: str | None = Field(default=None, max_length=_MAX_MISSION)
    # NOT NULL columns below: default is never written (exclude_unset);
    # typing them non-optional makes an explicit null a 422.
    stage: StartupStage = StartupStage.idea
    sector: str | None = Field(default=None, max_length=_MAX_SECTOR)
    business_model: str | None = Field(default=None, max_length=_MAX_BUSINESS_MODEL)
    problem: str | None = Field(default=None, max_length=_MAX_LONG_TEXT)
    solution: str | None = Field(default=None, max_length=_MAX_LONG_TEXT)
    market: str | None = Field(default=None, max_length=_MAX_LONG_TEXT)
    traction_summary: str | None = Field(default=None, max_length=_MAX_LONG_TEXT)
    mrr_range: str | None = Field(default=None, max_length=_MAX_STATUS)
    funding_status: str | None = Field(default=None, max_length=_MAX_STATUS)
    pitch_deck_url: str | None = Field(default=None, max_length=_MAX_URL)
    pitch_deck_file_id: uuid.UUID | None = None
    dpiit_status: str | None = Field(default=None, max_length=_MAX_STATUS)
    legal_entity: str | None = Field(default=None, max_length=_MAX_STATUS)
    demo_url: str | None = Field(default=None, max_length=_MAX_URL)
    actively_raising: str | None = Field(default=None, max_length=_MAX_STATUS)
    target_raise: str | None = Field(default=None, max_length=_MAX_STATUS)
    ecosystem_goals: list[str] = Field(default_factory=list, max_length=_MAX_GOALS)
    profile_visibility: ProfileVisibility = ProfileVisibility.mentors_and_investors
    summary_public: bool = True
    traction_public: bool = True
    team_public: bool = True
    funding_public: bool = False
    round_public: bool = False
    readiness_public: bool = True
    contacts_public: bool = False

    @field_validator(*_TEXT_LIMITS)
    @classmethod
    def _clean(cls, v: str | None, info: ValidationInfo) -> str | None:
        name = info.field_name
        assert name is not None  # field validators always carry a field name
        return clean_text(v, _TEXT_LIMITS[name])

    @field_validator("ecosystem_goals")
    @classmethod
    def _goals(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in v:
            item = item.strip()
            if not item:
                continue
            if len(item) > _MAX_GOAL_LEN:
                raise ValueError(f"each goal must be at most {_MAX_GOAL_LEN} characters")
            cleaned.append(item)
        return cleaned


class StartupProfileRead(BaseModel):
    """Member shape: everything stored, including server-controlled fields."""

    model_config = ConfigDict(extra="forbid")

    org_id: uuid.UUID
    tagline: str | None
    mission: str | None
    stage: StartupStage
    sector: str | None
    business_model: str | None
    problem: str | None
    solution: str | None
    market: str | None
    traction_summary: str | None
    mrr_range: str | None
    funding_status: str | None
    pitch_deck_url: str | None
    pitch_deck_file_id: uuid.UUID | None
    dpiit_status: str | None
    legal_entity: str | None
    demo_url: str | None
    actively_raising: str | None
    target_raise: str | None
    ecosystem_goals: list[str]
    mentor_verified: bool
    readiness_score: int | None
    profile_visibility: ProfileVisibility
    summary_public: bool
    traction_public: bool
    team_public: bool
    funding_public: bool
    round_public: bool
    readiness_public: bool
    contacts_public: bool
    created_at: datetime
    updated_at: datetime


class StartupProfilePublicRead(BaseModel):
    """Public/preview shape. Section fields are None when the caller may
    not see them (or when the profile is not publicly visible at all)."""

    model_config = ConfigDict(extra="forbid")

    slug: str
    name: str
    visibility: ProfileVisibility
    visible_to_public: bool
    tagline: str | None = None
    stage: StartupStage | None = None
    sector: str | None = None
    city: str | None = None
    founded_year: int | None = None
    website: str | None = None
    # Gated by summary_public: pitch content + the organization summary.
    summary: str | None = None
    business_model: str | None = None
    problem: str | None = None
    solution: str | None = None
    market: str | None = None
    # Gated by traction_public.
    traction_summary: str | None = None
