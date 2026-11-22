'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { InvestorShell, Card, Button, StatusBadge } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api } from '@/lib/api/client';
import { InvestorDisclaimer } from '../investor-data';

// Demo-friendly meeting-type options mapped to the API enum + duration.
const MEETING_TYPES = [
  { value: 'intro_call', label: 'Introductory screening', minutes: 30 },
  { value: 'pitch', label: 'Full partner pitch', minutes: 45 },
  { value: 'diligence', label: 'Technical / diligence deep dive', minutes: 60 },
  { value: 'follow_up', label: 'Follow-up call', minutes: 30 },
  { value: 'other', label: 'Other', minutes: 30 },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InvestorMeetingsPage() {
  const [meetingTab, setMeetingTab] = useState('Upcoming');
  const [modal, setModal] = useState('');

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const [startups, setStartups] = useState([]);
  const [form, setForm] = useState({
    startup_org_id: '',
    meeting_type: 'intro_call',
    scheduled_at: '',
    agenda: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meetingPage, pendingPage] = await Promise.all([
        api.engagement.listMeetings({ limit: 100 }),
        api.engagement.listRequests({ status: 'pending', limit: 1 }),
      ]);
      setMeetings(meetingPage.items);
      setPendingCount(pendingPage.total);
    } catch (err) {
      setError(err?.message || 'Could not load your meetings.');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Startups available to schedule a meeting with (discovery module).
  useEffect(() => {
    let active = true;
    api
      .investorDiscovery.list({ limit: 50 })
      .then((page) => {
        if (active) setStartups(page.items);
      })
      .catch(() => {
        if (active) setStartups([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const now = useMemo(() => Date.now(), []);
  const weekEnd = useMemo(() => now + 7 * 24 * 60 * 60 * 1000, [now]);

  const upcoming = useMemo(
    () =>
      meetings
        .filter(
          (m) =>
            (m.status === 'proposed' || m.status === 'confirmed') &&
            new Date(m.scheduled_at).getTime() >= now,
        )
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
    [meetings, now],
  );

  const completed = useMemo(
    () =>
      meetings
        .filter((m) => m.status === 'completed')
        .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)),
    [meetings],
  );

  const meetingsThisWeek = useMemo(
    () =>
      meetings.filter((m) => {
        const t = new Date(m.scheduled_at).getTime();
        return t >= now && t <= weekEnd;
      }).length,
    [meetings, now, weekEnd],
  );

  // Calendar: group every meeting by its day.
  const calendar = useMemo(() => {
    const byDay = new Map();
    for (const m of meetings) {
      const key = new Date(m.scheduled_at).toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(m);
    }
    return byDay;
  }, [meetings]);

  const onSchedule = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.startup_org_id) {
      setFormError('Choose a startup to meet.');
      return;
    }
    if (!form.scheduled_at) {
      setFormError('Pick a proposed time.');
      return;
    }
    const type = MEETING_TYPES.find((t) => t.value === form.meeting_type);
    setSaving(true);
    try {
      await api.engagement.createMeeting({
        startup_org_id: form.startup_org_id,
        meeting_type: form.meeting_type,
        scheduled_at: form.scheduled_at,
        duration_minutes: type?.minutes ?? 30,
        agenda: form.agenda || null,
        location: form.location || null,
      });
      setModal('');
      setForm({
        startup_org_id: '',
        meeting_type: 'intro_call',
        scheduled_at: '',
        agenda: '',
        location: '',
      });
      await load();
    } catch (err) {
      setFormError(err?.message || 'Could not schedule the meeting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <InvestorShell
      active="Meetings"
      module="Deal flow"
      title="Pitch meetings & calls"
      description="Schedule, prepare and record decisions for founder pitch discussions."
      actions={
        <Button onClick={() => setModal('schedule')}>
          <Plus size={14} /> Schedule meeting
        </Button>
      }
    >
      {({ notify }) => (
        <>
          {/* Stat Strip */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Meetings this week', meetingsThisWeek],
              ['Requests waiting', pendingCount],
              ['Meetings without notes', completed.length],
              ['Avg. days to decision', '—'],
            ].map(([x, y]) => (
              <div key={x} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                <span className="text-xs font-medium text-[#4A5568]">{x}</span>
                <span className="serif mt-1 block text-3xl font-semibold text-ink">{y}</span>
              </div>
            ))}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['Upcoming', 'Requests', 'Needs notes', 'Past', 'Calendar'].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setMeetingTab(x)}
                className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                  meetingTab === x
                    ? 'bg-ink text-white'
                    : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                }`}
              >
                {x}
              </button>
            ))}
          </div>

          {loading && <LoadingBlock label="Loading meetings…" />}
          {!loading && error && (
            <ErrorBlock message={error} onRetry={load} />
          )}

          {!loading && !error && (
            <>
              {meetingTab === 'Upcoming' && (
                <div className="space-y-4">
                  {upcoming.length === 0 ? (
                    <EmptyBlock
                      title="No upcoming meetings"
                      hint="Schedule a meeting from a startup profile, or send an intro request to start the conversation."
                    >
                      <Button onClick={() => setModal('schedule')}>
                        <Plus size={14} /> Schedule meeting
                      </Button>
                    </EmptyBlock>
                  ) : (
                    upcoming.map((m) => (
                      <Card
                        key={m.id}
                        title={m.startup_name || 'Unknown startup'}
                        action={<StatusBadge status={m.status} />}
                      >
                        <p className="text-xs font-semibold text-ink">
                          {fmtDate(m.scheduled_at)} · {fmtTime(m.scheduled_at)}
                        </p>
                        <p className="mt-1 text-xs text-[#4A5568]">
                          {m.meeting_type} · {m.duration_minutes} min
                        </p>
                        {m.agenda && (
                          <p className="mt-2 text-xs text-ink">Agenda: {m.agenda}</p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E5E1D8] pt-3">
                          <Link
                            href={`/investor/startups/${m.startup_slug || m.startup_org_id}`}
                            className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                          >
                            Prepare profile & deck
                          </Link>
                          <button
                            type="button"
                            onClick={() => notify('Calendar invite (.ics) downloaded.')}
                            className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
                          >
                            Add to calendar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              notify('Meeting join room opens 10 minutes prior to session.')
                            }
                            className="rounded-lg bg-ink px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                          >
                            Join video room
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {meetingTab === 'Requests' && (
                <EmptyBlock
                  title="No incoming meeting invitations"
                  hint="Meetings are proposed by investors. Confirmations and reschedule requests from founders appear on the meetings you proposed."
                />
              )}

              {meetingTab === 'Needs notes' && (
                <Card title="Completed meetings awaiting debrief notes">
                  {completed.length === 0 ? (
                    <EmptyBlock
                      title="No completed meetings yet"
                      hint="Completed meetings will appear here for debrief notes."
                    />
                  ) : (
                    <div className="space-y-3">
                      {completed.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between border-b border-[#E5E1D8] pb-3 last:border-0 last:pb-0"
                        >
                          <div>
                            <b className="block text-xs font-semibold text-ink">
                              {m.startup_name || 'Unknown startup'} · {m.meeting_type}
                            </b>
                            <span className="text-xs text-[#4A5568]">
                              Held {fmtDate(m.scheduled_at)}
                            </span>
                          </div>
                          <Link
                            href={`/investor/startups/${m.startup_slug || m.startup_org_id}/diligence`}
                            className="text-xs font-semibold text-[#9A7A45] hover:underline"
                          >
                            Add diligence notes →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {meetingTab === 'Past' && (
                <Card title="Past meetings archive">
                  {completed.length === 0 ? (
                    <EmptyBlock
                      title="No past meetings"
                      hint="Completed meetings will be archived here."
                    />
                  ) : (
                    <div className="space-y-2">
                      {completed.map((m) => (
                        <p key={m.id} className="text-xs text-ink">
                          {fmtDate(m.scheduled_at)} · {m.startup_name || 'Unknown startup'} ·{' '}
                          {m.meeting_type} · {m.status}
                        </p>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {meetingTab === 'Calendar' && (
                <Card
                  title={`Meeting calendar · ${new Date().toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })}`}
                >
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {WEEKDAYS.map((d) => (
                      <span key={d} className="font-semibold text-[#4A5568] p-2">
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: 30 }, (_, i) => String(i + 1)).map((day) => {
                      const key = `${new Date().getFullYear()}-${String(
                        new Date().getMonth() + 1,
                      ).padStart(2, '0')}-${day.padStart(2, '0')}`;
                      const dayMeetings = calendar.get(key) || [];
                      return (
                        <div
                          key={day}
                          className={`rounded-lg p-3 border border-[#E5E1D8] ${
                            dayMeetings.length > 0
                              ? 'bg-[#F3EBDD] font-bold text-ink border-[#B8955A]'
                              : 'bg-white text-[#4A5568]'
                          }`}
                        >
                          {day}
                          {dayMeetings.length > 0 && (
                            <span className="block mt-1 text-[10px] text-[#806236]">
                              {dayMeetings.length} meet
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {meetings.length === 0 && (
                    <p className="mt-3 text-xs text-[#4A5568]">
                      No meetings scheduled this month.
                    </p>
                  )}
                </Card>
              )}
            </>
          )}

          <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

          {/* Schedule Meeting Modal */}
          {modal === 'schedule' && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
              <section
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="serif text-xl font-bold text-ink">Schedule pitch meeting</h2>
                  <button type="button" onClick={() => setModal('')}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={onSchedule} className="space-y-3">
                  <div>
                    <label htmlFor="sched-startup" className="block text-xs font-medium text-ink">
                      Startup
                    </label>
                    <select
                      id="sched-startup"
                      value={form.startup_org_id}
                      onChange={(e) => setForm({ ...form, startup_org_id: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                    >
                      <option value="">Select a startup…</option>
                      {startups.map((s) => (
                        <option key={s.org_id} value={s.org_id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sched-type" className="block text-xs font-medium text-ink">
                      Meeting type
                    </label>
                    <select
                      id="sched-type"
                      value={form.meeting_type}
                      onChange={(e) => setForm({ ...form, meeting_type: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                    >
                      {MEETING_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label} ({t.minutes} min)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sched-time" className="block text-xs font-medium text-ink">
                      Proposed time
                    </label>
                    <input
                      id="sched-time"
                      type="datetime-local"
                      required
                      value={form.scheduled_at}
                      onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="sched-agenda" className="block text-xs font-medium text-ink">
                      Agenda (optional)
                    </label>
                    <textarea
                      id="sched-agenda"
                      rows={2}
                      value={form.agenda}
                      onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-xs focus:border-ink focus:outline-none"
                    />
                  </div>
                  {formError && (
                    <p className="text-xs font-medium text-[#B42318]" role="alert">
                      {formError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setModal('')}
                      className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]"
                    >
                      Cancel
                    </button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Sending…' : 'Send invitation'}
                    </Button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </>
      )}
    </InvestorShell>
  );
}
