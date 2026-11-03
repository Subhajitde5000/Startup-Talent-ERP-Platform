import React from 'react';
import { StartupWorkspaceProvider } from '@/context/StartupWorkspaceContext';
import { StartupNotificationProvider } from '@/context/StartupNotificationContext';
import { StartupShell } from '@/components/startup/StartupShell';

export default function StartupModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StartupWorkspaceProvider>
      <StartupNotificationProvider>
        <StartupShell>{children}</StartupShell>
      </StartupNotificationProvider>
    </StartupWorkspaceProvider>
  );
}
