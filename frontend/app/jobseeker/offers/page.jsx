'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Shield,
  Columns,
  ArrowRight,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatMoney, formatDate } from '@/lib/mentorship-labels';

const ACTIVE = ['sent', 'countered'];
const PAST = ['declined', 'expired', 'withdrawn'];

export default function OffersPage() {
  const [tab, setTab] = useState('Active');

  const offersRes = useCareerResource('my-job-offers', (signal) =>
    api.jobOffers.mine({ limit: 100 }, signal)
  );

  const offers = useMemo(() => offersRes.data?.items || [], [offersRes.data]);
  const activeOffers = useMemo(() => offers.filter((o) => ACTIVE.includes(o.status)), [offers]);
  const acceptedOffers = useMemo(() => offers.filter((o) => o.status === 'accepted'), [offers]);
  const pastOffers = useMemo(() => offers.filter((o) => PAST.includes(o.status)), [offers]);

  const currentList =
    tab === 'Active' ? activeOffers : tab === 'Accepted' ? acceptedOffers : pastOffers;

  if (offersRes.loading) {
    return (
      <JobSeekerShell active="Offers">
        <div className="space-y-6 max-w-5xl">
          <LoadingBlock label="Loading offers…" />
        </div>
      </JobSeekerShell>
    );
  }

  if (offersRes.error) {
    return (
      <JobSeekerShell active="Offers">
        <div className="space-y-6 max-w-5xl">
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
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Job Offers & Compensation
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Review full compensation breakdowns, equity terms, and compare offers side-by-side.
            </p>
          </div>

          {activeOffers.length >= 2 && (
            <Link href="/jobseeker/offers/compare">
              <JobBtn secondary small className="flex items-center gap-1.5">
                <Columns size={14} /> Compare Offers
              </JobBtn>
            </Link>
          )}
        </div>

        {/* Disclaimer strip */}
        <div className="rounded-xl border border-[#D4C3A3] bg-[#F3EBDD]/40 p-4 text-xs text-[#806236] flex items-start gap-2.5">
          <Shield size={16} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Platform offer summaries are indicative representations of terms agreed with founders.
            Formal employment agreements signed via document exchange remain legally authoritative.
          </p>
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-2 border-b border-[#E5E1D8] pb-2 text-xs overflow-x-auto">
          {['Active', 'Accepted', 'Declined & Expired'].map((t) => {
            const count =
              t === 'Active'
                ? activeOffers.length
                : t === 'Accepted'
                  ? acceptedOffers.length
                  : pastOffers.length;
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
                  active ? 'bg-[#0F1B2D] text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'
                }`}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>

        {/* Offers List */}
        {currentList.length === 0 ? (
          <EmptyBlock
            title={`No ${tab.toLowerCase()} offers`}
            hint="Continue your interview pipelines — offers appear here as soon as a founder sends one."
          >
            <Link href="/jobseeker/applications" className="inline-block">
              <JobBtn primary small>
                View Applications
              </JobBtn>
            </Link>
          </EmptyBlock>
        ) : (
          <div className="space-y-4">
            {currentList.map((offer) => (
              <div
                key={offer.id}
                className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] font-bold text-base text-[#806236]">
                      {offer.company_name?.[0] || 'O'}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Link
                          href={`/jobseeker/offers/${offer.id}`}
                          className="text-base font-serif font-bold text-[#0F1B2D] hover:underline"
                        >
                          {offer.job_title}
                        </Link>
                        <span className="rounded-full bg-[#E7F3EC] px-2 py-0.5 text-xs font-semibold text-[#286749]">
                          {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280]">{offer.company_name}</p>
                    </div>
                  </div>

                  <Link href={`/jobseeker/offers/${offer.id}`}>
                    <JobBtn primary small className="flex items-center gap-1.5">
                      Review Offer <ArrowRight size={13} />
                    </JobBtn>
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#F0EBE0] text-xs">
                  <div>
                    <span className="text-[#6B7280] block mb-0.5">Base CTC</span>
                    <strong className="text-[#0F1B2D] text-sm">
                      {formatMoney(offer.base_salary, offer.currency) || '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#6B7280] block mb-0.5">Equity / ESOPs</span>
                    <strong className="text-[#0F1B2D] text-sm">
                      {offer.equity_pct != null ? `${offer.equity_pct}%` : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#6B7280] block mb-0.5">Start Date</span>
                    <span className="text-[#0F1B2D]">{formatDate(offer.start_date) || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#6B7280] block mb-0.5">Offer Deadline</span>
                    <span className="text-[#9A7A45] font-semibold">
                      {offer.expires_on ? formatDate(offer.expires_on) : 'No expiry'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </JobSeekerShell>
  );
}
