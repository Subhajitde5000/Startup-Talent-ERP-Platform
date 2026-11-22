"""Pydantic schemas for the investor workspace (Step 9l).

Read-only aggregation responses — no write schemas, so no
``extra="forbid"`` concerns. Shapes derive from the frontend pages
(``/investor/dashboard``, ``/investor/insights``,
``/investor/activity``).

D1 (9l): insights are DESCRIPTIVE only — counts and distributions
over real data, cohort threshold n >= 10, no forecasts or
predictions.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------
class NeedsReplyItem(BaseModel):
    """One 'needs your reply' entry (from pending engagement requests)."""

    id: uuid.UUID
    startup_org_id: uuid.UUID
    startup_name: str
    kind: str
    ask: str
    created_at: datetime


class UpcomingMeetingItem(BaseModel):
    """One 'upcoming meetings' entry."""

    id: uuid.UUID
    startup_org_id: uuid.UUID
    startup_name: str
    meeting_type: str
    scheduled_at: datetime
    status: str


class DashboardSummary(BaseModel):
    """The dashboard top stat strip + sidebar cards (9l)."""

    new_matches_this_week: int
    requests_awaiting_reply: int
    meetings_this_week: int
    startups_in_pipeline: int
    pipeline_snapshot: dict[str, int]
    portfolio_holdings: int
    portfolio_updates_this_week: int
    needs_reply: list[NeedsReplyItem]
    upcoming_meetings: list[UpcomingMeetingItem]


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------
class MonthlyCount(BaseModel):
    month: str  # ISO YYYY-MM
    count: int


class YourFunnelStats(BaseModel):
    """Private-to-you funnel counts (descriptive, no predictions)."""

    profiles_reviewed: int
    shortlisted: int
    intro_requests: int
    data_rooms_opened: int
    offers_extended: int


class InsightsResponse(BaseModel):
    """Descriptive platform + private-funnel stats (9l, D1: no forecasts)."""

    startups_by_stage: dict[str, int]
    startups_by_stage_total: int
    monthly_new_profiles: list[MonthlyCount]
    monthly_round_launches: list[MonthlyCount]
    your_funnel: YourFunnelStats
    cohort_threshold: int


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------
class ActivityEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: uuid.UUID | None
    user_id: uuid.UUID | None
    event_type: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    summary: str
    link_url: str | None
    created_at: datetime


class ActivityPage(BaseModel):
    items: list[ActivityEventRead]
    total: int
    limit: int
    offset: int


class DailyCount(BaseModel):
    day: date
    count: int


class ActivityStats(BaseModel):
    """Aggregate activity stats for the investor's org (9l)."""

    total_events: int
    events_last_7_days: int
    by_event_type: dict[str, int]
    by_day: list[DailyCount]


__all__ = [
    "ActivityEventRead",
    "ActivityPage",
    "ActivityStats",
    "DashboardSummary",
    "DailyCount",
    "InsightsResponse",
    "MonthlyCount",
    "NeedsReplyItem",
    "UpcomingMeetingItem",
    "YourFunnelStats",
]
