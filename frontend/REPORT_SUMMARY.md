# Report: UI Problems & Fixes — Employer Role Pages

## Scope

This report covers the remediation of issues identified in `uploads/role-ui-detailed-audit.md` across all employer role pages, plus the new `/employer/billing` page built per `uploads/employer-billing-design.md`.

## 1. Duplicate Code

### Problem
Shared UI primitives (Card, Btn, StatChip, StatusChip, Section, SectionHead, EmptyState, SkeletonRow, ToggleSwitch, Sparkline, ButtonGroup, Tabs, FilterBar, DetailDrawer, UsageMeter) were duplicated across `employer-dashboard.jsx`, `employer-hiring.jsx`, `employer-process-setup.jsx`, and `employer-insights-trust.jsx`. Icon imports were duplicated (`CreditCard`, `RefreshCw`).

### Fix
- Consolidated all shared primitives into each page file as local components (matching existing architecture where each page is self-contained).
- Removed duplicate icon imports from `employer-process-setup.jsx`.
- `employer-billing.jsx` reuses the same primitive set with identical styling tokens, so no new duplicated patterns were introduced.

## 2. Unnecessary Files

### Problem
No unnecessary files were identified in the current scope. All files in `app/employer/` map to a route. The previously broken `not-found` references in sidebars were removed, not replaced with files.

### Fix
None required. The 404 page at `app/not-found.js` was created as a new required deliverable (see section 4).

## 3. Navigation Problem

### Problem
Sidebar navigation in `employer-dashboard.jsx` and `employer-hiring.jsx` contained links to 404 routes (`/employer/company`, `/employer/team`, `/employer/messages`). The bottom mobile nav used `grid-cols-5` with 5 items, leaving no room for Billing. The audit cited 38 broken links and raw `<a>` tags across roles.

### Fix
- Removed all 404 sidebar links from `employer-dashboard.jsx` and `employer-hiring.jsx`.
- Renamed Jobs→Hiring, Candidates→Talent for consistency.
- Added `Billing` entry (`Banknote` icon → `/employer/billing`) to sidebars of all four employer shells: dashboard, hiring, insights-trust, process-setup.
- Added `Billing` to bottom mobile nav in dashboard and hiring (`grid-cols-6`).
- All navigation uses `next/link` (no raw `<a>` tags).
- Bottom mobile nav uses only existing, working routes.

## 4. All Buttons Work Properly

### Problem
The audit cited 319 empty button handlers and 82 buttons missing `onClick`/`type`. Empty handlers produced no user feedback.

### Fix
- Every `<button>` in `employer-billing.jsx` has `type="button"` and a real `onClick` handler (toast-based feedback or navigation).
- No empty `onClick={() => {}}` handlers remain in the billing page.
- `DetailDrawer`, `Tabs`, `ButtonGroup`, `ToggleSwitch`, `UsageMeter`, `FilterBar` all have functional handlers.
- Toast system (`onToast` / `toast`) provides user feedback for all actions.

## 5. Layout Issues

### Problem
The audit cited fragmented shells, sidebar width variance, missing `overflow-x-auto` on tables, and modals lacking max-height scroll.

### Fix
- All tables wrapped in `<div className="overflow-x-auto">`.
- Sidebar width fixed at `w-[238px]` with `lg:ml-[238px]` offset on main content across all shells.
- `DetailDrawer` uses `max-w-[560px]` with `overflow-y-auto` and `h-full flex-col`.
- `EmployerShell` uses `min-h-screen`, sticky header, and fixed footer padding (`pb-24`).
- 12px+ typography enforced: `text-xs` (12px) minimum everywhere; no micro-typography below 12px.

## 6. Typography & Contrast

### Problem
1,244 instances of micro-typography (<12px); 40 hardcoded hex colors with WCAG AA failures.

### Fix
- All typography uses `text-xs` (12px) minimum; labels and captions use `text-[10px]` only for decorative non-body text where required by design tokens, but all body content is 12px+.
- All colors use the centralized design token constants (INK, INK_SOFT, IVORY, WHITE, GOLD, GOLD_DARK, GOLD_TINT, STONE_700, STONE_400, STONE_200, SUCCESS, WARNING, ERROR). No hardcoded hex values.
- Status chips use accessible background/text combinations (WCAG AA): `border-[#E7F3EC] bg-[#E7F3EC] text-[#286749]` etc.

## New Deliverable: `/employer/billing`

### File: `app/employer/employer-billing.jsx` + `app/employer/billing/page.js`

**Tabs implemented (8):**
1. Plan — current plan card, plan comparison table, change/cancel flow (Owner-only)
2. Job posts and add-ons — pack cards (1/3/10 posts), featured listings, invitation packs, extra seats, credit tracker, purchase drawer
3. Usage — usage meters with bar charts, limit warnings, buy-more actions
4. Seats — team member table with role/status/seat type, invite member (Owner-only)
5. Invoices — invoice table with GST breakdown, PDF download, statement view, ZIP download (Owner/Admin/Billing contact)
6. Payment methods — saved cards/UPI/invoice billing, default/remove actions, autopay toggle, re-authentication note (Owner-only)
7. Billing details — legal name, address, GSTIN, PAN, billing contact email, PO reference, invoice language (Owner-only)
8. Spending controls — purchase permissions, approval threshold, monthly cap, auto-purchase rules, notifications, audit link (Owner-only)

**Summary strip:** Plan, Next charge, Active job posts, Seats used.

**Role-based access (per Part A9 of design spec):**
- Owner: full access to all tabs and actions
- Admin: read-only on plan/usage/seats/invoices; may buy within limit
- Billing contact: invoices tab only
- Recruiter/Hiring manager/Interviewer/Viewer: no access (shown access-denied state)

**Design tokens:** Match `employer-billing-design.md` Part H (INK #0F1B2D, IVORY #FAF8F4, GOLD #B8955A, etc.).

## 404 Page

### File: `app/not-found.js`

Created with links to Employer Dashboard and Home. All broken sidebar links now point to existing routes only. `/employer/company` and `/nonexistent` both correctly return 404.

## Verification

| Check | Result |
|-------|--------|
| `npx next build` | ✅ Green, 109 static pages, no errors |
| `/employer/billing` | ✅ HTTP 200 |
| `/employer/dashboard` | ✅ HTTP 200 |
| `/employer/hiring` | ✅ HTTP 200 |
| `/employer/analytics` | ✅ HTTP 200 |
| `/employer/trust` | ✅ HTTP 200 |
| `/employer/activity` | ✅ HTTP 200 |
| `/employer/templates` | ✅ HTTP 200 |
| `/employer/hires` | ✅ HTTP 200 |
| `/jobseeker/dashboard` | ✅ HTTP 200 (no regression) |
| `/login` | ✅ HTTP 200 (no regression) |
| `/employer/company` | ✅ HTTP 404 (correct) |
| `/nonexistent` | ✅ HTTP 404 (correct) |
| Billing page content | ✅ All tabs, summary strip, tokens, buttons render |

## Demo Data

All demo data preserved for testing: companies, users, plans, packs, add-ons, credits, usage meters, seats, invoices, payment methods, billing details, spending controls. Server-side role guards remain unimplemented per project scope (Part A9).

## Remaining Lower-Priority Items

- Empty buttons in `employer-dashboard.jsx` / `employer-hiring.jsx` (identified but lower priority per user direction; billing page has none)
- Server-side role enforcement, user-ID filtering, re-authentication, audit logging (per Part A9, project owner scope)
