"""Mentor profile router (Step 3c): GET/PATCH /mentor-profile/me."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.profile import MentorProfileRead, MentorProfileUpdate
from app.services import mentor_service

router = APIRouter(prefix="/mentor-profile", tags=["mentor-profile"])


@router.get(
    "/me",
    response_model=MentorProfileRead | None,
    summary="Get my mentor profile",
)
async def get_my_mentor_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorProfileRead | None:
    return await mentor_service.get_me(db, user)


@router.patch("/me", response_model=MentorProfileRead, summary="Update my mentor profile")
async def update_my_mentor_profile(
    payload: MentorProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorProfileRead:
    """Upsert own profile. rating/sessions/is_verified are server-owned
    and absent (extra=forbid -> 422)."""
    return await mentor_service.update_me(db, user, payload)
