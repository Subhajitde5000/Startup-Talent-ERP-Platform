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
export type UserRead = components["schemas"]["UserRead"];
export type RegisterRequest = components["schemas"]["RegisterRequest"];
export type RegisterResponse = components["schemas"]["RegisterResponse"];
export type LoginRequest = components["schemas"]["LoginRequest"];
export type VerifyEmailRequest = components["schemas"]["VerifyEmailRequest"];
export type ResendVerificationRequest = components["schemas"]["ResendVerificationRequest"];
export type ForgotPasswordRequest = components["schemas"]["ForgotPasswordRequest"];
export type ResetPasswordRequest = components["schemas"]["ResetPasswordRequest"];
export type MessageResponse = components["schemas"]["MessageResponse"];
export type UserRole = components["schemas"]["UserRole"];

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

export function setTokens(tokens: TokenResponse): void {
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
  if (opts.auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

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
      apiRequest<MessageResponse>("/auth/verify-email", { body, auth: false }),

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
    me: (signal?: AbortSignal) => apiRequest<UserRead>("/users/me", { method: "GET", signal }),
  },
};
