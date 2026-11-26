"""Schemas for Step 7m saved jobs (job-seeker bookmarks).

``extra="forbid"`` on every write schema is the mass-assignment guard: the
server-controlled ``user_id`` and ``created_at`` can never cross the wire, and
any stray field is rejected with a 422. Money is returned as decimal strings,
never floats (AGENTS.md).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class SavedJobJob(BaseModel):
    """The job projection embedded in a saved-job row (read-only)."""

    id: uuid.UUID
    title: str
    status: str
    location: str | None
    application_deadline: datetime | None
    work_mode: str
    employment_type: str
    salary_min: str | None
    salary_max: str | None
    currency: str
    salary_period: str
    org_id: uuid.UUID
    org_name: str | None


class SavedJobRead(BaseModel):
    job_id: uuid.UUID
    note: str | None
    created_at: datetime
    job: SavedJobJob | None
    status: str


class SavedJobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: uuid.UUID
    note: Annotated[str | None, Field(max_length=2000)] = None


class SavedJobUpdate(BaseModel):
    """The only client-writable field is the private note."""

    model_config = ConfigDict(extra="forbid")

    note: Annotated[str | None, Field(max_length=2000)]


class SavedJobPage(BaseModel):
    items: list[SavedJobRead]
    total: int
    limit: int
    offset: int
    has_more: bool
