"""Step 8j mentor and startup workspace summaries."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.mentor_workspace import (
    ImpactRead,
    MentorDashboardRead,
    ScopedReadinessBoard,
    StartupMentorshipOverview,
    WorkspaceRead,
)
from app.services import mentor_workspace_service

router = APIRouter(tags=["mentor-workspace"])
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Mentor = Annotated[User, Depends(require_role(UserRole.mentor))]
Limit = Annotated[int, Query(ge=1, le=50)]
Offset = Annotated[int, Query(ge=0)]


@router.get("/mentorships/{mentorship_id}/workspace", response_model=WorkspaceRead)
async def workspace(mentorship_id: uuid.UUID, db: DB, user: CurrentUser) -> WorkspaceRead:
    return await mentor_workspace_service.workspace(db, user, mentorship_id)


@router.get("/mentorships/{mentorship_id}/readiness", response_model=ScopedReadinessBoard)
async def readiness(mentorship_id: uuid.UUID, db: DB, user: CurrentUser) -> ScopedReadinessBoard:
    return await mentor_workspace_service.readiness(db, user, mentorship_id)


@router.get("/mentor/impact", response_model=ImpactRead)
async def impact(db: DB, user: Mentor) -> ImpactRead:
    return await mentor_workspace_service.impact(db, user)


@router.get("/mentor/dashboard", response_model=MentorDashboardRead)
async def dashboard(
    db: DB, user: Mentor, limit: Limit = 20, offset: Offset = 0
) -> MentorDashboardRead:
    return await mentor_workspace_service.dashboard(db, user, limit, offset)


@router.get(
    "/organizations/{org_id}/mentorships/overview", response_model=StartupMentorshipOverview
)
async def org_overview(
    org_id: uuid.UUID, db: DB, user: CurrentUser, limit: Limit = 20, offset: Offset = 0
) -> StartupMentorshipOverview:
    return await mentor_workspace_service.org_overview(db, user, org_id, limit, offset)
