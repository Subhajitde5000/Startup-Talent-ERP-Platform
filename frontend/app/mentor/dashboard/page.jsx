'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MentorPageShell from '../mentor-page-shell';
import { Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/async-state';

export default function MentorDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setSessions(null); setError('');
    Promise.all([api.mentorWorkspace.dashboard({ limit: 50 }, controller.signal), api.sessions.list({ upcoming: true, limit: 50 }, controller.signal)])
      .then(([d, s]) => { if (!controller.signal.aborted) { setData(d); setSessions(s); } })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : 'Could not load dashboard.'); });
    return () => controller.abort();
  }, [revision]);
  const money = (n, c) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: c }).format(Number(n));
  return <MentorPageShell active="Dashboard">
    <div className="mb-6"><p className="text-sm text-[#4A5568]">Mentor workspace · Forma</p><h1 className="serif mt-1 text-[30px] font-semibold">Welcome{user?.display_name ? `, ${user.display_name}` : ''}</h1><p className="mt-1 text-sm text-[#4A5568]">Your mentorship priorities, sessions and impact.</p></div>
    {error ? <ErrorBlock message={error} onRetry={() => setRevision((n) => n + 1)} /> : !data || !sessions ? <LoadingBlock label="Loading dashboard" /> : <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Active startups', data.impact.active_startups], ['Sessions delivered', data.impact.sessions_delivered], ['Current sign-offs', data.impact.current_signoffs], ['Pending earnings', money(data.earnings.pending_amount, data.earnings.currency)]].map(([label, value]) => <div key={label} className="rounded-xl border border-[#E5E1D8] bg-white p-4"><p className="text-xs text-[#4A5568]">{label}</p><b className="serif mt-1 block text-2xl">{value}</b></div>)}</div>
      <div className="grid items-start gap-5 xl:grid-cols-3"><div className="space-y-5 xl:col-span-2"><Card title="Needs your attention"><p className="text-xs text-[#4A5568]">A consolidated attention queue is not available yet.</p></Card><Card title="Upcoming sessions">{sessions.items.length ? sessions.items.map((s) => <div key={s.id} className="border-b border-[#E5E1D8] py-3 text-sm"><Link href={`/mentor/sessions/${s.id}`} className="font-semibold text-[#9A7A45]">{s.topic || 'Mentoring session'}</Link><p className="text-xs text-[#4A5568]">{new Date(s.scheduled_at).toLocaleString()}</p></div>) : <EmptyBlock title="No upcoming sessions" />} {sessions.total > sessions.items.length && <Link className="mt-2 inline-block text-xs" href="/mentor/sessions">View all sessions</Link>}</Card><Card title="My startups at a glance">{data.mentorships.items.length ? <div className="grid gap-3 md:grid-cols-2">{data.mentorships.items.map((m) => <Link key={m.id} href={`/mentor/startups/${m.id}`} className="rounded-lg border border-[#E5E1D8] p-3 text-sm"><b>{m.startup?.display_name || 'Startup'}</b><p className="mt-1 text-xs text-[#4A5568]">{m.status.replaceAll('_', ' ')} · Health unavailable</p></Link>)}</div> : <EmptyBlock title="No mentorships yet" />} {data.mentorships.total > data.mentorships.items.length && <Link href="/mentor/startups" className="mt-3 inline-block text-xs">View all startups</Link>}</Card><Card title="Impact trend"><p className="text-xs text-[#4A5568]">Historical readiness trends are not available yet.</p></Card></div><aside className="space-y-5"><Card title="Next session">{sessions.items[0] ? <Link href={`/mentor/sessions/${sessions.items[0].id}`} className="text-sm">{sessions.items[0].topic || 'Mentoring session'} · {new Date(sessions.items[0].scheduled_at).toLocaleString()}</Link> : <p className="text-xs text-[#4A5568]">No upcoming session.</p>}</Card><Card title="Capacity"><Link href="/mentor/profile/edit" className="text-xs text-[#9A7A45]">Manage availability and capacity</Link></Card><Card title="Earnings snapshot"><p className="text-xs text-[#4A5568]">Pending earnings</p><b className="serif text-2xl">{money(data.earnings.pending_amount, data.earnings.currency)}</b><Link href="/mentor/earnings" className="mt-3 block text-xs text-[#9A7A45]">View earnings →</Link></Card></aside></div>
    </>}
  </MentorPageShell>;
}
