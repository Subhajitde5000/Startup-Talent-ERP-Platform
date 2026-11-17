"""Skill search (read-only). POST /skills does not exist in 3a — creating
or editing the catalog is a Step 7 admin operation (item 8)."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Skill
from app.schemas.profile import SkillRead


async def search(db: AsyncSession, q: str | None, limit: int) -> list[SkillRead]:
    """Typeahead search: exact (case-insensitive) matches first, then
    prefix matches, then substring matches, alphabetical within a tier."""
    query = select(Skill)
    if q:
        needle = q.strip().lower()
        query = query.where(func.lower(Skill.name).like(f"%{needle}%"))
        # false (0) sorts first: exact matches before mere substrings
        query = query.order_by(func.lower(Skill.name) != needle, func.lower(Skill.name))
    else:
        query = query.order_by(func.lower(Skill.name))
    result = await db.execute(query.limit(limit))
    return [
        SkillRead(id=s.id, name=s.name, category=s.category) for s in result.scalars().all()
    ]
