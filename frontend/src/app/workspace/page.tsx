'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, LogOut, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { ThemeTogglePill } from '@/components/ThemeTogglePill';

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'Founder';
  const org = searchParams.get('org') || 'Meridian Workspace';
  const email = searchParams.get('email') || 'claire@northstar.bio';
  const name = searchParams.get('name');
  const isWelcome = searchParams.get('welcome') === '1';

  const requiresReview =
    isWelcome &&
    (role === 'Investor' || role === 'Mentor' || role === 'Employer');

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--bg-page)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <BrandLogo variant="ink" />
        <Link
          href="/"
          className="accent-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            minHeight: '44px',
          }}
        >
          <LogOut size={15} strokeWidth={1.5} aria-hidden="true" />
          <span>Sign out</span>
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div
          className="animate-form-enter"
          style={{
            width: '100%',
            maxWidth: '520px',
            padding: '32px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: requiresReview ? 'var(--accent-text)' : 'var(--success)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {requiresReview ? (
              <>
                <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>Registration complete &middot; Verification pending</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  {isWelcome
                    ? 'Registration complete · Workspace ready'
                    : 'Authenticated · Role-routed session'}
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '28px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {isWelcome && name
                ? `Welcome, ${name}`
                : `${role} Workspace`}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
              {isWelcome ? (
                <>
                  Onboarded as <strong>{role}</strong> &middot;{' '}
                  <strong>{email}</strong>
                </>
              ) : (
                <>
                  {org} &middot; Signed in as <strong>{email}</strong>
                </>
              )}
            </p>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-page)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            <ShieldCheck
              size={18}
              strokeWidth={1.5}
              style={{ flexShrink: 0, marginTop: '1px', color: 'var(--accent)' }}
              aria-hidden="true"
            />
            <span>
              {requiresReview
                ? `Your ${role.toLowerCase()} account has been created and is awaiting verification. We'll email ${email} as soon as your profile is approved.`
                : 'One account, many roles: Meridian routes founders, mentors, investors, talent, employers, and administrators to their active workspace after sign-in without cluttering the login screen.'}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '48px',
                padding: '0 20px',
                backgroundColor: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                borderRadius: 'var(--radius)',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Return to sign in
            </Link>

            {isWelcome && (
              <Link
                href="/register/role"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '48px',
                  padding: '0 20px',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius)',
                  fontSize: '15px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Change role
              </Link>
            )}
          </div>
        </div>
      </main>

      <ThemeTogglePill />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceContent />
    </Suspense>
  );
}
