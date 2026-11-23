'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { InvestorShell, Card, Button } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { InvestorDisclaimer } from '../investor-data';

const STAGE_LABELS = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature',
};

const STATUS_LABELS = {
  new: 'New',
  reviewing: 'Reviewing',
  follow_up: 'Follow up',
  waiting_for_startup: 'Waiting for startup',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage;
}

export default function InvestorShortlistPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [entries, setEntries] = useState([]);
  const [notes, setNotes] = useState({});
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [movingId, setMovingId] = useState(null);

  const filteredEntries =
    filter === 'all' ? entries : entries.filter((e) => e.status === filter);

  const load = async () => {
    setPhase('loading');
    setError('');
    try {
      const list = await api.investorShortlist.list();
      setEntries(list);
      const initialNotes = {};
      list.forEach((e) => {
        initialNotes[e.id] = e.note || '';
      });
      setNotes(initialNotes);
      setPhase('ready');
    } catch (err) {
      setPhase('error');
      setError(err instanceof ApiError ? err.message : 'Could not load your shortlist.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const countByStatus = (status) => entries.filter((e) => e.status === status).length;

  return (
    <InvestorShell
      active="Shortlist"
      module="Deal flow"
      title="Shortlist"
      description="Keep promising startups organized before moving them into your pipeline."
    >
      {({ notify }) => (
        <>
          {phase === 'loading' && <LoadingBlock label="Loading your shortlist…" />}

          {phase === 'error' && <ErrorBlock message={error} />}

          {phase === 'ready' && (
            <>
              {/* Stat Strip */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                {[
                  ['Shortlisted startups', entries.length],
                  ['Reviewing', countByStatus('reviewing')],
                  ['Follow up', countByStatus('follow_up')],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                    <span className="text-xs font-medium text-[#4A5568]">{label}</span>
                    <span className="serif mt-1 block text-3xl font-semibold text-ink">{val}</span>
                  </div>
                ))}
              </div>

              <div className="grid items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
                {/* Status filter sidebar */}
                <aside className="rounded-xl border border-[#E5E1D8] bg-white p-3 space-y-1">
                  {['All', 'New', 'Reviewing', 'Follow up', 'Waiting for startup'].map((x) => {
                    const key =
                      x === 'New'
                        ? 'new'
                        : x === 'Reviewing'
                          ? 'reviewing'
                          : x === 'Follow up'
                            ? 'follow_up'
                            : x === 'Waiting for startup'
                              ? 'waiting_for_startup'
                              : 'all';
                    return (
                      <FilterButton
                        key={x}
                        label={x}
                        active={filter === key}
                        onClick={() => setFilter(key)}
                      />
                    );
                  })}
                </aside>

                {/* Startup Cards */}
                <div className="space-y-4">
                  {filteredEntries.map((e) => (
                    <Card
                      key={e.id}
                      title={
                        <div className="flex items-center gap-2">
                          <span>{e.startup_name}</span>
                          <span className="rounded-full bg-[#F3EBDD] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
                            {statusLabel(e.status)}
                          </span>
                        </div>
                      }
                      action={
                        <Link
                          href={`/investor/startups/${e.startup_slug}`}
                          className="text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
                          View profile →
                        </Link>
                      }
                    >
                      <p className="text-xs text-[#4A5568]">
                        {stageLabel(e.startup_stage)} · {e.startup_sector || 'Sector not shared'} ·
                        readiness {e.startup_readiness_score != null ? e.startup_readiness_score : '—'}
                      </p>
                      <p className="mt-1 text-xs text-[#9A7A45]">
                        Saved {new Date(e.created_at).toLocaleDateString()} · Last updated{' '}
                        {new Date(e.updated_at).toLocaleDateString()}
                      </p>

                      <div className="mt-4">
                        <label htmlFor={`notes-${e.id}`} className="block text-xs font-medium text-ink">
                          Private notes
                        </label>
                        <textarea
                          id={`notes-${e.id}`}
                          value={notes[e.id] || ''}
                          onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })}
                          placeholder="Private notes for your internal team..."
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-2.5 text-xs focus:border-ink focus:outline-none"
                        />
                        <Button
                          secondary
                          className="mt-2"
                          onClick={async () => {
                            try {
                              await api.investorShortlist.update(e.id, { note: notes[e.id] || null });
                              notify('Private note saved.');
                            } catch (err) {
                              notify(err instanceof ApiError ? err.message : 'Could not save note.');
                            }
                          }}
                        >
                          Save note
                        </Button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E5E1D8] pt-3">
                        <Link
                          href={`/investor/startups/${e.startup_slug}`}
                          className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                        >
                          View profile
                        </Link>

                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`status-sel-${e.id}`} className="sr-only">
                            Status
                          </label>
                          <select
                            id={`status-sel-${e.id}`}
                            value={e.status}
                            onChange={async (ev) => {
                              try {
                                const updated = await api.investorShortlist.update(e.id, {
                                  status: ev.target.value,
                                });
                                setEntries((prev) =>
                                  prev.map((x) => (x.id === e.id ? updated : x))
                                );
                                notify(`Status set to ${statusLabel(ev.target.value)}.`);
                              } catch (err) {
                                notify(err instanceof ApiError ? err.message : 'Could not update status.');
                              }
                            }}
                            className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-2.5 text-xs focus:border-ink focus:outline-none"
                          >
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>

                        <Button
                          secondary
                          disabled={movingId === e.id}
                          onClick={async () => {
                            if (movingId) return;
                            setMovingId(e.id);
                            try {
                              await api.investorDeals.create({
                                startup_org_id: e.startup_org_id,
                                stage: 'interested',
                              });
                              setEntries((prev) => prev.filter((entry) => entry.id !== e.id));
                              notify(`Moved ${e.startup_name} into the pipeline (Interested).`);
                            } catch (err) {
                              if (err instanceof ApiError && err.status === 409) {
                                setEntries((prev) => prev.filter((entry) => entry.id !== e.id));
                                try {
                                  await api.investorShortlist.remove(e.id);
                                } catch {
                                  // The deal already exists; a later reload will reconcile the shortlist.
                                }
                                notify(`${e.startup_name} is already in the pipeline.`);
                              } else {
                                notify(err instanceof ApiError ? err.message : 'Could not move to pipeline.');
                              }
                            } finally {
                              setMovingId(null);
                            }
                          }}
                        >
                          {movingId === e.id ? 'Moving…' : 'Move to pipeline'}
                        </Button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.investorShortlist.remove(e.id);
                              notify('Removed from shortlist.');
                              load();
                            } catch (err) {
                              notify(err instanceof ApiError ? err.message : 'Could not remove.');
                            }
                          }}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>

                        <Link
                          href={`/investor/startups/${e.startup_slug}`}
                          className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                        >
                          Request intro
                        </Link>
                      </div>
                    </Card>
                  ))}

                  {filteredEntries.length === 0 && (
                    <EmptyBlock
                      title="Nothing here"
                      description={
                        entries.length === 0
                          ? 'Bookmark promising startups from Discover to evaluate and organize them here.'
                          : 'No shortlist entries match this filter.'
                      }
                      action={
                        entries.length === 0 ? (
                          <Link
                            href="/investor/discover"
                            className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                          >
                            Discover startups
                          </Link>
                        ) : undefined
                      }
                    />
                  )}
                </div>
              </div>

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />
            </>
          )}
        </>
      )}
    </InvestorShell>
  );
}

function FilterButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block min-h-10 w-full rounded-lg px-3 text-left text-xs transition ${
        active
          ? 'bg-[#F3EBDD] font-semibold text-ink'
          : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}
