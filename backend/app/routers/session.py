"""Step 8d router: mentoring sessions.

Two prefixes, matching the two ways a session is addressed:

- ``/mentorships/{id}/sessions``  create + list within one engagement.
- ``/sessions``                   flat access for the session pages, plus
                                  the transitions, which address a session
                                  by its own id.

Authorization and every state rule live in ``session_service``.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.session import (
    SessionCancel,
    SessionComplete,
    SessionCreate,
    SessionNoShow,
    SessionPage,
    SessionRead,
    SessionReschedule,
)
from app.services import session_service

router = APIRouter(prefix="/sessions", tags=["sessions"])
mentorship_router = APIRouter(prefix="/mentorships", tags=["sessions"])

_LIMIT_MAX = 50


@mentorship_router.post(
    "/{mentorship_id}/sessions",
    response_model=SessionRead,
    status_code=201,
    summary="Schedule a session",
    responses={
        403: {"description": "A viewer, or not a participant."},
        404: {"description": "Not found, or not a participant."},
        409: {"description": "The slot is taken, or the mentorship is not active."},
    },
)
async def create_session(
    mentorship_id: uuid.UUID,
    payload: SessionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SessionRead:
    return await session_service.schedule(db, user, mentorship_id, payload)


@mentorship_router.get(
    "/{mentorship_id}/sessions",
    response_model=SessionPage,
    summary="Sessions of one mentorship",
    responses={404: {"description": "Not found, or not a participant."}},
)
async def list_mentorship_sessions(
    mentorship_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=_LIMIT_MAX)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SessionPage:
    return await session_service.list_for_mentorship(
        db, user, mentorship_id, limit=limit, offset=offset
    )


@router.get("", response_model=SessionPage, summary="My sessions")
async def list_my_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    upcoming: Annotated[
        bool, Query(description="Only sessions that have not happened yet.")
    ] = False,
    limit: Annotated[int, Query(ge=1, le=_LIMIT_MAX)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> SessionPage:
    return await session_service.list_mine(
        db, user, limit=limit, offset=offset, upcoming_only=upcoming
    )


@router.get(
    "/{session_id}",
    response_model=SessionRead,
    summary="Get one session",
    responses={404: {"description": "Not found, or not a participant."}},
)
async def get_session(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SessionRead:
    return await session_service.get_one(db, user, session_id)


@router.post(
    "/{session_id}/confirm",
    response_model=SessionRead,
    summary="Confirm a scheduled session",
)
async def confirm_session(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SessionRead:
    return await session_service.confirm(db, user, session_id)


@router.post(
    "/{session_id}/reschedule",
    response_model=SessionRead,
    summary="Move a session to a new time",
    responses={409: {"description": "The slot is taken."}},
)
async def reschedule_session(
    session_id: uuid.UUID,
    payload: SessionReschedule,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SessionRead:
    return await session_service.reschedule(db, user, session_id, payload)


@router.post(
    "/{session_id}/cancel",
    response_model=SessionRead,
    summary="Cancel a session",
)
async def cancel_session(
    session_id: uuid.UUID,
    payload: SessionCancel,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SessionRead:
    return await session_service.cancel(db, user, session_id, payload.reason)


@router.post(
    "/{session_id}/complete",
    response_model=SessionRead,
    summary="Complete a session with a summary (mentor only)",
    responses={403: {"description": "Not the mentor."}},
)
async def complete_session(
    session_id: uuid.UUID,
    payload: SessionComplete,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SessionRead:
    return await session_service.complete(
        db, user, session_id, payload.summary, payload.action_items
    )


@router.post(
    "/{session_id}/no-show",
    response_model=SessionRead,
    summary="Mark a session as a no-show (mentor only)",
    responses={409: {"description": "The session has not started yet."}},
)
async def no_show_session(
    session_id: uuid.UUID,
    payload: SessionNoShow,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SessionRead:
    return await session_service.no_show(db, user, session_id, payload.note)
