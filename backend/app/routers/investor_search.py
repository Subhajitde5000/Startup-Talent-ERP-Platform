"""Investor search router (Step 9d: preferences, saved searches, shortlist).

Thin routes only (AGENTS.md section 3): the actor comes from
``get_current_user``, ids are ``uuid.UUID`` (a malformed id is a 422
before any service code runs), and every guard, org resolution and
rate limit lives in ``investor_search_service``.

Routes (all under ``/investors/me`` — the caller's OWN investor firm,
resolved server-side from their membership, never from a path id):

- ``GET/PUT /investors/me/preferences`` — investment thesis filters.
- ``GET/POST /investors/me/saved-searches`` — list and create.
- ``PATCH/DELETE /investors/me/saved-searches/{search_id}`` — edit/remove.
- ``GET /investors/me/saved-searches/{search_id}/matches`` — current matches.
- ``GET/POST /investors/me/shortlist`` — list and bookmark.
- ``PATCH/DELETE /investors/me/shortlist/{entry_id}`` — edit/remove.

``id``, ``investor_org_id``, ``startup_org_id`` and the timestamps are
absent from the input schemas (``extra="forbid"`` -> 422), so a client
can never write server-controlled fields.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.investor_discovery import InvestorStartupPage
from app.schemas.investor_search import (
    InvestorPreferenceRead,
    InvestorPreferenceUpdate,
    SavedSearchCreate,
    SavedSearchRead,
    SavedSearchUpdate,
    ShortlistEntryCreate,
    ShortlistEntryRead,
    ShortlistEntryUpdate,
)
from app.services import investor_search_service

router = APIRouter(prefix="/investors/me", tags=["investor-search"])


@router.get(
    "/preferences",
    response_model=InvestorPreferenceRead,
    summary="Get my investor preferences",
)
async def get_preferences(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorPreferenceRead:
    """Any active member of the caller's investor firm."""
    return await investor_search_service.get_preferences(db, user)


@router.put(
    "/preferences",
    response_model=InvestorPreferenceRead,
    summary="Replace my investor preferences",
)
async def update_preferences(
    payload: InvestorPreferenceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InvestorPreferenceRead:
    """Owner/admin/member; a viewer gets 403."""
    return await investor_search_service.update_preferences(db, user, payload)


@router.get(
    "/saved-searches",
    response_model=list[SavedSearchRead],
    summary="List my saved searches",
)
async def list_saved_searches(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[SavedSearchRead]:
    return await investor_search_service.list_saved_searches(db, user)


@router.post(
    "/saved-searches",
    response_model=SavedSearchRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a saved search",
)
async def create_saved_search(
    payload: SavedSearchCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SavedSearchRead:
    """Owner/admin/member; a viewer gets 403."""
    return await investor_search_service.create_saved_search(db, user, payload)


@router.patch(
    "/saved-searches/{search_id}",
    response_model=SavedSearchRead,
    summary="Edit a saved search",
)
async def update_saved_search(
    search_id: uuid.UUID,
    payload: SavedSearchUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> SavedSearchRead:
    """Foreign or deleted searches are a 404 (no existence oracle)."""
    return await investor_search_service.update_saved_search(
        db, user, search_id, payload
    )


@router.delete(
    "/saved-searches/{search_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a saved search",
)
async def delete_saved_search(
    search_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    await investor_search_service.delete_saved_search(db, user, search_id)


@router.get(
    "/saved-searches/{search_id}/matches",
    response_model=InvestorStartupPage,
    summary="Current matches for a saved search",
)
async def saved_search_matches(
    search_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> InvestorStartupPage:
    """Re-runs the saved criteria through the shared 9c discovery query."""
    return await investor_search_service.matches_for_search(
        db, user, search_id, limit=limit, offset=offset
    )


@router.get(
    "/shortlist",
    response_model=list[ShortlistEntryRead],
    summary="List my shortlist",
)
async def list_shortlist(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[ShortlistEntryRead]:
    return await investor_search_service.list_shortlist(db, user)


@router.post(
    "/shortlist",
    response_model=ShortlistEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a startup to my shortlist",
)
async def create_shortlist_entry(
    payload: ShortlistEntryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ShortlistEntryRead:
    """Owner/admin/member; a viewer gets 403. Already shortlisted -> 409."""
    return await investor_search_service.create_shortlist_entry(db, user, payload)


@router.patch(
    "/shortlist/{entry_id}",
    response_model=ShortlistEntryRead,
    summary="Edit a shortlist entry",
)
async def update_shortlist_entry(
    entry_id: uuid.UUID,
    payload: ShortlistEntryUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> ShortlistEntryRead:
    """Foreign or deleted entries are a 404 (no existence oracle)."""
    return await investor_search_service.update_shortlist_entry(
        db, user, entry_id, payload
    )


@router.delete(
    "/shortlist/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a shortlist entry",
)
async def delete_shortlist_entry(
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    await investor_search_service.delete_shortlist_entry(db, user, entry_id)
