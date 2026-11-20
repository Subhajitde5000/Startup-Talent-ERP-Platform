'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Video, FileText, CheckCircle2, ArrowRight, X } from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Btn, Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import {
  EmptyBlock,
  ErrorBlock,
  FieldError,
  LoadingBlock,
  fieldErrorsFrom,
} from '@/components/async-state';
import {
  SESSION_STATUS_CHIP,
  SESSION_STATUS_LABEL,
  formatDate,
  formatInstant,
  formatMoney,
} from '@/lib/mentorship-labels';

/** `2026-11-25T14:01:00Z` -> `2026-11-25` (IST), for a date input default. */
function istDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export default function MentorSessionDetailPage() {
  const params = useParams();
  const sessionId = params?.sessionId;

  const [toast, setToast] = useState('');
  const [meetingTab, setMeetingTab] = useState('Notes');
  const [sharedNotes, setSharedNotes] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const [session, setSession] = useState(null);
  const [mentorship, setMentorship] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading|ready|error|notfound
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  // --- summary (complete) form -------------------------------------------
  const [summary, setSummary] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [summaryErrs, setSummaryErrs] = useState({});
  const [summaryError, setSummaryError] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

  // --- reschedule dialog --------------------------------------------------
  const [reschedule, setReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('16:00');
  const [rescheduleErr, setRescheduleErr] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsPhase, setSlotsPhase] = useState('idle');
  const [savingReschedule, setSavingReschedule] = useState(false);

  const [busy, setBusy] = useState(false);

  const notify = useCallback((s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2700);
  }, []);

  useEffect(() => {
    if (!sessionId) return undefined;
    let alive = true;
    (async () => {
      setPhase('loading');
      setLoadError('');
      try {
        const data = await api.sessions.get(sessionId);
        if (!alive) return;
        setSession(data);
        setSummary(data.summary || '');
        setActionItems((data.action_items || []).join('\n'));
        setNewDate(istDateInput(data.scheduled_at));
        try {
          const m = await api.mentorships.get(data.mentorship_id);
          if (alive) setMentorship(m);
        } catch {
          // The session still renders without the startup's profile card;
          // the card hides itself rather than inventing details.
          if (alive) setMentorship(null);
        }
        if (alive) setPhase('ready');
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setPhase('notfound');
          return;
        }
        setLoadError(
          err instanceof ApiError ? err.message : 'Could not load this session.',
        );
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, reload]);

  // Bookable slots for rescheduling come from 8c (never a hand-written list).
  const mentorHandle = session?.viewer_side === 'mentor' ? null : mentorship?.mentor.handle;
  const myHandle = mentorship?.mentor.handle || null;
  useEffect(() => {
    if (!reschedule) return undefined;
    if (!myHandle) return undefined;
    let alive = true;
    (async () => {
      setSlotsPhase('loading');
      try {
        const data = await api.availability.slots(myHandle, { days: 28 });
        if (!alive) return;
        setSlots(data.items);
        setSlotsPhase('ready');
      } catch {
        if (!alive) return;
        setSlotsPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reschedule, myHandle]);

  void mentorHandle;

  const submitSummary = async () => {
    setSummaryErrs({});
    setSummaryError('');
    const items = actionItems
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    setSavingSummary(true);
    try {
      const updated = await api.sessions.complete(session.id, {
        summary: summary.trim(),
        action_items: items,
      });
      setSession(updated);
      notify('Summary submitted. Session marked completed.');
    } catch (err) {
      const fieldErrs = fieldErrorsFrom(err);
      if (Object.keys(fieldErrs).length) setSummaryErrs(fieldErrs);
      else
        setSummaryError(
          err instanceof ApiError ? err.message : 'Could not save the summary.',
        );
    } finally {
      setSavingSummary(false);
    }
  };

  const doConfirm = async () => {
    setBusy(true);
    try {
      const updated = await api.sessions.confirm(session.id);
      setSession(updated);
      notify('Session confirmed.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not confirm the session.');
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    const reason = window.prompt('Why is this session being cancelled?');
    if (!reason || reason.trim().length < 3) {
      notify('A cancellation reason of at least 3 characters is required.');
      return;
    }
    setBusy(true);
    try {
      const updated = await api.sessions.cancel(session.id, { reason: reason.trim() });
      setSession(updated);
      notify('Session cancelled.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not cancel the session.');
    } finally {
      setBusy(false);
    }
  };

  const submitReschedule = async () => {
    setRescheduleErr('');
    const iso = newDate && newTime ? new Date(`${newDate}T${newTime}:00+05:30`).toISOString() : null;
    if (!iso) {
      setRescheduleErr('Pick a date and time.');
      return;
    }
    setSavingReschedule(true);
    try {
      const updated = await api.sessions.reschedule(session.id, { scheduled_at: iso });
      setSession(updated);
      setReschedule(false);
      notify('Session moved to the new time.');
    } catch (err) {
      setRescheduleErr(
        err instanceof ApiError ? err.message : 'Could not reschedule the session.',
      );
    } finally {
      setSavingReschedule(false);
    }
  };

  const doNoShow = async () => {
    setBusy(true);
    try {
      const updated = await api.sessions.noShow(session.id, {});
      setSession(updated);
      notify('Session marked as a no-show.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update the session.');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <MentorPageShell active="Sessions" backHref="/mentor/sessions" backLabel="← Sessions" toast={toast} notify={notify}>
        <LoadingBlock label="Loading session…" rows={3} />
      </MentorPageShell>
    );
  }

  if (phase === 'notfound') {
    return (
      <MentorPageShell active="Sessions" backHref="/mentor/sessions" backLabel="← Sessions" toast={toast} notify={notify}>
        <EmptyBlock
          title="Session not found"
          hint="It may have been removed, or it belongs to a mentorship you are not part of."
        >
          <Link
            href="/mentor/sessions"
            className="rounded-lg bg-[#0F1B2D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
          >
            Back to sessions
          </Link>
        </EmptyBlock>
      </MentorPageShell>
    );
  }

  if (phase === 'error') {
    return (
      <MentorPageShell active="Sessions" backHref="/mentor/sessions" backLabel="← Sessions" toast={toast} notify={notify}>
        <ErrorBlock message={loadError} onRetry={() => setReload((n) => n + 1)} />
      </MentorPageShell>
    );
  }

  const startup = mentorship?.startup;
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  const isMentor = session.viewer_side === 'mentor';
  const fee = formatMoney(session.fee_amount, session.currency);

  return (
    <MentorPageShell
      active="Sessions"
      backHref="/mentor/sessions"
      backLabel="← Sessions"
      toast={toast}
      notify={notify}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#4A5568]">
            Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Sessions & sign-off
          </p>
          <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
            {session.topic || 'Session'}
          </h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            {startup?.display_name || 'Startup'} · {formatInstant(session.scheduled_at)} IST ·{' '}
            {session.duration_min} min · {session.session_type || 'Session'}
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                SESSION_STATUS_CHIP[session.status] || ''
              }`}
            >
              {SESSION_STATUS_LABEL[session.status] || session.status}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/mentor/sessions"
            className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
          >
            ← Sessions
          </Link>
          <Btn
            secondary
            onClick={() => {
              if (!session.meeting_url) {
                notify('No meeting link was added to this session.');
                return;
              }
              if (!session.can_join) {
                notify('The meeting room opens 10 minutes before the start time.');
                return;
              }
              window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
            }}
          >
            <Video size={15} /> Join session
          </Btn>
          {isMentor && !isCompleted && !isCancelled && (
            <Btn onClick={() => setMeetingTab('Summary and feedback')}>
              <FileText size={15} /> Add summary
            </Btn>
          )}
        </div>
      </div>

      {isCancelled && (
        <div className="mb-4 rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-3 text-xs text-[#7A271A]">
          This session was cancelled
          {session.cancelled_reason ? `: ${session.cancelled_reason}` : '.'}
        </div>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(isMentor
          ? ['Notes', 'Summary and feedback']
          : ['Notes', 'Summary']
        ).map((x) => (
          <button
            type="button"
            key={x}
            onClick={() => setMeetingTab(x)}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors ${
              meetingTab === x
                ? 'bg-[#0F1B2D] text-white'
                : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Card title={meetingTab}>
            {meetingTab === 'Notes' ? (
              <>
                <div className="mb-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                      !isPrivate
                        ? 'bg-[#0F1B2D] text-white'
                        : 'border border-[#E5E1D8] text-[#4A5568] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    Shared notes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                      isPrivate
                        ? 'bg-[#0F1B2D] text-white'
                        : 'border border-[#E5E1D8] text-[#4A5568] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    Private notes
                  </button>
                </div>
                <textarea
                  value={isPrivate ? privateNotes : sharedNotes}
                  onChange={(e) =>
                    isPrivate ? setPrivateNotes(e.target.value) : setSharedNotes(e.target.value)
                  }
                  rows={8}
                  placeholder={
                    isPrivate
                      ? 'Private notes · visible only to you'
                      : 'Collaborative notes visible to the startup'
                  }
                  className="w-full rounded-lg border border-[#E5E1D8] bg-white p-3 text-sm focus:border-[#0F1B2D] focus:outline-none"
                />
                <p className="mt-3 text-xs text-[#4A5568]">
                  Session notes are not stored yet — the notes API lands in a later step, so
                  these stay on this page only.
                </p>

                {session.action_items.length > 0 && (
                  <div className="mt-5 rounded-lg border border-[#E5E1D8] p-4">
                    <h3 className="text-sm font-semibold text-[#0F1B2D]">Action items</h3>
                    {session.action_items.map((item) => (
                      <div key={item} className="mt-3 flex items-center gap-2 text-xs">
                        <CheckCircle2 size={14} className="text-[#9A7A45]" />
                        <span className="flex-1 text-[#0F1B2D]">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {session.summary && (
                  <div className="mb-4 rounded-lg bg-[#FAF8F4] p-4">
                    <h3 className="text-xs font-semibold text-[#0F1B2D]">
                      Summary already recorded
                    </h3>
                    <p className="mt-2 whitespace-pre-line text-xs text-[#4A5568]">
                      {session.summary}
                    </p>
                    {session.completed_at && (
                      <p className="mt-2 text-xs text-[#4A5568]">
                        Completed {formatDate(session.completed_at)}
                      </p>
                    )}
                  </div>
                )}

                {!isMentor ? (
                  <p className="text-sm text-[#4A5568]">
                    Your mentor records the summary after the session. It will appear here.
                  </p>
                ) : isCancelled ? (
                  <p className="text-sm text-[#4A5568]">
                    A cancelled session cannot be completed.
                  </p>
                ) : (
                  <>
                    <div className="mb-4 rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">
                      Complete a short summary within 24 hours. The startup sees the
                      decisions and action items you share.
                    </div>
                    <label className="block text-sm font-medium text-[#0F1B2D]">
                      What we covered (required, 10–2,000 characters)
                      <textarea
                        minLength={10}
                        maxLength={2000}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        rows={5}
                        placeholder="Summarize the key topics and discussion…"
                        className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none"
                      />
                      <FieldError>{summaryErrs.summary}</FieldError>
                    </label>
                    <label className="mt-4 block text-sm font-medium text-[#0F1B2D]">
                      Action items (one per line)
                      <textarea
                        rows={3}
                        value={actionItems}
                        onChange={(e) => setActionItems(e.target.value)}
                        placeholder="Upload revised pricing assumptions"
                        className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none"
                      />
                      <FieldError>{summaryErrs.action_items}</FieldError>
                    </label>
                    {summaryError && <FieldError>{summaryError}</FieldError>}
                    <div className="mt-5 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={summary.trim().length < 10 || savingSummary}
                        onClick={submitSummary}
                        className="min-h-10 rounded-lg bg-[#0F1B2D] px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-45"
                      >
                        {savingSummary ? 'Submitting…' : 'Submit summary'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </Card>

          {isMentor && !isCompleted && !isCancelled && (
            <Card title="Session controls">
              <div className="flex flex-wrap gap-2">
                {session.status === 'scheduled' && (
                  <Btn secondary onClick={doConfirm} disabled={busy}>
                    Confirm session
                  </Btn>
                )}
                <Btn secondary onClick={() => setReschedule(true)} disabled={busy}>
                  Reschedule
                </Btn>
                <Btn secondary onClick={doNoShow} disabled={busy}>
                  Mark no-show
                </Btn>
                <Btn danger onClick={doCancel} disabled={busy}>
                  Cancel session
                </Btn>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card title="Session information">
            <p className="text-xs text-[#0F1B2D]">
              {formatInstant(session.scheduled_at)} IST
            </p>
            <p className="mt-2 text-xs text-[#4A5568]">
              {session.duration_min} minutes · {session.session_type || 'Session'}
            </p>
            <p className="mt-2 text-xs text-[#0F1B2D]">
              Fee: {fee || 'none set'}
            </p>
            <p className="mt-3 text-xs text-[#4A5568]">
              Attendees:{' '}
              {session.attendees.map((a) => `${a.display_name} (${a.role})`).join(', ') ||
                'none yet'}
            </p>
            {session.meeting_url && (
              <a
                href={session.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
              >
                Meeting link
              </a>
            )}
          </Card>

          {startup && (
            <Card title="Startup">
              <p className="text-sm font-semibold text-[#0F1B2D]">{startup.display_name}</p>
              <p className="mt-1 text-xs text-[#4A5568]">
                {startup.stage ? startup.stage.replace(/_/g, ' ') : 'Stage not set'}
                {startup.sector ? ` · ${startup.sector}` : ''}
                {startup.city ? ` · ${startup.city}` : ''}
              </p>
              <Link
                href={`/mentor/startups/${session.mentorship_id}`}
                className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
              >
                Open mentorship <ArrowRight className="inline" size={12} />
              </Link>
            </Card>
          )}
        </aside>
      </div>

      {reschedule && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold text-[#0F1B2D]">Reschedule</h2>
              <button
                type="button"
                onClick={() => setReschedule(false)}
                aria-label="Close"
                className="text-[#4A5568] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>
            {slotsPhase === 'ready' && slots.length > 0 ? (
              <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                {slots.map((slot) => {
                  const dateStr = new Date(slot.start).toLocaleDateString('en-CA', {
                    timeZone: 'Asia/Kolkata',
                  });
                  const timeStr = slot.start.slice(11, 16);
                  const checked = newDate === dateStr && newTime === timeStr;
                  return (
                    <label
                      key={slot.start}
                      className={`cursor-pointer rounded-lg border px-3 py-2 text-xs ${
                        checked
                          ? 'border-[#0F1B2D] bg-[#F4F1EA] font-semibold text-[#0F1B2D]'
                          : 'border-[#E5E1D8] text-[#4A5568]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="rslot"
                        className="mr-2 accent-[#0F1B2D]"
                        checked={checked}
                        onChange={() => {
                          setNewDate(dateStr);
                          setNewTime(timeStr);
                        }}
                      />
                      {formatDate(slot.local_date)} · {String(slot.local_start).slice(0, 5)}
                    </label>
                  );
                })}
              </div>
            ) : slotsPhase === 'loading' ? (
              <p className="text-xs text-[#4A5568]">Loading your open slots…</p>
            ) : slotsPhase === 'error' ? (
              <p className="text-xs text-[#B42318]">
                Could not load your open slots. Enter a time manually.
              </p>
            ) : (
              <p className="text-xs text-[#4A5568]">
                No open slots in the next 28 days. Enter a time manually below.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-[#0F1B2D]">
                Date
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 focus:outline-none"
                />
              </label>
              <label className="text-sm font-medium text-[#0F1B2D]">
                Time (IST)
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 focus:outline-none"
                />
              </label>
            </div>
            {rescheduleErr && <FieldError>{rescheduleErr}</FieldError>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReschedule(false)}
                className="min-h-10 px-4 text-sm font-medium text-[#4A5568] hover:text-[#0F1B2D]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingReschedule}
                onClick={submitReschedule}
                className="min-h-10 rounded-lg bg-[#0F1B2D] px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-60"
              >
                {savingReschedule ? 'Moving…' : 'Move session'}
              </button>
            </div>
          </section>
        </div>
      )}
    </MentorPageShell>
  );
}
