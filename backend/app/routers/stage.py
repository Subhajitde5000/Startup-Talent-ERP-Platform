"""Stage endpoints (Steps 5i + 5j).

Everything hangs off an organization the caller must be an active member
of, mirroring the 5a/5b/5f routers. Reads allow viewers; writes exclude
them (``stage_service`` enforces, this module only wires).

``{stage}`` is a ``StartupStage`` path enum, so an invalid value is a 422
from FastAPI before any query runs. Tool routes are keyed by ``tool_key``
and never by an id, so there is no global row id to tamper with.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.startup import StartupStage
from app.models.user import User
from app.schemas.stage import (
    StageChange,
    StageCriteriaBoard,
    StageHistoryPage,
    StageSummary,
    StageToolBoard,
    StageToolRead,
    StageToolUpdate,
)
from app.services import organization_service, stage_service

router = APIRouter(prefix="/organizations", tags=["stage"])


@router.get(
    "/{org_id}/stage",
    response_model=StageSummary,
    summary="Current stage, since when, and exit-criteria progress",
)
async def get_stage(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StageSummary:
    """Active members (including viewers) read the stage summary."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    return await stage_service.get_summary(db, org.id)


@router.patch(
    "/{org_id}/stage",
    response_model=StageSummary,
    summary="Change the startup stage (records history)",
)
async def change_stage(
    org_id: uuid.UUID,
    payload: StageChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StageSummary:
    """Owner/admin/member. The history row is written in the same
    transaction; a stage change never alters readiness sign-offs."""
    return await stage_service.change_stage(db, user, org_id, payload)


@router.get(
    "/{org_id}/stage/history",
    response_model=StageHistoryPage,
    summary="Stage change history",
)
async def list_stage_history(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> StageHistoryPage:
    return await stage_service.list_history(
        db, user, org_id, limit=limit, offset=offset
    )


@router.get(
    "/{org_id}/stage/{stage}/criteria",
    response_model=StageCriteriaBoard,
    summary="Exit criteria for one stage, with this org's state",
)
async def get_stage_criteria(
    org_id: uuid.UUID,
    stage: StartupStage,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StageCriteriaBoard:
    """The rows are ``startup_readiness`` rows (5i D1): the same evidence,
    status and sign-off fields the 5f readiness page uses."""
    return await stage_service.get_stage_criteria(db, user, org_id, stage)


@router.get(
    "/{org_id}/stage/tools",
    response_model=StageToolBoard,
    summary="Stage tools with saved progress",
)
async def get_stage_tools(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    stage: Annotated[StartupStage, Query()] = StartupStage.idea,
) -> StageToolBoard:
    """Stage comes from the query string; the vocabulary decides the keys."""
    return await stage_service.get_tools(db, user, org_id, stage)


@router.get(
    "/{org_id}/stage/tools/{tool_key}",
    response_model=StageToolRead,
    summary="One stage tool",
)
async def get_stage_tool(
    org_id: uuid.UUID,
    tool_key: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StageToolRead:
    return await stage_service.get_tool(db, user, org_id, tool_key)


@router.patch(
    "/{org_id}/stage/tools/{tool_key}",
    response_model=StageToolRead,
    summary="Save stage tool progress and notes",
)
async def update_stage_tool(
    org_id: uuid.UUID,
    tool_key: str,
    payload: StageToolUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StageToolRead:
    """Owner/admin/member only (viewers 403). ``stage``/``tool_key``/
    ``updated_by`` are server-controlled and absent from the body schema."""
    return await stage_service.update_tool(db, user, org_id, tool_key, payload)
