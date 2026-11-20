"""Task router (Step 5c).

Thin routes (AGENTS.md section 3): the actor always comes from the auth
dependency; path params are uuid.UUID so malformed ids 422 before any
service code runs. Object-level membership checks, org scoping (IDOR),
reference validation and move/reorder logic live in task_service.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.task import TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.task import TaskCreate, TaskMove, TaskPage, TaskRead, TaskUpdate
from app.services import task_service

router = APIRouter(prefix="/organizations", tags=["tasks"])


@router.post(
    "/{org_id}/tasks",
    response_model=TaskRead,
    status_code=201,
    summary="Create task",
)
async def create_task(
    org_id: uuid.UUID,
    payload: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TaskRead:
    """Owner/admin/member create (viewer 403). Starts in the ``todo``
    column at the end; milestone/assignee must belong to this org (422)."""
    return await task_service.create_task(
        db, user, org_id, payload, background_tasks=background_tasks
    )


@router.get(
    "/{org_id}/tasks",
    response_model=TaskPage,
    summary="List tasks",
)
async def list_tasks(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["display_order", "created_at", "due_on"] = "display_order",
    order: Literal["asc", "desc"] = "asc",
    assignee_id: Annotated[uuid.UUID | None, Query()] = None,
    status: Annotated[TaskStatus | None, Query()] = None,
    priority: Annotated[TaskPriority | None, Query()] = None,
    milestone_id: Annotated[uuid.UUID | None, Query()] = None,
    due_this_week: bool = False,
    assigned_to_me: bool = False,
    label_id: Annotated[uuid.UUID | None, Query()] = None,
) -> TaskPage:
    """Active members (including viewers) list the org's open tasks,
    paginated with whitelisted sort/filter fields (plan D4 filters).
    ``label_id`` (Step 5d) filters to tasks carrying one label."""
    return await task_service.list_tasks(
        db,
        user,
        org_id,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
        assignee_id=assignee_id,
        status=status,
        priority=priority,
        milestone_id=milestone_id,
        due_this_week=due_this_week,
        assigned_to_me=assigned_to_me,
        label_id=label_id,
    )


@router.get(
    "/{org_id}/tasks/{task_id}",
    response_model=TaskRead,
    summary="Get task",
)
async def get_task(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TaskRead:
    """Read one task; an id from another organization is 404."""
    return await task_service.get_task(db, user, org_id, task_id)


@router.patch(
    "/{org_id}/tasks/{task_id}",
    response_model=TaskRead,
    summary="Update task fields",
)
async def update_task(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdate,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TaskRead:
    """Owner/admin/member field patch (viewer 403). ``status`` /
    ``completed_at`` / ``display_order`` belong to /move (plan D6);
    server-controlled fields are rejected with 422 by extra=forbid."""
    return await task_service.update_task(
        db, user, org_id, task_id, payload, background_tasks=background_tasks
    )


@router.patch(
    "/{org_id}/tasks/{task_id}/move",
    response_model=TaskRead,
    summary="Move task (column and/or position)",
)
async def move_task(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskMove,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TaskRead:
    """Board move: optional ``status`` (column) and optional anchor
    (``before_id`` XOR ``after_id``) — at least one action required.
    The server owns ``completed_at`` (set on done, cleared on leave)
    and computes ``display_order`` (midpoint insert, plan D3)."""
    return await task_service.move_task(
        db, user, org_id, task_id, payload, background_tasks=background_tasks
    )


@router.delete(
    "/{org_id}/tasks/{task_id}",
    status_code=204,
    summary="Delete task (soft)",
)
async def delete_task(
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Soft delete (deleted_at set); repeat deletes are 404."""
    await task_service.delete_task(
        db, user, org_id, task_id, background_tasks=background_tasks
    )
