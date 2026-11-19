"""Market router (Step 5l): market size and competitors.

Thin routes (AGENTS.md section 3): the actor always comes from the auth
dependency; path params are ``uuid.UUID`` so malformed ids 422 before any
service code runs. Membership, org scoping (IDOR), the client-writable
``source_type`` set and the unique-name rule live in ``market_service``.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.analytics import CompetitorType
from app.models.user import User
from app.schemas.analytics import (
    CompetitorCreate,
    CompetitorPage,
    CompetitorRead,
    CompetitorUpdate,
    MarketSizeBoard,
    MarketSizeRead,
    MarketSizeUpsert,
)
from app.services import market_service

router = APIRouter(prefix="/organizations", tags=["market"])


# --- market size -------------------------------------------------------------


@router.put(
    "/{org_id}/market-size",
    response_model=MarketSizeRead,
    summary="Write a market size (upsert)",
)
async def upsert_market_size(
    org_id: uuid.UUID,
    payload: MarketSizeUpsert,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MarketSizeRead:
    """Owner/admin/member (viewer 403). One row per (metric, scenario), so a
    second write for the same figure edits it. ``source_type`` may only be
    ``team_estimate`` or ``external_report``."""
    return await market_service.upsert_market_size(db, user, org_id, payload)


@router.get(
    "/{org_id}/market-size",
    response_model=MarketSizeBoard,
    summary="Market size board",
)
async def list_market_size(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MarketSizeBoard:
    """Any active member. ``missing`` names the (metric, scenario) pairs with
    no figure yet; ``market_share_pct`` is None whenever it cannot be
    computed honestly."""
    return await market_service.list_market_size(db, user, org_id)


@router.delete(
    "/{org_id}/market-size/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a market size",
)
async def delete_market_size(
    org_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Owner/admin/member (viewer 403); a foreign id is 404."""
    await market_service.delete_market_size(db, user, org_id, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- competitors -------------------------------------------------------------


@router.post(
    "/{org_id}/competitors",
    response_model=CompetitorRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a competitor",
)
async def create_competitor(
    org_id: uuid.UUID,
    payload: CompetitorCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> CompetitorRead:
    """Owner/admin/member (viewer 403). A name already tracked in this
    organization is a 409."""
    return await market_service.create_competitor(db, user, org_id, payload)


@router.get(
    "/{org_id}/competitors",
    response_model=CompetitorPage,
    summary="List competitors",
)
async def list_competitors(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    type: Annotated[CompetitorType | None, Query()] = None,  # noqa: A002
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CompetitorPage:
    """Any active member. Soft-deleted competitors are never returned."""
    return await market_service.list_competitors(
        db, user, org_id, competitor_type=type, limit=limit, offset=offset
    )


@router.patch(
    "/{org_id}/competitors/{competitor_id}",
    response_model=CompetitorRead,
    summary="Update a competitor",
)
async def update_competitor(
    org_id: uuid.UUID,
    competitor_id: uuid.UUID,
    payload: CompetitorUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> CompetitorRead:
    """Owner/admin/member (viewer 403); only the fields sent are changed. A
    foreign or deleted competitor id is 404."""
    return await market_service.update_competitor(
        db, user, org_id, competitor_id, payload
    )


@router.delete(
    "/{org_id}/competitors/{competitor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a competitor",
)
async def delete_competitor(
    org_id: uuid.UUID,
    competitor_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Owner/admin/member (viewer 403). Soft delete: the row survives so the
    competitor can be re-added later."""
    await market_service.delete_competitor(db, user, org_id, competitor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
