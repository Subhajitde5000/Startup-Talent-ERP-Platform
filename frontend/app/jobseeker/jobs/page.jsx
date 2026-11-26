'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  MapPin,
  SlidersHorizontal,
  X,
  Briefcase,
  ArrowRight,
  Filter,
  Sparkles,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import {
  api,
  useCareerSearch,
  useCareerResource,
  CareerJobCard,
  ResourceState,
  Pagination,
  dateLabel,
} from '@/components/career-data';
import { useAuth } from '@/lib/auth-context';

export default function JobSearchPage() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [filters, setFilters] = useState({
    jobType: [],
    workMode: [],
    experience: [],
    companyStage: [],
    verifiedOnly: false,
  });
  const [sort, setSort] = useState('best');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const toggleFilter = (category, value) => {
    setFilters((prev) => {
      const current = prev[category] || [];
      const updated = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const resetFilters = () => {
    setFilters({
      jobType: [],
      workMode: [],
      experience: [],
      companyStage: [],
      verifiedOnly: false,
    });
    setQuery('');
    setLocation('');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.jobType.length) count += filters.jobType.length;
    if (filters.workMode.length) count += filters.workMode.length;
    if (filters.companyStage.length) count += filters.companyStage.length;
    if (filters.verifiedOnly) count += 1;
    return count;
  }, [filters]);

  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const searchQuery = useCareerSearch(query);
  const searchLocation = useCareerSearch(location);
  const search = {
    q: searchQuery || undefined,
    location: searchLocation || undefined,
    work_modes: filters.workMode.map(
      (v) => ({ Remote: 'remote', Hybrid: 'hybrid', 'On-site': 'onsite' })[v]
    ),
    employment_types: filters.jobType.map((v) =>
      v.toLowerCase().replace('-', '_')
    ),
    stages: filters.companyStage.map((v) => v.toLowerCase().replace(' ', '_')),
    verified_only: filters.verifiedOnly,
    sort: sort === 'best' ? 'relevance' : sort,
    limit: 20,
  };
  const searchKey = JSON.stringify(search);
  const [pageKey, setPageKey] = useState('');
  const pageOffset = pageKey === searchKey ? offset : 0;
  const resource = useCareerResource(searchKey + ':' + pageOffset, (signal) =>
    api.careers.jobs({ ...search, offset: pageOffset }, Boolean(user), signal)
  );
  const filtered = resource.data?.items || [];
  const changePage = (next) => {
    setPageKey(searchKey);
    setOffset(next);
  };

  const [invitations, setInvitations] = useState({ items: [], total: 0 });

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.talent
      .myInvitations({ limit: 10 })
      .then((data) => {
        if (active && data) {
          setInvitations(data);
        }
      })
      .catch(() => {
        // Silent catch: candidate may not have outreach yet
      });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <JobSeekerShell active="Jobs" liveData>
      <div className="space-y-6">
        {/* Search header card */}
        <section className="rounded-2xl border border-[#E5E1D8] bg-white p-5 md:p-6 shadow-sm">
          <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D] mb-1">
            Discover Startup & Employer Roles
          </h1>
          <p className="text-xs md:text-sm text-[#4A5568] mb-5">
            Explore current openings, published compensation, and company
            details.
          </p>

          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-6">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0A7B4]"
                size={18}
              />
              <input
                type="text"
                aria-label="Job title, skill or company"
                maxLength={100}
                placeholder="Job title, skill, or keyword..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 text-sm text-[#0F1B2D] placeholder-[#A0A7B4] focus:border-[#B8955A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#B8955A]"
              />
            </div>
            <div className="relative md:col-span-4">
              <MapPin
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0A7B4]"
                size={18}
              />
              <input
                type="text"
                aria-label="Location or remote"
                maxLength={200}
                placeholder="City, region, or 'Remote'..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 text-sm text-[#0F1B2D] placeholder-[#A0A7B4] focus:border-[#B8955A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#B8955A]"
              />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <JobBtn
                primary
                onClick={resource.reload}
                className="w-full h-11 text-xs"
              >
                Search
              </JobBtn>
              <button
                type="button"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="lg:hidden grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] text-[#0F1B2D]"
                aria-label="Toggle filters"
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* Direct Employer Invitations */}
        {user && invitations.items.length > 0 && (
          <section className="rounded-2xl border border-[#D5C29D] bg-gradient-to-br from-[#FCF9F3] via-white to-[#F9F5EC] p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#EADFCB] pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#F5EBD7] text-[#8C6D37]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    Invitations to Apply ({invitations.total})
                  </h2>
                  <p className="text-xs text-[#5D6B82]">
                    Employers and hiring founders who directly invited you to apply based on your talent profile.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#EFE4CF] px-2.5 py-0.5 text-xs font-semibold text-[#785A28]">
                Direct Outreach
              </span>
            </div>

            <div className="grid gap-3.5 md:grid-cols-2">
              {invitations.items.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E5DEC9] bg-white p-4 shadow-xs transition hover:border-[#C4A972] hover:shadow-sm"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/jobseeker/jobs/${inv.job_id}`}
                          className="text-sm font-semibold text-[#0F1B2D] hover:text-[#9A7A45] transition-colors"
                        >
                          {inv.job_title}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-[#4A5568] mt-0.5">
                          <Building2 size={13} className="text-[#8C6D37]" />
                          <span className="font-medium text-[#1E293B]">{inv.org_name}</span>
                          {inv.job_location && (
                            <>
                              <span>•</span>
                              <span>{inv.job_location}</span>
                            </>
                          )}
                          {inv.job_work_mode && (
                            <span className="capitalize text-[#718096]">({inv.job_work_mode})</span>
                          )}
                        </div>
                      </div>
                      {inv.applied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200 shrink-0">
                          <CheckCircle2 size={11} /> Applied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200 shrink-0">
                          Invited
                        </span>
                      )}
                    </div>

                    {inv.note && (
                      <div className="rounded-lg bg-[#FAF8F4] border-l-2 border-[#B8955A] px-3 py-2 text-xs italic text-[#4A5568]">
                        “{inv.note}”
                      </div>
                    )}

                    <div className="text-[11px] text-[#718096]">
                      Invited {inv.sent_by_name ? `by ${inv.sent_by_name}` : ''} • {dateLabel(inv.created_at)}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F0EBE0] flex items-center justify-end gap-2">
                    {inv.applied ? (
                      <Link
                        href={`/jobseeker/applications/${inv.application_id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                      >
                        Track Application <ArrowRight size={13} />
                      </Link>
                    ) : (
                      <>
                        <Link
                          href={`/jobseeker/jobs/${inv.job_id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
                        >
                          View Job
                        </Link>
                        <Link
                          href={`/jobseeker/jobs/${inv.job_id}/apply`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#B8955A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#9E7D42] shadow-xs transition"
                        >
                          Apply Now <ArrowRight size={13} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Results Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#0F1B2D]">
              {resource.data?.total ?? '—'}{' '}
              {resource.data?.total === 1 ? 'job' : 'jobs'} available
            </h2>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-0.5 text-xs text-[#806236] hover:bg-[#EBDDC8]"
              >
                <span>{activeFiltersCount} active</span>
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="sort-select" className="text-[#6B7280]">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            >
              <option value="best">Keyword relevance</option>
              <option value="newest">Recently Posted</option>
              <option value="salary">Compensation (High to Low)</option>
            </select>
            <span className="text-[#6B7280]">Saved searches unavailable</span>
          </div>
        </div>

        {/* Main 2-column layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Filters column (desktop + mobile collapsible) */}
          <aside
            className={`space-y-5 lg:col-span-4 ${
              showMobileFilters ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-[#F0EBE0] pb-3">
                <span className="text-sm font-semibold text-[#0F1B2D] flex items-center gap-2">
                  <Filter size={15} className="text-[#B8955A]" /> Filters
                </span>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs text-[#9A7A45] hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Work Mode */}
              <div>
                <span className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                  Work Mode
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['Remote', 'Hybrid', 'On-site'].map((mode) => {
                    const active = filters.workMode.includes(mode);
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => toggleFilter('workMode', mode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-[#0F1B2D] text-white border-[#0F1B2D]'
                            : 'bg-[#FAF8F4] text-[#4A5568] border-[#E5E1D8] hover:bg-[#F3EBDD]'
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Job Type */}
              <div>
                <span className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                  Job Type
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['Full-time', 'Part-time', 'Contract', 'Internship'].map(
                    (type) => {
                      const active = filters.jobType.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleFilter('jobType', type)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-[#0F1B2D] text-white border-[#0F1B2D]'
                              : 'bg-[#FAF8F4] text-[#4A5568] border-[#E5E1D8] hover:bg-[#F3EBDD]'
                          }`}
                        >
                          {type}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Company Stage */}
              <div>
                <span className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                  Company Stage
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Idea',
                    'Prototype',
                    'Early revenue',
                    'Growth',
                    'Mature',
                  ].map((stage) => {
                    const active = filters.companyStage.includes(stage);
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => toggleFilter('companyStage', stage)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-[#0F1B2D] text-white border-[#0F1B2D]'
                            : 'bg-[#FAF8F4] text-[#4A5568] border-[#E5E1D8] hover:bg-[#F3EBDD]'
                        }`}
                      >
                        {stage}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Verified Only */}
              <div className="pt-3 border-t border-[#F0EBE0]">
                <label className="flex items-center gap-2.5 text-xs text-[#0F1B2D] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.verifiedOnly}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        verifiedOnly: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                  />
                  <span>Verified Employers Only</span>
                </label>
              </div>
            </div>

            {/* Quick links banner */}
            <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-xs space-y-2">
              <span className="font-semibold text-[#0F1B2D] flex items-center gap-1.5">
                <Briefcase size={14} className="text-[#B8955A]" /> Looking for
                Startups?
              </span>
              <p className="text-[#6B7280] leading-relaxed">
                Browse startups with current openings.
              </p>
              <Link
                href="/jobseeker/startups"
                className="inline-flex items-center gap-1 text-[#9A7A45] font-semibold hover:underline"
              >
                Explore Startups <ArrowRight size={13} />
              </Link>
            </div>
          </aside>

          {/* Job listings column */}
          <div className="lg:col-span-8 space-y-4">
            <ResourceState
              resource={resource}
              empty={!filtered.length}
              emptyLabel="No matching jobs found. Try changing your filters."
            />
            {!resource.loading &&
              !resource.error &&
              filtered.map((j) => <CareerJobCard key={j.id} job={j} />)}
            <Pagination page={resource.data} onChange={changePage} />
          </div>
        </div>
      </div>
    </JobSeekerShell>
  );
}
