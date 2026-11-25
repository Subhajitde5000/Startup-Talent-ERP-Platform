/**
 * The one shared API module for the frontend.
 *
 * - Base URL comes from NEXT_PUBLIC_API_URL (defaults to the same-origin
 *   "/api/v1", which next.config.js proxies to the backend).
 * - Bearer access token is attached automatically from memory only.
 * - A 401 triggers a single-flight refresh; the original request is retried
 *   once with the new access token.
 * - Every failure surfaces as an ApiError carrying the backend's
 *   { error: { code, message, details } } shape (422 validation errors are
 *   mapped into the same shape).
 *
 * No component should call fetch() directly — go through this module.
 */
import type { components, operations } from "./schema";

export type TokenResponse = components["schemas"]["TokenResponse"];
export type UserMeRead = components["schemas"]["UserMeRead"];
export type UserUpdate = components["schemas"]["UserUpdate"];
// Step 3 talent readiness (profile/resume/practice scores), NOT the 5f
// startup checklist: the backend has two schemas of this name, so the
// generated keys are module-qualified.
export type TalentReadinessRead =
  components["schemas"]["app__schemas__profile__ReadinessRead"];
export type DeleteRequestRead = components["schemas"]["DeleteRequestRead"];
export type SkillRead = components["schemas"]["SkillRead"];
export type RegisterRequest = components["schemas"]["RegisterRequest"];
export type RegisterResponse = components["schemas"]["RegisterResponse"];
export type LoginRequest = components["schemas"]["LoginRequest"];
export type VerifyEmailRequest = components["schemas"]["VerifyEmailRequest"];
export type ResendVerificationRequest = components["schemas"]["ResendVerificationRequest"];
export type ForgotPasswordRequest = components["schemas"]["ForgotPasswordRequest"];
export type ResetPasswordRequest = components["schemas"]["ResetPasswordRequest"];
export type MessageResponse = components["schemas"]["MessageResponse"];
export type VerifyEmailResponse = components["schemas"]["VerifyEmailResponse"];
export type UserRole = components["schemas"]["UserRole"];
export type OrganizationCreate = components["schemas"]["OrganizationCreate"];
export type OrganizationUpdate = components["schemas"]["OrganizationUpdate"];
export type OrganizationRead = components["schemas"]["OrganizationRead"];
export type OrganizationPublicRead = components["schemas"]["OrganizationPublicRead"];
export type MemberRead = components["schemas"]["MemberRead"];
export type MemberUpdate = components["schemas"]["MemberUpdate"];
export type InviteCreate = components["schemas"]["InviteCreate"];
export type InviteRead = components["schemas"]["InviteRead"];
export type MemberPage = components["schemas"]["MemberPage"];
export type TeamSummary = components["schemas"]["TeamSummary"];
export type BulkMemberAction = components["schemas"]["BulkMemberAction"];
export type BulkMemberResult = components["schemas"]["BulkMemberResult"];
export type BulkInviteRevoke = components["schemas"]["BulkInviteRevoke"];
export type BulkInviteResult = components["schemas"]["BulkInviteResult"];
export type OrgRole = components["schemas"]["OrgRole"];
export type Department = components["schemas"]["Department"];
export type TalentProfileRead = components["schemas"]["TalentProfileRead"];
export type TalentProfileUpdate = components["schemas"]["TalentProfileUpdate"];
export type MentorProfileRead = components["schemas"]["MentorProfileRead"];
export type MentorProfileUpdate = components["schemas"]["MentorProfileUpdate"];
export type NotificationPreferenceRead = components["schemas"]["NotificationPreferenceRead"];
export type NotificationPreferenceUpdate = components["schemas"]["NotificationPreferenceUpdate"];
export type StartupProfileRead = components["schemas"]["StartupProfileRead"];
export type StartupProfileUpdate = components["schemas"]["StartupProfileUpdate"];
export type StartupProfilePublicRead = components["schemas"]["StartupProfilePublicRead"];
export type StartupStage = components["schemas"]["StartupStage"];
export type ProfileVisibility = components["schemas"]["ProfileVisibility"];
export type MilestoneStatus = components["schemas"]["MilestoneStatus"];
export type MilestoneCreate = components["schemas"]["MilestoneCreate"];
export type MilestoneUpdate = components["schemas"]["MilestoneUpdate"];
export type MilestoneRead = components["schemas"]["MilestoneRead"];
export type MilestonePage = components["schemas"]["MilestonePage"];
export type TaskStatus = components["schemas"]["TaskStatus"];
export type TaskPriority = components["schemas"]["TaskPriority"];
export type TaskCreate = components["schemas"]["TaskCreate"];
export type TaskUpdate = components["schemas"]["TaskUpdate"];
export type TaskMove = components["schemas"]["TaskMove"];
export type TaskRead = components["schemas"]["app__schemas__task__TaskRead"];
export type TaskPage = components["schemas"]["app__schemas__task__TaskPage"];
export type ReadinessStatus = components["schemas"]["ReadinessStatus"];
export type ReadinessCriterionRead = components["schemas"]["ReadinessCriterionRead"];
export type ReadinessBoard = components["schemas"]["ReadinessBoard"];
export type ReadinessSummary = components["schemas"]["ReadinessSummary"];
export type ReadinessUpdate = components["schemas"]["ReadinessUpdate"];
export type ReadinessReject = components["schemas"]["ReadinessReject"];
// The per-org item shape repeats the global criterion plus this org's state.
export type ReadinessItem =
  components["schemas"]["app__schemas__readiness__ReadinessRead"];
// Step 5i/5j: stage summary, exit criteria and stage tools.
export type StageChange = components["schemas"]["StageChange"];
export type StageSummary = components["schemas"]["StageSummary"];
export type StageHistoryRead = components["schemas"]["StageHistoryRead"];
export type StageHistoryPage = components["schemas"]["StageHistoryPage"];
export type StageCriteriaBoard = components["schemas"]["StageCriteriaBoard"];
export type StageToolRead = components["schemas"]["StageToolRead"];
export type StageToolBoard = components["schemas"]["StageToolBoard"];
export type StageToolUpdate = components["schemas"]["StageToolUpdate"];
export type ToolStatus = components["schemas"]["ToolStatus"];

export type MetricKey = components["schemas"]["MetricKey"];
export type MetricSource = components["schemas"]["MetricSource"];
export type MetricUpsert = components["schemas"]["MetricUpsert"];
export type MetricRead = components["schemas"]["MetricRead"];
export type MetricPoint = components["schemas"]["MetricPoint"];
export type MetricHistory = components["schemas"]["MetricHistory"];
export type MetricPage = components["schemas"]["MetricPage"];
export type MetricLatestRead = components["schemas"]["MetricLatestRead"];

// --- Steps 5k / 5l: analytics Business tab and Market tab -----------------
export type BusinessAnalytics = components["schemas"]["BusinessAnalytics"];
export type BusinessKpi = components["schemas"]["BusinessKpi"];
export type BusinessCompleteness = components["schemas"]["BusinessCompleteness"];
export type CalculatedValue = components["schemas"]["CalculatedValue"];
export type FunnelStep = components["schemas"]["FunnelStep"];
export type RetentionBlock = components["schemas"]["RetentionBlock"];
export type SourceUsage = components["schemas"]["SourceUsage"];

export type MarketMetric = components["schemas"]["MarketMetric"];
export type MarketScenario = components["schemas"]["MarketScenario"];
export type MarketUnit = components["schemas"]["MarketUnit"];
export type MarketSourceType = components["schemas"]["MarketSourceType"];
export type Confidence = components["schemas"]["Confidence"];
export type CompetitorType = components["schemas"]["CompetitorType"];

export type MarketSizeRead = components["schemas"]["MarketSizeRead"];
export type MarketSizeBoard = components["schemas"]["MarketSizeBoard"];
export type MarketSizeUpsert = components["schemas"]["MarketSizeUpsert"];
export type CompetitorRead = components["schemas"]["CompetitorRead"];
export type CompetitorPage = components["schemas"]["CompetitorPage"];
export type CompetitorCreate = components["schemas"]["CompetitorCreate"];
export type CompetitorUpdate = components["schemas"]["CompetitorUpdate"];
// Step 5d: task labels and comments.
export type TaskLabelRead = components["schemas"]["TaskLabelRead"];
export type TaskLabelPage = components["schemas"]["TaskLabelPage"];
export type TaskLabelCreate = components["schemas"]["TaskLabelCreate"];
export type TaskLabelUpdate = components["schemas"]["TaskLabelUpdate"];
export type TaskLabelSet = components["schemas"]["TaskLabelSet"];
export type TaskCommentRead = components["schemas"]["TaskCommentRead"];
export type TaskCommentPage = components["schemas"]["TaskCommentPage"];
export type TaskCommentCreate = components["schemas"]["TaskCommentCreate"];
export type TaskCommentUpdate = components["schemas"]["TaskCommentUpdate"];
// Step 5g: the one read-only dashboard payload (schema regenerated:
// the startup-side DashboardSummary is module-qualified to disambiguate
// it from the 9l investor-workspace one).
export type DashboardSummary =
  components["schemas"]["app__schemas__dashboard__DashboardSummary"];
// Step 8a: the read-only mentor directory.
export type MentorDirectoryItem = components["schemas"]["MentorDirectoryItem"];
export type MentorDirectoryDetail = components["schemas"]["MentorDirectoryDetail"];
export type MentorDirectoryPage = components["schemas"]["MentorDirectoryPage"];
export type MentorSuggestionItem = components["schemas"]["MentorSuggestionItem"];
export type MentorSuggestionPage = components["schemas"]["MentorSuggestionPage"];
// Step 5h discovery read, reused by the mentor Discover page (Step 8b).
export type StartupDiscoveryItem = components["schemas"]["StartupDiscoveryItem"];
export type StartupDiscoveryPage = components["schemas"]["StartupDiscoveryPage"];
export type StartupDiscoveryDetail = {
  id: string;
  slug: string;
  name: string;
  logo_url?: string | null;
  tagline?: string | null;
  stage?: StartupStage | null;
  sector?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  founded_year?: number | null;
  website?: string | null;
  mentor_verified: boolean;
  readiness_score?: number | null;
  summary?: string | null;
  business_model?: string | null;
  problem?: string | null;
  solution?: string | null;
  market?: string | null;
  traction_summary?: string | null;
  ecosystem_goals?: string[];
  demo_url?: string | null;
  pitch_deck_url?: string | null;
  existing_mentorship_id?: string | null;
  existing_mentorship_status?: string | null;
  is_member?: boolean;
};

// --- Steps 8b / 8c / 8d: mentorships, availability, sessions --------------
export type MentorshipStatus = components["schemas"]["MentorshipStatus"];
export type MentorshipParticipant = components["schemas"]["MentorshipParticipant"];
export type MentorshipRead = components["schemas"]["MentorshipRead"];
export type MentorshipPage = components["schemas"]["MentorshipPage"];
export type MentorshipCreate = Omit<components["schemas"]["MentorshipCreate"], "mentor_id"> & {
  mentor_id?: string;
  mentor_handle?: string;
};
export type MentorshipUpdate = components["schemas"]["MentorshipUpdate"];
export type MentorshipEnd = components["schemas"]["MentorshipEnd"];
export type MentorshipStateChange = components["schemas"]["MentorshipStateChange"];
export type AvailabilitySlotIn = components["schemas"]["AvailabilitySlotIn"];
export type AvailabilitySlotRead = components["schemas"]["AvailabilitySlotRead"];
export type AvailabilityWeekIn = components["schemas"]["AvailabilityWeekIn"];
export type AvailabilityWeekRead = components["schemas"]["AvailabilityWeekRead"];
export type BookableSlot = components["schemas"]["BookableSlot"];
export type BookableSlotsRead = components["schemas"]["BookableSlotsRead"];
export type SessionStatus = components["schemas"]["SessionStatus"];
export type SessionAttendeeIn = components["schemas"]["SessionAttendeeIn"];
export type SessionAttendeeRead = components["schemas"]["SessionAttendeeRead"];
export type SessionCreate = components["schemas"]["SessionCreate"];
export type SessionReschedule = components["schemas"]["SessionReschedule"];
export type SessionCancel = components["schemas"]["SessionCancel"];
export type SessionComplete = components["schemas"]["SessionComplete"];
export type SessionNoShow = components["schemas"]["SessionNoShow"];
export type SessionRead = components["schemas"]["SessionRead"];
export type SessionPage = components["schemas"]["SessionPage"];

// Step 8e: mentor deliverables.
export type DeliverableStatus = components["schemas"]["DeliverableStatus"];
export type DeliverableCreate = components["schemas"]["DeliverableCreate"];
export type DeliverableUpdate = components["schemas"]["DeliverableUpdate"];
export type DeliverableRead = components["schemas"]["DeliverableRead"];
export type DeliverablePage = components["schemas"]["DeliverablePage"];

// Step 8h: the mentor's own earnings.
export type EarningStatus = components["schemas"]["EarningStatus"];
export type EarningRead = components["schemas"]["EarningRead"];
export type EarningPage = components["schemas"]["EarningPage"];
export type EarningSummary = components["schemas"]["EarningSummary"];

// Step 9a: startup funding rounds. Money fields are decimal strings (the
// backend serialises NUMERIC as strings); `committed_amount` is server-only
// in 9a (starts at 0, only 9i/9j write it) and `status` changes only through
// the transition endpoint, so neither appears on the Create/Update inputs.
export type FundingRoundType = components["schemas"]["FundingRoundType"];
export type RoundStatus = components["schemas"]["RoundStatus"];
export type InstrumentType = components["schemas"]["InstrumentType"];
export type FundingRoundCreate = components["schemas"]["FundingRoundCreate"];
export type FundingRoundUpdate = components["schemas"]["FundingRoundUpdate"];
export type FundingRoundRead = components["schemas"]["FundingRoundRead"];
export type FundingRoundPage = components["schemas"]["FundingRoundPage"];
export type FundingRoundSummary = components["schemas"]["FundingRoundSummary"];
export type StatusTransition = components["schemas"]["StatusTransition"];

// --- Step 9b: investor directory (startup view) -------------------------
export type InvestorDirectoryItem = components["schemas"]["InvestorDirectoryItem"];
export type InvestorDirectoryDetail = components["schemas"]["InvestorDirectoryDetail"];
export type InvestorDirectoryPage = components["schemas"]["InvestorDirectoryPage"];
export type InvestorDirectorySummary = components["schemas"]["InvestorDirectorySummary"];
export type InvestorDirectoryFacets = components["schemas"]["InvestorDirectoryFacets"];
export type InvestorType = components["schemas"]["InvestorType"];

/** Whitelisted filters for `investorDirectory.list` (Step 9b). */
export type InvestorDirectoryListQuery = {
  q?: string;
  investor_type?: InvestorType;
  sector?: string;
  stage_focus?: StartupStage;
  ticket_min?: number;
  ticket_max?: number;
  location?: string;
  verified_only?: boolean;
  sort?: "name" | "recent";
  limit?: number;
  offset?: number;
};

// --- Step 9c: startup discovery (investor view) --------------------------
export type InvestorStartupItem = components["schemas"]["InvestorStartupItem"];
export type InvestorStartupDetail = components["schemas"]["InvestorStartupDetail"];
export type InvestorStartupPage = components["schemas"]["InvestorStartupPage"];
export type InvestorStartupFilters = components["schemas"]["InvestorStartupFilters"];
export type InvestorRoundItem = components["schemas"]["InvestorRoundItem"];
export type InvestorRoundPage = components["schemas"]["InvestorRoundPage"];

/** Whitelisted filters for `investorDiscovery.list` (Step 9c). */
export type InvestorStartupListQuery = {
  sort?: "recent" | "name" | "stage" | "readiness";
  order?: "asc" | "desc";
  stage?: StartupStage;
  sector?: string;
  city?: string;
  q?: string;
  raise_min?: number;
  raise_max?: number;
  investment_ready_only?: boolean;
  limit?: number;
  offset?: number;
};

// --- Step 9d: preferences, saved searches, shortlist ---------------------
export type InvestorPreferenceRead = components["schemas"]["InvestorPreferenceRead"];
export type InvestorPreferenceUpdate = components["schemas"]["InvestorPreferenceUpdate"];
export type SavedSearchRead = components["schemas"]["SavedSearchRead"];
export type SavedSearchCreate = components["schemas"]["SavedSearchCreate"];
export type SavedSearchUpdate = components["schemas"]["SavedSearchUpdate"];
export type ShortlistEntryRead = components["schemas"]["ShortlistEntryRead"];
export type ShortlistEntryCreate = components["schemas"]["ShortlistEntryCreate"];
export type ShortlistEntryUpdate = components["schemas"]["ShortlistEntryUpdate"];
export type ShortlistStatus = components["schemas"]["ShortlistStatus"];

// --- Step 9e: investor pipeline (deals) ----------------------------------
export type PipelineStage = components["schemas"]["PipelineStage"];
export type InvestorDealRead = components["schemas"]["InvestorDealRead"];
export type InvestorDealCreate = components["schemas"]["InvestorDealCreate"];
export type InvestorDealUpdate = components["schemas"]["InvestorDealUpdate"];
export type InvestorDealPage = components["schemas"]["InvestorDealPage"];
export type InvestorDealSummary = components["schemas"]["InvestorDealSummary"];
export type InvestorDealHistoryItem = components["schemas"]["InvestorDealHistoryItem"];
export type InvestorDealHistoryPage = components["schemas"]["InvestorDealHistoryPage"];
export type StartupInvestorDealRead = components["schemas"]["StartupInvestorDealRead"];
export type StartupInvestorDealPage = components["schemas"]["StartupInvestorDealPage"];

/** Whitelisted filters for `investorDeals.list` (Step 9e). */
export type InvestorDealListQuery = {
  stage?: PipelineStage;
  q?: string;
  limit?: number;
  offset?: number;
};

/** Whitelisted filters for `startupInvestorDeals.list` (Step 9e). */
export type StartupInvestorDealListQuery = {
  limit?: number;
  offset?: number;
};

// --- Step 7a: organization job management -------------------------------
export type JobCreate = components["schemas"]["JobCreate"];
export type JobUpdate = components["schemas"]["JobUpdate"];
export type JobRead = components["schemas"]["JobRead"];
export type JobPage = components["schemas"]["JobPage"];
export type JobSummary = components["schemas"]["JobSummary"];
type JobQuery = NonNullable<operations["list_jobs_api_v1_organizations__org_id__jobs_get"]["parameters"]["query"]>;
export type JobListQuery = { [K in keyof JobQuery]?: Exclude<JobQuery[K], null> };

// --- Step 9f: engagement (investor requests + meetings) ------------------
export type RequestStatus = components["schemas"]["RequestStatus"];
export type EngagementRequestRead = components["schemas"]["EngagementRequestRead"];
export type EngagementRequestCreate = components["schemas"]["EngagementRequestCreate"];
export type EngagementRequestUpdate = components["schemas"]["EngagementRequestUpdate"];
export type EngagementRequestPage = components["schemas"]["EngagementRequestPage"];
export type EngagementRequestStartupRead = components["schemas"]["EngagementRequestStartupRead"];
export type EngagementRequestStartupPage = components["schemas"]["EngagementRequestStartupPage"];
export type EngagementRequestRespond = components["schemas"]["EngagementRequestRespond"];
export type MeetingRead = components["schemas"]["MeetingRead"];
export type MeetingCreate = components["schemas"]["MeetingCreate"];
export type MeetingUpdate = components["schemas"]["MeetingUpdate"];
export type MeetingStatus = components["schemas"]["MeetingStatus"];
export type MeetingStatusUpdate = components["schemas"]["MeetingStatusUpdate"];
export type MeetingPage = components["schemas"]["MeetingPage"];

/** Whitelisted filters for `engagement.listRequests` / `engagement.listMeetings` (Step 9f). */
export type EngagementListQuery = {
  status?: RequestStatus | MeetingStatus;
  limit?: number;
  offset?: number;
};

// --- Step 9i: offers --------------------------------------------------------
export type OfferStatus = components["schemas"]["OfferStatus"];
export type InvestorOfferRead = components["schemas"]["InvestorOfferRead"];
export type InvestorOfferCreate = components["schemas"]["InvestorOfferCreate"];
export type InvestorOfferUpdate = components["schemas"]["InvestorOfferUpdate"];
export type InvestorOfferCounter = components["schemas"]["InvestorOfferCounter"];
export type InvestorOfferPage = components["schemas"]["InvestorOfferPage"];
export type OfferVersionItem = components["schemas"]["OfferVersionItem"];
export type OfferHistoryPage = components["schemas"]["OfferHistoryPage"];
export type StartupOfferRead = components["schemas"]["StartupOfferRead"];
export type StartupOfferPage = components["schemas"]["StartupOfferPage"];

/** Whitelisted filters for `offers.list` (Step 9i). */
export type OfferListQuery = {
  status?: OfferStatus;
  limit?: number;
  offset?: number;
};

export type StartupOfferListQuery = {
  round_id?: string;
  limit?: number;
  offset?: number;
};

// --- Step 9j: commitments + portfolio --------------------------------------
export type CommitmentStatus = components["schemas"]["CommitmentStatus"];
export type CommitmentRead = components["schemas"]["CommitmentRead"];
export type CommitmentCreate = components["schemas"]["CommitmentCreate"];
export type CommitmentUpdate = components["schemas"]["CommitmentUpdate"];
export type CommitmentStatusUpdate = components["schemas"]["CommitmentStatusUpdate"];
export type CommitmentPage = components["schemas"]["CommitmentPage"];
export type HoldingRead = components["schemas"]["HoldingRead"];
export type HoldingCreate = components["schemas"]["HoldingCreate"];
export type HoldingUpdate = components["schemas"]["HoldingUpdate"];
export type HoldingStatusUpdate = components["schemas"]["HoldingStatusUpdate"];
export type HoldingPage = components["schemas"]["HoldingPage"];

/** Whitelisted filters for `commitments.list` (Step 9j). */
export type CommitmentListQuery = {
  status?: CommitmentStatus;
  limit?: number;
  offset?: number;
};

// --- Step 9k: diligence ----------------------------------------------------
export type DiligenceChecklistRead = components["schemas"]["DiligenceChecklistRead"];
export type DiligenceChecklistCreate = components["schemas"]["DiligenceChecklistCreate"];
export type DiligenceChecklistUpdate = components["schemas"]["DiligenceChecklistUpdate"];
export type DiligenceChecklistPage = components["schemas"]["DiligenceChecklistPage"];
export type DiligenceItemRead = components["schemas"]["DiligenceItemRead"];
export type DiligenceItemCreate = components["schemas"]["DiligenceItemCreate"];
export type DiligenceItemUpdate = components["schemas"]["DiligenceItemUpdate"];
export type DiligenceItemPage = components["schemas"]["DiligenceItemPage"];
export type DiligenceItemType = components["schemas"]["DiligenceItemType"];

// --- Step 9l: investor workspace (dashboard / insights / activity) --------
export type InvestorDashboardSummary =
  components["schemas"]["app__schemas__investor_workspace__DashboardSummary"];
export type NeedsReplyItem = components["schemas"]["NeedsReplyItem"];
export type UpcomingMeetingItem = components["schemas"]["UpcomingMeetingItem"];
export type InsightsResponse = components["schemas"]["InsightsResponse"];
export type MonthlyCount = components["schemas"]["MonthlyCount"];
export type YourFunnelStats = components["schemas"]["YourFunnelStats"];
export type ActivityEventRead = components["schemas"]["ActivityEventRead"];
export type ActivityPage = components["schemas"]["ActivityPage"];
export type ActivityStats = components["schemas"]["ActivityStats"];
export type DailyCount = components["schemas"]["DailyCount"];

// --- Step 9m: startup investor hub (read-only aggregates) ------------------
export type InvestorHubSummary = components["schemas"]["InvestorHubSummary"];
export type RoundProgress = components["schemas"]["RoundProgress"];
export type RoundProgressPage = components["schemas"]["RoundProgressPage"];
export type HubNeedsReplyItem = components["schemas"]["HubNeedsReplyItem"];
export type HubUpcomingMeetingItem = components["schemas"]["HubUpcomingMeetingItem"];

/** Whitelisted filters for `startups.discover` (Step 5h). */
export type StartupDiscoveryQuery = {
  limit?: number;
  offset?: number;
  sort?: "recent" | "name" | "stage";
  order?: "asc" | "desc";
  stage?: StartupStage;
  sector?: string;
  city?: string;
  q?: string;
};

/** Whitelisted filters for `mentorships.list` (Step 8b). */
export type MentorshipListQuery = {
  side?: "mentor" | "startup";
  status?: MentorshipStatus;
  org_id?: string;
  limit?: number;
  offset?: number;
};

/** Whitelisted filters for `metrics.list` (`period_from`/`period_to` inclusive). */
export type MetricListQuery = {
  metric_key?: MetricKey;
  period_from?: string;
  period_to?: string;
  limit?: number;
  offset?: number;
};

/** Whitelisted filters/sort shared by `tasks.list` and `tasks.listAll`. */
export type TaskListQuery = {
  sort?: "display_order" | "created_at" | "due_on";
  order?: "asc" | "desc";
  assignee_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  milestone_id?: string;
  due_this_week?: boolean;
  assigned_to_me?: boolean;
  /** Step 5d: only tasks carrying this label. */
  label_id?: string;
};

/** Whitelisted filters for `deliverables.list` (Step 8e, all server-side). */
export type DeliverableListQuery = {
  status?: DeliverableStatus;
  overdue_only?: boolean;
  limit?: number;
  offset?: number;
};

/** Whitelisted filters for `earnings.list` (Step 8h). */
export type EarningListQuery = {
  status?: EarningStatus;
  limit?: number;
  offset?: number;
};

/** Whitelisted filters/sort for `fundingRounds.list` (Step 9a). */
export type FundingRoundListQuery = {
  status?: RoundStatus;
  sort?: "created_at" | "closes_on" | "name";
  limit?: number;
  offset?: number;
};

/** Whitelisted filters/sorts for `mentors.list` (Step 8a). */
export type MentorListQuery = {
  limit?: number;
  offset?: number;
  sort?: "relevance" | "rating" | "price" | "experience";
  order?: "asc" | "desc";
  expertise?: string;
  sector?: string;
  language?: string;
  verified_only?: boolean;
  accepting_only?: boolean;
  free_only?: boolean;
  max_fee?: number;
  q?: string;
};

// Steps 8i/8j: reviews and workspace summaries.
export type ReviewCreate = components["schemas"]["ReviewCreate"];
export type ReviewRead = components["schemas"]["ReviewRead"];
export type MentorReviewPage = components["schemas"]["MentorReviewPage"];
export type PublicReviewPage = components["schemas"]["PublicReviewPage"];
export type WorkspaceRead = components["schemas"]["WorkspaceRead"];
export type MentorDashboardRead = components["schemas"]["MentorDashboardRead"];
export type ImpactRead = components["schemas"]["ImpactRead"];
export type StartupMentorshipOverview = components["schemas"]["StartupMentorshipOverview"];
export type ScopedReadinessBoard = components["schemas"]["ScopedReadinessBoard"];

// Step 4: generated contracts; no parallel HTTP/auth client.
export type FileRead = components["schemas"]["FileRead"];
export type FilePage = components["schemas"]["FilePage"];
export type FileKind = components["schemas"]["FileKind"];
export type FileUploadCreate = components["schemas"]["FileUploadCreate"];
export type FileUploadRead = components["schemas"]["FileUploadRead"];
export type FileDownloadRead = components["schemas"]["FileDownloadRead"];

export const FILE_ACCEPT: Record<FileKind, string> = {
  logo: ".png,.jpg,.jpeg,.webp", image: ".png,.jpg,.jpeg,.webp",
  resume: ".pdf,.docx", pitch_deck: ".pdf,.pptx", financial_model: ".pdf,.xlsx,.csv",
  legal: ".pdf,.docx", document: ".pdf,.docx,.txt", other: ".pdf,.docx,.txt",
};
const FILE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  pdf: "application/pdf", txt: "text/plain", csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function fileFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (error instanceof ApiError && Array.isArray(error.details)) {
    for (const detail of error.details) {
      if (Array.isArray(detail.loc) && typeof detail.msg === "string") {
        const field = detail.loc[detail.loc.length - 1];
        if (typeof field === "string") result[field] = detail.msg;
      }
    }
  }
  return result;
}

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api/v1").replace(/\/+$/, "");

const ACCESS_KEY = "forma.access_token";
const REFRESH_KEY = "forma.refresh_token";

/* ------------------------------------------------------------------ tokens */

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;

/** Remove legacy persistence without ever importing credentials from browser storage. */
function clearLegacyTokens(): void {
  if (typeof window === "undefined") return;
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try {
      window[kind].removeItem(ACCESS_KEY);
      window[kind].removeItem(REFRESH_KEY);
    } catch { /* Storage may be disabled. Session credentials still remain memory-only. */ }
  }
}
clearLegacyTokens();
export function getAccessToken(): string | null { return cachedAccessToken; }
export function getRefreshToken(): string | null { return cachedRefreshToken; }
export function setTokens(tokens: { access_token: string; refresh_token: string }): void {
  clearLegacyTokens();
  cachedAccessToken = tokens.access_token;
  cachedRefreshToken = tokens.refresh_token;
}
export function clearTokens(): void {
  cachedAccessToken = null;
  cachedRefreshToken = null;
  clearLegacyTokens();
}

/** Fired when the session is gone (refresh failed) so the app can react. */
export const UNAUTHENTICATED_EVENT = "forma:unauthenticated";

/* ------------------------------------------------------------------ errors */

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

/** Every failed request throws this. `code` is the backend's error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  // Standard shape: { error: { code, message, details? } }
  if (payload && typeof payload === "object" && "error" in payload) {
    const err = (payload as { error: ApiErrorBody }).error;
    if (err && typeof err.message === "string") {
      return new ApiError(status, err);
    }
  }
  // FastAPI 422: { detail: [{ loc, msg, type, ... }] } → map into our shape.
  if (status === 422 && Array.isArray((payload as { detail?: unknown })?.detail)) {
    const detail = (payload as { detail: Array<{ msg?: string; loc?: (string | number)[] }> })
      .detail;
    const message =
      detail.map((d) => d.msg).filter(Boolean).join("; ") || "Please check the highlighted fields.";
    return new ApiError(status, { code: "VALIDATION_ERROR", message, details: detail });
  }
  if (status === 401) {
    return new ApiError(status, { code: "UNAUTHORIZED", message: "Please sign in to continue." });
  }
  if (status === 403) {
    return new ApiError(status, {
      code: "FORBIDDEN",
      message: "You don’t have permission to do that.",
    });
  }
  if (status === 429) {
    return new ApiError(status, {
      code: "RATE_LIMITED",
      message: "Too many attempts. Please try again later.",
    });
  }
  if (status >= 500) {
    return new ApiError(status, {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our side. Please try again.",
    });
  }
  return new ApiError(status, { code: "REQUEST_FAILED", message: "Request failed." });
}

/**
 * Team list filters (Step 3d item 10) — all whitelisted server-side.
 * Extends Record<string, …> so it satisfies RequestOptions["query"] without
 * a cast (same shape apiRequest already expects).
 */
export interface MemberListQuery extends Record<
  string,
  string | number | boolean | undefined
> {
  role?: OrgRole;
  status?: "active" | "deactivated" | "invited" | "all";
  department?: Department;
  q?: string;
  sort?: "name" | "-name" | "joined" | "-joined" | "last_active" | "-last_active";
  limit?: number;
  offset?: number;
}

/**
 * GET /organizations/permissions. Derived from the endpoint's own response
 * rather than hand-written, so a backend matrix change flows through.
 */
export type PermissionMatrix =
  operations["get_permissions_api_v1_organizations_permissions_get"]["responses"][200]["content"]["application/json"];

/* ----------------------------------------------------------------- request */

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body. Omit for GET. */
  body?: unknown;
  /** Attach the bearer access token (default true). */
  auth?: boolean;
  /** Query string params; undefined values are dropped. */
  query?: Record<string, string | number | boolean | readonly string[] | null | undefined>;
  signal?: AbortSignal;
  responseType?: "blob";
}

async function rawFetch<T>(
  path: string,
  opts: RequestOptions,
  accessToken: string | null,
): Promise<T> {
  // Relative BASE_URL (the default) resolves against the page origin in the
  // browser; an absolute NEXT_PUBLIC_API_URL is used as-is. No window access
  // so the module stays SSR-safe.
  let url = BASE_URL + path;
  if (opts.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.query)) {
      if (Array.isArray(value)) value.forEach(item => params.append(key, item));
      else if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  // apiRequest passes a token for every request unless auth is explicitly
  // disabled. Use that resolved token here rather than opts.auth, whose
  // undefined default means "authenticated".
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(url, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;
  if (res.ok && opts.responseType === "blob") return await res.blob() as T;

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) throw toApiError(res.status, payload);
  return payload as T;
}

/** Single-flight refresh: concurrent 401s share one refresh call. */
let refreshInFlight: Promise<TokenResponse | null> | null = null;

async function refreshTokens(): Promise<TokenResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const tokens = await rawFetch<TokenResponse>(
        "/auth/refresh",
        { body: { refresh_token: refreshToken }, auth: false },
        null,
      );
      setTokens(tokens);
      return tokens;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function emitUnauthenticated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
  }
}

/**
 * Perform an API request. Throws ApiError on failure.
 * On 401 (with a stored refresh token) refreshes once and retries the
 * request a single time; if the refresh fails, tokens are cleared and the
 * `forma:unauthenticated` event fires.
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const withAuth = opts.auth !== false;
  const token = withAuth ? getAccessToken() : null;

  try {
    return await rawFetch<T>(path, opts, token);
  } catch (err) {
    const canRetry =
      err instanceof ApiError &&
      err.status === 401 &&
      withAuth &&
      getRefreshToken() !== null &&
      !path.startsWith("/auth/"); // never refresh-loop on auth endpoints themselves
    if (!canRetry) throw err;

    const tokens = await refreshTokens();
    if (!tokens) {
      emitUnauthenticated();
      throw err;
    }
    return rawFetch<T>(path, opts, tokens.access_token);
  }
}

/**
 * Like apiRequest, but returns the raw response body as text.
 *
 * Needed for non-JSON responses (the team CSV export). It reuses the SAME
 * auth header, ApiError mapping and single-flight refresh-then-retry rule
 * as apiRequest, so there is still exactly one request path in the app —
 * pages never call fetch() themselves.
 */
export async function apiRequestText(
  path: string,
  opts: RequestOptions = {},
): Promise<string> {
  const withAuth = opts.auth !== false;
  const read = async (token: string | null): Promise<string> => {
    let url = BASE_URL + path;
    if (opts.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(opts.query)) {
        if (Array.isArray(value)) value.forEach(item => params.append(key, item));
      else if (value !== undefined && value !== null) params.set(key, String(value));
      }
      const qs = params.toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { method: "GET", headers, signal: opts.signal });
    if (!res.ok) {
      const text = await res.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }
      throw toApiError(res.status, payload);
    }
    return res.text();
  };

  const token = withAuth ? getAccessToken() : null;
  try {
    return await read(token);
  } catch (err) {
    const canRetry =
      err instanceof ApiError &&
      err.status === 401 &&
      withAuth &&
      getRefreshToken() !== null;
    if (!canRetry) throw err;
    const tokens = await refreshTokens();
    if (!tokens) {
      emitUnauthenticated();
      throw err;
    }
    return read(tokens.access_token);
  }
}

/* -------------------------------------------------------- typed endpoints */

// Steps 9g/9h: contracts generated from backend OpenAPI.
export type RoomRead = components["schemas"]["RoomRead"];
export type RoomPut = components["schemas"]["RoomPut"];
export type FolderRead = components["schemas"]["FolderRead"];
export type FolderCreate = components["schemas"]["FolderCreate"];
export type FolderUpdate = components["schemas"]["FolderUpdate"];
export type DocumentRead = components["schemas"]["app__schemas__data_room__DocumentRead"];
export type DocumentCreate = components["schemas"]["app__schemas__data_room__DocumentCreate"];
export type DocumentUpdate = components["schemas"]["DocumentUpdate"];
export type VersionRead = components["schemas"]["VersionRead"];
export type AccessRead = components["schemas"]["AccessRead"];
export type AccessCreate = components["schemas"]["AccessCreate"];
export type AccessDecision = components["schemas"]["AccessDecision"];
export type NDAAcceptance = components["schemas"]["NDAAcceptance"];
export type ViewRead = components["schemas"]["ViewRead"];
export type InvestorRoomRead = components["schemas"]["InvestorRoomRead"];
export type InvestorFolderRead = components["schemas"]["InvestorFolderRead"];
export type InvestorDocumentRead = components["schemas"]["InvestorDocumentRead"];
export type RoomPage<T> = Omit<components["schemas"]["Page_FolderRead_"], "items"> & { items: T[] };
export type RoomQuery = { startup_org_id?: string; limit?: number; offset?: number; folder_id?: string; document_id?: string; status?: "pending" | "approved" | "denied" | "expired" | "revoked" };
const roomPath = (orgId: string) => `/organizations/${orgId}/data-room`;
const accessPath = "/investors/data-room-access-requests";

/** Development storage is signed too, but its loopback URL belongs to the server,
 * not the preview browser. Keep it on the existing same-origin API proxy. */
export function browserStorageUrl(value: string): string {
  try {
    const url = new URL(value);
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && /^\/api\/v1\/files\/local-(upload|serve)\//.test(url.pathname)) {
      return url.pathname + url.search;
    }
  } catch { /* Already-relative signed URLs need no conversion. */ }
  return value;
}

async function uploadPrivateFile(path: string, kind: FileKind, file: File, signal?: AbortSignal): Promise<FileRead> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const mime = FILE_MIME[extension];
  const maxMiB = kind === "image" || kind === "logo" ? 5 : kind === "resume" ? 10 : 25;
  if (!mime || !FILE_ACCEPT[kind].split(",").includes(`.${extension}`) || file.size <= 0 || file.size > maxMiB * 1024 * 1024) {
    throw new ApiError(422, { code: "VALIDATION_ERROR", message: `Choose a supported ${kind.replaceAll("_", " ")} file (maximum ${maxMiB} MiB).`, details: [{ loc: ["body", "file_name"], msg: `Supported: ${FILE_ACCEPT[kind]}; maximum ${maxMiB} MiB.` }] });
  }
  const reservation = await apiRequest<FileUploadRead>(path, {
    method: "POST", body: { kind, file_name: file.name, mime_type: mime, byte_size: file.size } satisfies FileUploadCreate, signal,
  });
  // Signed R2 PUT is intentionally not sent through authenticated apiRequest.
  // No cookies, platform bearer token, auto-refresh, or automatic byte retry.
  let response: Response;
  try {
    response = await fetch(browserStorageUrl(reservation.upload_url), {
      method: "PUT", headers: reservation.headers, body: file, credentials: "omit", redirect: "error", signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, { code: "STORAGE_UPLOAD_FAILED", message: "Could not upload to private storage. Check your connection and bucket CORS, then select the file again." });
  }
  if (!response.ok) throw new ApiError(response.status, { code: "STORAGE_UPLOAD_FAILED", message: "Private storage rejected the upload. Select the file again to get a fresh upload URL." });
  return api.files.confirm(reservation.file.id, signal);
}

// Step 7b/7c: request and response contracts come from generated OpenAPI.
export type MarketplaceJob = components["schemas"]["MarketplaceJob"];
export type HiringCompany = components["schemas"]["HiringCompany"];
export type ApplicationRead = components["schemas"]["ApplicationRead"];
export type ApplicationCreate = components["schemas"]["ApplicationCreate"];
export type ApplicationStage = components["schemas"]["ApplicationRead"]["stage"];
export type JobDiscoveryQuery = NonNullable<import("./schema").operations["search_authenticated_api_v1_jobs_get"]["parameters"]["query"]>;
export type HiringStartupQuery = NonNullable<import("./schema").operations["startups_authenticated_api_v1_hiring_startups_get"]["parameters"]["query"]>;
export type OwnApplicationQuery = NonNullable<import("./schema").operations["list_applications_api_v1_applications_get"]["parameters"]["query"]>;

// Step 7d: generated contracts, same bearer/refresh/error transport as all other features.
export type ApplicantRead = components["schemas"]["ApplicantRead"];
export type ApplicantQuery = NonNullable<import("./schema").operations["applicants_api_v1_organizations__org_id__jobs__job_id__applications_get"]["parameters"]["query"]>;
export type PipelinePatch = components["schemas"]["PipelinePatch"];
const pipelinePath = (orgId: string, jobId: string) => `/organizations/${orgId}/jobs/${jobId}`;
const applicantPath = (orgId: string, jobId: string, id: string) => `${pipelinePath(orgId, jobId)}/applications/${id}`;

// Steps 7e–7h: generated command/read/query contracts, shared transport.

export const api = {
  hiring: {
    cards: (org: string, query: NonNullable<operations["list_cards_api_v1_organizations__org_id__scorecards_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["CardPage"]>(`/organizations/${org}/scorecards`, { query, signal }),
    createCard: (org: string, body: components["schemas"]["CardCreate"], signal?: AbortSignal) => apiRequest<components["schemas"]["CardRead"]>(`/organizations/${org}/scorecards`, { method: "POST", body, signal }),
    card: (org: string, id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["CardRead"]>(`/organizations/${org}/scorecards/${id}`, { signal }),
    patchCard: (org: string, id: string, body: components["schemas"]["CardPatch"], signal?: AbortSignal) => apiRequest<components["schemas"]["CardRead"]>(`/organizations/${org}/scorecards/${id}`, { method: "PATCH", body, signal }),
    archiveCard: (org: string, id: string, signal?: AbortSignal) => apiRequest<void>(`/organizations/${org}/scorecards/${id}`, { method: "DELETE", signal }),
    jobCard: (org: string, job: string, signal?: AbortSignal) => apiRequest<components["schemas"]["CardRead"]>(`/organizations/${org}/jobs/${job}/scorecard`, { signal }),
    selectCard: (org: string, job: string, body: components["schemas"]["CardSelect"], signal?: AbortSignal) => apiRequest<components["schemas"]["CardRead"]>(`/organizations/${org}/jobs/${job}/scorecard`, { method: "PUT", body, signal }),
    scores: (org: string, job: string, id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["ApplicationEvaluation"]>(`/organizations/${org}/jobs/${job}/applications/${id}/scores`, { signal }),
    saveScores: (org: string, job: string, id: string, body: components["schemas"]["RatingsPut"], signal?: AbortSignal) => apiRequest<components["schemas"]["ApplicationEvaluation"]>(`/organizations/${org}/jobs/${job}/applications/${id}/scores/me`, { method: "PUT", body, signal }),
    compare: (org: string, job: string, query: NonNullable<operations["compare_api_v1_organizations__org_id__jobs__job_id__compare_get"]["parameters"]["query"]>, signal?: AbortSignal) => apiRequest<components["schemas"]["ComparisonRead"]>(`/organizations/${org}/jobs/${job}/compare`, { query, signal }),
    interviews: (org: string, query: NonNullable<operations["listing_api_v1_organizations__org_id__interviews_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewPage"]>(`/organizations/${org}/interviews`, { query, signal }),
    interview: (org: string, id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewRead"]>(`/organizations/${org}/interviews/${id}`, { signal }),
    attendance: (org: string, id: string, body: components["schemas"]["AttendancePut"], signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewRead"]>(`/organizations/${org}/interviews/${id}/attendance/me`, { method: "PUT", body, signal }),
    schedule: (org: string, body: components["schemas"]["InterviewCreate"], signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewRead"]>(`/organizations/${org}/interviews`, { method: "POST", body, signal }),
    reschedule: (org: string, id: string, body: components["schemas"]["InterviewPatch"], signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewRead"]>(`/organizations/${org}/interviews/${id}`, { method: "PATCH", body, signal }),
    participants: (org: string, id: string, body: components["schemas"]["ParticipantsPut"], signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewRead"]>(`/organizations/${org}/interviews/${id}/participants`, { method: "PUT", body, signal }),
    interviewTransition: (org: string, id: string, body: components["schemas"]["InterviewTransition"], signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewRead"]>(`/organizations/${org}/interviews/${id}/transitions`, { method: "POST", body, signal }),
    feedback: (org: string, id: string, query: NonNullable<operations["feedback_api_v1_organizations__org_id__interviews__id___feedback_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["FeedbackPage"]>(`/organizations/${org}/interviews/${id}/feedback`, { query, signal }),
    saveFeedback: (org: string, id: string, body: components["schemas"]["FeedbackPut"], signal?: AbortSignal) => apiRequest<components["schemas"]["FeedbackRead"]>(`/organizations/${org}/interviews/${id}/feedback/me`, { method: "PUT", body, signal }),
    ownInterviews: (query: NonNullable<operations["own_list_api_v1_interviews_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewPage"]>(`/interviews`, { query, signal }),
    ownInterview: (id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewRead"]>(`/interviews/${id}`, { signal }),
    ownAttendance: (id: string, body: components["schemas"]["AttendancePut"], signal?: AbortSignal) => apiRequest<components["schemas"]["InterviewRead"]>(`/interviews/${id}/attendance/me`, { method: "PUT", body, signal }),
    offers: (org: string, query: NonNullable<operations["listing_api_v1_organizations__org_id__job_offers_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferPage"]>(`/organizations/${org}/job-offers`, { query, signal }),
    offer: (org: string, id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers/${id}`, { signal }),
    offerDocument: (org: string, id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["FileDownloadRead"]>(`/organizations/${org}/job-offers/${id}/document-download`, { method: "POST", body: {}, signal }),
    createOffer: (org: string, body: components["schemas"]["OfferCreate"], signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers`, { method: "POST", body, signal }),
    patchOffer: (org: string, id: string, body: components["schemas"]["OfferPatch"], signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers/${id}`, { method: "PATCH", body, signal }),
    archiveOffer: (org: string, id: string, signal?: AbortSignal) => apiRequest<void>(`/organizations/${org}/job-offers/${id}`, { method: "DELETE", signal }),
    submitOffer: (org: string, id: string, body: components["schemas"]["ApprovalRequest"], signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers/${id}/submit`, { method: "POST", body, signal }),
    approvals: (org: string, id: string, query: NonNullable<operations["approvals_api_v1_organizations__org_id__job_offers__id___approvals_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["ApprovalPage"]>(`/organizations/${org}/job-offers/${id}/approvals`, { query, signal }),
    decideOffer: (org: string, id: string, body: components["schemas"]["ApprovalDecision"], signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers/${id}/approvals/me`, { method: "PUT", body, signal }),
    sendOffer: (org: string, id: string, body: components["schemas"]["Expected"], signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers/${id}/send`, { method: "POST", body, signal }),
    withdrawOffer: (org: string, id: string, body: components["schemas"]["Expected"], signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers/${id}/withdraw`, { method: "POST", body, signal }),
    reviseOffer: (org: string, id: string, body: components["schemas"]["OfferRevision"], signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers/${id}/revisions`, { method: "POST", body, signal }),
    expireOffer: (org: string, id: string, body: components["schemas"]["Expected"], signal?: AbortSignal) => apiRequest<components["schemas"]["StaffOfferRead"]>(`/organizations/${org}/job-offers/${id}/expire`, { method: "POST", body, signal }),
    ownOffers: (query: NonNullable<operations["own_list_api_v1_job_offers_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["OfferPage"]>(`/job-offers`, { query, signal }),
    ownOffer: (id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["OfferRead"]>(`/job-offers/${id}`, { signal }),
    ownOfferDocument: (id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["FileDownloadRead"]>(`/job-offers/${id}/document-download`, { method: "POST", body: {}, signal }),
    respondOffer: (id: string, body: components["schemas"]["OfferResponse"], signal?: AbortSignal) => apiRequest<components["schemas"]["OfferRead"]>(`/job-offers/${id}/respond`, { method: "POST", body, signal }),
    counterOffer: (id: string, body: components["schemas"]["OfferCounter"], signal?: AbortSignal) => apiRequest<components["schemas"]["OfferRead"]>(`/job-offers/${id}/counter`, { method: "POST", body, signal }),
    compareOffers: (query: NonNullable<operations["compare_api_v1_job_offers_compare_get"]["parameters"]["query"]>, signal?: AbortSignal) => apiRequest<components["schemas"]["OfferPage"]>(`/job-offers/compare`, { query, signal }),
    declineReasons: (query: NonNullable<operations["reasons_api_v1_job_offers_decline_reasons_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["DeclineReasonPage"]>(`/job-offers/decline-reasons`, { query, signal }),
    templates: (org: string, query: NonNullable<operations["template_list_api_v1_organizations__org_id__onboarding_templates_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["TemplatePage"]>(`/organizations/${org}/onboarding-templates`, { query, signal }),
    createTemplate: (org: string, body: components["schemas"]["OnboardingTemplateInput"], signal?: AbortSignal) => apiRequest<components["schemas"]["OnboardingTemplateRead"]>(`/organizations/${org}/onboarding-templates`, { method: "POST", body, signal }),
    template: (org: string, id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["OnboardingTemplateRead"]>(`/organizations/${org}/onboarding-templates/${id}`, { signal }),
    saveTemplate: (org: string, id: string, body: components["schemas"]["OnboardingTemplateInput"], signal?: AbortSignal) => apiRequest<components["schemas"]["OnboardingTemplateRead"]>(`/organizations/${org}/onboarding-templates/${id}`, { method: "PUT", body, signal }),
    archiveTemplate: (org: string, id: string, signal?: AbortSignal) => apiRequest<void>(`/organizations/${org}/onboarding-templates/${id}`, { method: "DELETE", signal }),
    hires: (org: string, query: NonNullable<operations["listing_api_v1_organizations__org_id__hires_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["HirePage"]>(`/organizations/${org}/hires`, { query, signal }),
    createHire: (org: string, body: components["schemas"]["HireCreate"], signal?: AbortSignal) => apiRequest<components["schemas"]["HireRead"]>(`/organizations/${org}/hires`, { method: "POST", body, signal }),
    hire: (org: string, id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["HireRead"]>(`/organizations/${org}/hires/${id}`, { signal }),
    patchHire: (org: string, id: string, body: components["schemas"]["HirePatch"], signal?: AbortSignal) => apiRequest<components["schemas"]["HireRead"]>(`/organizations/${org}/hires/${id}`, { method: "PATCH", body, signal }),
    hireTransition: (org: string, id: string, body: components["schemas"]["HireTransition"], signal?: AbortSignal) => apiRequest<components["schemas"]["HireRead"]>(`/organizations/${org}/hires/${id}/transitions`, { method: "POST", body, signal }),
    tasks: (org: string, id: string, query: NonNullable<operations["tasks_api_v1_organizations__org_id__hires__id___checklist_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["app__schemas__hiring_workflow__TaskPage"]>(`/organizations/${org}/hires/${id}/checklist`, { query, signal }),
    saveTask: (org: string, id: string, item: string, body: components["schemas"]["TaskPatch"], signal?: AbortSignal) => apiRequest<components["schemas"]["app__schemas__hiring_workflow__TaskRead"]>(`/organizations/${org}/hires/${id}/checklist/${item}`, { method: "PATCH", body, signal }),
    documents: (org: string, id: string, query: NonNullable<operations["documents_api_v1_organizations__org_id__hires__id___documents_get"]["parameters"]["query"]> = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["DocumentPage"]>(`/organizations/${org}/hires/${id}/documents`, { query, signal }),
    requestDocument: (org: string, id: string, body: components["schemas"]["app__schemas__hiring_workflow__DocumentCreate"], signal?: AbortSignal) => apiRequest<components["schemas"]["app__schemas__hiring_workflow__DocumentRead"]>(`/organizations/${org}/hires/${id}/documents`, { method: "POST", body, signal }),
    reviewDocument: (org: string, id: string, item: string, body: components["schemas"]["DocumentPatch"], signal?: AbortSignal) => apiRequest<components["schemas"]["app__schemas__hiring_workflow__DocumentRead"]>(`/organizations/${org}/hires/${id}/documents/${item}`, { method: "PATCH", body, signal }),
    hireDocument: (org: string, id: string, item: string, signal?: AbortSignal) => apiRequest<components["schemas"]["FileDownloadRead"]>(`/organizations/${org}/hires/${id}/documents/${item}/download`, { method: "POST", body: {}, signal }),
  },
  applicants: {
    list: (org: string, job: string, query: ApplicantQuery = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["ApplicantPage"]>(`${pipelinePath(org, job)}/applications`, { query, signal }),
    get: (org: string, job: string, id: string, signal?: AbortSignal) => apiRequest<ApplicantRead>(applicantPath(org, job, id), { signal }),
    update: (org: string, job: string, id: string, body: PipelinePatch) => apiRequest<ApplicantRead>(applicantPath(org, job, id), { method: "PATCH", body }),
    history: (org: string, job: string, id: string, query: {limit?: number; offset?: number} = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["StageEventPage"]>(`${applicantPath(org, job, id)}/stage-events`, { query, signal }),
    notes: (org: string, job: string, id: string, query: {limit?: number; offset?: number} = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["NotePage"]>(`${applicantPath(org, job, id)}/notes`, { query, signal }),
    addNote: (org: string, job: string, id: string, body: components["schemas"]["NoteCreate"]) => apiRequest<components["schemas"]["NoteRead"]>(`${applicantPath(org, job, id)}/notes`, { method: "POST", body }),
    deleteNote: (org: string, job: string, id: string, note: string) => apiRequest<void>(`${applicantPath(org, job, id)}/notes/${note}`, { method: "DELETE" }),
    settings: (org: string, job: string, body: components["schemas"]["ReviewSettingsPatch"]) => apiRequest<components["schemas"]["ReviewSettingsRead"]>(`${pipelinePath(org, job)}/review-settings`, { method: "PATCH", body }),
    resume: (org: string, job: string, id: string, query: { disposition?: "attachment" | "inline" } = {}, signal?: AbortSignal) =>
      apiRequest<FileDownloadRead>(`${applicantPath(org, job, id)}/resume-download`, { method: "POST", body: {}, query, signal }),
  },
  careers: {
    jobs: (query: JobDiscoveryQuery = {}, authenticated = false, signal?: AbortSignal) => apiRequest<components["schemas"]["MarketplaceJobPage"]>(`${authenticated ? "" : "/public"}/jobs`, { query, auth: authenticated, signal }),
    job: (id: string, authenticated = false, signal?: AbortSignal) => apiRequest<MarketplaceJob>(`${authenticated ? "" : "/public"}/jobs/${id}`, { auth: authenticated, signal }),
    company: (id: string, authenticated = false, signal?: AbortSignal) => apiRequest<HiringCompany>(`${authenticated ? "" : "/public"}/companies/${id}`, { auth: authenticated, signal }),
    startups: (query: HiringStartupQuery = {}, authenticated = false, signal?: AbortSignal) => apiRequest<components["schemas"]["HiringCompanyPage"]>(`${authenticated ? "" : "/public"}/hiring-startups`, { query, auth: authenticated, signal }),
    context: (id: string, signal?: AbortSignal) => apiRequest<components["schemas"]["ApplicationContext"]>(`/jobs/${id}/application-context`, { signal }),
    submit: (id: string, body: ApplicationCreate) => apiRequest<ApplicationRead>(`/jobs/${id}/applications`, { body }),
    applications: (query: OwnApplicationQuery = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["ApplicationPage"]>("/applications", { query, signal }),
    application: (id: string, signal?: AbortSignal) => apiRequest<ApplicationRead>(`/applications/${id}`, { signal }),
    history: (id: string, query: {limit?: number; offset?: number} = {}, signal?: AbortSignal) => apiRequest<components["schemas"]["StageEventPage"]>(`/applications/${id}/stage-events`, { query, signal }),
    withdraw: (id: string) => apiRequest<ApplicationRead>(`/applications/${id}/withdraw`, { body: {} }),
  },
  dataRooms: {
    get: (orgId: string, signal?: AbortSignal) => apiRequest<RoomRead>(roomPath(orgId), { signal }),
    save: (orgId: string, body: RoomPut) => apiRequest<RoomRead>(roomPath(orgId), { method: "PUT", body }),
    folders: (orgId: string, query: RoomQuery = {}, signal?: AbortSignal) => apiRequest<RoomPage<FolderRead>>(`${roomPath(orgId)}/folders`, { query, signal }),
    createFolder: (orgId: string, body: FolderCreate) => apiRequest<FolderRead>(`${roomPath(orgId)}/folders`, { body }),
    updateFolder: (orgId: string, id: string, body: FolderUpdate) => apiRequest<FolderRead>(`${roomPath(orgId)}/folders/${id}`, { method: "PATCH", body }),
    deleteFolder: (orgId: string, id: string) => apiRequest<void>(`${roomPath(orgId)}/folders/${id}`, { method: "DELETE" }),
    documents: (orgId: string, query: RoomQuery = {}, signal?: AbortSignal) => apiRequest<RoomPage<DocumentRead>>(`${roomPath(orgId)}/documents`, { query, signal }),
    createDocument: (orgId: string, body: DocumentCreate) => apiRequest<DocumentRead>(`${roomPath(orgId)}/documents`, { body }),
    updateDocument: (orgId: string, id: string, body: DocumentUpdate) => apiRequest<DocumentRead>(`${roomPath(orgId)}/documents/${id}`, { method: "PATCH", body }),
    deleteDocument: (orgId: string, id: string) => apiRequest<void>(`${roomPath(orgId)}/documents/${id}`, { method: "DELETE" }),
    versions: (orgId: string, id: string, query: RoomQuery = {}, signal?: AbortSignal) => apiRequest<RoomPage<VersionRead>>(`${roomPath(orgId)}/documents/${id}/versions`, { query, signal }),
    addVersion: (orgId: string, id: string, fileId: string) => apiRequest<VersionRead>(`${roomPath(orgId)}/documents/${id}/versions`, { body: { file_id: fileId } }),
    views: (orgId: string, query: RoomQuery = {}, signal?: AbortSignal) => apiRequest<RoomPage<ViewRead>>(`${roomPath(orgId)}/document-views`, { query, signal }),
    content: (id: string, versionId?: string, signal?: AbortSignal) => apiRequest<Blob>(`/data-room-documents/${id}/content`, { responseType: "blob", query: { version_id: versionId }, signal }),
  },
  dataRoomAccess: {
    create: (body: AccessCreate) => apiRequest<AccessRead>(accessPath, { body }),
    list: (query: RoomQuery = {}, signal?: AbortSignal) => apiRequest<RoomPage<AccessRead>>(accessPath, { query, signal }),
    get: (id: string, signal?: AbortSignal) => apiRequest<AccessRead>(`${accessPath}/${id}`, { signal }),
    forStartup: (orgId: string, query: RoomQuery = {}, signal?: AbortSignal) => apiRequest<RoomPage<AccessRead>>(`${roomPath(orgId)}/access-requests`, { query, signal }),
    decide: (orgId: string, id: string, body: AccessDecision) => apiRequest<AccessRead>(`${roomPath(orgId)}/access-requests/${id}/decisions`, { body }),
    nda: (id: string, signal?: AbortSignal) => apiRequest<Blob>(`${accessPath}/${id}/nda-content`, { responseType: "blob", signal }),
    acceptNda: (id: string, body: NDAAcceptance) => apiRequest<AccessRead>(`${accessPath}/${id}/nda-acceptances`, { body }),
    room: (orgId: string, signal?: AbortSignal) => apiRequest<InvestorRoomRead>(`/investors/data-rooms/${orgId}`, { signal }),
    folders: (orgId: string, query: RoomQuery = {}, signal?: AbortSignal) => apiRequest<RoomPage<InvestorFolderRead>>(`/investors/data-rooms/${orgId}/folders`, { query, signal }),
    documents: (orgId: string, query: RoomQuery = {}, signal?: AbortSignal) => apiRequest<RoomPage<InvestorDocumentRead>>(`/investors/data-rooms/${orgId}/documents`, { query, signal }),
  },
  files: {
    listPersonal: (query: {limit?: number; offset?: number; kind?: FileKind} = {}, signal?: AbortSignal) => apiRequest<FilePage>("/users/me/files", { query, signal }),
    uploadPersonal: (kind: FileKind, file: File, signal?: AbortSignal) => uploadPrivateFile("/users/me/files/upload-requests", kind, file, signal),
    listOrganization: (orgId: string, query: { limit?: number; offset?: number; kind?: FileKind } = {}, signal?: AbortSignal) =>
      apiRequest<FilePage>(`/organizations/${orgId}/files`, { query, signal }),
    get: (id: string, signal?: AbortSignal) => apiRequest<FileRead>(`/files/${id}`, { signal }),
    confirm: (id: string, signal?: AbortSignal) =>
      apiRequest<FileRead>(`/files/${id}/confirm`, { method: "POST", body: {}, signal }),
    remove: (id: string) => apiRequest<void>(`/files/${id}`, { method: "DELETE" }),
    download: (id: string, variant: "original" | "thumbnail" = "original", signal?: AbortSignal) =>
      apiRequest<FileDownloadRead>(`/files/${id}/download-url`, { method: "POST", body: { variant }, signal }).then(result => ({ ...result, url: browserStorageUrl(result.url) })),
    uploadOrganization: async (orgId: string, kind: FileKind, file: File, signal?: AbortSignal): Promise<FileRead> => {
      return uploadPrivateFile(`/organizations/${orgId}/files/upload-requests`, kind, file, signal);
    },
  },
  auth: {
    register: (body: RegisterRequest) =>
      apiRequest<RegisterResponse>("/auth/register", { body, auth: false }),

    login: async (body: LoginRequest) => {
      const tokens = await apiRequest<TokenResponse>("/auth/login", { body, auth: false });
      setTokens(tokens);
      return tokens;
    },

    logout: async () => {
      // The backend revokes the session by refresh-token hash: the token
      // goes in the body, not the Authorization header.
      const refreshToken = getRefreshToken();
      try {
        if (refreshToken) {
          await apiRequest<void>("/auth/logout", {
            method: "POST",
            body: { refresh_token: refreshToken },
            auth: false,
          });
        }
      } finally {
        clearTokens();
      }
    },

    logoutAll: async () => {
      try {
        await apiRequest<MessageResponse>("/auth/logout-all", { method: "POST" });
      } finally {
        clearTokens();
      }
    },

    refresh: () => refreshTokens(),

    verifyEmail: (body: VerifyEmailRequest) =>
      apiRequest<VerifyEmailResponse>("/auth/verify-email", { body, auth: false }),

    resendVerification: (body: ResendVerificationRequest) =>
      apiRequest<MessageResponse>("/auth/resend-verification", { body, auth: false }),

    forgotPassword: (body: ForgotPasswordRequest) =>
      apiRequest<MessageResponse>("/auth/forgot-password", { body, auth: false }),

    resetPassword: (body: ResetPasswordRequest) =>
      apiRequest<MessageResponse>("/auth/reset-password", { body, auth: false }),

    changePassword: (body: { current_password: string; new_password: string }) =>
      apiRequest<MessageResponse>("/auth/change-password", { body }),

    changeEmail: (body: { current_password: string; new_email: string }) =>
      apiRequest<MessageResponse>("/auth/change-email", { body }),

    addRole: (body: { role: UserRole }) =>
      apiRequest<MessageResponse>("/auth/add-role", { body }),
  },

  users: {
    /** Full self view (Step 3: profile fields included). */
    me: (signal?: AbortSignal) => apiRequest<UserMeRead>("/users/me", { method: "GET", signal }),

    /** PATCH own profile; only fields present in `body` are changed. */
    updateMe: (body: UserUpdate) =>
      apiRequest<UserMeRead>("/users/me", { method: "PATCH", body }),

    readiness: (signal?: AbortSignal) =>
      apiRequest<TalentReadinessRead>("/users/me/readiness", { method: "GET", signal }),

    /** Latest data (erasure) request, or null when none exists. */
    deleteRequest: (signal?: AbortSignal) =>
      apiRequest<DeleteRequestRead | null>("/users/me/delete-request", {
        method: "GET",
        signal,
      }),

    /** Open a new erasure request; 409 CONFLICT when one is already open. */
    createDeleteRequest: () =>
      apiRequest<DeleteRequestRead>("/users/me/delete-request", { method: "POST" }),
  },

  jobs: {
    list: (orgId: string, query?: JobListQuery, signal?: AbortSignal) =>
      apiRequest<JobPage>(`/organizations/${orgId}/jobs`, { query, signal }),
    summary: (orgId: string, signal?: AbortSignal) =>
      apiRequest<JobSummary>(`/organizations/${orgId}/jobs/summary`, { signal }),
    get: (orgId: string, jobId: string, signal?: AbortSignal) =>
      apiRequest<JobRead>(`/organizations/${orgId}/jobs/${jobId}`, { signal }),
    create: (orgId: string, body: JobCreate) =>
      apiRequest<JobRead>(`/organizations/${orgId}/jobs`, { method: "POST", body }),
    update: (orgId: string, jobId: string, body: JobUpdate) =>
      apiRequest<JobRead>(`/organizations/${orgId}/jobs/${jobId}`, { method: "PATCH", body }),
    publish: (orgId: string, jobId: string) =>
      apiRequest<JobRead>(`/organizations/${orgId}/jobs/${jobId}/publish`, { method: "POST", body: {} }),
    pause: (orgId: string, jobId: string) =>
      apiRequest<JobRead>(`/organizations/${orgId}/jobs/${jobId}/pause`, { method: "POST", body: {} }),
    close: (orgId: string, jobId: string) =>
      apiRequest<JobRead>(`/organizations/${orgId}/jobs/${jobId}/close`, { method: "POST", body: {} }),
    archive: (orgId: string, jobId: string) =>
      apiRequest<JobRead>(`/organizations/${orgId}/jobs/${jobId}/archive`, { method: "POST", body: {} }),
  },

  skills: {
    search: (opts: { q?: string; limit?: number; signal?: AbortSignal } = {}) =>
      apiRequest<SkillRead[]>("/skills", {
        method: "GET",
        query: { q: opts.q, limit: opts.limit },
        signal: opts.signal,
      }),
  },

  organizations: {
    /** Orgs where I am an active member (with my_role). */
    mine: (signal?: AbortSignal) =>
      apiRequest<OrganizationRead[]>("/organizations/mine", { method: "GET", signal }),

    /** Create; caller must hold the matching role (startup/employer/investor). */
    create: (body: OrganizationCreate) =>
      apiRequest<OrganizationRead>("/organizations", { method: "POST", body }),

    get: (orgId: string, signal?: AbortSignal) =>
      apiRequest<OrganizationRead>(`/organizations/${orgId}`, { method: "GET", signal }),

    /** Owner/admin patch. */
    update: (orgId: string, body: OrganizationUpdate) =>
      apiRequest<OrganizationRead>(`/organizations/${orgId}`, { method: "PATCH", body }),

    /**
     * Paginated member list (Step 3d item 10). Filtering, sorting and paging
     * happen in SQL, not in the browser.
     */
    members: (
      orgId: string,
      query?: MemberListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<MemberPage>(`/organizations/${orgId}/members`, {
        method: "GET",
        query,
        signal,
      }),

    /** Team counters, including the real open-job count from Step 7a. */
    teamSummary: (orgId: string, signal?: AbortSignal) =>
      apiRequest<TeamSummary>(`/organizations/${orgId}/team/summary`, {
        method: "GET",
        signal,
      }),

    /**
     * The permission matrix the page renders (Step 3d item 7). Public to any
     * authenticated caller, so the "Roles at a glance" text can never drift
     * from the rules the API actually enforces.
     */
    permissions: (signal?: AbortSignal) =>
      apiRequest<PermissionMatrix>("/organizations/permissions", { method: "GET", signal }),

    updateMember: (orgId: string, userId: string, body: MemberUpdate) =>
      apiRequest<MemberRead>(`/organizations/${orgId}/members/${userId}`, {
        method: "PATCH",
        body,
      }),

    removeMember: (orgId: string, userId: string) =>
      apiRequest<void>(`/organizations/${orgId}/members/${userId}`, { method: "DELETE" }),

    /** Step 3d item 1: access ends immediately, history stays. */
    deactivateMember: (orgId: string, userId: string) =>
      apiRequest<MemberRead>(`/organizations/${orgId}/members/${userId}/deactivate`, {
        method: "POST",
      }),

    reactivateMember: (orgId: string, userId: string) =>
      apiRequest<MemberRead>(`/organizations/${orgId}/members/${userId}/reactivate`, {
        method: "POST",
      }),

    /** Item 4: one transaction, all-or-nothing. */
    bulkMemberAction: (orgId: string, body: BulkMemberAction) =>
      apiRequest<BulkMemberResult>(`/organizations/${orgId}/members/bulk`, {
        method: "POST",
        body,
      }),

    /** Item 9: server-built CSV, owner/admin only. Returns the raw text. */
    exportMembersCsv: (orgId: string, signal?: AbortSignal) =>
      apiRequestText(`/organizations/${orgId}/members/export`, { signal }),

    transferOwnership: (orgId: string, userId: string) =>
      apiRequest<MemberRead[]>(`/organizations/${orgId}/transfer-ownership`, {
        method: "POST",
        body: { user_id: userId },
      }),

    /** Owner/admin invite; the accept link is emailed and `token` returned once. */
    createInvite: (orgId: string, body: InviteCreate) =>
      apiRequest<InviteRead>(`/organizations/${orgId}/invites`, { method: "POST", body }),

    invites: (orgId: string, signal?: AbortSignal) =>
      apiRequest<InviteRead[]>(`/organizations/${orgId}/invites`, { method: "GET", signal }),

    /** Item 2: issues a NEW token, so the old accept link stops working. */
    resendInvite: (orgId: string, inviteId: string) =>
      apiRequest<InviteRead>(`/organizations/${orgId}/invites/${inviteId}/resend`, {
        method: "POST",
      }),

    /** Item 4 for invites: all-or-nothing. */
    bulkRevokeInvites: (orgId: string, body: BulkInviteRevoke) =>
      apiRequest<BulkInviteResult>(`/organizations/${orgId}/invites/bulk-revoke`, {
        method: "POST",
        body,
      }),

    revokeInvite: (orgId: string, inviteId: string) =>
      apiRequest<void>(`/organizations/${orgId}/invites/${inviteId}`, { method: "DELETE" }),
  },

  invites: {
    /** Accept as the invited user (email must match). */
    accept: (token: string) =>
      apiRequest<OrganizationRead>(`/invites/${token}/accept`, { method: "POST" }),
  },

  talentProfile: {
    /** Null until the candidate saves once. */
    me: (signal?: AbortSignal) =>
      apiRequest<TalentProfileRead | null>("/talent-profile/me", { method: "GET", signal }),

    /** Upsert; `skills` is a replace-set of names. */
    updateMe: (body: TalentProfileUpdate) =>
      apiRequest<TalentProfileRead>("/talent-profile/me", { method: "PATCH", body }),
  },

  mentorProfile: {
    me: (signal?: AbortSignal) =>
      apiRequest<MentorProfileRead | null>("/mentor-profile/me", { method: "GET", signal }),

    updateMe: (body: MentorProfileUpdate) =>
      apiRequest<MentorProfileRead>("/mentor-profile/me", { method: "PATCH", body }),
  },

  /**
   * Step 8a: the read-only mentor directory. Any signed-in user may browse;
   * `suggestions` additionally needs an organization the caller belongs to.
   */
  mentors: {
    /** Filters/sorts are whitelisted server-side; unknown values are a 422. */
    list: (query: MentorListQuery = {}, signal?: AbortSignal) =>
      apiRequest<MentorDirectoryPage>("/mentors", { method: "GET", query, signal }),

    /** By public handle, never the user UUID. A hidden mentor is a 404. */
    get: (handle: string, signal?: AbortSignal) =>
      apiRequest<MentorDirectoryDetail>(`/mentors/${encodeURIComponent(handle)}`, {
        method: "GET",
        signal,
      }),

    /**
     * Ranked suggestions for one startup (active members only; 403 otherwise).
     * Each item carries `match_reasons` built from fields that actually
     * matched — there is no stored match score.
     */
    suggestions: (
      orgId: string,
      query: { limit?: number; offset?: number } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<MentorSuggestionPage>(
        `/organizations/${orgId}/mentor-suggestions`,
        { method: "GET", query, signal },
      ),
  },

  /**
   * Step 5h discovery: the signed-in startup directory. A mentor's roles
   * widen what they see, which is exactly the audience `/mentor/discover`
   * needs, so it reuses this read instead of growing a second one.
   */
  startups: {
    /** `GET /startups` — filters/sorts are whitelisted server-side. */
    discover: (query: HiringStartupQuery = {}, signal?: AbortSignal) =>
      apiRequest<StartupDiscoveryPage>("/startups", { method: "GET", query, signal }),

    /** `GET /startups/{identifier}` — full discoverable profile for signed-in viewers. */
    get: (identifier: string, signal?: AbortSignal) =>
      apiRequest<StartupDiscoveryDetail>(`/startups/${encodeURIComponent(identifier)}`, {
        method: "GET",
        signal,
      }),

    /** `GET /public/startups` — the same read, anonymously, public rows only. */
    discoverPublic: (query: HiringStartupQuery = {}, signal?: AbortSignal) =>
      apiRequest<StartupDiscoveryPage>("/public/startups", {
        method: "GET",
        query,
        signal,
        auth: false,
      }),
  },

  startupProfile: {
    /** Member shape; created on demand for a startup org (Step 5a). */
    get: (orgId: string, signal?: AbortSignal) =>
      apiRequest<StartupProfileRead>(`/organizations/${orgId}/startup-profile`, {
        method: "GET",
        signal,
      }),

    /** Owner/admin/member patch (viewer -> 403); server-owned fields 422. */
    update: (orgId: string, body: StartupProfileUpdate) =>
      apiRequest<StartupProfileRead>(`/organizations/${orgId}/startup-profile`, {
        method: "PATCH",
        body,
      }),

    /** Public/preview shape with visibility + visible_to_public flags. */
    preview: (orgId: string, signal?: AbortSignal) =>
      apiRequest<StartupProfilePublicRead>(
        `/organizations/${orgId}/startup-profile/preview`,
        { method: "GET", signal },
      ),
  },

  milestones: {
    /** Paginated list; whitelisted sort/order/status (Step 5b). */
    list: (
      orgId: string,
      query?: {
        limit?: number;
        offset?: number;
        sort?: "target_date" | "created_at" | "name" | "status";
        order?: "asc" | "desc";
        status?: MilestoneStatus;
      },
      signal?: AbortSignal,
    ) =>
      apiRequest<MilestonePage>(`/organizations/${orgId}/milestones`, {
        method: "GET",
        query,
        signal,
      }),

    get: (orgId: string, milestoneId: string, signal?: AbortSignal) =>
      apiRequest<MilestoneRead>(
        `/organizations/${orgId}/milestones/${milestoneId}`,
        { method: "GET", signal },
      ),

    /** Owner/admin/member create (viewer -> 403). Owner defaults to the caller. */
    create: (orgId: string, body: MilestoneCreate) =>
      apiRequest<MilestoneRead>(`/organizations/${orgId}/milestones`, {
        method: "POST",
        body,
      }),

    /** Owner/admin/member patch (viewer -> 403); server fields 422. */
    update: (orgId: string, milestoneId: string, body: MilestoneUpdate) =>
      apiRequest<MilestoneRead>(
        `/organizations/${orgId}/milestones/${milestoneId}`,
        { method: "PATCH", body },
      ),

    /** Soft delete (owner/admin/member; viewer -> 403). */
    remove: (orgId: string, milestoneId: string) =>
      apiRequest<void>(`/organizations/${orgId}/milestones/${milestoneId}`, {
        method: "DELETE",
      }),
  },

  tasks: {
    /** Paginated list; whitelisted sort/order and the 5c filters (AND-combined). */
    list: (
      orgId: string,
      query?: TaskListQuery & { limit?: number; offset?: number },
      signal?: AbortSignal,
    ) =>
      apiRequest<TaskPage>(`/organizations/${orgId}/tasks`, {
        method: "GET",
        query,
        signal,
      }),

    /**
     * Every task in the org, following the server's own pagination until
     * `total` is reached (limit caps at 100 per request). The board needs the
     * whole set, and this never silently truncates.
     */
    async listAll(
      orgId: string,
      query?: TaskListQuery,
      signal?: AbortSignal,
    ): Promise<TaskRead[]> {
      const pageSize = 100;
      const first = await apiRequest<TaskPage>(`/organizations/${orgId}/tasks`, {
        method: "GET",
        query: { ...query, limit: pageSize, offset: 0 },
        signal,
      });
      const items = [...first.items];
      while (items.length < first.total) {
        const next = await apiRequest<TaskPage>(`/organizations/${orgId}/tasks`, {
          method: "GET",
          query: { ...query, limit: pageSize, offset: items.length },
          signal,
        });
        if (next.items.length === 0) break; // defensive: never loop forever
        items.push(...next.items);
      }
      return items;
    },

    get: (orgId: string, taskId: string, signal?: AbortSignal) =>
      apiRequest<TaskRead>(`/organizations/${orgId}/tasks/${taskId}`, {
        method: "GET",
        signal,
      }),

    /** Owner/admin/member create (viewer -> 403). Always starts in `todo`. */
    create: (orgId: string, body: TaskCreate) =>
      apiRequest<TaskRead>(`/organizations/${orgId}/tasks`, { method: "POST", body }),

    /** Fields only; status/completed_at/display_order go through `move`. */
    update: (orgId: string, taskId: string, body: TaskUpdate) =>
      apiRequest<TaskRead>(`/organizations/${orgId}/tasks/${taskId}`, {
        method: "PATCH",
        body,
      }),

    /**
     * The only writer of status / completed_at / display_order.
     * Pass `status` and/or one anchor (`before_id` XOR `after_id`).
     */
    move: (orgId: string, taskId: string, body: TaskMove) =>
      apiRequest<TaskRead>(`/organizations/${orgId}/tasks/${taskId}/move`, {
        method: "PATCH",
        body,
      }),

    /** Soft delete (owner/admin/member; viewer -> 403). */
    remove: (orgId: string, taskId: string) =>
      apiRequest<void>(`/organizations/${orgId}/tasks/${taskId}`, { method: "DELETE" }),
  },

  /** Step 5d: the org's label catalogue. Managing it is owner/admin. */
  taskLabels: {
    /** Any active member reads the catalogue (viewer included). */
    list: (
      orgId: string,
      query: { limit?: number; offset?: number; sort?: "name" | "created_at"; order?: "asc" | "desc"; q?: string } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<TaskLabelPage>(`/organizations/${orgId}/task-labels`, {
        method: "GET",
        query,
        signal,
      }),

    /**
     * Owner/admin only (viewer and member -> 403). A name already used in
     * any casing is a 409 `LABEL_NAME_TAKEN` on the name field.
     */
    create: (orgId: string, body: TaskLabelCreate) =>
      apiRequest<TaskLabelRead>(`/organizations/${orgId}/task-labels`, {
        method: "POST",
        body,
      }),

    /** Owner/admin rename or recolour; a foreign label id is 404. */
    update: (orgId: string, labelId: string, body: TaskLabelUpdate) =>
      apiRequest<TaskLabelRead>(`/organizations/${orgId}/task-labels/${labelId}`, {
        method: "PATCH",
        body,
      }),

    /** Owner/admin hard delete; links cascade, tasks survive. */
    remove: (orgId: string, labelId: string) =>
      apiRequest<void>(`/organizations/${orgId}/task-labels/${labelId}`, {
        method: "DELETE",
      }),

    /**
     * Replace-set for one task: the body is the complete set it should
     * carry afterwards, so attach and detach are one idempotent call.
     * Member+ (viewer -> 403); a label from another org is a 422.
     */
    setForTask: (orgId: string, taskId: string, body: TaskLabelSet) =>
      apiRequest<TaskLabelRead[]>(`/organizations/${orgId}/tasks/${taskId}/labels`, {
        method: "PUT",
        body,
      }),
  },

  /** Step 5d: flat task comments (threading/mentions arrive in Step 11). */
  taskComments: {
    /** Any active member reads the task's live comments, oldest first. */
    list: (
      orgId: string,
      taskId: string,
      query: { limit?: number; offset?: number } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<TaskCommentPage>(
        `/organizations/${orgId}/tasks/${taskId}/comments`,
        { method: "GET", query, signal },
      ),

    /** Member+ (viewer -> 403); rate-limited per actor (429). */
    create: (orgId: string, taskId: string, body: TaskCommentCreate) =>
      apiRequest<TaskCommentRead>(
        `/organizations/${orgId}/tasks/${taskId}/comments`,
        { method: "POST", body },
      ),

    /** The author only; anyone else (owners included) gets 403. */
    update: (orgId: string, taskId: string, commentId: string, body: TaskCommentUpdate) =>
      apiRequest<TaskCommentRead>(
        `/organizations/${orgId}/tasks/${taskId}/comments/${commentId}`,
        { method: "PATCH", body },
      ),

    /** The author, or an owner/admin. Soft delete; a repeat delete is 404. */
    remove: (orgId: string, taskId: string, commentId: string) =>
      apiRequest<void>(
        `/organizations/${orgId}/tasks/${taskId}/comments/${commentId}`,
        { method: "DELETE" },
      ),
  },

  /** Step 5g: the whole startup dashboard in one read-only call. */
  dashboard: {
    /**
     * Any active member (viewer included). Cards with no data source are
     * named in `unavailable`; money is withheld from viewers and named in
     * `restricted` — render those as absent, never as zero.
     */
    summary: (orgId: string, signal?: AbortSignal) =>
      apiRequest<DashboardSummary>(`/organizations/${orgId}/dashboard-summary`, {
        method: "GET",
        signal,
      }),
  },

  readiness: {
    /**
     * The six reference criteria (any authenticated caller). The board below
     * returns the same rows merged with this org's state, so pages normally
     * need only `board`; this endpoint is for checklists without an org.
     */
    criteria: (signal?: AbortSignal) =>
      apiRequest<ReadinessCriterionRead[]>("/readiness/criteria", {
        method: "GET",
        signal,
      }),

    /**
     * Criteria + this org's state + the score summary in one read.
     * Any active member (viewer included) may read. The server creates the
     * `not_started` rows on this read (5f plan D5), so the ids returned here
     * are always safe to link a task to.
     */
    board: (orgId: string, signal?: AbortSignal) =>
      apiRequest<ReadinessBoard>(`/organizations/${orgId}/readiness`, {
        method: "GET",
        signal,
      }),

    /** One item (any active member). */
    item: (orgId: string, criterionId: string, signal?: AbortSignal) =>
      apiRequest<ReadinessItem>(
        `/organizations/${orgId}/readiness/${criterionId}`,
        { method: "GET", signal },
      ),

    /** Evidence/notes only (owner/admin/member; viewer -> 403). */
    update: (orgId: string, criterionId: string, body: ReadinessUpdate) =>
      apiRequest<ReadinessItem>(
        `/organizations/${orgId}/readiness/${criterionId}`,
        { method: "PATCH", body },
      ),

    /** Send for review; 422 with `loc: ["body","evidence"]` when empty. */
    submit: (orgId: string, criterionId: string) =>
      apiRequest<ReadinessItem>(
        `/organizations/${orgId}/readiness/${criterionId}/submit`,
        { method: "POST" },
      ),

    /** Take a submitted item back (409 unless it is `submitted`). */
    withdraw: (orgId: string, criterionId: string) =>
      apiRequest<ReadinessItem>(
        `/organizations/${orgId}/readiness/${criterionId}/withdraw`,
        { method: "POST" },
      ),

    /**
     * `POST /mentorships/{id}/readiness/{criterion_id}/sign-off` (Step 8f).
     *
     * The mentor ON that row, and only while it is `active` (409 otherwise).
     * Every startup member — the owner included — gets 403, which is what
     * makes self-sign-off impossible. Independent of the admin route below.
     */
    mentorSignOff: (mentorshipId: string, criterionId: string) =>
      apiRequest<ReadinessItem>(
        `/mentorships/${mentorshipId}/readiness/${criterionId}/sign-off`,
        { method: "POST" },
      ),

    /** `POST …/revoke` — only the sign-off that came through this row (409). */
    mentorRevoke: (mentorshipId: string, criterionId: string) =>
      apiRequest<ReadinessItem>(
        `/mentorships/${mentorshipId}/readiness/${criterionId}/revoke`,
        { method: "POST" },
      ),

    /** Platform admin only (403 for every startup role). */
    signOff: (orgId: string, criterionId: string) =>
      apiRequest<ReadinessItem>(
        `/organizations/${orgId}/readiness/${criterionId}/sign-off`,
        { method: "POST" },
      ),

    /** Platform admin only; the reason is required and stored in `notes`. */
    reject: (orgId: string, criterionId: string, body: ReadinessReject) =>
      apiRequest<ReadinessItem>(
        `/organizations/${orgId}/readiness/${criterionId}/reject`,
        { method: "POST", body },
      ),
  },

  stage: {
    /**
     * Current stage, when it started, and this stage's exit-criteria
     * roll-up (Step 5i). `readiness_pct` is the cached 5f score and is
     * null until readiness has scored the org — render it as unknown,
     * never as zero.
     */
    summary: (orgId: string, signal?: AbortSignal) =>
      apiRequest<StageSummary>(`/organizations/${orgId}/stage`, {
        method: "GET",
        signal,
      }),

    /**
     * Change the stage (owner/admin/member; viewer -> 403). The backend
     * records the history row in the same transaction.
     */
    change: (orgId: string, body: StageChange) =>
      apiRequest<StageSummary>(`/organizations/${orgId}/stage`, {
        method: "PATCH",
        body,
      }),

    /** Stage change history, newest first. */
    history: (
      orgId: string,
      query: { limit?: number; offset?: number } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<StageHistoryPage>(`/organizations/${orgId}/stage/history`, {
        method: "GET",
        query: { limit: query.limit, offset: query.offset },
        signal,
      }),

    /**
     * Exit criteria for ONE stage, each with this org's state. The items
     * are `startup_readiness` rows, so they carry the same evidence and
     * sign-off fields the readiness page uses (5i D1: one source of truth).
     */
    criteria: (orgId: string, stage: StartupStage, signal?: AbortSignal) =>
      apiRequest<StageCriteriaBoard>(
        `/organizations/${orgId}/stage/${stage}/criteria`,
        { method: "GET", signal },
      ),

    /** Tools for a stage, merged with this org's saved progress. */
    tools: (orgId: string, stage: StartupStage, signal?: AbortSignal) =>
      apiRequest<StageToolBoard>(`/organizations/${orgId}/stage/tools`, {
        method: "GET",
        query: { stage },
        signal,
      }),

    /** One tool. */
    tool: (orgId: string, toolKey: string, signal?: AbortSignal) =>
      apiRequest<StageToolRead>(
        `/organizations/${orgId}/stage/tools/${toolKey}`,
        { method: "GET", signal },
      ),

    /**
     * Save tool progress/notes (owner/admin/member; viewer -> 403). The
     * backend reconciles status and progress, so `done` always stores 100
     * and `not_started` always stores 0.
     */
    updateTool: (orgId: string, toolKey: string, body: StageToolUpdate) =>
      apiRequest<StageToolRead>(
        `/organizations/${orgId}/stage/tools/${toolKey}`,
        { method: "PATCH", body },
      ),
  },

  metrics: {
    /**
     * Latest value per key (any active member, viewer included). `missing`
     * lists the keys with no data yet, so a card can show an honest empty
     * state instead of 0.
     */
    latest: (orgId: string, signal?: AbortSignal) =>
      apiRequest<MetricLatestRead>(`/organizations/${orgId}/metrics/latest`, {
        method: "GET",
        signal,
      }),

    /** One key's history, newest period first: the trend/revenue charts. */
    history: (
      orgId: string,
      metricKey: MetricKey,
      query: { limit?: number; offset?: number } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<MetricHistory>(`/organizations/${orgId}/metrics/${metricKey}/history`, {
        method: "GET",
        query: { limit: query.limit, offset: query.offset },
        signal,
      }),

    /** Paginated list with filters; `period_from`/`period_to` are inclusive. */
    list: (orgId: string, query: MetricListQuery = {}, signal?: AbortSignal) =>
      apiRequest<MetricPage>(`/organizations/${orgId}/metrics`, {
        method: "GET",
        query: {
          metric_key: query.metric_key,
          period_from: query.period_from,
          period_to: query.period_to,
          limit: query.limit,
          offset: query.offset,
        },
        signal,
      }),

    /**
     * Upsert one (key, period). Owner/admin/member; a viewer gets 403. The
     * server writes `source`; a client-sent `source` is a 422, and a
     * verified row is a 409 rather than being overwritten.
     */
    upsert: (orgId: string, body: MetricUpsert) =>
      apiRequest<MetricRead>(`/organizations/${orgId}/metrics`, {
        method: "PUT",
        body,
      }),

    /** Hard delete a mistaken entry (owner/admin/member; 404 if not ours). */
    remove: (orgId: string, metricId: string) =>
      apiRequest<void>(`/organizations/${orgId}/metrics/${metricId}`, {
        method: "DELETE",
      }),
  },

  notificationPreferences: {
    get: (signal?: AbortSignal) =>
      apiRequest<NotificationPreferenceRead>("/users/me/notification-preferences", {
        method: "GET",
        signal,
      }),
    update: (items: NotificationPreferenceUpdate["items"]) =>
      apiRequest<NotificationPreferenceRead>("/users/me/notification-preferences", {
        method: "PATCH",
        body: { items },
      }),
  },

  publicApi: {
    organization: (slug: string, signal?: AbortSignal) =>
      apiRequest<OrganizationPublicRead>(`/public/organizations/${slug}`, {
        method: "GET",
        auth: false,
        signal,
      }),
    talent: (handle: string, signal?: AbortSignal) =>
      apiRequest<Record<string, unknown>>(`/public/talent/${handle}`, {
        method: "GET",
        auth: false,
        signal,
      }),
    mentor: (handle: string, signal?: AbortSignal) =>
      apiRequest<Record<string, unknown>>(`/public/mentors/${handle}`, {
        method: "GET",
        auth: false,
        signal,
      }),

    /** Visibility-gated startup profile; non-public profiles 404 (Step 5a). */
    startup: (slug: string, signal?: AbortSignal) =>
      apiRequest<StartupProfilePublicRead>(`/public/startups/${slug}`, {
        method: "GET",
        auth: false,
        signal,
      }),
  },

  /**
   * Analytics Business tab (Step 5k).
   *
   * One call answers the tab: reported KPIs carry their source, derived
   * figures (LTV:CAC, payback, net burn) are computed server-side, and
   * anything uncomputable is absent and named in `missing` — never 0.
   */
  analytics: {
    /**
     * `GET /organizations/{id}/analytics/business` — any active member
     * (viewer included). Read-only; values are entered through
     * `api.metrics.upsert`, which 5e already wired.
     */
    business: (orgId: string, signal?: AbortSignal) =>
      apiRequest<BusinessAnalytics>(
        `/organizations/${orgId}/analytics/business`,
        { method: "GET", signal },
      ),
  },

  /**
   * Market tab (Step 5l): market size and competitors.
   *
   * Market size is an upsert keyed by (metric, scenario), so saving the
   * same figure twice edits it. Reads are open to any active member;
   * writes need owner/admin/member (viewer gets 403).
   */
  market: {
    /** `GET /market-size` — every stored figure plus the pairs missing. */
    board: (orgId: string, signal?: AbortSignal) =>
      apiRequest<MarketSizeBoard>(`/organizations/${orgId}/market-size`, {
        method: "GET",
        signal,
      }),

    /** `PUT /market-size` — upsert one (metric, scenario) figure. */
    upsert: (orgId: string, payload: MarketSizeUpsert) =>
      apiRequest<MarketSizeRead>(`/organizations/${orgId}/market-size`, {
        method: "PUT",
        body: payload,
      }),

    /** `DELETE /market-size/{entryId}` — remove a figure. */
    remove: (orgId: string, entryId: string) =>
      apiRequest<void>(`/organizations/${orgId}/market-size/${entryId}`, {
        method: "DELETE",
      }),

    /** `GET /competitors` — paginated, live competitors only. */
    competitors: (
      orgId: string,
      query: { type?: CompetitorType; limit?: number; offset?: number } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<CompetitorPage>(`/organizations/${orgId}/competitors`, {
        method: "GET",
        query,
        signal,
      }),

    /** `POST /competitors` — a duplicate name in this org is a 409. */
    createCompetitor: (orgId: string, payload: CompetitorCreate) =>
      apiRequest<CompetitorRead>(`/organizations/${orgId}/competitors`, {
        method: "POST",
        body: payload,
      }),

    /** `PATCH /competitors/{id}` — only the fields sent change. */
    updateCompetitor: (
      orgId: string,
      competitorId: string,
      payload: CompetitorUpdate,
    ) =>
      apiRequest<CompetitorRead>(
        `/organizations/${orgId}/competitors/${competitorId}`,
        { method: "PATCH", body: payload },
      ),

    /** `DELETE /competitors/{id}` — soft delete, so it can be re-added. */
    deleteCompetitor: (orgId: string, competitorId: string) =>
      apiRequest<void>(
        `/organizations/${orgId}/competitors/${competitorId}`,
        { method: "DELETE" },
      ),
  },

  /**
   * Step 8b: mentorship requests and engagements.
   *
   * One resource, two sides. `viewer_side` on every row says which side the
   * caller is on, so the UI never has to compare user ids. An outsider gets
   * 404 (not 403) — the API will not confirm a mentorship exists.
   */
  mentorships: {
    /**
     * `GET /mentorships` — my mentorships on one side. A mentor lists with
     * `side: "mentor"`; a startup member with `side: "startup"`.
     */
    list: (query: MentorshipListQuery = {}, signal?: AbortSignal) =>
      apiRequest<MentorshipPage>("/mentorships", { method: "GET", query, signal }),

    /** `GET /mentorships/{id}` — participant only; otherwise 404. */
    get: (mentorshipId: string, signal?: AbortSignal) =>
      apiRequest<MentorshipRead>(`/mentorships/${mentorshipId}`, {
        method: "GET",
        signal,
      }),

    /**
     * `POST /organizations/{orgId}/mentorships` — a startup asks a mentor.
     * Owner/admin/member (viewer 403). 409 when the mentor is not accepting
     * or a mentorship already exists.
     */
    create: (orgId: string, body: MentorshipCreate) =>
      apiRequest<MentorshipRead>(`/organizations/${orgId}/mentorships`, {
        method: "POST",
        body,
      }),

    /** `PATCH /mentorships/{id}` — the startup revises a pending request. */
    update: (mentorshipId: string, body: MentorshipUpdate) =>
      apiRequest<MentorshipRead>(`/mentorships/${mentorshipId}`, {
        method: "PATCH",
        body,
      }),

    /** `POST …/accept` — mentor only; 409 unless the row is `requested`. */
    accept: (mentorshipId: string, body: MentorshipStateChange = {}) =>
      apiRequest<MentorshipRead>(`/mentorships/${mentorshipId}/accept`, {
        method: "POST",
        body,
      }),

    /** `POST …/decline` — mentor only. */
    decline: (mentorshipId: string, body: MentorshipStateChange = {}) =>
      apiRequest<MentorshipRead>(`/mentorships/${mentorshipId}/decline`, {
        method: "POST",
        body,
      }),

    /** `POST …/cancel` — either side withdraws. */
    cancel: (mentorshipId: string, body: MentorshipStateChange = {}) =>
      apiRequest<MentorshipRead>(`/mentorships/${mentorshipId}/cancel`, {
        method: "POST",
        body,
      }),

    /** `POST …/end` — either side completes the engagement. */
    end: (mentorshipId: string, body: MentorshipEnd = {}) =>
      apiRequest<MentorshipRead>(`/mentorships/${mentorshipId}/end`, {
        method: "POST",
        body,
      }),

    /** `POST …/pause` — either side; 409 unless `active`. */
    pause: (mentorshipId: string, body: MentorshipStateChange = {}) =>
      apiRequest<MentorshipRead>(`/mentorships/${mentorshipId}/pause`, {
        method: "POST",
        body,
      }),

    /** `POST …/resume` — either side; 409 unless `paused`. */
    resume: (mentorshipId: string, body: MentorshipStateChange = {}) =>
      apiRequest<MentorshipRead>(`/mentorships/${mentorshipId}/resume`, {
        method: "POST",
        body,
      }),

    /**
     * `GET /mentor/startups` — the mentor's own startups, every status.
     * Mentors only; the mentor workspace's "My startups" page reads this.
     */
    mentorStartups: (
      query: { limit?: number; offset?: number } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<MentorshipPage>("/mentor/startups", { method: "GET", query, signal }),
  },

  /**
   * Step 8c: a mentor's weekly availability.
   *
   * The read returns local wall-clock windows plus the IANA zone; only
   * `slots` returns concrete bookable instants, and those are the only thing
   * a session may be booked against.
   */
  availability: {
    /** `GET /mentor/availability` — my week. */
    mine: (signal?: AbortSignal) =>
      apiRequest<AvailabilityWeekRead>("/mentor/availability", {
        method: "GET",
        signal,
      }),

    /**
     * `PUT /mentor/availability` — atomic weekly replace. `slots: []` clears
     * the week; the overlap checks run before anything is deleted.
     */
    replaceWeek: (body: AvailabilityWeekIn) =>
      apiRequest<AvailabilityWeekRead>("/mentor/availability", {
        method: "PUT",
        body,
      }),

    /** `POST /mentor/availability` — add one window; 409 on overlap. */
    addSlot: (body: AvailabilitySlotIn) =>
      apiRequest<AvailabilitySlotRead>("/mentor/availability", {
        method: "POST",
        body,
      }),

    /** `DELETE /mentor/availability/{slotId}` — 404 if not mine. */
    removeSlot: (slotId: string) =>
      apiRequest<void>(`/mentor/availability/${slotId}`, { method: "DELETE" }),

    /**
     * `GET /mentors/{handle}/slots` — concrete free instants, computed from
     * the weekly template minus booked sessions. This is the ONLY source the
     * scheduling picker may offer, so a client can never book a taken slot.
     */
    slots: (
      handle: string,
      query: { from?: string; days?: number } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<BookableSlotsRead>(
        `/mentors/${encodeURIComponent(handle)}/slots`,
        { method: "GET", query, signal },
      ),

    /** `GET /mentors/{handle}/availability` — another mentor's published week. */
    mentorWeek: (handle: string, signal?: AbortSignal) =>
      apiRequest<AvailabilityWeekRead>(
        `/mentors/${encodeURIComponent(handle)}/availability`,
        { method: "GET", signal },
      ),
  },

  /**
   * Step 8e: mentor deliverables.
   *
   * Read authorization is "any active member of the startup, viewer
   * included"; writes are the mentor on the row, and the assignee may only
   * move `status`/`evidence`. `can_edit` is computed server-side, so the UI
   * never re-derives permission from ids.
   */
  deliverables: {
    /** `GET /mentorships/{id}/deliverables` — one engagement's work. */
    list: (
      mentorshipId: string,
      query: DeliverableListQuery = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<DeliverablePage>(`/mentorships/${mentorshipId}/deliverables`, {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `GET /deliverables/{id}` — member of the startup, else 404. */
    get: (deliverableId: string, signal?: AbortSignal) =>
      apiRequest<DeliverableRead>(`/deliverables/${deliverableId}`, {
        method: "GET",
        signal,
      }),

    /** `POST /mentorships/{id}/deliverables` — mentor on the row only. */
    create: (mentorshipId: string, body: DeliverableCreate) =>
      apiRequest<DeliverableRead>(`/mentorships/${mentorshipId}/deliverables`, {
        method: "POST",
        body,
      }),

    /**
     * `PATCH /deliverables/{id}` — mentor edits anything; the assignee may
     * only send `status`/`evidence` (403 otherwise). Illegal transitions are
     * 422 with `loc: ["body","status"]`.
     */
    update: (deliverableId: string, body: DeliverableUpdate) =>
      apiRequest<DeliverableRead>(`/deliverables/${deliverableId}`, {
        method: "PATCH",
        body,
      }),

    /** `DELETE /deliverables/{id}` — soft delete, mentor on the row. */
    remove: (deliverableId: string) =>
      apiRequest<void>(`/deliverables/${deliverableId}`, { method: "DELETE" }),


  },

  /**
   * Step 8h: the mentor's own earnings. Read-only — rows are created by
   * completing a paid session, and payouts belong to Step 14f.
   */
  earnings: {
    /** `GET /mentor/earnings` — mine only, newest first. */
    list: (query: EarningListQuery = {}, signal?: AbortSignal) =>
      apiRequest<EarningPage>("/mentor/earnings", {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `GET /mentor/earnings/summary` — the four dashboard totals. */
    summary: (signal?: AbortSignal) =>
      apiRequest<EarningSummary>("/mentor/earnings/summary", {
        method: "GET",
        signal,
      }),
  },

  /**
   * Step 9a: a startup's fundraising rounds.
   *
   * Reads are open to any active member (viewer included); writes need
   * owner/admin/member (viewer gets 403). A foreign round id is a 404 (the
   * API will not confirm another org's round exists). `committed_amount`
   * is server-only in 9a and `status` changes only through `changeStatus`.
   */
  fundingRounds: {
    /** `GET /organizations/{orgId}/funding-rounds` — newest first. */
    list: (
      orgId: string,
      query?: FundingRoundListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<FundingRoundPage>(`/organizations/${orgId}/funding-rounds`, {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `GET /organizations/{orgId}/funding-rounds/summary` — header roll-up. */
    summary: (orgId: string, signal?: AbortSignal) =>
      apiRequest<FundingRoundSummary>(`/organizations/${orgId}/funding-rounds/summary`, {
        method: "GET",
        signal,
      }),

    /** `GET /organizations/{orgId}/funding-rounds/{roundId}` — one round. */
    get: (orgId: string, roundId: string, signal?: AbortSignal) =>
      apiRequest<FundingRoundRead>(
        `/organizations/${orgId}/funding-rounds/${roundId}`,
        { method: "GET", signal },
      ),

    /** `POST /organizations/{orgId}/funding-rounds` — create (member+). */
    create: (orgId: string, body: FundingRoundCreate) =>
      apiRequest<FundingRoundRead>(`/organizations/${orgId}/funding-rounds`, {
        method: "POST",
        body,
      }),

    /**
     * `PATCH /organizations/{orgId}/funding-rounds/{roundId}` — edit fields
     * (member+). `status`/`committed_amount` are not editable here.
     */
    update: (orgId: string, roundId: string, body: FundingRoundUpdate) =>
      apiRequest<FundingRoundRead>(
        `/organizations/${orgId}/funding-rounds/${roundId}`,
        { method: "PATCH", body },
      ),

    /**
     * `POST /organizations/{orgId}/funding-rounds/{roundId}/status` — the
     * only way to change status (member+). An illegal move is a 409.
     */
    changeStatus: (orgId: string, roundId: string, status: RoundStatus) =>
      apiRequest<FundingRoundRead>(
        `/organizations/${orgId}/funding-rounds/${roundId}/status`,
        { method: "POST", body: { status } },
      ),

    /** `DELETE /organizations/{orgId}/funding-rounds/{roundId}` — soft delete. */
    remove: (orgId: string, roundId: string) =>
      apiRequest<void>(`/organizations/${orgId}/funding-rounds/${roundId}`, {
        method: "DELETE",
      }),
  },

  // --- Step 9b: investor directory (startup view) -----------------------
  investorDirectory: {
    /** `GET /organizations/{orgId}/investors` — filtered investor list. */
    list: (
      orgId: string,
      query?: InvestorDirectoryListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<InvestorDirectoryPage>(
        `/organizations/${orgId}/investors`,
        { method: "GET", query: query as Record<string, string | number | boolean | undefined>, signal },
      ),

    /** `GET /organizations/{orgId}/investors/summary` — header roll-up. */
    summary: (orgId: string, signal?: AbortSignal) =>
      apiRequest<InvestorDirectorySummary>(
        `/organizations/${orgId}/investors/summary`,
        { method: "GET", signal },
      ),

    /** `GET /organizations/{orgId}/investors/filters` — facet values. */
    filters: (orgId: string, signal?: AbortSignal) =>
      apiRequest<InvestorDirectoryFacets>(
        `/organizations/${orgId}/investors/filters`,
        { method: "GET", signal },
      ),

    /** `GET /organizations/{orgId}/investors/{investorOrgId}` — one firm. */
    get: (orgId: string, investorOrgId: string, signal?: AbortSignal) =>
      apiRequest<InvestorDirectoryDetail>(
        `/organizations/${orgId}/investors/${investorOrgId}`,
        { method: "GET", signal },
      ),
  },

  // --- Step 9c: startup discovery (investor view) ------------------------
  investorDiscovery: {
    /** `GET /investors/startups` — filtered startup list. */
    list: (
      query?: InvestorStartupListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<InvestorStartupPage>(`/investors/startups`, {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `GET /investors/startups/filters` — facet values. */
    filters: (signal?: AbortSignal) =>
      apiRequest<InvestorStartupFilters>(`/investors/startups/filters`, {
        method: "GET",
        signal,
      }),

    /** `GET /investors/startups/{identifier}` — one startup detail. */
    get: (identifier: string, signal?: AbortSignal) =>
      apiRequest<InvestorStartupDetail>(
        `/investors/startups/${encodeURIComponent(identifier)}`,
        { method: "GET", signal },
      ),

    /** `GET /investors/startups/{identifier}/rounds` — its rounds. */
    rounds: (
      identifier: string,
      query?: { limit?: number; offset?: number },
      signal?: AbortSignal,
    ) =>
      apiRequest<InvestorRoundPage>(
        `/investors/startups/${encodeURIComponent(identifier)}/rounds`,
        { method: "GET", query, signal },
      ),
  },

  // --- Step 9d: preferences, saved searches, shortlist --------------------
  investorPreferences: {
    /** `GET /investors/me/preferences` — current thesis filters. */
    get: (signal?: AbortSignal) =>
      apiRequest<InvestorPreferenceRead>(`/investors/me/preferences`, {
        method: "GET",
        signal,
      }),

    /** `PUT /investors/me/preferences` — full replace (member+). */
    update: (body: InvestorPreferenceUpdate) =>
      apiRequest<InvestorPreferenceRead>(`/investors/me/preferences`, {
        method: "PUT",
        body,
      }),
  },

  investorSearches: {
    /** `GET /investors/me/saved-searches` — my saved searches. */
    list: (signal?: AbortSignal) =>
      apiRequest<SavedSearchRead[]>(`/investors/me/saved-searches`, {
        method: "GET",
        signal,
      }),

    /** `POST /investors/me/saved-searches` — create (member+). */
    create: (body: SavedSearchCreate) =>
      apiRequest<SavedSearchRead>(`/investors/me/saved-searches`, {
        method: "POST",
        body,
      }),

    /** `PATCH /investors/me/saved-searches/{id}` — edit (member+). */
    update: (id: string, body: SavedSearchUpdate) =>
      apiRequest<SavedSearchRead>(`/investors/me/saved-searches/${id}`, {
        method: "PATCH",
        body,
      }),

    /** `DELETE /investors/me/saved-searches/{id}` — soft delete (member+). */
    remove: (id: string) =>
      apiRequest<void>(`/investors/me/saved-searches/${id}`, {
        method: "DELETE",
      }),

    /** `GET /investors/me/saved-searches/{id}/matches` — matching startups. */
    matches: (
      id: string,
      query?: { limit?: number; offset?: number },
      signal?: AbortSignal,
    ) =>
      apiRequest<InvestorStartupPage>(
        `/investors/me/saved-searches/${id}/matches`,
        { method: "GET", query, signal },
      ),
  },

  investorShortlist: {
    /** `GET /investors/me/shortlist` — my shortlisted startups. */
    list: (signal?: AbortSignal) =>
      apiRequest<ShortlistEntryRead[]>(`/investors/me/shortlist`, {
        method: "GET",
        signal,
      }),

    /** `POST /investors/me/shortlist` — add (member+). */
    add: (body: ShortlistEntryCreate) =>
      apiRequest<ShortlistEntryRead>(`/investors/me/shortlist`, {
        method: "POST",
        body,
      }),

    /** `PATCH /investors/me/shortlist/{id}` — edit note/status (member+). */
    update: (id: string, body: ShortlistEntryUpdate) =>
      apiRequest<ShortlistEntryRead>(`/investors/me/shortlist/${id}`, {
        method: "PATCH",
        body,
      }),

    /** `DELETE /investors/me/shortlist/{id}` — remove (member+). */
    remove: (id: string) =>
      apiRequest<void>(`/investors/me/shortlist/${id}`, {
        method: "DELETE",
      }),
  },

  // --- Step 9e: investor pipeline (deals) -------------------------------
  investorDeals: {
    /** `GET /investors/deals` — my firm's deals, newest activity first. */
    list: (query?: InvestorDealListQuery, signal?: AbortSignal) =>
      apiRequest<InvestorDealPage>(`/investors/deals`, {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `GET /investors/deals/summary` — counts per stage. */
    summary: (signal?: AbortSignal) =>
      apiRequest<InvestorDealSummary>(`/investors/deals/summary`, {
        method: "GET",
        signal,
      }),

    /** `POST /investors/deals` — open a deal (member+). */
    create: (body: InvestorDealCreate) =>
      apiRequest<InvestorDealRead>(`/investors/deals`, {
        method: "POST",
        body,
      }),

    /** `GET /investors/deals/{id}` — one deal. */
    get: (dealId: string, signal?: AbortSignal) =>
      apiRequest<InvestorDealRead>(`/investors/deals/${dealId}`, {
        method: "GET",
        signal,
      }),

    /** `PATCH /investors/deals/{id}` — edit (member+). */
    update: (dealId: string, body: InvestorDealUpdate) =>
      apiRequest<InvestorDealRead>(`/investors/deals/${dealId}`, {
        method: "PATCH",
        body,
      }),

    /** `DELETE /investors/deals/{id}` — soft delete (member+). */
    remove: (dealId: string) =>
      apiRequest<void>(`/investors/deals/${dealId}`, {
        method: "DELETE",
      }),

    /** `GET /investors/deals/{id}/history` — stage-change log. */
    history: (
      dealId: string,
      query?: { limit?: number; offset?: number },
      signal?: AbortSignal,
    ) =>
      apiRequest<InvestorDealHistoryPage>(
        `/investors/deals/${dealId}/history`,
        { method: "GET", query, signal },
      ),
  },

  // --- Step 9e: startup-side view of investor deals ----------------------
  startupInvestorDeals: {
    /** `GET /organizations/{orgId}/investor-deals` — deals targeting me. */
    list: (
      orgId: string,
      query?: StartupInvestorDealListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<StartupInvestorDealPage>(
        `/organizations/${orgId}/investor-deals`,
        {
          method: "GET",
          query: query as Record<string, string | number | boolean | undefined>,
          signal,
        },
      ),

    /** `GET /organizations/{orgId}/investor-deals/{investorOrgId}`. */
    get: (orgId: string, investorOrgId: string, signal?: AbortSignal) =>
      apiRequest<StartupInvestorDealRead>(
        `/organizations/${orgId}/investor-deals/${investorOrgId}`,
        { method: "GET", signal },
      ),

    /** `PATCH /organizations/{orgId}/investor-deals/{investorOrgId}` — stage only. */
    updateStage: (orgId: string, investorOrgId: string, stage: PipelineStage) =>
      apiRequest<StartupInvestorDealRead>(
        `/organizations/${orgId}/investor-deals/${investorOrgId}`,
        { method: "PATCH", body: { stage } },
      ),
  },

  reviews: {
    create: (sessionId: string, body: ReviewCreate) => apiRequest<ReviewRead>(`/sessions/${sessionId}/reviews`, { method: "POST", body }),
    mine: (sessionId: string, signal?: AbortSignal) => apiRequest<ReviewRead>(`/sessions/${sessionId}/reviews/me`, { method: "GET", signal }),
    remove: (id: string) => apiRequest<void>(`/session-reviews/${id}`, { method: "DELETE" }),
    forMentor: (query: { limit?: number; offset?: number } = {}, signal?: AbortSignal) => apiRequest<MentorReviewPage>("/mentor/reviews", { method: "GET", query, signal }),
    public: (handle: string, query: { limit?: number; offset?: number } = {}, signal?: AbortSignal) => apiRequest<PublicReviewPage>(`/mentors/${encodeURIComponent(handle)}/reviews`, { method: "GET", query, signal }),
  },
  mentorWorkspace: {
    get: (id: string, signal?: AbortSignal) => apiRequest<WorkspaceRead>(`/mentorships/${id}/workspace`, { method: "GET", signal }),
    readiness: (id: string, signal?: AbortSignal) => apiRequest<ScopedReadinessBoard>(`/mentorships/${id}/readiness`, { method: "GET", signal }),
    dashboard: (query: { limit?: number; offset?: number } = {}, signal?: AbortSignal) => apiRequest<MentorDashboardRead>("/mentor/dashboard", { method: "GET", query, signal }),
    impact: (signal?: AbortSignal) => apiRequest<ImpactRead>("/mentor/impact", { method: "GET", signal }),
    overview: (orgId: string, query: { limit?: number; offset?: number } = {}, signal?: AbortSignal) => apiRequest<StartupMentorshipOverview>(`/organizations/${orgId}/mentorships/overview`, { method: "GET", query, signal }),
  },

  /**
   * Step 8d: mentoring sessions.
   *
   * `viewer_side` decides which actions to offer and `can_join` is computed
   * server-side, so the client never guesses whether a join link is live.
   */
  sessions: {
    /** `GET /sessions` — mine, newest scheduled first. */
    list: (
      query: { upcoming?: boolean; limit?: number; offset?: number } = {},
      signal?: AbortSignal,
    ) => apiRequest<SessionPage>("/sessions", { method: "GET", query, signal }),

    /** `GET /sessions/{id}` — participant only; otherwise 404. */
    get: (sessionId: string, signal?: AbortSignal) =>
      apiRequest<SessionRead>(`/sessions/${sessionId}`, { method: "GET", signal }),

    /** `GET /mentorships/{id}/sessions` — one engagement's sessions. */
    forMentorship: (
      mentorshipId: string,
      query: { limit?: number; offset?: number } = {},
      signal?: AbortSignal,
    ) =>
      apiRequest<SessionPage>(`/mentorships/${mentorshipId}/sessions`, {
        method: "GET",
        query,
        signal,
      }),

    /**
     * `POST /mentorships/{id}/sessions` — schedule. `scheduled_at` must carry
     * a timezone offset; 409 `SLOT_TAKEN` when the instant is double-booked.
     */
    create: (mentorshipId: string, body: SessionCreate) =>
      apiRequest<SessionRead>(`/mentorships/${mentorshipId}/sessions`, {
        method: "POST",
        body,
      }),

    /** `POST …/confirm` — either side confirms a scheduled session. */
    confirm: (sessionId: string) =>
      apiRequest<SessionRead>(`/sessions/${sessionId}/confirm`, { method: "POST" }),

    /** `POST …/reschedule` — 409 when the new instant is taken. */
    reschedule: (sessionId: string, body: SessionReschedule) =>
      apiRequest<SessionRead>(`/sessions/${sessionId}/reschedule`, {
        method: "POST",
        body,
      }),

    /** `POST …/cancel` — reason is required (min 3 chars). */
    cancel: (sessionId: string, body: SessionCancel) =>
      apiRequest<SessionRead>(`/sessions/${sessionId}/cancel`, {
        method: "POST",
        body,
      }),

    /** `POST …/complete` — mentor only; writes the summary + action items. */
    complete: (sessionId: string, body: SessionComplete) =>
      apiRequest<SessionRead>(`/sessions/${sessionId}/complete`, {
        method: "POST",
        body,
      }),

    /** `POST …/no-show` — mentor only; 409 before the session starts. */
    noShow: (sessionId: string, body: SessionNoShow = {}) =>
      apiRequest<SessionRead>(`/sessions/${sessionId}/no-show`, {
        method: "POST",
        body,
      }),
  },

  // --- Step 9f: engagement (investor requests + meetings) -----------------
  /**
   * Step 9f: engagement requests and meetings.
   *
   * Requests: investor-side raise/edit/withdraw + the startup-side
   * respond (accept/decline) surfaced by `startup.*`. Meetings: the
   * investor proposes/edits and both sides transition status.
   */
  engagement: {
    /** `GET /investors/requests` — the investor's own requests. */
    listRequests: (
      query?: EngagementListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<EngagementRequestPage>("/investors/requests", {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `POST /investors/requests` — send a request (intro/meeting/information). */
    createRequest: (body: EngagementRequestCreate) =>
      apiRequest<EngagementRequestRead>("/investors/requests", {
        method: "POST",
        body,
      }),

    /** `GET /investors/requests/{id}` — one request. */
    getRequest: (requestId: string, signal?: AbortSignal) =>
      apiRequest<EngagementRequestRead>(`/investors/requests/${requestId}`, {
        method: "GET",
        signal,
      }),

    /** `PATCH /investors/requests/{id}` — edit ask/message (open only). */
    updateRequest: (requestId: string, body: EngagementRequestUpdate) =>
      apiRequest<EngagementRequestRead>(`/investors/requests/${requestId}`, {
        method: "PATCH",
        body,
      }),

    /** `POST /investors/requests/{id}/withdraw` — withdraw an open request. */
    withdrawRequest: (requestId: string) =>
      apiRequest<EngagementRequestRead>(
        `/investors/requests/${requestId}/withdraw`,
        { method: "POST" },
      ),

    /** `GET /investors/meetings` — the investor's meetings, newest first. */
    listMeetings: (
      query?: EngagementListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<MeetingPage>("/investors/meetings", {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `POST /investors/meetings` — propose a meeting (status `proposed`). */
    createMeeting: (body: MeetingCreate) =>
      apiRequest<MeetingRead>("/investors/meetings", {
        method: "POST",
        body,
      }),

    /** `GET /investors/meetings/{id}` — one meeting. */
    getMeeting: (meetingId: string, signal?: AbortSignal) =>
      apiRequest<MeetingRead>(`/investors/meetings/${meetingId}`, {
        method: "GET",
        signal,
      }),

    /** `PATCH /investors/meetings/{id}` — edit a proposed/confirmed meeting. */
    updateMeeting: (meetingId: string, body: MeetingUpdate) =>
      apiRequest<MeetingRead>(`/investors/meetings/${meetingId}`, {
        method: "PATCH",
        body,
      }),

    /**
     * `POST /investors/meetings/{id}/status` — confirm/cancel/complete.
     * An illegal move is a 409.
     */
    transitionMeeting: (meetingId: string, status: MeetingStatus) =>
      apiRequest<MeetingRead>(`/investors/meetings/${meetingId}/status`, {
        method: "POST",
        body: { status } satisfies MeetingStatusUpdate,
      }),

    /** `GET /organizations/{orgId}/investor-requests` — requests received. */
    listStartupRequests: (
      orgId: string,
      query?: EngagementListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<EngagementRequestStartupPage>(
        `/organizations/${orgId}/investor-requests`,
        {
          method: "GET",
          query: query as Record<string, string | number | boolean | undefined>,
          signal,
        },
      ),

    /** `GET /organizations/{orgId}/investor-requests/{id}` — one received. */
    getStartupRequest: (orgId: string, requestId: string, signal?: AbortSignal) =>
      apiRequest<EngagementRequestStartupRead>(
        `/organizations/${orgId}/investor-requests/${requestId}`,
        { method: "GET", signal },
      ),

    /**
     * `POST /organizations/{orgId}/investor-requests/{id}/respond` —
     * the startup accepts or declines (D2).
     */
    respondStartupRequest: (
      orgId: string,
      requestId: string,
      body: EngagementRequestRespond,
    ) =>
      apiRequest<EngagementRequestStartupRead>(
        `/organizations/${orgId}/investor-requests/${requestId}/respond`,
        { method: "POST", body },
      ),

    /** `GET /organizations/{orgId}/investor-meetings` — meetings of this startup. */
    listStartupMeetings: (
      orgId: string,
      query?: EngagementListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<MeetingPage>(`/organizations/${orgId}/investor-meetings`, {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /**
     * `PATCH /organizations/{orgId}/investor-meetings/{id}` — the startup
     * edits a proposed/confirmed meeting. Editing a confirmed meeting
     * re-proposes it (status returns to `proposed`).
     */
    updateStartupMeeting: (
      orgId: string,
      meetingId: string,
      body: MeetingUpdate,
    ) =>
      apiRequest<MeetingRead>(
        `/organizations/${orgId}/investor-meetings/${meetingId}`,
        { method: "PATCH", body },
      ),

    /** `POST /organizations/{orgId}/investor-meetings/{id}/status` — status transition. */
    transitionStartupMeeting: (
      orgId: string,
      meetingId: string,
      status: MeetingStatus,
    ) =>
      apiRequest<MeetingRead>(
        `/organizations/${orgId}/investor-meetings/${meetingId}/status`,
        { method: "POST", body: { status } satisfies MeetingStatusUpdate },
      ),
  },

  // --- Step 9i: offers -----------------------------------------------------
  /**
   * Step 9i: offers. `send` moves draft → sent; `counter` creates a new
   * version row (the parent is untouched, its status becomes `countered`);
   * `offerHistory` returns every version of the chain.
   */
  offers: {
    /** `GET /investors/offers` — the investor's offers, newest first. */
    list: (query?: OfferListQuery, signal?: AbortSignal) =>
      apiRequest<InvestorOfferPage>("/investors/offers", {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `POST /investors/offers` — create version v1 (status `draft`). */
    create: (body: InvestorOfferCreate) =>
      apiRequest<InvestorOfferRead>("/investors/offers", {
        method: "POST",
        body,
      }),

    /** `GET /investors/offers/{id}` — one offer version. */
    get: (offerId: string, signal?: AbortSignal) =>
      apiRequest<InvestorOfferRead>(`/investors/offers/${offerId}`, {
        method: "GET",
        signal,
      }),

    /** `PATCH /investors/offers/{id}` — edit fields (status/version immutable). */
    update: (offerId: string, body: InvestorOfferUpdate) =>
      apiRequest<InvestorOfferRead>(`/investors/offers/${offerId}`, {
        method: "PATCH",
        body,
      }),

    /** `POST /investors/offers/{id}/send` — draft → sent. */
    send: (offerId: string) =>
      apiRequest<InvestorOfferRead>(`/investors/offers/${offerId}/send`, {
        method: "POST",
      }),

    /** `POST /investors/offers/{id}/counter` — a new version row. */
    counter: (offerId: string, body: InvestorOfferCounter) =>
      apiRequest<InvestorOfferRead>(`/investors/offers/${offerId}/counter`, {
        method: "POST",
        body,
      }),

    /** `POST /investors/offers/{id}/withdraw` — withdraw an open offer. */
    withdraw: (offerId: string) =>
      apiRequest<InvestorOfferRead>(`/investors/offers/${offerId}/withdraw`, {
        method: "POST",
      }),

    /** `GET /investors/offers/{id}/history` — the full version chain. */
    history: (offerId: string, signal?: AbortSignal) =>
      apiRequest<OfferHistoryPage>(`/investors/offers/${offerId}/history`, {
        method: "GET",
        signal,
      }),

    /** `GET /organizations/{orgId}/investor-offers` — offers received by startup. */
    listForStartup: (
      orgId: string,
      query?: StartupOfferListQuery,
      signal?: AbortSignal,
    ) =>
      apiRequest<StartupOfferPage>(`/organizations/${orgId}/investor-offers`, {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `GET /organizations/{orgId}/investor-offers/{id}` — one offer. */
    getForStartup: (orgId: string, offerId: string, signal?: AbortSignal) =>
      apiRequest<StartupOfferRead>(
        `/organizations/${orgId}/investor-offers/${offerId}`,
        { method: "GET", signal },
      ),

    /** `POST /organizations/{orgId}/investor-offers/{id}/accept` — accept offer. */
    accept: (orgId: string, offerId: string) =>
      apiRequest<StartupOfferRead>(
        `/organizations/${orgId}/investor-offers/${offerId}/accept`,
        { method: "POST" },
      ),

    /** `POST /organizations/{orgId}/investor-offers/{id}/decline` — decline offer. */
    decline: (orgId: string, offerId: string) =>
      apiRequest<StartupOfferRead>(
        `/organizations/${orgId}/investor-offers/${offerId}/decline`,
        { method: "POST" },
      ),
  },

  // --- Step 9j: commitments + portfolio ------------------------------------
  /**
   * Step 9j: commitments and portfolio holdings. Status transitions go
   * through the dedicated endpoints (`status` is not PATCHable); exit
   * transitions on holdings may carry the exit date/value.
   */
  commitments: {
    /** `GET /investors/commitments` — the investor's commitments. */
    list: (query?: CommitmentListQuery, signal?: AbortSignal) =>
      apiRequest<CommitmentPage>("/investors/commitments", {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `POST /investors/commitments` — record a commitment. */
    create: (body: CommitmentCreate) =>
      apiRequest<CommitmentRead>("/investors/commitments", {
        method: "POST",
        body,
      }),

    /** `GET /investors/commitments/{id}` — one commitment. */
    get: (commitmentId: string, signal?: AbortSignal) =>
      apiRequest<CommitmentRead>(`/investors/commitments/${commitmentId}`, {
        method: "GET",
        signal,
      }),

    /** `PATCH /investors/commitments/{id}` — edit reference/committed_on. */
    update: (commitmentId: string, body: CommitmentUpdate) =>
      apiRequest<CommitmentRead>(`/investors/commitments/${commitmentId}`, {
        method: "PATCH",
        body,
      }),

    /**
     * `POST /investors/commitments/{id}/status` — pledge/document/fund/
     * cancel transition. An illegal move is a 409.
     */
    changeStatus: (commitmentId: string, status: CommitmentStatus) =>
      apiRequest<CommitmentRead>(
        `/investors/commitments/${commitmentId}/status`,
        { method: "POST", body: { status } satisfies CommitmentStatusUpdate },
      ),

    /** `GET /investors/portfolio` — the investor's holdings. */
    listHoldings: (query?: CommitmentListQuery, signal?: AbortSignal) =>
      apiRequest<HoldingPage>("/investors/portfolio", {
        method: "GET",
        query: query as Record<string, string | number | boolean | undefined>,
        signal,
      }),

    /** `POST /investors/portfolio` — add a holding. */
    createHolding: (body: HoldingCreate) =>
      apiRequest<HoldingRead>("/investors/portfolio", {
        method: "POST",
        body,
      }),

    /** `GET /investors/portfolio/{holdingId}` — one holding. */
    getHolding: (holdingId: string, signal?: AbortSignal) =>
      apiRequest<HoldingRead>(`/investors/portfolio/${holdingId}`, {
        method: "GET",
        signal,
      }),

    /** `PATCH /investors/portfolio/{holdingId}` — edit holding fields. */
    updateHolding: (holdingId: string, body: HoldingUpdate) =>
      apiRequest<HoldingRead>(`/investors/portfolio/${holdingId}`, {
        method: "PATCH",
        body,
      }),

    /**
     * `POST /investors/portfolio/{holdingId}/status` — status transition.
     * Exit transitions may carry `exited_on`/`exit_value`.
     */
    changeHoldingStatus: (holdingId: string, body: HoldingStatusUpdate) =>
      apiRequest<HoldingRead>(`/investors/portfolio/${holdingId}/status`, {
        method: "POST",
        body,
      }),
  },

  // --- Step 9k: diligence --------------------------------------------------
  /**
   * Step 9k: diligence checklists. `createChecklist` is idempotent per
   * startup (a second POST for the same startup returns the existing one);
   * items are investor-only and soft-deleted.
   */
  diligence: {
    /** `GET /investors/diligence` — the investor's checklists. */
    listChecklists: (query?: { limit?: number; offset?: number }, signal?: AbortSignal) =>
      apiRequest<DiligenceChecklistPage>("/investors/diligence", {
        method: "GET",
        query,
        signal,
      }),

    /**
     * `POST /investors/diligence` — create (idempotent per startup:
     * re-POSTing for the same startup returns the existing checklist).
     */
    createChecklist: (body: DiligenceChecklistCreate) =>
      apiRequest<DiligenceChecklistRead>("/investors/diligence", {
        method: "POST",
        body,
      }),

    /** `GET /investors/diligence/{checklistId}` — one checklist. */
    getChecklist: (checklistId: string, signal?: AbortSignal) =>
      apiRequest<DiligenceChecklistRead>(
        `/investors/diligence/${checklistId}`,
        { method: "GET", signal },
      ),

    /** `PATCH /investors/diligence/{checklistId}` — overall status/notes/scorecard. */
    updateChecklist: (checklistId: string, body: DiligenceChecklistUpdate) =>
      apiRequest<DiligenceChecklistRead>(
        `/investors/diligence/${checklistId}`,
        { method: "PATCH", body },
      ),

    /** `GET /investors/diligence/{checklistId}/items` — the item list. */
    listItems: (
      checklistId: string,
      query?: { limit?: number; offset?: number },
      signal?: AbortSignal,
    ) =>
      apiRequest<DiligenceItemPage>(
        `/investors/diligence/${checklistId}/items`,
        { method: "GET", query, signal },
      ),

    /** `POST /investors/diligence/{checklistId}/items` — add an item. */
    createItem: (checklistId: string, body: DiligenceItemCreate) =>
      apiRequest<DiligenceItemRead>(
        `/investors/diligence/${checklistId}/items`,
        { method: "POST", body },
      ),

    /** `PATCH …/items/{itemId}` — edit an item's fields. */
    updateItem: (checklistId: string, itemId: string, body: DiligenceItemUpdate) =>
      apiRequest<DiligenceItemRead>(
        `/investors/diligence/${checklistId}/items/${itemId}`,
        { method: "PATCH", body },
      ),

    /** `DELETE …/items/{itemId}` — soft-delete an item. */
    deleteItem: (checklistId: string, itemId: string) =>
      apiRequest<void>(
        `/investors/diligence/${checklistId}/items/${itemId}`,
        { method: "DELETE" },
      ),
  },

  // --- Step 9l: investor workspace -----------------------------------------
  /**
   * Step 9l: the investor workspace read surfaces — dashboard summary,
   * insights, activity feed and its stats. All are paramless reads.
   */
  workspace: {
    /** `GET /investors/dashboard/summary` — top strip + sidebar cards. */
    dashboardSummary: (signal?: AbortSignal) =>
      apiRequest<InvestorDashboardSummary>("/investors/dashboard/summary", {
        method: "GET",
        signal,
      }),

    /** `GET /investors/insights` — descriptive stats (no forecasts). */
    insights: (signal?: AbortSignal) =>
      apiRequest<InsightsResponse>("/investors/insights", {
        method: "GET",
        signal,
      }),

    /** `GET /investors/activity` — paginated activity feed. */
    activity: (
      query?: { event_type?: string; limit?: number; offset?: number },
      signal?: AbortSignal,
    ) =>
      apiRequest<ActivityPage>("/investors/activity", {
        method: "GET",
        query,
        signal,
      }),

    /** `GET /investors/activity/stats` — totals/7-day/by-type/by-day. */
    activityStats: (signal?: AbortSignal) =>
      apiRequest<ActivityStats>("/investors/activity/stats", {
        method: "GET",
        signal,
      }),
  },

  // --- Step 9m: startup investor hub ----------------------------------------
  /**
   * Step 9m: the startup's investor hub — read-only aggregates over the
   * startup's own rounds, deals, requests, meetings and audit activity.
   * Any active org member may read (viewers included); there is no write
   * surface here (visibility settings reuse the 5a profile PATCH).
   */
  investorHub: {
    /** `GET /organizations/{org_id}/investor-hub/summary` — the hub page. */
    summary: (orgId: string, signal?: AbortSignal) =>
      apiRequest<InvestorHubSummary>(`/organizations/${orgId}/investor-hub/summary`, {
        method: "GET",
        signal,
      }),

    /** `GET /organizations/{org_id}/investor-hub/rounds` — paginated rounds. */
    rounds: (
      orgId: string,
      query?: { limit?: number; offset?: number },
      signal?: AbortSignal,
    ) =>
      apiRequest<RoundProgressPage>(`/organizations/${orgId}/investor-hub/rounds`, {
        method: "GET",
        query,
        signal,
      }),

    /** `GET /organizations/{org_id}/investor-hub/activity` — paginated feed. */
    activity: (
      orgId: string,
      query?: { event_type?: string; limit?: number; offset?: number },
      signal?: AbortSignal,
    ) =>
      apiRequest<ActivityPage>(`/organizations/${orgId}/investor-hub/activity`, {
        method: "GET",
        query,
        signal,
      }),

    /** `GET /organizations/{org_id}/investor-hub/activity/stats` — aggregates. */
    activityStats: (orgId: string, signal?: AbortSignal) =>
      apiRequest<ActivityStats>(`/organizations/${orgId}/investor-hub/activity/stats`, {
        method: "GET",
        signal,
      }),
  },
};
