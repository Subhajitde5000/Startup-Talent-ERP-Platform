"""Step 9m service: startup investor hub (read-only aggregates).

No new tables — every number here is computed from rows written by
Steps 9a–9j (and the 9l ``activity_events`` audit log), scoped to the
startup org resolved from the path.

- **Summary**: the hub's stat strip (open rounds, deals in pipeline,
  pending requests, meetings this month, offers received, commitments
  received), the primary round snapshot, needs-reply items (pending
  engagement requests), upcoming meetings, and a short recent-activity
  list. One call, no N+1.
- **Rounds**: every startup round with its investor-side progress
  (target, committed, progress %, status) and per-round investor counts
  (deals, offers, commitments).
- **Activity**: the startup's own org-scoped ``activity_events`` feed
  (paginated) plus aggregate stats — the same shape as the 9l investor
  activity endpoints, scoped to the startup instead.

Authorization: the startup org is resolved via
``organization_service.startup_org_or_404`` (wrong type / suspended /
deleted → 404, no existence oracle); the caller must be an active
member (owner/admin/member/viewer). Reads are read-only — there is no
write surface here, so no mass-assignment concern. The only write path
in 9m (visibility settings) reuses the 5a profile PATCH endpoint.
"""

import enum
from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent
from app.models.commitment import Commitment, CommitmentStatus
from app.models.funding_round import FundingRound, RoundStatus
from app.models.investor_deal import InvestorDeal
from app.models.investor_engagement import (
    InvestorEngagementRequest,
    InvestorMeeting,
    MeetingStatus,
    RequestStatus,
)
from app.models.investor_offer import InvestorOffer
from app.models.organization import Organization
from app.models.user import User
from app.schemas.investor_hub import (
    HubNeedsReplyItem,
    HubUpcomingMeetingItem,
    InvestorHubSummary,
    RoundProgress,
    RoundProgressPage,
)
from app.schemas.investor_workspace import (
    ActivityEventRead,
    ActivityStats,
    DailyCount,
)
from app.services import organization_service

# Round statuses counted as an "active raise" for the hub stat strip.
_ACTIVE_ROUND_STATUSES = (RoundStatus.open, RoundStatus.paused)
# Meeting statuses that count as upcoming / this-month.
_UPCOMING_MEETING_STATUSES = (MeetingStatus.proposed, MeetingStatus.confirmed)


async def _startup_org_or_404(db: AsyncSession, org_id) -> Organization:  # noqa: ANN001
    return await organization_service.startup_org_or_404(db, org_id)


async def _require_member(db: AsyncSession, org: Organization, user: User) -> None:
    await organization_service.require_membership(db, org.id, user)


def _as_activity_read(event: ActivityEvent) -> ActivityEventRead:
    return ActivityEventRead(
        id=event.id,
        org_id=event.org_id,
        user_id=event.user_id,
        event_type=event.event_type,
        entity_type=event.entity_type,
        entity_id=event.entity_id,
        summary=event.summary,
        link_url=event.link_url,
        created_at=event.created_at,
    )


def _progress_pct(committed: Decimal | None, target: Decimal | None) -> int | None:
    if target is None or target <= 0 or committed is None:
        return None
    return int(round(float(committed) / float(target) * 100))


def _enum_value(value) -> str:  # noqa: ANN001
    """Enum columns are stored as plain strings (see ``FundingRound``).

    Values read back from the DB are raw ``str`` even though the model
    annotates them as ``StrEnum`` — normalise both cases.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


async def _round_counts(db: AsyncSession, round_ids: Sequence) -> dict:  # noqa: ANN001
    """Per-round investor counts (deals / offers / commitments).

    One grouped query per entity so the rounds view stays O(1) queries
    regardless of how many rounds the startup has.
    """
    counts: dict[str, dict[str, int]] = {
        str(rid): {"deals": 0, "offers": 0, "commitments": 0} for rid in round_ids
    }
    if not round_ids:
        return counts

    deal_rows = (
        await db.execute(
            select(InvestorDeal.round_id, func.count())
            .where(InvestorDeal.round_id.in_(round_ids), InvestorDeal.deleted_at.is_(None))
            .group_by(InvestorDeal.round_id)
        )
    ).all()
    for round_id, count in deal_rows:
        counts[str(round_id)]["deals"] = count

    offer_rows = (
        await db.execute(
            select(InvestorOffer.round_id, func.count())
            .where(InvestorOffer.round_id.in_(round_ids), InvestorOffer.deleted_at.is_(None))
            .group_by(InvestorOffer.round_id)
        )
    ).all()
    for round_id, count in offer_rows:
        counts[str(round_id)]["offers"] = count

    commitment_rows = (
        await db.execute(
            select(Commitment.round_id, func.count())
            .where(Commitment.round_id.in_(round_ids))
            .group_by(Commitment.round_id)
        )
    ).all()
    for round_id, count in commitment_rows:
        counts[str(round_id)]["commitments"] = count

    return counts


def _round_progress(round_row: FundingRound, counts: dict) -> RoundProgress:
    c = counts.get(str(round_row.id), {})
    return RoundProgress(
        id=round_row.id,
        name=round_row.name,
        round_type=_enum_value(round_row.round_type),
        target_amount=round_row.target_amount,
        committed_amount=round_row.committed_amount,
        currency=round_row.currency,
        status=_enum_value(round_row.status),
        progress_pct=_progress_pct(round_row.committed_amount, round_row.target_amount),
        opens_on=round_row.opens_on,
        closes_on=round_row.closes_on,
        deal_count=c.get("deals", 0),
        offer_count=c.get("offers", 0),
        commitment_count=c.get("commitments", 0),
    )


async def _rounds_for_org(db: AsyncSession, org_id) -> list[FundingRound]:  # noqa: ANN001
    result = await db.execute(
        select(FundingRound)
        .where(
            FundingRound.org_id == org_id,
            FundingRound.deleted_at.is_(None),
        )
        .order_by(FundingRound.created_at.desc())
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
async def summary(db: AsyncSession, user: User, org_id) -> InvestorHubSummary:  # noqa: ANN001
    org = await _startup_org_or_404(db, org_id)
    await _require_member(db, org, user)
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rounds = await _rounds_for_org(db, org.id)
    round_ids = [r.id for r in rounds]
    counts = await _round_counts(db, round_ids)

    open_rounds = sum(1 for r in rounds if r.status in _ACTIVE_ROUND_STATUSES)

    deals_in_pipeline = (
        await db.execute(
            select(func.count())
            .select_from(InvestorDeal)
            .where(InvestorDeal.startup_org_id == org.id, InvestorDeal.deleted_at.is_(None))
        )
    ).scalar_one()

    # Pending requests that are not expired.
    pending_requests = (
        await db.execute(
            select(func.count())
            .select_from(InvestorEngagementRequest)
            .where(
                InvestorEngagementRequest.startup_org_id == org.id,
                InvestorEngagementRequest.status == RequestStatus.pending,
                InvestorEngagementRequest.deleted_at.is_(None),
                InvestorEngagementRequest.expires_on.is_(None)
                | (InvestorEngagementRequest.expires_on > now),
            )
        )
    ).scalar_one()

    # Meetings scheduled within the current calendar month — a range
    # comparison rather than ``date_trunc`` so the query is portable
    # across SQLite (tests) and PostgreSQL (prod).
    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1, day=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1, day=1)
    meetings_this_month = (
        await db.execute(
            select(func.count())
            .select_from(InvestorMeeting)
            .where(
                InvestorMeeting.startup_org_id == org.id,
                InvestorMeeting.status.in_([s.value for s in _UPCOMING_MEETING_STATUSES]),
                InvestorMeeting.deleted_at.is_(None),
                InvestorMeeting.scheduled_at >= month_start,
                InvestorMeeting.scheduled_at < next_month,
            )
        )
    ).scalar_one()

    # Offers received: distinct investors with an offer on this org's rounds.
    offers_received = 0
    if round_ids:
        offers_received = (
            await db.execute(
                select(func.count(func.distinct(InvestorOffer.investor_org_id))).where(
                    InvestorOffer.round_id.in_(round_ids),
                    InvestorOffer.deleted_at.is_(None),
                )
            )
        ).scalar_one()

    # Commitments received: non-cancelled commitments on this org's rounds.
    commitments_received = 0
    if round_ids:
        commitments_received = (
            await db.execute(
                select(func.count())
                .select_from(Commitment)
                .where(
                    Commitment.round_id.in_(round_ids),
                    Commitment.status != CommitmentStatus.cancelled,
                )
            )
        ).scalar_one()

    # Primary round: the active raise closing earliest; else the most
    # recent round; else None.
    primary_round: RoundProgress | None = None
    open_rounds_sorted = [r for r in rounds if r.status == RoundStatus.open]
    candidate = None
    if open_rounds_sorted:
        candidate = sorted(
            open_rounds_sorted,
            key=lambda r: (r.closes_on is None, r.closes_on or date.max, r.created_at),
        )[0]
    elif rounds:
        candidate = rounds[0]  # already newest-first
    if candidate is not None:
        primary_round = _round_progress(candidate, counts)

    # Needs reply: pending (non-expired) requests with the investor's name.
    needs_reply_rows = (
        await db.execute(
            select(InvestorEngagementRequest, Organization.name)
            .join(Organization, Organization.id == InvestorEngagementRequest.investor_org_id)
            .where(
                InvestorEngagementRequest.startup_org_id == org.id,
                InvestorEngagementRequest.status == RequestStatus.pending,
                InvestorEngagementRequest.deleted_at.is_(None),
                InvestorEngagementRequest.expires_on.is_(None)
                | (InvestorEngagementRequest.expires_on > now),
            )
            .order_by(InvestorEngagementRequest.created_at.desc())
            .limit(5)
        )
    ).all()
    needs_reply = [
        HubNeedsReplyItem(
            id=req.id,
            investor_org_id=req.investor_org_id,
            investor_name=name,
            kind=req.kind.value,
            ask=req.ask,
            created_at=req.created_at,
        )
        for req, name in needs_reply_rows
    ]

    # Upcoming meetings: future proposed/confirmed meetings with investor name.
    upcoming_rows = (
        await db.execute(
            select(InvestorMeeting, Organization.name)
            .join(Organization, Organization.id == InvestorMeeting.investor_org_id)
            .where(
                InvestorMeeting.startup_org_id == org.id,
                InvestorMeeting.status.in_([s.value for s in _UPCOMING_MEETING_STATUSES]),
                InvestorMeeting.deleted_at.is_(None),
                InvestorMeeting.scheduled_at > now,
            )
            .order_by(InvestorMeeting.scheduled_at.asc())
            .limit(5)
        )
    ).all()
    upcoming_meetings = [
        HubUpcomingMeetingItem(
            id=meeting.id,
            investor_org_id=meeting.investor_org_id,
            investor_name=name,
            meeting_type=meeting.meeting_type.value,
            scheduled_at=meeting.scheduled_at,
            status=meeting.status.value,
        )
        for meeting, name in upcoming_rows
    ]

    # Recent activity: the startup's own last 5 audit events.
    recent_activity_rows = (
        (
            await db.execute(
                select(ActivityEvent)
                .where(ActivityEvent.org_id == org.id)
                .order_by(ActivityEvent.created_at.desc())
                .limit(5)
            )
        )
        .scalars()
        .all()
    )

    return InvestorHubSummary(
        open_rounds=open_rounds,
        deals_in_pipeline=deals_in_pipeline,
        pending_requests=pending_requests,
        meetings_this_month=meetings_this_month,
        offers_received=offers_received,
        commitments_received=commitments_received,
        primary_round=primary_round,
        needs_reply=needs_reply,
        upcoming_meetings=upcoming_meetings,
        recent_activity=[_as_activity_read(e) for e in recent_activity_rows],
    )


# ---------------------------------------------------------------------------
# Rounds
# ---------------------------------------------------------------------------
async def rounds(
    db: AsyncSession,
    user: User,
    org_id,
    *,
    limit: int = 100,
    offset: int = 0,  # noqa: ANN001
) -> RoundProgressPage:
    org = await _startup_org_or_404(db, org_id)
    await _require_member(db, org, user)

    all_rounds = await _rounds_for_org(db, org.id)
    total = len(all_rounds)
    page = all_rounds[offset : offset + limit]
    counts = await _round_counts(db, [r.id for r in page])
    items = [_round_progress(r, counts) for r in page]
    return RoundProgressPage(items=items, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Activity (startup-org-scoped, same shape as 9l investor activity)
# ---------------------------------------------------------------------------
async def list_activity(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    *,
    event_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[ActivityEventRead], int]:
    org = await _startup_org_or_404(db, org_id)
    await _require_member(db, org, user)
    filters = [ActivityEvent.org_id == org.id]
    if event_type is not None:
        filters.append(ActivityEvent.event_type == event_type)
    total = (
        await db.execute(select(func.count()).select_from(ActivityEvent).where(*filters))
    ).scalar_one()
    result = await db.execute(
        select(ActivityEvent)
        .where(*filters)
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_as_activity_read(e) for e in result.scalars().all()], total


async def activity_stats(db: AsyncSession, user: User, org_id) -> ActivityStats:  # noqa: ANN001
    org = await _startup_org_or_404(db, org_id)
    await _require_member(db, org, user)
    now = datetime.now(UTC)
    week_start = now - timedelta(days=7)

    total_events = (
        await db.execute(
            select(func.count()).select_from(ActivityEvent).where(ActivityEvent.org_id == org.id)
        )
    ).scalar_one()
    events_last_7 = (
        await db.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(ActivityEvent.org_id == org.id, ActivityEvent.created_at >= week_start)
        )
    ).scalar_one()

    by_type_rows = (
        await db.execute(
            select(ActivityEvent.event_type, func.count())
            .where(ActivityEvent.org_id == org.id)
            .group_by(ActivityEvent.event_type)
            .order_by(func.count().desc())
        )
    ).all()
    by_event_type: dict[str, int] = {et: count for et, count in by_type_rows}

    day_rows = (
        (
            await db.execute(
                select(ActivityEvent.created_at).where(
                    ActivityEvent.org_id == org.id,
                    ActivityEvent.created_at >= now - timedelta(days=14),
                )
            )
        )
        .scalars()
        .all()
    )
    day_buckets: dict[date, int] = {}
    for ts in day_rows:
        day = ts.date() if ts.tzinfo else ts.replace(tzinfo=None).date()
        day_buckets[day] = day_buckets.get(day, 0) + 1
    by_day = [
        DailyCount(day=day, count=count) for day, count in sorted(day_buckets.items(), reverse=True)
    ]

    return ActivityStats(
        total_events=total_events,
        events_last_7_days=events_last_7,
        by_event_type=by_event_type,
        by_day=by_day,
    )


__all__ = [
    "activity_stats",
    "list_activity",
    "rounds",
    "summary",
]
