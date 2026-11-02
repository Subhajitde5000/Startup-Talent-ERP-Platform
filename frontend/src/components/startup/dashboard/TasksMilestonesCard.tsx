'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { StartupStageId, StartupTaskItem } from '@/types/startup';
import styles from './DashboardWidgets.module.css';

type TaskTab = 'mine' | 'team' | 'milestones';
interface TasksMilestonesCardProps {
  tasks: StartupTaskItem[];
  currentStage: StartupStageId;
  founderName: string;
  onToggleTask: (taskId: string) => void;
  onAddTaskClick: () => void;
}

export function TasksMilestonesCard({ tasks, founderName, onToggleTask, onAddTaskClick }: TasksMilestonesCardProps) {
  const [tab, setTab] = useState<TaskTab>('mine');
  const rows = useMemo(() => {
    if (tab === 'milestones') return tasks.filter((task) => task.isMilestone);
    if (tab === 'mine') return tasks.filter((task) => task.owner === founderName);
    return tasks;
  }, [tasks, tab, founderName]);
  const milestones = tasks.filter((task) => task.isMilestone && task.status !== 'completed');
  const tabItems: Array<{ id: TaskTab; label: string }> = [
    { id: 'mine', label: 'My tasks' }, { id: 'team', label: 'Team' }, { id: 'milestones', label: 'Milestones' },
  ];
  return (
    <section className={styles.card} aria-labelledby="tasks-card-title">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}><h2 id="tasks-card-title" className={styles.cardTitle}>Tasks &amp; milestones</h2><p className={styles.cardSub}>Keep the next actions moving.</p></div>
        <button type="button" onClick={onAddTaskClick} className={styles.secondaryActionBtn}><Plus size={14} /> New task</button>
      </div>
      <div className={styles.taskTabs} role="group" aria-label="Task views">
        {tabItems.map((item) => <button key={item.id} aria-pressed={tab === item.id} type="button" onClick={() => setTab(item.id)} className={`${styles.taskTab} ${tab === item.id ? styles.taskTabActive : ''}`}>{item.label}<span>{item.id === 'mine' ? tasks.filter((task) => task.owner === founderName && task.status !== 'completed').length : item.id === 'team' ? tasks.filter((task) => task.status !== 'completed').length : tasks.filter((task) => task.isMilestone).length}</span></button>)}
      </div>
      {tab === 'milestones' && <div className={styles.milestoneTimeline} aria-label="Upcoming milestone timeline">{milestones.length ? milestones.slice(0, 3).map((task, index) => <div key={task.id} className={`${styles.timelineItem} ${index === 0 ? styles.timelineNext : ''}`}><span className={styles.timelineMarker} /><span className={styles.timelineTitle}>{task.title}</span><small>{task.dueLabel}</small></div>) : <span className={styles.inlineEmpty}>No upcoming milestones. Add a task and mark it as a milestone.</span>}</div>}
      {rows.length ? <div className={styles.taskList}>{rows.slice(0, 5).map((task) => {
        const done = task.status === 'completed';
        const overdue = task.status === 'overdue';
        return <div key={task.id} className={styles.taskRow}>
          <div className={styles.taskLeft}><input id={`task-${task.id}`} type="checkbox" checked={done} onChange={() => onToggleTask(task.id)} className={styles.taskCheck} aria-label={`Mark “${task.title}” as ${done ? 'incomplete' : 'complete'}`} /><div className={styles.taskBody}><label htmlFor={`task-${task.id}`} className={`${styles.taskTitle} ${done ? styles.taskTitleDone : ''}`}>{task.title}</label><div className={styles.taskMetaRow}><span className={styles.taskAssignee}><span className={styles.miniAvatar}>{task.owner.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>{task.owner}</span><span aria-hidden="true">·</span><Link href={task.moduleHref} className={styles.moduleTag}>{task.moduleLabel}</Link>{task.isMilestone && <span className={styles.milestoneChip}>Milestone</span>}</div></div></div>
          <span className={`${styles.statusBadge} ${overdue ? styles.statusOverdue : done ? styles.statusCompleted : ''}`}>{overdue ? task.dueLabel : done ? 'Done' : task.dueLabel}</span>
        </div>;
      })}</div> : <div className={styles.emptyState}>No tasks in this view yet. Add a task to define the next action.</div>}
      <div className={styles.cardFooter}><Link href="/startup/projects" className={styles.textLink}>View all tasks <ArrowRight size={14} /></Link><span className={styles.dataNote}>Task list reflects current workspace sample data.</span></div>
    </section>
  );
}
