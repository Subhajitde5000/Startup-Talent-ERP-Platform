'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  EmployerShell,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/mentorship-labels';
import { ArrowLeft } from 'lucide-react';

const HIRE_LABEL = {
  pending_onboarding: 'Pending onboarding',
  onboarding: 'Onboarding',
  active: 'Active',
  no_show: 'No show',
  cancelled: 'Cancelled',
};

const hireLabel = (status) => HIRE_LABEL[status] || status;

export default function EmployerHireDetailPage() {
  const params = useParams();
  const hireId = params?.hireId;
  const { org } = useJobsWorkspace();

  const [activeTab, setActiveTab] = useState('Overview');
  const hireRes = useCareerResource(`hire:${hireId}`, (signal) =>
    api.hires.get(String(hireId), signal)
  );
  const hire = hireRes.data;

  const membersRes = useCareerResource(
    `hire-members:${org.id}`,
    (signal) =>
      api.organizations.members(org.id, { limit: 100, status: 'active' }, signal).catch(() => null)
  );
  const memberName = (userId) => {
    if (!userId) return '—';
    const match = (membersRes.data?.items || []).find((m) => m.user_id === userId);
    return match ? match.display_name : '—';
  };

  if (hireRes.loading) {
    return (
      <EmployerShell active="/employer/hires">
        <div className="mx-auto max-w-[1280px]">
          <LoadingBlock label="Loading hire…" />
        </div>
      </EmployerShell>
    );
  }

  if (hireRes.error || !hire) {
    return (
      <EmployerShell active="/employer/hires">
        <div className="mx-auto max-w-[1280px] space-y-4">
          <ErrorBlock
            message={
              hireRes.error instanceof ApiError
                ? hireRes.error.message
                : 'Could not load this hire.'
            }
            onRetry={hireRes.reload}
          />
          <Link
            href="/employer/hires"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#806236] hover:underline"
          >
            <ArrowLeft size={14} /> Back to all hires
          </Link>
        </div>
      </EmployerShell>
    );
  }

  const tabs = ['Overview', 'Messages'];

  return (
    <EmployerShell active="/employer/hires">
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

        {/* Profile Card */}
        <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  <span className="text-[#0F1B2D] font-medium">
                    {memberName(hire.manager_id)}
                  </span>{' '}
                  · Starting{' '}
                  <span className="text-emerald-700 font-semibold">
                    {formatDate(hire.start_date)}
                  </span>
                </p>
              </div>
            </div>
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

        {/* Two Columns */}
        <div className="grid gap-6 lg:grid-cols-12 min-w-0">
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {activeTab === 'Overview' && (
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
              <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-4">
                Hire Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                  <span className="text-[#4A5568] block">Role</span>
                  <p className="font-semibold text-sm text-[#0F1B2D]">
                    {hire.job_title || '—'}
                  </p>
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
                  <p className="font-semibold text-sm text-[#0F1B2D]">
                    {memberName(hire.manager_id)}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                  <span className="text-[#4A5568] block">Start Date</span>
                  <p className="font-semibold text-sm text-emerald-700">
                    {formatDate(hire.start_date)}
                  </p>
                </div>
              </div>
            </div>
            )}

            {activeTab === 'Messages' && (
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-4">Messages</h2>
                <EmptyBlock
                  title="Messaging is not available yet"
                  hint="Direct messages between the hiring team and a hire arrive with the messaging step. Until then, use your existing email workflows."
                />
              </div>
            )}
          </div>

          {/* Right Summary */}
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
                  <span className="font-semibold text-emerald-700">
                    {formatDate(hire.start_date)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Owner:</span>
                  <span className="font-semibold text-[#0F1B2D]">
                    {memberName(hire.owner_id)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Checklist:</span>
                  <span className="font-semibold text-[#0F1B2D]">
                    {hire.checklist_total > 0
                      ? `${hire.checklist_done} of ${hire.checklist_total} done`
                      : 'None'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Associated Offer:</span>
                  <Link
                    href="/employer/offers"
                    className="text-[#806236] underline font-medium"
                  >
                    View Offers
                  </Link>
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
