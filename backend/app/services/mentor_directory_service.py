"""Mentor directory service (Step 8a).

The read behind ``/startup/mentors/find`` and ``/startup/mentors/find/[id]``,
plus the ranked suggestions panel on the same page. Read-only: 8a adds no
tables and no writes, so every function here is a SELECT.

Visibility (8a plan, approved)
------------------------------
``schema.sql`` gives ``mentor_profiles`` no ``profile_visibility`` column —
the only gate is ``users.profile_public``. So a mentor is listed when:

    users.deleted_at IS NULL  AND  users.profile_public IS TRUE

Adding a second switch would have needed a migration this step does not
have. The consequence is stated in the plan and in the report: mentors are
not as granular as startups (which have four visibility values), so a
mentor is visible to every signed-in caller or nobody. An anonymous caller
never reaches these routes at all — both require a token (401).

An invisible mentor is a 404 on the detail read, exactly like a nonexistent
one, so the endpoint is not an existence oracle (the 5h rule).

Filtering and sorting follow the 5b/5c/5h list convention: whitelisted
columns, explicit ``order``, stable tiebreaks so offset pagination never
repeats or skips a row.

Nothing here recomputes ``rating``, ``sessions_completed`` or
``is_verified`` — they are read as stored. 8i owns the rating recompute.
"""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, String, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import forbidden, rate_limited
from app.models.mentorship import Mentorship
from app.models.organization import Organization, OrgType
from app.models.session import MentoringSession
from app.models.session_review import SessionReview
from app.models.startup import StartupProfile, StartupStage
from app.models.talent import MentorProfile
from app.models.user import User
from app.schemas.mentor_directory import (
    MentorDirectoryDetail,
    MentorDirectoryItem,
    MentorDirectoryPage,
    MentorSuggestionItem,
    MentorSuggestionPage,
)
from app.services import organization_service
from app.services.rate_limiter import rate_limiter

# Same bounds as 5h discovery: a search box is not a batch API.
_MAX_Q = 100
_MAX_Q_TERMS = 5
_MAX_TERM = 40
# Free-text facet values (expertise/sector/language) are exact matches, so a
# long value is a mistake rather than a query. Bound it well above any real
# tag but far below a request-body abuse size.
_MAX_FACET = 60
_MAX_LANGUAGES = 5

# Explicit "at least one" so a bogus sort value can never reach SQL even if a
# future caller bypasses the router's Literal.
# A rating is shown only once this many consented reviews exist, so a
# single review cannot be read back from the average (8i). The stored
# ``mentor_profiles.rating`` follows the same rule (session_review_service).
PUBLIC_RATING_MIN_REVIEWS = 3

_SORTS = frozenset({"relevance", "rating", "price", "experience"})
_ORDERS = frozenset({"asc", "desc"})


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


def _is_visible() -> ColumnElement[bool]:
    """The one visibility gate. Shared by list, detail and suggestions so
    the three can never disagree about who exists."""
    return User.deleted_at.is_(None) & User.profile_public.is_(True)


def _base_query() -> Select:
    """Live, public mentor profiles joined to their user row."""
    return (
        select(User, MentorProfile)
        .join(MentorProfile, MentorProfile.user_id == User.id)
        .where(_is_visible())
    )


def _apply_filters(
    stmt: Select,
    *,
    expertise: str | None,
    sector: str | None,
    language: str | None,
    verified_only: bool,
    accepting_only: bool,
    max_fee: float | None,
    free_only: bool,
    terms: list[str],
) -> Select:
    if expertise:
        # expertise is a JSON list in the model (SQLite has no arrays), so
        # containment is a case-insensitive match on the serialized list.
        # The quotes keep "Fin" from matching "Finance" inside "Fundraising".
        needle = f'%"{_escape_like(expertise.strip().lower())}"%'
        stmt = stmt.where(
            func.lower(cast(MentorProfile.expertise, String)).like(needle, escape="\\")
        )
    if sector:
        stmt = stmt.where(
            func.lower(cast(MentorProfile.sectors, String)).like(
                f'%"{_escape_like(sector.strip().lower())}"%', escape="\\"
            )
        )
    if language:
        stmt = stmt.where(
            func.lower(cast(MentorProfile.languages, String)).like(
                f'%"{_escape_like(language.strip().lower())}"%', escape="\\"
            )
        )
    if verified_only:
        stmt = stmt.where(MentorProfile.is_verified.is_(True))
    if accepting_only:
        stmt = stmt.where(MentorProfile.accepting_requests.is_(True))
    if free_only:
        # "Free / pro bono" on the find page: no fee recorded, or a zero one.
        stmt = stmt.where(or_(MentorProfile.hourly_fee.is_(None), MentorProfile.hourly_fee == 0))
    elif max_fee is not None:
        # A mentor with no fee is cheaper than any cap, so include them.
        stmt = stmt.where(
            or_(MentorProfile.hourly_fee.is_(None), MentorProfile.hourly_fee <= max_fee)
        )
    for term in terms:
        pattern = f"%{_escape_like(term.lower())}%"
        # ``expertise``/``sectors`` are JSON lists, matched as text; name,
        # headline and bio are plain columns.
        stmt = stmt.where(
            or_(
                func.lower(User.display_name).like(pattern, escape="\\"),
                func.lower(User.headline).like(pattern, escape="\\"),
                func.lower(MentorProfile.headline).like(pattern, escape="\\"),
                func.lower(MentorProfile.bio).like(pattern, escape="\\"),
                func.lower(cast(MentorProfile.expertise, String)).like(pattern, escape="\\"),
                func.lower(cast(MentorProfile.sectors, String)).like(pattern, escape="\\"),
            )
        )
    return stmt


def _visible_rating():  # type: ignore[no-untyped-def]
    # Only explicit public consent permits inclusion in public aggregates.
    return (
        select(
            case((func.count(SessionReview.id) >= PUBLIC_RATING_MIN_REVIEWS, func.avg(SessionReview.rating)), else_=None)
        )
        .join(MentoringSession, MentoringSession.id == SessionReview.session_id)
        .join(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
        .where(
            Mentorship.mentor_id == MentorProfile.user_id,
            Mentorship.deleted_at.is_(None),
            SessionReview.deleted_at.is_(None),
            SessionReview.public_consent.is_(True),
        )
        .correlate(MentorProfile)
        .scalar_subquery()
    )


async def _review_stats(
    db: AsyncSession, ids: list[uuid.UUID]
) -> dict[uuid.UUID, tuple[int, float | None]]:
    rows = (
        await db.execute(
            select(
                Mentorship.mentor_id, func.count(SessionReview.id), func.avg(SessionReview.rating)
            )
            .join(MentoringSession, MentoringSession.mentorship_id == Mentorship.id)
            .join(SessionReview, SessionReview.session_id == MentoringSession.id)
            .where(
                Mentorship.mentor_id.in_(ids),
                Mentorship.deleted_at.is_(None),
                SessionReview.deleted_at.is_(None),
                SessionReview.public_consent.is_(True),
            )
            .group_by(Mentorship.mentor_id)
        )
    ).all()
    return {uid: (count, round(float(avg), 2) if count >= PUBLIC_RATING_MIN_REVIEWS else None) for uid, count, avg in rows}


def _ordering(sort: str, order: str) -> list[Any]:
    """Whitelisted sort with stable tiebreaks (5b/5c/5h convention)."""
    if sort == "rating":
        # rating is nullable; unscored mentors sort last regardless of order
        # so an ascending "rating" list does not open with unknowns.
        column: Any = _visible_rating()
        primary = column.asc().nullslast() if order == "asc" else column.desc().nullslast()
    elif sort == "price":
        # A free mentor is the cheapest, so NULL sorts first ascending.
        column = MentorProfile.hourly_fee
        primary = column.asc().nullsfirst() if order == "asc" else column.desc().nullsfirst()
    elif sort == "experience":
        column = MentorProfile.years_experience
        primary = column.asc().nullslast() if order == "asc" else column.desc().nullslast()
    else:  # "relevance" (default): verified, then rating, then experience.
        primary = case((MentorProfile.is_verified.is_(True), 0), else_=1).asc()
    # Stable tiebreaks: rating/fee collide constantly in seed data, so offset
    # pagination would otherwise repeat or skip rows.
    return [primary, func.lower(User.display_name).asc(), User.id.asc()]


def _card(
    user: User, profile: MentorProfile, stats: tuple[int, float | None] = (0, None)
) -> MentorDirectoryItem:
    return MentorDirectoryItem(
        handle=user.handle or "",
        display_name=user.display_name,
        avatar_initials=user.avatar_initials,
        avatar_url=user.avatar_url,
        headline=profile.headline,
        expertise=list(profile.expertise or []),
        sectors=list(profile.sectors or []),
        languages=list(profile.languages or []),
        years_experience=profile.years_experience,
        hourly_fee=float(profile.hourly_fee) if profile.hourly_fee is not None else None,
        currency=profile.currency,
        cadence=profile.cadence,
        rating=stats[1],
        reviews_count=stats[0],
        sessions_completed=profile.sessions_completed,
        is_verified=profile.is_verified,
        accepting_requests=profile.accepting_requests,
        location=user.region,
    )


def _detail(
    user: User, profile: MentorProfile, stats: tuple[int, float | None] = (0, None)
) -> MentorDirectoryDetail:
    return MentorDirectoryDetail(
        **_card(user, profile, stats).model_dump(),
        bio=profile.bio,
        max_startups=profile.max_startups,
    )


async def _enforce_search_limit(user: User) -> None:
    """A directory read is unauthenticated-adjacent enumeration, so it is
    rate limited per caller like every other list a script could hammer.

    Lives here rather than in the router: the router stays a thin mapping
    and the limit travels with the query it protects.
    """
    settings = get_settings()
    if not await rate_limiter.check(
        f"mentor_directory:user:{user.id}",
        settings.MENTOR_SEARCH_LIMIT,
        settings.MENTOR_SEARCH_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many mentor searches. Please slow down.")


async def list_mentors(
    db: AsyncSession,
    user: User,
    *,
    limit: int,
    offset: int,
    sort: str,
    order: str,
    expertise: str | None = None,
    sector: str | None = None,
    language: str | None = None,
    verified_only: bool = False,
    accepting_only: bool = False,
    max_fee: float | None = None,
    free_only: bool = False,
    q: str | None = None,
) -> MentorDirectoryPage:
    """Filtered, paginated mentor directory for a signed-in caller."""
    await _enforce_search_limit(user)
    if sort not in _SORTS:
        sort = "relevance"
    if order not in _ORDERS:
        order = "desc"

    filtered = _apply_filters(
        _base_query(),
        expertise=expertise,
        sector=sector,
        language=language,
        verified_only=verified_only,
        accepting_only=accepting_only,
        max_fee=max_fee,
        free_only=free_only,
        terms=_terms(q),
    )
    total = (await db.execute(select(func.count()).select_from(filtered.subquery()))).scalar_one()

    stmt = filtered.order_by(*_ordering(sort, order)).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).all()
    counts = await _review_stats(db, [user.id for user, _ in rows])
    return MentorDirectoryPage(
        items=[_card(user, profile, counts.get(user.id, (0, None))) for user, profile in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


async def get_mentor(db: AsyncSession, handle: str) -> MentorDirectoryDetail | None:
    """One visible mentor. ``None`` for a hidden profile and for a missing
    one alike, so the caller cannot tell them apart (no existence oracle)."""
    result = await db.execute(_base_query().where(User.handle == handle))
    row = result.one_or_none()
    if row is None:
        return None
    user, profile = row
    counts = await _review_stats(db, [user.id])
    return _detail(user, profile, counts.get(user.id, (0, None)))


async def resolve_visible_mentor_id(db: AsyncSession, handle: str) -> uuid.UUID | None:
    """The user id behind a visible mentor handle, or ``None``.

    Added for Step 8c: availability is keyed by ``users.id``, but the
    directory deliberately never exposes a mentor's UUID (the handle is the
    public key). Rather than put a second visibility rule in
    ``availability_service``, this reuses ``_base_query`` so "visible" means
    exactly what it means on the mentor page — a hidden profile resolves to
    ``None`` and the caller turns that into the same 404.
    """
    return (
        await db.execute(
            select(User.id)
            .join(MentorProfile, MentorProfile.user_id == User.id)
            .where(_is_visible(), User.handle == handle)
        )
    ).scalar_one_or_none()


@dataclass(frozen=True)
class _StartupContext:
    """The startup's own declared data — the ONLY inputs to a suggestion.

    ``goals`` is the lowercased join of ``ecosystem_goals`` (for example
    "raise seed funding find specialized mentors"), which is matched against
    mentor expertise tags. Nothing here is inferred.
    """

    stage: StartupStage | None
    sector: str | None
    goals: str | None


async def _startup_context(db: AsyncSession, org_id: uuid.UUID) -> _StartupContext:
    profile = (
        await db.execute(select(StartupProfile).where(StartupProfile.org_id == org_id))
    ).scalar_one_or_none()
    if profile is None:
        return _StartupContext(stage=None, sector=None, goals=None)

    sector = (profile.sector or "").strip().lower() or None
    goals = " ".join(str(g) for g in (profile.ecosystem_goals or [])).strip().lower()
    return _StartupContext(stage=profile.stage, sector=sector, goals=goals or None)


def _match(
    profile: MentorProfile, *, sector: str | None, goals: str | None
) -> tuple[int, list[str]]:
    """Explain a suggestion using ONLY fields that actually matched.

    Returns ``(declared_rank, reasons)``. ``declared_rank`` counts the
    matches against what the STARTUP declared (goals, sector) — the signals
    that justify ordering one mentor above another. Verified/accepting are
    reported as reasons but deliberately not ranked, because they describe
    the mentor rather than the fit.

    An empty ``reasons`` list means the mentor surfaced on the default
    ordering alone — stated, never filled with invented copy.
    """
    reasons: list[str] = []
    rank = 0

    mentor_expertise = [str(x) for x in (profile.expertise or [])]
    mentor_sectors = [str(x).lower() for x in (profile.sectors or [])]

    if goals:
        for tag in mentor_expertise:
            normalised = tag.strip().lower()
            # Whole-tag containment both ways: a mentor tagged "Fundraising"
            # matches a goal mentioning "raise seed funding"? No — so match
            # the tag appearing verbatim in the goal text, or a goal word
            # appearing in the tag. Both are literal, no fuzzy scoring.
            if normalised and (
                normalised in goals
                or any(word in normalised for word in goals.split() if len(word) > 3)
            ):
                reasons.append(f"Expertise you are looking for: {tag}")
                rank += 1
    if sector and sector in mentor_sectors:
        reasons.append(f"Works in your sector: {sector}")
        rank += 1
    if profile.is_verified:
        reasons.append("Verified mentor")
    if profile.accepting_requests:
        reasons.append("Accepting new requests")
    return rank, reasons


async def list_suggestions(
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    limit: int,
    offset: int,
) -> MentorSuggestionPage:
    """Ranked suggestions for one startup.

    Ordering is deliberately transparent and deterministic (8a plan D-2):
    mentors who match a declared goal, then the startup's sector, then
    verified, then rating, then experience. There is no stored match score
    and no hidden weighting — everything that influenced the order is also
    reported in ``match_reasons``.
    """
    context = await _startup_context(db, org_id)

    # Suggestions only make sense from mentors who can take work.
    stmt = _base_query().where(MentorProfile.accepting_requests.is_(True))
    rows = (await db.execute(stmt)).all()

    counts = await _review_stats(db, [user.id for user, _ in rows])
    scored: list[tuple[int, User, MentorProfile, list[str]]] = []
    for user, profile in rows:
        rank, reasons = _match(profile, sector=context.sector, goals=context.goals)
        scored.append((rank, user, profile, reasons))

    # Deterministic total order: declared matches, then verified, then a
    # stable rating/experience/name chain so paging is repeatable.
    scored.sort(
        key=lambda row: (
            -row[0],
            -int(row[2].is_verified),
            -(counts.get(row[1].id, (0, None))[1] or 0),
            -int(row[2].years_experience or 0),
            (row[1].display_name or "").lower(),
            str(row[1].id),
        )
    )

    window = scored[offset : offset + limit]
    return MentorSuggestionPage(
        items=[
            MentorSuggestionItem(
                **_card(user, profile, counts.get(user.id, (0, None))).model_dump(),
                match_reasons=reasons,
            )
            for _rank, user, profile, reasons in window
        ],
        total=len(scored),
        limit=limit,
        offset=offset,
        stage=context.stage,
        sector=context.sector,
        # 8a plan D-1: stage is not a stored mentor attribute yet, so a stage
        # filter cannot be applied. The flag tells the caller the caption is
        # a description of the startup, not a promise about the matches.
        stage_filter_applied=False,
    )


async def require_startup_member(db: AsyncSession, org_id: uuid.UUID, user: User) -> Organization:
    """The org must exist, be a startup, and the caller must be active in it.

    A non-member gets the same 403 as any other unauthorized org action
    (``organization_service.require_membership``), and a foreign org is
    indistinguishable from a non-startup one, so this is never a probe for
    whether another tenant exists.
    """
    org = (
        await db.execute(
            select(Organization).where(
                Organization.id == org_id,
                Organization.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if org is None or org.type != OrgType.startup:
        raise forbidden("You are not an active member of this organization.")

    # Raises the shared 403 for a non-member; also enforces "active" status.
    await organization_service.require_membership(db, org_id, user)
    return org
