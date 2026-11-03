'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from 'lucide-react';
import styles from './LoginForm.module.css';
import { SsoButtons, SsoProvider } from './SsoButtons';
import { TwoFactorStep } from './TwoFactorStep';
import { RoleSwitcherStep, UserRoleOption } from './RoleSwitcherStep';
import { PreviewScenario, StatePreviewBar } from './StatePreviewBar';

type FormStatus =
  | { type: 'none' }
  | { type: 'wrong_credentials' }
  | { type: 'too_many_attempts' }
  | { type: 'unverified_email' }
  | { type: 'verification_resent' }
  | { type: 'under_review' };

type ActiveStep = 'credentials' | 'two_factor' | 'role_switcher';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DEFAULT_MULTI_ROLES: UserRoleOption[] = [
  {
    id: 'founder',
    roleLabel: 'Founder',
    organization: 'Northstar Bio · Series A Workspace',
  },
  {
    id: 'mentor',
    roleLabel: 'Mentor',
    organization: 'Meridian Venture Fellows',
  },
];

export function LoginForm() {
  const router = useRouter();

  const [step, setStep] = useState<ActiveStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<FormStatus>({ type: 'none' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<SsoProvider | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [availableRoles, setAvailableRoles] =
    useState<UserRoleOption[]>(DEFAULT_MULTI_ROLES);
  const [activeScenario, setActiveScenario] =
    useState<PreviewScenario>('default');

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const validateEmailValue = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Enter your email address.';
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      return "That doesn't look like a valid email.";
    }
    return null;
  };

  const validatePasswordValue = (value: string): string | null => {
    if (!value) {
      return 'Enter your password.';
    }
    return null;
  };

  // Validate on blur, not on every keystroke (Section 7)
  const handleEmailBlur = () => {
    setEmailError(validateEmailValue(email));
  };

  const handlePasswordBlur = () => {
    setPasswordError(validatePasswordValue(password));
  };

  const handleResendVerification = async () => {
    if (isResending) return;
    setIsResending(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || 'user@company.com' }),
      });
      setFormStatus({ type: 'verification_resent' });
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || ssoLoading) return;

    if (formStatus.type === 'too_many_attempts') {
      return;
    }

    const nextEmailErr = validateEmailValue(email);
    const nextPasswordErr = validatePasswordValue(password);

    setEmailError(nextEmailErr);
    setPasswordError(nextPasswordErr);

    // Move focus to the first invalid field on submit (Section 7)
    if (nextEmailErr) {
      emailInputRef.current?.focus();
      return;
    }
    if (nextPasswordErr) {
      passwordInputRef.current?.focus();
      return;
    }

    setFormStatus({ type: 'none' });
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          keepSignedIn,
          attempts: failedAttempts,
        }),
      });

      const result = await response.json();

      if (result.state === 'wrong_credentials') {
        const nextCount = failedAttempts + 1;
        setFailedAttempts(nextCount);
        setFormStatus(
          nextCount >= 5
            ? { type: 'too_many_attempts' }
            : { type: 'wrong_credentials' }
        );
        setIsSubmitting(false);
        return;
      }

      if (result.state === 'too_many_attempts') {
        setFormStatus({ type: 'too_many_attempts' });
        setIsSubmitting(false);
        return;
      }

      if (result.state === 'unverified_email') {
        setFormStatus({ type: 'unverified_email' });
        setIsSubmitting(false);
        return;
      }

      if (result.state === 'under_review') {
        setFormStatus({ type: 'under_review' });
        setIsSubmitting(false);
        return;
      }

      if (result.state === 'two_factor') {
        setIsSubmitting(false);
        setStep('two_factor');
        setActiveScenario('two_factor');
        return;
      }

      if (result.state === 'multi_role' && Array.isArray(result.roles)) {
        setAvailableRoles(result.roles);
        setIsSubmitting(false);
        setStep('role_switcher');
        setActiveScenario('multi_role');
        return;
      }

      // Single-role user: redirect directly to role-based dashboard
      const targetRole = result.primaryRole || 'Founder';
      if (targetRole === 'Founder' || targetRole === 'Startup') {
        router.push('/startup/dashboard');
      } else {
        router.push(
          `/dashboard?role=${encodeURIComponent(targetRole)}&email=${encodeURIComponent(
            email.trim()
          )}`
        );
      }
    } catch {
      setFormStatus({ type: 'wrong_credentials' });
      setIsSubmitting(false);
    }
  };

  const handleSsoSelect = async (provider: SsoProvider) => {
    setSsoLoading(provider);
    setEmailError(null);
    setPasswordError(null);
    setFormStatus({ type: 'none' });

    await new Promise((resolve) => setTimeout(resolve, 650));

    const demoEmail =
      provider === 'google'
        ? 'claire.chen@northstar.bio'
        : provider === 'microsoft'
          ? 'claire.chen@meridian.vc'
          : 'claire.chen@talent.io';

    setEmail(demoEmail);
    setAvailableRoles(DEFAULT_MULTI_ROLES);
    setSsoLoading(null);
    setStep('role_switcher');
    setActiveScenario('multi_role');
  };

  const applyPreviewScenario = (scenario: PreviewScenario) => {
    setActiveScenario(scenario);
    setIsSubmitting(false);
    setSsoLoading(null);

    switch (scenario) {
      case 'default':
        setStep('credentials');
        setEmail('');
        setPassword('');
        setEmailError(null);
        setPasswordError(null);
        setFormStatus({ type: 'none' });
        setFailedAttempts(0);
        break;
      case 'empty_fields':
        setStep('credentials');
        setEmail('');
        setPassword('');
        setEmailError('Enter your email address.');
        setPasswordError('Enter your password.');
        setFormStatus({ type: 'none' });
        setTimeout(() => emailInputRef.current?.focus(), 20);
        break;
      case 'invalid_email':
        setStep('credentials');
        setEmail('founder@company');
        setPassword('••••••••••••');
        setEmailError("That doesn't look like a valid email.");
        setPasswordError(null);
        setFormStatus({ type: 'none' });
        setTimeout(() => emailInputRef.current?.focus(), 20);
        break;
      case 'wrong_credentials':
        setStep('credentials');
        setEmail('claire@northstar.bio');
        setPassword('incorrect-pass');
        setEmailError(null);
        setPasswordError(null);
        setFormStatus({ type: 'wrong_credentials' });
        break;
      case 'too_many_attempts':
        setStep('credentials');
        setEmail('claire@northstar.bio');
        setPassword('incorrect-pass');
        setEmailError(null);
        setPasswordError(null);
        setFormStatus({ type: 'too_many_attempts' });
        break;
      case 'unverified_email':
        setStep('credentials');
        setEmail('new.founder@stealth.ai');
        setPassword('••••••••••••');
        setEmailError(null);
        setPasswordError(null);
        setFormStatus({ type: 'unverified_email' });
        break;
      case 'under_review':
        setStep('credentials');
        setEmail('partner@horizonventures.com');
        setPassword('••••••••••••');
        setEmailError(null);
        setPasswordError(null);
        setFormStatus({ type: 'under_review' });
        break;
      case 'two_factor':
        if (!email) setEmail('claire@northstar.bio');
        setStep('two_factor');
        break;
      case 'multi_role':
        if (!email) setEmail('claire@northstar.bio');
        setAvailableRoles(DEFAULT_MULTI_ROLES);
        setStep('role_switcher');
        break;
    }
  };

  return (
    <>
      {step === 'two_factor' && (
        <TwoFactorStep
          email={email || 'claire@northstar.bio'}
          onVerified={() => {
            setStep('role_switcher');
            setActiveScenario('multi_role');
          }}
          onBack={() => {
            setStep('credentials');
            setActiveScenario('default');
          }}
        />
      )}

      {step === 'role_switcher' && (
        <RoleSwitcherStep
          email={email || 'claire@northstar.bio'}
          roles={availableRoles}
          onSelectRole={(role) => {
            if (role.roleLabel === 'Founder' || role.roleLabel === 'Startup') {
              router.push('/startup/dashboard');
              return;
            }
            router.push(
              `/dashboard?role=${encodeURIComponent(
                role.roleLabel
              )}&org=${encodeURIComponent(
                role.organization
              )}&email=${encodeURIComponent(email || 'claire@northstar.bio')}`
            );
          }}
          onSwitchAccount={() => {
            setStep('credentials');
            setPassword('');
            setActiveScenario('default');
          }}
        />
      )}

      {step === 'credentials' && (
        <div className={styles.formSections}>
          {/* 1 & 2. Title & Subtitle */}
          <header className={styles.header}>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>
              Sign in to continue to your workspace.
            </p>
          </header>

          {/* 3–8. SSO, Divider, and Email/Password Form */}
          <div className={styles.authBody}>
            <SsoButtons
              onSelectProvider={handleSsoSelect}
              loadingProvider={ssoLoading}
              disabled={isSubmitting || formStatus.type === 'too_many_attempts'}
            />

            <div className={styles.divider} role="separator">
              <span>or sign in with email</span>
            </div>

            {/* Form-level status / error banners with polite live region */}
            <div aria-live="polite" style={{ display: formStatus.type === 'none' ? 'none' : 'block' }}>
              {formStatus.type === 'wrong_credentials' && (
                <div
                  className={`${styles.statusBanner} ${styles.statusBannerError}`}
                  role="alert"
                >
                  <AlertCircle
                    size={16}
                    strokeWidth={1.5}
                    className={styles.statusIcon}
                    aria-hidden="true"
                  />
                  <span>Email or password is incorrect.</span>
                </div>
              )}

              {formStatus.type === 'too_many_attempts' && (
                <div
                  className={`${styles.statusBanner} ${styles.statusBannerError}`}
                  role="alert"
                >
                  <AlertCircle
                    size={16}
                    strokeWidth={1.5}
                    className={styles.statusIcon}
                    aria-hidden="true"
                  />
                  <span>
                    Too many attempts. Try again in 15 minutes or{' '}
                    <Link href="/forgot-password" className="accent-link">
                      reset your password
                    </Link>
                    .
                  </span>
                </div>
              )}

              {formStatus.type === 'unverified_email' && (
                <div className={styles.statusBanner}>
                  <Mail
                    size={16}
                    strokeWidth={1.5}
                    className={styles.statusIcon}
                    aria-hidden="true"
                  />
                  <span>
                    Please verify your email.
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isResending}
                      className={styles.inlineActionBtn}
                    >
                      {isResending ? 'Sending…' : 'Resend link'}
                    </button>
                  </span>
                </div>
              )}

              {formStatus.type === 'verification_resent' && (
                <div
                  className={`${styles.statusBanner} ${styles.statusBannerSuccess}`}
                >
                  <CheckCircle2
                    size={16}
                    strokeWidth={1.5}
                    className={styles.statusIcon}
                    aria-hidden="true"
                  />
                  <span>
                    Verification sent to {email || 'your email'}.{' '}
                    <Link
                      href={`/verify-email?from=login&email=${encodeURIComponent(
                        email || 'new.founder@stealth.ai'
                      )}`}
                      className="accent-link"
                    >
                      Confirm email
                    </Link>
                  </span>
                </div>
              )}

              {formStatus.type === 'under_review' && (
                <div className={styles.statusBanner}>
                  <Clock
                    size={16}
                    strokeWidth={1.5}
                    className={styles.statusIcon}
                    aria-hidden="true"
                  />
                  <span>
                    Your account is awaiting verification. We&apos;ll email you
                    once approved.
                  </span>
                </div>
              )}
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {/* 5. Email field */}
              <div className={styles.fieldGroup}>
                <div className={styles.labelRow}>
                  <label htmlFor="login-email" className={styles.label}>
                    Email
                  </label>
                </div>
                <div className={styles.inputWrapper}>
                  <input
                    ref={emailInputRef}
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleEmailBlur}
                    disabled={formStatus.type === 'too_many_attempts'}
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? 'login-email-error' : undefined}
                    className={`${styles.input} ${
                      emailError ? styles.inputError : ''
                    }`}
                  />
                </div>
                <div aria-live="polite" style={{ display: emailError ? 'block' : 'none' }}>
                  {emailError && (
                    <p id="login-email-error" className={styles.fieldError}>
                      <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                      <span>{emailError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* 6. Password field with show/hide toggle & Forgot password? link */}
              <div className={styles.fieldGroup}>
                <div className={styles.labelRow}>
                  <label htmlFor="login-password" className={styles.label}>
                    Password
                  </label>
                  <Link href="/forgot-password" className={styles.forgotLink}>
                    Forgot password?
                  </Link>
                </div>
                <div className={styles.inputWrapper}>
                  <input
                    ref={passwordInputRef}
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={handlePasswordBlur}
                    disabled={formStatus.type === 'too_many_attempts'}
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={
                      passwordError ? 'login-password-error' : undefined
                    }
                    className={`${styles.input} ${styles.inputWithAction} ${
                      passwordError ? styles.inputError : ''
                    }`}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff size={18} strokeWidth={1.5} aria-hidden="true" />
                    ) : (
                      <Eye size={18} strokeWidth={1.5} aria-hidden="true" />
                    )}
                  </button>
                </div>
                <div
                  aria-live="polite"
                  style={{ display: passwordError ? 'block' : 'none' }}
                >
                  {passwordError && (
                    <p id="login-password-error" className={styles.fieldError}>
                      <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                      <span>{passwordError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* 7. "Keep me signed in" checkbox */}
              <div className={styles.checkboxRow}>
                <label htmlFor="keep-signed-in" className={styles.checkboxLabel}>
                  <input
                    id="keep-signed-in"
                    name="keepSignedIn"
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              {/* 8. Primary button + Section 10 Security cue */}
              <div className={styles.submitBlock}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={
                    isSubmitting ||
                    ssoLoading !== null ||
                    formStatus.type === 'too_many_attempts'
                  }
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className={styles.spinner} aria-label="Signing in" />
                  ) : (
                    'Sign in'
                  )}
                </button>

                <div className={styles.securityCue}>
                  <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>Secure sign-in</span>
                </div>
              </div>
            </form>
          </div>

          {/* 9 & 10. Footer text & Fine print */}
          <footer className={styles.footer}>
            <p className={styles.createAccountPrompt}>
              New here?{' '}
              <Link href="/register" className={styles.createAccountLink}>
                Create an account
              </Link>
            </p>
            <p className={styles.finePrint}>
              By continuing you agree to our{' '}
              <Link href="/terms" className={styles.finePrintLink}>
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className={styles.finePrintLink}>
                Privacy Policy
              </Link>
              .
            </p>
          </footer>
        </div>
      )}

      <StatePreviewBar
        activeScenario={activeScenario}
        onSelectScenario={applyPreviewScenario}
      />
    </>
  );
}
