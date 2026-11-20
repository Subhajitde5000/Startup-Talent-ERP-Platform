"""Task label service (Step 5d).

Object-level rules (BUILD_PLAN Step 5 security):
- Startup organizations only; wrong-type / suspended / deleted orgs 404
  via ``organization_service.startup_org_or_404`` (no existence oracle).
- Reads need an ACTIVE membership of any role (viewers read); label CRUD
  is owner/admin only (approved D-7: the design doc says labels are
  "managed by admins"), while attaching/detaching needs owner/admin/
  member because that is part of editing a task.
- Every lookup is scoped by ``org_id``: a label from another organization
  is 404 on the label routes and 422 on the replace-set (it is a field
  reference there, so the frontend can map it to the picker) — never a
  403, which would leak existence.
- Server-controlled fields are absent from every input schema and the
  link's ``created_at`` is never accepted from a client.

Uniqueness: ``task_labels_org_name_key`` is a functional unique index on
``(org_id, lower(name))`` (plan D-1). A duplicate is reported as 409
``LABEL_NAME_TAKEN`` rather than a 500, and the concurrent-insert race is
caught by the same handler instead of pre-checking and hoping.

Deleting a label is a hard delete (plan D-4) and cascades its links; the
tasks themselves are untouched. There is no soft delete, so the same name
can be created again immediately.
"""

import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException, not_found, validation_error
from app.models.organization import OrgRole
from app.models.task import Task
from app.models.task_label import (
    MAX_LABELS_PER_ORG,
    MAX_LABELS_PER_TASK,
    TaskLabel,
    TaskLabelLink,
)
from app.models.user import User
from app.schemas.task_label import (
    TaskLabelCreate,
    TaskLabelPage,
    TaskLabelRead,
    TaskLabelSet,
    TaskLabelUpdate,
)
from app.services import organization_service

# Plan D-7: the label catalogue belongs to owner/admin ("managed by admins").
_LABEL_ADMIN_ROLES = frozenset({OrgRole.owner, OrgRole.admin})
# Editing what a task carries is part of editing the task (5c write roles).
_TASK_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})

LABEL_NAME_TAKEN = "LABEL_NAME_TAKEN"

_SORT_COLUMNS = {
    "name": TaskLabel.name,
    "created_at": TaskLabel.created_at,
}


def _read(row: TaskLabel) -> TaskLabelRead:
    return TaskLabelRead.model_validate(row, from_attributes=True)


def _ref_error(field: str, message: str) -> Exception:  # noqa: ANN401
    """422 carrying a pydantic-style loc so the frontend can map it."""
    return validation_error(
        message,
        details=[{"loc": ["body", field], "msg": message, "type": "value_error"}],
    )


async def _require_task(db: AsyncSession, org_id: uuid.UUID, task_id: uuid.UUID) -> Task:
    """Org-scoped, not-deleted task lookup (a foreign id is 404)."""
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


async def _label_or_404(
    db: AsyncSession, org_id: uuid.UUID, label_id: uuid.UUID
) -> TaskLabel:
    result = await db.execute(
        select(TaskLabel).where(
            TaskLabel.id == label_id, TaskLabel.org_id == org_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Label not found.")
    return row


async def labels_for_tasks(
    db: AsyncSession, task_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[TaskLabelRead]]:
    """Batched label load for a list of tasks (one query, no N+1).

    Returns only ids that have labels; callers default to an empty list.
    """
    if not task_ids:
        return {}
    result = await db.execute(
        select(TaskLabelLink.task_id, TaskLabel)
        .join(TaskLabel, TaskLabel.id == TaskLabelLink.label_id)
        .where(TaskLabelLink.task_id.in_(task_ids))
        .order_by(TaskLabel.name)
    )
    out: dict[uuid.UUID, list[TaskLabelRead]] = {}
    for task_id, label in result.all():
        out.setdefault(task_id, []).append(_read(label))
    return out


async def list_labels(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
    sort: str,
    order: str,
    q: str | None,
) -> TaskLabelPage:
    """Any active member lists the org's labels, paginated (5b/5c shape)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    filters = [TaskLabel.org_id == org.id]
    if q:
        # Case-insensitive substring search on the label name only.
        filters.append(func.lower(TaskLabel.name).like(f"%{q.strip().lower()}%"))

    total = (
        await db.execute(select(func.count()).select_from(TaskLabel).where(*filters))
    ).scalar_one()

    column = _SORT_COLUMNS.get(sort, TaskLabel.name)
    direction = column.desc() if order == "desc" else column.asc()
    result = await db.execute(
        select(TaskLabel)
        .where(*filters)
        .order_by(direction, TaskLabel.id)
        .limit(limit)
        .offset(offset)
    )
    items = [_read(row) for row in result.scalars().all()]
    return TaskLabelPage(items=items, total=total, limit=limit, offset=offset)


async def create_label(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: TaskLabelCreate
) -> TaskLabelRead:
    """Owner/admin create. Duplicate name (any casing) is 409."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_LABEL_ADMIN_ROLES)
    )

    count = (
        await db.execute(
            select(func.count()).select_from(TaskLabel).where(TaskLabel.org_id == org.id)
        )
    ).scalar_one()
    if count >= MAX_LABELS_PER_ORG:
        raise AppException(
            "LABEL_LIMIT_REACHED",
            f"An organization can have at most {MAX_LABELS_PER_ORG} labels.",
            409,
        )

    row = TaskLabel(org_id=org.id, name=payload.name, color=payload.color)
    db.add(row)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise AppException(
            LABEL_NAME_TAKEN,
            "A label with that name already exists.",
            409,
        ) from None
    await db.commit()
    await db.refresh(row)
    return _read(row)


async def update_label(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    label_id: uuid.UUID,
    payload: TaskLabelUpdate,
) -> TaskLabelRead:
    """Owner/admin rename/recolour. Duplicate name (any casing) is 409."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_LABEL_ADMIN_ROLES)
    )
    row = await _label_or_404(db, org.id, label_id)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppException(
            LABEL_NAME_TAKEN,
            "A label with that name already exists.",
            409,
        ) from None
    await db.refresh(row)
    return _read(row)


async def delete_label(
    db: AsyncSession, user: User, org_id: uuid.UUID, label_id: uuid.UUID
) -> None:
    """Owner/admin hard delete; links cascade, tasks are untouched."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_LABEL_ADMIN_ROLES)
    )
    row = await _label_or_404(db, org.id, label_id)
    await db.delete(row)
    await db.commit()


async def set_task_labels(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskLabelSet,
) -> list[TaskLabelRead]:
    """Replace the task's label set (attach and detach in one call).

    Ids are de-duplicated, capped at the design limit, and every one must
    be a label of THIS organization — otherwise 422 on ``label_ids``,
    never a 404 (a field reference, not a resource).
    """
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_TASK_WRITE_ROLES)
    )
    task = await _require_task(db, org.id, task_id)

    wanted = list(dict.fromkeys(payload.label_ids))
    if len(wanted) > MAX_LABELS_PER_TASK:
        raise _ref_error(
            "label_ids", f"A task can have at most {MAX_LABELS_PER_TASK} labels."
        )

    if wanted:
        found = (
            (
                await db.execute(
                    select(TaskLabel.id).where(
                        TaskLabel.org_id == org.id, TaskLabel.id.in_(wanted)
                    )
                )
            )
            .scalars()
            .all()
        )
        missing = set(wanted) - set(found)
        if missing:
            # Cross-org or deleted label: one field-level 422, not an oracle.
            raise _ref_error(
                "label_ids", "Every label must belong to this organization."
            )

    current = (
        (
            await db.execute(
                select(TaskLabelLink.label_id).where(TaskLabelLink.task_id == task.id)
            )
        )
        .scalars()
        .all()
    )
    current_set = set(current)
    to_add = [label_id for label_id in wanted if label_id not in current_set]
    to_remove = [label_id for label_id in current if label_id not in set(wanted)]
    if to_remove:
        await db.execute(
            delete(TaskLabelLink).where(
                TaskLabelLink.task_id == task.id,
                TaskLabelLink.label_id.in_(to_remove),
            )
        )
    for label_id in to_add:
        db.add(TaskLabelLink(task_id=task.id, label_id=label_id))
    await db.commit()

    refreshed = await labels_for_tasks(db, [task.id])
    return refreshed.get(task.id, [])


async def labels_for_task(db: AsyncSession, task_id: uuid.UUID) -> list[TaskLabelRead]:
    """One task's labels (the replace-set response and the 5c read helper)."""
    return (await labels_for_tasks(db, [task_id])).get(task_id, [])
