"""Step 8b schemas: mentorship requests and engagements.

Split strictly into Create / Update / Read (AGENTS.md section 4). The
server owns every field the client must not set:

- ``status`` — moved only by the transition endpoints, never a body field.
- ``mentor_id`` — derived from the mentor profile the request targets.
- ``startup_org_id`` — taken from the path and membership-checked.
- ``fit_score``, ``health`` — reserved/derived (8b plan D-4).
- ``last_session_at`` / ``next_session_at`` — derived from 8d sessions.
- ``started_on`` / ``ended_on`` — stamped by the accept and end handlers.
- ``created_at`` / ``updated_at`` / ``deleted_at``.

Mass-assignment tests assert that sending any of these is a silent no-op
(Pydantic ignores unknown keys) rather than a write.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.mentorship import MentorshipStatus
from app.models.startup import StartupStage

# Bounds applied in one place so the create and update schemas cannot drift.
GOAL_MAX = 500
NEED_ITEM_MAX = 50
NEEDS_MAX = 10
TERMS_MAX = 2000
CADENCE_MAX = 32
CURRENCY_PATTERN = r"^[A-Z]{3}$"


def _clean_list(values: list[str], *, item_max: int, limit: int) -> list[str]:
    """Trim, drop blanks, de-duplicate case-insensitively, enforce bounds."""
    seen: set[str] = set()
    out: list[str] = []
    for raw in values:
        item = raw.strip()
        if not item:
            continue
        if len(item) > item_max:
            raise ValueError(f"Each item must be {item_max} characters or fewer.")
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    if len(out) > limit:
        raise ValueError(f"At most {limit} items are allowed.")
    return out


class MentorshipCreate(BaseModel):
    """A startup asks a mentor to work with them."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    mentor_id: uuid.UUID | None = Field(default=None, description="The mentor user id to request.")
    mentor_handle: str | None = Field(default=None, max_length=64, description="The mentor public handle.")
    goal: str = Field(min_length=10, max_length=GOAL_MAX)
    needs: list[str] = Field(default_factory=list)
    cadence: str | None = Field(default=None, max_length=CADENCE_MAX)
    terms: str | None = Field(default=None, max_length=TERMS_MAX)
    equity_pct: Decimal | None = Field(default=None, ge=0, le=100)
    fee_amount: Decimal | None = Field(default=None, ge=0, le=Decimal("999999999999.99"))
    currency: str = Field(default="INR", pattern=CURRENCY_PATTERN)

    @model_validator(mode="after")
    def _validate_target(self) -> "MentorshipCreate":
        if self.mentor_id is None and not self.mentor_handle:
            raise ValueError("Either mentor_id or mentor_handle must be provided.")
        return self

    _needs = field_validator("needs")(  # type: ignore[assignment]
        lambda cls, v: _clean_list(v, item_max=NEED_ITEM_MAX, limit=NEEDS_MAX)
    )


class MentorshipUpdate(BaseModel):
    """The startup revises its own request before the mentor answers.

    Deliberately absent: ``status``, ``mentor_id``, ``startup_org_id``,
    ``health``, ``fit_score`` and the session timestamps.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    goal: str | None = Field(default=None, min_length=10, max_length=GOAL_MAX)
    needs: list[str] | None = None
    cadence: str | None = Field(default=None, max_length=CADENCE_MAX)
    terms: str | None = Field(default=None, max_length=TERMS_MAX)
    equity_pct: Decimal | None = Field(default=None, ge=0, le=100)
    fee_amount: Decimal | None = Field(default=None, ge=0, le=Decimal("999999999999.99"))
    currency: str | None = Field(default=None, pattern=CURRENCY_PATTERN)

    @field_validator("needs")
    @classmethod
    def _clean_needs(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        return _clean_list(v, item_max=NEED_ITEM_MAX, limit=NEEDS_MAX)


class MentorshipEnd(BaseModel):
    """Close an engagement. ``reason`` is free text kept in ``terms`` history."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    reason: str | None = Field(default=None, max_length=TERMS_MAX)


class MentorshipParticipant(BaseModel):
    """The minimal identity of the other party on a mentorship.

    ``stage`` / ``sector`` / ``city`` / ``tagline`` are the startup profile
    facts the mentor's request and startup cards already render. They are
    read-only pass-throughs from ``startup_profiles`` + ``organizations``
    and are null for the mentor side, whose identity is a person, not a
    company. Without them the cards would have to fake the values.
    """

    user_id: uuid.UUID
    display_name: str
    handle: str | None = None
    avatar_initials: str | None = None
    # Startup-only; None on the mentor participant.
    stage: StartupStage | None = None
    sector: str | None = None
    city: str | None = None
    tagline: str | None = None


class MentorshipRead(BaseModel):
    """One mentorship. ``viewer_side`` tells the UI which buttons to show."""

    id: uuid.UUID
    status: MentorshipStatus
    mentor_id: uuid.UUID
    startup_org_id: uuid.UUID
    goal: str | None
    needs: list[str]
    cadence: str | None
    terms: str | None
    equity_pct: Decimal | None
    fee_amount: Decimal | None
    currency: str
    health: str | None
    started_on: date | None
    ended_on: date | None
    last_session_at: datetime | None
    next_session_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # Denormalised for the two list pages, so neither has to join.
    mentor: MentorshipParticipant
    startup: MentorshipParticipant
    viewer_side: Literal["mentor", "startup"]
    viewer_role: Literal["owner", "admin", "member", "viewer"] | None = None


class MentorshipPage(BaseModel):
    items: list[MentorshipRead]
    total: int
    limit: int
    offset: int


class MentorshipStateChange(BaseModel):
    """Shared body for the transition endpoints (all optional)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    note: str | None = Field(default=None, max_length=TERMS_MAX)
