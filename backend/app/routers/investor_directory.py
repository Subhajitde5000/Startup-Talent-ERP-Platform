"""Investor directory router (Step 9b).

Startup-side, read-only endpoints under
``/organizations/{org_id}/investors``. The org in the path is the
caller's STARTUP (any role, including viewer); every function in the
service re-checks membership.
"""

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import validation_error
from app.db.session import get_db
from app.models.investor_search import InvestorType
from app.models.startup import StartupStage
from app.models.user import User
from app.schemas.investor_directory import (
    InvestorDirectoryDetail,
    InvestorDirectoryFacets,
    InvestorDirectoryPage,
    InvestorDirectorySummary,
)
from app.services import investor_directory_service

router = APIRouter(tags=["investor directory"])


@router.get(
    "/organizations/{org_id}/investors",
    response_model=InvestorDirectoryPage,
    summary="Search the investor directory",
)
async def list_investors(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: Annotated[str | None, Query(max_length=100)] = None,
    investor_type: InvestorType | None = None,
    sector: Annotated[str | None, Query(max_length=120)] = None,
    stage_focus: StartupStage | None = None,
    ticket_min: Annotated[Decimal | None, Query(ge=0, decimal_places=2)] = None,
    ticket_max: Annotated[Decimal | None, Query(ge=0, decimal_places=2)] = None,
    location: Annotated[str | None, Query(max_length=120)] = None,
    verified_only: bool = False,
    sort: str = "recent",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> InvestorDirectoryPage:
    if ticket_min is not None and ticket_max is not None and ticket_min > ticket_max:
        raise validation_error("ticket_min must not exceed ticket_max.")
    items, total = await investor_directory_service.list_investors(
        db,
        user,
        org_id,
        q=q,
        investor_type=investor_type,
        sector=sector,
        stage_focus=stage_focus,
        ticket_min=ticket_min,
        ticket_max=ticket_max,
        location=location,
        verified_only=verified_only,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return InvestorDirectoryPage(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/organizations/{org_id}/investors/summary",
    response_model=InvestorDirectorySummary,
    summary="Directory header counts",
)
async def summary(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvestorDirectorySummary:
    return await investor_directory_service.summary(db, user, org_id)


@router.get(
    "/organizations/{org_id}/investors/filters",
    response_model=InvestorDirectoryFacets,
    summary="Directory filter facets",
)
async def filters(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvestorDirectoryFacets:
    return await investor_directory_service.facets(db, user, org_id)


@router.get(
    "/organizations/{org_id}/investors/{investor_org_id}",
    response_model=InvestorDirectoryDetail,
    summary="One investor firm",
)
async def get_investor(
    org_id: uuid.UUID,
    investor_org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvestorDirectoryDetail:
    return await investor_directory_service.get_investor(
        db, user, org_id, investor_org_id
    )


__all__ = [
    "filters",
    "get_investor",
    "list_investors",
    "summary",
]
