import React from 'react';
import { StartupWorkspaceProvider } from '@/context/StartupWorkspaceContext';
import { StartupShell } from '@/components/startup/StartupShell';

export default function StartupModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StartupWorkspaceProvider>
      <StartupShell>{children}</StartupShell>
    </StartupWorkspaceProvider>
  );
}
