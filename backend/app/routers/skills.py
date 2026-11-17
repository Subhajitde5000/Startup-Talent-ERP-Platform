"""Skills router: read-only typeahead search.

There is intentionally no POST /skills in Step 3a — the catalog is managed
by platform admins in Step 7 (item 8); GET stays public with a tight limit.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.profile import SkillRead
from app.services import skill_service

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=list[SkillRead], summary="Search skills")
async def search_skills(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=100, description="Substring to match")] = None,
    limit: Annotated[int, Query(ge=1, le=50, description="Max results (1-50)")] = 20,
) -> list[SkillRead]:
    return await skill_service.search(db, q, limit)
