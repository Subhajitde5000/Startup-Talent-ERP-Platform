"use client";

import { HIRING_DEMO_DATA } from "@/data/startupDemoData";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { StartupStageDefinition } from "@/types/startup";

export type HiringJobStatus =
  "Draft" | "Pending approval" | "Open" | "Paused" | "Closed" | "Filled";
export type ApplicantStage =
  "Applied" | "Shortlisted" | "Interview" | "Offer" | "Hired" | "Rejected" | "Withdrawn";
export interface HiringRequest {
  id: string;
  title: string;
  department: string;
  headcount: number;
  urgency: "Low" | "Medium" | "High";
  requestedBy: string;
  targetDate: string;
  budget: string;
  stageCriterion: string;
  reason: string;
  employmentType: string;
  workMode: string;
  skills: string[];
  status: "Draft" | "Pending approval" | "Approved" | "Declined";
  createdAt: string;
}
export interface HiringJob {
  id: string;
  title: string;
  department: string;
  employmentType: string;
  workMode: string;
  location: string;
  openings: number;
  requestId?: string;
  description: string;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  benefits: string;
  mustHave: string[];
  niceSkills: string[];
  experience: string;
  education: string;
  languages: string;
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: string;
  currency: string;
  equity: string;
  showSalary: boolean;
  screening: string[];
  rounds: string[];
  visibility: string;
  deadline: string;
  autoClose: boolean;
  acknowledgement: string;
  status: HiringJobStatus;
  owner: string;
  createdAt: string;
  blindReview: boolean;
  showContext: boolean;
  practiceScores: boolean;
}
export interface HiringCandidate {
  id: string;
  jobId: string;
  name: string;
  headline: string;
  location: string;
  experience: string;
  skills: string[];
  stage: ApplicantStage;
  appliedAt: string;
  source: string;
  consent: boolean;
  summary: string;
  rating: number | null;
  notes: string;
}
export interface HiringInterview {
  id: string;
  jobId: string;
  candidate: string;
  round: string;
  format: string;
  date: string;
  duration: string;
  interviewers: string[];
  status: "Scheduled" | "Confirmed" | "Reschedule requested" | "Cancelled" | "Completed";
  agenda: string;
  timezone: string;
}
export interface HiringOffer {
  id: string;
  jobId: string;
  candidate: string;
  title: string;
  basePay: string;
  variable: string;
  equity: string;
  startDate: string;
  expiresAt: string;
  status: "Draft" | "Awaiting approval" | "Sent" | "Accepted" | "Declined" | "Expired";
  owner: string;
  notes: string;
}
export interface EmployerSettings {
  status: "Not started" | "Under review" | "Verified" | "Action needed";
  legalName: string;
  website: string;
  officialEmail: string;
  tagline: string;
  about: string;
  mission: string;
  values: string;
  benefits: string;
  locations: string;
  stageVisible: boolean;
  screeningDefaults: string;
  acknowledgement: string;
  blindReview: boolean;
  hours: string;
  timezone: string;
}
export interface HiringWorkspaceData {
  requests: HiringRequest[];
  jobs: HiringJob[];
  candidates: HiringCandidate[];
  interviews: HiringInterview[];
  offers: HiringOffer[];
  shortlists: string[];
  budget: { planned: string; committed: string };
  employer: EmployerSettings;
}
const KEY = "meridian-startup-hiring-v2";
const INITIAL: HiringWorkspaceData = HIRING_DEMO_DATA;
interface ContextValue {
  data: HiringWorkspaceData;
  setData: React.Dispatch<React.SetStateAction<HiringWorkspaceData>>;
  hydrated: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canViewCandidates: boolean;
  founder: string;
  startupName: string;
  stage: string;
  teamCount: number;
  stageDefinitions: StartupStageDefinition[];
}
const HiringContext = createContext<ContextValue | null>(null);
export function HiringWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { data: workspace } = useStartupWorkspace();
  const founder = workspace.startup.founderName;
  const user = workspace.team.find((member) => member.name === founder);
  const [data, setData] = useState(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<HiringWorkspaceData>;
        setData({
          ...INITIAL,
          ...parsed,
          budget: { ...INITIAL.budget, ...parsed.budget },
          shortlists: parsed.shortlists || [],
          employer: { ...INITIAL.employer, ...parsed.employer },
        });
      }
    } catch {
      /* Keep the page usable with a blank local workspace. */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* Local persistence is best effort. */
      }
    }
  }, [hydrated, data]);
  const value = useMemo(
    () => ({
      data,
      setData,
      hydrated,
      canEdit: !user || user.permission !== "Viewer",
      canApprove: !user || user.permission === "Owner" || user.permission === "Admin",
      canViewCandidates: !user || user.permission !== "Viewer",
      founder,
      startupName: workspace.startup.name,
      stage: workspace.startup.currentStage,
      teamCount: workspace.team.length,
      stageDefinitions: workspace.stages,
    }),
    [
      data,
      hydrated,
      user,
      founder,
      workspace.startup.name,
      workspace.startup.currentStage,
      workspace.team.length,
      workspace.stages,
    ],
  );
  return <HiringContext.Provider value={value}>{children}</HiringContext.Provider>;
}
export function useHiringWorkspace() {
  const value = useContext(HiringContext);
  if (!value) throw new Error("useHiringWorkspace must be used within HiringWorkspaceProvider");
  return value;
}
