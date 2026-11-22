'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api } from '@/lib/api/client';
import { InvestorDisclaimer } from '../investor-data';

export default function InvestorActivityPage() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [eventType, setEventType] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async (type) => {
    setLoading(true);
    setError('');
    try {
      const [page, statsRes] = await Promise.all([
        api.workspace.activity({ event_type: type || undefined, limit: 100 }),
        api.workspace.activityStats(),
      ]);
      setEvents(page.items);
      setStats(statsRes);
    } catch (err) {
      setError(err?.message || 'Could not load your activity log.');
      setEvents([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(eventType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          (e.summary || '').toLowerCase().includes(q) ||
          (e.event_type || '').toLowerCase().includes(q) ||
          (e.entity_type || '').toLowerCase().includes(q)
        );
      }),
    [events, query],
  );

  const eventTypeKeys = Object.keys(stats?.by_event_type || {});

  return (
    <InvestorShell
      active="Activity"
      module="Deal flow"
      title="Activity & compliance audit log"
      description="A tamper-evident, readable record of deal views, NDA signatures and document accesses."
      actions={
        <Button secondary onClick={() => {}}>
          <Download size={14} /> Export audit log
        </Button>
      }
    >
      {({ notify }) => (
        <>
          <div className="mb-6 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568] border border-[#E5E1D8]">
            This security audit log is immutable and cannot be edited or deleted. It ensures full NDA compliance and
            accountability.
          </div>

          {loading && <LoadingBlock label="Loading activity log…" />}
          {!loading && error && !stats && <ErrorBlock message={error} onRetry={() => load(eventType)} />}

          {!loading && stats && (
            <>
              {/* Stat Strip */}
              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ['Events · total', stats.total_events],
                  ['Events · last 7 days', stats.events_last_7_days],
                  ['Event types tracked', eventTypeKeys.length],
                  ['Active days', stats.by_day?.length || 0],
                ].map(([x, y]) => (
                  <div key={x} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                    <span className="text-xs font-medium text-[#4A5568]">{x}</span>
                    <span className="serif mt-1 block text-3xl font-semibold text-ink">{y}</span>
                  </div>
                ))}
              </div>

              {/* Sub Navigation Tabs */}
              <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {['All activity', ...eventTypeKeys].map((x) => {
                  const active = eventType === (x === 'All activity' ? '' : x);
                  return (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setEventType(x === 'All activity' ? '' : x)}
                      className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                        active
                          ? 'bg-ink text-white'
                          : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                      }`}
                    >
                      {x}
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="mb-4 flex flex-wrap gap-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search audit actions, companies, entities..."
                  className="h-10 w-72 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                />
              </div>

              {/* Table Card */}
              <Card title="Audit events">
                {filtered.length === 0 ? (
                  <EmptyBlock
                    title="No matching events"
                    hint={events.length === 0 ? 'No activity events have been recorded for your organization yet.' : 'Try a different search or filter.'}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E5E1D8] text-[#4A5568]">
                          {['Timestamp', 'Event type', 'Summary', 'Entity', 'Action'].map((x) => (
                            <th key={x} className="py-3 font-semibold">
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1D8]">
                        {filtered.map((e) => (
                          <tr
                            key={e.id}
                            onClick={() => setDetail(e)}
                            className="cursor-pointer hover:bg-[#FAF8F4] transition"
                          >
                            <td className="py-3 font-medium text-ink">
                              {new Date(e.created_at).toLocaleString()}
                            </td>
                            <td className="py-3">
                              <span className="rounded bg-[#FAF8F4] px-2 py-0.5 text-xs font-medium text-ink">
                                {e.event_type}
                              </span>
                            </td>
                            <td className="py-3 font-semibold text-ink">{e.summary}</td>
                            <td className="py-3 text-[#806236]">{e.entity_type || '—'}</td>
                            <td className="py-3">
                              {e.link_url ? (
                                <span className="text-[#9A7A45] hover:underline">view →</span>
                              ) : (
                                <span className="text-[#4A5568]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-[#E5E1D8] pt-3">
                  <span className="text-xs text-[#4A5568]">Showing {filtered.length} of {stats.total_events} events</span>
                </div>
              </Card>

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

              {/* Event Detail Modal */}
              {detail && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                  <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="serif text-xl font-bold text-ink">Audit record details</h2>
                      <button type="button" onClick={() => setDetail(null)}>
                        <X size={18} />
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-[#E5E1D8] py-2">
                        <b className="text-[#4A5568]">Timestamp:</b>
                        <span className="font-semibold text-ink text-right">
                          {new Date(detail.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-[#E5E1D8] py-2">
                        <b className="text-[#4A5568]">Event type:</b>
                        <span className="font-semibold text-ink text-right">{detail.event_type}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#E5E1D8] py-2">
                        <b className="text-[#4A5568]">Entity:</b>
                        <span className="font-semibold text-ink text-right">
                          {detail.entity_type || '—'}{' '}
                          {detail.entity_id ? String(detail.entity_id).slice(0, 8) : ''}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-[#E5E1D8] py-2">
                        <b className="text-[#4A5568]">Summary:</b>
                        <span className="font-semibold text-ink text-right">{detail.summary}</span>
                      </div>
                    </div>
                    {detail.link_url && (
                      <a
                        href={detail.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                      >
                        Open related link →
                      </a>
                    )}
                    <div className="mt-6 flex justify-end">
                      <Button onClick={() => setDetail(null)}>Close</Button>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </>
      )}
    </InvestorShell>
  );
}
