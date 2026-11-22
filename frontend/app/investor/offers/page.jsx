'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { InvestorShell, Card, StatusBadge } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api } from '@/lib/api/client';
import { InvestorDisclaimer } from '../investor-data';

// Tab -> offer statuses it shows (the API lists by status; we filter the
// loaded list client-side so multi-status tabs stay a single request).
const TAB_STATUSES = {
  Drafts: ['draft'],
  'Awaiting approval': ['sent'],
  Sent: ['sent'],
  Countered: ['countered'],
  Accepted: ['accepted'],
  'Closed and declined': ['declined', 'expired', 'withdrawn'],
};

const OPEN_STATUSES = ['draft', 'sent', 'countered'];

export default function InvestorOffersPage() {
  const [tab, setTab] = useState('All');
  const [view, setView] = useState('Cards');
  const [offersList, setOffersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await api.offers.list({ limit: 100 });
      setOffersList(page.items);
    } catch (err) {
      setError(err?.message || 'Could not load your offers.');
      setOffersList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredOffers = useMemo(() => {
    if (tab === 'All') return offersList;
    const statuses = TAB_STATUSES[tab] || [];
    return offersList.filter((o) => statuses.includes(o.status));
  }, [offersList, tab]);

  const stats = useMemo(() => {
    const open = offersList.filter((o) => OPEN_STATUSES.includes(o.status));
    const awaiting = offersList.filter((o) => o.status === 'sent');
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    const expiring = offersList.filter((o) => {
      if (!OPEN_STATUSES.includes(o.status) || !o.expires_on) return false;
      const t = new Date(o.expires_on).getTime();
      return t >= now && t <= week;
    });
    const accepted = offersList.filter((o) => o.status === 'accepted');
    // Sum the open offered amounts (API amount is a numeric string).
    const total = open.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
    return {
      open: open.length,
      awaiting: awaiting.length,
      expiring: expiring.length,
      accepted: accepted.length,
      total,
    };
  }, [offersList]);

  const fmtMoney = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <InvestorShell
      active="Offers"
      module="Deal flow"
      title="Offers and term sheets"
      description="Track offers and term sheet versions across your active deals."
      actions={
        <Link
          href="/investor/offers/new"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-xs font-semibold text-white hover:bg-[#1C2B42]"
        >
          <Plus size={14} /> New offer
        </Link>
      }
    >
      {({ notify }) => (
        <>
          {/* Stat Strip */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Open offers', stats.open],
              ['Awaiting response', stats.awaiting],
              ['Total offered (open)', fmtMoney(stats.total)],
              ['Expiring in 7 days', stats.expiring],
              ['Accepted · documents', stats.accepted],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                <span className="text-xs font-medium text-[#4A5568]">{label}</span>
                <span className="serif mt-1 block text-2xl font-semibold text-ink">{val}</span>
              </div>
            ))}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                'All',
                'Drafts',
                'Awaiting approval',
                'Sent',
                'Countered',
                'Accepted',
                'Closed and declined',
              ].map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setTab(x)}
                  className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                    tab === x
                      ? 'bg-ink text-white'
                      : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>

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

          {loading && <LoadingBlock label="Loading offers…" />}
          {!loading && error && <ErrorBlock message={error} onRetry={load} />}

          {!loading && !error && filteredOffers.length === 0 && (
            <EmptyBlock
              title="No offers here yet"
              hint={
                tab === 'All'
                  ? 'Create an offer for a round to start tracking term sheets.'
                  : `No offers with this status. Try another tab.`
              }
            >
              {tab === 'All' && (
                <Link
                  href="/investor/offers/new"
                  className="inline-flex min-h-9 items-center rounded-lg bg-ink px-3 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                >
                  <Plus size={13} /> New offer
                </Link>
              )}
            </EmptyBlock>
          )}

          {!loading && !error && filteredOffers.length > 0 && (
            <>
              {view === 'Cards' ? (
                <div className="space-y-4">
                  {filteredOffers.map((o) => (
                    <Card
                      key={o.id}
                      title={
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F3EBDD] font-bold text-ink text-xs">
                            {o.startup_logo_initials || '?'}
                          </span>
                          <div>
                            <span className="font-bold text-ink">{o.startup_name}</span>
                            <span className="ml-2 text-xs font-normal text-[#4A5568]">
                              {o.round_target ? `${o.round_target} ${o.round_currency || ''}` : 'Round'}
                            </span>
                          </div>
                        </div>
                      }
                      action={<StatusBadge status={o.status} />}
                    >
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs border-y border-[#E5E1D8] py-3.5 my-2">
                        <div>
                          <span className="text-[#4A5568]">Offered amount</span>
                          <b className="mt-1 block font-semibold text-ink">
                            {o.amount} · {o.instrument}
                          </b>
                        </div>
                        <div>
                          <span className="text-[#4A5568]">Valuation / Cap</span>
                          <b className="mt-1 block font-semibold text-ink">
                            {o.valuation_cap || '—'}
                          </b>
                        </div>
                        <div>
                          <span className="text-[#4A5568]">Active version</span>
                          <b className="mt-1 block font-semibold text-ink">
                            v{o.version} · {new Date(o.created_at).toLocaleDateString()}
                          </b>
                        </div>
                        <div>
                          <span className="text-[#4A5568]">Expiration</span>
                          <b className="mt-1 block font-semibold text-ink">
                            {o.expires_on ? new Date(o.expires_on).toLocaleDateString() : '—'}
                          </b>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-[#4A5568]">
                          Deal Lead: {o.owner_name || '—'}
                        </span>
                        <Link
                          href={`/investor/offers/${o.id}`}
                          className="inline-flex min-h-9 items-center rounded-lg bg-ink px-4 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                        >
                          Open offer workspace →
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E1D8] bg-[#FAF8F4] text-[#4A5568]">
                        {['Startup', 'Round', 'Offer & Instrument', 'Cap / Valuation', 'Version', 'Status', 'Expires', 'Owner', 'Actions'].map((x) => (
                          <th key={x} className="p-3 font-semibold">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8]">
                      {filteredOffers.map((o) => (
                        <tr key={o.id} className="hover:bg-[#FAF8F4]/50">
                          <td className="p-3 font-semibold text-ink">{o.startup_name}</td>
                          <td className="p-3">
                            {o.round_target ? `${o.round_target} ${o.round_currency || ''}` : '—'}
                          </td>
                          <td className="p-3 font-semibold text-ink">
                            {o.amount} · {o.instrument}
                          </td>
                          <td className="p-3">{o.valuation_cap || '—'}</td>
                          <td className="p-3">v{o.version}</td>
                          <td className="p-3">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="p-3">
                            {o.expires_on ? new Date(o.expires_on).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-3">{o.owner_name || '—'}</td>
                          <td className="p-3">
                            <Link
                              href={`/investor/offers/${o.id}`}
                              className="font-semibold text-[#9A7A45] hover:underline"
                            >
                              Open →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />
        </>
      )}
    </InvestorShell>
  );
}
