"""Investor offer schemas (Step 9i).

Strict ``extra="forbid"`` Create/Update/Counter schemas (AGENTS.md
section 7): server-controlled fields (``id``, ``investor_org_id``,
``round_id`` context, ``version``, ``parent_offer_id``, ``status``,
``created_at``, ``updated_at``, ``deleted_at``) are never inputs.
Status changes only happen through the dedicated transition endpoints
(send / counter / withdraw / accept / decline), never a free-form
update (BUILD_PLAN 9i note).

The startup-side read (``StartupOfferRead``) deliberately STRIPS the
investor's private fields — ``notes`` and ``owner_id`` — so a startup
can never see an investor's internal notes through the offer view
(BUILD_PLAN confidentiality rule).

Money: ``NUMERIC(14,2)`` -> ``Decimal`` with ``decimal_places=2`` (the
5e ``MetricRead`` pattern); ``discount_pct`` is 0-100.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.investor_offer import OfferStatus

_INSTRUMENTS = frozenset(
    {"equity", "safe", "convertible_note", "ccd", "ccps", "debt", "other"}
)


def _check_instrument(v: str | None) -> str | None:
    if v is None:
        return v
    if v not in _INSTRUMENTS:
        raise ValueError(
            "instrument must be one of equity, safe, convertible_note, "
            "ccd, ccps, debt, other"
        )
    return v


class InvestorOfferCreate(BaseModel):
    """Create offer version v1 (status ``draft``).

    ``investor_org_id`` is the caller's own firm (resolved server-side
    from membership), never an input. ``owner_id`` must be an active
    member of that firm (validated in the service).
    """

    model_config = ConfigDict(extra="forbid")

    round_id: uuid.UUID
    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="INR", max_length=3)
    instrument: str
    valuation_cap: Decimal | None = Field(default=None, decimal_places=2)
    discount_pct: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    expires_on: date | None = None
    owner_id: uuid.UUID | None = None
    notes: str | None = None

    _instrument_valid = field_validator("instrument")(_check_instrument)


class InvestorOfferUpdate(BaseModel):
    """Editable offer fields (PATCH). ``status``/``version`` are NOT
    writable — transitions go through the dedicated endpoints."""

    model_config = ConfigDict(extra="forbid")

    amount: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    currency: str | None = Field(default=None, max_length=3)
    instrument: str | None = None
    valuation_cap: Decimal | None = Field(default=None, decimal_places=2)
    discount_pct: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    expires_on: date | None = None
    owner_id: uuid.UUID | None = None
    notes: str | None = None

    _instrument_valid = field_validator("instrument")(_check_instrument)


class InvestorOfferCounter(BaseModel):
    """Counter terms for the next offer version (status ``countered``).

    The new row copies ``round_id`` / ``investor_org_id`` from the
    parent, takes ``version`` = parent.version + 1 and
    ``parent_offer_id`` = the parent's id (all server-controlled).
    """

    model_config = ConfigDict(extra="forbid")

    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="INR", max_length=3)
    instrument: str
    valuation_cap: Decimal | None = Field(default=None, decimal_places=2)
    discount_pct: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    expires_on: date | None = None
    owner_id: uuid.UUID | None = None
    notes: str | None = None

    _instrument_valid = field_validator("instrument")(_check_instrument)


class InvestorOfferRead(BaseModel):
    """Full offer version as the investor sees it (with startup + round
    snapshot, so the board renders without a second request)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    round_id: uuid.UUID
    investor_org_id: uuid.UUID
    startup_org_id: uuid.UUID
    startup_name: str
    startup_slug: str
    startup_logo_initials: str | None
    startup_logo_url: str | None
    startup_sector: str | None
    startup_tagline: str | None
    round_target: Decimal | None
    round_currency: str | None
    amount: Decimal
    currency: str
    instrument: str
    valuation_cap: Decimal | None
    discount_pct: Decimal | None
    version: int
    parent_offer_id: uuid.UUID | None
    status: OfferStatus
    expires_on: date | None
    owner_id: uuid.UUID | None
    owner_name: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class InvestorOfferPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InvestorOfferRead]
    total: int
    limit: int
    offset: int


class OfferVersionItem(BaseModel):
    """One version row of an offer's version chain."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    version: int
    amount: Decimal
    currency: str
    instrument: str
    valuation_cap: Decimal | None
    discount_pct: Decimal | None
    status: OfferStatus
    parent_offer_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class OfferHistoryPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[OfferVersionItem]
    total: int
    limit: int
    offset: int


class StartupOfferRead(BaseModel):
    """An offer as the STARTUP sees it: investor-private fields stripped
    (``notes``, ``owner_id``)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    investor_org_id: uuid.UUID
    investor_name: str
    investor_slug: str
    round_id: uuid.UUID
    amount: Decimal
    currency: str
    instrument: str
    valuation_cap: Decimal | None
    discount_pct: Decimal | None
    version: int
    status: OfferStatus
    expires_on: date | None
    created_at: datetime
    updated_at: datetime


class StartupOfferPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[StartupOfferRead]
    total: int
    limit: int
    offset: int


__all__ = [
    "InvestorOfferCreate",
    "InvestorOfferCounter",
    "InvestorOfferPage",
    "InvestorOfferRead",
    "InvestorOfferUpdate",
    "OfferHistoryPage",
    "OfferVersionItem",
    "StartupOfferPage",
    "StartupOfferRead",
]
