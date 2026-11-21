"""Step 8h schemas: mentor earnings.

**Read-only.** There is no Create or Update schema on purpose: an earning is
derived from a completed, paid session and is never entered by hand, and no
client may write an amount, a rate or a status. Approval and payout (14f)
add their own action schemas when they exist.

Money is serialised as a decimal string by pydantic v2's ``Decimal``
support, so a float never touches a currency amount.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.earning import EarningStatus

CURRENCY_PATTERN = r"^[A-Z]{3}$"


class EarningRead(BaseModel):
    """One earning row, exactly as the mentor may see it."""

    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    session_id: uuid.UUID | None
    gross_amount: Decimal
    commission_amount: Decimal
    tds_amount: Decimal
    net_amount: Decimal
    currency: str
    status: EarningStatus
    earned_on: date
    # Which payout run it landed in; null until 14f batches it.
    payout_batch_id: uuid.UUID | None
    created_at: datetime
    # Joined read-only context, so the earnings table can say which startup
    # and which session a row came from without the client making one
    # /sessions call per row. Both are null when the session was deleted
    # (``session_id`` is ON DELETE SET NULL) — never faked.
    startup_name: str | None = None
    session_topic: str | None = None


class EarningPage(BaseModel):
    items: list[EarningRead]
    total: int
    limit: int
    offset: int


class EarningSummary(BaseModel):
    """The mentor's dashboard numbers.

    ``pending_amount`` is the money still owed (``pending`` + ``approved``),
    not a lifetime total: that is the number a mentor actually acts on.
    """

    currency: str
    pending_amount: Decimal
    paid_amount: Decimal
    lifetime_amount: Decimal
    session_count: int
    pending_count: int


__all__ = ["CURRENCY_PATTERN", "EarningPage", "EarningRead", "EarningSummary"]
