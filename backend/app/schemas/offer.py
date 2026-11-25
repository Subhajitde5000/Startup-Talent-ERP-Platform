"""Step 7g schemas: job offers, decline reasons and candidate views.

Strict Create / Update / Read split (AGENTS.md sections 4-5). Server-owned
fields are ABSENT from every input schema, so ``extra="forbid"`` turns an
attempt to set them into a 422 — ``id``/``application_id``/``job_id``,
``status``, ``responded_at``, ``decline_reason_id`` on create (only the
decline endpoint sets it, with its own body), and all timestamps.
``OfferUpdate`` is deliberately all-optional: the service applies only
the fields present (``model_fields_set``) and only while the offer is a
draft — except ``expires_on``, which is the one field that may be
extended on a sent/countered offer (plan D3).

Money and equity reuse the Step 7a annotated types (never float);
currency is ISO-4217, normalised to upper case with a pattern check.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.offer import JobOfferStatus
from app.schemas.job import Equity, Money

TITLE_MAX = 255
CURRENCY_PATTERN = r"^[A-Z]{3}$"


class OfferCreate(BaseModel):
    """Draft offer body (posted under one application)."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=TITLE_MAX)
    base_salary: Money
    bonus_amount: Money | None = None
    equity_pct: Equity | None = None
    joining_bonus: Money | None = None
    currency: str = Field(default="INR", pattern=CURRENCY_PATTERN)
    start_date: date
    expires_on: date | None = None
    owner_id: uuid.UUID | None = None
    document_file_id: uuid.UUID | None = None

    @field_validator("title", mode="before")
    @classmethod
    def trim_title(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("must not be blank")
            if len(cleaned) > TITLE_MAX:
                raise ValueError(f"must be at most {TITLE_MAX} characters")
            return cleaned
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator(
        "base_salary", "bonus_amount", "joining_bonus", mode="before"
    )
    @classmethod
    def coerce_money(cls, value: object) -> object:
        # JSON numbers arrive as float; quantise to paise without binary noise.
        if isinstance(value, float):
            return Decimal(str(value)).quantize(Decimal("0.01"))
        return value


class OfferUpdate(BaseModel):
    """Partial edit: full content while draft; only ``expires_on`` after send."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=TITLE_MAX)
    base_salary: Money | None = None
    bonus_amount: Money | None = None
    equity_pct: Equity | None = None
    joining_bonus: Money | None = None
    currency: str | None = Field(default=None, pattern=CURRENCY_PATTERN)
    start_date: date | None = None
    expires_on: date | None = None
    owner_id: uuid.UUID | None = None
    document_file_id: uuid.UUID | None = None

    @field_validator("title", mode="before")
    @classmethod
    def trim_title(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("must not be blank")
            if len(cleaned) > TITLE_MAX:
                raise ValueError(f"must be at most {TITLE_MAX} characters")
            return cleaned
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator(
        "base_salary", "bonus_amount", "joining_bonus", mode="before"
    )
    @classmethod
    def coerce_money(cls, value: object) -> object:
        if isinstance(value, float):
            return Decimal(str(value)).quantize(Decimal("0.01"))
        return value


class OfferDecline(BaseModel):
    """Candidate decline body: a seeded reason only, no free text (plan D5)."""

    model_config = ConfigDict(extra="forbid")

    decline_reason_id: uuid.UUID


class OfferRead(BaseModel):
    """Employer and candidate view of one offer (same terms both sides).

    Display projections (frontend wiring, plan G1): ``job_title`` and
    ``company_name`` are always present; ``candidate_name`` is ``None``
    while the application is blind (never leak a masked identity) and
    ``owner_name`` is ``None`` for an owner-less or deleted user row.
    """

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    job_id: uuid.UUID
    title: str
    job_title: str
    company_name: str
    candidate_name: str | None
    owner_name: str | None
    base_salary: Decimal | None
    bonus_amount: Decimal | None
    equity_pct: Decimal | None
    joining_bonus: Decimal | None
    currency: str
    start_date: date | None
    expires_on: date | None
    status: JobOfferStatus
    owner_id: uuid.UUID | None
    document_file_id: uuid.UUID | None
    responded_at: datetime | None
    decline_reason_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class OfferPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[OfferRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class OfferDeclineReasonRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    code: str
    label: str


__all__ = [
    "OfferCreate",
    "OfferUpdate",
    "OfferDecline",
    "OfferRead",
    "OfferPage",
    "OfferDeclineReasonRead",
]
