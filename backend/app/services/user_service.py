"""User service: read own profile (object-level: only self)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRoleRow
from app.schemas.auth import UserRead


async def get_me(db: AsyncSession, user: User) -> UserRead:
    roles_result = await db.execute(
        select(UserRoleRow).where(UserRoleRow.user_id == user.id, UserRoleRow.revoked_at.is_(None))
    )
    roles = roles_result.scalars().all()
    role_names = [r.role.value for r in roles]
    primary = next((r.role.value for r in roles if r.is_primary), None)
    return UserRead(
        id=user.id,
        email=user.primary_email,
        display_name=user.display_name,
        status=user.status.value,
        verification=user.verification.value,
        email_verified_at=user.email_verified_at,
        roles=role_names,
        primary_role=primary,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )
