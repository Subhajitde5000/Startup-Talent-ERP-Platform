"""Analytics models for the Market tab (Step 5l).

Neither table exists in ``database/schema.sql``; both were GAPs the step
asked to propose before building, and both proposals were approved:

``startup_market_size`` (5l item 1)
    TAM / SAM / SOM with a unit, a currency, the estimate year, where the
    number came from, how confident the team is and the assumptions behind
    it. ``startup_profiles.market`` stays exactly as 5a built it: a free
    text "Target customer & market" blurb, not a number. Storing the
    figures here (instead of growing that text column) is what lets the
    Idea-stage "Market sizing" tool in 5j share ONE row with this tab
    (5j item 2: share, never duplicate).

``startup_competitors`` (5l item 2)
    The competitor landscape. Soft-deleted because the design doc keeps a
    change log and a removed competitor must not silently vanish from
    history.

Portable types (same policy as migrations 0003-0013): every fixed set is
VARCHAR + a named CHECK, never a native PG enum, so the schema behaves
identically on SQLite in tests and PostgreSQL in production. ``value`` is
NUMERIC(18,4) per AGENTS.md (money is never a float) and is serialized as a
decimal string.

``org_id`` references ``startup_profiles.org_id`` — the 5a/5f/5i
convention: carrying any of this presupposes a startup profile, which the
service creates on demand.
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
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketMetric(enum.StrEnum):
    """The three market sizes, in nesting order (TAM ⊃ SAM ⊃ SOM)."""

    tam = "tam"
    sam = "sam"
    som = "som"


class MarketScenario(enum.StrEnum):
    """The page's Conservative / Base / Optimistic toggle — real rows, not a
    client-side multiplier (5l plan L4)."""

    conservative = "conservative"
    base = "base"
    optimistic = "optimistic"


class MarketUnit(enum.StrEnum):
    """What the number counts. A market can be sized in money or in people
    or accounts, so the column is explicit rather than implied by currency.

    The members are prefixed because ``count`` and ``currency`` shadow
    ``str`` methods on a StrEnum, which mypy reads as a type error. The
    STORED values stay ``currency`` / ``count`` — that is the database
    contract and the API vocabulary.
    """

    monetary = "currency"
    countable = "count"


class MarketSourceType(enum.StrEnum):
    """Where the figure came from.

    Only the first two are writable by a client (5l plan, security): the
    platform-derived values are produced by our own aggregate jobs in a
    later step, never asserted by a startup.
    """

    team_estimate = "team_estimate"
    external_report = "external_report"
    calculated = "calculated"
    platform = "platform"


class Confidence(enum.StrEnum):
    """The design doc's confidence labels, one per market figure."""

    high = "high"
    medium = "medium"
    low = "low"


class CompetitorType(enum.StrEnum):
    """Direct / Indirect / Substitute — the three the design doc names."""

    direct = "direct"
    indirect = "indirect"
    substitute = "substitute"


# Source types a startup may write. ``calculated`` / ``platform`` are
# server-only, mirroring 5e's rule that verified sources are unreachable.
CLIENT_SOURCE_TYPES = frozenset(
    {MarketSourceType.team_estimate, MarketSourceType.external_report}
)


class StartupMarketSize(Base):
    """One market figure for one (org, metric, scenario)."""

    __tablename__ = "startup_market_size"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    metric: Mapped[MarketMetric] = mapped_column(String(8), nullable=False)
    scenario: Mapped[MarketScenario] = mapped_column(
        String(16),
        nullable=False,
        default=MarketScenario.base,
        server_default="base",
    )
    value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    # Only meaningful when unit == 'currency'; the service defaults it to
    # INR when a currency-denominated figure is written without one.
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    unit: Mapped[MarketUnit] = mapped_column(String(16), nullable=False)
    # The year the estimate describes ("2025 estimate" in the design doc).
    estimate_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    source_type: Mapped[MarketSourceType] = mapped_column(
        String(24),
        nullable=False,
        default=MarketSourceType.team_estimate,
        server_default="team_estimate",
    )
    # Where a reader can check it: a report name and/or a link.
    source_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    confidence: Mapped[Confidence] = mapped_column(
        String(8),
        nullable=False,
        default=Confidence.low,
        server_default="low",
    )
    assumptions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        # One row per figure per scenario: the write is an upsert, so a
        # founder editing TAM twice can never create two TAMs.
        UniqueConstraint(
            "org_id", "metric", "scenario", name="startup_market_size_unique"
        ),
        CheckConstraint(
            "metric IN ('tam','sam','som')", name="startup_market_size_metric_valid"
        ),
        CheckConstraint(
            "scenario IN ('conservative','base','optimistic')",
            name="startup_market_size_scenario_valid",
        ),
        CheckConstraint(
            "source_type IN ('team_estimate','external_report','calculated','platform')",
            name="startup_market_size_source_valid",
        ),
        CheckConstraint(
            "confidence IN ('high','medium','low')",
            name="startup_market_size_confidence_valid",
        ),
        CheckConstraint(
            "unit IN ('currency','count')", name="startup_market_size_unit_valid"
        ),
        # A market size is a magnitude. Zero is allowed (a niche can honestly
        # be unmeasured at zero) but negative is not.
        CheckConstraint("value >= 0", name="startup_market_size_value_check"),
        CheckConstraint(
            "estimate_year >= 1900 AND estimate_year <= 2100",
            name="startup_market_size_year_check",
        ),
        Index("startup_market_size_org_idx", "org_id", "metric", "scenario"),
    )


class StartupCompetitor(Base):
    """One competitor the startup tracks (5l item 2)."""

    __tablename__ = "startup_competitors"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("startup_profiles.org_id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[CompetitorType] = mapped_column(
        String(16),
        nullable=False,
        default=CompetitorType.direct,
        server_default="direct",
    )
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_customer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    positioning: Mapped[str | None] = mapped_column(String(500), nullable=True)
    strengths: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    weaknesses: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    pricing_note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    last_reviewed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "type IN ('direct','indirect','substitute')",
            name="startup_competitors_type_valid",
        ),
        # Unique per organization so the same competitor is not entered
        # twice — and so a lookup by name can never cross an org boundary.
        # Partial: a soft-deleted row must not block re-adding the company.
        Index(
            "startup_competitors_name_key",
            "org_id",
            func.lower(name),
            unique=True,
            postgresql_where=deleted_at.is_(None),
            sqlite_where=deleted_at.is_(None),
        ),
        Index("startup_competitors_org_idx", "org_id", "deleted_at"),
    )
