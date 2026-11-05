import React, { Suspense } from "react";
import RoleAwareSharedPreview from "@/components/shared/RoleAwareSharedPreview";

export const metadata = { title: "Support tickets" };

export default function HelpTicketsRoute() {
  return (
    <Suspense
      fallback={
        <div role="status" style={{ padding: 32 }}>
          Loading support tickets…
        </div>
      }
    >
      <RoleAwareSharedPreview page="tickets" />
    </Suspense>
  );
}
