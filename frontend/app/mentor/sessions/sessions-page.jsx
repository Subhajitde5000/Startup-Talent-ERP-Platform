'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  CalendarDays,
  Search,
  Download,
  ArrowRight,
  X,
} from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Btn, Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
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

const IST = 'Asia/Kolkata';

/** `2026-11-25T14:01:00Z` -> `2026-11-25` in IST, for the date input. */
function istDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

/** `2026-11-25` + "4:00 PM" wall clock -> an ISO instant with +05:30. */
function istWallClockToIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00+05:30`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isUpcoming(session) {
  if (session.status === 'completed' || session.status === 'cancelled') return false;
  if (session.status === 'no_show') return false;
  return new Date(session.scheduled_at).getTime() >= Date.now() - 60 * 60 * 1000;
}

const WEEKDAYS = [
  { id: 0, name: 'Monday', short: 'Mon' },
  { id: 1, name: 'Tuesday', short: 'Tue' },
  { id: 2, name: 'Wednesday', short: 'Wed' },
  { id: 3, name: 'Thursday', short: 'Thu' },
  { id: 4, name: 'Friday', short: 'Fri' },
  { id: 5, name: 'Saturday', short: 'Sat' },
  { id: 6, name: 'Sunday', short: 'Sun' },
];

export default function MentorSessionsPage() {
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('Upcoming');
  const [schedule, setSchedule] = useState(false);
  const [search, setSearch] = useState('');

  const { user } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [mentorships, setMentorships] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotsPhase, setSlotsPhase] = useState('loading'); // loading|ready|error|nohandle
  const [slotsError, setSlotsError] = useState('');
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  // --- weekly availability template (Step 8c) ------------------------------
  const [weekSlots, setWeekSlots] = useState([]);
  const [weekTimezone, setWeekTimezone] = useState(IST);
  const [weekPhase, setWeekPhase] = useState('loading'); // loading|ready|error
  const [weekError, setWeekError] = useState('');
  const [editAvailability, setEditAvailability] = useState(false);
  const [availabilityDraft, setAvailabilityDraft] = useState([
    { weekday: 0, name: 'Monday', enabled: true, start_time: '10:00', end_time: '17:00' },
    { weekday: 1, name: 'Tuesday', enabled: true, start_time: '10:00', end_time: '17:00' },
    { weekday: 2, name: 'Wednesday', enabled: true, start_time: '10:00', end_time: '17:00' },
    { weekday: 3, name: 'Thursday', enabled: true, start_time: '10:00', end_time: '17:00' },
    { weekday: 4, name: 'Friday', enabled: true, start_time: '10:00', end_time: '17:00' },
    { weekday: 5, name: 'Saturday', enabled: false, start_time: '10:00', end_time: '14:00' },
    { weekday: 6, name: 'Sunday', enabled: false, start_time: '10:00', end_time: '14:00' },
  ]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityModalError, setAvailabilityModalError] = useState('');

  // --- schedule form -----------------------------------------------------
  const [form, setForm] = useState({
    mentorship_id: '',
    topic: '',
    session_type: 'advisory',
    date: '',
    time: '',
    duration: '45',
  });
  const [formErrs, setFormErrs] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const notify = useCallback((s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2700);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPhase('loading');
      setWeekPhase('loading');
      setLoadError('');
      setWeekError('');
      try {
        const [sessionsRes, mentorshipRes, weekRes] = await Promise.allSettled([
          api.sessions.list({ limit: 50 }),
          api.mentorships.list({ side: 'mentor', limit: 50 }),
          api.availability.mine(),
        ]);
        if (!alive) return;

        if (sessionsRes.status === 'fulfilled') {
          setSessions(sessionsRes.value.items || []);
        }
        if (mentorshipRes.status === 'fulfilled') {
          setMentorships(mentorshipRes.value.items || []);
        }
        if (weekRes.status === 'fulfilled') {
          const w = weekRes.value;
          setWeekSlots(w.slots || []);
          if (w.timezone) setWeekTimezone(w.timezone);
          setWeekPhase('ready');
        } else {
          setWeekPhase('error');
          setWeekError('Could not load weekly availability.');
        }

        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        setLoadError(
          err instanceof ApiError ? err.message : 'Could not load your sessions.',
        );
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  // Bookable instants computed from Step 8c. Fetched on page load and whenever availability changes.
  const myHandle = user?.handle || null;
  useEffect(() => {
    let alive = true;
    (async () => {
      let handle = myHandle;
      if (!handle) {
        try {
          const me = await api.users.me();
          if (me.handle) handle = me.handle;
        } catch {
          // ignore
        }
      }
      if (!handle) {
        setSlotsPhase('nohandle');
        return;
      }
      setSlotsPhase('loading');
      setSlotsError('');
      try {
        const data = await api.availability.slots(handle, { days: 28 });
        if (!alive) return;
        setSlots(data.items || []);
        setSlotsPhase('ready');
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setSlots([]);
          setSlotsPhase('ready');
        } else {
          setSlotsError(
            err instanceof ApiError ? err.message : 'Could not load your open slots.',
          );
          setSlotsPhase('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload, myHandle]);

  const openEditAvailability = () => {
    setAvailabilityModalError('');
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => {
      const existing = weekSlots.find((s) => s.weekday === d);
      return {
        weekday: d,
        name: dayNames[d],
        enabled: Boolean(existing && existing.is_active !== false),
        start_time: existing ? existing.start_time.slice(0, 5) : '10:00',
        end_time: existing ? existing.end_time.slice(0, 5) : '17:00',
      };
    });
    setAvailabilityDraft(days);
    setEditAvailability(true);
  };

  const saveAvailability = async () => {
    setAvailabilityModalError('');
    const slotsToSave = [];
    for (const d of availabilityDraft) {
      if (d.enabled) {
        if (!d.start_time || !d.end_time) {
          setAvailabilityModalError(`Please provide both start and end times for ${d.name}.`);
          return;
        }
        if (d.end_time <= d.start_time) {
          setAvailabilityModalError(`End time must be after start time for ${d.name}.`);
          return;
        }
        slotsToSave.push({
          weekday: d.weekday,
          start_time: d.start_time.length === 5 ? `${d.start_time}:00` : d.start_time,
          end_time: d.end_time.length === 5 ? `${d.end_time}:00` : d.end_time,
          timezone: weekTimezone || IST,
          is_active: true,
        });
      }
    }

    setSavingAvailability(true);
    try {
      const updatedWeek = await api.availability.replaceWeek({ slots: slotsToSave });
      setWeekSlots(updatedWeek.slots || []);
      if (updatedWeek.timezone) setWeekTimezone(updatedWeek.timezone);
      setEditAvailability(false);
      notify('Weekly availability updated.');
      setReload((n) => n + 1);
    } catch (err) {
      setAvailabilityModalError(err instanceof ApiError ? err.message : 'Could not save availability.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const mentorshipById = useMemo(() => {
    const map = new Map();
    for (const m of mentorships) map.set(m.id, m);
    return map;
  }, [mentorships]);

  const activeMentorships = useMemo(
    () => mentorships.filter((m) => m.status === 'active'),
    [mentorships],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sessions;
    return sessions.filter((s) => {
      const m = mentorshipById.get(s.mentorship_id);
      const startup = m?.startup.display_name || '';
      return `${startup} ${s.topic || ''}`.toLowerCase().includes(term);
    });
  }, [sessions, search, mentorshipById]);

  const upcoming = filtered.filter(isUpcoming);
  const needingSummary = filtered.filter(
    (s) => s.status === 'completed' && !s.summary,
  );
  const past = filtered.filter(
    (s) => s.status === 'completed' || s.status === 'no_show',
  );

  // Counters are computed from the rows actually returned — never invented.
  const weekStart = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    return d;
  }, []);
  const thisWeek = sessions.filter(
    (s) => new Date(s.scheduled_at).getTime() >= weekStart.getTime(),
  ).length;

  const openSlotCount = slots.length;

  const openSchedule = () => {
    setFormErrs({});
    setFormError('');
    setForm({
      mentorship_id: activeMentorships[0]?.id || '',
      topic: '',
      session_type: 'advisory',
      date: '',
      time: '',
      duration: '45',
    });
    setSchedule(true);
  };

  const submitSchedule = async () => {
    setFormErrs({});
    setFormError('');
    if (!form.mentorship_id) {
      setFormErrs({ mentorship_id: 'Choose a startup.' });
      return;
    }
    if (!form.date || !form.time) {
      setFormErrs({ scheduled_at: 'Pick an open slot (date and time).' });
      return;
    }
    const scheduledAt = istWallClockToIso(form.date, form.time);
    if (!scheduledAt) {
      setFormErrs({ scheduled_at: 'That date and time could not be read.' });
      return;
    }
    setSaving(true);
    try {
      await api.sessions.create(form.mentorship_id, {
        scheduled_at: scheduledAt,
        duration_min: Number(form.duration),
        topic: form.topic.trim() || null,
        session_type: form.session_type || null,
      });
      setSchedule(false);
      notify('Session scheduled. The startup has been notified.');
      setReload((n) => n + 1);
    } catch (err) {
      const fieldErrs = fieldErrorsFrom(err);
      if (Object.keys(fieldErrs).length) {
        setFormErrs(fieldErrs);
      } else if (err instanceof ApiError && err.status === 409) {
        // SLOT_TAKEN: the picker's list is stale, so refresh it and say so.
        setFormErrs({ scheduled_at: err.message });
        setSlotsPhase('idle');
      } else {
        setFormError(
          err instanceof ApiError ? err.message : 'Could not schedule the session.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async (session) => {
    if (session.status === 'completed') {
      notify('Session completed. Review the summary below.');
      return;
    }
    if (session.status !== 'confirmed') {
      notify('This session must be confirmed before joining.');
      return;
    }
    if (!session.can_join) {
      notify('The meeting room opens 10 minutes before the start time.');
      return;
    }
    if (session.meeting_url) {
      window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
      return;
    }
    notify('No meeting link was added to this session.');
  };

  const exportCsv = () => {
    const rows = [
      ['Date', 'Startup', 'Topic', 'Status'],
      ...past.map((s) => [
        formatDate(s.scheduled_at) || '',
        mentorshipById.get(s.mentorship_id)?.startup.display_name || '',
        s.topic || '',
        SESSION_STATUS_LABEL[s.status] || s.status,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'mentor-sessions.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Your session history exported.');
  };

  const sessionCard = (s) => {
    const mentorship = mentorshipById.get(s.mentorship_id);
    const startup = mentorship?.startup;
    const fee = formatMoney(s.fee_amount, s.currency) || 'No fee set';
    const needsSummary = s.status === 'completed' && !s.summary;
    return (
      <article
        key={s.id}
        className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E5E1D8] bg-white p-4 sm:p-5"
      >
        <div className="min-w-[130px] rounded-lg bg-[#FAF8F4] p-3 text-center">
          <CalendarDays size={17} className="mx-auto mb-1 text-[#9A7A45]" />
          <b className="text-xs text-[#0F1B2D]">{formatInstant(s.scheduled_at)}</b>
          <small className="mt-1 block text-xs text-[#4A5568]">
            {s.duration_min} min
          </small>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#F3EBDD] font-semibold text-[#806236]">
          {startup?.avatar_initials || '–'}
        </span>
        <div className="min-w-[180px] flex-1">
          <Link
            href={`/mentor/sessions/${s.id}`}
            className="text-sm font-semibold text-[#0F1B2D] hover:underline"
          >
            {startup?.display_name || 'Startup'}
          </Link>
          <p className="mt-1 text-xs text-[#4A5568]">
            {s.topic || 'No topic added'} · {s.session_type || 'Session'}
          </p>
          <p className="mt-1 text-xs text-[#4A5568]">
            Attendees: {s.attendees.map((a) => a.display_name).join(', ') || 'None yet'} ·{' '}
            {fee}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            SESSION_STATUS_CHIP[s.status] || ''
          }`}
        >
          {SESSION_STATUS_LABEL[s.status] || s.status}
        </span>
        <div className="flex w-full justify-end gap-2 sm:w-auto">
          {needsSummary ? (
            <Link
              href={`/mentor/sessions/${s.id}`}
              className="rounded-lg bg-[#0F1B2D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
            >
              Add summary
            </Link>
          ) : s.status === 'confirmed' ? (
            <>
              <Link
                href={`/mentor/sessions/${s.id}`}
                className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
              >
                Prepare
              </Link>
              <button
                type="button"
                onClick={() => handleJoin(s)}
                className="rounded-lg bg-[#0F1B2D] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
              >
                Join
              </button>
            </>
          ) : s.status === 'scheduled' ? (
            <Link
              href={`/mentor/sessions/${s.id}`}
              className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
            >
              Change time / Details
            </Link>
          ) : (
            <Link
              href={`/mentor/sessions/${s.id}`}
              className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
            >
              Details
            </Link>
          )}
        </div>
      </article>
    );
  };

  const body = () => {
    if (phase === 'loading') {
      return (
        <div className="xl:col-span-2">
          <LoadingBlock label="Loading your sessions…" rows={3} />
        </div>
      );
    }
    if (phase === 'error') {
      return (
        <div className="xl:col-span-2">
          <ErrorBlock message={loadError} onRetry={() => setReload((n) => n + 1)} />
        </div>
      );
    }

    const list =
      tab === 'Upcoming' ? upcoming : tab === 'Needs summary' ? needingSummary : past;

    if (tab === 'Past') {
      return (
        <Card title="Past sessions">
          {past.length === 0 ? (
            <EmptyBlock
              title="No past sessions yet"
              hint="Completed and missed sessions will be listed here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="border-b border-[#E5E1D8] text-[#4A5568]">
                  <tr>
                    {['Date', 'Startup', 'Topic', 'Duration', 'Type', 'Summary', ''].map(
                      (x) => (
                        <th key={x} className="py-3 font-medium">
                          {x}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {past.map((s) => {
                    const m = mentorshipById.get(s.mentorship_id);
                    return (
                      <tr key={s.id} className="border-b border-[#E5E1D8]">
                        <td className="py-3 text-[#0F1B2D]">
                          {formatInstant(s.scheduled_at)}
                        </td>
                        <td className="font-medium text-[#0F1B2D]">
                          {m?.startup.display_name || 'Startup'}
                        </td>
                        <td className="text-[#4A5568]">{s.topic || '—'}</td>
                        <td className="text-[#4A5568]">{s.duration_min} min</td>
                        <td className="text-[#4A5568]">{s.session_type || '—'}</td>
                        <td className="text-[#4A5568]">
                          {s.status === 'no_show'
                            ? 'No-show'
                            : s.summary
                              ? 'Added'
                              : 'Missing'}
                        </td>
                        <td>
                          <Link
                            href={`/mentor/sessions/${s.id}`}
                            className="font-semibold text-[#9A7A45]"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {past.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="mt-3 text-xs font-semibold text-[#9A7A45]"
            >
              Export CSV <Download className="inline" size={13} />
            </button>
          )}
        </Card>
      );
    }

    if (list.length === 0) {
      return (
        <EmptyBlock
          title={
            search
              ? 'No sessions match that search'
              : tab === 'Needs summary'
                ? 'Nothing is waiting on a summary'
                : 'No upcoming sessions'
          }
          hint={
            search
              ? 'Clear the search to see every session.'
              : tab === 'Needs summary'
                ? 'Completed sessions without a summary will appear here.'
                : 'Schedule a session with one of your active startups to get started.'
          }
        />
      );
    }

    return <div className="space-y-3">{list.map(sessionCard)}</div>;
  };

  const nextSession = upcoming
    .slice()
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];

  return (
    <MentorPageShell active="Sessions" toast={toast} notify={notify}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#4A5568]">
            Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Sessions & sign-off
          </p>
          <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">Sessions</h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            See what’s coming up, what needs a summary and what has happened.
          </p>
        </div>
        <Btn onClick={openSchedule}>
          <Plus size={15} /> Schedule session
        </Btn>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Sessions this week', phase === 'ready' ? String(thisWeek) : '—'],
          [
            'Needs summary',
            phase === 'ready' ? String(needingSummary.length) : '—',
          ],
          ['Active mentorships', phase === 'ready' ? String(activeMentorships.length) : '—'],
          [
            'Open slots (28 days)',
            slotsPhase === 'ready'
              ? String(openSlotCount)
              : weekSlots.filter((s) => s.is_active !== false).length > 0
              ? `${weekSlots.filter((s) => s.is_active !== false).length} days/wk`
              : '0',
          ],
        ].map(([x, v], i) => (
          <div key={x} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <p className="text-xs text-[#4A5568]">{x}</p>
            <b
              className={`serif mt-1 block text-2xl ${
                i === 1 && v !== '0' && v !== '—' ? 'text-[#8A5700]' : 'text-[#0F1B2D]'
              }`}
            >
              {v}
            </b>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {['Upcoming', 'Needs summary', 'Past'].map((x) => (
          <button
            type="button"
            key={x}
            onClick={() => setTab(x)}
            className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-medium transition-colors ${
              tab === x
                ? 'bg-[#0F1B2D] text-white'
                : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <section className="min-w-0 space-y-3 xl:col-span-2">
          {tab !== 'Past' && (
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search size={15} className="absolute left-3 top-3 text-[#A0A7B4]" />
                <input
                  aria-label="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search startup or topic"
                  className="h-10 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>
          )}

          {body()}
        </section>

        <aside className="space-y-5">
          <Card title="Next session">
            {phase === 'ready' && nextSession ? (
              <>
                <p className="text-sm font-semibold text-[#0F1B2D]">
                  {mentorshipById.get(nextSession.mentorship_id)?.startup.display_name ||
                    'Startup'}
                </p>
                <p className="mt-1 text-xs text-[#4A5568]">
                  {formatInstant(nextSession.scheduled_at)} IST
                </p>
                <Link
                  href={`/mentor/sessions/${nextSession.id}`}
                  className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
                >
                  Prepare session <ArrowRight className="inline" size={12} />
                </Link>
              </>
            ) : (
              <p className="text-sm text-[#4A5568]">
                {phase === 'loading' ? 'Loading…' : 'No upcoming session.'}
              </p>
            )}
          </Card>

          <Card title="Availability">
            {weekPhase === 'loading' ? (
              <p className="text-xs text-[#4A5568]">Loading schedule…</p>
            ) : weekPhase === 'error' ? (
              <p className="text-xs text-[#B42318]">{weekError}</p>
            ) : (
              <div className="space-y-2">
                {weekSlots.filter((s) => s.is_active !== false).length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7B8CA3]">
                      Recurring Windows ({weekTimezone || IST})
                    </p>
                    <div className="space-y-1">
                      {weekSlots
                        .filter((s) => s.is_active !== false)
                        .map((s) => (
                          <div
                            key={s.weekday}
                            className="flex items-center justify-between text-xs text-[#0F1B2D]"
                          >
                            <span className="font-medium">
                              {WEEKDAYS[s.weekday]?.name || `Day ${s.weekday}`}
                            </span>
                            <span className="text-[#5A6E85]">
                              {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#4A5568]">
                    No recurring availability windows set yet.
                  </p>
                )}

                <div className="border-t border-[#E5E1D8] pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7B8CA3]">
                    Bookable Slots (28 Days)
                  </p>
                  {slotsPhase === 'ready' ? (
                    slots.length > 0 ? (
                      <p className="mt-1 text-xs text-[#4A5568]">
                        <span className="font-semibold text-[#0F1B2D]">{slots.length}</span> open{' '}
                        {slots.length === 1 ? 'slot' : 'slots'} · Next:{' '}
                        {formatDate(slots[0].local_date)} ({slots[0].local_start.slice(0, 5)})
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-[#4A5568]">
                        No open slots in the next 28 days.
                      </p>
                    )
                  ) : slotsPhase === 'loading' ? (
                    <p className="mt-1 text-xs text-[#4A5568]">Calculating bookable slots…</p>
                  ) : slotsPhase === 'nohandle' ? (
                    <p className="mt-1 text-xs text-[#4A5568]">
                      Set up your mentor handle to publish bookable slots.
                    </p>
                  ) : slotsPhase === 'error' ? (
                    <p className="mt-1 text-xs text-[#B42318]">{slotsError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-[#4A5568]">
                      Weekly windows generate open slots automatically.
                    </p>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={openEditAvailability}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7A45] hover:text-[#0F1B2D] transition"
            >
              <CalendarDays size={13} /> Edit availability
            </button>
          </Card>
        </aside>
      </div>

      {schedule && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold text-[#0F1B2D]">
                Schedule session
              </h2>
              <button
                type="button"
                onClick={() => setSchedule(false)}
                aria-label="Close"
                className="text-[#4A5568] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Startup
                <select
                  value={form.mentorship_id}
                  onChange={(e) => setForm({ ...form, mentorship_id: e.target.value })}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 focus:outline-none"
                >
                  <option value="">Choose a startup</option>
                  {activeMentorships.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.startup.display_name}
                    </option>
                  ))}
                </select>
                <FieldError>{formErrs.mentorship_id}</FieldError>
                {activeMentorships.length === 0 && (
                  <p className="mt-1 text-xs text-[#4A5568]">
                    You have no active mentorship to schedule into yet.
                  </p>
                )}
              </label>
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Session type
                <select
                  value={form.session_type}
                  onChange={(e) => setForm({ ...form, session_type: e.target.value })}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 focus:outline-none"
                >
                  <option value="advisory">Regular</option>
                  <option value="intro">Intro call</option>
                  <option value="review">Review</option>
                  <option value="pitch_practice">Pitch practice</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-[#0F1B2D]">
                Topic
                <input
                  aria-label="Session topic"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  placeholder="Session topic"
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 focus:outline-none"
                />
                <FieldError>{formErrs.topic}</FieldError>
              </label>

              <div>
                <span className="block text-sm font-medium text-[#0F1B2D]">Open slot</span>
                {slotsPhase === 'loading' ? (
                  <p className="mt-2 text-xs text-[#4A5568]">Loading your open slots…</p>
                ) : slotsPhase === 'error' ? (
                  <ErrorBlock
                    title="Could not load your slots"
                    message={slotsError}
                    onRetry={() => setSlotsPhase('idle')}
                  />
                ) : slotsPhase === 'nohandle' ? (
                  <p className="mt-2 text-xs text-[#4A5568]">
                    Your mentor profile has no public handle yet, so startups cannot book
                    you. Set it up in your profile first.
                  </p>
                ) : slots.length === 0 ? (
                  <div className="mt-2 rounded-lg border border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-3 text-center">
                    <p className="text-xs text-[#4A5568]">
                      No open slots in the next 28 days.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSchedule(false);
                        openEditAvailability();
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45] underline hover:text-[#0F1B2D]"
                    >
                      Set weekly availability now
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                    {slots.map((slot) => {
                      const value = `${istDateInput(slot.start)}|${slot.start.slice(11, 16)}`;
                      const checked =
                        form.date === istDateInput(slot.start) &&
                        form.time === slot.start.slice(11, 16);
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
                            name="slot"
                            className="mr-2 accent-[#0F1B2D]"
                            checked={checked}
                            onChange={() =>
                              setForm({
                                ...form,
                                date: istDateInput(slot.start),
                                time: slot.start.slice(11, 16),
                              })
                            }
                          />
                          {formatDate(slot.local_date)} ·{' '}
                          {String(slot.local_start).slice(0, 5)}
                          <input type="hidden" value={value} readOnly />
                        </label>
                      );
                    })}
                  </div>
                )}
                <FieldError>{formErrs.scheduled_at}</FieldError>
              </div>

              <label className="block text-sm font-medium text-[#0F1B2D]">
                Duration
                <select
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 focus:outline-none"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </label>
              <p className="text-xs text-[#4A5568]">
                Fee per mentorship agreement · No terms can be changed here. Startup confirms
                or proposes another time.
              </p>
              {formError && <FieldError>{formError}</FieldError>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSchedule(false)}
                className="min-h-10 px-4 text-sm font-medium text-[#4A5568] hover:text-[#0F1B2D]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitSchedule}
                disabled={saving}
                className="min-h-10 rounded-lg bg-[#0F1B2D] px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-60"
              >
                {saving ? 'Scheduling…' : 'Schedule session'}
              </button>
            </div>
          </section>
        </div>
      )}
      {editAvailability && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0F1B2D]/45 p-4 overflow-y-auto">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl my-8"
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#E5E1D8] pb-3">
              <div>
                <h2 className="serif text-xl font-semibold text-[#0F1B2D]">
                  Edit Weekly Availability
                </h2>
                <p className="text-xs text-[#5A6E85]">
                  Set recurring days and hours when startups can book 1:1 advisory sessions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditAvailability(false)}
                aria-label="Close"
                className="text-[#4A5568] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF8F4] p-3 text-xs text-[#5A6E85] border border-[#E5E1D8]">
              <div>
                <span className="font-semibold text-[#0F1B2D]">Timezone:</span>{' '}
                {weekTimezone || 'Asia/Kolkata (IST)'}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAvailabilityDraft((prev) =>
                      prev.map((d) => ({
                        ...d,
                        enabled: d.weekday >= 0 && d.weekday <= 4, // Mon-Fri
                        start_time: '10:00',
                        end_time: '17:00',
                      }))
                    );
                  }}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-[#9A7A45] hover:bg-[#F4F1EA]"
                >
                  Mon–Fri Preset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAvailabilityDraft((prev) =>
                      prev.map((d) => ({ ...d, enabled: false }))
                    );
                  }}
                  className="rounded px-2 py-1 text-[11px] font-medium text-[#7B8CA3] hover:bg-[#F4F1EA]"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {availabilityDraft.map((day, idx) => (
                <div
                  key={day.weekday}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition ${
                    day.enabled
                      ? 'border-[#0F1B2D]/20 bg-white shadow-xs'
                      : 'border-[#E5E1D8] bg-[#FAF8F4] opacity-75'
                  }`}
                >
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAvailabilityDraft((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, enabled: checked } : item
                          )
                        );
                      }}
                      className="h-4 w-4 rounded border-[#E5E1D8] accent-[#0F1B2D]"
                    />
                    <span
                      className={`text-xs font-semibold ${
                        day.enabled ? 'text-[#0F1B2D]' : 'text-[#7B8CA3]'
                      }`}
                    >
                      {day.name}
                    </span>
                  </label>

                  {day.enabled ? (
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="time"
                        value={day.start_time}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAvailabilityDraft((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, start_time: val } : item
                            )
                          );
                        }}
                        className="h-8 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs font-medium text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                      />
                      <span className="text-[#7B8CA3]">to</span>
                      <input
                        type="time"
                        value={day.end_time}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAvailabilityDraft((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, end_time: val } : item
                            )
                          );
                        }}
                        className="h-8 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs font-medium text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] font-medium text-[#7B8CA3] italic">
                      Unavailable
                    </span>
                  )}
                </div>
              ))}
            </div>

            {availabilityModalError && (
              <div className="mt-4 rounded-lg bg-[#FEE4E2] p-2.5 text-xs text-[#B42318]">
                {availabilityModalError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#E5E1D8] pt-4">
              <button
                type="button"
                onClick={() => setEditAvailability(false)}
                className="min-h-10 px-4 text-xs font-semibold text-[#4A5568] hover:text-[#0F1B2D]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAvailability}
                disabled={savingAvailability}
                className="min-h-10 rounded-lg bg-[#0F1B2D] px-5 text-xs font-bold text-white hover:bg-[#1C2B42] disabled:opacity-60 transition shadow-xs"
              >
                {savingAvailability ? 'Saving availability…' : 'Save availability'}
              </button>
            </div>
          </section>
        </div>
      )}
    </MentorPageShell>
  );
}
