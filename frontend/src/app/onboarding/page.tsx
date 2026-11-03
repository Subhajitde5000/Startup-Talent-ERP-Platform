'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Landmark,
  Lock,
  Moon,
  SlidersHorizontal,
  Sun,
  UserCheck,
} from 'lucide-react';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { useTheme } from '@/components/ThemeProvider';
import {
  CompletedWorkspaceProfile,
  EmployerProfileData,
  InvestorProfileData,
  JobSeekerProfileData,
  MentorProfileData,
  OnboardingRole,
  REGISTRATION_DRAFT_KEY,
  StartupProfileData,
  USER_PROFILE_KEY,
} from '@/lib/registrationDraft';
import styles from './onboarding.module.css';

const ALL_ROLES: OnboardingRole[] = [
  'Startup',
  'Mentor',
  'Investor',
  'Job seeker',
  'Employer',
];

function parseRole(raw: string | null | undefined): OnboardingRole | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'startup' || normalized === 'founder') return 'Startup';
  if (normalized === 'mentor') return 'Mentor';
  if (normalized === 'investor') return 'Investor';
  if (normalized === 'job seeker' || normalized === 'job-seeker' || normalized === 'talent')
    return 'Job seeker';
  if (normalized === 'employer') return 'Employer';
  return null;
}

const ROLE_META: Record<
  OnboardingRole,
  {
    badge: string;
    title: string;
    subtitle: string;
    brandHeadline: string;
    cta: string;
    icon: React.ReactNode;
  }
> = {
  Startup: {
    badge: 'Startup workspace',
    title: 'Set up your startup profile',
    subtitle:
      'Tell us about your company so we can configure your fundraising, milestones and hiring modules.',
    brandHeadline:
      'Configure your company room, fundraising milestones, and founding team operations.',
    cta: 'Open startup dashboard',
    icon: <Building2 size={14} strokeWidth={1.75} aria-hidden="true" />,
  },
  Mentor: {
    badge: 'Mentor profile',
    title: 'Complete your mentor profile',
    subtitle:
      'Share your operating background and focus areas so founders can request high-signal office hours.',
    brandHeadline:
      'Share your operating experience to guide founders through pivotal inflection points.',
    cta: 'Open mentor dashboard',
    icon: <Compass size={14} strokeWidth={1.75} aria-hidden="true" />,
  },
  Investor: {
    badge: 'Investor workspace',
    title: 'Configure your thesis',
    subtitle:
      'Define your check size, stage and sector focus to personalize deal flow and diligence rooms.',
    brandHeadline:
      'Set your investment thesis and stage focus for quiet, high-conviction deal rooms.',
    cta: 'Open investor dashboard',
    icon: <Landmark size={14} strokeWidth={1.75} aria-hidden="true" />,
  },
  'Job seeker': {
    badge: 'Talent profile',
    title: 'Build your talent profile',
    subtitle:
      'Highlight your discipline, skills and stage preferences to match directly with vetted startups.',
    brandHeadline:
      'Match directly with founders and early teams building enduring companies.',
    cta: 'Open talent dashboard',
    icon: <UserCheck size={14} strokeWidth={1.75} aria-hidden="true" />,
  },
  Employer: {
    badge: 'Employer workspace',
    title: 'Set up your hiring profile',
    subtitle:
      'Outline your company stage and open disciplines to connect with startup-ready engineers and operators.',
    brandHeadline:
      'Build your founding and growth-stage team with curated startup talent.',
    cta: 'Open employer dashboard',
    icon: <Briefcase size={14} strokeWidth={1.75} aria-hidden="true" />,
  },
};

function toggleArrayItem(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  const queryRole = parseRole(searchParams.get('role'));

  const [activeRole, setActiveRole] = useState<OnboardingRole>(
    queryRole || 'Startup'
  );
  const [userName, setUserName] = useState('Claire Chen');
  const [userEmail, setUserEmail] = useState('claire@northstar.bio');
  const [previewOpen, setPreviewOpen] = useState(false);

  // 1. Startup state
  const [startup, setStartup] = useState<StartupProfileData>({
    companyName: '',
    oneLiner: '',
    stage: 'Idea',
    teamSize: '3–10',
    sector: 'AI & Infrastructure',
    priorities: ['Fundraising', 'Hiring talent'],
    website: '',
  });

  // 2. Mentor state
  const [mentor, setMentor] = useState<MentorProfileData>({
    headlineRole: '',
    experienceYears: '6–10 years',
    availability: '4 hrs / month',
    expertise: ['Go-to-market', 'Fundraising & pitch'],
    preferredStages: ['Idea / Pre-seed', 'Seed'],
    linkedinUrl: '',
  });

  // 3. Investor state
  const [investor, setInvestor] = useState<InvestorProfileData>({
    investorType: 'Venture Fund',
    firmName: '',
    checkSize: '$250k – $1M',
    targetStage: 'Seed',
    sectors: ['AI & Infrastructure', 'B2B SaaS'],
    credentialUrl: '',
  });

  // 4. Job seeker state
  const [jobSeeker, setJobSeeker] = useState<JobSeekerProfileData>({
    targetTitle: '',
    experienceYears: '3–5 years',
    workPreference: 'Hybrid',
    skills: ['Full-stack TypeScript', 'AI / ML'],
    preferredStages: ['Seed', 'Series A–B'],
    portfolioUrl: '',
  });

  // 5. Employer state
  const [employer, setEmployer] = useState<EmployerProfileData>({
    companyName: '',
    hiringLeadRole: '',
    companySize: '11–50',
    hiringTimeline: 'Immediate (this month)',
    openFunctions: ['Software Engineering', 'Product & Design'],
    companyWebsite: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (draft.fullName) setUserName(draft.fullName);
        if (draft.email) setUserEmail(draft.email);
        if (!queryRole && draft.role) {
          const parsed = parseRole(draft.role);
          if (parsed) setActiveRole(parsed);
        }
        if (draft.onboarding) {
          if (draft.onboarding.startup) setStartup(draft.onboarding.startup);
          if (draft.onboarding.mentor) setMentor(draft.onboarding.mentor);
          if (draft.onboarding.investor) setInvestor(draft.onboarding.investor);
          if (draft.onboarding.jobSeeker) setJobSeeker(draft.onboarding.jobSeeker);
          if (draft.onboarding.employer) setEmployer(draft.onboarding.employer);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [queryRole]);

  useEffect(() => {
    if (queryRole) {
      setActiveRole(queryRole);
      setErrors({});
    }
  }, [queryRole]);

  const meta = ROLE_META[activeRole];
  const requiresVerification =
    activeRole === 'Investor' ||
    activeRole === 'Mentor' ||
    activeRole === 'Employer';

  const switchRolePreview = (nextRole: OnboardingRole) => {
    setActiveRole(nextRole);
    setErrors({});
    setPreviewOpen(false);
    try {
      const raw = window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      window.sessionStorage.setItem(
        REGISTRATION_DRAFT_KEY,
        JSON.stringify({ ...prev, role: nextRole })
      );
    } catch {
      // Ignore storage errors
    }
  };

  const validateCurrentRole = (): Record<string, string> => {
    const nextErrors: Record<string, string> = {};

    if (activeRole === 'Startup') {
      if (!startup.companyName.trim()) {
        nextErrors.companyName = 'Enter your startup name.';
      }
      if (!startup.oneLiner.trim()) {
        nextErrors.oneLiner = 'Add a concise one-line description.';
      }
      if (startup.priorities.length === 0) {
        nextErrors.priorities = 'Select at least one priority.';
      }
    } else if (activeRole === 'Mentor') {
      if (!mentor.headlineRole.trim()) {
        nextErrors.headlineRole = 'Enter your current role and organization.';
      }
      if (mentor.expertise.length === 0) {
        nextErrors.expertise = 'Select at least one mentorship area.';
      }
      if (!mentor.linkedinUrl.trim()) {
        nextErrors.linkedinUrl = 'Provide your LinkedIn profile for verification.';
      }
    } else if (activeRole === 'Investor') {
      if (!investor.firmName.trim()) {
        nextErrors.firmName = 'Enter your fund, syndicate or entity name.';
      }
      if (investor.sectors.length === 0) {
        nextErrors.sectors = 'Select at least one sector in your thesis.';
      }
      if (!investor.credentialUrl.trim()) {
        nextErrors.credentialUrl = 'Provide your firm website or LinkedIn URL.';
      }
    } else if (activeRole === 'Job seeker') {
      if (!jobSeeker.targetTitle.trim()) {
        nextErrors.targetTitle = 'Enter your primary discipline or target role.';
      }
      if (jobSeeker.skills.length === 0) {
        nextErrors.skills = 'Select at least one core skill.';
      }
      if (!jobSeeker.portfolioUrl.trim()) {
        nextErrors.portfolioUrl = 'Add a link to your LinkedIn, GitHub or portfolio.';
      }
    } else if (activeRole === 'Employer') {
      if (!employer.companyName.trim()) {
        nextErrors.companyName = 'Enter your company name.';
      }
      if (!employer.hiringLeadRole.trim()) {
        nextErrors.hiringLeadRole = 'Enter your role or title.';
      }
      if (employer.openFunctions.length === 0) {
        nextErrors.openFunctions = 'Select at least one function you are hiring for.';
      }
      if (!employer.companyWebsite.trim()) {
        nextErrors.companyWebsite = 'Enter your company website.';
      }
    }

    return nextErrors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validateCurrentRole();
    setErrors(validationErrors);

    const firstInvalidKey = Object.keys(validationErrors)[0];
    if (firstInvalidKey) {
      const el = document.getElementById(`onboarding-${firstInvalidKey}`);
      el?.focus();
      return;
    }

    setIsSubmitting(true);

    const onboardingPayload = {
      startup: activeRole === 'Startup' ? startup : undefined,
      mentor: activeRole === 'Mentor' ? mentor : undefined,
      investor: activeRole === 'Investor' ? investor : undefined,
      jobSeeker: activeRole === 'Job seeker' ? jobSeeker : undefined,
      employer: activeRole === 'Employer' ? employer : undefined,
    };

    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: activeRole,
          email: userEmail,
          fullName: userName,
          onboarding: onboardingPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrors({ form: data.message || 'Unable to complete onboarding.' });
        setIsSubmitting(false);
        return;
      }

      const completedProfile: CompletedWorkspaceProfile = {
        fullName: userName,
        email: userEmail,
        role: activeRole,
        requiresVerification: Boolean(data.requiresVerification),
        completedAt: data.completedAt || new Date().toISOString(),
        onboarding: onboardingPayload,
      };

      try {
        window.localStorage.setItem(
          USER_PROFILE_KEY,
          JSON.stringify(completedProfile)
        );
        window.sessionStorage.removeItem(REGISTRATION_DRAFT_KEY);
      } catch {
        // Ignore storage errors
      }

      if (activeRole === 'Startup') {
        router.push('/startup/dashboard');
      } else {
        router.push(
          `/dashboard?role=${encodeURIComponent(
            activeRole
          )}&email=${encodeURIComponent(userEmail)}&welcome=1`
        );
      }
    } catch {
      setErrors({ form: 'Unable to save profile right now. Please try again.' });
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout headline={meta.brandHeadline} maxWidth={460}>
      <div className={styles.sections}>
        {/* Step 4 of 4 Indicator + Role Header */}
        <div className={styles.stepHeader}>
          <div
            className={styles.stepMeta}
            aria-label="Step 4 of 4: Role onboarding"
          >
            <div className={styles.stepLabelRow}>
              <span>Step 4 of 4</span>
              <span>Role onboarding</span>
            </div>
            <div className={styles.stepTrack} aria-hidden="true">
              <span className={styles.stepSegment} />
              <span className={styles.stepSegment} />
              <span className={styles.stepSegment} />
              <span className={styles.stepSegment} />
            </div>
          </div>

          <header className={styles.header}>
            <span className={styles.roleBadge}>
              {meta.icon}
              <span>{meta.badge}</span>
            </span>
            <h1 className={styles.title}>{meta.title}</h1>
            <p className={styles.subtitle}>{meta.subtitle}</p>
          </header>
        </div>

        {/* Role-Specific Onboarding Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* 1. STARTUP ONBOARDING */}
          {activeRole === 'Startup' && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="onboarding-companyName" className={styles.label}>
                  Startup name
                </label>
                <input
                  id="onboarding-companyName"
                  type="text"
                  placeholder="Northstar Bio"
                  value={startup.companyName}
                  onChange={(e) =>
                    setStartup({ ...startup, companyName: e.target.value })
                  }
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      companyName: startup.companyName.trim()
                        ? ''
                        : 'Enter your startup name.',
                    }))
                  }
                  aria-invalid={Boolean(errors.companyName)}
                  className={`${styles.input} ${
                    errors.companyName ? styles.inputError : ''
                  }`}
                />
                {errors.companyName && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.companyName}</span>
                  </p>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="onboarding-oneLiner" className={styles.label}>
                  One-line overview
                </label>
                <input
                  id="onboarding-oneLiner"
                  type="text"
                  placeholder="Programmable protein therapeutics for oncology"
                  value={startup.oneLiner}
                  onChange={(e) =>
                    setStartup({ ...startup, oneLiner: e.target.value })
                  }
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      oneLiner: startup.oneLiner.trim()
                        ? ''
                        : 'Add a concise one-line description.',
                    }))
                  }
                  aria-invalid={Boolean(errors.oneLiner)}
                  className={`${styles.input} ${
                    errors.oneLiner ? styles.inputError : ''
                  }`}
                />
                {errors.oneLiner && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.oneLiner}</span>
                  </p>
                )}
              </div>

              <div className={styles.rowTwoCol}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="onboarding-stage" className={styles.label}>
                    Current stage
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-stage"
                      value={startup.stage}
                      onChange={(e) =>
                        setStartup({ ...startup, stage: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="Idea">Idea</option>
                      <option value="Prototype">Prototype</option>
                      <option value="Early Revenue">Early Revenue</option>
                      <option value="Mature">Mature</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="onboarding-teamSize" className={styles.label}>
                    Team size
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-teamSize"
                      value={startup.teamSize}
                      onChange={(e) =>
                        setStartup({ ...startup, teamSize: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="1–2 founders">1–2 founders</option>
                      <option value="3–10">3–10</option>
                      <option value="11–25">11–25</option>
                      <option value="26–50">26–50</option>
                      <option value="50+">50+</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="onboarding-sector" className={styles.label}>
                  Primary sector
                </label>
                <div className={styles.selectWrapper}>
                  <select
                    id="onboarding-sector"
                    value={startup.sector}
                    onChange={(e) =>
                      setStartup({ ...startup, sector: e.target.value })
                    }
                    className={styles.select}
                  >
                    <option value="AI & Infrastructure">AI &amp; Infrastructure</option>
                    <option value="Biotech & Health">Biotech &amp; Health</option>
                    <option value="Fintech">Fintech</option>
                    <option value="Climate & Energy">Climate &amp; Energy</option>
                    <option value="B2B SaaS">B2B SaaS</option>
                    <option value="Hardware & Robotics">Hardware &amp; Robotics</option>
                  </select>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.5}
                    className={styles.selectChevron}
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Immediate workspace priorities</span>
                <div
                  id="onboarding-priorities"
                  tabIndex={-1}
                  className={styles.chipGrid}
                  role="group"
                  aria-label="Immediate workspace priorities"
                >
                  {[
                    'Fundraising',
                    'Hiring talent',
                    'Mentor advisory',
                    'Cap table & ops',
                    'Customer pilots',
                  ].map((item) => {
                    const selected = startup.priorities.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const next = toggleArrayItem(startup.priorities, item);
                          setStartup({ ...startup, priorities: next });
                          if (next.length > 0) {
                            setErrors((prev) => ({ ...prev, priorities: '' }));
                          }
                        }}
                        className={`${styles.chip} ${
                          selected ? styles.chipSelected : ''
                        }`}
                      >
                        {selected && (
                          <Check size={13} strokeWidth={2} aria-hidden="true" />
                        )}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.priorities && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.priorities}</span>
                  </p>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.labelRow}>
                  <label htmlFor="onboarding-website" className={styles.label}>
                    Company website
                  </label>
                  <span className={styles.optionalTag}>Optional</span>
                </div>
                <input
                  id="onboarding-website"
                  type="url"
                  placeholder="https://northstar.bio"
                  value={startup.website}
                  onChange={(e) =>
                    setStartup({ ...startup, website: e.target.value })
                  }
                  className={styles.input}
                />
              </div>
            </>
          )}

          {/* 2. MENTOR ONBOARDING */}
          {activeRole === 'Mentor' && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="onboarding-headlineRole" className={styles.label}>
                  Current role &amp; organization
                </label>
                <input
                  id="onboarding-headlineRole"
                  type="text"
                  placeholder="Operating Partner, Horizon Ventures"
                  value={mentor.headlineRole}
                  onChange={(e) =>
                    setMentor({ ...mentor, headlineRole: e.target.value })
                  }
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      headlineRole: mentor.headlineRole.trim()
                        ? ''
                        : 'Enter your current role and organization.',
                    }))
                  }
                  aria-invalid={Boolean(errors.headlineRole)}
                  className={`${styles.input} ${
                    errors.headlineRole ? styles.inputError : ''
                  }`}
                />
                {errors.headlineRole && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.headlineRole}</span>
                  </p>
                )}
              </div>

              <div className={styles.rowTwoCol}>
                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-experienceYears"
                    className={styles.label}
                  >
                    Operating experience
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-experienceYears"
                      value={mentor.experienceYears}
                      onChange={(e) =>
                        setMentor({ ...mentor, experienceYears: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="3–5 years">3–5 years</option>
                      <option value="6–10 years">6–10 years</option>
                      <option value="11–15 years">11–15 years</option>
                      <option value="15+ years">15+ years</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-availability"
                    className={styles.label}
                  >
                    Monthly availability
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-availability"
                      value={mentor.availability}
                      onChange={(e) =>
                        setMentor({ ...mentor, availability: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="2 hrs / month">2 hrs / month</option>
                      <option value="4 hrs / month">4 hrs / month</option>
                      <option value="6+ hrs / month">6+ hrs / month</option>
                      <option value="Cohort-based">Cohort-based</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Areas of mentorship</span>
                <div
                  id="onboarding-expertise"
                  tabIndex={-1}
                  className={styles.chipGrid}
                  role="group"
                  aria-label="Areas of mentorship"
                >
                  {[
                    'Go-to-market',
                    'Fundraising & pitch',
                    'Product strategy',
                    'Engineering & AI',
                    'Hiring & org design',
                    'Enterprise sales',
                  ].map((area) => {
                    const selected = mentor.expertise.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const next = toggleArrayItem(mentor.expertise, area);
                          setMentor({ ...mentor, expertise: next });
                          if (next.length > 0) {
                            setErrors((prev) => ({ ...prev, expertise: '' }));
                          }
                        }}
                        className={`${styles.chip} ${
                          selected ? styles.chipSelected : ''
                        }`}
                      >
                        {selected && (
                          <Check size={13} strokeWidth={2} aria-hidden="true" />
                        )}
                        <span>{area}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.expertise && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.expertise}</span>
                  </p>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Preferred startup stages</span>
                <div
                  className={styles.chipGrid}
                  role="group"
                  aria-label="Preferred startup stages"
                >
                  {['Idea / Pre-seed', 'Seed', 'Series A', 'Growth'].map(
                    (stage) => {
                      const selected = mentor.preferredStages.includes(stage);
                      return (
                        <button
                          key={stage}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setMentor({
                              ...mentor,
                              preferredStages: toggleArrayItem(
                                mentor.preferredStages,
                                stage
                              ),
                            })
                          }
                          className={`${styles.chip} ${
                            selected ? styles.chipSelected : ''
                          }`}
                        >
                          {selected && (
                            <Check size={13} strokeWidth={2} aria-hidden="true" />
                          )}
                          <span>{stage}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="onboarding-linkedinUrl" className={styles.label}>
                  LinkedIn profile
                </label>
                <input
                  id="onboarding-linkedinUrl"
                  type="url"
                  placeholder="https://linkedin.com/in/clairechen"
                  value={mentor.linkedinUrl}
                  onChange={(e) =>
                    setMentor({ ...mentor, linkedinUrl: e.target.value })
                  }
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      linkedinUrl: mentor.linkedinUrl.trim()
                        ? ''
                        : 'Provide your LinkedIn profile for verification.',
                    }))
                  }
                  aria-invalid={Boolean(errors.linkedinUrl)}
                  className={`${styles.input} ${
                    errors.linkedinUrl ? styles.inputError : ''
                  }`}
                />
                {errors.linkedinUrl && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.linkedinUrl}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {/* 3. INVESTOR ONBOARDING */}
          {activeRole === 'Investor' && (
            <>
              <div className={styles.rowTwoCol}>
                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-investorType"
                    className={styles.label}
                  >
                    Investor type
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-investorType"
                      value={investor.investorType}
                      onChange={(e) =>
                        setInvestor({ ...investor, investorType: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="Venture Fund">Venture Fund</option>
                      <option value="Angel Investor">Angel Investor</option>
                      <option value="Family Office">Family Office</option>
                      <option value="Syndicate / Accelerator">
                        Syndicate / Accelerator
                      </option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="onboarding-firmName" className={styles.label}>
                    Firm or entity name
                  </label>
                  <input
                    id="onboarding-firmName"
                    type="text"
                    placeholder="Meridian Capital"
                    value={investor.firmName}
                    onChange={(e) =>
                      setInvestor({ ...investor, firmName: e.target.value })
                    }
                    onBlur={() =>
                      setErrors((prev) => ({
                        ...prev,
                        firmName: investor.firmName.trim()
                          ? ''
                          : 'Enter your fund, syndicate or entity name.',
                      }))
                    }
                    aria-invalid={Boolean(errors.firmName)}
                    className={`${styles.input} ${
                      errors.firmName ? styles.inputError : ''
                    }`}
                  />
                  {errors.firmName && (
                    <p className={styles.fieldError} aria-live="polite">
                      <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                      <span>{errors.firmName}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.rowTwoCol}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="onboarding-checkSize" className={styles.label}>
                    Typical check size
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-checkSize"
                      value={investor.checkSize}
                      onChange={(e) =>
                        setInvestor({ ...investor, checkSize: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="$10k – $50k">$10k – $50k</option>
                      <option value="$50k – $250k">$50k – $250k</option>
                      <option value="$250k – $1M">$250k – $1M</option>
                      <option value="$1M – $5M">$1M – $5M</option>
                      <option value="$5M+">$5M+</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-targetStage"
                    className={styles.label}
                  >
                    Primary stage focus
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-targetStage"
                      value={investor.targetStage}
                      onChange={(e) =>
                        setInvestor({ ...investor, targetStage: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="Pre-seed">Pre-seed</option>
                      <option value="Seed">Seed</option>
                      <option value="Series A">Series A</option>
                      <option value="Multi-stage">Multi-stage</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Investment thesis sectors</span>
                <div
                  id="onboarding-sectors"
                  tabIndex={-1}
                  className={styles.chipGrid}
                  role="group"
                  aria-label="Investment thesis sectors"
                >
                  {[
                    'AI & Infrastructure',
                    'Fintech',
                    'Biotech & Health',
                    'Climate & Deep Tech',
                    'B2B SaaS',
                    'Developer Tools',
                  ].map((sector) => {
                    const selected = investor.sectors.includes(sector);
                    return (
                      <button
                        key={sector}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const next = toggleArrayItem(investor.sectors, sector);
                          setInvestor({ ...investor, sectors: next });
                          if (next.length > 0) {
                            setErrors((prev) => ({ ...prev, sectors: '' }));
                          }
                        }}
                        className={`${styles.chip} ${
                          selected ? styles.chipSelected : ''
                        }`}
                      >
                        {selected && (
                          <Check size={13} strokeWidth={2} aria-hidden="true" />
                        )}
                        <span>{sector}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.sectors && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.sectors}</span>
                  </p>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label
                  htmlFor="onboarding-credentialUrl"
                  className={styles.label}
                >
                  Firm website or LinkedIn
                </label>
                <input
                  id="onboarding-credentialUrl"
                  type="url"
                  placeholder="https://meridiancapital.vc"
                  value={investor.credentialUrl}
                  onChange={(e) =>
                    setInvestor({ ...investor, credentialUrl: e.target.value })
                  }
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      credentialUrl: investor.credentialUrl.trim()
                        ? ''
                        : 'Provide your firm website or LinkedIn URL.',
                    }))
                  }
                  aria-invalid={Boolean(errors.credentialUrl)}
                  className={`${styles.input} ${
                    errors.credentialUrl ? styles.inputError : ''
                  }`}
                />
                {errors.credentialUrl && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.credentialUrl}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {/* 4. JOB SEEKER ONBOARDING */}
          {activeRole === 'Job seeker' && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="onboarding-targetTitle" className={styles.label}>
                  Primary discipline or target role
                </label>
                <input
                  id="onboarding-targetTitle"
                  type="text"
                  placeholder="Founding Product Engineer"
                  value={jobSeeker.targetTitle}
                  onChange={(e) =>
                    setJobSeeker({ ...jobSeeker, targetTitle: e.target.value })
                  }
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      targetTitle: jobSeeker.targetTitle.trim()
                        ? ''
                        : 'Enter your primary discipline or target role.',
                    }))
                  }
                  aria-invalid={Boolean(errors.targetTitle)}
                  className={`${styles.input} ${
                    errors.targetTitle ? styles.inputError : ''
                  }`}
                />
                {errors.targetTitle && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.targetTitle}</span>
                  </p>
                )}
              </div>

              <div className={styles.rowTwoCol}>
                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-seekerExp"
                    className={styles.label}
                  >
                    Years of experience
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-seekerExp"
                      value={jobSeeker.experienceYears}
                      onChange={(e) =>
                        setJobSeeker({
                          ...jobSeeker,
                          experienceYears: e.target.value,
                        })
                      }
                      className={styles.select}
                    >
                      <option value="0–2 years">0–2 years</option>
                      <option value="3–5 years">3–5 years</option>
                      <option value="6–9 years">6–9 years</option>
                      <option value="10+ years">10+ years</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="onboarding-workPref" className={styles.label}>
                    Work preference
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-workPref"
                      value={jobSeeker.workPreference}
                      onChange={(e) =>
                        setJobSeeker({
                          ...jobSeeker,
                          workPreference: e.target.value,
                        })
                      }
                      className={styles.select}
                    >
                      <option value="Hybrid">Hybrid</option>
                      <option value="Remote">Remote</option>
                      <option value="On-site">On-site</option>
                      <option value="Flexible">Flexible</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Core skills &amp; stack</span>
                <div
                  id="onboarding-skills"
                  tabIndex={-1}
                  className={styles.chipGrid}
                  role="group"
                  aria-label="Core skills and stack"
                >
                  {[
                    'Full-stack TypeScript',
                    'Systems & Backend',
                    'AI / ML',
                    'Product Design',
                    'Product Management',
                    'Growth & GTM',
                    'Operations',
                  ].map((skill) => {
                    const selected = jobSeeker.skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const next = toggleArrayItem(jobSeeker.skills, skill);
                          setJobSeeker({ ...jobSeeker, skills: next });
                          if (next.length > 0) {
                            setErrors((prev) => ({ ...prev, skills: '' }));
                          }
                        }}
                        className={`${styles.chip} ${
                          selected ? styles.chipSelected : ''
                        }`}
                      >
                        {selected && (
                          <Check size={13} strokeWidth={2} aria-hidden="true" />
                        )}
                        <span>{skill}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.skills && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.skills}</span>
                  </p>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Preferred startup stages</span>
                <div
                  className={styles.chipGrid}
                  role="group"
                  aria-label="Preferred startup stages"
                >
                  {[
                    'Pre-seed / Founding',
                    'Seed',
                    'Series A–B',
                    'Growth',
                  ].map((stage) => {
                    const selected = jobSeeker.preferredStages.includes(stage);
                    return (
                      <button
                        key={stage}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setJobSeeker({
                            ...jobSeeker,
                            preferredStages: toggleArrayItem(
                              jobSeeker.preferredStages,
                              stage
                            ),
                          })
                        }
                        className={`${styles.chip} ${
                          selected ? styles.chipSelected : ''
                        }`}
                      >
                        {selected && (
                          <Check size={13} strokeWidth={2} aria-hidden="true" />
                        )}
                        <span>{stage}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label
                  htmlFor="onboarding-portfolioUrl"
                  className={styles.label}
                >
                  LinkedIn, GitHub or portfolio
                </label>
                <input
                  id="onboarding-portfolioUrl"
                  type="url"
                  placeholder="https://github.com/clairechen"
                  value={jobSeeker.portfolioUrl}
                  onChange={(e) =>
                    setJobSeeker({ ...jobSeeker, portfolioUrl: e.target.value })
                  }
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      portfolioUrl: jobSeeker.portfolioUrl.trim()
                        ? ''
                        : 'Add a link to your LinkedIn, GitHub or portfolio.',
                    }))
                  }
                  aria-invalid={Boolean(errors.portfolioUrl)}
                  className={`${styles.input} ${
                    errors.portfolioUrl ? styles.inputError : ''
                  }`}
                />
                {errors.portfolioUrl && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.portfolioUrl}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {/* 5. EMPLOYER ONBOARDING */}
          {activeRole === 'Employer' && (
            <>
              <div className={styles.rowTwoCol}>
                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-companyName"
                    className={styles.label}
                  >
                    Company name
                  </label>
                  <input
                    id="onboarding-companyName"
                    type="text"
                    placeholder="Vantage Systems"
                    value={employer.companyName}
                    onChange={(e) =>
                      setEmployer({ ...employer, companyName: e.target.value })
                    }
                    onBlur={() =>
                      setErrors((prev) => ({
                        ...prev,
                        companyName: employer.companyName.trim()
                          ? ''
                          : 'Enter your company name.',
                      }))
                    }
                    aria-invalid={Boolean(errors.companyName)}
                    className={`${styles.input} ${
                      errors.companyName ? styles.inputError : ''
                    }`}
                  />
                  {errors.companyName && (
                    <p className={styles.fieldError} aria-live="polite">
                      <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                      <span>{errors.companyName}</span>
                    </p>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-hiringLeadRole"
                    className={styles.label}
                  >
                    Your role / title
                  </label>
                  <input
                    id="onboarding-hiringLeadRole"
                    type="text"
                    placeholder="Head of Talent"
                    value={employer.hiringLeadRole}
                    onChange={(e) =>
                      setEmployer({
                        ...employer,
                        hiringLeadRole: e.target.value,
                      })
                    }
                    onBlur={() =>
                      setErrors((prev) => ({
                        ...prev,
                        hiringLeadRole: employer.hiringLeadRole.trim()
                          ? ''
                          : 'Enter your role or title.',
                      }))
                    }
                    aria-invalid={Boolean(errors.hiringLeadRole)}
                    className={`${styles.input} ${
                      errors.hiringLeadRole ? styles.inputError : ''
                    }`}
                  />
                  {errors.hiringLeadRole && (
                    <p className={styles.fieldError} aria-live="polite">
                      <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                      <span>{errors.hiringLeadRole}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.rowTwoCol}>
                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-companySize"
                    className={styles.label}
                  >
                    Company size
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-companySize"
                      value={employer.companySize}
                      onChange={(e) =>
                        setEmployer({ ...employer, companySize: e.target.value })
                      }
                      className={styles.select}
                    >
                      <option value="1–10">1–10</option>
                      <option value="11–50">11–50</option>
                      <option value="51–200">51–200</option>
                      <option value="200+">200+</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label
                    htmlFor="onboarding-hiringTimeline"
                    className={styles.label}
                  >
                    Hiring timeline
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="onboarding-hiringTimeline"
                      value={employer.hiringTimeline}
                      onChange={(e) =>
                        setEmployer({
                          ...employer,
                          hiringTimeline: e.target.value,
                        })
                      }
                      className={styles.select}
                    >
                      <option value="Immediate (this month)">
                        Immediate (this month)
                      </option>
                      <option value="This quarter">This quarter</option>
                      <option value="Building pipeline">Building pipeline</option>
                    </select>
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className={styles.selectChevron}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Functions you are hiring for</span>
                <div
                  id="onboarding-openFunctions"
                  tabIndex={-1}
                  className={styles.chipGrid}
                  role="group"
                  aria-label="Functions you are hiring for"
                >
                  {[
                    'Software Engineering',
                    'AI & Data',
                    'Product & Design',
                    'Sales & GTM',
                    'Operations & Finance',
                    'Executive / Founding',
                  ].map((fn) => {
                    const selected = employer.openFunctions.includes(fn);
                    return (
                      <button
                        key={fn}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          const next = toggleArrayItem(employer.openFunctions, fn);
                          setEmployer({ ...employer, openFunctions: next });
                          if (next.length > 0) {
                            setErrors((prev) => ({ ...prev, openFunctions: '' }));
                          }
                        }}
                        className={`${styles.chip} ${
                          selected ? styles.chipSelected : ''
                        }`}
                      >
                        {selected && (
                          <Check size={13} strokeWidth={2} aria-hidden="true" />
                        )}
                        <span>{fn}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.openFunctions && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.openFunctions}</span>
                  </p>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label
                  htmlFor="onboarding-companyWebsite"
                  className={styles.label}
                >
                  Company website
                </label>
                <input
                  id="onboarding-companyWebsite"
                  type="url"
                  placeholder="https://vantagesystems.io"
                  value={employer.companyWebsite}
                  onChange={(e) =>
                    setEmployer({ ...employer, companyWebsite: e.target.value })
                  }
                  onBlur={() =>
                    setErrors((prev) => ({
                      ...prev,
                      companyWebsite: employer.companyWebsite.trim()
                        ? ''
                        : 'Enter your company website.',
                    }))
                  }
                  aria-invalid={Boolean(errors.companyWebsite)}
                  className={`${styles.input} ${
                    errors.companyWebsite ? styles.inputError : ''
                  }`}
                />
                {errors.companyWebsite && (
                  <p className={styles.fieldError} aria-live="polite">
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{errors.companyWebsite}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {errors.form && (
            <p className={styles.fieldError} role="alert">
              <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>{errors.form}</span>
            </p>
          )}

          {requiresVerification && (
            <div className={styles.reviewNotice}>
              <Clock
                size={15}
                strokeWidth={1.5}
                style={{ flexShrink: 0, marginTop: '2px' }}
                aria-hidden="true"
              />
              <span>
                Your {activeRole.toLowerCase()} workspace will open in preview
                mode while our team verifies your credentials.
              </span>
            </div>
          )}

          <div className={styles.submitBlock}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className={styles.spinner} aria-label="Opening workspace" />
              ) : (
                meta.cta
              )}
            </button>

            <div className={styles.securityCue}>
              <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>Workspace details can be updated anytime</span>
            </div>
          </div>
        </form>

        {/* Back to Step 3 (/register/role) */}
        <footer className={styles.footer}>
          <Link href="/register/role" className={styles.footerLink}>
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
            <span>Change role</span>
          </Link>
        </footer>
      </div>

      {/* Discreet corner switcher to preview all 5 role onboarding variants */}
      <div className={styles.previewCorner}>
        {previewOpen && (
          <div
            className={styles.previewPopover}
            role="dialog"
            aria-label="Preview role onboarding forms"
          >
            <div className={styles.previewTitle}>Preview role form</div>
            {ALL_ROLES.map((role) => {
              const active = activeRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => switchRolePreview(role)}
                  className={`${styles.previewRoleBtn} ${
                    active ? styles.previewRoleActive : ''
                  }`}
                >
                  <span>{role}</span>
                  {active && (
                    <span className={styles.previewDot} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.pillBar}>
          <button
            type="button"
            className={styles.pillBtn}
            onClick={() => setPreviewOpen((prev) => !prev)}
            aria-expanded={previewOpen}
          >
            <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>Role: {activeRole}</span>
          </button>

          <button
            type="button"
            className={styles.iconPillBtn}
            onClick={toggleTheme}
            aria-label={
              theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            }
          >
            {theme === 'light' ? (
              <Moon size={15} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Sun size={15} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </AuthSplitLayout>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}
