"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Lock } from "lucide-react";
import styles from "./TwoFactorStep.module.css";

interface TwoFactorStepProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

export function TwoFactorStep({ email, onVerified, onBack }: TwoFactorStepProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resentNotice, setResentNotice] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const submitCode = async (codeValue: string) => {
    if (codeValue.length < 6) {
      setError("Enter the 6-digit verification code.");
      const firstEmpty = digits.findIndex((d) => !d);
      inputsRef.current[firstEmpty >= 0 ? firstEmpty : 0]?.focus();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: codeValue }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || "Verification code is invalid or expired.");
        setIsSubmitting(false);
        inputsRef.current[0]?.focus();
        return;
      }

      onVerified();
    } catch {
      setError("Unable to verify code right now. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    // Handle multi-character input (e.g., mobile OTP autofill)
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

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setError(null);
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCode(digits.join(""));
  };

  return (
    <div className={`${styles.container} animate-form-enter`}>
      <header className={styles.header}>
        <h1 className={styles.title}>Two-step verification</h1>
        <p className={styles.subtitle}>
          Enter the six-digit code from your authenticator app for{" "}
          <span className={styles.emailHighlight}>{email || "your account"}</span>.
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.codeSection}>
          <label id="otp-group-label" className={styles.codeLabel}>
            Verification code
          </label>
          <div className={styles.otpGrid} role="group" aria-labelledby="otp-group-label">
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
                autoComplete={index === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${index + 1} of 6`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "otp-error" : "otp-helper"}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={`${styles.otpInput} ${error ? styles.otpInputError : ""}`}
              />
            ))}
          </div>

          <div aria-live="polite">
            {error ? (
              <p id="otp-error" className={styles.errorRow}>
                <AlertCircle size={15} strokeWidth={1.5} aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : resentNotice ? (
              <p id="otp-helper" className={styles.helperRow} style={{ color: "var(--success)" }}>
                Backup verification code sent to your email.
              </p>
            ) : (
              <p id="otp-helper" className={styles.helperRow}>
                You can type or paste your 6-digit security code.
              </p>
            )}
          </div>
        </div>

        <div>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <span className={styles.spinner} aria-label="Verifying code" />
            ) : (
              "Verify and continue"
            )}
          </button>

          <div className={styles.securityCue}>
            <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>Secure sign-in</span>
          </div>
        </div>
      </form>

      <div className={styles.footerRow}>
        <button type="button" onClick={onBack} className={styles.textBtn}>
          <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
          <span>Back to sign in</span>
        </button>

        <button type="button" onClick={() => setResentNotice(true)} className={styles.textBtn}>
          Send email code
        </button>
      </div>
    </div>
  );
}
