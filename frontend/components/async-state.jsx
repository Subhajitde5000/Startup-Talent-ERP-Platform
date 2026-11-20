'use client';
/**
 * The three states every wired page needs (AGENTS.md 0B).
 *
 * Kept in one component so the mentor pages and the shared startup
 * mentor-app render loading, empty and error identically — and so an error
 * can never be silently rendered as an empty list.
 */
import { AlertCircle, RefreshCw } from 'lucide-react';

/** Small inline spinner used while a page's first request is in flight. */
export function LoadingBlock({ label = 'Loading…', rows = 2 }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl border border-[#E5E1D8] bg-white"
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * An empty list, said plainly. `hint` explains *why* it is empty — a page
 * that filters client-side says "no matches for this search" rather than
 * implying the account has no data.
 */
export function EmptyBlock({ title, hint, children }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E5E1D8] bg-white p-8 text-center">
      <p className="text-sm font-semibold text-[#0F1B2D]">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs text-[#4A5568]">{hint}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * A failed load, with the server's own message and a retry. The retry is a
 * required prop: every wired page can re-run its effect, so a transient
 * failure is never a dead end.
 */
export function ErrorBlock({ message, onRetry, title = 'Could not load this page' }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#F1C6C1] bg-[#FEF3F2] p-5"
    >
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#B42318]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#B42318]">{title}</p>
          <p className="mt-1 text-xs text-[#7A271A]">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#F1C6C1] bg-white px-3 text-xs font-semibold text-[#B42318] hover:bg-[#FEE4E2]"
          >
            <RefreshCw size={13} /> Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** Field-level message straight from a 422 `details[].loc`. */
export function FieldError({ children }) {
  if (!children) return null;
  return (
    <p className="mt-1 text-xs font-medium text-[#B42318]" role="alert">
      {children}
    </p>
  );
}

/**
 * Map a 422 ApiError into `{field: message}` the same way the readiness and
 * tasks pages do, so a server validation error lands on its own input.
 */
export function fieldErrorsFrom(err) {
  const out = {};
  if (err && Array.isArray(err.details)) {
    for (const d of err.details) {
      const loc = Array.isArray(d.loc) ? d.loc : [];
      const key = loc[loc.length - 1];
      if (typeof key === 'string' && !out[key]) out[key] = d.msg || 'Invalid value.';
    }
  }
  return out;
}
