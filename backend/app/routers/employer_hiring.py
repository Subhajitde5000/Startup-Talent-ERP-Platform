"""Step 7l employer hiring dashboard, analytics and activity.

Three read-only endpoints, org-scoped to an active employer OR startup
organization (a startup hires too, BUILD_PLAN 7r). Any active member —
including viewers — may read; the pipeline is the org's own data, not
personal PII. Org scoping and the 404/403 split live in
``employer_hiring_service`` (mirrors the 7a ``_authorize`` rule: wrong org
type / suspended / deleted -> 404, non-member of a live org -> 403).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.jobs import _ErrorResponse
from app.schemas.employer_hiring import ActivityPage, HiringAnalytics, HiringDashboard
from app.services import employer_hiring_service

router = APIRouter(
    prefix="/organizations/{org_id}/hiring",
    tags=["employer-hiring"],
    responses={
        401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
        403: {
            "model": _ErrorResponse,
            "description": "Not an active member of this organization",
        },
        404: {
            "model": _ErrorResponse,
            "description": "Organization unavailable or outside your scope",
        },
        429: {"model": _ErrorResponse, "description": "Analytics rate limit exceeded"},
    },
)

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get(
    "/dashboard",
    response_model=HiringDashboard,
    summary="Employer hiring dashboard",
)
async def hiring_dashboard(org_id: uuid.UUID, db: DB, user: Actor) -> dict:
    """KPI strip, active jobs with applicant counts, attention cues, recent activity."""
    return await employer_hiring_service.dashboard(db, user, org_id)


@router.get(
    "/analytics",
    response_model=HiringAnalytics,
    summary="Hiring funnel and velocity",
)
async def hiring_analytics(org_id: uuid.UUID, db: DB, user: Actor) -> dict:
    """Aggregate funnel, time-to-hire / time-to-first-interview, per-job breakdown."""
    return await employer_hiring_service.analytics(db, user, org_id)


@router.get(
    "/activity",
    response_model=ActivityPage,
    summary="Hiring activity feed",
)
async def hiring_activity(
    org_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> dict:
    """Paginated ``activity_events`` for the organization, newest first."""
    return await employer_hiring_service.activity_feed(db, user, org_id, limit=limit, offset=offset)
