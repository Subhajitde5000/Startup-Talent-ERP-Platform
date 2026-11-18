"""Milestone schemas (Step 5b).

Conventions (AGENTS.md section 5): separate Create/Update/Read shapes;
server-owned fields (id, org_id, created_at, updated_at, deleted_at)
are ABSENT from Create/Update so they cannot be mass-assigned —
extra="forbid" turns any attempt into a 422.

Create semantics: ``name`` is required; the rest have defaults
(status ``on_track``, progress 0, owner defaults to the creator in the
service — plan D4). Update semantics: fields apply with
``exclude_unset`` — an omitted key leaves the stored value unchanged,
an explicit ``null`` clears a nullable column, and NOT NULL columns
(name, status, progress) are typed non-optional so an explicit null is
a 422.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.milestone import MilestoneStatus
from app.schemas.common import clean_text

_MAX_NAME = 200
_MAX_DESCRIPTION = 5000


class MilestoneCreate(BaseModel):
    """Member create. Server-owned fields are structurally absent."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=_MAX_NAME)
    description: str | None = Field(default=None, max_length=_MAX_DESCRIPTION)
    target_date: date | None = None
    owner_id: uuid.UUID | None = None
    status: MilestoneStatus = MilestoneStatus.on_track
    progress: int = Field(default=0, ge=0, le=100)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("description")
    @classmethod
    def _description(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_DESCRIPTION)


class MilestoneUpdate(BaseModel):
    """Member patch. Server-owned fields are structurally absent."""

    model_config = ConfigDict(extra="forbid")

    # NOT NULL columns: the default below is never written (exclude_unset);
    # typing them non-optional makes an explicit null a 422.
    name: str = Field(default="", max_length=_MAX_NAME)
    description: str | None = Field(default=None, max_length=_MAX_DESCRIPTION)
    target_date: date | None = None
    owner_id: uuid.UUID | None = None
    status: MilestoneStatus = MilestoneStatus.on_track
    progress: int = Field(default=0, ge=0, le=100)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("description")
    @classmethod
    def _description(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_DESCRIPTION)


class MilestoneRead(BaseModel):
    """Member shape: every stored column except deleted_at (internal)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    description: str | None
    target_date: date | None
    owner_id: uuid.UUID | None
    status: MilestoneStatus
    progress: int
    created_at: datetime
    updated_at: datetime


class MilestonePage(BaseModel):
    """Paginated list envelope (limit/offset; first paginated list in
    the API — earlier lists predate the pagination rule)."""

    model_config = ConfigDict(extra="forbid")

    items: list[MilestoneRead]
    total: int
    limit: int
    offset: int
