'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  RotateCcw,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, dateLabel } from '@/components/career-data';

function scoreTier(score) {
  if (score == null) return 'Pending';
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Solid';
  return 'Developing';
}

export default function FeedbackReportPage() {
  const params = useParams();
  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : '';
  const [activeTab, setActiveTab] = useState('Rubric');
  const [mentorNotice, setMentorNotice] = useState(false);

  const reportRes = useCareerResource(
    sessionId ? `practice:report:${sessionId}` : null,
    (signal) => api.practice.getReport(sessionId, signal),
  );

  const report = reportRes.data;
  const session = report?.session;
  const dimensions = report?.dimensions || [];

  return (
    <JobSeekerShell active="Interview practice">
      <div className="space-y-6 max-w-5xl pb-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href="/jobseeker/practice"
            className="flex items-center gap-1 hover:text-[#0F1B2D]"
          >
            <ChevronLeft size={14} /> Back to Practice
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">Session Feedback Report</span>
        </nav>

        <ResourceState
          resource={reportRes}
          empty={!reportRes.loading && !reportRes.error && !report}
          emptyTitle="Report not available"
          emptyBody="Complete and score this practice session first to view your evaluation report."
          onRetry={reportRes.reload}
        >
          {session && (
            <>
              {/* Header Hero */}
              <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold text-[#806236] uppercase tracking-wider block mb-1">
                      AI Evaluation Report
                    </span>
                    <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                      {session.title || session.target_role || 'Practice Session'}
                    </h1>
                    <p className="text-xs text-[#6B7280] mt-1">
                      Completed on {dateLabel(session.completed_at || session.updated_at)} ·{' '}
                      Duration:{' '}
                      {session.duration_sec != null
                        ? `${Math.max(1, Math.round(session.duration_sec / 60))} min`
                        : '—'}{' '}
                      · {session.question_count} Questions
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/jobseeker/practice/new${
                        session.drill_id ? `?drill=${session.drill_id}` : ''
                      }`}
                    >
                      <JobBtn primary small className="flex items-center gap-1.5">
                        <RotateCcw size={13} /> Practice Again
                      </JobBtn>
                    </Link>
                    <Link href="/jobseeker/practice/rubric">
                      <JobBtn secondary small className="flex items-center gap-1.5">
                        <BookOpen size={13} /> View Full Rubric
                      </JobBtn>
                    </Link>
                  </div>
                </div>

                {/* Overall Score Banner */}
                <div className="pt-4 border-t border-[#F0EBE0] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#E7F3EC] text-xl font-serif font-bold text-[#286749]">
                      {session.score ?? '—'}%
                    </div>
                    <div>
                      <span className="text-sm font-bold text-[#0F1B2D] block">
                        Overall Readiness Score: {scoreTier(session.score)}
                      </span>
                      <p className="text-xs text-[#6B7280] max-w-xl">
                        {session.feedback || 'Evaluated across the 4 Forma interview dimensions.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {mentorNotice ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[#806236] font-medium bg-[#FAF8F4] border border-[#D4C3A3] px-3 py-1.5 rounded-lg">
                        Human mentor review requests arrive in Step 8 (Mentorships).
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMentorNotice(true)}
                        className="text-xs text-[#9A7A45] hover:underline font-semibold flex items-center gap-1"
                      >
                        Request Human Mentor Review →
                      </button>
                    )}
                  </div>
                </div>
              </header>

              {report?.ai_notice && (
                <div className="rounded-xl border border-[#D4C3A3] bg-[#FFF8E8] px-4 py-2.5 text-xs text-[#806236] flex items-center gap-2">
                  <Sparkles size={13} /> {report.ai_notice}
                </div>
              )}

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-[#E5E1D8] pb-2 text-xs">
                {['Rubric', 'Transcript'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-[#0F1B2D] text-white'
                        : 'text-[#4A5568] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    {tab === 'Rubric' ? 'Rubric Breakdown' : `Transcript (${(session.turns || []).length})`}
                  </button>
                ))}
              </div>

              {activeTab === 'Rubric' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {dimensions.map((dim) => (
                    <div
                      key={dim.key}
                      className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-serif font-bold text-[#0F1B2D]">
                          {dim.label}
                        </h3>
                        <span className="rounded-full bg-[#E7F3EC] px-2.5 py-0.5 text-xs font-bold text-[#286749]">
                          {dim.score}% ({dim.weight_pct}%)
                        </span>
                      </div>
                      <p className="text-xs text-[#4A5568] leading-relaxed">{dim.note}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'Transcript' && (
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-3">
                  {(session.turns || []).length === 0 ? (
                    <p className="text-xs text-[#6B7280]">No transcript turns recorded.</p>
                  ) : (
                    session.turns.map((turn) => (
                      <div
                        key={turn.id}
                        className={`rounded-xl p-4 text-xs leading-relaxed ${
                          turn.speaker === 'interviewer'
                            ? 'border border-[#D4C3A3] bg-[#FAF8F4] text-[#0F1B2D]'
                            : 'border border-[#CDE5D7] bg-[#E7F3EC]/40 text-[#1F2937] ml-6'
                        }`}
                      >
                        <span className="font-bold uppercase tracking-wider text-[10px] block mb-1 text-[#806236]">
                          {turn.speaker === 'interviewer' ? 'AI Interviewer' : 'Your Response'}
                        </span>
                        <p className="whitespace-pre-line">{turn.content}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </ResourceState>
      </div>
    </JobSeekerShell>
  );
}
