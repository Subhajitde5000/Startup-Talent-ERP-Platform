'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { EmployerShell, EmployerBtn, StageChip } from '@/components';
import { JobsPage, useJobsWorkspace, useJob } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';

const money = (row) =>
  row.salary_expectation == null
    ? 'Not provided'
    : `${row.currency} ${String(row.salary_expectation).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

function CompareContent({ jobId }) {
  const { org } = useJobsWorkspace();
  const { job, loading: jobLoading, error: jobError, reload: reloadJob } = useJob(jobId);
  const [selected, setSelected] = useState([]);
  const [pickerError, setPickerError] = useState('');

  const applicantsRes = useCareerResource(
    `compare-applicants:${org.id}:${jobId}`,
    (signal) => api.applicants.list(org.id, jobId, { limit: 100 }, signal)
  );

  // Preselect the first three applicants once (matches the demo's default
  // three-column table) so the page is useful without extra clicks.
  useEffect(() => {
    if (selected.length === 0 && applicantsRes.data) {
      setSelected(applicantsRes.data.items.slice(0, 3).map((a) => a.id));
    }
  }, [applicantsRes.data, selected.length]);

  const compareRes = useCareerResource(
    `compare:${org.id}:${jobId}:${[...selected].sort().join(',')}`,
    (signal) =>
      selected.length >= 2
        ? api.scorecards.compare(org.id, jobId, selected, signal)
        : Promise.resolve(null)
  );

  const toggle = (id) => {
    setPickerError('');
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) {
        setPickerError('Compare up to five applicants at a time.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const applicants = applicantsRes.data?.items || [];
  const compare = compareRes.data;

  return (
    <EmployerShell activeNav="Hiring">
      <div className="mx-auto max-w-[1280px] space-y-6 min-w-0 pb-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href={`/employer/jobs/${jobId}`}
            className="flex items-center gap-1 hover:text-[#0F1B2D]"
          >
            <ChevronLeft size={14} /> Back to {job?.title || 'job'} Pipeline
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">Compare Candidates</span>
        </nav>

        {/* Header */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xs flex flex-wrap items-center justify-between gap-4 min-w-0">
          <div>
            <span className="text-xs font-semibold text-[#806236] uppercase tracking-wider block mb-1">
              Candidate Comparison Matrix
            </span>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Comparing Applicants for {job?.title || 'this role'}
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Side-by-side evaluation of scorecard totals, stage, salary expectations, and skills.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/employer/jobs/${jobId}`}>
              <EmployerBtn secondary small>
                Back to Pipeline
              </EmployerBtn>
            </Link>
          </div>
        </header>

        {jobLoading || applicantsRes.loading ? (
          <LoadingBlock label="Loading applicants…" />
        ) : jobError || applicantsRes.error ? (
          <ErrorBlock
            message={
              (jobError instanceof ApiError ? jobError.message : null) ||
              (applicantsRes.error instanceof ApiError ? applicantsRes.error.message : null) ||
              'Could not load this comparison.'
            }
            onRetry={() => {
              if (jobError) reloadJob();
              if (applicantsRes.error) applicantsRes.reload();
            }}
          />
        ) : applicants.length < 2 ? (
          <EmptyBlock
            title="Not enough applicants to compare"
            hint="Comparison needs at least two applicants on this job's pipeline."
          />
        ) : (
          <>
            {/* Applicant picker */}
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[#0F1B2D]">
                  Select two to five applicants ({selected.length} selected)
                </p>
                {pickerError && <FieldError>{pickerError}</FieldError>}
              </div>
              <div className="flex flex-wrap gap-2">
                {applicants.map((a) => {
                  const checked = selected.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggle(a.id)}
                      aria-pressed={checked}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        checked
                          ? 'border-[#B8955A] bg-[#F3EBDD] text-[#806236]'
                          : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                      }`}
                    >
                      {checked && <CheckCircle2 size={12} />}
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comparison table */}
            {selected.length < 2 ? (
              <EmptyBlock
                title="Pick at least two applicants"
                hint="Use the selection above to build the side-by-side table."
              />
            ) : compareRes.loading ? (
              <LoadingBlock label="Loading comparison…" />
            ) : compareRes.error ? (
              <ErrorBlock
                message={
                  compareRes.error instanceof ApiError
                    ? compareRes.error.message
                    : 'Could not load the comparison.'
                }
                onRetry={compareRes.reload}
              />
            ) : compare ? (
              <div className="rounded-2xl border border-[#E5E1D8] bg-white overflow-hidden shadow-xs min-w-0">
                <div className="overflow-x-auto min-w-0">
                  <table className="w-full text-left text-xs min-w-[620px]">
                    <thead className="bg-[#FAF8F4] border-b border-[#E5E1D8]">
                      <tr>
                        <th className="p-4 pl-6 text-[#6B7280] uppercase tracking-wider font-semibold w-1/4">
                          Evaluation Criteria
                        </th>
                        {compare.items.map((cand) => (
                          <th key={cand.application_id} className="p-4 font-bold text-[#0F1B2D] w-1/4">
                            <div className="flex items-center gap-2.5 mb-1">
                              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F3EBDD] font-bold text-xs text-[#806236]">
                                {cand.label[0]}
                              </span>
                              <div>
                                <span className="text-sm block">{cand.label}</span>
                                <span className="font-normal text-[#6B7280] text-[11px] block">
                                  {cand.experience_years
                                    ? `${cand.experience_years} yrs experience`
                                    : 'Experience not provided'}
                                </span>
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EBE0] text-[#0F1B2D]">
                      <tr>
                        <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                          Scorecard Total
                        </td>
                        {compare.items.map((cand) => (
                          <td key={cand.application_id} className="p-4">
                            {cand.weighted_total == null ? (
                              <span className="text-[#6B7280]">Not scored yet</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2.5 py-0.5 text-xs font-bold text-[#286749]">
                                <CheckCircle2 size={12} /> {cand.weighted_total.toFixed(1)} / 5
                                <span className="font-normal text-[#4A5568]">
                                  {' '}
                                  · {cand.scored_count} scored
                                </span>
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                      {compare.criteria.map((criterion) => (
                        <tr key={criterion.criterion_id}>
                          <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                            {criterion.name}{' '}
                            <span className="font-normal text-[#A0A7B4]">({criterion.weight}%)</span>
                          </td>
                          {compare.items.map((cand) => {
                            const cell = cand.scores.find(
                              (s) => s.criterion_id === criterion.criterion_id
                            );
                            return (
                              <td key={cand.application_id} className="p-4">
                                {cell && cell.average != null ? (
                                  <span className="text-[#0F1B2D]">
                                    {cell.average.toFixed(1)} avg
                                    {cell.my_score != null && (
                                      <span className="text-[#6B7280]"> · you: {cell.my_score}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-[#6B7280]">Not scored</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                          Current Pipeline Stage
                        </td>
                        {compare.items.map((cand) => (
                          <td key={cand.application_id} className="p-4">
                            <StageChip
                              stage={
                                cand.stage.charAt(0).toUpperCase() + cand.stage.slice(1)
                              }
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                          Expected CTC
                        </td>
                        {compare.items.map((cand) => (
                          <td key={cand.application_id} className="p-4 font-medium">
                            {cand.salary_expectation == null ? 'Not provided' : money(cand)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">
                          Key Core Skills
                        </td>
                        {compare.items.map((cand) => (
                          <td key={cand.application_id} className="p-4">
                            {cand.skills && cand.skills.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {cand.skills.map((s) => (
                                  <span
                                    key={s}
                                    className="rounded-md bg-[#FAF8F4] border border-[#E5E1D8] px-2 py-0.5 text-[11px]"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#6B7280]">
                                {cand.is_blind ? 'Hidden during blind review' : 'Not provided'}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 pl-6 font-semibold text-[#6B7280] bg-[#FAF8F4]/30">Action</td>
                        {compare.items.map((cand) => (
                          <td key={cand.application_id} className="p-4">
                            <Link
                              href={`/employer/jobs/${jobId}/applicants/${cand.application_id}`}
                            >
                              <EmployerBtn primary small className="w-full">
                                Full Profile
                              </EmployerBtn>
                            </Link>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </EmployerShell>
  );
}

export default function CompareCandidatesPage() {
  const params = useParams();
  const jobId = params?.jobId;
  return (
    <JobsPage>
      <CompareContent jobId={jobId} />
    </JobsPage>
  );
}
