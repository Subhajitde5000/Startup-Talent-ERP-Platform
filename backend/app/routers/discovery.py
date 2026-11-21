"""Startup discovery endpoints (Step 5h).

``GET /public/startups`` — anonymous directory: ``public`` profiles only.
``GET /startups`` — the same read for a signed-in viewer, whose roles widen
what they may see (mentor/investor/other — 5h plan D1).

Both call ``discovery_service.list_startups``; the ONLY difference is the
viewer, so the two audiences can never drift apart.

Note on ``/public``: the router lives here but keeps the ``/public`` prefix
so the existing anonymous surface stays under one namespace.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import not_found
from app.db.session import get_db
from app.models.startup import StartupStage
from app.models.user import User
from app.schemas.discovery import StartupDiscoveryDetail, StartupDiscoveryPage
from app.services import discovery_service

router = APIRouter(tags=["discovery"])

_Q_MAX = 100
_SECTOR_MAX = 100
_CITY_MAX = 100


@router.get(
    "/public/startups",
    response_model=StartupDiscoveryPage,
    summary="Discover public startups (anonymous)",
)
async def discover_public_startups(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["recent", "name", "stage"] = "recent",
    order: Literal["asc", "desc"] = "desc",
    stage: Annotated[StartupStage | None, Query()] = None,
    sector: Annotated[str | None, Query(max_length=_SECTOR_MAX)] = None,
    city: Annotated[str | None, Query(max_length=_CITY_MAX)] = None,
    q: Annotated[str | None, Query(max_length=_Q_MAX)] = None,
) -> StartupDiscoveryPage:
    """Only ``profile_visibility == public`` rows; other profiles are absent
    from the result rather than redacted (no existence oracle)."""
    return await discovery_service.list_startups(
        db,
        None,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
        stage=stage,
        sector=sector,
        city=city,
        q=q,
    )


@router.get(
    "/startups",
    response_model=StartupDiscoveryPage,
    summary="Discover startups (signed in)",
)
async def discover_startups(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["recent", "name", "stage"] = "recent",
    order: Literal["asc", "desc"] = "desc",
    stage: Annotated[StartupStage | None, Query()] = None,
    sector: Annotated[str | None, Query(max_length=_SECTOR_MAX)] = None,
    city: Annotated[str | None, Query(max_length=_CITY_MAX)] = None,
    q: Annotated[str | None, Query(max_length=_Q_MAX)] = None,
) -> StartupDiscoveryPage:
    """Viewer role decides the visible set: a mentor additionally sees
    ``mentors`` rows, an investor ``mentors_and_investors`` rows, and a
    job-seeker stays on ``public`` rows like an anonymous caller."""
    return await discovery_service.list_startups(
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
    )


@router.get(
    "/startups/{identifier}",
    response_model=StartupDiscoveryDetail,
    summary="Get discoverable startup profile (signed in)",
)
async def get_discoverable_startup(
    identifier: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupDiscoveryDetail:
    """Retrieve full startup profile for discoverers (mentors, investors, etc.).

    Only returns startups that have allowed the viewer's audience. Startups
    outside the viewer's audience or non-existent startups 404 with STARTUP_NOT_FOUND
    without existence leakage.
    """
    detail = await discovery_service.get_startup(db, user, identifier)
    if detail is None:
        raise not_found("Startup not found.", code="STARTUP_NOT_FOUND")
    return detail

