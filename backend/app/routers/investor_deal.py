"""Investor pipeline router (Step 9e).

Investor side under ``/investors/deals`` (the caller's own firm,
resolved from membership); startup side under
``/organizations/{org_id}/investor-deals`` (the caller's startup). The
``/summary`` route is declared before ``/{deal_id}`` so it is not
matched as a deal id.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.investor_deal import PipelineStage
from app.models.user import User
from app.schemas.investor_deal import (
    InvestorDealCreate,
    InvestorDealHistoryPage,
    InvestorDealPage,
    InvestorDealRead,
    InvestorDealSummary,
    InvestorDealUpdate,
    StartupInvestorDealPage,
    StartupInvestorDealRead,
    StartupInvestorDealStageUpdate,
)
from app.services import investor_deal_service

router = APIRouter(tags=["investor pipeline"])


# --- investor side ---------------------------------------------------------


@router.get(
    "/investors/deals",
    response_model=InvestorDealPage,
    summary="List the investor's deals",
)
async def list_deals(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    stage: PipelineStage | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> InvestorDealPage:
    items, total = await investor_deal_service.list_deals(
        db, user, stage=stage, q=q, limit=limit, offset=offset
    )
    return InvestorDealPage(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/investors/deals",
    response_model=InvestorDealRead,
    status_code=201,
    summary="Create a deal",
)
async def create_deal(
    payload: InvestorDealCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorDealRead:
    return await investor_deal_service.create_deal(db, user, payload)


@router.get(
    "/investors/deals/summary",
    response_model=InvestorDealSummary,
    summary="Deal counts per stage",
)
async def summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorDealSummary:
    return await investor_deal_service.summary(db, user)


@router.get(
    "/investors/deals/{deal_id}",
    response_model=InvestorDealRead,
    summary="One deal",
)
async def get_deal(
    deal_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorDealRead:
    return await investor_deal_service.get_deal(db, user, deal_id)


@router.patch(
    "/investors/deals/{deal_id}",
    response_model=InvestorDealRead,
    summary="Update a deal",
)
async def update_deal(
    deal_id: uuid.UUID,
    payload: InvestorDealUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorDealRead:
    return await investor_deal_service.update_deal(db, user, deal_id, payload)


@router.delete(
    "/investors/deals/{deal_id}",
    status_code=204,
    summary="Delete a deal",
)
async def delete_deal(
    deal_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    await investor_deal_service.delete_deal(db, user, deal_id)
    return Response(status_code=204)


@router.get(
    "/investors/deals/{deal_id}/history",
    response_model=InvestorDealHistoryPage,
    summary="Stage history of a deal",
)
async def deal_history(
    deal_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> InvestorDealHistoryPage:
    return await investor_deal_service.deal_history(
        db, user, deal_id, limit=limit, offset=offset
    )


# --- startup side ---------------------------------------------------------


@router.get(
    "/organizations/{org_id}/investor-deals",
    response_model=StartupInvestorDealPage,
    summary="List investors dealing with this startup",
)
async def list_startup_deals(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> StartupInvestorDealPage:
    items, total = await investor_deal_service.list_startup_deals(
        db, user, org_id, limit=limit, offset=offset
    )
    return StartupInvestorDealPage(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/organizations/{org_id}/investor-deals/{investor_org_id}",
    response_model=StartupInvestorDealRead,
    summary="One investor's deal with this startup",
)
async def get_startup_deal(
    org_id: uuid.UUID,
    investor_org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupInvestorDealRead:
    return await investor_deal_service.get_startup_deal(
        db, user, org_id, investor_org_id
    )


@router.patch(
    "/organizations/{org_id}/investor-deals/{investor_org_id}",
    response_model=StartupInvestorDealRead,
    summary="Update the shared deal stage (startup side)",
)
async def update_startup_deal_stage(
    org_id: uuid.UUID,
    investor_org_id: uuid.UUID,
    payload: StartupInvestorDealStageUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupInvestorDealRead:
    return await investor_deal_service.update_startup_deal_stage(
        db, user, org_id, investor_org_id, payload.stage
    )


__all__ = [
    "create_deal",
    "deal_history",
    "delete_deal",
    "get_deal",
    "get_startup_deal",
    "list_deals",
    "list_startup_deals",
    "summary",
    "update_deal",
    "update_startup_deal_stage",
]
