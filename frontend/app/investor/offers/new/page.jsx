'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InvestorShell, Card, Button } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError } from '@/components/async-state';
import { api, ApiError } from '@/lib/api/client';
import { InvestorDisclaimer } from '../../investor-data';

const INSTRUMENTS = [
  { value: 'safe', label: 'SAFE (Simple Agreement for Future Equity)' },
  { value: 'equity', label: 'Equity (Priced Round)' },
  { value: 'convertible_note', label: 'Convertible Note' },
  { value: 'ccd', label: 'Compulsory Convertible Debent (CCD)' },
  { value: 'ccps', label: 'Compulsory Convertible Preference Share (CCPS)' },
  { value: 'debt', label: 'Debt' },
  { value: 'other', label: 'Other' },
];

export default function InvestorNewOfferPage() {
  const router = useRouter();
  const [startups, setStartups] = useState([]);
  const [startupsLoading, setStartupsLoading] = useState(true);
  const [startupsError, setStartupsError] = useState('');

  const [startupOrgId, setStartupOrgId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [roundsLoading, setRoundsLoading] = useState(false);

  const [form, setForm] = useState({
    round_id: '',
    amount: '',
    instrument: 'safe',
    valuation_cap: '',
    discount_pct: '',
    expires_on: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadStartups = useCallback(async () => {
    setStartupsLoading(true);
    setStartupsError('');
    try {
      const page = await api.investorDiscovery.list({ limit: 50 });
      setStartups(page.items);
    } catch (err) {
      setStartupsError(err?.message || 'Could not load startups.');
    } finally {
      setStartupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStartups();
  }, [loadStartups]);

  // Load the selected startup's rounds (offer is created against a round).
  useEffect(() => {
    if (!startupOrgId) {
      setRounds([]);
      return;
    }
    const startup = startups.find((s) => s.org_id === startupOrgId);
    if (!startup) return;
    let active = true;
    setRoundsLoading(true);
    api
      .investorDiscovery.rounds(startup.slug || startup.org_id, { limit: 50 })
      .then((page) => {
        if (active) setRounds(page.items);
      })
      .catch(() => {
        if (active) setRounds([]);
      })
      .finally(() => {
        if (active) setRoundsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [startupOrgId, startups]);

  const selectedStartup = startups.find((s) => s.org_id === startupOrgId);
  const selectedRound = rounds.find((r) => r.id === form.round_id);

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitError('');
    if (!form.round_id) {
      setFormErrors({ round_id: 'Select a fundraising round.' });
      return;
    }
    const amountNum = parseFloat(String(form.amount).replace(/[^0-9.]/g, ''));
    if (!amountNum || amountNum <= 0) {
      setFormErrors({ amount: 'Enter a valid amount.' });
      return;
    }
    setSaving(true);
    try {
      const created = await api.offers.create({
        round_id: form.round_id,
        amount: amountNum,
        currency: selectedRound?.currency || 'INR',
        instrument: form.instrument,
        valuation_cap: form.valuation_cap ? parseFloat(form.valuation_cap) : null,
        discount_pct: form.discount_pct ? parseFloat(form.discount_pct) : null,
        expires_on: form.expires_on || null,
        notes: form.notes || null,
      });
      // Create makes a draft; sending it puts it before the founder.
      await api.offers.send(created.id);
      router.push(`/investor/offers/${created.id}`);
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
        setSubmitError(err.message);
      } else {
        setSubmitError('Could not create the offer.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <InvestorShell
      active="Offers"
      module="Deal flow"
      title="Create term sheet offer"
      description="Draft and propose investment terms for an active company in your pipeline."
      backHref="/investor/offers"
      backLabel="← Back to Offers"
      actions={
        <Link
          href="/investor/offers"
          className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
        >
          ← Offers
        </Link>
      }
    >
      {({ notify }) => (
        <>
          <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
            {/* Form Fields Column */}
            <form onSubmit={onSubmit} className="space-y-6">
              <Card title="1 · Startup and fundraising round">
                {startupsLoading ? (
                  <LoadingBlock label="Loading startups…" rows={1} />
                ) : startupsError ? (
                  <ErrorBlock message={startupsError} onRetry={loadStartups} />
                ) : startups.length === 0 ? (
                  <EmptyBlock
                    title="No startups to offer"
                    hint="Discover startups to find a round to invest in."
                  >
                    <Link
                      href="/investor/discover"
                      className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      Discover startups
                    </Link>
                  </EmptyBlock>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="target-startup" className="block text-xs font-medium text-ink">
                        Select startup from pipeline
                      </label>
                      <select
                        id="target-startup"
                        value={startupOrgId}
                        onChange={(e) => {
                          setStartupOrgId(e.target.value);
                          setForm((f) => ({ ...f, round_id: '' }));
                        }}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                      >
                        <option value="">Select a startup…</option>
                        {startups.map((s) => (
                          <option key={s.org_id} value={s.org_id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {startupOrgId && (
                      <div>
                        <label htmlFor="target-round" className="block text-xs font-medium text-ink">
                          Fundraising round
                        </label>
                        {roundsLoading ? (
                          <LoadingBlock label="Loading rounds…" rows={1} />
                        ) : rounds.length === 0 ? (
                          <p className="mt-1 text-xs text-[#4A5568]">
                            This startup has no visible rounds to offer against.
                          </p>
                        ) : (
                          <select
                            id="target-round"
                            value={form.round_id}
                            onChange={(e) => setForm((f) => ({ ...f, round_id: e.target.value }))}
                            className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                          >
                            <option value="">Select a round…</option>
                            {rounds.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} · {r.round_type}
                              </option>
                            ))}
                          </select>
                        )}
                        {formErrors.round_id && <FieldError>{formErrors.round_id}</FieldError>}
                      </div>
                    )}
                  </div>
                )}
              </Card>

              <Card title="2 · Investment amount & instrument">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="offer-amount" className="block text-xs font-medium text-ink">
                      Proposed commitment amount
                    </label>
                    <input
                      id="offer-amount"
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="e.g. 2500000"
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                    {formErrors.amount && <FieldError>{formErrors.amount}</FieldError>}
                  </div>

                  <div>
                    <label htmlFor="offer-inst" className="block text-xs font-medium text-ink">
                      Investment instrument
                    </label>
                    <select
                      id="offer-inst"
                      value={form.instrument}
                      onChange={(e) => setForm({ ...form, instrument: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                    >
                      {INSTRUMENTS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="offer-val" className="block text-xs font-medium text-ink">
                      Valuation cap / Pre-money valuation
                    </label>
                    <input
                      id="offer-val"
                      type="number"
                      min="0"
                      value={form.valuation_cap}
                      onChange={(e) => setForm({ ...form, valuation_cap: e.target.value })}
                      placeholder="e.g. 100000000"
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="offer-disc" className="block text-xs font-medium text-ink">
                      Discount rate (%)
                    </label>
                    <input
                      id="offer-disc"
                      type="number"
                      min="0"
                      max="100"
                      value={form.discount_pct}
                      onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
                      placeholder="e.g. 15"
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                  </div>
                </div>
              </Card>

              <Card title="3 · Expiry & cover note">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="offer-exp" className="block text-xs font-medium text-ink">
                      Offer expiry date
                    </label>
                    <input
                      id="offer-exp"
                      type="date"
                      value={form.expires_on}
                      onChange={(e) => setForm({ ...form, expires_on: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label htmlFor="cover-msg" className="block text-xs font-medium text-ink">
                    Note to founder
                  </label>
                  <textarea
                    id="cover-msg"
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Outline context, rationale and strategic partnership value..."
                    className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-xs focus:border-ink focus:outline-none"
                  />
                </div>
              </Card>

              {submitError && (
                <p className="text-xs font-medium text-[#B42318]" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit offer to founder'}
                </Button>
                <Button
                  secondary
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    try {
                      const created = await api.offers.create({
                        round_id: form.round_id,
                        amount: parseFloat(String(form.amount).replace(/[^0-9.]/g, '')) || 0,
                        currency: selectedRound?.currency || 'INR',
                        instrument: form.instrument,
                        valuation_cap: form.valuation_cap ? parseFloat(form.valuation_cap) : null,
                        discount_pct: form.discount_pct ? parseFloat(form.discount_pct) : null,
                        expires_on: form.expires_on || null,
                        notes: form.notes || null,
                      });
                      notify('Term sheet draft saved.');
                      router.push(`/investor/offers/${created.id}`);
                    } catch (err) {
                      notify(err instanceof ApiError ? err.message : 'Could not save the draft.');
                    }
                  }}
                >
                  Save as draft
                </Button>
                <button
                  type="button"
                  onClick={() => notify('Sample SAFE template downloaded.')}
                  className="rounded-lg border border-[#E5E1D8] bg-white px-3.5 py-2 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
                >
                  Generate sample SAFE
                </button>
              </div>
            </form>

            {/* Live Summary Column */}
            <aside className="space-y-6">
              <Card title="Term sheet summary">
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <dt className="text-[#4A5568]">Target</dt>
                    <dd className="font-semibold text-ink">
                      {selectedStartup?.name || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <dt className="text-[#4A5568]">Round</dt>
                    <dd className="font-semibold text-ink">
                      {selectedRound?.name || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <dt className="text-[#4A5568]">Amount</dt>
                    <dd className="font-semibold text-ink">{form.amount || '—'}</dd>
                  </div>
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <dt className="text-[#4A5568]">Instrument</dt>
                    <dd className="font-semibold text-ink">
                      {INSTRUMENTS.find((t) => t.value === form.instrument)?.label || form.instrument}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-[#E5E1D8] pb-2">
                    <dt className="text-[#4A5568]">Valuation</dt>
                    <dd className="font-semibold text-ink">{form.valuation_cap || '—'}</dd>
                  </div>
                </dl>
              </Card>

              <Card title="Legal note">
                <p className="text-xs leading-relaxed text-[#4A5568]">
                  Term sheet records created here are non-binding unless a mutually executed agreement expressly states otherwise. Always obtain independent legal and financial advice before executing binding venture commitments.
                </p>
              </Card>
            </aside>
          </div>

          <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />
        </>
      )}
    </InvestorShell>
  );
}
