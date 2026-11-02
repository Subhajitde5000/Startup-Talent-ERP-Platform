export const REGISTRATION_DRAFT_KEY = 'meridian_registration_draft';

export type OnboardingRole =
  | 'Startup'
  | 'Mentor'
  | 'Investor'
  | 'Job seeker'
  | 'Employer';

export interface RegistrationDraft {
  fullName?: string;
  email?: string;
  method?: string;
  emailVerified?: boolean;
  role?: OnboardingRole;
}
