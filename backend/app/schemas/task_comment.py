"""Task comment schemas (Step 5d).

Server-owned fields — ``id``, ``task_id``, ``author_id``, ``created_at``,
``updated_at``, ``deleted_at`` — are absent from every input schema, so
``extra="forbid"`` rejects a mass-assignment attempt with 422. Authorship
comes from the authenticated user, never from the body.

Delete uses no body at all: the action and its reason are implied by the
endpoint (soft delete, author or owner/admin).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.task_comment import MAX_COMMENT_BODY


def _clean_body(v: str) -> str:
    # Keep interior newlines (comments are paragraphs); strip the edges and
    # reject whitespace-only bodies, matching the DB CHECK.
    cleaned = v.strip()
    if not cleaned:
        raise ValueError("must not be blank")
    return cleaned


class TaskCommentCreate(BaseModel):
    """Member create. Author is the caller (never supplied)."""

    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=MAX_COMMENT_BODY)

    @field_validator("body")
    @classmethod
    def _body(cls, v: str) -> str:
        return _clean_body(v)


class TaskCommentUpdate(BaseModel):
    """Author edit. Same bounds as create; omitted keys are unchanged."""

    model_config = ConfigDict(extra="forbid")

    # Non-optional: an explicit null is a 422 rather than a blank comment.
    body: str = Field(default="", max_length=MAX_COMMENT_BODY)

    @field_validator("body")
    @classmethod
    def _body(cls, v: str) -> str:
        return _clean_body(v)


class TaskCommentRead(BaseModel):
    """Comment shape. ``can_edit`` / ``can_delete`` are computed per caller
    so the page can disable the controls without re-deriving the rule."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str | None
    body: str
    created_at: datetime
    updated_at: datetime
    can_edit: bool
    can_delete: bool


class TaskCommentPage(BaseModel):
    """Paginated comment list (oldest first, limit/offset)."""

    model_config = ConfigDict(extra="forbid")

    items: list[TaskCommentRead]
    total: int
    limit: int
    offset: int
