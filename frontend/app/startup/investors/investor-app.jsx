'use client';
import { useState } from 'react';
import Link from 'next/link';
import { StartupSidebar, Btn, Card, SubNavTabs } from '../../../components';
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
  BarChart3,
  Menu
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
    note: 'Interested in early customer traction.',
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
    note: 'Intro sent, awaiting reply.',
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
    note: 'Meeting scheduled next week.',
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
    note: 'No recent outreach.',
  },
];

const columns = ['Interested', 'Intro / Talking', 'Meeting held', 'Data room', 'Offer', 'Committed'];

export default function InvestorApp({ page = 'hub', id = 'northstar' }) {
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
    { name: 'Pitch deck v3.pdf', type: 'PDF', size: '4.2 MB', updated: 'Today', access: 'Per investor', views: 8 },
    { name: 'Financial model.xlsx', type: 'XLSX', size: '1.8 MB', updated: 'Nov 02', access: 'Private', views: 3 },
    { name: 'Product brief.pdf', type: 'PDF', size: '2.1 MB', updated: 'Oct 30', access: 'Public to approved investors', views: 12 },
  ]);
  const [vis, setVis] = useState('Mentors and verified investors');
  const [toggles, setToggles] = useState({ summary: true, traction: true, team: true, funding: false, round: false, readiness: true });
  const [roundStatus, setRoundStatus] = useState('Open');
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(false);

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2800);
  };

  // Dynamic ID resolution supporting test IDs and semantic IDs
  const resolvedId = id === 'inv-1' ? 'northstar' : id === 'inv-2' ? 'mira' : id === 'inv-3' ? 'seed-spring' : id === 'inv-4' ? 'river' : id;
  const inv = investors.find(x => x.id === resolvedId || x.id === id) || investors[0];

  const title = {
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
    settings: 'Investor visibility',
  }[page] || 'Investors';

  const sub = {
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
    settings: 'Control who can discover your startup and what they can see.',
  }[page] || '';

  const head = (actions) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">Acme Studio <span className="mx-2 text-[#B8955A]">·</span> Investors</p>
        <h1 className="serif mt-1 text-[30px] font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[#4A5568]">{sub}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  const disclaimer = (
    <p className="mt-5 flex items-start gap-2 text-[10px] leading-4 text-[#4A5568]">
      <AlertCircle size={13} className="mt-0.5 shrink-0" />
      The platform introduces startups and investors. It is not a broker or adviser unless licensed. Get your own legal and financial advice.
    </p>
  );

  const visBanner = (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white p-3 text-xs">
      <span className={`h-2 w-2 rounded-full ${visible ? 'bg-[#B8955A]' : 'bg-[#A0A7B4]'}`} />
      {visible ? 'Visible to verified investors' : 'Your profile is private. Investors can’t find you.'}
      <Link href="/startup/investors/settings" className="ml-auto font-semibold text-[#9A7A45]">
        {visible ? 'Manage' : 'Change visibility'} <ArrowRight className="inline" size={12} />
      </Link>
    </div>
  );

  const readinessLocked = !showAnyway;

  const investorCard = (x) => (
    <article key={x.id} className="rounded-xl border border-[#E5E1D8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-lg font-semibold text-[#806236]">
          {x.initial}
        </span>
        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/startup/investors/${x.id}`} className="font-semibold hover:underline">
              {x.name}
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]">
              <ShieldCheck size={12} />{x.verified}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#4A5568]">{x.firm} · {x.type} · {x.location}</p>
          <p className="mt-1 text-xs"><b>Typical ticket:</b> {x.ticket}</p>
        </div>
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px] text-[#4A5568]">{x.status}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {x.focus.map(t => (
          <span key={t} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{t}</span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#4A5568]">{x.fit}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
        <small className="text-[10px] text-[#4A5568]">{x.rating}</small>
        <div className="flex gap-2">
          <Link href={`/startup/investors/${x.id}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">
            View profile
          </Link>
          <button
            type="button"
            onClick={() => setSaved(saved.includes(x.id) ? saved.filter(s => s !== x.id) : [...saved, x.id])}
            className="min-h-9 rounded-lg border border-[#E5E1D8] px-3 text-xs"
          >
            <Bookmark className="mr-1 inline" size={12} />
            {saved.includes(x.id) ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            disabled={readinessLocked}
            title={readinessLocked ? 'Complete readiness or choose Show me anyway first.' : ''}
            onClick={() => setModal(`intro-${x.id}`)}
            className="min-h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            Request intro
          </button>
        </div>
      </div>
    </article>
  );

  const isDataRoom = page === 'data-room' || page === 'access';

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#investor-main" className="sr-only focus:not-sr-only">Skip to content</a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active={isDataRoom ? 'Documents' : 'Investors'}
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

      <main id="investor-main" className={`mx-auto max-w-[1440px] px-4 pb-16 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {/* Secondary section navigation */}
        <SubNavTabs
          items={
            isDataRoom
              ? [
                  ['Documents & data room', '/startup/data-room', page === 'data-room'],
                  ['Access requests', '/startup/data-room/requests', page === 'access'],
                ]
              : [
                  ['Hub', '/startup/investors', page === 'hub'],
                  ['Find investors', '/startup/investors/discover', page === 'discover'],
                  ['Pipeline', '/startup/investors/pipeline', page === 'pipeline'],
                  ['Rounds', '/startup/rounds', page === 'rounds' || page === 'round-detail'],
                  ['Visibility settings', '/startup/investors/settings', page === 'settings'],
                ]
          }
        />
        {page === 'hub' && (
          <>
            {head(
              <Link href="/startup/investors/discover" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                <Search size={15} /> Find investors
              </Link>
            )}
            {visBanner}
            {!showAnyway && (
              <Card title="Prepare for investor conversations">
                <p className="mb-4 text-sm text-[#4A5568]">Finish the essentials before you start reaching out. You can preview the hub while you prepare.</p>
                <div className="space-y-3">
                  {[
                    ['Earn the Investment Ready badge', '4 of 6 items signed off', '/startup/readiness'],
                    ['Complete your public profile', '78% complete', '/startup/profile'],
                    ['Prepare your data room', '3 items missing', '/startup/data-room'],
                    ['Choose investor visibility', visible ? 'Visible to verified investors' : 'Private', '/startup/investors/settings'],
                  ].map(([x, y, u], i) => (
                    <Link key={x} href={u} className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3 hover:bg-[#FAF8F4]">
                      <span className={`grid h-7 w-7 place-items-center rounded-full ${i < 2 ? 'bg-[#E7F3EC] text-[#286749]' : 'bg-[#F3F4F6] text-[#4A5568]'}`}>
                        {i < 2 ? <Check size={15} /> : i + 1}
                      </span>
                      <span className="flex-1">
                        <b className="block text-xs">{x}</b>
                        <small className="text-[10px] text-[#4A5568]">{y}</small>
                      </span>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href="/startup/readiness" className="rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-white">
                    Continue preparing
                  </Link>
                  <button type="button" onClick={() => setShowAnyway(true)} className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2.5 text-xs font-semibold">
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
                    ['Data room visitors', '4'],
                  ].map(([n, v]) => (
                    <div key={n} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                      <p className="text-xs text-[#4A5568]">{n}</p>
                      <b className="serif mt-1 block text-2xl">{v}</b>
                    </div>
                  ))}
                </div>
                <div className="grid items-start gap-5 xl:grid-cols-3">
                  <div className="space-y-5 xl:col-span-2">
                    <Card title="Needs your reply" action={<Link href="/startup/messages" className="text-xs font-semibold text-[#9A7A45]">Open inbox</Link>}>
                      <div className="space-y-2">
                        {[
                          ['Mira Shah', 'Intro request · 1 day ago'],
                          ['Northstar Capital', 'Data room access request · 3 hours ago'],
                          ['SeedSpring Fund', 'Meeting invitation · yesterday'],
                        ].map(([n, d]) => (
                          <div key={n} className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3">
                            <Mail className="text-[#9A7A45]" size={17} />
                            <span className="flex-1">
                              <b className="block text-xs">{n}</b>
                              <small className="text-[10px] text-[#4A5568]">{d}</small>
                            </span>
                            <button type="button" onClick={() => notify(`Opening ${n} conversation.`)} className="text-xs font-semibold text-[#9A7A45]">
                              Open <ArrowRight className="inline" size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card title="Interested investors" action={<Link href="/startup/investors/pipeline" className="text-xs font-semibold text-[#9A7A45]">View pipeline</Link>}>
                      <div className="space-y-3">{investors.slice(0, 3).map(investorCard)}</div>
                    </Card>

                    <Card title="Investor interest trend">
                      <p className="mb-3 text-xs text-[#4A5568]">Profile views are trending up this month.</p>
                      <div className="flex h-32 items-end gap-3 border-b border-[#E5E1D8]">
                        {[32, 44, 38, 56, 70, 64, 90, 76, 100, 82, 94, 100].map((h, i) => (
                          <div key={i} className={`flex-1 rounded-t ${i === 11 ? 'bg-[#B8955A]' : 'bg-ink'}`} style={{ height: `${h}%` }} />
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] text-[#4A5568]">
                        <span>Oct 06</span>
                        <span>Nov 05</span>
                      </div>
                      <p className="mt-3 text-[10px] text-[#4A5568]">Demo interest activity · last 30 days</p>
                    </Card>
                  </div>

                  <aside className="space-y-5">
                    <Card title="Round snapshot">
                      <div className="flex justify-between text-xs">
                        <span>Pre-seed target</span>
                        <b>₹2.5 Cr</b>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#E5E1D8]">
                        <div className="h-full w-[32%] rounded-full bg-[#B8955A]" />
                      </div>
                      <p className="mt-2 text-xs text-[#4A5568]">₹0.8 Cr committed · 32%</p>
                      <p className="mt-2 text-xs">3 investors in talks · closes Mar 31</p>
                      <Link href="/startup/rounds" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                        View round <ArrowRight className="inline" size={12} />
                      </Link>
                    </Card>

                    <Card title="Upcoming meetings">
                      <p className="text-xs">
                        <b>SeedSpring Fund</b>
                        <small className="mt-1 block text-[#4A5568]">Nov 10 · 11:00 AM · Pitch</small>
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Link href="/startup/meetings" className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold">
                          Prepare
                        </Link>
                        <button type="button" onClick={() => notify('Join opens 10 minutes before meeting.')} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                          Join
                        </button>
                      </div>
                    </Card>

                    <Card title="Readiness">
                      <span className="rounded-full bg-[#FFF3D6] px-2 py-1 text-[10px] font-semibold text-[#8A5700]">Preparing · 4 of 6</span>
                      <p className="mt-3 text-xs leading-5 text-[#4A5568]">Financial projections were last updated 5 months ago. Refresh before sharing.</p>
                      <Link href="/startup/readiness" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                        Review readiness <ArrowRight className="inline" size={12} />
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
              <Link href="/startup/investors/settings" className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold">
                Visibility settings
              </Link>
            )}
            {visBanner}
            <div className="mb-5 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#806236]">
              {readinessLocked
                ? 'Browse investors in preparation mode. Intro requests unlock after you complete readiness or choose “Show me anyway” on the hub.'
                : 'Intro requests are limited to 5 per day. Investors decide whether to accept; no data room access is shared automatically.'}
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-4">
              <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                <h2 className="font-semibold">Investor filters</h2>
                {[
                  ['Type', ['Angel', 'Angel group', 'Fund']],
                  ['Stage focus', ['Pre-seed', 'Seed']],
                  ['Sector', ['Fintech', 'B2B SaaS', 'Climate']],
                  ['Ticket range', ['₹10L–₹50L', '₹50L–₹2 Cr']],
                  ['Location', ['India', 'Global']],
                ].map(([name, opts]) => (
                  <fieldset key={name} className="mt-4">
                    <legend className="text-xs font-semibold">{name}</legend>
                    {opts.map(o => (
                      <label key={o} className="mt-2 flex gap-2 text-xs text-[#4A5568]">
                        <input type="checkbox" className="accent-ink" />{o}
                      </label>
                    ))}
                  </fieldset>
                ))}
                <label className="mt-4 flex gap-2 text-xs">
                  <input type="checkbox" defaultChecked disabled />Verified only
                </label>
                <p className="mt-4 text-[10px] text-[#4A5568]">No filters on personal protected characteristics.</p>
              </aside>

              <div className="space-y-3 lg:col-span-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-[#A0A7B4]" size={16} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search verified investors"
                    className="h-11 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm"
                  />
                </div>
                <p className="text-xs text-[#4A5568]">Recommended for Acme Studio · Prototype · Fintech</p>
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
              <Link href="/startup/investors" className="text-sm text-[#9A7A45]">
                ← Investor hub
              </Link>
            )}
            {visBanner}
            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                <Card title="Investor profile">
                  <div className="flex items-start gap-4">
                    <span className="grid h-16 w-16 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-2xl">
                      {inv.initial}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold">{inv.name}</h2>
                      <p className="text-sm text-[#4A5568]">{inv.firm} · {inv.type}</p>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]">
                        <ShieldCheck size={12} />{inv.verified}
                      </span>
                      <p className="mt-2 text-xs text-[#4A5568]">{inv.location} · Typical ticket {inv.ticket}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {inv.focus.map(f => (
                      <span key={f} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px]">{f}</span>
                    ))}
                  </div>
                  <p className="mt-5 text-sm leading-6 text-[#4A5568]">
                    We partner with ambitious early-stage founders building differentiated products for underserved markets. We value thoughtful customer discovery, capital discipline and clear evidence of market demand.
                  </p>
                </Card>

                <Card title="Portfolio and track record">
                  <p className="text-sm">28 early-stage investments · Typical stage: Pre-seed to Seed</p>
                  <p className="mt-2 text-xs text-[#4A5568]">Selected portfolio details are shown by investor permission. Details are self-reported unless marked verified.</p>
                </Card>

                <Card title="Activity on your startup">
                  <div className="space-y-3">
                    {[
                      ['Viewed your profile', '2 days ago'],
                      ['Shortlisted Acme Studio', 'Yesterday'],
                      ['Opened public pitch summary', 'Yesterday'],
                    ].map(([x, d]) => (
                      <p key={x} className="flex items-center gap-3 text-xs">
                        <Eye size={14} className="text-[#9A7A45]" />{x}
                        <span className="ml-auto text-[#4A5568]">{d}</span>
                      </p>
                    ))}
                  </div>
                </Card>

                <Card title="Conversation">
                  <div className="rounded-lg bg-[#FAF8F4] p-4">
                    <p className="text-xs"><b>{inv.name}</b> · We’d like to learn more about your customer validation work.</p>
                    <small className="mt-1 block text-[10px] text-[#4A5568]">Yesterday · 3:20 PM</small>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input placeholder="Write a secure message…" className="h-10 flex-1 rounded-lg border border-[#E5E1D8] px-3 text-xs" />
                    <button type="button" onClick={() => notify('Secure message sent.')} className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-white">
                      <Send size={14} />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-[#4A5568]">Messages are secure and logged for audit.</p>
                </Card>

                <Card title="Private notes">
                  <textarea rows={4} placeholder="Notes for your team only; never shown to the investor." className="w-full rounded-lg border border-[#E5E1D8] p-3 text-sm" />
                  <button type="button" onClick={() => notify('Private note saved.')} className="mt-2 text-xs font-semibold text-[#9A7A45]">
                    Save note
                  </button>
                </Card>
              </div>

              <aside className="space-y-5 xl:sticky xl:top-24">
                <Card title="Pipeline status">
                  <span className="rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs font-semibold text-[#806236]">{inv.status}</span>
                  <select
                    value={inv.stage}
                    onChange={e => {
                      setInvestorStatus(investorStatus.map((s, i) => i === investors.findIndex(v => v.id === inv.id) ? e.target.value : s));
                      notify('Investor stage updated.');
                    }}
                    className="mt-4 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
                  >
                    {columns.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <div className="mt-4 space-y-2">
                    <button type="button" onClick={() => notify('Message composer opened.')} className="w-full rounded-lg bg-ink py-2.5 text-xs font-semibold text-white">
                      Message
                    </button>
                    <Link href="/startup/meetings" className="block text-center w-full rounded-lg border border-[#E5E1D8] py-2.5 text-xs font-semibold hover:bg-[#FAF8F4]">
                      Schedule meeting
                    </Link>
                    <Link href="/startup/data-room/requests" className="block text-center w-full rounded-lg border border-[#E5E1D8] py-2.5 text-xs font-semibold hover:bg-[#FAF8F4]">
                      Grant data room access
                    </Link>
                  </div>
                </Card>

                <Card title="Access summary">
                  <p className="text-xs text-[#4A5568]">Investor can view your public profile only. No documents shared.</p>
                  <Link href="/startup/data-room" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                    Manage access <ArrowRight className="inline" size={12} />
                  </Link>
                </Card>

                <Card title="Next step">
                  <input type="date" className="h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs" />
                  <input placeholder="Add a reminder note" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs" />
                  <button type="button" onClick={() => notify('Follow-up reminder saved.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                    Save reminder
                  </button>
                </Card>

                <button type="button" onClick={() => notify('Investor blocked from future contact.')} className="text-xs text-[#B42318]">
                  Block or report
                </button>
              </aside>
            </div>
            {disclaimer}
          </>
        )}

        {page === 'pipeline' && (
          <>
            {head(
              <div className="flex gap-2">
                <button type="button" onClick={() => setView('Board')} className={`rounded-lg px-3 py-2 text-xs ${view === 'Board' ? 'bg-ink text-white' : 'border bg-white'}`}>
                  Board
                </button>
                <button type="button" onClick={() => setView('Table')} className={`rounded-lg px-3 py-2 text-xs ${view === 'Table' ? 'bg-ink text-white' : 'border bg-white'}`}>
                  Table
                </button>
                <button type="button" onClick={() => setView('Funnel')} className={`rounded-lg px-3 py-2 text-xs ${view === 'Funnel' ? 'bg-ink text-white' : 'border bg-white'}`}>
                  Funnel
                </button>
                <Btn onClick={() => setModal('add-investor')}><Plus size={15} /> Add investor</Btn>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search investors"
                className="h-10 min-w-[180px] flex-1 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
              />
              <select value={filter} onChange={e => setFilter(e.target.value)} className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs">
                <option>All</option>
                {columns.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button type="button" onClick={() => notify('Pipeline exported as CSV.')} className="rounded-lg border bg-white px-3 py-2 text-xs">
                <Download className="mr-1 inline" size={13} />Export
              </button>
            </div>

            {view === 'Board' ? (
              <div className="grid gap-3 overflow-x-auto pb-3 md:grid-cols-2 2xl:grid-cols-6">
                {columns.map(c => (
                  <section key={c} className="min-w-[205px] rounded-xl bg-[#F4F1EA] p-3">
                    <h2 className="mb-3 flex justify-between text-xs font-semibold">
                      {c}<span className="text-[#4A5568]">{investors.filter(x => investorStatus[investors.indexOf(x)] === c).length}</span>
                    </h2>
                    {investors
                      .filter(x => investorStatus[investors.indexOf(x)] === c && (filter === 'All' || filter === c) && (!query || x.name.toLowerCase().includes(query.toLowerCase())))
                      .map(x => (
                        <Link href={`/startup/investors/${x.id}`} key={x.id} className="mb-2 block rounded-lg border border-[#E5E1D8] bg-white p-3 hover:border-[#A0A7B4]">
                          <b className="text-xs">{x.name}</b>
                          <p className="mt-1 text-[10px] text-[#4A5568]">{x.ticket}</p>
                          <p className="mt-2 text-[10px] text-[#4A5568]">{x.note}</p>
                          <select
                            value={investorStatus[investors.indexOf(x)]}
                            onClick={e => e.preventDefault()}
                            onChange={e => {
                              setInvestorStatus(investorStatus.map((v, i) => i === investors.indexOf(x) ? e.target.value : v));
                              notify(`Moved ${x.name} to ${e.target.value}.`);
                            }}
                            className="mt-2 w-full rounded border bg-white p-1 text-[10px]"
                          >
                            {[...columns, 'Passed / Declined'].map(y => (
                              <option key={y}>{y}</option>
                            ))}
                          </select>
                        </Link>
                      ))}
                  </section>
                ))}
              </div>
            ) : view === 'Table' ? (
              <Card title="Investor pipeline">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="border-b text-[#4A5568]">
                      <tr>
                        {['Investor', 'Status', 'Last activity', 'Owner', 'Ticket', 'Expected amount', 'Next step'].map(x => (
                          <th key={x} className="py-3">{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {investors.map((x, i) => (
                        <tr key={x.id} className="border-b">
                          <td className="py-3">
                            <Link href={`/startup/investors/${x.id}`} className="font-semibold hover:underline">
                              {x.name}
                            </Link>
                          </td>
                          <td>{investorStatus[i]}</td>
                          <td>{x.rating}</td>
                          <td>{x.owner}</td>
                          <td>{x.ticket}</td>
                          <td>{i === 2 ? '₹50L' : '—'}</td>
                          <td>Follow up · Nov 12</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <Card title="Fundraising funnel">
                  {columns.slice(0, 5).map((c, i) => (
                    <div key={c} className="mb-3 flex items-center gap-3 text-xs">
                      <span className="w-28">{c}</span>
                      <div className="h-3 flex-1 rounded bg-[#E5E1D8]">
                        <div className="h-full rounded bg-ink" style={{ width: `${[100, 70, 45, 25, 15][i]}%` }} />
                      </div>
                      <b>{[12, 8, 5, 3, 1][i]}</b>
                      <small className="w-10 text-right text-[#4A5568]">{i ? `${[0, 67, 63, 60, 33][i]}%` : ''}</small>
                    </div>
                  ))}
                </Card>
                <Card title="Expected raise vs target">
                  <p className="text-sm">Target: <b>₹2.5 Cr</b></p>
                  <div className="mt-4 flex h-5 overflow-hidden rounded-full">
                    <span className="w-[32%] bg-ink" />
                    <span className="w-[28%] bg-[#B8955A]" />
                    <span className="w-[20%] bg-[#A0A7B4]" />
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    <p>Committed · ₹0.8 Cr</p>
                    <p>Probable · ₹0.7 Cr</p>
                    <p>Possible · ₹0.5 Cr</p>
                  </div>
                </Card>
              </div>
            )}
            {disclaimer}
          </>
        )}

        {page === 'data-room' && (
          <>
            {head(
              <div className="flex gap-2">
                <Btn secondary onClick={() => notify('Investor preview opened.')}><Eye size={15} /> Preview as investor</Btn>
                <Btn onClick={() => setModal('upload')}><Upload size={15} /> Upload</Btn>
              </div>
            )}
            <div className="mb-5 rounded-xl border border-[#E5E1D8] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <b className="text-sm">Data room completeness · 76%</b>
                  <p className="mt-1 text-xs text-[#4A5568]">3 checklist items missing · NDA required before protected documents open</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => notify('Watermark and NDA settings opened.')} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs">
                    Settings
                  </button>
                  <Link href="/startup/data-room/requests" className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                    Access requests
                  </Link>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[#E5E1D8]">
                <div className="h-full w-[76%] rounded-full bg-[#B8955A]" />
              </div>
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-4">
              <aside className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold">Folders</h2>
                {['Corporate', 'Financials', 'Legal', 'Product', 'Team', 'Customers', 'Pitch'].map(x => (
                  <button
                    type="button"
                    onClick={() => setFolder(x)}
                    key={x}
                    className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${
                      folder === x ? 'bg-[#F3EBDD] font-semibold text-[#806236]' : 'hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <Folder size={15} />{x}
                    <span className="ml-auto text-[10px] text-[#4A5568]">{x === 'Pitch' ? 2 : x === 'Financials' ? 1 : 0}</span>
                  </button>
                ))}
              </aside>

              <div className="xl:col-span-3">
                <Card
                  title={`${folder} documents`}
                  action={
                    <button type="button" onClick={() => notify('New folder created.')} className="text-xs font-semibold text-[#9A7A45]">
                      + New folder
                    </button>
                  }
                >
                  <div className="mb-3 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                    <LockKeyhole className="mr-1 inline" size={13} />
                    View-only by default · watermark on · investors must sign NDA before opening restricted files.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-xs">
                      <thead className="border-b text-[#4A5568]">
                        <tr>
                          {['Name', 'Size', 'Updated', 'Access', 'Views', ''].map(x => (
                            <th key={x} className="py-3">{x}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {files.map((f, i) => (
                          <tr key={f.name} className="border-b border-[#E5E1D8]">
                            <td className="py-3">
                              <FileText className="mr-2 inline text-[#9A7A45]" size={15} />{f.name}
                            </td>
                            <td>{f.size}</td>
                            <td>{f.updated}</td>
                            <td>
                              <select
                                value={f.access}
                                onChange={e => setFiles(files.map((x, j) => j === i ? { ...x, access: e.target.value } : x))}
                                className="rounded border bg-white px-2 py-1"
                              >
                                <option>Private</option>
                                <option>Per investor</option>
                                <option>Public to approved investors</option>
                              </select>
                            </td>
                            <td>{f.views}</td>
                            <td>
                              <button type="button" onClick={() => notify(`Previewing ${f.name}; access logged.`)} className="text-[#9A7A45]">
                                Preview
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {[
                      ['Cap table', 'Missing'],
                      ['Financial projections', 'Missing'],
                      ['Pitch deck', 'Uploaded'],
                    ].map(([a, b]) => (
                      <button key={a} type="button" onClick={() => notify(`${a} upload selected.`)} className="rounded-lg border border-dashed border-[#E5E1D8] p-3 text-left text-xs">
                        <b>{a}</b>
                        <small className="mt-1 block text-[#4A5568]">{b}</small>
                      </button>
                    ))}
                  </div>
                </Card>

                <Card title="Access log">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[550px] text-left text-xs">
                      <thead className="border-b text-[#4A5568]">
                        <tr>
                          {['Investor', 'Document', 'Action', 'Time', 'Duration'].map(x => (
                            <th key={x} className="py-2">{x}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Northstar Capital', 'Pitch deck v3.pdf', 'Viewed', 'Today · 10:20', '4m'],
                          ['SeedSpring Fund', 'Product brief.pdf', 'Viewed', 'Nov 02 · 14:42', '3m'],
                          ['Mira Shah', 'Pitch deck v3.pdf', 'Viewed', 'Nov 01 · 09:12', '7m'],
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
                  <button type="button" onClick={() => notify('Audit log exported.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                    Export audit log <Download className="inline" size={13} />
                  </button>
                </Card>
              </div>
            </div>
            {disclaimer}
          </>
        )}

        {page === 'access' && (
          <>
            {head(null)}
            <div className="mb-4 flex gap-2">
              {['Pending', 'Approved', 'Declined'].map(x => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setAccessTab(x)}
                  className={`min-h-10 rounded-lg px-4 text-xs ${accessTab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
                >
                  {x}
                </button>
              ))}
            </div>
            <Card title={`${accessTab} data room requests`}>
              {accessTab === 'Pending' ? (
                <div className="space-y-3">
                  {[
                    ['Northstar Capital', 'Pitch, Financials', 'We are evaluating your seed round and would like to review your projections.', 'Signed NDA · 2 hours ago'],
                    ['Mira Shah', 'Pitch', 'Interested in learning more about your customer validation.', 'NDA pending · 1 day ago'],
                  ].map(([n, s, m, d]) => (
                    <article key={n} className="rounded-xl border border-[#E5E1D8] p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#F3EBDD] font-semibold">{n[0]}</span>
                        <div className="flex-1">
                          <b className="text-sm">{n}</b>
                          <p className="mt-1 text-xs text-[#4A5568]">Requested scope: {s}</p>
                          <p className="mt-2 text-xs">“{m}”</p>
                          <small className="mt-2 block text-[10px] text-[#4A5568]">{d} · Verified investor</small>
                        </div>
                        <span className="rounded-full bg-[#FFF3D6] px-2 py-1 text-[10px] text-[#8A5700]">Pending</span>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#E5E1D8] pt-3">
                        <button type="button" onClick={() => notify('Question sent to investor.')} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs">
                          Ask a question
                        </button>
                        <button type="button" onClick={() => notify('Request declined.')} className="rounded-lg px-3 py-2 text-xs text-[#B42318]">
                          Decline
                        </button>
                        <button type="button" onClick={() => setModal(`grant-${n}`)} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                          Approve with scope
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[#4A5568]">No {accessTab.toLowerCase()} requests yet.</p>
              )}
            </Card>
            {disclaimer}
          </>
        )}

        {page === 'messages' && (
          <>
            {head(null)}
            <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-[#E5E1D8] bg-white md:grid-cols-[240px_1fr_250px]">
              <aside className="border-b border-[#E5E1D8] p-4 md:border-b-0 md:border-r">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search conversations"
                  className="h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                />
                <div className="mt-3 flex flex-wrap gap-1">
                  {['Investors', 'Mentors', 'Candidates', 'Unread'].map(x => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setMessagesTab(x)}
                      className={`rounded-full px-2 py-1 text-[10px] ${messagesTab === x ? 'bg-ink text-white' : 'bg-[#F3F4F6]'}`}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                {investors.map(x => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setTab(x.id)}
                    className={`mt-3 flex w-full items-center gap-2 rounded-lg p-2 text-left ${tab === x.id ? 'bg-[#F3EBDD]' : ''}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-xs">{x.initial}</span>
                    <span>
                      <b className="block text-xs">{x.name}</b>
                      <small className="text-[10px] text-[#4A5568]">{x.status}</small>
                    </span>
                  </button>
                ))}
              </aside>

              <section className="flex min-h-[500px] flex-col">
                <div className="border-b border-[#E5E1D8] p-4">
                  <b className="text-sm">{investors.find(x => x.id === tab)?.name || 'Northstar Capital'}</b>
                  <small className="ml-2 text-xs text-[#4A5568]">{investors.find(x => x.id === tab)?.status}</small>
                </div>
                <div className="flex-1 space-y-4 bg-[#FAF8F4] p-5">
                  <p className="mx-auto max-w-xs rounded-lg bg-white p-3 text-xs">
                    Northstar Capital: Thanks for sharing the overview. Could you share your latest customer validation summary?
                  </p>
                  <p className="ml-auto max-w-xs rounded-lg bg-[#F3EBDD] p-3 text-xs">
                    Aarav: Absolutely. I’ll share the updated summary through the data room.
                  </p>
                  <p className="mx-auto text-center text-[10px] text-[#4A5568]">System · NDA signed · 2 hours ago</p>
                </div>
                <div className="border-t border-[#E5E1D8] p-3">
                  <div className="flex gap-2">
                    <input placeholder="Write a secure message…" className="h-11 flex-1 rounded-lg border border-[#E5E1D8] px-3 text-xs" />
                    <button type="button" onClick={() => notify('Secure message sent.')} className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-white">
                      <Send size={15} />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-[#4A5568]">Messages are secure and logged for audit. No off-platform payment solicitations.</p>
                </div>
              </section>

              <aside className="hidden border-l border-[#E5E1D8] p-4 md:block">
                <b className="text-xs">Investor details</b>
                <p className="mt-3 text-xs">Northstar Capital</p>
                <p className="mt-1 text-[10px] text-[#4A5568]">Verified · Seed fund</p>
                <div className="mt-4 space-y-2">
                  <Link href="/startup/meetings" className="block text-center w-full rounded-lg border border-[#E5E1D8] py-2 text-xs font-semibold hover:bg-[#FAF8F4]">
                    Schedule meeting
                  </Link>
                  <Link href="/startup/data-room/requests" className="block text-center w-full rounded-lg border border-[#E5E1D8] py-2 text-xs font-semibold hover:bg-[#FAF8F4]">
                    Grant access
                  </Link>
                  <button type="button" onClick={() => notify('Investor marked as passed.')} className="w-full rounded-lg border border-[#E5E1D8] py-2 text-xs">
                    Mark as passed
                  </button>
                </div>
              </aside>
            </div>
            {disclaimer}
          </>
        )}

        {page === 'meetings' && (
          <>
            {head(
              <Btn onClick={() => setModal('meeting')}><Plus size={15} /> Schedule meeting</Btn>
            )}
            <div className="mb-4 flex gap-2">
              {['Upcoming', 'Requests', 'Past', 'Calendar'].map(x => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setMeetingTab(x)}
                  className={`min-h-10 rounded-lg px-4 text-xs ${meetingTab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            {meetingTab === 'Calendar' ? (
              <Card title="November 2026">
                <div className="grid grid-cols-7 gap-px bg-[#E5E1D8]">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', ...Array.from({ length: 35 }, (_, i) => String(i + 1))].map((x, i) => (
                    <div key={i} className={`min-h-16 bg-white p-2 text-xs ${i < 7 ? 'font-semibold text-[#4A5568]' : ''}`}>
                      {x}{i === 9 && <small className="mt-1 block rounded bg-[#F3EBDD] p-1 text-[9px]">Investor pitch</small>}
                    </div>
                  ))}
                </div>
              </Card>
            ) : meetingTab === 'Requests' ? (
              <Card title="Meeting requests">
                <div className="space-y-3">
                  {[
                    ['SeedSpring Fund', 'Pitch meeting', 'Nov 10 · 11:00 AM or Nov 11 · 2:00 PM'],
                    ['Mira Shah', 'Intro call', 'Nov 13 · 10:00 AM'],
                  ].map(([n, t, d]) => (
                    <div key={n} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E1D8] p-4">
                      <CalendarDays size={17} className="text-[#9A7A45]" />
                      <span className="flex-1">
                        <b className="block text-sm">{n} · {t}</b>
                        <small className="text-xs text-[#4A5568]">Proposed: {d}</small>
                      </span>
                      <button type="button" onClick={() => notify('Meeting time accepted.')} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                        Accept
                      </button>
                      <button type="button" onClick={() => notify('Alternative time proposed.')} className="rounded-lg border px-3 py-2 text-xs">
                        Propose another
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {[
                  ['Nov 10 · 11:00 AM', 'SeedSpring Fund', 'Pitch meeting', '45 min · Confirmed'],
                  ['Nov 13 · 2:30 PM', 'Northstar Capital', 'Diligence follow-up', '30 min · Scheduled'],
                  ['Nov 18 · 10:00 AM', 'Mira Shah', 'Intro call', '30 min · Confirmed'],
                ].map(([d, n, t, s], i) => (
                  <article key={d} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
                    <div className="rounded-lg bg-[#F3EBDD] p-3 text-center">
                      <CalendarDays className="mx-auto mb-1 text-[#806236]" size={18} />
                      <b className="text-xs">{d}</b>
                      <small className="block text-[10px] text-[#4A5568]">Asia/Kolkata</small>
                    </div>
                    <span className="flex-1">
                      <b className="text-sm">{n}</b>
                      <small className="mt-1 block text-xs text-[#4A5568]">{t} · {s}</small>
                    </span>
                    <button type="button" onClick={() => notify('Meeting prep opened.')} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs">
                      Prepare
                    </button>
                    <button type="button" onClick={() => notify(i === 0 ? 'Join opens 10 minutes before start.' : 'Meeting details opened.')} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                      {i === 0 ? 'Join' : 'Details'}
                    </button>
                  </article>
                ))}
              </div>
            )}
            {disclaimer}
          </>
        )}

        {page === 'rounds' && (
          <>
            {head(
              <Btn onClick={() => setModal('round')}><Plus size={15} /> New round</Btn>
            )}
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                <Card title="Pre-seed round" action={<span className="rounded-full bg-[#E7F3EC] px-2 py-1 text-[10px] font-semibold text-[#286749]">{roundStatus}</span>}>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['Target', '₹2.5 Cr'],
                      ['Committed', '₹0.8 Cr'],
                      ['Remaining', '₹1.7 Cr'],
                      ['Investors', '3'],
                    ].map(([n, v]) => (
                      <div key={n} className="rounded-lg bg-[#FAF8F4] p-3">
                        <small className="text-xs text-[#4A5568]">{n}</small>
                        <b className="serif mt-1 block text-xl">{v}</b>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-[#E5E1D8]">
                    <div className="h-full w-[32%] rounded-full bg-[#B8955A]" />
                  </div>
                  <div className="mt-4 flex flex-wrap justify-between gap-3">
                    <span className="text-xs text-[#4A5568]">Pre-seed · Equity · Closing target Mar 31, 2027</span>
                    <Link href="/startup/rounds/round-preseed" className="text-xs font-semibold text-[#9A7A45]">
                      Open round <ArrowRight className="inline" size={12} />
                    </Link>
                  </div>
                </Card>

                <Card title="Round milestones">
                  <div className="space-y-4">
                    {[
                      ['Round opened', 'Oct 10 · Complete'],
                      ['First commitment', 'Oct 28 · Complete'],
                      ['Lead investor', 'In progress'],
                      ['Term sheet signed', 'Upcoming'],
                      ['Closing', 'Mar 31, 2027'],
                    ].map(([x, y], i) => (
                      <p key={x} className="flex items-center gap-3 text-xs">
                        <span className={`grid h-6 w-6 place-items-center rounded-full ${i < 2 ? 'bg-ink text-white' : 'bg-[#F3F4F6] text-[#4A5568]'}`}>
                          {i < 2 ? <Check size={13} /> : i + 1}
                        </span>
                        <b>{x}</b>
                        <span className="ml-auto text-[#4A5568]">{y}</span>
                      </p>
                    ))}
                  </div>
                </Card>
              </div>

              <aside>
                <Card title="Getting started">
                  <p className="text-xs leading-5 text-[#4A5568]">Set round terms, prepare your data room, connect with investors, record offers and close with your counsel.</p>
                  <button type="button" onClick={() => notify('Round guide opened.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                    Read round guide <ArrowRight className="inline" size={12} />
                  </button>
                </Card>
              </aside>
            </div>
            {disclaimer}
          </>
        )}

        {page === 'round-detail' && (
          <>
            {head(
              <div className="flex gap-2">
                <Btn secondary onClick={() => notify('Round summary exported.')}><Download size={14} /> Export summary</Btn>
                <Btn onClick={() => setRoundStatus(roundStatus === 'Closed' ? 'Open' : 'Closed')}>
                  {roundStatus === 'Closed' ? 'Reopen' : 'Close round'}
                </Btn>
              </div>
            )}
            <div className="mb-5 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <div className="flex justify-between text-sm">
                <b>Raised ₹0.8 Cr of ₹2.5 Cr</b>
                <span>Closes Mar 31, 2027</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-[#E5E1D8]">
                <div className="h-full w-[32%] rounded-full bg-[#B8955A]" />
              </div>
              <p className="mt-2 text-xs text-[#4A5568]">32% committed · 3 investors · Average ticket ₹26.7L</p>
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto">
              {['Overview', 'Offers and commitments', 'Term sheets', 'Cap table impact', 'Documents', 'Activity'].map(x => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setRoundTab(x)}
                  className={`min-h-10 shrink-0 rounded-lg px-3 text-xs ${roundTab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            <Card title={roundTab}>
              {roundTab === 'Overview' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      ['Committed', '₹0.8 Cr'],
                      ['Remaining', '₹1.7 Cr'],
                      ['Investors', '3'],
                      ['Average ticket', '₹26.7L'],
                    ].map(([a, b]) => (
                      <div key={a} className="rounded-lg bg-[#FAF8F4] p-4">
                        <small className="text-xs text-[#4A5568]">{a}</small>
                        <b className="serif mt-1 block text-xl">{b}</b>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-xs text-[#4A5568]">
                    Round activity · Opened Oct 10 · First commitment Oct 28 · Lead investor in progress
                  </p>
                </>
              ) : roundTab === 'Offers and commitments' ? (
                <>
                  <button type="button" onClick={() => setModal('offer')} className="mb-4 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                    + Record offer
                  </button>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-xs">
                      <thead className="border-b text-[#4A5568]">
                        <tr>
                          {['Investor', 'Offer type', 'Amount', 'Instrument', 'Status', 'Date'].map(x => (
                            <th key={x} className="py-3">{x}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Northstar Capital', 'Equity', '₹50L', 'Equity', 'Under review', 'Nov 02'],
                          ['Mira Shah', 'Equity', '₹25L', 'SAFE', 'Offer received', 'Nov 03'],
                          ['SeedSpring Fund', 'Equity', '₹25L', 'Equity', 'Committed', 'Oct 28'],
                        ].map(r => (
                          <tr key={r[0]} className="border-b">
                            <td className="py-3">{r[0]}</td>
                            {r.slice(1).map((v, i) => (
                              <td key={i}>{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : roundTab === 'Cap table impact' ? (
                <>
                  <div className="flex h-5 overflow-hidden rounded-full">
                    <span className="w-[62%] bg-ink" />
                    <span className="w-[18%] bg-[#B8955A]" />
                    <span className="w-[20%] bg-[#A0A7B4]" />
                  </div>
                  <p className="mt-3 text-xs">Founders 62% · ESOP 18% · New investors 20% (illustrative target scenario)</p>
                  <p className="mt-3 rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">Estimate only. Confirm dilution and terms with your legal and finance advisers.</p>
                </>
              ) : (
                <div className="py-5 text-sm text-[#4A5568]">{roundTab} entries will appear here as the round progresses.</div>
              )}
            </Card>
            {disclaimer}
          </>
        )}

        {page === 'settings' && (
          <>
            {head(
              <Btn onClick={() => notify('Investor visibility settings saved.')}>Save changes</Btn>
            )}
            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                <Card title="Who can see my startup">
                  <fieldset className="space-y-3">
                    {['Private', 'Mentors only', 'Mentors and verified investors'].map(x => (
                      <label key={x} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E5E1D8] p-3">
                        <input
                          type="radio"
                          name="visibility"
                          checked={vis === x}
                          onChange={() => {
                            setVis(x);
                            setVisible(x === 'Mentors and verified investors');
                          }}
                          className="mt-1 accent-ink"
                        />
                        <span>
                          <b className="block text-sm">{x}</b>
                          <small className="text-xs text-[#4A5568]">
                            {x === 'Private'
                              ? 'Only your team can view your startup.'
                              : x === 'Mentors only'
                              ? 'Your assigned mentors can see shared information.'
                              : 'Approved, verified investors can discover your public profile.'}
                          </small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </Card>

                <Card title="What investors can see">
                  {Object.entries({
                    summary: 'Profile summary',
                    traction: 'Traction numbers',
                    team: 'Team details',
                    funding: 'Funding details',
                    round: 'Round information',
                    readiness: 'Readiness score and badge',
                  }).map(([key, label]) => (
                    <label key={key} className="flex min-h-11 items-center justify-between border-b border-[#E5E1D8] text-sm">
                      {label}
                      <input
                        type="checkbox"
                        checked={toggles[key]}
                        onChange={() => setToggles({ ...toggles, [key]: !toggles[key] })}
                        className="h-4 w-4 accent-ink"
                      />
                    </label>
                  ))}
                  <button type="button" onClick={() => notify('Investor preview opened.')} className="mt-4 text-xs font-semibold text-[#9A7A45]">
                    Preview as investor <ArrowUpRight className="inline" size={12} />
                  </button>
                </Card>

                <Card title="Pause investor visibility">
                  <p className="text-xs leading-5 text-[#4A5568]">Temporarily hide your profile without deleting information or past activity.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setVisible(!visible);
                      setVis(visible ? 'Private' : 'Mentors and verified investors');
                      notify(visible ? 'Investor visibility paused.' : 'Investor visibility resumed.');
                    }}
                    className={`mt-3 rounded-lg px-4 py-2.5 text-xs font-semibold ${visible ? 'border border-[#E5E1D8]' : 'bg-[#B42318] text-white'}`}
                  >
                    {visible ? 'Pause visibility' : 'Resume visibility'}
                  </button>
                </Card>
              </div>

              <aside className="space-y-5">
                <Card title="Investor controls">
                  <p className="text-xs text-[#4A5568]">Blocked investors</p>
                  <p className="mt-2 text-xs">No blocked investors.</p>
                  <button type="button" onClick={() => notify('Investor preferences opened.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                    Preferred sectors and ticket range
                  </button>
                </Card>

                <Card title="Data room defaults">
                  <label className="block text-xs">
                    Download policy
                    <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                      <option>View only (recommended)</option>
                      <option>Allow for selected investors</option>
                    </select>
                  </label>
                  <label className="mt-3 flex items-center justify-between text-xs">
                    Watermark documents
                    <input type="checkbox" defaultChecked className="accent-ink" />
                  </label>
                  <label className="mt-3 flex items-center justify-between text-xs">
                    Require NDA
                    <input type="checkbox" defaultChecked className="accent-ink" />
                  </label>
                </Card>

                <Card title="Notifications">
                  {['Profile views', 'Shortlists', 'Messages', 'Access requests', 'Offers'].map(x => (
                    <label key={x} className="flex min-h-9 items-center justify-between text-xs">
                      {x}
                      <input type="checkbox" defaultChecked className="accent-ink" />
                    </label>
                  ))}
                </Card>
              </aside>
            </div>
            {disclaimer}
          </>
        )}
      </main>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold">
                {modal.startsWith('intro')
                  ? 'Request an introduction'
                  : modal === 'meeting'
                  ? 'Schedule investor meeting'
                  : modal === 'round'
                  ? 'Set up a fundraising round'
                  : modal === 'offer'
                  ? 'Record an offer'
                  : modal.startsWith('grant')
                  ? 'Approve data room access'
                  : 'Add investor to pipeline'}
              </h2>
              <button type="button" onClick={() => setModal('')} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {modal.startsWith('intro') ? (
              <>
                <p className="mb-3 text-xs text-[#4A5568]">50–500 characters · You have 5 requests left today.</p>
                <textarea
                  minLength={50}
                  maxLength={500}
                  rows={5}
                  placeholder="What you do, your traction, what you’re raising and why this investor is a fit…"
                  className="w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
                <div className="mt-3 space-y-2 text-xs">
                  {[
                    ['Profile summary', true],
                    ['Traction numbers', true],
                    ['Pitch deck (view-only)', false],
                  ].map(([x, v]) => (
                    <label key={x} className="flex justify-between">
                      {x}
                      <input type="checkbox" defaultChecked={v} className="accent-ink" />
                    </label>
                  ))}
                </div>
                <p className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                  No data room access will be granted automatically. Investors must accept the introduction.
                </p>
              </>
            ) : modal === 'meeting' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Investor
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>SeedSpring Fund</option>
                    <option>Northstar Capital</option>
                    <option>Mira Shah</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Meeting type
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Intro call</option>
                    <option>Pitch</option>
                    <option>Diligence</option>
                    <option>Follow-up</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Date
                    <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                  </label>
                  <label className="text-sm">
                    Time
                    <input type="time" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                  </label>
                </div>
                <label className="block text-sm">
                  Agenda
                  <textarea rows={3} placeholder="What would you like to discuss?" className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3" />
                </label>
                <p className="text-xs text-[#4A5568]">Time zone: Asia/Kolkata · Recording is off by default.</p>
              </div>
            ) : modal === 'round' ? (
              <div className="space-y-3">
                {[
                  ['Round name', 'Pre-seed'],
                  ['Target raise', '₹2.5 Cr'],
                  ['Minimum raise', '₹1.5 Cr'],
                  ['Instrument', 'Equity / SAFE'],
                  ['Minimum ticket', '₹10L'],
                  ['Closing date', '2027-03-31'],
                ].map(([l, p]) => (
                  <label key={l} className="block text-sm">
                    {l}
                    <input placeholder={p} className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm" />
                  </label>
                ))}
                <p className="rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">Round terms and instruments have legal consequences. Review with a lawyer.</p>
              </div>
            ) : modal === 'offer' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Investor
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Northstar Capital</option>
                    <option>SeedSpring Fund</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Amount
                  <input placeholder="₹50L" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <label className="block text-sm">
                  Instrument
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Equity</option>
                    <option>SAFE</option>
                    <option>Convertible note</option>
                  </select>
                </label>
              </div>
            ) : modal.startsWith('grant') ? (
              <div className="space-y-3">
                <p className="text-sm">Choose the folders this investor can access after signing the NDA.</p>
                {['Pitch', 'Financials', 'Product'].map(x => (
                  <label key={x} className="flex gap-2 text-sm">
                    <input type="checkbox" defaultChecked={x === 'Pitch'} className="accent-ink" />{x} folder
                  </label>
                ))}
                <label className="block text-sm">
                  Access expires
                  <input type="date" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <label className="flex gap-2 text-xs">
                  <input type="checkbox" defaultChecked className="accent-ink" />Require signed NDA first
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm">
                  Investor name
                  <input placeholder="Investor or firm" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <label className="block text-sm">
                  Email
                  <input type="email" placeholder="contact@example.com" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <p className="text-xs text-[#4A5568]">Manual entries are private and labeled as such.</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal('')} className="min-h-10 px-4 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setModal('');
                  notify(
                    modal.startsWith('intro')
                      ? 'Intro request sent.'
                      : modal === 'meeting'
                      ? 'Meeting invitation prepared.'
                      : modal.startsWith('grant')
                      ? 'NDA sent; access pending signature.'
                      : 'Saved.'
                  );
                }}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
              >
                {modal.startsWith('intro')
                  ? 'Send request'
                  : modal === 'meeting'
                  ? 'Send invite'
                  : modal.startsWith('grant')
                  ? 'Approve scope'
                  : modal === 'offer'
                  ? 'Save offer'
                  : 'Save'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
