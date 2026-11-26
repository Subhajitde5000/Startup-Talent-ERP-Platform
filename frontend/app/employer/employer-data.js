'use client';

import {
  Briefcase,
  Clock,
  ClipboardList,
  Mail,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// Centralized Employer Role Mock Datasets
export const GOLD_DARK = "#806236";
export const INK = "#0F1B2D";


export const company = {
  name: "Northstar Labs",
  logo: "N",
  verified: true,
  status: "Verified employer",
  summary:
    "4 open jobs · 18 candidates waiting for review · 2 interviews today",
  plan: "Growth",
  seatsUsed: 4,
  seatsLimit: 10,
  openJobsUsed: 4,
  openJobsLimit: 5,
  outreachLeft: 12,
  featuredLeft: 2,
};









export const notifications = [
  {
    id: "n-1",
    title: "Interview starts in 1 hour",
    time: "10:00 AM",
    unread: true,
    urgent: true,
  },
  {
    id: "n-2",
    title: "Offer expiring soon",
    time: "Yesterday",
    unread: true,
    urgent: true,
  },
  {
    id: "n-3",
    title: "New applicant — Software Engineer",
    time: "Mon",
    unread: false,
    urgent: false,
  },
];

/* ------------------------------------------------------------------ */

// Step 7i: hiringRequests moved to backend/scripts/seed_dev.py (STEP7I_REQUESTS).

export const hiringJobs = [
  {
    id: "job-1",
    title: "Product Designer",
    status: "Open",
    location: "Kolkata, West Bengal",
    mode: "Hybrid",
    type: "Full-time",
    daysOpen: 12,
    owner: "Priya Mehta",
    applicants: 24,
    stages: { applied: 24, shortlisted: 6, interview: 3, offer: 1, hired: 0 },
    badge: "+6 new",
    flagged: false,
  },
  {
    id: "job-2",
    title: "Software Engineer",
    status: "Closing soon",
    location: "Remote, India",
    mode: "Remote",
    type: "Full-time",
    daysOpen: 21,
    owner: "Rahul Verma",
    applicants: 18,
    stages: { applied: 18, shortlisted: 5, interview: 2, offer: 0, hired: 0 },
    badge: "+2 new",
    flagged: false,
  },
  {
    id: "job-3",
    title: "UX Researcher",
    status: "Open",
    location: "Bengaluru, Karnataka",
    mode: "On-site",
    type: "Full-time",
    daysOpen: 8,
    owner: "Sana Desai",
    applicants: 5,
    stages: { applied: 5, shortlisted: 2, interview: 1, offer: 0, hired: 0 },
    badge: null,
    flagged: false,
  },
  {
    id: "job-4",
    title: "Engineering Manager",
    status: "Pending approval",
    location: "Pune, Maharashtra",
    mode: "Hybrid",
    type: "Full-time",
    daysOpen: 6,
    owner: "Owner account",
    applicants: 0,
    stages: { applied: 0, shortlisted: 0, interview: 0, offer: 0, hired: 0 },
    badge: null,
    flagged: true,
  },
];

export const applications = [
  {
    id: "app-1",
    name: "Aanya Sen",
    blind: false,
    headline: "Senior Product Designer",
    job: "Product Designer",
    applied: "2 days ago",
    source: "Job search",
    stage: "Applied",
    rating: null,
    assignee: "Priya Mehta",
    match: "5 of 7 must-haves",
    resume: true,
    answers: true,
    practice: true,
  },
  {
    id: "app-2",
    name: "Candidate #23",
    blind: true,
    headline: "Software Engineer",
    job: "Software Engineer",
    applied: "4 days ago",
    source: "Startups hiring",
    stage: "Shortlisted",
    rating: null,
    assignee: "Rahul Verma",
    match: "4 of 6 must-haves",
    resume: true,
    answers: true,
    practice: false,
  },
  {
    id: "app-3",
    name: "Rohan Kapoor",
    blind: false,
    headline: "UX Researcher",
    job: "UX Researcher",
    applied: "6 days ago",
    source: "Recommendation",
    stage: "Interview",
    rating: 3.2,
    assignee: "Sana Desai",
    match: "6 of 7 must-haves",
    resume: true,
    answers: true,
    practice: true,
  },
];

// Step 7j: talentResults and shortlists moved to backend/scripts/seed_dev.py
// (STEP7J_TALENT + the "Backend 2026" shortlist); /employer/talent reads the API.

/* ------------------------------------------------------------------ */
/*  Employer shell                                                    */



/* ------------------------------------------------------------------ */
/*  Shared UI primitives (accessible sizes, WCAG AA)                  */
/* ------------------------------------------------------------------ */


export const insights = [
  {
    id: "ins-1",
    icon: Clock,
    headline: "Candidates wait 9 days for a first reply on Engineering jobs",
    reason: "The Engineering pipeline median first-response time is 9 days vs a 3-day company median. Two Engineering jobs have no reply in the last 7 days.",
    onView: () => toast("Opening Engineering speed details..."),
  },
  {
    id: "ins-2",
    icon: TrendingDown,
    headline: "Drop-off spikes between Shortlisted and Interview",
    reason: "38% of shortlisted candidates don't reach Interview — the largest drop-off in the funnel. Most common reason: no response within 7 days.",
    onView: () => toast("Viewing funnel drop-off analysis..."),
  },
  {
    id: "ins-3",
    icon: TrendingUp,
    headline: "Referral source converts 2.1× above average",
    reason: "Candidates from Referrals convert to interview at 34% vs a 16% average across sources (n = 41).",
    onView: () => toast("Viewing source quality report..."),
  },
];


export const dropoffByStage = [
  { stage: "Shortlisted", reason: "Rejected", count: 45, pct: 14 },
  { stage: "Interview", reason: "Withdrawn", count: 28, pct: 9 },
  { stage: "Offer", reason: "No response", count: 19, pct: 6 },
  { stage: "Applied", reason: "Rejected", count: 141, pct: 45 },
  { stage: "Hired", reason: "Did not join", count: 2, pct: 1 },
];




export const invitesData = { sent: 140, viewed: 89, accepted: 31, declined: 23, limit: 200, used: 140 };

export const processChecks = [
  {
    name: "Scorecard coverage",
    desc: "Share of jobs using a published scorecard and standard screening set.",
    value: "68%",
    n: 5,
    improvement: "Add anchors to the 'Communication' criterion",
  },
  {
    name: "Interview scorecards submitted",
    desc: "Share of interviews with scorecards submitted (team-level).",
    value: "82%",
    n: 24,
    improvement: "Send scorecard reminders 2 hours after each interview",
  },
  {
    name: "Reviewer agreement range",
    desc: "Spread between highest and lowest score on the same criterion, averaged at job level.",
    value: "1.2 pts",
    n: null,
    improvement: "Calibrate interviewers on role skills",
  },
  {
    name: "Blind review usage",
    desc: "Jobs using blind review and candidates reaching Interview from them.",
    value: "2 of 5 jobs",
    n: null,
    improvement: "Enable blind review for early-stage screening",
  },
  {
    name: "Rejections with a reason",
    desc: "Share of rejections that included a reason and a message.",
    value: "91%",
    n: 33,
    improvement: "Use kind-rejection templates for all declines",
  },
  {
    name: "Acknowledgement within 1 day",
    desc: "Share of candidates who received an acknowledgement within a day.",
    value: "76%",
    n: 312,
    improvement: "Enable auto-acknowledgement on all jobs",
  },
];

export const trustSummary = [
  { label: "Standing", value: "Good standing", tint: "success" },
  { label: "Verification", value: "Verified · 12 Oct 2026", tint: "success" },
  { label: "Open reports", value: "1", tint: "warning" },
  { label: "Jobs paused by policy", value: "0", tint: "success" },
];

export const recentTrustEvents = [
  { event: "Verification approved", date: "12 Oct 2026", link: "/employer/trust?tab=verification" },
  { event: "Job flagged: misleading pay", date: "8 Oct 2026", link: "/employer/trust?tab=reports" },
  { event: "Report resolved", date: "5 Oct 2026", link: "/employer/trust?tab=reports" },
  { event: "Appeal decided", date: "2 Oct 2026", link: "/employer/trust?tab=appeals" },
];

export const safetyReminders = [
  "Never ask candidates for money",
  "Keep conversations on the platform",
  "Judge candidates against the job only",
];

export const reportsFlags = [
  {
    id: "rf-1",
    date: "10 Oct 2026",
    type: "Report",
    category: "Asks for fees",
    item: "Product Designer (job #44)",
    status: "Open",
    excerpt: "Candidate reported being asked to pay a processing fee before interview.",
  },
  {
    id: "rf-2",
    date: "7 Oct 2026",
    type: "Flag",
    category: "Contact details in post",
    item: "Software Engineer (job #41)",
    status: "Resolved",
    excerpt: "Automated flag: phone number detected in job description.",
  },
  {
    id: "rf-3",
    date: "3 Oct 2026",
    type: "Report",
    category: "Misleading pay or role",
    item: "UX Researcher (job #38)",
    status: "Dismissed",
    excerpt: "Candidate said pay range differed from the posted role.",
  },
];

export const appealsList = [
  { id: "ap-1", decision: "Job pause (Software Engineer)", date: "5 Oct 2026", status: "Decision made", outcome: "Partly overturned" },
  { id: "ap-2", decision: "Verification decision", date: "20 Sep 2026", status: "In review", outcome: "-" },
  { id: "ap-3", decision: "Report outcome (Asks for fees)", date: "12 Sep 2026", status: "Submitted", outcome: "-" },
];

export const postingRules = [
  {
    title: "Verification",
    items: [
      { do: "Only verified companies can publish jobs and contact candidates." },
      { dont: "Publish jobs before completing verification." },
    ],
  },
  {
    title: "Accurate jobs",
    items: [
      { do: "Real openings, real pay ranges where shown, honest descriptions." },
      { dont: "Post 'evergreen' jobs that aren't actively hiring." },
    ],
  },
  {
    title: "No fees",
    items: [
      { do: "Keep the process free for candidates." },
      { dont: "Ask candidates for money for training, equipment, deposits or processing." },
    ],
  },
  {
    title: "No off-platform pressure",
    items: [
      { do: "Use platform messaging until after acceptance." },
      { dont: "Share personal contact details or payment links before acceptance." },
    ],
  },
  {
    title: "Fair criteria",
    items: [
      { do: "Use job-related criteria only." },
      { dont: "Ask about age, gender, religion, caste, nationality, marital status, family plans, health or photos; no knockout questions." },
    ],
  },
];

export const blockedCandidates = [
  { id: "bc-1", name: "Candidate #88", date: "9 Oct 2026", category: "Abusive messages", by: "Priya Mehta" },
  { id: "bc-2", name: "Candidate #92", date: "2 Oct 2026", category: "Spam applications", by: "Rahul Verma" },
];

// Audit log entries

export const securityAlerts = [
  { id: "sa-1", text: "New device sign-in from New Delhi", time: "2 hours ago", severity: "info" },
  { id: "sa-2", text: "Large export: activity log (1,248 rows)", time: "Yesterday", severity: "warning" },
];

/* ------------------------------------------------------------------ */
/*  Employer shell                                                    */
/* ------------------------------------------------------------------ */

export const billingSummary = [
  { label: "Plan", value: "Growth (annual)" },
  { label: "Next charge", value: "₹59,880 · 1 Mar 2027" },
  { label: "Active job posts", value: "3 of 5" },
  { label: "Seats used", value: "6 of 8" },
];

export const plans = [
  {
    id: "payg",
    name: "Pay as you go",
    price: "₹4,999",
    period: "one-time",
    tax: "+ 18% GST",
    status: "Pay as you go",
    included: [
      "1 active job post (live 30 days)",
      "Company page and verified badge",
      "Applicant pipeline, scorecards, interviews, offers",
      "3 team seats (included)",
      "Starter templates and scorecards",
      "Standard support",
    ],
    notIncluded: [
      "Talent search and invitations (add-on)",
      "Featured listings (add-on)",
      "Hiring analytics (basic only)",
      "Hires and onboarding (checklist only)",
    ],
    current: false,
    canSwitch: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "₹4,990",
    period: "/ month",
    tax: "+ 18% GST",
    annual: "₹59,880 / year (save 16%)",
    status: "Current plan",
    included: [
      "5 active job posts at a time",
      "Company page and verified badge",
      "Applicant pipeline, scorecards, interviews, offers",
      "8 team seats included",
      "Full template and scorecard library",
      "50 Talent Search invitations per month",
      "2 featured listings per month",
      "Full hiring analytics",
      "Checklist and documents for onboarding",
      "Standard support",
    ],
    notIncluded: [
      "Extra posts above plan limit",
      "Extra seats (prorated)",
    ],
    current: true,
    canSwitch: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "₹14,990",
    period: "/ month",
    tax: "+ 18% GST",
    annual: "₹179,880 / year (save 20%)",
    status: "Available",
    included: [
      "20 active job posts at a time",
      "Company page and verified badge",
      "Applicant pipeline, scorecards, interviews, offers",
      "25 team seats included, more available",
      "Full library, approvals",
      "300 Talent Search invitations per month",
      "8 featured listings per month",
      "Full hiring analytics, saved views, scheduled reports",
      "Checklist, documents and exports for onboarding",
      "Priority support",
    ],
    notIncluded: [],
    current: false,
    canSwitch: true,
  },
];

export const packs = [
  {
    id: "pack-1",
    name: "Single job post",
    includes: "1 post, live for 30 days",
    validity: "Credit valid 90 days",
    price: "₹4,999",
    tax: "+ 18% GST",
    type: "pack",
  },
  {
    id: "pack-3",
    name: "3-post pack",
    includes: "3 posts, each live for 30 days",
    validity: "Credit valid 180 days",
    price: "₹12,999",
    tax: "+ 18% GST",
    savings: "Save ₹1,998 vs singles",
    type: "pack",
  },
  {
    id: "pack-10",
    name: "10-post pack",
    includes: "10 posts, each live for 30 days",
    validity: "Credit valid 12 months",
    price: "₹39,999",
    tax: "+ 18% GST",
    savings: "Save ₹9,991 vs singles",
    type: "pack",
  },
];

export const addOns = [
  {
    id: "addon-1",
    name: "Featured listing (7 days)",
    what: "Highlights a job in search for 7 days, labeled \"Featured\"",
    notes: "Labeled featured; limited slots; refunded if removed for platform error",
  },
  {
    id: "addon-2",
    name: "Featured listing (14 days)",
    what: "Highlights a job in search for 14 days, labeled \"Featured\"",
    notes: "Labeled featured; limited slots; refunded if removed for platform error",
  },
  {
    id: "addon-3",
    name: "Invitation pack (25)",
    what: "25 Talent Search invitations",
    notes: "Unused expire after 90 days; daily limits still apply",
  },
  {
    id: "addon-4",
    name: "Invitation pack (100)",
    what: "100 Talent Search invitations",
    notes: "Unused expire after 90 days; daily limits still apply",
  },
  {
    id: "addon-5",
    name: "Extra seat",
    what: "1 additional team member",
    notes: "Prorated; frees at next billing date",
  },
];

export const credits = [
  {
    id: "cr-1",
    name: "Single job post",
    purchased: "2 Oct 2026",
    used: 1,
    left: 0,
    expiry: "31 Dec 2026",
    status: "Used up",
  },
  {
    id: "cr-2",
    name: "3-post pack",
    purchased: "15 Sep 2026",
    used: 2,
    left: 1,
    expiry: "14 Mar 2027",
    status: "Active",
  },
  {
    id: "cr-3",
    name: "Featured listing (7 days)",
    purchased: "20 Oct 2026",
    used: 1,
    left: 0,
    expiry: "27 Oct 2026",
    status: "Used up",
  },
];

export const usageMeters = [
  {
    label: "Active job posts",
    value: 3,
    limit: 5,
    pct: 60,
    reset: "1 Mar 2027",
    onBuy: () => toast("Opening job post packs..."),
  },
  {
    label: "Featured listings used",
    value: 1,
    limit: 2,
    pct: 50,
    reset: "1 Mar 2027",
    onBuy: () => toast("Opening featured listings..."),
  },
  {
    label: "Talent Search invitations (this month)",
    value: 34,
    limit: 50,
    pct: 68,
    reset: "1 Mar 2027",
    onBuy: () => toast("Opening invitation packs..."),
  },
  {
    label: "Team seats",
    value: 6,
    limit: 8,
    pct: 75,
    reset: "1 Mar 2027",
    onBuy: () => toast("Opening seat management..."),
  },
  {
    label: "Exports this month",
    value: 2,
    limit: 10,
    pct: 20,
    reset: "1 Mar 2027",
    onBuy: () => toast("Opening export options..."),
  },
];

export const usageChartData = [40, 55, 48, 62, 58, 60];

export const seats = [
  {
    id: "s-1",
    name: "Priya Mehta",
    role: "Owner",
    status: "Active",
    lastActive: "Today",
    seatType: "Paid",
  },
  {
    id: "s-2",
    name: "Rahul Verma",
    role: "Hiring manager",
    status: "Active",
    lastActive: "Yesterday",
    seatType: "Paid",
  },
  {
    id: "s-3",
    name: "Sana Desai",
    role: "Recruiter",
    status: "Active",
    lastActive: "2 days ago",
    seatType: "Paid",
  },
  {
    id: "s-4",
    name: "Arjun Patel",
    role: "Interviewer",
    status: "Active",
    lastActive: "3 days ago",
    seatType: "Guest",
  },
  {
    id: "s-5",
    name: "Meera Shah",
    role: "Admin",
    status: "Active",
    lastActive: "5 days ago",
    seatType: "Paid",
  },
  {
    id: "s-6",
    name: "Kiran Rao",
    role: "Viewer",
    status: "Active",
    lastActive: "1 week ago",
    seatType: "Free",
  },
];

export const invoices = [
  {
    id: "INV-2026-042",
    date: "1 Nov 2026",
    period: "Oct 2026",
    description: "Growth plan — monthly",
    amount: "₹4,990",
    gst: "₹898",
    total: "₹5,888",
    status: "Paid",
    po: "PO-1084",
    method: "Visa •••• 4417",
  },
  {
    id: "INV-2026-039",
    date: "1 Oct 2026",
    period: "Sep 2026",
    description: "Growth plan — monthly",
    amount: "₹4,990",
    gst: "₹898",
    total: "₹5,888",
    status: "Paid",
    po: "PO-1052",
    method: "Visa •••• 4417",
  },
  {
    id: "INV-2026-035",
    date: "15 Sep 2026",
    period: "Sep 2026",
    description: "3-post pack",
    amount: "₹12,999",
    gst: "₹2,340",
    total: "₹15,339",
    status: "Paid",
    po: "PO-1041",
    method: "UPI priya@upi",
  },
  {
    id: "INV-2026-031",
    date: "1 Sep 2026",
    period: "Aug 2026",
    description: "Growth plan — monthly",
    amount: "₹4,990",
    gst: "₹898",
    total: "₹5,888",
    status: "Paid",
    po: "PO-1023",
    method: "Visa •••• 4417",
  },
];

export const paymentMethods = [
  {
    id: "pm-1",
    type: "Card",
    label: "Visa •••• 4417",
    expiry: "12/27",
    default: true,
    status: "Active",
  },
  {
    id: "pm-2",
    type: "UPI",
    label: "priya@upi",
    expiry: "—",
    default: false,
    status: "Active",
  },
  {
    id: "pm-3",
    type: "Invoice billing",
    label: "Bank transfer (approved)",
    expiry: "—",
    default: false,
    status: "Active",
  },
];

export const spendingControls = {
  whoCanBuy: "Owner only",
  approvalThreshold: "₹25,000",
  monthlyCap: "₹1,00,000",
  autoPurchase: false,
  notifications: true,
};

/* ------------------------------------------------------------------ */
/*  Employer shell                                                    */
/* ------------------------------------------------------------------ */
