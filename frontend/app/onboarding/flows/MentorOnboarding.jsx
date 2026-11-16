'use client';

import React, { useState, useEffect } from 'react';
import StepProgress from '../components/StepProgress';
import CelebrationModal from '../components/CelebrationModal';
import {
  Lightbulb,
  Briefcase,
  Calendar,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Clock,
  Award,
} from 'lucide-react';

const STEPS = [
  { id: 'profile', title: 'Background', subtitle: 'Title, company & experience' },
  { id: 'expertise', title: 'Expertise', subtitle: 'Advisory pillars & stages' },
  { id: 'availability', title: 'Commitment', subtitle: 'Hours, formats & terms' },
  { id: 'code', title: 'Philosophy & Ethics', subtitle: 'Bio & confidentiality' },
];

const ADVISORY_PILLARS = [
  'Go-to-Market & Enterprise Sales',
  'Product-Market Fit & Discovery',
  'System Architecture & Engineering Scale',
  'Fundraising Strategy & Pitch Polish',
  'Executive Hiring & Culture Building',
  'Product Design & User Experience',
  'Unit Economics & Financial Modeling',
  'AI / LLM Integration in Production',
];

const STAGES = ['Idea & Problem Validation', 'Prototype / Seed Stage', 'Series A Growth & Scale'];

export default function MentorOnboarding() {
  const [step, setStep] = useState(1);
  const [showCelebration, setShowCelebration] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    headline: '',
    currentCompany: '',
    yearsExp: '11–15 years',
    linkedin: '',
    city: 'Bengaluru, India',
    // Step 2
    expertise: ['Product-Market Fit & Discovery', 'Go-to-Market & Enterprise Sales'],
    targetStages: ['Prototype / Seed Stage'],
    sectors: ['B2B SaaS', 'FinTech'],
    // Step 3
    hoursPerMonth: '2–4 hours / month',
    formats: ['1:1 Office Hours & Strategy Calls', 'Pitch Deck Review & Feedback'],
    compModel: 'Pro-Bono (Giving back to founders)',
    calendarUrl: '',
    // Step 4
    philosophy: '',
    acceptTerms: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('forma_onboarding_mentor');
      if (saved) setFormData((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('forma_onboarding_mentor', JSON.stringify(formData));
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
          {/* STEP 1: BACKGROUND */}
          {step === 1 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 1 of 4 · Identity & Credentials
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Mentor Profile & Background
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Introduce yourself to the founder community with your track record and experience.
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
                    placeholder="e.g. Vikram Malhotra"
                    className="field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Current Organization & Role
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.currentCompany}
                    onChange={(e) => handleChange('currentCompany', e.target.value)}
                    placeholder="e.g. VP of Product at FinScale (Ex-Razorpay)"
                    className="field text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Professional Headline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.headline}
                  onChange={(e) => handleChange('headline', e.target.value)}
                  placeholder="e.g. Scaling B2B SaaS from 0 to $10M ARR | 3x Venture-backed Advisor"
                  className="field text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Years of Operating Experience
                  </label>
                  <select
                    value={formData.yearsExp}
                    onChange={(e) => handleChange('yearsExp', e.target.value)}
                    className="field text-sm"
                  >
                    <option>5–7 years</option>
                    <option>8–10 years</option>
                    <option>11–15 years</option>
                    <option>16+ years (Veteran Executive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Base Location & Timezone
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="e.g. Bengaluru, India (IST)"
                    className="field text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  LinkedIn Profile URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={formData.linkedin}
                  onChange={(e) => handleChange('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="field text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 2: EXPERTISE */}
          {step === 2 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 2 of 4 · Expertise
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Advisory Superpowers & Focus
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Select the core domains where your advice creates the most leverage for founders.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Primary Advisory Domains (Choose up to 4)
                </label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {ADVISORY_PILLARS.map((pillar) => {
                    const selected = formData.expertise.includes(pillar);
                    return (
                      <button
                        key={pillar}
                        type="button"
                        onClick={() => toggleArrayItem('expertise', pillar)}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-medium transition ${
                          selected
                            ? 'border-[#0F1B2D] bg-[#0F1B2D] text-white'
                            : 'border-[#E5E1D8] bg-[#FAF8F4] text-[#0F1B2D] hover:bg-white'
                        }`}
                      >
                        <CheckCircle2
                          size={15}
                          className={selected ? 'text-[#D4AF37]' : 'text-[#E5E1D8]'}
                        />
                        <span>{pillar}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Best Startup Stages for Your Mentorship
                </label>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {STAGES.map((st) => {
                    const selected = formData.targetStages.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => toggleArrayItem('targetStages', st)}
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
            </div>
          )}

          {/* STEP 3: AVAILABILITY & FORMATS */}
          {step === 3 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 3 of 4 · Availability
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Time Commitment & Mentorship Structure
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Set clear boundaries around your schedule and how you prefer to engage with founders.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Monthly Time Availability
                  </label>
                  <select
                    value={formData.hoursPerMonth}
                    onChange={(e) => handleChange('hoursPerMonth', e.target.value)}
                    className="field text-sm"
                  >
                    <option>1 hour / month (Light touch)</option>
                    <option>2–4 hours / month (Standard)</option>
                    <option>5–8 hours / month (Hands-on)</option>
                    <option>Advisory Board (Scheduled quarterly)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                    Engagement Model
                  </label>
                  <select
                    value={formData.compModel}
                    onChange={(e) => handleChange('compModel', e.target.value)}
                    className="field text-sm"
                  >
                    <option>Pro-Bono (Giving back to founders)</option>
                    <option>Advisory Equity (FAST agreement / shares)</option>
                    <option>Hourly Consulting Fee</option>
                    <option>Open to discuss based on founder needs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-2">
                  Preferred Formats of Support
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    '1:1 Office Hours & Strategy Calls',
                    'Pitch Deck Review & Feedback',
                    'Hiring & Leadership Candidate Vetting',
                    'Asynchronous Q&A over Messages',
                    'Board / Formal Advisory Meetings',
                    'Introductions to VCs & Enterprise Clients',
                  ].map((fmt) => {
                    const selected = formData.formats.includes(fmt);
                    return (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => toggleArrayItem('formats', fmt)}
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
                        <span>{fmt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  Direct Booking / Calendar URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.calendarUrl}
                  onChange={(e) => handleChange('calendarUrl', e.target.value)}
                  placeholder="https://calendly.com/your-calendar"
                  className="field text-sm"
                />
                <span className="text-[11px] text-[#4A5568] mt-1 block">
                  Founders can request sessions based on your pre-set availability.
                </span>
              </div>
            </div>
          )}

          {/* STEP 4: PHILOSOPHY & ETHICS */}
          {step === 4 && (
            <div className="space-y-5 animate-enter">
              <div className="border-b border-[#E5E1D8] pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9A7A45]">
                  Step 4 of 4 · Ethics
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D] mt-1">
                  Advisory Philosophy & Founder Respect
                </h2>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  Help founders understand your mentoring style and confirm adherence to confidentiality.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F1B2D] mb-1.5">
                  How do you like to help founders? (Short Bio / Philosophy)
                </label>
                <textarea
                  rows={4}
                  value={formData.philosophy}
                  onChange={(e) => handleChange('philosophy', e.target.value)}
                  placeholder="e.g. I give direct, actionable feedback on product analytics and enterprise contracts. I respect founder time and keep sessions focused on immediate roadblocks."
                  className="w-full rounded-xl border border-[#E5E1D8] bg-white p-3.5 text-sm text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer text-xs text-[#0F1B2D]">
                  <input
                    type="checkbox"
                    required
                    checked={formData.acceptTerms}
                    onChange={(e) => handleChange('acceptTerms', e.target.checked)}
                    className="mt-0.5 rounded border-[#E5E1D8] text-[#9A7A45] focus:ring-[#9A7A45]"
                  />
                  <span>
                    <strong>Mentor Code of Conduct:</strong> I agree to uphold strict confidentiality
                    regarding unreleased pitch decks, proprietary code, metrics, and term sheets shared by
                    founders on Forma.
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
              {step === STEPS.length ? 'Activate Mentor Profile' : 'Continue'}
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>

      {showCelebration && (
        <CelebrationModal
          role="mentor"
          roleLabel="Ecosystem Mentor"
          dashboardUrl="/mentor/dashboard"
          profileSummary={[
            { label: 'Name', value: formData.fullName || 'Mentor' },
            { label: 'Focus', value: formData.expertise.slice(0, 2).join(', ') },
            { label: 'Model', value: formData.compModel },
            { label: 'Time', value: formData.hoursPerMonth },
          ]}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
