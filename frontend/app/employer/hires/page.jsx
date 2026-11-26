'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  EmployerBtn,
  StageChip,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/mentorship-labels';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const HIRE_LABEL = {
  pending_onboarding: 'Pending onboarding',
  onboarding: 'Onboarding',
  active: 'Active',
  no_show: 'No show',
  cancelled: 'Cancelled',
};

const hireLabel = (status) => HIRE_LABEL[status] || status;

const daysUntil = (iso) => {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

const startsInLabel = (iso) => {
  const days = daysUntil(iso);
  if (days === null) return '';
  if (days > 1) return `in ${days} days`;
  if (days === 1) return 'tomorrow';
  if (days === 0) return 'today';
  const ago = Math.abs(days);
  return `${ago} day${ago === 1 ? '' : 's'} ago`;
};

const TABS = ['All', 'Upcoming starts', 'Needs action', 'Started'];

function EmployerHiresContent() {
  const { org } = useJobsWorkspace();
  const isViewer = org.my_role === 'viewer';

  const [activeTab, setActiveTab] = useState('Upcoming starts');
  const [toastMessage, setToastMessage] = useState(null);

  const hiresRes = useCareerResource(
    `hires:${org.id}`,
    (signal) => (isViewer ? Promise.resolve(null) : api.hires.list(org.id, { limit: 100 }, signal))
  );
  const membersRes = useCareerResource(
    `hires-members:${org.id}`,
    (signal) =>
      isViewer
        ? Promise.resolve(null)
        : api.organizations.members(org.id, { limit: 100, status: 'active' }, signal)
  );

  const hires = useMemo(() => hiresRes.data?.items || [], [hiresRes.data]);
  const memberName = (userId) => {
    if (!userId) return '—';
    const match = (membersRes.data?.items || []).find((m) => m.user_id === userId);
    return match ? match.display_name : '—';
  };

  const upcoming = useMemo(
    () =>
      hires.filter(
        (h) =>
          ['pending_onboarding', 'onboarding'].includes(h.status) &&
          daysUntil(h.start_date) !== null &&
          daysUntil(h.start_date) >= 0
      ),
    [hires]
  );
  const needsAction = useMemo(
    () => hires.filter((h) => ['pending_onboarding', 'onboarding'].includes(h.status)),
    [hires]
  );
  const started = useMemo(() => hires.filter((h) => h.status === 'active'), [hires]);

  const visible =
    activeTab === 'Upcoming starts'
      ? upcoming
      : activeTab === 'Needs action'
        ? needsAction
        : activeTab === 'Started'
          ? started
          : hires;

  // KPIs derived from the loaded list — never invented.
  const in30 = hires.filter((h) => {
    const days = daysUntil(h.start_date);
    return days !== null && days >= 0 && days <= 30 && h.status !== 'cancelled' && h.status !== 'no_show';
  }).length;
  const inOnboarding = hires.filter((h) =>
    ['pending_onboarding', 'onboarding'].includes(h.status)
  ).length;
  const dropped = hires.filter((h) => h.status === 'cancelled' || h.status === 'no_show').length;

  if (isViewer) {
    return (
      <>
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]">
            Viewers cannot access hires.
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

      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1B2D]">
              Hires Directory
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5568]">
              Directory of accepted hires and upcoming team members.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/employer/templates">
              <EmployerBtn secondary small>
                Manage Templates
              </EmployerBtn>
            </Link>
          </div>
        </div>

        {/* KPIs — derived from the loaded list */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Total Hires</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{hires.length}</p>
            <p className="text-xs text-[#806236] mt-1">In this organization</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Upcoming starts (30 days)</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{in30}</p>
            <p className="text-xs text-[#806236] mt-1">Confirmed start dates</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">In onboarding</span>
            <p className="font-serif text-2xl font-bold text-amber-600 mt-1">{inOnboarding}</p>
            <p className="text-xs text-[#4A5568] mt-1">Pending or in progress</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Cancelled / no-show</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{dropped}</p>
            <p className="text-xs text-[#4A5568] mt-1">Did not join</p>
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

        {/* Hires Cards List */}
        {hiresRes.loading ? (
          <LoadingBlock label="Loading hires…" />
        ) : hiresRes.error ? (
          <ErrorBlock
            message={
              hiresRes.error instanceof ApiError ? hiresRes.error.message : 'Could not load hires.'
            }
            onRetry={hiresRes.reload}
          />
        ) : visible.length === 0 ? (
          <EmptyBlock
            title={`No hires in "${activeTab}"`}
            hint="Turn an accepted offer into a hire from the offer's detail page — they will show up here."
          >
            <Link href="/employer/offers">
              <EmployerBtn secondary small>
                View Offers
              </EmployerBtn>
            </Link>
          </EmptyBlock>
        ) : (
          <div className="space-y-4">
            {visible.map((hire) => {
              const pct =
                hire.checklist_total > 0
                  ? Math.round((hire.checklist_done / hire.checklist_total) * 100)
                  : null;
              return (
                <div
                  key={hire.id}
                  className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:border-[#B8955A] space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3EBDD] font-serif text-lg font-bold text-[#806236] border border-[#B8955A]/30">
                        {(hire.name || 'H').charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-lg font-bold text-[#0F1B2D]">
                            {hire.name || 'Candidate'}
                          </h3>
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
                          Manager:{' '}
                          <span className="text-[#0F1B2D] font-medium">
                            {memberName(hire.manager_id)}
                          </span>{' '}
                          · Starting{' '}
                          <span className="text-emerald-700 font-semibold">
                            {formatDate(hire.start_date)}
                          </span>
                          {hire.status !== 'cancelled' && hire.status !== 'no_show' && (
                            <span> ({startsInLabel(hire.start_date)})</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/employer/hires/${hire.id}`}>
                        <EmployerBtn primary small>
                          View Details <ArrowRight size={14} className="ml-1" />
                        </EmployerBtn>
                      </Link>
                    </div>
                  </div>

                  {/* Checklist Progress */}
                  <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-2">
                    {pct === null ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#0F1B2D]">
                          No onboarding checklist yet
                        </span>
                        <span className="text-[#4A5568]">
                          Attach a template when creating the hire
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#0F1B2D]">
                            Checklist Progress: {hire.checklist_done} of {hire.checklist_total}{' '}
                            items complete
                          </span>
                          <span className="font-bold text-[#806236]">{pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#E5E1D8] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#B8955A] transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function EmployerHiresPage() {
  return (
    <JobsPage activeNav="/employer/hires">
      <EmployerHiresContent />
    </JobsPage>
  );
}
