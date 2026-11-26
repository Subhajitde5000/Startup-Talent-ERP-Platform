'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  EmployerShell,
  EmployerBtn,
  EmployerCard,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { useCareerResource, ResourceState } from '@/components/career-data';
import { api } from '@/lib/api/client';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

function AnalyticsContent() {
  const {org} = useJobsWorkspace();
  const [activeTab, setActiveTab] = useState('Overview');
  const resource = useCareerResource(`hiring-analytics:${org.id}`, signal => api.hiringInsights.analytics(org.id, signal));
  if (resource.loading || resource.error) return <ResourceState resource={resource} />;
  const data = resource.data;
  const analyticsKpis = [{label:'Applicants', value:data.total_applicants}, {label:'Hires', value:data.hires}, {label:'Average time to first interview', value:data.avg_time_to_first_interview_days == null ? '—' : `${data.avg_time_to_first_interview_days} days`}, {label:'Average time to hire', value:data.avg_time_to_hire_days == null ? '—' : `${data.avg_time_to_hire_days} days`}];
  const funnelStages = data.funnel.map(f => ({...f, pct:data.total_applicants ? Math.round(f.count * 100 / data.total_applicants) : 0}));
  const speedByJob = data.by_job.map(j => ({job:j.title, applicants:j.applicants, days:j.avg_time_to_hire_days, status:j.status}));
  const tabs = ['Overview', 'Funnel', 'Speed', 'Sources', 'Offers'];

  return (
    <>
      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1B2D]">
              Hiring Analytics & Insights
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5568]">
              Current hiring stage distribution and time-to-hire velocity.
            </p>
          </div>

        </div>

        {/* KPIs - 1 col on mobile prevents 578px blowout */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {analyticsKpis.map((k, idx) => (
            <div key={idx} className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#4A5568]">{k.label}</span>
              <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{k.value}</p>

            </div>
          ))}
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 border-b border-[#E5E1D8] pb-2 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition ${
                  active
                    ? 'bg-[#0F1B2D] text-white shadow-sm'
                    : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="min-w-0">
          {activeTab === 'Overview' && (
            <div className="grid gap-6 lg:grid-cols-12 min-w-0">
              <div className="lg:col-span-8 space-y-6 min-w-0">
                <EmployerCard title="Recruiting Pipeline Health">
                  <div className="space-y-4">
                    <p className="text-xs text-[#4A5568]">
                      Current application stage distribution across all jobs; percentages are shares of total applicants.
                    </p>
                    <div className="space-y-3">
                      {funnelStages.map((st, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-[#0F1B2D]">{st.stage}</span>
                            <span className="text-[#4A5568]">{st.count} candidates ({st.pct}%)</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-[#E5E1D8] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#0F1B2D]"
                              style={{ width: `${st.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </EmployerCard>

                <EmployerCard title="Velocity by Position">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[460px]">
                      <thead className="bg-[#FAF8F4] text-[#4A5568] border-b border-[#E5E1D8]">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">Role</th>
                          <th className="px-3 py-2.5 font-semibold">Total Applicants</th>
                          <th className="px-3 py-2.5 font-semibold">Avg Days to Hire</th>
                          <th className="px-3 py-2.5 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1D8]">
                        {speedByJob.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#FAF8F4]/50">
                            <td className="px-3 py-2.5 font-semibold text-[#0F1B2D]">{item.job}</td>
                            <td className="px-3 py-2.5 text-[#4A5568]">{item.applicants}</td>
                            <td className="px-3 py-2.5 text-[#4A5568]">{item.days == null ? "—" : `${item.days} days`}</td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </EmployerCard>
              </div>

              {/* Sidebar Insights */}
              <div className="lg:col-span-4 space-y-6 min-w-0">
                <EmployerCard title="AI Velocity Insights"><p className="text-xs">Insights are not available yet.</p></EmployerCard>

                <SafetyStrip />
              </div>
            </div>
          )}

          {activeTab === 'Funnel' && (
            <EmployerCard title="Stage-by-Stage Funnel Conversion">
              <div className="space-y-4">
                <p className="text-xs text-[#4A5568]">
                  Current stage distribution; not historical conversion rates.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {funnelStages.map((f, i) => (
                    <div key={i} className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-center">
                      <span className="text-xs text-[#4A5568] block">{f.stage}</span>
                      <span className="font-serif text-2xl font-bold text-[#0F1B2D] block mt-1">{f.count}</span>
                      <span className="text-xs text-[#806236] font-medium mt-1 inline-block">
                        {f.pct}% of applicants
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </EmployerCard>
          )}

          {activeTab === 'Speed' && <EmployerCard title="Hiring Speed & Response Latency"><p className="text-xs">Average time to first interview: {data.avg_time_to_first_interview_days == null ? 'Not enough data' : `${data.avg_time_to_first_interview_days} days`}. Average time to hire: {data.avg_time_to_hire_days == null ? 'Not enough data' : `${data.avg_time_to_hire_days} days`}.</p></EmployerCard>}
          {activeTab === 'Sources' && <EmployerCard title="Applicant Acquisition Channels"><p className="text-xs">Source analytics are not available yet.</p></EmployerCard>}
          {activeTab === 'Offers' && <EmployerCard title="Offer Outcomes & Acceptance Ratios"><p className="text-xs">Offer outcome analytics are not available yet.</p></EmployerCard>}

        </div>
      </div>
    </>
  );
}

export default function EmployerAnalyticsPage() { return <JobsPage activeNav="Analytics" hiringInsights><AnalyticsContent /></JobsPage>; }
