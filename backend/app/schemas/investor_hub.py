"""Pydantic schemas for the startup investor hub (Step 9m).

Read-only aggregation responses — no write schemas, so no
``extra="forbid"`` concerns. Shapes derive from the hub frontend page
(``/startup/investors``) and aggregate data written by Steps 9a–9j.

9m adds no tables: every field here is computed from existing rows
(``funding_rounds``, ``investor_deals``, ``investor_engagement_requests``,
``investor_meetings``, ``investor_offers``, ``commitments``,
``portfolio_holdings``, ``activity_events``). The activity endpoints reuse
the 9l read schemas (``ActivityEventRead``/``ActivityPage``/
``ActivityStats``) so the startup and investor activity views share one
shape.

Confidentiality: the hub exposes only the startup's own investor-facing
data. Investor private fields (deal ``fit_note``/``probability``/
``passed_reason``/``owner_id``) are never included — the hub deals view
reuses 9e's already-stripped shape, and this module never reads those
columns at all.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.schemas.investor_workspace import ActivityEventRead


# ---------------------------------------------------------------------------
# Round progress (9a rounds + investor-derived counts)
# ---------------------------------------------------------------------------
class RoundProgress(BaseModel):
    """One startup round with its investor-side progress (9m hub view)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    round_type: str
    target_amount: Decimal | None
    committed_amount: Decimal
    currency: str
    status: str
    progress_pct: int | None
    opens_on: date | None
    closes_on: date | None
    deal_count: int
    offer_count: int
    commitment_count: int


class RoundProgressPage(BaseModel):
    """Paginated rounds-progress list (9m ``/investor-hub/rounds``)."""

    items: list[RoundProgress]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Hub summary
# ---------------------------------------------------------------------------
class HubNeedsReplyItem(BaseModel):
    """One pending engagement request the startup still needs to answer."""

    id: uuid.UUID
    investor_org_id: uuid.UUID
    investor_name: str
    kind: str
    ask: str
    created_at: datetime


class HubUpcomingMeetingItem(BaseModel):
    """One upcoming meeting scheduled with this startup."""

    id: uuid.UUID
    investor_org_id: uuid.UUID
    investor_name: str
    meeting_type: str
    scheduled_at: datetime
    status: str


class InvestorHubSummary(BaseModel):
    """The startup investor hub overview (9m ``/investor-hub/summary``).

    Counts are derived from 9a–9j rows scoped to the resolved startup org.
    ``primary_round`` is the active raise shown in the hub's round snapshot
    card (the open round closing earliest, else the most recent round, else
    ``None``). ``recent_activity`` is the startup's own recent audit events.
    """

    open_rounds: int
    deals_in_pipeline: int
    pending_requests: int
    meetings_this_month: int
    offers_received: int
    commitments_received: int
    primary_round: RoundProgress | None
    needs_reply: list[HubNeedsReplyItem]
    upcoming_meetings: list[HubUpcomingMeetingItem]
    recent_activity: list[ActivityEventRead]


__all__ = [
    "HubNeedsReplyItem",
    "HubUpcomingMeetingItem",
    "InvestorHubSummary",
    "RoundProgress",
    "RoundProgressPage",
]
