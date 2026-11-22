"""Step 9b service: investor directory (startup view).

Read-only: 9b adds no tables and no writes, so every function here is
a SELECT (the 8a mentor-directory precedent).

Authorization: the caller must be an active member of the STARTUP
org in the path (``organizations.startup_org_or_404`` +
``require_membership``), any role including viewer — the directory is
the startup's tool for finding investors, not private data. A foreign
``org_id`` is a 404 (no existence oracle).

What is listed: active, non-deleted ``investor_firm`` organizations,
joined with their 9d ``investor_preferences`` (thesis filters). Only
org-level public fields are returned — never the firm's members,
emails or any other private data.

Filtering follows the 5b/5c/5h list convention: whitelisted sort
keys, stable tiebreaks so offset pagination never repeats or skips a
row. Sector/stage-focus membership is matched on the JSON text with a
quoted-token LIKE (``%"Fintech"%``), which is exact-token on both
PostgreSQL (jsonb -> text) and SQLite (JSON stored as TEXT) and needs
no dialect-specific JSON operators.
"""

import uuid
from decimal import Decimal

from sqlalchemy import Select, String, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited, validation_error
from app.models.investor_search import InvestorPreference, InvestorType
from app.models.organization import Organization, OrgType
from app.models.startup import StartupStage
from app.models.user import User
from app.schemas.investor_directory import (
    InvestorDirectoryDetail,
    InvestorDirectoryFacets,
    InvestorDirectoryItem,
    InvestorDirectorySummary,
)
from app.services import organization_service, rate_limiter

_MAX_Q = 100
_MAX_Q_TERMS = 5
_MAX_TERM = 40

# Whitelisted sort keys for the list endpoint.
_SORTS = frozenset({"name", "recent"})
_SORT_COLUMNS = {
    "name": lambda: func.lower(Organization.name),
    "recent": lambda: Organization.updated_at,
}


def _escape_like(term: str) -> str:
    """Escape LIKE metacharacters so a user typing '%' matches a literal %."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _terms(q: str | None) -> list[str]:
    if q is None:
        return []
    cleaned = q.strip()[:_MAX_Q]
    if not cleaned:
        return []
    return [t[:_MAX_TERM] for t in cleaned.split() if t][:_MAX_Q_TERMS]


async def _enforce_search_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"investor_directory_search:user:{user.id}",
        settings.INVESTOR_DIRECTORY_SEARCH_LIMIT,
        settings.INVESTOR_DIRECTORY_SEARCH_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many investor directory searches. Please slow down.")


def _investor_firm_filter():
    """The base set: active, non-deleted investor firms."""
    return (
        Organization.type == OrgType.investor_firm,
        Organization.status == "active",
        Organization.deleted_at.is_(None),
    )


def _base_query() -> Select:
    """Active investor firms with their thesis preferences (left join)."""
    return (
        select(Organization, InvestorPreference)
        .outerjoin(
            InvestorPreference,
            InvestorPreference.investor_org_id == Organization.id,
        )
        .where(*_investor_firm_filter())
    )


def _apply_filters(
    stmt: Select,
    *,
    terms: list[str],
    investor_type: InvestorType | None,
    sector: str | None,
    stage_focus: StartupStage | None,
    ticket_min: Decimal | None,
    ticket_max: Decimal | None,
    location: str | None,
    verified_only: bool,
) -> Select:
    """The directory filters on top of the investor-firm base query."""
    if terms:
        for term in terms:
            pattern = f"%{_escape_like(term.lower())}%"
            stmt = stmt.where(
                or_(
                    func.lower(Organization.name).like(pattern, escape="\\"),
                    func.lower(Organization.summary).like(pattern, escape="\\"),
                )
            )
    if investor_type is not None:
        stmt = stmt.where(InvestorPreference.investor_type == investor_type.value)
    if sector:
        # Exact-token match on the JSON array text: '["Fintech"]'
        # contains '"Fintech"' but '["Fintech Infra"]' does not.
        stmt = stmt.where(
            func.cast(InvestorPreference.sectors, String).like(
                f'%"{_escape_like(sector)}"%', escape="\\"
            )
        )
    if stage_focus is not None:
        stmt = stmt.where(
            func.cast(InvestorPreference.stage_focus, String).like(
                f'%"{stage_focus.value}"%', escape="\\"
            )
        )
    if ticket_min is not None or ticket_max is not None:
        # Overlap: the investor's typical range intersects the filter
        # range. Investors with no recorded range are excluded.
        if ticket_min is not None:
            stmt = stmt.where(InvestorPreference.max_ticket >= ticket_min)
        if ticket_max is not None:
            stmt = stmt.where(InvestorPreference.min_ticket <= ticket_max)
    if location:
        pattern = f"%{_escape_like(location.strip().lower())}%"
        stmt = stmt.where(
            or_(
                func.lower(Organization.city).like(pattern, escape="\\"),
                func.lower(Organization.region).like(pattern, escape="\\"),
                func.lower(Organization.country).like(pattern, escape="\\"),
            )
        )
    if verified_only:
        stmt = stmt.where(Organization.verified_at.is_not(None))
    return stmt


def _item(org: Organization, prefs: InvestorPreference | None) -> InvestorDirectoryItem:
    return InvestorDirectoryItem(
        id=org.id,
        name=org.name,
        slug=org.slug,
        investor_type=InvestorType(prefs.investor_type) if prefs and prefs.investor_type else None,
        summary=org.summary,
        logo_url=org.logo_url,
        logo_initials=org.logo_initials,
        website=org.website,
        city=org.city,
        region=org.region,
        country=org.country,
        founded_year=org.founded_year,
        verified=org.verified_at is not None,
        sectors=list(prefs.sectors or []) if prefs else [],
        stage_focus=[StartupStage(s) for s in (prefs.stage_focus or [])] if prefs else [],
        min_ticket=prefs.min_ticket if prefs else None,
        max_ticket=prefs.max_ticket if prefs else None,
    )


def _detail(org: Organization, prefs: InvestorPreference | None) -> InvestorDirectoryDetail:
    return InvestorDirectoryDetail(
        id=org.id,
        name=org.name,
        slug=org.slug,
        investor_type=InvestorType(prefs.investor_type) if prefs and prefs.investor_type else None,
        summary=org.summary,
        logo_url=org.logo_url,
        logo_initials=org.logo_initials,
        website=org.website,
        city=org.city,
        region=org.region,
        country=org.country,
        founded_year=org.founded_year,
        verified=org.verified_at is not None,
        sectors=list(prefs.sectors or []) if prefs else [],
        stage_focus=[StartupStage(s) for s in (prefs.stage_focus or [])] if prefs else [],
        min_ticket=prefs.min_ticket if prefs else None,
        max_ticket=prefs.max_ticket if prefs else None,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


async def _guard(db: AsyncSession, user: User, org_id: uuid.UUID) -> None:
    """The startup org in the path must exist and the caller must be a member."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)


async def list_investors(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    q: str | None,
    investor_type: InvestorType | None,
    sector: str | None,
    stage_focus: StartupStage | None,
    ticket_min: Decimal | None,
    ticket_max: Decimal | None,
    location: str | None,
    verified_only: bool,
    sort: str,
    limit: int,
    offset: int,
) -> tuple[list[InvestorDirectoryItem], int]:
    await _enforce_search_limit(user)
    await _guard(db, user, org_id)

    if sort not in _SORTS:
        raise validation_error("Unknown sort key.")

    terms = _terms(q)
    filtered = _apply_filters(
        _base_query(),
        terms=terms,
        investor_type=investor_type,
        sector=sector,
        stage_focus=stage_focus,
        ticket_min=ticket_min,
        ticket_max=ticket_max,
        location=location,
        verified_only=verified_only,
    )
    total = (
        await db.execute(select(func.count()).select_from(filtered.subquery()))
    ).scalar_one()

    primary = _SORT_COLUMNS[sort]()
    order_by = [
        primary.desc() if sort == "recent" else primary.asc(),
        func.lower(Organization.name).asc(),
        Organization.id.asc(),
    ]
    rows = (
        await db.execute(filtered.order_by(*order_by).limit(limit).offset(offset))
    ).all()

    return [_item(org, prefs) for org, prefs in rows], int(total)


async def summary(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> InvestorDirectorySummary:
    """Header counts in one aggregate query (no N+1).

    Counts the base investor-firm set directly (no join, no subquery),
    so there is no cartesian product between the organizations table
    and any preferences join.
    """
    await _enforce_search_limit(user)
    await _guard(db, user, org_id)

    total, verified = (
        await db.execute(
            select(
                func.count(Organization.id),
                func.count(Organization.verified_at),
            ).where(*_investor_firm_filter())
        )
    ).one()
    return InvestorDirectorySummary(total=int(total), verified=int(verified))


async def facets(db: AsyncSession, user: User, org_id: uuid.UUID) -> InvestorDirectoryFacets:
    """Distinct thesis values among active investor firms.

    The investor-firm set is small, so the distinct values are derived
    from the preferences rows in Python rather than with dialect-specific
    JSON unnesting (json_each on SQLite vs jsonb on PostgreSQL).
    """
    await _enforce_search_limit(user)
    await _guard(db, user, org_id)

    result = await db.execute(
        select(InvestorPreference.sectors, InvestorPreference.stage_focus,
               InvestorPreference.investor_type)
        .where(
            InvestorPreference.investor_org_id.in_(
                select(Organization.id).where(*_investor_firm_filter())
            )
        )
    )
    sectors: set[str] = set()
    stages: set[str] = set()
    types: set[str] = set()
    for sector_list, stage_list, investor_type in result.all():
        sectors.update(s for s in (sector_list or []) if s)
        stages.update(s for s in (stage_list or []) if s)
        if investor_type:
            types.add(investor_type)
    return InvestorDirectoryFacets(
        sectors=sorted(sectors),
        stage_focus=[StartupStage(s) for s in sorted(stages)],
        types=[InvestorType(t) for t in sorted(types)],
    )


async def get_investor(
    db: AsyncSession, user: User, org_id: uuid.UUID, investor_org_id: uuid.UUID
) -> InvestorDirectoryDetail:
    """One investor firm; a foreign or deleted firm is a 404."""
    await _enforce_search_limit(user)
    await _guard(db, user, org_id)

    result = await db.execute(
        _base_query().where(Organization.id == investor_org_id)
    )
    row = result.first()
    if row is None:
        raise not_found("Investor not found.")
    org, prefs = row
    return _detail(org, prefs)


__all__ = [
    "facets",
    "get_investor",
    "list_investors",
    "summary",
]
