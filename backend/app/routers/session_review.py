"""Step 8i review endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.session_review import MentorReviewPage, PublicReviewPage, ReviewCreate, ReviewRead
from app.services import session_review_service

router = APIRouter(tags=["session-reviews"])
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Mentor = Annotated[User, Depends(require_role(UserRole.mentor))]
Limit = Annotated[int, Query(ge=1, le=50)]
Offset = Annotated[int, Query(ge=0)]


@router.post("/sessions/{session_id}/reviews", response_model=ReviewRead, status_code=201)
async def create_review(
    session_id: uuid.UUID, body: ReviewCreate, db: DB, user: CurrentUser
) -> ReviewRead:
    return await session_review_service.create(db, user, session_id, body)


@router.get("/sessions/{session_id}/reviews/me", response_model=ReviewRead)
async def my_review(session_id: uuid.UUID, db: DB, user: CurrentUser) -> ReviewRead:
    return await session_review_service.mine(db, user, session_id)


@router.delete("/session-reviews/{review_id}", status_code=204)
async def delete_review(review_id: uuid.UUID, db: DB, user: CurrentUser) -> Response:
    await session_review_service.remove(db, user, review_id)
    return Response(status_code=204)


@router.get("/mentor/reviews", response_model=MentorReviewPage)
async def mentor_reviews(
    db: DB, user: Mentor, limit: Limit = 20, offset: Offset = 0
) -> MentorReviewPage:
    return await session_review_service.mentor_reviews(db, user, limit, offset)


@router.get("/mentors/{handle}/reviews", response_model=PublicReviewPage)
async def public_reviews(
    handle: str, db: DB, user: CurrentUser, limit: Limit = 20, offset: Offset = 0
) -> PublicReviewPage:
    return await session_review_service.public_reviews(db, handle, limit, offset)
