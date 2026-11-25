'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, Columns } from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatMoney } from '@/lib/mentorship-labels';

const ACTIVE = ['sent', 'countered'];
const WORK_MODE_LABEL = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };

const matchBenefit = (benefits, pattern) => {
  const hit = benefits.find((b) => pattern.test(b.label));
  return hit ? hit.label : 'Not specified';
};

export default function CompareOffersPage() {
  const offersRes = useCareerResource('my-job-offers-compare', (signal) =>
    api.jobOffers.mine({ limit: 100 }, signal)
  );

  const compareList = useMemo(
    () => (offersRes.data?.items || []).filter((o) => ACTIVE.includes(o.status)),
    [offersRes.data]
  );
  const jobIds = useMemo(
    () => [...new Set(compareList.map((o) => o.job_id))],
    [compareList]
  );

  const jobsRes = useCareerResource(
    `compare-jobs:${jobIds.join(',') || 'none'}`,
    (signal) =>
      jobIds.length === 0
        ? Promise.resolve({})
        : Promise.all(
            jobIds.map((id) => api.careers.job(String(id), true, signal))
          ).then((jobs) => Object.fromEntries(jobs.map((j) => [j.id, j])))
  );
  const jobsById = jobsRes.data || {};

  if (offersRes.loading) {
    return (
      <JobSeekerShell active="Offers">
        <div className="space-y-6 max-w-6xl">
          <LoadingBlock label="Loading offers…" />
        </div>
      </JobSeekerShell>
    );
  }

  if (offersRes.error) {
    return (
      <JobSeekerShell active="Offers">
        <div className="space-y-6 max-w-6xl">
          <ErrorBlock
            message={
              offersRes.error instanceof ApiError
                ? offersRes.error.message
                : 'Could not load your offers.'
            }
            onRetry={offersRes.reload}
          />
        </div>
      </JobSeekerShell>
    );
  }

  return (
    <JobSeekerShell active="Offers">
      <div className="space-y-6 max-w-6xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link href="/jobseeker/offers" className="flex items-center gap-1 hover:text-[#0F1B2D]">
            <ChevronLeft size={14} /> Back to Offers
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">Compare Offers</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Offer Comparison Matrix
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Compare base salaries, bonus pools, equity grants, and working conditions side-by-side.
            </p>
          </div>
        </div>

        {compareList.length < 2 ? (
          <EmptyBlock
            title="Not enough live offers to compare"
            hint="You need at least two active (sent) offers. They will appear here automatically."
          >
            <Link href="/jobseeker/offers">
              <JobBtn primary small>
                Back to Offers
              </JobBtn>
            </Link>
          </EmptyBlock>
        ) : jobsRes.loading ? (
          <LoadingBlock label="Loading job details…" />
        ) : jobsRes.error ? (
          <ErrorBlock
            message="Could not load the job details for these offers."
            onRetry={jobsRes.reload}
            title="Could not load job details"
          />
        ) : (
          <div className="rounded-2xl border border-[#E5E1D8] bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-[#FAF8F4] border-b border-[#E5E1D8]">
                  <tr>
                    <th className="p-4 pl-6 text-[#6B7280] uppercase tracking-wider font-semibold w-1/4">
                      Comparison Criteria
                    </th>
                    {compareList.map((offer) => (
                      <th key={offer.id} className="p-4 font-bold text-[#0F1B2D] w-1/4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="grid h-7 w-7 place-items-center rounded bg-[#F3EBDD] font-bold text-xs text-[#806236]">
                            {offer.company_name?.[0] || 'O'}
                          </span>
                          <span className="text-sm">{offer.company_name}</span>
                        </div>
                        <span className="font-normal text-[#6B7280] block truncate">
                          {offer.job_title}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBE0] text-[#0F1B2D]">
                  <tr>
                    <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                      Annual Base CTC
                    </td>
                    {compareList.map((offer) => (
                      <td key={offer.id} className="p-4 font-bold text-sm text-[#0F1B2D]">
                        {formatMoney(offer.base_salary, offer.currency) || '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                      Variable Bonus
                    </td>
                    {compareList.map((offer) => (
                      <td key={offer.id} className="p-4">
                        {formatMoney(offer.bonus_amount, offer.currency) || '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                      Equity (ESOP)
                    </td>
                    {compareList.map((offer) => (
                      <td key={offer.id} className="p-4 font-medium text-[#806236]">
                        {offer.equity_pct != null ? `${offer.equity_pct}%` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                      Work Model
                    </td>
                    {compareList.map((offer) => {
                      const job = jobsById[offer.job_id];
                      return (
                        <td key={offer.id} className="p-4">
                          {job ? WORK_MODE_LABEL[job.work_mode] || job.work_mode : '—'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                      Annual PTO
                    </td>
                    {compareList.map((offer) => {
                      const job = jobsById[offer.job_id];
                      return (
                        <td key={offer.id} className="p-4">
                          {job ? matchBenefit(job.benefits || [], /pto|leave|holiday|vacation/i) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                      Health Insurance
                    </td>
                    {compareList.map((offer) => {
                      const job = jobsById[offer.job_id];
                      return (
                        <td key={offer.id} className="p-4">
                          {job ? matchBenefit(job.benefits || [], /insurance|medical|health/i) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">Actions</td>
                    {compareList.map((offer) => (
                      <td key={offer.id} className="p-4">
                        <Link href={`/jobseeker/offers/${offer.id}`} className="block">
                          <JobBtn primary small className="w-full">
                            View Details
                          </JobBtn>
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </JobSeekerShell>
  );
}
