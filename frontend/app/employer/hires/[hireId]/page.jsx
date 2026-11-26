'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  EmployerBtn,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/mentorship-labels';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  FilePlus,
  Plus,
  UserCheck,
  UserX,
  X,
  AlertTriangle,
  ChevronDown,
  ShieldAlert,
} from 'lucide-react';

const HIRE_LABEL = {
  pending_onboarding: 'Pending onboarding',
  onboarding: 'Onboarding',
  active: 'Active',
  no_show: 'No show',
  cancelled: 'Cancelled',
};

const hireLabel = (status) => HIRE_LABEL[status] || status;

const ITEM_STATUS_LABEL = {
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Completed',
  blocked: 'Blocked',
  waived: 'Waived',
};

const DOC_STATUS_LABEL = {
  requested: 'Requested',
  received: 'Received',
  verified: 'Verified',
  rejected: 'Rejected',
  expired: 'Expired',
};

function EmployerHireDetailContent() {
  const params = useParams();
  const hireId = params?.hireId;
  const { org } = useJobsWorkspace();
  const canWrite = ['owner', 'admin'].includes(org?.my_role);

  const [activeTab, setActiveTab] = useState('Overview');
  const [toastMessage, setToastMessage] = useState(null);

  // Modals state
  const [showDocModal, setShowDocModal] = useState(false);
  const [docName, setDocName] = useState('');
  const [docPurpose, setDocPurpose] = useState('');
  const [docDueOn, setDocDueOn] = useState('');
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState('');

  const [activeItemNoteModal, setActiveItemNoteModal] = useState(null);
  const [itemNoteText, setItemNoteText] = useState('');
  const [itemNoteBusy, setItemNoteBusy] = useState(false);

  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Resources
  const hireRes = useCareerResource(`hire:${hireId}`, (signal) =>
    api.hires.get(String(hireId), signal)
  );
  const hire = hireRes.data;

  const itemsRes = useCareerResource(`hire-items:${hireId}`, (signal) =>
    api.hires.onboardingItems(String(hireId), { limit: 100 }, signal)
  );

  const docsRes = useCareerResource(`hire-docs:${hireId}`, (signal) =>
    api.hires.documents(String(hireId), { limit: 100 }, signal)
  );

  const membersRes = useCareerResource(`hire-members:${org.id}`, (signal) =>
    api.organizations.members(org.id, { limit: 100, status: 'active' }, signal).catch(() => null)
  );

  const memberName = (userId) => {
    if (!userId) return '—';
    const match = (membersRes.data?.items || []).find((m) => m.user_id === userId);
    return match ? match.display_name : '—';
  };

  const checklistItems = useMemo(() => itemsRes.data?.items || [], [itemsRes.data]);
  const documents = useMemo(() => docsRes.data?.items || [], [docsRes.data]);

  // Group checklist items by section
  const sections = useMemo(() => {
    const map = new Map();
    for (const item of checklistItems) {
      const sec = item.section || 'General';
      if (!map.has(sec)) {
        map.set(sec, []);
      }
      map.get(sec).push(item);
    }
    return Array.from(map.entries());
  }, [checklistItems]);

  const completedCount = checklistItems.filter((i) => i.status === 'done' || i.status === 'waived').length;
  const progressPct =
    checklistItems.length > 0 ? Math.round((completedCount / checklistItems.length) * 100) : 0;

  // Actions
  const handleUpdateHireStatus = async (newStatus) => {
    setShowStatusMenu(false);
    if (!confirm(`Are you sure you want to mark this hire as ${hireLabel(newStatus)}?`)) return;

    try {
      await api.hires.patch(String(hireId), { status: newStatus });
      hireRes.reload();
      showToast(`Hire status updated to ${hireLabel(newStatus)}.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update hire status.');
    }
  };

  const handleUpdateItemStatus = async (itemId, newStatus) => {
    try {
      await api.hires.patchOnboardingItem(String(hireId), String(itemId), { status: newStatus });
      itemsRes.reload();
      hireRes.reload();
      showToast(`Item status updated to ${ITEM_STATUS_LABEL[newStatus] || newStatus}.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update item.');
    }
  };

  const handleSaveItemNote = async (e) => {
    e.preventDefault();
    if (!activeItemNoteModal) return;
    setItemNoteBusy(true);
    try {
      await api.hires.patchOnboardingItem(String(hireId), String(activeItemNoteModal.id), {
        note: itemNoteText.trim() || null,
      });
      itemsRes.reload();
      setActiveItemNoteModal(null);
      showToast('Note updated.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save note.');
    } finally {
      setItemNoteBusy(false);
    }
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!docName.trim()) {
      setDocError('Document name is required.');
      return;
    }
    setDocBusy(true);
    setDocError('');
    try {
      await api.hires.createDocument(String(hireId), {
        name: docName.trim(),
        purpose: docPurpose.trim() || null,
        due_on: docDueOn || null,
      });
      docsRes.reload();
      setShowDocModal(false);
      setDocName('');
      setDocPurpose('');
      setDocDueOn('');
      showToast('Document request created.');
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : 'Could not request document.');
    } finally {
      setDocBusy(false);
    }
  };

  const handleVerifyDocument = async (docId, newStatus) => {
    try {
      await api.hires.patchDocument(String(docId), { status: newStatus });
      docsRes.reload();
      showToast(`Document marked as ${newStatus}.`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update document.');
    }
  };

  const handleDownloadDocument = async (docId) => {
    try {
      const res = await api.hires.downloadDocument(String(docId));
      if (res?.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      } else {
        showToast('Download URL is not available.');
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not download document.');
    }
  };

  if (hireRes.loading) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <LoadingBlock label="Loading hire information…" />
      </div>
    );
  }

  if (hireRes.error || !hire) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-4">
        <ErrorBlock
          message={hireRes.error instanceof ApiError ? hireRes.error.message : 'Could not load this hire.'}
          onRetry={hireRes.reload}
        />
        <Link
          href="/employer/hires"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#806236] hover:underline"
        >
          <ArrowLeft size={14} /> Back to all hires
        </Link>
      </div>
    );
  }

  const tabs = [
    { key: 'Overview', label: 'Overview' },
    { key: 'Checklist', label: `Checklist (${checklistItems.length})` },
    { key: 'Documents', label: `Documents (${documents.length})` },
  ];

  const isLiveHire = hire.status === 'pending_onboarding' || hire.status === 'onboarding';

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

      {/* Request Document Modal */}
      {showDocModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="doc-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                Request Compliance Document
              </h3>
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="mt-4 space-y-4">
              <div>
                <label htmlFor="doc-name" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Document Title *
                </label>
                <input
                  id="doc-name"
                  type="text"
                  required
                  placeholder="e.g. Government Photo ID, Signed NDA, Tax Form 16"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="doc-purpose" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Purpose / Category
                </label>
                <input
                  id="doc-purpose"
                  type="text"
                  placeholder="e.g. Identity verification, Payroll setup"
                  value={docPurpose}
                  onChange={(e) => setDocPurpose(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="doc-due" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Due Date
                </label>
                <input
                  id="doc-due"
                  type="date"
                  value={docDueOn}
                  onChange={(e) => setDocDueOn(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>

              {docError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {docError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E1D8]">
                <EmployerBtn secondary small type="button" onClick={() => setShowDocModal(false)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn primary small type="submit" disabled={docBusy}>
                  {docBusy ? 'Requesting…' : 'Request Document'}
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Note Modal */}
      {activeItemNoteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 className="text-base font-semibold text-[#0F1B2D]">
                Checklist Item Notes
              </h3>
              <button
                type="button"
                onClick={() => setActiveItemNoteModal(null)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveItemNote} className="mt-4 space-y-4">
              <p className="text-xs text-[#4A5568] font-medium">
                {activeItemNoteModal.title}
              </p>
              <div>
                <textarea
                  rows={4}
                  placeholder="Add notes, access links, or blocker explanations for this task..."
                  value={itemNoteText}
                  onChange={(e) => setItemNoteText(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] p-2.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <EmployerBtn secondary small type="button" onClick={() => setActiveItemNoteModal(null)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn primary small type="submit" disabled={itemNoteBusy}>
                  {itemNoteBusy ? 'Saving…' : 'Save Note'}
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
            href="/employer/hires"
            className="inline-flex items-center gap-1 font-medium text-[#806236] hover:underline"
          >
            <ArrowLeft size={14} /> Back to all hires
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">{hire.name || 'Candidate'}</span>
        </div>

        {/* Profile Card with Quick Actions */}
        <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3EBDD] font-serif text-xl font-bold text-[#806236] border border-[#B8955A]/30">
                {(hire.name || 'H').charAt(0)}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D]">
                    {hire.name || 'Candidate'}
                  </h1>
                  <StageChip stage={hireLabel(hire.status)} />
                </div>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  {hire.job_title || 'Role'} ·{' '}
                  <span className="text-[#0F1B2D] font-medium">
                    {hire.department
                      ? hire.department.charAt(0).toUpperCase() + hire.department.slice(1)
                      : 'Team'}
                  </span>
                </p>
                <p className="text-xs text-[#4A5568]">
                  Hiring Manager:{' '}
                  <span className="text-[#0F1B2D] font-medium">{memberName(hire.manager_id)}</span> ·{' '}
                  Starting{' '}
                  <span className="text-emerald-700 font-semibold">{formatDate(hire.start_date)}</span>
                </p>
              </div>
            </div>

            {/* Lifecycle Status Action Controls */}
            {canWrite && (
              <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                {hire.status === 'pending_onboarding' && (
                  <EmployerBtn
                    primary
                    small
                    onClick={() => handleUpdateHireStatus('onboarding')}
                  >
                    <Clock size={14} className="mr-1.5" /> Start Onboarding
                  </EmployerBtn>
                )}

                {isLiveHire && (
                  <EmployerBtn
                    secondary
                    small
                    className="!border-emerald-600 !text-emerald-700 hover:!bg-emerald-50"
                    onClick={() => handleUpdateHireStatus('active')}
                  >
                    <UserCheck size={14} className="mr-1.5" /> Mark Active (Joined)
                  </EmployerBtn>
                )}

                {hire.status === 'active' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 size={14} className="text-emerald-600" /> Active Employee
                  </span>
                )}

                {/* More options dropdown */}
                {isLiveHire && (
                  <div className="relative">
                    <EmployerBtn
                      secondary
                      small
                      onClick={() => setShowStatusMenu(!showStatusMenu)}
                    >
                      More <ChevronDown size={13} className="ml-1" />
                    </EmployerBtn>

                    {showStatusMenu && (
                      <div className="absolute right-0 mt-1 w-44 rounded-xl border border-[#E5E1D8] bg-white py-1 shadow-lg z-20 text-xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateHireStatus('no_show')}
                          className="w-full text-left px-3 py-2 text-amber-700 hover:bg-amber-50 flex items-center gap-1.5"
                        >
                          <AlertTriangle size={13} /> Mark No-show
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateHireStatus('cancelled')}
                          className="w-full text-left px-3 py-2 text-red-700 hover:bg-red-50 flex items-center gap-1.5"
                        >
                          <UserX size={13} /> Cancel Hire
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex gap-1.5 overflow-x-auto border-t border-[#E5E1D8] pt-4 pb-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-[#0F1B2D] text-white shadow-sm'
                      : 'border border-[#E5E1D8] text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid gap-6 lg:grid-cols-12 min-w-0">
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {/* OVERVIEW TAB */}
            {activeTab === 'Overview' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                  <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-4">
                    Hire Information
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Role</span>
                      <p className="font-semibold text-sm text-[#0F1B2D]">{hire.job_title || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Department</span>
                      <p className="font-semibold text-sm text-[#0F1B2D]">
                        {hire.department
                          ? hire.department.charAt(0).toUpperCase() + hire.department.slice(1)
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Hiring Manager</span>
                      <p className="font-semibold text-sm text-[#0F1B2D]">{memberName(hire.manager_id)}</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Start Date</span>
                      <p className="font-semibold text-sm text-emerald-700">{formatDate(hire.start_date)}</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Work Email</span>
                      <p className="font-semibold text-sm text-[#0F1B2D]">{hire.email || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Managing Recruiter (Owner)</span>
                      <p className="font-semibold text-sm text-[#0F1B2D]">{memberName(hire.owner_id)}</p>
                    </div>
                  </div>
                </div>

                {/* Progress preview card */}
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <h3 className="font-serif text-sm font-bold text-[#0F1B2D]">Onboarding Completion</h3>
                      <p className="text-[#4A5568] mt-0.5">
                        {completedCount} of {checklistItems.length} checklist items completed
                      </p>
                    </div>
                    <span className="font-bold text-base text-[#806236]">{progressPct}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-[#E5E1D8] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#B8955A] transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CHECKLIST TAB */}
            {activeTab === 'Checklist' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E5E1D8]">
                    <div>
                      <h2 className="font-serif text-base font-bold text-[#0F1B2D]">
                        Onboarding Tasks
                      </h2>
                      <p className="text-xs text-[#4A5568] mt-0.5">
                        Track Day-1 IT setups, orientations, and role preparation.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#806236]">
                        {completedCount} / {checklistItems.length} Complete ({progressPct}%)
                      </span>
                    </div>
                  </div>

                  {itemsRes.loading ? (
                    <LoadingBlock label="Loading checklist items…" />
                  ) : itemsRes.error ? (
                    <ErrorBlock
                      message="Could not load onboarding checklist items."
                      onRetry={itemsRes.reload}
                    />
                  ) : checklistItems.length === 0 ? (
                    <EmptyBlock
                      title="No checklist items"
                      hint="This hire was created without an onboarding template."
                    />
                  ) : (
                    <div className="space-y-6">
                      {sections.map(([sectionName, items]) => (
                        <div key={sectionName} className="space-y-3">
                          <h3 className="font-semibold text-xs text-[#806236] uppercase tracking-wider">
                            {sectionName}
                          </h3>
                          <div className="space-y-2">
                            {items.map((item) => {
                              const isDone = item.status === 'done';
                              return (
                                <div
                                  key={item.id}
                                  className={`rounded-xl border p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    isDone
                                      ? 'border-emerald-200 bg-emerald-50/40'
                                      : item.status === 'blocked'
                                      ? 'border-red-200 bg-red-50/30'
                                      : 'border-[#E5E1D8] bg-white hover:border-[#B8955A]'
                                  }`}
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <button
                                      type="button"
                                      disabled={!canWrite}
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          item.id,
                                          isDone ? 'pending' : 'done'
                                        )
                                      }
                                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                                        isDone
                                          ? 'border-emerald-600 bg-emerald-600 text-white'
                                          : 'border-[#E5E1D8] hover:border-[#B8955A]'
                                      }`}
                                      aria-label={isDone ? 'Mark pending' : 'Mark done'}
                                    >
                                      {isDone && <CheckCircle2 size={14} />}
                                    </button>

                                    <div className="space-y-1 min-w-0">
                                      <p
                                        className={`text-xs font-semibold leading-snug ${
                                          isDone
                                            ? 'text-[#4A5568] line-through'
                                            : 'text-[#0F1B2D]'
                                        }`}
                                      >
                                        {item.title}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#4A5568]">
                                        {item.due_on && (
                                          <span>Due: {formatDate(item.due_on)}</span>
                                        )}
                                        {item.owner_id && (
                                          <span>Assignee: {memberName(item.owner_id)}</span>
                                        )}
                                        {item.note && (
                                          <span className="text-[#806236] italic truncate max-w-xs">
                                            “{item.note}”
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 self-end sm:self-center">
                                    {canWrite && (
                                      <select
                                        value={item.status}
                                        onChange={(e) =>
                                          handleUpdateItemStatus(item.id, e.target.value)
                                        }
                                        className="rounded-lg border border-[#E5E1D8] bg-white px-2 py-1 text-[11px] text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="done">Done</option>
                                        <option value="blocked">Blocked</option>
                                        <option value="waived">Waived</option>
                                      </select>
                                    )}

                                    {canWrite && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveItemNoteModal(item);
                                          setItemNoteText(item.note || '');
                                        }}
                                        className="text-[11px] text-[#806236] hover:underline"
                                      >
                                        {item.note ? 'Edit Note' : 'Add Note'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DOCUMENTS TAB */}
            {activeTab === 'Documents' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E5E1D8]">
                    <div>
                      <h2 className="font-serif text-base font-bold text-[#0F1B2D]">
                        Compliance & Hire Documents
                      </h2>
                      <p className="text-xs text-[#4A5568] mt-0.5">
                        Manage identity proofs, contracts, certifications, and tax forms.
                      </p>
                    </div>
                    {canWrite && (
                      <EmployerBtn primary small onClick={() => setShowDocModal(true)}>
                        <FilePlus size={14} className="mr-1.5" /> Request Document
                      </EmployerBtn>
                    )}
                  </div>

                  {docsRes.loading ? (
                    <LoadingBlock label="Loading documents…" />
                  ) : docsRes.error ? (
                    <ErrorBlock
                      message="Could not load hire documents."
                      onRetry={docsRes.reload}
                    />
                  ) : documents.length === 0 ? (
                    <EmptyBlock
                      title="No documents requested yet"
                      hint="Request identity verification, background checks, or signed agreements for this hire."
                    >
                      {canWrite && (
                        <EmployerBtn primary small onClick={() => setShowDocModal(true)}>
                          <FilePlus size={14} className="mr-1" /> Request Document
                        </EmployerBtn>
                      )}
                    </EmptyBlock>
                  ) : (
                    <div className="divide-y divide-[#E5E1D8]">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FAF8F4] border border-[#E5E1D8] text-[#806236]">
                              <FileText size={18} />
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-xs text-[#0F1B2D]">{doc.name}</p>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                    doc.status === 'verified'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : doc.status === 'received'
                                      ? 'bg-blue-100 text-blue-800'
                                      : doc.status === 'rejected'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {DOC_STATUS_LABEL[doc.status] || doc.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#4A5568]">
                                {doc.purpose ? `${doc.purpose} · ` : ''}
                                Due: {doc.due_on ? formatDate(doc.due_on) : 'No due date'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {doc.file_id && (
                              <EmployerBtn
                                secondary
                                small
                                onClick={() => handleDownloadDocument(doc.id)}
                              >
                                <Download size={13} className="mr-1" /> Download
                              </EmployerBtn>
                            )}

                            {canWrite && doc.status === 'received' && (
                              <>
                                <EmployerBtn
                                  primary
                                  small
                                  onClick={() => handleVerifyDocument(doc.id, 'verified')}
                                >
                                  <FileCheck size={13} className="mr-1" /> Verify
                                </EmployerBtn>
                                <EmployerBtn
                                  secondary
                                  small
                                  className="!text-red-700"
                                  onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                                >
                                  Reject
                                </EmployerBtn>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Summary Sidebar */}
          <div className="lg:col-span-4 space-y-6 min-w-0">
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
              <h3 className="font-serif text-sm font-bold text-[#0F1B2D] mb-3">Summary</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#4A5568]">Status:</span>
                  <StageChip stage={hireLabel(hire.status)} />
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Start Date:</span>
                  <span className="font-semibold text-emerald-700">{formatDate(hire.start_date)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Department:</span>
                  <span className="font-semibold text-[#0F1B2D]">
                    {hire.department
                      ? hire.department.charAt(0).toUpperCase() + hire.department.slice(1)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Recruiter / Owner:</span>
                  <span className="font-semibold text-[#0F1B2D]">{memberName(hire.owner_id)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Checklist Progress:</span>
                  <span className="font-semibold text-[#806236]">
                    {completedCount} of {checklistItems.length} ({progressPct}%)
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Associated Offer:</span>
                  <Link href="/employer/offers" className="text-[#806236] underline font-medium">
                    View Offers
                  </Link>
                </div>
              </div>
            </div>

            <SafetyStrip />
          </div>
        </div>
      </div>
    </>
  );
}

export default function EmployerHireDetailPage() {
  return (
    <JobsPage activeNav="/employer/hires">
      <EmployerHireDetailContent />
    </JobsPage>
  );
}
