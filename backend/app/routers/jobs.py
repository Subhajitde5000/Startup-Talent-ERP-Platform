"""Step 7a management API. No marketplace/search or applicant endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.job import EmploymentType, JobStatus, WorkMode
from app.models.organization import Department
from app.models.user import User
from app.routers.files import FileRoute
from app.schemas.job import JobAction, JobCreate, JobPage, JobRead, JobSort, JobSummary, JobUpdate
from app.services import job_service


class _ErrorDetail(BaseModel):
    code: str
    message: str
    details: object | None = None


class _ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    error: _ErrorDetail


class JobRoute(FileRoute):
    """Reuse the bounded streaming guard, with room for four Unicode text sections."""

    max_body_bytes = 256 * 1024
    body_limit_message = "Job metadata exceeds 256 KiB."


router = APIRouter(
    route_class=JobRoute,
    prefix="/organizations/{org_id}/jobs",
    tags=["jobs"],
    responses={
        413: {"model": _ErrorResponse, "description": "Job metadata exceeds 256 KiB"},
        401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
        403: {
            "model": _ErrorResponse,
            "description": "Inactive membership or insufficient organization role",
        },
        404: {
            "model": _ErrorResponse,
            "description": "Organization/job unavailable or outside this organization",
        },
        409: {"model": _ErrorResponse, "description": "Invalid job lifecycle transition"},
        422: {
            "model": _ErrorResponse,
            "description": "Invalid input, reference or incomplete publishable job",
        },
        429: {"model": _ErrorResponse, "description": "Job mutation rate limit exceeded"},
    },
)
DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
_EMPTY_ACTION = JobAction()


@router.post("", response_model=JobRead, status_code=201, summary="Create a draft job")
async def create_job(org_id: uuid.UUID, payload: JobCreate, db: DB, user: Actor) -> JobRead:
    """Owner/admin of an active employer or startup organization. Status is server-controlled."""
    return await job_service.create(db, user, org_id, payload)


@router.get("", response_model=JobPage, summary="List organization jobs")
async def list_jobs(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    status: JobStatus | None = None,
    department: Department | None = None,
    owner_id: uuid.UUID | None = None,
    location: Annotated[str | None, Query(max_length=200)] = None,
    work_mode: WorkMode | None = None,
    employment_type: EmploymentType | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: JobSort = "created_at",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JobPage:
    """Any active member, including viewers. Archives excluded; no candidate data."""
    return await job_service.list_jobs(
        db,
        user,
        org_id,
        status=status,
        department=department,
        owner_id=owner_id,
        location=location,
        work_mode=work_mode,
        employment_type=employment_type,
        q=q,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get("/summary", response_model=JobSummary, summary="Get organization job counts")
async def job_summary(org_id: uuid.UUID, db: DB, user: Actor) -> JobSummary:
    """Any active member; only live job totals and counts by status, not hiring analytics."""
    return await job_service.summary(db, user, org_id)


@router.get("/{job_id}", response_model=JobRead, summary="Get an organization job")
async def get_job(org_id: uuid.UUID, job_id: uuid.UUID, db: DB, user: Actor) -> JobRead:
    """Any active member. This is an internal management read, not a public/share-link read."""
    return await job_service.get(db, user, org_id, job_id)


@router.patch(
    "/{job_id}", response_model=JobRead, summary="Edit job content and nested skills/benefits"
)
async def update_job(
    org_id: uuid.UUID, job_id: uuid.UUID, payload: JobUpdate, db: DB, user: Actor
) -> JobRead:
    """Owner/admin. Omitted collections remain unchanged; supplied collections replace atomically.

    Nullable fields can be cleared. Lifecycle fields cannot be written here.
    """
    return await job_service.update(db, user, org_id, job_id, payload)


@router.post("/{job_id}/publish", response_model=JobRead, summary="Publish or resume a job")
async def publish_job(
    org_id: uuid.UUID, job_id: uuid.UUID, db: DB, user: Actor, payload: JobAction = _EMPTY_ACTION
) -> JobRead:
    """Owner/admin. Draft/paused to open, retaining first posted_at. Active organization required;
    verification is deferred to Step 15d. Repeated publish of an open job is a no-op.
    """
    return await job_service.transition(db, user, org_id, job_id, "publish")


@router.post("/{job_id}/pause", response_model=JobRead, summary="Pause an open job")
async def pause_job(
    org_id: uuid.UUID, job_id: uuid.UUID, db: DB, user: Actor, payload: JobAction = _EMPTY_ACTION
) -> JobRead:
    """Owner/admin. Repeated pause of a paused job is a no-op."""
    return await job_service.transition(db, user, org_id, job_id, "pause")


@router.post("/{job_id}/close", response_model=JobRead, summary="Close an open or paused job")
async def close_job(
    org_id: uuid.UUID, job_id: uuid.UUID, db: DB, user: Actor, payload: JobAction = _EMPTY_ACTION
) -> JobRead:
    """Owner/admin. Closed is terminal; repeated close is a no-op."""
    return await job_service.transition(db, user, org_id, job_id, "close")


@router.post("/{job_id}/archive", response_model=JobRead, summary="Archive a draft or closed job")
async def archive_job(
    org_id: uuid.UUID, job_id: uuid.UUID, db: DB, user: Actor, payload: JobAction = _EMPTY_ACTION
) -> JobRead:
    """Owner/admin. Soft deletion retains children/history; subsequent reads/actions return 404."""
    return await job_service.transition(db, user, org_id, job_id, "archive")
