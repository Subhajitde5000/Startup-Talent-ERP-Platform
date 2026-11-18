'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import { StartupSidebar, Card } from '../../../components';
import {useAuth} from '@/lib/auth-context';
import {api, ApiError} from '@/lib/api/client';
import {
  FolderLock,Users,Briefcase,Search,Bell,ChevronRight,Check,Lock,ArrowRight,ArrowUpRight,FileText,
  MessageCircle,CheckCircle2,Upload,Target,UsersRound,BarChart3,Kanban,
  FlaskConical,Wallet,Building2,ClipboardList,BookOpen,ExternalLink,X,Menu
} from 'lucide-react';

// Static toolkit content (product copy, not records). Progress strings are
// neutral: real tool metrics arrive with their own steps (5c/5e/…).
const stages = [
  {
    id: 'idea',
    title: 'Idea',
    focus: 'Validate the problem and market',
    goal: 'Validated problem and a defined target customer.',
    criteria: [
      'Problem statement written and reviewed by a mentor',
      'At least 10 customer interviews logged, with insights summarized',
      'Target customer profile defined',
      'Market size estimated with sources',
      'Mentor confirms the problem is validated'
    ],
    tools: [
      ['Idea canvas', 'Map the essentials of your business idea.', 'Available in your workspace', Target],
      ['Interview tracker', 'Log conversations and surface recurring customer needs.', 'Available in your workspace', UsersRound],
      ['Market sizing', 'Estimate TAM, SAM and SOM with source-backed assumptions.', 'Available in your workspace', BarChart3],
      ['Co-founder search', 'Meet people who could help build your company.', 'Available in your workspace', Users],
      ['Customer persona', 'Create a clear picture of your target customer.', 'Optional tool', ClipboardList]
    ],
    resources: ['Problem interview guide', 'Idea validation canvas', 'Market sizing primer', 'Founder matching sessions']
  },
  {
    id: 'prototype',
    title: 'Prototype',
    focus: 'Build and test an MVP',
    goal: 'A working MVP with first test users.',
    criteria: [
      'MVP scope defined and prioritized',
      'Working prototype released to test users',
      'At least 5 test users have tried it and given feedback',
      'Feedback reviewed and next iterations planned',
      'Mentor confirms the MVP is functional'
    ],
    tools: [
      ['Roadmap & sprint board', 'Plan milestones and move work from backlog to done.', 'Available in your workspace', Kanban],
      ['Prototype & feedback log', 'Track product versions and turn feedback into action.', 'Available in your workspace', FlaskConical],
      ['User-testing tracker', 'Recruit testers, record sessions and learn from use.', 'Available in your workspace', UsersRound],
      ['Grants & incubators', 'Find curated programmes that fit your startup.', 'Available in your workspace', Building2]
    ],
    resources: ['MVP scope worksheet', 'Usability testing guide', 'Prototype test checklist', 'Incubator application calendar']
  },
  {
    id: 'early-revenue',
    title: 'Early revenue',
    focus: 'Prove traction',
    goal: 'Recurring revenue and a repeatable sales motion.',
    criteria: [
      'Paying customers onboarded and target confirmed',
      'Recurring revenue recorded for 3 consecutive months',
      'Sales process documented and repeatable',
      'Unit economics (CAC, payback) calculated',
      'Mentor confirms traction'
    ],
    tools: [
      ['Customer & sales pipeline', 'Track leads from first contact to close.', 'Available in your workspace', UsersRound],
      ['Revenue & burn', 'Monitor MRR, cash balance, burn and runway.', 'Available in your workspace', BarChart3],
      ['KPI tracker', 'Set targets and review the metrics that matter.', 'Available in your workspace', ClipboardList],
      ['Hiring requests', 'Plan critical roles and publish jobs.', 'Available in your workspace', Briefcase]
    ],
    resources: ['Sales playbook template', 'Unit economics calculator', 'Investor update template', 'Founder sales workshop']
  },
  {
    id: 'growth',
    title: 'Growth',
    focus: 'Scale a repeatable engine',
    goal: 'Repeatable growth with healthy unit economics.',
    criteria: [
      'Growth channels documented and producing steady demand',
      'Retention and conversion tracked week over week',
      'Unit economics (CAC, LTV, payback) support the plan',
      'Hiring plan aligned to the next 12 months',
      'Mentor confirms the growth engine is repeatable'
    ],
    tools: [
      ['Growth dashboard', 'Watch the metrics that drive expansion week to week.', 'Available in your workspace', BarChart3],
      ['Channel experiments', 'Run and score acquisition experiments in one place.', 'Available in your workspace', Target],
      ['Hiring plan', 'Plan roles and publish jobs as the team grows.', 'Available in your workspace', Briefcase],
      ['Investor updates', 'Share progress with supporters on a steady cadence.', 'Available in your workspace', FileText]
    ],
    resources: ['Growth playbook template', 'Channel experiment canvas', 'Hiring plan worksheet', 'Investor update examples']
  },
  {
    id: 'mature',
    title: 'Mature',
    focus: 'Scale and raise growth capital',
    goal: 'Ongoing growth, stronger governance and growth capital readiness.',
    criteria: [
      'Financials reviewed and up to date',
      'Cap table and ESOP plan current',
      'Board reporting cadence established',
      'Data room complete and access reviewed',
      '12-month hiring and operating plan ready'
    ],
    tools: [
      ['Finance & cap table', 'Review financial performance and model ownership.', 'Available in your workspace', Wallet],
      ['HR & payroll basics', 'Keep employee, leave and compensation records organized.', 'Available in your workspace', Users],
      ['Board & investor reporting', 'Prepare concise monthly updates and board packs.', 'Available in your workspace', FileText],
      ['Data room', 'Organize secure diligence documents and permissions.', 'Available in your workspace', FolderLock]
    ],
    resources: ['Board pack template', 'Cap table guide', 'Data room checklist', 'Growth fundraising briefing']
  }
];

const paths = [
  '/startup/stage/idea',
  '/startup/stage/prototype',
  '/startup/stage/early-revenue',
  '/startup/stage/growth',
  '/startup/stage/mature'
];

// startup_profiles.stage -> toolkit id used by the URLs above.
const API_TO_URL = {
  idea: 'idea',
  prototype: 'prototype',
  early_revenue: 'early-revenue',
  growth: 'growth',
  mature: 'mature'
};

const ROLE_LABELS = {owner: 'Founder', admin: 'Admin', member: 'Member', viewer: 'Viewer'};
const EDIT_ROLES = ['owner', 'admin', 'member'];

export default function StagePage({stage}) {
  const isOverview = stage === 'overview';

  const {user} = useAuth();
  const [org, setOrg] = useState(null);
  const [profile, setProfile] = useState(null); // StartupProfileRead
  const [loadStatus, setLoadStatus] = useState('loading'); // loading | ready | error | none
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  // Exit criteria stay 'Not started' until the readiness step wires mentor
  // sign-off; nothing is pre-approved and nothing fakes a submitted state.
  const [tool, setTool] = useState(null);
  const [toast, setToast] = useState('');
  const [request, setRequest] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [note, setNote] = useState('');

  const notify = t => {
    setToast(t);
    setTimeout(() => setToast(''), 2800);
  };

  const load = async () => {
    setLoadStatus('loading');
    try {
      const orgs = await api.organizations.mine();
      const startup = orgs.find(o => o.type === 'startup') || null;
      if (!startup) {
        setLoadStatus('none');
        return;
      }
      const prof = await api.startupProfile.get(startup.id);
      setOrg(startup);
      setProfile(prof);
      setLoadStatus('ready');
    } catch (err) {
      setLoadStatus('error');
      notify(err instanceof ApiError ? err.message : 'Could not load your stage.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Which toolkit page we are on; the stored stage drives journey state.
  const storedUrlId = profile ? API_TO_URL[profile.stage] || 'idea' : null;
  const storedIdx = storedUrlId ? Math.max(stages.findIndex(s => s.id === storedUrlId), 0) : -1;
  const idx = isOverview ? Math.max(storedIdx, 0) : Math.max(stages.findIndex(s => s.id === stage), 0);
  const current = stages[idx];
  const canEdit = !!org && EDIT_ROLES.includes(org.my_role);
  const nextStage = storedIdx >= 0 && storedIdx < stages.length - 1 ? stages[storedIdx + 1] : null;

  const statuses = ['Not started', 'Not started', 'Not started', 'Not started', 'Not started'];
  const doneCount = statuses.filter(s => s === 'Approved').length;
  const locked = i => storedIdx >= 0 && i > storedIdx;
  const completed = i => storedIdx >= 0 && i < storedIdx;

  const confirmStageChange = async () => {
    if (!nextStage || !org || savingStage) return;
    setSavingStage(true);
    try {
      const apiStage = nextStage.id === 'early-revenue' ? 'early_revenue' : nextStage.id;
      const prof = await api.startupProfile.update(org.id, {stage: apiStage});
      setProfile(prof);
      setRequest(false);
      notify(`Stage updated to ${nextStage.title}.`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update the stage.');
    } finally {
      setSavingStage(false);
    }
  };

  const criterionRows = current.criteria.map((label, i) => ({
    label,
    status: statuses[i] || 'Not started',
    desc: [
      'Add a concise summary and supporting evidence.',
      'Log your work and attach relevant source material.',
      'Share the latest version for review.',
      'Include evidence that supports your progress.',
      'A mentor will review and sign off this item.'
    ][i]
  }));

  const updatedLabel = profile
    ? new Date(profile.updated_at).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})
    : '—';

  const initials = (user?.display_name || '?')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#stage-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>

      {/* Shared Startup Sidebar & Mobile Drawer */}
      <StartupSidebar
        active="Stage toolkit"
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobile}
        setMobileOpen={setMobile}
        onAction={notify}
      />

      {/* Header */}
      <header className={`sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur sm:px-7 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="flex items-center gap-3">
          <button type="button" className="lg:hidden" onClick={() => setMobile(!mobile)} aria-label="Open menu">
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/startup/dashboard" className="text-sm font-semibold sm:hidden">
            ← Dashboard
          </Link>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17} />
            <input placeholder="Search workspace" className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => notify('You’re all caught up.')} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center">
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <button type="button" className="ml-3 flex items-center gap-2 rounded-lg p-1.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{initials}</span>
            <span className="hidden text-xs sm:block">{user?.display_name || '…'}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main id="stage-main" className={`mx-auto max-w-[1440px] px-4 pb-12 pt-7 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {loadStatus === 'loading' && (
          <div className="flex items-center gap-3 rounded-[10px] border border-[#E5E1D8] bg-white p-6 text-sm text-[#4A5568]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            Loading your stage…
          </div>
        )}
        {loadStatus === 'error' && (
          <div className="rounded-[10px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Could not load your stage.{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}
        {loadStatus === 'none' && (
          <div className="max-w-xl rounded-[10px] border border-[#E5E1D8] bg-white p-6">
            <h2 className="serif text-xl font-semibold">No startup yet</h2>
            <p className="mt-1 text-sm text-[#4A5568]">
              Create your startup organization to track your stage and toolkit.
            </p>
            <Link href="/startup/profile" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
              Go to profile <ArrowRight size={15} />
            </Link>
          </div>
        )}
        {loadStatus === 'ready' && (
        <>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#4A5568]">
              {org?.name} <span className="mx-2 text-[#B8955A]">·</span> Stage toolkit
            </p>
            <h1 className="serif mt-1 text-[30px] font-semibold">{isOverview ? 'Your stage' : `${current.title} toolkit`}</h1>
            <p className="mt-1 text-sm text-[#4A5568]">{isOverview ? 'Where you are and what it takes to move up.' : current.focus + '.'}</p>
          </div>
          {isOverview ? (
            nextStage ? (
              <button
                type="button"
                disabled={!canEdit || savingStage}
                title={!canEdit ? 'Viewers can’t change the stage.' : ''}
                onClick={() => setRequest(true)}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#E5E1D8] disabled:text-[#A0A7B4]"
              >
                {savingStage ? 'Updating…' : `Move to ${nextStage.title}`}
              </button>
            ) : (
              <span className="rounded-lg bg-[#F3EBDD] px-4 py-3 text-sm">You’re in the final stage. Keep your reports current.</span>
            )
          ) : (
            <Link href="/startup/stage" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-medium">
              <ArrowRight className="rotate-180" size={15} /> Stage overview
            </Link>
          )}
        </div>

        <nav aria-label="Startup stages" className="mb-6 overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white p-5">
          <ol className="flex min-w-[720px] items-center">
            {stages.map((s, i) => (
              <li key={s.id} className="flex flex-1 items-center last:flex-none">
                <Link href={paths[i]} aria-current={idx === i ? 'step' : undefined} className="group flex items-center gap-2">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-semibold ${
                      completed(i)
                        ? 'border-ink bg-ink text-white'
                        : i === storedIdx
                        ? 'border-[#B8955A] bg-[#F3EBDD] text-ink'
                        : 'border-[#E5E1D8] bg-white text-[#A0A7B4]'
                    }`}
                  >
                    {completed(i) ? <Check size={16} /> : locked(i) ? <Lock size={13} /> : i + 1}
                  </span>
                  <span>
                    <b className={`block text-xs ${i === storedIdx ? 'text-ink' : 'text-[#4A5568]'}`}>
                      {s.title}
                      {locked(i) && <small className="ml-1">· preview</small>}
                    </b>
                  </span>
                </Link>
                {i < stages.length - 1 && <span className={`mx-3 h-[2px] flex-1 ${completed(i) ? 'bg-ink' : 'bg-[#E5E1D8]'}`} />}
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid items-start gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {isOverview && (
              <section className="rounded-xl border border-[#E7D4B0] bg-[#F3EBDD] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#806236]">Current stage</span>
                    <h2 className="serif mt-1 text-2xl font-semibold">{current.title}: {current.focus}</h2>
                    <p className="mt-2 text-sm text-[#4A5568]">{current.goal}</p>
                  </div>
                  <Link href={paths[idx]} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                    Open {current.title} toolkit <ArrowRight size={15} />
                  </Link>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[#DCC8A4] pt-4">
                  <div>
                    <b className="serif text-xl">{doneCount} / 5</b>
                    <small className="block text-xs text-[#4A5568]">criteria approved</small>
                  </div>
                  <div>
                    <b className="serif text-xl">{current.tools.length}</b>
                    <small className="block text-xs text-[#4A5568]">tools available</small>
                  </div>
                  <div>
                    <b className="serif text-xl">{updatedLabel}</b>
                    <small className="block text-xs text-[#4A5568]">profile last updated</small>
                  </div>
                </div>
              </section>
            )}

            <Card
              title={isOverview ? `Exit criteria for ${current.title}` : current.id === 'mature' ? 'Growth readiness' : `Exit criteria for ${current.title}`}
              action={<span className="text-xs font-semibold text-[#4A5568]">{doneCount} of 5 approved</span>}
            >
              <div className="mb-5 h-2 rounded-full bg-[#E5E1D8]">
                <div className="h-full rounded-full bg-[#B8955A] transition-all" style={{width: `${doneCount * 20}%`}} />
              </div>
              <div className="space-y-3">
                {criterionRows.map(c => (
                  <article
                    key={c.label}
                    className="rounded-lg border border-[#E5E1D8] bg-white p-3 sm:p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F3F4F6] text-[#4A5568]">
                        <Target size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{c.label}</h3>
                          <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] font-semibold text-[#4A5568]">
                            {c.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#4A5568]">{c.desc}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <p className="mt-4 text-xs text-[#4A5568]">
                Mentor sign-off on exit criteria arrives with the readiness workspace.
              </p>
            </Card>

            {!isOverview && (
              <Card title={`Tools for ${current.title}`} action={<span className="text-xs text-[#4A5568]">{current.tools.length} tools</span>}>
                <div className="grid gap-3 md:grid-cols-2">
                  {current.tools.map(([name, description, progress, Icon], i) => (
                    <article key={name} className="group rounded-xl border border-[#E5E1D8] p-4 transition hover:border-[#A0A7B4] hover:shadow-[0_4px_16px_rgba(15,27,45,0.06)]">
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] text-[#806236]">
                          <Icon size={19} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold">
                            {name}
                            {i < 3 && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#B8955A]" title="Required for exit criteria" />}
                          </h3>
                          <p className="mt-1 min-h-10 text-xs leading-5 text-[#4A5568]">{description}</p>
                        </div>
                      </div>
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#4A5568]">
                        <CheckCircle2 size={13} className="text-[#9A7A45]" />
                        {progress}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTool({name, description, progress, Icon})}
                        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#E5E1D8] text-xs font-semibold hover:bg-[#FAF8F4]"
                      >
                        Open tool <ArrowUpRight size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              </Card>
            )}

            {isOverview && (
              <Card
                title="Tools for this stage"
                action={
                  <Link href={paths[idx]} className="text-xs font-semibold text-[#9A7A45]">
                    Open full toolkit <ArrowRight className="inline" size={13} />
                  </Link>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {current.tools.slice(0, 4).map(([name, description, progress, Icon]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setTool({name, description, progress, Icon})}
                      className="flex min-h-20 items-center gap-3 rounded-lg border border-[#E5E1D8] p-3 text-left hover:bg-[#FAF8F4]"
                    >
                      <Icon size={20} className="text-[#9A7A45]" />
                      <span className="min-w-0">
                        <b className="block text-xs">{name}</b>
                        <small className="text-[11px] text-[#4A5568]">{progress}</small>
                      </span>
                      <ArrowUpRight size={15} className="ml-auto" />
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <Card title="Stage journey">
              <div className="grid gap-3 md:grid-cols-2">
                {stages.map((s, i) => (
                  <Link
                    key={s.id}
                    href={paths[i]}
                    className={`rounded-xl border p-4 transition hover:border-[#A0A7B4] ${
                      i === storedIdx ? 'border-[#DCC8A4] bg-[#F3EBDD]' : 'border-[#E5E1D8] bg-white'
                    } ${locked(i) ? 'opacity-65' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{i + 1}. {s.title}</span>
                      {completed(i) ? (
                        <span className="text-[10px] font-semibold text-[#286749]">Completed</span>
                      ) : i === storedIdx ? (
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#806236]">Current</span>
                      ) : (
                        <span className="text-[10px] text-[#4A5568]">Preview</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-[#4A5568]">{s.focus}</p>
                    <p className="mt-3 text-[11px] text-[#4A5568]">{s.tools.slice(0, 3).map(t => t[0]).join(' · ')}</p>
                    <p className="mt-3 text-xs font-medium">{s.goal}</p>
                  </Link>
                ))}
              </div>
            </Card>

            <Card title="Stage history">
              <div className="rounded-lg border border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-6 text-center text-sm text-[#4A5568]">
                No stage changes yet. Your history will appear here as your startup moves up.
              </div>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card title="Your mentor">
              <p className="text-sm text-[#4A5568]">
                No mentor yet. Find one from the mentors workspace to review your exit criteria.
              </p>
              <Link
                href="/startup/mentors"
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#E5E1D8] text-xs font-semibold hover:bg-[#FAF8F4]"
              >
                <MessageCircle className="mr-2 inline" size={14} /> Find a mentor
              </Link>
            </Card>

            <Card title="Readiness score">
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-[#E5E1D8]">
                  <span className="serif text-2xl font-semibold text-[#A0A7B4]">—</span>
                </div>
                <div>
                  <p className="text-xs text-[#4A5568]">out of 100</p>
                  <p className="mt-1 text-xs font-semibold">Not assessed yet</p>
                  <Link href="/startup/readiness" className="mt-2 inline-block text-xs font-semibold text-[#9A7A45]">
                    View breakdown <ArrowRight className="inline" size={13} />
                  </Link>
                </div>
              </div>
            </Card>

            <Card title="Resources">
              <ul className="space-y-3">
                {current.resources.slice(0, 5).map(r => (
                  <li key={r}>
                    <button type="button" onClick={() => notify(`${r} opened.`)} className="flex w-full items-center gap-2 text-left text-xs leading-5 hover:text-[#9A7A45]">
                      <BookOpen size={15} className="shrink-0 text-[#9A7A45]" />
                      {r}
                      <ExternalLink className="ml-auto shrink-0" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => notify('Stage resources opened.')} className="mt-4 text-xs font-semibold text-[#9A7A45]">
                Explore programmes <ArrowRight className="inline" size={13} />
              </button>
            </Card>
          </aside>
        </div>
        </>
        )}
      </main>

      {/* Modals & Tool Drawers */}
      {tool && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F1B2D]/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="tool-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#FAF8F4] shadow-xl">
            <header className="flex items-center justify-between border-b border-[#E5E1D8] bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#F3EBDD] text-[#806236]">
                  <tool.Icon size={20} />
                </span>
                <div>
                  <h2 id="tool-title" className="serif text-xl font-semibold">{tool.name}</h2>
                  <p className="text-xs text-[#4A5568]">{current.title} toolkit · {tool.progress}</p>
                </div>
              </div>
              <button type="button" onClick={() => setTool(null)} aria-label="Close tool" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-[#FAF8F4]">
                <X size={18} />
              </button>
            </header>
            <div className="p-5 sm:p-7">
              <p className="text-sm leading-6 text-[#4A5568]">
                {tool.description} Use this workspace to make progress and attach evidence to your stage criteria.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Workspace notes
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={6}
                    placeholder="Capture your team's progress, decisions or next steps…"
                    className="mt-2 w-full rounded-xl border border-[#E5E1D8] bg-white p-3 text-sm font-normal outline-none focus:border-[#B8955A] focus:ring-2 focus:ring-[#B8955A]/20"
                  />
                  <small className="mt-1 block text-xs font-normal text-[#4A5568]">Kept while this page is open · {note.length} characters</small>
                </label>
                <div className="rounded-xl border border-dashed border-[#E5E1D8] bg-white p-5">
                  <Upload className="mb-3 text-[#9A7A45]" size={20} />
                  <h3 className="text-sm font-semibold">Add supporting evidence</h3>
                  <p className="mt-1 text-xs leading-5 text-[#4A5568]">Attach a document, link or relevant tool entry for mentor review.</p>
                  <button type="button" onClick={() => notify('Evidence upload is ready to connect.')} className="mt-4 min-h-10 rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">
                    Choose evidence
                  </button>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={() => setTool(null)} className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                  Close
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {request && nextStage && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6">
            <button type="button" onClick={() => setRequest(false)} className="float-right" aria-label="Close request">
              <X size={18} />
            </button>
            <h2 className="serif text-2xl font-semibold">Move to {nextStage.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#4A5568]">
              Your startup’s stage updates immediately. Mentor review of exit criteria is tracked separately in the readiness workspace.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setRequest(false)} className="px-4 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStageChange}
                disabled={savingStage}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingStage ? 'Updating…' : `Move to ${nextStage.title}`}
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
