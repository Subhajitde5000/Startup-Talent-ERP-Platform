"""Metric schemas (Step 5e).

Conventions (AGENTS.md section 5): separate input/read shapes and
``extra="forbid"`` everywhere. Server-owned fields are ABSENT from the
input schema, so an attempt to send them is a 422:

- ``source`` — the service always writes ``startup_reported``; verified
  sources (``calculated`` / ``mentor_verified`` / ``admin_verified``)
  cannot be produced by a client at all;
- ``id``, ``org_id``, ``created_at``.

Value handling (plan E1): ``value`` is NUMERIC(18,4) in the database and is
serialized as a **decimal string** in every read, never a float. It is
accepted as a string or a number on input, bounded to the column's
precision, and rejected when it is not finite.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.metric import MetricKey, MetricSource
from app.schemas.common import clean_text

_MAX_UNIT = 32
_MAX_VALUE = Decimal("99999999999999.9999")  # NUMERIC(18, 4)
_MAX_HISTORY = 100


class MetricUpsert(BaseModel):
    """Report one value for one (key, period). Server fields are absent."""

    model_config = ConfigDict(extra="forbid")

    metric_key: MetricKey
    value: Decimal = Field(
        ge=Decimal("-99999999999999.9999"), le=_MAX_VALUE, max_digits=18, decimal_places=4
    )
    unit: str | None = Field(default=None, max_length=_MAX_UNIT)
    currency: str | None = Field(default=None, max_length=3)
    period_end: date

    @field_validator("value")
    @classmethod
    def _finite(cls, v: Decimal) -> Decimal:
        # Decimal("NaN")/("Infinity") parse but do not survive NUMERIC.
        if not v.is_finite():
            raise ValueError("must be a finite number")
        return v

    @field_validator("unit")
    @classmethod
    def _unit(cls, v: str | None) -> str | None:
        return clean_text(v, _MAX_UNIT)

    @field_validator("currency")
    @classmethod
    def _currency(cls, v: str | None) -> str | None:
        """ISO 4217: three letters, stored uppercase (plan E3)."""
        cleaned = clean_text(v, 3)
        if cleaned is None:
            return None
        cleaned = cleaned.upper()
        if len(cleaned) != 3 or not cleaned.isalpha():
            raise ValueError("must be a 3-letter ISO currency code")
        return cleaned


class MetricRead(BaseModel):
    """One stored value (the shape every read returns)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    org_id: uuid.UUID
    metric_key: MetricKey
    # Decimal string, never a float (plan E1).
    value: str
    unit: str | None
    currency: str | None
    source: MetricSource
    period_end: date
    created_at: datetime


class MetricPoint(BaseModel):
    """One point on a history line (the chart's x/y pair)."""

    model_config = ConfigDict(extra="forbid")

    period_end: date
    value: str
    source: MetricSource


class MetricHistory(BaseModel):
    """``GET /metrics/{key}/history`` — a chart window, newest first."""

    model_config = ConfigDict(extra="forbid")

    metric_key: MetricKey
    unit: str | None
    currency: str | None
    items: list[MetricPoint]
    total: int
    limit: int
    offset: int


class MetricPage(BaseModel):
    """``GET /metrics`` — the paginated list envelope (same as 5b/5c)."""

    model_config = ConfigDict(extra="forbid")

    items: list[MetricRead]
    total: int
    limit: int
    offset: int


class MetricLatestRead(BaseModel):
    """``GET /metrics/latest`` — the dashboard/analytics card row.

    Only keys that actually have a value appear here (plan E2): a missing
    key is absent rather than reported as 0, so the UI can show an honest
    empty card instead of a fake number.
    """

    model_config = ConfigDict(extra="forbid")

    items: list[MetricRead]
    missing: list[MetricKey]
