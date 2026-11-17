'use client';

import React, { useState, useEffect } from 'react';
import StepProgress from '../components/StepProgress';
import CelebrationModal from '../components/CelebrationModal';
import { useAuth } from '@/lib/auth-context';
import {
  initialStepFor,
  saveOnboardingCompleted,
  saveOnboardingStep,
} from '@/lib/onboarding-progress';
import {
  Briefcase,
  DollarSign,
  PieChart,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Sliders,
} from 'lucide-react';

const STEPS = [
  { id: 'entity', title: 'Investor Entity', subtitle: 'Type, fund & accreditation' },
  { id: 'thesis', title: 'Check Sizes & Stage', subtitle: 'Ticket size, stages & lead' },
  { id: 'sectors', title: 'Sectors & Value', subtitle: 'Target verticals & value-add' },
  { id: 'dealflow', title: 'Dealflow & SLA', subtitle: 'Inflow method & turnaround' },
];

const SECTORS = [
  'B2B Enterprise SaaS',
  'FinTech & Infrastructure',
  'AI / ML & Foundational Models',
  'HealthTech & Bio',
  'Climate & Clean Energy',
  'Consumer Tech & Marketplaces',
  'DeepTech, Semiconductor & Robotics',
  'Supply Chain & Mobility',
];

const STAGES = ['Pre-Seed', 'Seed', 'Pre-Series A', 'Series A', 'Series B+'];

const VALUE_ADDS = [
  'Follow-on VC Introductions',
  'First 10 Enterprise Customer Contracts',
  'C-Suite & Founding Engineer Hiring',
  'Pricing & GTM Strategy',
  'DPIIT & Indian Regulatory Navigation',
  'US Expansion & Delaware Flip Support',
];

export default function InvestorOnboarding() {
  const { user } = useAuth();
  const [step, setStep] = useState(() => initialStepFor(user, STEPS));
  const [showCelebration, setShowCelebration] = useState(false);

  const [formData, setFormData] = useState({
    investorName: '',
    investorType: 'Venture Capital Firm (VC)',
    firmName: '',
    fundSize: '₹100 Cr – ₹500 Cr ($12M – $60M)',
    website: '',
    // Step 2
    checkSize: '₹50 Lakhs – ₹2.5 Crores ($60k – $300k)',
    stages: ['Seed', 'Pre-Series A'],
    leadPreference: 'Lead investor with board seat',
    geography: 'India & South Asia',
    // Step 3
    sectors: ['B2B Enterprise SaaS', 'FinTech & Infrastructure', 'AI / ML & Foundational Models'],
    valueAdds: ['Follow-on VC Introductions', 'First 10 Enterprise Customer Contracts'],
    portfolioCount: '6–15 companies',
    // Step 4
    dealflowMode: 'Curated Forma Platform Intros Only',
    turnaround: '2–3 weeks standard diligence',
    accredited: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('forma_onboarding_investor');
      if (saved) setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('forma_onboarding_investor', JSON.stringify(formData));
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
      saveOnboardingStep(STEPS[step].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      saveOnboardingCompleted();
      setShowCelebration(true);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
      saveOnboardingStep(STEPS[step - 2].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      <StepProgress steps={STEPS} currentStep={step} onStepClick={setStep} />

      <div className="rounded-3xl border border-[#E5E1D8] bg-white p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleNext} className="space-y-6">
          {/* STEP 1: ENTITY */}
          {step === 1 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 1 of 4 · Investor Identity
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Investor Vehicle & Profile
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Specify your investment vehicle, fund capacity, and primary entity details.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Managing Partner / Individual Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.investorName}
                    onChange={(e) => handleChange('investorName', e.target.value)}
                    placeholder="e.g. Arjun Singhania"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Investor Entity Type
                  </label>
                  <select
                    value={formData.investorType}
                    onChange={(e) => handleChange('investorType', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Venture Capital Firm (VC)</option>
                    <option>Angel Investor / High Net Worth</option>
                    <option>Family Office</option>
                    <option>Corporate Venture Capital (CVC)</option>
                    <option>Angel Syndicate / Micro-Fund</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Firm / Fund / Syndicate Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firmName}
                    onChange={(e) => handleChange('firmName', e.target.value)}
                    placeholder="e.g. Elevation Apex Capital"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Fund Size / Dedicated Capital Pool
                  </label>
                  <select
                    value={formData.fundSize}
                    onChange={(e) => handleChange('fundSize', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Micro-fund / Syndicate (&lt; ₹50 Cr / $6M)</option>
                    <option>₹50 Cr – ₹200 Cr ($6M – $25M)</option>
                    <option>₹200 Cr – ₹800 Cr ($25M – $100M)</option>
                    <option>₹800 Cr+ ($100M+ Growth Fund)</option>
                    <option>Personal Angel Allocation (&lt; ₹10 Cr)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Firm Website / LinkedIn URL
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://apexcapital.vc"
                  className="field text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2: THESIS & CHECKS */}
          {step === 2 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 2 of 4 · Thesis
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Ticket Sizes, Stages & Leadership
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Define your sweet spot so founders pitch you only when parameters match.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Typical Initial Check / Ticket Size
                  </label>
                  <select
                    value={formData.checkSize}
                    onChange={(e) => handleChange('checkSize', e.target.value)}
                    className="field text-sm"
                  >
                    <option>₹10 Lakhs – ₹30 Lakhs ($15k – $35k Angel)</option>
                    <option>₹30 Lakhs – ₹1.5 Crores ($35k – $180k Pre-Seed)</option>
                    <option>₹1.5 Crores – ₹5 Crores ($180k – $600k Seed)</option>
                    <option>₹5 Crores – ₹25 Crores ($600k – $3M Series A)</option>
                    <option>₹25 Crores+ ($3M+ Growth Stage)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Lead vs. Follow Policy
                  </label>
                  <select
                    value={formData.leadPreference}
                    onChange={(e) => handleChange('leadPreference', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Lead investor with board seat</option>
                    <option>Co-lead with another institutional fund</option>
                    <option>Follow-on participant (No board seat required)</option>
                    <option>Flexible depending on round structure</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Target Investment Stages (Select all that apply)
                </label>
                <div className="grid gap-2.5 sm:grid-cols-5">
                  {STAGES.map((st) => {
                    const selected = formData.stages.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => toggleArrayItem('stages', st)}
                        className={`rounded-xl border p-3 text-center text-xs font-semibold transition ${
                          selected
                            ? 'border-[#0F1B2D] bg-[#0F1B2D] text-white shadow-sm'
                            : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:border-[#9A7A45]'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Target Geography
                </label>
                <select
                  value={formData.geography}
                  onChange={(e) => handleChange('geography', e.target.value)}
                  className="field text-sm"
                >
                  <option>India & South Asia</option>
                  <option>Southeast Asia (Singapore, Indonesia, Vietnam)</option>
                  <option>US & Global Cross-Border Startups</option>
                  <option>Any Geography (Remote First)</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 3: SECTORS & VALUE-ADD */}
          {step === 3 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 3 of 4 · Value Proposition
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Sectors of Conviction & Value-Add
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Highlight your thematic focus and what unfair advantage you provide founders beyond capital.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Primary Sectors of Interest
                </label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {SECTORS.map((sec) => {
                    const selected = formData.sectors.includes(sec);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => toggleArrayItem('sectors', sec)}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-xs transition ${
                          selected
                            ? 'border-[#0F1B2D] bg-[#0F1B2D] text-white'
                            : 'border-[#E5E1D8] bg-[#FAF8F4] text-[#0F1B2D] hover:bg-white'
                        }`}
                      >
                        <CheckCircle2
                          size={14}
                          className={selected ? 'text-[#D4AF37]' : 'text-[#E5E1D8]'}
                        />
                        <span>{sec}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Key Value-Add to Portfolio Companies
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {VALUE_ADDS.map((va) => {
                    const selected = formData.valueAdds.includes(va);
                    return (
                      <button
                        key={va}
                        type="button"
                        onClick={() => toggleArrayItem('valueAdds', va)}
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
                        <span>{va}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Current Portfolio Count
                </label>
                <select
                  value={formData.portfolioCount}
                  onChange={(e) => handleChange('portfolioCount', e.target.value)}
                  className="field text-sm"
                >
                  <option>0–5 companies (Early stage portfolio)</option>
                  <option>6–15 companies</option>
                  <option>16–30 companies</option>
                  <option>30+ active portfolio investments</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 4: DEALFLOW & SLA */}
          {step === 4 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 4 of 4 · Dealflow
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Inflow Preferences & Diligence SLA
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Control deal volume and how startup applications reach your investment committee.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Preferred Deal Inflow Channel
                  </label>
                  <select
                    value={formData.dealflowMode}
                    onChange={(e) => handleChange('dealflowMode', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Curated Forma Platform Intros Only (Filtered)</option>
                    <option>Open Pitch Deck Submissions (Direct Data Room)</option>
                    <option>Syndicate Lead & Angel Network Referrals</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Typical Diligence & Decision Turnaround
                  </label>
                  <select
                    value={formData.turnaround}
                    onChange={(e) => handleChange('turnaround', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Fast track (Within 7–10 days)</option>
                    <option>2–3 weeks standard diligence</option>
                    <option>30 days deep diligence & reference checks</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer text-xs text-[#0F1B2D]">
                  <input
                    type="checkbox"
                    required
                    checked={formData.accredited}
                    onChange={(e) => handleChange('accredited', e.target.checked)}
                    className="mt-0.5 rounded border-[#E5E1D8] text-[#9A7A45] focus:ring-[#9A7A45]"
                  />
                  <span>
                    <strong>Accredited Investor Declaration:</strong> I confirm that I or my firm qualify
                    as an accredited investor / institutional fund eligible to participate in private
                    securities under applicable securities regulations.
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
              {step === STEPS.length ? 'Access Investor Dealflow' : 'Continue'}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>

      {showCelebration && (
        <CelebrationModal
          role="investor"
          roleLabel="Venture Investor"
          dashboardUrl="/investor/dashboard"
          profileSummary={[
            { label: 'Firm', value: formData.firmName || 'Angel Portfolio' },
            { label: 'Ticket', value: formData.checkSize },
            { label: 'Stages', value: formData.stages.join(', ') },
            { label: 'Inflow', value: formData.dealflowMode },
          ]}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
