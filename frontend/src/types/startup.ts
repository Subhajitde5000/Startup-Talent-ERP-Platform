export type StartupStageId = 'idea' | 'prototype' | 'early-revenue' | 'mature';

export interface StartupStageDefinition {
  id: StartupStageId;
  stepNumber: string;
  label: string;
  shortSummary: string;
  exitCriteria: Array<{
    id: string;
    label: string;
    completed: boolean;
    moduleHref: string;
  }>;
}

export type TaskStatus = 'pending' | 'overdue' | 'completed';

export interface StartupTaskItem {
  id: string;
  title: string;
  moduleLabel: string;
  moduleHref: string;
  dueLabel: string;
  owner: string;
  status: TaskStatus;
  isMilestone?: boolean;
}

export type ActivityCategory = 'milestone' | 'mentor' | 'team' | 'document';

export interface StartupActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  category: ActivityCategory;
}

export interface StartupTeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  permission: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  department?: string;
  status?: 'Active' | 'Pending' | 'Deactivated';
  joinedAt?: string;
  bio?: string;
  skills?: string[];
  linkedin?: string;
  location?: string;
  showOnPublicProfile?: boolean;
  publicBio?: string;
}

export interface AssignedMentorInfo {
  name: string;
  title: string;
  organization: string;
  focusAreas: string[];
  latestNote: string;
  latestNoteDate: string;
  nextSession: {
    topic: string;
    dateLabel: string;
    timeLabel: string;
    status: 'Confirmed' | 'Requested';
  };
}

export interface StartupDocumentItem {
  id: string;
  title: string;
  folder: 'Pitch & Narrative' | 'Financials' | 'Cap Table' | 'Legal';
  updatedAt: string;
}

export interface StartupWorkspaceData {
  isMockData: boolean;
  startup: {
    name: string;
    tagline: string;
    industry: string;
    foundedYear: string;
    founderName: string;
    founderEmail: string;
    currentStage: StartupStageId;
  };
  readiness: {
    completedMilestones: number;
    totalMilestones: number;
    rubricNote: string;
  };
  stages: StartupStageDefinition[];
  tasks: StartupTaskItem[];
  recentActivity: StartupActivityItem[];
  team: StartupTeamMember[];
  mentor: AssignedMentorInfo;
  documents: StartupDocumentItem[];
}
