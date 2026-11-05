"use client";
import React from "react";
import { MentorRoleProvider } from "@/context/MentorRoleContext";
import MentorShell from "./MentorShell";
export default function MentorSharedPreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <MentorRoleProvider>
      <MentorShell>{children}</MentorShell>
    </MentorRoleProvider>
  );
}
