import React, { Suspense } from "react";
import RoleAwareSharedPreview from "@/components/shared/RoleAwareSharedPreview";

export const metadata = { title: "Help center" };

export default function HelpRoute() {
  return (
    <Suspense
      fallback={
        <div role="status" style={{ padding: 32 }}>
          Loading help center…
        </div>
      }
    >
      <RoleAwareSharedPreview page="help" />
    </Suspense>
  );
}
