'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Upload, UserCheck, Sparkles } from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { errorLabel } from '@/components/career-data';
import { FieldError, fieldErrorsFrom } from '@/components/async-state';

export default function ResumeBuilderPage() {
  const router = useRouter();
  const [method, setMethod] = useState(null); // 'profile' | 'import' | 'scratch'
  const [title, setTitle] = useState('My Tailored Resume');
  const [targetRole, setTargetRole] = useState('Senior Product Designer');
  const [template, setTemplate] = useState('Modern Clean');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleCreate = async () => {
    setIsGenerating(true);
    setError('');
    setFieldErrors({});
    try {
      const created = await api.resumes.create({
        title: title.trim() || targetRole.trim() || 'Untitled Resume',
        target_role: targetRole.trim() || null,
        template,
      });
      router.push(`/jobseeker/resumes/${created.id}`);
    } catch (err) {
      setFieldErrors(fieldErrorsFrom(err));
      setError(errorLabel(err, 'Could not create resume.'));
      setIsGenerating(false);
    }
  };

  return (
    <JobSeekerShell active="Resumes">
      <div className="space-y-6 max-w-4xl pb-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link href="/jobseeker/resumes" className="flex items-center gap-1 hover:text-[#0F1B2D]">
            <ChevronLeft size={14} /> Back to Resumes
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">New Resume</span>
        </nav>

        {/* Header */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
          <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
            Create a New Resume
          </h1>
          <p className="text-xs md:text-sm text-[#6B7280] mt-1">
            Build a targeted, ATS-optimized resume tailored to startup design and engineering roles.
          </p>
        </header>

        {/* Step 1: Choose Generation Method */}
        {!method ? (
          <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
              How would you like to build this resume?
            </h2>

            <div className="grid gap-3 sm:grid-cols-3">
              <div
                onClick={() => setMethod('profile')}
                className="cursor-pointer rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 p-5 hover:bg-[#FAF8F4] hover:border-[#B8955A] transition-all space-y-3"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F3EC] text-[#286749]">
                  <UserCheck size={20} />
                </span>
                <h3 className="text-sm font-semibold text-[#0F1B2D]">Start with Details</h3>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Create a structured resume workspace and fill in your summary, experience, education, and skills.
                </p>
              </div>

              <div
                onClick={() => setMethod('import')}
                className="cursor-pointer rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 p-5 hover:bg-[#FAF8F4] hover:border-[#B8955A] transition-all space-y-3 opacity-75"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F3EBDD] text-[#806236]">
                  <Upload size={20} />
                </span>
                <h3 className="text-sm font-semibold text-[#0F1B2D]">Import Existing</h3>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  File import requires document upload integration (coming soon).
                </p>
              </div>

              <div
                onClick={() => setMethod('scratch')}
                className="cursor-pointer rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 p-5 hover:bg-[#FAF8F4] hover:border-[#B8955A] transition-all space-y-3"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF8E8] text-[#9A7A45]">
                  <Sparkles size={20} />
                </span>
                <h3 className="text-sm font-semibold text-[#0F1B2D]">ATS & Tailor Ready</h3>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Start from scratch, then run ATS compatibility scoring and AI tailoring against live job postings.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                  Configure Resume Details
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setMethod(null);
                    setError('');
                    setFieldErrors({});
                  }}
                  className="text-xs text-[#9A7A45] hover:underline"
                >
                  Change creation method
                </button>
              </div>

              {error && (
                <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] px-4 py-3 text-xs text-[#B42318]">
                  {error}
                </div>
              )}

              {method === 'import' ? (
                <div className="rounded-xl border border-dashed border-[#E5E1D8] p-6 text-center space-y-2 bg-[#FAF8F4]/50">
                  <Upload size={24} className="mx-auto text-[#A0A7B4]" />
                  <span className="text-xs font-semibold text-[#0F1B2D] block">
                    Resume file import is not available yet
                  </span>
                  <span className="text-[11px] text-[#6B7280] block">
                    Please choose &ldquo;Start with Details&rdquo; or &ldquo;ATS &amp; Tailor Ready&rdquo; to create your resume in the editor.
                  </span>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="resumeTitle" className="block text-xs font-semibold text-[#4A5568] mb-1">
                        Resume Title
                      </label>
                      <input
                        id="resumeTitle"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="E.g. Senior Product Designer (Primary)"
                        className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />
                      <FieldError message={fieldErrors.title} />
                    </div>

                    <div>
                      <label htmlFor="targetRole" className="block text-xs font-semibold text-[#4A5568] mb-1">
                        Target Role Title
                      </label>
                      <input
                        id="targetRole"
                        type="text"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        placeholder="E.g. Senior Frontend Engineer, Product Designer..."
                        className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />
                      <FieldError message={fieldErrors.target_role} />
                      <span className="text-[11px] text-[#6B7280] mt-1 block">
                        Targeting a specific role helps compute accurate ATS keyword relevance.
                      </span>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-[#4A5568] mb-2">
                        Select Layout Template
                      </span>
                      <div className="grid grid-cols-3 gap-3">
                        {['Modern Clean', 'Minimalist Tech', 'Executive Classic'].map((t) => {
                          const isSelected = template === t;
                          return (
                            <div
                              key={t}
                              onClick={() => setTemplate(t)}
                              className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${
                                isSelected
                                  ? 'border-[#0F1B2D] bg-[#FAF8F4] font-semibold text-[#0F1B2D]'
                                  : 'border-[#E5E1D8] bg-white text-[#6B7280] hover:bg-[#FAF8F4]'
                              }`}
                            >
                              <span className="text-xs">{t}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <JobBtn
                      primary
                      onClick={handleCreate}
                      disabled={isGenerating}
                      className="px-6 min-h-[42px]"
                    >
                      {isGenerating ? 'Creating Resume...' : 'Create Resume & Open Editor'}
                    </JobBtn>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </JobSeekerShell>
  );
}
