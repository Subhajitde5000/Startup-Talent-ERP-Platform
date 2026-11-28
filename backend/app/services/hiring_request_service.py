"""7i hiring-request service: the internal headcount lifecycle.

Reuse of earlier steps (no parallel systems):

- Organization gate mirrors 7g/7h exactly (``offer_service.authorize``
  shape): active employer/startup org (BUILD_PLAN 7r — both types hire),
  hiring global role, verified active user, active membership, per-user
  rate limit.
- Bare ``/hiring-requests/{id}`` routes resolve foreign ids as 404 (no
  existence oracle) while org-prefixed routes 403 outsiders — the
  established split, same code shape as ``offer_service._row_gate``.
- Cross-org payload references are 422 with ``loc: [body, field]``
  (``organization_service.require_owner_ref`` for approver_id).
- Activity rows via ``activity_service.record`` in the same transaction
  as the write (7h ``hire_service._audit`` shape).

Two deliberate deviations from offers, documented rather than copied:

- Writes are member-level (owner/admin/member), not manager-only: the
  requester is usually a member who drafts and submits their own
  request. Each action tightens again inside the handler — approver
  changes and convert need owner/admin, cancel needs the requester or
  owner/admin, approve/reject need the designated approver (or any
  owner/admin when none is designated).
- The lifecycle is submit -> approve/reject -> convert, driven by typed
  intents (``submit`` on create, ``status`` on PATCH limited to the
  pending/cancelled literals) — the client never posts an arbitrary
  status value; the service decides legality from the current state.

Convert calls ``job_service.create`` with a server-only ``request_id``
kwarg (NOT part of JobCreate — clients cannot set it), mapping
headcount -> openings and budget_amount -> salary_max with
``show_salary_publicly=False`` (an approved internal budget is not a
posting), plus the 0046 GAP fields: employment_type/work_mode verbatim,
hiring_manager_id -> owner_id (dropped if no longer an eligible member),
skill names -> catalogue skills (``talent_service.resolve_skills``).
``why_now``/``justification`` stay internal to the request. The status flip, the request audit and the job creation share
one transaction because ``job_service.create`` commits the session once.
"""

from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_role
from app.core.exceptions import conflict, forbidden, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.hiring_request import HiringRequest, HiringRequestStatus
from app.models.job import EmploymentType, Job, WorkMode
from app.models.organization import (
    Department,
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.readiness import ReadinessCriterion
from app.models.user import User, UserRole
from app.schemas.hiring_request import (
    HiringRequestCreate,
    HiringRequestPage,
    HiringRequestRead,
    HiringRequestUpdate,
)
from app.schemas.job import JobCreate, JobRead, JobSkillInput
from app.services import activity_service, organization_service, talent_service
from app.services.rate_limiter import rate_limiter

# Hiring global roles (7g's gate, verbatim): employer users act on
# employer orgs; employer or startup users act on startup orgs.
_EMPLOYER = require_role(UserRole.employer)
_STARTUP_HIRING = require_role(UserRole.employer, UserRole.startup)

MANAGERS = frozenset({OrgRole.owner, OrgRole.admin})
_READ_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})
# Content and approver edits live only while the request is open.
_EDITABLE = frozenset({HiringRequestStatus.draft.value, HiringRequestStatus.pending.value})


async def _limit(user: User, *, write: bool) -> None:
    settings = get_settings()
    if write:
        ok = await rate_limiter.check(
            f"hiring_request_write:{user.id}",
            settings.HIRING_REQUEST_WRITE_LIMIT,
            settings.HIRING_REQUEST_WRITE_WINDOW_SECONDS,
        )
        message = "Too many hiring-request changes. Please slow down."
    else:
        ok = await rate_limiter.check(
            f"hiring_request_read:{user.id}", settings.HIRING_REQUEST_READ_LIMIT, 60
        )
        message = "Too many hiring-request requests. Please try again later."
    if not ok:
        raise rate_limited(message)


async def authorize(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False
) -> OrganizationMember:
    """Org-prefixed gate (create/list routes). Outsiders get 403 (the
    established org-path contract); row ids inside an authorized scope
    are the ones that resolve as 404. Role floor is member for both
    directions — see the module docstring."""
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    member = await organization_service.require_membership(
        db, org.id, user, roles=set(_READ_ROLES)
    )
    await _limit(user, write=write)
    return member


async def _load(db: AsyncSession, request_id: uuid.UUID, *, lock: bool = False) -> HiringRequest:
    """Bare ``/hiring-requests/{id}`` lookup: org comes from the row;
    the caller's membership decides 404 vs 403 afterwards."""
    stmt = select(HiringRequest).where(HiringRequest.id == request_id)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Hiring request not found.")
    return row


async def _row_gate(
    db: AsyncSession, user: User, row: HiringRequest, *, write: bool
) -> OrganizationMember:
    """Bare-route gate (offer_service._row_gate): outsiders and non-hiring
    orgs are 404 — no existence oracle — then role and rate limits apply
    like the org-prefixed routes. Role floor is member (viewer excluded);
    individual actions tighten further inside the handlers."""
    org = (
        await db.execute(
            select(Organization).where(
                Organization.id == row.org_id,
                Organization.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if org is None or org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Hiring request not found.")
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
        raise not_found("Hiring request not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    if member.role not in _READ_ROLES:
        raise forbidden()
    await _limit(user, write=write)
    return member


async def _validate_approver(
    db: AsyncSession, org_id: uuid.UUID, approver_id: uuid.UUID
) -> None:
    """approver_id must be an active, non-viewer member of this org AND
    owner/admin (the plan's rule) — 422 with ``loc: [body, approver_id]``
    for both violations."""
    await organization_service.require_owner_ref(
        db, org_id, approver_id, field="approver_id", label="Approver"
    )
    role = (
        await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == approver_id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == MemberStatus.active,
            )
        )
    ).scalar_one_or_none()
    if role not in MANAGERS:
        message = "Approver must be an owner or admin."
        raise validation_error(
            message,
            details=[{"loc": ["body", "approver_id"], "msg": message, "type": "value_error"}],
        )


async def _validate_hiring_manager(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """GAP (0046): hiring_manager_id is an owner-type ref (it becomes the
    converted job's owner) — active, non-viewer member, 422 at
    ``loc: [body, hiring_manager_id]`` otherwise."""
    await organization_service.require_owner_ref(
        db, org_id, user_id, field="hiring_manager_id", label="Hiring manager"
    )


async def _still_owner_ref(db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """Convert-time re-check: a hiring manager who left (or became a
    viewer) since the request was written is simply not carried over."""
    role = (
        await db.execute(
            select(OrganizationMember.role).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == user_id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == MemberStatus.active,
            )
        )
    ).scalar_one_or_none()
    return role is not None and role != OrgRole.viewer


async def _validate_stage_criterion(
    db: AsyncSession, org_id: uuid.UUID, criterion_id: uuid.UUID
) -> None:
    """GAP (0052): the request may point at a Step 5i stage exit criterion.
    Only startups have stages, and only active exit criteria qualify —
    422 at ``loc: [body, stage_criterion_id]`` otherwise."""
    org_type = (
        await db.execute(select(Organization.type).where(Organization.id == org_id))
    ).scalar_one_or_none()
    message: str | None = None
    if org_type != OrgType.startup:
        message = "Stage criteria apply to startup organizations only."
    else:
        criterion = await db.get(ReadinessCriterion, criterion_id)
        if criterion is None or not criterion.is_active or not criterion.is_exit_criterion:
            message = "Choose an active stage exit criterion."
    if message is not None:
        raise validation_error(
            message,
            details=[
                {"loc": ["body", "stage_criterion_id"], "msg": message, "type": "value_error"}
            ],
        )


def _require_manager(member: OrganizationMember, action: str) -> None:
    if member.role not in MANAGERS:
        raise forbidden(f"Only owners and admins can {action}.")


def _audit(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    event: ActivityEventType,
    entity_id: uuid.UUID,
    summary: str,
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=summary,
        org_id=org_id,
        actor_id=user.id,
        entity_type="hiring_request",
        entity_id=entity_id,
    )


async def _read_many(db: AsyncSession, rows: list[HiringRequest]) -> list[HiringRequestRead]:
    """Rows -> reads with batched projections (actor display names, the
    converted job id) — no N+1 (7h hire pattern)."""
    if not rows:
        return []
    actor_ids = {
        actor
        for row in rows
        for actor in (row.requested_by, row.approver_id, row.hiring_manager_id)
        if actor is not None
    }
    names: dict[uuid.UUID, str] = {}
    if actor_ids:
        names = dict(
            (
                await db.execute(
                    select(User.id, User.display_name).where(User.id.in_(actor_ids))
                )
            ).all()
        )
    criterion_ids = {row.stage_criterion_id for row in rows if row.stage_criterion_id}
    criteria: dict[uuid.UUID, tuple[str, str | None]] = {}
    if criterion_ids:
        for cid, title, stage in (
            await db.execute(
                select(
                    ReadinessCriterion.id, ReadinessCriterion.title, ReadinessCriterion.stage
                ).where(ReadinessCriterion.id.in_(criterion_ids))
            )
        ).all():
            criteria[cid] = (title, stage.value if stage is not None else None)
    job_by_request: dict[uuid.UUID, uuid.UUID] = {}
    job_rows = (
        await db.execute(
            select(Job.id, Job.request_id).where(
                Job.request_id.in_([row.id for row in rows]),
                Job.deleted_at.is_(None),
            )
        )
    ).all()
    for job_id, request_id in job_rows:
        if request_id is not None:
            job_by_request[request_id] = job_id
    return [
        HiringRequestRead(
            id=row.id,
            org_id=row.org_id,
            role_title=row.role_title,
            department=row.department,
            headcount=row.headcount,
            urgency=row.urgency,
            requested_by=row.requested_by,
            requested_by_name=names.get(row.requested_by) if row.requested_by else None,
            approver_id=row.approver_id,
            approver_name=names.get(row.approver_id) if row.approver_id else None,
            target_start=row.target_start,
            budget_amount=row.budget_amount,
            currency=row.currency,
            employment_type=row.employment_type,
            work_mode=row.work_mode,
            hiring_manager_id=row.hiring_manager_id,
            hiring_manager_name=(
                names.get(row.hiring_manager_id) if row.hiring_manager_id else None
            ),
            skills=list(row.skills or []),
            why_now=row.why_now,
            justification=row.justification,
            stage_criterion_id=row.stage_criterion_id,
            stage_criterion_title=(
                criteria[row.stage_criterion_id][0]
                if row.stage_criterion_id in criteria
                else None
            ),
            stage_criterion_stage=(
                criteria[row.stage_criterion_id][1]
                if row.stage_criterion_id in criteria
                else None
            ),
            status=row.status,
            job_id=job_by_request.get(row.id),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


async def _read_one(db: AsyncSession, row: HiringRequest) -> HiringRequestRead:
    return (await _read_many(db, [row]))[0]


# ----------------------------------------------------------- org routes


async def create(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: HiringRequestCreate
) -> HiringRequestRead:
    """POST /organizations/{org_id}/hiring-requests — member+ may draft;
    ``submit`` decides draft vs pending; owner/admin alone may designate
    an approver (any other role setting one is 403)."""
    member = await authorize(db, user, org_id, write=True)
    if payload.approver_id is not None:
        _require_manager(member, "set an approver")
        await _validate_approver(db, member.org_id, payload.approver_id)
    if payload.hiring_manager_id is not None:
        await _validate_hiring_manager(db, member.org_id, payload.hiring_manager_id)
    if payload.stage_criterion_id is not None:
        await _validate_stage_criterion(db, member.org_id, payload.stage_criterion_id)
    row = HiringRequest(
        org_id=member.org_id,
        role_title=" ".join(payload.role_title.split()),
        department=payload.department.value if payload.department else None,
        headcount=payload.headcount,
        urgency=payload.urgency.value,
        requested_by=user.id,
        approver_id=payload.approver_id,
        target_start=payload.target_start,
        budget_amount=payload.budget_amount,
        currency=payload.currency,
        employment_type=payload.employment_type.value,
        work_mode=payload.work_mode.value,
        hiring_manager_id=payload.hiring_manager_id,
        skills=list(payload.skills),
        why_now=payload.why_now.value if payload.why_now else None,
        justification=payload.justification,
        stage_criterion_id=payload.stage_criterion_id,
        status="pending" if payload.submit else "draft",
    )
    db.add(row)
    await db.flush()
    _audit(
        db,
        user,
        member.org_id,
        ActivityEventType.hiring_request_created,
        row.id,
        "Hiring request created.",
    )
    await db.commit()
    await db.refresh(row)
    return await _read_one(db, row)


async def list_requests(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    status: HiringRequestStatus | None = None,
    sort: Literal["newest", "oldest"] = "newest",
    limit: int = 50,
    offset: int = 0,
) -> HiringRequestPage:
    """GET /organizations/{org_id}/hiring-requests — optional status
    filter, newest/oldest by created_at, standard page envelope."""
    await authorize(db, user, org_id)
    where = [HiringRequest.org_id == org_id]
    if status is not None:
        where.append(HiringRequest.status == status.value)
    total = (
        (
            await db.execute(
                select(func.count()).select_from(HiringRequest).where(*where)
            )
        ).scalar_one()
    )
    ordering = (
        (HiringRequest.created_at.desc(), HiringRequest.id.desc())
        if sort == "newest"
        else (HiringRequest.created_at.asc(), HiringRequest.id.asc())
    )
    rows = list(
        (
            await db.execute(
                select(HiringRequest)
                .where(*where)
                .order_by(*ordering)
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return HiringRequestPage(
        items=await _read_many(db, rows),
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(rows) < total,
    )


# ----------------------------------------------------------- row routes


async def detail(db: AsyncSession, user: User, request_id: uuid.UUID) -> HiringRequestRead:
    row = await _load(db, request_id)
    await _row_gate(db, user, row, write=False)
    return await _read_one(db, row)


async def patch(
    db: AsyncSession, user: User, request_id: uuid.UUID, payload: HiringRequestUpdate
) -> HiringRequestRead:
    """PATCH /hiring-requests/{id} — content while draft|pending;
    approver reassignment (or clearing) needs owner/admin; ``status``
    intents are submit (draft -> pending, any member) and cancel
    (requester or owner/admin, draft|pending -> cancelled)."""
    row = await _load(db, request_id, lock=True)
    member = await _row_gate(db, user, row, write=True)
    fields = payload.model_fields_set
    if not fields:
        return await _read_one(db, row)

    content_fields = fields - {"status", "approver_id"}
    if content_fields and row.status not in _EDITABLE:
        raise conflict("This request can no longer be edited.", "REQUEST_FROZEN")

    changed = False
    if "role_title" in fields and payload.role_title is not None:
        row.role_title = " ".join(payload.role_title.split())
        changed = True
    if "department" in fields:
        row.department = payload.department.value if payload.department else None
        changed = True
    if "headcount" in fields and payload.headcount is not None:
        row.headcount = payload.headcount
        changed = True
    if "urgency" in fields and payload.urgency is not None:
        row.urgency = payload.urgency.value
        changed = True
    if "target_start" in fields:
        row.target_start = payload.target_start
        changed = True
    if "budget_amount" in fields:
        row.budget_amount = payload.budget_amount
        changed = True
    if "currency" in fields and payload.currency is not None:
        row.currency = payload.currency
        changed = True
    if "employment_type" in fields and payload.employment_type is not None:
        row.employment_type = payload.employment_type.value
        changed = True
    if "work_mode" in fields and payload.work_mode is not None:
        row.work_mode = payload.work_mode.value
        changed = True
    if "hiring_manager_id" in fields:
        if payload.hiring_manager_id is not None:
            await _validate_hiring_manager(db, row.org_id, payload.hiring_manager_id)
        row.hiring_manager_id = payload.hiring_manager_id
        changed = True
    if "skills" in fields and payload.skills is not None:
        row.skills = list(payload.skills)
        changed = True
    if "why_now" in fields:
        row.why_now = payload.why_now.value if payload.why_now else None
        changed = True
    if "justification" in fields:
        row.justification = payload.justification
        changed = True
    if "stage_criterion_id" in fields:
        if payload.stage_criterion_id is not None:
            await _validate_stage_criterion(db, row.org_id, payload.stage_criterion_id)
        row.stage_criterion_id = payload.stage_criterion_id
        changed = True

    if "approver_id" in fields:
        _require_manager(member, "set or change the approver")
        if row.status not in _EDITABLE:
            raise conflict("This request can no longer be edited.", "REQUEST_FROZEN")
        if payload.approver_id is not None:
            await _validate_approver(db, row.org_id, payload.approver_id)
        row.approver_id = payload.approver_id
        changed = True

    intent = payload.status if "status" in fields else None
    if intent == "pending":
        if row.status != "draft":
            raise conflict(
                "Only a draft request can be submitted.", "REQUEST_INVALID_TRANSITION"
            )
        row.status = "pending"
        changed = True
    elif intent == "cancelled":
        if row.status not in _EDITABLE:
            raise conflict(
                "Only a draft or pending request can be cancelled.",
                "REQUEST_INVALID_TRANSITION",
            )
        if member.role not in MANAGERS and row.requested_by != user.id:
            raise forbidden("Only the requester or an owner/admin can cancel.")
        row.status = "cancelled"
        changed = True

    if not changed:
        return await _read_one(db, row)
    if intent == "cancelled":
        event = ActivityEventType.hiring_request_cancelled
        summary = "Hiring request cancelled."
    else:
        event = ActivityEventType.hiring_request_updated
        summary = "Hiring request updated."
    _audit(db, user, row.org_id, event, row.id, summary)
    await db.commit()
    await db.refresh(row)
    return await _read_one(db, row)


async def approve(db: AsyncSession, user: User, request_id: uuid.UUID) -> HiringRequestRead:
    """POST /hiring-requests/{id}/approve — the designated approver only
    (re-checked as an active owner/admin at decision time); with no
    designation, any owner/admin may approve."""
    return await _decide(db, user, request_id, approve=True)


async def reject(db: AsyncSession, user: User, request_id: uuid.UUID) -> HiringRequestRead:
    """POST /hiring-requests/{id}/reject — same caller rule as approve."""
    return await _decide(db, user, request_id, approve=False)


async def _decide(
    db: AsyncSession, user: User, request_id: uuid.UUID, *, approve: bool
) -> HiringRequestRead:
    row = await _load(db, request_id, lock=True)
    member = await _row_gate(db, user, row, write=True)
    if row.status != "pending":
        raise conflict("Only a pending request can be decided.", "REQUEST_NOT_PENDING")
    if row.approver_id is not None:
        if user.id != row.approver_id:
            raise forbidden("Only the designated approver can decide this request.")
        # Re-validate at decision time: a demoted approver cannot act
        # (an owner reassigns via PATCH while the request is pending).
        designated_role = (
            await db.execute(
                select(OrganizationMember.role).where(
                    OrganizationMember.org_id == row.org_id,
                    OrganizationMember.user_id == row.approver_id,
                    OrganizationMember.deleted_at.is_(None),
                    OrganizationMember.status == MemberStatus.active,
                )
            )
        ).scalar_one_or_none()
        if designated_role not in MANAGERS:
            raise forbidden("Only the designated approver can decide this request.")
    elif member.role not in MANAGERS:
        raise forbidden("Only owners and admins can decide this request.")
    if approve:
        row.status = "approved"
        event = ActivityEventType.hiring_request_approved
        summary = "Hiring request approved."
    else:
        row.status = "rejected"
        event = ActivityEventType.hiring_request_rejected
        summary = "Hiring request rejected."
    _audit(db, user, row.org_id, event, row.id, summary)
    await db.commit()
    await db.refresh(row)
    return await _read_one(db, row)


async def convert(db: AsyncSession, user: User, request_id: uuid.UUID) -> JobRead:
    """POST /hiring-requests/{id}/convert — owner/admin only, approved
    only. Builds a JobCreate from the request (server-side mapping, the
    client never sees these fields), calls job_service.create with the
    server-only ``request_id`` kwarg, and flips the request to
    fulfilled. The status flip and its audit ride the same transaction
    job_service.create commits (see module docstring)."""
    row = await _load(db, request_id, lock=True)
    member = await _row_gate(db, user, row, write=True)
    _require_manager(member, "convert requests")
    if row.status != "approved":
        raise conflict("Only an approved request can be converted.", "REQUEST_NOT_APPROVED")
    owner_id = (
        row.hiring_manager_id
        if row.hiring_manager_id is not None
        and await _still_owner_ref(db, row.org_id, row.hiring_manager_id)
        else None
    )
    skills = await talent_service.resolve_skills(db, list(row.skills or []))
    job_payload = JobCreate(
        title=" ".join(row.role_title.split()),
        department=Department(row.department) if row.department else None,
        openings=row.headcount,
        salary_max=row.budget_amount,
        currency=row.currency,
        employment_type=EmploymentType(row.employment_type),
        work_mode=WorkMode(row.work_mode),
        owner_id=owner_id,
        skills=[JobSkillInput(skill_id=skill.id) for skill in skills],
        # The approved budget is internal; publishing is a later,
        # deliberate act on the job itself.
        show_salary_publicly=False,
    )
    row.status = "fulfilled"
    _audit(
        db,
        user,
        row.org_id,
        ActivityEventType.hiring_request_converted,
        row.id,
        "Hiring request converted into a draft job.",
    )
    from app.services.job_service import create as create_job

    job = await create_job(db, user, row.org_id, job_payload, request_id=row.id)
    await db.refresh(row)
    return job
