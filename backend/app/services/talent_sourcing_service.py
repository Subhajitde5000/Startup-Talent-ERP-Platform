"""7j talent-sourcing service: search, shortlists, outreach.

Reuse of earlier steps (no parallel systems):

- Organization gate in the 7i/7g shape (``hiring_request_service`` /
  ``offer_service``): active employer/startup org (7r), hiring global
  role, active+verified user, active membership with the member floor.
  Org-prefixed routes 403 outsiders; flat shortlist routes resolve
  foreign ids as 404 (no oracle).
- Privacy gate mirrors ``talent_service.get_public`` (is_searchable AND
  profile_public) extended by the 7j plan with active + deleted_at.
- ``activity_service.record`` in the same transaction as the write;
  ``rate_limiter`` with the TALENT_* keys (search/shortlist-minute,
  outreach per-UTC-day counted from the DB).

Plan decisions encoded here:

- Search and shortlist cards expose ONLY the approved TalentCard field
  set — never email, phone, salary_expectation, summary, handle,
  avatar_url or the visibility flags.
- Private/inactive candidates are 404 on outreach and are filtered out
  of shortlist reads (indistinguishable from missing).
- Outreach status is derived from job_applications, never stored;
  UNIQUE(org, candidate, job) makes re-invites 409 ALREADY_INVITED;
  an existing application is 409 ALREADY_APPLIED (checked first — it is
  the more informative reason). Bulk invites are one transaction with a
  counts-only response; skips (privacy, dup, applied, budget) never
  fail the request.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_role
from app.core.exceptions import conflict, forbidden, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.profile import Skill
from app.models.talent import TalentProfile, TalentProfileSkill
from app.models.talent_sourcing import (
    TalentOutreach,
    TalentShortlist,
    TalentShortlistMember,
)
from app.models.user import AccountStatus, User, UserRole
from app.schemas.talent_sourcing import (
    CandidateInvitationPage,
    CandidateInvitationRead,
    OutreachBulkCreate,
    OutreachBulkResult,
    OutreachCreate,
    OutreachPage,
    OutreachRead,
    ShortlistCreate,
    ShortlistDetail,
    ShortlistMemberAdd,
    ShortlistPage,
    ShortlistRead,
    ShortlistUpdate,
    TalentCard,
    TalentSearchPage,
)
from app.services import activity_service, job_service, organization_service
from app.services.rate_limiter import rate_limiter

# Hiring global roles (7g gate, verbatim).
_EMPLOYER = require_role(UserRole.employer)
_STARTUP_HIRING = require_role(UserRole.employer, UserRole.startup)

MANAGERS = frozenset({OrgRole.owner, OrgRole.admin})
_READ_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})

# experience filter -> [low, high) years on total_experience_yrs.
_EXPERIENCE_BANDS: dict[str, tuple[float, float | None]] = {
    "mid": (2.0, 5.0),
    "senior": (5.0, 8.0),
    "lead": (8.0, None),
}


async def _authorize(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> OrganizationMember:
    """Org-prefixed gate without a budget — each handler applies its own
    TALENT_* limit (three budgets in this step, one gate)."""
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    return await organization_service.require_membership(
        db, org.id, user, roles=set(_READ_ROLES)
    )


async def _limit_search(user: User) -> None:
    settings = get_settings()
    ok = await rate_limiter.check(
        f"talent_search:{user.id}", settings.TALENT_SEARCH_LIMIT, 60
    )
    if not ok:
        raise rate_limited("Too many talent searches. Please try again later.")


async def _limit_shortlist_write(user: User) -> None:
    settings = get_settings()
    ok = await rate_limiter.check(
        f"talent_shortlist_write:{user.id}",
        settings.TALENT_SHORTLIST_WRITE_LIMIT,
        60,
    )
    if not ok:
        raise rate_limited("Too many shortlist changes. Please slow down.")


async def _daily_used(db: AsyncSession, sent_by: uuid.UUID) -> int:
    """Rows already sent today (UTC midnight) — the budget lives in the
    DB so every instance agrees on the count."""
    start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        (
            await db.execute(
                select(func.count())
                .select_from(TalentOutreach)
                .where(
                    TalentOutreach.sent_by == sent_by,
                    TalentOutreach.created_at >= start,
                )
            )
        ).scalar_one()
    )


async def _visible_candidate(
    db: AsyncSession, candidate_id: uuid.UUID
) -> tuple[User, TalentProfile] | None:
    """The 7j privacy gate: both profile switches on, account active and
    not deleted — None means 'indistinguishable from missing'."""
    return (
        await db.execute(
            select(User, TalentProfile)
            .join(TalentProfile, TalentProfile.user_id == User.id)
            .where(
                User.id == candidate_id,
                User.deleted_at.is_(None),
                User.status == AccountStatus.active,
                TalentProfile.is_searchable.is_(True),
                User.profile_public.is_(True),
            )
        )
    ).one_or_none()


async def _scoped_job(db: AsyncSession, org_id: uuid.UUID, job_id: uuid.UUID) -> Job:
    """Payload job reference: must exist in THIS org — 422 with
    ``loc: [body, job_id]`` (cross-org payload references are 422, the
    7g/7h convention)."""
    job = (
        await db.execute(
            select(Job).where(
                Job.id == job_id,
                Job.org_id == org_id,
                Job.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if job is None:
        message = "Unknown job for this organization."
        raise validation_error(
            message,
            details=[{"loc": ["body", "job_id"], "msg": message, "type": "value_error"}],
        )
    return job


def _card(
    user: User, profile: TalentProfile, skills: list[str]
) -> TalentCard:
    return TalentCard(
        user_id=user.id,
        display_name=user.display_name,
        avatar_initials=user.avatar_initials,
        headline=profile.headline,
        current_location=profile.current_location,
        total_experience_yrs=(
            float(profile.total_experience_yrs)
            if profile.total_experience_yrs is not None
            else None
        ),
        availability=profile.availability.value,
        preferred_mode=profile.preferred_mode.value if profile.preferred_mode else None,
        skills=skills,
    )


async def _skills_map(
    db: AsyncSession, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[str]]:
    if not user_ids:
        return {}
    rows = (
        await db.execute(
            select(TalentProfileSkill.user_id, Skill.name)
            .join(Skill, Skill.id == TalentProfileSkill.skill_id)
            .where(TalentProfileSkill.user_id.in_(user_ids))
            .order_by(Skill.name)
        )
    ).all()
    out: dict[uuid.UUID, list[str]] = {}
    for uid, name in rows:
        out.setdefault(uid, []).append(name)
    return out


# ------------------------------------------------------------- search


async def search(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    q: str | None = None,
    experience: Literal["mid", "senior", "lead"] | None = None,
    skill: str | None = None,
    sort: Literal["recent", "experience"] = "recent",
    limit: int = 50,
    offset: int = 0,
) -> TalentSearchPage:
    """GET /organizations/{org_id}/talent/search — privacy-gated cards
    only (see module docstring for the approved field set)."""
    await _authorize(db, user, org_id)
    await _limit_search(user)

    where = [
        User.deleted_at.is_(None),
        User.status == AccountStatus.active,
        TalentProfile.is_searchable.is_(True),
        User.profile_public.is_(True),
    ]
    if q:
        pattern = f"%{job_service._escape_like(q)}%"
        where.append(
            or_(
                User.display_name.ilike(pattern, escape="\\"),
                TalentProfile.headline.ilike(pattern, escape="\\"),
                TalentProfile.current_location.ilike(pattern, escape="\\"),
            )
        )
    if experience is not None:
        low, high = _EXPERIENCE_BANDS[experience]
        where.append(TalentProfile.total_experience_yrs >= low)
        if high is not None:
            where.append(TalentProfile.total_experience_yrs < high)
    if skill:
        where.append(
            TalentProfile.user_id.in_(
                select(TalentProfileSkill.user_id)
                .join(Skill, Skill.id == TalentProfileSkill.skill_id)
                .where(func.lower(Skill.name) == skill.lower())
            )
        )

    total = (
        (
            await db.execute(
                select(func.count())
                .select_from(User)
                .join(TalentProfile, TalentProfile.user_id == User.id)
                .where(*where)
            )
        ).scalar_one()
    )
    ordering: tuple[Any, ...]
    if sort == "experience":
        ordering = (
            TalentProfile.total_experience_yrs.desc().nulls_last(),
            User.id.desc(),
        )
    else:
        ordering = (TalentProfile.updated_at.desc(), User.id.desc())
    rows = (
        (
            await db.execute(
                select(User, TalentProfile)
                .join(TalentProfile, TalentProfile.user_id == User.id)
                .where(*where)
                .order_by(*ordering)
                .limit(limit)
                .offset(offset)
            )
        )
        .all()
    )
    skills = await _skills_map(db, [row[0].id for row in rows])
    items = [_card(u, p, skills.get(u.id, [])) for u, p in rows]
    return TalentSearchPage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )


# ---------------------------------------------------------- shortlists


async def _load_shortlist(
    db: AsyncSession, shortlist_id: uuid.UUID, *, lock: bool = False
) -> TalentShortlist:
    stmt = select(TalentShortlist).where(
        TalentShortlist.id == shortlist_id,
        TalentShortlist.deleted_at.is_(None),
    )
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Shortlist not found.")
    return row


async def _row_gate(
    db: AsyncSession, user: User, row: TalentShortlist, *, write: bool
) -> OrganizationMember:
    """Bare-route gate (7i shape): outsiders resolve foreign shortlist
    ids as 404; role floor is member; budget depends on direction."""
    org = (
        await db.execute(
            select(Organization).where(
                Organization.id == row.org_id,
                Organization.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if org is None or org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Shortlist not found.")
    member = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == org.id,
                OrganizationMember.user_id == user.id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == MemberStatus.active,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise not_found("Shortlist not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    if member.role not in _READ_ROLES:
        raise forbidden()
    if write:
        await _limit_shortlist_write(user)
    else:
        await _limit_search(user)
    return member


async def _shortlist_read(
    db: AsyncSession, row: TalentShortlist, *, member_count: int
) -> ShortlistRead:
    created_by_name = None
    if row.created_by is not None:
        created_by_name = (
            await db.execute(
                select(User.display_name).where(User.id == row.created_by)
            )
        ).scalar_one_or_none()
    return ShortlistRead(
        id=row.id,
        org_id=row.org_id,
        name=row.name,
        member_count=member_count,
        created_by=row.created_by,
        created_by_name=created_by_name,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _visible_member_pairs(
    db: AsyncSession, shortlist_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[tuple[User, TalentProfile]]]:
    """Members of the given shortlists that pass the privacy gate —
    grouped per shortlist (used by list counts and detail cards)."""
    if not shortlist_ids:
        return {}
    rows = (
        await db.execute(
            select(TalentShortlistMember.shortlist_id, User, TalentProfile)
            .join(User, User.id == TalentShortlistMember.user_id)
            .join(TalentProfile, TalentProfile.user_id == User.id)
            .where(
                TalentShortlistMember.shortlist_id.in_(shortlist_ids),
                User.deleted_at.is_(None),
                User.status == AccountStatus.active,
                TalentProfile.is_searchable.is_(True),
                User.profile_public.is_(True),
            )
            .order_by(TalentShortlistMember.created_at)
        )
    ).all()
    grouped: dict[uuid.UUID, list[tuple[User, TalentProfile]]] = {}
    for shortlist_id, u, p in rows:
        grouped.setdefault(shortlist_id, []).append((u, p))
    return grouped


async def list_shortlists(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> ShortlistPage:
    await _authorize(db, user, org_id)
    await _limit_search(user)
    where = [TalentShortlist.org_id == org_id, TalentShortlist.deleted_at.is_(None)]
    total = (
        (
            await db.execute(
                select(func.count()).select_from(TalentShortlist).where(*where)
            )
        ).scalar_one()
    )
    rows = list(
        (
            await db.execute(
                select(TalentShortlist)
                .where(*where)
                .order_by(TalentShortlist.created_at.desc(), TalentShortlist.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    grouped = await _visible_member_pairs(db, [r.id for r in rows])
    items = [
        await _shortlist_read(db, r, member_count=len(grouped.get(r.id, [])))
        for r in rows
    ]
    return ShortlistPage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )


async def create_shortlist(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: ShortlistCreate
) -> ShortlistRead:
    member = await _authorize(db, user, org_id)
    await _limit_shortlist_write(user)
    row = TalentShortlist(
        org_id=member.org_id, name=payload.name, created_by=user.id
    )
    db.add(row)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.talent_shortlist_created,
        summary="Shortlist created.",
        org_id=member.org_id,
        actor_id=user.id,
        entity_type="talent_shortlist",
        entity_id=row.id,
    )
    await db.commit()
    await db.refresh(row)
    return await _shortlist_read(db, row, member_count=0)


async def get_shortlist(
    db: AsyncSession, user: User, shortlist_id: uuid.UUID
) -> ShortlistDetail:
    row = await _load_shortlist(db, shortlist_id)
    await _row_gate(db, user, row, write=False)
    grouped = await _visible_member_pairs(db, [row.id])
    members_pairs = grouped.get(row.id, [])
    skills = await _skills_map(db, [u.id for u, _ in members_pairs])
    card = await _shortlist_read(db, row, member_count=len(members_pairs))
    return ShortlistDetail(
        **card.model_dump(),
        members=[_card(u, p, skills.get(u.id, [])) for u, p in members_pairs],
    )


async def rename_shortlist(
    db: AsyncSession, user: User, shortlist_id: uuid.UUID, payload: ShortlistUpdate
) -> ShortlistRead:
    row = await _load_shortlist(db, shortlist_id, lock=True)
    await _row_gate(db, user, row, write=True)
    row.name = payload.name
    await db.commit()
    await db.refresh(row)
    grouped = await _visible_member_pairs(db, [row.id])
    return await _shortlist_read(
        db, row, member_count=len(grouped.get(row.id, []))
    )


async def delete_shortlist(
    db: AsyncSession, user: User, shortlist_id: uuid.UUID
) -> None:
    row = await _load_shortlist(db, shortlist_id, lock=True)
    member = await _row_gate(db, user, row, write=True)
    row.deleted_at = datetime.now(UTC)
    activity_service.record(
        db,
        event_type=ActivityEventType.talent_shortlist_deleted,
        summary="Shortlist deleted.",
        org_id=member.org_id,
        actor_id=user.id,
        entity_type="talent_shortlist",
        entity_id=row.id,
    )
    await db.commit()


async def add_member(
    db: AsyncSession,
    user: User,
    shortlist_id: uuid.UUID,
    payload: ShortlistMemberAdd,
) -> TalentCard:
    row = await _load_shortlist(db, shortlist_id, lock=True)
    await _row_gate(db, user, row, write=True)
    visible = await _visible_candidate(db, payload.user_id)
    if visible is None:
        raise not_found("Candidate not found.")
    candidate, profile = visible
    existing = (
        await db.execute(
            select(TalentShortlistMember).where(
                TalentShortlistMember.shortlist_id == row.id,
                TalentShortlistMember.user_id == payload.user_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise conflict("Candidate is already in this shortlist.", "ALREADY_IN_SHORTLIST")
    db.add(
        TalentShortlistMember(
            shortlist_id=row.id, user_id=payload.user_id, added_by=user.id
        )
    )
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise conflict(
            "Candidate is already in this shortlist.", "ALREADY_IN_SHORTLIST"
        ) from None
    await db.commit()
    skills = await _skills_map(db, [candidate.id])
    return _card(candidate, profile, skills.get(candidate.id, []))


async def remove_member(
    db: AsyncSession, user: User, shortlist_id: uuid.UUID, member_user_id: uuid.UUID
) -> None:
    row = await _load_shortlist(db, shortlist_id, lock=True)
    await _row_gate(db, user, row, write=True)
    existing = (
        await db.execute(
            select(TalentShortlistMember).where(
                TalentShortlistMember.shortlist_id == row.id,
                TalentShortlistMember.user_id == member_user_id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        raise not_found("Shortlist member not found.")
    await db.delete(existing)
    await db.commit()


# ------------------------------------------------------------ outreach


async def _outreach_read(
    db: AsyncSession,
    row: TalentOutreach,
    *,
    candidate_name: str,
    job_title: str,
    sent_by_name: str | None,
    status: Literal["pending", "applied"],
    candidate_headline: str | None = None,
) -> OutreachRead:
    return OutreachRead(
        id=row.id,
        org_id=row.org_id,
        candidate_user_id=row.candidate_user_id,
        candidate_name=candidate_name,
        candidate_headline=candidate_headline,
        job_id=row.job_id,
        job_title=job_title,
        note=row.note,
        status=status,
        sent_by=row.sent_by,
        sent_by_name=sent_by_name,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _already_applied(
    db: AsyncSession, job_id: uuid.UUID, candidate_id: uuid.UUID
) -> bool:
    return (
        await db.execute(
            select(JobApplication.id).where(
                JobApplication.job_id == job_id,
                JobApplication.applicant_id == candidate_id,
                JobApplication.deleted_at.is_(None),
            )
        )
    ).first() is not None


async def send_outreach(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: OutreachCreate
) -> OutreachRead:
    """POST /organizations/{org_id}/talent/outreach — one invite per
    candidate per job per org; the daily budget is per sender per UTC
    day (counted from the DB)."""
    member = await _authorize(db, user, org_id)
    job = await _scoped_job(db, member.org_id, payload.job_id)
    visible = await _visible_candidate(db, payload.candidate_user_id)
    if visible is None:
        raise not_found("Candidate not found.")
    candidate, profile = visible
    # Read before commit (expired attributes would lazy-load after it).
    candidate_headline = profile.headline
    if await _already_applied(db, job.id, candidate.id):
        raise conflict(
            "Candidate already applied to this job.", "ALREADY_APPLIED"
        )
    settings = get_settings()
    if await _daily_used(db, user.id) >= settings.TALENT_OUTREACH_DAILY_LIMIT:
        raise rate_limited("Daily outreach limit reached. Try again tomorrow.")
    row = TalentOutreach(
        org_id=member.org_id,
        candidate_user_id=candidate.id,
        job_id=job.id,
        note=payload.note,
        sent_by=user.id,
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise conflict(
            "Already invited to this job for this organization.",
            "ALREADY_INVITED",
        ) from None
    activity_service.record(
        db,
        event_type=ActivityEventType.talent_outreach_sent,
        summary="Invitation to apply sent.",
        org_id=member.org_id,
        actor_id=user.id,
        entity_type="talent_outreach",
        entity_id=row.id,
        data={"job_id": str(job.id), "candidate_user_id": str(candidate.id)},
    )
    await db.commit()
    await db.refresh(row)
    sent_by_name = (
        await db.execute(select(User.display_name).where(User.id == user.id))
    ).scalar_one_or_none()
    return await _outreach_read(
        db,
        row,
        candidate_name=candidate.display_name,
        job_title=job.title,
        sent_by_name=sent_by_name,
        status="pending",
        candidate_headline=candidate_headline,
    )


async def bulk_outreach(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: OutreachBulkCreate
) -> OutreachBulkResult:
    """POST /organizations/{org_id}/talent/outreach/bulk — counts only;
    every skip reason (privacy, dup, applied, budget) increments
    ``skipped`` and never fails the request. One transaction: a
    constraint race rolls everything back with 409 rather than sending
    half a shortlist."""
    member = await _authorize(db, user, org_id)
    job = await _scoped_job(db, member.org_id, payload.job_id)
    shortlist = (
        await db.execute(
            select(TalentShortlist).where(
                TalentShortlist.id == payload.shortlist_id,
                TalentShortlist.org_id == member.org_id,
                TalentShortlist.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if shortlist is None:
        message = "Unknown shortlist for this organization."
        raise validation_error(
            message,
            details=[
                {"loc": ["body", "shortlist_id"], "msg": message, "type": "value_error"}
            ],
        )
    settings = get_settings()
    used = await _daily_used(db, user.id)
    remaining = max(settings.TALENT_OUTREACH_DAILY_LIMIT - used, 0)
    member_ids = list(
        (
            await db.execute(
                select(TalentShortlistMember.user_id).where(
                    TalentShortlistMember.shortlist_id == shortlist.id
                )
            )
        )
        .scalars()
        .all()
    )
    invited = 0
    skipped = 0
    try:
        for candidate_id in member_ids:
            visible = await _visible_candidate(db, candidate_id)
            if visible is None:
                skipped += 1
                continue
            candidate, _profile = visible
            if await _already_applied(db, job.id, candidate.id):
                skipped += 1
                continue
            duplicate = (
                await db.execute(
                    select(TalentOutreach.id).where(
                        TalentOutreach.org_id == member.org_id,
                        TalentOutreach.candidate_user_id == candidate.id,
                        TalentOutreach.job_id == job.id,
                    )
                )
            ).first()
            if duplicate is not None:
                skipped += 1
                continue
            if invited >= remaining:
                skipped += 1
                continue
            row = TalentOutreach(
                org_id=member.org_id,
                candidate_user_id=candidate.id,
                job_id=job.id,
                note=payload.note,
                sent_by=user.id,
            )
            db.add(row)
            await db.flush()
            activity_service.record(
                db,
                event_type=ActivityEventType.talent_outreach_sent,
                summary="Invitation to apply sent.",
                org_id=member.org_id,
                actor_id=user.id,
                entity_type="talent_outreach",
                entity_id=row.id,
                data={"job_id": str(job.id), "candidate_user_id": str(candidate.id)},
            )
            invited += 1
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise conflict(
            "Already invited to this job for this organization.",
            "ALREADY_INVITED",
        ) from None
    return OutreachBulkResult(invited=invited, skipped=skipped)


async def list_outreach(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    limit: int = 50,
    offset: int = 0,
) -> OutreachPage:
    """GET /organizations/{org_id}/talent/outreach — history with status
    derived from job_applications, plus the caller's daily budget."""
    member = await _authorize(db, user, org_id)
    await _limit_search(user)
    where = [TalentOutreach.org_id == member.org_id]
    total = (
        (
            await db.execute(
                select(func.count()).select_from(TalentOutreach).where(*where)
            )
        ).scalar_one()
    )
    rows = list(
        (
            await db.execute(
                select(TalentOutreach)
                .where(*where)
                .order_by(
                    TalentOutreach.created_at.desc(), TalentOutreach.id.desc()
                )
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    # Batched projections: candidate names, job titles, sender names.
    user_ids = {r.candidate_user_id for r in rows} | {
        r.sent_by for r in rows if r.sent_by is not None
    }
    names: dict[uuid.UUID, str] = {}
    if user_ids:
        names = dict(
            (await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids)))).all()
        )
    job_ids = {r.job_id for r in rows}
    titles: dict[uuid.UUID, str] = {}
    if job_ids:
        titles = dict(
            (await db.execute(select(Job.id, Job.title).where(Job.id.in_(job_ids)))).all()
        )
    # Headlines only for candidates who STILL pass the privacy gate (a
    # candidate who went private keeps their name in the org's own history
    # but no profile data is projected any more).
    headlines: dict[uuid.UUID, str | None] = {}
    if rows:
        headlines = dict(
            (
                await db.execute(
                    select(TalentProfile.user_id, TalentProfile.headline)
                    .join(User, User.id == TalentProfile.user_id)
                    .where(
                        TalentProfile.user_id.in_({r.candidate_user_id for r in rows}),
                        User.deleted_at.is_(None),
                        User.status == AccountStatus.active,
                        TalentProfile.is_searchable.is_(True),
                        User.profile_public.is_(True),
                    )
                )
            ).all()
        )
    # Org-wide applied count for the KPI tile (the page only holds one
    # page of history, so it cannot count this itself).
    applied_total = (
        await db.execute(
            select(func.count())
            .select_from(TalentOutreach)
            .where(
                *where,
                select(JobApplication.id)
                .where(
                    JobApplication.job_id == TalentOutreach.job_id,
                    JobApplication.applicant_id == TalentOutreach.candidate_user_id,
                    JobApplication.deleted_at.is_(None),
                )
                .exists(),
            )
        )
    ).scalar_one()
    applied: set[tuple[uuid.UUID, uuid.UUID]] = set()
    if rows:
        app_rows = (
            await db.execute(
                select(JobApplication.job_id, JobApplication.applicant_id).where(
                    JobApplication.job_id.in_(job_ids),
                    JobApplication.deleted_at.is_(None),
                )
            )
        ).all()
        applied = {(j, a) for j, a in app_rows}
    settings = get_settings()
    items = [
        await _outreach_read(
            db,
            r,
            candidate_name=names.get(r.candidate_user_id, ""),
            job_title=titles.get(r.job_id, ""),
            sent_by_name=names.get(r.sent_by) if r.sent_by else None,
            candidate_headline=headlines.get(r.candidate_user_id),
            status=(
                "applied" if (r.job_id, r.candidate_user_id) in applied else "pending"
            ),
        )
        for r in rows
    ]
    return OutreachPage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
        applied_total=applied_total,
        daily_limit=settings.TALENT_OUTREACH_DAILY_LIMIT,
        daily_used=await _daily_used(db, user.id),
    )


async def candidate_invitations(
    db: AsyncSession,
    user: User,
    *,
    limit: int = 20,
    offset: int = 0,
) -> CandidateInvitationPage:
    """GET /talent/invitations — invitations to apply received by the current user."""
    stmt = (
        select(TalentOutreach)
        .where(TalentOutreach.candidate_user_id == user.id)
    )
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()

    rows = list(
        (
            await db.execute(
                stmt.order_by(TalentOutreach.created_at.desc(), TalentOutreach.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )

    if not rows:
        return CandidateInvitationPage(
            items=[],
            total=total,
            limit=limit,
            offset=offset,
            has_more=False,
        )

    job_ids = [r.job_id for r in rows]
    org_ids = [r.org_id for r in rows]
    sender_ids = [r.sent_by for r in rows if r.sent_by]

    # Batch query jobs
    jobs_map: dict[uuid.UUID, Job] = {
        j.id: j
        for j in (
            await db.execute(
                select(Job).where(Job.id.in_(job_ids))
            )
        )
        .scalars()
        .all()
    }

    # Batch query orgs
    orgs_map: dict[uuid.UUID, Organization] = {
        o.id: o
        for o in (
            await db.execute(
                select(Organization).where(Organization.id.in_(org_ids))
            )
        )
        .scalars()
        .all()
    }

    # Batch query senders
    senders_map: dict[uuid.UUID, str] = {
        row[0]: row[1]
        for row in (
            await db.execute(
                select(User.id, User.display_name).where(User.id.in_(sender_ids))
            )
        ).all()
    }

    # Batch query applications to see if candidate already applied
    apps = (
        await db.execute(
            select(JobApplication.job_id, JobApplication.id).where(
                JobApplication.job_id.in_(job_ids),
                JobApplication.applicant_id == user.id,
                JobApplication.deleted_at.is_(None),
            )
        )
    ).all()
    app_map: dict[uuid.UUID, uuid.UUID] = {row[0]: row[1] for row in apps}

    items: list[CandidateInvitationRead] = []
    for r in rows:
        job = jobs_map.get(r.job_id)
        org = orgs_map.get(r.org_id)
        if not job or not org:
            continue
        app_id = app_map.get(r.job_id)
        items.append(
            CandidateInvitationRead(
                id=r.id,
                job_id=job.id,
                job_title=job.title,
                job_department=str(job.department) if job.department else None,
                job_work_mode=str(job.work_mode) if job.work_mode else None,
                job_location=job.location,
                org_id=org.id,
                org_name=org.name,
                org_logo_file_id=org.logo_file_id,
                inviter_name=senders_map.get(r.sent_by),
                note=r.note,
                created_at=r.created_at,
                applied=app_id is not None,
                application_id=app_id,
            )
        )

    return CandidateInvitationPage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )

