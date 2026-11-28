'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, FileText, Plus, X } from 'lucide-react';
import { Btn, Card } from '../../../components';
import { api } from '@/lib/api/client';
import {
  EmptyState,
  ErrorState,
  INTERVIEW_FORMAT_OPTIONS,
  LoadingState,
  RECOMMENDATION_OPTIONS,
  ViewerRestrictedState,
  errorMessage,
  extractFieldErrors,
  formatDate,
  formatDateTime,
  formatMoney,
} from './startup-hiring-shared';

export function ScheduleInterviewModal({
  orgId,
  initialJobId = '',
  initialApplicationId = '',
  onClose,
  onScheduled,
  notify,
}) {
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(initialJobId);
  const [applicants, setApplicants] = useState([]);
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [members, setMembers] = useState([]);
  const [panelistIds, setPanelistIds] = useState([]);
  const [dateVal, setDateVal] = useState('');
  const [timeVal, setTimeVal] = useState('11:00');
  const [durationMin, setDurationMin] = useState(45);
  const [roundName, setRoundName] = useState('Technical interview');
  const [format, setFormat] = useState('video');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.jobs.list(orgId, { limit: 100 }, controller.signal),
      api.organizations.members(orgId, { limit: 100, status: 'active' }),
    ])
      .then(([jobsRes, membersRes]) => {
        if (controller.signal.aborted) return;
        const jobItems = (jobsRes.items || []).filter((j) => j.status === 'open' || j.id === initialJobId);
        setJobs(jobItems);
        if (!initialJobId && jobItems.length > 0) setJobId(jobItems[0].id);
        const eligible = (membersRes.items || []).filter((m) => m.role !== 'viewer');
        setMembers(eligible);
        if (eligible.length > 0) setPanelistIds([eligible[0].user_id]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [orgId, initialJobId]);

  useEffect(() => {
    if (!jobId) {
      setApplicants([]);
      return;
    }
    const controller = new AbortController();
    api.applicants
      .list(orgId, jobId, { limit: 100 }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const items = res.items || [];
        setApplicants(items);
        if (!initialApplicationId && items.length > 0) {
          setApplicationId(items[0].id);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [orgId, jobId, initialApplicationId]);

  const togglePanelist = (uid) => {
    setPanelistIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    setFieldErrors({});
    try {
      const scheduledAt = new Date(`${dateVal}T${timeVal}:00`).toISOString();
      await api.interviews.schedule(orgId, jobId, applicationId, {
        round_name: roundName.trim() || null,
        format,
        scheduled_at: scheduledAt,
        duration_min: Number(durationMin) || 45,
        meeting_url: meetingUrl.trim() || null,
        interviewer_ids: panelistIds,
      });
      notify('Interview scheduled.');
      onScheduled?.();
      onClose();
    } catch (e2) {
      setFieldErrors(extractFieldErrors(e2));
      setErr(errorMessage(e2, 'Could not schedule interview.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="serif text-2xl font-semibold">Schedule interview</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {err && (
          <p className="mb-3 rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#991B1B]">{err}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!initialJobId && (
            <label className="block text-sm">
              Job
              <select
                required
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value);
                  setApplicationId('');
                }}
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
              >
                <option value="">Select job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!initialApplicationId && (
            <label className="block text-sm">
              Candidate
              <select
                required
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
              >
                <option value="">Select candidate…</option>
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.is_blind ? a.label : a.profile?.full_name || a.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Date
              <input
                required
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
              />
            </label>
            <label className="text-sm">
              Time
              <input
                required
                type="time"
                value={timeVal}
                onChange={(e) => setTimeVal(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
              />
            </label>
          </div>
          {fieldErrors.scheduled_at && (
            <small className="block text-xs text-[#B42318]">{fieldErrors.scheduled_at}</small>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Round
              <input
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
              />
            </label>
            <label className="text-sm">
              Format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
              >
                {INTERVIEW_FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Duration (min)
              <input
                type="number"
                min="15"
                max="240"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
              />
            </label>
            <label className="text-sm">
              Meeting link (https://)
              <input
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.example.com/..."
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
              />
            </label>
          </div>
          {fieldErrors.meeting_url && (
            <small className="block text-xs text-[#B42318]">{fieldErrors.meeting_url}</small>
          )}

          <div>
            <p className="text-sm font-medium">Interviewers</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {members.map((m) => {
                const active = panelistIds.includes(m.user_id);
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => togglePanelist(m.user_id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      active
                        ? 'border-ink bg-ink text-white'
                        : 'border-[#E5E1D8] bg-white text-[#4A5568]'
                    }`}
                  >
                    {m.full_name || m.email}
                  </button>
                );
              })}
            </div>
            {fieldErrors.interviewer_ids && (
              <small className="mt-1 block text-xs text-[#B42318]">
                {fieldErrors.interviewer_ids}
              </small>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="min-h-10 px-4 text-sm">
              Cancel
            </button>
            <Btn type="submit" disabled={saving || !jobId || !applicationId || panelistIds.length === 0}>
              {saving ? 'Scheduling…' : 'Send invite'}
            </Btn>
          </div>
        </form>
      </section>
    </div>
  );
}

export function StartupInterviewsView({ org, myRole, pageHead, notify }) {
  const isReviewer = myRole === 'owner' || myRole === 'admin' || myRole === 'member';
  const [eventTab, setEventTab] = useState('Upcoming');
  const [state, setState] = useState('loading');
  const [err, setErr] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState([]);

  const [showSchedule, setShowSchedule] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00');
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [recommendation, setRecommendation] = useState('yes');
  const [summary, setSummary] = useState('');

  const windowParam = useMemo(() => {
    if (eventTab === 'Needs feedback') return 'needs_feedback';
    if (eventTab === 'Past') return 'past';
    return 'upcoming';
  }, [eventTab]);

  const loadList = useCallback(
    async (signal) => {
      const res = await api.interviews.list(
        org.id,
        { window: windowParam, limit: 50 },
        signal
      );
      if (!signal?.aborted) setItems(res.items || []);
    },
    [org.id, windowParam]
  );

  useEffect(() => {
    if (!isReviewer) {
      setState('ready');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    setErr('');
    loadList(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setState('ready');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setErr(errorMessage(e, 'Could not load interviews.'));
        setState('error');
      });
    return () => controller.abort();
  }, [isReviewer, loadList, reloadKey]);

  const handleComplete = async (iv) => {
    try {
      await api.interviews.complete(org.id, iv.id);
      notify('Interview marked completed.');
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify(errorMessage(e, 'Could not complete interview.'));
    }
  };

  const handleCancel = async (iv) => {
    try {
      await api.interviews.cancel(org.id, iv.id, { reason: 'Cancelled by startup team' });
      notify('Interview cancelled.');
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify(errorMessage(e, 'Could not cancel interview.'));
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    try {
      const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
      await api.interviews.patch(org.id, rescheduleTarget.id, { scheduled_at: scheduledAt });
      setRescheduleTarget(null);
      notify('Interview rescheduled.');
      setReloadKey((k) => k + 1);
    } catch (e2) {
      notify(errorMessage(e2, 'Could not reschedule interview.'));
    }
  };

  const handleFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackTarget) return;
    try {
      await api.interviews.putFeedback(org.id, feedbackTarget.id, {
        recommendation,
        summary: summary.trim(),
      });
      setFeedbackTarget(null);
      setSummary('');
      notify('Feedback submitted.');
      setReloadKey((k) => k + 1);
    } catch (e2) {
      notify(errorMessage(e2, 'Could not submit feedback.'));
    }
  };

  if (!isReviewer) {
    return (
      <>
        {pageHead('Interviews', 'Plan conversations and close the feedback loop.')}
        <ViewerRestrictedState message="Viewers cannot access interview schedules." />
      </>
    );
  }

  return (
    <>
      {pageHead(
        'Interviews',
        'Plan conversations, keep the team aligned and close the feedback loop.',
        <Btn onClick={() => setShowSchedule(true)}>
          <Plus size={16} /> Schedule interview
        </Btn>
      )}

      <div className="mb-5 flex gap-2">
        {['Upcoming', 'Needs feedback', 'Past'].map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setEventTab(x)}
            className={`min-h-10 rounded-lg px-4 text-xs ${
              eventTab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      {state === 'loading' ? (
        <LoadingState label="Loading interviews…" />
      ) : state === 'error' ? (
        <ErrorState message={err} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          title={`No ${eventTab.toLowerCase()} interviews`}
          description="Schedule an interview from here or from a candidate's detail page."
        />
      ) : (
        <div className="space-y-3">
          {items.map((iv) => {
            const interviewers = (iv.participants || [])
              .filter((p) => p.side === 'interviewer')
              .map((p) => p.display_name)
              .join(', ');
            return (
              <article
                key={iv.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E5E1D8] bg-white p-4"
              >
                <div className="min-w-[155px] rounded-lg bg-[#F3EBDD] p-3 text-center">
                  <CalendarDays className="mx-auto mb-1 text-[#806236]" size={18} />
                  <b className="text-xs">{formatDateTime(iv.scheduled_at)}</b>
                  <small className="mt-1 block text-[10px] text-[#4A5568]">
                    {iv.duration_min} min · {iv.format}
                  </small>
                </div>
                <div className="min-w-[180px] flex-1">
                  <Link
                    href={`/startup/hiring/${iv.job_id}/applicants/${iv.application_id}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {iv.candidate_label}
                  </Link>
                  <p className="mt-1 text-xs text-[#4A5568]">
                    {iv.round_name || 'Interview'} · {iv.job_title}
                  </p>
                  <p className="mt-1 text-[10px] text-[#4A5568]">
                    Interviewers: {interviewers || '—'}
                  </p>
                </div>
                <span className="rounded-full bg-[#E7F3EC] px-2.5 py-1 text-[10px] font-semibold text-[#286749]">
                  {iv.status}
                </span>
                {(iv.status === 'scheduled' || iv.status === 'confirmed') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRescheduleTarget(iv);
                        setRescheduleDate(iv.scheduled_at.slice(0, 10));
                      }}
                      className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => handleComplete(iv)}
                      className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(iv)}
                      className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#B42318]"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {iv.needs_my_feedback && (
                  <button
                    type="button"
                    onClick={() => setFeedbackTarget(iv)}
                    className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
                  >
                    Submit feedback
                  </button>
                )}
                {iv.meeting_url && (iv.status === 'scheduled' || iv.status === 'confirmed') && (
                  <a
                    href={iv.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
                  >
                    Join
                  </a>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showSchedule && (
        <ScheduleInterviewModal
          orgId={org.id}
          onClose={() => setShowSchedule(false)}
          onScheduled={() => setReloadKey((k) => k + 1)}
          notify={notify}
        />
      )}

      {rescheduleTarget && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="serif text-xl font-semibold">Reschedule interview</h2>
            <form onSubmit={handleReschedule} className="mt-4 space-y-3">
              <label className="block text-sm">
                New date
                <input
                  required
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                />
              </label>
              <label className="block text-sm">
                New time
                <input
                  required
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setRescheduleTarget(null)} className="px-3 text-sm">
                  Cancel
                </button>
                <Btn type="submit">Save</Btn>
              </div>
            </form>
          </section>
        </div>
      )}

      {feedbackTarget && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="serif text-xl font-semibold">Submit interview feedback</h2>
            <form onSubmit={handleFeedback} className="mt-4 space-y-3">
              <label className="block text-sm">
                Recommendation
                <select
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
                >
                  {RECOMMENDATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Summary
                <textarea
                  required
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Share structured observations…"
                  className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setFeedbackTarget(null)} className="px-3 text-sm">
                  Cancel
                </button>
                <Btn type="submit">Submit feedback</Btn>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export function StartupOffersView({ org, myRole, pageHead, notify }) {
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isReviewer = isAdmin || myRole === 'member';

  const [offerTab, setOfferTab] = useState('Sent');
  const [state, setState] = useState('loading');
  const [err, setErr] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [offers, setOffers] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [applicationId, setApplicationId] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [equityPct, setEquityPct] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!isReviewer) {
      setState('ready');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    setErr('');
    api.jobOffers
      .list(org.id, { limit: 100 }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setOffers(res.items || []);
        setState('ready');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setErr(errorMessage(e, 'Could not load offers.'));
        setState('error');
      });
    return () => controller.abort();
  }, [org.id, isReviewer, reloadKey]);

  useEffect(() => {
    if (!showCreate || !isAdmin) return;
    const controller = new AbortController();
    api.jobs
      .list(org.id, { limit: 100 }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const items = res.items || [];
        setJobs(items);
        if (items.length > 0 && !jobId) {
          setJobId(items[0].id);
          setOfferTitle(items[0].title);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [showCreate, isAdmin, org.id, jobId]);

  useEffect(() => {
    if (!showCreate || !jobId) return;
    const controller = new AbortController();
    api.applicants
      .list(org.id, jobId, { limit: 100 }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const items = res.items || [];
        setApplicants(items);
        if (items.length > 0) setApplicationId(items[0].id);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [showCreate, org.id, jobId]);

  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      if (offerTab === 'Draft') return o.status === 'draft';
      if (offerTab === 'Sent') return o.status === 'sent' || o.status === 'countered';
      if (offerTab === 'Accepted') return o.status === 'accepted';
      return o.status === 'declined' || o.status === 'expired' || o.status === 'withdrawn';
    });
  }, [offers, offerTab]);

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    setSaving(true);
    setCreateErr('');
    setFieldErrors({});
    try {
      await api.jobOffers.create(org.id, jobId, applicationId, {
        title: offerTitle.trim(),
        base_salary: baseSalary.trim(),
        equity_pct: equityPct.trim() ? equityPct.trim() : null,
        currency: 'INR',
        start_date: startDate,
        expires_on: expiresOn || null,
      });
      setShowCreate(false);
      notify('Offer draft created.');
      setOfferTab('Draft');
      setReloadKey((k) => k + 1);
    } catch (e2) {
      setFieldErrors(extractFieldErrors(e2));
      setCreateErr(errorMessage(e2, 'Could not create offer.'));
    } finally {
      setSaving(false);
    }
  };

  const handleOfferAction = async (offerId, actionName, msg) => {
    try {
      await api.jobOffers[actionName](offerId);
      notify(msg);
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify(errorMessage(e, 'Could not update offer.'));
    }
  };

  if (!isReviewer) {
    return (
      <>
        {pageHead('Offers', 'Prepare thoughtful offers and keep every candidate informed.')}
        <ViewerRestrictedState message="Viewers cannot access job offers." />
      </>
    );
  }

  return (
    <>
      {pageHead(
        'Offers',
        'Prepare thoughtful offers and keep every candidate informed.',
        isAdmin && (
          <Btn onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create offer
          </Btn>
        )
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {['Draft', 'Sent', 'Accepted', 'Declined / Expired'].map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setOfferTab(x)}
            className={`min-h-10 rounded-lg px-3 text-xs ${
              offerTab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      {state === 'loading' ? (
        <LoadingState label="Loading offers…" />
      ) : state === 'error' ? (
        <ErrorState message={err} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <Card title={`${offerTab} offers`}>
          {filteredOffers.length === 0 ? (
            <div className="py-10 text-center">
              <FileText className="mx-auto mb-3 text-[#A0A7B4]" />
              <p className="text-sm font-semibold">No {offerTab.toLowerCase()} offers</p>
              <p className="mt-1 text-xs text-[#4A5568]">
                Offers created for candidates will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-xs">
                <thead className="border-b text-[#4A5568]">
                  <tr>
                    {['Candidate', 'Job', 'Compensation', 'Start date', 'Status', 'Expires', 'Owner', ''].map(
                      (h) => (
                        <th key={h} className="py-3">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredOffers.map((o) => (
                    <tr key={o.id} className="border-b border-[#E5E1D8]">
                      <td className="py-4 font-semibold">{o.candidate_name || 'Blinded candidate'}</td>
                      <td className="py-4">{o.job_title}</td>
                      <td className="py-4">
                        {formatMoney(o.base_salary, o.currency)}
                        {o.equity_pct ? ` + ${o.equity_pct}% equity` : ''}
                      </td>
                      <td className="py-4">{formatDate(o.start_date)}</td>
                      <td className="py-4 capitalize">{o.status}</td>
                      <td className="py-4">{formatDate(o.expires_on)}</td>
                      <td className="py-4">{o.owner_name || '—'}</td>
                      <td className="py-4 text-right">
                        {isAdmin && o.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleOfferAction(o.id, 'send', 'Offer sent.')}
                            className="mr-3 font-semibold text-[#9A7A45]"
                          >
                            Send
                          </button>
                        )}
                        {isAdmin && (o.status === 'draft' || o.status === 'sent') && (
                          <button
                            type="button"
                            onClick={() => handleOfferAction(o.id, 'withdraw', 'Offer withdrawn.')}
                            className="text-[#B42318]"
                          >
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">
            Review offer letters and contract terms with legal counsel.
          </p>
        </Card>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold">Create offer</h2>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {createErr && (
              <p className="mb-3 rounded-lg bg-[#FEF2F2] p-2.5 text-xs text-[#991B1B]">{createErr}</p>
            )}
            <form onSubmit={handleCreateOffer} className="space-y-3">
              <label className="block text-sm">
                Job
                <select
                  required
                  value={jobId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setJobId(nextId);
                    const found = jobs.find((j) => j.id === nextId);
                    if (found) setOfferTitle(found.title);
                  }}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                Candidate
                <select
                  required
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
                >
                  {applicants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.is_blind ? a.label : a.profile?.full_name || a.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                Offer title
                <input
                  required
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                />
                {fieldErrors.title && (
                  <small className="mt-1 block text-xs text-[#B42318]">{fieldErrors.title}</small>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Base salary (INR)
                  <input
                    required
                    type="number"
                    min="1"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="1800000"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                  />
                  {fieldErrors.base_salary && (
                    <small className="mt-1 block text-xs text-[#B42318]">
                      {fieldErrors.base_salary}
                    </small>
                  )}
                </label>
                <label className="text-sm">
                  Equity % (optional)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={equityPct}
                    onChange={(e) => setEquityPct(e.target.value)}
                    placeholder="0.50"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Start date
                  <input
                    required
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                  />
                </label>
                <label className="text-sm">
                  Offer expires
                  <input
                    type="date"
                    value={expiresOn}
                    onChange={(e) => setExpiresOn(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 text-sm">
                  Cancel
                </button>
                <Btn type="submit" disabled={saving || !applicationId}>
                  {saving ? 'Saving…' : 'Save offer draft'}
                </Btn>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
