"""Startup profile service (Step 5a).

Object-level rules (BUILD_PLAN Step 5 security):
- Only ``organizations.type == startup`` rows have a profile; deleted or
  non-active organizations 404 before any membership check (no oracle).
- Reads need an ACTIVE membership of any role (viewers read);
  writes additionally require owner/admin/member (viewers 403).
- Create-on-demand: the first read lazily inserts a default row
  (race-safe via the primary key); an explicit POST endpoint is not used.
- Server-controlled fields (mentor_verified, readiness_score, org_id,
  timestamps) are never accepted from clients — they are absent from
  StartupProfileUpdate (extra=forbid -> 422).
"""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import not_found
from app.models.organization import Organization, OrgRole, OrgType
from app.models.startup import ProfileVisibility, StartupProfile
from app.models.user import User
from app.schemas.startup import (
    StartupProfilePublicRead,
    StartupProfileRead,
    StartupProfileUpdate,
)
from app.services import organization_service

# Viewer role is deliberately excluded from writes (plan permission table).
_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})


async def _startup_org(db: AsyncSession, org_id) -> Organization:  # noqa: ANN001
    """Startup org or 404: wrong type / suspended / deleted look identical."""
    org = await organization_service.org_or_404(db, org_id)
    if org.type != OrgType.startup or org.status != "active":
        raise not_found("Organization not found.")
    return org


async def _select_profile(db: AsyncSession, org_id) -> StartupProfile | None:  # noqa: ANN001
    result = await db.execute(
        select(StartupProfile).where(StartupProfile.org_id == org_id)
    )
    return result.scalar_one_or_none()


async def _ensure_profile(db: AsyncSession, org: Organization) -> StartupProfile:
    """Create-on-demand (plan D10). Concurrent first reads: the loser's
    INSERT hits the primary key, rolls back and re-selects the winner's row."""
    profile = await _select_profile(db, org.id)
    if profile is not None:
        return profile
    row = StartupProfile(org_id=org.id)
    db.add(row)
    try:
        await db.flush()
        await db.commit()
        # Load server-generated defaults (created_at/updated_at) eagerly.
        await db.refresh(row)
    except IntegrityError:
        await db.rollback()
        winner = await _select_profile(db, org.id)
        if winner is None:
            raise
        return winner
    # expire_on_commit=False: the instance stays usable after the commit.
    return row


def _read(profile: StartupProfile) -> StartupProfileRead:
    return StartupProfileRead.model_validate(profile, from_attributes=True)


def _public_read(
    org: Organization, profile: StartupProfile, *, visible: bool
) -> StartupProfilePublicRead:
    """Section gating (plan §4): core fields are always in the member
    preview; for an anonymous caller ``visible`` is only True when
    profile_visibility == public, and sections then follow the toggles."""
    gated = visible
    return StartupProfilePublicRead(
        slug=org.slug,
        name=org.name,
        visibility=profile.profile_visibility,
        visible_to_public=visible,
        tagline=profile.tagline,
        stage=profile.stage,
        sector=profile.sector,
        city=org.city,
        founded_year=org.founded_year,
        website=org.website,
        summary=org.summary if gated and profile.summary_public else None,
        business_model=(
            profile.business_model if gated and profile.summary_public else None
        ),
        problem=profile.problem if gated and profile.summary_public else None,
        solution=profile.solution if gated and profile.summary_public else None,
        market=profile.market if gated and profile.summary_public else None,
        traction_summary=(
            profile.traction_summary if gated and profile.traction_public else None
        ),
    )


async def get_profile(
    db: AsyncSession, user: User, org_id  # noqa: ANN001
) -> StartupProfileRead:
    org = await _startup_org(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    profile = await _ensure_profile(db, org)
    return _read(profile)


async def update_profile(
    db: AsyncSession, user: User, org_id, payload: StartupProfileUpdate  # noqa: ANN001
) -> StartupProfileRead:
    org = await _startup_org(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    profile = await _ensure_profile(db, org)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    # The UPDATE's server-side onupdate expires updated_at; reload it in
    # async context (the org service re-selects after commit for the same
    # reason) so serialization never lazy-loads outside a greenlet.
    await db.refresh(profile)
    return _read(profile)


async def get_preview(
    db: AsyncSession, user: User, org_id  # noqa: ANN001
) -> StartupProfilePublicRead:
    """What an outsider would see right now, for the "Public preview" tab."""
    org = await _startup_org(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    profile = await _ensure_profile(db, org)
    visible = profile.profile_visibility == ProfileVisibility.public
    return _public_read(org, profile, visible=visible)


async def get_public(db: AsyncSession, slug: str) -> StartupProfilePublicRead | None:
    """Anonymous public read. Private / mentors / mentors_and_investors
    profiles are indistinguishable from nonexistent ones (404)."""
    result = await db.execute(
        select(Organization).where(
            Organization.slug == slug.lower(),
            Organization.deleted_at.is_(None),
            Organization.status == "active",
            Organization.type == OrgType.startup,
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        return None
    profile = await _select_profile(db, org.id)
    if profile is None:
        return None
    if profile.profile_visibility != ProfileVisibility.public:
        return None
    return _public_read(org, profile, visible=True)
