'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, LockKeyhole, X } from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { InvestorDisclaimer } from '../investor-data';

const PIPELINE_STAGE_ORDER = [
  'interested',
  'intro',
  'meeting',
  'data_room',
  'diligence',
  'offer',
  'committed',
];

const PIPELINE_STAGE_LABELS = {
  interested: 'Interested',
  intro: 'Intro',
  meeting: 'Meeting',
  data_room: 'Data room',
  diligence: 'Diligence',
  offer: 'Offer',
  committed: 'Committed',
  passed: 'Passed',
  closed: 'Closed',
};

function stageLabel(stage) {
  return PIPELINE_STAGE_LABELS[stage] || stage;
}

function formatMoney(value, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  const sym = currency === 'INR' ? '₹' : currency + ' ';
  if (num >= 1e7) return sym + (num / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  if (num >= 1e5) return sym + (num / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
  return sym + num.toLocaleString('en-IN');
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function InvestorPipelinePage() {
  const { user } = useAuth();
  const [view, setView] = useState('Board');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [deals, setDeals] = useState([]);
  const [summary, setSummary] = useState({ counts: {}, total: 0 });
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [draft, setDraft] = useState({});
  const [modal, setModal] = useState('');
  const [shortlist, setShortlist] = useState([]);

  const load = async () => {
    setPhase('loading');
    setError('');
    try {
      const [page, sum] = await Promise.all([
        api.investorDeals.list({ limit: 100 }),
        api.investorDeals.summary(),
      ]);
      setDeals(page.items);
      setSummary(sum);
      setPhase('ready');
    } catch (err) {
      setPhase('error');
      setError(err instanceof ApiError ? err.message : 'Could not load your pipeline.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openAdd = async () => {
    try {
      const entries = await api.investorShortlist.list();
      setShortlist(entries);
      setModal('add');
    } catch (err) {
      setModal('add');
      setShortlist([]);
    }
  };

  const filteredDeals = deals.filter((d) => {
    const matchSearch =
      !search ||
      `${d.startup_name} ${d.startup_sector || ''} ${d.startup_tagline || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchFilter = filter === 'all' || d.stage === filter;
    return matchSearch && matchFilter;
  });

  const stalled = deals.filter((d) => daysSince(d.last_activity_at) > 14);
  const expectedCommitments = deals
    .filter((d) => d.stage === 'offer' || d.stage === 'committed')
    .reduce((acc, d) => acc + (Number(d.ticket_size) || 0), 0);

  const countsByStage = (stage) => summary.counts[stage] || 0;

  const saveDrawer = async () => {
    if (!drawer) return;
    try {
      const updated = await api.investorDeals.update(drawer.id, {
        stage: draft.stage,
        ticket_size: draft.ticket_size === '' ? null : draft.ticket_size,
        probability: draft.probability === '' ? null : Number(draft.probability),
        next_step: draft.next_step || null,
        fit_note: draft.fit_note || null,
      });
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setDrawer(updated);
      setDraft({
        stage: updated.stage,
        ticket_size: updated.ticket_size != null ? String(updated.ticket_size) : '',
        probability: updated.probability != null ? String(updated.probability) : '',
        next_step: updated.next_step || '',
        fit_note: updated.fit_note || '',
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the deal.');
    }
  };

  const openDrawer = (deal) => {
    setDrawer(deal);
    setDraft({
      stage: deal.stage,
      ticket_size: deal.ticket_size != null ? String(deal.ticket_size) : '',
      probability: deal.probability != null ? String(deal.probability) : '',
      next_step: deal.next_step || '',
      fit_note: deal.fit_note || '',
    });
  };

  return (
    <InvestorShell
      active="Pipeline"
      module="Deal flow"
      title="Deal pipeline"
      description="Track every investment opportunity, diligence stage, next step and decision."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button secondary onClick={openAdd}>
            <Plus size={14} /> Add startup
          </Button>
          <div className="flex items-center rounded-lg border border-[#E5E1D8] bg-white p-1">
            {['Board', 'Table', 'Funnel'].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setView(x)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  view === x ? 'bg-ink text-white' : 'text-[#4A5568] hover:text-ink'
                }`}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {({ notify }) => (
        <>
          {phase === 'loading' && <LoadingBlock label="Loading your pipeline…" />}

          {phase === 'error' && <ErrorBlock message={error} />}

          {phase === 'ready' && (
            <>
              {/* Top Stat Strip */}
              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  ['In pipeline', summary.total],
                  ['Data rooms open', countsByStage('data_room') + countsByStage('diligence')],
                  ['Expected commitments', formatMoney(expectedCommitments)],
                  ['Needs follow-up', stalled.length],
                  ['Committed', countsByStage('committed')],
                ].map(([x, y]) => (
                  <div key={x} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                    <span className="text-xs font-medium text-[#4A5568]">{x}</span>
                    <span className="serif mt-1 block text-2xl font-semibold text-ink">{y}</span>
                  </div>
                ))}
              </div>

              {/* Filter Bar */}
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search deals in pipeline..."
                  className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                >
                  <option value="all">All stages</option>
                  {PIPELINE_STAGE_ORDER.map((x) => (
                    <option key={x} value={x}>
                      {stageLabel(x)}
                    </option>
                  ))}
                </select>
                <Link
                  href="/investor/compare"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
                >
                  Compare deals →
                </Link>
              </div>

              {/* Board View */}
              {view === 'Board' && (
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
                  {PIPELINE_STAGE_ORDER.map((stage) => {
                    const stageDeals = filteredDeals.filter((d) => d.stage === stage);
                    return (
                      <section
                        key={stage}
                        className="w-[280px] shrink-0 rounded-2xl bg-[#F2EFE8] p-3.5 flex flex-col"
                      >
                        <div className="mb-3 flex items-center justify-between px-1">
                          <b className="text-xs font-bold uppercase tracking-wider text-[#0F1B2D]">
                            {stageLabel(stage)}
                          </b>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink shadow-sm">
                            {stageDeals.length}
                          </span>
                        </div>
                        <div className="space-y-3 flex-1 overflow-y-auto">
                          {stageDeals.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => openDrawer(d)}
                              className="w-full rounded-xl border border-[#E5E1D8] bg-white p-3.5 text-left transition hover:border-ink hover:shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F3EBDD] font-semibold text-ink text-xs">
                                    {d.startup_logo_initials || '·'}
                                  </span>
                                  <b className="text-xs font-semibold text-ink">{d.startup_name}</b>
                                </div>
                              </div>
                              <p className="mt-2.5 text-xs text-[#4A5568]">
                                {d.startup_sector || 'Sector not shared'} ·{' '}
                                {d.round_target != null
                                  ? formatMoney(d.round_target, d.round_currency)
                                  : 'Round not shared'}
                              </p>
                              <div className="mt-2 flex items-center justify-between text-xs font-medium text-ink">
                                <span>
                                  {d.ticket_size != null
                                    ? formatMoney(d.ticket_size, d.currency)
                                    : 'Ticket not set'}
                                </span>
                                <span className="text-[#806236]">{d.next_step || 'No next step'}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-[#4A5568] border-t border-[#E5E1D8] pt-2">
                                <span>
                                  {d.last_activity_at
                                    ? `Active ${new Date(d.last_activity_at).toLocaleDateString()}`
                                    : 'No activity'}
                                </span>
                                <span>{d.owner_name || 'Unassigned'}</span>
                              </div>
                            </button>
                          ))}
                          {stageDeals.length === 0 && (
                            <div className="rounded-xl border border-dashed border-[#D2CCC0] p-4 text-center text-xs text-[#828894]">
                              No deals in this stage
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {/* Table View */}
              {view === 'Table' && (
                <div className="overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white">
                  <table className="w-full min-w-[1000px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E1D8] bg-[#FAF8F4] text-[#4A5568]">
                        {[
                          'Startup',
                          'Stage',
                          'Sector',
                          'Readiness',
                          'Round',
                          'Ticket',
                          'Probability',
                          'Owner',
                          'Next step',
                          'Last activity',
                          'Actions',
                        ].map((x) => (
                          <th key={x} className="p-3 font-semibold">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8]">
                      {filteredDeals.map((d) => (
                        <tr key={d.id} className="hover:bg-[#FAF8F4]/50">
                          <td className="p-3 font-semibold text-ink">{d.startup_name}</td>
                          <td className="p-3">
                            <select
                              value={d.stage}
                              onChange={async (e) => {
                                try {
                                  const updated = await api.investorDeals.update(d.id, {
                                    stage: e.target.value,
                                  });
                                  setDeals((prev) =>
                                    prev.map((x) => (x.id === updated.id ? updated : x))
                                  );
                                  notify(`Updated ${d.startup_name} stage to ${stageLabel(e.target.value)}.`);
                                } catch (err) {
                                  notify(err instanceof ApiError ? err.message : 'Could not update stage.');
                                }
                              }}
                              className="rounded border border-[#E5E1D8] bg-white p-1.5 text-xs focus:border-ink focus:outline-none"
                            >
                              {PIPELINE_STAGE_ORDER.map((x) => (
                                <option key={x} value={x}>
                                  {stageLabel(x)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">{d.startup_sector || '—'}</td>
                          <td className="p-3 font-medium text-ink">
                            {d.startup_readiness_score != null ? `${d.startup_readiness_score}/100` : '—'}
                          </td>
                          <td className="p-3">
                            {d.round_target != null
                              ? formatMoney(d.round_target, d.round_currency)
                              : '—'}
                          </td>
                          <td className="p-3 font-semibold text-ink">
                            {d.ticket_size != null ? formatMoney(d.ticket_size, d.currency) : '—'}
                          </td>
                          <td className="p-3">
                            {d.probability != null ? `${d.probability}%` : '—'}
                          </td>
                          <td className="p-3">{d.owner_name || '—'}</td>
                          <td className="p-3 text-[#806236] font-medium">
                            {d.next_step || '—'}
                          </td>
                          <td className="p-3">
                            {d.last_activity_at
                              ? new Date(d.last_activity_at).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => openDrawer(d)}
                              className="text-xs font-semibold text-[#9A7A45] hover:underline"
                            >
                              Details →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredDeals.length === 0 && (
                    <div className="p-6">
                      <EmptyBlock
                        title="No deals match"
                        description="Adjust the search or stage filter to see deals in your pipeline."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Funnel View */}
              {view === 'Funnel' && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card title="Pipeline conversion funnel">
                    <div className="space-y-3.5">
                      {PIPELINE_STAGE_ORDER.map((s, i) => {
                        const count = countsByStage(s);
                        const maxCount = Math.max(
                          1,
                          countsByStage(PIPELINE_STAGE_ORDER[0])
                        );
                        return (
                          <div key={s} className="flex items-center gap-3 text-xs">
                            <span className="w-32 font-medium text-ink">{stageLabel(s)}</span>
                            <div
                              className="h-6 rounded-md bg-ink flex items-center justify-end pr-2 text-white font-bold"
                              style={{ width: `${Math.max(16, (count / maxCount) * 100)}%` }}
                            >
                              {count}
                            </div>
                            <span className="text-xs text-[#4A5568]">
                              {i === 0 ? 'Base' : `-${Math.max(0, Math.round((1 - count / Math.max(1, countsByStage(PIPELINE_STAGE_ORDER[0]))) * 100))}% drop`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-4 text-xs text-[#4A5568]">
                      Counts reflect your live pipeline, not investment guarantees.
                    </p>
                  </Card>

                  <Card title="Stalled deals · 14+ days no activity">
                    {stalled.length === 0 ? (
                      <p className="text-xs text-[#4A5568]">
                        No deals have gone quiet for 14 days or more.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {stalled.map((d) => (
                          <div
                            key={d.id}
                            className="rounded-lg border border-[#E5E1D8] p-3 flex items-center justify-between"
                          >
                            <div>
                              <b className="block text-xs font-semibold text-ink">
                                {d.startup_name}
                              </b>
                              <span className="text-xs text-[#8A5700]">
                                No activity for {daysSince(d.last_activity_at)}d · Stage:{' '}
                                {stageLabel(d.stage)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openDrawer(d)}
                              className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                            >
                              Schedule follow-up
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              <div className="mt-6 rounded-lg bg-[#F3EBDD] p-3 text-xs text-[#806236]">
                <LockKeyhole className="mr-2 inline" size={14} />
                Pipeline stage, ticket size, deal probability and notes are private to your investment
                team.
              </div>

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

              {/* Quick Drawer */}
              {drawer && (
                <div
                  className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
                  onClick={() => setDrawer(null)}
                >
                  <aside
                    className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-[#FAF8F4] p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#806236]">
                        Deal management
                      </span>
                      <button
                        type="button"
                        onClick={() => setDrawer(null)}
                        className="rounded p-1 hover:bg-black/5"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <h2 className="serif mt-4 text-2xl font-bold text-ink">{drawer.startup_name}</h2>
                    <p className="mt-1 text-xs text-[#4A5568]">{drawer.startup_tagline}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                        {stageLabel(draft.stage)}
                      </span>
                      {drawer.startup_sector && (
                        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                          {drawer.startup_sector}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 space-y-4">
                      <div>
                        <label htmlFor="drawer-stage" className="block text-xs font-medium text-ink">
                          Pipeline stage
                        </label>
                        <select
                          id="drawer-stage"
                          value={draft.stage}
                          onChange={(e) => setDraft((prev) => ({ ...prev, stage: e.target.value }))}
                          className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                        >
                          {PIPELINE_STAGE_ORDER.map((x) => (
                            <option key={x} value={x}>
                              {stageLabel(x)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="drawer-ticket" className="block text-xs font-medium text-ink">
                          Expected ticket size (₹)
                        </label>
                        <input
                          id="drawer-ticket"
                          type="number"
                          min="0"
                          value={draft.ticket_size}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, ticket_size: e.target.value }))
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="drawer-prob" className="block text-xs font-medium text-ink">
                          Probability (%)
                        </label>
                        <input
                          id="drawer-prob"
                          type="number"
                          min="0"
                          max="100"
                          value={draft.probability}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, probability: e.target.value }))
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="drawer-next" className="block text-xs font-medium text-ink">
                          Next action step
                        </label>
                        <input
                          id="drawer-next"
                          value={draft.next_step}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, next_step: e.target.value }))
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="drawer-note" className="block text-xs font-medium text-ink">
                          Fit note
                        </label>
                        <textarea
                          id="drawer-note"
                          rows={3}
                          value={draft.fit_note}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, fit_note: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-2.5 text-xs focus:border-ink focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <Button onClick={saveDrawer}>Save changes</Button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.investorDeals.remove(drawer.id);
                            notify('Deal removed from pipeline.');
                            setDrawer(null);
                            load();
                          } catch (err) {
                            notify(err instanceof ApiError ? err.message : 'Could not remove deal.');
                          }
                        }}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove deal
                      </button>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                      <Link
                        href={`/investor/startups/${drawer.startup_slug}`}
                        className="rounded-lg border border-[#E5E1D8] bg-white p-3 font-semibold text-ink hover:bg-[#FAF8F4]"
                      >
                        Profile →
                      </Link>
                      <Link
                        href="/investor/compare"
                        className="rounded-lg border border-[#E5E1D8] bg-white p-3 font-semibold text-ink hover:bg-[#FAF8F4]"
                      >
                        Compare →
                      </Link>
                    </div>
                  </aside>
                </div>
              )}

              {/* Add Startup Modal */}
              {modal === 'add' && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                  <section
                    role="dialog"
                    aria-modal="true"
                    className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="serif text-xl font-bold text-ink">Add to pipeline</h2>
                      <button type="button" onClick={() => setModal('')}>
                        <X size={18} />
                      </button>
                    </div>
                    {shortlist.length === 0 ? (
                      <p className="text-xs text-[#4A5568]">
                        Your shortlist is empty. Bookmark a startup from Discover to add it to your
                        pipeline here.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {shortlist.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-lg border border-[#E5E1D8] p-3"
                          >
                            <span className="text-xs font-semibold text-ink">{e.startup_name}</span>
                            <Button
                              secondary
                              onClick={async () => {
                                try {
                                  await api.investorDeals.create({
                                    startup_org_id: e.startup_org_id,
                                    stage: 'interested',
                                  });
                                  notify(`Added ${e.startup_name} to the pipeline.`);
                                  setModal('');
                                  load();
                                } catch (err) {
                                  notify(err instanceof ApiError ? err.message : 'Could not add deal.');
                                }
                              }}
                            >
                              Add deal
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <Link
                        href="/investor/discover"
                        className="text-xs font-semibold text-[#9A7A45] hover:underline"
                      >
                        Discover startups →
                      </Link>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setModal('')}
                        className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]"
                      >
                        Close
                      </button>
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
