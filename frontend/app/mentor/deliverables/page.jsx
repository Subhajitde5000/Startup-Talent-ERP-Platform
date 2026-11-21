'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  FileText,
  Eye,
  X,
} from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Btn, Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { EmptyBlock, ErrorBlock, FieldError, LoadingBlock } from '@/components/async-state';

// Human labels for the server's status enum. The enum is the source of
// truth; this map only decides wording and colour.
const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  changes_requested: 'Changes requested',
  accepted: 'Accepted',
  overdue: 'Overdue',
};

const STATUS_CHIP = {
  submitted: 'bg-[#FFF3D6] text-[#8A5700]',
  changes_requested: 'bg-[#FEE4E2] text-[#B42318]',
  accepted: 'bg-[#E7F3EC] text-[#286749]',
  in_progress: 'bg-[#EEF2F7] text-[#0F1B2D]',
  not_started: 'bg-[#F3F4F6] text-[#4A5568]',
  overdue: 'bg-[#FEE4E2] text-[#B42318]',
};

// Tab -> server status filter. "Requested by me" is not a status: it is
// "awaiting the startup's action", which the server can filter as
// changes_requested (we asked for changes) — plus in_progress is the
// startup's own work, so it is deliberately not included.
const TAB_STATUS = {
  'Awaiting review': 'submitted',
  'Changes requested': 'changes_requested',
  Accepted: 'accepted',
};

function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatStamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString(
    'en-IN',
    { hour: '2-digit', minute: '2-digit' }
  )}`;
}

/** "3 hours" / "4 days" since submission — derived, never stored. */
function waitingFor(value) {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** Map server 422 details onto the field that caused them. */
function fieldErrors(err) {
  const out = {};
  const details = err instanceof ApiError && Array.isArray(err.details) ? err.details : [];
  details.forEach((d) => {
    const loc = Array.isArray(d?.loc) ? d.loc : [];
    const field = loc[loc.length - 1];
    if (typeof field === 'string' && !out[field]) out[field] = d.msg || 'Invalid value.';
  });
  return out;
}

export default function MentorDeliverablesPage() {
  const [toast, setToast] = useState('');
  const [deliveryTab, setDeliveryTab] = useState('Awaiting review');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [mentorships, setMentorships] = useState([]);
  const [rows, setRows] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading|ready|error|nomentorship
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(0);
  const [reload, setReload] = useState(0);

  // Add-deliverable form. `startup` is a mentorship id, because a
  // deliverable belongs to an engagement, not to a startup.
  const [form, setForm] = useState({
    mentorship_id: '',
    title: '',
    description: '',
    due_on: '',
    linked_criterion: '',
  });
  const [formErrs, setFormErrs] = useState({});
  const [formError, setFormError] = useState('');
  const [criteria, setCriteria] = useState([]);
  const [members, setMembers] = useState([]);
  const [membersError, setMembersError] = useState('');
  const [ownerId, setOwnerId] = useState('');

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2700);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setPhase('loading');
      setError('');
      try {
        const startups = [];
        for (let offset = 0;;) {
          const page = await api.mentorships.mentorStartups({ limit: 50, offset });
          startups.push(...page.items);
          offset += page.items.length;
          if (!page.items.length || offset >= page.total) break;
        }
        if (!alive) return;
        const active = startups.filter((m) => m.status === 'active');
        setMentorships(active);
        if (active.length === 0) {
          setRows([]);
          setPhase('nomentorship');
          return;
        }

        const results = await Promise.allSettled(
          active.map(async (m) => {
            const items = [];
            for (let offset = 0;;) {
              const page = await api.deliverables.list(m.id, { limit: 50, offset });
              items.push(...page.items);
              offset += page.items.length;
              if (!page.items.length || offset >= page.total) break;
            }
            return { items };
          })
        );
        if (!alive) return;
        const merged = [];
        let failed = 0;
        results.forEach((res) => {
          if (res.status === 'fulfilled') merged.push(...res.value.items);
          else failed += 1;
        });
        merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setRows(merged);
        setPartial(failed);
        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : 'Could not load deliverables.');
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  // Reference data for the "Add deliverable" dialog only.
  useEffect(() => {
    if (!schedule || criteria.length > 0) return undefined;
    let alive = true;
    api.readiness
      .criteria()
      .then((list) => {
        if (alive) setCriteria(list.filter((c) => c.code && c.title));
      })
      .catch(() => {
        // A missing reference list only empties the picker; the deliverable
        // itself does not need a criterion.
        if (alive) setCriteria([]);
      });
    return () => {
      alive = false;
    };
  }, [schedule, criteria.length]);

  // Assignee options are the startup's active members, which is what the
  // server accepts for owner_id (422 otherwise).
  useEffect(() => {
    const orgId = mentorships.find((m) => m.id === form.mentorship_id)?.startup_org_id;
    if (!schedule || !orgId) {
      setMembers([]);
      return undefined;
    }
    let alive = true;
    setMembersError('');
    api.organizations
      .members(orgId, { limit: 100, status: 'active' })
      .then((page) => {
        if (alive) setMembers(page.items);
      })
      .catch(() => {
        if (alive) { setMembers([]); setMembersError('Member list unavailable; assignment cannot be selected.'); }
      });
    return () => {
      alive = false;
    };
  }, [schedule, form.mentorship_id, mentorships]);

  const reloadRows = useCallback(() => setReload((n) => n + 1), []);

  const visible = useMemo(() => {
    const wanted = TAB_STATUS[deliveryTab];
    return rows.filter((d) => {
      if (wanted && d.status !== wanted) return false;
      if (!search) return true;
      return `${d.title} ${d.owner?.display_name || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  }, [rows, deliveryTab, search]);

  const stats = useMemo(() => {
    const awaiting = rows.filter((d) => d.status === 'submitted').length;
    const overdue = rows.filter((d) => d.is_overdue).length;
    const accepted = rows.filter((d) => d.status === 'accepted').length;
    // Average review time over rows the server actually stamped.
    const reviewed = rows.filter((d) => d.reviewed_at && d.submitted_at);
    const avgDays = reviewed.length
      ? reviewed.reduce(
          (sum, d) =>
            sum +
            Math.max(
              0,
              (new Date(d.reviewed_at).getTime() - new Date(d.submitted_at).getTime()) /
                86400000
            ),
          0
        ) / reviewed.length
      : null;
    return { awaiting, overdue, accepted, avgDays };
  }, [rows]);

  const mentorshipName = (id) => {
    const m = mentorships.find((x) => x.id === id);
    return m?.startup?.display_name || 'Startup';
  };

  const runReview = async (status) => {
    if (!selected) return;
    setBusy(true);
    setReviewErr('');
    try {
      await api.deliverables.update(selected.id, { status });
      setDrawer(false);
      notify(
        status === 'accepted'
          ? 'Deliverable accepted.'
          : 'Changes requested.'
      );
      reloadRows();
    } catch (err) {
      const errs = fieldErrors(err);
      setReviewErr(errs.status || (err instanceof ApiError ? err.message : 'Could not save the review.'));
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async () => {
    setFormErrs({});
    setFormError('');
    if (!form.mentorship_id) {
      setFormErrs({ mentorship_id: 'Choose a startup.' });
      return;
    }
    if (!form.title.trim()) {
      setFormErrs({ title: 'Add a title.' });
      return;
    }
    setBusy(true);
    try {
      await api.deliverables.create(form.mentorship_id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_on: form.due_on || null,
        linked_criterion: form.linked_criterion || null,
        owner_id: ownerId || null,
      });
      setSchedule(false);
      setForm({ mentorship_id: '', title: '', description: '', due_on: '', linked_criterion: '' });
      setOwnerId('');
      notify('Deliverable created.');
      reloadRows();
    } catch (err) {
      const errs = fieldErrors(err);
      setFormErrs(errs);
      if (Object.keys(errs).length === 0) {
        setFormError(err instanceof ApiError ? err.message : 'Could not create the deliverable.');
      }
    } finally {
      setBusy(false);
    }
  };

  const noActiveMentorship = phase === 'nomentorship';

  return (
    <MentorPageShell active="Deliverables" toast={toast} notify={notify}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#4A5568]">
            Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Sessions & sign-off
          </p>
          <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
            Deliverables review
          </h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            Review submitted work across your mentorships.
          </p>
        </div>
        <Btn onClick={() => setSchedule(true)} disabled={noActiveMentorship}>
          <Plus size={15} /> Add deliverable
        </Btn>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Awaiting review', phase === 'ready' ? String(stats.awaiting) : '—'],
          ['Overdue by startup', phase === 'ready' ? String(stats.overdue) : '—'],
          ['Accepted', phase === 'ready' ? String(stats.accepted) : '—'],
          [
            'Average review time',
            phase === 'ready'
              ? stats.avgDays === null
                ? 'No reviews yet'
                : `${stats.avgDays.toFixed(1)} days`
              : '—',
          ],
        ].map(([a, b]) => (
          <div key={a} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <p className="text-xs text-[#4A5568]">{a}</p>
            <b className="serif mt-1 block text-2xl text-[#0F1B2D]">{b}</b>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {['Awaiting review', 'Changes requested', 'Accepted', 'All'].map((x) => (
          <button
            type="button"
            key={x}
            onClick={() => setDeliveryTab(x)}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors ${
              deliveryTab === x
                ? 'bg-[#0F1B2D] text-white'
                : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="absolute left-3 top-3 text-[#A0A7B4]" />
          <input
            aria-label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deliverables or startups"
            className="h-10 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs focus:border-[#0F1B2D] focus:outline-none"
          />
        </div>
      </div>

      {phase === 'loading' && <LoadingBlock label="Loading deliverables…" rows={3} />}

      {phase === 'error' && (
        <ErrorBlock
          message={error}
          title="Could not load deliverables"
          onRetry={() => setReload((n) => n + 1)}
        />
      )}

      {noActiveMentorship && (
        <EmptyBlock
          title="No active mentorship yet"
          hint="Deliverables are created inside an active mentorship. Accept a request or ask a startup to work with you, then come back."
        />
      )}

      {phase === 'ready' && (
        <>
          {partial > 0 && (
            <div className="mb-4 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#806236]">
              Could not load {partial} mentorship{partial === 1 ? '' : 's'}. Everything else is
              shown below.
            </div>
          )}

          <Card title={deliveryTab === 'All' ? 'All deliverables' : deliveryTab}>
            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#4A5568]">
                {rows.length === 0
                  ? 'No deliverables yet. Use “Add deliverable” to ask a startup for work.'
                  : search
                  ? 'No deliverables match this search.'
                  : 'No deliverables in this view right now.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="border-b border-[#E5E1D8] text-[#4A5568]">
                    <tr>
                      {[
                        'Deliverable',
                        'Startup',
                        'Linked goal / item',
                        'Due',
                        'Submitted',
                        'Waiting',
                        'Status',
                        'Owner',
                        '',
                      ].map((x) => (
                        <th key={x} className="py-3 font-medium">
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((d) => (
                      <tr key={d.id} className="border-b border-[#E5E1D8]">
                        <td className="py-3 font-semibold text-[#0F1B2D]">{d.title}</td>
                        <td className="text-[#0F1B2D]">{mentorshipName(d.mentorship_id)}</td>
                        <td className="text-[#4A5568]">{d.linked_criterion_title || '—'}</td>
                        <td className={d.is_overdue ? 'font-semibold text-[#B42318]' : 'text-[#4A5568]'}>
                          {formatDay(d.due_on)}
                        </td>
                        <td className="text-[#4A5568]">{formatStamp(d.submitted_at)}</td>
                        <td>
                          <span
                            className={
                              d.status === 'submitted' ? 'font-semibold text-[#8A5700]' : 'text-[#4A5568]'
                            }
                          >
                            {d.status === 'submitted' ? waitingFor(d.submitted_at) : '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              STATUS_CHIP[d.status] || STATUS_CHIP.not_started
                            }`}
                          >
                            {d.is_overdue && d.status !== 'accepted'
                              ? 'Overdue'
                              : STATUS_LABEL[d.status] || d.status}
                          </span>
                        </td>
                        <td className="text-[#4A5568]">{d.owner?.display_name || 'Unassigned'}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(d);
                                                      setReviewErr('');
                              setDrawer(true);
                            }}
                            className="font-semibold text-[#9A7A45]"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Slide-over Review Drawer */}
      {drawer && selected && (
        <div
          className="fixed inset-0 z-40 bg-[#0F1B2D]/35 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawer(false);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Review submission"
            className="absolute inset-y-0 right-0 w-full max-w-[640px] overflow-y-auto bg-[#FAF8F4] p-5 shadow-xl sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="serif text-2xl font-semibold text-[#0F1B2D]">{selected.title}</h2>
                <p className="mt-1 text-xs text-[#4A5568]">
                  {mentorshipName(selected.mentorship_id)} · Shared submission
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Close review"
                className="grid h-10 w-10 place-items-center rounded-lg border border-[#E5E1D8] bg-white text-[#4A5568] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <Card title="Submission">
                <p className="text-sm font-semibold text-[#0F1B2D]">
                  {selected.description || selected.title}
                </p>
                <p className="mt-2 text-xs text-[#4A5568]">
                  Due {formatDay(selected.due_on)} · Submitted {formatStamp(selected.submitted_at)}
                </p>
                {selected.evidence ? (
                  <div className="mt-3 flex w-full items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white p-3 text-xs text-[#0F1B2D]">
                    <FileText size={15} className="text-[#9A7A45]" />
                    <span className="min-w-0 flex-1 truncate">{selected.evidence}</span>
                    <Eye size={14} className="text-[#4A5568]" />
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg border border-dashed border-[#E5E1D8] bg-white p-3 text-xs text-[#4A5568]">
                    No evidence attached yet.
                  </p>
                )}
                {selected.reviewed_at && (
                  <p className="mt-3 text-xs text-[#4A5568]">
                    Last reviewed {formatStamp(selected.reviewed_at)}
                    {selected.status === 'changes_requested' ? ' · changes requested' : ''}
                  </p>
                )}
              </Card>

              <Card title="Your review">
                <p className="text-xs text-[#4A5568]">Review comments are not supported yet.</p>
                {reviewErr && <div className="mt-2"><FieldError>{reviewErr}</FieldError></div>}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy || selected.status !== 'submitted'}
                    onClick={() => runReview('changes_requested')}
                    className="rounded-lg border border-[#F1C6C1] px-3 py-2 text-xs font-semibold text-[#B42318] hover:bg-[#FEE4E2] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={busy || selected.status !== 'submitted'}
                    onClick={() => runReview('accepted')}
                    className="rounded-lg bg-[#0F1B2D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Accept deliverable
                  </button>
                </div>
                {selected.status !== 'submitted' && (
                  <p className="mt-2 text-right text-xs text-[#4A5568]">
                    Only a submitted deliverable can be reviewed.
                  </p>
                )}
              </Card>
            </div>
          </aside>
        </div>
      )}

      {/* Add Deliverable Modal */}
      {schedule && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold text-[#0F1B2D]">Add deliverable</h2>
              <button
                type="button"
                onClick={() => setSchedule(false)}
                aria-label="Close"
                className="text-[#4A5568] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Startup
                <select
                  value={form.mentorship_id}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, mentorship_id: e.target.value }));
                    setOwnerId('');
                  }}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 focus:outline-none"
                >
                  <option value="">Choose an active mentorship…</option>
                  {mentorships.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.startup?.display_name || 'Startup'}
                    </option>
                  ))}
                </select>
                <FieldError>{formErrs.mentorship_id}</FieldError>
              </label>
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Title
                <input
                  aria-label="Deliverable title"
                  placeholder="Deliverable title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 focus:outline-none"
                />
                <FieldError>{formErrs.title}</FieldError>
              </label>
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none"
                />
                <FieldError>{formErrs.description}</FieldError>
              </label>
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Due date
                <input
                  aria-label="Select date"
                  type="date"
                  value={form.due_on}
                  onChange={(e) => setForm((f) => ({ ...f, due_on: e.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 focus:outline-none"
                />
                <FieldError>{formErrs.due_on}</FieldError>
              </label>
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Assign to
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  disabled={!form.mentorship_id}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 focus:outline-none disabled:opacity-60"
                >
                  <option value="">Leave unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
                <FieldError>{formErrs.owner_id || membersError}</FieldError>
              </label>
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Link readiness item
                <select
                  value={form.linked_criterion}
                  onChange={(e) => setForm((f) => ({ ...f, linked_criterion: e.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 focus:outline-none"
                >
                  <option value="">Not linked</option>
                  {criteria.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <FieldError>{formErrs.linked_criterion}</FieldError>
              </label>
              {formError && (
                <p role="alert" className="text-xs text-[#B42318]">
                  {formError}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSchedule(false)}
                className="min-h-10 px-4 text-sm font-medium text-[#4A5568] hover:text-[#0F1B2D]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitNew}
                className="min-h-10 rounded-lg bg-[#0F1B2D] px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Creating…' : 'Create deliverable'}
              </button>
            </div>
          </section>
        </div>
      )}
    </MentorPageShell>
  );
}
