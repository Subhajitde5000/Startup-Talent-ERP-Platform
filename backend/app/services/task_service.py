"""Task service (Step 5c).

Object-level rules (BUILD_PLAN Step 5 security):
- Startup organizations only; wrong-type / suspended / deleted orgs
  404 via ``organization_service.startup_org_or_404`` (no oracle).
- Reads need an ACTIVE membership of any role (viewers read); writes
  additionally require owner/admin/member (viewers 403).
- Every task lookup is scoped by ``org_id``: a foreign task id is 404,
  never 403 (no existence oracle).
- Payload references are field-validated with 422 + ``loc``:
  ``milestone_id`` must be an open milestone of this org, ``assignee_id``
  an active member (same guard as the 5b owner rule), ``readiness_id``
  (Step 5f) a readiness row of this org, and move anchors must be open
  tasks of the TARGET column in this org.
- Server-controlled fields (id, org_id, created_by, completed_at,
  display_order, timestamps) are absent from every input
  schema (extra=forbid -> 422) — plan D1/D6.
- Soft delete: DELETE sets ``deleted_at``; reads and lists skip it.

Move/reorder (plan D3): the move endpoint takes an optional anchor
(``before_id`` or ``after_id``) instead of a raw order number. The new
``display_order`` is the integer midpoint between neighbours (column
ends use max+1 / min-1). If no integer gap exists (concurrent inserts),
ONLY that column is renumbered (x10 spacing) and the slot recomputed —
never a global renumber, and never on an ordinary drag. Reads sort
``display_order, created_at, id`` for stable pagination.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy import case, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.core.exceptions import not_found, validation_error
from app.models.milestone import Milestone
from app.models.organization import OrgRole
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.task_label import TaskLabelLink
from app.models.user import User
from app.schemas.task import TaskCreate, TaskMove, TaskPage, TaskRead, TaskUpdate
from app.services import (
    organization_service,
    readiness_service,
    status_notification_service,
    task_label_service,
)

# Viewer role is deliberately excluded from writes (plan permission table).
_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})

# Whitelisted sort keys -> columns (the router narrows with Literal too).
_SORT_COLUMNS: dict[str, InstrumentedAttribute] = {
    "display_order": Task.display_order,
    "created_at": Task.created_at,
    "due_on": Task.due_on,
}


def _ref_error(field: str, message: str) -> Exception:  # noqa: ANN401
    """422 carrying a pydantic-style loc so the frontend can map it."""
    return validation_error(
        message,
        details=[{"loc": ["body", field], "msg": message, "type": "value_error"}],
    )


async def _require_assignee(
    db: AsyncSession, org_id, user_id  # noqa: ANN001
) -> None:
    await organization_service.require_active_member_ref(
        db, org_id, user_id, field="assignee_id", label="Assignee"
    )


async def _require_milestone(
    db: AsyncSession, org_id, milestone_id  # noqa: ANN001
) -> None:
    """Cross-org/IDOR guard for milestone references: 422 on body.milestone_id."""
    result = await db.execute(
        select(Milestone.id).where(
            Milestone.id == milestone_id,
            Milestone.org_id == org_id,
            Milestone.deleted_at.is_(None),
        )
    )
    if result.first() is None:
        raise _ref_error(
            "milestone_id",
            "Milestone must be an open milestone of this organization.",
        )


async def _get_task(
    db: AsyncSession, org_id, task_id  # noqa: ANN001
) -> Task:
    """Scoped to the path org and not soft-deleted; missing rows 404."""
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.org_id == org_id,
            Task.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Task not found.")
    return row


def _read(row: Task, labels: list | None = None) -> TaskRead:
    """Serialise one task. ``labels`` (5d) is passed in by the caller so a
    list read costs one batched query for the whole page, never one per
    task; single-task reads pass that task's labels explicitly."""
    read = TaskRead.model_validate(row, from_attributes=True)
    return read.model_copy(update={"labels": labels or []})


async def _max_order(
    db: AsyncSession,
    org_id,  # noqa: ANN001
    status: TaskStatus,
    *,
    exclude_id=None,  # noqa: ANN001
) -> int:
    """Append position: max display_order in the column + 1 (empty = 0)."""
    filters = [
        Task.org_id == org_id,
        Task.status == status,
        Task.deleted_at.is_(None),
    ]
    if exclude_id is not None:
        filters.append(Task.id != exclude_id)
    result = await db.execute(
        select(func.coalesce(func.max(Task.display_order), -1)).where(*filters)
    )
    return int(result.scalar_one()) + 1


async def _column_rows(
    db: AsyncSession,
    org_id,  # noqa: ANN001
    status: TaskStatus,
    *,
    exclude_id=None,  # noqa: ANN001
) -> list[Task]:
    filters = [
        Task.org_id == org_id,
        Task.status == status,
        Task.deleted_at.is_(None),
    ]
    if exclude_id is not None:
        filters.append(Task.id != exclude_id)
    result = await db.execute(
        select(Task)
        .where(*filters)
        .order_by(Task.display_order, Task.created_at, Task.id)
    )
    return list(result.scalars().all())


async def _place(
    db: AsyncSession,
    org_id,  # noqa: ANN001
    task: Task,
    *,
    target_status: TaskStatus,
    anchor: Task,
    side: str,  # "before" | "after"
) -> int:
    """New display_order for ``task`` next to ``anchor`` (plan D3)."""
    rows = await _column_rows(db, org_id, target_status, exclude_id=task.id)
    idx = next((i for i, r in enumerate(rows) if r.id == anchor.id), None)
    if idx is None:
        # Anchor validated in-column moments ago; a race would only lose
        # the position, never correctness — fall back to append.
        return await _max_order(db, org_id, target_status, exclude_id=task.id)

    prev_order: int | None
    next_order: int | None
    if side == "after":
        prev_order = rows[idx].display_order
        next_order = rows[idx + 1].display_order if idx + 1 < len(rows) else None
    else:
        next_order = rows[idx].display_order
        prev_order = rows[idx - 1].display_order if idx > 0 else None

    if side == "after" and next_order is None:
        return rows[idx].display_order + 1
    if side == "before" and prev_order is None:
        return rows[idx].display_order - 1
    if (
        prev_order is not None
        and next_order is not None
        and next_order - prev_order > 1
    ):
        return (prev_order + next_order) // 2

    # No integer gap (adjacent orders from concurrent inserts): renumber
    # THIS column only (x10 spacing), then take the guaranteed midpoint.
    for i, row in enumerate(rows):
        row.display_order = i * 10
    await db.flush()
    rows = await _column_rows(db, org_id, target_status, exclude_id=task.id)
    idx = next((i for i, r in enumerate(rows) if r.id == anchor.id), None)
    if idx is None:
        return await _max_order(db, org_id, target_status, exclude_id=task.id)
    if side == "after":
        if idx + 1 >= len(rows):
            return rows[idx].display_order + 1
        return (rows[idx].display_order + rows[idx + 1].display_order) // 2
    if idx == 0:
        return rows[idx].display_order - 1
    return (rows[idx - 1].display_order + rows[idx].display_order) // 2


async def create_task(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    payload: TaskCreate,
    *,
    background_tasks: BackgroundTasks | None = None,
) -> TaskRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    data = payload.model_dump(exclude_unset=True)
    milestone_name: str | None = None
    if data.get("milestone_id") is not None:
        await _require_milestone(db, org.id, data["milestone_id"])
        ms = await db.get(Milestone, data["milestone_id"])
        if ms:
            milestone_name = ms.name
    assignee_name: str | None = None
    if data.get("assignee_id") is not None:
        await _require_assignee(db, org.id, data["assignee_id"])
        u = await db.get(User, data["assignee_id"])
        if u:
            assignee_name = u.display_name or u.primary_email
    task = Task(org_id=org.id, created_by=user.id, **data)
    # New tasks start at the end of the "todo" column (server-controlled).
    task.display_order = await _max_order(db, org.id, TaskStatus.todo)
    db.add(task)
    recipients = await status_notification_service.get_active_team_recipients(
        db, org.id, category="tasks"
    )
    await db.commit()
    await db.refresh(task)

    status_notification_service.queue_task_notification(
        background_tasks,
        recipients=recipients,
        org_name=org.name,
        actor_name=user.display_name or user.primary_email,
        action="created",
        task_title=task.title,
        status=task.status.value,
        priority=task.priority.value,
        due_on=str(task.due_on) if task.due_on else None,
        assignee_name=assignee_name,
        milestone_name=milestone_name,
    )

    # A task created this instant carries no labels (5d) — attach happens
    # through PUT /tasks/{id}/labels.
    return _read(task)


async def list_tasks(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    *,
    limit: int,
    offset: int,
    sort: str,
    order: str,
    assignee_id,  # noqa: ANN001
    status: TaskStatus | None,
    priority: TaskPriority | None,
    milestone_id,  # noqa: ANN001
    due_this_week: bool,
    assigned_to_me: bool,
    label_id=None,  # noqa: ANN001
) -> TaskPage:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    filters = [Task.org_id == org.id, Task.deleted_at.is_(None)]
    if assignee_id is not None:
        filters.append(Task.assignee_id == assignee_id)
    if status is not None:
        filters.append(Task.status == status)
    if priority is not None:
        filters.append(Task.priority == priority)
    if milestone_id is not None:
        filters.append(Task.milestone_id == milestone_id)
    if due_this_week:
        # Plan D4: due today..+7 (server UTC date), open tasks only —
        # mirrors the demo's due-week counter.
        today = datetime.now(UTC).date()
        filters += [
            Task.due_on.is_not(None),
            Task.due_on >= today,
            Task.due_on <= today + timedelta(days=7),
            Task.status != TaskStatus.done,
        ]
    if assigned_to_me:
        filters.append(Task.assignee_id == user.id)
    if label_id is not None:
        # Step 5d: EXISTS rather than a join, so a task with several
        # matching labels still appears once and COUNT(*) stays correct.
        filters.append(
            exists().where(
                TaskLabelLink.task_id == Task.id,
                TaskLabelLink.label_id == label_id,
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(Task).where(*filters))
    ).scalar_one()

    column = _SORT_COLUMNS.get(sort, Task.display_order)
    direction = column.desc() if order == "desc" else column.asc()
    # Stable tiebreaks so offset pagination never repeats or skips rows;
    # display_order repeats across columns (per-column namespace), so the
    # secondary keys keep cross-column listings deterministic too.
    order_by: list[Any] = []
    if sort == "due_on":
        # Undated tasks sort last in both orders, on SQLite and PostgreSQL
        # alike (NULL ordering differs between the two) — 5b convention.
        undated = case((Task.due_on.is_(None), 1), else_=0)
        order_by.append(undated.asc())
    order_by.append(direction)
    if sort == "display_order":
        order_by.append(Task.created_at)
    order_by.append(Task.id)

    result = await db.execute(
        select(Task).where(*filters).order_by(*order_by).limit(limit).offset(offset)
    )
    rows = result.scalars().all()
    # One query for every label on the page (5d) — never one per task.
    labels_by_task = await task_label_service.labels_for_tasks(db, [row.id for row in rows])
    items = [_read(row, labels_by_task.get(row.id)) for row in rows]
    return TaskPage(items=items, total=total, limit=limit, offset=offset)


async def get_task(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    task_id,  # noqa: ANN001
) -> TaskRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    row = await _get_task(db, org.id, task_id)
    return _read(row, await task_label_service.labels_for_task(db, row.id))


async def update_task(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    task_id,  # noqa: ANN001
    payload: TaskUpdate,
    *,
    background_tasks: BackgroundTasks | None = None,
) -> TaskRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    row = await _get_task(db, org.id, task_id)
    data = payload.model_dump(exclude_unset=True)
    if "milestone_id" in data and data["milestone_id"] is not None:
        await _require_milestone(db, org.id, data["milestone_id"])
    if "assignee_id" in data and data["assignee_id"] is not None:
        await _require_assignee(db, org.id, data["assignee_id"])
    if "readiness_id" in data and data["readiness_id"] is not None:
        # Step 5f: the linked criterion must be this org's readiness row.
        await readiness_service.require_readiness_ref(
            db, org.id, data["readiness_id"]
        )
    for field, value in data.items():
        setattr(row, field, value)

    assignee_name: str | None = None
    if row.assignee_id:
        u = await db.get(User, row.assignee_id)
        if u:
            assignee_name = u.display_name or u.primary_email
    milestone_name: str | None = None
    if row.milestone_id:
        ms = await db.get(Milestone, row.milestone_id)
        if ms:
            milestone_name = ms.name
    recipients = await status_notification_service.get_active_team_recipients(
        db, org.id, category="tasks"
    )

    await db.commit()
    # Same post-commit refresh reason as the profile/milestone services.
    await db.refresh(row)

    status_notification_service.queue_task_notification(
        background_tasks,
        recipients=recipients,
        org_name=org.name,
        actor_name=user.display_name or user.primary_email,
        action="updated",
        task_title=row.title,
        status=row.status.value,
        priority=row.priority.value,
        due_on=str(row.due_on) if row.due_on else None,
        assignee_name=assignee_name,
        milestone_name=milestone_name,
    )

    return _read(row, await task_label_service.labels_for_task(db, row.id))


async def move_task(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    task_id,  # noqa: ANN001
    payload: TaskMove,
    *,
    background_tasks: BackgroundTasks | None = None,
) -> TaskRead:
    """Column move and/or in-column position (plan D3/D6): the only
    writer of ``status``, ``completed_at`` and ``display_order``."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    task = await _get_task(db, org.id, task_id)

    data = payload.model_dump(exclude_unset=True)
    status_value = data.get("status")
    new_status = status_value if status_value is not None else task.status
    old_status = task.status
    before_id = data.get("before_id")
    after_id = data.get("after_id")
    side = "before" if before_id is not None else ("after" if after_id is not None else None)

    anchor: Task | None = None
    if side is not None:
        anchor_id = before_id if side == "before" else after_id
        field = f"{side}_id"
        if anchor_id == task.id:
            raise _ref_error(field, "A task cannot be positioned relative to itself.")
        # Anchors are field references: wrong org / wrong column / deleted
        # are all a 422 with a field-level loc (never an existence oracle).
        result = await db.execute(
            select(Task).where(
                Task.id == anchor_id,
                Task.org_id == org.id,
                Task.deleted_at.is_(None),
                Task.status == new_status,
            )
        )
        anchor = result.scalar_one_or_none()
        if anchor is None:
            raise _ref_error(
                field,
                "Anchor must be an open task of the target column in this organization.",
            )

    status_changed = new_status != task.status
    if status_changed:
        task.status = new_status
        if new_status == TaskStatus.done:
            if task.completed_at is None:
                task.completed_at = datetime.now(UTC)
        else:
            task.completed_at = None
    elif new_status == TaskStatus.done and task.completed_at is None:
        # Self-heal: a done task always carries a completion time.
        task.completed_at = datetime.now(UTC)

    if anchor is not None and side is not None:
        task.display_order = await _place(
            db, org.id, task, target_status=new_status, anchor=anchor, side=side
        )
    elif status_changed:
        task.display_order = await _max_order(
            db, org.id, new_status, exclude_id=task.id
        )

    recipients = await status_notification_service.get_active_team_recipients(
        db, org.id, category="tasks"
    )

    await db.commit()
    await db.refresh(task)

    if status_changed:
        status_notification_service.queue_task_notification(
            background_tasks,
            recipients=recipients,
            org_name=org.name,
            actor_name=user.display_name or user.primary_email,
            action="moved",
            task_title=task.title,
            status=task.status.value,
            old_status=old_status.value,
            priority=task.priority.value,
            due_on=str(task.due_on) if task.due_on else None,
        )

    return _read(task, await task_label_service.labels_for_task(db, task.id))


async def delete_task(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    task_id,  # noqa: ANN001
    *,
    background_tasks: BackgroundTasks | None = None,
) -> None:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    row = await _get_task(db, org.id, task_id)
    task_title = row.title
    row.deleted_at = datetime.now(UTC)
    recipients = await status_notification_service.get_active_team_recipients(
        db, org.id, category="tasks"
    )
    await db.commit()

    status_notification_service.queue_task_notification(
        background_tasks,
        recipients=recipients,
        org_name=org.name,
        actor_name=user.display_name or user.primary_email,
        action="deleted",
        task_title=task_title,
    )
