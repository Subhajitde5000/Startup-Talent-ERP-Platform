"""Step 9k service: investor diligence checklists and items.

Authorization mirrors the 9e/9i/9j/9f precedent:

- **Investor side only** (``/investors/diligence``): the caller's
  active ``investor_firm`` org is resolved server-side
  (``_investor_org_or_404``). Reads: any active member. Writes:
  owner/admin/member (viewer 403). Rows are org-scoped — another
  firm's checklist or item is a **404**, never 403 (no existence
  oracle).

There is exactly one checklist per (investor firm, startup)
(partial unique index). Creating a checklist when one already exists
returns the existing one (idempotent — the frontend "open workspace"
action). Items belong to a checklist; deleting an item is a soft
delete (``deleted_at``).

Diligence data is **investor-private**: nothing here is exposed
through any startup-side route.

Every mutation writes an ``activity_events`` row in the SAME
transaction (the 5i/9e pattern).
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.diligence import (
    DiligenceItemSeverity,
    DiligenceItemStatus,
    DiligenceItemType,
    DiligenceOverallStatus,
    InvestorDiligenceChecklist,
    InvestorDiligenceItem,
)
from app.models.funding_round import FundingRound
from app.models.investor_deal import InvestorDeal
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.user import User
from app.schemas.diligence import (
    DiligenceChecklistRead,
    DiligenceItemRead,
)
from app.services import activity_service, organization_service, rate_limiter

WRITE_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}


async def _enforce_diligence_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"diligence_write:user:{user.id}",
        settings.DILIGENCE_WRITE_LIMIT,
        settings.DILIGENCE_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many diligence changes. Please slow down.")


async def _investor_org_or_404(db: AsyncSession, user: User) -> Organization:
    """The caller's active ``investor_firm`` organization, or 404."""
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
            Organization.type == OrgType.investor_firm,
            Organization.status == "active",
            Organization.deleted_at.is_(None),
        )
        .order_by(OrganizationMember.joined_at)
    )
    org = result.scalars().first()
    if org is None:
        raise not_found(
            "No investor organization found for this account.",
            code="INVESTOR_ORG_NOT_FOUND",
        )
    return org


async def _require_member(
    db: AsyncSession, org: Organization, user: User, *, write: bool
) -> None:
    if write:
        await organization_service.require_membership(
            db, org.id, user, roles=WRITE_ROLES
        )
    else:
        await organization_service.require_membership(db, org.id, user)


async def _validate_round_ref(
    db: AsyncSession, startup_org_id: uuid.UUID, round_id: uuid.UUID | None
) -> None:
    """A round_id, if given, must be a live round OF THIS STARTUP."""
    if round_id is None:
        return
    result = await db.execute(
        select(FundingRound.id).where(
            FundingRound.id == round_id,
            FundingRound.org_id == startup_org_id,
            FundingRound.deleted_at.is_(None),
        )
    )
    if result.first() is None:
        raise validation_error(
            "round_id must be a live funding round of this startup.",
            details=[
                {"loc": ["body", "round_id"], "msg": "Invalid round.", "type": "value_error"}
            ],
        )


async def _validate_deal_ref(
    db: AsyncSession, investor_org_id: uuid.UUID, deal_id: uuid.UUID | None
) -> None:
    """A deal_id, if given, must be a live deal of THIS firm."""
    if deal_id is None:
        return
    result = await db.execute(
        select(InvestorDeal.id).where(
            InvestorDeal.id == deal_id,
            InvestorDeal.investor_org_id == investor_org_id,
            InvestorDeal.deleted_at.is_(None),
        )
    )
    if result.first() is None:
        raise validation_error(
            "deal_id must be a live deal of this firm.",
            details=[
                {"loc": ["body", "deal_id"], "msg": "Invalid deal.", "type": "value_error"}
            ],
        )


def _as_checklist_read(
    checklist: InvestorDiligenceChecklist,
) -> DiligenceChecklistRead:
    return DiligenceChecklistRead(
        id=checklist.id,
        investor_org_id=checklist.investor_org_id,
        startup_org_id=checklist.startup_org_id,
        round_id=checklist.round_id,
        deal_id=checklist.deal_id,
        overall_status=checklist.overall_status.value,
        notes=checklist.notes,
        scorecard=checklist.scorecard,
        owner_id=checklist.owner_id,
        created_by=checklist.created_by,
        created_at=checklist.created_at,
        updated_at=checklist.updated_at,
    )


def _as_item_read(item: InvestorDiligenceItem) -> DiligenceItemRead:
    return DiligenceItemRead(
        id=item.id,
        checklist_id=item.checklist_id,
        investor_org_id=item.investor_org_id,
        startup_org_id=item.startup_org_id,
        item_type=item.item_type.value,
        title=item.title,
        severity=item.severity.value if item.severity else None,
        status=item.status.value,
        due_on=item.due_on,
        response=item.response,
        owner_id=item.owner_id,
        created_by=item.created_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _checklist_or_404(
    db: AsyncSession, investor_org_id: uuid.UUID, checklist_id: uuid.UUID
) -> InvestorDiligenceChecklist:
    result = await db.execute(
        select(InvestorDiligenceChecklist).where(
            InvestorDiligenceChecklist.id == checklist_id,
            InvestorDiligenceChecklist.investor_org_id == investor_org_id,
            InvestorDiligenceChecklist.deleted_at.is_(None),
        )
    )
    checklist = result.scalar_one_or_none()
    if checklist is None:
        raise not_found("Diligence checklist not found.")
    return checklist


async def _item_or_404(
    db: AsyncSession,
    investor_org_id: uuid.UUID,
    checklist_id: uuid.UUID,
    item_id: uuid.UUID,
) -> InvestorDiligenceItem:
    result = await db.execute(
        select(InvestorDiligenceItem).where(
            InvestorDiligenceItem.id == item_id,
            InvestorDiligenceItem.checklist_id == checklist_id,
            InvestorDiligenceItem.investor_org_id == investor_org_id,
            InvestorDiligenceItem.deleted_at.is_(None),
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise not_found("Diligence item not found.")
    return item


# ---------------------------------------------------------------------------
# Checklists
# ---------------------------------------------------------------------------
async def list_checklists(
    db: AsyncSession,
    user: User,
    *,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[DiligenceChecklistRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    total = (
        await db.execute(
            select(func.count())
            .select_from(InvestorDiligenceChecklist)
            .where(
                InvestorDiligenceChecklist.investor_org_id == org.id,
                InvestorDiligenceChecklist.deleted_at.is_(None),
            )
        )
    ).scalar_one()
    result = await db.execute(
        select(InvestorDiligenceChecklist)
        .where(
            InvestorDiligenceChecklist.investor_org_id == org.id,
            InvestorDiligenceChecklist.deleted_at.is_(None),
        )
        .order_by(InvestorDiligenceChecklist.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_as_checklist_read(c) for c in result.scalars().all()], total


async def get_checklist(
    db: AsyncSession, user: User, checklist_id: uuid.UUID
) -> DiligenceChecklistRead:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    checklist = await _checklist_or_404(db, org.id, checklist_id)
    return _as_checklist_read(checklist)


async def create_checklist(
    db: AsyncSession,
    user: User,
    *,
    startup_org_id: uuid.UUID,
    round_id: uuid.UUID | None = None,
    deal_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> DiligenceChecklistRead:
    await _enforce_diligence_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _validate_round_ref(db, startup_org_id, round_id)
    await _validate_deal_ref(db, org.id, deal_id)
    startup = await organization_service.startup_org_or_404(db, startup_org_id)
    if startup.id == org.id:
        raise validation_error("An investor firm cannot diligence itself.")

    # Idempotent: return the existing checklist if one is open.
    existing = (
        await db.execute(
            select(InvestorDiligenceChecklist).where(
                InvestorDiligenceChecklist.investor_org_id == org.id,
                InvestorDiligenceChecklist.startup_org_id == startup.id,
                InvestorDiligenceChecklist.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return _as_checklist_read(existing)

    checklist = InvestorDiligenceChecklist(
        investor_org_id=org.id,
        startup_org_id=startup.id,
        round_id=round_id,
        deal_id=deal_id,
        overall_status=DiligenceOverallStatus.not_started,
        notes=notes,
        owner_id=user.id,
        created_by=user.id,
    )
    db.add(checklist)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.diligence_checklist_created,
        summary=f"Diligence checklist opened for {startup.name}",
        org_id=org.id,
        actor_id=user.id,
        entity_type="diligence_checklist",
        entity_id=checklist.id,
        data={"startup_org_id": str(startup.id)},
    )
    await db.commit()
    await db.refresh(checklist)
    return _as_checklist_read(checklist)


async def update_checklist(
    db: AsyncSession,
    user: User,
    checklist_id: uuid.UUID,
    *,
    overall_status: str | None = None,
    notes: str | None = None,
    scorecard: dict | None = None,
) -> DiligenceChecklistRead:
    await _enforce_diligence_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    checklist = await _checklist_or_404(db, org.id, checklist_id)

    changed = False
    if overall_status is not None:
        checklist.overall_status = DiligenceOverallStatus(overall_status)
        changed = True
    if notes is not None:
        checklist.notes = notes
        changed = True
    if scorecard is not None:
        checklist.scorecard = scorecard
        changed = True
    if changed:
        activity_service.record(
            db,
            event_type=ActivityEventType.diligence_checklist_updated,
            summary="Diligence checklist updated",
            org_id=org.id,
            actor_id=user.id,
            entity_type="diligence_checklist",
            entity_id=checklist.id,
            data={
                "overall_status": checklist.overall_status.value,
                "fields": sorted(
                    [f for f, v in (("overall_status", overall_status), ("notes", notes), ("scorecard", scorecard)) if v is not None]
                ),
            },
        )
        await db.commit()
        await db.refresh(checklist)
    return _as_checklist_read(checklist)


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
async def list_items(
    db: AsyncSession,
    user: User,
    checklist_id: uuid.UUID,
    *,
    item_type: DiligenceItemType | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[DiligenceItemRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    await _checklist_or_404(db, org.id, checklist_id)
    filters = [
        InvestorDiligenceItem.checklist_id == checklist_id,
        InvestorDiligenceItem.investor_org_id == org.id,
        InvestorDiligenceItem.deleted_at.is_(None),
    ]
    if item_type is not None:
        filters.append(InvestorDiligenceItem.item_type == item_type)
    total = (
        await db.execute(
            select(func.count())
            .select_from(InvestorDiligenceItem)
            .where(*filters)
        )
    ).scalar_one()
    result = await db.execute(
        select(InvestorDiligenceItem)
        .where(*filters)
        .order_by(InvestorDiligenceItem.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_as_item_read(i) for i in result.scalars().all()], total


async def create_item(
    db: AsyncSession,
    user: User,
    checklist_id: uuid.UUID,
    *,
    item_type: str,
    title: str,
    severity: str | None = None,
    status: str | None = None,
    due_on=None,
    response: str | None = None,
) -> DiligenceItemRead:
    await _enforce_diligence_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    checklist = await _checklist_or_404(db, org.id, checklist_id)

    item = InvestorDiligenceItem(
        checklist_id=checklist.id,
        investor_org_id=org.id,
        startup_org_id=checklist.startup_org_id,
        item_type=DiligenceItemType(item_type),
        title=title,
        severity=DiligenceItemSeverity(severity) if severity else None,
        status=DiligenceItemStatus(status or DiligenceItemStatus.not_started.value),
        due_on=due_on,
        response=response,
        owner_id=user.id,
        created_by=user.id,
    )
    db.add(item)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.diligence_item_created,
        summary=f"Diligence item added: {item.title}",
        org_id=org.id,
        actor_id=user.id,
        entity_type="diligence_item",
        entity_id=item.id,
        data={"checklist_id": str(checklist.id), "item_type": item.item_type.value},
    )
    await db.commit()
    await db.refresh(item)
    return _as_item_read(item)


async def update_item(
    db: AsyncSession,
    user: User,
    checklist_id: uuid.UUID,
    item_id: uuid.UUID,
    *,
    title: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    due_on=None,
    response: str | None = None,
) -> DiligenceItemRead:
    await _enforce_diligence_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    item = await _item_or_404(db, org.id, checklist_id, item_id)

    changed = False
    if title is not None:
        item.title = title
        changed = True
    if severity is not None:
        item.severity = DiligenceItemSeverity(severity) if severity else None
        changed = True
    if status is not None:
        item.status = DiligenceItemStatus(status)
        changed = True
    if due_on is not None:
        item.due_on = due_on
        changed = True
    if response is not None:
        item.response = response
        changed = True
    if changed:
        activity_service.record(
            db,
            event_type=ActivityEventType.diligence_item_updated,
            summary=f"Diligence item updated: {item.title}",
            org_id=org.id,
            actor_id=user.id,
            entity_type="diligence_item",
            entity_id=item.id,
        )
        await db.commit()
        await db.refresh(item)
    return _as_item_read(item)


async def delete_item(
    db: AsyncSession, user: User, checklist_id: uuid.UUID, item_id: uuid.UUID
) -> None:
    await _enforce_diligence_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    item = await _item_or_404(db, org.id, checklist_id, item_id)
    item.deleted_at = func.now()
    activity_service.record(
        db,
        event_type=ActivityEventType.diligence_item_deleted,
        summary=f"Diligence item deleted: {item.title}",
        org_id=org.id,
        actor_id=user.id,
        entity_type="diligence_item",
        entity_id=item.id,
    )
    await db.commit()


__all__ = [
    "create_checklist",
    "create_item",
    "delete_item",
    "get_checklist",
    "list_checklists",
    "list_items",
    "update_checklist",
    "update_item",
]
