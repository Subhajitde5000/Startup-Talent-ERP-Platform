"""Startup-facing verified investor directory; read-only in Step 9b."""
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.investor_directory import InvestorDirectoryItem, InvestorDirectoryPage
from app.services import investor_directory_service

router = APIRouter(prefix="/organizations/{startup_org_id}/investors", tags=["investor directory"])


@router.get("", response_model=InvestorDirectoryPage, summary="Search verified investor firms")
async def list_investors(
    startup_org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[str | None, Query(max_length=100)] = None,
    city: Annotated[str | None, Query(max_length=100)] = None,
    country: Annotated[str | None, Query(pattern=r"^[A-Z]{2}$")] = None,
    sort: Literal["name", "recent"] = "name",
    order: Literal["asc", "desc"] = "asc",
) -> InvestorDirectoryPage:
    """Active startup members, including viewers, can read verified firms."""
    return await investor_directory_service.list_investors(
        db, user, startup_org_id, limit=limit, offset=offset, q=q, city=city,
        country=country, sort=sort, order=order,
    )


@router.get("/{investor_org_id}", response_model=InvestorDirectoryItem, summary="Read a verified investor firm")
async def get_investor(
    startup_org_id: uuid.UUID,
    investor_org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorDirectoryItem:
    """Unverified, deleted, suspended or non-investor organizations are 404."""
    return await investor_directory_service.get_investor(db, user, startup_org_id, investor_org_id)
