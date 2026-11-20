"""Task comment service (Step 5d).

Object-level rules (BUILD_PLAN Step 5 security):
- Startup organizations only; wrong-type / suspended / deleted orgs 404
  via ``organization_service.startup_org_or_404`` (no existence oracle).
- Reads need an ACTIVE membership of any role (viewers read); writes
  need owner/admin/member (viewer 403).
- A comment is reached through its task, and the task lookup is scoped by
  ``org_id``: a task from another organization is 404. A comment id that
  belongs to a different task (or another org) is also 404 — never 403.
- Authorship is the authenticated user; ``author_id`` is absent from
  every input schema, so it cannot be mass-assigned.
- Soft delete (BUILD_PLAN 5d): DELETE sets ``deleted_at``. Reading,
  editing or deleting an already-deleted comment is 404, and lists skip
  them.
- Rate limit: comment writes are throttled per actor
  (``TASK_COMMENT_LIMIT``), per BUILD_PLAN 5d.
- Audit (approved D-9b): create and delete write an ``activity_events``
  row in the same transaction, so the dashboard feed has real content.
  Edits are not logged — the edited flag is on the comment itself.

Scope note: flat comments only. Threading and @mentions (design §9) need
a parent column and the notification pipeline from Step 11.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import forbidden, not_found, rate_limited
from app.models.activity import ActivityEventType
from app.models.organization import OrgRole
from app.models.task import Task
from app.models.task_comment import TaskComment
from app.models.user import User
from app.schemas.task_comment import (
    TaskCommentCreate,
    TaskCommentPage,
    TaskCommentRead,
    TaskCommentUpdate,
)
from app.services import activity_service, organization_service
from app.services.rate_limiter import rate_limiter

_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})
_COMMENT_ADMIN_ROLES = frozenset({OrgRole.owner, OrgRole.admin})

# Comment preview length in an activity summary — the feed shows one line.
_SUMMARY_PREVIEW = 80


def _display(user: User | None) -> str:
    if user is None:
        return "Someone"
    return user.display_name or user.primary_email


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


async def _comment_or_404(
    db: AsyncSession, task_id: uuid.UUID, comment_id: uuid.UUID
) -> TaskComment:
    """Scoped to this task AND not soft-deleted; a stray id is 404."""
    result = await db.execute(
        select(TaskComment).where(
            TaskComment.id == comment_id,
            TaskComment.task_id == task_id,
            TaskComment.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Comment not found.")
    return row


def _read(row: TaskComment, author: User | None, user: User, is_admin: bool) -> TaskCommentRead:
    """Per-caller capabilities so the page can disable controls, not guess."""
    is_author = row.author_id == user.id
    return TaskCommentRead(
        id=row.id,
        task_id=row.task_id,
        author_id=row.author_id,
        author_name=(author.display_name or author.primary_email) if author else None,
        body=row.body,
        created_at=row.created_at,
        updated_at=row.updated_at,
        can_edit=is_author,
        can_delete=is_author or is_admin,
    )


async def _enforce_write_limit(user: User) -> None:
    """Per-actor throttle on comment writes (BUILD_PLAN 5d)."""
    settings = get_settings()
    if not await rate_limiter.check(
        f"task_comments:user:{user.id}",
        settings.TASK_COMMENT_LIMIT,
        settings.TASK_COMMENT_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many comments. Please slow down.")


def _preview(body: str) -> str:
    flat = " ".join(body.split())
    if len(flat) <= _SUMMARY_PREVIEW:
        return flat
    return flat[: _SUMMARY_PREVIEW - 1].rstrip() + "…"


async def list_comments(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
) -> TaskCommentPage:
    """Active members read the task's live comments, oldest first."""
    org = await organization_service.startup_org_or_404(db, org_id)
    member = await organization_service.require_membership(db, org.id, user)
    task = await _require_task(db, org.id, task_id)
    is_admin = member.role in _COMMENT_ADMIN_ROLES

    filters = [TaskComment.task_id == task.id, TaskComment.deleted_at.is_(None)]
    total = (
        await db.execute(select(func.count()).select_from(TaskComment).where(*filters))
    ).scalar_one()

    rows = (
        await db.execute(
            select(TaskComment, User)
            .outerjoin(User, User.id == TaskComment.author_id)
            .where(*filters)
            .order_by(TaskComment.created_at, TaskComment.id)
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return TaskCommentPage(
        items=[_read(row, author, user, is_admin) for row, author in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


async def create_comment(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskCommentCreate,
) -> TaskCommentRead:
    """Owner/admin/member comment; authors are always the caller."""
    org = await organization_service.startup_org_or_404(db, org_id)
    member = await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    task = await _require_task(db, org.id, task_id)
    await _enforce_write_limit(user)

    # Set created_at explicitly rather than relying on the column default:
    # SQLite's CURRENT_TIMESTAMP is second-precision, so two comments posted
    # in the same second would tie and the thread order would be arbitrary.
    # Python supplies microseconds on both backends.
    row = TaskComment(
        task_id=task.id,
        author_id=user.id,
        body=payload.body,
        created_at=datetime.now(UTC),
    )
    db.add(row)
    activity_service.record(
        db,
        event_type=ActivityEventType.task_commented,
        org_id=org.id,
        actor_id=user.id,
        entity_type="task",
        entity_id=task.id,
        summary=f'{_display(user)} commented on "{task.title}": {_preview(payload.body)}',
        data={"task_id": str(task.id), "comment_id": None},
    )
    await db.commit()
    await db.refresh(row)
    return _read(row, user, user, member.role in _COMMENT_ADMIN_ROLES)


async def update_comment(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    payload: TaskCommentUpdate,
) -> TaskCommentRead:
    """Only the author may edit; anyone else gets 403."""
    org = await organization_service.startup_org_or_404(db, org_id)
    member = await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    task = await _require_task(db, org.id, task_id)
    row = await _comment_or_404(db, task.id, comment_id)
    if row.author_id != user.id:
        raise forbidden("You can only edit your own comments.")

    data = payload.model_dump(exclude_unset=True)
    if "body" in data:
        row.body = data["body"]
    await db.commit()
    await db.refresh(row)
    return _read(row, user, user, member.role in _COMMENT_ADMIN_ROLES)


async def delete_comment(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
) -> None:
    """Soft delete by the author, or by an owner/admin (BUILD_PLAN 5d)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    member = await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    task = await _require_task(db, org.id, task_id)
    row = await _comment_or_404(db, task.id, comment_id)
    if row.author_id != user.id and member.role not in _COMMENT_ADMIN_ROLES:
        raise forbidden("Only the author or an owner/admin can delete this comment.")

    row.deleted_at = datetime.now(UTC)
    activity_service.record(
        db,
        event_type=ActivityEventType.task_comment_deleted,
        org_id=org.id,
        actor_id=user.id,
        entity_type="task",
        entity_id=task.id,
        summary=f'{_display(user)} deleted a comment on "{task.title}".',
        data={"task_id": str(task.id), "comment_id": str(row.id)},
    )
    await db.commit()
