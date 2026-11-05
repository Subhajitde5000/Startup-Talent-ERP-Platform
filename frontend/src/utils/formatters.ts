/**
 * Shared presentation helpers.
 *
 * Every workspace used to ship its own copy of `initials()` / date formatting,
 * each with slightly different fallbacks. Keeping one implementation avoids the
 * inconsistent avatars and "Invalid Date" strings that showed up across roles.
 */

/** Up to two uppercase initials from a person or company name. */
export function initials(name: string, fallback = "?"): string {
  const parts = name
    .trim()
    .replace(/^(Dr|Prof|Mr|Mrs|Ms)\.\s*/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Friendly "5 Nov 2026" date used across every role workspace. */
export function formatDate(value?: string | null, fallback = "Not available"): string {
  if (!value) return fallback;
  // Date-only strings are parsed as UTC by the platform; force local midday.
  const safe = value.length === 10 ? `${value}T12:00:00` : value;
  const date = new Date(safe);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Short "Nov 5" date used in dense tables and calendars. */
export function formatShortDate(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;
  const safe = value.length === 10 ? `${value}T12:00:00` : value;
  const date = new Date(safe);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Compact INR currency used by investor / mentor money displays. */
export function formatMoney(value: number, currency = "INR"): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹";
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `${symbol}${(value / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `${symbol}${(value / 100_000).toFixed(2)} L`;
  return `${symbol}${value.toLocaleString("en-IN")}`;
}
