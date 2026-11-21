'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  MessageCircle,
  ArrowRight,
  LockKeyhole,
  FileText,
  Send,
  X,
  ClipboardCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import MentorPageShell from '../../mentor-page-shell';
import { Btn, Card } from '../../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/async-state';
import {
  MENTORSHIP_STATUS_CHIP,
  MENTORSHIP_STATUS_LABEL,
  SESSION_STATUS_CHIP,
  SESSION_STATUS_LABEL,
  STAGE_LABEL,
  formatDate,
  formatInstant,
} from '@/lib/mentorship-labels';

export default function MentorshipWorkspacePage() {
  const params = useParams();
  const mentorshipId = params?.mentorshipId;

  const [toast, setToast] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState('Overview');
  const [modal, setModal] = useState('');
  const [notes, setNotes] = useState('');
  const [declineReason, setDeclineReason] = useState('');

  const [mentorship, setMentorship] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [readinessError, setReadinessError] = useState('');
  const [phase, setPhase] = useState('loading'); // loading|ready|error|notfound
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);

  const notify = (x) => {
    setToast(x);
    setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    if (!mentorshipId) {
      setPhase('notfound');
      return undefined;
    }
    let alive = true;
    setPhase('loading');
    setError('');

    (async () => {
      try {
        const { mentorship: m } = await api.mentorWorkspace.get(mentorshipId);
        if (!alive) return;
        setMentorship(m);

        const [sessionsRes, tasksRes, readinessRes] = await Promise.allSettled([
          api.sessions.forMentorship(mentorshipId, { limit: 50 }),
          api.deliverables.list(mentorshipId, { limit: 50 }),
          api.mentorWorkspace.readiness(mentorshipId),
        ]);

        if (!alive) return;

        if (sessionsRes.status === 'fulfilled') {
          setSessions(sessionsRes.value.items || []);
          setSessionTotal(sessionsRes.value.total);
        } else { throw sessionsRes.reason; }
        if (tasksRes.status === 'fulfilled') {
          setTasks(tasksRes.value.items || []);
        } else { throw tasksRes.reason; }
        if (readinessRes.status === 'fulfilled' && readinessRes.value) {
          setReadiness(readinessRes.value); setReadinessError('');
        } else { setReadiness(null); setReadinessError('Readiness is unavailable for this mentorship.'); }

        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setPhase('notfound');
          setError('Mentorship engagement not found.');
        } else {
          setPhase('error');
          setError(err instanceof ApiError ? err.message : 'Could not load mentorship workspace.');
        }
      }
    })();

    return () => { alive = false; };
  }, [mentorshipId, reload]);

  const handlePause = async () => {
    if (!mentorship || actionBusy) return;
    setActionBusy(true);
    try {
      await api.mentorships.pause(mentorship.id);
      notify('Mentorship paused.');
      setReload(n => n + 1);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not pause mentorship.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResume = async () => {
    if (!mentorship || actionBusy) return;
    setActionBusy(true);
    try {
      await api.mentorships.resume(mentorship.id);
      notify('Mentorship resumed.');
      setReload(n => n + 1);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not resume mentorship.');
    } finally {
      setActionBusy(false);
    }
  };

  const startup = mentorship?.startup;
  const startupName = startup?.display_name || 'Startup';
  const startupStage = startup?.stage ? (STAGE_LABEL[startup.stage] || startup.stage) : 'Stage not specified';
  const statusText = mentorship ? (MENTORSHIP_STATUS_LABEL[mentorship.status] || mentorship.status) : '';
  const startedText = mentorship?.started_on ? ` · Started ${formatDate(mentorship.started_on)}` : '';
  const cadenceText = mentorship?.cadence ? ` · ${mentorship.cadence}` : '';

  const upcoming = sessions
    .filter(s => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const nextSession = upcoming[0] || null;

  const readinessSigned = readiness?.summary?.criteria_signed_off ?? '—';
  const readinessTotal = readiness?.summary?.criteria_total ?? '—';

  return (
    <MentorPageShell
      active="My startups"
      backHref="/mentor/startups"
      backLabel="← My startups"
      toast={toast}
      notify={notify}
    >
      {phase === 'loading' && (
        <LoadingBlock label="Loading mentorship workspace..." rows={4} />
      )}

      {phase === 'notfound' && (
        <Card title="Mentorship not found">
          <p className="text-xs text-[#4A5568]">
            This mentorship engagement does not exist or you do not have permission to access it.
          </p>
          <Link href="/mentor/startups" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7A45]">
            <ArrowRight className="rotate-180" size={13} /> Return to my startups
          </Link>
        </Card>
      )}

      {phase === 'error' && (
        <ErrorBlock
          message={error || 'Could not load mentorship workspace.'}
          onRetry={() => setReload(n => n + 1)}
        />
      )}

      {phase === 'ready' && mentorship && (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#4A5568]">
                Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> {startupName}
              </p>
              <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
                {startupName} mentorship
              </h1>
              <p className="mt-1 text-sm text-[#4A5568]">
                {startupStage} · {statusText}{startedText}{cadenceText}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/mentor/startups/${mentorship.id}/startup`}
                className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
              >
                View startup
              </Link>
              <Link
                href={`/mentor/sessions?mentorship_id=${mentorship.id}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
              >
                <CalendarDays size={14} /> Sessions
              </Link>
              <Link
                href="/messages"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-3.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
              >
                <MessageCircle size={14} /> Message
              </Link>
            </div>
          </div>

          {mentorship.status === 'paused' && (
            <div className="mb-4 rounded-lg bg-[#F3F4F6] p-3 text-sm text-[#4A5568]">
              This mentorship is currently paused. Workspace records remain visible.
            </div>
          )}

          {/* Tabs */}
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white p-1">
            {['Overview', 'Plan', 'Sessions', 'Deliverables', 'Readiness', 'Notes', 'Files'].map(
              (x) => (
                <button
                  type="button"
                  onClick={() => setWorkspaceTab(x)}
                  key={x}
                  className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors ${
                    workspaceTab === x ? 'bg-[#0F1B2D] text-white' : 'text-[#4A5568] hover:text-[#0F1B2D]'
                  }`}
                >
                  {x}
                </button>
              )
            )}
          </div>

          {/* Main workspace layout */}
          <div className="grid items-start gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Card title={workspaceTab}>
                {workspaceTab === 'Overview' ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-[#F3EBDD] p-4">
                        <p className="text-xs font-medium text-[#806236]">Readiness sign-off</p>
                        <b className="serif mt-1 block text-2xl text-[#806236]">
                          {readinessSigned} of {readinessTotal} items
                        </b>
                        <Link
                          href={`/mentor/startups/${mentorship.id}/readiness`}
                          className="mt-2 inline-block text-xs font-semibold text-[#9A7A45]"
                        >
                          Review readiness sign-off <ArrowRight className="inline" size={12} />
                        </Link>
                      </div>
                      <div className="rounded-lg bg-[#FAF8F4] p-4">
                        <p className="text-xs text-[#4A5568]">Next session</p>
                        {nextSession ? (
                          <>
                            <b className="mt-1 block text-sm text-[#0F1B2D]">
                              {formatInstant(nextSession.scheduled_at)}
                            </b>
                            <small className="text-xs text-[#4A5568]">{nextSession.topic || 'Mentoring Session'}</small>
                          </>
                        ) : (
                          <>
                            <b className="mt-1 block text-sm text-[#0F1B2D]">No session scheduled</b>
                            <Link
                              href={`/mentor/sessions?mentorship_id=${mentorship.id}`}
                              className="mt-1 inline-block text-xs text-[#9A7A45]"
                            >
                              Schedule session →
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-5 text-sm font-semibold text-[#0F1B2D]">Mentorship Goals & Needs</h3>
                    {mentorship.goal ? (
                      <div className="mt-3 rounded-lg border border-[#E5E1D8] p-4">
                        <p className="text-xs font-medium text-[#4A5568]">Primary Goal</p>
                        <p className="mt-1 text-sm font-semibold text-[#0F1B2D]">{mentorship.goal}</p>
                      </div>
                    ) : null}

                    {mentorship.needs && mentorship.needs.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {mentorship.needs.map(need => (
                          <span key={need} className="rounded-full bg-[#FAF8F4] border border-[#E5E1D8] px-3 py-1 text-xs text-[#4A5568]">
                            {need}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {!mentorship.goal && (!mentorship.needs || mentorship.needs.length === 0) && (
                      <p className="mt-2 text-xs text-[#4A5568]">No goals or needs listed for this mentorship yet.</p>
                    )}

                    <h3 className="mb-2 mt-5 text-sm font-semibold text-[#0F1B2D]">Engagement Timeline</h3>
                    <p className="text-xs text-[#4A5568]">
                      Created on {formatDate(mentorship.created_at)}
                      {mentorship.last_session_at ? ` · Last session: ${formatInstant(mentorship.last_session_at)}` : ' · No sessions held yet'}
                    </p>
                  </>
                ) : workspaceTab === 'Plan' ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-[#E5E1D8] p-4">
                      <p className="text-xs font-medium text-[#4A5568]">Cadence & Meeting Format</p>
                      <p className="mt-1 text-sm font-semibold text-[#0F1B2D]">{mentorship.cadence || 'Flexible'}</p>
                      <p className="mt-2 text-xs text-[#4A5568]">
                        Fee: {mentorship.fee_amount ? `${mentorship.currency} ${mentorship.fee_amount} per session` : 'Unpaid / standard terms'}
                      </p>
                      {mentorship.equity_pct ? (
                        <p className="text-xs text-[#4A5568]">Equity advisory: {mentorship.equity_pct}%</p>
                      ) : null}
                    </div>

                    {mentorship.terms && (
                      <div className="rounded-lg border border-[#E5E1D8] p-4">
                        <p className="text-xs font-medium text-[#4A5568]">Terms & Details</p>
                        <p className="mt-1 text-xs whitespace-pre-wrap text-[#4A5568]">{mentorship.terms}</p>
                      </div>
                    )}

                    {mentorship.needs && mentorship.needs.length > 0 && (
                      <div className="rounded-lg border border-[#E5E1D8] p-4">
                        <p className="text-xs font-medium text-[#4A5568]">Focus Areas</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {mentorship.needs.map(n => (
                            <span key={n} className="rounded-md bg-[#FAF8F4] border border-[#E5E1D8] px-2.5 py-1 text-xs text-[#0F1B2D]">
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : workspaceTab === 'Sessions' ? (
                  <>
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <p className="text-[#4A5568]">
                        {sessionTotal} total session{sessionTotal === 1 ? '' : 's'} recorded.
                      </p>
                      <Link href={`/mentor/sessions?mentorship_id=${mentorship.id}`} className="font-semibold text-[#9A7A45]">
                        View in session calendar →
                      </Link>
                    </div>
                    {sessions.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#4A5568]">
                        <p>No sessions recorded for this mentorship yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E5E1D8]">
                        {sessions.map(s => (
                          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                            <div className="flex items-center gap-3">
                              <CalendarDays size={16} className="text-[#9A7A45]" />
                              <div>
                                <b className="text-[#0F1B2D]">{s.topic || 'Mentoring Session'}</b>
                                <p className="text-[11px] text-[#4A5568]">
                                  {formatInstant(s.scheduled_at)} · {s.duration_min} minutes
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${SESSION_STATUS_CHIP[s.status] || 'bg-gray-100'}`}>
                                {SESSION_STATUS_LABEL[s.status] || s.status}
                              </span>
                              <Link href={`/mentor/sessions/${s.id}`} className="font-semibold text-[#9A7A45]">
                                Details
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : workspaceTab === 'Deliverables' ? (
                  <>
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <p className="text-[#4A5568]">Startup deliverables & action items</p>
                    </div>
                    {tasks.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#4A5568]">
                        No deliverables created for this startup yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[500px] text-left text-xs">
                          <thead className="border-b border-[#E5E1D8] text-[#4A5568]">
                            <tr>
                              <th className="py-3 font-medium">Deliverable</th>
                              <th className="py-3 font-medium">Due</th>
                              <th className="py-3 font-medium">Status</th>
                              <th className="py-3 font-medium">Owner</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.slice(0, 10).map(t => (
                              <tr key={t.id} className="border-b border-[#E5E1D8] last:border-b-0">
                                <td className="py-3 font-medium text-[#0F1B2D]">{t.title}</td>
                                <td className="text-[#4A5568]">{t.due_on || '—'}</td>
                                <td>
                                  <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] capitalize">
                                    {t.status.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="capitalize text-[#4A5568]">{t.owner?.display_name || 'Unassigned'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : workspaceTab === 'Readiness' ? (
                  <div className="space-y-3">
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <p className="text-[#4A5568]">{readinessSigned} of {readinessTotal} criteria signed off</p>
                      <Link href={`/mentor/startups/${mentorship.id}/readiness`} className="font-semibold text-[#9A7A45]">
                        Open sign-off workflow →
                      </Link>
                    </div>
                    {readiness?.items && readiness.items.length > 0 ? (
                      readiness.items.map(item => {
                        const isSigned = item.status === 'signed_off';
                        return (
                          <div
                            key={item.criterion_id}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E5E1D8] p-3 text-xs"
                          >
                            <span className={isSigned ? 'text-[#286749]' : 'text-[#8A5700]'}>
                              {isSigned ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                            </span>
                            <span className="flex-1 font-medium text-[#0F1B2D]">{item.title}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isSigned ? 'bg-[#E7F3EC] text-[#286749]' : 'bg-[#FFF3D6] text-[#8A5700]'
                              }`}
                            >
                              {item.status.replace('_', ' ')}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-[#4A5568]">{readinessError || 'No readiness criteria configured for this startup yet.'}</p>
                    )}
                  </div>
                ) : workspaceTab === 'Notes' ? (
                  <>
                    <div className="mb-3 rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">
                      <LockKeyhole className="mr-1 inline" size={13} />
                      Session summaries and action items are captured directly on each completed mentoring session.
                    </div>
                    <div className="rounded-lg bg-[#FAF8F4] p-4 text-xs">
                      <p className="font-semibold text-[#0F1B2D]">Session Notes</p>
                      <p className="mt-1 text-[#4A5568]">
                        Open any scheduled or completed session to record agenda items, summaries, and action steps.
                      </p>
                      <Link
                        href={`/mentor/sessions?mentorship_id=${mentorship.id}`}
                        className="mt-3 inline-block font-semibold text-[#9A7A45]"
                      >
                        View sessions →
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-dashed border-[#E5E1D8] p-6 text-center">
                      <FileText className="mx-auto mb-2 text-[#9A7A45]" size={20} />
                      <p className="text-sm font-semibold text-[#0F1B2D]">Startup documents</p>
                      <p className="mt-1 text-xs text-[#4A5568]">Shared documents are not available here yet.</p>
                    </div>
                  </>
                )}
              </Card>
            </div>

            {/* Aside Column */}
            <aside className="space-y-5">
              <Card title="Startup snapshot">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#F3EBDD] font-semibold text-[#806236]">
                    {startup?.avatar_initials || (startupName.slice(0, 2).toUpperCase())}
                  </span>
                  <div>
                    <b className="text-sm text-[#0F1B2D]">{startupName}</b>
                    <p className="text-xs text-[#4A5568]">{startupStage}</p>
                  </div>
                </div>
                {startup?.sector && (
                  <p className="mt-3 text-xs text-[#4A5568]">
                    Sector: {startup.sector}
                  </p>
                )}
                {startup?.city && (
                  <p className="mt-1 text-xs text-[#4A5568]">
                    Location: {startup.city}
                  </p>
                )}
                {startup?.tagline && (
                  <p className="mt-2 rounded-lg bg-[#FAF8F4] p-2 text-xs text-[#4A5568]">
                    {startup.tagline}
                  </p>
                )}
                <div className="mt-3 border-t border-[#E5E1D8] pt-3 text-xs text-[#0F1B2D]">
                  Readiness: <b>{readinessSigned} / {readinessTotal} items signed off</b>
                </div>
              </Card>

              <Card title="Mentorship terms">
                <p className="text-xs font-medium text-[#0F1B2D]">
                  Cadence: {mentorship.cadence || 'Flexible'}
                </p>
                <p className="mt-1 text-xs text-[#4A5568]">
                  Fee: {mentorship.fee_amount ? `${mentorship.currency} ${mentorship.fee_amount} per session` : 'Free / standard terms'}
                </p>
                <p className="mt-1 text-xs text-[#4A5568]">
                  Equity: {mentorship.equity_pct ? `${mentorship.equity_pct}%` : 'None requested'}
                </p>
                <div className="mt-4 flex gap-2">
                  {mentorship.status === 'active' ? (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handlePause}
                      className="w-full rounded-lg border border-[#E5E1D8] py-2 text-xs font-semibold hover:bg-[#FAF8F4] disabled:opacity-50"
                    >
                      Pause mentorship
                    </button>
                  ) : mentorship.status === 'paused' ? (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleResume}
                      className="w-full rounded-lg border border-[#E5E1D8] py-2 text-xs font-semibold hover:bg-[#FAF8F4] disabled:opacity-50"
                    >
                      Resume mentorship
                    </button>
                  ) : (
                    <span className="w-full text-center rounded-lg bg-gray-50 py-2 text-xs text-[#718096]">
                      {statusText}
                    </span>
                  )}
                </div>
              </Card>
            </aside>
          </div>
        </>
      )}
    </MentorPageShell>
  );
}
