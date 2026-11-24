"""Step 7d employer/startup review routes. No frontend or interview/offer workflow."""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.applicant_pipeline import (
    ApplicantPage,
    ApplicantRead,
    NoteCreate,
    NotePage,
    NoteRead,
    PipelinePatch,
    PipelineSort,
    ReviewSettingsPatch,
    ReviewSettingsRead,
)
from app.schemas.file import FileDownloadRead
from app.schemas.job import JobAction
from app.schemas.job_application import ApplicationStage, StageEventPage
from app.services import applicant_pipeline_service as service
from app.services.storage_service import Storage, get_storage


class PipelineRoute(FileRoute):
    max_body_bytes = 32 * 1024
    body_limit_message = "Applicant metadata exceeds 32 KiB."


router = APIRouter(
    route_class=PipelineRoute,
    prefix="/organizations/{org_id}/jobs/{job_id}",
    tags=["applicant-pipeline"],
    responses={
        401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
        403: {
            "model": _ErrorResponse,
            "description": "Hiring role, membership or action permission required",
        },
        404: {
            "model": _ErrorResponse,
            "description": "Resource unavailable or outside the authorized scope",
        },
        409: {
            "model": _ErrorResponse,
            "description": "Stale stage, terminal application, read-only job or locked setting",
        },
        413: {"model": _ErrorResponse, "description": "Metadata exceeds 32 KiB"},
        422: {"model": _ErrorResponse, "description": "Invalid fields or assignee reference"},
        429: {"model": _ErrorResponse, "description": "Applicant or file-download rate limit"},
    },
)
DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
Source = Literal["platform", "referral", "marketplace", "outreach", "agency", "other"]
_EMPTY = JobAction()


@router.get(
    "/applications", response_model=ApplicantPage, summary="List applicants within my hiring scope"
)
async def applicants(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    db: DB,
    user: Actor,
    stage: ApplicationStage | None = None,
    source: Source | None = None,
    assignee_id: uuid.UUID | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: PipelineSort = "newest",
    limit: Limit = 20,
    offset: Offset = 0,
) -> ApplicantPage:
    """Owners/admins see the job's applications. Members see owned-job/assigned applications.

    Stage counts respect scope and all filters except stage. Identity searches exclude all
    blind applications. Closed/archived jobs remain readable; no candidate IDs are returned.
    """
    return await service.list_applicants(
        db,
        user,
        org_id,
        job_id,
        stage=stage,
        source=source,
        assignee_id=assignee_id,
        q=q,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/applications/{application_id}",
    response_model=ApplicantRead,
    summary="Read a scoped applicant with server-side blind projection",
)
async def detail(
    org_id: uuid.UUID, job_id: uuid.UUID, application_id: uuid.UUID, db: DB, user: Actor
) -> ApplicantRead:
    """Submitted materials only, never the live candidate profile. Blind mode suppresses
    contact, links, profile text, cover note, free-text answers and resume access.
    """
    return await service.detail(db, user, org_id, job_id, application_id)


@router.patch(
    "/applications/{application_id}",
    response_model=ApplicantRead,
    summary="Atomically move, reject or assign an applicant",
)
async def patch(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: PipelinePatch,
    db: DB,
    user: Actor,
) -> ApplicantRead:
    """Owner/admin or job owner for stages; owner/admin only for assignment. Stage changes
    require expected_stage. No offers/hires, reopening terminal applications, or messages.
    """
    return await service.patch(db, user, org_id, job_id, application_id, payload)


@router.get(
    "/applications/{application_id}/stage-events",
    response_model=StageEventPage,
    summary="Read paginated applicant-safe stage history",
)
async def history(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    db: DB,
    user: Actor,
    limit: Limit = 20,
    offset: Offset = 0,
) -> StageEventPage:
    return await service.history(db, user, org_id, job_id, application_id, limit, offset)


@router.get(
    "/applications/{application_id}/notes",
    response_model=NotePage,
    summary="List only my private applicant notes",
)
async def notes(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    db: DB,
    user: Actor,
    limit: Limit = 20,
    offset: Offset = 0,
) -> NotePage:
    """Even owners/admins cannot read other authors' notes. Candidate APIs never expose them."""
    return await service.notes(db, user, org_id, job_id, application_id, limit, offset)


@router.post(
    "/applications/{application_id}/notes",
    response_model=NoteRead,
    status_code=201,
    summary="Create an author-only private note",
)
async def create_note(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: NoteCreate,
    db: DB,
    user: Actor,
) -> NoteRead:
    return await service.create_note(db, user, org_id, job_id, application_id, payload)


@router.delete(
    "/applications/{application_id}/notes/{note_id}",
    status_code=204,
    summary="Soft-delete my private note",
)
async def delete_note(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    note_id: uuid.UUID,
    db: DB,
    user: Actor,
) -> None:
    """Repeated deletion is a no-op while the pipeline remains writable."""
    await service.delete_note(db, user, org_id, job_id, application_id, note_id)


@router.patch(
    "/review-settings",
    response_model=ReviewSettingsRead,
    summary="Configure blind review before the first application",
)
async def review_settings(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    payload: ReviewSettingsPatch,
    db: DB,
    user: Actor,
) -> ReviewSettingsRead:
    """Owner/admin only. All application records, including deleted ones, lock the setting.
    An identical setting retry is safe; no retroactive unblinding is allowed.
    """
    return await service.review_settings(db, user, org_id, job_id, payload)


@router.post(
    "/applications/{application_id}/resume-download",
    response_model=FileDownloadRead,
    summary="Request an audited short-lived applicant resume URL",
)
async def resume_download(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    db: DB,
    user: Actor,
    storage: Annotated[Storage, Depends(get_storage)],
    payload: JobAction = _EMPTY,
) -> FileDownloadRead:
    """Only the attached, ready/clean personal resume; denied during blind review.
    This does not grant generic access to a candidate's files or profile.
    """
    return await service.resume_download(db, user, org_id, job_id, application_id, storage)
