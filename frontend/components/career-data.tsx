'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  ApiError,
  type MarketplaceJob,
  type ApplicationRead,
  type UserMeRead,
} from '@/lib/api/client';
import { JobBtn, JobCard } from './jobseeker-ui';

export { api };
export const stageLabels = {
  applied: 'Applied',
  review: 'In review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offered: 'Offer',
  hired: 'Hired',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};
export const lifecycle = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature',
};
export const dateLabel = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not provided';
export const errorLabel = (error: unknown) =>
  error instanceof ApiError && error.status === 404
    ? 'Not found or no longer available.'
    : error instanceof Error
      ? error.message
      : 'Could not load this resource.';

export function useCareerSearch(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 300);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

/** Cancels old queries, clears stale identity-bound results and ignores late responses. */
export function useCareerResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>
) {
  const { user, loading: authLoading } = useAuth() as {
    user: UserMeRead | null;
    loading: boolean;
  };
  const loader = useRef(load);
  loader.current = load;
  const [revision, setRevision] = useState(0);
  const identity = `${key}:${user?.id || 'public'}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: unknown;
    loading: boolean;
  }>({ key: '', loading: true });
  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    setState({ key: identity, loading: true });
    loader
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key: identity, data, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key: identity, error, loading: false });
      });
    return () => controller.abort();
  }, [identity, authLoading]);
  return {
    ...(state.key === identity && !authLoading
      ? state
      : { loading: true, data: undefined, error: undefined }),
    reload: () => setRevision((v) => v + 1),
  };
}

export function ResourceState({
  resource,
  empty = false,
  emptyLabel = 'Nothing to show yet.',
}: {
  resource: { loading: boolean; error?: unknown; reload: () => void };
  empty?: boolean;
  emptyLabel?: string;
}) {
  if (resource.loading)
    return (
      <div
        role="status"
        className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-sm"
      >
        Loading…
      </div>
    );
  if (resource.error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-200 bg-white p-6 text-sm"
      >
        <p>{errorLabel(resource.error)}</p>
        <JobBtn secondary small onClick={resource.reload}>
          Try again
        </JobBtn>
      </div>
    );
  return empty ? (
    <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-sm">
      {emptyLabel}
    </div>
  ) : null;
}

export function Pagination({
  page,
  onChange,
}: {
  page?: { offset: number; limit: number; total: number; has_more?: boolean };
  onChange: (offset: number) => void;
}) {
  if (!page || page.total <= page.limit) return null;
  return (
    <nav
      aria-label="Results pagination"
      className="flex items-center justify-between gap-3 py-3 text-xs"
    >
      <JobBtn
        secondary
        small
        disabled={!page.offset}
        onClick={() => onChange(Math.max(0, page.offset - page.limit))}
      >
        Previous
      </JobBtn>
      <span>
        {page.offset + 1}–{Math.min(page.offset + page.limit, page.total)} of{' '}
        {page.total}
      </span>
      <JobBtn
        secondary
        small
        disabled={!(page.has_more ?? page.offset + page.limit < page.total)}
        onClick={() => onChange(page.offset + page.limit)}
      >
        Next
      </JobBtn>
    </nav>
  );
}

export function jobView(job: MarketplaceJob) {
  return {
    ...job,
    logo: job.company.name[0],
    loc: job.location || 'Location not provided',
    type: job.employment_type.replaceAll('_', '-'),
    mode: job.work_mode === 'onsite' ? 'On-site' : job.work_mode,
    stage: job.company.stage ? lifecycle[job.company.stage] : null,
    verified: job.company.verified,
    salary: !job.salary_visible
      ? 'Salary not disclosed'
      : job.salary_min != null || job.salary_max != null
        ? `${job.currency} ${job.salary_min ?? '—'}–${job.salary_max ?? '—'} / ${job.salary_period}`
        : 'Salary not provided',
    posted: dateLabel(job.posted_at),
    closes: job.application_deadline
      ? dateLabel(job.application_deadline)
      : 'No deadline specified',
    industry: job.company.sector || 'Not provided',
    responsibilities: job.responsibilities ? [job.responsibilities] : [],
    mustHave: job.skills.map((s) => ({
      skill: s.name,
      required: s.is_required,
      have: false,
    })),
  };
}

export function ApplicationAction({
  job,
  className = '',
}: {
  job: Pick<
    MarketplaceJob,
    'id' | 'can_apply' | 'own_application_id' | 'own_application_stage'
  >;
  className?: string;
}) {
  const { user, hasRole } = useAuth() as {
    user: UserMeRead | null;
    hasRole: (role: string) => boolean;
  };
  if (job.own_application_id)
    return (
      <Link
        className={className}
        href={`/jobseeker/applications/${job.own_application_id}`}
      >
        <JobBtn secondary small>
          {stageLabels[job.own_application_stage as keyof typeof stageLabels] ||
            'View application'}
        </JobBtn>
      </Link>
    );
  if (!user)
    return (
      <Link href={`/login?next=${encodeURIComponent(`/jobseeker/jobs/${job.id}/apply`)}`}>
        <JobBtn primary small>
          Sign in to apply
        </JobBtn>
      </Link>
    );
  if (!hasRole('jobseeker'))
    return (
      <span className="text-xs text-[#6B7280]">
        Job-seeker role required to apply
      </span>
    );
  if (!job.can_apply)
    return (
      <span className="text-xs text-[#6B7280]">
        Not eligible or not accepting applications
      </span>
    );
  return (
    <Link className={className} href={`/jobseeker/jobs/${job.id}/apply`}>
      <JobBtn primary small>
        Apply Now
      </JobBtn>
    </Link>
  );
}

export function CareerJobCard({ job }: { job: MarketplaceJob }) {
  return (
    <JobCard
      job={jobView(job)}
      liveData
      applicationAction={<ApplicationAction job={job} />}
    />
  );
}

export function StageChip({
  stage,
  className = '',
}: {
  stage: string;
  className?: string;
}) {
  const map: Record<string, string> = {
    Applied: 'bg-[#FAF8F4] text-[#4A5568] border-[#E5E1D8]',
    Shortlisted: 'bg-[#FFF8E8] text-[#806236] border-[#D4C3A3]',
    Interview: 'bg-[#E7F3EC] text-[#286749] border-[#CDE5D7]',
    Offer: 'bg-[#B8955A] text-white border-transparent',
    Hired: 'bg-[#286749] text-white border-transparent',
    'Not selected': 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E1D8]',
    Withdrawn: 'bg-[#F3F4F6] text-[#A0A7B4] border-dashed border-[#A0A7B4]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        map[stage] || map.Applied
      } ${className}`}
    >
      {stage}
    </span>
  );
}

export function applicationView(row: ApplicationRead) {
  return {
    ...row,
    stageKey: row.stage,
    stage: stageLabels[row.stage],
    title: row.job_snapshot.title,
    company: row.job_snapshot.company_name,
    logo: row.job_snapshot.company_name[0],
    appliedDate: dateLabel(row.created_at),
    lastUpdate: dateLabel(row.updated_at),
    updated: dateLabel(row.updated_at),
    salaryExpectation:
      row.salary_expectation == null
        ? 'Not provided'
        : `${row.currency} ${row.salary_expectation}`,
    resumeUsed: row.resume_file_id
      ? 'Personal resume attached'
      : 'No resume attached',
  };
}

export function Unavailable({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs text-[#6B7280]">
      {children} — unavailable in this step.
    </p>
  );
}
