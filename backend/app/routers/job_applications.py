"""Step 7c self-service only; organization pipeline is deliberately not exposed."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.jobs import JobRoute
from app.schemas.job import JobAction
from app.schemas.job_application import (
    ApplicationContext,
    ApplicationCreate,
    ApplicationPage,
    ApplicationRead,
    ApplicationStage,
    StageEventPage,
)
from app.services import job_application_service as service


class ApplicationRoute(JobRoute):
    max_body_bytes = 64 * 1024
    body_limit_message = "Application metadata exceeds 64 KiB."


router = APIRouter(
    route_class=ApplicationRoute,
    tags=["job-applications"],
    responses={
        401: {"description": "Invalid authentication"},
        403: {"description": "Verified active job-seeker role required"},
        404: {"description": "Not found or not owned"},
        409: {"description": "Duplicate application, deadline, or invalid state"},
        413: {"description": "Application metadata exceeds 64 KiB"},
        422: {"description": "Invalid fields, references, consent or screening answers"},
        429: {"description": "Application rate limit"},
    },
)
DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
_EMPTY = JobAction()


@router.get(
    "/jobs/{job_id}/application-context",
    response_model=ApplicationContext,
    summary="Prepare my application without sharing it",
)
async def application_context(job_id: uuid.UUID, db: DB, user: Actor) -> ApplicationContext:
    return await service.context(db, user, job_id)


@router.post(
    "/jobs/{job_id}/applications",
    response_model=ApplicationRead,
    status_code=201,
    responses={
        200: {"model": ApplicationRead, "description": "Identical already-committed submission"}
    },
    summary="Submit my application",
)
async def submit(
    job_id: uuid.UUID, payload: ApplicationCreate, response: Response, db: DB, user: Actor
) -> ApplicationRead:
    result, created = await service.submit(db, user, job_id, payload)
    response.status_code = 201 if created else 200
    return result


@router.get(
    "/applications", response_model=ApplicationPage, summary="List only my submitted applications"
)
async def list_applications(
    db: DB,
    user: Actor,
    stage: ApplicationStage | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> ApplicationPage:
    return await service.list_own(db, user, stage, limit, offset, q)


@router.get(
    "/applications/{application_id}",
    response_model=ApplicationRead,
    summary="Read my submitted materials and current stage",
)
async def application_detail(application_id: uuid.UUID, db: DB, user: Actor) -> ApplicationRead:
    return ApplicationRead.model_validate(await service.own(db, user, application_id))


@router.get(
    "/applications/{application_id}/stage-events",
    response_model=StageEventPage,
    summary="Read my applicant-safe stage history",
)
async def history(
    application_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> StageEventPage:
    return await service.history(db, user, application_id, limit, offset)


@router.post(
    "/applications/{application_id}/withdraw",
    response_model=ApplicationRead,
    summary="Withdraw my application idempotently",
)
async def withdraw(
    application_id: uuid.UUID, db: DB, user: Actor, payload: JobAction = _EMPTY
) -> ApplicationRead:
    return await service.withdraw(db, user, application_id)
