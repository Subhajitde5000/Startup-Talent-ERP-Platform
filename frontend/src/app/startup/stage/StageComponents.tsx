'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BarChart3, Check, CheckCircle2, Circle, CircleHelp, ClipboardCheck,
  FileText, FlaskConical, FolderOpen, Handshake, Lightbulb, Link2, LockKeyhole,
  MessageSquare, Plus, Rocket, Search, Send, ShieldCheck, Users, X,
} from 'lucide-react';
import { StageToolDefinition, StageToolkitDefinition } from '@/config/stageToolkits';
import { AssignedMentorInfo, StartupStageDefinition, StartupStageId } from '@/types/startup';
import { CriterionReview, StageEvidence, StageWorkflowState } from '@/hooks/useStageWorkflow';
import styles from './StagePages.module.css';

const STAGE_PATHS: Record<StartupStageId, string> = {
  idea: '/startup/stage/idea', prototype: '/startup/stage/prototype',
  'early-revenue': '/startup/stage/early-revenue', mature: '/startup/stage/mature',
};

export function StageStepper({ stages, currentStage, compact = false }: { stages: StartupStageDefinition[]; currentStage: StartupStageId; compact?: boolean }) {
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.id === currentStage));
  return <nav className={`${styles.stepper} ${compact ? styles.compactStepper : ''}`} aria-label="Startup stage journey">
    {stages.map((stage, index) => {
      const state = index < currentIndex ? 'past' : index === currentIndex ? 'current' : 'locked';
      return <Link key={stage.id} href={STAGE_PATHS[stage.id]} className={`${styles.step} ${styles[`step${state[0].toUpperCase()}${state.slice(1)}`]}`} aria-current={state === 'current' ? 'step' : undefined} aria-label={`${stage.label}: ${state === 'locked' ? 'locked preview' : state === 'past' ? 'past stage record' : 'current stage'}`}>
        <span className={styles.stepCircle}>{state === 'past' ? <Check size={15} /> : state === 'locked' ? <LockKeyhole size={13} /> : index + 1}</span>
        <span className={styles.stepLabel}>{stage.label}</span>
        {state === 'current' && <small>Current · start date not recorded</small>}
        {index < stages.length - 1 && <span className={`${styles.stepConnector} ${index < currentIndex ? styles.connectorDone : ''}`} aria-hidden="true" />}
      </Link>;
    })}
  </nav>;
}

function CriterionStatus({ review, complete }: { review?: CriterionReview; complete: boolean }) {
  if (review?.status === 'approved') return <span className={`${styles.reviewChip} ${styles.approvedChip}`}><CheckCircle2 size={12} /> Approved</span>;
  if (review?.status === 'submitted') return <span className={`${styles.reviewChip} ${styles.submittedChip}`}><Send size={11} /> Submitted</span>;
  if (review?.status === 'changes-requested') return <span className={`${styles.reviewChip} ${styles.changesChip}`}><CircleHelp size={12} /> Changes requested</span>;
  if (complete) return <span className={`${styles.reviewChip} ${styles.completeChip}`}><Check size={12} /> Complete · not reviewed</span>;
  return <span className={`${styles.reviewChip} ${styles.notStartedChip}`}><Circle size={11} /> Not started</span>;
}

export function ExitCriteriaCard({ stage, workflow, canWork, locked = false, reviewerName, onToggle, onAddEvidence, onSubmit }: {
  stage: StartupStageDefinition; workflow: StageWorkflowState; canWork: boolean; locked?: boolean; reviewerName?: string;
  onToggle: (stageId: StartupStageId, criterionId: string) => void;
  onAddEvidence: (criterionId: string, item: Omit<StageEvidence, 'id' | 'createdAt'>) => void;
  onSubmit: (criterionId: string) => void;
}) {
  const [evidenceFor, setEvidenceFor] = useState<{ id: string; label: string } | null>(null);
  const completed = stage.exitCriteria.filter((item) => item.completed).length;
  const approved = stage.exitCriteria.filter((item) => workflow.reviews[stage.id]?.[item.id]?.status === 'approved').length;
  const percent = stage.exitCriteria.length ? Math.round(completed / stage.exitCriteria.length * 100) : 0;
  return <section className={styles.card} aria-labelledby="exit-criteria-heading">
    <div className={styles.cardHeader}><div><h2 id="exit-criteria-heading">{stage.id === 'mature' ? 'Growth readiness' : `Exit criteria for ${stage.label}`}</h2><p>Completion is tracked separately from mentor approval.</p></div><div className={styles.progressSummary}><strong>{completed} of {stage.exitCriteria.length} met</strong><span>{approved} approved</span></div></div>
    <div className={styles.criteriaProgress} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${completed} of ${stage.exitCriteria.length} criteria marked complete`}><span style={{ width: `${percent}%` }} /></div>
    <div className={styles.criteriaRows}>{stage.exitCriteria.map((criterion) => {
      const review = workflow.reviews[stage.id]?.[criterion.id];
      const evidence = workflow.evidence[stage.id]?.[criterion.id] || [];
      return <article className={`${styles.criterionRow} ${review?.status === 'submitted' ? styles.rowSubmitted : ''} ${review?.status === 'approved' ? styles.rowApproved : ''}`} key={criterion.id}>
        <button type="button" className={styles.criterionCheck} aria-pressed={criterion.completed} disabled={!canWork} aria-label={`${criterion.completed ? 'Mark as not met' : 'Mark as met'}: ${criterion.label}`} onClick={() => onToggle(stage.id, criterion.id)}>{criterion.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
        <div className={styles.criterionCopy}><strong className={criterion.completed ? styles.criterionComplete : ''}>{criterion.label}</strong><p className={styles.criterionDescription}>{criterion.description}</p><div className={styles.criterionMeta}><CriterionStatus review={review} complete={criterion.completed} />{locked ? <span className={styles.disabledWorkspaceLink}><LockKeyhole size={11} /> Locked until this stage</span> : <Link href={criterion.moduleHref} className={styles.evidenceLink}><Link2 size={12} /> Open related workspace</Link>}<span className={styles.reviewerLabel}>{review?.status === 'approved' ? 'Reviewed by mentor/admin' : review?.status === 'submitted' ? 'Awaiting mentor/admin review' : `Reviewer: ${reviewerName || 'Assigned mentor/admin'}`}</span></div>{review?.status === 'changes-requested' && <details className={styles.reviewerNote}><summary>Reviewer note · See requested changes</summary><p>{review.note || 'No reviewer note was added.'}</p></details>}{evidence.length > 0 && <div className={styles.evidenceList} aria-label="Attached evidence">{evidence.map((item) => <span className={styles.evidenceItem} key={item.id}><FileText size={12} />{item.type === 'link' ? <a href={item.value} target="_blank" rel="noreferrer">{item.title}</a> : <span>{item.title}</span>}</span>)}</div>}{review?.status === 'submitted' && <small className={styles.reviewHelp}>Sent for review · reviewer action isn’t connected yet</small>}</div>
        <div className={styles.criterionActions}>{canWork && <><button type="button" className={styles.criterionAction} onClick={() => setEvidenceFor({ id: criterion.id, label: criterion.label })}><Plus size={13} /> Add evidence</button>{criterion.completed && review?.status !== 'approved' && <button type="button" className={styles.submitReviewButton} onClick={() => onSubmit(criterion.id)}>{review?.status === 'submitted' ? 'Submitted' : review?.status === 'changes-requested' ? 'Resubmit' : 'Submit for review'}</button>}</>}</div>
      </article>;
    })}</div>
    <div className={styles.criteriaFooter}><span>Evidence and review state are stored in this browser demo; approval requires a mentor/admin review workflow.</span><span>{approved} approved of {stage.exitCriteria.length}</span></div>
    {evidenceFor && <EvidenceDialog criterion={evidenceFor.label} onClose={() => setEvidenceFor(null)} onSave={(item) => { onAddEvidence(evidenceFor.id, item); setEvidenceFor(null); }} />}
  </section>;
}

export function ToolGrid({ definition, tasks, documents, teamCount, locked = false, readOnly = false, compact = false }: {
  definition: StageToolkitDefinition; tasks: Array<{ moduleHref: string }>; documents: Array<{ folder: string }>; teamCount: number; locked?: boolean; readOnly?: boolean; compact?: boolean;
}) {
  const getProgress = (tool: StageToolDefinition) => {
    if (tool.progressKind === 'tasks') {
      const count = tasks.filter((task) => task.moduleHref === tool.moduleHref).length;
      return count > 0 ? `${count} linked workspace task${count === 1 ? '' : 's'}` : 'No linked tasks yet';
    }
    if (tool.progressKind === 'documents') return documents.length ? `${documents.length} workspace documents` : 'No documents added';
    if (tool.progressKind === 'team') return `${teamCount} team members in workspace`;
    return 'Curated listings not connected';
  };
  return <section className={styles.card} aria-labelledby="tools-heading"><div className={styles.cardHeader}><div><h2 id="tools-heading">Tools for {definition.id === 'early-revenue' ? 'Early Revenue' : definition.id[0].toUpperCase() + definition.id.slice(1)}</h2><p>Workspace shortcuts aligned to this stage. Linked modules may have their own access controls.</p></div>{!compact && <span className={styles.toolCount}>{definition.tools.length} tools</span>}</div><div className={`${styles.toolGrid} ${compact ? styles.compactToolGrid : ''}`}>{definition.tools.map((tool) => <article className={`${styles.toolCard} ${locked ? styles.toolLocked : ''}`} key={tool.id}><div className={styles.toolTop}><span className={styles.toolIcon}>{toolIcon(tool.icon)}</span>{tool.required && <span className={styles.requiredMark} title="Supports an exit criterion" aria-label="Supports an exit criterion" />}{locked && <LockKeyhole size={13} className={styles.lockedIcon} aria-label="Locked until this stage" />}</div><h3>{tool.title}</h3><p>{tool.description}</p><span className={styles.toolProgress}>{getProgress(tool)}</span>{tool.moduleHref && !locked ? <Link className={styles.toolOpen} href={tool.moduleHref}>{readOnly ? 'View record' : 'Open'} <ArrowRight size={13} /></Link> : <button type="button" className={styles.toolOpen} disabled>{locked ? 'Locked' : 'Not connected'} <LockKeyhole size={12} /></button>}</article>)}</div></section>;
}

function toolIcon(icon: StageToolDefinition['icon']) {
  const props = { size: 18, strokeWidth: 1.6, 'aria-hidden': true as const };
  switch (icon) {
    case 'canvas': return <Lightbulb {...props} />;
    case 'interviews': return <MessageSquare {...props} />;
    case 'market': return <BarChart3 {...props} />;
    case 'people': return <Handshake {...props} />;
    case 'roadmap': return <ClipboardCheck {...props} />;
    case 'feedback': return <MessageSquare {...props} />;
    case 'test': return <FlaskConical {...props} />;
    case 'grant': return <Search {...props} />;
    case 'pipeline': return <ArrowRight {...props} />;
    case 'revenue': return <BarChart3 {...props} />;
    case 'metrics': return <CheckCircle2 {...props} />;
    case 'hiring': return <Users {...props} />;
    case 'finance': return <BarChart3 {...props} />;
    case 'hr': return <Users {...props} />;
    case 'report': return <FileText {...props} />;
    default: return <FolderOpen {...props} />;
  }
}

export function MentorPanel({ mentor, pendingCount = 0, onMessage }: { mentor: AssignedMentorInfo; pendingCount?: number; onMessage?: () => void }) {
  const initials = mentor.name.replace(/^Dr\.\s*/i, '').split(/\s+/).map((part) => part[0]).slice(0,2).join('').toUpperCase();
  return <section className={styles.card}><div className={styles.sideHeader}><div><h2>Mentor</h2><p>Stage guidance and review</p></div><ShieldCheck size={16} /></div><div className={styles.mentorIdentity}><span className={styles.mentorAvatar}>{initials}</span><span><strong>{mentor.name}</strong><small>{mentor.title}</small></span></div><div className={styles.mentorSession}><span>Next session</span><strong>{mentor.nextSession.dateLabel} · {mentor.nextSession.timeLabel}</strong><small>{mentor.nextSession.topic}</small></div><div className={styles.reviewQueue}><span>Items awaiting review</span><strong>{pendingCount}</strong></div><div className={styles.mentorActions}><button type="button" onClick={onMessage}>Message mentor <MessageSquare size={13} /></button><Link href="/startup/dashboard">Request a session <ArrowRight size={13} /></Link></div><p className={styles.demoNote}>Mentor details are illustrative sample data; messaging and review actions aren’t connected.</p></section>;
}

export function ReadinessPanel() {
  return <section className={styles.card}><div className={styles.sideHeader}><div><h2>Readiness assessment</h2><p>Verified score service</p></div><CircleHelp size={15} /></div><div className={styles.readinessBody}><div className={styles.readinessRing} role="img" aria-label="Readiness score not assessed"><span>—<small>not scored</small></span></div><p><strong>Not assessed</strong><span>Traction, financial and mentor-review data aren’t connected, so no readiness score is calculated.</span></p></div><div className={styles.readinessFoot}><Link href="/startup/analytics">Explore analytics <ArrowRight size={13} /></Link><small>Checklist completion is not an investment score.</small></div></section>;
}

export function ResourcesCard({ definition }: { definition: StageToolkitDefinition }) {
  return <section className={styles.card}><div className={styles.sideHeader}><div><h2>Stage resources</h2><p>Relevant workspace shortcuts</p></div><Rocket size={16} /></div><div className={styles.resourceList}>{definition.resources.slice(0,5).map((resource) => <Link href={resource.href} key={resource.title}><span><strong>{resource.title}</strong><small>{resource.description}</small></span><ArrowRight size={13} /></Link>)}</div></section>;
}

export function EvidenceDialog({ criterion, onClose, onSave }: { criterion: string; onClose: () => void; onSave: (evidence: Omit<StageEvidence, 'id'|'createdAt'>) => void }) {
  const [kind, setKind] = useState<'note'|'link'>('note'); const [title, setTitle] = useState(''); const [value, setValue] = useState(''); const [error, setError] = useState('');
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!title.trim() || !value.trim()) { setError('Add a title and evidence detail.'); return; } if (kind === 'link' && !/^https?:\/\//i.test(value.trim())) { setError('Use a full link beginning with http:// or https://.'); return; } onSave({ title: title.trim(), value: value.trim(), type: kind }); };
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}><div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="evidence-title" onMouseDown={(event) => event.stopPropagation()}><div className={styles.dialogHeader}><div><span className={styles.dialogEyebrow}>Evidence</span><h2 id="evidence-title">Add supporting evidence</h2><p>{criterion}</p></div><button type="button" onClick={onClose} aria-label="Close evidence dialog"><X size={17} /></button></div><form onSubmit={submit}><div className={styles.evidenceTabs}><button type="button" aria-pressed={kind === 'note'} onClick={() => setKind('note')}>Note</button><button type="button" aria-pressed={kind === 'link'} onClick={() => setKind('link')}>Link</button></div><label className={styles.dialogField}><span>Evidence title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="e.g. Interview synthesis v1" /></label><label className={styles.dialogField}><span>{kind === 'note' ? 'Summary' : 'Evidence URL'}</span><textarea value={value} onChange={(event) => setValue(event.target.value)} rows={4} placeholder={kind === 'note' ? 'Describe the evidence and what it demonstrates…' : 'https://…'} /></label>{error && <p className={styles.formError} role="alert">{error}</p>}<p className={styles.dialogNote}>Evidence metadata is saved in this browser. File upload and secure storage aren’t connected.</p><div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.primaryButton}><Plus size={14} /> Add evidence</button></div></form></div></div>;
}

export function StageRequestDialog({ nextStage, adminRequest, onClose, onSubmit }: { nextStage: string; adminRequest: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState(''); const [error, setError] = useState('');
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (adminRequest && reason.trim().length < 10) { setError('Add a short reason (at least 10 characters) for this request.'); return; } onSubmit(reason.trim()); };
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}><div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="stage-request-title" onMouseDown={(event) => event.stopPropagation()}><div className={styles.dialogHeader}><div><span className={styles.dialogEyebrow}>Stage transition</span><h2 id="stage-request-title">Request move to {nextStage}</h2><p>The request will remain pending until a mentor or workspace reviewer responds.</p></div><button type="button" onClick={onClose} aria-label="Close stage request dialog"><X size={17} /></button></div><form onSubmit={submit}>{adminRequest && <label className={styles.dialogField}><span>Reason for request <small>Required for Owner/Admin exception</small></span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Explain why the startup should move stages now…" /></label>}{error && <p className={styles.formError} role="alert">{error}</p>}<p className={styles.dialogNote}>This is a local demo request; the mentor/admin approval service is not connected.</p><div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.primaryButton}><Send size={14} /> Submit request</button></div></form></div></div>;
}
