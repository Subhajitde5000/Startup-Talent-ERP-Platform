'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Sparkles, ArrowRight, Check } from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, errorLabel } from '@/components/career-data';

export default function JobTailoringPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = typeof params?.resumeId === 'string' ? params.resumeId : '';
  const initialJob = searchParams?.get('job') || '';

  const resumeRes = useCareerResource(
    resumeId ? `resume:${resumeId}` : null,
    (signal) => api.resumes.get(resumeId, signal),
  );
  const jobsRes = useCareerResource('tailor-jobs', (signal) =>
    api.careers.jobs({ limit: 20 }, true, signal),
  );

  const [selectedJobId, setSelectedJobId] = useState(initialJob);
  const [jobDescription, setJobDescription] = useState('');
  const [step, setStep] = useState(1);
  const [suggestions, setSuggestions] = useState([]);
  const [aiNotice, setAiNotice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const jobsList = useMemo(() => jobsRes.data?.items || [], [jobsRes.data]);
  useEffect(() => {
    if (!selectedJobId && jobsList.length > 0 && !jobDescription.trim()) {
      setSelectedJobId(jobsList[0].id);
    }
  }, [jobsList, selectedJobId, jobDescription]);

  const selectedJob = jobsList.find((j) => j.id === selectedJobId) || null;

  const handleGenerate = async () => {
    if (!resumeId) return;
    setGenerating(true);
    setError('');
    try {
      const run = await api.resumes.tailor(resumeId, {
        job_id: selectedJobId || null,
        job_description: jobDescription.trim() || null,
      });
      setSuggestions(
        (run.suggestions || []).map((s, idx) => ({
          id: `sug-${idx}`,
          section: s.section,
          original: s.original || '',
          tailored: s.tailored || '',
          rationale: s.rationale,
          accepted: idx === 0 && Boolean(s.tailored),
        })),
      );
      setAiNotice(run.ai_notice || '');
      setStep(2);
    } catch (err) {
      setError(errorLabel(err, 'Could not generate AI tailoring suggestions.'));
    } finally {
      setGenerating(false);
    }
  };

  const toggleAccept = (id) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, accepted: !s.accepted } : s)),
    );
  };

  const normalizeText = (text) =>
    String(text || '').replace(/[\u2010-\u2015]/g, '-');

  const cleanBulletLines = (text) =>
    normalizeText(text)
      .split('\n')
      .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
      .filter(Boolean);

  const handleFinishTailoring = async () => {
    if (!resumeId || !resume) return;
    setApplying(true);
    setError('');
    try {
      const accepted = suggestions.filter((s) => s.accepted && s.tailored);

      // 1. Apply accepted Summary & General suggestions to resume summary
      const acceptedSummary = accepted.find((s) => s.section === 'summary');
      const acceptedGenerals = accepted.filter((s) => s.section === 'general');
      if (acceptedSummary || acceptedGenerals.length > 0) {
        let nextSummary = acceptedSummary
          ? acceptedSummary.tailored.trim()
          : (resume.summary || '').trim();
        for (const gen of acceptedGenerals) {
          const addition = gen.tailored.trim();
          if (addition && !nextSummary.includes(addition)) {
            nextSummary = nextSummary ? `${nextSummary}\n\n${addition}` : addition;
          }
        }
        if (nextSummary) {
          await api.resumes.update(resumeId, { summary: nextSummary });
        }
      }

      // 2. Apply accepted Experience suggestions (works even if resume has 0 experiences yet)
      const acceptedExps = accepted.filter((s) => s.section === 'experience');
      if (acceptedExps.length > 0) {
        const updatedExps = (resume.experiences || []).map((exp) => ({
          role_title: exp.role_title || '',
          company: exp.company || '',
          period_label: exp.period_label || null,
          bullets: [...(exp.bullets || [])],
        }));

        if (updatedExps.length === 0) {
          updatedExps.push({
            role_title: resume.target_role || 'Relevant Experience',
            company: 'Experience Highlights',
            period_label: null,
            bullets: [],
          });
        }

        for (const sug of acceptedExps) {
          const origNorm = normalizeText(sug.original || '').trim().toLowerCase();
          const newBullets = cleanBulletLines(sug.tailored);
          if (newBullets.length === 0) continue;

          let matched = false;
          if (origNorm) {
            for (const exp of updatedExps) {
              const bIdx = exp.bullets.findIndex((b) => {
                const bNorm = normalizeText(b).trim().toLowerCase();
                return bNorm === origNorm || bNorm.includes(origNorm) || origNorm.includes(bNorm);
              });
              if (bIdx !== -1) {
                exp.bullets.splice(bIdx, 1, ...newBullets);
                exp.bullets = exp.bullets.slice(0, 15);
                matched = true;
                break;
              }
            }
          }

          if (!matched) {
            const roleExp =
              updatedExps.find(
                (exp) =>
                  origNorm &&
                  (origNorm.includes(exp.role_title.toLowerCase()) ||
                    origNorm.includes(exp.company.toLowerCase())),
              ) || updatedExps[0];
            for (const nb of newBullets) {
              if (roleExp.bullets.length < 15 && !roleExp.bullets.includes(nb)) {
                roleExp.bullets.push(nb);
              }
            }
          }
        }

        await api.resumes.replaceExperiences(resumeId, { items: updatedExps });
      }

      // 3. Apply accepted Skills suggestions (normalize hyphens/parentheticals + preserve order)
      const acceptedSkills = accepted.filter((s) => s.section === 'skills');
      if (acceptedSkills.length > 0) {
        const existingSkills = resume.skills || [];
        const existingIds = existingSkills.map((s) => s.id);
        const existingByName = new Map(
          existingSkills.map((s) => [normalizeText(s.name).toLowerCase(), s.id]),
        );

        const candidateNames = acceptedSkills
          .flatMap((s) =>
            normalizeText(s.tailored)
              .split(/[,;\n•|]+/)
              .map((n) =>
                n
                  .replace(/^[\s\-*]+/, '')
                  .replace(/\s*\([^)]*\)\s*/g, ' ')
                  .trim(),
              )
              .filter((n) => n.length > 0 && n.length <= 60),
          )
          .slice(0, 25);

        const orderedIds = [];
        const seen = new Set();
        for (const name of candidateNames) {
          const localId = existingByName.get(name.toLowerCase());
          if (localId) {
            if (!seen.has(localId)) {
              seen.add(localId);
              orderedIds.push(localId);
            }
            continue;
          }
          try {
            const matches = await api.skills.search({ q: name, limit: 5 });
            const exact = (matches || []).find(
              (m) => normalizeText(m.name).toLowerCase() === name.toLowerCase(),
            );
            const pick = exact || (matches && matches.length === 1 ? matches[0] : null);
            if (pick && !seen.has(pick.id)) {
              seen.add(pick.id);
              orderedIds.push(pick.id);
            }
          } catch {
            // ignore individual skill lookup errors
          }
        }

        for (const id of existingIds) {
          if (!seen.has(id)) {
            seen.add(id);
            orderedIds.push(id);
          }
        }

        const changed =
          orderedIds.length !== existingIds.length ||
          orderedIds.some((id, idx) => id !== existingIds[idx]);
        if (changed && orderedIds.length > 0) {
          await api.resumes.replaceSkills(resumeId, { skill_ids: orderedIds });
        }
      }

      router.push(`/jobseeker/resumes/${resumeId}`);
      router.refresh();
    } catch (err) {
      setError(errorLabel(err, 'Could not apply tailoring changes.'));
      setApplying(false);
    }
  };

  const resume = resumeRes.data;

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
          <span className="text-[#0F1B2D] font-medium">Tailor Resume</span>
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
                  <span className="text-xs font-semibold text-[#806236] uppercase tracking-wider block mb-1">
                    AI Resume Tailoring
                  </span>
                  <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                    Tailoring: {resume.title}
                  </h1>
                  <p className="text-xs md:text-sm text-[#6B7280] mt-1">
                    {selectedJob
                      ? `Optimizing impact statements for ${selectedJob.title} at ${selectedJob.org_name || 'Company'}.`
                      : 'Select a job posting or paste a job description to tailor your resume.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6B7280]">Step {step} of 2</span>
                </div>
              </header>

              {error && (
                <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] px-4 py-3 text-xs text-[#B42318]">
                  {error}
                </div>
              )}

              {step === 1 && (
                <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    1. Select Job Posting or Paste Description
                  </h2>

                  {jobsList.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {jobsList.map((job) => {
                        const isSelected = selectedJobId === job.id;
                        return (
                          <div
                            key={job.id}
                            onClick={() =>
                              setSelectedJobId(isSelected ? '' : job.id)
                            }
                            className={`cursor-pointer rounded-xl border p-4 transition-all ${
                              isSelected
                                ? 'border-[#B8955A] bg-[#FFF8E8] shadow-sm'
                                : 'border-[#E5E1D8] bg-[#FAF8F4]/40 hover:bg-[#FAF8F4]'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-sm font-semibold text-[#0F1B2D]">
                                  {job.title}
                                </h3>
                                <p className="text-xs text-[#6B7280]">
                                  {job.org_name || 'Company'} · {job.location || job.work_mode}
                                </p>
                              </div>
                              {isSelected && (
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0F1B2D] text-white">
                                  <Check size={12} />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="tailorJd"
                      className="block text-xs font-semibold text-[#4A5568] mb-1"
                    >
                      Job Description (optional if a job is selected above)
                    </label>
                    <textarea
                      id="tailorJd"
                      rows={4}
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste target job description here..."
                      className="w-full p-3 rounded-xl border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                  </div>

                  <div className="pt-3 flex justify-end">
                    <JobBtn
                      primary
                      small
                      disabled={generating || (!selectedJobId && !jobDescription.trim())}
                      onClick={handleGenerate}
                      className="flex items-center gap-1.5"
                    >
                      {generating ? 'Generating via AI...' : 'Generate Suggestions'}{' '}
                      <ArrowRight size={14} />
                    </JobBtn>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                        2. Review Tailored Suggestions
                      </h2>
                      <p className="text-xs text-[#6B7280]">
                        Accept suggestions to update your resume draft with targeted wording.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-[#9A7A45] hover:underline"
                    >
                      Change Target Job
                    </button>
                  </div>

                  {aiNotice && (
                    <div className="rounded-xl border border-[#D4C3A3] bg-[#FFF8E8] px-4 py-2.5 text-xs text-[#806236]">
                      {aiNotice}
                    </div>
                  )}

                  {suggestions.length === 0 ? (
                    <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 text-xs text-[#6B7280]">
                      No suggestions were returned for this job target.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {suggestions.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#806236]">
                              Section: {item.section}
                            </span>
                            {item.tailored && (
                              <button
                                type="button"
                                onClick={() => toggleAccept(item.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                                  item.accepted
                                    ? 'bg-[#E7F3EC] text-[#286749] border-[#CDE5D7]'
                                    : 'bg-[#FAF8F4] text-[#6B7280] border-[#E5E1D8]'
                                }`}
                              >
                                {item.accepted ? (
                                  <>
                                    <Check size={13} /> Accepted
                                  </>
                                ) : (
                                  'Accept Suggestion'
                                )}
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-[#6B7280]">{item.rationale}</p>

                          {(item.original || item.tailored) && (
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="p-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4]/50">
                                <span className="text-[#A0A7B4] block text-[11px] font-semibold mb-1">
                                  Current Wording
                                </span>
                                <p className="text-[#4A5568]">
                                  {item.original || '—'}
                                </p>
                              </div>

                              <div className="p-3 rounded-lg border border-[#CDE5D7] bg-[#E7F3EC]/20">
                                <span className="text-[#286749] text-[11px] font-semibold mb-1 flex items-center gap-1">
                                  <Sparkles size={11} /> AI Tailored Wording
                                </span>
                                <p className="text-[#0F1B2D] font-medium leading-relaxed">
                                  {item.tailored || '—'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 flex justify-end">
                    <JobBtn
                      primary
                      onClick={handleFinishTailoring}
                      disabled={applying}
                      className="px-6 min-h-[42px]"
                    >
                      {applying ? 'Applying Changes...' : 'Save & Update Resume'}
                    </JobBtn>
                  </div>
                </section>
              )}
            </>
          )}
        </ResourceState>
      </div>
    </JobSeekerShell>
  );
}
