"""Milestone service (Step 5b).

Object-level rules (BUILD_PLAN Step 5 security):
- Startup organizations only; wrong-type / suspended / deleted orgs
  404 via ``organization_service.startup_org_or_404`` (no oracle).
- Reads need an ACTIVE membership of any role (viewers read); writes
  additionally require owner/admin/member (viewers 403).
- Every milestone lookup is scoped by ``org_id``: an id belonging to
  another organization is 404, never 403 (no existence oracle).
- ``owner_id`` must be an ACTIVE member of the SAME organization —
  otherwise a 422 on ``body.owner_id`` (plan: cross-org references
  rejected with a field-level error the frontend can map).
- Server-controlled fields (id, org_id, created_at, updated_at,
  deleted_at) are absent from Create/Update (extra=forbid -> 422).
- Soft delete: DELETE sets ``deleted_at``; reads and lists skip it.
- Progress is MANUAL (plan D1): derived-from-tasks comes later, once
  tasks exist — deliberately not built here.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.core.exceptions import not_found
from app.models.milestone import Milestone, MilestoneStatus
from app.models.organization import OrgRole
from app.models.user import User
from app.schemas.milestone import (
    MilestoneCreate,
    MilestonePage,
    MilestoneRead,
    MilestoneUpdate,
)
from app.services import organization_service

# Viewer role is deliberately excluded from writes (plan permission table).
_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})

# Whitelisted sort keys -> columns (the router narrows with Literal too;
# the dict keeps the service safe if called from elsewhere).
_SORT_COLUMNS: dict[str, InstrumentedAttribute] = {
    "target_date": Milestone.target_date,
    "created_at": Milestone.created_at,
    "name": Milestone.name,
    "status": Milestone.status,
}


async def _require_active_member(
    db: AsyncSession, org_id, user_id  # noqa: ANN001
) -> None:
    """Cross-org/IDOR guard for owner references: 422 on body.owner_id.
    Delegates to the shared member-reference check (Step 5c)."""
    await organization_service.require_active_member_ref(
        db, org_id, user_id, field="owner_id", label="Owner"
    )


async def _get_milestone(
    db: AsyncSession, org_id, milestone_id  # noqa: ANN001
) -> Milestone:
    """Scoped to the path org and not soft-deleted; missing rows 404."""
    result = await db.execute(
        select(Milestone).where(
            Milestone.id == milestone_id,
            Milestone.org_id == org_id,
            Milestone.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Milestone not found.")
    return row


def _read(row: Milestone) -> MilestoneRead:
    return MilestoneRead.model_validate(row, from_attributes=True)


async def create_milestone(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    payload: MilestoneCreate,
) -> MilestoneRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    data = payload.model_dump(exclude_unset=True)
    # Plan D4: omitted owner -> the creator; explicit null stays null.
    owner_id = data.pop("owner_id", user.id)
    if owner_id is not None:
        await _require_active_member(db, org.id, owner_id)
    row = Milestone(org_id=org.id, **data, owner_id=owner_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _read(row)


async def list_milestones(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    *,
    limit: int,
    offset: int,
    sort: str,
    order: str,
    status: MilestoneStatus | None,
) -> MilestonePage:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    filters = [Milestone.org_id == org.id, Milestone.deleted_at.is_(None)]
    if status is not None:
        filters.append(Milestone.status == status)

    total = (
        await db.execute(select(func.count()).select_from(Milestone).where(*filters))
    ).scalar_one()

    column = _SORT_COLUMNS.get(sort, Milestone.target_date)
    direction = column.desc() if order == "desc" else column.asc()
    order_by: list[Any] = []
    if sort == "target_date":
        # Undated milestones sort last in both orders, on SQLite and
        # PostgreSQL alike (NULL ordering differs between the two).
        undated = case((Milestone.target_date.is_(None), 1), else_=0)
        order_by.append(undated.asc())
    order_by.append(direction)
    # Stable tiebreak so offset pagination never repeats or skips rows.
    order_by.append(Milestone.id)

    result = await db.execute(
        select(Milestone)
        .where(*filters)
        .order_by(*order_by)
        .limit(limit)
        .offset(offset)
    )
    items = [_read(row) for row in result.scalars().all()]
    return MilestonePage(items=items, total=total, limit=limit, offset=offset)


async def get_milestone(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    milestone_id,  # noqa: ANN001
) -> MilestoneRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    row = await _get_milestone(db, org.id, milestone_id)
    return _read(row)


async def update_milestone(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    milestone_id,  # noqa: ANN001
    payload: MilestoneUpdate,
) -> MilestoneRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    row = await _get_milestone(db, org.id, milestone_id)
    data = payload.model_dump(exclude_unset=True)
    if "owner_id" in data and data["owner_id"] is not None:
        await _require_active_member(db, org.id, data["owner_id"])
    for field, value in data.items():
        setattr(row, field, value)
    await db.commit()
    # Same post-commit refresh reason as the profile service (onupdate
    # expires updated_at; never lazy-load outside a greenlet).
    await db.refresh(row)
    return _read(row)


async def delete_milestone(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    milestone_id,  # noqa: ANN001
) -> None:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    row = await _get_milestone(db, org.id, milestone_id)
    row.deleted_at = datetime.now(UTC)
    await db.commit()
