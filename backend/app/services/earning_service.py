"""Step 8h service: mentor earnings.

Two directions of trust:

- **Writing** happens in exactly one place, ``record_for_session``, called
  by ``session_service.complete`` inside the completing transaction. The
  gross comes from the SESSION's own fee, the rates come from settings, and
  net is arithmetic. No client touches any of it; there is no write
  endpoint at all.
- **Reading** is scoped to ``mentor_id == caller.id`` on every query. A
  startup role has no path here: this is the mentor's own money.

The rates default to **0** (approved Q2a). BUILD_PLAN and schema.sql define
no commission or TDS rate anywhere, so inventing one would bake a wrong
number into money that 14f eventually pays out. At 0 the columns and the
arithmetic are correct and honest (``net == gross``), and finance/legal
supply the real percentages before a payout batch is released.

Rounding: both withheld amounts are quantised to paise with ROUND_HALF_UP
*before* net is computed from them, so the ``mentor_earning_math`` CHECK
always holds exactly rather than off by a rounding unit.
"""

import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import rate_limited
from app.models.earning import OPEN_STATUSES, EarningStatus, MentorEarning
from app.models.mentorship import Mentorship
from app.models.organization import Organization
from app.models.session import MentoringSession
from app.models.user import User
from app.schemas.earning import EarningPage, EarningRead, EarningSummary
from app.services.rate_limiter import rate_limiter

_PAISE = Decimal("0.01")
_HUNDRED = Decimal("100")


def _money(value: Decimal) -> Decimal:
    """Two decimal places, half-up — the precision the column stores."""
    return value.quantize(_PAISE, rounding=ROUND_HALF_UP)


def compute_amounts(gross: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    """``(gross, commission, tds)`` -> net, all quantised.

    Exposed for the tests, which pin the arithmetic and the 0% default.
    """
    settings = get_settings()
    gross = _money(gross)
    commission = _money(gross * settings.MENTOR_COMMISSION_PCT / _HUNDRED)
    tds = _money(gross * settings.MENTOR_TDS_PCT / _HUNDRED)
    # Net is derived FROM the rounded parts, so the DB CHECK cannot fail.
    return commission, tds, gross - commission - tds


async def _enforce_read_limit(user: User) -> None:
    settings = get_settings()
    if not await rate_limiter.check(
        f"earning_read:user:{user.id}",
        settings.EARNING_READ_LIMIT,
        settings.EARNING_READ_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many requests. Please slow down.")


async def record_for_session(
    db: AsyncSession, session: MentoringSession, mentor_id: uuid.UUID
) -> MentorEarning | None:
    """Stage the earning for a completed, PAID session. Staged, not committed.

    Returns ``None`` when there is nothing to pay: no fee agreed, a zero
    fee, or an earning already recorded for this session. Idempotent on
    ``session_id``, so re-completing a session can never double-pay it.

    Called by ``session_service.complete`` inside its own transaction: the
    session completion and the money it creates commit or roll back
    together, so a mentor can never be credited for a completion that was
    rolled back.
    """
    if session.fee_amount is None:
        return None
    fee = Decimal(session.fee_amount)
    if fee <= 0:
        return None

    existing = (
        await db.execute(
            select(MentorEarning.id).where(MentorEarning.session_id == session.id)
        )
    ).first()
    if existing is not None:
        return None

    commission, tds, net = compute_amounts(fee)
    earning = MentorEarning(
        mentor_id=mentor_id,
        session_id=session.id,
        gross_amount=fee,
        commission_amount=commission,
        tds_amount=tds,
        net_amount=net,
        currency=session.currency or "INR",
        status=EarningStatus.pending,
        # The day the work was delivered, not the day it is read.
        earned_on=date.today(),
    )
    db.add(earning)
    return earning


async def list_own(
    db: AsyncSession,
    user: User,
    *,
    limit: int,
    offset: int,
    status: EarningStatus | None = None,
) -> EarningPage:
    """The caller's own earnings, newest first, paginated."""
    await _enforce_read_limit(user)
    base = select(MentorEarning).where(MentorEarning.mentor_id == user.id)
    count_q = select(func.count()).select_from(MentorEarning).where(
        MentorEarning.mentor_id == user.id
    )
    if status is not None:
        base = base.where(MentorEarning.status == status)
        count_q = count_q.where(MentorEarning.status == status)

    total = (await db.execute(count_q)).scalar_one()
    # LEFT joins all the way: an earning survives its session being deleted
    # (session_id is ON DELETE SET NULL), so the context must be optional
    # rather than dropping the money row from the list.
    rows = (
        await db.execute(
            base.add_columns(
                Organization.name.label("startup_name"),
                MentoringSession.topic.label("session_topic"),
            )
            .outerjoin(MentoringSession, MentoringSession.id == MentorEarning.session_id)
            .outerjoin(Mentorship, Mentorship.id == MentoringSession.mentorship_id)
            .outerjoin(Organization, Organization.id == Mentorship.startup_org_id)
            .order_by(
                MentorEarning.earned_on.desc(), MentorEarning.created_at.desc()
            )
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return EarningPage(
        items=[
            EarningRead(
                id=earning.id,
                session_id=earning.session_id,
                gross_amount=earning.gross_amount,
                commission_amount=earning.commission_amount,
                tds_amount=earning.tds_amount,
                net_amount=earning.net_amount,
                currency=earning.currency,
                status=EarningStatus(earning.status),
                earned_on=earning.earned_on,
                payout_batch_id=earning.payout_batch_id,
                created_at=earning.created_at,
                startup_name=startup_name,
                session_topic=session_topic,
            )
            for earning, startup_name, session_topic in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


async def summary(db: AsyncSession, user: User) -> EarningSummary:
    """Totals for the mentor dashboard, computed in one query."""
    await _enforce_read_limit(user)
    open_values = [s.value for s in OPEN_STATUSES]

    row = (
        await db.execute(
            select(
                func.count(MentorEarning.id),
                func.count(MentorEarning.id).filter(
                    MentorEarning.status.in_(open_values)
                ),
                func.coalesce(
                    func.sum(MentorEarning.net_amount).filter(
                        MentorEarning.status.in_(open_values)
                    ),
                    Decimal("0"),
                ),
                func.coalesce(
                    func.sum(MentorEarning.net_amount).filter(
                        MentorEarning.status == EarningStatus.paid.value
                    ),
                    Decimal("0"),
                ),
                # Lifetime is what was actually EARNED, i.e. excluding money
                # that was reversed away.
                func.coalesce(
                    func.sum(MentorEarning.net_amount).filter(
                        MentorEarning.status != EarningStatus.reversed.value
                    ),
                    Decimal("0"),
                ),
                func.count(func.distinct(MentorEarning.session_id)),
                func.min(MentorEarning.currency),
            ).where(MentorEarning.mentor_id == user.id)
        )
    ).one()

    total_count = int(row[0] or 0)
    return EarningSummary(
        # One currency per mentor is the real-world case; the column default
        # is the honest answer when there are no rows yet.
        currency=row[6] or "INR",
        session_count=int(row[5] or 0),
        pending_count=int(row[1] or 0),
        pending_amount=_money(Decimal(row[2] or 0)),
        paid_amount=_money(Decimal(row[3] or 0)),
        lifetime_amount=_money(Decimal(row[4] or 0)) if total_count else Decimal("0.00"),
    )


__all__ = ["compute_amounts", "list_own", "record_for_session", "summary"]
