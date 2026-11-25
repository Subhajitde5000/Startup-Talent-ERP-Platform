'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle2,
  FileText,
  Download,
  MessageCircle,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError, fieldErrorsFrom } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatMoney, formatDate } from '@/lib/mentorship-labels';

const WORK_MODE_LABEL = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };

export default function OfferDetailPage() {
  const params = useParams();
  const rawId = params?.offerId;

  const [tab, setTab] = useState('Terms');
  const [toastMessage, setToastMessage] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineErrors, setDeclineErrors] = useState({});
  const [declineError, setDeclineError] = useState('');
  const [declineBusy, setDeclineBusy] = useState(false);

  const offerRes = useCareerResource(`my-job-offer:${rawId}`, (signal) =>
    api.jobOffers.get(String(rawId), signal)
  );
  const offer = offerRes.data;

  const jobRes = useCareerResource(
    `my-offer-job:${offer?.job_id || 'none'}`,
    (signal) => (offer?.job_id ? api.careers.job(String(offer.job_id), true, signal) : Promise.resolve(null))
  );
  const job = jobRes.data;

  const reasonsRes = useCareerResource('offer-decline-reasons', (signal) =>
    api.jobOffers.declineReasons(signal)
  );

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(false), 3500);
  };

  const status = offer?.status;
  const isLive = status === 'sent' || status === 'countered';

  const handleAccept = async () => {
    try {
      await api.jobOffers.accept(String(rawId));
      showToast('Offer accepted! The hiring team has been notified.');
      offerRes.reload();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Could not accept the offer.');
    }
  };

  const handleDecline = async (e) => {
    e.preventDefault();
    setDeclineErrors({});
    setDeclineError('');
    if (!declineReason) {
      setDeclineErrors({ decline_reason_id: 'Select a reason to continue.' });
      return;
    }
    setDeclineBusy(true);
    try {
      await api.jobOffers.decline(String(rawId), { decline_reason_id: declineReason });
      setShowDeclineModal(false);
      showToast('Offer declined respectfully.');
      offerRes.reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setDeclineErrors(fieldErrorsFrom(error));
      }
      setDeclineError(
        error instanceof ApiError ? error.message : 'Could not decline the offer. Please try again.'
      );
    } finally {
      setDeclineBusy(false);
    }
  };

  if (offerRes.loading) {
    return (
      <JobSeekerShell active="Offers">
        <div className="space-y-6 max-w-5xl">
          <LoadingBlock label="Loading offer…" />
        </div>
      </JobSeekerShell>
    );
  }

  if (offerRes.error || !offer) {
    return (
      <JobSeekerShell active="Offers">
        <div className="space-y-6 max-w-5xl">
          <ErrorBlock
            message={
              offerRes.error instanceof ApiError
                ? offerRes.error.message
                : 'Could not load this offer.'
            }
            onRetry={offerRes.reload}
          />
          <Link href="/jobseeker/offers" className="inline-flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#0F1B2D]">
            <ChevronLeft size={14} /> Back to Offers
          </Link>
        </div>
      </JobSeekerShell>
    );
  }

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const benefits = job?.benefits || [];

  return (
    <JobSeekerShell active="Offers">
      <div className="space-y-6 max-w-5xl">
        {/* Decline Modal */}
        {showDeclineModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="decline-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <h3 id="decline-modal-title" className="text-base font-serif font-bold text-[#0F1B2D]">
                Decline Offer
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Let the founders know why — pick the reason that fits best. This cannot be undone.
              </p>
              {declineError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {declineError}
                </div>
              )}
              {reasonsRes.loading ? (
                <LoadingBlock label="Loading reasons…" rows={1} />
              ) : reasonsRes.error ? (
                <ErrorBlock
                  message="Could not load decline reasons."
                  onRetry={reasonsRes.reload}
                  title="Could not load reasons"
                />
              ) : (
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium text-[#0F1B2D] mb-1">Reason</legend>
                  {(reasonsRes.data || []).map((reason) => (
                    <label
                      key={reason.id}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs cursor-pointer ${
                        declineReason === reason.id
                          ? 'border-[#B8955A] bg-[#F3EBDD]/50 text-[#0F1B2D]'
                          : 'border-[#E5E1D8] text-[#4A5568] hover:bg-[#FAF8F4]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="decline-reason"
                        value={reason.id}
                        checked={declineReason === reason.id}
                        onChange={() => setDeclineReason(reason.id)}
                      />
                      {reason.label}
                    </label>
                  ))}
                </fieldset>
              )}
              <FieldError>{declineErrors.decline_reason_id}</FieldError>
              <div className="flex justify-end gap-2">
                <JobBtn secondary small onClick={() => setShowDeclineModal(false)}>
                  Cancel
                </JobBtn>
                <JobBtn destructive small onClick={handleDecline} disabled={declineBusy}>
                  {declineBusy ? 'Declining…' : 'Decline Offer'}
                </JobBtn>
              </div>
            </div>
          </div>
        )}

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link href="/jobseeker/offers" className="flex items-center gap-1 hover:text-[#0F1B2D]">
            <ChevronLeft size={14} /> Back to Offers
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium truncate">{offer.job_title}</span>
        </nav>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="rounded-xl border border-[#CDE5D7] bg-[#E7F3EC] p-3.5 text-xs text-[#286749] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} /> {toastMessage}
            </span>
            <button type="button" onClick={() => setToastMessage('')} className="text-[#286749] hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Header Hero */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#F3EBDD] font-bold text-xl text-[#806236]">
                {offer.company_name?.[0] || 'O'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                    {offer.job_title}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      status === 'accepted'
                        ? 'bg-[#E7F3EC] text-[#286749]'
                        : status === 'declined' || status === 'withdrawn'
                          ? 'bg-[#F3F4F6] text-[#6B7280]'
                          : 'bg-[#FFF8E8] text-[#806236]'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-[#4A5568]">
                  From <strong className="text-[#0F1B2D]">{offer.company_name}</strong> · Received{' '}
                  {formatDate(offer.created_at)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {isLive && (
                <>
                  <JobBtn primary small onClick={handleAccept} className="px-4">
                    Accept Offer
                  </JobBtn>
                  <JobBtn
                    secondary
                    small
                    onClick={() => {
                      setDeclineErrors({});
                      setDeclineError('');
                      setDeclineReason('');
                      setShowDeclineModal(true);
                    }}
                  >
                    Decline
                  </JobBtn>
                </>
              )}
              <Link href="/jobseeker/messages">
                <JobBtn secondary small className="flex items-center gap-1.5">
                  <MessageCircle size={14} /> Message Founder
                </JobBtn>
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="pt-4 border-t border-[#F0EBE0] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[#6B7280] block mb-0.5">Fixed Base CTC</span>
              <strong className="text-[#0F1B2D] text-sm">
                {formatMoney(offer.base_salary, offer.currency) || '—'}
              </strong>
            </div>
            <div>
              <span className="text-[#6B7280] block mb-0.5">Performance Bonus</span>
              <strong className="text-[#0F1B2D] text-sm">
                {formatMoney(offer.bonus_amount, offer.currency) || '—'}
              </strong>
            </div>
            <div>
              <span className="text-[#6B7280] block mb-0.5">ESOP Grant</span>
              <strong className="text-[#0F1B2D] text-sm">
                {offer.equity_pct != null ? `${offer.equity_pct}%` : '—'}
              </strong>
            </div>
            <div>
              <span className="text-[#6B7280] block mb-0.5">Decision Deadline</span>
              <span className="text-[#B7791F] font-semibold">
                {offer.expires_on ? formatDate(offer.expires_on) : 'No expiry'}
              </span>
            </div>
          </div>

          {/* Tab Strip */}
          <div className="border-t border-[#E5E1D8] pt-3 overflow-x-auto min-w-0">
            <div className="flex items-center gap-2 min-w-max pb-1">
              {['Terms', 'Offer Letter & Docs', 'ESOP & Equity', 'Benefits & Perks', 'Discussion History'].map(
                (t) => {
                  const active = tab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        active ? 'bg-[#0F1B2D] text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'
                      }`}
                    >
                      {t}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </header>

        {/* Tab 1: Terms */}
        {tab === 'Terms' && (
          <div className="space-y-6">
            <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                Compensation & Structure
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3.5 space-y-1">
                  <span className="text-[#6B7280]">Fixed Annual Base</span>
                  <div className="text-base font-bold text-[#0F1B2D]">
                    {formatMoney(offer.base_salary, offer.currency) || '—'}
                  </div>
                  <span className="text-[#6B7280]">Paid monthly on the last working day</span>
                </div>
                <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3.5 space-y-1">
                  <span className="text-[#6B7280]">Target Variable Incentive</span>
                  <div className="text-base font-bold text-[#0F1B2D]">
                    {formatMoney(offer.bonus_amount, offer.currency) || '—'}
                  </div>
                  <span className="text-[#6B7280]">Evaluated against key results</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                Joining & Terms of Service
              </h2>
              <div className="text-xs text-[#4A5568] space-y-2">
                <div className="flex justify-between py-1.5 border-b border-[#F0EBE0]">
                  <span className="text-[#6B7280]">Expected Joining Date:</span>
                  <strong className="text-[#0F1B2D]">{formatDate(offer.start_date) || '—'}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F0EBE0]">
                  <span className="text-[#6B7280]">Work Model:</span>
                  <span className="text-[#0F1B2D]">
                    {jobRes.loading
                      ? 'Loading…'
                      : job
                        ? WORK_MODE_LABEL[job.work_mode] || job.work_mode
                        : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#6B7280]">Location:</span>
                  <span className="text-[#0F1B2D]">
                    {jobRes.loading ? 'Loading…' : job?.location || '—'}
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: Offer Letter & Docs */}
        {tab === 'Offer Letter & Docs' && (
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Official Offer Document</h2>
            {!offer.document_file_id ? (
              <EmptyBlock
                title="No offer letter attached yet"
                hint="When the hiring team attaches the formal letter to this offer, it will show up here."
              />
            ) : (
              <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileText size={24} className="text-[#806236]" />
                  <div>
                    <h3 className="text-xs font-bold text-[#0F1B2D]">Offer letter attached</h3>
                    <p className="text-xs text-[#6B7280]">
                      Provided by {offer.company_name} · formal letter for this role
                    </p>
                  </div>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 min-h-[34px] px-3.5 rounded-lg border border-[#E5E1D8] bg-white text-xs font-semibold text-[#6B7280] cursor-not-allowed"
                  title="Candidate document download arrives with the document-exchange step."
                >
                  <Download size={14} /> Download unavailable
                </span>
              </div>
            )}
          </section>
        )}

        {/* Tab 3: ESOP & Equity */}
        {tab === 'ESOP & Equity' && (
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Equity Pool & Vesting</h2>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Standard 4-year vesting schedule with a 1-year cliff. 25% vests after 12 months,
              followed by equal monthly vesting thereafter.
            </p>
            <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-xs space-y-2">
              <div className="flex justify-between border-b border-[#E5E1D8] pb-1.5">
                <span className="text-[#6B7280]">Grant in this offer:</span>
                <strong className="text-[#0F1B2D]">
                  {offer.equity_pct != null ? `${offer.equity_pct}%` : 'Not part of this offer'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Joining bonus:</span>
                <strong className="text-[#286749]">
                  {formatMoney(offer.joining_bonus, offer.currency) || 'None'}
                </strong>
              </div>
            </div>
          </section>
        )}

        {/* Tab 4: Benefits & Perks */}
        {tab === 'Benefits & Perks' && (
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Included Benefits</h2>
            {jobRes.loading ? (
              <LoadingBlock label="Loading benefits…" rows={1} />
            ) : benefits.length === 0 ? (
              <EmptyBlock
                title="No benefits listed for this role"
                hint="Benefits published on the job posting will appear here."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                {benefits.map((b) => (
                  <div key={b.id} className="p-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4]">
                    <strong className="block text-[#0F1B2D] mb-1">{b.label}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 5: Discussion History */}
        {tab === 'Discussion History' && (
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Negotiation & Notes</h2>
            <EmptyBlock
              title="No discussion yet"
              hint="Counter-proposals and negotiation notes arrive with messaging in a later step."
            />
          </section>
        )}
      </div>
    </JobSeekerShell>
  );
}
