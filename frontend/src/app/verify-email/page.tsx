'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { ThemeTogglePill } from '@/components/ThemeTogglePill';
import { REGISTRATION_DRAFT_KEY } from '@/lib/registrationDraft';
import styles from '../register/register.module.css';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryEmail = searchParams.get('email') || '';
  const fromLogin = searchParams.get('from') === 'login';

  const [email, setEmail] = useState(queryEmail);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resentSuccess, setResentSuccess] = useState(false);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!queryEmail && parsed.email) {
          setEmail(parsed.email);
        }
      }
    } catch {
      // Ignore storage errors
    }
    inputsRef.current[0]?.focus();
  }, [queryEmail]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 6 - index && i < clean.length; i++) {
        next[index + i] = clean[i];
      }
      setDigits(next);
      setError(null);
      const focusIdx = Math.min(index + clean.length, 5);
      inputsRef.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean[0];
    setDigits(next);
    if (error) setError(null);

    if (index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setError(null);
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  const handleResend = async () => {
    if (isResending || resendCooldown > 0) return;
    setIsResending(true);
    setError(null);

    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || 'user@company.com' }),
      });
      setResentSuccess(true);
      setResendCooldown(30);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const code = digits.join('');
    if (code.length < 6) {
      setError('Enter the 6-digit verification code.');
      const firstEmpty = digits.findIndex((d) => !d);
      inputsRef.current[firstEmpty >= 0 ? firstEmpty : 0]?.focus();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(
          result.message || 'That verification code is invalid or expired.'
        );
        setIsSubmitting(false);
        inputsRef.current[0]?.focus();
        return;
      }

      try {
        const raw = window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY);
        const prev = raw ? JSON.parse(raw) : {};
        window.sessionStorage.setItem(
          REGISTRATION_DRAFT_KEY,
          JSON.stringify({
            ...prev,
            email: email || prev.email,
            emailVerified: true,
          })
        );
      } catch {
        // Ignore storage errors
      }

      if (fromLogin) {
        router.push(
          `/workspace?email=${encodeURIComponent(email || 'user@company.com')}`
        );
      } else {
        router.push('/register/role');
      }
    } catch {
      setError('Unable to confirm your email right now. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className={styles.sections}>
        {/* Step 2 of 3 Indicator (hidden only if arriving from login unverified banner) */}
        <div className={styles.stepHeader}>
          {!fromLogin && (
            <div
              className={styles.stepMeta}
              aria-label="Step 2 of 3: Confirm email"
            >
              <div className={styles.stepLabelRow}>
                <span>Step 2 of 3</span>
                <span>Confirm email</span>
              </div>
              <div className={styles.stepTrack} aria-hidden="true">
                <span
                  className={`${styles.stepSegment} ${styles.stepSegmentActive}`}
                />
                <span
                  className={`${styles.stepSegment} ${styles.stepSegmentActive}`}
                />
                <span className={styles.stepSegment} />
              </div>
            </div>
          )}

          <header className={styles.header}>
            <h1 className={styles.title}>Confirm your email</h1>
            <p className={styles.subtitle}>
              We sent a six-digit verification code to{' '}
              <strong>{email || 'your email address'}</strong>. Enter it below
              to confirm your account.
            </p>
          </header>
        </div>

        {/* 6-Digit Verification Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <label id="verify-email-code-label" className={styles.label}>
              Verification code
            </label>

            <div
              className={styles.otpGrid}
              role="group"
              aria-labelledby="verify-email-code-label"
            >
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputsRef.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${index + 1} of 6`}
                  aria-invalid={Boolean(error)}
                  aria-describedby={
                    error ? 'verify-email-error' : 'verify-email-helper'
                  }
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className={`${styles.otpInput} ${
                    error ? styles.otpInputError : ''
                  }`}
                />
              ))}
            </div>

            <div aria-live="polite">
              {error ? (
                <p id="verify-email-error" className={styles.fieldError}>
                  <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>{error}</span>
                </p>
              ) : resentSuccess ? (
                <p id="verify-email-helper" className={styles.successText}>
                  <CheckCircle2 size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    New verification code sent to {email || 'your inbox'}.
                  </span>
                </p>
              ) : (
                <p id="verify-email-helper" className={styles.helperText}>
                  Type or paste the 6-digit code from your email.
                </p>
              )}
            </div>
          </div>

          <div className={styles.submitBlock}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className={styles.spinner} aria-label="Confirming email" />
              ) : (
                'Confirm email'
              )}
            </button>

            <div className={styles.securityCue}>
              <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>Secure verification</span>
            </div>
          </div>
        </form>

        {/* Resend & Back navigation */}
        <footer className={styles.footer}>
          <p className={styles.footerPrompt}>
            Didn&apos;t receive the code?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className={styles.resendBtn}
            >
              {isResending
                ? 'Sending…'
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend code'}
            </button>
          </p>

          <Link
            href={fromLogin ? '/' : '/register'}
            className={styles.footerLink}
          >
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
            <span>{fromLogin ? 'Back to sign in' : 'Change email address'}</span>
          </Link>
        </footer>
      </div>

      <ThemeTogglePill />
    </AuthSplitLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
