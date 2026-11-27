'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Search,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, Pagination, dateLabel, errorLabel } from '@/components/career-data';

export default function PracticeHistoryPage() {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const sessionsRes = useCareerResource(
    `practice:history:${offset}`,
    (signal) =>
      api.practice.listSessions(
        { limit: 20, offset, sort: 'created_at', order: 'desc' },
        signal,
      ),
  );

  const sessions = useMemo(() => sessionsRes.data?.items || [], [sessionsRes.data]);
  const total = sessionsRes.data?.total ?? 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) =>
      `${s.title || ''} ${s.target_role || ''} ${s.focus_area || ''}`.toLowerCase().includes(q),
    );
  }, [sessions, search]);

  const handleDelete = async (id) => {
    setBusyId(id);
    setActionError('');
    try {
      await api.practice.deleteSession(id);
      sessionsRes.reload();
    } catch (err) {
      setActionError(errorLabel(err, 'Could not delete practice session.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <JobSeekerShell active="Interview practice">
      <div className="space-y-6 max-w-5xl pb-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href="/jobseeker/practice"
            className="flex items-center gap-1 hover:text-[#0F1B2D]"
          >
            <ChevronLeft size={14} /> Back to Practice Hub
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">Session History</span>
        </nav>

        {/* Header */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Past Practice Sessions
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Review your historical transcripts, AI rubrics, and track delivery improvements over time.
            </p>
          </div>

          <Link href="/jobseeker/practice/new">
            <JobBtn primary small>
              + New Practice Session
            </JobBtn>
          </Link>
        </header>

        {/* Search */}
        <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={15} />
            <input
              type="text"
              aria-label="Search past sessions"
              placeholder="Search by role or focus area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4]/50 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            />
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] px-4 py-3 text-xs text-[#B42318]">
            {actionError}
          </div>
        )}

        {/* Sessions List */}
        <ResourceState
          resource={sessionsRes}
          empty={!sessionsRes.loading && !sessionsRes.error && filtered.length === 0}
          emptyTitle="No practice sessions found"
          emptyBody="Start a new AI practice session to build your history."
          onRetry={sessionsRes.reload}
        >
          <div className="space-y-3">
            {filtered.map((s) => {
              const isCompleted = s.status === 'completed';
              const mins = s.duration_sec != null ? `${Math.max(1, Math.round(s.duration_sec / 60))} min` : '—';
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-[#0F1B2D]">
                        {s.title || s.target_role || 'Practice Session'}
                      </h3>
                      {s.score != null ? (
                        <span className="rounded-full bg-[#E7F3EC] px-2 py-0.5 text-xs text-[#286749] font-medium">
                          Score: {s.score}%
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#6B7280] capitalize">
                          {s.status.replace('_', ' ')}
                        </span>
                      )}
                      {s.focus_area && (
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#6B7280]">
                          {s.focus_area}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {dateLabel(s.created_at)} · Duration: {mins} · {s.question_count} questions
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={
                        isCompleted
                          ? `/jobseeker/practice/${s.id}/report`
                          : `/jobseeker/practice/${s.id}`
                      }
                    >
                      <JobBtn primary small className="flex items-center gap-1.5">
                        {isCompleted ? 'View Report' : 'Continue'} <ArrowRight size={13} />
                      </JobBtn>
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === s.id}
                      onClick={() => handleDelete(s.id)}
                      className="p-2 text-[#A0A7B4] hover:text-[#B42318] hover:bg-[#FCE8E6] rounded-lg transition-colors disabled:opacity-50"
                      aria-label="Delete session"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={{ offset, limit: 20, total }}
            onChange={setOffset}
          />
        </ResourceState>
      </div>
    </JobSeekerShell>
  );
}
