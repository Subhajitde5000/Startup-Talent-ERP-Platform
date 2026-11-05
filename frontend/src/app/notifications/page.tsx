import React, { Suspense } from "react";
import RoleAwareSharedPreview from "@/components/shared/RoleAwareSharedPreview";

export const metadata = { title: "Notifications" };

export default function NotificationsRoute() {
  return (
    <Suspense
      fallback={
        <div role="status" style={{ padding: 32 }}>
          Loading notifications…
        </div>
      }
    >
      <RoleAwareSharedPreview page="notifications" />
    </Suspense>
  );
}
