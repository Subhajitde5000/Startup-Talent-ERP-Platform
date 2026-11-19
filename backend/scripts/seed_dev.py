"""Dev-only seed: demo accounts (Step 2) + profile/skills/readiness (Step 3).

Run (from backend/):

    ../.venv/bin/python scripts/seed_dev.py

- Refuses to run unless ENVIRONMENT=dev — never use this in production.
- Idempotent: existing accounts keep their values; profile fields are only
  filled where still empty, skills/readiness rows are inserted if missing.
- All seeded accounts share one dev password (printed at the end) and are
  email-verified except `pending@forma.dev`, which exists to exercise the
  verify-email / resend flow.

This replaces the old inline demo behaviour: the wired Step 3 pages stay
populated in development without any seed data living in migrations. The
demo records that used to live inline on the founder profile, readiness
and settings pages now live here.
"""

from __future__ import annotations

import asyncio
import calendar
import re
import sys
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

# Allow `python scripts/seed_dev.py` from backend/ without installing the pkg.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import async_session_factory, engine  # noqa: E402
from app.models.analytics import StartupCompetitor, StartupMarketSize  # noqa: E402
from app.models.metric import MetricKey, MetricSource, StartupMetric  # noqa: E402
from app.models.milestone import Milestone  # noqa: E402
from app.models.organization import (  # noqa: E402
    MemberStatus,
    Organization,
    OrganizationMember,
    OrgRole,
)
from app.models.profile import Skill, UserReadiness  # noqa: E402
from app.models.readiness import (  # noqa: E402
    ReadinessCriterion,
    ReadinessStatus,
    StartupReadiness,
)
from app.models.stage import StageToolProgress, ToolStatus  # noqa: E402
from app.models.startup import (  # noqa: E402
    ProfileVisibility,
    StartupProfile,
    StartupStage,
)
from app.models.talent import MentorProfile, TalentProfile, TalentProfileSkill, WorkMode  # noqa: E402
from app.models.task import Task, TaskPriority, TaskStatus  # noqa: E402
from app.models.user import AccountStatus, ReviewState, User, UserRole, UserRoleRow  # noqa: E402
from app.services import stage_service  # noqa: E402

DEV_PASSWORD = "Forma-Dev-2026!"

# Step 3 demo profile records (moved out of the wired pages' inline data).
# Only applied where the field is still NULL, so dev edits are never clobbered.
STEP3_PROFILE_FIELDS: dict[str, dict[str, object]] = {
    "founder@forma.dev": {
        "handle": "aarav_sharma",
        "headline": "Founder & Chief Executive Officer",
        "bio": (
            "Founder & CEO building cross-border GST invoicing and treasury tooling "
            "for fast-growing Indian software startups. Previously led corporate "
            "disbursements product pods at Razorpay."
        ),
        "founder_vision": (
            "Indian B2B SaaS startups compete on global stages while their back-office "
            "banking infrastructure is bogged down by manual reconciliation and slow "
            "remittances. We are automating this entire treasury workflow from code to bank."
        ),
        "education": "B.Tech in Computer Science, IIT Bombay (2018)",
        "prior_role": "Ex-Lead Product Manager @ Razorpay (Disbursements)",
        "din_number": "DIN: 08942119",
        "phone": "+91 98230 44102",
        "region": "Pune & Bengaluru, India",
        "avatar_initials": "AS",
        "linkedin_url": "https://linkedin.com/in/aarav-sharma-dev",
        "twitter_url": "https://x.com/aarav_sharma_dev",
        "github_url": "https://github.com/aarav-sharma",
        "website_url": "https://aaravsharma.dev",
        "profile_public": True,
        "allow_outreach": True,
    },
    "mentor@forma.dev": {
        "handle": "meera_iyer",
        "headline": "Senior Technology Architect & Mentor",
        "bio": "15+ years building distributed systems; mentors early-stage teams on architecture and scale.",
        "phone": "+91 98450 11223",
        "region": "Bengaluru, India",
        "avatar_initials": "MI",
        "profile_public": True,
        "allow_outreach": True,
    },
    "investor@forma.dev": {
        "handle": "rohan_kapoor",
        "headline": "Partner, Early-Stage SaaS Investing",
        "bio": "Writes first cheques into Indian B2B SaaS; ex-founder and ex-operator.",
        "phone": "+91 98210 44556",
        "region": "Mumbai, India",
        "avatar_initials": "RK",
        "profile_public": True,
        "allow_outreach": True,
    },
    "jobseeker@forma.dev": {
        "handle": "priya_nair",
        "phone": "+91 99001 22334",
        "region": "Kochi, India (Open to Remote)",
        "avatar_initials": "PN",
        "profile_public": True,
        "allow_outreach": True,
    },
    "employer@forma.dev": {
        "handle": "vikram_singh",
        "headline": "Head of Talent Acquisition",
        "phone": "+91 98190 55667",
        "region": "Hyderabad, India",
        "avatar_initials": "VS",
        "profile_public": True,
        "allow_outreach": True,
    },
}

# Read-only skills catalog (Step 3 part 6; POST /skills is admin/Step 7).
STEP3_SKILLS: list[tuple[str, str | None]] = [
    ("Python", "Engineering"), ("JavaScript", "Engineering"), ("TypeScript", "Engineering"),
    ("React", "Engineering"), ("Next.js", "Engineering"), ("Node.js", "Engineering"),
    ("Go", "Engineering"), ("Java", "Engineering"), ("Rust", "Engineering"),
    ("PostgreSQL", "Engineering"), ("MySQL", "Engineering"), ("Redis", "Engineering"),
    ("AWS", "Engineering"), ("GCP", "Engineering"), ("Docker", "Engineering"),
    ("Kubernetes", "Engineering"), ("GraphQL", "Engineering"), ("REST APIs", "Engineering"),
    ("System Design", "Engineering"), ("Microservices", "Engineering"),
    ("Product Strategy", "Product"), ("Roadmapping", "Product"), ("User Research", "Product"),
    ("A/B Testing", "Product"), ("PRD Writing", "Product"), ("Figma", "Design"),
    ("UI/UX Design", "Design"), ("Design Systems", "Design"), ("Prototyping", "Design"),
    ("Wireframing", "Design"), ("Data Analysis", "Data"), ("Machine Learning", "Data"),
    ("SQL", "Data"), ("Data Visualization", "Data"), ("Excel", "Data"),
    ("Digital Marketing", "Marketing"), ("SEO", "Marketing"), ("Content Writing", "Marketing"),
    ("Growth Marketing", "Marketing"), ("Brand Strategy", "Marketing"),
    ("Sales", "Sales"), ("Business Development", "Sales"), ("Negotiation", "Sales"),
    ("Enterprise Sales", "Sales"), ("Fundraising", "Finance"), ("Financial Modeling", "Finance"),
    ("Cap Table Management", "Finance"), ("Unit Economics", "Finance"),
    ("Recruiting", "People"), ("People Operations", "People"), ("Onboarding", "People"),
    ("Public Speaking", "Communication"), ("Technical Writing", "Communication"),
    ("Cross-functional Leadership", "Leadership"), ("OKRs", "Leadership"),
]

# Demo resume/practice scores (Steps 4/5 will compute real ones later).
STEP3_READINESS_DEMO = {"resume_score": 65, "practice_score": 70}

# Step 3b/3c demo rows: one organisation per founding account, a talent
# profile for the jobseeker and a mentor profile for the mentor — the exact
# records the wired profile/team pages hydrate from.
STEP3_ORGS: list[tuple[str, str, str, str]] = [
    # (owner email, org name, type, city)
    ("founder@forma.dev", "Northstar Labs Pvt Ltd", "startup", "Pune, India"),
    ("employer@forma.dev", "Northstar Health", "employer", "Hyderabad, India"),
    ("investor@forma.dev", "Zenith Capital", "investor_firm", "Mumbai, India"),
]

STEP3B_TALENT = {
    "email": "jobseeker@forma.dev",
    "headline": "Senior Product Designer & Design Systems Lead",
    "summary": (
        "Product designer with 6.5 years across B2B SaaS and consumer apps. "
        "Led design systems at SaaSify Studio; now open to senior IC roles with "
        "remote-friendly teams."
    ),
    "total_experience_yrs": 6.5,
    "current_location": "Bengaluru, India (Open to Remote & Hybrid)",
    "preferred_mode": WorkMode.hybrid,
    "salary_expectation": 2400000,
    "skills": ["Figma", "Design Systems", "UI/UX Design", "Prototyping", "User Research"],
}

STEP3B_MENTOR = {
    "email": "mentor@forma.dev",
    "headline": "Senior Technology Architect & Distributed Systems Specialist",
    "bio": (
        "15+ years designing distributed systems at scale; mentors early-stage "
        "teams on architecture, reliability and platform decisions."
    ),
    "expertise": ["System Design", "Distributed Systems", "Architecture Review", "Technical Mentorship"],
    "sectors": ["SaaS", "Infrastructure", "Fintech"],
    "languages": ["English", "Hindi", "Bengali"],
    "hourly_fee": 6500,
    "cadence": "Next 2 weeks",
}

# Step 5a demo startup profile (moved out of the wired startup-profile
# page's inline seed data). Visibility is public so /public/startups/{slug}
# serves it in development. Fill-only: never overwrites an existing row.
STEP5A_STARTUP_PROFILE: dict[str, object] = {
    "tagline": "Making financial operations effortless for growing businesses.",
    "stage": StartupStage.prototype,
    "sector": "B2B SaaS",
    "business_model": "B2B SaaS · SaaS Subscription",
    "problem": (
        "Small businesses make high-stakes decisions with fragmented financial "
        "data and outdated spreadsheets."
    ),
    "solution": (
        "A single live workspace that connects accounts, forecasts runway, and "
        "turns financial signals into clear next steps."
    ),
    "market": "SMB finance software · India first",
    "profile_visibility": ProfileVisibility.public,
    "legal_entity": "Private Limited (Pvt Ltd)",
    "demo_url": "https://app.northstarlabs.example",
    "actively_raising": "Yes — currently raising",
    "target_raise": "₹1.5 Crores (~$180k)",
    "funding_status": "Bootstrapped (Founder Funded)",
    "pitch_deck_url": "https://northstarlabs.example/deck",
    "dpiit_status": "Applied / In Review with DPIIT",
    "ecosystem_goals": ["Raise Seed Funding", "Find Specialized Mentors"],
}

# Step 5b demo milestones (moved out of the wired tasks page's inline demo
# data). Owners are real active members of the founder's organisation.
# Fill-only: never overwrites an existing row (idempotent by name).
STEP5B_MILESTONES: list[dict[str, object]] = [
    {
        "name": "MVP test launch",
        "description": "Ship the MVP to the first cohort of test users.",
        "target_date": date(2026, 11, 20),
        "status": "on_track",
        "progress": 0,
        "owner": "founder@forma.dev",
    },
    {
        "name": "Investor readiness",
        "description": "Deck, data room and metrics ready before the raise.",
        "target_date": date(2026, 12, 15),
        "status": "at_risk",
        "progress": 0,
        "owner": "mentor@forma.dev",
    },
]

# Step 5c demo tasks (moved out of the wired board's inline demo data).
# `due_offset` is relative to the day the seed runs, so the board never shows
# a uniformly-overdue board just because time moved on. Fill-only: a task
# with the same title in the founder's org is never duplicated.
# `assignee` is a seed email; `milestone` matches a STEP5B_MILESTONES name.
STEP5C_TASKS: list[dict[str, object]] = [
    {
        "title": "Finalize pricing model",
        "description": "Align the pricing tiers with what we have learned from customer interviews.",
        "status": TaskStatus.in_progress,
        "priority": TaskPriority.high,
        "due_offset": -3,
        "assignee": "founder@forma.dev",
        "milestone": "MVP test launch",
    },
    {
        "title": "Review customer interview notes",
        "description": "Summarize the recurring pain points and share with the team.",
        "status": TaskStatus.todo,
        "priority": TaskPriority.medium,
        "due_offset": 2,
        "assignee": "mentor@forma.dev",
        "milestone": "MVP test launch",
    },
    {
        "title": "Update pitch deck traction slide",
        "description": "Refresh the latest MRR and customer numbers.",
        "status": TaskStatus.in_review,
        "priority": TaskPriority.urgent,
        "due_offset": 0,
        "assignee": "founder@forma.dev",
        "milestone": "Investor readiness",
    },
    {
        "title": "Ship onboarding improvements",
        "description": "Improve first-run experience for new test users.",
        "status": TaskStatus.todo,
        "priority": TaskPriority.medium,
        "due_offset": 6,
        "assignee": "mentor@forma.dev",
        "milestone": "MVP test launch",
    },
    {
        "title": "Run five usability sessions",
        "description": "Complete five moderated sessions and capture feedback.",
        "status": TaskStatus.done,
        "priority": TaskPriority.high,
        "due_offset": -6,
        "assignee": "mentor@forma.dev",
        "milestone": "MVP test launch",
    },
    {
        "title": "Confirm mentor review session",
        "description": "Prepare checklist and questions before the next review.",
        "status": TaskStatus.todo,
        "priority": TaskPriority.low,
        "due_offset": 3,
        "assignee": "founder@forma.dev",
        "milestone": "Investor readiness",
    },
    {
        "title": "Prepare beta release notes",
        "description": "Draft release notes for the first external beta.",
        "status": TaskStatus.blocked,
        "priority": TaskPriority.low,
        "due_offset": 9,
        "assignee": "employer@forma.dev",
        "milestone": "MVP test launch",
    },
]

# Step 5f demo readiness: the founder's org starts with two signed-off
# criteria, one awaiting review and one rejected, so /startup/readiness
# shows every badge state in development. Keyed by criterion code; the
# criteria themselves come from scripts/bootstrap_readiness.py. Fill-only.
STEP5F_READINESS: list[dict[str, object]] = [
    {"code": "pitch_deck_summary", "status": ReadinessStatus.signed_off},
    {"code": "business_model_economics", "status": ReadinessStatus.signed_off},
    {"code": "financial_projections", "status": ReadinessStatus.submitted},
    {
        "code": "cap_table_legal",
        "status": ReadinessStatus.rejected,
        "notes": "Cap table is missing the 2025 advisor grant.",
    },
]

# Step 5i/5j demo stage tools (moved out of the stage page's inline demo
# strings). The founder's org sits at `prototype` (STEP5A_STARTUP_PROFILE),
# so the tools seeded are that stage's, plus one idea-stage row so the
# overview grid shows a mix of done / in-progress / not-started. Keyed by
# (stage, tool_key); the vocabulary itself lives in
# stage_service.TOOL_SPEC, so a renamed key is simply skipped here rather
# than breaking the seed. Fill-only: an existing row is never overwritten.
STEP5IJ_TOOLS: list[dict[str, object]] = [
    {
        "stage": StartupStage.prototype,
        "tool_key": "roadmap_sprint_board",
        "status": ToolStatus.done,
        "progress": 100,
        "notes": "Sprint 14 closed; MVP scope locked with the design team.",
    },
    {
        "stage": StartupStage.prototype,
        "tool_key": "prototype_feedback_log",
        "status": ToolStatus.in_progress,
        "progress": 60,
        "notes": "Six tester sessions logged; two recurring complaints to fix.",
    },
    {
        "stage": StartupStage.prototype,
        "tool_key": "user_testing_tracker",
        "status": ToolStatus.in_progress,
        "progress": 35,
        "notes": "Three of eight testers recruited.",
    },
    {
        "stage": StartupStage.prototype,
        "tool_key": "grants_incubators",
        "status": ToolStatus.not_started,
        "progress": 0,
        "notes": None,
    },
    {
        "stage": StartupStage.idea,
        "tool_key": "idea_canvas",
        "status": ToolStatus.done,
        "progress": 100,
        "notes": "Canvas v3 reviewed with a mentor.",
    },
    {
        "stage": StartupStage.idea,
        "tool_key": "interview_tracker",
        "status": ToolStatus.done,
        "progress": 100,
        "notes": "14 customer interviews logged and themed.",
    },
]

# Step 5e demo metrics: six months for the founder's org so the analytics
# Overview/Journey tabs have a real trend in development. (key, months ago,
# value, unit, currency, source). `months ago` counts back from the current
# month's end. Values are the ones the page used to hard-code, now stored
# where the API can serve them. Fill-only: an existing (key, period) wins.
STEP5E_METRICS: list[tuple[str, int, str, str | None, str | None, MetricSource]] = [
    ("mrr", 5, "320000", "INR", "INR", MetricSource.startup_reported),
    ("mrr", 4, "340000", "INR", "INR", MetricSource.startup_reported),
    ("mrr", 3, "360000", "INR", "INR", MetricSource.startup_reported),
    ("mrr", 2, "400000", "INR", "INR", MetricSource.startup_reported),
    ("mrr", 1, "430000", "INR", "INR", MetricSource.startup_reported),
    ("mrr", 0, "480000", "INR", "INR", MetricSource.startup_reported),
    ("burn", 5, "310000", "INR", "INR", MetricSource.startup_reported),
    ("burn", 4, "305000", "INR", "INR", MetricSource.startup_reported),
    ("burn", 3, "300000", "INR", "INR", MetricSource.startup_reported),
    ("burn", 2, "295000", "INR", "INR", MetricSource.startup_reported),
    ("burn", 1, "290000", "INR", "INR", MetricSource.startup_reported),
    ("burn", 0, "285000", "INR", "INR", MetricSource.startup_reported),
    ("customers", 3, "45", None, None, MetricSource.startup_reported),
    ("customers", 1, "63", None, None, MetricSource.startup_reported),
    ("customers", 0, "76", None, None, MetricSource.startup_reported),
    ("runway_months", 0, "9", None, None, MetricSource.startup_reported),
    ("growth_mom", 0, "11.6", "%", None, MetricSource.startup_reported),
    ("headcount", 0, "8", None, None, MetricSource.startup_reported),
    # One verified row so /startup/analytics shows the "Mentor verified"
    # source label without any client being able to set it.
    ("arr", 2, "3840000", "INR", "INR", MetricSource.mentor_verified),
]

# Step 5k: the Business tab's demo numbers, moved out of the page's inline
# sample arrays. Same shape as STEP5E_METRICS and the same fill-only rule,
# so re-running the seed never rewrites a value a person edited.
# Chosen so the derived figures are all real: LTV:CAC 5.0x, payback ~4.2
# months, and a funnel that narrows the way a sales pipeline really does.
STEP5K_METRICS: list[tuple[str, int, str, str | None, str | None]] = [
    ("churn_rate", 0, "2.4", "%", None),
    ("cac", 0, "8400", "INR", "INR"),
    ("ltv", 0, "42000", "INR", "INR"),
    ("nrr", 0, "108", "%", None),
    ("arpc", 0, "3810", "INR", "INR"),
    ("gross_margin", 0, "72", "%", None),
    ("activation_rate", 0, "64", "%", None),
    ("weekly_active_users", 0, "312", None, None),
    ("nps", 0, "42", None, None),
    ("support_response_hours", 0, "3.2", "hours", None),
    # Sales funnel counts for the same month, Lead -> Won.
    ("funnel_lead", 0, "82", None, None),
    ("funnel_contacted", 0, "59", None, None),
    ("funnel_demo", 0, "34", None, None),
    ("funnel_proposal", 0, "19", None, None),
    ("funnel_won", 0, "14", None, None),
]

# Step 5l: demo market size and competitors, moved out of the Market tab's
# inline sample arrays. Keyed by (metric, scenario); fill-only.
STEP5L_MARKET_SIZE: list[dict[str, object]] = [
    {
        "metric": "tam",
        "scenario": "base",
        "value": "12000000000",
        "unit": "currency",
        "currency": "INR",
        "estimate_year": 2025,
        "source_type": "external_report",
        "source_note": "India fintech SMB software, 2025 industry report",
        "confidence": "high",
        "assumptions": "Population x price x adoption, per the cited report.",
    },
    {
        "metric": "sam",
        "scenario": "base",
        "value": "3200000000",
        "unit": "currency",
        "currency": "INR",
        "estimate_year": 2025,
        "source_type": "team_estimate",
        "source_note": "SMB finance tools, English-first metros",
        "confidence": "medium",
        "assumptions": "TAM narrowed to SMBs with digital accounting today.",
    },
    {
        "metric": "som",
        "scenario": "base",
        "value": "180000000",
        "unit": "currency",
        "currency": "INR",
        "estimate_year": 2025,
        "source_type": "team_estimate",
        "source_note": "Reachable in 24 months at current sales capacity",
        "confidence": "low",
        "assumptions": "SAM x share we can win with 2 AEs and the current funnel.",
    },
]

STEP5L_COMPETITORS: list[dict[str, object]] = [
    {
        "name": "Finly",
        "type": "direct",
        "website": "https://finly.example.com",
        "target_customer": "SMBs",
        "positioning": "All-in-one finance for small firms",
        "strengths": "Brand recognition, accounting partnerships",
        "weaknesses": "Thin reporting for multi-entity teams",
        "pricing_note": "$$",
        "last_reviewed_on": "2026-10-30",
    },
    {
        "name": "LedgerLoop",
        "type": "direct",
        "website": "https://ledgerloop.example.com",
        "target_customer": "Startups",
        "positioning": "Bookkeeping plus runway forecasting",
        "strengths": "Strong forecasting UI",
        "weaknesses": "No invoicing",
        "pricing_note": "$$$",
        "last_reviewed_on": "2026-11-01",
    },
    {
        "name": "SheetFlow",
        "type": "substitute",
        "website": "https://sheetflow.example.com",
        "target_customer": "SMBs",
        "positioning": "Spreadsheet templates with light automation",
        "strengths": "Free, familiar",
        "weaknesses": "Manual, no audit trail",
        "pricing_note": "Free",
        "last_reviewed_on": "2026-10-25",
    },
    {
        "name": "Cashwise",
        "type": "indirect",
        "target_customer": "Mid-market",
        "positioning": "Treasury and cash management for larger firms",
        "strengths": "Bank integrations, compliance",
        "weaknesses": "Expensive, slow onboarding",
        "pricing_note": "$$",
        "last_reviewed_on": "2026-10-22",
    },
]

# (email, display name, role, verified?)
SEED_USERS = [
    ("founder@forma.dev", "Aarav Sharma", UserRole.startup, True),
    # Step 5f (plan D3): the platform admin who signs readiness off.
    # Step 15a replaces this with the real admin console + bootstrap.
    ("admin@forma.dev", "Platform Admin", UserRole.admin, True),
    ("mentor@forma.dev", "Meera Iyer", UserRole.mentor, True),
    ("investor@forma.dev", "Rohan Kapoor", UserRole.investor, True),
    ("jobseeker@forma.dev", "Priya Nair", UserRole.jobseeker, True),
    ("employer@forma.dev", "Vikram Singh", UserRole.employer, True),
    ("pending@forma.dev", "Unverified User", UserRole.startup, False),
    # Step 5e: a read-only workspace member, so the viewer path (reads yes,
    # writes 403) can be exercised on /startup/analytics in development.
    ("viewer@forma.dev", "Nisha Rao", UserRole.startup, True),
]


async def seed() -> None:
    settings = get_settings()
    if settings.ENVIRONMENT != "dev":
        raise SystemExit(
            f"Refusing to seed: ENVIRONMENT={settings.ENVIRONMENT!r} (this script is dev-only)."
        )

    now = datetime.now(UTC)
    created, skipped = [], []

    async with async_session_factory() as db:
        for email, name, role, verified in SEED_USERS:
            existing = (
                await db.execute(select(User).where(User.primary_email == email))
            ).scalar_one_or_none()
            if existing is not None and existing.deleted_at is None:
                skipped.append(email)
                continue

            user = User(
                primary_email=email,
                password_hash=hash_password(DEV_PASSWORD),
                display_name=name,
                locale="en-IN",
                timezone="Asia/Kolkata",
                status=AccountStatus.active if verified else AccountStatus.pending,
                verification=ReviewState.pending if verified else ReviewState.unverified,
                email_verified_at=now if verified else None,
            )
            db.add(user)
            await db.flush()
            db.add(UserRoleRow(user_id=user.id, role=role, is_primary=True))
            created.append(f"{email} ({role.value})")

        await db.commit()

        # Step 3: fill profile fields that are still empty (never clobber).
        profile_filled = 0
        result = await db.execute(
            select(User).where(User.deleted_at.is_(None), User.primary_email.in_(STEP3_PROFILE_FIELDS))
        )
        for user in result.scalars().all():
            fields = STEP3_PROFILE_FIELDS[user.primary_email]
            changed = False
            for field, value in fields.items():
                current = getattr(user, field)
                if current is None or (isinstance(current, str) and current == ""):
                    setattr(user, field, value)
                    changed = True
                elif isinstance(value, bool) and current is not True and field in (
                    "profile_public",
                    "allow_outreach",
                ):
                    setattr(user, field, value)
                    changed = True
            if changed:
                profile_filled += 1
        if profile_filled:
            await db.commit()

        # Step 3: skills catalog (case-insensitive unique on lower(name)).
        skills_added = 0
        for name, category in STEP3_SKILLS:
            exists = (
                await db.execute(select(Skill.id).where(func.lower(Skill.name) == name.lower()))
            ).first()
            if exists is None:
                db.add(Skill(name=name, category=category))
                skills_added += 1
        if skills_added:
            await db.commit()

        # Step 3: readiness rows with demo resume/practice scores.
        readiness_added = 0
        result = await db.execute(
            select(User).where(
                User.deleted_at.is_(None),
                User.email_verified_at.is_not(None),
            )
        )
        for user in result.scalars().all():
            row = (
                await db.execute(
                    select(UserReadiness).where(UserReadiness.user_id == user.id)
                )
            ).scalar_one_or_none()
            if row is None:
                db.add(
                    UserReadiness(
                        user_id=user.id,
                        profile_complete=0,
                        overall_score=0,
                        **STEP3_READINESS_DEMO,
                    )
                )
                readiness_added += 1
        if readiness_added:
            await db.commit()

        # Step 3b: organisations + owner memberships (idempotent per owner).
        orgs_added = 0
        for owner_email, org_name, org_type, city in STEP3_ORGS:
            owner = (
                await db.execute(select(User).where(User.primary_email == owner_email))
            ).scalar_one_or_none()
            if owner is None:
                continue
            existing = (
                await db.execute(
                    select(Organization.id)
                    .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
                    .where(OrganizationMember.user_id == owner.id, Organization.type == org_type)
                )
            ).first()
            if existing is not None:
                continue
            base_slug = re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-")[:180]
            slug = base_slug
            suffix = 1
            while (
                await db.execute(select(Organization.id).where(Organization.slug == slug))
            ).first() is not None:
                suffix += 1
                slug = f"{base_slug}-{suffix}"
            org = Organization(
                name=org_name,
                slug=slug,
                type=org_type,
                city=city,
            )
            db.add(org)
            await db.flush()
            db.add(
                OrganizationMember(
                    org_id=org.id,
                    user_id=owner.id,
                    role=OrgRole.owner,
                    status=MemberStatus.active,
                    is_founder=True,
                    joined_at=now,
                    last_active_at=now,
                )
            )
            orgs_added += 1
        if orgs_added:
            await db.commit()

        # Step 5a: startup profile for the founder's organisation, plus the
        # org summary/founded year and a second member so the wired profile
        # and team cards look populated in development. Fill-only.
        startup_profile_added = 0
        extra_members_added = 0
        milestones_added = 0
        tasks_added = 0
        founder_org = (
            (
                await db.execute(
                    select(Organization)
                    .join(
                        OrganizationMember,
                        OrganizationMember.org_id == Organization.id,
                    )
                    .join(User, User.id == OrganizationMember.user_id)
                    .where(
                        User.primary_email == "founder@forma.dev",
                        Organization.type == "startup",
                        OrganizationMember.role == OrgRole.owner,
                    )
                )
            )
            .scalars()
            .first()
        )
        if founder_org is not None:
            if founder_org.summary is None:
                founder_org.summary = (
                    "Live cash-flow visibility, forecasting and GST invoicing for "
                    "fast-growing Indian SMBs — one workspace instead of spreadsheets."
                )
            if founder_org.founded_year is None:
                founder_org.founded_year = 2021
            await db.commit()

            mentor_user = (
                await db.execute(
                    select(User).where(User.primary_email == "mentor@forma.dev")
                )
            ).scalar_one_or_none()
            if mentor_user is not None:
                member_exists = (
                    await db.execute(
                        select(OrganizationMember.id).where(
                            OrganizationMember.org_id == founder_org.id,
                            OrganizationMember.user_id == mentor_user.id,
                        )
                    )
                ).first()
                if member_exists is None:
                    db.add(
                        OrganizationMember(
                            org_id=founder_org.id,
                            user_id=mentor_user.id,
                            role=OrgRole.member,
                            status=MemberStatus.active,
                            title="Go-to-market advisor",
                            joined_at=now,
                            last_active_at=now,
                        )
                    )
                    extra_members_added += 1
                    await db.commit()

            # Step 5e: the read-only teammate for the analytics viewer checks.
            viewer_user = (
                await db.execute(
                    select(User).where(User.primary_email == "viewer@forma.dev")
                )
            ).scalar_one_or_none()
            if viewer_user is not None:
                viewer_exists = (
                    await db.execute(
                        select(OrganizationMember.id).where(
                            OrganizationMember.org_id == founder_org.id,
                            OrganizationMember.user_id == viewer_user.id,
                        )
                    )
                ).first()
                if viewer_exists is None:
                    db.add(
                        OrganizationMember(
                            org_id=founder_org.id,
                            user_id=viewer_user.id,
                            role=OrgRole.viewer,
                            status=MemberStatus.active,
                            title="Observer",
                            joined_at=now,
                            last_active_at=now,
                        )
                    )
                    extra_members_added += 1
                    await db.commit()

            profile_exists = (
                await db.execute(
                    select(StartupProfile.org_id).where(
                        StartupProfile.org_id == founder_org.id
                    )
                )
            ).first()
            if profile_exists is None:
                db.add(StartupProfile(org_id=founder_org.id, **STEP5A_STARTUP_PROFILE))
                await db.commit()
                startup_profile_added = 1

            # Step 5b: demo milestones for the wired panel (fill-only).
            for spec in STEP5B_MILESTONES:
                exists = (
                    await db.execute(
                        select(Milestone.id).where(
                            Milestone.org_id == founder_org.id,
                            Milestone.name == str(spec["name"]),
                            Milestone.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                owner_user = (
                    await db.execute(
                        select(User).where(User.primary_email == str(spec["owner"]))
                    )
                ).scalar_one_or_none()
                db.add(
                    Milestone(
                        org_id=founder_org.id,
                        name=str(spec["name"]),
                        description=(
                            str(spec["description"]) if spec["description"] else None
                        ),
                        target_date=spec["target_date"],
                        status=str(spec["status"]),
                        progress=int(spec["progress"]),
                        owner_id=owner_user.id if owner_user is not None else None,
                    )
                )
                milestones_added += 1
            if milestones_added:
                await db.commit()

            # Step 5c: demo tasks for the wired board (fill-only, by title).
            # display_order is per (org, status) column, so each column is
            # numbered independently in the order the records appear here.
            column_seq: dict[str, int] = {}
            seed_today = datetime.now(UTC).date()
            for spec in STEP5C_TASKS:
                exists = (
                    await db.execute(
                        select(Task.id).where(
                            Task.org_id == founder_org.id,
                            Task.title == str(spec["title"]),
                            Task.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                assignee_user = (
                    await db.execute(
                        select(User).where(User.primary_email == str(spec["assignee"]))
                    )
                ).scalar_one_or_none()
                milestone_row = (
                    await db.execute(
                        select(Milestone).where(
                            Milestone.org_id == founder_org.id,
                            Milestone.name == str(spec["milestone"]),
                            Milestone.deleted_at.is_(None),
                        )
                    )
                ).scalar_one_or_none()
                status = spec["status"]
                assert isinstance(status, TaskStatus)
                order = column_seq.get(status.value, 0)
                column_seq[status.value] = order + 1
                completed_at = (
                    datetime.now(UTC) if status == TaskStatus.done else None
                )
                db.add(
                    Task(
                        org_id=founder_org.id,
                        title=str(spec["title"]),
                        description=(
                            str(spec["description"]) if spec["description"] else None
                        ),
                        status=status,
                        priority=spec["priority"],
                        milestone_id=milestone_row.id if milestone_row is not None else None,
                        assignee_id=(
                            assignee_user.id if assignee_user is not None else None
                        ),
                        created_by=assignee_user.id if assignee_user is not None else None,
                        due_on=seed_today + timedelta(days=int(spec["due_offset"])),  # type: ignore[arg-type]
                        completed_at=completed_at,
                        display_order=order,
                    )
                )
                tasks_added += 1
            if tasks_added:
                await db.commit()

            # Step 5f: demo readiness state for the founder's org (fill-only,
            # only where the org has no row for that criterion yet). Criteria
            # come from scripts/bootstrap_readiness.py; skip if not seeded.
            readiness_added = 0
            admin_user = (
                await db.execute(
                    select(User).where(User.primary_email == "admin@forma.dev")
                )
            ).scalar_one_or_none()
            profile_row = (
                await db.execute(
                    select(StartupProfile).where(StartupProfile.org_id == founder_org.id)
                )
            ).scalar_one_or_none()
            if profile_row is None:
                db.add(StartupProfile(org_id=founder_org.id))
                await db.commit()
            for spec in STEP5F_READINESS:
                criterion = (
                    await db.execute(
                        select(ReadinessCriterion).where(
                            ReadinessCriterion.code == str(spec["code"])
                        )
                    )
                ).scalar_one_or_none()
                if criterion is None:
                    continue
                exists = (
                    await db.execute(
                        select(StartupReadiness.id).where(
                            StartupReadiness.org_id == founder_org.id,
                            StartupReadiness.criterion_id == criterion.id,
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                status = spec["status"]
                assert isinstance(status, ReadinessStatus)
                signed_off = status == ReadinessStatus.signed_off
                db.add(
                    StartupReadiness(
                        org_id=founder_org.id,
                        criterion_id=criterion.id,
                        status=status,
                        evidence=(
                            None
                            if status == ReadinessStatus.signed_off
                            else "Demo evidence added by the dev seed."
                        ),
                        notes=spec.get("notes"),
                        signed_off_by=(
                            admin_user.id if signed_off and admin_user else None
                        ),
                        signed_off_at=datetime.now(UTC) if signed_off else None,
                    )
                )
                readiness_added += 1
            if readiness_added:
                await db.commit()
                # Keep the cached roll-up honest after seeding state.
                # 5i D1: the score counts readiness items only. Exit
                # criteria share the table but must never enter this
                # fraction, or the seeded score would disagree with what
                # readiness_service computes on the next write.
                total = (
                    await db.execute(
                        select(func.count(ReadinessCriterion.id)).where(
                            ReadinessCriterion.is_active.is_(True),
                            ReadinessCriterion.is_exit_criterion.is_(False),
                        )
                    )
                ).scalar_one()
                signed = (
                    await db.execute(
                        select(func.count(StartupReadiness.id))
                        .join(
                            ReadinessCriterion,
                            ReadinessCriterion.id
                            == StartupReadiness.criterion_id,
                        )
                        .where(
                            StartupReadiness.org_id == founder_org.id,
                            StartupReadiness.status == ReadinessStatus.signed_off,
                            ReadinessCriterion.is_exit_criterion.is_(False),
                        )
                    )
                ).scalar_one()
                profile_row = (
                    await db.execute(
                        select(StartupProfile).where(
                            StartupProfile.org_id == founder_org.id
                        )
                    )
                ).scalar_one()
                profile_row.readiness_score = round(100 * signed / total) if total else 0
                await db.commit()

        # Step 5i/5j: demo stage-tool progress for the founder's org, so
        # /startup/stage shows real saved state instead of the old inline
        # "Available in your workspace" strings. Fill-only.
        tools_added = 0
        for spec in STEP5IJ_TOOLS:
            stage = spec["stage"]
            tool_key = str(spec["tool_key"])
            assert isinstance(stage, StartupStage)
            # Validate against the service vocabulary (5j D6): a renamed
            # key is skipped rather than seeded as an orphan row.
            if tool_key not in stage_service._TOOL_BY_KEY:
                continue
            if stage_service._TOOL_STAGE[tool_key] != stage:
                continue
            exists = (
                await db.execute(
                    select(StageToolProgress.id).where(
                        StageToolProgress.org_id == founder_org.id,
                        StageToolProgress.stage == stage,
                        StageToolProgress.tool_key == tool_key,
                    )
                )
            ).first()
            if exists is not None:
                continue
            status = spec["status"]
            assert isinstance(status, ToolStatus)
            db.add(
                StageToolProgress(
                    org_id=founder_org.id,
                    stage=stage,
                    tool_key=tool_key,
                    status=status,
                    progress=int(spec["progress"]),  # type: ignore[arg-type]
                    notes=spec["notes"],  # type: ignore[arg-type]
                    # Attribute the demo write to the platform admin, the
                    # only actor already in scope here (same as 5f's
                    # sign-off seeding). Never client-supplied.
                    updated_by=admin_user.id if admin_user else None,
                )
            )
            tools_added += 1
        if tools_added:
            await db.commit()

        # Step 5e: demo metrics for the founder's org (fill-only, one row per
        # key and period). Period ends are the last day of each month counted
        # back from the current month, so the trend stays current.
        metrics_added = 0
        today = date.today()
        for key, months_ago, value, unit, currency, source in STEP5E_METRICS:
            if key not in {k.value for k in MetricKey}:
                continue
            year, month = today.year, today.month - months_ago
            while month <= 0:
                month += 12
                year -= 1
            period_end = date(
                year, month, calendar.monthrange(year, month)[1]
            )
            exists = (
                await db.execute(
                    select(StartupMetric.id).where(
                        StartupMetric.org_id == founder_org.id,
                        StartupMetric.metric_key == key,
                        StartupMetric.period_end == period_end,
                    )
                )
            ).first()
            if exists is not None:
                continue
            db.add(
                StartupMetric(
                    org_id=founder_org.id,
                    metric_key=key,
                    value=Decimal(value),
                    unit=unit,
                    currency=currency,
                    source=source,
                    period_end=period_end,
                )
            )
            metrics_added += 1

        # Step 5k: the Business tab's demo values, same fill-only rule and
        # the same current-month period as the 5e rows above.
        for key, months_ago, value, unit, currency in STEP5K_METRICS:
            if key not in {k.value for k in MetricKey}:
                continue
            year, month = today.year, today.month - months_ago
            while month <= 0:
                month += 12
                year -= 1
            period_end = date(year, month, calendar.monthrange(year, month)[1])
            exists = (
                await db.execute(
                    select(StartupMetric.id).where(
                        StartupMetric.org_id == founder_org.id,
                        StartupMetric.metric_key == key,
                        StartupMetric.period_end == period_end,
                    )
                )
            ).first()
            if exists is not None:
                continue
            db.add(
                StartupMetric(
                    org_id=founder_org.id,
                    metric_key=key,
                    value=Decimal(value),
                    unit=unit,
                    currency=currency,
                    # Server-assigned, exactly as the API writes it.
                    source=MetricSource.startup_reported,
                    period_end=period_end,
                )
            )
            metrics_added += 1
        if metrics_added:
            await db.commit()

        # Step 5l: demo market size and competitors (fill-only).
        market_added = 0
        for spec in STEP5L_MARKET_SIZE:
            metric = str(spec["metric"])
            scenario = str(spec["scenario"])
            exists = (
                await db.execute(
                    select(StartupMarketSize.id).where(
                        StartupMarketSize.org_id == founder_org.id,
                        StartupMarketSize.metric == metric,
                        StartupMarketSize.scenario == scenario,
                    )
                )
            ).first()
            if exists is not None:
                continue
            db.add(
                StartupMarketSize(
                    org_id=founder_org.id,
                    metric=metric,
                    scenario=scenario,
                    value=Decimal(str(spec["value"])),
                    unit=spec["unit"],
                    currency=spec["currency"],  # type: ignore[arg-type]
                    estimate_year=int(spec["estimate_year"]),  # type: ignore[arg-type]
                    source_type=spec["source_type"],
                    source_note=spec["source_note"],  # type: ignore[arg-type]
                    confidence=spec["confidence"],
                    assumptions=spec["assumptions"],  # type: ignore[arg-type]
                )
            )
            market_added += 1

        competitors_added = 0
        for spec in STEP5L_COMPETITORS:
            exists = (
                await db.execute(
                    select(StartupCompetitor.id).where(
                        StartupCompetitor.org_id == founder_org.id,
                        func.lower(StartupCompetitor.name)
                        == str(spec["name"]).lower(),
                        StartupCompetitor.deleted_at.is_(None),
                    )
                )
            ).first()
            if exists is not None:
                continue
            db.add(
                StartupCompetitor(
                    org_id=founder_org.id,
                    name=str(spec["name"]),
                    type=spec["type"],
                    # Optional columns: .get() so a demo row may omit any
                    # of them without breaking the whole seed.
                    website=spec.get("website"),  # type: ignore[arg-type]
                    target_customer=spec.get("target_customer"),  # type: ignore[arg-type]
                    positioning=spec.get("positioning"),  # type: ignore[arg-type]
                    strengths=spec.get("strengths"),  # type: ignore[arg-type]
                    weaknesses=spec.get("weaknesses"),  # type: ignore[arg-type]
                    pricing_note=spec.get("pricing_note"),  # type: ignore[arg-type]
                    last_reviewed_on=(
                        date.fromisoformat(str(spec["last_reviewed_on"]))
                        if spec.get("last_reviewed_on")
                        else None
                    ),
                )
            )
            competitors_added += 1
        if market_added or competitors_added:
            await db.commit()

        # Step 3c: talent profile for the jobseeker (skills attached by name).
        talent_added = 0
        talent = (
            await db.execute(
                select(TalentProfile)
                .join(User, User.id == TalentProfile.user_id)
                .where(User.primary_email == STEP3B_TALENT["email"])
            )
        ).scalar_one_or_none()
        if talent is None:
            js_user = (
                await db.execute(select(User).where(User.primary_email == STEP3B_TALENT["email"]))
            ).scalar_one_or_none()
            if js_user is not None:
                talent = TalentProfile(
                    user_id=js_user.id,
                    headline=STEP3B_TALENT["headline"],
                    summary=STEP3B_TALENT["summary"],
                    total_experience_yrs=STEP3B_TALENT["total_experience_yrs"],
                    current_location=STEP3B_TALENT["current_location"],
                    preferred_mode=STEP3B_TALENT["preferred_mode"],
                    salary_expectation=STEP3B_TALENT["salary_expectation"],
                    is_searchable=True,
                )
                db.add(talent)
                await db.flush()
                for skill_name in STEP3B_TALENT["skills"]:
                    skill = (
                        await db.execute(
                            select(Skill).where(func.lower(Skill.name) == skill_name.lower())
                        )
                    ).scalar_one_or_none()
                    if skill is not None:
                        db.add(TalentProfileSkill(user_id=js_user.id, skill_id=skill.id))
                talent_added = 1
                await db.commit()

        # Step 3c: mentor profile (expertise/sectors/languages are JSON lists).
        mentor_added = 0
        mentor_profile = (
            await db.execute(
                select(MentorProfile)
                .join(User, User.id == MentorProfile.user_id)
                .where(User.primary_email == STEP3B_MENTOR["email"])
            )
        ).scalar_one_or_none()
        if mentor_profile is None:
            mentor_user = (
                await db.execute(select(User).where(User.primary_email == STEP3B_MENTOR["email"]))
            ).scalar_one_or_none()
            if mentor_user is not None:
                db.add(
                    MentorProfile(
                        user_id=mentor_user.id,
                        headline=STEP3B_MENTOR["headline"],
                        bio=STEP3B_MENTOR["bio"],
                        expertise=STEP3B_MENTOR["expertise"],
                        sectors=STEP3B_MENTOR["sectors"],
                        languages=STEP3B_MENTOR["languages"],
                        hourly_fee=STEP3B_MENTOR["hourly_fee"],
                        cadence=STEP3B_MENTOR["cadence"],
                        accepting_requests=True,
                    )
                )
                mentor_added = 1
                await db.commit()

    await engine.dispose()

    print("Seeded (dev only):")
    for line in created:
        print(f"  + {line}")
    for line in skipped:
        print(f"  = {line} (already exists)")
    print(f"  + profile fields on {profile_filled} account(s)")
    print(f"  + {skills_added} skill(s)")
    print(f"  + {readiness_added} readiness row(s)")
    print(f"  + {metrics_added} metric row(s) (5e)")
    print(f"  + {orgs_added} organisation(s) with owner memberships")
    print(f"  + startup profile (5a): {startup_profile_added}")
    print(f"  + extra org member (5a): {extra_members_added}")
    print(f"  + milestones (5b): {milestones_added}")
    print(f"  + tasks (5c): {tasks_added}")
    print(f"  + readiness items (5f): {readiness_added}")
    print(f"  + stage tool progress (5i/5j): {tools_added}")
    print(f"  + market size (5l): {market_added}")
    print(f"  + competitors (5l): {competitors_added}")
    print(f"  + talent profile: {talent_added}")
    print(f"  + mentor profile: {mentor_added}")
    print(f"\nPassword for all seeded accounts: {DEV_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
