"""Step 9c service: investor-side startup discovery.

Read-only. Reuses the single shared query
``discovery_service.investor_startup_rows`` behind the 9c list and the
9d saved-search matches, so the two never drift. Round data is the
startup's own data, gated by the 5a ``round_public`` opt-in (or a
member of the startup) — never exposed to a caller the startup did
not opt in to.

Authorization: any signed-in user (the 5h visibility rules apply, not
startup-membership). A startup that is not visible is a 404 (no
existence oracle).
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited
from app.models.funding_round import FundingRound, RoundStatus
from app.models.startup import StartupStage
from app.models.user import User
from app.schemas.investor_discovery import (
    InvestorRoundItem,
    InvestorStartupDetail,
    InvestorStartupFilters,
    InvestorStartupItem,
)
from app.services import discovery_service, rate_limiter


async def _enforce_search_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"investor_discovery_search:user:{user.id}",
        settings.INVESTOR_DISCOVERY_SEARCH_LIMIT,
        settings.INVESTOR_DISCOVERY_SEARCH_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many startup discovery searches. Please slow down.")


def _as_item(row: discovery_service.InvestorStartupRow) -> InvestorStartupItem:
    return InvestorStartupItem(
        org_id=row.org.id,
        slug=row.org.slug,
        name=row.org.name,
        tagline=row.profile.tagline,
        stage=row.profile.stage,
        sector=row.profile.sector,
        city=row.org.city,
        founded_year=row.org.founded_year,
        website=row.org.website,
        mentor_verified=row.profile.mentor_verified,
        readiness_score=row.profile.readiness_score,
        investment_ready=row.investment_ready,
        round_visible=row.round_visible(),
        round_target=row.round_target if row.round_visible() else None,
        round_committed=row.round_committed if row.round_visible() else None,
        round_currency=row.round_currency if row.round_visible() else None,
        traction_summary=row.profile.traction_summary,
        updated_at=row.org.updated_at,
    )


def _as_detail(row: discovery_service.InvestorStartupRow) -> InvestorStartupDetail:
    return InvestorStartupDetail(
        org_id=row.org.id,
        slug=row.org.slug,
        name=row.org.name,
        tagline=row.profile.tagline,
        stage=row.profile.stage,
        sector=row.profile.sector,
        city=row.org.city,
        region=row.org.region,
        country=row.org.country,
        founded_year=row.org.founded_year,
        website=row.org.website,
        logo_url=row.org.logo_url,
        logo_initials=row.org.logo_initials,
        summary=row.org.summary,
        problem=row.profile.problem,
        solution=row.profile.solution,
        market=row.profile.market,
        business_model=row.profile.business_model,
        traction_summary=row.profile.traction_summary,
        mentor_verified=row.profile.mentor_verified,
        readiness_score=row.profile.readiness_score,
        investment_ready=row.investment_ready,
        round_visible=row.round_visible(),
        round_target=row.round_target if row.round_visible() else None,
        round_committed=row.round_committed if row.round_visible() else None,
        round_currency=row.round_currency if row.round_visible() else None,
        updated_at=row.org.updated_at,
    )


async def list_startups(
    db: AsyncSession,
    user: User,
    *,
    limit: int,
    offset: int,
    sort: str,
    order: str,
    stage: StartupStage | None,
    sector: str | None,
    city: str | None,
    q: str | None,
    raise_min,
    raise_max,
    investment_ready_only: bool,
) -> tuple[list[InvestorStartupItem], int]:
    await _enforce_search_limit(user)
    rows, total = await discovery_service.investor_startup_rows(
        db,
        user,
        limit=limit,
        offset=offset,
        sort=sort,
        order=order,
        stage=stage,
        sector=sector,
        city=city,
        q=q,
        raise_min=raise_min,
        raise_max=raise_max,
        investment_ready_only=investment_ready_only,
    )
    return [_as_item(row) for row in rows], total


async def get_startup(
    db: AsyncSession, user: User, identifier: str
) -> InvestorStartupDetail:
    await _enforce_search_limit(user)
    row = await discovery_service.get_investor_startup_row(db, user, identifier)
    if row is None:
        raise not_found("Startup not found.")
    return _as_detail(row)


async def list_rounds(
    db: AsyncSession,
    user: User,
    identifier: str,
    *,
    limit: int,
    offset: int,
) -> tuple[list[InvestorRoundItem], int]:
    """The startup's non-draft, non-deleted rounds.

    Only reachable for a startup whose ``round_public`` is on (or a
    member); draft rounds are never surfaced to investors.
    """
    await _enforce_search_limit(user)
    row = await discovery_service.get_investor_startup_row(db, user, identifier)
    if row is None:
        raise not_found("Startup not found.")
    if not row.round_visible():
        # The startup did not opt in; do not confirm the rounds exist.
        raise not_found("Startup not found.")

    where = (
        FundingRound.org_id == row.org.id,
        FundingRound.deleted_at.is_(None),
        FundingRound.status != RoundStatus.draft,
    )
    total = (
        await db.execute(select(func.count(FundingRound.id)).where(*where))
    ).scalar_one()
    rounds = (
        await db.execute(
            select(FundingRound)
            .where(*where)
            .order_by(FundingRound.created_at.desc(), FundingRound.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return [
        InvestorRoundItem(
            id=str(round_.id),
            name=round_.name,
            round_type=round_.round_type,
            target_amount=round_.target_amount,
            committed_amount=round_.committed_amount,
            currency=round_.currency,
            pre_money_valuation=round_.pre_money_valuation,
            instrument=round_.instrument,
            status=round_.status,
            opens_on=round_.opens_on,
            closes_on=round_.closes_on,
            min_raise=round_.min_raise,
            min_ticket=round_.min_ticket,
            created_at=round_.created_at,
            updated_at=round_.updated_at,
        )
        for round_ in rounds
    ], int(total)


async def filters(db: AsyncSession, user: User) -> InvestorStartupFilters:
    await _enforce_search_limit(user)
    stages, sectors = await discovery_service.investor_startup_filters(db, user)
    return InvestorStartupFilters(
        stages=[StartupStage(s) for s in stages],
        sectors=sectors,
    )


__all__ = ["filters", "get_startup", "list_rounds", "list_startups"]
