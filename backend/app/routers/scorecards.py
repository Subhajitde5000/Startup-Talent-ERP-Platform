"""Step 7e only: organization rubrics, own ratings and scoped comparison."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.routers.files import FileRoute
from app.routers.jobs import DB, Actor, _ErrorResponse
from app.schemas.scorecard import (
    ApplicationEvaluation,
    CardCreate,
    CardKind,
    CardPage,
    CardPatch,
    CardRead,
    CardSelect,
    CardSort,
    ComparisonRead,
    RatingsPut,
)
from app.services import scorecard_service as service


class ScorecardRoute(FileRoute):
    max_body_bytes = 64 * 1024
    body_limit_message = "Scorecard metadata exceeds 64 KiB."


router = APIRouter(
    route_class=ScorecardRoute,
    prefix="/organizations/{org_id}",
    tags=["scorecards"],
    responses={
        401: {"model": _ErrorResponse, "description": "Authentication required"},
        403: {
            "model": _ErrorResponse,
            "description": "Hiring role, membership or write permission required",
        },
        404: {
            "model": _ErrorResponse,
            "description": "Resource missing or outside permitted scope",
        },
        409: {
            "model": _ErrorResponse,
            "description": "Scored rubric locked, or pipeline read-only",
        },
        413: {"model": _ErrorResponse, "description": "Metadata exceeds 64 KiB"},
        422: {"model": _ErrorResponse, "description": "Invalid fields or cross-rubric reference"},
        429: {"model": _ErrorResponse, "description": "Hiring actor operation limit exceeded"},
    },
)


@router.post(
    "/scorecards",
    response_model=CardRead,
    status_code=201,
    summary="Create an organization scorecard template",
)
async def create(org_id: uuid.UUID, payload: CardCreate, db: DB, user: Actor) -> CardRead:
    """Owner/admin only; no platform, job, author or lifecycle fields accepted."""
    return await service.create(db, user, org_id, payload)


@router.get("/scorecards", response_model=CardPage, summary="List organization scorecards")
async def list_cards(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    kind: CardKind = "templates",
    job_id: uuid.UUID | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: CardSort = "newest",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CardPage:
    """Eligible non-viewer hiring members. Templates by default; nested criteria are bounded to 20."""
    return await service.list_cards(
        db, user, org_id, kind=kind, job_id=job_id, q=q, sort=sort, limit=limit, offset=offset
    )


@router.get("/scorecards/{card_id}", response_model=CardRead, summary="Read a scoped scorecard")
async def get(org_id: uuid.UUID, card_id: uuid.UUID, db: DB, user: Actor) -> CardRead:
    return await service.get(db, user, org_id, card_id)


@router.patch(
    "/scorecards/{card_id}", response_model=CardRead, summary="Edit an unscored scorecard"
)
async def patch(
    org_id: uuid.UUID, card_id: uuid.UUID, payload: CardPatch, db: DB, user: Actor
) -> CardRead:
    """Owner/admin only. Criteria replacement is atomic; the first score permanently locks a job rubric."""
    return await service.patch(db, user, org_id, card_id, payload)


@router.delete("/scorecards/{card_id}", status_code=204, summary="Archive an unscored scorecard")
async def archive(org_id: uuid.UUID, card_id: uuid.UUID, db: DB, user: Actor) -> None:
    """Owner/admin only. Scored rubrics cannot be archived; template copies remain independent."""
    await service.archive(db, user, org_id, card_id)


@router.get(
    "/jobs/{job_id}/scorecard", response_model=CardRead, summary="Read the selected job rubric"
)
async def get_job_card(org_id: uuid.UUID, job_id: uuid.UUID, db: DB, user: Actor) -> CardRead:
    return await service.get_job_card(db, user, org_id, job_id)


@router.put(
    "/jobs/{job_id}/scorecard",
    response_model=CardRead,
    summary="Copy an organization template into a job rubric",
)
async def select_job_card(
    org_id: uuid.UUID, job_id: uuid.UUID, payload: CardSelect, db: DB, user: Actor
) -> CardRead:
    """Owner/admin only. Same-template retries return the existing copy, not a second rubric.
    Replacing a scored rubric is forbidden even after all reviewers withdraw their ratings.
    """
    return await service.select_job_card(db, user, org_id, job_id, payload.template_id)


@router.get(
    "/jobs/{job_id}/applications/{application_id}/scores",
    response_model=ApplicationEvaluation,
    summary="Read own scores and anonymous numeric aggregates",
)
async def application_scores(
    org_id: uuid.UUID, job_id: uuid.UUID, application_id: uuid.UUID, db: DB, user: Actor
) -> ApplicationEvaluation:
    """Uses existing owned-job/assigned-application scope. Peer notes and scorer IDs are never returned."""
    return await service.application_scores(db, user, org_id, job_id, application_id)


@router.put(
    "/jobs/{job_id}/applications/{application_id}/scores/me",
    response_model=ApplicationEvaluation,
    summary="Replace only my own application ratings",
)
async def put_scores(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: RatingsPut,
    db: DB,
    user: Actor,
) -> ApplicationEvaluation:
    """Each criterion must belong to this job's rubric. Empty scores withdraw only the caller's ratings.
    This does not unlock the rubric, change stages, reveal identity or write panel-private notes.
    """
    return await service.put_scores(db, user, org_id, job_id, application_id, payload)


@router.get(
    "/jobs/{job_id}/compare",
    response_model=ComparisonRead,
    summary="Compare two to five authorized applicants on one rubric",
)
async def compare(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    db: DB,
    user: Actor,
    application_ids: Annotated[list[uuid.UUID], Query(min_length=2, max_length=5)],
) -> ComparisonRead:
    """Every selected application must be in scope. Preserves request order and 7d blind projection.
    Means use observed criteria only and include coverage; no ATS score, ranking or recommendation.
    """
    return await service.compare(db, user, org_id, job_id, application_ids)
