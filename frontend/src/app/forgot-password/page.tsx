'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import styles from '../signup/signup.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return "That doesn't look like a valid email.";
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err);
    if (err) return;
    setSubmitted(true);
  };

  return (
    <AuthSplitLayout>
      <div className={styles.container}>
        {!submitted ? (
          <>
            <header className={styles.header}>
              <h1 className={styles.title}>Reset your password</h1>
              <p className={styles.subtitle}>
                Enter the email address associated with your account and
                we&apos;ll send a secure reset link.
              </p>
            </header>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.fieldGroup}>
                <label htmlFor="reset-email" className={styles.label}>
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setError(validateEmail(email))}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'reset-email-error' : undefined}
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                />
                {error && (
                  <p id="reset-email-error" className={styles.fieldError}>
                    <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{error}</span>
                  </p>
                )}
              </div>

              <button type="submit" className={styles.primaryButton}>
                Send reset link
              </button>
            </form>

            <footer className={styles.footer}>
              <Link
                href="/"
                className="accent-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  minHeight: '44px',
                }}
              >
                <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
                <span>Back to sign in</span>
              </Link>
            </footer>
          </>
        ) : (
          <>
            <header className={styles.header}>
              <h1 className={styles.title}>Check your email</h1>
              <p className={styles.subtitle}>
                If an account exists for <strong>{email}</strong>, a password
                reset link is on its way.
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
                <span>Reset instructions sent</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                For your security, reset links expire after 30 minutes.
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
