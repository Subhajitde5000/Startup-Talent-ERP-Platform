'use client';
import {useState, useEffect} from 'react';
import Link from 'next/link';
import { StartupSidebar, StartupHeader, Card, Button, NoStartupOrg } from '../../../components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';
import {
  LayoutDashboard, ListTodo, Lightbulb, Briefcase, Menu, Check, Plus,
  ChevronRight, CalendarDays, Clock, MoreHorizontal, CheckCircle2,
  MessageCircle, ArrowRight, ArrowUpRight
} from 'lucide-react';

// Step 5g: the dashboard reads one aggregate payload. The stage labels and
// order mirror the backend enum (idea -> mature); `growth` is what the API
// calls "Early revenue".
const STAGE_ORDER = ['idea', 'prototype', 'early_revenue', 'growth', 'mature'];
const STAGE_LABEL = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature'
};

// Money is stored as NUMERIC -> string. Format with the ISO currency the
// row carries; never invent a currency the API did not send.
const fmtMoney = (value, currency) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: n >= 100000 ? 1 : 0,
      notation: n >= 10000000 ? 'compact' : 'standard'
    }).format(n);
  } catch {
    return String(n);
  }
};

const fmtRunway = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `${n % 1 === 0 ? n : n.toFixed(1)} months`;
};

const metricOf = (metrics, key) => (metrics || []).find(m => m.metric_key === key) || null;

const fmtCount = n => (typeof n === 'number' ? n : 0);

const relativeTime = iso => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const fmtDay = iso => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const initialsOf = name =>
  (name || '?')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

// ReadinessStatus (backend enum): the only state that counts as met.
const isSignedOff = s => s === 'signed_off';

// task_status enum -> the wording the tasks page uses.
const STATUS_LABEL = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  blocked: 'Blocked',
  done: 'Done'
};

export default function StartupDashboard() {
  const { user } = useAuth();
  const [compact, setCompact] = useState(false);
  const [darkmode, setDarkmode] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [tab, setTab] = useState('My tasks');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');

  const [orgChecked, setOrgChecked] = useState(false);
  const [hasOrg, setHasOrg] = useState(true);
  const [orgName, setOrgName] = useState('');

  // --- Step 5g: one aggregate read (dashboard-summary) ----------------------
  const [summary, setSummary] = useState(null);
  const [summaryStatus, setSummaryStatus] = useState('loading'); // loading | ready | error
  const [summaryError, setSummaryError] = useState('');
  // The checklist is the stage's real exit criteria (Step 5i source of truth),
  // read-only here — signing off lives on /startup/stage.
  const [criteria, setCriteria] = useState([]);
  const [criteriaStatus, setCriteriaStatus] = useState('idle'); // idle | loading | ready | error
  const [criteriaError, setCriteriaError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setSummaryStatus('loading');
    setCriteriaStatus('idle');
    setCriteria([]);
    (async () => {
      let startup = null;
      try {
        const orgs = await api.organizations.mine();
        startup = orgs.find(o => o.type === 'startup') || null;
      } catch (err) {
        if (!alive) return;
        setHasOrg(true);
        setSummaryError(err instanceof ApiError ? err.message : 'Could not load your organization.');
        setSummaryStatus('error');
        setOrgChecked(true);
        return;
      }
      if (!alive) return;
      if (!startup) {
        setHasOrg(false);
        setOrgChecked(true);
        return;
      }
      setHasOrg(true);
      setOrgName(startup.name || '');
      setOrgChecked(true);

      try {
        const data = await api.dashboard.summary(startup.id);
        if (!alive) return;
        setSummary(data);
        setSummaryStatus('ready');
        // The checklist needs the *current* stage's criteria, which the
        // summary names but does not enumerate.
        setCriteriaStatus('loading');
        try {
          const board = await api.stage.criteria(startup.id, data.stage.stage);
          if (!alive) return;
          setCriteria(board.items.filter(i => i.is_exit_criterion));
          setCriteriaStatus('ready');
        } catch (err) {
          if (!alive) return;
          setCriteriaError(
            err instanceof ApiError ? err.message : 'Could not load the stage checklist.'
          );
          setCriteriaStatus('error');
        }
      } catch (err) {
        if (!alive) return;
        setSummaryError(
          err instanceof ApiError ? err.message : 'Could not load your dashboard.'
        );
        setSummaryStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const showToast = t => {
    setToast(t);
    setTimeout(() => setToast(''), 2600);
  };

  const stageKey = summary?.stage?.stage || null;
  const stageLabel = stageKey ? STAGE_LABEL[stageKey] || stageKey : '';
  const stageIndex = stageKey ? STAGE_ORDER.indexOf(stageKey) : -1;
  const nextStage = stageIndex >= 0 && stageIndex < STAGE_ORDER.length - 1
    ? STAGE_LABEL[STAGE_ORDER[stageIndex + 1]]
    : null;
  const criteriaTotal = summary?.stage?.exit_criteria_total ?? 0;
  const criteriaDone = summary?.stage?.exit_criteria_signed_off ?? 0;
  const criteriaPct = criteriaTotal ? Math.round((criteriaDone / criteriaTotal) * 100) : 0;

  const mrr = metricOf(summary?.metrics, 'mrr');
  const burn = metricOf(summary?.metrics, 'burn');
  const runway = metricOf(summary?.metrics, 'runway_months');
  // A restricted metric is absent, not zero: `restricted` names what the
  // server withheld from this role.
  const moneyRestricted = (summary?.restricted || []).length > 0;
  const readinessPct = summary?.readiness?.readiness_pct;
  const signedOffRemaining = summary?.readiness?.signed_off_remaining;
  const taskItems = summary?.tasks?.items || [];
  const nextMilestone = summary?.milestones?.next || null;
  const activity = summary?.recent_activity || [];
  const teamMembers = summary?.team?.members || [];

  // Every card the summary cannot fill is reported by the server itself, so
  // "not built yet" is never rendered as an empty or invented number.
  const unavailableReason = key =>
    (summary?.unavailable || []).find(u => u.key === key) || null;

  const stageCriteriaDone = criteria.filter(c => isSignedOff(c.status)).length;

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
                {/* The stage is changed on /startup/stage, which owns the
                    write; the dashboard only reports where the org stands. */}
                <span className="text-sm font-semibold text-ink" aria-label={`Startup stage: ${stageLabel || 'unknown'}`}>
                  {summaryStatus === 'ready' ? stageLabel : '—'}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#4A5568]">
                {summaryStatus === 'error' ? (
                  <span className="text-[#9A3A3A]">Could not load stage progress.</span>
                ) : summaryStatus === 'loading' ? (
                  'Loading stage progress…'
                ) : nextStage ? (
                  <>
                    Next stage: <b className="font-semibold text-ink">{nextStage}</b> ·{' '}
                    <span>
                      {criteriaDone} of {criteriaTotal} exit criteria met
                    </span>
                  </>
                ) : (
                  <>
                    You’ve reached the <b className="text-ink">{stageLabel}</b> stage.
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
            {STAGE_ORDER.map((key, i) => {
              const s = STAGE_LABEL[key];
              return (
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
                {i < STAGE_ORDER.length - 1 && (
                  <div className={`mx-2 h-px flex-1 sm:mx-4 ${i < stageIndex ? 'bg-ink' : 'bg-[#E5E1D8]'}`} />
                )}
              </div>
              );
            })}
          </div>
        </section>

        {/* Top 4 Metric Cards (Step 5g: real readiness / metrics / task counts).
            A withheld or missing value renders as an em dash and says why —
            it is never filled with a plausible-looking number. */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            {
              label: 'Readiness score',
              value: readinessPct === null || readinessPct === undefined ? '—' : String(readinessPct),
              unit: readinessPct === null || readinessPct === undefined ? '' : '/ 100',
              detail: summary?.readiness
                ? `${summary.readiness.criteria_signed_off} of ${summary.readiness.criteria_total} criteria signed off`
                : 'Not scored yet',
              tone: 'good'
            },
            {
              label: 'Monthly recurring revenue',
              value: moneyRestricted
                ? '—'
                : mrr
                ? fmtMoney(mrr.value, mrr.currency)
                : '—',
              unit: '',
              detail: moneyRestricted
                ? 'Hidden for your role'
                : mrr
                ? 'Startup-reported, latest period'
                : 'No metric reported yet',
              tone: 'good'
            },
            {
              label: 'Runway',
              value: moneyRestricted ? '—' : runway ? fmtRunway(runway.value) : '—',
              unit: '',
              detail: moneyRestricted
                ? 'Hidden for your role'
                : burn
                ? `Burn ${fmtMoney(burn.value, burn.currency)} / mo`
                : 'No burn reported yet',
              tone: 'muted'
            },
            {
              // dashboard-summary counts tasks assigned to the caller, so
              // this is "mine", not the whole team's.
              label: 'My open tasks',
              value: summaryStatus === 'ready' ? String(fmtCount(summary?.tasks?.total_open)) : '—',
              unit: '',
              detail: summary?.tasks
                ? `${summary.tasks.due_this_week} due this week${
                    summary.tasks.overdue ? ` · ${summary.tasks.overdue} overdue` : ''
                  }`
                : '',
              tone: summary?.tasks?.overdue ? 'warn' : 'muted'
            }
          ].map(card => (
            <section key={card.label} className="rounded-xl border border-[#E5E1D8] bg-white p-4 sm:p-5">
              <p className="text-xs leading-5 text-[#4A5568]">{card.label}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="serif text-[29px] font-semibold">{card.value}</span>
                <span className="text-sm text-[#4A5568]">{card.unit}</span>
              </div>
              <p className={`mt-1 text-xs ${
                card.tone === 'warn'
                  ? 'text-[#B7791F]'
                  : card.tone === 'muted'
                  ? 'text-[#4A5568]'
                  : 'text-[#2E7D5B]'
              }`}>
                {card.detail}
              </p>
            </section>
          ))}
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {/* Stage Checklist */}
            <Card
              title={`Stage checklist: ${stageLabel || '—'}`}
              action={
                <Link href="/startup/stage" className="text-sm font-medium text-[#9A7A45]">
                  See all <ArrowRight className="ml-1 inline" size={14} />
                </Link>
              }
            >
              {criteriaStatus === 'loading' && (
                <div className="space-y-2" aria-busy="true" role="status">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="h-9 animate-pulse rounded-lg bg-[#F4F1EA]" />
                  ))}
                  <span className="sr-only">Loading stage checklist…</span>
                </div>
              )}
              {criteriaStatus === 'error' && (
                <div role="alert">
                  <p className="text-sm text-[#4A5568]">{criteriaError}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey(k => k + 1)}
                    className="mt-3 min-h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              )}
              {criteriaStatus === 'ready' && criteria.length === 0 && (
                <p className="text-sm text-[#4A5568]" role="status">
                  No exit criteria are defined for this stage yet.
                </p>
              )}
              {criteriaStatus === 'ready' && criteria.length > 0 && (
                <>
                  <div className="mb-4 flex items-center justify-between text-xs text-[#4A5568]">
                    <span>
                      {stageCriteriaDone} of {criteria.length} exit criteria signed off
                    </span>
                    <span className="font-semibold text-ink">
                      {Math.round((stageCriteriaDone / criteria.length) * 100)}%
                    </span>
                  </div>
                  <div
                    className="mb-5 h-2 overflow-hidden rounded-full bg-[#E5E1D8]"
                    role="progressbar"
                    aria-valuenow={Math.round((stageCriteriaDone / criteria.length) * 100)}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label="Stage checklist progress"
                  >
                    <div
                      className="h-full rounded-full bg-[#B8955A] transition-all duration-500"
                      style={{width: `${Math.round((stageCriteriaDone / criteria.length) * 100)}%`}}
                    />
                  </div>
                  {/* Read-only here: sign-off is a mentor/owner action that
                      lives on /startup/stage. Ticking a box here would be a
                      write to a record this page does not own. */}
                  <ul className="space-y-1">
                    {criteria.map(c => {
                      const isDone = isSignedOff(c.status);
                      return (
                        <li key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg px-2">
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                              isDone ? 'border-ink bg-ink text-white' : 'border-[#A0A7B4]'
                            }`}
                            aria-hidden="true"
                          >
                            {isDone && <Check size={11} />}
                          </span>
                          <span className={`flex-1 text-sm ${isDone ? 'text-[#A0A7B4] line-through' : 'text-ink'}`}>
                            {c.title}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isDone
                                ? 'bg-[#E7F3EC] text-[#286749]'
                                : c.status === 'submitted'
                                ? 'bg-[#FFF3D6] text-[#8A5700]'
                                : c.status === 'rejected'
                                ? 'bg-[#FCE8E6] text-[#B42318]'
                                : 'bg-[#F3F4F6] text-[#4A5568]'
                            }`}
                          >
                            {isDone
                              ? 'Signed off'
                              : c.status === 'submitted'
                              ? 'Awaiting sign-off'
                              : c.status === 'rejected'
                              ? 'Needs work'
                              : c.status === 'in_progress'
                              ? 'In progress'
                              : 'Not started'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
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
                {/* "Team" is not in the payload (the summary carries only the
                    caller's tasks), so it is not offered rather than showing
                    my tasks under a team label. */}
                {['My tasks', 'Milestones'].map(x => (
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
              {summaryStatus === 'loading' && (
                <div className="space-y-2 py-2" aria-busy="true" role="status">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-11 animate-pulse rounded-lg bg-[#F4F1EA]" />
                  ))}
                  <span className="sr-only">Loading tasks and milestones…</span>
                </div>
              )}
              {summaryStatus === 'error' && (
                <div role="alert" className="py-2">
                  <p className="text-sm text-[#4A5568]">{summaryError}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey(k => k + 1)}
                    className="mt-3 min-h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              )}
              {summaryStatus === 'ready' && tab === 'Milestones' && (
                nextMilestone ? (
                  <div className="flex items-start gap-0 overflow-x-auto py-3">
                    <div className="min-w-[125px] flex-1">
                      <div className="flex items-center">
                        <span className="h-3 w-3 rounded-full bg-[#B8955A] ring-4 ring-[#F3EBDD]" />
                        <span className="h-px flex-1 bg-[#E5E1D8]" />
                      </div>
                      <p className="mt-3 text-xs font-semibold">{nextMilestone.name}</p>
                      <small className="text-[#4A5568]">
                        {fmtDay(nextMilestone.target_date) || 'No date'}
                        {nextMilestone.status ? ` · ${nextMilestone.status.replace(/_/g, ' ')}` : ''}
                      </small>
                    </div>
                  </div>
                ) : (
                  <p className="py-3 text-sm text-[#4A5568]" role="status">
                    No upcoming milestone. {summary.milestones.total > 0
                      ? `${summary.milestones.total} milestone${summary.milestones.total === 1 ? '' : 's'} tracked, none still ahead.`
                      : 'Add one from the tasks page.'}
                  </p>
                )
              )}
              {summaryStatus === 'ready' && tab !== 'Milestones' && taskItems.length === 0 && (
                <p className="py-3 text-sm text-[#4A5568]" role="status">
                  Nothing open right now.
                </p>
              )}
              {summaryStatus === 'ready' && tab !== 'Milestones' && taskItems.length > 0 && (
                <div className="divide-y divide-[#E5E1D8]">
                  {taskItems.map(t => (
                    <Link
                      key={t.id}
                      href="/startup/tasks"
                      className="flex min-h-[54px] items-center gap-3 py-2 hover:bg-[#FAF8F4]"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          t.is_overdue ? 'bg-[#B42318]' : t.is_due_today ? 'bg-[#B7791F]' : 'bg-[#E5E1D8]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-sm">{t.title}</span>
                      <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[11px] text-[#4A5568]">
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                          t.is_overdue
                            ? 'bg-[#FCE8E6] text-[#B42318]'
                            : t.is_due_today
                            ? 'bg-[#FFF3D6] text-[#8A5700]'
                            : 'bg-[#F3F4F6] text-[#4A5568]'
                        }`}
                      >
                        {t.is_overdue ? 'Overdue' : t.is_due_today ? 'Due today' : fmtDay(t.due_on) || 'No date'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Investor interest (Step 9) and Hiring requests (Step 7) are not
                built yet, so both cards are hidden rather than filled with
                placeholder numbers. The server names them in `unavailable`. */}
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
                  onClick={() =>
                    showToast(
                      unavailableReason('readiness_breakdown')?.reason ||
                        'The readiness score is stored as one figure.'
                    )
                  }
                >
                  <MoreHorizontal size={18} className="text-[#4A5568]" />
                </button>
              }
            >
              {summaryStatus === 'loading' && (
                <div className="h-28 animate-pulse rounded-xl bg-[#F4F1EA]" aria-busy="true" role="status">
                  <span className="sr-only">Loading readiness…</span>
                </div>
              )}
              {summaryStatus === 'ready' && (
                <>
                  <div className="flex items-center gap-5">
                    <div
                      className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
                      style={{
                        background: `conic-gradient(#B8955A 0deg ${
                          (readinessPct ?? 0) * 3.6
                        }deg, #E5E1D8 ${(readinessPct ?? 0) * 3.6}deg 360deg)`
                      }}
                    >
                      <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-white">
                        <div className="text-center">
                          <span className="serif text-3xl font-semibold">{readinessPct ?? '—'}</span>
                          <span className="block text-[10px] text-[#4A5568]">out of 100</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      {/* Only one readiness score is stored. The checklist /
                          traction / mentor split is not built yet, so it is
                          named instead of drawn as invented bars. */}
                      <p className="text-xs leading-5 text-[#4A5568]">
                        {unavailableReason('readiness_breakdown')?.reason ||
                          'Only one readiness score is stored so far.'}
                      </p>
                      <p className="text-xs text-[#4A5568]">
                        <b className="text-ink">
                          {summary.readiness.criteria_signed_off} of {summary.readiness.criteria_total}
                        </b>{' '}
                        readiness criteria signed off.
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 flex items-center gap-2 rounded-lg bg-[#F3EBDD] p-3 text-xs font-medium text-[#806236]">
                    <Clock size={15} />
                    {summary.readiness.is_ready
                      ? 'Readiness is complete.'
                      : `${signedOffRemaining} item${signedOffRemaining === 1 ? '' : 's'} left for sign-off`}
                  </p>
                </>
              )}
              <Link href="/startup/readiness" className="mt-4 inline-block text-sm font-semibold text-[#9A7A45]">
                Improve your score <ArrowRight className="inline" size={14} />
              </Link>
            </Card>

            {/* Mentor card (Step 8) is hidden until mentorship ships; the
                summary reports it under `unavailable`. */}
            {/* Recent Activity Card */}
            <Card
              title="Recent activity"
              action={
                <Link href="/startup/analytics" className="text-xs font-semibold text-[#9A7A45]">
                  View all
                </Link>
              }
            >
              {summaryStatus === 'loading' && (
                <div className="space-y-3" aria-busy="true" role="status">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-9 animate-pulse rounded-lg bg-[#F4F1EA]" />
                  ))}
                  <span className="sr-only">Loading recent activity…</span>
                </div>
              )}
              {summaryStatus === 'ready' && activity.length === 0 && (
                <p className="text-xs leading-5 text-[#4A5568]" role="status">
                  No recorded activity yet. Task, milestone and readiness changes
                  appear here.
                </p>
              )}
              {summaryStatus === 'ready' && activity.length > 0 && (
                <div className="space-y-4">
                  {activity.map((a, i) => (
                    <div key={`${a.event_type}-${a.created_at}-${i}`} className="flex gap-3">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                          a.event_type.includes('sign_off') || a.event_type.includes('completed')
                            ? 'bg-[#E7F3EC] text-[#2E7D5B]'
                            : 'bg-[#F3EBDD] text-[#806236]'
                        }`}
                      >
                        {a.event_type.includes('sign_off') || a.event_type.includes('completed') ? (
                          <CheckCircle2 size={16} />
                        ) : a.event_type.includes('task') ? (
                          <ListTodo size={16} />
                        ) : a.event_type.includes('milestone') ? (
                          <CalendarDays size={16} />
                        ) : (
                          <MessageCircle size={16} />
                        )}
                      </span>
                      <div>
                        <p className="text-xs leading-5">
                          {a.link_url ? (
                            <Link href={a.link_url} className="hover:underline">
                              {a.summary}
                            </Link>
                          ) : (
                            a.summary
                          )}
                        </p>
                        <small className="text-[11px] text-[#4A5568]">
                          {a.actor_name ? `${a.actor_name} · ` : ''}
                          {relativeTime(a.created_at)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Team card (real). The document vault is Step 4 and not built,
                so its list is hidden rather than showing invented files. */}
            <Card title="Team">
              {summaryStatus === 'loading' && (
                <div className="h-16 animate-pulse rounded-lg bg-[#F4F1EA]" aria-busy="true" role="status">
                  <span className="sr-only">Loading team…</span>
                </div>
              )}
              {summaryStatus === 'ready' && teamMembers.length === 0 && (
                <p className="text-xs text-[#4A5568]" role="status">No teammates yet.</p>
              )}
              {summaryStatus === 'ready' && teamMembers.length > 0 && (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {teamMembers.slice(0, 5).map((m, idx) => (
                        <span
                          key={m.user_id}
                          title={m.display_name || 'Member'}
                          className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[10px] font-semibold ${
                            idx === 0 ? 'bg-ink text-white' : idx === 1 ? 'bg-[#F3EBDD]' : idx === 2 ? 'bg-[#E7F3EC]' : 'bg-[#F3F4F6]'
                          }`}
                        >
                          {initialsOf(m.display_name)}
                        </span>
                      ))}
                      {teamMembers.length > 5 && (
                        <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#F3F4F6] text-[10px] font-semibold">
                          +{teamMembers.length - 5}
                        </span>
                      )}
                    </div>
                    <Link href="/startup/team" className="text-xs font-semibold text-[#9A7A45]">
                      Invite member <Plus className="inline" size={13} />
                    </Link>
                  </div>
                  <ul className="space-y-1.5 border-t border-[#E5E1D8] pt-3">
                    {teamMembers.slice(0, 4).map(m => (
                      <li key={m.user_id} className="flex items-center justify-between text-xs">
                        <span className="truncate">{m.display_name || 'Member'}</span>
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] capitalize text-[#4A5568]">
                          {m.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-[#4A5568]">
                    {summary.team.active_members} active
                    {summary.team.pending_invites > 0
                      ? ` · ${summary.team.pending_invites} invited`
                      : ''}
                  </p>
                </>
              )}
              <Link href="/startup/team" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                Manage team <ArrowRight className="inline" size={13} />
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
