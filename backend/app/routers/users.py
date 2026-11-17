"""Users router: own profile reads/writes (object-level: only self).

There is no route shape that accepts another user's id — every endpoint
here acts on the authenticated user from the dependency.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.profile import (
    DeleteRequestRead,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    ReadinessRead,
    UserMeRead,
    UserUpdate,
)
from app.services import profile_service, user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeRead, summary="Get current user")
async def get_me(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> UserMeRead:
    return await user_service.get_me(db, user)


@router.patch("/me", response_model=UserMeRead, summary="Update own profile")
async def update_me(
    payload: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> UserMeRead:
    """Patch public profile fields. Server-owned fields are not accepted
    (extra=forbid -> 422); unknown/undeclared fields can never be written."""
    return await profile_service.update_me(db, user, payload)


@router.get("/me/readiness", response_model=ReadinessRead, summary="Get readiness scores")
async def get_readiness(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ReadinessRead:
    return await profile_service.get_readiness(db, user)


@router.post(
    "/me/delete-request",
    response_model=DeleteRequestRead,
    status_code=status.HTTP_201_CREATED,
    summary="Request account data erasure",
)
async def create_delete_request(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DeleteRequestRead:
    """Record a DPDP data (erasure) request for the caller. One open
    request at a time; fulfilment is handled by Step 15."""
    return await profile_service.create_delete_request(db, user)


@router.get(
    "/me/delete-request",
    response_model=DeleteRequestRead | None,
    summary="Get latest data request",
)
async def get_delete_request(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DeleteRequestRead | None:
    """Latest data request of the caller, or null if none exists."""
    return await profile_service.get_delete_request(db, user)


@router.get(
    "/me/notification-preferences",
    response_model=NotificationPreferenceRead,
    summary="Get notification preferences",
)
async def get_notification_preferences(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> NotificationPreferenceRead:
    """Step 3 part 8 stub: persisted toggles per (category, channel).
    The delivery pipeline and full taxonomy arrive with Step 12."""
    return await profile_service.get_notification_preferences(db, user)


@router.patch(
    "/me/notification-preferences",
    response_model=NotificationPreferenceRead,
    summary="Update notification preferences",
)
async def update_notification_preferences(
    payload: NotificationPreferenceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> NotificationPreferenceRead:
    """Upsert the given (category, channel, is_enabled) rows; other rows
    are untouched."""
    return await profile_service.update_notification_preferences(db, user, payload)
