/**
 * Display labels for the Step 8b/8c/8d enums.
 *
 * The API returns lower-case machine values (`requested`, `no_show`, …);
 * the UI has always shown sentence case. Keeping the mapping here means the
 * mentor pages and the shared startup mentor-app cannot drift apart, and a
 * new enum member shows up as a readable fallback rather than blank.
 */

export const MENTORSHIP_STATUS_LABEL = {
  requested: 'Requested',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export const SESSION_STATUS_LABEL = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

/** Tailwind chip classes per session status (matches the existing palette). */
export const SESSION_STATUS_CHIP = {
  confirmed: 'bg-[#E7F3EC] text-[#286749]',
  scheduled: 'border border-[#E5E1D8] bg-white text-[#4A5568]',
  completed: 'bg-[#F3F4F6] text-[#4A5568]',
  cancelled: 'bg-[#FCE8E6] text-[#B42318]',
  no_show: 'bg-[#FFF3D6] text-[#8A5700]',
};

/** Tailwind chip classes per mentorship status. */
export const MENTORSHIP_STATUS_CHIP = {
  active: 'bg-[#E7F3EC] text-[#286749]',
  requested: 'bg-[#FFF3D6] text-[#8A5700]',
  paused: 'bg-[#F3F4F6] text-[#4A5568]',
  completed: 'bg-[#F3F4F6] text-[#4A5568]',
  declined: 'bg-[#FCE8E6] text-[#B42318]',
  cancelled: 'bg-[#FCE8E6] text-[#B42318]',
};

export const STAGE_LABEL = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature',
};

export const WEEKDAY_LABEL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** `14:30:00` -> `2:30 PM`. Times arrive as plain wall-clock strings. */
export function formatTimeOfDay(value) {
  if (!value) return '';
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h)) return String(value);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

/**
 * A UTC instant -> IST wall clock, the zone the product displays in.
 * Returns null for a missing/invalid value so callers render an honest
 * "not scheduled" instead of "Invalid Date".
 */
export function formatInstant(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (
    d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
    })
  );
}

/** Date only, e.g. `11 Oct 2026`. */
export function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** `3000.00` + `INR` -> `₹3,000`. Null stays null (unknown, never ₹0). */
export function formatMoney(amount, currency = 'INR') {
  if (amount === null || amount === undefined || amount === '') return null;
  const value = Number(amount);
  if (Number.isNaN(value)) return null;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}
