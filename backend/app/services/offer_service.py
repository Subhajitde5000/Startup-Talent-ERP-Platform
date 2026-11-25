"""Step 7g job offers: draft, send, respond, withdraw, lazy expiry.

Reuse of earlier steps (no parallel systems):

- Organization gate mirrors 7d/7e/7f: active employer/startup org, hiring
  global role, active membership (reads: ``{owner, admin, member}``;
  writes: owner/admin only, plan D1).
- ``applicant_pipeline_service.writable`` enforces the closed-job and
  terminal-application rules on create/send; stage moves reuse
  ``ApplicationStageEvent`` exactly like 7d.
- ``job_application_service.own``/``require_seeker`` scope the candidate
  endpoints to the caller's own application.
- ``file_service.require_org_attachment`` validates the offer-letter
  document reference; ``organization_service.require_owner_ref``
  validates ``owner_id`` — both raise 422 with ``loc: [body, field]``.
- Own rate-limit keys (OFFER_*), not the 7d applicant budget.

Plan decisions encoded here: one live offer per application (D10 — the
partial unique index plus ``IntegrityError`` -> 409 ``OFFER_EXISTS``);
PATCH only on a draft, with extend-expiry the single exception on
sent/countered (D3); lazy expiry on read with one audit row per offer,
no scheduler; cross-org offer ids resolve as 404 (no oracle) while
cross-org payload references are 422 with ``loc: [body, field]``; a
decline carries a seeded reason id and no free text (D5). Stage moves
follow D11: send sets ``offered``, withdraw reverts ``offered`` to
``interview``, accept/decline/expire never move the stage.
"""

import uuid
from datetime import UTC, date, datetime
from typing import NamedTuple

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_role
from app.core.exceptions import conflict, forbidden, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.job import Job
from app.models.job_application import ApplicationStageEvent, JobApplication
from app.models.offer import JOB_OFFER_TRANSITIONS, JobOffer, JobOfferStatus, OfferDeclineReason
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.user import User, UserRole
from app.schemas.offer import (
    OfferCreate,
    OfferDecline,
    OfferDeclineReasonRead,
    OfferPage,
    OfferRead,
    OfferUpdate,
)
from app.services import (
    activity_service,
    applicant_pipeline_service,
    file_service,
    job_application_service,
    job_service,
    organization_service,
)
from app.services.rate_limiter import rate_limiter

MANAGERS = {OrgRole.owner, OrgRole.admin}
_READ_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}
_EMPLOYER = require_role(UserRole.employer)
_STARTUP_HIRING = require_role(UserRole.employer, UserRole.startup)

# sent/countered are lazily expired; accepted/declined/withdrawn are not.
_EXPIRABLE = (JobOfferStatus.sent, JobOfferStatus.countered)

# Plan D5: the platform decline-reason vocabulary, seeded by the
# bootstrap command (scripts/bootstrap_decline_reasons.py).
DECLINE_REASONS: tuple[tuple[str, str], ...] = (
    ("accepted_another_offer", "Accepted another offer"),
    ("compensation", "Compensation"),
    ("role_fit", "Role fit"),
    ("location", "Location"),
    ("other", "Other"),
)

# The candidate's application must still be answerable — the 7d terminal
# set (withdrawn/rejected/hired) reused, not redefined.
_DEAD_APPLICATION = applicant_pipeline_service.TERMINAL


async def seed_decline_reasons(db: AsyncSession) -> int:
    """Idempotent bootstrap of the platform decline reasons (plan D5)."""
    existing = set((await db.execute(select(OfferDeclineReason.code))).scalars())
    added = 0
    for code, label in DECLINE_REASONS:
        if code not in existing:
            db.add(OfferDeclineReason(code=code, label=label))
            added += 1
    if added:
        await db.commit()
    return added


async def _limit(user: User, *, write: bool) -> None:
    settings = get_settings()
    if write:
        ok = await rate_limiter.check(
            f"job_offer_write:{user.id}",
            settings.JOB_OFFER_WRITE_LIMIT,
            settings.JOB_OFFER_WRITE_WINDOW_SECONDS,
        )
        message = "Too many offer changes. Please slow down."
    else:
        ok = await rate_limiter.check(
            f"job_offer_read:{user.id}", settings.JOB_OFFER_READ_LIMIT, 60
        )
        message = "Too many offer requests. Please try again later."
    if not ok:
        raise rate_limited(message)


async def authorize(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False
) -> OrganizationMember:
    """Org-prefixed gate (list/create routes). Outsiders get 403 (the
    established org-path contract); row ids inside an authorized scope
    are the ones that resolve as 404."""
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    member = await organization_service.require_membership(
        db, org.id, user, roles=set(MANAGERS) if write else set(_READ_ROLES)
    )
    await _limit(user, write=write)
    return member


async def _app_scope(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    member: OrganizationMember,
    *,
    lock: bool = False,
) -> tuple[Job, JobApplication]:
    """7d ``scoped`` semantics (same shape, no applicant rate limiter —
    the offer endpoints own the OFFER_* budget)."""
    job = await job_service._job(db, org_id, job_id, lock=lock, include_archived=True)
    stmt = select(JobApplication).where(
        JobApplication.id == application_id,
        JobApplication.job_id == job.id,
        JobApplication.deleted_at.is_(None),
    )
    if member.role not in MANAGERS and job.owner_id != user.id:
        stmt = stmt.where(JobApplication.assignee_id == user.id)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Application not found.")
    return job, row


async def _load(
    db: AsyncSession, offer_id: uuid.UUID, *, lock: bool = False
) -> tuple[JobOffer, JobApplication, Job]:
    """Bare ``/offers/{id}`` lookup: org is derived from the row (the
    caller's membership decides 404 vs 403 afterwards)."""
    stmt = (
        select(JobOffer, JobApplication, Job)
        .join(JobApplication, JobApplication.id == JobOffer.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .where(
            JobOffer.id == offer_id,
            JobOffer.deleted_at.is_(None),
            JobApplication.deleted_at.is_(None),
        )
    )
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    result = (await db.execute(stmt)).first()
    if result is None:
        raise not_found("Offer not found.")
    return result[0], result[1], result[2]


async def _row_gate(
    db: AsyncSession, user: User, job: Job, *, write: bool
) -> OrganizationMember:
    """Bare-route gate: outsiders (and non-hiring orgs) are 404 — no
    existence oracle — then role and rate limits apply like the
    org-prefixed routes."""
    org = (
        await db.execute(
            select(Organization).where(
                Organization.id == job.org_id,
                Organization.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if org is None or org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Offer not found.")
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
        raise not_found("Offer not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    if write:
        if member.role not in MANAGERS:
            raise forbidden("Only owners and admins can change offers.")
        await _limit(user, write=True)
    else:
        if member.role not in _READ_ROLES:
            raise forbidden()
        await _limit(user, write=False)
    return member


async def _mark_expired(
    db: AsyncSession, pairs: list[tuple[JobOffer, uuid.UUID]]
) -> None:
    """Lazy expiry for a whole scope: one audit row per offer, then one
    bulk update (the 9i pattern). Commits — call before any other write."""
    if not pairs:
        return
    for offer, org_id in pairs:
        expires_on = offer.expires_on
        assert expires_on is not None
        activity_service.record(
            db,
            event_type=ActivityEventType.offer_expired,
            org_id=org_id,
            actor_id=None,
            entity_type="job_offer",
            entity_id=offer.id,
            summary=f"Offer expired on {expires_on.isoformat()}.",
        )
    await db.execute(
        update(JobOffer)
        .where(JobOffer.id.in_([offer.id for offer, _ in pairs]))
        .values(status=JobOfferStatus.expired)
    )
    await db.commit()


async def _expire_org_scope(db: AsyncSession, org_id: uuid.UUID) -> None:
    rows = (
        await db.execute(
            select(JobOffer, Job.org_id)
            .join(JobApplication, JobApplication.id == JobOffer.application_id)
            .join(Job, Job.id == JobApplication.job_id)
            .where(
                Job.org_id == org_id,
                JobOffer.deleted_at.is_(None),
                JobApplication.deleted_at.is_(None),
                JobOffer.status.in_(_EXPIRABLE),
                JobOffer.expires_on.is_not(None),
                JobOffer.expires_on < date.today(),
            )
        )
    ).all()
    await _mark_expired(db, [(row[0], row[1]) for row in rows])


async def _expire_application_scope(db: AsyncSession, application_id: uuid.UUID) -> None:
    rows = (
        await db.execute(
            select(JobOffer, Job.org_id)
            .join(JobApplication, JobApplication.id == JobOffer.application_id)
            .join(Job, Job.id == JobApplication.job_id)
            .where(
                JobOffer.application_id == application_id,
                JobOffer.deleted_at.is_(None),
                JobApplication.deleted_at.is_(None),
                JobOffer.status.in_(_EXPIRABLE),
                JobOffer.expires_on.is_not(None),
                JobOffer.expires_on < date.today(),
            )
        )
    ).all()
    await _mark_expired(db, [(row[0], row[1]) for row in rows])


async def _expire_seeker_scope(db: AsyncSession, user: User) -> None:
    """Lazy expiry across every offer on the caller's own applications (G2)."""
    rows = (
        await db.execute(
            select(JobOffer, Job.org_id)
            .join(JobApplication, JobApplication.id == JobOffer.application_id)
            .join(Job, Job.id == JobApplication.job_id)
            .where(
                JobApplication.applicant_id == user.id,
                JobApplication.deleted_at.is_(None),
                JobOffer.deleted_at.is_(None),
                JobOffer.status.in_(_EXPIRABLE),
                JobOffer.expires_on.is_not(None),
                JobOffer.expires_on < date.today(),
            )
        )
    ).all()
    await _mark_expired(db, [(row[0], row[1]) for row in rows])


async def _expire_one(db: AsyncSession, offer: JobOffer, org_id: uuid.UUID) -> None:
    """Lazy expiry for one loaded row. Commits — always called before
    any other write so the audit row and the status move together."""
    if (
        offer.status in _EXPIRABLE
        and offer.expires_on is not None
        and offer.expires_on < date.today()
    ):
        expires_on = offer.expires_on
        activity_service.record(
            db,
            event_type=ActivityEventType.offer_expired,
            org_id=org_id,
            actor_id=None,
            entity_type="job_offer",
            entity_id=offer.id,
            summary=f"Offer expired on {expires_on.isoformat()}.",
        )
        offer.status = JobOfferStatus.expired
        await db.commit()
        # Server-side ``updated_at`` onupdate: reload it now so later
        # attribute access never triggers a sync lazy load.
        await db.refresh(offer)


def _profile_name(is_blind: bool, profile: dict | None) -> str | None:
    """Blind-safe candidate display name: ``None`` while masked (G1)."""
    if is_blind:
        return None
    contact = (profile or {}).get("contact") or {}
    name = contact.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


class _Display(NamedTuple):
    """Pre-joined display context for one offer read (plan G1)."""

    job_id: uuid.UUID
    job_title: str
    company_name: str
    candidate_name: str | None
    owner_name: str | None


async def _display(
    db: AsyncSession, offer: JobOffer, app: JobApplication, job: Job
) -> _Display:
    """Single-row context: org name + owner display name (two tiny lookups)."""
    company = (
        await db.execute(select(Organization.name).where(Organization.id == job.org_id))
    ).scalar_one_or_none()
    owner_name: str | None = None
    if offer.owner_id is not None:
        owner_name = (
            await db.execute(select(User.display_name).where(User.id == offer.owner_id))
        ).scalar_one_or_none()
    return _Display(
        job_id=job.id,
        job_title=job.title,
        company_name=company or "",
        candidate_name=_profile_name(app.is_blind, app.profile_snapshot),
        owner_name=owner_name,
    )


async def _read(
    db: AsyncSession, offer: JobOffer, app: JobApplication, job: Job
) -> OfferRead:
    return _read_with(offer, await _display(db, offer, app, job))


def _read_with(offer: JobOffer, disp: _Display) -> OfferRead:
    return OfferRead(
        id=offer.id,
        application_id=offer.application_id,
        job_id=disp.job_id,
        title=offer.title,
        job_title=disp.job_title,
        company_name=disp.company_name,
        candidate_name=disp.candidate_name,
        owner_name=disp.owner_name,
        base_salary=offer.base_salary,
        bonus_amount=offer.bonus_amount,
        equity_pct=offer.equity_pct,
        joining_bonus=offer.joining_bonus,
        currency=offer.currency,
        start_date=offer.start_date,
        expires_on=offer.expires_on,
        status=offer.status,
        owner_id=offer.owner_id,
        document_file_id=offer.document_file_id,
        responded_at=offer.responded_at,
        decline_reason_id=offer.decline_reason_id,
        created_at=offer.created_at,
        updated_at=offer.updated_at,
    )


def _check_transition(offer: JobOffer, target: JobOfferStatus) -> None:
    if target not in JOB_OFFER_TRANSITIONS[offer.status]:
        raise conflict(
            f"An offer in {offer.status} state cannot become {target}.",
            "OFFER_INVALID_STATE",
        )


def _audit(
    db: AsyncSession,
    user: User | None,
    org_id: uuid.UUID,
    event: ActivityEventType,
    offer: JobOffer,
    summary: str,
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=summary,
        org_id=org_id,
        actor_id=user.id if user else None,
        entity_type="job_offer",
        entity_id=offer.id,
    )


def _move_stage(db: AsyncSession, app: JobApplication, to_stage: str, actor_id: uuid.UUID) -> None:
    """Stage write (D11) in the 7d shape: field, timestamps, stage event."""
    if app.stage == to_stage:
        return
    now = datetime.now(UTC)
    before = app.stage
    app.stage = to_stage
    app.stage_changed_at = app.updated_at = now
    db.add(
        ApplicationStageEvent(
            application_id=app.id,
            from_stage=before,
            to_stage=to_stage,
            actor_id=actor_id,
            created_at=now,
        )
    )


async def create(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: OfferCreate,
) -> OfferRead:
    member = await authorize(db, user, org_id, write=True)
    job, app = await _app_scope(
        db, user, org_id, job_id, application_id, member, lock=True
    )
    applicant_pipeline_service.writable(job, app)
    if payload.owner_id is not None:
        await organization_service.require_owner_ref(
            db, org_id, payload.owner_id, field="owner_id", label="Offer owner"
        )
    if payload.document_file_id is not None:
        await file_service.require_org_attachment(
            db, user, org_id, payload.document_file_id, "document", "document_file_id"
        )
    data = payload.model_dump()
    offer = JobOffer(
        application_id=app.id,
        owner_id=data.pop("owner_id") or user.id,
        **data,
    )
    db.add(offer)
    try:
        await db.flush()
    except IntegrityError:
        # Plan D10: the partial unique index rejects a second live offer.
        await db.rollback()
        raise conflict(
            "This application already has a live offer.", "OFFER_EXISTS"
        ) from None
    _audit(
        db, user, job.org_id, ActivityEventType.offer_created, offer, "Offer created."
    )
    await db.commit()
    await db.refresh(offer)
    return await _read(db, offer, app, job)


async def list_offers(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    status: JobOfferStatus | None = None,
    job_id: uuid.UUID | None = None,
    application_id: uuid.UUID | None = None,
    limit: int,
    offset: int,
) -> OfferPage:
    await authorize(db, user, org_id)
    await _expire_org_scope(db, org_id)
    stmt = (
        select(
            JobOffer,
            Job.id,
            Job.title,
            Organization.name,
            JobApplication.is_blind,
            JobApplication.profile_snapshot,
            User.display_name,
        )
        .join(JobApplication, JobApplication.id == JobOffer.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .join(Organization, Organization.id == Job.org_id)
        .outerjoin(User, User.id == JobOffer.owner_id)
        .where(
            Job.org_id == org_id,
            JobOffer.deleted_at.is_(None),
            JobApplication.deleted_at.is_(None),
        )
    )
    if status is not None:
        stmt = stmt.where(JobOffer.status == status)
    if job_id is not None:
        stmt = stmt.where(Job.id == job_id)
    if application_id is not None:
        stmt = stmt.where(JobOffer.application_id == application_id)
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(JobOffer.created_at.desc(), JobOffer.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return OfferPage(
        items=[
            _read_with(
                offer,
                _Display(
                    job_id=job_id,
                    job_title=job_title,
                    company_name=company,
                    candidate_name=_profile_name(is_blind, profile),
                    owner_name=owner_name,
                ),
            )
            for offer, job_id, job_title, company, is_blind, profile, owner_name in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def detail(db: AsyncSession, user: User, offer_id: uuid.UUID) -> OfferRead:
    offer, app, job = await _load(db, offer_id)
    if app.applicant_id == user.id:
        # G4: the owning candidate reads the bare offer id the same way
        # accept/decline resolve it — membership never blocks the owner.
        await job_application_service.require_seeker(db, user)
        # G3: a draft was never sent to the candidate.
        if offer.status == JobOfferStatus.draft:
            raise not_found("Offer not found.")
        await _expire_one(db, offer, job.org_id)
        return await _read(db, offer, app, job)
    await _row_gate(db, user, job, write=False)
    await _expire_one(db, offer, job.org_id)
    return await _read(db, offer, app, job)


async def patch(
    db: AsyncSession, user: User, offer_id: uuid.UUID, payload: OfferUpdate
) -> OfferRead:
    offer, app, job = await _load(db, offer_id, lock=True)
    await _row_gate(db, user, job, write=True)
    await _expire_one(db, offer, job.org_id)
    fields = payload.model_fields_set
    if not fields:
        return await _read(db, offer, app, job)
    if offer.status == JobOfferStatus.sent or offer.status == JobOfferStatus.countered:
        # Plan D3: after send the body is frozen; extend-expiry is the
        # single exception.
        extra = fields - {"expires_on"}
        if extra:
            raise conflict(
                "Only the expiry can be changed on a sent offer.", "OFFER_FROZEN"
            )
        offer.expires_on = payload.expires_on
        _audit(
            db,
            user,
            job.org_id,
            ActivityEventType.offer_updated,
            offer,
            "Offer expiry updated.",
        )
        await db.commit()
        await db.refresh(offer)
        return await _read(db, offer, app, job)
    if offer.status != JobOfferStatus.draft:
        raise conflict(
            "This offer can no longer be edited.", "OFFER_NOT_EDITABLE"
        )
    # Draft edit: NOT NULL columns reject an explicit null.
    for field in ("title", "currency"):
        if field in fields and getattr(payload, field) is None:
            message = f"{field} is required."
            raise validation_error(
                message,
                details=[{"loc": ["body", field], "msg": message, "type": "value_error"}],
            )
    if "owner_id" in fields and payload.owner_id is not None:
        await organization_service.require_owner_ref(
            db, job.org_id, payload.owner_id, field="owner_id", label="Offer owner"
        )
    if "document_file_id" in fields and payload.document_file_id is not None:
        await file_service.require_org_attachment(
            db,
            user,
            job.org_id,
            payload.document_file_id,
            "document",
            "document_file_id",
        )
    for field in fields:
        setattr(offer, field, getattr(payload, field))
    _audit(
        db, user, job.org_id, ActivityEventType.offer_updated, offer, "Offer updated."
    )
    await db.commit()
    await db.refresh(offer)
    return await _read(db, offer, app, job)


async def send(db: AsyncSession, user: User, offer_id: uuid.UUID) -> OfferRead:
    offer, app, job = await _load(db, offer_id, lock=True)
    await _row_gate(db, user, job, write=True)
    await _expire_one(db, offer, job.org_id)
    _check_transition(offer, JobOfferStatus.sent)
    applicant_pipeline_service.writable(job, app)
    offer.status = JobOfferStatus.sent
    # D11: sending moves the application to ``offered`` (one stage event).
    _move_stage(db, app, "offered", user.id)
    _audit(
        db, user, job.org_id, ActivityEventType.offer_sent, offer, "Offer sent."
    )
    await db.commit()
    await db.refresh(offer)
    return await _read(db, offer, app, job)


async def withdraw(db: AsyncSession, user: User, offer_id: uuid.UUID) -> OfferRead:
    offer, app, job = await _load(db, offer_id, lock=True)
    await _row_gate(db, user, job, write=True)
    await _expire_one(db, offer, job.org_id)
    if offer.status not in {
        JobOfferStatus.draft,
        JobOfferStatus.sent,
        JobOfferStatus.countered,
    }:
        raise conflict(
            f"An offer in {offer.status} state cannot be withdrawn.",
            "OFFER_INVALID_STATE",
        )
    offer.status = JobOfferStatus.withdrawn
    # D11: withdrawing reverts ``offered`` back to ``interview`` (only
    # when the application still sits on ``offered``).
    if app.stage == "offered":
        _move_stage(db, app, "interview", user.id)
    _audit(
        db,
        user,
        job.org_id,
        ActivityEventType.offer_withdrawn,
        offer,
        "Offer withdrawn.",
    )
    await db.commit()
    await db.refresh(offer)
    return await _read(db, offer, app, job)


async def _candidate_offer(
    db: AsyncSession, user: User, offer_id: uuid.UUID, *, lock: bool = False
) -> tuple[JobOffer, JobApplication, Job]:
    """Own application first (404 for everyone else — no oracle), then
    the jobseeker role gate (403). Drafts were never sent (G3)."""
    offer, app, job = await _load(db, offer_id, lock=lock)
    if app.applicant_id != user.id:
        raise not_found("Offer not found.")
    await job_application_service.require_seeker(db, user)
    if offer.status == JobOfferStatus.draft:
        raise not_found("Offer not found.")
    return offer, app, job


async def candidate_list(
    db: AsyncSession, user: User, application_id: uuid.UUID, *, limit: int, offset: int
) -> OfferPage:
    app = await job_application_service.own(db, user, application_id)
    await _limit(user, write=False)
    await _expire_application_scope(db, app.id)
    # G3: a draft was never sent — the candidate must not see it.
    stmt = (
        select(
            JobOffer,
            Job.id,
            Job.title,
            Organization.name,
            JobApplication.is_blind,
            JobApplication.profile_snapshot,
            User.display_name,
        )
        .join(JobApplication, JobApplication.id == JobOffer.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .join(Organization, Organization.id == Job.org_id)
        .outerjoin(User, User.id == JobOffer.owner_id)
        .where(
            JobOffer.application_id == app.id,
            JobOffer.deleted_at.is_(None),
            JobOffer.status != JobOfferStatus.draft,
        )
    )
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(JobOffer.created_at.desc(), JobOffer.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return OfferPage(
        items=[
            _read_with(
                offer,
                _Display(
                    job_id=job_id,
                    job_title=job_title,
                    company_name=company,
                    candidate_name=_profile_name(is_blind, profile),
                    owner_name=owner_name,
                ),
            )
            for offer, job_id, job_title, company, is_blind, profile, owner_name in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def candidate_detail(
    db: AsyncSession, user: User, application_id: uuid.UUID, offer_id: uuid.UUID
) -> OfferRead:
    app = await job_application_service.own(db, user, application_id)
    offer, _, job = await _load(db, offer_id)
    if offer.application_id != app.id:
        raise not_found("Offer not found.")
    # G3: drafts were never sent to the candidate.
    if offer.status == JobOfferStatus.draft:
        raise not_found("Offer not found.")
    await _limit(user, write=False)
    await _expire_one(db, offer, job.org_id)
    return await _read(db, offer, app, job)


async def mine(
    db: AsyncSession, user: User, *, limit: int, offset: int
) -> OfferPage:
    """G2: every visible offer across the caller's own applications, so the
    candidate offer list needs one request instead of one per application.
    Drafts are excluded (G3); expiry sweeps the whole seeker scope first.
    """
    await job_application_service.require_seeker(db, user)
    await _limit(user, write=False)
    await _expire_seeker_scope(db, user)
    own_ids = select(JobApplication.id).where(
        JobApplication.applicant_id == user.id,
        JobApplication.deleted_at.is_(None),
    )
    stmt = (
        select(
            JobOffer,
            Job.id,
            Job.title,
            Organization.name,
            JobApplication.is_blind,
            JobApplication.profile_snapshot,
            User.display_name,
        )
        .join(JobApplication, JobApplication.id == JobOffer.application_id)
        .join(Job, Job.id == JobApplication.job_id)
        .join(Organization, Organization.id == Job.org_id)
        .outerjoin(User, User.id == JobOffer.owner_id)
        .where(
            JobOffer.application_id.in_(own_ids),
            JobOffer.deleted_at.is_(None),
            JobOffer.status != JobOfferStatus.draft,
        )
    )
    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            stmt.order_by(JobOffer.created_at.desc(), JobOffer.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return OfferPage(
        items=[
            _read_with(
                offer,
                _Display(
                    job_id=job_id,
                    job_title=job_title,
                    company_name=company,
                    candidate_name=_profile_name(is_blind, profile),
                    owner_name=owner_name,
                ),
            )
            for offer, job_id, job_title, company, is_blind, profile, owner_name in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


async def accept(db: AsyncSession, user: User, offer_id: uuid.UUID) -> OfferRead:
    offer, app, job = await _candidate_offer(db, user, offer_id, lock=True)
    await _limit(user, write=True)
    await _expire_one(db, offer, job.org_id)
    if app.stage in _DEAD_APPLICATION:
        raise conflict(
            "This application can no longer respond to offers.",
            "APPLICATION_READ_ONLY",
        )
    _check_transition(offer, JobOfferStatus.accepted)
    offer.status = JobOfferStatus.accepted
    offer.responded_at = datetime.now(UTC)
    # D11: accept leaves the stage on ``offered`` — the hire flow moves
    # it to ``hired``.
    _audit(
        db,
        user,
        job.org_id,
        ActivityEventType.offer_accepted,
        offer,
        "Offer accepted.",
    )
    await db.commit()
    await db.refresh(offer)
    return await _read(db, offer, app, job)


async def decline(
    db: AsyncSession, user: User, offer_id: uuid.UUID, payload: OfferDecline
) -> OfferRead:
    offer, app, job = await _candidate_offer(db, user, offer_id, lock=True)
    await _limit(user, write=True)
    reason = (
        await db.execute(
            select(OfferDeclineReason).where(
                OfferDeclineReason.id == payload.decline_reason_id,
                OfferDeclineReason.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if reason is None:
        message = "Select one of the offered decline reasons."
        raise validation_error(
            message,
            details=[
                {
                    "loc": ["body", "decline_reason_id"],
                    "msg": message,
                    "type": "value_error",
                }
            ],
        )
    await _expire_one(db, offer, job.org_id)
    if app.stage in _DEAD_APPLICATION:
        raise conflict(
            "This application can no longer respond to offers.",
            "APPLICATION_READ_ONLY",
        )
    _check_transition(offer, JobOfferStatus.declined)
    offer.status = JobOfferStatus.declined
    offer.decline_reason_id = reason.id
    offer.responded_at = datetime.now(UTC)
    # D11: decline does not move the stage (only send/withdraw/hire do).
    _audit(
        db,
        user,
        job.org_id,
        ActivityEventType.offer_declined,
        offer,
        "Offer declined.",
    )
    await db.commit()
    await db.refresh(offer)
    return await _read(db, offer, app, job)


async def decline_reasons(db: AsyncSession, user: User) -> list[OfferDeclineReasonRead]:
    await _limit(user, write=False)
    rows = (
        (
            await db.execute(
                select(OfferDeclineReason)
                .where(OfferDeclineReason.is_active.is_(True))
                .order_by(OfferDeclineReason.label, OfferDeclineReason.id)
            )
        )
        .scalars()
        .all()
    )
    return [OfferDeclineReasonRead.model_validate(row) for row in rows]


__all__ = [
    "create",
    "list_offers",
    "detail",
    "patch",
    "send",
    "withdraw",
    "candidate_list",
    "candidate_detail",
    "accept",
    "decline",
    "decline_reasons",
    "seed_decline_reasons",
    "DECLINE_REASONS",
]
