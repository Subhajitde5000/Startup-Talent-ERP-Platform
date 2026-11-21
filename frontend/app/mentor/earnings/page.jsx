'use client';

import { useEffect, useMemo, useState } from 'react';
import MentorPageShell from '../mentor-page-shell';
import { Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/async-state';

const tabs = ['Overview', 'Payments', 'Payouts', 'Invoices and tax', 'Payout settings'];

const money = (value, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function downloadCsv(rows) {
  // Prefix spreadsheet formula characters to prevent CSV formula injection.
  const cell = (value) => {
    let s = String(value ?? '');
    if (/^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const data = [
    ['Date', 'Startup', 'Session', 'Gross', 'Commission', 'TDS', 'Net', 'Currency', 'Status'],
    ...rows.map((r) => [
      r.earned_on,
      r.startup_name,
      r.session_topic,
      r.gross_amount,
      r.commission_amount,
      r.tds_amount,
      r.net_amount,
      r.currency,
      r.status,
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob([data.map((r) => r.map(cell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'earnings.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function MentorEarningsPage() {
  const [tab, setTab] = useState('Overview');
  const [state, setState] = useState({
    phase: 'loading',
    rows: [],
    summary: null,
    error: '',
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState((s) => ({ ...s, phase: 'loading' }));
      try {
        const summary = await api.earnings.summary(controller.signal);
        const rows = [];
        let offset = 0;
        for (;;) {
          // Backend enforces limit <= 50
          const page = await api.earnings.list({ limit: 50, offset }, controller.signal);
          rows.push(...page.items);
          offset += page.items.length;
          if (!page.items.length || offset >= page.total) break;
        }
        if (!controller.signal.aborted) {
          setState({ phase: 'ready', rows, summary, error: '' });
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setState((s) => ({
            ...s,
            phase: 'error',
            error: e instanceof ApiError ? e.message : 'Could not load earnings.',
          }));
        }
      }
    }
    load();
    return () => controller.abort();
  }, [revision]);

  const months = useMemo(() => {
    const grouped = new Map();
    for (const r of state.rows) {
      const earnedDate = r.earned_on ? String(r.earned_on) : '';
      const key = `${earnedDate.slice(0, 7) || 'Current'} · ${r.currency || 'INR'}`;
      grouped.set(key, (grouped.get(key) || 0) + Number(r.net_amount || 0));
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [state.rows]);

  const summary = state.summary;

  return (
    <MentorPageShell active="Earnings">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="serif text-3xl font-semibold text-[#0F1B2D]">Earnings</h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            Your completed paid sessions and earnings.
          </p>
        </div>
        {state.phase === 'ready' && state.rows.length > 0 && (
          <button
            type="button"
            className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-sm font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
            onClick={() => downloadCsv(state.rows)}
          >
            Export CSV
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
              t === tab
                ? 'bg-[#0F1B2D] text-white'
                : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {['Payouts', 'Invoices and tax', 'Payout settings'].includes(tab) ? (
        <EmptyBlock
          title={`${tab} not available yet`}
          hint="This feature will be available when payout management is implemented."
        />
      ) : (
        <>
          {state.phase === 'loading' && <LoadingBlock label="Loading earnings…" />}
          {state.phase === 'error' && (
            <ErrorBlock message={state.error} onRetry={() => setRevision((x) => x + 1)} />
          )}
          {state.phase === 'ready' && summary && (
            <>
              {tab === 'Overview' && (
                <>
                  <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      ['Pending', money(summary.pending_amount, summary.currency)],
                      ['Paid', money(summary.paid_amount, summary.currency)],
                      ['Lifetime', money(summary.lifetime_amount, summary.currency)],
                      ['Sessions', summary.session_count],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-[#E5E1D8] bg-white p-4 shadow-sm"
                      >
                        <p className="text-xs font-medium text-[#4A5568]">{label}</p>
                        <p className="serif mt-2 text-2xl font-semibold text-[#0F1B2D]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Card title="Net earnings by month">
                    {months.length === 0 ? (
                      <p className="py-5 text-sm text-[#4A5568]">No earnings to chart yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {months.map(([month, amount]) => {
                          const maxAmount = Math.max(
                            ...months.map(([, v]) => Math.abs(v)),
                            1,
                          );
                          const pct = Math.max(
                            0,
                            Math.min(100, (Math.abs(amount) / maxAmount) * 100),
                          );
                          return (
                            <div key={month} className="flex items-center gap-3 text-sm">
                              <span className="w-32 text-xs font-medium text-[#4A5568]">{month}</span>
                              <div className="h-3 flex-1 rounded bg-[#EEE9DF]">
                                <div
                                  className="h-3 rounded bg-[#B8955A]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-semibold text-[#0F1B2D]">
                                {money(amount, month.slice(-3))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </>
              )}

              {tab === 'Payments' &&
                (state.rows.length === 0 ? (
                  <EmptyBlock
                    title="No earnings yet"
                    hint="Completed paid sessions will appear here."
                  />
                ) : (
                  <Card title="Earnings ledger">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E1D8] text-xs font-semibold text-[#4A5568]">
                            {[
                              'Date',
                              'Startup',
                              'Session',
                              'Gross',
                              'Commission',
                              'TDS',
                              'Net',
                              'Status',
                            ].map((x) => (
                              <th key={x} className="py-3 pr-3">
                                {x}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {state.rows.map((r) => (
                            <tr
                              key={r.id}
                              className="border-b border-[#E5E1D8] transition hover:bg-[#FAF8F4]"
                            >
                              <td className="py-3 pr-3 font-mono text-xs">{r.earned_on}</td>
                              <td className="font-medium text-[#0F1B2D]">
                                {r.startup_name || '—'}
                              </td>
                              <td className="text-[#4A5568]">{r.session_topic || '—'}</td>
                              <td>{money(r.gross_amount, r.currency)}</td>
                              <td className="text-[#806236]">
                                {money(r.commission_amount, r.currency)}
                              </td>
                              <td className="text-[#B42318]">{money(r.tds_amount, r.currency)}</td>
                              <td className="font-semibold text-[#1B6E32]">
                                {money(r.net_amount, r.currency)}
                              </td>
                              <td>
                                <span className="inline-block rounded-full bg-[#F3F0EA] px-2.5 py-0.5 text-xs font-medium capitalize text-[#4A5568]">
                                  {r.status ? String(r.status).replaceAll('_', ' ') : '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ))}
            </>
          )}
        </>
      )}
    </MentorPageShell>
  );
}
