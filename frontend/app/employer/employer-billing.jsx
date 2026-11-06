"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  ChevronDown,
  HelpCircle,
  Settings,
  LayoutDashboard,
  Briefcase,
  CalendarDays,
  Mail,
  Award as AwardIcon,
  BarChart3,
  Shield,
  Activity,
  Building as BuildingIcon,
  Users,
  MessageCircle,
  FileText,
  Clock,
  AlertCircle,
  Info,
  X,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Star,
  ChevronRight,
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
  Eye as EyeIcon,
  Copy,
  Printer,
  Wrench,
  Lock,
  Link as LinkIcon,
  Share2,
  RefreshCcw,
  CreditCard,
  Wallet,
  PieChart as PieChartIcon,
  Gauge,
  Scale,
  LayoutList,
  Inbox,
  Paperclip,
  Unlock,
  Building as BuildingIcon2,
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design tokens (matching employer-billing-design.md Part 17)       */
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
  planType: "annual",
  seatsUsed: 6,
  seatsLimit: 8,
  openJobsUsed: 3,
  openJobsLimit: 5,
  outreachLeft: 12,
  featuredLeft: 2,
  gstin: "27AABCU1234R1ZM",
  pan: "AABCU1234R",
  billingContact: "accounts@northstar.example",
  currency: "INR",
};

const user = {
  name: "Priya Mehta",
  role: "Employer",
  teamRole: "Owner",
  signedIn: true,
};

// Team-role scope helpers (enforced by server in production)
const isOwnerOrAdmin = () =>
  ["Owner", "Admin"].includes(user.teamRole);
const isOwner = () => user.teamRole === "Owner";
const isBillingContact = () => user.teamRole === "Billing contact";
const canViewBilling = () =>
  ["Owner", "Admin", "Billing contact"].includes(user.teamRole);
const canChangePlan = () => isOwner();
const canChangePayment = () => isOwner();
const canChangeBillingDetails = () => isOwner();
const canChangeSpendingControls = () => isOwner();
const canViewInvoices = () =>
  ["Owner", "Admin", "Billing contact"].includes(user.teamRole);

/* ------------------------------------------------------------------ */
/*  Simple toast for button feedback                                  */
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
/*  Shared UI primitives (accessible sizes, WCAG AA)                  */
/* ------------------------------------------------------------------ */

function Card({ title, padded = true, children, className = "" }) {
  return (
    <div
      className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white ${className}`}
    >
      {title && (
        <div className={`border-b border-[#E5E1D8] pb-3 ${padded ? "px-6 pt-4" : "px-6 pt-3"}`}>
          <h3 className="text-xs font-semibold">{title}</h3>
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
  type = "button",
  className = "",
}) {
  const isSmall = small || size === "small";
  const handleClick = (e) => {
    e.preventDefault();
    if (onClick) onClick(e);
  };
  return (
    <button
      type={type}
      onClick={handleClick}
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
        <b className="text-xs font-serif font-semibold">{value}</b>
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
    invoice: {
      Paid: `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
      Pending: `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
      Failed: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
      Refunded: `border-[#F3EBDD] bg-[#F3EBDD] text-[#806236]`,
      "Credit note": `border-[#0F1B2D] bg-[#F3EBDD] text-[#0F1B2D]`,
    },
    standing: {
      "Good standing": `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`,
      "Needs attention": `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`,
      Restricted: `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`,
      "Under review": `border-[#0F1B2D] text-[#0F1B2D]`,
    },
    seat: {
      Active: `border-[#E7F3EC] text-[#286749]`,
      Inactive: `border-[#E5E1D8] text-[#4A5568]`,
      Pending: `border-[#FDF3E0] text-[#9A6210]`,
    },
  };
  const map = maps[kind] || maps.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] || map.Draft || ""}`}
    >
      {status}
    </span>
  );
}

function Section({ title, children, className = "" }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-xs font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function SectionHead({ title, subtitle, children, className = "" }) {
  return (
    <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${className}`}>
      <div>
        <h2 className="text-xs font-serif font-semibold">{title}</h2>
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
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="text-[10px] text-[#4A5568] max-w-[260px]">{subtitle}</p>
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

function ButtonGroup({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-[#E5E1D8] bg-white">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1 text-[10px] transition ${o === value ? "bg-[#F3EBDD] text-[#806236]" : "text-[#4A5568] hover:text-[#0F1B2D]"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div
      className={`flex gap-1 overflow-x-auto mb-4 pb-1 border-b border-[#E5E1D8] ${className}`}
    >
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
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

function DetailDrawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[560px] h-full flex flex-col bg-white border-l border-[#E5E1D8] shadow-lg ml-auto">
        <div className="flex items-center justify-between border-b border-[#E5E1D8] px-6 py-4 bg-[#FAF8F4]">
          <h3 className="text-xs font-semibold">{title}</h3>
          <Btn size="small" secondary onClick={onClose}>
            <X size={14} />
          </Btn>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function UsageMeter({ label, value, limit, pct, reset, onBuy, isAtLimit }) {
  const tint = isAtLimit
    ? `border-[#FBE9E7] bg-[#FBE9E7] text-[#B42318]`
    : pct >= 80
      ? `border-[#FDF3E0] bg-[#FDF3E0] text-[#9A6210]`
      : `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]`;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#E5E1D8]/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-[#4A5568]">{label}</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${tint}`}
          >
            {isAtLimit ? "At limit" : pct >= 80 ? "Near limit" : "OK"}
          </span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-xs font-semibold text-[#0F1B2D]">{value}</span>
          <span className="text-[10px] text-[#4A5568]">of {limit}</span>
        </div>
        <div className="w-full h-1.5 bg-[#E5E1D8] rounded-full overflow-hidden mt-1">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min((pct / 100) * 100, 100)}%`,
              backgroundColor: isAtLimit ? ERROR : pct >= 80 ? WARNING : GOLD,
            }}
          />
        </div>
      </div>
      <div className="text-right min-w-[80px]">
        <div className="text-[10px] text-[#4A5568]">Resets {reset}</div>
        {onBuy && (
          <Btn size="small" secondary onClick={onBuy} className="mt-2 w-full text-left">
            Buy more
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sample data                                                       */
/* ------------------------------------------------------------------ */

const billingSummary = [
  { label: "Plan", value: "Growth (annual)" },
  { label: "Next charge", value: "₹59,880 · 1 Mar 2027" },
  { label: "Active job posts", value: "3 of 5" },
  { label: "Seats used", value: "6 of 8" },
];

const plans = [
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

const packs = [
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

const addOns = [
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

const credits = [
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

const usageMeters = [
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

const usageChartData = [40, 55, 48, 62, 58, 60];

const seats = [
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

const invoices = [
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

const paymentMethods = [
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

const spendingControls = {
  whoCanBuy: "Owner only",
  approvalThreshold: "₹25,000",
  monthlyCap: "₹1,00,000",
  autoPurchase: false,
  notifications: true,
};

/* ------------------------------------------------------------------ */
/*  Employer shell                                                    */
/* ------------------------------------------------------------------ */
// Fixed sidebar: only existing routes, no 404 links
const employerSidebar = [
  ["Dashboard", LayoutDashboard, "/employer/dashboard"],
  ["Hiring", Briefcase, "/employer/hiring"],
  ["Talent", Users, "/employer/talent"],
  ["Interviews", CalendarDays, "/employer/interviews"],
  ["Offers", Mail, "/employer/offers"],
  ["Hires", AwardIcon, "/employer/hires"],
  ["Templates", FileText, "/employer/templates"],
  ["Analytics", BarChart3, "/employer/analytics"],
  ["Trust", Shield, "/employer/trust"],
  ["Activity", Activity, "/employer/activity"],
  ["Billing", Banknote, "/employer/billing"],
];

function EmployerShell({ children, active = "Dashboard", className = "" }) {
  const notifications = [
    { id: "n-1", title: "Invoice ready: INV-2026-042", time: "10:00 AM", unread: true },
    {
      id: "n-2",
      title: "Plan renewal in 7 days",
      time: "Yesterday",
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
                className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-xs ${isActive ? "bg-[#1C2B42] text-white" : "text-white/70 hover:bg-white/10"}`}
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
            className="flex h-10 items-center gap-3 px-3 text-xs text-white/70"
          >
            <HelpCircle size={17} /> Help
          </Link>
          <button
            type="button"
            onClick={() => toast("Account menu coming soon")}
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
            className="absolute left-3 top-2.5 text-[#4A5568]"
            size={16}
          />
          <input
            placeholder="Search jobs and candidates"
            className="h-10 w-72 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs"
          />
        </div>
        <span className="text-xs font-semibold sm:hidden">Employer</span>
        <button
          type="button"
          className="relative ml-auto grid h-10 w-10 place-items-center"
          onClick={() => toast("Notifications panel coming soon")}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[#B42318] text-[10px] text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className="ml-3 flex items-center gap-2"
          onClick={() => toast("Profile menu coming soon")}
        >
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
      {/* Bottom mobile nav: fixed links only */}
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

/* ================================================================== */
/*  Tab: Plan                                                         */
/* ================================================================== */
function PlanTab() {
  const [modalOpen, setModalOpen] = useState(false);
  // cancel plan modal handled via Owner-only flow below
  const currentPlan = plans.find((p) => p.current) || plans[1];

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <Card title="Current plan">
        <div className="px-6 pt-3 pb-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <b className="text-lg font-serif font-semibold">{currentPlan.name}</b>
              <p className="text-[10px] text-[#4A5568]">
                {currentPlan.period === "one-time"
                  ? "One-time purchase"
                  : currentPlan.annual}
              </p>
              <StatusChip status={currentPlan.status} kind="standing" />
            </div>
            <div className="text-right">
              <b className="text-2xl font-serif font-semibold text-[#0F1B2D]">
                {currentPlan.price}
              </b>
              <p className="text-[10px] text-[#4A5568]">{currentPlan.period} · {currentPlan.tax}</p>
            </div>
          </div>
          <div className="bg-[#F3EBDD] border border-[#F3EBDD] rounded-lg p-3 mb-2">
            <p className="text-[10px] text-[#806236] font-medium mb-1">
              Current plan
            </p>
            <p className="text-[10px] text-[#806236]">
              Renews {currentPlan.period === "one-time" ? "No recurring charge" : "1 Mar 2027"}
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-[#0F1B2D] uppercase tracking-wide mb-2">
              Included
            </h4>
            <ul className="space-y-1 text-[10px] text-[#4A5568] sm:text-sm">
              {currentPlan.included.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-[#286749] mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            {canChangePlan() && (
              <Btn onClick={() => setModalOpen(true)}>Change plan</Btn>
            )}
            {canChangePlan() && currentPlan.period !== "one-time" && (
              <Btn secondary onClick={() => setCancelOpen(true)}>
                Cancel plan
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Plan comparison */}
      <Card title="Compare plans">
        <div className="px-6 pt-3 pb-4 space-y-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-[#4A5568]">Billing period</span>
            <ButtonGroup
              options={["Monthly", "Annual"]}
              value={currentPlan.planType === "annual" ? "Annual" : "Monthly"}
              onChange={() => toast("Switching billing period...")}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <Card
                key={p.id}
                padded
                className={`border rounded-xl p-5 transition hover:border-[#B8955A]/50 ${
                  p.current
                    ? "border-[#B8955A] bg-[#F3EBDD]/30"
                    : "border-[#E5E1D8] bg-white"
                }`}
              >
                <div className="px-6 pt-3 pb-4">
                  {p.current && (
                    <span className="inline-flex items-center rounded-full border border-[#B8955A] bg-[#F3EBDD] px-2 py-0.5 text-[9px] font-medium text-[#806236] mb-3">
                      Current plan
                    </span>
                  )}
                  <b className="text-xs font-semibold block">{p.name}</b>
                  <div className="flex items-baseline gap-1 mt-2 mb-2">
                    <b className="text-lg font-serif font-semibold text-[#0F1B2D]">
                      {p.price}
                    </b>
                    <span className="text-[10px] text-[#4A5568]">
                      {p.period === "one-time" ? "one-time" : p.annual}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#4A5568] mb-3">{p.tax}</p>
                  <ul className="space-y-1 text-[10px] text-[#4A5568] mb-4">
                    {p.included.slice(0, 4).map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#286749] mt-0.5 flex-shrink-0">✓</span>
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                  {p.canSwitch && !p.current && (
                    <Btn
                      size="small"
                      onClick={() => toast(`Switching to ${p.name}...`)}
                      className="w-full"
                    >
                      Choose {p.name}
                    </Btn>
                  )}
                  {p.current && (
                    <Btn size="small" secondary className="w-full text-left">
                      Manage plan
                    </Btn>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <p className="text-[10px] text-[#4A5568] text-center mt-3">
            Paying doesn't change verification, moderation or fairness rules.
            Featured listings are labeled.
          </p>
          <Btn size="small" secondary onClick={() => toast("Opening detailed comparison...")}>
            Compare in detail
          </Btn>
        </div>
      </Card>

      {/* Change plan modal */}
      {modalOpen && (
        <DetailDrawer
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Change plan"
        >
          <div className="space-y-5">
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                1. Choose a plan
              </h4>
              <div className="space-y-3">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      p.id === "growth" ? "border-[#B8955A] bg-[#F3EBDD]/30" : "border-[#E5E1D8]"
                    } cursor-pointer hover:border-[#B8955A]/50`}
                  >
                    <div className="flex-1 min-w-0">
                      <b className="text-xs text-[#0F1B2D]">{p.name}</b>
                      <p className="text-[10px] text-[#4A5568]">{p.price} {p.period}</p>
                    </div>
                    <span className={`text-[10px] font-medium ${p.id === "growth" ? "text-[#286749]" : "text-[#4A5568]"}`}>
                      {p.id === "growth" ? "Selected" : "Select"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                2. Review the change
              </h4>
              <p className="text-[10px] text-[#4A5568] mb-2">
                Moving to Scale: +₹10,000/month, prorated to your next charge on 1 Mar 2027.
                New total: ₹25,880 including GST.
              </p>
              <div className="bg-[#FBE9E7] border border-[#FBE9E7] rounded-lg p-3">
                <p className="text-[10px] text-[#B42318] mb-1">
                  Jobs above your new limit stay live until their end date.
                  You can't publish new ones until you're under the limit.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Btn
                onClick={() => {
                  setModalOpen(false);
                  toast("Plan change confirmed. Re-authentication required.");
                }}
                className="flex-1"
              >
                Confirm change
              </Btn>
              <Btn size="small" secondary onClick={() => setModalOpen(false)}>
                Cancel
              </Btn>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Tab: Job posts and add-ons                                        */
/* ================================================================== */
function JobPostsTab() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="space-y-6">
      <Section title="Job post packs (pay as you go)">
        <p className="text-[10px] text-[#4A5568] mb-4">
          A credit is used only when a job is published, not when a draft is
          saved. One-time purchase. No automatic renewal.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {packs.map((pack) => (
            <Card key={pack.id} title={pack.name} padded>
              <div className="px-6 pt-3 pb-4 space-y-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <b className="text-lg font-serif font-semibold">{pack.price}</b>
                  <span className="text-[10px] text-[#4A5568]">{pack.tax}</span>
                </div>
                <p className="text-[10px] text-[#4A5568]">{pack.includes}</p>
                <p className="text-[10px] text-[#4A5568]">{pack.validity}</p>
                {pack.savings && (
                  <span className="text-[10px] text-[#286749] font-medium">{pack.savings}</span>
                )}
                <Btn
                  onClick={() => {
                    setSelectedItem(pack);
                    setDrawerOpen(true);
                  }}
                  className="w-full"
                >
                  Buy pack
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Add-ons">
        <div className="space-y-3">
          {addOns.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between p-3 rounded-lg border border-[#E5E1D8] bg-white"
            >
              <div className="flex-1 min-w-0">
                <b className="text-xs text-[#0F1B2D]">{a.name}</b>
                <p className="text-[10px] text-[#4A5568]">{a.what}</p>
                <p className="text-[9px] text-[#4A5568] mt-1">{a.notes}</p>
              </div>
              <Btn
                size="small"
                onClick={() => toast(`Adding ${a.name}...`)}
                className="ml-2"
              >
                Add
              </Btn>
            </div>
          ))}
        </div>
      </Section>

      <Section title="My credits and add-ons">
        <div className="space-y-3">
          {credits.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-lg border border-[#E5E1D8] bg-white"
            >
              <div className="flex-1 min-w-0">
                <b className="text-xs text-[#0F1B2D]">{c.name}</b>
                <p className="text-[10px] text-[#4A5568]">
                  Purchased {c.purchased} · Expires {c.expiry}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[#4A5568]">{c.used} used</span>
                  <span className="text-xs text-[#4A5568]">{c.left} left</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={c.status} kind="draft" />
                <Btn size="small" secondary onClick={() => toast(`Opening receipt for ${c.name}...`)}>
                  Receipt
                </Btn>
              </div>
            </div>
          ))}
          {credits.length === 0 && (
            <p className="text-[10px] text-[#4A5568] text-center py-4">
              No credits purchased yet.
            </p>
          )}
        </div>
      </Section>

      {drawerOpen && selectedItem && (
        <DetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Buy: ${selectedItem.name}`}
        >
          <div className="space-y-5">
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                Item summary
              </h4>
              <p className="text-[10px] text-[#4A5568] mb-2">
                {selectedItem.includes}
              </p>
              <p className="text-[10px] text-[#4A5568] mb-2">
                {selectedItem.validity}
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                Price breakdown
              </h4>
              <div className="space-y-2 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Price</span>
                  <span>{selectedItem.price}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (18%)</span>
                  <span>{selectedItem.tax}</span>
                </div>
                <div className="flex justify-between border-t border-[#E5E1D8] pt-2">
                  <span className="text-[#0F1B2D] font-medium">Total</span>
                  <span className="text-[#0F1B2D] font-medium">₹{selectedItem.price.replace("₹","")}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                Payment method
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E1D8] bg-white">
                  <CreditCard size={14} className="text-[#4A5568]" />
                  <span className="text-xs text-[#0F1B2D]">Visa •••• 4417 (default)</span>
                </div>
                <Btn size="small" secondary className="w-full text-left" onClick={() => toast("Opening add payment method...")}>
                  Add payment method
                </Btn>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Btn
                onClick={() => {
                  setDrawerOpen(false);
                  toast(`Purchased ${selectedItem.name}. Credits added.`);
                }}
                className="flex-1"
              >
                Pay ₹{selectedItem.price.replace("₹", "")}
              </Btn>
              <Btn size="small" secondary onClick={() => setDrawerOpen(false)}>
                Cancel
              </Btn>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Tab: Usage                                                        */
/* ================================================================== */
function UsageTab() {
  return (
    <div className="space-y-6">
      <Section title="Usage meters">
        <p className="text-[10px] text-[#4A5568] mb-4">
          Reaching a limit never affects candidates already in your pipelines
          or your access to existing records.
        </p>
        <div className="space-y-0">
          {usageMeters.map((m) => (
            <UsageMeter key={m.label} {...m} />
          ))}
        </div>
      </Section>

      <Card title="Usage over the last 6 months">
        <div className="px-6 pt-3 pb-4 space-y-4">
          <div className="flex items-end gap-2 h-48 w-full bg-[#E5E1D8]/30 rounded-lg px-4">
            {usageChartData.map((v, i) => (
              <div key={i} className="w-1/6 bg-[#0F1B2D] rounded-t" style={{ height: `${(v / 62) * 100}%` }} />
            ))}
            <div className="w-1/6 bg-[#B8955A] rounded-t" style={{ height: "97%" }} />
          </div>
          <div className="flex justify-between text-[10px] text-[#4A5568] mt-2">
            <span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span>
          </div>
          <Btn size="small" secondary onClick={() => toast("Opening usage table...")}>
            View as table
          </Btn>
        </div>
      </Card>

      <Section title="What happens at the limit">
        <div className="space-y-3 text-[10px] text-[#4A5568]">
          <div className="flex items-start gap-3">
            <AlertCircle size={14} className="text-[#9A6210] mt-0.5 flex-shrink-0" />
            <div>
              <b className="text-xs text-[#0F1B2D]">Active job posts at limit</b>
              <p className="mt-0.5">You can't publish new jobs. Buy a pack or upgrade your plan.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertCircle size={14} className="text-[#9A6210] mt-0.5 flex-shrink-0" />
            <div>
              <b className="text-xs text-[#0F1B2D]">Team seats at limit</b>
              <p className="mt-0.5">Invite more members only after a seat frees or you buy extra seats.</p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ================================================================== */
/*  Tab: Seats                                                        */
/* ================================================================== */
function SeatsTab() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        {[
          { label: "Seats used", value: "6", sub: "of 8" },
          { label: "Paid seats", value: "5" },
          { label: "Free/guest seats", value: "1" },
        ].map((s) => (
          <Card key={s.label} title padded>
            <div className="px-6 pt-3 pb-4">
              <div className="flex items-baseline gap-2 mb-2">
                <b className="text-3xl font-serif font-semibold">{s.value}</b>
              </div>
              <p className="text-[10px] text-[#4A5568]">{s.label}</p>
              <p className="text-[10px] text-[#4A5568]">{s.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Team members and seats">
        <div className="px-6 pt-3 pb-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-full">
            <thead>
              <tr className="border-b border-[#E5E1D8]">
                {["Member", "Role", "Status", "Last active", "Seat type", "Actions"].map((h) => (
                  <th key={h} className="pb-3 text-[10px] text-[#4A5568] font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1D8]">
              {seats.map((s) => (
                <tr key={s.id} className="hover:bg-[#F3EBDD]/50">
                  <td className="py-3">
                    <b className="text-xs text-[#0F1B2D]">{s.name}</b>
                  </td>
                  <td className="py-3 text-xs text-[#4A5568]">{s.role}</td>
                  <td className="py-3 text-xs">
                    <StatusChip status={s.status} kind="seat" />
                  </td>
                  <td className="py-3 text-xs text-[#4A5568]">{s.lastActive}</td>
                  <td className="py-3 text-xs text-[#4A5568]">{s.seatType}</td>
                  <td className="py-3 text-right">
                    {isOwner() ? (
                      <Btn size="small" secondary onClick={() => toast(`Managing seat: ${s.name}...`)}>
                        Manage
                      </Btn>
                    ) : (
                      <span className="text-[10px] text-[#4A5568]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#4A5568] mt-3">
          Guest interviewers added for a single hire may be free. Removing a
          member frees the seat at the next billing date.
        </p>
        <div className="flex gap-2">
          {isOwner() ? (
            <Btn onClick={() => toast("Opening invite member flow...")}>
              Invite member
            </Btn>
          ) : null}
          <Btn size="small" secondary onClick={() => toast("Opening team settings...")}>
            Team and Permissions
          </Btn>
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== */
/*  Tab: Invoices                                                     */
/* ================================================================== */
function InvoicesTab() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inv, setInv] = useState(null);

  const filters = [
    { id: "period", label: "Period", value: "All time", options: ["All time", "This year", "Last 30 days", "This quarter"] },
    { id: "status", label: "Status", value: "All", options: ["All", "Paid", "Pending", "Failed", "Refunded"] },
    { id: "type", label: "Type", value: "All", options: ["All", "Plan", "Pack", "Add-on"] },
  ];

  return (
    <div className="space-y-6">
      <FilterBar filters={filters} onChange={() => toast("Filters applied")} />
      <Card title="Invoices">
        <div className="px-6 pt-3 pb-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-full">
            <thead>
              <tr className="border-b border-[#E5E1D8]">
                {["Invoice", "Date", "Period", "Description", "Total", "Status", "Actions"].map((h) => (
                  <th key={h} className="pb-3 text-[10px] text-[#4A5568] font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1D8]">
              {invoices.map((i) => (
                <tr
                  key={i.id}
                  className="cursor-pointer hover:bg-[#F3EBDD]/50 transition"
                  onClick={() => {
                    setInv(i);
                    setDrawerOpen(true);
                  }}
                >
                  <td className="py-3 text-[#0F1B2D] font-medium">{i.id}</td>
                  <td className="py-3 text-[#4A5568]">{i.date}</td>
                  <td className="py-3 text-[#4A5568]">{i.period}</td>
                  <td className="py-3 text-[#4A5568]">{i.description}</td>
                  <td className="py-3 text-right text-[#0F1B2D] font-medium">{i.total}</td>
                  <td className="py-3">
                    <StatusChip status={i.status} kind="invoice" />
                  </td>
                  <td className="py-3 text-right">
                    <Btn size="small" secondary onClick={(e) => { e.stopPropagation(); toast(`Downloading ${i.id}...`); }}>
                      PDF
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-3">
          <Btn size="small" secondary onClick={() => toast("Downloading all invoices (ZIP)...")}>
            Download all (ZIP)
          </Btn>
          <Btn size="small" secondary onClick={() => toast("Opening statement view...")}>
            Statement view
          </Btn>
        </div>
        <p className="text-[10px] text-[#4A5568] mt-3">
          Each invoice shows GSTIN, the platform's tax details and the payment
          method (masked). Corrections create a new invoice or credit note.
        </p>
      </Card>

      {drawerOpen && inv && (
        <DetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Invoice ${inv.id}`}
        >
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                  Invoice
                </h4>
                <p className="text-[10px] text-[#4A5568]"><b>ID:</b> {inv.id}</p>
                <p className="text-[10px] text-[#4A5568]"><b>Date:</b> {inv.date}</p>
                <p className="text-[10px] text-[#4A5568]"><b>Period:</b> {inv.period}</p>
                <p className="text-[10px] text-[#4A5568]"><b>Description:</b> {inv.description}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                  Amounts
                </h4>
                <p className="text-[10px] text-[#4A5568]"><b>Subtotal:</b> {inv.amount}</p>
                <p className="text-[10px] text-[#4A5568]"><b>GST (18%):</b> {inv.gst}</p>
                <p className="text-[10px] text-[#4A5568]"><b>Total:</b> {inv.total}</p>
                <p className="text-[10px] text-[#4A5568]"><b>Method:</b> {inv.method}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-wide mb-2">
                Status
              </h4>
              <p className="text-[10px] text-[#4A5568]">
                <StatusChip status={inv.status} kind="invoice" />
              </p>
              <p className="text-[10px] text-[#4A5568]">
                PO number: {inv.po}
              </p>
            </div>
            <div className="flex gap-2">
              <Btn size="small" secondary onClick={() => toast(`Downloading ${inv.id} PDF...`)}>
                Download PDF
              </Btn>
              <Btn size="small" secondary onClick={() => toast("Requesting correction...")}>
                Request correction
              </Btn>
              <Btn size="small" secondary onClick={() => toast("Reporting unrecognized charge...")}>
                Report charge
              </Btn>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Tab: Payment methods                                              */
/* ================================================================== */
function PaymentMethodsTab() {
  return (
    <div className="space-y-6">
      <Section title="Saved payment methods">
        <p className="text-[10px] text-[#4A5568] mb-3">
          Card details are handled by the payment provider. The platform stores
          only masked details and tokens. Adding or changing a method requires
          re-authentication.
        </p>
        <div className="space-y-3">
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className="flex items-center justify-between p-3 rounded-lg border border-[#E5E1D8] bg-white"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-[#806236] text-xs font-bold">
                  {pm.type === "Card" ? "C" : pm.type === "UPI" ? "U" : "B"}
                </div>
                <div>
                  <b className="text-xs text-[#0F1B2D]">{pm.label}</b>
                  <p className="text-[10px] text-[#4A5568]">
                    {pm.type === "Card" ? `Expires ${pm.expiry}` : pm.type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pm.default && (
                  <span className="inline-flex items-center rounded-full border border-[#E7F3EC] bg-[#E7F3EC] px-2 py-0.5 text-[9px] text-[#286749]">
                    Default
                  </span>
                )}
                <StatusChip status={pm.status} kind="draft" />
                <div className="flex gap-1 ml-2">
                  {!pm.default && (
                    <Btn size="small" secondary onClick={() => toast(`Making ${pm.label} default...`)}>
                      Make default
                    </Btn>
                  )}
                  <Btn size="small" secondary destructive onClick={() => toast(`Removing ${pm.label}...`)}>
                    Remove
                  </Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Btn onClick={() => toast("Opening add payment method...")} className="w-full">
          <CreditCard size={14} className="mr-2" /> Add payment method
        </Btn>
      </Section>

      <Card title="Invoice billing (bank transfer)">
        <div className="px-6 pt-3 pb-4 space-y-4">
          <p className="text-[10px] text-[#4A5568]">
            Available to eligible companies for annual or larger purchases. A
            request form is reviewed by the platform before approval.
          </p>
          <Btn secondary className="w-full text-left" onClick={() => toast("Opening invoice billing request...")}>
            Request invoice billing
          </Btn>
          <p className="text-[10px] text-[#4A5568] mt-2">
            Payment terms (for example, 15 days). Purchases activate when
            payment is received or per approved terms. Quote the invoice number
            on your transfer.
          </p>
        </div>
      </Card>

      <Card title="Autopay consent">
        <div className="px-6 pt-3 pb-4 space-y-4">
          <div className="flex items-start gap-3">
            <ToggleSwitch checked={true} onChange={() => toast("Toggling autopay...")} />
            <div className="flex-1">
              <b className="text-xs text-[#0F1B2D]">Autopay enabled</b>
              <p className="text-[10px] text-[#4A5568]">
                I agree to be charged ₹4,990 monthly until I cancel.
              </p>
            </div>
          </div>
          <p className="text-[10px] text-[#4A5568] mt-2">
            Advance notice is sent before each recurring charge as required.
            Cancelling stops future charges immediately.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== */
/*  Tab: Billing details                                              */
/* ================================================================== */
function BillingDetailsTab() {
  return (
    <div className="space-y-6">
      <Section title="Company billing details">
        <p className="text-[10px] text-[#4A5568] mb-4">
          Changes apply to future invoices. If the legal name differs from the
          verified company name, verification may be re-checked.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4A5568]">Legal company name</label>
            <input
              defaultValue={company.name}
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-4 text-[11px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4A5568]">Billing address</label>
            <input
              defaultValue="123 MG Road, Kolkata, West Bengal 700016"
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-4 text-[11px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4A5568]">GSTIN</label>
            <input
              defaultValue={company.gstin}
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-4 text-[11px]"
            />
            <p className="text-[9px] text-[#4A5568]">Format validated against verified company details.</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4A5568]">PAN</label>
            <input
              defaultValue="•••••1234••"
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-4 text-[11px]"
              readOnly
            />
            <p className="text-[9px] text-[#4A5568]">Masked after saving.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4A5568]">Billing contact email</label>
            <input
              defaultValue={company.billingContact}
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-4 text-[11px]"
            />
            <p className="text-[9px] text-[#4A5568]">Receipts and invoices sent here.</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4A5568]">Additional recipients</label>
            <input
              defaultValue="accounts@northstar.example"
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-4 text-[11px]"
            />
            <p className="text-[9px] text-[#4A5568]">For example, accounts team.</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4A5568]">Purchase order reference</label>
            <input
              defaultValue="PO-DEFAULT"
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-4 text-[11px]"
            />
            <p className="text-[9px] text-[#4A5568]">Optional default, up to 40 characters.</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-[#4A5568]">Invoice language</label>
            <select
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-4 text-[11px] appearance-none"
            >
              <option>English</option>
              <option>Hindi</option>
            </select>
          </div>
        </div>
        <Btn onClick={() => toast("Saving billing details...")} className="w-full">
          Save changes
        </Btn>
        <p className="text-[10px] text-[#4A5568] mt-3">
          Re-authentication required. A security email will be sent to Owners
          and Admins.
        </p>
      </Section>
    </div>
  );
}

/* ================================================================== */
/*  Tab: Spending controls                                            */
/* ================================================================== */
function SpendingControlsTab() {
  return (
    <div className="space-y-6">
      <Section title="Who can buy">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E1D8] bg-white">
            <div>
              <b className="text-xs text-[#0F1B2D]">Owner only (default)</b>
              <p className="text-[10px] text-[#4A5568]">Only the Owner can make purchases.</p>
            </div>
            <ToggleSwitch checked={spendingControls.whoCanBuy === "Owner only"} onChange={() => toast("Updating purchase permissions...")} />
          </div>
        </div>
      </Section>

      <Section title="Approval threshold">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E1D8] bg-white">
            <div>
              <b className="text-xs text-[#0F1B2D]">Purchases above threshold need approval</b>
              <p className="text-[10px] text-[#4A5568]">{spendingControls.approvalThreshold}</p>
            </div>
            <Btn size="small" secondary onClick={() => toast("Editing approval threshold...")}>
              Edit
            </Btn>
          </div>
          <p className="text-[10px] text-[#4A5568] mt-2">
            Where there are multiple Owners, purchases above the threshold need
            approval from an Owner other than the purchaser.
          </p>
        </div>
      </Section>

      <Section title="Monthly spending cap (optional)">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E1D8] bg-white">
            <div>
              <b className="text-xs text-[#0F1B2D]">Monthly cap</b>
              <p className="text-[10px] text-[#4A5568]">{spendingControls.monthlyCap}</p>
            </div>
            <Btn size="small" secondary onClick={() => toast("Setting spending cap...")}>
              Set cap
            </Btn>
          </div>
          <p className="text-[10px] text-[#4A5568] mt-2">
            Purchases beyond the cap are blocked with a clear message. An Owner
            can raise it at any time.
          </p>
        </div>
      </Section>

      <Section title="Auto-purchase rules (optional)">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white">
            <ToggleSwitch checked={spendingControls.autoPurchase} onChange={() => toast("Toggling auto-purchase...")} />
            <div className="flex-1">
              <b className="text-xs text-[#0F1B2D]">Buy a single post when I publish with no credits left</b>
              <p className="text-[10px] text-[#4A5568]">Up to a monthly limit. Always shown before purchase with a confirmation email.</p>
            </div>
          </div>
          <p className="text-[10px] text-[#4A5568] mt-2">Off by default.</p>
        </div>
      </Section>

      <Section title="Notifications">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-white">
            <ToggleSwitch checked={spendingControls.notifications} onChange={() => toast("Updating notification preferences...")} />
            <div className="flex-1">
              <b className="text-xs text-[#0F1B2D]">Usage and spend alerts</b>
              <p className="text-[10px] text-[#4A5568]">Threshold alerts for usage and spend.</p>
            </div>
          </div>
        </div>
      </Section>

      <Card title="Audit">
        <div className="px-6 pt-3 pb-4 space-y-3">
          <p className="text-[10px] text-[#4A5568]">
            Every change to spending controls is logged and visible in the
            Activity and Audit Log.
          </p>
          <Btn size="small" secondary onClick={() => toast("Opening activity log...")}>
            View audit entries
          </Btn>
        </div>
      </Card>
    </div>
  );
}

/* ================================================================== */
/*  Page: Billing                                                     */
/* ================================================================== */
function BillingPage() {
  if (!canViewBilling()) {
    return (
      <EmployerShell active="Billing">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#FBE9E7] mb-6">
            <Lock size={24} className="text-[#B42318]" />
          </div>
          <h2 className="text-lg font-serif font-semibold mb-2">This page is for employers</h2>
          <p className="text-[10px] text-[#4A5568] max-w-lg mx-auto mb-6">
            You don't have access to billing. Recruiters, Hiring managers,
            Interviewers and Viewers don't see this page. Ask an Owner or Admin.
          </p>
          <Link
            href="/employer/dashboard"
            className="px-6 py-3 rounded-lg border border-[#E5E1D8] text-[#4A5568] text-sm font-medium hover:bg-[#F3EBDD] transition"
          >
            Go to Employer Dashboard
          </Link>
        </div>
      </EmployerShell>
    );
  }

  const [tab, setTab] = useState("Plan");

  const tabs = [
    "Plan",
    "Job posts and add-ons",
    "Usage",
    "Seats",
    "Invoices",
    "Payment methods",
    "Billing details",
    "Spending controls",
  ];

  return (
    <EmployerShell active="Billing">
      <SectionHead
        title="Billing and plan"
        subtitle="Pay for the jobs and tools you use. Candidates are never charged."
      >
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border border-[#B8955A] bg-[#F3EBDD] px-2.5 py-0.5 text-[10px] font-medium text-[#806236]`}>
            {company.plan} ({company.planType})
          </span>
          {company.verified ? null : (
            <div className="bg-[#FDF3E0] border border-[#FDF3E0] rounded-lg px-3 py-2 text-[10px] text-[#9A6210]">
              You can buy now. Credits are used only when you publish, and publishing needs verification.
              <Btn size="small" secondary onClick={() => toast("Opening verification...")} className="mt-2">
                Finish verification
              </Btn>
            </div>
          )}
        </div>
      </SectionHead>

      {/* Summary strip */}
      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        {billingSummary.map((s) => (
          <Card key={s.label} padded>
            <div className="px-6 pt-3 pb-4">
              <b className="text-2xl font-serif font-semibold text-[#0F1B2D]">{s.value}</b>
              <p className="text-[10px] text-[#4A5568]">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {/* Tab content */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {tab === "Plan" && <PlanTab />}
          {tab === "Job posts and add-ons" && <JobPostsTab />}
          {tab === "Usage" && <UsageTab />}
          {tab === "Seats" && <SeatsTab />}
          {tab === "Invoices" && <InvoicesTab />}
          {tab === "Payment methods" && <PaymentMethodsTab />}
          {tab === "Billing details" && <BillingDetailsTab />}
          {tab === "Spending controls" && <SpendingControlsTab />}
        </div>

        {/* Side column */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="Next charge">
            <div className="px-6 pt-3 pb-4 space-y-4">
              <div className="flex items-baseline gap-2 mb-2">
                <b className="text-2xl font-serif font-semibold text-[#0F1B2D]">
                  ₹59,880
                </b>
                <span className="text-[10px] text-[#4A5568]">on 1 Mar 2027</span>
              </div>
              <p className="text-[10px] text-[#4A5568]">
                Method: Visa •••• 4417
              </p>
              <Btn size="small" secondary onClick={() => toast("Previewing invoice...")}>
                Preview invoice
              </Btn>
            </div>
          </Card>

          <Card title="This month's usage">
            <div className="px-6 pt-3 pb-4 space-y-4">
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Job posts</span>
                  <span className="text-[#0F1B2D] font-medium">3 of 5</span>
                </div>
                <div className="flex justify-between">
                  <span>Invitations</span>
                  <span className="text-[#0F1B2D] font-medium">34 of 50</span>
                </div>
                <div className="flex justify-between">
                  <span>Seats</span>
                  <span className="text-[#0F1B2D] font-medium">6 of 8</span>
                </div>
              </div>
              <Btn size="small" secondary className="w-full text-left" onClick={() => setTab("Usage")}>
                View usage <ArrowRight size={12} />
              </Btn>
            </div>
          </Card>

          <Card>
            <div className="px-6 pt-3 pb-4 space-y-3">
              <p className="text-[10px] text-[#4A5568] mb-3">
                You bought 3 single posts in 60 days. A 10-post pack would cost
                ₹39,999 — saving ₹9,991 vs buying singles.
              </p>
              <Btn size="small" secondary className="w-full text-left" onClick={() => setTab("Job posts and add-ons")}>
                View packs
              </Btn>
            </div>
          </Card>

          <Card title="Help">
            <div className="px-6 pt-3 pb-4 space-y-3">
              <Btn size="small" secondary className="w-full text-left" onClick={() => toast("Opening refund policy...")}>
                Refund policy
              </Btn>
              <Btn size="small" secondary className="w-full text-left" onClick={() => toast("Contacting support...")}>
                Contact support
              </Btn>
              <Btn size="small" secondary className="w-full text-left" onClick={() => toast("Talking to sales...")}>
                Talk to us
              </Btn>
            </div>
          </Card>
        </div>
      </div>
    </EmployerShell>
  );
}

/* ================================================================== */
/*  Exports                                                           */
/* ================================================================== */
export { BillingPage };
