import rawMockData from '@/data/startupMockData.json';
import {
  CompletedWorkspaceProfile,
  USER_PROFILE_KEY,
} from '@/lib/registrationDraft';
import { StartupStageId, StartupWorkspaceData } from '@/types/startup';

function mapStageStringToId(stageLabel?: string): StartupStageId {
  const normalized = (stageLabel || '').trim().toLowerCase();
  if (normalized.includes('proto')) return 'prototype';
  if (normalized.includes('revenue') || normalized.includes('series a'))
    return 'early-revenue';
  if (normalized.includes('mature') || normalized.includes('series b'))
    return 'mature';
  return 'idea';
}

export function getInitialStartupWorkspaceData(): StartupWorkspaceData {
  return JSON.parse(JSON.stringify(rawMockData)) as StartupWorkspaceData;
}

export function hydrateStartupDataFromBrowser(
  base: StartupWorkspaceData
): StartupWorkspaceData {
  if (typeof window === 'undefined') return base;

  try {
    const raw = window.localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return base;

    const saved = JSON.parse(raw) as CompletedWorkspaceProfile;
    const startupProfile = saved.onboarding?.startup;

    return {
      ...base,
      startup: {
        ...base.startup,
        founderName: saved.fullName || base.startup.founderName,
        founderEmail: saved.email || base.startup.founderEmail,
        name: startupProfile?.companyName?.trim() || base.startup.name,
        tagline: startupProfile?.oneLiner?.trim() || base.startup.tagline,
        industry: startupProfile?.sector || base.startup.industry,
        currentStage: startupProfile?.stage
          ? mapStageStringToId(startupProfile.stage)
          : base.startup.currentStage,
      },
    };
  } catch {
    return base;
  }
}
