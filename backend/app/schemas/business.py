"""Business-tab schemas (Step 5k).

One read that answers the whole Business tab, so the page makes a single
request instead of a dozen. Every number is either **reported** (a
``startup_metrics`` row, with its source) or **calculated here** from
reported inputs — and a calculated value whose inputs are missing is
ABSENT, with its name in ``missing``. Nothing is ever defaulted to zero
(5k plan K3, the same rule as 5e's ``MetricLatestRead``).

All values are decimal strings, never floats: they come from NUMERIC
columns and a ratio must not round-trip through binary floating point.
"""

from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.metric import MetricKey, MetricSource


class BusinessKpi(BaseModel):
    """One KPI card: a reported value plus the period it describes."""

    model_config = ConfigDict(extra="forbid")

    key: MetricKey
    value: str
    unit: str | None
    currency: str | None
    source: MetricSource
    period_end: date


class CalculatedValue(BaseModel):
    """A figure the service derives — never stored, never client-writable.

    ``inputs`` names the reported keys it was computed from, so the UI can
    show its working ("LTV ÷ CAC") and a reader can audit it.
    """

    model_config = ConfigDict(extra="forbid")

    key: str
    value: str
    unit: str
    inputs: list[MetricKey]


class FunnelStep(BaseModel):
    """One bar of the sales funnel.

    ``count`` is the reported cumulative count for ``period_end``.
    ``step_conversion_pct`` is this step ÷ the step above it; ``total_
    conversion_pct`` is this step ÷ the first step. Both are decimal
    strings, and both are ``None`` for the first step or when a count is
    zero — a percentage of nothing is not zero, it is unknown.
    """

    model_config = ConfigDict(extra="forbid")

    key: MetricKey
    label: str
    count: str | None
    period_end: date | None
    step_conversion_pct: str | None
    total_conversion_pct: str | None


class RetentionBlock(BaseModel):
    """Customers & retention card."""

    model_config = ConfigDict(extra="forbid")

    churn_rate: BusinessKpi | None
    nrr: BusinessKpi | None
    arpc: BusinessKpi | None
    # Derived only when ARPC and churn_rate both exist.
    calculated_arpc: CalculatedValue | None


class BusinessCompleteness(BaseModel):
    """The "Data completeness" card, scoped to the Business tab's own keys.

    Scoped deliberately: reporting "12 / 23" across the whole vocabulary
    would tell a founder they are missing data that this tab never shows.
    The denominator is the Business tab's own 20 keys (15 KPI + 5 funnel).
    """

    model_config = ConfigDict(extra="forbid")

    reported: int
    total: int
    missing: list[MetricKey]


class SourceUsage(BaseModel):
    """The "Data sources" card: one line per key that has a value."""

    model_config = ConfigDict(extra="forbid")

    key: MetricKey
    source: MetricSource
    period_end: date


class BusinessAnalytics(BaseModel):
    """``GET /analytics/business``."""

    model_config = ConfigDict(extra="forbid")

    kpis: list[BusinessKpi]
    unit_economics: list[CalculatedValue]
    retention: RetentionBlock
    funnel: list[FunnelStep]
    completeness: BusinessCompleteness
    sources: list[SourceUsage]
    # Every figure this tab could show but cannot, named honestly. A card
    # whose key appears here renders an empty state, never a zero.
    missing: list[str]
