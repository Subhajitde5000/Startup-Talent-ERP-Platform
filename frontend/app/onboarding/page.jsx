'use client';

import React, { Suspense } from 'react';
import { useAuth, primaryRole } from '@/lib/auth-context';
import OnboardingShell from './components/OnboardingShell';
import StartupOnboarding from './flows/StartupOnboarding';
import MentorOnboarding from './flows/MentorOnboarding';
import InvestorOnboarding from './flows/InvestorOnboarding';
import JobseekerOnboarding from './flows/JobseekerOnboarding';
import EmployerOnboarding from './flows/EmployerOnboarding';

const VALID_ROLES = ['startup', 'mentor', 'investor', 'jobseeker', 'employer'];

function OnboardingContent() {
  const { user } = useAuth();
  const userRole = primaryRole(user);
  // Registration sets the primary role. Onboarding must not let a new user
  // select a different role than the one their account was created with.
  const activeRole = VALID_ROLES.includes(userRole) ? userRole : 'startup';

  return (
    <OnboardingShell>
      {activeRole === 'startup' && <StartupOnboarding />}
      {activeRole === 'mentor' && <MentorOnboarding />}
      {activeRole === 'investor' && <InvestorOnboarding />}
      {activeRole === 'jobseeker' && <JobseekerOnboarding />}
      {activeRole === 'employer' && <EmployerOnboarding />}
    </OnboardingShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] text-[#0F1B2D]">
          <div className="flex items-center gap-3 text-sm font-medium">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0F1B2D]/30 border-t-[#0F1B2D]" />
            Loading Forma Onboarding...
          </div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
