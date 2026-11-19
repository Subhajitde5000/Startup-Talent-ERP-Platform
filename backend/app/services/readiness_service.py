"""Readiness service (Step 5f).

Object-level rules (BUILD_PLAN Step 5 security):
- Startup organizations only; wrong-type / suspended / deleted orgs 404 via
  ``organization_service.startup_org_or_404`` (no existence oracle).
- Reads need an ACTIVE membership of any role (viewers read). Startup-side
  writes (evidence/notes, submit, withdraw) need owner/admin/member.
- Sign-off and rejection are **platform-admin only** (plan D3). No startup
  member can hold ``admin`` (register/add-role whitelist excludes it), so a
  founder can never sign off their own startup.
- Every lookup is scoped by ``org_id``: the org's state rows are created on
  demand (plan D5) with a savepoint so a concurrent creator cannot abort the
  caller's transaction; an unknown or inactive criterion is 404.
- State machine is enforced here, not in the router:
  ``not_started|in_progress|rejected -> submitted`` (submit),
  ``submitted -> in_progress`` (withdraw), ``submitted -> signed_off``
  (admin sign-off), ``submitted -> rejected`` (admin reject).
  An illegal transition is 409, never a silent write.
- ``signed_off_by``/``signed_off_at`` are stamped from the authenticated
  actor; ``score`` is never written (plan D4).
- Transitions are rate-limited per actor (plan: READINESS_ACTION_LIMIT).

Scoring (plan D1): ``readiness_pct = round(100 * signed_off / active_count)``
over ALL active criteria, written to ``startup_profiles.readiness_score``
in the same transaction as every transition, so the cached number can
never drift from the rows.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited, validation_error
from app.models.organization import OrgRole
from app.models.readiness import (
    ReadinessCriterion,
    ReadinessStatus,
    StartupReadiness,
)
from app.models.startup import StartupProfile, StartupStage
from app.models.user import User
from app.schemas.readiness import (
    ReadinessBoard,
    ReadinessCriterionRead,
    ReadinessRead,
    ReadinessReject,
    ReadinessSummary,
    ReadinessUpdate,
)
from app.services import organization_service
from app.services.rate_limiter import rate_limiter

# Viewer role is deliberately excluded from startup-side writes.
_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})

# Statuses a startup may submit FROM (D6: a rejected item can be reworked).
_SUBMITTABLE = frozenset(
    {
        ReadinessStatus.not_started,
        ReadinessStatus.in_progress,
        ReadinessStatus.rejected,
    }
)


# Plan D2 (user-approved): the six checklist items of /startup/readiness.
# ``code`` is the stable machine key (a task's linked criterion), the title
# mirrors the page copy verbatim, and ``display_order`` is the page order.
# ``weight`` stays 1: 5f scores unweighted (plan D1).
CRITERIA_SPEC: list[dict[str, object]] = [
    {
        "code": "pitch_deck_summary",
        "title": "Pitch deck and one-page summary reviewed",
        "description": (
            "Your deck and one-page summary are current and have been "
            "reviewed for clarity, numbers and story."
        ),
        "stage": StartupStage.prototype,
        "display_order": 1,
    },
    {
        "code": "business_model_economics",
        "title": "Business model and unit economics validated",
        "description": (
            "The revenue model is documented and unit economics are "
            "supported by real or clearly-labelled assumed numbers."
        ),
        "stage": StartupStage.prototype,
        "display_order": 2,
    },
    {
        "code": "financial_projections",
        "title": "Financial projections and use of funds defined",
        "description": (
            "Projections, runway and the planned use of funds are written "
            "down and internally consistent."
        ),
        "stage": StartupStage.early_revenue,
        "display_order": 3,
    },
    {
        "code": "cap_table_legal",
        "title": "Cap table and legal basics in order",
        "description": (
            "Cap table, incorporation documents and founder agreements are "
            "complete and free of known issues."
        ),
        "stage": StartupStage.early_revenue,
        "display_order": 4,
    },
    {
        "code": "traction_metrics",
        "title": "Traction metrics documented",
        "description": (
            "The metrics that matter for your stage are tracked and can be "
            "shown with a clear definition for each."
        ),
        "stage": StartupStage.growth,
        "display_order": 5,
    },
    {
        "code": "data_room_complete",
        "title": "Data room complete",
        "description": (
            "The documents an investor asks for are collected in one place "
            "and up to date."
        ),
        "stage": StartupStage.growth,
        "display_order": 6,
    },
]

# 5i (D1): the 25 stage exit criteria, five per stage, in page order.
# Titles mirror ``frontend/app/startup/stage/stage-page.jsx`` verbatim so
# the UI can swap demo copy for these rows without a redesign.
# ``is_exit_criterion=True`` keeps them OUT of readiness_score; ``code`` is
# prefixed ``exit_`` so it can never collide with a 5f readiness item.
_EXIT_CRITERIA_SPEC: list[dict[str, object]] = [
    # --- idea ---------------------------------------------------------
    {
        "code": "exit_idea_problem_statement",
        "description": 'A written problem statement that a mentor has read and confirmed.',
        "title": "Problem statement written and reviewed by a mentor",
        "stage": StartupStage.idea,
        "display_order": 1,
    },
    {
        "code": "exit_idea_customer_interviews",
        "description": 'Interview notes from at least ten conversations, with the themes summarized.',
        "title": "At least 10 customer interviews logged, with insights summarized",
        "stage": StartupStage.idea,
        "display_order": 2,
    },
    {
        "code": "exit_idea_customer_profile",
        "description": 'A description of who the customer is, what they need and how they buy.',
        "title": "Target customer profile defined",
        "stage": StartupStage.idea,
        "display_order": 3,
    },
    {
        "code": "exit_idea_market_size",
        "description": 'TAM, SAM and SOM with the sources behind each assumption.',
        "title": "Market size estimated with sources",
        "stage": StartupStage.idea,
        "display_order": 4,
    },
    {
        "code": "exit_idea_problem_validated",
        "description": 'A mentor has reviewed your interviews and agrees the problem is real.',
        "title": "Mentor confirms the problem is validated",
        "stage": StartupStage.idea,
        "display_order": 5,
    },
    # --- prototype ----------------------------------------------------
    {
        "code": "exit_prototype_mvp_scope",
        "description": 'The smallest useful version is written down and ranked by what you will build first.',
        "title": "MVP scope defined and prioritized",
        "stage": StartupStage.prototype,
        "display_order": 1,
    },
    {
        "code": "exit_prototype_released",
        "description": 'Test users can reach the prototype and complete the core flow.',
        "title": "Working prototype released to test users",
        "stage": StartupStage.prototype,
        "display_order": 2,
    },
    {
        "code": "exit_prototype_test_users",
        "description": 'Feedback from at least five test users, recorded and grouped.',
        "title": "At least 5 test users have tried it and given feedback",
        "stage": StartupStage.prototype,
        "display_order": 3,
    },
    {
        "code": "exit_prototype_feedback_reviewed",
        "description": 'What you learned is written up and the next iteration is planned.',
        "title": "Feedback reviewed and next iterations planned",
        "stage": StartupStage.prototype,
        "display_order": 4,
    },
    {
        "code": "exit_prototype_mvp_confirmed",
        "description": 'A mentor has used the prototype and agrees it works as intended.',
        "title": "Mentor confirms the MVP is functional",
        "stage": StartupStage.prototype,
        "display_order": 5,
    },
    # --- early revenue -------------------------------------------------
    {
        "code": "exit_early_revenue_customers",
        "description": 'Paying customers onboarded, and the target segment confirmed against them.',
        "title": "Paying customers onboarded and target confirmed",
        "stage": StartupStage.early_revenue,
        "display_order": 1,
    },
    {
        "code": "exit_early_revenue_recurring",
        "description": 'Three consecutive months of recurring revenue, recorded in your metrics.',
        "title": "Recurring revenue recorded for 3 consecutive months",
        "stage": StartupStage.early_revenue,
        "display_order": 2,
    },
    {
        "code": "exit_early_revenue_sales_process",
        "description": 'The steps from first contact to signed contract, written down and repeatable.',
        "title": "Sales process documented and repeatable",
        "stage": StartupStage.early_revenue,
        "display_order": 3,
    },
    {
        "code": "exit_early_revenue_unit_economics",
        "description": 'CAC and payback calculated from your own numbers, not estimates.',
        "title": "Unit economics (CAC, payback) calculated",
        "stage": StartupStage.early_revenue,
        "display_order": 4,
    },
    {
        "code": "exit_early_revenue_traction_confirmed",
        "description": 'A mentor has reviewed your revenue and agrees traction is real.',
        "title": "Mentor confirms traction",
        "stage": StartupStage.early_revenue,
        "display_order": 5,
    },
    # --- growth --------------------------------------------------------
    {
        "code": "exit_growth_channels",
        "description": 'The channels that bring demand, with their cost and volume recorded.',
        "title": "Growth channels documented and producing steady demand",
        "stage": StartupStage.growth,
        "display_order": 1,
    },
    {
        "code": "exit_growth_retention",
        "description": 'Retention and conversion tracked weekly, with definitions for each metric.',
        "title": "Retention and conversion tracked week over week",
        "stage": StartupStage.growth,
        "display_order": 2,
    },
    {
        "code": "exit_growth_unit_economics",
        "description": 'CAC, LTV and payback modelled and consistent with the plan.',
        "title": "Unit economics (CAC, LTV, payback) support the plan",
        "stage": StartupStage.growth,
        "display_order": 3,
    },
    {
        "code": "exit_growth_hiring_plan",
        "description": 'The roles you need over the next twelve months, with timing and budget.',
        "title": "Hiring plan aligned to the next 12 months",
        "stage": StartupStage.growth,
        "display_order": 4,
    },
    {
        "code": "exit_growth_engine_confirmed",
        "description": 'A mentor has reviewed the channel data and agrees growth is repeatable.',
        "title": "Mentor confirms the growth engine is repeatable",
        "stage": StartupStage.growth,
        "display_order": 5,
    },
    # --- mature --------------------------------------------------------
    {
        "code": "exit_mature_financials",
        "description": 'Current financial statements, reviewed and internally consistent.',
        "title": "Financials reviewed and up to date",
        "stage": StartupStage.mature,
        "display_order": 1,
    },
    {
        "code": "exit_mature_cap_table",
        "description": 'Cap table and option pool kept current, including recent grants.',
        "title": "Cap table and ESOP plan current",
        "stage": StartupStage.mature,
        "display_order": 2,
    },
    {
        "code": "exit_mature_board_reporting",
        "description": 'A regular board pack and a standing reporting date.',
        "title": "Board reporting cadence established",
        "stage": StartupStage.mature,
        "display_order": 3,
    },
    {
        "code": "exit_mature_data_room",
        "description": 'The diligence documents are complete and access is reviewed.',
        "title": "Data room complete and access reviewed",
        "stage": StartupStage.mature,
        "display_order": 4,
    },
    {
        "code": "exit_mature_operating_plan",
        "description": 'A twelve-month hiring and operating plan that matches the budget.',
        "title": "12-month hiring and operating plan ready",
        "stage": StartupStage.mature,
        "display_order": 5,
    },
]

# The spec actually bootstrapped: the six 5f items (is_exit_criterion
# False, which is why they keep feeding readiness_score) + the 25 5i items.
# Every entry carries the flag explicitly so ``_BOOTSTRAP_FIELDS`` can
# compare it uniformly.
ALL_CRITERIA_SPEC: list[dict[str, object]] = [
    *[{"is_exit_criterion": False, **spec} for spec in CRITERIA_SPEC],
    *[{"is_exit_criterion": True, **spec} for spec in _EXIT_CRITERIA_SPEC],
]

# Fields the bootstrap owns. Existing rows are updated in place so wording
# fixes roll out, while activity/weights stay untouched.
_BOOTSTRAP_FIELDS = (
    "title",
    "description",
    "stage",
    "display_order",
    "is_exit_criterion",
)


async def bootstrap_criteria(db: AsyncSession) -> tuple[int, int]:
    """Idempotent criteria bootstrap (5f item 1 plan D2, extended by 5i).

    Keyed by ``code``: missing rows are inserted, existing rows are updated
    in place (and re-activated if someone switched them off). Returns
    ``(inserted, updated)``. Never called from a migration — migrations
    carry schema, not data (AGENTS.md).

    Covers BOTH audiences since 5i: the six readiness items
    (``is_exit_criterion=False``) and the 25 stage exit criteria
    (``True``). Re-running is a no-op.
    """
    inserted = 0
    updated = 0
    for spec in ALL_CRITERIA_SPEC:
        existing = (
            await db.execute(
                select(ReadinessCriterion).where(
                    ReadinessCriterion.code == spec["code"]
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            db.add(ReadinessCriterion(**spec))
            inserted += 1
            continue
        changed = False
        for field in _BOOTSTRAP_FIELDS:
            # A spec may omit a field (the 5i exit criteria carry no
            # description): an omitted key means "leave it alone", never
            # "set it to null". ``setdefault`` keeps the lookup total.
            if field not in spec:
                continue
            if getattr(existing, field) != spec[field]:
                setattr(existing, field, spec[field])
                changed = True
        if not existing.is_active:
            existing.is_active = True
            changed = True
        updated += 1 if changed else 0
    await db.commit()
    return inserted, updated


async def _active_criteria(db: AsyncSession) -> list[ReadinessCriterion]:
    """The six readiness items (5f). Exit criteria are excluded here so
    /startup/readiness keeps showing exactly the checklist it always has;
    they are read through ``stage_service`` instead (5i D1)."""
    result = await db.execute(
        select(ReadinessCriterion)
        .where(
            ReadinessCriterion.is_active.is_(True),
            ReadinessCriterion.is_exit_criterion.is_(False),
        )
        .order_by(ReadinessCriterion.display_order, ReadinessCriterion.code)
    )
    return list(result.scalars().all())


async def _criterion_or_404(
    db: AsyncSession, criterion_id: uuid.UUID
) -> ReadinessCriterion:
    """Active criterion by id; unknown/inactive is 404 (reference data is
    global, so this is not an org-scoped lookup)."""
    result = await db.execute(
        select(ReadinessCriterion).where(
            ReadinessCriterion.id == criterion_id,
            ReadinessCriterion.is_active.is_(True),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Readiness criterion not found.")
    return row


async def _select_profile(
    db: AsyncSession, org_id: uuid.UUID
) -> StartupProfile | None:
    result = await db.execute(
        select(StartupProfile).where(StartupProfile.org_id == org_id)
    )
    return result.scalar_one_or_none()


async def _ensure_profile(db: AsyncSession, org_id: uuid.UUID) -> StartupProfile:
    """Create the startup profile on demand (5a D10 pattern).

    Readiness rows reference ``startup_profiles.org_id``, so the parent row
    must exist before the first state row is written. The insert sits in a
    savepoint: when a concurrent request wins the primary key, only this
    savepoint rolls back and the winner's row is re-read (5a race handling).
    """
    profile = await _select_profile(db, org_id)
    if profile is not None:
        return profile
    try:
        async with db.begin_nested():
            profile = StartupProfile(org_id=org_id)
            db.add(profile)
            await db.flush()
        return profile
    except IntegrityError:
        winner = await _select_profile(db, org_id)
        if winner is None:  # pragma: no cover - FK violation, not a race
            raise
        return winner


async def _select_state(
    db: AsyncSession, org_id: uuid.UUID, criterion_id: uuid.UUID
) -> StartupReadiness | None:
    result = await db.execute(
        select(StartupReadiness).where(
            StartupReadiness.org_id == org_id,
            StartupReadiness.criterion_id == criterion_id,
        )
    )
    return result.scalar_one_or_none()


async def state_for(
    db: AsyncSession, org_id: uuid.UUID, criterion: ReadinessCriterion
) -> StartupReadiness:
    """This org's row for a criterion, created on demand (plan D5).

    ``startup_readiness_unique`` makes this race-safe: the loser's savepoint
    rolls back and the winner's row is re-read instead of duplicated (the 5a
    ``_ensure_profile`` pattern, but scoped so unrelated work survives).
    """
    row = await _select_state(db, org_id, criterion.id)
    if row is not None:
        return row
    await _ensure_profile(db, org_id)
    try:
        async with db.begin_nested():
            row = StartupReadiness(
                org_id=org_id,
                criterion_id=criterion.id,
                status=ReadinessStatus.not_started,
            )
            db.add(row)
            await db.flush()
        return row
    except IntegrityError:
        winner = await _select_state(db, org_id, criterion.id)
        if winner is None:  # pragma: no cover - not a unique-index race
            raise
        return winner


def criterion_read(
    criterion: ReadinessCriterion, state: StartupReadiness
) -> ReadinessRead:
    return ReadinessRead(
        # The startup_readiness row id — what ``tasks.readiness_id`` points
        # at (schema.sql FK). ``criterion_id`` is the global reference row.
        id=state.id,
        criterion_id=criterion.id,
        code=criterion.code,
        title=criterion.title,
        description=criterion.description,
        stage=criterion.stage,
        display_order=criterion.display_order,
        is_exit_criterion=criterion.is_exit_criterion,
        status=state.status,
        evidence=state.evidence,
        notes=state.notes,
        signed_off_by=state.signed_off_by,
        signed_off_at=state.signed_off_at,
        updated_at=state.updated_at,
    )


async def _recompute_score(db: AsyncSession, org_id: uuid.UUID) -> ReadinessSummary:
    """Plan D1: signed-off / active criteria, cached on the profile.

    Denominator = active criteria count (never the number of touched rows,
    which is what the schema.sql view would divide by).
    """
    # 5i D1: the score counts the READINESS items only. Stage exit criteria
    # are readiness rows too, but adding them must never move a 5f
    # percentage, so both the denominator and the numerator exclude them.
    total = (
        await db.execute(
            select(func.count(ReadinessCriterion.id)).where(
                ReadinessCriterion.is_active.is_(True),
                ReadinessCriterion.is_exit_criterion.is_(False),
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
                ReadinessCriterion.is_exit_criterion.is_(False),
            )
        )
    ).scalar_one()

    pct = round(100 * signed_off / total) if total else 0
    profile = await _ensure_profile(db, org_id)
    # Cached roll-up; the rows above remain the source of truth.
    profile.readiness_score = pct
    return ReadinessSummary(
        criteria_total=total,
        criteria_signed_off=signed_off,
        readiness_pct=pct,
        is_ready=bool(total) and signed_off == total,
    )


def _require_transition(
    current: ReadinessStatus | str,
    allowed: frozenset[ReadinessStatus],
    action: str,
) -> None:
    """``status`` is VARCHAR + CHECK (schema.sql names a text column), so the
    driver hands back a plain ``str``; normalise before comparing."""
    status = current if isinstance(current, ReadinessStatus) else ReadinessStatus(current)
    if status not in allowed:
        raise conflict(
            f"Cannot {action} an item that is {status.value.replace('_', ' ')}."
        )


async def _enforce_action_limit(user: User, action: str) -> None:
    """Per-actor throttle on the state transitions (plan security matrix).

    Kept separate from the auth limits: a member clicking through six
    criteria never comes near it, but a scripted loop is cut off.
    """
    settings = get_settings()
    if not await rate_limiter.check(
        f"readiness:{action}:user:{user.id}",
        settings.READINESS_ACTION_LIMIT,
        settings.READINESS_ACTION_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many readiness updates. Please try again later.")


async def list_criteria(db: AsyncSession) -> list[ReadinessCriterionRead]:
    """Global reference list (any authenticated caller): the checklist
    text, without any organization's state."""
    rows = await _active_criteria(db)
    return [
        ReadinessCriterionRead(
            id=row.id,
            code=row.code,
            title=row.title,
            description=row.description,
            stage=row.stage,
            weight=row.weight,
            display_order=row.display_order,
            is_exit_criterion=row.is_exit_criterion,
        )
        for row in rows
    ]


async def get_board(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> ReadinessBoard:
    """The whole page: criteria + this org's state + summary.

    Plan D5: the read materialises a ``not_started`` row for every active
    criterion the org has no state for (create-on-demand), so the board and
    the stored rows agree from the first visit. Any active member may read.
    """
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    criteria = await _active_criteria(db)
    existing = {
        row.criterion_id: row
        for row in (
            await db.execute(
                select(StartupReadiness).where(StartupReadiness.org_id == org.id)
            )
        )
        .scalars()
        .all()
    }
    items: list[ReadinessRead] = []
    for criterion in criteria:
        state = existing.get(criterion.id)
        if state is None:
            state = await state_for(db, org.id, criterion)
        items.append(criterion_read(criterion, state))

    summary = await _recompute_score(db, org.id)
    # The read persists its own not_started rows (D5); scoring rides the
    # same commit so the cached number is written exactly once.
    await db.commit()
    return ReadinessBoard(org_id=org.id, summary=summary, items=items)


async def get_item(
    db: AsyncSession, user: User, org_id: uuid.UUID, criterion_id: uuid.UUID
) -> ReadinessRead:
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)
    criterion = await _criterion_or_404(db, criterion_id)
    state = await state_for(db, org.id, criterion)
    # This call may have created the profile row; never leave the cached
    # roll-up NULL when a readiness row exists (plan D1: 0 when none).
    await _recompute_score(db, org.id)
    await db.commit()
    return criterion_read(criterion, state)


async def update_evidence(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    criterion_id: uuid.UUID,
    payload: ReadinessUpdate,
) -> ReadinessRead:
    """Startup-side field patch: evidence and notes only (plan D6).

    Editing evidence on an untouched item moves it to ``in_progress``. A
    ``submitted`` item keeps its status (the reviewer's queue is unchanged),
    and a ``signed_off`` item drops back to ``in_progress`` with the stamp
    cleared: the score must never credit evidence nobody reviewed.
    """
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    criterion = await _criterion_or_404(db, criterion_id)
    state = await state_for(db, org.id, criterion)

    previously_signed_off = state.status == ReadinessStatus.signed_off
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(state, field, value)
    if state.status == ReadinessStatus.not_started:
        state.status = ReadinessStatus.in_progress
    elif previously_signed_off:
        state.status = ReadinessStatus.in_progress
        state.signed_off_by = None
        state.signed_off_at = None
    # Cheap (two counts) and keeps the cached profile score exact on every
    # write, not only on the transitions that can move it.
    await _recompute_score(db, org.id)
    await db.commit()
    await db.refresh(state)
    return criterion_read(criterion, state)


async def submit(
    db: AsyncSession, user: User, org_id: uuid.UUID, criterion_id: uuid.UUID
) -> ReadinessRead:
    """Startup sends an item for review (plan D6: evidence is required)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    await _enforce_action_limit(user, "submit")
    criterion = await _criterion_or_404(db, criterion_id)
    state = await state_for(db, org.id, criterion)

    _require_transition(state.status, _SUBMITTABLE, "submit")
    if not (state.evidence and state.evidence.strip()):
        message = "Add evidence before submitting this item for review."
        raise validation_error(
            message,
            details=[
                {"loc": ["body", "evidence"], "msg": message, "type": "value_error"}
            ],
        )
    state.status = ReadinessStatus.submitted
    # A fresh submission carries no old decision.
    state.signed_off_by = None
    state.signed_off_at = None
    await _recompute_score(db, org.id)
    await db.commit()
    await db.refresh(state)
    return criterion_read(criterion, state)


async def withdraw(
    db: AsyncSession, user: User, org_id: uuid.UUID, criterion_id: uuid.UUID
) -> ReadinessRead:
    """Startup takes a submitted item back before it is reviewed."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    await _enforce_action_limit(user, "withdraw")
    criterion = await _criterion_or_404(db, criterion_id)
    state = await state_for(db, org.id, criterion)

    _require_transition(
        state.status, frozenset({ReadinessStatus.submitted}), "withdraw"
    )
    state.status = ReadinessStatus.in_progress
    await _recompute_score(db, org.id)
    await db.commit()
    await db.refresh(state)
    return criterion_read(criterion, state)


async def sign_off(
    db: AsyncSession, user: User, org_id: uuid.UUID, criterion_id: uuid.UUID
) -> ReadinessRead:
    """Platform admin signs off a submitted item (mentor sign-off is Step 8)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await _enforce_action_limit(user, "sign_off")
    criterion = await _criterion_or_404(db, criterion_id)
    state = await state_for(db, org.id, criterion)

    _require_transition(
        state.status, frozenset({ReadinessStatus.submitted}), "sign off"
    )
    state.status = ReadinessStatus.signed_off
    # Always the authenticated actor, never the request body (plan D3).
    state.signed_off_by = user.id
    state.signed_off_at = datetime.now(UTC)
    await _recompute_score(db, org.id)
    await db.commit()
    await db.refresh(state)
    return criterion_read(criterion, state)


async def reject(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    criterion_id: uuid.UUID,
    payload: ReadinessReject,
) -> ReadinessRead:
    """Platform admin sends a submitted item back with a reason."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await _enforce_action_limit(user, "reject")
    criterion = await _criterion_or_404(db, criterion_id)
    state = await state_for(db, org.id, criterion)

    _require_transition(
        state.status, frozenset({ReadinessStatus.submitted}), "reject"
    )
    state.status = ReadinessStatus.rejected
    state.notes = payload.reason
    state.signed_off_by = None
    state.signed_off_at = None
    await _recompute_score(db, org.id)
    await db.commit()
    await db.refresh(state)
    return criterion_read(criterion, state)


async def require_readiness_ref(
    db: AsyncSession, org_id: uuid.UUID, readiness_id: uuid.UUID
) -> None:
    """Cross-org/IDOR guard for ``tasks.readiness_id`` (5c D1 deferral).

    A readiness row belonging to another organization is a 422 on
    ``body.readiness_id`` — the same treatment milestone/assignee
    references get, never an existence oracle.
    """
    result = await db.execute(
        select(StartupReadiness.id).where(
            StartupReadiness.id == readiness_id,
            StartupReadiness.org_id == org_id,
        )
    )
    if result.first() is None:
        message = "Criterion must be a readiness item of this organization."
        raise validation_error(
            message,
            details=[
                {"loc": ["body", "readiness_id"], "msg": message, "type": "value_error"}
            ],
        )
