"""Investor pipeline schemas (Step 9e).

Strict ``extra="forbid"`` Create/Update/Read schemas (AGENTS.md section
7): server-controlled fields (``id``, ``investor_org_id``,
``created_at``, ``updated_at``, ``deleted_at``, ``last_activity_at``)
are never inputs.

The startup-side read (``StartupInvestorDealRead``) deliberately
STRIPS the investor's private fields — ``fit_note``, ``probability``,
``passed_reason``, ``owner_id`` — so a startup can never see an
investor's internal notes or probability through the pipeline view
(BUILD_PLAN 9e: "the startup sees its own investor list without private
notes").
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.investor_deal import PipelineStage


class InvestorDealCreate(BaseModel):
    """Create a deal on the investor's board.

    ``investor_org_id`` is the caller's own firm (resolved server-side
    from their membership), never an input. ``owner_id`` must be an
    active member of that firm (validated in the service).
    """

    model_config = ConfigDict(extra="forbid")

    startup_org_id: uuid.UUID
    round_id: uuid.UUID | None = None
    stage: PipelineStage = PipelineStage.interested
    probability: int | None = Field(default=None, ge=0, le=100)
    ticket_size: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str = Field(default="INR", max_length=3)
    owner_id: uuid.UUID | None = None
    fit_note: str | None = None
    next_step: str | None = None
    next_step_on: date | None = None
    passed_reason: str | None = None


class InvestorDealUpdate(BaseModel):
    """Editable deal fields (PATCH). ``stage`` changes are logged."""

    model_config = ConfigDict(extra="forbid")

    round_id: uuid.UUID | None = None
    stage: PipelineStage | None = None
    probability: int | None = Field(default=None, ge=0, le=100)
    ticket_size: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    currency: str | None = Field(default=None, max_length=3)
    owner_id: uuid.UUID | None = None
    fit_note: str | None = None
    next_step: str | None = None
    next_step_on: date | None = None
    passed_reason: str | None = None


class InvestorDealRead(BaseModel):
    """Full deal as the investor sees it (with startup summary).

    Carries a small public snapshot of the target startup (logo, sector,
    tagline, readiness) plus the round target, so the board card can
    render without a second request. ``owner_name`` resolves the deal
    owner's display name (``owner_id`` is the FK).
    """

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
    startup_readiness_score: int | None
    round_id: uuid.UUID | None
    round_target: Decimal | None
    round_currency: str | None
    stage: PipelineStage
    probability: int | None
    ticket_size: Decimal | None
    currency: str
    owner_id: uuid.UUID | None
    owner_name: str | None
    fit_note: str | None
    next_step: str | None
    next_step_on: date | None
    last_activity_at: datetime | None
    passed_reason: str | None
    created_at: datetime
    updated_at: datetime


class InvestorDealPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InvestorDealRead]
    total: int
    limit: int
    offset: int


class InvestorDealSummary(BaseModel):
    """Deal counts per stage for the investor's board header."""

    model_config = ConfigDict(extra="forbid")

    counts: dict[str, int]
    total: int


class InvestorDealHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    deal_id: uuid.UUID
    from_stage: PipelineStage | None
    to_stage: PipelineStage
    changed_by: uuid.UUID | None
    changed_at: datetime
    note: str | None


class InvestorDealHistoryPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[InvestorDealHistoryItem]
    total: int
    limit: int
    offset: int


class StartupInvestorDealRead(BaseModel):
    """A deal as the STARTUP sees it: private investor fields stripped."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    investor_org_id: uuid.UUID
    investor_name: str
    investor_slug: str
    stage: PipelineStage
    round_id: uuid.UUID | None
    ticket_size: Decimal | None
    currency: str
    next_step: str | None
    next_step_on: date | None
    last_activity_at: datetime | None
    created_at: datetime
    updated_at: datetime


class StartupInvestorDealPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[StartupInvestorDealRead]
    total: int
    limit: int
    offset: int


class StartupInvestorDealStageUpdate(BaseModel):
    """The startup updates the shared deal stage (stage-only)."""

    model_config = ConfigDict(extra="forbid")

    stage: PipelineStage


__all__ = [
    "InvestorDealCreate",
    "InvestorDealHistoryItem",
    "InvestorDealHistoryPage",
    "InvestorDealPage",
    "InvestorDealRead",
    "InvestorDealSummary",
    "InvestorDealUpdate",
    "StartupInvestorDealPage",
    "StartupInvestorDealRead",
    "StartupInvestorDealStageUpdate",
]
