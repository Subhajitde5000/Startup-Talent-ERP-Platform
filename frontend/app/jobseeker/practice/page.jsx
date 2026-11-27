'use client';

import React from 'react';
import Link from 'next/link';
import {
  Play,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, dateLabel } from '@/components/career-data';

function readinessTier(avgScore) {
  if (avgScore == null) return 'Not scored';
  if (avgScore >= 85) return 'Strong';
  if (avgScore >= 70) return 'Solid';
  return 'Developing';
}

export default function TrainerHomePage() {
  const summaryRes = useCareerResource('practice:summary', (signal) =>
    api.practice.summary(signal),
  );
  const sessionsRes = useCareerResource('practice:recent', (signal) =>
    api.practice.listSessions({ limit: 5, sort: 'created_at', order: 'desc' }, signal),
  );
  const drillsRes = useCareerResource('practice:hub-drills', (signal) =>
    api.practice.listDrills({ limit: 3 }, signal),
  );

  const summary = summaryRes.data;
  const sessions = sessionsRes.data?.items || [];
  const totalSessions = sessionsRes.data?.total ?? 0;
  const drills = drillsRes.data?.items || [];

  return (
    <JobSeekerShell active="Interview practice">
      <div className="space-y-6 max-w-5xl pb-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              AI Interview Trainer
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Simulate high-stakes founder interviews, practice responses, and get instant rubric scoring.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/jobseeker/practice/new">
              <JobBtn primary small className="flex items-center gap-1.5">
                <Play size={14} /> Start New Session
              </JobBtn>
            </Link>
            <Link href="/jobseeker/practice/drills">
              <JobBtn secondary small>
                Quick Drills
              </JobBtn>
            </Link>
          </div>
        </div>

        {/* Metric Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <span className="text-xs text-[#6B7280]">Sessions Completed</span>
            <div className="mt-1 text-2xl font-serif font-bold text-[#0F1B2D]">
              {summary ? summary.completed_sessions : '—'}
            </div>
            <span className="text-xs text-[#286749]">
              {summary ? `${summary.total_sessions} total started` : 'Loading...'}
            </span>
          </div>
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <span className="text-xs text-[#6B7280]">Average Rubric Score</span>
            <div className="mt-1 text-2xl font-serif font-bold text-[#806236]">
              {summary?.avg_score != null ? `${summary.avg_score}%` : '—'}
            </div>
            <span className="text-xs text-[#6B7280]">
              {summary?.best_score != null ? `Best: ${summary.best_score}%` : 'Complete a session'}
            </span>
          </div>
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <span className="text-xs text-[#6B7280]">Practice Time</span>
            <div className="mt-1 text-2xl font-serif font-bold text-[#0F1B2D]">
              {summary ? `${summary.total_practice_min} min` : '—'}
            </div>
            <span className="text-xs text-[#6B7280]">Recorded practice</span>
          </div>
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <span className="text-xs text-[#6B7280]">Readiness Level</span>
            <div className="mt-1 text-2xl font-serif font-bold text-[#286749]">
              {readinessTier(summary?.avg_score)}
            </div>
            <Link href="/jobseeker/readiness" className="text-xs text-[#9A7A45] hover:underline font-medium">
              View breakdown →
            </Link>
          </div>
        </div>

        {/* Quick Nav sub-tabs */}
        <div className="flex items-center gap-2 border-b border-[#E5E1D8] pb-2 text-xs overflow-x-auto">
          <Link
            href="/jobseeker/practice"
            className="px-3.5 py-1.5 rounded-lg bg-[#0F1B2D] text-white font-medium shrink-0"
          >
            Practice Hub
          </Link>
          <Link
            href="/jobseeker/practice/drills"
            className="px-3.5 py-1.5 rounded-lg text-[#4A5568] hover:bg-[#FAF8F4] font-medium shrink-0"
          >
            Skill Drills
          </Link>
          <Link
            href="/jobseeker/practice/history"
            className="px-3.5 py-1.5 rounded-lg text-[#4A5568] hover:bg-[#FAF8F4] font-medium shrink-0"
          >
            Past Sessions
          </Link>
          <Link
            href="/jobseeker/practice/rubric"
            className="px-3.5 py-1.5 rounded-lg text-[#4A5568] hover:bg-[#FAF8F4] font-medium shrink-0"
          >
            Scoring Rubric
          </Link>
          <Link
            href="/jobseeker/readiness"
            className="px-3.5 py-1.5 rounded-lg text-[#4A5568] hover:bg-[#FAF8F4] font-medium shrink-0"
          >
            Readiness Index
          </Link>
        </div>

        {/* Main 2-column Hub Content */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Recent Practice Sessions */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                Recent Practice Sessions
              </h2>
              <Link href="/jobseeker/practice/history" className="text-xs text-[#9A7A45] hover:underline font-semibold">
                View all ({totalSessions})
              </Link>
            </div>

            <ResourceState
              resource={sessionsRes}
              empty={!sessionsRes.loading && !sessionsRes.error && sessions.length === 0}
              emptyTitle="No practice sessions yet"
              emptyBody="Launch your first AI mock interview to get rubric scores and actionable feedback."
              onRetry={sessionsRes.reload}
            >
              <div className="space-y-3">
                {sessions.map((session) => {
                  const isCompleted = session.status === 'completed';
                  const mins = session.duration_sec != null ? `${Math.max(1, Math.round(session.duration_sec / 60))} min` : '—';
                  return (
                    <div
                      key={session.id}
                      className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-[#0F1B2D]">
                              {session.title || session.target_role || 'Practice Session'}
                            </h3>
                            {session.score != null ? (
                              <span className="rounded-full bg-[#E7F3EC] px-2 py-0.5 text-xs text-[#286749] font-medium">
                                Score: {session.score}%
                              </span>
                            ) : (
                              <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#6B7280] capitalize">
                                {session.status.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#6B7280]">
                            {session.focus_area || 'General'} · {mins} · {dateLabel(session.created_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCompleted && (
                            <Link href={`/jobseeker/practice/${session.id}/report`}>
                              <JobBtn secondary small>
                                Feedback Report
                              </JobBtn>
                            </Link>
                          )}
                          <Link
                            href={
                              isCompleted
                                ? `/jobseeker/practice/new${session.drill_id ? `?drill=${session.drill_id}` : ''}`
                                : `/jobseeker/practice/${session.id}`
                            }
                          >
                            <JobBtn primary small className="flex items-center gap-1">
                              {isCompleted ? (
                                <>
                                  <RotateCcw size={12} /> Practice Again
                                </>
                              ) : (
                                <>
                                  <Play size={12} /> Resume
                                </>
                              )}
                            </JobBtn>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ResourceState>
          </div>

          {/* Quick Skill Drills Column */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Quick Skill Drills
              </span>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Sharpen specific behavioral answers and technical pitch responses before your calls.
              </p>

              <ResourceState
                resource={drillsRes}
                empty={!drillsRes.loading && !drillsRes.error && drills.length === 0}
                emptyLabel="No drills available yet."
                onRetry={drillsRes.reload}
              >
                <div className="space-y-2.5 pt-1">
                  {drills.slice(0, 3).map((drill) => (
                    <Link
                      key={drill.id}
                      href={`/jobseeker/practice/new?drill=${drill.id}`}
                      className="block p-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] hover:bg-[#F3EBDD]/50 transition-colors"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-[#0F1B2D]">{drill.title}</span>
                        <ChevronRight size={14} className="text-[#A0A7B4] shrink-0" />
                      </div>
                      <span className="text-[11px] text-[#6B7280] block">
                        {drill.category} · {drill.duration_min ? `${drill.duration_min} min` : drill.difficulty}
                      </span>
                    </Link>
                  ))}
                </div>
              </ResourceState>

              <Link href="/jobseeker/practice/drills" className="block pt-2">
                <JobBtn secondary small className="w-full">
                  Browse All Drills
                </JobBtn>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </JobSeekerShell>
  );
}
