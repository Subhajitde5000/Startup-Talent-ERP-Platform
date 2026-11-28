'use client';

import { AlertCircle, Loader2, LockKeyhole } from 'lucide-react';
import { ApiError } from '@/lib/api/client';

export const PIPELINE_STAGES = ['applied', 'review', 'shortlisted', 'interview', 'offered', 'hired'];

export const REVIEWER_MOVE_STAGES = ['applied', 'review', 'shortlisted', 'interview', 'rejected'];

export const STAGE_LABELS = {
  applied: 'Applied',
  review: 'In review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offered: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const REJECTION_REASONS = [
  { value: 'skills_mismatch', label: 'Skills mismatch' },
  { value: 'experience', label: 'Experience level' },
  { value: 'role_filled', label: 'Role filled' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'timing', label: 'Timing' },
  { value: 'other', label: 'Other' },
];

export const JOB_STATUS_LABELS = {
  draft: 'Draft',
  open: 'Open',
  paused: 'Paused',
  closed: 'Closed',
  archived: 'Archived',
};

export const DEPARTMENT_OPTIONS = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'product', label: 'Product' },
  { value: 'design', label: 'Design' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'other', label: 'Other' },
];

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

export const WORK_MODE_OPTIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public on Jobs marketplace' },
  { value: 'platform_only', label: 'Platform members only' },
  { value: 'link_only', label: 'Link only' },
];

export const INTERVIEW_FORMAT_OPTIONS = [
  { value: 'video', label: 'Video' },
  { value: 'phone', label: 'Phone' },
  { value: 'onsite', label: 'On-site' },
  { value: 'async', label: 'Async' },
];

export const RECOMMENDATION_OPTIONS = [
  { value: 'strong_yes', label: 'Strong yes' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'strong_no', label: 'Strong no' },
];

export function formatMoney(value, currency = 'INR') {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label || value || '—';
}

export function errorMessage(err, fallback = 'Something went wrong.') {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function extractFieldErrors(err) {
  const out = {};
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return out;
  for (const item of err.details) {
    if (!item || typeof item !== 'object') continue;
    const loc = Array.isArray(item.loc) ? item.loc : [];
    const field = loc[loc.length - 1];
    if (typeof field === 'string' && item.msg && !out[field]) {
      out[field] = String(item.msg);
    }
  }
  return out;
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E5E1D8] bg-white p-10 text-sm text-[#4A5568]">
      <Loader2 size={16} className="animate-spin text-[#9A7A45]" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F3C6C6] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]">
      <div className="flex items-center gap-2">
        <AlertCircle size={18} />
        <span>{message || 'Could not load data.'}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-[#F3C6C6] bg-white px-3 py-1.5 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D6D0C5] bg-white p-8 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-xs text-[#4A5568]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ViewerRestrictedState({ message }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E1D8] bg-white p-6 text-sm text-[#4A5568]">
      <LockKeyhole size={18} className="mt-0.5 shrink-0 text-[#9A7A45]" />
      <div>
        <p className="font-semibold text-ink">Access restricted for your role</p>
        <p className="mt-1 text-xs">{message}</p>
      </div>
    </div>
  );
}
