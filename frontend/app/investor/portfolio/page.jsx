'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { InvestorShell, Card, Button, StatusBadge } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError } from '@/components/async-state';
import { api, ApiError } from '@/lib/api/client';
import { InvestorDisclaimer } from '../investor-data';

const INSTRUMENTS = ['equity', 'safe', 'convertible_note', 'ccd', 'ccps', 'debt', 'other'];

export default function InvestorPortfolioPage() {
  const [view, setView] = useState('Cards');
  const [modal, setModal] = useState('');

  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add-holding modal: startups to pick from (discovery module).
  const [startups, setStartups] = useState([]);
  const [form, setForm] = useState({
    startup_org_id: '',
    instrument: 'safe',
    invested_amount: '',
    ownership_pct: '',
    invested_on: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await api.commitments.listHoldings({ limit: 100 });
      setHoldings(page.items);
    } catch (err) {
      setError(err?.message || 'Could not load your portfolio.');
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (modal === 'add-holding') {
      api
        .investorDiscovery.list({ limit: 50 })
        .then((page) => setStartups(page.items))
        .catch(() => setStartups([]));
    }
  }, [modal]);

  const stats = useMemo(() => {
    const sum = (rows) => rows.reduce((s, h) => s + (parseFloat(h.invested_amount) || 0), 0);
    return {
      companies: holdings.length,
      total: sum(holdings),
      active: holdings.filter((h) => h.status === 'active').length,
      exited: holdings.filter((h) => ['exited', 'partially_exited', 'written_off'].includes(h.status)).length,
    };
  }, [holdings]);

  const fmtMoney = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  const onCreate = async (e) => {
    e.preventDefault();
    setFormErrors({});
    if (!form.startup_org_id) {
      setFormErrors({ startup_org_id: 'Choose a company.' });
      return;
    }
    const amountNum = parseFloat(String(form.invested_amount).replace(/[^0-9.]/g, ''));
    if (!amountNum || amountNum <= 0) {
      setFormErrors({ invested_amount: 'Enter a valid amount.' });
      return;
    }
    setSaving(true);
    try {
      await api.commitments.createHolding({
        startup_org_id: form.startup_org_id,
        instrument: form.instrument,
        invested_amount: amountNum,
        currency: 'INR',
        ownership_pct: form.ownership_pct ? parseFloat(form.ownership_pct) : null,
        invested_on: form.invested_on || null,
      });
      setModal('');
      setForm({ startup_org_id: '', instrument: 'safe', invested_amount: '', ownership_pct: '', invested_on: '' });
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormErrors(
          Object.fromEntries(
            (err.details || []).map((d) => {
              const key = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
              return [key, d.msg || 'Invalid value.'];
            }),
          ),
        );
      }
      setError(err instanceof ApiError ? err.message : 'Could not add this holding.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <InvestorShell
      active="Portfolio"
      module="Deal flow"
      title="Portfolio overview"
      description="Updates, metrics and performance reports from companies you funded."
      actions={
        <div className="flex items-center gap-2">
          <Button secondary onClick={() => setView(view === 'Cards' ? 'Table' : 'Cards')}>
            {view === 'Cards' ? 'Table view' : 'Card view'}
          </Button>
          <Button secondary onClick={() => setModal('add-holding')}>
            <Plus size={14} /> Add holding
          </Button>
        </div>
      }
    >
      {({ notify }) => (
        <>
          {/* Stat Strip */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Companies', stats.companies],
              ['Total invested', fmtMoney(stats.total)],
              ['Active holdings', stats.active],
              ['Exited', stats.exited],
              ['Reported value', '—'],
            ].map(([x, y]) => (
              <div key={x} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                <span className="text-xs font-medium text-[#4A5568]">{x}</span>
                <span className="serif mt-1 block text-2xl font-semibold text-ink">{y}</span>
              </div>
            ))}
          </div>

          <p className="mb-4 text-xs text-[#4A5568]">
            Reported values reflect startup-disclosed round valuations and metric updates, not liquid secondary market valuations.
          </p>

          {loading && <LoadingBlock label="Loading your portfolio…" />}
          {!loading && error && !holdings.length && <ErrorBlock message={error} onRetry={load} />}

          {!loading && !error && holdings.length === 0 && (
            <EmptyBlock
              title="No portfolio holdings yet"
              hint="Add a holding to track companies you have invested in."
            >
              <Button secondary onClick={() => setModal('add-holding')}>
                <Plus size={14} /> Add holding
              </Button>
            </EmptyBlock>
          )}

          {!loading && holdings.length > 0 && (
            <>
              {view === 'Cards' ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {holdings.map((h) => (
                    <Card
                      key={h.id}
                      title={
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F3EBDD] font-bold text-ink text-xs">
                            {h.startup_logo_initials || '?'}
                          </span>
                          <span className="font-bold text-ink">{h.startup_name}</span>
                        </div>
                      }
                      action={<StatusBadge status={h.status} />}
                    >
                      <p className="text-xs text-[#4A5568]">{h.startup_sector || '—'}</p>
                      <div className="mt-4 grid grid-cols-2 gap-4 text-xs border-y border-[#E5E1D8] py-3.5 my-2">
                        <div>
                          <span className="text-[#4A5568]">Invested</span>
                          <b className="mt-0.5 block font-semibold text-ink">
                            {h.invested_amount} {h.currency} · {h.instrument}
                          </b>
                        </div>
                        <div>
                          <span className="text-[#4A5568]">Est. Ownership</span>
                          <b className="mt-0.5 block font-semibold text-ink">
                            {h.ownership_pct ? `${h.ownership_pct}%` : '—'}
                          </b>
                        </div>
                        <div>
                          <span className="text-[#4A5568]">Invested on</span>
                          <b className="mt-0.5 block font-semibold text-ink">
                            {h.invested_on ? new Date(h.invested_on).toLocaleDateString() : '—'}
                          </b>
                        </div>
                        <div>
                          <span className="text-[#4A5568]">Exit value</span>
                          <b className="mt-0.5 block font-semibold text-ink">
                            {h.exit_value || '—'}
                          </b>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#E5E1D8] pt-3">
                        <Link
                          href={`/investor/portfolio/${h.startup_slug || h.startup_org_id}`}
                          className="text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
                          Open company view →
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white">
                  <table className="w-full min-w-[850px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E1D8] bg-[#FAF8F4] text-[#4A5568]">
                        {['Company', 'Invested', 'Date', 'Ownership', 'Instrument', 'Status', 'Actions'].map((x) => (
                          <th key={x} className="p-3 font-semibold">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8]">
                      {holdings.map((h) => (
                        <tr key={h.id} className="hover:bg-[#FAF8F4]/50">
                          <td className="p-3 font-semibold text-ink">{h.startup_name}</td>
                          <td className="p-3 font-semibold text-ink">
                            {h.invested_amount} {h.currency}
                          </td>
                          <td className="p-3">
                            {h.invested_on ? new Date(h.invested_on).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-3">{h.ownership_pct ? `${h.ownership_pct}%` : '—'}</td>
                          <td className="p-3">{h.instrument}</td>
                          <td className="p-3">
                            <StatusBadge status={h.status} />
                          </td>
                          <td className="p-3">
                            <Link
                              href={`/investor/portfolio/${h.startup_slug || h.startup_org_id}`}
                              className="font-semibold text-[#9A7A45] hover:underline"
                            >
                              View →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Performance & Overdue row */}
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <Card title="Quarterly portfolio deployment trend">
                  <EmptyBlock
                    title="Deployment trend arrives later"
                    hint="Aggregate deployment and performance metrics are computed with the portfolio metrics step (a later step)."
                  />
                </Card>
                <Card title="Action required updates">
                  <EmptyBlock
                    title="Company updates arrive later"
                    hint="Quarterly updates and overdue-tracking are part of the portfolio updates step (a later step)."
                  />
                </Card>
              </div>
            </>
          )}

          <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

          {/* Add Holding Modal */}
          {modal === 'add-holding' && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
              <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="serif text-xl font-bold text-ink">Add portfolio company</h2>
                  <button type="button" onClick={() => setModal('')}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={onCreate} className="space-y-3">
                  <div>
                    <label htmlFor="h-name" className="block text-xs font-medium text-ink">
                      Company
                    </label>
                    <select
                      id="h-name"
                      value={form.startup_org_id}
                      onChange={(e) => setForm({ ...form, startup_org_id: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                    >
                      <option value="">Select a company…</option>
                      {startups.map((s) => (
                        <option key={s.org_id} value={s.org_id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.startup_org_id && <FieldError>{formErrors.startup_org_id}</FieldError>}
                  </div>
                  <div>
                    <label htmlFor="h-amt" className="block text-xs font-medium text-ink">
                      Amount invested
                    </label>
                    <input
                      id="h-amt"
                      type="number"
                      min="0"
                      value={form.invested_amount}
                      onChange={(e) => setForm({ ...form, invested_amount: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                    {formErrors.invested_amount && <FieldError>{formErrors.invested_amount}</FieldError>}
                  </div>
                  <div>
                    <label htmlFor="h-inst" className="block text-xs font-medium text-ink">
                      Instrument
                    </label>
                    <select
                      id="h-inst"
                      value={form.instrument}
                      onChange={(e) => setForm({ ...form, instrument: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                    >
                      {INSTRUMENTS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="h-own" className="block text-xs font-medium text-ink">
                        Ownership %
                      </label>
                      <input
                        id="h-own"
                        type="number"
                        min="0"
                        max="100"
                        value={form.ownership_pct}
                        onChange={(e) => setForm({ ...form, ownership_pct: e.target.value })}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="h-date" className="block text-xs font-medium text-ink">
                        Invested on
                      </label>
                      <input
                        id="h-date"
                        type="date"
                        value={form.invested_on}
                        onChange={(e) => setForm({ ...form, invested_on: e.target.value })}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3">
                    <button type="button" onClick={() => setModal('')} className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]">
                      Cancel
                    </button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Recording…' : 'Record holding'}
                    </Button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </>
      )}
    </InvestorShell>
  );
}
