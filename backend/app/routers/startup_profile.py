"""Startup profile router (Step 5a).

Thin routes (AGENTS.md section 3): the actor always comes from the auth
dependency; path params are uuid.UUID so malformed ids 422 before any
service code runs. Object-level membership/type checks live in
startup_profile_service.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.startup import (
    StartupProfilePublicRead,
    StartupProfileRead,
    StartupProfileUpdate,
)
from app.services import startup_profile_service

router = APIRouter(prefix="/organizations", tags=["startup profile"])


@router.get(
    "/{org_id}/startup-profile",
    response_model=StartupProfileRead,
    summary="Get startup profile",
)
async def get_startup_profile(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupProfileRead:
    """Active members (including viewers) read the profile; created on
    demand with defaults for a startup organization."""
    return await startup_profile_service.get_profile(db, user, org_id)


@router.patch(
    "/{org_id}/startup-profile",
    response_model=StartupProfileRead,
    summary="Update startup profile",
)
async def update_startup_profile(
    org_id: uuid.UUID,
    payload: StartupProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupProfileRead:
    """Owner/admin/member patch (viewer 403). Server-controlled fields
    are rejected with 422 by extra=forbid."""
    return await startup_profile_service.update_profile(db, user, org_id, payload)


@router.get(
    "/{org_id}/startup-profile/preview",
    response_model=StartupProfilePublicRead,
    summary="Preview the public startup profile",
)
async def preview_startup_profile(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> StartupProfilePublicRead:
    """What an anonymous visitor would see right now (member-facing aid,
    not a security boundary — it only exposes this org's own data)."""
    return await startup_profile_service.get_preview(db, user, org_id)
