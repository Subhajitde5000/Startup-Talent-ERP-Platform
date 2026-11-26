"""7i hiring-request Pydantic schemas (input validation, never DB truth).

Conventions copied from :mod:`app.schemas.offer` (7g) and
:mod:`app.schemas.hire` (7h): ``extra="forbid"`` everywhere (mass-assignment
guard), ``clean_text`` whitespace normalization, a ``Page`` for list
responses, and Money as a bounded ``Decimal`` (NUMERIC(14,2)).

Server-controlled columns never appear on Create/Update: ``id``, ``org_id``,
``requested_by``, ``status`` as a free value, ``created_at``, ``updated_at``,
``job_id``. Status moves through two typed intents instead — ``submit`` on
create and ``status`` on PATCH limited to the literals a caller may request;
the service decides whether the transition is legal from the current state.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.hiring_request import HiringRequestUrgency, HiringRequestWhyNow
from app.schemas.job import Department, EmploymentType, WorkMode

# Money: NUMERIC(14,2) -> Decimal with decimal_places=2; serialised as a
# decimal string by pydantic v2 (same as job.salary_*).
Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False)]


def clean_text(value: str) -> str:
    """Collapse internal whitespace runs and strip the ends."""
    return " ".join(value.split())


class _RequestValidation(BaseModel):
    """Shared: no floating-point money (7a job Money convention) — use a
    decimal string or integer."""

    model_config = ConfigDict(extra="forbid")

    @field_validator("role_title", mode="before", check_fields=False)
    @classmethod
    def clean_role_title(cls, value: object) -> object:
        """Collapse whitespace first so a whitespace-only title fails
        min_length instead of reaching the DB blank."""
        if isinstance(value, str):
            value = " ".join(value.split())
            if not value:
                raise ValueError("Role title cannot be blank.")
        return value

    @field_validator("budget_amount", mode="before", check_fields=False)
    @classmethod
    def no_float_money(cls, value: object) -> object:
        if isinstance(value, (float, bool)):
            raise ValueError("Use a decimal string or integer, not a floating-point number.")
        return value

    @field_validator("justification", mode="before", check_fields=False)
    @classmethod
    def clean_justification(cls, value: object) -> object:
        """Trim the ends; a whitespace-only justification is stored NULL."""
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("skills", mode="after", check_fields=False)
    @classmethod
    def clean_skills(cls, value: list[str] | None) -> list[str] | None:
        """Whitespace-collapse each name, drop blanks and case-insensitive
        duplicates (first spelling wins) — the catalogue is case-insensitive."""
        if value is None:
            return None
        out: list[str] = []
        seen: set[str] = set()
        for raw in value:
            name = clean_text(raw)
            if name and name.lower() not in seen:
                seen.add(name.lower())
                out.append(name)
        return out


# GAP fields (migration 0046) shared by create and update.
SkillName = Annotated[str, Field(min_length=1, max_length=80)]
Skills = Annotated[list[SkillName], Field(max_length=20)]
Justification = Annotated[str, Field(max_length=2000)]


class HiringRequestCreate(_RequestValidation):
    """POST /organizations/{org_id}/hiring-requests.

    ``submit`` is the lifecycle intent: true creates the row as pending,
    false (default) as draft — the service sets status either way, the
    client never sends one. ``approver_id`` may only be written by an
    owner/admin (service-enforced).
    """

    role_title: Annotated[str, Field(min_length=1, max_length=160)]
    department: Department | None = None
    headcount: Annotated[int, Field(default=1, ge=1, le=100)] = 1
    urgency: HiringRequestUrgency = HiringRequestUrgency.normal
    target_start: date | None = None
    budget_amount: Money | None = None
    currency: Annotated[str, Field(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")] = "INR"
    approver_id: UUID | None = None
    employment_type: EmploymentType = EmploymentType.full_time
    work_mode: WorkMode = WorkMode.onsite
    hiring_manager_id: UUID | None = None
    skills: Skills = []
    why_now: HiringRequestWhyNow | None = None
    justification: Justification | None = None
    submit: bool = False


class HiringRequestUpdate(_RequestValidation):
    """PATCH /hiring-requests/{id} — content while draft/pending, plus the
    two status intents (submit: draft -> pending; cancel: draft|pending ->
    cancelled). Anything else is a 422 (Literal) or 409 (wrong state)."""

    role_title: Annotated[str | None, Field(min_length=1, max_length=160)] = None
    department: Department | None = None
    headcount: Annotated[int | None, Field(ge=1, le=100)] = None
    urgency: HiringRequestUrgency | None = None
    target_start: date | None = None
    budget_amount: Money | None = None
    currency: Annotated[str | None, Field(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")] = None
    approver_id: UUID | None = None
    employment_type: EmploymentType | None = None
    work_mode: WorkMode | None = None
    hiring_manager_id: UUID | None = None
    skills: Skills | None = None
    why_now: HiringRequestWhyNow | None = None
    justification: Justification | None = None
    # Lifecycle intents only — never "approved"/"fulfilled"/... here.
    status: Literal["pending", "cancelled"] | None = None


class HiringRequestRead(BaseModel):
    """Row plus read-only projections: actor display names (7h pattern,
    so list rows don't N+1) and ``job_id`` — the id of the job this request
    converted into (NULL until convert)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    role_title: str
    department: str | None = None
    headcount: int
    urgency: str
    requested_by: UUID | None = None
    requested_by_name: str | None = None
    approver_id: UUID | None = None
    approver_name: str | None = None
    target_start: date | None = None
    budget_amount: Decimal | None = None
    currency: str
    employment_type: str
    work_mode: str
    hiring_manager_id: UUID | None = None
    hiring_manager_name: str | None = None
    skills: list[str] = []
    why_now: str | None = None
    justification: str | None = None
    status: str
    job_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class HiringRequestPage(BaseModel):
    """Same shape as JobPage / OfferPage / HirePage (7a-7h)."""

    items: list[HiringRequestRead]
    total: int
    limit: int
    offset: int
    has_more: bool
