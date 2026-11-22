"""Step 9d service: investor preferences, saved searches, shortlist.

Authorization in one place per operation, following the 5b/5e/8a-9a
precedent:

- **Resolve the caller's investor firm first.** Every function here
  acts on the ORG the caller belongs to (an active ``investor_firm``
  membership), never on an org id from the request. A caller with no
  investor firm gets a 404 (``INVESTOR_ORG_NOT_FOUND``) — the
  ``/investor/*`` shells show an empty state for that user.
- **Reads** (preferences, saved searches, shortlist, matches): any
  active member, viewer included.
- **Writes**: an active member with role owner/admin/member; a viewer
  is read-only everywhere in the product, so they get 403.
- Rows are org-scoped: a saved search or shortlist entry of ANOTHER
  investor firm is indistinguishable from a nonexistent one (404, no
  existence oracle).

Audit (D-9b rule: user content is audited on create/delete): saved
searches on create/delete, shortlist entries on add/remove. Preference
edits are the investor's own profile data and are deliberately not
audited (like user-profile edits).

Money: ``NUMERIC(14,2)`` in the table, ``Decimal`` in the service,
decimal strings in the response.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited
from app.models.activity import ActivityEventType
from app.models.investor_search import (
    InvestorPreference,
    InvestorType,
    SavedSearch,
    ShortlistEntry,
    ShortlistStatus,
)
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.startup import StartupProfile, StartupStage
from app.models.user import User
from app.schemas.investor_search import (
    InvestorPreferenceRead,
    InvestorPreferenceUpdate,
    SavedSearchRead,
    ShortlistEntryRead,
)
from app.services import (
    activity_service,
    discovery_service,
    organization_service,
    rate_limiter,
)

# Org roles allowed to write investor-side data. Viewers are read-only.
WRITE_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}


async def _enforce_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"investor_search_write:user:{user.id}",
        settings.INVESTOR_SEARCH_WRITE_LIMIT,
        settings.INVESTOR_SEARCH_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many investor search changes. Please slow down.")


async def _investor_org_or_404(db: AsyncSession, user: User) -> Organization:
    """The caller's active ``investor_firm`` organization, or 404.

    A user with several investor firms (rare, but possible) acts on the
    one they joined first; the frontend resolves the same way through
    ``/organizations/mine``.
    """
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


def _preference_read(
    row: InvestorPreference | None, org_id: uuid.UUID
) -> InvestorPreferenceRead:
    """Map a preferences row to its API shape; an absent row is empty."""
    now = datetime.now(UTC)
    if row is None:
        return InvestorPreferenceRead(
            investor_org_id=org_id,
            investor_type=None,
            sectors=[],
            stage_focus=[],
            min_ticket=None,
            max_ticket=None,
            created_at=now,
            updated_at=now,
        )
    return InvestorPreferenceRead(
        investor_org_id=row.investor_org_id,
        investor_type=InvestorType(row.investor_type) if row.investor_type else None,
        sectors=list(row.sectors or []),
        stage_focus=[StartupStage(s) for s in (row.stage_focus or [])],
        min_ticket=row.min_ticket,
        max_ticket=row.max_ticket,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


# --- preferences -----------------------------------------------------------


async def get_preferences(db: AsyncSession, user: User) -> InvestorPreferenceRead:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    result = await db.execute(
        select(InvestorPreference).where(
            InvestorPreference.investor_org_id == org.id
        )
    )
    return _preference_read(result.scalar_one_or_none(), org.id)


async def update_preferences(
    db: AsyncSession, user: User, payload: InvestorPreferenceUpdate
) -> InvestorPreferenceRead:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    result = await db.execute(
        select(InvestorPreference).where(
            InvestorPreference.investor_org_id == org.id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = InvestorPreference(investor_org_id=org.id)
        db.add(row)
    row.investor_type = payload.investor_type
    row.sectors = list(payload.sectors)
    row.stage_focus = [s.value for s in payload.stage_focus]
    row.min_ticket = payload.min_ticket
    row.max_ticket = payload.max_ticket
    await db.commit()
    await db.refresh(row)
    return _preference_read(row, org.id)


# --- saved searches -------------------------------------------------------


def _search_read(row: SavedSearch) -> SavedSearchRead:
    return SavedSearchRead(
        id=row.id,
        investor_org_id=row.investor_org_id,
        name=row.name,
        criteria=dict(row.criteria or {}),
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _get_search(
    db: AsyncSession, org_id: uuid.UUID, search_id: uuid.UUID
) -> SavedSearch:
    """Org-scoped lookup: a foreign or deleted search is indistinguishable."""
    result = await db.execute(
        select(SavedSearch).where(
            SavedSearch.id == search_id,
            SavedSearch.investor_org_id == org_id,
            SavedSearch.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Saved search not found.")
    return row


async def list_saved_searches(db: AsyncSession, user: User) -> list[SavedSearchRead]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    result = await db.execute(
        select(SavedSearch)
        .where(
            SavedSearch.investor_org_id == org.id,
            SavedSearch.deleted_at.is_(None),
        )
        .order_by(SavedSearch.created_at.desc(), SavedSearch.id)
    )
    return [_search_read(row) for row in result.scalars().all()]


async def create_saved_search(
    db: AsyncSession, user: User, payload
) -> SavedSearchRead:  # noqa: ANN001
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    row = SavedSearch(
        investor_org_id=org.id,
        name=payload.name,
        criteria=dict(payload.criteria),
        is_active=True,
    )
    db.add(row)
    activity_service.record(
        db,
        event_type=ActivityEventType.saved_search_created,
        org_id=org.id,
        actor_id=user.id,
        entity_type="saved_search",
        entity_id=row.id,
        summary=f"{user.display_name or 'An investor'} saved search “{row.name}”.",
        data={"criteria_keys": sorted((payload.criteria or {}).keys())},
    )
    await db.commit()
    await db.refresh(row)
    return _search_read(row)


async def update_saved_search(
    db: AsyncSession, user: User, search_id: uuid.UUID, payload
) -> SavedSearchRead:  # noqa: ANN001
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    row = await _get_search(db, org.id, search_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return _search_read(row)


async def delete_saved_search(db: AsyncSession, user: User, search_id: uuid.UUID) -> None:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    row = await _get_search(db, org.id, search_id)
    activity_service.record(
        db,
        event_type=ActivityEventType.saved_search_deleted,
        org_id=org.id,
        actor_id=user.id,
        entity_type="saved_search",
        entity_id=row.id,
        summary=(
            f"{user.display_name or 'An investor'} deleted saved search “{row.name}”."
        ),
    )
    row.deleted_at = datetime.now(UTC)
    await db.commit()


async def matches_for_search(
    db: AsyncSession, user: User, search_id: uuid.UUID, *, limit: int, offset: int
):  # noqa: ANN201
    """Current startups matching a saved search's criteria.

    Reuses the shared 9c investor-startup query, so the "View results"
    button shows exactly what the discover page would show for the same
    filters. Paused searches (``is_active`` false) still return matches;
    the pause only stops the (Step 12) notification side.
    """
    from app.schemas.investor_discovery import InvestorStartupPage

    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)

    row = await _get_search(db, org.id, search_id)
    criteria = dict(row.criteria or {})

    rows, total = await discovery_service.investor_startup_rows(
        db,
        user,
        limit=limit,
        offset=offset,
        sort=criteria.get("sort", "recent"),
        order=criteria.get("order", "desc"),
        stage=StartupStage(criteria["stage"]) if criteria.get("stage") else None,
        sector=criteria.get("sector"),
        city=criteria.get("city"),
        q=criteria.get("q"),
        raise_min=criteria.get("raise_min"),
        raise_max=criteria.get("raise_max"),
        investment_ready_only=bool(criteria.get("investment_ready_only", False)),
    )
    items = [_startup_item(r) for r in rows]
    return InvestorStartupPage(items=items, total=total, limit=limit, offset=offset)


def _startup_item(row: discovery_service.InvestorStartupRow):  # noqa: ANN001
    from app.schemas.investor_discovery import InvestorStartupItem

    show_rounds = row.round_visible()
    return InvestorStartupItem(
        org_id=row.org.id,
        slug=row.org.slug,
        name=row.org.name,
        tagline=row.profile.tagline,
        stage=StartupStage(row.profile.stage),
        sector=row.profile.sector,
        city=row.org.city,
        founded_year=row.org.founded_year,
        website=row.org.website,
        mentor_verified=bool(row.profile.mentor_verified),
        readiness_score=row.profile.readiness_score,
        investment_ready=row.investment_ready,
        round_visible=show_rounds,
        round_target=_as_decimal(row.round_target) if show_rounds else None,
        round_committed=_as_decimal(row.round_committed) if show_rounds else None,
        round_currency=row.round_currency if show_rounds else None,
        traction_summary=row.profile.traction_summary,
        updated_at=row.org.updated_at,
    )


def _as_decimal(value: object) -> Decimal | None:
    """SQLite has no DECIMAL: aggregates may come back as float/int."""
    if value is None:
        return None
    return Decimal(str(value))


# --- shortlist ------------------------------------------------------------


def _shortlist_read(
    row: ShortlistEntry, startup: Organization, profile: StartupProfile
) -> ShortlistEntryRead:
    return ShortlistEntryRead(
        id=row.id,
        investor_org_id=row.investor_org_id,
        startup_org_id=row.startup_org_id,
        note=row.note,
        status=ShortlistStatus(row.status),
        created_at=row.created_at,
        updated_at=row.updated_at,
        startup_name=startup.name,
        startup_slug=startup.slug,
        startup_stage=StartupStage(profile.stage),
        startup_sector=profile.sector,
        startup_readiness_score=profile.readiness_score,
        startup_investment_ready=(
            bool(profile.mentor_verified)
            and profile.readiness_score is not None
            and profile.readiness_score >= discovery_service.INVESTMENT_READY_MIN_SCORE
        ),
    )


async def _startup_org_or_404(db: AsyncSession, startup_org_id: uuid.UUID) -> Organization:
    """The shortlisted startup must be a live, active startup (404 else)."""
    result = await db.execute(
        select(Organization)
        .join(StartupProfile, StartupProfile.org_id == Organization.id)
        .where(
            Organization.id == startup_org_id,
            Organization.type == OrgType.startup,
            Organization.status == "active",
            Organization.deleted_at.is_(None),
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise not_found("Startup not found.")
    return org


async def list_shortlist(db: AsyncSession, user: User) -> list[ShortlistEntryRead]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)

    result = await db.execute(
        select(ShortlistEntry, Organization, StartupProfile)
        .join(Organization, Organization.id == ShortlistEntry.startup_org_id)
        .join(StartupProfile, StartupProfile.org_id == Organization.id)
        .where(
            ShortlistEntry.investor_org_id == org.id,
            ShortlistEntry.deleted_at.is_(None),
            Organization.deleted_at.is_(None),
        )
        .order_by(ShortlistEntry.created_at.desc(), ShortlistEntry.id)
    )
    return [
        _shortlist_read(entry, startup_org, profile)
        for entry, startup_org, profile in result.all()
    ]


async def _get_entry(
    db: AsyncSession, org_id: uuid.UUID, entry_id: uuid.UUID
) -> ShortlistEntry:
    result = await db.execute(
        select(ShortlistEntry).where(
            ShortlistEntry.id == entry_id,
            ShortlistEntry.investor_org_id == org_id,
            ShortlistEntry.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Shortlist entry not found.")
    return row


async def create_shortlist_entry(
    db: AsyncSession, user: User, payload
) -> ShortlistEntryRead:  # noqa: ANN001
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    startup = await _startup_org_or_404(db, payload.startup_org_id)

    existing = await db.execute(
        select(ShortlistEntry).where(
            ShortlistEntry.investor_org_id == org.id,
            ShortlistEntry.startup_org_id == startup.id,
            ShortlistEntry.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise conflict(
            "That startup is already on your shortlist.", code="SHORTLIST_EXISTS"
        )

    row = ShortlistEntry(
        investor_org_id=org.id,
        startup_org_id=startup.id,
        note=payload.note,
        status=payload.status or ShortlistStatus.new,
    )
    db.add(row)
    activity_service.record(
        db,
        event_type=ActivityEventType.shortlist_added,
        org_id=org.id,
        actor_id=user.id,
        entity_type="shortlist_entry",
        entity_id=row.id,
        summary=(
            f"{user.display_name or 'An investor'} added {startup.name} to the shortlist."
        ),
        data={"startup_org_id": str(startup.id)},
    )
    await db.commit()
    await db.refresh(row)

    profile = (
        await db.execute(
            select(StartupProfile).where(StartupProfile.org_id == startup.id)
        )
    ).scalar_one()
    return _shortlist_read(row, startup, profile)


async def update_shortlist_entry(
    db: AsyncSession, user: User, entry_id: uuid.UUID, payload
) -> ShortlistEntryRead:  # noqa: ANN001
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    row = await _get_entry(db, org.id, entry_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)

    result = await db.execute(
        select(Organization, StartupProfile)
        .join(StartupProfile, StartupProfile.org_id == Organization.id)
        .where(Organization.id == row.startup_org_id)
    )
    startup_org, profile = result.one()
    return _shortlist_read(row, startup_org, profile)


async def delete_shortlist_entry(db: AsyncSession, user: User, entry_id: uuid.UUID) -> None:
    await _enforce_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)

    row = await _get_entry(db, org.id, entry_id)
    activity_service.record(
        db,
        event_type=ActivityEventType.shortlist_removed,
        org_id=org.id,
        actor_id=user.id,
        entity_type="shortlist_entry",
        entity_id=row.id,
        summary=(
            f"{user.display_name or 'An investor'} removed an entry from the shortlist."
        ),
        data={"startup_org_id": str(row.startup_org_id)},
    )
    row.deleted_at = datetime.now(UTC)
    await db.commit()


__all__ = [
    "create_saved_search",
    "create_shortlist_entry",
    "delete_saved_search",
    "delete_shortlist_entry",
    "get_preferences",
    "list_saved_searches",
    "list_shortlist",
    "matches_for_search",
    "update_preferences",
    "update_saved_search",
    "update_shortlist_entry",
]
