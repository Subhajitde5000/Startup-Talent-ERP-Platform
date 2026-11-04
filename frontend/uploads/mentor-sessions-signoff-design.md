# Mentor Sessions and Sign-off Pages Design

The pages where a mentor runs sessions with startups and signs off the work. Sign-off is the main goal of the mentor module: when a mentor signs off every investment-readiness item, the startup earns the **Investment Ready** badge. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Mentor role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user has the `mentor` role, a verified mentor profile, and (for startup-specific pages) an `Active`, `Paused` or past mentorship with that startup. Details are in **Part A9**. Do not show these pages to startups, investors, job seekers or employers.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Sessions | `/mentor/sessions` | Upcoming, past and calendar views of all sessions across startups |
| 2 | Session Detail | `/mentor/sessions/:sessionId` | Agenda, video, notes, action items, summary and feedback for one session |
| 3 | Readiness Sign-off | `/mentor/startups/:mentorshipId/readiness` | Review the six checklist items; sign off or request changes |
| 4 | Deliverables Review | `/mentor/deliverables` | Review submitted work from all startups in one queue |

Related pages already designed: Mentor Dashboard, Startup Requests, My Startups, Mentorship Workspace and Startup Overview (`mentor-core-design.md`). The startup's side of sessions and readiness is in `startup-mentor-design.md`; the mentor pages here are the other side of the same shared records.

---

# Part A. Shared foundations

## A1. Design principles

- **Time-aware:** sessions are about the clock. Time zones are always shown, and what is happening now or soon comes first.
- **Capture while it's fresh:** after each session, the page prompts the mentor for a short summary and action items before moving on.
- **Specific sign-off:** every approval or change request is tied to a checklist item, the evidence reviewed and a written note, so the startup knows exactly what to do next.
- **Fair and consistent:** each item shows what "done" means, so mentors judge against the same criteria for every startup.
- **Evidence trail:** all sign-offs, notes and files are logged. Investors rely on the badge, so the record has to be solid.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, signed-off items |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Progress fill, "live now" accent, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlights, badges, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Signed off, completed, accepted |
| `--warning` | `#B7791F` | Waiting, due soon, needs summary |
| `--error` | `#B42318` | Changes requested, overdue, cancelled |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Times use 12-hour format with the time zone (for example, "4:00 PM IST"), configurable in Settings.

## A4. Shared layout

Desktop (≥ 1200px): the mentor sidebar and top bar from the mentor core pages, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar, sticky bottom action button.

## A5. Shared components

### Session card
Date and time (with time zone), startup logo and name, topic, duration, session type (Intro call, Regular, Review, Pitch practice), status chip, attendees as avatars, and actions: **Join** (appears 10 minutes before start), **Open**, **Reschedule**.

### Session status chips
`Scheduled` (stone), `Confirmed` (success tint), `Live` (gold fill, pulsing dot respects reduced motion), `Completed` (ink outline), `Needs summary` (warning tint), `Reschedule requested` (warning tint), `Cancelled` (error tint), `No-show` (error outline).

### Checklist item status
`Not started` (stone), `In progress` (ink outline), `Submitted` (warning tint, waiting for the mentor), `Signed off` (success tint, check), `Changes requested` (error tint).

### Sign-off progress
Horizontal bar (gold on stone-200) with "4 of 6 items signed off".

### Shared-data indicator
Small lock icon and caption: "Shared by {Startup}". Items not shared appear as "Not shared" in `--stone-400`.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for notes and drafts, "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner on every page: "Your mentor profile is under review. Sessions and sign-offs are disabled until you're approved." |
| Suspended | Read-only pages with a banner and **Contact support** |
| Offline | Notes keep saving locally; banner "You're offline. Changes will sync." |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Calendar, slot pickers and checklists are fully keyboard operable; a calendar event is always reachable as a list item too.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.
- Live captions or a transcript option are available if the video provider supports them.

## A8. Privacy and conduct rules

- Recordings are **off by default** and only possible if both sides consent before the session starts. Recordings are private and can be deleted by the startup on request.
- Private mentor notes are visible only to the mentor and never returned in startup-facing responses.
- A mentor sees only the documents and data the startup shared for this mentorship.
- A mentor signs off only what they have actually reviewed. The page requires linking evidence for each sign-off.
- Mentors must declare conflicts of interest. A flagged item routes to admin review.
- No sign-off in exchange for payment, equity or other benefit is allowed outside the recorded agreement; the sign-off page includes a short conduct reminder and a **Report a concern** link.

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users with the `mentor` role can open any `/mentor/...` route |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, investor, job seeker, employer users see a 403 page ("This page is for mentors") with a link to their own home; no mentor data is fetched or rendered |
| **Multi-role users** | A founder or job seeker who is also a mentor sees the role switcher; switching changes the sidebar and routes between `/startup/...` and `/mentor/...` |
| **Mentor not yet approved** | Pages open read-only with the verification banner; booking, joining, sign-off and deliverable decisions are disabled |
| **Per-session access** | `/mentor/sessions/:sessionId` opens only if the signed-in mentor is the session's mentor (or an invited co-mentor). Anything else shows 404 |
| **Per-mentorship access** | The readiness page opens only for startups the mentor has a mentorship with. Past mentorships are read-only |
| **Sign-off authority** | Only the mentor assigned to an item can sign it off. A co-mentor can comment but not sign off unless the item is assigned to them |
| **Data scope** | Startup data and files are returned only for what the startup has shared; the server must filter, not just the UI |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner, and can resolve disputes about a sign-off |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Sessions: `/mentor/sessions`

## B1. Purpose
One place to see every session across all startups: what is coming up, what needs a summary, and what has happened.

## B2. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Sessions"      [+ Schedule session]    │
│          ├────────────────────────────────────────────────┤
│          │  Summary strip (4 stats)                       │
│          ├────────────────────────────────────────────────┤
│          │  Tabs: Upcoming · Needs summary · Past ·       │
│          │        Calendar                                │
│          ├────────────────────────────────────────────────┤
│          │  Toolbar: search · filters · sort              │
│          ├───────────────────────────────┬────────────────┤
│          │  List / calendar (8–9 col)    │ Side (3–4 col) │
│          │                               │ Today · Hours  │
└──────────┴───────────────────────────────┴────────────────┘
```

## B3. Summary strip
| Stat | Example |
|---|---|
| Sessions this week | 4 |
| Hours mentored this month | 14 |
| Needs summary | 2 (warning tint when above zero) |
| Reschedule requests | 1 |

## B4. Tabs

### Upcoming
Session cards (A5) grouped by day ("Today", "Tomorrow", "Thu 6 Nov"). The next session within 30 minutes is highlighted with `--gold-tint` and a countdown. Actions per card: **Join**, **Prepare** (opens detail on the Agenda tab), **Reschedule**, **Cancel**. Reschedule requests show the proposed new time with **Accept**, **Propose another** and **Decline**.

### Needs summary
Completed sessions without a mentor summary, oldest first. Each row: startup, date, topic, time since, **Add summary**. Summary is expected within 24 hours (configurable). Overdue items show a warning chip.

### Past
Table: date, startup, topic, duration, type, attendance, summary status (Added, Missing), rating received (if shared by the startup), deliverables created, **View**. Filters: startup, date range, type. Export to CSV (own sessions only).

### Calendar
Week (default) and month views. Sessions are ink chips; your available slots appear as faint stone blocks; blocked time in hatched stone; conflicts flagged with a warning icon. **Today** button, drag a session to propose a new time (sends a reschedule request, never silently moves it). A mini month picker on the side.

## B5. Toolbar
Search by startup or topic. Filters: startup, status, type, date range. Sort: Soonest, Latest, Startup name.

## B6. Schedule session (modal or drawer)
1. **Startup** (only your active mentorships) and mentorship goal link
2. **Type:** Intro call, Regular, Review, Pitch practice
3. **Topic and agenda items** (optional, editable by both sides)
4. **Time:** pick from your open slots, shown in your time zone and the startup's; duration (30/45/60)
5. **Attendees:** startup team members to invite, optional co-mentor
6. **Prepare:** attach documents for the startup to read beforehand
7. **Fee:** summary from the agreement (session fee, free or package credit); no change allowed here
8. **Send invite** (primary). The startup confirms the time or proposes another.

## B7. Side column
- **Today:** list of today's sessions with **Join** or **Prepare**.
- **Availability this week:** open slots count and a link to edit availability.
- **Hours this month vs capacity:** simple bar, so mentors can pace themselves.

## B8. States
- **No sessions yet:** "No sessions scheduled. Book your first one from a startup's workspace." with **Open My Startups**.
- **Session starting soon:** gold-tint card with the **Join** button focused.
- **Cancelled by startup:** chip and a note on late-cancellation rules and any fee handling per the agreement.
- **Calendar conflict:** warning with the clashing items and **Propose new time**.
- **Not verified:** actions disabled with the banner (A6).

---

# Part C. Session Detail: `/mentor/sessions/:sessionId`

## C1. Purpose
The working page for one session, before, during and after. The same shared record the startup sees at `/startup/sessions/:sessionId`, with mentor-only tools added.

## C2. Header
Topic, status chip, date and time (with time zone), duration, type, startup logo and name (link to the workspace), attendees. Actions by state:
- Before: **Join session** (within 10 minutes), **Reschedule**, **Cancel**
- During: **Join** or **Return to session**, **End session**
- After: **Add summary**, **Book follow-up**

## C3. Layout
Left main column (8 col) with tabs, right panel (4 col).

### Tabs
1. **Agenda**
   - Shared agenda items, editable by both sides before the session; reorder with drag and a keyboard alternative; mark items as covered during the session.
   - **Prep for you** (mentor-only card): last session summary, open deliverables, pending sign-offs for this startup, and shared files to review, so prep takes two minutes.
2. **Notes**
   - Collaborative notes during and after (rich text).
   - Two layers: **Shared notes** (visible to the startup) and **Private notes** (lock icon, mentor only; never returned to the startup).
   - **Action items:** each with an owner (mentor or a startup member), due date, and **Create task** (adds a task to the startup's list with a Mentor pill) or **Create deliverable**.
3. **Files**
   - Documents attached to the session. **Request a document** from the startup; see what is view-only.
4. **Recording** (only if both sides consented)
   - Player with a private-by-default label. If consent was not given: "Recording was off."
5. **Summary and feedback**
   - **Mentor summary** form (below, C4).
   - **Startup feedback** (rating and comment, read-only; shown after the startup submits, not before you submit your summary, to avoid bias).

### Right panel
- **Session info:** time, duration, type, fee or package credit, payment status (chip).
- **Startup snapshot:** stage, readiness, sign-off progress, shared traction highlights.
- **Readiness items discussed:** pick from the six items; each has **Sign off** or **Request changes** shortcut when relevant (opens the sign-off drawer from Part D).
- **Next session:** suggestion with **Book follow-up**.

## C4. Mentor summary (after the session)
Short form, designed to take under 3 minutes:
- **What we covered** (required, up to 1,000 characters)
- **Key decisions or advice** (optional)
- **Progress since last session:** On track, Behind, Ahead (simple choice)
- **Action items** (pulled from Notes; confirm owners and dates)
- **Readiness items touched:** multi-select
- **Next steps and suggested next session date**
- **Share with startup:** toggle (default on; the startup always sees decisions and action items; a short mentor-only note can stay private)
- **Save draft** and **Submit summary** (primary)

Submitting marks the session `Completed`, notifies the startup, and creates the linked tasks.

## C5. During the session (focus view)
A minimal layout that keeps notes and agenda beside the video (the platform's managed video, WebRTC): agenda on the left with check-offs, the notes editor center, a timer showing elapsed and remaining time. A subtle banner: "Recording is off." Distraction is minimized: only the essentials appear, and the sidebar collapses.

## C6. States
- **Before the session:** agenda and prep emphasized.
- **Live:** `Live` chip; **Join** primary.
- **Needs summary:** warning banner with **Add summary**.
- **No-show by startup:** the mentor marks no-show with a note; fee and refund handling follow the agreement; **Rebook** option for the startup.
- **Mentor cancelled:** reason required; the startup is notified; automatic refund note where fees apply.
- **Connection problems:** reconnect hint and a fallback "Use phone dial-in" if provided by the video service; the session can be marked as continued offline with a manual log.
- **Past session, read-only:** edits to shared notes stay open for 7 days; after that, only amendments with a visible "Edited" label.

---

# Part D. Readiness Sign-off: `/mentor/startups/:mentorshipId/readiness`

## D1. Purpose
Where the mentor reviews the investment-readiness checklist for one startup. Sign-off is item by item, and when all items pass, the startup earns the **Investment Ready** badge.

## D2. Layout
Top: a header with the startup and a large progress view. Below: the checklist (main column) and a side column with evidence, score and history.

### Header
Startup logo and name, stage pill, **readiness score** gauge (0 to 100), sign-off progress ("4 of 6 items signed off"), badge status (`Not yet`, `Ready for badge review`, `Earned on {date}`). Actions: **Message**, **View startup**, **Download readiness summary (PDF)** (only once all items are signed off).

## D3. The checklist (default items)
1. Pitch deck and one-page summary reviewed
2. Business model and unit economics validated
3. Financial projections and use of funds defined
4. Cap table and legal basics in order
5. Traction metrics documented
6. Data room complete

Each row:
- Title and **What "done" means** (3–5 short criteria the mentor can tick)
- **Status chip** (Checklist item status, A5)
- **Evidence:** linked files, tasks and analytics views the startup attached (view-only, with "Shared by {Startup}" and updated date)
- **Assigned mentor** (you, or another mentor on this startup)
- Last updated and **Comments** (thread)
- Actions: **Review**, **Sign off**, **Request changes**

## D4. Review drawer (opens from **Review**)
Right drawer, 640px.

1. **Item and criteria:** the "done" criteria as a checklist the mentor ticks as they verify each point.
2. **Evidence viewer:** tabs for each attached item (document preview, analytics snapshot, task list). Missing evidence is highlighted: "No cap table attached."
3. **Startup's notes:** what the startup wrote when submitting.
4. **Your decision:**
   - **Sign off** (primary): requires all criteria ticked and a short note ("What I reviewed and why it passes", 20–500 characters); optionally add a strength or risk the investors should know.
   - **Request changes:** requires a note listing what is missing and a suggested due date; criteria that failed are marked.
   - **Not applicable:** only where the platform allows (for example, no data room needed at an early stage); requires a reason and admin confirmation.
5. **Conflict check:** "I have no conflict of interest on this item" checkbox; if unchecked, a note is required and the item routes to admin review.
6. **History:** previous submissions and decisions on this item with dates and who decided.

Sign-off confirmation: "You are confirming you have reviewed this evidence. Sign-offs are recorded with your name and date and may be seen by investors." **Confirm sign-off** (primary), Cancel.

## D5. Side column
- **Score breakdown:** checklist completion, traction data and mentor feedback (the three inputs from your proposal), each with a short bar and a trend line.
- **Other mentors:** list of mentors on this startup, the items each owns, and their progress.
- **Timeline:** submissions, decisions and badge events in order.
- **Guidance:** a collapsible panel with the platform's published sign-off guidelines and a **Report a concern** link.

## D6. Badge flow
When the last item is signed off:
- A confirmation card appears: "All six items signed off. {Startup} is now Investment Ready." with date and the mentors who signed.
- The startup is notified; their dashboard, profile and investor pages update.
- Optional **Add a short endorsement** (public, up to 280 characters, shown on the startup profile only if the startup agrees).
- If admin review is required (for example, flagged conflicts or random quality checks), the status shows `Pending admin review` and the badge applies after approval.

## D7. Badge maintenance
The badge can be **paused** if key evidence becomes outdated (for example, an expired data room or financials older than a set period). The mentor sees a banner: "Evidence for item 3 is out of date. Review again to keep the badge." with **Re-review**. The startup is told why and what to update.

## D8. States
- **No items submitted yet:** "Nothing is waiting for you. {Startup} hasn't submitted any items." with **Message startup**.
- **Several items submitted:** an "Awaiting you" filter and a progress hint.
- **Changes requested:** the item is locked from the mentor's side until the startup resubmits; the resubmission shows what changed since last time (diff on documents where possible).
- **Item owned by another mentor:** read-only for you with a **Comment** option.
- **Mentorship ended:** the page is read-only; sign-offs you made remain recorded.
- **Mentor unverified or suspended:** decisions disabled with the banner (A6).

---

# Part E. Deliverables Review: `/mentor/deliverables`

## E1. Purpose
A single queue of deliverables that startups submitted across all your mentorships, so nothing waits too long.

## E2. Layout
Tabs: **Awaiting review** · **Requested by me** · **Accepted** · **Changes requested** · **All**. Toolbar: search, filters (startup, due date, status), sort (Oldest waiting, Due soon, Startup name). **+ Add deliverable** (pick the startup and mentorship).

## E3. Summary strip
| Stat | Example |
|---|---|
| Awaiting review | 5 |
| Overdue (startup) | 2 |
| Accepted this month | 11 |
| Average review time | 1.8 days |

## E4. List (table on desktop, cards on mobile)
Columns: deliverable title, startup, linked goal or readiness item, due date, submitted date, waiting time, status chip, owner (startup member), actions (**Review**, **Open workspace**).

- Waiting over 3 days shows a warning chip.
- Row grouping by startup is available.
- Bulk actions: **Mark as seen**, **Send reminder** (to startups for overdue items).

## E5. Review drawer
1. **Deliverable:** title, description and expected format, the original request, due date.
2. **Submission:** files, links, startup's comments; preview where possible; version history for resubmissions.
3. **Your review:**
   - **Accept** (optional note) or **Request changes** (note required, optional new due date).
   - Rating (optional): Does not meet, Meets, Exceeds, with a short note.
   - Checkbox: "Also use as evidence for readiness item" and a dropdown of items; a shortcut opens the sign-off drawer.
4. **Thread:** short back-and-forth with the startup.

Accepting notifies the startup, marks the linked task done and, if linked, attaches the deliverable to the readiness item's evidence.

## E6. Add deliverable
Modal: startup and goal (from the plan), title, description, expected format (document, link, spreadsheet, other), due date, link to readiness item (optional). Creates a task on the startup's board with a Mentor pill.

## E7. States
- **Nothing waiting:** "You're all caught up."
- **Overdue by startup:** warning chip on the startup's side and a **Send reminder** action; after 14 days the item suggests a check-in session.
- **Resubmitted:** `Resubmitted` chip with the changes since last time.
- **Mentorship paused or ended:** items shown read-only.

---

# Part F. Notifications for these pages

| Event | Who is notified | Channel |
|---|---|---|
| Session booked, changed or cancelled | Mentor and startup | Email, in-app |
| Session starts in 1 hour and in 10 minutes | Attendees | In-app, push |
| Reschedule requested | Receiving side | In-app, email |
| Session summary overdue (24 hours) | Mentor | In-app, email |
| Summary submitted | Startup | In-app, email |
| Readiness item submitted for sign-off | Mentor | In-app, email |
| Sign-off granted or changes requested | Startup owners | In-app, email |
| Badge earned or paused | Startup team, mentors on the startup | In-app, email |
| Deliverable submitted | Mentor | In-app |
| Deliverable accepted or changes requested | Startup | In-app |

Mentors can mute, filter or set digests in Settings.

---

# Part G. Data and validation

| Field | Rule |
|---|---|
| Session time | Within your availability; at least 12 hours ahead (configurable); no overlaps with other sessions |
| Duration | 30, 45 or 60 minutes (other lengths allowed by the mentor's settings) |
| Session summary | "What we covered" required, 20–1,000 characters; due within 24 hours (configurable) |
| Action items | Owner and due date required |
| Private notes | Up to 10,000 characters; never returned in startup-facing responses |
| Sign-off note | Required, 20–500 characters; all criteria ticked |
| Changes-requested note | Required, 20–1,000 characters |
| Not applicable | Reason required; admin confirmation |
| Endorsement | Optional, up to 280 characters; public only with the startup's consent |
| Deliverable | Title required; due date at least today |
| Files | PDF, DOCX, PPTX, XLSX, up to 25 MB, virus scanned |
| Recordings | Both-sides consent required before start; deletable by the startup |

**Audit log:** session changes, summaries, sign-offs, changes requested, badge events, file access, recording consent and deletions, each with user and time. Sign-off records are retained per platform policy and available to admin for disputes.

---

# Part H. Data connections

| Feature | Connected to |
|---|---|
| Mentor verification and status | Admin console, mentor profile |
| Availability and capacity | Mentor availability settings |
| Sessions, scheduling, reminders | Sessions module, calendar |
| Video | Managed video API (WebRTC) |
| Payments and credits | ERP billing, agreement terms |
| Readiness checklist and score | `/startup/readiness`, stage module, analytics |
| Evidence | Document vault, tasks, analytics (shared items only) |
| Deliverables | Startup tasks (`/startup/tasks`) |
| Badge and profile display | Startup profile, investor module visibility |
| Notifications | ERP notification service |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part I. CSS tokens

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

# Part J. Build order (suggested)

1. Role guard and mentor shell (Part A9), plus the verification banner.
2. Shared components: session card, status chips, checklist item status, sign-off progress.
3. **Sessions** (Upcoming and Calendar first), including scheduling.
4. **Session Detail:** Agenda and Notes first, then the summary form, then the focus view for live sessions.
5. **Readiness Sign-off** with the review drawer (the core goal of the module), then badge flow and maintenance.
6. **Deliverables Review**, linked to the sign-off evidence.
7. Needs-summary and Past tabs, reminders and notifications.
8. Empty, loading and error states, then mobile layouts.

**Reminder for the build:** every route above is mentor-only and role-based. Add the guard first, check that the mentor owns the session or mentorship, and keep the server-side filtering so a mentor can never receive information a startup hasn't shared. Sign-off decisions should always be written to the audit log.
