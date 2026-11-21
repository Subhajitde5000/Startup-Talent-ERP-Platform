"""Step 8e service: mentor deliverables.

Authorization in one place per operation:

- The **mentor on the mentorship** creates, edits any field, and deletes.
- The **assignee** (``owner_id``) may move the row through the assignee
  half of the state machine (``in_progress`` / ``submitted``) and write
  ``evidence``. They may not reassign, retitle or delete it.
- Any **active member** of the startup (viewer included) may READ: a viewer
  is read-only everywhere in the product (5d/5g/8a/8b precedent).
- Everyone else gets **404**, never 403: a deliverable's existence must not
  be probeable by an outsider (8b's no-existence-oracle rule).

``overdue`` is never written. ``is_overdue`` on the read is derived from
``due_on`` and the row's status, so the UI gets the same answer without a
scheduler (8e plan D-5).
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    forbidden,
    not_found,
    rate_limited,
    validation_error,
)
from app.models.activity import ActivityEventType
from app.models.deliverable import (
    ASSIGNEE_STATUSES,
    REVIEW_STATUSES,
    DeliverableStatus,
    MentorDeliverable,
)
from app.models.mentorship import Mentorship
from app.models.organization import OrganizationMember
from app.models.readiness import ReadinessCriterion
from app.models.user import User
from app.schemas.deliverable import (
    DeliverableCreate,
    DeliverableOwner,
    DeliverableRead,
    DeliverableUpdate,
)
from app.services import activity_service, rate_limiter

# status -> statuses it may move to, per actor class.
_ASSIGNEE_TRANSITIONS: dict[DeliverableStatus, frozenset[DeliverableStatus]] = {
    DeliverableStatus.not_started: frozenset({DeliverableStatus.in_progress}),
    DeliverableStatus.in_progress: frozenset({DeliverableStatus.submitted}),
    DeliverableStatus.changes_requested: frozenset({DeliverableStatus.in_progress}),
    # Re-open an accepted item only by asking for changes; accepted is final
    # for the assignee so a submitted item cannot be un-accepted by them.
    DeliverableStatus.submitted: frozenset(),
    DeliverableStatus.accepted: frozenset(),
}

_REVIEW_TRANSITIONS: dict[DeliverableStatus, frozenset[DeliverableStatus]] = {
    DeliverableStatus.submitted: frozenset(
        {DeliverableStatus.accepted, DeliverableStatus.changes_requested}
    ),
}

# Coherence cap mirroring 8c's SLOTS_PER_WEEK_MAX: a mentorship with more
# open work than this is a data-entry accident, not a plan.
MAX_OPEN_PER_MENTORSHIP = 50


async def _enforce_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"deliverable_write:user:{user.id}",
        settings.DELIVERABLE_WRITE_LIMIT,
        settings.DELIVERABLE_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many deliverable changes. Please slow down.")


def _initials(name: str | None) -> str:
    parts = [p for p in (name or "?").split() if p]
    return "".join(p[0] for p in parts[:2]).upper() or "?"


async def _load_mentorship(db: AsyncSession, mentorship_id: uuid.UUID) -> Mentorship:
    row = (
        await db.execute(
            select(Mentorship).where(
                Mentorship.id == mentorship_id, Mentorship.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Mentorship not found.")
    return row


async def _startup_role(
    db: AsyncSession, org_id: uuid.UUID, user: User
) -> str | None:
    """The caller's ACTIVE role in the startup, or None."""
    return (
        await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == "active",
            )
        )
    ).scalar_one_or_none()


async def _viewer(db: AsyncSession, mentorship: Mentorship, user: User) -> str:
    """``'mentor'`` or the startup member's role, or 404 for an outsider."""
    if mentorship.mentor_id == user.id:
        return "mentor"
    role = await _startup_role(db, mentorship.startup_org_id, user)
    if role is None:
        raise not_found("Mentorship not found.")
    return role


async def require_mentor(
    db: AsyncSession, mentorship: Mentorship, user: User
) -> None:
    """Only the mentor named on the row may create, retitle or delete."""
    if mentorship.mentor_id != user.id:
        # A startup member is a participant, so 403 is honest here; an
        # outsider was already rejected with 404 by ``_viewer``.
        raise forbidden("Only the mentor can change deliverables.")


async def _load_deliverable(
    db: AsyncSession, deliverable_id: uuid.UUID
) -> MentorDeliverable:
    row = (
        await db.execute(
            select(MentorDeliverable).where(
                MentorDeliverable.id == deliverable_id,
                MentorDeliverable.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Deliverable not found.")
    return row


async def _owner_applies(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID, field: str = "owner_id"
) -> None:
    """Cross-organization guard for ``owner_id`` (8e plan D-4).

    Mirrors ``organization_service.require_active_member_ref``: a non-member
    is a 422 on the field so the client can render it, never a 500 or a
    silently dangling assignment.
    """
    member = (
        await db.execute(
            select(OrganizationMember.id).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == user_id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == "active",
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise validation_error(
            "That person is not an active member of this startup.",
            details=[
                {
                    "loc": ["body", field],
                    "msg": "Choose an active member of this startup.",
                    "type": "value_error",
                }
            ],
        )


async def _criterion_or_422(
    db: AsyncSession, criterion_id: uuid.UUID
) -> ReadinessCriterion:
    row = (
        await db.execute(
            select(ReadinessCriterion).where(
                ReadinessCriterion.id == criterion_id,
                ReadinessCriterion.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise validation_error(
            "Unknown readiness criterion.",
            details=[
                {
                    "loc": ["body", "linked_criterion"],
                    "msg": "Pick an active readiness criterion.",
                    "type": "value_error",
                }
            ],
        )
    return row


def _require_future_due(due_on: date | None) -> None:
    """A new deadline in the past is a typo, not a plan (8e plan validation)."""
    if due_on is None:
        return
    if due_on < date.today():
        raise validation_error(
            "A due date cannot be in the past.",
            details=[
                {
                    "loc": ["body", "due_on"],
                    "msg": "Choose today or a later date.",
                    "type": "value_error",
                }
            ],
        )


def _is_overdue(row: MentorDeliverable) -> bool:
    """Derived, never stored (8e plan D-5)."""
    if row.due_on is None:
        return False
    if DeliverableStatus(row.status) in (
        DeliverableStatus.accepted,
        DeliverableStatus.submitted,
    ):
        # Finished or awaiting review: no longer the assignee's problem.
        return False
    return row.due_on < date.today()


def _read(
    row: MentorDeliverable,
    *,
    owner_name: str | None,
    criterion_title: str | None,
    viewer_side: str,
    viewer_role: str,
    viewer_id: uuid.UUID,
) -> DeliverableRead:
    is_mentor = viewer_side == "mentor"
    is_owner = row.owner_id is not None and row.owner_id == viewer_id
    return DeliverableRead(
        id=row.id,
        mentorship_id=row.mentorship_id,
        title=row.title,
        description=row.description,
        status=DeliverableStatus(row.status),
        evidence=row.evidence,
        due_on=row.due_on,
        is_overdue=_is_overdue(row),
        linked_criterion=row.linked_criterion,
        linked_criterion_title=criterion_title,
        owner=(
            DeliverableOwner(
                user_id=row.owner_id,
                display_name=owner_name or "Teammate",
                avatar_initials=_initials(owner_name),
            )
            if row.owner_id is not None
            else None
        ),
        submitted_at=row.submitted_at,
        reviewed_at=row.reviewed_at,
        reviewed_by=row.reviewed_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
        viewer_side=viewer_side,
        can_edit=is_mentor or (is_owner and viewer_role != "viewer"),
    )


async def _decorate(
    db: AsyncSession,
    rows: list[MentorDeliverable],
    mentorship: Mentorship,
    user: User,
) -> list[DeliverableRead]:
    """Bulk-load owner names and criterion titles, then build the reads."""
    owner_ids = {r.owner_id for r in rows if r.owner_id is not None}
    names: dict[uuid.UUID, str] = {}
    if owner_ids:
        for uid, display in (
            await db.execute(select(User.id, User.display_name).where(User.id.in_(owner_ids)))
        ).all():
            names[uid] = display

    criterion_ids = {r.linked_criterion for r in rows if r.linked_criterion is not None}
    titles: dict[uuid.UUID, str] = {}
    if criterion_ids:
        for cid, title in (
            await db.execute(
                select(ReadinessCriterion.id, ReadinessCriterion.title).where(
                    ReadinessCriterion.id.in_(criterion_ids)
                )
            )
        ).all():
            titles[cid] = title

    role = await _viewer(db, mentorship, user)
    side = "mentor" if role == "mentor" else "startup"
    return [
        _read(
            row,
            owner_name=names.get(row.owner_id) if row.owner_id else None,
            criterion_title=titles.get(row.linked_criterion)
            if row.linked_criterion
            else None,
            viewer_side=side,
            viewer_role=role,
            viewer_id=user.id,
        )
        for row in rows
    ]


async def _as_read(
    db: AsyncSession,
    row: MentorDeliverable,
    mentorship: Mentorship,
    user: User,
) -> DeliverableRead:
    return (await _decorate(db, [row], mentorship, user))[0]


# ------------------------------------------------------------------ create


async def create(
    db: AsyncSession,
    user: User,
    mentorship_id: uuid.UUID,
    payload: DeliverableCreate,
) -> DeliverableRead:
    """Mentor on the row only."""
    await _enforce_write_limit(user)
    mentorship = await _load_mentorship(db, mentorship_id)
    await _viewer(db, mentorship, user)
    await require_mentor(db, mentorship, user)

    _require_future_due(payload.due_on)
    if payload.linked_criterion is not None:
        await _criterion_or_422(db, payload.linked_criterion)
    if payload.owner_id is not None:
        await _owner_applies(db, mentorship.startup_org_id, payload.owner_id)

    open_count = (
        await db.execute(
            select(func.count())
            .select_from(MentorDeliverable)
            .where(
                MentorDeliverable.mentorship_id == mentorship.id,
                MentorDeliverable.deleted_at.is_(None),
                MentorDeliverable.status != DeliverableStatus.accepted,
            )
        )
    ).scalar_one()
    if open_count >= MAX_OPEN_PER_MENTORSHIP:
        raise validation_error(
            f"A mentorship cannot have more than {MAX_OPEN_PER_MENTORSHIP} open "
            "deliverables. Close or delete some first."
        )

    row = MentorDeliverable(
        mentorship_id=mentorship.id,
        title=payload.title,
        description=payload.description,
        linked_criterion=payload.linked_criterion,
        owner_id=payload.owner_id,
        due_on=payload.due_on,
        status=DeliverableStatus.not_started,
    )
    db.add(row)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.deliverable_created,
        summary=f"Deliverable '{row.title}' created.",
        org_id=mentorship.startup_org_id,
        actor_id=user.id,
        entity_type="deliverable",
        entity_id=row.id,
    )
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, mentorship, user)


# -------------------------------------------------------------------- read


def _list_query(
    mentorship_id: uuid.UUID, status_filter: Sequence[str] | None
) -> Select:
    q = select(MentorDeliverable).where(
        MentorDeliverable.mentorship_id == mentorship_id,
        MentorDeliverable.deleted_at.is_(None),
    )
    if status_filter:
        q = q.where(MentorDeliverable.status.in_(status_filter))
    return q


async def list_for_mentorship(
    db: AsyncSession,
    user: User,
    mentorship_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
    status_filter: Sequence[str] | None = None,
    overdue_only: bool = False,
) -> tuple[list[DeliverableRead], int]:
    """Any active member reads (viewer included)."""
    mentorship = await _load_mentorship(db, mentorship_id)
    await _viewer(db, mentorship, user)

    q = _list_query(mentorship.id, status_filter)
    if overdue_only:
        q = q.where(
            MentorDeliverable.due_on.is_not(None),
            MentorDeliverable.due_on < date.today(),
            MentorDeliverable.status.not_in(
                [DeliverableStatus.accepted, DeliverableStatus.submitted]
            ),
        )
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = list(
        (
            await db.execute(
                q.order_by(
                    MentorDeliverable.due_on.is_(None),
                    MentorDeliverable.due_on,
                    MentorDeliverable.created_at.desc(),
                    MentorDeliverable.id,
                )
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return await _decorate(db, rows, mentorship, user), total


async def get_one(
    db: AsyncSession, user: User, deliverable_id: uuid.UUID
) -> DeliverableRead:
    row = await _load_deliverable(db, deliverable_id)
    mentorship = await _load_mentorship(db, row.mentorship_id)
    await _viewer(db, mentorship, user)
    return await _as_read(db, row, mentorship, user)


# ------------------------------------------------------------------ update


async def update(
    db: AsyncSession, user: User, deliverable_id: uuid.UUID, payload: DeliverableUpdate
) -> DeliverableRead:
    """Mentor edits anything; the assignee may only submit progress.

    The split is decided here rather than in two routers, because it needs
    the same two lookups either way.
    """
    await _enforce_write_limit(user)
    row = await _load_deliverable(db, deliverable_id)
    mentorship = await _load_mentorship(db, row.mentorship_id)
    role = await _viewer(db, mentorship, user)
    is_mentor = role == "mentor"
    is_owner = row.owner_id is not None and row.owner_id == user.id

    if not is_mentor and not is_owner:
        raise forbidden("Only the mentor or the assignee can change a deliverable.")
    if not is_mentor and role == "viewer":
        raise forbidden("Viewers cannot change a deliverable.")

    fields = payload.model_dump(exclude_unset=True)

    # Assignee-only edits are restricted to the progress half of the machine.
    if not is_mentor:
        disallowed = set(fields) - {"status", "evidence"}
        if disallowed:
            raise forbidden(
                "Only the mentor can change "
                + ", ".join(sorted(disallowed))
                + "."
            )

    if "due_on" in fields:
        _require_future_due(fields["due_on"])
    if "linked_criterion" in fields and fields["linked_criterion"] is not None:
        await _criterion_or_422(db, fields["linked_criterion"])
    if "owner_id" in fields and fields["owner_id"] is not None:
        await _owner_applies(db, mentorship.startup_org_id, fields["owner_id"])

    if "status" in fields and fields["status"] is not None:
        await _apply_status(db, row, DeliverableStatus(fields.pop("status")), is_mentor, user)

    for key, value in fields.items():
        setattr(row, key, value)

    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, mentorship, user)


async def _apply_status(
    db: AsyncSession,
    row: MentorDeliverable,
    target: DeliverableStatus,
    is_mentor: bool,
    actor: User,
) -> None:
    """Enforce the two-sided state machine and stamp the timestamps."""
    current = DeliverableStatus(row.status)

    if target in REVIEW_STATUSES:
        if not is_mentor:
            raise forbidden("Only the mentor can accept or request changes.")
        allowed = _REVIEW_TRANSITIONS.get(current, frozenset())
        if target not in allowed:
            raise validation_error(
                f"Cannot move a deliverable from '{current.value}' to '{target.value}'.",
                details=[
                    {
                        "loc": ["body", "status"],
                        "msg": "Only a submitted item can be reviewed.",
                        "type": "value_error",
                    }
                ],
            )
        row.status = target
        row.reviewed_at = datetime.now(UTC)
        # Always the authenticated actor, never the body.
        row.reviewed_by = actor.id
        return

    if target in ASSIGNEE_STATUSES or target == DeliverableStatus.not_started:
        allowed = _ASSIGNEE_TRANSITIONS.get(current, frozenset())
        if target not in allowed:
            raise validation_error(
                f"Cannot move a deliverable from '{current.value}' to '{target.value}'.",
                details=[
                    {
                        "loc": ["body", "status"],
                        "msg": "That status change is not allowed yet.",
                        "type": "value_error",
                    }
                ],
            )
        row.status = target
        if target == DeliverableStatus.submitted:
            row.submitted_at = datetime.now(UTC)
        return

    raise validation_error(
        "That status cannot be set directly.",
        details=[
            {
                "loc": ["body", "status"],
                "msg": "overdue is derived from the due date.",
                "type": "value_error",
            }
        ],
    )


# ------------------------------------------------------------------ delete


async def remove(db: AsyncSession, user: User, deliverable_id: uuid.UUID) -> None:
    """Soft delete, mentor on the row only."""
    await _enforce_write_limit(user)
    row = await _load_deliverable(db, deliverable_id)
    mentorship = await _load_mentorship(db, row.mentorship_id)
    await _viewer(db, mentorship, user)
    await require_mentor(db, mentorship, user)

    row.deleted_at = datetime.now(UTC)
    activity_service.record(
        db,
        event_type=ActivityEventType.deliverable_deleted,
        summary=f"Deliverable '{row.title}' deleted.",
        org_id=mentorship.startup_org_id,
        actor_id=user.id,
        entity_type="deliverable",
        entity_id=row.id,
    )
    await db.commit()


__all__ = [
    "create",
    "get_one",
    "list_for_mentorship",
    "remove",
    "require_mentor",
    "update",
]
