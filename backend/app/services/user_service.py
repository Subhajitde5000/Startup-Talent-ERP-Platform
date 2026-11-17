"""User service: read own profile (object-level: only self)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRoleRow
from app.schemas.profile import UserMeRead


async def get_me(db: AsyncSession, user: User) -> UserMeRead:
    roles_result = await db.execute(
        select(UserRoleRow).where(UserRoleRow.user_id == user.id, UserRoleRow.revoked_at.is_(None))
    )
    roles = roles_result.scalars().all()
    role_names = [r.role.value for r in roles]
    primary = next((r.role.value for r in roles if r.is_primary), None)
    return UserMeRead(
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
        handle=user.handle,
        avatar_url=user.avatar_url,
        avatar_initials=user.avatar_initials,
        phone=user.phone,
        locale=user.locale,
        timezone=user.timezone,
        region=user.region,
        onboarding_step=user.onboarding_step,
        linkedin_url=user.linkedin_url,
        github_url=user.github_url,
        twitter_url=user.twitter_url,
        website_url=user.website_url,
        headline=user.headline,
        bio=user.bio,
        education=user.education,
        prior_role=user.prior_role,
        founder_vision=user.founder_vision,
        din_number=user.din_number,
        profile_public=user.profile_public,
        allow_outreach=user.allow_outreach,
    )
