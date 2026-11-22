"""Commitment and portfolio-holding router (Step 9j).

Investor side under ``/investors/commitments`` and
``/investors/portfolio`` (the caller's own firm, resolved from
membership). Status changes are dedicated endpoints
(``/commitments/{id}/status``, ``/portfolio/{id}/status``) — never a
free-form status update (BUILD_PLAN 9i/9j note).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.commitment import CommitmentStatus
from app.models.user import User
from app.schemas.commitment import (
    CommitmentCreate,
    CommitmentPage,
    CommitmentRead,
    CommitmentStatusUpdate,
    CommitmentUpdate,
    HoldingCreate,
    HoldingPage,
    HoldingRead,
    HoldingStatusUpdate,
    HoldingUpdate,
)
from app.services import commitment_service

router = APIRouter(tags=["commitments and portfolio"])


# --- commitments -----------------------------------------------------------


@router.get(
    "/investors/commitments",
    response_model=CommitmentPage,
    summary="List the investor's commitments",
)
async def list_commitments(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: CommitmentStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CommitmentPage:
    items, total = await commitment_service.list_commitments(
        db, user, status=status, limit=limit, offset=offset
    )
    return CommitmentPage(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/investors/commitments",
    response_model=CommitmentRead,
    status_code=201,
    summary="Create a commitment (pledged)",
)
async def create_commitment(
    payload: CommitmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> CommitmentRead:
    return await commitment_service.create_commitment(db, user, payload)


@router.get(
    "/investors/commitments/{commitment_id}",
    response_model=CommitmentRead,
    summary="One commitment",
)
async def get_commitment(
    commitment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> CommitmentRead:
    return await commitment_service.get_commitment(db, user, commitment_id)


@router.patch(
    "/investors/commitments/{commitment_id}",
    response_model=CommitmentRead,
    summary="Update a commitment (reference, dates; status is not writable)",
)
async def update_commitment(
    commitment_id: uuid.UUID,
    payload: CommitmentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> CommitmentRead:
    return await commitment_service.update_commitment(
        db, user, commitment_id, payload
    )


@router.post(
    "/investors/commitments/{commitment_id}/status",
    response_model=CommitmentRead,
    summary="Transition a commitment (documented / funded / cancelled)",
)
async def transition_commitment(
    commitment_id: uuid.UUID,
    payload: CommitmentStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> CommitmentRead:
    return await commitment_service.transition_commitment(
        db, user, commitment_id, payload.status
    )


# --- portfolio holdings -----------------------------------------------------


@router.get(
    "/investors/portfolio",
    response_model=HoldingPage,
    summary="List the investor's portfolio holdings",
)
async def list_holdings(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> HoldingPage:
    items, total = await commitment_service.list_holdings(
        db, user, status=status, limit=limit, offset=offset
    )
    return HoldingPage(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/investors/portfolio",
    response_model=HoldingRead,
    status_code=201,
    summary="Create a portfolio holding (active)",
)
async def create_holding(
    payload: HoldingCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> HoldingRead:
    return await commitment_service.create_holding(db, user, payload)


@router.get(
    "/investors/portfolio/{holding_id}",
    response_model=HoldingRead,
    summary="One portfolio holding",
)
async def get_holding(
    holding_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> HoldingRead:
    return await commitment_service.get_holding(db, user, holding_id)


@router.patch(
    "/investors/portfolio/{holding_id}",
    response_model=HoldingRead,
    summary="Update a holding (terms; status is not writable)",
)
async def update_holding(
    holding_id: uuid.UUID,
    payload: HoldingUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> HoldingRead:
    return await commitment_service.update_holding(db, user, holding_id, payload)


@router.post(
    "/investors/portfolio/{holding_id}/status",
    response_model=HoldingRead,
    summary="Transition a holding (written_off / exited / partially_exited)",
)
async def transition_holding(
    holding_id: uuid.UUID,
    payload: HoldingStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> HoldingRead:
    return await commitment_service.transition_holding(
        db, user, holding_id, payload.status, payload.exited_on, payload.exit_value
    )


__all__ = [
    "create_commitment",
    "create_holding",
    "get_commitment",
    "get_holding",
    "list_commitments",
    "list_holdings",
    "transition_commitment",
    "transition_holding",
    "update_commitment",
    "update_holding",
]
