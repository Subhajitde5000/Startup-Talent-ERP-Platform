"""Step 9j service: commitments and portfolio holdings.

Authorization follows the 9e/9i precedent, one check per operation:

- **Investor side** (``/investors/commitments``, ``/investors/portfolio``):
  resolve the caller's active ``investor_firm`` org first
  (``_investor_org_or_404``). Reads: any active member. Writes:
  owner/admin/member (viewer 403). Rows are org-scoped — another firm's
  commitment or holding is a 404 (no existence oracle).

Status lifecycles (plan D1/D14 pattern): commitments
``pledged -> documented -> funded`` with ``cancelled`` reachable from
any non-terminal state; holdings ``active -> written_off`` /
``exited`` / ``partially_exited``. Transitions are validated against
``COMMITMENT_TRANSITIONS`` / ``HOLDING_TRANSITIONS``; terminal states are
rejected with 409. Status is never writable via PATCH.

``commitments`` has NO ``deleted_at`` (schema.sql): cancellation is a
status. Creating a commitment adds its amount to the round's
``committed_amount`` (the 9a plan D2 promise that 9i/9j write it);
cancelling subtracts it back, floored at zero.

Every mutation writes an ``activity_events`` row in the SAME
transaction (the 5i/9e pattern).

Money: ``NUMERIC(14,2)`` -> ``Decimal``; ``ownership_pct`` 0-100.
"""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.commitment import (
    COMMITMENT_TRANSITIONS,
    HOLDING_TRANSITIONS,
    Commitment,
    CommitmentStatus,
    PortfolioHolding,
)
from app.models.funding_round import FundingRound
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.startup import StartupProfile
from app.models.user import User
from app.schemas.commitment import (
    CommitmentCreate,
    CommitmentRead,
    CommitmentUpdate,
    HoldingCreate,
    HoldingRead,
    HoldingUpdate,
)
from app.services import activity_service, organization_service, rate_limiter

# Org roles allowed to write investor-side data. Viewers are read-only.
WRITE_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}


async def _enforce_commitment_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"commitment_write:user:{user.id}",
        settings.COMMITMENT_WRITE_LIMIT,
        settings.COMMITMENT_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many commitment changes. Please slow down.")


async def _enforce_portfolio_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"portfolio_write:user:{user.id}",
        settings.PORTFOLIO_WRITE_LIMIT,
        settings.PORTFOLIO_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many holding changes. Please slow down.")


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


async def _round_or_404(db: AsyncSession, round_id: uuid.UUID) -> FundingRound:
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


async def _validate_offer_ref(
    db: AsyncSession, investor_org_id: uuid.UUID, offer_id: uuid.UUID | None, round_id: uuid.UUID
) -> None:
    """An offer_id, if given, must be a live offer of THIS firm on THIS
    round."""
    if offer_id is None:
        return
    from app.models.investor_offer import InvestorOffer

    result = await db.execute(
        select(InvestorOffer.id).where(
            InvestorOffer.id == offer_id,
            InvestorOffer.investor_org_id == investor_org_id,
            InvestorOffer.round_id == round_id,
            InvestorOffer.deleted_at.is_(None),
        )
    )
    if result.first() is None:
        raise validation_error(
            "offer_id must be a live offer of this firm on the round.",
            details=[{"loc": ["body", "offer_id"], "msg": "Invalid offer.", "type": "value_error"}],
        )


def _check_commitment_transition(
    current: CommitmentStatus, target: CommitmentStatus
) -> None:
    if target not in COMMITMENT_TRANSITIONS.get(current, frozenset()):
        raise conflict(
            f"Cannot move a commitment from {current.value} to {target.value}."
        )


def _check_holding_transition(current: str, target: str) -> None:
    if target not in HOLDING_TRANSITIONS.get(current, frozenset()):
        raise conflict(
            f"Cannot move a holding from {current} to {target}."
        )


async def _startup_snapshot(
    db: AsyncSession, startup_org_id: uuid.UUID
) -> tuple[Organization, StartupProfile | None]:
    startup = await organization_service.org_or_404(db, startup_org_id)
    profile = (
        await db.execute(
            select(StartupProfile).where(StartupProfile.org_id == startup.id)
        )
    ).scalar_one_or_none()
    return startup, profile


def _as_commitment_read(
    commitment: Commitment,
    startup: Organization,
    profile: StartupProfile | None,
    round_: FundingRound | None,
) -> CommitmentRead:
    return CommitmentRead(
        id=commitment.id,
        round_id=commitment.round_id,
        offer_id=commitment.offer_id,
        investor_org_id=commitment.investor_org_id,
        startup_org_id=startup.id,
        startup_name=startup.name,
        startup_slug=startup.slug,
        startup_logo_initials=startup.logo_initials,
        startup_logo_url=startup.logo_url,
        startup_sector=profile.sector if profile else None,
        startup_tagline=profile.tagline if profile else None,
        round_target=round_.target_amount if round_ else None,
        round_currency=round_.currency if round_ else None,
        amount=commitment.amount,
        currency=commitment.currency,
        status=commitment.status,
        committed_on=commitment.committed_on,
        funded_on=commitment.funded_on,
        wired_at=commitment.wired_at,
        reference=commitment.reference,
        created_at=commitment.created_at,
        updated_at=commitment.updated_at,
    )


def _as_holding_read(
    holding: PortfolioHolding,
    startup: Organization,
    profile: StartupProfile | None,
) -> HoldingRead:
    return HoldingRead(
        id=holding.id,
        investor_org_id=holding.investor_org_id,
        startup_org_id=holding.startup_org_id,
        startup_name=startup.name,
        startup_slug=startup.slug,
        startup_logo_initials=startup.logo_initials,
        startup_logo_url=startup.logo_url,
        startup_sector=profile.sector if profile else None,
        startup_tagline=profile.tagline if profile else None,
        commitment_id=holding.commitment_id,
        instrument=holding.instrument,
        invested_amount=holding.invested_amount,
        currency=holding.currency,
        ownership_pct=holding.ownership_pct,
        invested_on=holding.invested_on,
        status=holding.status,
        exited_on=holding.exited_on,
        exit_value=holding.exit_value,
        created_at=holding.created_at,
        updated_at=holding.updated_at,
    )


# --- commitments -----------------------------------------------------------


async def _commitment_or_404(
    db: AsyncSession, commitment_id: uuid.UUID, investor_org_id: uuid.UUID
) -> Commitment:
    result = await db.execute(
        select(Commitment).where(
            Commitment.id == commitment_id,
            Commitment.investor_org_id == investor_org_id,
        )
    )
    commitment = result.scalar_one_or_none()
    if commitment is None:
        raise not_found("Commitment not found.")
    return commitment


async def list_commitments(
    db: AsyncSession,
    user: User,
    *,
    status: CommitmentStatus | None,
    limit: int,
    offset: int,
) -> tuple[list[CommitmentRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)

    stmt = (
        select(Commitment, Organization, StartupProfile, FundingRound)
        .join(FundingRound, FundingRound.id == Commitment.round_id)
        .join(Organization, Organization.id == FundingRound.org_id)
        .outerjoin(StartupProfile, StartupProfile.org_id == Organization.id)
        .where(Commitment.investor_org_id == org.id)
    )
    if status is not None:
        stmt = stmt.where(Commitment.status == status)

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(Commitment.updated_at.desc(), Commitment.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [
        _as_commitment_read(c, startup, profile, round_)
        for c, startup, profile, round_ in rows
    ], int(total)


async def get_commitment(
    db: AsyncSession, user: User, commitment_id: uuid.UUID
) -> CommitmentRead:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    commitment = await _commitment_or_404(db, commitment_id, org.id)
    round_ = await _round_or_404(db, commitment.round_id)
    startup, profile = await _startup_snapshot(db, round_.org_id)
    return _as_commitment_read(commitment, startup, profile, round_)


async def create_commitment(
    db: AsyncSession, user: User, payload: CommitmentCreate
) -> CommitmentRead:
    await _enforce_commitment_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    round_ = await _round_or_404(db, payload.round_id)
    await _validate_offer_ref(db, org.id, payload.offer_id, payload.round_id)

    commitment = Commitment(
        round_id=payload.round_id,
        offer_id=payload.offer_id,
        investor_org_id=org.id,
        amount=payload.amount,
        currency=payload.currency,
        status=CommitmentStatus.pledged,
        committed_on=payload.committed_on,
        reference=payload.reference,
    )
    db.add(commitment)
    await db.flush()

    # 9a plan D2: commitments write the round's committed_amount.
    round_.committed_amount = (round_.committed_amount or Decimal("0")) + payload.amount

    activity_service.record(
        db,
        event_type=ActivityEventType.commitment_created,
        org_id=org.id,
        actor_id=user.id,
        entity_type="commitment",
        entity_id=commitment.id,
        summary=(
            f"{user.display_name or 'An investor'} pledged "
            f"{commitment.amount} {commitment.currency}."
        ),
    )
    await db.commit()
    await db.refresh(commitment)
    startup, profile = await _startup_snapshot(db, round_.org_id)
    return _as_commitment_read(commitment, startup, profile, round_)


async def update_commitment(
    db: AsyncSession, user: User, commitment_id: uuid.UUID, payload: CommitmentUpdate
) -> CommitmentRead:
    await _enforce_commitment_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    commitment = await _commitment_or_404(db, commitment_id, org.id)

    if payload.reference is not None:
        commitment.reference = payload.reference
    if payload.committed_on is not None:
        commitment.committed_on = payload.committed_on

    activity_service.record(
        db,
        event_type=ActivityEventType.commitment_updated,
        org_id=org.id,
        actor_id=user.id,
        entity_type="commitment",
        entity_id=commitment.id,
        summary=f"{user.display_name or 'An investor'} updated the commitment.",
    )
    await db.commit()
    await db.refresh(commitment)
    round_ = await _round_or_404(db, commitment.round_id)
    startup, profile = await _startup_snapshot(db, round_.org_id)
    return _as_commitment_read(commitment, startup, profile, round_)


async def transition_commitment(
    db: AsyncSession, user: User, commitment_id: uuid.UUID, target: CommitmentStatus
) -> CommitmentRead:
    await _enforce_commitment_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    commitment = await _commitment_or_404(db, commitment_id, org.id)

    _check_commitment_transition(commitment.status, target)
    previous = commitment.status
    commitment.status = target
    if target == CommitmentStatus.funded:
        # Wiring is a server-side fact: stamp the timestamp and date.
        commitment.wired_at = datetime.now(UTC)
        if commitment.funded_on is None:
            commitment.funded_on = commitment.wired_at.date()
    if target == CommitmentStatus.cancelled:
        # Undo the round progress this pledge contributed.
        round_ = await _round_or_404(db, commitment.round_id)
        round_.committed_amount = max(
            Decimal("0"), (round_.committed_amount or Decimal("0")) - commitment.amount
        )

    activity_service.record(
        db,
        event_type=ActivityEventType.commitment_status_changed,
        org_id=org.id,
        actor_id=user.id,
        entity_type="commitment",
        entity_id=commitment.id,
        summary=(
            f"{user.display_name or 'An investor'} moved the commitment "
            f"from {previous.value} to {target.value}."
        ),
    )
    await db.commit()
    await db.refresh(commitment)
    round_ = await _round_or_404(db, commitment.round_id)
    startup, profile = await _startup_snapshot(db, round_.org_id)
    return _as_commitment_read(commitment, startup, profile, round_)


# --- portfolio holdings ----------------------------------------------------


async def _holding_or_404(
    db: AsyncSession, holding_id: uuid.UUID, investor_org_id: uuid.UUID
) -> PortfolioHolding:
    result = await db.execute(
        select(PortfolioHolding).where(
            PortfolioHolding.id == holding_id,
            PortfolioHolding.investor_org_id == investor_org_id,
        )
    )
    holding = result.scalar_one_or_none()
    if holding is None:
        raise not_found("Holding not found.")
    return holding


async def list_holdings(
    db: AsyncSession,
    user: User,
    *,
    status: str | None,
    limit: int,
    offset: int,
) -> tuple[list[HoldingRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)

    stmt = (
        select(PortfolioHolding, Organization, StartupProfile)
        .join(Organization, Organization.id == PortfolioHolding.startup_org_id)
        .outerjoin(StartupProfile, StartupProfile.org_id == Organization.id)
        .where(PortfolioHolding.investor_org_id == org.id)
    )
    if status is not None:
        stmt = stmt.where(PortfolioHolding.status == status)

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(PortfolioHolding.updated_at.desc(), PortfolioHolding.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [
        _as_holding_read(h, startup, profile)
        for h, startup, profile in rows
    ], int(total)


async def get_holding(db: AsyncSession, user: User, holding_id: uuid.UUID) -> HoldingRead:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    holding = await _holding_or_404(db, holding_id, org.id)
    startup, profile = await _startup_snapshot(db, holding.startup_org_id)
    return _as_holding_read(holding, startup, profile)


async def create_holding(
    db: AsyncSession, user: User, payload: HoldingCreate
) -> HoldingRead:
    await _enforce_portfolio_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    if payload.startup_org_id == org.id:
        raise validation_error(
            "An investor cannot hold itself.",
            details=[{"loc": ["body", "startup_org_id"], "msg": "Invalid startup.", "type": "value_error"}],
        )
    startup = await organization_service.startup_org_or_404(db, payload.startup_org_id)
    if payload.commitment_id is not None:
        commitment = (
            await db.execute(
                select(Commitment).where(
                    Commitment.id == payload.commitment_id,
                    Commitment.investor_org_id == org.id,
                )
            )
        ).scalar_one_or_none()
        if commitment is None:
            raise validation_error(
                "commitment_id must be a commitment of this firm.",
                details=[{"loc": ["body", "commitment_id"], "msg": "Invalid commitment.", "type": "value_error"}],
            )

    holding = PortfolioHolding(
        investor_org_id=org.id,
        startup_org_id=startup.id,
        commitment_id=payload.commitment_id,
        instrument=payload.instrument,
        invested_amount=payload.invested_amount,
        currency=payload.currency,
        ownership_pct=payload.ownership_pct,
        invested_on=payload.invested_on,
        status="active",
    )
    db.add(holding)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.holding_created,
        org_id=org.id,
        actor_id=user.id,
        entity_type="portfolio_holding",
        entity_id=holding.id,
        summary=(
            f"{user.display_name or 'An investor'} recorded a holding in "
            f"{startup.name} ({holding.invested_amount} {holding.currency})."
        ),
    )
    await db.commit()
    await db.refresh(holding)
    _, profile = await _startup_snapshot(db, holding.startup_org_id)
    return _as_holding_read(holding, startup, profile)


async def update_holding(
    db: AsyncSession, user: User, holding_id: uuid.UUID, payload: HoldingUpdate
) -> HoldingRead:
    await _enforce_portfolio_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    holding = await _holding_or_404(db, holding_id, org.id)

    if payload.instrument is not None:
        holding.instrument = payload.instrument
    if payload.invested_amount is not None:
        holding.invested_amount = payload.invested_amount
    if payload.currency is not None:
        holding.currency = payload.currency
    if payload.ownership_pct is not None:
        holding.ownership_pct = payload.ownership_pct
    if payload.invested_on is not None:
        holding.invested_on = payload.invested_on

    activity_service.record(
        db,
        event_type=ActivityEventType.holding_updated,
        org_id=org.id,
        actor_id=user.id,
        entity_type="portfolio_holding",
        entity_id=holding.id,
        summary=f"{user.display_name or 'An investor'} updated the holding.",
    )
    await db.commit()
    await db.refresh(holding)
    startup, profile = await _startup_snapshot(db, holding.startup_org_id)
    return _as_holding_read(holding, startup, profile)


async def transition_holding(
    db: AsyncSession,
    user: User,
    holding_id: uuid.UUID,
    target: str,
    exited_on: date | None = None,
    exit_value: Decimal | None = None,
) -> HoldingRead:
    await _enforce_portfolio_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    holding = await _holding_or_404(db, holding_id, org.id)

    _check_holding_transition(holding.status, target)
    if target in ("exited", "partially_exited", "written_off"):
        holding.exited_on = exited_on
        holding.exit_value = exit_value

    previous = holding.status
    holding.status = target
    activity_service.record(
        db,
        event_type=ActivityEventType.holding_status_changed,
        org_id=org.id,
        actor_id=user.id,
        entity_type="portfolio_holding",
        entity_id=holding.id,
        summary=(
            f"{user.display_name or 'An investor'} moved the holding "
            f"from {previous} to {target}."
        ),
    )
    await db.commit()
    await db.refresh(holding)
    startup, profile = await _startup_snapshot(db, holding.startup_org_id)
    return _as_holding_read(holding, startup, profile)


__all__ = [
    "create_commitment",
    "create_holding",
    "get_commitment",
    "get_holding",
    "list_commitments",
    "list_holdings",
    "transition_commitment",
    "transition_holding",
    "update_commitment",
    "update_holding",
]
