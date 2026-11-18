"""Organization service: orgs, members, invites (Step 3b).

Object-level permission (AGENTS.md section 5): every function resolves the
ACTOR's membership first — there is no code path where a caller can act on
an org they do not belong to, and write paths additionally require an
active owner/admin membership. Invite acceptance binds to the caller's own
email, so a stolen token is useless to anyone else.

Ownership rules (part 3):
- only an owner may assign or demote the owner role;
- nobody may change their own role (ownership moves via transfer only);
- the last owner can never be demoted or removed.
"""

import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import conflict, forbidden, not_found, validation_error
from app.models.organization import (
    MemberStatus,
    Organization,
    OrganizationInvite,
    OrganizationMember,
    OrgRole,
    OrgType,
)
from app.models.task import Task
from app.models.user import User, UserRole, UserRoleRow
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

INVITE_TTL_DAYS = 14

# Creating an org of a kind requires holding the matching platform role.
_TYPE_ROLE: dict[OrgType, UserRole] = {
    OrgType.startup: UserRole.startup,
    OrgType.employer: UserRole.employer,
    OrgType.investor_firm: UserRole.investor,
}


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:190].strip("-") or "org"


async def _unique_slug(db: AsyncSession, base: str) -> str:
    candidate = base
    suffix = 2
    while True:
        result = await db.execute(
            select(Organization.id).where(
                Organization.slug == candidate,
                Organization.deleted_at.is_(None),
            )
        )
        if result.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


async def _user_holds_role(db: AsyncSession, user: User, role: UserRole) -> bool:
    result = await db.execute(
        select(UserRoleRow.user_id).where(
            UserRoleRow.user_id == user.id, UserRoleRow.role == role
        )
    )
    return result.first() is not None


async def org_or_404(db: AsyncSession, org_id) -> Organization:  # noqa: ANN001
    result = await db.execute(
        select(Organization).where(
            Organization.id == org_id,
            Organization.deleted_at.is_(None),
        )
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise not_found("Organization not found.")
    return org


async def startup_org_or_404(db: AsyncSession, org_id) -> Organization:  # noqa: ANN001
    """Startup-workspace org or 404 (Steps 5a/5b shared): wrong type,
    suspended and deleted organizations are indistinguishable — no
    existence oracle for callers outside the startup workspace."""
    org = await org_or_404(db, org_id)
    if org.type != OrgType.startup or org.status != "active":
        raise not_found("Organization not found.")
    return org


async def require_membership(
    db: AsyncSession,
    org_id,
    user: User,
    *,
    write: bool = False,
    roles: set[OrgRole] | None = None,
) -> OrganizationMember:  # noqa: ANN001
    """Actor must be an ACTIVE member.

    - ``roles`` (Step 5a): when given, membership must hold one of these
      roles (e.g. ``{owner, admin, member}`` excludes viewers).
    - ``write`` (Step 3): owner/admin only — used when ``roles`` is None.
    """
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise forbidden("You are not an active member of this organization.")
    if roles is not None:
        if member.role not in roles:
            raise forbidden()
    elif write and member.role not in (OrgRole.owner, OrgRole.admin):
        raise forbidden("Only owners and admins can manage this organization.")
    return member


async def require_active_member_ref(
    db: AsyncSession,
    org_id,
    user_id,
    *,
    field: str,
    label: str,
) -> None:  # noqa: ANN001
    """Cross-org/IDOR guard for user references in payloads (5b owner,
    5c assignee): a non-member (or a member of another organization)
    is a 422 with ``loc: [body, field]`` so the frontend can map it."""
    result = await db.execute(
        select(OrganizationMember.id).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
        )
    )
    if result.first() is None:
        message = f"{label} must be an active member of this organization."
        raise validation_error(
            message,
            details=[{"loc": ["body", field], "msg": message, "type": "value_error"}],
        )


async def _active_member_count(db: AsyncSession, org_id, role: OrgRole | None = None) -> int:  # noqa: ANN001
    from sqlalchemy import func

    stmt = select(func.count(OrganizationMember.id)).where(
        OrganizationMember.org_id == org_id,
        OrganizationMember.deleted_at.is_(None),
        OrganizationMember.status == MemberStatus.active,
    )
    if role is not None:
        stmt = stmt.where(OrganizationMember.role == role)
    result = await db.execute(stmt)
    return int(result.scalar_one())


# --- organizations ----------------------------------------------------------


async def create_organization(
    db: AsyncSession, user: User, payload: OrganizationCreate
) -> OrganizationRead:
    if payload.type not in _TYPE_ROLE:
        raise forbidden("Only startup, employer and investor_firm organizations can be created.")
    needed = _TYPE_ROLE[payload.type]
    if not await _user_holds_role(db, user, needed):
        raise forbidden(f"Creating a {payload.type.value} organization requires the {needed.value} role.")

    slug = payload.slug or _slugify(payload.name)
    if payload.slug is not None:
        result = await db.execute(
            select(Organization.id).where(
                Organization.slug == payload.slug,
                Organization.deleted_at.is_(None),
            )
        )
        if result.first() is not None:
            raise conflict("That slug is already taken.")
    else:
        slug = await _unique_slug(db, slug)

    org = Organization(
        name=payload.name,
        slug=slug,
        type=payload.type,
        summary=payload.summary,
        website=payload.website,
        city=payload.city,
        region=payload.region,
        country=(payload.country or "IN").upper() if payload.country else "IN",
        founded_year=payload.founded_year,
    )
    db.add(org)
    await db.flush()

    db.add(
        OrganizationMember(
            org_id=org.id,
            user_id=user.id,
            role=OrgRole.owner,
            status=MemberStatus.active,
            is_founder=True,
            invited_by=user.id,
            joined_at=datetime.now(UTC),
        )
    )
    await db.commit()
    return OrganizationRead(
        id=org.id,
        name=org.name,
        slug=org.slug,
        type=org.type,
        status=org.status,
        summary=org.summary,
        logo_url=org.logo_url,
        logo_initials=org.logo_initials,
        website=org.website,
        city=org.city,
        region=org.region,
        country=org.country,
        founded_year=org.founded_year,
        verified_at=org.verified_at,
        created_at=org.created_at,
        updated_at=org.updated_at,
        my_role=OrgRole.owner,
    )


async def list_my_organizations(db: AsyncSession, user: User) -> list[OrganizationRead]:
    result = await db.execute(
        select(Organization, OrganizationMember.role)
        .join(
            OrganizationMember,
            OrganizationMember.org_id == Organization.id,
        )
        .where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
            Organization.deleted_at.is_(None),
        )
        .order_by(Organization.created_at)
    )
    out: list[OrganizationRead] = []
    for org, role in result.all():
        out.append(
            OrganizationRead(
                id=org.id,
                name=org.name,
                slug=org.slug,
                type=org.type,
                status=org.status,
                summary=org.summary,
                logo_url=org.logo_url,
                logo_initials=org.logo_initials,
                website=org.website,
                city=org.city,
                region=org.region,
                country=org.country,
                founded_year=org.founded_year,
                verified_at=org.verified_at,
                created_at=org.created_at,
                updated_at=org.updated_at,
                my_role=role,
            )
        )
    return out


async def get_organization(
    db: AsyncSession, user: User, org_id  # noqa: ANN001
) -> OrganizationRead:
    org = await org_or_404(db, org_id)
    member = await require_membership(db, org.id, user)
    return OrganizationRead(
        id=org.id,
        name=org.name,
        slug=org.slug,
        type=org.type,
        status=org.status,
        summary=org.summary,
        logo_url=org.logo_url,
        logo_initials=org.logo_initials,
        website=org.website,
        city=org.city,
        region=org.region,
        country=org.country,
        founded_year=org.founded_year,
        verified_at=org.verified_at,
        created_at=org.created_at,
        updated_at=org.updated_at,
        my_role=member.role,
    )


async def update_organization(
    db: AsyncSession, user: User, org_id, payload: OrganizationUpdate  # noqa: ANN001
) -> OrganizationRead:
    org = await org_or_404(db, org_id)
    await require_membership(db, org.id, user, write=True)

    data = payload.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] != org.slug:
        result = await db.execute(
            select(Organization.id).where(
                Organization.slug == data["slug"],
                Organization.id != org.id,
                Organization.deleted_at.is_(None),
            )
        )
        if result.first() is not None:
            raise conflict("That slug is already taken.")
    for field, value in data.items():
        setattr(org, field, value)
    await db.commit()
    return await get_organization(db, user, org.id)


# --- members ----------------------------------------------------------------


def _member_read(
    member: OrganizationMember, user: User, task_count: int = 0
) -> MemberRead:
    return MemberRead(
        user_id=member.user_id,
        display_name=user.display_name or "",
        email=user.primary_email,
        avatar_initials=user.avatar_initials,
        avatar_url=user.avatar_url,
        role=member.role,
        status=member.status.value,
        title=member.title,
        department=member.department,
        is_founder=member.is_founder,
        is_public=member.is_public,
        joined_at=member.joined_at,
        task_count=task_count,
    )


async def _task_counts(db: AsyncSession, org_id) -> dict:  # noqa: ANN001
    """Non-deleted tasks per assignee for this org — one grouped query,
    no N+1 (Step 5c: the team directory shows a task count per member).
    Done tasks are currently included; see the 5c report open question."""
    result = await db.execute(
        select(Task.assignee_id, func.count())
        .where(
            Task.org_id == org_id,
            Task.deleted_at.is_(None),
            Task.assignee_id.is_not(None),
        )
        .group_by(Task.assignee_id)
    )
    return {assignee_id: count for assignee_id, count in result.all()}


async def list_members(
    db: AsyncSession, user: User, org_id  # noqa: ANN001
) -> list[MemberRead]:
    org = await org_or_404(db, org_id)
    await require_membership(db, org.id, user)
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
            User.deleted_at.is_(None),
        )
        .order_by(OrganizationMember.is_founder.desc(), OrganizationMember.joined_at)
    )
    counts = await _task_counts(db, org.id)
    return [
        _member_read(member, row_user, counts.get(member.user_id, 0))
        for member, row_user in result.all()
    ]


async def update_member(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    target_user_id,
    payload: MemberUpdate,
) -> MemberRead:
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, write=True)

    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.user_id == target_user_id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise not_found("Member not found in this organization.")
    target, target_user = row

    if target.user_id == actor.user_id:
        raise forbidden("Use the transfer-ownership endpoint to change your own role.")

    data = payload.model_dump(exclude_unset=True)
    if "role" in data and data["role"] != target.role:
        if data["role"] == OrgRole.owner and actor.role != OrgRole.owner:
            raise forbidden("Only the owner can assign the owner role.")
        if target.role == OrgRole.owner:
            owners = await _active_member_count(db, org.id, OrgRole.owner)
            if owners <= 1:
                raise conflict("Cannot change the role of the last owner.")
    for field, value in data.items():
        setattr(target, field, value)
    await db.commit()
    counts = await _task_counts(db, org.id)
    return _member_read(target, target_user, counts.get(target.user_id, 0))


async def remove_member(
    db: AsyncSession, user: User, org_id, target_user_id  # noqa: ANN001
) -> None:
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, write=True)

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.user_id == target_user_id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise not_found("Member not found in this organization.")
    if target.user_id == actor.user_id:
        raise forbidden("Use a dedicated leave flow to remove yourself.")
    if target.role == OrgRole.owner:
        owners = await _active_member_count(db, org.id, OrgRole.owner)
        if owners <= 1:
            raise conflict("Cannot remove the last owner.")
    target.deleted_at = datetime.now(UTC)
    target.status = MemberStatus.deactivated
    await db.commit()


async def transfer_ownership(
    db: AsyncSession, user: User, org_id, payload: TransferOwnership  # noqa: ANN001
) -> list[MemberRead]:
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user)
    if actor.role != OrgRole.owner:
        raise forbidden("Only the owner can transfer ownership.")
    if payload.user_id == actor.user_id:
        raise conflict("You already own this organization.")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.user_id == payload.user_id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise not_found("Member not found in this organization.")

    target.role = OrgRole.owner
    actor.role = OrgRole.admin
    await db.commit()
    return await list_members(db, user, org.id)


# --- invites ----------------------------------------------------------------


def _invite_read(invite: OrganizationInvite, token: str | None = None) -> InviteRead:
    return InviteRead(
        id=invite.id,
        org_id=invite.org_id,
        email=invite.email,
        role=invite.role,
        title=invite.title,
        department=invite.department,
        expires_at=invite.expires_at,
        accepted_at=invite.accepted_at,
        revoked_at=invite.revoked_at,
        created_at=invite.created_at,
        token=token,
    )


async def create_invite(
    db: AsyncSession, user: User, org_id, payload: InviteCreate  # noqa: ANN001
) -> InviteRead:
    org = await org_or_404(db, org_id)
    await require_membership(db, org.id, user, write=True)

    email = payload.email.strip().lower()
    existing = await db.execute(
        select(OrganizationMember)
        .join(User, User.id == OrganizationMember.user_id)
        .where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.active,
            User.primary_email == email,
        )
    )
    if existing.first() is not None:
        raise conflict("That person is already a member of this organization.")

    token = secrets.token_urlsafe(32)
    invite = OrganizationInvite(
        org_id=org.id,
        email=email,
        role=payload.role,
        title=payload.title,
        department=payload.department,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        invited_by=user.id,
        expires_at=datetime.now(UTC) + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invite)
    await db.commit()
    # Token returned once: Step 12 adds the email; until then the UI shows
    # the accept link directly (dev/demo flow).
    return _invite_read(invite, token=token)


async def list_invites(
    db: AsyncSession, user: User, org_id  # noqa: ANN001
) -> list[InviteRead]:
    org = await org_or_404(db, org_id)
    await require_membership(db, org.id, user, write=True)
    result = await db.execute(
        select(OrganizationInvite)
        .where(
            OrganizationInvite.org_id == org.id,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.revoked_at.is_(None),
        )
        .order_by(OrganizationInvite.created_at.desc())
    )
    return [_invite_read(invite) for invite in result.scalars().all()]


async def revoke_invite(
    db: AsyncSession, user: User, org_id, invite_id  # noqa: ANN001
) -> None:
    org = await org_or_404(db, org_id)
    await require_membership(db, org.id, user, write=True)
    result = await db.execute(
        select(OrganizationInvite).where(
            OrganizationInvite.id == invite_id,
            OrganizationInvite.org_id == org.id,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.revoked_at.is_(None),
        )
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise not_found("Invite not found.")
    invite.revoked_at = datetime.now(UTC)
    await db.commit()


async def accept_invite(db: AsyncSession, user: User, token: str) -> OrganizationRead:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(OrganizationInvite).where(OrganizationInvite.token_hash == token_hash)
    )
    invite = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if invite is None or invite.revoked_at is not None or invite.accepted_at is not None:
        raise not_found("This invite is no longer valid.")
    expires = invite.expires_at
    if expires.tzinfo is None:
        # SQLite returns naive datetimes; normalize to aware UTC for compare.
        expires = expires.replace(tzinfo=UTC)
    if expires < now:
        raise conflict("This invite has expired.")

    if invite.email.lower() != (user.primary_email or "").lower():
        raise forbidden("This invite was issued to a different email address.")

    org = await org_or_404(db, invite.org_id)
    existing = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.deleted_at.is_(None),
        )
    )
    if existing.first() is not None:
        raise conflict("You are already a member of this organization.")

    db.add(
        OrganizationMember(
            org_id=org.id,
            user_id=user.id,
            role=invite.role,
            status=MemberStatus.active,
            title=invite.title,
            department=invite.department,
            invited_by=invite.invited_by,
            invited_email=invite.email,
            joined_at=now,
        )
    )
    invite.accepted_at = now
    await db.commit()
    return await get_organization(db, user, org.id)
