# Role-Based UI/UX & Frontend Quality Audit Report
**Startup & Talent ERP Platform (Forma)**  
**Inspection Focus:** Navigation, Layout, Button Visibility & States, Font Size & Typography, Color Combination & Contrast, Scrolling & Overflow  
**Date:** November 6, 2026  
**Standards Enforced:** Startup ERP Project Standards, Web Interface Guidelines, React Engineering Standards  

---

## 1. Executive Summary & Defect Overview

A file-by-file UI/UX audit was conducted across all role-based components in the platform. Every file powering each role was inspected across 6 primary UI failure domains:

1. **Navigation (Nevication):** 38 broken link references resulting in 404s, raw `<a>` tags causing jarring full-page refreshes, hardcoded `href="#"` placeholder links, and lack of persistent active indicators.
2. **Layout & Shells (Leyout):** Fragmented layout shells where sidebar widths vary arbitrarily (`w-[240px]` vs `w-[238px]` vs `w-64`), content margins jump (`ml-[240px]` vs `ml-[238px]`), and lack of shared `layout.js` files forces full unmount/remount on every page view.
3. **Button Visibility & Interaction (Button vibility):** 319 buttons have empty no-op handlers (`onClick={() => {}}`), 82 buttons completely lack `onClick` or `type` attributes, and primary actions (such as "Publish Job", "Export PDF", "Save Draft") fail silently.
4. **Font Size & Typography (Fotsize):** Over **1,244 instances** of sub-accessible micro-typography (< 12px), including `text-[9px]`, `text-[10px]`, and `text-[11px]` that violate WCAG accessibility guidelines and strain readability.
5. **Color Combination & Contrast (Color comination):** 40 arbitrary hardcoded hex codes bypassing design tokens, muted text colors (`#A0A7B4`, `text-white/40`) failing WCAG AA 4.5:1 contrast requirements, and clashing gold/green/stone badge hues.
6. **Scrolling & Overflow (Scollling problem):** Data tables and Kanban boards lacking `overflow-x-auto` causing horizontal viewport blowout on mobile, fixed mobile bottom navigation bars clipping bottom content, and modal dialogs lacking `overflow-y-auto` resulting in trapped content.

---

## 2. Startup Role — File-by-File UI Audit (9 Files, 39 Routes)

### 2.1. `app/startup/dashboard/startup-dashboard.jsx`
- **Powered Routes:** `/startup/dashboard`
- **Navigation Defects:**
  - **Raw `<a href="...">`:** Sidebar links use plain `<a>` instead of Next.js `<Link>` (line 9), triggering complete browser unmounts and full-page reloads on every click.
  - **Non-Functional Mobile Menu:** Mobile drawer menu items call `showToast(`${n} module is ready to connect.`)` and close the drawer instead of navigating to the requested modules (line 11).
  - **Tiny Sidebar Toggle:** Collapse toggle button is an absolute `h-7 w-7` circle that overlaps the header divider and provides a tiny 28px touch target (line 9).
  - **Dead Settings & Help Links:** Footer buttons for "Settings" and "Help & support" trigger toasts ("Settings will be available soon") despite `/help` existing in the app (line 9).
- **Layout Defects:**
  - Hardcodes `w-[240px]` (collapsed `w-[76px]`) and `lg:ml-[240px]`, which clashes with Employer and Job Seeker shells (`w-[238px]`), causing 2px horizontal layout jitter when switching roles.
  - Stage progress timeline has `min-w-[125px]` per item without a flex wrap container, creating awkward horizontal spacing on tablet viewports (768px).
- **Button Visibility & Interaction:**
  - **Toast Theater:** 29 separate buttons only call `showToast`.
  - **Fake Clipboard Copy:** "Invite a teammate" displays "Invite link copied to clipboard" but never invokes `navigator.clipboard.writeText` (line 12).
  - **Isolated Dark Mode:** Sun/Moon toggle only sets a local state `darkmode`. Moving to any other startup page immediately reverts to light mode.
- **Font Size & Typography:**
  - 14 instances of `text-[10px]` (uppercase "STARTUP" badge, stage numbers, avatar initials).
  - 4 instances of `text-[11px]` (timestamps in activity feed).
- **Color Combination & Contrast:**
  - Low contrast muted text `text-[#A0A7B4]` on Ivory `#FAF8F4` background (contrast ratio ~2.8:1, failing WCAG AA).
  - Left sidebar uses `text-white/40` for section headers on dark ink `#0F1B2D` (~3.1:1 contrast ratio).
- **Scrolling Problems:**
  - Fixed bottom navigation (`fixed inset-x-0 bottom-0`) has `h-[58px]`. While `pb-24` is applied to `<main>`, on screens under 380px height (landscape), toast alerts at `bottom-20` collide with bottom nav.

---

### 2.2. `app/startup/stage/stage-page.jsx`
- **Powered Routes:** `/startup/stage`, `/startup/stage/idea`, `/startup/stage/prototype`, `/startup/stage/early-revenue`, `/startup/stage/mature`
- **Navigation Defects:**
  - Re-implements its own sidebar independently; active tab highlighting doesn't sync with browser history if users navigate back.
  - Stage dropdown in header sets local state without updating the URL route path.
- **Layout Defects:**
  - Stage exit criteria checklist uses arbitrary padding and fixed widths on criteria tags.
  - On screens under 640px, the 4-stage stepper collapses abruptly into vertical rows without visual connectors.
- **Button Visibility & Interaction:**
  - "View exit criteria" secondary button has low hover definition against white card backgrounds.
  - Exit milestone checkboxes only mutate transient local state.
- **Font Size & Typography:**
  - 18 instances of `text-[10px]` in stage tags and requirement counts.
- **Color Combination & Contrast:**
  - Stage badge combines `bg-[#F3EBDD]` with text `text-[#806236]` — low legibility in direct sunlight/glare.
- **Scrolling Problems:**
  - Stage checklist container lacks horizontal containment; on narrow screens (360px), milestone descriptions overflow past the card border.

---

### 2.3. `app/startup/tasks/tasks-page.jsx`
- **Powered Routes:** `/startup/tasks`
- **Navigation Defects:**
  - Tab switching between "All tasks", "My tasks", and "Milestones" does not reflect in query params (`?tab=milestones`), breaking shareable task views.
- **Layout Defects:**
  - Task item rows use `min-h-[54px]` flex layout; long task names cause action buttons to get pushed off-screen on mobile viewports.
- **Button Visibility & Interaction:**
  - "New task" modal form fields are uncontrolled; clicking "Create task" triggers mock feedback without persisting tasks.
  - Task filter pills lack clear selected focus rings.
- **Font Size & Typography:**
  - 16 instances of `text-[10px]` and `text-[11px]` on assignee badges and due-date status pills.
- **Color Combination & Contrast:**
  - Overdue badge uses `bg-[#FCE8E6] text-[#B42318]` alongside due-soon `bg-[#FFF3D6] text-[#8A5700]`, creating visual noise without unified badge tokens.
- **Scrolling Problems:**
  - Milestone roadmap horizontal timeline overflows without touch-scroll momentum on iOS Safari.

---

### 2.4. `app/startup/team/team-directory.jsx`
- **Powered Routes:** `/startup/team`
- **Navigation Defects:**
  - Re-renders independent sidebar shell. Breadcrumbs missing when viewing teammate details.
- **Layout Defects:**
  - Team directory table headers have fixed pixel widths that misalign with cell content on resizing.
- **Button Visibility & Interaction:**
  - "Invite member" button opens modal dialog lacking keyboard `Escape` listener.
  - "Remove member" action lacks two-step confirmation dialog.
- **Font Size & Typography:**
  - 22 instances of `text-[10px]` for department tags, role pills, and access permission levels.
- **Color Combination & Contrast:**
  - Table text uses `text-[#4A5568]` on white rows; subtle borders `border-[#E5E1D8]` blur together on low-contrast monitors.
- **Scrolling Problems:**
  - **Critical Mobile Overflow:** The member table lacks an `overflow-x-auto` wrapper, forcing the whole viewport to scroll horizontally on phones (< 640px).

---

### 2.5. `app/startup/profile/startup-profile.jsx`
- **Powered Routes:** `/startup/profile`
- **Navigation Defects:**
  - Contains raw `<a href="...">` tags causing full page refreshes.
- **Layout Defects:**
  - Two-column split between profile editor and live public pitch preview breaks on tablet (768px), squeezing input fields to unreadable widths (< 220px).
- **Button Visibility & Interaction:**
  - "Upload pitch deck" and "Upload logo" file dropzones have no active drag-over visual indicator.
- **Font Size & Typography:**
  - 12 instances of `text-[10px]` on sector badges and social link counters.
- **Color Combination & Contrast:**
  - Public pitch preview header uses gold `#B8955A` border accents that wash out on Ivory backgrounds.
- **Scrolling Problems:**
  - Pitch deck slide preview container has fixed aspect ratio with no full-screen zoom or pan controls.

---

### 2.6. `app/startup/analytics/analytics-page.jsx`
- **Powered Routes:** `/startup/analytics`
- **Navigation Defects:**
  - Re-implements its own sidebar navigation independently from other startup views.
- **Layout Defects:**
  - Key metric cards (MRR, Burn, Runway, CAC) use fixed heights, clipping subtext on non-English locales or larger browser font settings.
- **Button Visibility & Interaction:**
  - Date range filters ("Last 30 days", "Last quarter", "All time") display toasts without altering chart figures.
- **Font Size & Typography:**
  - 19 instances of `text-[10px]` on chart axis labels, percentage growth indicators, and data legends.
- **Color Combination & Contrast:**
  - Custom SVG bar charts use hardcoded bar colors that do not adapt to dark mode.
- **Scrolling Problems:**
  - Detailed revenue breakdown table at bottom overflows screen width on mobile devices.

---

### 2.7. `app/startup/mentors/mentor-app.jsx`
- **Powered Routes:** `/startup/mentors`, `/startup/mentors/find`, `/startup/mentors/find/[mentorId]`, `/startup/mentors/requests`, `/startup/mentors/[mentorshipId]`, `/startup/mentors/[mentorshipId]/billing`
- **Navigation Defects:**
  - Sub-navigation links use internal tabs; navigating directly to a deep URL like `/startup/mentors/requests` renders the whole module in default tab.
- **Layout Defects:**
  - Mentor discovery cards wrap awkwardly on 768px and 1024px screens, leaving large unbalanced white space on the right.
- **Button Visibility & Interaction:**
  - "Request mentorship" modal textarea lacks character count guidance and client-side length validation.
- **Font Size & Typography:**
  - 28 instances of `text-[10px]` in session rate pills, mentor badges, and skill tags.
- **Color Combination & Contrast:**
  - Rating stars and review counts have low contrast against ivory card surfaces.
- **Scrolling Problems:**
  - Mentorship billing and invoices table overflows screen boundary on mobile.

---

### 2.8. `app/startup/investors/investor-app.jsx`
- **Powered Routes:** `/startup/investors`, `/startup/investors/discover`, `/startup/investors/pipeline`, `/startup/investors/settings`, `/startup/investors/[investorId]`
- **Navigation Defects:**
  - Sub-navigation tabs switch between CRM, Pipeline, and Directory; back button missing on investor detail view.
- **Layout Defects:**
  - Kanban pipeline columns (`Lead`, `Contacted`, `Meeting`, `Diligence`, `Term Sheet`) have fixed min-widths of 260px each, totaling over 1300px width.
- **Button Visibility & Interaction:**
  - Moving investors between stages relies on tiny select dropdowns instead of accessible buttons or drag-and-drop.
- **Font Size & Typography:**
  - 22 instances of `text-[10px]` for check sizes, firm stages, and lead partner names.
- **Color Combination & Contrast:**
  - Column header border lines are extremely faint (`#E5E1D8`), making column boundaries hard to discern.
- **Scrolling Problems:**
  - **Severe Horizontal Scroll:** Kanban board requires horizontal scrolling on desktop monitors below 1440px width and lacks horizontal scrollbar styling.

---

### 2.9. `app/startup/hiring/hiring-app.jsx`
- **Powered Routes:** `/startup/hiring`, `/startup/hiring/jobs/new`, `/startup/hiring/[jobId]`, `/startup/hiring/[jobId]/applicants/[applicantId]`, `/startup/hiring/employer-page`, `/startup/hiring/interviews`, `/startup/hiring/offers`, `/startup/hiring/requests/new`, `/startup/hiring/talent`
- **Navigation Defects:**
  - Duplicate hiring implementation separate from Employer role; links between startup hiring and employer module are inconsistent.
- **Layout Defects:**
  - Candidate dossier modal overlaps page content without locking background body scroll.
- **Button Visibility & Interaction:**
  - "Advance to interview" and "Reject candidate" buttons trigger passive toasts without changing applicant stage in pipeline.
- **Font Size & Typography:**
  - 18 instances of `text-[9px]` and `text-[10px]` for match percentage and skill tags.
- **Color Combination & Contrast:**
  - Match scores use `text-[#2E7D5B] bg-[#E7F3EC]` with very low color separation against white backgrounds.
- **Scrolling Problems:**
  - Candidate comparison matrix table overflows viewport on mobile and tablet.

---

## 3. Mentor Role — File-by-File UI Audit (4 Files, 19 Routes)

### 3.1. `app/mentor/mentor-core.jsx`
- **Powered Routes:** `/mentor`, `/mentor/dashboard`, `/mentor/requests`, `/mentor/discover`, `/mentor/startups`, `/mentor/startups/[mentorshipId]`, `/mentor/startups/[mentorshipId]/startup`
- **Navigation Defects:**
  - Sidebar defines 11 links; active indicators use left gold bar, but mobile drawer menu does not mirror all links.
  - "Discover startups" link in mobile footer is fixed at bottom and covers table action buttons (line 5).
- **Layout Defects:**
  - Grid switches between "Cards" and "Table" view; table headers squish into narrow columns on 768px tablet screens.
  - Workspace detail view lacks breadcrumb navigation to return to the startup list.
- **Button Visibility & Interaction:**
  - "Accept request" and "Decline request" modals have unvalidated reason select boxes.
  - "Join session" button displays toast: "Session link is not available yet" (line 5).
- **Font Size & Typography:**
  - 48 instances of `text-[10px]` for startup scores, health statuses, and traction metrics.
- **Color Combination & Contrast:**
  - Health badges ("Needs attention", "Inactive 30+ days") use subtle gray/brown colors that fail urgent visual hierarchy.
- **Scrolling Problems:**
  - Modals lack `max-h-[90vh]` and `overflow-y-auto`, causing buttons on bottom of modal to be cut off on laptops with small vertical viewports (768px height).

---

### 3.2. `app/mentor/mentor-money.jsx`
- **Powered Routes:** `/mentor/earnings`, `/mentor/agreements`, `/mentor/agreements/[agreementId]`, `/mentor/impact`, `/mentor/events`, `/mentor/events/[eventId]`
- **Navigation Defects:**
  - Sub-navigation between Earnings, Agreements, and Impact uses internal component state without URL reflection.
- **Layout Defects:**
  - Payout history cards have fixed heights; expanding invoice details breaks grid alignment.
- **Button Visibility & Interaction:**
  - "Download invoice" and "Export statement" buttons trigger mock toasts without generating actual downloads.
- **Font Size & Typography:**
  - 24 instances of `text-[10px]` for payout dates, agreement clauses, and review star ratings.
- **Color Combination & Contrast:**
  - Indian Rupee currency figures (`₹`) rendered inconsistently with standard numeric font weights.
- **Scrolling Problems:**
  - Agreements list table overflows horizontally on mobile screens (< 640px).

---

### 3.3. `app/mentor/mentor-sessions.jsx`
- **Powered Routes:** `/mentor/sessions`, `/mentor/sessions/[sessionId]`, `/mentor/deliverables`, `/mentor/startups/[mentorshipId]/readiness`
- **Navigation Defects:**
  - Session detail view lacks a clear back button to return to the full session list.
- **Layout Defects:**
  - Date badges on left of session cards force title and description into an awkward, narrow right column on mobile screens.
- **Button Visibility & Interaction:**
  - "Log session notes" and "Mark deliverable complete" buttons lack visual pending/saved state indicators.
- **Font Size & Typography:**
  - 22 instances of `text-[10px]` for deliverable due dates and session durations.
- **Color Combination & Contrast:**
  - "Submitted for sign-off" pill uses `#F3EBDD` gold that blends into card backgrounds.
- **Scrolling Problems:**
  - Deliverables matrix table lacks horizontal scroll indicators on touch devices.

---

### 3.4. `app/mentor/mentor-shared.jsx`
- **Powered Routes:** `/mentor/messages`, `/mentor/settings`
- **Navigation Defects:**
  - **Critical 404 Links:** Sub-navigation links to `/mentor/profile` and `/mentor/availability` which **do not exist** (404 errors).
- **Layout Defects:**
  - Profile and settings forms use single-column layouts with an excessively wide `max-w-4xl`, causing inputs to stretch uncomfortably on wide desktop monitors.
- **Button Visibility & Interaction:**
  - "Save preferences" button does not indicate persistence or update session state.
- **Font Size & Typography:**
  - 8 instances of `text-[10px]` on notification preferences and badge tags.
- **Color Combination & Contrast:**
  - Form input borders use subtle `#E5E1D8`, which has low contrast against white card backgrounds.
- **Scrolling Problems:**
  - Message thread container lacks automatic scroll-to-bottom behavior when new messages are added.

---

## 4. Investor Role — File-by-File UI Audit (5 Files, 27 Routes)

### 4.1. `app/investor/investor-dealflow.jsx`
- **Powered Routes:** `/investor/dashboard`, `/investor/discover`, `/investor/startups/[startupId]`, `/investor/shortlist`, `/investor/searches`, `/investor/requests`
- **Navigation Defects:**
  - **Dead Sidebar Links:** Hardcodes `href="#"` for "Offers", "Portfolio", and "Messages" (line 3), despite these pages existing in the project!
  - Drawer close button lacks an `aria-label` (line 4).
- **Layout Defects:**
  - Slide-over deal detail drawer (`w-full sm:w-[480px]`) overlaps top header navigation and has `z-50` clash with modal dialogs.
- **Button Visibility & Interaction:**
  - "Pass" button has a confusing 8-second undo toast; "Save" button lacks clear toggled state styling.
- **Font Size & Typography:**
  - 52 instances of `text-[10px]` for MRR, growth, readiness score, and round type badges.
- **Color Combination & Contrast:**
  - Verified badge (`text-[#286749] bg-[#E7F3EC]`) and gold badge (`text-[#806236] bg-[#F3EBDD]`) clash visually when positioned next to each other.
- **Scrolling Problems:**
  - Slide-over deal drawer lacks `overflow-y-auto` on internal content sections, causing buttons to be cut off on small laptop screens.

---

### 4.2. `app/investor/investor-diligence.jsx`
- **Powered Routes:** `/investor/pipeline`, `/investor/compare`, `/investor/data-rooms`, `/investor/data-rooms/[startupId]`, `/investor/data-rooms/[startupId]/nda`, `/investor/meetings`, `/investor/startups/[startupId]/diligence`
- **Navigation Defects:**
  - Sub-navigation between Pipeline, Compare, and Data Rooms uses independent component state without deep-linking support.
- **Layout Defects:**
  - Side-by-side comparison matrix table has 6+ columns, causing massive layout blowout on tablet and mobile viewports.
- **Button Visibility & Interaction:**
  - Diligence checklist checkboxes do not dynamically update aggregate diligence score.
- **Font Size & Typography:**
  - 26 instances of `text-[10px]` on risk rating tags and document security classifications.
- **Color Combination & Contrast:**
  - Document sensitivity tags ("Confidential", "NDA Required") have inconsistent background contrast.
- **Scrolling Problems:**
  - Data room file viewer lacks pinch-to-zoom or responsive PDF preview container for mobile users.

---

### 4.3. `app/investor/investor-membership.jsx`
- **Powered Routes:** `/investor/activity`, `/investor/events`, `/investor/events/[eventId]`, `/investor/insights`, `/investor/billing`
- **Navigation Defects:**
  - Event registration tabs lack back button on event detail pages.
- **Layout Defects:**
  - Event cards use fixed aspect ratio placeholders that distort and crop on small screens.
- **Button Visibility & Interaction:**
  - "RSVP to Demo Day" button lacks loading state and calendar `.ics` download trigger.
- **Font Size & Typography:**
  - 18 instances of `text-[10px]` for speaker bios, event timestamps, and syndicate carry percentages.
- **Color Combination & Contrast:**
  - Ticket tier price tags have poor contrast against light background cards.
- **Scrolling Problems:**
  - Event agenda timeline overflows on mobile screens without a vertical scroll guide.

---

### 4.4. `app/investor/investor-offers-portfolio.jsx`
- **Powered Routes:** `/investor/offers`, `/investor/offers/new`, `/investor/offers/[offerId]`, `/investor/portfolio`, `/investor/portfolio/[startupId]`, `/investor/commitments`, `/investor/commitments/[commitmentId]`
- **Navigation Defects:**
  - Term sheet wizard navigation lacks exit confirmation when users click away.
- **Layout Defects:**
  - Term sheet preview pane squishes form fields on screens under 1280px width.
- **Button Visibility & Interaction:**
  - "Send Term Sheet" button opens unvalidated confirmation modal.
- **Font Size & Typography:**
  - 14 instances of `text-[10px]` and `text-[11px]` on cap table equity dilution figures.
- **Color Combination & Contrast:**
  - Portfolio return multiples (e.g. `2.4x`) use inconsistent green and gold accent colors.
- **Scrolling Problems:**
  - Portfolio company financial metrics table lacks `overflow-x-auto` wrapper.

---

### 4.5. `app/investor/investor-shared.jsx`
- **Powered Routes:** `/investor/messages`, `/investor/settings`
- **Navigation Defects:**
  - **Dead 404 Links:** Sub-navigation links to `/investor/profile` and `/investor/preferences` which **do not exist** (404 errors).
- **Layout Defects:**
  - Investor settings layout has uneven column gaps (`gap-8` on desktop collapsing to `gap-2` on mobile).
- **Button Visibility & Interaction:**
  - "Update investment mandate" button lacks saved confirmation state.
- **Font Size & Typography:**
  - 9 instances of `text-[10px]` on character limits and helper descriptions.
- **Color Combination & Contrast:**
  - Sector preference checkbox labels use light stone text (`#4A5568`) with low contrast.
- **Scrolling Problems:**
  - Message thread view lacks auto-scroll to the latest message upon sending a reply.

---

## 5. Job Seeker Role — File-by-File UI Audit (6 Files, 29 Routes)

### 5.1. `app/jobseeker/dashboard.jsx`
- **Powered Routes:** `/jobseeker/dashboard`
- **Navigation Defects:**
  - **404 Dead Link:** "View all recommendations →" links to non-existent `/jobseeker/recommendations` (line 5).
  - **Mobile 404 Dead Link:** Bottom fixed mobile navigation "More" tab links to non-existent `/jobseeker/profile` (line 5).
- **Layout Defects:**
  - Shell sidebar width is `w-[238px]` with `lg:ml-[238px]`, conflicting with Startup (`w-[240px]`), causing layout shift.
  - Recommended jobs card list has uneven vertical spacing between tags and action buttons.
- **Button Visibility & Interaction:**
  - "View" job button only shows a toast message instead of navigating to the job detail screen.
  - "Prepare for interview" modal action buttons do not navigate to the practice room.
- **Font Size & Typography:**
  - 41 instances of `text-[9px]` and `text-[10px]` in job cards, stage pills, and interview reminders.
- **Color Combination & Contrast:**
  - Low contrast `text-[9px]` inside colored status pills (`bg-[#F3EBDD] text-[#806236]`, `bg-[#E7F3EC] text-[#286749]`).
- **Scrolling Problems:**
  - Application pipeline horizontal status indicators lack scrollbar snapping on touch viewports.

---

### 5.2. `app/jobseeker/jobseeker-find-apply.jsx`
- **Powered Routes:** `/jobseeker/jobs`, `/jobseeker/jobs/[jobId]`, `/jobseeker/jobs/[jobId]/apply`, `/jobseeker/saved`, `/jobseeker/alerts`, `/jobseeker/startups`, `/jobseeker/companies/[companyId]`
- **Navigation Defects:**
  - Links to non-existent `/jobseeker/preferences` and `/jobseeker/profile` (404 errors).
  - **41 dead buttons** with `onClick={() => {}}` empty handlers.
- **Layout Defects:**
  - Search filter sidebar collapses awkwardly; desktop search input has fixed width (`w-72`) that wraps header content on laptop viewports.
- **Button Visibility & Interaction:**
  - 15 buttons completely lack `onClick` or `type` attributes.
  - "Quick apply" button does not attach selected resume.
- **Font Size & Typography:**
  - 167 instances of `text-[9px]`, `text-[10px]`, and `text-[11px]` across search filters, job cards, and salary ranges.
- **Color Combination & Contrast:**
  - Company logo fallback squares use varied arbitrary pastel colors without dark mode tokens.
- **Scrolling Problems:**
  - Search results list has no pagination or infinite scroll containment, leading to extreme scroll fatigue on mobile.

---

### 5.3. `app/jobseeker/jobseeker-applications-offers.jsx`
- **Powered Routes:** `/jobseeker/applications`, `/jobseeker/applications/[applicationId]`, `/jobseeker/interviews`, `/jobseeker/offers`, `/jobseeker/offers/[offerId]`, `/jobseeker/offers/compare`
- **Navigation Defects:**
  - **40 dead buttons** with `onClick={() => {}}` empty handlers.
  - Links to `/jobseeker/profile` in mobile navigation (404).
- **Layout Defects:**
  - Side-by-side offer comparison table breaks into a single stacked column on mobile, destroying the comparison utility.
- **Button Visibility & Interaction:**
  - "Negotiate offer" and "Accept offer" buttons have dummy empty handlers.
- **Font Size & Typography:**
  - 92 instances of `text-[10px]` and `text-[11px]` across compensation breakdowns, equity vests, and stage tags.
- **Color Combination & Contrast:**
  - Stage pill colors (`Applied`, `Shortlisted`, `Interview`, `Offer`, `Not selected`) have inconsistent border and contrast ratios.
- **Scrolling Problems:**
  - Kanban board columns stack vertically on mobile screens instead of enabling horizontal swipe columns.

---

### 5.4. `app/jobseeker/jobseeker-resume-maker.jsx`
- **Powered Routes:** `/jobseeker/resumes`, `/jobseeker/resumes/new`, `/jobseeker/resumes/[resumeId]`, `/jobseeker/resumes/[resumeId]/ats`, `/jobseeker/resumes/[resumeId]/tailor`
- **Navigation Defects:**
  - **41 dead buttons** with `onClick={() => {}}` empty handlers.
  - Mobile bottom navigation points to 404 profile page.
- **Layout Defects:**
  - A4 live resume preview pane has a fixed pixel scale that overflows laptop screens (1366×768) and breaks completely on mobile screens.
- **Button Visibility & Interaction:**
  - "Add experience", "Format bullet", "Change font", and "Export PDF" buttons do nothing.
- **Font Size & Typography:**
  - 84 instances of micro-typography (< 12px) in resume editor controls and score breakdowns.
- **Color Combination & Contrast:**
  - ATS score gauge uses arbitrary green `#286749` and gold `#806236` without semantic theme mapping.
- **Scrolling Problems:**
  - Resume live preview container lacks responsive zoom controls (`transform: scale(...)`), forcing horizontal scroll.

---

### 5.5. `app/jobseeker/jobseeker-interview-trainer.jsx`
- **Powered Routes:** `/jobseeker/practice`, `/jobseeker/practice/new`, `/jobseeker/practice/drills`, `/jobseeker/practice/rubric`, `/jobseeker/practice/history`, `/jobseeker/practice/[sessionId]`, `/jobseeker/practice/[sessionId]/report`, `/jobseeker/readiness`
- **Navigation Defects:**
  - **69 dead buttons** with `onClick={() => {}}` empty handlers.
  - Live session practice room lacks clear exit confirmation.
- **Layout Defects:**
  - Audio waveform visualizer and video placeholder have fixed aspect ratios that clip on mobile viewports.
- **Button Visibility & Interaction:**
  - "Start recording", "Stop recording", and "Next question" buttons lack keyboard hotkey support and clear active recording pulses.
- **Font Size & Typography:**
  - 108 instances of micro-typography in rubric evaluation criteria and feedback scorecards.
- **Color Combination & Contrast:**
  - Speaking pace and filler word counter badges use low-contrast badges against ivory background.
- **Scrolling Problems:**
  - Feedback report page has nested scrollable cards that trap mouse wheel scrolling.

---

### 5.6. `app/jobseeker/jobseeker-shared-pages.jsx`
- **Powered Routes:** `/help`, `/help/tickets`, `/help/tickets/[ticketId]`, `/notifications`, `/jobseeker/messages`, `/jobseeker/settings`
- **Navigation Defects:**
  - **Critical Shell Hijacking:** Hardcodes `<JobSeekerShell>`, forcing Startups, Mentors, Investors, and Employers into Job Seeker mode when accessing Help or Notifications!
  - 34 dead buttons with `onClick={() => {}}` empty handlers.
- **Layout Defects:**
  - Support ticket form has misaligned attachment button and submit button.
- **Button Visibility & Interaction:**
  - Notification filter tabs ("All", "Unread", "Jobs", "Interviews") do not update unread badge counts.
- **Font Size & Typography:**
  - 41 instances of micro-typography in notification timestamps and ticket IDs.
- **Color Combination & Contrast:**
  - Unread notification indicator is a tiny gold dot with poor visibility against white card backgrounds.
- **Scrolling Problems:**
  - Help FAQ accordion expands indefinitely without search highlight scrolling.

---

## 6. Employer Role — File-by-File UI Audit (4 Files, 18 Routes)

### 6.1. `app/employer/employer-dashboard.jsx`
- **Powered Routes:** `/employer/dashboard`
- **Navigation Defects:**
  - **6 Broken 404 Links:** Primary sidebar links to `/employer/jobs` (actual: `/employer/hiring`), `/employer/candidates` (actual: `/employer/talent`), `/employer/company` (404), `/employer/team` (404), `/employer/messages` (404), and `/employer/settings` (404) (lines 592-603).
  - 13 dead buttons with empty `onClick={() => {}}` handlers.
- **Layout Defects:**
  - Top metric cards use `grid-cols-2 lg:grid-cols-4` which causes text wrapping and button clipping on 390px mobile viewports.
- **Button Visibility & Interaction:**
  - "Review applicants" button links to non-existent `/employer/jobs/job-1/applicants` (404).
- **Font Size & Typography:**
  - 58 instances of micro-typography (`text-[10px]`, `text-[11px]`).
- **Color Combination & Contrast:**
  - Activity feed timestamps use low contrast `#A0A7B4`.
- **Scrolling Problems:**
  - Active jobs table overflows on mobile without visual scroll indicators.

---

### 6.2. `app/employer/employer-hiring.jsx`
- **Powered Routes:** `/employer/hiring`, `/employer/jobs/new`, `/employer/jobs/[jobId]`, `/employer/jobs/[jobId]/edit`, `/employer/jobs/[jobId]/compare`, `/employer/jobs/[jobId]/applicants/[applicantId]`, `/employer/talent`, `/employer/interviews`, `/employer/offers`, `/employer/offers/[offerId]`, `/employer/requests/new`
- **Navigation Defects:**
  - **59 dead buttons** with `onClick={() => {}}` empty handlers.
  - Sidebar links repeat the 6 broken 404 routes.
- **Layout Defects:**
  - Candidate pipeline Kanban board has fixed column widths that break mobile viewports.
- **Button Visibility & Interaction:**
  - **Publish Button Dead:** Job editor "Publish" button has zero `onClick` or form handler.
  - Candidate comparison "+ Add" and "Export PDF" buttons do nothing.
- **Font Size & Typography:**
  - 147 instances of micro-typography (`text-[10px]`, `text-[11px]`).
- **Color Combination & Contrast:**
  - Candidate match score badge uses subtle `#E7F3EC` with green text that fails contrast under glare.
- **Scrolling Problems:**
  - Candidate comparison table has fixed header cells that do not freeze during horizontal scrolling.

---

### 6.3. `app/employer/employer-insights-trust.jsx`
- **Powered Routes:** `/employer/analytics`, `/employer/activity`, `/employer/trust`
- **Navigation Defects:**
  - Links to `/employer/verification` which 404s.
  - 20 buttons lack `onClick` or `type`.
- **Layout Defects:**
  - Analytics charts use fixed heights and absolute positioned bars that clip on mobile.
- **Button Visibility & Interaction:**
  - "Request verification" button has no feedback or state change.
- **Font Size & Typography:**
  - 46 instances of micro-typography.
- **Color Combination & Contrast:**
  - Funnel drop-off charts use dark ink bars that blend into dark mode backgrounds.
- **Scrolling Problems:**
  - Audit log table overflows horizontally on small screens.

---

### 6.4. `app/employer/employer-process-setup.jsx`
- **Powered Routes:** `/employer/hires`, `/employer/hires/[hireId]`, `/employer/templates`
- **Navigation Defects:**
  - 18 dead buttons with `onClick={() => {}}` empty handlers.
- **Layout Defects:**
  - Interview scorecard builder has misaligned drag handles and score sliders.
- **Button Visibility & Interaction:**
  - "Add stage", "Save template", and "Duplicate template" buttons do nothing.
- **Font Size & Typography:**
  - 82 instances of micro-typography.
- **Color Combination & Contrast:**
  - Scorecard rating buttons (1 to 5) have ambiguous selected states.
- **Scrolling Problems:**
  - Hires onboarding checklist table overflows mobile screens.

---

## 7. Authentication & Shared Platform UI Audit

### 7.1. `app/AuthScreen.jsx`
- **Powered Routes:** `/login`, `/register`, `/register/role`, `/verify-email`, `/forgot-password`, `/reset-password`, `/onboarding`
- **Navigation Defects:**
  - **Dead-End Notices:** Submitting `/login` and `/onboarding` shows a static notice without redirecting to any dashboard.
  - **Role State Loss:** Role chosen at `/register/role` is lost on navigation to `/verify-email`.
  - **Dead Legal Links:** Terms and Privacy links point to `#terms` and `#privacy`.
- **Layout Defects:**
  - Split screen (`lg:grid-cols-[45%_55%]`) hides left hero branding section on mobile with `hidden lg:flex`.
- **Button Visibility & Interaction:**
  - "Show/hide password" eye button lacks clear focus ring; social login buttons have no `onClick`.
- **Font Size & Typography:**
  - Legal disclaimer is `text-xs` with tight leading.
- **Color Combination & Contrast:**
  - Left hero sidebar uses `#0F1B2D` with `text-white/65` which has low contrast in dim environments.
- **Scrolling Problems:**
  - Onboarding form exceeds vertical viewport on short mobile screens (360×640) without a scroll indicator.

---

## 8. Cross-Role UI Defect Matrix

| Failure Category | Startup Role | Mentor Role | Investor Role | Job Seeker Role | Employer Role | Auth / Shared |
|---|---|---|---|---|---|---|
| **Navigation** | Raw `<a>` full reload; mobile menu dead | 404 links to profile & availability | Hardcoded `href="#"` on 3 core items | 404 on recommendations & profile | 6 of 10 sidebar links 404 | Dead-end login; lost role state |
| **Layout** | 9 independent sidebars; `w-[240px]` | Table squish at 768px | Slide-over drawer overlaps header | Sidebar `w-[238px]`; A4 preview breaks | Mobile cards wrap; scorecard misaligned | Hero hidden on mobile |
| **Button Visibility** | 29 toast-theater buttons; fake copy | Dead session join; unvalidated forms | Unclear Pass/Save toggle states | 225 dead buttons (`onClick={() => {}}`) | 94 dead buttons; Publish button dead | Social login buttons dead |
| **Font Size (< 12px)** | 157 instances | 102 instances | 119 instances | 533 instances | 333 instances | 0 instances |
| **Color Contrast** | Low contrast stone & darkdash local | Uncalibrated rupee font weights | Clashing verified/gold badge hues | Low contrast colored pills | Low contrast timestamps (`#A0A7B4`) | `text-white/65` on dark ink |
| **Scrolling** | Table overflow on mobile; fixed nav clip | Modals lack max-h scroll | Deal drawer lacks internal scroll | Kanban stacks vertically on mobile | Jobs & candidate table overflow | Onboarding clips on short mobile |

---

## 9. Prioritized Remediation Action Plan

1. **Immediate Navigation Fixes:**
   - Correct the 6 broken route targets in Employer sidebar to `/employer/hiring` and `/employer/talent`.
   - Update Investor sidebar links from `#` to `/investor/offers`, `/investor/portfolio`, `/investor/messages`.
   - Update Job Seeker mobile navigation from `/jobseeker/profile` to `/jobseeker/settings`.
   - Wire `router.push()` into `/login` and `/onboarding` submit handlers.
2. **Immediate Button & Form Fixes:**
   - Wire `JobEditorPage` Publish button to form submission state.
   - Replace 319 empty no-op `onClick={() => {}}` handlers with active state updates or feedback dialogs.
   - Implement real clipboard write via `navigator.clipboard.writeText`.
3. **Typography & Contrast Normalization:**
   - Bump all 1,244 micro-typography instances (`text-[9px]`, `text-[10px]`, `text-[11px]`) to standard accessible sizes (`text-xs` / 12px minimum).
   - Replace `text-[#A0A7B4]` and `text-white/40` with accessible contrast tokens.
4. **Layout & Scroll Stabilization:**
   - Add `overflow-x-auto` wrappers around all wide data tables and Kanban boards.
   - Add `max-h-[90vh] overflow-y-auto` to all modal dialogs.
   - Unify sidebar widths to `w-60` (240px) and introduce role-level `layout.js` files.
