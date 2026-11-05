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
  Bell as BellIcon,
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
const WARNING_TINT = "#FFF8E8";
const WARNING_DARK = "#9A7A45";
const ERROR = "#B42318";
const ERROR_TINT = "#FCE8E6";

/* ------------------------------------------------------------------ */
/*  Shared UI primitives                                              */
/* ------------------------------------------------------------------ */
function Btn({
  children,
  onClick,
  primary = true,
  secondary = false,
  destructive = false,
  small = false,
  disabled = false,
  className = "",
  width = "",
}) {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const styles = primary
    ? `bg-[#0F1B2D] text-white hover:bg-[#1C2B42]`
    : secondary
      ? `border border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA]`
      : destructive
        ? `border border-transparent text-[#B42318] hover:bg-[#FCE8E6]`
        : `bg-[#F3EBDD] text-[#806236] hover:bg-[#F0E5CC]`;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} rounded-lg px-3.5 ${small ? "py-1.5" : "py-2"} ${styles} ${className} ${width}`}
    >
      {children}
    </button>
  );
}

function Card({ title, action, children, padded = true }) {
  return (
    <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusChip({ status }) {
  const map = {
    Draft: "border border-[#4A5568] text-[#4A5568]",
    Ready: "bg-[#E7F3EC] text-[#286749]",
    Primary: "bg-[#F3EBDD] text-[#806236]",
    "Tailored for job": "border border-[#0F1B2D] text-[#0F1B2D]",
    "Needs review": "bg-[#FFF8E8] text-[#9A7A45]",
    Archived: "bg-[#F3F4F6] text-[#4A5568]",
    Private: "border border-[#4A5568] text-[#4A5568]",
    Shared: "bg-[#F3EBDD] text-[#806236]",
    "Delivery analysis: Off": "border border-[#4A5568] text-[#4A5568]",
    "Delivery analysis: On": "bg-[#FFF8E8] text-[#9A7A45]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium ${map[status] || map.Private}`}
    >
      {status}
    </span>
  );
}

function AISuggestion({
  label = "AI",
  reason,
  onWhy,
  onAccept,
  onEdit,
  onReject,
  children,
}) {
  return (
    <div className="rounded-lg border border-transparent bg-[#F3EBDD] p-3 text-left">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236] font-medium">
          <Sparkles size={10} /> {label}
          {onWhy && reason && (
            <button
              onClick={onWhy}
              className="ml-1 text-[#9A7A45] underline underline-offset-1 hover:text-[#806236]"
            >
              Why?
            </button>
          )}
        </span>
        <div className="flex gap-1">
          {onReject && (
            <Btn
              onClick={onReject}
              secondary
              small
              className="min-h-8 px-2 text-[9px]"
            >
              Reject
            </Btn>
          )}
          {onEdit && (
            <Btn
              onClick={onEdit}
              secondary
              small
              className="min-h-8 px-2 text-[9px]"
            >
              Edit
            </Btn>
          )}
          {onAccept && (
            <Btn onClick={onAccept} small className="min-h-8 px-2 text-[9px]">
              Accept
            </Btn>
          )}
        </div>
      </div>
      {reason && <p className="text-[10px] text-[#4A5568] mb-3">{reason}</p>}
      {children}
    </div>
  );
}

function ScoreRing({
  value,
  label,
  size = "h-24 w-24",
  border = "border-[7px]",
}) {
  const band =
    value >= 80
      ? "Strong"
      : value >= 60
        ? "Solid"
        : value >= 40
          ? "Developing"
          : "Needs work";
  const bandColor =
    value >= 80 ? SUCCESS : value >= 60 ? GOLD : value >= 40 ? WARNING : ERROR;
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`grid place-items-center ${size} rounded-full ${border} border-[#E5E1D8] border-r-[${bandColor}] mb-1 text-center`}
      >
        <span>
          <b className="serif block text-2xl">{value}</b>
          <small className="text-[9px]">/ 100</small>
        </span>
      </div>
      <span
        className={`text-xs font-medium ${value >= 60 ? "text-[#286749]" : value >= 40 ? "text-[#9A7A45]" : "text-[#B42318]"}`}
      >
        {band}
      </span>
      <span className="text-[10px] text-[#4A5568]">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sample data                                                       */
/* ------------------------------------------------------------------ */
const sessions = [
  {
    id: "sess-001",
    role: "Product Designer",
    level: "Senior",
    type: "Behavioral (STAR)",
    mode: "Voice",
    date: "4 Nov",
    duration: "12 min",
    score: 68,
    takeaway: "Strong structure; add measurable results.",
    answers: 6,
    recording: true,
    transcript: true,
    delivery: false,
    followedUp: 2,
  },
  {
    id: "sess-002",
    role: "Software Engineer",
    level: "Mid",
    type: "Technical",
    mode: "Text",
    date: "2 Nov",
    duration: "18 min",
    score: 74,
    takeaway: "Clear reasoning; explain trade-offs more.",
    answers: 8,
    recording: false,
    transcript: true,
    delivery: false,
    followedUp: 1,
  },
  {
    id: "sess-003",
    role: "Product Designer",
    level: "Senior",
    type: "HR",
    mode: "Video",
    date: "29 Oct",
    duration: "10 min",
    score: 61,
    takeaway: "Good examples; work on concise openings.",
    answers: 5,
    recording: true,
    transcript: true,
    delivery: true,
    followedUp: 0,
  },
  {
    id: "sess-004",
    role: "Product Manager",
    level: "Senior",
    type: "Case",
    mode: "Text",
    date: "25 Oct",
    duration: "22 min",
    score: 58,
    takeaway: "Structure the problem before solving.",
    answers: 8,
    recording: false,
    transcript: true,
    delivery: false,
    followedUp: 3,
  },
];

const interviews = [
  {
    id: "int-1",
    company: "Northstar Labs",
    role: "Senior Product Designer",
    type: "Technical",
    date: "Thu 6 Nov",
    time: "11:00 AM IST",
  },
];

const drills = [
  {
    id: "drill-1",
    skill: "Structure",
    goal: "Answer in STAR",
    length: "5 min",
    difficulty: "Gentle",
    type: "Behavioral (STAR)",
    recommended: true,
    evidence: "In 3 recent answers, results were missing.",
    attempts: 2,
    improved: "4 of 5 times",
  },
  {
    id: "drill-2",
    skill: "Evidence",
    goal: "Add a number to results",
    length: "4 min",
    difficulty: "Realistic",
    type: "Relevance",
    recommended: true,
    evidence: "Your last two answers lacked measurable outcomes.",
    attempts: 0,
  },
  {
    id: "drill-3",
    skill: "Clarity",
    goal: "Plain words",
    length: "3 min",
    difficulty: "Gentle",
    type: "HR",
    recommended: false,
    attempts: 1,
  },
];

const skillGroups = [
  {
    group: "Structure",
    drills: [
      "Answer in STAR",
      "Opening in 30 seconds",
      "Summarize in one sentence",
      "Signposting",
    ],
  },
  {
    group: "Evidence",
    drills: [
      "Add a number",
      "Name the tools you used",
      "Tell the result",
      'Replace "we" with "I did" (when true)',
    ],
  },
  {
    group: "Relevance",
    drills: [
      "Answer the question asked",
      "Trim the story",
      "Link your answer to the role",
    ],
  },
  {
    group: "Clarity",
    drills: ["Plain words", "Shorter sentences", "Explain it to a non-expert"],
  },
  {
    group: "Confidence and delivery",
    drills: [
      "Slow down",
      "Reduce filler words (voice)",
      "Pause before answering",
      "Own your achievements (language practice, not personality)",
    ],
  },
  {
    group: "Handling follow-ups",
    drills: [
      'Respond to "Tell me more"',
      'Respond to "Why?"',
      "Handle a challenge politely",
    ],
  },
];

const jobsForPractice = [
  { id: "jp-1", title: "Senior Product Designer", company: "Northstar Labs" },
  { id: "jp-2", title: "Product Designer", company: "Morrow Health" },
  { id: "jp-3", title: "UX Researcher", company: "Fieldnote" },
];

const interviewTypes = [
  {
    id: "hr",
    name: "HR",
    desc: "Motivation, background, availability, strengths and weaknesses.",
    length: "About 10 min",
    count: 3,
  },
  {
    id: "behavioral",
    name: "Behavioral (STAR)",
    desc: "Situation, task, action, result questions.",
    length: "About 15 min",
    count: 2,
  },
  {
    id: "technical",
    name: "Technical",
    desc: "Role-specific concepts and problem solving; text-based code box.",
    length: "About 20 min",
    count: 4,
  },
  {
    id: "case",
    name: "Case",
    desc: "Structured business or product cases.",
    length: "About 20 min",
    count: 1,
  },
  {
    id: "founder",
    name: "Startup founder-fit",
    desc: "Ownership, ambiguity, speed, resourcefulness.",
    length: "About 15 min",
    count: 0,
  },
  {
    id: "mix",
    name: "Role-based mix",
    desc: "A balanced set for the chosen role.",
    length: "About 15 min",
    count: 2,
  },
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

const user = {
  name: "Aanya Sen",
  role: "Job seeker",
  signedIn: true,
};

function JobSeekerShell({ children, active = "Interviews", className = "" }) {
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
            return (
              <Link
                key={n}
                href={u}
                className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-xs ${n === active ? "bg-[#1C2B42] text-white" : "text-white/65 hover:bg-white/5"}`}
              >
                {n === active && (
                  <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />
                )}
                <Comp size={17} /> {n}
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
          ["More", "/jobseeker/profile", UserRound],
        ].map(([x, u, I]) => (
          <Link
            href={u}
            key={x}
            className="flex flex-col items-center gap-1 py-1 text-[9px] text-[#4A5568]"
          >
            <I size={17} /> {x}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 1: Trainer Home  /jobseeker/practice                         */
/* ------------------------------------------------------------------ */
function TrainerHomePage() {
  const [sessionsThisMonth, avgScore, practiceTime] = [6, 68, "2 h 10 min"];

  return (
    <JobSeekerShell active="Interviews">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">
            Interview practice
          </h1>
          <p className="text-xs text-[#4A5568]">
            Practice out loud, get specific feedback, and keep it private.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => {}} className="min-h-10 px-4">
            Start practice
          </Btn>
          <Btn onClick={() => {}} secondary className="min-h-10 px-3">
            Quick start
          </Btn>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Sessions this month", sessionsThisMonth, ""],
          ["Average overall score", `${avgScore}`, "▲ 5 vs last month"],
          ["Practice time", practiceTime, ""],
          ["Readiness score", "68 / 100", "▲ 5 vs last month"],
        ].map(([label, value, change], i) => (
          <button
            key={label}
            onClick={() => {}}
            className="rounded-xl border border-[#E5E1D8] bg-white p-4 text-left hover:bg-[#FCFBF9]"
          >
            <small className="text-xs text-[#4A5568]">{label}</small>
            <b className="serif mt-1 block text-2xl font-semibold">{value}</b>
            <small
              className={`text-[10px] ${i === 1 || i === 3 ? "text-[#2E7D5B]" : "text-[#4A5568]"}`}
            >
              {change}
            </small>
            {i < 2 && (
              <div className="mt-3 flex h-5 items-end gap-1">
                {[34, 55, 42, 64, 60, 83, 72, 100].map((n, k) => (
                  <i
                    key={k}
                    className={`flex-1 rounded-t ${k === 7 ? "bg-[#B8955A]" : "bg-ink/70"}`}
                    style={{ height: `${n}%` }}
                  />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card
            title="Recommended next session"
            action={
              <span className="text-xs text-[#9A7A45]">
                <Sparkles size={11} className="mr-1 inline" />
                AI suggestion
              </span>
            }
          >
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Info size={14} className="mt-0.5 text-[#B8955A]" />
                <div className="flex-1">
                  <b className="block text-xs">
                    Behavioral (STAR) · Product Designer
                  </b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    Your last two answers had good content but lacked structure.
                    A STAR practice round can help.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Btn onClick={() => {}} className="flex-1">
                  Start this session
                </Btn>
                <Btn onClick={() => {}} secondary className="flex-1">
                  Choose something else
                </Btn>
              </div>
              <button
                onClick={() => {}}
                className="text-xs text-[#9A7A45] underline ml-auto"
              >
                Why this? →
              </button>
            </div>
          </Card>

          <Card title="Practice for your interviews" padded>
            {interviews.length > 0 ? (
              <div className="space-y-3">
                {interviews.map((int) => (
                  <div
                    key={int.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <b className="block text-xs">
                        {int.role} · {int.company}
                      </b>
                      <span className="text-[10px] text-[#4A5568]">
                        {int.date} · {int.time} · {int.type}
                      </span>
                    </div>
                    <Btn onClick={() => {}} className="min-h-9 px-3">
                      Practice for this interview
                    </Btn>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-[10px] text-[#4A5568] mb-2">
                  No interviews coming up. Practice for a saved job
                </p>
                <div className="flex gap-2">
                  {drills.slice(0, 2).map((d) => (
                    <Btn
                      key={d.id}
                      onClick={() => {}}
                      secondary
                      small
                      className="flex-1"
                    >
                      {d.skill}
                    </Btn>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card title="Interview types" padded>
            <div className="grid gap-3 grid-cols-3">
              {interviewTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {}}
                  className="rounded-lg border border-[#E5E1D8] bg-white p-3 cursor-pointer hover:bg-[#F4F1EA]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xs font-semibold">{t.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] ${t.count > 0 ? "bg-[#F3EBDD] text-[#806236]" : "bg-[#F3F4F6] text-[#4A5568]"}`}
                    >
                      {t.count}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#4A5568] mb-2">{t.desc}</p>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#4A5568]">{t.length}</span>
                    <Btn onClick={() => {}} className="min-h-8 px-2">
                      Start
                    </Btn>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Recent sessions" padded>
            <div className="space-y-3">
              {sessions.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <b className="block text-xs">{s.role}</b>
                    <span className="text-[10px] text-[#4A5568]">
                      {s.type} · {s.mode} · {s.duration}
                    </span>
                    <ScoreRing
                      value={s.score}
                      size="h-7 w-7"
                      border="border-[3px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn
                      onClick={() => {}}
                      secondary
                      small
                      className="min-h-8 px-2"
                    >
                      View report
                    </Btn>
                    <Btn onClick={() => {}} small className="min-h-8 px-2">
                      Again
                    </Btn>
                  </div>
                </div>
              ))}
              <div className="mt-2 text-right">
                <Link
                  href="/jobseeker/practice/history"
                  className="text-xs text-[#9A7A45] font-medium"
                >
                  View all history →
                </Link>
              </div>
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-4 space-y-5">
          <Card title="Readiness score" padded>
            <div className="space-y-3">
              <ScoreRing
                value={68}
                size="h-20 w-20"
                border="border-[5px]"
                label="68 / 100"
              />
              <p className="text-[10px] text-[#4A5568]">
                Based on your last 5 sessions
              </p>
              <p className="text-[10px] text-[#2E7D5B]">▲ 5 this month</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#4A5568]">
                  Shared with employers:
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">
                  Off
                </span>
              </div>
              <Link
                href="/jobseeker/readiness"
                className="text-xs text-[#9A7A45] font-medium block mt-1"
              >
                View progress →
              </Link>
            </div>
          </Card>

          <Card title="Weak areas" padded>
            <div className="flex gap-2 flex-wrap">
              {["Structure", "Measurable results", "Pace"].map((w) => (
                <div
                  key={w}
                  className="rounded-full bg-[#FFF8E8] px-2 py-1 text-[10px] text-[#9A7A45]"
                >
                  {w}
                </div>
              ))}
              <Btn
                onClick={() => {}}
                secondary
                className="w-full mt-2 min-h-9 text-[10px]"
              >
                Start a drill
              </Btn>
            </div>
          </Card>

          <Card title="Privacy summary" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">
              Recordings are private and can be deleted anytime.
            </p>
            <div className="flex gap-2">
              <Btn
                onClick={() => {}}
                secondary
                className="flex-1 min-h-9 text-[10px]"
              >
                Manage privacy
              </Btn>
              <Btn
                onClick={() => {}}
                secondary
                className="flex-1 min-h-9 text-[10px]"
              >
                How scoring works
              </Btn>
            </div>
          </Card>

          <Card title="Tips" padded>
            <div className="flex items-start gap-2">
              <LightbulbIcon size={14} className="mt-0.5 text-[#B8955A]" />
              <p className="text-[10px] text-[#4A5568]">
                Say your answer aloud once before you type it. It reveals gaps.
              </p>
            </div>
            <button
              onClick={() => {}}
              className="mt-2 text-xs text-[#9A7A45] underline"
            >
              Dismiss
            </button>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 2: New Practice Setup  /jobseeker/practice/new               */
/* ------------------------------------------------------------------ */
function NewPracticeSetupPage() {
  const [startFrom, setStartFrom] = useState("role");
  const [mode, setMode] = useState("text");
  const [length, setLength] = useState("standard");
  const [difficulty, setDifficulty] = useState("realistic");
  const [followUps, setFollowUps] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState(true);
  const [hints, setHints] = useState(false);

  return (
    <JobSeekerShell active="Interviews">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">
            New practice session
          </h1>
          <p className="text-xs text-[#4A5568]">
            Choose a role and type, or build from a real job posting.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card title="1. Start from" padded>
            <div className="flex gap-2 mb-3 border-b border-[#E5E1D8] pb-2">
              {["Choose a role and type", "Build from a job posting"].map(
                (t, i) => (
                  <button
                    key={i}
                    onClick={() => setStartFrom(i === 0 ? "role" : "job")}
                    className={`px-3 py-1 text-xs border-b-2 ${startFrom === (i === 0 ? "role" : "job") ? "border-[#B8955A] text-[#0F1B2D] font-medium" : "border-transparent text-[#4A5568] hover:text-[#0F1B2D]"}`}
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
            {startFrom === "role" ? (
              <p className="text-[10px] text-[#4A5568]">
                Pick a role category, level and interview type.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] text-[#4A5568]">
                  Pick a saved job, application, scheduled interview,
                  recommended job, or paste a description.
                </p>
                <div className="flex gap-2">
                  {jobsForPractice.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => {}}
                      className="flex items-center justify-between rounded-lg border border-[#E5E1D8] bg-white p-3 cursor-pointer hover:bg-[#F4F1EA] flex-1"
                    >
                      <div>
                        <b className="block text-xs">{j.title}</b>
                        <span className="text-[9px] text-[#4A5568]">
                          {j.company}
                        </span>
                      </div>
                      <span className="text-[9px] text-[#9A7A45]">Select</span>
                    </button>
                  ))}
                </div>
                <input
                  className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none"
                  placeholder="Paste a job description…"
                />
                <AISuggestion
                  reason="The AI extracts the role, requirements and likely questions."
                  onWhy={() => {}}
                  onAccept={() => {}}
                  onEdit={() => {}}
                  onReject={() => {}}
                >
                  <p className="text-[10px] text-[#4A5568]">
                    Build from a real job posting.
                  </p>
                </AISuggestion>
              </div>
            )}
          </Card>

          <Card title="2. Role and level" padded>
            <div className="space-y-3">
              <input
                className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none"
                defaultValue="Product Designer"
              />
              <div className="flex gap-2">
                <select className="w-1/2 field text-xs">
                  <option>Entry</option>
                  <option>Mid</option>
                  <option selected>Senior</option>
                  <option>Lead or manager</option>
                </select>
                <select className="w-1/2 field text-xs">
                  <option>Fintech</option>
                  <option>Health</option>
                  <option selected>Education</option>
                  <option>E-commerce</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
          </Card>

          <Card title="3. Interview type" padded>
            <div className="grid gap-2 grid-cols-3">
              {interviewTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {}}
                  className="rounded-lg border border-[#E5E1D8] bg-white p-3 cursor-pointer hover:bg-[#F4F1EA]"
                >
                  <b className="block text-xs">{t.name}</b>
                  <span className="text-[10px] text-[#4A5568]">{t.length}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="4. Length and difficulty" padded>
            <div className="space-y-3">
              <div className="flex gap-2">
                {["quick", "standard", "full"].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLength(l)}
                    className={`flex-1 rounded-lg border py-2 text-xs text-center ${length === l ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568]"}`}
                  >
                    {l === "quick"
                      ? "Quick"
                      : l === "standard"
                        ? "Standard"
                        : "Full"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {["gentle", "realistic", "challenging"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 rounded-lg border py-2 text-xs text-center ${difficulty === d ? "border-[#B8955A] bg-[#F3EBDD] text-[#806236]" : "border-[#E5E1D8] text-[#4A5568]"}`}
                  >
                    {d === "gentle"
                      ? "Gentle"
                      : d === "realistic"
                        ? "Realistic"
                        : "Challenging"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={followUps}
                  onChange={() => setFollowUps(!followUps)}
                  className="rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                />
                <label className="text-xs cursor-pointer">
                  Follow-up questions
                </label>
              </div>
            </div>
          </Card>

          <Card title="5. Mode" padded>
            <div className="space-y-3">
              {["text", "voice", "video"].map((m) => {
                const icon =
                  m === "text" ? TypeIcon : m === "voice" ? MicIcon : VideoIcon;
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-3 rounded-lg border py-3 px-3 cursor-pointer hover:bg-[#F4F1EA] ${mode === m ? "border-[#B8955A] bg-[#FFF8E8]" : "border-[#E5E1D8]"}`}
                  >
                    <icon
                      size={16}
                      className={`text-${mode === m ? "#806236" : "#4A5568"}`}
                    />
                    <div className="flex-1">
                      <b className="block text-xs">
                        {m === "text"
                          ? "Text"
                          : m === "voice"
                            ? "Voice"
                            : "Video"}
                      </b>
                      <span className="text-[10px] text-[#4A5568]">
                        {m === "text"
                          ? "Type answers"
                          : m === "voice"
                            ? "Speak with captions"
                            : "Voice plus camera"}
                      </span>
                    </div>
                    {mode === m && (
                      <Check size={14} className="text-[#9A7A45]" />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="6. Optional features (off by default)" padded>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={delivery}
                  onChange={() => setDelivery(!delivery)}
                  className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                />
                <div className="flex-1">
                  <b className="block text-xs">Delivery analysis</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    Pace, filler words, pauses, volume consistency (eye contact
                    needs camera + separate consent).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={recording}
                  onChange={() => setRecording(!recording)}
                  className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                />
                <div className="flex-1">
                  <b className="block text-xs">Save the recording</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    Private, encrypted, deletable.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={transcript}
                  defaultChecked
                  onChange={() => setTranscript(!transcript)}
                  className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                />
                <div className="flex-1">
                  <b className="block text-xs">Keep transcript</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    On by default so the report can show answers.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={hints}
                  onChange={() => setHints(!hints)}
                  className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                />
                <div className="flex-1">
                  <b className="block text-xs">Show hints during the session</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    STAR reminder beside each question.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="7. Focus areas (optional)" padded>
            <div className="space-y-2">
              {[
                "Leadership",
                "Conflict",
                "Prioritization",
                "System design basics",
                "Product sense",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => {}}
                  className="rounded-lg border border-[#E5E1D8] bg-white p-2 cursor-pointer hover:bg-[#F4F1EA]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs">{s}</span>
                    <Check size={12} className="text-[#A0A7B4]" />
                  </div>
                </button>
              ))}
              <div className="border-t pt-2 mt-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                  />
                  <span className="text-xs">
                    Work on my weak areas{" "}
                    <span className="text-[#806236]">
                      <Sparkles size={10} className="mr-1 inline" />
                      AI suggestion
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </Card>
        </div>

        <aside
          className="lg:col-span-4 space-y-4"
          style={{ position: "sticky", top: "80px" }}
        >
          <Card title="Your session" padded>
            <div className="space-y-3 text-[10px] text-[#4A5568]">
              <div className="flex justify-between">
                <span>Start from</span>
                <span>
                  {startFrom === "role" ? "Role and type" : "Job posting"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mode</span>
                <span>
                  {mode === "text"
                    ? "Text"
                    : mode === "voice"
                      ? "Voice"
                      : "Video"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Length</span>
                <span>
                  {length === "quick"
                    ? "Quick"
                    : length === "standard"
                      ? "Standard"
                      : "Full"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Difficulty</span>
                <span>{difficulty}</span>
              </div>
              <div className="flex justify-between">
                <span>Recording</span>
                <span>{recording ? "On" : "Off"}</span>
              </div>
              <div className="flex justify-between">
                <span>Transcript</span>
                <span>{transcript ? "On" : "Off"}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery analysis</span>
                <span>{delivery ? "On" : "Off"}</span>
              </div>
              <div className="flex justify-between">
                <span>Shared with employers</span>
                <span className="text-[#4A5568]">No</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-[#4A5568]">
              Estimated{" "}
              {length === "quick"
                ? "10 min"
                : length === "standard"
                  ? "20 min"
                  : "35 min"}
            </p>
            <Btn onClick={() => {}} className="w-full mt-3">
              Start session
            </Btn>
            <Btn
              onClick={() => {}}
              secondary
              className="w-full mt-2 min-h-9 text-[10px]"
            >
              Save setup as a preset
            </Btn>
            <button
              onClick={() => {}}
              className="w-full text-xs text-[#4A5568] underline mt-1"
            >
              Cancel
            </button>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 3: Live Practice Session  /jobseeker/practice/:sessionId     */
/* ------------------------------------------------------------------ */
function LivePracticeSessionPage({ sessionId }) {
  const session = sessions.find((s) => s.id === sessionId) || sessions[0];
  const [qIndex, setQIndex] = useState(2);
  const [answering, setAnswering] = useState(false);
  const [paused, setPaused] = useState(false);

  return (
    <JobSeekerShell active="Interviews" className="pb-10">
      <header className="mb-4 rounded-xl border border-[#E5E1D8] bg-[#1C2B42] p-4 text-white">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <b className="block text-sm">{session.role}</b>
            <span className="text-[10px] text-[#F3EBDD]">
              {session.type} · Question {qIndex + 1} of {session.answers}
            </span>
          </div>
          <div className="flex gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border border-white/30 px-2 py-0.5 text-[10px] ${session.recording ? "bg-[#B8955A]/20 text-[#B8955A] border-[#B8955A]" : "text-[#A0A7B4]"}`}
            >
              {session.recording ? "●" : "○"} Recording
            </span>
            <button
              onClick={() => setPaused(!paused)}
              className="rounded-lg border border-white/30 px-3 py-1 text-[10px] text-white hover:bg-white/10"
            >
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={() => {}}
              className="rounded-lg border border-white/30 px-3 py-1 text-[10px] text-[#B42318] hover:bg-[#B42318]/20"
            >
              End session
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#A0A7B4]">
          <span>Transcript: On</span>
          <span>·</span>
          <span>Delivery analysis: Off</span>
          <span>·</span>
          <span>Private</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-6 h-[400px] flex flex-col items-center justify-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#E5E1D8] mb-4">
              <MicIcon size={24} className="text-[#A0A7B4]" />
            </div>
            <h3 className="serif text-[20px] font-semibold text-[#0F1B2D]">
              Tell me about a time you had to prioritize competing demands.
            </h3>
            <p className="mt-2 text-xs text-[#4A5568]">
              Follow-up · You mentioned a conflict with a teammate. What was the
              outcome?
            </p>
            <div className="mt-6 flex gap-2">
              {answering ? (
                <>
                  <Btn
                    onClick={() => setAnswering(false)}
                    destructive
                    className="flex-1"
                  >
                    I'm done
                  </Btn>
                  <Btn onClick={() => {}} secondary className="flex-1">
                    Repeat question
                  </Btn>
                </>
              ) : (
                <>
                  <Btn onClick={() => setAnswering(true)} className="flex-1">
                    Start answering
                  </Btn>
                  <Btn onClick={() => {}} secondary className="flex-1">
                    Need a moment
                  </Btn>
                </>
              )}
              <Btn onClick={() => {}} secondary className="flex-1">
                Skip
              </Btn>
              <Btn onClick={() => {}} secondary className="flex-1">
                Hint
              </Btn>
            </div>
            {answering && (
              <div className="mt-4 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-4 w-full text-left text-xs text-[#4A5568]">
                <b className="block mb-1">Live caption</b>
                <p>
                  I had to balance the design system work with the deadline…
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold mb-3">Your notes (private)</h2>
            <textarea
              className="w-full h-32 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 pt-2 text-sm focus:border-[#B8955A] focus:outline-none"
              placeholder="Jot down thoughts; not recorded or scored"
            />
          </div>
        </div>

        <aside
          className="lg:col-span-4 space-y-4"
          style={{ position: "sticky", top: "80px" }}
        >
          <Card title="Question text" padded>
            <p className="text-xs text-[#4A5568]">
              Tell me about a time you had to prioritize competing demands.
            </p>
            <div className="mt-3 flex gap-2 text-[10px]">
              <span className="text-[#4A5568]">Live captions: On</span>
            </div>
          </Card>
          <Card title="Hint" padded>
            <p className="text-[10px] text-[#4A5568]">
              Use STAR: Situation, Task, Action, Result.
            </p>
          </Card>
          <Card title="Progress" padded>
            <div className="space-y-2 text-xs text-[#4A5568]">
              <div className="flex justify-between">
                <span>Question</span>
                <span>
                  {qIndex + 1} of {session.answers}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Answered</span>
                <span>2</span>
              </div>
              <div className="flex justify-between">
                <span>Time</span>
                <span>4:30</span>
              </div>
            </div>
          </Card>
          <Card title="Controls" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">
              Keyboard shortcuts: 1 = start/stop answering, 2 = repeat, 3 =
              skip.
            </p>
            <div className="flex gap-2">
              <Btn onClick={() => {}} secondary className="flex-1 min-h-9">
                Mic
              </Btn>
              <Btn onClick={() => {}} secondary className="flex-1 min-h-9">
                Camera
              </Btn>
            </div>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 4: Feedback Report  /jobseeker/practice/:sessionId/report    */
/* ------------------------------------------------------------------ */
function FeedbackReportPage({ sessionId }) {
  const session = sessions.find((s) => s.id === sessionId) || sessions[0];
  const [tab, setTab] = useState("Answers");

  return (
    <JobSeekerShell active="Interviews">
      <nav className="mb-4 flex items-center gap-2 text-xs">
        <Link
          href="/jobseeker/practice"
          className="text-[#4A5568] hover:text-[#0F1B2D]"
        >
          Practice
        </Link>
        <span className="text-[#A0A7B4]">/</span>
        <span className="text-[#0F1B2D] font-medium">{session.role}</span>
      </nav>

      <header className="rounded-xl border border-[#E5E1D8] bg-white p-5 mb-4">
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="serif text-[28px] font-semibold">
              {session.role} · {session.type}
            </h1>
            <p className="text-xs text-[#4A5568]">
              {session.date} · {session.mode} · {session.duration} ·{" "}
              {session.answers} questions answered
            </p>
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => {}} className="min-h-10 px-3">
              Practice again
            </Btn>
            <Btn onClick={() => {}} secondary className="min-h-10 px-3">
              Practice weak areas
            </Btn>
            <Btn onClick={() => {}} secondary className="min-h-10 px-3">
              Share score
            </Btn>
            <button className="ml-auto rounded-lg border px-3 text-[#4A5568] hover:bg-[#F4F1EA]">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-left">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-[#4A5568]" />
            <p className="text-xs text-[#4A5568]">
              This is practice feedback from an AI. It can be wrong. Use it as a
              guide.
            </p>
          </div>
          <a href="#" className="mt-1 block text-xs text-[#9A7A45] underline">
            Request a review →
          </a>
        </div>
      </header>

      <div className="mb-4 flex gap-2 border-b border-[#E5E1D8] pb-2">
        {[
          "Answers",
          "Delivery",
          "Content breakdown",
          "Transcript",
          "Recording",
        ].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs border-b-2 ${tab === t ? "border-[#B8955A] text-[#0F1B2D] font-medium" : "border-transparent text-[#4A5568] hover:text-[#0F1B2D]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {tab === "Answers" && (
            <>
              <div className="rounded-xl border border-[#E5E1D8] bg-white p-5 mb-4">
                <h2 className="text-sm font-semibold mb-3">Overall summary</h2>
                <div className="flex items-start gap-6 mb-4">
                  <ScoreRing value={session.score} label="Overall score" />
                  <div className="flex-1">
                    <b className="block text-xs text-[#9A7A45]">Solid</b>
                    <p className="mt-1 text-[10px] text-[#4A5568]">
                      ▲ 4 vs last session
                    </p>
                    <div className="mt-3 space-y-2">
                      <div>
                        <b className="block text-xs">Top strengths</b>
                        <span className="text-[10px] text-[#4A5568]">
                          Clear examples · Relevant to the question
                        </span>
                      </div>
                      <div>
                        <b className="block text-xs">Top things to work on</b>
                        <span className="text-[10px] text-[#4A5568]">
                          Add measurable results · Concise openings
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <b className="block text-xs">One thing to try next</b>
                      <span className="text-[10px] text-[#4A5568]">
                        Add a measurable result to each answer
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-4">
                  {["Clarity", "Structure", "Relevance", "Confidence"].map(
                    (dim, i) => {
                      const scores = [72, 68, 66, 65];
                      return (
                        <div
                          key={dim}
                          className="rounded-lg border border-[#E5E1D8] bg-white p-3"
                        >
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-[#4A5568]">{dim}</span>
                            <b>{scores[i]}</b>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#E5E1D8]">
                            <div
                              className="h-full rounded-full bg-[#B8955A]"
                              style={{ width: `${scores[i]}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[9px] text-[#4A5568]">
                            {dim === "Structure"
                              ? "Situation and action clear; results missing."
                              : dim === "Clarity"
                                ? "Easy to follow."
                                : dim === "Relevance"
                                  ? "Answered what was asked."
                                  : "Confident wording."}
                          </p>
                          <a
                            href="#"
                            className="mt-1 block text-xs text-[#9A7A45] underline"
                          >
                            Rubric →
                          </a>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {[1, 2].map((q) => (
                  <div
                    key={q}
                    className="rounded-xl border border-[#E5E1D8] bg-white p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <b className="block text-xs">Question {q}</b>
                        <span className="text-[10px] text-[#4A5568]">
                          Behavioral · "Tell me about a time you prioritized…"
                        </span>
                      </div>
                      <ScoreRing
                        value={[72, 68][q - 1]}
                        size="h-6 w-6"
                        border="border-[2px]"
                        label=""
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="border-b pb-2 mb-2">
                        <b className="block text-xs">Your answer</b>
                        <p className="text-[10px] text-[#4A5568]">
                          I had to balance the design system work with the
                          shipping deadline, so I…
                        </p>
                        {session.recording && (
                          <button className="mt-1 flex items-center gap-1 text-xs text-[#9A7A45] underline">
                            Play transcript →
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 grid-cols-2">
                        <div className="rounded-lg border border-[#E5E1D8] p-2">
                          <b className="block text-[10px] text-[#4A5568]">
                            What worked
                          </b>
                          <p className="mt-1 text-[10px] text-[#4A5568]">
                            Clear example from your internship · Good use of a
                            result.
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#E5E1D8] p-2">
                          <b className="block text-[10px] text-[#4A5568]">
                            What to improve
                          </b>
                          <p className="mt-1 text-[10px] text-[#4A5568]">
                            "You said 'we did a lot' without saying what you
                            did."
                          </p>
                        </div>
                      </div>
                      <AISuggestion
                        reason="Built only from the facts in your answer."
                        onAccept={() => {}}
                        onEdit={() => {}}
                        onReject={() => {}}
                      >
                        <p className="text-[10px] text-[#4A5568]">
                          Suggested better answer (example, not a script): "I
                          led the design system migration… [Add the result: how
                          much improved?]"
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button className="flex-1 rounded-lg border px-2 py-1 text-[10px] text-[#9A7A45] underline">
                            Copy
                          </button>
                          <Btn
                            onClick={() => {}}
                            secondary
                            className="flex-1 min-h-8"
                          >
                            Practice again
                          </Btn>
                          <Btn
                            onClick={() => {}}
                            secondary
                            className="flex-1 min-h-8"
                          >
                            Save to answer bank
                          </Btn>
                        </div>
                      </AISuggestion>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Delivery" && (
            <Card title="Delivery analysis" padded>
              <p className="text-[10px] text-[#4A5568] mb-2">
                Delivery analysis was off for this session. Turn it on in setup
                for next time.
              </p>
              <div className="space-y-3 text-[10px] text-[#4A5568]">
                <div className="flex justify-between">
                  <span>Pace</span>
                  <span>Not measured</span>
                </div>
                <div className="flex justify-between">
                  <span>Filler words</span>
                  <span>Not measured</span>
                </div>
                <div className="flex justify-between">
                  <span>Eye contact</span>
                  <span>Not measured</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-[#4A5568]">
                Delivery analysis is a coaching aid. It does not judge accent,
                voice, appearance or personality.
              </p>
            </Card>
          )}
          {tab === "Content breakdown" && (
            <Card title="Content breakdown" padded>
              <div className="space-y-4 text-[10px] text-[#4A5568]">
                <div>
                  <b className="block text-xs mb-1">Structure map</b>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 rounded bg-[#E7F3EC] text-[#286749]">
                      Situation ✓
                    </span>
                    <span className="px-2 py-1 rounded bg-[#E7F3EC] text-[#286749]">
                      Task ✓
                    </span>
                    <span className="px-2 py-1 rounded bg-[#E7F3EC] text-[#286749]">
                      Action ✓
                    </span>
                    <span className="px-2 py-1 rounded bg-[#FFF8E8] text-[#9A7A45]">
                      Result ○
                    </span>
                  </div>
                </div>
                <div>
                  <b className="block text-xs mb-1">Relevance</b>
                  <p>
                    Answered the question asked; one example drifted toward
                    tools.
                  </p>
                </div>
                <div>
                  <b className="block text-xs mb-1">Evidence</b>
                  <p>
                    2 of 6 answers included specifics (numbers, tools,
                    outcomes).
                  </p>
                </div>
                <div>
                  <b className="block text-xs mb-1">Skills mentioned</b>
                  <p>
                    Figma, user research, stakeholder communication · Job match:
                    strong.
                  </p>
                </div>
              </div>
            </Card>
          )}
          {tab === "Transcript" && (
            <Card title="Transcript" padded>
              <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 h-64 overflow-y-auto text-[10px] text-[#4A5568]">
                <div className="mb-2">
                  <b>You</b> I had to balance the design system work with the
                  deadline…
                </div>
                <div className="mb-2">
                  <b>AI</b> You mentioned a conflict with a teammate. What was
                  the outcome?
                </div>
                <div>
                  <b>You</b> We resolved it by…
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Btn onClick={() => {}} secondary className="flex-1 min-h-9">
                  Edit transcript
                </Btn>
                <Btn onClick={() => {}} destructive className="flex-1 min-h-9">
                  Delete transcript
                </Btn>
              </div>
            </Card>
          )}
          {tab === "Recording" && (
            <Card title="Recording" padded>
              <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-center text-[10px] text-[#4A5568]">
                <StopCircle size={24} className="mx-auto mb-2 text-[#B42318]" />
                <p className="mb-2">Private recording saved</p>
                <div className="flex gap-2 justify-center">
                  <Btn onClick={() => {}} secondary className="min-h-9">
                    Play
                  </Btn>
                  <Btn onClick={() => {}} secondary className="min-h-9">
                    Download
                  </Btn>
                  <Btn onClick={() => {}} destructive className="min-h-9">
                    Delete recording
                  </Btn>
                </div>
                <p className="mt-2 text-[#B42318]">
                  Private — never shared with employers.
                </p>
              </div>
            </Card>
          )}
        </div>

        <aside
          className="lg:col-span-4 space-y-4"
          style={{ position: "sticky", top: "80px" }}
        >
          <Card title="Next steps" padded>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Wrench size={14} className="mt-0.5 text-[#B8955A]" />
                <div className="flex-1">
                  <b className="block text-xs">Drill: add measurable results</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    Your answers lacked measurable outcomes.
                  </p>
                </div>
                <Btn onClick={() => {}} className="min-h-8 px-2 text-[9px]">
                  Start
                </Btn>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="mt-0.5 text-[#9A7A45]" />
                <div className="flex-1">
                  <b className="block text-xs">
                    Practice again at Standard length
                  </b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    Behavioral (STAR) round.
                  </p>
                </div>
                <Btn onClick={() => {}} className="min-h-8 px-2 text-[9px]">
                  Start
                </Btn>
              </div>
            </div>
          </Card>
          <Card title="Compared with your last sessions" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">
              Your own history only.
            </p>
            <div className="space-y-2">
              {[68, 74, 61].map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[10px]"
                >
                  <span>Session {i + 1}</span>
                  <span className="text-[#0F1B2D] font-medium">{s}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Readiness impact" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">
              This session updated your readiness score from 66 to 68.
            </p>
            <Link
              href="/jobseeker/readiness"
              className="text-xs text-[#9A7A45] font-medium block"
            >
              View progress →
            </Link>
          </Card>
          <Card title="Privacy summary" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">
              What was saved: transcript, scores. Recording:{" "}
              {session.recording ? "Yes" : "No"}. Who can see it: only you.
            </p>
            <Btn
              onClick={() => {}}
              secondary
              className="w-full min-h-9 text-[10px]"
            >
              Manage
            </Btn>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 5: Practice History and Recordings  /jobseeker/practice/history */
/* ------------------------------------------------------------------ */
function PracticeHistoryPage() {
  const [tab, setTab] = useState("Sessions");
  const [view, setView] = useState("cards");

  return (
    <JobSeekerShell active="Interviews">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">Practice history</h1>
          <p className="text-xs text-[#4A5568]">Only you can see this.</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-4">
        {[
          ["Sessions", sessions.length],
          ["Recordings stored", "3", "1.2 GB"],
          ["Transcripts stored", "15"],
          ["Last practice", "2 days ago"],
        ].map(([label, value, extra], i) => (
          <div
            key={label}
            className="rounded-xl border border-[#E5E1D8] bg-white p-4"
          >
            <p className="text-[10px] text-[#4A5568]">{label}</p>
            <b className="serif mt-1 block text-2xl font-semibold">{value}</b>
            {extra && <p className="mt-1 text-xs text-[#4A5568]">{extra}</p>}
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2 border-b border-[#E5E1D8] pb-2">
        {["Sessions", "Recordings", "Answer bank"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs border-b-2 ${tab === t ? "border-[#B8955A] text-[#0F1B2D] font-medium" : "border-transparent text-[#4A5568] hover:text-[#0F1B2D]"}`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setView("cards")}
            className={`rounded-lg border px-2 py-1.5 text-[10px] ${view === "cards" ? "border-[#B8955A] bg-[#F3EBDD]" : "border-[#E5E1D8]"}`}
          >
            <LayoutGrid size={13} />
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-lg border px-2 py-1.5 text-[10px] ${view === "list" ? "border-[#B8955A] bg-[#F3EBDD]" : "border-[#E5E1D8]"}`}
          >
            <List size={13} />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {tab === "Sessions" && (
            <div>
              {sessions.length === 0 ? (
                <Card title="No sessions yet" padded>
                  <p className="text-xs text-[#4A5568]">
                    Your practice history will show up here.
                  </p>
                  <Btn onClick={() => {}}>Start practice</Btn>
                </Card>
              ) : view === "cards" ? (
                <div className="space-y-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`${RADIUS_CARD || "rounded-xl"} border border-[#E5E1D8] bg-white p-4 animate-enter`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">
                            {s.role.slice(0, 1)}
                          </span>
                          <h3 className="text-sm font-semibold">{s.role}</h3>
                          <StatusChip
                            status={s.score >= 60 ? "Ready" : "Draft"}
                          />
                        </div>
                        <div className="flex gap-1">
                          <Btn
                            onClick={() => {}}
                            secondary
                            small
                            className="min-h-8 px-2"
                          >
                            View report
                          </Btn>
                          <Btn
                            onClick={() => {}}
                            small
                            className="min-h-8 px-2"
                          >
                            Again
                          </Btn>
                        </div>
                      </div>
                      <p className="text-xs text-[#4A5568] mb-2">
                        {s.type} · {s.mode} · {s.duration} · {s.date}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#4A5568]">
                        <span>Score {s.score}</span>
                        <span>·</span>
                        <span>{s.answers} answers</span>
                        <span>·</span>
                        <span>{s.followedUp} follow-ups</span>
                      </div>
                      <div className="mt-3 flex gap-2 text-[10px] text-[#4A5568]">
                        <span>{s.transcript ? "Transcript" : "—"}</span>
                        <span>·</span>
                        <span>{s.recording ? "Recording" : "—"}</span>
                        <span>·</span>
                        <span>{s.delivery ? "Delivery" : "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E1D8]">
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Session
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Type
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Score
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Date
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Data kept
                        </th>
                        <th className="pb-3 text-[10px] text-[#4A5568] font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id} className="border-b border-[#E5E1D8]">
                          <td className="py-3">
                            <b className="text-xs">{s.role}</b>
                          </td>
                          <td className="py-3 text-xs text-[#4A5568]">
                            {s.type}
                          </td>
                          <td className="py-3 text-xs">{s.score}</td>
                          <td className="py-3 text-xs text-[#4A5568]">
                            {s.date}
                          </td>
                          <td className="py-3 text-xs">
                            {[
                              s.transcript && "T",
                              s.recording && "R",
                              s.delivery && "D",
                            ]
                              .filter(Boolean)
                              .join(", ") || "None"}
                          </td>
                          <td className="py-3">
                            <Btn
                              onClick={() => {}}
                              secondary
                              small
                              className="min-w-[48px]"
                            >
                              View
                            </Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {tab === "Recordings" && (
            <Card title="Recordings" padded>
              <p className="text-xs text-[#4A5568] mb-2">
                Recordings are used only to give you feedback. They are never
                shared with employers and are not used to train third-party
                models.
              </p>
              <div className="space-y-2">
                {[
                  {
                    id: "r1",
                    session: "Product Designer · Behavioral",
                    date: "4 Nov",
                    duration: "12 min",
                    size: "4.2 MB",
                  },
                  {
                    id: "r2",
                    session: "Product Designer · HR",
                    date: "29 Oct",
                    duration: "10 min",
                    size: "3.8 MB",
                  },
                ].map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <b className="block text-xs">{r.session}</b>
                      <span className="text-[10px] text-[#4A5568]">
                        {r.date} · {r.duration} · {r.size}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip status="Private" className="mb-0.5" />
                      <div className="flex gap-1">
                        <Btn
                          onClick={() => {}}
                          secondary
                          small
                          className="min-h-8 px-2"
                        >
                          Play
                        </Btn>
                        <Btn
                          onClick={() => {}}
                          secondary
                          small
                          className="min-h-8 px-2"
                        >
                          Download
                        </Btn>
                        <Btn
                          onClick={() => {}}
                          destructive
                          small
                          className="min-h-8 px-2"
                        >
                          Delete
                        </Btn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === "Answer bank" && (
            <Card title="Answer bank" padded>
              <p className="text-xs text-[#4A5568] mb-2">
                Your saved answers — private, never includes AI-invented facts.
              </p>
              <div className="space-y-2">
                {[
                  {
                    q: "Tell me about a conflict.",
                    tags: ["conflict", "teamwork"],
                    practiced: "4 Nov",
                  },
                  {
                    q: "Why this role?",
                    tags: ["motivation"],
                    practiced: "2 Nov",
                  },
                ].map((a) => (
                  <div
                    key={a.q}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <b className="block text-xs">{a.q}</b>
                      <div className="flex gap-1 mt-1">
                        {a.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[9px] text-[#4A5568]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-[#4A5568]">
                        Practiced {a.practiced}
                      </span>
                    </div>
                    <Btn
                      onClick={() => {}}
                      secondary
                      small
                      className="min-h-8 px-2"
                    >
                      Practice
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <Card title="Data and deletion" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">
              Reports are kept until you delete them. Deleted data is removed
              within 30 days.
            </p>
            <div className="space-y-2">
              <Btn
                onClick={() => {}}
                secondary
                className="w-full min-h-9 text-[10px]"
              >
                Download my practice data
              </Btn>
              <Btn
                onClick={() => {}}
                destructive
                secondary
                className="w-full min-h-9 text-[10px]"
              >
                Delete all recordings
              </Btn>
              <Btn
                onClick={() => {}}
                destructive
                secondary
                className="w-full min-h-9 text-[10px]"
              >
                Delete all practice data
              </Btn>
            </div>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 6: Progress and Readiness Score  /jobseeker/readiness        */
/* ------------------------------------------------------------------ */
function ReadinessPage() {
  return (
    <JobSeekerShell active="Interviews">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">
            Progress and readiness
          </h1>
          <p className="text-xs text-[#4A5568]">
            A practice guide, not a hiring decision.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => {}} className="min-h-10 px-4">
            Share settings
          </Btn>
          <Btn onClick={() => {}} className="min-h-10 px-3">
            Start practice
          </Btn>
        </div>
      </div>

      <header className="rounded-xl border border-[#E5E1D8] bg-white p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ScoreRing
                value={68}
                size="h-20 w-20"
                border="border-[5px]"
                label="Job-readiness score"
              />
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF8E8] px-2 py-1 text-[10px] text-[#9A7A45]">
                ▲ 6 this month
              </span>
            </div>
            <h2 className="serif text-[20px] font-semibold">Solid</h2>
            <p className="mt-1 text-xs text-[#4A5568]">
              Last updated 4 Nov · Based on your last 5 sessions
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#4A5568]">
              A practice guide, not a hiring decision. Employers make their own
              decisions.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card title="Score trend" padded>
            <div className="h-48 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 flex items-end gap-1">
              {[55, 60, 58, 64, 62, 66, 68].map((v, i) => (
                <div key={i} className="flex-1 flex items-end justify-center">
                  <div
                    className={`h-[calc(100%*${v / 80})] rounded-t bg-[#B8955A]`}
                    style={{ height: `${v}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-[#4A5568]">
              <span>Up 12 points in 60 days</span>
              <button className="text-xs text-[#9A7A45] underline">
                View as table →
              </button>
            </div>
          </Card>

          <Card title="Dimension breakdown" padded>
            <div className="space-y-3">
              {[
                ["Clarity", 72, "Easy to follow."],
                [
                  "Structure",
                  68,
                  "Situation and action clear; results missing.",
                ],
                ["Relevance", 66, "Answered what was asked."],
                ["Confidence", 65, "Confident wording."],
              ].map(([dim, v, note]) => (
                <div
                  key={dim}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div>
                    <b className="block text-xs">{dim}</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">{note}</p>
                  </div>
                  <div className="text-right">
                    <b className="block text-xs">{v}</b>
                    <Btn
                      onClick={() => {}}
                      secondary
                      className="min-h-7 px-2 text-[9px]"
                    >
                      Practice this
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Strengths and weak areas" padded>
            <div className="grid gap-3 grid-cols-2">
              <div className="rounded-lg border border-[#E5E1D8] bg-[#E7F3EC] p-3">
                <b className="block text-xs text-[#286749]">Strengths</b>
                <ul className="space-y-1 text-[10px] text-[#4A5568] mt-2 list-disc list-inside">
                  <li>Clear examples</li>
                  <li>Relevant to the question</li>
                </ul>
              </div>
              <div className="rounded-lg border border-[#E5E1D8] bg-[#FFF8E8] p-3">
                <b className="block text-xs text-[#9A7A45]">Weak areas</b>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#4A5568]">
                      Measurable results
                    </span>
                    <Btn
                      onClick={() => {}}
                      secondary
                      className="min-h-7 px-2 text-[9px]"
                    >
                      Start a drill
                    </Btn>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#4A5568]">
                      Opening statements
                    </span>
                    <Btn
                      onClick={() => {}}
                      secondary
                      className="min-h-7 px-2 text-[9px]"
                    >
                      Start a drill
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Question-type coverage" padded>
            <div className="space-y-2">
              {["HR", "Behavioral", "Technical", "Case", "Founder-fit"].map(
                (t) => (
                  <div
                    key={t}
                    className="flex items-center justify-between text-[10px] text-[#4A5568]"
                  >
                    <span>{t}</span>
                    <span className="text-[#0F1B2D] font-medium">
                      3 sessions
                    </span>
                  </div>
                ),
              )}
              <p className="mt-2 text-[10px] text-[#4A5568]">
                You haven't tried a Case session yet.
              </p>
            </div>
          </Card>

          <Card title="Goals" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">
              Be ready for interviews at Northstar Labs by 20 Nov.
            </p>
            <div className="space-y-2 text-[10px] text-[#4A5568]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-[#E5E1D8] text-[#B8955A]"
                />
                <span>2 sessions per week</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-[#E5E1D8] text-[#B8955A]"
                />
                <span>Complete STAR drill</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-[#806236]">
              <span className="text-[#806236]">
                <Sparkles size={10} className="mr-1 inline" />
              </span>
              AI suggestion — can be edited.
            </p>
          </Card>
        </div>

        <aside
          className="lg:col-span-4 space-y-4"
          style={{ position: "sticky", top: "80px" }}
        >
          <Card title="Sharing with employers" padded>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs">Current status</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">
                  Not shared
                </span>
              </div>
              <p className="text-[10px] text-[#4A5568]">
                Employers see the readiness score and, if chosen, dimension
                scores — never answers, transcripts or recordings.
              </p>
              <Btn onClick={() => {}} className="w-full min-h-9 mt-2">
                Manage sharing
              </Btn>
              <p className="mt-2 text-[10px] text-[#4A5568]">
                Sharing is optional and never required to apply.
              </p>
            </div>
          </Card>
          <Card title="Next steps" padded>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Wrench size={14} className="mt-0.5 text-[#B8955A]" />
                <div className="flex-1">
                  <b className="block text-xs">Complete STAR drill</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    Structure answers with results.
                  </p>
                </div>
                <Btn onClick={() => {}} className="min-h-8 px-2 text-[9px]">
                  Start
                </Btn>
              </div>
              <div className="flex items-start gap-2">
                <MicIcon size={14} className="mt-0.5 text-[#9A7A45]" />
                <div className="flex-1">
                  <b className="block text-xs">Behavioral session</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">
                    Practice follow-ups.
                  </p>
                </div>
                <Btn onClick={() => {}} className="min-h-8 px-2 text-[9px]">
                  Start
                </Btn>
              </div>
            </div>
          </Card>
          <Card title="Score history log" padded>
            <div className="space-y-2 text-[10px] text-[#4A5568]">
              <div className="flex justify-between">
                <span>Session on 4 Nov</span>
                <span className="text-[#2E7D5B]">+2</span>
              </div>
              <div className="flex justify-between">
                <span>Resume ATS check</span>
                <span className="text-[#2E7D5B]">+1</span>
              </div>
              <div className="flex justify-between">
                <span>Technical session</span>
                <span className="text-[#4A5568]">-1</span>
              </div>
            </div>
          </Card>
          <Card title="Help" padded>
            <div className="space-y-2">
              <a href="#" className="text-xs text-[#9A7A45] underline block">
                How scoring works
              </a>
              <a href="#" className="text-xs text-[#9A7A45] underline block">
                Request a review
              </a>
              <a href="#" className="text-xs text-[#9A7A45] underline block">
                Contact support
              </a>
            </div>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 7: Weak-Area Drills  /jobseeker/practice/drills              */
/* ------------------------------------------------------------------ */
function DrillsPage() {
  const [tab, setTab] = useState("Recommended");

  return (
    <JobSeekerShell active="Interviews">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">Weak-area drills</h1>
          <p className="text-xs text-[#4A5568]">
            Short practice on one thing at a time. Most drills take 3 to 7
            minutes.
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-4">
        {[
          ["Drills done this month", "4"],
          ["Current focus", "Structure"],
          ["Time spent", "24 min"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-[#E5E1D8] bg-white p-4"
          >
            <p className="text-[10px] text-[#4A5568]">{label}</p>
            <b className="serif mt-1 block text-2xl font-semibold">{value}</b>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2 border-b border-[#E5E1D8] pb-2">
        {["Recommended", "All drills", "My drills"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs border-b-2 ${tab === t ? "border-[#B8955A] text-[#0F1B2D] font-medium" : "border-transparent text-[#4A5568] hover:text-[#0F1B2D]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {tab === "Recommended" && (
            <>
              <div className="space-y-4">
                {drills
                  .filter((d) => d.recommended)
                  .map((d) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-[#E5E1D8] bg-white p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{d.skill}</h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[9px] text-[#806236]">
                            <Sparkles size={10} className="mr-1 inline" />
                            AI suggestion
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] ${d.difficulty === "Gentle" ? "bg-[#E7F3EC] text-[#286749]" : "bg-[#F3F4F6] text-[#4A5568]"}`}
                        >
                          {d.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-[#4A5568] mb-2">{d.goal}</p>
                      <p className="text-[10px] text-[#4A5568] mb-2">
                        {d.evidence}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#4A5568]">
                        <span>{d.length}</span>
                        <span>·</span>
                        <span>{d.type}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Btn onClick={() => {}} className="flex-1">
                          Start drill
                        </Btn>
                        <Btn onClick={() => {}} secondary className="flex-1">
                          Why this?
                        </Btn>
                      </div>
                      <button
                        onClick={() => {}}
                        className="mt-2 text-xs text-[#9A7A45] underline block text-left"
                      >
                        Not now
                      </button>
                    </div>
                  ))}
              </div>
              <p className="mt-4 text-[10px] text-[#4A5568]">
                You're up to date. Try a full session or a new skill.
              </p>
            </>
          )}
          {tab === "All drills" && (
            <Card title="Drill library" padded>
              <div className="space-y-4">
                {skillGroups.map((g) => (
                  <div key={g.group} className="mb-4">
                    <b className="block text-xs text-[#4A5568] mb-2">
                      {g.group}
                    </b>
                    <div className="flex flex-wrap gap-2">
                      {g.drills.map((d) => (
                        <span
                          key={d}
                          className="rounded-full border border-[#E5E1D8] bg-white px-2.5 py-1 text-[10px] text-[#4A5568]"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {tab === "My drills" && (
            <Card title="My drills" padded>
              <p className="text-[10px] text-[#4A5568] mb-2">
                History of drills done, with date, skill, attempts and
                improvement.
              </p>
              <div className="space-y-2">
                {drills.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <b className="block text-xs">{d.skill}</b>
                      <span className="text-[10px] text-[#4A5568]">
                        {d.attempts} attempt{d.attempts !== 1 ? "s" : ""} ·{" "}
                        {d.improved || "—"}
                      </span>
                    </div>
                    <Btn onClick={() => {}} secondary className="min-h-8 px-2">
                      Repeat
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside
          className="lg:col-span-4 space-y-4"
          style={{ position: "sticky", top: "80px" }}
        >
          <Card title="Drill player" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">
              Compact live session: goal and tip, 2–5 prompts, instant
              micro-feedback, wrap-up.
            </p>
            <div className="space-y-1 text-[10px] text-[#4A5568]">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-[#B8955A]" />
                <span>Goal and tip</span>
              </div>
              <div className="flex items-center gap-2">
                <MicIcon size={12} className="text-[#B8955A]" />
                <span>Practice prompts</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-[#9A7A45]" />
                <span>Micro-feedback</span>
              </div>
            </div>
          </Card>
          <Card title="Rules" padded>
            <p className="text-[10px] text-[#4A5568]">
              No full scores in drills. Drill results contribute lightly to
              readiness trends; a poor drill never lowers your score.
            </p>
          </Card>
          <Card title="Custom drill" padded>
            <input
              className="w-full h-9 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none"
              placeholder="Paste a question you want to practice"
            />
            <Btn onClick={() => {}} className="w-full mt-2 min-h-9">
              Make my own drill
            </Btn>
            <p className="mt-2 text-[10px] text-[#4A5568]">
              Your question is private and isn't added to the shared question
              bank.
            </p>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 8: Scoring Rubric and Privacy  /jobseeker/practice/rubric    */
/* ------------------------------------------------------------------ */
function RubricPage() {
  const [section, setSection] = useState("How scoring works");

  const sections = [
    "How scoring works",
    "The rubrics",
    "What we don't score",
    "Fairness and testing",
    "Your data",
    "Sharing with employers",
    "Your controls",
    "Review and corrections",
    "Changes to this page",
  ];

  return (
    <JobSeekerShell active="Interviews">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">
            Scoring rubric and privacy
          </h1>
          <p className="text-xs text-[#4A5568]">
            How scores are produced, what we store and who can see it.
          </p>
        </div>
      </div>

      <div className="max-w-[840px]">
        <nav className="mb-6 hidden lg:block">
          <ul className="flex gap-4 text-xs">
            {sections.map((s) => (
              <li key={s}>
                <a
                  href={`#${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setSection(s);
                  }}
                  className={`text-xs ${section === s ? "text-[#0F1B2D] font-medium" : "text-[#4A5568] hover:text-[#0F1B2D]"}`}
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-8">
          <section id="how-scoring-works">
            <h2 className="serif text-[20px] font-semibold mb-2">
              How scoring works
            </h2>
            <p className="text-[10px] text-[#4A5568] mb-3">
              The AI compares each answer with a published rubric, scores four
              dimensions — Clarity, Structure, Relevance and Confidence —
              explains each score, and combines them into an overall score and a
              readiness score.
            </p>
            <div className="flex items-center gap-4 text-[10px] text-[#4A5568]">
              <span>Answer →</span>
              <span>Rubric check →</span>
              <span>Dimension scores →</span>
              <span>Session score →</span>
              <span>Readiness score</span>
            </div>
            <p className="mt-3 text-[10px] text-[#4A5568]">
              <b className="text-[#B42318]">Limits:</b> The AI can make
              mistakes. Scores are a guide for practice.
            </p>
          </section>

          <section id="the-rubrics">
            <h2 className="serif text-[20px] font-semibold mb-2">
              The rubrics
            </h2>
            <table className="w-full text-left text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-[#E5E1D8]">
                  <th className="pb-2 text-[#4A5568] font-medium">Dimension</th>
                  <th className="pb-2 text-[#4A5568] font-medium">
                    What it measures
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Clarity",
                    "Easy to follow? Plain language, logical flow, a clear main point, concise.",
                  ],
                  [
                    "Structure",
                    "Follows a helpful structure (e.g. STAR for behavioral). Clear start, middle and end.",
                  ],
                  [
                    "Relevance",
                    "Answers the question asked, with fitting examples and the right level of detail.",
                  ],
                  [
                    "Confidence",
                    "Language shows ownership and conviction; based on wording, not tone or appearance.",
                  ],
                ].map(([dim, desc]) => (
                  <tr key={dim} className="border-b border-[#E5E1D8]">
                    <td className="py-2">
                      <b className="text-[#0F1B2D]">{dim}</b>
                    </td>
                    <td className="py-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-[#4A5568]">
              Band labels: Needs work (0–39), Developing (40–59), Solid (60–79),
              Strong (80–100). Rubric version 1.0 · Oct 2026.
            </p>
          </section>

          <section id="what-we-dont-score">
            <h2 className="serif text-[20px] font-semibold mb-2">
              What we don't score
            </h2>
            <ul className="space-y-1 text-[10px] text-[#4A5568] list-disc list-inside">
              <li>Accent or pronunciation</li>
              <li>Voice pitch or tone as a personal trait</li>
              <li>Appearance, clothing, background</li>
              <li>
                Age, gender, disability, religion, caste, nationality, marital
                status, family details
              </li>
              <li>Health, emotions or personality, and "culture fit"</li>
            </ul>
          </section>

          <section id="your-data">
            <h2 className="serif text-[20px] font-semibold mb-2">Your data</h2>
            <table className="w-full text-left text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-[#E5E1D8]">
                  <th className="pb-2 text-[#4A5568] font-medium">Data</th>
                  <th className="pb-2 text-[#4A5568] font-medium">
                    Stored by default?
                  </th>
                  <th className="pb-2 text-[#4A5568] font-medium">
                    Who can see it
                  </th>
                  <th className="pb-2 text-[#4A5568] font-medium">Delete</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Scores and reports", "Yes", "Only you", "Yes"],
                  ["Transcripts", "Yes (can be turned off)", "Only you", "Yes"],
                  ["Recordings", "No (opt-in)", "Only you", "Yes"],
                  ["Delivery analysis", "Only if turned on", "Only you", "Yes"],
                  [
                    "Readiness score",
                    "Yes",
                    "Only you, and employers you choose",
                    "Yes",
                  ],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-[#E5E1D8]">
                    {row.map((cell, j) => (
                      <td key={j} className="py-2">
                        {j === 0 ? (
                          <b className="text-[#0F1B2D]">{cell}</b>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-[#4A5568]">
              Recordings are stored encrypted, used only to produce your
              feedback, never shared with employers, and not used to train
              third-party models.
            </p>
          </section>

          <section id="your-controls">
            <h2 className="serif text-[20px] font-semibold mb-2">
              Your controls
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs">Delivery analysis default</span>
                <select className="h-9 rounded-lg border border-[#E5E1D8] bg-white pl-2 pr-2 text-xs focus:border-[#B8955A] focus:outline-none">
                  <option>Off</option>
                  <option>Per session</option>
                  <option>On</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">Save recordings by default</span>
                <select className="h-9 rounded-lg border border-[#E5E1D8] bg-white pl-2 pr-2 text-xs focus:border-[#B8955A] focus:outline-none">
                  <option>Off</option>
                  <option>On</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">
                  Share readiness score with employers
                </span>
                <select className="h-9 rounded-lg border border-[#E5E1D8] bg-white pl-2 pr-2 text-xs focus:border-[#B8955A] focus:outline-none">
                  <option>Off</option>
                  <option>Per application</option>
                  <option>All</option>
                </select>
              </div>
              <div className="mt-3 space-y-2">
                <Btn onClick={() => {}} className="w-full min-h-9">
                  Download my practice data
                </Btn>
                <Btn
                  onClick={() => {}}
                  destructive
                  secondary
                  className="w-full min-h-9"
                >
                  Delete all practice data
                </Btn>
              </div>
            </div>
          </section>
        </div>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers for icons not imported above                              */
/* ------------------------------------------------------------------ */
function LightbulbIcon({ size = 14, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 15H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2Z" />
      <path d="M13 15h-2" />
      <path d="M9.5 14.5c-1.396 0-2.57-.86-2.996-2.068L9 9l.504-2.34a2 2 0 0 1 3.992 0L15 9l-.496 2.34A2 2 0 0 1 13.004 14.5h-3.5Z" />
    </svg>
  );
}

function TypeIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="4 7 4 4 20 4 20 7" />
      <rect x="2" y="11" width="20" height="7" rx="2" ry="2" />
      <path d="M16 11v5" />
      <path d="M8 11v5" />
    </svg>
  );
}

const RADIUS_CARD = "rounded-xl";

/* ------------------------------------------------------------------ */
/*  Router export                                                     */
/* ------------------------------------------------------------------ */
const PAGES = {
  practice: TrainerHomePage,
  new: NewPracticeSetupPage,
  session: LivePracticeSessionPage,
  report: FeedbackReportPage,
  history: PracticeHistoryPage,
  readiness: ReadinessPage,
  drills: DrillsPage,
  rubric: RubricPage,
};

export default function JobSeekerInterviewTrainer({
  page = "practice",
  sessionId,
}) {
  const Page = PAGES[page];
  if (!page || !Page) return <TrainerHomePage />;
  const props = {};
  if (sessionId) props.sessionId = sessionId;
  return <Page {...props} />;
}

export {
  TrainerHomePage,
  NewPracticeSetupPage,
  LivePracticeSessionPage,
  FeedbackReportPage,
  PracticeHistoryPage,
  ReadinessPage,
  DrillsPage,
  RubricPage,
};
