'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, X } from 'lucide-react';
import { InvestorShell, Card, Button, StatusBadge } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api, ApiError } from '@/lib/api/client';
import { InvestorDisclaimer } from '../../investor-data';

export default function InvestorCommitmentDetailPage({ params }) {
  const commitmentId = params?.commitmentId;
  const [commitment, setCommitment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!commitmentId) {
      setError('No commitment id in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.commitments.get(commitmentId);
      setCommitment(data);
    } catch (err) {
      setError(err?.message || 'Could not load this commitment.');
      setCommitment(null);
    } finally {
      setLoading(false);
    }
  }, [commitmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const transition = async (status) => {
    setBusy(true);
    try {
      const updated = await api.commitments.changeStatus(commitment.id, status);
      setCommitment(updated);
      setModal('');
    } catch (err) {
      setModal('');
      setError(err instanceof ApiError ? err.message : 'Could not update this commitment.');
    } finally {
      setBusy(false);
    }
  };

  const canDocument = commitment?.status === 'pledged';
  const canFund = commitment?.status === 'documented';
  const canCancel = commitment && ['pledged', 'documented'].includes(commitment.status);

  return (
    <InvestorShell
      active="Commitments"
      module="Deal flow"
      title={commitment ? `Commitment · ${commitment.startup_name}` : 'Commitment execution'}
      description="Closing checklist, legal documentation execution and funds transfer records."
      backHref="/investor/commitments"
      backLabel="← Back to Commitments"
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/investor/commitments"
            className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
          >
            ← Commitments
          </Link>
          {commitment && canFund && (
            <Button onClick={() => setModal('funds')} disabled={busy}>
              Record funds sent
            </Button>
          )}
          {commitment && canDocument && (
            <Button secondary onClick={() => transition('documented')} disabled={busy}>
              Mark documented
            </Button>
          )}
        </div>
      }
    >
      {({ notify }) => (
        <>
          {loading && <LoadingBlock label="Loading commitment…" rows={2} />}
          {!loading && error && !commitment && <ErrorBlock message={error} onRetry={load} />}

          {!loading && commitment && (
            <>
              <div className="grid items-start gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  <Card title="Commitment summary">
                    <div className="rounded-xl bg-[#FAF8F4] p-4 border border-[#E5E1D8]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-ink">
                          {commitment.startup_name}
                          {commitment.round_target ? (
                            <span className="ml-2 text-xs font-normal text-[#4A5568]">
                              · {commitment.round_target} {commitment.round_currency || ''}
                            </span>
                          ) : null}
                        </p>
                        <StatusBadge status={commitment.status} />
                      </div>
                      <p className="mt-1 text-xs text-[#4A5568]">
                        {commitment.amount} {commitment.currency}
                        {commitment.offer_id ? (
                          <>
                            {' · '}Linked offer:{' '}
                            <Link
                              href={`/investor/offers/${commitment.offer_id}`}
                              className="font-semibold text-ink hover:underline"
                            >
                              View offer
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </Card>

                  <Card title="Definitive closing checklist">
                    <EmptyBlock
                      title="Closing checklist arrives later"
                      hint="Definitive-document signing tasks are tracked with the commitments/data-room step (a later step), not on this commitment record."
                    />
                  </Card>

                  <Card title="Capital & funds tracker">
                    <div className="space-y-3 text-xs">
                      <div className="rounded-lg border border-[#E5E1D8] p-3.5 flex items-center justify-between">
                        <div>
                          <b className="text-ink">Committed amount</b>
                          <span className="block text-[#4A5568]">
                            {commitment.amount} {commitment.currency}
                          </span>
                        </div>
                        <StatusBadge status={commitment.status} />
                      </div>
                      <div className="rounded-lg border border-[#E5E1D8] p-3.5 flex items-center justify-between">
                        <div>
                          <b className="text-ink">Committed on</b>
                          <span className="block text-[#4A5568]">
                            {commitment.committed_on
                              ? new Date(commitment.committed_on).toLocaleDateString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#E5E1D8] p-3.5 flex items-center justify-between">
                        <div>
                          <b className="text-ink">Funds wired</b>
                          <span className="block text-[#4A5568]">
                            {commitment.funded_on
                              ? `Wired ${new Date(commitment.funded_on).toLocaleDateString()}`
                              : 'Not yet wired'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236] border border-[#E7D4B0]">
                      <AlertCircle size={14} className="mr-1.5 inline" />
                      The platform does not hold, move or escrow funds. Always verify bank accounts through an independent verbal telephone call.
                    </div>
                  </Card>
                </div>

                {/* Sidebar dates & actions */}
                <aside className="space-y-6">
                  <Card title="Key dates">
                    <dl className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Committed on</dt>
                        <dd className="font-semibold text-ink">
                          {commitment.committed_on
                            ? new Date(commitment.committed_on).toLocaleDateString()
                            : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Funded on</dt>
                        <dd className="font-semibold text-ink">
                          {commitment.funded_on
                            ? new Date(commitment.funded_on).toLocaleDateString()
                            : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Wired at</dt>
                        <dd className="font-semibold text-ink">
                          {commitment.wired_at
                            ? new Date(commitment.wired_at).toLocaleString()
                            : '—'}
                        </dd>
                      </div>
                    </dl>
                  </Card>

                  {commitment.reference && (
                    <Card title="Reference">
                      <p className="text-xs text-ink">{commitment.reference}</p>
                    </Card>
                  )}

                  {commitment.offer_id && (
                    <Card title="Associated files">
                      <Link
                        href={`/investor/offers/${commitment.offer_id}`}
                        className="block text-xs font-semibold text-[#9A7A45] hover:underline"
                      >
                        View linked offer →
                      </Link>
                    </Card>
                  )}
                </aside>
              </div>

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

              {/* Confirm funds modal */}
              {modal === 'funds' && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                  <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="serif text-xl font-bold text-ink">Record funds sent</h2>
                      <button type="button" onClick={() => setModal('')}>
                        <X size={18} />
                      </button>
                    </div>
                    <p className="text-xs text-[#4A5568]">
                      Recording funds marks this commitment as funded and stamps the wiring date. The
                      startup will be notified to confirm receipt.
                    </p>
                    <div className="mt-6 flex justify-end gap-2">
                      <button type="button" onClick={() => setModal('')} className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]">
                        Cancel
                      </button>
                      <Button onClick={() => transition('funded')} disabled={busy}>
                        {busy ? 'Recording…' : 'Confirm funds sent'}
                      </Button>
                    </div>
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
