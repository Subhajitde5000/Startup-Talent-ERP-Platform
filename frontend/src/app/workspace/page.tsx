'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'Founder';
  const org = searchParams.get('org') || 'Meridian Workspace';
  const email = searchParams.get('email') || 'claire@northstar.bio';

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
              color: 'var(--success)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Authenticated · Role-routed session</span>
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
              {role} Workspace
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
              {org} &middot; Signed in as <strong>{email}</strong>
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
              One account, many roles: Meridian routes founders, mentors,
              investors, talent, employers, and administrators to their active
              workspace after sign-in without cluttering the login screen.
            </span>
          </div>

          <div>
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
              Return to login page
            </Link>
          </div>
        </div>
      </main>
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
