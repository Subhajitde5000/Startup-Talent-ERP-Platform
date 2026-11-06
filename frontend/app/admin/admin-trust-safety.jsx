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
  Tag,
  HardHat,
  Stethoscope,
  Briefcase as Briefcase2Icon,
  Eye,
  EyeOff,
  Save,
  Send,
  Trash2,
  Minus,
  Plus,
  Unlock,
  HardHat as HardHatIcon,
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
  internalRole: "Trust and safety moderator",
  internalRoles: ["Trust and safety moderator"],
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
    new: `border-[#E5E1D8] text-[#4A5568]`,
    "in-review": `border-[#E5E1D8] text-[#4A5568]`,
    "waiting-for-info": `border-[#E8F0F8] bg-[#E8F0F8] text-[#2F5D8A]`,
    "second-review": `border-[#F3EBDD] bg-[#F3EBDD] text-[#806236]`,
    "action-taken": `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    "no-action": `border-[#E5E1D8] text-[#4A5568]`,
    escalated: `border-[#F3EBDD] bg-[#F3EBDD] text-[#806236]`,
    appealed: `border-[#F3EBDD] bg-[#F3EBDD] text-[#806236]`,
    closed: `border-[#E5E1D8] text-[#4A5568]`,
    onTrack: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    atRisk: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    breached: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    S1: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    S2: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    S3: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    S4: `border-[#E5E1D8] text-[#4A5568]`,
    job: `border-[#E5E1D8] text-[#4A5568]`,
    profile: `border-[#E5E1D8] text-[#4A5568]`,
    message: `border-[#E5E1D8] text-[#4A5568]`,
    review: `border-[#E5E1D8] text-[#4A5568]`,
    "startup-page": `border-[#E5E1D8] text-[#4A5568]`,
    resume: `border-[#E5E1D8] text-[#4A5568]`,
    document: `border-[#E5E1D8] text-[#4A5568]`,
    event: `border-[#E5E1D8] text-[#4A5568]`,
    warned: `border-[#FDF3E0] text-[#9A6210]`,
    edited: `border-[#FDF3E0] text-[#9A6210]`,
    removed: `border-[#FBE9E7] text-[#B42318]`,
    limited: `border-[#FDF3E0] text-[#9A6210]`,
    suspended: `border-[#FBE9E7] text-[#B42318]`,
    banned: `border-[#FBE9E7] text-[#B42318]`,
    restored: `border-[#E7F3EC] text-[#286749]`,
    "user-report": `border-[#E5E1D8] text-[#4A5568]`,
    "automated-flag": `border-[#FDF3E0] text-[#9A6210]`,
    "staff-initiated": `border-[#E8F0F8] text-[#2F5D8A]`,
    "provider-alert": `border-[#FDF3E0] text-[#9A6210]`,
    "legal-request": `border-[#E8F0F8] text-[#2F5D8A]`,
  };
  const label =
    status === "new" ? "New" :
    status === "in-review" ? "In review" :
    status === "waiting-for-info" ? "Waiting for info" :
    status === "second-review" ? "Second review" :
    status === "action-taken" ? "Action taken" :
    status === "no-action" ? "No action" :
    status === "escalated" ? "Escalated" :
    status === "appealed" ? "Appealed" :
    status === "closed" ? "Closed" :
    status === "onTrack" ? "On track" :
    status === "atRisk" ? "At risk" :
    status === "breached" ? "Breached" :
    status.replace("-", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${maps[status] || maps.new}`}
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
/*  Mock moderation queue data (Part A.3 table shape)                 */
/* ------------------------------------------------------------------ */

const tabs = [
  { key: "queue", label: "Queue" },
  { key: "my-cases", label: "My cases" },
  { key: "auto-limited", label: "Auto-limited" },
  { key: "second-review", label: "Second review" },
  { key: "held", label: "Held" },
];

const severities = [
  { key: "all", label: "All severities" },
  { key: "S1", label: "S1 Critical" },
  { key: "S2", label: "S2 High" },
  { key: "S3", label: "S3 Medium" },
  { key: "S4", label: "S4 Low" },
];

const sources = [
  { key: "all", label: "All sources" },
  { key: "user-report", label: "User report" },
  { key: "automated-flag", label: "Automated flag" },
  { key: "staff-initiated", label: "Staff-initiated" },
  { key: "provider-alert", label: "Provider alert" },
];

const contentTypes = [
  { key: "job", label: "Job", icon: BriefcaseIcon },
  { key: "profile", label: "Profile", icon: UserRound },
  { key: "message", label: "Message", icon: MessageCircle },
  { key: "review", label: "Review", icon: Award },
  { key: "startup-page", label: "Startup page", icon: BuildingIcon },
];

const cases = [
  {
    id: "MOD-2026-018342",
    type: "job",
    typeLabel: "Job",
    severity: "S2",
    status: "in-review",
    policyId: "P-04",
    policyName: "Fee requests",
    source: "user-report",
    reportCount: 6,
    subject: { kind: "job", id: "job_8812", title: "Data entry work from home", orgId: "org_77" },
    createdAt: "2026-11-06T09:14:00+05:30",
    targetAt: "2026-11-06T10:14:00+05:30",
    sla: "at_risk",
    assignedTo: null,
    lock: null,
    autoState: { limited: false },
    historyCount: 3,
    lastActivity: { at: "2026-11-06T09:45:00+05:30", actor: "system" },
  },
  {
    id: "MOD-2026-018343",
    type: "profile",
    typeLabel: "Profile",
    severity: "S1",
    status: "new",
    policyId: "P-21",
    policyName: "Impersonation of staff",
    source: "automated-flag",
    reportCount: 1,
    subject: { kind: "profile", id: "usr_441", title: "Support agent - Forma", orgId: null },
    createdAt: "2026-11-06T10:02:00+05:30",
    targetAt: "2026-11-06T10:17:00+05:30",
    sla: "on_track",
    assignedTo: null,
    lock: null,
    autoState: { limited: true, limitExpiresAt: "2026-11-07T10:02:00+05:30" },
    historyCount: 0,
    lastActivity: { at: "2026-11-06T10:02:00+05:30", actor: "system" },
  },
  {
    id: "MOD-2026-018344",
    type: "message",
    typeLabel: "Message",
    severity: "S3",
    status: "new",
    policyId: "P-15",
    policyName: "Harassment",
    source: "user-report",
    reportCount: 2,
    subject: { kind: "message", id: "msg_9912", title: "Message in thread", orgId: null },
    createdAt: "2026-11-06T08:45:00+05:30",
    targetAt: "2026-11-06T12:45:00+05:30",
    sla: "on_track",
    assignedTo: null,
    lock: null,
    autoState: { limited: false },
    historyCount: 1,
    lastActivity: { at: "2026-11-06T08:45:00+05:30", actor: "applicant" },
  },
  {
    id: "MOD-2026-018345",
    type: "job",
    typeLabel: "Job",
    severity: "S2",
    status: "new",
    policyId: "P-30",
    policyName: "Spam",
    source: "automated-flag",
    reportCount: 14,
    subject: { kind: "job", id: "job_8901", title: "Earn ₹5000 daily - no experience", orgId: "org_88" },
    createdAt: "2026-11-06T07:30:00+05:30",
    targetAt: "2026-11-06T11:30:00+05:30",
    sla: "at_risk",
    assignedTo: null,
    lock: null,
    autoState: { limited: true, limitExpiresAt: "2026-11-07T07:30:00+05:30" },
    historyCount: 0,
    lastActivity: { at: "2026-11-06T07:30:00+05:30", actor: "system" },
  },
  {
    id: "MOD-2026-018346",
    type: "startup-page",
    typeLabel: "Startup page",
    severity: "S4",
    status: "new",
    policyId: "P-22",
    policyName: "Misleading traction claims",
    source: "staff-initiated",
    reportCount: 1,
    subject: { kind: "startup-page", id: "startup_33", title: "Nova Labs profile", orgId: "org_55" },
    createdAt: "2026-11-05T16:00:00+05:30",
    targetAt: "2026-11-07T16:00:00+05:30",
    sla: "on_track",
    assignedTo: "Alex Kumar",
    lock: { by: "Alex Kumar", expiresAt: "2026-11-06T14:50:00+05:30" },
    autoState: { limited: false },
    historyCount: 2,
    lastActivity: { at: "2026-11-06T08:00:00+05:30", actor: "Alex Kumar" },
  },
  {
    id: "MOD-2026-018347",
    type: "review",
    typeLabel: "Review",
    severity: "S3",
    status: "submitted",
    policyId: "P-11",
    policyName: "Discriminatory criteria",
    source: "user-report",
    reportCount: 3,
    subject: { kind: "review", id: "rev_112", title: "Job post review", orgId: "org_77" },
    createdAt: "2026-11-06T11:00:00+05:30",
    targetAt: "2026-11-06T15:00:00+05:30",
    sla: "on_track",
    assignedTo: null,
    lock: null,
    autoState: { limited: false },
    historyCount: 0,
    lastActivity: { at: "2026-11-06T11:00:00+05:30", actor: "applicant" },
  },
  {
    id: "MOD-2026-018348",
    type: "document",
    typeLabel: "Document",
    severity: "S2",
    status: "new",
    policyId: "P-41",
    policyName: "Off-platform payment",
    source: "provider-alert",
    reportCount: 1,
    subject: { kind: "document", id: "doc_55", title: "Invoice upload", orgId: null },
    createdAt: "2026-11-06T10:30:00+05:30",
    targetAt: "2026-11-06T11:30:00+05:30",
    sla: "breached",
    assignedTo: null,
    lock: null,
    autoState: { limited: false },
    historyCount: 0,
    lastActivity: { at: "2026-11-06T10:30:00+05:30", actor: "system" },
  },
  {
    id: "MOD-2026-018349",
    type: "event",
    typeLabel: "Event",
    severity: "S4",
    status: "new",
    policyId: "P-18",
    policyName: "Event conduct",
    source: "user-report",
    reportCount: 1,
    subject: { kind: "event", id: "evt_22", title: "Hiring workshop", orgId: "org_90" },
    createdAt: "2026-11-06T06:00:00+05:30",
    targetAt: "2026-11-07T06:00:00+05:30",
    sla: "on_track",
    assignedTo: null,
    lock: null,
    autoState: { limited: false },
    historyCount: 0,
    lastActivity: { at: "2026-11-06T06:00:00+05:30", actor: "applicant" },
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

function TrustStatCard({ label, value, sub, color = INK }) {
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

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto mb-3 pb-1 border-b border-solid border-[#E5E1D8]">
      {tabs.map((t) => (
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

function SeverityFilter({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto mb-3 pb-1 border-b border-solid border-[#E5E1D8]">
      {severities.map((s) => (
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

function SourceFilter({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto mb-3 pb-1 border-b border-solid border-[#E5E1D8]">
      {sources.map((s) => (
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

function CaseRow({ c, onClaim, onOpen, onPreview }) {
  const sevTint = c.severity === "S1" ? `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]` : c.severity === "S2" ? `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]` : c.severity === "S3" ? `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]` : `border-[#E5E1D8] text-[#4A5568]`;
  const slaTint = c.sla === "breached" ? `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]` : c.sla === "at_risk" ? `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]` : `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`;
  const claimed = c.status === "in-review" && c.assignedTo && c.lock;
  const contentTypeIcon = contentTypes.find((t) => t.key === c.type)?.icon || BriefcaseIcon;
  return (
    <tr key={c.id} className="hover:bg-[#F3EBDD]/50 transition border-b border-solid border-[#E5E1D8]/50 last:border-0 group cursor-pointer" onClick={() => onPreview(c.id)}>
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#F3EBDD] text-[#806236] text-xs font-bold">
            {c.type.charAt(0).toUpperCase()}
          </div>
          <div>
            <b className="text-[12px] text-[#0F1B2D] font-medium tabular-nums">{c.id}</b>
          </div>
        </div>
      </td>
      <td className="py-4">
        <StatChip status={c.severity} />
      </td>
      <td className="py-4 text-[12px] text-[#4A5568]">
        <b className="text-[#0F1B2D]">{c.policyId}</b>
        <p className="text-[11px] text-[#4A5568]">{c.policyName}</p>
      </td>
      <td className="py-4 text-[12px] text-[#4A5568]">
        <StatChip status={c.source.replace("_", "-")} />
        <span className="text-[10px] text-[#4A5568] block mt-0.5">{c.reportCount} report{c.reportCount !== 1 ? "s" : ""}</span>
      </td>
      <td className="py-4 text-[12px] text-[#4A5568]">
        <b className="text-[#0F1B2D]">{c.subject.title}</b>
        <p className="text-[11px] text-[#4A5568]">{c.subject.kind} · {c.subject.id}</p>
      </td>
      <td className="py-4 text-[12px] text-[#4A5568]">
        {relativeTime(c.createdAt)}
      </td>
      <td className="py-4 text-right">
        <StatChip status={c.sla === "on_track" ? "onTrack" : c.sla === "at_risk" ? "atRisk" : "breached"} />
        <p className="text-[10px] text-[#4A5568] mt-0.5">
          {c.sla === "breached" ? "Past target" : c.sla === "at_risk" ? "Due soon" : "On track"}
        </p>
      </td>
      <td className="py-4 text-right text-[10px] text-[#4A5568]">
        {c.historyCount} prior{c.historyCount !== 1 ? "" : ""}
      </td>
      <td className="py-4 text-right">
        {claimed ? (
          <span className="text-[11px] text-[#4A5568]">Being reviewed</span>
        ) : c.assignedTo ? (
          <span className="text-[11px] text-[#4A5568]">{c.assignedTo}</span>
        ) : (
          <Btn size="small" secondary onClick={(e) => { e.stopPropagation(); onClaim(c.id); }} className="px-2.5 py-1.5 min-w-[64px]">
            Claim
          </Btn>
        )}
      </td>
      <td className="py-4 text-right text-[10px] text-[#4A5568]">
        {c.autoState.limited ? "Auto-limited" : "—"}
      </td>
      <td className="py-4 text-right">
        <BtnIcon size="small" secondary icon={LinkIcon} title="Open case" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }} />
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
/*  Page: Moderation Queue (/moderation)                              */
/* ------------------------------------------------------------------ */
function AdminTrustSafetyPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));
  const [activeTab, setActiveTab] = useState("queue");
  const [activeSeverity, setActiveSeverity] = useState("all");
  const [activeSource, setActiveSource] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const [density, setDensity] = useState("comfortable");
  const [showSavedViews, setShowSavedViews] = useState(false);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (activeTab === "my-cases" && c.assignedTo !== user.name && !(c.lock && c.lock.by === user.name)) return false;
      if (activeTab === "auto-limited" && !c.autoState.limited) return false;
      if (activeTab === "second-review" && c.status !== "second-review") return false;
      if (activeTab === "held" && c.status !== "on-hold") return false;
      if (activeSeverity !== "all" && c.severity !== activeSeverity) return false;
      if (activeSource !== "all" && c.source !== activeSource) return false;
      if (searchQuery && !c.id.toLowerCase().includes(searchQuery.toLowerCase()) && !c.subject.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [activeTab, activeSeverity, activeSource, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "severity") {
        const sevOrder = { S1: 4, S2: 3, S3: 2, S4: 1 };
        const slaOrder = { breached: 3, at_risk: 2, on_track: 1 };
        const sa = sevOrder[a.severity] || 0;
        const sb = sevOrder[b.severity] || 0;
        if (sa !== sb) return sb - sa;
        const ta = slaOrder[a.sla] || 0;
        const tb = slaOrder[b.sla] || 0;
        if (ta !== tb) return tb - ta;
        return b.reportCount - a.reportCount;
      }
      if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "reports") return b.reportCount - a.reportCount;
      return 0;
    });
  }, [filtered, sortBy]);

  const stats = useMemo(() => {
    const waiting = cases.filter((c) => c.status === "new" || c.status === "submitted").length;
    const s1s2 = cases.filter((c) => (c.severity === "S1" || c.severity === "S2") && (c.status === "new" || c.status === "in-review")).length;
    const atRiskOrBreached = cases.filter((c) => c.sla === "at_risk" || c.sla === "breached").length;
    const autoLimited = cases.filter((c) => c.autoState.limited).length;
    return { waiting, s1s2, atRiskOrBreached, autoLimited };
  }, [cases]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const t = setTimeout(() => {
      setRefreshing(false);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));
      toast("Moderation queue refreshed");
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const handleClaim = useCallback((id) => {
    const c = cases.find((x) => x.id === id);
    if (c && c.status === "new") {
      toast(`Claimed ${id} — lock active for 10 minutes`);
    }
  }, []);

  const handleOpen = useCallback((id) => {
    toast(`Opening ${id} case page`);
  }, []);

  const handlePreview = useCallback((id) => {
    const c = cases.find((x) => x.id === id);
    if (c) {
      setDrawerItem(c);
      setDrawerOpen(true);
    }
  }, []);

  const handleNextCase = useCallback(() => {
    const next = sorted.find((c) => c.status === "new" || c.status === "submitted");
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
      <a href="#moderation-main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-[#0F1B2D] text-white px-4 py-2">
        Skip to content
      </a>

      <EnvironmentStrip />
      {IncidentBanner()}
      <TopBar onRefresh={handleRefresh} />

      <div className="flex flex-col lg:flex-row" id="moderation-main">
        <AdminSidebar active="Moderation" />

        <main className="flex-1 min-w-0 pt-6 lg:pt-8 lg:pl-[232px] lg:px-8 pb-24">
          {/* Title bar */}
          <div className="flex items-center justify-between mb-6 border-b border-solid border-[#E5E1D8] pb-4">
            <div>
              <h1 className="text-[28px] font-serif font-semibold">Moderation</h1>
              <p className="text-[12px] text-[#4A5568] mt-1">
                Flagged jobs, profiles, messages, reviews and startup content waiting for a human decision
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Btn size="small" secondary icon={Menu} onClick={() => setShowSavedViews(!showSavedViews)} title="Saved views" />
              {showSavedViews && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-solid border-[#E5E1D8] rounded-[10px] shadow-lg p-3 z-30">
                  <p className="text-[10px] font-semibold text-[#4A5568] mb-2 uppercase tracking-wide">Saved views</p>
                  <Btn size="small" secondary className="w-full text-left text-[11px]" onClick={() => { setShowSavedViews(false); toast("Loading 'Unassigned S1/S2'"); }}>
                    Unassigned S1/S2
                  </Btn>
                  <Btn size="small" secondary className="w-full text-left text-[11px]" onClick={() => { setShowSavedViews(false); toast("Loading 'Auto-limited expiring'"); }}>
                    Auto-limited expiring soon
                  </Btn>
                  <Btn size="small" secondary className="w-full text-left text-[11px]" onClick={() => setShowSavedViews(false)}>
                    My saved views
                  </Btn>
                </div>
              )}
              <Btn size="small" secondary icon={RefreshCcw} onClick={handleRefresh} title="Refresh" />
            </div>
          </div>

          {/* Tabs */}
          <TabBar active={activeTab} onChange={setActiveTab} />

          {/* Severity filter */}
          <SeverityFilter active={activeSeverity} onChange={setActiveSeverity} />

          {/* Source filter */}
          <SourceFilter active={activeSource} onChange={setActiveSource} />

          {/* Summary strip */}
          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <TrustStatCard label="Waiting" value={stats.waiting} sub="Cases awaiting review" color={INK} />
            <TrustStatCard label="S1 and S2 open" value={stats.s1s2} sub="Critical and high severity" color={ERROR} />
            <TrustStatCard label="At risk or breached" value={stats.atRiskOrBreached} sub="Over or nearing SLA target" color={WARNING} />
            <TrustStatCard label="Auto-limited awaiting review" value={stats.autoLimited} sub="Limits expire if not reviewed in 24 hours" color={GOLD_DARK} />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-solid border-[#E5E1D8] pb-3">
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 text-[#4A5568]" size={16} />
                <input
                  type="search"
                  placeholder="Search by case ID, subject or policy"
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
                <option value="severity">Sort: Severity → SLA → reports</option>
                <option value="oldest">Sort: Oldest first</option>
                <option value="reports">Sort: Report count</option>
              </select>
              <Btn size="small" secondary icon={LayoutGrid} onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")} title="Toggle density" />
            </div>
            <Btn onClick={handleNextCase} icon={ArrowRight} className="ml-auto">
              Next case
            </Btn>
          </div>

          {/* Case table */}
          <Card title="Case queue" titleIcon={ShieldAlertIcon}>
            <div className="px-5 pt-3 pb-4 overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse min-w-full">
                <thead>
                  <tr className="border-b border-solid border-[#E5E1D8]">
                    {["Case", "Severity", "Policy", "Source", "Subject", "Created", "SLA", "History", "Assigned", "Auto-state", "Actions"].map((h) => (
                      <th key={h} className="pb-3 text-[11px] text-[#4A5568] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-solid divide-[#E5E1D8]/50">
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-[12px] text-[#4A5568]">
                        <Inbox size={24} className="mx-auto mb-3 text-[#4A5568]" />
                        <p className="text-[12px] font-medium text-[#0F1B2D]">No cases match your filters.</p>
                        <Btn size="small" secondary onClick={() => { setActiveSeverity("all"); setActiveSource("all"); setSearchQuery(""); }} className="mt-3">
                          Clear filters
                        </Btn>
                      </td>
                    </tr>
                  ) : (
                    sorted.map((c) => (
                      <CaseRow key={c.id} c={c} onClaim={handleClaim} onOpen={handleOpen} onPreview={handlePreview} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 pt-3 pb-4 flex items-center justify-between">
              <p className="text-[11px] text-[#4A5568]">
                Showing {sorted.length} of {cases.length} cases
              </p>
              <div className="flex items-center gap-2">
                <Btn size="small" secondary className="px-2 py-1.5" icon={LayoutGrid} title="Grid view" />
                <Btn size="small" secondary className="px-2 py-1.5" icon={LayoutList} title="List view" />
              </div>
            </div>
          </Card>

          <div className="mt-8 px-5 lg:px-0 text-center lg:text-left">
            <p className="text-[11px] text-[#4A5568]">
              Case IDs, policy IDs and categories only. No personal data, message text or document contents on this page.
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
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Subject:</b> {drawerItem.subject.title}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Created:</b> {drawerItem.createdAt}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Age:</b> {formatAge(drawerItem.ageSeconds || 86400)}</p>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">Severity & SLA</h4>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Severity:</b> <StatChip status={drawerItem.severity} /></p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">SLA:</b> <StatChip status={drawerItem.sla === "on_track" ? "onTrack" : drawerItem.sla === "at_risk" ? "atRisk" : "breached"} /></p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Policy:</b> {drawerItem.policyId} — {drawerItem.policyName}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Source:</b> {drawerItem.source.replace("-", " ")} ({drawerItem.reportCount} report{drawerItem.reportCount !== 1 ? "s" : ""})</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Assigned:</b> {drawerItem.assignedTo || "Unassigned"}</p>
              </div>
            </div>

            <Card title="Action panel" titleIcon={Scale}>
              <div className="px-5 pt-3 pb-4 space-y-4">
                <p className="text-[12px] text-[#4A5568]">
                  Open the case to review the content snapshot, check context and history, and record a decision.
                  Each action requires a reason code and is written to the audit log.
                </p>
                <div className="flex gap-2">
                  {!drawerItem.lock || drawerItem.lock.by === user.name ? (
                    <>
                      <Btn onClick={() => {
                        setDrawerOpen(false);
                        toast(`Opening ${drawerItem.id} for review`);
                      }} className="flex-1">
                        Open case
                      </Btn>
                      <Btn secondary onClick={() => {
                        setDrawerOpen(false);
                        toast(`${drawerItem.id}: claim released`);
                      }} className="flex-1">
                        Release claim
                      </Btn>
                    </>
                  ) : (
                    <Btn size="small" secondary disabled className="flex-1">
                      Being reviewed by {drawerItem.lock?.by}
                    </Btn>
                  )}
                  <Btn secondary onClick={() => {
                    setDrawerOpen(false);
                    toast(`Escalating ${drawerItem.id} to senior moderator`);
                  }} className="flex-1">
                    Escalate
                  </Btn>
                </div>
                <div className="bg-[#F3EBDD] border border-solid border-[#F3EBDD] rounded-[10px] p-3">
                  <p className="text-[11px] text-[#806236] mb-2"><b className="text-[#806236]">Note:</b> Claims expire after 10 minutes of inactivity. S1 cases route to on-call immediately.</p>
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
export { AdminTrustSafetyPage };
