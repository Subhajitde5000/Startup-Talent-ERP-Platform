# Investor Deal Flow and Discovery Pages Design

The pages where a verified investor finds startups, reviews what the startups chose to share, keeps a shortlist and starts conversations. Startups appear only if their founders opted in, and the mentor-verified **Investment Ready** badge is shown first. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Investor role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user has the `investor` role and a **KYC-verified** investor account. Startup data must be filtered on the server to what each startup has chosen to share with investors. Details are in **Part A9**. Do not show these pages to startups, mentors, job seekers or employers.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Investor Dashboard | `/investor/dashboard` | New matches, replies waiting, meetings, pipeline snapshot, portfolio summary |
| 2 | Discover Startups | `/investor/discover` | Browse opted-in startups with filters; verified startups first |
| 3 | Startup Profile (investor view) | `/investor/startups/:startupId` | Deck, traction, team, readiness, mentors, round; request intro or data room access |
| 4 | Saved Searches and Alerts | `/investor/searches` | Saved filters with alerts for new matching startups |
| 5 | Shortlist | `/investor/shortlist` | Saved startups with notes, tags and next steps |
| 6 | Intro Requests | `/investor/requests` | Intros you sent, intros startups sent you; accept or decline |

Related pages: the startup's side is in `startup-investor-design.md` (Investor Hub, Find Investors, Investor Profile, Pipeline, Data Room, Meetings, Rounds). The investor pages here are the other side of the same shared records. Diligence, pipeline, offers and portfolio pages are a separate group.

---

# Part A. Shared foundations

## A1. Design principles

- **Signal over noise:** the proposal's promise is pre-screened, mentor-vetted deal flow. The best-fit, verified startups lead every list, and each one shows why it fits.
- **Evidence with sources:** every number shows who provided it (startup, mentor-verified, calculated) and when it was last updated.
- **Respect for founders:** startups chose what to share, and contact starts with a respectful, limited intro request. No mass outreach.
- **Neutral tone:** the platform introduces parties. It never recommends an investment, predicts returns or promises outcomes.
- **Calm and efficient:** investors scan many startups. Clear cards, consistent fields and quick actions (Save, Request intro, Pass).

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, Investment Ready accent, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Badges, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, gridlines |
| `--success` | `#2E7D5B` | Verified, accepted, positive change |
| `--warning` | `#B7791F` | Waiting, expiring, caution |
| `--error` | `#B42318` | Declined, errors, negative change |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.
- Page title 28px serif; KPI number 32px serif 600; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Currency in ₹ with Indian grouping by default (for example, ₹50L, ₹2 Cr), configurable.

## A4. Shared layout

Desktop (≥ 1200px): sidebar and top bar, then a 12-column grid with 24px gutters and a max content width of 1280px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar (Home, Discover, Shortlist, Requests, More), filters in a bottom sheet, sticky bottom action button.

### Investor sidebar (ink background, ivory text)
- Logo
- **Dashboard** (active: `--ink-soft` background, 3px gold bar at the left)
- Discover startups
- Shortlist
- Saved searches
- Intro requests (count badge)
- Pipeline
- Data rooms
- Meetings
- Offers
- Portfolio
- Messages
- *Bottom:* Settings, Help, **role switcher** (for multi-role accounts, for example "Investor · Mentor")

## A5. Shared components

### Startup card (investor view)
Logo (48px), startup name, one-liner, stage pill (for example `Stage: Early revenue`), sector chips, location, team size, badges (**Verified startup**, **Investment Ready** in gold-tint with a check), readiness score (small gauge or "72 / 100"), 2–3 headline traction numbers the startup chose to share (for example "MRR ₹4.8L · +12% MoM"), round info ("Raising ₹2 Cr seed · 40% committed"), **Fit** chip with reasons ("Matches your stage, sector and ticket"), and last activity ("Profile updated 3 days ago"). Actions: **View**, **Save**, **Request intro**, overflow (Pass, Hide, Report).

### Source labels
Small chip beside numbers: `Startup-reported`, `Mentor-verified`, `Calculated`, with an "Updated {date}" caption. Mentor-verified items carry a small check in gold.

### Status chips
- **Shortlist:** `New`, `Reviewing`, `Follow up`, `Waiting for startup`.
- **Requests:** `Sent` (stone), `Viewed` (ink outline), `Accepted` (success tint), `Declined` (error tint), `Expired` (stone outline), `Withdrawn` (stone outline), `Received` (gold-tint).
- **Data room:** `Not requested`, `Requested`, `NDA pending`, `Access granted`, `Expired`.

### Platform disclaimer
Small caption with an info icon on deal-related pages: "The platform introduces startups and investors. It is not a broker or adviser unless licensed. Do your own due diligence and take independent advice." Link: **Learn more**.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for notes and drafts, "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner on every page: "Your investor account is under review. You can browse in limited mode, but you can't contact startups or access data rooms until you're verified." with **View status** |
| Verification expired or action needed | Banner with the reason and **Update verification**; contact actions disabled |
| Suspended | Read-only pages with a banner and **Contact support** |
| Offline | Notes keep saving locally; banner "You're offline. Changes will sync." |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms; charts animate once (600ms). Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Every chart has a text summary and a **View as table** toggle.
- Filters, lists and cards are fully keyboard operable; saved and hidden actions announce results.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Privacy, fairness and conduct rules

- Investors see only startups that opted in, and only the fields each startup chose to share. "Not shared" appears in `--stone-400` for anything hidden.
- Contact details stay hidden until the startup replies or accepts an intro.
- Outreach is limited per day and per plan so founders aren't spammed. Founders can block or report an investor.
- Filters never use personal characteristics of founders (age, gender, religion, caste, nationality, marital status). Startup location and sector are fine.
- The platform doesn't rank startups by "likelihood of success" and doesn't predict returns. The **Fit** chip only explains how a startup matches the investor's own criteria.
- Pass reasons and private notes are visible only to the investor's organization, never to the startup (unless the investor chooses to share feedback).
- Views are logged. Startups can see which verified investors viewed them, as described in the startup investor pages.
- Regulatory note: confirm with counsel whether investor eligibility rules apply, such as accredited or qualified investor requirements, and whether the investor module needs registration. Pages avoid wording that promises returns or recommends investments.

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users with the `investor` role can open any `/investor/...` route |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, job seeker, employer users see a 403 page ("This page is for investors") with a link to their own home; no investor data is fetched or rendered |
| **Multi-role users** | A founder or mentor who is also an investor sees the role switcher; switching changes the sidebar and routes between `/startup/...`, `/mentor/...` and `/investor/...` |
| **Investor not yet verified** | Pages open in limited browse mode (A6): profiles are partly masked, and **Request intro**, **Message**, **Request data room access** and bulk actions are disabled |
| **KYC levels** | The server checks the verification level (for example, basic or full) before allowing intros, data room access and offers |
| **Startup data scope** | Startup fields are returned only if the startup opted in and shared them with investors; the server filters by the startup's sharing settings, not only the UI. Blocked and hidden investors never see that startup |
| **Organization access** | For funds and angel groups, members see shared lists and pipeline according to their organization role (Owner, Admin, Analyst, Viewer). Private notes follow the note's visibility setting |
| **Own data only** | Shortlists, saved searches, notes and requests are returned for the signed-in investor or their organization only |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Investor Dashboard: `/investor/dashboard`

## B1. Purpose
The investor's home. It answers: what is new, what needs my reply, what is coming up, and how is my pipeline doing?

## B2. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar: search · notifications · profile     │
│          ├────────────────────────────────────────────────┤
│          │  Greeting + verification status                │
│          ├────────────────────────────────────────────────┤
│          │  KPI row (4 cards)                             │
│          ├───────────────────────────────┬────────────────┤
│          │  New matches for you          │ Needs reply    │
│          │  Pipeline snapshot            │ Upcoming mtgs  │
│          │  Saved search activity        │ Portfolio      │
│          │  Market pulse                 │ Tips           │
└──────────┴───────────────────────────────┴────────────────┘
```

## B3. Sections

### Greeting and status
"Good evening, {Name}". Beside it, a status pill: `Verified investor` (success), `Verification pending` (warning), or `Action needed` (error). Click opens the verification page.

### KPI row
| Card | Example |
|---|---|
| New matches this week | 9 |
| Intro requests awaiting a reply | 3 |
| Meetings this week | 2 |
| Startups in pipeline | 14 |

Each card has a label, a big serif number, a change chip and a small sparkline.

### New matches for you
Up to 6 startup cards (A5) ranked by fit with the investor's saved criteria, with **Investment Ready** startups first. Each shows **Why this fit**. Actions: **View**, **Save**, **Pass**. **View all matches** opens Discover with the criteria applied. Labeled `Suggested` so investors know the source.

### Needs your reply
Prioritized list, each with **Open**:
- Intro requests received from startups
- Startups replying to your messages
- Data room access granted (ready to review) or NDA to sign
- Meeting invitations
- Offers or term sheet responses

Items older than 3 days show a warning chip.

### Pipeline snapshot
A compact funnel: Interested → Talking → Meeting → Data room → Offer → Committed with counts and a link to the full pipeline. A small bar shows your expected commitments vs target, if set.

### Saved search activity
Cards for each saved search with the count of new startups since the last visit ("Pre-seed fintech · 4 new"). **View** opens Discover with that search.

### Market pulse
Short, aggregated and anonymized insights (for example, "Seed-stage health tech startups on the platform: 18, up 20% in 90 days"), each labeled `Platform data` with a date. Link to Market Insights. No predictions.

### Side column
- **Upcoming meetings:** next three with **Join** or **Prepare**.
- **Portfolio summary:** number of platform-funded startups, latest updates, link to Portfolio.
- **Complete your profile:** a short checklist if the investor profile or criteria are incomplete (better criteria give better matches).
- **Tips:** brief guidance ("Add your ticket size so we only show startups raising within your range").

## B4. States
- **New verified investor:** hero card "You're verified. Set your investment criteria to see matched startups." with **Set criteria** and **Browse startups**.
- **Pending verification:** banner (A6); matches appear masked; reply actions disabled.
- **No new matches:** "No new matches. Try broadening your criteria." with **Edit criteria** and **Browse all startups**.
- **All caught up:** "You have no replies waiting."
- **Paused or suspended:** banner and read-only view.

---

# Part C. Discover Startups: `/investor/discover`

## C1. Layout
Filters on the left (300px), results in the center, preview drawer on the right. A top bar with a search field, sort menu, view toggle (Cards or Table) and result count. A saved-search bar above the results: **Save this search**.

## C2. Filters

| Group | Options |
|---|---|
| **Stage** | Idea, Prototype, Early revenue, Mature |
| **Readiness** | Investment Ready only (default on), minimum readiness score slider (0–100), mentor-verified metrics |
| **Sector and industry** | Multi-select with search |
| **Location** | Country, state or city, remote-first |
| **Funding** | Round type, raise amount range, minimum ticket, percent committed, instrument (equity, SAFE, convertible note) |
| **Traction** | MRR range, growth rate range, customer count range, only shown when the startup shared them |
| **Team** | Team size range, founders count, "Has a mentor" |
| **Activity** | Recently updated, new on platform, in the last 30 days |
| **Status** | Hide ones I've already seen, saved or passed |

Not offered: personal characteristics of founders (age, gender, religion, caste, nationality, marital status). Filters that rely on startup-reported numbers show a note: "Only startups that shared this number are included."

## C3. Results

- **Sort:** Best fit (default), Investment Ready first, Recently updated, Newest, Highest readiness, Raise size.
- **Order rule:** mentor-verified (Investment Ready) startups appear first, then others, as your proposal specifies. A small divider labels each group ("Investment Ready · 12", "Other opted-in startups · 40").
- **Card view:** startup cards (A5) in a grid (2 across on desktop). **Table view:** columns for name, stage, sector, readiness, MRR, growth, raise, committed, location, last updated, actions.
- Bulk select: **Save to shortlist**, **Add to compare** (up to 4), **Pass**.
- **Why this fit** expander on each card lists which of the investor's saved criteria matched, in plain words.

## C4. Preview drawer (520px)
Opens on card click. Contains a compact version of the startup profile: pitch summary, three traction highlights with source labels, readiness gauge, team count, mentor count, round info, and **View full profile**, **Save**, **Request intro**, **Pass**. Arrow keys move to the next or previous startup in the list.

## C5. Quick actions on a card
- **Save:** adds to the default shortlist (or choose a list).
- **Request intro:** opens the intro modal (Part G).
- **Pass:** removes the startup from future matches. Optional reason chips (Out of scope, Too early, Too late, Terms, Not a fit, Other) and a private note. A **Undo** toast appears for 8 seconds.
- **Hide:** hide without a reason.
- **Report:** misleading information or policy concern (opens a report form).

## C6. States
- **Not verified:** results visible but contact details and some numbers are masked; **Request intro** disabled with the reason.
- **No results:** suggestions to widen filters ("Remove one sector").
- **Many results (500+):** prompt to narrow with an example ("Add a stage or sector").
- **Search failed:** inline **Retry** with the filters kept.
- **Seen before:** a small "Viewed 3 Nov" label and a "Changes since you viewed" chip if the startup updated metrics or documents.
- **Startup hid its profile:** card removed from the list; saved ones show "No longer available."

---

# Part D. Startup Profile (investor view): `/investor/startups/:startupId`

## D1. Purpose
The startup as an investor sees it: the information the startup chose to share, with clear sources, and the actions to continue (save, request intro, ask for data room access).

## D2. Layout
Left main column (8 col), right sticky panel (4 col). A banner at the top: "Showing what {Startup} has chosen to share with investors. Updated {date}." Tabs under the header for a long page: **Overview** · **Traction** · **Team** · **Round** · **Mentors and readiness** · **Documents** · **Updates**.

### Header
Cover band (solid ink with a thin gold rule), logo, name, tagline, stage pill, badges (**Verified startup**, **Investment Ready** with the date earned), sector chips, location, founded year, team size, website link. A "Viewed {date}" label for returning visits and a "New since your last visit" chip when the startup updated something.

## D3. Tabs

### Overview
1. **Pitch summary:** one-liner and summary.
2. **Problem, solution, market:** three blocks with supporting numbers and sources (TAM/SAM/SOM, if shared).
3. **Traction highlights:** up to 4 tiles (MRR, customers, growth, pilots), each with a source label and last-updated date; trend sparkline.
4. **Business model:** how they make money, pricing, main segments.
5. **Competitors and positioning** (if shared): short list and a one-line positioning statement.

### Traction
Charts the startup chose to share: MRR over time, customers over time, retention or churn, unit economics (CAC, LTV, payback), runway (only if shared). Every chart has a source label, a "View as table" toggle and a definition tooltip. Missing metrics show "Not shared."

### Team
Founders first, then key members: avatar, name, role, short bio, LinkedIn. Contact details hidden. Team stats: size, hiring status ("Hiring 2 roles"). Optional advisors and mentors list.

### Round
- Round type, target raise, minimum ticket, instrument and terms summary, valuation or cap (if shared), committed so far (progress bar in gold), closing target date, use of funds (stacked bar), lead investor (if named).
- Visible only if the startup chose to share round details. Otherwise: "Round details are shared after an intro."

### Mentors and readiness
- **Investment Ready** badge with date and the mentors who signed off, each with **Verified mentor** pill and a link to their public impact profile.
- Readiness score (0 to 100) with its three inputs (checklist completion, traction data, mentor feedback), and the six checklist items with signed-off status. Caption: "A guide, not a recommendation."
- Mentor endorsements (short quotes, only if the mentor and startup agreed to publish).

### Documents
List of documents the startup made available:
- `Public to approved investors` (view-only preview, for example the one-page summary and pitch deck)
- `Data room` (locked until access and NDA): folder structure with counts and a **Request data room access** button.
- Watermark note: "Documents are watermarked with your name and logged."

### Updates
Timeline of what the startup updated (stage change, new traction, new mentor, round change, badge earned), with dates. **Follow** lets the investor get alerts on this startup's updates.

## D4. Right sticky panel

- **Fit summary:** how this startup matches your criteria (matched and unmatched items), plain language only, labeled `Based on your criteria`.
- **Primary actions:** **Request intro** (primary), **Save to shortlist**, **Request data room access**.
- **Status:** your relationship with the startup (`Not contacted`, `Intro sent`, `In talks`, `Data room access granted`, `Passed`), with a pipeline stage dropdown.
- **Private notes:** a note area that only you (and your organization) can see.
- **Quick facts:** stage, sector, location, readiness, raise, team size.
- **Overflow:** **Add to compare**, **Pass**, **Hide**, **Report**, **Share with my team** (organization members).
- **Disclaimer** (A5).

## D5. Request data room access (modal)
- Scope requested (which folders, optional), reason for access (up to 300 characters), confirmation that you will sign the confidentiality agreement.
- The startup decides. Access appears under Data Rooms once granted; the NDA must be signed before opening documents (separate page).

## D6. States
- **Limited sharing:** many "Not shared" labels with a gentle banner: "{Startup} shares more after an intro."
- **Not verified:** profile partly masked; actions disabled with the banner (A6).
- **Startup paused visibility:** "This startup has paused investor visibility." Read-only snapshot of what you already had access to, if allowed.
- **You were blocked by the startup:** the page returns 404 (the startup does not appear to you).
- **Stale data:** chip when metrics are older than 35 days: "Last updated 42 days ago."
- **Round closed:** banner "This round has closed." with **Follow for the next round**.
- **Loading error:** per-section error cards with **Retry**; other sections remain usable.

---

# Part E. Saved Searches and Alerts: `/investor/searches`

## E1. Purpose
Turn filters into saved searches and get alerts when new startups match, so deal flow comes to the investor.

## E2. Layout
Header with title, **+ New saved search** (opens Discover with the filter panel), and a summary strip: saved searches count, alerts on, new matches since last visit.

## E3. Saved search list
Cards or table rows:
- Name (editable, for example "Pre-seed fintech, India")
- Criteria summary as chips (stage, sector, location, ticket, readiness)
- New matches count since last visit (gold chip) and total matches
- Alert settings summary ("Daily email · In-app")
- Last run time
- Actions: **View results**, **Edit**, **Pause alerts**, **Duplicate**, **Delete**, **Share with team** (organization)

## E4. Create or edit saved search (drawer)
1. **Name**
2. **Criteria:** same filters as Discover with a live result count ("42 startups match").
3. **Include only:** Investment Ready startups (default on), startups with shared traction numbers (optional).
4. **Alerts:**
   - Channels: In-app, Email, Push
   - Frequency: Instant, Daily digest, Weekly digest
   - Trigger: New matching startup, Match updated significantly (new Investment Ready badge, new round opened), Both
   - Quiet hours (from Settings)
5. **Save** (primary) and **Save and view results**.

Limits: a number of saved searches per plan (for example, 5 on a basic plan). The page shows the count and an upgrade link when full.

## E5. Alerts view (tab)
A chronological list of alerts across all saved searches: "{Startup} matches 'Pre-seed fintech'". Each row: startup mini-card, which search matched, reason, time, **View**, **Save**, **Pass**, **Mute this search**. Alerts are grouped per day and per search.

## E6. Recommendation settings (tab)
Link to the investor's **Investment Preferences** page. The page shows which preferences feed the Dashboard matches and notes that matches are suggestions, not recommendations to invest.

## E7. States
- **No saved searches:** "Save a search to get alerts when startups match." with **Create saved search** and an example list of suggested criteria.
- **No new matches:** "No new matches since {date}."
- **Alerts paused:** chip on the card and **Resume**.
- **Limit reached:** message with plan upgrade link; existing searches continue.
- **Too broad:** warning "This search matches 300+ startups. Narrow it to get useful alerts."
- **Not verified:** searches can be created; alerts start after verification.

---

# Part F. Shortlist: `/investor/shortlist`

## F1. Purpose
The investor's working list of startups of interest, with notes, tags, next steps and status. It sits between discovery and the full pipeline.

## F2. Layout
Header with title and **+ New list**. Left: list menu (All shortlisted, then named lists such as "Seed 2026", "Fintech", "Follow up"). Center: items as cards or table. Right: preview drawer. A summary strip: total shortlisted, follow-ups due this week, new updates since last visit.

## F3. Toolbar
Search, filters (list, stage, sector, status, tags, owner for organizations, updates since last visit), sort (Recently added, Best fit, Follow-up date, Name), view toggle (Cards or Table).

## F4. Shortlist item (card)
Startup card summary (A5), plus:
- **Status chip:** `New`, `Reviewing`, `Follow up`, `Waiting for startup`
- **Tags** (chips, editable)
- **Private note** preview (first line)
- **Next step** and due date ("Ask for cap table · Fri")
- **Owner** (for organizations)
- **Update badge:** "3 updates since you saved" (clickable; opens the startup's Updates tab)
- Actions: **View**, **Request intro**, **Move to pipeline**, **Add to compare**, overflow (Move to list, Remove, Pass, Share with team)

## F5. Table view
Columns: startup, stage, sector, readiness, MRR, growth, raise and committed, status, tags, next step and date, owner, updated, actions. Inline editing for status, tags and next step. CSV export (own data only).

## F6. Bulk actions
Select multiple: **Add tag**, **Change status**, **Move to list**, **Add to compare** (up to 4), **Request intros** (limited by the daily cap; each intro still needs an individual message), **Remove**.

## F7. Preview drawer
Shows the startup summary, your private notes (editable), your tags, activity log for this startup (saved, viewed, messages), reminders, and quick actions. Notes autosave. Notes can be marked **Private to me** or **Visible to my organization**.

## F8. Lists and sharing
- Create, rename, reorder and delete lists. A startup can be on several lists.
- **Share with my team** (organizations): choose members or all; set view or edit access.
- A default list, "Shortlist", is created automatically.

## F9. Reminders
Set a follow-up date and note on any item. Reminders appear on the Dashboard, in notifications and in the daily digest, and overdue ones show a warning chip.

## F10. States
- **Empty:** "Your shortlist is empty. Save startups from Discover to track them here." with **Discover startups**.
- **Startup updated:** gold dot and "Updated" chip.
- **Startup closed its round or hid its profile:** card shows "Round closed" or "No longer visible" with the saved notes kept.
- **Over 14 days with no action:** soft prompt "Still interested? Request an intro, move to your pipeline, or remove it."
- **Limit reached:** shortlist size limits per plan with an upgrade link.
- **Not verified:** shortlist works; **Request intro** and pipeline actions are disabled.

---

# Part G. Intro Requests: `/investor/requests`

## G1. Purpose
The place for every introduction between the investor and a startup, in both directions. An intro is the polite first step before messages and the data room.

## G2. Layout
Tabs: **Received** (startups asking to be introduced to you) · **Sent** · **Accepted** · **Declined and expired**. A count badge on **Received**. Toolbar: search, filters (stage, sector, status, date), sort (Newest, Waiting longest, Best fit).

## G3. Received
Rows or cards: startup card (A5), date received, the startup's message (first lines), what the startup is asking for (intro call, feedback, data room access), `Received` chip and waiting time (warning chip after 3 days). Actions: **View request**, **Accept**, **Decline**, **Ask a question**.

## G4. Sent
Rows or cards: startup, date sent, your message (preview), status chip (`Sent`, `Viewed`, `Accepted`, `Declined`, `Expired`), expiry countdown (requests expire after 14 days), actions (**View**, **Withdraw**, **Follow up** once after 7 days).

## G5. Request detail drawer (560px)
1. **Startup summary:** profile snapshot (shared fields only), readiness, badges, round info, **View full profile**.
2. **The message:** the startup's or your intro text, timestamps, and the activity log (viewed, opened).
3. **What is shared with this request:** the profile sections the startup chose to include.
4. **Your response** (for received requests):
   - **Accept:** opens a short confirmation; optionally write a welcome message, propose meeting times, or grant data room access later. Accepting opens the conversation in Messages and adds the startup to the pipeline as **Talking**.
   - **Decline:** reason chips (Out of scope, Stage mismatch, Sector, Ticket size, Timing, Other), optional message, and a toggle "Share my reason with the startup" (default off). Offers to **Pass** so the startup disappears from your matches.
   - **Ask a question:** one-line thread before deciding.
5. **Conflict check:** "I have no conflict of interest" checkbox with a note field if unchecked.

## G6. Send an intro request (modal, from Discover, a profile or Shortlist)
- **To:** startup name and logo.
- **Message** (required, 50–500 characters), with a suggested outline: who you are and what you invest in, why this startup, what you would like next. Links to external payment pages and off-platform contact details are blocked.
- **What you would like:** Intro call, Review the deck, Request data room access (checkboxes).
- **What the startup sees about you:** a preview of your investor profile and verification badge, with a link to adjust visibility.
- **Daily limit counter:** "5 intro requests left today," based on plan, to keep outreach respectful.
- **Send request** (primary). The startup decides whether to accept.

## G7. After acceptance
A confirmation card: "{Startup} accepted your request." with **Message**, **Schedule meeting**, **Request data room access**, **Open pipeline**. A system event appears in Messages ("Intro accepted"). Contact details are shared only if the startup chooses to share them.

## G8. States
- **No requests:** "No intro requests yet. Request an intro from a startup profile or your shortlist." with **Discover startups**.
- **Received request waiting over 3 days:** warning chip and a reminder in notifications; after 14 days the request expires and the startup is told politely.
- **Limit reached:** message with the reset time and plan upgrade link.
- **Startup not accepting new investors:** **Request intro** disabled with "Not taking new introductions right now" and **Follow** for updates.
- **Blocked by the startup:** the startup no longer appears to you.
- **Withdrawn by the startup:** chip and note; no further action needed.
- **Not verified:** sending and accepting disabled; the banner explains the next step.

---

# Part H. Notifications for these pages

| Event | Channel |
|---|---|
| New suggested matches for your criteria | In-app, daily digest |
| Saved search alert (new matching startup) | In-app, email, push (per alert settings) |
| A shortlisted startup updated (new traction, badge earned, round opened or closed) | In-app, email |
| Intro request received | In-app, email, push |
| Intro request waiting over 3 days | In-app |
| Intro accepted, declined or expired | In-app, email |
| Follow-up reminder due | In-app, email |
| Verification status changed | In-app, email |
| Daily or weekly deal flow digest | Email |

Investors can mute, filter or set digests in Settings. Security alerts cannot be muted.

---

# Part I. Data and validation

| Field | Rule |
|---|---|
| Saved search name | Required, 3–60 characters, unique per investor |
| Saved searches | Limit per plan |
| Intro message | Required, 50–500 characters; no external payment links or off-platform contact details |
| Intro requests per day | Limit per plan; one active request per startup |
| Intro expiry | 14 days if unanswered |
| Decline reason | Required for received requests; optional message |
| Pass reason | Optional chips and note |
| Shortlist note | Up to 5,000 characters; visibility: private or organization |
| Tags | Up to 10 per startup; 30 characters each |
| Compare | Up to 4 startups |
| Data room access request reason | Up to 300 characters |
| Exports | Only the investor's own data and fields visible to them |

**Audit log:** profile views, shortlist changes, intro requests and responses, data room access requests, passes, hides, reports and exports, each with user and time. Startups can see which verified investors viewed them, according to their own settings.

---

# Part J. Data connections

| Feature | Connected to |
|---|---|
| Investor verification, KYC level | Admin console, investor application and verification |
| Investor criteria and matching | Investment Preferences, startup profile (stage, sector, raise) |
| Startup profile and sharing settings | Startup profile and visibility (`/startup/profile`, `/startup/investors/settings`) |
| Readiness score, Investment Ready badge, mentors | Readiness module (`/startup/readiness`), mentor profiles |
| Traction numbers | Startup analytics (shared fields only) |
| Round information | Fundraising rounds (`/startup/rounds`) |
| Intro requests | Startup's Intro and Pipeline pages (`/startup/investors`) |
| Data room access | Data Room (`/startup/data-room`) |
| Messages and meetings | ERP chat service, Meetings |
| Alerts and digests | ERP notification service |
| Organization lists and sharing | Investor team and organization |
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

  /* chart palette */
  --chart-1: var(--ink);
  --chart-2: var(--gold);
  --chart-3: var(--stone-400);
}
```

---

# Part L. Build order (suggested)

1. Role guard, KYC checks and investor shell (Part A9), including the verification banner and limited browse mode.
2. Shared components: startup card, source labels, status chips, disclaimer.
3. **Discover Startups** with filters, the verified-first ordering and the preview drawer.
4. **Startup Profile (investor view)** with server-side filtering of shared fields.
5. **Intro Requests**, including the send-intro modal and accept or decline flow.
6. **Shortlist** with notes, tags and reminders.
7. **Investor Dashboard** once matches, requests and shortlists exist.
8. **Saved Searches and Alerts** and the alert pipeline.
9. Notifications, organization sharing, compare, exports.
10. Empty, loading and error states, then mobile layouts.

**Suggested first release:** Discover, Startup Profile, Intro Requests and Shortlist. Add the Dashboard, Saved Searches and organization features after the first anchor investors are onboarded. Your proposal flags the chicken-and-egg risk, so launching these pages with a small set of verified anchor investors and enough Investment Ready startups matters more than breadth.

**Reminder for the build:** every route above is investor-only and role-based. Add the guard and KYC checks first, filter all startup data on the server by what each startup shared, enforce outreach limits, and write views, requests and exports to the audit log. Get legal advice on investor eligibility rules and whether the investor module needs registration before launch.
