import type { Metadata } from "next";

export const metadata: Metadata = { title: "Investor workspace" };

import React from "react";
import { InvestorRoleProvider } from "@/context/InvestorRoleContext";
import InvestorShell from "@/components/investor/InvestorShell";
export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return (
    <InvestorRoleProvider>
      <InvestorShell>{children}</InvestorShell>
    </InvestorRoleProvider>
  );
}
