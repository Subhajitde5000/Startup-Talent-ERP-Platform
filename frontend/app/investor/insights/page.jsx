'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api } from '@/lib/api/client';
import { InvestorDisclaimer } from '../investor-data';

export default function InvestorInsightsPage() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insightTab, setInsightTab] = useState('Overview');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInsights(await api.workspace.insights());
    } catch (err) {
      setError(err?.message || 'Could not load platform insights.');
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lastMonth = (list) => (list && list.length ? list[list.length - 1].count : 0);

  const stageTotal = insights?.startups_by_stage_total ?? 0;
  const maxStage = stageTotal || 1;

  return (
    <InvestorShell
      active="Insights"
      module="Deal flow"
      title="Venture ecosystem insights"
      description="Aggregated, anonymized benchmark intelligence across opted-in platform startups."
      actions={
        <div className="flex items-center gap-2">
          <Button secondary onClick={() => {}}>
            <Download size={14} /> Export report
          </Button>
        </div>
      }
    >
      {({ notify }) => (
        <>
          <p className="mb-6 text-xs text-[#4A5568]">
            Aggregated platform data · Descriptive benchmarks only, never investment forecasts. Minimum
            cohort threshold n &ge; {insights?.cohort_threshold ?? '—'}.
          </p>

          {loading && <LoadingBlock label="Loading insights…" />}
          {!loading && error && !insights && <ErrorBlock message={error} onRetry={load} />}

          {!loading && insights && (
            <>
              {/* Sub Navigation Tabs */}
              <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  'Overview',
                  'Deal flow',
                  'Sectors',
                  'Rounds and valuations',
                  'Readiness and mentoring',
                  'My activity vs platform',
                ].map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setInsightTab(x)}
                    className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                      insightTab === x
                        ? 'bg-ink text-white'
                        : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>

              {insightTab === 'Overview' && (
                <>
                  {/* Stat Strip */}
                  <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      ['Opted-in startups', stageTotal],
                      ['New profiles · latest month', lastMonth(insights.monthly_new_profiles)],
                      ['Round launches · latest month', lastMonth(insights.monthly_round_launches)],
                      ['Cohort threshold (n)', insights.cohort_threshold],
                    ].map(([x, y]) => (
                      <div key={x} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                        <span className="text-xs font-medium text-[#4A5568]">{x}</span>
                        <span className="serif mt-1 block text-3xl font-semibold text-ink">{y}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card title="Startups by development stage">
                      {Object.keys(insights.startups_by_stage).length === 0 ? (
                        <EmptyBlock title="No stage distribution yet" hint="Stage counts appear as startups opt in." />
                      ) : (
                        <div className="space-y-3.5">
                          {Object.entries(insights.startups_by_stage).map(([stage, count]) => (
                            <div key={stage} className="flex items-center gap-3 text-xs">
                              <span className="w-28 font-medium text-ink">{stage}</span>
                              <div
                                className="h-6 rounded-md bg-ink flex items-center justify-end pr-2 text-white font-bold"
                                style={{ width: `${(count / maxStage) * 100}%` }}
                              >
                                {count}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="mt-4 text-xs text-[#4A5568]">
                        Platform data · Minimum cohort threshold n &ge; {insights.cohort_threshold}
                      </p>
                    </Card>

                    <Card title="Monthly ecosystem trends">
                      <ul className="space-y-3 text-xs text-ink leading-relaxed">
                        <li className="flex items-start gap-2">
                          <span className="text-[#806236] font-bold">•</span>
                          <span>
                            <b>{lastMonth(insights.monthly_new_profiles)} new profiles</b> published by founders this
                            month across the platform.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#806236] font-bold">•</span>
                          <span>
                            <b>{lastMonth(insights.monthly_round_launches)} round launches</b> recorded this month.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#806236] font-bold">•</span>
                          <span>
                            Descriptive benchmarks only — no forecasts or predictions are made.
                          </span>
                        </li>
                      </ul>
                    </Card>
                  </div>
                </>
              )}

              {insightTab === 'My activity vs platform' && (
                <Card title="Your funnel vs platform averages (Private to you)">
                  {insights.your_funnel ? (
                    <div className="space-y-4 text-xs">
                      <p className="text-ink">
                        Your engagement: <b>{insights.your_funnel.profiles_reviewed} profiles reviewed</b> ·{' '}
                        <b>{insights.your_funnel.shortlisted} shortlisted</b> ·{' '}
                        <b>{insights.your_funnel.intro_requests} intro requests</b> ·{' '}
                        <b>{insights.your_funnel.data_rooms_opened} data rooms</b> ·{' '}
                        <b>{insights.your_funnel.offers_extended} offers extended</b>
                      </p>
                      <div className="rounded-lg bg-[#FAF8F4] p-4 border border-[#E5E1D8]">
                        <b className="text-ink">Descriptive, not predictive:</b>
                        <p className="mt-1 text-[#4A5568]">
                          These are counts of your activity on the platform, not forecasts or benchmarks against
                          other investors.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <EmptyBlock title="No private funnel data" hint="Your activity counts will appear here." />
                  )}
                </Card>
              )}

              {insightTab !== 'Overview' && insightTab !== 'My activity vs platform' && (
                <Card title={insightTab}>
                  <EmptyBlock
                    title={`${insightTab} breakdowns arrive later`}
                    hint="Sector, deal-flow and round-level benchmark distributions are part of the analytics module (a later step)."
                  />
                </Card>
              )}

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />
            </>
          )}
        </>
      )}
    </InvestorShell>
  );
}
