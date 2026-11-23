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

from datetime import UTC, datetime
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization, OrgRole, OrgType
from app.models.stage import StartupStageHistory
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


class _Sections(TypedDict):
    """Per-section values after the visibility + toggle gate (see below)."""

    summary: str | None
    business_model: str | None
    problem: str | None
    solution: str | None
    market: str | None
    traction_summary: str | None
    readiness_score: int | None


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


def section_values(
    org: Organization, profile: StartupProfile, *, visible: bool
) -> _Sections:
    """THE section gate — one implementation, two shapes (5a detail, 5h card).

    ``visible`` is True when the caller may see this profile at all (the
    visibility policy already said yes, or the caller is a member of the
    org). Each section is then further gated by its own toggle, so an
    outsider never sees a section the startup turned off.

    ``readiness_score`` is returned here but consumed only by the discovery
    card: the 5a public detail shape deliberately predates it, and adding a
    column to that contract is not this step's scope.
    """
    gated = visible
    return _Sections(
        summary=org.summary if gated and profile.summary_public else None,
        business_model=profile.business_model if gated and profile.summary_public else None,
        problem=profile.problem if gated and profile.summary_public else None,
        solution=profile.solution if gated and profile.summary_public else None,
        market=profile.market if gated and profile.summary_public else None,
        traction_summary=(
            profile.traction_summary if gated and profile.traction_public else None
        ),
        readiness_score=(profile.readiness_score if gated and profile.readiness_public else None),
    )


def _public_read(
    org: Organization, profile: StartupProfile, *, visible: bool
) -> StartupProfilePublicRead:
    """Section gating (plan §4): core fields are always in the member
    preview; for an anonymous caller ``visible`` is only True when
    profile_visibility == public, and sections then follow the toggles."""
    sections = section_values(org, profile, visible=visible)
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
        summary=sections["summary"],
        business_model=sections["business_model"],
        problem=sections["problem"],
        solution=sections["solution"],
        market=sections["market"],
        traction_summary=sections["traction_summary"],
    )


async def get_profile(
    db: AsyncSession, user: User, org_id  # noqa: ANN001
) -> StartupProfileRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    profile = await _ensure_profile(db, org)
    return _read(profile)


async def update_profile(
    db: AsyncSession, user: User, org_id, payload: StartupProfileUpdate  # noqa: ANN001
) -> StartupProfileRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    profile = await _ensure_profile(db, org)
    before_stage = profile.stage
    data = payload.model_dump(exclude_unset=True)
    if "pitch_deck_file_id" in data:
        from app.services.file_service import record_attachment_change, require_org_attachment

        if data["pitch_deck_file_id"] is not None:
            await require_org_attachment(
                db, user, org.id, data["pitch_deck_file_id"], "pitch_deck", "pitch_deck_file_id"
            )
        if data["pitch_deck_file_id"] != profile.pitch_deck_file_id:
            record_attachment_change(db, user, org.id, "pitch_deck_file_id")
    for field, value in data.items():
        setattr(profile, field, value)
    # Step 5i item 4: a stage change through this endpoint records history
    # in the SAME transaction. The dedicated PATCH /stage endpoint is the
    # richer surface (it also takes a note); this hook keeps the existing
    # client honest so no stage change goes unrecorded. Readiness
    # sign-offs are never touched here.
    if "stage" in data and data["stage"] != before_stage:
        db.add(
            StartupStageHistory(
                org_id=org.id,
                from_stage=before_stage,
                to_stage=profile.stage,
                changed_by=user.id,
                changed_at=datetime.now(UTC),
            )
        )
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
    org = await organization_service.startup_org_or_404(db, org_id)
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
