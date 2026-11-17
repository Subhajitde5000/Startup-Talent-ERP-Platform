'use client';

import { EmployerShell } from '@/components';
import AccountSettings from '@/components/account-settings';

export default function EmployerSettingsPage() {
  return (
    <EmployerShell active="/employer/settings">
      <div className="mb-6">
        <h1 className="text-xl font-serif font-bold text-[#0F1B2D]">Account Settings</h1>
        <p className="mt-1 text-xs text-[#6B7280]">
          Manage your account details, privacy visibility and data requests.
        </p>
      </div>
      <AccountSettings />
    </EmployerShell>
  );
}
