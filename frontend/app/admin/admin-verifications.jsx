"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
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
  Printer,
  Link as LinkIcon,
  ExternalLink,
  Edit,
  Trash2,
  Save,
  Send,
  Eye,
  EyeOff,
  Lock,
  Unlock,
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
  Sun,
  Moon,
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
  theme: "system",
  density: "comfortable",
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
/*  Theme detection (SSR-safe)                                        */
/* ------------------------------------------------------------------ */
function useTheme() {
  const [theme, setTheme] = useState(user.theme);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const resolve = (t) => {
      if (t === "system") {
        const m = window.matchMedia("(prefers-color-scheme: dark)");
        const dark = m.matches;
        root.classList.toggle("dark-theme", dark);
        setIsDark(dark);
        m.addEventListener("change", (e) => {
          if (theme === "system") {
            root.classList.toggle("dark-theme", e.matches);
            setIsDark(e.matches);
          }
        });
        return;
      }
      const dark = t === "dark";
      root.classList.toggle("dark-theme", dark);
      setIsDark(dark);
    };
    resolve(theme);
    return () => {
      const m = window.matchMedia("(prefers-color-scheme: dark)");
      m.removeEventListener("change", () => {});
    };
  }, [theme]);
  return { theme, setTheme, isDark: mounted ? isDark : false };
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
    onTrack: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    atRisk: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    breached: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    approved: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    rejected: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    "needs-changes": `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    pending: `border-[#E5E1D8] text-[#4A5568]`,
    claimed: `border-[#F3EBDD] bg-[#F3EBDD] text-[#806236]`,
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${maps[status] || maps.pending}`}
    >
      {status === "breached" && count ? `Breached · ${count}` : status.replace("-", " ")}
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

function DetailDrawer({ open, onClose, title, children }) {
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

/* ------------------------------------------------------------------ */
/*  Mock verification data                                            */
/* ------------------------------------------------------------------ */

const verifications = [
  {
    id: "VER-4412",
    type: "startup",
    typeLabel: "Startup",
    companyName: "Nova Labs",
    category: "Business verification",
    status: "pending",
    submittedAt: "2026-11-04T10:15:00+05:30",
    ageSeconds: 172800,
    targetSeconds: 172800,
    sla: "onTrack",
    priority: "normal",
    reviewer: null,
    documents: ["GST certificate", "Incorporation deed", "PAN card"],
    riskScore: 15,
    riskLevel: "low",
  },
  {
    id: "VER-4413",
    type: "mentor",
    typeLabel: "Mentor",
    companyName: "Sarah Chen",
    category: "Identity verification",
    status: "pending",
    submittedAt: "2026-11-05T14:30:00+05:30",
    ageSeconds: 57600,
    targetSeconds: 259200,
    sla: "onTrack",
    priority: "normal",
    reviewer: null,
    documents: ["Government ID", "LinkedIn profile", "Credentials"],
    riskScore: 8,
    riskLevel: "low",
  },
  {
    id: "VER-4414",
    type: "investor",
    typeLabel: "Investor",
    companyName: "Capital Partners",
    category: "KYC verification",
    status: "pending",
    submittedAt: "2026-11-05T09:00:00+05:30",
    ageSeconds: 86400,
    targetSeconds: 172800,
    sla: "atRisk",
    priority: "high",
    reviewer: null,
    documents: ["KYC form", "Source of funds", "Accreditation proof"],
    riskScore: 72,
    riskLevel: "high",
  },
  {
    id: "VER-4415",
    type: "employer",
    typeLabel: "Employer",
    companyName: "TechFlow Inc",
    category: "Business verification",
    status: "pending",
    submittedAt: "2026-11-05T16:45:00+05:30",
    ageSeconds: 32400,
    targetSeconds: 172800,
    sla: "onTrack",
    priority: "normal",
    reviewer: null,
    documents: ["Business registration", "Tax ID", "Bank statement"],
    riskScore: 23,
    riskLevel: "low",
  },
  {
    id: "VER-4416",
    type: "startup",
    typeLabel: "Startup",
    companyName: "GreenStep",
    category: "Business verification",
    status: "claimed",
    submittedAt: "2026-11-06T08:00:00+05:30",
    ageSeconds: 7200,
    targetSeconds: 172800,
    sla: "onTrack",
    priority: "urgent",
    reviewer: "Alex Kumar",
    documents: ["GST certificate", "Incorporation deed"],
    riskScore: 45,
    riskLevel: "medium",
  },
  {
    id: "VER-4417",
    type: "mentor",
    typeLabel: "Mentor",
    companyName: "David Park",
    category: "Identity verification",
    status: "pending",
    submittedAt: "2026-11-06T07:30:00+05:30",
    ageSeconds: 9000,
    targetSeconds: 259200,
    sla: "onTrack",
    priority: "normal",
    reviewer: null,
    documents: ["Government ID", "Credentials"],
    riskScore: 12,
    riskLevel: "low",
  },
  {
    id: "VER-4418",
    type: "employer",
    typeLabel: "Employer",
    companyName: "DataSys",
    category: "Business verification",
    status: "pending",
    submittedAt: "2026-11-03T16:00:00+05:30",
    ageSeconds: 259200,
    targetSeconds: 172800,
    sla: "breached",
    priority: "urgent",
    reviewer: null,
    documents: ["Business registration", "Tax ID"],
    riskScore: 30,
    riskLevel: "medium",
  },
  {
    id: "VER-4419",
    type: "investor",
    typeLabel: "Investor",
    companyName: "Alpha Fund",
    category: "KYC verification",
    status: "pending",
    submittedAt: "2026-11-06T06:00:00+05:30",
    ageSeconds: 14400,
    targetSeconds: 172800,
    sla: "onTrack",
    priority: "normal",
    reviewer: null,
    documents: ["KYC form", "Source of funds"],
    riskScore: 55,
    riskLevel: "medium",
  },
];

const filterOptions = {
  type: ["All types", "Startups", "Mentors", "Investors (KYC)", "Employers"],
  status: ["All statuses", "Pending", "Claimed", "Approved", "Rejected", "Needs changes"],
  priority: ["All priorities", "Normal", "High", "Urgent"],
  sla: ["All SLA", "On track", "At risk", "Breached"],
};

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

function AdminSidebar({ active, onThemeToggle }) {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark-theme"));
  }, []);
  return (
    <aside className="fixed inset-y-0 left-0 z-20 w-[232px] flex-col border-r border-solid border-[#E5E1D8] bg-[#0F1B2D] text-white lg:block">
      <div className="flex h-[64px] items-center justify-between border-b border-solid border-white/10 px-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-white/30 font-serif">
            ADM
          </span>
          <b className="text-xs font-semibold tracking-wide uppercase">Admin</b>
        </div>
        <BtnIcon size="small" secondary icon={isDark ? Sun : Moon} title={isDark ? "Light theme" : "Dark theme"} onClick={onThemeToggle} />
      </div>
      <nav className="mt-4 space-y-0.5 px-2">
        {sidebarItems.map(([n, I, u]) => {
          const Comp = I;
          const isActive = n === active;
          return (
            <Link key={n} href={u} className={`relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[12px] ${isActive ? "bg-[#1C2B42] text-white" : "text-white/70 hover:bg-white/10 transition"}`}>
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

function FilterBar({ filters, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 items-end mb-6">
      {Object.entries(filterOptions).map(([id, options]) => (
        <div key={id} className="flex items-center gap-2">
          <span className="text-[11px] text-[#4A5568] font-medium">{id.charAt(0).toUpperCase() + id.slice(1)}:</span>
          <select value={filters[id]} onChange={(e) => onChange(id, e.target.value)} className="h-10 rounded-[10px] border border-solid border-[#E5E1D8] bg-white pl-3 pr-10 text-[12px] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%234A5568%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M6 9l6 6 6-6%22></path></svg>')] bg-no-repeat bg-right-2.5 bg-center-[10px]">
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function VerificationRow({ v, onClaim, onOpen }) {
  const riskTint = v.riskLevel === "high" ? `border-[#FBE9E7] text-[#B42318]` : v.riskLevel === "medium" ? `border-[#FDF3E0] text-[#9A6210]` : `border-[#E7F3EC] text-[#286749]`;
  const riskLabel = v.riskLevel.charAt(0).toUpperCase() + v.riskLevel.slice(1);
  return (
    <tr key={v.id} className="hover:bg-[#F3EBDD]/50 transition border-b border-solid border-[#E5E1D8]/50 last:border-0 group">
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#F3EBDD] text-[#806236] text-xs font-bold">
            {v.type.charAt(0).toUpperCase()}
          </div>
          <div>
            <b className="text-[12px] text-[#0F1B2D] font-medium">{v.id}</b>
            <p className="text-[11px] text-[#4A5568]">{v.companyName}</p>
          </div>
        </div>
      </td>
      <td className="py-4 text-[12px] text-[#4A5568]">{v.category}</td>
      <td className="py-4">
        <StatChip status={v.sla} />
      </td>
      <td className="py-4 text-right">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskTint}`}>
          {riskLabel} risk · {v.riskScore}
        </span>
      </td>
      <td className="py-4 text-[12px] text-[#4A5568]">
        {formatAge(v.ageSeconds)}
      </td>
      <td className="py-4 text-right">
        {v.status === "claimed" ? (
          <span className="text-[11px] text-[#4A5568]">{v.reviewer}</span>
        ) : (
          <Btn size="small" secondary onClick={(e) => { e.stopPropagation(); onClaim(v.id); }} className="px-2.5 py-1.5 min-w-[64px]">
            Claim
          </Btn>
        )}
      </td>
      <td className="py-4 text-right">
        <BtnIcon size="small" secondary icon={LinkIcon} title="Open" onClick={() => onOpen(v.id)} />
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
/*  Page: Admin Verification and Approvals                            */
/* ------------------------------------------------------------------ */
function AdminVerificationPage() {
  const { theme, setTheme, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));
  const [filters, setFilters] = useState({
    type: "All types",
    status: "All statuses",
    priority: "All priorities",
    sla: "All SLA",
  });

  const filtered = useMemo(() => {
    return verifications.filter((v) => {
      if (filters.type !== "All types" && v.typeLabel !== filters.type) return false;
      if (filters.status !== "All statuses") {
        const statusMap = { Pending: "pending", Claimed: "claimed", Approved: "approved", Rejected: "rejected", "Needs changes": "needs-changes" };
        if (v.status !== statusMap[filters.status]) return false;
      }
      if (filters.priority !== "All priorities" && v.priority !== filters.priority.toLowerCase()) return false;
      if (filters.sla !== "All SLA" && v.sla !== filters.sla.toLowerCase()) return false;
      return true;
    });
  }, [filters]);

  const stats = useMemo(() => {
    return {
      pending: verifications.filter((v) => v.status === "pending").length,
      claimed: verifications.filter((v) => v.status === "claimed").length,
      atRisk: verifications.filter((v) => v.sla === "atRisk").length,
      breached: verifications.filter((v) => v.sla === "breached").length,
    };
  }, [verifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const t = setTimeout(() => {
      setRefreshing(false);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));
      toast("Verifications refreshed");
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const handleClaim = useCallback((id) => {
    const v = verifications.find((x) => x.id === id);
    if (v && v.status === "pending") {
      toast(`Claimed ${id} — lock active for 10 minutes`);
    }
  }, []);

  const handleOpen = useCallback((id) => {
    const v = verifications.find((x) => x.id === id);
    if (v) {
      setDrawerItem(v);
      setDrawerOpen(true);
    }
  }, []);

  const handleReview = useCallback((decision) => {
    if (!drawerItem) return;
    setDrawerOpen(false);
    toast(`${drawerItem.id}: ${decision} — recorded in audit log`);
  }, [drawerItem]);

  return (
    <div className={`min-h-screen bg-[#FAF8F4] text-[#0F1B2D] ${isDark ? `bg-[#0B1422] text-[#F2EFE8]` : ""}`}>
      <a href="#verifications-main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-[#0F1B2D] text-white px-4 py-2">
        Skip to content
      </a>

      <EnvironmentStrip />
      {IncidentBanner()}
      <TopBar onRefresh={handleRefresh} />

      <div className="flex flex-col lg:flex-row" id="verifications-main">
        <AdminSidebar active="Verifications" onThemeToggle={() => setTheme(isDark ? "light" : "dark")} />

        <main className="flex-1 min-w-0 pt-6 lg:pt-8 lg:pl-[232px] lg:px-8 pb-24">
          <SectionHead title="Verifications &amp; Approvals" subtitle={`Updated ${lastUpdated} IST · ${filtered.length} of ${verifications.length} items`}>
            <div className="flex items-center gap-2">
              <Btn size="small" secondary icon={RefreshCcw} onClick={handleRefresh} title="Refresh" />
              <Btn size="small" secondary icon={Filter} onClick={() => toast("Filters applied")} />
            </div>
          </SectionHead>

          {/* Stats strip */}
          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <VerificationStatCard label="Pending review" value={stats.pending} sub="Waiting for assignment" color={INK} />
            <VerificationStatCard label="Claimed" value={stats.claimed} sub="Being reviewed now" color={GOLD_DARK} />
            <VerificationStatCard label="At risk" value={stats.atRisk} sub="Over 75% of target used" color={WARNING} />
            <VerificationStatCard label="Breached" value={stats.breached} sub="Past service target" color={ERROR} />
          </div>

          {/* Filters */}
          <FilterBar filters={filters} onChange={(id, value) => setFilters({ ...filters, [id]: value })} />

          {/* Table */}
          <Card title="Verification queue" titleIcon={BuildingIcon}>
            <div className="px-5 pt-3 pb-4 overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse min-w-full">
                <thead>
                  <tr className="border-b border-solid border-[#E5E1D8]">
                    {["Verification", "Category", "SLA", "Risk", "Age", "Claimed by", "Open"].map((h) => (
                      <th key={h} className="pb-3 text-[11px] text-[#4A5568] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-solid divide-[#E5E1D8]/50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-[12px] text-[#4A5568]">
                        No verifications match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((v) => (
                      <VerificationRow key={v.id} v={v} onClaim={handleClaim} onOpen={handleOpen} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 pt-3 pb-4 flex items-center justify-between">
              <p className="text-[11px] text-[#4A5568]">
                Showing {filtered.length} of {verifications.length} verifications
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#4A5568]">View:</span>
                <Btn size="small" secondary className="px-2 py-1.5" icon={LayoutGrid} />
                <Btn size="small" secondary className="px-2 py-1.5" icon={LayoutList} />
              </div>
            </div>
          </Card>

          <div className="mt-8 px-5 lg:px-0 text-center lg:text-left">
            <p className="text-[11px] text-[#4A5568]">
              Counts, IDs and categories only. No personal data on this page.
              All actions are logged to the audit trail.
            </p>
          </div>
        </main>
      </div>

      {drawerOpen && drawerItem && (
        <DetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Review: ${drawerItem.id}`}>
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">Verification details</h4>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">ID:</b> {drawerItem.id}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Type:</b> {drawerItem.typeLabel}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Category:</b> {drawerItem.category}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Entity:</b> {drawerItem.companyName}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Submitted:</b> {drawerItem.submittedAt}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Age:</b> {formatAge(drawerItem.ageSeconds)}</p>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">Status &amp; SLA</h4>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Status:</b> <StatChip status={drawerItem.status} /></p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">SLA:</b> <StatChip status={drawerItem.sla} /></p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Priority:</b> {drawerItem.priority}</p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Risk:</b> <span className={`text-[10px] font-medium ${drawerItem.riskLevel === 'high' ? ERROR_DARK : drawerItem.riskLevel === 'medium' ? WARNING_DARK : SUCCESS_DARK}`}>{drawerItem.riskLevel.charAt(0).toUpperCase() + drawerItem.riskLevel.slice(1)} ({drawerItem.riskScore})</span></p>
                <p className="text-[12px] text-[#4A5568] mb-1"><b className="text-[#0F1B2D]">Reviewer:</b> {drawerItem.reviewer || "Unassigned"}</p>
              </div>
            </div>

            <Card title="Documents submitted" titleIcon={FileIcon}>
              <div className="px-5 pt-3 pb-4 space-y-3">
                {drawerItem.documents.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-[10px] border border-solid border-[#E5E1D8] bg-white">
                    <span className="text-[12px] text-[#0F1B2D]">{doc}</span>
                    <BtnIcon size="small" secondary icon={Download} title={`Download ${doc}`} onClick={() => toast(`Downloading ${doc}...`)} />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Review decision" titleIcon={Scale}>
              <div className="px-5 pt-3 pb-4 space-y-4">
                <p className="text-[12px] text-[#4A5568]">
                  Select a decision. A reason is required for rejection and needs-changes.
                  The decision is recorded in the audit log with your name and timestamp.
                </p>
                <div className="flex gap-2">
                  <Btn onClick={() => handleReview("Approved")} className="flex-1">
                    Approve
                  </Btn>
                  <Btn secondary onClick={() => handleReview("Rejected")} className="flex-1">
                    Reject
                  </Btn>
                  <Btn secondary onClick={() => handleReview("Needs changes")} className="flex-1">
                    Needs changes
                  </Btn>
                </div>
                <div className="bg-[#F3EBDD] border border-solid border-[#F3EBDD] rounded-[10px] p-3">
                  <p className="text-[11px] text-[#806236] mb-2"><b className="text-[#806236]">Note:</b> Claims expire after 10 minutes of inactivity. Released items return to the queue.</p>
                </div>
              </div>
            </Card>

            <div className="flex gap-2 pt-4">
              <Btn onClick={() => setDrawerOpen(false)} className="flex-1">Close review</Btn>
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
