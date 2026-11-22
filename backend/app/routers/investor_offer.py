"""Investor offer router (Step 9i).

Investor side under ``/investors/offers`` (the caller's own firm,
resolved from membership); startup side under
``/organizations/{org_id}/investor-offers`` (the caller's startup).
Status transitions are dedicated endpoints (send / counter / withdraw /
accept / decline) — never a free-form status update (BUILD_PLAN 9i).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.investor_offer import OfferStatus
from app.models.user import User
from app.schemas.investor_offer import (
    InvestorOfferCounter,
    InvestorOfferCreate,
    InvestorOfferPage,
    InvestorOfferRead,
    InvestorOfferUpdate,
    OfferHistoryPage,
    StartupOfferPage,
    StartupOfferRead,
)
from app.services import investor_offer_service

router = APIRouter(tags=["investor offers"])


# --- investor side ---------------------------------------------------------


@router.get(
    "/investors/offers",
    response_model=InvestorOfferPage,
    summary="List the investor's offers",
)
async def list_offers(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: OfferStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> InvestorOfferPage:
    items, total = await investor_offer_service.list_offers(
        db, user, status=status, limit=limit, offset=offset
    )
    return InvestorOfferPage(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/investors/offers",
    response_model=InvestorOfferRead,
    status_code=201,
    summary="Create offer version v1 (draft)",
)
async def create_offer(
    payload: InvestorOfferCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorOfferRead:
    return await investor_offer_service.create_offer(db, user, payload)


@router.get(
    "/investors/offers/{offer_id}",
    response_model=InvestorOfferRead,
    summary="One offer version",
)
async def get_offer(
    offer_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorOfferRead:
    return await investor_offer_service.get_offer(db, user, offer_id)


@router.patch(
    "/investors/offers/{offer_id}",
    response_model=InvestorOfferRead,
    summary="Update an offer (terms only; status is not writable)",
)
async def update_offer(
    offer_id: uuid.UUID,
    payload: InvestorOfferUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorOfferRead:
    return await investor_offer_service.update_offer(db, user, offer_id, payload)


@router.post(
    "/investors/offers/{offer_id}/send",
    response_model=InvestorOfferRead,
    summary="Send a draft offer (draft -> sent)",
)
async def send_offer(
    offer_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorOfferRead:
    return await investor_offer_service.send_offer(db, user, offer_id)


@router.post(
    "/investors/offers/{offer_id}/counter",
    response_model=InvestorOfferRead,
    status_code=201,
    summary="Counter with a new offer version",
)
async def counter_offer(
    offer_id: uuid.UUID,
    payload: InvestorOfferCounter,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorOfferRead:
    return await investor_offer_service.counter_offer(db, user, offer_id, payload)


@router.post(
    "/investors/offers/{offer_id}/withdraw",
    status_code=204,
    summary="Withdraw an offer",
)
async def withdraw_offer(
    offer_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    await investor_offer_service.withdraw_offer(db, user, offer_id)
    return Response(status_code=204)


@router.get(
    "/investors/offers/{offer_id}/history",
    response_model=OfferHistoryPage,
    summary="Version history of an offer",
)
async def offer_history(
    offer_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> OfferHistoryPage:
    return await investor_offer_service.offer_history(
        db, user, offer_id, limit=limit, offset=offset
    )


# --- startup side ----------------------------------------------------------


@router.get(
    "/organizations/{org_id}/investor-offers",
    response_model=StartupOfferPage,
    summary="Offers on this startup's rounds (latest version per investor)",
)
async def list_startup_offers(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> StartupOfferPage:
    items, total = await investor_offer_service.list_startup_offers(
        db, user, org_id, limit=limit, offset=offset
    )
    return StartupOfferPage(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/organizations/{org_id}/investor-offers/{offer_id}",
    response_model=StartupOfferRead,
    summary="One offer (latest version, investor-private fields stripped)",
)
async def get_startup_offer(
    org_id: uuid.UUID,
    offer_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupOfferRead:
    return await investor_offer_service.get_startup_offer(
        db, user, org_id, offer_id
    )


@router.post(
    "/organizations/{org_id}/investor-offers/{offer_id}/accept",
    response_model=StartupOfferRead,
    summary="Accept the latest offer version",
)
async def accept_offer(
    org_id: uuid.UUID,
    offer_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupOfferRead:
    return await investor_offer_service.accept_offer(db, user, org_id, offer_id)


@router.post(
    "/organizations/{org_id}/investor-offers/{offer_id}/decline",
    response_model=StartupOfferRead,
    summary="Decline the latest offer version",
)
async def decline_offer(
    org_id: uuid.UUID,
    offer_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupOfferRead:
    return await investor_offer_service.decline_offer(db, user, org_id, offer_id)


__all__ = [
    "accept_offer",
    "counter_offer",
    "create_offer",
    "decline_offer",
    "get_offer",
    "get_startup_offer",
    "list_offers",
    "list_startup_offers",
    "offer_history",
    "send_offer",
    "update_offer",
    "withdraw_offer",
]
