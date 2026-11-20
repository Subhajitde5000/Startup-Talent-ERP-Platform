"""Mentor router (Step 3c: own profile; Step 8a: the directory).

Step 3c owns ``/mentor-profile/me`` (the mentor's own row).
Step 8a adds the READ-ONLY directory a startup browses, on the same router
and the same service module so the two can never disagree about who is
visible. 8a adds no table and no write endpoint.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.exceptions import not_found
from app.db.session import get_db
from app.models.user import User
from app.schemas.mentor_directory import (
    MentorDirectoryDetail,
    MentorDirectoryPage,
    MentorSuggestionPage,
)
from app.schemas.profile import MentorProfileRead, MentorProfileUpdate
from app.services import mentor_directory_service, mentor_service

router = APIRouter(prefix="/mentor-profile", tags=["mentor-profile"])

# The directory routes live under /mentors, so they carry their own router.
# Kept in this module because they read the same model and share the
# visibility rule (Step 8a).
directory_router = APIRouter(prefix="/mentors", tags=["mentor-directory"])

_Q_MAX = 100
_FACET_MAX = 60


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


# --- Step 8a: the mentor directory (read-only) ------------------------------


@directory_router.get(
    "",
    response_model=MentorDirectoryPage,
    summary="Browse mentors",
)
async def list_mentors(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["relevance", "rating", "price", "experience"] = "relevance",
    order: Literal["asc", "desc"] = "desc",
    expertise: Annotated[str | None, Query(max_length=_FACET_MAX)] = None,
    sector: Annotated[str | None, Query(max_length=_FACET_MAX)] = None,
    language: Annotated[str | None, Query(max_length=_FACET_MAX)] = None,
    verified_only: bool = False,
    accepting_only: bool = False,
    free_only: bool = False,
    max_fee: Annotated[float | None, Query(ge=0, le=10_000_000)] = None,
    q: Annotated[str | None, Query(max_length=_Q_MAX)] = None,
) -> MentorDirectoryPage:
    """Any signed-in user may browse. Only ``users.profile_public`` mentors
    appear; a hidden profile is absent rather than redacted.

    ``stage`` is NOT a filter here: mentors have no stage attribute yet
    (8a plan D-1), so the find page's "stage fit" control stays unwired.
    """
    return await mentor_directory_service.list_mentors(
        db,
        user,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
        expertise=expertise,
        sector=sector,
        language=language,
        verified_only=verified_only,
        accepting_only=accepting_only,
        free_only=free_only,
        max_fee=max_fee,
        q=q,
    )


@directory_router.get(
    "/{handle}",
    response_model=MentorDirectoryDetail,
    summary="One mentor's directory page",
)
async def get_mentor(
    handle: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MentorDirectoryDetail:
    """A hidden mentor 404s exactly like a missing one (no existence oracle)."""
    mentor = await mentor_directory_service.get_mentor(db, handle)
    if mentor is None:
        raise not_found("Mentor not found.")
    return mentor


# --- Step 8a: suggestions for one startup -----------------------------------

org_router = APIRouter(tags=["mentor-directory"])


@org_router.get(
    "/organizations/{org_id}/mentor-suggestions",
    response_model=MentorSuggestionPage,
    summary="Suggested mentors for a startup",
)
async def list_mentor_suggestions(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 6,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MentorSuggestionPage:
    """Active members of the organization only (viewer included — this is a
    read). A non-member gets 403, never a hint of whether the org exists.

    Every suggestion carries ``match_reasons`` built from fields that
    actually matched; there is no stored score and no hidden weighting.
    """
    org = await mentor_directory_service.require_startup_member(db, org_id, user)
    return await mentor_directory_service.list_suggestions(
        db, org.id, limit=limit, offset=offset
    )
