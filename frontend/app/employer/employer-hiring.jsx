"use client";
import { useState, useMemo, useCallback } from "react";
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
  Banknote,
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
  Edit,
  Eye as EyeIcon,
  User as User2,
  GraduationCap,
  Award as AwardIcon,
  Trophy,
  Link as Link2Icon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design tokens                                                     */
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
          className={`border-b border-[#E5E1D8] pb-3 ${padded ? "px-6 pt-5" : "px-6 pt-3"}`}
        >
          <span className="text-[10px] text-[#4A5568] font-medium uppercase tracking-wide">
            {title}
          </span>
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

function Btn({ children, onClick, secondary, small, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent bg-white px-4 py-2 text-xs font-medium text-[#0F1B2D] transition ${secondary ? "border-[#E5E1D8] text-[#4A5568] hover:bg-[#F3EBDD]" : "bg-[#0F1B2D] text-white hover:bg-[#1C2B42]"} ${small ? "px-2.5 py-1.5 text-[10px]" : ""} ${className}`}
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
    Draft: "border-[#E5E1D8] text-[#4A5568]",
    "Pending approval": "border-[#F3EBDD] text-[#806236]",
    Open: "border-[#E7F3EC] text-[#286749]",
    "Closing soon": "border-[#FDF3E0] text-[#9A6210]",
    Paused: "border-[#E5E1D8] text-[#4A5568]",
    Closed: "border-[#0F1B2D] text-[#0F1B2D]",
    Filled: "bg-[#0F1B2D] text-white",
    "Needs attention": "border-[#FBE9E7] text-[#B42318]",
    Approved: "border-[#E7F3EC] text-[#286749]",
    Declined: "border-[#E5E1D8] text-[#4A5568]",
    Applied: "border-[#E5E1D8] text-[#4A5568]",
    Shortlisted: "border-[#F3EBDD] text-[#9A7A45]",
    Interview: "border-[#0F1B2D] text-[#0F1B2D]",
    Offer: "border-[#E7F3EC] text-[#286749]",
    Hired: "bg-[#0F1B2D] text-white",
    Rejected: "border-[#E5E1D8] text-[#4A5568]",
    Withdrawn: "border-[#E5E1D8] text-[#4A5568]",
    Scheduled: "border-[#E5E1D8] text-[#4A5568]",
    "Confirmed by candidate": "border-[#E7F3EC] text-[#286749]",
    "Reschedule requested": "border-[#FDF3E0] text-[#9A6210]",
    Cancelled: "border-[#E5E1D8] text-[#4A5568]",
    Sent: "border-[#E7F3EC] text-[#286749]",
    Countered: "border-[#FDF3E0] text-[#9A6210]",
    Accepted: "border-[#E7F3EC] text-[#286749]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${map[status] || map.Draft}`}
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
  const pts = values.map((v, i) => `${i * 30},${40 - v * 20}`).join(" ");
  return (
    <svg width={values.length * 30} height={40} className="opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
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

/* ------------------------------------------------------------------ */
/*  Sample data                                                       */
/* ------------------------------------------------------------------ */
const company = {
  name: "Northstar Labs",
  logo: "N",
  verified: true,
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
  { label: "Open jobs", value: "4" },
  { label: "Total applicants", value: "86" },
  { label: "Interviews this week", value: "9" },
  { label: "Offers out", value: "2" },
  { label: "Avg time to hire", value: "28 days" },
];

const hiringRequests = [
  {
    id: "req-1",
    role: "Senior Product Designer",
    department: "Product",
    headcount: 1,
    urgency: "High",
    requestedBy: "Priya Mehta",
    targetStart: "Dec 1",
    budget: "₹18L–₹24L",
    status: "Approved",
    approver: "Owner",
  },
  {
    id: "req-2",
    role: "Software Engineer",
    department: "Engineering",
    headcount: 2,
    urgency: "Medium",
    requestedBy: "Rahul Verma",
    targetStart: "Jan 15",
    budget: "₹14L–₹20L",
    status: "Pending approval",
    approver: "Admin",
  },
  {
    id: "req-3",
    role: "UX Researcher",
    department: "Design",
    headcount: 1,
    urgency: "Low",
    requestedBy: "Sana Desai",
    targetStart: "Feb 1",
    budget: "₹16L–₹22L",
    status: "Draft",
    approver: "—",
  },
];

const jobs = [
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

const applications = [
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

const interviews = [
  {
    id: "int-1",
    time: "11:00 AM IST",
    date: "Today",
    candidate: "Aanya Sen",
    job: "Product Designer",
    round: "Final",
    format: "Video",
    duration: "45 min",
    interviewers: "Priya · Rahul",
    status: "Scheduled",
    join: false,
  },
  {
    id: "int-2",
    time: "2:30 PM IST",
    date: "Today",
    candidate: "Candidate #44",
    job: "Software Engineer",
    round: "Technical",
    format: "Video",
    duration: "60 min",
    interviewers: "Sana",
    status: "Confirmed by candidate",
    join: true,
  },
  {
    id: "int-3",
    time: "10:00 AM IST",
    date: "Tomorrow",
    candidate: "Rohan Kapoor",
    job: "UX Researcher",
    round: "Screening call",
    format: "Phone",
    duration: "30 min",
    interviewers: "Priya",
    status: "Scheduled",
    join: false,
  },
];

const offers = [
  {
    id: "off-1",
    candidate: "Aanya Sen",
    job: "Product Designer",
    title: "Product Designer",
    compensation: "₹22L",
    startDate: "Jan 2",
    status: "Sent",
    expiry: "in 48 hours",
    owner: "Priya Mehta",
  },
  {
    id: "off-2",
    candidate: "Rohan Kapoor",
    job: "UX Researcher",
    title: "UX Researcher",
    compensation: "₹18L",
    startDate: "Jan 15",
    status: "Awaiting approval",
    expiry: "in 6 days",
    owner: "Sana Desai",
  },
];

const talentResults = [
  {
    id: "tal-1",
    name: "Candidate #11",
    blind: true,
    headline: "Product Designer",
    skills: ["Figma", "React", "User research"],
    experience: "Mid",
    location: "Kolkata",
    availability: "Immediately",
    salary: "₹14L–₹18L",
    mode: "Hybrid",
    match: "Skills match: 5 of 7 must-haves",
  },
  {
    id: "tal-2",
    name: "Candidate #12",
    blind: true,
    headline: "Software Engineer",
    skills: ["React", "Node.js", "TypeScript"],
    experience: "Senior",
    location: "Remote",
    availability: "1 month",
    salary: "₹20L–₹26L",
    mode: "Remote",
    match: "Skills match: 6 of 7 must-haves",
  },
];

const shortlists = [
  {
    id: "sl-1",
    name: "Backend 2026",
    count: 4,
    updated: "Oct 28",
    status: "Not contacted",
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
  ["Hires", AwardIcon, "/employer/hires"],
  ["Analytics", BarChart3, "/employer/analytics"],
  ["Billing", Banknote, "/employer/billing"],
];

function EmployerShell({ children, active = "Dashboard", className = "" }) {
  const notifications = [
    {
      id: "n-1",
      title: "Interview starts in 1 hour",
      time: "10:00 AM",
      unread: true,
    },
    {
      id: "n-2",
      title: "Offer expiring soon",
      time: "Yesterday",
      unread: true,
    },
  ];
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
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-[#E5E1D8] bg-white px-2 py-2 lg:hidden">
        {[
          ["Home", "/employer/dashboard", LayoutDashboard],
          ["Hiring", "/employer/hiring", Briefcase],
          ["Talent", "/employer/talent", Users],
          ["Interviews", "/employer/interviews", CalendarDays],
          ["Billing", "/employer/billing", Banknote],
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

/* ================================================================== */
/*  Page 1: Hiring Overview                                           */
/* ================================================================== */
function HiringOverviewPage({ page }) {
  const [tab, setTab] = useState("Jobs");
  const tabs = ["Jobs", "Requests", "Needs attention"];
  return (
    <EmployerShell active="Dashboard" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title="Hiring Overview"
          subtitle="Jobs, internal hiring requests and what needs your attention today."
        >
          <div className="flex gap-2">
            <Btn onClick={() => {}}>Hiring request</Btn>
            <Btn>Job</Btn>
          </div>
        </SectionHead>
        <div className="grid gap-4 lg:grid-cols-5 mt-4 mb-6">
          {kpis.map((k) => (
            <Card key={k.label} title padded>
              <div className="px-6 pt-3 pb-4">
                <b className="text-3xl font-serif font-semibold">{k.value}</b>
              </div>
            </Card>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] transition ${tab === t ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {tab === "Jobs" && (
              <Card title padded>
                <div className="space-y-3">
                  {jobs.map((j) => {
                    const pct = {
                      applied: 100,
                      shortlisted: Math.round(
                        (j.stages.shortlisted / Math.max(j.stages.applied, 1)) *
                          100,
                      ),
                      interview: Math.round(
                        (j.stages.interview / Math.max(j.stages.applied, 1)) *
                          100,
                      ),
                      offer: Math.round(
                        (j.stages.offer / Math.max(j.stages.applied, 1)) * 100,
                      ),
                    };
                    return (
                      <div
                        key={j.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white hover:border-[#B8955A] transition cursor-pointer"
                      >
                        <div className="flex flex-col gap-1">
                          <b className="text-xs font-semibold">{j.title}</b>
                          <StatusChip status={j.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-[#4A5568] mb-1">
                            {j.location} · {j.mode} · {j.type} · {j.daysOpen}{" "}
                            days open
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-[#4A5568] mb-2">
                            <span>{j.applicants} applicants</span>
                            {j.badge && (
                              <span className="inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2 py-0.5 text-[9px] text-[#806236]">
                                {j.badge}
                              </span>
                            )}
                            {j.flagged && (
                              <span className="inline-flex items-center rounded-full border border-[#FBE9E7] bg-[#FBE9E7] px-2 py-0.5 text-[9px] text-[#B42318]">
                                Needs attention
                              </span>
                            )}
                          </div>
                          <div className="flex items-end gap-1 h-6 mb-2">
                            {[
                              ["Applied", pct.applied],
                              ["Shortlisted", pct.shortlisted],
                              ["Interview", pct.interview],
                              ["Offer", pct.offer],
                            ].map(([label, v]) => (
                              <div key={label} className="flex-1 relative">
                                <div className="h-full w-full bg-[#E5E1D8] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#B8955A]"
                                    style={{ width: `${Math.min(v, 100)}%` }}
                                  />
                                </div>
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] text-[#4A5568]">
                                  {label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          <Btn onClick={() => {}} small>
                            Open pipeline
                          </Btn>
                          <Btn onClick={() => {}} secondary small>
                            Edit
                          </Btn>
                          <MoreHorizontal
                            size={14}
                            className="text-[#4A5568] ml-2"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            {tab === "Requests" && (
              <Card title padded>
                <div className="space-y-3">
                  {hiringRequests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <b className="text-xs">{r.role}</b>
                          <StatusChip status={r.status} />
                        </div>
                        <p className="text-[10px] text-[#4A5568] mb-1">
                          {r.department} · {r.headcount} opening(s) · {r.budget}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-[#4A5568]">
                          <span>{r.requestedBy}</span>
                          <span>·</span>
                          <span>{r.targetStart}</span>
                          <span>·</span>
                          <span>Urgency: {r.urgency}</span>
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        {r.status === "Approved" && (
                          <Btn onClick={() => {}} small>
                            Create job post
                          </Btn>
                        )}
                        <Btn onClick={() => {}} secondary small>
                          Edit
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {tab === "Needs attention" && (
              <Card title padded>
                <div className="space-y-3">
                  {[
                    {
                      id: "na-1",
                      text: "5 new applicants unreviewed for Product Designer",
                      wait: "4 days",
                      chip: "Over 3 days",
                      type: "warning",
                      action: "Review applicants",
                    },
                    {
                      id: "na-2",
                      text: "Candidate waiting over 14 days — Software Engineer",
                      wait: "16 days",
                      chip: "No reply yet",
                      type: "error",
                      action: "Reply or reject kindly",
                    },
                    {
                      id: "na-3",
                      text: "Interview feedback overdue — 2 scorecards",
                      wait: "1 day",
                      chip: "Overdue",
                      type: "warning",
                      action: "Submit scorecard",
                    },
                    {
                      id: "na-4",
                      text: "Offer expiring within 48 hours — Senior Designer",
                      wait: "48 hours",
                      chip: "Expiring soon",
                      type: "warning",
                      action: "Review offer",
                    },
                    {
                      id: "na-5",
                      text: "Job without applicants after 14 days — Engineering Manager",
                      wait: "14 days",
                      chip: "No applicants",
                      type: "warning",
                      action: "Improve job post",
                    },
                  ].map((a) => {
                    const map = {
                      warning: "border-[#FDF3E0] text-[#9A6210] bg-[#FDF3E0]",
                      error: "border-[#FBE9E7] text-[#B42318] bg-[#FBE9E7]",
                    };
                    return (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white cursor-pointer"
                      >
                        <AlertCircle
                          size={16}
                          className={`mt-0.5 ${a.type === "error" ? "text-[#B42318]" : "text-[#9A7A45]"}`}
                          flex-shrink="0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <b className="text-xs">{a.text}</b>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${map[a.type]}`}
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
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Card title="Templates" padded>
              <p className="text-[10px] text-[#4A5568] mb-3">
                Start from a job template or duplicate a previous job.
              </p>
              <div className="space-y-2">
                <Btn onClick={() => {}} small className="w-full text-left">
                  Duplicate a job
                </Btn>
                <Btn
                  onClick={() => {}}
                  secondary
                  small
                  className="w-full text-left"
                >
                  Use a template
                </Btn>
              </div>
            </Card>
            <Card title="Upcoming interviews" padded>
              <div className="space-y-3">
                {interviews.slice(0, 3).map((i) => (
                  <div key={i.id} className="flex items-start gap-2">
                    <span className="mt-0.5 text-[10px] font-medium text-[#0F1B2D]">
                      {i.time}
                    </span>
                    <div className="flex-1 min-w-0">
                      <b className="text-xs">{i.candidate}</b>
                      <p className="text-[10px] text-[#4A5568]">
                        {i.job} · {i.round}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Plan and usage" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Open jobs used</span>
                  <span className="text-[#0F1B2D] font-medium">
                    {company.openJobsUsed} of {company.openJobsLimit}
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
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 2: New Hiring Request                                        */
/* ================================================================== */
function NewHiringRequestPage({ page }) {
  return (
    <EmployerShell active="Dashboard" page={page}>
      <div className="mx-auto max-w-[720px] px-4 sm:px-7 ">
        <SectionHead
          title="New hiring request"
          subtitle="Record a hiring need and send it for internal approval before writing a job post."
        />
        <Card title padded>
          <div className="px-6 pt-3 pb-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Role title
                </label>
                <input
                  className="field text-[12px]"
                  placeholder="e.g. Senior Product Designer"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Department and team
                </label>
                <input
                  className="field text-[12px]"
                  placeholder="e.g. Product · Design"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Headcount
                </label>
                <input
                  type="number"
                  defaultValue="1"
                  className="field text-[12px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Urgency
                </label>
                <select className="field text-[12px]">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#4A5568] block mb-1">
                Why now
              </label>
              <select className="field text-[12px]">
                <option>Growth</option>
                <option>Replacement</option>
                <option>New project</option>
                <option>Skill gap</option>
                <option>Other</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Budget range
                </label>
                <input
                  className="field text-[12px]"
                  placeholder="₹18L – ₹24L per year"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Target start date
                </label>
                <input type="date" className="field text-[12px]" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#4A5568] block mb-1">
                Employment type and work mode
              </label>
              <div className="flex gap-2 text-[10px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" defaultChecked /> Full-time
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" /> Contract
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" defaultChecked /> Hybrid
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" /> Remote
                </label>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#4A5568] block mb-1">
                Key skills and must-haves
              </label>
              <div className="flex gap-2 flex-wrap">
                {["Figma", "React", "User research"].map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center rounded-full border border-[#E5E1D8] bg-[#F3EBDD] px-2.5 py-0.5 text-[9px] text-[#806236]"
                  >
                    {s}
                  </span>
                ))}
                <Btn onClick={() => {}} small className="px-2">
                  + Add
                </Btn>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Hiring manager
                </label>
                <input
                  className="field text-[12px]"
                  defaultValue="Priya Mehta"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Approvers
                </label>
                <input
                  className="field text-[12px]"
                  placeholder="Owner, Admin"
                />
              </div>
            </div>
          </div>
        </Card>
        {/* Right panel estimate (desktop) */}
        <div className="hidden lg:block">
          <Card title="What this affects" padded className="sticky top-24">
            <div className="space-y-3 text-[10px] text-[#4A5568]">
              <div className="flex justify-between">
                <span>Estimated annual cost</span>
                <span className="text-[#0F1B2D] font-medium">₹21L × 1</span>
              </div>
              <div className="flex justify-between">
                <span>Open jobs vs plan</span>
                <span className="text-[#0F1B2D] font-medium">4 of 5</span>
              </div>
              <p className="mt-2">Estimate only; not a budget commitment.</p>
            </div>
          </Card>
        </div>
        <div className="mt-6 flex gap-3">
          <Btn>Submit request</Btn>
          <Btn onClick={() => {}} secondary>
            Save draft
          </Btn>
          <Btn onClick={() => {}} secondary>
            Cancel
          </Btn>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 3: Job Editor                                                */
/* ================================================================== */
function JobEditorPage({ page, jobId, editMode }) {
  return (
    <EmployerShell active="Jobs" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title={editMode ? "Edit job post" : "New job post"}
          subtitle="Write, preview and publish a job post with screening questions."
        />
        <div className="grid gap-6 lg:grid-cols-12 mt-4">
          <div className="lg:col-span-7 space-y-6">
            <Section title="Basics">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#4A5568] block mb-1">
                    Job title
                  </label>
                  <input
                    className="field text-[12px]"
                    placeholder="e.g. Senior Product Designer"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Employment type
                    </label>
                    <select className="field text-[12px]">
                      <option>Full-time</option>
                      <option>Part-time</option>
                      <option>Contract</option>
                      <option>Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Work mode
                    </label>
                    <select className="field text-[12px]">
                      <option>Hybrid</option>
                      <option>Remote</option>
                      <option>On-site</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Openings
                    </label>
                    <input
                      type="number"
                      defaultValue="1"
                      className="field text-[12px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[#4A5568] block mb-1">
                    Location
                  </label>
                  <input
                    className="field text-[12px]"
                    placeholder="Kolkata, West Bengal or Remote"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#4A5568] block mb-1">
                    Link to hiring request
                  </label>
                  <select className="field text-[12px]">
                    <option>None — create standalone</option>
                    <option>Senior Product Designer (req-1)</option>
                  </select>
                </div>
                <Btn onClick={() => {}} secondary small>
                  Start from a template
                </Btn>
              </div>
            </Section>
            <Section title="Description">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[#4A5568] block mb-1">
                    About the role
                  </label>
                  <Btn onClick={() => {}} secondary small>
                    Improve with AI
                  </Btn>
                </div>
                <textarea
                  className="field h-48 text-[12px] resize-none"
                  placeholder="What this role is and why it matters…"
                ></textarea>
                <p className="text-[10px] text-[#4A5568]">
                  Avoid biased terms like 'rockstar' or 'young team'. AI
                  suggestions are optional.
                </p>
              </div>
            </Section>
            <Section title="Requirements">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Must-have skills
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {["React", "Figma"].map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-full border border-[#E5E1D8] px-2.5 py-0.5 text-[9px]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Nice-to-have skills
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {["User research"].map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-full border border-[#E5E1D8] px-2.5 py-0.5 text-[9px]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Experience range
                    </label>
                    <select className="field text-[12px]">
                      <option>3–6 years</option>
                      <option>6–10 years</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Education
                    </label>
                    <select className="field text-[12px]">
                      <option>Not mandatory</option>
                      <option>Bachelor’s</option>
                      <option>Master’s</option>
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-[#4A5568]">
                  Keep must-haves to 5 or fewer. Non-essential requirements
                  reduce your applicant pool.
                </p>
              </div>
            </Section>
            <Section title="Compensation">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Min
                    </label>
                    <input
                      type="number"
                      className="field text-[12px]"
                      placeholder="₹18L"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Max
                    </label>
                    <input
                      type="number"
                      className="field text-[12px]"
                      placeholder="₹24L"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Period
                    </label>
                    <select className="field text-[12px]">
                      <option>Year</option>
                      <option>Month</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Currency
                    </label>
                    <select className="field text-[12px]">
                      <option>INR</option>
                      <option>USD</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch checked={true} onChange={() => {}} />
                  <label className="text-xs text-[#4A5568]">
                    Show salary publicly
                  </label>
                </div>
              </div>
            </Section>
            <Section title="Screening questions">
              <div className="space-y-3">
                <p className="text-[10px] text-[#4A5568] mb-2">
                  Up to 8 questions. No knockout (auto-reject) questions.
                  Protected-characteristic questions are blocked.
                </p>
                <div className="space-y-2">
                  {[
                    "Why are you interested in this role?",
                    "How many years of Figma experience do you have?",
                  ].map((q, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-3 rounded-lg border border-[#E5E1D8] bg-white"
                    >
                      <span className="text-[10px] font-medium">{i + 1}.</span>
                      <span className="flex-1 text-xs">{q}</span>
                      <select className="h-8 rounded-lg border border-[#E5E1D8] bg-white pl-2 text-[10px] focus:border-[#B8955A] outline-none">
                        <option>Optional</option>
                        <option>Required</option>
                      </select>
                      <Btn
                        onClick={() => {}}
                        secondary
                        small
                        className="text-[#B42318] px-2"
                      >
                        ×
                      </Btn>
                    </div>
                  ))}
                </div>
                <Btn onClick={() => {}} secondary small>
                  Add question
                </Btn>
              </div>
            </Section>
            <Section title="Hiring process">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ToggleSwitch checked={false} onChange={() => {}} />
                  <label className="text-xs text-[#4A5568]">
                    Blind review (hide names, photos, schools at screening)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch checked={true} onChange={() => {}} />
                  <label className="text-xs text-[#4A5568]">
                    Allow candidates to share interview practice results
                  </label>
                </div>
                <div>
                  <label className="text-[10px] text-[#4A5568] block mb-1">
                    Expected timeline shown to candidates
                  </label>
                  <input
                    className="field text-[12px]"
                    placeholder="We reply within 14 days"
                  />
                </div>
              </div>
            </Section>
            <Section title="Publish settings">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#4A5568] block mb-1">
                    Visibility
                  </label>
                  <select className="field text-[12px]">
                    <option>Public on the Jobs marketplace</option>
                    <option>Platform members only</option>
                    <option>Link only</option>
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Application deadline
                    </label>
                    <input type="date" className="field text-[12px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Close automatically when filled
                    </label>
                    <ToggleSwitch checked={true} onChange={() => {}} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch checked={false} onChange={() => {}} />
                  <label className="text-xs text-[#4A5568]">
                    Featured listing (price shown)
                  </label>
                </div>
                <div>
                  <label className="text-[10px] text-[#4A5568] block mb-1">
                    Auto-acknowledgement message
                  </label>
                  <textarea
                    className="field h-24 text-[12px] resize-none"
                    placeholder="Thanks for applying…"
                  ></textarea>
                </div>
              </div>
            </Section>
          </div>
          <div className="lg:col-span-5 space-y-6">
            <Card title="Live preview" padded>
              <div className="min-h-[400px] overflow-y-auto border border-[#E5E1D8] rounded-lg bg-[#FAF8F4] p-4">
                <b className="text-sm font-serif font-serif font-semibold block mb-1">
                  Senior Product Designer
                </b>
                <div className="flex gap-1 mb-3">
                  <StatusChip status="Open" />
                  <span className="text-[10px] text-[#4A5568]">
                    Hybrid · Full-time · Kolkata
                  </span>
                </div>
                <p className="text-[12px] text-[#4A5568] mb-3">
                  About the role preview…
                </p>
                <div className="space-y-2 text-[11px] text-[#4A5568]">
                  <div>
                    <b>₹18L – ₹24L / year</b>
                  </div>
                  <div>React · Figma · User research</div>
                  <div>We reply within 14 days</div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Btn onClick={() => {}} secondary small>
                  Preview
                </Btn>
                {editMode ? <Btn>Save changes</Btn> : <Btn>Publish</Btn>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 4: Job Detail and Applicant Pipeline                         */
/* ================================================================== */
function JobDetailPipelinePage({ page, jobId }) {
  const [tab, setTab] = useState("Pipeline");
  const tabs = [
    "Pipeline",
    "Applicants",
    "Job post",
    "Team and scorecards",
    "Insights",
  ];
  return (
    <EmployerShell active="Jobs" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title="Product Designer"
          subtitle="Applied → Shortlisted → Interview → Offer → Hired"
        >
          <div className="flex gap-2">
            <Btn onClick={() => {}} secondary small>
              Edit job
            </Btn>
            <Btn onClick={() => {}} secondary small>
              Pause
            </Btn>
            <Btn onClick={() => {}} secondary small className="text-[#B42318]">
              Close
            </Btn>
            <Btn>Share</Btn>
            <MoreHorizontal size={14} className="text-[#4A5568]" />
          </div>
        </SectionHead>
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] transition ${tab === t ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {tab === "Pipeline" && (
              <Card title padded>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-1 text-[10px] text-[#4A5568]">
                    <span className="w-2 h-2 rounded-full bg-[#4A5568]" />{" "}
                    Applied
                    <span className="w-2 h-2 rounded-full bg-[#F3EBDD]" />{" "}
                    Shortlisted
                    <span className="w-2 h-2 rounded-full bg-[#0F1B2D]" />{" "}
                    Interview
                    <span className="w-2 h-2 rounded-full bg-[#0F1B2D]" /> Offer
                    <span className="w-2 h-2 rounded-full bg-[#0F1B2D]" /> Hired
                  </div>
                  <span className="text-[10px] text-[#4A5568] ml-auto">
                    Rejected and Withdrawn in a collapsible bar below
                  </span>
                </div>
                <div className="overflow-x-auto space-x-4 pb-4">
                  {[
                    "Applied",
                    "Shortlisted",
                    "Interview",
                    "Offer",
                    "Hired",
                  ].map((stage) => (
                    <div key={stage} className="min-w-[260px]">
                      <div className="flex items-center gap-2 mb-3">
                        <b className="text-xs font-semibold">{stage}</b>
                        <span className="text-[10px] text-[#4A5568]">
                          {stage === "Applied"
                            ? 24
                            : stage === "Shortlisted"
                              ? 6
                              : stage === "Interview"
                                ? 3
                                : stage === "Offer"
                                  ? 1
                                  : 0}
                        </span>
                      </div>
                      <div className="min-h-[200px] border border-[#E5E1D8] rounded-lg p-2 space-y-2">
                        {applications
                          .filter(
                            (a) =>
                              (stage === "Applied" && a.stage === "Applied") ||
                              (stage === "Shortlisted" &&
                                a.stage === "Shortlisted") ||
                              (stage === "Interview" &&
                                a.stage === "Interview"),
                          )
                          .map((a) => (
                            <div
                              key={a.id}
                              className="p-2 rounded-lg border border-[#E5E1D8] bg-white cursor-pointer hover:border-[#B8955A] transition"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#1C2B42] text-[9px] font-semibold text-white">
                                  {a.blind ? "C#" : a.name.slice(0, 1)}
                                </span>
                                <b className="text-xs">
                                  {a.blind ? "Candidate" : a.name}
                                </b>
                                {a.practice && (
                                  <span className="ml-1 inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-1.5 py-0.5 text-[8px] text-[#806236]">
                                    Practice
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[#4A5568]">
                                {a.headline}
                              </p>
                              <Btn
                                onClick={() => {}}
                                secondary
                                small
                                className="mt-1 w-full"
                              >
                                Open
                              </Btn>
                            </div>
                          ))}
                        {stage !== "Applied" &&
                          stage !== "Shortlisted" &&
                          stage !== "Interview" && (
                            <div className="text-[10px] text-[#4A5568] text-center py-4">
                              No candidates yet
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {tab === "Applicants" && (
              <Card title padded>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E1D8]">
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Candidate
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Role
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Stage
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Applied
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Assignee
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((a) => (
                        <tr key={a.id} className="border-b border-[#E5E1D8]">
                          <td className="py-3">
                            <b className="text-xs">
                              {a.blind ? "Candidate #23" : a.name}
                            </b>
                          </td>
                          <td className="py-3 text-xs text-[#4A5568]">
                            {a.headline}
                          </td>
                          <td className="py-3 text-xs">
                            <StatusChip status={a.stage} />
                          </td>
                          <td className="py-3 text-xs text-[#4A5568]">
                            {a.applied}
                          </td>
                          <td className="py-3 text-xs text-[#4A5568]">
                            {a.assignee}
                          </td>
                          <td className="py-3">
                            <Btn onClick={() => {}} secondary small>
                              Open
                            </Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {tab === "Job post" && (
              <Card title padded>
                <p className="text-[11px] text-[#4A5568]">
                  Read-only preview of the live post.
                </p>
                <Btn onClick={() => {}} secondary small>
                  Edit
                </Btn>
                <Btn onClick={() => {}} secondary small>
                  View public page
                </Btn>
              </Card>
            )}
            {tab === "Team and scorecards" && (
              <Card title padded>
                <div className="space-y-4">
                  <div>
                    <b className="text-xs">Interviewers per round</b>
                    <p className="text-[10px] text-[#4A5568]">
                      Screening call · Technical · Founder chat
                    </p>
                  </div>
                  <div className="border border-[#E5E1D8] rounded-lg p-4">
                    <b className="text-xs block mb-3">Scorecard builder</b>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-[#4A5568] block mb-1">
                          Criterion
                        </label>
                        <input
                          className="field text-[12px]"
                          placeholder="Communication"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-[#4A5568]">
                          Scale 1–4
                        </label>
                        <select className="h-8 rounded-lg border border-[#E5E1D8] bg-white pl-2 text-[11px] focus:border-[#B8955A] outline-none">
                          <option>1–4</option>
                        </select>
                      </div>
                      <Btn onClick={() => {}} secondary small>
                        Add criterion
                      </Btn>
                    </div>
                    <p className="text-[10px] text-[#4A5568] mt-3">
                      Interviewers can't see each other's scores until they
                      submit their own.
                    </p>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Insights" && (
              <Card title padded>
                <p className="text-[11px] text-[#4A5568]">
                  Funnel, time to first response, time to hire, source
                  performance, drop-off by stage, offer acceptance rate.
                </p>
                <EmptyState
                  icon={BarChart3}
                  title="Insights"
                  subtitle="Charts appear once there's enough data."
                />
              </Card>
            )}
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Card title="Side summary" padded>
              <div className="space-y-4 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Applied → Shortlisted</span>
                  <span className="text-[#0F1B2D] font-medium">25%</span>
                </div>
                <div className="flex justify-between">
                  <span>Shortlisted → Interview</span>
                  <span className="text-[#0F1B2D] font-medium">50%</span>
                </div>
                <div className="flex justify-between">
                  <span>Interview → Offer</span>
                  <span className="text-[#0F1B2D] font-medium">33%</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg time per stage</span>
                  <span className="text-[#0F1B2D] font-medium">5 days</span>
                </div>
              </div>
            </Card>
            <Card title="Bulk actions" padded>
              <div className="space-y-2">
                <Btn onClick={() => {}} small className="w-full text-left">
                  Move stage
                </Btn>
                <Btn
                  onClick={() => {}}
                  secondary
                  small
                  className="w-full text-left"
                >
                  Reject with template
                </Btn>
                <Btn
                  onClick={() => {}}
                  secondary
                  small
                  className="w-full text-left"
                >
                  Assign
                </Btn>
                <Btn
                  onClick={() => {}}
                  secondary
                  small
                  className="w-full text-left"
                >
                  Add to talent pool
                </Btn>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 5: Candidate Profile                                         */
/* ================================================================== */
function CandidateProfilePage({ page, jobId, applicantId }) {
  const [tab, setTab] = useState("Overview");
  const tabs = [
    "Overview",
    "Resume",
    "Interview practice",
    "Interviews and feedback",
    "Notes",
    "Messages",
    "Activity",
  ];
  const app = applications[0];
  return (
    <EmployerShell active="Jobs" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title={app.blind ? "Candidate #23" : app.name}
          subtitle={app.headline}
        >
          <div className="flex gap-2">
            <Btn onClick={() => {}}>Shortlist</Btn>
            <Btn onClick={() => {}} secondary small>
              Schedule interview
            </Btn>
            <Btn onClick={() => {}} secondary small>
              Message
            </Btn>
            <Btn onClick={() => {}} secondary small className="text-[#B42318]">
              Reject kindly
            </Btn>
            <MoreHorizontal size={14} className="text-[#4A5568]" />
          </div>
        </SectionHead>
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] transition ${tab === t ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            {tab === "Overview" && (
              <Card title padded>
                <div className="space-y-4">
                  <div>
                    <b className="text-xs">Summary</b>
                    <p className="text-[11px] text-[#4A5568]">
                      Key experience and skills relevant to this role.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    {["React", "Figma", "User research"].map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2.5 py-0.5 text-[9px] text-[#806236]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div>
                    <b className="text-xs block mb-1">Match explanation</b>
                    <p className="text-[10px] text-[#4A5568] mb-1">
                      <span className="text-[#806236] font-medium">
                        AI suggestion
                      </span>{" "}
                      Matched 5 of 7 must-have skills: React, Figma, User
                      research, prototyping, design systems. Missing:
                      accessibility, design ops.
                    </p>
                  </div>
                  <div>
                    <b className="text-xs block mb-1">Screening answers</b>
                    <div className="space-y-2 text-[10px] text-[#4A5568]">
                      <div>
                        <b>Why are you interested in this role?</b> I admire
                        Northstar's design culture.
                      </div>
                      <div>
                        <b>How many years of Figma experience?</b> 5 years.
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Resume" && (
              <Card title padded>
                <p className="text-[11px] text-[#4A5568] mb-3">
                  Immutable snapshot of the resume submitted by the candidate.
                </p>
                <div className="min-h-[400px] border border-[#E5E1D8] rounded-lg p-4 bg-[#FAF8F4] text-[11px] text-[#4A5568]">
                  Resume content preview — Aanya Sen, Senior Product Designer…
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2 py-0.5 text-[9px] text-[#806236]">
                    <Sparkles size={10} className="mr-1" /> Created with the
                    platform's resume maker
                  </span>
                  <Btn onClick={() => {}} secondary small>
                    Download
                  </Btn>
                </div>
              </Card>
            )}
            {tab === "Interview practice" && (
              <Card title padded>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2 py-0.5 text-[9px] text-[#806236]">
                      <Sparkles size={10} className="mr-1" /> Practice result
                    </span>
                    <span className="text-[10px] text-[#4A5568]">
                      Shown with the candidate's permission.
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-3 rounded-lg border border-[#E5E1D8] bg-white">
                      <b className="text-xs block">Job-readiness score</b>
                      <b className="text-2xl font-serif font-semibold">68</b>
                      <span className="text-[10px] text-[#4A5568]">/ 100</span>
                    </div>
                    <div className="p-3 rounded-lg border border-[#E5E1D8] bg-white">
                      <b className="text-xs block">Dimensions</b>
                      <div className="space-y-1 text-[10px] text-[#4A5568]">
                        <div>Clarity · Structure · Relevance · Confidence</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#4A5568]">
                    <a
                      href="/jobseeker/practice/rubric"
                      className="text-[#B8955A] underline"
                    >
                      Published rubric
                    </a>{" "}
                    · Practice result provided by the candidate. Not an
                    assessment to base a hiring decision on.
                  </p>
                  <p className="text-[10px] text-[#4A5568] mt-2">
                    Sharing is never required, and the absence of results must
                    not be treated negatively.
                  </p>
                </div>
              </Card>
            )}
            {tab === "Interviews and feedback" && (
              <Card title padded>
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <b className="text-xs">Interview rounds</b>
                    <span className="text-[10px] text-[#4A5568]">
                      Scorecards hidden until you submit yours
                    </span>
                  </div>
                  {[
                    {
                      round: "Screening call",
                      interviewer: "Priya Mehta",
                      status: "Submitted",
                      recommendation: "Yes",
                    },
                    {
                      round: "Technical",
                      interviewer: "Rahul Verma",
                      status: "Pending",
                      recommendation: "—",
                    },
                  ].map((r) => (
                    <div
                      key={r.round}
                      className="p-3 rounded-lg border border-[#E5E1D8] bg-white"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <b className="text-xs">{r.round}</b>
                        <StatusChip status={r.status} />
                      </div>
                      <p className="text-[10px] text-[#4A5568]">
                        {r.interviewer} · {r.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {tab === "Notes" && (
              <Card title padded>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[#4A5568]">
                      Private note
                    </label>
                    <ToggleSwitch checked={false} onChange={() => {}} />
                  </div>
                  <textarea
                    className="field h-32 text-[12px] resize-none"
                    placeholder="Add a team note…"
                  ></textarea>
                  <div className="flex gap-2">
                    <Btn onClick={() => {}} secondary small>
                      Cancel
                    </Btn>
                    <Btn>Save note</Btn>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Messages" && (
              <Card title padded>
                <p className="text-[11px] text-[#4A5568] mb-3">
                  Secure thread with the candidate. Messages stay on the
                  platform.
                </p>
                <div className="min-h-[300px] overflow-y-auto border border-[#E5E1D8] rounded-lg p-3 space-y-3 text-[11px] text-[#4A5568]">
                  <div className="flex justify-end">
                    <span className="bg-[#E5E1D8] rounded-lg p-2 max-w-[80%]">
                      Hi, thanks for the update!
                    </span>
                  </div>
                  <div className="flex justify-start">
                    <span className="bg-[#0F1B2D] text-white rounded-lg p-2 max-w-[80%]">
                      We'd like to schedule a final round.
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    className="flex-1 field pl-3 text-[11px]"
                    placeholder="Write a message…"
                  />
                  <Btn onClick={() => {}} small>
                    Send
                  </Btn>
                </div>
              </Card>
            )}
            {tab === "Activity" && (
              <Card title padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="mt-0.5" />
                    <span>Oct 30 — Priya moved to Shortlisted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="mt-0.5" />
                    <span>Oct 29 — Message sent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download size={12} className="mt-0.5" />
                    <span>Oct 28 — Resume downloaded</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Card title="Decision box" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Current stage</span>
                  <span className="text-[#0F1B2D] font-medium">
                    {app.stage}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Average rating</span>
                  <span className="text-[#0F1B2D] font-medium">
                    {app.rating || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Recommendations</span>
                  <span className="text-[#0F1B2D] font-medium">1 of 2</span>
                </div>
                <div className="flex justify-between">
                  <span>Next step</span>
                  <span className="text-[#0F1B2D] font-medium">
                    Schedule final round
                  </span>
                </div>
              </div>
              <Section title="Quick scorecard">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Communication
                    </label>
                    <select className="field h-8 text-[11px]">
                      <option>1</option>
                      <option>2</option>
                      <option>3</option>
                      <option>4</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Comments
                    </label>
                    <textarea
                      className="field h-20 text-[11px] resize-none"
                      placeholder="Comments…"
                    ></textarea>
                  </div>
                  <Btn onClick={() => {}} small className="w-full">
                    Submit feedback
                  </Btn>
                </div>
              </Section>
            </Card>
            <Card title="Compare" padded>
              <p className="text-[10px] text-[#4A5568] mb-3">
                Add this candidate to a side-by-side comparison.
              </p>
              <Btn onClick={() => {}} small className="w-full">
                Add to comparison
              </Btn>
            </Card>
            <Card title="Details" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Notice period</span>
                  <span>2 weeks</span>
                </div>
                <div className="flex justify-between">
                  <span>Expected pay</span>
                  <span>₹20L–₹24L</span>
                </div>
                <div className="flex justify-between">
                  <span>Work authorization</span>
                  <span>Not required to rank</span>
                </div>
                <div className="flex justify-between">
                  <span>Preferred work mode</span>
                  <span>Hybrid</span>
                </div>
              </div>
              <div className="bg-[#F3EBDD] rounded-lg p-3 border border-[#F3EBDD] mt-3">
                <p className="text-[10px] text-[#806236]">
                  Judge against the job criteria. Don't consider age, gender,
                  religion, caste, nationality, marital status or health.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 6: Compare Candidates                                        */
/* ================================================================== */
function CompareCandidatesPage({ page, jobId }) {
  const [selected, setSelected] = useState([
    "Aanya Sen",
    "Candidate #23",
    "Rohan Kapoor",
  ]);
  return (
    <EmployerShell active="Jobs" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title="Compare candidates"
          subtitle="Side-by-side on the same criteria. Up to 4 candidates."
        >
          <div className="flex items-center gap-2">
            {selected.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full border border-[#E5E1D8] bg-white px-2.5 py-1 text-[10px]"
              >
                {s}
              </span>
            ))}
            <Btn onClick={() => {}} small>
              + Add
            </Btn>
            <Btn onClick={() => {}} secondary small>
              Export PDF
            </Btn>
          </div>
        </SectionHead>
        <div className="overflow-x-auto border border-[#E5E1D8] rounded-lg mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E1D8]">
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium w-[200px]">
                  Criterion
                </th>
                {selected.map((s) => (
                  <th
                    key={s}
                    className="pb-3 text-[10px] text-[#4A5568] font-medium"
                  >
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E5E1D8]">
                <td className="py-3 text-xs font-semibold">Current role</td>
                {selected.map((s) => (
                  <td key={s} className="py-3 text-xs text-[#4A5568]">
                    {s === "Candidate #23"
                      ? "Software Engineer"
                      : s === "Aanya Sen"
                        ? "Senior Product Designer"
                        : "UX Researcher"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E5E1D8]">
                <td className="py-3 text-xs font-semibold">Experience</td>
                {selected.map((s) => (
                  <td key={s} className="py-3 text-xs text-[#4A5568]">
                    {s === "Candidate #23"
                      ? "Mid"
                      : s === "Aanya Sen"
                        ? "Senior"
                        : "Mid"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E5E1D8]">
                <td className="py-3 text-xs font-semibold">Location</td>
                {selected.map((s) => (
                  <td key={s} className="py-3 text-xs text-[#4A5568]">
                    {s === "Candidate #23"
                      ? "Remote"
                      : s === "Aanya Sen"
                        ? "Kolkata"
                        : "Bengaluru"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E5E1D8]">
                <td className="py-3 text-xs font-semibold">Must-have: React</td>
                {selected.map((s) => (
                  <td key={s} className="py-3 text-xs">
                    {s === "Candidate #23"
                      ? "Met"
                      : s === "Aanya Sen"
                        ? "Met"
                        : "Partly"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E5E1D8]">
                <td className="py-3 text-xs font-semibold">Must-have: Figma</td>
                {selected.map((s) => (
                  <td key={s} className="py-3 text-xs">
                    {s === "Candidate #23"
                      ? "Not on resume"
                      : s === "Aanya Sen"
                        ? "Met"
                        : "Met"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E5E1D8]">
                <td className="py-3 text-xs font-semibold">Stage</td>
                {selected.map((s) => (
                  <td key={s} className="py-3 text-xs text-[#4A5568]">
                    <StatusChip
                      status={
                        s === "Candidate #23"
                          ? "Shortlisted"
                          : s === "Aanya Sen"
                            ? "Applied"
                            : "Interview"
                      }
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#E5E1D8]">
                <td className="py-3 text-xs font-semibold">Practice result</td>
                {selected.map((s) => (
                  <td key={s} className="py-3 text-xs text-[#4A5568]">
                    {s === "Candidate #23"
                      ? "Not shared"
                      : s === "Aanya Sen"
                        ? "Shared (68/100)"
                        : "Shared (74/100)"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 border-t border-[#E5E1D8] pt-6">
          <h3 className="text-xs font-semibold text-[#4A5568] uppercase tracking-wide mb-3">
            Team discussion
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-[#E5E1D8] bg-white">
              <p className="text-xs font-semibold mb-1">Priya Mehta</p>
              <p className="text-[10px] text-[#4A5568]">
                I lean toward advancing Aanya — strong Figma skills match our
                must-haves.
              </p>
            </div>
            <Btn onClick={() => {}} small className="w-full">
              Record decision
            </Btn>
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 7: Talent Search and Shortlists                              */
/* ================================================================== */
function TalentSearchPage({ page }) {
  const [tab, setTab] = useState("Search");
  const tabs = ["Search", "Shortlists", "Invitations"];
  return (
    <EmployerShell active="Candidates" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title="Talent search"
          subtitle="Find opted-in candidates, shortlist, and invite them to apply."
        />
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] transition ${tab === t ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-3 space-y-6">
            <Card title="Filters" padded>
              <div className="space-y-4 text-[10px] text-[#4A5568]">
                <div>
                  <label className="block mb-1 font-medium">
                    Role or keywords
                  </label>
                  <input
                    className="field text-[11px]"
                    placeholder="Product designer…"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Skills</label>
                  <div className="flex gap-2 flex-wrap">
                    {["React", "Figma", "Node.js"].map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded-full border border-[#E5E1D8] px-2 py-0.5 text-[9px]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Experience range
                  </label>
                  <select className="field h-8 text-[11px]">
                    <option>Mid</option>
                    <option>Senior</option>
                    <option>Lead</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch checked={false} onChange={() => {}} />
                  <label className="text-xs">
                    Interview-ready (shared practice result)
                  </label>
                </div>
                <p className="mt-2">
                  Not offered: age, gender, religion, caste, nationality,
                  marital status, photo-based filters.
                </p>
              </div>
            </Card>
          </div>
          <div className="lg:col-span-6 space-y-6">
            {tab === "Search" && (
              <Card title padded>
                <div className="space-y-3">
                  {talentResults.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg border border-[#E5E1D8] bg-white cursor-pointer hover:border-[#B8955A] transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1C2B42] text-[10px] font-semibold text-white">
                          C#
                        </span>
                        <b className="text-xs">{t.name}</b>
                      </div>
                      <p className="text-[10px] text-[#4A5568] mb-1">
                        {t.headline} · {t.skills.join(", ")}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#4A5568] mb-2">
                        <span>{t.experience}</span>
                        <span>·</span>
                        <span>{t.location}</span>
                        <span>·</span>
                        <span>{t.availability}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-[#806236] mb-2">
                        <span>{t.match}</span>
                      </div>
                      <div className="flex gap-1">
                        <Btn onClick={() => {}} small>
                          Save to shortlist
                        </Btn>
                        <Btn onClick={() => {}} secondary small>
                          Invite to apply
                        </Btn>
                        <Btn onClick={() => {}} secondary small>
                          Hide
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {tab === "Shortlists" && (
              <Card title padded>
                <div className="space-y-3">
                  {shortlists.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-lg border border-[#E5E1D8] bg-white cursor-pointer hover:border-[#B8955A] transition"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <b className="text-xs">{s.name}</b>
                        <StatusChip status="Not contacted" />
                      </div>
                      <p className="text-[10px] text-[#4A5568] mb-1">
                        {s.count} candidates · Last updated {s.updated}
                      </p>
                      <Btn onClick={() => {}} small className="w-full">
                        Invite all
                      </Btn>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {tab === "Invitations" && (
              <Card title padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="flex justify-between">
                    <span>Sent</span>
                    <span className="text-[#0F1B2D] font-medium">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Accepted</span>
                    <span className="text-[#0F1B2D] font-medium">1</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Today's limit remaining</span>
                    <span className="text-[#0F1B2D] font-medium">7</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 8: Interviews                                                */
/* ================================================================== */
function InterviewsPage({ page }) {
  const [tab, setTab] = useState("Upcoming");
  const tabs = ["Upcoming", "Needs feedback", "Past", "Calendar"];
  return (
    <EmployerShell active="Interviews" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title="Interviews"
          subtitle="Schedule, scorecards and feedback reminders."
        >
          <Btn>Schedule interview</Btn>
        </SectionHead>
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] transition ${tab === t ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-9">
            {tab === "Upcoming" && (
              <Card title padded>
                <div className="space-y-3">
                  {interviews.map((i) => (
                    <div
                      key={i.id}
                      className="p-3 rounded-lg border border-[#E5E1D8] bg-white"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="mt-0.5 text-[10px] font-medium text-[#0F1B2D]">
                            {i.time}
                          </span>
                          <StatusChip status={i.status} />
                        </div>
                        <Btn onClick={() => {}} small>
                          {i.join ? "Join" : "Prepare"}
                        </Btn>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#4A5568] mb-2">
                        <b className="text-xs">{i.candidate}</b>
                        <span>·</span>
                        <span>{i.job}</span>
                        <span>·</span>
                        <span>{i.round}</span>
                        <span>·</span>
                        <span>{i.format}</span>
                        <span>·</span>
                        <span>{i.duration}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#4A5568]">
                        <span>{i.interviewers}</span>
                        <span>·</span>
                        <span>Add to calendar</span>
                        <span>·</span>
                        <span>Reschedule</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {tab === "Needs feedback" && (
              <Card title padded>
                <p className="text-[11px] text-[#4A5568]">
                  Interviews finished without a submitted scorecard. Feedback is
                  due within 24 hours.
                </p>
                <div className="space-y-3">
                  {[
                    {
                      candidate: "Rohan Kapoor",
                      round: "Technical",
                      finished: "2 hours ago",
                      overdue: false,
                    },
                    {
                      candidate: "Candidate #44",
                      round: "Final",
                      finished: "26 hours ago",
                      overdue: true,
                    },
                  ].map((f) => (
                    <div
                      key={f.candidate}
                      className="p-3 rounded-lg border border-[#E5E1D8] bg-white"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <b className="text-xs">{f.candidate}</b>
                        {f.overdue && (
                          <span className="text-[9px] text-[#B42318] font-medium">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#4A5568]">
                        {f.round} · {f.finished}
                      </p>
                      <Btn onClick={() => {}} small>
                        Submit scorecard
                      </Btn>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
          <div className="lg:col-span-3 space-y-6">
            <Card title="Summary" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Interviews this week</span>
                  <span className="text-[#0F1B2D] font-medium">9</span>
                </div>
                <div className="flex justify-between">
                  <span>Awaiting candidate confirmation</span>
                  <span className="text-[#0F1B2D] font-medium">1</span>
                </div>
                <div className="flex justify-between">
                  <span>Feedback overdue</span>
                  <span className="text-[#0F1B2D] font-medium">1</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg days interview → decision</span>
                  <span className="text-[#0F1B2D] font-medium">5</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 9: Offers                                                    */
/* ================================================================== */
function OffersPage({ page }) {
  const [tab, setTab] = useState("Draft");
  const tabs = [
    "Draft",
    "Awaiting approval",
    "Sent",
    "Countered",
    "Accepted",
    "Declined, expired and withdrawn",
  ];
  return (
    <EmployerShell active="Offers" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title="Offers"
          subtitle="Draft, approve, send and track offers."
        >
          <Btn>New offer</Btn>
        </SectionHead>
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] transition ${tab === t ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto border border-[#E5E1D8] rounded-lg mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E1D8]">
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                  Candidate
                </th>
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                  Job
                </th>
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                  Compensation
                </th>
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                  Start date
                </th>
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                  Status
                </th>
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                  Expiry
                </th>
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                  Owner
                </th>
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-b border-[#E5E1D8]">
                  <td className="py-3">
                    <b className="text-xs">{o.candidate}</b>
                  </td>
                  <td className="py-3 text-xs text-[#4A5568]">{o.job}</td>
                  <td className="py-3 text-xs text-[#4A5568]">
                    {o.compensation}
                  </td>
                  <td className="py-3 text-xs text-[#4A5568]">{o.startDate}</td>
                  <td className="py-3 text-xs">
                    <StatusChip status={o.status} />
                  </td>
                  <td className="py-3 text-xs text-[#4A5568]">{o.expiry}</td>
                  <td className="py-3 text-xs text-[#4A5568]">{o.owner}</td>
                  <td className="py-3">
                    <Btn onClick={() => {}} secondary small>
                      Open
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 10: Offer Detail                                             */
/* ================================================================== */
function OfferDetailPage({ page, offerId }) {
  const [tab, setTab] = useState("Terms");
  const tabs = ["Terms", "Approvals", "Negotiation", "Documents", "History"];
  return (
    <EmployerShell active="Offers" page={page}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-7 ">
        <SectionHead
          title="Offer — Aanya Sen"
          subtitle="Product Designer · v2 · Sent · Expires in 48 hours"
        >
          <div className="flex gap-2">
            <Btn onClick={() => {}} secondary small>
              Revise
            </Btn>
            <Btn onClick={() => {}} secondary small>
              Withdraw
            </Btn>
            <Btn onClick={() => {}} secondary small>
              Message
            </Btn>
            <Btn onClick={() => {}} secondary small>
              Extend expiry
            </Btn>
          </div>
        </SectionHead>
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] transition ${tab === t ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {tab === "Terms" && (
              <Card title padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="flex justify-between items-start mb-1">
                    <b className="text-xs">Base pay</b>
                    <span className="text-[#0F1B2D] font-medium">
                      ₹22L / year
                    </span>
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <b className="text-xs">Variable</b>
                    <span className="text-[#0F1B2D] font-medium">₹2L</span>
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <b className="text-xs">Joining bonus</b>
                    <span className="text-[#0F1B2D] font-medium">₹1L</span>
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <b className="text-xs">Equity</b>
                    <span className="text-[#0F1B2D] font-medium">
                      0.2% · 4-year vesting · 1-year cliff
                    </span>
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <b className="text-xs">Start date</b>
                    <span className="text-[#0F1B2D] font-medium">
                      Jan 2, 2026
                    </span>
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <b className="text-xs">Offer expiry</b>
                    <span className="text-[#0F1B2D] font-medium">
                      in 48 hours
                    </span>
                  </div>
                  <p className="mt-2">
                    Offers are proposals. Binding terms are in the signed
                    employment agreement.
                  </p>
                </div>
              </Card>
            )}
            {tab === "Approvals" && (
              <Card title padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="p-3 rounded-lg border border-[#E5E1D8] bg-white">
                    <div className="flex justify-between items-start mb-1">
                      <b className="text-xs">Owner — Meera Shah</b>
                      <StatusChip status="Pending" />
                    </div>
                    <p className="mb-1">
                      Approval required (above company threshold)
                    </p>
                    <div className="flex gap-2">
                      <Btn onClick={() => {}} secondary small>
                        Approve
                      </Btn>
                      <Btn onClick={() => {}} secondary small>
                        Request changes
                      </Btn>
                      <Btn onClick={() => {}} secondary small>
                        Reject
                      </Btn>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Negotiation" && (
              <Card title padded>
                <div className="space-y-3">
                  <p className="text-[10px] text-[#4A5568] mb-2">
                    Thread with the candidate tied to this offer.
                  </p>
                  <div className="h-[200px] border border-[#E5E1D8] rounded-lg p-3 space-y-3 text-[11px] text-[#4A5568]">
                    <div className="flex justify-start">
                      <span className="bg-[#0F1B2D] text-white rounded-lg p-2 max-w-[80%]">
                        You sent v1.
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <span className="bg-[#E5E1D8] rounded-lg p-2 max-w-[80%]">
                        Candidate asked about vesting.
                      </span>
                    </div>
                    <div className="flex justify-start">
                      <span className="bg-[#0F1B2D] text-white rounded-lg p-2 max-w-[80%]">
                        You sent v2.
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Btn onClick={() => {}} secondary small>
                      Accept
                    </Btn>
                    <Btn onClick={() => {}} secondary small>
                      Counter
                    </Btn>
                    <Btn onClick={() => {}} secondary small>
                      Keep terms
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Documents" && (
              <Card title padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="flex justify-between items-start mb-1">
                    <b className="text-xs">Offer letter (PDF)</b>
                    <span className="text-[#0F1B2D] font-medium">Signed</span>
                  </div>
                  <div className="flex justify-between items-start mb-1">
                    <b className="text-xs">Employment agreement</b>
                    <span className="text-[#0F1B2D] font-medium">Drafting</span>
                  </div>
                  <p className="mt-2">
                    Have your lawyer review these documents.
                  </p>
                </div>
              </Card>
            )}
            {tab === "History" && (
              <Card title padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="mt-0.5" />
                    <span>Oct 30 — Offer sent (v1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="mt-0.5" />
                    <span>Oct 31 — Candidate viewed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw size={12} className="mt-0.5" />
                    <span>Nov 1 — Revised to v2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="mt-0.5" />
                    <span>Nov 2 — Approved by Owner</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Card title="Status" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="text-[#0F1B2D] font-medium">Sent</span>
                </div>
                <div className="flex justify-between">
                  <span>Version</span>
                  <span className="text-[#0F1B2D] font-medium">v2</span>
                </div>
                <div className="flex justify-between">
                  <span>Expiry</span>
                  <span className="text-[#0F1B2D] font-medium">
                    in 48 hours
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Exports                                                           */
/* ------------------------------------------------------------------ */
export {
  HiringOverviewPage,
  NewHiringRequestPage,
  JobEditorPage,
  JobDetailPipelinePage,
  CandidateProfilePage,
  CompareCandidatesPage,
  TalentSearchPage,
  InterviewsPage,
  OffersPage,
  OfferDetailPage,
};
