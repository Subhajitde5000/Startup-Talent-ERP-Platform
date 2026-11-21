"""Funding round schemas (Step 9a).

Strict, server-controlled shapes (AGENTS.md section 3):

- ``Create`` and ``Update`` are ``extra="forbid"``: sending a field the
  caller may not set is a 422, never a silent ignore (mass-assignment
  guard). In particular ``committed_amount``, ``status``, ``id``,
  ``org_id`` and the timestamps are absent from both input shapes —
  ``committed_amount`` is server-only (starts at 0, only 9i/9j write it)
  and ``status`` changes only through the transition endpoint (plan D1).
- Money is ``Decimal`` (``NUMERIC(14,2)`` in the table) and serializes as
  a decimal string by pydantic v2's ``Decimal`` encoder, never a float
  (the 5e ``MetricRead`` pattern).
- ``currency`` is a 3-letter ISO-4217 code, uppercased on input.
- ``Read`` computes ``remaining_amount`` / ``progress_pct`` in the
  service (derived, never stored, never writable).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.funding_round import FundingRoundType, InstrumentType, RoundStatus

# schema.sql names "target_amount" as nullable: a round may be recorded
# before a target is agreed, so it is optional (but > 0 when present).
_Money = Field(default=None, max_digits=14, decimal_places=2)


def _clean_name(value: str) -> str:
    """Strip and reject blanks (mirrors the organizations name rule)."""
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Round name is required.")
    return cleaned


class FundingRoundCreate(BaseModel):
    """A new round. ``committed_amount`` starts at 0 (server-set)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    round_type: FundingRoundType
    target_amount: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)
    currency: str = Field(default="INR", max_length=3)
    pre_money_valuation: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)
    instrument: InstrumentType | None = None
    opens_on: date | None = None
    closes_on: date | None = None
    min_raise: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)
    min_ticket: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)

    _validate_name = field_validator("name")(_clean_name)

    @field_validator("currency", mode="before")
    @classmethod
    def _clean_currency(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("target_amount")
    @classmethod
    def _target_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("Target amount must be greater than 0 when set.")
        return value

    @field_validator("pre_money_valuation")
    @classmethod
    def _valuation_non_negative(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value < 0:
            raise ValueError("Pre-money valuation must not be negative.")
        return value

    @field_validator("min_raise", "min_ticket")
    @classmethod
    def _minimums_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("Minimums must be greater than 0 when set.")
        return value

    @model_validator(mode="after")
    def _dates_ordered(self) -> "FundingRoundCreate":
        if self.opens_on and self.closes_on and self.closes_on < self.opens_on:
            raise ValueError("Closing date must not be before the opening date.")
        return self


class FundingRoundUpdate(BaseModel):
    """Editable fields. ``status`` and ``committed_amount`` stay out."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    round_type: FundingRoundType | None = None
    target_amount: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, max_length=3)
    pre_money_valuation: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)
    instrument: InstrumentType | None = None
    opens_on: date | None = None
    closes_on: date | None = None
    min_raise: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)
    min_ticket: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)

    _validate_name = field_validator("name")(_clean_name)

    @field_validator("currency", mode="before")
    @classmethod
    def _clean_currency(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else None

    @field_validator("target_amount")
    @classmethod
    def _target_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("Target amount must be greater than 0 when set.")
        return value

    @field_validator("pre_money_valuation")
    @classmethod
    def _valuation_non_negative(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value < 0:
            raise ValueError("Pre-money valuation must not be negative.")
        return value

    @field_validator("min_raise", "min_ticket")
    @classmethod
    def _minimums_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("Minimums must be greater than 0 when set.")
        return value

    @model_validator(mode="after")
    def _dates_ordered(self) -> "FundingRoundUpdate":
        # Re-check the ordered rule when both are being (re)set: the
        # patch is exclude_unset, but re-validating the final values on
        # the model keeps the rule honest if both fields are sent.
        if self.opens_on and self.closes_on and self.closes_on < self.opens_on:
            raise ValueError("Closing date must not be before the opening date.")
        return self


class StatusTransition(BaseModel):
    """``POST …/status``: the only way ``status`` changes (plan D1)."""

    model_config = ConfigDict(extra="forbid")

    status: RoundStatus


class FundingRoundRead(BaseModel):
    """A round as returned by the API. Derived fields are read-only."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    round_type: FundingRoundType
    target_amount: Decimal | None
    committed_amount: Decimal
    currency: str
    pre_money_valuation: Decimal | None
    instrument: InstrumentType | None
    status: RoundStatus
    opens_on: date | None
    closes_on: date | None
    min_raise: Decimal | None
    min_ticket: Decimal | None
    remaining_amount: Decimal | None
    progress_pct: Decimal | None
    created_at: datetime
    updated_at: datetime


class FundingRoundPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[FundingRoundRead]
    total: int
    limit: int
    offset: int
    has_more: bool


class FundingRoundSummary(BaseModel):
    """Org-level roll-up for the ``/startup/rounds`` header.

    One aggregate query in the service — no N+1. Money is a decimal
    string; a total with no rounds is 0 (the list is simply empty).
    """

    model_config = ConfigDict(extra="forbid")

    total_target: Decimal
    total_committed: Decimal
    currency: str
    open_rounds: int
    by_status: dict[str, int]


__all__ = [
    "FundingRoundCreate",
    "FundingRoundPage",
    "FundingRoundRead",
    "FundingRoundSummary",
    "FundingRoundUpdate",
    "StatusTransition",
]
