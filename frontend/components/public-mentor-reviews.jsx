'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';

export default function PublicMentorReviews({ handle }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true; setData(null); setError('');
    api.reviews.public(handle, { limit: 10, offset }).then((r) => { if (live) setData(r); }).catch((e) => { if (live) setError(e instanceof ApiError ? e.message : 'Could not load reviews.'); });
    return () => { live = false; };
  }, [handle, offset, retry]);
  if (error) return <p role="alert" className="mt-3 text-xs text-[#B42318]">{error} <button onClick={() => setRetry((n) => n + 1)}>Retry</button></p>;
  if (!data) return <p role="status" className="mt-3 text-xs">Loading reviews…</p>;
  if (!data.total) return <p className="mt-3 text-xs text-[#4A5568]">No publicly shared reviews yet.</p>;
  return <div className="mt-3 space-y-3">{data.items.map((r, index) => <article className="border-t border-[#E5E1D8] pt-3 text-sm" key={`${offset}-${index}`}><p>{r.rating} / 5 · {r.reviewer_name || 'Anonymous'} · {new Date(r.created_at).toLocaleDateString()}</p>{r.public_text && <p className="mt-1 whitespace-pre-wrap">{r.public_text}</p>}</article>)}<div className="flex gap-3 text-xs"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 10))}>Previous</button><span>{offset + 1}–{offset + data.items.length} of {data.total}</span><button disabled={offset + data.items.length >= data.total} onClick={() => setOffset(offset + 10)}>Next</button></div></div>;
}
