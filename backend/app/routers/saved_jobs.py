"""Step 7m saved jobs (job seeker).

Flat, seeker-owned routes: the caller comes from the token, never the path, so
there is no org-IDOR surface. Bookmark a job, list them with a job projection,
check one, edit its private note, or unsave. ``user_id`` and ``created_at`` are
server-controlled and the schemas forbid extra fields, so a mass-assignment
attempt is a 422. Saving references a global job id — a non-existent or
soft-deleted job is a 404, never a dangling row.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.saved_job import SavedJobCreate, SavedJobPage, SavedJobRead, SavedJobUpdate
from app.services import saved_job_service

router = APIRouter(
    route_class=FileRoute,
    tags=["saved-jobs"],
    responses={
        401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
        403: {
            "model": _ErrorResponse,
            "description": "Job-seeker role and active account required",
        },
        404: {"model": _ErrorResponse, "description": "Job not found or not saved"},
        409: {"model": _ErrorResponse, "description": "Already saved"},
        422: {"model": _ErrorResponse, "description": "Invalid fields or extra fields"},
        429: {"model": _ErrorResponse, "description": "Saved-jobs rate limit exceeded"},
    },
)

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.post(
    "/saved-jobs",
    response_model=SavedJobRead,
    status_code=201,
    summary="Save a job",
)
async def save_job(payload: SavedJobCreate, db: DB, user: Actor) -> dict:
    return await saved_job_service.save(db, user, payload.job_id, payload.note)


@router.get(
    "/saved-jobs",
    response_model=SavedJobPage,
    summary="List my saved jobs",
)
async def list_saved_jobs(db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0) -> dict:
    return await saved_job_service.list_(db, user, limit=limit, offset=offset)


@router.get(
    "/saved-jobs/{job_id}",
    response_model=SavedJobRead,
    summary="Check whether a job is saved",
)
async def get_saved_job(job_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await saved_job_service.get(db, user, job_id)


@router.patch(
    "/saved-jobs/{job_id}",
    response_model=SavedJobRead,
    summary="Update the private note",
)
async def update_saved_note(
    job_id: uuid.UUID, payload: SavedJobUpdate, db: DB, user: Actor
) -> dict:
    return await saved_job_service.update_note(db, user, job_id, payload.note)


@router.delete(
    "/saved-jobs/{job_id}",
    status_code=204,
    summary="Unsave a job",
)
async def unsave_job(job_id: uuid.UUID, db: DB, user: Actor) -> None:
    await saved_job_service.unsave(db, user, job_id)
