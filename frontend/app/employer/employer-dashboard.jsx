"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Bookmark,
  Briefcase,
  CalendarDays,
  FileText,
  Mic,
  MessageCircle,
  Settings,
  HelpCircle,
  Bell,
  ChevronDown,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Info,
  Sparkles,
  MoreHorizontal,
  X,
  Send,
  Eye,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Star,
  ExternalLink,
  Plus,
  Target,
  TrendingUp,
  Building2,
  Video,
  ChevronLeft,
  ChevronRight,
  Shield,
  Share2,
  RefreshCw,
  Pin,
  CreditCard,
  HardHat,
  LayoutGrid,
  LayoutDashboard,
  List,
  Gauge,
  Users,
  Briefcase as Briefcase2,
  FileText as FileText2,
  ClipboardList,
  BarChart3,
  Rocket,
  Award,
  Zap,
  Smartphone,
  Mail,
  Loader2,
  RotateCcw,
  Check,
  CheckCheck,
  PlusCircle,
  ArrowUpRight,
  Trash2,
  Phone,
  Headphones,
  Globe,
  Link as LinkIcon,
  Copy,
  Download,
  Printer,
  Wrench,
  Menu,
  LogOut,
  File,
  Image,
  Pause,
  Play,
  StopCircle,
  Mic as MicIcon,
  Video as VideoIcon,
  Link2,
  Target as TargetIcon,
  GitBranch,
  User as UserIcon,
  EyeOff,
  LayoutList,
  Maximize,
  Minimize,
  Inbox,
  Paperclip,
  Lock,
  ShieldAlert,
  AlertTriangle,
  TrendingDown,
  Unlock,
  UserPlus,
  Building as BuildingIcon,
  Briefcase as BriefcaseIcon,
  Monitor,
  Activity,
  PieChart,
  Timer,
  Clock as ClockIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design tokens (match globals.css / tailwind.config.js)            */
/* ------------------------------------------------------------------ */
const INK = "#0F1B2D";
const INK_SOFT = "#1C2B42";
const IVORY = "#FAF8F4";
const WHITE = "#FFFFFF";
const GOLD = "#B8955A";
const GOLD_DARK = "#9A7A45";
const GOLD_TINT = "#F3EBDD";
const STONE_700 = "#4A5568";
const STONE_400 = "#A0A7B4";
const STONE_200 = "#E5E1D8";
const SUCCESS = "#2E7D5B";
const SUCCESS_TINT = "#E7F3EC";
const SUCCESS_DARK = "#286749";
const WARNING = "#B7791F";
const WARNING_TINT = "#FDF3E0";
const WARNING_DARK = "#9A6210";
const ERROR = "#B42318";
const ERROR_TINT = "#FBE9E7";
const RADIUS_CARD = "rounded-xl";
const RADIUS_CONTROL = "rounded-lg";

/* ------------------------------------------------------------------ */
/*  Shared UI primitives                                              */
/* ------------------------------------------------------------------ */
function Card({ title, padded = true, children, className = "" }) {
  return (
    <div
      className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white ${className}`}
    >
      {title && (
        <div
          className={`border-b border-[#E5E1D8] pb-3 ${padded ? "px-6 pt-4" : "px-6 pt-3"}`}
        >
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
      )}
      <div
        className={`${padded ? "px-6" : "px-0"} ${padded ? "pb-5" : "pb-0"}`}
      >
        {children}
      </div>
    </div>
  );
}

function Btn({ children, onClick, secondary, small, size, className = "" }) {
  const isSmall = small || size === "small";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-white px-4 py-2 text-xs font-medium text-[#0F1B2D] transition ${secondary ? "border-[#E5E1D8] text-[#4A5568] bg-[#F4F1EA] hover:bg-[#F3EBDD]" : "bg-[#0F1B2D] text-white hover:bg-[#1C2B42]"} ${isSmall ? "px-2.5 py-1.5 text-[10px] min-w-[72px]" : "px-4 py-2 text-xs min-w-[80px]"} ${className}`}
    >
      {children}
    </button>
  );
}

function StatChip({ label, value, delta }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-[#4A5568]">{label}</span>
      <div className="flex items-baseline gap-1">
        <b className="text-sm font-serif font-semibold">{value}</b>
        {delta && <span className="text-[10px] text-[#286749]">{delta}</span>}
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    Open: "border-[#E7F3EC] text-[#286749]",
    "Closing soon": "border-[#FDF3E0] text-[#9A6210]",
    Paused: "border-[#E5E1D8] text-[#4A5568]",
    "Pending approval": "border-[#F3EBDD] text-[#806236]",
    Applied: "border-[#E5E1D8] text-[#4A5568]",
    Shortlisted: "border-[#F3EBDD] text-[#9A7A45]",
    Interview: "border-[#F3EBDD] text-[#9A7A45]",
    Offer: "border-[#E7F3EC] text-[#286749]",
    Hired: "border-[#E7F3EC] text-[#286749]",
    "Not selected": "border-[#E5E1D8] text-[#4A5568]",
    "Awaiting approval": "border-[#F3EBDD] text-[#806236]",
    Sent: "border-[#E7F3EC] text-[#286749]",
    Countered: "border-[#FDF3E0] text-[#9A6210]",
    Accepted: "border-[#E7F3EC] text-[#286749]",
    Verified: "border-[#E7F3EC] text-[#286749]",
    Pending: "border-[#F3EBDD] text-[#806236]",
    "Action needed": "border-[#FBE9E7] text-[#B42318]",
    Paused2: "border-[#E5E1D8] text-[#4A5568]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${map[status] || map.Open}`}
    >
      {status}
    </span>
  );
}

function Section({ title, children, className = "" }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function SectionHead({ title, subtitle, children, className = "" }) {
  return (
    <div
      className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${className}`}
    >
      <div>
        <h2 className="text-sm font-serif font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-[10px] text-[#4A5568] mt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center py-10">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#F3EBDD]">
        <Icon size={20} />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-[12px] text-[#4A5568] max-w-[260px]">{subtitle}</p>
      {action && <Btn onClick={action}>{actionLabel}</Btn>}
    </div>
  );
}

function SkeletonRow({ className = "" }) {
  return (
    <div
      className={`h-10 rounded-lg bg-[#E5E1D8] animate-pulse ${className}`}
    />
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-[#B8955A]" : "bg-[#E5E1D8]"}`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

function Sparkline({ values, color = INK }) {
  // Simple SVG sparkline
  const pts = values.map((v, i) => `${i * 30},${40 - v * 20}`).join(" ");
  return (
    <svg width={values.length * 30} height={40} className="opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sample data                                                       */
/* ------------------------------------------------------------------ */
const company = {
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

const user = {
  name: "Priya Mehta",
  role: "Employer",
  teamRole: "Recruiter",
  signedIn: true,
};

const kpis = [
  {
    label: "Open jobs",
    value: "4",
    caption: "1 closing this week",
    change: "▲ 2 vs last week",
    color: GOLD_DARK,
    sparkline: [1, 2, 2, 3, 4],
  },
  {
    label: "New applicants (7 days)",
    value: "26",
    caption: "",
    change: "▲ 8 vs last week",
    color: INK,
    sparkline: [2, 4, 3, 5, 6],
  },
  {
    label: "Interviews this week",
    value: "9",
    caption: "",
    change: "▲ 1 vs last week",
    color: GOLD_DARK,
    sparkline: [1, 1, 2, 2, 2],
  },
  {
    label: "Offers out",
    value: "2",
    caption: "1 expiring in 48h",
    change: "▲ 0 vs last week",
    color: INK,
    sparkline: [0, 1, 1, 2, 2],
  },
];

const nextActions = [
  {
    label: "Review new applicants",
    reason: "3 applicants unreviewed for 3+ days",
    action: "Review",
  },
];

const attention = [
  {
    id: "a-1",
    icon: Briefcase,
    text: "5 new applicants unreviewed for Product Designer",
    wait: "4 days",
    chip: "Over 3 days",
    chipType: "warning",
    action: "Review applicants",
  },
  {
    id: "a-2",
    icon: Clock,
    text: "Candidate waiting over 14 days — Software Engineer",
    wait: "16 days",
    chip: "No reply yet",
    chipType: "error",
    action: "Reply or reject kindly",
  },
  {
    id: "a-3",
    icon: ClipboardList,
    text: "Interview feedback overdue — 2 scorecards",
    wait: "1 day",
    chip: "Overdue",
    chipType: "warning",
    action: "Submit scorecard",
  },
  {
    id: "a-4",
    icon: Mail,
    text: "Offer expiring within 48 hours — Senior Designer",
    wait: "48 hours",
    chip: "Expiring soon",
    chipType: "warning",
    action: "Review offer",
  },
  {
    id: "a-5",
    icon: ShieldAlert,
    text: "Trust & Safety report — Job post #44",
    wait: "2 days",
    chip: "Needs review",
    chipType: "error",
    action: "Open report",
  },
];

const jobs = [
  {
    id: "job-1",
    title: "Product Designer",
    status: "Open",
    location: "Kolkata, West Bengal",
    mode: "Hybrid",
    daysOpen: 12,
    owner: "Priya Mehta",
    applicants: 24,
    stages: { applied: 24, shortlisted: 6, interview: 3, offer: 1 },
    badge: "+6 new",
    hint: false,
    flagged: false,
  },
  {
    id: "job-2",
    title: "Software Engineer",
    status: "Closing soon",
    location: "Remote, India",
    mode: "Remote",
    daysOpen: 21,
    owner: "Rahul Verma",
    applicants: 18,
    stages: { applied: 18, shortlisted: 5, interview: 2, offer: 0 },
    badge: "+2 new",
    hint: true,
    flagged: false,
  },
  {
    id: "job-3",
    title: "UX Researcher",
    status: "Open",
    location: "Bengaluru, Karnataka",
    mode: "On-site",
    daysOpen: 8,
    owner: "Sana Desai",
    applicants: 5,
    stages: { applied: 5, shortlisted: 2, interview: 1, offer: 0 },
    badge: null,
    hint: true,
    flagged: false,
  },
  {
    id: "job-4",
    title: "Engineering Manager",
    status: "Pending approval",
    location: "Pune, Maharashtra",
    mode: "Hybrid",
    daysOpen: 6,
    owner: "Owner account",
    applicants: 0,
    stages: { applied: 0, shortlisted: 0, interview: 0, offer: 0 },
    badge: null,
    hint: false,
    flagged: true,
  },
];

const candidates = [
  {
    id: "cand-1",
    name: "Aanya Sen",
    blind: false,
    headline: "Senior Product Designer",
    job: "Product Designer",
    applied: "2 days ago",
    source: "Job search",
    match: "5 of 7 must-have skills on resume",
    resume: true,
    screening: true,
    practice: true,
    actions: ["Shortlist", "Reject kindly"],
  },
  {
    id: "cand-2",
    name: "Candidate #23",
    blind: true,
    headline: "Software Engineer",
    job: "Software Engineer",
    applied: "4 days ago",
    source: "Startups hiring",
    match: "4 of 6 must-have skills on resume",
    resume: true,
    screening: false,
    practice: false,
    actions: ["Shortlist", "Reject kindly"],
  },
  {
    id: "cand-3",
    name: "Rohan Kapoor",
    blind: false,
    headline: "UX Researcher",
    job: "UX Researcher",
    applied: "6 days ago",
    source: "Recommendation",
    match: "6 of 7 must-have skills on resume",
    resume: true,
    screening: true,
    practice: true,
    actions: ["Shortlist", "Reject kindly"],
  },
];

const todayInterviews = [
  {
    time: "11:00 AM IST",
    candidate: "Aanya Sen",
    role: "Product Designer",
    interviewers: "Priya · Rahul",
    format: "Video",
    join: false,
  },
  {
    time: "2:30 PM IST",
    candidate: "Candidate #44",
    role: "Software Engineer",
    interviewers: "Sana",
    format: "Video",
    join: true,
  },
];

const pendingOffers = [
  {
    id: "off-1",
    candidate: "Aanya Sen",
    job: "Product Designer",
    status: "Sent",
    expiry: "in 48 hours",
    expiryType: "warning",
    countered: false,
  },
  {
    id: "off-2",
    candidate: "Rohan Kapoor",
    job: "UX Researcher",
    status: "Awaiting approval",
    expiry: "in 6 days",
    expiryType: null,
    countered: true,
  },
];

const teamActivity = [
  {
    text: "Priya moved Arjun to Interview",
    time: "10:14 AM",
    link: "/employer/jobs/job-1/applicants",
  },
  {
    text: "Rahul submitted feedback for Sana",
    time: "9:42 AM",
    link: "/employer/jobs/job-2/applicants",
  },
  {
    text: "Offer v2 approved by Meera",
    time: "Yesterday",
    link: "/employer/offers",
  },
  {
    text: "Sana shortlisted 2 candidates",
    time: "Yesterday",
    link: "/employer/candidates",
  },
];

const notifications = [
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
/*  Employer shell                                                    */
/* ------------------------------------------------------------------ */
const employerSidebar = [
  ["Dashboard", LayoutDashboard, "/employer/dashboard"],
  ["Hiring", Briefcase, "/employer/hiring"],
  ["Talent", Users, "/employer/talent"],
  ["Interviews", CalendarDays, "/employer/interviews"],
  ["Offers", Mail, "/employer/offers"],
  ["Hires", Award, "/employer/hires"],
  ["Analytics", BarChart3, "/employer/analytics"],
];

function EmployerShell({ children, active = "Dashboard", className = "" }) {
  const unreadCount = notifications.filter((n) => n.unread).length;
  return (
    <div className={`min-h-screen bg-[#FAF8F4] text-[#0F1B2D] ${className}`}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col bg-[#0F1B2D] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 font-serif">
            {company.logo}
          </span>
          <b>
            {company.name}{" "}
            <small className="ml-1 text-white/50">EMPLOYER</small>
          </b>
        </div>
        <nav className="mt-5 space-y-1 px-3">
          {employerSidebar.map(([n, I, u]) => {
            const Comp = I;
            const isActive = n === active;
            return (
              <Link
                key={n}
                href={u}
                className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-xs ${isActive ? "bg-[#1C2B42] text-white" : "text-white/65 hover:bg-white/5"}`}
              >
                {isActive && (
                  <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />
                )}
                <Comp size={17} />
                {n}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1 px-3 pb-5">
          <Link
            href="/help"
            className="flex h-10 items-center gap-3 px-3 text-xs text-white/60"
          >
            <HelpCircle size={17} /> Help
          </Link>
          <button
            type="button"
            onClick={() => {}}
            className="flex w-full items-center gap-3 rounded-lg border border-white/10 p-3 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-ink">
              PM
            </span>
            <span>
              <b className="block text-xs">{user.name}</b>
              <small className="text-white/50">
                {user.teamRole} · {user.role} · switch role
              </small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur sm:px-7 lg:ml-[238px]">
        <div className="relative hidden sm:block">
          <Search
            className="absolute left-3 top-2.5 text-[#A0A7B4]"
            size={16}
          />
          <input
            placeholder="Search jobs and candidates"
            className="h-10 w-72 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs"
          />
        </div>
        <span className="text-sm font-semibold sm:hidden">Employer</span>
        <button className="relative ml-auto grid h-10 w-10 place-items-center">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[#B42318] text-[8px] text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <button className="ml-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0F1B2D] text-xs text-white">
            PM
          </span>
          <span className="hidden text-xs sm:block">{user.name}</span>
          <ChevronDown size={14} />
        </button>
      </header>
      <main
        id="employer-main"
        className="mx-auto max-w-[1280px] px-4 pb-24 pt-7 sm:px-7 lg:ml-[238px] lg:px-8"
      >
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#E5E1D8] bg-white px-2 py-2 lg:hidden">
        {[
          ["Home", "/employer/dashboard", LayoutDashboard],
          ["Hiring", "/employer/hiring", Briefcase],
          ["Talent", "/employer/talent", Users],
          ["Interviews", "/employer/interviews", CalendarDays],
          ["More", "/help", UserRound],
        ].map(([x, u, I]) => (
          <Link
            href={u}
            key={x}
            className="flex flex-col items-center gap-1 py-1 text-xs text-[#4A5568]"
          >
            <I size={17} />
            {x}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard page                                                    */
/* ------------------------------------------------------------------ */
function DashboardPage({ page }) {
  const [snoozed, setSnoozed] = useState([]);
  const sortBy = "newest";
  const activeAttention = attention.filter((a) => !snoozed.includes(a.id));

  const stagePct = (stages) => {
    const total = stages.applied || 1;
    return {
      applied: 100,
      shortlisted: Math.round((stages.shortlisted / total) * 100),
      interview: Math.round((stages.interview / total) * 100),
      offer: Math.round((stages.offer / total) * 100),
    };
  };

  return (
    <EmployerShell
      active={page === "dashboard" ? "Dashboard" : active}
      page={page}
    >
      {/* Greeting and company status */}
      <div className="mb-6">
        <Card title padded>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-6 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 font-serif">
                {company.logo}
              </span>
              <div>
                <p className="text-sm font-serif font-semibold">
                  Good morning, {user.name}
                </p>
                <b className="text-xs">{company.name}</b>
              </div>
            </div>
            <div className="flex gap-2">
              {company.verified ? (
                <span className="inline-flex items-center rounded-full border border-[#286749] bg-[#E7F3EC] px-2.5 py-0.5 text-[9px] text-[#286749] font-medium">
                  <CheckCircle2 size={10} className="mr-1" /> Verified employer
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2.5 py-0.5 text-[9px] text-[#806236] font-medium">
                  <AlertCircle size={10} className="mr-1" /> Verification
                  pending
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-[#4A5568] px-6 pt-2 pb-4">
            {company.summary}
          </p>
        </Card>
      </div>

      {/* Next best action */}
      <div className="mb-6">
        <Card title padded className={`bg-[#FDF3E0] border-[#F3EBDD]`}>
          <div className="flex items-start gap-3 px-6 pt-4 pb-3">
            <Sparkles size={13} className="text-[#9A7A45] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-[#806236]">Suggested</p>
              <b className="text-sm">{nextActions[0].label}</b>
              <p className="text-[10px] text-[#4A5568] mt-1">
                {nextActions[0].reason}
              </p>
            </div>
          </div>
          <div className="px-6 pt-2 pb-4">
            <Btn onClick={() => {}} small>
              {nextActions[0].action}
            </Btn>
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
              }}
              className="text-[10px] text-[#4A5568] underline underline-offset-2 ml-2"
            >
              Not now
            </Link>
          </div>
        </Card>
      </div>

      {/* KPI row */}
      <div className="mb-6">
        <div className="grid gap-4 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} title padded>
              <div className="px-6 pt-3 pb-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <b className="text-4xl font-serif font-semibold text-[#0F1B2D]">
                    {k.value}
                  </b>
                  <span className="text-xs text-[#286749] font-medium">
                    {k.change}
                  </span>
                </div>
                <p className="text-[10px] text-[#4A5568] mb-3">{k.caption}</p>
                <Sparkline
                  values={k.sparkline}
                  color={k.color}
                  className="mb-2"
                />
                <p className="text-[9px] text-[#4A5568]">
                  Click to filter matching page
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main column: Needs your attention */}
          <div className="lg:col-span-8 space-y-6">
            <Card title="Needs your attention" padded>
              {activeAttention.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="You're all caught up"
                  subtitle="Nothing needs your attention right now."
                  action={() => {}}
                  actionLabel="Post a job"
                />
              ) : (
                <div className="space-y-3">
                  {activeAttention.map((a) => {
                    const chipMap = {
                      warning: "border-[#FDF3E0] text-[#9A6210] bg-[#FDF3E0]",
                      error: "border-[#FBE9E7] text-[#B42318] bg-[#FBE9E7]",
                    };
                    return (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white hover:border-[#B8955A] transition cursor-pointer"
                      >
                        <a.icon
                          size={16}
                          className="text-[#0F1B2D] mt-0.5 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <b className="text-xs">{a.text}</b>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${chipMap[a.chipType]}`}
                            >
                              {a.chip}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#4A5568]">
                            {a.wait} · {a.action}
                          </p>
                        </div>
                        <Btn onClick={() => {}} small>
                          {a.action}
                        </Btn>
                        {a.chipType !== "error" && (
                          <button
                            onClick={() => setSnoozed([...snoozed, a.id])}
                            className="p-1 text-[#4A5568] hover:text-[#0F1B2D]"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Open jobs and pipelines */}
            <Card title="Your open jobs" padded>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Plus size={14} />
                  <Btn>New job</Btn>
                </div>
                <Btn onClick={() => {}} secondary small>
                  View all jobs
                </Btn>
              </div>
              <div className="space-y-3">
                {jobs.map((j) => {
                  const pct = stagePct(j.stages);
                  const statusMap = {
                    Open: "border-[#E7F3EC] text-[#286749]",
                    "Closing soon": "border-[#FDF3E0] text-[#9A6210]",
                    Paused: "border-[#E5E1D8] text-[#4A5568]",
                    "Pending approval": "border-[#F3EBDD] text-[#806236]",
                  };
                  return (
                    <div
                      key={j.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white hover:border-[#B8955A] transition"
                    >
                      <div className="flex flex-col gap-1">
                        <b className="text-xs font-semibold">{j.title}</b>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${statusMap[j.status]}`}
                        >
                          {j.status}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-[#4A5568] mb-1">
                          {j.location} · {j.mode} · {j.daysOpen} days open
                        </p>
                        <div className="flex items-end gap-1 mb-2 h-6">
                          {[
                            ["Applied", j.stages.applied, INK],
                            ["Shortlisted", j.stages.shortlisted, GOLD],
                            ["Interview", j.stages.interview, STONE_400],
                            ["Offer", j.stages.offer, SUCCESS],
                          ].map(([label, v, c]) => (
                            <div key={label} className="flex-1 relative">
                              <div className="h-full w-full bg-[#E5E1D8] rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-${c === INK ? "#0F1B2D" : c === GOLD ? "#B8955A" : c === STONE_400 ? "#A0A7B4" : "#2E7D5B"}`}
                                  style={{
                                    width: `${Math.min(pct[label.toLowerCase()], 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] text-[#4A5568]">
                                {label}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#4A5568]">
                          <span>{j.applicants} applicants</span>
                          {j.badge && (
                            <span className="inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2 py-0.5 text-[9px] text-[#806236]">
                              {j.badge}
                            </span>
                          )}
                          {j.hint && (
                            <span className="flex items-center gap-1 text-[9px] text-[#806236]">
                              <Sparkles size={9} /> AI suggestion
                            </span>
                          )}
                          {j.flagged && (
                            <span className="inline-flex items-center rounded-full border border-[#FBE9E7] bg-[#FBE9E7] px-2 py-0.5 text-[9px] text-[#B42318]">
                              Needs attention
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                      <Btn onClick={() => {}} small>
                        Open pipeline
                      </Btn>
                      <Btn onClick={() => {}} secondary small>
                        Edit
                      </Btn>
                      <button
                        onClick={() => {}}
                        className="p-2 text-[#4A5568] hover:text-[#0F1B2D] hover:bg-[#F3EBDD] rounded-lg transition"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {jobs.some((j) => j.hint) && (
                <div className="mt-3 flex items-start gap-2 text-[10px] text-[#4A5568]">
                  <Sparkles size={11} className="text-[#9A7A45] mt-0.5" />
                  <p>
                    Jobs without applicants after 14 days show a hint. Match
                    hints help you read faster. They don't decide.
                  </p>
                </div>
              )}
            </Card>

            {/* Candidates to review */}
            <Card title="Candidates to review" padded>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ButtonGroup
                    options={["Newest", "Longest waiting"]}
                    value={sortBy}
                    onChange={() => {}}
                  />
                </div>
                <Btn onClick={() => {}} secondary small>
                  Review queue
                </Btn>
              </div>
              <div className="space-y-3">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white hover:border-[#B8955A] transition cursor-pointer"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#1C2B42] text-[10px] font-semibold text-white flex-shrink-0">
                      {c.blind ? "C#" : c.name.slice(0, 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <b className="text-xs">
                          {c.blind ? "Candidate" : c.name}
                        </b>
                        {c.practice && (
                          <span className="inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2 py-0.5 text-[9px] text-[#806236]">
                            Practice result shown with the candidate's
                            permission
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#4A5568] mb-1">
                        {c.headline} · {c.job}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-[#4A5568] mb-2">
                        <span>{c.applied}</span>
                        <span>·</span>
                        <span>{c.source}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-[#806236] mb-2">
                        <Sparkles size={9} />
                        <span>{c.match}</span>
                        <span className="text-[9px] text-[#4A5568]">
                          Match hints help you read faster. They don't decide.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#4A5568]">
                        {c.resume && <span>Resume</span>}
                        {c.screening && <span>· Screening answers</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {c.actions.map((act) => (
                        <Btn key={act} onClick={() => {}} small>
                          {act}
                        </Btn>
                      ))}
                      <Btn onClick={() => {}} secondary small>
                        Open
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Side column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Today */}
            <Card title="Today" padded>
              <div className="space-y-3">
                {todayInterviews.length === 0 ? (
                  <p className="text-[11px] text-[#4A5568] text-center py-4">
                    No interviews today.
                  </p>
                ) : (
                  todayInterviews.map((i) => (
                    <div key={i.time} className="flex items-start gap-2">
                      <span className="mt-0.5 text-[10px] font-medium text-[#0F1B2D]">
                        {i.time}
                      </span>
                      <div className="flex-1 min-w-0">
                        <b className="text-xs">{i.candidate}</b>
                        <p className="text-[10px] text-[#4A5568]">
                          {i.role} · {i.interviewers} · {i.format}
                        </p>
                      </div>
                      <Btn onClick={() => {}} size="small" small>
                        {i.join ? "Join" : "Prepare"}
                      </Btn>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Offers pending */}
            <Card title="Offers pending" padded>
              <div className="space-y-3">
                {pendingOffers.map((o) => (
                  <div
                    key={o.id}
                    className="p-3 rounded-lg border border-[#E5E1D8] bg-white"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <b className="text-xs">{o.candidate}</b>
                      <StatusChip status={o.status} />
                    </div>
                    <p className="text-[10px] text-[#4A5568] mb-1">{o.job}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[#4A5568]">
                      <span>{o.expiry}</span>
                      {o.expiryType === "warning" && (
                        <span className="inline-flex items-center rounded-full border border-[#FDF3E0] bg-[#FDF3E0] px-2 py-0.5 text-[9px] text-[#9A6210]">
                          Expires soon
                        </span>
                      )}
                      {o.countered && (
                        <span className="inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2 py-0.5 text-[9px] text-[#806236]">
                          Countered
                        </span>
                      )}
                    </div>
                    <Btn onClick={() => {}} small className="mt-2 w-full">
                      Open
                    </Btn>
                    {o.countered && (
                      <p className="text-[10px] text-[#806236] mt-2 bg-[#F3EBDD] rounded-lg p-2">
                        Candidate requested changes.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Plan and usage */}
            <Card title="Plan and usage" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Plan</span>
                  <span className="text-[#0F1B2D] font-medium">
                    {company.plan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Open jobs used</span>
                  <span className="text-[#0F1B2D] font-medium">
                    {company.openJobsUsed} of {company.openJobsLimit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Seats used</span>
                  <span className="text-[#0F1B2D] font-medium">
                    {company.seatsUsed} of {company.seatsLimit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Outreach left today</span>
                  <span className="text-[#0F1B2D] font-medium">
                    {company.outreachLeft}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Featured listings left</span>
                  <span className="text-[#0F1B2D] font-medium">
                    {company.featuredLeft}
                  </span>
                </div>
              </div>
              <Btn onClick={() => {}} small className="w-full">
                Manage plan
              </Btn>
            </Card>

            {/* Trust and tips */}
            <Card title="Trust and tips" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={13} className="text-[#286749]" />
                  <span className="text-xs font-medium">
                    {company.verified
                      ? "Verified employer"
                      : "Verification pending"}{" "}
                    · Last reviewed Oct 20
                  </span>
                </div>
                <p className="mb-3">
                  Open reports: 0 ·{" "}
                  <a href="#" className="text-[#B8955A] underline">
                    Posting rules
                  </a>
                </p>
                <div className="bg-[#F3EBDD] rounded-lg p-3 border border-[#F3EBDD]">
                  <p className="text-[10px] text-[#806236]">
                    Jobs that show a salary range usually get more qualified
                    applicants.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

function ButtonGroup({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-[#E5E1D8] bg-white">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1 text-[10px] transition ${o === value ? "bg-[#F3EBDD] text-[#806236]" : "text-[#4A5568] hover:text-[#0F1B2D]"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export { DashboardPage };
