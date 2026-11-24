'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, CheckCircle2, Shield } from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import {
  api,
  useCareerSearch,
  useCareerResource,
  CareerJobCard,
  ResourceState,
  Pagination,
  lifecycle,
} from '@/components/career-data';
import { useAuth } from '@/lib/auth-context';

export default function StartupsPage() {
  const [viewMode, setViewMode] = useState('startups'); // 'startups' | 'jobs'
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const { user } = useAuth();
  const [pagination, setPagination] = useState({ key: '', offset: 0 });
  const searchQuery = useCareerSearch(search);
  const query = {
    q: searchQuery || undefined,
    stage: stageFilter || undefined,
    sector: sectorFilter || undefined,
    limit: 20,
  };
  const key = JSON.stringify(query);
  const offset = pagination.key === key + viewMode ? pagination.offset : 0;
  const directory = useCareerResource(
    `startups:${key}:${viewMode === 'startups' ? offset : 0}`,
    (signal) =>
      api.careers.startups(
        { ...query, offset: viewMode === 'startups' ? offset : 0 },
        Boolean(user),
        signal
      )
  );
  const listings = useCareerResource(
    `startup-jobs:${key}:${viewMode === 'jobs' ? offset : 0}`,
    (signal) =>
      api.careers.jobs(
        {
          ...query,
          org_type: 'startup',
          offset: viewMode === 'jobs' ? offset : 0,
        },
        Boolean(user),
        signal
      )
  );
  const filteredStartups = (directory.data?.items || []).map((c) => ({
    ...c,
    stage: lifecycle[c.stage],
    industry: c.sector || 'Not provided',
    location:
      [c.city, c.region, c.country].filter(Boolean).join(', ') ||
      'Not provided',
  }));
  const startupJobs = listings.data?.items || [];
  const resource = viewMode === 'startups' ? directory : listings;

  return (
    <JobSeekerShell active="Startups" liveData>
      <div className="space-y-6">
        {/* Hero Banner */}
        <section className="rounded-2xl border border-[#E5E1D8] bg-[#0F1B2D] p-6 text-white shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B8955A]/20 px-3 py-1 text-xs text-[#B8955A] font-semibold">
              <Shield size={13} /> Startup Hiring Directory
            </div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-white">
              Startups Hiring Now
            </h1>
            <p className="text-xs md:text-sm text-white/70 leading-relaxed">
              Explore startups with current openings and published company
              information.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setViewMode('startups')}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                  viewMode === 'startups'
                    ? 'bg-[#B8955A] text-[#0F1B2D]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Startups Directory ({directory.data?.total ?? '—'})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('jobs')}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                  viewMode === 'jobs'
                    ? 'bg-[#B8955A] text-[#0F1B2D]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Startup Jobs ({listings.data?.total ?? '—'})
              </button>
            </div>
          </div>
        </section>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E5E1D8]">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]"
              size={16}
            />
            <input
              type="text"
              aria-label="Search startups"
              maxLength={100}
              placeholder="Search by company, sector, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4]/50 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Filter by stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            >
              <option value="">All Stages</option>
              {Object.entries(lifecycle).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by sector"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            >
              <option value="">All Sectors</option>
              <option value="FinTech">FinTech</option>
              <option value="Healthcare">Healthcare</option>
              <option value="SaaS">SaaS</option>
              <option value="EdTech">EdTech</option>
            </select>

            <span className="text-[#6B7280]">
              Investment readiness unavailable
            </span>
          </div>
        </div>

        <ResourceState
          resource={resource}
          empty={!resource.data?.items.length}
          emptyLabel="No matching hiring startups or jobs."
        />
        {/* Content Section */}
        {viewMode === 'startups' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStartups.map((company) => {
              return (
                <div
                  key={company.id}
                  className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] font-bold text-lg text-[#806236]">
                        {company.logo || company.name[0]}
                      </span>
                      <div className="flex flex-col items-end gap-1">
                        {company.verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-0.5 text-xs text-[#286749]">
                            <CheckCircle2 size={10} /> Verified
                          </span>
                        )}
                        {company.stage && (
                          <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#4A5568]">
                            {company.stage}
                          </span>
                        )}
                      </div>
                    </div>

                    <h2 className="text-sm font-semibold text-[#0F1B2D]">
                      {company.name}
                    </h2>
                    <p className="text-xs text-[#4A5568] mt-1 line-clamp-2 leading-relaxed">
                      {company.summary || 'No summary provided.'}
                    </p>

                    <div className="mt-3 pt-3 border-t border-[#F0EBE0] space-y-1 text-xs text-[#6B7280]">
                      <div className="flex justify-between">
                        <span>Industry:</span>
                        <strong className="text-[#0F1B2D] font-medium">
                          {company.industry}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Location:</span>
                        <span>{company.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Open Positions:</span>
                        <span className="text-[#286749] font-semibold">
                          {company.open_jobs_count} roles
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2 border-t border-[#F0EBE0]">
                    <Link
                      href={`/jobseeker/companies/${company.id}`}
                      className="flex-1"
                    >
                      <JobBtn secondary small className="w-full">
                        View Profile
                      </JobBtn>
                    </Link>
                    <span className="text-xs text-[#6B7280]">
                      Following unavailable
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {startupJobs.map((job) => (
              <CareerJobCard key={job.id} job={job} />
            ))}
          </div>
        )}
        <Pagination
          page={resource.data}
          onChange={(offset) => setPagination({ key: key + viewMode, offset })}
        />
      </div>
    </JobSeekerShell>
  );
}
