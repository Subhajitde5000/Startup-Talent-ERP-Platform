'use client';

import React, { createContext, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EmployerShell, EmployerBtn } from '@/components';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';

const JobsContext = createContext(null);

export function JobNotice({ children, error = false, retry }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-2xl border p-6 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-[#E5E1D8] bg-white text-[#4A5568]'}`}>
    {children}
    {retry && <EmployerBtn secondary className="ml-3" onClick={retry}>Try again</EmployerBtn>}
  </div>;
}

export function jobError(error) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'This job or organization is unavailable. It may have been archived, or you may not have access.';
    if (error.status === 403) return 'You do not have permission to access or change this organization’s jobs.';
    return error.message;
  }
  return 'Could not connect. Please try again.';
}

function JobsWorkspace({ children }) {
  const { user, loading: authLoading, hasRole } = useAuth();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const selected = params.get('org_id');
  const allowed = hasRole('employer') || user?.organizations?.some(o => (o.type || o.membership_type) === 'employer');
  const [state, setState] = useState({ loading: true, orgs: [], error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (authLoading || !user || !allowed) return;
    const controller = new AbortController();
    setState({ loading: true, orgs: [], error: '' });
    api.organizations.mine(controller.signal).then(orgs => {
      if (!controller.signal.aborted) setState({ loading: false, orgs: orgs.filter(o => o.type === 'employer' && o.status === 'active'), error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, orgs: [], error: jobError(error) });
    });
    return () => controller.abort();
  }, [authLoading, user, allowed, retry]);
  const org = selected ? state.orgs.find(o => o.id === selected) : (state.orgs.length === 1 ? state.orgs[0] : null);
  const href = useCallback(path => org ? `${path}${path.includes('?') ? '&' : '?'}org_id=${encodeURIComponent(org.id)}` : path, [org]);
  const canWrite = Boolean(org && ['owner', 'admin'].includes(org.my_role));
  const workspace = { user, org, canWrite, href };
  return <EmployerShell activeNav="Hiring" jobsWorkspace={workspace}>
    <div className="mx-auto max-w-[1280px] space-y-6 min-w-0 pb-10">
      {!state.loading && state.orgs.length > 1 && <div className="rounded-2xl border border-[#E5E1D8] bg-white p-4 text-xs">
        <label htmlFor="jobs-organization" className="mr-3 font-semibold">Organization</label>
        <select id="jobs-organization" value={org?.id || ''} onChange={e => router.push(`${pathname}?org_id=${encodeURIComponent(e.target.value)}`)} className="rounded-xl border border-[#E5E1D8] bg-white px-3 py-2">
          <option value="" disabled>Select an organization</option>
          {state.orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>}
      {state.loading || authLoading ? <JobNotice>Loading your jobs workspace…</JobNotice>
        : state.error ? <JobNotice error retry={() => setRetry(n => n + 1)}>{state.error}</JobNotice>
          : !state.orgs.length ? <JobNotice>You do not have an active employer organization. <Link href="/employer/profile" className="underline">View your organization profile</Link>.</JobNotice>
            : !org ? <JobNotice error={Boolean(selected)}>{selected ? 'This organization is not available to your account. Select one of your active organizations.' : 'Select an organization to view its jobs.'}</JobNotice>
              : <JobsContext.Provider key={`${user?.id}:${org.id}`} value={workspace}>{children}</JobsContext.Provider>}
    </div>
  </EmployerShell>;
}

export function JobsPage({ children }) {
  return <Suspense fallback={<div className="p-8" role="status">Loading jobs…</div>}><JobsWorkspace>{children}</JobsWorkspace></Suspense>;
}

export function useJobsWorkspace() {
  return useContext(JobsContext);
}

export function useJob(jobId) {
  const { org } = useJobsWorkspace();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, job: null, error: '' });
  const reload = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, job: null, error: '' });
    api.jobs.get(org.id, jobId, controller.signal).then(job => {
      if (!controller.signal.aborted) setState({ loading: false, job, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, job: null, error: jobError(error), errorStatus: error.status });
    });
    return () => controller.abort();
  }, [org.id, jobId, revision]);
  return { ...state, reload };
}

export function jobLabel(value) {
  if (!value) return 'Not specified';
  if (value === 'onsite') return 'On-site';
  if (value === 'open') return 'Active';
  return value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function jobSalary(job) {
  if (job.salary_min == null && job.salary_max == null) return 'Not specified';
  // Decimal strings are displayed as strings, never coerced through binary floats.
  const amount = value => value == null ? null : String(value).replace(/\.00$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const range = job.salary_min == null ? `Up to ${amount(job.salary_max)}` : job.salary_max == null ? `From ${amount(job.salary_min)}` : `${amount(job.salary_min)} – ${amount(job.salary_max)}`;
  return `${job.currency} ${range} / ${job.salary_period === 'monthly' ? 'month' : 'year'}`;
}
