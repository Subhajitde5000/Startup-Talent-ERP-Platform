'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  CheckCircle2,
  Share2,
  Building,
  MapPin,
  Users,
  Calendar,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';

import {
  api,
  useCareerResource,
  CareerJobCard,
  ResourceState,
  Pagination,
  lifecycle,
  Unavailable,
} from '@/components/career-data';
import { useAuth } from '@/lib/auth-context';

export default function CompanyProfilePage() {
  const params = useParams();
  const rawId = params?.companyId;
  const { user } = useAuth();
  const resource = useCareerResource(`company:${rawId}`, (signal) =>
    api.careers.company(rawId, Boolean(user), signal)
  );
  const [offset, setOffset] = useState(0);
  const jobsResource = useCareerResource(
    `company-jobs:${rawId}:${offset}`,
    (signal) =>
      api.careers.jobs(
        { org_id: rawId, limit: 20, offset },
        Boolean(user),
        signal
      )
  );
  const company = resource.data
    ? {
        ...resource.data,
        industry: resource.data.sector || 'Not provided',
        location:
          [resource.data.city, resource.data.region, resource.data.country]
            .filter(Boolean)
            .join(', ') || 'Not provided',
        stage: lifecycle[resource.data.stage] || 'Not provided',
        founded: resource.data.founded_year || 'Not provided',
      }
    : null;

  const [tab, setTab] = useState('Overview');
  const [copied, setCopied] = useState(false);

  const openJobs = jobsResource.data?.items || [];

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!company)
    return (
      <JobSeekerShell active="Jobs" liveData>
        <ResourceState resource={resource} />
      </JobSeekerShell>
    );

  return (
    <JobSeekerShell active="Jobs" liveData>
      <div className="space-y-6 max-w-5xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href="/jobseeker/jobs"
            className="flex items-center gap-1 hover:text-[#0F1B2D]"
          >
            <ChevronLeft size={14} /> Back to Jobs
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">{company.name}</span>
        </nav>

        {/* Hero banner & Company Info Card */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white overflow-hidden shadow-sm">
          {/* Header background band */}
          <div className="h-32 bg-gradient-to-r from-[#0F1B2D] via-[#1C2B42] to-[#0F1B2D] relative p-6">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#B8955A_1px,transparent_1px)] [background-size:16px_16px]" />
          </div>

          <div className="p-6 relative pt-0">
            {/* Avatar overlapping banner */}
            <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 mb-4">
              <span className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-white bg-[#F3EBDD] font-bold text-2xl text-[#806236] shadow-md">
                {company.logo || company.name[0]}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-1.5 min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-medium text-[#0F1B2D] hover:bg-[#F4F1EA]"
                >
                  <Share2 size={14} />
                  <span>{copied ? 'Copied' : 'Share'}</span>
                </button>

                <span className="text-xs text-[#6B7280]">
                  Following unavailable
                </span>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                  {company.name}
                </h1>
                {company.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2.5 py-0.5 text-xs font-medium text-[#286749]">
                    <CheckCircle2 size={12} /> Verified Employer
                  </span>
                )}
                {company.stage && (
                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                    {company.stage}
                  </span>
                )}
              </div>

              <p className="text-xs md:text-sm text-[#4A5568] max-w-2xl leading-relaxed">
                {company.summary || 'No company summary provided.'}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-[#6B7280] pt-3 border-t border-[#F0EBE0]">
                <span className="flex items-center gap-1.5">
                  <Building size={14} className="text-[#A0A7B4]" />{' '}
                  {company.industry}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#A0A7B4]" />{' '}
                  {company.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-[#A0A7B4]" />{' '}
                  {'Team size not provided'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#A0A7B4]" /> Founded{' '}
                  {company.founded}
                </span>
                {company.website && /^https?:\/\//i.test(company.website) && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#9A7A45] hover:underline font-medium"
                  >
                    <Globe size={13} /> Website <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-t border-[#E5E1D8] px-6 bg-[#FAF8F4]/50 overflow-x-auto">
            {[
              'Overview',
              'Open Jobs',
              'Culture & Benefits',
              'Hiring Process',
            ].map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`py-3.5 px-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-[#B8955A] text-[#0F1B2D]'
                      : 'border-transparent text-[#6B7280] hover:text-[#0F1B2D]'
                  }`}
                >
                  {t} {t === 'Open Jobs' && `(${company.open_jobs_count})`}
                </button>
              );
            })}
          </div>
        </header>

        {/* Tab 1: Overview */}
        {tab === 'Overview' && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-6">
              <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-3">
                <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                  About {company.name}
                </h2>
                <p className="text-xs md:text-sm text-[#4A5568] leading-relaxed">
                  {company.summary || 'No company summary provided.'}
                </p>
              </section>

              <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    Open Roles
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab('Open Jobs')}
                    className="text-xs text-[#9A7A45] font-semibold hover:underline"
                  >
                    View all ({company.open_jobs_count})
                  </button>
                </div>
                <ResourceState
                  resource={jobsResource}
                  empty={!openJobs.length}
                  emptyLabel="No current openings."
                />
                <div className="space-y-3">
                  {openJobs.slice(0, 3).map((job) => (
                    <CareerJobCard key={job.id} job={job} />
                  ))}
                </div>
              </section>
            </div>

            <aside className="lg:col-span-4 space-y-5">
              <div className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                  Company Highlights
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#F0EBE0]">
                    <span className="text-[#6B7280]">Startup Stage</span>
                    <strong className="text-[#0F1B2D]">{company.stage}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F0EBE0]">
                    <span className="text-[#6B7280]">Verified Mentorship</span>
                    <span className="text-[#286749] font-medium flex items-center gap-1">
                      Not available
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#6B7280]">Headquarters</span>
                    <span className="text-[#0F1B2D] font-medium">
                      {company.location}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Tab 2: Open Jobs */}
        {tab === 'Open Jobs' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                All Open Positions ({company.open_jobs_count})
              </h2>
              <Link
                href="/jobseeker/jobs"
                className="text-xs text-[#9A7A45] hover:underline"
              >
                Explore All Platform Jobs →
              </Link>
            </div>

            <ResourceState
              resource={jobsResource}
              empty={!openJobs.length}
              emptyLabel="No current openings."
            />
            {openJobs.map((job) => (
              <CareerJobCard key={job.id} job={job} />
            ))}
            <Pagination page={jobsResource.data} onChange={setOffset} />
          </section>
        )}

        {tab === 'Culture & Benefits' && (
          <Unavailable>Company-wide culture & benefits</Unavailable>
        )}
        {tab === 'Hiring Process' && (
          <Unavailable>Company hiring process</Unavailable>
        )}
      </div>
    </JobSeekerShell>
  );
}
