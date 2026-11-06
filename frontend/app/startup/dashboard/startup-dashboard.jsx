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
  Check,
  Plus,
  ArrowUpRight,
  CalendarDays,
  Clock,
  MoreHorizontal,
  FileText,
  Presentation,
  FileSpreadsheet,
  Menu,
  X,
  Eye,
  EyeOff,
  LockKeyhole,
  CheckCircle2,
  MessageCircle,
  Building2,
  ArrowRight,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';

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

const initialTasks = [
  {t: 'Finalize pricing model', who: 'AK', due: 'Today', state: 'soon'},
  {t: 'Review customer interview notes', who: 'PM', due: 'Tomorrow', state: 'normal'},
  {t: 'Update pitch deck traction slide', who: 'AK', due: 'Overdue', state: 'late'}
];

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

function Button({children, onClick, secondary = false, className = ''}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8955A] ${
        secondary
          ? 'border border-[#E5E1D8] bg-white text-ink hover:bg-[#F4F1EA]'
          : 'bg-ink text-white hover:bg-[#1C2B42]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function StartupDashboard() {
  const [compact, setCompact] = useState(false);
  const [darkmode, setDarkmode] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [tab, setTab] = useState('My tasks');
  const [tasks, setTasks] = useState(initialTasks);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState('Prototype');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState(false);
  const [checked, setChecked] = useState([true, true, false, true, false, false]);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('forma_theme');
      if (savedTheme === 'dark') {
        setDarkmode(true);
        document.documentElement.classList.add('dark');
      }
    } catch {
      // Ignore localStorage unavailable
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkmode;
    setDarkmode(next);
    try {
      localStorage.setItem('forma_theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // Ignore
    }
  };

  const stages = ['Idea', 'Prototype', 'Early revenue', 'Mature'];
  const showToast = t => {
    setToast(t);
    setTimeout(() => setToast(''), 2800);
  };

  const copyInviteLink = () => {
    const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/acme-studio` : 'https://forma.app/join/acme-studio';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).catch(() => {});
    }
    showToast('Invite link copied to clipboard!');
  };

  const toggleTask = i => setTasks(tasks.map((t, n) => n === i ? {...t, done: !t.done} : t));
  const stageIndex = stages.indexOf(stage);
  const stageItems = [
    'Problem and customer interviews',
    'Define your ideal customer profile',
    'Build and test your prototype',
    'Document product-market evidence',
    'Map competitors and positioning',
    'Prepare a repeatable sales motion'
  ];
  const done = checked.filter(Boolean).length;

  return (
    <div className={`min-h-screen bg-[#FAF8F4] text-[#0F1B2D] ${darkmode ? 'darkdash' : ''}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow-md">
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#0F1B2D] text-white transition-all lg:flex ${compact ? 'w-[76px]' : 'w-[240px]'}`}>
        <div className={`flex h-[76px] items-center border-b border-white/10 ${compact ? 'justify-center' : 'gap-3 px-6'}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/30 font-serif text-lg">F</span>
          {!compact && (
            <span className="font-semibold tracking-wide">
              forma <small className="ml-1 font-normal text-white/70">WORKSPACE</small>
            </span>
          )}
        </div>

        <div className="px-3 pt-5">
          {!compact && (
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[.16em] text-white/70">
              Startup
            </p>
          )}
          {nav.map(([name, Icon, url]) => (
            <Link
              href={url}
              key={name}
              title={compact ? name : undefined}
              className={`group relative mb-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8955A] ${
                name === 'Dashboard'
                  ? 'bg-[#1C2B42] text-white'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              } ${compact ? 'justify-center' : ''}`}
            >
              {name === 'Dashboard' && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />}
              <Icon size={18} strokeWidth={1.7} className="shrink-0" />
              {!compact && <span>{name}</span>}
            </Link>
          ))}
        </div>

        <div className="mt-auto px-3 pb-4">
          <Link
            href="/startup/profile"
            title={compact ? 'Settings' : undefined}
            className={`mb-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] text-white/75 hover:bg-white/10 hover:text-white ${compact ? 'justify-center' : ''}`}
          >
            <Settings size={18} className="shrink-0" />
            {!compact && <span>Settings</span>}
          </Link>
          <Link
            href="/help"
            title={compact ? 'Help & support' : undefined}
            className={`mb-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] text-white/75 hover:bg-white/10 hover:text-white ${compact ? 'justify-center' : ''}`}
          >
            <CircleHelp size={18} className="shrink-0" />
            {!compact && <span>Help & support</span>}
          </Link>

          <button
            type="button"
            onClick={() => setProfile(!profile)}
            className={`mt-2 flex w-full items-center gap-3 rounded-lg border border-white/10 p-3 text-left hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8955A] ${compact ? 'justify-center' : ''}`}
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-xs font-semibold text-ink">AK</div>
            {!compact && (
              <span className="min-w-0 flex-1">
                <b className="block truncate text-xs">Aarav Kapoor</b>
                <small className="text-white/60">Founder · switch role</small>
              </span>
            )}
            {!compact && <ChevronDown size={14} />}
          </button>
        </div>

        <button
          type="button"
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCompact(!compact)}
          className="absolute -right-3.5 top-[84px] grid h-8 w-8 place-items-center rounded-full border border-[#E5E1D8] bg-white text-ink shadow-sm transition hover:bg-[#FAF8F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8955A]"
        >
          {compact ? <ArrowRight size={15} /> : <ChevronRight size={15} />}
        </button>
      </aside>

      {/* Header */}
      <header className={`sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur sm:px-7 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg hover:bg-black/5 lg:hidden"
            onClick={() => setMobile(!mobile)}
            aria-label={mobile ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-2.5 text-[#4A5568]" size={17} />
            <input
              aria-label="Search workspace"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search anything…"
              className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-[#B8955A] focus:ring-1 focus:ring-[#B8955A]"
            />
          </div>

          <button
            type="button"
            onClick={() => showToast('Acme Studio is your active startup.')}
            className="flex items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-[#FAF8F4]"
          >
            <span className="grid h-6 w-6 place-items-center rounded bg-[#F3EBDD] text-xs font-bold text-[#806236]">A</span>
            <span className="hidden sm:block">Acme Studio</span>
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={darkmode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkmode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-10 w-10 place-items-center rounded-full text-[#4A5568] transition hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-[#B8955A]"
          >
            {darkmode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            onClick={() => showToast('You have 3 new notifications.')}
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full text-[#4A5568] transition hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-[#B8955A]"
          >
            <Bell size={19} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A] ring-2 ring-[#FAF8F4]" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfile(!profile)}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-white focus-visible:ring-2 focus-visible:ring-[#B8955A]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">AK</span>
              <span className="hidden text-left sm:block">
                <b className="block text-xs text-ink">Aarav Kapoor</b>
                <small className="text-[#4A5568]">Founder</small>
              </span>
              <ChevronDown size={14} className="text-[#4A5568]" />
            </button>

            {profile && (
              <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-[#E5E1D8] bg-white p-2 shadow-lg">
                <Link href="/startup/profile" onClick={() => setProfile(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-[#FAF8F4]">
                  <Settings size={16} /> Account settings
                </Link>
                <Link href="/help" onClick={() => setProfile(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-[#FAF8F4]">
                  <CircleHelp size={16} /> Help & support
                </Link>
                <div className="my-1 border-t border-[#E5E1D8]" />
                <button
                  type="button"
                  onClick={() => {
                    setProfile(false);
                    showToast('Role switcher: Founder · Mentor.');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-[#FAF8F4]"
                >
                  <Users size={16} /> Switch role
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfile(false);
                    showToast('Signed out of Acme Studio.');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#B42318] hover:bg-[#FCE8E6]"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobile && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#0F1B2D] p-5 text-white lg:hidden">
          <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
            <span className="font-semibold tracking-wide">forma · Startup</span>
            <button
              type="button"
              onClick={() => setMobile(false)}
              className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {nav.map(([n, Icon, url]) => (
              <Link
                key={n}
                href={url}
                onClick={() => setMobile(false)}
                className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Icon size={19} />
                <span>{n}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-white/10 pt-4">
            <Link
              href="/startup/profile"
              onClick={() => setMobile(false)}
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Settings size={18} /> Settings
            </Link>
            <Link
              href="/help"
              onClick={() => setMobile(false)}
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              <CircleHelp size={18} /> Help & support
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main id="main" className={`mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-7 lg:px-8 lg:pb-12 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-sm text-[#4A5568]">
              Thursday, November 5, 2026 <span className="mx-2 text-[#B8955A]">·</span> Acme Studio
            </p>
            <h1 className="serif text-[30px] font-semibold tracking-tight text-ink">Good evening, Aarav</h1>
            <p className="mt-1 text-sm text-[#4A5568]">Here’s your startup’s progress and what’s next.</p>
          </div>
          <Button onClick={copyInviteLink}>
            <Plus size={17} /> Invite a teammate
          </Button>
        </div>

        {/* Current Stage Card */}
        <section className="mb-6 rounded-xl border border-[#E5E1D8] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,27,45,.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs font-semibold text-[#806236]">CURRENT STAGE</span>
                <select
                  aria-label="Startup stage"
                  value={stage}
                  onChange={e => {
                    setStage(e.target.value);
                    showToast(`Moved to ${e.target.value} stage.`);
                  }}
                  className="rounded-md border-0 bg-transparent text-sm font-semibold text-ink outline-none cursor-pointer"
                >
                  <option>Idea</option>
                  <option>Prototype</option>
                  <option>Early revenue</option>
                  <option>Mature</option>
                </select>
              </div>
              <p className="mt-2 text-sm text-[#4A5568]">
                {stageIndex < 3 ? (
                  <>
                    Next stage: <b className="font-semibold text-ink">{stages[stageIndex + 1]}</b> · <span>{done} of 10 exit criteria met</span>
                  </>
                ) : (
                  <>You’ve reached the <b className="text-ink">Mature</b> stage.</>
                )}
              </p>
            </div>
            <Link
              href="/startup/stage"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#E5E1D8] bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-[#F4F1EA]"
            >
              View exit criteria <ArrowUpRight size={15} />
            </Link>
          </div>

          {/* Stepper with overflow-x-auto */}
          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-[540px] items-center">
              {stages.map((s, i) => (
                <div key={s} className="flex flex-1 items-center last:flex-none">
                  <div
                    className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold ${
                      i < stageIndex
                        ? 'border-ink bg-ink text-white'
                        : i === stageIndex
                        ? 'border-[#B8955A] bg-[#F3EBDD] text-ink'
                        : 'border-[#E5E1D8] bg-white text-[#4A5568]'
                    }`}
                  >
                    {i < stageIndex ? <Check size={15} /> : i + 1}
                    {i === stageIndex && <span className="absolute -inset-1 rounded-full border border-[#B8955A]/30" />}
                  </div>
                  <span className={`ml-2 text-xs ${i === stageIndex ? 'font-semibold text-ink' : 'text-[#4A5568]'}`}>{s}</span>
                  {i < 3 && <div className={`mx-2 h-px flex-1 sm:mx-4 ${i < stageIndex ? 'bg-ink' : 'bg-[#E5E1D8]'}`} />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Top Metric Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            ['Readiness score', '72', '/ 100', '+5 this month', '↗'],
            ['Monthly recurring revenue', '₹4.8L', '', '+12% vs last month', '↗'],
            ['Runway', '9 months', '', 'Burn ₹3.1L / mo', '—'],
            ['Open tasks', '14', '', '3 due this week', '!']
          ].map(([label, value, unit, detail, trend], i) => (
            <section key={label} className="rounded-xl border border-[#E5E1D8] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,27,45,.04)]">
              <p className="text-xs leading-5 text-[#4A5568]">{label}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="serif text-[28px] font-semibold text-ink">{value}</span>
                <span className="text-sm text-[#4A5568]">{unit}</span>
              </div>
              <p className={`mt-1 text-xs font-medium ${i === 3 ? 'text-[#B7791F]' : 'text-[#2E7D5B]'}`}>
                {trend !== '—' && <span className="mr-1">{trend}</span>}
                {detail}
              </p>
            </section>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {/* Stage Checklist */}
            <Card
              title={`Stage checklist: ${stage}`}
              action={
                <Link href="/startup/stage" className="inline-flex items-center text-sm font-medium text-[#9A7A45] hover:underline">
                  See all <ArrowRight className="ml-1 inline" size={14} />
                </Link>
              }
            >
              <div className="mb-4 flex items-center justify-between text-xs text-[#4A5568]">
                <span>{done} of 6 milestones complete</span>
                <span className="font-semibold text-ink">{Math.round((done / 6) * 100)}%</span>
              </div>
              <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#E5E1D8]" role="progressbar" aria-valuenow={Math.round((done / 6) * 100)} aria-valuemin="0" aria-valuemax="100" aria-label="Stage checklist progress">
                <div className="h-full rounded-full bg-[#B8955A] transition-all duration-500" style={{width: `${(done / 6) * 100}%`}} />
              </div>
              <div className="space-y-1">
                {stageItems.map((item, i) => (
                  <label key={item} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-[#FAF8F4]">
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={() => setChecked(checked.map((v, n) => n === i ? !v : v))}
                      className="h-4 w-4 accent-[#0F1B2D]"
                    />
                    <span className={`flex-1 text-sm ${checked[i] ? 'text-[#4A5568] line-through' : 'text-ink'}`}>
                      {item}
                    </span>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3EBDD] text-xs font-semibold text-ink">
                      {i % 2 ? 'PM' : 'AK'}
                    </span>
                    <span className="hidden w-20 text-right text-xs text-[#4A5568] sm:block">
                      {['Nov 06', 'Nov 08', 'Nov 12', 'Nov 14', 'Nov 18', 'Nov 20'][i]}
                    </span>
                  </label>
                ))}
              </div>
              <Link href="/startup/stage" className="mt-4 block border-t border-[#E5E1D8] pt-4 text-sm font-semibold text-[#9A7A45] hover:underline">
                Open stage toolkit <ArrowRight className="ml-1 inline" size={15} />
              </Link>
            </Card>

            {/* Tasks & Milestones */}
            <Card
              title="Tasks & milestones"
              action={
                <Link href="/startup/tasks" className="inline-flex items-center gap-1 text-sm font-semibold text-[#9A7A45] hover:underline">
                  <Plus size={16} /> New task
                </Link>
              }
            >
              <div className="mb-3 flex gap-5 border-b border-[#E5E1D8]">
                {['My tasks', 'Team', 'Milestones'].map(x => (
                  <button
                    type="button"
                    key={x}
                    onClick={() => setTab(x)}
                    className={`-mb-px border-b-2 px-1 pb-2 text-sm transition ${
                      tab === x ? 'border-[#B8955A] font-semibold text-ink' : 'border-transparent text-[#4A5568] hover:text-ink'
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>
              {tab === 'Milestones' ? (
                <div className="flex items-start gap-0 overflow-x-auto py-3">
                  {['Prototype test', 'Beta launch', 'First 10 customers', 'Seed round'].map((m, i) => (
                    <div key={m} className="min-w-[130px] flex-1">
                      <div className="flex items-center">
                        <span className={`h-3 w-3 rounded-full ${i === 0 ? 'bg-[#B8955A] ring-4 ring-[#F3EBDD]' : 'bg-[#E5E1D8]'}`} />
                        <span className="h-px flex-1 bg-[#E5E1D8]" />
                      </div>
                      <p className={`mt-3 text-xs ${i === 0 ? 'font-semibold text-ink' : 'text-[#4A5568]'}`}>{m}</p>
                      <small className="text-xs text-[#4A5568]">{['Nov 12', 'Dec 01', 'Jan 15', 'Mar 01'][i]}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[#E5E1D8]">
                  {(tab === 'My tasks' ? tasks : tasks.map((t, i) => ({...t, who: ['AK', 'PM', 'SR'][i]}))).map((t, i) => (
                    <div key={t.t} className="flex min-h-[54px] items-center gap-3 py-2">
                      <input
                        aria-label={`Complete ${t.t}`}
                        type="checkbox"
                        checked={!!t.done}
                        onChange={() => toggleTask(i)}
                        className="h-4 w-4 accent-[#0F1B2D]"
                      />
                      <span className={`flex-1 text-sm ${t.done ? 'text-[#4A5568] line-through' : 'text-ink'}`}>{t.t}</span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3EBDD] text-xs font-semibold text-ink">{t.who}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.state === 'late' ? 'bg-[#FCE8E6] text-[#B42318]' : t.state === 'soon' ? 'bg-[#FFF3D6] text-[#8A5700]' : 'bg-[#F3F4F6] text-[#4A5568]'}`}>
                        {t.due}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Investor & Hiring Grid */}
            <div className="grid gap-5 md:grid-cols-2">
              <Card
                title="Investor interest"
                action={
                  <button
                    type="button"
                    aria-label={visible ? 'Hide investor profile' : 'Show investor profile'}
                    onClick={() => setVisible(!visible)}
                    className="flex items-center gap-2 text-xs text-[#4A5568] hover:text-ink"
                  >
                    {visible ? <Eye size={15} /> : <EyeOff size={15} />} {visible ? 'Visible' : 'Private'}
                  </button>
                }
              >
                {visible ? (
                  <>
                    <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Views', '128'],
                        ['Shortlists', '12'],
                        ['Messages', '4']
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-[#FAF8F4] p-2">
                          <b className="serif block text-xl text-ink">{v}</b>
                          <small className="text-xs text-[#4A5568]">{k}</small>
                        </div>
                      ))}
                    </div>
                    {[
                      ['Mira Ventures', 'Shortlisted'],
                      ['Northstar Capital', 'In talks'],
                      ['SeedSpring', 'Viewed']
                    ].map(([n, s]) => (
                      <div key={n} className="flex items-center justify-between border-t border-[#E5E1D8] py-2.5 text-xs text-ink">
                        <span>{n}</span>
                        <span className="rounded-full bg-[#F3EBDD] px-2 py-0.5 text-xs font-medium text-[#806236]">{s}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="rounded-lg bg-[#FAF8F4] p-4 text-center">
                    <LockKeyhole className="mx-auto mb-2 text-[#9A7A45]" size={20} />
                    <p className="text-sm font-medium text-ink">Your profile is private</p>
                    <p className="mt-1 text-xs leading-5 text-[#4A5568]">Make it visible to investors to see profile views and interest.</p>
                    <button type="button" onClick={() => setVisible(true)} className="mt-3 text-sm font-semibold text-[#9A7A45] hover:underline">
                      Make profile visible <ArrowRight className="inline" size={14} />
                    </button>
                  </div>
                )}
              </Card>

              <Card
                title="Hiring requests"
                action={
                  <Link href="/startup/hiring" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                    Jobs <ArrowRight className="inline" size={13} />
                  </Link>
                }
              >
                <div className="rounded-lg border border-[#E5E1D8] p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] text-[#806236]">
                      <Briefcase size={17} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">Backend engineer</p>
                      <p className="mt-1 text-xs text-[#4A5568]">12 applicants · Full time</p>
                    </div>
                    <MoreHorizontal size={18} className="text-[#4A5568]" />
                  </div>
                  <Link
                    href="/startup/hiring"
                    className="mt-3 block w-full rounded-lg border border-[#E5E1D8] py-2 text-center text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                  >
                    Review applicants
                  </Link>
                </div>
                <Link href="/startup/hiring/jobs/new" className="mt-3 inline-block text-sm font-semibold text-[#9A7A45] hover:underline">
                  + Post a job
                </Link>
              </Card>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Investment Readiness */}
            <Card
              title="Investment readiness"
              action={
                <Link href="/startup/readiness" className="text-[#4A5568] hover:text-ink" aria-label="More readiness details">
                  <MoreHorizontal size={18} />
                </Link>
              }
            >
              <div className="flex items-center gap-5">
                <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{background: 'conic-gradient(#B8955A 0deg 259deg, #E5E1D8 259deg 360deg)'}}>
                  <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-white">
                    <div className="text-center">
                      <span className="serif text-3xl font-semibold text-ink">72</span>
                      <span className="block text-xs text-[#4A5568]">out of 100</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {[
                    ['Checklist', 80],
                    ['Traction', 65],
                    ['Mentor feedback', 70]
                  ].map(([n, v]) => (
                    <div key={n}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[#4A5568]">{n}</span>
                        <b className="text-ink">{v}%</b>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#E5E1D8]">
                        <div className="h-full rounded-full bg-ink" style={{width: `${v}%`}} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-5 flex items-center gap-2 rounded-lg bg-[#F3EBDD] p-3 text-xs font-medium text-[#806236]">
                <Clock size={15} /> 3 items left for mentor sign-off
              </p>
              <Link href="/startup/stage" className="mt-4 block text-sm font-semibold text-[#9A7A45] hover:underline">
                Improve your score <ArrowRight className="inline" size={14} />
              </Link>
            </Card>

            {/* Your Mentor */}
            <Card title="Your mentor">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[#E8EAF0] text-sm font-semibold text-ink">RM</div>
                <div>
                  <p className="text-sm font-semibold text-ink">Rhea Mukherjee</p>
                  <p className="text-xs text-[#4A5568]">Go-to-market · SaaS</p>
                </div>
                <Link href="/startup/mentors" className="ml-auto text-[#9A7A45]" aria-label="View mentor">
                  <ArrowUpRight size={17} />
                </Link>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#FAF8F4] p-3 text-xs">
                <CalendarDays size={16} className="text-[#9A7A45]" />
                <span>Next session: <b className="text-ink">Thu, 4:00 PM</b></span>
                <Link href="/startup/sessions" className="ml-auto font-semibold text-[#9A7A45] hover:underline">
                  Join
                </Link>
              </div>
              <p className="mt-3 text-xs text-[#4A5568]">4 of 6 readiness items signed off</p>
              <div className="mt-2 h-1.5 rounded-full bg-[#E5E1D8]">
                <div className="h-full w-2/3 rounded-full bg-[#B8955A]" />
              </div>
            </Card>

            {/* Recent Activity */}
            <Card
              title="Recent activity"
              action={
                <button type="button" onClick={() => showToast('Showing all recent workspace activity.')} className="text-xs font-semibold text-[#9A7A45] hover:underline">
                  View all
                </button>
              }
            >
              <div className="space-y-4">
                {[
                  ['check', 'Mentor signed off Unit economics', '12 min ago'],
                  ['file', 'Priya uploaded Pitch deck v3', '1 hour ago'],
                  ['eye', 'Investor viewed your data room', 'Yesterday'],
                  ['chat', 'Customer feedback added to research', 'Yesterday']
                ].map(([type, t, time], i) => (
                  <div key={t} className="flex gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${i === 0 ? 'bg-[#E7F3EC] text-[#2E7D5B]' : 'bg-[#F3EBDD] text-[#806236]'}`}>
                      {type === 'check' ? <CheckCircle2 size={16} /> : type === 'file' ? <FileText size={16} /> : type === 'eye' ? <Eye size={16} /> : <MessageCircle size={16} />}
                    </span>
                    <div>
                      <p className="text-xs leading-5 text-ink">{t}</p>
                      <small className="text-xs text-[#4A5568]">{time}</small>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Team & Documents */}
            <Card title="Team & documents">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[
                    ['AK', 'bg-ink text-white'],
                    ['PM', 'bg-[#F3EBDD] text-ink'],
                    ['SR', 'bg-[#E7F3EC] text-[#2E7D5B]'],
                    ['+2', 'bg-[#F3F4F6] text-[#4A5568]']
                  ].map(([initial, cls]) => (
                    <span key={initial} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-xs font-semibold ${cls}`}>
                      {initial}
                    </span>
                  ))}
                </div>
                <button type="button" onClick={copyInviteLink} className="text-xs font-semibold text-[#9A7A45] hover:underline">
                  Invite member <Plus className="inline" size={13} />
                </button>
              </div>
              <div className="space-y-2 border-t border-[#E5E1D8] pt-3">
                {[
                  [Presentation, 'Pitch deck v3', 'Updated today'],
                  [FileSpreadsheet, 'Financial model', 'Updated yesterday'],
                  [FileText, 'Product brief', 'Oct 30']
                ].map(([Icon, n, d]) => (
                  <Link href="/startup/data-room" key={n} className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-[#FAF8F4]">
                    <Icon size={16} className="text-[#9A7A45]" />
                    <span className="flex-1 text-xs font-medium text-ink">{n}</span>
                    <small className="text-xs text-[#4A5568]">{d}</small>
                  </Link>
                ))}
              </div>
              <Link href="/startup/data-room" className="mt-3 block text-xs font-semibold text-[#9A7A45] hover:underline">
                Open vault <ArrowRight className="inline" size={13} />
              </Link>
            </Card>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#E5E1D8] bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {[
          ['Home', LayoutDashboard, '/startup/dashboard'],
          ['Tasks', ListTodo, '/startup/tasks'],
          ['Mentors', Lightbulb, '/startup/mentors'],
          ['Investors', Briefcase, '/startup/investors'],
          ['More', Menu, null]
        ].map(([n, Icon, url]) =>
          url ? (
            <Link
              key={n}
              href={url}
              className={`flex min-h-[58px] flex-col items-center justify-center gap-1 text-xs ${
                n === 'Home' ? 'font-semibold text-[#9A7A45]' : 'text-[#4A5568] hover:text-ink'
              }`}
            >
              <Icon size={19} />
              <span>{n}</span>
            </Link>
          ) : (
            <button
              type="button"
              key={n}
              onClick={() => setMobile(true)}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 text-xs text-[#4A5568] hover:text-ink"
            >
              <Icon size={19} />
              <span>{n}</span>
            </button>
          )
        )}
      </nav>

      {/* Floating Toast Notice */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
