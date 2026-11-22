'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Send } from 'lucide-react';
import { InvestorShell, Card, Button, StatusBadge } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError } from '@/components/async-state';
import { api, ApiError } from '@/lib/api/client';
import { InvestorDisclaimer } from '../../investor-data';

export default function InvestorOfferDetailPage({ params }) {
  const offerId = params?.offerId;
  const [offer, setOffer] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [termsTab, setTermsTab] = useState('Terms');
  const [modal, setModal] = useState('');
  const [counterForm, setCounterForm] = useState({
    amount: '',
    valuation_cap: '',
    discount_pct: '',
    notes: '',
  });
  const [counterErrors, setCounterErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!offerId) {
      setError('No offer id in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [offerData, historyPage] = await Promise.all([
        api.offers.get(offerId),
        api.offers.history(offerId),
      ]);
      setOffer(offerData);
      setHistory(historyPage.items);
      setCounterForm({
        amount: offerData.amount,
        valuation_cap: offerData.valuation_cap || '',
        discount_pct: offerData.discount_pct || '',
        notes: '',
      });
    } catch (err) {
      setError(err?.message || 'Could not load this offer.');
      setOffer(null);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    load();
  }, [load]);

  const isOpen = offer && ['draft', 'sent', 'countered'].includes(offer.status);

  const onWithdraw = async () => {
    setBusy(true);
    try {
      await api.offers.withdraw(offer.id);
      setModal('');
      await load();
    } catch (err) {
      setModal('');
      setError(err instanceof ApiError ? err.message : 'Could not withdraw this offer.');
    } finally {
      setBusy(false);
    }
  };

  const onCounter = async (e) => {
    e.preventDefault();
    setCounterErrors({});
    const amountNum = parseFloat(String(counterForm.amount).replace(/[^0-9.]/g, ''));
    if (!amountNum || amountNum <= 0) {
      setCounterErrors({ amount: 'Enter a valid counter amount.' });
      return;
    }
    setBusy(true);
    try {
      await api.offers.counter(offer.id, {
        amount: amountNum,
        currency: offer.currency,
        instrument: offer.instrument,
        valuation_cap: counterForm.valuation_cap ? parseFloat(counterForm.valuation_cap) : null,
        discount_pct: counterForm.discount_pct ? parseFloat(counterForm.discount_pct) : null,
        notes: counterForm.notes || null,
      });
      setModal('');
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setCounterErrors(
          Object.fromEntries(
            (err.details || []).map((d) => {
              const key = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
              return [key, d.msg || 'Invalid value.'];
            }),
          ),
        );
      }
      setError(err instanceof ApiError ? err.message : 'Could not send the counter.');
    } finally {
      setBusy(false);
    }
  };

  // Comparison: the two most recent versions.
  const comparison = (() => {
    const sorted = [...history].sort((a, b) => a.version - b.version);
    if (sorted.length < 2) return null;
    return [sorted[sorted.length - 2], sorted[sorted.length - 1]];
  })();

  return (
    <InvestorShell
      active="Offers"
      module="Deal flow"
      title={offer ? `Offer · ${offer.startup_name}` : 'Offer'}
      description={offer ? `Review terms, negotiation history and documents for offer ${offer.id}.` : ''}
      backHref="/investor/offers"
      backLabel="← Back to Offers"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/investor/offers"
            className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
          >
            ← Offers
          </Link>
          {offer && isOpen && (
            <>
              <Button secondary onClick={() => setModal('withdraw')} disabled={busy}>
                Withdraw offer
              </Button>
              <Button onClick={() => setModal('counter')} disabled={busy}>
                <Send size={13} /> Send counter
              </Button>
            </>
          )}
        </div>
      }
    >
      {({ notify }) => (
        <>
          {loading && <LoadingBlock label="Loading offer…" rows={2} />}
          {!loading && error && !offer && (
            <ErrorBlock message={error} onRetry={load} />
          )}

          {!loading && offer && (
            <>
              {/* Status Alert Banner */}
              <div className="mb-6 rounded-xl bg-[#F3EBDD] p-4 text-xs text-[#806236] border border-[#E7D4B0] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <b>{offer.status === 'countered' ? `${offer.startup_name} countered with version v${offer.version}.` : `Offer ${offer.status}.`}</b>{' '}
                  Review the terms and negotiation history below.
                </div>
                <span className="font-semibold">
                  {offer.round_target ? `${offer.round_target} ${offer.round_currency || ''}` : 'Round'} · Active Version v{offer.version}
                </span>
              </div>

              <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {['Terms', 'Comparison', 'Negotiation', 'Documents', 'Approvals', 'History'].map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setTermsTab(x)}
                    className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                      termsTab === x
                        ? 'bg-ink text-white'
                        : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>

              {termsTab === 'Terms' && (
                <div className="grid items-start gap-6 xl:grid-cols-3">
                  <div className="space-y-6 xl:col-span-2">
                    <Card title="Economics & Valuation">
                      <div className="divide-y divide-[#E5E1D8] text-xs">
                        {[
                          ['Offer amount', `${offer.amount} ${offer.currency}`],
                          ['Instrument', offer.instrument],
                          ['Valuation cap', offer.valuation_cap || '—'],
                          ['Discount rate', offer.discount_pct ? `${offer.discount_pct}%` : '—'],
                        ].map(([term, val]) => (
                          <div key={term} className="grid grid-cols-3 gap-2 py-3">
                            <span className="font-medium text-[#4A5568]">{term}</span>
                            <b className="font-semibold text-ink">{val}</b>
                            <span className="text-[#806236]">v{offer.version}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card title="Governance & Investor Rights">
                      <EmptyBlock
                        title="Governance terms arrive later"
                        hint="Board seats, information rights and pro-rata terms are recorded with the executed term sheet (a later step), not on this offer record."
                      />
                    </Card>

                    <Card title="Ownership & estimated dilution">
                      <EmptyBlock
                        title="Dilution is computed later"
                        hint="Cap-table impact and dilution are computed with the commitments step (a later step)."
                      />
                    </Card>
                  </div>

                  <aside className="space-y-6">
                    <Card title="Offer status & next step">
                      <StatusBadge status={offer.status} />
                      <p className="mt-3 text-xs text-[#4A5568]">
                        Offer expires:{' '}
                        {offer.expires_on ? new Date(offer.expires_on).toLocaleDateString() : '—'}
                      </p>
                      <p className="mt-1 text-xs text-[#4A5568]">
                        Deal lead: {offer.owner_name || '—'}
                      </p>
                      <Link
                        href={`/investor/startups/${offer.startup_slug || offer.startup_org_id}/diligence`}
                        className="mt-4 block text-xs font-semibold text-[#9A7A45] hover:underline"
                      >
                        Open diligence memo →
                      </Link>
                    </Card>
                  </aside>
                </div>
              )}

              {termsTab === 'Negotiation' && (
                <Card title="Negotiation timeline & counter history">
                  <div className="space-y-4 text-xs">
                    {history.length === 0 ? (
                      <EmptyBlock title="No negotiation history yet" hint="Version history will appear here as the offer is sent and countered." />
                    ) : (
                      [...history]
                        .sort((a, b) => a.version - b.version)
                        .map((v) => (
                          <div
                            key={v.id}
                            className={`rounded-lg border p-3.5 ${
                              v.status === 'countered' ? 'bg-[#F3EBDD] border-[#E7D4B0]' : 'border-[#E5E1D8]'
                            }`}
                          >
                            <b className={v.status === 'countered' ? 'text-[#806236]' : 'text-ink'}>
                              Version v{v.version} · {v.status}
                            </b>
                            <span className="text-[#4A5568] block mt-0.5">
                              {v.amount} {v.currency} · {v.instrument} · Cap {v.valuation_cap || '—'} ·{' '}
                              {v.discount_pct ? `${v.discount_pct}%` : 'no discount'}
                            </span>
                            <span className="text-xs text-[#4A5568] block mt-0.5">
                              {new Date(v.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))
                    )}
                  </div>

                  {isOpen && (
                    <div className="mt-6 border-t border-[#E5E1D8] pt-4">
                      <label htmlFor="counter-response" className="block text-xs font-medium text-ink">
                        Reply to founder&apos;s counter proposal
                      </label>
                      <textarea
                        id="counter-response"
                        value={counterForm.notes}
                        onChange={(e) => setCounterForm({ ...counterForm, notes: e.target.value })}
                        rows={3}
                        placeholder="Explain your stance or propose adjusted terms..."
                        className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-xs focus:border-ink focus:outline-none"
                      />
                      <Button
                        className="mt-3"
                        onClick={() => setModal('counter')}
                        disabled={busy}
                      >
                        <Send size={13} /> Send counter response
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {termsTab === 'Documents' && (
                <Card title="Term sheet documents">
                  <EmptyBlock
                    title="Documents arrive later"
                    hint="Executed term-sheet documents are managed with the data-room step (a later step)."
                  />
                </Card>
              )}

              {termsTab === 'Approvals' && (
                <Card title="Internal investment committee approvals">
                  <EmptyBlock
                    title="Approvals arrive later"
                    hint="Investment-committee approvals are tracked with the commitments step (a later step)."
                  />
                </Card>
              )}

              {termsTab === 'History' && (
                <Card title="Version history">
                  {history.length === 0 ? (
                    <EmptyBlock title="No version history" hint="Versions will be listed here as the offer evolves." />
                  ) : (
                    <div className="space-y-3 text-xs">
                      {[...history]
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                        .map((v) => (
                          <p key={v.id}>
                            <b>{new Date(v.created_at).toLocaleDateString()}:</b> Version v{v.version} ·{' '}
                            {v.status} · {v.amount} {v.currency}
                          </p>
                        ))}
                    </div>
                  )}
                </Card>
              )}

              {termsTab === 'Comparison' && (
                <Card title="Term variance comparison">
                  {!comparison ? (
                    <EmptyBlock
                      title="Not enough versions to compare"
                      hint="A comparison appears once the offer has at least two versions (your offer and a counter)."
                    />
                  ) : (
                    <>
                      <p className="text-xs text-[#4A5568]">
                        Comparison between version v{comparison[0].version} and version v{comparison[1].version}.
                      </p>
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#E5E1D8] text-[#4A5568]">
                              <th className="py-2">Term</th>
                              <th className="py-2">v{comparison[0].version}</th>
                              <th className="py-2">v{comparison[1].version}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E1D8]">
                            {[
                              ['Valuation Cap', comparison[0].valuation_cap, comparison[1].valuation_cap],
                              ['Investment Amount', `${comparison[0].amount} ${comparison[0].currency}`, `${comparison[1].amount} ${comparison[1].currency}`],
                              ['Discount', comparison[0].discount_pct ? `${comparison[0].discount_pct}%` : '—', comparison[1].discount_pct ? `${comparison[1].discount_pct}%` : '—'],
                            ].map(([term, a, b]) => (
                              <tr key={term}>
                                <td className="py-2 font-medium">{term}</td>
                                <td className="py-2">{a}</td>
                                <td className="py-2 font-bold text-[#806236]">{b}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </Card>
              )}

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

              {/* Withdraw Modal */}
              {modal === 'withdraw' && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                  <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="serif text-xl font-bold text-ink">Withdraw offer</h2>
                      <button type="button" onClick={() => setModal('')}>
                        <X size={18} />
                      </button>
                    </div>
                    <p className="text-xs text-[#4A5568]">
                      Are you sure you want to withdraw the offer to {offer.startup_name}? The founders will be respectfully notified.
                    </p>
                    <div className="mt-6 flex justify-end gap-2">
                      <button type="button" onClick={() => setModal('')} className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]">
                        Cancel
                      </button>
                      <Button onClick={onWithdraw} disabled={busy}>
                        {busy ? 'Withdrawing…' : 'Confirm withdrawal'}
                      </Button>
                    </div>
                  </section>
                </div>
              )}

              {/* Counter Modal */}
              {modal === 'counter' && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                  <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="serif text-xl font-bold text-ink">Send counter offer</h2>
                      <button type="button" onClick={() => setModal('')}>
                        <X size={18} />
                      </button>
                    </div>
                    <p className="text-xs text-ink leading-relaxed">
                      Sending a counter creates a new version of this offer. The founders will review the updated terms.
                    </p>
                    <form onSubmit={onCounter} className="mt-4 space-y-3">
                      <div>
                        <label htmlFor="counter-amount" className="block text-xs font-medium text-ink">
                          Counter amount
                        </label>
                        <input
                          id="counter-amount"
                          type="number"
                          min="0"
                          value={counterForm.amount}
                          onChange={(e) => setCounterForm({ ...counterForm, amount: e.target.value })}
                          className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                        />
                        {counterErrors.amount && <FieldError>{counterErrors.amount}</FieldError>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="counter-cap" className="block text-xs font-medium text-ink">
                            Valuation cap
                          </label>
                          <input
                            id="counter-cap"
                            type="number"
                            min="0"
                            value={counterForm.valuation_cap}
                            onChange={(e) => setCounterForm({ ...counterForm, valuation_cap: e.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="counter-disc" className="block text-xs font-medium text-ink">
                            Discount (%)
                          </label>
                          <input
                            id="counter-disc"
                            type="number"
                            min="0"
                            max="100"
                            value={counterForm.discount_pct}
                            onChange={(e) => setCounterForm({ ...counterForm, discount_pct: e.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="counter-notes" className="block text-xs font-medium text-ink">
                          Note (optional)
                        </label>
                        <textarea
                          id="counter-notes"
                          rows={3}
                          value={counterForm.notes}
                          onChange={(e) => setCounterForm({ ...counterForm, notes: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-xs focus:border-ink focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setModal('')} className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]">
                          Cancel
                        </button>
                        <Button type="submit" disabled={busy}>
                          {busy ? 'Sending…' : 'Send counter'}
                        </Button>
                      </div>
                    </form>
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
