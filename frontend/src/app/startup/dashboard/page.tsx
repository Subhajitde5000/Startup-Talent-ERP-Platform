'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Bell, BriefcaseBusiness, Check, CheckSquare2, CircleHelp,
  FileText, FolderOpen, Gauge, Plus, Search, ShieldCheck, UserRoundPlus,
  Users, Eye, LockKeyhole,
} from 'lucide-react';
import { useStartupWorkspace } from '@/context/StartupWorkspaceContext';
import { KpiStatCard } from '@/components/startup/dashboard/KpiStatCard';
import { StageJourneyCard } from '@/components/startup/dashboard/StageJourneyCard';
import { TasksMilestonesCard } from '@/components/startup/dashboard/TasksMilestonesCard';
import { MentorSectionCard } from '@/components/startup/dashboard/MentorSectionCard';
import { RecentActivityCard } from '@/components/startup/dashboard/RecentActivityCard';
import { QuickActionModal, QuickActionType } from '@/components/startup/dashboard/QuickActionModal';
import { StartupStageId } from '@/types/startup';
import styles from '@/components/startup/dashboard/DashboardWidgets.module.css';

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

export default function StartupDashboardPage() {
  const {
    data, setCurrentStage, toggleTaskStatus, toggleExitCriterion, addTask,
    addTeamMember, addDocument, requestMentorSession,
  } = useStartupWorkspace();
  const [activeAction, setActiveAction] = useState<QuickActionType>(null);
  const [investorVisible, setInvestorVisible] = useState(false);
  const founderFirstName = data.startup.founderName.trim().split(/\s+/)[0] || 'Founder';
  const activeStage = data.stages.find((stage) => stage.id === data.startup.currentStage) || data.stages[0];
  const stageIndex = Math.max(0, data.stages.findIndex((stage) => stage.id === activeStage.id));
  const completedCriteria = activeStage.exitCriteria.filter((item) => item.completed).length;
  const openTasks = data.tasks.filter((task) => task.status !== 'completed');
  const overdueTasks = openTasks.filter((task) => task.status === 'overdue');
  const completedTasks = data.tasks.length - openTasks.length;
  const ownerCount = data.team.filter((member) => member.permission === 'Owner' || member.permission === 'Admin').length;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  return (
    <div className={styles.dashboardStack}>
      <a className={styles.skipLink} href="#dashboard-main">Skip to dashboard content</a>
      <header className={styles.welcomeBar}>
        <div className={styles.welcomeText}>
          <span className={styles.eyebrow}>Founder workspace <span className={styles.welcomeDot} /> {data.startup.industry}</span>
          <h1 className={styles.greeting}>{greeting}, {founderFirstName}</h1>
          <p className={styles.subGreeting}>A clear view of what’s next for <strong>{data.startup.name}</strong>.</p>
        </div>
        <div className={styles.dashboardHeaderTools}>
          <label className={styles.searchBox}>
            <Search size={16} aria-hidden="true" />
            <input aria-label="Search workspace" placeholder="Search workspace" />
            <kbd>⌘ K</kbd>
          </label>
          <button className={styles.notificationButton} type="button" aria-label="Notifications">
            <Bell size={17} aria-hidden="true" /><span className={styles.unreadDot} />
          </button>
          <button type="button" className={styles.primaryActionBtn} onClick={() => setActiveAction('task')}>
            <Plus size={16} aria-hidden="true" /> New task
          </button>
        </div>
      </header>

      <section className={styles.stageBanner} aria-label="Startup stage progress">
        <div className={styles.stageBannerTop}>
          <div>
            <span className={styles.stageBannerLabel}>Your startup journey</span>
            <h2>{data.startup.name}<span className={styles.stageTag}>{activeStage.label} stage</span></h2>
          </div>
          <Link className={styles.textLink} href="/startup/profile">View startup profile <ArrowRight size={14} /></Link>
        </div>
        <div className={styles.stageStepper} role="group" aria-label="Select startup stage">
          {data.stages.map((stage, index) => {
            const current = stage.id === activeStage.id;
            const complete = !current && stage.exitCriteria.length > 0 && stage.exitCriteria.every((criterion) => criterion.completed);
            return <button key={stage.id} aria-pressed={current} type="button" onClick={() => setCurrentStage(stage.id as StartupStageId)} className={`${styles.stageStep} ${current ? styles.stageStepSelected : ''} ${complete ? styles.stageStepDone : ''}`}>
              <span className={styles.stageStepIcon}>{complete ? <Check size={13} /> : index + 1}</span>
              <span>{stage.label}</span>
            </button>;
          })}
        </div>
        <p className={styles.stageSummary}><span>{data.stages[stageIndex + 1] ? `Next stage: ${data.stages[stageIndex + 1].label}` : 'Final stage'}</span><span className={styles.stageSummaryDivider}>·</span>{completedCriteria} of {activeStage.exitCriteria.length} exit criteria met
          <a href="#stage-checklist">View exit criteria <ArrowRight size={13} /></a>
        </p>
      </section>

      <section id="dashboard-main" className={styles.kpiGrid} aria-label="Workspace overview">
        <KpiStatCard label="Stage criteria" value={`${completedCriteria}/${activeStage.exitCriteria.length}`} unit="met" caption={`${activeStage.label} stage checklist`} icon={<Gauge size={16} />} href="/startup/roadmap" linkLabel="View" />
        <KpiStatCard label="Open tasks" value={openTasks.length} unit={overdueTasks.length ? `${overdueTasks.length} overdue` : 'in progress'} caption={`${completedTasks} completed in workspace`} icon={<CheckSquare2 size={16} />} href="/startup/projects" linkLabel="Tasks" />
        <KpiStatCard label="Core team" value={data.team.length} unit="members" caption={`${ownerCount} founders & admins`} icon={<Users size={16} />} href="/startup/team" linkLabel="Team" />
        <KpiStatCard label="Data room" value={data.documents.length} unit="files" caption="Documents added to workspace" icon={<FolderOpen size={16} />} href="/startup/data-room" linkLabel="Open" />
      </section>

      <div className={styles.dashboardGrid}>
        <div className={styles.dashboardMainColumn}>
          <div id="stage-checklist">
            <StageJourneyCard startupName={data.startup.name} tagline={data.startup.tagline} industry={data.startup.industry} currentStage={data.startup.currentStage} stages={data.stages} onSelectStage={setCurrentStage} onToggleCriterion={toggleExitCriterion} />
          </div>
          <TasksMilestonesCard tasks={data.tasks} currentStage={data.startup.currentStage} founderName={data.startup.founderName} onToggleTask={toggleTaskStatus} onAddTaskClick={() => setActiveAction('task')} />
          <section className={styles.card} aria-labelledby="investor-interest-heading">
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleGroup}><h2 id="investor-interest-heading" className={styles.cardTitle}>Investor interest</h2><p className={styles.cardSub}>Control whether your startup can be discovered.</p></div>
              <span className={styles.privateBadge}><LockKeyhole size={13} /> Private</span>
            </div>
            <div className={styles.investorPrompt}>
              <span className={styles.investorIcon}><Eye size={19} /></span>
              <div className={styles.investorCopy}><strong>{investorVisible ? 'Investor visibility enabled' : 'Your profile is private'}</strong><span>{investorVisible ? 'Your profile will be discoverable to investors when investor tools are connected.' : 'Opt in to make your startup profile visible to investors. No investor activity data is connected yet.'}</span></div>
              <button type="button" role="switch" aria-checked={investorVisible} aria-label="Make startup profile visible to investors" onClick={() => setInvestorVisible((value) => !value)} className={`${styles.toggleSwitch} ${investorVisible ? styles.toggleOn : ''}`}><span /></button>
            </div>
            <div className={styles.cardFooter}><Link href="/startup/profile" className={styles.textLink}>Review public profile <ArrowRight size={14} /></Link><span className={styles.dataNote}>Visibility preference is local demo state</span></div>
          </section>
          <div className={styles.bottomGrid}>
            <section className={styles.card} aria-labelledby="activity-heading">
              <div className={styles.cardHeader}><div className={styles.cardTitleGroup}><h2 id="activity-heading" className={styles.cardTitle}>Recent activity</h2><p className={styles.cardSub}>Latest updates across your workspace</p></div><Link href="/startup/analytics" className={styles.textLink}>View all <ArrowRight size={14} /></Link></div>
              <RecentActivityCard items={data.recentActivity} compact />
            </section>
            <section className={styles.card} aria-labelledby="documents-heading">
              <div className={styles.cardHeader}><div className={styles.cardTitleGroup}><h2 id="documents-heading" className={styles.cardTitle}>Recent documents</h2><p className={styles.cardSub}>Your latest workspace files</p></div><Link href="/startup/data-room" className={styles.textLink}>Open vault <ArrowRight size={14} /></Link></div>
              {data.documents.length ? <div className={styles.documentList}>{data.documents.slice(0, 4).map((doc) => <Link href="/startup/data-room" key={doc.id} className={styles.documentRow}><span className={styles.documentIcon}><FileText size={16} /></span><span className={styles.documentInfo}><strong>{doc.title}</strong><small>{doc.folder} · Updated {doc.updatedAt}</small></span><ArrowRight size={14} className={styles.documentArrow} /></Link>)}</div> : <div className={styles.inlineEmpty}>No documents yet. Add your first file to the data room.</div>}
              <button type="button" className={styles.cardActionLink} onClick={() => setActiveAction('document')}><Plus size={14} /> Add a document</button>
            </section>
          </div>
        </div>

        <aside className={styles.dashboardSideColumn} aria-label="Support and hiring">
          <section className={`${styles.card} ${styles.readinessCard}`} aria-labelledby="readiness-heading">
            <div className={styles.cardHeader}><div className={styles.cardTitleGroup}><h2 id="readiness-heading" className={styles.cardTitle}>Investment readiness</h2><p className={styles.cardSub}>Assessment status</p></div><CircleHelp size={16} className={styles.helpIcon} aria-label="Readiness score is not calculated" /></div>
            <div className={styles.readinessBody}>
              <div className={styles.readinessGauge} role="img" aria-label="Investment readiness assessment not yet available"><span><ShieldCheck size={22} /><strong>—</strong><small>not scored</small></span></div>
              <p className={styles.readinessText}><strong>Not yet assessed</strong><span>A verified readiness score requires connected traction, financial, and mentor sign-off data.</span></p>
            </div>
            <div className={styles.readinessBreakdown}><div><span>Stage checklist</span><strong>{completedCriteria} / {activeStage.exitCriteria.length}</strong></div><div><span>Traction data</span><em>Not connected</em></div><div><span>Mentor sign-off</span><em>Not recorded</em></div></div>
            <div className={styles.cardFooter}><span className={styles.dataNote}>Checklist progress is not an investment score.</span><Link href="/startup/roadmap" className={styles.textLink}>Review <ArrowRight size={14} /></Link></div>
          </section>

          <MentorSectionCard mentor={data.mentor} onRequestSession={() => setActiveAction('mentor')} />

          <section className={styles.card} aria-labelledby="hiring-heading">
            <div className={styles.cardHeader}><div className={styles.cardTitleGroup}><h2 id="hiring-heading" className={styles.cardTitle}>Hiring requests</h2><p className={styles.cardSub}>Build your team for the next stage</p></div><BriefcaseBusiness size={16} className={styles.helpIcon} /></div>
            <div className={styles.hiringEmpty}><span className={styles.emptyIcon}><UserRoundPlus size={20} /></span><strong>No open roles yet</strong><span>Hiring requests and applicant counts aren’t connected to this workspace yet.</span></div>
            <div className={styles.hiringActions}><Link href="/startup/hiring" className={styles.secondaryActionBtn}><Plus size={14} /> Post a role</Link><Link href="/startup/hiring" className={styles.textLink}>Hiring workspace <ArrowRight size={14} /></Link></div>
          </section>

          <section className={styles.card} aria-labelledby="team-heading">
            <div className={styles.cardHeader}><div className={styles.cardTitleGroup}><h2 id="team-heading" className={styles.cardTitle}>Your team</h2><p className={styles.cardSub}>{data.team.length} workspace members</p></div><Link href="/startup/team" className={styles.textLink}>Manage <ArrowRight size={14} /></Link></div>
            <div className={styles.teamList}>{data.team.slice(0, 4).map((member) => <div className={styles.teamRow} key={member.id}><span className={styles.teamAvatar}>{initials(member.name)}</span><span className={styles.teamMemberInfo}><strong>{member.name}</strong><small>{member.role}</small></span><span className={styles.teamPermission}>{member.permission}</span></div>)}</div>
            <button type="button" className={styles.cardActionLink} onClick={() => setActiveAction('member')}><UserRoundPlus size={14} /> Invite a member</button>
          </section>
        </aside>
      </div>

      <QuickActionModal action={activeAction} founderName={data.startup.founderName} onClose={() => setActiveAction(null)} onCreateTask={addTask} onInviteMember={addTeamMember} onUploadDocument={addDocument} onRequestMentor={requestMentorSession} />
    </div>
  );
}
