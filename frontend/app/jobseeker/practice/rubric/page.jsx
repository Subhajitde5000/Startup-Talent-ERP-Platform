'use client';

import React from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState } from '@/components/career-data';

export default function RubricPage() {
  const rubricRes = useCareerResource('practice:rubric', (signal) =>
    api.practice.rubric(signal),
  );

  const criteria = rubricRes.data?.criteria || [];

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
          <span className="text-[#0F1B2D] font-medium">Scoring Rubric</span>
        </nav>

        {/* Header */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Interview Scoring Rubric
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Transparent evaluation standards used by the AI trainer to grade responses.
            </p>
          </div>

          <Link href="/jobseeker/practice/new">
            <JobBtn primary small className="flex items-center gap-1.5">
              Practice With This Rubric <ArrowRight size={13} />
            </JobBtn>
          </Link>
        </header>

        {/* Rubric Criteria Cards */}
        <ResourceState
          resource={rubricRes}
          empty={!rubricRes.loading && !rubricRes.error && criteria.length === 0}
          emptyTitle="Rubric unavailable"
          emptyBody="Could not load rubric criteria."
          onRetry={rubricRes.reload}
        >
          <div className="space-y-4">
            {criteria.map((crit, idx) => (
              <section
                key={crit.key}
                className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EBE0] pb-3">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    {idx + 1}. {crit.title}
                  </h2>
                  <span className="rounded-full bg-[#F3EBDD] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
                    Weight: {crit.weight_pct}%
                  </span>
                </div>

                <p className="text-xs text-[#4A5568] leading-relaxed">{crit.description}</p>

                <div className="grid gap-3 sm:grid-cols-3 pt-2">
                  {crit.levels.map((lvl, lIdx) => (
                    <div
                      key={lIdx}
                      className="p-3.5 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 text-xs space-y-1.5"
                    >
                      <strong className="text-[#0F1B2D] block">{lvl.label}</strong>
                      <p className="text-[#6B7280] leading-relaxed">{lvl.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ResourceState>
      </div>
    </JobSeekerShell>
  );
}
