'use client';

import React, { useState, useEffect } from 'react';
import StepProgress from '../components/StepProgress';
import CelebrationModal from '../components/CelebrationModal';
import {
  Building2,
  Users,
  Gift,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Briefcase,
} from 'lucide-react';

const STEPS = [
  { id: 'org', title: 'Employer Brand', subtitle: 'Company, sector & size' },
  { id: 'headcount', title: 'Hiring Goals', subtitle: 'Roles, targets & policy' },
  { id: 'perks', title: 'Benefits & Culture', subtitle: 'ESOPs, perks & fairness' },
  { id: 'recruiter', title: 'Talent Lead', subtitle: 'Contact & verification' },
];

const SECTORS = [
  'B2B SaaS',
  'FinTech',
  'HealthTech',
  'AI / Machine Learning',
  'Climate & CleanTech',
  'Consumer & E-Commerce',
  'DeepTech & Hardware',
  'EdTech',
  'Logistics & Supply Chain',
];

const PERKS_OPTIONS = [
  'Comprehensive Health Insurance (Family)',
  'ESOPs / Employee Stock Ownership Pool',
  'Flexible Work Hours & Unlimited PTO',
  'Annual Learning & Book Stipend (₹40,000+)',
  'Ergonomic Home Office Setup Budget',
  'Annual Team Offsites & Retreats',
  'Performance Bonuses & Commissions',
  'Mental Health & Wellness Subscriptions',
];

export default function EmployerOnboarding() {
  const [step, setStep] = useState(1);
  const [showCelebration, setShowCelebration] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    sector: 'B2B SaaS',
    companySize: '11–50 employees',
    website: '',
    headquarters: 'Bengaluru, India',
    pitch: 'Building scalable financial tools for the next generation of global businesses.',
    // Step 2
    openDepartments: ['Engineering & DevOps', 'Product Management'],
    plannedHires: '4–10 hires in next 90 days',
    workPolicy: 'Hybrid (2 days in office)',
    urgency: 'Immediate (Within 30 days)',
    // Step 3
    perks: [
      'Comprehensive Health Insurance (Family)',
      'ESOPs / Employee Stock Ownership Pool',
      'Ergonomic Home Office Setup Budget',
    ],
    blindHiringSupported: true,
    salaryTransparent: true,
    // Step 4
    recruiterName: '',
    workEmail: '',
    recruiterPhone: '',
    codeOfConduct: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('forma_onboarding_employer');
      if (saved) setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('forma_onboarding_employer', JSON.stringify(formData));
    } catch {}
  }, [formData]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    setFormData((prev) => {
      const list = prev[field] || [];
      const exists = list.includes(item);
      return {
        ...prev,
        [field]: exists ? list.filter((i) => i !== item) : [...list, item],
      };
    });
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
          {/* STEP 1: EMPLOYER BRAND */}
          {step === 1 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 1 of 4 · Company Identity
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Employer Brand & Organization Profile
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Set up your hiring profile so pre-vetted engineers and leaders recognize your brand.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    placeholder="e.g. PixelForge Technologies"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Industry Sector
                  </label>
                  <select
                    value={formData.sector}
                    onChange={(e) => handleChange('sector', e.target.value)}
                    className="field text-sm"
                  >
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Company Size
                  </label>
                  <select
                    value={formData.companySize}
                    onChange={(e) => handleChange('companySize', e.target.value)}
                    className="field text-sm"
                  >
                    <option>1–10 employees (Founding team)</option>
                    <option>11–50 employees</option>
                    <option>51–200 employees</option>
                    <option>201–500 employees</option>
                    <option>500+ employees</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Headquarters / Office Locations
                  </label>
                  <input
                    type="text"
                    value={formData.headquarters}
                    onChange={(e) => handleChange('headquarters', e.target.value)}
                    placeholder="e.g. Bengaluru, India & Remote"
                    className="field text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Company Website / Careers Link
                </label>
                <div className="relative">
                  <Globe size={15} className="absolute left-3.5 top-3.5 text-[#4A5568]" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="https://pixelforge.io/careers"
                    className="field text-sm pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Employer Pitch / What makes your culture unique?
                </label>
                <input
                  type="text"
                  value={formData.pitch}
                  onChange={(e) => handleChange('pitch', e.target.value)}
                  placeholder="e.g. Fast-paced, high autonomy, competitive ESOPs and quarterly hackathons."
                  className="field text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2: HIRING GOALS */}
          {step === 2 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 2 of 4 · Headcount
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Hiring Volume, Urgency & Departments
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Define the roles you are actively hiring for to pre-populate your candidate pipeline.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Departments with Open Roles (Select all that apply)
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    'Engineering & DevOps',
                    'Product Management',
                    'UI/UX Design',
                    'Data & AI / ML',
                    'Enterprise Sales & BD',
                    'Growth Marketing',
                    'Finance & Operations',
                  ].map((dept) => {
                    const selected = formData.openDepartments.includes(dept);
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleArrayItem('openDepartments', dept)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition ${
                          selected
                            ? 'border-[#0F1B2D] bg-[#0F1B2D] text-white'
                            : 'border-[#E5E1D8] bg-[#FAF8F4] text-[#0F1B2D] hover:bg-white'
                        }`}
                      >
                        <CheckCircle2
                          size={14}
                          className={selected ? 'text-[#D4AF37]' : 'text-[#E5E1D8]'}
                        />
                        <span>{dept}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Hiring Volume (Next 90 Days)
                  </label>
                  <select
                    value={formData.plannedHires}
                    onChange={(e) => handleChange('plannedHires', e.target.value)}
                    className="field text-sm"
                  >
                    <option>1–3 key hires</option>
                    <option>4–10 hires in next 90 days</option>
                    <option>11–25 hires (Rapid scale)</option>
                    <option>25+ hires (Enterprise expansion)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Work Location Policy
                  </label>
                  <select
                    value={formData.workPolicy}
                    onChange={(e) => handleChange('workPolicy', e.target.value)}
                    className="field text-sm"
                  >
                    <option>100% Remote First</option>
                    <option>Hybrid (2–3 days in office)</option>
                    <option>In-Office (Full-time)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Typical Hiring Urgency
                </label>
                <select
                  value={formData.urgency}
                  onChange={(e) => handleChange('urgency', e.target.value)}
                  className="field text-sm"
                >
                  <option>Immediate (Within 30 days)</option>
                  <option>Standard (30–60 days pipeline)</option>
                  <option>Continuous talent bench building</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 3: BENEFITS & FAIR HIRING */}
          {step === 3 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 3 of 4 · Culture & Offerings
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Benefits, ESOPs & Unbiased Hiring
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Candidates on Forma prioritize competitive perks and transparent, bias-free evaluations.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Company Perks & Compensation Package
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERKS_OPTIONS.map((perk) => {
                    const selected = formData.perks.includes(perk);
                    return (
                      <button
                        key={perk}
                        type="button"
                        onClick={() => toggleArrayItem('perks', perk)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition ${
                          selected
                            ? 'border-[#0F1B2D] bg-[#0F1B2D] text-white'
                            : 'border-[#E5E1D8] bg-[#FAF8F4] text-[#0F1B2D]'
                        }`}
                      >
                        <CheckCircle2
                          size={14}
                          className={selected ? 'text-[#D4AF37]' : 'text-[#E5E1D8]'}
                        />
                        <span>{perk}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Blind Hiring Adoption */}
              <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer text-xs text-[#0F1B2D]">
                  <input
                    type="checkbox"
                    checked={formData.blindHiringSupported}
                    onChange={(e) => handleChange('blindHiringSupported', e.target.checked)}
                    className="mt-0.5 rounded border-[#E5E1D8] text-[#9A7A45] focus:ring-[#9A7A45]"
                  />
                  <span>
                    <strong>Support Blind Resume Screening:</strong> Allow initial applicant review with
                    masked candidate names and gender to reduce unconscious bias and increase diverse
                    interviews.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: RECRUITER CONTACT */}
          {step === 4 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 4 of 4 · Hiring Coordinator
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Lead Recruiter / Coordinator Details
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Who on your team should receive candidate match notifications and interview acceptances?
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Lead Recruiter / Hiring Lead Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.recruiterName}
                    onChange={(e) => handleChange('recruiterName', e.target.value)}
                    placeholder="e.g. Priya Mehta"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Official Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.workEmail}
                    onChange={(e) => handleChange('workEmail', e.target.value)}
                    placeholder="priya@pixelforge.io"
                    className="field text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Interview Coordination WhatsApp / Phone
                </label>
                <input
                  type="tel"
                  value={formData.recruiterPhone}
                  onChange={(e) => handleChange('recruiterPhone', e.target.value)}
                  placeholder="+91 98765 12345"
                  className="field text-sm"
                />
              </div>

              <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer text-xs text-[#0F1B2D]">
                  <input
                    type="checkbox"
                    required
                    checked={formData.codeOfConduct}
                    onChange={(e) => handleChange('codeOfConduct', e.target.checked)}
                    className="mt-0.5 rounded border-[#E5E1D8] text-[#9A7A45] focus:ring-[#9A7A45]"
                  />
                  <span>
                    <strong>Fair Hiring Charter:</strong> We agree to provide timely candidate feedback,
                    honor stated salary ranges, and comply with data privacy policies regarding candidate resumes.
                  </span>
                </label>
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
              {step === STEPS.length ? 'Activate Employer Workspace' : 'Continue'}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>

      {showCelebration && (
        <CelebrationModal
          role="employer"
          roleLabel="Employer Recruiter"
          dashboardUrl="/employer/dashboard"
          profileSummary={[
            { label: 'Company', value: formData.companyName || 'Employer Brand' },
            { label: 'Planned Hires', value: formData.plannedHires },
            { label: 'Location Policy', value: formData.workPolicy },
            { label: 'Hiring Lead', value: formData.recruiterName || 'Talent Team' },
          ]}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
