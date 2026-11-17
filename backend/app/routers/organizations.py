"""Organizations router: orgs, members, invites (Step 3b).

Thin routes (AGENTS.md section 4): every handler resolves the actor from
the auth dependency and delegates to organization_service, which performs
the object-level membership/role checks. There is no route shape where a
caller can name a DIFFERENT actor — user ids in paths are targets, never
the subject of the action. Path params are uuid.UUID so malformed ids are
rejected with 422 before any service code runs.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.organization import (
    InviteCreate,
    InviteRead,
    MemberRead,
    MemberUpdate,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
    TransferOwnership,
)
from app.services import organization_service

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/mine", response_model=list[OrganizationRead], summary="List my organizations")
async def list_mine(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[OrganizationRead]:
    return await organization_service.list_my_organizations(db, user)


@router.post(
    "",
    response_model=OrganizationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create an organization",
)
async def create_organization(
    payload: OrganizationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> OrganizationRead:
    """Create a startup/employer/investor_firm org. The caller must hold
    the matching platform role; they become its owner."""
    return await organization_service.create_organization(db, user, payload)


@router.get("/{org_id}", response_model=OrganizationRead, summary="Get organization")
async def get_organization(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> OrganizationRead:
    return await organization_service.get_organization(db, user, org_id)


@router.patch("/{org_id}", response_model=OrganizationRead, summary="Update organization")
async def update_organization(
    org_id: uuid.UUID,
    payload: OrganizationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> OrganizationRead:
    return await organization_service.update_organization(db, user, org_id, payload)


@router.get("/{org_id}/members", response_model=list[MemberRead], summary="List members")
async def list_members(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[MemberRead]:
    return await organization_service.list_members(db, user, org_id)


@router.patch(
    "/{org_id}/members/{target_user_id}",
    response_model=MemberRead,
    summary="Update a member",
)
async def update_member(
    org_id: uuid.UUID,
    target_user_id: uuid.UUID,
    payload: MemberUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MemberRead:
    return await organization_service.update_member(
        db, user, org_id, target_user_id, payload
    )


@router.delete(
    "/{org_id}/members/{target_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member",
)
async def remove_member(
    org_id: uuid.UUID,
    target_user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    await organization_service.remove_member(db, user, org_id, target_user_id)


@router.post(
    "/{org_id}/transfer-ownership",
    response_model=list[MemberRead],
    summary="Transfer ownership",
)
async def transfer_ownership(
    org_id: uuid.UUID,
    payload: TransferOwnership,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[MemberRead]:
    return await organization_service.transfer_ownership(db, user, org_id, payload)


@router.post(
    "/{org_id}/invites",
    response_model=InviteRead,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a member by email",
)
async def create_invite(
    org_id: uuid.UUID,
    payload: InviteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InviteRead:
    """Owner/admin invites by email. No mail is sent yet (Step 12); the
    one-time `token` is returned so the UI can show the accept link."""
    return await organization_service.create_invite(db, user, org_id, payload)


@router.get(
    "/{org_id}/invites", response_model=list[InviteRead], summary="List pending invites"
)
async def list_invites(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[InviteRead]:
    return await organization_service.list_invites(db, user, org_id)


@router.delete(
    "/{org_id}/invites/{invite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an invite",
)
async def revoke_invite(
    org_id: uuid.UUID,
    invite_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    await organization_service.revoke_invite(db, user, org_id, invite_id)
