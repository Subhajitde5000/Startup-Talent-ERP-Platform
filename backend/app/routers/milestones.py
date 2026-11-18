"""Milestone router (Step 5b).

Thin routes (AGENTS.md section 3): the actor always comes from the auth
dependency; path params are uuid.UUID so malformed ids 422 before any
service code runs. Object-level membership checks, org scoping (IDOR)
and owner validation live in milestone_service.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.milestone import MilestoneStatus
from app.models.user import User
from app.schemas.milestone import (
    MilestoneCreate,
    MilestonePage,
    MilestoneRead,
    MilestoneUpdate,
)
from app.services import milestone_service

router = APIRouter(prefix="/organizations", tags=["milestones"])


@router.post(
    "/{org_id}/milestones",
    response_model=MilestoneRead,
    status_code=201,
    summary="Create milestone",
)
async def create_milestone(
    org_id: uuid.UUID,
    payload: MilestoneCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MilestoneRead:
    """Owner/admin/member create (viewer 403). Owner defaults to the
    creator; a supplied owner must be an active member of this org
    (422 on body.owner_id)."""
    return await milestone_service.create_milestone(db, user, org_id, payload)


@router.get(
    "/{org_id}/milestones",
    response_model=MilestonePage,
    summary="List milestones",
)
async def list_milestones(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["target_date", "created_at", "name", "status"] = "target_date",
    order: Literal["asc", "desc"] = "asc",
    status: Annotated[MilestoneStatus | None, Query()] = None,
) -> MilestonePage:
    """Active members (including viewers) list the org's live milestones,
    paginated with whitelisted sort/filter fields."""
    return await milestone_service.list_milestones(
        db,
        user,
        org_id,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
        status=status,
    )


@router.get(
    "/{org_id}/milestones/{milestone_id}",
    response_model=MilestoneRead,
    summary="Get milestone",
)
async def get_milestone(
    org_id: uuid.UUID,
    milestone_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MilestoneRead:
    """Read one milestone; an id from another organization is 404."""
    return await milestone_service.get_milestone(db, user, org_id, milestone_id)


@router.patch(
    "/{org_id}/milestones/{milestone_id}",
    response_model=MilestoneRead,
    summary="Update milestone",
)
async def update_milestone(
    org_id: uuid.UUID,
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MilestoneRead:
    """Owner/admin/member patch (viewer 403). Server-controlled fields
    are rejected with 422 by extra=forbid."""
    return await milestone_service.update_milestone(
        db, user, org_id, milestone_id, payload
    )


@router.delete(
    "/{org_id}/milestones/{milestone_id}",
    status_code=204,
    summary="Delete milestone (soft)",
)
async def delete_milestone(
    org_id: uuid.UUID,
    milestone_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Soft delete (deleted_at set); repeat deletes are 404."""
    await milestone_service.delete_milestone(db, user, org_id, milestone_id)
