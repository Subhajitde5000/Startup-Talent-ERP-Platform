"""Public directory reads (Step 3 part 9): separate public schemas.

No authentication. Each endpoint serves ONLY the public shape of a record
and 404s when the owner turned discovery off — a private profile is
indistinguishable from a nonexistent one (no existence oracle). Errors
use the app-wide {error:{code,message,details}} format via AppException.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import not_found
from app.db.session import get_db
from app.schemas.organization import OrganizationPublicRead
from app.schemas.profile import MentorPublicRead, TalentPublicRead
from app.schemas.startup import StartupProfilePublicRead
from app.services import mentor_service, public_service, startup_profile_service, talent_service

router = APIRouter(prefix="/public", tags=["public"])


@router.get(
    "/organizations/{slug}",
    response_model=OrganizationPublicRead,
    summary="Public organization profile",
)
async def public_organization(
    slug: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> OrganizationPublicRead:
    org = await public_service.get_organization_by_slug(db, slug)
    if org is None:
        raise not_found("Organization not found.")
    return org


@router.get(
    "/startups/{slug}",
    response_model=StartupProfilePublicRead,
    summary="Public startup profile",
)
async def public_startup(
    slug: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> StartupProfilePublicRead:
    """Visibility-gated: private/mentors/mentors_and_investors profiles
    404 like nonexistent ones; public profiles serve only the sections
    whose toggle is on."""
    profile = await startup_profile_service.get_public(db, slug)
    if profile is None:
        raise not_found("Startup profile not found.")
    return profile


@router.get(
    "/talent/{handle}",
    response_model=TalentPublicRead,
    summary="Public talent profile",
)
async def public_talent(
    handle: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> TalentPublicRead:
    profile = await talent_service.get_public(db, handle)
    if profile is None:
        raise not_found("Profile not found.")
    return profile


@router.get(
    "/mentors/{handle}",
    response_model=MentorPublicRead,
    summary="Public mentor profile",
)
async def public_mentor(
    handle: str, db: Annotated[AsyncSession, Depends(get_db)]
) -> MentorPublicRead:
    profile = await mentor_service.get_public(db, handle)
    if profile is None:
        raise not_found("Profile not found.")
    return profile
