"""Schemas for Step 7l employer hiring dashboard, analytics and activity.

Read-only projections: KPI strip, the per-job list, "needs attention" cues,
the activity feed, and the hiring funnel / velocity. Money is returned as
decimal strings (never floats, AGENTS.md). All counts are non-negative
integers; an unknown average is ``None`` rather than ``0`` so the UI can show
"not enough data" instead of a misleading zero.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ActivityItem(BaseModel):
    event_type: str
    summary: str
    link_url: str | None = None
    actor_name: str | None = None
    created_at: datetime


class HiringKpis(BaseModel):
    open_jobs: int
    total_applicants: int
    hires: int
    avg_time_to_hire_days: int | None = None


class DashboardJobItem(BaseModel):
    job_id: uuid.UUID
    title: str
    status: str
    applicants: int
    hires: int


class AttentionItem(BaseModel):
    job_id: uuid.UUID
    title: str
    unreviewed_applicants: int


class HiringDashboard(BaseModel):
    org_id: uuid.UUID
    kpis: HiringKpis
    jobs: list[DashboardJobItem]
    attention: list[AttentionItem]
    recent_activity: list[ActivityItem]


class FunnelStage(BaseModel):
    stage: Literal["applied", "shortlisted", "interview", "offered", "hired"]
    count: int


class JobVelocity(BaseModel):
    job_id: uuid.UUID
    title: str
    status: str
    applicants: int
    hires: int
    avg_time_to_hire_days: int | None = None
    avg_time_to_first_interview_days: int | None = None


class HiringAnalytics(BaseModel):
    funnel: list[FunnelStage]
    total_applicants: int
    hires: int
    avg_time_to_hire_days: int | None = None
    avg_time_to_first_interview_days: int | None = None
    by_job: list[JobVelocity]


class ActivityPage(BaseModel):
    items: list[ActivityItem]
    total: int
    limit: int
    offset: int
    has_more: bool
