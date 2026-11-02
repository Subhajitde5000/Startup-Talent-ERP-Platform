import React from 'react';
import styles from './AuthSplitLayout.module.css';
import { BrandLogo } from './BrandLogo';

interface AuthSplitLayoutProps {
  children: React.ReactNode;
}

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
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
          <p className={styles.brandHeadline}>
            From first idea to funded company, and the team that builds it.
          </p>
        </div>

        <div className={styles.brandFooter}>
          Mentors &middot; Investors &middot; Talent &middot; Startups
        </div>
      </aside>

      {/* Right 55% Form Panel */}
      <main className={styles.formPanel}>
        <div className={styles.mobileBrandHeader}>
          <BrandLogo variant="ink" />
        </div>

        <div className={`${styles.formContainer} animate-form-enter`}>
          {children}
        </div>
      </main>
    </div>
  );
}
