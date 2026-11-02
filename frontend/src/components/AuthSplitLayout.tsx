import React from 'react';
import styles from './AuthSplitLayout.module.css';
import { BrandLogo } from './BrandLogo';

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  headline?: string;
  footerText?: string;
  maxWidth?: number;
}

export function AuthSplitLayout({
  children,
  headline = 'From first idea to funded company, and the team that builds it.',
  footerText = 'Mentors · Investors · Talent · Startups',
  maxWidth,
}: AuthSplitLayoutProps) {
  return (
    <div className={styles.shell}>
      {/* Left 45% Brand Panel (Desktop >= 1024px) */}
      <aside className={styles.brandPanel} aria-label="Platform overview">
        <div className={styles.brandPattern} aria-hidden="true" />

        <div className={styles.brandTop}>
          <BrandLogo variant="ivory" />
        </div>

        <div className={styles.brandCenter}>
          <div className={styles.goldRule} aria-hidden="true" />
          <p className={styles.brandHeadline}>{headline}</p>
        </div>

        <div className={styles.brandFooter}>{footerText}</div>
      </aside>

      {/* Right 55% Form Panel */}
      <main className={styles.formPanel}>
        <div
          className={styles.mobileBrandHeader}
          style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
        >
          <BrandLogo variant="ink" />
        </div>

        <div
          className={`${styles.formContainer} animate-form-enter`}
          style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
