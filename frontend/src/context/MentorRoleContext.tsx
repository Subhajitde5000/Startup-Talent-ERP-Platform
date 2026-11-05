"use client";
import { MENTOR_DEMO_DATA } from "@/data/mentorDemoData";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
export type MentorAvailability = "Accepting new startups" | "At capacity" | "Paused";
export type MentorRequestStatus = "Requested" | "Accepted" | "Declined" | "Countered" | "Expired";
export interface MentorRoleRequest {
  id: string;
  startupName: string;
  oneLiner: string;
  stage: string;
  sector: string;
  location: string;
  teamSize: string;
  goal: string;
  needs: string[];
  cadence: string;
  duration: string;
  feeTerms: string;
  equityTerms: string;
  message: string;
  sharedFiles: string[];
  status: MentorRequestStatus;
  createdAt: string;
  declineReason?: string;
  responseNote?: string;
  conflictNote?: string;
}
export interface MentorGoal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  successMeasure: string;
  owner: string;
  status: "Not started" | "In progress" | "Done" | "Proposed";
}
export interface MentorDeliverable {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  owner: string;
  status: "To do" | "In progress" | "Submitted" | "Accepted" | "Changes requested";
  feedback: string;
  manual: boolean;
  goal?: string;
  expectedFormat?: string;
  submittedAt?: string;
  submissionText?: string;
  rating?: "Does not meet" | "Meets" | "Exceeds";
  readinessItemId?: string;
  thread?: Array<{ id: string; body: string; date: string }>;
}
export interface MentorRoleSession {
  id: string;
  topic: string;
  date: string;
  duration: number;
  status:
    "Scheduled" | "Confirmed" | "Completed" | "Cancelled" | "Reschedule requested" | "No-show";
  manual: boolean;
  notes: string;
  attendees?: string[];
  type?: "Intro call" | "Regular" | "Review" | "Pitch practice";
  timezone?: string;
  agendaItems?: Array<{ id: string; title: string; covered: boolean }>;
  sharedNotes?: string;
  privateNotes?: string;
  summary?: string;
  decisions?: string;
  progress?: "On track" | "Behind" | "Ahead";
  actionItems?: Array<{ id: string; title: string; owner: string; dueDate: string }>;
  readinessTouched?: string[];
  sharedSummary?: boolean;
  recordingConsented?: boolean;
  feedbackReceived?: string;
  ratingReceived?: number;
}
export interface MentorReadinessItem {
  id?: string;
  title: string;
  status: string;
  note: string;
  shared: boolean;
  criteria?: string[];
  evidence?: string[];
  assignedMentor?: string;
  updatedAt?: string;
  history?: Array<{ date: string; actor: string; action: string; note: string }>;
}
export interface MentorStartup {
  id: string;
  startupName: string;
  stage: string;
  sector: string;
  status: "Active" | "Paused" | "Completed";
  startedAt: string;
  cadence: string;
  goals: MentorGoal[];
  deliverables: MentorDeliverable[];
  sessions: MentorRoleSession[];
  sharedCategories: string[];
  sharedFiles: string[];
  readinessItems: MentorReadinessItem[];
  sharedNotes: string[];
  privateNotes: string;
  activity: string[];
}
export interface MentorAgreement {
  id: string;
  startupId: string;
  startupName: string;
  status: "Draft" | "Proposed" | "Active" | "Amended" | "Ended" | "Disputed";
  version: number;
  feeModel: "Per session" | "Package" | "Monthly retainer" | "Free";
  rate: number;
  currency: string;
  cadence: string;
  duration: string;
  commissionPercent: number;
  equityType: string;
  equityShare: string;
  vesting: string;
  scope: string;
  startDate: string;
  endDate: string;
  noticeDays: number;
  versions: Array<{
    version: number;
    date: string;
    proposedBy: string;
    summary: string;
    active: boolean;
  }>;
}
export interface MentorPayment {
  id: string;
  startupId: string;
  startupName: string;
  sessionId?: string;
  item: string;
  date: string;
  gross: number;
  commissionPercent: number;
  tax: number;
  net: number;
  status: "Pending" | "Processing" | "Paid" | "Failed" | "Refunded" | "Disputed" | "On hold";
  currency: string;
  payoutId?: string;
}
export interface MentorEvent {
  id: string;
  title: string;
  date: string;
  timezone: string;
  format: "Online" | "In person" | "Hybrid";
  location: string;
  host: string;
  focus: string;
  stages: string[];
  description: string;
  access: "Open" | "Invite only" | "Waitlist" | "Full" | "Past";
  priorityOpensAt?: string;
  registrationDeadline?: string;
}
export interface MentorReview {
  id: string;
  startupId: string;
  startupName: string;
  date: string;
  rating: number;
  body: string;
  sessionId?: string;
  anonymous: boolean;
  verifiedSession: boolean;
  publicReply?: string;
  privateFeedback?: string;
  status: "Published" | "Under moderation";
}
export interface MentorChatMessage {
  id: string;
  body: string;
  date: string;
  sender: "Mentor" | "Startup" | "System";
  read?: boolean;
  files?: string[];
}
export interface MentorConversation {
  id: string;
  participantName: string;
  participantType: "Startup" | "Admin" | "Support";
  context: "Startup" | "Request" | "Session" | "Sign-off" | "Support";
  mentorshipId?: string;
  status?: "Active" | "Paused" | "Past" | "Pending";
  preview: string;
  updatedAt: string;
  unread: number;
  archived: boolean;
  readOnly: boolean;
  ticketRef?: string;
  messages: MentorChatMessage[];
  privateNote?: string;
}
export type MentorNotificationCategory =
  "Requests" | "Sessions" | "Sign-offs" | "Money" | "Events" | "System" | "Messages";
export interface MentorNotification {
  id: string;
  category: MentorNotificationCategory;
  title: string;
  detail: string;
  date: string;
  unread: boolean;
  href: string;
  urgent?: boolean;
  muted?: boolean;
  security?: boolean;
}
export interface MentorTicket {
  id: string;
  subject: string;
  category: string;
  status: "Open" | "Waiting for you" | "In progress" | "Resolved";
  updatedAt: string;
}
export interface MentorNotificationPreferences {
  channels: Record<string, { inApp: boolean; email: boolean; push: boolean }>;
  digest: "Instant" | "Daily" | "Weekly";
  quietStart: string;
  quietEnd: string;
  sessionReminders: number[];
  mutedStartups: string[];
  mutedCategories: string[];
}
export interface MentorRoleData {
  verifiedStatus: "Pending verification" | "Verified" | "Suspended";
  availability: MentorAvailability;
  capacity: number;
  requests: MentorRoleRequest[];
  startups: MentorStartup[];
  savedStartupIds: string[];
  privateProfile: {
    name: string;
    headline: string;
    sectors: string[];
    stages: string[];
    bio: string;
  };
  agreements: MentorAgreement[];
  payments: MentorPayment[];
  events: MentorEvent[];
  reviews: MentorReview[];
  publicImpact: boolean;
  impactStartupIds: string[];
  payoutPreferences: {
    schedule: string;
    minimumPayout: number;
    currency: string;
    notifications: boolean;
  };
  conversations: MentorConversation[];
  notifications: MentorNotification[];
  notificationPreferences: MentorNotificationPreferences;
  tickets: MentorTicket[];
  mentorSettings: {
    language: string;
    timezone: string;
    dateFormat: string;
    currencyDisplay: string;
    profileVisibility: boolean;
    showResponseTime: boolean;
    showStartupCount: boolean;
    showRating: boolean;
    showPastExits: boolean;
    analyticsOptIn: boolean;
    accountEmail: string;
    phone: string;
    connectedAccounts: {
      google: boolean;
      microsoft: boolean;
      calendar: boolean;
      linkedin: boolean;
    };
    defaultRole: string;
    twoFactorEnabled: boolean;
  };
}
const DEFAULT_NOTIFICATION_CHANNELS: MentorNotificationPreferences["channels"] = {
  "Startup requests and invitations": { inApp: true, email: true, push: true },
  Sessions: { inApp: true, email: true, push: true },
  "Session summary reminders": { inApp: true, email: true, push: false },
  "Sign-off and deliverable submissions": { inApp: true, email: true, push: false },
  Messages: { inApp: true, email: false, push: true },
  "Payments, payouts and tax documents": { inApp: true, email: true, push: false },
  Agreements: { inApp: true, email: true, push: false },
  "Reviews and impact": { inApp: true, email: false, push: false },
  "Investor events": { inApp: true, email: true, push: false },
  "Platform updates": { inApp: true, email: false, push: false },
  "Security alerts": { inApp: true, email: true, push: true },
};
const INITIAL: MentorRoleData = MENTOR_DEMO_DATA;
const KEY = "meridian-mentor-role-core-v2";
const C = createContext<{
  data: MentorRoleData;
  setData: React.Dispatch<React.SetStateAction<MentorRoleData>>;
  hydrated: boolean;
} | null>(null);
export function MentorRoleProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<MentorRoleData>;
        setData({
          ...INITIAL,
          ...saved,
          privateProfile: { ...INITIAL.privateProfile, ...saved.privateProfile },
          payoutPreferences: { ...INITIAL.payoutPreferences, ...saved.payoutPreferences },
          notificationPreferences: {
            ...INITIAL.notificationPreferences,
            ...saved.notificationPreferences,
            channels: {
              ...INITIAL.notificationPreferences.channels,
              ...saved.notificationPreferences?.channels,
            },
          },
          conversations: saved.conversations || [],
          notifications: saved.notifications || [],
          tickets: saved.tickets || [],
          mentorSettings: {
            ...INITIAL.mentorSettings,
            ...saved.mentorSettings,
            connectedAccounts: {
              ...INITIAL.mentorSettings.connectedAccounts,
              ...saved.mentorSettings?.connectedAccounts,
            },
          },
        });
      }
    } catch {
      /* Start with an empty, private mentor workspace */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* best-effort local persistence */
      }
  }, [hydrated, data]);
  const value = useMemo(() => ({ data, setData, hydrated }), [data, hydrated]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useMentorRole() {
  const value = useContext(C);
  if (!value) throw new Error("useMentorRole must be within MentorRoleProvider");
  return value;
}
