"""Startup discovery service (Step 5h).

The shared read behind job-seeker, mentor and investor discovery. One
implementation, parameterised by WHO is asking — never two code paths.

Visibility policy (5h plan D1, approved). ``profile_visibility`` names an
AUDIENCE; each caller class sees the rows whose audience includes it:

======================  ======== ======= ====== =========== ========= =========
profile_visibility      anon     mentor  invest  jobseeker   startup   admin
======================  ======== ======= ====== =========== ========= =========
private                 no       no      no     no          member    member
mentors                 no       YES     no     no          no        no
mentors_and_investors   no       YES     YES    no          YES       YES
public                  YES      YES     YES    YES         YES       YES
======================  ======== ======= ====== =========== ========= =========

``private`` means "my own workspace only": a member still sees their own
startup in the member list (it is their own data) and nobody else does.
``members`` = an ACTIVE membership row for that organization.

A row a caller may not see is ABSENT from their list, not redacted —
that is the 5a no-existence-oracle rule applied to a collection.

Section toggles (summary_public / traction_public / readiness_public) are
applied per row AFTER the visibility check, by
``startup_profile_service.section_values`` — the same gate the 5a public
detail read uses. An outsider never sees a private section even when the
profile is visible to them.

Sorting follows the 5b/5c list convention: whitelisted columns, explicit
``order``, and stable tiebreaks so offset pagination never repeats or
skips a row.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mentorship import Mentorship
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgType,
)
from app.models.startup import ProfileVisibility, StartupProfile, StartupStage
from app.models.user import User, UserRole, UserRoleRow
from app.schemas.discovery import (
    StartupDiscoveryDetail,
    StartupDiscoveryItem,
    StartupDiscoveryPage,
)
from app.services import startup_profile_service

_MAX_Q = 100
_MAX_Q_TERMS = 5
_MAX_TERM = 40

# Caller classes, resolved once per request from the user's active roles.
_VISIBILITIES_INVESTOR = (
    ProfileVisibility.public,
    ProfileVisibility.mentors_and_investors,
)
_VISIBILITIES_MENTOR = (
    ProfileVisibility.public,
    ProfileVisibility.mentors_and_investors,
    ProfileVisibility.mentors,
)
_VISIBILITIES_PUBLIC = (ProfileVisibility.public,)


@dataclass(frozen=True)
class _Viewer:
    """Who is asking: resolved audiences + org memberships."""

    visibilities: tuple[ProfileVisibility, ...]
    member_org_ids: frozenset[Any]


def _escape_like(term: str) -> str:
    """Escape LIKE metacharacters so a user typing '%' matches a literal %."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _terms(q: str | None) -> list[str]:
    """Split the search box into at most ``_MAX_Q_TERMS`` bounded terms."""
    if q is None:
        return []
    cleaned = q.strip()[:_MAX_Q]
    if not cleaned:
        return []
    return [t[:_MAX_TERM] for t in cleaned.split() if t][:_MAX_Q_TERMS]


async def _resolve_viewer(db: AsyncSession, user: User | None) -> _Viewer:
    """Map an authenticated user to the audiences they may see.

    Anonymous callers get the public audience only. A user with SEVERAL
    roles gets the union of their audiences (an investor who also mentors
    sees ``mentors`` rows too), because the roles are independent grants.
    """
    if user is None:
        return _Viewer(
            visibilities=_VISIBILITIES_PUBLIC, member_org_ids=frozenset()
        )

    rows = (
        await db.execute(
            select(UserRoleRow.role).where(
                UserRoleRow.user_id == user.id,
                UserRoleRow.revoked_at.is_(None),
            )
        )
    ).scalars()
    roles = set(rows)

    visibilities: set[ProfileVisibility] = set(_VISIBILITIES_PUBLIC)
    if UserRole.investor in roles:
        visibilities.update(_VISIBILITIES_INVESTOR)
    if UserRole.mentor in roles:
        visibilities.update(_VISIBILITIES_MENTOR)
    if UserRole.startup in roles or UserRole.employer in roles or UserRole.admin in roles:
        # ``mentors_and_investors`` is the platform's "signed-in ecosystem
        # member" audience, so founders/employers/admins sit there. They do
        # NOT see ``mentors`` rows unless they also hold the mentor role.
        visibilities.update(_VISIBILITIES_INVESTOR)

    member_ids = (
        await db.execute(
            select(OrganizationMember.org_id).where(
                OrganizationMember.user_id == user.id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == MemberStatus.active,
            )
        )
    ).scalars()

    return _Viewer(
        visibilities=tuple(visibilities), member_org_ids=frozenset(member_ids)
    )


def _visible_clause(viewer: _Viewer) -> ColumnElement[bool]:
    """Rows this viewer may see: audience match, or their own membership."""
    clause: ColumnElement[bool] = StartupProfile.profile_visibility.in_(
        [v.value for v in viewer.visibilities]
    )
    if viewer.member_org_ids:
        clause = or_(clause, StartupProfile.org_id.in_(viewer.member_org_ids))
    return clause


def _base_query(viewer: _Viewer) -> Select:
    """Live startup profiles only, already narrowed to visible rows."""
    return (
        select(Organization, StartupProfile)
        .join(StartupProfile, StartupProfile.org_id == Organization.id)
        .where(
            Organization.type == OrgType.startup,
            Organization.status == "active",
            Organization.deleted_at.is_(None),
            _visible_clause(viewer),
        )
    )


def _apply_filters(
    stmt: Select,
    *,
    stage: StartupStage | None,
    sector: str | None,
    city: str | None,
    terms: list[str],
) -> Select:
    if stage is not None:
        stmt = stmt.where(StartupProfile.stage == stage)
    if sector:
        # Case-insensitive exact match: sector is free text in schema.sql
        # and there is no canonical sector list yet (5h plan: no enum).
        stmt = stmt.where(func.lower(StartupProfile.sector) == sector.strip().lower())
    if city:
        stmt = stmt.where(func.lower(Organization.city) == city.strip().lower())
    for term in terms:
        pattern = f"%{_escape_like(term.lower())}%"
        stmt = stmt.where(
            or_(
                func.lower(Organization.name).like(pattern, escape="\\"),
                func.lower(StartupProfile.tagline).like(pattern, escape="\\"),
                func.lower(StartupProfile.sector).like(pattern, escape="\\"),
                func.lower(Organization.city).like(pattern, escape="\\"),
                func.lower(Organization.summary).like(pattern, escape="\\"),
                func.lower(StartupProfile.problem).like(pattern, escape="\\"),
                func.lower(StartupProfile.solution).like(pattern, escape="\\"),
            )
        )
    return stmt


def _ordering(sort: str, order: str) -> list[Any]:
    # A sort column is an arbitrary SQL expression (lower(name), a CASE
    # rank, or a plain timestamp column) — the union has no common type.
    column: Any
    if sort == "name":
        column = func.lower(Organization.name)
    elif sort == "stage":
        # Stage is a text column with a CHECK, not a PG enum, so lexicographic
        # order would be wrong ('early_revenue' < 'idea' < 'mature' <
        # 'prototype'). Rank it by the enum's declaration order instead.
        column = case(
            *[
                (StartupProfile.stage == s.value, rank)
                for rank, s in enumerate(StartupStage)
            ],
            else_=len(StartupStage),
        )
    else:  # "recent" (default): most recently updated profile first.
        column = StartupProfile.updated_at

    primary = column.desc() if order == "desc" else column.asc()
    # Stable tiebreaks: updated_at collides on seeded rows and stage repeats
    # constantly, so offset pagination would otherwise repeat/skip rows.
    return [primary, func.lower(Organization.name).asc(), Organization.id.asc()]


def _item(
    org: Organization, profile: StartupProfile, *, visible: bool
) -> StartupDiscoveryItem:
    sections = startup_profile_service.section_values(org, profile, visible=visible)
    return StartupDiscoveryItem(
        slug=org.slug,
        name=org.name,
        tagline=profile.tagline,
        stage=profile.stage,
        sector=profile.sector,
        city=org.city,
        founded_year=org.founded_year,
        website=org.website,
        mentor_verified=profile.mentor_verified,
        readiness_score=sections["readiness_score"],
        summary=sections["summary"],
        traction_summary=sections["traction_summary"],
    )


async def list_startups(
    db: AsyncSession,
    user: User | None,
    *,
    limit: int,
    offset: int,
    sort: str,
    order: str,
    stage: StartupStage | None = None,
    sector: str | None = None,
    city: str | None = None,
    q: str | None = None,
) -> StartupDiscoveryPage:
    """Filtered, paginated startup discovery for the given viewer."""
    viewer = await _resolve_viewer(db, user)
    terms = _terms(q)

    filtered = _apply_filters(
        _base_query(viewer), stage=stage, sector=sector, city=city, terms=terms
    )
    total = (
        await db.execute(select(func.count()).select_from(filtered.subquery()))
    ).scalar_one()

    stmt = filtered.order_by(*_ordering(sort, order)).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).all()

    items = [
        # Rows reached through a membership are always "visible" to that
        # member even when the profile is private (own workspace data);
        # section toggles still apply, so the member sees exactly what the
        # preview endpoint shows them.
        _item(org, profile, visible=True)
        for org, profile in rows
    ]
    return StartupDiscoveryPage(items=items, total=total, limit=limit, offset=offset)


async def get_startup(
    db: AsyncSession,
    user: User,
    identifier: str,
) -> StartupDiscoveryDetail | None:
    """Get full startup discovery details for an authenticated user.

    Visibility adheres to the same caller audience matrix as discovery list.
    If the viewer has no permission or the startup does not exist / is not active,
    returns None (404 without existence leakage).
    """
    viewer = await _resolve_viewer(db, user)

    conditions = [func.lower(Organization.slug) == identifier.strip().lower()]
    try:
        parsed_uuid = uuid.UUID(identifier)
        conditions.append(Organization.id == parsed_uuid)
    except (ValueError, AttributeError):
        pass

    stmt = (
        select(Organization, StartupProfile)
        .join(StartupProfile, StartupProfile.org_id == Organization.id)
        .where(
            Organization.type == OrgType.startup,
            Organization.status == "active",
            Organization.deleted_at.is_(None),
            or_(*conditions),
            _visible_clause(viewer),
        )
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return None

    org, profile = row
    is_member = org.id in viewer.member_org_ids
    sections = startup_profile_service.section_values(org, profile, visible=True)

    # Check for mentorship relationship if viewer is a mentor
    existing_mentorship_id: uuid.UUID | None = None
    existing_mentorship_status: str | None = None

    mentorship_stmt = (
        select(Mentorship.id, Mentorship.status)
        .where(
            Mentorship.mentor_id == user.id,
            Mentorship.startup_org_id == org.id,
        )
        .order_by(Mentorship.created_at.desc())
        .limit(1)
    )
    mentorship_row = (await db.execute(mentorship_stmt)).first()
    if mentorship_row is not None:
        existing_mentorship_id = mentorship_row[0]
        status_val = mentorship_row[1]
        existing_mentorship_status = (
            status_val.value if hasattr(status_val, "value") else str(status_val)
        )

    demo_url = profile.demo_url if (profile.summary_public or is_member) else None
    pitch_deck_url = (
        profile.pitch_deck_url if (profile.funding_public or is_member) else None
    )

    return StartupDiscoveryDetail(
        id=org.id,
        slug=org.slug,
        name=org.name,
        logo_url=org.logo_url,
        tagline=profile.tagline,
        stage=profile.stage,
        sector=profile.sector,
        city=org.city,
        region=org.region,
        country=org.country,
        founded_year=org.founded_year,
        website=org.website,
        mentor_verified=profile.mentor_verified,
        readiness_score=sections["readiness_score"],
        summary=sections["summary"],
        business_model=sections["business_model"],
        problem=sections["problem"],
        solution=sections["solution"],
        market=sections["market"],
        traction_summary=sections["traction_summary"],
        ecosystem_goals=list(profile.ecosystem_goals or []),
        demo_url=demo_url,
        pitch_deck_url=pitch_deck_url,
        existing_mentorship_id=existing_mentorship_id,
        existing_mentorship_status=existing_mentorship_status,
        is_member=is_member,
    )

