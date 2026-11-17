"""Talent profile router (Step 3c): GET/PATCH /talent-profile/me."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.profile import TalentProfileRead, TalentProfileUpdate
from app.services import talent_service

router = APIRouter(prefix="/talent-profile", tags=["talent-profile"])


@router.get(
    "/me",
    response_model=TalentProfileRead | None,
    summary="Get my talent profile",
)
async def get_my_talent_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TalentProfileRead | None:
    """Null until the candidate saves their profile once (or finishes
    onboarding)."""
    return await talent_service.get_me(db, user)


@router.patch("/me", response_model=TalentProfileRead, summary="Update my talent profile")
async def update_my_talent_profile(
    payload: TalentProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TalentProfileRead:
    """Upsert own profile. `skills` is a replace-set of names; server-owned
    fields (resume_id, timestamps) are absent (extra=forbid -> 422)."""
    return await talent_service.update_me(db, user, payload)
