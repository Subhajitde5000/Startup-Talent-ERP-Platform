"""Startup metrics model (Step 5e, schema.sql "startup profile and readiness").

``startup_metrics`` is the time series behind the analytics page and the
dashboard cards: one row per (organization, metric key, period end), and
the UI reads the latest row per key.

Mirrors schema.sql exactly, with two portable-type notes:
- the allowed keys and sources are VARCHAR + the named CHECKs from
  schema.sql (``startup_metric_key_valid`` / ``startup_metric_source_valid``),
  never native PG enums (same policy as migrations 0003-0010);
- ``currency`` is String(3) instead of ``char(3)``: char pads with spaces
  and does not exist on SQLite, and the value is a 3-letter ISO code either
  way (``talent.py`` already stores currency the same way).

There is no ``updated_at``: schema.sql has none, and a correction is the
same upsert for that period rather than an edit of a historical row.

Plan decisions carried by this module (5e plan, user-approved):
- E1: ``value`` is NUMERIC(18,4) and is serialized as a decimal *string*,
  never a float — money must not round-trip through binary floats.
- E5: ``growth_mom`` is stored as reported (a percentage number), never
  computed from history; computed rows would carry a server-only source.
- D3/source: the client can only ever produce ``startup_reported``. The
  service assigns it; ``calculated`` / ``mentor_verified`` /
  ``admin_verified`` are unreachable from this step.
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MetricKey(enum.StrEnum):
    """schema.sql CHECK ``startup_metric_key_valid`` — the 8 allowed keys.

    Anything else (for example the analytics page's "cash balance",
    which schema.sql has no key for) is rejected with 422.
    """

    mrr = "mrr"
    arr = "arr"
    customers = "customers"
    burn = "burn"
    runway_months = "runway_months"
    growth_mom = "growth_mom"
    headcount = "headcount"
    active_users = "active_users"


class MetricSource(enum.StrEnum):
    """schema.sql CHECK ``startup_metric_source_valid``.

    Only ``startup_reported`` is reachable from the API: the rest are
    server-side verification (mentor Step 8, admin Step 15a, calculated
    rollups later).
    """

    startup_reported = "startup_reported"
    calculated = "calculated"
    mentor_verified = "mentor_verified"
    admin_verified = "admin_verified"


# Sources a startup may never overwrite: a verified value is the whole
# point of verification, so re-reporting that period is a 409 (plan E4).
VERIFIED_SOURCES = frozenset(
    {MetricSource.calculated, MetricSource.mentor_verified, MetricSource.admin_verified}
)

# Keys that may legitimately be negative; everything else is >= 0.
_SIGNED_KEYS = frozenset({MetricKey.growth_mom})


class StartupMetric(Base):
    """One reported value for one (organization, key, period)."""

    __tablename__ = "startup_metrics"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # schema.sql references startup_profiles(org_id), so a startup profile
    # is the precondition for reporting metrics (created on demand by the
    # service, the 5a/5f pattern).
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    metric_key: Mapped[MetricKey] = mapped_column(String(24), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    # Plan E1/D3: always server-assigned; never accepted from the client.
    source: Mapped[MetricSource] = mapped_column(
        String(24),
        nullable=False,
        default=MetricSource.startup_reported,
        server_default="startup_reported",
    )
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "metric_key IN ('mrr','arr','customers','burn','runway_months',"
            "'growth_mom','headcount','active_users')",
            name="startup_metric_key_valid",
        ),
        CheckConstraint(
            "source IN ('startup_reported','calculated','mentor_verified',"
            "'admin_verified')",
            name="startup_metric_source_valid",
        ),
    )
