'use client';

import { useEffect, useState } from 'react';
import MentorPageShell from '../mentor-page-shell';
import { Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/async-state';

export default function MentorImpactPage() {
  const [tab, setTab] = useState('My impact');
  const [impact, setImpact] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [profile, setProfile] = useState(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setImpact(null); setReviews(null); setError('');
    Promise.all([api.mentorWorkspace.impact(controller.signal), api.reviews.forMentor({ limit: 10, offset }, controller.signal), api.mentorProfile.me(controller.signal)])
      .then(([i, r, p]) => { if (!controller.signal.aborted) { setImpact(i); setReviews(r); setProfile(p); } })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : 'Could not load impact.'); });
    return () => controller.abort();
  }, [revision, offset]);
  return <MentorPageShell active="Impact & reviews">
    <div className="mb-6"><p className="text-sm text-[#4A5568]">Mentor workspace · Impact</p><h1 className="serif mt-1 text-[30px] font-semibold">Impact and reviews</h1><p className="mt-1 text-sm text-[#4A5568]">A verified record of your mentorship outcomes and feedback.</p></div>
    <div className="mb-4 flex gap-2 overflow-x-auto">{['My impact', 'Reviews', 'Public view'].map((x) => <button key={x} onClick={() => setTab(x)} className={`min-h-10 rounded-lg px-4 text-xs ${tab === x ? 'bg-[#0F1B2D] text-white' : 'border border-[#E5E1D8] bg-white'}`}>{x}</button>)}</div>
    {error ? <ErrorBlock message={error} onRetry={() => setRevision((n) => n + 1)} /> : !impact || !reviews ? <LoadingBlock label="Loading impact and reviews" /> : tab === 'My impact' ? <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Startups mentored', impact.startups_mentored, `${impact.active_startups} active`], ['Sessions delivered', impact.sessions_delivered, 'Completed sessions'], ['Current sign-offs', impact.current_signoffs, 'Currently signed off'], ['Investment Ready badges helped earn', '—', 'Attribution unavailable']].map(([a,b,c]) => <div key={a} className="rounded-xl border border-[#E5E1D8] bg-white p-4"><p className="text-xs text-[#4A5568]">{a}</p><b className="serif mt-1 block text-2xl">{b}</b><small className="text-xs text-[#4A5568]">{c}</small></div>)}</div>
      <div className="grid items-start gap-5 xl:grid-cols-3"><div className="space-y-5 xl:col-span-2"><Card title="Startup outcomes"><p className="text-xs text-[#4A5568]">Consented startup outcomes are not available yet.</p></Card><Card title="Readiness progress"><p className="text-xs text-[#4A5568]">Historical readiness trends are not available yet.</p></Card><Card title="Expertise and milestones"><p className="text-xs text-[#4A5568]">Attributable milestones are not available yet.</p></Card></div><aside className="space-y-5"><Card title="Time & responsiveness"><p className="text-xs text-[#4A5568]">Responsiveness metrics are not available yet.</p></Card><Card title="Testimonials"><p className="text-xs text-[#4A5568]">See publicly shared reviews in the Reviews tab.</p></Card></aside></div>
    </> : tab === 'Reviews' ? <div className="grid items-start gap-5 xl:grid-cols-3"><div className="xl:col-span-2"><Card title="Reviews"><p className="mb-4 text-sm">{profile?.rating != null ? `${profile.rating} average (all your reviews)` : 'No average yet'} · {reviews.total} reviews</p><p className="mb-4 text-xs text-[#4A5568]">Public ratings use only reviews explicitly shared publicly and appear after three public reviews.</p>{reviews.items.length === 0 ? <EmptyBlock title="No reviews yet" hint="Feedback from completed sessions will appear here." /> : reviews.items.map((r) => <article key={r.id} className="border-t border-[#E5E1D8] py-4 text-sm"><b>{r.rating} / 5</b><span className="ml-2 text-xs text-[#4A5568]">{r.startup_name || 'Startup'} · {r.session_topic || 'Session'} · {new Date(r.created_at).toLocaleDateString()}</span>{r.public_text && <p className="mt-2 whitespace-pre-wrap">{r.public_text}</p>}<p className="mt-1 text-xs text-[#4A5568]">{r.public_consent ? 'Publicly shared' : 'Private review'}</p>{r.private_feedback && <p className="mt-2 rounded bg-[#FAF8F4] p-3 text-xs">Private feedback: {r.private_feedback}</p>}</article>)}<div className="mt-3 flex gap-3 text-xs"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset-10))}>Previous</button><span>{reviews.total ? offset+1 : 0}–{offset+reviews.items.length} of {reviews.total}</span><button disabled={offset+reviews.items.length >= reviews.total} onClick={() => setOffset(offset+10)}>Next</button></div></Card></div><aside><Card title="Private feedback"><p className="text-xs text-[#4A5568]">Private feedback is shown only to you alongside each review.</p></Card></aside></div> : <div className="grid gap-5 lg:grid-cols-2"><Card title="Public impact preview"><p className="text-sm text-[#4A5568]">A public impact preview is not available yet.</p></Card><Card title="Public visibility"><p className="text-sm text-[#4A5568]">Impact visibility settings are not available yet.</p></Card></div>}
  </MentorPageShell>;
}
