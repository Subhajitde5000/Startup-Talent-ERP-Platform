"""Step 7h schemas: hires, onboarding templates/items, hire documents.

Strict Create / Update / Read split (AGENTS.md sections 4-5). Server-owned
fields are ABSENT from every input schema, so ``extra="forbid"`` turns an
attempt to set them into a 422 — ``id``/``application_id``/``org_id``/
``user_id``/``offer_id`` on hires, ``is_platform``/``org_id`` on
templates, ``id``/``template_id``/``display_order`` on template items,
``id``/``hire_id``/``requested_by`` and the *initial* status on hire
documents (plan: initial document status is server-owned; status changes
go through ``HireDocumentUpdate``), the section/title snapshots on
per-hire checklist rows, and all timestamps.

Cross-org payload references (``template_id``, ``manager_id``,
``owner_id``, ``file_id``) are validated by the service against the
authorized organization and surface as 422 with ``loc: [body, field]``.
"""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.hire import HireDocumentStatus, HireStatus, OnboardingItemStatus
from app.models.organization import Department
from app.schemas.common import clean_text

NAME_MAX = 120
DOC_NAME_MAX = 255
SECTION_MAX = 80
ITEM_TITLE_MAX = 255
NOTE_MAX = 2000
MAX_TEMPLATE_ITEMS = 100
DUE_OFFSET_MIN = -365
DUE_OFFSET_MAX = 3650

OwnerRole = Literal["owner", "admin", "member", "viewer"]


def _blank_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


class HireCreate(BaseModel):
    """Turn an accepted offer into a hire (plan D12 defaults)."""

    model_config = ConfigDict(extra="forbid")

    template_id: uuid.UUID | None = None
    start_date: date | None = None  # default: the offer's start date
    department: Department | None = None  # default: the job's department
    manager_id: uuid.UUID | None = None  # default: job owner, else caller
    owner_id: uuid.UUID | None = None  # default: job owner, else caller


class HireUpdate(BaseModel):
    """Editable hire fields; lifecycle moves through ``status``."""

    model_config = ConfigDict(extra="forbid")

    department: Department | None = None
    manager_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    start_date: date | None = None
    status: HireStatus | None = None


class HireRead(BaseModel):
    """Employer hire view.

    Display projections (frontend wiring, plan G5/G6): ``job_title`` from
    the application's job, plus onboarding checklist counts so the hire
    list can render progress without one request per hire.
    """

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    offer_id: uuid.UUID | None
    org_id: uuid.UUID
    user_id: uuid.UUID
    name: str  # derived from the users row (read-only projection)
    email: str
    job_title: str | None
    department: Department | None
    manager_id: uuid.UUID | None
    owner_id: uuid.UUID | None
    start_date: date
    status: HireStatus
    checklist_total: int
    checklist_done: int
    created_at: datetime
    updated_at: datetime


class HirePage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[HireRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class OnboardingItemRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    section: str
    title: str
    owner_id: uuid.UUID | None
    due_on: date | None
    status: OnboardingItemStatus
    note: str | None
    created_at: datetime
    updated_at: datetime


class OnboardingItemPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[OnboardingItemRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class OnboardingItemUpdate(BaseModel):
    """section/title are template snapshots — never client-writable."""

    model_config = ConfigDict(extra="forbid")

    owner_id: uuid.UUID | None = None
    due_on: date | None = None
    status: OnboardingItemStatus | None = None
    note: str | None = Field(default=None, max_length=NOTE_MAX)

    @field_validator("note", mode="before")
    @classmethod
    def clean_note(cls, value: object) -> object:
        if isinstance(value, str):
            return clean_text(value, NOTE_MAX)
        return value


class HireDocumentCreate(BaseModel):
    """Request a hire document (plan D13: employer attaches Step 4 files)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=DOC_NAME_MAX)
    purpose: str | None = Field(default=None, max_length=80)
    retention: str | None = Field(default=None, max_length=80)
    due_on: date | None = None
    file_id: uuid.UUID | None = None

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("must not be blank")
            if len(cleaned) > DOC_NAME_MAX:
                raise ValueError(f"must be at most {DOC_NAME_MAX} characters")
            return cleaned
        return value

    @field_validator("purpose", "retention", mode="before")
    @classmethod
    def clean_optional(cls, value: object) -> object:
        return _blank_to_none(value)


class HireDocumentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=DOC_NAME_MAX)
    purpose: str | None = Field(default=None, max_length=80)
    retention: str | None = Field(default=None, max_length=80)
    due_on: date | None = None
    status: HireDocumentStatus | None = None
    file_id: uuid.UUID | None = None

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("must not be blank")
            if len(cleaned) > DOC_NAME_MAX:
                raise ValueError(f"must be at most {DOC_NAME_MAX} characters")
            return cleaned
        return value

    @field_validator("purpose", "retention", mode="before")
    @classmethod
    def clean_optional(cls, value: object) -> object:
        return _blank_to_none(value)


class HireDocumentRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    hire_id: uuid.UUID
    file_id: uuid.UUID | None
    name: str
    purpose: str | None
    retention: str | None
    status: HireDocumentStatus
    due_on: date | None
    requested_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class HireDocumentPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[HireDocumentRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class TemplateItemCreate(BaseModel):
    """One checklist row; ``display_order`` is the list position (server)."""

    model_config = ConfigDict(extra="forbid")

    section: str = Field(min_length=1, max_length=SECTION_MAX)
    title: str = Field(min_length=1, max_length=ITEM_TITLE_MAX)
    owner_role: OwnerRole | None = None
    due_offset_days: int | None = Field(
        default=None, ge=DUE_OFFSET_MIN, le=DUE_OFFSET_MAX
    )

    @field_validator("section", "title", mode="before")
    @classmethod
    def trim_text(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("must not be blank")
            return cleaned
        return value


class TemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=NAME_MAX)
    items: list[TemplateItemCreate] = Field(
        default_factory=list, max_length=MAX_TEMPLATE_ITEMS
    )

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("must not be blank")
            if len(cleaned) > NAME_MAX:
                raise ValueError(f"must be at most {NAME_MAX} characters")
            return cleaned
        return value


class TemplateUpdate(BaseModel):
    """Partial edit; a provided ``items`` list replaces the whole set."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=NAME_MAX)
    items: list[TemplateItemCreate] | None = Field(
        default=None, max_length=MAX_TEMPLATE_ITEMS
    )

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("must not be blank")
            if len(cleaned) > NAME_MAX:
                raise ValueError(f"must be at most {NAME_MAX} characters")
            return cleaned
        return value


class TemplateItemRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    section: str
    title: str
    owner_role: str | None
    due_offset_days: int | None
    display_order: int


class TemplateRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID | None
    name: str
    is_platform: bool
    items: list[TemplateItemRead]
    created_at: datetime
    updated_at: datetime


class TemplatePage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TemplateRead]
    total: int
    limit: int
    offset: int
    has_more: bool


__all__ = [
    "HireCreate",
    "HireUpdate",
    "HireRead",
    "HirePage",
    "OnboardingItemRead",
    "OnboardingItemPage",
    "OnboardingItemUpdate",
    "HireDocumentCreate",
    "HireDocumentUpdate",
    "HireDocumentRead",
    "HireDocumentPage",
    "TemplateItemCreate",
    "TemplateCreate",
    "TemplateUpdate",
    "TemplateItemRead",
    "TemplateRead",
    "TemplatePage",
]
