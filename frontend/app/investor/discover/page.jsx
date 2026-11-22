'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';
import {
  LoadingBlock,
  EmptyBlock,
  ErrorBlock,
} from '@/components/async-state';
import {
  InvestorBadge,
  InvestorDisclaimer,
} from '../investor-data';

function formatMoney(value, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  const sym = currency === 'INR' ? '₹' : currency + ' ';
  if (num >= 1e7) return sym + (num / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  if (num >= 1e5) return sym + (num / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
  return sym + num.toLocaleString('en-IN');
}

const STAGE_LABELS = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature',
};

function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage;
}

function commitPct(target, committed) {
  if (target == null || target === 0 || committed == null) return '—';
  return Math.round((Number(committed) / Number(target)) * 100) + '%';
}

export default function InvestorDiscoverPage() {
  const { user } = useAuth();
  const [filterStage, setFilterStage] = useState('');
  const [sector, setSector] = useState('');
  const [city, setCity] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('Cards');
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState('');
  const [searchName, setSearchName] = useState('');
  const [shortlistedIds, setShortlistedIds] = useState(new Set());

  // Real 9c data: list, facets and loading/empty/error state.
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState({ stages: [], sectors: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('loading');
      setError('');
      try {
        const [page, filters] = await Promise.all([
          api.investorDiscovery.list({
            stage: filterStage || undefined,
            sector: sector || undefined,
            city: city || undefined,
            q: query || undefined,
            investment_ready_only: readyOnly || undefined,
            limit: 50,
          }),
          api.investorDiscovery.filters(),
        ]);
        if (cancelled) return;
        setItems(page.items);
        setTotal(page.total);
        setFacets(filters);
        setPhase('ready');
        // Reflect the current shortlist membership for the saved badges.
        try {
          const shortlist = await api.investorShortlist.list();
          if (cancelled) return;
          setShortlistedIds(new Set(shortlist.map((e) => e.startup_org_id)));
        } catch {
          // Shortlist is best-effort; the badges simply stay unset.
        }
      } catch (err) {
        if (cancelled) return;
        setPhase('error');
        setError(err instanceof ApiError ? err.message : 'Could not load startups.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterStage, sector, city, readyOnly, query, user?.id]);

  // The server applies the stage/sector/keyword/ready filters; the list
  // returned is already the filtered, visible set.
  const available = items;

  return (
    <InvestorShell
      active="Discover startups"
      module="Deal flow"
      title="Discover startups"
      description="Browse founders who chose to share their profiles with verified investors."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button secondary onClick={() => setModal('save-search')}>
            <Plus size={14} /> Save this search
          </Button>
          <div className="flex items-center rounded-lg border border-[#E5E1D8] bg-white p-1">
            <button
              type="button"
              onClick={() => setView('Cards')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                view === 'Cards' ? 'bg-ink text-white' : 'text-[#4A5568] hover:text-ink'
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setView('Table')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                view === 'Table' ? 'bg-ink text-white' : 'text-[#4A5568] hover:text-ink'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      }
    >
      {({ notify }) => {
        const toggleSave = async (startup) => {
          const id = startup.slug;
          try {
            if (shortlistedIds.has(id)) {
              const entries = await api.investorShortlist.list();
              const target = entries.find((e) => e.startup_slug === id);
              if (target) {
                await api.investorShortlist.remove(target.id);
                setShortlistedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
                notify('Removed from shortlist.');
                return;
              }
            }
            await api.investorShortlist.add({ startup_org_id: startup.org_id });
            setShortlistedIds((prev) => new Set(prev).add(id));
            notify('Saved to shortlist.');
          } catch (err) {
            notify(err instanceof ApiError ? err.message : 'Could not update the shortlist.');
          }
        };

        const startupCard = (s) => (
          <article
            key={s.slug}
            className="rounded-xl border border-[#E5E1D8] bg-white p-5 transition hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] text-lg font-semibold text-ink">
                {(s.name || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/investor/startups/${s.slug}`}
                    className="text-sm font-semibold text-ink hover:underline"
                  >
                    {s.name}
                  </Link>
                  {s.mentor_verified && <InvestorBadge>Verified startup</InvestorBadge>}
                  {s.investment_ready && <InvestorBadge gold>Investment Ready</InvestorBadge>}
                </div>
                <p className="mt-1 text-xs text-[#4A5568]">{s.tagline}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
                    {stageLabel(s.stage)}
                  </span>
                  {s.sector && (
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
                      {s.sector}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Actions for ${s.name}`}
                onClick={() => setDrawer(s)}
                className="text-[#4A5568] hover:text-ink"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <span className="block text-xs text-[#4A5568]">Location</span>
                <b className="font-semibold">{s.city || 'Not shared'}</b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">Readiness</span>
                <b className="font-semibold text-ink">
                  {s.readiness_score != null ? `${s.readiness_score}/100` : 'Not shared'}
                  {s.investment_ready && <span className="text-[#9A7A45]"> ✓</span>}
                </b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">Traction</span>
                <b className="font-semibold">{s.traction_summary || 'Not shared'}</b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">Round</span>
                <b className="font-semibold">
                  {s.round_visible
                    ? `${formatMoney(s.round_target, s.round_currency)} · ${commitPct(s.round_target, s.round_committed)} committed`
                    : 'Round not shared'}
                </b>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-[#FAF8F4] p-2.5 text-xs">
              <b className="text-[#806236]">Profile</b> · {s.traction_summary || 'Details shared by the founder.'}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
              <span className="text-xs text-[#4A5568]">
                {s.investment_ready ? 'Mentor-verified readiness' : 'Profile shared'}
                {s.updated_at ? ` · Updated ${new Date(s.updated_at).toLocaleDateString()}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/investor/startups/${s.slug}`}
                  className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                >
                  View profile
                </Link>
                <button
                  type="button"
                  onClick={() => toggleSave(s)}
                  className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
                >
                  {shortlistedIds.has(s.slug) ? 'Saved' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawer(s)}
                  className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                >
                  Quick preview
                </button>
              </div>
            </div>
          </article>
        );

        return (
          <>
            <div className="grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
              {/* Filters Sidebar */}
              <aside className="space-y-4">
                <Card title="Search & Filters">
                  <form
                    onSubmit={(e) => e.preventDefault()}
                    className="space-y-4"
                  >
                    <div>
                      <label htmlFor="filter-search" className="block text-xs font-medium text-ink">
                        Keywords
                      </label>
                      <input
                        id="filter-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, sector, location"
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="filter-stage" className="block text-xs font-medium text-ink">
                        Stage
                      </label>
                      <select
                        id="filter-stage"
                        value={filterStage}
                        onChange={(e) => setFilterStage(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                      >
                        <option value="">All stages</option>
                        {facets.stages.map((x) => (
                          <option key={x} value={x}>{stageLabel(x)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="filter-sector" className="block text-xs font-medium text-ink">
                        Sector
                      </label>
                      <select
                        id="filter-sector"
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                      >
                        <option value="">All sectors</option>
                        {facets.sectors.map((x) => (
                          <option key={x} value={x}>{x}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="filter-loc" className="block text-xs font-medium text-ink">
                        Location
                      </label>
                      <input
                        id="filter-loc"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City or region"
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                      />
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={readyOnly}
                          onChange={(e) => setReadyOnly(e.target.checked)}
                          className="h-4 w-4 rounded accent-ink"
                        />
                        <span>Investment Ready only</span>
                      </label>
                    </div>

                    <div className="pt-2 border-t border-[#E5E1D8] flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterStage('');
                          setSector('');
                          setCity('');
                          setReadyOnly(false);
                          setQuery('');
                          notify('Filters reset.');
                        }}
                        className="text-xs font-medium text-[#4A5568] hover:text-ink"
                      >
                        Reset filters
                      </button>
                    </div>
                  </form>
                </Card>

                <Card title="Saved Searches">
                  <p className="text-xs text-[#4A5568]">
                    Save your active criteria to receive automated daily notifications when matching startups opt in.
                  </p>
                  <Link
                    href="/investor/searches"
                    className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    Manage saved searches →
                  </Link>
                </Card>
              </aside>

              {/* Main Results Column */}
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">
                    {total} opted-in startup{total === 1 ? '' : 's'}
                  </span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="view-toggle" className="sr-only">
                      Toggle view
                    </label>
                    <div className="flex items-center rounded-lg border border-[#E5E1D8] bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setView('Cards')}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                          view === 'Cards' ? 'bg-ink text-white' : 'text-[#4A5568] hover:text-ink'
                        }`}
                      >
                        Cards
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('Table')}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                          view === 'Table' ? 'bg-ink text-white' : 'text-[#4A5568] hover:text-ink'
                        }`}
                      >
                        Table
                      </button>
                    </div>
                  </div>
                </div>

                {phase === 'loading' && <LoadingBlock label="Loading startups…" />}

                {phase === 'error' && <ErrorBlock message={error} />}

                {phase === 'ready' && available.length === 0 && (
                  <EmptyBlock
                    title="No matching startups"
                    description="No opted-in startups match the current filters. Try widening the stage or sector, or clear the search."
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setFilterStage('');
                          setSector('');
                          setCity('');
                          setReadyOnly(false);
                          setQuery('');
                        }}
                        className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                      >
                        Clear filters
                      </button>
                    }
                  />
                )}

                {phase === 'ready' && available.length > 0 && view === 'Cards' && (
                  <div className="space-y-4">
                    {available.filter((s) => s.investment_ready).length > 0 && (
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#806236]">
                          Investment Ready ({available.filter((s) => s.investment_ready).length})
                        </p>
                        <div className="space-y-4">
                          {available
                            .filter((s) => s.investment_ready)
                            .map((s) => startupCard(s))}
                        </div>
                      </div>
                    )}

                    {available.filter((s) => !s.investment_ready).length > 0 && (
                      <div className="pt-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#4A5568]">
                          Other opted-in startups
                          ({available.filter((s) => !s.investment_ready).length})
                        </p>
                        <div className="space-y-4">
                          {available
                            .filter((s) => !s.investment_ready)
                            .map((s) => startupCard(s))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {phase === 'ready' && available.length > 0 && view === 'Table' && (
                  <div className="overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white">
                    <table className="w-full min-w-[800px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E5E1D8] bg-[#FAF8F4] text-[#4A5568]">
                          {[
                            'Startup',
                            'Stage',
                            'Sector',
                            'Readiness',
                            'Traction',
                            'Raise',
                            'Committed',
                            'Location',
                            'Actions',
                          ].map((x) => (
                            <th key={x} className="p-3 font-semibold">
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1D8]">
                        {available.map((s) => (
                          <tr key={s.slug} className="hover:bg-[#FAF8F4]/50">
                            <td className="p-3 font-semibold">
                              <Link
                                href={`/investor/startups/${s.slug}`}
                                className="text-ink hover:underline"
                              >
                                {s.name}
                              </Link>
                            </td>
                            <td className="p-3">{stageLabel(s.stage)}</td>
                            <td className="p-3">{s.sector || '—'}</td>
                            <td className="p-3 font-medium text-ink">
                              {s.readiness_score != null ? `${s.readiness_score}/100` : '—'}
                            </td>
                            <td className="p-3">{s.traction_summary || '—'}</td>
                            <td className="p-3">
                              {s.round_visible ? formatMoney(s.round_target, s.round_currency) : '—'}
                            </td>
                            <td className="p-3">
                              {s.round_visible
                                ? commitPct(s.round_target, s.round_committed)
                                : '—'}
                            </td>
                            <td className="p-3">{s.city || '—'}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/investor/startups/${s.slug}`}
                                  className="text-xs font-semibold text-[#9A7A45] hover:underline"
                                >
                                  View
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => toggleSave(s)}
                                  className="text-xs text-[#4A5568] hover:text-ink"
                                >
                                  {shortlistedIds.has(s.slug) ? 'Saved' : 'Save'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

            {/* Quick Drawer */}
            {drawer && (
              <div
                className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
                onClick={() => setDrawer(null)}
              >
                <aside
                  className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto bg-[#FAF8F4] p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#806236]">
                      Quick preview
                    </span>
                    <button
                      type="button"
                      onClick={() => setDrawer(null)}
                      className="rounded p-1 hover:bg-black/5"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <h2 className="serif mt-4 text-2xl font-bold text-ink">{drawer.name}</h2>
                  <p className="mt-1 text-sm text-[#4A5568]">{drawer.tagline}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {drawer.investment_ready && (
                      <InvestorBadge gold>Investment Ready</InvestorBadge>
                    )}
                    {drawer.mentor_verified && <InvestorBadge>Verified startup</InvestorBadge>}
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                      {stageLabel(drawer.stage)}
                    </span>
                    {drawer.sector && (
                      <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                        {drawer.sector}
                      </span>
                    )}
                  </div>

                  <p className="mt-5 text-xs leading-relaxed text-ink">
                    {drawer.traction_summary || 'This startup has opted in to investor discovery.'}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                      <span className="block text-xs text-[#4A5568]">Location</span>
                      <b className="block text-sm font-semibold text-ink">{drawer.city || 'Not shared'}</b>
                    </div>
                    <div className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                      <span className="block text-xs text-[#4A5568]">Readiness</span>
                      <b className="block text-sm font-semibold text-ink">
                        {drawer.readiness_score != null ? `${drawer.readiness_score}/100` : 'Not shared'}
                      </b>
                    </div>
                    <div className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                      <span className="block text-xs text-[#4A5568]">Round target</span>
                      <b className="block text-sm font-semibold text-ink">
                        {drawer.round_visible
                          ? formatMoney(drawer.round_target, drawer.round_currency)
                          : 'Not shared'}
                      </b>
                    </div>
                    <div className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                      <span className="block text-xs text-[#4A5568]">Committed</span>
                      <b className="block text-sm font-semibold text-ink">
                        {drawer.round_visible
                          ? commitPct(drawer.round_target, drawer.round_committed)
                          : '—'}
                      </b>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-white p-3 text-xs border border-[#E5E1D8]">
                    <b className="text-[#806236]">Traction:</b>{' '}
                    {drawer.traction_summary || 'Not shared by the founder.'}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/investor/startups/${drawer.slug}`}
                      className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      View full profile →
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleSave(drawer)}
                      className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      {shortlistedIds.has(drawer.slug) ? 'Saved' : 'Save'}
                    </button>
                    <Link
                      href={`/investor/startups/${drawer.slug}`}
                      className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                    >
                      Request intro →
                    </Link>
                  </div>
                </aside>
              </div>
            )}

            {/* Save Search Modal */}
            {modal === 'save-search' && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                <section
                  role="dialog"
                  aria-modal="true"
                  className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="serif text-xl font-bold text-ink">Save this search & alerts</h2>
                    <button type="button" onClick={() => setModal('')}>
                      <X size={18} />
                    </button>
                  </div>
                  <label htmlFor="search-name" className="block text-xs font-medium text-ink">
                    Search name
                  </label>
                  <input
                    id="search-name"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                  />
                  <p className="mt-3 text-xs text-[#4A5568]">
                    Active criteria: <b>{filterStage || 'Any stage'}</b> ·{' '}
                    <b>{sector || 'Any sector'}</b> · Investment Ready{' '}
                    <b>{readyOnly ? 'only' : 'included'}</b>
                  </p>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModal('')}
                      className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]"
                    >
                      Cancel
                    </button>
                    <Button
                      onClick={async () => {
                        if (!searchName.trim()) {
                          notify('Give the search a name first.');
                          return;
                        }
                        try {
                          await api.investorSearches.create({
                            name: searchName.trim(),
                            criteria: {
                              stage: filterStage || undefined,
                              sector: sector || undefined,
                              city: city || undefined,
                              q: query || undefined,
                              investment_ready_only: readyOnly,
                            },
                          });
                          notify(`Saved search "${searchName.trim()}" created.`);
                          setSearchName('');
                          setModal('');
                        } catch (err) {
                          notify(
                            err instanceof ApiError ? err.message : 'Could not save the search.'
                          );
                        }
                      }}
                    >
                      Save search
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </>
        );
      }}
    </InvestorShell>
  );
}
