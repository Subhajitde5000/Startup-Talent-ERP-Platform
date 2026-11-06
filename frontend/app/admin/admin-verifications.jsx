"use client";
import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Link as LinkIcon,
  Edit,
  Lock,
  Settings,
  HelpCircle,
  Mail,
  MessageCircle,
  Shield,
  ShieldAlert as ShieldAlertIcon,
  Banknote,
  Ticket,
  Target,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Gauge,
  Scale,
  LayoutGrid,
  LayoutList,
  Inbox,
  Paperclip,
  Image as ImageIcon,
  Video,
  Phone,
  Headphones,
  Globe,
  GitBranch,
  Code,
  Folder,
  Archive,
  Zap,
  Award,
  Share2,
  RotateCcw,
  Link2,
  User2,
  Layout,
  PanelLeft,
  ClipboardList,
  AreaChart,
  CandlestickChart,
  Thermometer,
  Heart,
  Speaker,
  Mic,
  Camera,
  Key,
  LayoutDashboard,
  Bolt,
  Cpu,
  Database,
  UserCheck,
  UserX,
  UserPlus,
  UserMinus,
  UserCircle,
  UserCircle2,
  Wrench,
  Building as BuildingIcon,
  Briefcase as BriefcaseIcon,
  Monitor as MonitorIcon,
  Activity as ActivityIcon,
  File as FileIcon,
  User as UserIcon,
  Calendar as CalendarIcon,
  RefreshCcw,
  List,
  BarChart3,
  PieChart,
  UserRound,
  ShieldCheck,
  Bell,
  ChevronLeft,
  ChevronUp,
  Menu,
  MoreHorizontal,
  User as User2Icon,
  Tag,
  HardHat,
  Stethoscope,
  Briefcase as Briefcase2Icon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design tokens (matching admin-dashboard-design.md Part 2)         */
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
const ERROR_DARK = "#8E1A12";
const INFO = "#2F5D8A";
const INFO_TINT = "#E8F0F8";

const RADIUS_CARD = "rounded-[12px]";
const RADIUS_CONTROL = "rounded-[10px]";

/* ------------------------------------------------------------------ */
/*  Mock user / roles (server enforces in production)                 */
/* ------------------------------------------------------------------ */
const user = {
  name: "Alex Kumar",
  internalRole: "Verification reviewer",
  internalRoles: ["Verification reviewer", "Super admin"],
  sessionExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  idleTimeoutAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
};

const environment = "production";

/* ------------------------------------------------------------------ */
/*  Simple toast                                                      */
/* ------------------------------------------------------------------ */
let toastListeners = [];
export function onToast(listener) {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter((l) => l !== listener);
  };
}
function toast(msg) {
  toastListeners.forEach((l) => l(msg));
}

/* ------------------------------------------------------------------ */
/*  Shared UI primitives (12px+, WCAG AA, overflow-x-auto tables)     */
/* ------------------------------------------------------------------ */

function Card({ title, titleIcon: TitleIcon, padded = true, className = "", children }) {
  const padding = padded ? "p-5" : "p-0";
  return (
    <section className={`border border-solid ${RADIUS_CARD} bg-white ${className} ${padding}`}>
      {title && (
        <div className="flex items-center justify-between mb-4 border-b border-solid border-[#E5E1D8] pb-3">
          <div className="flex items-center gap-2">
            {TitleIcon && <TitleIcon size={15} className="text-[#4A5568]" />}
            <h3 className="text-[15px] font-semibold">{title}</h3>
          </div>
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

function Btn({
  children,
  onClick,
  secondary,
  small,
  destructive,
  type = "button",
  className = "",
  icon: IconComp,
}) {
  const handleClick = (e) => {
    e.preventDefault();
    if (onClick) onClick(e);
  };
  return (
    <button
      type={type}
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 ${RADIUS_CONTROL} border border-transparent bg-white px-3 py-2 text-[12px] font-medium text-[#0F1B2D] transition ${secondary
        ? `border-[#E5E1D8] text-[#4A5568] bg-[#F4F1EA] hover:bg-[#F3EBDD]`
        : destructive
          ? `border-[#FBE9E7] text-[#B42318] hover:bg-[#FBE9E7]`
          : `bg-[#0F1B2D] text-white hover:bg-[#1C2B42]`} ${small
        ? "px-2 py-1.5 text-[11px] min-w-[72px]"
        : "px-4 py-2 text-[12px] min-w-[80px]"} ${className}`}
    >
      {IconComp && <span className="flex-shrink-0"><IconComp /></span>}
      {children}
    </button>
  );
}

function BtnIcon({ onClick, secondary, size, className = "", icon: IconComp, title, destructive }) {
  const handleClick = (e) => {
    e.preventDefault();
    if (onClick) onClick(e);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center ${RADIUS_CONTROL} border border-transparent ${secondary
        ? `border-[#E5E1D8] text-[#4A5568] bg-[#F4F1EA] hover:bg-[#F3EBDD]`
        : destructive
          ? `border-[#FBE9E7] text-[#B42318] hover:bg-[#FBE9E7]`
          : `bg-[#0F1B2D] text-white hover:bg-[#1C2B42]`} ${size === "small"
        ? "h-8 w-8 p-0"
        : "h-10 w-10 p-0"} ${className}`}
      aria-label={title}
    >
      <IconComp size={size === "small" ? 13 : 16} />
    </button>
  );
}

function StatChip({ status, count }) {
  const maps = {
    submitted: `border-[#E5E1D8] text-[#4A5568]`,
    "in-review": `border-[#E5E1D8] text-[#4A5568]`,
    "waiting-for-applicant": `border-[#E8F0F8] bg-[#E8F0F8] text-[#2F5D8A]`,
    "second-review-needed": `border-[#F3EBDD] bg-[#F3EBDD] text-[#806236]`,
    "on-hold": `border-[#E5E1D8] text-[#4A5568]`,
    approved: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    rejected: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    withdrawn: `border-[#E5E1D8] text-[#4A5568]`,
    expired: `border-[#E5E1D8] text-[#4A5568]`,
    onTrack: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    atRisk: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    breached: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    low: `border-[#E5E1D8] text-[#4A5568]`,
    medium: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    high: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    passed: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    "needs-attention": `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    failed: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    "not-run": `border-[#E5E1D8] text-[#4A5568]`,
    waived: `border-[#E5E1D8] text-[#4A5568]`,
    "provider-error": `border-[#FDF3E0] text-[#9A6210]`,
  };
  const label =
    status === "submitted" ? "Submitted" :
    status === "in-review" ? "In review" :
    status === "waiting-for-applicant" ? "Waiting for applicant" :
    status === "second-review-needed" ? "Second review" :
    status === "on-hold" ? "On hold" :
    status === "onTrack" ? "On track" :
    status === "atRisk" ? "At risk" :
    status === "breached" ? "Breached" :
    status.replace("-", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${maps[status] || maps.submitted}`}
    >
      {label}
    </span>
  );
}

function SectionHead({ title, subtitle, children, className = "" }) {
  return (
    <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${className}`}>
      <div>
        <h2 className="text-[28px] font-serif font-semibold">{title}</h2>
        {subtitle && <p className="text-[12px] text-[#4A5568] mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center py-12">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-[#F3EBDD]">
        <Icon size={24} />
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="text-[12px] text-[#4A5568] max-w-[260px]">{subtitle}</p>
      {action && <Btn onClick={action}>{actionLabel}</Btn>}
    </div>
  );
}

function SkeletonCard({ className = "" }) {
  return (
    <div className={`h-48 rounded-[12px] bg-[#E5E1D8] animate-pulse ${className}`} />
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
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

function DetailDrawer({ open, onClose, title, children, className = "" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[720px] h-full flex flex-col bg-white border-l border-solid border-[#E5E1D8] shadow-lg ml-auto">
        <div className="flex items-center justify-between border-b border-solid border-[#E5E1D8] px-6 py-4 bg-[#FAF8F4]">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <BtnIcon size="small" secondary icon={X} title="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function formatAge(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function relativeTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Mock verification queue data (Part A.7 data contract shape)       */
/* ------------------------------------------------------------------ */

const typeTabs = [
  { key: "all", label: "All" },
  { key: "startup", label: "Startups" },
  { key: "mentor", label: "Mentors" },
  { key: "investor", label: "Investors" },
  { key: "employer", label: "Employers" },
];

const statusFilters = [
  { key: "all", label: "All statuses" },
  { key: "submitted", label: "Submitted" },
  { key: "in-review", label: "In review" },
  { key: "waiting-for-applicant", label: "Waiting for applicant" },
  { key: "second-review-needed", label: "Second review" },
  { key: "on-hold", label: "On hold" },
];

const verifications = [
  {
    id: "VER-2026-004812",
    type: "employer",
    typeLabel: "Employer",
    typeIcon: BriefcaseIcon,
    applicant: { displayName: "Acme Talent Pvt Ltd", region: "KA" },
    status: "submitted",
    risk: { tier: "medium", flags: ["domain_mismatch"] },
    autoChecks: { passed: 5, attention: 1, failed: 0 },
    submittedAt: "2026-11-05T10:14:00+05:30",
    targetAt: "2026-11-07T18:00:00+05:30",
    sla: "on_track",
    assignedTo: null,
    lock: null,
    requestedLevel: null,
    context: { liveDrafts: 2 },
    lastActivity: { at: "2026-11-06T09:00:00+05:30", actor: "system" },
  },
  {
    id: "VER-2026-004813",
    type: "startup",
    typeLabel: "Startup",
    typeIcon: BuildingIcon,
    applicant: { displayName: "Nova Labs", region: "KA" },
    status: "in-review",
    risk: { tier: "low", flags: [] },
    autoChecks: { passed: 7, attention: 0, failed: 0 },
    submittedAt: "2026-11-05T14:30:00+05:30",
    targetAt: "2026-11-07T10:00:00+05:30",
    sla: "on_track",
    assignedTo: "Alex Kumar",
    lock: { by: "Alex Kumar", expiresAt: "2026-11-06T14:40:00+05:30" },
    requestedLevel: null,
    context: { liveDrafts: 0 },
    lastActivity: { at: "2026-11-06T08:30:00+05:30", actor: "Alex Kumar" },
  },
  {
    id: "VER-2026-004814",
    type: "investor",
    typeLabel: "Investor",
    typeIcon: ShieldCheck,
    applicant: { displayName: "Capital Partners", region: "MH" },
    status: "waiting-for-applicant",
    risk: { tier: "high", flags: ["pep_match"] },
    autoChecks: { passed: 3, attention: 2, failed: 1 },
    submittedAt: "2026-11-04T09:00:00+05:30",
    targetAt: "2026-11-06T18:00:00+05:30",
    sla: "at_risk",
    assignedTo: null,
    lock: null,
    requestedLevel: "full",
    context: { liveDrafts: 0 },
    lastActivity: { at: "2026-11-05T16:00:00+05:30", actor: "applicant" },
  },
  {
    id: "VER-2026-004815",
    type: "mentor",
    typeLabel: "Mentor",
    typeIcon: UserRound,
    applicant: { displayName: "Sarah Chen", region: "DL" },
    status: "submitted",
    risk: { tier: "medium", flags: ["claims_unverifiable"] },
    autoChecks: { passed: 4, attention: 2, failed: 0 },
    submittedAt: "2026-11-06T07:30:00+05:30",
    targetAt: "2026-11-09T10:00:00+05:30",
    sla: "on_track",
    assignedTo: null,
    lock: null,
    requestedLevel: null,
    context: { liveDrafts: 0 },
    lastActivity: { at: "2026-11-06T07:30:00+05:30", actor: "applicant" },
  },
  {
    id: "VER-2026-004816",
    type: "employer",
    typeLabel: "Employer",
    typeIcon: BriefcaseIcon,
    applicant: { displayName: "DataSys", region: "KA" },
    status: "submitted",
    risk: { tier: "high", flags: ["scam_risk"] },
    autoChecks: { passed: 2, attention: 3, failed: 2 },
    submittedAt: "2026-11-03T16:00:00+05:30",
    targetAt: "2026-11-05T16:00:00+05:30",
    sla: "breached",
    assignedTo: null,
    lock: null,
    requestedLevel: null,
    context: { liveDrafts: 1 },
    lastActivity: { at: "2026-11-04T10:00:00+05:30", actor: "system" },
  },
  {
    id: "VER-2026-004817",
    type: "startup",
    typeLabel: "Startup",
    typeIcon: BuildingIcon,
    applicant: { displayName: "GreenStep", region: "TN" },
    status: "pending",
    risk: { tier: "low", flags: [] },
    autoChecks: { passed: 6, attention: 0, failed: 0 },
    submittedAt: "2026-11-06T06:00:00+05:30",
    targetAt: "2026-11-08T06:00:00+05:30",
    sla: "on_track",
    assignedTo: null,
    lock: null,
    requestedLevel: null,
    context: { liveDrafts: 0 },
    lastActivity: { at: "2026-11-06T06:00:00+05:30", actor: "applicant" },
  },
  {
    id: "VER-2026-004818",
    type: "investor",
    typeLabel: "Investor",
    typeIcon: ShieldCheck,
    applicant: { displayName: "Alpha Fund", region: "MH" },
    status: "in-review",
    risk: { tier: "medium", flags: ["source_of_funds"] },
    autoChecks: { passed: 6, attention: 1, failed: 0 },
    submittedAt: "2026-11-05T11:00:00+05:30",
    targetAt: "2026-11-07T11:00:00+05:30",
    sla: "at_risk",
    assignedTo: "Senior Reviewer",
    lock: { by: "Senior Reviewer", expiresAt: "2026-11-06T15:00:00+05:30" },
    requestedLevel: "full",
    context: { liveDrafts: 0 },
    lastActivity: { at: "2026-11-06T09:30:00+05:30", actor: "Senior Reviewer" },
  },
  {
    id: "VER-2026-004819",
    type: "mentor",
    typeLabel: "Mentor",
    typeIcon: UserRound,
    applicant: { displayName: "David Park", region: "KA" },
    status: "submitted",
    risk: { tier: "low", flags: [] },
    autoChecks: { passed: 5, attention: 0, failed: 0 },
    submittedAt: "2026-11-06T05:00:00+05:30",
    targetAt: "2026-11-08T05:00:00+05:30",
    sla: "on_track",
    assignedTo: null,
    lock: null,
    requestedLevel: null,
    context: { liveDrafts: 0 },
    lastActivity: { at: "2026-11-06T05:00:00+05:30", actor: "applicant" },
  },
];

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */
const sidebarItems = [
  ["Dashboard", LayoutDashboard, "/admin/dashboard"],
  ["Verifications", BuildingIcon, "/admin/verifications"],
  ["Moderation", ShieldAlertIcon, "/admin/moderation"],
  ["Reports", AlertCircle, "/admin/reports"],
  ["Appeals", Scale, "/admin/appeals"],
  ["Disputes", Award, "/admin/disputes"],
  ["Fraud", ShieldAlertIcon, "/admin/fraud"],
  ["Support", MessageCircle, "/admin/support"],
  ["Data requests", FileIcon, "/admin/data-requests"],
  ["Users", UserRound, "/admin/users"],
  ["Organizations", BuildingIcon, "/admin/organizations"],
  ["Content", FileIcon, "/admin/content"],
  ["Templates", FileIcon, "/admin/templates"],
  ["Rubrics", List, "/admin/rubrics"],
  ["Events", CalendarIcon, "/admin/events"],
  ["Billing", Banknote, "/admin/billing"],
  ["Analytics", BarChart3, "/admin/analytics"],
  ["Compliance", ShieldCheck, "/admin/compliance"],
  ["Audit", ActivityIcon, "/admin/audit"],
  ["System", MonitorIcon, "/admin/system"],
  ["Configuration", Wrench, "/admin/configuration"],
];

function AdminSidebar({ active }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-solid border-[#E5E1D8] bg-[#0F1B2D] text-white lg:block">
      <div className="flex h-[64px] items-center justify-between border-b border-solid border-white/10 px-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-white/30 font-serif">
            ADM
          </span>
          <b className="text-xs font-semibold tracking-wide uppercase">Admin</b>
        </div>
      </div>
      <nav className="mt-4 space-y-0.5 px-2">
        {sidebarItems.map(([n, I, u]) => {
          const Comp = I;
          const isActive = n === active;
          return (
            <Link
              key={n}
              href={u}
              className={`relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[12px] ${isActive ? "bg-[#1C2B42] text-white" : "text-white/70 hover:bg-white/10 transition"}`}
            >
              <Comp size={16} />
              {n}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-solid border-white/10 px-2 pt-3 space-y-1 pb-4">
        <BtnIcon size="small" secondary icon={Settings} title="Settings" onClick={() => toast("Settings opening")} />
        <BtnIcon size="small" secondary icon={HelpCircle} title="Runbooks" onClick={() => toast("Runbooks opening")} />
        <button type="button" onClick={() => toast("Signing out")} className="flex w-full items-center gap-3 rounded-[10px] border border-white/10 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/10 transition">
          <span className="flex-shrink-0">Sign out</span>
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Components                                                        */
/* ------------------------------------------------------------------ */

function VerificationStatCard({ label, value, sub, color = INK }) {
  return (
    <Card title padded className="border-[#E5E1D8]">
      <div className="px-5 pt-3 pb-4">
        <div className="flex items-baseline gap-1 mb-1">
          <b className={`text-[32px] font-serif font-semibold text-[${color}] tabular-nums`}>{value}</b>
        </div>
        <p className="text-[12px] text-[#4A5568]">{label}</p>
        <p className="text-[11px] text-[#4A5568]">{sub}</p>
      </div>
    </Card>
  );
}

function TypeTabs({ active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto mb-3 pb-1 border-b border-solid border-[#E5E1D8]">
      {typeTabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`border-b-2 px-4 py-3 text-xs font-medium transition whitespace-nowrap ${active === t.key ? "border-[#B8955A] text-[#0F1B2D]" : "border-transparent text-[#4A5568] hover:text-[#0F1B2D]"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function StatusChips({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto mb-3 pb-1 border-b border-solid border-[#E5E1D8]">
      {statusFilters.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          className={`px-3 py-1.5 rounded-[10px] border text-[10px] font-medium transition whitespace-nowrap ${active === s.key ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568] hover:text-[#0F1B2D]"}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function VerificationRow({ v, onClaim, onOpen, onPreview }) {
  const riskTint = v.risk.tier === "high" ? `border-[#FBE9E7] text-[#B42318]` : v.risk.tier === "medium" ? `border-[#FDF3E0] text-[#9A6210]` : `border-[#E7F3EC] text-[#286749]`;
  const slaTint = v.sla === "breached" ? `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]` : v.sla === "at_risk" ? `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]` : `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`;
  const claimed = v.status === "in-review" && v.assignedTo && v.lock;
  const levelLabel = v.requestedLevel ? v.requestedLevel.charAt(0).toUpperCase() + v.requestedLevel.slice(1) : "—";
  const contextLabel = v.context.liveDrafts > 0 ? `${v.context.liveDrafts} live draft` : "—";
  return (
    <tr key={v.id} className="hover:bg-[#F3EBDD]/50 transition border-b border-solid border-[#E5E1D8]/50 last:border-0 group cursor-pointer" onClick={() => onPreview(v.id)}>
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#F3EBDD] text-[#806236] text-xs font-bold">
            {v.type.charAt(0).toUpperCase()}
          </div>
          <div>
            <b className="text-[12px] text-[#0F1B2D] font-medium tabular-nums">{v.id}</b>
          </div>
        </div>
      </td>
      <td className="py-4 text-[12px] text-[#4A5568]">
        <b className="text-[#0F1B2D]">{v.applicant.displayName}</b>
        <p className="text-[11px] text-[#4A5568]">{v.applicant.region}</p>
      </td>
      <td className="py-4 text-[12px] text-[#4A5568]">
        {relativeTime(v.submittedAt)}
      </td>
      <td className="py-4">
        <StatChip status={v.status} />
      </td>
      <td className="py-4 text-right">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskTint}`}>
          {v.risk.tier.charAt(0).toUpperCase() + v.risk.tier.slice(1)} risk
        </span>
      </td>
      <td className="py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <b className="text-[11px] text-[#0F1B2D] font-medium">{v.autoChecks.passed}</b>
          <span className="text-[10px] text-[#4A5568]">passed</span>
          {v.autoChecks.attention > 0 && (
            <span className={`text-[10px] ${v.autoChecks.attention > 0 ? WARNING_DARK : STONE_700}`}>· {v.autoChecks.attention} attention</span>
          )}
        </div>
      </td>
      <td className="py-4 text-right">
        <StatChip status={v.sla === "on_track" ? "onTrack" : v.sla === "at_risk" ? "atRisk" : "breached"} />
        <p className="text-[10px] text-[#4A5568] mt-0.5">
          {v.sla === "breached" ? "Past target" : v.sla === "at_risk" ? "Due soon" : "On track"}
        </p>
      </td>
      <td className="py-4 text-right">
        {claimed ? (
          <span className="text-[11px] text-[#4A5568]">Being reviewed</span>
        ) : v.assignedTo ? (
          <span className="text-[11px] text-[#4A5568]">{v.assignedTo}</span>
        ) : (
          <Btn size="small" secondary onClick={(e) => { e.stopPropagation(); onClaim(v.id); }} className="px-2.5 py-1.5 min-w-[64px]">
            Claim
          </Btn>
        )}
      </td>
      <td className="py-4 text-right text-[10px] text-[#4A5568]">
        {levelLabel}
      </td>
      <td className="py-4 text-right text-[10px] text-[#4A5568]">
        {contextLabel}
      </td>
      <td className="py-4 text-right text-[10px] text-[#4A5568]">
        {relativeTime(v.lastActivity.at)}
      </td>
      <td className="py-4 text-right">
        <BtnIcon size="small" secondary icon={LinkIcon} title="Open case" onClick={(e) => { e.stopPropagation(); onOpen(v.id); }} />
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell components                                                  */
/* ------------------------------------------------------------------ */

function EnvironmentStrip() {
  const isProd = environment === "production";
  return (
    <div className="h-8 flex items-center justify-center border-b border-solid border-[#E5E1D8] bg-[#0F1B2D] text-white">
      <span className={`px-2.5 py-0.5 rounded text-[10px] font-medium tracking-wide ${isProd ? "bg-white text-[#0F1B2D]" : "bg-[#F3EBDD] text-[#0F1B2D]"}`}>
        {environment.toUpperCase()}
      </span>
      {isProd ? (
        <span className="ml-3 text-[10px] text-white/70">Internal team console · All actions logged</span>
      ) : (
        <span className="ml-3 text-[10px] text-[#0F1B2D] font-medium">Synthetic data only — no real user data</span>
      )}
    </div>
  );
}

function IncidentBanner() {
  return null;
}

function TopBar({ onRefresh }) {
  return (
    <header className="sticky top-0 z-10 flex h-[56px] items-center justify-between border-b border-solid border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => toast("Command palette opening")} className={`flex h-10 w-10 items-center justify-center rounded-[10px] border border-solid border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F3EBDD] transition`} title="Search and commands (⌘K)">
          <Search size={16} />
          <span className="sr-only">Search and commands</span>
        </button>
        <div className="flex items-center gap-2 ml-2">
          <span className="h-2 w-2 rounded-full bg-[#2E7D5B]" />
          <span className="text-[11px] font-semibold text-[#4A5568]">All systems operational</span>
        </div>
        <BtnIcon size="small" secondary icon={Bell} title="Alerts" onClick={() => toast("Alerts opening")} />
      </div>
      <div className="flex items-center gap-3">
        <Btn size="small" secondary icon={RefreshCcw} onClick={onRefresh} title="Refresh" />
        <button type="button" className="flex items-center gap-2 rounded-[10px] border border-solid border-[#E5E1D8] bg-white px-3 py-2 text-left" onClick={() => toast("Profile menu opening")}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0F1B2D] text-[11px] font-bold text-white">AK</span>
          <div className="flex flex-col">
            <span className="block text-[12px] font-medium text-[#0F1B2D]">{user.name}</span>
            <span className="block text-[10px] text-[#4A5568]">{user.internalRole}</span>
          </div>
          <ChevronDown size={12} className="ml-1" />
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Page: Verification Queue (/verifications)                         */
/* ------------------------------------------------------------------ */
function AdminVerificationPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));
  const [activeType, setActiveType] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const [density, setDensity] = useState("comfortable");
  const [showSavedViews, setShowSavedViews] = useState(false);

  const filtered = useMemo(() => {
    return verifications.filter((v) => {
      if (activeType !== "all" && v.type !== activeType) return false;
      if (activeStatus !== "all" && v.status !== activeStatus) return false;
      if (searchQuery && !v.id.toLowerCase().includes(searchQuery.toLowerCase()) && !v.applicant.displayName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [activeType, activeStatus, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "severity") {
        const riskOrder = { high: 3, medium: 2, low: 1 };
        const slaOrder = { breached: 3, at_risk: 2, on_track: 1 };
        const ra = riskOrder[a.risk.tier] || 0;
        const rb = riskOrder[b.risk.tier] || 0;
        if (ra !== rb) return rb - ra;
        const sa = slaOrder[a.sla] || 0;
        const sb = slaOrder[b.sla] || 0;
        if (sa !== sb) return sb - sa;
        return a.ageSeconds - b.ageSeconds;
      }
      if (sortBy === "oldest") return a.ageSeconds - b.ageSeconds;
      if (sortBy === "submitted") return new Date(a.submittedAt) - new Date(b.submittedAt);
      if (sortBy === "type") return a.type.localeCompare(b.type);
      return 0;
    });
  }, [filtered, sortBy]);

  const stats = useMemo(() => {
    const waiting = verifications.filter((v) => v.status === "submitted" || v.status === "pending").length;
    const atRiskOrBreached = verifications.filter((v) => v.sla === "at_risk" || v.sla === "breached").length;
    const mine = verifications.filter((v) => v.assignedTo === user.name || (v.lock && v.lock.by === user.name)).length;
    return { waiting, atRiskOrBreached, mine, medianTime: "1.4 days" };
  }, [verifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const t = setTimeout(() => {
      setRefreshing(false);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));
      toast("Verification queue refreshed");
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const handleClaim = useCallback((id) => {
    const v = verifications.find((x) => x.id === id);
    if (v && v.status === "submitted") {
      toast(`Claimed ${id} — lock active for 10 minutes`);
    }
  }, []);

  const handleOpen = useCallback((id) => {
    toast(`Opening ${id} review page`);
  }, []);

  const handlePreview = useCallback((id) => {
    const v = verifications.find((x) => x.id === id);
    if (v) {
      setDrawerItem(v);
      setDrawerOpen(true);
    }
  }, []);

  const handleNextCase = useCallback(() => {
    const next = sorted.find((v) => v.status === "submitted" || v.status === "pending");
    if (next) {
      setDrawerItem(next);
      setDrawerOpen(true);
      toast(`Claimed ${next.id} — lock active for 10 minutes`);
    } else {
      toast("No eligible cases to claim");
    }
  }, [sorted]);

  const handleRelease = useCallback(() => {
    if (!drawerItem) return;
    setDrawerOpen(false);
    toast(`Released ${drawerItem.id} — returned to queue`);
  }, [drawerItem]);

  const handleSearch = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#verifications-main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-[#0F1B2D] text-white px-4 py-2">
        Skip to content
      </a>

      <EnvironmentStrip />
      {IncidentBanner()}
      <TopBar onRefresh={handleRefresh} />

      <div className="flex flex-col lg:flex-row" id="verifications-main">
        <AdminSidebar active="Verifications" />

        <main className="flex-1 min-w-0 pt-6 lg:pt-8 lg:pl-[232px] lg:px-8 pb-24">
          {/* Title bar */}
          <div className="flex items-center justify-between mb-6 border-b border-solid border-[#E5E1D8] pb-4">
            <div>
              <h1 className="text-[28px] font-serif font-semibold">Verifications</h1>
              <p className="text-[12px] text-[#4A5568] mt-1">
                All pending reviews across roles, ordered by risk, deadline and age
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Btn size="small" secondary icon={Menu} onClick={() => setShowSavedViews(!showSavedViews)} title="Saved views" />
              {showSavedViews && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-solid border-[#E5E1D8] rounded-[10px] shadow-lg p-3 z-30">
                  <p className="text-[10px] font-semibold text-[#4A5568] mb-2 uppercase tracking-wide">Saved views</p>
                  <Btn size="small" secondary className="w-full text-left text-[11px]" onClick={() => { setShowSavedViews(false); toast("Loading 'Unassigned high risk'"); }}>
                    Unassigned high risk
                  </Btn>
                  <Btn size="small" secondary className="w-full text-left text-[11px]" onClick={() => { setShowSavedViews(false); toast("Loading 'Waiting over 7 days'"); }}>
                    Waiting for applicant over 7 days
                  </Btn>
                  <Btn size="small" secondary className="w-full text-left text-[11px]" onClick={() => setShowSavedViews(false)}>
                    My saved views
                  </Btn>
                </div>
              )}
              <Btn size="small" secondary icon={RefreshCcw} onClick={handleRefresh} title="Refresh" />
            </div>
          </div>

          {/* Type tabs */}
          <TypeTabs active={activeType} onChange={setActiveType} />

          {/* Status chips */}
          <StatusChips active={activeStatus} onChange={setActiveStatus} />

          {/* Summary strip */}
          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <VerificationStatCard label="Waiting" value={stats.waiting} sub="Cases awaiting review" color={INK} />
            <VerificationStatCard label="At risk or breached" value={stats.atRiskOrBreached} sub="Over or nearing SLA target" color={WARNING} />
            <VerificationStatCard label="Mine" value={stats.mine} sub="Claimed by you" color={GOLD_DARK} />
            <VerificationStatCard label="Median time to decision (30 days)" value={stats.medianTime} sub="Average across all types" color={INFO} />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-solid border-[#E5E1D8] pb-3">
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 text-[#4A5568]" size={16} />
                <input
                  type="search"
                  placeholder="Search by case ID or applicant name"
                  value={searchQuery}
                  onChange={handleSearch}
                  className="h-10 w-full rounded-[10px] border border-solid border-[#E5E1D8] bg-white pl-9 pr-4 text-[12px] focus:border-[#B8955A] focus:outline-none"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 rounded-[10px] border border-solid border-[#E5E1D8] bg-white pl-3 pr-10 text-[12px] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%234A5568%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M6 9l6 6 6-6%22></path></svg>')] bg-no-repeat bg-right-2.5 bg-center-[10px]"
              >
                <option value="severity">Sort: Severity → risk → age</option>
                <option value="oldest">Sort: Oldest first</option>
                <option value="submitted">Sort: Submitted date</option>
                <option value="type">Sort: Type</option>
              </select>
              <Btn size="small" secondary icon={LayoutGrid} onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")} title="Toggle density" />
            </div>
            <Btn onClick={handleNextCase} icon={ArrowRight} className="ml-auto">
              Next case
            </Btn>
          </div>

          {/* Table */}
          <Card title="Verification queue" titleIcon={BuildingIcon}>
            <div className="px-5 pt-3 pb-4 overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse min-w-full">
                <thead>
                  <tr className="border-b border-solid border-[#E5E1D8]">
                    {["Case", "Applicant", "Submitted", "Status", "Risk", "Auto-checks", "SLA", "Assigned", "Level", "Context", "Last activity", "Actions"].map((h) => (
                      <th key={h} className="pb-3 text-[11px] text-[#4A5568] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-solid divide-[#E5E1D8]/50">
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-[12px] text-[#4A5568]">
                        <Inbox size={24} className="mx-auto mb-3 text-[#4A5568]" />
                        <p className="text-[12px] font-medium text-[#0F1B2D]">No cases match your filters.</p>
                        <Btn size="small" secondary onClick={() => setActiveStatus("all")} className="mt-3">
                          Clear filters
                        </Btn>
                      </td>
                    </tr>
                  ) : (
                    sorted.map((v) => (
                      <VerificationRow key={v.id} v={v} onClaim={handleClaim} onOpen={handleOpen} onPreview={handlePreview} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 pt-3 pb-4 flex items-center justify-between">
              <p className="text-[11px] text-[#4A5568]">
                Showing {sorted.length} of {verifications.length} cases
              </p>
              <div className="flex items-center gap-2">
                <Btn size="small" secondary className="px-2 py-1.5" icon={LayoutGrid} title="Grid view" />
                <Btn size="small" secondary className="px-2 py-1.5" icon={LayoutList} title="List view" />
              </div>
            </div>
          </Card>

          <div className="mt-8 px-5 lg:px-0 text-center lg:text-left">
            <p className="text-[11px] text-[#4A5568]">
              Case ID and categories only. No identity numbers, contact details or document names on this page.
              All actions are logged to the audit trail.
            </p>
          </div>
        </main>
      </div>

      {/* Case preview drawer */}
      {drawerOpen && drawerItem && (
        <DetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Case preview: ${drawerItem.id}`}>
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h4 className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">Case details</h4>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Case ID:</b> {drawerItem.id}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Type:</b> {drawerItem.typeLabel}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Applicant:</b> {drawerItem.applicant.displayName}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Region:</b> {drawerItem.applicant.region}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Submitted:</b> {drawerItem.submittedAt}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Age:</b> {formatAge(drawerItem.ageSeconds || 86400)}</p>
                {drawerItem.requestedLevel && (
                  <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Requested level:</b> {drawerItem.requestedLevel}</p>
                )}
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">Status & SLA</h4>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Status:</b> <StatChip status={drawerItem.status} /></p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">SLA:</b> <StatChip status={drawerItem.sla === "on_track" ? "onTrack" : drawerItem.sla === "at_risk" ? "atRisk" : "breached"} /></p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Risk tier:</b> <span className={`text-[10px] font-medium ${drawerItem.risk.tier === 'high' ? ERROR_DARK : drawerItem.risk.tier === 'medium' ? WARNING_DARK : SUCCESS_DARK}`}>{drawerItem.risk.tier.charAt(0).toUpperCase() + drawerItem.risk.tier.slice(1)}</span></p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Flags:</b> {drawerItem.risk.flags.length > 0 ? drawerItem.risk.flags.join(", ") : "None"}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Auto-checks:</b> {drawerItem.autoChecks.passed} passed · {drawerItem.autoChecks.attention} attention · {drawerItem.autoChecks.failed} failed</p>
              </div>
            </div>

            <Card title="Review decision" titleIcon={Scale}>
              <div className="px-5 pt-3 pb-4 space-y-4">
                <p className="text-[12px] text-[#4A5568]">
                  Open the case to review documents, run checks and record a decision.
                  Each decision requires a reason code and is written to the audit log.
                </p>
                <div className="flex gap-2">
                  <Btn onClick={() => {
                    setDrawerOpen(false);
                    toast(`Opening ${drawerItem.id} for review`);
                  }} className="flex-1">
                    Open case
                  </Btn>
                  {!drawerItem.lock || drawerItem.lock.by === user.name ? (
                    <Btn secondary onClick={() => {
                      setDrawerOpen(false);
                      toast(`${drawerItem.id}: claim released`);
                    }} className="flex-1">
                      Release claim
                    </Btn>
                  ) : (
                    <Btn size="small" secondary disabled className="flex-1">
                      Being reviewed by {drawerItem.lock?.by}
                    </Btn>
                  )}
                </div>
              </div>
            </Card>

            <div className="flex gap-2 pt-4">
              <Btn onClick={() => setDrawerOpen(false)} className="flex-1">Close preview</Btn>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Exports                                                           */
/* ================================================================== */
export { AdminVerificationPage };
