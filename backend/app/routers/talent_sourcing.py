"""Step 7j talent-sourcing routes.

Two prefixes:

- ``/organizations/{org_id}/talent/...``   search, shortlist collection,
  outreach send/bulk/history (org visible in the path — outsiders 403)
- ``/talent/shortlists/{shortlist_id}``    detail, rename, delete,
  member add/remove (org derived from the row — foreign ids 404)

Thin layer per AGENTS.md section 3: parse, call the service, return the
schema. Authorization and the privacy gate live in
``talent_sourcing_service``. Org types: employer and startup both
allowed, membership checked per request (BUILD_PLAN 7r).
"""

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.talent_sourcing import (
    CandidateInvitationPage,
    OutreachBulkCreate,
    OutreachBulkResult,
    OutreachCreate,
    OutreachPage,
    OutreachRead,
    ShortlistCreate,
    ShortlistDetail,
    ShortlistMemberAdd,
    ShortlistPage,
    ShortlistRead,
    ShortlistUpdate,
    TalentCard,
    TalentSearchPage,
)
from app.services import talent_sourcing_service


class TalentSourcingRoute(FileRoute):
    """Shortlist/outreach metadata is small; keep the bounded-body guard."""

    max_body_bytes = 32 * 1024
    body_limit_message = "Talent-sourcing metadata exceeds 32 KiB."


_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
    403: {
        "model": _ErrorResponse,
        "description": "Hiring role, membership or action permission required",
    },
    404: {
        "model": _ErrorResponse,
        "description": "Resource unavailable, private or outside the authorized scope",
    },
    409: {
        "model": _ErrorResponse,
        "description": "Duplicate invite/member or invalid state",
    },
    413: {"model": _ErrorResponse, "description": "Metadata exceeds 32 KiB"},
    422: {"model": _ErrorResponse, "description": "Invalid fields or foreign references"},
    429: {"model": _ErrorResponse, "description": "Talent search/shortlist/outreach rate limit"},
}

org_router = APIRouter(
    route_class=TalentSourcingRoute,
    prefix="/organizations/{org_id}",
    tags=["talent-sourcing"],
    responses=_RESPONSES,
)
shortlist_router = APIRouter(
    route_class=TalentSourcingRoute,
    prefix="/talent/shortlists",
    tags=["talent-sourcing"],
    responses=_RESPONSES,
)
candidate_router = APIRouter(
    route_class=TalentSourcingRoute,
    prefix="/talent/invitations",
    tags=["talent-sourcing"],
    responses=_RESPONSES,
)


@candidate_router.get(
    "",
    response_model=CandidateInvitationPage,
    summary="List role invitations received by the current candidate",
)
async def list_my_invitations(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> CandidateInvitationPage:
    return await talent_sourcing_service.candidate_invitations(
        db, user, limit=limit, offset=offset
    )


@org_router.get(
    "/talent/search",
    response_model=TalentSearchPage,
    summary="Search privacy-visible talent",
)
async def talent_search(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=200)] = None,
    experience: Literal["mid", "senior", "lead"] | None = None,
    skill: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    sort: Literal["recent", "experience"] = "recent",
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> TalentSearchPage:
    return await talent_sourcing_service.search(
        db,
        user,
        org_id,
        q=q,
        experience=experience,
        skill=skill,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@org_router.get(
    "/talent/shortlists",
    response_model=ShortlistPage,
    summary="List shortlists",
)
async def list_shortlists(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ShortlistPage:
    return await talent_sourcing_service.list_shortlists(
        db, user, org_id, limit=limit, offset=offset
    )


@org_router.post(
    "/talent/shortlists",
    response_model=ShortlistRead,
    status_code=201,
    summary="Create a shortlist",
)
async def create_shortlist(
    org_id: uuid.UUID,
    payload: ShortlistCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ShortlistRead:
    return await talent_sourcing_service.create_shortlist(db, user, org_id, payload)


@org_router.post(
    "/talent/outreach",
    response_model=OutreachRead,
    status_code=201,
    summary="Invite a candidate to apply",
)
async def send_outreach(
    org_id: uuid.UUID,
    payload: OutreachCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OutreachRead:
    return await talent_sourcing_service.send_outreach(db, user, org_id, payload)


@org_router.post(
    "/talent/outreach/bulk",
    response_model=OutreachBulkResult,
    summary="Invite every visible member of a shortlist",
)
async def bulk_outreach(
    org_id: uuid.UUID,
    payload: OutreachBulkCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OutreachBulkResult:
    return await talent_sourcing_service.bulk_outreach(db, user, org_id, payload)


@org_router.get(
    "/talent/outreach",
    response_model=OutreachPage,
    summary="Outreach history with daily budget",
)
async def list_outreach(
    org_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> OutreachPage:
    return await talent_sourcing_service.list_outreach(
        db, user, org_id, limit=limit, offset=offset
    )


@shortlist_router.get(
    "/{shortlist_id}",
    response_model=ShortlistDetail,
    summary="Read one shortlist with its members",
)
async def get_shortlist(
    shortlist_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ShortlistDetail:
    return await talent_sourcing_service.get_shortlist(db, user, shortlist_id)


@shortlist_router.patch(
    "/{shortlist_id}",
    response_model=ShortlistRead,
    summary="Rename a shortlist",
)
async def rename_shortlist(
    shortlist_id: uuid.UUID,
    payload: ShortlistUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ShortlistRead:
    return await talent_sourcing_service.rename_shortlist(
        db, user, shortlist_id, payload
    )


@shortlist_router.delete(
    "/{shortlist_id}",
    status_code=204,
    summary="Delete a shortlist (soft)",
)
async def delete_shortlist(
    shortlist_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await talent_sourcing_service.delete_shortlist(db, user, shortlist_id)


@shortlist_router.post(
    "/{shortlist_id}/members",
    response_model=TalentCard,
    status_code=201,
    summary="Add a candidate to a shortlist",
)
async def add_member(
    shortlist_id: uuid.UUID,
    payload: ShortlistMemberAdd,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TalentCard:
    return await talent_sourcing_service.add_member(db, user, shortlist_id, payload)


@shortlist_router.delete(
    "/{shortlist_id}/members/{member_user_id}",
    status_code=204,
    summary="Remove a candidate from a shortlist",
)
async def remove_member(
    shortlist_id: uuid.UUID,
    member_user_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await talent_sourcing_service.remove_member(
        db, user, shortlist_id, member_user_id
    )
