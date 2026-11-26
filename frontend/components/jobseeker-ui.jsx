'use client';

import React from 'react';
import Link from 'next/link';
import {
  Bookmark,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  MoreHorizontal,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

export const INK = '#0F1B2D';
export const RADIUS_CARD = 'rounded-xl';
export const RADIUS_CONTROL = 'rounded-lg';

export const defaultUser = {
  name: 'Aanya Sen',
  role: 'Job seeker',
  headline: 'Senior Product Designer · 6 yrs exp · Design systems & UX strategy',
  signedIn: true,
  savedIds: ['senior-product-designer', 'ux-researcher', 'lead-product-designer'],
  appliedIds: ['senior-product-designer'],
  skills: ['Product design', 'Figma', 'Design systems', 'User research', 'React'],
  preferences: {
    roles: ['Product design', 'UX research', 'Design Systems'],
    locations: ['Remote', 'Kolkata', 'Bengaluru'],
    modes: ['Remote', 'Hybrid'],
  },
};

export function JobBtn({
  children,
  onClick = () => {},
  primary = false,
  secondary = false,
  destructive = false,
  small = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none select-none';
  const styles = primary
    ? 'bg-[#0F1B2D] text-white hover:bg-[#1C2B42] active:bg-[#0A121F]'
    : secondary
    ? 'border border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA] active:bg-[#ECE7DC]'
    : destructive
    ? 'border border-transparent bg-transparent text-[#B42318] hover:bg-[#FCE8E6]'
    : 'border border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA]';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${RADIUS_CONTROL} ${small ? 'px-3 py-1.5 min-h-[34px]' : 'px-4 py-2 min-h-10'} ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatusChip({ status }) {
  const map = {
    Open: 'bg-[#E7F3EC] text-[#286749]',
    'Closing soon': 'bg-[#FFF8E8] text-[#9A7A45]',
    Closed: 'bg-[#F3F4F6] text-[#4A5568]',
    Applied: 'border border-[#0F1B2D] text-[#0F1B2D]',
    Saved: 'bg-[#F3EBDD] text-[#806236]',
    'Draft application': 'border border-[#4A5568] text-[#4A5568]',
    'Removed by employer': 'border border-[#A0A7B4] text-[#A0A7B4]',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || map.Open}`}>
      {status}
    </span>
  );
}

export function AIHint({ label = 'AI suggestion', reason, onWhy }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs text-[#806236] font-medium">
      <Sparkles size={12} className="shrink-0" />
      <span>{label}</span>
      {onWhy && reason && (
        <button
          type="button"
          onClick={onWhy}
          className="ml-1 text-[#9A7A45] underline underline-offset-1 hover:text-[#806236]"
        >
          Why?
        </button>
      )}
      {reason && <span className="ml-2 text-xs text-[#4A5568]">{reason}</span>}
    </span>
  );
}

export function SafetyStrip({ reportLabel = 'Report this job', liveData = false }) {
  return (
    <div className="rounded-xl border border-[#FFF8E8] bg-[#FFF8E8] p-3.5 text-left">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 text-[#B7791F] shrink-0" size={16} />
        <div className="text-xs text-[#806236] leading-relaxed">
          Never pay to apply or share sensitive banking credentials during recruitment.{' '}
          {liveData ? <span>Reporting and additional safety tools are unavailable in this step.</span> : <>
          <Link href="/jobseeker/alerts" className="text-[#9A7A45] underline font-medium hover:text-[#806236]">
            {reportLabel}
          </Link>
          <span className="mx-1.5 text-[#B7791F]">·</span>
          <span className="text-[#9A7A45] underline hover:text-[#806236] cursor-pointer">Safety guidelines</span></>}

        </div>
      </div>
    </div>
  );
}

export function SaveToggle({ saved, onChange, label = 'Save', size = 'md', disabled = false }) {
  const isSaved = !!saved;
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={isSaved}
      aria-label={isSaved ? 'Remove from saved' : 'Save job'}
      className={`inline-flex items-center justify-center gap-1.5 min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      } ${
        isSaved
          ? 'bg-[#F3EBDD] text-[#806236] border-[#D4C3A3]'
          : 'border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA]'
      }`}
    >
      <Bookmark size={14} className={isSaved ? 'fill-[#806236] text-[#806236]' : 'text-[#4A5568]'} />
      <span>{isSaved ? 'Saved' : label}</span>
    </button>
  );
}

export function JobCard({
  job,
  liveData = false,
  user = liveData ? null : defaultUser,
  onSave = undefined,
  onApply = undefined,
  onNotInterested = undefined,
  onReport = undefined,
  variant = 'card',
  applicationAction = /** @type {import('react').ReactNode} */ (null),
}) {
  const isSaved = user?.savedIds && user.savedIds.includes(job.id);
  const isApplied = user?.appliedIds && user.appliedIds.includes(job.id);

  return (
    <article
      className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-5 transition-shadow hover:shadow-sm ${
        variant === 'table' ? 'flex flex-col gap-3' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] font-bold text-base text-[#806236]">
            {job.logo || job.company?.name?.[0] || 'J'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Link
                href={`/jobseeker/jobs/${job.id}`}
                className="text-sm font-semibold text-[#0F1B2D] hover:text-[#B8955A] hover:underline"
              >
                {job.title}
              </Link>
              {job.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-0.5 text-xs text-[#286749]">
                  <CheckCircle2 size={11} /> Verified
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  job.stage ? 'bg-[#F3F4F6] text-[#4A5568]' : 'bg-[#F3EBDD] text-[#806236]'
                }`}
              >
                {job.stage || (liveData ? job.company?.type : 'Startup')}
              </span>
            </div>
            <p className="text-xs text-[#4A5568]">
              <Link
                href={`/jobseeker/companies/${job.company?.id || (liveData ? '' : 'acme-labs')}`}
                className="font-medium text-[#0F1B2D] hover:underline"
              >
                {job.company?.name || job.company}
              </Link>{' '}
              · {job.loc} · {job.type}
            </p>
            <p className="mt-1 text-xs text-[#4A5568]">
              <span className="font-medium text-[#0F1B2D]">{job.salary}</span> · Posted {job.posted}
            </p>
            {!liveData && user?.signedIn && job.fit && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs text-[#806236]">
                <Sparkles size={12} className="shrink-0" />
                <span className="font-semibold">Why this fit:</span>
                <span className="truncate">{job.fit}</span>
              </div>
            )}
          </div>
        </div>
        {!liveData && <button
          type="button"
          onClick={() => onNotInterested?.(job.id)}
          aria-label="More job options"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#A0A7B4] hover:bg-[#F4F1EA] hover:text-[#0F1B2D]"
        >
          <MoreHorizontal size={16} />
        </button>}
      </div>

      <div className="mt-4 pt-3 border-t border-[#F0EBE0] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/jobseeker/jobs/${job.id}`}
            className="text-xs text-[#6B7280] hover:text-[#0F1B2D] font-medium flex items-center gap-0.5"
          >
            Details <ChevronRight size={13} />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {liveData ? applicationAction : isApplied ? (
            <span className="inline-flex items-center rounded-full border border-[#0F1B2D] px-3 py-1 text-xs text-[#0F1B2D] font-medium">
              Applied
            </span>
          ) : (
            <>
              <SaveToggle saved={isSaved} onChange={() => onSave?.(job.id)} size="sm" />
              <Link href={`/jobseeker/jobs/${job.id}/apply`}>
                <JobBtn primary small>
                  Apply
                </JobBtn>
              </Link>
            </>
          )}
          {!liveData && <JobBtn onClick={() => onReport?.(job.id)} secondary small>
            Report
          </JobBtn>}
        </div>
      </div>
    </article>
  );
}

export function CompanyMiniCard({ company, onFollow, onView }) {
  return (
    <div className={`${RADIUS_CARD} border border-[#E5E1D8] bg-white p-4`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] font-bold text-[#806236]">
          {company.logo || company.name?.[0] || 'C'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold truncate text-[#0F1B2D]">{company.name}</h4>
            {company.verified && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#E7F3EC] px-1.5 py-0.5 text-xs text-[#286749]">
                <CheckCircle2 size={10} />
              </span>
            )}
          </div>
          <p className="text-xs text-[#4A5568] truncate">
            {company.industry} · {company.size}
          </p>
        </div>
      </div>
      <p className="text-xs text-[#6B7280] line-clamp-2 mb-3">{company.bio || company.location}</p>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F0EBE0]">
        <Link href={`/jobseeker/companies/${company.id}`} className="flex-1">
          <JobBtn secondary small className="w-full">
            Profile
          </JobBtn>
        </Link>
        <JobBtn
          type="button"
          onClick={() => onFollow?.(company.id)}
          primary={!company.isFollowing}
          secondary={company.isFollowing}
          small
        >
          {company.isFollowing ? 'Following' : 'Follow'}
        </JobBtn>
      </div>
    </div>
  );
}
