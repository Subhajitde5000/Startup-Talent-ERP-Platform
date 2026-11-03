# Mentor Pages Design: `/startup/mentors` and related pages

The startup's side of the Mentor module. A startup finds a verified mentor, agrees a plan, holds logged sessions, and earns mentor sign-off on each investment-readiness item until it receives the **Investment Ready** badge. It uses the same visual language as the other pages: ink, ivory, one gold accent.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Mentors Overview | `/startup/mentors` | Current mentors, next session, sign-off progress, open requests |
| 2 | Find Mentors | `/startup/mentors/find` | Browse and get matched with verified mentors |
| 3 | Mentor Profile | `/startup/mentors/find/:mentorId` | See a mentor's background, reviews and availability, then request mentorship |
| 4 | Mentorship Requests | `/startup/mentors/requests` | Track requests sent to mentors and invitations received |
| 5 | Mentor Workspace | `/startup/mentors/:mentorshipId` | Plan, goals, deliverables, notes and messages with one mentor |
| 6 | Sessions | `/startup/sessions` | Book, join, and review mentor sessions |
| 7 | Session Detail | `/startup/sessions/:sessionId` | Agenda, video link, notes, action items, rating |
| 8 | Investment Readiness and Sign-off | `/startup/readiness` | Checklist signed off item by item, score, badge status |
| 9 | Mentor Payments and Agreements | `/startup/mentors/:mentorshipId/billing` | Session fees, packages, equity or advisory terms, invoices |

---

# Part A. Shared foundations

## A1. Design principles

- **Outcome-focused:** the point is "ready to be funded." Every mentor page shows the readiness sign-off progress.
- **Structured, not chatty:** goals, cadence, deliverables and sign-offs are visible and tracked, so mentoring leaves a record.
- **Trust first:** mentors are verified by admin. Credentials, past roles and reviews are visible before the startup commits.
- **Clear money and equity terms:** fees, commissions and any equity or advisory share are written down and agreed in the platform.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, signed-off items |
| `--ink-soft` | `#1C2B42` | Hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Progress fill, verified mentor accent, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlights, badges, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Signed off, confirmed |
| `--warning` | `#B7791F` | Waiting, due soon |
| `--error` | `#B42318` | Declined, errors |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`.

## A4. Shared layout

Desktop (≥ 1200px): same sidebar and top bar as other pages. The **Mentor** nav item expands to: Overview, Find mentors, Sessions, Readiness. 12-column grid, 24px gutters, max content width 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below. Mobile: single column, sticky bottom action button.

## A5. Shared components

### Mentor card
Avatar (64px), name, headline ("Ex-CTO, 2 exits"), **Verified mentor** pill (gold-tint, check), expertise chips (up to 4), industries, rating (stars with count), session price ("₹3,000 / hour" or "Free / pro bono"), availability hint ("Next free: Thu"), **Match** chip with reasons ("Fits your stage and fundraising need"). Actions: **View profile**, **Request mentorship**.

### Sign-off progress
Horizontal bar (gold on stone-200) with "4 of 6 items signed off". Click opens the readiness page. Used on the overview, workspace and sessions pages.

### Status chips
Mentorship: `Requested` (warning tint), `Active` (success tint), `Paused` (stone), `Completed` (ink outline), `Declined` (error tint). Session: `Scheduled`, `Confirmed`, `Completed`, `Cancelled`, `Reschedule requested`.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Link: `--gold-dark`. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for notes and plans with "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| No permission | Controls hidden or disabled with tooltip: "Ask an Owner or Admin." |

## A7. Role-based access

| Role | Can do |
|---|---|
| **Owner / Admin** | Request mentors, approve plans and payments, book sessions, manage agreements |
| **Member** | Join sessions, update assigned deliverables, add notes |
| **Viewer** | Read-only overview |
| **Mentor (on their own side)** | Sees the shared workspace, signs off items, logs sessions, requests deliverables |

## A8. Motion and accessibility

- 150–200ms ease-out for hover and focus; progress bars animate once. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Calendar and slot pickers are fully keyboard operable; time zones always shown (default Asia/Kolkata).
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A9. Privacy and safety rules

- Mentors see only what the startup shares with them (profile, selected documents, readiness data). Access can be revoked at any time.
- Documents shared with a mentor are logged in the audit trail.
- A mentor cannot invest through the mentorship channel without the platform's investor verification; any equity or advisory share is documented in the agreement.
- Report mentor and block options are available on every mentor page; admin handles disputes.

---

# Part B. Mentors Overview: `/startup/mentors`

## B1. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Mentors"      [Find a mentor]          │
│          ├────────────────────────────────────────────────┤
│          │  Summary strip                                 │
│          ├───────────────────────────────┬────────────────┤
│          │  My mentors (cards)           │ Next session   │
│          │  Readiness sign-off progress  │ Open requests  │
│          │  Deliverables due             │ Tips           │
└──────────┴───────────────────────────────┴────────────────┘
```

## B2. Summary strip
| Stat | Example |
|---|---|
| Active mentors | 2 |
| Sessions held | 9 |
| Deliverables due | 3 |
| Readiness | 4 of 6 signed off |

## B3. Sections

### My mentors
Cards for each active mentorship: mentor avatar and name, focus area, sessions held, next session, sign-off items they own, **Open workspace**. Paused or completed mentorships are in a collapsed "Past mentors" list.

### Readiness sign-off progress
Compact checklist (six items) with each item's status: `Not started`, `In progress`, `Submitted for sign-off`, `Signed off`, and the mentor who owns it. Link: **Open readiness page**. When all items pass, show the **Investment Ready** badge card (gold-tint with check) and a prompt to make the profile visible to investors.

### Deliverables due
Next five deliverables from mentors (title, due date, status), with **Submit** and **Open**. These also appear as tasks in `/startup/tasks` with a Mentor pill.

### Side column
- **Next session:** date, time, mentor, topic, **Join** (appears 10 minutes before), **Reschedule**.
- **Open requests:** pending requests with status and **View**.
- **Tips:** short guidance based on stage ("At the Prototype stage, mentors often focus on user feedback and the first revenue plan").

## B4. States
- **No mentor yet:** hero card "Find a mentor to guide your next stage." with **Find a mentor** and an **Auto-match me** option.
- **Mentor request pending:** banner "Waiting for {Mentor} to respond. Usually within 3 days."
- **Mentorship ended:** card moves to Past mentors with **Leave a review**.

---

# Part C. Find Mentors: `/startup/mentors/find`

## C1. Layout
Filters on the left (280px), results in the center. Top: **Recommended for you** row (3 auto-matched mentors with reasons).

## C2. Filters
Expertise (fundraising, product, go-to-market, finance, hiring, legal basics, technology), industry, stage fit, language, price (free, paid range), availability (this week, this month), experience (past exits, operator, investor), rating, "Verified only" (on by default).

Not offered: age, gender, religion, caste, nationality.

## C3. Results
Mentor cards (A5) with sort: Best match, Rating, Price, Soonest available. Pagination or infinite scroll with a result count.

## C4. Auto-match
**Auto-match me** opens a short modal: current stage (prefilled), top three needs, budget, preferred cadence. Results show three mentors with a reason for each match. Matching uses industry, stage and need; the startup always chooses whether to send a request.

## C5. States
- **No results:** suggestions to widen filters ("Remove one expertise").
- **Profile incomplete:** banner "Complete your startup profile to get better matches."
- **Request limit reached:** "You have 3 pending requests. Wait for a response before sending another."

---

# Part D. Mentor Profile: `/startup/mentors/find/:mentorId`

## D1. Layout
Left main column (8 col), right sticky panel (4 col).

### Header
Avatar, name, headline, **Verified mentor** pill, location and languages, rating, sessions delivered, response time, expertise chips.

### Main sections
1. **About:** background and mentoring style, in the mentor's words.
2. **Experience:** past roles, exits, companies founded or advised (with years). Verified items show a small check; unverified items are labeled "Self-reported".
3. **How I can help:** focus areas with typical outcomes (for example, "Build a fundraising-ready financial model").
4. **Startups mentored:** anonymized or consented examples with stage reached.
5. **Reviews:** star rating, written reviews from startups (verified sessions only), mentor replies. Sort by recent or highest.
6. **Availability:** weekly calendar view with open slots in the startup's time zone.

### Right panel (sticky)
- **Pricing and terms:** session price, package options (for example, 4 sessions), free intro call (if offered), commission shown to the startup in the payment summary, equity or advisory share expectations (if the mentor requests any, shown as "Mentor prefers: advisory share 0.5%", negotiable).
- **Request mentorship** (primary) and **Book intro call** (secondary).
- **Save** and **Report**.

## D2. Request mentorship (modal)
- Goal for the mentorship (required, up to 500 characters)
- Top three needs (chips)
- Preferred cadence (weekly, fortnightly, monthly) and expected duration
- Documents to share with the mentor (pick from the vault; optional)
- Message to the mentor
- Agreement preview: fee terms and any equity or advisory share (editable proposals)
- **Send request** (primary)

## D3. States
- **Mentor not accepting new startups:** disabled button with "Not accepting new mentees. Join waitlist."
- **Already mentoring you:** buttons replaced with **Open workspace**.

---

# Part E. Mentorship Requests: `/startup/mentors/requests`

Tabs: **Sent** · **Received** (mentors can invite startups) · **Past**.

Row: mentor (or startup contact for invitations), date, goal summary, status chip, last activity, actions (**View**, **Withdraw**, **Accept** / **Decline** for invitations).

**Request detail drawer:** the original request, mentor reply, proposed plan or counter-terms, **Accept terms**, **Ask a question**. Accepting creates the mentorship and opens the workspace.

**States:** declined requests show the mentor's reason if given and suggest alternatives; expired requests (after 7 days) show **Resend**.

---

# Part F. Mentor Workspace: `/startup/mentors/:mentorshipId`

The shared space between one startup and one mentor.

## F1. Header
Mentor avatar and name, mentorship status chip, start date, cadence, sessions held, **Message**, **Book session**, overflow (Pause mentorship, End mentorship, Report). Tabs: **Overview** · **Plan** · **Sessions** · **Deliverables** · **Notes** · **Files** · **Messages**.

## F2. Tabs

### Overview
- Sign-off progress and the items this mentor owns.
- Next session and latest note summary.
- Plan progress (goals completed).
- Activity feed.

### Plan
- **Goals:** each with description, target date, success measure, status and owner. Example: "Validate unit economics by 30 Nov."
- **Cadence and deliverables:** agreed session frequency and expected outputs.
- Plan is co-edited. Changes by one side show as "proposed" until the other side accepts, and the history is kept.

### Sessions
Upcoming and past sessions for this mentor with notes and ratings (links to the Session detail page).

### Deliverables
Table: title, due date, owner, status (To do, In progress, Submitted, Accepted, Changes requested), mentor feedback. **Submit for review** attaches a file or link. Linked task shown.

### Notes
Shared notes by session or free-form, rich text with action items convertible to tasks. A **private notes** toggle for each side (private notes stay private).

### Files
Documents shared in this mentorship, with permission labels. **Share from vault** and **Stop sharing**. Access log visible to the startup.

### Messages
Secure chat thread with the mentor, attachments, and links to tasks and documents. Shared with the platform inbox at `/startup/messages`.

## F3. States
- **Paused:** banner "Mentorship is paused until {date}."
- **Ended:** read-only record, **Leave a review**, **Export summary** (PDF).
- **Inactive for 30 days:** gentle prompt to book a session or end the mentorship.

---

# Part G. Sessions: `/startup/sessions`

## G1. Layout
Tabs: **Upcoming** · **Past** · **Calendar**. Toolbar: filter by mentor, status; **+ Book session**.

## G2. Upcoming
Cards: date and time (time zone shown), mentor, topic, duration, status chip, **Join** (appears 10 minutes before), **Reschedule**, **Cancel**, **Add to calendar**. Unpaid sessions show a payment status chip.

## G3. Past
Table: date, mentor, topic, duration, notes status, rating given, deliverables created. **View notes**.

## G4. Calendar
Week and month views with sessions as chips (ink) and mentor availability as faint stone blocks.

## G5. Book session (modal or drawer)
1. **Mentor** (prefilled)
2. **Topic and goal** (from the plan or free text), optional agenda items
3. **Time:** pick from available slots (shown in your time zone), duration (30/45/60 minutes)
4. **Attendees:** team members to invite
5. **Prepare:** attach documents to review
6. **Payment:** price summary (session fee, platform commission shown plainly, taxes), pay by saved method or package credit
7. **Confirm** (primary)

## G6. Cancellation rules (shown before confirming)
Free cancellation up to 24 hours before (configurable by mentor); later changes follow the agreed policy. Rescheduling requests notify the mentor with a proposed time.

## G7. States
- **No sessions:** "Book your first session." with **Find a mentor** or **Book session**.
- **Payment failed:** warning chip, **Retry**; the slot is held for 15 minutes.
- **Mentor cancelled:** banner with options to rebook and automatic refund note.

---

# Part H. Session Detail: `/startup/sessions/:sessionId`

## H1. Layout
Left main column (8 col), right panel (4 col).

### Header
Topic, status chip, date and time, duration, mentor, attendees, **Join session** (video opens in the platform's managed video, WebRTC) when within 10 minutes of start.

### Tabs
1. **Agenda:** shared agenda items, editable by both sides before the session.
2. **Notes:** collaborative notes during and after; action items with owners and due dates, with **Create task** for each.
3. **Files:** documents shared for the session.
4. **Recording** (only if both sides consented before starting): private by default, with delete option; otherwise shows "Recording was off."
5. **Feedback:** after the session the startup rates it (1–5 stars) and writes optional feedback; the mentor adds a summary and next steps.

### Right panel
- Session summary: key decisions (editable), next session suggestion with **Book follow-up**.
- Readiness items discussed, with a **Request sign-off** shortcut on items that are ready.
- Payment status and receipt.

## H2. States
- **Before the session:** agenda and prep emphasized; **Reschedule** and **Cancel** visible.
- **During the session:** minimal view with notes and agenda only.
- **After the session:** feedback prompt for 7 days; reminders for open action items.
- **No-show:** record, refund or fee rules per policy, and a **Rebook** option.

---

# Part I. Investment Readiness and Sign-off: `/startup/readiness`

## I1. Purpose
The central checklist that mentors sign off item by item. Links to the stage and dashboard readiness score.

## I2. Layout
Top: large gauge (0–100) and badge status. Below: checklist with detail rows, and a side column with the mentors responsible and the score breakdown.

## I3. Checklist (default items from the proposal)
1. Pitch deck and one-page summary reviewed
2. Business model and unit economics validated
3. Financial projections and use of funds defined
4. Cap table and legal basics in order
5. Traction metrics documented
6. Data room complete

Each row: title, what "done" means (short criteria), evidence (linked files, tasks or analytics views), owner (startup member), reviewing mentor, status chip, last updated, comments thread.

Actions per row: **Add evidence**, **Submit for sign-off** (startup), **Sign off** or **Request changes** (mentor, with a required note).

## I4. Score breakdown
Stacked bar of the three score inputs from the proposal: checklist completion, traction data, mentor feedback. Trend over time. A plain note: "The score is a guide. Sign-offs decide the badge."

## I5. Investment Ready badge
When all items are signed off: gold-tint card with a check, date earned and mentors who signed. Options: **Make profile visible to investors** (links to profile visibility), **Download readiness summary (PDF)**. The badge can be paused if a major item becomes outdated (for example, an expired data room); the page explains why.

## I6. States
- **No mentor assigned:** items can be prepared, but sign-off is locked with "A mentor needs to review this." and **Find a mentor**.
- **Changes requested:** error-tinted chip with the mentor's note and a **Resubmit** action.
- **Multiple mentors:** items can be assigned to different mentors; at least one assigned mentor must sign off each item.

---

# Part J. Payments and Agreements: `/startup/mentors/:mentorshipId/billing`

## J1. Sections
1. **Agreement:** summary of terms (fee model, cadence, duration, advisory or equity share if any), version history, **Propose change**, **Accept**. Equity or advisory shares include the plain reminder: "Review equity terms with a lawyer. The platform records terms but does not give legal advice."
2. **Packages and credits:** purchased session packs, credits remaining, expiry dates, **Buy a package**.
3. **Payments:** table with date, session, amount, platform commission shown to the payer, tax, status (Paid, Pending, Refunded), receipt download.
4. **Payment methods:** saved cards or UPI, default method, billing contact (links to `/startup/billing`).
5. **Disputes:** **Report an issue** on any session payment (reason, details, evidence); status tracker; admin resolves.

## J2. States
- **Free or pro bono mentorship:** payments tab shows "No fees for this mentorship."
- **Outstanding payment:** warning banner on the workspace and sessions pages.
- **Refund issued:** status chip and note on the session.

---

# Part K. Notifications for mentoring

| Event | Who is notified | Channel |
|---|---|---|
| Mentor responds to request | Requester | In-app, email |
| Session booked, changed or cancelled | Both sides | Email, in-app |
| Session starts in 1 hour and 10 minutes | Attendees | In-app, push |
| Deliverable submitted or accepted | Both sides | In-app |
| Sign-off granted or changes requested | Startup owners | In-app, email |
| All items signed off (badge earned) | Startup team | In-app, email |
| Payment receipt or failure | Billing contact | Email |

Users can mute or set digests in Settings.

---

# Part L. Data and validation

| Field | Rule |
|---|---|
| Request goal | Required, 20–500 characters |
| Plan goals | Up to 10 per mentorship; each needs a target date and success measure |
| Session duration | 30, 45 or 60 minutes (mentor may add others) |
| Booking window | At least 12 hours ahead (configurable by mentor) |
| Rating | 1–5 stars; written feedback up to 1,000 characters |
| Files | PDF, DOCX, PPTX, XLSX, up to 25 MB, virus scanned |
| Reviews | Allowed only after a completed session |
| Mentor sign-off | Requires a note when requesting changes |

**Audit log:** request actions, plan changes, sign-offs, file sharing and payments, each with user and time.

---

# Part M. Data connections

| Feature | Connected to |
|---|---|
| Mentor verification and profiles | Admin console, mentor module |
| Matching | Startup profile (industry, stage, needs) |
| Readiness score and badge | Stage module, analytics, investor module visibility |
| Deliverables | Tasks (`/startup/tasks`) |
| Shared files | Document Vault |
| Video sessions | Managed video API |
| Payments, packages, invoices | ERP billing |
| Messages | ERP chat service |
| Mentor impact | Analytics (Journey tab) |

---

# Part N. CSS tokens

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

# Part O. Build order (suggested)

1. Shared components: mentor card, sign-off progress, status chips.
2. **Find Mentors** and **Mentor Profile**, with the request modal.
3. **Mentors Overview** and **Mentorship Requests**.
4. **Mentor Workspace** (plan, deliverables, notes).
5. **Sessions**, booking and **Session Detail** (video and notes).
6. **Investment Readiness and Sign-off** (the core goal of the module).
7. **Payments and Agreements**.
8. Notifications, reviews, auto-match.
9. Empty, loading and error states, then mobile layouts.

**Suggested first release:** items 1–6 with free or manually invoiced sessions; add in-platform payments once mentors are onboarded. Your proposal says to launch with startups and mentors first, so this module comes before the investor pages.
