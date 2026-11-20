"""Startup dashboard router (Step 5g).

One read-only route, thin as always (AGENTS.md section 3): the actor comes
from the auth dependency and the org id is a ``uuid.UUID``, so a malformed
id is a 422 before any service code runs. Membership checks, org scoping
and the honesty rules (no invented numbers) live in
``dashboard_service``.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/organizations", tags=["dashboard"])


@router.get(
    "/{org_id}/dashboard-summary",
    response_model=DashboardSummary,
    summary="Startup dashboard summary",
)
async def dashboard_summary(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DashboardSummary:
    """Everything ``/startup/dashboard`` needs, in one request.

    Any active member may read it (viewer included). Cards with no source
    yet are named in ``unavailable`` (with the step that supplies them)
    rather than returned as zero; money is withheld from viewers and named
    in ``restricted``. Metric values are decimal strings, never floats.
    """
    return await dashboard_service.summary(db, user, org_id)
