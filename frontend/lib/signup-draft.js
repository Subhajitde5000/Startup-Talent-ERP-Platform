/**
 * Draft registration data passed between the /register and /register/role
 * screens (the API takes email + password + role in a single call, but the
 * UI collects them across two pages).
 *
 * Lives in module memory on purpose: it survives client-side navigation but
 * is gone after a full reload — the user simply re-enters their details.
 * The pending email is mirrored to localStorage so the verify screen keeps
 * working across reloads (it is needed for "Resend code" too).
 */
const PENDING_EMAIL_KEY = 'forma.pending_email';

let draft = { email: '', password: '' };

export function setSignupDraft(email, password) {
  draft = { email, password };
}

export function getSignupDraft() {
  return draft;
}

export function clearSignupDraft() {
  draft = { email: '', password: '' };
}

export function setPendingEmail(email) {
  try {
    window.localStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    /* storage unavailable — verify screen will fall back to the draft */
  }
}

export function getPendingEmail() {
  try {
    return window.localStorage.getItem(PENDING_EMAIL_KEY) || draft.email || '';
  } catch {
    return draft.email || '';
  }
}

export function clearPendingEmail() {
  try {
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
