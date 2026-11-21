'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import { FieldError } from '@/components/async-state';

/** Review controls are limited by the server's eligibility and review state. */
export default function SessionReview({ session }) {
  const [existing, setExisting] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [form, setForm] = useState({ rating: 5, public_text: '', private_feedback: '', public_consent: false, anonymous: true });
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (session.status !== 'completed' || session.viewer_side !== 'startup') { setPhase('hidden'); return; }
    let live = true;
    setPhase('loading');
    api.reviews.mine(session.id).then((r) => { if (live) { setExisting(r); setPhase('ready'); } }).catch((e) => {
      if (!live) return;
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) { setExisting(null); setPhase(session.can_review ? 'ready' : 'hidden'); }
      else { setError(e instanceof ApiError ? e.message : 'Could not load your review.'); setPhase('error'); }
    });
    return () => { live = false; };
  }, [session.id, session.status, session.viewer_side, session.can_review, revision]);
  if (phase === 'hidden') return null;
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setFields({});
    try {
      const r = await api.reviews.create(session.id, { ...form, public_text: form.public_text.trim() || null, private_feedback: form.private_feedback.trim() || null });
      setExisting(r);
    } catch (err) {
      const errors = {};
      if (err instanceof ApiError && Array.isArray(err.details)) for (const d of err.details) {
        const key = d.loc?.at(-1); if (typeof key === 'string') errors[key] = d.msg;
      }
      setFields(errors); setError(err instanceof ApiError ? err.message : 'Could not submit review.');
    } finally { setBusy(false); }
  };
  const withdraw = async () => {
    if (!existing || !window.confirm('Withdraw this review? You cannot submit another for this session.')) return;
    setBusy(true); setError('');
    try { await api.reviews.remove(existing.id); setExisting(null); setPhase('hidden'); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not withdraw review.'); }
    finally { setBusy(false); }
  };
  return <section className="mt-5 rounded-xl border border-[#E5E1D8] bg-white p-4">
    <h2 className="text-sm font-semibold">Session review</h2>
    {phase === 'loading' && <p className="mt-2 text-xs" role="status">Loading review…</p>}
    {phase === 'error' && <button className="mt-2 text-xs text-[#B42318]" onClick={() => setRevision((n) => n + 1)}>{error} · Retry</button>}
    {phase === 'ready' && existing && <div className="mt-3 text-sm"><p>{existing.rating} / 5 · {existing.public_consent ? 'Publicly shared' : 'Private'}</p>{existing.public_text && <p className="mt-2">{existing.public_text}</p>}{existing.private_feedback && <p className="mt-2">Private feedback: {existing.private_feedback}</p>}<button disabled={busy} onClick={withdraw} className="mt-3 text-xs font-semibold text-[#B42318]">Withdraw review</button></div>}
    {phase === 'ready' && !existing && session.can_review && <form onSubmit={save} className="mt-3 space-y-3 text-sm">
      <label className="block">Rating<select className="mt-1 block w-full rounded border p-2" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select><FieldError>{fields.rating}</FieldError></label>
      <label className="block">Review<textarea className="mt-1 block w-full rounded border p-2" maxLength={2000} value={form.public_text} onChange={(e) => setForm({ ...form, public_text: e.target.value })} /><FieldError>{fields.public_text}</FieldError></label>
      <label className="block">Private feedback to your mentor<textarea className="mt-1 block w-full rounded border p-2" maxLength={2000} value={form.private_feedback} onChange={(e) => setForm({ ...form, private_feedback: e.target.value })} /><FieldError>{fields.private_feedback}</FieldError></label>
      <label className="flex gap-2"><input type="checkbox" checked={form.public_consent} onChange={(e) => setForm({ ...form, public_consent: e.target.checked })} /> Allow your rating and review to appear publicly</label>
      {form.public_consent && <label className="flex gap-2"><input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} /> Show anonymously on your public review</label>}
      <p className="text-xs text-[#4A5568]">Private feedback is never public. Reviews cannot be edited or resubmitted after withdrawal.</p>
      <button disabled={busy} className="rounded-lg bg-[#0F1B2D] px-4 py-2 text-xs font-semibold text-white">{busy ? 'Submitting…' : 'Submit review'}</button>
    </form>}
    {error && phase === 'ready' && <p role="alert" className="mt-2 text-xs text-[#B42318]">{error}</p>}
  </section>;
}
