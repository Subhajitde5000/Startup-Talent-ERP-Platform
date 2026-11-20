"""Step 8b router: mentorship requests (``/mentorships``).

Thin layer per AGENTS.md section 3: parse, call the service, return the
schema. Every authorization decision — including the 404-instead-of-403
rule — lives in ``mentorship_service``.

Two router prefixes share this module because they are the same resource
seen from two sides of the marketplace:

- ``/mentorships``          both parties, addressed by row id.
- ``/mentor/startups``      the mentor's own list, and
  ``/mentor/discover``      the startups a mentor may browse (reuses 5h).
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.mentorship import MentorshipStatus
from app.models.user import User
from app.schemas.mentorship import (
    MentorshipCreate,
    MentorshipEnd,
    MentorshipPage,
    MentorshipRead,
    MentorshipStateChange,
    MentorshipUpdate,
)
from app.services import mentorship_service

router = APIRouter(prefix="/mentorships", tags=["mentorships"])
# Creating is scoped to the startup, exactly like POST /organizations/{id}/tasks.
org_router = APIRouter(prefix="/organizations", tags=["mentorships"])
# The mentor-side reads live under the existing /mentor prefix used by
# /mentor-profile, so a mentor's pages hit one namespace.
mentor_router = APIRouter(prefix="/mentor", tags=["mentorships"])

_LIMIT_MAX = 50


@org_router.post(
    "/{org_id}/mentorships",
    response_model=MentorshipRead,
    status_code=201,
    summary="Request mentorship from a mentor",
    responses={
        403: {"description": "Not an active member of that startup, or a viewer."},
        409: {"description": "The mentor is not accepting, or a mentorship already exists."},
    },
)
async def create_mentorship(
    org_id: uuid.UUID,
    payload: MentorshipCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    """Owner/admin/member create (viewer 403). The startup comes from the
    path and is membership-checked; the mentor must be accepting requests."""
    return await mentorship_service.create(db, user, org_id, payload)


@router.get(
    "",
    response_model=MentorshipPage,
    summary="List my mentorships",
)
async def list_mentorships(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    side: Annotated[
        Literal["mentor", "startup"],
        Query(description="Which side of the marketplace to list."),
    ] = "startup",
    status: Annotated[
        Literal["requested", "active", "paused", "completed", "declined", "cancelled"],
        Query(description="Filter by a single status."),
    ]
    | None = None,
    org_id: Annotated[uuid.UUID | None, Query(description="Narrow to one startup.")] = None,
    limit: Annotated[int, Query(ge=1, le=_LIMIT_MAX)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MentorshipPage:
    status_filter = [MentorshipStatus(status).value] if status else None
    items, total = await mentorship_service.list_mentorships(
        db,
        user,
        side=side,
        limit=limit,
        offset=offset,
        status_filter=status_filter,
        org_id=org_id,
    )
    return MentorshipPage(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/{mentorship_id}",
    response_model=MentorshipRead,
    summary="Get one mentorship",
    responses={404: {"description": "Not found, or you are not a participant."}},
)
async def get_mentorship(
    mentorship_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    return await mentorship_service.get_one(db, user, mentorship_id)


@router.patch(
    "/{mentorship_id}",
    response_model=MentorshipRead,
    summary="Edit a pending request (startup side)",
    responses={409: {"description": "The request is no longer pending."}},
)
async def update_mentorship(
    mentorship_id: uuid.UUID,
    payload: MentorshipUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    return await mentorship_service.update_request(db, user, mentorship_id, payload)


@router.post(
    "/{mentorship_id}/accept",
    response_model=MentorshipRead,
    summary="Accept a request (mentor only)",
    responses={403: {"description": "Not the mentor."}, 409: {"description": "Wrong state."}},
)
async def accept_mentorship(
    mentorship_id: uuid.UUID,
    payload: MentorshipStateChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    return await mentorship_service.accept(db, user, mentorship_id, payload.note)


@router.post(
    "/{mentorship_id}/decline",
    response_model=MentorshipRead,
    summary="Decline a request (mentor only)",
)
async def decline_mentorship(
    mentorship_id: uuid.UUID,
    payload: MentorshipStateChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    return await mentorship_service.decline(db, user, mentorship_id, payload.note)


@router.post(
    "/{mentorship_id}/cancel",
    response_model=MentorshipRead,
    summary="Withdraw a mentorship (either side)",
)
async def cancel_mentorship(
    mentorship_id: uuid.UUID,
    payload: MentorshipStateChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    return await mentorship_service.cancel(db, user, mentorship_id, payload.note)


@router.post(
    "/{mentorship_id}/end",
    response_model=MentorshipRead,
    summary="Complete an engagement (either side)",
)
async def end_mentorship(
    mentorship_id: uuid.UUID,
    payload: MentorshipEnd,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    return await mentorship_service.end(db, user, mentorship_id, payload.reason)


@router.post(
    "/{mentorship_id}/pause",
    response_model=MentorshipRead,
    summary="Pause an engagement (either side)",
)
async def pause_mentorship(
    mentorship_id: uuid.UUID,
    payload: MentorshipStateChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    return await mentorship_service.pause(db, user, mentorship_id, payload.note)


@router.post(
    "/{mentorship_id}/resume",
    response_model=MentorshipRead,
    summary="Resume a paused engagement (either side)",
)
async def resume_mentorship(
    mentorship_id: uuid.UUID,
    payload: MentorshipStateChange,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorshipRead:
    return await mentorship_service.resume(db, user, mentorship_id, payload.note)


@mentor_router.get(
    "/startups",
    response_model=MentorshipPage,
    summary="The startups I mentor (mentor view)",
)
async def list_mentor_startups(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=_LIMIT_MAX)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MentorshipPage:
    items, total = await mentorship_service.list_for_mentor_startups(
        db, user, limit=limit, offset=offset
    )
    return MentorshipPage(items=items, total=total, limit=limit, offset=offset)
