'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ShieldCheck, X } from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import {
  EmptyBlock,
  ErrorBlock,
  FieldError,
  LoadingBlock,
  fieldErrorsFrom,
} from '@/components/async-state';
import {
  MENTORSHIP_STATUS_LABEL,
  STAGE_LABEL,
  formatDate,
  formatInstant,
  formatMoney,
} from '@/lib/mentorship-labels';

/**
 * Tabs map onto the API's status values.
 *
 * "Invitations sent" has no tab: 8b has no mentor-initiated invite endpoint,
 * so that list would have been an empty promise. "Auto-match suggestions"
 * also has no source — `fit_score` is never written — so it is gone rather
 * than filled with invented ranking.
 */
const TABS = [
  { key: 'Incoming', statuses: ['requested'] },
  { key: 'Active', statuses: ['active', 'paused'] },
  { key: 'Past', statuses: ['completed', 'declined', 'cancelled'] },
];

/** Sent-to-startup requests cannot be edited by a mentor; nothing else can. */
const CAN_RESPOND = ['requested'];

export default function MentorRequestsPage() {
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('Incoming');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All stages');
  const [sort, setSort] = useState('Newest');

  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(''); // '' | accept | decline | details | cancel
  const [note, setNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [formErrs, setFormErrs] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const notify = useCallback((x) => {
    setToast(x);
    setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPhase('loading');
      setLoadError('');
      try {
        const page = await api.mentorships.list({ side: 'mentor', limit: 50 });
        if (!alive) return;
        setItems(page.items);
        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        setLoadError(
          err instanceof ApiError ? err.message : 'Could not load your requests.',
        );
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  const activeTab = TABS.find((t) => t.key === tab) || TABS[0];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = items.filter((m) => activeTab.statuses.includes(m.status));
    if (term) {
      list = list.filter((m) =>
        `${m.startup.display_name} ${m.startup.sector || ''} ${m.goal || ''} ${(m.needs || []).join(' ')}`
          .toLowerCase()
          .includes(term),
      );
    }
    if (stageFilter !== 'All stages') {
      const wanted = Object.entries(STAGE_LABEL).find(([, label]) => label === stageFilter);
      if (wanted) list = list.filter((m) => m.startup.stage === wanted[0]);
    }
    const sorted = list.slice();
    if (sort === 'Newest') {
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sort === 'Waiting longest') {
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
      sorted.sort((a, b) => a.startup.display_name.localeCompare(b.startup.display_name));
    }
    return sorted;
  }, [items, activeTab, search, stageFilter, sort]);

  const openModal = (kind, row) => {
    setSelected(row);
    setModal(kind);
    setNote('');
    setDeclineReason('');
    setFormErrs({});
    setFormError('');
  };

  /** All three actions share one write path and one error mapping. */
  const runAction = async (fn, successMessage) => {
    setSaving(true);
    setFormErrs({});
    setFormError('');
    try {
      const updated = await fn();
      setItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setModal('');
      setSelected(null);
      notify(successMessage);
    } catch (err) {
      const errs = fieldErrorsFrom(err);
      if (Object.keys(errs).length) setFormErrs(errs);
      else
        setFormError(
          err instanceof ApiError ? err.message : 'That action could not be completed.',
        );
    } finally {
      setSaving(false);
    }
  };

  const doAccept = () =>
    runAction(
      () => api.mentorships.accept(selected.id, { note: note.trim() || null }),
      'Request accepted. The mentorship is now active.',
    );

  const doDecline = () =>
    runAction(
      () =>
        api.mentorships.decline(selected.id, {
          note: note.trim() || null,
        }),
      'Request declined.',
    );

  const doCancel = () =>
    runAction(
      () => api.mentorships.cancel(selected.id, { note: note.trim() || null }),
      'Mentorship cancelled.',
    );

  const renderCard = (m) => {
    const s = m.startup;
    const fee = formatMoney(m.fee_amount, m.currency);
    const needs = m.needs || [];
    return (
      <article key={m.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-lg font-semibold text-[#806236]">
            {s.avatar_initials || '–'}
          </span>
          <div className="flex-1">
            <h2 className="font-semibold text-[#0F1B2D]">{s.display_name}</h2>
            <p className="mt-1 text-xs text-[#4A5568]">
              {s.stage ? STAGE_LABEL[s.stage] || s.stage : 'Stage not set'}
              {s.sector ? ` · ${s.sector}` : ''}
              {s.city ? ` · ${s.city}` : ''}
            </p>
          </div>
          <span className="rounded-full bg-[#FFF3D6] px-2 py-1 text-xs font-medium text-[#8A5700]">
            {formatDate(m.created_at) || '—'}
          </span>
        </div>
        <div className="mt-3 rounded-lg bg-[#FAF8F4] p-3">
          <p className="text-xs leading-5 text-[#0F1B2D]">
            “{m.goal || 'No goal was provided.'}”
          </p>
          {needs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {needs.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-white px-2 py-1 text-xs text-[#4A5568]"
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[#4A5568]">
          <span>
            {[m.cadence, fee ? `${fee} per session` : null].filter(Boolean).join(' · ') ||
              'Terms not specified'}
          </span>
          <span className="font-semibold text-[#9A7A45]">
            {MENTORSHIP_STATUS_LABEL[m.status] || m.status}
          </span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => openModal('details', m)}
            className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
          >
            View details
          </button>
          {CAN_RESPOND.includes(m.status) ? (
            <>
              <button
                type="button"
                onClick={() => openModal('decline', m)}
                className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold text-[#B42318] hover:bg-[#FEE4E2]"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => openModal('accept', m)}
                className="rounded-lg bg-[#0F1B2D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
              >
                Accept
              </button>
            </>
          ) : (
            <Link
              href={`/mentor/startups/${m.id}`}
              className="rounded-lg bg-[#0F1B2D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
            >
              Open mentorship
            </Link>
          )}
        </div>
      </article>
    );
  };

  const body = () => {
    if (phase === 'loading') return <LoadingBlock label="Loading requests…" rows={2} />;
    if (phase === 'error')
      return <ErrorBlock message={loadError} onRetry={() => setReload((n) => n + 1)} />;
    if (filtered.length === 0) {
      return (
        <EmptyBlock
          title={
            search || stageFilter !== 'All stages'
              ? 'No requests match these filters'
              : tab === 'Incoming'
                ? 'No incoming requests'
                : tab === 'Active'
                  ? 'No active mentorships'
                  : 'Nothing in your past requests'
          }
          hint={
            search || stageFilter !== 'All stages'
              ? 'Clear the search or stage filter to see everything.'
              : tab === 'Incoming'
                ? 'Startups that request you will appear here for a decision.'
                : tab === 'Active'
                  ? 'Accepted mentorships appear here until they end.'
                  : 'Declined, cancelled and completed mentorships are kept here.'
          }
        />
      );
    }
    return <div className="grid gap-4 lg:grid-cols-2">{filtered.map(renderCard)}</div>;
  };

  return (
    <MentorPageShell active="Requests" toast={toast} notify={notify}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#4A5568]">
            Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Forma
          </p>
          <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
            Startup requests
          </h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            Review incoming mentorship requests and invitations.
          </p>
        </div>
        <Link
          href="/mentor/discover"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F1B2D] px-4 text-sm font-semibold text-white hover:bg-[#1C2B42]"
        >
          <Search size={15} /> Discover startups
        </Link>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-[#0F1B2D] text-white'
                : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
            }`}
          >
            {t.key}
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
            placeholder="Search startups, stage or need"
            className="h-10 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs focus:border-[#0F1B2D] focus:outline-none"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-[#0F1B2D] focus:outline-none"
        >
          <option>All stages</option>
          {Object.values(STAGE_LABEL).map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-[#0F1B2D] focus:outline-none"
        >
          <option>Newest</option>
          <option>Waiting longest</option>
          <option>Startup name</option>
        </select>
      </div>

      {body()}

      {modal && selected && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold text-[#0F1B2D]">
                {modal === 'accept'
                  ? 'Accept mentorship request'
                  : modal === 'decline'
                    ? 'Decline request'
                    : modal === 'cancel'
                      ? 'Cancel mentorship'
                      : selected.startup.display_name}
              </h2>
              <button
                type="button"
                onClick={() => setModal('')}
                aria-label="Close"
                className="text-[#4A5568] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>

            {modal === 'details' ? (
              <div className="space-y-3 text-sm">
                <p>
                  <b>Goal:</b> {selected.goal || 'Not provided'}
                </p>
                <p>
                  <b>Needs:</b> {(selected.needs || []).join(', ') || 'None listed'}
                </p>
                <p>
                  <b>Cadence:</b> {selected.cadence || 'Not set'}
                </p>
                <p>
                  <b>Fee:</b>{' '}
                  {formatMoney(selected.fee_amount, selected.currency) || 'No fee set'}
                </p>
                <p>
                  <b>Equity:</b>{' '}
                  {selected.equity_pct !== null && selected.equity_pct !== undefined
                    ? `${selected.equity_pct}%`
                    : 'None'}
                </p>
                <p>
                  <b>Stage:</b>{' '}
                  {selected.startup.stage
                    ? STAGE_LABEL[selected.startup.stage] || selected.startup.stage
                    : 'Not set'}
                </p>
                <p>
                  <b>Requested:</b> {formatInstant(selected.created_at)}
                </p>
                {selected.terms && (
                  <p className="rounded-lg bg-[#FAF8F4] p-3 text-xs">{selected.terms}</p>
                )}
              </div>
            ) : modal === 'decline' ? (
              <>
                <label className="block text-sm font-medium text-[#0F1B2D]">
                  Reason (required)
                  <select
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 focus:outline-none"
                  >
                    <option value="">Choose a reason</option>
                    {[
                      'Not my expertise',
                      'At capacity',
                      'Stage mismatch',
                      'Terms',
                      'Other',
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-sm font-medium text-[#0F1B2D]">
                  Note
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a helpful, respectful note"
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none"
                  />
                </label>
              </>
            ) : modal === 'accept' ? (
              <>
                <p className="text-sm text-[#4A5568]">
                  Accept {selected.startup.display_name}’s request to create a mentorship
                  workspace?
                </p>
                <label className="mt-4 block text-sm font-medium text-[#0F1B2D]">
                  Welcome message (optional)
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Share a short welcome and next step"
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none"
                  />
                </label>
                <p className="mt-3 rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">
                  Review any equity or advisory terms with a lawyer. The platform does not
                  provide legal advice.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-[#4A5568]">
                  Cancel this mentorship with {selected.startup.display_name}? Sessions already
                  booked are not cancelled automatically.
                </p>
                <label className="mt-4 block text-sm font-medium text-[#0F1B2D]">
                  Note (optional)
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none"
                  />
                </label>
              </>
            )}

            {modal !== 'details' && (
              <>
                {formError && <FieldError>{formError}</FieldError>}
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModal('')}
                    className="min-h-10 px-4 text-sm font-medium text-[#4A5568] hover:text-[#0F1B2D]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving || (modal === 'decline' && !declineReason)}
                    onClick={() => {
                      if (modal === 'accept') doAccept();
                      else if (modal === 'decline') doDecline();
                      else doCancel();
                    }}
                    className="min-h-10 rounded-lg bg-[#0F1B2D] px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-50"
                  >
                    {saving
                      ? 'Saving…'
                      : modal === 'accept'
                        ? 'Accept request'
                        : modal === 'decline'
                          ? 'Decline request'
                          : 'Cancel mentorship'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </MentorPageShell>
  );
}
