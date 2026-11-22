"""Step 9l service: investor workspace (dashboard, insights, activity).

Read-only aggregation over data written by Steps 9a–9k. No new
tables — every number here is computed from existing rows:

- **Dashboard summary**: the top stat strip (new matches this week,
  requests awaiting reply, meetings this week, pipeline size), the
  pipeline snapshot (deal counts per stage), portfolio holdings count,
  needs-reply items (pending engagement requests) and upcoming
  meetings.
- **Insights**: DESCRIPTIVE only (plan D1) — startup counts per
  development stage, monthly new-profile and round-launch counts, and
  the private funnel counts. Cohort threshold n >= 10: a stage/month
  bucket below the threshold is still returned (it is real data) but
  the ``cohort_threshold`` is exposed so the frontend can label it.
  No forecasts, no predictions.
- **Activity**: the org's ``activity_events`` rows (paginated), plus
  aggregate stats (total, last-7-days, per-event-type, per-day).

Authorization: the caller's active ``investor_firm`` org is resolved
server-side; all reads are scoped to that org. Reads are allowed for
any active member (owner/admin/member/viewer).
"""

from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import not_found
from app.models.activity import ActivityEvent
from app.models.commitment import PortfolioHolding
from app.models.investor_deal import InvestorDeal, PipelineStage
from app.models.investor_engagement import (
    InvestorEngagementRequest,
    InvestorMeeting,
    RequestStatus,
)
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgType,
)
from app.models.startup import StartupProfile
from app.models.user import User
from app.schemas.investor_workspace import (
    ActivityEventRead,
    ActivityStats,
    DailyCount,
    DashboardSummary,
    InsightsResponse,
    MonthlyCount,
    NeedsReplyItem,
    UpcomingMeetingItem,
    YourFunnelStats,
)
from app.services import organization_service

COHORT_THRESHOLD = 10


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


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------
async def dashboard_summary(db: AsyncSession, user: User) -> DashboardSummary:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user)
    now = datetime.now(UTC)
    week_start = now - timedelta(days=7)

    # New matches this week: deals created in the last 7 days.
    new_matches = (
        await db.execute(
            select(func.count())
            .select_from(InvestorDeal)
            .where(
                InvestorDeal.investor_org_id == org.id,
                InvestorDeal.deleted_at.is_(None),
                InvestorDeal.created_at >= week_start,
            )
        )
    ).scalar_one()

    # Requests awaiting reply: pending engagement requests.
    requests_awaiting = (
        await db.execute(
            select(func.count())
            .select_from(InvestorEngagementRequest)
            .where(
                InvestorEngagementRequest.investor_org_id == org.id,
                InvestorEngagementRequest.status == RequestStatus.pending,
                InvestorEngagementRequest.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    # Meetings this week: meetings scheduled within the next 7 days.
    meetings_week = (
        await db.execute(
            select(func.count())
            .select_from(InvestorMeeting)
            .where(
                InvestorMeeting.investor_org_id == org.id,
                InvestorMeeting.deleted_at.is_(None),
                InvestorMeeting.scheduled_at >= now,
                InvestorMeeting.scheduled_at <= now + timedelta(days=7),
            )
        )
    ).scalar_one()

    # Startups in pipeline: non-terminal deals.
    pipeline_total = (
        await db.execute(
            select(func.count())
            .select_from(InvestorDeal)
            .where(
                InvestorDeal.investor_org_id == org.id,
                InvestorDeal.deleted_at.is_(None),
                InvestorDeal.stage.notin_(
                    [PipelineStage.passed, PipelineStage.closed]
                ),
            )
        )
    ).scalar_one()

    # Pipeline snapshot: one count per live stage.
    stage_rows = (
        await db.execute(
            select(InvestorDeal.stage, func.count())
            .where(
                InvestorDeal.investor_org_id == org.id,
                InvestorDeal.deleted_at.is_(None),
                InvestorDeal.stage.notin_(
                    [PipelineStage.passed, PipelineStage.closed]
                ),
            )
            .group_by(InvestorDeal.stage)
        )
    ).all()
    pipeline_snapshot: dict[str, int] = {
        stage.value: count for stage, count in stage_rows
    }

    # Portfolio holdings + updates this week.
    # PortfolioHolding has NO deleted_at (schema.sql): status is the
    # lifecycle, rows are never removed.
    portfolio_holdings = (
        await db.execute(
            select(func.count())
            .select_from(PortfolioHolding)
            .where(
                PortfolioHolding.investor_org_id == org.id,
            )
        )
    ).scalar_one()
    portfolio_updates = (
        await db.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(
                ActivityEvent.org_id == org.id,
                ActivityEvent.event_type.like("holding_%"),
                ActivityEvent.created_at >= week_start,
            )
        )
    ).scalar_one()

    # Needs reply: pending requests, newest first, top 3.
    needs_reply_rows = (
        await db.execute(
            select(InvestorEngagementRequest, Organization.name)
            .join(Organization, Organization.id == InvestorEngagementRequest.startup_org_id)
            .where(
                InvestorEngagementRequest.investor_org_id == org.id,
                InvestorEngagementRequest.status == RequestStatus.pending,
                InvestorEngagementRequest.deleted_at.is_(None),
            )
            .order_by(InvestorEngagementRequest.created_at.desc())
            .limit(3)
        )
    ).all()
    needs_reply = [
        NeedsReplyItem(
            id=req.id,
            startup_org_id=req.startup_org_id,
            startup_name=startup_name or "Unknown startup",
            kind=req.kind.value,
            ask=req.ask,
            created_at=req.created_at,
        )
        for req, startup_name in needs_reply_rows
    ]

    # Upcoming meetings: upcoming, soonest first, top 3.
    upcoming_rows = (
        await db.execute(
            select(InvestorMeeting, Organization.name)
            .join(Organization, Organization.id == InvestorMeeting.startup_org_id)
            .where(
                InvestorMeeting.investor_org_id == org.id,
                InvestorMeeting.deleted_at.is_(None),
                InvestorMeeting.scheduled_at >= now,
            )
            .order_by(InvestorMeeting.scheduled_at.asc())
            .limit(3)
        )
    ).all()
    upcoming_meetings = [
        UpcomingMeetingItem(
            id=meeting.id,
            startup_org_id=meeting.startup_org_id,
            startup_name=startup_name or "Unknown startup",
            meeting_type=meeting.meeting_type.value,
            scheduled_at=meeting.scheduled_at,
            status=meeting.status.value,
        )
        for meeting, startup_name in upcoming_rows
    ]

    return DashboardSummary(
        new_matches_this_week=new_matches,
        requests_awaiting_reply=requests_awaiting,
        meetings_this_week=meetings_week,
        startups_in_pipeline=pipeline_total,
        pipeline_snapshot=pipeline_snapshot,
        portfolio_holdings=portfolio_holdings,
        portfolio_updates_this_week=portfolio_updates,
        needs_reply=needs_reply,
        upcoming_meetings=upcoming_meetings,
    )


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------
async def insights(db: AsyncSession, user: User) -> InsightsResponse:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user)

    # Startups by development stage (platform-wide, descriptive).
    stage_rows = (
        await db.execute(
            select(StartupProfile.stage, func.count())
            .where(
            )
            .group_by(StartupProfile.stage)
        )
    ).all()
    startups_by_stage: dict[str, int] = {
        stage.value: count for stage, count in stage_rows
    }
    startups_by_stage_total = sum(startups_by_stage.values())

    # Monthly new profiles: profiles created per ISO month (last 6 months).
    # ``created_at`` on startup_profiles is TIMESTAMP WITHOUT TIME ZONE
    # (naive UTC) on PostgreSQL, so compare against a naive datetime.
    six_months_ago = (datetime.now(UTC) - timedelta(days=180)).replace(tzinfo=None)
    profile_rows = (
        await db.execute(
            select(StartupProfile.created_at)
            .where(
                StartupProfile.created_at >= six_months_ago,
            )
        )
    ).scalars().all()
    monthly_new_profiles = _monthly_counts(profile_rows)

    # Monthly round launches: rounds opened per ISO month (last 6 months).
    from app.models.funding_round import FundingRound

    round_rows = (
        await db.execute(
            select(FundingRound.created_at)
            .where(
                FundingRound.deleted_at.is_(None),
                FundingRound.created_at >= six_months_ago,
            )
        )
    ).scalars().all()
    monthly_round_launches = _monthly_counts(round_rows)

    # Private funnel counts (descriptive, no predictions).
    profiles_reviewed = (
        await db.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(
                ActivityEvent.org_id == org.id,
                ActivityEvent.event_type.like("deal_%"),
            )
        )
    ).scalar_one()
    shortlisted = (
        await db.execute(
            select(func.count())
            .select_from(InvestorDeal)
            .where(
                InvestorDeal.investor_org_id == org.id,
                InvestorDeal.deleted_at.is_(None),
                InvestorDeal.stage.in_(
                    [
                        PipelineStage.interested,
                        PipelineStage.intro,
                        PipelineStage.meeting,
                        PipelineStage.data_room,
                        PipelineStage.diligence,
                    ]
                ),
            )
        )
    ).scalar_one()
    intro_requests = (
        await db.execute(
            select(func.count())
            .select_from(InvestorEngagementRequest)
            .where(
                InvestorEngagementRequest.investor_org_id == org.id,
                InvestorEngagementRequest.deleted_at.is_(None),
            )
        )
    ).scalar_one()
    data_rooms_opened = (
        await db.execute(
            select(func.count())
            .select_from(InvestorDeal)
            .where(
                InvestorDeal.investor_org_id == org.id,
                InvestorDeal.deleted_at.is_(None),
                InvestorDeal.stage.in_(
                    [PipelineStage.data_room, PipelineStage.diligence, PipelineStage.offer]
                ),
            )
        )
    ).scalar_one()
    offers_extended = (
        await db.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(
                ActivityEvent.org_id == org.id,
                ActivityEvent.event_type.in_(
                    ["offer_sent", "offer_countered", "offer_accepted"]
                ),
            )
        )
    ).scalar_one()

    return InsightsResponse(
        startups_by_stage=startups_by_stage,
        startups_by_stage_total=startups_by_stage_total,
        monthly_new_profiles=monthly_new_profiles,
        monthly_round_launches=monthly_round_launches,
        your_funnel=YourFunnelStats(
            profiles_reviewed=profiles_reviewed,
            shortlisted=shortlisted,
            intro_requests=intro_requests,
            data_rooms_opened=data_rooms_opened,
            offers_extended=offers_extended,
        ),
        cohort_threshold=COHORT_THRESHOLD,
    )


def _monthly_counts(created_ats: Sequence[datetime]) -> list[MonthlyCount]:
    """Group timestamps by ISO month (YYYY-MM), sorted ascending."""
    buckets: dict[str, int] = {}
    for ts in created_ats:
        key = ts.strftime("%Y-%m")
        buckets[key] = buckets.get(key, 0) + 1
    return [MonthlyCount(month=month, count=count) for month, count in sorted(buckets.items())]


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------
async def list_activity(
    db: AsyncSession,
    user: User,
    *,
    event_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[ActivityEventRead], int]:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user)
    filters = [ActivityEvent.org_id == org.id]
    if event_type is not None:
        filters.append(ActivityEvent.event_type == event_type)
    total = (
        await db.execute(
            select(func.count()).select_from(ActivityEvent).where(*filters)
        )
    ).scalar_one()
    result = await db.execute(
        select(ActivityEvent)
        .where(*filters)
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_as_activity_read(e) for e in result.scalars().all()], total


async def activity_stats(db: AsyncSession, user: User) -> ActivityStats:
    org = await _investor_org_or_404(db, user)
    await _require_member(db, org, user)
    now = datetime.now(UTC)
    week_start = now - timedelta(days=7)

    total_events = (
        await db.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(ActivityEvent.org_id == org.id)
        )
    ).scalar_one()
    events_last_7 = (
        await db.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(
                ActivityEvent.org_id == org.id,
                ActivityEvent.created_at >= week_start,
            )
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
    by_event_type: dict[str, int] = {
        event_type: count for event_type, count in by_type_rows
    }

    # Per-day counts for the last 14 days.
    day_rows = (
        await db.execute(
            select(ActivityEvent.created_at)
            .where(
                ActivityEvent.org_id == org.id,
                ActivityEvent.created_at >= now - timedelta(days=14),
            )
        )
    ).scalars().all()
    day_buckets: dict[date, int] = {}
    for ts in day_rows:
        day = ts.date() if ts.tzinfo else ts.replace(tzinfo=None).date()
        day_buckets[day] = day_buckets.get(day, 0) + 1
    by_day = [
        DailyCount(day=day, count=count)
        for day, count in sorted(day_buckets.items(), reverse=True)
    ]

    return ActivityStats(
        total_events=total_events,
        events_last_7_days=events_last_7,
        by_event_type=by_event_type,
        by_day=by_day,
    )


__all__ = [
    "activity_stats",
    "dashboard_summary",
    "insights",
    "list_activity",
]
