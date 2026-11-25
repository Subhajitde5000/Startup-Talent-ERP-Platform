"""Step 7e scorecards, per-applicant scores and side-by-side compare.

Template CRUD is organization-scoped (owner/admin writes, any hiring
member reads). Application scores and compare reuse the 7d applicant
scope helpers (``scoped``/``writable``/``authorize``) so a member who
cannot see an applicant can neither score them nor compare them, and
closed jobs and terminal applications stay read-only.

Server-owned everywhere: ``org_id`` and ``is_platform`` from the
service, ``display_order`` from list position, ``interviewer_id`` from
the caller. Weighted totals are computed here and never accepted from a
client.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_role
from app.core.exceptions import conflict, forbidden, not_found, rate_limited, validation_error
from app.models.activity import ActivityEventType
from app.models.job_application import JobApplication
from app.models.organization import OrganizationMember, OrgRole, OrgType
from app.models.scorecard import ApplicationScore, Scorecard, ScorecardCriterion
from app.models.user import User, UserRole
from app.schemas.job_application import ProfileSnapshot
from app.schemas.scorecard import (
    ApplicationScoresRead,
    CompareApplicant,
    CompareCell,
    CompareCriterion,
    CompareRead,
    CriterionRead,
    CriterionScoresRead,
    ScorecardCreate,
    ScorecardPage,
    ScorecardRead,
    ScorecardUpdate,
    ScoreEntry,
    ScoresPut,
)
from app.services import (
    activity_service,
    applicant_pipeline_service,
    job_service,
    organization_service,
)
from app.services.rate_limiter import rate_limiter

MANAGERS = {OrgRole.owner, OrgRole.admin}
_READ_ROLES = {OrgRole.owner, OrgRole.admin, OrgRole.member}
_EMPLOYER = require_role(UserRole.employer)
_STARTUP_HIRING = require_role(UserRole.employer, UserRole.startup)


async def authorize_cards(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False
) -> OrganizationMember:
    """Hiring-org membership gate for scorecard template CRUD (no job scope)."""
    org = await organization_service.org_or_404(db, org_id)
    if org.type not in {OrgType.employer, OrgType.startup} or org.status != "active":
        raise not_found("Organization not found.")
    await (_STARTUP_HIRING if org.type == OrgType.startup else _EMPLOYER)(db, user)
    if user.status != "active" or user.email_verified_at is None:
        raise forbidden("An active, verified hiring account is required.")
    member = await organization_service.require_membership(
        db, org.id, user, roles=set(MANAGERS) if write else _READ_ROLES
    )
    settings = get_settings()
    maximum = settings.SCORECARD_WRITE_LIMIT if write else settings.SCORECARD_READ_LIMIT
    action = "write" if write else "read"
    if not await rate_limiter.check(f"scorecard_{action}:{user.id}", maximum, 60):
        raise rate_limited("Too many scorecard operations. Please try again later.")
    return member


async def _card(
    db: AsyncSession, org_id: uuid.UUID, scorecard_id: uuid.UUID, *, lock: bool = False
) -> Scorecard:
    query = select(Scorecard).where(
        Scorecard.id == scorecard_id,
        Scorecard.org_id == org_id,
        Scorecard.deleted_at.is_(None),
    )
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(query)).scalar_one_or_none()
    if row is None:
        raise not_found("Scorecard not found.")
    return row


async def _criteria(db: AsyncSession, scorecard_id: uuid.UUID) -> list[ScorecardCriterion]:
    return list(
        (
            await db.execute(
                select(ScorecardCriterion)
                .where(ScorecardCriterion.scorecard_id == scorecard_id)
                .order_by(
                    ScorecardCriterion.display_order,
                    ScorecardCriterion.name,
                    ScorecardCriterion.id,
                )
            )
        )
        .scalars()
        .all()
    )


async def _card_read(db: AsyncSession, org_id: uuid.UUID, scorecard_id: uuid.UUID) -> ScorecardRead:
    card = await _card(db, org_id, scorecard_id)
    return ScorecardRead(
        id=card.id,
        org_id=card.org_id,
        name=card.name,
        job_id=card.job_id,
        is_platform=card.is_platform,
        criteria=[CriterionRead.model_validate(row) for row in await _criteria(db, card.id)],
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


def _audit(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    event: ActivityEventType,
    entity_id: uuid.UUID,
    *,
    entity_type: str = "scorecard",
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=event.value.replace("_", " ").capitalize() + ".",
        org_id=org_id,
        actor_id=user.id,
        entity_type=entity_type,
        entity_id=entity_id,
    )


async def create(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: ScorecardCreate
) -> ScorecardRead:
    await authorize_cards(db, user, org_id, write=True)
    if payload.job_id is not None:
        # Cross-organization or unknown job id -> 404 (no existence oracle).
        await job_service._job(db, org_id, payload.job_id)
    card = Scorecard(org_id=org_id, name=payload.name, job_id=payload.job_id)
    db.add(card)
    await db.flush()
    for position, item in enumerate(payload.criteria):
        db.add(
            ScorecardCriterion(
                scorecard_id=card.id,
                name=item.name,
                weight=item.weight,
                anchors=item.anchors,
                display_order=position,
            )
        )
    _audit(db, user, org_id, ActivityEventType.scorecard_created, card.id)
    await db.commit()
    return await _card_read(db, org_id, card.id)


async def list_cards(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    q: str | None,
    job_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> ScorecardPage:
    await authorize_cards(db, user, org_id)
    stmt = select(Scorecard).where(Scorecard.org_id == org_id, Scorecard.deleted_at.is_(None))
    if job_id is not None:
        await job_service._job(db, org_id, job_id)
        stmt = stmt.where(Scorecard.job_id == job_id)
    if q and q.strip():
        stmt = stmt.where(
            Scorecard.name.ilike(f"%{job_service._escape_like(q.strip())}%", escape="\\")
        )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = list(
        (
            await db.execute(
                stmt.order_by(Scorecard.created_at.desc(), Scorecard.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    items = [
        ScorecardRead(
            id=row.id,
            org_id=row.org_id,
            name=row.name,
            job_id=row.job_id,
            is_platform=row.is_platform,
            criteria=[],
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]
    if rows:
        # One batched child query for the whole page, never one per card.
        children = (
            await db.execute(
                select(ScorecardCriterion)
                .where(ScorecardCriterion.scorecard_id.in_([row.id for row in rows]))
                .order_by(
                    ScorecardCriterion.display_order,
                    ScorecardCriterion.name,
                    ScorecardCriterion.id,
                )
            )
        ).scalars()
        grouped: dict[uuid.UUID, list[ScorecardCriterion]] = {}
        for child in children:
            grouped.setdefault(child.scorecard_id, []).append(child)
        for item in items:
            item.criteria = [CriterionRead.model_validate(c) for c in grouped.get(item.id, [])]
    return ScorecardPage(
        items=items, total=total, limit=limit, offset=offset, has_more=offset + len(rows) < total
    )


async def get_card(
    db: AsyncSession, user: User, org_id: uuid.UUID, scorecard_id: uuid.UUID
) -> ScorecardRead:
    await authorize_cards(db, user, org_id)
    return await _card_read(db, org_id, scorecard_id)


async def patch_card(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    scorecard_id: uuid.UUID,
    payload: ScorecardUpdate,
) -> ScorecardRead:
    await authorize_cards(db, user, org_id, write=True)
    card = await _card(db, org_id, scorecard_id, lock=True)
    changed = False
    if "name" in payload.model_fields_set and payload.name is not None:
        if card.name != payload.name:
            card.name = payload.name
            changed = True
    if payload.criteria is not None:
        existing = await _criteria(db, card.id)
        existing_by_id = {row.id: row for row in existing}
        for index, item in enumerate(payload.criteria):
            if item.id is not None and item.id not in existing_by_id:
                raise validation_error(
                    "Criterion does not belong to this scorecard.",
                    details=[
                        {
                            "loc": ["body", "criteria", index, "id"],
                            "msg": "Criterion does not belong to this scorecard.",
                            "type": "value_error",
                        }
                    ],
                )
        wanted_ids = {item.id for item in payload.criteria if item.id is not None}
        removed = [row for row in existing if row.id not in wanted_ids]
        if removed:
            scored = (
                await db.execute(
                    select(func.count(ApplicationScore.id)).where(
                        ApplicationScore.criterion_id.in_([row.id for row in removed])
                    )
                )
            ).scalar_one()
            if scored:
                raise conflict(
                    "Criteria that already have scores cannot be removed.",
                    "CRITERION_SCORED",
                )
            for row in removed:
                await db.delete(row)
        for position, item in enumerate(payload.criteria):
            if item.id is not None:
                row = existing_by_id[item.id]
                row.name = item.name
                row.weight = item.weight
                row.anchors = item.anchors
                row.display_order = position
            else:
                db.add(
                    ScorecardCriterion(
                        scorecard_id=card.id,
                        name=item.name,
                        weight=item.weight,
                        anchors=item.anchors,
                        display_order=position,
                    )
                )
        changed = True
    if changed:
        _audit(db, user, org_id, ActivityEventType.scorecard_updated, card.id)
        await db.commit()
    return await _card_read(db, org_id, card.id)


async def delete_card(
    db: AsyncSession, user: User, org_id: uuid.UUID, scorecard_id: uuid.UUID
) -> None:
    """Soft delete: criteria and every score that references them survive."""
    await authorize_cards(db, user, org_id, write=True)
    card = await _card(db, org_id, scorecard_id, lock=True)
    card.deleted_at = datetime.now(UTC)
    _audit(db, user, org_id, ActivityEventType.scorecard_deleted, card.id)
    await db.commit()


def _weighted(averages: dict[uuid.UUID, tuple[float, int]]) -> float | None:
    """Weighted mean of per-criterion averages; None when nothing is scored."""
    if not averages:
        return None
    numerator = sum(value * weight for value, weight in averages.values())
    denominator = sum(weight for _, weight in averages.values())
    if not denominator:
        return None
    return round(numerator / denominator, 2)


async def _scores_read(
    db: AsyncSession, application_id: uuid.UUID, user_id: uuid.UUID
) -> ApplicationScoresRead:
    rows = (
        await db.execute(
            select(ApplicationScore, ScorecardCriterion)
            .join(
                ScorecardCriterion,
                ScorecardCriterion.id == ApplicationScore.criterion_id,
            )
            .where(ApplicationScore.application_id == application_id)
            .order_by(
                ScorecardCriterion.display_order,
                ScorecardCriterion.name,
                ScorecardCriterion.id,
                ApplicationScore.created_at,
                ApplicationScore.id,
            )
        )
    ).all()
    grouped: dict[uuid.UUID, list[tuple[ApplicationScore, ScorecardCriterion]]] = {}
    for score, criterion in rows:
        grouped.setdefault(criterion.id, []).append((score, criterion))
    items: list[CriterionScoresRead] = []
    all_averages: dict[uuid.UUID, tuple[float, int]] = {}
    my_averages: dict[uuid.UUID, tuple[float, int]] = {}
    for criterion_id, entries in grouped.items():
        scores = [
            ScoreEntry(
                interviewer_id=score.interviewer_id,
                score=score.score,
                note=score.note,
                created_at=score.created_at,
                updated_at=score.updated_at,
            )
            for score, _ in entries
        ]
        criterion = entries[0][1]
        mine = next((pair[0] for pair in entries if pair[0].interviewer_id == user_id), None)
        average = round(sum(entry.score for entry in scores) / len(scores), 2)
        all_averages[criterion_id] = (average, criterion.weight)
        if mine is not None:
            my_averages[criterion_id] = (float(mine.score), criterion.weight)
        items.append(
            CriterionScoresRead(
                criterion_id=criterion_id,
                name=criterion.name,
                weight=criterion.weight,
                scores=scores,
                my_score=mine.score if mine is not None else None,
                average=average,
                scored_count=len(scores),
            )
        )
    return ApplicationScoresRead(
        application_id=application_id,
        items=items,
        weighted_total=_weighted(all_averages),
        my_weighted_total=_weighted(my_averages),
    )


async def put_scores(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: ScoresPut,
) -> ApplicationScoresRead:
    """Replace-set of the caller's own scores for one application."""
    _, job, row = await applicant_pipeline_service.scoped(
        db, user, org_id, job_id, application_id, write=True
    )
    applicant_pipeline_service.writable(job, row)
    wanted = [item.criterion_id for item in payload.scores]
    wanted_set = set(wanted)
    criteria: dict[uuid.UUID, ScorecardCriterion] = {}
    if wanted_set:
        found = (
            await db.execute(
                select(ScorecardCriterion)
                .join(Scorecard, Scorecard.id == ScorecardCriterion.scorecard_id)
                .where(
                    ScorecardCriterion.id.in_(wanted_set),
                    Scorecard.org_id == org_id,
                    Scorecard.deleted_at.is_(None),
                )
            )
        ).scalars()
        criteria = {criterion.id: criterion for criterion in found}
    missing = [
        (index, item.criterion_id)
        for index, item in enumerate(payload.scores)
        if item.criterion_id not in criteria
    ]
    if missing:
        # Cross-organization, unknown, or soft-deleted criteria: field-located 422.
        raise validation_error(
            "Criterion must belong to a live scorecard of this organization.",
            details=[
                {
                    "loc": ["body", "scores", index, "criterion_id"],
                    "msg": "Criterion must belong to a live scorecard of this organization.",
                    "type": "value_error",
                }
                for index, _ in missing
            ],
        )
    existing = list(
        (
            await db.execute(
                select(ApplicationScore).where(
                    ApplicationScore.application_id == row.id,
                    ApplicationScore.interviewer_id == user.id,
                )
            )
        )
        .scalars()
        .all()
    )
    existing_by_criterion = {score.criterion_id: score for score in existing}
    for criterion_id in set(existing_by_criterion) - wanted_set:
        await db.delete(existing_by_criterion[criterion_id])
    for item in payload.scores:
        current = existing_by_criterion.get(item.criterion_id)
        if current is not None:
            current.score = item.score
            current.note = item.note
        else:
            db.add(
                ApplicationScore(
                    application_id=row.id,
                    criterion_id=item.criterion_id,
                    interviewer_id=user.id,
                    score=item.score,
                    note=item.note,
                )
            )
    _audit(
        db,
        user,
        org_id,
        ActivityEventType.application_scores_submitted,
        row.id,
        entity_type="application",
    )
    await db.commit()
    return await _scores_read(db, row.id, user.id)


async def get_scores(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
) -> ApplicationScoresRead:
    _, _, row = await applicant_pipeline_service.scoped(db, user, org_id, job_id, application_id)
    return await _scores_read(db, row.id, user.id)


async def compare(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_ids: list[uuid.UUID],
) -> CompareRead:
    member = await authorize_cards(db, user, org_id)
    job = await job_service._job(db, org_id, job_id, include_archived=True)
    # Preserve the caller's order, drop duplicates.
    requested = list(dict.fromkeys(application_ids))
    rows = list(
        (
            await db.execute(
                select(JobApplication).where(
                    JobApplication.id.in_(requested),
                    JobApplication.job_id == job.id,
                    JobApplication.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    by_id = {row.id: row for row in rows}
    ordered: list[JobApplication] = []
    for application_id in requested:
        row = by_id.get(application_id)
        if row is None:
            raise not_found("Application not found.")
        if member.role not in MANAGERS and job.owner_id != user.id and row.assignee_id != user.id:
            raise not_found("Application not found.")
        ordered.append(row)
    score_rows = (
        await db.execute(
            select(ApplicationScore, ScorecardCriterion)
            .join(
                ScorecardCriterion,
                ScorecardCriterion.id == ApplicationScore.criterion_id,
            )
            .where(ApplicationScore.application_id.in_(requested))
            .order_by(
                ScorecardCriterion.display_order,
                ScorecardCriterion.name,
                ScorecardCriterion.id,
            )
        )
    ).all()
    per_application: dict[uuid.UUID, dict[uuid.UUID, list[ApplicationScore]]] = {
        row.id: {} for row in ordered
    }
    criterion_meta: dict[uuid.UUID, ScorecardCriterion] = {}
    for score, criterion in score_rows:
        criterion_meta[criterion.id] = criterion
        per_application[score.application_id].setdefault(criterion.id, []).append(score)
    criteria = [
        CompareCriterion(criterion_id=criterion.id, name=criterion.name, weight=criterion.weight)
        for criterion in sorted(
            criterion_meta.values(),
            key=lambda c: (c.display_order, c.name, str(c.id)),
        )
    ]
    items: list[CompareApplicant] = []
    for row in ordered:
        profile = None if row.is_blind else ProfileSnapshot.model_validate(row.profile_snapshot)
        grouped = per_application[row.id]
        averages: dict[uuid.UUID, tuple[float, int]] = {}
        cells: list[CompareCell] = []
        for criterion_id, scores in grouped.items():
            criterion = criterion_meta[criterion_id]
            average = round(sum(score.score for score in scores) / len(scores), 2)
            averages[criterion_id] = (average, criterion.weight)
            mine = next((score for score in scores if score.interviewer_id == user.id), None)
            cells.append(
                CompareCell(
                    criterion_id=criterion_id,
                    average=average,
                    scored_count=len(scores),
                    my_score=mine.score if mine is not None else None,
                )
            )
        items.append(
            CompareApplicant(
                application_id=row.id,
                stage=row.stage,
                is_blind=row.is_blind,
                label=(
                    f"Candidate {row.id}"
                    if row.is_blind
                    else profile.contact.name
                    if profile
                    else "Candidate"
                ),
                salary_expectation=row.salary_expectation,
                currency=row.currency,
                experience_years=row.profile_snapshot.get("experience_years"),
                headline=None if row.is_blind else profile.headline if profile else None,
                skills=None if row.is_blind else profile.skills if profile else None,
                weighted_total=_weighted(averages),
                scored_count=sum(len(scores) for scores in grouped.values()),
                scores=cells,
            )
        )
    return CompareRead(job_id=job.id, job_title=job.title, criteria=criteria, items=items)
