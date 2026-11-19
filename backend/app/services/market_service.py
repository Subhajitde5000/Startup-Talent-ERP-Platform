"""Market-tab service (Step 5l): market size and competitors.

Object-level rules (BUILD_PLAN Step 5 security):

- Startup organizations only; wrong-type / suspended / deleted orgs 404 via
  ``organization_service.startup_org_or_404`` (no existence oracle).
- Reads need an ACTIVE membership of any role (viewers read); writes
  additionally require owner/admin/member (viewer 403).
- Every lookup is scoped by ``org_id``: a market-size or competitor id from
  another organization is 404, never 403 (no existence oracle).
- ``source_type`` is constrained to the two client-writable values by the
  schema, so ``calculated`` / ``platform`` can never be asserted.
- Competitor names are unique per organization (case-insensitive, partial on
  live rows), so one org's rows can never collide with another's and a
  soft-deleted competitor does not block re-adding it.

Market size is an upsert keyed by (org, metric, scenario): the frontend
has one form per figure, and re-saving it must edit rather than duplicate.
Competitors are soft-deleted because the design doc keeps a change log.

Visibility (5l item 3): this module only ever serves MEMBERS. Market data
reaching an outsider is the 5h discovery / 5a public-read path, which
already gates on ``profile_visibility`` plus ``summary_public`` — market
content sits in the summary section there, so the toggle is enforced by
the one existing helper rather than a second rule here.
"""

import uuid
from decimal import Decimal, localcontext

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited
from app.models.analytics import (
    CompetitorType,
    MarketMetric,
    MarketScenario,
    MarketUnit,
    StartupCompetitor,
    StartupMarketSize,
)
from app.models.metric import StartupMetric
from app.models.organization import OrgRole
from app.models.startup import StartupProfile
from app.models.user import User
from app.schemas.analytics import (
    CompetitorCreate,
    CompetitorPage,
    CompetitorRead,
    CompetitorUpdate,
    MarketSizeBoard,
    MarketSizeRead,
    MarketSizeUpsert,
)
from app.services import organization_service
from app.services.rate_limiter import rate_limiter

# Viewer role is deliberately excluded from writes (5e/5f/5i convention).
_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})


def _read_market(row: StartupMarketSize) -> MarketSizeRead:
    return MarketSizeRead(
        id=row.id,
        org_id=row.org_id,
        metric=row.metric,
        scenario=row.scenario,
        # Decimal string, never a float (5e rule).
        value=str(row.value),
        unit=row.unit,
        currency=row.currency,
        estimate_year=row.estimate_year,
        source_type=row.source_type,
        source_note=row.source_note,
        source_url=row.source_url,
        confidence=row.confidence,
        assumptions=row.assumptions,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _read_competitor(row: StartupCompetitor) -> CompetitorRead:
    return CompetitorRead(
        id=row.id,
        org_id=row.org_id,
        name=row.name,
        type=row.type,
        website=row.website,
        target_customer=row.target_customer,
        positioning=row.positioning,
        strengths=row.strengths,
        weaknesses=row.weaknesses,
        pricing_note=row.pricing_note,
        last_reviewed_on=row.last_reviewed_on,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _ensure_profile(db: AsyncSession, org_id: uuid.UUID) -> StartupProfile:
    """Create the startup profile on demand (the 5a/5e ``_ensure_profile``).

    Both new tables reference ``startup_profiles.org_id``, so the parent row
    must exist before the first row is written. The insert sits in a
    savepoint: a concurrent creator wins the primary key, only this savepoint
    rolls back, and the winner's row is re-read.
    """
    result = await db.execute(
        select(StartupProfile).where(StartupProfile.org_id == org_id)
    )
    profile = result.scalar_one_or_none()
    if profile is not None:
        return profile
    try:
        async with db.begin_nested():
            profile = StartupProfile(org_id=org_id)
            db.add(profile)
            await db.flush()
        return profile
    except IntegrityError:
        winner = (
            await db.execute(
                select(StartupProfile).where(StartupProfile.org_id == org_id)
            )
        ).scalar_one_or_none()
        if winner is None:  # pragma: no cover - defensive
            raise
        return winner


async def _enforce_write_limit(user: User, action: str) -> None:
    """Per-actor throttle on 5l writes."""
    settings = get_settings()
    if not await rate_limiter.check(
        f"analytics:{action}:user:{user.id}",
        settings.ANALYTICS_WRITE_LIMIT,
        settings.ANALYTICS_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many market updates. Please try again later.")


async def _require_writer(db: AsyncSession, user: User, org_id: uuid.UUID) -> None:
    await organization_service.require_membership(
        db, org_id, user, roles=set(_WRITE_ROLES)
    )


# --- market size -------------------------------------------------------------


async def upsert_market_size(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: MarketSizeUpsert
) -> MarketSizeRead:
    """Write one (metric, scenario) figure; owner/admin/member only."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await _require_writer(db, user, org.id)
    await _enforce_write_limit(user, "market")
    await _ensure_profile(db, org.id)

    existing = (
        await db.execute(
            select(StartupMarketSize).where(
                StartupMarketSize.org_id == org.id,
                StartupMarketSize.metric == payload.metric,
                StartupMarketSize.scenario == payload.scenario,
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.value = payload.value
        existing.unit = payload.unit
        existing.currency = payload.currency
        existing.estimate_year = payload.estimate_year
        existing.source_type = payload.source_type
        existing.source_note = payload.source_note
        existing.source_url = payload.source_url
        existing.confidence = payload.confidence
        existing.assumptions = payload.assumptions
        row = existing
    else:
        row = StartupMarketSize(
            org_id=org.id,
            metric=payload.metric,
            scenario=payload.scenario,
            value=payload.value,
            unit=payload.unit,
            currency=payload.currency,
            estimate_year=payload.estimate_year,
            source_type=payload.source_type,
            source_note=payload.source_note,
            source_url=payload.source_url,
            confidence=payload.confidence,
            assumptions=payload.assumptions,
        )
        db.add(row)

    await db.commit()
    # Same post-commit refresh reason as the other services: server defaults
    # (id/created_at/updated_at) must be loaded before serializing.
    await db.refresh(row)
    return _read_market(row)


async def _get_market(
    db: AsyncSession, org_id: uuid.UUID, entry_id: uuid.UUID
) -> StartupMarketSize:
    """Org-scoped lookup: a foreign id is 404 (no oracle)."""
    row = (
        await db.execute(
            select(StartupMarketSize).where(
                StartupMarketSize.id == entry_id,
                StartupMarketSize.org_id == org_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Market size entry not found.")
    return row


async def list_market_size(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> MarketSizeBoard:
    """Every stored figure plus the (metric, scenario) pairs still missing."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    rows = (
        (
            await db.execute(
                select(StartupMarketSize)
                .where(StartupMarketSize.org_id == org.id)
                .order_by(StartupMarketSize.metric, StartupMarketSize.scenario)
            )
        )
        .scalars()
        .all()
    )
    present = {(row.metric, row.scenario) for row in rows}
    missing = [
        f"{metric.value}:{scenario.value}"
        for metric in MarketMetric
        for scenario in MarketScenario
        if (metric, scenario) not in present
    ]

    # The tab's KPI row needs two derived numbers. They are served here
    # rather than through extra endpoints: one board read answers the tab.
    competitor_count = (
        await db.execute(
            select(func.count())
            .select_from(StartupCompetitor)
            .where(
                StartupCompetitor.org_id == org.id,
                StartupCompetitor.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    sam = next(
        (
            row
            for row in rows
            if row.metric == MarketMetric.sam and row.scenario == MarketScenario.base
        ),
        None,
    )

    return MarketSizeBoard(
        items=[_read_market(row) for row in rows],
        missing=missing,
        market_share_pct=await _market_share_pct(db, org.id, sam),
        competitors_tracked=competitor_count,
    )


async def delete_market_size(
    db: AsyncSession, user: User, org_id: uuid.UUID, entry_id: uuid.UUID
) -> None:
    """Remove one figure (hard delete: there is no history to keep)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await _require_writer(db, user, org.id)
    await _enforce_write_limit(user, "market")
    row = await _get_market(db, org.id, entry_id)
    await db.delete(row)
    await db.commit()


# --- competitors -------------------------------------------------------------


async def create_competitor(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: CompetitorCreate
) -> CompetitorRead:
    """Add a competitor; a duplicate name in this org is a 409."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await _require_writer(db, user, org.id)
    await _enforce_write_limit(user, "competitor")
    await _ensure_profile(db, org.id)

    row = StartupCompetitor(
        org_id=org.id,
        name=payload.name,
        type=payload.type,
        website=payload.website,
        target_customer=payload.target_customer,
        positioning=payload.positioning,
        strengths=payload.strengths,
        weaknesses=payload.weaknesses,
        pricing_note=payload.pricing_note,
        last_reviewed_on=payload.last_reviewed_on,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        # The partial unique index is the authority, not a prior SELECT:
        # two concurrent adds of the same name must produce one row.
        await db.rollback()
        raise conflict(f"A competitor named {payload.name} is already tracked.") from None
    await db.refresh(row)
    return _read_competitor(row)


async def _get_competitor(
    db: AsyncSession, org_id: uuid.UUID, competitor_id: uuid.UUID
) -> StartupCompetitor:
    """Org-scoped lookup of a LIVE row: a foreign or deleted id is 404."""
    row = (
        await db.execute(
            select(StartupCompetitor).where(
                StartupCompetitor.id == competitor_id,
                StartupCompetitor.org_id == org_id,
                StartupCompetitor.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Competitor not found.")
    return row


async def list_competitors(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    competitor_type: CompetitorType | None,
    limit: int,
    offset: int,
) -> CompetitorPage:
    """Paginated live competitors, most recently reviewed first."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    filters = [
        StartupCompetitor.org_id == org.id,
        StartupCompetitor.deleted_at.is_(None),
    ]
    if competitor_type is not None:
        filters.append(StartupCompetitor.type == competitor_type)

    total = (
        await db.execute(
            select(func.count()).select_from(StartupCompetitor).where(*filters)
        )
    ).scalar_one()
    rows = (
        (
            await db.execute(
                select(StartupCompetitor)
                .where(*filters)
                # Stable tiebreak on id: reviewed_on is nullable and repeats.
                .order_by(
                    StartupCompetitor.last_reviewed_on.desc().nullslast(),
                    func.lower(StartupCompetitor.name),
                    StartupCompetitor.id,
                )
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return CompetitorPage(
        items=[_read_competitor(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


async def update_competitor(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    competitor_id: uuid.UUID,
    payload: CompetitorUpdate,
) -> CompetitorRead:
    """Partial edit; only the fields the client sent are touched."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await _require_writer(db, user, org.id)
    await _enforce_write_limit(user, "competitor")
    row = await _get_competitor(db, org.id, competitor_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise conflict(
            f"A competitor named {payload.name} is already tracked."
        ) from None
    await db.refresh(row)
    return _read_competitor(row)


async def delete_competitor(
    db: AsyncSession, user: User, org_id: uuid.UUID, competitor_id: uuid.UUID
) -> None:
    """Soft delete: the design doc keeps a change log, so the row survives."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await _require_writer(db, user, org.id)
    await _enforce_write_limit(user, "competitor")
    row = await _get_competitor(db, org.id, competitor_id)
    row.deleted_at = func.now()
    await db.commit()


async def _market_share_pct(
    db: AsyncSession, org_id: uuid.UUID, sam: StartupMarketSize | None
) -> str | None:
    """ARR ÷ base SAM as a percentage string, or None when undefined.

    Two honest-empty rules: with no SAM or no ARR there is no share to
    state, and a count-sized SAM cannot be divided by a currency ARR — a
    "share" of a market measured in people is meaningless.
    """
    if sam is None or sam.unit != MarketUnit.monetary:
        return None
    arr = (
        await db.execute(
            select(StartupMetric)
            .where(StartupMetric.org_id == org_id, StartupMetric.metric_key == "arr")
            .order_by(StartupMetric.period_end.desc(), StartupMetric.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if arr is None or Decimal(sam.value) == 0:
        return None
    if (arr.currency or "INR") != (sam.currency or "INR"):
        return None
    with localcontext() as ctx:
        ctx.prec = 40
        share = Decimal(arr.value) / Decimal(sam.value) * Decimal(100)
        return format(share.quantize(Decimal("0.0001")).normalize(), "f")
