"""Business-tab analytics service (Step 5k).

Read-only. It never writes a metric row: 5e already owns entering values,
so this module only reads the newest reported value per key and derives the
figures the page cannot ask a founder to type.

Derivation rules (5k plan K3, approved):

============ ==========================================================
``ltv_cac``          LTV ÷ CAC, both reported
``payback_months``   CAC ÷ monthly gross profit per customer, where
                     monthly gross profit per customer = ARPC × gross
                     margin ÷ 100
``net_burn``         burn − MRR (negative means cash-positive)
``arpc``             MRR ÷ customers
``funnel_won_rate``  won ÷ lead, from the funnel counts
============ ==========================================================

Every one of them returns ``None`` when an input is missing or would
divide by zero, and the key is then listed in ``missing``. A calculated
figure is never stored and never accepted from a client; it carries
``source = calculated`` conceptually but lives outside ``startup_metrics``
so a change to a reported input can never leave a stale derived row behind.
Values are decimal strings throughout — money never touches a float.

No new rate limiter: this is a read, and the only write path it touches
(5e's metric upsert) already throttles per actor.
"""

import uuid
from decimal import Decimal, InvalidOperation, localcontext

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.metric import (
    FUNNEL_KEYS,
    MetricKey,
    MetricSource,
    StartupMetric,
)
from app.models.user import User
from app.schemas.business import (
    BusinessAnalytics,
    BusinessCompleteness,
    BusinessKpi,
    CalculatedValue,
    FunnelStep,
    RetentionBlock,
    SourceUsage,
)
from app.services import organization_service

# The keys the Business tab's KPI cards and unit-economics block read.
_KPI_KEYS: tuple[MetricKey, ...] = (
    MetricKey.mrr,
    MetricKey.growth_mom,
    MetricKey.burn,
    MetricKey.runway_months,
    MetricKey.customers,
    MetricKey.churn_rate,
    MetricKey.cac,
    MetricKey.ltv,
    MetricKey.nrr,
    MetricKey.arpc,
    MetricKey.gross_margin,
    MetricKey.activation_rate,
    MetricKey.nps,
    MetricKey.support_response_hours,
    MetricKey.weekly_active_users,
)

# Unit economics the tab renders, in display order.
_UNIT_KEYS: tuple[str, ...] = ("ltv_cac", "payback_months", "net_burn")

# Funnel step labels, top-down. ``step`` conversions compare each count to
# the one above it; ``total`` compares to the first.
_FUNNEL_LABELS: dict[MetricKey, str] = {
    MetricKey.funnel_lead: "Lead",
    MetricKey.funnel_contacted: "Contacted",
    MetricKey.funnel_demo: "Demo",
    MetricKey.funnel_proposal: "Proposal",
    MetricKey.funnel_won: "Won",
}


def _q2(value: Decimal) -> Decimal:
    """Quantize a derived ratio to 4dp with a generous precision context.

    The column is (18,4); a ratio can exceed that on division, so the
    context is widened locally and the result is rounded HERE rather than
    being sent to the database (derived values are never stored).
    """
    with localcontext() as ctx:
        ctx.prec = 40
        return value.quantize(Decimal("0.0001"))


def _s(value: Decimal | None) -> str | None:
    """Decimal -> plain string (no exponent, no float)."""
    if value is None:
        return None
    try:
        return format(_q2(value).normalize(), "f")
    except InvalidOperation:  # pragma: no cover - defensive
        return None


def _pct(numerator: Decimal, denominator: Decimal) -> str | None:
    """Percentage as a decimal string, or None when it is undefined."""
    if denominator == 0:
        return None
    return _s(numerator / denominator * Decimal(100))


async def _latest_rows(
    db: AsyncSession, org_id: uuid.UUID
) -> dict[MetricKey, StartupMetric]:
    """Newest row per key — the same rank-per-key shape 5e's ``latest`` uses.

    One query for every key, not one query per key: the Business tab asks
    for fifteen metrics and N+1 here would be fifteen round trips.
    """
    ranked = (
        select(
            StartupMetric.id.label("id"),
            func.row_number()
            .over(
                partition_by=StartupMetric.metric_key,
                order_by=(
                    StartupMetric.period_end.desc(),
                    StartupMetric.created_at.desc(),
                ),
            )
            .label("rn"),
        )
        .where(StartupMetric.org_id == org_id)
        .subquery()
    )
    rows = (
        (
            await db.execute(
                select(StartupMetric)
                .join(ranked, and_(ranked.c.id == StartupMetric.id, ranked.c.rn == 1))
                .where(StartupMetric.org_id == org_id)
            )
        )
        .scalars()
        .all()
    )
    # ``metric_key`` is VARCHAR + CHECK (schema.sql names a text column), so
    # the driver hands back a plain ``str``. Normalise to the enum: the whole
    # module keys off MetricKey, and a mixed dict would silently miss rows.
    return {_key_of(row): row for row in rows}


def _key_of(row: StartupMetric) -> MetricKey:
    """``metric_key`` as the enum, whatever the driver returned."""
    key = row.metric_key
    return key if isinstance(key, MetricKey) else MetricKey(key)


def _kpi(row: StartupMetric) -> BusinessKpi:
    return BusinessKpi(
        key=_key_of(row),
        value=str(row.value),
        unit=row.unit,
        currency=row.currency,
        source=row.source,
        period_end=row.period_end,
    )


def _derive_unit_economics(
    latest: dict[MetricKey, StartupMetric], missing: list[str]
) -> list[CalculatedValue]:
    """Every derivable unit-economics figure, or a name in ``missing``."""

    def value_of(key: MetricKey) -> Decimal | None:
        row = latest.get(key)
        return None if row is None else Decimal(row.value)

    out: list[CalculatedValue] = []

    cac, ltv = value_of(MetricKey.cac), value_of(MetricKey.ltv)
    if cac is not None and ltv is not None and cac > 0:
        out.append(
            CalculatedValue(
                key="ltv_cac",
                value=_s(ltv / cac) or "0",
                unit="ratio",
                inputs=[MetricKey.ltv, MetricKey.cac],
            )
        )
    else:
        missing.append("ltv_cac")

    arpc, margin = value_of(MetricKey.arpc), value_of(MetricKey.gross_margin)
    if cac is not None and arpc is not None and margin is not None:
        monthly_gross = arpc * margin / Decimal(100)
        if monthly_gross > 0:
            out.append(
                CalculatedValue(
                    key="payback_months",
                    value=_s(cac / monthly_gross) or "0",
                    unit="months",
                    inputs=[MetricKey.cac, MetricKey.arpc, MetricKey.gross_margin],
                )
            )
        else:
            missing.append("payback_months")
    else:
        missing.append("payback_months")

    burn, mrr = value_of(MetricKey.burn), value_of(MetricKey.mrr)
    if burn is not None and mrr is not None:
        out.append(
            CalculatedValue(
                key="net_burn",
                value=_s(burn - mrr) or "0",
                unit="currency",
                inputs=[MetricKey.burn, MetricKey.mrr],
            )
        )
    else:
        missing.append("net_burn")

    return out


def _derive_funnel(
    latest: dict[MetricKey, StartupMetric], missing: list[str]
) -> list[FunnelStep]:
    """The five funnel bars with step and total conversion.

    A step with no reported count is ``count=None`` and contributes no
    conversion — the page shows the stage as unreported rather than zero,
    because a zero would read as "nobody reached this stage".
    """
    counts: list[Decimal | None] = []
    for key in FUNNEL_KEYS:
        row = latest.get(key)
        counts.append(None if row is None else Decimal(row.value))
        if row is None:
            missing.append(key.value)

    first = next((c for c in counts if c is not None), None)
    steps: list[FunnelStep] = []
    for index, key in enumerate(FUNNEL_KEYS):
        row = latest.get(key)
        count = counts[index]
        prev = counts[index - 1] if index > 0 else None
        steps.append(
            FunnelStep(
                key=key,
                label=_FUNNEL_LABELS[key],
                count=_s(count),
                period_end=None if row is None else row.period_end,
                step_conversion_pct=(
                    None
                    if index == 0 or count is None or prev is None
                    else _pct(count, prev)
                ),
                total_conversion_pct=(
                    None
                    if index == 0 or count is None or first is None
                    else _pct(count, first)
                ),
            )
        )
    return steps


def _derive_retention(
    latest: dict[MetricKey, StartupMetric], missing: list[str]
) -> RetentionBlock:
    """Churn, NRR, ARPC — with ARPC derived from MRR ÷ customers if absent."""
    arpc_row = latest.get(MetricKey.arpc)
    calculated_arpc: CalculatedValue | None = None

    if arpc_row is None:
        mrr, customers = latest.get(MetricKey.mrr), latest.get(MetricKey.customers)
        if mrr is not None and customers is not None and Decimal(customers.value) > 0:
            calculated_arpc = CalculatedValue(
                key="arpc",
                value=_s(Decimal(mrr.value) / Decimal(customers.value)) or "0",
                unit="currency",
                inputs=[MetricKey.mrr, MetricKey.customers],
            )
        else:
            missing.append("arpc")

    return RetentionBlock(
        churn_rate=None if (r := latest.get(MetricKey.churn_rate)) is None else _kpi(r),
        nrr=None if (r := latest.get(MetricKey.nrr)) is None else _kpi(r),
        arpc=None if arpc_row is None else _kpi(arpc_row),
        calculated_arpc=calculated_arpc,
    )


async def business(
    db: AsyncSession, user: User, org_id: uuid.UUID
) -> BusinessAnalytics:
    """The whole Business tab for one startup org — any active member."""
    org = await organization_service.startup_org_or_404(db, org_id)
    await organization_service.require_membership(db, org.id, user)

    latest = await _latest_rows(db, org.id)
    missing: list[str] = []

    kpis = [_kpi(latest[key]) for key in _KPI_KEYS if key in latest]

    # KPI keys that did not make it onto a card are named, so the page can
    # offer "enter this" instead of drawing a dash with no explanation.
    reported_kpi_keys = {kpi.key for kpi in kpis}
    for key in _KPI_KEYS:
        if key not in reported_kpi_keys:
            missing.append(key.value)

    unit_economics = _derive_unit_economics(latest, missing)
    funnel = _derive_funnel(latest, missing)
    retention = _derive_retention(latest, missing)

    business_keys = _KPI_KEYS + FUNNEL_KEYS
    reported = sum(1 for key in business_keys if key in latest)

    return BusinessAnalytics(
        kpis=kpis,
        unit_economics=unit_economics,
        retention=retention,
        funnel=funnel,
        completeness=BusinessCompleteness(
            reported=reported,
            total=len(business_keys),
            missing=[key for key in business_keys if key not in latest],
        ),
        sources=[
            SourceUsage(
                key=key,
                source=(
                    row.source
                    if isinstance(row.source, MetricSource)
                    else MetricSource(row.source)
                ),
                period_end=row.period_end,
            )
            for key, row in sorted(
                latest.items(), key=lambda item: item[0].value
            )
        ],
        missing=sorted(set(missing)),
    )
