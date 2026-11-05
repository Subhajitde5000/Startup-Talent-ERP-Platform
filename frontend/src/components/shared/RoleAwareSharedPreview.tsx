"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import StartupSharedPreviewFrame from "@/components/startup/StartupSharedPreviewFrame";
import {
  StartupHelpPage,
  StartupNotificationsPage,
  StartupTicketsPage,
} from "@/components/startup/StartupSharedPages";
import MentorSharedPreviewFrame from "@/components/mentor/MentorSharedPreviewFrame";
import {
  MentorHelpPage,
  MentorNotificationsPage,
  MentorTicketsPage,
} from "@/components/mentor/MentorSharedPages";
import InvestorSharedPreviewFrame from "@/components/investor/InvestorSharedPreviewFrame";
import {
  InvestorHelpPage,
  InvestorNotificationsPage,
  InvestorTicketsPage,
} from "@/components/investor/InvestorSharedPages";

type SharedPage = "notifications" | "help" | "tickets";
type SharedRole = "startup" | "mentor" | "investor";

function roleFromParam(value: string | null): SharedRole {
  const normalized = (value || "").toLowerCase();
  if (normalized === "mentor") return "mentor";
  if (normalized === "investor") return "investor";
  return "startup";
}

/**
 * Shared routes render inside the correct role shell. The role comes from the
 * query string (`?role=mentor|investor|startup`) so deep links, sidebar links
 * and SSR all agree. Founders are the default instead of being forced into the
 * mentor frame.
 */
export default function RoleAwareSharedPreview({ page }: { page: SharedPage }) {
  const params = useSearchParams();
  const role = roleFromParam(params.get("role"));

  if (role === "investor") {
    return (
      <InvestorSharedPreviewFrame>
        {page === "notifications" ? (
          <InvestorNotificationsPage />
        ) : page === "help" ? (
          <InvestorHelpPage />
        ) : (
          <InvestorTicketsPage />
        )}
      </InvestorSharedPreviewFrame>
    );
  }

  if (role === "mentor") {
    return (
      <MentorSharedPreviewFrame>
        {page === "notifications" ? (
          <MentorNotificationsPage />
        ) : page === "help" ? (
          <MentorHelpPage />
        ) : (
          <MentorTicketsPage />
        )}
      </MentorSharedPreviewFrame>
    );
  }

  return (
    <StartupSharedPreviewFrame>
      {page === "notifications" ? (
        <StartupNotificationsPage />
      ) : page === "help" ? (
        <StartupHelpPage />
      ) : (
        <StartupTicketsPage />
      )}
    </StartupSharedPreviewFrame>
  );
}
