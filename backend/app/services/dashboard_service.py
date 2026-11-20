"""Dashboard summary service (Step 5g).

Builds the whole ``/startup/dashboard`` payload in one request. Read-only:
5g adds no write path, and every number comes from a row that exists.

Object-level rules (BUILD_PLAN Step 5 security):
- Startup organizations only; wrong-type / suspended / deleted orgs 404
  via ``organization_service.startup_org_or_404`` (no existence oracle).
- Any ACTIVE member may read it, viewers included; a non-member is 403.
- Every query is filtered by ``org_id``. The only "my" figures (my tasks)
  are additionally filtered by the caller's user id, so a member can
  never see another person's private slice.
- Money (MRR, burn, runway) is withheld from viewers: the keys are set to
  ``null`` and named in ``restricted`` (approved D-8).

Honesty rules (BUILD_PLAN 5g: "shows empty states (not fake numbers)"):
- A metric key with no row is simply absent; nothing is substituted.
- Cards that depend on later steps are listed in ``unavailable`` with the
  step that will supply them, so the page can say so instead of drawing a
  zero: mentor -> 8, investors -> 9, hiring -> 7, documents -> 4.
- The design doc's readiness breakdown (traction %, mentor feedback %) is
  also unavailable: 5f stores one score, not three.

Query budget: one query per section (org+profile, stage, readiness,
tasks, milestones, metrics, team, activity) — constant, never N+1.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent
from app.models.metric import MetricKey, StartupMetric
from app.models.milestone import Milestone, MilestoneStatus
from app.models.organization import MemberStatus, OrganizationMember, OrgRole
from app.models.readiness import ReadinessCriterion, ReadinessStatus, StartupReadiness
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.dashboard import (
    DashboardActivityItem,
    DashboardMetric,
    DashboardMilestoneItem,
    DashboardMilestoneSummary,
    DashboardReadiness,
    DashboardStage,
    DashboardSummary,
    DashboardTaskItem,
    DashboardTaskSummary,
    DashboardTeam,
    DashboardTeamMember,
    UnavailableCard,
)
from app.services import organization_service, stage_service

# Viewer is read-only and, per D-8, must not see the money cards.
_MONEY_KEYS = (MetricKey.mrr, MetricKey.burn, MetricKey.runway_months)
_MONEY_RESTRICTED = ["mrr", "burn", "runway_months"]

# Cards with no source yet, and the sub-step that will supply each.
_UNAVAILABLE: tuple[UnavailableCard, ...] = (
    UnavailableCard(
        key="mentor",
        reason="Mentor details, next session and sign-off progress arrive with the mentorship module.",
        step="8",
    ),
    UnavailableCard(
        key="investor_interest",
        reason="Profile views, shortlists and interested investors arrive with the investor module.",
        step="9",
    ),
    UnavailableCard(
        key="hiring",
        reason="Open roles and applicant counts arrive with the hiring module.",
        step="7",
    ),
    UnavailableCard(
        key="documents",
        reason="The document vault needs file storage.",
        step="4",
    ),
    UnavailableCard(
        key="readiness_breakdown",
        reason="Only one readiness score is stored; traction and mentor-feedback components need later steps.",
        step="9",
    ),
)

# "Due this week" window, matching the 5c due_this_week filter.
_WEEK = timedelta(days=7)
_MY_TASK_ITEMS = 5
_ACTIVITY_ITEMS = 6
_MEMBER_STACK = 5


async def _stage_section(db: AsyncSession, org_id: uuid.UUID) -> DashboardStage:
    """Reuse 5i's roll-up so the banner and the stage page agree."""
    summary = await stage_service.get_summary(db, org_id)
    return DashboardStage(
        stage=summary.stage,
        in_stage_since=summary.in_stage_since,
        exit_criteria_total=summary.exit_criteria_total,
        exit_criteria_signed_off=summary.exit_criteria_signed_off,
    )


async def _readiness_section(db: AsyncSession, org_id: uuid.UUID) -> DashboardReadiness:
    """The 5f score: signed-off / active readiness items (5i D1 denominator)."""
    base = (
        select(func.count(ReadinessCriterion.id)),
        select(func.count(StartupReadiness.id))
        .join(
            ReadinessCriterion,
            ReadinessCriterion.id == StartupReadiness.criterion_id,
        )
        .where(
            StartupReadiness.org_id == org_id,
            StartupReadiness.status == ReadinessStatus.signed_off,
            ReadinessCriterion.is_active.is_(True),
            ReadinessCriterion.is_exit_criterion.is_(False),
        ),
    )
    total = (
        await db.execute(
            base[0].where(
                ReadinessCriterion.is_active.is_(True),
                ReadinessCriterion.is_exit_criterion.is_(False),
            )
        )
    ).scalar_one()
    signed_off = (await db.execute(base[1])).scalar_one()
    pct = round(100 * signed_off / total) if total else 0
    return DashboardReadiness(
        readiness_pct=pct,
        criteria_total=total,
        criteria_signed_off=signed_off,
        signed_off_remaining=total - signed_off,
        is_ready=bool(total) and signed_off == total,
    )


async def _tasks_section(
    db: AsyncSession, org_id: uuid.UUID, user_id: uuid.UUID
) -> DashboardTaskSummary:
    """Open tasks assigned to the caller, with the three due counters."""
    today = datetime.now(UTC).date()
    week_end = today + _WEEK
    open_filters = [
        Task.org_id == org_id,
        Task.assignee_id == user_id,
        Task.status != TaskStatus.done,
        Task.deleted_at.is_(None),
    ]

    total_open = (
        await db.execute(select(func.count()).select_from(Task).where(*open_filters))
    ).scalar_one()
    overdue = (
        await db.execute(
            select(func.count())
            .select_from(Task)
            .where(*open_filters, Task.due_on.is_not(None), Task.due_on < today)
        )
    ).scalar_one()
    due_today = (
        await db.execute(
            select(func.count())
            .select_from(Task)
            .where(*open_filters, Task.due_on == today)
        )
    ).scalar_one()
    due_this_week = (
        await db.execute(
            select(func.count())
            .select_from(Task)
            .where(
                *open_filters,
                Task.due_on.is_not(None),
                Task.due_on >= today,
                Task.due_on <= week_end,
            )
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(Task)
            .where(*open_filters)
            .order_by(
                # Overdue first, then nearest due date, undated last.
                (Task.due_on.is_(None)).asc(),
                Task.due_on.asc(),
                Task.created_at,
            )
            .limit(_MY_TASK_ITEMS)
        )
    ).scalars().all()
    items = [
        DashboardTaskItem(
            id=row.id,
            title=row.title,
            status=getattr(row.status, "value", str(row.status)),
            priority=getattr(row.priority, "value", str(row.priority)),
            due_on=row.due_on,
            is_overdue=row.due_on is not None and row.due_on < today,
            is_due_today=row.due_on == today,
        )
        for row in rows
    ]
    return DashboardTaskSummary(
        total_open=total_open,
        overdue=overdue,
        due_today=due_today,
        due_this_week=due_this_week,
        items=items,
    )


async def _milestones_section(
    db: AsyncSession, org_id: uuid.UUID
) -> DashboardMilestoneSummary:
    base = [Milestone.org_id == org_id, Milestone.deleted_at.is_(None)]
    total = (
        await db.execute(select(func.count()).select_from(Milestone).where(*base))
    ).scalar_one()
    achieved = (
        await db.execute(
            select(func.count())
            .select_from(Milestone)
            .where(*base, Milestone.status == MilestoneStatus.achieved)
        )
    ).scalar_one()
    at_risk = (
        await db.execute(
            select(func.count())
            .select_from(Milestone)
            .where(*base, Milestone.status == MilestoneStatus.at_risk)
        )
    ).scalar_one()
    next_row = (
        await db.execute(
            select(Milestone)
            .where(*base, Milestone.status != MilestoneStatus.achieved)
            .order_by(
                (Milestone.target_date.is_(None)).asc(),
                Milestone.target_date.asc(),
                Milestone.id,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    return DashboardMilestoneSummary(
        total=total,
        achieved=achieved,
        at_risk=at_risk,
        next=(
            DashboardMilestoneItem(
                id=next_row.id,
                name=next_row.name,
                target_date=next_row.target_date,
                status=getattr(next_row.status, "value", str(next_row.status)),
                progress=next_row.progress,
            )
            if next_row is not None
            else None
        ),
    )


async def _metrics_section(
    db: AsyncSession, org_id: uuid.UUID, *, can_see_money: bool
) -> list[DashboardMetric]:
    """Newest value per money key; absent keys stay absent (never zero)."""
    if not can_see_money:
        return []
    ranked = (
        select(
            StartupMetric.id.label("id"),
            func.row_number()
            .over(
                partition_by=StartupMetric.metric_key,
                order_by=(
                    StartupMetric.period_end.desc(),
                    StartupMetric.created_at.desc(),
                ),
            )
            .label("rn"),
        )
        .where(
            StartupMetric.org_id == org_id,
            StartupMetric.metric_key.in_(_MONEY_KEYS),
        )
        .subquery()
    )
    rows = (
        (
            await db.execute(
                select(StartupMetric)
                .join(ranked, ranked.c.id == StartupMetric.id)
                .where(ranked.c.rn == 1)
                .order_by(StartupMetric.metric_key)
            )
        )
        .scalars()
        .all()
    )
    return [
        DashboardMetric(
            metric_key=getattr(row.metric_key, "value", str(row.metric_key)),
            # NUMERIC -> decimal string, never a float (AGENTS.md).
            value=str(row.value),
            unit=row.unit,
            currency=row.currency,
            source=getattr(row.source, "value", str(row.source)),
            period_end=row.period_end,
        )
        for row in rows
    ]


async def _team_section(
    db: AsyncSession, org_id: uuid.UUID
) -> DashboardTeam:
    active_filter = [
        OrganizationMember.org_id == org_id,
        OrganizationMember.deleted_at.is_(None),
        OrganizationMember.status == MemberStatus.active,
    ]
    active = (
        await db.execute(
            select(func.count()).select_from(OrganizationMember).where(*active_filter)
        )
    ).scalar_one()
    invited = (
        await db.execute(
            select(func.count())
            .select_from(OrganizationMember)
            .where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.status == MemberStatus.invited,
            )
        )
    ).scalar_one()
    rows = (
        await db.execute(
            select(OrganizationMember, User)
            .outerjoin(User, User.id == OrganizationMember.user_id)
            .where(*active_filter)
            .order_by(OrganizationMember.created_at, OrganizationMember.id)
            .limit(_MEMBER_STACK)
        )
    ).all()
    return DashboardTeam(
        active_members=active,
        pending_invites=invited,
        members=[
            DashboardTeamMember(
                user_id=member.user_id,
                display_name=(
                    (member_user.display_name or member_user.primary_email)
                    if member_user is not None
                    else None
                ),
                role=member.role,
            )
            for member, member_user in rows
        ],
    )


async def _activity_section(
    db: AsyncSession, org_id: uuid.UUID
) -> list[DashboardActivityItem]:
    """Newest-first from ``activity_events``; empty is honest, not filled."""
    rows = (
        await db.execute(
            select(ActivityEvent, User)
            .outerjoin(User, User.id == ActivityEvent.user_id)
            .where(ActivityEvent.org_id == org_id)
            .order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
            .limit(_ACTIVITY_ITEMS)
        )
    ).all()
    return [
        DashboardActivityItem(
            event_type=event.event_type,
            summary=event.summary,
            actor_name=(
                (actor.display_name or actor.primary_email) if actor is not None else None
            ),
            link_url=event.link_url,
            created_at=event.created_at,
        )
        for event, actor in rows
    ]


async def summary(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> DashboardSummary:
    """Assemble the dashboard payload for any active member."""
    org = await organization_service.startup_org_or_404(db, org_id)
    member = await organization_service.require_membership(db, org.id, user)

    # 5i's summary tolerates a missing profile (it reports the default
    # stage), so the dashboard works before the founder has saved anything.
    stage_section = await _stage_section(db, org.id)

    can_see_money = member.role != OrgRole.viewer

    return DashboardSummary(
        org_id=org.id,
        org_name=org.name,
        org_slug=org.slug,
        my_role=member.role,
        my_display_name=user.display_name,
        stage=stage_section,
        readiness=await _readiness_section(db, org.id),
        tasks=await _tasks_section(db, org.id, user.id),
        milestones=await _milestones_section(db, org.id),
        metrics=await _metrics_section(db, org.id, can_see_money=can_see_money),
        team=await _team_section(db, org.id),
        recent_activity=await _activity_section(db, org.id),
        unavailable=list(_UNAVAILABLE),
        restricted=[] if can_see_money else list(_MONEY_RESTRICTED),
    )
