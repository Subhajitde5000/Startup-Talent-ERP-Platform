'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Sparkles,
  Download,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, errorLabel } from '@/components/career-data';
import { FieldError, fieldErrorsFrom } from '@/components/async-state';

const SECTIONS = ['Summary', 'Experience', 'Education', 'Skills', 'Projects'];

export default function ResumeEditorPage() {
  const params = useParams();
  const resumeId = typeof params?.resumeId === 'string' ? params.resumeId : '';

  const resource = useCareerResource(
    resumeId ? `resume:${resumeId}` : null,
    (signal) => api.resumes.get(resumeId, signal),
  );

  const [activeSection, setActiveSection] = useState('Summary');
  const [title, setTitle] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [experiences, setExperiences] = useState([]);
  const [education, setEducation] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);

  const [skillQuery, setSkillQuery] = useState('');
  const [skillOptions, setSkillOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState('');
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const r = resource.data;
    if (!r) return;
    setTitle(r.title || '');
    setTargetRole(r.target_role || '');
    setSummaryText(r.summary || '');
    setExperiences(
      (r.experiences || []).map((e) => ({
        role_title: e.role_title || '',
        company: e.company || '',
        period_label: e.period_label || '',
        bulletsText: (e.bullets || []).join('\n'),
      })),
    );
    setEducation(
      (r.education || []).map((ed) => ({
        degree: ed.degree || '',
        school: ed.school || '',
        year_label: ed.year_label || '',
      })),
    );
    setSelectedSkills(r.skills || []);
  }, [resource.data]);

  useEffect(() => {
    if (activeSection !== 'Skills') return;
    const ctrl = new AbortController();
    api.skills
      .search({ q: skillQuery.trim() || undefined, limit: 20, signal: ctrl.signal })
      .then((rows) => setSkillOptions(rows || []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [activeSection, skillQuery]);

  const showSaved = (msg) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(''), 3000);
  };

  const handleSaveActive = async () => {
    if (!resumeId) return;
    setSaving(true);
    setSaveError('');
    setFieldErrors({});
    try {
      if (activeSection === 'Summary') {
        await api.resumes.update(resumeId, {
          title: title.trim() || 'Untitled Resume',
          target_role: targetRole.trim() || null,
          summary: summaryText.trim() || null,
        });
      } else if (activeSection === 'Experience') {
        await api.resumes.replaceExperiences(resumeId, {
          items: experiences.map((e) => ({
            role_title: e.role_title.trim(),
            company: e.company.trim(),
            period_label: e.period_label.trim() || null,
            bullets: e.bulletsText
              .split('\n')
              .map((b) => b.trim())
              .filter(Boolean),
          })),
        });
      } else if (activeSection === 'Education') {
        await api.resumes.replaceEducation(resumeId, {
          items: education.map((ed) => ({
            degree: ed.degree.trim(),
            school: ed.school.trim(),
            year_label: ed.year_label.trim() || null,
          })),
        });
      } else if (activeSection === 'Skills') {
        await api.resumes.replaceSkills(resumeId, {
          skill_ids: selectedSkills.map((s) => s.id),
        });
      }
      resource.reload();
      showSaved(`${activeSection} changes saved.`);
    } catch (err) {
      setFieldErrors(fieldErrorsFrom(err));
      setSaveError(errorLabel(err, 'Could not save changes.'));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!resumeId) return;
    try {
      const data = await api.resumes.exportJson(resumeId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data.title || 'resume').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSaveError(errorLabel(err, 'Could not export resume.'));
    }
  };

  const addExperience = () => {
    setExperiences((prev) => [
      ...prev,
      { role_title: '', company: '', period_label: '', bulletsText: '' },
    ]);
  };

  const moveItem = (list, setter, idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const copy = [...list];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setter(copy);
  };

  const addSkill = (skill) => {
    if (selectedSkills.some((s) => s.id === skill.id)) return;
    setSelectedSkills((prev) => [...prev, skill]);
  };

  const removeSkill = (id) => {
    setSelectedSkills((prev) => prev.filter((s) => s.id !== id));
  };

  const resume = resource.data;

  return (
    <JobSeekerShell active="Resumes">
      <div className="space-y-6 max-w-6xl pb-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link href="/jobseeker/resumes" className="flex items-center gap-1 hover:text-[#0F1B2D]">
            <ChevronLeft size={14} /> Back to Resumes
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium truncate">
            {resume?.title || 'Resume Editor'}
          </span>
        </nav>

        <ResourceState
          resource={resource}
          empty={!resource.loading && !resource.error && !resume}
          emptyTitle="Resume not found"
          emptyBody="This resume may have been deleted or belongs to another account."
          onRetry={resource.reload}
        >
          {resume && (
            <>
              {/* Header */}
              <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                      {resume.title}
                    </h1>
                    <span className="rounded-full bg-[#E7F3EC] px-2.5 py-0.5 text-xs font-semibold text-[#286749]">
                      ATS Score: {resume.ats_score != null ? `${resume.ats_score}%` : 'Not scored'}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    Target:{' '}
                    <strong className="text-[#0F1B2D]">
                      {resume.target_role || 'No target role set'}
                    </strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/jobseeker/resumes/${resume.id}/tailor`}>
                    <JobBtn secondary small className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-[#806236]" /> Tailor to Job
                    </JobBtn>
                  </Link>
                  <Link href={`/jobseeker/resumes/${resume.id}/ats`}>
                    <JobBtn secondary small>
                      ATS Scan Breakdown
                    </JobBtn>
                  </Link>
                  <JobBtn secondary small onClick={handleExport} className="flex items-center gap-1.5">
                    <Download size={13} /> Export JSON
                  </JobBtn>
                  {activeSection !== 'Projects' && (
                    <JobBtn
                      primary
                      small
                      onClick={handleSaveActive}
                      disabled={saving}
                      className="flex items-center gap-1.5"
                    >
                      <Save size={14} /> {saving ? 'Saving...' : `Save ${activeSection}`}
                    </JobBtn>
                  )}
                </div>
              </header>

              {savedToast && (
                <div className="rounded-xl border border-[#CDE5D7] bg-[#E7F3EC] p-3 text-xs text-[#286749] flex items-center gap-2">
                  <CheckCircle2 size={16} /> {savedToast}
                </div>
              )}

              {saveError && (
                <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
                  {saveError}
                </div>
              )}

              {/* 2-Column Editor Layout */}
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Section Selector */}
                <aside className="lg:col-span-3 space-y-2">
                  <div className="rounded-xl border border-[#E5E1D8] bg-white p-3 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] px-3 py-1 block">
                      Resume Sections
                    </span>
                    {SECTIONS.map((sec) => {
                      const isCurrent = activeSection === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            setActiveSection(sec);
                            setSaveError('');
                            setFieldErrors({});
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between ${
                            isCurrent
                              ? 'bg-[#0F1B2D] text-white'
                              : 'text-[#4A5568] hover:bg-[#FAF8F4]'
                          }`}
                        >
                          <span>{sec}</span>
                          <CheckCircle2
                            size={13}
                            className={isCurrent ? 'text-[#B8955A]' : 'text-[#CDE5D7]'}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* ATS Tip Box */}
                  <div className="rounded-xl border border-[#D4C3A3] bg-[#F3EBDD]/50 p-4 text-xs text-[#806236] space-y-1.5">
                    <span className="font-bold flex items-center gap-1">
                      <Sparkles size={13} /> Pro ATS Tip
                    </span>
                    <p className="leading-relaxed">
                      Include measurable outcomes in your experience bullets (e.g. &ldquo;reduced drop-off by 22%&rdquo;).
                    </p>
                  </div>
                </aside>

                {/* Section Form Editor */}
                <div className="lg:col-span-9 space-y-6">
                  {activeSection === 'Summary' && (
                    <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                      <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                        Resume Details &amp; Summary
                      </h2>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="edTitle" className="block text-xs font-semibold text-[#4A5568] mb-1">
                            Title
                          </label>
                          <input
                            id="edTitle"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                          />
                          <FieldError message={fieldErrors.title} />
                        </div>
                        <div>
                          <label htmlFor="edRole" className="block text-xs font-semibold text-[#4A5568] mb-1">
                            Target Role
                          </label>
                          <input
                            id="edRole"
                            type="text"
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                          />
                          <FieldError message={fieldErrors.target_role} />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="edSummary" className="block text-xs font-semibold text-[#4A5568] mb-1">
                          Professional Summary
                        </label>
                        <textarea
                          id="edSummary"
                          rows={5}
                          value={summaryText}
                          onChange={(e) => setSummaryText(e.target.value)}
                          placeholder="A 3-4 sentence hook highlighting your core focus, tenure, and biggest strengths..."
                          className="w-full p-3.5 rounded-xl border border-[#E5E1D8] text-xs leading-relaxed text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                        />
                        <FieldError message={fieldErrors.summary} />
                      </div>
                    </section>
                  )}

                  {activeSection === 'Experience' && (
                    <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                          Work Experience
                        </h2>
                        <JobBtn secondary small onClick={addExperience} className="flex items-center gap-1">
                          <Plus size={13} /> Add Role
                        </JobBtn>
                      </div>

                      {experiences.length === 0 ? (
                        <p className="text-xs text-[#6B7280] py-4">
                          No work experience added yet. Click &ldquo;Add Role&rdquo; to begin.
                        </p>
                      ) : (
                        <div className="space-y-4 text-xs">
                          {experiences.map((exp, idx) => (
                            <div
                              key={idx}
                              className="p-4 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#806236]">Role #{idx + 1}</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => moveItem(experiences, setExperiences, idx, -1)}
                                    disabled={idx === 0}
                                    className="p-1 text-[#6B7280] hover:text-[#0F1B2D] disabled:opacity-30"
                                    aria-label="Move experience up"
                                  >
                                    <ArrowUp size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveItem(experiences, setExperiences, idx, 1)}
                                    disabled={idx === experiences.length - 1}
                                    className="p-1 text-[#6B7280] hover:text-[#0F1B2D] disabled:opacity-30"
                                    aria-label="Move experience down"
                                  >
                                    <ArrowDown size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExperiences((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    className="p-1 text-[#6B7280] hover:text-[#B42318]"
                                    aria-label="Remove experience"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <input
                                  type="text"
                                  placeholder="Role title *"
                                  value={exp.role_title}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setExperiences((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, role_title: val } : x)),
                                    );
                                  }}
                                  className="h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D]"
                                />
                                <input
                                  type="text"
                                  placeholder="Company *"
                                  value={exp.company}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setExperiences((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, company: val } : x)),
                                    );
                                  }}
                                  className="h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D]"
                                />
                                <input
                                  type="text"
                                  placeholder="Period (e.g. 2022 - Present)"
                                  value={exp.period_label}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setExperiences((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, period_label: val } : x)),
                                    );
                                  }}
                                  className="h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D]"
                                />
                              </div>

                              <textarea
                                rows={3}
                                placeholder="One accomplishment bullet per line..."
                                value={exp.bulletsText}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExperiences((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, bulletsText: val } : x)),
                                  );
                                }}
                                className="w-full p-2.5 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D]"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {activeSection === 'Education' && (
                    <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Education</h2>
                        <JobBtn
                          secondary
                          small
                          onClick={() =>
                            setEducation((prev) => [
                              ...prev,
                              { degree: '', school: '', year_label: '' },
                            ])
                          }
                          className="flex items-center gap-1"
                        >
                          <Plus size={13} /> Add Education
                        </JobBtn>
                      </div>

                      {education.length === 0 ? (
                        <p className="text-xs text-[#6B7280] py-4">
                          No education entries yet. Click &ldquo;Add Education&rdquo; to add one.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {education.map((edu, idx) => (
                            <div
                              key={idx}
                              className="p-4 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4]/50 space-y-3 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#806236]">Entry #{idx + 1}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEducation((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="p-1 text-[#6B7280] hover:text-[#B42318]"
                                  aria-label="Remove education"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <input
                                  type="text"
                                  placeholder="Degree *"
                                  value={edu.degree}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEducation((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, degree: val } : x)),
                                    );
                                  }}
                                  className="h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D]"
                                />
                                <input
                                  type="text"
                                  placeholder="School / University *"
                                  value={edu.school}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEducation((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, school: val } : x)),
                                    );
                                  }}
                                  className="h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D]"
                                />
                                <input
                                  type="text"
                                  placeholder="Year (e.g. 2016 - 2020)"
                                  value={edu.year_label}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEducation((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, year_label: val } : x)),
                                    );
                                  }}
                                  className="h-9 px-3 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D]"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {activeSection === 'Skills' && (
                    <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                      <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                        Skills &amp; Core Competencies
                      </h2>

                      <input
                        type="text"
                        value={skillQuery}
                        onChange={(e) => setSkillQuery(e.target.value)}
                        placeholder="Search platform skills (e.g. Python, Figma, React)..."
                        className="w-full h-9 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />

                      {skillOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {skillOptions
                            .filter((opt) => !selectedSkills.some((s) => s.id === opt.id))
                            .map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => addSkill(opt)}
                                className="inline-flex items-center gap-1 rounded-full border border-[#D4C3A3] bg-white px-2.5 py-1 text-xs text-[#806236] hover:bg-[#FAF8F4]"
                              >
                                <Plus size={11} /> {opt.name}
                              </button>
                            ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#F0EBE0]">
                        <span className="text-xs font-semibold text-[#4A5568] block mb-2">
                          Selected Skills ({selectedSkills.length})
                        </span>
                        {selectedSkills.length === 0 ? (
                          <p className="text-xs text-[#6B7280]">No skills selected yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedSkills.map((skill) => (
                              <span
                                key={skill.id}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF8F4] border border-[#E5E1D8] px-3 py-1 text-xs text-[#0F1B2D]"
                              >
                                <span>{skill.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeSkill(skill.id)}
                                  className="text-[#A0A7B4] hover:text-[#B42318]"
                                  aria-label={`Remove ${skill.name}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {activeSection === 'Projects' && (
                    <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-2">
                      <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                        Key Case Studies &amp; Projects
                      </h2>
                      <p className="text-xs text-[#6B7280]">
                        The Projects section is not supported in the resume schema yet. Use Experience bullets to highlight key projects and measurable outcomes.
                      </p>
                    </section>
                  )}
                </div>
              </div>
            </>
          )}
        </ResourceState>
      </div>
    </JobSeekerShell>
  );
}
