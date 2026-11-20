"""Dashboard summary schema (Step 5g).

One read-only payload for ``/startup/dashboard``. The design doc's rule is
that a card either has a real source or shows an honest empty state; it
must never invent a number. Two mechanisms enforce that here:

- Counters and scores are computed from rows that actually exist.
- Anything without a source yet is named in ``unavailable`` (with the step
  that will supply it) instead of being returned as ``0``. Money that the
  caller may not see is set to ``null`` and named in ``restricted`` — the
  ``missing`` convention ``GET /metrics/latest`` already uses.

Nothing in this schema is writable: 5g adds no write endpoint.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.organization import OrgRole
from app.models.startup import StartupStage


class DashboardMetric(BaseModel):
    """One KPI card value. ``value`` is a decimal STRING, never a float."""

    model_config = ConfigDict(extra="forbid")

    metric_key: str
    value: str
    unit: str | None
    currency: str | None
    source: str
    period_end: date


class DashboardTaskItem(BaseModel):
    """A row in the "My tasks" list (open tasks assigned to the caller)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    title: str
    status: str
    priority: str
    due_on: date | None
    is_overdue: bool
    is_due_today: bool


class DashboardTaskSummary(BaseModel):
    """My-tasks counters. ``total_open`` is never a board-wide number."""

    model_config = ConfigDict(extra="forbid")

    total_open: int
    overdue: int
    due_today: int
    due_this_week: int
    items: list[DashboardTaskItem]


class DashboardMilestoneItem(BaseModel):
    """The next milestone (the one highlighted on the dashboard timeline)."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    name: str
    target_date: date | None
    status: str
    progress: int


class DashboardMilestoneSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total: int
    achieved: int
    at_risk: int
    next: DashboardMilestoneItem | None


class DashboardStage(BaseModel):
    """Stage banner: current stage plus this stage's exit-criteria roll-up."""

    model_config = ConfigDict(extra="forbid")

    stage: StartupStage
    in_stage_since: datetime | None
    exit_criteria_total: int
    exit_criteria_signed_off: int


class DashboardReadiness(BaseModel):
    """Readiness gauge. ``readiness_pct`` is the 5f cached score.

    ``signed_off_remaining`` is what the gauge's "N items left" line reads;
    the design doc's per-component breakdown (checklist/traction/mentor) is
    named in ``unavailable`` because traction and mentor feedback have no
    source yet.
    """

    model_config = ConfigDict(extra="forbid")

    readiness_pct: int
    criteria_total: int
    criteria_signed_off: int
    signed_off_remaining: int
    is_ready: bool


class DashboardTeamMember(BaseModel):
    """Avatar-stack entry."""

    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    display_name: str | None
    role: OrgRole


class DashboardTeam(BaseModel):
    model_config = ConfigDict(extra="forbid")

    active_members: int
    pending_invites: int
    members: list[DashboardTeamMember]


class DashboardActivityItem(BaseModel):
    """One row of the recent-activity feed (newest first)."""

    model_config = ConfigDict(extra="forbid")

    event_type: str
    summary: str
    actor_name: str | None
    link_url: str | None
    created_at: datetime


class UnavailableCard(BaseModel):
    """A card the page must render as empty/hidden, with the reason.

    ``step`` names the BUILD_PLAN sub-step that will supply the data, so
    the frontend can say "arrives in Step 8" instead of showing zeroes.
    """

    model_config = ConfigDict(extra="forbid")

    key: str
    reason: str
    step: str | None


class DashboardSummary(BaseModel):
    """The whole dashboard in one response."""

    model_config = ConfigDict(extra="forbid")

    org_id: uuid.UUID
    org_name: str
    org_slug: str
    my_role: OrgRole
    my_display_name: str | None
    stage: DashboardStage
    readiness: DashboardReadiness
    tasks: DashboardTaskSummary
    milestones: DashboardMilestoneSummary
    # Only the keys that have a value. Absent is absent — never 0.
    metrics: list[DashboardMetric]
    team: DashboardTeam
    recent_activity: list[DashboardActivityItem]
    # Cards with no data source yet (mentor, investors, hiring, documents).
    unavailable: list[UnavailableCard]
    # Values withheld from this caller (viewer: money).
    restricted: list[str]
