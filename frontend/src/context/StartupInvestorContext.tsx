"use client";
import { STARTUP_INVESTOR_DEMO_DATA } from "@/data/startupDemoData";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
export type Visibility = "Private" | "Mentors only" | "Mentors and verified investors";
export type PipelineStage =
  | "Interested"
  | "Intro / Talking"
  | "Meeting held"
  | "Data room"
  | "Offer"
  | "Committed"
  | "Passed"
  | "Declined by you";
export type InvestorType = "Angel" | "Angel group" | "Fund";
export type RoundState = "Planning" | "Open" | "Closing" | "Closed" | "Cancelled";
export interface InvestorRecord {
  id: string;
  name: string;
  firm: string;
  type: InvestorType;
  stage: PipelineStage;
  ticket: string;
  sector: string;
  location: string;
  owner: string;
  lastActivity: string;
  nextStep: string;
  nextStepDate: string;
  expectedAmount: number;
  probability: number;
  notes: string;
  manual: boolean;
  blocked: boolean;
  hidden: boolean;
  createdAt: string;
}
export interface InvestorFile {
  id: string;
  title: string;
  folder: string;
  size: string;
  updatedAt: string;
  uploadedBy: string;
  access: "Private" | "Public to approved investors" | "Per investor";
  views: number;
  sample?: boolean;
}
export interface InvestorAccessRequest {
  id: string;
  investorId: string;
  investorName: string;
  firm: string;
  scope: string[];
  message: string;
  date: string;
  nda: "Pending" | "Signed";
  status: "Pending" | "Approved" | "Declined";
}
export interface InvestorMeeting {
  id: string;
  investorId: string;
  investorName: string;
  type: string;
  date: string;
  duration: number;
  attendees: string[];
  agenda: string;
  status: "Scheduled" | "Confirmed" | "Reschedule requested" | "Cancelled" | "Completed";
  notes: string;
  outcome: string;
}
export interface InvestorMessage {
  id: string;
  investorId: string;
  investorName: string;
  body: string;
  date: string;
  status: "Local draft" | "Saved locally";
}
export interface RoundOffer {
  id: string;
  investorId: string;
  investorName: string;
  amount: number;
  instrument: string;
  status:
    "Offer received" | "Under review" | "Accepted" | "Declined" | "Committed" | "Funds received";
  date: string;
  notes: string;
  manual: boolean;
}
export interface FundraisingRound {
  id: string;
  name: string;
  type: string;
  target: number;
  minimum: number;
  maximum: number;
  instrument: string;
  valuation: string;
  discount: string;
  minimumTicket: number;
  openedAt: string;
  closingDate: string;
  visibility: "Visible on profile" | "Private";
  leadInvestor: string;
  useOfFunds: string;
  status: RoundState;
  offers: RoundOffer[];
  createdAt: string;
}
export interface InvestorSettings {
  visibility: Visibility;
  paused: boolean;
  profileSummary: boolean;
  traction: boolean;
  team: boolean;
  funding: boolean;
  round: boolean;
  readiness: boolean;
  watermark: boolean;
  downloadPolicy: "View only" | "Allow selected downloads";
  ndaRequired: boolean;
  accessExpiry: string;
  alerts: string[];
  blockedIds: string[];
  hiddenIds: string[];
}
export interface InvestorData {
  settings: InvestorSettings;
  investors: InvestorRecord[];
  files: InvestorFile[];
  accessRequests: InvestorAccessRequest[];
  meetings: InvestorMeeting[];
  messages: InvestorMessage[];
  rounds: FundraisingRound[];
  savedIds: string[];
}
const INITIAL: InvestorData = STARTUP_INVESTOR_DEMO_DATA;
const KEY = "meridian-startup-investor-workspace-v2";
const C = createContext<{
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  hydrated: boolean;
} | null>(null);
export function StartupInvestorProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<InvestorData>;
        setData({ ...INITIAL, ...saved, settings: { ...INITIAL.settings, ...saved.settings } });
      }
    } catch {
      /* Keep the private empty workspace */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* best-effort browser persistence */
      }
  }, [hydrated, data]);
  const value = useMemo(() => ({ data, setData, hydrated }), [data, hydrated]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useStartupInvestors() {
  const c = useContext(C);
  if (!c) throw new Error("useStartupInvestors must be used within StartupInvestorProvider");
  return c;
}
