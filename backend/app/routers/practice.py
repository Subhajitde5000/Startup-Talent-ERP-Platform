"""Step 7p/7q practice interview & scoring router (job seeker)."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.routers.files import FileRoute
from app.routers.jobs import _ErrorResponse
from app.schemas.practice import (
    PracticeDifficulty,
    PracticeDrillPage,
    PracticeDrillRead,
    PracticeReportRead,
    PracticeRubricRead,
    PracticeScoreRequest,
    PracticeSessionCreate,
    PracticeSessionPage,
    PracticeSessionRead,
    PracticeSessionStatus,
    PracticeSummaryRead,
    PracticeTurnCreate,
    PracticeTurnResponse,
)
from app.services import practice_service

router = APIRouter(
    route_class=FileRoute,
    tags=["practice"],
    responses={
        401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
        403: {
            "model": _ErrorResponse,
            "description": "Job-seeker role and verified active account required",
        },
        404: {"model": _ErrorResponse, "description": "Drill or practice session not found"},
        422: {"model": _ErrorResponse, "description": "Invalid fields or extra fields"},
        429: {"model": _ErrorResponse, "description": "Rate limit exceeded"},
    },
)

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get(
    "/practice/drills",
    response_model=PracticeDrillPage,
    summary="List practice drills",
)
async def list_drills(
    db: DB,
    user: Actor,
    category: Annotated[str | None, Query(max_length=120)] = None,
    difficulty: PracticeDifficulty | None = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    limit: Limit = 20,
    offset: Offset = 0,
) -> dict:
    return await practice_service.list_drills(
        db, user, category=category, difficulty=difficulty, q=q, limit=limit, offset=offset
    )


@router.get(
    "/practice/drills/{drill_id}",
    response_model=PracticeDrillRead,
    summary="Get a practice drill",
)
async def get_drill(drill_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await practice_service.get_drill(db, user, drill_id)


@router.get(
    "/practice/rubric",
    response_model=PracticeRubricRead,
    summary="Get the interview scoring rubric",
)
async def get_rubric(db: DB, user: Actor) -> dict:
    return await practice_service.get_rubric(db, user)


@router.post(
    "/practice/sessions",
    response_model=PracticeSessionRead,
    status_code=201,
    summary="Create a practice interview session",
)
async def create_session(payload: PracticeSessionCreate, db: DB, user: Actor) -> dict:
    return await practice_service.create_session(db, user, payload)


@router.get(
    "/practice/sessions",
    response_model=PracticeSessionPage,
    summary="List my practice sessions",
)
async def list_sessions(
    db: DB,
    user: Actor,
    status: PracticeSessionStatus | None = None,
    sort: Literal["created_at", "score"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    limit: Limit = 20,
    offset: Offset = 0,
) -> dict:
    return await practice_service.list_sessions(
        db, user, status=status, sort=sort, order=order, limit=limit, offset=offset
    )


@router.get(
    "/practice/sessions/summary",
    response_model=PracticeSummaryRead,
    summary="Get practice studio KPI summary",
)
async def get_session_summary(db: DB, user: Actor) -> dict:
    return await practice_service.summary(db, user)


@router.get(
    "/practice/sessions/{session_id}",
    response_model=PracticeSessionRead,
    summary="Get a practice session with transcript turns",
)
async def get_session(session_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await practice_service.get_session(db, user, session_id)


@router.post(
    "/practice/sessions/{session_id}/start",
    response_model=PracticeSessionRead,
    summary="Start a practice session",
)
async def start_session(session_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await practice_service.start_session(db, user, session_id)


@router.post(
    "/practice/sessions/{session_id}/turns",
    response_model=PracticeTurnResponse,
    status_code=201,
    summary="Submit a candidate answer and receive the next AI interviewer turn",
)
async def submit_turn(
    session_id: uuid.UUID, payload: PracticeTurnCreate, db: DB, user: Actor
) -> dict:
    return await practice_service.submit_turn(db, user, session_id, payload)


@router.delete(
    "/practice/sessions/{session_id}",
    status_code=204,
    response_class=Response,
    summary="Soft-delete a practice session",
)
async def delete_session(session_id: uuid.UUID, db: DB, user: Actor) -> Response:
    await practice_service.delete_session(db, user, session_id)
    return Response(status_code=204)


@router.post(
    "/practice/sessions/{session_id}/score",
    response_model=PracticeReportRead,
    summary="Score a practice session against the rubric via AI",
)
async def score_session(
    session_id: uuid.UUID,
    db: DB,
    user: Actor,
    payload: PracticeScoreRequest | None = None,
) -> dict:
    return await practice_service.score_session(
        db, user, session_id, duration_sec=payload.duration_sec if payload else None
    )


@router.get(
    "/practice/sessions/{session_id}/report",
    response_model=PracticeReportRead,
    summary="Get the evaluation report for a completed practice session",
)
async def get_report(session_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await practice_service.get_report(db, user, session_id)
