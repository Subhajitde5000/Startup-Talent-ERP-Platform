# Mentor Core Pages Design

The everyday working pages for the **Mentor role**. A verified mentor finds and accepts startups, runs the mentorship, and reviews what each startup chooses to share. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Mentor role** only. Access control will be added by the project owner (route guards and permission checks), so build each page assuming the signed-in user has the `mentor` role and a verified mentor profile. Details are in **Part A9**. Do not show these pages to startups, investors, job seekers or employers, and do not mix `/mentor/...` and `/startup/...` content.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Mentor Dashboard | `/mentor/dashboard` | Today's priorities: sessions, requests, sign-offs, earnings, impact |
| 2 | Startup Requests | `/mentor/requests` | Incoming requests and invitations; accept, decline or counter |
| 3 | Discover Startups | `/mentor/discover` | Browse startups that opted in; invite the ones that fit |
| 4 | My Startups | `/mentor/startups` | All active, paused and past mentorships |
| 5 | Mentorship Workspace | `/mentor/startups/:mentorshipId` | Plan, deliverables, notes, files and messages for one startup |
| 6 | Startup Overview (read-only) | `/mentor/startups/:mentorshipId/startup` | What the startup has chosen to share |

---

# Part A. Shared foundations

## A1. Design principles

- **Priorities first:** a mentor is busy. Each page opens with what needs action and by when.
- **Structured record:** goals, cadence, deliverables and sign-offs are tracked, so a mentorship leaves clear evidence of impact.
- **Respect the startup's data:** mentors see only what the startup shares. The page always says what is shared and what is not.
- **Low effort:** accept a request, log a session or sign off an item in two or three clicks.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, signed-off items |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Progress fill, highlights, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlights, badges, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Signed off, confirmed, positive change |
| `--warning` | `#B7791F` | Waiting, due soon |
| `--error` | `#B42318` | Declined, overdue, errors |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Currency in ₹ with Indian grouping by default, configurable.

## A4. Shared layout

Desktop (≥ 1200px): sidebar and top bar, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar (Home, Requests, Startups, Sessions, More), sticky bottom action button.

### Mentor sidebar (ink background, ivory text)
- Logo
- **Dashboard** (active: `--ink-soft` background, 3px gold bar at the left)
- Requests (with count badge)
- Discover startups
- My startups
- Sessions
- Deliverables
- Earnings
- Impact and reviews
- Messages
- *Bottom:* Settings, Help, **role switcher** (for multi-role accounts, for example "Mentor · Founder")

## A5. Shared components

### Startup card
Logo (48px), startup name, one-liner, stage pill (for example `Stage: Prototype`), sector, location, team size, **Verified startup** pill (gold-tint with check), readiness score (small gauge or "72 / 100"), **Fit** chip with reasons ("Needs fundraising help, you mentor seed-stage fintech"). Actions: **View**, **Accept / Invite**, **Save**.

### Mentorship status chips
`Requested` (warning tint), `Active` (success tint), `Paused` (stone), `Completed` (ink outline), `Declined` (error tint), `Invited` (gold-tint).

### Sign-off progress
Horizontal bar (gold on stone-200) with "4 of 6 items signed off". Click opens the readiness sign-off page.

### Shared-data indicator
A small lock icon and caption beside any startup data: "Shared by {Startup}". Items not shared appear as "Not shared" in `--stone-400`.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for notes and plans, "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner on every page: "Your mentor profile is under review. You can set up your profile but can't accept startups yet." with **View status** |
| Suspended | Read-only pages with a banner and **Contact support** |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Calendars and lists are fully keyboard operable; time zones always shown (default Asia/Kolkata).
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Privacy and conduct rules

- Mentors see only what each startup has chosen to share (profile, selected documents, readiness data). Access ends when the mentorship ends or the startup revokes it.
- Notes marked private stay private to the mentor and are never shown to the startup.
- Mentors cannot see the startup's investor messages, bank or cap table details unless the startup explicitly shares them.
- Block and report options exist on every startup page; admin handles disputes.
- Declined or ended mentorships keep a minimal record (dates, outcome) and remove file access.

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. Implementation note for the build: the project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users with the `mentor` role can open any `/mentor/...` route |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, investor, job seeker, employer users see a 403 page ("This page is for mentors") with a link to their own home; no mentor data is rendered or fetched |
| **Multi-role users** | A founder or job seeker who is also a mentor sees the role switcher; switching changes the sidebar and routes between `/startup/...` and `/mentor/...` |
| **Mentor not yet approved** | Pages open in a limited "pending verification" mode (A6): profile and availability are editable; Requests, Discover, accepting and sessions are disabled |
| **Per-startup access** | The Workspace and Startup Overview open only for startups the mentor has an `Active` or `Paused` mentorship with (or a past one, read-only). Any other `:mentorshipId` shows 404 |
| **Data scope** | Startup data is returned only for fields the startup has shared; the server must filter, not just the UI |
| **Admin view** | Admins can view mentor pages read-only for support, with an "Admin view" banner |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Mentor Dashboard: `/mentor/dashboard`

## B1. Purpose
The mentor's home. It answers: what needs me today, how are my startups doing, and what impact am I having?

## B2. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar: search · notifications · profile     │
│          ├────────────────────────────────────────────────┤
│          │  Greeting + status (Accepting / Full / Paused) │
│          ├────────────────────────────────────────────────┤
│          │  KPI row (4 cards)                             │
│          ├───────────────────────────────┬────────────────┤
│          │  Needs your attention         │ Next session   │
│          │  Today's sessions             │ Capacity       │
│          │  My startups at a glance      │ Earnings       │
│          │  Impact trend                 │ Tips           │
└──────────┴───────────────────────────────┴────────────────┘
```

## B3. Sections

### Greeting and availability status
- "Good evening, {Name}". Beside it, a status pill: `Accepting new startups` (success), `At capacity` (warning), `Paused` (stone). Click opens a quick menu to change it (links to Availability).

### KPI row
| Card | Example |
|---|---|
| Active startups | 4 of 5 capacity |
| Sessions this month | 12 |
| Sign-offs pending | 3 |
| Earnings this month | ₹36,000 |

Each card has a label, a big serif number, a change chip and a small sparkline.

### Needs your attention
Prioritized list, each with **Open**:
- New startup requests (with a count and the oldest waiting time; requests older than 3 days show a warning chip)
- Readiness items submitted for sign-off
- Deliverables submitted for review
- Session notes or summaries missing after a session
- Unanswered messages over 2 days
- Agreements awaiting your response

### Today's sessions
Timeline for today: time, startup, topic, **Join** (appears 10 minutes before), **Open prep** (agenda, last notes, shared files). If none: "No sessions today."

### My startups at a glance
Compact cards (up to 6): startup logo and name, stage pill, sign-off progress, last session date, next step, a health chip (On track, Needs attention, Inactive 30+ days). **View all** goes to My Startups.

### Impact trend
Line chart of the average readiness score across your active startups over time (ink line, gold current point), with a one-line insight ("Average readiness is up 8 points in 90 days"). Caption: "Correlation, not proof of cause."

### Side column
- **Next session:** date, time, startup, topic, **Join** or **Prepare**.
- **Capacity:** "4 of 5 slots used" with a progress bar and **Edit capacity**.
- **Earnings snapshot:** this month, pending payout, link to Earnings.
- **Tips:** short guidance ("Startups respond best when sign-off notes are specific").

## B4. States
- **New verified mentor, no startups:** hero card "You're approved. Start by checking your requests or browsing startups." with **View requests** and **Discover startups**.
- **No attention items:** "You're all caught up."
- **Pending verification:** banner (A6); KPI cards hidden or shown as placeholders.
- **Paused:** banner "You're paused. Startups can't send you new requests." with **Resume**.

---

# Part C. Startup Requests: `/mentor/requests`

## C1. Layout
Tabs: **Incoming** · **Invitations sent** · **Auto-match suggestions** · **Past**. Toolbar: search, filters (stage, sector, need, date), sort (Newest, Best fit, Waiting longest).

## C2. Incoming
Rows or cards: startup card summary (A5), date received, goal summary (first lines), top needs (chips), proposed cadence, proposed terms (fee model, any equity or advisory request), **Fit** chip, status, and actions: **View**, **Accept**, **Decline**.

## C3. Request detail drawer (560px)
1. **Startup summary:** profile, stage, readiness, team, traction (shared fields only).
2. **Their goal and needs:** the startup's message and top three needs.
3. **Shared documents** (if any): view-only previews.
4. **Proposed plan and terms:** cadence, duration, fee, equity or advisory share (if proposed).
5. **Your response:**
   - **Accept** (opens a short confirmation: first session date or intro call, optional welcome message)
   - **Counter terms** (edit cadence, duration, fee, advisory share; sent back as a proposal)
   - **Ask a question** (message thread)
   - **Decline** (reason required: Not my expertise, At capacity, Stage mismatch, Terms, Other; optional message; offer to suggest another mentor)
6. Conflict check: "Do you have a conflict of interest?" checkbox with a note field (for example, you advise a competitor or have invested in a related company). A flagged request is reviewed by admin.

Accepting creates the mentorship, opens the workspace and notifies the startup. Equity or advisory terms carry the reminder: "Review equity terms with a lawyer. The platform records terms but does not give legal advice."

## C4. Invitations sent
Startups you invited from Discover: status (`Invited`, `Viewed`, `Accepted`, `Declined`, `Expired`), date, message, **Resend** (after 7 days) or **Withdraw**.

## C5. Auto-match suggestions
Up to 5 startups the platform matched by industry, stage and need, each with the reason. Actions: **View**, **Invite**, **Not interested** (improves future matches). Labeled `Suggested match`; the mentor always decides.

## C6. States
- **No requests:** "No requests yet. Check that your availability and profile are complete." with **Edit profile** and **Discover startups**.
- **At capacity:** banner "You're at capacity. New requests are held until you open a slot." with **Edit capacity**.
- **Expired request (7 days):** greyed with **Decline politely** and a note that the startup was told it expired.
- **Not verified:** all actions disabled with the banner from A6.

---

# Part D. Discover Startups: `/mentor/discover`

## D1. Layout
Filters on the left (280px), results in the center, preview drawer on the right. Only startups that opted in to mentor visibility appear.

## D2. Filters
Stage (Idea, Prototype, Early revenue, Mature), industry and sector, need (fundraising, product, go-to-market, finance, hiring, legal basics, technology), location or region, team size, readiness range, "Needs a mentor" (no active mentor), "Verified startups only" (on by default), "Recently active."

Not offered: personal characteristics of founders (age, gender, religion, caste, nationality).

## D3. Results
Startup cards (A5), sort: Best fit, Newest, Highest readiness, Most in need. A **Recommended for you** row at the top (up to 5) uses your expertise, preferred stages and capacity.

Card actions: **View**, **Invite to mentorship**, **Save**, **Hide**.

## D4. Preview drawer
Quick view of the startup profile (shared fields), what they need help with, readiness checklist progress, existing mentors count, and **Invite to mentorship**.

## D5. Invite modal
- Short message (required, 50–500 characters) explaining how you can help.
- Proposed focus areas (chips), cadence and fee terms (defaults from your profile, editable).
- Optional: free intro call toggle.
- Daily invite limit counter ("3 invitations left today") to prevent spam.
- **Send invitation** (primary). The startup decides whether to accept.

## D6. States
- **Not verified or at capacity:** results visible, **Invite** disabled with the reason.
- **Already mentoring or invited:** card shows the status instead of the button.
- **No results:** suggestions to widen filters.
- **Limit reached:** message with the reset time.

---

# Part E. My Startups: `/mentor/startups`

## E1. Layout
Tabs: **Active** · **Paused** · **Past**. Toolbar: search, filters (stage, sector, health), view toggle (Cards or Table), sort (Recent activity, Name, Sign-off progress).

## E2. Cards view
Startup card (A5) plus: mentorship status chip, start date, sessions held, next session, **sign-off progress**, last activity, health chip (`On track`, `Needs attention`, `Inactive 30+ days`), and actions: **Open workspace**, **Message**, **Book session**, overflow (Pause, End mentorship, Report).

## E3. Table view
Columns: startup, stage, status, started, sessions, next session, sign-off progress, deliverables open, last activity, actions.

## E4. Summary strip
Active count and capacity ("4 of 5"), sessions this month, items awaiting your sign-off, startups needing attention.

## E5. Past mentorships
Read-only records: dates, sessions held, final readiness items signed off, outcome (Completed, Ended by startup, Ended by mentor), review received, **Export summary (PDF)**. File access is removed.

## E6. States
- **Empty:** "You aren't mentoring any startups yet." with **View requests** and **Discover startups**.
- **Inactive 30+ days:** warning chip and a suggested nudge ("Book a session or end the mentorship").
- **Pausing:** modal asking for a reason and a resume date; the startup is notified.
- **Ending:** modal with reason, optional closing note, and a reminder to complete the summary and any pending sign-offs.

---

# Part F. Mentorship Workspace: `/mentor/startups/:mentorshipId`

The shared space between this mentor and one startup. It mirrors the startup's workspace with mentor actions added.

## F1. Header
Startup logo and name, stage pill, mentorship status chip, start date, cadence, sessions held, sign-off progress. Actions: **Message**, **Book session**, **View startup** (links to the read-only overview), overflow (Pause, End, Report).

Tabs: **Overview** · **Plan** · **Sessions** · **Deliverables** · **Readiness** · **Notes** · **Files** · **Messages**.

## F2. Tabs

### Overview
- Sign-off progress and the items you own.
- Next session and latest session summary.
- Plan progress (goals completed vs total).
- Open deliverables and their due dates.
- Activity feed (sessions, notes, files, messages, sign-offs).
- Quick actions: **Log a session**, **Add deliverable**, **Add note**.

### Plan
- **Goals:** description, target date, success measure, status (Not started, In progress, Done), owner. Example: "Validate unit economics by 30 Nov."
- **Cadence and expected outputs:** agreed frequency and duration.
- Changes by one side appear as **Proposed** until the other side accepts; history is kept with who changed what.
- **Add goal** and **Propose change** buttons.

### Sessions
List of upcoming and past sessions for this startup. Row actions: **Join**, **Open session**, **Reschedule**. **Log session** adds one that took place outside the platform (marked "Manual entry"). Links to `/mentor/sessions/:sessionId`.

### Deliverables
Table: title, due date, owner (startup member), status (`To do`, `In progress`, `Submitted`, `Accepted`, `Changes requested`), your feedback.
- **+ Add deliverable:** title, description, due date, expected format. Creates a task in the startup's task list with a Mentor pill.
- On a submitted item: **Accept** or **Request changes** (a note is required).

### Readiness
Compact view of the six checklist items with status and evidence. Actions per item: **Review evidence**, **Sign off**, **Request changes** (note required). Link to the full sign-off page.

### Notes
- Shared notes by session or free-form (rich text); action items convertible to tasks.
- **Private notes** toggle: private notes are visible only to you, never to the startup, and are marked with a lock icon.
- Templates: session summary, advice given, risks noticed.

### Files
Documents shared in this mentorship with permission labels. **Request a document** (sends a request to the startup), **Stop viewing** (removes your access to a file). Access log visible to the startup.

### Messages
Secure chat thread with the startup: attachments, links to tasks and documents, templates ("Prep for our next session"). Shared with the Messages page.

## F3. Right side panel (desktop)
- **Startup snapshot:** stage, readiness score gauge, key traction numbers (shared), team size.
- **Next steps:** a short list (next session, open deliverables, pending sign-offs).
- **Terms:** fee model and cadence, with a link to the agreement.

## F4. States
- **Paused:** banner "Mentorship is paused until {date}." Tools stay visible but actions needing the startup are disabled.
- **Ended:** read-only record; **Export summary**, **Leave a note for the record**.
- **Inactive 30+ days:** prompt to book a session or end the mentorship.
- **Startup revoked access to a file:** the file appears as "No longer shared."

---

# Part G. Startup Overview (read-only): `/mentor/startups/:mentorshipId/startup`

## G1. Purpose
A read-only view of the startup as the mentor needs it: who they are, where they stand and what they chose to share. It does not allow edits to the startup's own data.

## G2. Layout
Left main column (8 col), right sticky panel (4 col). A banner at the top: "Read-only view. Showing what {Startup} has chosen to share with you."

### Header
Logo, name, tagline, stage pill, **Verified startup** pill, **Investment Ready** badge (only if earned), meta row (sector, location, founded year, team size).

### Main sections
1. **About and pitch summary:** one-liner and pitch summary.
2. **Problem, solution, market:** three compact blocks with supporting numbers.
3. **Stage and exit criteria:** stepper, criteria met and each criterion's status. Mentors can **Comment** on a criterion and see review notes they have added. (Stage review itself is done by a mentor or admin in the startup's stage workflow, and these actions follow your platform's permissions.)
4. **Traction highlights:** metrics the startup chose to share (MRR, customers, growth), each with the source and updated date; unshared metrics show "Not shared."
5. **Team:** founders and key members with roles and short bios; contact details are hidden unless shared.
6. **Documents shared with you:** list with type, updated date and access (view only), plus **Request a document**.
7. **Funding and use of funds:** only if shared.

### Right sticky panel
- **Readiness score** gauge with breakdown (checklist, traction, mentor feedback) and sign-off progress.
- **Your mentorship:** status, sessions held, next session, link to the workspace.
- **What's shared:** list of categories (Profile, Traction, Team, Documents, Funding) with Shared / Not shared status and **Ask for access** on unshared items (sends a request to the startup).
- **Actions:** **Open workspace**, **Message**, **Book session**.

## G3. States
- **Limited sharing:** many "Not shared" labels with a gentle banner: "Ask {Startup} to share more so you can give better advice."
- **Mentorship ended:** only the data the startup allows for past mentors; most sections show "Access ended."
- **Startup hid its profile:** the page shows basic identity (name and stage) and a message that they changed their sharing settings.
- **Stale data:** a chip when metrics are older than 35 days: "Last updated 42 days ago."

---

# Part H. Notifications for core mentor work

| Event | Channel |
|---|---|
| New request or invitation reply | In-app, email, push |
| Request waiting over 3 days | In-app |
| Session booked, changed or cancelled | Email, in-app |
| Session starts in 1 hour and in 10 minutes | In-app, push |
| Deliverable submitted | In-app |
| Readiness item submitted for sign-off | In-app, email |
| New message | In-app, push |
| Startup inactive 30 days | In-app |
| Agreement awaiting response | In-app, email |

Mentors can mute, filter or set digests in Settings.

---

# Part I. Data and validation

| Field | Rule |
|---|---|
| Decline reason | Required; one of the listed reasons |
| Invitation message | Required, 50–500 characters; links to external payment pages are blocked |
| Capacity | Whole number from 1 to 20; cannot go below the number of active mentorships |
| Goals per mentorship | Up to 10; each needs a target date and a success measure |
| Deliverable | Title required; due date at least today |
| Change-request note | Required when requesting changes or declining a sign-off |
| Files | PDF, DOCX, PPTX, XLSX, up to 25 MB, virus scanned |
| Private notes | Up to 10,000 characters; never returned in startup-facing responses |
| Invitations | Daily limit per plan |

**Audit log:** accept and decline actions, plan changes, sign-offs, file access, pausing and ending, with user and time.

---

# Part J. Data connections

| Feature | Connected to |
|---|---|
| Mentor verification, status and profile | Admin console, mentor profile |
| Capacity and availability | Mentor availability settings |
| Requests, invitations, matching | Mentor module, startup profile (industry, stage, needs) |
| Shared startup data | Startup profile, stage, analytics (shared fields only) |
| Readiness and sign-off | `/startup/readiness`, stage module |
| Deliverables | Startup tasks (`/startup/tasks`) |
| Sessions and video | Sessions module, managed video API |
| Files | Document vault (shared items only) |
| Messages | ERP chat service |
| Earnings snapshot | Mentor earnings and billing |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part K. CSS tokens

```css
:root {
  --ink: #0F1B2D;
  --ink-soft: #1C2B42;
  --ivory: #FAF8F4;
  --white: #FFFFFF;
  --gold: #B8955A;
  --gold-dark: #9A7A45;
  --gold-tint: #F3EBDD;
  --stone-700: #4A5568;
  --stone-400: #A0A7B4;
  --stone-200: #E5E1D8;
  --success: #2E7D5B;
  --warning: #B7791F;
  --error: #B42318;
  --radius-card: 12px;
  --radius-control: 10px;
}
```

---

# Part L. Build order (suggested)

1. Role guard and mentor shell (sidebar, top bar), per Part A9, plus the verification banner.
2. Shared components: startup card, status chips, sign-off progress, shared-data indicator.
3. **Startup Requests** (accept, decline, counter) since nothing starts without it.
4. **My Startups** and **Mentorship Workspace** (plan, deliverables, notes, messages).
5. **Startup Overview (read-only)**, with the shared-data filtering done on the server.
6. **Mentor Dashboard** once the data it summarizes exists.
7. **Discover Startups**, which can wait because auto-match and incoming requests cover the first release.
8. Notifications, empty, loading and error states, then mobile layouts.

**Reminder for the build:** every route above is mentor-only and role-based. Add the guard first, and keep the server-side data filtering so a mentor can never receive information a startup hasn't shared.
