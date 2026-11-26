"""Step 7m job alerts / saved searches (job seeker).

Flat, seeker-owned routes: the caller comes from the token, so every row is
scoped to the authenticated user and a foreign ``alert_id`` is a 404 (no
existence oracle). Create, list, read, partially update (``exclude_unset``) or
delete an alert. Delivery is Step 12 — ``last_sent_at`` is returned but never
written here.
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
from app.schemas.job_alert import JobAlertCreate, JobAlertPage, JobAlertRead, JobAlertUpdate
from app.services import job_alert_service

router = APIRouter(
    route_class=FileRoute,
    tags=["job-alerts"],
    responses={
        401: {"model": _ErrorResponse, "description": "Missing or invalid authentication"},
        403: {
            "model": _ErrorResponse,
            "description": "Job-seeker role and active account required",
        },
        404: {"model": _ErrorResponse, "description": "Alert not found or not owned"},
        422: {"model": _ErrorResponse, "description": "Invalid fields, references or extra fields"},
        429: {"model": _ErrorResponse, "description": "Job-alerts rate limit exceeded"},
    },
)

DB = Annotated[AsyncSession, Depends(get_db)]
Actor = Annotated[User, Depends(get_current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.post(
    "/job-alerts",
    response_model=JobAlertRead,
    status_code=201,
    summary="Create a job alert",
)
async def create_alert(payload: JobAlertCreate, db: DB, user: Actor) -> dict:
    return await job_alert_service.create(db, user, payload)


@router.get(
    "/job-alerts",
    response_model=JobAlertPage,
    summary="List my job alerts",
)
async def list_alerts(db: DB, user: Actor, limit: Limit = 20, offset: Offset = 0) -> dict:
    return await job_alert_service.list_(db, user, limit=limit, offset=offset)


@router.get(
    "/job-alerts/{alert_id}",
    response_model=JobAlertRead,
    summary="Read one alert",
)
async def get_alert(alert_id: uuid.UUID, db: DB, user: Actor) -> dict:
    return await job_alert_service.get(db, user, alert_id)


@router.patch(
    "/job-alerts/{alert_id}",
    response_model=JobAlertRead,
    summary="Update an alert",
)
async def update_alert(alert_id: uuid.UUID, payload: JobAlertUpdate, db: DB, user: Actor) -> dict:
    return await job_alert_service.update(db, user, alert_id, payload)


@router.delete(
    "/job-alerts/{alert_id}",
    status_code=204,
    summary="Delete an alert",
)
async def delete_alert(alert_id: uuid.UUID, db: DB, user: Actor) -> None:
    await job_alert_service.delete(db, user, alert_id)
