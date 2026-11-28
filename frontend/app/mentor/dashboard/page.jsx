'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  ExternalLink,
  Plus,
  Sliders,
  Sparkles,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Btn, Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/async-state';
import {
  STAGE_LABEL,
  SESSION_STATUS_CHIP,
  SESSION_STATUS_LABEL,
  MENTORSHIP_STATUS_CHIP,
  MENTORSHIP_STATUS_LABEL,
  formatInstant,
  formatDate,
  formatMoney,
} from '@/lib/mentorship-labels';

export default function MentorDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [toast, setToast] = useState('');
  const [data, setData] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [revision, setRevision] = useState(0);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  useEffect(() => {
    const controller = new AbortController();
    setPhase('loading');
    setError('');

    Promise.all([
      api.mentorWorkspace.dashboard({ limit: 50 }, controller.signal),
      api.sessions.list({ upcoming: true, limit: 10 }, controller.signal),
      api.mentorships
        .list({ side: 'mentor', status: 'requested', limit: 5 }, controller.signal)
        .catch(() => ({ items: [], total: 0, limit: 5, offset: 0 })),
    ])
      .then(([dashboardRes, sessionsRes, requestsRes]) => {
        if (!controller.signal.aborted) {
          setData(dashboardRes);
          setSessions(sessionsRes);
          setPendingRequests(requestsRes?.items || []);
          setPhase('ready');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Could not load your mentor dashboard.',
          );
          setPhase('error');
        }
      });

    return () => controller.abort();
  }, [revision]);

  // Next immediate session
  const nextSession = useMemo(() => {
    if (!sessions?.items?.length) return null;
    return sessions.items[0];
  }, [sessions]);

  // Active mentorships
  const activeMentorships = useMemo(() => {
    if (!data?.mentorships?.items) return [];
    return data.mentorships.items;
  }, [data]);

  return (
    <MentorPageShell active="Dashboard" toast={toast} notify={notify}>
      {/* Header Banner & Quick Actions */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#4A5568]">
            <span>Mentor workspace</span>
            <span className="text-[#B8955A]">·</span>
            <span>Forma</span>
          </div>
          <h1 className="serif mt-1 text-2xl font-bold text-[#0F1B2D] sm:text-3xl">
            Welcome back{user?.display_name ? `, ${user.display_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            Overview of your active startup engagements, upcoming sessions, and earnings.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/mentor/sessions"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] bg-[#0F1B2D] px-4 text-xs font-semibold text-white transition hover:bg-[#1E2D42]"
          >
            <Calendar size={14} />
            View Schedule
          </Link>
          <Link
            href="/mentor/discover"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#0F1B2D] transition hover:bg-[#FAF8F4]"
          >
            <Compass size={14} className="text-[#9A7A45]" />
            Discover Startups
          </Link>
          <Link
            href="/mentor/profile/edit"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#0F1B2D] transition hover:bg-[#FAF8F4]"
          >
            <Sliders size={14} className="text-[#4A5568]" />
            Availability
          </Link>
        </div>
      </div>

      {phase === 'loading' && <LoadingBlock label="Loading mentor dashboard…" rows={4} />}

      {phase === 'error' && (
        <ErrorBlock message={error} onRetry={() => setRevision((n) => n + 1)} />
      )}

      {phase === 'ready' && data && (
        <div className="space-y-7">
          {/* Top Metric Cards */}
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/* Active Startups */}
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#4A5568]">Active Startups</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F0EBE1] text-[#806236]">
                  <Users size={16} />
                </span>
              </div>
              <p className="serif mt-3 text-3xl font-bold text-[#0F1B2D]">
                {data.impact?.active_startups ?? 0}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-[#F3F0EA] pt-2 text-[11px] text-[#6B7280]">
                <span>Total mentored: {data.impact?.startups_mentored ?? 0}</span>
                <Link
                  href="/mentor/startups"
                  className="font-semibold text-[#9A7A45] hover:underline"
                >
                  View all →
                </Link>
              </div>
            </div>

            {/* Sessions Delivered */}
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#4A5568]">Sessions Delivered</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EBF6EE] text-[#1B6E32]">
                  <CalendarDays size={16} />
                </span>
              </div>
              <p className="serif mt-3 text-3xl font-bold text-[#0F1B2D]">
                {data.impact?.sessions_delivered ?? 0}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-[#F3F0EA] pt-2 text-[11px] text-[#6B7280]">
                <span>Upcoming: {sessions?.total ?? 0}</span>
                <Link
                  href="/mentor/sessions"
                  className="font-semibold text-[#9A7A45] hover:underline"
                >
                  Schedule →
                </Link>
              </div>
            </div>

            {/* Current Sign-offs */}
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#4A5568]">Sign-offs & Audits</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EFF6FF] text-[#1E40AF]">
                  <CheckCircle2 size={16} />
                </span>
              </div>
              <p className="serif mt-3 text-3xl font-bold text-[#0F1B2D]">
                {data.impact?.current_signoffs ?? 0}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-[#F3F0EA] pt-2 text-[11px] text-[#6B7280]">
                <span>Verified milestones</span>
                <span className="text-[11px] text-[#4A5568]">Readiness</span>
              </div>
            </div>

            {/* Pending Earnings */}
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#4A5568]">Pending Earnings</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FFF8E8] text-[#9A7A45]">
                  <DollarSign size={16} />
                </span>
              </div>
              <p className="serif mt-3 text-3xl font-bold text-[#0F1B2D]">
                {formatMoney(data.earnings?.pending_amount, data.earnings?.currency) || '₹0'}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-[#F3F0EA] pt-2 text-[11px] text-[#6B7280]">
                <span>Paid: {formatMoney(data.earnings?.paid_amount, data.earnings?.currency) || '₹0'}</span>
                <Link
                  href="/mentor/earnings"
                  className="font-semibold text-[#9A7A45] hover:underline"
                >
                  Ledger →
                </Link>
              </div>
            </div>
          </section>

          {/* Needs Attention / Urgent Queue */}
          <section aria-label="Action items">
            {pendingRequests.length > 0 ? (
              <div className="rounded-2xl border border-[#F3D79B] bg-[#FFFBF0] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#806236]">
                    <AlertCircle size={18} />
                    <span>
                      {pendingRequests.length} Mentorship Request{pendingRequests.length === 1 ? '' : 's'} Waiting for Response
                    </span>
                  </div>
                  <Link
                    href="/mentor/requests"
                    className="text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    View all requests →
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-col justify-between rounded-xl border border-[#EBD7B0] bg-white p-4 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F3EBDD] font-serif text-sm font-bold text-[#806236]">
                            {(req.startup?.display_name || '?').slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-semibold text-[#0F1B2D] text-sm line-clamp-1">
                              {req.startup?.display_name || 'Startup'}
                            </p>
                            <p className="text-[11px] text-[#6B7280]">
                              {[STAGE_LABEL[req.startup?.stage], req.startup?.city]
                                .filter(Boolean)
                                .join(' · ') || 'Startup request'}
                            </p>
                          </div>
                        </div>
                        {req.goal && (
                          <p className="mt-2.5 text-xs text-[#4A5568] line-clamp-2 leading-relaxed">
                            &ldquo;{req.goal}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-[#F3F0EA] pt-2">
                        <span className="text-[11px] text-[#806236] font-medium">Pending response</span>
                        <Link
                          href={`/mentor/startups/${req.id}`}
                          className="rounded-md bg-[#0F1B2D] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#1E2D42]"
                        >
                          Review →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#E5E1D8] bg-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#E7F3EC] text-[#286749]">
                    <CheckCircle2 size={16} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#0F1B2D]">
                      Priority Queue: You&apos;re all caught up!
                    </p>
                    <p className="text-[11px] text-[#6B7280]">
                      No pending mentorship requests waiting for your response.
                    </p>
                  </div>
                </div>
                <Link
                  href="/mentor/discover"
                  className="text-xs font-semibold text-[#9A7A45] hover:underline"
                >
                  Browse startups →
                </Link>
              </div>
            )}
          </section>

          {/* Main 2-Column Content Grid */}
          <div className="grid items-start gap-7 lg:grid-cols-3">
            {/* Left 2 Cols: Sessions and Mentorships */}
            <div className="space-y-7 lg:col-span-2">
              {/* Upcoming Sessions Section */}
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={18} className="text-[#9A7A45]" />
                    <h2 className="text-base font-semibold text-[#0F1B2D]">
                      Upcoming Sessions
                    </h2>
                  </div>
                  <Link
                    href="/mentor/sessions"
                    className="text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    View calendar & all sessions ({sessions?.total || 0}) →
                  </Link>
                </div>

                {!sessions?.items?.length ? (
                  <div className="rounded-xl border border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-6 text-center">
                    <Calendar size={28} className="mx-auto text-[#A0A7B4]" />
                    <p className="mt-2 text-sm font-semibold text-[#0F1B2D]">
                      No upcoming sessions scheduled
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280] max-w-sm mx-auto">
                      When startups book time or you schedule meetings, they will appear here with live join links.
                    </p>
                    <div className="mt-4 flex justify-center gap-3">
                      <Link
                        href="/mentor/profile/edit"
                        className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                      >
                        Set Available Slots
                      </Link>
                      <Link
                        href="/mentor/sessions"
                        className="rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E2D42]"
                      >
                        Manage Sessions
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F3F0EA]">
                    {sessions.items.slice(0, 5).map((s) => (
                      <article
                        key={s.id}
                        className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between transition hover:bg-[#FAF8F4]/50 rounded-lg px-2 -mx-2"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/mentor/sessions/${s.id}`}
                              className="font-semibold text-sm text-[#0F1B2D] hover:text-[#9A7A45]"
                            >
                              {s.topic || 'Mentoring Session'}
                            </Link>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                SESSION_STATUS_CHIP[s.status] || 'bg-[#F3F4F6] text-[#4A5568]'
                              }`}
                            >
                              {SESSION_STATUS_LABEL[s.status] || s.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
                            <span className="inline-flex items-center gap-1 font-medium text-[#4A5568]">
                              <Clock size={12} className="text-[#A0A7B4]" />
                              {formatInstant(s.scheduled_at) || 'TBD'}
                            </span>
                            <span>·</span>
                            <span>{s.duration_min} mins</span>
                            {s.session_type && (
                              <>
                                <span>·</span>
                                <span className="capitalize">{s.session_type}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {s.can_join && s.meeting_url ? (
                            <a
                              href={s.meeting_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#1B6E32] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#155A28]"
                            >
                              <Video size={13} />
                              Join Call
                            </a>
                          ) : null}
                          <Link
                            href={`/mentor/sessions/${s.id}`}
                            className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                          >
                            Details →
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* Startups at a Glance */}
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-[#9A7A45]" />
                    <h2 className="text-base font-semibold text-[#0F1B2D]">
                      My Startups ({data.mentorships?.total || 0})
                    </h2>
                  </div>
                  <Link
                    href="/mentor/startups"
                    className="text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    View directory ({data.mentorships?.total || 0}) →
                  </Link>
                </div>

                {!activeMentorships.length ? (
                  <div className="rounded-xl border border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-6 text-center">
                    <Users size={28} className="mx-auto text-[#A0A7B4]" />
                    <p className="mt-2 text-sm font-semibold text-[#0F1B2D]">
                      No active mentorship engagements
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280] max-w-sm mx-auto">
                      Explore early-stage startups that have opted in to mentor discovery on Forma.
                    </p>
                    <div className="mt-4">
                      <Link
                        href="/mentor/discover"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E2D42]"
                      >
                        <Compass size={13} />
                        Explore Startups
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeMentorships.map((m) => (
                      <article
                        key={m.id}
                        className="flex flex-col justify-between rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-xs transition hover:border-[#C4BEB2] hover:shadow-sm"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-base font-bold text-[#806236]">
                                {(m.startup?.display_name || '?').slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <h3 className="font-semibold text-[#0F1B2D] text-sm">
                                  {m.startup?.display_name || 'Startup'}
                                </h3>
                                <p className="mt-0.5 text-[11px] text-[#6B7280]">
                                  {[STAGE_LABEL[m.startup?.stage], m.startup?.sector, m.startup?.city]
                                    .filter(Boolean)
                                    .join(' · ') || 'Active startup'}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                MENTORSHIP_STATUS_CHIP[m.status] || 'bg-[#F3F4F6] text-[#4A5568]'
                              }`}
                            >
                              {MENTORSHIP_STATUS_LABEL[m.status] || m.status}
                            </span>
                          </div>

                          {m.goal && (
                            <p className="mt-3 text-xs text-[#4A5568] line-clamp-2 leading-relaxed">
                              {m.goal}
                            </p>
                          )}

                          {m.needs && m.needs.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {m.needs.slice(0, 3).map((need, idx) => (
                                <span
                                  key={idx}
                                  className="rounded bg-[#FAF8F4] border border-[#EBE7DF] px-1.5 py-0.5 text-[10px] font-medium text-[#4A5568]"
                                >
                                  {need}
                                </span>
                              ))}
                              {m.needs.length > 3 && (
                                <span className="text-[10px] text-[#A0A7B4] self-center">
                                  +{m.needs.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-[#F3F0EA] pt-3 text-xs">
                          <span className="text-[11px] text-[#6B7280]">
                            {m.cadence || 'Regular advisory'}
                          </span>
                          <Link
                            href={`/mentor/startups/${m.id}`}
                            className="font-semibold text-[#9A7A45] hover:underline"
                          >
                            Workspace →
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right 1 Col: Highlights, Earnings & Controls */}
            <div className="space-y-7">
              {/* Immediate Next Session Focus Card */}
              {nextSession && (
                <section className="rounded-2xl border border-[#D5E3D8] bg-[#F7FAF8] p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B6E32]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34D399] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1B6E32]"></span>
                      </span>
                      Next Scheduled Session
                    </span>
                    <Link
                      href={`/mentor/sessions/${nextSession.id}`}
                      className="text-[11px] font-medium text-[#1B6E32] hover:underline"
                    >
                      Session page
                    </Link>
                  </div>

                  <h3 className="serif mt-3 text-lg font-bold text-[#0F1B2D]">
                    {nextSession.topic || 'Mentoring Session'}
                  </h3>

                  <div className="mt-3 space-y-1.5 text-xs text-[#4A5568]">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-[#9A7A45]" />
                      <span className="font-semibold text-[#0F1B2D]">
                        {formatInstant(nextSession.scheduled_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={13} className="text-[#A0A7B4]" />
                      <span>{nextSession.duration_min} minutes</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    {nextSession.can_join && nextSession.meeting_url ? (
                      <a
                        href={nextSession.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B6E32] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#155A28]"
                      >
                        <Video size={14} />
                        Join Meeting Link
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <Link
                        href={`/mentor/sessions/${nextSession.id}`}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D5E3D8] bg-white px-4 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                      >
                        View Details & Agenda
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {/* Earnings Snapshot Card */}
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0F1B2D]">Earnings Snapshot</h3>
                  <Link
                    href="/mentor/earnings"
                    className="text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    Details →
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#F3F0EA] pb-2 text-xs">
                    <span className="text-[#6B7280]">Pending payout</span>
                    <span className="font-semibold text-[#0F1B2D]">
                      {formatMoney(data.earnings?.pending_amount, data.earnings?.currency) || '₹0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#F3F0EA] pb-2 text-xs">
                    <span className="text-[#6B7280]">Paid out</span>
                    <span className="font-semibold text-[#1B6E32]">
                      {formatMoney(data.earnings?.paid_amount, data.earnings?.currency) || '₹0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280]">Total lifetime</span>
                    <span className="serif text-base font-bold text-[#0F1B2D]">
                      {formatMoney(data.earnings?.lifetime_amount, data.earnings?.currency) || '₹0'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F3F0EA]">
                  <Link
                    href="/mentor/earnings"
                    className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] py-2 text-xs font-semibold text-[#0F1B2D] transition hover:bg-[#F3EBDD]"
                  >
                    Open Earnings & Ledger
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </section>

              {/* Quick Preferences & Capacity */}
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#0F1B2D]">Availability & Profile</h3>
                <p className="mt-1 text-xs text-[#6B7280] leading-relaxed">
                  Keep your recurring slots and advisory preferences updated so startups can discover and book time.
                </p>

                <div className="mt-4 space-y-2">
                  <Link
                    href="/mentor/profile/edit"
                    className="flex items-center justify-between rounded-lg border border-[#E5E1D8] p-3 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders size={14} className="text-[#9A7A45]" />
                      Manage Booking Slots
                    </span>
                    <ArrowRight size={12} className="text-[#A0A7B4]" />
                  </Link>

                  <Link
                    href="/mentor/profile/edit"
                    className="flex items-center justify-between rounded-lg border border-[#E5E1D8] p-3 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                  >
                    <span className="flex items-center gap-2">
                      <Users size={14} className="text-[#9A7A45]" />
                      Edit Bio & Expertise
                    </span>
                    <ArrowRight size={12} className="text-[#A0A7B4]" />
                  </Link>
                </div>
              </section>

              {/* Advisory Policy */}
              <div className="rounded-xl border border-[#E7D4B0] bg-[#FFFBF0] p-4 text-xs text-[#806236] leading-relaxed">
                <p className="font-semibold text-[#73572E]">Mentor Guidelines</p>
                <p className="mt-1">
                  Deliver sessions promptly, log summaries to help founders track milestone progression, and maintain audit integrity.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </MentorPageShell>
  );
}
