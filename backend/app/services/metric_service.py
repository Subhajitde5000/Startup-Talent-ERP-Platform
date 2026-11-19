"""Metric service (Step 5e).

Object-level rules (BUILD_PLAN Step 5 security):
- Startup organizations only; wrong-type / suspended / deleted orgs 404 via
  ``organization_service.startup_org_or_404`` (no existence oracle).
- Reads need an ACTIVE membership of any role (viewers read); writes
  additionally require owner/admin/member (viewer 403).
- Every lookup is scoped by ``org_id``: a metric id from another
  organization is 404, never 403 (no existence oracle).
- ``source`` is server-assigned (plan E1/E4): a startup writes
  ``startup_reported`` and nothing else, so verified values cannot be
  forged. A period that already carries a verified source is **not**
  overwritten by a re-report — that is a 409, never a silent downgrade.
- ``value`` is bound to the NUMERIC(18,4) column and returned as a decimal
  string, never a float (AGENTS.md: money is NUMERIC, never float).
- ``period_end`` may not be in the future: a month that has not ended has
  no reported value yet.
- ``growth_mom`` is the only key that may be negative (plan E5): every
  other key is a count or an amount.

Upsert semantics (plan E4): one row per (org, key, period). Re-reporting a
period replaces its value, which is what "upsert a metric value" means;
the update keeps the row's id so links and history stay stable.
"""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import conflict, not_found, rate_limited, validation_error
from app.models.metric import VERIFIED_SOURCES, MetricKey, MetricSource, StartupMetric
from app.models.organization import OrgRole
from app.models.startup import StartupProfile
from app.models.user import User
from app.schemas.metric import (
    MetricHistory,
    MetricLatestRead,
    MetricPage,
    MetricPoint,
    MetricRead,
    MetricUpsert,
)
from app.services import organization_service
from app.services.rate_limiter import rate_limiter

# Viewer role is deliberately excluded from writes (approved permission table).
_WRITE_ROLES = frozenset({OrgRole.owner, OrgRole.admin, OrgRole.member})

# Plan E5: the only key a negative value makes sense for.
_SIGNED_KEYS = frozenset({MetricKey.growth_mom})


def _ref_error(field: str, message: str) -> Exception:  # noqa: ANN401
    """422 carrying a pydantic-style loc so the frontend can map it."""
    return validation_error(
        message,
        details=[{"loc": ["body", field], "msg": message, "type": "value_error"}],
    )


def _as_str(value: Decimal | None) -> str | None:
    """Decimal -> string at the column's scale (plan E1: never a float)."""
    if value is None:
        return None
    return str(value)


def _source_of(row: StartupMetric) -> MetricSource:
    """``source`` is VARCHAR + CHECK (schema.sql names a text column), so the
    driver hands back a plain ``str``; normalise before comparing."""
    source = row.source
    return source if isinstance(source, MetricSource) else MetricSource(source)


def _read(row: StartupMetric) -> MetricRead:
    return MetricRead(
        id=row.id,
        org_id=row.org_id,
        metric_key=row.metric_key,
        value=_as_str(row.value) or "0",
        unit=row.unit,
        currency=row.currency,
        source=row.source,
        period_end=row.period_end,
        created_at=row.created_at,
    )


async def _select_profile(
    db: AsyncSession, org_id: uuid.UUID
) -> StartupProfile | None:
    result = await db.execute(
        select(StartupProfile).where(StartupProfile.org_id == org_id)
    )
    return result.scalar_one_or_none()


async def _ensure_profile(db: AsyncSession, org_id: uuid.UUID) -> StartupProfile:
    """Create the startup profile on demand (5a D10 pattern).

    ``startup_metrics.org_id`` references ``startup_profiles.org_id``, so
    the parent row must exist before the first metric is written. The insert
    sits in a savepoint: a concurrent creator wins the primary key, only
    this savepoint rolls back, and the winner's row is re-read.
    """
    profile = await _select_profile(db, org_id)
    if profile is not None:
        return profile
    try:
        async with db.begin_nested():
            profile = StartupProfile(org_id=org_id)
            db.add(profile)
            await db.flush()
        return profile
    except IntegrityError:
        winner = await _select_profile(db, org_id)
        if winner is None:
            raise
        return winner


async def _enforce_write_limit(user: User, action: str) -> None:
    """Per-actor throttle on metric writes.

    A founder entering 8 metrics for six months is 48 writes, comfortably
    under the limit; a scripted loop is cut off.
    """
    settings = get_settings()
    if not await rate_limiter.check(
        f"metrics:{action}:user:{user.id}",
        settings.METRICS_WRITE_LIMIT,
        settings.METRICS_WRITE_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many metric updates. Please try again later.")


async def _get_metric(
    db: AsyncSession, org_id: uuid.UUID, metric_id: uuid.UUID
) -> StartupMetric:
    """Org-scoped lookup: a foreign metric id is 404 (no oracle)."""
    result = await db.execute(
        select(StartupMetric).where(
            StartupMetric.id == metric_id, StartupMetric.org_id == org_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise not_found("Metric not found.")
    return row


async def upsert_metric(
    db: AsyncSession, user: User, org_id: uuid.UUID, payload: MetricUpsert
) -> MetricRead:
    """Report one value for one (key, period); owner/admin/member only."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    await _enforce_write_limit(user, "upsert")

    # Validation that needs the key or the calendar (field-level 422s).
    if payload.period_end > datetime.now(UTC).date():
        raise _ref_error(
            "period_end", "The period must have ended before it can be reported."
        )
    if payload.value < 0 and payload.metric_key not in _SIGNED_KEYS:
        raise _ref_error("value", f"{payload.metric_key.value} cannot be negative.")

    currency = payload.currency or "INR"
    await _ensure_profile(db, org.id)

    existing = (
        await db.execute(
            select(StartupMetric).where(
                StartupMetric.org_id == org.id,
                StartupMetric.metric_key == payload.metric_key,
                StartupMetric.period_end == payload.period_end,
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        # Plan E4: a verified value is the point of verification — never
        # silently replace it with a startup report.
        current_source = _source_of(existing)
        if current_source in VERIFIED_SOURCES:
            raise conflict(
                f"This period is {current_source.value.replace('_', ' ')} "
                "and cannot be re-reported."
            )
        existing.value = payload.value
        existing.unit = payload.unit
        existing.currency = currency
        # A startup write is always a startup report, whatever came before.
        existing.source = MetricSource.startup_reported
        row = existing
    else:
        row = StartupMetric(
            org_id=org.id,
            metric_key=payload.metric_key,
            value=payload.value,
            unit=payload.unit,
            currency=currency,
            source=MetricSource.startup_reported,
            period_end=payload.period_end,
        )
        db.add(row)

    await db.commit()
    # Same post-commit refresh reason as the other services: the server
    # defaults (id/created_at) must be loaded before serializing.
    await db.refresh(row)
    return _read(row)


async def delete_metric(
    db: AsyncSession, user: User, org_id: uuid.UUID, metric_id: uuid.UUID
) -> None:
    """Remove a mistaken entry (hard delete: schema.sql has no deleted_at)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(
        db, org.id, user, roles=set(_WRITE_ROLES)
    )
    await _enforce_write_limit(user, "delete")
    row = await _get_metric(db, org.id, metric_id)
    await db.delete(row)
    await db.commit()


async def latest(db: AsyncSession, user: User, org_id: uuid.UUID) -> MetricLatestRead:
    """The newest value per key — the card row.

    Plan E2: only keys with data appear; ``missing`` names the rest so the
    UI can render an honest empty state rather than a zero.
    """
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    # Newest row per key: the index (org_id, metric_key, period_end DESC)
    # serves this; DISTINCT ON is PG-only, so rank per key instead.
    ranked = (
        select(
            StartupMetric.id.label("id"),
            func.row_number()
            .over(
                partition_by=StartupMetric.metric_key,
                order_by=(StartupMetric.period_end.desc(), StartupMetric.created_at.desc()),
            )
            .label("rn"),
        )
        .where(StartupMetric.org_id == org.id)
        .subquery()
    )
    rows = (
        (
            await db.execute(
                select(StartupMetric)
                .join(ranked, ranked.c.id == StartupMetric.id)
                .where(ranked.c.rn == 1)
                .order_by(StartupMetric.metric_key)
            )
        )
        .scalars()
        .all()
    )
    present = {row.metric_key for row in rows}
    return MetricLatestRead(
        items=[_read(row) for row in rows],
        missing=[key for key in MetricKey if key not in present],
    )


async def history(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    metric_key: MetricKey,
    *,
    limit: int,
    offset: int,
) -> MetricHistory:
    """One key's values, newest first (the trend/revenue-vs-burn charts)."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    base = select(StartupMetric).where(
        StartupMetric.org_id == org.id, StartupMetric.metric_key == metric_key
    )
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    rows = (
        (
            await db.execute(
                base.order_by(StartupMetric.period_end.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    newest = rows[0] if rows else None
    return MetricHistory(
        metric_key=metric_key,
        unit=newest.unit if newest else None,
        currency=newest.currency if newest else None,
        items=[
            MetricPoint(
                period_end=row.period_end,
                value=_as_str(row.value) or "0",
                source=row.source,
            )
            for row in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


async def list_metrics(
    db: AsyncSession,
    user: User,
    org_id: uuid.UUID,
    *,
    metric_key: MetricKey | None,
    period_from: date | None,
    period_to: date | None,
    limit: int,
    offset: int,
) -> MetricPage:
    """Paginated values across keys, newest period first.

    ``period_from`` / ``period_to`` are inclusive bounds, which is how a
    history range is queried; the per-key endpoint is the chart view.
    """
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    filters = [StartupMetric.org_id == org.id]
    if metric_key is not None:
        filters.append(StartupMetric.metric_key == metric_key)
    if period_from is not None:
        filters.append(StartupMetric.period_end >= period_from)
    if period_to is not None:
        filters.append(StartupMetric.period_end <= period_to)

    total = (
        await db.execute(select(func.count()).select_from(StartupMetric).where(*filters))
    ).scalar_one()
    rows = (
        (
            await db.execute(
                select(StartupMetric)
                .where(*filters)
                .order_by(StartupMetric.period_end.desc(), StartupMetric.metric_key)
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return MetricPage(
        items=[_read(row) for row in rows], total=total, limit=limit, offset=offset
    )
