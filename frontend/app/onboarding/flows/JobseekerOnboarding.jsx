'use client';

import React, { useState, useEffect } from 'react';
import StepProgress from '../components/StepProgress';
import CelebrationModal from '../components/CelebrationModal';
import {
  User,
  Code,
  DollarSign,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Upload,
  FileText,
  Lock,
} from 'lucide-react';

const STEPS = [
  { id: 'identity', title: 'Target Role', subtitle: 'Discipline, title & location' },
  { id: 'skills', title: 'Skills & Proof', subtitle: 'Tech stack, github & resume' },
  { id: 'compensation', title: 'Salary & Notice', subtitle: 'Expectations & availability' },
  { id: 'privacy', title: 'Pitch & Privacy', subtitle: 'Blind hiring & pitch' },
];

const SKILL_SUGGESTIONS = [
  'React',
  'Next.js',
  'TypeScript',
  'Node.js',
  'Python',
  'PostgreSQL',
  'AWS',
  'Docker',
  'System Design',
  'Figma',
  'UI/UX Design',
  'GraphQL',
  'Tailwind CSS',
  'Go',
  'Redis',
  'FastAPI',
  'Product Strategy',
];

export default function JobseekerOnboarding() {
  const [step, setStep] = useState(1);
  const [showCelebration, setShowCelebration] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    targetTitle: 'Senior Full Stack Engineer',
    discipline: 'Software Engineering',
    experienceLevel: '6–9 years (Senior)',
    location: 'Bengaluru / Remote',
    remotePreference: 'Open to Remote & Hybrid',
    // Step 2
    skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL'],
    customSkill: '',
    githubUrl: '',
    linkedinUrl: '',
    resumeName: 'Siddharth_Rao_Resume_2026.pdf',
    // Step 3
    currentCtc: '₹22,00,000 / year (~$26k)',
    expectedCtc: '₹32,00,000 / year (~$38k)',
    noticePeriod: '30 Days (Negotiable)',
    preferredStage: 'Early-stage & Growth (10–100 employees)',
    // Step 4
    pitch:
      'Full stack builder with 6 years scaling React & Node platforms to 2M monthly users. Love high-ownership engineering environments.',
    blindHiring: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('forma_onboarding_jobseeker');
      if (saved) setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('forma_onboarding_jobseeker', JSON.stringify(formData));
    } catch {}
  }, [formData]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSkill = (skill) => {
    setFormData((prev) => {
      const exists = prev.skills.includes(skill);
      return {
        ...prev,
        skills: exists ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
      };
    });
  };

  const addCustomSkill = (e) => {
    e.preventDefault();
    if (!formData.customSkill.trim()) return;
    if (!formData.skills.includes(formData.customSkill.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, prev.customSkill.trim()],
        customSkill: '',
      }));
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (step < STEPS.length) {
      setStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowCelebration(true);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      <StepProgress steps={STEPS} currentStep={step} onStepClick={setStep} />

      <div className="rounded-3xl border border-[#E5E1D8] bg-white p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleNext} className="space-y-6">
          {/* STEP 1: IDENTITY & ROLE */}
          {step === 1 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 1 of 4 · Career Profile
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Target Role & Professional Focus
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Tell hiring startups what kind of challenges you want to take on next.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    placeholder="e.g. Siddharth Rao"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Phone / WhatsApp (For recruiter scheduling)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className="field text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Target Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.targetTitle}
                    onChange={(e) => handleChange('targetTitle', e.target.value)}
                    placeholder="e.g. Senior Full Stack Engineer"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Functional Discipline
                  </label>
                  <select
                    value={formData.discipline}
                    onChange={(e) => handleChange('discipline', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Software Engineering & DevOps</option>
                    <option>Product Management</option>
                    <option>UI/UX Design & Research</option>
                    <option>Data Science & Machine Learning</option>
                    <option>Growth, Marketing & Content</option>
                    <option>Sales & Account Management</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Experience Level
                  </label>
                  <select
                    value={formData.experienceLevel}
                    onChange={(e) => handleChange('experienceLevel', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Entry Level (0–2 years)</option>
                    <option>Mid-Level (3–5 years)</option>
                    <option>6–9 years (Senior)</option>
                    <option>10+ years (Staff / Principal / Lead)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Remote Work Preference
                  </label>
                  <select
                    value={formData.remotePreference}
                    onChange={(e) => handleChange('remotePreference', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Open to Remote & Hybrid</option>
                    <option>Remote-Only</option>
                    <option>In-Office Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SKILLS & PROOF */}
          {step === 2 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 2 of 4 · Capabilities
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Skills, Tech Stack & Resume
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Select the technologies and frameworks you excel at, and attach your latest resume.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Top Skills (Click to toggle)
                </label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_SUGGESTIONS.map((skill) => {
                    const active = formData.skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? 'bg-[#0F1B2D] text-white shadow-xs'
                            : 'bg-[#FAF8F4] text-[#4A5568] border border-[#E5E1D8] hover:border-[#9A7A45]'
                        }`}
                      >
                        {skill} {active ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resume dropzone preview */}
              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Resume Document (PDF)
                </label>
                <div className="rounded-2xl border-2 border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-5 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#9A7A45] border border-[#E5E1D8]">
                    <FileText size={20} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#0F1B2D]">
                    {formData.resumeName || 'Upload your PDF resume'}
                  </p>
                  <p className="text-[11px] text-[#4A5568]">
                    Parsed automatically for skills and experience matching.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    GitHub or Portfolio Link
                  </label>
                  <input
                    type="url"
                    value={formData.githubUrl}
                    onChange={(e) => handleChange('githubUrl', e.target.value)}
                    placeholder="https://github.com/username or portfolio"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    LinkedIn Profile
                  </label>
                  <input
                    type="url"
                    value={formData.linkedinUrl}
                    onChange={(e) => handleChange('linkedinUrl', e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="field text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: COMPENSATION & NOTICE */}
          {step === 3 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 3 of 4 · Alignment
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Compensation & Availability
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Set transparent expectations to filter out irrelevant recruiter reachouts.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Current Annual CTC
                  </label>
                  <input
                    type="text"
                    value={formData.currentCtc}
                    onChange={(e) => handleChange('currentCtc', e.target.value)}
                    placeholder="e.g. ₹20,00,000"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Expected Minimum CTC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.expectedCtc}
                    onChange={(e) => handleChange('expectedCtc', e.target.value)}
                    placeholder="e.g. ₹30,00,000"
                    className="field text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Notice Period
                  </label>
                  <select
                    value={formData.noticePeriod}
                    onChange={(e) => handleChange('noticePeriod', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Immediate Joiner (0–7 days)</option>
                    <option>15 Days</option>
                    <option>30 Days (Negotiable)</option>
                    <option>60 Days</option>
                    <option>90 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Preferred Company Stage
                  </label>
                  <select
                    value={formData.preferredStage}
                    onChange={(e) => handleChange('preferredStage', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Early-stage Founding Team (1–10 members)</option>
                    <option>Growth Stage (10–100 employees)</option>
                    <option>Scale-up & Pre-IPO (100–500+)</option>
                    <option>Flexible across any high-growth startup</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PITCH & BLIND HIRING */}
          {step === 4 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 4 of 4 · Privacy & Visibility
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Elevator Pitch & Unbiased Screening
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Share your superpower and decide how your identity appears to hiring teams.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  1-Minute Elevator Pitch
                </label>
                <textarea
                  rows={3}
                  value={formData.pitch}
                  onChange={(e) => handleChange('pitch', e.target.value)}
                  placeholder="What makes your engineering or product work standout? Mention scale, systems, or notable wins."
                  className="w-full rounded-xl border border-[#E5E1D8] bg-white p-3.5 text-sm text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>

              {/* Blind Hiring Toggle */}
              <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-5 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock size={16} className="text-[#9A7A45]" />
                      <h4 className="text-xs font-bold text-[#0F1B2D]">
                        Blind Hiring Privacy Shield (Recommended)
                      </h4>
                    </div>
                    <p className="text-xs text-[#4A5568] leading-relaxed">
                      Hides your real name, contact details, and current employer until you mutually accept an
                      interview request. Prevents bias and keeps your search private from colleagues.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.blindHiring}
                    onChange={(e) => handleChange('blindHiring', e.target.checked)}
                    className="h-5 w-5 rounded border-[#E5E1D8] text-[#0F1B2D] focus:ring-[#0F1B2D]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-[#E5E1D8] pt-5">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E1D8] px-4 py-2.5 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4] transition"
              >
                <ArrowLeft size={14} /> Back
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F1B2D] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1A2E4C] transition"
            >
              {step === STEPS.length ? 'Activate Talent Profile' : 'Continue'}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>

      {showCelebration && (
        <CelebrationModal
          role="jobseeker"
          roleLabel="Talent Candidate"
          dashboardUrl="/jobseeker/dashboard"
          profileSummary={[
            { label: 'Role', value: formData.targetTitle },
            { label: 'Level', value: formData.experienceLevel },
            { label: 'Target CTC', value: formData.expectedCtc },
            { label: 'Privacy Mode', value: formData.blindHiring ? 'Blind Active' : 'Public' },
          ]}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
