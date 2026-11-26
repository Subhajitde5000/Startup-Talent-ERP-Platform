'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Briefcase,
  Users,
  Calendar,
  Clock,
  Mail,
  ChevronRight,
  TrendingUp,
  X,
  Plus,
} from 'lucide-react';
import { EmployerShell, EmployerBtn, EmployerCard, StageChip } from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { useCareerResource, ResourceState } from '@/components/career-data';
import { api } from '@/lib/api/client';

function DashboardContent() {
  const { org, user, canWrite, href } = useJobsWorkspace();
  const resource = useCareerResource(`hiring-dashboard:${org.id}`, signal => api.hiringInsights.dashboard(org.id, signal));
  if (resource.loading || resource.error) return <ResourceState resource={resource} />;
  const data = resource.data;
  const company = {name:org.name, logo:org.name?.[0], verified:!!org.verified_at};
  const kpis = [
    {label:'Open jobs', value:data.kpis.open_jobs},
    {label:'Total applicants', value:data.kpis.total_applicants},
    {label:'Hires', value:data.kpis.hires},
    {label:'Average time to hire', value:data.kpis.avg_time_to_hire_days == null ? '—' : `${data.kpis.avg_time_to_hire_days} days`},
  ];
  const attentionList = data.attention;
  const jobs = data.jobs.map(j => ({...j, id:j.job_id, applicantsCount:j.applicants}));

  return (
    <>
      <div className="mx-auto max-w-[1280px] space-y-6 min-w-0">
        {/* Hero Welcome Banner */}
        <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xs min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#B8955A] font-serif text-lg font-bold text-[#0F1B2D]">
                {company.logo || 'N'}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg md:text-xl font-serif font-bold text-[#0F1B2D]">
                    Welcome back, {user?.display_name || 'there'}
                  </h1>
                  {company.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2.5 py-0.5 text-xs font-semibold text-[#286749]">
                      <CheckCircle2 size={11} /> Verified Employer
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5 truncate">
                  {company.name} · Hiring dashboard and active pipeline overview.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canWrite && <Link href={href("/employer/jobs/new")}>
                <EmployerBtn primary small className="flex items-center gap-1.5">
                  <Plus size={14} /> Create Job Post
                </EmployerBtn>
              </Link>}
              {canWrite && <Link href={href("/employer/talent")}>
                <EmployerBtn secondary small>
                  Source Talent
                </EmployerBtn>
              </Link>}
            </div>
          </div>
        </section>

        {/* KPI Strip - Responsive 1 to 4 cols without mobile blowout */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-xs space-y-2 min-w-0"
            >
              <span className="text-xs text-[#6B7280] block truncate">{k.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-serif font-bold text-[#0F1B2D]">{k.value}</span>
                <span className="text-xs font-semibold text-[#286749]">{k.change}</span>
              </div>
              <p className="text-xs text-[#6B7280]">{k.caption}</p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-[#E5E1D8] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-base font-serif font-bold">Requires Your Attention</h2>
          {attentionList.length ? attentionList.map(item => <div key={item.job_id} className="rounded-xl border border-[#E5E1D8] p-4 text-xs">{item.unreviewed_applicants} unreviewed applicants · {item.title}</div>) : <p className="text-xs text-[#6B7280]">No unreviewed applicants in the displayed active jobs.</p>}
        </section>

        {/* 2-Column Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-12 min-w-0">
          {/* Active Jobs & Candidates */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {/* Active Jobs */}
            <EmployerCard
              title="Active Job Listings"
              action={
                <Link
                  href={href("/employer/hiring")}
                  className="text-xs text-[#9A7A45] font-semibold hover:underline"
                >
                  View all jobs
                </Link>
              }
            >
              <div className="space-y-3">
                {jobs.length === 0 && <p className="text-xs text-[#6B7280]">No active job listings.</p>}
                {jobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-[#E5E1D8] p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF8F4]/50 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={href(`/employer/jobs/${job.id}`)}
                          className="text-sm font-semibold text-[#0F1B2D] hover:underline"
                        >
                          {job.title}
                        </Link>
                        <StageChip stage={job.status || 'Active'} />
                      </div>
                      <p className="text-xs text-[#6B7280]">
                        {job.applicantsCount} candidates in pipeline
                      </p>
                    </div>

                    <Link href={href(`/employer/jobs/${job.id}`)}>
                      <EmployerBtn secondary small>
                        Pipeline <ChevronRight size={13} />
                      </EmployerBtn>
                    </Link>
                  </div>
                ))}
              </div>
            </EmployerCard>

            {/* Recent Applicants */}
            <EmployerCard
              title="Recent Candidates to Review"
              action={
                <Link
                  href={href("/employer/hiring")}
                  className="text-xs text-[#9A7A45] font-semibold hover:underline"
                >
                  All Applications
                </Link>
              }
            >
              <div className="rounded-xl border border-dashed border-[#E5E1D8] bg-[#FAF8F4]/60 p-6 text-center">
                <p className="text-xs text-[#6B7280]">
                  Recent candidate summaries are not available on this dashboard.
                </p>
                <Link
                  href={href("/employer/hiring")}
                  className="mt-2 inline-block text-xs font-semibold text-[#806236] hover:underline"
                >
                  View applications
                </Link>
              </div>
            </EmployerCard>
          </div>

          {/* Right Sidebar Column */}
          <aside className="lg:col-span-4 space-y-6 min-w-0">
            {/* Today's Interviews */}
            <EmployerCard
              title="Today's Interviews"
              action={
                <Link
                  href="/employer/interviews"
                  className="text-xs text-[#9A7A45] font-semibold hover:underline"
                >
                  Schedule
                </Link>
              }
            >
              <p className="text-xs text-[#6B7280]">Interview summaries are unavailable on this dashboard.</p>
            </EmployerCard>

            {/* Pending Offers */}
            <EmployerCard
              title="Pending Offers"
              action={
                <Link
                  href="/employer/offers"
                  className="text-xs text-[#9A7A45] font-semibold hover:underline"
                >
                  Manage Offers
                </Link>
              }
            >
              <p className="text-xs text-[#6B7280]">Offer summaries are unavailable on this dashboard.</p>
            </EmployerCard>

            {/* Quick Links & Safety Guideline */}
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-xs space-y-2 text-xs">
              <span className="font-serif font-bold text-[#0F1B2D] block">Hiring Standards</span>
              <p className="text-[#6B7280] leading-relaxed">
                Review verified employer guidelines and compliance requirements before publishing roles.
              </p>
              <Link
                href="/employer/trust"
                className="text-[#9A7A45] font-semibold hover:underline inline-block pt-1"
              >
                Employer Compliance & Safety Guidelines →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

export default function EmployerDashboardPage() { return <JobsPage activeNav="Dashboard" hiringInsights><DashboardContent /></JobsPage>; }
