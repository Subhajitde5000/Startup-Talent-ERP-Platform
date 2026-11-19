"""Organizations router: orgs, members, invites (Step 3b).

Thin routes (AGENTS.md section 4): every handler resolves the actor from
the auth dependency and delegates to organization_service, which performs
the object-level membership/role checks. There is no route shape where a
caller can name a DIFFERENT actor — user ids in paths are targets, never
the subject of the action. Path params are uuid.UUID so malformed ids are
rejected with 422 before any service code runs.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.permissions import permission_matrix
from app.db.session import get_db
from app.models.organization import Department, OrgRole
from app.models.user import User
from app.schemas.organization import (
    BulkInviteResult,
    BulkInviteRevoke,
    BulkMemberAction,
    BulkMemberResult,
    InviteCreate,
    InviteRead,
    MemberPage,
    MemberRead,
    MemberUpdate,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
    TeamSummary,
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


@router.get(
    "/permissions",
    summary="The organization permission matrix",
    tags=["organizations"],
)
async def get_permissions() -> dict:
    """Item 7: the roles/permissions text the team page renders.

    Declared BEFORE ``/{org_id}`` on purpose: FastAPI matches routes in
    registration order, and a later declaration would try to parse
    "permissions" as a UUID and return 422.
    """
    return permission_matrix()


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


@router.get(
    "/{org_id}/members",
    response_model=MemberPage,
    summary="List members (filter, sort, paginate)",
)
async def list_members(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    role: Annotated[OrgRole | None, Query()] = None,
    status_: Annotated[
        Literal["active", "deactivated", "invited", "all"], Query(alias="status")
    ] = "active",
    department: Annotated[Department | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: Annotated[
        Literal["name", "-name", "joined", "-joined", "last_active", "-last_active"],
        Query(),
    ] = "name",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MemberPage:
    """Item 10. Filtering and sorting happen in SQL, so the page keeps
    working past one page of results. ``status`` defaults to ``active``,
    which is what the directory showed before."""
    return await organization_service.list_members(
        db,
        user,
        org_id,
        role=role,
        status=status_,
        department=department,
        q=q,
        sort=sort,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{org_id}/team/summary",
    response_model=TeamSummary,
    summary="Team counter cards",
)
async def team_summary(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> TeamSummary:
    return await organization_service.team_summary(db, user, org_id)


@router.get(
    "/{org_id}/members/export",
    summary="Export the member list as CSV",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
async def export_members(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Item 9: owner/admin only, no private fields. Built server-side so
    it covers the whole team rather than the loaded page."""
    csv = await organization_service.export_members_csv(db, user, org_id)
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="team.csv"'},
    )


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


@router.post(
    "/{org_id}/members/{target_user_id}/deactivate",
    response_model=MemberRead,
    summary="Deactivate a member's access",
)
async def deactivate_member(
    org_id: uuid.UUID,
    target_user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MemberRead:
    """Item 1. Access ends immediately; the member row and its history stay."""
    return await organization_service.deactivate_member(db, user, org_id, target_user_id)


@router.post(
    "/{org_id}/members/{target_user_id}/reactivate",
    response_model=MemberRead,
    summary="Restore a deactivated member's access",
)
async def reactivate_member(
    org_id: uuid.UUID,
    target_user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MemberRead:
    return await organization_service.reactivate_member(db, user, org_id, target_user_id)


@router.post(
    "/{org_id}/members/bulk",
    response_model=BulkMemberResult,
    summary="Deactivate, reactivate or remove up to 50 members",
)
async def bulk_member_action(
    org_id: uuid.UUID,
    payload: BulkMemberAction,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> BulkMemberResult:
    """Item 4. One transaction, all-or-nothing: if any target breaks a rule
    (last owner, role hierarchy, wrong organization) nothing is applied."""
    return await organization_service.bulk_member_action(db, user, org_id, payload)


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
    """Also unassigns the member's tasks in the same transaction (item 11)."""
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
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InviteRead:
    """Owner/admin invites by email.

    Step 3d item 3: the accept link is emailed in a background task, so a
    slow mail provider never delays the response. The one-time ``token`` is
    still returned once as well, so the UI can offer "copy link" and the
    dev flow keeps working without a mailbox.
    """
    return await organization_service.create_invite(
        db, user, org_id, payload, background_tasks=background_tasks
    )


@router.get(
    "/{org_id}/invites", response_model=list[InviteRead], summary="List pending invites"
)
async def list_invites(
    org_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[InviteRead]:
    return await organization_service.list_invites(db, user, org_id)


@router.post(
    "/{org_id}/invites/{invite_id}/resend",
    response_model=InviteRead,
    summary="Resend an invite with a fresh token",
)
async def resend_invite(
    org_id: uuid.UUID,
    invite_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> InviteRead:
    """Item 2. The old accept link stops working immediately (the stored
    hash is replaced) and the expiry is extended by the full TTL."""
    return await organization_service.resend_invite(
        db, user, org_id, invite_id, background_tasks=background_tasks
    )


@router.post(
    "/{org_id}/invites/bulk-revoke",
    response_model=BulkInviteResult,
    summary="Revoke up to 50 pending invites",
)
async def bulk_revoke_invites(
    org_id: uuid.UUID,
    payload: BulkInviteRevoke,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> BulkInviteResult:
    """Item 4: all-or-nothing, like the member bulk endpoint."""
    return await organization_service.bulk_revoke_invites(db, user, org_id, payload)


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
