'use client';

import { StartupShell } from '@/components';
import AccountSettings from '@/components/account-settings';

export default function StartupSettingsPage() {
  return (
    <StartupShell
      active="Settings"
      title="Account Settings"
      description="Manage your account details, privacy visibility and data requests."
      backHref="/startup/dashboard"
      backLabel="← Dashboard"
    >
      <AccountSettings />
    </StartupShell>
  );
}
