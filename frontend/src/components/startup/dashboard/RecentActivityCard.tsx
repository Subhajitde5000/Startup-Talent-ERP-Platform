'use client';

import React from 'react';
import { CheckCircle2, FileUp, MessageSquare, UserPlus } from 'lucide-react';
import { StartupActivityItem } from '@/types/startup';
import styles from './DashboardWidgets.module.css';

interface RecentActivityCardProps { items: StartupActivityItem[]; compact?: boolean; }
function getCategoryIcon(category: StartupActivityItem['category']) {
  const props = { size: 13, strokeWidth: 1.6, 'aria-hidden': true as const };
  switch (category) {
    case 'mentor': return <MessageSquare {...props} />;
    case 'team': return <UserPlus {...props} />;
    case 'document': return <FileUp {...props} />;
    default: return <CheckCircle2 {...props} />;
  }
}
function ActivityRows({ items }: { items: StartupActivityItem[] }) {
  return <>{items.slice(0, 6).map((item) => <div key={item.id} className={styles.activityItem}>
    <span className={styles.activityDot}>{getCategoryIcon(item.category)}</span>
    <div className={styles.activityContent}><span><strong>{item.actor}</strong> {item.action} <strong>{item.target}</strong></span><span className={styles.activityTime}>{item.timestamp}</span></div>
  </div>)}</>;
}
export function RecentActivityCard({ items, compact = false }: RecentActivityCardProps) {
  if (compact) return <div className={styles.activityListCompact} aria-label="Recent workspace activity"><ActivityRows items={items} /></div>;
  return <section className={styles.card} aria-label="Recent workspace activity">
    <div className={styles.cardHeader}><div className={styles.cardTitleGroup}><h3 className={styles.cardTitle}>Recent Activity</h3><p className={styles.cardSub}>Latest updates across team, documents, and milestones</p></div></div>
    <div className={styles.activityList}><ActivityRows items={items} /></div>
  </section>;
}
