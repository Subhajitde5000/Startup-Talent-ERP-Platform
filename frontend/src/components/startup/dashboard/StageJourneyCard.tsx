'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { StartupStageDefinition, StartupStageId } from '@/types/startup';
import styles from './DashboardWidgets.module.css';

interface StageJourneyCardProps {
  currentStage: StartupStageId;
  stages: StartupStageDefinition[];
  onToggleCriterion: (stageId: StartupStageId, criterionId: string) => void;
}

export function StageJourneyCard({ currentStage, stages, onToggleCriterion }: StageJourneyCardProps) {
  const activeStage = stages.find((stage) => stage.id === currentStage) || stages[0];
  const completed = activeStage.exitCriteria.filter((item) => item.completed).length;
  const total = activeStage.exitCriteria.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <section className={styles.card} aria-labelledby="stage-focus-title">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <h2 id="stage-focus-title" className={styles.cardTitle}>Stage checklist: {activeStage.label}</h2>
          <p className={styles.cardSub}>{activeStage.shortSummary}</p>
        </div>
        <div className={styles.stageProgressMeta}>
          <strong>{completed} of {total} complete</strong>
          <div className={styles.progressBarTrack} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${completed} of ${total} ${activeStage.label} exit criteria complete`}><div className={styles.progressBarFill} style={{ width: `${percent}%` }} /></div>
        </div>
      </div>
      <div className={styles.criteriaList}>
        {activeStage.exitCriteria.map((criterion) => <div key={criterion.id} className={styles.criterionRow}>
          <label className={`${styles.criterionLabel} ${criterion.completed ? styles.criterionDone : ''}`}>
            <input type="checkbox" checked={criterion.completed} onChange={() => onToggleCriterion(activeStage.id, criterion.id)} className={styles.checkbox} />
            <span className={styles.criterionStatusIcon}>{criterion.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}</span>
            <span>{criterion.label}</span>
          </label>
          <Link href={criterion.moduleHref} className={styles.kpiLink}>Open <ArrowRight size={13} /></Link>
        </div>)}
      </div>
      <div className={styles.stageCardFooter}><span>Checklist items are illustrative workspace data; completion is not mentor approval.</span><Link href="/startup/stage" className={styles.textLink}>Open stage toolkit <ArrowRight size={14} /></Link></div>
    </section>
  );
}
