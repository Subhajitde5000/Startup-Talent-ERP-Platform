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
import hashlib
import re
import secrets
import sys
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

# Allow `python scripts/seed_dev.py` from backend/ without installing the pkg.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import async_session_factory, engine  # noqa: E402
from app.models.analytics import StartupCompetitor, StartupMarketSize  # noqa: E402
from app.models.availability import AvailabilitySlot  # noqa: E402
from app.models.deliverable import DeliverableStatus, MentorDeliverable  # noqa: E402
from app.models.earning import EarningStatus, MentorEarning  # noqa: E402
from app.models.mentorship import (  # noqa: E402
    BUSY_STATUSES,
    Mentorship,
    MentorshipStatus,
)
from app.models.metric import MetricKey, MetricSource, StartupMetric  # noqa: E402
from app.models.milestone import Milestone  # noqa: E402
from app.models.organization import (  # noqa: E402
    MemberStatus,
    Organization,
    OrganizationInvite,
    OrganizationMember,
    OrgRole,
)
from app.models.profile import Skill, UserReadiness  # noqa: E402
from app.models.readiness import (  # noqa: E402
    ReadinessCriterion,
    ReadinessStatus,
    StartupReadiness,
)
from app.models.session import (  # noqa: E402
    AttendeeRole,
    MentoringSession,
    SessionAttendee,
    SessionStatus,
)
from app.models.session_review import SessionReview  # noqa: E402
from app.models.stage import StageToolProgress, ToolStatus  # noqa: E402
from app.models.startup import (  # noqa: E402
    ProfileVisibility,
    StartupProfile,
    StartupStage,
)
from app.models.talent import MentorProfile, TalentProfile, TalentProfileSkill, WorkMode  # noqa: E402
from app.models.task import Task, TaskPriority, TaskStatus  # noqa: E402
from app.models.task_label import TaskLabel, TaskLabelLink  # noqa: E402
from app.models.user import AccountStatus, ReviewState, User, UserRole, UserRoleRow  # noqa: E402
from app.services import (
    session_review_service,  # noqa: E402
    stage_service,  # noqa: E402
)

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
    ("Python", "Engineering"),
    ("JavaScript", "Engineering"),
    ("TypeScript", "Engineering"),
    ("React", "Engineering"),
    ("Next.js", "Engineering"),
    ("Node.js", "Engineering"),
    ("Go", "Engineering"),
    ("Java", "Engineering"),
    ("Rust", "Engineering"),
    ("PostgreSQL", "Engineering"),
    ("MySQL", "Engineering"),
    ("Redis", "Engineering"),
    ("AWS", "Engineering"),
    ("GCP", "Engineering"),
    ("Docker", "Engineering"),
    ("Kubernetes", "Engineering"),
    ("GraphQL", "Engineering"),
    ("REST APIs", "Engineering"),
    ("System Design", "Engineering"),
    ("Microservices", "Engineering"),
    ("Product Strategy", "Product"),
    ("Roadmapping", "Product"),
    ("User Research", "Product"),
    ("A/B Testing", "Product"),
    ("PRD Writing", "Product"),
    ("Figma", "Design"),
    ("UI/UX Design", "Design"),
    ("Design Systems", "Design"),
    ("Prototyping", "Design"),
    ("Wireframing", "Design"),
    ("Data Analysis", "Data"),
    ("Machine Learning", "Data"),
    ("SQL", "Data"),
    ("Data Visualization", "Data"),
    ("Excel", "Data"),
    ("Digital Marketing", "Marketing"),
    ("SEO", "Marketing"),
    ("Content Writing", "Marketing"),
    ("Growth Marketing", "Marketing"),
    ("Brand Strategy", "Marketing"),
    ("Sales", "Sales"),
    ("Business Development", "Sales"),
    ("Negotiation", "Sales"),
    ("Enterprise Sales", "Sales"),
    ("Fundraising", "Finance"),
    ("Financial Modeling", "Finance"),
    ("Cap Table Management", "Finance"),
    ("Unit Economics", "Finance"),
    ("Recruiting", "People"),
    ("People Operations", "People"),
    ("Onboarding", "People"),
    ("Public Speaking", "Communication"),
    ("Technical Writing", "Communication"),
    ("Cross-functional Leadership", "Leadership"),
    ("OKRs", "Leadership"),
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
    "expertise": [
        "System Design",
        "Distributed Systems",
        "Architecture Review",
        "Technical Mentorship",
    ],
    "sectors": ["SaaS", "Infrastructure", "Fintech"],
    "languages": ["English", "Hindi", "Bengali"],
    "hourly_fee": 6500,
    "cadence": "Next 2 weeks",
}

# Step 8a demo mentors (moved out of the wired mentor directory's inline
# `mentors` array). Only the fields the directory card and detail page
# render: expertise/sectors/languages are JSON lists, and no stage attribute
# exists yet (8a plan D-1), so none is invented here.

# Steps 8b/8c/8d demo records. One open mentorship for the first two
# mentors (so the requests page shows both an accepted and a pending row),
# a weekly availability template for each, and one upcoming session on the
# active pair. Emails must match STEP8A_MENTORS above.
STEP8BCD_MENTORSHIPS: list[dict[str, object]] = [
    {
        "email": "rhea@forma.dev",
        "status": "active",
        "goal": "Sharpen pricing and build a repeatable go-to-market motion.",
        "needs": ["pricing", "go-to-market"],
        "cadence": "Fortnightly",
        "fee_amount": Decimal("3000.00"),
        "started_days_ago": 40,
        "availability": [(1, 16, 18), (3, 16, 18)],
        "next_topic": "Go-to-market and pricing",
        "next_in_days": 5,
    },
    {
        "email": "arjun@forma.dev",
        "status": "requested",
        "goal": "Help us think through hiring our first two engineers.",
        "needs": ["hiring", "product"],
        "cadence": "Weekly",
        "fee_amount": Decimal("4500.00"),
        "started_days_ago": 0,
        "availability": [(2, 11, 13)],
        "next_topic": "",
        "next_in_days": 0,
    },
]

# Step 8e demo deliverables on the ACTIVE mentorship, one per status the UI
# renders differently, so the pages are not empty on a fresh database.
STEP8E_DELIVERABLES: list[dict[str, object]] = [
    {
        "title": "Draft the pricing page",
        "description": "Three tiers with the middle one highlighted, plus a comparison table.",
        "status": "in_progress",
        "due_in_days": 6,
        "evidence": None,
    },
    {
        "title": "One-page go-to-market summary",
        "description": "Positioning, ICP and the first two channels, on one page.",
        "status": "submitted",
        "due_in_days": 2,
        "evidence": "Draft shared in the shared folder; looking for feedback on the ICP.",
    },
    {
        "title": "Competitor teardown",
        "description": "Five competitors, pricing and positioning side by side.",
        "status": "accepted",
        "due_in_days": -14,
        "evidence": "Teardown delivered and reviewed.",
    },
]

STEP8A_MENTORS: list[dict[str, object]] = [
    {
        "email": "rhea@forma.dev",
        "display_name": "Rhea Mukherjee",
        "handle": "rhea_mukherjee",
        "region": "Kolkata, India",
        "headline": "Go-to-market advisor · 2 exits",
        "bio": (
            "I work with early-stage founders to shape a clear go-to-market "
            "strategy, validate pricing and build an investor-ready story. My "
            "approach is structured, candid and focused on practical next steps."
        ),
        "expertise": ["Go-to-market", "Fundraising", "SaaS"],
        "sectors": ["Fintech", "B2B SaaS"],
        "languages": ["English", "Bengali", "Hindi"],
        "years_experience": 14,
        "hourly_fee": 3000,
        "cadence": "Weekly",
        "rating": 4.9,
        "sessions_completed": 140,
        "is_verified": True,
    },
    {
        "email": "arjun@forma.dev",
        "display_name": "Arjun Mehta",
        "handle": "arjun_mehta",
        "region": "Bengaluru, India",
        "headline": "Former CTO · 1 successful exit",
        "bio": (
            "I help technical founders move from prototype to a resilient "
            "product with a clear engineering roadmap and a high-trust early team."
        ),
        "expertise": ["Technology", "Product", "Hiring"],
        "sectors": ["SaaS", "Marketplace"],
        "languages": ["English", "Hindi"],
        "years_experience": 18,
        "hourly_fee": 4500,
        "cadence": "Fortnightly",
        "rating": 4.8,
        "sessions_completed": 215,
        "is_verified": True,
    },
    {
        "email": "naina@forma.dev",
        "display_name": "Naina Roy",
        "handle": "naina_roy",
        "region": "Mumbai, India",
        "headline": "Finance operator · 12 startups advised",
        "bio": (
            "I support founders with unit economics, runway planning and "
            "financial models that are clear to both teams and investors."
        ),
        "expertise": ["Finance", "Fundraising", "Operations"],
        "sectors": ["Fintech", "Climate"],
        "languages": ["English", "Hindi", "Marathi"],
        "years_experience": 11,
        "hourly_fee": 0,
        "cadence": "Monthly",
        "rating": 5.0,
        "sessions_completed": 98,
        "is_verified": False,
    },
]

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

# Step 5d demo labels (moved out of the tasks page's inline demo pills).
# Fill-only by name: a label the dev renamed is never recreated, and the
# task wiring below only runs for tasks that exist.
STEP5D_LABELS: list[dict[str, object]] = [
    {"name": "Backend", "color": "#4A5568"},
    {"name": "Design", "color": "#B8955A"},
    {"name": "Customer research", "color": "#2E7D5B"},
    {"name": "Go-to-market", "color": "#B7791F"},
    {"name": "Investor", "color": "#0F1B2D"},
]

# task title -> label names it carries once both exist.
STEP5D_TASK_LABELS: dict[str, list[str]] = {
    "Finalize pricing model": ["Go-to-market", "Investor"],
    "Review customer interview notes": ["Customer research"],
    "Update pitch deck traction slide": ["Investor"],
    "Ship onboarding improvements": ["Design"],
    "Prepare beta release notes": ["Backend"],
}

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
    # Step 8a: the mentor directory. Three more mentors so
    # /startup/mentors/find shows a real list with different expertise,
    # sectors and prices instead of a single row.
    ("rhea@forma.dev", "Rhea Mukherjee", UserRole.mentor, True),
    ("arjun@forma.dev", "Arjun Mehta", UserRole.mentor, True),
    ("naina@forma.dev", "Naina Roy", UserRole.mentor, True),
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
            select(User).where(
                User.deleted_at.is_(None), User.primary_email.in_(STEP3_PROFILE_FIELDS)
            )
        )
        for user in result.scalars().all():
            fields = STEP3_PROFILE_FIELDS[user.primary_email]
            changed = False
            for field, value in fields.items():
                current = getattr(user, field)
                if current is None or (isinstance(current, str) and current == ""):
                    setattr(user, field, value)
                    changed = True
                elif (
                    isinstance(value, bool)
                    and current is not True
                    and field
                    in (
                        "profile_public",
                        "allow_outreach",
                    )
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
                await db.execute(select(UserReadiness).where(UserReadiness.user_id == user.id))
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
        team_state_added = 0
        milestones_added = 0
        tasks_added = 0
        labels_added = 0
        task_label_links_added = 0
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
                await db.execute(select(User).where(User.primary_email == "mentor@forma.dev"))
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
                await db.execute(select(User).where(User.primary_email == "viewer@forma.dev"))
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

            # Step 3d: the team page has states that only appear once a
            # member is deactivated and an invite is pending. Seed one of
            # each so the wired page shows every state in development.
            # Fill-only and idempotent, like everything else here.
            deactivated_user = (
                await db.execute(select(User).where(User.primary_email == "jobseeker@forma.dev"))
            ).scalar_one_or_none()
            if deactivated_user is not None:
                deact_exists = (
                    await db.execute(
                        select(OrganizationMember.id).where(
                            OrganizationMember.org_id == founder_org.id,
                            OrganizationMember.user_id == deactivated_user.id,
                        )
                    )
                ).first()
                if deact_exists is None:
                    db.add(
                        OrganizationMember(
                            org_id=founder_org.id,
                            user_id=deactivated_user.id,
                            role=OrgRole.member,
                            status=MemberStatus.deactivated,
                            title="Former design intern",
                            department=None,
                            joined_at=now,
                            last_active_at=now,
                        )
                    )
                    team_state_added += 1
                    await db.commit()

            founder_user = (
                await db.execute(select(User).where(User.primary_email == "founder@forma.dev"))
            ).scalar_one_or_none()
            pending_invite = (
                await db.execute(
                    select(OrganizationInvite.id).where(
                        OrganizationInvite.org_id == founder_org.id,
                        OrganizationInvite.email == "designer@forma.dev",
                        OrganizationInvite.accepted_at.is_(None),
                        OrganizationInvite.revoked_at.is_(None),
                    )
                )
            ).first()
            if pending_invite is None:
                # The raw token is never printed: only its hash is stored,
                # exactly as the API does it.
                seed_token = secrets.token_urlsafe(32)
                db.add(
                    OrganizationInvite(
                        org_id=founder_org.id,
                        email="designer@forma.dev",
                        role=OrgRole.member,
                        title="Product designer",
                        message="We would love your help shaping the v1 design.",
                        is_public=True,
                        token_hash=hashlib.sha256(seed_token.encode()).hexdigest(),
                        invited_by=founder_user.id if founder_user else None,
                        expires_at=now + timedelta(days=14),
                    )
                )
                team_state_added += 1
                await db.commit()

            profile_exists = (
                await db.execute(
                    select(StartupProfile.org_id).where(StartupProfile.org_id == founder_org.id)
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
                    await db.execute(select(User).where(User.primary_email == str(spec["owner"])))
                ).scalar_one_or_none()
                db.add(
                    Milestone(
                        org_id=founder_org.id,
                        name=str(spec["name"]),
                        description=(str(spec["description"]) if spec["description"] else None),
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
                completed_at = datetime.now(UTC) if status == TaskStatus.done else None
                db.add(
                    Task(
                        org_id=founder_org.id,
                        title=str(spec["title"]),
                        description=(str(spec["description"]) if spec["description"] else None),
                        status=status,
                        priority=spec["priority"],
                        milestone_id=milestone_row.id if milestone_row is not None else None,
                        assignee_id=(assignee_user.id if assignee_user is not None else None),
                        created_by=assignee_user.id if assignee_user is not None else None,
                        due_on=seed_today + timedelta(days=int(spec["due_offset"])),  # type: ignore[arg-type]
                        completed_at=completed_at,
                        display_order=order,
                    )
                )
                tasks_added += 1
            if tasks_added:
                await db.commit()

            # Step 5d: demo label catalogue and the label pills on the demo
            # tasks. Fill-only in both directions so dev edits survive.
            for spec in STEP5D_LABELS:
                exists = (
                    await db.execute(
                        select(TaskLabel.id).where(
                            TaskLabel.org_id == founder_org.id,
                            func.lower(TaskLabel.name) == str(spec["name"]).lower(),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                db.add(
                    TaskLabel(
                        org_id=founder_org.id,
                        name=str(spec["name"]),
                        color=(str(spec["color"]) if spec["color"] else None),
                    )
                )
                labels_added += 1
            if labels_added:
                await db.commit()
            labels_by_name = {
                row.name: row
                for row in (
                    await db.execute(select(TaskLabel).where(TaskLabel.org_id == founder_org.id))
                )
                .scalars()
                .all()
            }
            for title, label_names in STEP5D_TASK_LABELS.items():
                task_row = (
                    await db.execute(
                        select(Task).where(
                            Task.org_id == founder_org.id,
                            Task.title == title,
                            Task.deleted_at.is_(None),
                        )
                    )
                ).scalar_one_or_none()
                if task_row is None:
                    continue
                for label_name in label_names:
                    label_row = labels_by_name.get(label_name)
                    if label_row is None:
                        continue
                    linked = (
                        await db.execute(
                            select(TaskLabelLink.label_id).where(
                                TaskLabelLink.task_id == task_row.id,
                                TaskLabelLink.label_id == label_row.id,
                            )
                        )
                    ).first()
                    if linked is not None:
                        continue
                    db.add(TaskLabelLink(task_id=task_row.id, label_id=label_row.id))
                    task_label_links_added += 1
            if task_label_links_added:
                await db.commit()

            # Step 5f: demo readiness state for the founder's org (fill-only,
            # only where the org has no row for that criterion yet). Criteria
            # come from scripts/bootstrap_readiness.py; skip if not seeded.
            readiness_added = 0
            admin_user = (
                await db.execute(select(User).where(User.primary_email == "admin@forma.dev"))
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
                        signed_off_by=(admin_user.id if signed_off and admin_user else None),
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
                            ReadinessCriterion.id == StartupReadiness.criterion_id,
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
                        select(StartupProfile).where(StartupProfile.org_id == founder_org.id)
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
                        func.lower(StartupCompetitor.name) == str(spec["name"]).lower(),
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

        # Step 8a: the demo mentor directory. Profile fields are only filled
        # on the rows that do not have a MentorProfile yet, so dev edits are
        # never clobbered on a re-run (same idempotency rule as 3c above).
        mentors8a_added = 0
        for spec in STEP8A_MENTORS:
            mentor_user = (
                await db.execute(select(User).where(User.primary_email == spec["email"]))
            ).scalar_one_or_none()
            if mentor_user is None:
                continue
            # The directory key is the handle: without one the mentor is
            # listed but unreachable by /mentors/{handle}. Filled only when
            # empty so a dev who edited their handle keeps it.
            if mentor_user.handle is None:
                mentor_user.handle = spec["handle"]
            if mentor_user.region is None:
                mentor_user.region = spec["region"]
            existing = (
                await db.execute(
                    select(MentorProfile).where(MentorProfile.user_id == mentor_user.id)
                )
            ).scalar_one_or_none()
            if existing is not None:
                continue
            db.add(
                MentorProfile(
                    user_id=mentor_user.id,
                    headline=spec["headline"],
                    bio=spec["bio"],
                    expertise=spec["expertise"],
                    sectors=spec["sectors"],
                    languages=spec["languages"],
                    years_experience=spec["years_experience"],
                    hourly_fee=spec["hourly_fee"],
                    cadence=spec["cadence"],
                    rating=spec["rating"],
                    sessions_completed=spec["sessions_completed"],
                    # Server-owned in production (admin verification, 8i
                    # rating recompute); seeded only so the dev directory
                    # has a verified/unverified mix to exercise the filter.
                    is_verified=spec["is_verified"],
                    accepting_requests=True,
                )
            )
            mentors8a_added += 1
        # Commit unconditionally: handles/regions above may be the only
        # change on a re-run where every profile already exists.
        await db.commit()

        # Steps 8b/8c/8d: demo mentorships, availability and sessions so the
        # mentor pages have something to render. Idempotent by "does an open
        # mentorship already exist for this pair", which is the same rule the
        # partial unique index enforces.
        mentorships_added = 0
        availability_added = 0
        sessions_added = 0
        deliverables_added = 0
        earnings_added = 0
        if founder_org is not None:
            for spec in STEP8BCD_MENTORSHIPS:
                mentor_user = (
                    await db.execute(select(User).where(User.primary_email == spec["email"]))
                ).scalar_one_or_none()
                if mentor_user is None:
                    continue

                existing = (
                    await db.execute(
                        select(Mentorship).where(
                            Mentorship.mentor_id == mentor_user.id,
                            Mentorship.startup_org_id == founder_org.id,
                            Mentorship.deleted_at.is_(None),
                            Mentorship.status.in_([s.value for s in BUSY_STATUSES]),
                        )
                    )
                ).scalar_one_or_none()

                if existing is None:
                    row = Mentorship(
                        mentor_id=mentor_user.id,
                        startup_org_id=founder_org.id,
                        status=MentorshipStatus(spec["status"]),
                        goal=spec["goal"],
                        needs=spec["needs"],
                        cadence=spec["cadence"],
                        fee_amount=spec["fee_amount"],
                        currency="INR",
                        started_on=(
                            date.today() - timedelta(days=spec["started_days_ago"])
                            if spec["status"] in ("active", "paused")
                            else None
                        ),
                    )
                    db.add(row)
                    await db.flush()
                    mentorships_added += 1
                else:
                    row = existing

                # 8c: a weekly window for the mentors that appear on a page.
                has_week = (
                    await db.execute(
                        select(AvailabilitySlot.id)
                        .where(AvailabilitySlot.mentor_id == mentor_user.id)
                        .limit(1)
                    )
                ).first()
                if has_week is None:
                    for weekday, start_h, end_h in spec["availability"]:
                        db.add(
                            AvailabilitySlot(
                                mentor_id=mentor_user.id,
                                weekday=weekday,
                                start_time=time(start_h, 0),
                                end_time=time(end_h, 0),
                                timezone="Asia/Kolkata",
                            )
                        )
                        availability_added += 1

                # 8d: one upcoming session on the active mentorship.
                if spec["status"] == "active":
                    has_session = (
                        await db.execute(
                            select(MentoringSession.id)
                            .where(MentoringSession.mentorship_id == row.id)
                            .limit(1)
                        )
                    ).first()
                    if has_session is None:
                        session = MentoringSession(
                            mentorship_id=row.id,
                            topic=spec["next_topic"],
                            session_type="advisory",
                            status=SessionStatus.scheduled,
                            # Whole minutes: the API never accepts sub-second
                            # precision, so seeded rows should not either.
                            scheduled_at=(
                                datetime.now(UTC) + timedelta(days=spec["next_in_days"])
                            ).replace(second=0, microsecond=0),
                            duration_min=45,
                            meeting_url="https://meet.forma.example/demo-session",
                        )
                        db.add(session)
                        await db.flush()
                        # The API always attaches the mentor as an attendee;
                        # a seeded session must look the same.
                        db.add(
                            SessionAttendee(
                                session_id=session.id,
                                user_id=mentor_user.id,
                                role=AttendeeRole.mentor,
                            )
                        )
                        sessions_added += 1

                    # 8e: deliverables, on the active mentorship only.
                    for item in STEP8E_DELIVERABLES:
                        has_deliverable = (
                            await db.execute(
                                select(MentorDeliverable.id).where(
                                    MentorDeliverable.mentorship_id == row.id,
                                    MentorDeliverable.title == item["title"],
                                    MentorDeliverable.deleted_at.is_(None),
                                )
                            )
                        ).first()
                        if has_deliverable is not None:
                            continue
                        db.add(
                            MentorDeliverable(
                                mentorship_id=row.id,
                                title=item["title"],
                                description=item["description"],
                                status=DeliverableStatus(item["status"]),
                                due_on=date.today() + timedelta(days=item["due_in_days"]),
                                evidence=item["evidence"],
                                # The founder is the active member doing the work.
                                owner_id=founder_user.id if founder_user else None,
                                submitted_at=(
                                    datetime.now(UTC)
                                    if item["status"] in ("submitted", "accepted")
                                    else None
                                ),
                                reviewed_at=(
                                    datetime.now(UTC) if item["status"] == "accepted" else None
                                ),
                                reviewed_by=(
                                    mentor_user.id if item["status"] == "accepted" else None
                                ),
                            )
                        )
                        deliverables_added += 1

                    # 8h: one paid, COMPLETED session and the earning it
                    # creates, so the mentor earnings page has a row. Built
                    # through the same arithmetic the API uses.
                    has_paid = (
                        await db.execute(
                            select(MentorEarning.id)
                            .where(MentorEarning.mentor_id == mentor_user.id)
                            .limit(1)
                        )
                    ).first()
                    if has_paid is None and spec["fee_amount"]:
                        paid_session = MentoringSession(
                            mentorship_id=row.id,
                            topic="Pricing review",
                            session_type="advisory",
                            status=SessionStatus.completed,
                            scheduled_at=(datetime.now(UTC) - timedelta(days=12)).replace(
                                second=0, microsecond=0
                            ),
                            duration_min=45,
                            meeting_url="https://meet.forma.example/demo-session",
                            summary="Reviewed the pricing tiers and agreed the next experiment.",
                            completed_at=datetime.now(UTC) - timedelta(days=12),
                            fee_amount=spec["fee_amount"],
                            currency="INR",
                        )
                        db.add(paid_session)
                        await db.flush()
                        db.add(
                            SessionAttendee(
                                session_id=paid_session.id,
                                user_id=mentor_user.id,
                                role=AttendeeRole.mentor,
                            )
                        )
                        commission = Decimal(spec["fee_amount"]) * Decimal("0")
                        net = Decimal(spec["fee_amount"]) - commission
                        db.add(
                            MentorEarning(
                                mentor_id=mentor_user.id,
                                session_id=paid_session.id,
                                gross_amount=Decimal(spec["fee_amount"]),
                                commission_amount=commission,
                                tds_amount=Decimal("0"),
                                net_amount=net,
                                currency="INR",
                                status=EarningStatus.paid,
                                earned_on=date.today() - timedelta(days=12),
                            )
                        )
                        earnings_added += 1
                    # 8i: a real, explicitly consented review of a completed
                    # dev session; never recreate a withdrawn review.
                    if founder_user:
                        await db.flush()
                        reviewed_session = (
                            await db.execute(
                                select(MentoringSession)
                                .where(
                                    MentoringSession.mentorship_id == row.id,
                                    MentoringSession.topic == "Pricing review",
                                    MentoringSession.status == SessionStatus.completed,
                                )
                                .limit(1)
                            )
                        ).scalar_one_or_none()
                        if reviewed_session:
                            attendee = (
                                await db.execute(
                                    select(SessionAttendee).where(
                                        SessionAttendee.session_id == reviewed_session.id,
                                        SessionAttendee.user_id == founder_user.id,
                                    )
                                )
                            ).scalar_one_or_none()
                            if attendee is None:
                                db.add(
                                    SessionAttendee(
                                        session_id=reviewed_session.id,
                                        user_id=founder_user.id,
                                        role=AttendeeRole.startup,
                                    )
                                )
                            existing_review = (
                                await db.execute(
                                    select(SessionReview.id).where(
                                        SessionReview.session_id == reviewed_session.id,
                                        SessionReview.reviewer_id == founder_user.id,
                                    )
                                )
                            ).first()
                            if existing_review is None:
                                profile = await session_review_service._lock_profile(
                                    db, mentor_user.id
                                )
                                db.add(
                                    SessionReview(
                                        session_id=reviewed_session.id,
                                        reviewer_id=founder_user.id,
                                        rating=5,
                                        public_text="Thoughtful and direct. We left the session with clear next steps.",
                                        public_consent=True,
                                        anonymous=True,
                                    )
                                )
                                await session_review_service._recompute(db, profile)
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
    print(f"  + team states (3d deactivated member / pending invite): {team_state_added}")
    print(f"  + milestones (5b): {milestones_added}")
    print(f"  + tasks (5c): {tasks_added}")
    print(f"  + task labels (5d): {labels_added}")
    print(f"  + task label links (5d): {task_label_links_added}")
    print(f"  + readiness items (5f): {readiness_added}")
    print(f"  + mentor directory profiles (8a): {mentors8a_added}")
    print(f"  + mentorships (8b): {mentorships_added}")
    print(f"  + availability windows (8c): {availability_added}")
    print(f"  + sessions (8d): {sessions_added}")
    print(f"  + deliverables (8e): {deliverables_added}")
    print(f"  + earnings (8h): {earnings_added}")
    print(f"  + stage tool progress (5i/5j): {tools_added}")
    print(f"  + market size (5l): {market_added}")
    print(f"  + competitors (5l): {competitors_added}")
    print(f"  + talent profile: {talent_added}")
    print(f"  + mentor profile: {mentor_added}")
    print(f"\nPassword for all seeded accounts: {DEV_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
