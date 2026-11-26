"""7j talent-sourcing Pydantic schemas (input validation, never DB truth).

Conventions from the 7g-7i schemas: ``extra="forbid"`` on inputs
(mass-assignment guard), bounded strings, and page envelopes.

Privacy contract (7j plan, approved): search results and shortlist
member cards expose ONLY user_id, display_name, avatar_initials,
headline, current_location, total_experience_yrs, availability,
preferred_mode and skills. Never email, phone, salary_expectation,
summary, handle, avatar_url or the visibility flags — those stay on the
self-profile and public-profile routes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _clean(value: object) -> object:
    if isinstance(value, str):
        return " ".join(value.split())
    return value


class TalentCard(BaseModel):
    """One search result / shortlist member card — the approved field
    set only (see module docstring)."""

    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    display_name: str
    avatar_initials: str | None = None
    headline: str | None = None
    current_location: str | None = None
    total_experience_yrs: float | None = None
    availability: str
    preferred_mode: str | None = None
    skills: list[str] = []


class TalentSearchPage(BaseModel):
    items: list[TalentCard]
    total: int
    limit: int
    offset: int
    has_more: bool


class ShortlistCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=120)]

    @field_validator("name", mode="before")
    @classmethod
    def clean_name(cls, value: object) -> object:
        value = _clean(value)
        if isinstance(value, str) and not value:
            raise ValueError("Name cannot be blank.")
        return value


class ShortlistUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=120)]

    @field_validator("name", mode="before")
    @classmethod
    def clean_name(cls, value: object) -> object:
        value = _clean(value)
        if isinstance(value, str) and not value:
            raise ValueError("Name cannot be blank.")
        return value


class ShortlistRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    org_id: UUID
    name: str
    member_count: int
    created_by: UUID | None = None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ShortlistPage(BaseModel):
    items: list[ShortlistRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class ShortlistDetail(ShortlistRead):
    """List card plus its (privacy-gated) member cards."""

    members: list[TalentCard] = []


class ShortlistMemberAdd(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID


class OutreachCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_user_id: UUID
    job_id: UUID
    note: Annotated[str | None, Field(max_length=2000)] = None

    @field_validator("note", mode="before")
    @classmethod
    def clean_note(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class OutreachBulkCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shortlist_id: UUID
    job_id: UUID
    note: Annotated[str | None, Field(max_length=2000)] = None

    @field_validator("note", mode="before")
    @classmethod
    def clean_note(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class OutreachRead(BaseModel):
    """History row; ``status`` is derived from job_applications at read
    time (pending -> applied), never stored."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    org_id: UUID
    candidate_user_id: UUID
    candidate_name: str
    # Phase-B GAP: projected only while the candidate still passes the
    # privacy gate (None otherwise).
    candidate_headline: str | None = None
    job_id: UUID
    job_title: str
    note: str | None = None
    status: Literal["pending", "applied"]
    sent_by: UUID | None = None
    sent_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class OutreachPage(BaseModel):
    """History plus the sender's live daily budget (read from the DB)."""

    items: list[OutreachRead]
    total: int
    limit: int
    offset: int
    has_more: bool
    # Phase-B GAP: org-wide count of invitations whose candidate applied.
    applied_total: int = 0
    daily_limit: int
    daily_used: int


class OutreachBulkResult(BaseModel):
    invited: int
    skipped: int


class CandidateInvitationRead(BaseModel):
    """Jobseeker view of an employer's invitation to apply."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    job_id: UUID
    job_title: str
    job_department: str | None = None
    job_work_mode: str | None = None
    job_location: str | None = None
    org_id: UUID
    org_name: str
    org_logo_file_id: UUID | None = None
    inviter_name: str | None = None
    note: str | None = None
    created_at: datetime
    applied: bool = False
    application_id: UUID | None = None


class CandidateInvitationPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CandidateInvitationRead]
    total: int
    limit: int
    offset: int
    has_more: bool

