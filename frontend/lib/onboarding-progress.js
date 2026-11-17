'use client';
/**
 * Persists onboarding progress to `users.onboarding_step` (Step 3 part 7).
 * Progress writes are best-effort: a failed save must never break the flow,
 * so callers ignore rejections. Values stored: a step id (e.g. "skills")
 * while navigating, "completed" when the flow finishes.
 */
import { api } from '@/lib/api/client';

export function saveOnboardingStep(stepId) {
  api.users.updateMe({ onboarding_step: stepId }).catch(() => {});
}

export function saveOnboardingCompleted() {
  api.users.updateMe({ onboarding_step: 'completed' }).catch(() => {});
}

/** 1-based starting step restored from the user's saved onboarding_step. */
export function initialStepFor(user, steps) {
  const saved = user?.onboarding_step;
  if (!saved || saved === 'completed') return 1;
  const idx = steps.findIndex((s) => s.id === saved);
  return idx >= 0 ? idx + 1 : 1;
}
