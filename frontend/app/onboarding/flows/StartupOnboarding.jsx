'use client';

import React, { useState, useEffect } from 'react';
import StepProgress from '../components/StepProgress';
import CelebrationModal from '../components/CelebrationModal';
import {
  Building2,
  TrendingUp,
  DollarSign,
  Rocket,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Upload,
  Globe,
  HelpCircle,
} from 'lucide-react';

const STEPS = [
  { id: 'basics', title: 'Fundamentals', subtitle: 'Name, sector & stage' },
  { id: 'traction', title: 'Product & Traction', subtitle: 'Problem, revenue & metrics' },
  { id: 'funding', title: 'Capital & Raise', subtitle: 'Funding status & pitch deck' },
  { id: 'goals', title: 'Platform Goals', subtitle: 'DPIIT & ecosystem targets' },
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

const STAGES = [
  { id: 'idea', label: 'Ideation', desc: 'Validating problem & early sketches' },
  { id: 'prototype', label: 'MVP / Prototype', desc: 'Working prototype with alpha testers' },
  { id: 'early-revenue', label: 'Early Revenue', desc: 'First paying customers & repeatable usage' },
  { id: 'scaling', label: 'Growth / Scaling', desc: 'Expanding market share & unit economics' },
];

const REVENUE_RANGES = [
  'Pre-revenue',
  '< ₹1,00,000 / mo ($1.2k)',
  '₹1,00,000 – ₹10,00,000 / mo',
  '₹10,00,000 – ₹50,00,000 / mo',
  '₹50,00,000+ / mo ($60k+)',
];

export default function StartupOnboarding() {
  const [step, setStep] = useState(1);
  const [showCelebration, setShowCelebration] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    startupName: '',
    tagline: '',
    legalEntity: 'Private Limited (Pvt Ltd)',
    sector: 'B2B SaaS',
    stage: 'prototype',
    teamSize: '2-5 members',
    website: '',
    // Step 2
    problemStatement: '',
    targetMarket: 'B2B SMBs & Mid-Market',
    revenueModel: 'SaaS Subscription',
    mrrRange: '< ₹1,00,000 / mo ($1.2k)',
    demoUrl: '',
    // Step 3
    fundingStatus: 'Bootstrapped',
    activelyRaising: 'Yes — currently raising',
    targetAmount: '₹1.5 Crores (~$180k)',
    deckUrl: '',
    // Step 4
    goals: ['Raise Seed Funding', 'Find Specialized Mentors'],
    dpiitStatus: 'Applied / In Review',
  });

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('forma_onboarding_startup');
      if (saved) {
        setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch {}
  }, []);

  // Save draft whenever formData changes
  useEffect(() => {
    try {
      localStorage.setItem('forma_onboarding_startup', JSON.stringify(formData));
    } catch {}
  }, [formData]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleGoal = (goal) => {
    setFormData((prev) => {
      const exists = prev.goals.includes(goal);
      return {
        ...prev,
        goals: exists ? prev.goals.filter((g) => g !== goal) : [...prev.goals, goal],
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
      {/* Step Header */}
      <StepProgress steps={STEPS} currentStep={step} onStepClick={setStep} />

      {/* Main Form Card */}
      <div className="rounded-3xl border border-[#E5E1D8] bg-white p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleNext} className="space-y-6">
          {/* STEP 1: FUNDAMENTALS */}
          {step === 1 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 1 of 4 · Identity
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Tell us about your startup
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Basic parameters that help investors, mentors, and prospective hires understand what you build.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Startup Brand Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.startupName}
                    onChange={(e) => handleChange('startupName', e.target.value)}
                    placeholder="e.g. Nexora Health"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Legal Entity Structure
                  </label>
                  <select
                    value={formData.legalEntity}
                    onChange={(e) => handleChange('legalEntity', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Private Limited (Pvt Ltd)</option>
                    <option>Limited Liability Partnership (LLP)</option>
                    <option>Delaware C-Corp (US)</option>
                    <option>Sole Proprietorship</option>
                    <option>Pre-incorporation (Unregistered)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Elevator Pitch / Tagline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.tagline}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder="e.g. Autonomous clinical trial patient matching for oncology biotech"
                  className="field text-sm"
                />
                <span className="text-[11px] text-[#4A5568] mt-1 block">
                  Keep it under 100 characters. Visible on discovery pipelines.
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Primary Industry Vertical
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

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Team Size
                  </label>
                  <select
                    value={formData.teamSize}
                    onChange={(e) => handleChange('teamSize', e.target.value)}
                    className="field text-sm"
                  >
                    <option>1 Solo Founder</option>
                    <option>2-5 members</option>
                    <option>6-15 members</option>
                    <option>16-30 members</option>
                    <option>30+ members</option>
                  </select>
                </div>
              </div>

              {/* Stage selector cards */}
              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Current Operating Stage
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {STAGES.map((st) => {
                    const active = formData.stage === st.id;
                    return (
                      <div
                        key={st.id}
                        onClick={() => handleChange('stage', st.id)}
                        className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                          active
                            ? 'border-[#0F1B2D] bg-[#FAF8F4] ring-1 ring-[#0F1B2D]'
                            : 'border-[#E5E1D8] bg-white hover:border-[#9A7A45]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#0F1B2D]">{st.label}</span>
                          <span
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              active ? 'border-[#0F1B2D] bg-[#0F1B2D]' : 'border-[#E5E1D8]'
                            }`}
                          >
                            {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#4A5568]">{st.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Company Website / Demo Link
                </label>
                <div className="relative">
                  <Globe size={15} className="absolute left-3.5 top-3.5 text-[#4A5568]" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="https://nexorahealth.com"
                    className="field text-sm pl-10"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PRODUCT & TRACTION */}
          {step === 2 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 2 of 4 · Traction
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Product, Problem & Commercials
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Clarify the core friction point you are addressing and your commercial model.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Core Problem Statement <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.problemStatement}
                  onChange={(e) => handleChange('problemStatement', e.target.value)}
                  placeholder="What is broken in your industry today, and who suffers most from this problem?"
                  className="w-full rounded-xl border border-[#E5E1D8] bg-white p-3.5 text-sm text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Target Customer Segment
                  </label>
                  <select
                    value={formData.targetMarket}
                    onChange={(e) => handleChange('targetMarket', e.target.value)}
                    className="field text-sm"
                  >
                    <option>B2B Enterprise (Fortune 500 & Large)</option>
                    <option>B2B SMBs & Mid-Market</option>
                    <option>B2C Consumer (Mass Market)</option>
                    <option>B2B2C Hybrid Platform</option>
                    <option>Government & Public Sector</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Primary Revenue Model
                  </label>
                  <select
                    value={formData.revenueModel}
                    onChange={(e) => handleChange('revenueModel', e.target.value)}
                    className="field text-sm"
                  >
                    <option>SaaS Subscription (Monthly / Annual)</option>
                    <option>Usage / Consumption Based</option>
                    <option>Marketplace Commission / Take Rate</option>
                    <option>Direct Asset Sale / Hardware</option>
                    <option>Consulting + Software Retainer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Current Monthly Revenue (MRR)
                </label>
                <select
                  value={formData.mrrRange}
                  onChange={(e) => handleChange('mrrRange', e.target.value)}
                  className="field text-sm"
                >
                  {REVENUE_RANGES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-[#4A5568] mt-1 block">
                  Self-reported traction range used for matched investor filtering.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Live Product or Demo Walkthrough URL
                </label>
                <input
                  type="url"
                  value={formData.demoUrl}
                  onChange={(e) => handleChange('demoUrl', e.target.value)}
                  placeholder="e.g. https://app.nexorahealth.com or Loom walkthrough"
                  className="field text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 3: CAPITAL & FUNDRAISING */}
          {step === 3 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 3 of 4 · Financing
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Fundraising & Capital Strategy
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Indicate your fundraising appetite so angel networks and institutional VCs can discover your round.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Funding History to Date
                  </label>
                  <select
                    value={formData.fundingStatus}
                    onChange={(e) => handleChange('fundingStatus', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Bootstrapped (Founder Funded)</option>
                    <option>Friends & Family Round</option>
                    <option>Incubator / Grant Funded</option>
                    <option>Angel Round Raised</option>
                    <option>Pre-Seed / Institutional Seed</option>
                    <option>Series A+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Current Fundraising Status
                  </label>
                  <select
                    value={formData.activelyRaising}
                    onChange={(e) => handleChange('activelyRaising', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Yes — currently raising</option>
                    <option>Opening round in next 3–6 months</option>
                    <option>Opportunistic (Right partner only)</option>
                    <option>Not raising — profitable / self-sustained</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Target Raise Target
                </label>
                <input
                  type="text"
                  value={formData.targetAmount}
                  onChange={(e) => handleChange('targetAmount', e.target.value)}
                  placeholder="e.g. ₹2.0 Crores (~$240k) on SAFE / Convertible"
                  className="field text-sm"
                />
              </div>

              {/* Pitch deck box */}
              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Pitch Deck (URL or Document Link)
                </label>
                <div className="rounded-2xl border-2 border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-5 text-center">
                  <Upload size={22} className="mx-auto text-[#9A7A45]" />
                  <p className="mt-2 text-xs font-semibold text-[#0F1B2D]">
                    Provide your pitch deck link (DocSend, Google Drive, Pitch.com)
                  </p>
                  <p className="text-[11px] text-[#4A5568]">
                    You can restrict access to approved investors later in your Data Room.
                  </p>
                  <input
                    type="url"
                    value={formData.deckUrl}
                    onChange={(e) => handleChange('deckUrl', e.target.value)}
                    placeholder="https://docsend.com/view/..."
                    className="field mt-3 text-xs text-center max-w-md mx-auto"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: GOALS & DPIIT SETUP */}
          {step === 4 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 4 of 4 · Launch
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Ecosystem Priorities & DPIIT Setup
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Select what you want to achieve on Forma. We configure your home dashboard around these targets.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  What are your top priorities on Forma? (Select all that apply)
                </label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    'Raise Seed Funding',
                    'Find Specialized Mentors',
                    'Hire Core Founding Engineers',
                    'DPIIT Startup India Tax Exemption',
                    'Enterprise Customer Intros',
                    'Prepare Data Room & Due Diligence',
                  ].map((goal) => {
                    const selected = formData.goals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => toggleGoal(goal)}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-medium transition ${
                          selected
                            ? 'border-[#0F1B2D] bg-[#0F1B2D] text-white shadow-sm'
                            : 'border-[#E5E1D8] bg-[#FAF8F4] text-[#0F1B2D] hover:bg-white'
                        }`}
                      >
                        <CheckCircle2
                          size={15}
                          className={selected ? 'text-[#D4AF37]' : 'text-[#E5E1D8]'}
                        />
                        <span>{goal}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  DPIIT Startup India Recognition Status
                </label>
                <select
                  value={formData.dpiitStatus}
                  onChange={(e) => handleChange('dpiitStatus', e.target.value)}
                  className="field text-sm"
                >
                  <option>Recognized (Have DPIIT Certificate Number)</option>
                  <option>Applied / In Review with DPIIT</option>
                  <option>Not Yet Applied (Need guidance through Forma)</option>
                  <option>International Entity (Not applicable)</option>
                </select>
                <span className="text-[11px] text-[#4A5568] mt-1 block">
                  Forma provides an automated DPIIT filing readiness tool inside your workspace.
                </span>
              </div>

              <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-xs text-[#4A5568] space-y-1.5">
                <p className="font-semibold text-[#0F1B2D]">Summary before launch:</p>
                <p>
                  Startup: <strong className="text-[#0F1B2D]">{formData.startupName || 'Your Startup'}</strong> ({formData.sector} · {formData.stage})
                </p>
                <p>
                  Status: <strong>{formData.activelyRaising}</strong> ({formData.targetAmount || 'Target open'})
                </p>
              </div>
            </div>
          )}

          {/* Form Actions */}
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
              {step === STEPS.length ? 'Complete Setup & Launch' : 'Continue'}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>

      {/* Completion Modal */}
      {showCelebration && (
        <CelebrationModal
          role="startup"
          roleLabel="Startup Founder"
          dashboardUrl="/startup/dashboard"
          profileSummary={[
            { label: 'Startup Name', value: formData.startupName || 'New Venture' },
            { label: 'Vertical', value: formData.sector },
            { label: 'Stage', value: formData.stage.toUpperCase() },
            { label: 'Fundraising Goal', value: formData.targetAmount || 'Configured' },
          ]}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
