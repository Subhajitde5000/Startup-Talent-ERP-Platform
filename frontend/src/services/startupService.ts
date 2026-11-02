import rawMockData from '@/data/startupMockData.json';
import { CompletedWorkspaceProfile, USER_PROFILE_KEY } from '@/lib/registrationDraft';
import { STARTUP_PROFILE_KEY } from '@/lib/startupProfileStorage';
import { StartupStageId, StartupWorkspaceData } from '@/types/startup';

function mapStageStringToId(stageLabel?: string): StartupStageId {
  const normalized = (stageLabel || '').trim().toLowerCase();
  if (normalized.includes('proto')) return 'prototype';
  if (normalized.includes('revenue') || normalized.includes('series a')) return 'early-revenue';
  if (normalized.includes('mature') || normalized.includes('series b')) return 'mature';
  return 'idea';
}

export function getInitialStartupWorkspaceData(): StartupWorkspaceData {
  return JSON.parse(JSON.stringify(rawMockData)) as StartupWorkspaceData;
}

export function hydrateStartupDataFromBrowser(base: StartupWorkspaceData): StartupWorkspaceData {
  if (typeof window === 'undefined') return base;
  let hydrated = base;
  try {
    const raw = window.localStorage.getItem(USER_PROFILE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as CompletedWorkspaceProfile;
      const startupProfile = saved.onboarding?.startup;
      hydrated = {
        ...hydrated,
        startup: {
          ...hydrated.startup,
          founderName: saved.fullName || hydrated.startup.founderName,
          founderEmail: saved.email || hydrated.startup.founderEmail,
          name: startupProfile?.companyName?.trim() || hydrated.startup.name,
          tagline: startupProfile?.oneLiner?.trim() || hydrated.startup.tagline,
          industry: startupProfile?.sector || hydrated.startup.industry,
          currentStage: startupProfile?.stage ? mapStageStringToId(startupProfile.stage) : hydrated.startup.currentStage,
        },
      };
    }
  } catch { /* Keep the JSON mock if the registration profile is unavailable. */ }
  try {
    const savedProfile = window.localStorage.getItem(STARTUP_PROFILE_KEY);
    if (savedProfile) {
      const profile = JSON.parse(savedProfile) as { name?: string; tagline?: string };
      hydrated = {
        ...hydrated,
        startup: {
          ...hydrated.startup,
          name: profile.name?.trim() || hydrated.startup.name,
          tagline: profile.tagline?.trim() || hydrated.startup.tagline,
        },
      };
    }
  } catch { /* Keep the last valid workspace values. */ }
  return hydrated;
}
