"""Market / competitor schemas (Step 5l).

Conventions (AGENTS.md section 5): separate input/read shapes, ``extra="forbid"``
everywhere, and server-owned fields ABSENT from the input schemas so sending
them is a 422 rather than a silently ignored field:

- ``id``, ``org_id``, ``created_at``, ``updated_at``, ``deleted_at``;
- ``source_type`` values ``calculated`` / ``platform`` — a startup may only
  claim ``team_estimate`` or ``external_report``, mirroring 5e's rule that
  verified sources are unreachable from the client.

Value handling follows 5e exactly: ``value`` is NUMERIC(18,4) in the database
and a **decimal string** in every read, never a float.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.analytics import (
    CLIENT_SOURCE_TYPES,
    CompetitorType,
    Confidence,
    MarketMetric,
    MarketScenario,
    MarketSourceType,
    MarketUnit,
)
from app.schemas.common import clean_text

_MAX_VALUE = Decimal("99999999999999.9999")  # NUMERIC(18, 4)
_MAX_NOTE = 500
_MAX_ASSUMPTIONS = 2000
_MAX_NAME = 120
_MAX_TARGET = 200
_MAX_POSITIONING = 500
_MAX_SW = 1000
_MAX_PRICING = 200


def _url_or_none(v: str | None) -> str | None:
    """http/https only — never ``javascript:`` or a bare scheme."""
    cleaned = clean_text(v, 500)
    if cleaned is None:
        return None
    lowered = cleaned.lower()
    if not (lowered.startswith("http://") or lowered.startswith("https://")):
        raise ValueError("must be an http or https URL")
    return cleaned


# --- market size -------------------------------------------------------------


class MarketSizeUpsert(BaseModel):
    """Write one market figure. ``(org, metric, scenario)`` is the identity."""

    model_config = ConfigDict(extra="forbid")

    metric: MarketMetric
    scenario: MarketScenario = MarketScenario.base
    value: Decimal = Field(ge=Decimal(0), le=_MAX_VALUE, max_digits=18, decimal_places=4)
    unit: MarketUnit = MarketUnit.monetary
    currency: str | None = Field(default=None, max_length=3)
    estimate_year: int = Field(ge=1900, le=2100)
    source_type: MarketSourceType = MarketSourceType.team_estimate
    source_note: str | None = Field(default=None, max_length=_MAX_NOTE)
    source_url: str | None = Field(default=None, max_length=500)
    confidence: Confidence = Confidence.low
    assumptions: str | None = Field(default=None, max_length=_MAX_ASSUMPTIONS)

    @field_validator("value")
    @classmethod
    def _finite(cls, v: Decimal) -> Decimal:
        if not v.is_finite():
            raise ValueError("must be a finite number")
        return v

    @field_validator("source_type")
    @classmethod
    def _client_source(cls, v: MarketSourceType) -> MarketSourceType:
        if v not in CLIENT_SOURCE_TYPES:
            raise ValueError(
                "must be team_estimate or external_report: "
                "calculated and platform figures are server-assigned"
            )
        return v

    @field_validator("currency")
    @classmethod
    def _currency(cls, v: str | None) -> str | None:
        cleaned = clean_text(v, 3)
        if cleaned is None:
            return None
        cleaned = cleaned.upper()
        if len(cleaned) != 3 or not cleaned.isalpha():
            raise ValueError("must be a 3-letter ISO currency code")
        return cleaned

    @field_validator("source_note")
    @classmethod
    def _note(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_NOTE)

    @field_validator("assumptions")
    @classmethod
    def _assumptions(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_ASSUMPTIONS)

    @field_validator("source_url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return _url_or_none(v)

    @model_validator(mode="after")
    def _unit_rules(self) -> "MarketSizeUpsert":
        """A currency figure needs a currency; a count figure must not carry
        one. Getting this wrong would render "₹1,200 Cr people"."""
        if self.unit is MarketUnit.monetary and self.currency is None:
            self.currency = "INR"
        if self.unit is MarketUnit.countable and self.currency is not None:
            raise ValueError("currency only applies to a currency market size")
        return self


class MarketSizeRead(BaseModel):
    """One stored market figure."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    metric: MarketMetric
    scenario: MarketScenario
    # Decimal string, never a float (5e rule).
    value: str
    unit: MarketUnit
    currency: str | None
    estimate_year: int
    source_type: MarketSourceType
    source_note: str | None
    source_url: str | None
    confidence: Confidence
    assumptions: str | None
    created_at: datetime
    updated_at: datetime


class MarketSizeBoard(BaseModel):
    """``GET /market-size`` — every scenario the startup has filled in.

    ``missing`` names the (metric, scenario) pairs with no row, so the page
    can render an honest empty state instead of a zero. It is a flat list of
    ``"tam:base"``-style keys because Pydantic tuple keys would not survive
    as JSON object keys.
    """

    model_config = ConfigDict(extra="forbid")

    items: list[MarketSizeRead]
    missing: list[str]
    # The KPI row's derived figure: ARR ÷ base SAM, as a percentage string.
    # ``None`` whenever it cannot honestly be computed (no SAM, no ARR, or a
    # count-sized SAM that cannot be divided by money) — never zero.
    market_share_pct: str | None = None
    competitors_tracked: int = 0


# --- competitors -------------------------------------------------------------


class CompetitorCreate(BaseModel):
    """Add a competitor. Server-owned fields are absent, not ignored."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=_MAX_NAME)
    type: CompetitorType = CompetitorType.direct
    website: str | None = Field(default=None, max_length=500)
    target_customer: str | None = Field(default=None, max_length=_MAX_TARGET)
    positioning: str | None = Field(default=None, max_length=_MAX_POSITIONING)
    strengths: str | None = Field(default=None, max_length=_MAX_SW)
    weaknesses: str | None = Field(default=None, max_length=_MAX_SW)
    pricing_note: str | None = Field(default=None, max_length=_MAX_PRICING)
    last_reviewed_on: date | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        cleaned = clean_text(v, _MAX_NAME)
        if cleaned is None:
            raise ValueError("name is required")
        return cleaned

    @field_validator(
        "target_customer", "positioning", "strengths", "weaknesses", "pricing_note"
    )
    @classmethod
    def _text(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_SW)

    @field_validator("website")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return _url_or_none(v)


class CompetitorUpdate(BaseModel):
    """Partial edit. ``exclude_unset`` means an absent field is untouched."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=_MAX_NAME)
    type: CompetitorType | None = None
    website: str | None = Field(default=None, max_length=500)
    target_customer: str | None = Field(default=None, max_length=_MAX_TARGET)
    positioning: str | None = Field(default=None, max_length=_MAX_POSITIONING)
    strengths: str | None = Field(default=None, max_length=_MAX_SW)
    weaknesses: str | None = Field(default=None, max_length=_MAX_SW)
    pricing_note: str | None = Field(default=None, max_length=_MAX_PRICING)
    last_reviewed_on: date | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = clean_text(v, _MAX_NAME)
        if cleaned is None:
            raise ValueError("name cannot be blank")
        return cleaned

    @field_validator(
        "target_customer", "positioning", "strengths", "weaknesses", "pricing_note"
    )
    @classmethod
    def _text(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_SW)

    @field_validator("website")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return _url_or_none(v)


class CompetitorRead(BaseModel):
    """One competitor row."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    type: CompetitorType
    website: str | None
    target_customer: str | None
    positioning: str | None
    strengths: str | None
    weaknesses: str | None
    pricing_note: str | None
    last_reviewed_on: date | None
    created_at: datetime
    updated_at: datetime


class CompetitorPage(BaseModel):
    """Paginated competitor list (the 5e/5i envelope)."""

    model_config = ConfigDict(extra="forbid")

    items: list[CompetitorRead]
    total: int
    limit: int
    offset: int
