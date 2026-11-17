"""Public reads for organizations (Step 3 part 9).

The public shape never includes status, membership, timestamps beyond
founded year, or anything owner-only — if a field is not on
OrganizationPublicRead it cannot be served here.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.schemas.organization import OrganizationPublicRead


async def get_organization_by_slug(
    db: AsyncSession, slug: str
) -> OrganizationPublicRead | None:
    result = await db.execute(
        select(Organization).where(
            Organization.slug == slug.lower(),
            Organization.deleted_at.is_(None),
            Organization.status == "active",
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        return None
    return OrganizationPublicRead(
        name=org.name,
        slug=org.slug,
        type=org.type,
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
