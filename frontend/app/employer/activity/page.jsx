'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  EmployerShell,
  EmployerBtn,
  EmployerCard,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { useCareerResource, ResourceState, Pagination } from '@/components/career-data';
import { api } from '@/lib/api/client';
import {
  Activity,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Lock,
  Search,
  Shield,
  User,
  X,
  Eye,
} from 'lucide-react';

function ActivityContent() {
  const {org} = useJobsWorkspace();
  const [activeTab, setActiveTab] = useState('All activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const resource = useCareerResource(`hiring-activity:${org.id}:${offset}`, signal => api.hiringInsights.activity(org.id, {limit:20, offset}, signal));
  const filteredLogs = (resource.data?.items || []).filter(item => {
    const q = searchQuery.trim().toLowerCase();
    const matches = !q || `${item.summary} ${item.actor_name || ''}`.toLowerCase().includes(q);
    if (activeTab === 'Candidate data access' || activeTab === 'Security') return false;
    if (activeTab === 'Offers and hires') return matches && /^(offer|hire)_/.test(item.event_type);
    return matches;
  });
  const tabs = [
    'All activity',
    'Candidate data access',
    'Hiring actions',
    'Offers and hires',
    'Security',
  ];

  return (
    <>
      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1B2D]">
              Hiring Activity
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5568]">
              Recent hiring events. Sensitive activity details are redacted; this is not a complete compliance audit.
            </p>
          </div>

        </div>

        {(resource.loading || resource.error) && <ResourceState resource={resource} />}
        {(activeTab === 'Candidate data access' || activeTab === 'Security') && <p className="text-xs">This category is not available in the hiring feed.</p>}
        <p className="text-xs text-[#6B7280]">Search and filters apply to the current page.</p>
        {/* Filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E1D8] pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
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

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-[#4A5568]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit trail..."
                className="w-40 sm:w-48 rounded-lg border border-[#E5E1D8] pl-8 pr-2.5 py-1 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              />
            </div>

          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#E5E1D8] bg-white shadow-sm">
          <table className="w-full text-left text-xs min-w-[540px]">
            <thead className="bg-[#FAF8F4] text-[#4A5568] border-b border-[#E5E1D8]">
              <tr>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Target Object</th>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1D8]">
              {filteredLogs.map((entry, idx) => (
                <tr key={idx} className="hover:bg-[#FAF8F4]/50">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#0F1B2D]">{entry.summary}</span>
                  </td>
                  <td className="px-4 py-3 text-[#4A5568]">
                    <span className="inline-flex items-center gap-1 font-medium text-[#0F1B2D]">
                      <User size={12} className="text-[#806236]" /> {entry.actor_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#4A5568]">—</td>
                  <td className="px-4 py-3 text-[#4A5568]">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {entry.link_url && <Link className="text-[#806236] underline" href={entry.link_url}>View</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!resource.loading && !resource.error && filteredLogs.length === 0 && <p className="text-xs">No activity found on this page.</p>}
        <Pagination page={resource.data} onChange={setOffset} />
      </div>
    </>
  );
}

export default function EmployerActivityPage() { return <JobsPage activeNav="Activity Log" hiringInsights><ActivityContent /></JobsPage>; }
