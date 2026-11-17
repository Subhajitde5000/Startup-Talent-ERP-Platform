"""Talent profile service (Step 3c): self read/patch + public view.

Object-level: read/write only ever act on the AUTHENTICATED user's own
profile (user_id comes from the dependency, never from the payload).
The public view is a SEPARATE read (part 9) that double-gates on
talent_profiles.is_searchable AND users.profile_public — either off means
404, so private profiles are indistinguishable from missing ones.
"""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Skill
from app.models.talent import TalentProfile, TalentProfileSkill
from app.models.user import User
from app.schemas.profile import (
    SkillRead,
    TalentProfileRead,
    TalentProfileUpdate,
    TalentPublicRead,
)


def _read(profile: TalentProfile, skills: list[Skill]) -> TalentProfileRead:
    return TalentProfileRead(
        user_id=profile.user_id,
        headline=profile.headline,
        summary=profile.summary,
        total_experience_yrs=(
            float(profile.total_experience_yrs)
            if profile.total_experience_yrs is not None
            else None
        ),
        current_location=profile.current_location,
        preferred_mode=profile.preferred_mode.value if profile.preferred_mode else None,
        availability=profile.availability.value,
        salary_expectation=(
            float(profile.salary_expectation)
            if profile.salary_expectation is not None
            else None
        ),
        currency=profile.currency,
        open_to_relocate=profile.open_to_relocate,
        is_searchable=profile.is_searchable,
        hide_current_employer=profile.hide_current_employer,
        skills=[SkillRead(id=s.id, name=s.name, category=s.category) for s in skills],
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


async def _skills_for(db: AsyncSession, user_id) -> list[Skill]:  # noqa: ANN001
    result = await db.execute(
        select(Skill)
        .join(TalentProfileSkill, TalentProfileSkill.skill_id == Skill.id)
        .where(TalentProfileSkill.user_id == user_id)
        .order_by(Skill.name)
    )
    return list(result.scalars().all())


async def _resolve_skills(db: AsyncSession, names: list[str]) -> list[Skill]:
    """Case-insensitive lookup; unknown names are created (the catalog is
    a shared lookup, and talent_profile_skills has an FK to skills)."""
    out: list[Skill] = []
    for name in names:
        result = await db.execute(
            select(Skill).where(func.lower(Skill.name) == name.lower())
        )
        skill = result.scalar_one_or_none()
        if skill is None:
            skill = Skill(name=name)
            db.add(skill)
            await db.flush()
        out.append(skill)
    return out


async def get_me(db: AsyncSession, user: User) -> TalentProfileRead | None:
    result = await db.execute(
        select(TalentProfile).where(TalentProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        return None
    return _read(profile, await _skills_for(db, user.id))


async def update_me(
    db: AsyncSession, user: User, payload: TalentProfileUpdate
) -> TalentProfileRead:
    result = await db.execute(
        select(TalentProfile).where(TalentProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = TalentProfile(user_id=user.id)
        db.add(profile)
        await db.flush()

    data = payload.model_dump(exclude_unset=True)
    skill_names = data.pop("skills", None)
    for field, value in data.items():
        if field in ("preferred_mode", "availability") and value is not None:
            from app.models.talent import AvailabilityMode, WorkMode

            enum_cls = WorkMode if field == "preferred_mode" else AvailabilityMode
            setattr(profile, field, enum_cls(value))
        else:
            setattr(profile, field, value)

    if skill_names is not None:
        skills = await _resolve_skills(db, skill_names)
        wanted = {s.id for s in skills}
        existing = await db.execute(
            select(TalentProfileSkill.skill_id).where(
                TalentProfileSkill.user_id == user.id
            )
        )
        current = set(existing.scalars().all())
        if current - wanted:
            await db.execute(
                delete(TalentProfileSkill).where(
                    TalentProfileSkill.user_id == user.id,
                    TalentProfileSkill.skill_id.in_(current - wanted),
                )
            )
        for skill_id in wanted - current:
            db.add(TalentProfileSkill(user_id=user.id, skill_id=skill_id))

    await db.commit()
    refreshed = await db.execute(
        select(TalentProfile).where(TalentProfile.user_id == user.id)
    )
    return _read(refreshed.scalar_one(), await _skills_for(db, user.id))


async def get_public(db: AsyncSession, handle: str) -> TalentPublicRead | None:
    """Part 9: separate public read; hidden unless BOTH gates are on."""
    result = await db.execute(
        select(User, TalentProfile)
        .join(TalentProfile, TalentProfile.user_id == User.id)
        .where(
            User.handle == handle,
            User.deleted_at.is_(None),
            TalentProfile.is_searchable.is_(True),
            User.profile_public.is_(True),
        )
    )
    row = result.one_or_none()
    if row is None:
        return None
    user, profile = row
    skills = await _skills_for(db, user.id)
    return TalentPublicRead(
        handle=user.handle or "",
        display_name=user.display_name or "",
        avatar_initials=user.avatar_initials,
        avatar_url=user.avatar_url,
        headline=profile.headline,
        summary=profile.summary,
        current_location=profile.current_location,
        preferred_mode=profile.preferred_mode.value if profile.preferred_mode else None,
        availability=profile.availability.value,
        skills=[s.name for s in skills],
    )
