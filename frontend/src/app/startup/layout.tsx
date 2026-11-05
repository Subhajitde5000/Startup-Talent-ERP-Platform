import type { Metadata } from "next";

export const metadata: Metadata = { title: "Founder workspace" };

import React, { Suspense } from "react";
import { StartupWorkspaceProvider } from "@/context/StartupWorkspaceContext";
import { StartupNotificationProvider } from "@/context/StartupNotificationContext";
import { MentorWorkspaceProvider } from "@/context/MentorWorkspaceContext";
import { StartupInvestorProvider } from "@/context/StartupInvestorContext";
import { StartupShell } from "@/components/startup/StartupShell";

export default function StartupModuleLayout({ children }: { children: React.ReactNode }) {
  return (
    <StartupWorkspaceProvider>
      <StartupNotificationProvider>
        <MentorWorkspaceProvider>
          <StartupInvestorProvider>
            <StartupShell>
              <Suspense
                fallback={
                  <div role="status" style={{ padding: 32 }}>
                    Loading workspace…
                  </div>
                }
              >
                {children}
              </Suspense>
            </StartupShell>
          </StartupInvestorProvider>
        </MentorWorkspaceProvider>
      </StartupNotificationProvider>
    </StartupWorkspaceProvider>
  );
}
