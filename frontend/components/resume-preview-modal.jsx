'use client';

import React, { useEffect } from 'react';
import { X, FileText, FileType, Printer } from 'lucide-react';
import { JobBtn } from '@/components/jobseeker-ui';

export function ResumePreviewModal({
  open,
  onClose,
  resumeData,
  contact,
  onExportPdf,
  onExportDocx,
  exporting,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const {
    title,
    target_role: targetRole,
    summary,
    experiences = [],
    education = [],
    skills = [],
  } = resumeData || {};

  const skillNames = skills
    .map((s) => (typeof s === 'string' ? s : s?.name || ''))
    .filter(Boolean);

  const contactItems = [
    contact?.email,
    contact?.phone,
    contact?.location,
    contact?.linkedin_url,
    contact?.github_url,
  ].filter(Boolean);

  const hasContent =
    Boolean(summary) ||
    experiences.length > 0 ||
    education.length > 0 ||
    skillNames.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/60 backdrop-blur-sm p-4 print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] shadow-2xl overflow-hidden print:max-h-none print:border-0 print:shadow-none print:bg-white">
        {/* Modal Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E1D8] bg-white px-5 py-3.5 print:hidden">
          <div>
            <h2 id="resume-preview-title" className="text-sm font-serif font-bold text-[#0F1B2D]">
              Resume Preview
            </h2>
            <p className="text-[11px] text-[#6B7280]">
              Live preview of your current editor state (save changes before exporting if edited).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JobBtn
              secondary
              small
              onClick={() => window.print()}
              className="flex items-center gap-1.5"
            >
              <Printer size={13} /> Print
            </JobBtn>
            <JobBtn
              secondary
              small
              onClick={onExportDocx}
              disabled={exporting}
              className="flex items-center gap-1.5"
            >
              <FileType size={13} /> Export Word
            </JobBtn>
            <JobBtn
              primary
              small
              onClick={onExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5"
            >
              <FileText size={13} /> Export PDF
            </JobBtn>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 text-[#6B7280] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:overflow-visible print:p-0">
          <div className="mx-auto max-w-[760px] rounded-xl border border-[#E5E1D8] bg-white p-8 sm:p-12 shadow-sm text-[#1F2937] print:border-0 print:shadow-none print:p-0">
            {/* Header */}
            <header className="border-b-2 border-[#B8955A] pb-4 mb-6">
              <h1 className="text-2xl font-serif font-bold text-[#0F1B2D]">
                {contact?.display_name || title || 'Untitled Resume'}
              </h1>
              {targetRole && (
                <p className="text-sm font-medium text-[#806236] mt-0.5">{targetRole}</p>
              )}
              {contactItems.length > 0 && (
                <p className="text-xs text-[#6B7280] mt-2 flex flex-wrap gap-x-2 gap-y-1">
                  {contactItems.map((item, idx) => (
                    <span key={idx}>
                      {idx > 0 && <span className="mr-2 text-[#D4C3A3]">•</span>}
                      {item}
                    </span>
                  ))}
                </p>
              )}
            </header>

            {!hasContent ? (
              <div className="py-12 text-center text-xs text-[#6B7280]">
                Your resume has no content yet. Fill in Summary, Experience, Education, or Skills—or use &ldquo;Generate from Profile&rdquo; to populate it.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                {summary && (
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F1B2D] border-b border-[#E5E1D8] pb-1 mb-2">
                      Professional Summary
                    </h2>
                    <p className="text-xs leading-relaxed text-[#374151] whitespace-pre-line">
                      {summary}
                    </p>
                  </section>
                )}

                {/* Work Experience */}
                {experiences.length > 0 && (
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F1B2D] border-b border-[#E5E1D8] pb-1 mb-3">
                      Work Experience
                    </h2>
                    <div className="space-y-4">
                      {experiences.map((exp, idx) => (
                        <div key={idx}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-xs font-bold text-[#0F1B2D]">
                              {exp.role_title || 'Role'}
                              {exp.company ? ` — ${exp.company}` : ''}
                            </h3>
                            {exp.period_label && (
                              <span className="text-[11px] text-[#6B7280]">{exp.period_label}</span>
                            )}
                          </div>
                          {Array.isArray(exp.bullets) && exp.bullets.length > 0 && (
                            <ul className="mt-1.5 list-disc pl-4 space-y-1 text-xs text-[#374151]">
                              {exp.bullets.map((b, bIdx) => (
                                <li key={bIdx} className="leading-relaxed">
                                  {b}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Education */}
                {education.length > 0 && (
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F1B2D] border-b border-[#E5E1D8] pb-1 mb-3">
                      Education
                    </h2>
                    <div className="space-y-2.5">
                      {education.map((edu, idx) => (
                        <div key={idx} className="flex flex-wrap items-baseline justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-[#0F1B2D]">
                              {edu.degree || 'Degree'}
                            </p>
                            {edu.school && (
                              <p className="text-xs text-[#4B5563]">{edu.school}</p>
                            )}
                          </div>
                          {edu.year_label && (
                            <span className="text-[11px] text-[#6B7280]">{edu.year_label}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Skills */}
                {skillNames.length > 0 && (
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F1B2D] border-b border-[#E5E1D8] pb-1 mb-2">
                      Core Skills
                    </h2>
                    <p className="text-xs text-[#374151] leading-relaxed">
                      {skillNames.join('  •  ')}
                    </p>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
