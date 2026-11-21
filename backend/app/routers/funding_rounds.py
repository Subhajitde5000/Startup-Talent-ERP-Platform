"""Startup funding-round endpoints."""
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.funding_round import RoundStatus
from app.models.user import User
from app.schemas.funding_round import (
    FundingRoundCreate,
    FundingRoundPage,
    FundingRoundRead,
    FundingRoundUpdate,
    RoundProgress,
    StatusChange,
)
from app.services import funding_round_service as service

router = APIRouter(prefix="/organizations/{org_id}/funding-rounds", tags=["funding rounds"])
DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]


@router.post("", response_model=FundingRoundRead, status_code=201)
async def create(org_id: uuid.UUID, payload: FundingRoundCreate, db: DB, user: Actor) -> FundingRoundRead:
    return await service.create(db, user, org_id, payload)


@router.get("", response_model=FundingRoundPage)
async def list_rounds(org_id: uuid.UUID, db: DB, user: Actor, limit: Annotated[int, Query(ge=1, le=100)] = 20, offset: Annotated[int, Query(ge=0)] = 0, status: RoundStatus | None = None, sort: Literal["name", "created_at", "status"] = "created_at", order: Literal["asc", "desc"] = "desc") -> FundingRoundPage:
    return await service.list_rounds(db, user, org_id, limit=limit, offset=offset, status=status, sort=sort, order=order)


@router.get("/{round_id}", response_model=FundingRoundRead)
async def get(org_id: uuid.UUID, round_id: uuid.UUID, db: DB, user: Actor) -> FundingRoundRead:
    return await service.get(db, user, org_id, round_id)


@router.get("/{round_id}/progress", response_model=RoundProgress)
async def progress(org_id: uuid.UUID, round_id: uuid.UUID, db: DB, user: Actor) -> RoundProgress:
    return await service.progress(db, user, org_id, round_id)


@router.patch("/{round_id}", response_model=FundingRoundRead)
async def update(org_id: uuid.UUID, round_id: uuid.UUID, payload: FundingRoundUpdate, db: DB, user: Actor) -> FundingRoundRead:
    return await service.update(db, user, org_id, round_id, payload)


@router.post("/{round_id}/status", response_model=FundingRoundRead)
async def status(org_id: uuid.UUID, round_id: uuid.UUID, payload: StatusChange, db: DB, user: Actor) -> FundingRoundRead:
    return await service.change_status(db, user, org_id, round_id, payload.status)


@router.delete("/{round_id}", status_code=204, response_class=Response)
async def delete(org_id: uuid.UUID, round_id: uuid.UUID, db: DB, user: Actor) -> None:
    await service.delete(db, user, org_id, round_id)
