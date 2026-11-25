'use client';

import React, { useEffect, useState, Suspense } from 'react';
import {
  EmployerShell,
  EmployerBtn,
  EmployerCard,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError, fieldErrorsFrom } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { CheckCircle2, Plus, Video, X } from 'lucide-react';

const formatLabel = (format) =>
  ({ video: 'Video', phone: 'Phone', onsite: 'On-site', async: 'Async' })[format] || format;

const statusChip = (status) =>
  ({ scheduled: 'Scheduled', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No show', rescheduled: 'Rescheduled' })[status] || status;

const whenLabel = (iso) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
};

const toLocalInput = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const tomorrow = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const LIVE = ['scheduled', 'confirmed'];

function InterviewsContent() {
  const { org } = useJobsWorkspace();
  const { user } = useAuth();
  const isViewer = org.my_role === 'viewer';
  // D5: owner/admin may act on any interview; a member only on jobs they own.
  const canLifecycle = (item) => {
    if (['owner', 'admin'].includes(org.my_role)) return true;
    const job = (jobsRes.data?.items || []).find((j) => j.id === item.job_id);
    return Boolean(job && user && job.owner_id === user.id);
  };

  const [activeTab, setActiveTab] = useState('Upcoming');
  const [toastMessage, setToastMessage] = useState(null);

  const upcomingRes = useCareerResource(
    `interviews-upcoming:${org.id}`,
    (signal) =>
      isViewer
        ? Promise.resolve(null)
        : api.interviews.list(org.id, { window: 'upcoming', limit: 50 }, signal)
  );
  const needsRes = useCareerResource(
    `interviews-needs:${org.id}`,
    (signal) =>
      isViewer
        ? Promise.resolve(null)
        : api.interviews.list(org.id, { needs_feedback: true, limit: 50 }, signal)
  );
  const pastRes = useCareerResource(
    `interviews-past:${org.id}`,
    (signal) =>
      isViewer ? Promise.resolve(null) : api.interviews.list(org.id, { window: 'past', limit: 50 }, signal)
  );
  const jobsRes = useCareerResource(
    `interview-schedule-jobs:${org.id}`,
    (signal) => (isViewer ? Promise.resolve(null) : api.jobs.list(org.id, { limit: 100 }, signal))
  );
  const membersRes = useCareerResource(
    `interview-schedule-members:${org.id}`,
    (signal) =>
      isViewer
        ? Promise.resolve(null)
        : api.organizations.members(org.id, { limit: 100, status: 'active' }, signal)
  );

  const reloadAll = () => {
    upcomingRes.reload();
    needsRes.reload();
    pastRes.reload();
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedJob, setSchedJob] = useState('');
  const [schedApplication, setSchedApplication] = useState('');
  const [schedRound, setSchedRound] = useState('Technical Panel');
  const [schedFormat, setSchedFormat] = useState('video');
  const [schedDate, setSchedDate] = useState(tomorrow);
  const [schedTime, setSchedTime] = useState('14:30');
  const [schedPanelists, setSchedPanelists] = useState([]);
  const [schedErrors, setSchedErrors] = useState({});
  const [schedError, setSchedError] = useState('');
  const [schedBusy, setSchedBusy] = useState(false);
  const [applicants, setApplicants] = useState({ items: [], loading: false, error: '' });

  const openJobs = (jobsRes.data?.items || []).filter((j) => j.status === 'open');

  useEffect(() => {
    if (!showScheduleModal || !schedJob) {
      setApplicants({ items: [], loading: false, error: '' });
      setSchedApplication('');
      return undefined;
    }
    const controller = new AbortController();
    setApplicants({ items: [], loading: true, error: '' });
    api.applicants
      .list(org.id, schedJob, { limit: 100 }, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setApplicants({ items: page.items, loading: false, error: '' });
          setSchedApplication((prev) => (page.items.some((a) => a.id === prev) ? prev : page.items[0]?.id || ''));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setApplicants({ items: [], loading: false, error: error instanceof ApiError ? error.message : 'Could not load applicants.' });
        }
      });
    return () => controller.abort();
  }, [showScheduleModal, schedJob, org.id]);

  // Feedback modal state
  const [feedbackItem, setFeedbackItem] = useState(null);
  const [fbRecommendation, setFbRecommendation] = useState('yes');
  const [fbSummary, setFbSummary] = useState('');
  const [fbErrors, setFbErrors] = useState({});
  const [fbError, setFbError] = useState('');
  const [fbBusy, setFbBusy] = useState(false);

  // Reschedule modal state
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [rescheduleWhen, setRescheduleWhen] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleErrors, setRescheduleErrors] = useState({});
  const [rescheduleBusy, setRescheduleBusy] = useState(false);

  const openSchedule = () => {
    setSchedErrors({});
    setSchedError('');
    setShowScheduleModal(true);
  };

  const handleCreateInterview = async (e) => {
    e.preventDefault();
    setSchedErrors({});
    setSchedError('');
    if (!schedApplication) {
      setSchedError('Pick a job with at least one applicant to schedule against.');
      return;
    }
    if (schedPanelists.length === 0) {
      setSchedErrors({ interviewer_ids: 'Select at least one panelist.' });
      return;
    }
    setSchedBusy(true);
    try {
      const when = new Date(`${schedDate}T${schedTime}`);
      await api.interviews.schedule(org.id, schedJob, schedApplication, {
        round_name: schedRound,
        format: schedFormat,
        scheduled_at: when.toISOString(),
        duration_min: 45,
        interviewer_ids: schedPanelists,
      });
      setShowScheduleModal(false);
      setSchedPanelists([]);
      showToast('Interview scheduled.');
      reloadAll();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setSchedErrors(fieldErrorsFrom(error));
      }
      setSchedError(error instanceof ApiError ? error.message : 'Could not schedule the interview. Please try again.');
    } finally {
      setSchedBusy(false);
    }
  };

  const handleScorecardSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackItem) return;
    setFbErrors({});
    setFbError('');
    setFbBusy(true);
    try {
      await api.interviews.putFeedback(org.id, feedbackItem.id, {
        recommendation: fbRecommendation,
        summary: fbSummary,
      });
      setFeedbackItem(null);
      setFbSummary('');
      showToast('Scorecard submitted.');
      reloadAll();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setFbErrors(fieldErrorsFrom(error));
      setFbError(error instanceof ApiError ? error.message : 'Could not submit the scorecard. Please try again.');
    } finally {
      setFbBusy(false);
    }
  };

  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleItem) return;
    setRescheduleErrors({});
    setRescheduleError('');
    setRescheduleBusy(true);
    try {
      await api.interviews.patch(org.id, rescheduleItem.id, {
        scheduled_at: new Date(rescheduleWhen).toISOString(),
      });
      setRescheduleItem(null);
      showToast('Interview rescheduled. Panel responses were reset.');
      reloadAll();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setRescheduleErrors(fieldErrorsFrom(error));
      setRescheduleError(error instanceof ApiError ? error.message : 'Could not reschedule. Please try again.');
    } finally {
      setRescheduleBusy(false);
    }
  };

  const runLifecycle = async (item, action, successMsg) => {
    try {
      if (action === 'cancel') await api.interviews.cancel(org.id, item.id, {});
      else await api.interviews.complete(org.id, item.id);
      showToast(successMsg);
      reloadAll();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'The action failed. Please try again.');
    }
  };

  const togglePanelist = (userId) =>
    setSchedPanelists((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );

  const upcoming = upcomingRes.data?.items || [];
  const needs = needsRes.data?.items || [];
  const past = pastRes.data?.items || [];
  const listRes = activeTab === 'Upcoming' ? upcomingRes : activeTab === 'Needs feedback' ? needsRes : pastRes;
  const items = activeTab === 'Upcoming' ? upcoming : activeTab === 'Needs feedback' ? needs : past;

  // Weekly metrics, computed from the loaded lists (never invented).
  const weekStart = (() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7; // Monday-first
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d;
  })();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const thisWeek = upcoming.filter((i) => {
    const t = new Date(i.scheduled_at);
    return t >= weekStart && t < weekEnd;
  });
  const awaitingConfirmation = upcoming.filter((i) => {
    const candidate = i.participants.find((p) => p.side === 'candidate');
    return candidate && candidate.response === null;
  }).length;

  const renderCard = (item, { showFeedbackButton = false, showLifecycle = false } = {}) => {
    const { date, time } = whenLabel(item.scheduled_at);
    const panelists = item.participants
      .filter((p) => p.side === 'interviewer')
      .map((p) => p.display_name);
    return (
      <div
        key={item.id}
        className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:border-[#B8955A] space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E5E1D8] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-sm font-bold text-[#0F1B2D]">
              {date} · {time}
            </span>
            <StageChip stage={statusChip(item.status)} />
          </div>
          <div className="flex items-center gap-2">
            {item.meeting_url && LIVE.includes(item.status) && (
              <EmployerBtn
                primary
                small
                onClick={() => window.open(item.meeting_url, '_blank', 'noopener,noreferrer')}
              >
                <Video size={14} className="mr-1.5" /> Join Room
              </EmployerBtn>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#4A5568]">
          <div>
            <h3 className="font-serif text-base font-bold text-[#0F1B2D]">{item.candidate_label}</h3>
            <p className="mt-0.5">
              {item.job_title} · <span className="font-medium text-[#806236]">{item.round_name || 'Interview'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded bg-[#FAF8F4] px-2 py-1 text-[#0F1B2D]">
              {formatLabel(item.format)} · {item.duration_min} min
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E1D8] pt-3 text-xs text-[#4A5568]">
          <span>Panelists: {panelists.length > 0 ? panelists.join(', ') : 'None assigned'}</span>
          <div className="flex items-center gap-3">
            {showFeedbackButton && (
              <button
                type="button"
                onClick={() => {
                  setFbErrors({});
                  setFbError('');
                  setFbSummary('');
                  setFeedbackItem(item);
                }}
                className="text-[#806236] font-semibold hover:underline"
              >
                Submit Scorecard
              </button>
            )}
            {showLifecycle && LIVE.includes(item.status) && canLifecycle(item) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleErrors({});
                    setRescheduleError('');
                    setRescheduleWhen(toLocalInput(item.scheduled_at));
                    setRescheduleItem(item);
                  }}
                  className="text-[#806236] hover:underline"
                >
                  Reschedule
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => runLifecycle(item, 'complete', 'Interview marked completed.')}
                  className="text-[#806236] hover:underline"
                >
                  Mark completed
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Cancel this interview? The panel and candidate will see it as cancelled.')) {
                      runLifecycle(item, 'cancel', 'Interview cancelled.');
                    }
                  }}
                  className="text-[#B42318] hover:underline"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderList = (list, opts) => {
    if (listRes.loading && !listRes.data) return <LoadingBlock label="Loading interviews…" />;
    if (listRes.error)
      return (
        <ErrorBlock
          message={
            listRes.error instanceof ApiError ? listRes.error.message : 'Could not load interviews.'
          }
          onRetry={listRes.reload}
        />
      );
    if (list.length === 0)
      return (
        <EmptyBlock
          title={
            activeTab === 'Upcoming'
              ? 'No upcoming interviews'
              : activeTab === 'Needs feedback'
                ? 'No scorecards pending'
                : 'No past interviews'
          }
          hint={
            activeTab === 'Upcoming'
              ? 'Scheduled and confirmed interviews for your open pipelines will appear here.'
              : activeTab === 'Needs feedback'
                ? 'When a panel interview you sat on is completed, your scorecard will appear here.'
                : 'Completed and cancelled interviews will appear here.'
          }
        />
      );
    return <div className="space-y-4">{list.map((item) => renderCard(item, opts))}</div>;
  };

  if (isViewer) {
    return (
      <EmployerShell active="/employer/interviews">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]">
            Viewers cannot access interview schedules.
          </div>
        </div>
      </EmployerShell>
    );
  }

  return (
    <EmployerShell active="/employer/interviews">
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

      {/* Schedule Interview Modal */}
      {showScheduleModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="schedule-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                Schedule Candidate Interview
              </h3>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateInterview} className="mt-4 space-y-4">
              {schedError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {schedError}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sched-job" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Job Position
                  </label>
                  <select
                    id="sched-job"
                    value={schedJob}
                    onChange={(e) => setSchedJob(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="">Select a job…</option>
                    {openJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                  {jobsRes.error && <FieldError>Could not load jobs.</FieldError>}
                </div>
                <div>
                  <label htmlFor="sched-app" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Applicant
                  </label>
                  <select
                    id="sched-app"
                    value={schedApplication}
                    onChange={(e) => setSchedApplication(e.target.value)}
                    required
                    disabled={!schedJob || applicants.loading}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none disabled:bg-[#FAF8F4]"
                  >
                    <option value="">
                      {applicants.loading ? 'Loading applicants…' : 'Select an applicant…'}
                    </option>
                    {applicants.items.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  {applicants.error && <FieldError>{applicants.error}</FieldError>}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sched-round" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Interview Round
                  </label>
                  <select
                    id="sched-round"
                    value={schedRound}
                    onChange={(e) => setSchedRound(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="Initial Recruiter Screen">Recruiter Screen (30 min)</option>
                    <option value="Technical Panel">Technical Panel (60 min)</option>
                    <option value="Portfolio Walkthrough">Portfolio Walkthrough (45 min)</option>
                    <option value="Executive / Founder Fit">Executive / Founder Fit (45 min)</option>
                  </select>
                  <FieldError>{schedErrors.round_name}</FieldError>
                </div>
                <div>
                  <label htmlFor="sched-format" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Interview Format
                  </label>
                  <select
                    id="sched-format"
                    value={schedFormat}
                    onChange={(e) => setSchedFormat(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="video">Video call</option>
                    <option value="phone">Phone / audio only</option>
                    <option value="onsite">On-site</option>
                    <option value="async">Async (take-home)</option>
                  </select>
                  <FieldError>{schedErrors.format}</FieldError>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sched-date" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Date
                  </label>
                  <input
                    id="sched-date"
                    type="date"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                  <FieldError>{schedErrors.scheduled_at}</FieldError>
                </div>
                <div>
                  <label htmlFor="sched-time" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Time
                  </label>
                  <input
                    id="sched-time"
                    type="time"
                    required
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#0F1B2D] mb-1">Panelists</span>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#E5E1D8] p-2 space-y-1">
                  {(membersRes.data?.items || [])
                    .filter((m) => m.role !== 'viewer')
                    .map((m) => (
                      <label key={m.user_id} className="flex items-center gap-2 text-xs text-[#0F1B2D]">
                        <input
                          type="checkbox"
                          className="accent-ink"
                          checked={schedPanelists.includes(m.user_id)}
                          onChange={() => togglePanelist(m.user_id)}
                        />
                        {m.display_name} ({m.role})
                      </label>
                    ))}
                  {membersRes.error && <FieldError>Could not load team members.</FieldError>}
                </div>
                <FieldError>{schedErrors.interviewer_ids}</FieldError>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn secondary small onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" primary small disabled={schedBusy}>
                  Send Calendar Invite
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reschedule-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="reschedule-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                Reschedule Interview
              </h3>
              <button
                type="button"
                onClick={() => setRescheduleItem(null)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmReschedule} className="mt-4 space-y-4">
              {rescheduleError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {rescheduleError}
                </div>
              )}
              <p className="text-xs text-[#4A5568]">
                Rescheduling interview with{' '}
                <span className="font-semibold text-[#0F1B2D]">{rescheduleItem.candidate_label}</span> for{' '}
                <span className="font-semibold text-[#0F1B2D]">{rescheduleItem.round_name || 'Interview'}</span>.
                Panel responses reset when the slot moves.
              </p>
              <div>
                <label htmlFor="new-when" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  New Date & Time
                </label>
                <input
                  id="new-when"
                  type="datetime-local"
                  required
                  value={rescheduleWhen}
                  onChange={(e) => setRescheduleWhen(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
                <FieldError>{rescheduleErrors.scheduled_at}</FieldError>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn secondary small onClick={() => setRescheduleItem(null)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" primary small disabled={rescheduleBusy}>
                  Confirm Reschedule
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scorecard Modal */}
      {feedbackItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="scorecard-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <div>
                <h3 id="scorecard-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                  Submit Interview Scorecard
                </h3>
                <p className="text-xs text-[#4A5568]">
                  {feedbackItem.candidate_label} · {feedbackItem.round_name || 'Interview'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackItem(null)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleScorecardSubmit} className="mt-4 space-y-4">
              {fbError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {fbError}
                </div>
              )}
              <div>
                <label htmlFor="sc-recommendation" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Overall Panel Recommendation
                </label>
                <select
                  id="sc-recommendation"
                  value={fbRecommendation}
                  onChange={(e) => setFbRecommendation(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                >
                  <option value="strong_yes">Strong Yes (Advance to next round)</option>
                  <option value="yes">Yes, with reservations</option>
                  <option value="no">No (Decline candidate)</option>
                  <option value="strong_no">Strong No (Decline)</option>
                </select>
                <FieldError>{fbErrors.recommendation}</FieldError>
              </div>

              <div>
                <label htmlFor="sc-comments" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Detailed Notes & Observations
                </label>
                <textarea
                  id="sc-comments"
                  rows={4}
                  required
                  value={fbSummary}
                  onChange={(e) => setFbSummary(e.target.value)}
                  placeholder="Summarize candidate answers, problem solving approach, and strengths..."
                  className="w-full rounded-lg border border-[#E5E1D8] p-2.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
                <FieldError>{fbErrors.summary}</FieldError>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn secondary small onClick={() => setFeedbackItem(null)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" primary small disabled={fbBusy}>
                  Submit Scorecard
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
              Interview Management
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5568]">
              Track interview schedules, submit scorecards, and keep hiring panels synchronized.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EmployerBtn primary small onClick={openSchedule}>
              <Plus size={14} className="mr-1.5" /> Schedule interview
            </EmployerBtn>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 border-b border-[#E5E1D8] pb-2 overflow-x-auto">
          {['Upcoming', 'Needs feedback', 'Past', 'Calendar View'].map((tab) => {
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
                {tab === 'Needs feedback'
                  ? `Needs Feedback (${needsRes.data?.total ?? '…'})`
                  : tab}
              </button>
            );
          })}
        </div>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-12 min-w-0">
          {/* Main Interview Area */}
          <div className="lg:col-span-8 space-y-4 min-w-0">
            {activeTab === 'Upcoming' && renderList(upcoming, { showLifecycle: true })}
            {activeTab === 'Needs feedback' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed">
                  <p className="font-semibold mb-0.5">Prompt Feedback Policy</p>
                  <p>
                    Please submit your scorecard within 24 hours of completing the interview to ensure fair and
                    timely communication with candidates.
                  </p>
                </div>
                {renderList(needs, { showFeedbackButton: true })}
              </div>
            )}
            {activeTab === 'Past' && renderList(past, {})}
            {activeTab === 'Calendar View' && (
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3 text-xs">
                  <span className="font-bold text-[#0F1B2D]">
                    Week of{' '}
                    {weekStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} –{' '}
                    {new Date(weekEnd.getTime() - 1).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-[#4A5568]">Local timezone</span>
                </div>
                {upcomingRes.loading && !upcomingRes.data ? (
                  <LoadingBlock label="Loading calendar…" rows={1} />
                ) : upcomingRes.error ? (
                  <ErrorBlock
                    message={
                      upcomingRes.error instanceof ApiError
                        ? upcomingRes.error.message
                        : 'Could not load interviews.'
                    }
                    onRetry={upcomingRes.reload}
                  />
                ) : (
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    {Array.from({ length: 5 }, (_, idx) => {
                      const day = new Date(weekStart);
                      day.setDate(weekStart.getDate() + idx);
                      const dayEnd = new Date(day);
                      dayEnd.setDate(day.getDate() + 1);
                      const dayItems = upcoming.filter((i) => {
                        const t = new Date(i.scheduled_at);
                        return t >= day && t < dayEnd;
                      });
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3 space-y-2 min-h-[96px] text-left"
                        >
                          <span className="font-bold text-[#0F1B2D] block text-center">
                            {day.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit' })}
                          </span>
                          {dayItems.map((i) => (
                            <div
                              key={i.id}
                              className="rounded-lg bg-emerald-100 p-2 text-[11px] text-emerald-900"
                            >
                              <p className="font-semibold">{whenLabel(i.scheduled_at).time}</p>
                              <p className="truncate">{i.candidate_label}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Summary Sidebar */}
          <div className="lg:col-span-4 space-y-6 min-w-0">
            <EmployerCard title="Weekly Interview Metrics">
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#4A5568]">Interviews This Week:</span>
                  <span className="font-bold text-[#0F1B2D]">{thisWeek.length}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Awaiting Candidate Confirmation:</span>
                  <span className="font-bold text-[#806236]">{awaitingConfirmation}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Scorecards Pending:</span>
                  <span className="font-bold text-red-600">{needsRes.data?.total ?? '—'}</span>
                </div>
              </div>
            </EmployerCard>

            <SafetyStrip />
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}

export default function EmployerInterviewsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#4A5568]">Loading interviews...</div>}>
      <JobsPage>
        <InterviewsContent />
      </JobsPage>
    </Suspense>
  );
}
