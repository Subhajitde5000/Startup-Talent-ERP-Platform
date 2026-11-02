import { StartupStageId } from '@/types/startup';

export interface StartupNavItem {
  pageNumber?: number;
  id: string;
  label: string;
  href: string;
  description: string;
  recommendedStage?: StartupStageId;
}

export interface StartupNavGroup {
  id: string;
  label: string;
  items: StartupNavItem[];
}

export const STARTUP_NAV_GROUPS: StartupNavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        pageNumber: 14,
        id: 'dashboard',
        label: 'Dashboard',
        href: '/startup/dashboard',
        description: 'Overview, stage progression, readiness checklist and priorities.',
      },
      {
        pageNumber: 15,
        id: 'profile',
        label: 'Startup Profile',
        href: '/startup/profile',
        description: 'Company details, industry, description and legal information.',
      },
      {
        pageNumber: 16,
        id: 'team',
        label: 'Team Management',
        href: '/startup/team',
        description: 'Founders, employees, roles and workspace permissions.',
      },
      {
        pageNumber: 17,
        id: 'roadmap',
        label: 'Stage Roadmap',
        href: '/startup/roadmap',
        description: 'Four-stage startup journey from Idea to Mature.',
      },
    ],
  },
  {
    id: 'discovery',
    label: 'Discovery & Validation',
    items: [
      {
        pageNumber: 18,
        id: 'idea-validation',
        label: 'Idea Validation',
        href: '/startup/idea-validation',
        description: 'Problem canvas, hypotheses and validation experiments.',
        recommendedStage: 'idea',
      },
      {
        pageNumber: 19,
        id: 'customer-research',
        label: 'Customer Research',
        href: '/startup/customer-research',
        description: 'Discovery interview logs, synthesis and user quotes.',
        recommendedStage: 'idea',
      },
      {
        pageNumber: 20,
        id: 'market-analysis',
        label: 'Market Analysis',
        href: '/startup/market-analysis',
        description: 'TAM / SAM / SOM market sizing and ideal customer profile.',
        recommendedStage: 'idea',
      },
      {
        pageNumber: 21,
        id: 'cofounders',
        label: 'Co-founder Search',
        href: '/startup/cofounders',
        description: 'Discover complementary technical and commercial co-founders.',
        recommendedStage: 'idea',
      },
    ],
  },
  {
    id: 'build',
    label: 'Build & Execution',
    items: [
      {
        pageNumber: 22,
        id: 'projects',
        label: 'Projects & Sprints',
        href: '/startup/projects',
        description: 'Execution tasks, sprint cycles and product milestones.',
        recommendedStage: 'prototype',
      },
      {
        pageNumber: 23,
        id: 'prototype-testing',
        label: 'Prototype Testing',
        href: '/startup/prototype-testing',
        description: 'MVP usability sessions, cohort feedback and iteration logs.',
        recommendedStage: 'prototype',
      },
      {
        pageNumber: 26,
        id: 'hiring',
        label: 'Hiring Requests',
        href: '/startup/hiring',
        description: 'Request vetted engineers and operators from the talent module.',
        recommendedStage: 'prototype',
      },
    ],
  },
  {
    id: 'traction',
    label: 'Traction & Capital',
    items: [
      {
        pageNumber: 24,
        id: 'sales',
        label: 'Sales Pipeline',
        href: '/startup/sales',
        description: 'Pilot accounts, deal stages and early customer conversion.',
        recommendedStage: 'early-revenue',
      },
      {
        pageNumber: 25,
        id: 'analytics',
        label: 'Business Analytics',
        href: '/startup/analytics',
        description: 'Monthly revenue, net burn, runway and unit economics.',
        recommendedStage: 'early-revenue',
      },
      {
        pageNumber: 27,
        id: 'data-room',
        label: 'Data Room',
        href: '/startup/data-room',
        description: 'Financials, cap table, governance documents and investor updates.',
        recommendedStage: 'mature',
      },
    ],
  },
];

export const ALL_STARTUP_NAV_ITEMS: StartupNavItem[] = STARTUP_NAV_GROUPS.flatMap(
  (group) => group.items
);
