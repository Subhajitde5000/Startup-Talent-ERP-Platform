"""Resume builder service (Step 7n, job-seeker side).

Every resume is strictly scoped to ``user_id == current_user.id`` and
``deleted_at IS NULL``. Foreign or soft-deleted resumes always return 404
(no existence oracle). Server-controlled fields (``user_id``, ``ats_score``,
``is_default``, ``source``, ``created_at``, ``updated_at``, ``deleted_at``)
are never accepted from client payloads.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.exceptions import not_found, rate_limited, validation_error
from app.models.profile import Skill
from app.models.resume import (
    Resume,
    ResumeEducation,
    ResumeExperience,
    ResumeSkill,
)
from app.models.talent import TalentProfile
from app.models.user import User
from app.schemas.resume import (
    ResumeCreate,
    ResumeEducationIn,
    ResumeExperienceIn,
    ResumeUpdate,
)
from app.services import job_application_service
from app.services.rate_limiter import rate_limiter

require_seeker = job_application_service.require_seeker


async def _rate_limit(user: User, limit: int, window: int, kind: str) -> None:
    if not await rate_limiter.check(f"resumes:{kind}:{user.id}", limit, window):
        raise rate_limited("Too many requests. Please slow down.")


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def owned_resume_or_404(
    db: AsyncSession,
    user: User,
    resume_id: uuid.UUID,
    *,
    with_sections: bool = True,
) -> Resume:
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.user_id == user.id,
        Resume.deleted_at.is_(None),
    )
    if with_sections:
        stmt = stmt.options(
            selectinload(Resume.experiences),
            selectinload(Resume.education),
            selectinload(Resume.skills),
        )
    resume = (await db.execute(stmt)).scalar_one_or_none()
    if resume is None:
        raise not_found("Resume not found.")
    return resume


async def _skills_by_id(db: AsyncSession, skill_ids: list[uuid.UUID]) -> dict[uuid.UUID, Skill]:
    if not skill_ids:
        return {}
    rows = (await db.execute(select(Skill).where(Skill.id.in_(skill_ids)))).scalars().all()
    return {row.id: row for row in rows}


async def serialize_resume(db: AsyncSession, resume: Resume) -> dict:
    skill_ids = [s.skill_id for s in resume.skills]
    skill_map = await _skills_by_id(db, skill_ids)
    skills_out = [
        {
            "id": skill.id,
            "name": skill.name,
            "category": skill.category,
        }
        for sid in skill_ids
        if (skill := skill_map.get(sid)) is not None
    ]
    return {
        "id": resume.id,
        "title": resume.title,
        "target_role": resume.target_role,
        "template": resume.template,
        "source": resume.source,
        "ats_score": resume.ats_score,
        "is_default": resume.is_default,
        "summary": resume.summary,
        "experiences": [
            {
                "id": exp.id,
                "role_title": exp.role_title,
                "company": exp.company,
                "period_label": exp.period_label,
                "started_on": exp.started_on,
                "ended_on": exp.ended_on,
                "bullets": list(exp.bullets or []),
                "display_order": exp.display_order,
                "created_at": exp.created_at,
            }
            for exp in resume.experiences
        ],
        "education": [
            {
                "id": edu.id,
                "degree": edu.degree,
                "school": edu.school,
                "year_label": edu.year_label,
                "display_order": edu.display_order,
                "created_at": edu.created_at,
            }
            for edu in resume.education
        ],
        "skills": skills_out,
        "created_at": resume.created_at,
        "updated_at": resume.updated_at,
    }


def _serialize_list_item(resume: Resume) -> dict:
    return {
        "id": resume.id,
        "title": resume.title,
        "target_role": resume.target_role,
        "template": resume.template,
        "source": resume.source,
        "ats_score": resume.ats_score,
        "is_default": resume.is_default,
        "created_at": resume.created_at,
        "updated_at": resume.updated_at,
    }


async def create(db: AsyncSession, user: User, payload: ResumeCreate) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_WRITE_LIMIT, settings.RESUME_WRITE_WINDOW_SECONDS, "write"
    )

    resume = Resume(
        user_id=user.id,
        title=payload.title,
        target_role=payload.target_role,
        summary=payload.summary,
        template=payload.template,
        source="manual",
        is_default=False,
    )
    db.add(resume)
    await db.commit()
    loaded = await owned_resume_or_404(db, user, resume.id)
    return await serialize_resume(db, loaded)


async def list_(
    db: AsyncSession,
    user: User,
    *,
    q: str | None = None,
    sort: str = "updated_at",
    order: str = "desc",
    limit: int = 20,
    offset: int = 0,
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_READ_LIMIT, settings.RESUME_READ_WINDOW_SECONDS, "read"
    )

    conditions = [Resume.user_id == user.id, Resume.deleted_at.is_(None)]
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        conditions.append(
            or_(
                Resume.title.ilike(pattern, escape="\\"),
                Resume.target_role.ilike(pattern, escape="\\"),
            )
        )

    sort_col = Resume.created_at if sort == "created_at" else Resume.updated_at
    order_clause = sort_col.asc() if order == "asc" else sort_col.desc()

    total = (
        await db.execute(select(func.count()).select_from(Resume).where(*conditions))
    ).scalar_one()

    rows = (
        await db.execute(
            select(Resume)
            .where(*conditions)
            .order_by(Resume.is_default.desc(), order_clause, Resume.id)
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()

    return {
        "items": [_serialize_list_item(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }


async def get(db: AsyncSession, user: User, resume_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_READ_LIMIT, settings.RESUME_READ_WINDOW_SECONDS, "read"
    )
    resume = await owned_resume_or_404(db, user, resume_id)
    return await serialize_resume(db, resume)


async def update_resume(
    db: AsyncSession, user: User, resume_id: uuid.UUID, payload: ResumeUpdate
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_WRITE_LIMIT, settings.RESUME_WRITE_WINDOW_SECONDS, "write"
    )
    resume = await owned_resume_or_404(db, user, resume_id, with_sections=False)

    fields = payload.model_fields_set
    if "title" in fields:
        if payload.title is None:
            raise validation_error(
                "Title cannot be null.",
                [{"loc": ["body", "title"], "msg": "Title cannot be null.", "type": "value_error"}],
            )
        resume.title = payload.title
    if "target_role" in fields:
        resume.target_role = payload.target_role
    if "summary" in fields:
        resume.summary = payload.summary
    if "template" in fields:
        resume.template = payload.template

    resume.updated_at = datetime.now(UTC)
    await db.commit()
    loaded = await owned_resume_or_404(db, user, resume_id)
    return await serialize_resume(db, loaded)


async def delete_resume(db: AsyncSession, user: User, resume_id: uuid.UUID) -> None:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_WRITE_LIMIT, settings.RESUME_WRITE_WINDOW_SECONDS, "write"
    )
    resume = await owned_resume_or_404(db, user, resume_id, with_sections=False)
    now = datetime.now(UTC)
    resume.deleted_at = now
    resume.is_default = False
    resume.updated_at = now

    await db.execute(
        update(TalentProfile)
        .where(TalentProfile.user_id == user.id, TalentProfile.resume_id == resume_id)
        .values(resume_id=None)
    )
    await db.commit()


async def duplicate(db: AsyncSession, user: User, resume_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_WRITE_LIMIT, settings.RESUME_WRITE_WINDOW_SECONDS, "write"
    )
    src = await owned_resume_or_404(db, user, resume_id)

    copy_title = f"{src.title} (Copy)"
    if len(copy_title) > 120:
        copy_title = copy_title[:120]

    new_resume = Resume(
        user_id=user.id,
        title=copy_title,
        target_role=src.target_role,
        summary=src.summary,
        template=src.template,
        source=src.source,
        ats_score=None,
        is_default=False,
    )
    db.add(new_resume)
    await db.flush()

    for exp in src.experiences:
        db.add(
            ResumeExperience(
                resume_id=new_resume.id,
                role_title=exp.role_title,
                company=exp.company,
                period_label=exp.period_label,
                started_on=exp.started_on,
                ended_on=exp.ended_on,
                bullets=list(exp.bullets or []),
                display_order=exp.display_order,
            )
        )
    for edu in src.education:
        db.add(
            ResumeEducation(
                resume_id=new_resume.id,
                degree=edu.degree,
                school=edu.school,
                year_label=edu.year_label,
                display_order=edu.display_order,
            )
        )
    for sk in src.skills:
        db.add(ResumeSkill(resume_id=new_resume.id, skill_id=sk.skill_id))

    await db.commit()
    loaded = await owned_resume_or_404(db, user, new_resume.id)
    return await serialize_resume(db, loaded)


async def replace_experiences(
    db: AsyncSession,
    user: User,
    resume_id: uuid.UUID,
    items: list[ResumeExperienceIn],
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_WRITE_LIMIT, settings.RESUME_WRITE_WINDOW_SECONDS, "write"
    )
    resume = await owned_resume_or_404(db, user, resume_id, with_sections=False)

    await db.execute(delete(ResumeExperience).where(ResumeExperience.resume_id == resume_id))
    for idx, item in enumerate(items):
        db.add(
            ResumeExperience(
                resume_id=resume_id,
                role_title=item.role_title,
                company=item.company,
                period_label=item.period_label,
                started_on=item.started_on,
                ended_on=item.ended_on,
                bullets=list(item.bullets),
                display_order=idx,
            )
        )
    resume.updated_at = datetime.now(UTC)
    await db.commit()
    loaded = await owned_resume_or_404(db, user, resume_id)
    return await serialize_resume(db, loaded)


async def replace_education(
    db: AsyncSession,
    user: User,
    resume_id: uuid.UUID,
    items: list[ResumeEducationIn],
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_WRITE_LIMIT, settings.RESUME_WRITE_WINDOW_SECONDS, "write"
    )
    resume = await owned_resume_or_404(db, user, resume_id, with_sections=False)

    await db.execute(delete(ResumeEducation).where(ResumeEducation.resume_id == resume_id))
    for idx, item in enumerate(items):
        db.add(
            ResumeEducation(
                resume_id=resume_id,
                degree=item.degree,
                school=item.school,
                year_label=item.year_label,
                display_order=idx,
            )
        )
    resume.updated_at = datetime.now(UTC)
    await db.commit()
    loaded = await owned_resume_or_404(db, user, resume_id)
    return await serialize_resume(db, loaded)


async def replace_skills(
    db: AsyncSession,
    user: User,
    resume_id: uuid.UUID,
    skill_ids: list[uuid.UUID],
) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_WRITE_LIMIT, settings.RESUME_WRITE_WINDOW_SECONDS, "write"
    )
    resume = await owned_resume_or_404(db, user, resume_id, with_sections=False)

    unique_ids = list(dict.fromkeys(skill_ids))
    found = await _skills_by_id(db, unique_ids)
    missing = [str(sid) for sid in unique_ids if sid not in found]
    if missing:
        raise validation_error(
            "One or more skill_ids do not exist.",
            [
                {
                    "loc": ["body", "skill_ids"],
                    "msg": f"Unknown skill_ids: {', '.join(missing)}",
                    "type": "value_error",
                }
            ],
        )

    await db.execute(delete(ResumeSkill).where(ResumeSkill.resume_id == resume_id))
    for sid in unique_ids:
        db.add(ResumeSkill(resume_id=resume_id, skill_id=sid))
    resume.updated_at = datetime.now(UTC)
    await db.commit()
    loaded = await owned_resume_or_404(db, user, resume_id)
    return await serialize_resume(db, loaded)


async def set_default(db: AsyncSession, user: User, resume_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_WRITE_LIMIT, settings.RESUME_WRITE_WINDOW_SECONDS, "write"
    )
    resume = await owned_resume_or_404(db, user, resume_id, with_sections=False)

    await db.execute(
        update(Resume)
        .where(Resume.user_id == user.id, Resume.deleted_at.is_(None), Resume.is_default.is_(True))
        .values(is_default=False)
    )
    resume.is_default = True
    resume.updated_at = datetime.now(UTC)

    await db.execute(
        update(TalentProfile)
        .where(TalentProfile.user_id == user.id)
        .values(resume_id=resume_id)
    )
    await db.commit()
    loaded = await owned_resume_or_404(db, user, resume_id)
    return await serialize_resume(db, loaded)


async def summary(db: AsyncSession, user: User) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_READ_LIMIT, settings.RESUME_READ_WINDOW_SECONDS, "read"
    )
    rows = (
        await db.execute(
            select(Resume.is_default, Resume.ats_score).where(
                Resume.user_id == user.id, Resume.deleted_at.is_(None)
            )
        )
    ).all()
    total = len(rows)
    primary_count = sum(1 for is_def, _ in rows if is_def)
    scored = [score for _, score in rows if score is not None]
    avg_ats_score = round(sum(scored) / len(scored)) if scored else None
    return {
        "total": total,
        "primary_count": primary_count,
        "avg_ats_score": avg_ats_score,
    }


async def export_json(db: AsyncSession, user: User, resume_id: uuid.UUID) -> dict:
    await require_seeker(db, user)
    settings = get_settings()
    await _rate_limit(
        user, settings.RESUME_READ_LIMIT, settings.RESUME_READ_WINDOW_SECONDS, "read"
    )
    resume = await owned_resume_or_404(db, user, resume_id)
    data = await serialize_resume(db, resume)
    data["exported_at"] = datetime.now(UTC)
    return data
