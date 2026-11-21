"""Read-only aggregates for mentorship workspaces."""

import uuid

from pydantic import BaseModel

from app.schemas.earning import EarningSummary
from app.schemas.mentorship import MentorshipPage, MentorshipRead
from app.schemas.readiness import ReadinessRead, ReadinessSummary


class WorkspaceRead(BaseModel):
    mentorship: MentorshipRead
    completed_sessions: int
    open_deliverables: int
    health: None = None
    agreements_available: bool = False


class ImpactRead(BaseModel):
    startups_mentored: int
    active_startups: int
    sessions_delivered: int
    current_signoffs: int
    readiness_change: None = None
    badges_attributed: None = None


class MentorDashboardRead(BaseModel):
    impact: ImpactRead
    earnings: EarningSummary
    mentorships: MentorshipPage


class StartupMentorshipOverview(BaseModel):
    mentorships: MentorshipPage
    active_count: int


class ScopedReadinessItem(ReadinessRead):
    # Untouched criteria have no persistent startup-readiness row yet.
    id: uuid.UUID | None  # type: ignore[assignment]


class ScopedReadinessBoard(BaseModel):
    org_id: uuid.UUID
    summary: ReadinessSummary
    items: list[ScopedReadinessItem]
