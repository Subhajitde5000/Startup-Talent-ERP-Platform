import React, { Suspense } from "react";
import { HiringWorkspaceProvider } from "@/context/HiringWorkspaceContext";

export default function HiringLayout({ children }: { children: React.ReactNode }) {
  return (
    <HiringWorkspaceProvider>
      <Suspense
        fallback={
          <div role="status" style={{ padding: 32 }}>
            Loading hiring workspace…
          </div>
        }
      >
        {children}
      </Suspense>
    </HiringWorkspaceProvider>
  );
}
