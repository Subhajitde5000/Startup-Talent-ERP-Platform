"""Business analytics router (Step 5k).

One thin read route (AGENTS.md section 3): the actor comes from the auth
dependency, membership and org scoping live in ``analytics_service``.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.business import BusinessAnalytics
from app.services import analytics_service

router = APIRouter(prefix="/organizations", tags=["analytics"])


@router.get(
    "/{org_id}/analytics/business",
    response_model=BusinessAnalytics,
    summary="Business tab analytics",
)
async def business_analytics(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> BusinessAnalytics:
    """Any active member (viewer included).

    Reported KPIs carry their source; derived figures (LTV:CAC, payback,
    net burn) are computed here and are never client-writable. Any figure
    that cannot be computed is absent and named in ``missing`` — never 0.
    """
    return await analytics_service.business(db, user, org_id)
