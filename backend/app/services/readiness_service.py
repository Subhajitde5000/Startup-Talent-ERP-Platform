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

# Fields the bootstrap owns. Existing rows are updated in place so wording
# fixes roll out, while activity/weights stay untouched.
_BOOTSTRAP_FIELDS = ("title", "description", "stage", "display_order")


async def bootstrap_criteria(db: AsyncSession) -> tuple[int, int]:
    """Idempotent criteria bootstrap (BUILD_PLAN 5f item 1, plan D2).

    Keyed by ``code``: missing rows are inserted, existing rows are updated
    in place (and re-activated if someone switched them off). Returns
    ``(inserted, updated)``. Never called from a migration — migrations
    carry schema, not data (AGENTS.md).
    """
    inserted = 0
    updated = 0
    for spec in CRITERIA_SPEC:
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
    result = await db.execute(
        select(ReadinessCriterion)
        .where(ReadinessCriterion.is_active.is_(True))
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


async def _state_for(
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


def _read(criterion: ReadinessCriterion, state: StartupReadiness) -> ReadinessRead:
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
    total = (
        await db.execute(
            select(func.count(ReadinessCriterion.id)).where(
                ReadinessCriterion.is_active.is_(True)
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
            state = await _state_for(db, org.id, criterion)
        items.append(_read(criterion, state))

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
    state = await _state_for(db, org.id, criterion)
    # This call may have created the profile row; never leave the cached
    # roll-up NULL when a readiness row exists (plan D1: 0 when none).
    await _recompute_score(db, org.id)
    await db.commit()
    return _read(criterion, state)


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
    state = await _state_for(db, org.id, criterion)

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
    return _read(criterion, state)


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
    state = await _state_for(db, org.id, criterion)

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
    return _read(criterion, state)


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
    state = await _state_for(db, org.id, criterion)

    _require_transition(
        state.status, frozenset({ReadinessStatus.submitted}), "withdraw"
    )
    state.status = ReadinessStatus.in_progress
    await _recompute_score(db, org.id)
    await db.commit()
    await db.refresh(state)
    return _read(criterion, state)


async def sign_off(
    db: AsyncSession, user: User, org_id: uuid.UUID, criterion_id: uuid.UUID
) -> ReadinessRead:
    """Platform admin signs off a submitted item (mentor sign-off is Step 8)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await _enforce_action_limit(user, "sign_off")
    criterion = await _criterion_or_404(db, criterion_id)
    state = await _state_for(db, org.id, criterion)

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
    return _read(criterion, state)


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
    state = await _state_for(db, org.id, criterion)

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
    return _read(criterion, state)


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
