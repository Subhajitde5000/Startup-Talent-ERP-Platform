"""Step 8h router: the mentor's own earnings.

Read-only by design. Rows are created by ``session_service.complete``, so
there is no POST here to get wrong — and nothing a client can send that
becomes money.

Both routes are scoped to the caller's own ``mentor_id``; a startup role
gets 403 from the guard, because this is the mentor's private ledger.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.earning import EarningStatus
from app.models.user import User, UserRole
from app.schemas.earning import EarningPage, EarningSummary
from app.services import earning_service

router = APIRouter(prefix="/mentor/earnings", tags=["mentor earnings"])

_LIMIT_MAX = 50


@router.get(
    "",
    response_model=EarningPage,
    summary="List my earnings (mentor only)",
    responses={403: {"description": "Not a mentor."}},
)
async def list_earnings(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(UserRole.mentor))],
    status: Annotated[
        EarningStatus | None, Query(description="Filter by earning status.")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=_LIMIT_MAX)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EarningPage:
    return await earning_service.list_own(
        db, user, limit=limit, offset=offset, status=status
    )


@router.get(
    "/summary",
    response_model=EarningSummary,
    summary="My earning totals (mentor only)",
    responses={403: {"description": "Not a mentor."}},
)
async def earnings_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role(UserRole.mentor))],
) -> EarningSummary:
    return await earning_service.summary(db, user)
