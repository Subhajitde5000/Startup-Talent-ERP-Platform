"""Task schemas (Step 5c, extended by Step 5f and 5d).

Conventions (AGENTS.md section 5): separate Create/Update/Move/Read
shapes; server-owned fields (id, org_id, created_by, completed_at,
display_order, timestamps) are ABSENT from every input schema —
extra="forbid" turns any attempt into a 422 (plan D1/D6).

Step 5f carries the 5c D1 deferral: ``readiness_id`` is now a real,
validated reference on PATCH (a same-org ``startup_readiness`` row) and
is returned by TaskRead. It stays out of TaskCreate — a brand-new task
is not pre-linked to a criterion.

Create: title required; status is always ``todo`` at creation — only
the move endpoint writes status/completed_at/display_order (D6).
Update: fields apply with ``exclude_unset`` — omitted keys are
unchanged, explicit ``null`` clears a nullable column, and NOT NULL
columns (title, priority) are typed non-optional so an explicit null
is a 422.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.task import TaskPriority, TaskStatus
from app.schemas.common import clean_text
from app.schemas.task_label import TaskLabelRead

_MAX_TITLE = 200
_MAX_DESCRIPTION = 5000


class TaskCreate(BaseModel):
    """Member create. Server-owned fields are structurally absent."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=_MAX_TITLE)
    description: str | None = Field(default=None, max_length=_MAX_DESCRIPTION)
    priority: TaskPriority = TaskPriority.medium
    milestone_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    due_on: date | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("description")
    @classmethod
    def _description(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_DESCRIPTION)


class TaskUpdate(BaseModel):
    """Member patch: fields only. ``status``, ``completed_at`` and
    ``display_order`` belong to the move endpoint (D6)."""

    model_config = ConfigDict(extra="forbid")

    # NOT NULL columns: defaults below are never written (exclude_unset);
    # typing them non-optional makes an explicit null a 422.
    title: str = Field(default="", max_length=_MAX_TITLE)
    description: str | None = Field(default=None, max_length=_MAX_DESCRIPTION)
    priority: TaskPriority = TaskPriority.medium
    milestone_id: uuid.UUID | None = None
    assignee_id: uuid.UUID | None = None
    due_on: date | None = None
    # Step 5f: linked stage criterion (same-organization row).
    readiness_id: uuid.UUID | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("description")
    @classmethod
    def _description(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_DESCRIPTION)


class TaskMove(BaseModel):
    """Column move and/or position within a column.

    Anchors reference a task in the TARGET column of the same
    organization (service-validated, 422 with a field-level loc);
    exactly one anchor at most, and at least one action overall.
    Raw display_order / completed_at are structurally absent (D3/D6).
    """

    model_config = ConfigDict(extra="forbid")

    status: TaskStatus | None = None
    before_id: uuid.UUID | None = None
    after_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _one_action(self) -> "TaskMove":
        if self.before_id is not None and self.after_id is not None:
            raise ValueError("before_id and after_id are mutually exclusive")
        if self.status is None and self.before_id is None and self.after_id is None:
            raise ValueError("provide status and/or before_id/after_id")
        return self


class TaskRead(BaseModel):
    """Member shape. ``readiness_id`` arrived with Step 5f (D1 deferral
    honoured): the linked readiness item, or null."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    milestone_id: uuid.UUID | None
    assignee_id: uuid.UUID | None
    readiness_id: uuid.UUID | None
    created_by: uuid.UUID | None
    due_on: date | None
    completed_at: datetime | None
    display_order: int
    # Step 5d: the task's labels, loaded in one batched query per request
    # (never one query per task). Empty list when the task has none.
    labels: list[TaskLabelRead] = []
    created_at: datetime
    updated_at: datetime


class TaskPage(BaseModel):
    """Paginated list envelope (limit/offset, same shape as 5b)."""

    model_config = ConfigDict(extra="forbid")

    items: list[TaskRead]
    total: int
    limit: int
    offset: int
