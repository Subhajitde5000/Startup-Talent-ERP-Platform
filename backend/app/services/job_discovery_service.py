"""Shared public/authenticated discovery with independent applicant-safe projection."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import func, literal, or_, select
from sqlalchemy.dialects.postgresql import REGCONFIG
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import not_found
from app.models.job import Job, JobSkill
from app.models.job_application import JobApplication
from app.models.organization import Organization, OrganizationMember
from app.models.profile import Skill
from app.models.startup import StartupProfile
from app.models.user import User, UserRole, UserRoleRow
from app.schemas.job_application import ApplicationStage
from app.schemas.job_discovery import (
    HiringCompany,
    HiringCompanyPage,
    HiringStartupSearch,
    JobSearch,
    MarketplaceJob,
    MarketplaceJobPage,
)
from app.schemas.job_screening import questions
from app.services import discovery_service, job_service, startup_profile_service


async def seeker(db: AsyncSession, user: User | None) -> bool:
    if user is None:
        return False
    return bool(
        (
            await db.execute(
                select(UserRoleRow.user_id).where(
                    UserRoleRow.user_id == user.id,
                    UserRoleRow.role == UserRole.jobseeker,
                    UserRoleRow.revoked_at.is_(None),
                )
            )
        ).first()
    )


async def audience(db: AsyncSession, user: User | None) -> list[str]:
    return ["public", "platform_members"] if await seeker(db, user) else ["public"]


def base(visibility: list[str], *, detail: bool = False):
    return (
        select(Job, Organization)
        .join(Organization, Organization.id == Job.org_id)
        .where(
            Job.deleted_at.is_(None),
            Job.visibility.in_(visibility),
            Job.status.in_(["open", "paused", "closed"] if detail else ["open"]),
            Organization.deleted_at.is_(None),
            Organization.status == "active",
            Organization.type.in_(["employer", "startup"]),
        )
    )


async def company_reads(
    db: AsyncSession, user: User | None, orgs: list[Organization]
) -> dict[uuid.UUID, HiringCompany]:
    if not orgs:
        return {}
    ids = [o.id for o in orgs]
    viewer = await discovery_service.resolve_viewer(db, user)
    profiles = {
        p.org_id: p
        for p in (
            await db.execute(
                select(StartupProfile).where(
                    StartupProfile.org_id.in_(ids), discovery_service.visible_clause(viewer)
                )
            )
        ).scalars()
    }
    visibility = await audience(db, user)
    counts = dict(
        (
            await db.execute(
                select(Job.org_id, func.count())
                .where(
                    Job.org_id.in_(ids),
                    Job.deleted_at.is_(None),
                    Job.status == "open",
                    Job.visibility.in_(visibility),
                )
                .group_by(Job.org_id)
            )
        ).all()
    )
    result = {}
    for org in orgs:
        profile = profiles.get(org.id)
        summary = org.summary if org.type == "employer" else None
        mission = None
        if profile:
            sections = startup_profile_service.section_values(org, profile, visible=True)
            summary = sections["summary"]
            mission = sections["mission"]
        result[org.id] = HiringCompany(
            **{
                k: getattr(org, k)
                for k in (
                    "id",
                    "name",
                    "slug",
                    "type",
                    "logo_url",
                    "website",
                    "city",
                    "region",
                    "country",
                    "founded_year",
                )
            },
            summary=summary,
            tagline=profile.tagline if profile else None,
            mission=mission,
            stage=profile.stage if profile else None,
            sector=profile.sector if profile else None,
            verified=org.verified_at is not None,
            open_jobs_count=counts.get(org.id, 0),
        )
    return result


async def reads(db: AsyncSession, user: User | None, pairs) -> list[MarketplaceJob]:
    companies = await company_reads(db, user, list({org.id: org for _, org in pairs}.values()))
    # Existing batched skills/benefits loader, but never serialize its internal shape directly.
    internal = await job_service._reads(db, [job for job, _ in pairs])
    is_seeker = await seeker(db, user)
    now = datetime.now(UTC)
    member_orgs = set()
    if user:
        member_orgs = set(
            (
                await db.execute(
                    select(OrganizationMember.org_id).where(
                        OrganizationMember.user_id == user.id,
                        OrganizationMember.status == "active",
                        OrganizationMember.deleted_at.is_(None),
                    )
                )
            ).scalars()
        )
    applications = {}
    if is_seeker and user and pairs:
        applications = {
            row.job_id: row
            for row in (
                await db.execute(
                    select(JobApplication).where(
                        JobApplication.applicant_id == user.id,
                        JobApplication.job_id.in_([job.id for job, _ in pairs]),
                        JobApplication.deleted_at.is_(None),
                    )
                )
            ).scalars()
        }
    results = []
    for (job, org), detail in zip(pairs, internal, strict=True):
        deadline = getattr(job, "application_deadline", None)
        if deadline and deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=UTC)
        data = {
            k: getattr(detail, k)
            for k in (
                "id",
                "title",
                "description",
                "responsibilities",
                "requirements",
                "what_we_offer",
                "department",
                "location",
                "work_mode",
                "employment_type",
                "status",
                "currency",
                "salary_period",
                "equity_min_pct",
                "equity_max_pct",
                "experience_min_yrs",
                "experience_max_yrs",
                "openings",
                "posted_at",
                "skills",
                "benefits",
            )
        }
        results.append(
            MarketplaceJob(
                **data,
                company=companies[org.id],
                salary_min=job.salary_min if job.show_salary_publicly else None,
                salary_max=job.salary_max if job.show_salary_publicly else None,
                salary_visible=job.show_salary_publicly,
                application_deadline=deadline,
                screening_questions=questions(job.screening_questions),
                own_application_id=applications[job.id].id if job.id in applications else None,
                own_application_stage=cast(ApplicationStage, applications[job.id].stage)
                if job.id in applications
                else None,
                can_apply=is_seeker
                and user is not None
                and user.status == "active"
                and user.email_verified_at is not None
                and job.id not in applications
                and org.id not in member_orgs
                and job.status == "open"
                and (deadline is None or now < deadline),
            )
        )
    return results


async def get_pair(db: AsyncSession, user: User | None, job_id: uuid.UUID, *, lock: bool = False):
    visibility = await audience(db, user)
    if await seeker(db, user):
        visibility.append("link_only")
    stmt = base(visibility, detail=True).where(Job.id == job_id)
    if lock:
        stmt = stmt.with_for_update(of=Job).execution_options(populate_existing=True)
    pair = (await db.execute(stmt)).first()
    if pair is None:
        raise not_found("Job not found.")
    return pair


async def detail(db: AsyncSession, user: User | None, job_id: uuid.UUID) -> MarketplaceJob:
    return (await reads(db, user, [await get_pair(db, user, job_id)]))[0]


async def search(db: AsyncSession, user: User | None, query: JobSearch) -> MarketplaceJobPage:
    stmt = base(await audience(db, user))
    for column, value in (
        (Job.org_id, query.org_id),
        (Organization.type, query.org_type),
        (Job.work_mode, query.work_mode),
        (Job.employment_type, query.employment_type),
        (Job.department, query.department),
    ):
        if value is not None:
            stmt = stmt.where(column == value)
    for column, values in (
        (Job.work_mode, query.work_modes),
        (Job.employment_type, query.employment_types),
    ):
        if values:
            stmt = stmt.where(column.in_(values))
    if query.verified_only:
        stmt = stmt.where(Organization.verified_at.is_not(None))
    if query.stage or query.stages or query.sector:
        viewer = await discovery_service.resolve_viewer(db, user)
        profile = select(StartupProfile.org_id).where(discovery_service.visible_clause(viewer))
        if query.stage:
            profile = profile.where(StartupProfile.stage == query.stage)
        if query.stages:
            profile = profile.where(StartupProfile.stage.in_(query.stages))
        if query.sector:
            profile = profile.where(
                func.lower(StartupProfile.sector) == query.sector.strip().lower()
            )
        stmt = stmt.where(Job.org_id.in_(profile))
    if query.location:
        pattern = f"%{job_service._escape_like(query.location.strip())}%"
        stmt = stmt.where(
            or_(
                Job.location.ilike(pattern, escape="\\"),
                Job.work_mode == query.location.strip().lower(),
            )
        )
    for years_column, years_value, lower in (
        (Job.experience_max_yrs, query.experience_min, True),
        (Job.experience_min_yrs, query.experience_max, False),
    ):
        if years_value is not None:
            stmt = stmt.where(years_column >= years_value if lower else years_column <= years_value)
    if query.salary_min is not None or query.salary_max is not None or query.sort == "salary":
        stmt = stmt.where(
            Job.show_salary_publicly.is_(True),
            Job.currency == query.currency,
            Job.salary_period == query.salary_period,
            or_(Job.salary_min.is_not(None), Job.salary_max.is_not(None)),
        )
    if query.salary_min is not None:
        stmt = stmt.where(func.coalesce(Job.salary_max, Job.salary_min) >= query.salary_min)
    if query.salary_max is not None:
        stmt = stmt.where(func.coalesce(Job.salary_min, Job.salary_max) <= query.salary_max)
    if query.equity_only:
        stmt = stmt.where(func.coalesce(Job.equity_max_pct, Job.equity_min_pct, 0) > 0)
    if query.posted_days:
        stmt = stmt.where(Job.posted_at >= datetime.now(UTC) - timedelta(days=query.posted_days))
    ids = set(query.skill_ids)
    if ids:
        matched = (
            select(JobSkill.job_id).where(JobSkill.skill_id.in_(ids)).group_by(JobSkill.job_id)
        )
        if query.skills_match == "all":
            matched = matched.having(func.count() == len(ids))
        stmt = stmt.where(Job.id.in_(matched))
    rank: Any = literal(0)
    match: Any
    if query.q and query.q.strip():
        text = query.q.strip()
        skill_names = select(JobSkill.job_id).join(Skill, Skill.id == JobSkill.skill_id)
        if db.get_bind().dialect.name == "postgresql":
            # Literal regconfig and expression exactly match the migration's GIN index.
            vector = func.to_tsvector(
                literal("simple").cast(REGCONFIG),
                func.coalesce(Job.title, "")
                + " "
                + func.coalesce(Job.description, "")
                + " "
                + func.coalesce(Job.requirements, ""),
            )
            terms = func.plainto_tsquery("simple", text)
            match = vector.op("@@")(terms)
            rank = func.ts_rank(vector, terms)
        else:
            pattern = f"%{job_service._escape_like(text)}%"
            match = or_(
                Job.title.ilike(pattern, escape="\\"),
                Job.description.ilike(pattern, escape="\\"),
                Job.requirements.ilike(pattern, escape="\\"),
            )
        pattern = f"%{job_service._escape_like(text)}%"
        stmt = stmt.where(
            or_(
                match,
                Organization.name.ilike(pattern, escape="\\"),
                Job.id.in_(skill_names.where(Skill.name.ilike(pattern, escape="\\"))),
            )
        )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    order: Any = {
        "relevance": rank.desc(),
        "newest": Job.posted_at.desc(),
        "salary": func.coalesce(Job.salary_max, Job.salary_min).desc(),
        "deadline": Job.application_deadline.asc(),
    }.get(query.sort)
    pairs = (
        await db.execute(
            stmt.order_by(order.nulls_last(), Job.id.desc()).limit(query.limit).offset(query.offset)
        )
    ).all()
    return MarketplaceJobPage(
        items=await reads(db, user, pairs),
        total=total,
        limit=query.limit,
        offset=query.offset,
        has_more=query.offset + len(pairs) < total,
    )


async def company(db: AsyncSession, user: User | None, org_id: uuid.UUID) -> HiringCompany:
    # A hiring page is not a back door into arbitrary/private organizations.
    pair = (
        await db.execute(base(await audience(db, user)).where(Organization.id == org_id).limit(1))
    ).first()
    if pair is None:
        raise not_found("Company not found.")
    return (await company_reads(db, user, [pair[1]]))[org_id]


async def startups(
    db: AsyncSession, user: User | None, query: HiringStartupSearch
) -> HiringCompanyPage:
    viewer = await discovery_service.resolve_viewer(db, user)
    # Reuse discovery/profile audience gates; only visible startups with visible open jobs.
    stmt = discovery_service._base_query(viewer).where(
        Organization.id.in_(
            select(Job.org_id).where(
                Job.deleted_at.is_(None),
                Job.status == "open",
                Job.visibility.in_(await audience(db, user)),
            )
        )
    )
    stmt = discovery_service._apply_filters(
        stmt,
        stage=query.stage,
        sector=query.sector,
        city=query.location,
        terms=[],
    )
    # Never search section-gated pitch text: even match/no-match can leak it.
    for term in discovery_service._terms(query.q):
        pattern = f"%{job_service._escape_like(term)}%"
        stmt = stmt.where(
            or_(
                Organization.name.ilike(pattern, escape="\\"),
                Organization.city.ilike(pattern, escape="\\"),
                StartupProfile.tagline.ilike(pattern, escape="\\"),
                StartupProfile.sector.ilike(pattern, escape="\\"),
            )
        )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    orgs = [
        r[0]
        for r in (
            await db.execute(
                stmt.order_by(Organization.name, Organization.id)
                .limit(query.limit)
                .offset(query.offset)
            )
        ).all()
    ]
    mapped = await company_reads(db, user, orgs)
    return HiringCompanyPage(
        items=list(mapped.values()),
        total=total,
        limit=query.limit,
        offset=query.offset,
        has_more=query.offset + len(orgs) < total,
    )
