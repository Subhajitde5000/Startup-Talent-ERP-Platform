'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, Table2, Grid2X2 } from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/async-state';
import {
  MENTORSHIP_STATUS_CHIP,
  MENTORSHIP_STATUS_LABEL,
  STAGE_LABEL,
  formatDate,
  formatInstant,
} from '@/lib/mentorship-labels';

/** Statuses that mean "this engagement has not ended". */
const OPEN_STATUSES = ['active', 'paused'];

export default function MentorStartupsPage() {
  const [toast, setToast] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [view, setView] = useState('Cards');
  const [search, setSearch] = useState('');

  const [mentorships, setMentorships] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

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
        const page = await api.mentorships.mentorStartups({ limit: 50 });
        if (!alive) return;
        setMentorships(page.items);
        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        setLoadError(
          err instanceof ApiError ? err.message : 'Could not load your startups.',
        );
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  const buckets = useMemo(() => {
    const open = mentorships.filter((m) => OPEN_STATUSES.includes(m.status));
    const active = open.filter((m) => m.status === 'active');
    const paused = open.filter((m) => m.status === 'paused');
    const past = mentorships.filter(
      (m) => !OPEN_STATUSES.includes(m.status),
    );
    return { open, active, paused, past };
  }, [mentorships]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base =
      statusFilter === 'Active'
        ? buckets.active
        : statusFilter === 'Paused'
          ? buckets.paused
          : buckets.past;
    if (!term) return base;
    return base.filter((m) =>
      `${m.startup.display_name} ${m.startup.sector || ''}`.toLowerCase().includes(term),
    );
  }, [buckets, statusFilter, search]);

  const startupCard = (m) => {
    const s = m.startup;
    return (
      <article
        key={m.id}
        className="rounded-xl border border-[#E5E1D8] bg-white p-5 transition hover:border-[#A0A7B4]"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-lg font-semibold text-[#806236]">
            {s.avatar_initials || '–'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-[#0F1B2D]">{s.display_name}</h2>
            </div>
            <p className="mt-1 text-xs text-[#4A5568]">
              {s.tagline || 'No tagline added yet.'}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              MENTORSHIP_STATUS_CHIP[m.status] || ''
            }`}
          >
            {MENTORSHIP_STATUS_LABEL[m.status] || m.status}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#4A5568]">
          <span className="rounded-full bg-[#F3EBDD] px-2.5 py-1 font-medium text-[#806236]">
            Stage: {s.stage ? STAGE_LABEL[s.stage] || s.stage : 'Not set'}
          </span>
          {s.sector && <span>{s.sector}</span>}
          {s.city && (
            <span>
              <MapPin className="mr-1 inline" size={11} />
              {s.city}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
            {m.fee_amount
              ? 'Fee terms agreed'
              : m.cadence
                ? `Cadence: ${m.cadence}`
                : 'No cadence set'}
          </span>
          <span className="text-xs text-[#4A5568]">
            Next session:{' '}
            {formatInstant(m.next_session_at) || 'not scheduled'}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E1D8] pt-3">
          <small className="text-xs text-[#4A5568]">
            Started {formatDate(m.started_on) || '—'} · Needs:{' '}
            {m.needs.length ? m.needs.join(', ') : 'not specified'}
          </small>
          <div className="flex gap-2">
            <Link
              href={`/mentor/startups/${m.id}`}
              className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
            >
              Open workspace
            </Link>
            <button
              type="button"
              onClick={() =>
                notify('Messaging arrives in a later step — nothing was sent.')
              }
              className="text-xs font-semibold text-[#9A7A45]"
            >
              Message
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderList = () => {
    if (phase === 'loading') return <LoadingBlock label="Loading your startups…" rows={2} />;
    if (phase === 'error')
      return <ErrorBlock message={loadError} onRetry={() => setReload((n) => n + 1)} />;
    if (visible.length === 0) {
      return (
        <EmptyBlock
          title={
            search
              ? 'No startups match that search'
              : statusFilter === 'Active'
                ? 'No active mentorships'
                : statusFilter === 'Paused'
                  ? 'No paused mentorships'
                  : 'No past mentorships'
          }
          hint={
            search
              ? 'Clear the search to see every startup in this tab.'
              : statusFilter === 'Active'
                ? 'Accept a request from the Requests page to start a mentorship.'
                : statusFilter === 'Paused'
                  ? 'Mentorships you pause will be listed here.'
                  : 'Completed, declined and cancelled mentorships are kept here.'
          }
        >
          {statusFilter === 'Active' && !search && (
            <Link
              href="/mentor/requests"
              className="rounded-lg bg-[#0F1B2D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
            >
              Review requests
            </Link>
          )}
        </EmptyBlock>
      );
    }

    if (statusFilter === 'Active' && view === 'Table') {
      return (
        <Card title="Active mentorships">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-xs">
              <thead className="border-b border-[#E5E1D8] text-[#4A5568]">
                <tr>
                  {['Startup', 'Stage', 'Status', 'Started', 'Next session', ''].map((x) => (
                    <th key={x} className="py-3 font-medium">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.id} className="border-b border-[#E5E1D8]">
                    <td className="py-3 font-semibold text-[#0F1B2D]">
                      {m.startup.display_name}
                    </td>
                    <td className="text-[#4A5568]">
                      {m.startup.stage ? STAGE_LABEL[m.startup.stage] || m.startup.stage : '—'}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          MENTORSHIP_STATUS_CHIP[m.status] || ''
                        }`}
                      >
                        {MENTORSHIP_STATUS_LABEL[m.status] || m.status}
                      </span>
                    </td>
                    <td className="text-[#4A5568]">{formatDate(m.started_on) || '—'}</td>
                    <td className="text-[#4A5568]">
                      {formatInstant(m.next_session_at) || 'Not scheduled'}
                    </td>
                    <td>
                      <Link
                        href={`/mentor/startups/${m.id}`}
                        className="font-semibold text-[#9A7A45]"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      );
    }

    return <div className="grid gap-4 lg:grid-cols-2">{visible.map(startupCard)}</div>;
  };

  return (
    <MentorPageShell active="My startups" toast={toast} notify={notify}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#4A5568]">
            Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Forma
          </p>
          <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">My startups</h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            Manage active mentorships and keep each startup moving.
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Active', buckets.active.length],
          ['Paused', buckets.paused.length],
          ['Past', buckets.past.length],
          ['Total', mentorships.length],
        ].map(([x, v]) => (
          <div key={x} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <p className="text-xs text-[#4A5568]">{x}</p>
            <b className="serif mt-1 block text-2xl text-[#0F1B2D]">
              {phase === 'ready' ? String(v) : '—'}
            </b>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-[#E5E1D8] bg-white p-1">
          {['Active', 'Paused', 'Past'].map((x) => (
            <button
              type="button"
              onClick={() => setStatusFilter(x)}
              key={x}
              className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                statusFilter === x
                  ? 'bg-[#0F1B2D] text-white'
                  : 'text-[#4A5568] hover:text-[#0F1B2D]'
              }`}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="relative min-w-[170px] flex-1">
          <Search size={15} className="absolute left-3 top-3 text-[#A0A7B4]" />
          <input
            aria-label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search startups"
            className="h-10 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs focus:border-[#0F1B2D] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setView(view === 'Cards' ? 'Table' : 'Cards')}
          className="grid h-10 w-10 place-items-center rounded-lg border border-[#E5E1D8] bg-white text-[#4A5568] hover:text-[#0F1B2D]"
          aria-label="Toggle view"
        >
          {view === 'Cards' ? <Table2 size={16} /> : <Grid2X2 size={16} />}
        </button>
      </div>

      {renderList()}
    </MentorPageShell>
  );
}
