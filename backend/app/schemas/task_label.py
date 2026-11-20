"""Task label schemas (Step 5d).

Separate Create/Update/Read shapes (AGENTS.md section 5). Server-owned
fields — ``id``, ``org_id``, ``created_at``, ``updated_at`` — are absent
from every input schema, so ``extra="forbid"`` turns an attempt into a
422. ``color`` is validated here rather than in the database because a
regex CHECK has no portable SQLite equivalent (plan D-5).
"""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.task_label import MAX_LABEL_NAME, MAX_LABELS_PER_TASK

# Design §18: labels are neutral pills, so the palette is a plain hex
# triplet. Stored as given with the leading '#'.
_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _clean_name(v: str) -> str:
    cleaned = " ".join(v.split())
    if not cleaned:
        raise ValueError("must not be blank")
    if len(cleaned) > MAX_LABEL_NAME:
        raise ValueError(f"must be at most {MAX_LABEL_NAME} characters")
    return cleaned


class TaskLabelCreate(BaseModel):
    """Owner/admin create. ``name`` is unique per organization (case-insensitive)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=MAX_LABEL_NAME)
    color: str | None = Field(default=None, max_length=7)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("color")
    @classmethod
    def _color(cls, v: str | None) -> str | None:
        # Blank clears the colour rather than storing "".
        if v is None or not v.strip():
            return None
        cleaned = v.strip()
        if not _COLOR_RE.match(cleaned):
            raise ValueError("must be a hex colour like #4A5568")
        return cleaned


class TaskLabelUpdate(BaseModel):
    """Owner/admin patch. Omitted keys are unchanged (``exclude_unset``)."""

    model_config = ConfigDict(extra="forbid")

    # NOT NULL column: non-optional type so an explicit null is a 422.
    name: str = Field(default="", max_length=MAX_LABEL_NAME)
    color: str | None = Field(default=None, max_length=7)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("color")
    @classmethod
    def _color(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        cleaned = v.strip()
        if not _COLOR_RE.match(cleaned):
            raise ValueError("must be a hex colour like #4A5568")
        return cleaned


class TaskLabelRead(BaseModel):
    """Label shape (also the shape embedded in ``TaskRead.labels``)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    color: str | None
    created_at: datetime
    updated_at: datetime


class TaskLabelPage(BaseModel):
    """Paginated label list (limit/offset, 5b/5c convention)."""

    model_config = ConfigDict(extra="forbid")

    items: list[TaskLabelRead]
    total: int
    limit: int
    offset: int


class TaskLabelSet(BaseModel):
    """Replace-set for one task: the label ids it should carry afterwards.

    Ids are validated as same-org labels by the service (422 with
    ``loc: [body, label_ids]``), duplicates are collapsed, and the design
    cap of 8 labels per task is enforced here and in the service.
    """

    model_config = ConfigDict(extra="forbid")

    label_ids: list[uuid.UUID] = Field(
        default_factory=list, max_length=MAX_LABELS_PER_TASK
    )
