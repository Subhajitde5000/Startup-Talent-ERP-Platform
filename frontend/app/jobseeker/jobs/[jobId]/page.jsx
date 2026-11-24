'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle2,
  Share2,
  Sparkles,
  MapPin,
  Clock,
  Check,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn, SafetyStrip } from '@/components/jobseeker-ui';
import {
  api,
  useCareerResource,
  jobView,
  ResourceState,
  ApplicationAction,
} from '@/components/career-data';
import { useAuth } from '@/lib/auth-context';

export default function JobDetailPage() {
  const params = useParams();
  const rawId = params?.jobId;
  const { user } = useAuth();
  const resource = useCareerResource(`job:${rawId}`, (signal) =>
    api.careers.job(rawId, Boolean(user), signal)
  );
  const job = resource.data ? jobView(resource.data) : null;
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!job)
    return (
      <JobSeekerShell active="Jobs" liveData>
        <ResourceState resource={resource} />
      </JobSeekerShell>
    );

  return (
    <JobSeekerShell active="Jobs" liveData>
      <div className="space-y-6 max-w-5xl">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href="/jobseeker/jobs"
            className="flex items-center gap-1 hover:text-[#0F1B2D] transition-colors"
          >
            <ChevronLeft size={14} /> Back to Jobs
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium truncate">
            {job.title}
          </span>
        </nav>

        {/* Main Job Hero Header */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#F3EBDD] font-bold text-xl text-[#806236]">
                {job.logo || job.company?.name?.[0] || 'J'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                    {job.title}
                  </h1>
                  {job.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2.5 py-0.5 text-xs font-medium text-[#286749]">
                      <CheckCircle2 size={12} /> Verified
                    </span>
                  )}
                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                    {job.stage || job.company.type}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-[#4A5568]">
                  <Link
                    href={`/jobseeker/companies/${job.company.id}`}
                    className="font-semibold text-[#0F1B2D] hover:underline"
                  >
                    {job.company?.name || job.company}
                  </Link>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-[#A0A7B4]" /> {job.loc}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-[#A0A7B4]" /> {job.type} (
                    {job.mode})
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#6B7280]">Saving unavailable</span>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-1.5 min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-medium text-[#0F1B2D] hover:bg-[#F4F1EA] transition-colors"
              >
                <Share2 size={14} />
                <span>{copied ? 'Link Copied!' : 'Share'}</span>
              </button>

              <ApplicationAction job={resource.data} />
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-6 pt-5 border-t border-[#F0EBE0] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#6B7280] block mb-0.5">
                Offered Salary
              </span>
              <span className="font-semibold text-sm text-[#0F1B2D]">
                {job.salary}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block mb-0.5">Date Posted</span>
              <span className="font-semibold text-sm text-[#0F1B2D]">
                {job.posted}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block mb-0.5">
                Applications Close
              </span>
              <span className="font-semibold text-sm text-[#0F1B2D]">
                {job.closes || 'Rolling basis'}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block mb-0.5">
                Company Industry
              </span>
              <span className="font-semibold text-sm text-[#0F1B2D]">
                {job.industry}
              </span>
            </div>
          </div>
        </header>

        {/* AI Match Overview Banner */}
        {job.fit && (
          <div className="rounded-xl border border-[#D4C3A3] bg-[#F3EBDD]/50 p-4 flex items-start gap-3">
            <Sparkles size={18} className="text-[#806236] shrink-0 mt-0.5" />
            <div className="text-xs text-[#806236] space-y-1">
              <span className="font-bold text-sm block text-[#0F1B2D]">
                Why You Match This Role
              </span>
              <p className="leading-relaxed">{job.fit}</p>
            </div>
          </div>
        )}

        {/* 2-Column Body Content */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Details Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* About the role */}
            <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-3">
              <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                About the Role
              </h2>
              <p className="text-xs md:text-sm text-[#4A5568] leading-relaxed">
                {job.description || 'No description provided.'}
              </p>
            </section>

            {/* Responsibilities */}
            {job.responsibilities && job.responsibilities.length > 0 && (
              <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-3">
                <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                  What You Will Do
                </h2>
                <ul className="space-y-2 text-xs md:text-sm text-[#4A5568]">
                  {job.responsibilities.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#B8955A] shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Skill Requirements */}
            {job.mustHave && job.mustHave.length > 0 && (
              <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                  Qualifications & Skills
                </h2>
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Role Skills
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {job.mustHave.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                          item.have
                            ? 'border-[#CDE5D7] bg-[#E7F3EC]/40 text-[#0F1B2D]'
                            : 'border-[#E5E1D8] bg-[#FAF8F4] text-[#4A5568]'
                        }`}
                      >
                        <span className="font-medium">{item.skill}</span>
                        {item.have ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#286749]">
                            <Check size={12} /> Match
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#A0A7B4]">
                            {item.required ? 'Required' : 'Optional'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {job.requirements && (
              <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 space-y-3">
                <h2 className="font-serif font-bold">Requirements</h2>
                <p className="whitespace-pre-wrap text-sm">
                  {job.requirements}
                </p>
              </section>
            )}
            {(job.what_we_offer || job.benefits.length > 0) && (
              <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 space-y-3">
                <h2 className="font-serif font-bold">Benefits & offer</h2>
                <p className="whitespace-pre-wrap text-sm">
                  {job.what_we_offer}
                </p>
                <ul className="text-sm">
                  {job.benefits.map((b) => (
                    <li key={b.id || b.label}>{b.label}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 space-y-3">
              <h2 className="font-serif font-bold">Screening questions</h2>
              {job.screening_questions.length ? (
                job.screening_questions.map((q) => (
                  <p className="text-xs" key={q.key}>
                    {q.prompt} {q.required ? '(required)' : '(optional)'}
                  </p>
                ))
              ) : (
                <p className="text-xs">No screening questions configured.</p>
              )}
              <p className="text-xs">
                Openings: {job.openings} · Equity: {job.equity_min_pct ?? '—'}–
                {job.equity_max_pct ?? '—'}% · Experience:{' '}
                {job.experience_min_yrs ?? '—'}–{job.experience_max_yrs ?? '—'}{' '}
                years
              </p>
            </section>
            {/* Safety Strip */}
            <SafetyStrip liveData />
          </div>

          {/* Right Sidebar Column */}
          <aside className="lg:col-span-4 space-y-5">
            {/* Company Mini Card */}
            <div className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                About the Company
              </span>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-bold text-[#806236]">
                  {job.company?.name?.[0] || 'C'}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#0F1B2D]">
                    {job.company?.name || job.company}
                  </h3>
                  <p className="text-xs text-[#6B7280]">{job.industry}</p>
                </div>
              </div>

              <div className="text-xs text-[#4A5568] space-y-1.5 pt-2 border-t border-[#F0EBE0]">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Location:</span>
                  <span className="font-medium">{job.loc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Work Model:</span>
                  <span className="font-medium">{job.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Stage:</span>
                  <span className="font-medium">
                    {job.stage || 'Not provided'}
                  </span>
                </div>
              </div>

              <Link
                href={`/jobseeker/companies/${job.company.id}`}
                className="w-full inline-block pt-2"
              >
                <JobBtn secondary small className="w-full">
                  View Company Profile
                </JobBtn>
              </Link>
            </div>

            {/* Ready to apply CTA box */}
            <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#0F1B2D]">
                Ready to apply?
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Review the role and share your contact details, optional resume,
                and configured screening answers.
              </p>
              <ApplicationAction job={resource.data} className="block" />
            </div>
          </aside>
        </div>
      </div>
    </JobSeekerShell>
  );
}
