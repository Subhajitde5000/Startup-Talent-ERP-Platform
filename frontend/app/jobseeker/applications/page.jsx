'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import {
  StageChip,
  api,
  useCareerSearch,
  useCareerResource,
  ResourceState,
  Pagination,
  applicationView,
  stageLabels,
} from '@/components/career-data';

const STAGES = ['All', ...Object.values(stageLabels)];

export default function ApplicationTrackerPage() {
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'list'
  const [stageFilter, setStageFilter] = useState('All');
  const [search, setSearch] = useState('');

  const searchQuery = useCareerSearch(search);
  const query = {
    stage: Object.keys(stageLabels).find((k) => stageLabels[k] === stageFilter),
    q: searchQuery || undefined,
    limit: 20,
  };
  const key = JSON.stringify(query);
  const [pagination, setPagination] = useState({ key: '', offset: 0 });
  const offset = pagination.key === key ? pagination.offset : 0;
  const resource = useCareerResource(
    `applications:${key}:${offset}`,
    (signal) => api.careers.applications({ ...query, offset }, signal)
  );
  const filtered = (resource.data?.items || []).map(applicationView);
  const stageCounts = resource.data
    ? Object.fromEntries(
        Object.entries(resource.data.stage_counts || {}).map(([k, v]) => [
          stageLabels[k],
          v,
        ])
      )
    : {};
  if (resource.data)
    stageCounts.All = Object.values(resource.data.stage_counts || {}).reduce(
      (a, b) => a + b,
      0
    );

  return (
    <JobSeekerShell active="Applications" liveData>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Applications Pipeline
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Track your submitted applications and actual stage changes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`p-2 rounded-lg border text-xs ${
                viewMode === 'board'
                  ? 'border-[#B8955A] bg-[#FFF8E8] text-[#806236]'
                  : 'border-[#E5E1D8] bg-white text-[#4A5568]'
              }`}
              aria-label="Kanban board view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg border text-xs ${
                viewMode === 'list'
                  ? 'border-[#B8955A] bg-[#FFF8E8] text-[#806236]'
                  : 'border-[#E5E1D8] bg-white text-[#4A5568]'
              }`}
              aria-label="Table list view"
            >
              <List size={15} />
            </button>
            <Link href="/jobseeker/jobs">
              <JobBtn primary small>
                + Browse New Jobs
              </JobBtn>
            </Link>
          </div>
        </div>

        {/* Filter bar with stage chips - horizontally scrollable to prevent blowout */}
        <div className="rounded-xl border border-[#E5E1D8] bg-white p-4 space-y-3">
          <div className="overflow-x-auto min-w-0 pb-1">
            <div className="flex items-center gap-2 min-w-max">
              {STAGES.map((s) => {
                const active = stageFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStageFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      active
                        ? 'border-[#B8955A] bg-[#F3EBDD] text-[#806236]'
                        : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    {s}{' '}
                    <span className="opacity-60 font-normal">
                      ({resource.data ? stageCounts[s] || 0 : '—'})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F0EBE0]">
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]"
                size={15}
              />
              <input
                type="text"
                aria-label="Search applications"
                maxLength={100}
                placeholder="Search by role or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4]/50 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              />
            </div>
            <span className="text-xs text-[#6B7280]">
              Showing <strong>{filtered.length}</strong>{' '}
              {filtered.length === 1 ? 'application' : 'applications'}
            </span>
          </div>
        </div>

        <ResourceState
          resource={resource}
          empty={!filtered.length}
          emptyLabel="No matching applications. Browse jobs to get started."
        />
        {/* Board (Kanban) View */}
        {!resource.loading &&
          !resource.error &&
          (viewMode === 'board' ? (
            <div className="overflow-x-auto min-w-0 pb-4">
              <div className="flex gap-4 min-w-[920px]">
                {(stageFilter === 'All'
                  ? Object.values(stageLabels)
                  : [stageFilter]
                ).map((colStage) => {
                  const colItems = filtered.filter((a) => a.stage === colStage);
                  return (
                    <div
                      key={colStage}
                      className="flex-1 flex flex-col rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/70 p-3 min-w-[220px]"
                    >
                      <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-xs font-bold text-[#0F1B2D] uppercase tracking-wider">
                          {colStage}
                        </h3>
                        <span className="rounded-full bg-white border border-[#E5E1D8] px-2 py-0.5 text-xs font-semibold text-[#4A5568]">
                          {colItems.length}
                        </span>
                      </div>

                      <div className="space-y-2.5 flex-1 overflow-y-auto">
                        {colItems.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-[#E5E1D8] p-4 text-center text-xs text-[#A0A7B4]">
                            No applications on this page in {colStage}
                          </div>
                        ) : (
                          colItems.map((app) => (
                            <div
                              key={app.id}
                              className="rounded-xl border border-[#E5E1D8] bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow space-y-2"
                            >
                              <div className="flex items-start gap-2.5">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-bold text-xs text-[#806236]">
                                  {app.logo || app.company?.[0] || 'A'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <Link
                                    href={`/jobseeker/applications/${app.id}`}
                                    className="text-xs font-bold text-[#0F1B2D] hover:underline truncate block"
                                  >
                                    {app.title}
                                  </Link>
                                  <span className="text-xs text-[#6B7280] block truncate">
                                    {app.company}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-[#4A5568]">
                                {app.salaryExpectation}
                              </p>

                              <div className="pt-2 border-t border-[#F0EBE0] flex items-center justify-between text-xs text-[#6B7280]">
                                <span>Applied {app.appliedDate}</span>
                                <Link
                                  href={`/jobseeker/applications/${app.id}`}
                                  className="text-[#9A7A45] font-semibold hover:underline flex items-center gap-0.5"
                                >
                                  View <ChevronRight size={12} />
                                </Link>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Table (List) View with responsive overflow wrapper */
            <div className="rounded-xl border border-[#E5E1D8] bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b border-[#E5E1D8] text-[#6B7280] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3.5 pl-5">Role & Company</th>
                      <th className="p-3.5">Stage</th>
                      <th className="p-3.5">Applied Date</th>
                      <th className="p-3.5">Next Step</th>
                      <th className="p-3.5 pr-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EBE0] text-[#0F1B2D]">
                    {filtered.map((app) => (
                      <tr
                        key={app.id}
                        className="hover:bg-[#FAF8F4]/50 transition-colors"
                      >
                        <td className="p-3.5 pl-5">
                          <Link
                            href={`/jobseeker/applications/${app.id}`}
                            className="font-semibold text-sm hover:underline block"
                          >
                            {app.title}
                          </Link>
                          <span className="text-[#6B7280]">
                            {app.company} · {app.loc}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <StageChip stage={app.stage} />
                        </td>
                        <td className="p-3.5 text-[#4A5568]">
                          {app.appliedDate}
                        </td>
                        <td className="p-3.5 text-[#4A5568] font-medium">
                          {'Not available in this step'}
                        </td>
                        <td className="p-3.5 pr-5 text-right space-x-2">
                          <Link href={`/jobseeker/applications/${app.id}`}>
                            <JobBtn secondary small>
                              Details
                            </JobBtn>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        <Pagination
          page={resource.data}
          onChange={(offset) => setPagination({ key, offset })}
        />
      </div>
    </JobSeekerShell>
  );
}
