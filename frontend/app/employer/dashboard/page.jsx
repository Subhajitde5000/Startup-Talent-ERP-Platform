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
import {
  company,
  user,
  kpis,
  nextActions,
  attention as initialAttention,
  jobs,
  todayInterviews,
  pendingOffers,
  teamActivity,
} from '../employer-data';

export default function EmployerDashboardPage() {
  const [attentionList, setAttentionList] = useState(initialAttention);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const dismissAttention = (id) => {
    setAttentionList((prev) => prev.filter((item) => item.id !== id));
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  return (
    <EmployerShell activeNav="Dashboard">
      <div className="mx-auto max-w-[1280px] space-y-6 min-w-0">
        {/* Toast Alert */}
        {toastMsg && (
          <div className="rounded-xl border border-[#CDE5D7] bg-[#E7F3EC] p-3.5 text-xs text-[#286749] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} /> {toastMsg}
            </span>
            <button
              type="button"
              onClick={() => setToastMsg('')}
              className="text-[#286749] hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

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
                    Welcome back, {user.name}
                  </h1>
                  {company.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2.5 py-0.5 text-xs font-semibold text-[#286749]">
                      <CheckCircle2 size={11} /> Verified Employer
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5 truncate">
                  {company.name} · {company.summary || 'Hiring dashboard and active pipeline overview.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/employer/jobs/new">
                <EmployerBtn primary small className="flex items-center gap-1.5">
                  <Plus size={14} /> Create Job Post
                </EmployerBtn>
              </Link>
              <Link href="/employer/talent">
                <EmployerBtn secondary small>
                  Source Talent
                </EmployerBtn>
              </Link>
            </div>
          </div>
        </section>

        {/* Next Best Action Suggestion (with functional dismiss) */}
        {!suggestionDismissed && nextActions.length > 0 && (
          <section className="rounded-2xl border border-[#D4C3A3] bg-[#FFF8E8] p-5 shadow-xs min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Sparkles size={18} className="text-[#806236] shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#806236] block">
                    AI Hiring Recommendation
                  </span>
                  <strong className="text-sm font-semibold text-[#0F1B2D] block">
                    {nextActions[0].label}
                  </strong>
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    {nextActions[0].reason}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/employer/hiring">
                  <EmployerBtn primary small>
                    {nextActions[0].action || 'Review Candidates'}
                  </EmployerBtn>
                </Link>
                <button
                  type="button"
                  onClick={() => setSuggestionDismissed(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] hover:bg-[#F4F1EA]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </section>
        )}

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

        {/* Requires Your Attention Section */}
        <section className="rounded-2xl border border-[#E5E1D8] bg-white p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle size={15} />
              </span>
              <div>
                <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                  Requires Your Attention {attentionList.length > 0 && `(${attentionList.length})`}
                </h2>
                <span className="text-xs text-[#6B7280]">Actionable alerts requiring recruiter or panel intervention</span>
              </div>
            </div>
            {attentionList.length > 0 && (
              <span className="hidden sm:inline-flex items-center rounded-full bg-[#FAF8F4] px-2.5 py-1 text-xs font-medium text-[#806236] border border-[#E5E1D8]">
                Real-time pipeline SLA
              </span>
            )}
          </div>

          {attentionList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E5E1D8] bg-[#FAF8F4]/60 p-8 text-center space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="font-serif text-sm font-bold text-[#0F1B2D]">You&apos;re all caught up!</h3>
              <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
                No unreviewed applicants past SLA, overdue interview feedback, or expiring offers pending action.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAttentionList(initialAttention);
                  showToast('Simulated alerts restored.');
                }}
                className="text-xs text-[#806236] font-semibold hover:underline pt-2 block mx-auto"
              >
                Reset demo alerts
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {attentionList.map((item) => {
                const IconComponent = item.icon || AlertCircle;
                const isError = item.chipType === 'error';
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#E5E1D8] bg-white hover:border-[#B8955A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors shadow-xs"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border mt-0.5 ${
                          isError
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        <IconComponent size={16} />
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-xs font-semibold text-[#0F1B2D] leading-snug">
                            {item.text}
                          </strong>
                          {item.chip && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                isError
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {item.chip}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[#6B7280] text-[11px]">
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-[#A0A7B4]" /> Waiting {item.wait}
                          </span>
                          <span>·</span>
                          <span className="text-[#806236] font-medium">Hiring SLA</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Link href={item.link || '/employer/hiring'}>
                        <EmployerBtn secondary small className="hover:border-[#B8955A] hover:text-[#806236]">
                          {item.action || 'Take Action'} <ArrowRight size={13} className="ml-1" />
                        </EmployerBtn>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          dismissAttention(item.id);
                          showToast(`Alert dismissed: ${item.action || 'Action'}`);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#A0A7B4] hover:bg-black/5 hover:text-[#0F1B2D] transition-colors"
                        title="Dismiss alert"
                        aria-label={`Dismiss alert: ${item.text}`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                  href="/employer/hiring"
                  className="text-xs text-[#9A7A45] font-semibold hover:underline"
                >
                  View All ({jobs.length})
                </Link>
              }
            >
              <div className="space-y-3">
                {jobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-[#E5E1D8] p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF8F4]/50 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/employer/jobs/${job.id}`}
                          className="text-sm font-semibold text-[#0F1B2D] hover:underline"
                        >
                          {job.title}
                        </Link>
                        <StageChip stage={job.status || 'Active'} />
                      </div>
                      <p className="text-xs text-[#6B7280]">
                        {job.dept} · {job.loc} · {job.applicantsCount || 12} candidates in pipeline
                      </p>
                    </div>

                    <Link href={`/employer/jobs/${job.id}`}>
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
                  href="/employer/hiring"
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
                  href="/employer/hiring"
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
              {todayInterviews.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No interviews scheduled for today.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {todayInterviews.map((int) => (
                    <div
                      key={int.id}
                      className="p-3 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-[#0F1B2D] font-semibold">{int.candidate}</strong>
                        <span className="text-[#9A7A45] font-medium">{int.time}</span>
                      </div>
                      <p className="text-[#6B7280]">{int.role} · {int.stage}</p>
                    </div>
                  ))}
                </div>
              )}
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
              {pendingOffers.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No active pending offers.</p>
              ) : (
                <div className="space-y-3 text-xs">
                  {pendingOffers.map((off) => (
                    <div
                      key={off.id}
                      className="p-3 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-[#0F1B2D] font-semibold">{off.candidate}</strong>
                        <span className="text-[#286749] font-bold">{off.baseCtc}</span>
                      </div>
                      <p className="text-[#6B7280]">{off.role} · Expires {off.expires}</p>
                    </div>
                  ))}
                </div>
              )}
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
    </EmployerShell>
  );
}
