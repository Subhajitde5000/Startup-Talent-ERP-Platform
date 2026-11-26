'use client';

import React, { useMemo, useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Loader2,
  Mail,
  Plus,
  Search,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  EmployerBtn,
  EmployerCard,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import {
  JobsPage,
  JobNotice,
  jobLabel,
  useJobsWorkspace,
} from '@/components/employer-jobs-workspace';
import {
  ScheduleInterviewModal,
  CreateOfferModal,
} from '@/components/employer-applicant-pipeline';
import { useCareerResource, dateLabel, stageLabels } from '@/components/career-data';
import { api, ApiError, fileFieldErrors } from '@/lib/api/client';
import { formatDate } from '@/lib/mentorship-labels';

const STAGE_TABS = [
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview', label: 'Interviewing' },
  { id: 'offered', label: 'Offered' },
  { id: 'all_active', label: 'All Active' },
  { id: 'rejected', label: 'Declined / Withdrawn' },
];

function CandidatesWorkbenchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { org, canWrite, href } = useJobsWorkspace();

  const isViewer = org.my_role === 'viewer';

  // Filters & Search
  const [selectedJob, setSelectedJob] = useState(searchParams?.get('jobId') || '');
  const [activeTab, setActiveTab] = useState(searchParams?.get('stage') || 'shortlisted');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [offset, setOffset] = useState(0);
  const [actionBusyId, setActionBusyId] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [offerTarget, setOfferTarget] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load active jobs for filter dropdown
  const jobsRes = useCareerResource(`workbench-jobs:${org.id}`, (signal) =>
    isViewer ? Promise.resolve(null) : api.jobs.list(org.id, { limit: 100 }, signal)
  );

  // Determine stage parameter for API
  const apiStage = useMemo(() => {
    if (activeTab === 'all_active') return undefined;
    return activeTab;
  }, [activeTab]);

  // Load candidates across all jobs (or filtered job)
  const applicantsRes = useCareerResource(
    `workbench-applicants:${org.id}:${selectedJob}:${apiStage}:${query}:${sort}:${offset}`,
    (signal) =>
      isViewer
        ? Promise.resolve(null)
        : api.applicants.listOrg(
            org.id,
            {
              job_id: selectedJob || undefined,
              stage: apiStage,
              q: query || undefined,
              sort,
              limit: 25,
              offset,
            },
            signal
          )
  );

  const jobs = jobsRes.data?.items || [];
  const applicants = applicantsRes.data?.items || [];
  const stageCounts = applicantsRes.data?.stage_counts || {};
  const total = applicantsRes.data?.total || 0;

  // Quick move stage action (e.g. move applied -> shortlisted)
  const quickMoveStage = async (app, targetStage) => {
    setActionBusyId(app.id);
    try {
      await api.applicants.update(org.id, app.job_id, app.id, {
        stage: targetStage,
        expected_stage: app.stage,
      });
      showToast(`Candidate moved to ${stageLabels[targetStage] || targetStage}.`);
      applicantsRes.reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update candidate stage.');
    } finally {
      setActionBusyId('');
    }
  };

  if (isViewer) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <div className="rounded-2xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]">
          Viewers cannot access candidate records or applicant pipelines.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
            Candidates Pipeline Workbench
          </h1>
          <p className="text-xs md:text-sm text-[#6B7280] mt-1">
            Review shortlisted candidates, schedule interviews, and extend offers across all job openings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href('/employer/interviews')}>
            <EmployerBtn secondary small>
              <Calendar size={14} />
              Interview Calendar
            </EmployerBtn>
          </Link>
          <Link href={href('/employer/offers')}>
            <EmployerBtn secondary small>
              <FileText size={14} />
              Offers Hub
            </EmployerBtn>
          </Link>
        </div>
      </div>

      {toastMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 transition-all flex items-center justify-between"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-emerald-700 hover:text-emerald-900 underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="rounded-2xl border border-[#E5E1D8] bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Job Opening Dropdown */}
          <div className="flex items-center gap-2 min-w-[240px]">
            <Filter size={15} className="text-[#806236]" />
            <label htmlFor="workbench-job-select" className="sr-only">
              Filter by job opening
            </label>
            <select
              id="workbench-job-select"
              value={selectedJob}
              onChange={(e) => {
                setSelectedJob(e.target.value);
                setOffset(0);
              }}
              className="w-full rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] px-3 py-2 text-xs font-medium text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            >
              <option value="">All Job Openings ({jobs.length} roles)</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} · {jobLabel(job.status)}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={15} />
            <input
              type="search"
              maxLength={100}
              placeholder="Search candidate name or keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B7280]">Sort:</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setOffset(0);
              }}
              className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            >
              <option value="newest">Newest applied</option>
              <option value="stage_changed">Stage changed recently</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        {/* Stage Tabs */}
        <div className="pt-3 border-t border-[#F0EBE0] flex items-center gap-2 overflow-x-auto text-xs">
          {STAGE_TABS.map((tab) => {
            const count =
              tab.id === 'all_active'
                ? Object.entries(stageCounts)
                    .filter(([st]) => !['rejected', 'withdrawn', 'hired'].includes(st))
                    .reduce((sum, [, c]) => sum + c, 0)
                : stageCounts[tab.id] ?? 0;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isCurrent}
                onClick={() => {
                  setActiveTab(tab.id);
                  setOffset(0);
                }}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-[#0F1B2D] text-white shadow-xs'
                    : 'text-[#4A5568] hover:bg-[#FAF8F4] border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isCurrent ? 'bg-white/20 text-white' : 'bg-[#E5E1D8] text-[#4A5568]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Candidate Table */}
      {applicantsRes.loading ? (
        <div className="rounded-2xl border border-[#E5E1D8] bg-white p-12 text-center text-xs text-[#6B7280]">
          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[#806236]" />
          Loading candidates across your hiring pipeline…
        </div>
      ) : applicantsRes.error ? (
        <JobNotice error retry={applicantsRes.reload}>
          Could not load candidate workbench: {applicantsRes.error instanceof Error ? applicantsRes.error.message : 'Please check your connection.'}
        </JobNotice>
      ) : applicants.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E1D8] bg-white p-12 text-center text-xs space-y-3">
          <UserCheck size={36} className="mx-auto text-[#9CA3AF]" />
          <h3 className="font-serif text-base font-bold text-[#0F1B2D]">
            No Candidates in “{STAGE_TABS.find((t) => t.id === activeTab)?.label}”
          </h3>
          <p className="text-[#6B7280] max-w-md mx-auto">
            {selectedJob
              ? 'No candidates found for this specific job opening and filter.'
              : 'Candidates will appear here as they are shortlisted or progress through interview rounds.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E1D8] bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-[#FAF8F4] border-b border-[#E5E1D8] text-[#6B7280] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-4 pl-6">Candidate</th>
                  <th className="p-4">Target Role</th>
                  <th className="p-4">Stage</th>
                  <th className="p-4">Experience</th>
                  <th className="p-4">Applied</th>
                  <th className="p-4 pr-6 text-right">Instant Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE0] text-[#0F1B2D]">
                {applicants.map((app) => {
                  const isBusy = actionBusyId === app.id;
                  const candidateName = app.is_blind
                    ? 'Candidate (Blind Review)'
                    : app.label || 'Candidate';
                  const expText =
                    app.experience_years != null
                      ? `${app.experience_years} yrs`
                      : 'Not shared';
                  const jobTitle = app.context?.title || 'Open Role';

                  return (
                    <tr key={app.id} className="hover:bg-[#FAF8F4]/50 transition-colors">
                      {/* Candidate Column */}
                      <td className="p-4 pl-6">
                        <Link
                          href={href(`/employer/jobs/${app.job_id}/applicants/${app.id}`)}
                          className="font-semibold text-sm text-[#0F1B2D] hover:text-[#806236] flex items-center gap-1 group"
                        >
                          <span>{candidateName}</span>
                          <ChevronRight
                            size={14}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#806236]"
                          />
                        </Link>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {app.profile?.headline || jobLabel(app.source)}
                        </p>
                      </td>

                      {/* Target Role Column */}
                      <td className="p-4">
                        <Link
                          href={href(`/employer/jobs/${app.job_id}`)}
                          className="font-medium text-[#0F1B2D] hover:underline"
                        >
                          {jobTitle}
                        </Link>
                      </td>

                      {/* Stage Column */}
                      <td className="p-4">
                        <StageChip stage={stageLabels[app.stage] || jobLabel(app.stage)} />
                      </td>

                      {/* Experience Column */}
                      <td className="p-4 text-[#4A5568]">{expText}</td>

                      {/* Applied Date Column */}
                      <td className="p-4 text-[#4A5568]">
                        {dateLabel(app.created_at)}
                      </td>

                      {/* Actions Column */}
                      <td className="p-4 pr-6 text-right whitespace-nowrap space-x-2">
                        {/* Shortlisted Candidate: Schedule Interview */}
                        {app.stage === 'shortlisted' && (
                          <EmployerBtn
                            primary
                            small
                            disabled={!canWrite || isBusy}
                            onClick={() => setScheduleTarget(app)}
                          >
                            <Calendar size={13} />
                            Schedule Interview
                          </EmployerBtn>
                        )}

                        {/* Interviewing Candidate: Schedule Another Round or Make Offer */}
                        {app.stage === 'interview' && (
                          <>
                            <EmployerBtn
                              secondary
                              small
                              disabled={!canWrite || isBusy}
                              onClick={() => setScheduleTarget(app)}
                              title="Schedule another interview round"
                            >
                              <Calendar size={13} />
                              Interview
                            </EmployerBtn>
                            <EmployerBtn
                              primary
                              small
                              disabled={!canWrite || isBusy}
                              onClick={() => setOfferTarget(app)}
                            >
                              <FileText size={13} />
                              Make Offer
                            </EmployerBtn>
                          </>
                        )}

                        {/* Applied/Review: Quick Shortlist */}
                        {['applied', 'review'].includes(app.stage) && (
                          <EmployerBtn
                            secondary
                            small
                            disabled={!canWrite || isBusy}
                            onClick={() => quickMoveStage(app, 'shortlisted')}
                          >
                            <UserCheck size={13} />
                            Shortlist
                          </EmployerBtn>
                        )}

                        {/* Offered: View in Offer Hub */}
                        {app.stage === 'offered' && (
                          <Link href={href('/employer/offers')}>
                            <EmployerBtn secondary small>
                              <FileText size={13} />
                              View Offer
                            </EmployerBtn>
                          </Link>
                        )}

                        {/* Link to Full Profile */}
                        <Link href={href(`/employer/jobs/${app.job_id}/applicants/${app.id}`)}>
                          <EmployerBtn secondary small title="Open candidate profile and full resume">
                            Profile →
                          </EmployerBtn>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-[#E5E1D8] p-4 text-xs">
            <span className="text-[#6B7280]">
              Showing {offset + 1}–{Math.min(offset + applicants.length, total)} of {total} candidates
            </span>
            <div className="flex gap-2">
              <EmployerBtn
                secondary
                small
                disabled={offset === 0}
                onClick={() => setOffset((n) => Math.max(0, n - 25))}
              >
                Previous
              </EmployerBtn>
              <EmployerBtn
                secondary
                small
                disabled={offset + applicants.length >= total}
                onClick={() => setOffset((n) => n + 25)}
              >
                Next
              </EmployerBtn>
            </div>
          </div>
        </div>
      )}

      {/* Inline Interview Scheduling Modal */}
      {scheduleTarget && (
        <ScheduleInterviewModal
          open={Boolean(scheduleTarget)}
          onClose={() => setScheduleTarget(null)}
          orgId={org.id}
          jobId={scheduleTarget.job_id}
          applicationId={scheduleTarget.id}
          candidateLabel={scheduleTarget.label}
          onSuccess={() => {
            setScheduleTarget(null);
            showToast('Interview scheduled successfully. Candidate moved to Interviewing.');
            applicantsRes.reload();
          }}
        />
      )}

      {/* Inline Create Offer Modal */}
      {offerTarget && (
        <CreateOfferModal
          open={Boolean(offerTarget)}
          onClose={() => setOfferTarget(null)}
          orgId={org.id}
          jobId={offerTarget.job_id}
          jobTitle={offerTarget.context?.title || 'Job Offer'}
          applicationId={offerTarget.id}
          candidateLabel={offerTarget.label}
          defaultCurrency={offerTarget.currency || 'INR'}
          defaultExpectedSalary={offerTarget.salary_expectation}
          onSuccess={(createdOffer) => {
            setOfferTarget(null);
            showToast('Draft offer created successfully.');
            applicantsRes.reload();
            router.push(`/employer/offers/${createdOffer.id}`);
          }}
        />
      )}

      <SafetyStrip />
    </div>
  );
}

export default function CandidatesWorkbenchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#4A5568]">Loading Candidate Workbench…</div>}>
      <JobsPage activeNav="/employer/candidates">
        <CandidatesWorkbenchContent />
      </JobsPage>
    </Suspense>
  );
}
