"""Funding-round permissions, lifecycle and transaction boundaries."""
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.funding_round import FundingRound, RoundStatus
from app.models.organization import OrgRole
from app.models.user import User
from app.schemas.funding_round import (
    FundingRoundCreate,
    FundingRoundPage,
    FundingRoundRead,
    FundingRoundUpdate,
    RoundProgress,
)
from app.services import activity_service, organization_service
from app.services.rate_limiter import rate_limiter

_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}
_TRANSITIONS = {
    "draft": {"open", "cancelled"},
    "open": {"paused", "closed", "cancelled"},
    "paused": {"open", "closed", "cancelled"},
    "closed": {"open"},
    "cancelled": set(),
}
_SORT = {"name": FundingRound.name, "created_at": FundingRound.created_at, "status": FundingRound.status}


async def _authorize(db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False) -> None:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user, roles=_ROLES)
    if write:
        settings = get_settings()
        if not await rate_limiter.check(f"funding-round:write:user:{user.id}", settings.FUNDING_ROUND_WRITE_LIMIT, settings.FUNDING_ROUND_WRITE_WINDOW_SECONDS):
            raise rate_limited()


async def _get(db: AsyncSession, org_id: uuid.UUID, round_id: uuid.UUID, *, lock: bool = False) -> FundingRound:
    stmt = select(FundingRound).where(FundingRound.org_id == org_id, FundingRound.id == round_id, FundingRound.deleted_at.is_(None))
    if lock:
        stmt = stmt.with_for_update()
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Funding round not found.")
    return row


def _validate_terms(data: dict[str, Any]) -> None:
    if data.get("opens_on") and data.get("closes_on") and data["opens_on"] > data["closes_on"]:
        raise validation_error("Opening date must not be after closing date.", details=[{"loc": ["body", "closes_on"], "msg": "Must be on or after the opening date.", "type": "value_error"}])
    if data.get("minimum_raise") is not None and data.get("target_amount") is not None and data["minimum_raise"] > data["target_amount"]:
        raise validation_error("Minimum raise must not exceed target amount.", details=[{"loc": ["body", "minimum_raise"], "msg": "Must not exceed the target amount.", "type": "value_error"}])


def _audit(db: AsyncSession, user: User, row: FundingRound, action: str, event: ActivityEventType) -> None:
    activity_service.record(db, event_type=event, summary=f"Funding round {action}.", org_id=row.org_id, actor_id=user.id, entity_type="funding_round", entity_id=row.id)


async def create(db: AsyncSession, user: User, org_id: uuid.UUID, payload: FundingRoundCreate) -> FundingRoundRead:
    await _authorize(db, user, org_id, write=True)
    data = payload.model_dump()
    _validate_terms(data)
    row = FundingRound(org_id=org_id, **data)
    db.add(row)
    await db.flush()
    _audit(db, user, row, "created", ActivityEventType.funding_round_created)
    await db.commit()
    await db.refresh(row)
    return FundingRoundRead.model_validate(row)


async def list_rounds(db: AsyncSession, user: User, org_id: uuid.UUID, *, limit: int, offset: int, status: RoundStatus | None, sort: str, order: str) -> FundingRoundPage:
    await _authorize(db, user, org_id)
    filters = [FundingRound.org_id == org_id, FundingRound.deleted_at.is_(None)]
    if status is not None:
        filters.append(FundingRound.status == status.value)
    total = (await db.execute(select(func.count()).select_from(FundingRound).where(*filters))).scalar_one()
    column = _SORT[sort]
    direction = column.desc() if order == "desc" else column.asc()
    rows = (await db.execute(select(FundingRound).where(*filters).order_by(direction, FundingRound.id).limit(limit).offset(offset))).scalars().all()
    return FundingRoundPage(items=[FundingRoundRead.model_validate(row) for row in rows], total=total, limit=limit, offset=offset)


async def get(db: AsyncSession, user: User, org_id: uuid.UUID, round_id: uuid.UUID) -> FundingRoundRead:
    await _authorize(db, user, org_id)
    return FundingRoundRead.model_validate(await _get(db, org_id, round_id))


async def progress(db: AsyncSession, user: User, org_id: uuid.UUID, round_id: uuid.UUID) -> RoundProgress:
    await _authorize(db, user, org_id)
    row = await _get(db, org_id, round_id)
    return RoundProgress(target_amount=row.target_amount, currency=row.currency)


async def update(db: AsyncSession, user: User, org_id: uuid.UUID, round_id: uuid.UUID, payload: FundingRoundUpdate) -> FundingRoundRead:
    await _authorize(db, user, org_id, write=True)
    row = await _get(db, org_id, round_id, lock=True)
    if row.status not in {"draft", "open", "paused"}:
        raise conflict("This round cannot be edited in its current status.")
    changes = payload.model_dump(exclude_unset=True)
    data = {key: getattr(row, key) for key in ("opens_on", "closes_on", "minimum_raise", "target_amount", "instrument")}
    data.update(changes)
    _validate_terms(data)
    if row.status in {"open", "paused"} and (data["target_amount"] is None or data["instrument"] is None):
        raise validation_error("An open or paused round requires a target and instrument.", details=[{"loc": ["body", k], "msg": "Required for an open or paused round.", "type": "value_error"} for k in ("target_amount", "instrument") if data[k] is None])
    for key, value in changes.items():
        setattr(row, key, value)
    _audit(db, user, row, "updated", ActivityEventType.funding_round_updated)
    await db.commit()
    await db.refresh(row)
    return FundingRoundRead.model_validate(row)


async def change_status(db: AsyncSession, user: User, org_id: uuid.UUID, round_id: uuid.UUID, status: RoundStatus) -> FundingRoundRead:
    await _authorize(db, user, org_id, write=True)
    row = await _get(db, org_id, round_id, lock=True)
    if status.value not in _TRANSITIONS[row.status]:
        raise conflict("Invalid funding round status transition.")
    if status == RoundStatus.open and (row.target_amount is None or row.instrument is None):
        raise conflict("A round needs a target and instrument before opening.")
    row.status = status.value
    _audit(db, user, row, "status changed", ActivityEventType.funding_round_status_changed)
    await db.commit()
    await db.refresh(row)
    return FundingRoundRead.model_validate(row)


async def delete(db: AsyncSession, user: User, org_id: uuid.UUID, round_id: uuid.UUID) -> None:
    await _authorize(db, user, org_id, write=True)
    row = await _get(db, org_id, round_id, lock=True)
    if row.status != "draft":
        raise conflict("Only draft rounds can be deleted.")
    row.deleted_at = datetime.now(UTC)
    _audit(db, user, row, "deleted", ActivityEventType.funding_round_deleted)
    await db.commit()
