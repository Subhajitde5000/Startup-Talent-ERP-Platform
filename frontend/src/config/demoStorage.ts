/**
 * Browser-storage keys for the illustrative demo workspaces.
 *
 * A single registry lets the Settings screen restore the full demo dataset
 * (`Reset demo data`) instead of leaving a half-empty workspace behind.
 */
export const DEMO_STORAGE_KEYS = [
  "meridian_workspace_profile",
  "meridian_registration_draft",
  "meridian-startup-profile-v1",
  "meridian-startup-profile-draft-v1",
  "meridian-startup-stage-workflow-v1",
  "meridian-startup-analytics-v2",
  "meridian-startup-hiring-v2",
  "meridian-startup-investor-workspace-v2",
  "meridian-startup-mentor-workspace-v2",
  "meridian-investor-role-v2",
  "meridian-mentor-role-core-v2",
  "meridian-startup-notifications-read-v1",
  "meridian-startup-settings-v1",
  "meridian-team-pending-invites-v1",
] as const;

/** Remove all locally edited demo records (theme preference is preserved). */
export function clearDemoWorkspaces(): void {
  if (typeof window === "undefined") return;
  try {
    DEMO_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* Private browsing — the in-memory demo state is still intact. */
  }
}

/** Restore every demo workspace to its seeded state and reload the UI. */
export function resetDemoWorkspaces(): void {
  clearDemoWorkspaces();
  if (typeof window !== "undefined") window.location.reload();
}
