'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Compass } from 'lucide-react';
import { ALL_STARTUP_NAV_ITEMS } from '@/config/startupNavigation';
import { useStartupWorkspace } from '@/context/StartupWorkspaceContext';
import styles from '@/components/startup/dashboard/DashboardWidgets.module.css';

const MODULE_DETAILS: Record<
  string,
  {
    pageNumber: number;
    purpose: string;
    plannedCapabilities: string[];
  }
> = {
  profile: {
    pageNumber: 15,
    purpose:
      'Maintain your company narrative, legal entity details, problem statement, and public founder profile.',
    plannedCapabilities: [
      'Company overview, sector tags, incorporation details, and one-line thesis',
      'Problem / solution positioning and target customer persona summary',
      'Visibility controls for mentors, talent candidates, and accredited investors',
    ],
  },
  team: {
    pageNumber: 16,
    purpose:
      'Organize founding team roles, responsibilities, permissions, and advisor collaborators.',
    plannedCapabilities: [
      'Active roster with department ownership and workspace access permissions',
      'Pending teammate invitations and onboarding checklist tracking',
      'Equity & responsibility alignment notes for co-founders',
    ],
  },
  roadmap: {
    pageNumber: 17,
    purpose:
      'Navigate the four startup lifecycle stages (Idea, Prototype, Early Revenue, Mature) and track exit criteria.',
    plannedCapabilities: [
      'Stage-by-stage exit criteria checklists and milestone dependencies',
      'Quarterly timeline view connecting product, validation, and GTM goals',
      'Mentor sign-off notes per completed stage milestone',
    ],
  },
  'idea-validation': {
    pageNumber: 18,
    purpose:
      'Document core hypotheses, structured experiments, and validation evidence before scaling engineering effort.',
    plannedCapabilities: [
      'Problem, value, and willingness-to-pay hypothesis cards',
      'Experiment design log with pass/fail thresholds and learnings',
      'Evidence links from customer discovery calls and landing page tests',
    ],
  },
  'customer-research': {
    pageNumber: 19,
    purpose:
      'Centralize discovery interview notes, pain-point synthesis, and early design-partner feedback.',
    plannedCapabilities: [
      'Structured interview repository tagged by buyer persona and urgency',
      'Recurring pain-point patterns and verbatim customer quotes',
      'Design partner pipeline from initial call to pilot commitment',
    ],
  },
  'market-analysis': {
    pageNumber: 20,
    purpose:
      'Map market sizing (bottom-up TAM/SAM/SOM), competitive positioning, and regulatory tailwinds.',
    plannedCapabilities: [
      'Bottom-up market sizing assumptions with transparent source citations',
      'Competitor capability matrix and differentiation moat summary',
      'Pricing benchmark comparison across incumbents and alternatives',
    ],
  },
  cofounders: {
    pageNumber: 21,
    purpose:
      'Define complementary co-founder profiles, evaluate alignment, and connect with vetted builders in the network.',
    plannedCapabilities: [
      'Co-founder role brief covering technical/commercial skill gaps',
      'Structured values, commitment, and working-style alignment rubric',
      'Saved candidate conversations and trial sprint tracker',
    ],
  },
  projects: {
    pageNumber: 22,
    purpose:
      'Coordinate execution sprints, milestones, and cross-functional tasks across product and go-to-market.',
    plannedCapabilities: [
      'Sprint board and list views synced with dashboard tasks & milestones',
      'Owner assignment, due dates, and stage milestone linking',
      'Weekly execution summary for team standups and mentor check-ins',
    ],
  },
  'prototype-testing': {
    pageNumber: 23,
    purpose:
      'Run structured usability sessions, pilot test cohorts, and iteration logs on your MVP or prototype.',
    plannedCapabilities: [
      'Prototype build releases and test cohort feedback tracking',
      'Task completion observations, friction points, and bug triage',
      'Go / no-go readiness checklist for moving into Early Revenue',
    ],
  },
  sales: {
    pageNumber: 24,
    purpose:
      'Track design partners, LOIs, pilot conversions, and repeatable early revenue pipelines.',
    plannedCapabilities: [
      'B2B/B2C deal stages from discovery to signed pilot or paid contract',
      'Contract value, renewal dates, and conversion bottleneck notes',
      'Repeatable acquisition channel tracking',
    ],
  },
  analytics: {
    pageNumber: 25,
    purpose:
      'Monitor honest operational KPIs—retention, unit economics, runway, and cohort engagement.',
    plannedCapabilities: [
      'Monthly burn, cash runway, and net revenue retention overview',
      'Product activation and cohort engagement metrics',
      'CSV / accounting integration hooks for live financial reporting',
    ],
  },
  hiring: {
    pageNumber: 26,
    purpose:
      'Publish startup roles to the Talent marketplace and manage candidate pipelines.',
    plannedCapabilities: [
      'Open role requisitions with compensation & equity bands',
      'Inbound talent applications and stage-by-stage interview scorecards',
      'Offer tracking and onboarding handoff to Team & Roles',
    ],
  },
  'data-room': {
    pageNumber: 27,
    purpose:
      'Curate investor-ready decks, financial models, IP documentation, and legal diligence folders.',
    plannedCapabilities: [
      'Structured diligence folders (Pitch, Financials, Cap Table, Legal)',
      'Document readiness status and version history',
      'Granular share permissions for mentors and prospective investors',
    ],
  },
  settings: {
    pageNumber: 0,
    purpose:
      'Manage Startup Workspace preferences, notification rules, and future API integrations.',
    plannedCapabilities: [
      'Workspace branding, fiscal calendar, and stage notification preferences',
      'Role-based access controls and security audit log',
      'Backend API & webhook configuration',
    ],
  },
};

export default function StartupModulePage() {
  const params = useParams<{ module: string }>();
  const slug = params?.module || 'profile';
  const { data } = useStartupWorkspace();

  const navItem = ALL_STARTUP_NAV_ITEMS.find((item) => item.id === slug);
  const meta = MODULE_DETAILS[slug] || {
    pageNumber: 0,
    purpose: 'Dedicated Startup Workspace module.',
    plannedCapabilities: [
      'Structured records synced with your Startup Workspace state',
      'Stage-aware guidance and milestone integration',
    ],
  };

  const title =
    slug === 'settings'
      ? 'Workspace Settings'
      : navItem?.label || 'Startup Module';

  const moduleTasks = data.tasks.filter(
    (t) => t.moduleHref === `/startup/${slug}`
  );

  return (
    <div className={styles.dashboardStack}>
      <header className={styles.welcomeBar}>
        <div className={styles.welcomeText}>
          <span className={styles.eyebrow}>
            {meta.pageNumber > 0
              ? `Startup Workspace · Page ${meta.pageNumber} of 27`
              : 'Startup Workspace'}
          </span>
          <h1 className={styles.greeting}>{title}</h1>
          <p className={styles.subGreeting}>{meta.purpose}</p>
        </div>

        <div className={styles.quickActionGroup}>
          <Link
            href="/startup/dashboard"
            className={styles.secondaryActionBtn}
            style={{ textDecoration: 'none' }}
          >
            <ArrowLeft size={15} strokeWidth={1.6} aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <h2 className={styles.cardTitle}>
              Module Scaffold Ready for Next Iteration
            </h2>
            <p className={styles.cardSub}>
              Connected to shared <strong>{data.startup.name}</strong> workspace
              state ({data.startup.currentStage.replace('-', ' ')} stage)
            </p>
          </div>

          {navItem?.recommendedStage && (
            <span className={styles.stageBadge}>
              <Compass size={12} strokeWidth={1.7} aria-hidden="true" />
              Core in {navItem.recommendedStage.replace('-', ' ')} stage
            </span>
          )}
        </div>

        <div className={styles.exitCriteriaSection}>
          <span className={styles.exitCriteriaTitle}>
            Planned module capabilities
          </span>
          <div className={styles.criteriaList}>
            {meta.plannedCapabilities.map((item) => (
              <div key={item} className={styles.criterionRow}>
                <span className={styles.criterionLabel}>
                  <CheckCircle2
                    size={15}
                    strokeWidth={1.6}
                    style={{ color: 'var(--accent)', flexShrink: 0 }}
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {moduleTasks.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleGroup}>
              <h3 className={styles.cardTitle}>
                Linked Tasks in {title} ({moduleTasks.length})
              </h3>
              <p className={styles.cardSub}>
                Synced directly from your Startup Dashboard task store
              </p>
            </div>
          </div>

          <div className={styles.taskList}>
            {moduleTasks.map((task) => (
              <div key={task.id} className={styles.taskRow}>
                <div className={styles.taskBody}>
                  <span className={styles.taskTitle}>{task.title}</span>
                  <div className={styles.taskMetaRow}>
                    <span>{task.dueLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{task.owner}</span>
                  </div>
                </div>
                <span className={styles.statusBadge}>{task.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
