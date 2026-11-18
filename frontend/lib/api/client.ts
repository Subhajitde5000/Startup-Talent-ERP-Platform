/**
 * The one shared API module for the frontend.
 *
 * - Base URL comes from NEXT_PUBLIC_API_URL (defaults to the same-origin
 *   "/api/v1", which next.config.js proxies to the backend).
 * - Bearer access token is attached automatically from local storage.
 * - A 401 triggers a single-flight refresh; the original request is retried
 *   once with the new access token.
 * - Every failure surfaces as an ApiError carrying the backend's
 *   { error: { code, message, details } } shape (422 validation errors are
 *   mapped into the same shape).
 *
 * No component should call fetch() directly — go through this module.
 */
import type { components } from "./schema";

export type TokenResponse = components["schemas"]["TokenResponse"];
export type UserMeRead = components["schemas"]["UserMeRead"];
export type UserUpdate = components["schemas"]["UserUpdate"];
export type ReadinessRead = components["schemas"]["ReadinessRead"];
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

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api/v1").replace(/\/+$/, "");

const ACCESS_KEY = "forma.access_token";
const REFRESH_KEY = "forma.refresh_token";

/* ------------------------------------------------------------------ tokens */

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: { access_token: string; refresh_token: string }): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
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

/* ----------------------------------------------------------------- request */

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body. Omit for GET. */
  body?: unknown;
  /** Attach the bearer access token (default true). */
  auth?: boolean;
  /** Query string params; undefined values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
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
      if (value !== undefined) params.set(key, String(value));
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

/* -------------------------------------------------------- typed endpoints */

export const api = {
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
      apiRequest<ReadinessRead>("/users/me/readiness", { method: "GET", signal }),

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

    members: (orgId: string, signal?: AbortSignal) =>
      apiRequest<MemberRead[]>(`/organizations/${orgId}/members`, { method: "GET", signal }),

    updateMember: (orgId: string, userId: string, body: MemberUpdate) =>
      apiRequest<MemberRead>(`/organizations/${orgId}/members/${userId}`, {
        method: "PATCH",
        body,
      }),

    removeMember: (orgId: string, userId: string) =>
      apiRequest<void>(`/organizations/${orgId}/members/${userId}`, { method: "DELETE" }),

    transferOwnership: (orgId: string, userId: string) =>
      apiRequest<MemberRead[]>(`/organizations/${orgId}/transfer-ownership`, {
        method: "POST",
        body: { user_id: userId },
      }),

    /** Owner/admin invite; `token` is returned once (no email send yet). */
    createInvite: (orgId: string, body: InviteCreate) =>
      apiRequest<InviteRead>(`/organizations/${orgId}/invites`, { method: "POST", body }),

    invites: (orgId: string, signal?: AbortSignal) =>
      apiRequest<InviteRead[]>(`/organizations/${orgId}/invites`, { method: "GET", signal }),

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
};
