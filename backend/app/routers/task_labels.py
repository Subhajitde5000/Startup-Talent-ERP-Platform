"""Task label router (Step 5d).

Thin routes (AGENTS.md section 3): the actor always comes from the auth
dependency and path params are ``uuid.UUID``, so a malformed id is a 422
before any service code runs. Membership, org scoping (IDOR), name
uniqueness and same-org label validation live in ``task_label_service``.

Two prefixes in one module because "the labels of a task" and "the labels
of an organization" are the same resource seen from both ends:
``/organizations/{org_id}/task-labels`` for the catalogue and
``/organizations/{org_id}/tasks/{task_id}/labels`` for the attachment set.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.task_label import (
    TaskLabelCreate,
    TaskLabelPage,
    TaskLabelRead,
    TaskLabelSet,
    TaskLabelUpdate,
)
from app.services import task_label_service

router = APIRouter(prefix="/organizations", tags=["task labels"])


@router.get(
    "/{org_id}/task-labels",
    response_model=TaskLabelPage,
    summary="List task labels",
)
async def list_labels(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["name", "created_at"] = "name",
    order: Literal["asc", "desc"] = "asc",
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> TaskLabelPage:
    """Any active member (viewer included) lists the org's labels,
    paginated with a whitelisted sort and an optional name search."""
    return await task_label_service.list_labels(
        db, user, org_id, limit=limit, offset=offset, sort=sort, order=order, q=q
    )


@router.post(
    "/{org_id}/task-labels",
    response_model=TaskLabelRead,
    status_code=201,
    summary="Create task label",
)
async def create_label(
    org_id: uuid.UUID,
    payload: TaskLabelCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TaskLabelRead:
    """Owner/admin only (viewer and member 403). A name that already
    exists in any casing is 409 ``LABEL_NAME_TAKEN``."""
    return await task_label_service.create_label(db, user, org_id, payload)


@router.patch(
    "/{org_id}/task-labels/{label_id}",
    response_model=TaskLabelRead,
    summary="Update task label",
)
async def update_label(
    org_id: uuid.UUID,
    label_id: uuid.UUID,
    payload: TaskLabelUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TaskLabelRead:
    """Owner/admin rename or recolour; a label from another organization
    is 404 (no existence oracle)."""
    return await task_label_service.update_label(db, user, org_id, label_id, payload)


@router.delete(
    "/{org_id}/task-labels/{label_id}",
    status_code=204,
    summary="Delete task label",
)
async def delete_label(
    org_id: uuid.UUID,
    label_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Owner/admin hard delete. Links cascade; tasks are untouched."""
    await task_label_service.delete_label(db, user, org_id, label_id)


@router.put(
    "/{org_id}/tasks/{task_id}/labels",
    response_model=list[TaskLabelRead],
    summary="Set a task's labels (replace-set)",
)
async def set_task_labels(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskLabelSet,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[TaskLabelRead]:
    """Attach and detach in one idempotent call: the body is the complete
    set the task should carry afterwards. Owner/admin/member (viewer 403);
    every label must belong to this organization (422 on ``label_ids``),
    and a task from another org is 404."""
    return await task_label_service.set_task_labels(
        db, user, org_id, task_id, payload
    )
