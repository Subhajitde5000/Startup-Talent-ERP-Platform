"""Verified investor directory for active startup members (Step 9b).

Responses contain only the existing public organization identity. Investor
preferences, private deal information, and verification metadata are excluded.
"""
import uuid

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited
from app.models.organization import Organization, OrgType
from app.models.user import User
from app.schemas.investor_directory import InvestorDirectoryItem, InvestorDirectoryPage
from app.services import discovery_service, organization_service
from app.services.rate_limiter import rate_limiter


async def _authorize(db: AsyncSession, user: User, startup_org_id: uuid.UUID) -> None:
    org = await organization_service.startup_org_or_404(db, startup_org_id)
    await organization_service.require_membership(db, org.id, user)
    settings = get_settings()
    if not await rate_limiter.check(
        f"investor-directory:read:user:{user.id}",
        settings.INVESTOR_DIRECTORY_READ_LIMIT,
        settings.INVESTOR_DIRECTORY_READ_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many investor directory requests. Please try again later.")


def _visible_filters() -> tuple[ColumnElement[bool], ...]:
    return (
        Organization.type == OrgType.investor_firm,
        Organization.status == "active",
        Organization.verified_at.is_not(None),
        Organization.deleted_at.is_(None),
    )


def _read(org: Organization) -> InvestorDirectoryItem:
    return InvestorDirectoryItem(
        id=org.id,
        name=org.name,
        slug=org.slug,
        summary=org.summary,
        logo_url=org.logo_url,
        logo_initials=org.logo_initials,
        website=org.website,
        city=org.city,
        region=org.region,
        country=org.country,
        founded_year=org.founded_year,
        verified=org.verified_at is not None,
    )


async def list_investors(
    db: AsyncSession,
    user: User,
    startup_org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
    q: str | None,
    city: str | None,
    country: str | None,
    sort: str,
    order: str,
) -> InvestorDirectoryPage:
    await _authorize(db, user, startup_org_id)
    filters = list(_visible_filters())
    for term in discovery_service._terms(q):
        pattern = f"%{discovery_service._escape_like(term.lower())}%"
        filters.append(or_(
            func.lower(Organization.name).like(pattern, escape="\\"),
            func.lower(Organization.slug).like(pattern, escape="\\"),
            func.lower(Organization.city).like(pattern, escape="\\"),
            func.lower(Organization.region).like(pattern, escape="\\"),
            func.lower(Organization.country).like(pattern, escape="\\"),
        ))
    if city and city.strip():
        filters.append(func.lower(Organization.city) == city.strip().lower())
    if country:
        filters.append(func.upper(Organization.country) == country)
    total = (await db.execute(select(func.count()).select_from(Organization).where(*filters))).scalar_one()
    column = Organization.name if sort == "name" else Organization.created_at
    direction = column.asc() if order == "asc" else column.desc()
    rows = (await db.execute(
        select(Organization).where(*filters).order_by(direction, Organization.id).offset(offset).limit(limit)
    )).scalars().all()
    return InvestorDirectoryPage(items=[_read(row) for row in rows], total=total, limit=limit, offset=offset)


async def get_investor(
    db: AsyncSession, user: User, startup_org_id: uuid.UUID, investor_org_id: uuid.UUID
) -> InvestorDirectoryItem:
    await _authorize(db, user, startup_org_id)
    row = (await db.execute(
        select(Organization).where(Organization.id == investor_org_id, *_visible_filters())
    )).scalar_one_or_none()
    if row is None:
        raise not_found("Investor not found.")
    return _read(row)
