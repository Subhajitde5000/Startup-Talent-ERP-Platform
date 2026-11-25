"""Step 7e scorecard and compare routes.

Three prefixes, matching how each resource is addressed:

- ``/organizations/{org_id}/scorecards``             template CRUD
- ``.../jobs/{job_id}/applications/{id}/scores``     my scores on one applicant
- ``.../jobs/{job_id}/compare``                      side-by-side matrix

Thin layer per AGENTS.md section 3: parse, call the service, return the
schema. Every authorization decision — including the 404-instead-of-403
rule for foreign ids — lives in ``scorecard_service`` (which reuses the
7d applicant scope helpers).
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.scorecard import (
    ApplicationScoresRead,
    CompareRead,
    ScorecardCreate,
    ScorecardPage,
    ScorecardRead,
    ScorecardUpdate,
    ScoresPut,
)
from app.services import scorecard_service


class ScorecardRoute(FileRoute):
    """Bounded body: up to 30 criteria with anchor lists."""

    max_body_bytes = 64 * 1024
    body_limit_message = "Scorecard metadata exceeds 64 KiB."


_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
    403: {
        "model": _ErrorResponse,
        "description": "Hiring role, membership or action permission required",
    },
    404: {
        "model": _ErrorResponse,
        "description": "Resource unavailable or outside the authorized scope",
    },
    413: {"model": _ErrorResponse, "description": "Metadata exceeds 64 KiB"},
    422: {"model": _ErrorResponse, "description": "Invalid fields or foreign references"},
    429: {"model": _ErrorResponse, "description": "Scorecard or applicant rate limit"},
}

router = APIRouter(
    route_class=ScorecardRoute,
    prefix="/organizations/{org_id}",
    tags=["scorecards"],
    responses=_RESPONSES,
)
scores_router = APIRouter(
    route_class=ScorecardRoute,
    prefix="/organizations/{org_id}/jobs/{job_id}/applications/{application_id}",
    tags=["scorecards"],
    responses={
        **_RESPONSES,
        409: {"model": _ErrorResponse, "description": "Read-only job or terminal application"},
    },
)
compare_router = APIRouter(
    route_class=ScorecardRoute,
    prefix="/organizations/{org_id}/jobs/{job_id}",
    tags=["scorecards"],
    responses=_RESPONSES,
)

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get("/scorecards", response_model=ScorecardPage, summary="List organization scorecards")
async def list_scorecards(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    q: Annotated[str | None, Query(max_length=100)] = None,
    job_id: uuid.UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> ScorecardPage:
    """Owner/admin/member read. Soft-deleted templates are excluded."""
    return await scorecard_service.list_cards(
        db, user, org_id, q=q, job_id=job_id, limit=limit, offset=offset
    )


@router.post(
    "/scorecards",
    response_model=ScorecardRead,
    status_code=201,
    summary="Create a scorecard template with criteria",
)
async def create_scorecard(
    org_id: uuid.UUID, payload: ScorecardCreate, db: DB, user: Actor
) -> ScorecardRead:
    """Owner/admin only. ``display_order`` follows list position;
    ``org_id``/``is_platform`` are server-controlled."""
    return await scorecard_service.create(db, user, org_id, payload)


@router.get("/scorecards/{scorecard_id}", response_model=ScorecardRead, summary="Get one scorecard")
async def get_scorecard(
    org_id: uuid.UUID, scorecard_id: uuid.UUID, db: DB, user: Actor
) -> ScorecardRead:
    return await scorecard_service.get_card(db, user, org_id, scorecard_id)


@router.patch(
    "/scorecards/{scorecard_id}", response_model=ScorecardRead, summary="Edit a scorecard"
)
async def patch_scorecard(
    org_id: uuid.UUID,
    scorecard_id: uuid.UUID,
    payload: ScorecardUpdate,
    db: DB,
    user: Actor,
) -> ScorecardRead:
    """Owner/admin only. ``criteria`` is a replace-set: omitted existing
    criteria are deleted unless they already have scores (409)."""
    return await scorecard_service.patch_card(db, user, org_id, scorecard_id, payload)


@router.delete(
    "/scorecards/{scorecard_id}",
    status_code=204,
    summary="Soft-delete a scorecard (scores are preserved)",
    responses={404: {"model": _ErrorResponse, "description": "Not found or already deleted"}},
)
async def delete_scorecard(
    org_id: uuid.UUID, scorecard_id: uuid.UUID, db: DB, user: Actor
) -> Response:
    await scorecard_service.delete_card(db, user, org_id, scorecard_id)
    return Response(status_code=204)


@scores_router.put(
    "/scores", response_model=ApplicationScoresRead, summary="Replace my scores for an applicant"
)
async def put_scores(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: ScoresPut,
    db: DB,
    user: Actor,
) -> ApplicationScoresRead:
    """Applicant read-scope callers only (owner/admin; member who owns the
    job or is assigned). Replace-set of the caller's OWN rows; an empty
    list clears them. Closed jobs and terminal applications are 409."""
    return await scorecard_service.put_scores(db, user, org_id, job_id, application_id, payload)


@scores_router.get(
    "/scores", response_model=ApplicationScoresRead, summary="Read all scores for an applicant"
)
async def get_scores(
    org_id: uuid.UUID, job_id: uuid.UUID, application_id: uuid.UUID, db: DB, user: Actor
) -> ApplicationScoresRead:
    """Weighted totals are computed server-side from stored rows."""
    return await scorecard_service.get_scores(db, user, org_id, job_id, application_id)


@compare_router.get(
    "/compare",
    response_model=CompareRead,
    summary="Side-by-side compare of 2 to 5 applicants for one job",
)
async def compare_applicants(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    db: DB,
    user: Actor,
    application_ids: Annotated[
        list[uuid.UUID],
        Query(
            min_length=2,
            max_length=5,
            description="Application UUIDs of this job, in display order.",
        ),
    ],
) -> CompareRead:
    """Blind-safe projections only; never returns applicant_id, raw
    snapshots or feedback. ATS percentages and notice periods do not
    exist in the backend and are not invented."""
    return await scorecard_service.compare(db, user, org_id, job_id, application_ids)
