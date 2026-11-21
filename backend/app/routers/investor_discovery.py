"""Investor-side startup discovery router (Step 9c).

Read-only endpoints under ``/investors/startups``. Any signed-in user
(the 5h visibility rules apply). The ``/filters`` route is declared
before ``/{identifier}`` so it is not matched as an identifier.
"""

from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.startup import StartupStage
from app.models.user import User
from app.schemas.investor_discovery import (
    InvestorRoundPage,
    InvestorStartupDetail,
    InvestorStartupFilters,
    InvestorStartupPage,
)
from app.services import investor_discovery_service

router = APIRouter(tags=["investor discovery"])


@router.get(
    "/investors/startups",
    response_model=InvestorStartupPage,
    summary="Discover startups (investor view)",
)
async def list_startups(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["recent", "name", "stage"] = "recent",
    order: Literal["asc", "desc"] = "desc",
    stage: StartupStage | None = None,
    sector: Annotated[str | None, Query(max_length=120)] = None,
    city: Annotated[str | None, Query(max_length=120)] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    raise_min: Annotated[Decimal | None, Query(ge=0, decimal_places=2)] = None,
    raise_max: Annotated[Decimal | None, Query(ge=0, decimal_places=2)] = None,
    investment_ready_only: bool = False,
) -> InvestorStartupPage:
    items, total = await investor_discovery_service.list_startups(
        db,
        user,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
        stage=stage,
        sector=sector,
        city=city,
        q=q,
        raise_min=raise_min,
        raise_max=raise_max,
        investment_ready_only=investment_ready_only,
    )
    return InvestorStartupPage(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/investors/startups/filters",
    response_model=InvestorStartupFilters,
    summary="Discovery filter facets",
)
async def filters(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorStartupFilters:
    return await investor_discovery_service.filters(db, user)


@router.get(
    "/investors/startups/{identifier}",
    response_model=InvestorStartupDetail,
    summary="One startup (investor view)",
)
async def get_startup(
    identifier: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorStartupDetail:
    return await investor_discovery_service.get_startup(db, user, identifier)


@router.get(
    "/investors/startups/{identifier}/rounds",
    response_model=InvestorRoundPage,
    summary="A startup's funding rounds (investor view)",
)
async def list_rounds(
    identifier: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> InvestorRoundPage:
    items, total = await investor_discovery_service.list_rounds(
        db, user, identifier, limit=limit, offset=offset
    )
    return InvestorRoundPage(items=items, total=total, limit=limit, offset=offset)


__all__ = ["filters", "get_startup", "list_rounds", "list_startups"]
