'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  Video,
  Sparkles,
  Search,
  Calendar,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';

const formatLabel = (format) =>
  ({ video: 'Video Call', phone: 'Phone Call', onsite: 'On-site', async: 'Async' })[format] || format;

const whenLabel = (iso) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
};

const LIVE = ['scheduled', 'confirmed'];

export default function InterviewsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Upcoming');
  const [search, setSearch] = useState('');
  const [responding, setResponding] = useState({ id: '', busy: false, error: '' });

  const resource = useCareerResource('jobseeker-interviews', async (signal) => {
    const apps = await api.careers.applications({ limit: 100 }, signal);
    const pages = await Promise.all(
      apps.items.map((app) => api.interviews.candidateList(app.id, { limit: 100 }, signal))
    );
    return pages.flatMap((page, i) => page.items.map((item) => ({ ...item, application_id: apps.items[i].id })));
  });

  const interviews = resource.data || [];
  const myResponse = (item) => item.participants.find((p) => p.user_id === user?.id)?.response ?? null;
  const upcoming = interviews.filter((i) => LIVE.includes(i.status) && new Date(i.scheduled_at) > new Date());
  const needsAction = upcoming.filter((i) => myResponse(i) === null);
  const past = interviews.filter((i) => !LIVE.includes(i.status) || new Date(i.scheduled_at) <= new Date());

  const filtered = (tab === 'Upcoming' ? upcoming : tab === 'Needs action' ? needsAction : past).filter((i) => {
    if (!search.trim()) return true;
    const hay = `${i.job_title} ${i.company_name}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const respond = async (item, response) => {
    setResponding({ id: item.id, busy: true, error: '' });
    try {
      await api.interviews.respond(item.id, { response });
      resource.reload();
    } catch (error) {
      setResponding({
        id: item.id,
        busy: false,
        error: error instanceof ApiError ? error.message : 'Could not send your response. Please try again.',
      });
    }
  };

  return (
    <JobSeekerShell active="Interviews">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Interview Schedule & Preparation
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Confirmed video calls, slot confirmations, and tailored AI interview prep sessions.
            </p>
          </div>

          <Link href="/jobseeker/practice/new">
            <JobBtn primary small className="flex items-center gap-1.5">
              <Sparkles size={14} /> Start AI Practice
            </JobBtn>
          </Link>
        </div>

        {/* Tab Strip */}
        <div className="rounded-xl border border-[#E5E1D8] bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto min-w-0 pb-1">
            {['Upcoming', 'Needs action', 'Past'].map((t) => {
              const count =
                t === 'Upcoming' ? upcoming.length : t === 'Needs action' ? needsAction.length : past.length;
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    active
                      ? 'border-[#B8955A] bg-[#F3EBDD] text-[#806236]'
                      : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                  }`}
                >
                  {t} <span className="opacity-60 font-normal">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={15} />
            <input
              type="text"
              aria-label="Search interviews"
              placeholder="Search by role or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4]/50 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            />
          </div>
        </div>

        {resource.loading ? (
          <LoadingBlock label="Loading interviews…" />
        ) : resource.error ? (
          <ErrorBlock
            message={
              resource.error instanceof ApiError
                ? resource.error.message
                : 'Could not load your interviews. Please try again.'
            }
            onRetry={resource.reload}
          />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            title={`No ${tab.toLowerCase()} interviews`}
            hint={
              tab === 'Upcoming'
                ? 'When employers shortlist your profile and propose interview slots, they will appear here.'
                : tab === 'Needs action'
                  ? 'All clear! No pending interview actions required.'
                  : 'Completed and cancelled interviews will appear here.'
            }
          >
            <Link href="/jobseeker/practice" className="inline-block">
              <JobBtn secondary small>
                Prepare with AI Practice
              </JobBtn>
            </Link>
          </EmptyBlock>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => {
              const { date, time } = whenLabel(item.scheduled_at);
              const interviewers = item.participants
                .filter((p) => p.side === 'interviewer')
                .map((p) => p.display_name);
              const pending = LIVE.includes(item.status) && myResponse(item) === null;
              return (
                <div key={item.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-[#0F1B2D]">{item.job_title}</h2>
                        <span className="rounded-full bg-[#E7F3EC] px-2 py-0.5 text-xs text-[#286749] font-medium">
                          {formatLabel(item.format)}
                        </span>
                        <span className="rounded-full bg-[#FAF8F4] border border-[#E5E1D8] px-2 py-0.5 text-xs text-[#4A5568] capitalize">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280]">
                        with <strong className="text-[#0F1B2D]">{item.company_name}</strong>{' '}
                        {interviewers.length > 0 ? `· ${interviewers.join(', ')}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.meeting_url && (
                        <a
                          href={item.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 min-h-[34px] px-3.5 rounded-lg bg-[#0F1B2D] text-white text-xs font-semibold hover:bg-[#1C2B42]"
                        >
                          <Video size={13} /> Join Call
                        </a>
                      )}
                      <Link href={`/jobseeker/practice/new?role=${encodeURIComponent(item.job_title)}`}>
                        <JobBtn secondary small className="flex items-center gap-1.5">
                          <Sparkles size={13} className="text-[#806236]" /> AI Prep Drill
                        </JobBtn>
                      </Link>
                    </div>
                  </div>

                  {pending && (
                    <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 space-y-2">
                      <p className="text-xs font-medium text-[#0F1B2D]">
                        The employer is waiting for your response to this slot.
                      </p>
                      {responding.id === item.id && responding.error && (
                        <FieldError>{responding.error}</FieldError>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {[
                          ['accepted', 'Accept'],
                          ['tentative', 'Maybe'],
                          ['declined', 'Decline'],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            disabled={responding.busy}
                            onClick={() => respond(item, value)}
                            className={`min-h-[32px] rounded-lg px-3.5 text-xs font-semibold border transition-colors disabled:opacity-60 ${
                              value === 'accepted'
                                ? 'border-[#286749] bg-[#E7F3EC] text-[#286749] hover:bg-[#D7EDE1]'
                                : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-[#4A5568] pt-3 border-t border-[#F0EBE0]">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-[#A0A7B4]" /> {date}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-[#A0A7B4]" /> {time} ({item.duration_min} mins)
                    </span>
                    {item.location && (
                      <>
                        <span>·</span>
                        <span className="text-[#9A7A45] font-medium">{item.location}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </JobSeekerShell>
  );
}
