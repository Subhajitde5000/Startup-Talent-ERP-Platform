"""Step 9f service: engagement requests and meetings.

Authorization mirrors the 9e/9i/9j precedent:

- **Investor side** (``/investors/requests``, ``/investors/meetings``):
  the caller's active ``investor_firm`` org is resolved server-side
  (``_investor_org_or_404``). Reads: any active member. Writes:
  owner/admin/member (viewer 403). Rows are org-scoped — another
  firm's request or meeting is a **404**, never 403 (no existence
  oracle).
- **Startup side** (``/organizations/{org_id}/investor-requests``,
  ``/investor-meetings``): org membership required; the target
  startup must be an active startup org; rows are scoped to that org
  (a foreign-org row is a 404).

Request lifecycle: ``pending -> accepted | declined | withdrawn |
expired``; terminal states reject further transitions (409). Withdraw
is investor-side; accept/decline is startup-side (D2). Expiry is lazy
on read, same pattern as 9i offers: due ``pending`` requests are
expired via a single bulk UPDATE before the read is served.

Meetings: ``proposed -> confirmed | cancelled | completed``;
cancelled and completed are terminal. A startup PATCH that changes
the datetime or duration of a ``confirmed`` meeting re-proposes it
(status returns to ``proposed``) — D5.

``decline_reason`` on a request is **investor-private**: the
startup-side read schema omits it, and it is never returned through
the startup routes.

Every mutation writes an ``activity_events`` row in the SAME
transaction (the 5i/9e pattern).
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.investor_deal import InvestorDeal
from app.models.investor_engagement import (
    InvestorEngagementRequest,
    InvestorMeeting,
    MeetingStatus,
    MeetingType,
    RequestKind,
    RequestStatus,
)
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.user import User
from app.schemas.investor_engagement import (
    EngagementRequestCreate,
    EngagementRequestRead,
    EngagementRequestStartupRead,
    EngagementRequestUpdate,
    MeetingCreate,
    MeetingRead,
    MeetingUpdate,
)
from app.services import activity_service, organization_service, rate_limiter

WRITE_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}

_REQUEST_TRANSITIONS: dict[RequestStatus, frozenset[RequestStatus]] = {
    RequestStatus.pending: frozenset(
        {
            RequestStatus.accepted,
            RequestStatus.declined,
            RequestStatus.withdrawn,
            RequestStatus.expired,
        }
    ),
    # accepted/declined/withdrawn/expired are terminal.
    RequestStatus.accepted: frozenset(),
    RequestStatus.declined: frozenset(),
    RequestStatus.withdrawn: frozenset(),
    RequestStatus.expired: frozenset(),
}

_MEETING_TRANSITIONS: dict[MeetingStatus, frozenset[MeetingStatus]] = {
    MeetingStatus.proposed: frozenset(
        {
            MeetingStatus.confirmed,
            MeetingStatus.cancelled,
            MeetingStatus.completed,
        }
    ),
    MeetingStatus.confirmed: frozenset(
        {MeetingStatus.cancelled, MeetingStatus.completed}
    ),
    MeetingStatus.cancelled: frozenset(),
    MeetingStatus.completed: frozenset(),
}


async def _enforce_engagement_write_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"engagement_write:user:{user.id}",
        settings.ENGAGEMENT_WRITE_LIMIT,
        settings.ENGAGEMENT_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many engagement changes. Please slow down.")


async def _enforce_request_daily_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.rate_limiter.check(
        f"engagement_request_daily:user:{user.id}",
        settings.INVESTOR_REQUEST_DAILY_LIMIT,
        settings.INVESTOR_REQUEST_DAILY_WINDOW_SECONDS,
    ):
        raise rate_limited(
            "You have reached the daily limit for investor requests."
        )


async def _investor_org_or_404(db: AsyncSession, user: User) -> Organization:
    """The caller's active ``investor_firm`` organization, or 404."""
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


async def _validate_deal_ref(
    db: AsyncSession, investor_org_id: uuid.UUID, deal_id: uuid.UUID | None
) -> None:
    """A deal_id, if given, must be a live deal of THIS firm."""
    if deal_id is None:
        return
    result = await db.execute(
        select(InvestorDeal.id).where(
            InvestorDeal.id == deal_id,
            InvestorDeal.investor_org_id == investor_org_id,
            InvestorDeal.deleted_at.is_(None),
        )
    )
    if result.first() is None:
        raise validation_error(
            "deal_id must be a live deal of this firm.",
            details=[
                {"loc": ["body", "deal_id"], "msg": "Invalid deal.", "type": "value_error"}
            ],
        )


async def _validate_request_ref(
    db: AsyncSession, investor_org_id: uuid.UUID, request_id: uuid.UUID | None
) -> None:
    """A request_id, if given, must be a live request of THIS firm."""
    if request_id is None:
        return
    result = await db.execute(
        select(InvestorEngagementRequest.id).where(
            InvestorEngagementRequest.id == request_id,
            InvestorEngagementRequest.investor_org_id == investor_org_id,
            InvestorEngagementRequest.deleted_at.is_(None),
        )
    )
    if result.first() is None:
        raise validation_error(
            "request_id must be a live engagement request of this firm.",
            details=[
                {"loc": ["body", "request_id"], "msg": "Invalid request.", "type": "value_error"}
            ],
        )


def _check_request_transition(
    current: RequestStatus, target: RequestStatus
) -> None:
    if target not in _REQUEST_TRANSITIONS.get(current, frozenset()):
        raise conflict(f"Cannot move a request from {current.value} to {target.value}.")


def _check_meeting_transition(
    current: MeetingStatus, target: MeetingStatus
) -> None:
    if target not in _MEETING_TRANSITIONS.get(current, frozenset()):
        raise conflict(f"Cannot move a meeting from {current.value} to {target.value}.")


async def _expire_due_requests(db: AsyncSession, investor_org_id: uuid.UUID) -> None:
    """Lazy expiry: due pending requests of this firm -> expired."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(InvestorEngagementRequest).where(
            InvestorEngagementRequest.investor_org_id == investor_org_id,
            InvestorEngagementRequest.status == RequestStatus.pending,
            InvestorEngagementRequest.expires_on.is_not(None),
            InvestorEngagementRequest.expires_on <= now,
        )
    )
    due = result.scalars().all()
    for request in due:
        activity_service.record(
            db,
            event_type=ActivityEventType.engagement_request_expired,
            summary=f"Engagement request expired: {request.ask}",
            org_id=investor_org_id,
            actor_id=request.created_by,
            entity_type="engagement_request",
            entity_id=request.id,
        )
        request.status = RequestStatus.expired
    if due:
        await db.commit()


async def _org_name_map(
    db: AsyncSession, org_ids: set[uuid.UUID]
) -> dict[uuid.UUID, tuple[str, str]]:
    """Map org id -> (name, slug) for the given orgs (empty when none)."""
    if not org_ids:
        return {}
    result = await db.execute(
        select(Organization.id, Organization.name, Organization.slug).where(
            Organization.id.in_(org_ids)
        )
    )
    return {row.id: (row.name, row.slug) for row in result}


def _as_request_read(
    request: InvestorEngagementRequest,
    names: dict[uuid.UUID, tuple[str, str]],
) -> EngagementRequestRead:
    startup_name, startup_slug = names.get(request.startup_org_id, ("", ""))
    return EngagementRequestRead(
        id=request.id,
        investor_org_id=request.investor_org_id,
        startup_org_id=request.startup_org_id,
        startup_name=startup_name,
        startup_slug=startup_slug,
        deal_id=request.deal_id,
        kind=request.kind.value,
        ask=request.ask,
        message=request.message,
        status=request.status.value,
        response_note=request.response_note,
        decline_reason=request.decline_reason,
        expires_on=request.expires_on,
        owner_id=request.owner_id,
        created_by=request.created_by,
        created_at=request.created_at,
        updated_at=request.updated_at,
    )


def _as_startup_request_read(
    request: InvestorEngagementRequest,
    names: dict[uuid.UUID, tuple[str, str]],
) -> EngagementRequestStartupRead:
    """Startup-side view — ``decline_reason`` is investor-private."""
    investor_name, investor_slug = names.get(request.investor_org_id, ("", ""))
    return EngagementRequestStartupRead(
        id=request.id,
        investor_org_id=request.investor_org_id,
        startup_org_id=request.startup_org_id,
        investor_name=investor_name,
        investor_slug=investor_slug,
        deal_id=request.deal_id,
        kind=request.kind.value,
        ask=request.ask,
        message=request.message,
        status=request.status.value,
        response_note=request.response_note,
        expires_on=request.expires_on,
        created_at=request.created_at,
        updated_at=request.updated_at,
    )


def _as_meeting_read(
    meeting: InvestorMeeting,
    names: dict[uuid.UUID, tuple[str, str]],
) -> MeetingRead:
    startup_name, startup_slug = names.get(meeting.startup_org_id, ("", ""))
    investor_name, investor_slug = names.get(meeting.investor_org_id, ("", ""))
    return MeetingRead(
        id=meeting.id,
        investor_org_id=meeting.investor_org_id,
        startup_org_id=meeting.startup_org_id,
        startup_name=startup_name,
        startup_slug=startup_slug,
        investor_name=investor_name,
        investor_slug=investor_slug,
        request_id=meeting.request_id,
        deal_id=meeting.deal_id,
        meeting_type=meeting.meeting_type.value,
        scheduled_at=meeting.scheduled_at,
        duration_minutes=meeting.duration_minutes,
        agenda=meeting.agenda,
        status=meeting.status.value,
        location=meeting.location,
        organizer_org_id=meeting.organizer_org_id,
        created_by=meeting.created_by,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
    )


async def _request_or_404(
    db: AsyncSession, investor_org_id: uuid.UUID, request_id: uuid.UUID
) -> InvestorEngagementRequest:
    result = await db.execute(
        select(InvestorEngagementRequest).where(
            InvestorEngagementRequest.id == request_id,
            InvestorEngagementRequest.investor_org_id == investor_org_id,
            InvestorEngagementRequest.deleted_at.is_(None),
        )
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise not_found("Engagement request not found.")
    return request


async def _startup_request_or_404(
    db: AsyncSession, startup_org_id: uuid.UUID, request_id: uuid.UUID
) -> InvestorEngagementRequest:
    result = await db.execute(
        select(InvestorEngagementRequest).where(
            InvestorEngagementRequest.id == request_id,
            InvestorEngagementRequest.startup_org_id == startup_org_id,
            InvestorEngagementRequest.deleted_at.is_(None),
        )
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise not_found("Engagement request not found.")
    return request


async def _meeting_or_404(
    db: AsyncSession, investor_org_id: uuid.UUID, meeting_id: uuid.UUID
) -> InvestorMeeting:
    result = await db.execute(
        select(InvestorMeeting).where(
            InvestorMeeting.id == meeting_id,
            InvestorMeeting.investor_org_id == investor_org_id,
            InvestorMeeting.deleted_at.is_(None),
        )
    )
    meeting = result.scalar_one_or_none()
    if meeting is None:
        raise not_found("Meeting not found.")
    return meeting


async def _startup_meeting_or_404(
    db: AsyncSession, startup_org_id: uuid.UUID, meeting_id: uuid.UUID
) -> InvestorMeeting:
    result = await db.execute(
        select(InvestorMeeting).where(
            InvestorMeeting.id == meeting_id,
            InvestorMeeting.startup_org_id == startup_org_id,
            InvestorMeeting.deleted_at.is_(None),
        )
    )
    meeting = result.scalar_one_or_none()
    if meeting is None:
        raise not_found("Meeting not found.")
    return meeting


# ---------------------------------------------------------------------------
# Investor-side: requests
# ---------------------------------------------------------------------------
async def list_requests(
    db: AsyncSession,
    user: User,
    *,
    status: RequestStatus | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[EngagementRequestRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    await _expire_due_requests(db, org.id)

    filters = [InvestorEngagementRequest.investor_org_id == org.id]
    if status is not None:
        filters.append(InvestorEngagementRequest.status == status)
    total = (
        await db.execute(
            select(func.count())
            .select_from(InvestorEngagementRequest)
            .where(*filters, InvestorEngagementRequest.deleted_at.is_(None))
        )
    ).scalar_one()
    result = await db.execute(
        select(InvestorEngagementRequest)
        .where(*filters, InvestorEngagementRequest.deleted_at.is_(None))
        .order_by(InvestorEngagementRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()
    names = await _org_name_map(
        db, {r.startup_org_id for r in rows}
    )
    return [_as_request_read(r, names) for r in rows], total


async def get_request(
    db: AsyncSession, user: User, request_id: uuid.UUID
) -> EngagementRequestRead:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    await _expire_due_requests(db, org.id)
    request = await _request_or_404(db, org.id, request_id)
    names = await _org_name_map(db, {request.startup_org_id})
    return _as_request_read(request, names)


async def create_request(
    db: AsyncSession, user: User, payload: EngagementRequestCreate
) -> EngagementRequestRead:
    await _enforce_request_daily_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _validate_deal_ref(db, org.id, payload.deal_id)
    startup = await organization_service.startup_org_or_404(db, payload.startup_org_id)
    if startup.id == org.id:
        raise validation_error("An investor firm cannot request itself.")
    request = await _live_request_for_kind(
        db, org.id, startup.id, RequestKind(payload.kind)
    )
    if request is not None:
        raise conflict(
            "An open request of this kind already exists for this startup."
        )

    now = datetime.now(UTC)
    request = InvestorEngagementRequest(
        investor_org_id=org.id,
        startup_org_id=startup.id,
        deal_id=payload.deal_id,
        kind=RequestKind(payload.kind),
        ask=payload.ask,
        message=payload.message,
        status=RequestStatus.pending,
        expires_on=now + timedelta(days=payload.expires_in_days),
        owner_id=user.id,
        created_by=user.id,
    )
    db.add(request)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.engagement_request_created,
        summary=f"Engagement request sent: {request.ask}",
        org_id=org.id,
        actor_id=user.id,
        entity_type="engagement_request",
        entity_id=request.id,
        data={"kind": request.kind.value, "startup_org_id": str(startup.id)},
    )
    await db.commit()
    await db.refresh(request)
    names = {startup.id: (startup.name, startup.slug)}
    return _as_request_read(request, names)


async def _live_request_for_kind(
    db: AsyncSession,
    investor_org_id: uuid.UUID,
    startup_org_id: uuid.UUID,
    kind: RequestKind,
) -> InvestorEngagementRequest | None:
    result = await db.execute(
        select(InvestorEngagementRequest).where(
            InvestorEngagementRequest.investor_org_id == investor_org_id,
            InvestorEngagementRequest.startup_org_id == startup_org_id,
            InvestorEngagementRequest.kind == kind,
            InvestorEngagementRequest.deleted_at.is_(None),
            InvestorEngagementRequest.status.in_(
                [
                    RequestStatus.pending,
                    RequestStatus.accepted,
                ]
            ),
        )
    )
    return result.scalar_one_or_none()


async def update_request(
    db: AsyncSession,
    user: User,
    request_id: uuid.UUID,
    payload: EngagementRequestUpdate,
) -> EngagementRequestRead:
    await _enforce_engagement_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _expire_due_requests(db, org.id)
    request = await _request_or_404(db, org.id, request_id)
    if request.status in (
        RequestStatus.declined,
        RequestStatus.withdrawn,
        RequestStatus.expired,
    ):
        raise conflict("A closed request cannot be edited.")

    changed = False
    if payload.ask is not None and payload.ask != request.ask:
        request.ask = payload.ask
        changed = True
    if payload.message is not None and payload.message != request.message:
        request.message = payload.message
        changed = True
    if changed:
        activity_service.record(
            db,
            event_type=ActivityEventType.engagement_request_updated,
            summary=f"Engagement request updated: {request.ask}",
            org_id=org.id,
            actor_id=user.id,
            entity_type="engagement_request",
            entity_id=request.id,
        )
        await db.commit()
        await db.refresh(request)
    names = await _org_name_map(db, {request.startup_org_id})
    return _as_request_read(request, names)


async def withdraw_request(
    db: AsyncSession, user: User, request_id: uuid.UUID
) -> EngagementRequestRead:
    await _enforce_engagement_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _expire_due_requests(db, org.id)
    request = await _request_or_404(db, org.id, request_id)
    _check_request_transition(request.status, RequestStatus.withdrawn)
    request.status = RequestStatus.withdrawn
    activity_service.record(
        db,
        event_type=ActivityEventType.engagement_request_withdrawn,
        summary=f"Engagement request withdrawn: {request.ask}",
        org_id=org.id,
        actor_id=user.id,
        entity_type="engagement_request",
        entity_id=request.id,
    )
    await db.commit()
    await db.refresh(request)
    names = await _org_name_map(db, {request.startup_org_id})
    return _as_request_read(request, names)


# ---------------------------------------------------------------------------
# Startup-side: requests
# ---------------------------------------------------------------------------
async def list_startup_requests(
    db: AsyncSession,
    org: Organization,
    user: User,
    *,
    status: RequestStatus | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[EngagementRequestStartupRead], int]:
    await organization_service.require_membership(db, org.id, user)
    filters = [InvestorEngagementRequest.startup_org_id == org.id]
    if status is not None:
        filters.append(InvestorEngagementRequest.status == status)
    total = (
        await db.execute(
            select(func.count())
            .select_from(InvestorEngagementRequest)
            .where(*filters, InvestorEngagementRequest.deleted_at.is_(None))
        )
    ).scalar_one()
    result = await db.execute(
        select(InvestorEngagementRequest)
        .where(*filters, InvestorEngagementRequest.deleted_at.is_(None))
        .order_by(InvestorEngagementRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()
    names = await _org_name_map(db, {r.investor_org_id for r in rows})
    return [_as_startup_request_read(r, names) for r in rows], total


async def get_startup_request(
    db: AsyncSession, org: Organization, user: User, request_id: uuid.UUID
) -> EngagementRequestStartupRead:
    await organization_service.require_membership(db, org.id, user)
    request = await _startup_request_or_404(db, org.id, request_id)
    names = await _org_name_map(db, {request.investor_org_id})
    return _as_startup_request_read(request, names)


async def respond_to_request(
    db: AsyncSession,
    org: Organization,
    user: User,
    request_id: uuid.UUID,
    *,
    decision: str,
    response_note: str | None = None,
    decline_reason: str | None = None,
) -> EngagementRequestStartupRead:
    await _enforce_engagement_write_limit(user)
    await organization_service.require_membership(
        db, org.id, user, roles=WRITE_ROLES
    )
    request = await _startup_request_or_404(db, org.id, request_id)
    if decision == "accept":
        target = RequestStatus.accepted
        _check_request_transition(request.status, target)
        request.status = target
        event_type = ActivityEventType.engagement_request_accepted
        action = "accepted"
    else:
        target = RequestStatus.declined
        _check_request_transition(request.status, target)
        request.status = target
        request.decline_reason = decline_reason
        event_type = ActivityEventType.engagement_request_declined
        action = "declined"
    if response_note is not None:
        request.response_note = response_note
    activity_service.record(
        db,
        event_type=event_type,
        summary=f"Engagement request {action}: {request.ask}",
        org_id=org.id,
        actor_id=user.id,
        entity_type="engagement_request",
        entity_id=request.id,
    )
    await db.commit()
    await db.refresh(request)
    names = await _org_name_map(db, {request.investor_org_id})
    return _as_startup_request_read(request, names)


# ---------------------------------------------------------------------------
# Meetings
# ---------------------------------------------------------------------------
async def list_meetings(
    db: AsyncSession,
    user: User,
    *,
    status: MeetingStatus | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[MeetingRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    filters = [InvestorMeeting.investor_org_id == org.id]
    if status is not None:
        filters.append(InvestorMeeting.status == status)
    total = (
        await db.execute(
            select(func.count())
            .select_from(InvestorMeeting)
            .where(*filters, InvestorMeeting.deleted_at.is_(None))
        )
    ).scalar_one()
    result = await db.execute(
        select(InvestorMeeting)
        .where(*filters, InvestorMeeting.deleted_at.is_(None))
        .order_by(InvestorMeeting.scheduled_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()
    names = await _org_name_map(
        db, {m.startup_org_id for m in rows} | {m.investor_org_id for m in rows}
    )
    return [_as_meeting_read(m, names) for m in rows], total


async def get_meeting(
    db: AsyncSession, user: User, meeting_id: uuid.UUID
) -> MeetingRead:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=False)
    meeting = await _meeting_or_404(db, org.id, meeting_id)
    names = await _org_name_map(
        db, {meeting.startup_org_id, meeting.investor_org_id}
    )
    return _as_meeting_read(meeting, names)


async def create_meeting(
    db: AsyncSession, user: User, payload: MeetingCreate
) -> MeetingRead:
    await _enforce_engagement_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    await _validate_deal_ref(db, org.id, payload.deal_id)
    await _validate_request_ref(db, org.id, payload.request_id)
    startup = await organization_service.startup_org_or_404(db, payload.startup_org_id)
    if startup.id == org.id:
        raise validation_error("An investor firm cannot meet itself.")

    meeting = InvestorMeeting(
        investor_org_id=org.id,
        startup_org_id=startup.id,
        request_id=payload.request_id,
        deal_id=payload.deal_id,
        meeting_type=MeetingType(payload.meeting_type),
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        agenda=payload.agenda,
        status=MeetingStatus.proposed,
        location=payload.location,
        organizer_org_id=org.id,
        created_by=user.id,
    )
    db.add(meeting)
    await db.flush()
    activity_service.record(
        db,
        event_type=ActivityEventType.meeting_created,
        summary=f"Meeting proposed: {meeting.meeting_type.value}",
        org_id=org.id,
        actor_id=user.id,
        entity_type="meeting",
        entity_id=meeting.id,
        data={"scheduled_at": meeting.scheduled_at.isoformat(), "startup_org_id": str(startup.id)},
    )
    await db.commit()
    await db.refresh(meeting)
    names = {
        startup.id: (startup.name, startup.slug),
        org.id: (org.name, org.slug),
    }
    return _as_meeting_read(meeting, names)


async def update_meeting(
    db: AsyncSession,
    user: User,
    meeting_id: uuid.UUID,
    payload: MeetingUpdate,
) -> MeetingRead:
    await _enforce_engagement_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    meeting = await _meeting_or_404(db, org.id, meeting_id)
    if meeting.status in (MeetingStatus.cancelled, MeetingStatus.completed):
        raise conflict("A cancelled or completed meeting cannot be edited.")

    changed = False
    if payload.meeting_type is not None:
        meeting.meeting_type = MeetingType(payload.meeting_type)
        changed = True
    if payload.scheduled_at is not None:
        meeting.scheduled_at = payload.scheduled_at
        changed = True
    if payload.duration_minutes is not None:
        meeting.duration_minutes = payload.duration_minutes
        changed = True
    if payload.agenda is not None:
        meeting.agenda = payload.agenda
        changed = True
    if payload.location is not None:
        meeting.location = payload.location
        changed = True
    if changed and meeting.status == MeetingStatus.confirmed:
        # D5: a confirmed meeting whose schedule changes is re-proposed.
        meeting.status = MeetingStatus.proposed
    if changed:
        activity_service.record(
            db,
            event_type=ActivityEventType.meeting_updated,
            summary=f"Meeting updated: {meeting.meeting_type.value}",
            org_id=org.id,
            actor_id=user.id,
            entity_type="meeting",
            entity_id=meeting.id,
        )
        await db.commit()
        await db.refresh(meeting)
    names = await _org_name_map(
        db, {meeting.startup_org_id, meeting.investor_org_id}
    )
    return _as_meeting_read(meeting, names)


async def transition_meeting(
    db: AsyncSession, user: User, meeting_id: uuid.UUID, target: MeetingStatus
) -> MeetingRead:
    await _enforce_engagement_write_limit(user)
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user, write=True)
    meeting = await _meeting_or_404(db, org.id, meeting_id)
    _check_meeting_transition(meeting.status, target)
    meeting.status = target
    activity_service.record(
        db,
        event_type=ActivityEventType.meeting_status_changed,
        summary=f"Meeting status changed to {target.value}",
        org_id=org.id,
        actor_id=user.id,
        entity_type="meeting",
        entity_id=meeting.id,
    )
    await db.commit()
    await db.refresh(meeting)
    names = await _org_name_map(
        db, {meeting.startup_org_id, meeting.investor_org_id}
    )
    return _as_meeting_read(meeting, names)


async def list_startup_meetings(
    db: AsyncSession,
    org: Organization,
    user: User,
    *,
    status: MeetingStatus | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[MeetingRead], int]:
    await organization_service.require_membership(db, org.id, user)
    filters = [InvestorMeeting.startup_org_id == org.id]
    if status is not None:
        filters.append(InvestorMeeting.status == status)
    total = (
        await db.execute(
            select(func.count())
            .select_from(InvestorMeeting)
            .where(*filters, InvestorMeeting.deleted_at.is_(None))
        )
    ).scalar_one()
    result = await db.execute(
        select(InvestorMeeting)
        .where(*filters, InvestorMeeting.deleted_at.is_(None))
        .order_by(InvestorMeeting.scheduled_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = result.scalars().all()
    names = await _org_name_map(
        db, {m.startup_org_id for m in rows} | {m.investor_org_id for m in rows}
    )
    return [_as_meeting_read(m, names) for m in rows], total


async def get_startup_meeting(
    db: AsyncSession, org: Organization, user: User, meeting_id: uuid.UUID
) -> MeetingRead:
    await organization_service.require_membership(db, org.id, user)
    meeting = await _startup_meeting_or_404(db, org.id, meeting_id)
    names = await _org_name_map(
        db, {meeting.startup_org_id, meeting.investor_org_id}
    )
    return _as_meeting_read(meeting, names)


async def update_startup_meeting(
    db: AsyncSession,
    org: Organization,
    user: User,
    meeting_id: uuid.UUID,
    payload: MeetingUpdate,
) -> MeetingRead:
    await _enforce_engagement_write_limit(user)
    await organization_service.require_membership(
        db, org.id, user, roles=WRITE_ROLES
    )
    meeting = await _startup_meeting_or_404(db, org.id, meeting_id)
    if meeting.status in (MeetingStatus.cancelled, MeetingStatus.completed):
        raise conflict("A cancelled or completed meeting cannot be edited.")

    changed = False
    if payload.meeting_type is not None:
        meeting.meeting_type = MeetingType(payload.meeting_type)
        changed = True
    if payload.scheduled_at is not None:
        meeting.scheduled_at = payload.scheduled_at
        changed = True
    if payload.duration_minutes is not None:
        meeting.duration_minutes = payload.duration_minutes
        changed = True
    if payload.agenda is not None:
        meeting.agenda = payload.agenda
        changed = True
    if payload.location is not None:
        meeting.location = payload.location
        changed = True
    if changed and meeting.status == MeetingStatus.confirmed:
        # D5: a startup re-proposal returns the meeting to proposed.
        meeting.status = MeetingStatus.proposed
    if changed:
        activity_service.record(
            db,
            event_type=ActivityEventType.meeting_updated,
            summary=f"Meeting updated by startup: {meeting.meeting_type.value}",
            org_id=org.id,
            actor_id=user.id,
            entity_type="meeting",
            entity_id=meeting.id,
        )
        await db.commit()
        await db.refresh(meeting)
    names = await _org_name_map(
        db, {meeting.startup_org_id, meeting.investor_org_id}
    )
    return _as_meeting_read(meeting, names)


async def transition_startup_meeting(
    db: AsyncSession,
    org: Organization,
    user: User,
    meeting_id: uuid.UUID,
    target: MeetingStatus,
) -> MeetingRead:
    await _enforce_engagement_write_limit(user)
    await organization_service.require_membership(
        db, org.id, user, roles=WRITE_ROLES
    )
    meeting = await _startup_meeting_or_404(db, org.id, meeting_id)
    _check_meeting_transition(meeting.status, target)
    meeting.status = target
    activity_service.record(
        db,
        event_type=ActivityEventType.meeting_status_changed,
        summary=f"Meeting status changed to {target.value} (startup)",
        org_id=org.id,
        actor_id=user.id,
        entity_type="meeting",
        entity_id=meeting.id,
    )
    await db.commit()
    await db.refresh(meeting)
    names = await _org_name_map(
        db, {meeting.startup_org_id, meeting.investor_org_id}
    )
    return _as_meeting_read(meeting, names)


__all__ = [
    "create_meeting",
    "create_request",
    "get_meeting",
    "get_request",
    "get_startup_meeting",
    "get_startup_request",
    "list_meetings",
    "list_requests",
    "list_startup_meetings",
    "list_startup_requests",
    "respond_to_request",
    "transition_meeting",
    "transition_startup_meeting",
    "update_meeting",
    "update_request",
    "update_startup_meeting",
    "withdraw_request",
]
