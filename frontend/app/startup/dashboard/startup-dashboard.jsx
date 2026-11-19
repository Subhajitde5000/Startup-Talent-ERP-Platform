'use client';
import {useState, useEffect} from 'react';
import Link from 'next/link';
import { StartupSidebar, StartupHeader, Card, Button, NoStartupOrg } from '../../../components';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api/client';
import {
  LayoutDashboard,ListTodo,Lightbulb,Briefcase,Users,Settings,CircleHelp,ChevronRight,Check,Plus,ArrowUpRight,CalendarDays,
  Clock,MoreHorizontal,FileText,Presentation,FileSpreadsheet,Menu,Eye,EyeOff,LockKeyhole,
  CheckCircle2,MessageCircle,Building2,ArrowRight
} from 'lucide-react';

const initialTasks = [
  {t: 'Finalize pricing model', who: 'AK', due: 'Today', state: 'soon'},
  {t: 'Review customer interview notes', who: 'PM', due: 'Tomorrow', state: 'normal'},
  {t: 'Update pitch deck traction slide', who: 'AK', due: 'Overdue', state: 'late'}
];

export default function StartupDashboard() {
  const { user } = useAuth();
  const [compact, setCompact] = useState(false);
  const [darkmode, setDarkmode] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [tab, setTab] = useState('My tasks');
  const [tasks, setTasks] = useState(initialTasks);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState('Prototype');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState([true, true, false, true, false, false]);

  const [orgChecked, setOrgChecked] = useState(false);
  const [hasOrg, setHasOrg] = useState(true);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    let alive = true;
    api.organizations.mine()
      .then(orgs => {
        if (!alive) return;
        const st = orgs.find(o => o.type === 'startup');
        if (st) {
          setHasOrg(true);
          setOrgName(st.name || '');
        } else {
          setHasOrg(false);
        }
        setOrgChecked(true);
      })
      .catch(() => {
        if (!alive) return;
        setOrgChecked(true);
      });
    return () => { alive = false; };
  }, []);

  const stages = ['Idea', 'Prototype', 'Early revenue', 'Mature'];
  const showToast = t => {
    setToast(t);
    setTimeout(() => setToast(''), 2600);
  };
  const toggleTask = i => setTasks(tasks.map((t, n) => (n === i ? {...t, done: !t.done} : t)));
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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3">
        Skip to content
      </a>

      {/* Shared Startup Sidebar & Mobile Drawer */}
      <StartupSidebar
        active="Dashboard"
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobile}
        setMobileOpen={setMobile}
        onAction={showToast}
      />

      <StartupHeader
        compact={compact}
        onToggleMobile={() => setMobile(!mobile)}
        onAction={showToast}
        searchValue={search}
        onSearchChange={e => setSearch(e.target.value)}
        searchPlaceholder="Search anything…"
        showThemeToggle
        darkmode={darkmode}
        onToggleTheme={() => setDarkmode(!darkmode)}
        showProfileMenu
      />

      {/* Main Content */}
      <main id="main" className={`mx-auto max-w-[1440px] px-4 pb-24 pt-7 sm:px-7 lg:px-8 lg:pb-10 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {orgChecked && !hasOrg ? (
          <NoStartupOrg title="No active startup organization" />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-sm text-[#4A5568]">
                  {orgName ? `${orgName} · Workspace` : 'Startup Workspace'}
                </p>
                <h1 className="serif text-[30px] font-semibold tracking-tight">
                  Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
                  {user?.display_name ? `, ${user.display_name.split(' ')[0]}` : ''}
                </h1>
                <p className="mt-1 text-sm text-[#4A5568]">Here’s your startup’s progress and what’s next.</p>
              </div>
              <Link
                href="/startup/team"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-ink px-3.5 text-sm font-semibold text-white hover:bg-[#1C2B42]"
              >
                <Plus size={17} /> Invite a teammate
              </Link>
            </div>

        {/* Current Stage Card */}
        <section className="mb-6 rounded-xl border border-[#E5E1D8] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs font-semibold text-[#806236]">CURRENT STAGE</span>
                <select
                  aria-label="Startup stage"
                  value={stage}
                  onChange={e => {
                    setStage(e.target.value);
                    showToast(`You've moved to ${e.target.value} stage.`);
                  }}
                  className="rounded-md border-0 bg-transparent text-sm font-semibold text-ink outline-none"
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
                  <>
                    You’ve reached the <b className="text-ink">Mature</b> stage.
                  </>
                )}
              </p>
            </div>
            <Link
              href="/startup/stage"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#E5E1D8] bg-white px-3.5 text-sm font-semibold text-ink hover:bg-[#F4F1EA]"
            >
              View exit criteria <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="mt-5 flex items-center">
            {stages.map((s, i) => (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div
                  className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold ${
                    i < stageIndex
                      ? 'border-ink bg-ink text-white'
                      : i === stageIndex
                      ? 'border-[#B8955A] bg-[#F3EBDD] text-ink'
                      : 'border-[#E5E1D8] bg-white text-[#A0A7B4]'
                  }`}
                >
                  {i < stageIndex ? <Check size={15} /> : i + 1}
                  {i === stageIndex && <span className="absolute -inset-1 rounded-full border border-[#B8955A]/30" />}
                </div>
                <span className={`ml-2 hidden text-xs sm:block ${i === stageIndex ? 'font-semibold text-ink' : 'text-[#4A5568]'}`}>{s}</span>
                {i < 3 && <div className={`mx-2 h-px flex-1 sm:mx-4 ${i < stageIndex ? 'bg-ink' : 'bg-[#E5E1D8]'}`} />}
              </div>
            ))}
          </div>
        </section>

        {/* Top 4 Metric Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            ['Readiness score', '72', '/ 100', '+5 this month', '↗'],
            ['Monthly recurring revenue', '₹4.8L', '', '+12% vs last month', '↗'],
            ['Runway', '9 months', '', 'Burn ₹3.1L / mo', '—'],
            ['Open tasks', '14', '', '3 due this week', '!']
          ].map(([label, value, unit, detail, trend], i) => (
            <section key={label} className="rounded-xl border border-[#E5E1D8] bg-white p-4 sm:p-5">
              <p className="text-xs leading-5 text-[#4A5568]">{label}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="serif text-[29px] font-semibold">{value}</span>
                <span className="text-sm text-[#4A5568]">{unit}</span>
              </div>
              <p className={`mt-1 text-xs ${i === 3 ? 'text-[#B7791F]' : 'text-[#2E7D5B]'}`}>
                {trend !== '—' && <span className="mr-1">{trend}</span>}
                {detail}
              </p>
            </section>
          ))}
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {/* Stage Checklist */}
            <Card
              title={`Stage checklist: ${stage}`}
              action={
                <Link href="/startup/stage" className="text-sm font-medium text-[#9A7A45]">
                  See all <ArrowRight className="ml-1 inline" size={14} />
                </Link>
              }
            >
              <div className="mb-4 flex items-center justify-between text-xs text-[#4A5568]">
                <span>{done} of 6 milestones complete</span>
                <span className="font-semibold text-ink">{Math.round((done / 6) * 100)}%</span>
              </div>
              <div
                className="mb-5 h-2 overflow-hidden rounded-full bg-[#E5E1D8]"
                role="progressbar"
                aria-valuenow={Math.round((done / 6) * 100)}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label="Stage checklist progress"
              >
                <div className="h-full rounded-full bg-[#B8955A] transition-all duration-500" style={{width: `${(done / 6) * 100}%`}} />
              </div>
              <div className="space-y-1">
                {stageItems.map((item, i) => (
                  <label key={item} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-[#FAF8F4]">
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={() => setChecked(checked.map((v, n) => (n === i ? !v : v)))}
                      className="h-4 w-4 accent-[#0F1B2D]"
                    />
                    <span className={`flex-1 text-sm ${checked[i] ? 'text-[#A0A7B4] line-through' : 'text-ink'}`}>{item}</span>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3EBDD] text-[10px] font-semibold text-ink">
                      {i % 2 ? 'PM' : 'AK'}
                    </span>
                    <span className="hidden w-20 text-right text-xs text-[#4A5568] sm:block">
                      {['Nov 06', 'Nov 08', 'Nov 12', 'Nov 14', 'Nov 18', 'Nov 20'][i]}
                    </span>
                  </label>
                ))}
              </div>
              <Link href="/startup/stage" className="mt-4 inline-block border-t border-[#E5E1D8] pt-4 text-sm font-semibold text-[#9A7A45]">
                Open stage toolkit <ArrowRight className="ml-1 inline" size={15} />
              </Link>
            </Card>

            {/* Tasks & Milestones Card */}
            <Card
              title="Tasks & milestones"
              action={
                <Link href="/startup/tasks" className="inline-flex items-center gap-1 text-sm font-semibold text-[#9A7A45]">
                  <Plus size={16} /> New task
                </Link>
              }
            >
              <div className="mb-3 flex gap-5 border-b border-[#E5E1D8]">
                {['My tasks', 'Team', 'Milestones'].map(x => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setTab(x)}
                    className={`-mb-px border-b-2 px-1 pb-2 text-sm ${
                      tab === x ? 'border-[#B8955A] font-semibold text-ink' : 'border-transparent text-[#4A5568]'
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>
              {tab === 'Milestones' ? (
                <div className="flex items-start gap-0 overflow-x-auto py-3">
                  {['Prototype test', 'Beta launch', 'First 10 customers', 'Seed round'].map((m, i) => (
                    <div key={m} className="min-w-[125px] flex-1">
                      <div className="flex items-center">
                        <span className={`h-3 w-3 rounded-full ${i === 0 ? 'bg-[#B8955A] ring-4 ring-[#F3EBDD]' : 'bg-[#E5E1D8]'}`} />
                        <span className="h-px flex-1 bg-[#E5E1D8]" />
                      </div>
                      <p className={`mt-3 text-xs ${i === 0 ? 'font-semibold' : ''}`}>{m}</p>
                      <small className="text-[#4A5568]">{['Nov 12', 'Dec 01', 'Jan 15', 'Mar 01'][i]}</small>
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
                      <span className={`flex-1 text-sm ${t.done ? 'text-[#A0A7B4] line-through' : ''}`}>{t.t}</span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3EBDD] text-[10px] font-semibold">{t.who}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                          t.state === 'late'
                            ? 'bg-[#FCE8E6] text-[#B42318]'
                            : t.state === 'soon'
                            ? 'bg-[#FFF3D6] text-[#8A5700]'
                            : 'bg-[#F3F4F6] text-[#4A5568]'
                        }`}
                      >
                        {t.due}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Sub-row: Investor Interest & Hiring Requests */}
            <div className="grid gap-5 md:grid-cols-2">
              <Card
                title="Investor interest"
                action={
                  <button
                    type="button"
                    aria-label={visible ? 'Hide investor profile' : 'Show investor profile'}
                    onClick={() => setVisible(!visible)}
                    className="flex items-center gap-2 text-xs text-[#4A5568]"
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
                          <b className="serif block text-xl">{v}</b>
                          <small className="text-[#4A5568]">{k}</small>
                        </div>
                      ))}
                    </div>
                    {[
                      ['Mira Ventures', 'Shortlisted'],
                      ['Northstar Capital', 'In talks'],
                      ['SeedSpring', 'Viewed']
                    ].map(([n, s]) => (
                      <div key={n} className="flex items-center justify-between border-t border-[#E5E1D8] py-2.5 text-xs">
                        <span>{n}</span>
                        <span className="rounded-full bg-[#F3EBDD] px-2 py-1 text-[#806236]">{s}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="rounded-lg bg-[#FAF8F4] p-4 text-center">
                    <LockKeyhole className="mx-auto mb-2 text-[#9A7A45]" size={20} />
                    <p className="text-sm font-medium">Your profile is private</p>
                    <p className="mt-1 text-xs leading-5 text-[#4A5568]">Make it visible to investors to see profile views and interest.</p>
                    <button type="button" onClick={() => setVisible(true)} className="mt-3 text-sm font-semibold text-[#9A7A45]">
                      Make profile visible <ArrowRight className="inline" size={14} />
                    </button>
                  </div>
                )}
              </Card>

              <Card
                title="Hiring requests"
                action={
                  <Link href="/startup/hiring" className="text-xs font-semibold text-[#9A7A45]">
                    Jobs <ArrowRight className="inline" size={13} />
                  </Link>
                }
              >
                <div className="rounded-lg border border-[#E5E1D8] p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD]">
                      <Briefcase size={17} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Backend engineer</p>
                      <p className="mt-1 text-xs text-[#4A5568]">12 applicants · Full time</p>
                    </div>
                    <MoreHorizontal size={18} className="text-[#4A5568]" />
                  </div>
                  <Link
                    href="/startup/hiring"
                    className="mt-3 block text-center w-full rounded-lg border border-[#E5E1D8] py-2 text-xs font-semibold hover:bg-[#FAF8F4]"
                  >
                    Review applicants
                  </Link>
                </div>
                <Link href="/startup/hiring/jobs/new" className="mt-3 inline-block text-sm font-semibold text-[#9A7A45]">
                  + Post a job
                </Link>
              </Card>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Investment Readiness Card */}
            <Card
              title="Investment readiness"
              action={
                <button
                  type="button"
                  aria-label="More readiness details"
                  onClick={() => showToast('Readiness score combines checklist, traction and mentor feedback.')}
                >
                  <MoreHorizontal size={18} className="text-[#4A5568]" />
                </button>
              }
            >
              <div className="flex items-center gap-5">
                <div
                  className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
                  style={{background: 'conic-gradient(#B8955A 0deg 259deg, #E5E1D8 259deg 360deg)'}}
                >
                  <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-white">
                    <div className="text-center">
                      <span className="serif text-3xl font-semibold">72</span>
                      <span className="block text-[10px] text-[#4A5568]">out of 100</span>
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
                        <b>{v}%</b>
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
              <Link href="/startup/readiness" className="mt-4 inline-block text-sm font-semibold text-[#9A7A45]">
                Improve your score <ArrowRight className="inline" size={14} />
              </Link>
            </Card>

            {/* Mentor Card */}
            <Card title="Your mentor">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[#E8EAF0] text-sm font-semibold">RM</div>
                <div>
                  <p className="text-sm font-semibold">Rhea Mukherjee</p>
                  <p className="text-xs text-[#4A5568]">Go-to-market · SaaS</p>
                </div>
                <Link href="/startup/mentors" className="ml-auto text-[#9A7A45]" aria-label="View mentor">
                  <ArrowUpRight size={17} />
                </Link>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#FAF8F4] p-3 text-xs">
                <CalendarDays size={16} className="text-[#9A7A45]" />
                <span>
                  Next session: <b>Thu, 4:00 PM</b>
                </span>
                <Link href="/startup/sessions" className="ml-auto font-semibold text-[#9A7A45]">
                  Sessions
                </Link>
              </div>
              <p className="mt-3 text-xs text-[#4A5568]">4 of 6 readiness items signed off</p>
              <div className="mt-2 h-1.5 rounded-full bg-[#E5E1D8]">
                <div className="h-full w-2/3 rounded-full bg-[#B8955A]" />
              </div>
            </Card>

            {/* Recent Activity Card */}
            <Card
              title="Recent activity"
              action={
                <Link href="/startup/analytics" className="text-xs font-semibold text-[#9A7A45]">
                  View all
                </Link>
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
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                        i === 0 ? 'bg-[#E7F3EC] text-[#2E7D5B]' : 'bg-[#F3EBDD] text-[#806236]'
                      }`}
                    >
                      {type === 'check' ? (
                        <CheckCircle2 size={16} />
                      ) : type === 'file' ? (
                        <FileText size={16} />
                      ) : type === 'eye' ? (
                        <Eye size={16} />
                      ) : (
                        <MessageCircle size={16} />
                      )}
                    </span>
                    <div>
                      <p className="text-xs leading-5">{t}</p>
                      <small className="text-[11px] text-[#4A5568]">{time}</small>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Team & Documents Card */}
            <Card title="Team & documents">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[
                    ['AK', 'bg-ink text-white'],
                    ['PM', 'bg-[#F3EBDD]'],
                    ['SR', 'bg-[#E7F3EC]'],
                    ['+2', 'bg-[#F3F4F6]']
                  ].map(([initial, cls]) => (
                    <span
                      key={initial}
                      className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[10px] font-semibold ${cls}`}
                    >
                      {initial}
                    </span>
                  ))}
                </div>
                <Link href="/startup/team" className="text-xs font-semibold text-[#9A7A45]">
                  Invite member <Plus className="inline" size={13} />
                </Link>
              </div>
              <div className="space-y-2 border-t border-[#E5E1D8] pt-3">
                {[
                  [Presentation, 'Pitch deck v3', 'Updated today'],
                  [FileSpreadsheet, 'Financial model', 'Updated yesterday'],
                  [FileText, 'Product brief', 'Oct 30']
                ].map(([Icon, n, d]) => (
                  <Link
                    href="/startup/data-room"
                    key={n}
                    className="flex w-full items-center gap-2 rounded-lg p-1 text-left hover:bg-[#FAF8F4]"
                  >
                    <Icon size={16} className="text-[#9A7A45]" />
                    <span className="flex-1 text-xs font-medium">{n}</span>
                    <small className="text-[10px] text-[#4A5568]">{d}</small>
                  </Link>
                ))}
              </div>
              <Link href="/startup/data-room" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                Open vault <ArrowRight className="inline" size={13} />
              </Link>
            </Card>
          </div>
        </div>
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[#E5E1D8] bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <Link
          href="/startup/dashboard"
          className="flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10px] font-semibold text-[#9A7A45]"
        >
          <LayoutDashboard size={19} />
          Home
        </Link>
        <Link
          href="/startup/tasks"
          className="flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10px] text-[#4A5568]"
        >
          <ListTodo size={19} />
          Tasks
        </Link>
        <Link
          href="/startup/mentors"
          className="flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10px] text-[#4A5568]"
        >
          <Lightbulb size={19} />
          Mentor
        </Link>
        <Link
          href="/startup/investors"
          className="flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10px] text-[#4A5568]"
        >
          <Briefcase size={19} />
          Investors
        </Link>
        <button
          type="button"
          onClick={() => setMobile(!mobile)}
          className="flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10px] text-[#4A5568]"
        >
          <Menu size={19} />
          More
        </button>
      </nav>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
