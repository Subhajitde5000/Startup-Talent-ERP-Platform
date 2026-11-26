"""Job alerts / saved searches (Step 7m, job-seeker side).

One alert row per saved search; the structured ``criteria`` is enforced at the
schema layer and stored as jsonb. Delivery is Step 12, so ``last_sent_at`` is
never written here (it stays NULL until a sender runs).

Security: every row is owned by the authenticated seeker — ``user_id`` is
server-controlled and the read/update/delete paths filter by it, so a foreign
``alert_id`` is a 404 (no existence oracle). The caller must be an active,
email-verified job seeker, the same gate as 7c. Partial updates use
``exclude_unset`` so only the fields the client sent are touched.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited
from app.models.job_alert import JobAlert
from app.models.user import User
from app.schemas.job_alert import JobAlertCreate, JobAlertUpdate
from app.services import job_application_service
from app.services.rate_limiter import rate_limiter


async def _rate_limit(user: User, limit: int, window: int, kind: str) -> None:
    if not await rate_limiter.check(f"job_alerts:{kind}:{user.id}", limit, window):
        raise rate_limited("Too many requests. Please slow down.")


require_seeker = job_application_service.require_seeker


async def _row_or_404(db: AsyncSession, user: User, alert_id: uuid.UUID) -> JobAlert:
    row = (
        await db.execute(
            select(JobAlert).where(JobAlert.id == alert_id, JobAlert.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise not_found("Alert not found.")
    return row


def _serialize(row: JobAlert) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "title": row.title,
        "criteria": row.criteria or {},
        "frequency": row.frequency,
        "is_active": row.is_active,
        "last_sent_at": row.last_sent_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


async def create(db: AsyncSession, user: User, payload: JobAlertCreate) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.JOB_ALERTS_WRITE_LIMIT, settings.JOB_ALERTS_WRITE_WINDOW_SECONDS, "write"
    )
    row = JobAlert(
        user_id=user.id,
        title=payload.title,
        criteria=payload.criteria.model_dump(mode="json", exclude_none=True),
        frequency=payload.frequency,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.flush()
    await db.commit()
    await db.refresh(row)
    return _serialize(row)


async def list_(db: AsyncSession, user: User, *, limit: int, offset: int) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.JOB_ALERTS_READ_LIMIT, settings.JOB_ALERTS_READ_WINDOW_SECONDS, "read"
    )
    total = (
        await db.execute(
            select(func.count()).select_from(JobAlert).where(JobAlert.user_id == user.id)
        )
    ).scalar_one()
    rows = (
        (
            await db.execute(
                select(JobAlert)
                .where(JobAlert.user_id == user.id)
                .order_by(JobAlert.created_at.desc(), JobAlert.id)
                .offset(offset)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    items = [_serialize(r) for r in rows]
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


async def get(db: AsyncSession, user: User, alert_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.JOB_ALERTS_READ_LIMIT, settings.JOB_ALERTS_READ_WINDOW_SECONDS, "read"
    )
    return _serialize(await _row_or_404(db, user, alert_id))


async def update(
    db: AsyncSession, user: User, alert_id: uuid.UUID, payload: JobAlertUpdate
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.JOB_ALERTS_WRITE_LIMIT, settings.JOB_ALERTS_WRITE_WINDOW_SECONDS, "write"
    )
    row = await _row_or_404(db, user, alert_id)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        row.title = data["title"]
    if "frequency" in data:
        row.frequency = data["frequency"]
    if "is_active" in data:
        row.is_active = data["is_active"]
    if "criteria" in data and data["criteria"] is not None:
        row.criteria = (
            payload.criteria.model_dump(mode="json", exclude_none=True) if payload.criteria else {}
        )
    await db.flush()
    await db.commit()
    await db.refresh(row)
    return _serialize(row)


async def delete(db: AsyncSession, user: User, alert_id: uuid.UUID) -> None:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.JOB_ALERTS_WRITE_LIMIT, settings.JOB_ALERTS_WRITE_WINDOW_SECONDS, "write"
    )
    row = await _row_or_404(db, user, alert_id)
    await db.delete(row)
    await db.commit()
