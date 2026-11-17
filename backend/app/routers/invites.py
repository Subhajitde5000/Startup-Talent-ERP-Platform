"""Invite acceptance router (Step 3b): POST /invites/{token}/accept.

The token is bound to the INVITED EMAIL at issue time; acceptance checks
the caller's own email against it, so possession of the link alone is not
enough — you must also be logged in as the invited address.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.organization import OrganizationRead
from app.services import organization_service

router = APIRouter(prefix="/invites", tags=["invites"])


@router.post(
    "/{token}/accept",
    response_model=OrganizationRead,
    status_code=status.HTTP_200_OK,
    summary="Accept an organization invite",
)
async def accept_invite(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> OrganizationRead:
    return await organization_service.accept_invite(db, user, token)
