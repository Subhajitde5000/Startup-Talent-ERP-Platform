'use client';
import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Bookmark, Briefcase, CalendarDays, FileText, Mic, MessageCircle,
  Settings, HelpCircle, Bell, ChevronDown, MapPin, ArrowRight, CheckCircle2,
  Clock, AlertCircle, Info, Sparkles, MoreHorizontal, X, Send, Eye,
  ShieldCheck, SlidersHorizontal, UserRound, Star, ExternalLink, Plus,
  Target, TrendingUp, Building2, Video, ChevronLeft, ChevronRight, Shield,
  Share2, RefreshCw, Pin, Bell as BellIcon, CreditCard, HardHat, LayoutGrid,
  LayoutDashboard, List, Gauge, Users, Briefcase as Briefcase2,
  FileText as FileText2, ClipboardList, BarChart3, Rocket, Award, Zap,
  Smartphone, Mail, Loader2, RotateCcw, Check, CheckCheck, PlusCircle,
  ArrowUpRight, Trash2, Phone, Headphones, Globe, Link as LinkIcon, Copy,
  Download, Printer, Wrench, Menu, LogOut, File, Image, Folder, Type,
  AlignLeft, Bold, Italic, Code, Barcode, Command, EyeOff, PenTool,
  LayoutList, Maximize, Minimize, RotateCw, Scan, Upload, Clock as ClockIcon
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Design tokens (match globals.css / tailwind.config.js)            */
/* ------------------------------------------------------------------ */
const INK = '#0F1B2D';
const INK_SOFT = '#1C2B42';
const IVORY = '#FAF8F4';
const WHITE = '#FFFFFF';
const GOLD = '#B8955A';
const GOLD_DARK = '#9A7A45';
const GOLD_TINT = '#F3EBDD';
const STONE_700 = '#4A5568';
const STONE_400 = '#A0A7B4';
const STONE_200 = '#E5E1D8';
const SUCCESS = '#2E7D5B';
const SUCCESS_TINT = '#E7F3EC';
const SUCCESS_DARK = '#286749';
const WARNING = '#B7791F';
const WARNING_TINT = '#FFF8E8';
const WARNING_DARK = '#9A7A45';
const ERROR = '#B42318';
const ERROR_TINT = '#FCE8E6';

/* ------------------------------------------------------------------ */
/*  Sample data                                                       */
/* ------------------------------------------------------------------ */
const resumes = [
  {
    id: 'res-001', name: 'Product Designer', targetRole: 'Product Designer',
    template: 'Classic', ats: 81, status: 'Primary', primary: true,
    updated: '2 days ago', version: 'v5', applications: 3, tailoredJobs: [],
    summary: 'Product designer with 4 years of experience...',
  },
  {
    id: 'res-002', name: 'UX Researcher', targetRole: 'UX Researcher',
    template: 'Modern', ats: 74, status: 'Ready', primary: false,
    updated: '1 week ago', version: 'v2', applications: 1, tailoredJobs: [],
    summary: 'UX researcher focused on generative and evaluative research...',
  },
  {
    id: 'res-003', name: 'Frontend Engineer', targetRole: 'Frontend Engineer',
    template: 'Compact', ats: 68, status: 'Needs review', primary: false,
    updated: '3 weeks ago', version: 'v1', applications: 0, tailoredJobs: [],
    summary: 'Frontend engineer...',
  },
];

const profile = {
  name: 'Aanya Sen', email: 'aanya@example.in', phone: '+91 98765 43210',
  city: 'Kolkata', region: 'West Bengal', links: { linkedin: 'linkedin.com/in/ananya', portfolio: 'ananya.design' },
  summary: 'Product designer with experience in fintech and healthcare.',
  experience: [
    { id: 'exp-1', title: 'Senior Product Designer', company: 'Northstar Labs', location: 'Remote · India', dates: 'Jan 2023 – Present', type: 'Full-time', bullets: ['Owned end-to-end design of core user flows', 'Built and maintained the design system', 'Ran usability tests and iterated based on feedback'] },
    { id: 'exp-2', title: 'Product Designer', company: 'Morrow Health', location: 'Bengaluru · Hybrid', dates: 'Mar 2021 – Dec 2022', type: 'Full-time', bullets: ['Designed patient-facing telemedicine experiences', 'Partnered with clinical advisors'] },
  ],
  education: [{ id: 'edu-1', degree: 'B.Des in Communication Design', institution: 'National Institute of Design', location: 'Bengaluru', dates: '2017 – 2021', grade: '', highlights: [] }],
  skills: [{ id: 'sk-1', name: 'Figma', category: 'Technical', proficiency: 'Advanced' }, { id: 'sk-2', name: 'User research', category: 'Technical', proficiency: 'Advanced' }, { id: 'sk-3', name: 'Design systems', category: 'Technical', proficiency: 'Intermediate' }],
};

const jobs = [
  { id: 'senior-product-designer', title: 'Senior Product Designer', company: 'Northstar Labs', loc: 'Remote · India', salary: '₹18–24 LPA', mustHave: [{ skill: 'Product design' }, { skill: 'Figma' }, { skill: 'Design systems' }] },
  { id: 'product-designer', title: 'Product Designer', company: 'Morrow Health', loc: 'Bengaluru · Hybrid', salary: '₹16–22 LPA', mustHave: [{ skill: 'Product design' }, { skill: 'Figma' }, { skill: 'Healthcare UX' }] },
];

const templates = [
  { id: 't1', name: 'Classic', preview: 'C', description: 'Clean, single-column, ATS-friendly' },
  { id: 't2', name: 'Modern', preview: 'M', description: 'Section accents, good for creative roles' },
  { id: 't3', name: 'Compact', preview: 'X', description: 'Dense one-page layout' },
  { id: 't4', name: 'Two-column-light', preview: '2', description: 'Two columns, premium', premium: true },
];

/* ------------------------------------------------------------------ */
/*  Shared UI primitives                                              */
/* ------------------------------------------------------------------ */
function Btn({ children, onClick, primary = true, secondary = false, destructive = false, small = false, disabled = false, className = '', width = '' }) {
  const base = 'inline-flex min-h-10 items-center justify-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const styles = primary
    ? `bg-[#0F1B2D] text-white hover:bg-[#1C2B42]`
    : secondary
      ? `border border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA]`
      : destructive
        ? `border border-transparent text-[#B42318] hover:bg-[#FCE8E6]`
        : `bg-[#F3EBDD] text-[#806236] hover:bg-[#F0E5CC]`;
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} rounded-lg px-3.5 ${small ? 'py-1.5' : 'py-2'} ${styles} ${className} ${width}`}>
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
    Draft: 'border border-[#4A5568] text-[#4A5568]',
    Ready: 'bg-[#E7F3EC] text-[#286749]',
    Primary: 'bg-[#F3EBDD] text-[#806236]',
    'Tailored for job': 'border border-[#0F1B2D] text-[#0F1B2D]',
    'Needs review': 'bg-[#FFF8E8] text-[#9A7A45]',
    Archived: 'bg-[#F3F4F6] text-[#4A5568]',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium ${map[status] || map.Draft}`}>
      {status}
    </span>
  );
}

function AISuggestion({ label = 'AI suggestion', reason, onWhy, onAccept, onEdit, onReject, children }) {
  return (
    <div className="rounded-lg border border-transparent bg-[#F3EBDD] p-3 text-left">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236] font-medium">
          <Sparkles size={10} /> {label}
          {onWhy && reason && <button onClick={onWhy} className="ml-1 text-[#9A7A45] underline underline-offset-1 hover:text-[#806236]">Why?</button>}
        </span>
        <div className="flex gap-1">
          {onReject && <Btn onClick={onReject} secondary small className="min-h-8 px-2 text-[9px]">Reject</Btn>}
          {onEdit && <Btn onClick={onEdit} secondary small className="min-h-8 px-2 text-[9px]">Edit</Btn>}
          {onAccept && <Btn onClick={onAccept} small className="min-h-8 px-2 text-[9px]">Accept</Btn>}
        </div>
      </div>
      {reason && <p className="text-[10px] text-[#4A5568] mb-3">{reason}</p>}
      {children}
    </div>
  );
}

function FactFlag({ claim, fix, onResolve, onConfirm }) {
  return (
    <div className="rounded-lg border border-[#FFF8E8] bg-[#FFF8E8] p-3 text-left mb-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 text-[#B7791F]" size={14} />
        <div className="flex-1">
          <div className="text-xs text-[#806236] font-medium">{claim}</div>
          <p className="mt-0.5 text-[10px] text-[#806236]">{fix}</p>
          <div className="mt-2 flex gap-2 text-xs">
            <Btn onClick={onResolve} secondary small className="min-h-8 px-2">Resolve</Btn>
            {onConfirm && <Btn onClick={onConfirm} small className="min-h-8 px-2">I confirm</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreMeter({ value, label, color = GOLD }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-1.5 flex-1 rounded-full bg-[#E5E1D8]"><div className="h-full rounded-full bg-[#B8955A]" style={{ width: `${value}%` }} /></div>
      <span className={`text-[#0F1B2D] font-medium`}>{value}</span>
      <span className="text-[#4A5568]">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Role shell                                                        */
/* ------------------------------------------------------------------ */
const jobseekerNav = [
  ['Dashboard', LayoutDashboard, '/jobseeker/dashboard'],
  ['Jobs', Search, '/jobseeker/jobs'],
  ['Saved jobs', Bookmark, '/jobseeker/saved'],
  ['Applications', Briefcase, '/jobseeker/applications'],
  ['Interviews', CalendarDays, '/jobseeker/interviews'],
  ['Resumes', FileText, '/jobseeker/resumes'],
  ['Interview practice', Mic, '/jobseeker/practice'],
  ['Messages', MessageCircle, '/jobseeker/messages'],
];

const user = {
  name: 'Aanya Sen',
  role: 'Job seeker',
  signedIn: true,
};

function JobSeekerShell({ children, active = 'Resumes', className = '' }) {
  return (
    <div className={`min-h-screen bg-[#FAF8F4] text-[#0F1B2D] ${className}`}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col bg-[#0F1B2D] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 font-serif">F</span>
          <b>forma <small className="ml-1 text-white/50">CAREERS</small></b>
        </div>
        <nav className="mt-5 space-y-1 px-3">
          {jobseekerNav.map(([n, I, u]) => {
            const Comp = I;
            return (
              <Link key={n} href={u} className={`relative flex h-11 items-center gap-3 rounded-lg px-3 text-xs ${n === active ? 'bg-[#1C2B42] text-white' : 'text-white/65 hover:bg-white/5'}`}>
                {n === active && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />}
                <Comp size={17} /> {n}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1 px-3 pb-5">
          <Link href="/jobseeker/settings" className="flex h-10 items-center gap-3 px-3 text-xs text-white/60"><Settings size={17} /> Settings</Link>
          <Link href="/help" className="flex h-10 items-center gap-3 px-3 text-xs text-white/60"><HelpCircle size={17} /> Help</Link>
          <button onClick={() => {}} className="flex w-full items-center gap-3 rounded-lg border border-white/10 p-3 text-left">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-ink">AS</span>
            <span><b className="block text-xs">{user.name}</b><small className="text-white/50">{user.role} · switch role</small></span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur sm:px-7 lg:ml-[238px]">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={16} />
          <input placeholder="Search roles or companies" className="h-10 w-72 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs" />
        </div>
        <span className="text-sm font-semibold sm:hidden">Job seeker</span>
        <button className="relative ml-auto grid h-10 w-10 place-items-center"><Bell size={18} /></button>
        <button className="ml-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#0F1B2D] text-xs text-white">AS</span><span className="hidden text-xs sm:block">{user.name}</span><ChevronDown size={14} /></button>
      </header>
      <main id="candidate-main" className="mx-auto max-w-[1400px] px-4 pb-24 pt-7 sm:px-7 lg:ml-[238px] lg:px-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#E5E1D8] bg-white px-2 py-2 lg:hidden">
        {[
          ['Home', '/jobseeker/dashboard', LayoutDashboard],
          ['Jobs', '/jobseeker/jobs', Search],
          ['Applications', '/jobseeker/applications', Briefcase],
          ['Practice', '/jobseeker/practice', Mic],
          ['More', '/jobseeker/profile', UserRound],
        ].map(([x, u, I]) => (
          <Link href={u} key={x} className="flex flex-col items-center gap-1 py-1 text-[9px] text-[#4A5568]">
            <I size={17} /> {x}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Resume card                                                       */
/* ------------------------------------------------------------------ */
function ResumeCard({ resume, onOpen, onTailor, onAts, onExport, onUseToApply, onOverflow }) {
  return (
    <article className="rounded-xl border border-[#E5E1D8] bg-white p-4 animate-enter">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-serif text-xl font-bold text-ink">{resume.template.slice(0, 1)}</span>
          <div>
            <h3 className="text-sm font-semibold">{resume.name}</h3>
            <p className="text-xs text-[#4A5568]">{resume.targetRole} · v{resume.version}</p>
          </div>
          {resume.primary && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[9px] text-[#806236]"><Star size={10} /> Primary</span>}
        </div>
        <button onClick={() => {}} aria-label="More actions" className="grid h-9 w-9 place-items-center text-[#A0A7B4] hover:text-[#0F1B2D]"><MoreHorizontal size={16} /></button>
      </div>
      <p className="text-xs text-[#4A5568] mb-3">Updated {resume.updated} · {resume.applications} application{resume.applications !== 1 ? 's' : ''}</p>
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium ${resume.ats >= 80 ? 'bg-[#E7F3EC] text-[#286749]' : resume.ats >= 60 ? 'bg-[#FFF8E8] text-[#9A7A45]' : 'bg-[#FCE8E6] text-[#B42318]'}`}>ATS {resume.ats}</span>
        <StatusChip status={resume.status} className="ml-auto" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={onOpen} secondary className="w-full min-h-9 text-[9px]">Open</Btn>
        <Btn onClick={onTailor} className="w-full min-h-9 text-[9px]">Tailor</Btn>
        <Btn onClick={onExport} secondary small className="w-full min-h-8 text-[9px]">Export</Btn>
        <Btn onClick={onUseToApply} small className="w-full min-h-8 text-[9px]">Use to apply</Btn>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 1: My Resumes  /jobseeker/resumes                            */
/* ------------------------------------------------------------------ */
function MyResumesPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [view, setView] = useState('cards');

  const stats = useMemo(() => ({
    resumes: resumes.length,
    primary: resumes.find(r => r.primary),
    needsReview: resumes.filter(r => r.status === 'Needs review').length,
    used: resumes.reduce((a, r) => a + r.applications, 0),
  }), []);

  const filtered = useMemo(() => resumes.filter(r => {
    if (filterStatus !== 'All' && r.status !== filterStatus) return false;
    if (search.trim() && !(r.name + ' ' + r.targetRole).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, filterStatus]);

  return (
    <JobSeekerShell active="Resumes">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">My resumes</h1>
          <p className="text-xs text-[#4A5568]">One resume per kind of role works best.</p>
        </div>
        <Btn onClick={() => {}} className="min-h-10 px-4">+ New resume</Btn>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-4">
        {[
          ['Resumes', stats.resumes],
          ['Primary resume', stats.primary ? stats.primary.name : '—'],
          ['Needs review', stats.needsReview],
          ['Used in applications', stats.used],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <p className="text-[10px] text-[#4A5568]">{label}</p>
            <b className="serif mt-1 block text-2xl font-semibold">{value}</b>
            {label === 'Primary resume' && stats.primary && <p className="mt-1 text-xs text-[#4A5568]">ATS {stats.primary.ats}</p>}
            {label === 'Needs review' && stats.needsReview > 0 && <p className="mt-1 text-xs text-[#9A7A45] font-medium">Review changes</p>}
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={16} />
          <input placeholder="Search by name or target role" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 pr-4 rounded-lg border border-[#E5E1D8] bg-white text-sm focus:border-[#B8955A] focus:outline-none focus:ring-1 focus:ring-[#B8955A]" />
        </div>
        <div className="flex gap-2 text-xs">
          <span className="text-[#4A5568]">Filter: status</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg border border-[#E5E1D8] bg-white px-2 py-1 text-xs focus:border-[#B8955A] focus:outline-none">
            <option value="All">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Ready">Ready</option>
            <option value="Primary">Primary</option>
            <option value="Needs review">Needs review</option>
            <option value="Archived">Archived</option>
          </select>
          <span className="text-[#4A5568]">Sort: Last updated</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setView('cards')} className={`rounded-lg border px-2 py-1.5 text-[10px] ${view === 'cards' ? 'border-[#B8955A] bg-[#F3EBDD]' : 'border-[#E5E1D8]'}`}>
          <LayoutGrid size={13} />
        </button>
        <button onClick={() => setView('list')} className={`rounded-lg border px-2 py-1.5 text-[10px] ${view === 'list' ? 'border-[#B8955A] bg-[#F3EBDD]' : 'border-[#E5E1D8]'}`}>
          <List size={13} />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="lg:col-span-3 rounded-xl border border-[#E5E1D8] bg-white p-8 text-center">
            <p className="text-xs text-[#4A5568] mb-3">No resumes match.</p>
            <Btn onClick={() => setFilterStatus('All')} secondary className="min-h-9">Clear filters</Btn>
            <p className="mt-4 text-[10px] text-[#4A5568]">Let's build your first resume. It takes about 10 minutes.</p>
            <div className="mt-4 flex flex-col gap-2">
              <Btn onClick={() => {}} className="w-full">Answer a few questions</Btn>
              <Btn onClick={() => {}} secondary className="w-full">Import a resume</Btn>
              <Btn onClick={() => {}} secondary className="w-full">Use my profile</Btn>
            </div>
          </div>
        ) : (
          view === 'cards' ? (
            filtered.map(r => <ResumeCard key={r.id} resume={r} onOpen={() => {}} onTailor={() => {}} onAts={() => {}} onExport={() => {}} onUseToApply={() => {}} onOverflow={() => {}} />)
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#E5E1D8]">
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Resume</th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Target role</th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">ATS</th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Status</th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Updated</th>
                  <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-[#E5E1D8]">
                    <td className="py-3"><b className="text-xs">{r.name}</b></td>
                    <td className="py-3 text-xs text-[#4A5568]">{r.targetRole}</td>
                    <td className="py-3 text-xs">{r.ats}</td>
                    <td className="py-3"><StatusChip status={r.status} className="mb-0.5" /></td>
                    <td className="py-3 text-xs text-[#4A5568]">{r.updated}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Btn onClick={() => {}} secondary small className="min-w-[48px]">Open</Btn>
                        <Btn onClick={() => {}} small className="min-w-[48px]">Tailor</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      <Card title="Templates" padded>
        <p className="text-[10px] text-[#4A5568] mb-3">4–6 template thumbnails with Browse templates; selecting one starts a new resume with that layout.</p>
        <div className="flex gap-3">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 cursor-pointer hover:bg-[#F4F1EA]">
              <span className="grid h-8 w-8 place-items-center rounded bg-[#F3EBDD] font-serif text-xs font-bold text-ink">{t.preview}</span>
              <div>
                <b className="block text-xs">{t.name}</b>
                <span className="text-[9px] text-[#4A5568]">{t.description}</span>
              </div>
              {t.premium && <span className="ml-auto rounded-full bg-[#F3EBDD] px-1.5 py-0.5 text-[8px] text-[#806236]">Premium</span>}
            </div>
          ))}
          <Btn onClick={() => {}} secondary className="ml-auto min-h-9 px-3 text-[10px]">Browse templates</Btn>
        </div>
      </Card>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 2: Resume Builder  /jobseeker/resumes/new                    */
/* ------------------------------------------------------------------ */
function ResumeBuilderPage() {
  const [path, setPath] = useState(null);
  const [step, setStep] = useState(1);
  const [targetRole, setTargetRole] = useState('');

  const totalSteps = 8;

  return (
    <JobSeekerShell active="Resumes" className="pb-14">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => {}} className="text-xs text-[#9A7A45] underline">Save and exit</button>
          <h1 className="serif mt-1 text-[28px] font-semibold">New resume</h1>
          <p className="text-xs text-[#4A5568]">Build a clean, job-specific resume in minutes.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#4A5568]">Step {step} of {totalSteps}</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        {!path ? (
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h2 className="text-sm font-semibold mb-3">How would you like to start?</h2>
              <div className="space-y-3">
                <button onClick={() => setPath('guide')} className="w-full flex items-center justify-between rounded-lg border border-[#E5E1D8] bg-white p-4 text-left hover:bg-[#F4F1EA]">
                  <div>
                    <b className="block text-sm">Answer a few questions</b>
                    <p className="mt-0.5 text-xs text-[#4A5568]">Guided conversation, about 10 minutes</p>
                  </div>
                  <ArrowRight size={14} className="text-[#4A5568]" />
                </button>
                <button onClick={() => setPath('import')} className="w-full flex items-center justify-between rounded-lg border border-[#E5E1D8] bg-white p-4 text-left hover:bg-[#F4F1EA]">
                  <div>
                    <b className="block text-sm">Import an existing resume</b>
                    <p className="mt-0.5 text-xs text-[#4A5568]">Upload PDF or DOCX, or paste text</p>
                  </div>
                  <Upload size={14} className="text-[#4A5568]" />
                </button>
                <button onClick={() => setPath('profile')} className="w-full flex items-center justify-between rounded-lg border border-[#E5E1D8] bg-white p-4 text-left hover:bg-[#F4F1EA]">
                  <div>
                    <b className="block text-sm">Use my profile</b>
                    <p className="mt-0.5 text-xs text-[#4A5568]">Build from facts already in your profile</p>
                  </div>
                  <UserRound size={14} className="text-[#4A5568]" />
                </button>
              </div>
              <p className="mt-4 text-[10px] text-[#4A5568]">Not sure? Start with your profile. You can add more later.</p>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8">
            <div className="rounded-xl border border-[#E5E1D8] bg-white p-5">
              <div className="mb-4">
                <label className="block text-[10px] text-[#4A5568] mb-1">What kind of role is this resume for?</label>
                <input placeholder="Title or category (optional but recommended)" value={targetRole} onChange={e => setTargetRole(e.target.value)} className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none focus:ring-1 focus:ring-[#B8955A]" />
              </div>
              {path === 'guide' && (
                <>
                  <h2 className="text-sm font-semibold mb-3">Basics</h2>
                  <p className="text-xs text-[#4A5568] mb-3">Name, email, phone, city, links. No photo, age, gender, marital status or similar prompts by default.</p>
                  <div className="space-y-3">
                    <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" placeholder="Name" />
                    <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" placeholder="Email" />
                    <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" placeholder="Phone" />
                    <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" placeholder="City" />
                    <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" placeholder="LinkedIn / portfolio / GitHub" />
                  </div>
                  <AISuggestion reason="Drafts a summary using only the facts you provide above." onWhy={() => {}} onAccept={() => {}} onEdit={() => {}} onReject={() => {}}>
                    <p className="text-[10px] text-[#4A5568]">Let AI draft a professional summary from what you wrote.</p>
                  </AISuggestion>
                </>
              )}
              {path === 'import' && (
                <>
                  <h2 className="text-sm font-semibold mb-3">Import an existing resume</h2>
                  <p className="text-xs text-[#4A5568] mb-3">PDF or DOCX up to 10 MB (virus scanned), or paste text.</p>
                  <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-center">
                    <Upload size={24} className="mx-auto mb-2 text-[#A0A7B4]" />
                    <p className="text-xs text-[#4A5568]">Drag a file here or click to browse</p>
                    <button className="mt-2 text-xs text-[#9A7A45] underline">Paste text instead</button>
                  </div>
                  <p className="mt-3 text-[10px] text-[#4A5568]">A privacy note explains what happens to your file. Uploaded files are virus scanned and stored encrypted.</p>
                </>
              )}
              {path === 'profile' && (
                <>
                  <h2 className="text-sm font-semibold mb-3">Use my profile</h2>
                  <p className="text-xs text-[#4A5568] mb-3">Choose which profile sections to bring in. All selected by default.</p>
                  <div className="space-y-2">
                    {['Summary', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications', 'Languages'].map(s => (
                      <div key={s} className="flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" /><span className="text-xs">{s}</span></div>
                    ))}
                  </div>
                  <Btn onClick={() => {}} className="w-full mt-2">Create resume</Btn>
                  <p className="mt-2 text-[10px] text-[#4A5568]">If your profile is thin, missing parts are shown with Add to profile links; you can proceed anyway.</p>
                </>
              )}
            </div>
          </div>
        )}

        <aside className="lg:col-span-4 space-y-4" style={{ position: 'sticky', top: '80px' }}>
          <Card title="Live preview" padded>
            <div className="rounded-lg border border-[#E5E1D8] bg-white h-64 p-3 text-center text-[10px] text-[#4A5568]">
              <File size={24} className="mx-auto mb-2 text-[#A0A7B4]" />
              <p>Resume preview taking shape</p>
              <p className="mt-1 text-[9px] text-[#A0A7B4]">Sections: 3 of 8 complete</p>
              <button className="mt-2 text-xs text-[#9A7A45] underline">View as plain text (ATS view)</button>
            </div>
          </Card>
          <Card title="Template &amp; finish" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">Pick a template, accent color and page length.</p>
            <div className="space-y-2">
              <select className="w-full field text-xs"><option>Classic</option><option>Modern</option><option>Compact</option></select>
              <select className="w-full field text-xs mt-1"><option>Ink (default)</option><option>Stone</option><option>Muted gold</option></select>
              <select className="w-full field text-xs mt-1"><option>One page</option><option>Two pages</option><option>No limit</option></select>
            </div>
            <Btn onClick={() => {}} className="w-full mt-3">Open in editor</Btn>
          </Card>
        </aside>
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button onClick={() => setStep(s => Math.max(1, s - 1))} className="text-xs text-[#4A5568] underline">Back</button>
        {step < totalSteps && <Btn onClick={() => setStep(s => s + 1)}>Continue</Btn>}
        {step === totalSteps && <Btn onClick={() => {}}>Finish</Btn>}
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 3: Resume Editor  /jobseeker/resumes/:resumeId               */
/* ------------------------------------------------------------------ */
function ResumeEditorPage({ resumeId }) {
  const resume = resumes.find(r => r.id === resumeId) || resumes[0];
  const [section, setSection] = useState('Summary');
  const [openFlags, setOpenFlags] = useState(2);

  const sections = [
    'Contact', 'Summary', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications', 'Languages', 'Awards', 'Volunteering', 'Custom',
  ];

  return (
    <JobSeekerShell active="Resumes" className="pb-10">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <input defaultValue={resume.name} className="serif text-[20px] font-semibold border-none bg-transparent focus:ring-0 w-auto" />
            <StatusChip status={resume.status} />
          </div>
          <p className="text-xs text-[#4A5568]">{resume.targetRole} · Saved · just now</p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => {}} secondary className="min-h-10 px-3">Tailor to a job</Btn>
          <Btn onClick={() => {}} secondary className="min-h-10 px-3">ATS check</Btn>
          <Btn onClick={() => {}} className="min-h-10 px-4">Export</Btn>
          <Btn onClick={() => {}} small className="min-h-10 px-3">Use to apply</Btn>
          <button className="rounded-lg border px-3 text-[#4A5568] hover:bg-[#F4F1EA]"><MoreHorizontal size={16} /></button>
        </div>
      </header>

      {openFlags > 0 && (
        <div className="mb-4 rounded-lg border border-[#FFF8E8] bg-[#FFF8E8] p-3 text-left">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 text-[#B7791F]" size={14} />
            <div className="flex-1">
              <b className="block text-xs text-[#806236]">{openFlags} claims need your confirmation before you can export.</b>
              <button className="mt-1 text-xs text-[#9A7A45] underline font-medium">Review flags</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-2 space-y-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[#4A5568] mb-2">Sections</h2>
          <div className="space-y-1.5">
            {sections.map(s => (
              <div key={s} onClick={() => setSection(s)} className={`cursor-pointer rounded-lg px-2 py-2 text-left text-xs transition-colors ${section === s ? 'bg-[#F3EBDD] text-[#806236] border border-transparent' : 'bg-transparent text-[#4A5568] hover:bg-[#F4F1EA] border border-transparent hover:border-[#E5E1D8]'}`}>
                <div className="flex justify-between items-center">
                  <span>{s}</span>
                  <span className="text-[9px]">{s === 'Summary' ? '●' : s === 'Experience' ? '●○' : '○'}</span>
                </div>
                <div className="flex gap-1 mt-0.5">
                  <button onClick={(e) => { e.stopPropagation(); }} className="rounded text-[9px] text-[#4A5568] hover:text-[#0F1B2D] px-1">Up</button>
                  <button onClick={(e) => { e.stopPropagation(); }} className="rounded text-[9px] text-[#4A5568] hover:text-[#0F1B2D] px-1">Down</button>
                </div>
              </div>
            ))}
            <button onClick={() => {}} className="w-full rounded-lg border border-[#E5E1D8] bg-white px-2 py-2 text-[10px] text-[#9A7A45] text-left hover:bg-[#F4F1EA]">+ Add section</button>
          </div>
        </aside>

        <div className="lg:col-span-6 space-y-6">
          {section === 'Summary' && (
            <Card title="Summary" padded>
              <textarea defaultValue={resume.summary} className="w-full h-32 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 pt-2 text-sm focus:border-[#B8955A] focus:outline-none" />
              <div className="mt-2 flex justify-between text-[10px] text-[#4A5568]"><span>120 / 500 characters</span><span>AI draft</span></div>
              <AISuggestion reason="Proposes a summary using only the resume's facts." onAccept={() => {}} onEdit={() => {}} onReject={() => {}}>
                <p className="text-[10px] text-[#4A5568]">Concise · Confident · Friendly tones reshape the same facts.</p>
              </AISuggestion>
            </Card>
          )}
          {section === 'Experience' && (
            <>
              {profile.experience.map(exp => (
                <div key={exp.id} className="rounded-lg border border-[#E5E1D8] bg-white p-4 mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <b className="block text-sm">{exp.title}</b>
                      <span className="text-xs text-[#4A5568]">{exp.company} · {exp.dates}</span>
                    </div>
                    <div className="flex gap-1">
                      <Btn onClick={() => {}} secondary small className="min-h-8 px-2">Improve with AI</Btn>
                      <Btn onClick={() => {}} secondary small className="min-h-8 px-2">Add result</Btn>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {exp.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-1 h-1 w-1 rounded-full bg-[#4A5568]" />
                        <span className="text-xs text-[#4A5568]">{b}</span>
                        <button className="ml-auto text-[9px] text-[#A0A7B4] underline">Delete</button>
                      </div>
                    ))}
                    <button onClick={() => {}} className="mt-2 w-full text-left text-xs text-[#9A7A45] underline">+ Add bullet</button>
                  </ul>
                  <p className="mt-2 text-[10px] text-[#9A7A45] underline">Gap hint: Optional — add a brief explanation (study, caregiving, freelance).</p>
                </div>
              ))}
            </>
          )}
          {section === 'Skills' && (
            <Card title="Skills" padded>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map(s => (
                    <span key={s.id} className="rounded-full border border-[#E5E1D8] bg-white px-2.5 py-1 text-[10px] text-[#4A5568]">{s.name}</span>
                  ))}
                  <button className="rounded-full border border-[#E5E1D8] bg-white px-2.5 py-1 text-[10px] text-[#9A7A45] underline">+ Add skill</button>
                </div>
                <AISuggestion reason="Skills commonly linked to your roles. Add only if true for you." onAccept={() => {}} onEdit={() => {}} onReject={() => {}}>
                  <p className="text-[10px] text-[#4A5568]">Suggested skills panel. Each shows the evidence it was inferred from.</p>
                </AISuggestion>
              </div>
            </Card>
          )}
          {section === 'Contact' && (
            <Card title="Contact" padded>
              <div className="space-y-3">
                <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" defaultValue={profile.name} />
                <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" defaultValue={profile.email} />
                <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" defaultValue={profile.phone} />
                <input className="w-full h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" defaultValue={`${profile.city}, ${profile.region}`} />
                <p className="mt-2 text-[10px] text-[#4A5568]">Photos, age, marital status and similar details aren't needed. Leaving them out is usually best.</p>
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4" style={{ position: 'sticky', top: '80px' }}>
          <Card title="Live preview" padded>
            <div className="rounded-lg border border-[#E5E1D8] bg-white h-80 p-4 overflow-y-auto text-xs text-[#4A5568]">
              <b className="block text-sm">{resume.name}</b>
              <p className="mt-1 text-[9px]">{profile.email} · {profile.city}</p>
              <p className="mt-2 text-[9px] font-semibold">Summary</p>
              <p className="mt-1 text-[9px]">{resume.summary}</p>
              <p className="mt-2 text-[9px] font-semibold">Experience</p>
              {profile.experience.map(e => (
                <div key={e.id} className="mt-2"><b className="block text-[9px]">{e.title}, {e.company}</b><span className="text-[9px]">{e.dates}</span><ul className="mt-0.5 pl-2 space-y-0.5">{e.bullets.map(b => <li key={b} className="text-[8px] text-[#4A5568] list-disc list-inside">{b}</li>)}</ul></div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Btn onClick={() => {}} secondary small className="flex-1 min-h-8">Plain text (ATS view)</Btn>
              <Btn onClick={() => {}} small className="flex-1 min-h-8">Zoom</Btn>
            </div>
            <ScoreMeter value={resume.ats} label="ATS score" />
          </Card>
          <Card title="AI panel" padded>
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Sparkles size={12} className="text-[#9A7A45]" /><b className="text-xs">Suggestions</b></div>
              <button onClick={() => {}} className="w-full text-left rounded-lg border border-[#E5E1D8] bg-white p-2 text-xs text-left hover:bg-[#F4F1EA]">Improve bullet → achievement style</button>
              <button onClick={() => {}} className="w-full text-left rounded-lg border border-[#E5E1D8] bg-white p-2 text-xs text-left hover:bg-[#F4F1EA]">Add a result</button>
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center gap-2"><AlertCircle size={12} className="text-[#B7791F]" /><b className="text-xs">Flags</b></div>
                <button onClick={() => {}} className="w-full text-left rounded-lg border border-[#E5E1D8] bg-white p-2 text-xs text-left hover:bg-[#F4F1EA]">Needs a fact: measurable result</button>
                <div className="border-t pt-1 mt-1">
                  <div className="flex items-center gap-2"><Barcode size={12} className="text-[#4A5568]" /><b className="text-xs">Consistency</b></div>
                  <button onClick={() => {}} className="w-full text-left rounded-lg border border-[#E5E1D8] bg-white p-2 text-xs text-left hover:bg-[#F4F1EA]">Check date formats</button>
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 4: Job Tailoring  /jobseeker/resumes/:resumeId/tailor        */
/* ------------------------------------------------------------------ */
function JobTailoringPage({ resumeId }) {
  const resume = resumes.find(r => r.id === resumeId) || resumes[0];
  const [step, setStep] = useState(1);

  return (
    <JobSeekerShell active="Resumes" className="pb-10">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">Tailor resume</h1>
          <p className="text-xs text-[#4A5568]">Adjust your resume to fit a specific job.</p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex items-center gap-1">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium ${step > n ? 'bg-[#0F1B2D] text-white border-transparent' : step === n ? 'border-[#B8955A] text-[#B8955A] bg-[#FFF8E8]' : 'border-[#E5E1D8] text-[#4A5568]'}`}>{n}</span>
              {n < 3 && <ArrowRight className="h-3 w-3 text-[#A0A7B4]" />}
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {step === 1 && (
            <Card title="1. Choose a job" padded>
              <div className="flex gap-2 mb-4 border-b border-[#E5E1D8] pb-2">
                {['Pick from Jobs module', 'Paste a job description', 'Paste a job link'].map((t, i) => (
                  <button key={i} onClick={() => {}} className={`px-3 py-1 text-xs border-b-2 ${i === 0 ? 'border-[#B8955A] text-[#0F1B2D] font-medium' : 'border-transparent text-[#4A5568] hover:text-[#0F1B2D]'}`}>{t}</button>
                ))}
              </div>
              <div className="space-y-3">
                {jobs.map(j => (
                  <div key={j.id} className="rounded-lg border border-[#E5E1D8] p-3 cursor-pointer hover:bg-[#F4F1EA]">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold">{j.title}</h3>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified</span>
                    </div>
                    <p className="text-xs text-[#4A5568]">{j.company} · {j.loc} · {j.salary}</p>
                    <div className="mt-2 flex gap-1 text-[10px]">{j.mustHave.slice(0, 3).map(s => <span key={s.skill} className="rounded-full bg-[#F3F4F6] px-1.5 py-0.5">{s.skill}</span>)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-[#4A5568]">Pasted text stays private to you. Extracted requirements are editable so you can correct them.</p>
            </Card>
          )}
          {step === 2 && (
            <Card title="2. Review the match" padded>
              <AISuggestion reason="Your resume covers 6 of 9 key requirements." onWhy={() => {}} onAccept={() => {}} onEdit={() => {}} onReject={() => {}}>
                <p className="text-[10px] text-[#4A5568] mb-2">Covered: Product design — Experience section, bullet 1</p>
                <p className="text-[10px] text-[#4A5568] mb-2">Related but not stated: You managed a team of 4; this job asks for 'team leadership'.</p>
                <p className="text-[10px] text-[#4A5568] mb-2">Not on your resume: SQL — I have this · Not for me · Ignore</p>
              </AISuggestion>
              <div className="mt-4 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-[10px] text-[#4A5568]">
                <b className="block mb-1">Keyword view</b>
                <p>Job keywords vs your resume, with context. No keyword stuffing — repeats are limited and hidden text is flagged.</p>
              </div>
            </Card>
          )}
          {step === 3 && (
            <Card title="3. Review and save changes" padded>
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <ArrowRight size={14} className="mt-0.5 text-[#B8955A]" />
                  <div className="flex-1">
                    <b className="block text-xs">Reordering</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">Experience bullets ordered by relevance.</p>
                  </div>
                  <Btn onClick={() => {}} secondary className="min-h-8 px-2">Accept</Btn>
                  <Btn onClick={() => {}} secondary className="min-h-8 px-2">Keep original</Btn>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles size={12} className="mt-0.5 text-[#9A7A45]" />
                  <div className="flex-1">
                    <b className="block text-xs">Rewording</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">Bullets reworded to mirror the job's language.</p>
                  </div>
                </div>
                <div className="border-t pt-3 mt-3">
                  <label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" defaultChecked className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" /><span className="text-xs">Save as new tailored version (keeps original unchanged)</span></label>
                </div>
                <div className="mt-2"><input className="w-full h-9 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" defaultValue="Product Designer · Acme" /></div>
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4" style={{ position: 'sticky', top: '80px' }}>
          <Card title="Match summary" padded>
            <p className="text-xs text-[#4A5568] mb-2">Your resume covers 6 of 9 key requirements.</p>
            <ScoreMeter value={67} label="Match coverage" />
          </Card>
          <Card title="Rules" padded>
            <p className="text-[10px] text-[#4A5568]">Tailoring can't misrepresent. Only add what's true — employers may check in interviews.</p>
          </Card>
        </aside>
      </div>

      <div className="mt-8 flex justify-end gap-2">
        {step > 1 && <button onClick={() => setStep(s => Math.max(1, s - 1))} className="rounded-lg border px-4 py-2 text-xs text-[#4A5568]">Back</button>}
        {step < 3 && <Btn onClick={() => setStep(s => s + 1)}>Continue</Btn>}
        {step === 3 && (
          <>
            <Btn onClick={() => {}} secondary className="min-h-10 px-4">Save and continue</Btn>
            <Btn onClick={() => {}} className="min-h-10 px-4">Save tailored version</Btn>
          </>
        )}
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 5: ATS Check  /jobseeker/resumes/:resumeId/ats               */
/* ------------------------------------------------------------------ */
function AtsCheckPage({ resumeId }) {
  const resume = resumes.find(r => r.id === resumeId) || resumes[0];
  const [tab, setTab] = useState('Score');

  return (
    <JobSeekerShell active="Resumes" className="pb-10">
      <nav className="mb-4 flex items-center gap-2 text-xs">
        <Link href={`/jobseeker/resumes/${resumeId}`} className="text-[#4A5568] hover:text-[#0F1B2D]">Resume editor</Link>
        <span className="text-[#A0A7B4]">/</span>
        <span className="text-[#0F1B2D] font-medium">ATS check</span>
      </nav>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">ATS check</h1>
          <p className="text-xs text-[#4A5568]">Readability score for applicant-tracking systems.</p>
        </div>
        <Btn onClick={() => {}} className="min-h-10 px-3">Re-run check</Btn>
      </div>

      <div className="mb-4 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-[#4A5568] cursor-pointer">Check against a job</label>
          <select className="h-9 rounded-lg border border-[#E5E1D8] bg-white pl-2 pr-2 text-xs focus:border-[#B8955A] focus:outline-none"><option>General check</option><option>Senior Product Designer · Northstar Labs</option></select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card title="ATS readability score" padded>
            <div className="flex items-center gap-4 mb-4">
              <div className="grid h-24 w-24 place-items-center rounded-full border-[7px] border-[#E5E1D8] border-r-[#B8955A] text-center"><span><b className="serif block text-3xl">{resume.ats}</b><small className="text-[9px]">/ 100</small></span></div>
              <div>
                <b className="block text-sm text-[#0F1B2D]">Good</b>
                <p className="mt-1 text-[10px] text-[#4A5568]">A guide to readability, not a measure of your ability.</p>
                <p className="mt-1 text-[10px] text-[#2E7D5B]">▲ 8 since your last check</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Format and structure', 85],
                ['Section headings', 90],
                ['Contact details', 100],
                ['Dates and consistency', 75],
                ['Readability of text', 80],
                ['Length', 70],
              ].map(([label, v]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-[150px] text-[10px] text-[#4A5568]">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[#E5E1D8]"><div className="h-full rounded-full bg-[#B8955A]" style={{ width: `${v}%` }} /></div>
                  <span className="w-[32px] text-[10px] text-[#4A5568] text-right">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Issues" padded>
            <div className="flex gap-2 text-[10px] text-[#4A5568] mb-3">
              <span className="rounded-full bg-[#FCE8E6] px-2 py-0.5 text-[#B42318]">Fix first</span>
              <span className="rounded-full bg-[#FFF8E8] px-2 py-0.5 text-[#9A7A45]">Worth fixing</span>
              <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[#4A5568]">Optional</span>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                <div className="flex justify-between mb-1"><b className="text-xs">Contact details in header</b><span className="text-[9px] text-[#B42318]">Fix first</span></div>
                <p className="mt-0.5 text-[10px] text-[#4A5568]">Your contact details are inside a header, which some systems skip.</p>
                <p className="mt-1 text-[10px] text-[#4A5568]">Where: Contact section</p>
                <div className="mt-2 flex gap-2">
                  <Btn onClick={() => {}} secondary small className="min-h-8 px-2">Fix for me</Btn>
                  <Btn onClick={() => {}} secondary small className="min-h-8 px-2">Edit manually</Btn>
                  <Btn onClick={() => {}} secondary small className="min-h-8 px-2">Ignore</Btn>
                </div>
              </div>
              <div className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                <div className="flex justify-between mb-1"><b className="text-xs">Heading not standard</b><span className="text-[9px] text-[#9A7A45]">Worth fixing</span></div>
                <p className="mt-0.5 text-[10px] text-[#4A5568]">Use standard headings such as Experience instead of 'My journey'.</p>
                <div className="mt-2 flex gap-2">
                  <Btn onClick={() => {}} secondary small className="min-h-8 px-2">Fix for me</Btn>
                  <Btn onClick={() => {}} secondary small className="min-h-8 px-2">Edit manually</Btn>
                </div>
              </div>
            </div>
          </Card>

          {tab === 'Parse' && (
            <Card title="How an ATS reads your resume" padded>
              <p className="text-[10px] text-[#4A5568] mb-2">Extracted text in reading order, with parsed fields detected. Different systems read resumes differently — this is a guide.</p>
              <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 h-48 overflow-y-auto text-[10px] text-[#4A5568]">
                <div><b>Name</b> Aanya Sen</div>
                <div><b>Contact</b> aanya@example.in · +91 98765 43210</div>
                <div><b>Job</b> Senior Product Designer · Northstar Labs · Jan 2023 – Present</div>
                <div><b>Education</b> B.Des · National Institute of Design · 2017 – 2021</div>
                <div className="mt-1 text-[#B42318]">Job title not detected for 'Acme'</div>
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4" style={{ position: 'sticky', top: '80px' }}>
          <Card title="Next steps" padded>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Wrench className="mt-0.5 text-[#B8955A]" size={14} />
                <div className="flex-1"><b className="block text-xs">Fix contact details placement</b><p className="mt-0.5 text-[10px] text-[#4A5568]">Move contact info out of the header.</p></div>
                <Btn onClick={() => {}} className="min-h-8 px-2 text-[9px]">Fix</Btn>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 text-[#9A7A45]" size={14} />
                <div className="flex-1"><b className="block text-xs">Add missing skills section</b><p className="mt-0.5 text-[10px] text-[#4A5568]">SQL is mentioned by the job.</p></div>
                <Btn onClick={() => {}} className="min-h-8 px-2 text-[9px]">Add</Btn>
              </div>
            </div>
          </Card>
          <Card title="Tips" padded>
            <p className="text-[10px] text-[#4A5568]">ATS systems don't make hiring decisions. People usually do. A readable resume helps people find your experience.</p>
          </Card>
          <Card title="Compare versions" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">ATS scores across your resumes</p>
            <div className="space-y-2">
              {resumes.map(r => (
                <div key={r.id} className="flex items-center justify-between text-[10px]">
                  <span>{r.name}</span>
                  <span className="text-[#0F1B2D] font-medium">{r.ats}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Export check" padded>
            <Btn onClick={() => {}} secondary className="w-full min-h-9">Test exported PDF &amp; Word</Btn>
            <p className="mt-2 text-[10px] text-[#4A5568]">Confirm text is selectable and fonts are embedded.</p>
          </Card>
          <p className="text-[10px] text-[#4A5568]">ATS score is deterministic and explained. It isn't used to rank candidates and isn't shared with employers unless you choose.</p>
        </aside>
      </div>

      <div className="mt-6 flex gap-2 border-t border-[#E5E1D8] pt-4">
        <button onClick={() => setTab('Score')} className={`text-xs px-3 py-1 border-b-2 ${tab === 'Score' ? 'border-[#B8955A] text-[#0F1B2D]' : 'border-transparent text-[#4A5568]'}`}>Score</button>
        <button onClick={() => setTab('Parse')} className={`text-xs px-3 py-1 border-b-2 ${tab === 'Parse' ? 'border-[#B8955A] text-[#0F1B2D]' : 'border-transparent text-[#4A5568]'}`}>How an ATS reads it</button>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Router export                                                     */
/* ------------------------------------------------------------------ */
const PAGES = {
  resumes: MyResumesPage,
  new: ResumeBuilderPage,
  editor: ResumeEditorPage,
  tailor: JobTailoringPage,
  ats: AtsCheckPage,
};

export default function JobSeekerResumeMaker({ page = 'resumes', resumeId }) {
  const Page = PAGES[page];
  if (!page || !Page) return <MyResumesPage />;
  const props = {};
  if (resumeId) props.resumeId = resumeId;
  return <Page {...props} />;
}

export { MyResumesPage, ResumeBuilderPage, ResumeEditorPage, JobTailoringPage, AtsCheckPage };
