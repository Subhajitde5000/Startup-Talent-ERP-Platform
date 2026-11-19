'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StartupSidebar, Btn, Card, SubNavTabs } from '../../../components';
import { api, ApiError } from '@/lib/api/client';
import {
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  Plus,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  FileText,
  ShieldCheck,
  Star,
  Video,
  LockKeyhole,
  Upload,
  Send,
  X,
  Bookmark,
  Globe,
  MapPin,
  Wallet,
  Download,
  RefreshCw,
  Check,
  MoreHorizontal,
  Mail,
  Building2,
  Target,
  ThumbsUp,
  ClipboardCheck,
  Paperclip,
  Play,
  Handshake,
  Menu
} from 'lucide-react';

const mentors = [
  {
    id: 'rhea',
    name: 'Rhea Mukherjee',
    headline: 'Go-to-market advisor · 2 exits',
    expertise: ['Go-to-market', 'Fundraising', 'SaaS'],
    industries: ['Fintech', 'B2B SaaS'],
    rating: '4.9',
    reviews: 28,
    price: '₹3,000 / hour',
    next: 'Thu, Nov 12',
    sessions: 140,
    location: 'Kolkata, India',
    bio: 'I work with early-stage founders to shape a clear go-to-market strategy, validate pricing and build an investor-ready story. My approach is structured, candid and focused on practical next steps.',
    why: 'Strong match for your Prototype stage and fundraising readiness goals.',
  },
  {
    id: 'arjun',
    name: 'Arjun Mehta',
    headline: 'Former CTO · 1 successful exit',
    expertise: ['Technology', 'Product', 'Hiring'],
    industries: ['SaaS', 'Marketplace'],
    rating: '4.8',
    reviews: 41,
    price: '₹4,500 / hour',
    next: 'Fri, Nov 13',
    sessions: 215,
    location: 'Bengaluru, India',
    bio: 'I help technical founders move from prototype to resilient product with a clear engineering roadmap and a high-trust early team.',
    why: 'Matches your MVP testing and early engineering team needs.',
  },
  {
    id: 'naina',
    name: 'Naina Roy',
    headline: 'Finance operator · 12 startups advised',
    expertise: ['Finance', 'Fundraising', 'Operations'],
    industries: ['Fintech', 'Climate'],
    rating: '5.0',
    reviews: 19,
    price: 'Free / pro bono',
    next: 'Mon, Nov 16',
    sessions: 98,
    location: 'Mumbai, India',
    bio: 'I support founders with unit economics, runway planning and financial models that are clear to both teams and investors.',
    why: 'Your finance and readiness priorities align with her expertise.',
  },
];

const criteria = [
  'Pitch deck and one-page summary reviewed',
  'Business model and unit economics validated',
  'Financial projections and use of funds defined',
  'Cap table and legal basics in order',
  'Traction metrics documented',
  'Data room complete',
];

const sessionDetails = {
  'session-01': {
    title: 'Go-to-market and pricing',
    sub: 'Confirmed · Thursday, November 12 · 4:00 PM · 45 minutes',
    mentor: 'Rhea Mukherjee',
    readinessItem: 'Business model and unit economics'
  },
  'sess-1': {
    title: 'Go-to-market and pricing',
    sub: 'Confirmed · Thursday, November 12 · 4:00 PM · 45 minutes',
    mentor: 'Rhea Mukherjee',
    readinessItem: 'Business model and unit economics'
  },
  'session-02': {
    title: 'Unit economics review',
    sub: 'Scheduled · Thursday, November 19 · 4:00 PM · 45 minutes',
    mentor: 'Rhea Mukherjee',
    readinessItem: 'Financial projections and runway'
  },
  'sess-2': {
    title: 'Unit economics review',
    sub: 'Scheduled · Thursday, November 19 · 4:00 PM · 45 minutes',
    mentor: 'Rhea Mukherjee',
    readinessItem: 'Financial projections and runway'
  }
};

// ---- Step 5f: readiness page (real API) -------------------------------------
// The only wired page in this shared file. Everything else here (overview,
// find, requests, sessions, workspace, billing) is Step 8 and stays on demo
// data until then.
const READINESS_EDIT_ROLES = ['owner', 'admin', 'member'];

const READINESS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted for sign-off',
  signed_off: 'Signed off',
  rejected: 'Changes requested'
};

const READINESS_CHIP = {
  signed_off: 'bg-[#E7F3EC] text-[#286749]',
  submitted: 'bg-[#FFF3D6] text-[#8A5700]',
  rejected: 'bg-[#FDECEC] text-[#A33A3A]',
  in_progress: 'bg-[#F3F4F6] text-[#4A5568]',
  not_started: 'bg-[#F3F4F6] text-[#4A5568]'
};

const formatSignedOff = value => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** 422 details -> {field: message}, same shape the tasks page uses. */
function readinessFieldErrors(err) {
  const out = {};
  if (err instanceof ApiError && Array.isArray(err.details)) {
    for (const d of err.details) {
      const loc = Array.isArray(d.loc) ? d.loc : [];
      const key = loc[loc.length - 1];
      if (typeof key === 'string' && !out[key]) out[key] = d.msg || 'Invalid value.';
    }
  }
  return out;
}

export default function MentorApp({ page = 'overview', id = 'rhea' }) {
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [tab, setTab] = useState('Overview');
  const [requestSent, setRequestSent] = useState(false);
  const [requestTab, setRequestTab] = useState('Sent');
  const [sessionTab, setSessionTab] = useState('Upcoming');
  const [status, setStatus] = useState(['Signed off', 'Signed off', 'Submitted for sign-off', 'In progress', 'Not started', 'Not started']);
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState(false);
  const [query, setQuery] = useState('');
  const [expertise, setExpertise] = useState('All expertise');
  const [saved, setSaved] = useState([]);
  const [profileRating, setProfileRating] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(false);

  // Step 5f readiness page state. `status` above stays as-is for the Step 8
  // blocks; nothing here is shared with them.
  const [readiness, setReadiness] = useState(null); // ReadinessBoard
  // Starts at 'loading': the effect runs after the first paint, and an
  // 'idle' start would flash an empty body under the page header.
  const [readinessPhase, setReadinessPhase] = useState('loading'); // loading|ready|error|none
  const [readinessError, setReadinessError] = useState('');
  const [readinessOrg, setReadinessOrg] = useState(null); // OrganizationRead (my_role)
  const [readinessReload, setReadinessReload] = useState(0);
  const [evidenceFor, setEvidenceFor] = useState(null); // criterion id of the open editor
  const [evidenceDraft, setEvidenceDraft] = useState('');
  const [readinessErrs, setReadinessErrs] = useState({});
  const [readinessFormErr, setReadinessFormErr] = useState('');
  const [readinessBusy, setReadinessBusy] = useState(false); // any in-flight write
  const readinessAlive = useRef(true);

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2700);
  };

  // Dynamic mentor lookup supporting test IDs like 'm-1'
  const mentorId = id === 'm-1' ? 'rhea' : id === 'm-2' ? 'arjun' : id === 'm-3' ? 'naina' : id;
  const mentor = mentors.find(m => m.id === mentorId || m.id === id) || mentors[0];
  const approved = status.filter(s => s === 'Signed off').length;

  const currentSession = sessionDetails[id] || sessionDetails['session-01'];

  // Step 5f: load the readiness board only when this page is open, so no
  // Step 8 page pays for a request it does not use.
  useEffect(() => {
    readinessAlive.current = true;
    return () => { readinessAlive.current = false; };
  }, []);

  useEffect(() => {
    if (page !== 'readiness') return undefined;
    const alive = readinessAlive;
    (async () => {
      setReadinessPhase('loading');
      setReadinessError('');
      let startup = null;
      try {
        const orgs = await api.organizations.mine();
        startup = orgs.find(o => o.type === 'startup') || null;
      } catch (err) {
        if (!alive.current) return;
        setReadinessError(err instanceof ApiError ? err.message : 'Could not load your organization.');
        setReadinessPhase('error');
        return;
      }
      if (!alive.current) return;
      if (!startup) {
        setReadinessPhase('none');
        return;
      }
      setReadinessOrg(startup);
      try {
        const board = await api.readiness.board(startup.id);
        if (!alive.current) return;
        setReadiness(board);
        setReadinessPhase('ready');
      } catch (err) {
        if (!alive.current) return;
        setReadinessError(err instanceof ApiError ? err.message : 'Could not load readiness.');
        setReadinessPhase('error');
      }
    })();
  }, [page, readinessReload]);

  const canEditReadiness = !!readinessOrg && READINESS_EDIT_ROLES.includes(readinessOrg.my_role);

  /** Re-read the board after a write so the score always matches the rows. */
  const reloadReadiness = () => setReadinessReload(n => n + 1);

  /** One write path for every transition: maps 422/409/403 onto the UI. */
  /** One write path: `closeEditorFor` clears the editor on success,
   *  `fieldFor` reopens it when the server flags that field. */
  const runReadinessWrite = async (fn, { toast, closeEditorFor = null, fieldFor = null } = {}) => {
    setReadinessBusy(true);
    setReadinessErrs({});
    setReadinessFormErr('');
    try {
      const item = await fn();
      if (!readinessAlive.current) return null;
      setReadiness(prev => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.map(x => (x.criterion_id === item.criterion_id ? item : x)) };
      });
      reloadReadiness();
      if (toast) notify(toast);
      if (closeEditorFor) {
        setEvidenceFor(null);
        setEvidenceDraft('');
      }
      return item;
    } catch (err) {
      if (!readinessAlive.current) return null;
      const fieldErrs = readinessFieldErrors(err);
      if (Object.keys(fieldErrs).length) {
        setReadinessErrs(fieldErrs);
        // A field error the user cannot see is not an error message: open
        // the evidence editor when that is the offending field.
        if (fieldErrs.evidence && fieldFor) setEvidenceFor(fieldFor);
      } else {
        const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        setReadinessFormErr(msg);
        notify(msg);
      }
      return null;
    } finally {
      if (readinessAlive.current) setReadinessBusy(false);
    }
  };

  const openEvidence = item => {
    setEvidenceFor(item.criterion_id);
    setEvidenceDraft(item.evidence || '');
    setReadinessErrs({});
    setReadinessFormErr('');
  };

  const saveEvidence = item => {
    // The server requires evidence before a submission, so an empty save is
    // a dead end for the user: stop it here and mark the field instead of
    // writing a blank row that only fails later.
    if (!evidenceDraft.trim()) {
      setReadinessErrs({ evidence: 'Add evidence before saving, or cancel.' });
      return Promise.resolve(null);
    }
    return runReadinessWrite(
      () => api.readiness.update(readinessOrg.id, item.criterion_id, { evidence: evidenceDraft }),
      { toast: 'Evidence saved.', closeEditorFor: item.criterion_id, fieldFor: item.criterion_id }
    );
  };

  const submitItem = item =>
    runReadinessWrite(() => api.readiness.submit(readinessOrg.id, item.criterion_id), {
      toast: 'Submitted for sign-off.',
      fieldFor: item.criterion_id
    });

  const withdrawItem = item =>
    runReadinessWrite(() => api.readiness.withdraw(readinessOrg.id, item.criterion_id), {
      toast: 'Submission withdrawn.',
      fieldFor: item.criterion_id
    });

  const head = (title, sub, action) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">Acme Studio <span className="mx-2 text-[#B8955A]">·</span> Mentorship</p>
        <h1 className="serif mt-1 text-[30px] font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[#4A5568]">{sub}</p>
      </div>
      {action}
    </div>
  );

  const mentorCard = (m) => (
    <article key={m.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5 transition hover:border-[#A0A7B4]">
      <div className="flex items-start gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#F3EBDD] font-serif text-xl font-semibold text-[#806236]">
          {m.name.split(' ').map(x => x[0]).join('')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{m.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]">
              <CheckCircle2 size={12} /> Verified mentor
            </span>
          </div>
          <p className="mt-1 text-xs text-[#4A5568]">{m.headline}</p>
          <p className="mt-1 text-xs">
            <Star className="mr-1 inline fill-[#B8955A] text-[#B8955A]" size={13} />
            {m.rating} <span className="text-[#4A5568]">({m.reviews} verified reviews)</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#4A5568]">{m.why}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {m.expertise.map(t => (
          <span key={t} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px]">{t}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
        <span className="text-xs">
          <b>{m.price}</b>
          <small className="ml-2 text-[#4A5568]">Next free: {m.next}</small>
        </span>
        <div className="flex gap-2">
          <Link href={`/startup/mentors/find/${m.id}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">
            View profile
          </Link>
          <button
            type="button"
            onClick={() => { setModal('request'); setTab(m.id); }}
            className="min-h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-white"
          >
            Request mentorship
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#mentor-main" className="sr-only focus:not-sr-only">Skip to content</a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active="Mentor"
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobileNav}
        setMobileOpen={setMobileNav}
        onAction={notify}
      />

      {/* Header */}
      <header className={`sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur transition-[margin] duration-200 sm:px-7 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E1D8] bg-white text-ink lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17} />
            <input placeholder="Search workspace" className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm" />
          </div>
          <Link href="/startup/dashboard" className="text-sm font-semibold sm:hidden">
            ← Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => notify('You’re all caught up.')}
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center"
          >
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <span className="flex items-center gap-2 text-xs">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">AK</span>
            <span className="hidden sm:block">Aarav Kapoor</span>
            <ChevronDown size={14} />
          </span>
        </div>
      </header>

      <main id="mentor-main" className={`mx-auto max-w-[1440px] px-4 pb-24 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {/* Secondary section navigation */}
        <SubNavTabs
          items={[
            ['Overview', '/startup/mentors', page === 'overview'],
            ['Find mentors', '/startup/mentors/find', page === 'find' || page === 'mentor-profile'],
            ['Requests', '/startup/mentors/requests', page === 'requests'],
            ['Sessions', '/startup/sessions', page === 'sessions' || page === 'session'],
            ['Readiness', '/startup/readiness', page === 'readiness'],
          ]}
        />
        {page === 'overview' && (
          <>
            {head(
              'Mentors',
              'Find the right guidance and make meaningful progress toward readiness.',
              <Link href="/startup/mentors/find" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                <Search size={15} /> Find a mentor
              </Link>
            )}

            {requestSent && (
              <div className="mb-5 rounded-lg border border-[#E7D4B0] bg-[#F3EBDD] p-3 text-sm">
                Waiting for Rhea Mukherjee to respond. Usually within 3 days.
              </div>
            )}

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Active mentors', '1'],
                ['Sessions held', '9'],
                ['Deliverables due', '3'],
                ['Readiness', `${approved} / 6`],
              ].map(([n, v]) => (
                <div key={n} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                  <p className="text-xs text-[#4A5568]">{n}</p>
                  <b className="serif mt-1 block text-2xl">{v}</b>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                <Card title="My mentors" action={<Link href="/startup/mentors/find" className="text-xs font-semibold text-[#9A7A45]">Find another <ArrowRight className="inline" size={13} /></Link>}>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-[#F3EBDD] font-semibold">RM</span>
                    <div className="min-w-[160px] flex-1">
                      <h3 className="font-semibold">
                        Rhea Mukherjee <span className="ml-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236]">Verified</span>
                      </h3>
                      <p className="mt-1 text-xs text-[#4A5568]">Go-to-market · SaaS · 6 sessions held</p>
                      <p className="mt-1 text-xs text-[#4A5568]">Next session: Thu, Nov 12 at 4:00 PM</p>
                    </div>
                    <Link href="/startup/mentors/mentorship-01" className="rounded-lg bg-ink px-3 py-2.5 text-xs font-semibold text-white">
                      Open workspace
                    </Link>
                  </div>
                </Card>

                <Card title="Readiness sign-off progress" action={<Link href="/startup/readiness" className="text-xs font-semibold text-[#9A7A45]">Open readiness <ArrowRight className="inline" size={13} /></Link>}>
                  <div className="mb-4 flex items-center justify-between text-xs">
                    <span>{approved} of 6 items signed off</span>
                    <b>{Math.round((approved / 6) * 100)}%</b>
                  </div>
                  <div className="mb-4 h-2 rounded-full bg-[#E5E1D8]">
                    <div className="h-full rounded-full bg-[#B8955A]" style={{ width: `${(approved / 6) * 100}%` }} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {criteria.map((c, i) => (
                      <div key={c} className="flex items-center gap-2 rounded-lg bg-[#FAF8F4] p-2.5 text-xs">
                        <span className={status[i] === 'Signed off' ? 'text-[#2E7D5B]' : 'text-[#B7791F]'}>
                          {status[i] === 'Signed off' ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                        </span>
                        <span className="flex-1">{c}</span>
                        <small className="text-[#4A5568]">{status[i]}</small>
                      </div>
                    ))}
                  </div>
                  {approved === 6 && (
                    <div className="mt-4 rounded-lg bg-[#F3EBDD] p-4 text-sm font-semibold text-[#806236]">
                      <ShieldCheck className="mr-2 inline" size={17} />Investment Ready · Make your profile visible to investors
                    </div>
                  )}
                </Card>

                <Card title="Deliverables due" action={<Link href="/startup/tasks" className="text-xs font-semibold text-[#9A7A45]">Open tasks</Link>}>
                  <div className="divide-y divide-[#E5E1D8]">
                    {[
                      ['Review customer interview themes', 'Nov 08', 'In progress'],
                      ['Update unit economics assumptions', 'Nov 12', 'To do'],
                      ['Prepare pitch story outline', 'Nov 15', 'To do'],
                    ].map(([a, d, s]) => (
                      <div key={a} className="flex flex-wrap items-center gap-3 py-3">
                        <ClipboardCheck size={16} className="text-[#9A7A45]" />
                        <span className="flex-1 text-xs font-medium">
                          {a}<small className="ml-2 text-[#4A5568]">Mentor</small>
                        </span>
                        <span className="text-[10px] text-[#4A5568]">Due {d}</span>
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{s}</span>
                        <button type="button" onClick={() => notify('Deliverable submitted for mentor review.')} className="text-xs font-semibold text-[#9A7A45]">
                          Submit
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <aside className="space-y-5">
                <Card title="Next session">
                  <p className="text-xs text-[#4A5568]">Thursday, November 12 · 4:00 PM</p>
                  <h3 className="mt-2 font-semibold">Go-to-market and pricing</h3>
                  <p className="mt-1 text-xs text-[#4A5568]">Rhea Mukherjee · 45 minutes · Asia/Kolkata</p>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => notify('Join button becomes available 10 minutes before start.')} className="flex-1 rounded-lg bg-ink py-2.5 text-xs font-semibold text-white">
                      Join session
                    </button>
                    <button type="button" onClick={() => notify('Reschedule request sent.')} className="rounded-lg border border-[#E5E1D8] px-3 text-xs">
                      Reschedule
                    </button>
                  </div>
                </Card>

                <Card title="Open requests">
                  <p className="text-xs text-[#4A5568]">Your request to Arjun Mehta is awaiting a response.</p>
                  <span className="mt-2 inline-block rounded-full bg-[#FFF3D6] px-2 py-1 text-[10px] text-[#8A5700]">
                    Requested · 2 days ago
                  </span>
                  <Link href="/startup/mentors/requests" className="mt-3 block text-xs font-semibold text-[#9A7A45]">
                    View requests <ArrowRight className="inline" size={13} />
                  </Link>
                </Card>

                <Card title="A tip for Prototype">
                  <p className="text-xs leading-5 text-[#4A5568]">
                    Mentors at this stage often focus on user feedback, defining the first repeatable use case and preparing a revenue plan.
                  </p>
                  <Link href="/startup/stage" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                    Review stage goals <ArrowRight className="inline" size={13} />
                  </Link>
                </Card>
              </aside>
            </div>
          </>
        )}

        {page === 'find' && (
          <>
            {head(
              'Find mentors',
              'Browse verified advisors matched to your startup stage and goals.',
              <>
                <button type="button" onClick={() => setModal('match')} className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold">
                  Auto-match me
                </button>
                <Link href="/startup/mentors/requests" className="inline-flex min-h-10 items-center rounded-lg bg-ink px-3 text-sm font-semibold text-white">
                  My requests
                </Link>
              </>
            )}

            <div className="mb-5 rounded-xl border border-[#E7D4B0] bg-[#F3EBDD] p-4 text-sm">
              <b>Recommended for Acme Studio</b>
              <p className="mt-1 text-xs text-[#4A5568]">Matched by stage, industry and your fundraising readiness goals. You choose whether to contact anyone.</p>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-4">
              <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                <h2 className="font-semibold">Filters</h2>
                <label className="mt-4 block text-xs font-medium">
                  Expertise
                  <select value={expertise} onChange={e => setExpertise(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>All expertise</option>
                    {['Fundraising', 'Product', 'Go-to-market', 'Finance', 'Hiring', 'Technology'].map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-xs font-medium">
                  Industry
                  <input placeholder="Fintech, SaaS…" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <label className="mt-4 block text-xs font-medium">
                  Stage fit
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Prototype</option>
                    <option>Idea</option>
                    <option>Early revenue</option>
                  </select>
                </label>
                <label className="mt-4 block text-xs font-medium">
                  Availability
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>This month</option>
                    <option>This week</option>
                    <option>Any time</option>
                  </select>
                </label>
                <label className="mt-4 block text-xs font-medium">
                  Price
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Any price</option>
                    <option>Free / pro bono</option>
                    <option>Under ₹3,000 / hour</option>
                  </select>
                </label>
                <label className="mt-4 flex gap-2 text-xs">
                  <input type="checkbox" defaultChecked className="accent-ink" />Verified mentors only
                </label>
                <p className="mt-4 text-[10px] leading-4 text-[#4A5568]">We do not filter by age, gender, religion, caste or nationality.</p>
              </aside>

              <div className="space-y-3 lg:col-span-3">
                <div className="flex justify-between text-xs text-[#4A5568]">
                  <span>{mentors.filter(m => expertise === 'All expertise' || m.expertise.includes(expertise)).length} verified mentors match</span>
                  <select className="rounded border border-[#E5E1D8] bg-white px-2 py-1">
                    <option>Best match</option>
                    <option>Rating</option>
                    <option>Price</option>
                    <option>Soonest available</option>
                  </select>
                </div>
                {mentors
                  .filter(m => expertise === 'All expertise' || m.expertise.includes(expertise))
                  .map(mentorCard)}
              </div>
            </div>
          </>
        )}

        {page === 'mentor-profile' && (
          <>
            {head(
              mentor.name,
              mentor.headline,
              <Link href="/startup/mentors/find" className="text-sm text-[#9A7A45]">
                ← Back to mentors
              </Link>
            )}
            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                <Card title="About">
                  <div className="flex items-start gap-4">
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-[#F3EBDD] font-serif text-xl font-semibold">
                      {mentor.name.split(' ').map(x => x[0]).join('')}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <b>{mentor.name}</b>
                        <span className="rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236]">
                          <ShieldCheck className="mr-1 inline" size={12} />Verified mentor
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#4A5568]">{mentor.headline}</p>
                      <p className="mt-2 text-xs">
                        <MapPin className="mr-1 inline" size={12} />{mentor.location} · English, Bengali, Hindi
                      </p>
                      <p className="mt-2 text-xs">
                        <Star className="mr-1 inline fill-[#B8955A] text-[#B8955A]" size={13} />
                        {mentor.rating} ({mentor.reviews} reviews) · {mentor.sessions} sessions delivered
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-[#4A5568]">{mentor.bio}</p>
                </Card>

                <Card title="How I can help">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {mentor.expertise.map(x => (
                      <div key={x} className="rounded-lg bg-[#FAF8F4] p-3">
                        <b className="text-sm">{x}</b>
                        <p className="mt-1 text-xs text-[#4A5568]">Practical working sessions and clear next steps tailored to your stage.</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Experience">
                  <p className="text-sm font-medium">Operator and advisor · Verified experience</p>
                  <p className="mt-1 text-xs text-[#4A5568]">Built and advised early-stage teams across fintech and B2B software.</p>
                  <p className="mt-3 text-xs text-[#4A5568]">Previous roles and company details verified by Forma.</p>
                </Card>

                <Card title="Reviews">
                  <p className="text-sm">
                    <Star className="mr-1 inline fill-[#B8955A] text-[#B8955A]" size={14} />{mentor.rating} average · verified sessions only
                  </p>
                  {[
                    ['Thoughtful and direct. We left every session with a clear plan.', 'Founder, fintech startup'],
                    ['Helped us focus our customer discovery on the right questions.', 'CEO, B2B SaaS'],
                  ].map(([x, y]) => (
                    <blockquote key={x} className="mt-4 border-t border-[#E5E1D8] pt-3 text-sm">
                      “{x}”<small className="mt-1 block text-xs text-[#4A5568]">{y}</small>
                    </blockquote>
                  ))}
                </Card>
              </div>

              <aside className="space-y-5 xl:sticky xl:top-24">
                <Card title="Pricing & terms">
                  <b className="serif text-2xl">{mentor.price}</b>
                  <p className="mt-2 text-xs text-[#4A5568]">45-minute session · package options available</p>
                  <p className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-xs">Platform fee and applicable taxes are shown before you confirm.</p>
                  <p className="mt-3 text-xs text-[#4A5568]">Advisory equity: none requested</p>
                  <button type="button" onClick={() => setModal('request')} className="mt-4 w-full rounded-lg bg-ink py-3 text-sm font-semibold text-white">
                    Request mentorship
                  </button>
                  <button type="button" onClick={() => setModal('intro')} className="mt-2 w-full rounded-lg border border-[#E5E1D8] py-3 text-sm font-semibold">
                    Book intro call
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaved(saved.includes(mentor.id) ? saved.filter(x => x !== mentor.id) : [...saved, mentor.id])}
                    className="mt-3 w-full text-xs font-semibold text-[#9A7A45]"
                  >
                    <Bookmark className="mr-1 inline" size={13} />
                    {saved.includes(mentor.id) ? 'Saved' : 'Save mentor'}
                  </button>
                  <button type="button" onClick={() => notify('Report submitted to support for review.')} className="mt-2 w-full text-xs text-[#4A5568]">
                    Report mentor
                  </button>
                </Card>

                <Card title="Availability">
                  <p className="text-xs text-[#4A5568]">Next available: <b>{mentor.next}</b></p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {['Thu 4:00', 'Fri 11:00', 'Mon 2:00'].map(x => (
                      <button key={x} type="button" onClick={() => setModal('intro')} className="rounded-lg border border-[#E5E1D8] p-2 text-[10px]">
                        {x}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-[#4A5568]">Times shown in Asia/Kolkata.</p>
                </Card>
              </aside>
            </div>
          </>
        )}

        {page === 'requests' && (
          <>
            {head('Mentorship requests', 'Track requests and invitations in one place.', null)}
            <div className="mb-4 flex gap-2">
              {['Sent', 'Received', 'Past'].map(x => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setRequestTab(x)}
                  className={`min-h-10 rounded-lg px-4 text-xs ${requestTab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
                >
                  {x}
                </button>
              ))}
            </div>
            <Card title={`${requestTab} requests`}>
              {requestTab === 'Sent' ? (
                <div className="space-y-3">
                  {[
                    ['Rhea Mukherjee', 'Help validate our go-to-market and fundraising plan.', 'Active mentorship', 'Oct 21'],
                    ['Arjun Mehta', 'Support us with product architecture and hiring.', 'Waiting · 2 days', 'Nov 03'],
                  ].map(([n, g, s, d], i) => (
                    <div key={n} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E1D8] p-4">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F3EBDD] font-semibold">
                        {n.split(' ').map(x => x[0]).join('')}
                      </span>
                      <span className="min-w-[180px] flex-1">
                        <b className="block text-sm">{n}</b>
                        <small className="text-xs text-[#4A5568]">{g}</small>
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[10px] ${i ? 'bg-[#FFF3D6] text-[#8A5700]' : 'bg-[#E7F3EC] text-[#286749]'}`}>
                        {s}
                      </span>
                      <small className="text-xs text-[#4A5568]">{d}</small>
                      <Link href={`/startup/mentors/${i ? 'request-02' : 'mentorship-01'}`} className="text-xs font-semibold text-[#9A7A45]">
                        View <ArrowRight className="inline" size={12} />
                      </Link>
                      <button type="button" onClick={() => notify('Request withdrawn.')} className="text-xs text-[#B42318]">
                        Withdraw
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold">{requestTab === 'Received' ? 'No invitations received yet.' : 'No past requests.'}</p>
                  <p className="mt-1 text-xs text-[#4A5568]">Your requests will be listed here.</p>
                  <Link href="/startup/mentors/find" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                    Find a mentor
                  </Link>
                </div>
              )}
            </Card>
          </>
        )}

        {page === 'workspace' && (
          <>
            {head(
              `Mentorship with ${mentor.name}`,
              'Active · Started October 21, 2026 · Fortnightly',
              <div className="flex gap-2">
                <Link
                  href="/startup/sessions"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#E5E1D8] bg-white px-3.5 text-sm font-semibold text-ink hover:bg-[#F4F1EA]"
                >
                  <CalendarDays size={15} /> Book session
                </Link>
                <Btn onClick={() => notify('Message sent to mentor.')}>
                  <MessageCircle size={15} /> Message
                </Btn>
              </div>
            )}
            <div className="mb-5 flex gap-2 overflow-x-auto">
              {['Overview', 'Plan', 'Sessions', 'Deliverables', 'Notes', 'Files', 'Messages'].map(x => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setTab(x)}
                  className={`min-h-10 shrink-0 rounded-lg px-4 text-xs ${tab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                <Card title={tab === 'Overview' ? 'Mentorship overview' : tab}>
                  {tab === 'Overview' ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg bg-[#F3EBDD] p-4">
                          <p className="text-xs text-[#806236]">Readiness sign-off</p>
                          <b className="serif mt-1 block text-2xl">{approved} of 6 items</b>
                          <Link href="/startup/readiness" className="mt-2 inline-block text-xs font-semibold text-[#9A7A45]">
                            View checklist <ArrowRight className="inline" size={12} />
                          </Link>
                        </div>
                        <div className="rounded-lg bg-[#FAF8F4] p-4">
                          <p className="text-xs text-[#4A5568]">Next session</p>
                          <b className="mt-1 block text-sm">Thu, Nov 12 · 4:00 PM</b>
                          <small className="text-xs text-[#4A5568]">Go-to-market and pricing</small>
                        </div>
                      </div>
                      <h3 className="mt-5 text-sm font-semibold">Shared goals</h3>
                      {[
                        ['Validate pricing with 10 customers', 'Nov 30', 65],
                        ['Prepare fundraising narrative', 'Dec 15', 30],
                      ].map(([g, d, v]) => (
                        <div key={g} className="mt-3 rounded-lg border border-[#E5E1D8] p-3">
                          <div className="flex justify-between text-xs">
                            <b>{g}</b>
                            <span>{d}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-[#E5E1D8]">
                            <div className="h-full rounded-full bg-[#B8955A]" style={{ width: `${v}%` }} />
                          </div>
                          <small className="mt-1 block text-[#4A5568]">{v}% complete</small>
                        </div>
                      ))}
                    </>
                  ) : tab === 'Plan' ? (
                    <>
                      <p className="mb-4 text-xs text-[#4A5568]">Cadence: Fortnightly · 45 minutes · Plan changes require both sides to accept.</p>
                      <div className="space-y-3">
                        {[
                          ['Validate pricing and unit economics', 'Nov 30', 'Aarav Kapoor', 'In progress'],
                          ['Prepare fundraising narrative', 'Dec 15', 'Rhea Mukherjee', 'Proposed'],
                        ].map(([g, d, o, s]) => (
                          <div key={g} className="rounded-lg border border-[#E5E1D8] p-4">
                            <div className="flex justify-between text-sm">
                              <b>{g}</b>
                              <span className="text-xs">{d}</span>
                            </div>
                            <p className="mt-1 text-xs text-[#4A5568]">Success measure: share a reviewed, documented plan · Owner {o}</p>
                            <span className="mt-2 inline-block rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{s}</span>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => notify('Goal proposed to mentor.')} className="mt-4 text-xs font-semibold text-[#9A7A45]">
                        + Add goal
                      </button>
                    </>
                  ) : tab === 'Sessions' ? (
                    <Link href="/startup/sessions" className="text-xs font-semibold text-[#9A7A45]">
                      View all sessions <ArrowRight className="inline" size={13} />
                    </Link>
                  ) : tab === 'Deliverables' ? (
                    <div className="space-y-3">
                      {[
                        ['Review interview themes', 'Nov 08', 'In progress'],
                        ['Pricing model feedback', 'Nov 12', 'To do'],
                        ['Fundraising narrative', 'Nov 15', 'To do'],
                      ].map(([n, d, s]) => (
                        <div key={n} className="flex items-center gap-3 border-b border-[#E5E1D8] py-3">
                          <ClipboardCheck size={16} className="text-[#9A7A45]" />
                          <span className="flex-1 text-xs">
                            {n}<small className="ml-2 text-[#4A5568]">Due {d}</small>
                          </span>
                          <span className="text-[10px]">{s}</span>
                          <button type="button" onClick={() => notify('Deliverable submitted for mentor review.')} className="text-xs font-semibold text-[#9A7A45]">
                            Submit
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : tab === 'Notes' ? (
                    <>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={8}
                        placeholder="Add shared notes, decisions or action items…"
                        className="w-full rounded-lg border border-[#E5E1D8] bg-white p-3 text-sm"
                      />
                      <div className="mt-3 flex justify-between text-xs">
                        <label>
                          <input type="checkbox" className="mr-2 accent-ink" />Private notes
                        </label>
                        <button type="button" onClick={() => notify('Notes saved · just now.')} className="font-semibold text-[#9A7A45]">
                          Save notes
                        </button>
                      </div>
                    </>
                  ) : tab === 'Files' ? (
                    <div className="rounded-lg border border-dashed border-[#E5E1D8] p-7 text-center">
                      <FileText className="mx-auto mb-2 text-[#9A7A45]" />
                      <p className="text-sm font-semibold">Shared files</p>
                      <p className="mt-1 text-xs text-[#4A5568]">Pitch deck v3.pdf · Shared Oct 25 · Access logged</p>
                      <button type="button" onClick={() => notify('Vault picker opened.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                        Share from vault <Plus className="inline" size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg bg-[#FAF8F4] p-4">
                        <p className="text-xs"><b>Rhea</b> · Great progress on the interviews. Let’s look at pricing next.</p>
                        <p className="text-right text-xs"><b>You</b> · I’ll bring the revised model to our session.</p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input placeholder="Write a secure message…" className="h-10 flex-1 rounded-lg border border-[#E5E1D8] px-3 text-xs" />
                        <button type="button" onClick={() => notify('Message sent.')} className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-white">
                          <Send size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </Card>
              </div>

              <aside className="space-y-5">
                <Card title="Mentor">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F3EBDD] font-semibold">RM</span>
                    <div>
                      <b className="text-sm">{mentor.name}</b>
                      <p className="text-xs text-[#4A5568]">Verified · Go-to-market</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/startup/mentors/${id}/billing`} className="rounded-lg border border-[#E5E1D8] py-2 text-center text-xs font-semibold hover:bg-[#FAF8F4]">
                      Agreement & billing
                    </Link>
                    <button type="button" onClick={() => notify('Mentorship paused.')} className="rounded-lg border border-[#E5E1D8] py-2 text-xs">
                      Pause mentorship
                    </button>
                  </div>
                </Card>

                <Card title="Recent activity">
                  <p className="text-xs text-[#4A5568]">Rhea reviewed interview themes · 2 days ago</p>
                  <p className="mt-3 text-xs text-[#4A5568]">Session notes added · Oct 28</p>
                </Card>
              </aside>
            </div>
          </>
        )}

        {page === 'sessions' && (
          <>
            {head(
              'Sessions',
              'Book, join and review your mentor conversations.',
              <Btn onClick={() => setModal('book')}><Plus size={15} /> Book session</Btn>
            )}
            <div className="mb-5 flex gap-2">
              {['Upcoming', 'Past', 'Calendar'].map(x => (
                <button
                  onClick={() => setSessionTab(x)}
                  key={x}
                  type="button"
                  className={`min-h-10 rounded-lg px-4 text-xs ${sessionTab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            {sessionTab === 'Calendar' ? (
              <Card title="November 2026">
                <div className="grid grid-cols-7 gap-px bg-[#E5E1D8]">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', ...Array.from({ length: 35 }, (_, i) => String(i + 1))].map((x, i) => (
                    <div key={i} className={`min-h-16 bg-white p-2 text-xs ${i < 7 ? 'font-semibold text-[#4A5568]' : ''}`}>
                      {x}{i === 18 && <small className="mt-1 block rounded bg-[#F3EBDD] p-1 text-[9px]">Mentor session</small>}
                    </div>
                  ))}
                </div>
              </Card>
            ) : sessionTab === 'Upcoming' ? (
              <div className="space-y-3">
                {[
                  ['Nov 12 · 4:00 PM', 'Rhea Mukherjee', 'Go-to-market and pricing', '45 minutes', 'Confirmed', 'session-01'],
                  ['Nov 19 · 4:00 PM', 'Rhea Mukherjee', 'Unit economics review', '45 minutes', 'Scheduled', 'session-02'],
                ].map(([d, n, t, dur, s, sessId], i) => (
                  <article key={d} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E5E1D8] bg-white p-5">
                    <div className="rounded-lg bg-[#F3EBDD] p-3 text-center">
                      <CalendarDays className="mx-auto mb-1 text-[#806236]" size={18} />
                      <b className="text-xs">{d}</b>
                      <small className="mt-1 block text-[10px] text-[#4A5568]">Asia/Kolkata</small>
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <b className="text-sm">{t}</b>
                      <p className="mt-1 text-xs text-[#4A5568]">{n} · {dur}</p>
                      <span className="mt-2 inline-block rounded-full bg-[#E7F3EC] px-2 py-1 text-[10px] text-[#286749]">{s}</span>
                    </div>
                    <Link href={`/startup/sessions/${sessId}`} className="text-xs font-semibold text-[#9A7A45] hover:underline">
                      Details
                    </Link>
                    <button
                      type="button"
                      onClick={() => notify(i === 0 ? 'Join opens 10 minutes before the session.' : 'Reschedule request sent.')}
                      className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
                    >
                      {i === 0 ? 'Join session' : 'Reschedule'}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <Card title="Past sessions">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-xs">
                    <thead>
                      <tr className="border-b text-[#4A5568]">
                        <th className="py-3">Date</th>
                        <th>Mentor</th>
                        <th>Topic</th>
                        <th>Duration</th>
                        <th>Notes</th>
                        <th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Oct 28', 'Rhea Mukherjee', 'Customer interview synthesis', '45 min', 'Available', '5 stars'],
                        ['Oct 14', 'Rhea Mukherjee', 'Prototype test plan', '45 min', 'Available', '5 stars'],
                      ].map(r => (
                        <tr key={r[0]} className="border-b">
                          <td className="py-3">{r[0]}</td>
                          {r.slice(1).map((x, i) => (
                            <td key={i}>{x}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {page === 'session' && (
          <>
            {head(
              currentSession.title,
              currentSession.sub,
              <>
                <button type="button" onClick={() => notify('Join opens 10 minutes before session.')} className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                  <Video className="mr-2 inline" size={15} /> Join session
                </button>
                <button type="button" onClick={() => notify('Reschedule request sent.')} className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm">
                  Reschedule
                </button>
              </>
            )}
            <div className="mb-5 flex gap-2">
              {['Agenda', 'Notes', 'Files', 'Recording', 'Feedback'].map(x => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setTab(x)}
                  className={`min-h-10 rounded-lg px-4 text-xs ${tab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <Card title={tab}>
                  {tab === 'Agenda' ? (
                    <>
                      <p className="text-sm text-[#4A5568]">Shared agenda · add topics before the meeting.</p>
                      <ul className="mt-4 space-y-3">
                        {['Review interview insights', 'Discuss pricing options', 'Agree next experiments'].map((x, i) => (
                          <li key={x} className="flex items-center gap-3 rounded-lg bg-[#FAF8F4] p-3 text-sm">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#F3EBDD] text-xs">{i + 1}</span>
                            {x}
                          </li>
                        ))}
                      </ul>
                      <button type="button" onClick={() => notify('Agenda item added.')} className="mt-4 text-xs font-semibold text-[#9A7A45]">
                        + Add agenda item
                      </button>
                    </>
                  ) : tab === 'Notes' ? (
                    <>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={10}
                        placeholder="Capture decisions and action items…"
                        className="w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                      />
                      <button type="button" onClick={() => notify('Session notes saved.')} className="mt-3 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white">
                        Save notes
                      </button>
                    </>
                  ) : tab === 'Files' ? (
                    <button type="button" onClick={() => notify('Vault file picker opened.')} className="rounded-lg border border-dashed border-[#E5E1D8] p-6 text-xs">
                      Share a document for the session <Upload className="ml-2 inline" size={15} />
                    </button>
                  ) : tab === 'Recording' ? (
                    <p className="rounded-lg bg-[#FAF8F4] p-4 text-sm">Recording was off. No recording is stored.</p>
                  ) : (
                    <>
                      <p className="text-sm">How useful was this session?</p>
                      <div className="my-3 flex gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setProfileRating(n)}>
                            <Star size={24} className={n <= profileRating ? 'fill-[#B8955A] text-[#B8955A]' : 'text-[#A0A7B4]'} />
                          </button>
                        ))}
                      </div>
                      <textarea rows={4} placeholder="Share optional feedback" className="w-full rounded-lg border border-[#E5E1D8] p-3 text-sm" />
                      <button type="button" onClick={() => notify('Feedback submitted. Thank you.')} className="mt-3 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white">
                        Submit feedback
                      </button>
                    </>
                  )}
                </Card>
              </div>

              <aside className="space-y-5">
                <Card title="Session details">
                  <p className="text-xs"><b>Mentor:</b> {currentSession.mentor}</p>
                  <p className="mt-2 text-xs"><b>Attendees:</b> Aarav Kapoor, Priya Menon</p>
                  <p className="mt-2 text-xs"><b>Time zone:</b> Asia/Kolkata</p>
                  <p className="mt-4 rounded-lg bg-[#F3EBDD] p-3 text-xs">Recording is off unless both sides consent before starting.</p>
                </Card>

                <Card title="Readiness items discussed">
                  <p className="text-xs text-[#4A5568]">{currentSession.readinessItem}</p>
                  <button type="button" onClick={() => notify('Sign-off request sent to mentor.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                    Request sign-off <ArrowRight className="inline" size={12} />
                  </button>
                </Card>
              </aside>
            </div>
          </>
        )}

        {page === 'readiness' && (
          <>
            {head(
              'Investment readiness',
              'Mentor-reviewed evidence for your startup’s readiness journey.',
              <Link href="/startup/mentors/find" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold">
                Find a mentor
              </Link>
            )}

            {readinessPhase === 'loading' && (
              <div className="grid gap-3">
                {[0, 1, 2].map(k => (
                  <div key={k} className="h-28 animate-pulse rounded-xl border border-[#E5E1D8] bg-white" />
                ))}
                <p className="text-xs text-[#4A5568]">Loading your readiness checklist…</p>
              </div>
            )}

            {readinessPhase === 'error' && (
              <Card title="Could not load readiness">
                <p className="text-xs text-[#A33A3A]">{readinessError}</p>
                <button type="button" onClick={reloadReadiness} className="mt-3 rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold">
                  Try again
                </button>
              </Card>
            )}

            {readinessPhase === 'none' && (
              <Card title="No startup workspace yet">
                <p className="text-xs text-[#4A5568]">
                  Readiness is tracked per startup organization. Create your startup profile to start the checklist.
                </p>
                <Link href="/onboarding" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                  Set up your startup <ArrowRight className="inline" size={12} />
                </Link>
              </Card>
            )}

            {readinessPhase === 'ready' && readiness && (
              <>
                <div className="mb-5 grid gap-5 lg:grid-cols-3">
                  <Card title="Readiness score">
                    <div className="flex items-center gap-5">
                      <div
                        className="grid h-28 w-28 place-items-center rounded-full"
                        style={{ background: `conic-gradient(#B8955A 0deg ${Math.round((readiness.summary.readiness_pct / 100) * 360)}deg,#E5E1D8 ${Math.round((readiness.summary.readiness_pct / 100) * 360)}deg 360deg)` }}
                      >
                        <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-white">
                          <span className="serif text-3xl">{readiness.summary.readiness_pct}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#4A5568]">out of 100</p>
                        <p className="mt-2 text-xs font-semibold">
                          {readiness.summary.criteria_signed_off} of {readiness.summary.criteria_total} signed off
                        </p>
                        <p className="mt-1 text-xs text-[#4A5568]">The score is a guide. Sign-offs decide the badge.</p>
                      </div>
                    </div>
                  </Card>

                  <div className="lg:col-span-2">
                    {readiness.summary.is_ready ? (
                      <Card title="Investment Ready">
                        <div className="rounded-xl bg-[#F3EBDD] p-5">
                          <ShieldCheck size={24} className="text-[#9A7A45]" />
                          <h3 className="mt-2 serif text-xl font-semibold">Investment Ready</h3>
                          <p className="mt-1 text-xs text-[#4A5568]">
                            Earned with sign-off on every readiness item.
                          </p>
                          <Link href="/startup/profile" className="mt-4 inline-block rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                            Manage profile visibility
                          </Link>
                        </div>
                      </Card>
                    ) : (
                      <Card title="Badge status">
                        <div className="rounded-xl bg-[#FAF8F4] p-5">
                          <p className="font-semibold">Not yet earned</p>
                          <p className="mt-1 text-xs text-[#4A5568]">Complete all six reviewed items to receive the Investment Ready badge.</p>
                          <Link href="/startup/profile" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                            Manage profile visibility <ArrowRight className="inline" size={12} />
                          </Link>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>

                {(readinessFormErr || (readinessErrs.evidence && evidenceFor === null)) && (
                  <div className="mb-4 rounded-lg border border-[#F0C9C9] bg-[#FDECEC] p-3 text-xs text-[#A33A3A]" role="alert">
                    {readinessFormErr || readinessErrs.evidence}
                  </div>
                )}

                {readiness.items.length === 0 ? (
                  <Card title="Checklist">
                    <p className="text-xs text-[#4A5568]">
                      No readiness criteria are published yet. Your checklist appears here once they are.
                    </p>
                  </Card>
                ) : (
                  <div className="grid items-start gap-5 xl:grid-cols-3">
                    <div className="space-y-4 xl:col-span-2">
                      {readiness.items.map((item, i) => {
                        const chip = READINESS_CHIP[item.status] || READINESS_CHIP.not_started;
                        const signedOn = formatSignedOff(item.signed_off_at);
                        const editing = evidenceFor === item.criterion_id;
                        return (
                          <Card
                            key={item.criterion_id}
                            title={`${i + 1}. ${item.title}`}
                            action={
                              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${chip}`}>
                                {READINESS_LABEL[item.status] || item.status}
                              </span>
                            }
                          >
                            {item.description && (
                              <p className="text-xs leading-5 text-[#4A5568]">{item.description}</p>
                            )}

                            {editing ? (
                              <div className="mt-3">
                                <label htmlFor={`evidence-${item.criterion_id}`} className="text-xs font-semibold">
                                  Evidence
                                </label>
                                <textarea
                                  id={`evidence-${item.criterion_id}`}
                                  value={evidenceDraft}
                                  onChange={e => setEvidenceDraft(e.target.value)}
                                  rows={3}
                                  maxLength={2000}
                                  placeholder="Describe the evidence: what exists, where it lives, who reviewed it."
                                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${readinessErrs.evidence ? 'border-[#C95B5B]' : 'border-[#E5E1D8]'}`}
                                />
                                {readinessErrs.evidence && (
                                  <p className="mt-1 text-[10px] text-[#A33A3A]">{readinessErrs.evidence}</p>
                                )}
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={readinessBusy}
                                    onClick={() => saveEvidence(item)}
                                    className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                                  >
                                    {readinessBusy ? 'Saving…' : 'Save evidence'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setEvidenceFor(null); setReadinessErrs({}); }}
                                    className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 text-xs">
                                <FileText className="mr-1 inline text-[#9A7A45]" size={13} />
                                {item.evidence ? (
                                  <span className="text-[#0F1B2D]">{item.evidence}</span>
                                ) : (
                                  <span className="text-[#4A5568]">No evidence yet</span>
                                )}
                              </p>
                            )}

                            {item.status === 'rejected' && item.notes && (
                              <p className="mt-2 rounded-lg bg-[#FDECEC] p-2 text-[10px] leading-4 text-[#A33A3A]">
                                Changes requested: {item.notes}
                              </p>
                            )}

                            {item.status === 'not_started' && !editing && (
                              <div className="mt-3 flex gap-2">
                                {canEditReadiness ? (
                                  <button type="button" onClick={() => openEvidence(item)} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs">
                                    Add evidence
                                  </button>
                                ) : (
                                  <p className="text-xs text-[#4A5568]">Only the startup team can add evidence.</p>
                                )}
                              </div>
                            )}

                            {(item.status === 'in_progress' || item.status === 'rejected') && !editing && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {canEditReadiness ? (
                                  <>
                                    <button type="button" onClick={() => openEvidence(item)} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs">
                                      {/* A rejected item is reworked here, then re-submitted (5f D6). */}
                                      {item.status === 'rejected' ? 'Edit and resubmit' : 'Edit evidence'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={readinessBusy}
                                      onClick={() => submitItem(item)}
                                      className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                                    >
                                      Submit for sign-off
                                    </button>
                                  </>
                                ) : (
                                  <p className="text-xs text-[#4A5568]">Read-only: your workspace role cannot edit readiness items.</p>
                                )}
                              </div>
                            )}

                            {item.status === 'submitted' && (
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <p className="text-xs text-[#8A5700]">Waiting for platform review.</p>
                                {canEditReadiness && (
                                  <button
                                    type="button"
                                    disabled={readinessBusy}
                                    onClick={() => withdrawItem(item)}
                                    className="text-xs font-semibold text-[#9A7A45] disabled:opacity-40"
                                  >
                                    Withdraw
                                  </button>
                                )}
                              </div>
                            )}

                            {item.status === 'signed_off' && (
                              <p className="mt-3 text-xs text-[#286749]">
                                Signed off{signedOn ? ` · ${signedOn}` : ''}
                              </p>
                            )}
                          </Card>
                        );
                      })}
                    </div>

                    <aside className="space-y-5">
                      <Card title="Score breakdown">
                        <p className="text-xs leading-5 text-[#4A5568]">
                          Per-area scoring (checklist, traction, mentor feedback) arrives with mentor sign-off in Step 8.
                        </p>
                      </Card>

                      <Card title="Reviewers">
                        <p className="text-xs leading-5 text-[#4A5568]">
                          Readiness items are reviewed by the platform team today. Mentor review from your own mentorship
                          arrives in Step 8.
                        </p>
                        <Link href="/startup/mentors/find" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                          Find a mentor <ArrowRight className="inline" size={12} />
                        </Link>
                      </Card>
                    </aside>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {page === 'billing' && (
          <>
            {head(
              'Agreement & payments',
              'Review fees, terms and session invoices for this mentorship.',
              <Link href={`/startup/mentors/${id}`} className="text-sm text-[#9A7A45]">
                ← Workspace
              </Link>
            )}
            <div className="grid items-start gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <Card title="Mentorship agreement">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['Mentor', 'Rhea Mukherjee'],
                      ['Fee model', '₹3,000 per 45-minute session'],
                      ['Cadence', 'Fortnightly'],
                      ['Advisory / equity', 'None requested'],
                      ['Start date', 'Oct 21, 2026'],
                      ['Status', 'Accepted by both sides'],
                    ].map(([a, b]) => (
                      <div key={a} className="rounded-lg bg-[#FAF8F4] p-3">
                        <small className="text-xs text-[#4A5568]">{a}</small>
                        <b className="mt-1 block text-sm">{b}</b>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 rounded-lg bg-[#FFF8E8] p-3 text-xs leading-5 text-[#806236]">
                    Review equity or advisory terms with a lawyer. The platform records terms but does not give legal advice.
                  </p>
                  <button type="button" onClick={() => notify('Agreement change proposed to mentor.')} className="mt-4 rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold">
                    Propose change
                  </button>
                </Card>

                <Card title="Payments">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left text-xs">
                      <thead className="border-b text-[#4A5568]">
                        <tr>
                          {['Date', 'Session', 'Fee', 'Platform fee', 'Status', 'Receipt'].map(x => (
                            <th key={x} className="py-3">{x}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Oct 28', 'Customer interviews', '₹3,000', '₹300', 'Paid'],
                          ['Oct 14', 'Prototype test plan', '₹3,000', '₹300', 'Paid'],
                        ].map(r => (
                          <tr key={r[0]} className="border-b">
                            <td className="py-3">{r[0]}</td>
                            {r.slice(1).map((x, i) => (
                              <td key={i}>{x}</td>
                            ))}
                            <td>
                              <button type="button" onClick={() => notify('Receipt downloaded.')} aria-label="Download receipt">
                                <Download size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <aside className="space-y-5">
                <Card title="Session credits">
                  <p className="serif text-3xl">0 <small className="font-sans text-sm">credits</small></p>
                  <p className="mt-1 text-xs text-[#4A5568]">No package purchased</p>
                  <button type="button" onClick={() => notify('Packages are not available yet.')} className="mt-3 w-full rounded-lg bg-ink py-2.5 text-xs font-semibold text-white">
                    Buy a package
                  </button>
                </Card>

                <Card title="Payment method">
                  <p className="text-xs">UPI · ending in 42</p>
                  <button type="button" onClick={() => notify('Billing settings opened.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                    Manage payment method
                  </button>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold">
                {modal === 'match'
                  ? 'Find your mentor match'
                  : modal === 'request'
                  ? 'Request mentorship'
                  : modal === 'book'
                  ? 'Book a mentor session'
                  : 'Book intro call'}
              </h2>
              <button aria-label="Close" type="button" onClick={() => setModal('')}>
                <X size={18} />
              </button>
            </div>

            {modal === 'match' ? (
              <div className="space-y-4">
                <p className="text-sm text-[#4A5568]">
                  Tell us what you need. We’ll suggest mentors based on your stage and goals; you choose whether to contact them.
                </p>
                <label className="block text-sm">
                  Top needs
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Go-to-market and fundraising</option>
                    <option>Product and technology</option>
                    <option>Finance and operations</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Budget
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Up to ₹5,000 per session</option>
                    <option>Free / pro bono</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium">
                  Your mentorship goal
                  <textarea
                    required
                    minLength={20}
                    maxLength={500}
                    rows={4}
                    placeholder="What outcome would you like to work toward? (20–500 characters)"
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  Top needs
                  <input placeholder="e.g. pricing, customer research, fundraising" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Preferred cadence
                    <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                      <option>Fortnightly</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    Expected duration
                    <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                      <option>3 months</option>
                      <option>6 months</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  Message
                  <textarea rows={2} placeholder="Introduce your startup and context" className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm" />
                </label>
                <p className="rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                  Session fee and any proposed advisory terms will be confirmed before you accept. Shared documents are optional.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal('')} className="min-h-10 px-4 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modal === 'match') {
                    setModal('');
                    notify('Three recommended mentors found.');
                  } else {
                    setRequestSent(true);
                    setModal('');
                    notify('Mentorship request sent.');
                  }
                }}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
              >
                {modal === 'match' ? 'See matches' : modal === 'book' ? 'Confirm booking' : 'Send request'}
              </button>
            </div>
          </section>
        </div>
      )}

      {page === 'overview' && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5E1D8] bg-white p-3 lg:hidden">
          <Link href="/startup/mentors/find" className="block rounded-lg bg-ink py-3 text-center text-sm font-semibold text-white">
            Find a mentor
          </Link>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
