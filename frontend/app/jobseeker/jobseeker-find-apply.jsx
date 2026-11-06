'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
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
  Smartphone
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Design tokens (mirror globals.css / tailwind.config.js)           */
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
const ERROR = '#B42318';
const ERROR_TINT = '#FCE8E6';
const RADIUS_CARD = 'rounded-xl';
const RADIUS_CONTROL = 'rounded-lg';

/* ------------------------------------------------------------------ */
/*  Sample data                                                       */
/* ------------------------------------------------------------------ */
const now = new Date();

const jobs = [
  {
    id: 'senior-product-designer',
    title: 'Senior Product Designer',
    company: 'Northstar Labs',
    logo: 'N',
    loc: 'Remote · India',
    mode: 'Remote',
    type: 'Full-time',
    salary: '₹18–24 LPA',
    stage: 'Series A',
    industry: 'FinTech',
    size: '51–200',
    posted: '2 days ago',
    postedDate: new Date(now - 2 * 864e5).toISOString(),
    closes: '28 Nov',
    status: 'Open',
    verified: true,
    applicants: 24,
    fit: 'Matches 5 of your skills · Remote · Within your salary range',
    match: 'Strong fit',
    description:
      'Northstar Labs is looking for a Senior Product Designer to lead end-to-end design for our consumer lending platform. You will work closely with product managers and engineers to ship features used by thousands of borrowers every day.',
    responsibilities: [
      'Own the design of core user flows from discovery to launch',
      'Build and maintain the design system and component library',
      'Run usability tests and iterate based on customer feedback',
      'Collaborate with engineers to ensure high-fidelity implementation',
    ],
    mustHave: [
      { skill: 'Product design', have: true },
      { skill: 'Figma', have: true },
      { skill: 'Design systems', have: true },
      { skill: 'User research', have: true },
      { skill: 'Frontend handoff', have: false },
    ],
    niceToHave: [
      { skill: 'Prototyping (Framer)', have: false },
      { skill: 'Accessibility (WCAG)', have: false },
      { skill: 'Design operations', have: false },
    ],
    compensation: {
      salary: '₹18–24 LPA',
      equity: 'Equity offered',
      benefits: ['Health insurance', 'Flexible hours', 'Learning budget', 'Remote work'],
    },
    hiringProcess: [
      { stage: 'Screening call', note: '30 min with recruiter' },
      { stage: 'Design exercise', note: 'Take-home, 48 hours' },
      { stage: 'Portfolio review', note: 'With the design team' },
      { stage: 'Founder chat', note: '30 min' },
      { stage: 'Offer', note: 'HR discussion' },
    ],
    screeningQuestions: 4,
    screeningTypes: ['short text', 'multiple choice'],
    company: {
      id: 'northstar-labs',
      name: 'Northstar Labs',
      tagline: 'Embedded credit for growing businesses.',
      summary:
        'Northstar Labs builds embedded credit infrastructure for fintechs and lenders across India. Backed by top investors, we are a Series A startup of 120 people.',
      size: '51–200',
      location: 'Bengaluru · Remote-friendly',
      industry: 'FinTech',
      founded: '2021',
      stage: 'Series A',
      investmentReady: true,
      mentors: true,
      verified: true,
      verifiedDate: '14 Mar 2024',
      website: 'https://northstar.example.in',
      openJobs: 3,
      culture:
        'We ship weekly, write design docs before code, and give everyone a direct line to the founders.',
      values: ['Customer first', 'Ship small and often', 'Open by default'],
    },
    similarJobs: ['product-designer', 'ux-researcher'],
  },
  {
    id: 'product-designer',
    title: 'Product Designer',
    company: 'Morrow Health',
    logo: 'M',
    loc: 'Bengaluru · Hybrid',
    mode: 'Hybrid',
    type: 'Full-time',
    salary: '₹16–22 LPA',
    stage: 'Seed',
    industry: 'Healthcare',
    size: '11–50',
    posted: '1 day ago',
    postedDate: new Date(now - 864e5).toISOString(),
    closes: '10 Dec',
    status: 'Open',
    verified: true,
    fit: 'Matches your product design and healthcare interests',
    match: 'Good fit',
    description:
      'Design patient-facing experiences for Morrow Health\u2019s telemedicine platform, from booking a call to post-visit follow-up.',
    responsibilities: [
      'Design mobile and web experiences for patients and providers',
      'Partner with clinical advisors to ensure medical accuracy',
    ],
    mustHave: [{ skill: 'Product design', have: true }, { skill: 'Figma', have: true }, { skill: 'Healthcare UX', have: false }],
    niceToHave: [{ skill: 'Illustration', have: false }],
    compensation: { salary: '₹16–22 LPA', equity: null, benefits: ['Health insurance', 'Flexible hours'] },
    hiringProcess: [{ stage: 'Screening call', note: '30 min' }, { stage: 'Portfolio review', note: 'With design lead' }, { stage: 'Offer', note: '' }],
    screeningQuestions: 2,
    screeningTypes: ['short text'],
    company: {
      id: 'morrow-health',
      name: 'Morrow Health',
      tagline: 'Telemedicine, closer to home.',
      summary: 'Morrow Health connects patients with verified doctors over video and chat.',
      size: '11–50', location: 'Bengaluru', industry: 'Healthcare', founded: '2022',
      stage: 'Seed', investmentReady: false, mentors: false, verified: true, verifiedDate: '02 Feb 2024',
      website: 'https://morrow.example.in', openJobs: 2,
      culture: 'Small, clinical-led team that moves fast.',
      values: ['Patient safety first', 'Evidence-based design'],
    },
    similarJobs: ['senior-product-designer', 'ux-researcher'],
  },
  {
    id: 'ux-researcher',
    title: 'UX Researcher',
    company: 'Fieldnote',
    logo: 'F',
    loc: 'Kolkata · Hybrid',
    mode: 'Hybrid',
    type: 'Full-time',
    salary: 'Not shown',
    stage: 'Series B',
    industry: 'SaaS',
    size: '200+',
    posted: '4 days ago',
    postedDate: new Date(now - 4 * 864e5).toISOString(),
    closes: '15 Dec',
    status: 'Open',
    verified: true,
    fit: 'Matches 4 skills · Within your salary range',
    match: 'Good fit',
    description: 'Lead generative and evaluative research across Fieldnote\u2019s B2B product suite.',
    responsibilities: ['Plan and run user interviews and surveys', 'Synthesize findings into product recommendations'],
    mustHave: [{ skill: 'User research', have: true }, { skill: 'Interviewing', have: true }, { skill: 'Synthesis', have: true }, { skill: 'Stakeholder management', have: false }],
    niceToHave: [{ skill: 'B2B SaaS', have: false }],
    compensation: { salary: null, equity: null, benefits: ['Flexible hours', 'Learning budget'] },
    hiringProcess: [{ stage: 'Recruiter screen', note: '30 min' }, { stage: 'Research exercise', note: 'Take-home' }, { stage: 'Team chat', note: '45 min' }],
    screeningQuestions: 3,
    screeningTypes: ['long text', 'multiple choice'],
    company: {
      id: 'fieldnote',
      name: 'Fieldnote',
      tagline: 'Research infrastructure for product teams.',
      summary: 'Fieldnote helps product teams run continuous research at scale.',
      size: '200+', location: 'Kolkata · Bengaluru · Remote', industry: 'SaaS', founded: '2020',
      stage: 'Series B', investmentReady: false, mentors: false, verified: true, verifiedDate: '11 Oct 2023',
      website: 'https://fieldnote.example.in', openJobs: 5,
      culture: 'Research-informed product decisions.',
      values: ['Talk to users', 'Ship evidence'],
    },
    similarJobs: ['senior-product-designer', 'product-designer'],
  },
  {
    id: 'frontend-engineer',
    title: 'Frontend Engineer (React)',
    company: 'Lattice Works',
    logo: 'L',
    loc: 'Remote',
    mode: 'Remote',
    type: 'Contract',
    salary: '₹14–18 LPA',
    stage: 'Early revenue',
    industry: 'EdTech',
    size: '1–10',
    posted: '6 hours ago',
    postedDate: new Date(now - 6 * 3600e3).toISOString(),
    closes: 'Closing soon',
    status: 'Open',
    verified: true,
    applicants: 8,
    fit: 'Matches 3 of your skills · Remote',
    match: 'Good fit',
    description: 'Build reusable frontend components and design-system integrations for Lattice Works\u2019 authoring platform.',
    responsibilities: ['Ship React components consumed by internal teams', 'Improve accessibility across the platform'],
    mustHave: [{ skill: 'React', have: true }, { skill: 'TypeScript', have: false }, { skill: 'Component libraries', have: false }],
    niceToHave: [{ skill: 'Design systems', have: true }],
    compensation: { salary: '₹14–18 LPA', equity: null, benefits: ['Flexible hours'] },
    hiringProcess: [{ stage: 'Technical screen', note: 'Live coding' }, { stage: 'Offer', note: '' }],
    screeningQuestions: 1,
    screeningTypes: ['short text'],
    company: {
      id: 'lattice-works',
      name: 'Lattice Works',
      tagline: 'No-code authoring for educators.',
      summary: 'Lattice Works lets educators build interactive courses without code.',
      size: '1–10', location: 'Remote-first', industry: 'EdTech', founded: '2023',
      stage: 'Early revenue', investmentReady: false, mentors: false, verified: true, verifiedDate: '20 Jan 2024',
      website: 'https://lattice.example.in', openJobs: 1,
      culture: 'Small founding team, big ambitions.',
      values: ['Simplicity', 'Teacher first'],
    },
    similarJobs: [],
  },
];

const companies = [
  {
    id: 'northstar-labs',
    name: 'Northstar Labs',
    tagline: 'Embedded credit for growing businesses.',
    logo: 'N',
    summary: 'Northstar Labs builds embedded credit infrastructure for fintechs and lenders across India. Backed by top investors, we are a Series A startup of 120 people.',
    size: '51–200', location: 'Bengaluru · Remote-friendly', industry: 'FinTech', founded: '2021',
    stage: 'Series A', investmentReady: true, verified: true, verifiedDate: '14 Mar 2024',
    website: 'https://northstar.example.in', openJobs: 3, followers: true,
    culture: 'We ship weekly, write design docs before code, and give everyone a direct line to the founders.',
    values: ['Customer first', 'Ship small and often', 'Open by default'],
    benefits: ['Health insurance', 'Flexible hours', 'Learning budget', 'Remote work'],
    team: [
      { name: 'Ira Mehta', role: 'Head of Product', avatar: 'IM' },
      { name: 'Rohan Desai', role: 'Lead Engineer', avatar: 'RD' },
    ],
    hiringProcess:
      'We typically respond to every applicant within 10 days. Process: recruiter screen → take-home → team chat → offer. All interviews are video.',
  },
  {
    id: 'morrow-health',
    name: 'Morrow Health',
    tagline: 'Telemedicine, closer to home.',
    logo: 'M',
    summary: 'Morrow Health connects patients with verified doctors over video and chat.',
    size: '11–50', location: 'Bengaluru', industry: 'Healthcare', founded: '2022',
    stage: 'Seed', investmentReady: false, verified: true, verifiedDate: '02 Feb 2024',
    website: 'https://morrow.example.in', openJobs: 2, followers: false,
    culture: 'Small, clinical-led team that moves fast.',
    values: ['Patient safety first', 'Evidence-based design'],
    benefits: ['Health insurance', 'Flexible hours'],
    team: [{ name: 'Dr. Anika Rao', role: 'Chief Medical Officer', avatar: 'AR' }],
    hiringProcess: 'Recruiter screen → portfolio review with design lead → offer.',
  },
];

const startups = [
  {
    id: 'northstar-labs',
    name: 'Northstar Labs',
    logo: 'N',
    oneLiner: 'Embedded credit for growing businesses.',
    stage: 'Series A', sector: 'FinTech', location: 'Bengaluru · Remote-friendly',
    teamSize: '51–200', investmentReady: true, fundingStage: 'Series A',
    openRoles: 3, topRoles: ['Senior Product Designer', 'Frontend Engineer', 'Product Manager'],
    fit: 'Matches your product and fintech interests',
    verified: true, followed: true,
  },
  {
    id: 'morrow-health',
    name: 'Morrow Health',
    logo: 'M',
    oneLiner: 'Telemedicine, closer to home.',
    stage: 'Seed', sector: 'Healthcare', location: 'Bengaluru',
    teamSize: '11–50', investmentReady: false, fundingStage: null,
    openRoles: 2, topRoles: ['Product Designer', 'Clinical Product Manager'],
    fit: 'Matches your healthcare interests',
    verified: true, followed: false,
  },
  {
    id: 'fieldnote',
    name: 'Fieldnote',
    logo: 'F',
    oneLiner: 'Research infrastructure for product teams.',
    stage: 'Series B', sector: 'SaaS', location: 'Kolkata · Bengaluru · Remote',
    teamSize: '200+', investmentReady: false, fundingStage: 'Series B',
    openRoles: 5, topRoles: ['UX Researcher', 'Product Designer', 'Research Ops'],
    fit: 'Matches your research interests',
    verified: true, followed: false,
  },
];

const recentSearches = ['Product designer', 'Remote', 'React developer', 'UI/UX'];

const savedJobs = [
  { id: 'senior-product-designer', savedDate: '3 Nov', note: 'Strong fit, remote.', tags: ['Dream job', 'FinTech'], reminder: '28 Nov', status: 'Open', closingSoon: true },
  { id: 'ux-researcher', savedDate: '1 Nov', note: 'Great team culture.', tags: ['Backup'], reminder: null, status: 'Open', closingSoon: false },
  { id: 'frontend-engineer', savedDate: '25 Oct', note: 'Contract, keep in mind.', tags: ['Contract'], reminder: null, status: 'Closing soon', closingSoon: true },
];

const alerts = [
  { id: 'a1', title: 'Remote product designer', criteria: ['Remote', 'Product design'], newJobs: 3, channel: 'Daily email', frequency: 'Daily digest', lastRun: 'Today 6:00 AM', paused: false },
  { id: 'a2', title: 'FinTech startup jobs', criteria: ['FinTech', 'Startup'], newJobs: 0, channel: 'In-app', frequency: 'Weekly digest', lastRun: 'Yesterday', paused: true },
];

/* ------------------------------------------------------------------ */
/*  Shared UI primitives                                              */
/* ------------------------------------------------------------------ */
function Btn({ children, onClick, primary = true, secondary = false, destructive = false, small = false, disabled = false, className = '' }) {
  const base = 'inline-flex min-h-10 items-center justify-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const styles = primary
    ? `bg-${INK.replace('#', '')} text-white hover:bg-[#1C2B42]`
    : secondary
      ? `border border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA]`
      : destructive
        ? `border border-transparent text-[#B42318] hover:bg-[#FCE8E6]`
        : `bg-[#F3EBDD] text-[#806236] hover:bg-[#F0E5CC]`;
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${RADIUS_CONTROL} px-3.5 ${small ? 'py-1.5' : 'py-2'} ${styles} ${className}`}>
      {children}
    </button>
  );
}

function Card({ title, action, children, padded = true }) {
  return (
    <section className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-5`}>
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
    Open: `bg-[#E7F3EC] text-[#286749]`,
    'Closing soon': `bg-[#FFF8E8] text-[#9A7A45]`,
    Closed: `bg-[#F3F4F6] text-[#4A5568]`,
    Applied: `border border-[#0F1B2D] text-[#0F1B2D]`,
    Saved: `bg-[#F3EBDD] text-[#806236]`,
    'Draft application': `border border-[#4A5568] text-[#4A5568]`,
    'Removed by employer': `border border-[#A0A7B4] text-[#A0A7B4]`,
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-medium ${map[status] || map.Open}`}>
      {status}
    </span>
  );
}

function AIHint({ label = 'AI suggestion', reason, onWhy }) {
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

function SafetyStrip({ reportLabel = 'Report this job' }) {
  return (
    <div className="rounded-lg border border-[#FFF8E8] bg-[#FFF8E8] p-3 text-left">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 text-[#B7791F]" size={14} />
        <div className="text-xs text-[#806236] leading-relaxed">
          Never pay to apply or share bank details during recruitment.{' '}
          <button onClick={() => {}} className="text-[#9A7A45] underline font-medium">{reportLabel}</button>
          <span className="ml-1 text-[#9A7A45] underline">Safety tips</span>
        </div>
      </div>
    </div>
  );
}

function SaveToggle({ saved, onChange, label = 'Save', size = 'md' }) {
  const pressed = !!saved;
  const txt = size === 'sm' ? (saved ? 'Saved' : 'Save') : (saved ? 'Saved' : 'Save');
  return (
    <button
      onClick={onChange}
      aria-pressed={pressed}
      className={`min-h-10 rounded-lg border px-3 text-xs transition-colors ${
        pressed ? 'bg-[#F3EBDD] text-[#806236] border-transparent' : 'border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA]'
      }`}
    >
      <Bookmark size={13} className={saved ? 'fill-[#806236]' : ''} />
      <span className="ml-1.5">{txt}</span>
    </button>
  );
}

function JobCard({ job, user, onSave, onApply, onNotInterested, onReport, variant = 'card' }) {
  const isSaved = user.savedIds && user.savedIds.includes(job.id);
  const isApplied = user.appliedIds && user.appliedIds.includes(job.id);
  const showFit = user.signedIn;
  return (
    <article className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-4 animate-enter ${variant === 'table' ? 'flex flex-col gap-3' : ''}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{job.logo}</span>
        <div className="min-w-[150px] flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold">{job.title}</h3>
            {job.verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified employer</span>}
            <span className={`rounded-full ${job.stage ? 'bg-[#F3F4F6]' : 'bg-[#F3EBDD]'} px-2 py-1 text-[9px] ${job.stage ? 'text-[#4A5568]' : 'text-[#806236]'}`}>{job.stage || 'Company'}</span>
          </div>
          <p className="mt-1 text-xs">{job.company.name} · {job.loc} · {job.type}</p>
          <p className="mt-1 text-xs text-[#4A5568]">{job.salary} · Posted {job.posted}</p>
          {showFit && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-1.5 text-[10px] text-[#806236]"><Sparkles size={11} /><b>Why this fit</b> · {job.fit}</div>}
        </div>
        <button onClick={onNotInterested} aria-label="More job actions" className="grid h-9 w-9 place-items-center text-[#A0A7B4] hover:text-[#0F1B2D]"><MoreHorizontal size={16} /></button>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {isApplied ? (
          <span className="inline-flex items-center rounded-full border border-[#0F1B2D] px-2 py-1 text-[10px] text-[#0F1B2D] font-medium">Applied</span>
        ) : (
          <>
            <SaveToggle saved={isSaved} onChange={() => onSave(job.id)} size="sm" />
            <Btn onClick={() => onApply(job.id)} primary small>Apply</Btn>
          </>
        )}
        <Btn onClick={() => onReport(job.id)} secondary small>Report</Btn>
      </div>
    </article>
  );
}

function CompanyMiniCard({ company, onFollow, onView, activeTab }) {
  return (
    <div className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-3 mb-3`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{company.logo}</span>
        <b className="text-sm">{company.name}</b>
        {company.verified && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified</span>}
      </div>
      <p className="text-[10px] text-[#4A5568] mb-2">{company.industry} · {company.size} · {company.location}</p>
      <div className="flex justify-between gap-2">
        <Btn onClick={onView} secondary small>View company</Btn>
        <Btn onClick={onFollow} primary small>{company.followers ? 'Following' : 'Follow'}</Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Role shell (reuses dashboard conventions)                         */
/* ------------------------------------------------------------------ */
const jobseekerNav = [
  ['Dashboard', LayoutDashboard ? LayoutDashboard : Search, '/jobseeker/dashboard'],
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
  savedIds: ['senior-product-designer', 'ux-researcher'],
  appliedIds: [],
  skills: ['Product design', 'Figma', 'Design systems', 'User research', 'User research', 'React'],
  preferences: { roles: ['Product design', 'UX research'], locations: ['Remote', 'Kolkata', 'Bengaluru'], modes: ['Remote', 'Hybrid'] },
};

function JobSeekerShell({ children, active = 'Jobs', className = '' }) {
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
        <button className="ml-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs text-white">AS</span><span className="hidden text-xs sm:block">{user.name}</span><ChevronDown size={14} /></button>
      </header>
      <main id="candidate-main" className="mx-auto max-w-[1400px] px-4 pb-24 pt-7 sm:px-7 lg:ml-[238px] lg:px-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#E5E1D8] bg-white px-2 py-2 lg:hidden">
        {[
          ['Home', '/jobseeker/dashboard', Search],
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
/*  Page 1: Job Search  /jobseeker/jobs                               */
/* ------------------------------------------------------------------ */
function JobSearchPage() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [filters, setFilters] = useState({
    jobType: [], workMode: [], experience: [], roleCategory: [], skills: [], matchMode: 'any',
    companyStage: [], companyType: [], industry: [], companySize: [], verifiedOnly: true, followedOnly: false,
    posted: '', salaryMin: '', salaryMax: '', salaryPeriod: 'year', includeNoSalary: false,
    benefits: [], easyApply: false, notApplied: false, hideSeen: false,
  });
  const [sort, setSort] = useState('best');
  const [view, setView] = useState('list');
  const [drawerJob, setDrawerJob] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [searching, setSearching] = useState(false);

  const filtered = useMemo(() => {
    let res = jobs.filter(j => {
      const q = (query + ' ' + location).toLowerCase();
      if (q.trim()) {
        const hay = (j.title + ' ' + j.company.name + ' ' + j.industry + ' ' + j.loc).toLowerCase();
        if (!hay.includes(query.toLowerCase()) && !hay.includes(location.toLowerCase())) return false;
      }
      if (filters.jobType.length && !filters.jobType.includes(j.type)) return false;
      if (filters.workMode.length && !filters.workMode.includes(j.mode)) return false;
      if (filters.companyStage.length && !filters.companyStage.includes(j.stage)) return false;
      if (filters.verifiedOnly && !j.verified) return false;
      return true;
    });
    res.sort((a, b) => {
      if (sort === 'newest') return new Date(b.postedDate) - new Date(a.postedDate);
      if (sort === 'salary') return 0;
      if (sort === 'closing') return 0;
      return 0;
    });
    return res;
  }, [query, location, filters, sort]);

  useEffect(() => {
    let c = 0;
    if (filters.jobType.length) c++;
    if (filters.workMode.length) c++;
    if (filters.experience.length) c++;
    if (filters.companyStage.length) c++;
    if (filters.salaryMin || filters.salaryMax) c++;
    if (filters.verifiedOnly) c++;
    setActiveFiltersCount(c);
  }, [filters]);

  const handleSave = useCallback((id) => { console.log('save', id); }, []);
  const handleApply = useCallback((id) => { console.log('apply', id); }, []);

  return (
    <JobSeekerShell active="Jobs">
      <div className="mb-6">
        <div className="mb-4 rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={18} />
            <input
              placeholder="Job title, skill or company"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="h-11 pl-10 pr-4 rounded-lg border border-[#E5E1D8] bg-white text-sm focus:border-[#B8955A] focus:outline-none focus:ring-1 focus:ring-[#B8955A]"
            />
          </div>
          <div className="mb-3 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={18} />
            <input
              placeholder="City, region or Remote"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="h-11 pl-10 pr-4 rounded-lg border border-[#E5E1D8] bg-white text-sm focus:border-[#B8955A] focus:outline-none focus:ring-1 focus:ring-[#B8955A]"
            />
          </div>
          <div className="flex items-end gap-2">
            <Btn onClick={() => setSearching(true)}>Search</Btn>
            <span className="text-xs text-[#4A5568]">Recent: {recentSearches.slice(0, 3).join('  ·  ')}</span>
          </div>
        </div>
        {activeFiltersCount > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#F3EBDD] px-2.5 py-1 text-[10px] text-[#806236]">{activeFiltersCount} filter{'s' !== '' ? 's' : ''} active</span>
            <Btn onClick={() => {}} secondary small>Reset all</Btn>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#0F1B2D]">{filtered.length} jobs found</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#4A5568]">Sort by</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="rounded-lg border border-[#E5E1D8] bg-white px-2 py-1 text-xs focus:border-[#B8955A] focus:outline-none"
            >
              <option value="best">Best match <span className="text-[#806236]"><Sparkles size={9} /> AI suggestion</span></option>
              <option value="newest">Newest</option>
              <option value="salary">Salary high to low</option>
              <option value="closing">Closing soon</option>
            </select>
            <Btn onClick={() => {}} secondary small>Save this search</Btn>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-2 space-y-6">
          <Card title="Filters" padded>
            <div className="space-y-4">
              <div>
                <b className="block text-[10px] uppercase tracking-wider text-[#4A5568] mb-1">Job type</b>
                <div className="flex gap-2">{['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'].map(t => (
                  <Btn key={t} onClick={() => {}} secondary small className={filters.jobType.includes(t) ? 'bg-[#F3EBDD] text-[#806236]' : ''}>{t}</Btn>
                ))}</div>
              </div>
              <div>
                <b className="block text-[10px] uppercase tracking-wider text-[#4A5568] mb-1">Work mode</b>
                <div className="flex gap-2">{['Remote', 'Hybrid', 'On-site'].map(t => (
                  <Btn key={t} onClick={() => {}} secondary small className={filters.workMode.includes(t) ? 'bg-[#F3EBDD] text-[#806236]' : ''}>{t}</Btn>
                ))}</div>
              </div>
              <div>
                <b className="block text-[10px] uppercase tracking-wider text-[#4A5568] mb-1">Experience level</b>
                <div className="flex gap-2">{['Entry (0–2 yrs)', 'Mid (2–5)', 'Senior (5+)', 'Lead / Manager'].map(t => (
                  <Btn key={t} onClick={() => {}} secondary small>{t}</Btn>
                ))}</div>
              </div>
              <div>
                <b className="block text-[10px] uppercase tracking-wider text-[#4A5568] mb-1">Company stage</b>
                <div className="flex gap-2">{['Idea', 'Prototype', 'Early revenue', 'Mature startup', 'Established company'].map(t => (
                  <Btn key={t} onClick={() => {}} secondary small>{t}</Btn>
                ))}</div>
              </div>
              <div className="pt-2 border-t border-[#E5E1D8]">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" defaultChecked={filters.verifiedOnly} className="rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" /> Verified employers only</label>
              </div>
            </div>
          </Card>
        </aside>

        <div className="lg:col-span-6">
          {filtered.length === 0 ? (
            <Card title="No results" padded>
              <p className="text-xs text-[#4A5568]">No jobs match your search. Try removing the <b>Remote</b> filter or broadening the role.</p>
              <Btn onClick={() => {}}>Create an alert</Btn>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(j => (
                <JobCard key={j.id} job={j} user={user} onSave={handleSave} onApply={handleApply}
                  onNotInterested={() => {}} onReport={() => {}} />
              ))}
              <div className="mt-4 text-center text-xs text-[#4A5568]">Showing {filtered.length} of {filtered.length}</div>
            </div>
          )}
        </div>

        {openDrawer && drawerJob && (
          <div className="lg:col-span-4 fixed inset-y-0 right-0 z-30 w-[520px] bg-white border-l border-[#E5E1D8] p-6 overflow-y-auto animate-enter">
            <button onClick={() => setOpenDrawer(false)} className="mb-4 inline-flex items-center text-xs text-[#4A5568]"><ChevronLeft size={14} /> Back to results</button>
            <div className="flex flex-wrap items-start gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{drawerJob.logo}</span>
              <div>
                <h2 className="serif text-xl font-semibold">{drawerJob.title}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <b className="text-sm">{drawerJob.company}</b>
                  {drawerJob.verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified employer</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-[#4A5568]">
              <p>{drawerJob.loc} · {drawerJob.mode} · {drawerJob.type}</p>
              <p>{drawerJob.salary} · Posted {drawerJob.posted} · Closes {drawerJob.closes}</p>
            </div>
            <div className="mt-4 rounded-lg border border-[#E5E1D8] p-3 text-xs">{drawerJob.description}</div>
            <div className="mt-4 inline-flex gap-1 text-[10px]">
              {drawerJob.mustHave.slice(0, 5).map(s => (
                <span key={s.skill} className={`rounded-full px-2 py-1 ${s.have ? 'bg-[#F3EBDD] text-[#806236]' : 'bg-[#F3F4F6] text-[#4A5568]'}`}>{s.skill}</span>
              ))}
            </div>
            <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-1.5 text-[10px] text-[#806236]">
              <Sparkles size={11} /><b>Why this fit</b> · {drawerJob.fit}
            </div>
            <div className="mt-5 flex gap-2">
              <SaveToggle saved={user.savedIds.includes(drawerJob.id)} onChange={() => handleSave(drawerJob.id)} />
              <Btn onClick={() => handleApply(drawerJob.id)}>Apply</Btn>
            </div>
          </div>
        )}
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 2: Job Detail  /jobseeker/jobs/[jobId]                       */
/* ------------------------------------------------------------------ */
function JobDetailPage({ jobId }) {
  const job = jobs.find(j => j.id === jobId) || jobs[0];
  const [saved, setSaved] = useState(user.savedIds.includes(job.id));
  const [applied, setApplied] = useState(user.appliedIds.includes(job.id));

  return (
    <JobSeekerShell active="Jobs">
      <nav className="mb-5 flex items-center gap-2 text-xs">
        <Link href="/jobseeker/jobs" className="text-[#4A5568] hover:text-[#0F1B2D]">Jobs</Link>
        <span className="text-[#A0A7B4]">/</span>
        <span className="text-[#0F1B2D] font-medium">{job.title}</span>
      </nav>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <header className="rounded-xl border border-[#E5E1D8] bg-white p-5 mb-2">
            <div className="flex flex-wrap items-start gap-3 mb-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{job.logo}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="serif text-[28px] font-semibold">{job.title}</h1>
                  {job.status === 'Closing soon' && <span className="inline-flex items-center rounded-full bg-[#FFF8E8] px-2 py-1 text-[9px] text-[#9A7A45]">Closing soon</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/jobseeker/companies/${job.company.id}`} className="text-sm font-medium text-[#0F1B2D] hover:underline">{job.company.name}</Link>
                  {job.verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified employer</span>}
                  <span className={`rounded-full ${job.stage ? 'bg-[#F3F4F6]' : ''} px-2 py-1 text-[9px] text-[#4A5568]`}>{job.stage}</span>
                </div>
                <p className="mt-1 text-xs text-[#4A5568]">{job.loc} · {job.mode} · {job.type} · {job.salary} · Posted {job.posted}</p>
              </div>
              <div className="flex gap-2">
                <SaveToggle saved={saved} onChange={() => setSaved(!saved)} />
                <Btn onClick={() => {}}>{applied ? 'Applied' : 'Apply'}</Btn>
                <button className="ml-auto rounded-lg border px-3 py-2 text-xs text-[#4A5568] hover:bg-[#F4F1EA]">Share</button>
              </div>
            </div>
            {job.status !== 'Closed' && (
              <div className="mt-4 flex items-center gap-3 text-xs">
                <span className={`rounded-full px-2 py-1 ${job.status === 'Open' ? 'bg-[#E7F3EC] text-[#286749]' : 'bg-[#F3F4F6] text-[#4A5568]'}`}>{job.status}</span>
                <span>Applications close {job.closes}</span>
                {job.status === 'Closing soon' && <span className="rounded-full bg-[#FFF8E8] px-2 py-1 text-[9px] text-[#9A7A45]">Closes in 7 days</span>}
              </div>
            )}
          </header>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold mb-3">About the role</h2>
            <p className="text-sm text-[#4A5568] leading-relaxed">{job.description}</p>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold">What you'll do</h2>
            </div>
            <ul className="space-y-2 text-sm text-[#4A5568]">
              {job.responsibilities.map((r, i) => (
                <li key={i} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#B8955A]" />{r}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">What we're looking for</h2>
              <AIHint reason="You match 4 of 5 must-haves" onWhy={() => {}} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-[#4A5568] mb-2">Must have</h3>
                <ul className="space-y-1 text-sm">
                  {job.mustHave.map(s => (
                    <li key={s.skill} className="flex items-center gap-2">
                      {s.have ? <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D5B]" /> : <span className="h-1.5 w-1.5 rounded-full border border-[#E5E1D8]" />}
                      <span className={s.have ? 'text-[#0F1B2D] font-medium' : 'text-[#4A5568]'}>{s.skill}</span>
                      {s.have && <span className="ml-auto text-[10px] bg-[#E7F3EC] text-[#286749] px-1.5 py-0.5 rounded">Match</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236]">
                  <Sparkles size={10} /><b>AI suggestion</b> · You match {job.mustHave.filter(s => s.have).length} of {job.mustHave.length} must-haves
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#4A5568] mb-2">Nice to have</h3>
                <ul className="space-y-1 text-sm">
                  {job.niceToHave.map(s => (
                    <li key={s.skill} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full border border-[#E5E1D8]" />
                      <span className="text-[#4A5568]">{s.skill}</span>
                      <button className="ml-auto text-[10px] text-[#9A7A45] underline">Add to profile</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold mb-3">Compensation &amp; benefits</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm">{job.compensation.salary}</p>
                {job.compensation.equity && <p className="mt-1 text-xs text-[#806236]">{job.compensation.equity}</p>}
                <div className="mt-2 flex gap-2">
                  {job.compensation.benefits.map(b => (
                    <span key={b} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">{b}</span>
                  ))}
                </div>
              </div>
              <div className="text-xs text-[#4A5568]">Salary range shown by the employer. Period: per year.</div>
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold mb-3">Hiring process</h2>
            <div className="space-y-2">
              {job.hiringProcess.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#E5E1D8] text-[10px]">{i + 1}</span>
                  <div><b className="text-xs">{s.stage}</b><p className="mt-0.5 text-[10px] text-[#4A5568]">{s.note}</p></div>
                  {i < job.hiringProcess.length - 1 && <ArrowRight className="ml-auto h-4 w-4 text-[#A0A7B4]" />}
                </div>
              ))}
              <p className="mt-3 text-[10px] text-[#4A5568]">Interviews are conducted remotely unless noted otherwise.</p>
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold mb-3">Screening questions</h2>
            <p className="text-xs text-[#4A5568]">{job.screeningQuestions} question{job.screeningQuestions !== 1 ? 's' : ''} · {job.screeningTypes.join(', ')}</p>
            <p className="mt-2 text-xs text-[#4A5568]">Full questions appear when you apply.</p>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold mb-3">About the company</h2>
            <p className="text-sm text-[#4A5568] mb-2">{job.company.summary}</p>
            <div className="flex gap-2 text-xs text-[#4A5568] mb-3">
              <span>{job.company.size}</span><span>·</span><span>{job.company.location}</span><span>·</span><span>{job.company.industry}</span><span>·</span><span>Founded {job.company.founded}</span>
            </div>
            {job.company.stage && (
              <div className="mb-3 flex items-center gap-2">
                <b className="text-xs">Stage</b>
                <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">{job.company.stage}</span>
                {job.company.investmentReady && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236]"><Award size={11} /> Investment Ready</span>}
              </div>
            )}
            {job.company.mentors && (
              <p className="text-xs text-[#4A5568]">Mentors available on the platform.</p>
            )}
            <Link href={`/jobseeker/companies/${job.company.id}`} className="text-xs text-[#9A7A45] font-medium">View company page →</Link>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold mb-3">Similar jobs</h2>
            <div className="grid gap-3 grid-cols-2">
              {job.similarJobs.map(sid => {
                const sj = jobs.find(j => j.id === sid);
                if (!sj) return null;
                return (
                  <JobCard key={sj.id} job={sj} user={user} onSave={() => {}} onApply={() => {}} onNotInterested={() => {}} onReport={() => {}} />
                );
              })}
            </div>
          </section>

          <SafetyStrip />
        </div>

        <aside className="lg:col-span-4 space-y-4" style={{ position: 'sticky', top: '80px' }}>
          <Card title="Apply" padded>
            {applied ? (
              <><p className="text-xs text-[#4A5568]">Applied on {new Date().toLocaleDateString('en-IN')}</p>
              <Link href="#" className="text-xs text-[#9A7A45] font-medium">View application</Link></>
            ) : (
              <><p className="text-xs text-[#4A5568]">Applications close {job.closes}.</p>
              <Btn onClick={() => {}} className="w-full">Apply</Btn>
              <SaveToggle saved={saved} onChange={() => setSaved(!saved)} className="mt-2 w-full" /></>
            )}
          </Card>

          <Card title="Quick facts" padded>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#4A5568]">Job type</span><span>{job.type}</span></div>
              <div className="flex justify-between"><span className="text-[#4A5568]">Work mode</span><span>{job.mode}</span></div>
              <div className="flex justify-between"><span className="text-[#4A5568]">Location</span><span>{job.loc}</span></div>
              <div className="flex justify-between"><span className="text-[#4A5568]">Experience</span><span>Mid–Senior</span></div>
              <div className="flex justify-between"><span className="text-[#4A5568]">Salary</span><span>{job.salary}</span></div>
              <div className="flex justify-between"><span className="text-[#4A5568]">Posted</span><span>{job.posted}</span></div>
            </div>
          </Card>

          <Card title="Your fit" padded>
            <AIHint reason="Matched skills and preferences" onWhy={() => {}} />
            <p className="mt-2 text-xs text-[#4A5568]">You meet the must-haves and the role matches your preferred location and work mode.</p>
          </Card>

          <Card title="Tailor your resume" padded>
            <p className="text-xs text-[#4A5568]">Tailor your resume to this job to highlight relevant experience.</p>
            <Btn onClick={() => {}} secondary small className="w-full">Open tailoring</Btn>
          </Card>

          <Card title="Practice for this job" padded>
            <p className="text-xs text-[#4A5568]">Start a practice interview built from this posting.</p>
            <Btn onClick={() => {}} className="w-full">Start practice</Btn>
          </Card>

          <Card title="Hiring team" padded>
            <p className="text-xs text-[#4A5568]">Hiring manager details available after you apply.</p>
          </Card>

          <SafetyStrip reportLabel="Report this job" />
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 3: Company Page  /jobseeker/companies/[companyId]            */
/* ------------------------------------------------------------------ */
function CompanyPage({ companyId }) {
  const company = companies.find(c => c.id === companyId) || companies[0];
  const openJobs = jobs.filter(j => j.company.id === company.id);
  const [tab, setTab] = useState('Overview');
  const [followed, setFollowed] = useState(company.followers);

  return (
    <JobSeekerShell active="Jobs">
      <div className="relative mb-6">
        <div className="h-40 rounded-t-xl border-b border-[#E5E1D8] bg-[#0F1B2D]">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-transparent via-[#B8955A] to-transparent rounded-t-xl opacity-60 pointer-events-none" />
        </div>
        <div className="flex -space-x-3 pt-4 px-6">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-[#FAF8F4] bg-[#F3EBDD] font-serif text-2xl font-bold text-ink shadow-lg">{company.logo}</span>
        </div>
        <div className="px-6 pb-6">
          <h1 className="serif text-[28px] font-semibold">{company.name}</h1>
          <p className="mt-1 text-xs text-[#4A5568]">{company.tagline}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified employer</span>
            {company.stage && <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[9px] text-[#4A5568]">{company.stage}</span>}
            {company.investmentReady && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236]"><Award size={11} /> Investment Ready</span>}
          </div>
          <div className="mt-3 flex gap-3">
            <Btn onClick={() => setFollowed(!followed)}>{followed ? 'Following' : 'Follow'}</Btn>
            <Btn onClick={() => {}} secondary>View open jobs</Btn>
            <button className="ml-auto rounded-lg border px-3 py-2 text-xs text-[#4A5568] hover:bg-[#F4F1EA]"><Share2 size={14} /></button>
          </div>
          <div className="mt-3 flex gap-2 text-xs text-[#4A5568]">
            <span>{company.industry}</span><span>·</span><span>{company.size}</span><span>·</span><span>{company.location}</span><span>·</span><span>Founded {company.founded}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <a href={company.website} target="_blank" rel="noopener" className="text-xs text-[#9A7A45] underline">Website</a>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 border-b border-[#E5E1D8] pb-2">
        {['Overview', 'Jobs', 'Team and culture', 'Hiring process'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs border-b-2 ${tab === t ? 'border-[#B8955A] text-[#0F1B2D] font-medium' : 'border-transparent text-[#4A5568] hover:text-[#0F1B2D]'}`}>{t}</button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {tab === 'Overview' && (
            <>
              <Card title="About us" padded>
                <p className="text-sm text-[#4A5568]">{company.summary}</p>
              </Card>
              <Card title="What we do" padded>
                <p className="text-sm text-[#4A5568]">{company.summary.split('.')[0]}.</p>
              </Card>
              <Card title="Highlights" padded>
                <div className="grid gap-3 grid-cols-2">
                  {[['Team size', company.size], ['Founded', company.founded], ['Stage', company.stage], ['Locations', company.location]].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3">
                      <div className="text-[10px] text-[#4A5568]">{k}</div>
                      <div className="mt-1 text-sm font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
              </Card>
              {company.investmentReady && (
                <Card title="Startup readiness" padded>
                  <div className="flex items-center gap-2 mb-2"><Award size={14} className="text-[#B8955A]" /><b className="text-sm">Investment Ready</b></div>
                  <p className="text-xs text-[#4A5568]">Verified by platform mentors as investment ready. Shown neutrally — not an endorsement.</p>
                </Card>
              )}
              <Card title="Benefits &amp; perks" padded>
                <div className="flex flex-wrap gap-2">{company.benefits.map(b => (
                  <span key={b} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">{b}</span>
                ))}</div>
              </Card>
            </>
          )}
          {tab === 'Jobs' && (
            <Card title={`Open jobs (${openJobs.length})}`} padded>
              {openJobs.length === 0 ? (
                <p className="text-xs text-[#4A5568]">No open jobs right now. Follow this company to be told when they hire.</p>
              ) : (
                <div className="space-y-3">
                  {openJobs.map(j => (
                    <JobCard key={j.id} job={j} user={user} onSave={() => {}} onApply={() => {}} onNotInterested={() => {}} onReport={() => {}} />
                  ))}
                </div>
              )}
            </Card>
          )}
          {tab === 'Team and culture' && (
            <>
              <Card title="Team" padded>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  {company.team.map(p => (
                    <div key={p.name} className="rounded-lg border border-[#E5E1D8] p-3 text-center">
                      <span className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-[#F3EBDD] font-semibold">{p.avatar}</span>
                      <b className="block mt-2 text-xs">{p.name}</b>
                      <span className="text-[10px] text-[#4A5568]">{p.role}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Culture &amp; values" padded>
                <p className="text-sm text-[#4A5568] mb-2">{company.culture}</p>
                <div className="flex gap-2">{company.values.map(v => (
                  <span key={v} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">{v}</span>
                ))}</div>
              </Card>
            </>
          )}
          {tab === 'Hiring process' && (
            <Card title="How we hire" padded>
              <p className="text-sm text-[#4A5568]">{company.hiringProcess}</p>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <Card title="Open jobs" padded>
            {openJobs.slice(0, 3).map(j => (
              <div key={j.id} className="flex items-start gap-2 border-b pb-2 last:border-0 last:pb-0">
                <span className="mt-1 grid h-7 w-7 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{j.logo}</span>
                <div className="flex-1 min-w-0">
                  <b className="block text-xs">{j.title}</b>
                  <span className="text-[10px] text-[#4A5568]">{j.loc} · {j.type}</span>
                </div>
              </div>
            ))}
            <Link href="#" className="mt-2 block text-xs text-[#9A7A45] font-medium">View all {openJobs.length} jobs →</Link>
          </Card>

          <Card title="Follow" padded>
            <p className="text-xs text-[#4A5568]">Follow to get alerts when {company.name} posts jobs.</p>
            <Btn onClick={() => setFollowed(!followed)} className="w-full">{followed ? 'Following' : 'Follow'}</Btn>
          </Card>

          <Card title="Contact &amp; links" padded>
            <a href={company.website} target="_blank" rel="noopener" className="text-xs text-[#9A7A45] underline block mb-1">Website</a>
            <p className="text-[10px] text-[#4A5568]">No personal contact details are shown here.</p>
          </Card>

          <Card title="Verification" padded>
            <p className="text-xs text-[#4A5568]">Verified employer means the platform completed business checks.</p>
            <p className="mt-1 text-[10px] text-[#4A5568]">Last verified {company.verifiedDate}</p>
          </Card>

          <SafetyStrip reportLabel="Report this company" />
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 4: Startups Hiring  /jobseeker/startups                      */
/* ------------------------------------------------------------------ */
function StartupsPage() {
  const [mode, setMode] = useState('startups');
  const [stageFilter, setStageFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [investmentReadyOnly, setInvestmentReadyOnly] = useState(false);
  const [followedOnly, setFollowedOnly] = useState(false);
  const [sort, setSort] = useState('best');

  const filtered = useMemo(() => {
    return startups.filter(s => {
      if (stageFilter && s.stage !== stageFilter) return false;
      if (sectorFilter && s.sector !== sectorFilter) return false;
      if (investmentReadyOnly && !s.investmentReady) return false;
      if (followedOnly && !s.followed) return false;
      return true;
    });
  }, [stageFilter, sectorFilter, investmentReadyOnly, followedOnly]);

  return (
    <JobSeekerShell active="Jobs">
      <div className="mb-4 rounded-xl border border-[#E5E1D8] bg-[#0F1B2D] p-5 text-white">
        <div className="flex items-center gap-2 mb-2"><Shield size={16} className="text-[#B8955A]" /><b className="text-sm">Startups on the platform that are hiring now. Each one is verified.</b></div>
        <div className="flex gap-2">
          <Btn onClick={() => setMode('startups')} primary={mode === 'startups'} secondary={mode !== 'startups'} className="text-white border-transparent">Startups</Btn>
          <Btn onClick={() => setMode('jobs')} primary={mode === 'jobs'} secondary={mode !== 'jobs'} className="text-white border-transparent">Jobs at startups</Btn>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-2 space-y-6">
          <Card title="Filters" padded>
            <div className="space-y-4">
              <div>
                <b className="block text-[10px] uppercase tracking-wider text-[#4A5568] mb-1">Stage</b>
                <div className="flex gap-2">{['Idea', 'Prototype', 'Early revenue', 'Mature'].map(t => (
                  <Btn key={t} onClick={() => setStageFilter(t)} secondary small className={stageFilter === t ? 'bg-[#F3EBDD] text-[#806236]' : ''}>{t}</Btn>
                ))}</div>
              </div>
              <div>
                <b className="block text-[10px] uppercase tracking-wider text-[#4A5568] mb-1">Sector</b>
                <div className="flex gap-2">{['FinTech', 'Healthcare', 'SaaS', 'EdTech'].map(t => (
                  <Btn key={t} onClick={() => setSectorFilter(t)} secondary small className={sectorFilter === t ? 'bg-[#F3EBDD] text-[#806236]' : ''}>{t}</Btn>
                ))}</div>
              </div>
              <div>
                <b className="block text-[10px] uppercase tracking-wider text-[#4A5568] mb-1">Team size</b>
                <div className="flex gap-2">{['1–10', '11–50', '51–200', '200+'].map(t => (
                  <Btn key={t} onClick={() => {}} secondary small>{t}</Btn>
                ))}</div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={investmentReadyOnly} onChange={() => setInvestmentReadyOnly(!investmentReadyOnly)} className="rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" />
                <label className="text-xs cursor-pointer">Investment Ready</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={followedOnly} onChange={() => setFollowedOnly(!followedOnly)} className="rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" />
                <label className="text-xs cursor-pointer">Companies I follow</label>
              </div>
            </div>
          </Card>

          <Card title="Startup role guide" padded>
            <details className="text-xs text-[#4A5568] leading-relaxed">
              <summary className="font-semibold text-[#0F1B2D] cursor-pointer">What it's like to work at an early-stage startup</summary>
              <p className="mt-2">Broader responsibilities, possible equity, faster pace and higher risk than established companies.</p>
            </details>
            <div className="mt-4">
              <b className="block text-[10px] uppercase tracking-wider text-[#4A5568] mb-2">Questions to ask a startup</b>
              <ul className="space-y-1 text-[10px] text-[#4A5568] list-disc list-inside">
                <li>Runway: how many months of cash left?</li>
                <li>Mentors: who will guide my growth?</li>
                <li>Funding plans: next round and timing?</li>
                <li>Equity terms: pool, vesting, exercise window?</li>
              </ul>
            </div>
          </Card>
        </aside>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#0F1B2D]">{filtered.length} startup{filtered.length !== 1 ? 's' : ''} hiring</span>
            <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-lg border border-[#E5E1D8] bg-white px-2 py-1 text-xs">
              <option value="best">Best fit <span className="text-[#806236]"><Sparkles size={9} /> AI suggestion</span></option>
              <option value="newest">Newest hiring</option>
              <option value="roles">Most open roles</option>
              <option value="stage">Stage: earliest to latest</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <Card title="No results" padded>
              <p className="text-xs text-[#4A5568]">No startups match your filters. Try widening stage or sector.</p>
              <Btn onClick={() => {}}>Create an alert</Btn>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(s => (
                <div key={s.id} className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-4 animate-enter`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{s.logo}</span>
                    <div className="min-w-[140px] flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold">{s.name}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-1 text-[9px] text-[#286749]"><CheckCircle2 size={10} /> Verified startup</span>
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[9px] text-[#4A5568]">{s.stage}</span>
                      </div>
                      <p className="mt-1 text-xs">{s.oneLiner}</p>
                      <p className="mt-1 text-xs text-[#4A5568]">{s.sector} · {s.location} · {s.teamSize}</p>
                      {s.investmentReady && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236]"><Award size={11} /> Investment Ready</span>}
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-1.5 text-[10px] text-[#806236]"><Sparkles size={11} /><b>Why this fit</b> · {s.fit}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Btn onClick={() => {}} secondary small className="w-24">View startup</Btn>
                      <Btn onClick={() => {}} primary small className="w-24">View jobs</Btn>
                      <Btn onClick={() => {}} secondary small className="w-24 text-[#4A5568]">{s.followed ? 'Following' : 'Follow'}</Btn>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#4A5568]">
                    <span><b>{s.openRoles}</b> open roles</span>
                    <span className="text-[#A0A7B4]">·</span>
                    <span>{s.topRoles.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="lg:col-span-3 space-y-4">
          <Card title="Sort" padded>
            <p className="text-xs text-[#4A5568]">Sort results by best fit, newest activity, role count or stage.</p>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 5: Saved Jobs  /jobseeker/saved                              */
/* ------------------------------------------------------------------ */
function SavedJobsPage() {
  const [tab, setTab] = useState('Jobs');
  const [viewMode, setViewMode] = useState('cards');
  const [compare, setCompare] = useState([]);

  const openJobs = savedJobs.filter(s => s.status === 'Open');
  const closedJobs = savedJobs.filter(s => s.status !== 'Open');
  const closingSoonCount = savedJobs.filter(s => s.closingSoon).length;

  return (
    <JobSeekerShell active="Jobs">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="serif text-[28px] font-semibold">Saved jobs</h1>
          <p className="text-xs text-[#4A5568]">{savedJobs.length} saved · {openJobs.length} open · {closedJobs.length} closed</p>
        </div>
        {closingSoonCount > 0 && (
          <div className="rounded-lg border border-[#F3EBDD] bg-[#FFF8E8] px-3 py-2 text-[10px] text-[#806236]">
            {closingSoonCount} job closing soon · <span className="text-[#9A7A45] font-medium underline">Apply to these first</span>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['Jobs', 'Companies', 'Closed'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs border ${tab === t ? 'border-[#B8955A] bg-[#F3EBDD] text-[#806236]' : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#F4F1EA]'}`}>{t}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setViewMode('cards')} className={`rounded-lg border px-2 py-1.5 text-[10px] ${viewMode === 'cards' ? 'border-[#B8955A] bg-[#F3EBDD]' : 'border-[#E5E1D8]'}`}>
            <LayoutGrid size={13} />
          </button>
          <button onClick={() => setViewMode('table')} className={`rounded-lg border px-2 py-1.5 text-[10px] ${viewMode === 'table' ? 'border-[#B8955A] bg-[#F3EBDD]' : 'border-[#E5E1D8]'}`}>
            <List size={13} />
          </button>
          <span className="text-xs text-[#4A5568]">Sort: Recently saved</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {tab === 'Jobs' && (
            <>
              {savedJobs.length === 0 ? (
                <Card title="Empty" padded>
                  <p className="text-xs text-[#4A5568]">You haven't saved any jobs yet. Tap the bookmark on a job to keep it here.</p>
                  <Btn onClick={() => {}}>Search jobs</Btn>
                </Card>
              ) : (
                viewMode === 'cards' ? (
                  <div className="space-y-3">
                    {savedJobs.map(s => {
                      const j = jobs.find(j => j.id === s.id);
                      if (!j) return null;
                      return (
                        <div key={s.id} className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-4 animate-enter`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{j.logo}</span>
                              <h3 className="text-sm font-semibold">{j.title}</h3>
                              <StatusChip status={s.status} />
                            </div>
                            <button className="rounded-lg text-[10px] text-[#4A5568] hover:text-[#0F1B2D]">Remove</button>
                          </div>
                          <p className="text-xs text-[#4A5568] mb-2">{j.company.name} · {j.loc} · {j.type} · {j.salary}</p>
                          <div className="mb-2">
                            <b className="block text-[10px] text-[#4A5568]">Private note</b>
                            <p className="text-sm">{s.note}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {s.tags.map(tag => (
                              <span key={tag} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">#{tag}</span>
                            ))}
                            <button className="text-[10px] text-[#9A7A45] underline">+ Add tag</button>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs text-[#4A5568]">
                              <BellIcon size={13} /> {s.reminder || 'No reminder'}
                            </div>
                            <div className="flex gap-2">
                              <Btn onClick={() => {}} secondary small>Apply</Btn>
                              <Btn onClick={() => {}} secondary small>Tailor</Btn>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {closingSoonCount > 0 && (
                      <Btn onClick={() => {}} className="w-full">Compare up to 4 jobs</Btn>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-[#E5E1D8]">
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Job</th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Company</th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Location</th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Salary</th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Closing</th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Status</th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Tags</th>
                          <th className="pb-3 text-[10px] text-[#4A5568] font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedJobs.map(s => {
                          const j = jobs.find(j => j.id === s.id);
                          if (!j) return null;
                          return (
                            <tr key={s.id} className="border-b border-[#E5E1D8]">
                              <td className="py-3">{j.title}</td>
                              <td className="py-3 text-xs text-[#4A5568]">{j.company.name}</td>
                              <td className="py-3 text-xs text-[#4A5568]">{j.loc}</td>
                              <td className="py-3 text-xs text-[#4A5568]">{j.salary}</td>
                              <td className="py-3 text-xs text-[#4A5568]">{s.reminder || '—'}</td>
                              <td className="py-3"><StatusChip status={s.status} /></td>
                              <td className="py-3 text-xs">{s.tags.join(', ') || '—'}</td>
                              <td className="py-3"><Btn onClick={() => {}} secondary small>Apply</Btn></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </>
          )}
          {tab === 'Companies' && (
            <Card title="Saved companies" padded>
              <p className="text-xs text-[#4A5568]">You aren't following any companies yet. Follow employers from their company page.</p>
            </Card>
          )}
          {tab === 'Closed' && (
            <Card title="Closed jobs" padded>
              <p className="text-xs text-[#4A5568]">{closedJobs.length} job moved to Closed since you saved it.</p>
              <div className="mt-3 space-y-2">
                {closedJobs.map(s => {
                  const j = jobs.find(j => j.id === s.id);
                  if (!j) return null;
                  return (
                    <div key={s.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <b className="block text-xs">{j.title}</b>
                        <span className="text-[10px] text-[#4A5568]">{j.company.name} · Closed</span>
                      </div>
                      <div className="flex gap-2">
                        <Btn onClick={() => {}} secondary small>Find similar</Btn>
                        <Btn onClick={() => {}} secondary small>Remove</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

          <aside className="lg:col-span-4 space-y-4">
            <Card title="Bulk actions" padded>
              <p className="text-xs text-[#4A5568]">Select multiple jobs to add a tag, set a reminder, remove, or compare side by side.</p>
              <Btn onClick={() => {}} className="w-full">Compare selected (up to 4)</Btn>
            </Card>
          </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 6: Alerts & Recommendations  /jobseeker/alerts               */
/* ------------------------------------------------------------------ */
function AlertsPage() {
  const [tab, setTab] = useState('Recommended');
  const [recommendationsOff, setRecommendationsOff] = useState(false);
  const [practiceSharing, setPracticeSharing] = useState(false);

  return (
    <JobSeekerShell active="Jobs">
      <div className="mb-4 rounded-lg border border-[#E5E1D8] bg-[#F3F4F6] p-4 text-left">
        <p className="text-xs text-[#4A5568]">Recommendations are suggestions based on your profile and preferences. You decide what to apply to.</p>
      </div>

      <div className="mb-4 flex gap-2 border-b border-[#E5E1D8] pb-2">
        {['Recommended for you', 'Saved searches', 'Alerts feed', 'Following', 'Preferences'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs border-b-2 ${tab === t ? 'border-[#B8955A] text-[#0F1B2D] font-medium' : 'border-transparent text-[#4A5568] hover:text-[#0F1B2D]'}`}>{t}</button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {tab === 'Recommended for you' && (
            <>
              {recommendationsOff ? (
                <Card title="Recommendations off" padded>
                  <p className="text-xs text-[#4A5568]">Turn recommendations back on to see jobs picked for you.</p>
                  <Btn onClick={() => setRecommendationsOff(false)}>Turn on recommendations</Btn>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#0F1B2D]">Jobs picked for you</span>
                    <button className="text-xs text-[#9A7A45] underline">Refresh</button>
                  </div>
                  <div className="space-y-3">
                    {jobs.map(j => (
                      <div key={j.id} className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-4 animate-enter`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{j.logo}</span>
                            <h3 className="text-sm font-semibold">{j.title}</h3>
                          </div>
                          <button className="text-[10px] text-[#B42318] underline">Not interested</button>
                        </div>
                        <p className="text-xs text-[#4A5568] mb-2">{j.company.name} · {j.loc} · {j.type} · {j.salary}</p>
                        <details className="text-[10px] text-[#4A5568] leading-relaxed">
                          <summary className="font-medium text-[#0F1B2D] cursor-pointer">Why this fit <span className="text-[#806236]"><Sparkles size={10} /> AI suggestion</span></summary>
                          <p className="mt-1">{j.fit}</p>
                        </details>
                        <div className="mt-3 flex gap-2">
                          <Btn onClick={() => {}} secondary small className="flex-1">More like this</Btn>
                          <Btn onClick={() => {}} primary small className="flex-1">Apply</Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                  <details className="rounded-lg border border-[#E5E1D8] bg-white p-4">
                    <summary className="font-semibold text-[#0F1B2D] cursor-pointer">How recommendations work</summary>
                    <p className="mt-2 text-xs text-[#4A5568]">Recommendations use your skills, experience, job preferences and the jobs you save or skip. They never use personal characteristics such as age, gender, religion, caste, nationality or marital status. You can turn recommendations off in Preferences.</p>
                  </details>
                </>
              )}
            </>
          )}
          {tab === 'Saved searches' && (
            <>
              {alerts.length === 0 ? (
                <Card title="No saved searches" padded>
                  <p className="text-xs text-[#4A5568]">Save a search to get alerts when new jobs appear.</p>
                  <Btn onClick={() => {}}>Create saved search</Btn>
                </Card>
              ) : (
                <div className="space-y-3">
                  {alerts.map(a => (
                    <div key={a.id} className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-4 animate-enter`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-semibold">{a.title}</h3>
                        {a.paused ? <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[9px] text-[#4A5568]">Paused</span> : null}
                      </div>
                      <p className="text-xs text-[#4A5568] mb-2">{a.criteria.join(' · ')}</p>
                      <div className="flex gap-2 text-xs text-[#4A5568] mb-2">
                        <span>{a.channel}</span><span>·</span><span>{a.frequency}</span><span>·</span><span>{a.lastRun}</span>
                      </div>
                      <a href="#" className="text-xs text-[#9A7A45] font-medium mr-3">View results</a>
                      <a href="#" className="text-xs text-[#9A7A45] font-medium mr-3">Edit</a>
                      <button className="text-xs text-[#9A7A45] font-medium mr-3">{a.paused ? 'Resume' : 'Pause alerts'}</button>
                      <button className="text-xs text-[#B42318] font-medium">Delete</button>
                    </div>
                  ))}
                  <Btn onClick={() => {}} className="w-full">+ New saved search</Btn>
                </div>
              )}
            </>
          )}
          {tab === 'Alerts feed' && (
            <Card title="Alerts feed" padded>
              <p className="text-xs text-[#4A5568]">Northstar Labs posted 'Senior Product Designer' — Today 10:12 AM</p>
              <p className="mt-2 text-xs text-[#4A5568]">5 new jobs match 'Remote product designer' — Yesterday</p>
              <p className="mt-2 text-xs text-[#4A5568]">A job you saved closes in 3 days — Yesterday</p>
            </Card>
          )}
          {tab === 'Following' && (
            <Card title="Following" padded>
              <div className="space-y-3">
                {companies.slice(0, 2).map(c => (
                  <div key={c.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{c.logo}</span>
                      <div>
                        <b className="block text-xs">{c.name}</b>
                        <span className="text-[10px] text-[#4A5568]">{c.openJobs} open jobs</span>
                      </div>
                    </div>
                    <button className="text-xs text-[#9A7A45] underline">Unfollow</button>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {tab === 'Preferences' && (
            <Card title="Preferences" padded>
              <p className="text-xs text-[#4A5568] mb-2">Target roles: Product design, UX research</p>
              <p className="text-xs text-[#4A5568] mb-2">Locations: Remote, Kolkata, Bengaluru</p>
              <p className="text-xs text-[#4A5568] mb-2">Work mode: Remote, Hybrid</p>
              <p className="text-xs text-[#4A5568] mb-2">Company stage: Any</p>
              <Link href="/jobseeker/preferences" className="text-xs text-[#9A7A45] font-medium">Edit preferences →</Link>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <b className="text-xs">Use my practice results to suggest jobs</b>
                    <p className="text-[10px] text-[#4A5568]">Off by default. Practice insights are used only for your own suggestions.</p>
                  </div>
                  <input type="checkbox" checked={practiceSharing} onChange={() => setPracticeSharing(!practiceSharing)} className="rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <b className="text-xs">Turn off recommendations</b>
                    <p className="text-[10px] text-[#4A5568]">Hides recommended jobs across the platform.</p>
                  </div>
                  <input type="checkbox" checked={recommendationsOff} onChange={() => setRecommendationsOff(!recommendationsOff)} className="rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" />
                </div>
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <Card title="Create or edit saved search" padded>
            <p className="text-xs text-[#4A5568] mb-2">Set filters, name the search and choose how often you're alerted.</p>
            <div className="space-y-2">
              <label className="block text-[10px] text-[#4A5568] mb-1">Search name</label>
              <input className="field text-xs" defaultValue="Remote product designer" />
              <label className="block text-[10px] text-[#4A5568] mb-1 mt-2">Channels</label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" defaultChecked className="rounded border-[#E5E1D8] text-[#B8955A]" /> In-app</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" defaultChecked className="rounded border-[#E5E1D8] text-[#B8955A]" /> Email</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="rounded border-[#E5E1D8] text-[#B8955A]" /> Push</label>
              </div>
              <label className="block text-[10px] text-[#4A5568] mb-1 mt-2">Frequency</label>
              <select className="w-full field text-xs"><option>Daily digest</option><option>Instant</option><option>Weekly digest</option></select>
            </div>
            <Btn onClick={() => {}} className="w-full mt-3">Save search</Btn>
          </Card>
        </aside>
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Page 7: Apply  /jobseeker/jobs/[jobId]/apply                      */
/* ------------------------------------------------------------------ */
function ApplyPage({ jobId }) {
  const job = jobs.find(j => j.id === jobId) || jobs[0];
  const [step, setStep] = useState(1);
  const [resume, setResume] = useState(null);
  const [shareScore, setShareScore] = useState(false);

  const resumes = [
    { id: 'r1', name: 'Product Designer', target: 'Product design', updated: 'Oct 30', ats: 74, suggested: true },
    { id: 'r2', name: 'UX Researcher', target: 'Research', updated: 'Sep 15', ats: 68, suggested: false },
  ];

  const canNext = step === 1 ? !!resume : true;

  return (
    <JobSeekerShell active="Jobs" className="pb-10">
      <header className="mb-6 flex items-center gap-2">
        <Link href={`/jobseeker/jobs/${jobId}`} className="text-xs text-[#4A5568] hover:text-[#0F1B2D]">← Back to job</Link>
        <h1 className="serif text-[28px] font-semibold">Apply to {job.title}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="flex items-center gap-2 mb-6 text-xs">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="flex items-center gap-1">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium ${
                  step > n ? 'bg-[#0F1B2D] text-white border-transparent' : step === n ? 'border-[#B8955A] text-[#B8955A] bg-[#FFF8E8]' : 'border-[#E5E1D8] text-[#4A5568]'
                }`}>{n}</span>
                {n < 4 && <ArrowRight className="h-3 w-3 text-[#A0A7B4]" />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <Card title="1. Choose a resume" padded>
              <p className="text-xs text-[#4A5568] mb-3">Select the resume to send with this application.</p>
              <div className="space-y-2">
                {resumes.map(r => (
                  <div key={r.id} onClick={() => setResume(r)} className={`cursor-pointer rounded-lg border p-3 hover:bg-[#F4F1EA] ${resume?.id === r.id ? 'border-[#B8955A] bg-[#FFF8E8]' : 'border-[#E5E1D8] bg-white'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <b className="text-sm">{r.name}</b>
                      {r.suggested && <span className="rounded-full bg-[#F3EBDD] px-2 py-0.5 text-[9px] text-[#806236]"><Sparkles size={9} /> AI suggestion</span>}
                    </div>
                    <p className="text-[10px] text-[#4A5568]">{r.target} · Updated {r.updated}</p>
                    <p className="mt-1 text-xs text-[#4A5568]">ATS score {r.ats}/100</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t pt-3 space-y-2 text-xs">
                <button onClick={() => {}} className="text-[#9A7A45] underline">Tailor this resume for the job</button>
                <button onClick={() => {}} className="text-[#9A7A45] underline">Upload a different file (PDF/DOCX, up to 10 MB)</button>
                <button onClick={() => {}} className="text-[#9A7A45] underline">Build a resume</button>
              </div>
              {resume && (
                <div className="mt-4 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs">
                  <b className="block text-[10px] text-[#4A5568]">Preview (view-only)</b>
                  <p className="mt-1">{resume.name} — {resume.target}</p>
                </div>
              )}
            </Card>
          )}

          {step === 2 && (
            <Card title="2. Details and questions" padded>
              <div className="space-y-4">
                <div>
                  <b className="block text-[10px] text-[#4A5568]">Contact details</b>
                  <input className="field text-xs" defaultValue="Aanya Sen" />
                  <input className="field text-xs mt-2" defaultValue="aanya@example.in" />
                  <input className="field text-xs mt-2" defaultValue="+91 98765 43210" />
                  <p className="mt-1 text-[10px] text-[#4A5568]">Shared with the employer when you submit.</p>
                </div>
                <div>
                  <b className="block text-[10px] text-[#4A5568]">Links (optional)</b>
                  <input className="field text-xs" placeholder="LinkedIn, portfolio or GitHub" />
                </div>
                <div>
                  <b className="block text-[10px] text-[#4A5568] mb-1">Screening questions</b>
                  {[
                    'Why do you want to join Northstar Labs?',
                    'Describe a design system you built.',
                    'Are you comfortable with remote work?',
                  ].map((q, i) => (
                    <div key={i} className="mt-2">
                      <p className="text-xs text-[#0F1B2D] font-medium">{q}</p>
                      <textarea className="field text-xs mt-1 h-24" placeholder="Your answer"></textarea>
                      <span className="text-[10px] text-[#4A5568]">300 characters</span>
                    </div>
                  ))}
                </div>
                <div>
                  <b className="block text-[10px] text-[#4A5568] mb-1">Cover note (optional)</b>
                  <textarea className="field text-xs mt-1 h-24" placeholder="A short note to the employer (up to 1,000 characters)" />
                  <button className="mt-1 text-[10px] text-[#9A7A45] underline">Suggest a draft <Sparkles size={10} /></button>
                </div>
                <div className="flex items-start gap-2 mt-2">
                  <input type="checkbox" checked={shareScore} onChange={() => setShareScore(!shareScore)} className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]" />
                  <label className="text-xs text-[#4A5568]">Share my job-readiness score with {job.company.name} (off by default)</label>
                </div>
                <p className="mt-2 text-[10px] text-[#4A5568]">Your name and photo may be hidden at first screening if the employer uses blind review.</p>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card title="3. Review and submit" padded>
              <div className="space-y-4">
                <div>
                  <b className="block text-[10px] text-[#4A5568]">What will be shared</b>
                  <ul className="space-y-1 text-sm text-[#4A5568]">
                    <li>Resume: {resume ? resume.name : 'None selected'}</li>
                    <li>Contact details, links and answers</li>
                    <li>Cover note (optional)</li>
                    <li>Readiness score: {shareScore ? 'Shared' : 'Not shared'}</li>
                  </ul>
                    {resume ? (
                    <p className="mt-1 text-xs text-[#9A7A45]"><FileText2 size={12} className="mr-1" /> Edit resume</p>
                  ) : (
                    <p className="mt-1 text-xs text-[#B42318]">Please select a resume.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A]" /> I confirm the information is accurate.</label>
                  <label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" className="mt-0.5 rounded border-[#E5E1D8] text-[#B8955A]" /> I agree to share this information with {job.company.name} for this application.</label>
                </div>
                <p className="text-[10px] text-[#4A5568]">Your information stays private from other employers.</p>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card title="Application sent" padded>
              <div className="text-center py-6">
                <CheckCircle2 size={48} className="mx-auto text-[#2E7D5B]" />
                <h2 className="serif mt-3 text-2xl font-semibold">Application sent to {job.company.name}</h2>
                <p className="mt-1 text-xs text-[#4A5568]">{new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
              <div className="space-y-3 mt-4">
                <div className="flex justify-between text-xs text-[#4A5568]"><span>Download a summary</span><button className="text-[#9A7A45] underline">PDF</button></div>
                <div className="flex justify-between text-xs text-[#4A5568]"><span>Next steps</span><span className="text-[#4A5568]">Employer reviews applications within 10 days</span></div>
              </div>
              <div className="mt-5 flex gap-2">
                <Btn onClick={() => {}} secondary className="flex-1">View application</Btn>
                <Btn onClick={() => {}} secondary className="flex-1">Practice for this job</Btn>
                <Btn onClick={() => {}} secondary className="flex-1">Find similar jobs</Btn>
              </div>
            </Card>
          )}

          {!resume && step === 1 && (
            <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-xs text-[#4A5568]">
              You need a resume to apply. <button onClick={() => {}} className="text-[#9A7A45] underline font-medium">Build a resume</button> or <button onClick={() => {}} className="text-[#9A7A45] underline font-medium">upload a file</button>.
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-4" style={{ position: 'sticky', top: '80px' }}>
          <Card title={`Applying to ${job.title} at ${job.company.name}`} padded>
            <div className="space-y-3 text-xs text-[#4A5568]">
              <div><b>Role</b><span className="ml-auto">{job.title}</span></div>
              <div><b>Company</b><span className="ml-auto">{job.company.name}</span></div>
              <div><b>Resume</b><span className="ml-auto">{resume ? resume.name : 'Not selected'}</span></div>
              <div><b>Readiness score</b><span className="ml-auto">{shareScore ? 'Shared' : 'Not shared'}</span></div>
            </div>
          </Card>

          <Card title="Your application draft" padded>
            <p className="text-xs text-[#4A5568]">Draft saved · just now</p>
            <p className="mt-1 text-[10px] text-[#4A5568]">Cancel returns to the job and keeps your draft.</p>
            <button className="mt-2 w-full text-xs text-[#B42318] underline">Cancel</button>
          </Card>

          <SafetyStrip reportLabel="Report this job" />
        </aside>
      </div>

      <div className="mt-8 flex justify-end gap-2">
        <button onClick={() => setStep(s => Math.max(1, s - 1))} className="rounded-lg border px-4 py-2 text-xs text-[#4A5568]">Back</button>
        {step < 4 && (
          <Btn onClick={() => { setStep(s => s + 1) }} disabled={step === 1 && !resume}>Continue</Btn>
        )}
        {step === 4 && <Btn onClick={() => {}}>Done</Btn>}
      </div>
    </JobSeekerShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Router export                                                     */
/* ------------------------------------------------------------------ */
const PAGES = {
  jobs: JobSearchPage,
  'job-detail': JobDetailPage,
  company: CompanyPage,
  startups: StartupsPage,
  saved: SavedJobsPage,
  alerts: AlertsPage,
  apply: ApplyPage,
};

export default function JobSeekerFindApply({ page = 'jobs', jobId, companyId }) {
  const Page = PAGES[page];
  if (!page || !Page) return <JobSearchPage />;
  const props = {};
  if (jobId) props.jobId = jobId;
  if (companyId) props.companyId = companyId;
  return <Page {...props} />;
}

export { JobSearchPage, JobDetailPage, CompanyPage, StartupsPage, SavedJobsPage, AlertsPage, ApplyPage };
