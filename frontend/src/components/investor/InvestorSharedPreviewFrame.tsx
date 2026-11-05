"use client";
import React from "react";
import { InvestorRoleProvider } from "@/context/InvestorRoleContext";
import InvestorShell from "./InvestorShell";
export default function InvestorSharedPreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <InvestorRoleProvider>
      <InvestorShell>{children}</InvestorShell>
    </InvestorRoleProvider>
  );
}
