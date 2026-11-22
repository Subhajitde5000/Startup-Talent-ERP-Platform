"""Investor workspace router (Step 9l): dashboard, insights, activity.

Read-only aggregation endpoints under ``/investors/dashboard``,
``/investors/insights`` and ``/investors/activity``. The caller's
firm is resolved from membership; all reads are org-scoped.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.investor_workspace import (
    ActivityPage,
    ActivityStats,
    DashboardSummary,
    InsightsResponse,
)
from app.services import investor_workspace_service

router = APIRouter(tags=["investor workspace"])


@router.get(
    "/investors/dashboard/summary",
    response_model=DashboardSummary,
    summary="Dashboard top stat strip + sidebar cards",
)
async def dashboard_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DashboardSummary:
    return await investor_workspace_service.dashboard_summary(db, user)


@router.get(
    "/investors/insights",
    response_model=InsightsResponse,
    summary="Descriptive platform + private funnel stats (no forecasts)",
)
async def insights(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InsightsResponse:
    return await investor_workspace_service.insights(db, user)


@router.get(
    "/investors/activity",
    response_model=ActivityPage,
    summary="The investor org's activity events",
)
async def list_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    event_type: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ActivityPage:
    items, total = await investor_workspace_service.list_activity(
        db, user, event_type=event_type, limit=limit, offset=offset
    )
    return ActivityPage(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/investors/activity/stats",
    response_model=ActivityStats,
    summary="Aggregate activity stats for the investor org",
)
async def activity_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ActivityStats:
    return await investor_workspace_service.activity_stats(db, user)


__all__ = [
    "activity_stats",
    "dashboard_summary",
    "insights",
    "list_activity",
]
