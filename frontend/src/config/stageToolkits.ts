import { StartupStageId } from '@/types/startup';

export interface StageToolDefinition {
  id: string; title: string; description: string; moduleHref?: string;
  icon: 'canvas' | 'interviews' | 'market' | 'people' | 'roadmap' | 'feedback' | 'test' | 'grant' | 'pipeline' | 'revenue' | 'metrics' | 'hiring' | 'finance' | 'hr' | 'report' | 'vault';
  required?: boolean; criterionIds?: string[]; progressKind: 'tasks' | 'documents' | 'team' | 'none';
}
export interface StageToolkitDefinition {
  id: StartupStageId; focus: string; nextStageGoal: string; tools: StageToolDefinition[];
  resources: Array<{ title: string; description: string; href: string }>;
}
export const STAGE_TOOLKITS: Record<StartupStageId, StageToolkitDefinition> = {
  idea: {
    id: 'idea', focus: 'Validate the problem and define the market you’re serving.', nextStageGoal: 'Validated problem and a clearly defined target customer.',
    tools: [
      { id: 'idea-canvas', title: 'Idea canvas', description: 'Shape the problem, customer, value proposition and business assumptions.', moduleHref: '/startup/idea-validation', icon: 'canvas', required: true, criterionIds: ['idea-problem'], progressKind: 'tasks' },
      { id: 'interviews', title: 'Customer interviews', description: 'Plan discovery conversations and capture evidence-backed insights.', moduleHref: '/startup/customer-research', icon: 'interviews', required: true, criterionIds: ['idea-interviews'], progressKind: 'tasks' },
      { id: 'market-sizing', title: 'Market sizing', description: 'Build a transparent TAM, SAM and SOM estimate with source notes.', moduleHref: '/startup/market-analysis', icon: 'market', required: true, criterionIds: ['idea-market','idea-customer'], progressKind: 'tasks' },
      { id: 'cofounder-search', title: 'Co-founder search', description: 'Document capability gaps and explore compatible co-founder profiles.', moduleHref: '/startup/cofounders', icon: 'people', progressKind: 'team' },
    ],
    resources: [
      { title: 'Problem interview guide', description: 'A practical structure for non-leading discovery interviews.', href: '/startup/customer-research' },
      { title: 'Market analysis workspace', description: 'Capture assumptions and source links alongside estimates.', href: '/startup/market-analysis' },
      { title: 'Founder alignment', description: 'Record roles and early working agreements.', href: '/startup/team' },
    ],
  },
  prototype: {
    id: 'prototype', focus: 'Build a usable MVP, test it with real users and learn quickly.', nextStageGoal: 'A working MVP with initial test users and an iteration plan.',
    tools: [
      { id: 'sprint-board', title: 'Roadmap & sprint board', description: 'Plan product scope, sprint work and milestone ownership.', moduleHref: '/startup/projects', icon: 'roadmap', required: true, criterionIds: ['prototype-scope','prototype-feedback'], progressKind: 'tasks' },
      { id: 'feedback-log', title: 'Prototype & feedback log', description: 'Organize prototype versions and turn feedback into next steps.', moduleHref: '/startup/prototype-testing', icon: 'feedback', required: true, criterionIds: ['prototype-release','prototype-feedback'], progressKind: 'tasks' },
      { id: 'user-testing', title: 'User-testing tracker', description: 'Keep test sessions, outcomes and consent requirements together.', moduleHref: '/startup/prototype-testing', icon: 'test', required: true, criterionIds: ['prototype-testers'], progressKind: 'tasks' },
      { id: 'programmes', title: 'Grants & programmes', description: 'A place for curated grant and incubator listings when connected.', icon: 'grant', progressKind: 'none' },
    ],
    resources: [
      { title: 'MVP scope planning', description: 'Link a narrow product scope to sprint milestones.', href: '/startup/projects' },
      { title: 'Prototype testing', description: 'Plan sessions and collect structured user feedback.', href: '/startup/prototype-testing' },
      { title: 'Stage hiring plan', description: 'Review skills gaps for the next product milestone.', href: '/startup/hiring' },
    ],
  },
  'early-revenue': {
    id: 'early-revenue', focus: 'Prove repeatable traction and understand the economics of growth.', nextStageGoal: 'Recurring revenue and a repeatable sales motion.',
    tools: [
      { id: 'sales-pipeline', title: 'Customer & sales pipeline', description: 'Track prospects, pilots, proposals and paid conversions.', moduleHref: '/startup/sales', icon: 'pipeline', required: true, criterionIds: ['revenue-customers','revenue-process'], progressKind: 'tasks' },
      { id: 'revenue-burn', title: 'Revenue & burn dashboard', description: 'Organize monthly operating metrics when verified finance data is available.', moduleHref: '/startup/analytics', icon: 'revenue', required: true, criterionIds: ['revenue-mrr','revenue-economics'], progressKind: 'tasks' },
      { id: 'kpi-tracker', title: 'KPI tracker', description: 'Define and review the operating metrics that matter to your team.', moduleHref: '/startup/analytics', icon: 'metrics', progressKind: 'tasks' },
      { id: 'hiring-requests', title: 'Hiring requests', description: 'Create roles tied to specific execution needs and priorities.', moduleHref: '/startup/hiring', icon: 'hiring', progressKind: 'team' },
    ],
    resources: [
      { title: 'Sales workspace', description: 'Keep pilot and contract stages in one pipeline.', href: '/startup/sales' },
      { title: 'Analytics workspace', description: 'Review revenue and unit-economic inputs.', href: '/startup/analytics' },
      { title: 'Hiring requests', description: 'Connect roles to the team’s current priorities.', href: '/startup/hiring' },
    ],
  },
  mature: {
    id: 'mature', focus: 'Strengthen governance, reporting and the operating systems for scale.', nextStageGoal: 'Ongoing growth health checklist; there is no later stage.',
    tools: [
      { id: 'finance-cap-table', title: 'Finance & cap table', description: 'Organize financial and ownership records for review.', moduleHref: '/startup/data-room', icon: 'finance', required: true, criterionIds: ['mature-financials','mature-cap-table'], progressKind: 'documents' },
      { id: 'people-operations', title: 'People operations', description: 'Keep roles, team structure and hiring needs coordinated.', moduleHref: '/startup/team', icon: 'hr', progressKind: 'team' },
      { id: 'board-reporting', title: 'Board & investor reporting', description: 'Prepare operating updates and reporting cadence.', moduleHref: '/startup/analytics', icon: 'report', required: true, criterionIds: ['mature-board'], progressKind: 'tasks' },
      { id: 'data-room', title: 'Diligence data room', description: 'Curate documents and access controls for diligence.', moduleHref: '/startup/data-room', icon: 'vault', required: true, criterionIds: ['mature-room','mature-hiring'], progressKind: 'documents' },
    ],
    resources: [
      { title: 'Data room', description: 'Maintain a tidy, access-controlled document set.', href: '/startup/data-room' },
      { title: 'Team directory', description: 'Keep responsibilities and access current.', href: '/startup/team' },
      { title: 'Operating analytics', description: 'Review operating data and reporting inputs.', href: '/startup/analytics' },
    ],
  },
};
