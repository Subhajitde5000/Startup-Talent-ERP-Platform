"""Task comment router (Step 5d).

Thin routes (AGENTS.md section 3): the actor comes from the auth
dependency; path params are ``uuid.UUID`` so a malformed id is a 422
before any service code runs. Membership, org scoping (IDOR), authorship,
soft-delete and the write rate limit live in ``task_comment_service``.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.task_comment import (
    TaskCommentCreate,
    TaskCommentPage,
    TaskCommentRead,
    TaskCommentUpdate,
)
from app.services import task_comment_service

router = APIRouter(prefix="/organizations", tags=["task comments"])


@router.get(
    "/{org_id}/tasks/{task_id}/comments",
    response_model=TaskCommentPage,
    summary="List task comments",
)
async def list_comments(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TaskCommentPage:
    """Any active member (viewer included) reads the task's live comments,
    oldest first. A task from another organization is 404."""
    return await task_comment_service.list_comments(
        db, user, org_id, task_id, limit=limit, offset=offset
    )


@router.post(
    "/{org_id}/tasks/{task_id}/comments",
    response_model=TaskCommentRead,
    status_code=201,
    summary="Create task comment",
)
async def create_comment(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskCommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TaskCommentRead:
    """Owner/admin/member (viewer 403). The author is always the caller.
    Rate-limited per actor; the attempt is not retried server-side."""
    return await task_comment_service.create_comment(
        db, user, org_id, task_id, payload
    )


@router.patch(
    "/{org_id}/tasks/{task_id}/comments/{comment_id}",
    response_model=TaskCommentRead,
    summary="Edit own comment",
)
async def update_comment(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: TaskCommentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TaskCommentRead:
    """The author only; anyone else — owners included — gets 403.
    A comment on another task or in another org is 404."""
    return await task_comment_service.update_comment(
        db, user, org_id, task_id, comment_id, payload
    )


@router.delete(
    "/{org_id}/tasks/{task_id}/comments/{comment_id}",
    status_code=204,
    summary="Delete comment (soft)",
)
async def delete_comment(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """The author, or an owner/admin. Soft delete: the row stays for audit
    and every read path skips it; a repeat delete is 404."""
    await task_comment_service.delete_comment(db, user, org_id, task_id, comment_id)
