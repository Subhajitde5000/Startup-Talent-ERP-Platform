"""Dev-only seed: demo accounts (Step 2) + profile/skills/readiness (Step 3).

Run (from backend/):

    ../.venv/bin/python scripts/seed_dev.py

- Refuses to run unless ENVIRONMENT=development — never use this in production.
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
import uuid
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

# Allow `python scripts/seed_dev.py` from backend/ without installing the pkg.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import async_session_factory, engine  # noqa: E402
from app.models.activity import ActivityEvent  # noqa: E402
from app.models.analytics import StartupCompetitor, StartupMarketSize  # noqa: E402
from app.models.availability import AvailabilitySlot  # noqa: E402
from app.models.commitment import (  # noqa: E402
    Commitment,
    CommitmentStatus,
    PortfolioHolding,
)
from app.models.deliverable import DeliverableStatus, MentorDeliverable  # noqa: E402
from app.models.diligence import (  # noqa: E402
    InvestorDiligenceChecklist,
    InvestorDiligenceItem,
)
from app.models.earning import EarningStatus, MentorEarning  # noqa: E402
from app.models.funding_round import (  # noqa: E402
    FundingRound,
    FundingRoundType,
    InstrumentType,
    RoundStatus,
)
from app.models.investor_deal import InvestorDeal, PipelineStage  # noqa: E402
from app.models.investor_engagement import (  # noqa: E402
    InvestorEngagementRequest,
    InvestorMeeting,
    MeetingStatus,
    MeetingType,
    RequestKind,
    RequestStatus,
)
from app.models.investor_offer import InvestorOffer, OfferStatus  # noqa: E402
from app.models.investor_search import (  # noqa: E402
    InvestorPreference,
    InvestorType,
    SavedSearch,
    ShortlistEntry,
    ShortlistStatus,
)
from app.models.job import Job, JobStatus  # noqa: E402
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

# Step 9a demo funding rounds (moved out of the wired rounds page's inline
# demo data). `committed_amount` is written directly here so the dev UI
# shows a non-zero progress bar exactly like the old demo did; in 9a the
# API keeps committed_amount server-only (starts at 0) and only 9i/9j will
# ever write it through the app. Fill-only: a round with the same name in
# the founder's org is never duplicated.
STEP9A_ROUNDS: list[dict[str, object]] = [
    {
        "name": "Pre-seed Round",
        "round_type": FundingRoundType.pre_seed,
        "target_amount": Decimal("25000000.00"),
        "committed_amount": Decimal("8000000.00"),
        "currency": "INR",
        "pre_money_valuation": Decimal("80000000.00"),
        "instrument": InstrumentType.equity,
        "status": RoundStatus.open,
        "opens_on": date(2026, 10, 10),
        "closes_on": date(2027, 3, 31),
        "min_raise": Decimal("15000000.00"),
        "min_ticket": Decimal("1000000.00"),
    },
    {
        "name": "Seed Round",
        "round_type": FundingRoundType.seed,
        "target_amount": Decimal("50000000.00"),
        "committed_amount": Decimal("0"),
        "currency": "INR",
        "pre_money_valuation": None,
        "instrument": InstrumentType.safe,
        "status": RoundStatus.draft,
        "opens_on": None,
        "closes_on": date(2027, 6, 30),
        "min_raise": None,
        "min_ticket": None,
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

# Step 9b/9d: demo investor firms for the investor directory (9b) and the
# investor's thesis preferences (9d). The directory reads each
# investor_firm org joined with its investor_preferences row, so both are
# seeded together. Fill-only: an existing org is never duplicated, and an
# existing preference row is left untouched.
STEP9B_INVESTOR_FIRMMS: list[dict[str, object]] = [
    {
        "owner_email": "investor@forma.dev",
        "name": "Zenith Capital",
        "city": "Mumbai, India",
        "investor_type": InvestorType.fund,
        "sectors": ["B2B SaaS", "Fintech Infrastructure", "Developer Tools & Cloud"],
        "stage_focus": ["prototype", "early_revenue", "growth"],
        "min_ticket": Decimal("2500000.00"),
        "max_ticket": Decimal("25000000.00"),
        "summary": (
            "Early-stage B2B SaaS fund writing first cheques into Indian and "
            "cross-border founders, with follow-on capacity through Series A."
        ),
    },
    {
        "owner_email": "angel@forma.dev",
        "name": "Forma Angel Syndicate",
        "city": "Bengaluru, India",
        "investor_type": InvestorType.angel_group,
        "sectors": ["Fintech", "Climate", "DeepTech"],
        "stage_focus": ["idea", "prototype", "early_revenue"],
        "min_ticket": Decimal("500000.00"),
        "max_ticket": Decimal("5000000.00"),
        "summary": (
            "A syndicate of operators backing pre-seed founders with domain "
            "expertise, customer introductions and clean first-round structuring."
        ),
    },
    {
        "owner_email": "seed@forma.dev",
        "name": "Meridian Seed Fund",
        "city": "Hyderabad, India",
        "investor_type": InvestorType.fund,
        "sectors": ["B2B SaaS", "Healthcare", "EdTech"],
        "stage_focus": ["early_revenue", "growth"],
        "min_ticket": Decimal("1000000.00"),
        "max_ticket": Decimal("10000000.00"),
        "summary": (
            "Seed-stage investor focused on revenue-positive B2B companies "
            "with strong unit economics and clear product-market fit."
        ),
    },
]

# Step 9c: demo opted-in startups for the investor discovery list. Each is a
# startup org with a public profile + one open round so the discovery card
# shows the same fields the old inline demo did (traction, readiness, round
# target/committed). Fill-only by org name; the round is keyed by name.
STEP9C_STARTUPS: list[dict[str, object]] = [
    {
        "name": "Acme Studio",
        "city": "Bengaluru, India",
        "slug_hint": "acme",
        "profile": {
            "tagline": "Making financial operations effortless for growing businesses.",
            "stage": StartupStage.prototype,
            "sector": "Fintech",
            "business_model": "B2B SaaS · SaaS Subscription",
            "problem": "SMBs make high-stakes decisions on fragmented financial data and spreadsheets.",
            "solution": "A live workspace connecting accounts, forecasting runway and turning signals into next steps.",
            "market": "SMB finance software · India first",
            "traction_summary": "₹4.8L MRR · 126 paying customers · 12% MoM growth",
            "mentor_verified": True,
            "readiness_score": 82,
            "profile_visibility": ProfileVisibility.public,
        },
        "round": {
            "name": "Seed Round",
            "round_type": FundingRoundType.seed,
            "target_amount": Decimal("20000000.00"),
            "committed_amount": Decimal("8000000.00"),
            "currency": "INR",
            "instrument": InstrumentType.equity,
            "status": RoundStatus.open,
            "opens_on": date(2026, 10, 10),
            "closes_on": date(2027, 3, 31),
            "min_raise": Decimal("15000000.00"),
            "min_ticket": Decimal("1000000.00"),
        },
    },
    {
        "name": "GreenLedger",
        "city": "Pune, India",
        "slug_hint": "greenledger",
        "profile": {
            "tagline": "Carbon accounting that turns emissions data into audit-ready reports.",
            "stage": StartupStage.early_revenue,
            "sector": "Climate",
            "business_model": "B2B SaaS · Subscription + usage",
            "problem": "Founders cannot reliably measure or report Scope 1 and 2 emissions.",
            "solution": "Automated emissions tracking and audit-ready reporting for mid-market firms.",
            "market": "Carbon accounting · India + EU",
            "traction_summary": "₹12L MRR · 34 enterprise customers · 18% MoM growth",
            "mentor_verified": True,
            "readiness_score": 76,
            "profile_visibility": ProfileVisibility.public,
        },
        "round": {
            "name": "Pre-seed Round",
            "round_type": FundingRoundType.pre_seed,
            "target_amount": Decimal("7500000.00"),
            "committed_amount": Decimal("1350000.00"),
            "currency": "INR",
            "instrument": InstrumentType.safe,
            "status": RoundStatus.open,
            "opens_on": date(2026, 9, 15),
            "closes_on": date(2027, 1, 31),
            "min_raise": Decimal("5000000.00"),
            "min_ticket": Decimal("500000.00"),
        },
    },
    {
        "name": "Northstar Health",
        "city": "Hyderabad, India",
        "slug_hint": "northstar-health",
        "profile": {
            "tagline": "Patient intake and scheduling for outpatient clinics.",
            "stage": StartupStage.idea,
            "sector": "Healthcare",
            "business_model": "B2B SaaS · Per-clinic subscription",
            "problem": "Outpatient clinics run on paper and phone queues, losing bookings and staff time.",
            "solution": "A lightweight intake and scheduling layer that plugs into existing clinic workflows.",
            "market": "Outpatient clinic ops · India first",
            "traction_summary": "Prototype in pilot with 2 clinics; first paying customer pending.",
            "mentor_verified": False,
            "readiness_score": 68,
            "profile_visibility": ProfileVisibility.public,
        },
        "round": {
            "name": "Idea Stage Round",
            "round_type": FundingRoundType.pre_seed,
            "target_amount": Decimal("4000000.00"),
            "committed_amount": Decimal("0"),
            "currency": "INR",
            "instrument": InstrumentType.safe,
            "status": RoundStatus.draft,
            "opens_on": None,
            "closes_on": date(2027, 5, 31),
            "min_raise": None,
            "min_ticket": None,
        },
    },
    {
        "name": "Kavach Cyber",
        "city": "Bengaluru, India",
        "slug_hint": "kavach-cyber",
        "profile": {
            "tagline": "API security and identity compliance for fintechs.",
            "stage": StartupStage.prototype,
            "sector": "Cybersecurity",
            "business_model": "B2B SaaS · Annual license",
            "problem": "Compliance audits take months and expose API leaks.",
            "solution": "Continuous scanning and automated zero-trust authorization.",
            "market": "Cybersecurity · India + US",
            "traction_summary": "₹2.4L MRR · 8 enterprise pilots",
            "mentor_verified": True,
            "readiness_score": 80,
            "profile_visibility": ProfileVisibility.public,
        },
        "round": {
            "name": "Pre-seed Round",
            "round_type": FundingRoundType.pre_seed,
            "target_amount": Decimal("10000000.00"),
            "committed_amount": Decimal("3500000.00"),
            "currency": "INR",
            "instrument": InstrumentType.safe,
            "status": RoundStatus.open,
            "opens_on": date(2026, 11, 1),
            "closes_on": date(2027, 4, 30),
            "min_raise": Decimal("6000000.00"),
            "min_ticket": Decimal("1000000.00"),
        },
    },
    {
        "name": "LogiPulse",
        "city": "Chennai, India",
        "slug_hint": "logipulse",
        "profile": {
            "tagline": "Inter-city freight optimization and route intelligence.",
            "stage": StartupStage.early_revenue,
            "sector": "Logistics",
            "business_model": "Marketplace fee + telematics subscription",
            "problem": "Empty return trips waste 35% of inter-city trucking capacity.",
            "solution": "Backhaul algorithmic load matching for mid-size fleet operators.",
            "market": "Logistics tech · India",
            "traction_summary": "₹8.5L MRR · 42 fleet owners · 22% MoM growth",
            "mentor_verified": True,
            "readiness_score": 75,
            "profile_visibility": ProfileVisibility.public,
        },
        "round": {
            "name": "Seed Round",
            "round_type": FundingRoundType.seed,
            "target_amount": Decimal("18000000.00"),
            "committed_amount": Decimal("12000000.00"),
            "currency": "INR",
            "instrument": InstrumentType.equity,
            "status": RoundStatus.open,
            "opens_on": date(2026, 10, 1),
            "closes_on": date(2027, 2, 28),
            "min_raise": Decimal("12000000.00"),
            "min_ticket": Decimal("1500000.00"),
        },
    },
    {
        "name": "RuralFlow",
        "city": "Jaipur, India",
        "slug_hint": "ruralflow",
        "profile": {
            "tagline": "B2B supply chain connecting organic farmers to modern retail.",
            "stage": StartupStage.early_revenue,
            "sector": "Agtech",
            "business_model": "Take rate on gross merchandise volume",
            "problem": "Post-harvest loss in organic supply chains exceeds 28%.",
            "solution": "Temperature-monitored micro-warehousing and direct store deliveries.",
            "market": "Agtech · Tier 2/3 India",
            "traction_summary": "₹15L monthly GMV · 210 farmers onboarded",
            "mentor_verified": False,
            "readiness_score": 70,
            "profile_visibility": ProfileVisibility.public,
        },
        "round": {
            "name": "Bridge Round",
            "round_type": FundingRoundType.bridge,
            "target_amount": Decimal("5000000.00"),
            "committed_amount": Decimal("2000000.00"),
            "currency": "INR",
            "instrument": InstrumentType.convertible_note,
            "status": RoundStatus.open,
            "opens_on": date(2026, 10, 15),
            "closes_on": date(2027, 3, 15),
            "min_raise": Decimal("3000000.00"),
            "min_ticket": Decimal("500000.00"),
        },
    },
]

# Step 9d: demo saved searches and shortlist entries for the primary
# investor firm (Zenith Capital). Fill-only by name / (firm, startup).
STEP9D_SAVED_SEARCHES: list[dict[str, object]] = [
    {
        "name": "Pre-seed fintech · India",
        "criteria": {
            "stage": "prototype",
            "sector": "Fintech",
            "investment_ready_only": False,
        },
    },
    {
        "name": "Climate · Seed",
        "criteria": {
            "stage": "early_revenue",
            "sector": "Climate",
            "investment_ready_only": True,
        },
    },
]

STEP9D_SHORTLIST: list[dict[str, object]] = [
    {"startup": "Acme Studio", "note": "Strong fintech ops thesis; request intro.", "status": "reviewing"},
    {"startup": "GreenLedger", "note": "Climate angle fits our thesis.", "status": "new"},
]

# Step 9e: demo pipeline deals for the primary investor firm, spread across
# the active stages so the board/table/funnel all render. `days_ago` sets
# last_activity_at; `startup` matches a STEP9C_STARTUPS name (or the
# founder's Northstar Labs org). Fill-only by (firm, startup, stage).
STEP9E_DEALS: list[dict[str, object]] = [
    {"startup": "Acme Studio", "stage": "diligence", "ticket": "3000000", "probability": 60, "next_step": "Review data room", "days_ago": 2, "owner": "investor@forma.dev"},
    {"startup": "GreenLedger", "stage": "meeting", "ticket": "1500000", "probability": 45, "next_step": "Schedule follow-up call", "days_ago": 1, "owner": "investor@forma.dev"},
    {"startup": "Kavach Cyber", "stage": "data_room", "ticket": "2000000", "probability": 50, "next_step": "Send NDA", "days_ago": 6, "owner": "investor@forma.dev"},
    {"startup": "Northstar Health", "stage": "interested", "ticket": "1000000", "probability": 20, "next_step": "Initial outreach", "days_ago": 20, "owner": "investor@forma.dev"},
    # Step 9m: a deal on the founder's own org so the startup investor hub
    # (deals in pipeline, interested investors card) shows real data.
    {"startup": "Northstar Labs Pvt Ltd", "stage": "intro", "ticket": "1500000", "probability": 35, "next_step": "Schedule first call", "days_ago": 3, "owner": "investor@forma.dev"},
    {"startup": "LogiPulse", "stage": "offer", "ticket": "2500000", "probability": 75, "next_step": "Final terms", "days_ago": 3, "owner": "investor@forma.dev"},
    {"startup": "RuralFlow", "stage": "intro", "ticket": "1200000", "probability": 35, "next_step": "Warm intro via mentor", "days_ago": 9, "owner": "investor@forma.dev"},
]

# ---------------------------------------------------------------------------
# Steps 9f/9i/9j/9k/9l: demo records for the wired engagement, offers,
# commitments/portfolio, diligence and dashboard pages — moved out of the
# frontend's inline demo data so the dev UI is populated from the real
# API. All keyed by the startup/round names seeded in 9a/9c above. Fill-only:
# existing rows are never duplicated or overwritten.
# ---------------------------------------------------------------------------

# 9f: engagement requests + meetings. `startup` matches a STEP9C_STARTUPS
# name (or the founder's Northstar Labs org). `days_ago` sets created_at.
STEP9F_REQUESTS: list[dict[str, object]] = [
    {
        "startup": "Acme Studio",
        "kind": RequestKind.intro,
        "ask": "Request an introduction to the founding team.",
        "message": "We back fintech ops tooling at seed stage and would love to learn more.",
        "status": RequestStatus.pending,
        "days_ago": 4,
    },
    {
        "startup": "GreenLedger",
        "kind": RequestKind.meeting,
        "ask": "Request a follow-up diligence meeting.",
        "message": "We'd like to walk through the carbon accounting model in detail.",
        "status": RequestStatus.accepted,
        "response_note": "Happy to meet — let's schedule for next week.",
        "days_ago": 6,
    },
    # Step 9m: a pending request on the founder's own org so the hub's
    # pending-requests stat and needs-reply list show real data.
    {
        "startup": "Northstar Labs Pvt Ltd",
        "kind": RequestKind.intro,
        "ask": "Request an introduction to the founding team.",
        "message": "We back early-stage Indian SaaS and would love to learn more about Northstar Labs.",
        "status": RequestStatus.pending,
        "days_ago": 1,
    },
    {
        "startup": "Kavach Cyber",
        "kind": RequestKind.information,
        "ask": "Request the investor information pack.",
        "message": "Could you share your data room and current metrics?",
        "status": RequestStatus.declined,
        "decline_reason": "Not raising right now; revisiting in Q1.",
        "days_ago": 12,
    },
]

STEP9F_MEETINGS: list[dict[str, object]] = [
    {
        "startup": "Acme Studio",
        "meeting_type": MeetingType.intro_call,
        "status": MeetingStatus.confirmed,
        "scheduled_in_days": 2,
        "duration_minutes": 30,
        "agenda": "Intro call — thesis, current traction and next steps.",
        "location": "Zoom",
        "days_ago": 1,
    },
    {
        "startup": "GreenLedger",
        "meeting_type": MeetingType.diligence,
        "status": MeetingStatus.proposed,
        "scheduled_in_days": 9,
        "duration_minutes": 45,
        "agenda": "Deep-dive on the carbon accounting model and unit economics.",
        "location": "Zoom",
        "days_ago": 2,
    },
    # Step 9m: an upcoming meeting on the founder's own org so the hub's
    # meetings-this-month stat and upcoming-meetings card show real data.
    {
        "startup": "Northstar Labs Pvt Ltd",
        "meeting_type": MeetingType.intro_call,
        "status": MeetingStatus.confirmed,
        "scheduled_in_days": 3,
        "duration_minutes": 30,
        "agenda": "Intro call — thesis, traction and next steps.",
        "location": "Zoom",
        "days_ago": 1,
    },
    {
        "startup": "LogiPulse",
        "meeting_type": MeetingType.follow_up,
        "status": MeetingStatus.completed,
        "scheduled_in_days": -5,
        "duration_minutes": 30,
        "agenda": "Follow-up on the freight optimisation pilot results.",
        "location": "Zoom",
        "days_ago": 8,
    },
]

# 9i: offers. `round` matches a STEP9C_STARTUPS round name. For the countered
# offer, the v2 row is linked to the v1 row via parent_offer_id (the same
# shape the counter action produces).
STEP9I_OFFERS: list[dict[str, object]] = [
    {
        "startup": "Acme Studio",
        "round": "Seed Round",
        "amount": "2500000",
        "instrument": "equity",
        "valuation_cap": "100000000",
        "discount_pct": None,
        "status": OfferStatus.sent,
        "version": 1,
        "expires_on": "2026-12-20",
        "notes": "Seed equity offer at a ₹10 Cr cap.",
        "days_ago": 9,
    },
    {
        "startup": "Acme Studio",
        "round": "Seed Round",
        "amount": "2000000",
        "instrument": "equity",
        "valuation_cap": "120000000",
        "discount_pct": 10,
        "status": OfferStatus.countered,
        "version": 2,
        "parent_of": 0,  # index of the v1 offer above
        "expires_on": "2026-12-20",
        "notes": "Counter: raised the cap, added a 10% discount.",
        "days_ago": 5,
    },
    {
        "startup": "GreenLedger",
        "round": "Pre-seed Round",
        "amount": "1000000",
        "instrument": "safe",
        "valuation_cap": "50000000",
        "discount_pct": None,
        "status": OfferStatus.accepted,
        "version": 1,
        "expires_on": None,
        "notes": "Pre-seed SAFE at a ₹5 Cr cap.",
        "days_ago": 20,
    },
    {
        "startup": "LogiPulse",
        "round": "Seed Round",
        "amount": "2500000",
        "instrument": "equity",
        "valuation_cap": None,
        "discount_pct": None,
        "status": OfferStatus.draft,
        "version": 1,
        "expires_on": None,
        "notes": "Draft seed equity offer — not yet sent.",
        "days_ago": 1,
    },
]

# 9j: commitments + portfolio holdings. `round` matches a STEP9C_STARTUPS
# round name; `offer` matches a STEP9I_OFFERS index (0-based) or None.
STEP9J_COMMITMENTS: list[dict[str, object]] = [
    {
        "startup": "GreenLedger",
        "round": "Pre-seed Round",
        "offer_idx": 2,
        "amount": "1000000",
        "status": CommitmentStatus.funded,
        "committed_on": "2026-10-31",
        "funded_on": "2026-11-05",
        "reference": "ZEN-GL-001",
        "days_ago": 20,
    },
    {
        "startup": "Acme Studio",
        "round": "Seed Round",
        "offer_idx": 0,
        "amount": "2000000",
        "status": CommitmentStatus.documented,
        "committed_on": "2026-11-10",
        "reference": "ZEN-AC-002",
        "days_ago": 10,
    },
    {
        "startup": "LogiPulse",
        "round": "Seed Round",
        "offer_idx": None,
        "amount": "1500000",
        "status": CommitmentStatus.pledged,
        "committed_on": "2026-11-15",
        "reference": "ZEN-LP-003",
        "days_ago": 5,
    },
]

STEP9J_HOLDINGS: list[dict[str, object]] = [
    {
        "startup": "GreenLedger",
        "instrument": "safe",
        "invested_amount": "1000000",
        "ownership_pct": 1.8,
        "invested_on": "2026-10-31",
        "status": "active",
        "days_ago": 20,
    },
    {
        "startup": "Acme Studio",
        "instrument": "equity",
        "invested_amount": "2000000",
        "ownership_pct": 2.4,
        "invested_on": "2026-11-10",
        "status": "active",
        "days_ago": 10,
    },
    {
        "startup": "LogiPulse",
        "instrument": "equity",
        "invested_amount": "1500000",
        "ownership_pct": None,
        "invested_on": "2026-08-15",
        "status": "exited",
        "exited_on": "2026-11-01",
        "exit_value": "3200000",
        "days_ago": 90,
    },
]

# 9k: diligence checklists + items, one per startup. `overall` is one of the
# DiligenceOverallStatus values; items carry item_type/severity/status.
STEP9K_CHECKLISTS: list[dict[str, object]] = [
    {
        "startup": "Acme Studio",
        "overall": "in_progress",
        "notes": "Fintech ops thesis is strong; cap-table reconciliation still open.",
        "items": [
            {"item_type": "checklist", "title": "Business model understood", "status": "cleared", "severity": None, "response": None},
            {"item_type": "checklist", "title": "Pricing and customer references", "status": "cleared", "severity": None, "response": None},
            {"item_type": "checklist", "title": "Market size assumptions checked", "status": "cleared", "severity": None, "response": None},
            {"item_type": "checklist", "title": "Financial statements reviewed", "status": "in_progress", "severity": None, "response": None},
            {"item_type": "question", "title": "Can you share monthly revenue reconciliation for Q3?", "status": "answered", "severity": None, "response": "Reconciliation uploaded to the data room."},
            {"item_type": "finding", "title": "Customer concentration", "status": "concern", "severity": "medium", "response": "Top 3 clients account for ~44% of revenue."},
        ],
    },
    {
        "startup": "GreenLedger",
        "overall": "cleared",
        "notes": "Carbon accounting model verified; ready to commit.",
        "items": [
            {"item_type": "checklist", "title": "Business model understood", "status": "cleared", "severity": None, "response": None},
            {"item_type": "checklist", "title": "Market size assumptions checked", "status": "cleared", "severity": None, "response": None},
            {"item_type": "finding", "title": "Strong cohort retention", "status": "cleared", "severity": "strength", "response": "94% net revenue retention across pilot customers."},
        ],
    },
]

# 9l: activity events for the primary investor firm. event_type uses the
# ActivityEventType vocabulary; created_at is set relative to now.
STEP9L_ACTIVITY: list[dict[str, object]] = [
    {"event_type": "offer_created", "entity_type": "offer", "summary": "Created offer on Acme Studio seed round.", "days_ago": 9},
    {"event_type": "offer_sent", "entity_type": "offer", "summary": "Sent offer to Acme Studio.", "days_ago": 9},
    {"event_type": "offer_countered", "entity_type": "offer", "summary": "Acme Studio countered the seed offer (v2).", "days_ago": 5},
    {"event_type": "offer_accepted", "entity_type": "offer", "summary": "GreenLedger accepted the pre-seed SAFE offer.", "days_ago": 20},
    {"event_type": "deal_stage_changed", "entity_type": "deal", "summary": "Moved Acme Studio deal to the diligence stage.", "days_ago": 4},
    {"event_type": "shortlist_added", "entity_type": "startup", "summary": "Added GreenLedger to the shortlist.", "days_ago": 7},
]

# Step 9m: audit events on the FOUNDER's org so the startup investor hub's
# recent-activity list shows real rows (the 9l block above stamps events on
# the investor firm's org, which the startup-scoped hub feed does not see).
STEP9M_ACTIVITY: list[dict[str, object]] = [
    {"event_type": "round_created", "entity_type": "funding_round", "summary": "Created the Pre-seed Round.", "days_ago": 40},
    {"event_type": "engagement_request_accepted", "entity_type": "engagement_request", "summary": "Accepted an intro request from Zenith Capital.", "days_ago": 6},
    {"event_type": "meeting_status_changed", "entity_type": "meeting", "summary": "Confirmed the intro call with Zenith Capital.", "days_ago": 1},
]

# (email, display name, role, verified?)
SEED_USERS = [
    ("founder@forma.dev", "Aarav Sharma", UserRole.startup, True),
    # Step 5f (plan D3): the platform admin who signs readiness off.
    # Step 15a replaces this with the real admin console + bootstrap.
    ("admin@forma.dev", "Platform Admin", UserRole.admin, True),
    ("mentor@forma.dev", "Meera Iyer", UserRole.mentor, True),
    ("investor@forma.dev", "Rohan Kapoor", UserRole.investor, True),
    # Step 9b: two more investor-firm owners so the directory has a real list.
    ("angel@forma.dev", "Sanjana Rao", UserRole.investor, True),
    ("seed@forma.dev", "Dev Kapadia", UserRole.investor, True),
    ("jobseeker@forma.dev", "Priya Nair", UserRole.jobseeker, True),
    ("employer@forma.dev", "Vikram Singh", UserRole.employer, True),
    ("hiring-admin@forma.dev", "Priya Mehta", UserRole.employer, True),
    ("hiring-member@forma.dev", "Rahul Verma", UserRole.employer, True),
    ("hiring-viewer@forma.dev", "Sana Desai", UserRole.employer, True),
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
    # Step 7j: two opted-in job seekers (moved from the employer demo store's
    # talentResults) so /employer/talent search has real cards in development.
    ("talent-designer@forma.dev", "Ananya Ghosh", UserRole.jobseeker, True),
    ("talent-engineer@forma.dev", "Karthik Iyer", UserRole.jobseeker, True),
]


def _step4_sample_pdf(title: str) -> bytes:
    """Small valid development PDF, not a fake object metadata row."""
    text = f"BT /F1 14 Tf 30 100 Td ({title} - development sample only) Tj ET".encode(
        "ascii"
    )
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length "
        + str(len(text)).encode()
        + b" >>\nstream\n"
        + text
        + b"\nendstream",
    ]
    data = b"%PDF-1.4\n"
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f"{number} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(data)
    data += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    data += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    return (
        data
        + f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )


async def seed_step4_files(
    db: AsyncSession, organization: Organization, owner: User | None
) -> None:
    """Called only by this development seed; real bytes use the normal processor."""
    import io
    import zipfile

    from app.models.file import File, FileKind
    from app.schemas.file import FileUploadCreate
    from app.services import file_service
    from app.services.file_processing_service import get_scanner, process_file
    from app.services.storage_service import get_storage

    settings = get_settings()
    if settings.ENVIRONMENT != "development":
        raise RuntimeError("Step 4 sample files require ENVIRONMENT=development")
    if (
        not owner
        or not all(
            (
                settings.R2_ACCOUNT_ID,
                settings.R2_ACCESS_KEY_ID,
                settings.R2_SECRET_ACCESS_KEY,
                settings.R2_BUCKET,
            )
        )
        or settings.FILE_SCANNER != "dev_clean"
    ):
        print(
            "  = Step 4 files skipped: configure private R2 and explicitly enable FILE_SCANNER=dev_clean in development; no fake file rows inserted."
        )
        return
    workbook = io.BytesIO()
    with zipfile.ZipFile(workbook, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        )
        archive.writestr(
            "_rels/.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        )
        archive.writestr(
            "xl/workbook.xml",
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Development sample" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        )
        archive.writestr(
            "xl/worksheets/sheet1.xml",
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Development sample only - not financial advice or actual revenue</t></is></c></row></sheetData></worksheet>',
        )
    # Names moved from the old startup profile inline records. Their fabricated
    # sizes/dates/Public/NDA labels are intentionally not seeded.
    samples = [
        (
            "Pitch deck v3.pdf",
            "pitch_deck",
            "application/pdf",
            _step4_sample_pdf("Pitch deck"),
        ),
        (
            "Financial model.xlsx",
            "financial_model",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            workbook.getvalue(),
        ),
        (
            "Product brief.pdf",
            "document",
            "application/pdf",
            _step4_sample_pdf("Product brief"),
        ),
    ]
    storage = get_storage()
    for name, kind, mime, content in samples:
        existing = (
            await db.execute(
                select(File).where(
                    File.owner_org_id == organization.id,
                    File.file_name == name,
                    File.deleted_at.is_(None),
                    File.upload_status == "ready",
                )
            )
        ).scalar_one_or_none()
        if existing:
            continue
        reservation = await file_service.request_upload(
            db,
            owner,
            FileUploadCreate(
                kind=FileKind(kind), file_name=name, mime_type=mime, byte_size=len(content)
            ),
            storage,
            organization.id,
        )
        row = await db.get(File, reservation.file.id)
        assert row is not None and row.upload_storage_key
        await storage.put(row.upload_storage_key, content, mime)
        await file_service.confirm(db, owner, row.id)
        await process_file(row.id, async_session_factory, storage, get_scanner())
        await db.refresh(row)
        if row.upload_status != "ready" or row.scan_status != "clean":
            raise RuntimeError(
                "Step 4 seed file did not pass normal validation/scanning"
            )
    print("  + Step 4 private R2 sample files ready (actual sizes/dates; idempotent)")


async def seed_step9_data_rooms(
    db: AsyncSession,
    startups: dict[str, Organization],
    owner: User | None,
    firms: dict[str, Organization],
) -> None:
    """9g/9h demo records; no phantom files, signatures, view totals or overwritten grants."""
    from app.models.data_room import DataRoom, DataRoomDocument, DataRoomFolder
    from app.models.data_room_access import DataRoomAccessRequest
    from app.models.file import File, FileKind
    from app.schemas.data_room import DocumentCreate, FolderCreate, RoomPut
    from app.schemas.data_room_access import AccessCreate, AccessDecision
    from app.schemas.file import FileUploadCreate
    from app.services import data_room_access_service as access
    from app.services import data_room_service as rooms
    from app.services import file_service
    from app.services.file_processing_service import get_scanner, process_file
    from app.services.storage_service import get_storage

    settings = get_settings()
    if settings.ENVIRONMENT != "development":
        raise RuntimeError("Data-room samples require ENVIRONMENT=development")
    if (
        not owner
        or not all(
            (
                settings.R2_ACCOUNT_ID,
                settings.R2_ACCESS_KEY_ID,
                settings.R2_SECRET_ACCESS_KEY,
                settings.R2_BUCKET,
            )
        )
        or settings.FILE_SCANNER != "dev_clean"
    ):
        print(
            "  = 9g/9h skipped: configure development R2 and FILE_SCANNER=dev_clean; no phantom data-room files inserted"
        )
        return
    storage = get_storage()
    # OrbitPay's old room fixture was not part of the discovery seed. Do not
    # invent funding/profile statistics for it or opt it into discovery.
    orbit = (
        await db.execute(select(Organization).where(Organization.slug == "orbitpay-data-room-dev"))
    ).scalar_one_or_none()
    if orbit is None:
        orbit = Organization(name="OrbitPay", slug="orbitpay-data-room-dev", type="startup")
        db.add(orbit)
        await db.commit()
    targets = list(
        {
            org.id: org
            for org in [
                *list(startups.values())[:1],
                *[startups[name] for name in ("Acme Studio", "GreenLedger") if name in startups],
                orbit,
            ]
        }.values()
    )
    for org in targets:
        membership = (
            await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.org_id == org.id,
                    OrganizationMember.user_id == owner.id,
                    OrganizationMember.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if membership is None:
            # Never seize a pre-existing dev organization owned by somebody else.
            occupied = (
                await db.execute(
                    select(OrganizationMember.id)
                    .where(
                        OrganizationMember.org_id == org.id, OrganizationMember.deleted_at.is_(None)
                    )
                    .limit(1)
                )
            ).first()
            if occupied:
                continue
            db.add(
                OrganizationMember(
                    org_id=org.id,
                    user_id=owner.id,
                    role=OrgRole.owner,
                    status=MemberStatus.active,
                    joined_at=datetime.now(UTC),
                )
            )
            await db.commit()
        elif membership.role not in {OrgRole.owner, OrgRole.admin}:
            continue
        await seed_step4_files(db, org, owner)
        room = (
            await db.execute(select(DataRoom).where(DataRoom.org_id == org.id))
        ).scalar_one_or_none()
        if room is None:
            room = await rooms.put_room(
                db, owner, org.id, RoomPut(nda_required=org.name not in {"Acme Studio", "OrbitPay"})
            )
        if room.nda_required and room.nda_file_id is None:
            name = "Development sample NDA - not legal advice.pdf"
            nda = (
                await db.execute(
                    select(File).where(
                        File.owner_org_id == org.id,
                        File.file_name == name,
                        File.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if nda is None:
                content = _step4_sample_pdf("DEVELOPMENT NDA SAMPLE - NOT LEGAL ADVICE")
                reserved = await file_service.request_upload(
                    db,
                    owner,
                    FileUploadCreate(
                        kind=FileKind.legal,
                        file_name=name,
                        mime_type="application/pdf",
                        byte_size=len(content),
                    ),
                    storage,
                    org.id,
                )
                nda = await db.get(File, reserved.file.id)
                assert nda is not None and nda.upload_storage_key
                await storage.put(nda.upload_storage_key, content, "application/pdf")
                await file_service.confirm(db, owner, nda.id)
                await process_file(nda.id, async_session_factory, storage, get_scanner())
                await db.refresh(nda)
            if nda.upload_status == "ready" and nda.scan_status == "clean":
                room = await rooms.put_room(db, owner, org.id, RoomPut(nda_file_id=nda.id))
        folders: dict[str, DataRoomFolder] = {}
        for order, name in enumerate(
            ("Corporate", "Financials", "Legal", "Product", "Team", "Customers", "Pitch")
        ):
            folder = (
                (
                    await db.execute(
                        select(DataRoomFolder).where(
                            DataRoomFolder.data_room_id == room.id, DataRoomFolder.name == name
                        )
                    )
                )
                .scalars()
                .first()
            )
            if folder is None:
                folder = await rooms.save_folder(
                    db, owner, org.id, FolderCreate(name=name, display_order=order)
                )
            if folder.deleted_at is None:
                folders[name] = folder
        for name, folder_name, visibility in (
            ("Pitch deck v3.pdf", "Pitch", "approved_investors"),
            ("Financial model.xlsx", "Financials", "private"),
            ("Product brief.pdf", "Product", "approved_investors"),
        ):
            folder = folders.get(folder_name)
            if folder is None:
                continue
            existing = (
                await db.execute(
                    select(DataRoomDocument.id).where(
                        DataRoomDocument.folder_id == folder.id, DataRoomDocument.name == name
                    )
                )
            ).first()
            file = (
                (
                    await db.execute(
                        select(File).where(
                            File.owner_org_id == org.id,
                            File.file_name == name,
                            File.deleted_at.is_(None),
                            File.upload_status == "ready",
                            File.scan_status == "clean",
                        )
                    )
                )
                .scalars()
                .first()
            )
            if existing is None and file:
                await rooms.create_document(
                    db,
                    owner,
                    org.id,
                    DocumentCreate(
                        folder_id=folder.id, file_id=file.id, name=name, visibility=visibility
                    ),
                )
        emails = (
            ["investor@forma.dev"]
            if org.name in {"Acme Studio", "GreenLedger", "OrbitPay"}
            else ["investor@forma.dev", "angel@forma.dev"]
        )
        for email in emails:
            actor = (
                await db.execute(select(User).where(User.primary_email == email))
            ).scalar_one_or_none()
            if actor is None or email not in firms:
                continue
            # Terminal states and developer edits survive reruns; no resurrection.
            existing = (
                await db.execute(
                    select(DataRoomAccessRequest.id).where(
                        DataRoomAccessRequest.data_room_id == room.id,
                        DataRoomAccessRequest.requester_id == actor.id,
                    )
                )
            ).first()
            if existing:
                continue
            request = await access.create_request(
                db,
                actor,
                AccessCreate(
                    startup_org_id=org.id,
                    message="Development sample: evaluating your seed round and reviewing your projections."
                    if email == "investor@forma.dev"
                    else "Development sample: interested in your customer validation.",
                ),
            )
            if (
                org.name in {"Acme Studio", "GreenLedger"}
                and folders.get("Pitch")
                and folders.get("Product")
            ):
                await access.decide(
                    db,
                    owner,
                    org.id,
                    request.id,
                    AccessDecision(
                        action="approve", scope=[folders["Pitch"].id, folders["Product"].id]
                    ),
                )
        # Intentionally no fabricated NDA acceptance or historic document views.
    print(
        "  + 9g/9h development rooms/folders/documents/personal requests (fill-only; actual file metadata)"
    )


# Step 7a records moved from employer-data.js and the wired job editor/detail.
# Closing soon -> open (deadlines deferred); pending approval -> draft (7i).
STEP7A_JOBS = [
    ("job-1", "Product Designer", "Kolkata, West Bengal", "hybrid", JobStatus.open, 12),
    ("job-2", "Software Engineer", "Remote, India", "remote", JobStatus.open, 21),
    ("job-3", "UX Researcher", "Bengaluru, Karnataka", "onsite", JobStatus.open, 8),
    ("job-4", "Engineering Manager", "Pune, Maharashtra", "hybrid", JobStatus.draft, 6),
]
STEP7A_TEAM = {"hiring-admin@forma.dev": OrgRole.admin, "hiring-member@forma.dev": OrgRole.member, "hiring-viewer@forma.dev": OrgRole.viewer}


async def seed_step7a_jobs(db: AsyncSession, org: Organization, owner: User) -> int:
    """Development-only, stable IDs; never overwrite edits or resurrect archives."""
    if get_settings().ENVIRONMENT != "development":
        raise RuntimeError("Job samples require ENVIRONMENT=development")
    now = datetime.now(UTC)
    for email, role in STEP7A_TEAM.items():
        user = (await db.execute(select(User).where(User.primary_email == email))).scalar_one_or_none()
        if user is None:
            continue
        exists = (await db.execute(select(OrganizationMember.id).where(OrganizationMember.org_id == org.id, OrganizationMember.user_id == user.id))).first()
        if exists is None:
            db.add(OrganizationMember(org_id=org.id, user_id=user.id, role=role, status=MemberStatus.active, joined_at=now))
    added = 0
    for key, title, location, mode, status, days in STEP7A_JOBS:
        job_id = uuid.uuid5(org.id, f"step7a:{key}")
        if await db.get(Job, job_id) is not None:
            continue
        row = Job(
            id=job_id, org_id=org.id, title=title, location=location, work_mode=mode,
            status=status, owner_id=owner.id, created_by=owner.id,
            description=f"We are seeking an experienced {title} to lead core design systems, collaborate closely with frontend engineers, and deliver user-friendly product experiences.",
            responsibilities="Leading architecture and team execution for multi-brand design systems, token workflows, and cross-functional engineering handoffs.",
            requirements="5+ years experience, Figma tokens, React component architectures.",
            salary_min=Decimal("2200000"), salary_max=Decimal("2800000"),
            fair_hiring_confirmed=True,
            posted_at=now - timedelta(days=days) if status == JobStatus.open else None,
        )
        db.add(row)
        added += 1
    await db.commit()
    return added


# Step 7b/7c page records. Funding labels/AI fits/notes/interview fiction are excluded.
STEP7BC_JOBS = [
    {
        "key": "senior-product-designer",
        "title": "Senior Product Designer",
        "company": "Northstar Labs",
        "location": "Remote · India",
        "description": "Northstar Labs is looking for a Senior Product Designer to spearhead end-to-end "
        "design across our core enterprise collaboration suite.",
        "requirements": "5+ years of digital product design experience in high-growth SaaS environments\n"
        "Proven expertise in complex system design, user testing, and Figma design "
        "systems\n"
        "Strong storytelling and stakeholder communication skills\n"
        "Portfolio demonstrating shipped products with measurable business impact",
        "skills": [
            "Figma",
            "Design Systems",
            "UX Research",
            "Rapid Prototyping",
            "Product Strategy",
        ],
        "benefits": [
            "Full health insurance for family",
            "Remote work equipment stipend (₹75k)",
            "Annual learning budget (₹50k)",
            "Flexible PTO",
        ],
        "salary": ("1800000", "2400000"),
        "equity": ("0.10", "0.25"),
        "summary": "Northstar Labs builds intuitive productivity software that replaces chaotic meetings "
        "with structured, asynchronous visual workspaces.",
        "founded": 2022,
    },
    {
        "key": "product-designer",
        "title": "Product Designer",
        "company": "Morrow Health",
        "location": "Bengaluru · Hybrid",
        "description": "Join Morrow Health to craft patient-first digital experiences connecting "
        "clinical care teams with chronic care patients.",
        "requirements": "3+ years experience designing consumer mobile and web applications\n"
        "Familiarity with healthcare or regulated fintech UX principles\n"
        "Strong interaction design and micro-animation chops",
        "skills": ["Interaction Design", "Mobile UI", "Figma", "User Journey Mapping"],
        "benefits": [
            "Comprehensive health coverage",
            "Mental wellness stipend",
            "Daily catered lunches at office",
        ],
        "salary": ("1600000", "2200000"),
        "equity": ("0.05", "0.15"),
        "summary": "Morrow Health is transforming chronic ailment management in South Asia via smart "
        "monitoring hardware and personalized clinical dashboards.",
        "founded": 2023,
    },
    {
        "key": "ux-researcher",
        "title": "UX Researcher",
        "company": "Fieldnote",
        "location": "Kolkata · Hybrid",
        "description": "Lead generative and evaluative research studies for Fieldnote’s field "
        "intelligence platform.",
        "requirements": "3+ years leading qualitative and quantitative user research studies\n"
        "Expertise in usability lab testing, diary studies, and survey analysis\n"
        "Ability to translate raw customer insights into actionable product roadmaps",
        "skills": [
            "Qualitative Research",
            "Usability Testing",
            "Card Sorting",
            "Data Synthesis",
        ],
        "benefits": [
            "Hybrid work model (2 days office)",
            "Travel allowance",
            "Health & wellness package",
        ],
        "salary": ("1400000", "1800000"),
        "equity": ("0.05", "0.05"),
        "summary": "Fieldnote supplies farm-gate data and field-level monitoring for enterprise "
        "commodity buyers across India.",
        "founded": 2021,
    },
    {
        "key": "lead-frontend-engineer",
        "title": "Lead Frontend Engineer",
        "company": "OrbitPay",
        "location": "Bengaluru · Remote",
        "description": "Architect next-generation cross-border payment checkout experiences handling "
        "millions in daily volume.",
        "requirements": "6+ years frontend engineering with deep React, Next.js, and TypeScript mastery\n"
        "Experience optimizing Core Web Vitals, accessibility, and bundle performance\n"
        "Track record leading small, autonomous squads",
        "skills": [
            "Next.js",
            "React",
            "TypeScript",
            "Tailwind CSS",
            "Performance Optimization",
        ],
        "benefits": [
            "Top-tier health & dental",
            "₹1.5L annual home office setup budget",
            "Stock option grant",
        ],
        "salary": ("3200000", "4200000"),
        "equity": ("0.20", "0.50"),
        "summary": None,
        "founded": None,
    },
    {
        "key": "design-lead",
        "title": "Design Lead",
        "company": "Lattice Works",
        "location": None,
        "description": "Development sample parent for the former application tracker record.",
        "requirements": None,
        "skills": [],
        "benefits": [],
        "salary": (None, None),
        "equity": (None, None),
        "summary": None,
        "founded": None,
    },
]
STEP7BC_APPLICATIONS = [
    {"job": "senior-product-designer", "stage": "interview", "salary": "2200000"},
    {"job": "product-designer", "stage": "shortlisted", "salary": "1800000"},
    {"job": "ux-researcher", "stage": "applied", "salary": "1600000"},
    {"job": "design-lead", "stage": "rejected", "salary": "2400000"},
]


async def seed_step7bc_careers(db: AsyncSession, owner: User, candidate: User) -> None:
    """Fill-only development samples; never resurrect deleted records or rewrite stages."""
    if get_settings().ENVIRONMENT != "development":
        raise RuntimeError("Career samples require ENVIRONMENT=development")
    from app.models.job import JobBenefit, JobSkill
    from app.models.job_application import ApplicationStageEvent, JobApplication
    from app.schemas.job_application import ApplicationCreate
    from app.services import job_application_service

    namespace = uuid.uuid5(uuid.NAMESPACE_URL, "forma:development:careers:7bc")
    now = datetime.now(UTC)
    seeded_jobs = {}
    for spec in STEP7BC_JOBS:
        org_id = uuid.uuid5(namespace, "company:" + spec["company"])
        org = await db.get(Organization, org_id)
        if org is None:
            org = Organization(
                id=org_id,
                name=spec["company"],
                slug="dev-careers-"
                + re.sub(r"[^a-z0-9]+", "-", spec["company"].lower()),
                type="employer",
                summary=spec["summary"],
                founded_year=spec["founded"],
            )
            db.add(org)
            await db.flush()
            db.add(
                OrganizationMember(
                    org_id=org.id,
                    user_id=owner.id,
                    role=OrgRole.owner,
                    status=MemberStatus.active,
                    joined_at=now,
                )
            )
        if org.deleted_at is not None or org.status != "active":
            continue
        job_id = uuid.uuid5(namespace, "job:" + spec["key"])
        job = await db.get(Job, job_id)
        if job is None:
            job = Job(
                id=job_id,
                org_id=org_id,
                title=spec["title"],
                description=spec["description"],
                requirements=spec["requirements"],
                location=spec["location"],
                work_mode="remote"
                if spec["key"] in {"senior-product-designer", "lead-frontend-engineer"}
                else "hybrid",
                status="open",
                posted_at=now - timedelta(days=2),
                salary_min=Decimal(spec["salary"][0]) if spec["salary"][0] else None,
                salary_max=Decimal(spec["salary"][1]) if spec["salary"][1] else None,
                equity_min_pct=Decimal(spec["equity"][0])
                if spec["equity"][0]
                else None,
                equity_max_pct=Decimal(spec["equity"][1])
                if spec["equity"][1]
                else None,
                owner_id=owner.id,
                created_by=owner.id,
                fair_hiring_confirmed=True,
                screening_questions=[
                    {"key": "notice_period", "required": True},
                    {"key": "remote_comfort", "required": False},
                ],
            )
            db.add(job)
            await db.flush()
            for name in spec["skills"]:
                skill = (
                    await db.execute(
                        select(Skill).where(func.lower(Skill.name) == name.lower())
                    )
                ).scalar_one_or_none()
                if skill is None:
                    skill = Skill(name=name)
                    db.add(skill)
                    await db.flush()
                db.add(JobSkill(job_id=job.id, skill_id=skill.id))
            for order, label in enumerate(spec["benefits"]):
                db.add(JobBenefit(job_id=job.id, label=label, display_order=order))
        if job.deleted_at is None:
            seeded_jobs[spec["key"]] = (job, org)
    await db.flush()
    for spec in STEP7BC_APPLICATIONS:
        pair = seeded_jobs.get(spec["job"])
        if pair is None:
            continue
        job, org = pair
        prior = (
            await db.execute(
                select(JobApplication.id).where(
                    JobApplication.job_id == job.id,
                    JobApplication.applicant_id == candidate.id,
                )
            )
        ).first()
        if prior:
            continue
        # Explicit sample consent only for the dedicated dev account, never real users.
        if candidate.primary_email != "jobseeker@forma.dev":
            continue
        payload = ApplicationCreate(
            accuracy_confirmed=True,
            consent_share=True,
            salary_expectation=spec["salary"],
        )
        created = now - timedelta(days=10)
        row = JobApplication(
            id=uuid.uuid5(namespace, "application:" + spec["job"]),
            job_id=job.id,
            applicant_id=candidate.id,
            stage=spec["stage"],
            source="platform",
            salary_expectation=Decimal(spec["salary"]),
            currency="INR",
            consent_share=True,
            accuracy_confirmed_at=created,
            consent_shared_at=created,
            profile_snapshot=await job_application_service.snapshot(
                db, candidate, payload
            ),
            job_snapshot={
                "id": str(job.id),
                "org_id": str(org.id),
                "title": job.title,
                "company_name": org.name,
            },
            screening_answers=[],
            submission_fingerprint=job_application_service.fingerprint(payload),
            stage_changed_at=now,
            created_at=created,
            updated_at=now,
        )
        db.add(row)
        await db.flush()
        db.add(
            ApplicationStageEvent(
                application_id=row.id,
                from_stage=None,
                to_stage="applied",
                actor_id=candidate.id,
                created_at=created,
            )
        )
        if spec["stage"] != "applied":
            db.add(
                ApplicationStageEvent(
                    application_id=row.id,
                    from_stage="applied",
                    to_stage=spec["stage"],
                    actor_id=owner.id,
                    created_at=now,
                )
            )
    # Reuse already-public startup discovery samples; never change profile visibility.
    startups = (
        (
            await db.execute(
                select(Organization)
                .join(StartupProfile, StartupProfile.org_id == Organization.id)
                .where(
                    Organization.type == "startup",
                    Organization.deleted_at.is_(None),
                    Organization.status == "active",
                    StartupProfile.profile_visibility == "public",
                )
                .order_by(Organization.id)
                .limit(2)
            )
        )
        .scalars()
        .all()
    )
    for org in startups:
        id_ = uuid.uuid5(namespace, "startup-job:" + str(org.id))
        if await db.get(Job, id_) is None:
            org_owner = (
                await db.execute(
                    select(OrganizationMember.user_id)
                    .where(
                        OrganizationMember.org_id == org.id,
                        OrganizationMember.role == OrgRole.owner,
                        OrganizationMember.status == MemberStatus.active,
                        OrganizationMember.deleted_at.is_(None),
                    )
                    .order_by(OrganizationMember.user_id)
                    .limit(1)
                )
            ).scalar_one_or_none()
            if org_owner is None:
                continue
            db.add(
                Job(
                    id=id_,
                    org_id=org.id,
                    title="Product Engineer (development sample)",
                    description="Build accessible product experiences with the team. Development sample.",
                    status="open",
                    work_mode="remote",
                    posted_at=now,
                    show_salary_publicly=False,
                    fair_hiring_confirmed=True,
                    created_by=org_owner,
                    owner_id=org_owner,
                )
            )
    await db.commit()


# Step 7d: synthetic development submissions migrated from the applicant demo.
# No fabricated ATS/practice results, messages, interview rounds or qualifications.
STEP7D_APPLICANTS = [
    ("aanya", "Aanya Sen", "Senior Product Designer", "job-1", "applied", False, "2200000.00"),
    ("blind", "Development Blind Applicant", "Software Engineer", "blind", "shortlisted", True, "1800000.00"),
    ("rohan", "Rohan Kapoor", "UX Researcher", "job-3", "interview", False, "2000000.00"),
    # Second applicant on job-1 so the Step 7e compare page has a real
    # side-by-side (the wired page requires at least two per job).
    ("meera", "Meera Iyer", "Product Designer", "job-1", "review", False, "1950000.00"),
]


async def seed_step7d_pipeline(db: AsyncSession, org: Organization, owner: User) -> None:
    """Stable, fill-only dev accounts/submissions; never rewrite an application or policy."""
    settings = get_settings()
    if settings.ENVIRONMENT != "development":
        raise RuntimeError("Applicant samples require ENVIRONMENT=development")
    from app.models.application_note import ApplicationNote
    from app.models.file import File, FileKind
    from app.models.job_application import ApplicationStageEvent, JobApplication
    from app.schemas.file import FileUploadCreate
    from app.schemas.job_application import ApplicationCreate
    from app.services import file_service, job_application_service
    from app.services.file_processing_service import get_scanner, process_file
    from app.services.storage_service import get_storage

    if org.deleted_at or org.status != "active" or owner.primary_email != "employer@forma.dev":
        return
    now = datetime.now(UTC)
    member = (await db.execute(select(User).where(User.primary_email == "hiring-member@forma.dev"))).scalar_one_or_none()
    note_author = (await db.execute(select(User).where(User.primary_email == "hiring-admin@forma.dev"))).scalar_one_or_none()
    if member and not (await db.execute(select(OrganizationMember.id).where(
        OrganizationMember.org_id == org.id, OrganizationMember.user_id == member.id,
        OrganizationMember.status == "active", OrganizationMember.deleted_at.is_(None),
        OrganizationMember.role != OrgRole.viewer,
    ))).first():
        member = None
    if note_author and not (await db.execute(select(OrganizationMember.id).where(
        OrganizationMember.org_id == org.id, OrganizationMember.user_id == note_author.id,
        OrganizationMember.status == "active", OrganizationMember.deleted_at.is_(None),
        OrganizationMember.role.in_([OrgRole.owner, OrgRole.admin]),
    ))).first():
        note_author = None
    for key, name, headline, job_key, stage, blind, salary in STEP7D_APPLICANTS:
        job_id = uuid.uuid5(org.id, "step7d:blind-job") if blind else uuid.uuid5(org.id, f"step7a:{job_key}")
        job = await db.get(Job, job_id)
        if job is None and blind:
            job = Job(
                id=job_id, org_id=org.id, title="Software Engineer — blind review development sample",
                description="Synthetic development job for blind applicant review.",
                requirements="Role-related engineering experience.", work_mode="remote", status="open",
                owner_id=owner.id, created_by=owner.id, blind_review_enabled=True,
                fair_hiring_confirmed=True, posted_at=now,
            )
            db.add(job)
            await db.flush()
        if job is None or job.deleted_at or job.status != "open":
            continue
        user_id = uuid.uuid5(org.id, "step7d:person:" + key)
        user = await db.get(User, user_id)
        if user is None:
            email = f"pipeline-{key}@forma.dev"
            if (await db.execute(select(User.id).where(User.primary_email == email))).first():
                continue  # Never take over a pre-existing account with this address.
            user = User(
                id=user_id, primary_email=email, display_name=name, headline=headline,
                bio="Synthetic development profile for applicant review; not a real candidate.",
                password_hash=hash_password(DEV_PASSWORD), status=AccountStatus.active,
                email_verified_at=now,
            )
            db.add(user)
            await db.flush()
            db.add(UserRoleRow(user_id=user.id, role=UserRole.jobseeker, is_primary=True))
            await db.commit()
        if user.deleted_at or user.status != AccountStatus.active:
            continue
        app_id = uuid.uuid5(org.id, "step7d:application:" + key)
        prior = (await db.execute(select(JobApplication.id).where(
            JobApplication.job_id == job.id, JobApplication.applicant_id == user.id
        ))).first()
        if await db.get(JobApplication, app_id) or prior:
            continue  # Including deleted applications; no resurrection or overwritten decisions.
        file_id = None
        if not blind and getattr(settings, "FILE_SCANNER", "unconfigured") == "dev_clean":
            filename = f"step7d-{key}-development-resume.pdf"
            file = (await db.execute(select(File).where(
                File.uploaded_by == user.id, File.file_name == filename
            ))).scalars().first()
            if file is None:
                storage = get_storage()
                content = _step4_sample_pdf(name)
                reservation = await file_service.request_upload(db, user, FileUploadCreate(
                    kind=FileKind.resume, file_name=filename, mime_type="application/pdf", byte_size=len(content)
                ), storage)
                file = await db.get(File, reservation.file.id)
                assert file and file.upload_storage_key
                await storage.put(file.upload_storage_key, content, "application/pdf")
                await file_service.confirm(db, user, file.id)
                await process_file(file.id, async_session_factory, storage, get_scanner())
                await db.refresh(file)
            if not file.deleted_at and not file.purged_at and file.upload_status == "ready" and file.scan_status == "clean":
                file_id = file.id
        created = now - timedelta(days=2 if key == "aanya" else 4 if blind else 6)
        payload = ApplicationCreate(accuracy_confirmed=True, consent_share=True, salary_expectation=Decimal(salary))
        row = JobApplication(
            id=app_id, job_id=job.id, applicant_id=user.id, stage=stage,
            is_blind=job.blind_review_enabled and stage in {"applied", "review", "shortlisted"},
            source="platform", resume_file_id=file_id, salary_expectation=Decimal(salary), currency="INR",
            consent_share=True, accuracy_confirmed_at=created, consent_shared_at=created,
            profile_snapshot=await job_application_service.snapshot(db, user, payload),
            job_snapshot={"id": str(job.id), "org_id": str(org.id), "title": job.title, "company_name": org.name},
            screening_answers=[], cover_note="Development sample application, not a real submission.",
            submission_fingerprint=job_application_service.fingerprint(payload),
            assignee_id=member.id if member else None,
            created_at=created, updated_at=now, stage_changed_at=now,
        )
        db.add(row)
        await db.flush()
        db.add(ApplicationStageEvent(application_id=row.id, from_stage=None, to_stage="applied", actor_id=user.id, created_at=created))
        if stage != "applied":
            db.add(ApplicationStageEvent(application_id=row.id, from_stage="applied", to_stage=stage, actor_id=owner.id, created_at=now))
        if key == "aanya" and note_author:
            db.add(ApplicationNote(
                id=uuid.uuid5(app_id, "private-demo-note"), application_id=app_id, author_id=note_author.id,
                body="Strong design portfolio, specifically in design systems and multi-platform consistency. Recommended for technical panel. (Synthetic development note.)",
            ))
        await db.commit()


# Step 7e/7f: scorecard, score and interview samples moved out of the wired
# compare / scoring-panel / interview pages' former demo data.
STEP7E_SCORECARD_CRITERIA = [
    ("Problem solving", 25, ["1 = No example given", "4 = Specific example with measurable outcome"]),
    ("Communication", 20, ["1 = Unclear responses", "4 = Clear, structured, audience-appropriate"]),
    ("Role skills", 30, ["1 = Below required level", "4 = Exceeds requirements"]),
    ("Ownership", 15, ["1 = Needs constant direction", "4 = Drives work to completion"]),
    ("Collaboration", 10, ["1 = Works in isolation", "4 = Actively helps teammates"]),
]


async def seed_step7e7f(db: AsyncSession) -> None:
    """Fill-only scorecard/score/interview samples; never rewrites existing rows."""
    if get_settings().ENVIRONMENT != "development":
        raise RuntimeError("Step 7e/7f samples require ENVIRONMENT=development")
    from app.models.interview import Interview, InterviewFeedback, InterviewParticipant
    from app.models.job_application import JobApplication
    from app.models.scorecard import ApplicationScore, Scorecard, ScorecardCriterion

    now = datetime.now(UTC)
    owner = (await db.execute(select(User).where(User.primary_email == "employer@forma.dev"))).scalar_one_or_none()
    if owner is None or owner.deleted_at or owner.status != AccountStatus.active:
        return
    org = (await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(
            OrganizationMember.user_id == owner.id,
            OrganizationMember.role == OrgRole.owner,
            Organization.type == "employer",
            Organization.deleted_at.is_(None),
        )
    )).scalars().first()
    if org is None or org.deleted_at or org.status != "active":
        return
    member = (await db.execute(
        select(User)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(
            OrganizationMember.org_id == org.id,
            User.primary_email == "hiring-member@forma.dev",
            User.deleted_at.is_(None),
            User.status == AccountStatus.active,
            OrganizationMember.status == "active",
            OrganizationMember.deleted_at.is_(None),
            OrganizationMember.role != "viewer",
        )
    )).scalars().first()

    # --- Step 7e: one org-level scorecard (skip orgs that already have cards).
    card_id = uuid.uuid5(org.id, "step7e:scorecard")
    card = await db.get(Scorecard, card_id)
    if card is None:
        foreign = (await db.execute(
            select(Scorecard.id).where(Scorecard.org_id == org.id).limit(1)
        )).first()
        if foreign is None:
            card = Scorecard(
                id=card_id, org_id=org.id, name="Hiring Panel Scorecard",
                job_id=None, is_platform=False,
            )
            db.add(card)
            await db.flush()
            for order, (name, weight, anchors) in enumerate(STEP7E_SCORECARD_CRITERIA):
                db.add(ScorecardCriterion(
                    id=uuid.uuid5(card_id, f"criterion:{order}"),
                    scorecard_id=card_id, name=name, weight=weight,
                    anchors=anchors, display_order=order,
                ))
            await db.flush()
    if card is None:
        await db.commit()
        return

    # Owner scores Aanya; the member scores Rohan (fill-only per author+cell).
    for app_key, scorer, values in (
        ("aanya", owner, (4, 5, 4, 3, 4)),
        ("rohan", member, (3, 4, 5, 3, 5)),
    ):
        if scorer is None:
            continue
        app_id = uuid.uuid5(org.id, "step7d:application:" + app_key)
        if await db.get(JobApplication, app_id) is None:
            continue
        for order, value in enumerate(values):
            criterion_id = uuid.uuid5(card_id, f"criterion:{order}")
            prior = (await db.execute(
                select(ApplicationScore.id).where(
                    ApplicationScore.application_id == app_id,
                    ApplicationScore.criterion_id == criterion_id,
                    ApplicationScore.interviewer_id == scorer.id,
                )
            )).first()
            if prior is not None:
                continue
            db.add(ApplicationScore(
                id=uuid.uuid5(card_id, f"score:{scorer.id}:{app_id}:{order}"),
                application_id=app_id, criterion_id=criterion_id,
                interviewer_id=scorer.id, score=value,
            ))

    # --- Step 7f: employer interviews on the 7d pipeline applications.
    def _at(days: int, hour: int) -> datetime:
        return (now + timedelta(days=days)).replace(
            hour=hour, minute=0, second=0, microsecond=0
        )

    async def _add_interview(
        iid: uuid.UUID, application_id: uuid.UUID, round_name: str,
        fmt: str, status: str, at: datetime, duration: int,
        meeting_url: str | None, panelists: list[User],
        responses: dict[uuid.UUID, str], feedback: list[tuple[User, str, str]],
    ) -> None:
        application = await db.get(JobApplication, application_id)
        if application is None:
            return
        if await db.get(Interview, iid) is None:
            db.add(Interview(
                id=iid, application_id=application_id, round_name=round_name,
                format=fmt, status=status, scheduled_at=at,
                duration_min=duration, meeting_url=meeting_url,
                created_by=owner.id,
            ))
            await db.flush()
        for user_id, side in (
            [(application.applicant_id, "candidate")]
            + [(p.id, "interviewer") for p in panelists]
        ):
            existing = await db.get(InterviewParticipant, (iid, user_id))
            if existing is not None:
                continue
            response = responses.get(user_id)
            db.add(InterviewParticipant(
                interview_id=iid, user_id=user_id, side=side,
                response=response,
                responded_at=(
                    min(at - timedelta(days=1), now) if response else None
                ),
            ))
        for author, recommendation, summary in feedback:
            fb_id = uuid.uuid5(iid, f"feedback:{author.id}")
            prior = (await db.execute(
                select(InterviewFeedback.id).where(
                    InterviewFeedback.interview_id == iid,
                    InterviewFeedback.author_id == author.id,
                )
            )).first()
            if prior is not None:
                continue
            db.add(InterviewFeedback(
                id=fb_id, interview_id=iid, author_id=author.id,
                recommendation=recommendation, summary=summary,
                submitted_at=now - timedelta(days=1),
            ))
        await db.flush()

    aanya_app = uuid.uuid5(org.id, "step7d:application:aanya")
    rohan_app = uuid.uuid5(org.id, "step7d:application:rohan")
    if member is not None:
        await _add_interview(
            uuid.uuid5(org.id, "step7f:interview:aanya-panel"),
            aanya_app, "Technical Panel", "video", "scheduled",
            _at(2, 10), 45, "https://meet.forma.dev/interview-aanya-panel-dev",
            [owner, member],
            {member.id: "accepted"},
            [],
        )
    await _add_interview(
        uuid.uuid5(org.id, "step7f:interview:rohan-screen"),
        rohan_app, "Recruiter Screen", "phone", "scheduled",
        _at(4, 11), 30, None,
        [owner],
        {},
        [],
    )
    if member is not None:
        await _add_interview(
            uuid.uuid5(org.id, "step7f:interview:rohan-final"),
            rohan_app, "Final Round", "video", "completed",
            _at(-2, 14), 60, "https://meet.forma.dev/interview-rohan-final-dev",
            [owner, member],
            {},
            [(owner, "yes", "Strong research portfolio; clear problem framing. Hire.")],
        )

    # --- Step 7f: two interviews for the jobseeker dev account (7bc apps).
    candidate = (await db.execute(
        select(User).where(User.primary_email == "jobseeker@forma.dev")
    )).scalar_one_or_none()
    if candidate is not None and not candidate.deleted_at:
        ns = uuid.uuid5(uuid.NAMESPACE_URL, "forma:development:careers:7bc")
        spd_app = uuid.uuid5(ns, "application:senior-product-designer")
        pd_app = uuid.uuid5(ns, "application:product-designer")
        await _add_interview(
            uuid.uuid5(spd_app, "step7f:interview:js-portfolio"),
            spd_app, "Portfolio Conversation", "video", "scheduled",
            _at(3, 15), 45, "https://meet.forma.dev/interview-jobseeker-portfolio-dev",
            [owner],
            {},
            [],
        )
        await _add_interview(
            uuid.uuid5(pd_app, "step7f:interview:js-manager"),
            pd_app, "Hiring Manager Chat", "video", "completed",
            _at(-5, 12), 30, "https://meet.forma.dev/interview-jobseeker-manager-dev",
            [owner],
            {candidate.id: "accepted"},
            [(owner, "yes", "Solid portfolio walkthrough; move forward with the panel.")],
        )

    await db.commit()



# Step 7g/7h: job-offer, hire and onboarding-checklist samples (fill-only).
async def seed_step7g7h(db: AsyncSession) -> None:
    """Fill-only offer/hire/checklist samples; never rewrites an existing row."""
    if get_settings().ENVIRONMENT != "development":
        raise RuntimeError("Step 7g/7h samples require ENVIRONMENT=development")
    from app.models.hire import (
        Hire,
        HireOnboardingItem,
        HireStatus,
        OnboardingItemStatus,
        OnboardingTemplate,
        OnboardingTemplateItem,
    )
    from app.models.job_application import ApplicationStageEvent, JobApplication
    from app.models.offer import JobOffer, JobOfferStatus

    now = datetime.now(UTC)
    owner = (
        await db.execute(select(User).where(User.primary_email == "employer@forma.dev"))
    ).scalar_one_or_none()
    if owner is None or owner.deleted_at or owner.status != AccountStatus.active:
        return
    org = (
        await db.execute(
            select(Organization)
            .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
            .where(
                OrganizationMember.user_id == owner.id,
                OrganizationMember.role == OrgRole.owner,
                Organization.type == "employer",
                Organization.deleted_at.is_(None),
            )
        )
    ).scalars().first()
    if org is None or org.deleted_at or org.status != "active":
        return
    member = (
        await db.execute(
            select(User)
            .join(OrganizationMember, OrganizationMember.user_id == User.id)
            .where(
                OrganizationMember.org_id == org.id,
                User.primary_email == "hiring-member@forma.dev",
                User.deleted_at.is_(None),
                User.status == AccountStatus.active,
                OrganizationMember.status == "active",
                OrganizationMember.deleted_at.is_(None),
                OrganizationMember.role != "viewer",
            )
        )
    ).scalars().first()
    candidate = (
        await db.execute(select(User).where(User.primary_email == "jobseeker@forma.dev"))
    ).scalar_one_or_none()

    def _offer_stage_move(app: JobApplication, to_stage: str) -> None:
        """Mirror send()/create_from_offer stage movement (fill-only)."""
        if app.stage == to_stage:
            return
        db.add(
            ApplicationStageEvent(
                application_id=app.id,
                from_stage=app.stage,
                to_stage=to_stage,
                actor_id=owner.id,
                created_at=now,
            )
        )
        app.stage = to_stage
        app.stage_changed_at = now

    async def _seed_offer(
        *,
        app_id: uuid.UUID,
        suffix: str,
        status: str,
        base: str,
        bonus: str,
        equity: str | None,
        joining: str | None,
        created_days_ago: int,
        expires_in_days: int,
        responded_days_ago: int | None = None,
        owner_id: uuid.UUID | None = None,
        namespace: uuid.UUID | None = None,
    ) -> uuid.UUID | None:
        app = await db.get(JobApplication, app_id)
        if app is None or app.deleted_at is not None:
            return None
        ns = namespace or org.id
        offer_id = uuid.uuid5(ns, f"step7g7h:offer:{suffix}")
        if await db.get(JobOffer, offer_id) is not None:
            return offer_id
        job = await db.get(Job, app.job_id)
        offer = JobOffer(
            id=offer_id,
            application_id=app.id,
            title=job.title if job is not None else "Development sample offer",
            base_salary=Decimal(base),
            bonus_amount=Decimal(bonus),
            equity_pct=Decimal(equity) if equity is not None else None,
            joining_bonus=Decimal(joining) if joining is not None else None,
            currency="INR",
            start_date=(now + timedelta(days=30)).date(),
            expires_on=(now + timedelta(days=expires_in_days)).date(),
            status=JobOfferStatus(status),
            owner_id=owner_id or owner.id,
            responded_at=(
                now - timedelta(days=responded_days_ago)
                if responded_days_ago is not None
                else None
            ),
            created_at=now - timedelta(days=created_days_ago),
        )
        db.add(offer)
        # A non-draft offer was sent at least once (mirrors the send flow).
        if status != "draft":
            _offer_stage_move(app, "offered")
        await db.flush()
        return offer_id

    # --- Onboarding checklist templates (org-scoped;1-2 fill-only rows).
    tpl_specs = [
        (
            "engineering",
            "Engineering Onboarding",
            [
                ("Admin", "Laptop, email and tool access", "admin", 0),
                ("Week 1", "Team introductions and org overview", "owner", 1),
                ("Week 1", "Repository and staging environment access", "member", 2),
                ("Week 2", "First deliverable check-in", "owner", 7),
            ],
        ),
        (
            "general",
            "General Onboarding",
            [
                ("Admin", "Contract and payroll details", "admin", 0),
                ("Week 1", "Handbook, policies and benefits enrolment", "admin", 1),
                ("Week 2", "30-day goals with the manager", "owner", 14),
            ],
        ),
    ]
    templates: dict[str, OnboardingTemplate] = {}
    for key, name, item_specs in tpl_specs:
        template_id = uuid.uuid5(org.id, f"step7g7h:template:{key}")
        template = await db.get(OnboardingTemplate, template_id)
        if template is None:
            template = OnboardingTemplate(
                id=template_id, org_id=org.id, name=name, is_platform=False
            )
            db.add(template)
            await db.flush()
            for order, (section, title, role, offset) in enumerate(item_specs):
                db.add(
                    OnboardingTemplateItem(
                        id=uuid.uuid5(template_id, f"item:{order}"),
                        template_id=template_id,
                        section=section,
                        title=title,
                        owner_role=role,
                        due_offset_days=offset,
                        display_order=order,
                    )
                )
            await db.flush()
        templates[key] = template
    await db.flush()

    # --- Employer-side offers on the Step 7d pipeline applications:
    # draft / sent / accepted / expired mix (one live offer per application).
    aanya_app = uuid.uuid5(org.id, "step7d:application:aanya")
    rohan_app = uuid.uuid5(org.id, "step7d:application:rohan")
    meera_app = uuid.uuid5(org.id, "step7d:application:meera")
    blind_app = uuid.uuid5(org.id, "step7d:application:blind")

    await _seed_offer(
        app_id=aanya_app, suffix="aanya:draft", status="draft",
        base="2200000", bonus="200000", equity="0.30", joining=None,
        created_days_ago=1, expires_in_days=5,
    )
    await _seed_offer(
        app_id=rohan_app, suffix="rohan:sent", status="sent",
        base="2000000", bonus="150000", equity="0.25", joining=None,
        created_days_ago=2, expires_in_days=7,
        owner_id=member.id if member is not None else None,
    )
    meera_offer = await _seed_offer(
        app_id=meera_app, suffix="meera:accepted", status="accepted",
        base="1950000", bonus="100000", equity="0.20", joining="50000",
        created_days_ago=3, expires_in_days=10, responded_days_ago=1,
    )
    await _seed_offer(
        app_id=blind_app, suffix="blind:expired", status="expired",
        base="1800000", bonus="100000", equity=None, joining=None,
        created_days_ago=12, expires_in_days=-3,
    )

    # --- One hire from Meera's accepted offer, with the general checklist
    # copied onto the hire (mirrors create_from_offer's template copy).
    if meera_offer is not None:
        hire_id = uuid.uuid5(org.id, "step7g7h:hire:meera")
        if await db.get(Hire, hire_id) is None:
            meera_user_id = uuid.uuid5(org.id, "step7d:person:meera")
            meera_app_row = await db.get(JobApplication, meera_app)
            job = await db.get(Job, meera_app_row.job_id) if meera_app_row else None
            start_date = (now + timedelta(days=14)).date()
            hire = Hire(
                id=hire_id,
                application_id=meera_app,
                offer_id=meera_offer,
                org_id=org.id,
                user_id=meera_user_id,
                department=(job.department if job is not None else None) or "design",
                manager_id=member.id if member is not None else owner.id,
                owner_id=owner.id,
                start_date=start_date,
                status=HireStatus.pending_onboarding,
            )
            db.add(hire)
            await db.flush()
            general = templates.get("general")
            if general is not None:
                items = (
                    await db.execute(
                        select(OnboardingTemplateItem)
                        .where(OnboardingTemplateItem.template_id == general.id)
                        .order_by(OnboardingTemplateItem.display_order, OnboardingTemplateItem.id)
                    )
                ).scalars().all()
                for order, item in enumerate(items):
                    db.add(
                        HireOnboardingItem(
                            id=uuid.uuid5(hire_id, f"item:{order}"),
                            hire_id=hire_id,
                            section=item.section,
                            title=item.title,
                            owner_id=None,  # role -> person is assigned per hire
                            due_on=(
                                start_date + timedelta(days=item.due_offset_days)
                                if item.due_offset_days is not None
                                else None
                            ),
                            status=OnboardingItemStatus.pending,
                        )
                    )
            if meera_app_row is not None:
                _offer_stage_move(meera_app_row, "hired")
            await db.flush()

    # --- Jobseeker-side offers on the Step 7bc career applications:
    # two sent (Active tab + compare needs two) and one accepted.
    if candidate is not None and not candidate.deleted_at and candidate.status == AccountStatus.active:
        ns = uuid.uuid5(uuid.NAMESPACE_URL, "forma:development:careers:7bc")
        for job_key, status, base, bonus, equity, joining, created_days, expires_in, responded in (
            ("senior-product-designer", "sent", "2400000", "200000", "0.50", None, 2, 7, None),
            ("product-designer", "sent", "1800000", "100000", "0.25", None, 2, 7, None),
            ("ux-researcher", "accepted", "1600000", "80000", "0.10", "25000", 4, 10, 1),
        ):
            await _seed_offer(
                app_id=uuid.uuid5(ns, f"application:{job_key}"),
                suffix=job_key,
                status=status,
                base=base,
                bonus=bonus,
                equity=equity,
                joining=joining,
                created_days_ago=created_days,
                expires_in_days=expires_in,
                responded_days_ago=responded,
                namespace=ns,
            )

    await db.commit()



# Step 7i: the three hiring requests formerly hard-coded in
# frontend/app/employer/employer-data.js (hiringRequests). Requester emails
# map the demo names onto the seeded Northstar team; the demo's viewer
# requester (a viewer cannot request) is attributed to the member instead.
STEP7I_REQUESTS = [
    {
        "key": "senior-product-designer",
        "role_title": "Senior Product Designer",
        "department": "product",
        "headcount": 1,
        "urgency": "high",
        "requested_by": "hiring-admin@forma.dev",
        "approver": "employer@forma.dev",
        "target_start": date(2026, 12, 1),
        "budget_amount": Decimal("2400000.00"),
        "status": "approved",
        "employment_type": "full_time",
        "work_mode": "hybrid",
        "hiring_manager": "hiring-admin@forma.dev",
        "skills": ["Figma", "Design Systems", "User research"],
        "why_now": "growth",
        "justification": "Second product squad starts in December and has no design owner.",
    },
    {
        "key": "software-engineer",
        "role_title": "Software Engineer",
        "department": "engineering",
        "headcount": 2,
        "urgency": "normal",
        "requested_by": "hiring-member@forma.dev",
        "approver": "hiring-admin@forma.dev",
        "target_start": date(2027, 1, 15),
        "budget_amount": Decimal("2000000.00"),
        "status": "pending",
        "employment_type": "full_time",
        "work_mode": "remote",
        "hiring_manager": "hiring-member@forma.dev",
        "skills": ["React", "Node.js", "TypeScript"],
        "why_now": "new_project",
        "justification": "Patient-portal rewrite needs two more full-stack engineers for Q1.",
    },
    {
        "key": "ux-researcher",
        "role_title": "UX Researcher",
        "department": "design",
        "headcount": 1,
        "urgency": "low",
        "requested_by": "hiring-member@forma.dev",
        "approver": None,
        "target_start": date(2027, 2, 1),
        "budget_amount": Decimal("2200000.00"),
        "status": "draft",
        "employment_type": "contract",
        "work_mode": "onsite",
        "hiring_manager": None,
        "skills": ["User research"],
        "why_now": "skill_gap",
        "justification": None,
    },
]

# Step 7j: talent profiles for the two seeded seekers (formerly the demo
# store's talentResults) plus the "Backend 2026" shortlist (formerly
# shortlists) and one sent invitation so the outreach tab has history.
STEP7J_TALENT = [
    {
        "email": "talent-designer@forma.dev",
        "headline": "Product Designer",
        "total_experience_yrs": Decimal("3.0"),
        "current_location": "Kolkata",
        "preferred_mode": "hybrid",
        "availability": "immediate",
        "skills": ["Figma", "React", "User research"],
    },
    {
        "email": "talent-engineer@forma.dev",
        "headline": "Software Engineer",
        "total_experience_yrs": Decimal("6.0"),
        "current_location": "Remote",
        "preferred_mode": "remote",
        "availability": "one_month",
        "skills": ["React", "Node.js", "TypeScript"],
    },
]


async def seed_step7i7j(db: AsyncSession) -> None:
    """Fill-only hiring-request / talent-sourcing samples for the Northstar
    employer org; never rewrites an existing row. Dev only."""
    if get_settings().ENVIRONMENT != "development":
        raise RuntimeError("Step 7i/7j samples require ENVIRONMENT=development")
    from app.models.hiring_request import HiringRequest
    from app.models.talent import AvailabilityMode, TalentProfile, TalentProfileSkill
    from app.models.talent import WorkMode as TalentWorkMode
    from app.models.talent_sourcing import (
        TalentOutreach,
        TalentShortlist,
        TalentShortlistMember,
    )
    from app.services.talent_service import resolve_skills

    users = {
        u.primary_email: u
        for u in (
            await db.execute(
                select(User).where(
                    User.deleted_at.is_(None),
                    User.primary_email.like("%@forma.dev"),
                )
            )
        ).scalars()
    }
    owner = users.get("employer@forma.dev")
    if owner is None or owner.status != AccountStatus.active:
        return
    org = (
        await db.execute(
            select(Organization)
            .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
            .where(
                OrganizationMember.user_id == owner.id,
                OrganizationMember.role == OrgRole.owner,
                Organization.type == "employer",
                Organization.deleted_at.is_(None),
            )
        )
    ).scalars().first()
    if org is None or org.status != "active":
        return
    namespace = uuid.uuid5(org.id, "step7i7j")

    # 7i: hiring requests (by fixed id; never overwritten).
    for spec in STEP7I_REQUESTS:
        request_id = uuid.uuid5(namespace, "request:" + str(spec["key"]))
        if await db.get(HiringRequest, request_id) is not None:
            continue
        requester = users.get(str(spec["requested_by"]))
        approver = users.get(str(spec["approver"])) if spec["approver"] else None
        manager = users.get(str(spec["hiring_manager"])) if spec["hiring_manager"] else None
        db.add(
            HiringRequest(
                id=request_id,
                org_id=org.id,
                role_title=spec["role_title"],
                department=spec["department"],
                headcount=spec["headcount"],
                urgency=spec["urgency"],
                requested_by=requester.id if requester else owner.id,
                approver_id=approver.id if approver else None,
                target_start=spec["target_start"],
                budget_amount=spec["budget_amount"],
                currency="INR",
                status=spec["status"],
                employment_type=spec["employment_type"],
                work_mode=spec["work_mode"],
                hiring_manager_id=manager.id if manager else None,
                skills=list(spec["skills"]),  # type: ignore[call-overload]
                why_now=spec["why_now"],
                justification=spec["justification"],
            )
        )
    await db.commit()

    # 7j: searchable talent profiles for the seeded seekers.
    seekers: list[User] = []
    for spec in STEP7J_TALENT:
        seeker = users.get(str(spec["email"]))
        if seeker is None or seeker.status != AccountStatus.active:
            continue
        seekers.append(seeker)
        if await db.get(TalentProfile, seeker.id) is not None:
            continue
        db.add(
            TalentProfile(
                user_id=seeker.id,
                headline=spec["headline"],
                total_experience_yrs=spec["total_experience_yrs"],
                current_location=spec["current_location"],
                preferred_mode=TalentWorkMode(str(spec["preferred_mode"])),
                availability=AvailabilityMode(str(spec["availability"])),
                is_searchable=True,
            )
        )
        await db.flush()
        for skill in await resolve_skills(db, list(spec["skills"])):  # type: ignore[call-overload]
            db.add(TalentProfileSkill(user_id=seeker.id, skill_id=skill.id))
    await db.commit()

    # 7j: the "Backend 2026" shortlist with the seeded seekers.
    shortlist_id = uuid.uuid5(namespace, "shortlist:backend-2026")
    if await db.get(TalentShortlist, shortlist_id) is None:
        db.add(
            TalentShortlist(
                id=shortlist_id, org_id=org.id, name="Backend 2026", created_by=owner.id
            )
        )
        await db.flush()
        for seeker in seekers:
            db.add(
                TalentShortlistMember(
                    shortlist_id=shortlist_id, user_id=seeker.id, added_by=owner.id
                )
            )
        await db.commit()

    # 7j: one sent invitation (engineer -> an open Northstar job).
    engineer = users.get("talent-engineer@forma.dev")
    open_job = (
        await db.execute(
            select(Job)
            .where(Job.org_id == org.id, Job.status == "open", Job.deleted_at.is_(None))
            .order_by(Job.created_at)
            .limit(1)
        )
    ).scalars().first()
    if engineer is not None and open_job is not None:
        outreach_id = uuid.uuid5(namespace, "outreach:engineer")
        exists = (
            await db.execute(
                select(TalentOutreach.id).where(
                    TalentOutreach.org_id == org.id,
                    TalentOutreach.candidate_user_id == engineer.id,
                    TalentOutreach.job_id == open_job.id,
                )
            )
        ).first()
        if exists is None and await db.get(TalentOutreach, outreach_id) is None:
            db.add(
                TalentOutreach(
                    id=outreach_id,
                    org_id=org.id,
                    candidate_user_id=engineer.id,
                    job_id=open_job.id,
                    note="Your Node.js and TypeScript work looks like a great fit.",
                    sent_by=owner.id,
                )
            )
            await db.commit()



async def seed_step7no_resumes(db: AsyncSession, candidate: User) -> None:
    """Fill-only sample resumes and ATS run migrated from the old 7n/7o mock data."""
    if get_settings().ENVIRONMENT != "development":
        raise RuntimeError("Step 7n/7o samples require ENVIRONMENT=development")
    from app.models.resume import (
        Resume,
        ResumeAtsRun,
        ResumeEducation,
        ResumeExperience,
    )

    existing = (
        await db.execute(
            select(Resume.id).where(Resume.user_id == candidate.id, Resume.deleted_at.is_(None))
        )
    ).first()
    if existing is not None:
        return

    r1 = Resume(
        user_id=candidate.id,
        title="Senior Product Designer (Primary)",
        target_role="Product Designer",
        summary=(
            "Senior Product Designer with 6+ years driving UX strategy, design systems, "
            "and product metrics across B2B SaaS and enterprise marketplaces."
        ),
        template="Modern Clean",
        source="manual",
        ats_score=88,
        is_default=True,
    )
    r2 = Resume(
        user_id=candidate.id,
        title="UX Researcher & Strategy",
        target_role="UX Researcher",
        summary=(
            "UX Researcher focused on qualitative discovery, usability testing, "
            "and cross-functional product roadmap alignment."
        ),
        template="Minimalist Tech",
        source="manual",
        ats_score=82,
        is_default=False,
    )
    db.add_all([r1, r2])
    await db.flush()

    db.add_all(
        [
            ResumeExperience(
                resume_id=r1.id,
                role_title="Senior Product Designer",
                company="Vanguard Systems",
                period_label="2023 – Present",
                bullets=[
                    "Spearheaded enterprise dashboard redesign, reducing task completion time by 34%.",
                    "Architected unified multi-brand design system in Figma adopted by 18 engineering squads.",
                ],
                display_order=0,
            ),
            ResumeExperience(
                resume_id=r1.id,
                role_title="Product Designer",
                company="Pulse Digital",
                period_label="2020 – 2023",
                bullets=[
                    "Led end-to-end design for consumer fintech onboarding with 22% conversion increase.",
                    "Conducted 50+ qualitative user research sessions to map key churn triggers.",
                ],
                display_order=1,
            ),
            ResumeExperience(
                resume_id=r2.id,
                role_title="UX Research Associate",
                company="Pulse Digital",
                period_label="2020 – 2023",
                bullets=[
                    "Planned and executed foundational discovery studies for mobile payment features.",
                ],
                display_order=0,
            ),
            ResumeEducation(
                resume_id=r1.id,
                degree="B.Des in Interaction Design",
                school="National Institute of Design (NID)",
                year_label="2020",
                display_order=0,
            ),
            ResumeEducation(
                resume_id=r2.id,
                degree="B.Des in Interaction Design",
                school="National Institute of Design (NID)",
                year_label="2020",
                display_order=0,
            ),
            ResumeAtsRun(
                resume_id=r1.id,
                run_type="ats",
                score=88,
                matched_keywords=["Product Designer", "Design Systems", "Figma", "UX"],
                missing_keywords=["WCAG 2.1", "Tokens Studio"],
                suggestions=[
                    {
                        "section": "skills",
                        "original": None,
                        "tailored": "WCAG 2.1",
                        "rationale": "Consider adding 'WCAG 2.1' to your skills if applicable.",
                    }
                ],
            ),
        ]
    )
    await db.commit()


async def seed_step7lm(db: AsyncSession, candidate: User) -> None:
    """Fill-only bookmarks and alerts corresponding to the old 7m mock records."""
    if get_settings().ENVIRONMENT != "development":
        raise RuntimeError("Step 7l/7m samples require ENVIRONMENT=development")
    from app.models.job import Job
    from app.models.job_alert import JobAlert
    from app.models.saved_job import SavedJob

    namespace = uuid.uuid5(uuid.NAMESPACE_URL, "forma:development:careers:7bc")
    for key, note in (
        ("senior-product-designer", "Spoke with founder at demo day. Fast-track intro."),
        ("ux-researcher", "Series A fintech, 100% remote team."),
    ):
        job_id = uuid.uuid5(namespace, "job:" + key)
        job = await db.get(Job, job_id)
        if job and job.deleted_at is None and await db.get(SavedJob, (candidate.id, job_id)) is None:
            db.add(SavedJob(user_id=candidate.id, job_id=job_id, note=note))
    for key, title, criteria, frequency in (
        ("remote-design", "Senior Product Designer · Remote", {"keywords": "Senior Product Designer", "work_mode": "remote", "employment_type": "full_time", "salary_min": "1800000", "currency": "INR"}, "daily"),
        ("bengaluru-lead", "Staff UX Lead · Bengaluru", {"keywords": "Staff UX Lead", "location": "Bengaluru", "work_mode": "hybrid", "salary_min": "2500000", "currency": "INR"}, "instant"),
    ):
        alert_id = uuid.uuid5(candidate.id, "step7m:alert:" + key)
        if await db.get(JobAlert, alert_id) is None:
            db.add(JobAlert(id=alert_id, user_id=candidate.id, title=title, criteria=criteria, frequency=frequency))
    await db.commit()

async def seed() -> None:
    settings = get_settings()
    if settings.ENVIRONMENT != "development":
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

        # Step 7g: platform offer decline reasons (idempotent, plan D5).
        from app.services.offer_service import seed_decline_reasons

        await seed_decline_reasons(db)

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

        # Step 7a B: only the employer workspace; startup hiring remains 7r.
        hiring_owner = (await db.execute(select(User).where(User.primary_email == "employer@forma.dev"))).scalar_one_or_none()
        if hiring_owner is not None:
            hiring_org = (await db.execute(select(Organization).join(OrganizationMember, OrganizationMember.org_id == Organization.id).where(OrganizationMember.user_id == hiring_owner.id, OrganizationMember.role == OrgRole.owner, Organization.type == "employer", Organization.deleted_at.is_(None)))).scalars().first()
            if hiring_org is not None:
                await seed_step7a_jobs(db, hiring_org, hiring_owner)
                await seed_step7d_pipeline(db, hiring_org, hiring_owner)

        # Step 5a: startup profile for the founder's organisation, plus the
        # org summary/founded year and a second member so the wired profile
        # and team cards look populated in development. Fill-only.
        startup_profile_added = 0
        extra_members_added = 0
        team_state_added = 0
        milestones_added = 0
        tasks_added = 0
        labels_added = 0
        funding_rounds_added = 0
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

            await seed_step4_files(db, founder_org, founder_user)

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

            # Step 9a: demo funding rounds for the wired rounds page
            # (fill-only, by name). committed_amount is written directly so
            # the dev progress bar is non-zero, matching the old demo.
            for spec in STEP9A_ROUNDS:
                exists = (
                    await db.execute(
                        select(FundingRound.id).where(
                            FundingRound.org_id == founder_org.id,
                            FundingRound.name == str(spec["name"]),
                            FundingRound.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                instrument = spec["instrument"]
                db.add(
                    FundingRound(
                        org_id=founder_org.id,
                        name=str(spec["name"]),
                        round_type=spec["round_type"],
                        target_amount=spec["target_amount"],
                        committed_amount=spec["committed_amount"],
                        currency=str(spec["currency"]),
                        pre_money_valuation=spec["pre_money_valuation"],
                        instrument=instrument if instrument is not None else None,
                        status=spec["status"],
                        opens_on=spec["opens_on"],
                        closes_on=spec["closes_on"],
                        min_raise=spec["min_raise"],
                        min_ticket=spec["min_ticket"],
                    )
                )
                funding_rounds_added += 1
            if funding_rounds_added:
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

        # -----------------------------------------------------------------
        # Steps 9b/9c/9d/9e: demo records for the wired investor-deal-flow
        # pages, moved out of the frontend's inline demo data. Dev-only and
        # fill-only throughout: existing orgs/profiles/rounds are never
        # duplicated or overwritten.
        # -----------------------------------------------------------------
        inv_firms_added = 0
        inv_prefs_added = 0
        disc_startups_added = 0
        disc_rounds_added = 0
        saved_searches_added = 0
        shortlist_added = 0
        deals_added = 0

        # 9b/9d: investor-firm orgs + their thesis preferences.
        firm_by_email: dict[str, Organization] = {}
        for spec in STEP9B_INVESTOR_FIRMMS:
            owner_email = str(spec["owner_email"])
            owner = (
                await db.execute(select(User).where(User.primary_email == owner_email))
            ).scalar_one_or_none()
            if owner is None:
                continue
            org = (
                await db.execute(
                    select(Organization)
                    .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
                    .where(
                        OrganizationMember.user_id == owner.id,
                        Organization.type == "investor_firm",
                        Organization.deleted_at.is_(None),
                    )
                )
            ).scalars().first()
            if org is None:
                base_slug = re.sub(r"[^a-z0-9]+", "-", str(spec["name"]).lower()).strip("-")[:180]
                slug, suffix = base_slug, 1
                while (
                    await db.execute(select(Organization.id).where(Organization.slug == slug))
                ).first() is not None:
                    suffix += 1
                    slug = f"{base_slug}-{suffix}"
                org = Organization(
                    name=str(spec["name"]), slug=slug, type="investor_firm", city=str(spec["city"])
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
                inv_firms_added += 1
            if org.summary is None:
                org.summary = str(spec["summary"])
            firm_by_email[owner_email] = org

            # 9d: thesis preferences (one row per firm). Fill-only.
            pref = (
                await db.execute(
                    select(InvestorPreference).where(InvestorPreference.investor_org_id == org.id)
                )
            ).scalar_one_or_none()
            if pref is None:
                db.add(
                    InvestorPreference(
                        investor_org_id=org.id,
                        investor_type=spec["investor_type"],
                        sectors=spec["sectors"],
                        stage_focus=spec["stage_focus"],
                        min_ticket=spec["min_ticket"],
                        max_ticket=spec["max_ticket"],
                    )
                )
                inv_prefs_added += 1
        if inv_firms_added or inv_prefs_added:
            await db.commit()

        # 9c: demo opted-in startups (org + public profile + open round).
        startup_by_name: dict[str, Organization] = {}
        if founder_org is not None:
            startup_by_name[founder_org.name] = founder_org
        for spec in STEP9C_STARTUPS:
            name = str(spec["name"])
            org = (
                await db.execute(
                    select(Organization).where(
                        Organization.name == name,
                        Organization.type == "startup",
                        Organization.deleted_at.is_(None),
                    )
                )
            ).scalars().first()
            if org is None:
                base_slug = re.sub(r"[^a-z0-9]+", "-", str(spec["slug_hint"])).strip("-")[:180]
                slug, suffix = base_slug, 1
                while (
                    await db.execute(select(Organization.id).where(Organization.slug == slug))
                ).first() is not None:
                    suffix += 1
                    slug = f"{base_slug}-{suffix}"
                org = Organization(
                    name=name, slug=slug, type="startup", city=str(spec["city"])
                )
                db.add(org)
                await db.flush()
                disc_startups_added += 1
            startup_by_name[name] = org

            profile = (
                await db.execute(
                    select(StartupProfile).where(StartupProfile.org_id == org.id)
                )
            ).scalar_one_or_none()
            if profile is None:
                db.add(StartupProfile(org_id=org.id, **spec["profile"]))  # type: ignore[arg-type]
            else:
                # Fill only the fields the discovery card renders, and only
                # where still empty, so dev edits survive a re-run.
                for key, value in spec["profile"].items():  # type: ignore[union-attr]
                    if getattr(profile, key) in (None, "", False):
                        setattr(profile, key, value)

            round_spec = spec["round"]
            exists = (
                await db.execute(
                    select(FundingRound.id).where(
                        FundingRound.org_id == org.id,
                        FundingRound.name == str(round_spec["name"]),
                        FundingRound.deleted_at.is_(None),
                    )
                )
            ).first()
            if exists is None:
                instrument = round_spec["instrument"]
                db.add(
                    FundingRound(
                        org_id=org.id,
                        name=str(round_spec["name"]),
                        round_type=round_spec["round_type"],
                        target_amount=round_spec["target_amount"],
                        committed_amount=round_spec["committed_amount"],
                        currency=str(round_spec["currency"]),
                        pre_money_valuation=None,
                        instrument=instrument if instrument is not None else None,
                        status=round_spec["status"],
                        opens_on=round_spec["opens_on"],
                        closes_on=round_spec["closes_on"],
                        min_raise=round_spec["min_raise"],
                        min_ticket=round_spec["min_ticket"],
                    )
                )
                disc_rounds_added += 1
        if disc_startups_added or disc_rounds_added:
            await db.commit()

        # 9d: saved searches + shortlist for the primary investor firm.
        primary_firm = firm_by_email.get("investor@forma.dev")
        if primary_firm is not None:
            for spec in STEP9D_SAVED_SEARCHES:
                exists = (
                    await db.execute(
                        select(SavedSearch.id).where(
                            SavedSearch.investor_org_id == primary_firm.id,
                            SavedSearch.name == str(spec["name"]),
                            SavedSearch.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                db.add(
                    SavedSearch(
                        investor_org_id=primary_firm.id,
                        name=str(spec["name"]),
                        criteria=spec["criteria"],
                        is_active=True,
                    )
                )
                saved_searches_added += 1

            for spec in STEP9D_SHORTLIST:
                target = startup_by_name.get(str(spec["startup"]))
                if target is None:
                    continue
                exists = (
                    await db.execute(
                        select(ShortlistEntry.id).where(
                            ShortlistEntry.investor_org_id == primary_firm.id,
                            ShortlistEntry.startup_org_id == target.id,
                            ShortlistEntry.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                db.add(
                    ShortlistEntry(
                        investor_org_id=primary_firm.id,
                        startup_org_id=target.id,
                        note=spec["note"],
                        status=ShortlistStatus(str(spec["status"])),
                    )
                )
                shortlist_added += 1
            if saved_searches_added or shortlist_added:
                await db.commit()

            # 9e: demo pipeline deals for the primary investor firm.
            for spec in STEP9E_DEALS:
                target = startup_by_name.get(str(spec["startup"]))
                if target is None:
                    continue
                exists = (
                    await db.execute(
                        select(InvestorDeal.id).where(
                            InvestorDeal.investor_org_id == primary_firm.id,
                            InvestorDeal.startup_org_id == target.id,
                            InvestorDeal.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                owner_user = (
                    await db.execute(select(User).where(User.primary_email == str(spec["owner"])))
                ).scalar_one_or_none()
                db.add(
                    InvestorDeal(
                        investor_org_id=primary_firm.id,
                        startup_org_id=target.id,
                        stage=PipelineStage(str(spec["stage"])),
                        probability=int(spec["probability"]),  # type: ignore[call-overload]
                        ticket_size=Decimal(str(spec["ticket"])),
                        currency="INR",
                        owner_id=owner_user.id if owner_user is not None else None,
                        next_step=spec["next_step"],
                        last_activity_at=now
                        - timedelta(days=int(spec["days_ago"])),  # type: ignore[call-overload]
                    )
                )
                deals_added += 1
            if deals_added:
                await db.commit()

        # -----------------------------------------------------------------
        # Steps 9f/9i/9j/9k/9l: demo records for the wired engagement,
        # offers, commitments/portfolio, diligence and dashboard pages.
        # Fill-only: existing rows are never duplicated or overwritten.
        # -----------------------------------------------------------------
        eng_requests_added = 0
        meetings_added = 0
        offers_added = 0
        commitments_added = 0
        holdings_added = 0
        checklists_added = 0
        diligence_items_added = 0
        activity_added = 0

        if primary_firm is not None:
            investor_user = (
                await db.execute(
                    select(User).where(User.primary_email == "investor@forma.dev")
                )
            ).scalar_one_or_none()

            # Resolve each startup's round once (one open round per 9c spec).
            async def _round_for(org_id: uuid.UUID, round_name: str):
                return (
                    await db.execute(
                        select(FundingRound).where(
                            FundingRound.org_id == org_id,
                            FundingRound.name == round_name,
                            FundingRound.deleted_at.is_(None),
                        )
                    )
                ).scalars().first()

            # 9f: engagement requests.
            for spec in STEP9F_REQUESTS:
                target = startup_by_name.get(str(spec["startup"]))
                if target is None:
                    continue
                exists = (
                    await db.execute(
                        select(InvestorEngagementRequest.id).where(
                            InvestorEngagementRequest.investor_org_id == primary_firm.id,
                            InvestorEngagementRequest.startup_org_id == target.id,
                            InvestorEngagementRequest.kind == spec["kind"],
                            InvestorEngagementRequest.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                owner_user = (
                    await db.execute(
                        select(User).where(User.primary_email == "investor@forma.dev")
                    )
                ).scalar_one_or_none()
                db.add(
                    InvestorEngagementRequest(
                        investor_org_id=primary_firm.id,
                        startup_org_id=target.id,
                        kind=spec["kind"],
                        ask=str(spec["ask"]),
                        message=spec.get("message"),
                        status=spec["status"],
                        response_note=spec.get("response_note"),
                        decline_reason=spec.get("decline_reason"),
                        expires_on=now + timedelta(days=14),
                        owner_id=owner_user.id if owner_user else None,
                        created_by=owner_user.id if owner_user else None,
                        created_at=now - timedelta(days=int(spec["days_ago"])),
                    )
                )
                eng_requests_added += 1

            # 9f: meetings.
            for spec in STEP9F_MEETINGS:
                target = startup_by_name.get(str(spec["startup"]))
                if target is None:
                    continue
                exists = (
                    await db.execute(
                        select(InvestorMeeting.id).where(
                            InvestorMeeting.investor_org_id == primary_firm.id,
                            InvestorMeeting.startup_org_id == target.id,
                            InvestorMeeting.meeting_type == spec["meeting_type"],
                            InvestorMeeting.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                owner_user = (
                    await db.execute(
                        select(User).where(User.primary_email == "investor@forma.dev")
                    )
                ).scalar_one_or_none()
                db.add(
                    InvestorMeeting(
                        investor_org_id=primary_firm.id,
                        startup_org_id=target.id,
                        meeting_type=spec["meeting_type"],
                        scheduled_at=(now + timedelta(days=int(spec["scheduled_in_days"]))).replace(
                            second=0, microsecond=0
                        ),
                        duration_minutes=int(spec["duration_minutes"]),
                        agenda=spec.get("agenda"),
                        status=spec["status"],
                        location=spec.get("location"),
                        organizer_org_id=primary_firm.id,
                        created_by=owner_user.id if owner_user else None,
                        created_at=now - timedelta(days=int(spec["days_ago"])),
                    )
                )
                meetings_added += 1
            if eng_requests_added or meetings_added:
                # Commit the 9f rows on their own: they must not depend on a
                # later block committing (re-runs add nothing to 9i, which
                # would otherwise leave these uncommitted).
                await db.commit()

            # 9i: offers (v2 row linked to its v1 parent for the counter).
            offer_ids_by_idx: dict[int, uuid.UUID] = {}
            for idx, spec in enumerate(STEP9I_OFFERS):
                target = startup_by_name.get(str(spec["startup"]))
                if target is None:
                    continue
                round_row = await _round_for(target.id, str(spec["round"]))
                if round_row is None:
                    continue
                exists = (
                    await db.execute(
                        select(InvestorOffer.id).where(
                            InvestorOffer.investor_org_id == primary_firm.id,
                            InvestorOffer.round_id == round_row.id,
                            InvestorOffer.version == int(spec["version"]),
                            InvestorOffer.deleted_at.is_(None),
                        )
                    )
                ).first()
                if exists is not None:
                    offer_ids_by_idx[idx] = exists
                    continue
                owner_user = (
                    await db.execute(
                        select(User).where(User.primary_email == "investor@forma.dev")
                    )
                ).scalar_one_or_none()
                parent_id = None
                parent_idx = spec.get("parent_of")
                if parent_idx is not None and parent_idx in offer_ids_by_idx:
                    parent_id = offer_ids_by_idx[int(parent_idx)]
                expires = spec.get("expires_on")
                offer_row = InvestorOffer(
                    investor_org_id=primary_firm.id,
                    round_id=round_row.id,
                    amount=Decimal(str(spec["amount"])),
                    currency="INR",
                    instrument=str(spec["instrument"]),
                    valuation_cap=(
                        Decimal(str(spec["valuation_cap"]))
                        if spec.get("valuation_cap") is not None
                        else None
                    ),
                    discount_pct=(
                        Decimal(str(spec["discount_pct"]))
                        if spec.get("discount_pct") is not None
                        else None
                    ),
                    version=int(spec["version"]),
                    parent_offer_id=parent_id,
                    status=spec["status"],
                    expires_on=date.fromisoformat(str(expires)) if expires else None,
                    owner_id=owner_user.id if owner_user else None,
                    notes=spec.get("notes"),
                    created_at=now - timedelta(days=int(spec["days_ago"])),
                )
                db.add(offer_row)
                await db.flush()
                offer_ids_by_idx[idx] = offer_row.id
                offers_added += 1
            if offers_added:
                await db.commit()

            # 9j: commitments (linked to the accepted offer where given).
            for spec in STEP9J_COMMITMENTS:
                target = startup_by_name.get(str(spec["startup"]))
                if target is None:
                    continue
                round_row = await _round_for(target.id, str(spec["round"]))
                if round_row is None:
                    continue
                exists = (
                    await db.execute(
                        select(Commitment.id).where(
                            Commitment.investor_org_id == primary_firm.id,
                            Commitment.round_id == round_row.id,
                            Commitment.reference == str(spec["reference"]),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                offer_id = None
                offer_idx = spec.get("offer_idx")
                if offer_idx is not None and offer_idx in offer_ids_by_idx:
                    offer_id = offer_ids_by_idx[int(offer_idx)]
                funded_on = spec.get("funded_on")
                wired_at = None
                if funded_on:
                    wired_at = datetime.now(UTC).replace(second=0, microsecond=0)
                db.add(
                    Commitment(
                        investor_org_id=primary_firm.id,
                        round_id=round_row.id,
                        offer_id=offer_id,
                        amount=Decimal(str(spec["amount"])),
                        currency="INR",
                        status=spec["status"],
                        committed_on=date.fromisoformat(str(spec["committed_on"])),
                        funded_on=date.fromisoformat(str(funded_on)) if funded_on else None,
                        wired_at=wired_at,
                        reference=str(spec["reference"]),
                        created_at=now - timedelta(days=int(spec["days_ago"])),
                    )
                )
                commitments_added += 1
            if commitments_added:
                await db.commit()

            # 9j: portfolio holdings (linked to the matching commitment).
            # Fetch the firm's commitments joined to their round once, keyed
            # by (startup org, amount), so each holding links to the pledge
            # it came from (commitments reference a round, not a startup).
            commitment_lookup: dict[tuple[uuid.UUID, Decimal], uuid.UUID] = {}
            for row in (
                await db.execute(
                    select(Commitment, FundingRound.org_id)
                    .join(FundingRound, FundingRound.id == Commitment.round_id)
                    .where(Commitment.investor_org_id == primary_firm.id)
                )
            ).all():
                commitment, startup_org_id = row
                commitment_lookup[(startup_org_id, commitment.amount)] = commitment.id
            for spec in STEP9J_HOLDINGS:
                target = startup_by_name.get(str(spec["startup"]))
                if target is None:
                    continue
                exists = (
                    await db.execute(
                        select(PortfolioHolding.id).where(
                            PortfolioHolding.investor_org_id == primary_firm.id,
                            PortfolioHolding.startup_org_id == target.id,
                            PortfolioHolding.invested_amount == Decimal(str(spec["invested_amount"])),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                commitment_id = commitment_lookup.get(
                    (target.id, Decimal(str(spec["invested_amount"])))
                )
                db.add(
                    PortfolioHolding(
                        investor_org_id=primary_firm.id,
                        startup_org_id=target.id,
                        commitment_id=commitment_id,
                        instrument=str(spec["instrument"]),
                        invested_amount=Decimal(str(spec["invested_amount"])),
                        currency="INR",
                        ownership_pct=(
                            Decimal(str(spec["ownership_pct"]))
                            if spec.get("ownership_pct") is not None
                            else None
                        ),
                        invested_on=date.fromisoformat(str(spec["invested_on"])),
                        status=str(spec["status"]),
                        exited_on=(
                            date.fromisoformat(str(spec["exited_on"]))
                            if spec.get("exited_on")
                            else None
                        ),
                        exit_value=(
                            Decimal(str(spec["exit_value"]))
                            if spec.get("exit_value") is not None
                            else None
                        ),
                        created_at=now - timedelta(days=int(spec["days_ago"])),
                    )
                )
                holdings_added += 1
            if holdings_added:
                await db.commit()

            # 9k: diligence checklists + items.
            for spec in STEP9K_CHECKLISTS:
                target = startup_by_name.get(str(spec["startup"]))
                if target is None:
                    continue
                cl = (
                    await db.execute(
                        select(InvestorDiligenceChecklist).where(
                            InvestorDiligenceChecklist.investor_org_id == primary_firm.id,
                            InvestorDiligenceChecklist.startup_org_id == target.id,
                            InvestorDiligenceChecklist.deleted_at.is_(None),
                        )
                    )
                ).scalars().first()
                if cl is None:
                    owner_user = (
                        await db.execute(
                            select(User).where(User.primary_email == "investor@forma.dev")
                        )
                    ).scalar_one_or_none()
                    cl = InvestorDiligenceChecklist(
                        investor_org_id=primary_firm.id,
                        startup_org_id=target.id,
                        overall_status=spec["overall"],
                        notes=spec.get("notes"),
                        owner_id=owner_user.id if owner_user else None,
                        created_by=owner_user.id if owner_user else None,
                        created_at=now,
                    )
                    db.add(cl)
                    await db.flush()
                    checklists_added += 1
                for item in spec["items"]:
                    exists = (
                        await db.execute(
                            select(InvestorDiligenceItem.id).where(
                                InvestorDiligenceItem.checklist_id == cl.id,
                                InvestorDiligenceItem.title == str(item["title"]),
                                InvestorDiligenceItem.deleted_at.is_(None),
                            )
                        )
                    ).first()
                    if exists is not None:
                        continue
                    db.add(
                        InvestorDiligenceItem(
                            checklist_id=cl.id,
                            investor_org_id=primary_firm.id,
                            startup_org_id=target.id,
                            item_type=item["item_type"],
                            title=str(item["title"]),
                            severity=item.get("severity"),
                            status=item["status"],
                            response=item.get("response"),
                            created_by=investor_user.id if investor_user else None,
                            created_at=now,
                        )
                    )
                    diligence_items_added += 1
            if checklists_added or diligence_items_added:
                await db.commit()

            # 9l: activity events for the primary investor firm.
            for spec in STEP9L_ACTIVITY:
                entity_id = None
                if spec.get("entity_type") == "offer":
                    # Link to the most recent offer on that entity if any.
                    entity_id = (
                        await db.execute(
                            select(InvestorOffer.id)
                            .where(InvestorOffer.investor_org_id == primary_firm.id)
                            .order_by(InvestorOffer.created_at.desc())
                            .limit(1)
                        )
                    ).scalars().first()
                exists = (
                    await db.execute(
                        select(ActivityEvent.id).where(
                            ActivityEvent.org_id == primary_firm.id,
                            ActivityEvent.summary == str(spec["summary"]),
                        )
                    )
                ).first()
                if exists is not None:
                    continue
                db.add(
                    ActivityEvent(
                        org_id=primary_firm.id,
                        user_id=investor_user.id if investor_user else None,
                        event_type=str(spec["event_type"]),
                        entity_type=spec.get("entity_type"),
                        entity_id=entity_id,
                        summary=str(spec["summary"]),
                        created_at=now - timedelta(days=int(spec["days_ago"])),
                    )
                )
                activity_added += 1
            if activity_added:
                await db.commit()

        await seed_step9_data_rooms(db, startup_by_name, founder_user, firm_by_email)

        # Step 9m: founder-org audit events for the startup investor hub's
        # recent-activity list. Fill-only by summary; never overwrites.
        hub_activity_added = 0
        for spec in STEP9M_ACTIVITY:
            exists = (
                await db.execute(
                    select(ActivityEvent.id).where(
                        ActivityEvent.org_id == founder_org.id,  # type: ignore[union-attr]
                        ActivityEvent.summary == str(spec["summary"]),
                    )
                )
            ).first()  # type: ignore[assignment]
            if exists is not None:
                continue
            db.add(
                ActivityEvent(
                    org_id=founder_org.id,  # type: ignore[union-attr]
                    user_id=founder_user.id if founder_user else None,
                    event_type=str(spec["event_type"]),
                    entity_type=spec.get("entity_type"),
                    summary=str(spec["summary"]),
                    created_at=now - timedelta(days=int(spec["days_ago"])),  # type: ignore[call-overload]
                )
            )
            hub_activity_added += 1
        if hub_activity_added:
            await db.commit()

        careers_owner = (await db.execute(select(User).where(User.primary_email == "employer@forma.dev"))).scalar_one_or_none()
        careers_candidate = (await db.execute(select(User).where(User.primary_email == "jobseeker@forma.dev"))).scalar_one_or_none()
        if careers_owner and careers_candidate:
            await seed_step7bc_careers(db, careers_owner, careers_candidate)
            await seed_step7lm(db, careers_candidate)
            await seed_step7no_resumes(db, careers_candidate)

        # Step 7e/7f samples; after7bc so the jobseeker's applications exist.
        await seed_step7e7f(db)

        # Step 7g/7h samples; after 7d/7e/7f so the pipeline applications exist.
        await seed_step7g7h(db)

        # Step 7i/7j samples; after 7a so Northstar's team and jobs exist.
        await seed_step7i7j(db)

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
    print(f"  + funding rounds (9a): {funding_rounds_added}")
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
    print(f"  + investor firms (9b): {inv_firms_added}")
    print(f"  + investor preferences (9d): {inv_prefs_added}")
    print(f"  + discovery startups (9c): {disc_startups_added}")
    print(f"  + discovery rounds (9c): {disc_rounds_added}")
    print(f"  + saved searches (9d): {saved_searches_added}")
    print(f"  + shortlist entries (9d): {shortlist_added}")
    print(f"  + pipeline deals (9e): {deals_added}")
    print(f"  + engagement requests (9f): {eng_requests_added}")
    print(f"  + meetings (9f): {meetings_added}")
    print(f"  + offers (9i): {offers_added}")
    print(f"  + commitments (9j): {commitments_added}")
    print(f"  + portfolio holdings (9j): {holdings_added}")
    print(f"  + diligence checklists (9k): {checklists_added}")
    print(f"  + diligence items (9k): {diligence_items_added}")
    print(f"  + activity events (9l): {activity_added}")
    print(f"  + hub activity events (9m): {hub_activity_added}")
    print(f"\nPassword for all seeded accounts: {DEV_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
