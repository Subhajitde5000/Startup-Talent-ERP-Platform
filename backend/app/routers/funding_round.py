"""Funding round router (Step 9a).

Thin routes only (AGENTS.md section 3): the actor comes from
``get_current_user``, ``org_id``/``round_id`` are ``uuid.UUID`` (a
malformed id is a 422 before any service code runs), and every guard,
org-scoped lookup, state machine and rate limit lives in
``funding_round_service``.

Routes:

- ``POST /organizations/{org_id}/funding-rounds`` — create (201).
- ``GET /organizations/{org_id}/funding-rounds`` — paginated list.
- ``GET /organizations/{org_id}/funding-rounds/summary`` — header roll-up.
- ``GET /organizations/{org_id}/funding-rounds/{round_id}`` — detail.
- ``PATCH /organizations/{org_id}/funding-rounds/{round_id}`` — edit.
- ``POST /organizations/{org_id}/funding-rounds/{round_id}/status`` — transition.
- ``DELETE /organizations/{org_id}/funding-rounds/{round_id}`` — soft delete.

``committed_amount`` and ``status`` are never accepted from the client:
they are absent from the Create/Update schemas (``extra="forbid"`` ->
422) and ``status`` only changes via the transition endpoint.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.funding_round import RoundStatus
from app.models.user import User
from app.schemas.funding_round import (
    FundingRoundCreate,
    FundingRoundPage,
    FundingRoundRead,
    FundingRoundSummary,
    FundingRoundUpdate,
    StatusTransition,
)
from app.services import funding_round_service

router = APIRouter(prefix="/organizations", tags=["funding-rounds"])


@router.post(
    "/{org_id}/funding-rounds",
    response_model=FundingRoundRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a funding round",
)
async def create_funding_round(
    org_id: uuid.UUID,
    payload: FundingRoundCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> FundingRoundRead:
    """Owner/admin/member of the startup; viewer gets 403.

    ``committed_amount`` starts at 0 (server-only in 9a).
    """
    return await funding_round_service.create(db, user, org_id, payload)


@router.get(
    "/{org_id}/funding-rounds",
    response_model=FundingRoundPage,
    summary="List a startup's funding rounds",
)
async def list_funding_rounds(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status_filter: Annotated[
        RoundStatus | None, Query(alias="status", description="Filter by round status")
    ] = None,
    sort: Annotated[str, Query(description="created_at | closes_on | name")] = "created_at",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FundingRoundPage:
    """Any active member may read (viewer included).

    Sort keys are whitelisted by the service; an unknown key is a 422
    (the ``Literal``-style guard happens in the service dict lookup).
    """
    items, total = await funding_round_service.list_rounds(
        db, user, org_id, status=status_filter, sort=sort, limit=limit, offset=offset
    )
    return FundingRoundPage(
        items=list(items), total=total, limit=limit, offset=offset, has_more=offset + len(items) < total
    )


@router.get(
    "/{org_id}/funding-rounds/summary",
    response_model=FundingRoundSummary,
    summary="Startup rounds summary",
)
async def funding_rounds_summary(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> FundingRoundSummary:
    """Total target / committed / open-round counts in one aggregate query."""
    return await funding_round_service.summary(db, user, org_id)


@router.get(
    "/{org_id}/funding-rounds/{round_id}",
    response_model=FundingRoundRead,
    summary="Get a funding round",
)
async def get_funding_round(
    org_id: uuid.UUID,
    round_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> FundingRoundRead:
    """A foreign or deleted round is a 404 (no existence oracle)."""
    return await funding_round_service.get_round(db, user, org_id, round_id)


@router.patch(
    "/{org_id}/funding-rounds/{round_id}",
    response_model=FundingRoundRead,
    summary="Edit a funding round",
)
async def update_funding_round(
    org_id: uuid.UUID,
    round_id: uuid.UUID,
    payload: FundingRoundUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> FundingRoundRead:
    """Owner/admin/member; ``status``/``committed_amount`` are not editable."""
    return await funding_round_service.update_round(db, user, org_id, round_id, payload)


@router.post(
    "/{org_id}/funding-rounds/{round_id}/status",
    response_model=FundingRoundRead,
    summary="Change a round's status",
)
async def change_funding_round_status(
    org_id: uuid.UUID,
    round_id: uuid.UUID,
    payload: StatusTransition,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> FundingRoundRead:
    """Only through the defined lifecycle; an invalid move is a 409."""
    return await funding_round_service.transition_status(
        db, user, org_id, round_id, payload.status
    )


@router.delete(
    "/{org_id}/funding-rounds/{round_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a funding round",
)
async def delete_funding_round(
    org_id: uuid.UUID,
    round_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Sets ``deleted_at``; a repeat delete is a 404."""
    await funding_round_service.delete_round(db, user, org_id, round_id)
