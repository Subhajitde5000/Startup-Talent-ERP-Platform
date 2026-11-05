"use client";

import React from "react";
import { StartupWorkspaceProvider } from "@/context/StartupWorkspaceContext";
import { StartupNotificationProvider } from "@/context/StartupNotificationContext";
import { MentorWorkspaceProvider } from "@/context/MentorWorkspaceContext";
import { StartupInvestorProvider } from "@/context/StartupInvestorContext";
import { StartupShell } from "@/components/startup/StartupShell";

/** Founders get their own shell on shared routes (`/help`, `/notifications`). */
export default function StartupSharedPreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <StartupWorkspaceProvider>
      <StartupNotificationProvider>
        <MentorWorkspaceProvider>
          <StartupInvestorProvider>
            <StartupShell>{children}</StartupShell>
          </StartupInvestorProvider>
        </MentorWorkspaceProvider>
      </StartupNotificationProvider>
    </StartupWorkspaceProvider>
  );
}
