'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Landmark,
  Lock,
  UserCheck,
} from 'lucide-react';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { ThemeTogglePill } from '@/components/ThemeTogglePill';
import {
  OnboardingRole,
  REGISTRATION_DRAFT_KEY,
} from '@/lib/registrationDraft';
import styles from '../register.module.css';

const ROLE_OPTIONS: Array<{
  id: OnboardingRole;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'Startup',
    description: 'Manage fundraising, milestones, cap table and team hiring.',
    icon: <Building2 size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    id: 'Mentor',
    description: 'Advise founders, host office hours and guide cohorts.',
    icon: <Compass size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    id: 'Investor',
    description: 'Review deal flow, diligence rooms and portfolio updates.',
    icon: <Landmark size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    id: 'Job seeker',
    description: 'Explore vetted roles across high-conviction startups.',
    icon: <UserCheck size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    id: 'Employer',
    description: 'Recruit engineers, operators and founding team talent.',
    icon: <Briefcase size={18} strokeWidth={1.5} aria-hidden="true" />,
  },
];

export default function RegisterRolePage() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
  const [draftEmail, setDraftEmail] = useState('');
  const [draftName, setDraftName] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.email) setDraftEmail(parsed.email);
        if (parsed.fullName) setDraftName(parsed.fullName);
        if (parsed.emailVerified) setEmailVerified(Boolean(parsed.emailVerified));
        if (parsed.role) setSelectedRole(parsed.role);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const requiresReview =
    selectedRole === 'Investor' ||
    selectedRole === 'Mentor' ||
    selectedRole === 'Employer';

  const selectRole = (role: OnboardingRole) => {
    setSelectedRole(role);
    setError(null);
    try {
      const raw = window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      window.sessionStorage.setItem(
        REGISTRATION_DRAFT_KEY,
        JSON.stringify({ ...prev, role })
      );
    } catch {
      // Ignore storage errors
    }
  };

  const handleRadioKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (index + 1) % ROLE_OPTIONS.length;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (index - 1 + ROLE_OPTIONS.length) % ROLE_OPTIONS.length;
    }

    if (nextIndex !== null) {
      selectRole(ROLE_OPTIONS[nextIndex].id);
      optionRefs.current[nextIndex]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedRole) {
      setError('Select how you will use the platform.');
      optionRefs.current[0]?.focus();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/register/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          email: draftEmail,
          fullName: draftName,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.message || 'Unable to save your role right now.');
        setIsSubmitting(false);
        return;
      }

      try {
        const raw = window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
        const prev = raw ? JSON.parse(raw) : {};
        window.sessionStorage.setItem(
          REGISTRATION_DRAFT_KEY,
          JSON.stringify({
            ...prev,
            role: selectedRole,
          })
        );
      } catch {
        // Ignore storage errors
      }

      router.push(`/onboarding?role=${encodeURIComponent(selectedRole)}`);
    } catch {
      setError('Unable to complete setup right now. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className={styles.sections}>
        {/* Step 3 of 4 Indicator + Header */}
        <div className={styles.stepHeader}>
          <div className={styles.stepMeta} aria-label="Step 3 of 4: Workspace role">
            <div className={styles.stepLabelRow}>
              <span>Step 3 of 4</span>
              <span>Workspace role</span>
            </div>
            <div className={styles.stepTrack} aria-hidden="true">
              <span className={`${styles.stepSegment} ${styles.stepSegmentActive}`} />
              <span className={`${styles.stepSegment} ${styles.stepSegmentActive}`} />
              <span className={`${styles.stepSegment} ${styles.stepSegmentActive}`} />
              <span className={styles.stepSegment} />
            </div>
          </div>

          <header className={styles.header}>
            {emailVerified && draftEmail && (
              <span className={styles.verifiedPill}>
                <CheckCircle2 size={13} strokeWidth={1.75} aria-hidden="true" />
                <span>{draftEmail} confirmed</span>
              </span>
            )}
            <h1 className={styles.title}>How will you use the platform?</h1>
            <p className={styles.subtitle}>
              Choose your primary starting workspace. You can add more roles to
              your account later.
            </p>
          </header>
        </div>

        {/* Role Selection Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div
            className={styles.roleGrid}
            role="radiogroup"
            aria-label="How will you use the platform?"
            aria-describedby={error ? 'role-selection-error' : undefined}
          >
            {ROLE_OPTIONS.map((role, index) => {
              const isSelected = selectedRole === role.id;
              const tabIndex =
                isSelected || (selectedRole === null && index === 0) ? 0 : -1;

              return (
                <button
                  key={role.id}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={tabIndex}
                  onClick={() => selectRole(role.id)}
                  onKeyDown={(e) => handleRadioKeyDown(index, e)}
                  className={`${styles.roleOption} ${
                    isSelected ? styles.roleOptionSelected : ''
                  }`}
                >
                  <span className={styles.roleLeft}>
                    <span className={styles.roleIconBox}>{role.icon}</span>
                    <span className={styles.roleInfo}>
                      <span className={styles.roleName}>{role.id}</span>
                      <span className={styles.roleDesc}>{role.description}</span>
                    </span>
                  </span>

                  <span
                    className={`${styles.radioDot} ${
                      isSelected ? styles.radioDotActive : ''
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <span className={styles.radioDotInner} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div aria-live="polite" style={{ display: error ? 'block' : 'none' }}>
            {error && (
              <p id="role-selection-error" className={styles.fieldError}>
                <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {requiresReview && (
            <div className={styles.reviewNotice}>
              <Clock
                size={15}
                strokeWidth={1.5}
                style={{ flexShrink: 0, marginTop: '2px' }}
                aria-hidden="true"
              />
              <span>
                {selectedRole} profiles undergo a brief verification by our team
                so confidential rooms remain trusted.
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
                <span className={styles.spinner} aria-label="Saving role" />
              ) : (
                'Continue to onboarding'
              )}
            </button>

            <div className={styles.securityCue}>
              <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>One account, many roles</span>
            </div>
          </div>
        </form>

        {/* Back to Step 2 (/verify-email) */}
        <footer className={styles.footer}>
          <Link href="/verify-email" className={styles.footerLink}>
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
            <span>Back to email confirmation</span>
          </Link>
        </footer>
      </div>

      <ThemeTogglePill />
    </AuthSplitLayout>
  );
}
