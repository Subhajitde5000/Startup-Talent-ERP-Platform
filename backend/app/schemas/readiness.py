"""Readiness schemas (Step 5f).

Conventions (AGENTS.md section 5): separate input/read shapes and
``extra="forbid"`` everywhere. Server-controlled fields are ABSENT from
every input schema, so an attempt to send them is a 422:

- ``status`` — written only by the four transition endpoints
  (submit / withdraw / sign-off / reject), never by a field patch;
- ``score`` — reserved (plan D4), never client-writable;
- ``signed_off_by`` / ``signed_off_at`` — stamped from the token;
- ``id``, ``org_id``, ``criterion_id``, timestamps.

A startup member edits ``evidence`` and ``notes``; the criterion
reference data itself is not editable through the API in this step
(bootstrap command only, plan D2).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.readiness import ReadinessStatus
from app.models.startup import StartupStage
from app.schemas.common import clean_text

_MAX_EVIDENCE = 2000
_MAX_NOTES = 2000


class ReadinessCriterionRead(BaseModel):
    """Reference data row (no org, no user state)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    code: str
    title: str
    description: str | None
    stage: StartupStage | None
    weight: int
    display_order: int


class ReadinessUpdate(BaseModel):
    """Startup-side field patch. Status is not here on purpose."""

    model_config = ConfigDict(extra="forbid")

    evidence: str | None = Field(default=None, max_length=_MAX_EVIDENCE)
    notes: str | None = Field(default=None, max_length=_MAX_NOTES)

    @field_validator("evidence", "notes")
    @classmethod
    def _clean(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_EVIDENCE)


class ReadinessReject(BaseModel):
    """A rejection must say why (stored in ``notes``, plan D6)."""

    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=_MAX_NOTES)

    @field_validator("reason")
    @classmethod
    def _reason(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class ReadinessRead(BaseModel):
    """One criterion joined with this organization's state."""

    model_config = ConfigDict(extra="forbid")

    # The startup_readiness row id: the value a task's ``readiness_id``
    # references (schema.sql FK to startup_readiness.id). Created on demand
    # by the board/item reads (plan D5), so it always exists before a link.
    id: uuid.UUID
    criterion_id: uuid.UUID
    code: str
    title: str
    description: str | None
    stage: StartupStage | None
    display_order: int

    # Per-org state.
    status: ReadinessStatus
    evidence: str | None
    notes: str | None
    signed_off_by: uuid.UUID | None
    signed_off_at: datetime | None
    updated_at: datetime | None


class ReadinessSummary(BaseModel):
    """Plan D1: the score is signed-off / ACTIVE criteria, never the
    schema.sql view (which divides by touched rows only)."""

    model_config = ConfigDict(extra="forbid")

    criteria_total: int
    criteria_signed_off: int
    readiness_pct: int
    is_ready: bool


class ReadinessBoard(BaseModel):
    """The whole /startup/readiness page in one read."""

    model_config = ConfigDict(extra="forbid")

    org_id: uuid.UUID
    summary: ReadinessSummary
    items: list[ReadinessRead]
