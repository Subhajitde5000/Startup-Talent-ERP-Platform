"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Settings,
  LayoutDashboard,
  Briefcase,
  FileText,
  BarChart3,
  Shield,
  Activity,
  Users,
  Mail,
  Award as AwardIcon,
  Clock,
  AlertCircle,
  Info,
  X,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Star,
  ChevronLeft,
  ShieldCheck,
  Headphones,
  Globe,
  Download,
  LayoutGrid,
  List,
  LineChart,
  PieChart,
  Banknote,
  Ticket,
  Target,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Eye,
  User as UserIcon,
  UserRound,
  Copy,
  Printer,
  Wrench,
  Lock,
  Link as LinkIcon,
  Share2,
  RefreshCcw,
  CreditCard,
  Wallet,
  Gauge,
  Scale,
  LayoutList,
  Inbox,
  Paperclip,
  Unlock,
  Building as BuildingIcon,
  Briefcase as BriefcaseIcon,
  Monitor,
  Activity as ActivityIcon,
  File as FileIcon,
  Image as ImageIcon,
  Plus,
  Minus,
  Trash2,
  Edit,
  Save,
  Send,
  Link as Link2Icon,
  Calendar as CalendarIcon,
  User as User2Icon,
  Monitor as MonitorIcon,
  Sun,
  Moon,
  Layout,
  PanelLeft,
  PanelTop,
  Folder,
  MessageCircle,
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

// Dark theme tokens
const DARK_BG = "#0B1422";
const DARK_SURFACE = "#142033";
const DARK_SURFACE_RAISED = "#1A2A42";
const DARK_TEXT = "#F2EFE8";
const DARK_TEXT_MUTED = "#A9B2C1";
const DARK_BORDER = "#26364D";
const DARK_GOLD = "#C9A66B";
const DARK_SUCCESS = "#4FB08A";
const DARK_WARNING = "#D9A441";
const DARK_ERROR = "#E5675C";

const RADIUS_CARD = "rounded-[12px]";
const RADIUS_CONTROL = "rounded-[10px]";

/* ------------------------------------------------------------------ */
/*  Mock user / roles (server enforces in production)                 */
/* ------------------------------------------------------------------ */
const user = {
  name: "Alex Kumar",
  internalRole: "Super admin",
  internalRoles: ["Super admin", "Verification reviewer", "Trust and safety moderator"],
  sessionExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  idleTimeoutAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  theme: "system", // system | light | dark
  density: "comfortable", // comfortable | compact
};

const environment = "production"; // production | staging

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
/*  Theme detection                                                   */
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
    <section
      className={`border border-solid ${RADIUS_CARD} bg-white ${className} ${padding}`}
    >
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

function BtnIcon({ onClick, secondary, size, className = "", icon: Icon, title, destructive }) {
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
      <Icon size={size === "small" ? 13 : 16} />
    </button>
  );
}

function StatChip({ status, count }) {
  const maps = {
    onTrack: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    atRisk: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    breached: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    operational: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
    degraded: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
    outage: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
    maintenance: `border-[#E8F0F8] bg-[#E8F0F8] text-[#2F5D8A]`,
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${maps[status] || maps.onTrack}`}
    >
      {status === "breached" && count ? `Breached · ${count}` : status}
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

function Sparkline({ values, color = INK }) {
  const pts = values.map((v, i) => `${i * 30},${40 - v * 20}`).join(" ");
  return (
    <svg width={values.length * 30} height={40} className="opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function DetailDrawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[640px] h-full flex flex-col bg-white border-l border-solid border-[#E5E1D8] shadow-lg ml-auto">
        <div className="flex items-center justify-between border-b border-solid border-[#E5E1D8] px-6 py-4 bg-[#FAF8F4]">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <BtnIcon size="small" secondary onClick={onClose} icon={X} title="Close" />
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function SeverityRow({ severity, text, count, age, onOpen, onAcknowledge, acknowledged }) {
  const sev = severity || 2;
  const tint =
    sev === 1 ? `border-[#FBE9E7] text-[#B42318]` : sev === 2 ? `border-[#FDF3E0] text-[#9A6210]` : `border-[#E8F0F8] text-[#2F5D8A]`;
  const IconComp = sev === 1 ? AlertTriangle : sev === 2 ? Clock : Info;
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-[10px] border border-solid border-[#E5E1D8] bg-white">
      <div className="flex items-center gap-2">
        <div className={`grid h-8 w-8 place-items-center rounded-full ${tint}`}>
          <IconComp size={14} />
        </div>
        <div>
          <b className="text-[12px] text-[#0F1B2D]">{text}</b>
          <p className="text-[11px] text-[#4A5568] mt-0.5">
            {count} · {age}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <BtnIcon size="small" secondary icon={LinkIcon} title="Open" onClick={onOpen} />
        {!acknowledged && (
          <BtnIcon
            size="small"
            secondary
            icon={CheckCircle2}
            title="Acknowledge"
            onClick={onAcknowledge}
          />
        )}
        {acknowledged && (
          <span className="text-[10px] text-[#4A5568]">Acked</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                         */
/* ------------------------------------------------------------------ */

const queues = [
  {
    key: "verifications_startup",
    label: "Verifications · Startups",
    icon: BuildingIcon,
    count: 7,
    assignedToMe: 1,
    oldestSeconds: 108000,
    targetSeconds: 172800,
    atRiskCount: 2,
    breachedCount: 0,
    ageBands: { lt25: 3, "25to75": 2, gt75: 2, breached: 0 },
    weekdayTrend: 6,
    updatedAt: "2026-11-06T09:02:05+05:30",
    link: "/verifications?type=startup",
    status: "onTrack",
  },
  {
    key: "verifications_mentor",
    label: "Verifications · Mentors",
    icon: UserRound,
    count: 4,
    assignedToMe: 0,
    oldestSeconds: 72000,
    targetSeconds: 259200,
    atRiskCount: 0,
    breachedCount: 0,
    ageBands: { lt25: 2, "25to75": 1, gt75: 1, breached: 0 },
    weekdayTrend: -2,
    updatedAt: "2026-11-06T09:01:40+05:30",
    link: "/verifications?type=mentor",
    status: "onTrack",
  },
  {
    key: "verifications_investor",
    label: "Verifications · Investors (KYC)",
    icon: ShieldCheck,
    count: 3,
    assignedToMe: 0,
    oldestSeconds: 36000,
    targetSeconds: 172800,
    atRiskCount: 0,
    breachedCount: 0,
    ageBands: { lt25: 1, "25to75": 1, gt75: 1, breached: 0 },
    weekdayTrend: 0,
    updatedAt: "2026-11-06T09:00:15+05:30",
    link: "/verifications?type=investor",
    status: "onTrack",
  },
  {
    key: "verifications_employer",
    label: "Verifications · Employers",
    icon: BriefcaseIcon,
    count: 5,
    assignedToMe: 2,
    oldestSeconds: 144000,
    targetSeconds: 172800,
    atRiskCount: 1,
    breachedCount: 0,
    ageBands: { lt25: 2, "25to75": 2, gt75: 0, breached: 0 },
    weekdayTrend: 4,
    updatedAt: "2026-11-06T08:55:30+05:30",
    link: "/verifications?type=employer",
    status: "atRisk",
  },
  {
    key: "moderation",
    label: "Moderation",
    icon: ShieldAlert,
    count: 12,
    assignedToMe: 3,
    oldestSeconds: 10800,
    targetSeconds: 14400,
    atRiskCount: 0,
    breachedCount: 0,
    ageBands: { lt25: 6, "25to75": 4, gt75: 1, breached: 0 },
    weekdayTrend: 8,
    updatedAt: "2026-11-06T09:01:55+05:30",
    link: "/moderation",
    status: "onTrack",
  },
  {
    key: "reports",
    label: "Reports",
    icon: AlertCircle,
    count: 6,
    assignedToMe: 0,
    oldestSeconds: 54000,
    targetSeconds: 86400,
    atRiskCount: 1,
    breachedCount: 0,
    ageBands: { lt25: 3, "25to75": 2, gt75: 1, breached: 0 },
    weekdayTrend: -1,
    updatedAt: "2026-11-06T08:50:00+05:30",
    link: "/reports",
    status: "atRisk",
  },
  {
    key: "appeals",
    label: "Appeals",
    icon: Scale,
    count: 2,
    assignedToMe: 0,
    oldestSeconds: 172800,
    targetSeconds: 432000,
    atRiskCount: 0,
    breachedCount: 0,
    ageBands: { lt25: 1, "25to75": 0, gt75: 1, breached: 0 },
    weekdayTrend: 0,
    updatedAt: "2026-11-06T08:30:00+05:30",
    link: "/appeals",
    status: "onTrack",
  },
  {
    key: "disputes",
    label: "Disputes",
    icon: AwardIcon,
    count: 1,
    assignedToMe: 0,
    oldestSeconds: 3600,
    targetSeconds: 432000,
    atRiskCount: 0,
    breachedCount: 0,
    ageBands: { lt25: 1, "25to75": 0, gt75: 0, breached: 0 },
    weekdayTrend: 0,
    updatedAt: "2026-11-06T09:02:00+05:30",
    link: "/disputes",
    status: "onTrack",
  },
  {
    key: "support",
    label: "Support tickets",
    icon: MessageCircle,
    count: 14,
    assignedToMe: 4,
    oldestSeconds: 7200,
    targetSeconds: 3600,
    atRiskCount: 3,
    breachedCount: 0,
    ageBands: { lt25: 8, "25to75": 3, gt75: 3, breached: 0 },
    weekdayTrend: 12,
    updatedAt: "2026-11-06T09:01:20+05:30",
    link: "/support",
    status: "atRisk",
  },
  {
    key: "data_requests",
    label: "Data rights requests",
    icon: FileText,
    count: 3,
    assignedToMe: 0,
    oldestSeconds: 43200,
    targetSeconds: 86400,
    atRiskCount: 0,
    breachedCount: 1,
    ageBands: { lt25: 1, "25to75": 1, gt75: 0, breached: 1 },
    weekdayTrend: 1,
    updatedAt: "2026-11-06T08:45:00+05:30",
    link: "/data-requests",
    status: "breached",
  },
  {
    key: "fraud",
    label: "Fraud alerts",
    icon: ShieldAlert,
    count: 0,
    assignedToMe: 0,
    oldestSeconds: 0,
    targetSeconds: 3600,
    atRiskCount: 0,
    breachedCount: 0,
    ageBands: { lt25: 0, "25to75": 0, gt75: 0, breached: 0 },
    weekdayTrend: -5,
    updatedAt: "2026-11-06T09:02:00+05:30",
    link: "/fraud",
    status: "onTrack",
  },
  {
    key: "ai_quality",
    label: "AI quality reviews",
    icon: MonitorIcon,
    count: 8,
    assignedToMe: 1,
    oldestSeconds: 86400,
    targetSeconds: 432000,
    atRiskCount: 0,
    breachedCount: 0,
    ageBands: { lt25: 4, "25to75": 3, gt75: 1, breached: 0 },
    weekdayTrend: 2,
    updatedAt: "2026-11-06T08:58:00+05:30",
    link: "/ai-quality",
    status: "onTrack",
  },
  {
    key: "payouts",
    label: "Payout and refund approvals",
    icon: Banknote,
    count: 5,
    assignedToMe: 2,
    oldestSeconds: 18000,
    targetSeconds: 36000,
    atRiskCount: 0,
    breachedCount: 0,
    ageBands: { lt25: 3, "25to75": 1, gt75: 1, breached: 0 },
    weekdayTrend: 3,
    updatedAt: "2026-11-06T09:00:45+05:30",
    link: "/payouts",
    status: "onTrack",
  },
];

const attention = [
  {
    id: "al_912",
    severity: 1,
    type: "sla_breach",
    text: "12 support tickets breached target",
    count: 12,
    ageSeconds: 2400,
    link: "/support?sla=breached",
    acknowledged: false,
  },
  {
    id: "al_913",
    severity: 2,
    type: "fraud_spike",
    text: "Fee-request reports up 40% in 1 hour",
    count: 3,
    ageSeconds: 3600,
    link: "/reports?type=fee-request",
    acknowledged: false,
  },
  {
    id: "al_914",
    severity: 2,
    type: "verification_expiring",
    text: "Employer verifications expiring in 7 days",
    count: 6,
    ageSeconds: 7200,
    link: "/verifications/expiring",
    acknowledged: true,
  },
  {
    id: "al_915",
    severity: 3,
    type: "data_request_deadline",
    text: "Data request deadline in 3 days",
    count: 2,
    ageSeconds: 86400,
    link: "/data-requests",
    acknowledged: false,
  },
];

const health = [
  { service: "Web and API", status: "operational", metric: "availability", value: 99.9, trend: "stable", link: "/system#web" },
  { service: "Authentication", status: "operational", metric: "sign-in success", value: 99.8, trend: "stable", link: "/system#auth" },
  { service: "Payments", status: "degraded", metric: "success rate", value: 96.2, trend: "down", link: "/system#payments" },
  { service: "Email", status: "operational", metric: "delivery rate", value: 98.5, trend: "up", link: "/system#email" },
  { service: "Video sessions", status: "operational", metric: "join success", value: 99.2, trend: "stable", link: "/system#video" },
  { service: "AI services", status: "degraded", metric: "queue lag", value: 45, trend: "up", link: "/system#ai" },
  { service: "Verification providers", status: "operational", metric: "response time", value: 1.2, trend: "stable", link: "/system#verification" },
  { service: "File storage", status: "operational", metric: "scan queue lag", value: 2, trend: "down", link: "/system#storage" },
];

const incidents = [
  { id: "inc_77", status: "open", severity: "minor", title: "Payment retries delayed", startedAt: "2026-11-06T08:41:00+05:30" },
];

const maintenance = [];

const pulse = {
  range: "24h",
  registrationsByRole: [
    { role: "Startups", count: 45 },
    { role: "Mentors", count: 28 },
    { role: "Investors", count: 12 },
    { role: "Job seekers", count: 180 },
    { role: "Employers", count: 34 },
  ],
  verificationFunnel: [
    { stage: "Submitted", count: 120 },
    { stage: "Approved", count: 85 },
    { stage: "Rejected", count: 20 },
    { stage: "Needs changes", count: 15 },
  ],
  activeJobs: 340,
  applicationsPerDay: 1240,
  sessionsHeld: 89,
  payments: { successRate: 98.1, failed: 14 },
  supportVolume: 56,
  firstResponseTime: "42 min",
};

const deadlines = {
  dataRequests: {
    overdue: 0,
    today: 1,
    next3: 2,
    next7: 5,
    nearestDueAt: "2026-11-07T18:00:00+05:30",
  },
};

const workload = [
  { queue: "Support", unassigned: 9, assigned: 14, inReview: 5, activeStaff: 6 },
  { queue: "Moderation", unassigned: 4, assigned: 8, inReview: 3, activeStaff: 4 },
  { queue: "Verifications", unassigned: 6, assigned: 5, inReview: 2, activeStaff: 3 },
];

const myWork = [
  { queue: "Moderation", itemId: "MOD-9981", claimedSeconds: 900 },
  { queue: "Verifications · Startups", itemId: "VER-4412", claimedSeconds: 1800 },
];

/* ------------------------------------------------------------------ */
/*  Role-based visibility (Part 5)                                    */
/* ------------------------------------------------------------------ */
const roleConfig = {
  "Super admin": { queues: queues.map((q) => q.key), sections: ["all"] },
  "Verification reviewer": {
    queues: ["verifications_startup", "verifications_mentor", "verifications_investor", "verifications_employer", "verifications_expiring"],
    sections: ["health", "deadlines", "myWork"],
  },
  "Trust and safety moderator": {
    queues: ["moderation", "reports", "appeals", "fraud"],
    sections: ["attention", "health", "pulse", "myWork"],
  },
  "Support agent": {
    queues: ["support", "data_requests"],
    sections: ["attention", "health", "myWork"],
  },
  Finance: {
    queues: ["payouts", "disputes"],
    sections: ["paymentsPulse", "health", "myWork"],
  },
  "Content and program manager": {
    queues: [],
    sections: ["pulse", "contentUpdates"],
  },
  "AI quality reviewer": {
    queues: ["ai_quality"],
    sections: ["aiHealth", "pulse", "myWork"],
  },
  "Compliance officer": {
    queues: ["data_requests"],
    sections: ["deadlines", "auditExport"],
  },
  Analyst: {
    queues: [],
    sections: ["pulse"],
  },
};

function visibleQueues() {
  const keys = new Set();
  user.internalRoles.forEach((r) => {
    const cfg = roleConfig[r];
    if (cfg) cfg.queues.forEach((k) => keys.add(k));
  });
  return queues.filter((q) => keys.has(q.key));
}

function showSection(section) {
  return user.internalRoles.some((r) => {
    const cfg = roleConfig[r];
    return cfg && (cfg.sections.includes("all") || cfg.sections.includes(section));
  });
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

function slaStatus(q) {
  if (q.breachedCount > 0) return "breached";
  if (q.atRiskCount > 0 || q.oldestSeconds / q.targetSeconds >= 0.75) return "atRisk";
  return "onTrack";
}

function oldestAge(q) {
  const ratio = q.oldestSeconds / q.targetSeconds;
  if (ratio >= 1) return `Breached · ${formatAge(q.oldestSeconds)}`;
  if (ratio >= 0.75) return `At risk · ${formatAge(q.oldestSeconds)}`;
  return `Oldest · ${formatAge(q.oldestSeconds)}`;
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */
const sidebarItems = [
  ["Dashboard", LayoutDashboard, "/dashboard"],
  ["Verifications", BuildingIcon, "/verifications"],
  ["Moderation", ShieldAlert, "/moderation"],
  ["Reports", AlertCircle, "/reports"],
  ["Appeals", Scale, "/appeals"],
  ["Disputes", AwardIcon, "/disputes"],
  ["Fraud", ShieldAlert, "/fraud"],
  ["Support", MessageCircle, "/support"],
  ["Data requests", FileText, "/data-requests"],
  ["Users", Users, "/users"],
  ["Organizations", BuildingIcon, "/organizations"],
  ["Content", FileIcon, "/content"],
  ["Templates", FileText, "/templates"],
  ["Rubrics", List, "/rubrics"],
  ["Events", CalendarIcon, "/events"],
  ["Billing", Banknote, "/billing"],
  ["Analytics", BarChart3, "/analytics"],
  ["Compliance", ShieldCheck, "/compliance"],
  ["Audit", ActivityIcon, "/audit"],
  ["System", MonitorIcon, "/system"],
  ["Configuration", Wrench, "/configuration"],
];

function AdminSidebar({ active, onThemeToggle, onDensityToggle }) {
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
        <BtnIcon
          size="small"
          secondary
          icon={isDark ? Sun : Moon}
          title={isDark ? "Light theme" : "Dark theme"}
          onClick={onThemeToggle}
        />
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
        <BtnIcon
          size="small"
          secondary
          icon={Settings}
          title="Settings"
          onClick={() => toast("Settings opening")}
        />
        <BtnIcon
          size="small"
          secondary
          icon={HelpCircle}
          title="Runbooks"
          onClick={() => toast("Runbooks opening")}
        />
        <button
          type="button"
          onClick={() => toast("Signing out")}
          className="flex w-full items-center gap-3 rounded-[10px] border border-white/10 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/10 transition"
        >
          <span className="flex-shrink-0">Sign out</span>
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Components                                                        */
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
  const open = incidents.filter((i) => i.status === "open");
  if (open.length === 0 && maintenance.length === 0) return null;
  return (
    <div className="border-b border-solid border-[#E5E1D8] bg-[#FBE9E7] text-[#B42318] px-4 py-2 flex items-center gap-2 text-[12px]">
      <AlertCircle size={14} />
      <span>
        {open[0]?.title || "Scheduled maintenance"}{" "}
        <span className="font-semibold">· Open incident</span>
      </span>
    </div>
  );
}

function TopBar({ onRefresh }) {
  const now = new Date();
  const istTime = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
  return (
    <header className="sticky top-0 z-10 flex h-[56px] items-center justify-between border-b border-solid border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => toast("Command palette opening")}
          className={`flex h-10 w-10 items-center justify-center rounded-[10px] border border-solid border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F3EBDD] transition`}
          title="Search and commands (⌘K)"
        >
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
        <button
          type="button"
          className="flex items-center gap-2 rounded-[10px] border border-solid border-[#E5E1D8] bg-white px-3 py-2 text-left"
          onClick={() => toast("Profile menu opening")}
        >
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

function NextUpCard({ nextUp, onStart, onSkip, onViewQueue }) {
  if (!nextUp) {
    return (
      <Card title="Next up" titleIcon={Star}>
        <div className="px-5 py-4 text-center">
          <CheckCircle2 size={20} className="text-[#286749] mx-auto mb-2" />
          <h3 className="text-[14px] font-semibold text-[#0F1B2D] mb-1">You're all caught up</h3>
          <p className="text-[12px] text-[#4A5568]">Nothing is waiting in your queues.</p>
        </div>
      </Card>
    );
  }
  const waited = formatAge(nextUp.waitingSeconds);
  const targetLeft = formatAge(Math.max(0, nextUp.targetSeconds - nextUp.waitingSeconds));
  return (
    <Card title="Next up" titleIcon={Star} className="border-[#B8955A] bg-[#F3EBDD]">
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center rounded-full border border-[#B8955A] bg-[#F3EBDD] px-2 py-0.5 text-[10px] font-medium text-[#806236]">
            Suggested
          </span>
          <span className="ml-auto text-[11px] text-[#4A5568]">
            Breaches in {targetLeft} · Oldest in queue
          </span>
        </div>
        <div className="space-y-2">
          <b className="text-[14px] font-serif font-semibold text-[#0F1B2D]">{nextUp.itemId}</b>
          <p className="text-[12px] text-[#4A5568]">{nextUp.queue} · {nextUp.category}</p>
          <p className="text-[12px] text-[#4A5568]">
            Waiting {waited} · Target {nextUp.targetSeconds / 3600}h
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={onStart}>Start review</Btn>
          <Btn size="small" secondary onClick={onSkip}>Skip for now</Btn>
          <Btn size="small" secondary onClick={onViewQueue}>View queue</Btn>
        </div>
      </div>
    </Card>
  );
}

function QueueCard({ q, onOpen }) {
  const status = slaStatus(q);
  const atRisk = status === "atRisk";
  const breached = status === "breached";
  const totalBands =
    q.ageBands.lt25 + q.ageBands["25to75"] + q.ageBands.gt75 + q.ageBands.breached;
  return (
    <Link
      href={q.link}
      className="block"
      onClick={(e) => {
        e.preventDefault();
        onOpen(q.key);
      }}
    >
      <Card
        title={q.label}
        titleIcon={q.icon}
        className={`border-solid border-[#E5E1D8] hover:border-[#B8955A]/50 transition ${breached ? "border-[#B42318]" : ""}`}
      >
        <div className="px-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <b className="text-[32px] font-serif font-semibold text-[#0F1B2D] tabular-nums">
                {q.count}
              </b>
              {q.assignedToMe > 0 && (
                <span className="text-[11px] text-[#4A5568]">· {q.assignedToMe} yours</span>
              )}
            </div>
            <StatChip status={status} count={breached ? q.breachedCount : undefined} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <p className="text-[11px] text-[#4A5568]">{oldestAge(q)}</p>
              <div className="w-full h-1.5 bg-[#E5E1D8] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(((q.ageBands.lt25 + q.ageBands["25to75"]) / Math.max(totalBands, 1)) * 100, 100)}%`,
                    backgroundColor: breached ? ERROR : atRisk ? WARNING : GOLD,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <span className={`text-[11px] font-medium ${breached ? ERROR_DARK : atRisk ? WARNING_DARK : SUCCESS_DARK}`}>
                {breached ? "▲" : atRisk ? "▲" : "▼"} {q.weekdayTrend >= 0 ? "+" : ""}{q.weekdayTrend} vs last week
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-solid border-[#E5E1D8]/30">
            <Btn size="small" secondary className="w-full text-left" onClick={(e) => e.stopPropagation()}>
              Open queue
            </Btn>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function QueuesGrid({ queues, onOpen }) {
  const visible = visibleQueues();
  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No queues assigned"
        subtitle="You don't have any queues assigned. Ask a Super admin."
        action={() => toast("Opening staff directory")}
        actionLabel="Staff directory"
      />
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {visible.map((q) => (
        <QueueCard key={q.key} q={q} onOpen={onOpen} />
      ))}
    </div>
  );
}

function NeedsAttention({ attention, onOpen, onAcknowledge }) {
  const visible = showSection("attention");
  if (!visible) return null;
  const unacknowledged = attention.filter((a) => !a.acknowledged);
  return (
    <Card title="Needs attention" titleIcon={AlertCircle}>
      <div className="px-5 pt-3 pb-4 space-y-3">
        {unacknowledged.length === 0 ? (
          <p className="text-[12px] text-[#4A5568] text-center py-4">No items need your attention right now.</p>
        ) : (
          <div className="space-y-2">
            {unacknowledged.slice(0, 8).map((a) => (
              <SeverityRow
                key={a.id}
                severity={a.severity}
                text={a.text}
                count={a.count}
                age={formatAge(a.ageSeconds)}
                onOpen={() => {
                  onOpen(a.link);
                  toast("Opening item");
                }}
                onAcknowledge={() => {
                  onAcknowledge(a.id);
                  toast("Acknowledged");
                }}
                acknowledged={false}
              />
            ))}
            {attention.length > 8 && (
              <Btn size="small" secondary className="w-full text-left" onClick={() => toast("Viewing all alerts")}>
                View all ({attention.length})
              </Btn>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function PlatformHealth({ health, incidents, maintenance }) {
  const visible = showSection("health");
  if (!visible) return null;
  return (
    <Card title="Platform health" titleIcon={MonitorIcon}>
      <div className="px-5 pt-3 pb-4 overflow-x-auto">
        <table className="w-full text-left text-[12px] border-collapse min-w-full">
          <thead>
            <tr className="border-b border-solid border-[#E5E1D8]">
              {["Service", "Status", "Metric", "Value", "Trend"].map((h) => (
                <th key={h} className="pb-3 text-[11px] text-[#4A5568] font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-solid divide-[#E5E1D8]">
            {health.map((s) => (
              <tr key={s.service} className="hover:bg-[#F3EBDD]/50 transition cursor-pointer" onClick={() => toast(`Opening ${s.service} status`)}>
                <td className="py-3 text-[#0F1B2D] font-medium">{s.service}</td>
                <td className="py-3">
                  <StatChip status={s.status} />
                </td>
                <td className="py-3 text-[#4A5568]">{s.metric}</td>
                <td className="py-3 text-right text-[#0F1B2D] font-medium">
                  {s.value}{s.metric.includes("rate") || s.metric.includes("success") ? "%" : ""}
                </td>
                <td className="py-3 text-right">
                  <span className={`text-[11px] font-medium ${s.trend === "down" ? ERROR_DARK : s.trend === "up" ? SUCCESS_DARK : STONE_700}`}>
                    {s.trend === "stable" ? "—" : s.trend === "up" ? "▲" : "▼"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 pt-3 pb-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#4A5568]">Open incidents</span>
          <span className="inline-flex items-center rounded-full border border-[#B42318] bg-[#FBE9E7] px-2 py-0.5 text-[10px] text-[#B42318] font-medium">
            {incidents.filter((i) => i.status === "open").length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#4A5568]">Upcoming maintenance</span>
          <span className="inline-flex items-center rounded-full border border-[#2F5D8A] bg-[#E8F0F8] px-2 py-0.5 text-[10px] text-[#2F5D8A] font-medium">
            {maintenance.length}
          </span>
        </div>
      </div>
    </Card>
  );
}

function PulseCharts({ pulse }) {
  const visible = showSection("pulse");
  if (!visible) return null;
  return (
    <Card title="Platform pulse" titleIcon={ActivityIcon}>
      <div className="px-5 pt-3 pb-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[#4A5568]">Last 24 hours</span>
          <Btn size="small" secondary onClick={() => toast("Opening charts table")}>
            View as table
          </Btn>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-[#E5E1D8]/30 rounded-[10px] p-3 h-40 flex items-end gap-1 w-full">
            {pulse.registrationsByRole.map((r) => (
              <div
                key={r.role}
                className="flex-1 bg-[#0F1B2D] rounded-t"
                style={{ height: `${(r.count / 180) * 100}%` }}
              />
            ))}
          </div>
          <div className="bg-[#E5E1D8]/30 rounded-[10px] p-3 h-40 flex items-end gap-1 w-full">
            {pulse.verificationFunnel.map((s) => (
              <div
                key={s.stage}
                className="flex-1 bg-[#B8955A] rounded-t"
                style={{ height: `${(s.count / 120) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="p-3 rounded-[10px] bg-[#F3EBDD] border border-solid border-[#F3EBDD]">
            <p className="text-[11px] text-[#806236] mb-1">Active jobs</p>
            <b className="text-[24px] font-serif font-semibold text-[#0F1B2D]">{pulse.activeJobs}</b>
          </div>
          <div className="p-3 rounded-[10px] bg-[#F3EBDD] border border-solid border-[#F3EBDD]">
            <p className="text-[11px] text-[#806236] mb-1">Applications today</p>
            <b className="text-[24px] font-serif font-semibold text-[#0F1B2D]">{pulse.applicationsPerDay}</b>
          </div>
          <div className="p-3 rounded-[10px] bg-[#F3EBDD] border border-solid border-[#F3EBDD]">
            <p className="text-[11px] text-[#806236] mb-1">Sessions held</p>
            <b className="text-[24px] font-serif font-semibold text-[#0F1B2D]">{pulse.sessionsHeld}</b>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DeadlinesCompliance({ deadlines }) {
  const visible = showSection("deadlines");
  if (!visible) return null;
  return (
    <Card title="Deadlines &amp; compliance" titleIcon={CalendarIcon}>
      <div className="px-5 pt-3 pb-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-4">
          {[
            { label: "Overdue", value: deadlines.dataRequests.overdue, color: ERROR },
            { label: "Due today", value: deadlines.dataRequests.today, color: WARNING },
            { label: "Next 3 days", value: deadlines.dataRequests.next3, color: INFO },
            { label: "Next 7 days", value: deadlines.dataRequests.next7, color: SUCCESS },
          ].map((d) => (
            <div key={d.label} className="p-3 rounded-[10px] bg-white border border-solid border-[#E5E1D8]">
              <b className="text-[24px] font-serif font-semibold text-[#0F1B2D]">{d.value}</b>
              <p className="text-[11px] text-[#4A5568] mt-1">{d.label}</p>
            </div>
          ))}
        </div>
        <div className="p-3 rounded-[10px] bg-[#F3EBDD] border border-solid border-[#F3EBDD]">
          <p className="text-[11px] text-[#806236] mb-1">Nearest legal deadline</p>
          <p className="text-[12px] text-[#0F1B2D] font-medium">
            {new Date(deadlines.dataRequests.nearestDueAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
          </p>
        </div>
        <Btn size="small" secondary className="w-full text-left" onClick={() => toast("Opening deadlines")}>
          View all deadlines
        </Btn>
      </div>
    </Card>
  );
}

function TeamWorkload({ workload }) {
  const visible = showSection("workload");
  if (!visible) return null;
  return (
    <Card title="Team workload" titleIcon={Users}>
      <div className="px-5 pt-3 pb-4 space-y-3 overflow-x-auto">
        <table className="w-full text-left text-[12px] border-collapse min-w-full">
          <thead>
            <tr className="border-b border-solid border-[#E5E1D8]">
              {["Queue", "Unassigned", "Assigned", "In review", "Active staff"].map((h) => (
                <th key={h} className="pb-3 text-[11px] text-[#4A5568] font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-solid divide-[#E5E1D8]">
            {workload.map((w) => (
              <tr key={w.queue} className="hover:bg-[#F3EBDD]/50 transition">
                <td className="py-3 text-[#0F1B2D] font-medium">{w.queue}</td>
                <td className="py-3 text-right text-[#4A5568]">{w.unassigned}</td>
                <td className="py-3 text-right text-[#4A5568]">{w.assigned}</td>
                <td className="py-3 text-right text-[#4A5568]">{w.inReview}</td>
                <td className="py-3 text-right text-[#4A5568]">{w.activeStaff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 pt-2 pb-4 text-[11px] text-[#4A5568]">
        Workload is shown to spot backlogs, not to rate individuals.
      </p>
      <Btn size="small" secondary className="w-full text-left" onClick={() => toast("Opening assignment tool")}>
        Rebalance (supervisors only)
      </Btn>
    </Card>
  );
}

function MyWork({ myWork, onResume }) {
  const visible = showSection("myWork");
  if (!visible) return null;
  return (
    <Card title="My work" titleIcon={UserRound}>
      <div className="px-5 pt-3 pb-4 space-y-4">
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wide">Claimed by you</h4>
          {myWork.length === 0 ? (
            <p className="text-[12px] text-[#4A5568] text-center py-3">Nothing claimed.</p>
          ) : (
            <div className="space-y-2">
              {myWork.map((i) => (
                <div
                  key={i.itemId}
                  className="flex items-center justify-between p-2 rounded-[10px] border border-solid border-[#E5E1D8] bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <b className="text-[12px] text-[#0F1B2D]">{i.itemId}</b>
                    <p className="text-[11px] text-[#4A5568]">{i.queue}</p>
                  </div>
                  <Btn size="small" secondary onClick={(e) => { e.stopPropagation(); onResume(i.itemId); }}>
                    Resume
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="px-0 mt-2 text-[11px] text-[#4A5568]">
          Items held over 24 hours show a reminder to finish or release them.
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page: Admin Dashboard                                             */
/* ------------------------------------------------------------------ */
function AdminDashboardPage() {
  const { theme, setTheme, isDark } = useTheme();
  const [density, setDensity] = useState(user.density);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));

  const visible = useMemo(() => {
    const q = visibleQueues();
    return {
      queues: q,
      showAttention: showSection("attention"),
      showHealth: showSection("health"),
      showPulse: showSection("pulse"),
      showDeadlines: showSection("deadlines"),
      showWorkload: showSection("workload"),
      showMyWork: showSection("myWork"),
    };
  }, [user.internalRoles]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const t = setTimeout(() => {
      setRefreshing(false);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }));
      toast("Dashboard refreshed");
    }, 800);
    return () => clearTimeout(t);
  }, []);

  const handleStart = useCallback(() => {
    const q = visible.queues.find((x) => x.status === "breached" || x.status === "atRisk") || visible.queues[0];
    if (q) {
      setDrawerItem(q);
      setDrawerOpen(true);
      toast(`Claimed ${q.itemId || q.label} — lock active for 10 minutes`);
    }
  }, [visible.queues]);

  const handleSkip = useCallback(() => {
    toast("Skipped for now — item remains in queue");
  }, []);

  const handleViewQueue = useCallback(() => {
    toast("Opening queue view");
  }, []);

  const handleOpenQueue = useCallback((key) => {
    const q = queues.find((x) => x.key === key);
    if (q) {
      setDrawerItem(q);
      setDrawerOpen(true);
    }
  }, []);

  const handleAcknowledge = useCallback((id) => {
    toast("Acknowledged — recorded in audit log");
  }, []);

  return (
    <div className={`min-h-screen bg-[#FAF8F4] text-[#0F1B2D] ${isDark ? `bg-[#0B1422] text-[#F2EFE8]` : ""}`}>
      {/* Skip to content */}
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-[#0F1B2D] text-white px-4 py-2">
        Skip to content
      </a>

      <EnvironmentStrip />
      {IncidentBanner()}
      <TopBar onRefresh={handleRefresh} />

      <div className="flex flex-col lg:flex-row" id="admin-main">
        <AdminSidebar
          active="Dashboard"
          onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
          onDensityToggle={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
        />

        <main className="flex-1 min-w-0 pt-6 lg:pt-8 lg:pl-[232px] lg:px-8 pb-24">
          <SectionHead
            title="Dashboard"
            subtitle={`Updated ${lastUpdated} IST`}
          >
            <Btn size="small" secondary icon={RefreshCcw} onClick={handleRefresh} title="Refresh" />
          </SectionHead>

          {nextUpData() && (
            <NextUpCard
              nextUp={nextUpData()}
              onStart={handleStart}
              onSkip={handleSkip}
              onViewQueue={handleViewQueue}
            />
          )}

          <div className="grid gap-6 lg:grid-cols-12 mb-6">
            {/* Queues: left 8 columns */}
            <div className="lg:col-span-8 space-y-6">
              <QueuesGrid queues={visible.queues} onOpen={handleOpenQueue} />
              {visible.showAttention && <NeedsAttention attention={attention} onOpen={() => {}} onAcknowledge={handleAcknowledge} />}
              {visible.showMyWork && <MyWork myWork={myWork} onResume={() => toast("Resuming item")} />}
            </div>

            {/* Right: 4 columns */}
            <div className="lg:col-span-4 space-y-6">
              {visible.showHealth && <PlatformHealth health={health} incidents={incidents} maintenance={maintenance} />}
              {visible.showPulse && <PulseCharts pulse={pulse} />}
              {visible.showDeadlines && <DeadlinesCompliance deadlines={deadlines} />}
              {visible.showWorkload && <TeamWorkload workload={workload} />}
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-8 px-5 lg:px-0 text-center lg:text-left">
            <p className="text-[11px] text-[#4A5568]">
              Don't copy personal data out of this console. All actions are logged.
            </p>
          </div>
        </main>
      </div>

      {drawerOpen && drawerItem && (
        <DetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Queue: ${drawerItem.label}`}
        >
          <div className="space-y-5">
            <div>
              <h4 className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                Queue summary
              </h4>
              <p className="text-[12px] text-[#4A5568] mb-2">{drawerItem.label}</p>
              <p className="text-[12px] text-[#4A5568] mb-2">{drawerItem.count} items waiting</p>
              <p className="text-[12px] text-[#4A5568] mb-2">Oldest: {formatAge(drawerItem.oldestSeconds)}</p>
            </div>
            <div className="flex gap-2">
              <Btn
                onClick={() => {
                  setDrawerOpen(false);
                  toast(`Opening ${drawerItem.label} queue`);
                }}
                className="flex-1"
              >
                Open queue
              </Btn>
              <Btn size="small" secondary onClick={() => setDrawerOpen(false)}>
                Close
              </Btn>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );

  function nextUpData() {
    const q = visible.queues.find((x) => x.status === "breached" || x.status === "atRisk");
    if (!q) return null;
    return {
      queue: q.label,
      itemId: `ITEM-${Math.floor(Math.random() * 90000) + 10000}`,
      category: q.label.split(" · ")[0] || q.label,
      severity: q.status === "breached" ? 1 : 2,
      waitingSeconds: q.oldestSeconds,
      targetSeconds: q.targetSeconds,
      reason: q.status === "breached" ? "breached" : "breaches_in",
      reasonValue: Math.max(0, q.targetSeconds - q.oldestSeconds),
    };
  }
}

/* ================================================================== */
/*  Exports                                                           */
/* ================================================================== */
export { AdminDashboardPage };
