"""Step 9m router: startup investor hub read endpoints.

Mounted under ``API_V1_PREFIX`` (``/api/v1``), so the full paths are
``/api/v1/organizations/{org_id}/investor-hub/{summary,rounds,activity,
activity/stats}``.

All endpoints are read-only ``GET`` and accept any active org member
(owner/admin/member/viewer). ``org_id`` is ``uuid.UUID`` (AGENTS.md
section 3 — a malformed id is a 422 before any service code runs). The
startup org is resolved via the shared ``startup_org_or_404`` helper
(wrong type / suspended / deleted → 404, no existence oracle) and
membership is enforced with ``require_membership(write=False)``
(viewer allowed).

There is no write surface in this router — visibility settings are
edited through the existing Step 5a
``GET/PATCH /organizations/{org_id}/startup-profile`` endpoint.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.investor_hub import (
    InvestorHubSummary,
    RoundProgressPage,
)
from app.schemas.investor_workspace import ActivityPage, ActivityStats
from app.services import investor_hub_service

router = APIRouter(prefix="/organizations/{org_id}/investor-hub", tags=["investor-hub"])


@router.get("/summary", response_model=InvestorHubSummary, summary="Startup investor hub summary")
async def hub_summary(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvestorHubSummary:
    return await investor_hub_service.summary(db, user, org_id)


@router.get(
    "/rounds", response_model=RoundProgressPage, summary="Hub rounds with investor progress"
)
async def hub_rounds(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> RoundProgressPage:
    return await investor_hub_service.rounds(db, user, org_id, limit=limit, offset=offset)


@router.get("/activity", response_model=ActivityPage, summary="Startup activity feed (paginated)")
async def hub_activity(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    event_type: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ActivityPage:
    items, total = await investor_hub_service.list_activity(
        db, user, org_id, event_type=event_type, limit=limit, offset=offset
    )
    return ActivityPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/activity/stats", response_model=ActivityStats, summary="Startup activity aggregates")
async def hub_activity_stats(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ActivityStats:
    return await investor_hub_service.activity_stats(db, user, org_id)
