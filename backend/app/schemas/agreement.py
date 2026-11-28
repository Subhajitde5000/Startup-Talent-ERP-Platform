"""Step 8g schemas: mentor agreements.

Create / Update / Read are separate (AGENTS.md section 4). Every field the
server owns is ABSENT from the input schemas, so sending one is a 422
(``extra="forbid"``): ``id``, ``mentorship_id`` (from the path),
``version``, ``previous_version_id``, ``proposed_by_side``, ``created_by``,
``status``, ``sent_at``, both ``*_signed_at``, ``startup_signed_by``,
``ended_at``, ``ended_by``, ``end_reason`` (only via terminate), and the
timestamps.

Money is ``Decimal`` with at most 14 digits / 2 places — never float.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.agreement import (
    REASON_MAX,
    REASON_MIN,
    TERMS_MAX,
    AgreementCadence,
    AgreementSide,
    AgreementStatus,
    AgreementType,
)
from app.schemas.common import clean_text

CURRENCY_PATTERN = r"^[A-Z]{3}$"
TERMINATE_REASON_MIN = 10

Fee = Decimal
_FEE = Field(default=None, gt=0, max_digits=14, decimal_places=2)
_EQUITY = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)


class _Terms(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("terms", check_fields=False)
    @classmethod
    def _terms(cls, v: str | None) -> str | None:
        return clean_text(v, TERMS_MAX)


class AgreementCreate(_Terms):
    """A draft. From version 2 on, ``change_reason`` is required."""

    agreement_type: AgreementType
    fee_amount: Fee | None = _FEE
    currency: str = Field(default="INR", pattern=CURRENCY_PATTERN)
    equity_pct: Decimal | None = _EQUITY
    cadence: AgreementCadence | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    terms: str | None = Field(default=None, max_length=TERMS_MAX)
    change_reason: str | None = Field(
        default=None,
        min_length=REASON_MIN,
        max_length=REASON_MAX,
        description="Required when the mentorship already has a sent or signed version.",
    )


class AgreementUpdate(_Terms):
    """Partial patch of a DRAFT. Omitted keys are left unchanged."""

    agreement_type: AgreementType | None = None
    fee_amount: Fee | None = _FEE
    currency: str | None = Field(default=None, pattern=CURRENCY_PATTERN)
    equity_pct: Decimal | None = _EQUITY
    cadence: AgreementCadence | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    terms: str | None = Field(default=None, max_length=TERMS_MAX)
    change_reason: str | None = Field(default=None, min_length=REASON_MIN, max_length=REASON_MAX)


class AgreementSign(BaseModel):
    """Signing re-checks the caller's password (approved Q4)."""

    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)


class AgreementTerminate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    reason: str = Field(min_length=TERMINATE_REASON_MIN, max_length=REASON_MAX)


class AgreementParty(BaseModel):
    mentor_id: uuid.UUID
    mentor_name: str | None
    startup_org_id: uuid.UUID
    startup_name: str | None


class AgreementLinkedRecords(BaseModel):
    """Derived from completed session records while this version was in force."""

    completed_sessions: int
    billed_amount: Decimal
    currency: str


class AgreementFeeBreakdown(BaseModel):
    """Per-session split using the 8h rates. Mentor-only."""

    gross_amount: Decimal
    commission_amount: Decimal
    tds_amount: Decimal
    net_amount: Decimal
    currency: str


class AgreementRead(BaseModel):
    id: uuid.UUID
    mentorship_id: uuid.UUID
    party: AgreementParty
    version: int | None
    previous_version_id: uuid.UUID | None
    proposed_by_side: AgreementSide
    agreement_type: AgreementType
    terms: str | None
    equity_pct: Decimal | None
    fee_amount: Decimal | None
    currency: str
    cadence: AgreementCadence | None
    status: AgreementStatus
    phase: Literal["scheduled", "active", "expired"] | None = Field(
        description="Derived for signed versions from starts_on/ends_on; null otherwise."
    )
    starts_on: date | None
    ends_on: date | None
    change_reason: str | None
    sent_at: datetime | None
    mentor_signed_at: datetime | None
    startup_signed_at: datetime | None
    startup_signed_by_name: str | None
    ended_at: datetime | None
    end_reason: str | None
    created_at: datetime
    updated_at: datetime
    viewer_side: AgreementSide
    can_edit: bool
    can_sign: bool
    can_terminate: bool


class AgreementDetail(AgreementRead):
    linked_records: AgreementLinkedRecords
    fee_breakdown: AgreementFeeBreakdown | None = Field(
        default=None, description="Mentor only; null for the startup side and pro bono."
    )


class AgreementPage(BaseModel):
    items: list[AgreementRead]
    total: int
    limit: int
    offset: int


class AgreementSummary(BaseModel):
    """The 8j workspace card: what is in force and what is on the table."""

    current: AgreementRead | None
    pending: AgreementRead | None


__all__ = [
    "AgreementCreate",
    "AgreementDetail",
    "AgreementFeeBreakdown",
    "AgreementLinkedRecords",
    "AgreementPage",
    "AgreementParty",
    "AgreementRead",
    "AgreementSign",
    "AgreementSummary",
    "AgreementTerminate",
    "AgreementUpdate",
]
