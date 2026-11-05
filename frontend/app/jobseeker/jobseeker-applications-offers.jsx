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
  Download, Printer, Wrench, Menu, LogOut
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
const applications = [
  {
    id: 'app-001', jobId: 'senior-product-designer',
    title: 'Senior Product Designer', company: 'Northstar Labs', logo: 'N',
    loc: 'Remote · India', mode: 'Remote', type: 'Full-time', salary: '₹18–24 LPA',
    stage: 'Interview', appliedDate: '24 Oct', lastUpdate: 'Shortlisted · 2 days ago',
    nextStep: 'Technical interview · Thu 6 Nov, 11:00 AM IST',
    source: 'Job search', resumeVersion: 'Product Designer v2', verified: true,
    waiting: false, messages: 2,
  },
  {
    id: 'app-002', jobId: 'product-designer',
    title: 'Product Designer', company: 'Morrow Health', logo: 'M',
    loc: 'Bengaluru · Hybrid', mode: 'Hybrid', type: 'Full-time', salary: '₹16–22 LPA',
    stage: 'Shortlisted', appliedDate: '20 Oct', lastUpdate: 'Shortlisted · 3 days ago',
    nextStep: 'Awaiting interview details',
    source: 'Startups hiring', resumeVersion: 'Product Designer v1', verified: true,
    waiting: false, messages: 1,
  },
  {
    id: 'app-003', jobId: 'ux-researcher',
    title: 'UX Researcher', company: 'Fieldnote', logo: 'F',
    loc: 'Kolkata · Hybrid', mode: 'Hybrid', type: 'Full-time', salary: '₹14–18 LPA',
    stage: 'Applied', appliedDate: '15 Oct', lastUpdate: 'Application sent · 5 days ago',
    nextStep: 'No update yet',
    source: 'Job search', resumeVersion: 'UX Researcher v1', verified: true,
    waiting: false, messages: 0,
  },
  {
    id: 'app-004', jobId: 'frontend-engineer',
    title: 'Frontend Engineer (React)', company: 'Lattice Works', logo: 'L',
    loc: 'Remote', mode: 'Remote', type: 'Contract', salary: '₹14–18 LPA',
    stage: 'Applied', appliedDate: '10 Oct', lastUpdate: 'Application sent · 18 days ago',
    nextStep: 'No update yet',
    source: 'Recommendation', resumeVersion: 'Product Designer v2', verified: true,
    waiting: true, messages: 0,
  },
  {
    id: 'app-005', jobId: 'design-lead',
    title: 'Design Lead', company: 'Vertex Studio', logo: 'V',
    loc: 'Bengaluru · On-site', mode: 'On-site', type: 'Full-time', salary: 'Not shown',
    stage: 'Not selected', appliedDate: '28 Sep', lastUpdate: 'Not selected · 1 week ago',
    nextStep: 'Similar roles available',
    source: 'Job search', resumeVersion: 'Product Designer v1', verified: true,
    waiting: false, messages: 0,
  },
];

const interviews = [
  {
    id: 'int-001', applicationId: 'app-001',
    title: 'Senior Product Designer', company: 'Northstar Labs', logo: 'N',
    type: 'Technical', mode: 'Video', date: 'Thu, 6 Nov', time: '11:00 AM IST',
    duration: '45 min', status: 'Scheduled',
    interviewers: [{ name: 'Ira Mehta', role: 'Head of Product' }, { name: 'Rohan Desai', role: 'Lead Engineer' }],
    link: 'https://meet.example.in/northstar-tech',
    agenda: 'Live coding + portfolio review',
  },
  {
    id: 'int-002', applicationId: 'app-002',
    title: 'Product Designer', company: 'Morrow Health', logo: 'M',
    type: 'Portfolio review', mode: 'Video', date: '', time: '', duration: '30 min',
    status: 'Proposed times',
    interviewers: [{ name: 'Dr. Anika Rao', role: 'Chief Medical Officer' }],
    link: '', agenda: 'Walk through 3 case studies',
    proposedTimes: ['Tue 4 Nov 2:00 PM IST', 'Wed 5 Nov 11:00 AM IST', 'Thu 6 Nov 4:00 PM IST'],
  },
  {
    id: 'int-003', applicationId: 'app-003',
    title: 'UX Researcher', company: 'Fieldnote', logo: 'F',
    type: 'HR', mode: 'Phone', date: 'Mon, 28 Oct', time: '3:00 PM IST', duration: '30 min',
    status: 'Completed',
    interviewers: [{ name: 'Sara K.', role: 'Recruiter' }],
    link: '', agenda: 'Behavioral screen',
  },
];

const offers = [
  {
    id: 'ofr-001', jobId: 'senior-product-designer',
    title: 'Senior Product Designer', company: 'Northstar Labs', logo: 'N',
    version: 'v1', status: 'Received', basePay: '₹20 LPA', bonus: '₹2 LPA joining bonus',
    equity: 'Not provided', startDate: '1 Dec', expiry: '28 Nov', sentDate: '20 Nov',
    currency: 'INR', period: 'per year',
  },
];

const stageOrder = ['Applied', 'Shortlisted', 'Interview', 'Offer', 'Hired'];

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

function StageChip({ stage }) {
  const map = {
    Applied: 'bg-[#F3F4F6] text-[#4A5568]',
    Shortlisted: 'bg-[#F3EBDD] text-[#806236]',
    Interview: 'border border-[#0F1B2D] text-[#0F1B2D]',
    Offer: 'bg-[#E7F3EC] text-[#286749]',
    Hired: 'bg-[#0F1B2D] text-white',
    'Not selected': 'bg-[#FCE8E6] text-[#B42318]',
    Withdrawn: 'border border-[#4A5568] text-[#4A5568]',
    'Job closed': 'border border-[#A0A7B4] text-[#A0A7B4]',
    Draft: 'border border-[#4A5568] text-[#4A5568]',
    Received: 'bg-[#F3EBDD] text-[#806236]',
    'Under review by you': 'border border-[#0F1B2D] text-[#0F1B2D]',
    'Question sent': 'border border-[#4A5568] text-[#4A5568]',
    'Changes requested': 'bg-[#FFF8E8] text-[#9A7A45]',
    Revised: 'bg-[#F3EBDD] text-[#806236]',
    Accepted: 'bg-[#E7F3EC] text-[#286749]',
    Declined: 'bg-[#F3F4F6] text-[#4A5568]',
    Expired: 'border border-[#A0A7B4] text-[#A0A7B4]',
    'Withdrawn by employer': 'border border-[#B42318] text-[#B42318]',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium ${map[stage] || map.Applied}`}>
      {stage}
    </span>
  );
}

function InterviewStatusChip({ status }) {
  const map = {
    'Proposed times': 'bg-[#FFF8E8] text-[#9A7A45]',
    Scheduled: 'border border-[#0F1B2D] text-[#0F1B2D]',
    Confirmed: 'bg-[#E7F3EC] text-[#286749]',
    'Reschedule requested': 'bg-[#FFF8E8] text-[#9A7A45]',
    Completed: 'bg-[#F3F4F6] text-[#4A5568]',
    Cancelled: 'border border-[#A0A7B4] text-[#A0A7B4]',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium ${map[status] || map.Scheduled}`}>
      {status}
    </span>
  );
}

function AISuggestion({ label = 'AI suggestion', reason, onWhy }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236] font-medium">
      <Sparkles size={10} /> {label}
      {onWhy && reason && (
        <button onClick={onWhy} className="ml-1 text-[#9A7A45] underline underline-offset-1 hover:text-[#806236]">Why?</button>
      )}
      {reason && (
        <span className="ml-2 text-xs text-[#4A5568]">{reason}</span>
      )}
    </span>
  );
}

function SafetyStrip({ reportLabel = 'Report this application' }) {
  return (
    <div className="rounded-lg border border-[#FFF8E8] bg-[#FFF8E8] p-3 text-left">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 text-[#B7791F]" size={14} />
        <div className="text-xs text-[#806236] leading-relaxed">
          Never pay to start a job. A real employer will not ask for fees, deposits or equipment payments.{' '}
          <button onClick={() => {}} className="text-[#9A7A45] underline font-medium">{reportLabel}</button>
        </div>
      </div>
    </div>
  );
}

function SaveToggle({ saved, onChange, label = 'Save', size = 'md' }) {
  const pressed = !!saved;
  return (
    <button
      onClick={onChange}
      aria-pressed={pressed}
      className={`min-h-10 rounded-lg border px-3 text-xs transition-colors ${
        pressed ? 'bg-[#F3EBDD] text-[#806236] border-transparent' : 'border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA]'
      }`}
    >
      <Bookmark size={13} className={saved ? 'fill-[#806236]' : ''} />
      <span className="ml-1.5">{saved ? 'Saved' : label}</span>
    </button>
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

function JobSeekerShell({ children, active = 'Applications', className = '' }) {
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
/*  Stage timeline stepper                                            */
/* ------------------------------------------------------------------ */
function StageTimeline({ current = 'Interview', notes = {} }) {
  return (
    <div className="rounded-xl border border-[#E5E1D8] bg-white p-5">
      <h2 className="text-sm font-semibold mb-3">Application timeline</h2>
      <ol className="relative flex items-end gap-2" role="list" aria-label="Application stage timeline">
        {stageOrder.map((stage, i) => {
          const completed = stageOrder.indexOf(current) > i;
          const active = stage === current;
          const upcoming = stageOrder.indexOf(current) < i;
          return (
            <li key={stage} className="relative flex-1 flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                {completed ? (
                  <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0F1B2D] bg-[#0F1B2D] text-white text-[10px] font-medium"><Check size={12} /></span>
                ) : active ? (
                  <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#B8955A] bg-[#FFF8E8] text-[#9A7A45] text-[10px] font-medium" aria-current="step">
                    <span className="text-xs">{i + 1}</span>
                  </span>
                ) : (
                  <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5E1D8] text-[#A0A7B4] text-[10px]">{i + 1}</span>
                )}
                {i < stageOrder.length - 1 && (
                  <div className={`absolute left-1/2 top-3 h-0.5 w-full ${active ? 'bg-[#B8955A]' : upcoming ? 'bg-[#E5E1D8]' : 'bg-[#0F1B2D]/40'}`} />
                )}
              </div>
              <span className={`mt-1.5 text-[10px] font-medium text-center ${completed || active ? 'text-[#0F1B2D]' : 'text-[#A0A7B4]'}`}>{stage}</span>
              {notes[stage] && (
                <p className="mt-0.5 text-[9px] text-[#4A5568] text-center leading-none">{notes[stage]}</p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-[#4A5568]">Next: Technical interview on Thu, 6 Nov, 11:00 AM IST.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Application card                                                  */
/* ------------------------------------------------------------------ */
function ApplicationCard({ app, onOpen, onMessage, onWithdraw, onPractice, onViewJob, user, compact = false }) {
  const isWaiting = app.waiting;
  return (
    <article className={`rounded-xl border border-[#E5E1D8] bg-white p-4 animate-enter ${compact ? 'flex flex-col gap-3' : ''}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{app.logo}</span>
        <div className="min-w-[150px] flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold">{app.title}</h3>
            {app.verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified employer</span>}
          </div>
          <p className="mt-1 text-xs">{app.company} · {app.loc} · {app.type}</p>
          <p className="mt-1 text-xs text-[#4A5568]">{app.appliedDate} applied · {app.lastUpdate}</p>
        </div>
        {isWaiting && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FFF8E8] px-2 py-1 text-[9px] text-[#9A7A45]">Waiting</span>}
        <button onClick={onMessage} aria-label="Message" className="grid h-9 w-9 place-items-center text-[#A0A7B4] hover:text-[#0F1B2D]"><MessageCircle size={16} /></button>
        <button onClick={() => {}} aria-label="More actions" className="grid h-9 w-9 place-items-center text-[#A0A7B4] hover:text-[#0F1B2D]"><MoreHorizontal size={16} /></button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <StageChip stage={app.stage} />
        <div className="flex items-center gap-1 text-xs text-[#4A5568]">{app.nextStep}</div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Btn onClick={onOpen} secondary small className="flex-1 min-w-[72px]">Open</Btn>
        <Btn onClick={onMessage} secondary small className="flex-1 min-w-[72px]">Message</Btn>
        <Btn onClick={onPractice} secondary small className="flex-1 min-w-[72px]">Practice</Btn>
        <Btn onClick={onWithdraw} destructive small className="flex-1 min-w-[72px]">Withdraw</Btn>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Interview card                                                    */
/* ------------------------------------------------------------------ */
function InterviewCard({ interview, onJoin, onPrepare, onReschedule, onAddCalendar, onChooseTime, onOpenApp }) {
  return (
    <article className="rounded-xl border border-[#E5E1D8] bg-white p-4 animate-enter">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{interview.logo}</span>
          <div>
            <h3 className="text-sm font-semibold">{interview.title}</h3>
            <p className="text-xs text-[#4A5568]">{interview.company} · {interview.type}</p>
          </div>
        </div>
        <InterviewStatusChip status={interview.status} />
      </div>
      <p className="mt-1 text-xs text-[#4A5568]">{interview.date} · {interview.time} · {interview.mode} · {interview.duration}</p>
      {interview.agenda && <p className="mt-2 text-xs text-[#4A5568]">{interview.agenda}</p>}
      <div className="mt-4 flex gap-2">
        {interview.status === 'Proposed times' ? (
          <Btn onClick={onChooseTime} className="flex-1">Choose a time</Btn>
        ) : (
          <Btn onClick={onJoin} className="flex-1">Join</Btn>
        )}
        <Btn onClick={onPrepare} secondary className="flex-1">Prepare</Btn>
        <Btn onClick={onReschedule} secondary className="flex-1">Reschedule</Btn>
        <Btn onClick={onAddCalendar} secondary small className="flex-1 min-w-[64px]">Calendar</Btn>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Offer card                                                        */
/* ------------------------------------------------------------------ */
function OfferCard({ offer, onOpen, onAccept, onDecline, onRequestChanges, onAskQuestion }) {
  const expiringSoon = true;
  return (
    <article className="rounded-xl border border-[#E5E1D8] bg-white p-4 animate-enter">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{offer.logo}</span>
          <div>
            <h3 className="text-sm font-semibold">{offer.title}</h3>
            <p className="text-xs text-[#4A5568]">{offer.company} · Offer {offer.version}</p>
          </div>
        </div>
        <StageChip stage={offer.status} />
      </div>
      <p className="mt-1 text-xs text-[#4A5568]">{offer.basePay} · {offer.startDate} start</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-[#4A5568]">
        <span>Sent {offer.sentDate}</span>
        <span className="text-[#A0A7B4]">·</span>
        {expiringSoon && <span className="text-[#9A7A45] font-medium">Expires {offer.expiry}</span>}
      </div>
      <div className="mt-4 flex gap-2">
        <Btn onClick={onOpen} className="flex-1">Open offer</Btn>
        {offer.status === 'Received' && <Btn onClick={onAccept} secondary className="flex-1">Accept</Btn>}
        {offer.status === 'Received' && <Btn onClick={onDecline} destructive secondary className="flex-1">Decline</Btn>}
        <Btn onClick={onRequestChanges} secondary className="flex-1">Request changes</Btn>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 1: Application Tracker  /jobseeker/applications              */
/* ------------------------------------------------------------------ */
function ApplicationTrackerPage() {
  const [tab, setTab] = useState('Board');
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [sort, setSort] = useState('lastUpdate');
  const [view, setView] = useState('board');

  const stageCounts = useMemo(() => ({
    All: applications.length,
    Applied: applications.filter(a => a.stage === 'Applied').length,
    Shortlisted: applications.filter(a => a.stage === 'Shortlisted').length,
    Interview: applications.filter(a => a.stage === 'Interview').length,
    Offer: applications.filter(a => a.stage === 'Offer').length,
    Hired: applications.filter(a => a.stage === 'Hired').length,
    'Not selected': applications.filter(a => a.stage === 'Not selected').length,
    Withdrawn: applications.filter(a => a.stage === 'Withdrawn').length,
  }), []);

  const filtered = useMemo(() => applications.filter(a => {
    if (filterStage !== 'All' && a.stage !== filterStage) return false;
    if (search.trim() && !(a.title + ' ' + a.company).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, filterStage]);

  const openApp = useCallback((id) => { /* navigate handled by parent/router */ }, []);

  return (
    <JobSeekerShell active="Applications">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">Applications</h1>
          <p className="text-xs text-[#4A5568]">Track every application from applied to hired.</p>
        </div>
        <Link href="/jobseeker/jobs" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F1B2D] px-4 text-xs font-semibold text-white"><Search size={14} /> Browse jobs</Link>
      </div>

      <div className="mb-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 mb-3">
          {['All', 'Applied', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Not selected', 'Withdrawn'].map(s => (
            <button key={s} onClick={() => setFilterStage(s)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${filterStage === s ? 'border-[#B8955A] bg-[#F3EBDD] text-[#806236]' : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#F4F1EA]'}`}>
              {s} <span className="ml-1 text-[10px] opacity-60">({stageCounts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b border-[#E5E1D8] pb-2">
        {['Board', 'List', 'Needs action'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs border-b-2 ${tab === t ? 'border-[#B8955A] text-[#0F1B2D] font-medium' : 'border-transparent text-[#4A5568] hover:text-[#0F1B2D]'}`}>{t}</button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={16} />
          <input placeholder="Search by job, company or recruiter" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 pr-4 rounded-lg border border-[#E5E1D8] bg-white text-sm focus:border-[#B8955A] focus:outline-none focus:ring-1 focus:ring-[#B8955A]" />
        </div>
        <div className="flex gap-2 text-xs">
          <span className="text-[#4A5568]">Filter: stage</span>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="rounded-lg border border-[#E5E1D8] bg-white px-2 py-1 text-xs focus:border-[#B8955A] focus:outline-none">
            <option value="All">All stages</option>
            {stageOrder.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="Not selected">Not selected</option>
            <option value="Withdrawn">Withdrawn</option>
          </select>
          <span className="text-[#4A5568]">Sort: Last update</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main: applications */}
        <div className="lg:col-span-8">
          {tab === 'Board' && (
            <div className="grid gap-4 lg:grid-cols-6">
              {stageOrder.map(stage => {
                const items = applications.filter(a => a.stage === stage);
                return (
                  <div key={stage} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xs font-semibold text-[#4A5568]">{stage}</h3>
                      <span className="ml-auto rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[9px] text-[#4A5568]">{items.length}</span>
                    </div>
                    <div className="flex-1 min-h-[200px] rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 overflow-y-auto space-y-2">
                      {items.length === 0 ? (
                        <p className="text-[10px] text-[#A0A7B4] text-center py-4">None</p>
                      ) : (
                        items.map(app => (
                          <div key={app.id} className="rounded-lg border border-transparent bg-white p-2 hover:bg-[#F4F1EA] cursor-pointer">
                            <div className="flex items-start gap-2 mb-1">
                              <span className="grid h-8 w-8 place-items-center rounded bg-[#F3EBDD] font-semibold text-[10px]">{app.logo}</span>
                              <div className="flex-1 min-w-0">
                                <b className="block text-xs">{app.title}</b>
                                <span className="text-[9px] text-[#4A5568]">{app.company}</span>
                              </div>
                            </div>
                            <StageChip stage={app.stage} className="mt-1" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="lg:col-span-1 hidden lg:block">
                <button onClick={() => {}} className="w-full rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-[10px] text-[#4A5568] hover:bg-[#F4F1EA]">Closed</button>
              </div>
            </div>
          )}
          {tab === 'List' && (
            <div className="rounded-xl border border-[#E5E1D8] bg-white overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E1D8]">
                    <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Job</th>
                    <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Company</th>
                    <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Applied</th>
                    <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Stage</th>
                    <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Last update</th>
                    <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Next step</th>
                    <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Source</th>
                    <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(app => (
                    <tr key={app.id} className="border-b border-[#E5E1D8] hover:bg-[#F9F8F5]">
                      <td className="py-3"><b className="text-xs">{app.title}</b></td>
                      <td className="py-3 text-xs text-[#4A5568]">{app.company}</td>
                      <td className="py-3 text-xs text-[#4A5568]">{app.appliedDate}</td>
                      <td className="py-3"><StageChip stage={app.stage} className="mb-0.5" /></td>
                      <td className="py-3 text-xs text-[#4A5568]">{app.lastUpdate}</td>
                      <td className="py-3 text-xs text-[#4A5568]">{app.nextStep}</td>
                      <td className="py-3 text-xs text-[#4A5568]">{app.source}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Btn onClick={() => {}} secondary small className="min-w-[48px]">Open</Btn>
                          <Btn onClick={() => {}} secondary small className="min-w-[48px]">Message</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-[10px] text-[#4A5568]">No applications match.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filtered.length > 0 && (
                <div className="border-t border-[#E5E1D8] bg-[#FAF8F4] p-3 flex justify-between items-center">
                  <button className="text-xs text-[#9A7A45] underline">Export my applications (CSV)</button>
                  <Btn onClick={() => {}} destructive secondary small className="min-h-9 px-2">Withdraw selected</Btn>
                </div>
              )}
            </div>
          )}
          {tab === 'Needs action' && (
            <Card title="Waiting for you" padded>
              <div className="space-y-3">
                {applications.filter(a => a.waiting).map(app => (
                  <div key={app.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <b className="block text-xs">{app.title}</b>
                      <span className="text-[10px] text-[#4A5568]">{app.company} · {app.lastUpdate}</span>
                      <p className="mt-1 text-xs text-[#9A7A45]">No update in 14 days — you can send a polite follow-up.</p>
                    </div>
                    <Btn onClick={() => {}} className="min-h-9 px-3">Follow up</Btn>
                  </div>
                ))}
                <div className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <b className="block text-xs">Technical interview · Northstar Labs</b>
                    <span className="text-[10px] text-[#4A5568]">Thu, 6 Nov · 11:00 AM IST</span>
                    <p className="mt-1 text-xs text-[#9A7A45]">Choose a time or confirm attendance.</p>
                  </div>
                  <Btn onClick={() => {}} className="min-h-9 px-3">Choose a time</Btn>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Side column */}
        <aside className="lg:col-span-4 space-y-5">
          <Card title="Next steps" padded>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 text-[#B8955A]" size={14} />
                <div className="flex-1">
                  <b className="block text-xs">Technical interview tomorrow</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">Northstar Labs · Thu, 11:00 AM IST</p>
                </div>
                <Btn onClick={() => {}} className="min-h-9 px-2 text-[9px]">Prepare</Btn>
              </div>
              <div className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 text-[#B8955A]" size={14} />
                <div className="flex-1">
                  <b className="block text-xs">Send a follow-up</b>
                  <p className="mt-0.5 text-[10px] text-[#4A5568]">Lattice Works — quiet for 14 days</p>
                </div>
                <Btn onClick={() => {}} className="min-h-9 px-2 text-[9px]">Follow up</Btn>
              </div>
            </div>
          </Card>

          <Card title="Pipeline snapshot" padded>
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] text-[#4A5568] mb-1"><span>Applied</span><span>{applications.length}</span></div>
              <div className="h-1.5 rounded-full bg-[#E5E1D8] mb-3"><div className="h-full rounded-full bg-[#B8955A]" style={{ width: '80%' }} /></div>
              <div className="flex justify-between text-[10px] text-[#4A5568] mb-1"><span>Shortlisted</span><span>{stageCounts.Shortlisted}</span></div>
              <div className="h-1.5 rounded-full bg-[#E5E1D8] mb-3"><div className="h-full rounded-full bg-[#F3EBDD]" style={{ width: '50%' }} /></div>
              <div className="flex justify-between text-[10px] text-[#4A5568] mb-1"><span>Interview</span><span>{stageCounts.Interview}</span></div>
              <div className="h-1.5 rounded-full bg-[#E5E1D8] mb-3"><div className="h-full rounded-full border-2 border-[#0F1B2D]" style={{ width: '20%' }} /></div>
              <p className="mt-2 text-[10px] text-[#4A5568]">2 of 5 applications moved to interviews.</p>
            </div>
          </Card>

          <Card title="Insights" padded>
            <AISuggestion reason="Based on your own application history (5 applications)." onWhy={() => {}} />
            <p className="mt-2 text-[10px] text-[#4A5568]">Applications with a tailored resume shortlisted more often for you.</p>
          </Card>

          <Card title="Quick actions" padded>
            <div className="space-y-2">
              <Btn onClick={() => {}} className="w-full">Browse jobs</Btn>
              <Btn onClick={() => {}} secondary className="w-full">Build a resume</Btn>
              <Btn onClick={() => {}} secondary className="w-full">Start a practice interview</Btn>
            </div>
          </Card>

          <Card title="Tips" padded>
            <p className="text-[10px] text-[#4A5568]">Most employers reply within 2 weeks. A polite follow-up after 14 days is fine.</p>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 2: Application Detail  /jobseeker/applications/:applicationId */
/* ------------------------------------------------------------------ */
function ApplicationDetailPage({ applicationId }) {
  const app = applications.find(a => a.id === applicationId) || applications[0];
  const [tab, setTab] = useState('Overview');

  return (
    <JobSeekerShell active="Applications">
      <nav className="mb-4 flex items-center gap-2 text-xs">
        <Link href="/jobseeker/applications" className="text-[#4A5568] hover:text-[#0F1B2D]">Applications</Link>
        <span className="text-[#A0A7B4]">/</span>
        <span className="text-[#0F1B2D] font-medium">{app.title}</span>
      </nav>

      <header className="rounded-xl border border-[#E5E1D8] bg-white p-5 mb-4">
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{app.logo}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="serif text-[28px] font-semibold">{app.title}</h1>
              {app.verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified employer</span>}
            </div>
            <div className="flex items-center gap-2">
              <b className="text-sm">{app.company}</b>
              <StageChip stage={app.stage} />
              <span className={`rounded-full bg-[#F3F4F6] px-2 py-1 text-[9px] text-[#4A5568]`}>{app.mode}</span>
            </div>
            <p className="mt-1 text-xs text-[#4A5568]">{app.loc} · {app.type} · {app.salary}</p>
            <p className="mt-1 text-xs text-[#4A5568]">Applied {app.appliedDate} · Last update {app.lastUpdate}</p>
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => {}} secondary className="min-h-9">View job</Btn>
            <Btn onClick={() => {}} className="min-h-9">Message</Btn>
            <button className="ml-auto rounded-lg border px-3 py-2 text-xs text-[#4A5568] hover:bg-[#F4F1EA]"><MoreHorizontal size={16} /></button>
          </div>
        </div>
        <StageTimeline current={app.stage} notes={{ Shortlisted: 'Employer is reviewing your application', Interview: 'Technical interview scheduled' }} />
      </header>

      <div className="mb-4 flex gap-2 border-b border-[#E5E1D8] pb-2">
        {['Overview', 'What I shared', 'Messages', 'Interviews', 'My notes', 'Offer', 'Activity'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs border-b-2 ${tab === t ? 'border-[#B8955A] text-[#0F1B2D] font-medium' : 'border-transparent text-[#4A5568] hover:text-[#0F1B2D]'}`}>{t}</button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {tab === 'Overview' && (
            <>
              <Card title="Status summary" padded>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 text-[#B8955A]" size={14} />
                    <div className="flex-1">
                      <b className="block text-xs">{app.stage}</b>
                      <p className="mt-0.5 text-[10px] text-[#4A5568]">{app.stage === 'Interview' ? 'The employer is interested and wants to interview you.' : 'Your application is being reviewed.'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 text-[#B8955A]" size={14} />
                    <div className="flex-1">
                      <b className="block text-xs">Typical timing</b>
                      <p className="mt-0.5 text-[10px] text-[#4A5568]">Employers typically respond within 10–14 days.</p>
                    </div>
                  </div>
                </div>
              </Card>
              <Card title="Next steps for you" padded>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 text-[#B8955A]" size={14} />
                    <div className="flex-1">
                      <b className="block text-xs">Choose interview times</b>
                      <p className="mt-0.5 text-[10px] text-[#4A5568]">Northstar Labs has proposed slots for the technical round.</p>
                    </div>
                    <Btn onClick={() => {}} className="min-h-9 px-2 text-[9px]">Choose a time</Btn>
                  </div>
                </div>
              </Card>
              <Card title="What to expect" padded>
                <p className="text-[10px] text-[#4A5568]">Screening call → Technical interview → Founder chat → Offer. Interviews are video.</p>
              </Card>
              <Card title="Key dates" padded>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-[#4A5568]">Applied</span><span>{app.appliedDate}</span></div>
                  <div className="flex justify-between"><span className="text-[#4A5568]">Shortlisted</span><span>{app.lastUpdate}</span></div>
                  <div className="flex justify-between"><span className="text-[#4A5568]">Technical interview</span><span>Thu, 6 Nov · 11:00 AM IST</span></div>
                </div>
              </Card>
              <Card title="Contacts" padded>
                <p className="text-[10px] text-[#4A5568]">Hiring contact details are shared by the employer once they reach out.</p>
              </Card>
            </>
          )}
          {tab === 'What I shared' && (
            <Card title="What I shared" padded>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <FileText2 className="mt-0.5 text-[#4A5568]" size={14} />
                  <div className="flex-1">
                    <b className="block text-xs">Resume</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">{app.resumeVersion} · View file as sent</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <UserRound className="mt-0.5 text-[#4A5568]" size={14} />
                  <div className="flex-1">
                    <b className="block text-xs">Contact details</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">Shared with the employer.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ClipboardList className="mt-0.5 text-[#4A5568]" size={14} />
                  <div className="flex-1">
                    <b className="block text-xs">Screening answers</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">Submitted with your application.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <LinkIcon className="mt-0.5 text-[#4A5568]" size={14} />
                  <div className="flex-1">
                    <b className="block text-xs">Links</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">LinkedIn, portfolio.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 text-[#4A5568]" size={14} />
                  <div className="flex-1">
                    <b className="block text-xs">Readiness score shared</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">Shared Oct 30 · <button className="text-xs text-[#9A7A45] underline">Revoke if not yet viewed</button></p>
                  </div>
                </div>
                <div className="flex items-start gap-2 pt-2 border-t border-[#E5E1D8]">
                  <Info className="mt-0.5 text-[#4A5568]" size={14} />
                  <div className="flex-1">
                    <b className="block text-xs">Consent record</b>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">Agreed to share resume and answers with {app.company} on {app.appliedDate}.</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
          {tab === 'Messages' && (
            <Card title="Messages with {app.company}" padded>
              <div className="space-y-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-4 h-[300px] overflow-y-auto">
                <div className="flex items-start gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[#0F1B2D] text-white text-xs font-bold">AS</div>
                  <div className="flex-1">
                    <p className="text-xs text-[#0F1B2D]">Hi team, I'm available Thursday at 11:00 AM IST for the technical round.</p>
                    <span className="text-[9px] text-[#4A5568]">Today · 9:00 AM</span>
                  </div>
                </div>
                <div className="flex items-end gap-2 flex-row-reverse">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-[#9A7A45] text-xs font-bold">NL</div>
                  <div className="flex-1">
                    <p className="text-xs text-[#0F1B2D] bg-white p-2 rounded-lg inline-block">Sounds good — we'll send the video link shortly.</p>
                    <span className="text-[9px] text-[#4A5568]">Yesterday · 4:15 PM</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input className="flex-1 h-10 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 text-sm focus:border-[#B8955A] focus:outline-none" placeholder="Type a message…" />
                <Btn onClick={() => {}} className="min-h-10 px-3">Send</Btn>
                <button className="rounded-lg border px-3 text-[#4A5568] hover:bg-[#F4F1EA]"><Plus size={14} /></button>
              </div>
              <p className="mt-2 text-[10px] text-[#4A5568]">Templates: "Thank you and confirming my availability" · "Asking about next steps" · "Polite follow-up"</p>
            </Card>
          )}
          {tab === 'Interviews' && (
            <div className="space-y-4">
              {interviews.filter(i => i.applicationId === app.id).map(int => (
                <InterviewCard key={int.id} interview={int} onJoin={() => {}} onPrepare={() => {}} onReschedule={() => {}} onAddCalendar={() => {}} onChooseTime={() => {}} onOpenApp={() => {}} />
              ))}
            </div>
          )}
          {tab === 'My notes' && (
            <Card title="My notes (private)" padded>
              <p className="text-[10px] text-[#4A5568] mb-3">Private to you — never shown to the employer.</p>
              <textarea className="w-full h-32 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 pt-2 text-sm focus:border-[#B8955A] focus:outline-none" placeholder="Take notes about this application…" />
              <div className="mt-3 flex gap-2">
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="rounded border-[#E5E1D8] text-[#B8955A]" /> Tag: Follow up on Fri</label>
                <Btn onClick={() => {}} secondary className="ml-auto min-h-9 px-3">Save</Btn>
              </div>
            </Card>
          )}
          {tab === 'Offer' && (
            <Card title="Offer" padded>
              <p className="text-xs text-[#4A5568] mb-2">No offer yet for this application.</p>
              <Btn onClick={() => {}} className="w-full">Review offers →</Btn>
            </Card>
          )}
          {tab === 'Activity' && (
            <Card title="Activity" padded>
              <div className="space-y-3">
                {[
                  ['Application submitted', '24 Oct · 9:12 AM', 'You applied to Senior Product Designer at Northstar Labs.'],
                  ['Shortlisted', '3 Nov · 10:05 AM', 'Northstar Labs shortlisted your application.'],
                  ['Interview scheduled', '4 Nov · 2:30 PM', 'Technical interview set for Thu, 6 Nov.'],
                ].map(([x, y, z], i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#B8955A]" />
                    <div className="flex-1">
                      <b className="block text-xs">{x}</b>
                      <span className="text-[10px] text-[#4A5568]">{y}</span>
                      <p className="mt-0.5 text-[9px] text-[#4A5568]">{z}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <Card title="Next step" padded>
            <p className="text-xs text-[#4A5568] mb-2">Technical interview — Thu, 6 Nov, 11:00 AM IST</p>
            <Btn onClick={() => {}} className="w-full">Prepare for interview</Btn>
          </Card>
          <Card title="Prepare" padded>
            <AISuggestion reason="Based on the job posting and your resume." onWhy={() => {}} />
            <p className="mt-2 text-[10px] text-[#4A5568]">Practice a technical round built from this posting.</p>
            <Btn onClick={() => {}} className="w-full mt-2">Start practice</Btn>
            <p className="mt-2 text-[10px] text-[#4A5568]">Tailor a new resume version for similar roles.</p>
            <Btn onClick={() => {}} secondary className="w-full mt-2">Tailor my resume</Btn>
          </Card>
          <Card title="Application facts" padded>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#4A5568]">Reference ID</span><span className="text-xs text-[#0F1B2D]">APP-{app.id.slice(-3)}</span></div>
              <div className="flex justify-between"><span className="text-[#4A5568]">Source</span><span className="text-xs text-[#0F1B2D]">{app.source}</span></div>
              <div className="flex justify-between"><span className="text-[#4A5568]">Resume version</span><span className="text-xs text-[#0F1B2D]">{app.resumeVersion}</span></div>
              <div className="flex justify-between"><span className="text-[#4A5568]">Submitted</span><span className="text-xs text-[#0F1B2D]">{app.appliedDate}</span></div>
            </div>
          </Card>
          <Card title="Employer response time" padded>
            <p className="text-xs text-[#4A5568]">Northstar Labs typically replies within 10 days.</p>
          </Card>
          <SafetyStrip />
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 3: Interviews  /jobseeker/interviews                         */
/* ------------------------------------------------------------------ */
function InterviewsPage() {
  const [tab, setTab] = useState('Upcoming');
  const [search, setSearch] = useState('');

  const upcoming = interviews.filter(i => i.status !== 'Completed' && i.status !== 'Cancelled');
  const needsAction = interviews.filter(i => i.status === 'Proposed times');
  const past = interviews.filter(i => i.status === 'Completed');

  return (
    <JobSeekerShell active="Interviews">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">Interviews</h1>
          <p className="text-xs text-[#4A5568]">Choose or confirm times, prepare, join and follow up.</p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
        <div className="flex flex-wrap gap-2 overflow-x-auto">
          {['Upcoming', 'Needs action', 'Past', 'Calendar'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${tab === t ? 'border-[#B8955A] bg-[#F3EBDD] text-[#806236]' : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#F4F1EA]'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={16} />
          <input placeholder="Search by employer, role or type" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 pr-4 rounded-lg border border-[#E5E1D8] bg-white text-sm focus:border-[#B8955A] focus:outline-none focus:ring-1 focus:ring-[#B8955A]" />
        </div>
        <div className="flex gap-2 text-xs">
          <span className="text-[#4A5568]">Sort: Soonest</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {tab === 'Upcoming' && (
            <>
              {upcoming.length === 0 ? (
                <Card title="No upcoming interviews" padded>
                  <p className="text-xs text-[#4A5568]">No interviews scheduled yet.</p>
                  <Btn onClick={() => {}}>Start a practice interview</Btn>
                </Card>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(int => (
                    <InterviewCard key={int.id} interview={int} onJoin={() => {}} onPrepare={() => {}} onReschedule={() => {}} onAddCalendar={() => {}} onChooseTime={() => {}} onOpenApp={() => {}} />
                  ))}
                </div>
              )}
            </>
          )}
          {tab === 'Needs action' && (
            <Card title="Needs your action" padded>
              <div className="space-y-3">
                {needsAction.map(int => (
                  <div key={int.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <b className="block text-xs">{int.title} · {int.company}</b>
                      <span className="text-[10px] text-[#4A5568]">{int.type} · {int.duration}</span>
                      <p className="mt-1 text-xs text-[#9A7A45]">The employer proposed times — pick one that works for you.</p>
                    </div>
                    <Btn onClick={() => {}} className="min-h-9 px-3">Choose a time</Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {tab === 'Past' && (
            <Card title="Past interviews" padded>
              <div className="space-y-3">
                {past.map(int => (
                  <div key={int.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <b className="block text-xs">{int.title} · {int.company}</b>
                      <span className="text-[10px] text-[#4A5568]">{int.date} · {int.status}</span>
                    </div>
                    <Btn onClick={() => {}} secondary className="min-h-9 px-3">Reflect</Btn>
                  </div>
                ))}
                {past.length === 0 && <p className="text-[10px] text-[#4A5568]">No past interviews yet.</p>}
              </div>
            </Card>
          )}
          {tab === 'Calendar' && (
            <Card title="Calendar" padded>
              <p className="text-xs text-[#4A5568]">Week and month views with interview chips. Sync your external calendar to avoid clashes.</p>
              <div className="mt-4 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-center text-[10px] text-[#4A5568]">Calendar view placeholder</div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <Card title="This week" padded>
            <p className="text-xs text-[#4A5568] mb-2">{upcoming.length} interview this week</p>
            {upcoming.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-[#4A5568]">
                <Clock size={14} className="text-[#B8955A]" />
                <span>Next: {upcoming[0].title} · {upcoming[0].time}</span>
              </div>
            )}
          </Card>
          <Card title="Prepare" padded>
            <AISuggestion reason="Built from the job posting and interview type." onWhy={() => {}} />
            <p className="mt-2 text-[10px] text-[#4A5568]">One-click practice session for each upcoming interview.</p>
            <Btn onClick={() => {}} className="w-full mt-2">Start practice</Btn>
          </Card>
          <Card title="Join" padded>
            <p className="text-[10px] text-[#4A5568]">Join appears 10 minutes before platform video interviews.</p>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 4: Offers  /jobseeker/offers                                 */
/* ------------------------------------------------------------------ */
function OffersPage() {
  const [tab, setTab] = useState('Open');
  const [search, setSearch] = useState('');

  const openOffers = offers.filter(o => o.status === 'Received' || o.status === 'Revised');
  const acceptedOffers = offers.filter(o => o.status === 'Accepted');
  const closedOffers = offers.filter(o => o.status === 'Declined' || o.status === 'Expired');

  return (
    <JobSeekerShell active="Applications">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">Offers</h1>
          <p className="text-xs text-[#4A5568]">Review, compare, ask questions, accept or decline.</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-[#E5E1D8] bg-[#FFF8E8] p-3 text-left">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[#9A7A45]" />
          <span className="text-xs text-[#806236]">Offers are proposals. Binding terms are in your employment agreement.</span>
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b border-[#E5E1D8] pb-2">
        {['Open', 'Accepted', 'Declined and expired', 'All'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs border-b-2 ${tab === t ? 'border-[#B8955A] text-[#0F1B2D] font-medium' : 'border-transparent text-[#4A5568] hover:text-[#0F1B2D]'}`}>{t}</button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={16} />
          <input placeholder="Search by employer or role" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 pr-4 rounded-lg border border-[#E5E1D8] bg-white text-sm focus:border-[#B8955A] focus:outline-none focus:ring-1 focus:ring-[#B8955A]" />
        </div>
        <div className="flex gap-2 text-xs">
          <span className="text-[#4A5568]">Sort: Expiry</span>
          {openOffers.length >= 2 && (
            <Btn onClick={() => {}} secondary small>Compare offers</Btn>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {tab === 'Open' && (
            <>
              {openOffers.length === 0 ? (
                <Card title="No open offers" padded>
                  <p className="text-xs text-[#4A5568]">No offers yet. Keep practicing and applying — we'll let you know as soon as one arrives.</p>
                  <Btn onClick={() => {}}>View applications</Btn>
                </Card>
              ) : (
                <div className="space-y-3">
                  {openOffers.map(offer => (
                    <OfferCard key={offer.id} offer={offer} onOpen={() => {}} onAccept={() => {}} onDecline={() => {}} onRequestChanges={() => {}} onAskQuestion={() => {}} />
                  ))}
                </div>
              )}
            </>
          )}
          {tab === 'Accepted' && (
            <Card title="Accepted offers" padded>
              {acceptedOffers.length === 0 ? (
                <p className="text-xs text-[#4A5568]">No accepted offers yet.</p>
              ) : (
                <div className="space-y-3">
                  {acceptedOffers.map(offer => (
                    <div key={offer.id} className="rounded-xl border border-[#E5E1D8] bg-[#E7F3EC] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{offer.logo}</span>
                        <b className="text-sm">{offer.title}</b>
                        <span className="ml-auto StageChip" />{' '}
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Accepted</span>
                      </div>
                      <p className="text-xs text-[#286749]">{offer.company} · {offer.basePay} · {offer.startDate} start</p>
                      <Btn onClick={() => {}} secondary className="mt-2 min-h-9 px-3">Download offer letter</Btn>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          {tab === 'Declined and expired' && (
            <Card title="Declined and expired" padded>
              {closedOffers.length === 0 ? (
                <p className="text-xs text-[#4A5568]">None.</p>
              ) : (
                <div className="space-y-3">
                  {closedOffers.map(offer => (
                    <div key={offer.id} className="rounded-xl border border-[#E5E1D8] bg-[#F3F4F6] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{offer.logo}</span>
                        <b className="text-sm">{offer.title}</b>
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#A0A7B4] px-2 py-1 text-[9px] text-[#4A5568]">{offer.status}</span>
                      </div>
                      <p className="text-xs text-[#4A5568]">{offer.company} · Expired {offer.expiry}</p>
                      <Btn onClick={() => {}} secondary className="mt-2 min-h-9 px-3">Ask {offer.company} to reopen</Btn>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
          {tab === 'All' && (
            <Card title="All offers" padded>
              <p className="text-xs text-[#4A5568]">{offers.length} offer{offers.length !== 1 ? 's' : ''} on record.</p>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <Card title="Guidance" padded>
            <p className="text-[10px] text-[#4A5568] mb-2">Review the full terms before accepting. You can request changes or ask questions first.</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2"><Clock className="mt-0.5 text-[#B8955A]" size={14} /><span className="text-[10px] text-[#4A5568]">Offers expire — note the date and time zone.</span></div>
              <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 text-[#B8955A]" size={14} /><span className="text-[10px] text-[#4A5568]">Get your own legal advice if you need it.</span></div>
              <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 text-[#B7791F]" size={14} /><span className="text-[10px] text-[#4A5568]">Never pay to start a job.</span></div>
            </div>
          </Card>
          <Card title="Key dates" padded>
            {openOffers.map(o => (
              <div key={o.id} className="mb-3 last:mb-0">
                <b className="block text-xs">{o.company}</b>
                <span className="text-[10px] text-[#4A5568]">Expires {o.expiry}</span>
              </div>
            ))}
          </Card>
          <SafetyStrip reportLabel="Report this offer" />
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 5: Offer Detail  /jobseeker/offers/:offerId                  */
/* ------------------------------------------------------------------ */
function OfferDetailPage({ offerId }) {
  const offer = offers.find(o => o.id === offerId) || offers[0];
  const [tab, setTab] = useState('Terms');

  return (
    <JobSeekerShell active="Applications">
      <nav className="mb-4 flex items-center gap-2 text-xs">
        <Link href="/jobseeker/offers" className="text-[#4A5568] hover:text-[#0F1B2D]">Offers</Link>
        <span className="text-[#A0A7B4]">/</span>
        <span className="text-[#0F1B2D] font-medium">Offer — {offer.title}</span>
      </nav>

      <header className="rounded-xl border border-[#E5E1D8] bg-white p-5 mb-4">
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{offer.logo}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="serif text-[28px] font-semibold">Offer — {offer.title}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#0F1B2D] px-2 py-1 text-[9px] text-[#0F1B2D]">Offer {offer.version}</span>
            </div>
            <div className="flex items-center gap-2">
              <b className="text-sm">{offer.company}</b>
              {offer.verified !== false && <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified employer</span>}
              <StageChip stage={offer.status} />
            </div>
            <p className="mt-1 text-xs text-[#4A5568]">{offer.basePay} · {offer.startDate} start · Sent {offer.sentDate}</p>
            <p className="mt-1 text-xs text-[#9A7A45] font-medium">Expires {offer.expiry}</p>
          </div>
          <div className="flex gap-2">
            {offer.status === 'Received' && (
              <>
                <Btn onClick={() => {}} className="min-h-10 px-4">Accept offer</Btn>
                <Btn onClick={() => {}} destructive secondary className="min-h-10 px-4">Decline</Btn>
              </>
            )}
            <Btn onClick={() => {}} secondary className="min-h-10 px-4">Request changes</Btn>
            <Btn onClick={() => {}} secondary className="min-h-10 px-4">Ask a question</Btn>
          </div>
        </div>
      </header>

      <div className="mb-4 flex gap-2 border-b border-[#E5E1D8] pb-2">
        {['Terms', 'Offer letter and documents', 'Compare', 'Conversation', 'My notes (private)', 'History'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs border-b-2 ${tab === t ? 'border-[#B8955A] text-[#0F1B2D] font-medium' : 'border-transparent text-[#4A5568] hover:text-[#0F1B2D]'}`}>{t}</button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {tab === 'Terms' && (
            <>
            <Card title="Compensation" padded>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[#4A5568]">Base pay</span><b>{offer.basePay} ({offer.period})</b></div>
                <div className="flex justify-between"><span className="text-[#4A5568]">Variable / bonus</span><b>{offer.bonus}</b></div>
                <div className="flex justify-between"><span className="text-[#4A5568]">Equity</span><span className="text-xs text-[#4A5568]">{offer.equity}</span></div>
                <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 mt-2">
                  <p className="text-[10px] text-[#4A5568] mb-1">Estimated take-home</p>
                  <p className="text-[10px] text-[#806236]">Estimate only — not tax advice. Enter your assumptions to see monthly take-home.</p>
                </div>
              </div>
            </Card>
            <Card title="Role" padded>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#4A5568]">Title</span><span>{offer.title}</span></div>
                <div className="flex justify-between"><span className="text-[#4A5568]">Work mode</span><span>Remote</span></div>
                <div className="flex justify-between"><span className="text-[#4A5568]">Employment type</span><span>Full-time</span></div>
                <div className="flex justify-between"><span className="text-[#4A5568]">Start date</span><span>{offer.startDate}</span></div>
              </div>
            </Card>
            <Card title="Conditions" padded>
              <p className="text-[10px] text-[#4A5568]">Background checks, reference checks and documents required before start.</p>
            </Card>
            </>
          )}
          {tab === 'Offer letter and documents' && (
            <Card title="Documents" padded>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#4A5568]"><span>Offer letter (PDF)</span><Btn onClick={() => {}} secondary className="min-h-8 px-2">Download</Btn></div>
                <div className="flex items-center justify-between text-xs text-[#4A5568]"><span>Employment agreement draft</span><Btn onClick={() => {}} secondary className="min-h-8 px-2">View</Btn></div>
              </div>
              <p className="mt-2 text-[10px] text-[#4A5568]">The offer letter and agreement are the employer's documents. Read them, and get your own legal advice if you need it.</p>
            </Card>
          )}
          {tab === 'Compare' && (
            <Card title="Compare versions" padded>
              <p className="text-[10px] text-[#4A5568] mb-2">Only one version on record. Request changes to create v2.</p>
            </Card>
          )}
          {tab === 'Conversation' && (
            <Card title="Conversation" padded>
              <div className="space-y-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 h-[200px] overflow-y-auto">
                <div className="flex items-start gap-2"><div className="grid h-7 w-7 place-items-center rounded-full bg-[#0F1B2D] text-white text-[9px] font-bold">AS</div><div className="flex-1"><p className="text-[10px] text-[#0F1B2D]">Can we discuss the start date?</p><span className="text-[9px] text-[#4A5568]">Today</span></div></div>
                <div className="flex items-end gap-2 flex-row-reverse"><div className="grid h-7 w-7 place-items-center rounded-full bg-[#F3EBDD] text-[#9A7A45] text-[9px] font-bold">NL</div><div className="flex-1"><p className="text-[10px] text-[#0F1B2D] bg-white p-2 rounded-lg inline-block">We can be flexible — let us know your preference.</p><span className="text-[9px] text-[#4A5568]">Today</span></div></div>
              </div>
              <div className="mt-2 flex gap-2"><input className="flex-1 h-9 rounded-lg border border-[#E5E1D8] bg-white pl-3 text-[10px] focus:border-[#B8955A] focus:outline-none" placeholder="Send a message…" /><Btn onClick={() => {}} className="min-h-9 px-3 text-[10px]">Send</Btn></div>
            </Card>
          )}
          {tab === 'My notes (private)' && (
            <Card title="My notes (private)" padded>
              <p className="text-[10px] text-[#4A5568] mb-2">Pros, cons and decision notes — never shown to the employer.</p>
              <textarea className="w-full h-32 rounded-lg border border-[#E5E1D8] bg-white pl-3 pr-3 pt-2 text-sm focus:border-[#B8955A] focus:outline-none" placeholder="Your decision notes…" />
            </Card>
          )}
          {tab === 'History' && (
            <Card title="History" padded>
              <div className="space-y-3">
                {[['Offer received', '20 Nov · 10:00 AM'], ['Viewed by you', '20 Nov · 10:15 AM']].map(([x, y], i) => (
                  <div key={i} className="flex items-start gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-[#B8955A]" /><div className="flex-1"><b className="block text-xs">{x}</b><span className="text-[10px] text-[#4A5568]">{y}</span></div></div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <Card title="Decision helper" padded>
            <AISuggestion reason="Based on your own profile preferences." onWhy={() => {}} />
            <p className="mt-2 text-[10px] text-[#4A5568]">Neutral checklist — compensation vs expectations, growth, location, company stage and risk. It never recommends accepting or declining.</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2"><Check size={12} className="text-[#2E7D5B]" /><span className="text-xs text-[#4A5568]">Compensation meets expectations</span></div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full border border-[#E5E1D8]" /><span className="text-xs text-[#4A5568]">Equity value understood</span></div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full border border-[#E5E1D8]" /><span className="text-xs text-[#4A5568]">Probation terms confirmed</span></div>
            </div>
          </Card>
          <Card title="Things to check" padded>
            <ul className="space-y-1 text-[10px] text-[#4A5568] list-disc list-inside">
              <li>Ask how the equity is valued and what happens if you leave.</li>
              <li>Confirm the probation terms.</li>
              <li>Check the notice period.</li>
            </ul>
          </Card>
          <SafetyStrip reportLabel="Report this offer" />
          <Card title="Key dates" padded>
            <div className="space-y-1 text-[10px] text-[#4A5568]">
              <div><b>Expiry</b><span className="ml-auto text-[#9A7A45]">{offer.expiry}</span></div>
              <div><b>Start date</b><span className="ml-auto">{offer.startDate}</span></div>
            </div>
          </Card>
          <Card title="Need help?" padded>
            <p className="text-[10px] text-[#4A5568]">Contact support for general guidance — not legal advice.</p>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 6: Compare Offers  /jobseeker/offers/compare                 */
/* ------------------------------------------------------------------ */
function CompareOffersPage() {
  return (
    <JobSeekerShell active="Applications">
      <nav className="mb-4 flex items-center gap-2 text-xs">
        <Link href="/jobseeker/offers" className="text-[#4A5568] hover:text-[#0F1B2D]">Offers</Link>
        <span className="text-[#A0A7B4]">/</span>
        <span className="text-[#0F1B2D] font-medium">Compare offers</span>
      </nav>

      <h1 className="serif mb-4 text-[28px] font-semibold">Compare offers</h1>

      <p className="mb-4 text-xs text-[#4A5568]">Compare up to 3 open offers side by side. Missing data shows "Not provided." This is a weighted view — you set what matters, not the AI.</p>

      <Card title="Comparison" padded>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E5E1D8]">
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium w-[200px]">Section / row</th>
                <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Northstar Labs</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Role', 'Title', 'Senior Product Designer'],
                ['Role', 'Location / mode', 'Remote · India'],
                ['Compensation', 'Base pay', '₹20 LPA per year'],
                ['Compensation', 'Variable / bonus', '₹2 LPA joining'],
                ['Compensation', 'Equity', 'Not provided'],
                ['Benefits', 'Insurance', 'Health insurance'],
                ['Benefits', 'Leave', 'Not provided'],
                ['Company', 'Stage', 'Series A'],
                ['Company', 'Verified', 'Yes'],
                ['Conditions', 'Probation', 'Not provided'],
                ['Conditions', 'Notice period', 'Not provided'],
                ['Conditions', 'Expiry date', '28 Nov'],
              ].map(([section, row, value]) => (
                <tr key={`${section}-${row}`} className="border-b border-[#E5E1D8]">
                  <td className="py-2"><b className="block text-[10px] text-[#4A5568] uppercase">{section}</b><span className="text-xs text-[#4A5568]">{row}</span></td>
                  <td className="py-2 text-xs">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input type="checkbox" id="highlight" className="rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" />
          <label htmlFor="highlight" className="text-xs text-[#4A5568] cursor-pointer">Highlight highest value</label>
          <span className="ml-auto text-[10px] text-[#4A5568]">Not a recommendation.</span>
        </div>
      </Card>

      <div className="mt-6 rounded-xl border border-[#E5E1D8] bg-white p-5">
        <h2 className="text-sm font-semibold mb-3">Your weights (optional)</h2>
        <p className="text-[10px] text-[#4A5568] mb-3">Set how much each factor matters to you — your weights, your decision.</p>
        <div className="space-y-3">
          {[
            ['Pay', 40],
            ['Growth', 25],
            ['Location / mode', 20],
            ['Stability', 15],
          ].map(([label, val]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-[100px] text-xs text-[#4A5568]">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#E5E1D8]"><div className="h-full rounded-full bg-[#B8955A]" style={{ width: `${val}%` }} /></div>
              <span className="w-[32px] text-xs text-[#4A5568] text-right">{val}%</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-[#4A5568]">Weighted view produced — AI does not choose a winner.</p>
      </div>

      <div className="mt-6 flex gap-2">
        <Btn onClick={() => {}} secondary className="flex-1">Export to PDF</Btn>
        <Btn onClick={() => {}} className="flex-1">Open offer</Btn>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Router export                                                     */
/* ------------------------------------------------------------------ */
const PAGES = {
  applications: ApplicationTrackerPage,
  'application-detail': ApplicationDetailPage,
  interviews: InterviewsPage,
  offers: OffersPage,
  'offer-detail': OfferDetailPage,
  compare: CompareOffersPage,
};

export default function JobSeekerApplicationsOffers({ page = 'applications', applicationId, offerId }) {
  const Page = PAGES[page];
  if (!page || !Page) return <ApplicationTrackerPage />;
  const props = {};
  if (applicationId) props.applicationId = applicationId;
  if (offerId) props.offerId = offerId;
  return <Page {...props} />;
}

export {
  ApplicationTrackerPage,
  ApplicationDetailPage,
  InterviewsPage,
  OffersPage,
  OfferDetailPage,
  CompareOffersPage,
};
