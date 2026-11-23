"""Step 9e service: investor pipeline (deals + stage history).

Authorization follows the 9d precedent, one check per operation:

- **Investor side** (``/investors/deals``): resolve the caller's active
  ``investor_firm`` org first (``_investor_org_or_404``). Reads: any
  active member. Writes: owner/admin/member (viewer 403). Rows are
  org-scoped — another firm's deal is a 404 (no existence oracle).
- **Startup side** (``/organizations/{org_id}/investor-deals``): the
  org in the path is the caller's STARTUP (``startup_org_or_404`` +
  membership). The startup sees only deals where it is the target, and
  the response STRIPS the investor's private fields (fit_note,
  probability, passed_reason, owner_id). The startup may update the
  shared ``stage`` (stage-only), which is logged to the history with
  the startup user as the actor.

Stage changes write ``investor_deal_stage_history`` in the SAME
transaction as the change (the 5i pattern), so the log never misses a
move. ``last_activity_at`` is stamped on create and every update.

Money: ``NUMERIC(14,2)`` -> ``Decimal``; ``probability`` is the
``score_100`` domain (0-100 int).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.funding_round import FundingRound
from app.models.investor_deal import (
    InvestorDeal,
    InvestorDealStageHistory,
    PipelineStage,
)
from app.models.investor_search import ShortlistEntry
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.startup import StartupProfile
from app.models.user import User
from app.schemas.investor_deal import (
    InvestorDealCreate,
    InvestorDealRead,
    InvestorDealUpdate,
    StartupInvestorDealRead,
)
from app.services import activity_service, organization_service, rate_limiter

# Org roles allowed to write investor-side data. Viewers are read-only.
WRITE_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}


async def _enforce_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"investor_deal_write:user:{user.id}",
        settings.INVESTOR_DEAL_WRITE_LIMIT,
        settings.INVESTOR_DEAL_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many deal changes. Please slow down.")


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


async def _deal_or_404(
    db: AsyncSession, deal_id: uuid.UUID, investor_org_id: uuid.UUID
) -> InvestorDeal:
    """A live deal of THIS investor firm, or 404 (no oracle)."""
    result = await db.execute(
        select(InvestorDeal).where(
            InvestorDeal.id == deal_id,
            InvestorDeal.investor_org_id == investor_org_id,
            InvestorDeal.deleted_at.is_(None),
        )
    )
    deal = result.scalar_one_or_none()
    if deal is None:
        raise not_found("Deal not found.")
    return deal


async def _validate_startup_target(
    db: AsyncSession, startup_org_id: uuid.UUID
) -> Organization:
    """The target must be a live, active startup (404 otherwise)."""
    return await organization_service.startup_org_or_404(db, startup_org_id)


async def _validate_round(
    db: AsyncSession, round_id: uuid.UUID | None, startup_org_id: uuid.UUID
) -> None:
    """A round_id, if given, must belong to the target startup."""
    if round_id is None:
        return
    from app.models.funding_round import FundingRound

    result = await db.execute(
        select(FundingRound.id).where(
            FundingRound.id == round_id,
            FundingRound.org_id == startup_org_id,
            FundingRound.deleted_at.is_(None),
        )
    )
    if result.first() is None:
        raise validation_error(
            "round_id must belong to the target startup.",
            details=[{"loc": ["body", "round_id"], "msg": "Invalid round.", "type": "value_error"}],
        )


async def _validate_owner(
    db: AsyncSession, investor_org_id: uuid.UUID, owner_id: uuid.UUID | None
) -> None:
    """The owner must be an active member of the investor firm."""
    if owner_id is None:
        return
    await organization_service.require_active_member_ref(
        db,
        investor_org_id,
        owner_id,
        field="owner_id",
        label="Owner",
    )


async def _write_stage_history(
    db: AsyncSession,
    deal: InvestorDeal,
    *,
    from_stage: PipelineStage | None,
    to_stage: PipelineStage,
    actor: User,
    note: str | None,
) -> None:
    # ``changed_at`` is stamped explicitly (microsecond precision) so the
    # history order is deterministic even when two moves land in the
    # same second — a UUID primary key is not an insertion-order tiebreak.
    db.add(
        InvestorDealStageHistory(
            deal_id=deal.id,
            from_stage=from_stage,
            to_stage=to_stage,
            changed_by=actor.id,
            changed_at=datetime.now(UTC),
            note=note,
        )
    )


def _as_read(
    deal: InvestorDeal,
    startup: Organization,
    profile: StartupProfile | None = None,
    owner: User | None = None,
    round_: FundingRound | None = None,
) -> InvestorDealRead:
    return InvestorDealRead(
        id=deal.id,
        investor_org_id=deal.investor_org_id,
        startup_org_id=deal.startup_org_id,
        startup_name=startup.name,
        startup_slug=startup.slug,
        startup_logo_initials=startup.logo_initials,
        startup_logo_url=startup.logo_url,
        startup_sector=profile.sector if profile else None,
        startup_tagline=profile.tagline if profile else None,
        startup_readiness_score=profile.readiness_score if profile else None,
        round_id=deal.round_id,
        round_target=round_.target_amount if round_ else None,
        round_currency=round_.currency if round_ else None,
        stage=deal.stage,
        probability=deal.probability,
        ticket_size=deal.ticket_size,
        currency=deal.currency,
        owner_id=deal.owner_id,
        owner_name=owner.display_name if owner else None,
        fit_note=deal.fit_note,
        next_step=deal.next_step,
        next_step_on=deal.next_step_on,
        last_activity_at=deal.last_activity_at,
        passed_reason=deal.passed_reason,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


def _as_startup_read(deal: InvestorDeal, investor: Organization) -> StartupInvestorDealRead:
    """Startup-side view: strip the investor's private fields."""
    return StartupInvestorDealRead(
        id=deal.id,
        investor_org_id=deal.investor_org_id,
        investor_name=investor.name,
        investor_slug=investor.slug,
        stage=deal.stage,
        round_id=deal.round_id,
        ticket_size=deal.ticket_size,
        currency=deal.currency,
        next_step=deal.next_step,
        next_step_on=deal.next_step_on,
        last_activity_at=deal.last_activity_at,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


# --- investor side ---------------------------------------------------------


async def list_deals(
    db: AsyncSession,
    user: User,
    *,
    stage: PipelineStage | None,
    q: str | None,
    limit: int,
    offset: int,
) -> tuple[list[InvestorDealRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)

    # Join the target startup, its profile, the deal owner and the round
    # so each board card carries its public snapshot in one query (no N+1).
    stmt = (
        select(InvestorDeal, Organization, StartupProfile, User, FundingRound)
        .join(Organization, Organization.id == InvestorDeal.startup_org_id)
        .outerjoin(StartupProfile, StartupProfile.org_id == Organization.id)
        .outerjoin(User, User.id == InvestorDeal.owner_id)
        .outerjoin(FundingRound, FundingRound.id == InvestorDeal.round_id)
        .where(
            InvestorDeal.investor_org_id == org.id,
            InvestorDeal.deleted_at.is_(None),
        )
    )
    if stage is not None:
        stmt = stmt.where(InvestorDeal.stage == stage)
    if q:
        pattern = f"%{q.strip().lower()}%"
        from sqlalchemy import or_

        stmt = stmt.where(
            or_(
                func.lower(Organization.name).like(pattern),
                func.lower(InvestorDeal.next_step).like(pattern),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(InvestorDeal.updated_at.desc(), InvestorDeal.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [
        _as_read(deal, startup, profile, owner, round_)
        for deal, startup, profile, owner, round_ in rows
    ], int(total)


async def summary(db: AsyncSession, user: User):
    """Deal counts per stage for the investor's board (one query)."""
    from app.schemas.investor_deal import InvestorDealSummary

    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)

    rows = (
        await db.execute(
            select(InvestorDeal.stage, func.count(InvestorDeal.id)).where(
                InvestorDeal.investor_org_id == org.id,
                InvestorDeal.deleted_at.is_(None),
            ).group_by(InvestorDeal.stage)
        )
    ).all()
    counts: dict[str, int] = {}
    total = 0
    for stage, count in rows:
        counts[stage.value] = int(count)
        total += int(count)
    return InvestorDealSummary(counts=counts, total=total)


async def create_deal(
    db: AsyncSession, user: User, payload: InvestorDealCreate
) -> InvestorDealRead:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    startup = await _validate_startup_target(db, payload.startup_org_id)
    if startup.id == org.id:
        raise validation_error(
            "An investor cannot deal with itself.",
            details=[{"loc": ["body", "startup_org_id"], "msg": "Invalid startup.", "type": "value_error"}],
        )
    await _validate_round(db, payload.round_id, startup.id)
    await _validate_owner(db, org.id, payload.owner_id)

    # Unique pair (investor, startup) on live rows.
    existing = (
        await db.execute(
            select(InvestorDeal.id).where(
                InvestorDeal.investor_org_id == org.id,
                InvestorDeal.startup_org_id == startup.id,
                InvestorDeal.deleted_at.is_(None),
            )
        )
    ).first()
    if existing is not None:
        raise conflict("A deal already exists for this startup.")

    now = datetime.now(UTC)
    deal = InvestorDeal(
        investor_org_id=org.id,
        startup_org_id=startup.id,
        round_id=payload.round_id,
        stage=payload.stage,
        probability=payload.probability,
        ticket_size=payload.ticket_size,
        currency=payload.currency,
        owner_id=payload.owner_id,
        fit_note=payload.fit_note,
        next_step=payload.next_step,
        next_step_on=payload.next_step_on,
        passed_reason=payload.passed_reason,
        last_activity_at=now,
    )
    db.add(deal)
    await db.flush()
    shortlist_entry = (
        await db.execute(
            select(ShortlistEntry).where(
                ShortlistEntry.investor_org_id == org.id,
                ShortlistEntry.startup_org_id == startup.id,
                ShortlistEntry.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if shortlist_entry is not None:
        shortlist_entry.deleted_at = now
        activity_service.record(
            db,
            event_type=ActivityEventType.shortlist_removed,
            org_id=org.id,
            actor_id=user.id,
            entity_type="shortlist_entry",
            entity_id=shortlist_entry.id,
            summary=(
                f"{user.display_name or 'An investor'} moved "
                f"{startup.name} from the shortlist into the pipeline."
            ),
            data={"startup_org_id": str(startup.id), "reason": "moved_to_pipeline"},
        )
    # Baseline history row (from_stage NULL) so the log is complete.
    await _write_stage_history(
        db, deal, from_stage=None, to_stage=deal.stage, actor=user, note=None
    )
    activity_service.record(
        db,
        event_type=ActivityEventType.deal_created,
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_deal",
        entity_id=deal.id,
        summary=f"{user.display_name or 'An investor'} opened a deal with {startup.name}.",
    )
    await db.commit()
    await db.refresh(deal)
    snap_startup, profile, owner, round_ = await _snapshot(db, deal)
    return _as_read(deal, snap_startup, profile, owner, round_)


async def _snapshot(
    db: AsyncSession, deal: InvestorDeal
) -> tuple[Organization, StartupProfile | None, User | None, FundingRound | None]:
    """Load the startup, its profile, the owner and the round for a deal."""
    startup = await organization_service.org_or_404(db, deal.startup_org_id)
    profile_row = (
        await db.execute(
            select(StartupProfile).where(StartupProfile.org_id == startup.id)
        )
    ).scalar_one_or_none()
    owner = None
    if deal.owner_id is not None:
        owner = (
            await db.execute(select(User).where(User.id == deal.owner_id))
        ).scalar_one_or_none()
    round_ = None
    if deal.round_id is not None:
        round_ = (
            await db.execute(
                select(FundingRound).where(FundingRound.id == deal.round_id)
            )
        ).scalar_one_or_none()
    return startup, profile_row, owner, round_


async def get_deal(db: AsyncSession, user: User, deal_id: uuid.UUID) -> InvestorDealRead:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    deal = await _deal_or_404(db, deal_id, org.id)
    startup, profile, owner, round_ = await _snapshot(db, deal)
    return _as_read(deal, startup, profile, owner, round_)


async def update_deal(
    db: AsyncSession, user: User, deal_id: uuid.UUID, payload: InvestorDealUpdate
) -> InvestorDealRead:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    deal = await _deal_or_404(db, deal_id, org.id)

    # Validate referenced rows before writing.
    if payload.round_id is not None:
        await _validate_round(db, payload.round_id, deal.startup_org_id)
    if payload.owner_id is not None:
        await _validate_owner(db, org.id, payload.owner_id)

    new_stage = payload.stage
    if new_stage is not None and new_stage != deal.stage:
        await _write_stage_history(
            db, deal, from_stage=deal.stage, to_stage=new_stage, actor=user, note=None
        )
        deal.stage = new_stage

    for field in (
        "round_id",
        "probability",
        "ticket_size",
        "currency",
        "owner_id",
        "fit_note",
        "next_step",
        "next_step_on",
        "passed_reason",
    ):
        value = getattr(payload, field)
        if value is not None:
            setattr(deal, field, value)
    deal.last_activity_at = datetime.now(UTC)
    activity_service.record(
        db,
        event_type=ActivityEventType.deal_updated,
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_deal",
        entity_id=deal.id,
        summary=f"{user.display_name or 'An investor'} updated the deal.",
    )
    await db.commit()
    await db.refresh(deal)
    snap_startup, profile, owner, round_ = await _snapshot(db, deal)
    return _as_read(deal, snap_startup, profile, owner, round_)


async def delete_deal(db: AsyncSession, user: User, deal_id: uuid.UUID) -> None:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    deal = await _deal_or_404(db, deal_id, org.id)
    deal.deleted_at = datetime.now(UTC)
    activity_service.record(
        db,
        event_type=ActivityEventType.deal_deleted,
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_deal",
        entity_id=deal.id,
        summary=f"{user.display_name or 'An investor'} removed the deal.",
    )
    await db.commit()


async def deal_history(
    db: AsyncSession, user: User, deal_id: uuid.UUID, *, limit: int, offset: int
):
    from app.schemas.investor_deal import InvestorDealHistoryItem, InvestorDealHistoryPage

    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    deal = await _deal_or_404(db, deal_id, org.id)

    base = select(InvestorDealStageHistory).where(
        InvestorDealStageHistory.deal_id == deal.id
    )
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            base.order_by(
                InvestorDealStageHistory.changed_at.desc(),
                InvestorDealStageHistory.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    items = [
        InvestorDealHistoryItem(
            id=row.id,
            deal_id=row.deal_id,
            from_stage=row.from_stage,
            to_stage=row.to_stage,
            changed_by=row.changed_by,
            changed_at=row.changed_at,
            note=row.note,
        )
        for row in rows
    ]
    return InvestorDealHistoryPage(
        items=items, total=int(total), limit=limit, offset=offset
    )


# --- startup side ---------------------------------------------------------


async def _startup_deal_or_404(
    db: AsyncSession, startup_org_id: uuid.UUID, investor_org_id: uuid.UUID
) -> tuple[InvestorDeal, Organization]:
    """A live deal where THIS startup is the target, from THIS investor."""
    result = await db.execute(
        select(InvestorDeal, Organization)
        .join(Organization, Organization.id == InvestorDeal.investor_org_id)
        .where(
            InvestorDeal.startup_org_id == startup_org_id,
            InvestorDeal.investor_org_id == investor_org_id,
            InvestorDeal.deleted_at.is_(None),
        )
    )
    row = result.first()
    if row is None:
        raise not_found("Investor deal not found.")
    deal, investor = row
    return deal, investor


async def list_startup_deals(
    db: AsyncSession,
    user: User,
    startup_org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
) -> tuple[list[StartupInvestorDealRead], int]:
    org = await organization_service.startup_org_or_404(db, startup_org_id)
    await organization_service.require_membership(db, org.id, user)

    stmt = select(InvestorDeal, Organization).join(
        Organization, Organization.id == InvestorDeal.investor_org_id
    ).where(
        InvestorDeal.startup_org_id == org.id,
        InvestorDeal.deleted_at.is_(None),
    )
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(InvestorDeal.updated_at.desc(), InvestorDeal.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [_as_startup_read(deal, investor) for deal, investor in rows], int(total)


async def get_startup_deal(
    db: AsyncSession, user: User, startup_org_id: uuid.UUID, investor_org_id: uuid.UUID
) -> StartupInvestorDealRead:
    org = await organization_service.startup_org_or_404(db, startup_org_id)
    await organization_service.require_membership(db, org.id, user)
    deal, investor = await _startup_deal_or_404(db, org.id, investor_org_id)
    return _as_startup_read(deal, investor)


async def update_startup_deal_stage(
    db: AsyncSession,
    user: User,
    startup_org_id: uuid.UUID,
    investor_org_id: uuid.UUID,
    stage: PipelineStage,
) -> StartupInvestorDealRead:
    """The startup updates the shared deal stage (stage-only)."""
    await _enforce_write_limit(user)
    org = await organization_service.startup_org_or_404(db, startup_org_id)
    await organization_service.require_membership(db, org.id, user)
    deal, investor = await _startup_deal_or_404(db, org.id, investor_org_id)

    if stage != deal.stage:
        await _write_stage_history(
            db, deal, from_stage=deal.stage, to_stage=stage, actor=user, note=None
        )
        deal.stage = stage
    deal.last_activity_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(deal)
    return _as_startup_read(deal, investor)


__all__ = [
    "create_deal",
    "deal_history",
    "delete_deal",
    "get_deal",
    "get_startup_deal",
    "list_deals",
    "list_startup_deals",
    "summary",
    "update_deal",
    "update_startup_deal_stage",
]
