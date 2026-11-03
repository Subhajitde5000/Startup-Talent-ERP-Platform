'use client';

import React from 'react';
import { CalendarClock } from 'lucide-react';
import { AssignedMentorInfo } from '@/types/startup';
import styles from './DashboardWidgets.module.css';

interface MentorSectionCardProps {
  mentor: AssignedMentorInfo;
  onRequestSession: () => void;
}

function getInitials(name: string): string {
  const cleaned = name.replace(/^Dr\.\s+/i, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function MentorSectionCard({
  mentor,
  onRequestSession,
}: MentorSectionCardProps) {
  return (
    <section className={styles.card} aria-label="Assigned mentor and advisory">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <h3 className={styles.cardTitle}>Lead Mentor</h3>
          <p className={styles.cardSub}>{mentor.organization}</p>
        </div>

        <button
          type="button"
          onClick={onRequestSession}
          className={styles.secondaryActionBtn}
          style={{ height: 34, padding: '0 12px', fontSize: '12.5px' }}
        >
          Request session
        </button>
      </div>

      <div className={styles.mentorBody}>
        <div className={styles.mentorProfile}>
          <span className={styles.mentorAvatar} aria-hidden="true">
            {getInitials(mentor.name)}
          </span>
          <div className={styles.mentorInfo}>
            <span className={styles.mentorName}>{mentor.name}</span>
            <span className={styles.mentorTitle}>{mentor.title}</span>
          </div>
        </div>

        {mentor.nextSession && (
          <div className={styles.sessionBox}>
            <div className={styles.sessionTop}>
              <span>
                <CalendarClock
                  size={13}
                  strokeWidth={1.6}
                  style={{ verticalAlign: '-2px', marginRight: 5 }}
                  aria-hidden="true"
                />
                Next advisory session
              </span>
              <span>{mentor.nextSession.status}</span>
            </div>
            <span className={styles.sessionTopic}>
              {mentor.nextSession.topic}
            </span>
            <span className={styles.sessionTime}>
              {mentor.nextSession.dateLabel} · {mentor.nextSession.timeLabel}
            </span>
          </div>
        )}

        <blockquote className={styles.mentorQuote}>
          “{mentor.latestNote}”
          <span className={styles.mentorQuoteMeta}>
            Latest mentor note · {mentor.latestNoteDate}
          </span>
        </blockquote>
      </div>
    </section>
  );
}
