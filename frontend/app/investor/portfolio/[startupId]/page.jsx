'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { InvestorShell, Card, Button, StatusBadge } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api } from '@/lib/api/client';
import { InvestorDisclaimer } from '../../investor-data';

export default function InvestorPortfolioCompanyPage({ params }) {
  const startupId = params?.startupId;
  const [holding, setHolding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portfolioTab, setPortfolioTab] = useState('Overview');

  const load = useCallback(async () => {
    if (!startupId) {
      setError('No company in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const page = await api.commitments.listHoldings({ limit: 100 });
      const match = page.items.find(
        (h) => h.startup_slug === startupId || h.startup_org_id === startupId,
      );
      setHolding(match || null);
    } catch (err) {
      setError(err?.message || 'Could not load this company view.');
      setHolding(null);
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <InvestorShell
      active="Portfolio"
      module="Deal flow"
      title={holding ? `${holding.startup_name} · Portfolio view` : 'Portfolio view'}
      description="Updates, reports and performance data shared by the founding team."
      backHref="/investor/portfolio"
      backLabel="← Back to Portfolio"
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/investor/portfolio"
            className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
          >
            ← Portfolio
          </Link>
          <Button secondary onClick={() => {}}>
            Request update
          </Button>
          <Link
            href="/investor/messages"
            className="inline-flex min-h-10 items-center rounded-lg bg-ink px-4 text-xs font-semibold text-white hover:bg-[#1C2B42]"
          >
            Message founder
          </Link>
        </div>
      }
    >
      {({ notify }) => (
        <>
          {loading && <LoadingBlock label="Loading company view…" rows={2} />}
          {!loading && error && !holding && <ErrorBlock message={error} onRetry={load} />}

          {!loading && !error && !holding && (
            <EmptyBlock
              title="No holding for this company"
              hint="This company is not in your portfolio yet. Add it from the portfolio overview."
            >
              <Link
                href="/investor/portfolio"
                className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
              >
                Back to portfolio
              </Link>
            </EmptyBlock>
          )}

          {!loading && holding && (
            <>
              <div className="mb-6 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568] border border-[#E5E1D8]">
                Showing data {holding.startup_name} shares with active investors · Last updated{' '}
                {new Date(holding.updated_at).toLocaleDateString()}.
              </div>

              {/* Sub Navigation Tabs */}
              <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  'Overview',
                  'Updates and reports',
                  'Metrics',
                  'Round and cap table',
                  'Documents',
                  'Meetings and notes',
                ].map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setPortfolioTab(x)}
                    className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                      portfolioTab === x
                        ? 'bg-ink text-white'
                        : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>

              <div className="grid items-start gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  {portfolioTab === 'Overview' && (
                    <>
                      <Card title="Investment snapshot">
                        <p className="text-sm leading-relaxed text-ink">
                          {holding.startup_tagline || holding.startup_name}
                        </p>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-xs border-t border-[#E5E1D8] pt-3">
                          <div>
                            <span className="text-[#4A5568]">Invested</span>
                            <b className="mt-0.5 block text-ink">
                              {holding.invested_amount} {holding.currency}
                            </b>
                          </div>
                          <div>
                            <span className="text-[#4A5568]">Instrument</span>
                            <b className="mt-0.5 block text-ink">{holding.instrument}</b>
                          </div>
                          <div>
                            <span className="text-[#4A5568]">Ownership</span>
                            <b className="mt-0.5 block text-ink">
                              {holding.ownership_pct ? `${holding.ownership_pct}%` : '—'}
                            </b>
                          </div>
                        </div>
                      </Card>

                      <Card title="Latest founder update">
                        <EmptyBlock
                          title="Founder updates arrive later"
                          hint="Quarterly founder updates are part of the portfolio updates step (a later step)."
                        />
                      </Card>

                      <Card title="Key performance metrics">
                        <EmptyBlock
                          title="Metrics arrive later"
                          hint="MRR, runway and team metrics are reported by the startup with the portfolio metrics step (a later step)."
                        />
                      </Card>
                    </>
                  )}

                  {portfolioTab === 'Updates and reports' && (
                    <Card title="Quarterly reports archive">
                      <EmptyBlock
                        title="Reports arrive later"
                        hint="Board update packs and reports are managed with the portfolio documents step (a later step)."
                      />
                    </Card>
                  )}

                  {portfolioTab === 'Metrics' && (
                    <Card title="Monthly Recurring Revenue trend">
                      <EmptyBlock
                        title="Metrics trend arrives later"
                        hint="Traction trends are reported by the startup with the portfolio metrics step (a later step)."
                      />
                    </Card>
                  )}

                  {portfolioTab === 'Round and cap table' && (
                    <Card title="Capitalization summary">
                      <p className="text-xs text-ink font-medium">
                        Your holding: {holding.invested_amount} {holding.currency} in{' '}
                        {holding.instrument} · {holding.ownership_pct ? `${holding.ownership_pct}%` : '—'}{' '}
                        estimated ownership
                      </p>
                      <div className="mt-4">
                        <EmptyBlock
                          title="Cap table arrives later"
                          hint="Full cap-table breakdown is computed with the commitments/cap-table step (a later step)."
                        />
                      </div>
                    </Card>
                  )}

                  {portfolioTab === 'Documents' && (
                    <Card title="Executed investment documents">
                      <EmptyBlock
                        title="Documents arrive later"
                        hint="Executed investment documents are managed with the data-room step (a later step)."
                      />
                    </Card>
                  )}

                  {portfolioTab === 'Meetings and notes' && (
                    <Card title="Private notes & check-ins">
                      <EmptyBlock
                        title="Private notes arrive later"
                        hint="Partner notes and check-in memos are tracked with the meetings/notes step (a later step)."
                      />
                    </Card>
                  )}
                </div>

                {/* Sidebar quick facts */}
                <aside className="space-y-6">
                  <Card title="Investment snapshot">
                    <dl className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Status</dt>
                        <dd>
                          <StatusBadge status={holding.status} />
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Invested</dt>
                        <dd className="font-semibold text-ink">
                          {holding.invested_amount} {holding.currency}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Ownership</dt>
                        <dd className="font-semibold text-ink">
                          {holding.ownership_pct ? `${holding.ownership_pct}%` : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Instrument</dt>
                        <dd className="font-semibold text-ink">{holding.instrument}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Invested on</dt>
                        <dd className="font-semibold text-ink">
                          {holding.invested_on
                            ? new Date(holding.invested_on).toLocaleDateString()
                            : '—'}
                        </dd>
                      </div>
                      {holding.exit_value && (
                        <div className="flex justify-between">
                          <dt className="text-[#4A5568]">Exit value</dt>
                          <dd className="font-semibold text-ink">{holding.exit_value}</dd>
                        </div>
                      )}
                    </dl>
                  </Card>

                  <Card title="Upcoming events">
                    <EmptyBlock
                      title="No scheduled events"
                      hint="Upcoming update and pro-rata windows are tracked with the portfolio updates step (a later step)."
                    />
                  </Card>
                </aside>
              </div>

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />
            </>
          )}
        </>
      )}
    </InvestorShell>
  );
}
