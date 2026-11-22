'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { InvestorShell, Card, Button, StatusBadge } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError } from '@/components/async-state';
import { api, ApiError } from '@/lib/api/client';
import { InvestorDisclaimer } from '../investor-data';

// Tab -> commitment statuses it shows.
const TAB_STATUSES = {
  Active: ['pledged', 'documented', 'funded'],
  'Awaiting funds': ['pledged', 'documented'],
  Closed: ['funded'],
  Cancelled: ['cancelled'],
};

export default function InvestorCommitmentsPage() {
  const [tab, setTab] = useState('Active');
  const [modal, setModal] = useState('');

  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New-commitment modal: accepted offers to link against.
  const [acceptedOffers, setAcceptedOffers] = useState([]);
  const [form, setForm] = useState({ offer_id: '', amount: '', committed_on: '', reference: '' });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await api.commitments.list({ limit: 100 });
      setCommitments(page.items);
    } catch (err) {
      setError(err?.message || 'Could not load your commitments.');
      setCommitments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadAcceptedOffers = useCallback(async () => {
    try {
      const page = await api.offers.list({ status: 'accepted', limit: 50 });
      setAcceptedOffers(page.items);
    } catch {
      setAcceptedOffers([]);
    }
  }, []);

  useEffect(() => {
    if (modal === 'new-commitment') loadAcceptedOffers();
  }, [modal, loadAcceptedOffers]);

  const filtered = useMemo(() => {
    if (tab === 'Active') return commitments.filter((c) => c.status !== 'cancelled');
    const statuses = TAB_STATUSES[tab] || [];
    return commitments.filter((c) => statuses.includes(c.status));
  }, [commitments, tab]);

  const stats = useMemo(() => {
    const active = commitments.filter((c) => c.status !== 'cancelled');
    const funded = commitments.filter((c) => c.status === 'funded');
    const pending = commitments.filter((c) => c.status === 'pledged' || c.status === 'documented');
    const sum = (rows) => rows.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    return {
      total: sum(active),
      sent: sum(funded),
      pending: sum(pending),
      activeCount: active.length,
      fundedCount: funded.length,
    };
  }, [commitments]);

  const fmtMoney = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  const selectedOffer = acceptedOffers.find((o) => o.id === form.offer_id);

  const onCreate = async (e) => {
    e.preventDefault();
    setFormErrors({});
    if (!form.offer_id) {
      setFormErrors({ offer_id: 'Select an accepted offer to commit against.' });
      return;
    }
    const amountNum = parseFloat(String(form.amount).replace(/[^0-9.]/g, ''));
    if (!amountNum || amountNum <= 0) {
      setFormErrors({ amount: 'Enter a valid amount.' });
      return;
    }
    setSaving(true);
    try {
      await api.commitments.create({
        round_id: selectedOffer.round_id,
        offer_id: selectedOffer.id,
        amount: amountNum,
        currency: selectedOffer.currency,
        committed_on: form.committed_on || null,
        reference: form.reference || null,
      });
      setModal('');
      setForm({ offer_id: '', amount: '', committed_on: '', reference: '' });
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
      setError(err instanceof ApiError ? err.message : 'Could not record the commitment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <InvestorShell
      active="Commitments"
      module="Deal flow"
      title="Commitments & capital allocation"
      description="Track capital commitments, definitive documents and funds settlement."
      actions={
        <Button secondary onClick={() => setModal('new-commitment')}>
          <Plus size={14} /> Record commitment
        </Button>
      }
    >
      {({ notify }) => (
        <>
          {/* Stat Strip */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ['Total committed', fmtMoney(stats.total)],
              ['Funds sent', fmtMoney(stats.sent)],
              ['Funds pending', fmtMoney(stats.pending)],
              ['Active commitments', stats.activeCount],
              ['Funded', stats.fundedCount],
            ].map(([x, y]) => (
              <div key={x} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                <span className="text-xs font-medium text-[#4A5568]">{x}</span>
                <span className="serif mt-1 block text-2xl font-semibold text-ink">{y}</span>
              </div>
            ))}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="mb-6 flex gap-2">
            {['Active', 'Awaiting funds', 'Closed', 'Cancelled'].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setTab(x)}
                className={`min-h-10 rounded-lg px-4 text-xs font-semibold transition ${
                  tab === x
                    ? 'bg-ink text-white'
                    : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                }`}
              >
                {x}
              </button>
            ))}
          </div>

          {loading && <LoadingBlock label="Loading commitments…" />}
          {!loading && error && !commitments.length && (
            <ErrorBlock message={error} onRetry={load} />
          )}

          {!loading && !error && commitments.length === 0 && (
            <EmptyBlock
              title="No commitments yet"
              hint="Record a commitment against an accepted offer to start tracking capital allocation."
            >
              <Button secondary onClick={() => setModal('new-commitment')}>
                <Plus size={14} /> Record commitment
              </Button>
            </EmptyBlock>
          )}

          {!loading && commitments.length > 0 && (
            <Card title="Commitment registry">
              {filtered.length === 0 ? (
                <EmptyBlock title="No commitments in this view" hint="Try another tab." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E1D8] text-[#4A5568]">
                        {['Startup & Round', 'Amount', 'Linked Offer', 'Status', 'Committed', 'Funded', 'Reference', 'Actions'].map((x) => (
                          <th key={x} className="py-3 font-semibold">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8]">
                      {filtered.map((c) => (
                        <tr key={c.id} className="hover:bg-[#FAF8F4]/50">
                          <td className="py-3 font-semibold text-ink">
                            {c.startup_name}
                            {c.round_target ? (
                              <span className="block text-[10px] font-normal text-[#4A5568]">
                                {c.round_target} {c.round_currency || ''}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 font-medium text-ink">
                            {c.amount} {c.currency}
                          </td>
                          <td className="py-3">
                            {c.offer_id ? (
                              <Link
                                href={`/investor/offers/${c.offer_id}`}
                                className="font-semibold text-[#9A7A45] hover:underline"
                              >
                                View offer →
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="py-3">
                            {c.committed_on ? new Date(c.committed_on).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3">
                            {c.funded_on ? new Date(c.funded_on).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3">{c.reference || '—'}</td>
                          <td className="py-3">
                            <Link
                              href={`/investor/commitments/${c.id}`}
                              className="font-semibold text-[#9A7A45] hover:underline"
                            >
                              View details →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

          {/* Modal */}
          {modal === 'new-commitment' && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
              <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="serif text-xl font-bold text-ink">Record commitment</h2>
                  <button type="button" onClick={() => setModal('')}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={onCreate} className="space-y-3">
                  <div>
                    <label htmlFor="comm-offer" className="block text-xs font-medium text-ink">
                      Accepted term sheet offer
                    </label>
                    <select
                      id="comm-offer"
                      value={form.offer_id}
                      onChange={(e) => {
                        const offer = acceptedOffers.find((o) => o.id === e.target.value);
                        setForm((f) => ({
                          ...f,
                          offer_id: e.target.value,
                          amount: offer ? String(offer.amount) : '',
                        }));
                      }}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                    >
                      <option value="">Select an accepted offer…</option>
                      {acceptedOffers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.startup_name} · {o.amount} {o.currency}
                        </option>
                      ))}
                    </select>
                    {formErrors.offer_id && <FieldError>{formErrors.offer_id}</FieldError>}
                    {acceptedOffers.length === 0 && (
                      <p className="mt-1 text-xs text-[#4A5568]">
                        No accepted offers yet. An offer must be accepted before a commitment can be recorded.
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="comm-amount" className="block text-xs font-medium text-ink">
                      Commitment amount
                    </label>
                    <input
                      id="comm-amount"
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                    {formErrors.amount && <FieldError>{formErrors.amount}</FieldError>}
                  </div>
                  <div>
                    <label htmlFor="comm-date" className="block text-xs font-medium text-ink">
                      Committed on
                    </label>
                    <input
                      id="comm-date"
                      type="date"
                      value={form.committed_on}
                      onChange={(e) => setForm({ ...form, committed_on: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="comm-ref" className="block text-xs font-medium text-ink">
                      Reference (optional)
                    </label>
                    <input
                      id="comm-ref"
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3">
                    <button type="button" onClick={() => setModal('')} className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]">
                      Cancel
                    </button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Recording…' : 'Record commitment'}
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
