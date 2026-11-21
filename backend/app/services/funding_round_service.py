"""Step 9a service: funding rounds (startup).

Authorization in one place per operation, following the 5b/5e milestone
and 8a-8e precedent:

- **Create / edit / status / delete**: an active member with role
  owner/admin/member. A **viewer** is read-only everywhere in the
  product, so they get 403 (plan D13).
- **List / get / summary**: any active member, viewer included.
- Everyone else: a foreign ``org_id`` is caught by
  ``startup_org_or_404`` (404); a round id from another org is caught by
  the org-scoped lookup (404, never 403 — no existence oracle).

Money handling: ``NUMERIC(14,2)`` in the table, ``Decimal`` in the
service, decimal strings in the response. ``committed_amount`` is
**server-only in 9a** (starts at 0; only 9i/9j will write it).
``remaining_amount`` / ``progress_pct`` are derived here, never stored,
never writable.

Status changes only through ``ROUND_TRANSITIONS`` (plan D1); an invalid
transition raises 409 ``INVALID_STATE``. Every create/update/status/
delete writes an audit row in the same transaction (plan D11).
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    conflict,
    not_found,
    rate_limited,
    validation_error,
)
from app.models.activity import ActivityEventType
from app.models.funding_round import (
    ROUND_TRANSITIONS,
    FundingRound,
    FundingRoundType,
    InstrumentType,
    RoundStatus,
)
from app.models.organization import OrgRole
from app.models.user import User
from app.schemas.funding_round import (
    FundingRoundCreate,
    FundingRoundRead,
    FundingRoundSummary,
    FundingRoundUpdate,
)
from app.services import activity_service, organization_service, rate_limiter

# Org roles allowed to write a round. Viewers are read-only (5b/5e).
WRITE_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}

# Whitelisted sort keys for the list endpoint (router-validated values;
# the service translates them to SQL columns). ``created_at`` is newest
# first; ``name`` and ``closes_on`` ascend. ``FundingRound.id.desc()`` is
# always appended as a stable tiebreak.
_SORT_COLUMNS: dict[str, Any] = {
    "created_at": FundingRound.created_at,
    "closes_on": FundingRound.closes_on,
    "name": FundingRound.name,
}
_SORT_DESC = {"created_at"}

_HUNDRED = Decimal("100")


async def _enforce_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"funding_round_write:user:{user.id}",
        settings.FUNDING_ROUND_WRITE_LIMIT,
        settings.FUNDING_ROUND_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many funding round changes. Please slow down.")


def _as_read(row: FundingRound) -> FundingRoundRead:
    """Map a row to its API shape, computing the derived progress.

    ``progress_pct`` may exceed 100 for an oversubscribed round (plan D2);
    it is ``None`` when there is no target to divide by.
    """
    target = Decimal(row.target_amount) if row.target_amount is not None else None
    committed = Decimal(row.committed_amount or 0)
    remaining = (target - committed) if target is not None else None
    progress = None
    if target is not None and target > 0:
        progress = (committed / target) * _HUNDRED
    return FundingRoundRead(
        id=row.id,
        org_id=row.org_id,
        name=row.name,
        round_type=FundingRoundType(row.round_type),
        target_amount=row.target_amount,
        committed_amount=committed,
        currency=row.currency,
        pre_money_valuation=row.pre_money_valuation,
        instrument=InstrumentType(row.instrument) if row.instrument else None,
        status=RoundStatus(row.status),
        opens_on=row.opens_on,
        closes_on=row.closes_on,
        min_raise=row.min_raise,
        min_ticket=row.min_ticket,
        remaining_amount=remaining,
        progress_pct=progress,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _get_round(db: AsyncSession, org_id: uuid.UUID, round_id: uuid.UUID) -> FundingRound:
    """Org-scoped lookup: a foreign or deleted round is indistinguishable."""
    result = await db.execute(
        select(FundingRound).where(
            FundingRound.id == round_id,
            FundingRound.org_id == org_id,
            FundingRound.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Funding round not found.")
    return row


async def create(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: FundingRoundCreate
) -> FundingRoundRead:
    await _enforce_write_limit(user)
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=WRITE_ROLES
    )

    row = FundingRound(
        org_id=org.id,
        name=payload.name,
        round_type=payload.round_type,
        target_amount=payload.target_amount,
        # Server-only: 9a always starts at 0 (plan D2).
        committed_amount=Decimal("0"),
        currency=payload.currency,
        pre_money_valuation=payload.pre_money_valuation,
        instrument=payload.instrument,
        status=RoundStatus.draft,
        opens_on=payload.opens_on,
        closes_on=payload.closes_on,
        min_raise=payload.min_raise,
        min_ticket=payload.min_ticket,
    )
    db.add(row)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.round_created,
        org_id=org.id,
        actor_id=user.id,
        entity_type="funding_round",
        entity_id=row.id,
        link_url=f"/startup/rounds/{row.id}",
        summary=f"{user.display_name or 'A member'} created round “{row.name}”.",
        data={"round_type": row.round_type, "status": row.status},
    )
    await db.commit()
    await db.refresh(row)
    return _as_read(row)


async def list_rounds(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    status: RoundStatus | None,
    sort: str,
    limit: int,
    offset: int,
) -> tuple[Sequence[FundingRoundRead], int]:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    if sort not in _SORT_COLUMNS:
        raise validation_error("Unknown sort key.")

    where = [FundingRound.org_id == org.id, FundingRound.deleted_at.is_(None)]
    if status is not None:
        where.append(FundingRound.status == status.value)

    total = (
        await db.execute(
            select(func.count()).select_from(FundingRound).where(*where)
        )
    ).scalar_one()

    sort_col = _SORT_COLUMNS[sort]
    order_by = [
        sort_col.desc() if sort in _SORT_DESC else sort_col.asc(),
        FundingRound.id.desc(),
    ]
    rows = (
        await db.execute(
            select(FundingRound)
            .where(*where)
            .order_by(*order_by)
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    return [_as_read(row) for row in rows], total


async def get_round(db: AsyncSession, user: User, org_id: uuid.UUID, round_id: uuid.UUID) -> FundingRoundRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    return _as_read(await _get_round(db, org.id, round_id))


async def update_round(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    round_id: uuid.UUID,
    payload: FundingRoundUpdate,
) -> FundingRoundRead:
    await _enforce_write_limit(user)
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user, roles=WRITE_ROLES)

    row = await _get_round(db, org.id, round_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    # ``model_dump`` returns enum members (not raw strings), so the
    # setattr below stores valid enum values for round_type/instrument.
    for field, value in data.items():
        setattr(row, field, value)

    activity_service.record(
        db,
        event_type=ActivityEventType.round_updated,
        org_id=org.id,
        actor_id=user.id,
        entity_type="funding_round",
        entity_id=row.id,
        link_url=f"/startup/rounds/{row.id}",
        summary=f"{user.display_name or 'A member'} updated round “{row.name}”.",
        data={"fields": sorted(data.keys())},
    )
    await db.commit()
    await db.refresh(row)
    return _as_read(row)


async def transition_status(
    db: AsyncSession, user: User, org_id: uuid.UUID, round_id: uuid.UUID, status: RoundStatus
) -> FundingRoundRead:
    await _enforce_write_limit(user)
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user, roles=WRITE_ROLES)

    row = await _get_round(db, org.id, round_id)
    current = RoundStatus(row.status)
    allowed = ROUND_TRANSITIONS[current]
    if status not in allowed:
        raise conflict(
            f"Cannot move a round from '{current.value}' to '{status.value}'.",
            code="INVALID_STATE",
        )
    previous = row.status
    row.status = status
    activity_service.record(
        db,
        event_type=ActivityEventType.round_status_changed,
        org_id=org.id,
        actor_id=user.id,
        entity_type="funding_round",
        entity_id=row.id,
        link_url=f"/startup/rounds/{row.id}",
        summary=(
            f"{user.display_name or 'A member'} moved round “{row.name}”"
            f" from {previous} to {status.value}."
        ),
        data={"from": previous, "to": status.value},
    )
    await db.commit()
    await db.refresh(row)
    return _as_read(row)


async def delete_round(db: AsyncSession, user: User, org_id: uuid.UUID, round_id: uuid.UUID) -> None:
    await _enforce_write_limit(user)
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user, roles=WRITE_ROLES)

    row = await _get_round(db, org.id, round_id)
    activity_service.record(
        db,
        event_type=ActivityEventType.round_deleted,
        org_id=org.id,
        actor_id=user.id,
        entity_type="funding_round",
        entity_id=row.id,
        link_url=f"/startup/rounds/{row.id}",
        summary=f"{user.display_name or 'A member'} deleted round “{row.name}”.",
    )
    row.deleted_at = datetime.now(UTC)
    await db.commit()


async def summary(db: AsyncSession, user: User, org_id: uuid.UUID) -> FundingRoundSummary:
    """Org-level roll-up for the rounds header (one aggregate query)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    where = [FundingRound.org_id == org.id, FundingRound.deleted_at.is_(None)]

    total_target, total_committed = (
        await db.execute(
            select(
                func.coalesce(func.sum(FundingRound.target_amount), 0),
                func.coalesce(func.sum(FundingRound.committed_amount), 0),
            ).where(*where)
        )
    ).one()

    open_rounds, currency = (
        await db.execute(
            select(
                func.count(FundingRound.id).filter(
                    FundingRound.status.in_(
                        [RoundStatus.open.value, RoundStatus.paused.value]
                    )
                ),
                func.coalesce(func.min(FundingRound.currency), "INR"),
            ).select_from(FundingRound).where(*where)
        )
    ).one()

    status_rows = (
        await db.execute(
            select(FundingRound.status, func.count())
            .where(*where)
            .group_by(FundingRound.status)
        )
    ).all()

    # Coerce explicitly: SQLite has no DECIMAL, so an aggregate may
    # come back as float/int; Decimal(str(...)) keeps it a real decimal
    # either way (the 8h pattern).
    return FundingRoundSummary(
        total_target=Decimal(str(total_target)),
        total_committed=Decimal(str(total_committed)),
        currency=currency,
        open_rounds=open_rounds,
        by_status={status_value: count for status_value, count in status_rows},
    )


__all__ = [
    "WRITE_ROLES",
    "create",
    "delete_round",
    "get_round",
    "list_rounds",
    "summary",
    "transition_status",
    "update_round",
]
