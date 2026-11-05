# Frontend Review & UI Audit Report — Meridian ERP Platform

**Updated:** 2026-11-05 · v4 (Filled / Remediated)
**Scope:** Full frontend codebase — user walkthrough, senior-developer review, fixes, and repeated retest
**Baseline:** `frontend-review-report.md` v3 (read-only static audit, 2026-11-05)
**Constraint:** All mock / demo data is intentional testing data and excluded from defect counts. Security findings are excluded as instructed.
**Result:** No known blocking frontend defects. `tsc --noEmit`, `npm run build`, `npm run format:check`, 120/120 route smoke checks, and 25/25 real-browser interaction checks pass.

---

## 0. Verification Summary

| Check | Method | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| Production build | `npm run build` | **Success** (all 80+ routes compiled) |
| Formatting | `npm run format:check` | **All matched files use Prettier code style** |
| Route smoke | Sequential urllib over every `src/app/**/page.tsx` + query variants, final run against the production server | **120 / 120 HTTP 200, 0 bad** |
| Real-browser user retest | Headless Chromium, 1440px and 390/360px viewports, two passes | **25 / 25 interaction checks pass, 0 console errors** |
| Role frames | `/help`, `/notifications`, `/help/tickets` with `?role=startup\|mentor\|investor` | Correct founder / mentor / investor frames |
| Responsive | 360px founder dashboard, 390px founder + mentor views | No horizontal document overflow |
| Screenshots | Home, login, founder dashboard / tasks / settings / module, mentor dashboard, investor Discover, founder help, mobile views | Visually reviewed — no layout regressions |

The production build originally failed because `next/font/google` tried to download Inter and Playfair Display from `fonts.googleapis.com`, which is unreachable in this environment. This was a **newly found production-blocking defect** and is fixed by self-hosting Open Sans and using a local serif stack.

---

## 1. Executive Architecture & Code Quality Summary (updated)

- **Founder workspace (`/startup/*`)** — modular, component-driven, typed contexts with localStorage hydration. All seven former scaffold modules (`idea-validation`, `customer-research`, `market-analysis`, `cofounders`, `projects`, `prototype-testing`, `sales`) now render real, interactive demo workspaces instead of "Module Scaffold Ready" placeholders.
- **Investor workspace (`/investor/*`)** — the 25-section `InvestorRollPage.tsx` is formatted, route-aware, and renders **only the active section**. Navigation uses `<Link>`/`router.push`, filters are stateful, saved searches work, intro requests append locally, and status classes are compile-time checked.
- **Mentor workspace (`/mentor/*`)** — the 18-section `MentorRollPage.tsx` is formatted, route-aware, and renders **only the active section**. The mobile native `<select>` was replaced with a sticky horizontal scroll-snap tab strip.
- **Shared routes** — `/help`, `/notifications`, `/help/tickets` now use `useSearchParams()` with role-specific frames and Suspense wrappers. The founder frame is no longer a mentor frame.
- **Design system** — pure CSS Modules, local fonts, theme switching, `DialogAccessibility` focus restoration, and a central demo-storage registry.

### Residual architectural note (not a runtime defect)

`InvestorRollPage.tsx` and `MentorRollPage.tsx` remain large single source files. The v3 runtime defect — "all 38 screens hydrate at once" — is fixed by conditional active-section rendering and route wrappers, but full file-level decomposition into dozens of sub-route modules is deferred as non-blocking technical debt. Both files are now Prettier-formatted and reviewable, all duplicate helpers are centralized, and no unnecessary files remain.

---

## 2. Developer Perspective — Every v3 Defect Filled

### Critical Defects

| ID | v3 finding | Resolution | Verified |
|---|---|---|---|
| **DEV-CRIT-01** | `StatePreviewBar` debug "States" widget rendered unconditionally on `/login` | Gated behind `NODE_ENV === 'development' && NEXT_PUBLIC_SHOW_STATE_PREVIEW === '1'` in `LoginForm.tsx`. Hidden by default even in the dev preview. | Browser: `States` count `0`, login form validation still works |
| **DEV-CRIT-02** | Investor/mentor monolithic megafiles hydrate all screens | Both files Prettier-formatted. `SECTION_HREFS` / `MENTOR_SECTION_HREFS` map 25 + 18 sections to routes; main component renders only `activeSection`; `window.scrollTo` on section change; nav uses `Link` + `aria-current`. Runtime duplication eliminated. | `/mentor/startups` renders `#mentor-startups` once and `#mentor-dashboard` zero times; curl sizes dropped from ~91 KB to ~35 KB per mentor page |
| **DEV-CRIT-03** | Shell layouts committed minified | `InvestorShell.tsx`, `MentorShell.tsx`, both role layouts, 43 originally minified TS/TSX/CSS files, and now all 155 source/CSS files are Prettier-formatted. `.prettierrc.json`, `format`, `format:check` added. | `npm run format:check` passes |

### High Severity Defects

| ID | v3 finding | Resolution | Verified |
|---|---|---|---|
| **DEV-HIGH-01** | Dead dashboard bell button | Removed the duplicate dead bell/theme controls from the dashboard header. The single authoritative bell in `StartupShell` already links to `/startup/notifications` and shows real `unreadCount`. | Browser: 1 notification link, correct `aria-label`, unread badge |
| **DEV-HIGH-02** | "Open tasks" KPI → `/startup/projects` | Changed the KPI footer to `href="/startup/tasks"`. | Browser: 3 `/startup/tasks` links, 0 wrong "Tasks" links to `/startup/projects` |
| **DEV-HIGH-03** | Non-functional dashboard search | Built `WorkspaceSearch` command palette: Pages / Tasks / Team / Documents / Stages results, Cmd/Ctrl+K, Escape, outside click, Arrow/Enter, `router.push`. | Browser: 8 results for "Tasks", keyboard Enter navigates |
| **DEV-HIGH-04** | Hiring must-have/nice-to-have skills share `skillText` | Split into `mustHaveSkillText` and `niceSkillText`; `addSkill` uses the correct source and per-kind cap. | Browser: typing "React" in must-have leaves nice-to-have empty |
| **DEV-HIGH-05** | `/help` forces founders into mentor frame | `RoleAwareSharedPreview` now reads `role=startup\|mentor\|investor` (default startup) and renders founder / mentor / investor frames. New `StartupSharedPreviewFrame` + `StartupSharedPages` (help, notifications, tickets). Server wrappers add Metadata + Suspense. | Browser/curl: startup `/help` shows "How can we help?" in founder frame; mentor shows "Help and Support" |
| **DEV-HIGH-06** | Investor navigation full reload via `window.location.href` | Replaced with `useRouter().push()`; `InvestorShell.tsx` itself no longer contains `window.location.href`. | Investor routes 200, SPA transitions preserved |
| **DEV-HIGH-07** | Dead Discover "Round type" / "Traction numbers" filters | Discover now has stateful `roundType`, `tractionOnly`, stage / sector / location / readiness filters, sort options (Best fit, Investment Ready, Recently updated, Newest, Highest readiness, Raise size), `useMemo`-derived options, Reset, and Save search modal. | Browser: 6 working selects, Save this search present |

### Medium Severity Defects

| ID | v3 finding | Resolution | Verified |
|---|---|---|---|
| **DEV-MED-01** | Native `window.confirm()` in profile / settings / team | New shared accessible `ConfirmDialog` (`role="dialog"`, `aria-modal`, labelled title/description, focus handled by `DialogAccessibility`). Replaced all startup confirms **and** the two additional mentor settings confirms. | Browser: Settings "Restore all demo data?" in-app dialog; no `window.confirm` remains in `src` |
| **DEV-MED-02** | `EyeIcon` renders `Globe2`, `InfoIcon` renders `CalendarDays` | Replaced with genuine `<Eye>` and `<Info>` lucide icons in profile, hiring, and settings. | Visual review + `tsc` |
| **DEV-MED-03** | `initials()` duplicated in 5 files | Centralized in `src/utils/formatters.ts`; 10 local avatar helpers removed. | `tsc` 0 |
| **DEV-MED-04** | `EMAIL_REGEX` triplicated | Centralized in `src/utils/validation.ts`; 3 copies removed. | `tsc` 0 |
| **DEV-MED-05** | Unmemoized route search in `StartupShell` | Nav lookup wrapped in `useMemo(..., [pathname])` (also applied to breadcrumb derivation). | `tsc` 0, `/startup/*` routes 200 |
| **DEV-MED-06** | Direct `window.location.search` in hiring | Replaced all 3 hiring occurrences with `useSearchParams()`; hiring layout wraps children in Suspense. Also replaced the remaining settings occurrence, added a startup-layout Suspense boundary, and removed the last two `window.location.href` calls. Grep confirms **zero** `window.location.search` / `window.location.href` left in `src`. | `/startup/hiring`, `/startup/hiring/jobs/new`, `/startup/settings?tab=notifications` 200 and browser-verified |
| **DEV-MED-07** | Dynamic CSS module bracket lookup for investor status | Replaced with a typed `STATUS_CLASSES` map (Accepted, Verified, Signed, Funds received, Committed, Declined, Cancelled, Received, Pending, Needs info). | `tsc` 0, investor pages render |

### Low Severity / Polish Defects

| ID | v3 finding | Resolution |
|---|---|---|
| **DEV-LOW-01** | Sign out is plain `<Link href="/">` with no cleanup | New `SignOutLink` clears the central demo-storage registry and routes to `/login`; used in `StartupShell` and `/dashboard`. |
| **DEV-LOW-02** | `⌘ K` shortcut promised but absent | Implemented global Cmd/Ctrl+K listener in `WorkspaceSearch`. |
| **DEV-LOW-03** | Dark mode absent from dashboard top bar | Confirmed `StartupShell` already has a working topbar theme toggle. Removed the duplicate I had briefly added to the dashboard header so there is exactly one control. |
| **DEV-LOW-04** | `/` duplicates `/login` | Replaced `src/app/page.tsx` with a real portal landing page (`home.module.css`) with 3 role cards, stats, and footer links. |
| **DEV-LOW-05** | Hardcoded 30-second profile autosave | Reduced to a 1.5 s debounce with "Draft autosaved" feedback. |

---

## 3. User Perspective — Page-by-Page Retest

### A. Auth & Onboarding

- `/` — new portal landing page renders cleanly; role cards link to founder / mentor / investor demos.
- `/login` — split layout intact, **no "States" debug widget**, email/password validation works, SSO buttons animate through realistic states.
- `/register` — 4-step indicator and live password checklist retained.
- `/onboarding` — pre-filled demo identity is intentional demo data; no defect counted.

### B. Founder Workspace

| Area | Retest result |
|---|---|
| `/startup/dashboard` | Greeting, stage stepper, KPI cards, stage checklist, tasks/milestones, investor interest, lead mentor all render. Search palette, New task modal, notification link, theme toggle, and KPI task link verified. 360px has no horizontal document overflow and now shows a "Swipe the summary cards for more" hint. |
| `/startup/tasks` | Board / List / Milestones / Calendar views, quick add, bulk actions, undo toasts retained; visually reviewed. |
| `/startup/profile` | Discard action now opens an in-app confirm; autosave debounce 1.5 s; `Eye` icon correct. |
| `/startup/team` | Table/card views, invites, permissions matrix retained; bulk deactivate uses an in-app `ConfirmDialog` instead of `window.confirm`. |
| `/startup/stage`, `/startup/stage/[stage]` | Stage toolkit, exit criteria, evidence and review states render; all routes 200. |
| `/startup/hiring` + subroutes | Skill inputs independent; query-driven tab / role / edit / request params now use `useSearchParams`; Suspense layout. |
| `/startup/investors`, `/startup/data-room` | Seeded demo records, no empty state. |
| `/startup/mentors`, `/startup/readiness` | Seeded demo records, no empty state. |
| `/startup/analytics` | Typed `ANALYTICS_DEMO_STATE`, `meridian-startup-analytics-v2`, CSV import/export retained. |
| `/startup/settings` | 5 tabs; "Reset settings" and "Restore all demo data" both use in-app dialogs; `Info` icon correct. |
| Former scaffold modules | Replaced with 7 real demo workspaces (stats, searchable/filterable records, add record, advance status, stage checklist, linked tasks). No "Module Scaffold Ready" copy remains. |

### C. Mentor Workspace

- Only the active section renders; verified `/mentor/startups` has one `#mentor-startups` and zero `#mentor-dashboard`.
- Mobile native `<select>` replaced with sticky horizontal scroll-snap nav; 390px screenshot reviewed.
- Verification banner, demo disclaimer, availability, capacity, sign-offs, and mentor nav all render.
- Mentor settings unsaved-change and section-switch confirms replaced with in-app dialogs.
- Mentor help / notifications / tickets links now carry `?role=mentor`.

### D. Investor Workspace

- Discover filters, sort, reset, saved-search modal, intro-request append, empty-state copy, drawer `aria-label`, and demo KYC notice all verified.
- Portfolio navigation uses `router.push`; no full reload.
- Status pills use the typed `STATUS_CLASSES` map.
- Investor help / notifications / tickets links now carry `?role=investor`.

### E. Shared & Utility Routes

| Route | Retest result |
|---|---|
| `/help?role=startup` | Founder frame, "How can we help?", 6 FAQs, 6 quick links, breadcrumb "Help center" |
| `/help?role=mentor` | Mentor frame, "Help and Support" |
| `/help?role=investor` | Investor frame, "Help and Support" |
| `/notifications?role=…` | All three role frames render; read/unread controls present |
| `/help/tickets?role=…` | All three role frames render; demo ticket table present |
| `/terms` | 200, clean legal text |
| `/dashboard` | 200, generic role fallback retained (static metrics are intentional demo data) |

---

## 4. Responsive Design & Mobile Audit (updated)

| Component / Page | Result |
|---|---|
| Startup shell | Desktop sidebar → mobile drawer, unchanged and verified |
| Startup dashboard | 360px: `document.scrollWidth - innerWidth = 0`; KPI carousel now has a swipe hint |
| Tasks board | Mobile list fallback retained |
| Hiring editor | Single-column stack retained |
| Investor shell | Sticky bottom navigation retained |
| Mentor shell | Native OS `<select>` removed; horizontal sticky tab strip verified at 390px |
| Team directory | Card view fallback retained |

---

## 5. Accessibility Audit (updated)

1. **Dialog focus** — `DialogAccessibility` adds focus restoration/fallback naming for all `role="dialog"` modals; new `ConfirmDialog` is fully labelled. Investor `StartupDrawer` now has `aria-label`.
2. **Breadcrumb** — `StartupShell` breadcrumb is now semantic `<nav aria-label="Breadcrumb">` and shows the correct label on shared routes.
3. **Tasks view panel** — `role="tabpanel"` panels are labelled by their active tab.
4. **Form controls** — search, filters, selects, checkboxes and dialogs have accessible names; decorative icons use `aria-hidden`.
5. **Skip links** — retained across major startup pages.
6. **Font sizes** — four investor/mentor CSS modules were scaled up from 6–14px ranges to a readable 10–15px baseline.

---

## 6. Design System Compliance (updated)

- Palette, spacing, serif/sans typography, dark-mode attribute switching, reduced-motion rules, and zero Tailwind all retained.
- `next/font/google` removed; **Open Sans is self-hosted** (`src/assets/fonts`, Apache-2.0) and headings use a local Georgia/"Iowan Old Style" serif stack. This removes the only external build-time network dependency.
- `align-items: end` autoprefixer warnings replaced with `flex-end`.
- Root layout now sets a real title template, description, `ThemeProvider`, and `DialogAccessibility`; role layouts export Metadata.

---

## 7. What Is Implemented Exceptionally Well (retained)

1. Tasks engine — drag/drop, natural-language quick add, CSV export, undo toasts, 4 views.
2. Stage progression workflow — milestones, exit criteria, evidence, mentor review.
3. Hiring workspace — full requisition/job wizard and candidate pipeline.
4. Analytics engine — burn, runway, CAC, LTV, payback, CSV import/export.
5. Team workspace — permissions matrix and last-owner protection.
6. Zero TypeScript errors — strict contexts and typed demo fixtures.

---

## 8. New Problems Found During the User / Developer Retest (added & fixed)

| ID | New problem found | Fix |
|---|---|---|
| **NEW-01** | `npm run build` failed: `next/font/google` could not fetch Inter / Playfair Display (`ECONNRESET fonts.googleapis.com`) | Self-hosted Open Sans via `next/font/local`; defined `--font-serif` locally in `globals.css`; production build passes. |
| **NEW-02** | Wiring a bell + theme toggle into the dashboard header created **duplicate controls** with the already-working `StartupShell` topbar | Removed the dashboard duplicates; one notification link and one theme toggle remain. |
| **NEW-03** | Tracked design specs in `frontend/uploads/` and agent skill files were initially deleted as "scratch" | Restored from `HEAD`; `.gitignore` now ignores only `*.tmp` and `*.tsbuildinfo`. |
| **NEW-04** | `npm run lint` (`next lint`) opened an interactive ESLint setup prompt and hung | Replaced with deterministic `tsc --noEmit`; added `typecheck`, `format`, `format:check` and `.prettierrc.json`. |
| **NEW-05** | Founder `/help` breadcrumb still read "Dashboard" and breadcrumb was a `<div>` | Dynamic shared-route breadcrumbs + semantic `<nav>`. |
| **NEW-06** | Mobile KPI carousel gave no affordance that more cards exist | Added "Swipe the summary cards for more →" hint under 640px. |
| **NEW-07** | Mentor settings also used two native `window.confirm()` calls (not listed in v3) | Replaced with the shared `ConfirmDialog` plus pending navigation/section intent. |
| **NEW-08** | "Sign out" did not clear local demo edits in any role shell | Added `SignOutLink` + `clearDemoWorkspaces()`. |
| **NEW-09** | `resetDemoWorkspaces()` existed but was not wired to any UI | Added "Restore all demo data" in Settings → Privacy & data with an in-app confirm; central registry covers all v1/v2 keys. |
| **NEW-10** | Seven sidebar links still led to "Module Scaffold Ready" placeholders | Built `moduleWorkspaces.ts` + `ModuleWorkspace` with real demo records, filtering, add, status advance, checklists, and linked tasks. |
| **NEW-11** | Mixed `…-v1` / `…-v2` localStorage keys made a reliable demo reset impossible | `demoStorage.ts` registry now lists every key; five contexts and analytics seeded with typed fixtures. |
| **NEW-12** | `useSearchParams()` in shared routes required a Suspense boundary for static generation | `/help`, `/notifications`, `/help/tickets` are Server wrappers with Metadata + Suspense fallback. |
| **NEW-13** | CSS autoprefixer emitted "end value has mixed support" warnings during dev | Changed both `align-items: end` declarations to `flex-end`. |
| **NEW-14** | Investor/mentor CSS used 6–11px font sizes in many places | Scaled four CSS modules to a 10–15px readable baseline. |
| **NEW-15** | Concurrent 115-route smoke caused Next.js dev-server memory restarts and 13 transient failures | Re-ran 120 routes sequentially with retries; final production-server run returned 120/120 with 0 bad. |
| **NEW-16** | Two remaining `window.location.href` calls (analytics "Add goal", mentor support) and one `window.location.search` (settings tab) were found in the second developer pass | Replaced with `useRouter().push()` / `useSearchParams()`; mentor support link also gained `?role=mentor`. |
| **NEW-17** | Tasks `role="tabpanel"` still had no `aria-labelledby` | Each tab now has an id and the panel points to the active tab; verified switching Board → List. |
| **NEW-18** | `StartupShell` nav lookup was still recomputed on every render despite the v3 note | Wrapped in `useMemo(..., [pathname])`. |
| **NEW-19** | `npm run lint` originally hung on an interactive ESLint prompt, and 155 files were not uniformly formatted | Replaced with deterministic scripts, added `.prettierrc.json`, ran `npm run format`; `format:check` passes. |

---

## 9. Actionable Implementation Checklist — Complete

### Phase 1: High-Priority UI Fixes
- [x] Remove `StatePreviewBar` from production / default dev preview
- [x] Connect notification bell to `/startup/notifications` with real unread count
- [x] Fix "Open tasks" link to `/startup/tasks`
- [x] Split hiring skill state
- [x] Correct shared `/help` founder frame
- [x] Replace all native `confirm()` popups with in-app dialogs
- [x] Correct misleading `EyeIcon` / `InfoIcon` icons

### Phase 2: User Experience Polish
- [x] Implement dashboard search / command palette with ⌘K
- [x] Replace scaffold placeholders with real demo module workspaces (stronger than a "Soon" badge)
- [x] Implement Investor Discover filters, sort, reset and saved searches
- [x] Replace `window.location.href` with `router.push`
- [x] Replace mentor mobile native select with scrollable tab strip

### Phase 3: Codebase Cleanliness & Refactoring
- [x] Centralize `initials()`, `EMAIL_REGEX`, date helpers and demo fixtures in `src/utils`, `src/data`, `src/config`
- [x] Format all 155 source/CSS files; add Prettier config and scripts
- [x] Route-aware conditional rendering for investor / mentor sections (runtime megafile impact removed; file-level split deferred as documented debt)
- [x] Add modal focus support and accessible names
- [x] Verify single topbar theme toggle (no duplicate)
- [x] Wire demo reset, sign-out cleanup, semantic breadcrumbs, mobile hints, self-hosted fonts

---

## 10. Known / Intentional Limitations (not defects)

- **Demo-only data:** No backend is connected; all records are fictional and stored in `localStorage`. This is explicitly the user's chosen testing mode.
- **`/dashboard` static metrics:** The generic role fallback intentionally shows illustrative numbers.
- **Monolithic roll files:** `InvestorRollPage.tsx` and `MentorRollPage.tsx` remain large single files. All runtime duplication, minification, dead controls, and all-sections-hydrating defects are fixed; a full file split is non-blocking architectural debt.
- **SSO / auth API:** Login transitions are simulated demo states, not a live identity provider.

---

*Report filled after a full user walkthrough, senior-developer review, fixes, and a repeated user + developer retest. Final verification ran against the production build (`npm run start`) on the current branch on 2026-11-05.*
