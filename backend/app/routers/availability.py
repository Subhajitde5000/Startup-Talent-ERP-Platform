"""Step 8c router: mentor availability.

Two audiences on one resource:

- ``/mentor/availability``  the owning mentor reads and writes their week.
  Writes also require an actual mentor profile (a startup user gets 403).
- ``/mentors/{handle}/availability`` and ``/mentors/{handle}/slots``
  a signed-in viewer reads someone else's published week and the concrete
  bookable instants. Hidden profiles follow the 8a visibility rule.

The read side resolves the handle through the SAME visibility check 8a
uses, so a mentor hidden by ``profile_public`` does not leak availability.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import not_found
from app.db.session import get_db
from app.models.user import User
from app.schemas.availability import (
    AvailabilitySlotIn,
    AvailabilitySlotRead,
    AvailabilityWeekIn,
    AvailabilityWeekRead,
    BookableSlotsRead,
)
from app.services import availability_service, mentor_directory_service

router = APIRouter(prefix="/mentor/availability", tags=["mentor-availability"])
public_router = APIRouter(prefix="/mentors", tags=["mentor-availability"])


@router.get("", response_model=AvailabilityWeekRead, summary="My availability week")
async def get_my_availability(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AvailabilityWeekRead:
    return await availability_service.get_week(db, user)


@router.put(
    "",
    response_model=AvailabilityWeekRead,
    summary="Replace my whole availability week",
    description=(
        "Atomic replace: the overlap and minimum-length checks run before "
        "anything is deleted, so a rejected payload leaves the previous week "
        "untouched. An empty list clears the week."
    ),
)
async def put_my_availability(
    payload: AvailabilityWeekIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AvailabilityWeekRead:
    return await availability_service.replace_week(db, user, payload)


@router.post(
    "",
    response_model=AvailabilitySlotRead,
    status_code=201,
    summary="Add one availability window",
    responses={409: {"description": "Overlaps an existing window."}},
)
async def add_my_availability(
    payload: AvailabilitySlotIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AvailabilitySlotRead:
    return await availability_service.add_slot(db, user, payload)


@router.delete(
    "/{slot_id}",
    status_code=204,
    summary="Delete one availability window",
    responses={404: {"description": "Not found, or not yours."}},
)
async def delete_my_availability(
    slot_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    await availability_service.delete_slot(db, user, slot_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _mentor_by_handle(db: AsyncSession, handle: str) -> tuple[uuid.UUID, str]:
    """Resolve a public handle to a mentor id, honouring 8a's visibility.

    Reuses the directory service's own visibility query, so "hidden" means
    exactly what it means on the mentor page: a 404 identical to a handle
    that never existed. The mentor UUID never leaves the server.
    """
    mentor_id = await mentor_directory_service.resolve_visible_mentor_id(db, handle)
    if mentor_id is None:
        raise not_found("Mentor not found.")
    return mentor_id, handle


@public_router.get(
    "/{handle}/availability",
    response_model=AvailabilityWeekRead,
    summary="A mentor's published availability",
    responses={404: {"description": "No such mentor, or their profile is private."}},
)
async def get_mentor_availability(
    handle: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> AvailabilityWeekRead:
    mentor_id, _ = await _mentor_by_handle(db, handle)
    return await availability_service.public_week(db, mentor_id)


@public_router.get(
    "/{handle}/slots",
    response_model=BookableSlotsRead,
    summary="Bookable instants for a mentor",
    description=(
        "Concrete free instants computed from the weekly template minus "
        "sessions already booked. The same read backs the booking screen and "
        "the 8d 'is this instant free?' check, so they cannot disagree."
    ),
    responses={404: {"description": "No such mentor, or their profile is private."}},
)
async def get_mentor_slots(
    handle: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    from_date: Annotated[date | None, Query(alias="from")] = None,
    days: Annotated[int, Query(ge=1, le=availability_service.MAX_RANGE_DAYS)] = (
        availability_service.DEFAULT_RANGE_DAYS
    ),
) -> BookableSlotsRead:
    mentor_id, resolved = await _mentor_by_handle(db, handle)
    return await availability_service.bookable_slots(
        db, mentor_id, resolved, from_date=from_date, days=days
    )
