export const REGISTRATION_DRAFT_KEY = 'meridian_registration_draft';
export const USER_PROFILE_KEY = 'meridian_workspace_profile';

export type OnboardingRole =
  | 'Startup'
  | 'Mentor'
  | 'Investor'
  | 'Job seeker'
  | 'Employer';

export interface StartupProfileData {
  companyName: string;
  oneLiner: string;
  stage: string;
  teamSize: string;
  sector: string;
  priorities: string[];
  website: string;
}

export interface MentorProfileData {
  headlineRole: string;
  experienceYears: string;
  availability: string;
  expertise: string[];
  preferredStages: string[];
  linkedinUrl: string;
}

export interface InvestorProfileData {
  investorType: string;
  firmName: string;
  checkSize: string;
  targetStage: string;
  sectors: string[];
  credentialUrl: string;
}

export interface JobSeekerProfileData {
  targetTitle: string;
  experienceYears: string;
  workPreference: string;
  skills: string[];
  preferredStages: string[];
  portfolioUrl: string;
}

export interface EmployerProfileData {
  companyName: string;
  hiringLeadRole: string;
  companySize: string;
  hiringTimeline: string;
  openFunctions: string[];
  companyWebsite: string;
}

export interface RoleOnboardingPayload {
  startup?: StartupProfileData;
  mentor?: MentorProfileData;
  investor?: InvestorProfileData;
  jobSeeker?: JobSeekerProfileData;
  employer?: EmployerProfileData;
}

export interface RegistrationDraft {
  fullName?: string;
  email?: string;
  method?: string;
  emailVerified?: boolean;
  role?: OnboardingRole;
  onboarding?: RoleOnboardingPayload;
}

export interface CompletedWorkspaceProfile {
  fullName: string;
  email: string;
  role: OnboardingRole;
  requiresVerification: boolean;
  completedAt: string;
  onboarding: RoleOnboardingPayload;
}
