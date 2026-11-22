'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
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

function formatCriteria(criteria) {
  if (!criteria || Object.keys(criteria).length === 0) {
    return 'All stages · All sectors · Investment Ready included';
  }
  const parts = [];
  if (criteria.stage) parts.push(STAGE_LABELS[criteria.stage] || criteria.stage);
  if (criteria.sector) parts.push(criteria.sector);
  if (criteria.city) parts.push(criteria.city);
  if (criteria.q) parts.push(`"${criteria.q}"`);
  parts.push(criteria.investment_ready_only ? 'Investment Ready only' : 'Investment Ready included');
  return parts.join(' · ');
}

export default function InvestorSearchesPage() {
  const { user } = useAuth();
  const [searchTab, setSearchTab] = useState('Saved searches');
  const [modal, setModal] = useState('');
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [searches, setSearches] = useState([]);
  const [matchCounts, setMatchCounts] = useState({});
  const [error, setError] = useState('');
  const [newSearchName, setNewSearchName] = useState('');
  const [newSearchStage, setNewSearchStage] = useState('');
  const [newSearchSector, setNewSearchSector] = useState('');

  const load = async () => {
    setPhase('loading');
    setError('');
    try {
      const list = await api.investorSearches.list();
      setSearches(list);
      // Best-effort match counts for the stat strip and cards.
      const counts = {};
      await Promise.all(
        list.map(async (s) => {
          try {
            const page = await api.investorSearches.matches(s.id, { limit: 1 });
            counts[s.id] = page.total;
          } catch {
            counts[s.id] = 0;
          }
        })
      );
      setMatchCounts(counts);
      setPhase('ready');
    } catch (err) {
      setPhase('error');
      setError(err instanceof ApiError ? err.message : 'Could not load saved searches.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const totalMatches = Object.values(matchCounts).reduce((a, b) => a + b, 0);

  const createSearch = async () => {
    if (!newSearchName.trim()) return;
    try {
      await api.investorSearches.create({
        name: newSearchName.trim(),
        criteria: {
          stage: newSearchStage || undefined,
          sector: newSearchSector || undefined,
          investment_ready_only: false,
        },
      });
      notify(`Saved search "${newSearchName.trim()}" created.`);
      setNewSearchName('');
      setNewSearchStage('');
      setNewSearchSector('');
      setModal('');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not create the search.');
    }
  };

  return (
    <InvestorShell
      active="Saved searches"
      module="Deal flow"
      title="Saved searches and alerts"
      description="Get a quiet signal when new opted-in startups match your investment criteria."
      actions={
        <Button onClick={() => setModal('save-search')}>
          <Plus size={14} /> New saved search
        </Button>
      }
    >
      {({ notify }) => (
        <>
          {phase === 'loading' && <LoadingBlock label="Loading saved searches…" />}

          {phase === 'error' && <ErrorBlock message={error} />}

          {phase === 'ready' && (
            <>
              {/* Stat Strip */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                {[
                  ['Saved searches', searches.length],
                  ['Alerts active', searches.filter((s) => s.is_active).length],
                  ['Total matches', totalMatches],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[#E5E1D8] bg-white p-5"
                  >
                    <span className="text-xs font-medium text-[#4A5568]">{label}</span>
                    <span className="serif mt-1 block text-3xl font-semibold text-ink">{val}</span>
                  </div>
                ))}
              </div>

              {/* Sub Navigation Tabs */}
              <div className="mb-6 flex gap-2">
                {['Saved searches', 'Alerts', 'Recommendation settings'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSearchTab(t)}
                    className={`min-h-10 rounded-lg px-4 text-xs font-semibold transition ${
                      searchTab === t
                        ? 'bg-ink text-white'
                        : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {searchTab === 'Saved searches' && (
                <div className="space-y-4">
                  {searches.map((s) => (
                    <Card
                      key={s.id}
                      title={s.name}
                      action={
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            s.is_active
                              ? 'bg-[#E7F3EC] text-[#286749]'
                              : 'bg-[#F3F4F6] text-[#4A5568]'
                          }`}
                        >
                          {s.is_active ? 'Alerts on' : 'Alerts paused'}
                        </span>
                      }
                    >
                      <p className="text-xs text-[#4A5568]">{formatCriteria(s.criteria)}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs border-t border-[#E5E1D8] pt-3">
                        <b className="text-[#9A7A45]">{matchCounts[s.id] || 0} matching startups</b>
                        <span className="text-[#4A5568]">·</span>
                        <span className="text-[#4A5568]">
                          Updated {new Date(s.updated_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                          href="/investor/discover"
                          className="inline-flex min-h-9 items-center rounded-lg bg-ink px-3 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                        >
                          View results
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.investorSearches.update(s.id, { is_active: !s.is_active });
                              notify(s.is_active ? 'Alerts paused.' : 'Alerts resumed.');
                              load();
                            } catch (err) {
                              notify(err instanceof ApiError ? err.message : 'Could not update alerts.');
                            }
                          }}
                          className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
                        >
                          {s.is_active ? 'Pause alerts' : 'Resume alerts'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.investorSearches.create({
                                name: `${s.name} (Copy)`,
                                criteria: s.criteria,
                              });
                              notify('Search duplicated.');
                              load();
                            } catch (err) {
                              notify(err instanceof ApiError ? err.message : 'Could not duplicate.');
                            }
                          }}
                          className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.investorSearches.remove(s.id);
                              notify('Search deleted.');
                              load();
                            } catch (err) {
                              notify(err instanceof ApiError ? err.message : 'Could not delete.');
                            }
                          }}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </Card>
                  ))}

                  {searches.length === 0 && (
                    <EmptyBlock
                      title="No saved searches yet"
                      description="Create a saved search to get notified automatically when new startups match your thesis."
                      action={
                        <Button onClick={() => setModal('save-search')}>Create saved search</Button>
                      }
                    />
                  )}
                </div>
              )}

              {searchTab === 'Alerts' && (
                <EmptyBlock
                  title="Alerts arrive in a later step"
                  description="Push and email alert delivery for saved searches is wired in a later step of the deal-flow build. Saved searches are stored and match counts are computed here."
                />
              )}

              {searchTab === 'Recommendation settings' && (
                <Card title="Thesis & criteria feed">
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Your stage, sector, ticket size and location preferences feed into our smart match
                    scoring algorithms. Matches are suggestions to review, never advice or guaranteed
                    returns.
                  </p>
                  <Link
                    href="/investor/profile/edit"
                    className="mt-4 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    Edit investment preferences →
                  </Link>
                </Card>
              )}

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

              {/* Modal */}
              {modal === 'save-search' && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                  <section
                    role="dialog"
                    aria-modal="true"
                    className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="serif text-xl font-bold text-ink">New saved search</h2>
                      <button type="button" onClick={() => setModal('')}>
                        <X size={18} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="modal-search-name" className="block text-xs font-medium text-ink">
                          Search name
                        </label>
                        <input
                          id="modal-search-name"
                          required
                          value={newSearchName}
                          onChange={(e) => setNewSearchName(e.target.value)}
                          placeholder="e.g. B2B SaaS Seed"
                          className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="modal-search-stage" className="block text-xs font-medium text-ink">
                            Stage
                          </label>
                          <select
                            id="modal-search-stage"
                            value={newSearchStage}
                            onChange={(e) => setNewSearchStage(e.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                          >
                            <option value="">Any stage</option>
                            {Object.entries(STAGE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="modal-search-sector" className="block text-xs font-medium text-ink">
                            Sector
                          </label>
                          <input
                            id="modal-search-sector"
                            value={newSearchSector}
                            onChange={(e) => setNewSearchSector(e.target.value)}
                            placeholder="e.g. Fintech"
                            className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setModal('')}
                          className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]"
                        >
                          Cancel
                        </button>
                        <Button onClick={createSearch}>Create search</Button>
                      </div>
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
