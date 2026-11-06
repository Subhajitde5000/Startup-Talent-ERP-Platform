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
  Eye,
  Trash2,
  Share2,
  Folder,
  ExternalLink,
  Video,
  Filter,
  BarChart3
} from 'lucide-react';

const investors = [
  {
    id: 'northstar',
    name: 'Northstar Capital',
    firm: 'Northstar Ventures',
    type: 'Early-stage fund',
    verified: 'KYC verified',
    focus: ['Pre-seed', 'Seed', 'Fintech', 'B2B SaaS'],
    ticket: '₹50L – ₹2 Cr',
    location: 'Mumbai, India',
    rating: 'Viewed your profile 2 days ago',
    fit: 'Invests in pre-seed fintech and SaaS teams.',
    initial: 'N',
    status: 'Shortlisted',
    stage: 'Interested',
    owner: 'Aarav Kapoor',
    note: 'Interested in early customer traction.'
  },
  {
    id: 'mira',
    name: 'Mira Shah',
    firm: 'Angel investor',
    type: 'Angel',
    verified: 'Identity verified',
    focus: ['Pre-seed', 'Fintech', 'SaaS'],
    ticket: '₹10L – ₹50L',
    location: 'Bengaluru, India',
    rating: 'Shortlisted yesterday',
    fit: 'Active in fintech with relevant operator experience.',
    initial: 'M',
    status: 'Intro requested',
    stage: 'Intro / Talking',
    owner: 'Priya Menon',
    note: 'Intro sent, awaiting reply.'
  },
  {
    id: 'seed-spring',
    name: 'SeedSpring Fund',
    firm: 'SeedSpring Capital',
    type: 'Fund',
    verified: 'KYC verified',
    focus: ['Seed', 'Fintech', 'B2B'],
    ticket: '₹1 Cr – ₹5 Cr',
    location: 'Delhi, India',
    rating: 'Viewed your profile 4 days ago',
    fit: 'Strong sector match; typically leads seed rounds.',
    initial: 'S',
    status: 'In talks',
    stage: 'Meeting held',
    owner: 'Aarav Kapoor',
    note: 'Meeting scheduled next week.'
  },
  {
    id: 'river',
    name: 'Riverbend Angels',
    firm: 'Angel group',
    type: 'Angel group',
    verified: 'KYC verified',
    focus: ['Pre-seed', 'SaaS', 'Climate'],
    ticket: '₹25L – ₹1 Cr',
    location: 'Remote, India',
    rating: 'Active this week',
    fit: 'Matches stage and ticket size.',
    initial: 'R',
    status: 'Viewed',
    stage: 'Interested',
    owner: 'Priya Menon',
    note: 'No recent outreach.'
  }
];

const columns = ['Interested', 'Intro / Talking', 'Meeting held', 'Data room', 'Offer', 'Committed'];

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

export default function InvestorApp({page = 'hub', id = 'northstar'}) {
  const [toast, setToast] = useState('');
  const [visible, setVisible] = useState(false);
  const [showAnyway, setShowAnyway] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [view, setView] = useState('Board');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState([]);
  const [modal, setModal] = useState('');
  const [investorStatus, setInvestorStatus] = useState(investors.map(x => x.stage));
  const [folder, setFolder] = useState('Pitch');
  const [accessTab, setAccessTab] = useState('Pending');
  const [meetingTab, setMeetingTab] = useState('Upcoming');
  const [roundTab, setRoundTab] = useState('Overview');
  const [messagesTab, setMessagesTab] = useState('Investors');
  const [files, setFiles] = useState([
    {name: 'Pitch deck v3.pdf', type: 'PDF', size: '4.2 MB', updated: 'Today', access: 'Per investor', views: 8},
    {name: 'Financial model.xlsx', type: 'XLSX', size: '1.8 MB', updated: 'Nov 02', access: 'Private', views: 3},
    {name: 'Product brief.pdf', type: 'PDF', size: '2.1 MB', updated: 'Oct 30', access: 'Public to approved investors', views: 12}
  ]);
  const [vis, setVis] = useState('Mentors and verified investors');
  const [toggles, setToggles] = useState({
    summary: true,
    traction: true,
    team: true,
    funding: false,
    round: false,
    readiness: true
  });
  const [roundStatus, setRoundStatus] = useState('Open');

  // Escape key handler for dialogs
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

  const inv = investors.find(x => x.id === id) || investors[0];

  const title =
    {
      hub: 'Investors',
      discover: 'Find investors',
      investor: inv.name,
      pipeline: 'Investor pipeline',
      'data-room': 'Data room',
      access: 'Access requests',
      messages: 'Messages',
      meetings: 'Meetings',
      rounds: 'Fundraising rounds',
      'round-detail': 'Pre-seed round',
      settings: 'Investor visibility'
    }[page] || 'Investors';

  const sub =
    {
      hub: 'See who is interested and keep your fundraising conversations moving.',
      discover: 'Find verified investors who fit your stage, sector and raise.',
      investor: `${inv.firm} · ${inv.type}`,
      pipeline: 'Track investor conversations from first interest to commitment.',
      'data-room': 'Share diligence documents with control and a clear audit trail.',
      access: 'Review requests to view confidential startup documents.',
      messages: 'Secure conversations with investors and your startup team.',
      meetings: 'Prepare for conversations and keep clear next steps.',
      rounds: 'Plan your raise and track offers through to close.',
      'round-detail': 'Track commitments, documents and closing progress.',
      settings: 'Control who can discover your startup and what they can see.'
    }[page] || '';

  const head = actions => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">
          Acme Studio <span className="mx-2 text-[#B8955A]">·</span> Investors
        </p>
        <h1 className="serif mt-1 text-[30px] font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-[#4A5568]">{sub}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  const disclaimer = (
    <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#4A5568]">
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#9A7A45]" />
      The platform introduces startups and investors. It is not a broker or adviser unless licensed. Get your own legal and financial advice.
    </p>
  );

  const visBanner = (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white p-3 text-xs text-ink shadow-xs">
      <span className={`h-2.5 w-2.5 rounded-full ${visible ? 'bg-[#2E7D5B]' : 'bg-[#A0A7B4]'}`} />
      <span>{visible ? 'Visible to verified investors' : 'Your profile is private. Investors can’t discover you.'}</span>
      <Link href="/startup/investors/settings" className="ml-auto font-semibold text-[#9A7A45] hover:underline">
        {visible ? 'Manage settings' : 'Change visibility'} <ArrowRight className="inline" size={12} />
      </Link>
    </div>
  );

  const readinessLocked = !showAnyway;

  const investorCard = x => (
    <article key={x.id} className="rounded-xl border border-[#E5E1D8] bg-white p-4 shadow-[0_1px_2px_rgba(15,27,45,.04)] transition hover:border-[#A0A7B4] sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-lg font-semibold text-[#806236]">
          {x.initial}
        </span>
        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/startup/investors/${x.id}`} className="font-semibold text-ink hover:underline">
              {x.name}
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
              <ShieldCheck size={12} /> {x.verified}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#4A5568]">
            {x.firm} · {x.type} · {x.location}
          </p>
          <p className="mt-1 text-xs text-ink">
            <b>Typical ticket:</b> {x.ticket}
          </p>
        </div>
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4A5568]">{x.status}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {x.focus.map(t => (
          <span key={t} className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
            {t}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-[#4A5568]">{x.fit}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
        <small className="text-xs text-[#4A5568]">{x.rating}</small>
        <div className="flex gap-2">
          <Link
            href={`/startup/investors/${x.id}`}
            className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
          >
            View profile
          </Link>
          <button
            type="button"
            onClick={() => setSaved(saved.includes(x.id) ? saved.filter(s => s !== x.id) : [...saved, x.id])}
            className="min-h-9 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
          >
            <Bookmark className="mr-1 inline" size={12} />
            {saved.includes(x.id) ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            disabled={readinessLocked}
            title={readinessLocked ? 'Complete readiness or choose Show me anyway first.' : ''}
            onClick={() => setModal(`intro-${x.id}`)}
            className="min-h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-white transition hover:bg-[#1C2B42] disabled:opacity-40"
          >
            Request intro
          </button>
        </div>
      </div>
    </article>
  );

  const shell = (
    <>
      <a href="#investor-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow-md">
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
          {nav.map(([n, Icon, u]) => (
            <Link
              href={u}
              key={n}
              className={`relative mb-1 flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8955A] ${
                n === 'Investors' ? 'bg-[#1C2B42] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {n === 'Investors' && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />}
              <Icon size={18} strokeWidth={1.7} className="shrink-0" />
              <span>{n}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-4 px-3 border-t border-white/10 pt-3">
          {[
            ['Hub', '/startup/investors'],
            ['Find investors', '/startup/investors/discover'],
            ['Pipeline', '/startup/investors/pipeline'],
            ['Data room', '/startup/data-room'],
            ['Access requests', '/startup/data-room/requests'],
            ['Messages', '/startup/messages'],
            ['Meetings', '/startup/meetings'],
            ['Rounds', '/startup/rounds'],
            ['Visibility settings', '/startup/investors/settings']
          ].map(([n, u]) => (
            <Link
              key={n}
              href={u}
              className={`mb-1 block rounded-lg py-2 pl-3 text-xs font-medium transition ${
                (n === 'Hub' && page === 'hub') ||
                (n === 'Find investors' && page === 'discover') ||
                (n === 'Pipeline' && page === 'pipeline') ||
                (n === 'Data room' && page === 'data-room') ||
                (n === 'Access requests' && page === 'access') ||
                (n === 'Messages' && page === 'messages') ||
                (n === 'Meetings' && page === 'meetings') ||
                (n === 'Rounds' && (page === 'rounds' || page === 'round-detail')) ||
                (n === 'Visibility settings' && page === 'settings')
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
      <main id="investor-main" className="mx-auto max-w-[1440px] px-4 pb-16 pt-7 sm:px-7 lg:ml-[240px] lg:px-8">
        {page === 'hub' && (
          <>
            {head(
              <Link
                href="/startup/investors/discover"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-[#1C2B42]"
              >
                <Search size={15} /> Find investors
              </Link>
            )}
            {visBanner}
            {!showAnyway && (
              <Card title="Prepare for investor conversations">
                <p className="mb-4 text-sm text-[#4A5568]">
                  Finish the essentials before you start reaching out. You can preview the hub while you prepare.
                </p>
                <div className="space-y-3">
                  {[
                    ['Earn the Investment Ready badge', '4 of 6 items signed off', '/startup/readiness'],
                    ['Complete your public profile', '78% complete', '/startup/profile'],
                    ['Prepare your data room', '3 items missing', '/startup/data-room'],
                    ['Choose investor visibility', visible ? 'Visible to verified investors' : 'Private', '/startup/investors/settings']
                  ].map(([x, y, u], i) => (
                    <Link key={x} href={u} className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3 hover:bg-[#FAF8F4]">
                      <span className={`grid h-7 w-7 place-items-center rounded-full ${i < 2 ? 'bg-[#E7F3EC] text-[#286749]' : 'bg-[#F3F4F6] text-[#4A5568]'}`}>
                        {i < 2 ? <Check size={15} /> : i + 1}
                      </span>
                      <span className="flex-1">
                        <b className="block text-xs text-ink">{x}</b>
                        <small className="text-xs text-[#4A5568]">{y}</small>
                      </span>
                      <ArrowRight size={14} className="text-[#4A5568]" />
                    </Link>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href="/startup/readiness" className="rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1C2B42]">
                    Continue preparing
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowAnyway(true)}
                    className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                  >
                    Show me anyway
                  </button>
                </div>
              </Card>
            )}

            {showAnyway && (
              <>
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ['Profile views', '46'],
                    ['Shortlisted by', '7'],
                    ['Conversations', '5'],
                    ['Meetings this month', '3'],
                    ['Data room visitors', '4']
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
                      title="Needs your reply"
                      action={
                        <Link href="/startup/messages" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                          Open inbox
                        </Link>
                      }
                    >
                      <div className="space-y-2">
                        {[
                          ['Mira Shah', 'Intro request · 1 day ago'],
                          ['Northstar Capital', 'Data room access request · 3 hours ago'],
                          ['SeedSpring Fund', 'Meeting invitation · yesterday']
                        ].map(([n, d]) => (
                          <div key={n} className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3">
                            <Mail className="text-[#9A7A45]" size={17} />
                            <span className="flex-1">
                              <b className="block text-xs text-ink">{n}</b>
                              <small className="text-xs text-[#4A5568]">{d}</small>
                            </span>
                            <button
                              type="button"
                              onClick={() => notify(`Opening ${n} conversation.`)}
                              className="text-xs font-semibold text-[#9A7A45] hover:underline"
                            >
                              Open <ArrowRight className="inline" size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card
                      title="Interested investors"
                      action={
                        <Link href="/startup/investors/pipeline" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                          View pipeline
                        </Link>
                      }
                    >
                      <div className="space-y-3">{investors.slice(0, 3).map(investorCard)}</div>
                    </Card>
                  </div>

                  <aside className="space-y-5">
                    <Card title="Round snapshot">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#4A5568]">Pre-seed target</span>
                        <b className="text-ink">₹2.5 Cr</b>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#E5E1D8]">
                        <div className="h-full w-[32%] rounded-full bg-[#B8955A]" />
                      </div>
                      <p className="mt-2 text-xs text-[#4A5568]">₹0.8 Cr committed · 32%</p>
                      <p className="mt-2 text-xs text-ink font-medium">3 investors in talks · closes Mar 31</p>
                      <Link href="/startup/rounds" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline">
                        View round <ArrowRight className="inline" size={12} />
                      </Link>
                    </Card>
                  </aside>
                </div>
                {disclaimer}
              </>
            )}
          </>
        )}

        {page === 'discover' && (
          <>
            {head(
              <Link href="/startup/investors/settings" className="rounded-lg border border-[#E5E1D8] bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]">
                Visibility settings
              </Link>
            )}
            {visBanner}
            <div className="grid items-start gap-5 lg:grid-cols-4">
              <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,.04)]">
                <h2 className="font-semibold text-ink">Investor filters</h2>
                {[
                  ['Type', ['Angel', 'Angel group', 'Fund']],
                  ['Stage focus', ['Pre-seed', 'Seed']],
                  ['Sector', ['Fintech', 'B2B SaaS', 'Climate']],
                  ['Ticket range', ['₹10L–₹50L', '₹50L–₹2 Cr']],
                  ['Location', ['India', 'Global']]
                ].map(([name, opts]) => (
                  <fieldset key={name} className="mt-4">
                    <legend className="text-xs font-semibold text-ink">{name}</legend>
                    {opts.map(o => (
                      <label key={o} className="mt-2 flex gap-2 text-xs text-[#4A5568]">
                        <input type="checkbox" className="h-4 w-4 accent-ink" />
                        {o}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </aside>

              <div className="space-y-4 lg:col-span-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-[#4A5568]" size={16} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search verified investors"
                    className="h-11 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-[#B8955A]"
                  />
                </div>
                {investors
                  .filter(x => !query || `${x.name} ${x.firm} ${x.focus.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
                  .map(investorCard)}
              </div>
            </div>
            {disclaimer}
          </>
        )}

        {page === 'investor' && (
          <>
            {head(
              <Link href="/startup/investors" className="text-sm font-semibold text-[#9A7A45] hover:underline">
                ← Back to Investor hub
              </Link>
            )}
            {visBanner}
            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                <Card title="Investor profile">
                  <div className="flex items-start gap-4">
                    <span className="grid h-16 w-16 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-2xl text-[#806236]">
                      {inv.initial}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-ink">{inv.name}</h2>
                      <p className="text-sm text-[#4A5568]">
                        {inv.firm} · {inv.type}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
                        <ShieldCheck size={12} /> {inv.verified}
                      </span>
                      <p className="mt-2 text-xs text-[#4A5568]">
                        {inv.location} · Typical ticket {inv.ticket}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {inv.focus.map(f => (
                      <span key={f} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
                        {f}
                      </span>
                    ))}
                  </div>
                </Card>
              </div>

              <aside className="space-y-5 xl:sticky xl:top-24">
                <Card title="Pipeline status">
                  <span className="rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs font-semibold text-[#806236]">{inv.status}</span>
                  <select
                    value={inv.stage}
                    onChange={e => {
                      setInvestorStatus(
                        investorStatus.map((s, i) => (i === investors.findIndex(v => v.id === inv.id) ? e.target.value : s))
                      );
                      notify('Investor stage updated.');
                    }}
                    className="mt-4 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs text-ink"
                  >
                    {columns.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Card>
              </aside>
            </div>
            {disclaimer}
          </>
        )}

        {/* Pipeline Board View with proper horizontal scroll container */}
        {page === 'pipeline' && (
          <>
            {head(
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setView('Board')}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    view === 'Board' ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white text-ink hover:bg-[#FAF8F4]'
                  }`}
                >
                  Board
                </button>
                <button
                  type="button"
                  onClick={() => setView('Table')}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    view === 'Table' ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white text-ink hover:bg-[#FAF8F4]'
                  }`}
                >
                  Table
                </button>
                <Btn onClick={() => setModal('add-investor')}>
                  <Plus size={15} /> Add investor
                </Btn>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search investors"
                className="h-10 min-w-[180px] flex-1 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm text-ink outline-none"
              />
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs text-ink"
              >
                <option>All</option>
                {columns.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            {view === 'Board' ? (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-[1200px]">
                  {columns.map(c => (
                    <section key={c} className="min-w-[240px] flex-1 rounded-xl bg-[#F4F1EA] p-3 shadow-inner border border-[#D6D0C5]">
                      <h2 className="mb-3 flex justify-between text-xs font-semibold text-ink">
                        <span>{c}</span>
                        <span className="text-[#4A5568]">{investors.filter(x => investorStatus[investors.indexOf(x)] === c).length}</span>
                      </h2>
                      {investors
                        .filter(
                          x =>
                            investorStatus[investors.indexOf(x)] === c &&
                            (filter === 'All' || filter === c) &&
                            (!query || x.name.toLowerCase().includes(query.toLowerCase()))
                        )
                        .map(x => (
                          <div key={x.id} className="mb-2.5 rounded-lg border border-[#E5E1D8] bg-white p-3 shadow-xs">
                            <Link href={`/startup/investors/${x.id}`} className="text-xs font-semibold text-ink hover:underline">
                              {x.name}
                            </Link>
                            <p className="mt-1 text-xs text-[#4A5568]">{x.ticket}</p>
                            <p className="mt-1.5 text-xs text-[#4A5568]">{x.note}</p>
                            <label className="mt-2 block text-xs text-[#4A5568]">
                              Move stage
                              <select
                                value={investorStatus[investors.indexOf(x)]}
                                onChange={e => {
                                  setInvestorStatus(
                                    investorStatus.map((v, i) => (i === investors.indexOf(x) ? e.target.value : v))
                                  );
                                  notify(`Moved ${x.name} to ${e.target.value}.`);
                                }}
                                className="mt-1 w-full rounded border border-[#E5E1D8] bg-white p-1 text-xs text-ink"
                              >
                                {[...columns, 'Passed / Declined'].map(y => (
                                  <option key={y}>{y}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ))}
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              <Card title="Investor pipeline">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="border-b border-[#E5E1D8] text-[#4A5568]">
                      <tr>
                        {['Investor', 'Status', 'Last activity', 'Owner', 'Ticket', 'Expected amount', 'Next step'].map(x => (
                          <th key={x} className="py-3">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {investors.map((x, i) => (
                        <tr key={x.id} className="border-b border-[#E5E1D8]">
                          <td className="py-3 font-semibold text-ink">
                            <Link href={`/startup/investors/${x.id}`} className="hover:underline">
                              {x.name}
                            </Link>
                          </td>
                          <td className="text-[#4A5568]">{investorStatus[i]}</td>
                          <td className="text-[#4A5568]">{x.rating}</td>
                          <td className="text-[#4A5568]">{x.owner}</td>
                          <td className="text-ink font-medium">{x.ticket}</td>
                          <td className="text-ink">{i === 2 ? '₹50L' : '—'}</td>
                          <td className="text-[#4A5568]">Follow up · Nov 12</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {disclaimer}
          </>
        )}
      </main>

      {/* Modal Dialog */}
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
                {modal.startsWith('intro') ? 'Request an introduction' : 'Add investor to pipeline'}
              </h2>
              <button type="button" onClick={() => setModal('')} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink">
                Investor or Firm Name
                <input placeholder="e.g. Nexus Venture Partners" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm text-ink outline-none" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal('')} className="min-h-10 px-4 text-sm font-medium text-[#4A5568]">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setModal('');
                  notify('Action completed.');
                }}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-[#1C2B42]"
              >
                Confirm
              </button>
            </div>
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
