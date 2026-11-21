'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Btn } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { EmptyBlock, ErrorBlock, LoadingBlock, fieldErrorsFrom, FieldError } from '@/components/async-state';
import { STAGE_LABEL } from '@/lib/mentorship-labels';

/**
 * `/mentor/discover` reuses Step 5h's `GET /startups` (the signed-in
 * discovery read), which already returns the startups that opted in to
 * mentor discovery. Building a mentorships-specific list would have meant a
 * second source of truth for the same thing.
 *
 * "Invite to mentorship" has no endpoint: 8b only lets a STARTUP request a
 * MENTOR. The button therefore opens the read-only profile and says so,
 * rather than pretending to send an invitation.
 */
export default function MentorDiscoverPage() {
  const router = useRouter();
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stage, setStage] = useState('');
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  const notify = useCallback((x) => {
    setToast(x);
    setTimeout(() => setToast(''), 2600);
  }, []);

  // Debounce the free-text box so typing does not fire a request per key.
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPhase('loading');
      setLoadError('');
      try {
        const page = await api.startups.discover(
          { limit: 50, stage: stage || undefined, q: searchTerm || undefined },
          undefined,
        );
        if (!alive) return;
        setItems(page.items);
        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        setLoadError(
          err instanceof ApiError ? err.message : 'Could not load startups.',
        );
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [searchTerm, stage, reload]);

  const stagesPresent = useMemo(
    () => Array.from(new Set(items.map((s) => s.stage))).filter(Boolean),
    [items],
  );

  return (
    <MentorPageShell active="Discover startups" toast={toast} notify={notify}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#4A5568]">
            Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Forma
          </p>
          <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
            Discover startups
          </h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            Explore startups that chose to be discoverable by mentors.
          </p>
        </div>
        <Btn
          secondary
          onClick={() => router.push('/mentor/profile/edit')}
        >
          Edit mentor preferences
        </Btn>
      </div>

      <div className="mb-4 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#806236]">
        Only startups that opted in to mentor discovery appear here. We don’t filter on personal
        characteristics of founders.
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-4">
        <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5">
          <h2 className="font-semibold text-[#0F1B2D]">Filters</h2>
          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-[#0F1B2D]">Stage</legend>
            {Object.entries(STAGE_LABEL).map(([key, label]) => (
              <label
                key={key}
                className="mt-2 flex items-center gap-2 text-xs text-[#4A5568]"
              >
                <input
                  type="radio"
                  name="stage"
                  checked={stage === key}
                  onChange={() => setStage(key)}
                  className="accent-[#0F1B2D]"
                />
                {label}
              </label>
            ))}
            {stage && (
              <button
                type="button"
                onClick={() => setStage('')}
                className="mt-2 text-xs font-semibold text-[#9A7A45]"
              >
                Clear stage
              </button>
            )}
          </fieldset>
          <p className="mt-4 text-xs text-[#4A5568]">
            {phase === 'ready'
              ? `${items.length} startup${items.length === 1 ? '' : 's'} in this view`
              : ' '}
          </p>
        </aside>

        <div className="space-y-3 lg:col-span-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-[#A0A7B4]" />
            <input
              aria-label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search startups"
              className="h-10 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm focus:border-[#0F1B2D] focus:outline-none"
            />
          </div>

          {phase === 'loading' ? (
            <LoadingBlock label="Loading startups…" rows={3} />
          ) : phase === 'error' ? (
            <ErrorBlock message={loadError} onRetry={() => setReload((n) => n + 1)} />
          ) : items.length === 0 ? (
            <EmptyBlock
              title={
                searchTerm || stage ? 'No startups match these filters' : 'No startups to show'
              }
              hint={
                searchTerm || stage
                  ? 'Clear the search or stage filter to see all discoverable startups.'
                  : 'Startups that opt in to mentor discovery will appear here.'
              }
            />
          ) : (
            items.map((s) => (
              <article
                key={s.slug}
                className="rounded-xl border border-[#E5E1D8] bg-white p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-lg font-semibold text-[#806236]">
                    {(s.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/mentor/discover/${s.slug}`)}
                      className="text-left font-semibold text-[#0F1B2D] hover:underline"
                    >
                      {s.name}
                    </button>
                    <p className="mt-1 text-xs text-[#4A5568]">
                      {s.tagline || 'No tagline added yet.'}
                    </p>
                    <p className="mt-2 text-xs text-[#4A5568]">
                      {[STAGE_LABEL[s.stage] || s.stage, s.sector, s.city]
                        .filter(Boolean)
                        .join(' · ') || 'No profile details yet'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EBE1] pt-3">
                  <p className="line-clamp-2 max-w-xl text-xs text-[#4A5568]">
                    {s.summary || 'No summary shared.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        notify(
                          'Only startups can start a mentorship request. Your profile is visible to them here.',
                        )
                      }
                      className="rounded-lg border border-[#E5E1D8] px-3 py-1.5 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4]"
                    >
                      How requests work
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/mentor/discover/${s.slug}`)}
                      className="rounded-lg bg-[#0F1B2D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1E2D42]"
                    >
                      View startup profile →
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </MentorPageShell>
  );
}
