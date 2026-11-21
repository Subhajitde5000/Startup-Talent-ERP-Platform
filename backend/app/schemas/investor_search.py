"""Investor search schemas (Step 9d: preferences, saved searches, shortlist).

Strict, server-controlled shapes (AGENTS.md section 3):

- Every Create/Update schema is ``extra="forbid"``: a field the caller
  may not set (``id``, ``investor_org_id``, ``startup_org_id``,
  timestamps) is a 422, never a silent ignore (mass-assignment guard).
- ``criteria`` on a saved search is a whitelisted subset of the 9c
  discovery filters: ``stage``, ``sector``, ``city``, ``q``,
  ``raise_min``, ``raise_max``, ``investment_ready_only``. Unknown keys
  are a 422 so a typo cannot silently store a dead filter.
- Money is ``Decimal`` (``NUMERIC(14,2)`` in the table) and serializes
  as a decimal string, never a float (the 5e ``MetricRead`` pattern).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.investor_search import InvestorType, ShortlistStatus
from app.models.startup import StartupStage

# Whitelisted saved-search criteria keys (the 9c discovery filters).
_CRITERIA_KEYS = frozenset(
    {"stage", "sector", "city", "q", "raise_min", "raise_max", "investment_ready_only"}
)

_MAX_SECTORS = 20
_MAX_SECTOR_LEN = 60
_MAX_STAGES = 10
_MAX_NOTE = 5000


def _clean_name(value: str) -> str:
    """Strip and reject blanks (mirrors the organizations name rule)."""
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Name is required.")
    return cleaned


def _clean_sectors(value: list[str]) -> list[str]:
    cleaned = [s.strip() for s in value if s and s.strip()]
    if len(cleaned) > _MAX_SECTORS:
        raise ValueError(f"At most {_MAX_SECTORS} sectors are allowed.")
    for sector in cleaned:
        if len(sector) > _MAX_SECTOR_LEN:
            raise ValueError(f"Each sector must be at most {_MAX_SECTOR_LEN} characters.")
    return cleaned


def _clean_stage_focus(value: list[StartupStage]) -> list[StartupStage]:
    if len(value) > _MAX_STAGES:
        raise ValueError(f"At most {_MAX_STAGES} stage focus values are allowed.")
    return list(dict.fromkeys(value))  # de-duplicate, keep order


def _clean_criteria(value: dict) -> dict:
    """Keep only whitelisted keys, bounded values."""
    unknown = set(value) - _CRITERIA_KEYS
    if unknown:
        raise ValueError(
            "Unknown criteria keys: " + ", ".join(sorted(unknown)) + "."
        )
    criteria: dict = {}
    for key, raw in value.items():
        if raw is None or raw == "":
            continue
        if key == "stage":
            criteria[key] = StartupStage(raw).value
        elif key == "investment_ready_only":
            criteria[key] = bool(raw)
        elif key in ("raise_min", "raise_max"):
            amount = Decimal(str(raw))
            if amount < 0:
                raise ValueError("Raise bounds must not be negative.")
            criteria[key] = amount
        else:  # sector / city / q
            criteria[key] = str(raw).strip()[:100]
    return criteria


class InvestorPreferenceRead(BaseModel):
    """An investor firm's thesis filters as returned by the API."""

    model_config = ConfigDict(extra="forbid")

    investor_org_id: uuid.UUID
    investor_type: InvestorType | None
    sectors: list[str]
    stage_focus: list[StartupStage]
    min_ticket: Decimal | None
    max_ticket: Decimal | None
    created_at: datetime
    updated_at: datetime


class InvestorPreferenceUpdate(BaseModel):
    """Full replace of the thesis filters (one row per investor firm).

    Every field is optional: a missing field resets to its empty default
    (that is what "replace" means here). ``investor_org_id`` and the
    timestamps stay out (server-controlled).
    """

    model_config = ConfigDict(extra="forbid")

    investor_type: InvestorType | None = None
    sectors: list[str] = Field(default_factory=list)
    stage_focus: list[StartupStage] = Field(default_factory=list)
    min_ticket: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)
    max_ticket: Decimal | None = Field(default=None, max_digits=14, decimal_places=2)

    @field_validator("sectors")
    @classmethod
    def _sectors_clean(cls, value: list[str]) -> list[str]:
        return _clean_sectors(value)

    @field_validator("stage_focus")
    @classmethod
    def _stage_focus_clean(cls, value: list[StartupStage]) -> list[StartupStage]:
        return _clean_stage_focus(value)

    @field_validator("min_ticket", "max_ticket")
    @classmethod
    def _tickets_positive(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("Ticket bounds must be greater than 0 when set.")
        return value

    @model_validator(mode="after")
    def _tickets_ordered(self) -> "InvestorPreferenceUpdate":
        if (
            self.min_ticket is not None
            and self.max_ticket is not None
            and self.max_ticket < self.min_ticket
        ):
            raise ValueError("Max ticket must not be below min ticket.")
        return self


class SavedSearchRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    investor_org_id: uuid.UUID
    name: str
    criteria: dict
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SavedSearchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    criteria: dict = Field(default_factory=dict)

    _validate_name = field_validator("name")(_clean_name)

    @field_validator("criteria")
    @classmethod
    def _criteria_clean(cls, value: dict) -> dict:
        return _clean_criteria(value)


class SavedSearchUpdate(BaseModel):
    """Editable fields; ``id``/``investor_org_id`` stay out."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    criteria: dict | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def _name_clean(cls, value: str | None) -> str | None:
        return _clean_name(value) if value is not None else None

    @field_validator("criteria")
    @classmethod
    def _criteria_clean(cls, value: dict | None) -> dict | None:
        return _clean_criteria(value) if value is not None else None


class ShortlistEntryRead(BaseModel):
    """A shortlist entry plus the startup summary the card renders.

    The startup fields are read-only joins (never writable through this
    API); the investor's ``note`` is private and never exposed to the
    startup side.
    """

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    investor_org_id: uuid.UUID
    startup_org_id: uuid.UUID
    note: str | None
    status: ShortlistStatus
    created_at: datetime
    updated_at: datetime
    startup_name: str
    startup_slug: str
    startup_stage: StartupStage
    startup_sector: str | None
    startup_readiness_score: int | None
    startup_investment_ready: bool


class ShortlistEntryCreate(BaseModel):
    """Bookmark a startup. ``startup_org_id`` must be a live startup."""

    model_config = ConfigDict(extra="forbid")

    startup_org_id: uuid.UUID
    note: str | None = Field(default=None, max_length=_MAX_NOTE)
    status: ShortlistStatus | None = None


class ShortlistEntryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str | None = Field(default=None, max_length=_MAX_NOTE)
    status: ShortlistStatus | None = None


__all__ = [
    "InvestorPreferenceRead",
    "InvestorPreferenceUpdate",
    "SavedSearchCreate",
    "SavedSearchRead",
    "SavedSearchUpdate",
    "ShortlistEntryCreate",
    "ShortlistEntryRead",
    "ShortlistEntryUpdate",
]
