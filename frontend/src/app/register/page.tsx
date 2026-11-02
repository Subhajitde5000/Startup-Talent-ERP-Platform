'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Eye, EyeOff, Lock } from 'lucide-react';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { SsoButtons, SsoProvider } from '@/components/SsoButtons';
import { ThemeTogglePill } from '@/components/ThemeTogglePill';
import { REGISTRATION_DRAFT_KEY } from '@/lib/registrationDraft';
import styles from './register.module.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<'none' | 'email_exists' | 'generic'>('none');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<SsoProvider | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Restore draft if user returns from /register/role
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.email) setEmail(parsed.email);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const hasMinLength = password.length >= 8;
  const hasNumberOrSymbol = /[\d\W_]/.test(password);

  const validateName = (value: string): string | null => {
    if (!value.trim()) return 'Enter your full name.';
    return null;
  };

  const validateEmail = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter your email address.';
    if (!EMAIL_REGEX.test(trimmed)) return "That doesn't look like a valid email.";
    return null;
  };

  const validatePassword = (value: string): string | null => {
    if (!value) return 'Create a password.';
    if (value.length < 8 || !/[\d\W_]/.test(value)) {
      return 'Use at least 8 characters with a number or symbol.';
    }
    return null;
  };

  const handleSsoSelect = async (provider: SsoProvider) => {
    if (isSubmitting || ssoLoading) return;
    setSsoLoading(provider);
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setBannerError('none');

    await new Promise((resolve) => setTimeout(resolve, 600));

    const demoEmail =
      provider === 'google'
        ? 'claire.chen@northstar.bio'
        : provider === 'microsoft'
          ? 'claire.chen@meridian.vc'
          : 'claire.chen@talent.io';

    try {
      window.sessionStorage.setItem(
        REGISTRATION_DRAFT_KEY,
        JSON.stringify({
          fullName: 'Claire Chen',
          email: demoEmail,
          method: provider,
          emailVerified: false,
        })
      );
    } catch {
      // Ignore storage errors
    }

    setSsoLoading(null);
    router.push('/verify-email');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || ssoLoading) return;

    const nextNameErr = validateName(fullName);
    const nextEmailErr = validateEmail(email);
    const nextPasswordErr = validatePassword(password);

    setNameError(nextNameErr);
    setEmailError(nextEmailErr);
    setPasswordError(nextPasswordErr);

    // Move focus to the first invalid field on submit
    if (nextNameErr) {
      nameInputRef.current?.focus();
      return;
    }
    if (nextEmailErr) {
      emailInputRef.current?.focus();
      return;
    }
    if (nextPasswordErr) {
      passwordInputRef.current?.focus();
      return;
    }

    setBannerError('none');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        if (result.code === 'email_exists') {
          setBannerError('email_exists');
          emailInputRef.current?.focus();
        } else if (result.field === 'fullName') {
          setNameError(result.message);
          nameInputRef.current?.focus();
        } else if (result.field === 'email') {
          setEmailError(result.message);
          emailInputRef.current?.focus();
        } else if (result.field === 'password') {
          setPasswordError(result.message);
          passwordInputRef.current?.focus();
        } else {
          setBannerError('generic');
        }
        setIsSubmitting(false);
        return;
      }

      try {
        window.sessionStorage.setItem(
          REGISTRATION_DRAFT_KEY,
          JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            method: 'email',
            emailVerified: false,
          })
        );
      } catch {
        // Ignore storage errors
      }

      router.push('/verify-email');
    } catch {
      setBannerError('generic');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className={styles.sections}>
        {/* Step 1 of 4 Indicator + Header */}
        <div className={styles.stepHeader}>
          <div className={styles.stepMeta} aria-label="Step 1 of 4: Account details">
            <div className={styles.stepLabelRow}>
              <span>Step 1 of 4</span>
              <span>Account details</span>
            </div>
            <div className={styles.stepTrack} aria-hidden="true">
              <span className={`${styles.stepSegment} ${styles.stepSegmentActive}`} />
              <span className={styles.stepSegment} />
              <span className={styles.stepSegment} />
              <span className={styles.stepSegment} />
            </div>
          </div>

          <header className={styles.header}>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>
              Start with your details. Next, you&apos;ll confirm your email and
              choose how you use the platform.
            </p>
          </header>
        </div>

        {/* SSO + Email Registration Form */}
        <div className={styles.authBody}>
          <SsoButtons
            onSelectProvider={handleSsoSelect}
            loadingProvider={ssoLoading}
            disabled={isSubmitting}
          />

          <div className={styles.divider} role="separator">
            <span>or register with email</span>
          </div>

          <div
            aria-live="polite"
            style={{ display: bannerError === 'none' ? 'none' : 'block' }}
          >
            {bannerError === 'email_exists' && (
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
                  An account with this email already exists.{' '}
                  <Link href="/" className="accent-link">
                    Sign in instead
                  </Link>
                  .
                </span>
              </div>
            )}

            {bannerError === 'generic' && (
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
                <span>Unable to continue right now. Please try again.</span>
              </div>
            )}
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {/* Full name */}
            <div className={styles.fieldGroup}>
              <label htmlFor="register-name" className={styles.label}>
                Full name
              </label>
              <div className={styles.inputWrapper}>
                <input
                  ref={nameInputRef}
                  id="register-name"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Claire Chen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => setNameError(validateName(fullName))}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? 'register-name-error' : undefined}
                  className={`${styles.input} ${
                    nameError ? styles.inputError : ''
                  }`}
                />
              </div>
              <div
                aria-live="polite"
                style={{ display: nameError ? 'block' : 'none' }}
              >
                {nameError && (
                  <p id="register-name-error" className={styles.fieldError}>
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{nameError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className={styles.fieldGroup}>
              <label htmlFor="register-email" className={styles.label}>
                Email
              </label>
              <div className={styles.inputWrapper}>
                <input
                  ref={emailInputRef}
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailError(validateEmail(email))}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'register-email-error' : undefined}
                  className={`${styles.input} ${
                    emailError ? styles.inputError : ''
                  }`}
                />
              </div>
              <div
                aria-live="polite"
                style={{ display: emailError ? 'block' : 'none' }}
              >
                {emailError && (
                  <p id="register-email-error" className={styles.fieldError}>
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{emailError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Password + Password rules (belong on sign-up/reset per Section 10) */}
            <div className={styles.fieldGroup}>
              <label htmlFor="register-password" className={styles.label}>
                Password
              </label>
              <div className={styles.inputWrapper}>
                <input
                  ref={passwordInputRef}
                  id="register-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPasswordError(validatePassword(password))}
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={
                    passwordError
                      ? 'register-password-error register-password-rules'
                      : 'register-password-rules'
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
                  <p id="register-password-error" className={styles.fieldError}>
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <ul
                id="register-password-rules"
                className={styles.passwordRules}
                aria-label="Password requirements"
              >
                <li
                  className={`${styles.ruleItem} ${
                    hasMinLength ? styles.ruleItemMet : ''
                  }`}
                >
                  {hasMinLength ? (
                    <Check size={13} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <span className={styles.ruleBullet} aria-hidden="true" />
                  )}
                  <span>8+ characters</span>
                </li>
                <li
                  className={`${styles.ruleItem} ${
                    hasNumberOrSymbol ? styles.ruleItemMet : ''
                  }`}
                >
                  {hasNumberOrSymbol ? (
                    <Check size={13} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <span className={styles.ruleBullet} aria-hidden="true" />
                  )}
                  <span>Number or symbol</span>
                </li>
              </ul>
            </div>

            <div className={styles.submitBlock}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isSubmitting || ssoLoading !== null}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <span className={styles.spinner} aria-label="Creating account" />
                ) : (
                  'Continue'
                )}
              </button>

              <div className={styles.securityCue}>
                <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
                <span>Secure sign-up</span>
              </div>
            </div>
          </form>
        </div>

        {/* Footer & Fine Print */}
        <footer className={styles.footer}>
          <p className={styles.footerPrompt}>
            Already have an account?{' '}
            <Link href="/" className={styles.footerLink}>
              Sign in
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

      <ThemeTogglePill />
    </AuthSplitLayout>
  );
}
