"""Step 8e router: mentor deliverables.

Two prefixes, matching the two ways a deliverable is addressed:

- ``/mentorships/{id}/deliverables``  create and list inside one engagement.
- ``/deliverables/{id}``              flat access for a single row.

Thin layer per AGENTS.md section 3: parse, call the service, return the
schema. Every authorization decision — including the 404-instead-of-403
rule for outsiders — lives in ``deliverable_service``.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.deliverable import (
    DeliverableCreate,
    DeliverablePage,
    DeliverableRead,
    DeliverableUpdate,
)
from app.services import deliverable_service

router = APIRouter(prefix="/deliverables", tags=["deliverables"])
mentorship_router = APIRouter(prefix="/mentorships", tags=["deliverables"])

_LIMIT_MAX = 50


@mentorship_router.post(
    "/{mentorship_id}/deliverables",
    response_model=DeliverableRead,
    status_code=201,
    summary="Create a deliverable (mentor only)",
    responses={
        403: {"description": "Not the mentor on this mentorship."},
        404: {"description": "Not found, or not a participant."},
        422: {"description": "An assignee who is not an active member of the startup."},
    },
)
async def create_deliverable(
    mentorship_id: uuid.UUID,
    payload: DeliverableCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DeliverableRead:
    return await deliverable_service.create(db, user, mentorship_id, payload)


@mentorship_router.get(
    "/{mentorship_id}/deliverables",
    response_model=DeliverablePage,
    summary="List a mentorship's deliverables",
    responses={404: {"description": "Not found, or not a participant."}},
)
async def list_deliverables(
    mentorship_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: Annotated[
        Literal[
            "not_started",
            "in_progress",
            "submitted",
            "changes_requested",
            "accepted",
            "overdue",
        ]
        | None,
        Query(description="Filter by a single status."),
    ] = None,
    overdue_only: Annotated[
        bool, Query(description="Only items past their due date and still open.")
    ] = False,
    limit: Annotated[int, Query(ge=1, le=_LIMIT_MAX)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> DeliverablePage:
    status_filter = [status] if status else None
    items, total = await deliverable_service.list_for_mentorship(
        db,
        user,
        mentorship_id,
        limit=limit,
        offset=offset,
        status_filter=status_filter,
        overdue_only=overdue_only,
    )
    return DeliverablePage(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/{deliverable_id}",
    response_model=DeliverableRead,
    summary="Get one deliverable",
    responses={404: {"description": "Not found, or not a participant."}},
)
async def get_deliverable(
    deliverable_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DeliverableRead:
    return await deliverable_service.get_one(db, user, deliverable_id)


@router.patch(
    "/{deliverable_id}",
    response_model=DeliverableRead,
    summary="Edit a deliverable (mentor) or submit progress (assignee)",
    responses={
        403: {"description": "Neither the mentor nor the assignee, or a viewer."},
        404: {"description": "Not found, or not a participant."},
        422: {"description": "An illegal status transition."},
    },
)
async def update_deliverable(
    deliverable_id: uuid.UUID,
    payload: DeliverableUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DeliverableRead:
    return await deliverable_service.update(db, user, deliverable_id, payload)


@router.delete(
    "/{deliverable_id}",
    status_code=204,
    summary="Delete a deliverable (mentor only)",
    responses={403: {"description": "Not the mentor on this mentorship."}},
)
async def delete_deliverable(
    deliverable_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    await deliverable_service.remove(db, user, deliverable_id)
