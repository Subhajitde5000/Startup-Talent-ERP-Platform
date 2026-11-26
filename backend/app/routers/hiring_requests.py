"""Step 7i hiring-request routes.

Two prefixes, matching how each resource is addressed:

- ``/organizations/{org_id}/hiring-requests``   create + list (org
  visible in the path — outsiders get 403, the established contract)
- ``/hiring-requests/{request_id}``              detail, PATCH, approve,
  reject, convert (org derived from the row — foreign ids resolve as
  404, no existence oracle)

Thin layer per AGENTS.md section 3: parse, call the service, return the
schema. Authorization — including who may approve/reject/convert —
lives in ``hiring_request_service``. Org types: employer and startup
both allowed, membership checked per request (BUILD_PLAN 7r).
"""

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.hiring_request import HiringRequestStatus
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.hiring_request import (
    HiringRequestCreate,
    HiringRequestPage,
    HiringRequestRead,
    HiringRequestUpdate,
)
from app.schemas.job import JobRead
from app.services import hiring_request_service


class HiringRequestRoute(FileRoute):
    """Hiring-request metadata is small; keep the shared bounded-body guard."""

    max_body_bytes = 32 * 1024
    body_limit_message = "Hiring request metadata exceeds 32 KiB."


_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
    403: {
        "model": _ErrorResponse,
        "description": "Hiring role, membership or action permission required",
    },
    404: {
        "model": _ErrorResponse,
        "description": "Resource unavailable or outside the authorized scope",
    },
    409: {
        "model": _ErrorResponse,
        "description": "Invalid lifecycle state (frozen, wrong status, not approver)",
    },
    413: {"model": _ErrorResponse, "description": "Metadata exceeds 32 KiB"},
    422: {"model": _ErrorResponse, "description": "Invalid fields or foreign references"},
    429: {"model": _ErrorResponse, "description": "Hiring request rate limit"},
}

org_router = APIRouter(
    route_class=HiringRequestRoute,
    prefix="/organizations/{org_id}",
    tags=["hiring-requests"],
    responses=_RESPONSES,
)
row_router = APIRouter(
    route_class=HiringRequestRoute,
    prefix="/hiring-requests",
    tags=["hiring-requests"],
    responses=_RESPONSES,
)


@org_router.post(
    "/hiring-requests",
    response_model=HiringRequestRead,
    status_code=201,
    summary="Create a hiring request",
)
async def create_hiring_request(
    org_id: uuid.UUID,
    payload: HiringRequestCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HiringRequestRead:
    return await hiring_request_service.create(db, user, org_id, payload)


@org_router.get(
    "/hiring-requests",
    response_model=HiringRequestPage,
    summary="List hiring requests",
)
async def list_hiring_requests(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: HiringRequestStatus | None = None,
    sort: Literal["newest", "oldest"] = "newest",
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> HiringRequestPage:
    return await hiring_request_service.list_requests(
        db,
        user,
        org_id,
        status=status,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@row_router.get(
    "/{request_id}",
    response_model=HiringRequestRead,
    summary="Read one hiring request",
)
async def get_hiring_request(
    request_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HiringRequestRead:
    return await hiring_request_service.detail(db, user, request_id)


@row_router.patch(
    "/{request_id}",
    response_model=HiringRequestRead,
    summary="Edit a hiring request or submit/cancel it",
)
async def patch_hiring_request(
    request_id: uuid.UUID,
    payload: HiringRequestUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HiringRequestRead:
    return await hiring_request_service.patch(db, user, request_id, payload)


@row_router.post(
    "/{request_id}/approve",
    response_model=HiringRequestRead,
    summary="Approve a pending hiring request",
)
async def approve_hiring_request(
    request_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HiringRequestRead:
    return await hiring_request_service.approve(db, user, request_id)


@row_router.post(
    "/{request_id}/reject",
    response_model=HiringRequestRead,
    summary="Reject a pending hiring request",
)
async def reject_hiring_request(
    request_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HiringRequestRead:
    return await hiring_request_service.reject(db, user, request_id)


@row_router.post(
    "/{request_id}/convert",
    response_model=JobRead,
    status_code=201,
    summary="Convert an approved request into a draft job",
)
async def convert_hiring_request(
    request_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JobRead:
    return await hiring_request_service.convert(db, user, request_id)
