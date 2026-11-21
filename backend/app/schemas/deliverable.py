"""Step 8e schemas: mentor deliverables.

Split strictly into Create / Update / Read (AGENTS.md section 4). Server
owns every field a client must not set, so all of them are ABSENT from the
input schemas and an attempt to send one is a 422 (``extra="forbid"``):

- ``status`` — moved only by the reviewed status transitions in the
  service, so the state machine cannot be bypassed by a field patch;
- ``submitted_at`` / ``reviewed_at`` / ``reviewed_by`` — stamped by the
  submit and review transitions;
- ``mentorship_id`` — from the path and membership-checked;
- ``id``, ``created_at``, ``updated_at``, ``deleted_at``.

``evidence`` is client-writable by the assignee: it is what they produced
(the Step-4 file upload does not exist yet, so it is text).
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.deliverable import DeliverableStatus
from app.schemas.common import clean_text

TITLE_MAX = 200
DESCRIPTION_MAX = 2000
EVIDENCE_MAX = 2000


class DeliverableCreate(BaseModel):
    """A mentor creates and optionally assigns a deliverable."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=TITLE_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    linked_criterion: uuid.UUID | None = None
    owner_id: uuid.UUID | None = Field(
        default=None, description="Must be an active member of the startup."
    )
    due_on: date | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        return cleaned

    @field_validator("description")
    @classmethod
    def _description(cls, v: str | None) -> str | None:
        return clean_text(v, DESCRIPTION_MAX)


class DeliverableUpdate(BaseModel):
    """Field patch.

    Deliberately unconstrained by role here: the SERVICE decides whether the
    caller is the owning mentor (may change anything) or the assignee (may
    only set ``status``/``evidence``). Encoding that split in two schemas
    would duplicate the role lookup at the router, where it does not belong.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=TITLE_MAX)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    linked_criterion: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    due_on: date | None = None
    status: DeliverableStatus | None = None
    evidence: str | None = Field(default=None, max_length=EVIDENCE_MAX)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        if v is None:
            return v
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        return cleaned

    @field_validator("description", "evidence")
    @classmethod
    def _clean(cls, v: str | None) -> str | None:
        return clean_text(v, DESCRIPTION_MAX)

    @field_validator("status")
    @classmethod
    def _no_overdue(cls, v: DeliverableStatus | None) -> DeliverableStatus | None:
        """``overdue`` is derived from ``due_on``, never asserted by a client."""
        if v == DeliverableStatus.overdue:
            raise ValueError("overdue is computed from the due date, not set directly")
        return v


class DeliverableOwner(BaseModel):
    """The assignee, denormalised so a list never joins."""

    user_id: uuid.UUID
    display_name: str
    avatar_initials: str | None = None


class DeliverableRead(BaseModel):
    """One deliverable with the extra context the pages render."""

    id: uuid.UUID
    mentorship_id: uuid.UUID
    title: str
    description: str | None
    status: DeliverableStatus
    evidence: str | None
    due_on: date | None
    # Derived server-side so the UI never re-implements the rule.
    is_overdue: bool
    linked_criterion: uuid.UUID | None
    linked_criterion_title: str | None
    owner: DeliverableOwner | None
    submitted_at: datetime | None
    reviewed_at: datetime | None
    reviewed_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    # Which side the caller is on, and whether they are the assignee: the
    # page renders buttons from these instead of comparing ids in the browser.
    viewer_side: str
    can_edit: bool


class DeliverablePage(BaseModel):
    items: list[DeliverableRead]
    total: int
    limit: int
    offset: int


__all__ = [
    "DeliverableCreate",
    "DeliverableOwner",
    "DeliverablePage",
    "DeliverableRead",
    "DeliverableUpdate",
]
