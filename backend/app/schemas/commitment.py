"""Commitment and portfolio-holding schemas (Step 9j).

Strict ``extra="forbid"`` Create/Update/Status schemas (AGENTS.md
section 7): server-controlled fields (``id``, ``investor_org_id``,
``round_id`` context, ``status``, ``created_at``, ``updated_at``) are
never inputs. Status changes only happen through the dedicated
transition endpoint (BUILD_PLAN 9i/9j note: "Statuses change only
through the defined transitions, never by a free-form update").

Money: ``NUMERIC(14,2)`` -> ``Decimal`` with ``decimal_places=2``;
``ownership_pct`` is ``NUMERIC(6,4)`` -> ``Decimal`` 0-100.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.commitment import CommitmentStatus

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


class CommitmentCreate(BaseModel):
    """Create a commitment (status starts ``pledged``).

    ``investor_org_id`` is the caller's own firm (resolved server-side
    from membership), never an input. ``offer_id``, if given, must be
    an offer of this firm on the same round (validated in the service).
    """

    model_config = ConfigDict(extra="forbid")

    round_id: uuid.UUID
    offer_id: uuid.UUID | None = None
    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="INR", max_length=3)
    committed_on: date | None = None
    reference: str | None = None


class CommitmentUpdate(BaseModel):
    """Editable commitment fields (PATCH). ``status`` is NOT writable —
    transitions go through the dedicated endpoint."""

    model_config = ConfigDict(extra="forbid")

    reference: str | None = None
    committed_on: date | None = None


class CommitmentStatusUpdate(BaseModel):
    """Target status for the transition endpoint."""

    model_config = ConfigDict(extra="forbid")

    status: CommitmentStatus


class CommitmentRead(BaseModel):
    """Full commitment as the investor sees it (with startup + round
    snapshot)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    round_id: uuid.UUID
    offer_id: uuid.UUID | None
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
    status: CommitmentStatus
    committed_on: date | None
    funded_on: date | None
    wired_at: datetime | None
    reference: str | None
    created_at: datetime
    updated_at: datetime


class CommitmentPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CommitmentRead]
    total: int
    limit: int
    offset: int


class HoldingCreate(BaseModel):
    """Create a portfolio holding (status starts ``active``).

    ``investor_org_id`` is the caller's own firm (resolved server-side
    from membership), never an input. ``startup_org_id`` must be a live
    startup that is not the investor itself (validated in the service,
    plus the ``investor_org_id <> startup_org_id`` CHECK).
    """

    model_config = ConfigDict(extra="forbid")

    startup_org_id: uuid.UUID
    commitment_id: uuid.UUID | None = None
    instrument: str
    invested_amount: Decimal = Field(ge=0, decimal_places=2)
    currency: str = Field(default="INR", max_length=3)
    ownership_pct: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=4)
    invested_on: date | None = None

    _instrument_valid = field_validator("instrument")(_check_instrument)


class HoldingUpdate(BaseModel):
    """Editable holding fields (PATCH). ``status`` is NOT writable —
    transitions go through the dedicated endpoint."""

    model_config = ConfigDict(extra="forbid")

    instrument: str | None = None
    invested_amount: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str | None = Field(default=None, max_length=3)
    ownership_pct: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=4)
    invested_on: date | None = None

    _instrument_valid = field_validator("instrument")(_check_instrument)


class HoldingStatusUpdate(BaseModel):
    """Target status for the transition endpoint. Exit transitions may
    carry the exit date and value."""

    model_config = ConfigDict(extra="forbid")

    status: str
    exited_on: date | None = None
    exit_value: Decimal | None = Field(default=None, decimal_places=2)


class HoldingRead(BaseModel):
    """Full holding as the investor sees it (with startup snapshot and
    the linked commitment's round)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    investor_org_id: uuid.UUID
    startup_org_id: uuid.UUID
    startup_name: str
    startup_slug: str
    startup_logo_initials: str | None
    startup_logo_url: str | None
    startup_sector: str | None
    startup_tagline: str | None
    commitment_id: uuid.UUID | None
    instrument: str
    invested_amount: Decimal
    currency: str
    ownership_pct: Decimal | None
    invested_on: date | None
    status: str
    exited_on: date | None
    exit_value: Decimal | None
    created_at: datetime
    updated_at: datetime


class HoldingPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[HoldingRead]
    total: int
    limit: int
    offset: int


__all__ = [
    "CommitmentCreate",
    "CommitmentPage",
    "CommitmentRead",
    "CommitmentStatusUpdate",
    "CommitmentUpdate",
    "HoldingCreate",
    "HoldingPage",
    "HoldingRead",
    "HoldingStatusUpdate",
    "HoldingUpdate",
]
