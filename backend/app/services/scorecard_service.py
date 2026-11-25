"""7e business rules: tenant scope, permanent rubric locks, private ratings, exact aggregates."""

import uuid
from collections import defaultdict
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import conflict, forbidden, not_found, validation_error
from app.models.activity import ActivityEventType
from app.models.job import Job
from app.models.job_application import JobApplication
from app.models.scorecard import ApplicationScore, Scorecard, ScorecardCriterion
from app.models.user import User
from app.schemas.scorecard import (
    ApplicationEvaluation,
    CardCreate,
    CardKind,
    CardPage,
    CardPatch,
    CardRead,
    CardSort,
    ComparisonItem,
    ComparisonRead,
    CriterionAggregate,
    CriterionInput,
    CriterionRead,
    EvaluationRead,
    OwnRatingRead,
    RatingsPut,
)
from app.services import activity_service, job_service
from app.services import applicant_pipeline_service as pipeline


def audit(
    db: AsyncSession,
    user: User,
    card: Scorecard,
    event: ActivityEventType,
    application_id: uuid.UUID | None = None,
) -> None:
    activity_service.record(
        db,
        event_type=event,
        summary=event.value.replace("_", " ").capitalize() + ".",
        org_id=card.org_id,
        actor_id=user.id,
        entity_type="application" if application_id else "scorecard",
        entity_id=application_id or card.id,
    )


async def authorize(
    db: AsyncSession, user: User, org_id: uuid.UUID, *, write: bool = False, manager: bool = False
) -> None:
    # Reuse 7d's compatible hiring roles, verified account, active membership and
    # per-actor read/write limits. There is no second authorization/limiter system.
    membership = await pipeline.authorize(db, user, org_id, write=write)
    if manager and membership.role not in pipeline.MANAGERS:
        raise forbidden("Only owners and admins can manage scorecards.")


async def card_or_404(
    db: AsyncSession,
    org_id: uuid.UUID,
    card_id: uuid.UUID,
    *,
    lock: bool = False,
    include_deleted: bool = False,
) -> Scorecard:
    stmt = select(Scorecard).where(Scorecard.id == card_id, Scorecard.org_id == org_id)
    if not include_deleted:
        stmt = stmt.where(Scorecard.deleted_at.is_(None))
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise not_found("Scorecard not found.")
    return row


async def writable_card(
    db: AsyncSession, org_id: uuid.UUID, card_id: uuid.UUID, *, include_deleted: bool = False
) -> Scorecard:
    row = await card_or_404(db, org_id, card_id, include_deleted=include_deleted)
    # Match the existing job -> application -> rubric lock order. Template-only
    # edits lock just their own card; copies have independent criteria.
    if row.job_id:
        job = await job_service._job(db, org_id, row.job_id, lock=True, include_archived=True)
        pipeline.writable(job)
    return await card_or_404(db, org_id, card_id, lock=True, include_deleted=include_deleted)


async def criteria_for(db: AsyncSession, card_id: uuid.UUID) -> list[ScorecardCriterion]:
    return list(
        (
            await db.execute(
                select(ScorecardCriterion)
                .where(ScorecardCriterion.scorecard_id == card_id)
                .order_by(ScorecardCriterion.display_order)
            )
        ).scalars()
    )


async def read_cards(db: AsyncSession, cards: list[Scorecard]) -> list[CardRead]:
    grouped: dict[uuid.UUID, list[CriterionRead]] = defaultdict(list)
    if cards:
        rows = (
            await db.execute(
                select(ScorecardCriterion)
                .where(ScorecardCriterion.scorecard_id.in_([card.id for card in cards]))
                .order_by(ScorecardCriterion.display_order)
            )
        ).scalars()
        for row in rows:
            grouped[row.scorecard_id].append(CriterionRead.model_validate(row))
    return [
        CardRead(
            id=card.id,
            org_id=card.org_id,
            job_id=card.job_id,
            name=card.name,
            is_platform=card.is_platform,
            source_scorecard_id=card.source_scorecard_id,
            locked_at=card.locked_at,
            created_at=card.created_at,
            updated_at=card.updated_at,
            criteria=grouped[card.id],
        )
        for card in cards
    ]


async def add_criteria(db: AsyncSession, card: Scorecard, criteria: list[CriterionInput]) -> None:
    db.add_all(
        [
            ScorecardCriterion(
                scorecard_id=card.id,
                name=item.name,
                weight=item.weight,
                anchors=item.anchors,
                display_order=index,
            )
            for index, item in enumerate(criteria)
        ]
    )
    await db.flush()


async def create(db: AsyncSession, user: User, org_id: uuid.UUID, payload: CardCreate) -> CardRead:
    await authorize(db, user, org_id, write=True, manager=True)
    row = Scorecard(org_id=org_id, name=payload.name)
    db.add(row)
    await db.flush()
    await add_criteria(db, row, payload.criteria)
    audit(db, user, row, ActivityEventType.scorecard_created)
    await db.commit()
    await db.refresh(row)
    return (await read_cards(db, [row]))[0]


async def get(db: AsyncSession, user: User, org_id: uuid.UUID, card_id: uuid.UUID) -> CardRead:
    await authorize(db, user, org_id)
    return (await read_cards(db, [await card_or_404(db, org_id, card_id)]))[0]


async def list_cards(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    kind: CardKind,
    job_id: uuid.UUID | None,
    q: str | None,
    sort: CardSort,
    limit: int,
    offset: int,
) -> CardPage:
    await authorize(db, user, org_id)
    stmt = select(Scorecard).where(Scorecard.org_id == org_id, Scorecard.deleted_at.is_(None))
    if job_id:
        await job_service._job(db, org_id, job_id, include_archived=True)
        stmt = stmt.where(Scorecard.job_id == job_id)
    if kind == "templates":
        stmt = stmt.where(Scorecard.job_id.is_(None))
    elif kind == "jobs":
        stmt = stmt.where(Scorecard.job_id.is_not(None))
    if q and q.strip():
        stmt = stmt.where(
            Scorecard.name.ilike(f"%{job_service._escape_like(q.strip())}%", escape="\\")
        )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    ordering = {
        "newest": (Scorecard.created_at.desc(), Scorecard.id.desc()),
        "oldest": (Scorecard.created_at.asc(), Scorecard.id.asc()),
        "name": (func.lower(Scorecard.name), Scorecard.id),
        "updated": (Scorecard.updated_at.desc(), Scorecard.id.desc()),
    }[sort]
    cards = list((await db.execute(stmt.order_by(*ordering).limit(limit).offset(offset))).scalars())
    return CardPage(
        items=await read_cards(db, cards),
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(cards) < total,
    )


def require_unlocked(card: Scorecard) -> None:
    if card.locked_at is not None:
        raise conflict(
            "This rubric is permanently locked because it has been scored.", "SCORECARD_LOCKED"
        )


async def patch(
    db: AsyncSession, user: User, org_id: uuid.UUID, card_id: uuid.UUID, payload: CardPatch
) -> CardRead:
    await authorize(db, user, org_id, write=True, manager=True)
    card = await writable_card(db, org_id, card_id)
    require_unlocked(card)
    if payload.name is not None:
        card.name = payload.name
    if payload.criteria is not None:
        await db.execute(
            delete(ScorecardCriterion).where(ScorecardCriterion.scorecard_id == card.id)
        )
        await add_criteria(db, card, payload.criteria)
    card.updated_at = datetime.now(UTC)
    audit(db, user, card, ActivityEventType.scorecard_updated)
    await db.commit()
    await db.refresh(card)
    return (await read_cards(db, [card]))[0]


async def archive(db: AsyncSession, user: User, org_id: uuid.UUID, card_id: uuid.UUID) -> None:
    await authorize(db, user, org_id, write=True, manager=True)
    card = await writable_card(db, org_id, card_id, include_deleted=True)
    if card.deleted_at is not None:
        return
    require_unlocked(card)
    card.deleted_at = card.updated_at = datetime.now(UTC)
    audit(db, user, card, ActivityEventType.scorecard_archived)
    await db.commit()


async def job_card(db: AsyncSession, job: Job, *, lock: bool = False) -> Scorecard | None:
    stmt = select(Scorecard).where(
        Scorecard.org_id == job.org_id, Scorecard.job_id == job.id, Scorecard.deleted_at.is_(None)
    )
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    return (await db.execute(stmt)).scalar_one_or_none()


async def require_job_card(db: AsyncSession, job: Job, *, lock: bool = False) -> Scorecard:
    card = await job_card(db, job, lock=lock)
    if card is None:
        raise not_found("No scorecard is selected for this job.", "JOB_SCORECARD_MISSING")
    return card


async def get_job_card(
    db: AsyncSession, user: User, org_id: uuid.UUID, job_id: uuid.UUID
) -> CardRead:
    await authorize(db, user, org_id)
    job = await job_service._job(db, org_id, job_id, include_archived=True)
    return (await read_cards(db, [await require_job_card(db, job)]))[0]


async def select_job_card(
    db: AsyncSession, user: User, org_id: uuid.UUID, job_id: uuid.UUID, template_id: uuid.UUID
) -> CardRead:
    await authorize(db, user, org_id, write=True, manager=True)
    job = await job_service._job(db, org_id, job_id, lock=True, include_archived=True)
    pipeline.writable(job)
    template = await card_or_404(db, org_id, template_id, lock=True)
    if template.job_id is not None:
        raise not_found("Scorecard template not found.")
    existing = await job_card(db, job, lock=True)
    if existing and existing.source_scorecard_id == template.id:
        return (await read_cards(db, [existing]))[0]
    if existing:
        require_unlocked(existing)
        existing.deleted_at = existing.updated_at = datetime.now(UTC)
        await db.flush()
    card = Scorecard(
        org_id=org_id, job_id=job.id, name=template.name, source_scorecard_id=template.id
    )
    db.add(card)
    await db.flush()
    source = await criteria_for(db, template.id)
    await add_criteria(
        db, card, [CriterionInput(name=c.name, weight=c.weight, anchors=c.anchors) for c in source]
    )
    audit(db, user, card, ActivityEventType.job_scorecard_selected)
    await db.commit()
    await db.refresh(card)
    return (await read_cards(db, [card]))[0]


async def evaluations(
    db: AsyncSession, user: User, card: CardRead, application_ids: list[uuid.UUID]
) -> list[EvaluationRead]:
    ids = [criterion.id for criterion in card.criteria]
    own: dict[uuid.UUID, list[OwnRatingRead]] = defaultdict(list)
    # Query only the caller's text. Peer notes/author identities are never loaded.
    rows = (
        await db.execute(
            select(ApplicationScore).where(
                ApplicationScore.application_id.in_(application_ids),
                ApplicationScore.criterion_id.in_(ids),
                ApplicationScore.interviewer_id == user.id,
                ApplicationScore.deleted_at.is_(None),
            )
        )
    ).scalars()
    own_by_criterion: dict[tuple[uuid.UUID, uuid.UUID], OwnRatingRead] = {}
    for row in rows:
        own_by_criterion[(row.application_id, row.criterion_id)] = OwnRatingRead(
            id=row.id,
            criterion_id=row.criterion_id,
            score=row.score,
            note=row.note,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
    sums = (
        await db.execute(
            select(
                ApplicationScore.application_id,
                ApplicationScore.criterion_id,
                func.sum(ApplicationScore.score),
                func.count(),
            )
            .where(
                ApplicationScore.application_id.in_(application_ids),
                ApplicationScore.criterion_id.in_(ids),
                ApplicationScore.deleted_at.is_(None),
            )
            .group_by(ApplicationScore.application_id, ApplicationScore.criterion_id)
        )
    ).all()
    stats = {
        (app_id, criterion_id): (int(total), int(count))
        for app_id, criterion_id, total, count in sums
    }
    output = []
    for app_id in application_ids:
        aggregates = []
        numerator, denominator, rated = Decimal(0), 0, 0
        for criterion in card.criteria:
            if own_rating := own_by_criterion.get((app_id, criterion.id)):
                own[app_id].append(own_rating)
            total, count = stats.get((app_id, criterion.id), (0, 0))
            mean = Decimal(total) / count if count else None
            aggregates.append(
                CriterionAggregate(
                    criterion_id=criterion.id,
                    rating_count=count,
                    mean=rounded(mean) if mean is not None else None,
                )
            )
            if mean is not None:
                numerator += mean * criterion.weight
                denominator += criterion.weight
                rated += 1
        output.append(
            EvaluationRead(
                application_id=app_id,
                scorecard_id=card.id,
                own_scores=own[app_id],
                aggregates=aggregates,
                weighted_mean=rounded(numerator / denominator) if denominator else None,
                rated_criteria=rated,
                total_criteria=len(card.criteria),
                coverage_pct=rounded(Decimal(rated * 100) / len(card.criteria)),
            )
        )
    return output


def rounded(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


async def application_scores(
    db: AsyncSession, user: User, org_id: uuid.UUID, job_id: uuid.UUID, application_id: uuid.UUID
) -> ApplicationEvaluation:
    _, job, _ = await pipeline.scoped(db, user, org_id, job_id, application_id)
    card = (await read_cards(db, [await require_job_card(db, job)]))[0]
    return ApplicationEvaluation(
        scorecard=card, evaluation=(await evaluations(db, user, card, [application_id]))[0]
    )


async def put_scores(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: RatingsPut,
) -> ApplicationEvaluation:
    _, job, application = await pipeline.scoped(
        db, user, org_id, job_id, application_id, write=True
    )
    pipeline.writable(job, application)
    card = await require_job_card(db, job, lock=True)
    criteria = await criteria_for(db, card.id)
    if not {item.criterion_id for item in payload.scores}.issubset({item.id for item in criteria}):
        raise validation_error(
            "Every criterion must belong to this job's scorecard.",
            details=[
                {
                    "loc": ["body", "scores"],
                    "msg": "Criterion outside this job's rubric.",
                    "type": "value_error",
                }
            ],
        )
    existing = list(
        (
            await db.execute(
                select(ApplicationScore).where(
                    ApplicationScore.application_id == application.id,
                    ApplicationScore.interviewer_id == user.id,
                )
            )
        ).scalars()
    )
    by_id = {row.criterion_id: row for row in existing}
    incoming = {item.criterion_id: item for item in payload.scores}
    now = datetime.now(UTC)
    changed = False
    for previous in existing:
        if previous.criterion_id not in incoming and previous.deleted_at is None:
            previous.deleted_at = previous.updated_at = now
            changed = True
    for item in payload.scores:
        row = by_id.get(item.criterion_id)
        if row is None:
            db.add(
                ApplicationScore(
                    application_id=application.id,
                    criterion_id=item.criterion_id,
                    interviewer_id=user.id,
                    score=item.score,
                    note=item.note,
                )
            )
            changed = True
        elif row.deleted_at is not None or row.score != item.score or row.note != item.note:
            row.score, row.note, row.deleted_at, row.updated_at = item.score, item.note, None, now
            changed = True
    if payload.scores and card.locked_at is None:
        card.locked_at = card.updated_at = now
    if changed:
        audit(db, user, card, ActivityEventType.application_scores_updated, application.id)
    await db.commit()
    await db.refresh(card)
    read = (await read_cards(db, [card]))[0]
    return ApplicationEvaluation(
        scorecard=read, evaluation=(await evaluations(db, user, read, [application.id]))[0]
    )


async def compare(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_ids: list[uuid.UUID],
) -> ComparisonRead:
    member = await pipeline.authorize(db, user, org_id)
    if len(set(application_ids)) != len(application_ids):
        raise validation_error("Select distinct applications.")
    job = await job_service._job(db, org_id, job_id, include_archived=True)
    stmt = select(JobApplication).where(
        JobApplication.id.in_(application_ids),
        JobApplication.job_id == job.id,
        JobApplication.deleted_at.is_(None),
    )
    if member.role not in pipeline.MANAGERS and job.owner_id != user.id:
        stmt = stmt.where(JobApplication.assignee_id == user.id)
    rows = list((await db.execute(stmt)).scalars())
    if len(rows) != len(application_ids):
        raise not_found("One or more applications are unavailable.")
    by_id = {row.id: row for row in rows}
    rows = [by_id[id_] for id_ in application_ids]
    card = (await read_cards(db, [await require_job_card(db, job)]))[0]
    applicants = await pipeline.projections(db, rows, await pipeline.review_context(db, job))
    aggregate = await evaluations(db, user, card, application_ids)
    return ComparisonRead(
        scorecard=card,
        items=[
            ComparisonItem(applicant=applicant, evaluation=evaluation)
            for applicant, evaluation in zip(applicants, aggregate, strict=True)
        ],
    )
