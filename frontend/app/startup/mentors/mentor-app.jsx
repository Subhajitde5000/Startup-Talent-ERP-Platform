'use client';
import {useState, useEffect} from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Compass,
  ListTodo,
  Users,
  FolderLock,
  Lightbulb,
  Briefcase,
  ChartNoAxesColumn,
  Settings,
  CircleHelp,
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
  Handshake
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
    why: 'Strong match for your Prototype stage and fundraising readiness goals.'
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
    why: 'Matches your MVP testing and early engineering team needs.'
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
    why: 'Your finance and readiness priorities align with her expertise.'
  }
];

const criteria = [
  'Pitch deck and one-page summary reviewed',
  'Business model and unit economics validated',
  'Financial projections and use of funds defined',
  'Cap table and legal basics in order',
  'Traction metrics documented',
  'Data room complete'
];

const nav = [
  ['Dashboard', LayoutDashboard, '/startup/dashboard'],
  ['Stage toolkit', Compass, '/startup/stage'],
  ['Tasks & milestones', ListTodo, '/startup/tasks'],
  ['Team', Users, '/startup/team'],
  ['Startup profile', Building2, '/startup/profile'],
  ['Data room', FolderLock, '/startup/data-room'],
  ['Mentors', Lightbulb, '/startup/mentors'],
  ['Investors', Briefcase, '/startup/investors'],
  ['Hiring', Briefcase, '/startup/hiring'],
  ['Analytics', ChartNoAxesColumn, '/startup/analytics']
];

function Btn({children, onClick, secondary = false, className = '', type = 'button', disabled = false}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8955A] disabled:opacity-50 ${
        secondary
          ? 'border border-[#E5E1D8] bg-white text-ink hover:bg-[#F4F1EA]'
          : 'bg-ink text-white hover:bg-[#1C2B42]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Card({title, children, action}) {
  return (
    <section className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,.04)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function MentorApp({page = 'overview', id = 'rhea'}) {
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

  // Controlled form state for mentorship request
  const [requestGoal, setRequestGoal] = useState('');
  const [requestNeeds, setRequestNeeds] = useState('');
  const [requestCadence, setRequestCadence] = useState('Fortnightly');
  const [requestDuration, setRequestDuration] = useState('3 months');
  const [requestMsg, setRequestMsg] = useState('');

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        setModal('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const notify = s => {
    setToast(s);
    setTimeout(() => setToast(''), 2800);
  };

  const mentor = mentors.find(m => m.id === id) || mentors[0];
  const approved = status.filter(s => s === 'Signed off').length;

  const head = (title, sub, action) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">
          Acme Studio <span className="mx-2 text-[#B8955A]">·</span> Mentorship
        </p>
        <h1 className="serif mt-1 text-[30px] font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-[#4A5568]">{sub}</p>
      </div>
      {action}
    </div>
  );

  const mentorCard = m => (
    <article key={m.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,.04)] transition hover:border-[#A0A7B4]">
      <div className="flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#F3EBDD] font-serif text-xl font-semibold text-[#806236]">
          {m.name.split(' ').map(x => x[0]).join('')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">{m.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
              <CheckCircle2 size={12} /> Verified mentor
            </span>
          </div>
          <p className="mt-1 text-xs text-[#4A5568]">{m.headline}</p>
          <p className="mt-1 text-xs text-ink font-medium">
            <Star className="mr-1 inline fill-[#B8955A] text-[#B8955A]" size={13} />
            {m.rating} <span className="text-[#4A5568] font-normal">({m.reviews} verified reviews)</span>
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-[#4A5568]">{m.why}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {m.expertise.map(t => (
          <span key={t} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
        <span className="text-xs text-ink">
          <b>{m.price}</b>
          <small className="ml-2 text-[#4A5568]">Next free: {m.next}</small>
        </span>
        <div className="flex gap-2">
          <Link
            href={`/startup/mentors/find/${m.id}`}
            className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
          >
            View profile
          </Link>
          <button
            type="button"
            onClick={() => {
              setModal('request');
              setTab(m.id);
            }}
            className="min-h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-white transition hover:bg-[#1C2B42]"
          >
            Request mentorship
          </button>
        </div>
      </div>
    </article>
  );

  const shell = (
    <>
      <a href="#mentor-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow-md">
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col bg-[#0F1B2D] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 font-serif text-lg">F</span>
          <span className="font-semibold tracking-wide">
            forma <small className="ml-1 font-normal text-white/70">WORKSPACE</small>
          </span>
        </div>

        <p className="px-6 pb-2 pt-5 text-xs font-semibold uppercase tracking-[.16em] text-white/70">Startup</p>

        <nav className="px-3">
          {nav.map(([n, Icon, url]) => (
            <Link
              href={url}
              key={n}
              className={`relative mb-1 flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8955A] ${
                n === 'Mentors' ? 'bg-[#1C2B42] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {n === 'Mentors' && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />}
              <Icon size={18} strokeWidth={1.7} className="shrink-0" />
              <span>{n}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-4 px-3 border-t border-white/10 pt-3">
          {[
            ['Overview', '/startup/mentors'],
            ['Find mentors', '/startup/mentors/find'],
            ['Requests', '/startup/mentors/requests'],
            ['Sessions', '/startup/sessions'],
            ['Readiness', '/startup/readiness']
          ].map(([n, u]) => (
            <Link
              href={u}
              key={n}
              className={`mb-1 block rounded-lg py-2 pl-3 text-xs font-medium transition ${
                (n === 'Overview' && page === 'overview') ||
                (n === 'Find mentors' && (page === 'find' || page === 'mentor-profile')) ||
                (n === 'Requests' && page === 'requests') ||
                (n === 'Sessions' && (page === 'sessions' || page === 'session')) ||
                (n === 'Readiness' && page === 'readiness')
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              {n}
            </Link>
          ))}
        </div>

        <div className="mt-auto space-y-1 px-3 pb-5">
          <Link href="/startup/profile" className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white">
            <Settings size={18} /> Settings
          </Link>
          <Link href="/help" className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white">
            <CircleHelp size={18} /> Help & support
          </Link>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 p-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-ink">AK</span>
            <span>
              <b className="block text-xs">Aarav Kapoor</b>
              <small className="text-white/60">Founder · switch role</small>
            </span>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur sm:px-7 lg:ml-[240px]">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-2.5 text-[#4A5568]" size={17} />
          <input
            placeholder="Search workspace"
            className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm text-ink outline-none transition focus:border-[#B8955A] focus:ring-1 focus:ring-[#B8955A]"
          />
        </div>
        <Link href="/startup/dashboard" className="text-sm font-semibold text-[#9A7A45] hover:underline sm:hidden">
          ← Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => notify('You’re all caught up.')}
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full text-[#4A5568] hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-[#B8955A]"
          >
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <span className="ml-2 flex items-center gap-2 text-xs">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">AK</span>
            <span className="hidden text-ink font-medium sm:block">Aarav Kapoor</span>
          </span>
        </div>
      </header>
    </>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      {shell}
      <main id="mentor-main" className="mx-auto max-w-[1440px] px-4 pb-24 pt-7 sm:px-7 lg:ml-[240px] lg:px-8">
        {page === 'overview' && (
          <>
            {head(
              'Mentors',
              'Find the right guidance and make meaningful progress toward readiness.',
              <Link
                href="/startup/mentors/find"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-[#1C2B42]"
              >
                <Search size={15} /> Find a mentor
              </Link>
            )}

            {requestSent && (
              <div className="mb-5 rounded-lg border border-[#E7D4B0] bg-[#F3EBDD] p-3.5 text-sm text-[#6B4F26]">
                Waiting for Rhea Mukherjee to respond. Mentors usually respond within 3 business days.
              </div>
            )}

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Active mentors', '1'],
                ['Sessions held', '9'],
                ['Deliverables due', '3'],
                ['Readiness', `${approved} / 6`]
              ].map(([n, v]) => (
                <div key={n} className="rounded-xl border border-[#E5E1D8] bg-white p-4 shadow-[0_1px_2px_rgba(15,27,45,.04)]">
                  <p className="text-xs text-[#4A5568]">{n}</p>
                  <b className="serif mt-1 block text-2xl text-ink">{v}</b>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                <Card
                  title="My mentors"
                  action={
                    <Link href="/startup/mentors/find" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                      Find another <ArrowRight className="inline" size={13} />
                    </Link>
                  }
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-[#F3EBDD] font-semibold text-ink">
                      RM
                    </span>
                    <div className="min-w-[160px] flex-1">
                      <h3 className="font-semibold text-ink">
                        Rhea Mukherjee{' '}
                        <span className="ml-1 rounded-full bg-[#F3EBDD] px-2 py-0.5 text-xs text-[#806236]">Verified</span>
                      </h3>
                      <p className="mt-1 text-xs text-[#4A5568]">Go-to-market · SaaS · 6 sessions held</p>
                      <p className="mt-1 text-xs text-[#4A5568]">Next session: Thu, Nov 12 at 4:00 PM</p>
                    </div>
                    <Link
                      href="/startup/mentors/mentorship-01"
                      className="rounded-lg bg-ink px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1C2B42]"
                    >
                      Open workspace
                    </Link>
                  </div>
                </Card>

                <Card
                  title="Readiness sign-off progress"
                  action={
                    <Link href="/startup/readiness" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                      Open readiness <ArrowRight className="inline" size={13} />
                    </Link>
                  }
                >
                  <div className="mb-4 flex items-center justify-between text-xs text-[#4A5568]">
                    <span>{approved} of 6 items signed off</span>
                    <b className="text-ink">{Math.round((approved / 6) * 100)}%</b>
                  </div>
                  <div className="mb-4 h-2 rounded-full bg-[#E5E1D8]">
                    <div className="h-full rounded-full bg-[#B8955A]" style={{width: `${(approved / 6) * 100}%`}} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {criteria.map((c, i) => (
                      <div key={c} className="flex items-center gap-2 rounded-lg bg-[#FAF8F4] p-2.5 text-xs">
                        <span className={status[i] === 'Signed off' ? 'text-[#2E7D5B]' : 'text-[#B7791F]'}>
                          {status[i] === 'Signed off' ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                        </span>
                        <span className="flex-1 text-ink">{c}</span>
                        <small className="text-[#4A5568]">{status[i]}</small>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card
                  title="Deliverables due"
                  action={
                    <Link href="/startup/tasks" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                      Open tasks
                    </Link>
                  }
                >
                  <div className="divide-y divide-[#E5E1D8]">
                    {[
                      ['Review customer interview themes', 'Nov 08', 'In progress'],
                      ['Update unit economics assumptions', 'Nov 12', 'To do'],
                      ['Prepare pitch story outline', 'Nov 15', 'To do']
                    ].map(([a, d, s]) => (
                      <div key={a} className="flex flex-wrap items-center gap-3 py-3">
                        <ClipboardCheck size={16} className="text-[#9A7A45]" />
                        <span className="flex-1 text-xs font-medium text-ink">
                          {a}
                          <small className="ml-2 text-[#4A5568]">Mentor</small>
                        </span>
                        <span className="text-xs text-[#4A5568]">Due {d}</span>
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#4A5568]">{s}</span>
                        <button
                          type="button"
                          onClick={() => notify('Deliverable submitted for mentor review.')}
                          className="text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
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
                  <h3 className="mt-2 font-semibold text-ink">Go-to-market and pricing</h3>
                  <p className="mt-1 text-xs text-[#4A5568]">Rhea Mukherjee · 45 minutes · Asia/Kolkata</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => notify('Join button becomes available 10 minutes before start.')}
                      className="flex-1 rounded-lg bg-ink py-2.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                    >
                      Join session
                    </button>
                    <button
                      type="button"
                      onClick={() => notify('Reschedule request sent to mentor.')}
                      className="rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      Reschedule
                    </button>
                  </div>
                </Card>

                <Card title="Open requests">
                  <p className="text-xs text-[#4A5568]">Your request to Arjun Mehta is awaiting a response.</p>
                  <span className="mt-2 inline-block rounded-full bg-[#FFF3D6] px-2.5 py-1 text-xs font-medium text-[#8A5700]">
                    Requested · 2 days ago
                  </span>
                  <Link href="/startup/mentors/requests" className="mt-3 block text-xs font-semibold text-[#9A7A45] hover:underline">
                    View requests <ArrowRight className="inline" size={13} />
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal('match')}
                  className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-sm font-semibold text-ink hover:bg-[#FAF8F4]"
                >
                  Auto-match me
                </button>
                <Link
                  href="/startup/mentors/requests"
                  className="inline-flex min-h-10 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-[#1C2B42]"
                >
                  My requests
                </Link>
              </div>
            )}

            <div className="mb-5 rounded-xl border border-[#E7D4B0] bg-[#F3EBDD] p-4 text-sm">
              <b className="text-ink">Recommended for Acme Studio</b>
              <p className="mt-1 text-xs text-[#4A5568]">
                Matched by stage, industry and your fundraising readiness goals. You choose whether to contact anyone.
              </p>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-4">
              <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,.04)]">
                <h2 className="font-semibold text-ink">Filters</h2>
                <label className="mt-4 block text-xs font-medium text-ink">
                  Expertise
                  <select
                    value={expertise}
                    onChange={e => setExpertise(e.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs text-ink"
                  >
                    <option>All expertise</option>
                    {['Fundraising', 'Product', 'Go-to-market', 'Finance', 'Hiring', 'Technology'].map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-xs font-medium text-ink">
                  Industry
                  <input placeholder="Fintech, SaaS…" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs text-ink" />
                </label>
                <label className="mt-4 block text-xs font-medium text-ink">
                  Stage fit
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs text-ink">
                    <option>Prototype</option>
                    <option>Idea</option>
                    <option>Early revenue</option>
                  </select>
                </label>
                <label className="mt-4 block text-xs font-medium text-ink">
                  Availability
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs text-ink">
                    <option>This month</option>
                    <option>This week</option>
                    <option>Any time</option>
                  </select>
                </label>
                <label className="mt-4 block text-xs font-medium text-ink">
                  Price
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs text-ink">
                    <option>Any price</option>
                    <option>Free / pro bono</option>
                    <option>Under ₹3,000 / hour</option>
                  </select>
                </label>
              </aside>

              <div className="space-y-4 lg:col-span-3">
                <div className="flex justify-between text-xs text-[#4A5568]">
                  <span>{mentors.filter(m => expertise === 'All expertise' || m.expertise.includes(expertise)).length} verified mentors match</span>
                  <select className="rounded border border-[#E5E1D8] bg-white px-2 py-1 text-xs text-ink">
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

        {page === 'requests' && (
          <>
            {head('Mentorship requests', 'Track requests and invitations in one place.', null)}
            <div className="mb-4 flex gap-2">
              {['Sent', 'Received', 'Past'].map(x => (
                <button
                  type="button"
                  key={x}
                  onClick={() => setRequestTab(x)}
                  className={`min-h-10 rounded-lg px-4 text-xs font-medium transition ${
                    requestTab === x ? 'bg-ink font-semibold text-white' : 'border border-[#E5E1D8] bg-white text-ink hover:bg-[#FAF8F4]'
                  }`}
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
                    ['Arjun Mehta', 'Support us with product architecture and hiring.', 'Waiting · 2 days', 'Nov 03']
                  ].map(([n, g, s, d], i) => (
                    <div key={n} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E1D8] p-4">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F3EBDD] font-semibold text-ink">
                        {n.split(' ').map(x => x[0]).join('')}
                      </span>
                      <span className="min-w-[180px] flex-1">
                        <b className="block text-sm text-ink">{n}</b>
                        <small className="text-xs text-[#4A5568]">{g}</small>
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${i ? 'bg-[#FFF3D6] text-[#8A5700]' : 'bg-[#E7F3EC] text-[#286749]'}`}>
                        {s}
                      </span>
                      <small className="text-xs text-[#4A5568]">{d}</small>
                      <button
                        type="button"
                        onClick={() => notify('Request withdrawn.')}
                        className="text-xs font-medium text-[#B42318] hover:underline"
                      >
                        Withdraw
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold text-ink">
                    {requestTab === 'Received' ? 'No invitations received yet.' : 'No past requests.'}
                  </p>
                  <p className="mt-1 text-xs text-[#4A5568]">Your requests will be listed here.</p>
                  <Link href="/startup/mentors/find" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline">
                    Find a mentor
                  </Link>
                </div>
              )}
            </Card>
          </>
        )}

        {page === 'readiness' && (
          <>
            {head(
              'Investment readiness',
              'Mentor-reviewed evidence for your startup’s readiness journey.',
              <Link href="/startup/mentors/find" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-sm font-semibold text-ink hover:bg-[#FAF8F4]">
                Find a mentor
              </Link>
            )}

            <div className="mb-5 grid gap-5 lg:grid-cols-3">
              <Card title="Readiness score">
                <div className="flex items-center gap-5">
                  <div className="grid h-28 w-28 place-items-center rounded-full" style={{background: 'conic-gradient(#B8955A 0deg 259deg,#E5E1D8 259deg 360deg)'}}>
                    <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-white">
                      <span className="serif text-3xl font-semibold text-ink">72</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#4A5568]">out of 100</p>
                    <p className="mt-2 text-xs font-semibold text-ink">{approved} of 6 signed off</p>
                    <p className="mt-1 text-xs text-[#4A5568]">The score is a guide. Sign-offs decide the badge.</p>
                  </div>
                </div>
              </Card>

              <div className="lg:col-span-2">
                <Card title="Badge status">
                  <div className="rounded-xl bg-[#FAF8F4] p-5 border border-[#E5E1D8]">
                    <p className="font-semibold text-ink">Investment Ready in progress</p>
                    <p className="mt-1 text-xs text-[#4A5568]">Complete all six reviewed items to receive the Investment Ready badge.</p>
                    <Link href="/startup/profile" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline">
                      Manage profile visibility <ArrowRight className="inline" size={12} />
                    </Link>
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                {criteria.map((c, i) => (
                  <Card
                    key={c}
                    title={`${i + 1}. ${c}`}
                    action={
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          status[i] === 'Signed off'
                            ? 'bg-[#E7F3EC] text-[#286749]'
                            : status[i] === 'Submitted for sign-off'
                            ? 'bg-[#FFF3D6] text-[#8A5700]'
                            : 'bg-[#F3F4F6] text-[#4A5568]'
                        }`}
                      >
                        {status[i]}
                      </span>
                    }
                  >
                    <p className="text-xs leading-5 text-[#4A5568]">
                      Done means this item is documented, current and supported by evidence that your mentor can review.
                    </p>
                    <p className="mt-3 text-xs text-ink font-medium">
                      <FileText className="mr-1 inline text-[#9A7A45]" size={13} />
                      Evidence: {i < 2 ? 'Pitch deck v3.pdf · linked' : 'No evidence attached yet'}
                    </p>
                    <p className="mt-2 text-xs text-[#4A5568]">Owner: Aarav Kapoor · Reviewer: Rhea Mukherjee</p>
                    {status[i] === 'In progress' || status[i] === 'Not started' ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => notify('Evidence picker opened.')}
                          className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                        >
                          Add evidence
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(status.map((s, n) => (n === i ? 'Submitted for sign-off' : s)))}
                          className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                        >
                          Submit for sign-off
                        </button>
                      </div>
                    ) : status[i] === 'Submitted for sign-off' ? (
                      <p className="mt-3 text-xs text-[#8A5700] font-medium">Waiting for mentor review · Rhea Mukherjee</p>
                    ) : (
                      <p className="mt-3 text-xs text-[#286749] font-medium">Signed off by Rhea Mukherjee · Nov 01</p>
                    )}
                  </Card>
                ))}
              </div>

              <aside className="space-y-5">
                <Card title="Score breakdown">
                  {[
                    ['Checklist completion', 80],
                    ['Traction data', 65],
                    ['Mentor feedback', 70]
                  ].map(([x, v]) => (
                    <div key={x} className="mb-4">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[#4A5568]">{x}</span>
                        <b className="text-ink">{v}%</b>
                      </div>
                      <div className="h-2 rounded-full bg-[#E5E1D8]">
                        <div className="h-full rounded-full bg-[#B8955A]" style={{width: `${v}%`}} />
                      </div>
                    </div>
                  ))}
                </Card>
              </aside>
            </div>
          </>
        )}

        {page === 'billing' && (
          <>
            {head(
              'Agreement & payments',
              'Review fees, terms and session invoices for this mentorship.',
              <Link href={`/startup/mentors/${id}`} className="text-sm font-semibold text-[#9A7A45] hover:underline">
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
                      ['Status', 'Accepted by both sides']
                    ].map(([a, b]) => (
                      <div key={a} className="rounded-lg bg-[#FAF8F4] p-3 border border-[#E5E1D8]">
                        <small className="text-xs text-[#4A5568]">{a}</small>
                        <b className="mt-1 block text-sm text-ink">{b}</b>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 rounded-lg bg-[#FFF8E8] p-3 text-xs leading-5 text-[#806236]">
                    Review equity or advisory terms with a lawyer. The platform records terms but does not give legal advice.
                  </p>
                </Card>

                <Card title="Payments">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left text-xs">
                      <thead className="border-b border-[#E5E1D8] text-[#4A5568]">
                        <tr>
                          {['Date', 'Session', 'Fee', 'Platform fee', 'Status', 'Receipt'].map(x => (
                            <th key={x} className="py-3">
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Oct 28', 'Customer interviews', '₹3,000', '₹300', 'Paid'],
                          ['Oct 14', 'Prototype test plan', '₹3,000', '₹300', 'Paid']
                        ].map(r => (
                          <tr key={r[0]} className="border-b border-[#E5E1D8]">
                            <td className="py-3 text-ink">{r[0]}</td>
                            {r.slice(1, 5).map((x, i) => (
                              <td key={i} className="py-3 text-[#4A5568]">
                                {x}
                              </td>
                            ))}
                            <td>
                              <button type="button" onClick={() => notify('Receipt downloaded.')} className="text-[#9A7A45] hover:text-ink">
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
                  <p className="serif text-3xl font-semibold text-ink">
                    0 <small className="font-sans text-sm text-[#4A5568]">credits</small>
                  </p>
                  <p className="mt-1 text-xs text-[#4A5568]">No package purchased</p>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Modals with client-side character count and validation */}
      {modal && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setModal('');
          }}
        >
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold text-ink">
                {modal === 'match'
                  ? 'Find your mentor match'
                  : modal === 'request'
                  ? 'Request mentorship'
                  : modal === 'book'
                  ? 'Book a mentor session'
                  : 'Book intro call'}
              </h2>
              <button type="button" aria-label="Close" onClick={() => setModal('')} className="text-[#4A5568] hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {modal === 'match' ? (
              <div className="space-y-4">
                <p className="text-sm text-[#4A5568]">
                  Tell us what you need. We’ll suggest mentors based on your stage and goals; you choose whether to contact them.
                </p>
                <label className="block text-sm font-medium text-ink">
                  Top needs
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm text-ink">
                    <option>Go-to-market and fundraising</option>
                    <option>Product and technology</option>
                    <option>Finance and operations</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-ink">
                  Budget
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm text-ink">
                    <option>Up to ₹5,000 per session</option>
                    <option>Free / pro bono</option>
                  </select>
                </label>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (requestGoal.length < 20) {
                    notify('Mentorship goal must be at least 20 characters.');
                    return;
                  }
                  setRequestSent(true);
                  setModal('');
                  notify('Mentorship request sent successfully.');
                }}
                className="space-y-4"
              >
                <label className="block text-sm font-medium text-ink">
                  Your mentorship goal
                  <textarea
                    required
                    minLength={20}
                    maxLength={500}
                    value={requestGoal}
                    onChange={e => setRequestGoal(e.target.value)}
                    rows={4}
                    placeholder="What outcome would you like to work toward? (20–500 characters)"
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm text-ink outline-none focus:border-[#B8955A] focus:ring-1 focus:ring-[#B8955A]"
                  />
                  <div className="mt-1 flex justify-between text-xs text-[#4A5568]">
                    <span>Minimum 20 characters</span>
                    <span className={requestGoal.length < 20 ? 'text-[#B42318]' : 'text-[#2E7D5B]'}>
                      {requestGoal.length}/500
                    </span>
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-ink">
                    Preferred cadence
                    <select
                      value={requestCadence}
                      onChange={e => setRequestCadence(e.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm text-ink"
                    >
                      <option>Fortnightly</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-ink">
                    Expected duration
                    <select
                      value={requestDuration}
                      onChange={e => setRequestDuration(e.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm text-ink"
                    >
                      <option>3 months</option>
                      <option>6 months</option>
                    </select>
                  </label>
                </div>

                <label className="block text-sm font-medium text-ink">
                  Message (optional)
                  <textarea
                    rows={2}
                    value={requestMsg}
                    onChange={e => setRequestMsg(e.target.value)}
                    placeholder="Introduce your startup and context"
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm text-ink outline-none focus:border-[#B8955A]"
                  />
                </label>

                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" onClick={() => setModal('')} className="min-h-10 px-4 text-sm font-medium text-[#4A5568]">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-[#1C2B42]"
                  >
                    Send request
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
