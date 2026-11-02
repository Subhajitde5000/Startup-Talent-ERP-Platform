'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import styles from './signup.module.css';

type OnboardingRole =
  | 'Startup'
  | 'Mentor'
  | 'Investor'
  | 'Job seeker'
  | 'Employer';

const ROLES: Array<{ id: OnboardingRole; description: string }> = [
  { id: 'Startup', description: 'Manage fundraising, cap table, milestones and hiring.' },
  { id: 'Mentor', description: 'Advise founders, track office hours and cohort progress.' },
  { id: 'Investor', description: 'Review deal flow, portfolio updates and diligence.' },
  { id: 'Job seeker', description: 'Explore vetted roles across high-conviction startups.' },
  { id: 'Employer', description: 'Recruit operators, engineers and founding team talent.' },
];

export default function SignUpPage() {
  const [step, setStep] = useState<'role' | 'details' | 'complete'>('role');
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>('Startup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const requiresReview =
    selectedRole === 'Investor' ||
    selectedRole === 'Mentor' ||
    selectedRole === 'Employer';

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("That doesn't look like a valid email.");
      return;
    }
    if (password.length < 10) {
      setError('Use at least 10 characters for your password.');
      return;
    }
    setError(null);
    setStep('complete');
  };

  return (
    <AuthSplitLayout>
      <div className={styles.container}>
        {step === 'role' && (
          <>
            <header className={styles.header}>
              <h1 className={styles.title}>How will you use the platform?</h1>
              <p className={styles.subtitle}>
                Choose your primary starting workspace. You can add additional
                roles to the same account later.
              </p>
            </header>

            <div className={styles.roleGrid} role="radiogroup" aria-label="Onboarding role">
              {ROLES.map((role) => {
                const active = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelectedRole(role.id)}
                    className={`${styles.roleOption} ${
                      active ? styles.roleOptionSelected : ''
                    }`}
                  >
                    <span className={styles.roleInfo}>
                      <span className={styles.roleName}>{role.id}</span>
                      <span className={styles.roleDesc}>{role.description}</span>
                    </span>
                    <span
                      className={`${styles.radioDot} ${
                        active ? styles.radioDotActive : ''
                      }`}
                      aria-hidden="true"
                    >
                      {active && <span className={styles.radioDotInner} />}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setStep('details')}
            >
              Continue
            </button>

            <footer className={styles.footer}>
              <p>
                Already have an account?{' '}
                <Link href="/" className="accent-link">
                  Sign in
                </Link>
              </p>
            </footer>
          </>
        )}

        {step === 'details' && (
          <>
            <header className={styles.header}>
              <h1 className={styles.title}>Create your account</h1>
              <p className={styles.subtitle}>
                Onboarding as <strong>{selectedRole}</strong>.
              </p>
            </header>

            <form className={styles.form} onSubmit={handleDetailsSubmit} noValidate>
              <div className={styles.fieldGroup}>
                <label htmlFor="signup-name" className={styles.label}>
                  Full name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Claire Chen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="signup-email" className={styles.label}>
                  Work email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="signup-password" className={styles.label}>
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                />
                {/* Password rules belong on sign-up and reset per Section 10 */}
                <p className={styles.passwordRules}>
                  Minimum 10 characters with a mix of letters and numbers.
                </p>
              </div>

              {error && (
                <p className={styles.fieldError} role="alert">
                  <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>{error}</span>
                </p>
              )}

              <button type="submit" className={styles.primaryButton}>
                Create account
              </button>
            </form>

            <footer className={styles.footer}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('role');
                }}
                className="accent-link"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '44px',
                }}
              >
                <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
                <span>Change role selection</span>
              </button>
            </footer>
          </>
        )}

        {step === 'complete' && (
          <>
            <header className={styles.header}>
              <h1 className={styles.title}>Check your inbox</h1>
              <p className={styles.subtitle}>
                We sent a verification link to <strong>{email}</strong>.
              </p>
            </header>

            <div className={styles.confirmationBox}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--success)',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <CheckCircle2 size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>Account created for {selectedRole}</span>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {requiresReview
                  ? 'Because you registered as an institutional participant, our team will briefly verify your profile after email confirmation.'
                  : 'Confirm your email address to enter your Meridian workspace immediately.'}
              </p>
            </div>

            <Link
              href="/"
              className={styles.primaryButton}
              style={{ textDecoration: 'none' }}
            >
              Return to sign in
            </Link>
          </>
        )}
      </div>
    </AuthSplitLayout>
  );
}
