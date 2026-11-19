"""Metric router (Step 5e).

Thin routes (AGENTS.md section 3): the actor always comes from the auth
dependency; path params are uuid.UUID / MetricKey so malformed values 422
before any service code runs. Membership, org scoping (IDOR), the
server-assigned ``source`` and the value rules live in metric_service.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.metric import MetricKey
from app.models.user import User
from app.schemas.metric import (
    MetricHistory,
    MetricLatestRead,
    MetricPage,
    MetricRead,
    MetricUpsert,
)
from app.services import metric_service

router = APIRouter(prefix="/organizations", tags=["metrics"])


@router.put(
    "/{org_id}/metrics",
    response_model=MetricRead,
    summary="Report a metric value (upsert)",
)
async def upsert_metric(
    org_id: uuid.UUID,
    payload: MetricUpsert,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MetricRead:
    """Owner/admin/member (viewer 403). One row per (key, period): a second
    report for the same period replaces the value. ``source`` is always
    ``startup_reported``; a verified period is 409, never overwritten."""
    return await metric_service.upsert_metric(db, user, org_id, payload)


@router.get(
    "/{org_id}/metrics/latest",
    response_model=MetricLatestRead,
    summary="Latest value per metric key",
)
async def latest_metrics(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MetricLatestRead:
    """Any active member (viewer included). Keys with no data are listed in
    ``missing`` rather than reported as 0."""
    return await metric_service.latest(db, user, org_id)


@router.get(
    "/{org_id}/metrics/{metric_key}/history",
    response_model=MetricHistory,
    summary="History for one metric key",
)
async def metric_history(
    org_id: uuid.UUID,
    metric_key: MetricKey,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MetricHistory:
    """Newest period first — the trend and revenue-vs-burn charts."""
    return await metric_service.history(
        db, user, org_id, metric_key, limit=limit, offset=offset
    )


@router.get(
    "/{org_id}/metrics",
    response_model=MetricPage,
    summary="List metric values",
)
async def list_metrics(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    metric_key: Annotated[MetricKey | None, Query()] = None,
    period_from: Annotated[date | None, Query()] = None,
    period_to: Annotated[date | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MetricPage:
    """Any active member. ``period_from``/``period_to`` are inclusive."""
    return await metric_service.list_metrics(
        db,
        user,
        org_id,
        metric_key=metric_key,
        period_from=period_from,
        period_to=period_to,
        limit=limit,
        offset=offset,
    )


@router.delete(
    "/{org_id}/metrics/{metric_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a metric value",
)
async def delete_metric(
    org_id: uuid.UUID,
    metric_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Owner/admin/member (viewer 403); a foreign id is 404."""
    await metric_service.delete_metric(db, user, org_id, metric_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
