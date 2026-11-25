'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  EmployerShell,
  EmployerBtn,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError, fieldErrorsFrom } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatMoney, formatDate } from '@/lib/mentorship-labels';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  MessageSquare,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';

const OFFER_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  countered: 'Countered',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

const statusLabel = (status) => OFFER_LABEL[status] || status;

export default function EmployerOfferDetailPage() {
  const params = useParams();
  const offerId = params?.offerId;

  const [activeTab, setActiveTab] = useState('Terms');
  const [toastMessage, setToastMessage] = useState(null);

  const { org } = useJobsWorkspace();
  const offerRes = useCareerResource(`job-offer:${offerId}`, (signal) =>
    api.jobOffers.get(String(offerId), signal)
  );
  const offer = offerRes.data;

  // Modals
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDays, setExtendDays] = useState('5');
  const [extendError, setExtendError] = useState('');
  const [extendBusy, setExtendBusy] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [revisedSalary, setRevisedSalary] = useState('');
  const [reviseErrors, setReviseErrors] = useState({});
  const [reviseError, setReviseError] = useState('');
  const [reviseBusy, setReviseBusy] = useState(false);

  // Create-hire modal (accepted offers only)
  const [showHireModal, setShowHireModal] = useState(false);
  const [hireTemplate, setHireTemplate] = useState('');
  const [hireStartDate, setHireStartDate] = useState('');
  const [hireDepartment, setHireDepartment] = useState('');
  const [hireManager, setHireManager] = useState('');
  const [hireOwner, setHireOwner] = useState('');
  const [hireErrors, setHireErrors] = useState({});
  const [hireError, setHireError] = useState('');
  const [hireBusy, setHireBusy] = useState(false);

  const templatesRes = useCareerResource(
    `hire-templates:${org.id}`,
    (signal) =>
      showHireModal
        ? api.onboardingTemplates
            .list(org.id, { limit: 100 }, signal)
            .catch(() => ({ items: [] }))
        : Promise.resolve(null)
  );
  const membersRes = useCareerResource(
    `hire-members:${org.id}`,
    (signal) =>
      showHireModal
        ? api.organizations
            .members(org.id, { limit: 100, status: 'active' }, signal)
            .catch(() => ({ items: [] }))
        : Promise.resolve(null)
  );

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const canWrite = ['owner', 'admin'].includes(org.my_role);
  const status = offer?.status;
  const isDraft = status === 'draft';
  const isLive = ['draft', 'sent', 'countered'].includes(status);
  const canExtend = ['sent', 'countered'].includes(status);

  const handleExtendExpiry = async (e) => {
    e.preventDefault();
    setExtendError('');
    setExtendBusy(true);
    try {
      const next = new Date();
      next.setDate(next.getDate() + Number(extendDays));
      await api.jobOffers.patch(String(offerId), {
        expires_on: next.toISOString().slice(0, 10),
      });
      setShowExtendModal(false);
      showToast('Offer validity extended.');
      offerRes.reload();
    } catch (error) {
      setExtendError(
        error instanceof ApiError ? error.message : 'Could not extend the expiry. Please try again.'
      );
    } finally {
      setExtendBusy(false);
    }
  };

  const handleReviseOffer = async (e) => {
    e.preventDefault();
    setReviseErrors({});
    setReviseError('');
    setReviseBusy(true);
    try {
      await api.jobOffers.patch(String(offerId), { base_salary: Number(revisedSalary) });
      setShowReviseModal(false);
      showToast('Offer terms updated.');
      offerRes.reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setReviseErrors(fieldErrorsFrom(error));
      }
      setReviseError(
        error instanceof ApiError ? error.message : 'Could not update the offer. Please try again.'
      );
    } finally {
      setReviseBusy(false);
    }
  };

  const runOfferAction = async (action, successMsg) => {
    try {
      if (action === 'send') await api.jobOffers.send(String(offerId));
      else if (action === 'withdraw') await api.jobOffers.withdraw(String(offerId));
      showToast(successMsg);
      offerRes.reload();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'The action failed. Please try again.');
    }
  };

  const openRevise = () => {
    setReviseErrors({});
    setReviseError('');
    setRevisedSalary(offer?.base_salary != null ? String(offer.base_salary) : '');
    setShowReviseModal(true);
  };

  const openHire = () => {
    setHireErrors({});
    setHireError('');
    setHireTemplate('');
    setHireStartDate(offer?.start_date || '');
    setHireDepartment('');
    setHireManager('');
    setHireOwner('');
    setShowHireModal(true);
  };

  const handleCreateHire = async (e) => {
    e.preventDefault();
    setHireErrors({});
    setHireError('');
    setHireBusy(true);
    try {
      await api.hires.createFromOffer(String(offerId), {
        template_id: hireTemplate || null,
        start_date: hireStartDate || null,
        department: hireDepartment || null,
        manager_id: hireManager || null,
        owner_id: hireOwner || null,
      });
      setShowHireModal(false);
      showToast('Hire created from this offer.');
      offerRes.reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setHireErrors(fieldErrorsFrom(error));
      }
      setHireError(
        error instanceof ApiError ? error.message : 'Could not create the hire. Please try again.'
      );
    } finally {
      setHireBusy(false);
    }
  };

  // Offer letter file (only when attached).
  const fileId = offer?.document_file_id;
  const fileRes = useCareerResource(
    `offer-file:${fileId}`,
    (signal) => (fileId ? api.files.get(String(fileId), signal) : Promise.resolve(null))
  );

  const downloadOfferLetter = async () => {
    try {
      const result = await api.files.download(String(fileId));
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Could not open the document.');
    }
  };

  if (offerRes.loading) {
    return (
      <EmployerShell active="/employer/offers">
        <div className="mx-auto max-w-[1280px]">
          <LoadingBlock label="Loading offer…" />
        </div>
      </EmployerShell>
    );
  }

  if (offerRes.error || !offer) {
    return (
      <EmployerShell active="/employer/offers">
        <div className="mx-auto max-w-[1280px] space-y-4">
          <ErrorBlock
            message={
              offerRes.error instanceof ApiError
                ? offerRes.error.message
                : 'Could not load this offer.'
            }
            onRetry={offerRes.reload}
          />
          <Link
            href="/employer/offers"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#806236] hover:underline"
          >
            <ArrowLeft size={14} /> Back to all offers
          </Link>
        </div>
      </EmployerShell>
    );
  }

  const tabs = ['Terms', 'Negotiation', 'Documents', 'History'];

  return (
    <EmployerShell active="/employer/offers">
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

      {/* Extend Expiry Modal */}
      {showExtendModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="extend-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="extend-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                Extend Offer Validity
              </h3>
              <button
                type="button"
                onClick={() => setShowExtendModal(false)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleExtendExpiry} className="mt-4 space-y-4">
              {extendError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {extendError}
                </div>
              )}
              <p className="text-xs text-[#4A5568]">
                Grant{' '}
                <span className="font-semibold text-[#0F1B2D]">
                  {offer.candidate_name || 'the candidate'}
                </span>{' '}
                additional time to review the offer package.
              </p>
              <div>
                <label htmlFor="extend-days" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Extension Duration
                </label>
                <select
                  id="extend-days"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                >
                  <option value="3">3 Days</option>
                  <option value="5">5 Days</option>
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn secondary small onClick={() => setShowExtendModal(false)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" primary small disabled={extendBusy}>
                  {extendBusy ? 'Applying…' : 'Apply Extension'}
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revise Offer Modal (draft full edit — salary only in this form) */}
      {showReviseModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revise-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="revise-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                Revise Offer Terms
              </h3>
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReviseOffer} className="mt-4 space-y-4">
              {reviseError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {reviseError}
                </div>
              )}
              <div>
                <label htmlFor="revised-salary" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Adjusted Base Compensation (INR)
                </label>
                <input
                  id="revised-salary"
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={revisedSalary}
                  onChange={(e) => setRevisedSalary(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
                <FieldError>{reviseErrors.base_salary}</FieldError>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn secondary small onClick={() => setShowReviseModal(false)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" primary small disabled={reviseBusy}>
                  {reviseBusy ? 'Saving…' : 'Save Terms'}
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Hire Modal (accepted offers only) */}
      {showHireModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hire-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="hire-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                Create Hire from Offer
              </h3>
              <button
                type="button"
                onClick={() => setShowHireModal(false)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateHire} className="mt-4 space-y-4">
              {hireError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {hireError}
                </div>
              )}
              <p className="text-xs text-[#4A5568]">
                Turn the accepted offer for{' '}
                <span className="font-semibold text-[#0F1B2D]">
                  {offer.candidate_name || 'this candidate'}
                </span>{' '}
                into a hire. Empty fields fall back to server defaults (start date from the offer,
                department from the job, owner = you).
              </p>
              <div>
                <label htmlFor="hire-template" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Onboarding Template
                </label>
                <select
                  id="hire-template"
                  value={hireTemplate}
                  onChange={(e) => setHireTemplate(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                >
                  <option value="">No template (start empty)</option>
                  {(templatesRes.data?.items || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.items.length} items
                    </option>
                  ))}
                </select>
                <FieldError>{hireErrors.template_id}</FieldError>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="hire-start" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Start Date
                  </label>
                  <input
                    id="hire-start"
                    type="date"
                    value={hireStartDate}
                    onChange={(e) => setHireStartDate(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                  <FieldError>{hireErrors.start_date}</FieldError>
                </div>
                <div>
                  <label htmlFor="hire-dept" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Department
                  </label>
                  <select
                    id="hire-dept"
                    value={hireDepartment}
                    onChange={(e) => setHireDepartment(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="">From the job</option>
                    {['engineering', 'product', 'design', 'sales', 'marketing', 'operations', 'finance', 'people', 'legal', 'support', 'other'].map((d) => (
                      <option key={d} value={d}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </option>
                    ))}
                  </select>
                  <FieldError>{hireErrors.department}</FieldError>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="hire-manager" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Hiring Manager
                  </label>
                  <select
                    id="hire-manager"
                    value={hireManager}
                    onChange={(e) => setHireManager(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="">Default (job owner)</option>
                    {(membersRes.data?.items || []).map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                  <FieldError>{hireErrors.manager_id}</FieldError>
                </div>
                <div>
                  <label htmlFor="hire-owner" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Hire Owner
                  </label>
                  <select
                    id="hire-owner"
                    value={hireOwner}
                    onChange={(e) => setHireOwner(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="">Default (job owner)</option>
                    {(membersRes.data?.items || []).map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                  <FieldError>{hireErrors.owner_id}</FieldError>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn secondary small onClick={() => setShowHireModal(false)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" primary small disabled={hireBusy}>
                  {hireBusy ? 'Creating…' : 'Create Hire'}
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#4A5568]">
          <Link
            href="/employer/offers"
            className="inline-flex items-center gap-1 font-medium text-[#806236] hover:underline"
          >
            <ArrowLeft size={14} /> Back to all offers
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">
            {offer.candidate_name || 'Candidate (blind review)'}
          </span>
        </div>

        {/* Offer Header Card */}
        <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D]">
                  Offer — {offer.candidate_name || 'Candidate (blind review)'}
                </h1>
                <StageChip stage={statusLabel(status)} />
              </div>
              <p className="text-xs sm:text-sm text-[#4A5568]">
                {offer.job_title} · {offer.company_name} ·{' '}
                {offer.expires_on ? `Expires ${formatDate(offer.expires_on)}` : 'No expiry set'}
              </p>
            </div>

            {/* Action buttons toolbar */}
            {canWrite && (
              <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                {isDraft && (
                  <EmployerBtn primary small onClick={() => runOfferAction('send', 'Offer sent to the candidate.')}>
                    <Send size={14} className="mr-1.5" /> Send Offer
                  </EmployerBtn>
                )}
                {isDraft && (
                  <EmployerBtn secondary small onClick={openRevise}>
                    Revise Offer
                  </EmployerBtn>
                )}
                {canExtend && (
                  <EmployerBtn secondary small onClick={() => { setExtendError(''); setShowExtendModal(true); }}>
                    <RefreshCw size={14} className="mr-1.5" /> Extend Expiry
                  </EmployerBtn>
                )}
                {status === 'accepted' && (
                  <EmployerBtn primary small onClick={openHire}>
                    Create Hire
                  </EmployerBtn>
                )}
                {isLive && (
                  <EmployerBtn
                    destructive
                    small
                    onClick={() => {
                      if (confirm('Are you certain you want to withdraw this active offer?')) {
                        runOfferAction('withdraw', 'Offer withdrawn and marked inactive.');
                      }
                    }}
                  >
                    Withdraw
                  </EmployerBtn>
                )}
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex gap-1.5 overflow-x-auto border-t border-[#E5E1D8] pt-4 pb-1">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-[#0F1B2D] text-white shadow-sm'
                      : 'border border-[#E5E1D8] text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Two Columns */}
        <div className="grid gap-6 lg:grid-cols-12 min-w-0">
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {activeTab === 'Terms' && (
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-4">
                  Offer Financial & Contract Terms
                </h2>
                <div className="space-y-4">
                  <div className="divide-y divide-[#E5E1D8] text-xs">
                    <div className="flex justify-between py-2.5">
                      <span className="text-[#4A5568]">Annual Fixed CTC:</span>
                      <span className="font-semibold text-sm text-[#0F1B2D]">
                        {formatMoney(offer.base_salary, offer.currency) || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-[#4A5568]">Annual Performance Variable:</span>
                      <span className="font-semibold text-sm text-[#0F1B2D]">
                        {formatMoney(offer.bonus_amount, offer.currency) || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-[#4A5568]">Joining Bonus:</span>
                      <span className="font-semibold text-sm text-[#0F1B2D]">
                        {formatMoney(offer.joining_bonus, offer.currency) || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-[#4A5568]">Equity Grant (ESOP):</span>
                      <span className="font-semibold text-sm text-[#806236]">
                        {offer.equity_pct != null ? `${offer.equity_pct}%` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-[#4A5568]">Target Start Date:</span>
                      <span className="font-semibold text-sm text-[#0F1B2D]">
                        {formatDate(offer.start_date) || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <span className="text-[#4A5568]">Offer Expiry:</span>
                      <span className="font-semibold text-sm text-amber-700">
                        {offer.expires_on ? formatDate(offer.expires_on) : 'None'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#4A5568] border-t border-[#E5E1D8] pt-3">
                    Formal legal employment agreement will be generated automatically upon digital
                    acceptance.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'Negotiation' && (
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-4">
                  Candidate Counter & Negotiation Log
                </h2>
                <EmptyBlock
                  title="No negotiation messages yet"
                  hint="Candidate counters and offer discussions arrive with messaging in a later step. Until then, revisions happen through “Revise Offer” on a draft."
                />
              </div>
            )}

            {activeTab === 'Documents' && (
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-4">
                  Offer Documents & Legal Attachments
                </h2>
                {!fileId ? (
                  <EmptyBlock
                    title="No offer letter attached"
                    hint="Attach an organization document to this offer when preparing it, and it will appear here for download."
                  />
                ) : fileRes.loading ? (
                  <LoadingBlock label="Loading document…" rows={1} />
                ) : fileRes.error ? (
                  <ErrorBlock
                    message={fileRes.error instanceof ApiError ? fileRes.error.message : 'Could not load the document.'}
                    onRetry={fileRes.reload}
                    title="Could not load the document"
                  />
                ) : (
                  <div className="divide-y divide-[#E5E1D8] text-xs">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2.5">
                        <FileText size={18} className="text-[#806236]" />
                        <div>
                          <p className="font-semibold text-[#0F1B2D]">
                            {fileRes.data?.name || 'Offer letter'}
                          </p>
                          <p className="text-[#4A5568]">
                            {fileRes.data?.size_bytes
                              ? `${Math.max(1, Math.round(fileRes.data.size_bytes / 1024))} KB · `
                              : ''}
                            Organization document
                          </p>
                        </div>
                      </div>
                      <EmployerBtn secondary small onClick={downloadOfferLetter}>
                        <Download size={14} className="mr-1" /> Download
                      </EmployerBtn>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'History' && (
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-4">
                  Offer Activity History
                </h2>
                <EmptyBlock
                  title="History is not available yet"
                  hint="Offer activity is recorded on the server; browsing it arrives with the organization activity feed in Step 7l."
                />
              </div>
            )}
          </div>

          {/* Right Summary Sidebar */}
          <div className="lg:col-span-4 space-y-6 min-w-0">
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
              <h3 className="font-serif text-sm font-bold text-[#0F1B2D] mb-3">Offer Overview</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#4A5568]">Pipeline Status:</span>
                  <StageChip stage={statusLabel(status)} />
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Countdown:</span>
                  <span className="font-bold text-amber-700">
                    {offer.expires_on ? formatDate(offer.expires_on) : 'None'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Managing Recruiter:</span>
                  <span className="font-semibold text-[#0F1B2D]">{offer.owner_name || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Responded:</span>
                  <span className="font-semibold text-[#0F1B2D]">
                    {offer.responded_at ? formatDate(offer.responded_at) : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            <SafetyStrip />
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}
