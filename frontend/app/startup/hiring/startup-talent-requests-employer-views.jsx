'use client';

// Step 7t: the startup hiring pages that were still inline demo code in
// hiring-app.jsx — talent search, new hiring request, employer page — plus
// the overview's "Requests" tab. Same APIs as the employer pages (7i/7j +
// org/startup profile); no employer-only extras (scorecards, hires,
// templates). Markup mirrors the original demo layout.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bookmark, CheckCircle2, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { Btn, Card } from '../../../components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';
import { useCareerSearch } from '@/components/career-data';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ViewerRestrictedState,
  errorMessage,
  extractFieldErrors,
  formatMoney,
} from './startup-hiring-shared';

const isManager = (role) => role === 'owner' || role === 'admin';
const isWriter = (role) => role === 'owner' || role === 'admin' || role === 'member';

const STAGE_ORDER = ['idea', 'prototype', 'early_revenue', 'growth', 'mature'];
const STAGE_LABELS = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature',
};
// The demo form's five departments, with the API's enum values.
const REQUEST_DEPARTMENTS = [
  ['engineering', 'Engineering'],
  ['product', 'Product'],
  ['sales', 'Sales'],
  ['operations', 'Operations'],
  ['finance', 'Finance'],
];
const DEPARTMENT_LABELS = {
  engineering: 'Engineering',
  product: 'Product',
  design: 'Design',
  sales: 'Sales',
  marketing: 'Marketing',
  operations: 'Operations',
  finance: 'Finance',
  people: 'People',
  legal: 'Legal',
  support: 'Support',
  other: 'Other',
};
const URGENCY_LABELS = { low: 'Low', normal: 'Medium', high: 'High', urgent: 'Urgent' };
const REQUEST_STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Job created',
  cancelled: 'Cancelled',
};
const AVAILABILITY_LABELS = {
  immediate: 'Available immediately',
  two_weeks: '2 weeks notice',
  one_month: '1 month notice',
  flexible: 'Flexible start',
  not_looking: 'Not actively looking',
};
const EXPERIENCE_OPTIONS = [
  ['', 'Any experience'],
  ['mid', '2–5 years'],
  ['senior', '5–8 years'],
  ['lead', '8+ years'],
];

function FieldError({ children }) {
  if (!children) return null;
  return <span className="mt-1 block text-xs font-normal text-[#B42318]">{children}</span>;
}

function shortDate(value) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
}

function experienceLabel(yrs) {
  if (yrs == null) return null;
  const n = Number(yrs);
  return `${n % 1 ? n.toFixed(1) : n} years`;
}

function isViewerDenied(error) {
  return error instanceof ApiError && error.status === 403;
}

/* ------------------------------------------------------------------ */
/* Overview → Requests tab                                             */
/* ------------------------------------------------------------------ */

export function StartupRequestsCard({ org, myRole, notify }) {
  const router = useRouter();
  const { user } = useAuth();
  const canRead = isWriter(myRole);
  const admin = isManager(myRole);
  const [state, setState] = useState('loading');
  const [err, setErr] = useState('');
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!canRead) return undefined;
    const controller = new AbortController();
    setState('loading');
    api.hiringRequests
      .list(org.id, { limit: 50 }, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setRows(page.items || []);
        setState('ready');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setErr(errorMessage(e, 'Could not load hiring requests.'));
        setState(isViewerDenied(e) ? 'denied' : 'error');
      });
    return () => controller.abort();
  }, [org.id, canRead, reloadKey]);

  const run = async (row, action) => {
    setBusyId(row.id);
    try {
      if (action === 'convert') {
        const job = await api.hiringRequests.convert(row.id);
        notify(`Draft job created for ${row.role_title}.`);
        router.push(`/startup/hiring/jobs/new?jobId=${job.id}`);
        return;
      }
      if (action === 'approve') await api.hiringRequests.approve(row.id);
      if (action === 'reject') await api.hiringRequests.reject(row.id);
      if (action === 'submit') await api.hiringRequests.patch(row.id, { status: 'pending' });
      notify(
        action === 'approve'
          ? 'Request approved.'
          : action === 'reject'
            ? 'Request rejected.'
            : 'Request submitted for approval.'
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify(errorMessage(e, 'Could not update the request.'));
    } finally {
      setBusyId('');
    }
  };

  const actionsFor = (row) => {
    const out = [];
    if (row.status === 'approved' && admin) out.push(['convert', 'Create job post']);
    if (row.status === 'pending' && (row.approver_id ? row.approver_id === user?.id : admin)) {
      out.push(['approve', 'Approve'], ['reject', 'Reject']);
    }
    if (row.status === 'draft' && (admin || row.requested_by === user?.id)) out.push(['submit', 'Submit']);
    return out;
  };

  return (
    <Card
      title="Hiring requests"
      action={
        canRead ? (
          <Link href="/startup/hiring/requests/new" className="text-xs font-semibold text-[#9A7A45]">
            + New request
          </Link>
        ) : null
      }
    >
      {!canRead || state === 'denied' ? (
        <ViewerRestrictedState message="Viewers cannot see hiring requests. Ask an owner or admin for access." />
      ) : state === 'loading' ? (
        <LoadingState label="Loading hiring requests…" />
      ) : state === 'error' ? (
        <ErrorState message={err} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No hiring requests yet"
          description="Capture a hiring need and route it for approval before drafting a job post."
          action={
            <Link href="/startup/hiring/requests/new" className="text-xs font-semibold text-[#9A7A45]">
              + New request
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead className="border-b text-[#4A5568]">
              <tr>
                {['Role', 'Department', 'Urgency', 'Headcount', 'Target start', 'Status', ''].map((x) => (
                  <th key={x} className="py-3">{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#E5E1D8]">
                  <td className="py-4 font-semibold">{r.role_title}</td>
                  <td className="py-4 text-[#4A5568]">{DEPARTMENT_LABELS[r.department] || '—'}</td>
                  <td className="py-4 text-[#4A5568]">{URGENCY_LABELS[r.urgency] || r.urgency}</td>
                  <td className="py-4 text-[#4A5568]">{r.headcount}</td>
                  <td className="py-4 text-[#4A5568]">{shortDate(r.target_start)}</td>
                  <td className="py-4 text-[#4A5568]">{REQUEST_STATUS_LABELS[r.status] || r.status}</td>
                  <td>
                    {r.status === 'fulfilled' && r.job_id ? (
                      <Link href={`/startup/hiring/${r.job_id}`} className="text-[#9A7A45]">
                        View job
                      </Link>
                    ) : (
                      <span className="flex flex-wrap gap-3">
                        {actionsFor(r).map(([action, label]) => (
                          <button
                            key={action}
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => run(r, action)}
                            className={`disabled:opacity-50 ${action === 'reject' ? 'text-[#B42318]' : 'text-[#9A7A45]'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* /startup/hiring/requests/new                                         */
/* ------------------------------------------------------------------ */

const EMPTY_REQUEST = {
  role_title: '',
  department: 'engineering',
  headcount: '1',
  why_now: 'stage_plan',
  urgency: 'normal',
  employment_type: 'full_time',
  work_mode: 'remote',
  monthly_budget: '',
  target_start: '',
  skills: '',
  stage_criterion_id: '',
  justification: '',
};

export function StartupRequestView({ org, myRole, pageHead, notify }) {
  const router = useRouter();
  const canWrite = isWriter(myRole);
  const [form, setForm] = useState(EMPTY_REQUEST);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState('');
  const [criteria, setCriteria] = useState({ state: 'loading', options: [] });
  const [runway, setRunway] = useState(null);

  useEffect(() => {
    if (!canWrite) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    // Stage exit criteria: this stage and the next (the demo showed both).
    api.stage
      .summary(org.id, signal)
      .then(async (summary) => {
        const idx = STAGE_ORDER.indexOf(summary.stage);
        const stages = [summary.stage, STAGE_ORDER[idx + 1]].filter(Boolean);
        const boards = await Promise.all(stages.map((s) => api.stage.criteria(org.id, s, signal)));
        if (signal.aborted) return;
        const options = boards.flatMap((board) =>
          (board.items || [])
            .filter((c) => c.is_exit_criterion)
            .map((c) => ({ id: c.criterion_id, label: `${STAGE_LABELS[board.stage] || board.stage}: ${c.title}` }))
        );
        setCriteria({ state: 'ready', options });
      })
      .catch(() => {
        if (!signal.aborted) setCriteria({ state: 'error', options: [] });
      });
    // Burn + runway for "What this affects"; hidden when either is missing.
    api.metrics
      .latest(org.id, signal)
      .then((latest) => {
        if (signal.aborted) return;
        const value = (key) => {
          const row = (latest.items || []).find((m) => m.metric_key === key);
          const n = row ? Number(row.value) : NaN;
          return Number.isFinite(n) ? n : null;
        };
        const burn = value('burn');
        const months = value('runway_months');
        setRunway(burn && burn > 0 && months != null ? { burn, months } : null);
      })
      .catch(() => {
        if (!signal.aborted) setRunway(null);
      });
    return () => controller.abort();
  }, [org.id, canWrite]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key === 'monthly_budget' ? 'budget_amount' : key]: undefined }));
  };

  const headcount = Math.max(1, Number(form.headcount) || 1);
  const monthly = form.monthly_budget.trim() === '' ? null : Number(form.monthly_budget);
  const monthlyCost = monthly != null && Number.isFinite(monthly) && monthly >= 0 ? monthly * headcount : null;
  const runwayAfter =
    runway && monthlyCost != null ? (runway.months * runway.burn) / (runway.burn + monthlyCost) : null;

  const submit = async (submitForApproval) => {
    setErrors({});
    setFormError('');
    if (!form.role_title.trim()) {
      setErrors({ role_title: 'Role title is required.' });
      return;
    }
    if (monthly != null && (!Number.isFinite(monthly) || monthly < 0)) {
      setErrors({ budget_amount: 'Enter the monthly budget as a number, e.g. 120000.' });
      return;
    }
    setBusy(submitForApproval ? 'submit' : 'draft');
    try {
      await api.hiringRequests.create(org.id, {
        role_title: form.role_title.trim(),
        department: form.department,
        headcount,
        why_now: form.why_now,
        urgency: form.urgency,
        employment_type: form.employment_type,
        work_mode: form.work_mode,
        // The request API stores an annual per-hire budget (same field as
        // /employer/requests/new); this form asks monthly, so ×12.
        budget_amount: monthly == null ? null : (Math.round(monthly * 12 * 100) / 100).toFixed(2),
        currency: 'INR',
        target_start: form.target_start || null,
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        stage_criterion_id: form.stage_criterion_id || null,
        justification: form.justification.trim() || null,
        submit: submitForApproval,
      });
      notify(submitForApproval ? 'Hiring request submitted for approval.' : 'Request saved as draft.');
      setTimeout(() => router.push('/startup/hiring'), 700);
    } catch (e) {
      const fields = extractFieldErrors(e);
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(errorMessage(e, 'Could not save the request.'));
    } finally {
      setBusy('');
    }
  };

  const input = 'mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm';
  const select = 'mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3';

  return (
    <>
      {pageHead(
        'New hiring request',
        'Capture the hiring need before drafting a job post.',
        <Link href="/startup/hiring" className="text-sm text-[#4A5568]">Cancel</Link>
      )}
      {!canWrite ? (
        <ViewerRestrictedState message="Viewers cannot create hiring requests. Ask an owner or admin for member access." />
      ) : (
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit(true);
            }}
            className="space-y-5 lg:col-span-2"
          >
            <Card title="Role details">
              <label className="block text-sm font-medium">
                Role title
                <input
                  required
                  value={form.role_title}
                  onChange={set('role_title')}
                  placeholder="e.g. Backend Engineer"
                  aria-invalid={Boolean(errors.role_title)}
                  className={input}
                />
                <FieldError>{errors.role_title}</FieldError>
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Department
                  <select value={form.department} onChange={set('department')} className={select}>
                    {REQUEST_DEPARTMENTS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <FieldError>{errors.department}</FieldError>
                </label>
                <label className="text-sm font-medium">
                  Headcount
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.headcount}
                    onChange={set('headcount')}
                    aria-invalid={Boolean(errors.headcount)}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"
                  />
                  <FieldError>{errors.headcount}</FieldError>
                </label>
                <label className="text-sm font-medium">
                  Why now?
                  <select value={form.why_now} onChange={set('why_now')} className={select}>
                    <option value="stage_plan">Stage plan</option>
                    <option value="growth">Growth</option>
                    <option value="replacement">Replacement</option>
                    <option value="skill_gap">Skill gap</option>
                  </select>
                  <FieldError>{errors.why_now}</FieldError>
                </label>
                <label className="text-sm font-medium">
                  Urgency
                  <select value={form.urgency} onChange={set('urgency')} className={select}>
                    <option value="normal">Medium</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                  <FieldError>{errors.urgency}</FieldError>
                </label>
                <label className="text-sm font-medium">
                  Employment type
                  <select value={form.employment_type} onChange={set('employment_type')} className={select}>
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="contract">Contract</option>
                  </select>
                  <FieldError>{errors.employment_type}</FieldError>
                </label>
                <label className="text-sm font-medium">
                  Work mode
                  <select value={form.work_mode} onChange={set('work_mode')} className={select}>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                  <FieldError>{errors.work_mode}</FieldError>
                </label>
              </div>
            </Card>

            <Card title="Plan and budget">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Budget per hire (monthly, ₹)
                  <input
                    inputMode="decimal"
                    value={form.monthly_budget}
                    onChange={set('monthly_budget')}
                    placeholder="e.g. 120000"
                    aria-invalid={Boolean(errors.budget_amount)}
                    className={input}
                  />
                  <FieldError>{errors.budget_amount}</FieldError>
                </label>
                <label className="text-sm font-medium">
                  Target start date
                  <input
                    type="date"
                    value={form.target_start}
                    onChange={set('target_start')}
                    aria-invalid={Boolean(errors.target_start)}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"
                  />
                  <FieldError>{errors.target_start}</FieldError>
                </label>
              </div>
              <label className="mt-4 block text-sm font-medium">
                Skills and must-haves
                <input
                  value={form.skills}
                  onChange={set('skills')}
                  placeholder="Add relevant skills, separated by commas"
                  aria-invalid={Boolean(errors.skills)}
                  className={input}
                />
                <FieldError>{errors.skills}</FieldError>
              </label>
              <label className="mt-4 block text-sm font-medium">
                Link to stage criterion
                <select
                  value={form.stage_criterion_id}
                  onChange={set('stage_criterion_id')}
                  disabled={criteria.state === 'loading'}
                  aria-invalid={Boolean(errors.stage_criterion_id)}
                  className={select}
                >
                  <option value="">
                    {criteria.state === 'loading'
                      ? 'Loading stage criteria…'
                      : criteria.state === 'error'
                        ? 'Stage criteria unavailable'
                        : criteria.options.length
                          ? 'Not linked'
                          : 'No stage exit criteria set up'}
                  </option>
                  {criteria.options.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <FieldError>{errors.stage_criterion_id}</FieldError>
              </label>
              <label className="mt-4 block text-sm font-medium">
                Why this role now?
                <textarea
                  rows={3}
                  value={form.justification}
                  onChange={set('justification')}
                  placeholder="How will this hire move the startup forward?"
                  aria-invalid={Boolean(errors.justification)}
                  className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
                <FieldError>{errors.justification}</FieldError>
              </label>
            </Card>

            {formError && (
              <p role="alert" className="rounded-lg border border-[#F3C6C6] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Btn secondary disabled={Boolean(busy)} onClick={() => submit(false)}>
                {busy === 'draft' ? 'Saving…' : 'Save draft'}
              </Btn>
              <button
                type="submit"
                disabled={Boolean(busy)}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === 'submit' ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>

          <Card title="What this affects">
            <div className="rounded-lg bg-[#F3EBDD] p-4">
              <p className="text-xs text-[#4A5568]">Estimated monthly cost</p>
              <b className="serif mt-1 block text-2xl">
                {monthlyCost != null ? `${formatMoney(monthlyCost)} / mo` : 'Enter a budget'}
              </b>
              {monthlyCost != null && headcount > 1 && (
                <p className="mt-1 text-[11px] text-[#4A5568]">{headcount} × {formatMoney(monthly)}</p>
              )}
              {runway && runwayAfter != null && (
                <p className="mt-2 text-xs">
                  Estimated runway: <b>{runway.months.toFixed(1).replace(/\.0$/, '')} → {runwayAfter.toFixed(1)} months</b>
                </p>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[#4A5568]">
              {runway
                ? 'Illustrative estimate based on your latest burn and runway metrics. Confirm budget with an Owner before publishing.'
                : 'Add burn and runway metrics to see the runway impact. Confirm budget with an Owner before publishing.'}
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* /startup/hiring/talent                                              */
/* ------------------------------------------------------------------ */

const SAVED_SHORTLIST_NAME = 'Saved candidates';

export function StartupTalentView({ org, myRole, pageHead, notify }) {
  const canSource = isWriter(myRole);
  const [query, setQuery] = useState('');
  const [skill, setSkill] = useState('');
  const [experience, setExperience] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sort, setSort] = useState('recent');
  const q = useCareerSearch(query.trim());
  const skillQ = useCareerSearch(skill.trim());
  const locationQ = useCareerSearch(location.trim());

  const [search, setSearch] = useState({ state: 'loading', items: [], total: 0, error: '' });
  const [searchKey, setSearchKey] = useState(0);
  const [shortlist, setShortlist] = useState(null); // latest shortlist detail
  const [shortlistKey, setShortlistKey] = useState(0);
  const [savingId, setSavingId] = useState('');
  const [openJobs, setOpenJobs] = useState({ state: 'loading', items: [] });

  const [inviteTarget, setInviteTarget] = useState(null);
  const [inviteJob, setInviteJob] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [inviteErrors, setInviteErrors] = useState({});
  const [inviteError, setInviteError] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  useEffect(() => {
    if (!canSource) return undefined;
    const controller = new AbortController();
    setSearch((s) => ({ ...s, state: 'loading', error: '' }));
    api.talent
      .search(
        org.id,
        {
          q: q || undefined,
          skill: skillQ || undefined,
          experience: experience || undefined,
          location: locationQ || undefined,
          availability: availability || undefined,
          preferred_mode: remoteOnly ? 'remote' : undefined,
          sort,
          limit: 50,
        },
        controller.signal
      )
      .then((page) => {
        if (!controller.signal.aborted) setSearch({ state: 'ready', items: page.items || [], total: page.total, error: '' });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setSearch({ state: isViewerDenied(e) ? 'denied' : 'error', items: [], total: 0, error: errorMessage(e, 'Could not search talent.') });
      });
    return () => controller.abort();
  }, [org.id, canSource, q, skillQ, experience, locationQ, availability, remoteOnly, sort, searchKey]);

  useEffect(() => {
    if (!canSource) return undefined;
    const controller = new AbortController();
    api.talent
      .shortlists(org.id, { limit: 1 }, controller.signal)
      .then((page) => {
        const latest = page.items?.[0];
        return latest ? api.talent.shortlist(latest.id, controller.signal) : null;
      })
      .then((detail) => {
        if (!controller.signal.aborted) setShortlist(detail);
      })
      .catch(() => {
        if (!controller.signal.aborted) setShortlist(null);
      });
    return () => controller.abort();
  }, [org.id, canSource, shortlistKey]);

  useEffect(() => {
    if (!canSource) return undefined;
    const controller = new AbortController();
    api.jobs
      .list(org.id, { status: 'open', limit: 100 }, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setOpenJobs({ state: 'ready', items: page.items || [] });
      })
      .catch(() => {
        if (!controller.signal.aborted) setOpenJobs({ state: 'error', items: [] });
      });
    return () => controller.abort();
  }, [org.id, canSource]);

  const savedIds = useMemo(() => new Set((shortlist?.members || []).map((m) => m.user_id)), [shortlist]);

  const toggleSave = async (cand) => {
    setSavingId(cand.user_id);
    try {
      if (shortlist && savedIds.has(cand.user_id)) {
        await api.talent.removeMember(shortlist.id, cand.user_id);
        notify(`Removed ${cand.display_name} from ${shortlist.name}.`);
      } else {
        let target = shortlist;
        if (!target) target = await api.talent.createShortlist(org.id, { name: SAVED_SHORTLIST_NAME });
        await api.talent.addMember(target.id, cand.user_id);
        notify(`Saved ${cand.display_name} to ${target.name}.`);
      }
      setShortlistKey((k) => k + 1);
    } catch (e) {
      notify(
        e instanceof ApiError && e.code === 'ALREADY_IN_SHORTLIST'
          ? `${cand.display_name} is already in this shortlist.`
          : errorMessage(e, 'Could not update the shortlist.')
      );
    } finally {
      setSavingId('');
    }
  };

  const openInvite = (cand) => {
    setInviteTarget(cand);
    setInviteJob(openJobs.items[0]?.id || '');
    setInviteNote('');
    setInviteErrors({});
    setInviteError('');
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!inviteTarget || !inviteJob) return;
    setInviteBusy(true);
    setInviteErrors({});
    setInviteError('');
    try {
      const sent = await api.talent.sendOutreach(org.id, {
        candidate_user_id: inviteTarget.user_id,
        job_id: inviteJob,
        note: inviteNote.trim() || null,
      });
      notify(`Invite to apply sent to ${sent.candidate_name} for ${sent.job_title}.`);
      setInviteTarget(null);
    } catch (err) {
      const fields = extractFieldErrors(err);
      setInviteErrors(fields);
      if (!Object.keys(fields).length) {
        setInviteError(
          err instanceof ApiError && err.status === 429
            ? err.message || 'Daily outreach limit reached. It resets at midnight UTC.'
            : errorMessage(err, 'Could not send the invite.')
        );
      }
    } finally {
      setInviteBusy(false);
    }
  };

  const field = 'mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3';

  return (
    <>
      {pageHead(
        'Talent search',
        'Find candidates who chose to be discoverable.',
        <Link href="/startup/hiring" className="text-sm font-semibold text-[#9A7A45]">
          Back to hiring
        </Link>
      )}

      {!canSource || search.state === 'denied' ? (
        <ViewerRestrictedState message="Viewers cannot access talent search. Ask an owner or admin for member access." />
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#806236]">
            <LockKeyhole className="mr-2 inline" size={14} />
            Search results are available. Messaging candidates arrives with Messages — invite them to apply to an open job instead.
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-4">
            <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h2 className="font-semibold">Filters</h2>
              <label className="mt-4 block text-xs font-medium">
                Role or keywords
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. backend engineer"
                  className={field}
                />
              </label>
              <label className="mt-4 block text-xs font-medium">
                Skills
                <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Node.js" className={field} />
              </label>
              <label className="mt-4 block text-xs font-medium">
                Experience
                <select value={experience} onChange={(e) => setExperience(e.target.value)} className={`${field} bg-white`}>
                  {EXPERIENCE_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block text-xs font-medium">
                Location
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Any location" className={field} />
              </label>
              <label className="mt-4 block text-xs font-medium">
                Availability
                <select value={availability} onChange={(e) => setAvailability(e.target.value)} className={`${field} bg-white`}>
                  <option value="">Anytime</option>
                  {['immediate', 'two_weeks', 'one_month', 'flexible'].map((v) => (
                    <option key={v} value={v}>{AVAILABILITY_LABELS[v]}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 flex gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => setRemoteOnly(e.target.checked)}
                  className="accent-ink"
                />
                Remote preference
              </label>
              <p className="mt-4 text-[10px] leading-4 text-[#4A5568]">
                We don’t offer filters for age, gender, religion, caste, nationality or marital status.
              </p>
            </aside>

            <div className="space-y-3 lg:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#4A5568]">
                  {search.state === 'ready'
                    ? `${search.total} candidate${search.total === 1 ? '' : 's'} opted in to discovery`
                    : ' '}
                </p>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort candidates"
                  className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs"
                >
                  <option value="recent">Recently active</option>
                  <option value="experience">Experience</option>
                </select>
              </div>
              {search.state === 'loading' ? (
                <LoadingState label="Searching discoverable candidates…" />
              ) : search.state === 'error' ? (
                <ErrorState message={search.error} onRetry={() => setSearchKey((k) => k + 1)} />
              ) : search.items.length === 0 ? (
                <EmptyState
                  title="No candidates match these filters"
                  description="Only candidates who opted in to discovery appear here. Try fewer filters."
                />
              ) : (
                search.items.map((p) => {
                  const meta = [p.headline, experienceLabel(p.total_experience_yrs), p.current_location].filter(Boolean);
                  const saved = savedIds.has(p.user_id);
                  return (
                    <article key={p.user_id} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                      <div className="flex flex-wrap items-start gap-3">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F3EBDD] font-semibold">
                          {p.avatar_initials || p.display_name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold">{p.display_name}</h3>
                          <p className="text-xs text-[#4A5568]">{meta.join(' · ') || 'Profile details not shared'}</p>
                          {(p.skills || []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {p.skills.map((s) => (
                                <span key={s} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {AVAILABILITY_LABELS[p.availability] && (
                          <span className="rounded-full bg-[#E7F3EC] px-2.5 py-1 text-[10px] font-semibold text-[#286749]">
                            {AVAILABILITY_LABELS[p.availability]}
                          </span>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#E5E1D8] pt-3">
                        <button
                          type="button"
                          disabled
                          title="Messaging arrives with Messages (Step 11)."
                          className="rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold disabled:opacity-50"
                        >
                          Message
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSave(p)}
                          disabled={savingId === p.user_id}
                          className="rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold disabled:opacity-50"
                        >
                          <Bookmark className="mr-1 inline" size={13} />
                          {saved ? 'Saved' : 'Save to shortlist'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openInvite(p)}
                          disabled={openJobs.state !== 'ready' || openJobs.items.length === 0}
                          title={openJobs.state === 'ready' && openJobs.items.length === 0 ? 'Publish a job first to invite candidates.' : undefined}
                          className="rounded-lg bg-ink px-3 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Invite to apply
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
              {shortlist && (
                <p className="text-[11px] text-[#4A5568]">
                  Saving adds candidates to your latest shortlist, “{shortlist.name}” ({shortlist.member_count}).
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {inviteTarget && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="invite-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="invite-title" className="serif text-2xl font-semibold">Invite to apply · {inviteTarget.display_name}</h2>
              <button type="button" onClick={() => setInviteTarget(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={sendInvite} className="space-y-3">
              <label className="block text-sm">
                Open job
                <select
                  value={inviteJob}
                  onChange={(e) => setInviteJob(e.target.value)}
                  aria-invalid={Boolean(inviteErrors.job_id)}
                  className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3"
                >
                  {openJobs.items.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
                <FieldError>{inviteErrors.job_id}</FieldError>
              </label>
              <label className="block text-sm">
                Note (optional)
                <textarea
                  rows={3}
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                  placeholder="Why this role could be a fit"
                  aria-invalid={Boolean(inviteErrors.note)}
                  className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
                <FieldError>{inviteErrors.note}</FieldError>
              </label>
              {inviteError && <p role="alert" className="text-xs text-[#B42318]">{inviteError}</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setInviteTarget(null)} className="min-h-10 px-4 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteBusy || !inviteJob}
                  className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {inviteBusy ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* /startup/hiring/employer-page                                        */
/* ------------------------------------------------------------------ */

export function StartupEmployerPageView({ org, myRole, pageHead, notify, onOrgUpdated }) {
  const canEdit = isManager(myRole);
  const verified = Boolean(org.verified_at);
  const [profileTab, setProfileTab] = useState('Editor');
  const [state, setState] = useState('loading');
  const [err, setErr] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [profile, setProfile] = useState(null);
  const [openJobCount, setOpenJobCount] = useState(null);
  const [form, setForm] = useState({ tagline: '', summary: '', mission: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publicPage, setPublicPage] = useState({ state: 'idle', data: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    Promise.all([
      api.startupProfile.get(org.id, controller.signal),
      api.jobs
        .list(org.id, { status: 'open', limit: 1 }, controller.signal)
        .then((p) => p.total)
        .catch(() => null),
    ])
      .then(([sp, count]) => {
        if (controller.signal.aborted) return;
        setProfile(sp);
        setOpenJobCount(count);
        setForm({ tagline: sp.tagline || '', summary: org.summary || '', mission: sp.mission || '' });
        setState('ready');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setErr(errorMessage(e, 'Could not load the employer page.'));
        setState('error');
      });
    return () => controller.abort();
  }, [org.id, org.summary, reloadKey]);

  useEffect(() => {
    if (profileTab !== 'Public preview') return undefined;
    const controller = new AbortController();
    setPublicPage({ state: 'loading', data: null, error: '' });
    // Anonymous read: exactly what a signed-out candidate would see.
    api.careers
      .company(org.id, false, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setPublicPage({ state: 'ready', data, error: '' });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setPublicPage({
          state: e instanceof ApiError && e.status === 404 ? 'absent' : 'error',
          data: null,
          error: errorMessage(e, 'Could not load the public page.'),
        });
      });
    return () => controller.abort();
  }, [org.id, profileTab, reloadKey]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    if (!canEdit || !profile) return;
    setSaving(true);
    setErrors({});
    setFormError('');
    const nextFieldErrors = {};
    let updatedOrg = null;
    try {
      const summary = form.summary.trim() || null;
      if (summary !== (org.summary || null)) {
        try {
          updatedOrg = await api.organizations.update(org.id, { summary });
        } catch (e) {
          const f = extractFieldErrors(e);
          if (f.summary) nextFieldErrors.summary = f.summary;
          else throw e;
        }
      }
      const body = {};
      const tagline = form.tagline.trim() || null;
      const mission = form.mission.trim() || null;
      if (tagline !== (profile.tagline || null)) body.tagline = tagline;
      if (mission !== (profile.mission || null)) body.mission = mission;
      if (Object.keys(body).length) {
        try {
          setProfile(await api.startupProfile.update(org.id, body));
        } catch (e) {
          const f = extractFieldErrors(e);
          if (f.tagline || f.mission) Object.assign(nextFieldErrors, { tagline: f.tagline, mission: f.mission });
          else throw e;
        }
      }
      if (Object.keys(nextFieldErrors).length) setErrors(nextFieldErrors);
      else notify('Employer page saved.');
    } catch (e) {
      setFormError(errorMessage(e, 'Could not save the employer page.'));
    } finally {
      setSaving(false);
      // Lift the new org summary last, after both writes have settled (it
      // re-runs the loader, which then reads the saved values).
      if (updatedOrg) onOrgUpdated?.(updatedOrg);
    }
  };

  const previewSource =
    profileTab === 'Public preview' && publicPage.data
      ? {
          name: publicPage.data.name,
          tagline: publicPage.data.tagline,
          about: publicPage.data.summary,
          mission: publicPage.data.mission,
          stage: publicPage.data.stage,
          sector: publicPage.data.sector,
          openJobs: publicPage.data.open_jobs_count,
          city: publicPage.data.city,
        }
      : {
          name: org.name,
          tagline: form.tagline.trim(),
          about: form.summary.trim(),
          mission: form.mission.trim(),
          stage: profile?.stage,
          sector: profile?.sector,
          openJobs: openJobCount,
          city: org.city,
        };

  const input = 'mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm disabled:bg-[#FAF8F4]';

  return (
    <>
      {pageHead(
        'Employer page',
        'Build candidate trust and manage your company’s hiring presence.',
        <div className="flex rounded-lg border bg-white p-1">
          {['Editor', 'Public preview'].map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setProfileTab(x)}
              className={`rounded px-3 py-2 text-xs ${profileTab === x ? 'bg-ink text-white' : ''}`}
            >
              {x}
            </button>
          ))}
        </div>
      )}

      {!verified && (
        <div className="mb-5 rounded-xl border border-[#E7D4B0] bg-[#FFF8E8] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={18} className="text-[#9A7A45]" />Employer verification · Not started
          </h2>
          <p className="mt-2 text-xs leading-5 text-[#4A5568]">
            Verified employers get a badge on their company page and job posts. Verification requests open with the
            trust &amp; verification console (Step 15d); until then this page shows your current details.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ['Business registration', profile?.legal_entity || 'Not provided in startup profile'],
              ['Official email domain', 'Needs verification'],
              ['Company website', org.website || 'Not provided'],
            ].map(([a, b]) => (
              <p key={a} className="rounded-lg bg-white p-3 text-xs">
                <CheckCircle2 className="mr-1 inline text-[#9A7A45]" size={14} />{a}
                <small className="mt-1 block break-words text-[#4A5568]">{b}</small>
              </p>
            ))}
          </div>
          <Btn disabled title="Verification requests open in Step 15d.">
            <ShieldCheck size={15} /> Submit for verification
          </Btn>
        </div>
      )}

      {state === 'loading' ? (
        <LoadingState label="Loading employer page…" />
      ) : state === 'error' ? (
        <ErrorState message={err} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Company page editor">
            {!canEdit && (
              <p className="mb-3 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                Only owners and admins can edit the employer page.
              </p>
            )}
            <label className="block text-sm font-medium">
              Tagline
              <input
                value={form.tagline}
                onChange={set('tagline')}
                disabled={!canEdit}
                maxLength={160}
                aria-invalid={Boolean(errors.tagline)}
                className={input}
              />
              <FieldError>{errors.tagline}</FieldError>
            </label>
            <label className="mt-4 block text-sm font-medium">
              About us
              <textarea
                rows={5}
                value={form.summary}
                onChange={set('summary')}
                disabled={!canEdit}
                aria-invalid={Boolean(errors.summary)}
                className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm disabled:bg-[#FAF8F4]"
              />
              <FieldError>{errors.summary}</FieldError>
            </label>
            <label className="mt-4 block text-sm font-medium">
              Mission
              <input
                value={form.mission}
                onChange={set('mission')}
                disabled={!canEdit}
                maxLength={300}
                aria-invalid={Boolean(errors.mission)}
                className={input}
              />
              <FieldError>{errors.mission}</FieldError>
            </label>
            {formError && <p role="alert" className="mt-3 text-xs text-[#B42318]">{formError}</p>}
            {canEdit && (
              <div className="mt-4">
                <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save employer page'}</Btn>
              </div>
            )}
            {profile && !profile.summary_public && (
              <p className="mt-3 text-[11px] leading-4 text-[#4A5568]">
                About and mission are hidden on your public page until “Summary” is made public in the startup profile.
              </p>
            )}
          </Card>

          <Card title={profileTab === 'Editor' ? 'Candidate preview' : 'Public employer page preview'}>
            {profileTab === 'Public preview' && publicPage.state === 'loading' ? (
              <LoadingState label="Loading public page…" />
            ) : profileTab === 'Public preview' && publicPage.state === 'error' ? (
              <ErrorState message={publicPage.error} onRetry={() => setReloadKey((k) => k + 1)} />
            ) : profileTab === 'Public preview' && publicPage.state === 'absent' ? (
              <EmptyState
                title="Not public yet"
                description="Your company page appears to candidates once you have an open, public job and a visible startup profile."
              />
            ) : (
              <>
                <div className="h-24 rounded-t-xl bg-ink" />
                <div className="px-4 pb-4">
                  <div className="-mt-8 grid h-16 w-16 place-items-center rounded-xl border-4 border-white bg-[#F3EBDD] text-xl font-bold">
                    {(previewSource.name || '?')[0]}
                  </div>
                  <h2 className="serif mt-2 text-xl font-semibold">{previewSource.name}</h2>
                  {previewSource.tagline && <p className="mt-1 text-xs text-[#4A5568]">{previewSource.tagline}</p>}
                  {previewSource.about ? (
                    <p className="mt-4 whitespace-pre-line text-xs leading-5 text-[#4A5568]">{previewSource.about}</p>
                  ) : (
                    <p className="mt-4 text-xs italic text-[#A0A7B4]">No “About us” text yet.</p>
                  )}
                  {previewSource.mission && (
                    <p className="mt-2 text-xs leading-5 text-ink"><b>Mission:</b> {previewSource.mission}</p>
                  )}
                  {(previewSource.stage || previewSource.sector) && (
                    <div className="mt-3 flex gap-2">
                      {previewSource.stage && (
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">
                          {STAGE_LABELS[previewSource.stage] || previewSource.stage}
                        </span>
                      )}
                      {previewSource.sector && (
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{previewSource.sector}</span>
                      )}
                    </div>
                  )}
                  {previewSource.openJobs != null && (
                    <>
                      <h3 className="mt-5 text-sm font-semibold">Open jobs</h3>
                      <p className="mt-2 text-xs text-[#4A5568]">
                        {previewSource.openJobs} role{previewSource.openJobs === 1 ? '' : 's'}
                        {previewSource.city ? ` · ${previewSource.city}` : ''}
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </Card>

          <Card title="Hiring preferences">
            <p className="text-xs leading-5 text-[#4A5568]">
              Organisation-wide hiring defaults (default blind review, candidate acknowledgement, working hours) are not
              stored yet. Blind review can be switched on per job in the job editor.
            </p>
          </Card>

          <Card title="Trust & safety">
            <p className="text-xs leading-5 text-[#4A5568]">
              Never charge candidates fees. Evaluate fairly using job-related criteria. Candidate data is shared only with consent and is retained according to your configured policy.
            </p>
            <Link href="/help" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
              Contact support <ArrowRight className="inline" size={13} />
            </Link>
          </Card>
        </div>
      )}
    </>
  );
}
