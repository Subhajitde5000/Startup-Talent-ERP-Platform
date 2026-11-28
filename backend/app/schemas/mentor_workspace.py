"""Read-only aggregates for mentorship workspaces (Step 8j).

Only numbers that can be derived from stored rows are exposed. Readiness
trends and badge attribution have no data behind them, so they are absent
rather than always-null placeholders (8j Q12).
"""

import uuid

from pydantic import BaseModel

from app.schemas.agreement import AgreementSummary
from app.schemas.earning import EarningSummary
from app.schemas.mentorship import MentorshipPage, MentorshipRead
from app.schemas.readiness import ReadinessRead, ReadinessSummary


class WorkspaceRead(BaseModel):
    mentorship: MentorshipRead
    completed_sessions: int
    open_deliverables: int
    # 8g: the version in force and any proposal awaiting signature. Null for
    # a startup viewer, who cannot see agreements (8g Q3). There is no
    # ``health`` field: no page renders one (8j Q11), so none is invented.
    agreement: AgreementSummary | None


class ImpactRead(BaseModel):
    startups_mentored: int
    active_startups: int
    sessions_delivered: int
    current_signoffs: int


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
