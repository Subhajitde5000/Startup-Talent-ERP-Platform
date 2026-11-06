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
  RefreshCcw,
  Pin,
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
  Cloud,
  Folder,
  Shield as ShieldIcon,
  Clock as Clock2,
  LineChart,
  Banknote,
  Ticket,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design tokens (matching employer-insights-trust-design.md Part H) */
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
/*  Company / user / role scope (mock; server enforces in production) */
/* ------------------------------------------------------------------ */
const company = {
  name: "Northstar Labs",
  logo: "N",
  verified: true,
  verifiedAt: "12 Oct 2026",
  standing: "Good standing",
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

// Team-role scope helper (enforced by server in production)
const canViewAnalytics = () =>
  ["Owner", "Admin", "Recruiter", "Hiring manager"].includes(user.teamRole);
const canViewTrust = () =>
  ["Owner", "Admin", "Recruiter", "Hiring manager"].includes(user.teamRole);
const canViewActivity = () =>
  ["Owner", "Admin", "Recruiter", "Hiring manager", "Interviewer"].includes(
    user.teamRole
  );
const isOwnerOrAdmin = () =>
  ["Owner", "Admin"].includes(user.teamRole);

/* ------------------------------------------------------------------ */
/*  Shared UI primitives                                              */
/* ------------------------------------------------------------------ */

function Card({ title, padded = true, children, className = "" }) {
  return (
    <div className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white ${className}`}>
      {title && (
        <div className={`border-b border-[#E5E1D8] pb-3 ${padded ? "px-6 pt-4" : "px-6 pt-3"}`}>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
      )}
      <div className={`${padded ? "px-6" : "px-0"} ${padded ? "pb-5" : "pb-0"}`}>
        {children}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  secondary,
  small,
  size,
  destructive,
  className = "",
}) {
  const isSmall = small || size === "small";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-white px-4 py-2 text-xs font-medium text-[#0F1B2D] transition ${secondary
        ? `border-[#E5E1D8] text-[#4A5568] bg-[#F4F1EA] hover:bg-[#F3EBDD]`
        : destructive
          ? `border-[#FBE9E7] text-[#B42318] hover:bg-[#FBE9E7]`
          : `bg-[#0F1B2D] text-white hover:bg-[#1C2B42]`} ${isSmall
        ? "px-2.5 py-1.5 text-[10px] min-w-[72px]"
        : "px-4 py-2 text-xs min-w-[80px]"} ${className}`}
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

function StatusChip({ status, kind = "draft" }) {
  const maps = {
    draft: {
      Draft: "border-[#E5E1D8] text-[#4A5568]",
      "Pending approval": "border-[#F3EBDD] text-[#806236]",
      "In use": "border-[#E7F3EC] text-[#286749]",
      "Needs review": "border-[#FDF3E0] text-[#9A6210]",
      Archived: "border-[#E5E1D8] text-[#4A5568]",
    },
    standing: {
      "Good standing": `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
      "Needs attention": `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
      Restricted: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
      "Under review": `border-[#0F1B2D] text-[#0F1B2D]`,
    },
    report: {
      Open: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
      "In review": `border-[#0F1B2D] text-[#0F1B2D]`,
      Resolved: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
      Dismissed: `border-[#E5E1D8] bg-[#E5E1D8] text-[#4A5568]`,
      Appealed: `border-[#F3EBDD] bg-[#F3EBDD] text-[#806236]`,
    },
    audit: {
      Success: `border-[#E5E1D8] text-[#4A5568]`,
      Blocked: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
      Failed: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    },
  };
  const map = maps[kind] || maps.draft;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${map[status] || map.Draft || ""}`}>
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
    <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${className}`}>
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
    <div className={`h-10 rounded-lg bg-[#E5E1D8] animate-pulse ${className}`} />
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
      <span className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
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
/*  Insights-trust specific components                                */
/* ------------------------------------------------------------------ */

// KPI card: label, big serif number, change chip, sparkline
function KpiCard({ label, value, delta, spark, definition }) {
  return (
    <Card title padded>
      <div className="px-6 pt-3 pb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <b className="text-3xl font-serif font-semibold">{value}</b>
          {delta && (
            <span className={`text-[10px] font-medium ${delta > 0 ? "text-[#286749]" : delta < 0 ? "text-[#B42318]" : "text-[#4A5568]"}`}>
              {delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}{Math.abs(delta)}%
            </span>
          )}
        </div>
        <p className="text-[10px] text-[#4A5568]">{label}</p>
        {spark && (
          <div className="mt-3">
            <Sparkline values={spark} color={INK} />
          </div>
        )}
      </div>
    </Card>
  );
}

// Chart card: title, insight headline, chart area, footer with source chip
function ChartCard({ title, insight, children, source, onViewTable }) {
  return (
    <Card title padded>
      <div className="px-6 pt-3 pb-4">
        <p className="text-[12px] font-medium text-[#0F1B2D] mb-3">{insight}</p>
        <div className="min-h-[200px] mb-4">{children}</div>
        <div className="flex items-center justify-between text-[10px]">
          <span className={`text-[#4A5568] flex items-center gap-1`}>
            <Clock size={10} /> {source}
          </span>
          <Btn size="small" secondary onClick={onViewTable}>
            View as table
          </Btn>
        </div>
      </div>
    </Card>
  );
}

// Insight card: gold-tint background, headline, reason, View details
function InsightCard({ icon: Icon, headline, reason, onView, dismissible }) {
  return (
    <Card padded={false} className="bg-[#F3EBDD] border-transparent">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-[#B8955A]/40 text-[#806236] shrink-0">
            <Icon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-[9px] text-[#806236] font-medium uppercase tracking-wide">
                Auto insight
              </span>
              {dismissible && (
                <Btn
                  size="small"
                  secondary
                  onClick={dismissible}
                  className="p-1 min-w-[auto] px-2"
                >
                  <X size={12} />
                </Btn>
              )}
            </div>
            <p className="text-sm font-semibold text-[#0F1B2D] leading-tight">
              {headline}
            </p>
            <p className="text-[12px] text-[#4A5568] mt-1">{reason}</p>
          </div>
        </div>
        {onView && (
          <Btn size="small" onClick={onView} className="mt-3 text-[#806236] hover:bg-[#F3EBDD] border-transparent bg-transparent">
            View details <ArrowRight size={12} />
          </Btn>
        )}
      </div>
    </Card>
  );
}

// Sample-size chip: n = X applicants / Based on Y hires
function SampleSizeChip({ n, label }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[#E5E1D8] bg-white text-[10px] text-[#4A5568]">
      <span className="text-[#B8955A] font-medium">n = {n}</span>{" "}
      <span>{label}</span>
    </span>
  );
}

// Source / freshness chip
function SourceChip({ text, updated }) {
  return (
    <span className="text-[10px] text-[#4A5568] flex items-center gap-1">
      <Clock size={10} /> {text}{updated && <span> · Updated {updated}</span>}
    </span>
  );
}

// Segmented tabs
function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div
      className={`flex gap-1 overflow-x-auto mb-4 pb-1 border-b border-[#E5E1D8] ${className}`}
    >
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`border-b-2 px-4 py-3 text-xs font-medium transition whitespace-nowrap ${
            value === t
              ? "border-[#B8955A] text-[#0F1B2D]"
              : "border-transparent text-[#4A5568] hover:text-[#0F1B2D]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// Filter bar: jobs, teams, locations chips
function FilterBar({ filters, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 items-end mb-6">
      {filters.map((f) => (
        <div key={f.id} className="flex items-center gap-2">
          <span className="text-[10px] text-[#4A5568]">{f.label}</span>
          <select
            value={f.value}
            onChange={(e) => onChange(f.id, e.target.value)}
            className="h-9 rounded-lg border border-[#E5E1D8] bg-white pl-2 pr-8 text-[10px] appearance-none"
          >
            {f.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

// Detail drawer (slide-over panel)
function DetailDrawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[560px] h-full flex flex-col bg-white border-l border-[#E5E1D8] shadow-lg ml-auto">
        <div className="flex items-center justify-between border-b border-[#E5E1D8] px-6 py-4 bg-[#FAF8F4]">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Btn size="small" secondary onClick={onClose}>
            <X size={14} />
          </Btn>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sample data                                                       */
/* ------------------------------------------------------------------ */

const analyticsKpis = [
  { label: "Applicants", value: "312", delta: 14, spark: [4, 5, 3, 6, 5, 7, 6] },
  { label: "Hires", value: "9", delta: 0, spark: [1, 1, 0, 2, 1, 1, 3] },
  {
    label: "Median time to first response",
    value: "3 days",
    delta: -2,
    spark: [6, 5, 5, 4, 4, 3, 3],
  },
  { label: "Median time to hire", value: "28 days", delta: -5, spark: [40, 35, 32, 30, 28] },
];

const insights = [
  {
    id: "ins-1",
    icon: Clock,
    headline: "Candidates wait 9 days for a first reply on Engineering jobs",
    reason: "The Engineering pipeline median first-response time is 9 days vs a 3-day company median. Two Engineering jobs have no reply in the last 7 days.",
    onView: () => {},
  },
  {
    id: "ins-2",
    icon: TrendingDown,
    headline: "Drop-off spikes between Shortlisted and Interview",
    reason: "38% of shortlisted candidates don't reach Interview — the largest drop-off in the funnel. Most common reason: no response within 7 days.",
    onView: () => {},
  },
  {
    id: "ins-3",
    icon: TrendingUp,
    headline: "Referral source converts 2.1× above average",
    reason: "Candidates from Referrals convert to interview at 34% vs a 16% average across sources (n = 41).",
    onView: () => {},
  },
];

const funnelStages = [
  { stage: "Applied", count: 312, conversion: null },
  { stage: "Shortlisted", count: 118, conversion: 38 },
  { stage: "Interview", count: 64, conversion: 54 },
  { stage: "Offer", count: 22, conversion: 34 },
  { stage: "Hired", count: 9, conversion: 41 },
];

const dropoffByStage = [
  { stage: "Shortlisted", reason: "Rejected", count: 45, pct: 14 },
  { stage: "Interview", reason: "Withdrawn", count: 28, pct: 9 },
  { stage: "Offer", reason: "No response", count: 19, pct: 6 },
  { stage: "Applied", reason: "Rejected", count: 141, pct: 45 },
  { stage: "Hired", reason: "Did not join", count: 2, pct: 1 },
];

const jobsFunnel = [
  { job: "Product Designer", applicants: 64, shortlisted: 22, interviewed: 12, offers: 5, hires: 2, medianTime: "26 days", status: "Open" },
  { job: "Software Engineer", applicants: 98, shortlisted: 38, interviewed: 21, offers: 8, hires: 4, medianTime: "31 days", status: "Open" },
  { job: "UX Researcher", applicants: 41, shortlisted: 15, interviewed: 9, offers: 3, hires: 1, medianTime: "22 days", status: "Open" },
  { job: "Engineering Manager", applicants: 29, shortlisted: 11, interviewed: 6, offers: 2, hires: 1, medianTime: "35 days", status: "Open" },
  { job: "Content Writer", applicants: 80, shortlisted: 32, interviewed: 16, offers: 4, hires: 1, medianTime: "19 days", status: "Paused" },
];

const speedByJob = [
  { job: "Product Designer", within3: 68, within7: 85, within14: 94, median: "2 days" },
  { job: "Software Engineer", within3: 42, within7: 71, within14: 89, median: "5 days" },
  { job: "UX Researcher", within3: 55, within7: 78, within14: 92, median: "4 days" },
  { job: "Engineering Manager", within3: 31, within7: 58, within14: 79, median: "7 days" },
];

const sources = [
  { source: "Job search", applicants: 114, toInterview: 22, toHire: 3 },
  { source: "Startups hiring", applicants: 68, toInterview: 19, toHire: 2 },
  { source: "Invitations accepted", applicants: 52, toInterview: 14, toHire: 1 },
  { source: "Recommendations", applicants: 31, toInterview: 11, toHire: 2 },
  { source: "Direct link", applicants: 27, toInterview: 6, toHire: 0 },
  { source: "Referrals", applicants: 20, toInterview: 7, toHire: 1 },
];

const invitesData = { sent: 140, viewed: 89, accepted: 31, declined: 23, limit: 200, used: 140 };

const offersFunnel = [
  { stage: "Created", count: 18 },
  { stage: "Approved", count: 16 },
  { stage: "Sent", count: 14 },
  { stage: "Viewed", count: 12 },
  { stage: "Accepted", count: 9 },
  { stage: "Declined", count: 3 },
  { stage: "Expired", count: 1 },
  { stage: "Withdrawn", count: 1 },
];

const declineReasons = [
  { reason: "Accepted another offer", count: 2, pct: 67 },
  { reason: "Compensation", count: 1, pct: 33 },
];

const processChecks = [
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

const trustSummary = [
  { label: "Standing", value: "Good standing", tint: "success" },
  { label: "Verification", value: "Verified · 12 Oct 2026", tint: "success" },
  { label: "Open reports", value: "1", tint: "warning" },
  { label: "Jobs paused by policy", value: "0", tint: "success" },
];

const recentTrustEvents = [
  { event: "Verification approved", date: "12 Oct 2026", link: "/employer/verification" },
  { event: "Job flagged: misleading pay", date: "8 Oct 2026", link: "/employer/trust?tab=reports" },
  { event: "Report resolved", date: "5 Oct 2026", link: "/employer/trust?tab=reports" },
  { event: "Appeal decided", date: "2 Oct 2026", link: "/employer/trust?tab=appeals" },
];

const safetyReminders = [
  "Never ask candidates for money",
  "Keep conversations on the platform",
  "Judge candidates against the job only",
];

const reportsFlags = [
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

const appealsList = [
  { id: "ap-1", decision: "Job pause (Software Engineer)", date: "5 Oct 2026", status: "Decision made", outcome: "Partly overturned" },
  { id: "ap-2", decision: "Verification decision", date: "20 Sep 2026", status: "In review", outcome: "-" },
  { id: "ap-3", decision: "Report outcome (Asks for fees)", date: "12 Sep 2026", status: "Submitted", outcome: "-" },
];

const postingRules = [
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

const blockedCandidates = [
  { id: "bc-1", name: "Candidate #88", date: "9 Oct 2026", category: "Abusive messages", by: "Priya Mehta" },
  { id: "bc-2", name: "Candidate #92", date: "2 Oct 2026", category: "Spam applications", by: "Rahul Verma" },
];

// Audit log entries
const auditLog = [
  {
    id: "a-101",
    time: "Nov 6, 2026 · 10:14 AM IST",
    who: "Priya Mehta · Recruiter",
    category: "Candidate data",
    action: "Viewed candidate profile: Candidate #23 for Product Designer",
    target: "Candidate #23 · Product Designer",
    outcome: "Success",
    context: "Chrome · Kolkata, IN · sess-7f2a",
    details: {
      before: "-",
      after: "Profile viewed (3 min)",
      ip: "203.112.45.12",
      device: "Chrome on macOS",
      session: "sess-7f2a9c",
      region: "Kolkata, IN",
    },
  },
  {
    id: "a-102",
    time: "Nov 6, 2026 · 09:58 AM IST",
    who: "Rahul Verma · Hiring manager",
    category: "Hiring",
    action: "Moved stage: Shortlisted → Interview (Software Engineer)",
    target: "Candidate #31 · Software Engineer",
    outcome: "Success",
    context: "Safari · Bengaluru, IN · sess-8b1c",
    details: {
      before: "Stage: Shortlisted",
      after: "Stage: Interview",
      ip: "143.22.19.8",
      device: "Safari on iOS",
      session: "sess-8b1c4d",
      region: "Bengaluru, IN",
    },
  },
  {
    id: "a-103",
    time: "Nov 5, 2026 · 04:22 PM IST",
    who: "System",
    category: "Security",
    action: "New device sign-in",
    target: "Priya Mehta",
    outcome: "Success",
    context: "Firefox · New Delhi, IN · sess-9d3e",
    details: {
      before: "-",
      after: "New device: Firefox on Windows",
      ip: "45.67.89.1",
      device: "Firefox on Windows",
      session: "sess-9d3e2f",
      region: "New Delhi, IN",
    },
  },
  {
    id: "a-104",
    time: "Nov 5, 2026 · 02:10 PM IST",
    who: "Priya Mehta · Recruiter",
    category: "Offers",
    action: "Sent offer: Product Designer",
    target: "Offer #7 · Product Designer",
    outcome: "Success",
    context: "Chrome · Kolkata, IN · sess-7f2a",
    details: {
      before: "Draft",
      after: "Sent to candidate",
      ip: "203.112.45.12",
      device: "Chrome on macOS",
      session: "sess-7f2a9c",
      region: "Kolkata, IN",
    },
  },
  {
    id: "a-105",
    time: "Nov 4, 2026 · 11:05 AM IST",
    who: "Interviewer (name withheld)",
    category: "Hiring",
    action: "Submitted scorecard",
    target: "Candidate #23 · Product Designer",
    outcome: "Success",
    context: "Chrome · Pune, IN · sess-5e6f",
    details: {
      before: "Pending",
      after: "Scorecard submitted",
      ip: "182.73.11.4",
      device: "Chrome on Linux",
      session: "sess-5e6f7a",
      region: "Pune, IN",
    },
  },
  {
    id: "a-106",
    time: "Nov 3, 2026 · 08:40 PM IST",
    who: "Owner account · Owner",
    category: "Team",
    action: "Role changed: Sana Desai → Admin",
    target: "Team settings",
    outcome: "Success",
    context: "Chrome · Kolkata, IN · sess-1a2b",
    details: {
      before: "Role: Hiring manager",
      after: "Role: Admin",
      ip: "203.112.45.12",
      device: "Chrome on macOS",
      session: "sess-1a2b3c",
      region: "Kolkata, IN",
    },
  },
];

const securityAlerts = [
  { id: "sa-1", text: "New device sign-in from New Delhi", time: "2 hours ago", severity: "info" },
  { id: "sa-2", text: "Large export: activity log (1,248 rows)", time: "Yesterday", severity: "warning" },
];

/* ------------------------------------------------------------------ */
/*  Employer shell                                                    */
/* ------------------------------------------------------------------ */
const employerSidebar = [
  ["Dashboard", LayoutDashboard, "/employer/dashboard"],
  ["Jobs", Briefcase, "/employer/jobs"],
  ["Candidates", Users, "/employer/candidates"],
  ["Interviews", CalendarDays, "/employer/interviews"],
  ["Offers", Mail, "/employer/offers"],
  ["Hires", AwardIcon, "/employer/hires"],
  ["Templates", FileText, "/employer/templates"],
  ["Analytics", BarChart3, "/employer/analytics"],
  ["Trust", Shield, "/employer/trust"],
  ["Activity", Activity, "/employer/activity"],
  ["Company page", BuildingIcon, "/employer/company"],
  ["Team", Users, "/employer/team"],
  ["Messages", MessageCircle, "/employer/messages"],
];

function EmployerShell({ children, active = "Dashboard", className = "" }) {
  const notifications = [
    { id: "n-1", title: "Template approved", time: "10:00 AM", unread: true },
    {
      id: "n-2",
      title: "New hire documents pending",
      time: "Yesterday",
      unread: true,
    },
    {
      id: "n-3",
      title: "Report about a job needs review",
      time: "2 hours ago",
      unread: false,
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
            href="/employer/settings"
            className="flex h-10 items-center gap-3 px-3 text-xs text-white/60"
          >
            <Settings size={17} /> Settings
          </Link>
          <Link
            href="/help"
            className="flex h-10 items-center gap-3 px-3 text-xs text-white/60"
          >
            <HelpCircle size={17} /> Help
          </Link>
          <button
            onClick={() => {}}
            className="flex w-full items-center gap-3 rounded-lg border border-white/10 p-3 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-[#0F1B2D]">
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
          ["Jobs", "/employer/jobs", Briefcase],
          ["Candidates", "/employer/candidates", Users],
          ["Interviews", "/employer/interviews", CalendarDays],
          ["More", "/employer/settings", UserRound],
        ].map(([x, u, I]) => (
          <Link
            href={u}
            key={x}
            className="flex flex-col items-center gap-1 py-1 text-[9px] text-[#4A5568]"
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
/*  Page 1: Hiring Analytics — /employer/analytics                    */
/* ================================================================== */
function AnalyticsPage() {
  const [tab, setTab] = useState("Overview");
  const [range, setRange] = useState("Last 30 days");
  const [compare, setCompare] = useState("Previous period");
  const [dismissed, setDismissed] = useState(new Set());

  const activeInsights = useMemo(
    () => insights.filter((i) => !dismissed.has(i.id)),
    [dismissed]
  );

  const tabs = [
    "Overview",
    "Funnel",
    "Speed",
    "Sources",
    "Offers",
    "Process quality",
  ];

  const filters = [
    { id: "jobs", label: "Jobs", value: "All jobs", options: ["All jobs", "Product Designer", "Software Engineer", "UX Researcher"] },
    { id: "teams", label: "Teams", value: "All teams", options: ["All teams", "Product", "Engineering", "Design"] },
    { id: "locations", label: "Locations", value: "All locations", options: ["All locations", "Kolkata", "Bengaluru", "Pune"] },
  ];

  return (
    <EmployerShell active="Analytics">
      <SectionHead
        title="Hiring analytics"
        subtitle="How your hiring process performs — response times, stage conversion, sources and offers."
      >
        <Btn>Export</Btn>
      </SectionHead>

      <div className="flex flex-wrap gap-3 items-center mb-2">
        <ButtonGroup
          options={["Last 30 days", "90 days", "This quarter", "12 months", "Custom"]}
          value={range}
          onChange={setRange}
        />
        <span className="text-[10px] text-[#4A5568] mx-2">Compare to</span>
        <ButtonGroup
          options={["Previous period", "Same period last year"]}
          value={compare}
          onChange={setCompare}
        />
      </div>

      <FilterBar filters={filters} onChange={() => {}} />

      {/* Insight strip */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        {activeInsights.map((ins) => (
          <InsightCard
            key={ins.id}
            icon={ins.icon}
            headline={ins.headline}
            reason={ins.reason}
            onView={ins.onView}
            dismissible={() => setDismissed((prev) => new Set([...prev, ins.id]))}
          />
        ))}
        {activeInsights.length === 0 && (
          <Card padded title="No new insights">
            <p className="text-[12px] text-[#4A5568]">
              All current insights have been dismissed. New insights appear here when the data changes.
            </p>
          </Card>
        )}
      </div>

      {/* KPI row */}
      <div className="grid gap-4 lg:grid-cols-4 mb-8">
        {analyticsKpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {/* Tab content */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {tab === "Overview" && (
            <>
              <ChartCard
                title="Applicants over time"
                insight="Applications are up 14% vs the previous period, with a steady weekly rhythm."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <LineChart data={{}} />
              </ChartCard>
              <ChartCard
                title="Funnel summary"
                insight="Applied → Shortlisted → Interview → Offer → Hired: 312 → 118 → 64 → 22 → 9."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <div className="flex items-end gap-2 h-48">
                  {funnelStages.map((s) => (
                    <div key={s.stage} className="flex flex-col items-center gap-1">
                      <div
                        className="w-16 bg-[#0F1B2D] rounded-t"
                        style={{ height: `${(s.count / 312) * 200}px` }}
                      />
                      <span className="text-[10px] text-[#4A5568]">{s.count}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <ChartCard
                title="Time to first response trend"
                insight="Median first response is 3 days — down from 5 days last quarter. 78% answered within 7 days."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <LineChart data={{}} />
              </ChartCard>
              <ChartCard
                title="Offers sent vs accepted"
                insight="14 offers sent, 9 accepted (64% acceptance). One offer expired, one withdrawn."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <div className="flex items-end gap-2 h-48">
                  {["Sent", "Accepted"].map((s, i) => (
                    <div key={s} className="flex flex-col items-center gap-1">
                      <div
                        className={`w-20 rounded-t ${i === 1 ? "bg-[#B8955A]" : "bg-[#0F1B2D]"}`}
                        style={{ height: `${(i === 0 ? 14 : 9) * 8}px` }}
                      />
                      <span className="text-[10px] text-[#4A5568]">
                        {i === 0 ? "14 sent" : "9 accepted"}
                      </span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <Section title="What's working and what to look at">
                <ul className="space-y-3 text-[12px] text-[#4A5568]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-[#286749] flex-shrink-0" />
                    Referral candidates convert to interview at 34% vs a 16% average.
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-[#9A6210] flex-shrink-0" />
                    Engineering first-response median is 9 days — above the 3-day company median.
                  </li>
                  <li className="flex items-start gap-2">
                    <Info size={14} className="text-[#0F1B2D] flex-shrink-0" />
                    3 candidates are waiting over 14 days for a reply.
                  </li>
                </ul>
              </Section>
            </>
          )}

          {tab === "Funnel" && (
            <>
              <ChartCard
                title="Conversion funnel"
                insight="Applied → Shortlisted → Interview → Offer → Hired. Conversion between stages: 38%, 54%, 34%, 41%."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <div className="flex items-end gap-2 h-64 w-full">
                  {funnelStages.map((s) => (
                    <div key={s.stage} className="flex flex-col items-center gap-1">
                      <div
                        className="w-24 bg-[#0F1B2D] rounded-t"
                        style={{ height: `${(s.count / 312) * 300}px` }}
                      />
                      <span className="text-[10px] font-medium text-[#0F1B2D]">{s.count}</span>
                      <span className="text-[10px] text-[#4A5568]">
                        {s.conversion ? `${s.conversion}%` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <ChartCard
                title="Drop-off by stage"
                insight="The largest drop is Shortlisted → Interview (38% don't advance). Most cite no response within 7 days."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <div className="space-y-3">
                  {dropoffByStage.map((d) => (
                    <div key={d.stage + d.reason} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-3">
                        <span className="text-[#4A5568]">
                          {d.stage} · {d.reason}
                        </span>
                        <SampleSizeChip n={d.count} label="" />
                      </div>
                      <span className="text-[#0F1B2D] font-semibold">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <Card title="By job">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-[#E5E1D8]">
                        {["Job", "Applicants", "Shortlisted", "Interviewed", "Offers", "Hires", "Median time", "Status"].map((h) => (
                          <th key={h} className="pb-2 text-[#4A5568] font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8]">
                      {jobsFunnel.map((j) => (
                        <tr key={j.job} className="hover:bg-[#F3EBDD]/50">
                          <td className="py-3 text-[#0F1B2D] font-medium">{j.job}</td>
                          <td className="py-3 text-right">{j.applicants}</td>
                          <td className="py-3 text-right">{j.shortlisted}</td>
                          <td className="py-3 text-right">{j.interviewed}</td>
                          <td className="py-3 text-right">{j.offers}</td>
                          <td className="py-3 text-right">{j.hires}</td>
                          <td className="py-3 text-right">{j.medianTime}</td>
                          <td className="py-3">
                            <StatusChip status={j.status} kind="draft" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-[#4A5568] mt-3">
                  Jobs with under 10 applicants show counts without percentages.
                </p>
              </Card>
            </>
          )}

          {tab === "Speed" && (
            <>
              <ChartCard
                title="Time to first response"
                insight="Median 3 days. 68% answered within 3 days, 85% within 7 days, 94% within 14 days (target)."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <LineChart data={{}} />
              </ChartCard>
              <ChartCard
                title="Time in stage"
                insight="Screening stage averages 6 days — marked Slow. Offer stage averages 4 days."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <div className="space-y-3">
                  {[
                    { stage: "Applied → Shortlisted", median: "3 days", flag: false },
                    { stage: "Shortlisted → Interview", median: "6 days", flag: true },
                    { stage: "Interview → Offer", median: "4 days", flag: false },
                    { stage: "Offer → Hired", median: "3 days", flag: false },
                  ].map((s) => (
                    <div key={s.stage} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-3">
                        <span className="text-[#4A5568]">{s.stage}</span>
                        {s.flag && (
                          <span className="text-[10px] text-[#9A6210] font-medium">
                            Slow
                          </span>
                        )}
                      </div>
                      <span className="text-[#0F1B2D] font-semibold">{s.median}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <Card title="Waiting candidates (over 14 days)">
                <div className="space-y-3">
                  {[
                    { name: "Candidate #44", job: "Software Engineer", waited: "18 days" },
                    { name: "Candidate #51", job: "Product Designer", waited: "16 days" },
                    { name: "Candidate #57", job: "UX Researcher", waited: "15 days" },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-[12px] py-2 border-b border-[#E5E1D8]/50 last:border-0">
                      <div>
                        <span className="text-[#0F1B2D] font-medium">{c.name}</span><br />
                        <span className="text-[10px] text-[#4A5568]">{c.job}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#B42318] font-medium">{c.waited}</span>
                        <Btn size="small" secondary>Reply with template</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {tab === "Sources" && (
            <>
              <ChartCard
                title="Applicants by source"
                insight="Job search leads with 114 applicants, followed by Startups hiring (68) and Invitations accepted (52)."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <div className="space-y-3">
                  {sources.map((s) => (
                    <div key={s.source} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-3">
                        <span className="text-[#4A5568]">{s.source}</span>
                        <SampleSizeChip n={s.applicants} label="applicants" />
                      </div>
                      <span className="text-[#0F1B2D] font-semibold">{s.applicants}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <ChartCard
                title="Source quality"
                insight="Referrals convert to hire at 5% (n=20) — highest quality but small sample. Job search at 2.6% (n=114)."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <div className="space-y-3">
                  {sources.map((s) => {
                    const pct = ((s.toHire / s.applicants) * 100).toFixed(1);
                    return (
                      <div key={s.source} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-3">
                          <span className="text-[#4A5568]">{s.source}</span>
                          <SampleSizeChip n={s.applicants} label="" />
                        </div>
                        <span className="text-[#0F1B2D] font-semibold">{pct}% to hire</span>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
              <Card title="Invitations (Talent Search)">
                <div className="grid gap-4 lg:grid-cols-4">
                  {[
                    { label: "Sent", value: invitesData.sent },
                    { label: "Viewed", value: invitesData.viewed },
                    { label: "Accepted", value: invitesData.accepted },
                    { label: "Declined", value: invitesData.declined },
                  ].map((i) => (
                    <Card key={i.label} title padded>
                      <div className="px-6 pt-3 pb-4">
                        <b className="text-2xl font-serif font-semibold">{i.value}</b>
                        <p className="text-[10px] text-[#4A5568]">{i.label}</p>
                      </div>
                    </Card>
                  ))}
                </div>
                <p className="text-[10px] text-[#4A5568] mt-3">
                  Daily limit: {invitesData.used} / {invitesData.limit} used.
                </p>
              </Card>
            </>
          )}

          {tab === "Offers" && (
            <>
              <ChartCard
                title="Offers funnel"
                insight="Created → Approved → Sent → Viewed → Accepted → Declined → Expired → Withdrawn."
                source="From platform events · Updated 2 hours ago"
                onViewTable={() => {}}
              >
                <div className="flex items-end gap-1 h-56 w-full">
                  {offersFunnel.map((s) => (
                    <div key={s.stage} className="flex flex-col items-center gap-1">
                      <div
                        className="w-12 rounded-t bg-[#0F1B2D]"
                        style={{ height: `${(s.count / 18) * 260}px` }}
                      />
                      <span className="text-[9px] text-[#4A5568] leading-none">
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Time from final interview to offer">
                  <div className="px-6 pt-3 pb-4">
                    <b className="text-3xl font-serif font-semibold">4 days</b>
                    <p className="text-[10px] text-[#4A5568]">
                      Median from final interview to offer sent.
                    </p>
                  </div>
                </Card>
                <Card title="Time to acceptance">
                  <div className="px-6 pt-3 pb-4">
                    <b className="text-3xl font-serif font-semibold">2 days</b>
                    <p className="text-[10px] text-[#4A5568]">
                      Median from offer sent to acceptance.
                    </p>
                  </div>
                </Card>
              </div>
              <Card title="Decline reasons (aggregated)">
                <div className="space-y-3">
                  {declineReasons.map((d) => (
                    <div key={d.reason} className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-3">
                        <span className="text-[#4A5568]">{d.reason}</span>
                        <SampleSizeChip n={d.count} label="" />
                      </div>
                      <span className="text-[#0F1B2D] font-semibold">{d.pct}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#4A5568] mt-3">
                  Only candidate-shared reasons are shown. Compensation details are not shown in analytics.
                </p>
              </Card>
            </>
          )}

          {tab === "Process quality" && (
            <>
              <Section title="Process fairness checks (descriptive — no person-level ranking)">
                <div className="space-y-4">
                  {processChecks.map((c) => (
                    <Card key={c.name} title padded>
                      <div className="px-6 pt-3 pb-4">
                        <div className="flex items-baseline gap-2 mb-2">
                          <b className="text-2xl font-serif font-semibold">
                            {c.value}
                          </b>
                          {c.n && <SampleSizeChip n={c.n} label="" />}
                        </div>
                        <p className="text-[12px] text-[#4A5568] mb-3">{c.desc}</p>
                        <div className="flex items-center gap-2 text-[12px] text-[#4A5568]">
                          <span className="font-medium">Suggested improvement:</span>
                          <span>{c.improvement}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <p className="text-[10px] text-[#4A5568] mt-4">
                  These checks describe the process, not people. No check ranks
                  candidates or individual interviewers.
                </p>
              </Section>
            </>
          )}
        </div>

        {/* Side column */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="Data notes">
            <div className="px-6 pt-3 pb-4 space-y-4">
              <p className="text-[12px] text-[#4A5568]">
                What's included: applicants, hires, offers and stage events from
                your jobs in the period. Stages are mapped from your pipeline
                templates. Time zone: Asia/Kolkata.
              </p>
              <p className="text-[12px] text-[#4A5568]">
                Minimum group size: breakdowns under 10 records are hidden or
                merged.
              </p>
              <p className="text-[10px] text-[#B42318]">
                Known limits: Hires recorded after 12 Oct 2026 only.
              </p>
              <p className="text-[10px] text-[#4A5568]">
                Last refreshed: 2 hours ago.
              </p>
            </div>
          </Card>
          <Card title="Definitions">
            <div className="px-6 pt-3 pb-4 space-y-3">
              {[
                { term: "Applicants", def: "Candidates who submitted an application in the period." },
                { term: "Stage conversion", def: "Candidates who reached the next stage ÷ candidates who reached this stage." },
                { term: "Time to first response", def: "From application to the first human action visible to the candidate, excluding automatic acknowledgement." },
                { term: "Time to hire", def: "From job published to offer accepted (or application to acceptance, as labeled)." },
              ].map((d) => (
                <div key={d.term} className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#0F1B2D]">{d.term}</span>
                  <p className="text-[11px] text-[#4A5568]">{d.def}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Saved views">
            <div className="px-6 pt-3 pb-4 space-y-3">
              <p className="text-[10px] text-[#4A5568] mb-3">
                Name and save a set of filters; share with named colleagues inside the company.
              </p>
              <div className="space-y-2">
                {[
                  "Engineering funnel — Q4",
                  "Design hires — last 90 days",
                ].map((name) => (
                  <div key={name} className="flex items-center justify-between text-[12px]">
                    <span className="text-[#0F1B2D]">{name}</span>
                    <Btn size="small" secondary>Share</Btn>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <div className="px-6 pt-3 pb-4">
              <Btn
                onClick={() => {}}
                secondary
                className="w-full text-left"
              >
                <AlertCircle size={14} className="mr-2" /> Report an issue with this data
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      <p className="text-[10px] text-[#4A5568] mt-8">
        These numbers describe the process, not individual candidates.
      </p>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 2: Trust and Safety — /employer/trust                        */
/* ================================================================== */
function TrustPage() {
  const [tab, setTab] = useState("Overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);

  const tabs = [
    "Overview",
    "Reports and flags",
    "Appeals",
    "Posting rules",
    "Report a problem",
    "Blocked candidates",
  ];

  return (
    <EmployerShell active="Trust">
      {/* Standing header */}
      <div className="flex items-center gap-2 mb-1">
        <StatusChip status={company.standing} kind="standing" />
        <span className="text-[10px] text-[#4A5568] ml-2">
          Keep hiring safe and fair for everyone.
        </span>
      </div>

      {/* Summary strip */}
      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        {trustSummary.map((s) => (
          <Card key={s.label} padded>
            <div className="px-6 pt-3 pb-4">
              <div className="flex items-baseline gap-2 mb-2">
                <b className={`text-2xl font-serif font-semibold ${
                  s.tint === "success" ? "text-[#286749]" : s.tint === "warning" ? "text-[#9A6210]" : "text-[#0F1B2D]"
                }`}>
                  {s.value}
                </b>
              </div>
              <p className="text-[10px] text-[#4A5568]">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {tab === "Overview" && (
            <>
              <Card title="Company standing">
                <div className="px-6 pt-3 pb-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <StatusChip status={company.standing} kind="standing" />
                    <span className="text-xs font-medium text-[#0F1B2D]">
                      What this means: Your company is in good standing. All hiring features are available.
                    </span>
                  </div>
                  <p className="text-[12px] text-[#4A5568]">
                    Standing affects: new jobs publish immediately, outreach limits at full, candidate messaging unrestricted.
                  </p>
                  {company.standing !== "Good standing" && (
                    <div className="bg-[#FBE9E7] border border-[#FBE9E7] rounded-lg p-3">
                      <p className="text-[12px] text-[#B42318] mb-2">
                        Reason: verification review pending. Steps to fix: submit business registration, confirm official email domain.
                      </p>
                      <Btn size="small">Contact support</Btn>
                    </div>
                  )}
                </div>
              </Card>

              <Card title="Verification">
                <div className="px-6 pt-3 pb-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-sm font-semibold">{company.verified ? "Verified" : "Not verified"}</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Last reviewed {company.verifiedAt}
                      </p>
                    </div>
                    <Btn size="small">Update verification details</Btn>
                  </div>
                  <div className="space-y-2 text-[12px] text-[#4A5568]">
                    <p>What was checked: business registration, official email domain, website.</p>
                    <p>Re-check triggers: legal name change, new domain, ownership change.</p>
                  </div>
                </div>
              </Card>

              <Card title="Responsiveness (aggregate)">
                <div className="px-6 pt-3 pb-4 space-y-3">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {[
                      { label: "Median first response", value: "3 days" },
                      { label: "Replied within 14 days", value: "89%" },
                      { label: "Rejections with a message", value: "91%" },
                    ].map((m) => (
                      <div key={m.label}>
                        <b className="text-lg font-serif font-semibold">{m.value}</b>
                        <p className="text-[10px] text-[#4A5568]">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[12px] text-[#4A5568]">
                    These may appear in aggregate on your company page (for example, "Typically replies within 4 days").
                  </p>
                  <Btn size="small" className="mt-3 text-[#B8955A] hover:bg-[#F3EBDD] border-transparent bg-transparent">
                    Improve this <ArrowRight size={12} />
                  </Btn>
                </div>
              </Card>

              <Card title="Recent trust events">
                <div className="px-6 pt-3 pb-4 space-y-3">
                  {recentTrustEvents.map((e) => (
                    <div key={e.event} className="flex items-center justify-between text-[12px] py-2 border-b border-[#E5E1D8]/50 last:border-0">
                      <span className="text-[#0F1B2D]">{e.event}</span>
                      <span className="text-[10px] text-[#4A5568]">{e.date}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Safety reminders">
                <div className="px-6 pt-3 pb-4 space-y-3">
                  {safetyReminders.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-[#4A5568]">
                      <Star size={14} className="text-[#B8955A] flex-shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                  <Btn size="small" className="mt-3 text-[#B8955A] hover:bg-[#F3EBDD] border-transparent bg-transparent">
                    Read the posting rules <ArrowRight size={12} />
                  </Btn>
                </div>
              </Card>
            </>
          )}

          {tab === "Reports and flags" && (
            <>
              <Card title="Reports about your jobs and flags raised by the platform">
                <div className="px-6 pt-3 pb-4 overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-[#E5E1D8]">
                        {["Date", "Type", "Category", "Related item", "Status", "Action"].map((h) => (
                          <th key={h} className="pb-2 text-[#4A5568] font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8]">
                      {reportsFlags.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer hover:bg-[#F3EBDD]/50"
                          onClick={() => {
                            setDrawerItem(r);
                            setDrawerOpen(true);
                          }}
                        >
                          <td className="py-3">{r.date}</td>
                          <td className="py-3 text-[10px] font-medium">{r.type}</td>
                          <td className="py-3 text-[#4A5568]">{r.category}</td>
                          <td className="py-3 text-[#0F1B2D]">{r.item}</td>
                          <td className="py-3">
                            <StatusChip status={r.status} kind="report" />
                          </td>
                          <td className="py-3 text-right">
                            <Btn size="small" secondary>View</Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {reportsFlags.length === 0 && (
                  <p className="text-[12px] text-[#4A5568] text-center py-6">
                    Nothing to review. Keep it up.
                  </p>
                )}
                <p className="text-[10px] text-[#4A5568] mt-3">
                  The reporter's identity is never shown. You see the category,
                  the job or message, the date and the status.
                </p>
              </Card>
            </>
          )}

          {tab === "Appeals" && (
            <>
              <Card title="How appeals work">
                <div className="px-6 pt-3 pb-4 space-y-4">
                  <p className="text-[12px] text-[#4A5568]">
                    Appeal a report outcome, job pause, restriction or verification decision. Expected timeline: 5 business days. The appeal is reviewed by someone other than the original moderator where possible.
                  </p>
                  {isOwnerOrAdmin() ? (
                    <>
                      <Btn onClick={() => {}}>Start an appeal</Btn>
                      <p className="text-[10px] text-[#4A5568] mt-2">
                        Only Owners and Admins can file or withdraw appeals.
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-[#4A5568]">
                      You don't have permission to file appeals. Ask an Owner or Admin.
                    </p>
                  )}
                </div>
              </Card>
              <Card title="Appeals list">
                <div className="px-6 pt-3 pb-4 space-y-3">
                  {appealsList.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-[12px] py-2 border-b border-[#E5E1D8]/50 last:border-0">
                      <div>
                        <span className="text-[#0F1B2D] font-medium">{a.decision}</span><br />
                        <span className="text-[10px] text-[#4A5568]">{a.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip status={a.status} kind="report" />
                        <span className="text-[#4A5568]">{a.outcome}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {tab === "Posting rules" && (
            <>
              <Card title="Employer posting rules">
                <div className="px-6 pt-3 pb-4 space-y-4">
                  <p className="text-[10px] text-[#4A5568] mb-2">
                    Version: 1.4 · Updated 12 Oct 2026
                  </p>
                  {postingRules.map((section, i) => (
                    <div key={section.title} className="space-y-2">
                      <h4 className="text-[11px] font-semibold text-[#0F1B2D] uppercase tracking-wide">
                        {section.title}
                      </h4>
                      <div className="grid gap-2 lg:grid-cols-2">
                        <div className="flex items-start gap-2 text-[12px] text-[#4A5568] pl-4 border-l-2 border-[#286749]">
                          <Check size={12} className="text-[#286749] mt-0.5" />
                          {section.items[0].do}
                        </div>
                        <div className="flex items-start gap-2 text-[12px] text-[#4A5568] pl-4 border-l-2 border-[#B42318]">
                          <X size={12} className="text-[#B42318] mt-0.5" />
                          {section.items[1].dont}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-[#4A5568] mt-4">
                    Consequences ladder: warning → job paused → outreach limits → restriction → suspension. Appeal route available at each step.
                  </p>
                </div>
              </Card>
            </>
          )}

          {tab === "Report a problem" && (
            <>
              <Card title="Report an issue to the platform">
                <div className="px-6 pt-3 pb-4 space-y-4">
                  <div className="space-y-3">
                    {[
                      { label: "Report a candidate or application", desc: "Fake or duplicate profiles, spam applications, abusive messages, fraudulent documents." },
                      { label: "Report a message or user", desc: "Harassment, requests for personal contact, scams targeting the company." },
                      { label: "Report a platform issue", desc: "Wrong data, access problems." },
                      { label: "Report a security concern", desc: "Suspected account compromise, suspicious logins." },
                    ].map((r) => (
                      <div key={r.label} className="flex items-center justify-between text-[12px] py-2 border-b border-[#E5E1D8]/50 last:border-0 cursor-pointer hover:bg-[#F3EBDD]/50">
                        <span className="text-[#0F1B2D]">{r.label}</span>
                        <ChevronRight size={14} />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#4A5568] mt-2">
                    Reports are confidential and acknowledged. The candidate isn't told who reported unless the law requires it. A report isn't a rejection reason, and candidates can respond.
                  </p>
                </div>
              </Card>
              <Card title="My reports">
                <div className="px-6 pt-3 pb-4 space-y-3">
                  <p className="text-[12px] text-[#4A5568] text-center py-4">
                    No reports filed yet.
                  </p>
                </div>
              </Card>
            </>
          )}

          {tab === "Blocked candidates" && (
            <>
              <Card title="Blocked candidates">
                <div className="px-6 pt-3 pb-4 space-y-3">
                  {blockedCandidates.map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-[12px] py-2 border-b border-[#E5E1D8]/50 last:border-0">
                      <div>
                        <span className="text-[#0F1B2D] font-medium">{b.name}</span><br />
                        <span className="text-[10px] text-[#4A5568]">{b.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#4A5568]">{b.date}</span>
                        {isOwnerOrAdmin() ? (
                          <Btn size="small" secondary>Unblock</Btn>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {blockedCandidates.length === 0 && (
                    <p className="text-[12px] text-[#4A5568] text-center py-4">
                      No blocked candidates.
                    </p>
                  )}
                  <p className="text-[10px] text-[#4A5568] mt-3">
                    Blocking affects only this company's pipeline. It is not a platform-wide ban and can't be used for discriminatory reasons — all blocks are logged.
                  </p>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Side column */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="Quick actions">
            <div className="px-6 pt-3 pb-4 space-y-3">
              <Btn onClick={() => {}} className="w-full text-left">
                <AlertTriangle size={16} className="mr-2" /> Report a problem
              </Btn>
              <Btn size="small" secondary className="w-full text-left">
                <FileText size={14} className="mr-2" /> View posting rules
              </Btn>
              <Btn size="small" secondary className="w-full text-left">
                <Headphones size={14} className="mr-2" /> Contact support
              </Btn>
            </div>
          </Card>
          <Card title="Security tips">
            <div className="px-6 pt-3 pb-4 space-y-3">
              <div className="flex items-start gap-2 text-[12px] text-[#4A5568]">
                <ShieldCheck size={14} className="text-[#286749] mt-0.5" />
                <span>Use two-factor authentication</span>
              </div>
              <div className="flex items-start gap-2 text-[12px] text-[#4A5568]">
                <ShieldCheck size={14} className="text-[#286749] mt-0.5" />
                <span>Review your team's access</span>
              </div>
              <Btn size="small" secondary className="mt-2 w-full text-left">
                <Users size={14} className="mr-2" /> Team and Settings
              </Btn>
            </div>
          </Card>
          <Card title="Platform status">
            <div className="px-6 pt-3 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#286749]" />
                <span className="text-[11px] text-[#4A5568]">All systems operational</span>
              </div>
              <Btn size="small" secondary className="w-full text-left">
                <Globe size={14} className="mr-2" /> Platform status page
              </Btn>
            </div>
          </Card>
        </div>
      </div>

      {drawerOpen && drawerItem && (
        <DetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Report / flag — ${drawerItem.category}`}
        >
          <div className="space-y-5">
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                What was reported or flagged
              </h4>
              <p className="text-[12px] text-[#4A5568] mb-2">
                {drawerItem.excerpt}
              </p>
              <span className="text-[10px] text-[#B8955A] font-medium">
                Related: {drawerItem.item}
              </span>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                What happened
              </h4>
              <p className="text-[12px] text-[#4A5568]">
                {drawerItem.status === "Open"
                  ? "No action taken yet. Awaiting moderator review."
                  : drawerItem.status === "Resolved"
                    ? "Issue resolved. No further action needed."
                    : "Report dismissed after review."}
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                What you can do
              </h4>
              <div className="space-y-2">
                <Btn size="small" secondary className="w-full text-left">Fix and resubmit</Btn>
                <Btn size="small" secondary className="w-full text-left">Respond</Btn>
                {isOwnerOrAdmin() && <Btn size="small" secondary className="w-full text-left">Appeal</Btn>}
                <Btn size="small" secondary className="w-full text-left">Dismiss</Btn>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                History
              </h4>
              <p className="text-[12px] text-[#4A5568]">No moderator notes yet.</p>
            </div>
            <p className="text-[10px] text-[#4A5568] mt-4 italic">
              "We never share who reported."
            </p>
          </div>
        </DetailDrawer>
      )}
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 3: Activity and Audit Log — /employer/activity               */
/* ================================================================== */
function ActivityPage() {
  const [tab, setTab] = useState("All activity");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("30 days");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entry, setEntry] = useState(null);

  const tabs = [
    "All activity",
    "Candidate data access",
    "Hiring actions",
    "Offers and hires",
    "Team and settings",
    "Security",
  ];

  const filtered = useMemo(() => {
    return auditLog.filter((e) => {
      if (search && !e.action.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search]);

  return (
    <EmployerShell active="Activity">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-sm font-serif font-semibold">Activity and audit log</h2>
          <p className="text-[10px] text-[#4A5568]">
            This log can't be edited or deleted. Entries are append-only for
            accountability and compliance.
          </p>
        </div>
        <Btn>Export</Btn>
      </div>

      {/* Summary strip */}
      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        <Card padded>
          <div className="px-6 pt-3 pb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <b className="text-2xl font-serif font-semibold text-[#0F1B2D]">1,248</b>
            </div>
            <p className="text-[10px] text-[#4A5568]">Events (last 30 days)</p>
          </div>
        </Card>
        <Card padded>
          <div className="px-6 pt-3 pb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <b className="text-2xl font-serif font-semibold text-[#0F1B2D]">410</b>
            </div>
            <p className="text-[10px] text-[#4A5568]">Candidate profile views</p>
          </div>
        </Card>
        <Card padded>
          <div className="px-6 pt-3 pb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <b className="text-2xl font-serif font-semibold text-[#0F1B2D]">3</b>
            </div>
            <p className="text-[10px] text-[#4A5568]">Exports</p>
          </div>
        </Card>
        <Card padded>
          <div className="px-6 pt-3 pb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <b className="text-2xl font-serif font-semibold text-[#286749]">0</b>
            </div>
            <p className="text-[10px] text-[#4A5568]">Security alerts</p>
          </div>
        </Card>
      </div>


      {/* Tabs */}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="relative flex-1 max-w-[320px]">
          <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={16} />
          <input
            placeholder="Search action text or record ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 pr-4 text-[11px]"
          />
        </div>
        <ButtonGroup
          options={["Today", "7 days", "30 days", "Custom"]}
          value={dateRange}
          onChange={setDateRange}
        />
        <select
          className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-2 pr-8 text-[11px] appearance-none"
        >
          <option>All members</option>
          <option>Priya Mehta · Recruiter</option>
          <option>Rahul Verma · Hiring manager</option>
          <option>Owner account · Owner</option>
        </select>
        <select
          className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-2 pr-8 text-[11px] appearance-none"
        >
          <option>All outcomes</option>
          <option>Success</option>
          <option>Blocked</option>
          <option>Failed</option>
        </select>
      </div>

      {/* Log table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-[#E5E1D8]">
                {["Time", "Who", "Category", "Action", "Target", "Outcome", "Context"].map((h) => (
                  <th key={h} className="pb-3 text-[#4A5568] font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1D8]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#4A5568]">
                    No entries match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer hover:bg-[#F3EBDD]/50 transition"
                    onClick={() => {
                      setEntry(e);
                      setDrawerOpen(true);
                    }}
                  >
                    <td className="py-3 text-[#4A5568]">{e.time}</td>
                    <td className="py-3 text-[#0F1B2D]">{e.who}</td>
                    <td className="py-3 text-[#4A5568]">{e.category}</td>
                    <td className="py-3 text-[#0F1B2D]">{e.action}</td>
                    <td className="py-3 text-[#4A5568]">{e.target}</td>
                    <td className="py-3">
                      <StatusChip status={e.outcome} kind="audit" />
                    </td>
                    <td className="py-3 text-[#4A5568]">{e.context.split(" · ")[1]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[10px] text-[#4A5568] mt-4">
        Logs are not used to rate or rank team members. Candidate names in old
        entries are anonymized when a candidate's data is deleted.
      </p>

      {drawerOpen && entry && (
        <DetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Audit record · ${entry.id}`}
        >
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                  Record
                </h4>
                <p className="text-[12px] text-[#4A5568]"><b>ID:</b> {entry.id}</p>
                <p className="text-[12px] text-[#4A5568]"><b>Time:</b> {entry.time}</p>
                <p className="text-[12px] text-[#4A5568]"><b>Who:</b> {entry.who}</p>
                <p className="text-[12px] text-[#4A5568]"><b>Category:</b> {entry.category}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                  Context
                </h4>
                <p className="text-[12px] text-[#4A5568]"><b>Device:</b> {entry.details.device}</p>
                <p className="text-[12px] text-[#4A5568]"><b>Region:</b> {entry.details.region}</p>
                <p className="text-[12px] text-[#4A5568]"><b>Session:</b> {entry.details.session}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                Action
              </h4>
              <p className="text-[12px] text-[#4A5568]">{entry.action}</p>
              <p className="text-[12px] text-[#4A5568]"><b>Target:</b> {entry.target}</p>
              <p className="text-[12px] text-[#4A5568]"><b>Outcome:</b>
                <StatusChip status={entry.outcome} kind="audit" />
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                Before → After
              </h4>
              <div className="space-y-2 text-[12px] text-[#4A5568]">
                <p><b>Before:</b> {entry.details.before}</p>
                <p><b>After:</b> {entry.details.after}</p>
              </div>
            </div>
          </div>
        </DetailDrawer>
      )}
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Exports                                                           */
/* ================================================================== */
export { AnalyticsPage, TrustPage, ActivityPage };
