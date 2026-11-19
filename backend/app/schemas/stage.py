"""Stage schemas (Steps 5i + 5j).

Conventions (AGENTS.md section 5): separate input/read shapes and
``extra="forbid"`` everywhere. Server-controlled fields are ABSENT from
every input schema, so sending them is a 422:

- ``changed_by`` / ``changed_at`` on history — stamped from the token;
- ``updated_by`` / ``created_at`` / ``updated_at`` on tool progress;
- ``org_id`` — from the path, never the body;
- ``stage`` and ``tool_key`` on a tool — path-owned, not body-owned, so a
  client can never move a row to another stage or tool key.

``progress`` and ``status`` are mutually constrained in the service: a
``done`` tool is forced to 100 and ``not_started`` to 0, so the frontend
can never store a contradictory pair.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.stage import ToolStatus
from app.models.startup import StartupStage
from app.schemas.common import clean_text
from app.schemas.readiness import ReadinessRead

_MAX_NOTE = 500
_MAX_NOTES = 2000


class StageChange(BaseModel):
    """Body of a stage change. ``note`` is optional context for history."""

    model_config = ConfigDict(extra="forbid")

    stage: StartupStage
    note: str | None = Field(default=None, max_length=_MAX_NOTE)

    @field_validator("note")
    @classmethod
    def _clean_note(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_NOTE)


class StageHistoryRead(BaseModel):
    """One recorded stage change."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    from_stage: StartupStage | None
    to_stage: StartupStage
    changed_by: uuid.UUID | None
    changed_at: datetime
    note: str | None


class StageHistoryPage(BaseModel):
    """Newest-first page of stage changes (limit/offset, 5b/5c convention)."""

    model_config = ConfigDict(extra="forbid")

    items: list[StageHistoryRead]
    total: int
    limit: int
    offset: int


class StageSummary(BaseModel):
    """The /startup/stage header: current stage, since when, and the split
    of this stage's exit criteria by status."""

    model_config = ConfigDict(extra="forbid")

    org_id: uuid.UUID
    stage: StartupStage
    # Null when no history exists yet (a startup that never moved stage).
    in_stage_since: datetime | None
    exit_criteria_total: int
    exit_criteria_signed_off: int
    # Readiness items only — the cached score 5f owns (5i D1).
    readiness_pct: int | None


class StageCriteriaBoard(BaseModel):
    """Exit criteria for ONE stage, each with this org's state.

    ``ReadinessRead`` is reused verbatim: an exit criterion is a
    ``startup_readiness`` row, so it carries the same evidence, status and
    sign-off fields the 5f page already renders. That is what makes this
    one source of truth instead of two lists (5i item 1).
    """

    model_config = ConfigDict(extra="forbid")

    org_id: uuid.UUID
    stage: StartupStage
    is_current_stage: bool
    items: list[ReadinessRead]


class StageToolRead(BaseModel):
    """One tool for the current stage, merged with this org's progress."""

    model_config = ConfigDict(extra="forbid")

    tool_key: str
    name: str
    description: str
    # The demo's "Optional tool" label; kept so no UI copy is lost.
    is_optional: bool
    status: ToolStatus
    progress: int
    notes: str | None


class StageToolBoard(BaseModel):
    """All tools for one stage (the /startup/stage tool grid)."""

    model_config = ConfigDict(extra="forbid")

    org_id: uuid.UUID
    stage: StartupStage
    items: list[StageToolRead]
    # Stage-wide roll-up so the page never invents a number (5j).
    completed: int
    total: int


class StageToolUpdate(BaseModel):
    """Tool progress patch. ``status``/``progress`` are reconciled server
    side; ``notes`` is cleared by an explicit null."""

    model_config = ConfigDict(extra="forbid")

    status: ToolStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=_MAX_NOTES)

    @field_validator("notes")
    @classmethod
    def _clean_notes(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_NOTES)
