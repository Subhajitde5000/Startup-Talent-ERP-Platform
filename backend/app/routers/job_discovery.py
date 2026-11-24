"""Step 7b: public/authenticated wrappers around one audience-safe service."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.job_discovery import (
    HiringCompany,
    HiringCompanyPage,
    HiringStartupSearch,
    JobSearch,
    MarketplaceJob,
    MarketplaceJobPage,
)
from app.services import file_service
from app.services import job_discovery_service as service

router = APIRouter(
    tags=["job-discovery"],
    responses={
        401: {"description": "Invalid authentication"},
        404: {"description": "Not visible or not found"},
        422: {"description": "Invalid bounded filters"},
        429: {"description": "Discovery rate limit"},
    },
)
DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Search = Annotated[JobSearch, Query()]
StartupSearch = Annotated[HiringStartupSearch, Query()]


async def limit(request: Request, response: Response, user: User | None = None) -> None:
    # Do not trust attacker-controlled X-Forwarded-For headers.
    key = (
        f"user:{user.id}" if user else f"ip:{request.client.host if request.client else 'unknown'}"
    )
    await file_service.enforce_limit(
        f"job_discovery:{key}", get_settings().JOB_DISCOVERY_LIMIT, 300
    )
    response.headers["Cache-Control"] = "no-store"


@router.get(
    "/public/jobs", response_model=MarketplaceJobPage, summary="Search hiring resources (public)"
)
async def search_public(
    request: Request, response: Response, db: DB, query: Search
) -> MarketplaceJobPage:
    await limit(request, response, None)
    return await service.search(db, None, query)


@router.get(
    "/public/jobs/{job_id}",
    response_model=MarketplaceJob,
    summary="Detail hiring resources (public)",
)
async def detail_public(
    request: Request, response: Response, db: DB, job_id: uuid.UUID
) -> MarketplaceJob:
    await limit(request, response, None)
    return await service.detail(db, None, job_id)


@router.get(
    "/public/companies/{org_id}",
    response_model=HiringCompany,
    summary="Company hiring resources (public)",
)
async def company_public(
    request: Request, response: Response, db: DB, org_id: uuid.UUID
) -> HiringCompany:
    await limit(request, response, None)
    return await service.company(db, None, org_id)


@router.get(
    "/public/hiring-startups",
    response_model=HiringCompanyPage,
    summary="Startups hiring resources (public)",
)
async def startups_public(
    request: Request, response: Response, db: DB, query: StartupSearch
) -> HiringCompanyPage:
    await limit(request, response, None)
    return await service.startups(db, None, query)


@router.get(
    "/jobs", response_model=MarketplaceJobPage, summary="Search hiring resources (authenticated)"
)
async def search_authenticated(
    request: Request, response: Response, db: DB, query: Search, user: Actor
) -> MarketplaceJobPage:
    await limit(request, response, user)
    return await service.search(db, user, query)


@router.get(
    "/jobs/{job_id}",
    response_model=MarketplaceJob,
    summary="Detail hiring resources (authenticated)",
)
async def detail_authenticated(
    request: Request, response: Response, db: DB, job_id: uuid.UUID, user: Actor
) -> MarketplaceJob:
    await limit(request, response, user)
    return await service.detail(db, user, job_id)


@router.get(
    "/companies/{org_id}",
    response_model=HiringCompany,
    summary="Company hiring resources (authenticated)",
)
async def company_authenticated(
    request: Request, response: Response, db: DB, org_id: uuid.UUID, user: Actor
) -> HiringCompany:
    await limit(request, response, user)
    return await service.company(db, user, org_id)


@router.get(
    "/hiring-startups",
    response_model=HiringCompanyPage,
    summary="Startups hiring resources (authenticated)",
)
async def startups_authenticated(
    request: Request, response: Response, db: DB, query: StartupSearch, user: Actor
) -> HiringCompanyPage:
    await limit(request, response, user)
    return await service.startups(db, user, query)
