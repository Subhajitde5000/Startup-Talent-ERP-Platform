"""7f HTTP boundary; business policies live in interview_service."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import AwareDatetime

from app.routers.files import FileRoute
from app.routers.jobs import DB, Actor, _ErrorResponse
from app.schemas import hiring_workflow as s
from app.services import interview_service as service


class HiringRoute(FileRoute):
    max_body_bytes = 64 * 1024
    body_limit_message = "Hiring metadata exceeds 64 KiB."


errors: dict = {code: {"model": _ErrorResponse} for code in (401, 403, 404, 409, 413, 422, 429)}
router = APIRouter(
    prefix="/organizations/{org_id}/interviews",
    tags=["interviews"],
    route_class=HiringRoute,
    responses=errors,
)
candidate_router = APIRouter(
    prefix="/interviews",
    tags=["applicant interviews"],
    route_class=HiringRoute,
    responses=errors,
)
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.post(
    "",
    response_model=s.InterviewRead,
    status_code=201,
    summary="Schedule an interview with an idempotency key",
)
async def create(
    org_id: uuid.UUID, payload: s.InterviewCreate, db: DB, user: Actor
) -> s.InterviewRead:
    return await service.create(db, user, org_id, payload)


@router.get("", response_model=s.InterviewPage, summary="List authorized interviews")
async def listing(
    org_id: uuid.UUID,
    db: DB,
    user: Actor,
    status: s.InterviewStatus | None = None,
    view: s.InterviewView | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    scheduled_from: AwareDatetime | None = None,
    scheduled_until: AwareDatetime | None = None,
    job_id: uuid.UUID | None = None,
    application_id: uuid.UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> s.InterviewPage:
    return await service.listing(
        db,
        user,
        org_id,
        status=status,
        view=view,
        q=q,
        scheduled_from=scheduled_from,
        scheduled_until=scheduled_until,
        job_id=job_id,
        application_id=application_id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{id_}", response_model=s.InterviewRead, summary="Read an interview within pipeline scope"
)
async def get(org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor) -> s.InterviewRead:
    return await service.get(db, user, id_, org_id)


@router.patch("/{id_}", response_model=s.InterviewRead, summary="Reschedule and reset attendance")
async def patch(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.InterviewPatch, db: DB, user: Actor
) -> s.InterviewRead:
    return await service.patch(db, user, org_id, id_, payload)


@router.put(
    "/{id_}/participants",
    response_model=s.InterviewRead,
    summary="Replace the panel of a pending interview",
)
async def participants(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.ParticipantsPut, db: DB, user: Actor
) -> s.InterviewRead:
    return await service.participants(db, user, org_id, id_, payload)


@router.post(
    "/{id_}/transitions",
    response_model=s.InterviewRead,
    summary="Cancel, complete, or record a no-show",
)
async def transition(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.InterviewTransition, db: DB, user: Actor
) -> s.InterviewRead:
    return await service.transition(db, user, org_id, id_, payload)


@router.put(
    "/{id_}/attendance/me",
    response_model=s.InterviewRead,
    summary="Respond as the authenticated panel participant",
)
async def attendance(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.AttendancePut, db: DB, user: Actor
) -> s.InterviewRead:
    return await service.attendance(db, user, id_, payload, org_id)


@router.get(
    "/{id_}/feedback", response_model=s.FeedbackPage, summary="Read only my private feedback"
)
async def feedback(
    org_id: uuid.UUID, id_: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> s.FeedbackRead | s.FeedbackPage:
    return await service.feedback(db, user, org_id, id_, limit=limit, offset=offset)


@router.put(
    "/{id_}/feedback/me", response_model=s.FeedbackRead, summary="Save my feedback after completion"
)
async def save_feedback(
    org_id: uuid.UUID, id_: uuid.UUID, payload: s.FeedbackPut, db: DB, user: Actor
) -> s.FeedbackRead | s.FeedbackPage:
    return await service.feedback(db, user, org_id, id_, payload=payload)


@candidate_router.get(
    "", response_model=s.InterviewPage, summary="List my interviews without panel/private feedback"
)
async def own_list(
    db: DB,
    user: Actor,
    status: s.InterviewStatus | None = None,
    view: s.InterviewView | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    scheduled_from: AwareDatetime | None = None,
    scheduled_until: AwareDatetime | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> s.InterviewPage:
    return await service.listing(
        db,
        user,
        status=status,
        view=view,
        q=q,
        scheduled_from=scheduled_from,
        scheduled_until=scheduled_until,
        limit=limit,
        offset=offset,
    )


@candidate_router.get("/{id_}", response_model=s.InterviewRead, summary="Read my interview")
async def own_get(id_: uuid.UUID, db: DB, user: Actor) -> s.InterviewRead:
    return await service.get(db, user, id_)


@candidate_router.put(
    "/{id_}/attendance/me",
    response_model=s.InterviewRead,
    summary="Respond as the applicant participant",
)
async def own_attendance(
    id_: uuid.UUID, payload: s.AttendancePut, db: DB, user: Actor
) -> s.InterviewRead:
    return await service.attendance(db, user, id_, payload)
