"""Stage service (Steps 5i + 5j).

One source of truth (5i item 1): the 25 stage exit criteria are rows in
``readiness_criteria`` with ``is_exit_criterion=True``, and their per-org
status lives in ``startup_readiness`` — the same table, state machine,
evidence field and admin sign-off the six 5f readiness items use. This
module adds no second list; it filters the existing one by ``stage``.

Scoring is untouched (5i D1): ``readiness_service._recompute_score`` counts
``is_exit_criterion=False`` rows only, so bootstrapping 25 more criteria
cannot move a single readiness percentage.

Object-level rules (BUILD_PLAN Step 5 security):
- Startup organizations only; wrong-type / suspended / deleted orgs 404 via
  ``startup_org_or_404`` (no existence oracle).
- Every read needs an ACTIVE membership of any role (viewers read).
- Writes (stage change, tool progress) need owner/admin/member; viewers 403.
- Every lookup is scoped by ``org_id``. Tool keys come from a fixed
  vocabulary (D6), so an unknown key is a 404 and there is no global row id
  for a client to tamper with.
- Stage history is written in the SAME transaction as the stage change
  (5i item 4). A stage change never touches ``startup_readiness``, so
  sign-offs survive it.

Deferred on purpose (see the 5i/5j plan):
- Mentor sign-off of exit criteria waits for 8f; this module only reuses
  whatever the admin sign-off path in 5f already wrote.
- No jump guard on stage transitions (D4): exit criteria are advisory.
- Tools that need real structure (interview tracker, market sizing,
  customer persona) stay generic rows here; market sizing must later share
  its data with 5l rather than duplicate it (5j item 2).
- Co-founder search is a people-matching feature (Steps 6/13) and is
  deliberately absent from the vocabulary (D8).
- ``stage_tool_progress.data`` is never written in this step (D9).
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited
from app.models.organization import OrgRole
from app.models.readiness import ReadinessCriterion, ReadinessStatus, StartupReadiness
from app.models.stage import StageToolProgress, StartupStageHistory, ToolStatus
from app.models.startup import StartupProfile, StartupStage
from app.models.user import User
from app.schemas.readiness import ReadinessRead
from app.schemas.stage import (
    StageChange,
    StageCriteriaBoard,
    StageHistoryPage,
    StageHistoryRead,
    StageSummary,
    StageToolBoard,
    StageToolRead,
    StageToolUpdate,
)
from app.services import organization_service, readiness_service
from app.services.rate_limiter import rate_limiter

# Viewer role is deliberately excluded from writes (5f/5a convention).
_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})


# 5j D6: the fixed tool vocabulary. Keys are stable; ``name`` and
# ``description`` mirror the demo copy in
# ``frontend/app/startup/stage/stage-page.jsx`` so the UI text is unchanged.
# An unknown key is a 404 — never an auto-created row.
TOOL_SPEC: dict[StartupStage, list[dict[str, Any]]] = {
    StartupStage.idea: [
        {
            "tool_key": "idea_canvas",
            "name": "Idea canvas",
            "description": "Map the essentials of your business idea.",
            "is_optional": False,
        },
        {
            "tool_key": "interview_tracker",
            "name": "Interview tracker",
            "description": "Log conversations and surface recurring customer needs.",
            "is_optional": False,
        },
        {
            "tool_key": "market_sizing",
            "name": "Market sizing",
            "description": "Estimate TAM, SAM and SOM with source-backed assumptions.",
            "is_optional": False,
        },
        # "Co-founder search" is deliberately NOT here (5j D8): it is a
        # people-matching feature that belongs to Steps 6/13, so it carries
        # no tool row and no progress until then.
        {
            "tool_key": "customer_persona",
            "name": "Customer persona",
            "description": "Create a clear picture of your target customer.",
            "is_optional": True,
        },
    ],
    StartupStage.prototype: [
        {
            "tool_key": "roadmap_sprint_board",
            "name": "Roadmap & sprint board",
            "description": "Plan milestones and move work from backlog to done.",
            "is_optional": False,
        },
        {
            "tool_key": "prototype_feedback_log",
            "name": "Prototype & feedback log",
            "description": "Track product versions and turn feedback into action.",
            "is_optional": False,
        },
        {
            "tool_key": "user_testing_tracker",
            "name": "User-testing tracker",
            "description": "Recruit testers, record sessions and learn from use.",
            "is_optional": False,
        },
        {
            "tool_key": "grants_incubators",
            "name": "Grants & incubators",
            "description": "Find curated programmes that fit your startup.",
            "is_optional": False,
        },
    ],
    StartupStage.early_revenue: [
        {
            "tool_key": "sales_pipeline",
            "name": "Customer & sales pipeline",
            "description": "Track leads from first contact to close.",
            "is_optional": False,
        },
        {
            "tool_key": "revenue_burn",
            "name": "Revenue & burn",
            "description": "Monitor MRR, cash balance, burn and runway.",
            "is_optional": False,
        },
        {
            "tool_key": "kpi_tracker",
            "name": "KPI tracker",
            "description": "Set targets and review the metrics that matter.",
            "is_optional": False,
        },
        {
            "tool_key": "hiring_requests",
            "name": "Hiring requests",
            "description": "Plan critical roles and publish jobs.",
            "is_optional": False,
        },
    ],
    StartupStage.growth: [
        {
            "tool_key": "growth_dashboard",
            "name": "Growth dashboard",
            "description": "Watch the metrics that drive expansion week to week.",
            "is_optional": False,
        },
        {
            "tool_key": "channel_experiments",
            "name": "Channel experiments",
            "description": "Run and score acquisition experiments in one place.",
            "is_optional": False,
        },
        {
            "tool_key": "hiring_plan",
            "name": "Hiring plan",
            "description": "Plan roles and publish jobs as the team grows.",
            "is_optional": False,
        },
        {
            "tool_key": "investor_updates",
            "name": "Investor updates",
            "description": "Share progress with supporters on a steady cadence.",
            "is_optional": False,
        },
    ],
    StartupStage.mature: [
        {
            "tool_key": "finance_cap_table",
            "name": "Finance & cap table",
            "description": "Review financial performance and model ownership.",
            "is_optional": False,
        },
        {
            "tool_key": "hr_payroll",
            "name": "HR & payroll basics",
            "description": "Keep employee, leave and compensation records organized.",
            "is_optional": False,
        },
        {
            "tool_key": "board_investor_reporting",
            "name": "Board & investor reporting",
            "description": "Prepare concise monthly updates and board packs.",
            "is_optional": False,
        },
        {
            "tool_key": "data_room",
            "name": "Data room",
            "description": "Organize secure diligence documents and permissions.",
            "is_optional": False,
        },
    ],
}

# Flat lookup: tool_key -> spec. Keys are globally unique by construction.
_TOOL_BY_KEY: dict[str, dict[str, Any]] = {
    entry["tool_key"]: entry
    for entries in TOOL_SPEC.values()
    for entry in entries
}
# tool_key -> the stage that owns it (a key belongs to exactly one stage).
_TOOL_STAGE: dict[str, StartupStage] = {
    entry["tool_key"]: stage
    for stage, entries in TOOL_SPEC.items()
    for entry in entries
}


async def _enforce_write_limit(user: User, action: str) -> None:
    """Per-actor throttle on stage writes (mirrors the 5f/5e pattern)."""
    settings = get_settings()
    if not await rate_limiter.check(
        f"stage:{action}:user:{user.id}",
        settings.STAGE_WRITE_LIMIT,
        settings.STAGE_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many stage updates. Please try again later.")


async def _profile_or_create(db: AsyncSession, org_id: uuid.UUID) -> StartupProfile:
    """The 5a ``_ensure_profile`` pattern, reused rather than re-written."""
    return await readiness_service._ensure_profile(db, org_id)


async def _stage_of(
    db: AsyncSession, org_id: uuid.UUID
) -> tuple[StartupProfile, StartupStage]:
    profile = await _profile_or_create(db, org_id)
    return profile, StartupStage(str(profile.stage))


def _history_read(row: StartupStageHistory) -> StageHistoryRead:
    return StageHistoryRead(
        id=row.id,
        from_stage=row.from_stage,
        to_stage=row.to_stage,
        changed_by=row.changed_by,
        changed_at=row.changed_at,
        note=row.note,
    )


async def change_stage(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: StageChange
) -> StageSummary:
    """Write the stage and its history row in ONE transaction (5i item 4).

    A no-op (same stage) writes no history row and is not an error: the UI
    can re-submit the current stage safely. Sign-offs are never touched.
    """
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    await _enforce_write_limit(user, "change")

    profile = await _profile_or_create(db, org.id)
    current = StartupStage(str(profile.stage))

    if current != payload.stage:
        profile.stage = payload.stage
        # Same transaction: if this insert fails, the stage change rolls
        # back too, so history can never miss a real change.
        db.add(
            StartupStageHistory(
                org_id=org.id,
                from_stage=current,
                to_stage=payload.stage,
                changed_by=user.id,
                changed_at=datetime.now(UTC),
                note=payload.note,
            )
        )
    await db.commit()
    await db.refresh(profile)
    return await get_summary(db, org.id)


async def get_summary(db: AsyncSession, org_id: uuid.UUID) -> StageSummary:
    """Current stage, when it started, and this stage's exit-criteria roll-up."""
    profile, stage = await _stage_of(db, org_id)

    since = (
        await db.execute(
            select(func.max(StartupStageHistory.changed_at)).where(
                StartupStageHistory.org_id == org_id,
                StartupStageHistory.to_stage == stage,
            )
        )
    ).scalar_one_or_none()
    if since is None:
        # No history at all: the startup has held this stage since the
        # profile existed. Never invent a date.
        has_any = (
            await db.execute(
                select(func.count(StartupStageHistory.id)).where(
                    StartupStageHistory.org_id == org_id
                )
            )
        ).scalar_one()
        since = profile.created_at if not has_any else None

    total = (
        await db.execute(
            select(func.count(ReadinessCriterion.id)).where(
                ReadinessCriterion.is_active.is_(True),
                ReadinessCriterion.is_exit_criterion.is_(True),
                ReadinessCriterion.stage == stage,
            )
        )
    ).scalar_one()
    signed_off = (
        await db.execute(
            select(func.count(StartupReadiness.id))
            .join(
                ReadinessCriterion,
                ReadinessCriterion.id == StartupReadiness.criterion_id,
            )
            .where(
                StartupReadiness.org_id == org_id,
                StartupReadiness.status == ReadinessStatus.signed_off,
                ReadinessCriterion.is_active.is_(True),
                ReadinessCriterion.is_exit_criterion.is_(True),
                ReadinessCriterion.stage == stage,
            )
        )
    ).scalar_one()

    return StageSummary(
        org_id=org_id,
        stage=stage,
        in_stage_since=since,
        exit_criteria_total=total,
        exit_criteria_signed_off=signed_off,
        readiness_pct=profile.readiness_score,
    )


async def list_history(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, limit: int, offset: int
) -> StageHistoryPage:
    """Newest first, stable tiebreak on id (offset pagination convention)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    total = (
        await db.execute(
            select(func.count(StartupStageHistory.id)).where(
                StartupStageHistory.org_id == org.id
            )
        )
    ).scalar_one()
    rows = (
        (
            await db.execute(
                select(StartupStageHistory)
                .where(StartupStageHistory.org_id == org.id)
                .order_by(
                    StartupStageHistory.changed_at.desc(),
                    StartupStageHistory.id.desc(),
                )
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return StageHistoryPage(
        items=[_history_read(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


async def _exit_criteria(
    db: AsyncSession, org_id: uuid.UUID, stage: StartupStage
) -> tuple[list[ReadinessCriterion], dict[uuid.UUID, StartupReadiness]]:
    criteria = list(
        (
            await db.execute(
                select(ReadinessCriterion)
                .where(
                    ReadinessCriterion.is_active.is_(True),
                    ReadinessCriterion.is_exit_criterion.is_(True),
                    ReadinessCriterion.stage == stage,
                )
                .order_by(
                    ReadinessCriterion.display_order, ReadinessCriterion.code
                )
            )
        )
        .scalars()
        .all()
    )
    existing = {
        row.criterion_id: row
        for row in (
            await db.execute(
                select(StartupReadiness).where(StartupReadiness.org_id == org_id)
            )
        )
        .scalars()
        .all()
    }
    return criteria, existing


async def get_stage_criteria(
    db: AsyncSession, user: User, org_id: uuid.UUID, stage: StartupStage
) -> StageCriteriaBoard:
    """The exit criteria of ONE stage with this org's state.

    State rows are created on demand (the 5f D5 pattern), so the caller
    always receives a complete checklist rather than a sparse map.
    """
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    profile, current = await _stage_of(db, org.id)

    criteria, existing = await _exit_criteria(db, org.id, stage)
    items: list[ReadinessRead] = []
    for criterion in criteria:
        state = existing.get(criterion.id)
        if state is None:
            state = await readiness_service.state_for(db, org.id, criterion)
        items.append(readiness_service.criterion_read(criterion, state))
    await db.commit()

    return StageCriteriaBoard(
        org_id=org.id,
        stage=stage,
        is_current_stage=current == stage,
        items=items,
    )


def _tool_read(
    spec: dict[str, Any], row: StageToolProgress | None
) -> StageToolRead:
    return StageToolRead(
        tool_key=spec["tool_key"],
        name=spec["name"],
        description=spec["description"],
        is_optional=bool(spec["is_optional"]),
        status=ToolStatus(str(row.status)) if row is not None else ToolStatus.not_started,
        progress=row.progress if row is not None else 0,
        notes=row.notes if row is not None else None,
    )


async def get_tools(
    db: AsyncSession, user: User, org_id: uuid.UUID, stage: StartupStage
) -> StageToolBoard:
    """All tools for a stage, merged with this org's saved progress."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    rows = {
        row.tool_key: row
        for row in (
            await db.execute(
                select(StageToolProgress).where(
                    StageToolProgress.org_id == org.id,
                    StageToolProgress.stage == stage,
                )
            )
        )
        .scalars()
        .all()
    }
    specs = TOOL_SPEC[stage]
    items = [_tool_read(spec, rows.get(spec["tool_key"])) for spec in specs]
    return StageToolBoard(
        org_id=org.id,
        stage=stage,
        items=items,
        completed=sum(1 for item in items if item.status == ToolStatus.done),
        total=len(items),
    )


async def get_tool(
    db: AsyncSession, user: User, org_id: uuid.UUID, tool_key: str
) -> StageToolRead:
    """One tool. The stage comes from the vocabulary, never from the URL,
    so a key can never be addressed under the wrong stage."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    spec = _TOOL_BY_KEY.get(tool_key)
    if spec is None:
        raise not_found("Stage tool not found.")
    stage = _TOOL_STAGE[tool_key]
    row = (
        await db.execute(
            select(StageToolProgress).where(
                StageToolProgress.org_id == org.id,
                StageToolProgress.stage == stage,
                StageToolProgress.tool_key == tool_key,
            )
        )
    ).scalar_one_or_none()
    return _tool_read(spec, row)


def _reconcile(
    status: ToolStatus | None, progress: int | None
) -> tuple[ToolStatus | None, int | None]:
    """Keep status and progress from contradicting each other.

    ``done`` forces 100 and ``not_started`` forces 0. When only one of the
    two is sent, the other is derived so the stored pair is always
    consistent (the frontend never has to send both).
    """
    if status == ToolStatus.done:
        return ToolStatus.done, 100
    if status == ToolStatus.not_started:
        return ToolStatus.not_started, 0
    if status == ToolStatus.in_progress:
        return ToolStatus.in_progress, progress
    if progress is not None:
        # Progress without an explicit status: derive a sensible status.
        if progress == 0:
            return ToolStatus.not_started, 0
        if progress == 100:
            return ToolStatus.done, 100
        return ToolStatus.in_progress, progress
    return None, None


async def update_tool(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    tool_key: str,
    payload: StageToolUpdate,
) -> StageToolRead:
    """Upsert one tool's progress (5j item 1).

    ``stage``/``tool_key``/``updated_by`` are server-controlled: the first
    two come from the vocabulary, the last from the token. A client can
    only ever move status, progress and notes.
    """
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    await _enforce_write_limit(user, "tool")

    spec = _TOOL_BY_KEY.get(tool_key)
    if spec is None:
        raise not_found("Stage tool not found.")
    stage = _TOOL_STAGE[tool_key]

    data = payload.model_dump(exclude_unset=True)
    status, progress = _reconcile(data.get("status"), data.get("progress"))

    await _profile_or_create(db, org.id)
    row = (
        await db.execute(
            select(StageToolProgress).where(
                StageToolProgress.org_id == org.id,
                StageToolProgress.stage == stage,
                StageToolProgress.tool_key == tool_key,
            )
        )
    ).scalar_one_or_none()

    if row is None:
        row = StageToolProgress(
            org_id=org.id,
            stage=stage,
            tool_key=tool_key,
            status=status or ToolStatus.not_started,
            progress=progress or 0,
            notes=data.get("notes"),
            updated_by=user.id,
        )
        db.add(row)
        try:
            await db.commit()
        except IntegrityError:
            # Concurrent first write: re-read the winner and apply to it.
            await db.rollback()
            row = (
                await db.execute(
                    select(StageToolProgress).where(
                        StageToolProgress.org_id == org.id,
                        StageToolProgress.stage == stage,
                        StageToolProgress.tool_key == tool_key,
                    )
                )
            ).scalar_one()
            return await _apply_and_commit(db, row, status, progress, data, user)
    else:
        return await _apply_and_commit(db, row, status, progress, data, user)

    await db.refresh(row)
    return _tool_read(spec, row)


async def _apply_and_commit(
    db: AsyncSession,
    row: StageToolProgress,
    status: ToolStatus | None,
    progress: int | None,
    data: dict[str, Any],
    user: User,
) -> StageToolRead:
    if status is not None:
        row.status = status
    if progress is not None:
        row.progress = progress
    if "notes" in data:
        row.notes = data["notes"]
    row.updated_by = user.id
    await db.commit()
    await db.refresh(row)
    spec = _TOOL_BY_KEY[row.tool_key]
    return _tool_read(spec, row)
