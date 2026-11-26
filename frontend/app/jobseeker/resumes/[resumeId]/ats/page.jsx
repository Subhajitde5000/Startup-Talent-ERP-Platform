'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Sparkles, Play } from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, errorLabel } from '@/components/career-data';

export default function AtsCheckPage() {
  const params = useParams();
  const resumeId = typeof params?.resumeId === 'string' ? params.resumeId : '';

  const resumeRes = useCareerResource(
    resumeId ? `resume:${resumeId}` : null,
    (signal) => api.resumes.get(resumeId, signal),
  );
  const runsRes = useCareerResource(
    resumeId ? `resume-ats:${resumeId}` : null,
    (signal) => api.resumes.listAtsRuns(resumeId, { limit: 20 }, signal),
  );
  const jobsRes = useCareerResource('ats-jobs', (signal) =>
    api.careers.jobs({ limit: 20 }, true, signal),
  );

  const [selectedJobId, setSelectedJobId] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');

  const jobsList = useMemo(() => jobsRes.data?.items || [], [jobsRes.data]);
  useEffect(() => {
    if (!selectedJobId && jobsList.length > 0) {
      setSelectedJobId(jobsList[0].id);
    }
  }, [jobsList, selectedJobId]);

  const atsRuns = (runsRes.data?.items || []).filter((r) => r.run_type === 'ats');
  const latestRun = atsRuns[0] || null;

  const handleRunCheck = async () => {
    if (!resumeId) return;
    setRunning(true);
    setRunError('');
    try {
      await api.resumes.createAtsRun(resumeId, {
        job_id: selectedJobId || null,
        job_description: jobDescription.trim() || null,
      });
      runsRes.reload();
      resumeRes.reload();
    } catch (err) {
      setRunError(errorLabel(err, 'Could not run ATS check.'));
    } finally {
      setRunning(false);
    }
  };

  const resume = resumeRes.data;
  const atsScore = latestRun?.score ?? resume?.ats_score ?? null;

  return (
    <JobSeekerShell active="Resumes">
      <div className="space-y-6 max-w-5xl pb-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href={`/jobseeker/resumes/${resumeId}`}
            className="flex items-center gap-1 hover:text-[#0F1B2D]"
          >
            <ChevronLeft size={14} /> Back to Editor
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">ATS Check</span>
        </nav>

        <ResourceState
          resource={resumeRes}
          empty={!resumeRes.loading && !resumeRes.error && !resume}
          emptyTitle="Resume not found"
          emptyBody="This resume could not be loaded."
          onRetry={resumeRes.reload}
        >
          {resume && (
            <>
              {/* Header */}
              <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                    ATS Compatibility Report
                  </h1>
                  <p className="text-xs md:text-sm text-[#6B7280] mt-1">
                    Analysis for <strong className="text-[#0F1B2D]">{resume.title}</strong> against startup hiring filters.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <JobBtn
                    primary
                    small
                    onClick={handleRunCheck}
                    disabled={running}
                    className="flex items-center gap-1.5"
                  >
                    <Play size={13} /> {running ? 'Scanning...' : 'Run ATS Check'}
                  </JobBtn>
                  <Link
                    href={`/jobseeker/resumes/${resume.id}/tailor${
                      selectedJobId ? `?job=${selectedJobId}` : ''
                    }`}
                  >
                    <JobBtn secondary small className="flex items-center gap-1.5">
                      <Sparkles size={13} /> AI Tailor
                    </JobBtn>
                  </Link>
                </div>
              </header>

              {/* Target Job Selector */}
              <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#6B7280]">Scan against job:</span>
                    <select
                      aria-label="Select job to check against"
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="h-8 rounded-lg border border-[#E5E1D8] bg-white px-2.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="">General check (no specific job)</option>
                      {jobsList.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title} · {j.org_name || 'Company'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Optional: paste additional job description text to check keywords against..."
                  className="w-full p-2.5 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>

              {runError && (
                <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] px-4 py-3 text-xs text-[#B42318]">
                  {runError}
                </div>
              )}

              {/* Score and Findings */}
              {!latestRun ? (
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-8 text-center space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    No ATS scans run yet
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Select a target job above and click &ldquo;Run ATS Check&rdquo; to compute your keyword match score.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-12">
                  {/* Big Score Card */}
                  <div className="lg:col-span-4 rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm text-center space-y-4">
                    <span className="text-xs uppercase font-bold tracking-wider text-[#6B7280] block">
                      Overall ATS Score
                    </span>
                    <div className="grid h-28 w-28 mx-auto place-items-center rounded-full border-8 border-[#286749] text-2xl font-serif font-bold text-[#0F1B2D]">
                      {atsScore != null ? `${atsScore}%` : '—'}
                    </div>
                    <p className="text-xs text-[#286749] font-semibold">
                      {atsScore >= 80
                        ? 'Strong ATS alignment'
                        : atsScore >= 60
                          ? 'Moderate alignment — review missing keywords'
                          : 'Needs improvement — add missing skills and sections'}
                    </p>
                    <div className="pt-2 text-xs text-[#6B7280] space-y-1.5 border-t border-[#F0EBE0] text-left">
                      <div className="flex justify-between">
                        <span>Matched Keywords:</span>
                        <strong className="text-[#0F1B2D]">
                          {latestRun.matched_keywords.length}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Missing Keywords:</span>
                        <strong className="text-[#B7791F]">
                          {latestRun.missing_keywords.length}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Scanned:</span>
                        <strong className="text-[#0F1B2D]">
                          {new Date(latestRun.created_at).toLocaleDateString()}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown & Recommendations */}
                  <div className="lg:col-span-8 space-y-4">
                    <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                      <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                        Keyword Match Analysis
                      </h2>
                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="font-semibold text-[#286749] block mb-1">
                            ✓ Matched Keywords Found in Resume
                          </span>
                          {latestRun.matched_keywords.length === 0 ? (
                            <p className="text-[#6B7280]">No keyword matches found.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {latestRun.matched_keywords.map((kw) => (
                                <span
                                  key={kw}
                                  className="rounded-full bg-[#E7F3EC] border border-[#CDE5D7] px-2.5 py-0.5 text-xs text-[#286749]"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-2">
                          <span className="font-semibold text-[#B7791F] block mb-1">
                            ⚠ Missing Keywords Found in Job Description
                          </span>
                          {latestRun.missing_keywords.length === 0 ? (
                            <p className="text-[#6B7280]">No missing keywords detected.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {latestRun.missing_keywords.map((kw) => (
                                <span
                                  key={kw}
                                  className="rounded-full bg-[#FFF8E8] border border-[#D4C3A3] px-2.5 py-0.5 text-xs text-[#806236]"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-3">
                      <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                        Recommended Adjustments
                      </h2>
                      {latestRun.suggestions.length === 0 ? (
                        <p className="text-xs text-[#6B7280]">No additional adjustments recommended.</p>
                      ) : (
                        <div className="space-y-2 text-xs text-[#4A5568]">
                          {latestRun.suggestions.map((sug, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] flex items-start gap-2"
                            >
                              <Sparkles size={15} className="text-[#806236] shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-[#0F1B2D] uppercase text-[10px] mr-1.5">
                                  [{sug.section}]
                                </span>
                                <span>{sug.rationale}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
            </>
          )}
        </ResourceState>
      </div>
    </JobSeekerShell>
  );
}
