'use client';

import React, { useEffect, useState } from 'react';
import { X, Wand2, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { JobBtn } from '@/components/jobseeker-ui';
import { errorLabel } from '@/components/career-data';

function parseEducationString(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s*[—–\-|,]\s*/);
  if (parts.length >= 2) {
    return [{ degree: parts[0].trim(), school: parts.slice(1).join(', ').trim(), year_label: '' }];
  }
  return [{ degree: trimmed, school: '', year_label: '' }];
}

function formatIndustrySummary({ rawSummary, targetRole, yearsExp, skillNames }) {
  const base = (rawSummary || '').trim();
  if (base.length >= 80) return base;
  const parts = [];
  if (targetRole) {
    const yrsText = yearsExp != null && yearsExp > 0 ? ` with ${yearsExp}+ years of experience` : '';
    parts.push(`${targetRole}${yrsText}.`);
  }
  if (base) {
    parts.push(base.endsWith('.') ? base : `${base}.`);
  }
  if (skillNames.length > 0) {
    parts.push(`Core competencies include ${skillNames.slice(0, 6).join(', ')}.`);
  }
  return parts.join(' ');
}

export function ResumeProfileWizardModal({
  open,
  onClose,
  resumeId,
  currentResume,
  onApplied,
}) {
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  const [foundLabels, setFoundLabels] = useState([]);
  const [missingLabels, setMissingLabels] = useState([]);

  // Wizard fields
  const [targetRole, setTargetRole] = useState('');
  const [summary, setSummary] = useState('');
  const [yearsExp, setYearsExp] = useState(null);
  const [experiences, setExperiences] = useState([]);
  const [skipExperience, setSkipExperience] = useState(false);
  const [education, setEducation] = useState([]);
  const [skills, setSkills] = useState([]);

  // Skill search inside wizard
  const [skillQuery, setSkillQuery] = useState('');
  const [skillOptions, setSkillOptions] = useState([]);

  // Track what was missing initially so we highlight those questions
  const [needsRole, setNeedsRole] = useState(false);
  const [needsSummary, setNeedsSummary] = useState(false);
  const [needsExp, setNeedsExp] = useState(false);
  const [needsEdu, setNeedsEdu] = useState(false);
  const [needsSkills, setNeedsSkills] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setLoadingProfile(true);
    setLoadError('');
    setApplyError('');

    Promise.all([
      api.users.me(ctrl.signal),
      api.talentProfile.me(ctrl.signal).catch(() => null),
    ])
      .then(([user, talent]) => {
        if (ctrl.signal.aborted) return;

        const roleVal =
          talent?.headline || user?.headline || user?.prior_role || currentResume.targetRole || '';
        const summaryVal = talent?.summary || user?.bio || currentResume.summaryText || '';
        const yrs = talent?.total_experience_yrs ?? null;
        const skillList =
          talent?.skills && talent.skills.length > 0
            ? talent.skills
            : currentResume.selectedSkills || [];

        const eduList =
          currentResume.education && currentResume.education.length > 0
            ? currentResume.education
            : parseEducationString(user?.education);

        const expList =
          currentResume.experiences && currentResume.experiences.length > 0
            ? currentResume.experiences
            : [];

        const found = [];
        const missing = [];

        if (roleVal) found.push('Target Role');
        else missing.push('Target Role');

        if (summaryVal) found.push('Professional Summary');
        else missing.push('Professional Summary');

        if (expList.length > 0) {
          found.push(`Work Experience (${expList.length})`);
        } else {
          missing.push('Work Experience');
        }

        if (eduList.length > 0 && eduList.every((e) => e.degree && e.school)) {
          found.push(`Education (${eduList.length})`);
        } else {
          missing.push('Education');
        }

        if (skillList.length > 0) found.push(`Skills (${skillList.length})`);
        else missing.push('Core Skills');

        setFoundLabels(found);
        setMissingLabels(missing);

        setTargetRole(roleVal);
        setSummary(summaryVal);
        setYearsExp(yrs);
        setSkills(skillList);
        setSkipExperience(false);

        setNeedsRole(!roleVal);
        setNeedsSummary(!summaryVal);
        setNeedsExp(expList.length === 0);
        setNeedsEdu(eduList.length === 0 || eduList.some((e) => !e.degree || !e.school));
        setNeedsSkills(skillList.length === 0);

        setExperiences(
          expList.length > 0
            ? expList
            : [
                {
                  role_title: user?.prior_role || '',
                  company: '',
                  period_label: '',
                  bulletsText: '',
                },
              ],
        );

        setEducation(
          eduList.length > 0 ? eduList : [{ degree: '', school: '', year_label: '' }],
        );
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setLoadError(errorLabel(err, 'Could not load your profile data.'));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingProfile(false);
      });

    return () => ctrl.abort();
  }, [open, currentResume]);

  useEffect(() => {
    if (!open || !needsSkills) return;
    const ctrl = new AbortController();
    api.skills
      .search({ q: skillQuery.trim() || undefined, limit: 16, signal: ctrl.signal })
      .then((rows) => setSkillOptions(rows || []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [open, needsSkills, skillQuery]);

  if (!open) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setApplyError('');

    if (!targetRole.trim()) {
      setApplyError('Please enter a Target Role for your resume.');
      return;
    }
    if (!summary.trim()) {
      setApplyError('Please provide a short Professional Summary.');
      return;
    }

    const validExps = skipExperience
      ? []
      : experiences.filter((ex) => ex.role_title.trim() && ex.company.trim());

    if (!skipExperience && needsExp && validExps.length === 0) {
      setApplyError(
        'Please enter at least one role (Role Title and Company) or check "Skip work experience".',
      );
      return;
    }

    const validEdus = education.filter((ed) => ed.degree.trim() && ed.school.trim());
    if (needsEdu && validEdus.length === 0) {
      setApplyError('Please enter your Degree and School / University.');
      return;
    }

    setApplying(true);
    try {
      const formattedSummary = formatIndustrySummary({
        rawSummary: summary,
        targetRole: targetRole.trim(),
        yearsExp,
        skillNames: skills.map((s) => s.name),
      });

      await api.resumes.update(resumeId, {
        title: currentResume.title?.trim() || `${targetRole.trim()} Resume`,
        target_role: targetRole.trim(),
        summary: formattedSummary,
      });

      if (validExps.length > 0) {
        await api.resumes.replaceExperiences(resumeId, {
          items: validExps.map((ex) => ({
            role_title: ex.role_title.trim(),
            company: ex.company.trim(),
            period_label: ex.period_label.trim() || null,
            bullets: (ex.bulletsText || '')
              .split('\n')
              .map((b) => b.trim())
              .filter(Boolean),
          })),
        });
      }

      if (validEdus.length > 0) {
        await api.resumes.replaceEducation(resumeId, {
          items: validEdus.map((ed) => ({
            degree: ed.degree.trim(),
            school: ed.school.trim(),
            year_label: ed.year_label.trim() || null,
          })),
        });
      }

      if (skills.length > 0) {
        await api.resumes.replaceSkills(resumeId, {
          skill_ids: skills.map((s) => s.id),
        });
      }

      onApplied();
      onClose();
    } catch (err) {
      setApplyError(errorLabel(err, 'Could not generate resume from profile.'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-wizard-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !applying) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[#E5E1D8] bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F1B2D] text-[#B8955A]">
              <Wand2 size={16} />
            </div>
            <div>
              <h2 id="profile-wizard-title" className="text-sm font-serif font-bold text-[#0F1B2D]">
                Generate Industry-Standard Resume from Profile
              </h2>
              <p className="text-[11px] text-[#6B7280]">
                We pull your existing profile data and only ask for missing details.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-lg p-1.5 text-[#6B7280] hover:bg-white hover:text-[#0F1B2D]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleGenerate} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {loadingProfile ? (
            <div className="py-12 text-center text-[#6B7280]">
              Reading your profile and talent details...
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] p-4 text-[#B42318]">
              {loadError}
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#CDE5D7] bg-[#E7F3EC]/60 p-3.5">
                  <span className="font-bold text-[#286749] flex items-center gap-1.5 mb-1">
                    <CheckCircle2 size={14} /> Found on Profile
                  </span>
                  <p className="text-[#286749] leading-relaxed">
                    {foundLabels.length > 0 ? foundLabels.join(', ') : 'No resume fields found yet.'}
                  </p>
                </div>
                <div className="rounded-xl border border-[#D4C3A3] bg-[#F3EBDD]/50 p-3.5">
                  <span className="font-bold text-[#806236] flex items-center gap-1.5 mb-1">
                    <AlertCircle size={14} /> Needed to Complete
                  </span>
                  <p className="text-[#806236] leading-relaxed">
                    {missingLabels.length > 0
                      ? missingLabels.join(', ')
                      : 'All sections ready! Review and apply.'}
                  </p>
                </div>
              </div>

              {applyError && (
                <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] p-3 text-[#B42318]">
                  {applyError}
                </div>
              )}

              {/* Target Role & Summary (shown if missing or always editable compactly) */}
              {(needsRole || needsSummary) && (
                <div className="space-y-3 rounded-xl border border-[#E5E1D8] p-4 bg-[#FAF8F4]/40">
                  <h3 className="font-bold text-[#0F1B2D]">Role &amp; Professional Summary</h3>
                  {needsRole && (
                    <div>
                      <label className="block font-semibold text-[#4A5568] mb-1">
                        Target Role *
                      </label>
                      <input
                        type="text"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        placeholder="e.g. Senior Full-Stack Engineer"
                        className="w-full h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-[#0F1B2D]"
                      />
                    </div>
                  )}
                  {needsSummary && (
                    <div>
                      <label className="block font-semibold text-[#4A5568] mb-1">
                        Brief Career Summary *
                      </label>
                      <textarea
                        rows={3}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="Describe your experience, domain focus, and key strengths..."
                        className="w-full p-2.5 rounded-lg border border-[#E5E1D8] bg-white text-[#0F1B2D]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Work Experience if missing */}
              {needsExp && (
                <div className="space-y-3 rounded-xl border border-[#E5E1D8] p-4 bg-[#FAF8F4]/40">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-[#0F1B2D]">Work Experience</h3>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#4A5568] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipExperience}
                        onChange={(e) => setSkipExperience(e.target.checked)}
                      />
                      Student / Entry-level (skip)
                    </label>
                  </div>

                  {!skipExperience && (
                    <div className="space-y-3">
                      {experiences.map((exp, idx) => (
                        <div key={idx} className="space-y-2 rounded-lg border border-[#E5E1D8] bg-white p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#806236]">Role #{idx + 1}</span>
                            {experiences.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExperiences((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-[#6B7280] hover:text-[#B42318]"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input
                              type="text"
                              placeholder="Role title *"
                              value={exp.role_title}
                              onChange={(e) => {
                                const v = e.target.value;
                                setExperiences((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, role_title: v } : x)),
                                );
                              }}
                              className="h-9 px-2.5 rounded-lg border border-[#E5E1D8] text-[#0F1B2D]"
                            />
                            <input
                              type="text"
                              placeholder="Company *"
                              value={exp.company}
                              onChange={(e) => {
                                const v = e.target.value;
                                setExperiences((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, company: v } : x)),
                                );
                              }}
                              className="h-9 px-2.5 rounded-lg border border-[#E5E1D8] text-[#0F1B2D]"
                            />
                            <input
                              type="text"
                              placeholder="Period (e.g. 2022 - Present)"
                              value={exp.period_label}
                              onChange={(e) => {
                                const v = e.target.value;
                                setExperiences((prev) =>
                                  prev.map((x, i) => (i === idx ? { ...x, period_label: v } : x)),
                                );
                              }}
                              className="h-9 px-2.5 rounded-lg border border-[#E5E1D8] text-[#0F1B2D]"
                            />
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Key accomplishments (one per line)..."
                            value={exp.bulletsText}
                            onChange={(e) => {
                              const v = e.target.value;
                              setExperiences((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, bulletsText: v } : x)),
                              );
                            }}
                            className="w-full p-2 rounded-lg border border-[#E5E1D8] text-[#0F1B2D]"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setExperiences((prev) => [
                            ...prev,
                            { role_title: '', company: '', period_label: '', bulletsText: '' },
                          ])
                        }
                        className="inline-flex items-center gap-1 font-semibold text-[#806236] hover:underline"
                      >
                        <Plus size={12} /> Add another role
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Education if missing or incomplete */}
              {needsEdu && (
                <div className="space-y-3 rounded-xl border border-[#E5E1D8] p-4 bg-[#FAF8F4]/40">
                  <h3 className="font-bold text-[#0F1B2D]">Education *</h3>
                  {education.map((edu, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        placeholder="Degree *"
                        value={edu.degree}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEducation((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, degree: v } : x)),
                          );
                        }}
                        className="h-9 px-2.5 rounded-lg border border-[#E5E1D8] bg-white text-[#0F1B2D]"
                      />
                      <input
                        type="text"
                        placeholder="School / University *"
                        value={edu.school}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEducation((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, school: v } : x)),
                          );
                        }}
                        className="h-9 px-2.5 rounded-lg border border-[#E5E1D8] bg-white text-[#0F1B2D]"
                      />
                      <input
                        type="text"
                        placeholder="Year (e.g. 2018 - 2022)"
                        value={edu.year_label}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEducation((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, year_label: v } : x)),
                          );
                        }}
                        className="h-9 px-2.5 rounded-lg border border-[#E5E1D8] bg-white text-[#0F1B2D]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Skills if missing */}
              {needsSkills && (
                <div className="space-y-2.5 rounded-xl border border-[#E5E1D8] p-4 bg-[#FAF8F4]/40">
                  <h3 className="font-bold text-[#0F1B2D]">Core Skills</h3>
                  <input
                    type="text"
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    placeholder="Search skills (e.g. Python, React, Product)..."
                    className="w-full h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-[#0F1B2D]"
                  />
                  {skillOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skillOptions
                        .filter((opt) => !skills.some((s) => s.id === opt.id))
                        .map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSkills((prev) => [...prev, opt])}
                            className="inline-flex items-center gap-1 rounded-full border border-[#D4C3A3] bg-white px-2.5 py-0.5 text-[11px] text-[#806236] hover:bg-[#FAF8F4]"
                          >
                            <Plus size={10} /> {opt.name}
                          </button>
                        ))}
                    </div>
                  )}
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {skills.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E5E1D8] px-2.5 py-0.5 text-[11px] text-[#0F1B2D]"
                        >
                          {s.name}
                          <button
                            type="button"
                            onClick={() =>
                              setSkills((prev) => prev.filter((x) => x.id !== s.id))
                            }
                            className="text-[#A0A7B4] hover:text-[#B42318]"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E1D8]">
            <JobBtn secondary small type="button" onClick={onClose} disabled={applying}>
              Cancel
            </JobBtn>
            <JobBtn
              primary
              small
              type="submit"
              disabled={loadingProfile || Boolean(loadError) || applying}
              className="flex items-center gap-1.5"
            >
              <Wand2 size={13} /> {applying ? 'Generating...' : 'Generate & Apply Resume'}
            </JobBtn>
          </div>
        </form>
      </div>
    </div>
  );
}
