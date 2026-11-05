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
        <b className="text-sm font-semibold">{value}</b>
        {delta && <span className="text-[10px] text-[#286749]">{delta}</span>}
      </div>
    </div>
  );
}

function StatusChip({ status }) {
  const map = {
    Ready: "bg-[#E7F3EC] text-[#286749]",
    Draft: "bg-[#E5E1D8] text-[#4A5568]",
    Unread: "bg-[#F3EBDD] text-[#9A7A45]",
    Read: "bg-[#E5E1D8] text-[#4A5568]",
    Urgent: "bg-[#FDF3E0] text-[#9A6210]",
    Archived: "bg-[#E5E1D8] text-[#4A5568]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium border ${map[status] || map.Draft}`}
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
    <div className="flex flex-col items-center gap-3 text-center py-12">
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

function Tag({ children, variant = "neutral", className = "" }) {
  const base =
    variant === "gold"
      ? "bg-[#F3EBDD] text-[#806236]"
      : variant === "ink"
        ? "bg-[#1C2B42] text-white"
        : "bg-[#E5E1D8] text-[#4A5568]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium border border-transparent ${tagVariant} ${className}`}
    />
  );
}

function ToggleSwitch({ checked, onChange, label, offLabel }) {
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

/* ------------------------------------------------------------------ */
/*  Sample data                                                       */
/* ------------------------------------------------------------------ */
const user = {
  name: "Aanya Sen",
  role: "Job seeker",
  signedIn: true,
  email: "aanya.sen@example.com",
  phone: "+91 98765 43210",
  emailVerified: false,
  phoneVerified: true,
};

const conversations = [
  {
    id: "c-101",
    company: "Northstar Labs",
    logo: "N",
    role: "Senior Product Designer",
    stage: "Interview",
    verified: true,
    preview:
      "Thanks for completing the take-home. We'd like to schedule a final round.",
    time: "10:14 AM",
    unread: 2,
    type: "interview",
    nextTime: "Thu 11:00 AM",
  },
  {
    id: "c-102",
    company: "Morrow Health",
    logo: "M",
    role: "Product Designer",
    stage: "Offer",
    verified: true,
    preview: "Offer v1 received — head to the Offers page to review terms.",
    time: "Yesterday",
    unread: 1,
    type: "offer",
  },
  {
    id: "c-103",
    company: "Fieldnote",
    logo: "F",
    role: "UX Researcher",
    stage: "Shortlisted",
    verified: false,
    preview: "Your application was shortlisted. Next steps coming soon.",
    time: "Mon",
    unread: 0,
    type: "application",
  },
  {
    id: "c-104",
    company: "Support Team",
    logo: "S",
    role: "Account help",
    stage: null,
    verified: true,
    preview: "We've received your ticket and will reply within 1 business day.",
    time: "Fri",
    unread: 0,
    type: "support",
  },
  {
    id: "c-105",
    company: "Verge Studio",
    logo: "V",
    role: "Product Designer",
    stage: "Not selected",
    verified: true,
    preview: "We've decided to move forward with other candidates.",
    time: "Oct 28",
    unread: 0,
    type: "application",
  },
];

const messages = {
  "c-101": [
    {
      id: "m1",
      from: "employer",
      text: "Hi Aanya, thanks for completing the take-home task.",
      time: "10:02 AM",
      read: true,
    },
    {
      id: "m2",
      from: "me",
      text: "You're welcome! I enjoyed working on it.",
      time: "10:05 AM",
      read: true,
    },
    {
      id: "m3",
      from: "employer",
      text: "We'd like to schedule a final round interview.",
      time: "10:12 AM",
      read: false,
    },
    {
      id: "m4",
      from: "me",
      text: "That sounds great. I'm available Thursday afternoon.",
      time: "10:14 AM",
      read: false,
    },
  ],
};

const notifications = [
  {
    id: "n-1",
    category: "Interviews",
    title: "Interview starts in 1 hour",
    detail: "Senior Product Designer — Northstar Labs",
    time: "10:00 AM",
    unread: true,
    urgent: true,
    target: "/jobseeker/interviews",
    icon: Video,
    action: "Join",
  },
  {
    id: "n-2",
    category: "Offers",
    title: "Offer received",
    detail: "Northstar Labs — Senior Product Designer",
    time: "Yesterday",
    unread: true,
    urgent: false,
    target: "/jobseeker/offers",
    icon: Mail,
    action: "Review",
  },
  {
    id: "n-3",
    category: "Applications",
    title: "Application shortlisted",
    detail: "Product Designer — Morrow Health",
    time: "Mon",
    unread: false,
    urgent: false,
    target: "/jobseeker/applications",
    icon: Briefcase,
    action: "View",
  },
  {
    id: "n-4",
    category: "Jobs",
    title: "New jobs matching your saved search",
    detail: "3 new Product Designer roles in Kolkata",
    time: "Mon",
    unread: false,
    urgent: false,
    target: "/jobseeker/alerts",
    icon: Search,
    action: "Browse",
  },
  {
    id: "n-5",
    category: "Resume and practice",
    title: "Feedback report ready",
    detail: "Practice session — Behavioral (STAR)",
    time: "Fri",
    unread: false,
    urgent: false,
    target: "/jobseeker/practice/history",
    icon: FileText,
    action: "Read report",
  },
  {
    id: "n-6",
    category: "Account and billing",
    title: "Security alert — new login",
    detail: "New device signed in from Kolkata",
    time: "Oct 30",
    unread: false,
    urgent: true,
    target: "/jobseeker/settings",
    icon: ShieldAlert,
    action: "Review",
  },
  {
    id: "n-7",
    category: "System",
    title: "Safety alert — scams targeting job seekers",
    detail: "Never pay to apply. Learn how to spot fake jobs.",
    time: "Oct 28",
    unread: false,
    urgent: true,
    target: "/help",
    icon: AlertTriangle,
    action: "Read more",
  },
];

const helpArticles = [
  {
    topic: "Getting started",
    title: "Setting up your profile",
    excerpt:
      "Add your skills, experience and a photo so employers can find you.",
  },
  {
    topic: "Applying",
    title: "One-click apply and tailoring a resume",
    excerpt: "Apply to jobs quickly and tailor your resume to each role.",
  },
  {
    topic: "Applications and interviews",
    title: "Choosing interview times",
    excerpt: "Propose or accept interview slots and join from your dashboard.",
  },
  {
    topic: "Offers",
    title: "Understanding an offer",
    excerpt: "Review salary, equity, start date and request changes.",
  },
  {
    topic: "Resumes and AI",
    title: "How the AI works (facts only)",
    excerpt:
      "The AI suggests drafts using your information; it never makes up facts.",
  },
  {
    topic: "Interview practice",
    title: "Starting a practice session",
    excerpt:
      "Pick a role, interview type and mode, then practice with AI feedback.",
  },
  {
    topic: "Privacy and sharing",
    title: "What employers can see",
    excerpt: "Control discoverability and what shows in talent search.",
  },
  {
    topic: "Safety and scams",
    title: "How to spot fake jobs",
    excerpt: "Real employers never charge fees to apply, interview or onboard.",
  },
  {
    topic: "Account and security",
    title: "Two-factor authentication",
    excerpt: "Add 2FA to protect your account and documents.",
  },
  {
    topic: "Membership and billing",
    title: "Free vs paid plans",
    excerpt: "Compare free and paid features, packs and billing.",
  },
];

const settingsSections = [
  "Account",
  "Security",
  "Profile and visibility",
  "Job preferences",
  "Notifications",
  "Applications and messages",
  "Resumes and AI",
  "Interview practice and data",
  "Membership and billing",
  "Blocked and hidden",
  "Connected accounts",
  "Roles",
  "Data and privacy",
  "Help and legal",
  "Danger zone",
];

/* ------------------------------------------------------------------ */
/*  Role shell                                                        */
/* ------------------------------------------------------------------ */
const jobseekerNav = [
  ["Dashboard", LayoutDashboard, "/jobseeker/dashboard"],
  ["Jobs", Search, "/jobseeker/jobs"],
  ["Saved jobs", Bookmark, "/jobseeker/saved"],
  ["Applications", Briefcase, "/jobseeker/applications"],
  ["Interviews", CalendarDays, "/jobseeker/interviews"],
  ["Resumes", FileText, "/jobseeker/resumes"],
  ["Interview practice", Mic, "/jobseeker/practice"],
  ["Messages", MessageCircle, "/jobseeker/messages"],
];

function JobSeekerShell({ children, active = "Dashboard", className = "" }) {
  const unreadCount = conversations
    .filter((c) => c.unread > 0)
    .reduce((a, c) => a + c.unread, 0);
  return (
    <div className={`min-h-screen bg-[#FAF8F4] text-[#0F1B2D] ${className}`}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col bg-[#0F1B2D] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 font-serif">
            F
          </span>
          <b>
            forma <small className="ml-1 text-white/50">CAREERS</small>
          </b>
        </div>
        <nav className="mt-5 space-y-1 px-3">
          {jobseekerNav.map(([n, I, u]) => {
            const Comp = I;
            const isActive = n === active;
            const unread = n === "Messages" ? unreadCount : 0;
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
                {unread > 0 && (
                  <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-[#B8955A] text-[9px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1 px-3 pb-5">
          <Link
            href="/jobseeker/settings"
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
              AS
            </span>
            <span>
              <b className="block text-xs">{user.name}</b>
              <small className="text-white/50">{user.role} · switch role</small>
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
            placeholder="Search roles or companies"
            className="h-10 w-72 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs"
          />
        </div>
        <span className="text-sm font-semibold sm:hidden">Job seeker</span>
        <button className="relative ml-auto grid h-10 w-10 place-items-center">
          <Bell size={18} />
          {notifications.filter((n) => n.unread).length > 0 && (
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[#B42318] text-[8px] text-white flex items-center justify-center">
              !
            </span>
          )}
        </button>
        <button className="ml-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0F1B2D] text-xs text-white">
            AS
          </span>
          <span className="hidden text-xs sm:block">{user.name}</span>
          <ChevronDown size={14} />
        </button>
      </header>
      <main
        id="candidate-main"
        className="mx-auto max-w-[1400px] px-4 pb-24 pt-7 sm:px-7 lg:ml-[238px] lg:px-8"
      >
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#E5E1D8] bg-white px-2 py-2 lg:hidden">
        {[
          ["Home", "/jobseeker/dashboard", LayoutDashboard],
          ["Jobs", "/jobseeker/jobs", Search],
          ["Applications", "/jobseeker/applications", Briefcase],
          ["Practice", "/jobseeker/practice", Mic],
          ["More", "/jobseeker/settings", UserRound],
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

/* ------------------------------------------------------------------ */
/*  Messages page                                                     */
/* ------------------------------------------------------------------ */
function MessagesPage({ page }) {
  const [filter, setFilter] = useState("All");
  const activeShell = "Messages";
  const [openConv, setOpenConv] = useState("c-101");
  const [viewThread, setViewThread] = useState(true);
  const [composer, setComposer] = useState("");
  const [flagged, setFlagged] = useState(false);
  const filters = [
    "All",
    "Employers",
    "Interviews",
    "Offers",
    "Invitations",
    "Admin and support",
    "Unread",
    "Archived",
  ];
  const conv = conversations.find((c) => c.id === openConv) || conversations[0];
  const thread = messages[openConv] || [];

  const stageChip = (stage) => {
    const colors = {
      Applied: "border-[#E5E1D8] text-[#4A5568]",
      Shortlisted: "border-[#F3EBDD] text-[#9A7A45]",
      Interview: "border-[#F3EBDD] text-[#9A7A45]",
      Offer: "border-[#E7F3EC] text-[#286749]",
      Hired: "border-[#E7F3EC] text-[#286749]",
      "Not selected": "border-[#E5E1D8] text-[#4A5568]",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${colors[stage] || colors.Applied}`}
      >
        {stage}
      </span>
    );
  };

  return (
    <JobSeekerShell active={activeShell} page={page}>
      {/* Safety banner */}
      {!user.emailVerified && (
        <div className="mx-auto max-w-[1400px] px-4 sm:px-7 mb-4">
          <Card title="Verify your email" padded>
            <p className="text-xs text-[#4A5568] mb-3">
              Verify your email to hear from employers. New employer
              conversations are read-only until verified.
            </p>
            <Btn onClick={() => {}}>Resend email</Btn>
          </Card>
        </div>
      )}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-7 ">
        <SectionHead
          title="Messages"
          subtitle="Conversations with employers, recruiters, interviews, offers and support."
        >
          <Btn onClick={() => {}}>New message</Btn>
        </SectionHead>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr_280px] mt-4">
          {/* Left: conversation list */}
          <div className="hidden lg:block lg:col-span-1 space-y-3">
            <Card title="Conversations" padded>
              <div className="flex items-center gap-2 mb-3">
                <Search size={14} className="text-[#4A5568]" />
                <input
                  placeholder="Search companies, jobs, messages"
                  className="flex-1 h-8 border border-[#E5E1D8] rounded-lg bg-white pl-7 text-[11px] focus:border-[#B8955A] outline-none"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto mb-3 pb-1">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-[10px] transition ${filter === f ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:bg-white"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                {conversations
                  .filter(
                    (c) =>
                      filter === "All" ||
                      (filter === "Unread" && c.unread > 0) ||
                      c.type === filter.toLowerCase(),
                  )
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setOpenConv(c.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border border-transparent transition ${openConv === c.id ? "bg-[#F3EBDD] border-[#E5E1D8]" : "hover:bg-[#F4F1EA] border-transparent"}`}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#1C2B42] text-[10px] font-semibold text-white">
                        {c.logo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <b className="text-xs truncate">{c.company}</b>
                          {c.verified && (
                            <span className="text-[9px] text-[#286749] font-medium">
                              Verified employer
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <b className="text-[10px] text-[#0F1B2D] truncate">
                            {c.role}
                          </b>
                          {c.stage && (
                            <>
                              {" · "}
                              <span className="text-[9px] text-[#4A5568]">
                                {c.stage}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-[10px] text-[#4A5568] line-clamp-1 mt-0.5">
                          {c.preview}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] text-[#4A5568]">
                          {c.time}
                        </span>
                        {c.unread > 0 && (
                          <span className="h-2 w-2 rounded-full bg-[#B8955A]" />
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </Card>
          </div>

          {/* Center: thread */}
          <div className={`lg:col-span-1 ${RADIUS_CARD} border border-[#E5E1D8] bg-white flex flex-col min-h-[400px] flex-1`}>
            {viewThread ? (
              <>
                <div className="border-b border-[#E5E1D8] px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1C2B42] text-[10px] font-semibold text-white">
                        {conv.logo}
                      </span>
                      <div>
                        <b className="text-sm font-semibold">{conv.company}</b>
                        {conv.verified && (
                          <span className="ml-1 inline-flex items-center rounded-full border border-[#286749] bg-[#E7F3EC] px-2 py-0.5 text-[9px] text-[#286749] font-medium">
                            Verified employer
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-[#4A5568] mt-1">
                      {conv.role} · {conv.stage}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Btn onClick={() => {}} secondary small>
                      View job
                    </Btn>
                    <Btn onClick={() => {}} secondary small>
                      Open application
                    </Btn>
                    {conv.type === "interview" && (
                      <Btn onClick={() => {}} secondary small>
                        Join
                      </Btn>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {thread.length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-[#4A5568]">
                      No messages yet.
                    </div>
                  ) : (
                    thread.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.from === "employer" ? "items-start" : "items-end justify-end"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 text-[11px] leading-relaxed ${m.from === "employer" ? "bg-[#E5E1D8] text-[#0F1B2D] rounded-tr-none" : "bg-[#0F1B2D] text-white rounded-tl-none"}`}
                        >
                          {m.text}
                          <br />
                          <span className="block mt-1 text-[9px] opacity-60">
                            {m.time}{" "}
                            {m.read && (
                              <Check size={10} className="mr-1 inline" />
                            )}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-[#E5E1D8] p-4">
                  <p className="text-[9px] text-[#4A5568] mb-3">
                    Keep your conversation on the platform. Never pay money or
                    share bank details with an employer.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      placeholder="Write a message…"
                      className="flex-1 h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 text-[11px] focus:border-[#B8955A] outline-none"
                    />
                    <Btn onClick={() => {}}>Send</Btn>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[9px] text-[#4A5568]">
                    <Btn onClick={() => {}} secondary small className="px-2">Insert</Btn>
                    <span>·</span>
                    <span>
                      Templates: Thank you · Next steps · Follow-up · Reschedule
                      · Decline
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon={Inbox}
                title="Select a conversation"
                subtitle="Pick a conversation on the left to read and reply."
              />
            )}
          </div>

          {/* Right: context panel */}
          <div className="hidden lg:block lg:col-span-1 space-y-3">
            <Card title="Job and company" padded>
              <div className="flex items-center gap-3 mb-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1C2B42] text-[10px] font-semibold text-white">
                  {conv.logo}
                </span>
                <div>
                  <b className="text-sm font-semibold">{conv.company}</b>
                  {conv.verified && (
                    <span className="ml-1 inline-flex items-center rounded-full border border-[#286749] bg-[#E7F3EC] px-2 py-0.5 text-[9px] text-[#286749] font-medium">
                      Verified employer
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-[#4A5568] mb-2">{conv.role}</p>
              <div className="space-y-1 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Stage</span>
                  <span>{stageChip(conv.stage)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Location</span>
                  <span>Kolkata, West Bengal</span>
                </div>
                <div className="flex justify-between">
                  <span>Work mode</span>
                  <span>Hybrid</span>
                </div>
              </div>
            </Card>
            <Card title="Application" padded>
              <div className="space-y-2 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Applied</span>
                  <span>Oct 12</span>
                </div>
                <div className="flex justify-between">
                  <span>Resume version</span>
                  <span>Product Designer v2</span>
                </div>
                <div className="flex justify-between">
                  <span>Next step</span>
                  <span>Final interview — Thu 11:00 AM</span>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Btn onClick={() => {}} small className="w-full">
                  Open application
                </Btn>
                <Btn onClick={() => {}} secondary small className="w-full">
                  Practice for this job
                </Btn>
                <Btn onClick={() => {}} secondary small className="w-full">
                  Add private note
                </Btn>
                <Btn
                  onClick={() => {}}
                  secondary
                  small
                  className="w-full text-[#B42318]"
                >
                  Request to withdraw
                </Btn>
              </div>
            </Card>
            <Card title="Shared files" padded>
              <p className="text-[10px] text-[#4A5568] mb-2">
                No shared files yet.
              </p>
            </Card>
            <Card title="Quick actions" padded>
              <div className="space-y-2">
                <Btn
                  onClick={() => {}}
                  secondary
                  small
                  className="w-full text-[#B42318]"
                >
                  Block employer
                </Btn>
                <Btn
                  onClick={() => {}}
                  secondary
                  small
                  className="w-full text-[#B42318]"
                >
                  Report
                </Btn>
              </div>
            </Card>
          </div>
        </div>
      </div>
      {/* Scam safety strip */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-7 mt-6">
        <Card title padded className="bg-[#FDF3E0] border-[#F3EBDD]">
          <div className="flex items-start gap-3 px-6 pt-4 pb-5">
            <AlertTriangle size={14} className="text-[#9A6210] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-[#806236]">
                Never pay to apply or start a job.
              </p>
              <p className="text-[10px] text-[#4A5568] mt-0.5">
                Real employers don't ask you to pay for training, equipment,
                background checks or "processing" fees. Report suspicious
                messages.
              </p>
            </div>
          </div>
          <div className="flex gap-2 px-6 pt-2 pb-5">
            <Btn onClick={() => {}} small className="px-3">
              Report
            </Btn>
            <Btn onClick={() => {}} secondary small className="px-3">
              Block
            </Btn>
          </div>
        </Card>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Notifications page                                                */
/* ------------------------------------------------------------------ */
function NotificationsPage({ page }) {
  const tabs = [
    "All",
    "Unread",
    "Jobs",
    "Applications",
    "Interviews",
    "Offers",
    "Resume and practice",
    "Account and billing",
    "System",
  ];
  const [tab, setTab] = useState("All");
  const grouped = useMemo(() => {
    const today = notifications.filter(
      (n) =>
        n.time === "10:00 AM" || n.time === "Yesterday" || n.time === "Mon",
    );
    const earlier = notifications.filter(
      (n) => n.time === "Fri" || n.time === "Oct 30" || n.time === "Oct 28",
    );
    return {
      Today: notifications.filter((n) =>
        ["10:00 AM", "Yesterday", "Mon"].includes(n.time),
      ),
      Earlier: earlier,
    };
  }, [tab]);
  const filtered = notifications.filter(
    (n) => tab === "All" || n.category === tab,
  );

  return (
    <JobSeekerShell active="Dashboard" page={page}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-7 ">
        <SectionHead
          title="Notifications"
          subtitle="Job seeker events: alerts, applications, interviews, offers, resumes, practice and billing."
        >
          <div className="flex gap-2">
            <Btn onClick={() => {}} small>
              Mark all as read
            </Btn>
            <Btn onClick={() => {}} secondary small>
              Preferences
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
        <div className="space-y-6">
          {["Today", "Earlier"].map((group) => {
            const items = grouped[group].filter(
              (n) => tab === "All" || n.category === tab,
            );
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="text-[10px] text-[#4A5568] font-medium uppercase tracking-wide px-4">
                  {group}
                </h3>
                <div className="space-y-1">
                  {items.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border border-transparent transition ${n.urgent ? "bg-[#FDF3E0] border-[#F3EBDD]" : "hover:bg-[#F4F1EA]"}`}
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#E5E1D8] mt-0.5 flex-shrink-0">
                        <n.icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <b className="text-xs">{n.title}</b>
                          {n.unread && (
                            <span className="h-2 w-2 rounded-full bg-[#B8955A]" />
                          )}
                          {n.urgent && (
                            <span className="text-[9px] text-[#9A6210] font-medium">
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#4A5568] line-clamp-2">
                          {n.detail}
                        </p>
                        <span className="text-[9px] text-[#4A5568] mt-1 block">
                          {n.time}
                        </span>
                      </div>
                      <div className="flex items-end gap-2">
                        <Btn
                          onClick={() => {}}
                          secondary
                          small
                          className="min-w-[72px]"
                        >
                          {n.action}
                        </Btn>
                        <button
                          onClick={() => {}}
                          className="p-1 text-[#4A5568] hover:text-[#0F1B2D]"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-[#4A5568] mt-8">
          Notifications never include salary figures, offer amounts, resume text
          or practice scores in email or push text. Security, safety and
          billing-failure alerts cannot be muted.
        </p>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings page                                                     */
/* ------------------------------------------------------------------ */
function SettingsPage({ page }) {
  const [section, setSection] = useState("Account");
  return (
    <JobSeekerShell active="Settings" page={page}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-7 ">
        {!user.emailVerified && (
          <Card title padded className="bg-[#FDF3E0] border-[#F3EBDD] mb-4">
            <div className="flex items-start gap-3 px-6 pt-4 pb-3">
              <AlertCircle size={14} className="text-[#9A6210] mt-0.5" />
              <div>
                <p className="text-xs font-medium text-[#806236]">
                  Verify your email
                </p>
                <p className="text-[10px] text-[#4A5568] mt-0.5">
                  Email-based settings are limited until you verify your email
                  address.
                </p>
              </div>
            </div>
            <div className="px-6 pt-2 pb-4">
              <Btn onClick={() => {}} small>
                Resend email
              </Btn>
            </div>
          </Card>
        )}
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            {/* Left nav hidden on mobile, stacks below on tablet */}
          {/* Left section menu */}
          <nav className="lg:col-span-1 space-y-1">
            {settingsSections.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition ${section === s ? "bg-[#1C2B42] text-white" : "text-[#4A5568] hover:bg-[#F4F1EA] hover:text-[#0F1B2D]"}`}
              >
                {s === "Account" && <UserIcon size={15} />}
                {s === "Security" && <Shield size={15} />}
                {s === "Profile and visibility" && <Users size={15} />}
                {s === "Job preferences" && <Target size={15} />}
                {s === "Notifications" && <Bell size={15} />}
                {s === "Applications and messages" && <Mail size={15} />}
                {s === "Resumes and AI" && <FileText size={15} />}
                {s === "Interview practice and data" && <Mic size={15} />}
                {s === "Membership and billing" && <CreditCard size={15} />}
                {s === "Blocked and hidden" && <BlockIcon size={15} />}
                {s === "Connected accounts" && <LinkIcon size={15} />}
                {s === "Roles" && <GitBranch size={15} />}
                {s === "Data and privacy" && <HardHat size={15} />}
                {s === "Help and legal" && <HelpCircle size={15} />}
                {s === "Danger zone" && <AlertTriangle size={15} />}
                {s}
              </button>
            ))}
          </nav>

          {/* Right content */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-sm font-serif font-semibold">{section}</h2>
            {section === "Account" && (
              <Card title="Account details" padded>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Full name
                    </label>
                    <input
                      defaultValue={user.name}
                      className="field text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Email
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        defaultValue={user.email}
                        className="field text-[12px] flex-1"
                      />
                      {!user.emailVerified && (
                        <span className="text-[9px] text-[#9A6210] font-medium">
                          Unverified
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#4A5568] mt-1">
                      Changing email requires re-authentication.
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#4A5568] block mb-1">
                      Phone
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        defaultValue={user.phone}
                        className="field text-[12px] flex-1"
                      />
                      {user.phoneVerified && (
                        <span className="text-[9px] text-[#286749] font-medium">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2 text-[10px] text-[#4A5568]">
                    <div className="flex items-center gap-2">
                      <Clock size={12} /> Language: English (India)
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays size={12} /> Time zone: Asia/Kolkata
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard size={12} /> Currency: INR
                    </div>
                  </div>
                </div>
              </Card>
            )}
            {section === "Security" && (
              <Card title="Security" padded>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <b className="text-xs">Password</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Change your account password.
                      </p>
                    </div>
                    <Btn onClick={() => {}} small>
                      Change
                    </Btn>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <b className="text-xs">Two-factor authentication</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Add 2FA to protect your account and documents.
                      </p>
                    </div>
                    <Btn onClick={() => {}} small>
                      Enable
                    </Btn>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <b className="text-xs">Active sessions and devices</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Kolkata — Chrome (current), Delhi — Safari.
                      </p>
                    </div>
                    <Btn onClick={() => {}} secondary small>
                      Sign out everywhere
                    </Btn>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <b className="text-xs">Recent security activity</b>
                      <p className="text-[10px] text-[#4A5568]">
                        New login Oct 30 from Kolkata.
                      </p>
                    </div>
                    <Btn onClick={() => {}} secondary small>
                      View activity
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
            {section === "Profile and visibility" && (
              <Card title="Discoverability" padded>
                <div className="space-y-3">
                  {[
                    "Not discoverable (default)",
                    "Discoverable by verified employers",
                    "Open to invitations only",
                  ].map((opt) => (
                    <div
                      key={opt}
                      className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white cursor-pointer"
                    >
                      <input
                        type="radio"
                        className="mt-0.5"
                        defaultChecked={opt === "Not discoverable (default)"}
                      />
                      <div>
                        <b className="text-xs">{opt}</b>
                        <p className="text-[10px] text-[#4A5568] mt-0.5">
                          {opt === "Not discoverable (default)"
                            ? "Employers see you only after you apply."
                            : opt === "Discoverable by verified employers"
                              ? "Employers can find your profile in talent search."
                              : "Not searchable, but verified employers you've interacted with can invite you."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Section title="What employers can see (when discoverable)">
                  <div className="space-y-2">
                    {[
                      "Headline",
                      "Skills",
                      "Experience level",
                      "Location (city/region)",
                      "Expected salary range",
                      "Work mode",
                      "Availability",
                      "Resume summary",
                    ].map((f) => (
                      <div
                        key={f}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[#4A5568]">{f}</span>
                        <ToggleSwitch
                          checked={
                            ![
                              "Full name",
                              "Photo",
                              "Exact location",
                              "Contact details",
                              "Current employer",
                              "Education",
                            ].includes(f)
                          }
                          onChange={() => {}}
                        />
                      </div>
                    ))}
                    <p className="text-[10px] text-[#4A5568] mt-2">
                      Hidden by default: full name, photo, exact location,
                      contact details, current employer, education institution
                      names.
                    </p>
                  </div>
                </Section>
              </Card>
            )}
            {section === "Notifications" && (
              <Card title="Notification preferences" padded>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E1D8]">
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Category
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          In-app
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Email
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Push
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Saved search alerts and new jobs", true, true, false],
                        ["Daily recommendations", true, false, false],
                        [
                          "Saved job reminders and closing soon",
                          true,
                          true,
                          false,
                        ],
                        ["Application updates", true, true, true],
                        ["Employer messages and invitations", true, true, true],
                        ["Interviews", true, true, true],
                        ["Offers", true, true, true],
                        ["Documents requested", true, true, false],
                        ["Resume tips and reminders", true, false, false],
                        ["Interview practice", true, false, true],
                        ["Billing and receipts", true, true, false],
                        ["Product updates and tips", true, false, false],
                        ["Safety and scam alerts", true, true, true],
                        ["Security alerts", true, true, true],
                      ].map(([cat, app, email, push]) => (
                        <tr key={cat} className="border-b border-[#E5E1D8]">
                          <td className="py-3 text-xs">
                            {cat}
                            {(!app || !email) && " <muted>"}
                          </td>
                          <td className="py-3 text-center">
                            <ToggleSwitch checked={app} onChange={() => {}} />
                          </td>
                          <td className="py-3 text-center">
                            <ToggleSwitch checked={email} onChange={() => {}} />
                          </td>
                          <td className="py-3 text-center">
                            <ToggleSwitch checked={push} onChange={() => {}} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Section title="Digest and quiet hours">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#4A5568]">Digest</span>
                      <select className="h-8 rounded-lg border border-[#E5E1D8] bg-white pl-2 text-[11px] focus:border-[#B8955A] outline-none">
                        <option>Instant</option>
                        <option>Daily at a chosen time</option>
                        <option>Weekly</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#4A5568]">
                        Quiet hours
                      </span>
                      <span className="text-xs text-[#0F1B2D]">
                        9 PM – 8 AM (urgent alerts excepted)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#4A5568]">
                        Interview reminder timing
                      </span>
                      <span className="text-xs text-[#0F1B2D]">
                        10 min, 1 hour, 1 day
                      </span>
                    </div>
                  </div>
                </Section>
              </Card>
            )}
            {section === "Interview practice and data" && (
              <Card title="Practice data controls" padded>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-xs">Delivery analysis default</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Off by default; opt in per session.
                      </p>
                    </div>
                    <ToggleSwitch checked={false} onChange={() => {}} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-xs">Save recordings by default</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Off by default.
                      </p>
                    </div>
                    <ToggleSwitch checked={false} onChange={() => {}} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-xs">Keep transcripts by default</b>
                      <p className="text-[10px] text-[#4A5568]">
                        On by default.
                      </p>
                    </div>
                    <ToggleSwitch checked={true} onChange={() => {}} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-xs">Auto-delete recordings</b>
                      <p className="text-[10px] text-[#4A5568]">
                        After 30 days.
                      </p>
                    </div>
                    <select className="h-8 rounded-lg border border-[#E5E1D8] bg-white pl-2 text-[11px] focus:border-[#B8955A] outline-none">
                      <option>Never</option>
                      <option>7 days</option>
                      <option>30 days</option>
                      <option>90 days</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-xs">
                        Share readiness score with employers
                      </b>
                      <p className="text-[10px] text-[#4A5568]">
                        Off by default; per application.
                      </p>
                    </div>
                    <ToggleSwitch checked={false} onChange={() => {}} />
                  </div>
                  <div className="pt-3 border-t border-[#E5E1D8] space-y-2">
                    <Btn
                      onClick={() => {}}
                      secondary
                      small
                      className="w-full text-[#B42318]"
                    >
                      Delete all recordings
                    </Btn>
                    <Btn
                      onClick={() => {}}
                      secondary
                      small
                      className="w-full text-[#B42318]"
                    >
                      Delete all practice data
                    </Btn>
                    <Btn onClick={() => {}} secondary small className="w-full">
                      Pause practice tracking
                    </Btn>
                  </div>
                  <p className="text-[10px] text-[#4A5568] mt-3">
                    Full controls:{" "}
                    <a
                      href="/jobseeker/practice/rubric"
                      className="text-[#B8955A] underline"
                    >
                      Scoring Rubric & Privacy
                    </a>
                  </p>
                </div>
              </Card>
            )}
            {section === "Danger zone" && (
              <Card title="Danger zone" padded>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-xs">Pause my job search</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Hides your profile and stops alerts and invitations.
                      </p>
                    </div>
                    <Btn onClick={() => {}} secondary small>
                      Pause
                    </Btn>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-xs">Close the job seeker role</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Withdraw or complete active applications first.
                      </p>
                    </div>
                    <Btn
                      onClick={() => {}}
                      secondary
                      small
                      className="text-[#B42318]"
                    >
                      Close role
                    </Btn>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-xs">Delete account</b>
                      <p className="text-[10px] text-[#4A5568]">
                        Re-authentication required.
                      </p>
                    </div>
                    <Btn
                      onClick={() => {}}
                      secondary
                      small
                      className="text-[#B42318]"
                    >
                      Delete account
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
            {![
              "Account",
              "Security",
              "Profile and visibility",
              "Notifications",
              "Interview practice and data",
              "Danger zone",
            ].includes(section) && (
              <EmptyState
                icon={Settings}
                title={section}
                subtitle="Controls for this section appear here. Select a section on the left."
              />
            )}
          </div>
        </div>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Help and Support page                                             */
/* ------------------------------------------------------------------ */
function HelpPage({ page }) {
  const [query, setQuery] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  return (
    <JobSeekerShell active="Help" page={page}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-7 ">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-sm font-serif font-serif font-semibold">
              Help and Support
            </h2>
            <p className="text-[10px] text-[#4A5568]">
              Search help for job seekers
            </p>
          </div>
          <Btn onClick={() => {}}>Report a scam or fake job</Btn>
        </div>
        <div className="relative mb-6">
          <Search
            size={16}
            className="absolute left-3 top-2.5 text-[#A0A7B4]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help for job seekers…"
            className="field pl-9 text-[12px]"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {/* Topic cards */}
          <div className="lg:col-span-3 space-y-3">
            {[
              [
                "Getting started",
                "Profile setup, resume import, job preferences, email verification",
              ],
              [
                "Finding jobs",
                "Filters, saved searches, alerts, recommendations, startups",
              ],
              [
                "Applying",
                "One-click apply, tailoring resumes, screening questions",
              ],
              [
                "Applications and interviews",
                "Stages, choosing times, preparing, following up",
              ],
              [
                "Offers",
                "Understanding an offer, changes, comparing, accepting",
              ],
              [
                "Resumes and AI",
                "Building resumes, AI facts-only, ATS checks, exporting",
              ],
              [
                "Interview practice",
                "Sessions, modes, feedback, drills, readiness score",
              ],
              [
                "Privacy and sharing",
                "Discoverability, blocking employers, deleting data",
              ],
              [
                "Membership and billing",
                "Free vs paid, packs, invoices, refunds",
              ],
              [
                "Safety and scams",
                "Spotting fake jobs, verified employers, reporting",
              ],
              [
                "Fairness and conduct",
                "Reporting discrimination, community guidelines",
              ],
              ["Account and security", "Roles, passwords, 2FA, data download"],
            ].map(([topic, desc]) => (
              <div
                key={topic}
                className={
                  RADIUS_CARD +
                  " border border-[#E5E1D8] bg-white p-4 hover:border-[#B8955A] transition cursor-pointer"
                }
              >
                <b className="text-xs font-semibold">{topic}</b>
                <p className="text-[10px] text-[#4A5568] mt-1">{desc}</p>
              </div>
            ))}
          </div>
          {/* Contact panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card title="Contact support" padded>
              <p className="text-[10px] text-[#4A5568] mb-3">
                We usually reply within 1 business day. Scam and safety reports
                are reviewed first.
              </p>
              <Btn onClick={() => setTicketOpen(true)}>New ticket</Btn>
              <p className="text-[10px] text-[#4A5568] mt-3">
                Priority support shown if your plan includes it.
              </p>
            </Card>
            <Card title="Popular articles" padded>
              <div className="space-y-2">
                {helpArticles.slice(0, 6).map((a) => (
                  <div key={a.title} className="flex items-start gap-2">
                    <span className="mt-0.5 text-[9px] text-[#4A5568]">Q</span>
                    <div>
                      <b className="text-xs">{a.title}</b>
                      <p className="text-[10px] text-[#4A5568] mt-0.5">
                        {a.excerpt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
        <div className="mt-8 border-t border-[#E5E1D8] pt-6">
          <h3 className="text-xs font-semibold text-[#4A5568] uppercase tracking-wide mb-4">
            Safety and scam center
          </h3>
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              "Real employers don't charge fees to apply, interview, train or onboard.",
              "Check the Verified employer badge and the company page.",
              "Be careful of unrealistic salaries, very fast offers, vague descriptions.",
              "Don't share ID, bank details, passwords or OTPs before a verified offer.",
              "Verify offers through the company's official website, not message links.",
              "Stop contact, don't pay, keep screenshots, report it.",
            ].map((tip) => (
              <div
                key={tip}
                className={
                  RADIUS_CARD + " border border-[#E5E1D8] bg-white p-3"
                }
              >
                <AlertCircle size={13} className="text-[#9A7A45] mb-2" />
                <p className="text-[10px] text-[#4A5568]">{tip}</p>
              </div>
            ))}
          </div>
        </div>
        {ticketOpen && (
          <div
            className={
              RADIUS_CARD +
              " border border-[#E5E1D8] bg-white p-6 mt-8 shadow-lg"
            }
          >
            <h3 className="text-sm font-semibold mb-4">New support ticket</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Category
                </label>
                <select className="field text-[12px]">
                  <option>Safety and scams</option>
                  <option>Applications</option>
                  <option>Offers</option>
                  <option>Account</option>
                  <option>Billing</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Related item
                </label>
                <select className="field text-[12px]">
                  <option>None</option>
                  <option>Job — Senior Product Designer</option>
                  <option>Application — Morrow Health</option>
                  <option>Interview — Northstar Labs</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#4A5568] block mb-1">
                  Description (20–2,000 characters)
                </label>
                <textarea
                  className="field h-32 text-[12px] resize-none"
                  placeholder="What can we help you with?"
                ></textarea>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#4A5568]">
                <input type="file" className="hidden" />
                <Btn onClick={() => {}} secondary small>
                  Attach up to 5 files (10 MB each)
                </Btn>
                <span>· Normal · Urgent (scams, safety, payments)</span>
              </div>
              <div className="flex gap-2">
                <Btn onClick={() => setTicketOpen(false)} secondary>
                  Cancel
                </Btn>
                <Btn onClick={() => {}}>Submit ticket</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </JobSeekerShell>
  );
}

/* small icon used only inside settings radio fallback */
function BlockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="9" x2="9" y2="15" />
      <line x1="15" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export { MessagesPage, NotificationsPage, SettingsPage, HelpPage };
