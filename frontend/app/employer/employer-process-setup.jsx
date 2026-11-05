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
  Edit,
  Eye as EyeIcon,
  User as User2,
  GraduationCap,
  Award as AwardIcon,
  Trophy,
  Link as Link2Icon,
  RefreshCcw,
  Download as DownloadIcon,
  Cloud,
  Folder,
  Shield as ShieldIcon,
  Clock as Clock2,
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
    Draft: "border-[#E5E1D8] text-[#4A5568]",
    "Pending approval": "border-[#F3EBDD] text-[#806236]",
    "In use": "border-[#E7F3EC] text-[#286749]",
    "Needs review": "border-[#FDF3E0] text-[#9A6210]",
    Archived: "border-[#E5E1D8] text-[#4A5568]",
    "Platform default": "border-[#F3EBDD] bg-[#F3EBDD] text-[#806236]",
    Company: "border-[#0F1B2D] text-[#0F1B2D]",
    Personal: "border-[#E5E1D8] text-[#4A5568]",
    "Offer accepted": "border-[#FDF3E0] text-[#9A6210] bg-[#FDF3E0]",
    "Documents pending": "border-[#FDF3E0] text-[#9A6210]",
    "Checks in progress": "border-[#FDF3E0] text-[#9A6210]",
    "Ready to start": "border-[#E7F3EC] text-[#286749] bg-[#E7F3EC]",
    Started: "bg-[#0F1B2D] text-white",
    Deferred: "border-[#E5E1D8] text-[#4A5568]",
    "Did not join": "border-[#FBE9E7] text-[#B42318]",
    Open: "border-[#E7F3EC] text-[#286749]",
    Closed: "border-[#0F1B2D] text-[#0F1B2D]",
    Filled: "bg-[#0F1B2D] text-white",
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

const templateKpis = [
  { label: "Templates", value: "24" },
  { label: "In use", value: "17" },
  { label: "Needs review", value: "2", delta: "warning" },
  { label: "Last updated", value: "3 days ago" },
];

const hireKpis = [
  { label: "Upcoming starts (30 days)", value: "4" },
  { label: "Documents pending", value: "3", delta: "warning" },
  { label: "Checks in progress", value: "2" },
  { label: "Offer-to-start drop-off", value: "1 of 14 did not join" },
];

const templates = [
  {
    id: "tpl-1",
    name: "Product Designer job post",
    type: "Job post",
    scope: "Company-wide",
    status: "In use",
    desc: "Full job post structure with screening questions and pipeline.",
    category: "Design",
    usedIn: 3,
    updated: "2 days ago",
    updatedBy: "Priya Mehta",
    version: "v3",
    platform: false,
  },
  {
    id: "tpl-2",
    name: "Standard interview pipeline",
    type: "Pipeline",
    scope: "Company-wide",
    status: "In use",
    desc: "Applied → Shortlisted → Screening → Technical → Offer → Hired.",
    category: "Engineering",
    usedIn: 5,
    updated: "1 week ago",
    updatedBy: "Owner account",
    version: "v2",
    platform: true,
  },
  {
    id: "tpl-3",
    name: "Technical scorecard",
    type: "Scorecard",
    scope: "Team",
    status: "Needs review",
    desc: "Problem solving, Communication, Role skills, Ownership.",
    category: "Engineering",
    usedIn: 2,
    updated: "5 days ago",
    updatedBy: "Rahul Verma",
    version: "v1",
    platform: false,
  },
  {
    id: "tpl-4",
    name: "Kind rejection message",
    type: "Messages",
    scope: "Personal",
    status: "Draft",
    desc: "Polite rejection by reason: skills, experience, timing.",
    category: "All",
    usedIn: 0,
    updated: "3 days ago",
    updatedBy: "Priya Mehta",
    version: "v1",
    platform: false,
  },
  {
    id: "tpl-5",
    name: "Engineering interview guide",
    type: "Interview guides",
    scope: "Team",
    status: "In use",
    desc: "Screening call and technical round guide with question bank.",
    category: "Engineering",
    usedIn: 4,
    updated: "1 week ago",
    updatedBy: "Sana Desai",
    version: "v2",
    platform: false,
  },
  {
    id: "tpl-6",
    name: "Offer letter template",
    type: "Offers",
    scope: "Company-wide",
    status: "Pending approval",
    desc: "Compensation, equity, vesting, benefits — sample, not legal advice.",
    category: "All",
    usedIn: 0,
    updated: "1 day ago",
    updatedBy: "Meera Shah",
    version: "v1",
    platform: false,
  },
];

const scorecardCriteria = [
  {
    name: "Problem solving",
    weight: 25,
    anchors: [
      "1 = No example given",
      "4 = Specific example with measurable outcome",
    ],
  },
  {
    name: "Communication",
    weight: 20,
    anchors: [
      "1 = Unclear responses",
      "4 = Clear, structured, audience-appropriate",
    ],
  },
  {
    name: "Role skills",
    weight: 30,
    anchors: ["1 = Below required level", "4 = Exceeds requirements"],
  },
  {
    name: "Ownership",
    weight: 15,
    anchors: ["1 = Needs constant direction", "4 = Drives work to completion"],
  },
  {
    name: "Collaboration",
    weight: 10,
    anchors: ["1 = Works in isolation", "4 = Actively helps teammates"],
  },
];

const hires = [
  {
    id: "hire-1",
    name: "Aanya Sen",
    blind: false,
    role: "Product Designer",
    job: "Product Designer",
    department: "Product",
    manager: "Priya Mehta",
    owner: "Priya Mehta",
    startDate: "Dec 2, 2025",
    status: "Documents pending",
    checklist: { done: 6, total: 10 },
    documents: { received: 2, total: 4 },
    lastActivity: "Oct 30",
    actions: ["Open", "Message"],
  },
  {
    id: "hire-2",
    name: "Candidate #44",
    blind: true,
    role: "Software Engineer",
    job: "Software Engineer",
    department: "Engineering",
    manager: "Rahul Verma",
    owner: "Rahul Verma",
    startDate: "Jan 15, 2026",
    status: "Checks in progress",
    checklist: { done: 4, total: 10 },
    documents: { received: 1, total: 3 },
    lastActivity: "Oct 28",
    actions: ["Open", "Message"],
  },
  {
    id: "hire-3",
    name: "Rohan Kapoor",
    blind: false,
    role: "UX Researcher",
    job: "UX Researcher",
    department: "Design",
    manager: "Sana Desai",
    owner: "Sana Desai",
    startDate: "Feb 1, 2026",
    status: "Ready to start",
    checklist: { done: 10, total: 10 },
    documents: { received: 4, total: 4 },
    lastActivity: "Oct 25",
    actions: ["Open", "Message"],
  },
];

const onboardingItems = [
  {
    section: "Before day one",
    items: [
      {
        id: "o-1",
        title: "Welcome message sent",
        owner: "Priya Mehta",
        due: "−5 days",
        status: "Done",
        note: "Sent with welcome packet.",
      },
      {
        id: "o-2",
        title: "Laptop and accounts ordered",
        owner: "IT team",
        due: "−5 days",
        status: "Done",
        note: "",
      },
      {
        id: "o-3",
        title: "Workspace or desk arranged",
        owner: "Office manager",
        due: "−3 days",
        status: "Done",
        note: "",
      },
      {
        id: "o-4",
        title: "Manager assigned",
        owner: "Priya Mehta",
        due: "−3 days",
        status: "Done",
        note: "",
      },
      {
        id: "o-5",
        title: "Buddy assigned",
        owner: "HR",
        due: "−3 days",
        status: "Done",
        note: "",
      },
      {
        id: "o-6",
        title: "First-week plan prepared",
        owner: "Priya Mehta",
        due: "−2 days",
        status: "In progress",
        note: "Draft shared with hire.",
      },
      {
        id: "o-7",
        title: "Calendar invites created",
        owner: "Priya Mehta",
        due: "−1 day",
        status: "To do",
        note: "",
      },
      {
        id: "o-8",
        title: "Policies shared",
        owner: "HR",
        due: "−1 day",
        status: "To do",
        note: "Sent via document tool.",
      },
    ],
  },
  {
    section: "Day one",
    items: [
      {
        id: "o-9",
        title: "Welcome meeting",
        owner: "Priya Mehta",
        due: "Start date",
        status: "To do",
        note: "30 min video call.",
      },
      {
        id: "o-10",
        title: "Team introductions",
        owner: "Team",
        due: "Start date",
        status: "To do",
        note: "",
      },
      {
        id: "o-11",
        title: "Tools access confirmed",
        owner: "IT team",
        due: "Start date",
        status: "To do",
        note: "",
      },
      {
        id: "o-12",
        title: "First tasks assigned",
        owner: "Priya Mehta",
        due: "Start date",
        status: "To do",
        note: "",
      },
    ],
  },
  {
    section: "First week and month",
    items: [
      {
        id: "o-13",
        title: "Goals set",
        owner: "Priya Mehta",
        due: "+7 days",
        status: "To do",
        note: "",
      },
      {
        id: "o-14",
        title: "1-to-1 meetings scheduled",
        owner: "Priya Mehta",
        due: "+7 days",
        status: "To do",
        note: "",
      },
      {
        id: "o-15",
        title: "Training completed",
        owner: "IT team",
        due: "+14 days",
        status: "To do",
        note: "",
      },
      {
        id: "o-16",
        title: "30-day check-in",
        owner: "HR",
        due: "+30 days",
        status: "To do",
        note: "",
      },
    ],
  },
];

const documents = [
  {
    id: "d-1",
    name: "Bank details",
    purpose: "To set up payroll",
    due: "Nov 20",
    status: "Received",
    who: "Payroll only",
    retention: "12 months",
  },
  {
    id: "d-2",
    name: "ID proof",
    purpose: "Employment eligibility",
    due: "Nov 18",
    status: "Requested",
    who: "HR only",
    retention: "12 months",
  },
  {
    id: "d-3",
    name: "Signed offer letter",
    purpose: "Employment agreement",
    due: "Nov 15",
    status: "Received",
    who: "Hiring team",
    retention: "Duration of employment",
  },
  {
    id: "d-4",
    name: "Tax declaration",
    purpose: "Tax withholding",
    due: "Nov 22",
    status: "Not requested",
    who: "Payroll only",
    retention: "12 months",
  },
];

const timelineEvents = [
  { step: "Offer accepted", date: "12 Nov", status: "done" },
  { step: "Documents", date: "In progress", status: "current" },
  { step: "Checks", date: "Pending", status: "upcoming" },
  { step: "Pre-boarding", date: "Nov 25", status: "upcoming" },
  { step: "First day", date: "Dec 2", status: "upcoming" },
  { step: "30-day check-in", date: "Jan 2", status: "upcoming" },
];

const nextSteps = [
  { title: "Collect bank details and ID", owner: "HR", due: "Nov 18" },
  { title: "Schedule welcome meeting", owner: "Priya Mehta", due: "Dec 2" },
  { title: "Prepare first-week plan", owner: "Priya Mehta", due: "Nov 28" },
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
  ["Analytics", BarChart3, "/employer/analytics"],
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
/*  Page 1: Templates and Scorecards                                  */
/* ================================================================== */
function TemplatesPage({ page }) {
  const [tab, setTab] = useState("All");
  const [view, setView] = useState("cards");
  const tabs = [
    "Job posts",
    "Pipelines",
    "Scorecards",
    "Screening questions",
    "Interview guides",
    "Messages",
    "Offers",
    "All",
  ];

  return (
    <EmployerShell active="Templates" page={page}>
      <div className="mb-6">
        <SectionHead
          title="Templates and Scorecards"
          subtitle="Set it up once. Use it for every hire."
        >
          <Btn>New template</Btn>
        </SectionHead>
        <div className="grid gap-4 lg:grid-cols-5 mt-4 mb-6">
          {templateKpis.map((k) => (
            <Card key={k.label} title padded>
              <div className="px-6 pt-3 pb-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <b className="text-3xl font-serif font-semibold">{k.value}</b>
                  {k.delta === "warning" && (
                    <span className="text-[10px] text-[#9A6210] font-medium">
                      warning
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#4A5568]">
                  {k.label === "Last updated" ? "" : ""}
                </p>
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
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-[#4A5568]">View:</span>
          <ButtonGroup
            options={["Cards", "Table"]}
            value={view === "cards" ? "Cards" : "Table"}
            onChange={(v) => setView(v === "Cards" ? "cards" : "table")}
          />
        </div>
        <div
          className={
            view === "cards"
              ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              : "overflow-x-auto border border-[#E5E1D8] rounded-lg"
          }
        >
          {view === "cards" ? (
            templates.map((t) => {
              const statusMap = {
                "In use": "border-[#E7F3EC] text-[#286749]",
                "Needs review": "border-[#FDF3E0] text-[#9A6210]",
                Draft: "border-[#E5E1D8] text-[#4A5568]",
                "Pending approval": "border-[#F3EBDD] text-[#806236]",
                Archived: "border-[#E5E1D8] text-[#4A5568]",
              };
              return (
                <div
                  key={t.id}
                  className="p-4 rounded-lg border border-[#E5E1D8] bg-white cursor-pointer hover:border-[#B8955A] transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <b className="text-xs font-semibold">{t.name}</b>
                    <StatusChip status={t.status} />
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] text-[#4A5568] border-[#E5E1D8]">
                      {t.type}
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] text-[#4A5568] border-[#E5E1D8]">
                      {t.scope}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#4A5568] mb-3 line-clamp-2">
                    {t.desc}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-[#4A5568] mb-2">
                    <div className="flex items-center gap-1">
                      <span>{t.category}</span>
                      <span>·</span>
                      <span>{t.usedIn} jobs</span>
                    </div>
                    <span className="text-[9px]">{t.version}</span>
                  </div>
                  <div className="flex gap-1">
                    <Btn onClick={() => {}} small>
                      Use
                    </Btn>
                    <Btn onClick={() => {}} secondary small>
                      Preview
                    </Btn>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-[#4A5568]">
                    <span>{t.updated}</span>
                    <span>·</span>
                    <span>{t.updatedBy}</span>
                  </div>
                  {t.platform && (
                    <div className="mt-2 inline-flex items-center rounded-full border border-[#F3EBDD] bg-[#F3EBDD] px-2 py-0.5 text-[9px] text-[#806236]">
                      <Sparkles size={9} className="mr-1" /> Platform default
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#E5E1D8]">
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                    Name
                  </th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                    Type
                  </th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                    Status
                  </th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                    Used in
                  </th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                    Updated
                  </th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-[#E5E1D8]">
                    <td className="py-3">
                      <b className="text-xs">{t.name}</b>
                    </td>
                    <td className="py-3 text-xs text-[#4A5568]">{t.type}</td>
                    <td className="py-3 text-xs">
                      <StatusChip status={t.status} />
                    </td>
                    <td className="py-3 text-xs text-[#4A5568]">{t.usedIn}</td>
                    <td className="py-3 text-xs text-[#4A5568]">{t.updated}</td>
                    <td className="py-3">
                      <Btn onClick={() => {}} secondary small>
                        Use
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 2: Hires and Onboarding                                      */
/* ================================================================== */
function HiresPage({ page }) {
  const [tab, setTab] = useState("Upcoming starts");
  const tabs = [
    "Upcoming starts",
    "Needs action",
    "Started",
    "Deferred or did not join",
    "Templates",
  ];

  return (
    <EmployerShell active="Hires" page={page}>
      <div className="mb-6">
        <SectionHead
          title="Hires and Onboarding"
          subtitle="From offer accepted to first day."
        />
        <div className="grid gap-4 lg:grid-cols-4 mt-4 mb-6">
          {hireKpis.map((k) => (
            <Card key={k.label} title padded>
              <div className="px-6 pt-3 pb-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <b className="text-3xl font-serif font-semibold">{k.value}</b>
                  {k.delta === "warning" && (
                    <span className="text-[10px] text-[#9A6210] font-medium">
                      warning
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#4A5568]">
                  {k.label === "Offer-to-start drop-off" ? "" : ""}
                </p>
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
        <div className="space-y-3">
          {hires.map((h) => {
            const statusMap = {
              "Offer accepted": "border-[#FDF3E0] text-[#9A6210]",
              "Documents pending": "border-[#FDF3E0] text-[#9A6210]",
              "Checks in progress": "border-[#FDF3E0] text-[#9A6210]",
              "Ready to start": "border-[#E7F3EC] text-[#286749]",
              Started: "bg-[#0F1B2D] text-white",
              Deferred: "border-[#E5E1D8] text-[#4A5568]",
              "Did not join": "border-[#FBE9E7] text-[#B42318]",
            };
            const pct = Math.round(
              (h.checklist.done / h.checklist.total) * 100,
            );
            return (
              <div
                key={h.id}
                className="p-4 rounded-lg border border-[#E5E1D8] bg-white cursor-pointer hover:border-[#B8955A] transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <b className="text-xs font-semibold">
                      {h.blind ? "Candidate" : h.name}
                    </b>
                    <StatusChip status={h.status} />
                  </div>
                  <Btn onClick={() => {}} small>
                    Open
                  </Btn>
                </div>
                <p className="text-[10px] text-[#4A5568] mb-1">
                  {h.role} · {h.department}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[#4A5568] mb-1">
                  <span>{h.manager}</span>
                  <span>·</span>
                  <span>{h.startDate}</span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-[10px] text-[#4A5568]">
                    {h.documents.received} of {h.documents.total} documents
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#E5E1D8] mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#B8955A]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-[#4A5568]">
                  {h.checklist.done} of {h.checklist.total} checklist items done
                </p>
                <div className="flex gap-1">
                  <Btn onClick={() => {}} small>
                    Open
                  </Btn>
                  <Btn onClick={() => {}} secondary small>
                    Message
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Page 3: Hire Detail                                               */
/* ================================================================== */
function HireDetailPage({ page, hireId }) {
  const [tab, setTab] = useState("Overview");
  const tabs = [
    "Overview",
    "Checklist",
    "Documents",
    "Checks",
    "Messages",
    "Notes and activity",
  ];
  const hire = hires.find((h) => h.id === hireId) || hires[0];
  const pct = Math.round((hire.checklist.done / hire.checklist.total) * 100);

  return (
    <EmployerShell active="Hires" page={page}>
      <div className="mb-6">
        <SectionHead
          title={hire.blind ? "Candidate" : hire.name}
          subtitle={hire.role}
        >
          <div className="flex gap-2">
            <Btn onClick={() => {}}>Message</Btn>
            <MoreHorizontal size={14} className="text-[#4A5568] ml-2" />
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
              <Card title="Timeline" padded>
                <div className="space-y-4">
                  {timelineEvents.map((e, i) => (
                    <div key={e.step} className="relative pl-4">
                      <span className="absolute -left-1 top-1 h-2 w-2 rounded-full border-2 border-white bg-white" />
                      <div
                        className={`h-px flex-1 ${e.status === "done" ? "bg-[#B8955A]" : "bg-[#E5E1D8]"}`}
                      />
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs font-medium ${e.status === "done" ? "text-[#286749]" : e.status === "current" ? "text-[#0F1B2D]" : "text-[#4A5568]"}`}
                        >
                          {e.step}
                        </span>
                        <span
                          className={`ml-auto text-[10px] ${e.status === "done" ? "text-[#286749]" : "text-[#4A5568]"}`}
                        >
                          {e.date}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="h-px flex-1 bg-[#E5E1D8]" />
                </div>
              </Card>
            )}
            {tab === "Overview" && (
              <Card title="Next steps" padded>
                <div className="space-y-3">
                  {nextSteps.map((s) => (
                    <div key={s.title} className="flex items-start gap-2">
                      <ClockIcon size={12} className="mt-0.5 text-[#4A5568]" />
                      <div className="flex-1 min-w-0">
                        <b className="text-xs">{s.title}</b>
                        <p className="text-[10px] text-[#4A5568]">
                          {s.owner} · {s.due}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {tab === "Overview" && (
              <Card title="Offer summary" padded>
                <p className="text-[10px] text-[#4A5568] mb-2">
                  Offer accepted on Oct 30 · starts Dec 2 · probation 3 months
                </p>
                <div className="space-y-2 text-[10px] text-[#4A5568]">
                  <div className="flex justify-between">
                    <span>Compensation</span>
                    <span className="text-[#0F1B2D] font-medium">
                      ₹22L / year
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Role</span>
                    <span className="text-[#0F1B2D] font-medium">
                      Product Designer
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Start date</span>
                    <span className="text-[#0F1B2D] font-medium">
                      Dec 2, 2025
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-[#4A5568]">
                  <a href="#" className="text-[#B8955A] underline">
                    View offer detail
                  </a>
                </p>
              </Card>
            )}
            {tab === "Overview" && (
              <Card title="Risks" padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-[#FDF3E0] bg-[#FDF3E0]">
                    <AlertTriangle
                      size={13}
                      className="text-[#9A6210] mt-0.5"
                    />
                    <div>
                      <b className="text-xs text-[#806236]">
                        Start date in 7 days and documents are missing
                      </b>
                      <p className="mt-0.5">
                        2 of 4 documents not yet received.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Checklist" && (
              <Card title="Onboarding checklist" padded>
                <div className="space-y-4">
                  {onboardingItems.map((section) => (
                    <div key={section.section}>
                      <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                        {section.section}
                      </h4>
                      <div className="space-y-2">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 p-2 rounded-lg border border-[#E5E1D8] bg-white"
                          >
                            <input
                              type="checkbox"
                              defaultChecked={item.status === "Done"}
                              className="mt-0.5 h-4 w-4"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-0.5">
                                <b className="text-xs">{item.title}</b>
                                <span
                                  className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] font-medium ${item.status === "Done" ? "border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]" : item.status === "In progress" ? "border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]" : "border-[#E5E1D8] text-[#4A5568]"}`}
                                >
                                  {item.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-[#4A5568]">
                                <span>{item.owner}</span>
                                <span>·</span>
                                <span>{item.due}</span>
                                {item.note && <span>· {item.note}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 flex gap-2">
                    <Btn onClick={() => {}} secondary small>
                      Add item
                    </Btn>
                    <Btn onClick={() => {}} secondary small>
                      Save as company checklist
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Documents" && (
              <Card title="Documents" padded>
                <div className="space-y-3">
                  <div className="text-[10px] text-[#4A5568] mb-2">
                    Requested only after acceptance, through the platform's
                    document tool.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse min-w-full">
                      <thead>
                        <tr className="border-b border-[#E5E1D8]">
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                            Document
                          </th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                            Purpose
                          </th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                            Due
                          </th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                            Status
                          </th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                            Visible to
                          </th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((d) => (
                          <tr key={d.id} className="border-b border-[#E5E1D8]">
                            <td className="py-3">
                              <b className="text-xs">{d.name}</b>
                            </td>
                            <td className="py-3 text-xs text-[#4A5568]">
                              {d.purpose}
                            </td>
                            <td className="py-3 text-xs text-[#4A5568]">
                              {d.due}
                            </td>
                            <td className="py-3 text-xs">
                              <StatusChip status={d.status} />
                            </td>
                            <td className="py-3 text-xs text-[#4A5568]">
                              {d.who}
                            </td>
                            <td className="py-3">
                              <Btn onClick={() => {}} secondary small>
                                View
                              </Btn>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Btn onClick={() => {}} small>
                      Request document
                    </Btn>
                    <Btn onClick={() => {}} secondary small>
                      Export to HR system
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Checks" && (
              <Card title="Checks" padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="p-3 rounded-lg border border-[#E5E1D8] bg-white">
                    <div className="flex justify-between items-start mb-1">
                      <b className="text-xs">Reference check</b>
                      <StatusChip status="Clear" />
                    </div>
                    <p className="mb-1">
                      Provider: Checkr · Consent recorded Oct 28
                    </p>
                    <div className="flex gap-2">
                      <Btn onClick={() => {}} secondary small>
                        View result
                      </Btn>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[#E5E1D8] bg-white">
                    <div className="flex justify-between items-start mb-1">
                      <b className="text-xs">Education check</b>
                      <StatusChip status="In progress" />
                    </div>
                    <p className="mb-1">
                      Provider: Verifile · Consent recorded Oct 29
                    </p>
                  </div>
                </div>
              </Card>
            )}
            {tab === "Messages" && (
              <Card title="Messages" padded>
                <p className="text-[11px] text-[#4A5568] mb-3">
                  Secure thread with the new hire. Messages stay on the
                  platform.
                </p>
                <div className="h-[300px] border border-[#E5E1D8] rounded-lg p-3 space-y-3 text-[11px] text-[#4A5568] min-h-[300px] overflow-y-auto">
                  <div className="flex justify-end">
                    <span className="bg-[#E5E1D8] rounded-lg p-2 max-w-[80%]">
                      Thanks for the welcome packet!
                    </span>
                  </div>
                  <div className="flex justify-start">
                    <span className="bg-[#0F1B2D] text-white rounded-lg p-2 max-w-[80%]">
                      We're excited to have you on Dec 2.
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
            {tab === "Notes and activity" && (
              <Card title="Notes and activity" padded>
                <div className="space-y-3 text-[10px] text-[#4A5568]">
                  <div className="flex items-center gap-2">
                    <ClockIcon size={12} className="mt-0.5" />
                    <span>Oct 30 — Offer accepted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClockIcon size={12} className="mt-0.5" />
                    <span>Oct 29 — Documents requested</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DownloadIcon size={12} className="mt-0.5" />
                    <span>Oct 28 — Bank details received</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Card title="Key dates" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Offer accepted</span>
                  <span className="text-[#0F1B2D] font-medium">
                    Oct 30, 2025
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Start date</span>
                  <span className="text-[#0F1B2D] font-medium">
                    Dec 2, 2025
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Probation end</span>
                  <span className="text-[#0F1B2D] font-medium">
                    Mar 2, 2026
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Next check-in</span>
                  <span className="text-[#0F1B2D] font-medium">
                    Jan 2, 2026
                  </span>
                </div>
              </div>
            </Card>
            <Card title="People" padded>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex items-center gap-2">
                  <UserIcon size={13} className="mt-0.5" />
                  <div>
                    <b className="text-xs">Priya Mehta</b>
                    <p className="mt-0.5">Hiring manager</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UserIcon size={13} className="mt-0.5" />
                  <div>
                    <b className="text-xs">Rahul Verma</b>
                    <p className="mt-0.5">Recruiter</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UserIcon size={13} className="mt-0.5" />
                  <div>
                    <b className="text-xs">Aanya Sen</b>
                    <p className="mt-0.5">Buddy</p>
                  </div>
                </div>
              </div>
            </Card>
            <Card title="Hand-off" padded>
              <div className="space-y-3">
                <Btn onClick={() => {}} small className="w-full">
                  Add to team
                </Btn>
                <Btn onClick={() => {}} secondary small className="w-full">
                  Mark as handed off to HR
                </Btn>
                <Btn onClick={() => {}} secondary small className="w-full">
                  Close onboarding
                </Btn>
              </div>
              <div className="mt-3 p-3 rounded-lg border border-[#F3EBDD] bg-[#F3EBDD] text-[10px] text-[#806236]">
                <p>
                  Send a short feedback survey (optional, anonymous option)
                  about the hiring process.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

export { TemplatesPage, HiresPage, HireDetailPage };
