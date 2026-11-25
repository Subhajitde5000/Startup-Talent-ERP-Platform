"""Step 7f interview routes.

Three prefixes:

- ``/organizations/{org_id}/jobs/{job_id}/applications/{id}/interviews``
  schedule inside one application (7d-style nested path).
- ``/organizations/{org_id}/interviews``               list/detail/lifecycle/feedback
- ``/interviews/{id}/respond``                          either side answers
- ``/applications/{id}/interviews``                     candidate's own view

Thin layer per AGENTS.md section 3: parse, call the service, return the
schema. Authorization — including participant-only feedback and the
candidate's own-application rule — lives in ``interview_service``.
"""

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.interview import (
    CandidateInterviewPage,
    CandidateInterviewRead,
    FeedbackPut,
    FeedbackRead,
    InterviewCancel,
    InterviewCreate,
    InterviewDetailRead,
    InterviewPage,
    InterviewStatus,
    InterviewUpdate,
    ParticipantRead,
    RespondPut,
)
from app.services import interview_service


class InterviewRoute(FileRoute):
    """Interview metadata is small; keep the shared bounded-body guard."""

    max_body_bytes = 32 * 1024
    body_limit_message = "Interview metadata exceeds 32 KiB."


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
    409: {
        "model": _ErrorResponse,
        "description": "Invalid interview state, read-only job or panelist conflict",
    },
    413: {"model": _ErrorResponse, "description": "Metadata exceeds 32 KiB"},
    422: {"model": _ErrorResponse, "description": "Invalid fields or panelist references"},
    429: {"model": _ErrorResponse, "description": "Interview rate limit"},
}

application_router = APIRouter(
    route_class=InterviewRoute,
    prefix="/organizations/{org_id}/jobs/{job_id}/applications/{application_id}",
    tags=["interviews"],
    responses=_RESPONSES,
)
org_router = APIRouter(
    route_class=InterviewRoute,
    prefix="/organizations/{org_id}",
    tags=["interviews"],
    responses=_RESPONSES,
)
flat_router = APIRouter(
    route_class=InterviewRoute,
    prefix="/interviews",
    tags=["interviews"],
    responses=_RESPONSES,
)
candidate_router = APIRouter(
    route_class=InterviewRoute,
    prefix="/applications/{application_id}",
    tags=["interviews"],
    responses=_RESPONSES,
)

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@application_router.post(
    "/interviews",
    response_model=InterviewDetailRead,
    status_code=201,
    summary="Schedule an interview for an applicant",
)
async def schedule_interview(
    org_id: uuid.UUID,
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    payload: InterviewCreate,
    db: DB,
    user: Actor,
) -> InterviewDetailRead:
    """Owner/admin/job-owner only; closed jobs and terminal applications
    are 409. Panelists must be eligible hiring members (422). Scheduling
    never changes the application stage (plan D8)."""
    return await interview_service.schedule(db, user, org_id, job_id, application_id, payload)


@org_router.get(
    "/interviews",
    response_model=InterviewPage,
    summary="List this organization's interviews",
)
async def list_interviews(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    window: Annotated[
        Literal["upcoming", "past"] | None,
        Query(description="upcoming = live and not started; past = everything else."),
    ] = None,
    status: InterviewStatus | None = None,
    needs_feedback: Annotated[
        bool, Query(description="Completed interviews where I owe feedback.")
    ] = False,
    job_id: uuid.UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> InterviewPage:
    """Owner/admin see every org interview; ordinary members see their own
    jobs, assigned applications and interviews they sit on."""
    return await interview_service.list_interviews(
        db,
        user,
        org_id,
        window=window,
        status=status,
        needs_feedback=needs_feedback,
        job_id=job_id,
        limit=limit,
        offset=offset,
    )


@org_router.get(
    "/interviews/{interview_id}",
    response_model=InterviewDetailRead,
    summary="Get one interview with participants and feedback",
)
async def get_interview(
    org_id: uuid.UUID, interview_id: uuid.UUID, db: DB, user: Actor
) -> InterviewDetailRead:
    """In-scope members and any participant; outsiders get 404."""
    return await interview_service.detail(db, user, org_id, interview_id)


@org_router.patch(
    "/interviews/{interview_id}",
    response_model=InterviewDetailRead,
    summary="Reschedule or edit a scheduled interview",
)
async def patch_interview(
    org_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: InterviewUpdate,
    db: DB,
    user: Actor,
) -> InterviewDetailRead:
    """Owner/admin/job-owner only. Moving the slot resets every
    participant's response (plan D4) and re-checks panelist conflicts."""
    return await interview_service.update(db, user, org_id, interview_id, payload)


@org_router.post(
    "/interviews/{interview_id}/cancel",
    response_model=InterviewDetailRead,
    summary="Cancel an interview",
)
async def cancel_interview(
    org_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: InterviewCancel,
    db: DB,
    user: Actor,
) -> InterviewDetailRead:
    return await interview_service.cancel(db, user, org_id, interview_id, payload)


@org_router.post(
    "/interviews/{interview_id}/complete",
    response_model=InterviewDetailRead,
    summary="Mark an interview completed (enables feedback)",
)
async def complete_interview(
    org_id: uuid.UUID, interview_id: uuid.UUID, db: DB, user: Actor
) -> InterviewDetailRead:
    return await interview_service.complete(db, user, org_id, interview_id)


@org_router.put(
    "/interviews/{interview_id}/feedback",
    response_model=FeedbackRead,
    summary="Submit or replace my panel feedback",
)
async def put_feedback(
    org_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: FeedbackPut,
    db: DB,
    user: Actor,
) -> FeedbackRead:
    """Interviewer participants only, after completion; upserts the
    caller's single row. Candidates can never call this (403)."""
    return await interview_service.put_feedback(db, user, org_id, interview_id, payload)


@flat_router.put(
    "/{interview_id}/respond",
    response_model=ParticipantRead,
    summary="Accept, decline or mark tentative (either side)",
)
async def respond(
    interview_id: uuid.UUID, payload: RespondPut, db: DB, user: Actor
) -> ParticipantRead:
    """Only actual participants; everyone else gets 404."""
    return await interview_service.respond(db, user, interview_id, payload)


@candidate_router.get(
    "/interviews",
    response_model=CandidateInterviewPage,
    summary="List interviews for my application",
)
async def candidate_interviews(
    application_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> CandidateInterviewPage:
    """Own application only (404 otherwise). Never exposes feedback,
    scores or internal cancellation reasons."""
    return await interview_service.candidate_list(
        db, user, application_id, limit=limit, offset=offset
    )


@candidate_router.get(
    "/interviews/{interview_id}",
    response_model=CandidateInterviewRead,
    summary="Get one of my application's interviews",
)
async def candidate_interview(
    application_id: uuid.UUID, interview_id: uuid.UUID, db: DB, user: Actor
) -> CandidateInterviewRead:
    return await interview_service.candidate_detail(db, user, application_id, interview_id)
