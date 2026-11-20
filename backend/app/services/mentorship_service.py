"""Step 8b service: mentorship requests and engagements.

The state machine lives here, not in the router (AGENTS.md section 3):

::

    requested --accept--> active --pause--> paused --resume--> active
        |                    |                                |
        |                    +--> completed (end)             +--> completed
        +--decline--> declined
        +--cancel-->  cancelled   (either side, before/after accept)

Every transition is a named function, so an illegal move is a 409 with a
stable code rather than a silently ignored field write.

Authorization, in one place per operation:

- A startup **member** (owner/admin/member — never viewer) may request,
  revise, cancel and end from the startup side.
- The **mentor** named on the row may accept, decline, pause, resume,
  cancel and end.
- Any active member of the startup, viewers included, may READ.
- Everyone else gets 404, not 403: a mentorship's existence is not
  something an outsider should be able to probe (8a's rule, kept).
"""

import uuid
from datetime import date

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    conflict,
    forbidden,
    not_found,
    rate_limited,
    validation_error,
)
from app.models.activity import ActivityEventType
from app.models.mentorship import BUSY_STATUSES, Mentorship, MentorshipStatus
from app.models.organization import Organization, OrganizationMember, OrgRole
from app.models.startup import StartupProfile
from app.models.talent import MentorProfile
from app.models.user import User
from app.schemas.mentorship import (
    MentorshipCreate,
    MentorshipParticipant,
    MentorshipRead,
    MentorshipUpdate,
)
from app.services import activity_service, rate_limiter

# Roles that may WRITE from the startup side. Viewers are read-only
# everywhere in the product (5d/5g/8a precedent).
STARTUP_WRITERS: frozenset[OrgRole] = frozenset(
    {OrgRole.owner, OrgRole.admin, OrgRole.member}
)

# Statuses an end-user may still act on.
OPEN_STATUSES: frozenset[MentorshipStatus] = frozenset(
    {MentorshipStatus.requested, MentorshipStatus.active, MentorshipStatus.paused}
)


# ------------------------------------------------------------------ helpers


async def _enforce_request_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"mentorship_request:user:{user.id}",
        settings.MENTORSHIP_REQUEST_LIMIT,
        settings.MENTORSHIP_REQUEST_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many mentorship requests. Please slow down.")


async def _enforce_action_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"mentorship_action:user:{user.id}",
        settings.MENTORSHIP_ACTION_LIMIT,
        settings.MENTORSHIP_ACTION_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many actions on mentorships. Please slow down.")


def _initials(name: str | None) -> str:
    parts = [p for p in (name or "?").split() if p]
    return "".join(p[0] for p in parts[:2]).upper() or "?"


async def _startup_role(
    db: AsyncSession, org_id: uuid.UUID, user: User
) -> OrgRole | None:
    """The caller's role in ``org_id`` if they are an ACTIVE member."""
    row = (
        await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == "active",
            )
        )
    ).scalar_one_or_none()
    return row


async def _participant_names(
    db: AsyncSession, rows: list[Mentorship]
) -> dict[uuid.UUID, tuple[str, str | None]]:
    """Bulk-load display names so the list never N+1s (AGENTS.md section 5).

    Returns ``{user_id: (display_name, handle)}`` for both mentors and the
    startups' member users in one query.
    """
    user_ids = {r.mentor_id for r in rows}
    names: dict[uuid.UUID, tuple[str, str | None]] = {}
    if user_ids:
        for uid, display, handle in (
            await db.execute(
                select(User.id, User.display_name, User.handle).where(
                    User.id.in_(user_ids)
                )
            )
        ).all():
            names[uid] = (display, handle)
    return names


def _read(
    row: Mentorship,
    *,
    mentor_name: tuple[str, str | None] | None,
    startup: Organization,
    startup_profile: StartupProfile | None,
    viewer_side: str,
    viewer_role: OrgRole | None,
) -> MentorshipRead:
    mentor_display, mentor_handle = mentor_name or ("Mentor", None)
    return MentorshipRead(
        id=row.id,
        status=MentorshipStatus(row.status),
        mentor_id=row.mentor_id,
        startup_org_id=row.startup_org_id,
        goal=row.goal,
        needs=list(row.needs or []),
        cadence=row.cadence,
        terms=row.terms,
        equity_pct=row.equity_pct,
        fee_amount=row.fee_amount,
        currency=row.currency,
        health=row.health,
        started_on=row.started_on,
        ended_on=row.ended_on,
        last_session_at=row.last_session_at,
        next_session_at=row.next_session_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
        mentor=MentorshipParticipant(
            user_id=row.mentor_id,
            display_name=mentor_display,
            handle=mentor_handle,
            avatar_initials=_initials(mentor_display),
        ),
        startup=MentorshipParticipant(
            user_id=row.startup_org_id,  # an org id, not a user; see schema
            display_name=startup.name,
            handle=startup.slug,
            avatar_initials=_initials(startup.name),
            stage=startup_profile.stage if startup_profile else None,
            sector=startup_profile.sector if startup_profile else None,
            city=startup.city,
            tagline=startup_profile.tagline if startup_profile else None,
        ),
        viewer_side=viewer_side,  # type: ignore[arg-type]
        viewer_role=viewer_role.value if viewer_role else None,  # type: ignore[arg-type]
    )


async def _resolve_viewer(
    db: AsyncSession, row: Mentorship, user: User
) -> tuple[str, OrgRole | None]:
    """Which side the caller is on, or 404 if they are neither.

    404 (not 403) on purpose: an outsider must not learn the row exists.
    """
    if row.mentor_id == user.id:
        return "mentor", None
    role = await _startup_role(db, row.startup_org_id, user)
    if role is None:
        raise not_found("Mentorship not found.")
    return "startup", role


async def require_can_read(db: AsyncSession, row: Mentorship, user: User) -> None:
    """Raise the 404 unless the caller may read this mentorship.

    Public wrapper used by Step 8d: a session's read permission IS its
    mentorship's read permission, so the rule stays in one place instead of
    being re-implemented in ``session_service``.
    """
    await _resolve_viewer(db, row, user)


async def _load_startup(db: AsyncSession, org_id: uuid.UUID) -> Organization:
    """The startup org, or the same 404 an outsider gets for the row."""
    org = (
        await db.execute(
            select(Organization).where(
                Organization.id == org_id, Organization.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if org is None:
        raise not_found("Mentorship not found.")
    return org


async def _load_profiles(
    db: AsyncSession, org_ids: set[uuid.UUID]
) -> dict[uuid.UUID, StartupProfile]:
    """Bulk-load startup profiles so a list never N+1s.

    A startup with no profile row yet simply has no entry: its stage,
    sector and tagline render as unknown rather than as invented values.
    """
    if not org_ids:
        return {}
    rows = (
        await db.execute(select(StartupProfile).where(StartupProfile.org_id.in_(org_ids)))
    ).scalars()
    return {row.org_id: row for row in rows}


async def _load_startup_with_profile(
    db: AsyncSession, org_id: uuid.UUID
) -> tuple[Organization, StartupProfile | None]:
    org = await _load_startup(db, org_id)
    profiles = await _load_profiles(db, {org_id})
    return org, profiles.get(org_id)


async def get_row(db: AsyncSession, mentorship_id: uuid.UUID) -> Mentorship:
    row = (
        await db.execute(
            select(Mentorship).where(
                Mentorship.id == mentorship_id, Mentorship.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Mentorship not found.")
    return row


async def _as_read(db: AsyncSession, row: Mentorship, user: User) -> MentorshipRead:
    side, role = await _resolve_viewer(db, row, user)
    startup, profile = await _load_startup_with_profile(db, row.startup_org_id)
    names = await _participant_names(db, [row])
    return _read(
        row,
        mentor_name=names.get(row.mentor_id),
        startup=startup,
        startup_profile=profile,
        viewer_side=side,
        viewer_role=role,
    )


# ------------------------------------------------------------------- create


async def create(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: MentorshipCreate
) -> MentorshipRead:
    """A startup member asks a mentor to work with them."""
    await _enforce_request_limit(user)

    # 1. The caller must be a WRITING member of a real startup org. This is
    #    the same check 8a's suggestions use, so "which orgs may request"
    #    cannot drift between the two.
    from app.services.mentor_directory_service import require_startup_member

    await require_startup_member(db, org_id, user)
    role = await _startup_role(db, org_id, user)
    if role not in STARTUP_WRITERS:
        raise forbidden("Viewers cannot request mentorship.")

    # 2. The target must be a mentor who is accepting. A user with no
    #    mentor profile is a 422 on the field, not a 404 — they exist, they
    #    are just not a mentor.
    mentor_id = payload.mentor_id
    if mentor_id is None:
        from app.services.mentor_directory_service import resolve_visible_mentor_id

        resolved = await resolve_visible_mentor_id(db, payload.mentor_handle or "")
        if resolved is None:
            raise not_found("Mentor not found.")
        mentor_id = resolved

    profile = (
        await db.execute(
            select(MentorProfile).where(MentorProfile.user_id == mentor_id)
        )
    ).scalar_one_or_none()
    if profile is None:
        raise validation_error(
            "That user is not a mentor.",
            details=[
                {
                    "loc": ["body", "mentor_id"],
                    "msg": "That user is not a mentor.",
                    "type": "value_error",
                }
            ],
        )
    if not profile.accepting_requests:
        raise conflict(
            "This mentor is not accepting new requests.", code="MENTOR_NOT_ACCEPTING"
        )
    mentor_user = (
        await db.execute(select(User).where(User.id == mentor_id))
    ).scalar_one_or_none()
    if mentor_user is None or mentor_user.deleted_at is not None:
        raise not_found("Mentor not found.")

    # 3. One active mentorship per pair. The partial unique index is the
    #    real guard; this pre-check turns the common case into a clean 409
    #    instead of an IntegrityError round trip.
    existing = (
        await db.execute(
            select(Mentorship.id).where(
                Mentorship.mentor_id == mentor_id,
                Mentorship.startup_org_id == org_id,
                Mentorship.deleted_at.is_(None),
                Mentorship.status.in_([s.value for s in BUSY_STATUSES]),
            )
        )
    ).first()
    if existing is not None:
        raise conflict(
            "There is already an open mentorship with this mentor.",
            code="MENTORSHIP_EXISTS",
        )

    row = Mentorship(
        mentor_id=mentor_id,
        startup_org_id=org_id,
        status=MentorshipStatus.requested,
        goal=payload.goal,
        needs=list(payload.needs),
        cadence=payload.cadence,
        terms=payload.terms,
        equity_pct=payload.equity_pct,
        fee_amount=payload.fee_amount,
        currency=payload.currency,
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError:
        # Lost the race against a concurrent request for the same pair.
        await db.rollback()
        raise conflict(
            "There is already an open mentorship with this mentor.",
            code="MENTORSHIP_EXISTS",
        ) from None

    activity_service.record(
        db,
        event_type=ActivityEventType.mentorship_requested,
        summary=f"{user.display_name} requested mentorship from {mentor_user.display_name}.",
        org_id=org_id,
        actor_id=user.id,
        entity_type="mentorship",
        entity_id=row.id,
    )
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, user)


# --------------------------------------------------------------------- read


def _list_query(user: User, *, side: str, status_filter: list[str] | None) -> Select:
    """The base list for one side of the marketplace.

    ``side='mentor'``  -> rows where the caller IS the mentor.
    ``side='startup'`` -> rows in orgs the caller is an active member of.
                        Membership is enforced in SQL, so a caller can
                        never list another tenant's rows.
    """
    q = select(Mentorship).where(Mentorship.deleted_at.is_(None))
    if side == "mentor":
        q = q.where(Mentorship.mentor_id == user.id)
    else:
        member_orgs = select(OrganizationMember.org_id).where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == "active",
        )
        q = q.where(Mentorship.startup_org_id.in_(member_orgs))
    if status_filter:
        q = q.where(Mentorship.status.in_(status_filter))
    return q


async def list_mentorships(
    db: AsyncSession,
    user: User,
    *,
    side: str,
    limit: int,
    offset: int,
    status_filter: list[str] | None,
    org_id: uuid.UUID | None = None,
) -> tuple[list[MentorshipRead], int]:
    q = _list_query(user, side=side, status_filter=status_filter)
    if org_id is not None:
        # Narrowing to one org still passes through the membership filter
        # above, so this cannot widen access — it can only narrow it.
        if side == "startup":
            q = q.where(Mentorship.startup_org_id == org_id)
        else:
            q = q.where(Mentorship.startup_org_id == org_id)

    total = (
        await db.execute(select(func.count()).select_from(q.subquery()))
    ).scalar_one()
    rows = list(
        (
            await db.execute(
                q.order_by(Mentorship.created_at.desc(), Mentorship.id).limit(limit).offset(offset)
            )
        )
        .scalars()
        .all()
    )

    names = await _participant_names(db, rows)
    org_ids = {r.startup_org_id for r in rows}
    orgs: dict[uuid.UUID, Organization] = {}
    if org_ids:
        for found in (
            (await db.execute(select(Organization).where(Organization.id.in_(org_ids))))
            .scalars()
            .all()
        ):
            orgs[found.id] = found
    profiles = await _load_profiles(db, org_ids)

    items = []
    for row in rows:
        startup = orgs.get(row.startup_org_id)
        if startup is None:  # pragma: no cover - FK guarantees it exists
            continue
        side_, role = await _resolve_viewer(db, row, user)
        items.append(
            _read(
                row,
                mentor_name=names.get(row.mentor_id),
                startup=startup,
                startup_profile=profiles.get(row.startup_org_id),
                viewer_side=side_,
                viewer_role=role,
            )
        )
    return items, total


async def get_one(db: AsyncSession, user: User, mentorship_id: uuid.UUID) -> MentorshipRead:
    row = await get_row(db, mentorship_id)
    return await _as_read(db, row, user)


# ------------------------------------------------------------------ update


async def update_request(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, payload: MentorshipUpdate
) -> MentorshipRead:
    """The startup revises its own request, while it is still a request."""
    row = await get_row(db, mentorship_id)
    role = await _startup_role(db, row.startup_org_id, user)
    if role is None:
        # A mentor may not rewrite the startup's request.
        raise not_found("Mentorship not found.")
    if role not in STARTUP_WRITERS:
        raise forbidden("Viewers cannot edit a mentorship request.")
    if row.status != MentorshipStatus.requested.value:
        raise conflict(
            "Only a pending request can be edited.", code="INVALID_STATE"
        )

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, user)


# ------------------------------------------------------------- transitions


async def _transition(
    db: AsyncSession,
    user: User,
    mentorship_id: uuid.UUID,
    *,
    allowed_from: set[MentorshipStatus],
    to: MentorshipStatus,
    side: str,
    note: str | None = None,
) -> MentorshipRead:
    """Shared guard for every transition: who, from what, to what."""
    await _enforce_action_limit(user)
    row = await get_row(db, mentorship_id)

    caller_side, role = await _resolve_viewer(db, row, user)
    if caller_side != side:
        raise forbidden("Only the mentor can do that.")
    if side == "startup" and role not in STARTUP_WRITERS:
        raise forbidden("Viewers cannot change a mentorship.")

    if row.status not in {s.value for s in allowed_from}:
        raise conflict(
            f"Cannot move a mentorship from '{row.status}' to '{to.value}'.",
            code="INVALID_STATE",
        )

    row.status = to
    if to is MentorshipStatus.active and row.started_on is None:
        row.started_on = date.today()
    if to in (MentorshipStatus.completed, MentorshipStatus.cancelled):
        row.ended_on = date.today()
    if note:
        row.terms = note
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, user)


async def accept(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, note: str | None
) -> MentorshipRead:
    return await _transition(
        db,
        user,
        mentorship_id,
        allowed_from={MentorshipStatus.requested},
        to=MentorshipStatus.active,
        side="mentor",
        note=note,
    )


async def decline(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, note: str | None
) -> MentorshipRead:
    return await _transition(
        db,
        user,
        mentorship_id,
        allowed_from={MentorshipStatus.requested},
        to=MentorshipStatus.declined,
        side="mentor",
        note=note,
    )


async def cancel(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, note: str | None
) -> MentorshipRead:
    """Either side may withdraw, at any open state."""
    await _enforce_action_limit(user)
    row = await get_row(db, mentorship_id)
    caller_side, role = await _resolve_viewer(db, row, user)
    if caller_side == "startup" and role not in STARTUP_WRITERS:
        raise forbidden("Viewers cannot change a mentorship.")
    if MentorshipStatus(row.status) not in OPEN_STATUSES:
        raise conflict(
            f"Cannot cancel a mentorship that is already '{row.status}'.",
            code="INVALID_STATE",
        )
    row.status = MentorshipStatus.cancelled
    row.ended_on = date.today()
    if note:
        row.terms = note
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, user)


async def end(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, note: str | None
) -> MentorshipRead:
    """A working engagement finishes -> ``completed`` (not ``cancelled``)."""
    await _enforce_action_limit(user)
    row = await get_row(db, mentorship_id)
    caller_side, role = await _resolve_viewer(db, row, user)
    if caller_side == "startup" and role not in STARTUP_WRITERS:
        raise forbidden("Viewers cannot change a mentorship.")
    if MentorshipStatus(row.status) not in (
        OPEN_STATUSES - {MentorshipStatus.requested}
    ):
        raise conflict(
            "Only an active or paused mentorship can be ended.", code="INVALID_STATE"
        )
    row.status = MentorshipStatus.completed
    row.ended_on = date.today()
    if note:
        row.terms = note
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, user)


async def pause(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, note: str | None
) -> MentorshipRead:
    """Pause a working engagement. Either side may pause it."""
    await _enforce_action_limit(user)
    row = await get_row(db, mentorship_id)
    caller_side, role = await _resolve_viewer(db, row, user)
    if caller_side == "startup" and role not in STARTUP_WRITERS:
        raise forbidden("Viewers cannot change a mentorship.")
    if row.status != MentorshipStatus.active.value:
        raise conflict("Only an active mentorship can be paused.", code="INVALID_STATE")
    row.status = MentorshipStatus.paused
    if note:
        row.terms = note
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, user)


async def resume(
    db: AsyncSession, user: User, mentorship_id: uuid.UUID, note: str | None
) -> MentorshipRead:
    await _enforce_action_limit(user)
    row = await get_row(db, mentorship_id)
    _side, role = await _resolve_viewer(db, row, user)
    if _side == "startup" and role not in STARTUP_WRITERS:
        raise forbidden("Viewers cannot change a mentorship.")
    if row.status != MentorshipStatus.paused.value:
        raise conflict("Only a paused mentorship can be resumed.", code="INVALID_STATE")
    row.status = MentorshipStatus.active
    if note:
        row.terms = note
    await db.commit()
    await db.refresh(row)
    return await _as_read(db, row, user)


# ------------------------------------------------- existing-engagement reads


async def list_for_mentor_startups(
    db: AsyncSession, user: User, *, limit: int, offset: int
) -> tuple[list[MentorshipRead], int]:
    """``/mentor/startups`` — the mentor's own engagements, newest first.

    Only mentors have this page. A non-mentor gets an empty list rather
    than an error: they simply have no mentorships.
    """
    return await list_mentorships(
        db,
        user,
        side="mentor",
        limit=limit,
        offset=offset,
        status_filter=None,
    )


__all__ = [
    "accept",
    "cancel",
    "create",
    "decline",
    "end",
    "get_one",
    "list_mentorships",
    "list_for_mentor_startups",
    "pause",
    "resume",
    "update_request",
]
