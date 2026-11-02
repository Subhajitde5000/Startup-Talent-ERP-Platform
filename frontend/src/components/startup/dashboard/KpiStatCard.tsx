'use client';

import React from 'react';
import Link from 'next/link';
import styles from './DashboardWidgets.module.css';

interface KpiStatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  caption: string;
  icon: React.ReactNode;
  href?: string;
  linkLabel?: string;
}

export function KpiStatCard({
  label,
  value,
  unit,
  caption,
  icon,
  href,
  linkLabel,
}: KpiStatCardProps) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIconWrap} aria-hidden="true">
          {icon}
        </span>
      </div>

      <div className={styles.kpiValueRow}>
        <span className={styles.kpiValue}>{value}</span>
        {unit && <span className={styles.kpiUnit}>{unit}</span>}
      </div>

      <div className={styles.kpiFooter}>
        <span>{caption}</span>
        {href && linkLabel && (
          <Link href={href} className={styles.kpiLink}>
            {linkLabel}
          </Link>
        )}
      </div>
    </article>
  );
}
