"""Step 7n/7o resume builder, ATS check, and AI tailoring router (job seeker).

Every route is strictly scoped to the authenticated, email-verified job seeker.
Foreign or soft-deleted resumes always return 404 (no existence oracle).
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.ats_run import AtsRunCreate, AtsRunPage, AtsRunRead, TailorRequest
from app.schemas.resume import (
    ResumeCreate,
    ResumeEducationReplace,
    ResumeExperiencesReplace,
    ResumeExportRead,
    ResumePage,
    ResumeRead,
    ResumeSkillsReplace,
    ResumeSummaryRead,
    ResumeUpdate,
)
from app.services import ai_tailor_service, ats_service, resume_service

router = APIRouter(
    route_class=FileRoute,
    tags=["resumes"],
    responses={
        401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
        403: {
            "model": _ErrorResponse,
            "description": "Job-seeker role and verified active account required",
        },
        404: {"model": _ErrorResponse, "description": "Resume, run, or job not found"},
        422: {"model": _ErrorResponse, "description": "Invalid fields or extra fields"},
        429: {"model": _ErrorResponse, "description": "Rate limit exceeded"},
    },
)

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.post(
    "/resumes",
    response_model=ResumeRead,
    status_code=201,
    summary="Create a resume",
)
async def create_resume(payload: ResumeCreate, db: DB, user: Actor) -> dict:
    return await resume_service.create(db, user, payload)


@router.get(
    "/resumes",
    response_model=ResumePage,
    summary="List my resumes",
)
async def list_resumes(
    db: DB,
    user: Actor,
    q: Annotated[str | None, Query(max_length=200)] = None,
    sort: Literal["updated_at", "created_at"] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
    limit: Limit = 20,
    offset: Offset = 0,
) -> dict:
    return await resume_service.list_(
        db, user, q=q, sort=sort, order=order, limit=limit, offset=offset
    )


@router.get(
    "/resumes/summary",
    response_model=ResumeSummaryRead,
    summary="Get resume studio KPI summary",
)
async def get_resume_summary(db: DB, user: Actor) -> dict:
    return await resume_service.summary(db, user)


@router.get(
    "/resumes/{resume_id}",
    response_model=ResumeRead,
    summary="Get a resume with sections",
)
async def get_resume(resume_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await resume_service.get(db, user, resume_id)


@router.patch(
    "/resumes/{resume_id}",
    response_model=ResumeRead,
    summary="Update resume metadata or summary",
)
async def update_resume(
    resume_id: uuid.UUID, payload: ResumeUpdate, db: DB, user: Actor
) -> dict:
    return await resume_service.update_resume(db, user, resume_id, payload)


@router.delete(
    "/resumes/{resume_id}",
    status_code=204,
    summary="Soft-delete a resume",
)
async def delete_resume(resume_id: uuid.UUID, db: DB, user: Actor) -> None:
    await resume_service.delete_resume(db, user, resume_id)


@router.post(
    "/resumes/{resume_id}/duplicate",
    response_model=ResumeRead,
    status_code=201,
    summary="Duplicate a resume and all its sections",
)
async def duplicate_resume(resume_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await resume_service.duplicate(db, user, resume_id)


@router.put(
    "/resumes/{resume_id}/experiences",
    response_model=ResumeRead,
    summary="Replace ordered work experiences",
)
async def replace_resume_experiences(
    resume_id: uuid.UUID, payload: ResumeExperiencesReplace, db: DB, user: Actor
) -> dict:
    return await resume_service.replace_experiences(db, user, resume_id, payload.items)


@router.put(
    "/resumes/{resume_id}/education",
    response_model=ResumeRead,
    summary="Replace ordered education entries",
)
async def replace_resume_education(
    resume_id: uuid.UUID, payload: ResumeEducationReplace, db: DB, user: Actor
) -> dict:
    return await resume_service.replace_education(db, user, resume_id, payload.items)


@router.put(
    "/resumes/{resume_id}/skills",
    response_model=ResumeRead,
    summary="Replace resume skills",
)
async def replace_resume_skills(
    resume_id: uuid.UUID, payload: ResumeSkillsReplace, db: DB, user: Actor
) -> dict:
    return await resume_service.replace_skills(db, user, resume_id, payload.skill_ids)


@router.post(
    "/resumes/{resume_id}/set-default",
    response_model=ResumeRead,
    summary="Set resume as primary",
)
async def set_default_resume(resume_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await resume_service.set_default(db, user, resume_id)


@router.get(
    "/resumes/{resume_id}/export",
    response_model=ResumeExportRead,
    summary="Export structured resume JSON",
)
async def export_resume(resume_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await resume_service.export_json(db, user, resume_id)


@router.post(
    "/resumes/{resume_id}/ats-runs",
    response_model=AtsRunRead,
    status_code=201,
    summary="Run rule-based ATS compatibility check",
)
async def create_ats_run(
    resume_id: uuid.UUID, payload: AtsRunCreate, db: DB, user: Actor
) -> dict:
    return await ats_service.create_ats_run(db, user, resume_id, payload)


@router.get(
    "/resumes/{resume_id}/ats-runs",
    response_model=AtsRunPage,
    summary="List ATS and tailoring runs for a resume",
)
async def list_ats_runs(
    resume_id: uuid.UUID, db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0
) -> dict:
    return await ats_service.list_runs(db, user, resume_id, limit=limit, offset=offset)


@router.get(
    "/resumes/{resume_id}/ats-runs/{run_id}",
    response_model=AtsRunRead,
    summary="Get a single ATS or tailoring run",
)
async def get_ats_run(
    resume_id: uuid.UUID, run_id: uuid.UUID, db: DB, user: Actor
) -> dict:
    return await ats_service.get_run(db, user, resume_id, run_id)


@router.post(
    "/resumes/{resume_id}/tailor",
    response_model=AtsRunRead,
    status_code=201,
    summary="Generate AI tailoring suggestions (LangGraph + Groq)",
    responses={
        502: {"model": _ErrorResponse, "description": "AI provider error"},
        503: {"model": _ErrorResponse, "description": "AI tailoring not configured"},
    },
)
async def tailor_resume(
    resume_id: uuid.UUID, payload: TailorRequest, db: DB, user: Actor
) -> dict:
    return await ai_tailor_service.tailor_resume(db, user, resume_id, payload)
