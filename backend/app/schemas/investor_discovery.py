"""Investor-side startup discovery schemas (Step 9c).

The item shape is shared: the 9c discovery list and the 9d saved-search
"matches" endpoint both render the same investor startup cards from one
query (``discovery_service.investor_startup_rows``), so they must never
drift apart.

Round aggregates come from the startup's open/paused funding rounds
(9a). They are NULL for a caller the startup has not opted in to
(``round_public`` off and not a member) — never zeros that would look
like real data. ``round_visible`` tells the client whether it is
entitled to the round data at all.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.funding_round import FundingRoundType, RoundStatus
from app.models.startup import StartupStage


class InvestorStartupItem(BaseModel):
    """One startup row in an investor-facing list (9c list / 9d matches)."""

    model_config = ConfigDict(extra="forbid")

    org_id: uuid.UUID
    slug: str
    name: str
    tagline: str | None
    stage: StartupStage
    sector: str | None
    city: str | None
    founded_year: int | None
    website: str | None
    mentor_verified: bool
    readiness_score: int | None
    investment_ready: bool
    round_visible: bool
    round_target: Decimal | None
    round_committed: Decimal | None
    round_currency: str | None
    traction_summary: str | None
    updated_at: datetime


class InvestorStartupPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InvestorStartupItem]
    total: int
    limit: int
    offset: int


class InvestorStartupDetail(BaseModel):
    """The investor detail view of one startup.

    Same raise/readiness facts as the list item, plus the public
    profile copy (problem/solution) and org identity for the detail
    page. Round aggregates are present only when the startup opted in
    (``round_visible``).
    """

    model_config = ConfigDict(extra="forbid")

    org_id: uuid.UUID
    slug: str
    name: str
    tagline: str | None
    stage: StartupStage
    sector: str | None
    city: str | None
    region: str | None
    country: str | None
    founded_year: int | None
    website: str | None
    logo_url: str | None
    logo_initials: str | None
    summary: str | None
    problem: str | None
    solution: str | None
    market: str | None
    business_model: str | None
    traction_summary: str | None
    mentor_verified: bool
    readiness_score: int | None
    investment_ready: bool
    round_visible: bool
    round_target: Decimal | None
    round_committed: Decimal | None
    round_currency: str | None
    updated_at: datetime


class InvestorRoundItem(BaseModel):
    """One funding round of a startup, as shown to an investor."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    round_type: FundingRoundType
    target_amount: Decimal | None
    committed_amount: Decimal
    currency: str
    pre_money_valuation: Decimal | None
    instrument: str | None
    status: RoundStatus
    opens_on: date | None
    closes_on: date | None
    min_raise: Decimal | None
    min_ticket: Decimal | None
    created_at: datetime
    updated_at: datetime


class InvestorRoundPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InvestorRoundItem]
    total: int
    limit: int
    offset: int


class InvestorStartupFilters(BaseModel):
    """Distinct facet values among startups visible to the caller."""

    model_config = ConfigDict(extra="forbid")

    stages: list[StartupStage]
    sectors: list[str]


__all__ = [
    "InvestorRoundItem",
    "InvestorRoundPage",
    "InvestorStartupDetail",
    "InvestorStartupFilters",
    "InvestorStartupItem",
    "InvestorStartupPage",
]
