'use client';

import React, { useMemo, useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  EmployerBtn,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError, fieldErrorsFrom } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatMoney, formatDate } from '@/lib/mentorship-labels';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Plus,
  X,
  ArrowRight,
} from 'lucide-react';

/** Server statuses -> display labels (StageChip keys are the labels). */
const OFFER_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  countered: 'Countered',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

const TABS = ['All', 'Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Withdrawn'];

const statusLabel = (status) => OFFER_LABEL[status] || status;

function EmployerOffersContent() {
  const { org } = useJobsWorkspace();
  const isViewer = org.my_role === 'viewer';
  const canWrite = ['owner', 'admin'].includes(org.my_role);

  const searchParams = useSearchParams();
  const qJobId = searchParams?.get('jobId') || '';
  const qAppId = searchParams?.get('applicationId') || '';

  const [activeTab, setActiveTab] = useState('All');
  const [toastMessage, setToastMessage] = useState(null);

  const offersRes = useCareerResource(
    `job-offers:${org.id}`,
    (signal) =>
      isViewer ? Promise.resolve(null) : api.jobOffers.list(org.id, { limit: 100 }, signal)
  );
  const jobsRes = useCareerResource(
    `job-offer-jobs:${org.id}`,
    (signal) =>
      isViewer || !canWrite
        ? Promise.resolve(null)
        : api.jobs.list(org.id, { limit: 100 }, signal)
  );

  // New Offer Modal
  const [showNewOfferModal, setShowNewOfferModal] = useState(false);
  const [offerJob, setOfferJob] = useState('');
  const [offerApplication, setOfferApplication] = useState('');
  const [basePay, setBasePay] = useState('');
  const [equityPct, setEquityPct] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDays, setExpiryDays] = useState('7');
  const [offerErrors, setOfferErrors] = useState({});
  const [offerError, setOfferError] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [applicants, setApplicants] = useState({ items: [], loading: false, error: '' });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const offers = useMemo(() => offersRes.data?.items || [], [offersRes.data]);

  const filteredOffers = useMemo(() => {
    if (activeTab === 'All') return offers;
    return offers.filter((o) => statusLabel(o.status) === activeTab);
  }, [activeTab, offers]);

  // Metrics derived from the loaded list — never invented.
  const activeCount = offers.filter((o) => o.status === 'draft' || o.status === 'sent' || o.status === 'countered').length;
  const sentCount = offers.filter((o) => o.status === 'sent').length;
  const responded = offers.filter((o) => o.responded_at);
  const accepted = offers.filter((o) => o.status === 'accepted');
  const acceptanceRate =
    responded.length > 0 ? `${Math.round((accepted.length / responded.length) * 100)}%` : '—';
  const avgAcceptDays = (() => {
    const deltas = accepted
      .filter((o) => o.responded_at)
      .map((o) => (new Date(o.responded_at) - new Date(o.created_at)) / 86400000);
    if (deltas.length === 0) return '—';
    const avg = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
    return `${avg.toFixed(1)} days`;
  })();

  // Applicants for the selected job (create modal).
  const openNewOffer = () => {
    setOfferErrors({});
    setOfferError('');
    setOfferJob(jobsRes.data?.items?.[0]?.id || '');
    setBasePay('');
    setEquityPct('');
    setStartDate('');
    setExpiryDays('7');
    setShowNewOfferModal(true);
  };

  useEffect(() => {
    if (qJobId && canWrite) {
      setOfferJob(qJobId);
      if (qAppId) {
        setOfferApplication(qAppId);
      }
      setShowNewOfferModal(true);
    }
  }, [qJobId, qAppId, canWrite]);

  React.useEffect(() => {
    if (!showNewOfferModal || !offerJob) {
      setApplicants({ items: [], loading: false, error: '' });
      setOfferApplication('');
      return undefined;
    }
    const controller = new AbortController();
    setApplicants({ items: [], loading: true, error: '' });
    api.applicants
      .list(org.id, offerJob, { limit: 100 }, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          const eligible = (page.items || []).filter(
            (a) => !['rejected', 'withdrawn', 'hired'].includes(a.stage)
          );
          setApplicants({ items: eligible, loading: false, error: '' });
          setOfferApplication((prev) =>
            prev && eligible.some((a) => a.id === prev)
              ? prev
              : qAppId && eligible.some((a) => a.id === qAppId)
                ? qAppId
                : eligible[0]?.id || ''
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setApplicants({
            items: [],
            loading: false,
            error: error instanceof ApiError ? error.message : 'Could not load applicants.',
          });
        }
      });
    return () => controller.abort();
  }, [showNewOfferModal, offerJob, org.id, qAppId]);

  const selectedJob = (jobsRes.data?.items || []).find((j) => j.id === offerJob);

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    setOfferErrors({});
    setOfferError('');
    if (!offerApplication) {
      setOfferError('Pick a job with at least one active applicant to offer.');
      return;
    }
    setOfferBusy(true);
    try {
      const expires = new Date();
      expires.setDate(expires.getDate() + Number(expiryDays));
      await api.jobOffers.create(org.id, offerJob, offerApplication, {
        // The API requires a title; the demo form never had one, so it
        // defaults to the job title (approved plan U3).
        title: selectedJob?.title || 'Offer',
        base_salary: Number(basePay),
        equity_pct: equityPct === '' ? null : Number(equityPct),
        start_date: startDate,
        expires_on: expires.toISOString().slice(0, 10),
      });
      setShowNewOfferModal(false);
      showToast('Draft offer created.');
      offersRes.reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setOfferErrors(fieldErrorsFrom(error));
      }
      setOfferError(
        error instanceof ApiError ? error.message : 'Could not create the offer. Please try again.'
      );
    } finally {
      setOfferBusy(false);
    }
  };

  if (isViewer) {
    return (
      <>
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]">
            Viewers cannot access offers.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#0F1B2D] px-4 py-3 text-sm text-white shadow-xl flex items-center gap-2 border border-[#B8955A]/30"
        >
          <CheckCircle2 size={16} className="text-[#D4AF37]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* New Offer Modal */}
      {showNewOfferModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-offer-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="new-offer-title" className="text-base font-semibold text-[#0F1B2D]">
                Prepare Employment Offer
              </h3>
              <button
                type="button"
                onClick={() => setShowNewOfferModal(false)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateOffer} className="mt-4 space-y-4">
              {offerError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {offerError}
                </div>
              )}
              <div>
                <label htmlFor="offer-job" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Designated Position
                </label>
                <select
                  id="offer-job"
                  value={offerJob}
                  onChange={(e) => setOfferJob(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                >
                  {(jobsRes.data?.items || [])
                    .filter((j) => j.status !== 'archived')
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                        {j.location ? ` · ${j.location}` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="offer-cand" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Candidate
                </label>
                <select
                  id="offer-cand"
                  required
                  value={offerApplication}
                  onChange={(e) => setOfferApplication(e.target.value)}
                  disabled={applicants.loading}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none disabled:opacity-60"
                >
                  {applicants.loading && <option value="">Loading applicants…</option>}
                  {!applicants.loading && applicants.items.length === 0 && (
                    <option value="">No active applicants for this job</option>
                  )}
                  {applicants.items.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.profile && a.profile.contact && a.profile.contact.name) || a.label} · {a.stage}
                    </option>
                  ))}
                </select>
                <FieldError>{applicants.error}</FieldError>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="offer-base" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Annual Fixed CTC (INR)
                  </label>
                  <input
                    id="offer-base"
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={basePay}
                    onChange={(e) => setBasePay(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                  <FieldError>{offerErrors.base_salary}</FieldError>
                </div>
                <div>
                  <label htmlFor="offer-equity" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Equity Grants / ESOPs (%)
                  </label>
                  <input
                    id="offer-equity"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={equityPct}
                    onChange={(e) => setEquityPct(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                  <FieldError>{offerErrors.equity_pct}</FieldError>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="offer-date" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Target Joining Date
                  </label>
                  <input
                    id="offer-date"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                  <FieldError>{offerErrors.start_date}</FieldError>
                </div>
                <div>
                  <label htmlFor="offer-expiry" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Validity Window (Days)
                  </label>
                  <select
                    id="offer-expiry"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="3">3 Days (Fast-track)</option>
                    <option value="7">7 Days (Standard)</option>
                    <option value="14">14 Days (Extended)</option>
                  </select>
                  <FieldError>{offerErrors.expires_on}</FieldError>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn secondary small onClick={() => setShowNewOfferModal(false)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" primary small disabled={offerBusy}>
                  {offerBusy ? 'Creating…' : 'Create Draft Offer'}
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1B2D]">
              Offers & Compensation Pipeline
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5568]">
              Manage candidate packages, offer validity, and responses.
            </p>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <EmployerBtn primary small onClick={openNewOffer}>
                <Plus size={14} className="mr-1.5" /> New offer
              </EmployerBtn>
            </div>
          )}
        </div>

        {/* Metrics Row — derived from the loaded list */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Active Offers</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{activeCount}</p>
            <p className="text-xs text-[#806236] mt-1">Draft, sent and countered</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Awaiting Response</span>
            <p className="font-serif text-2xl font-bold text-amber-600 mt-1">{sentCount}</p>
            <p className="text-xs text-[#4A5568] mt-1">Sent to candidates</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Acceptance Rate</span>
            <p className="font-serif text-2xl font-bold text-emerald-700 mt-1">{acceptanceRate}</p>
            <p className="text-xs text-[#4A5568] mt-1">
              {responded.length > 0 ? `Of ${responded.length} responded` : 'No responses yet'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Avg Time to Accept</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{avgAcceptDays}</p>
            <p className="text-xs text-[#4A5568] mt-1">
              {accepted.length > 0 ? `Across ${accepted.length} accepted` : 'No acceptances yet'}
            </p>
          </div>
        </div>

        {/* Tabs Filter */}
        <div className="flex gap-2 border-b border-[#E5E1D8] pb-2 overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition ${
                  active
                    ? 'bg-[#0F1B2D] text-white shadow-sm'
                    : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Offers List */}
        {offersRes.loading ? (
          <LoadingBlock label="Loading offers…" />
        ) : offersRes.error ? (
          <ErrorBlock
            message={offersRes.error instanceof ApiError ? offersRes.error.message : 'Could not load offers.'}
            onRetry={offersRes.reload}
          />
        ) : filteredOffers.length === 0 ? (
          <EmptyBlock
            title={`No offers found in "${activeTab}"`}
            hint="Create an offer from an active applicant to populate this pipeline."
          >
            {canWrite && (
              <EmployerBtn primary small onClick={openNewOffer}>
                <Plus size={14} className="mr-1.5" /> New offer
              </EmployerBtn>
            )}
          </EmptyBlock>
        ) : (
          <div className="space-y-4">
            {filteredOffers.map((off) => (
              <div
                key={off.id}
                className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:border-[#B8955A] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-lg font-bold text-[#0F1B2D]">
                        {off.candidate_name || 'Candidate (blind review)'}
                      </h3>
                      <StageChip stage={statusLabel(off.status)} />
                    </div>
                    <p className="text-xs text-[#4A5568]">
                      Role: <span className="font-medium text-[#0F1B2D]">{off.job_title}</span>
                      {off.owner_name ? ` · Managed by ${off.owner_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/employer/offers/${off.id}`}>
                      <EmployerBtn primary small>
                        View Details <ArrowRight size={14} className="ml-1" />
                      </EmployerBtn>
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 border-t border-[#E5E1D8] pt-3 text-xs">
                  <div>
                    <span className="text-[#4A5568] block">Total Compensation:</span>
                    <span className="font-semibold text-base text-[#0F1B2D]">
                      {formatMoney(off.base_salary, off.currency) || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4A5568] block">Target Start Date:</span>
                    <span className="font-medium text-[#0F1B2D]">
                      {formatDate(off.start_date) || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4A5568] block">Validity Window:</span>
                    <span className="font-medium text-amber-700">
                      {off.expires_on ? `Expires ${formatDate(off.expires_on)}` : 'No expiry'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function EmployerOffersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#4A5568]">Loading offers...</div>}>
      <JobsPage activeNav="/employer/offers">
        <EmployerOffersContent />
      </JobsPage>
    </Suspense>
  );
}
