"""Step 9i service: investor offers (versions + counters).

Authorization follows the 9e precedent, one check per operation:

- **Investor side** (``/investors/offers``): resolve the caller's active
  ``investor_firm`` org first (``_investor_org_or_404``). Reads: any
  active member. Writes: owner/admin/member (viewer 403). Rows are
  org-scoped — another firm's offer is a 404 (no existence oracle).
- **Startup side** (``/organizations/{org_id}/investor-offers``): the
  org in the path is the caller's STARTUP (``startup_org_or_404`` +
  membership). The startup sees only offers on its own rounds, always
  the LATEST version per investor, and the response STRIPS the
  investor's private fields (notes, owner_id). Accept/decline act on
  the latest version.

Versioning: a counter creates a NEW row (parent_offer_id = current
latest, version = parent.version + 1, status ``countered``) — the
parent is never mutated. Status transitions are validated against
``OFFER_TRANSITIONS``; terminal states are rejected with 409. Expiry is
lazy on read: a bulk ``UPDATE`` marks every sent/countered offer past
``expires_on`` as ``expired`` (with one audit row per offer) in the
same transaction as the read that noticed it — no scheduler.

Every mutation writes an ``activity_events`` row in the SAME
transaction (the 5i/9e pattern), so the audit log never misses a change.

Money: ``NUMERIC(14,2)`` -> ``Decimal``; ``discount_pct`` 0-100.
"""

import uuid
from datetime import date

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.funding_round import FundingRound
from app.models.investor_offer import (
    OFFER_TRANSITIONS,
    InvestorOffer,
    OfferStatus,
)
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.startup import StartupProfile
from app.models.user import User
from app.schemas.investor_offer import (
    InvestorOfferCounter,
    InvestorOfferCreate,
    InvestorOfferRead,
    InvestorOfferUpdate,
    StartupOfferRead,
)
from app.services import activity_service, organization_service, rate_limiter

# Org roles allowed to write investor-side data. Viewers are read-only.
WRITE_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}

_EXPIRABLE = (OfferStatus.sent, OfferStatus.countered)


async def _enforce_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"investor_offer_write:user:{user.id}",
        settings.OFFER_WRITE_LIMIT,
        settings.OFFER_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many offer changes. Please slow down.")


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


async def _offer_or_404(
    db: AsyncSession, offer_id: uuid.UUID, investor_org_id: uuid.UUID
) -> InvestorOffer:
    """A live offer of THIS investor firm, or 404 (no oracle)."""
    result = await db.execute(
        select(InvestorOffer).where(
            InvestorOffer.id == offer_id,
            InvestorOffer.investor_org_id == investor_org_id,
            InvestorOffer.deleted_at.is_(None),
        )
    )
    offer = result.scalar_one_or_none()
    if offer is None:
        raise not_found("Offer not found.")
    return offer


async def _validate_round(
    db: AsyncSession, round_id: uuid.UUID | None
) -> FundingRound | None:
    """A round_id, if given, must be a live round (its org is the offer's
    target startup)."""
    if round_id is None:
        return None
    result = await db.execute(
        select(FundingRound).where(
            FundingRound.id == round_id,
            FundingRound.deleted_at.is_(None),
        )
    )
    round_ = result.scalar_one_or_none()
    if round_ is None:
        raise validation_error(
            "round_id must reference a live funding round.",
            details=[{"loc": ["body", "round_id"], "msg": "Invalid round.", "type": "value_error"}],
        )
    return round_


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


def _check_transition(current: OfferStatus, target: OfferStatus) -> None:
    if target not in OFFER_TRANSITIONS.get(current, frozenset()):
        raise conflict(
            f"Cannot move an offer from {current.value} to {target.value}."
        )


async def _expire_due_for_investor(
    db: AsyncSession, investor_org_id: uuid.UUID
) -> None:
    """Lazy expiry (investor scope): mark every sent/countered offer of
    this firm past ``expires_on`` as ``expired``, one audit row each."""
    rows = (
        await db.execute(
            select(InvestorOffer).where(
                InvestorOffer.investor_org_id == investor_org_id,
                InvestorOffer.deleted_at.is_(None),
                InvestorOffer.status.in_(_EXPIRABLE),
                InvestorOffer.expires_on.is_not(None),
                InvestorOffer.expires_on < date.today(),
            )
        )
    ).scalars().all()
    if not rows:
        return
    for offer in rows:
        expires_on = offer.expires_on
        assert expires_on is not None
        activity_service.record(
            db,
            event_type=ActivityEventType.offer_expired,
            org_id=offer.investor_org_id,
            actor_id=None,
            entity_type="investor_offer",
            entity_id=offer.id,
            summary=f"Offer v{offer.version} expired on {expires_on.isoformat()}.",
        )
    await db.execute(
        update(InvestorOffer)
        .where(InvestorOffer.id.in_([r.id for r in rows]))
        .values(status=OfferStatus.expired)
    )
    await db.commit()


async def _expire_due_for_startup(
    db: AsyncSession, startup_org_id: uuid.UUID
) -> None:
    """Lazy expiry (startup scope): same, but only offers on this
    startup's rounds."""
    rows = (
        await db.execute(
            select(InvestorOffer)
            .join(FundingRound, FundingRound.id == InvestorOffer.round_id)
            .where(
                FundingRound.org_id == startup_org_id,
                FundingRound.deleted_at.is_(None),
                InvestorOffer.deleted_at.is_(None),
                InvestorOffer.status.in_(_EXPIRABLE),
                InvestorOffer.expires_on.is_not(None),
                InvestorOffer.expires_on < date.today(),
            )
        )
    ).scalars().all()
    if not rows:
        return
    for offer in rows:
        expires_on = offer.expires_on
        assert expires_on is not None
        activity_service.record(
            db,
            event_type=ActivityEventType.offer_expired,
            org_id=offer.investor_org_id,
            actor_id=None,
            entity_type="investor_offer",
            entity_id=offer.id,
            summary=f"Offer v{offer.version} expired on {expires_on.isoformat()}.",
        )
    await db.execute(
        update(InvestorOffer)
        .where(InvestorOffer.id.in_([r.id for r in rows]))
        .values(status=OfferStatus.expired)
    )
    await db.commit()


async def _round_org_id(db: AsyncSession, offer: InvestorOffer) -> uuid.UUID:
    """The org that owns the offer's round (the target startup)."""
    result = await db.execute(
        select(FundingRound.org_id).where(FundingRound.id == offer.round_id)
    )
    org_id = result.scalar_one_or_none()
    if org_id is None:
        raise not_found("Offer's round no longer exists.")
    return org_id


async def _snapshot(
    db: AsyncSession, offer: InvestorOffer
) -> tuple[Organization, StartupProfile | None, User | None, FundingRound | None]:
    """Load the target startup, its profile, the owner and the round."""
    startup = await organization_service.org_or_404(db, await _round_org_id(db, offer))
    profile_row = (
        await db.execute(
            select(StartupProfile).where(StartupProfile.org_id == startup.id)
        )
    ).scalar_one_or_none()
    owner = None
    if offer.owner_id is not None:
        owner = (
            await db.execute(select(User).where(User.id == offer.owner_id))
        ).scalar_one_or_none()
    round_ = await _validate_round(db, offer.round_id)
    return startup, profile_row, owner, round_


def _as_read(
    offer: InvestorOffer,
    startup: Organization,
    profile: StartupProfile | None,
    owner: User | None,
    round_: FundingRound | None,
) -> InvestorOfferRead:
    return InvestorOfferRead(
        id=offer.id,
        round_id=offer.round_id,
        investor_org_id=offer.investor_org_id,
        startup_org_id=startup.id,
        startup_name=startup.name,
        startup_slug=startup.slug,
        startup_logo_initials=startup.logo_initials,
        startup_logo_url=startup.logo_url,
        startup_sector=profile.sector if profile else None,
        startup_tagline=profile.tagline if profile else None,
        round_target=round_.target_amount if round_ else None,
        round_currency=round_.currency if round_ else None,
        amount=offer.amount,
        currency=offer.currency,
        instrument=offer.instrument,
        valuation_cap=offer.valuation_cap,
        discount_pct=offer.discount_pct,
        version=offer.version,
        parent_offer_id=offer.parent_offer_id,
        status=offer.status,
        expires_on=offer.expires_on,
        owner_id=offer.owner_id,
        owner_name=owner.display_name if owner else None,
        notes=offer.notes,
        created_at=offer.created_at,
        updated_at=offer.updated_at,
    )


def _as_startup_read(offer: InvestorOffer, investor: Organization) -> StartupOfferRead:
    """Startup-side view: strip the investor's private fields."""
    return StartupOfferRead(
        id=offer.id,
        investor_org_id=offer.investor_org_id,
        investor_name=investor.name,
        investor_slug=investor.slug,
        round_id=offer.round_id,
        amount=offer.amount,
        currency=offer.currency,
        instrument=offer.instrument,
        valuation_cap=offer.valuation_cap,
        discount_pct=offer.discount_pct,
        version=offer.version,
        status=offer.status,
        expires_on=offer.expires_on,
        created_at=offer.created_at,
        updated_at=offer.updated_at,
    )


# --- investor side ---------------------------------------------------------


async def list_offers(
    db: AsyncSession,
    user: User,
    *,
    status: OfferStatus | None,
    limit: int,
    offset: int,
) -> tuple[list[InvestorOfferRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    await _expire_due_for_investor(db, org.id)

    # Join the round, its org (the target startup), the profile and the
    # owner so each board card carries its snapshot in one query (no N+1).
    stmt = (
        select(InvestorOffer, Organization, StartupProfile, User, FundingRound)
        .join(FundingRound, FundingRound.id == InvestorOffer.round_id)
        .join(Organization, Organization.id == FundingRound.org_id)
        .outerjoin(StartupProfile, StartupProfile.org_id == Organization.id)
        .outerjoin(User, User.id == InvestorOffer.owner_id)
        .where(
            InvestorOffer.investor_org_id == org.id,
            InvestorOffer.deleted_at.is_(None),
        )
    )
    if status is not None:
        stmt = stmt.where(InvestorOffer.status == status)

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(InvestorOffer.updated_at.desc(), InvestorOffer.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [
        _as_read(offer, startup, profile, owner, round_)
        for offer, startup, profile, owner, round_ in rows
    ], int(total)


async def get_offer(db: AsyncSession, user: User, offer_id: uuid.UUID) -> InvestorOfferRead:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    await _expire_due_for_investor(db, org.id)
    offer = await _offer_or_404(db, offer_id, org.id)
    startup, profile, owner, round_ = await _snapshot(db, offer)
    return _as_read(offer, startup, profile, owner, round_)


async def create_offer(
    db: AsyncSession, user: User, payload: InvestorOfferCreate
) -> InvestorOfferRead:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    round_ = await _validate_round(db, payload.round_id)
    if round_ is None:
        raise validation_error("round_id is required.")
    await _validate_owner(db, org.id, payload.owner_id)

    offer = InvestorOffer(
        round_id=payload.round_id,
        investor_org_id=org.id,
        amount=payload.amount,
        currency=payload.currency,
        instrument=payload.instrument,
        valuation_cap=payload.valuation_cap,
        discount_pct=payload.discount_pct,
        version=1,
        status=OfferStatus.draft,
        expires_on=payload.expires_on,
        owner_id=payload.owner_id,
        notes=payload.notes,
    )
    db.add(offer)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.offer_created,
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_offer",
        entity_id=offer.id,
        summary=f"{user.display_name or 'An investor'} drafted offer v1 ({offer.amount} {offer.currency}).",
    )
    await db.commit()
    await db.refresh(offer)
    startup, profile, owner, round_ = await _snapshot(db, offer)
    return _as_read(offer, startup, profile, owner, round_)


async def update_offer(
    db: AsyncSession, user: User, offer_id: uuid.UUID, payload: InvestorOfferUpdate
) -> InvestorOfferRead:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _expire_due_for_investor(db, org.id)
    offer = await _offer_or_404(db, offer_id, org.id)

    if payload.owner_id is not None:
        await _validate_owner(db, org.id, payload.owner_id)

    for field in (
        "amount",
        "currency",
        "instrument",
        "valuation_cap",
        "discount_pct",
        "expires_on",
        "owner_id",
        "notes",
    ):
        value = getattr(payload, field)
        if value is not None:
            setattr(offer, field, value)

    activity_service.record(
        db,
        event_type=ActivityEventType.offer_updated,
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_offer",
        entity_id=offer.id,
        summary=f"{user.display_name or 'An investor'} updated offer v{offer.version}.",
    )
    await db.commit()
    await db.refresh(offer)
    startup, profile, owner, round_ = await _snapshot(db, offer)
    return _as_read(offer, startup, profile, owner, round_)


async def send_offer(db: AsyncSession, user: User, offer_id: uuid.UUID) -> InvestorOfferRead:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _expire_due_for_investor(db, org.id)
    offer = await _offer_or_404(db, offer_id, org.id)

    _check_transition(offer.status, OfferStatus.sent)
    offer.status = OfferStatus.sent
    activity_service.record(
        db,
        event_type=ActivityEventType.offer_sent,
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_offer",
        entity_id=offer.id,
        summary=f"{user.display_name or 'An investor'} sent offer v{offer.version}.",
    )
    await db.commit()
    await db.refresh(offer)
    startup, profile, owner, round_ = await _snapshot(db, offer)
    return _as_read(offer, startup, profile, owner, round_)


async def counter_offer(
    db: AsyncSession, user: User, offer_id: uuid.UUID, payload: InvestorOfferCounter
) -> InvestorOfferRead:
    """Issue the next version (parent untouched, new row ``countered``)."""
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _expire_due_for_investor(db, org.id)
    parent = await _offer_or_404(db, offer_id, org.id)

    if parent.status not in (OfferStatus.sent, OfferStatus.countered):
        raise conflict("Only a sent or countered offer can be countered.")
    await _validate_owner(db, org.id, payload.owner_id)

    offer = InvestorOffer(
        round_id=parent.round_id,
        investor_org_id=org.id,
        amount=payload.amount,
        currency=payload.currency,
        instrument=payload.instrument,
        valuation_cap=payload.valuation_cap,
        discount_pct=payload.discount_pct,
        version=parent.version + 1,
        parent_offer_id=parent.id,
        status=OfferStatus.countered,
        expires_on=payload.expires_on,
        owner_id=payload.owner_id,
        notes=payload.notes,
    )
    db.add(offer)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.offer_countered,
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_offer",
        entity_id=offer.id,
        summary=f"{user.display_name or 'An investor'} countered with offer v{offer.version}.",
    )
    await db.commit()
    await db.refresh(offer)
    startup, profile, owner, round_ = await _snapshot(db, offer)
    return _as_read(offer, startup, profile, owner, round_)


async def withdraw_offer(db: AsyncSession, user: User, offer_id: uuid.UUID) -> None:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _expire_due_for_investor(db, org.id)
    offer = await _offer_or_404(db, offer_id, org.id)

    _check_transition(offer.status, OfferStatus.withdrawn)
    offer.status = OfferStatus.withdrawn
    activity_service.record(
        db,
        event_type=ActivityEventType.offer_withdrawn,
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_offer",
        entity_id=offer.id,
        summary=f"{user.display_name or 'An investor'} withdrew offer v{offer.version}.",
    )
    await db.commit()


async def offer_history(
    db: AsyncSession, user: User, offer_id: uuid.UUID, *, limit: int, offset: int
):
    from app.schemas.investor_offer import OfferHistoryPage, OfferVersionItem

    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    await _expire_due_for_investor(db, org.id)
    offer = await _offer_or_404(db, offer_id, org.id)

    # The version family: every live row for this investor + round.
    base = select(InvestorOffer).where(
        InvestorOffer.investor_org_id == org.id,
        InvestorOffer.round_id == offer.round_id,
        InvestorOffer.deleted_at.is_(None),
    )
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            base.order_by(InvestorOffer.version.asc(), InvestorOffer.id.asc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    items = [
        OfferVersionItem(
            id=row.id,
            version=row.version,
            amount=row.amount,
            currency=row.currency,
            instrument=row.instrument,
            valuation_cap=row.valuation_cap,
            discount_pct=row.discount_pct,
            status=row.status,
            parent_offer_id=row.parent_offer_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]
    return OfferHistoryPage(items=items, total=int(total), limit=limit, offset=offset)


# --- startup side ----------------------------------------------------------


async def _latest_offer_or_404(
    db: AsyncSession, startup_org_id: uuid.UUID, investor_org_id: uuid.UUID, round_id: uuid.UUID
) -> InvestorOffer:
    """The LATEST live version of this investor's offer on this round."""
    result = await db.execute(
        select(InvestorOffer)
        .where(
            InvestorOffer.round_id == round_id,
            InvestorOffer.investor_org_id == investor_org_id,
            InvestorOffer.deleted_at.is_(None),
        )
        .order_by(InvestorOffer.version.desc(), InvestorOffer.id.desc())
    )
    offer = result.scalars().first()
    if offer is None:
        raise not_found("Offer not found.")
    return offer


async def _round_of_startup_or_404(
    db: AsyncSession, startup_org_id: uuid.UUID, round_id: uuid.UUID
) -> FundingRound:
    result = await db.execute(
        select(FundingRound).where(
            FundingRound.id == round_id,
            FundingRound.org_id == startup_org_id,
            FundingRound.deleted_at.is_(None),
        )
    )
    round_ = result.scalar_one_or_none()
    if round_ is None:
        raise not_found("Offer not found.")
    return round_


async def list_startup_offers(
    db: AsyncSession,
    user: User,
    startup_org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
) -> tuple[list[StartupOfferRead], int]:
    org = await organization_service.startup_org_or_404(db, startup_org_id)
    await organization_service.require_membership(db, org.id, user)
    await _expire_due_for_startup(db, org.id)

    # Latest version per investor per round, on this startup's rounds.
    latest_ids = (
        select(
            InvestorOffer.investor_org_id,
            InvestorOffer.round_id,
            func.max(InvestorOffer.version).label("max_version"),
        )
        .join(FundingRound, FundingRound.id == InvestorOffer.round_id)
        .where(
            FundingRound.org_id == org.id,
            FundingRound.deleted_at.is_(None),
            InvestorOffer.deleted_at.is_(None),
        )
        .group_by(InvestorOffer.investor_org_id, InvestorOffer.round_id)
        .subquery()
    )
    stmt = (
        select(InvestorOffer, Organization)
        .join(Organization, Organization.id == InvestorOffer.investor_org_id)
        .join(
            latest_ids,
            (latest_ids.c.investor_org_id == InvestorOffer.investor_org_id)
            & (latest_ids.c.round_id == InvestorOffer.round_id)
            & (latest_ids.c.max_version == InvestorOffer.version),
        )
    )
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(InvestorOffer.updated_at.desc(), InvestorOffer.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [_as_startup_read(offer, investor) for offer, investor in rows], int(total)


async def get_startup_offer(
    db: AsyncSession, user: User, startup_org_id: uuid.UUID, offer_id: uuid.UUID
) -> StartupOfferRead:
    org = await organization_service.startup_org_or_404(db, startup_org_id)
    await organization_service.require_membership(db, org.id, user)
    await _expire_due_for_startup(db, org.id)

    offer = (
        await db.execute(
            select(InvestorOffer).where(
                InvestorOffer.id == offer_id,
                InvestorOffer.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if offer is None:
        raise not_found("Offer not found.")
    round_ = await _round_of_startup_or_404(db, org.id, offer.round_id)
    latest = await _latest_offer_or_404(db, org.id, offer.investor_org_id, round_.id)
    if latest.id != offer.id:
        raise not_found("Offer not found.")
    investor = await organization_service.org_or_404(db, latest.investor_org_id)
    return _as_startup_read(latest, investor)


async def _startup_transition(
    db: AsyncSession,
    user: User,
    startup_org_id: uuid.UUID,
    offer_id: uuid.UUID,
    target: OfferStatus,
) -> StartupOfferRead:
    await _enforce_write_limit(user)
    org = await organization_service.startup_org_or_404(db, startup_org_id)
    await organization_service.require_membership(db, org.id, user)
    await _expire_due_for_startup(db, org.id)

    offer = (
        await db.execute(
            select(InvestorOffer).where(
                InvestorOffer.id == offer_id,
                InvestorOffer.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if offer is None:
        raise not_found("Offer not found.")
    round_ = await _round_of_startup_or_404(db, org.id, offer.round_id)
    latest = await _latest_offer_or_404(db, org.id, offer.investor_org_id, round_.id)
    if latest.id != offer.id:
        raise not_found("Offer not found.")

    _check_transition(latest.status, target)
    latest.status = target
    activity_service.record(
        db,
        event_type=(
            ActivityEventType.offer_accepted
            if target == OfferStatus.accepted
            else ActivityEventType.offer_declined
        ),
        org_id=org.id,
        actor_id=user.id,
        entity_type="investor_offer",
        entity_id=latest.id,
        summary=(
            f"{user.display_name or 'A startup'} "
            f"{'accepted' if target == OfferStatus.accepted else 'declined'} "
            f"offer v{latest.version}."
        ),
    )
    await db.commit()
    await db.refresh(latest)
    investor = await organization_service.org_or_404(db, latest.investor_org_id)
    return _as_startup_read(latest, investor)


async def accept_offer(
    db: AsyncSession, user: User, startup_org_id: uuid.UUID, offer_id: uuid.UUID
) -> StartupOfferRead:
    return await _startup_transition(
        db, user, startup_org_id, offer_id, OfferStatus.accepted
    )


async def decline_offer(
    db: AsyncSession, user: User, startup_org_id: uuid.UUID, offer_id: uuid.UUID
) -> StartupOfferRead:
    return await _startup_transition(
        db, user, startup_org_id, offer_id, OfferStatus.declined
    )


__all__ = [
    "accept_offer",
    "counter_offer",
    "create_offer",
    "decline_offer",
    "get_offer",
    "get_startup_offer",
    "list_offers",
    "list_startup_offers",
    "offer_history",
    "send_offer",
    "update_offer",
    "withdraw_offer",
]
