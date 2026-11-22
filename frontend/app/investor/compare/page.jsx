'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { InvestorShell } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { InvestorDisclaimer } from '../investor-data';

const PIPELINE_STAGE_LABELS = {
  interested: 'Interested',
  intro: 'Intro',
  meeting: 'Meeting',
  data_room: 'Data room',
  diligence: 'Diligence',
  offer: 'Offer',
  committed: 'Committed',
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

export default function InvestorComparePage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [deals, setDeals] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('loading');
      setError('');
      try {
        const page = await api.investorDeals.list({ limit: 50 });
        if (cancelled) return;
        setDeals(page.items);
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setPhase('error');
        setError(err instanceof ApiError ? err.message : 'Could not load deals to compare.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const comparison = deals.slice(0, 3);

  const row = (label, value) => [label, ...value];

  const rows = comparison.length
    ? [
        row('Sector', comparison.map((d) => d.startup_sector || '—')),
        row(
          'Readiness',
          comparison.map((d) =>
            d.startup_readiness_score != null
              ? `${d.startup_readiness_score}/100`
              : 'Not shared'
          )
        ),
        row(
          'Raise target',
          comparison.map((d) =>
            d.round_target != null ? formatMoney(d.round_target, d.round_currency) : '—'
          )
        ),
        row(
          'Ticket size',
          comparison.map((d) =>
            d.ticket_size != null ? formatMoney(d.ticket_size, d.currency) : '—'
          )
        ),
        row('Pipeline stage', comparison.map((d) => stageLabel(d.stage))),
        row(
          'Probability',
          comparison.map((d) =>
            d.probability != null ? `${d.probability}%` : '—'
          )
        ),
        row(
          'Last activity',
          comparison.map((d) =>
            d.last_activity_at ? new Date(d.last_activity_at).toLocaleDateString() : '—'
          )
        ),
      ]
    : [];

  return (
    <InvestorShell
      active="Pipeline"
      module="Deal flow"
      title="Compare startups"
      description="Review shared facts and readiness metrics side-by-side using the same objective criteria."
    >
      {({ notify }) => (
        <>
          <div className="mb-6 rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236] border border-[#E7D4B0]">
            These startups are at different stages and operate in different sectors. Metric
            comparability is subject to data disclosed by founders.
          </div>

          {phase === 'loading' && <LoadingBlock label="Loading deals to compare…" />}

          {phase === 'error' && <ErrorBlock message={error} />}

          {phase === 'ready' && deals.length === 0 && (
            <EmptyBlock
              title="Nothing to compare yet"
              description="Add startups to your pipeline from Discover, then compare the ones you're actively evaluating here."
              action={
                <Link
                  href="/investor/discover"
                  className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                >
                  Go to Discover
                </Link>
              }
            />
          )}

          {phase === 'ready' && deals.length > 0 && comparison.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead>
                    <tr className="sticky top-0 bg-[#F3EBDD] text-ink">
                      <th className="p-3 font-semibold text-xs">Criteria</th>
                      {comparison.map((d) => (
                        <th key={d.id} className="p-3 font-semibold text-xs">
                          <Link
                            href={`/investor/startups/${d.startup_slug}`}
                            className="text-sm font-bold text-ink hover:underline"
                          >
                            {d.startup_logo_initials || '·'} {d.startup_name}
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D8]">
                    {rows.map((r) => (
                      <tr key={r[0]} className="hover:bg-[#FAF8F4]/50">
                        <th className="p-3 font-medium text-[#4A5568]">{r[0]}</th>
                        {r.slice(1).map((val, i) => (
                          <td key={i} className="p-3 text-ink">
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-[#4A5568]">
                Data shown only where startups explicitly opted in to share it with verified
                investors. Compares the {comparison.length} deals with the most recent activity in
                your pipeline.
              </p>
            </>
          )}

          <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />
        </>
      )}
    </InvestorShell>
  );
}
