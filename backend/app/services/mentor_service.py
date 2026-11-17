"""Mentor profile service (Step 3c): self read/patch + public view.

Object-level: reads/writes act only on the AUTHENTICATED user's own row.
The public directory read (part 9) is separate and gated on
users.profile_public — switching privacy off makes the profile 404.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.talent import MentorProfile
from app.models.user import User
from app.schemas.profile import MentorProfileRead, MentorProfileUpdate, MentorPublicRead


def _read(profile: MentorProfile) -> MentorProfileRead:
    return MentorProfileRead(
        user_id=profile.user_id,
        headline=profile.headline,
        bio=profile.bio,
        expertise=list(profile.expertise or []),
        sectors=list(profile.sectors or []),
        languages=list(profile.languages or []),
        years_experience=profile.years_experience,
        hourly_fee=float(profile.hourly_fee) if profile.hourly_fee is not None else None,
        currency=profile.currency,
        cadence=profile.cadence,
        max_startups=profile.max_startups,
        accepting_requests=profile.accepting_requests,
        rating=float(profile.rating) if profile.rating is not None else None,
        sessions_completed=profile.sessions_completed,
        is_verified=profile.is_verified,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


async def get_me(db: AsyncSession, user: User) -> MentorProfileRead | None:
    result = await db.execute(
        select(MentorProfile).where(MentorProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        return None
    return _read(profile)


async def update_me(
    db: AsyncSession, user: User, payload: MentorProfileUpdate
) -> MentorProfileRead:
    result = await db.execute(
        select(MentorProfile).where(MentorProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = MentorProfile(user_id=user.id)
        db.add(profile)
        await db.flush()

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()

    refreshed = await db.execute(
        select(MentorProfile).where(MentorProfile.user_id == user.id)
    )
    return _read(refreshed.scalar_one())


async def get_public(db: AsyncSession, handle: str) -> MentorPublicRead | None:
    """Part 9: public mentor read; 404 when profile_public is off."""
    result = await db.execute(
        select(User, MentorProfile)
        .join(MentorProfile, MentorProfile.user_id == User.id)
        .where(
            User.handle == handle,
            User.deleted_at.is_(None),
            User.profile_public.is_(True),
        )
    )
    row = result.one_or_none()
    if row is None:
        return None
    user, profile = row
    return MentorPublicRead(
        handle=user.handle or "",
        display_name=user.display_name or "",
        avatar_initials=user.avatar_initials,
        avatar_url=user.avatar_url,
        headline=profile.headline,
        bio=profile.bio,
        expertise=list(profile.expertise or []),
        sectors=list(profile.sectors or []),
        languages=list(profile.languages or []),
        years_experience=profile.years_experience,
        hourly_fee=float(profile.hourly_fee) if profile.hourly_fee is not None else None,
        currency=profile.currency,
        cadence=profile.cadence,
        max_startups=profile.max_startups,
        accepting_requests=profile.accepting_requests,
        rating=float(profile.rating) if profile.rating is not None else None,
        sessions_completed=profile.sessions_completed,
        is_verified=profile.is_verified,
    )
