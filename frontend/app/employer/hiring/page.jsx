'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Plus } from 'lucide-react';
import { EmployerBtn, StageChip } from '@/components';
import { api } from '@/lib/api/client';
import { JobsPage, JobNotice, jobError, jobLabel, jobSalary, useJobsWorkspace } from '@/components/employer-jobs-workspace';

function HiringOverview() {
  const { org, canWrite, href } = useJobsWorkspace();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, page: null, error: '' });
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const limit = 20;
  useEffect(() => {
    // Do not reset pagination on mount (or when only surrounding whitespace changes).
    if (search.trim() === query) return;
    const timer = setTimeout(() => { setQuery(search.trim()); setOffset(0); }, 250);
    return () => clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, page: null, error: '' });
    api.jobs.list(org.id, { status: status || undefined, q: query || undefined, limit, offset }, controller.signal).then(page => {
      if (!controller.signal.aborted) setState({ loading: false, page, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, page: null, error: jobError(error) });
    });
    return () => controller.abort();
  }, [org.id, status, query, offset, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setSummary(null); setSummaryError('');
    api.jobs.summary(org.id, controller.signal).then(value => {
      if (!controller.signal.aborted) setSummary(value);
    }).catch(error => {
      if (!controller.signal.aborted) setSummaryError(jobError(error));
    });
    return () => controller.abort();
  }, [org.id, revision]);
  return <>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">Hiring Overview & Job Postings</h1><p className="text-xs md:text-sm text-[#6B7280] mt-1">Manage your organization’s job postings.</p></div>
      <div className="flex flex-wrap items-center gap-2"><span title="Hiring requests will be connected in Step 7i"><EmployerBtn secondary small disabled>New Hiring Request</EmployerBtn></span>{canWrite && <Link href={href('/employer/jobs/new')}><EmployerBtn primary small><Plus size={14} />Create Job Post</EmployerBtn></Link>}</div>
    </div>
    {!canWrite && <p className="text-xs text-[#6B7280]">Read-only access. Only an owner or admin can create or change jobs.</p>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
      <div className="rounded-2xl border border-[#E5E1D8] bg-white p-4"><span className="text-xs text-[#6B7280]">Active Openings</span><div className="mt-1 text-2xl font-serif font-bold text-[#0F1B2D]">{summary ? summary.by_status.open : '—'}</div><span className="text-xs text-[#286749]">{summary ? `${summary.total} job posts in total` : summaryError ? 'Count unavailable' : 'Loading counts…'}</span></div>
      {[['Total Inbound Applicants', 'Applicant tracking is not connected yet.'], ['Interviews Scheduled', 'Interview scheduling is not connected yet.'], ['Offers Extended', 'Offers are not connected yet.']].map(([label, message]) => <div key={label} className="rounded-2xl border border-[#E5E1D8] bg-white p-4"><span className="text-xs text-[#6B7280]">{label}</span><div className="mt-1 text-2xl font-serif font-bold text-[#0F1B2D]">—</div><span className="text-xs text-[#6B7280]">{message}</span></div>)}
    </div>
    {summaryError && <JobNotice error retry={() => setRevision(n => n + 1)}>Job counts: {summaryError}</JobNotice>}
    <div className="rounded-2xl border border-[#E5E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
      <div className="relative flex-1 max-w-sm min-w-[200px]"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={15} /><input type="search" maxLength={100} aria-label="Search job openings" placeholder="Search by job title..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none" /></div>
      <div className="flex items-center gap-2 overflow-x-auto min-w-0 text-xs">{[['', 'All'], ['open', 'Active'], ['draft', 'Draft'], ['paused', 'Paused'], ['closed', 'Closed']].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setOffset(0); }} className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${status === value ? 'bg-[#0F1B2D] text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'}`}>{label}</button>)}</div>
    </div>
    {state.loading ? <JobNotice>Loading jobs…</JobNotice> : state.error ? <JobNotice error retry={() => setRevision(n => n + 1)}>{state.error}</JobNotice> : <div className="rounded-2xl border border-[#E5E1D8] bg-white overflow-hidden shadow-xs min-w-0">
      <div className="overflow-x-auto min-w-0"><table className="w-full text-left text-xs min-w-[620px]"><thead className="bg-[#FAF8F4] border-b border-[#E5E1D8] text-[#6B7280] uppercase tracking-wider font-semibold"><tr>{['Job Title & Dept', 'Location & Mode', 'Salary Range', 'Candidates', 'Status', 'Actions'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#F0EBE0] text-[#0F1B2D]">
        {!state.page.items.length ? <tr><td colSpan={6} className="p-8 text-center text-xs text-[#6B7280]">{query || status ? 'No job listings match your current filters.' : 'No jobs yet. An owner or admin can create the first draft.'}</td></tr> : state.page.items.map(job => <tr key={job.id} className="hover:bg-[#FAF8F4]/50 transition-colors">
          <td className="p-4 pl-6"><Link href={href(`/employer/jobs/${job.id}`)} className="font-semibold text-sm hover:underline block text-[#0F1B2D]">{job.title}</Link><span className="text-[#6B7280]">{jobLabel(job.department)} · {job.posted_at ? `Posted ${new Date(job.posted_at).toLocaleDateString()}` : 'Not published'}</span></td>
          <td className="p-4 text-[#4A5568]">{job.location || 'Not specified'} ({jobLabel(job.work_mode)})</td><td className="p-4 font-medium">{jobSalary(job)}</td><td className="p-4 text-[#6B7280]">Not connected yet</td><td className="p-4"><StageChip stage={jobLabel(job.status)} /></td>
          <td className="p-4 pr-6 text-right space-x-2"><Link href={href(`/employer/jobs/${job.id}`)}><EmployerBtn primary small>View Job</EmployerBtn></Link>{canWrite && <Link href={href(`/employer/jobs/${job.id}/edit`)}><EmployerBtn secondary small>Edit</EmployerBtn></Link>}</td>
        </tr>)}
      </tbody></table></div>
      <div className="flex items-center justify-between gap-3 border-t border-[#E5E1D8] p-4 text-xs"><span>{state.page.total ? `${offset + 1}–${offset + state.page.items.length} of ${state.page.total}` : '0 jobs'}</span><div className="flex gap-2"><EmployerBtn secondary small disabled={!offset} onClick={() => setOffset(n => Math.max(0, n - limit))}>Previous</EmployerBtn><EmployerBtn secondary small disabled={!state.page.has_more} onClick={() => setOffset(n => n + limit)}>Next</EmployerBtn></div></div>
    </div>}
  </>;
}

export default function HiringOverviewPage() {
  return <JobsPage><HiringOverview /></JobsPage>;
}
