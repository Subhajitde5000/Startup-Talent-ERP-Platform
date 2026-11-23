"""Organization service: orgs, members, invites (Step 3b, completed in 3d).

Object-level permission (AGENTS.md section 5): every function resolves the
ACTOR's membership first — there is no code path where a caller can act on
an org they do not belong to, and management paths additionally require an
owner/admin membership taken from ``core.permissions.TEAM_MANAGERS``.
Invite acceptance binds to the caller's own email, so a stolen token is
useless to anyone else.

Ownership rules (Step 3d item 12, tightened):
- ownership moves ONLY through ``transfer_ownership``, which promotes the
  target and demotes the outgoing owner in one transaction, so a second
  owner can never appear by accident (``PATCH role=owner`` is a 422);
- nobody may change, deactivate or remove themselves;
- an admin may never act on an owner;
- the last active owner can never be demoted, deactivated or removed.

Deactivation (item 1) is a status flip: ``require_membership`` only accepts
``MemberStatus.active``, so a deactivated member is refused by every
organization endpoint without any further code, and their rows stay.
"""

import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import BackgroundTasks
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import (
    INVITE_NOT_PENDING,
    LAST_OWNER,
    MEMBER_NOT_ACTIVE,
    OWNER_TARGET,
    OWNER_VIA_TRANSFER_ONLY,
    SELF_ACTION,
    AppException,
    conflict,
    forbidden,
    not_found,
    rate_limited,
    validation_error,
)
from app.core.permissions import TEAM_MANAGERS
from app.models.activity import ActivityEventType
from app.models.organization import (
    Department,
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
from app.services import activity_service, email_service
from app.services.rate_limiter import rate_limiter

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
        logo_file_id=org.logo_file_id,
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
                logo_file_id=org.logo_file_id,
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
        logo_file_id=org.logo_file_id,
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
    if "logo_file_id" in data:
        from app.services.file_service import record_attachment_change, require_org_attachment

        if data["logo_file_id"] is not None:
            await require_org_attachment(
                db, user, org.id, data["logo_file_id"], "logo", "logo_file_id"
            )
        if data["logo_file_id"] != org.logo_file_id:
            record_attachment_change(db, user, org.id, "logo_file_id")
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
    member: OrganizationMember,
    user: User,
    task_count: int = 0,
    *,
    viewer: OrganizationMember,
) -> MemberRead:
    """One directory row.

    ``viewer`` is the CALLER's membership, used for two gates:
    - ``can_manage`` so the page can disable controls instead of collecting
      a 403;
    - ``linkedin_url``/``bio`` are shown only when the member opted into a
      public profile OR the caller manages the team (item 13). Everyone
      else sees a member-only row without the personal links.

    ``phone``, ``din_number`` and auth fields are never read here.
    """
    sees_profile = member.is_public or viewer.role in TEAM_MANAGERS
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
        last_active_at=member.last_active_at,
        linkedin_url=user.linkedin_url if sees_profile else None,
        bio=(member.bio or user.bio) if sees_profile else None,
        can_manage=viewer.role in TEAM_MANAGERS,
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


async def _member_row(
    db: AsyncSession, org_id, user_id, viewer: OrganizationMember  # noqa: ANN001
) -> tuple[OrganizationMember, User]:
    """Target member + user, scoped to THIS org (IDOR guard: a user id from
    another organization simply does not resolve here -> 404)."""
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.deleted_at.is_(None),
        )
    )
    row = result.one_or_none()
    if row is None:
        raise not_found("Member not found in this organization.")
    return row


def _ensure_can_touch_target(actor: OrganizationMember, target: OrganizationMember) -> None:
    """Role-hierarchy guard shared by every single and bulk mutation:
    an admin may never act on an owner, and nobody may act on themselves."""
    if target.user_id == actor.user_id:
        raise AppException(
            SELF_ACTION,
            "You cannot perform this action on yourself.",
            403,
        )
    if target.role == OrgRole.owner and actor.role != OrgRole.owner:
        raise AppException(
            OWNER_TARGET,
            "Only an owner can change, deactivate or remove another owner.",
            403,
        )


async def _ensure_not_last_owner(db: AsyncSession, org_id, target: OrganizationMember) -> None:  # noqa: ANN001
    """The last active owner can never be demoted, deactivated or removed."""
    if target.role != OrgRole.owner:
        return
    owners = await _active_member_count(db, org_id, OrgRole.owner)
    if owners <= 1:
        raise conflict("Cannot change, deactivate or remove the last owner.", code=LAST_OWNER)


async def _touch_last_active(db: AsyncSession, member: OrganizationMember) -> None:
    """Item 5: stamp ``last_active_at``, throttled.

    Committed on its own. That is safe only because every caller has
    already run its permission check (``record()``-style staging does not
    exist yet), so no pending writes can be flushed by mistake here.
    """
    now = datetime.now(UTC)
    previous = member.last_active_at
    if previous is not None:
        if previous.tzinfo is None:
            previous = previous.replace(tzinfo=UTC)
        if (now - previous).total_seconds() < get_settings().LAST_ACTIVE_THROTTLE_SECONDS:
            return
    member.last_active_at = now
    await db.commit()


async def list_members(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    *,
    role: OrgRole | None = None,
    status: str = "active",
    department: Department | None = None,
    q: str | None = None,
    sort: str = "name",
    limit: int = 50,
    offset: int = 0,
) -> MemberPage:
    """Item 10: filtering, sorting and pagination server-side.

    ``status`` defaults to ``active`` (the directory's long-standing
    behaviour) and may be ``deactivated``, ``invited`` or ``all``.
    Filtered in SQL, not in the browser, so it keeps working past one page.
    """
    org = await org_or_404(db, org_id)
    viewer = await require_membership(db, org.id, user)
    await _touch_last_active(db, viewer)

    filters = [
        OrganizationMember.org_id == org.id,
        OrganizationMember.deleted_at.is_(None),
        User.deleted_at.is_(None),
    ]
    if status != "all":
        filters.append(OrganizationMember.status == MemberStatus(status))
    if role is not None:
        filters.append(OrganizationMember.role == role)
    if department is not None:
        filters.append(OrganizationMember.department == department)
    if q:
        # Text search on name and email only (item 10). ``ilike`` on a
        # bound pattern; the wildcards are data, not SQL.
        pattern = f"%{q.strip()}%"
        filters.append(or_(User.display_name.ilike(pattern), User.primary_email.ilike(pattern)))

    total = await db.execute(
        select(func.count())
        .select_from(OrganizationMember)
        .join(User, User.id == OrganizationMember.user_id)
        .where(*filters)
    )
    total_count = int(total.scalar_one())

    order: dict[str, list] = {
        "name": [User.display_name.asc(), OrganizationMember.joined_at.asc()],
        "-name": [User.display_name.desc(), OrganizationMember.joined_at.asc()],
        "joined": [OrganizationMember.joined_at.asc(), OrganizationMember.id],
        "-joined": [OrganizationMember.joined_at.desc(), OrganizationMember.id],
        "last_active": [OrganizationMember.last_active_at.asc(), OrganizationMember.id],
        "-last_active": [OrganizationMember.last_active_at.desc(), OrganizationMember.id],
    }

    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(*filters)
        .order_by(*order[sort])
        .limit(limit)
        .offset(offset)
    )
    counts = await _task_counts(db, org.id)
    rows = [
        _member_read(member, row_user, counts.get(member.user_id, 0), viewer=viewer)
        for member, row_user in result.all()
    ]
    return MemberPage(items=rows, total=total_count, limit=limit, offset=offset)


async def update_member(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    target_user_id,
    payload: MemberUpdate,
) -> MemberRead:
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))

    target, target_user = await _member_row(db, org.id, target_user_id, actor)
    _ensure_can_touch_target(actor, target)
    if target.status != MemberStatus.active:
        raise conflict(
            "This member is deactivated. Reactivate them first.", code=MEMBER_NOT_ACTIVE
        )

    data = payload.model_dump(exclude_unset=True)
    if "role" in data and data["role"] != target.role:
        if data["role"] == OrgRole.owner:
            # Item 12: ownership moves ONLY through transfer-ownership,
            # which demotes the outgoing owner in the same transaction.
            raise AppException(
                OWNER_VIA_TRANSFER_ONLY,
                "Use the transfer-ownership endpoint to make someone an owner.",
                422,
            )
        await _ensure_not_last_owner(db, org.id, target)
        activity_service.record(
            db,
            event_type=ActivityEventType.role_changed,
            org_id=org.id,
            actor_id=actor.user_id,
            entity_type="member",
            entity_id=target.user_id,
            summary=(
                f"{user.display_name or 'Someone'} changed "
                f"{target_user.display_name}'s role from {target.role.value} "
                f"to {data['role'].value}."
            ),
            data={"from": target.role.value, "to": data["role"].value},
        )
    for field, value in data.items():
        setattr(target, field, value)
    await db.commit()
    counts = await _task_counts(db, org.id)
    return _member_read(target, target_user, counts.get(target.user_id, 0), viewer=actor)


async def _set_member_status(
    db: AsyncSession,
    actor: OrganizationMember,
    actor_user: User,
    target: OrganizationMember,
    target_user: User,
    *,
    active: bool,
) -> OrganizationMember:
    """Shared deactivate/reactivate transition (single and bulk)."""
    want = MemberStatus.active if active else MemberStatus.deactivated
    if target.status == want:
        raise conflict(
            f"{target_user.display_name} is already {want.value}.",
            code=MEMBER_NOT_ACTIVE,
        )
    if not active:
        # Deactivation removes access, so it is subject to every
        # ownership rule. Reactivation is harmless and only checks that
        # the row is currently deactivated.
        _ensure_can_touch_target(actor, target)
        await _ensure_not_last_owner(db, actor.org_id, target)
    target.status = want
    activity_service.record(
        db,
        event_type=(
            ActivityEventType.member_reactivated if active else ActivityEventType.member_deactivated
        ),
        org_id=actor.org_id,
        actor_id=actor_user.id,
        entity_type="member",
        entity_id=target.user_id,
        summary=(
            f"{actor_user.display_name or 'Someone'} "
            f"{'reactivated' if active else 'deactivated'} {target_user.display_name}."
        ),
    )
    return target


async def deactivate_member(
    db: AsyncSession, user: User, org_id, target_user_id  # noqa: ANN001
) -> MemberRead:
    """Item 1: access ends immediately. ``require_membership`` filters on
    ``status == active``, so every organization endpoint refuses this user
    from the next request onward; their rows and history stay."""
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))
    target, target_user = await _member_row(db, org.id, target_user_id, actor)
    if target.status != MemberStatus.active:
        raise conflict(
            f"{target_user.display_name} is not an active member.", code=MEMBER_NOT_ACTIVE
        )
    await _set_member_status(db, actor, user, target, target_user, active=False)
    await db.commit()
    counts = await _task_counts(db, org.id)
    return _member_read(target, target_user, counts.get(target.user_id, 0), viewer=actor)


async def reactivate_member(
    db: AsyncSession, user: User, org_id, target_user_id  # noqa: ANN001
) -> MemberRead:
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))
    target, target_user = await _member_row(db, org.id, target_user_id, actor)
    if target.status != MemberStatus.deactivated:
        raise conflict(
            f"{target_user.display_name} is not deactivated.", code=MEMBER_NOT_ACTIVE
        )
    await _set_member_status(db, actor, user, target, target_user, active=True)
    await db.commit()
    counts = await _task_counts(db, org.id)
    return _member_read(target, target_user, counts.get(target.user_id, 0), viewer=actor)


async def _unassign_tasks(db: AsyncSession, org_id, user_id) -> int:  # noqa: ANN001
    """Item 11: the remove dialog promises the member's tasks are
    unassigned. Done in the same transaction as the removal; comments and
    history are untouched (they are different tables)."""
    result = await db.execute(
        select(Task).where(
            Task.org_id == org_id,
            Task.assignee_id == user_id,
            Task.deleted_at.is_(None),
        )
    )
    tasks = list(result.scalars().all())
    for task in tasks:
        task.assignee_id = None
    return len(tasks)


async def remove_member(
    db: AsyncSession, user: User, org_id, target_user_id  # noqa: ANN001
) -> None:
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))
    target, target_user = await _member_row(db, org.id, target_user_id, actor)
    _ensure_can_touch_target(actor, target)
    await _ensure_not_last_owner(db, org.id, target)
    unassigned = await _unassign_tasks(db, org.id, target.user_id)
    target.deleted_at = datetime.now(UTC)
    target.status = MemberStatus.deactivated
    activity_service.record(
        db,
        event_type=ActivityEventType.member_removed,
        org_id=org.id,
        actor_id=actor.user_id,
        entity_type="member",
        entity_id=target.user_id,
        summary=(
            f"{user.display_name or 'Someone'} removed {target_user.display_name} "
            f"from the team ({unassigned} task(s) unassigned)."
        ),
        data={"unassigned_tasks": unassigned},
    )
    await db.commit()


async def bulk_member_action(
    db: AsyncSession, user: User, org_id, payload: BulkMemberAction  # noqa: ANN001
) -> BulkMemberResult:
    """Item 4: one request, one transaction, all-or-nothing.

    Every target is checked with exactly the single-action rules, and a
    refusal on ANY target aborts the whole batch — the caller re-sends a
    corrected list. Partial success would leave the page guessing which
    half applied.
    """
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))

    rows = []
    for user_id in payload.user_ids:
        target, target_user = await _member_row(db, org.id, user_id, actor)
        rows.append((target, target_user))

    # Validate everything BEFORE mutating, so an abort leaves no trace.
    for target, target_user in rows:
        if payload.action == "reactivate":
            if target.status != MemberStatus.deactivated:
                raise conflict(
                    f"{target_user.display_name} is not deactivated.", code=MEMBER_NOT_ACTIVE
                )
            continue
        if payload.action == "deactivate" and target.status != MemberStatus.active:
            raise conflict(
                f"{target_user.display_name} is not an active member.",
                code=MEMBER_NOT_ACTIVE,
            )
        # remove is allowed for an active OR a deactivated member (otherwise
        # a deactivated person could never be cleaned up).
        _ensure_can_touch_target(actor, target)
        await _ensure_not_last_owner(db, org.id, target)

    for target, target_user in rows:
        if payload.action == "remove":
            unassigned = await _unassign_tasks(db, org.id, target.user_id)
            target.deleted_at = datetime.now(UTC)
            target.status = MemberStatus.deactivated
            activity_service.record(
                db,
                event_type=ActivityEventType.member_removed,
                org_id=org.id,
                actor_id=actor.user_id,
                entity_type="member",
                entity_id=target.user_id,
                summary=(
                    f"{user.display_name or 'Someone'} removed "
                    f"{target_user.display_name} from the team "
                    f"({unassigned} task(s) unassigned)."
                ),
                data={"unassigned_tasks": unassigned, "bulk": True},
            )
        else:
            await _set_member_status(
                db,
                actor,
                user,
                target,
                target_user,
                active=payload.action == "reactivate",
            )
    await db.commit()

    counts = await _task_counts(db, org.id)
    return BulkMemberResult(
        action=payload.action,
        affected=len(rows),
        members=[
            _member_read(target, target_user, counts.get(target.user_id, 0), viewer=actor)
            for target, target_user in rows
        ],
    )


async def transfer_ownership(
    db: AsyncSession, user: User, org_id, payload: TransferOwnership  # noqa: ANN001
) -> list[MemberRead]:
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user)
    if actor.role != OrgRole.owner:
        raise forbidden("Only the owner can transfer ownership.")
    if payload.user_id == actor.user_id:
        raise conflict("You already own this organization.")

    target, target_user = await _member_row(db, org.id, payload.user_id, actor)
    if target.status != MemberStatus.active:
        raise conflict(
            f"{target_user.display_name} is not an active member.", code=MEMBER_NOT_ACTIVE
        )

    target.role = OrgRole.owner
    actor.role = OrgRole.admin
    activity_service.record(
        db,
        event_type=ActivityEventType.ownership_transferred,
        org_id=org.id,
        actor_id=actor.user_id,
        entity_type="member",
        entity_id=target.user_id,
        summary=(
            f"{user.display_name or 'Someone'} transferred ownership to "
            f"{target_user.display_name} and became an admin."
        ),
    )
    await db.commit()
    page = await list_members(db, user, org.id, status="active", limit=50, offset=0)
    return page.items


async def team_summary(
    db: AsyncSession, user: User, org_id  # noqa: ANN001
) -> TeamSummary:
    """The three counter cards in one query each (item 6).

    ``open_jobs_count`` is null until Step 7a creates ``jobs``: the page
    then shows an empty state rather than the old hard-coded 3.
    """
    org = await org_or_404(db, org_id)
    viewer = await require_membership(db, org.id, user)

    active = await _active_member_count(db, org.id)
    deactivated = await db.execute(
        select(func.count(OrganizationMember.id)).where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.status == MemberStatus.deactivated,
        )
    )
    pending = await db.execute(
        select(func.count(OrganizationInvite.id)).where(
            OrganizationInvite.org_id == org.id,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.revoked_at.is_(None),
        )
    )
    return TeamSummary(
        active_members=active,
        pending_invites=int(pending.scalar_one()),
        open_jobs_count=None,
        deactivated_members=int(deactivated.scalar_one()),
        my_role=viewer.role,
    )


async def export_members_csv(db: AsyncSession, user: User, org_id) -> str:  # noqa: ANN001
    """Item 9: the whole team as CSV, owner/admin only.

    Built server-side so it is not limited to one loaded page. Deliberately
    excludes ``phone`` and every other private field; cells are escaped
    against spreadsheet formula injection.
    """
    org = await org_or_404(db, org_id)
    await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))
    result = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.deleted_at.is_(None),
            User.deleted_at.is_(None),
        )
        .order_by(OrganizationMember.joined_at)
    )

    def cell(value: object) -> str:
        text = "" if value is None else str(value)
        # A leading =, +, - or @ is executed by spreadsheet software.
        if text[:1] in ("=", "+", "-", "@"):
            text = "'" + text
        return '"' + text.replace('"', '""') + '"'

    header = ["name", "email", "role", "status", "title", "department", "founder", "joined_at"]
    lines = [",".join(header)]
    for member, row_user in result.all():
        lines.append(
            ",".join(
                cell(value)
                for value in (
                    row_user.display_name,
                    row_user.primary_email,
                    member.role.value,
                    member.status.value,
                    member.title,
                    member.department.value if member.department else None,
                    "yes" if member.is_founder else "no",
                    member.joined_at.isoformat() if member.joined_at else None,
                )
            )
        )
    return "\n".join(lines) + "\n"


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
        message=invite.message,
        is_public=invite.is_public,
        token=token,
    )


def _invite_body(org: Organization, inviter: str, invite: OrganizationInvite, token: str) -> str:
    """The invite email body. One template, used by create and resend."""
    link = f"{get_settings().FRONTEND_BASE_URL.rstrip('/')}/invites/{token}"
    lines = [
        f"{inviter} invited you to join {org.name} on Forma.",
        "",
        f"Accept the invite: {link}",
        "",
        f"This link expires on {invite.expires_at:%d %b %Y} and can be used once.",
    ]
    if invite.message:
        lines += ["", f"Message from {inviter}:", invite.message]
    lines += [
        "",
        "If you were not expecting this, you can ignore this email.",
    ]
    return "\n".join(lines)


def _send_invite_email(
    background_tasks: BackgroundTasks | None,
    org: Organization,
    inviter: str,
    invite: OrganizationInvite,
    token: str,
) -> None:
    """Queue the invite mail without blocking the request (item 3)."""
    subject = f"{inviter} invited you to {org.name} on Forma"
    body = _invite_body(org, inviter, invite, token)
    if background_tasks is not None:
        background_tasks.add_task(email_service.safe_send_email, invite.email, subject, body)
    else:  # pragma: no cover - every router passes background tasks
        raise RuntimeError("background_tasks is required to send invite email")


async def create_invite(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    payload: InviteCreate,
    *,
    background_tasks: BackgroundTasks | None = None,
) -> InviteRead:
    org = await org_or_404(db, org_id)
    await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))

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

    # Item 15: an unresolved pending invite for the same address is a clear
    # conflict, not a silent second token (the old one would go dead with
    # no way for the inviter to know which link works).
    pending = await db.execute(
        select(OrganizationInvite).where(
            OrganizationInvite.org_id == org.id,
            OrganizationInvite.email == email,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.revoked_at.is_(None),
        )
    )
    pending_invite = pending.scalar_one_or_none()
    if pending_invite is not None:
        raise conflict(
            "An invite is already pending for that email. Resend it instead.",
            code=INVITE_NOT_PENDING,
        )

    token = secrets.token_urlsafe(32)
    invite = OrganizationInvite(
        org_id=org.id,
        email=email,
        role=payload.role,
        title=payload.title,
        department=payload.department,
        message=payload.message,
        is_public=payload.is_public,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        invited_by=user.id,
        expires_at=datetime.now(UTC) + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invite)
    activity_service.record(
        db,
        event_type=ActivityEventType.invite_created,
        org_id=org.id,
        actor_id=user.id,
        entity_type="invite",
        entity_id=invite.id,
        summary=f"{user.display_name or 'Someone'} invited {email} as {payload.role.value}.",
    )
    await db.commit()
    _send_invite_email(background_tasks, org, user.display_name or "A teammate", invite, token)
    return _invite_read(invite, token=token)


async def resend_invite(
    db: AsyncSession,
    user: User,
    org_id,  # noqa: ANN001
    invite_id,  # noqa: ANN001
    *,
    background_tasks: BackgroundTasks | None = None,
) -> InviteRead:
    """Item 2: issue a NEW token, extend expiry, mail it again.

    The old link dies the moment this commits because ``token_hash`` is
    replaced — tokens stay hashed and single use. Rate limited per invite
    and per organization so a resend cannot be used to spam an address.
    """
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))

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

    settings = get_settings()
    if not await rate_limiter.check(
        f"invite_resend:invite:{invite.id}",
        settings.INVITE_RESEND_LIMIT,
        settings.INVITE_RESEND_WINDOW_SECONDS,
    ):
        raise rate_limited("This invite was resent recently. Please try again later.")
    if not await rate_limiter.check(
        f"invite_resend:org:{org.id}",
        settings.INVITE_RESEND_ORG_LIMIT,
        settings.INVITE_RESEND_ORG_WINDOW_SECONDS,
    ):
        raise rate_limited("Too many invite resends for this team. Please try again later.")

    token = secrets.token_urlsafe(32)
    invite.token_hash = hashlib.sha256(token.encode()).hexdigest()
    invite.expires_at = datetime.now(UTC) + timedelta(days=INVITE_TTL_DAYS)
    activity_service.record(
        db,
        event_type=ActivityEventType.invite_resent,
        org_id=org.id,
        actor_id=actor.user_id,
        entity_type="invite",
        entity_id=invite.id,
        summary=f"{user.display_name or 'Someone'} resent the invite to {invite.email}.",
    )
    await db.commit()
    _send_invite_email(background_tasks, org, user.display_name or "A teammate", invite, token)
    return _invite_read(invite, token=token)


async def list_invites(
    db: AsyncSession, user: User, org_id  # noqa: ANN001
) -> list[InviteRead]:
    org = await org_or_404(db, org_id)
    await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))
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
    actor = await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))
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
    activity_service.record(
        db,
        event_type=ActivityEventType.invite_revoked,
        org_id=org.id,
        actor_id=actor.user_id,
        entity_type="invite",
        entity_id=invite.id,
        summary=f"{user.display_name or 'Someone'} revoked the invite to {invite.email}.",
    )
    await db.commit()


async def bulk_revoke_invites(
    db: AsyncSession, user: User, org_id, payload: BulkInviteRevoke  # noqa: ANN001
) -> BulkInviteResult:
    """Item 4 for invites: all-or-nothing, same transaction, same scope."""
    org = await org_or_404(db, org_id)
    actor = await require_membership(db, org.id, user, roles=set(TEAM_MANAGERS))

    result = await db.execute(
        select(OrganizationInvite).where(
            OrganizationInvite.id.in_(payload.invite_ids),
            OrganizationInvite.org_id == org.id,
            OrganizationInvite.accepted_at.is_(None),
            OrganizationInvite.revoked_at.is_(None),
        )
    )
    invites = list(result.scalars().all())
    if len(invites) != len(payload.invite_ids):
        # One or more ids were not pending invites of THIS organization.
        raise not_found("One or more invites are no longer pending.")

    now = datetime.now(UTC)
    for invite in invites:
        invite.revoked_at = now
        activity_service.record(
            db,
            event_type=ActivityEventType.invite_revoked,
            org_id=org.id,
            actor_id=actor.user_id,
            entity_type="invite",
            entity_id=invite.id,
            summary=(
                f"{user.display_name or 'Someone'} revoked the invite to {invite.email}."
            ),
            data={"bulk": True},
        )
    await db.commit()
    return BulkInviteResult(revoked=len(invites))


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
            # Item 3: the invite's visibility choice travels to the member.
            is_public=invite.is_public,
            invited_by=invite.invited_by,
            invited_email=invite.email,
            joined_at=now,
            last_active_at=now,
        )
    )
    invite.accepted_at = now
    # An invited member joins an existing organization; mark onboarding completed
    # so they are not forced through the founder company-creation wizard.
    if user.onboarding_step != "completed":
        user.onboarding_step = "completed"

    # Ensure the user holds the matching platform role for this organization type
    # so they can access the workspace (e.g. /startup/*).
    needed_role = _TYPE_ROLE.get(org.type)
    if needed_role:
        existing_role = await db.execute(
            select(UserRoleRow).where(
                UserRoleRow.user_id == user.id,
                UserRoleRow.role == needed_role,
            )
        )
        if existing_role.scalar_one_or_none() is None:
            db.add(UserRoleRow(user_id=user.id, role=needed_role, is_primary=False))

    await db.commit()
    return await get_organization(db, user, org.id)
