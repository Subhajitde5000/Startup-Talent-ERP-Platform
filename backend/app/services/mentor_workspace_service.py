"""Mentorship-scoped reads and attributable activity aggregates."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import conflict
from app.models.deliverable import DeliverableStatus, MentorDeliverable
from app.models.mentorship import Mentorship, MentorshipStatus
from app.models.readiness import ReadinessStatus, StartupReadiness
from app.models.session import MentoringSession, SessionStatus
from app.models.user import User
from app.schemas.mentor_workspace import (
    ImpactRead,
    MentorDashboardRead,
    ScopedReadinessBoard,
    ScopedReadinessItem,
    StartupMentorshipOverview,
    WorkspaceRead,
)
from app.schemas.mentorship import MentorshipPage
from app.schemas.readiness import ReadinessSummary
from app.services import (
    agreement_service,
    earning_service,
    mentorship_service,
    organization_service,
    readiness_service,
)


async def workspace(db: AsyncSession, user: User, mentorship_id: uuid.UUID) -> WorkspaceRead:
    m = await mentorship_service.get_one(db, user, mentorship_id)
    row = await mentorship_service.get_row(db, mentorship_id)
    sessions = (
        await db.execute(
            select(func.count())
            .select_from(MentoringSession)
            .where(
                MentoringSession.mentorship_id == mentorship_id,
                MentoringSession.status == SessionStatus.completed,
            )
        )
    ).scalar_one()
    deliverables = (
        await db.execute(
            select(func.count())
            .select_from(MentorDeliverable)
            .where(
                MentorDeliverable.mentorship_id == mentorship_id,
                MentorDeliverable.deleted_at.is_(None),
                MentorDeliverable.status != DeliverableStatus.accepted,
            )
        )
    ).scalar_one()
    return WorkspaceRead(
        mentorship=m,
        completed_sessions=sessions,
        open_deliverables=deliverables,
        agreement=await agreement_service.summary_for_workspace(db, user, row),
    )


async def readiness(db: AsyncSession, user: User, mentorship_id: uuid.UUID) -> ScopedReadinessBoard:
    m = await mentorship_service.get_row(db, mentorship_id)
    await mentorship_service.require_can_read(db, m, user)
    if m.mentor_id == user.id and m.status != MentorshipStatus.active:
        raise conflict(
            "Readiness is available to the mentor only during an active mentorship.",
            code="INVALID_STATE",
        )
    # Unlike the startup board, this scoped GET must not create startup rows.
    criteria = await readiness_service._active_criteria(db)
    states = list(
        (
            await db.execute(
                select(StartupReadiness).where(StartupReadiness.org_id == m.startup_org_id)
            )
        )
        .scalars()
        .all()
    )
    states_by_criterion = {state.criterion_id: state for state in states}
    names = await readiness_service._signer_names(db, states)
    items = []
    for criterion in criteria:
        state = states_by_criterion.get(criterion.id)
        if state is not None:
            name = names.get(state.signed_off_by) if state.signed_off_by else None
            items.append(
                ScopedReadinessItem(
                    **readiness_service.criterion_read(criterion, state, name).model_dump()
                )
            )
        else:
            items.append(
                ScopedReadinessItem(
                    id=None,
                    criterion_id=criterion.id,
                    code=criterion.code,
                    title=criterion.title,
                    description=criterion.description,
                    stage=criterion.stage,
                    display_order=criterion.display_order,
                    is_exit_criterion=criterion.is_exit_criterion,
                    status=ReadinessStatus.not_started,
                    evidence=None,
                    notes=None,
                    signed_off_by=None,
                    signed_off_mentorship_id=None,
                    signed_off_by_name=None,
                    signed_off_at=None,
                    updated_at=None,
                )
            )
    total = len(criteria)
    signed = sum(item.status == "signed_off" for item in items)
    return ScopedReadinessBoard(
        org_id=m.startup_org_id,
        items=items,
        summary=ReadinessSummary(
            criteria_total=total,
            criteria_signed_off=signed,
            readiness_pct=round(100 * signed / total) if total else 0,
            is_ready=bool(total) and signed == total,
        ),
    )


async def impact(db: AsyncSession, user: User) -> ImpactRead:
    base = (Mentorship.mentor_id == user.id, Mentorship.deleted_at.is_(None))
    startups = (
        await db.execute(
            select(func.count(func.distinct(Mentorship.startup_org_id))).where(
                *base,
                Mentorship.status.in_(
                    [MentorshipStatus.active, MentorshipStatus.paused, MentorshipStatus.completed]
                ),
            )
        )
    ).scalar_one()
    active = (
        await db.execute(
            select(func.count(func.distinct(Mentorship.startup_org_id))).where(
                *base, Mentorship.status == MentorshipStatus.active
            )
        )
    ).scalar_one()
    sessions = (
        await db.execute(
            select(func.count())
            .select_from(MentoringSession)
            .join(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
            .where(*base, MentoringSession.status == SessionStatus.completed)
        )
    ).scalar_one()
    signoffs = (
        await db.execute(
            select(func.count())
            .select_from(StartupReadiness)
            .join(Mentorship, Mentorship.id == StartupReadiness.signed_off_mentorship_id)
            .where(
                *base,
                StartupReadiness.signed_off_by == user.id,
                StartupReadiness.status == "signed_off",
            )
        )
    ).scalar_one()
    return ImpactRead(
        startups_mentored=startups,
        active_startups=active,
        sessions_delivered=sessions,
        current_signoffs=signoffs,
    )


async def dashboard(db: AsyncSession, user: User, limit: int, offset: int) -> MentorDashboardRead:
    items, total = await mentorship_service.list_for_mentor_startups(
        db, user, limit=limit, offset=offset
    )
    return MentorDashboardRead(
        impact=await impact(db, user),
        earnings=await earning_service.summary(db, user),
        mentorships=MentorshipPage(items=items, total=total, limit=limit, offset=offset),
    )


async def org_overview(
    db: AsyncSession, user: User, org_id: uuid.UUID, limit: int, offset: int
) -> StartupMentorshipOverview:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    items, total = await mentorship_service.list_mentorships(
        db, user, side="startup", limit=limit, offset=offset, status_filter=None, org_id=org_id
    )
    active = (
        await db.execute(
            select(func.count())
            .select_from(Mentorship)
            .where(
                Mentorship.startup_org_id == org_id,
                Mentorship.deleted_at.is_(None),
                Mentorship.status == MentorshipStatus.active,
            )
        )
    ).scalar_one()
    return StartupMentorshipOverview(
        mentorships=MentorshipPage(items=items, total=total, limit=limit, offset=offset),
        active_count=active,
    )
