# Investor Pages Design: `/startup/investors` and related pages

The startup's side of the Investor module. Once a startup is investment ready, it controls what investors can see, finds and talks to verified investors directly, shares its data room under confidentiality, meets investors, and tracks its funding round through to a closed deal. It uses the same visual language as the other pages: ink, ivory, one gold accent.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Investor Hub | `/startup/investors` | Overview of interest, pipeline and next actions |
| 2 | Find Investors | `/startup/investors/discover` | Browse verified investors who match the startup |
| 3 | Investor Profile | `/startup/investors/:investorId` | One investor's profile, activity on your startup, conversation |
| 4 | Investor Pipeline | `/startup/investors/pipeline` | Track each investor from interested to committed |
| 5 | Data Room | `/startup/data-room` | Organize documents, set access, NDAs, audit trail |
| 6 | Access Requests | `/startup/data-room/requests` | Review who wants in and on what terms |
| 7 | Messages | `/startup/messages` | Direct messages with investors (shared inbox with other roles) |
| 8 | Meetings | `/startup/meetings` | Scheduler and calendar for investor meetings |
| 9 | Fundraising Rounds | `/startup/rounds` | Round setup, offers, term sheets, commitments |
| 10 | Round Detail | `/startup/rounds/:roundId` | Offers, commitments, cap table impact, closing |
| 11 | Investor Visibility Settings | `/startup/investors/settings` | Who can see the startup and what they can see |

---

# Part A. Shared foundations

## A1. Design principles

- **Founder in control:** nothing is visible to investors unless the founders choose it. Visibility and sharing controls are one click away on every investor page.
- **Direct and respectful:** startups and investors talk without intermediaries. Founders respond on their own terms.
- **Evidence over hype:** the mentor-verified badge and readiness score lead, and numbers show their source.
- **Confidential by default:** data room access requires a confidentiality agreement and leaves an audit trail.
- **Honest about the platform's role:** the platform introduces parties. It is not a broker or adviser unless licensed. This disclaimer is visible where deals are discussed.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, committed status |
| `--ink-soft` | `#1C2B42` | Hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, shortlisted, progress fill, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlights, badges, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Verified, signed, committed |
| `--warning` | `#B7791F` | Awaiting response, expiring |
| `--error` | `#B42318` | Declined, errors, revoked |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Currency in ₹ with Indian grouping by default (for example, ₹50L, ₹2 Cr), configurable.

## A4. Shared layout

Desktop (≥ 1200px): same sidebar and top bar as other pages. The **Investors** nav item expands to: Hub, Find investors, Pipeline, Data room, Meetings, Rounds. 12-column grid, 24px gutters, max content width 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below. Mobile: single column; the pipeline shows one stage at a time.

## A5. Shared components

### Investor card
Avatar or firm logo, name, firm and type (Angel, Angel group, Fund), **Verified investor** pill (gold-tint with check, KYC completed), focus (stages, sectors), ticket size range, location, recent activity ("Viewed your profile 2 days ago"), **Fit** chip with reasons ("Invests in pre-seed health tech"). Actions: **View profile**, **Request intro**, **Save**.

### Investor status chips
`Viewed` (stone), `Shortlisted` (gold-tint), `Intro requested` (warning tint), `In talks` (ink outline), `Data room access` (ink outline with lock), `Offer received` (success tint), `Committed` (ink fill), `Passed` (stone, with reason), `Declined by you` (error tint).

### Visibility banner
A slim banner shown on investor pages when the startup is not visible: "Your profile is private. Investors can't find you." with **Change visibility**. When visible: "Visible to verified investors" with a small gold dot and **Manage**.

### Platform disclaimer
Small caption with an info icon on deal-related pages: "The platform introduces startups and investors. It is not a broker or adviser unless licensed. Get your own legal and financial advice." Link: **Learn more**.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for notes and drafts with "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| No permission | Controls hidden or disabled with tooltip: "Ask an Owner or Admin." |
| Not investment ready | Investor pages open in a "prepare" mode (see Part B4); discovery and sharing are locked until readiness is met or the founders choose to proceed |

## A7. Role-based access

| Role | Can do |
|---|---|
| **Owner** | Everything, including visibility, data room permissions, rounds, term sheets, cap table updates |
| **Admin** | Manage conversations, meetings, pipeline, and data room files; cannot change round terms or accept offers |
| **Member** | View the pipeline summary; join meetings they are invited to |
| **Viewer** | No access to investor identity or messages; sees only aggregate counts |
| **Mentor** | Optional read-only access to the pipeline stage counts and data room checklist to help with preparation; no investor messages |

## A8. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Pipeline drag and drop has a keyboard alternative (**Move to…**); moves announced to screen readers.
- Currency and numbers have clear labels; charts have a "View as table" toggle.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A9. Security, privacy and compliance rules (all investor pages)

- Investors are KYC-verified before they appear. The startup sees the verification level.
- Data room: confidentiality agreement signed before any document is opened; view-only by default; watermarking with the viewer's name and time; downloads off unless the founder allows them; all views and downloads logged.
- Contact details stay hidden until the founder replies or accepts an intro.
- The startup can block, report or hide any investor at any time.
- Securities rules: confirm with counsel whether the investor module needs registration. Pages avoid wording that promises returns or recommends investments, and show the platform disclaimer.
- Messages and documents are encrypted in transit and at rest.
- Data handling follows the platform's privacy policy and applicable law (for example, India's DPDP Act).

---

# Part B. Investor Hub: `/startup/investors`

## B1. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Investors"      [Find investors]       │
│          ├────────────────────────────────────────────────┤
│          │  Visibility banner                             │
│          ├────────────────────────────────────────────────┤
│          │  Summary strip (5 stats)                       │
│          ├───────────────────────────────┬────────────────┤
│          │  Needs your reply             │ Round snapshot │
│          │  Interested investors         │ Upcoming mtgs  │
│          │  Interest trend (chart)       │ Readiness      │
└──────────┴───────────────────────────────┴────────────────┘
```

## B2. Summary strip
| Stat | Example |
|---|---|
| Profile views (30 days) | 46 |
| Shortlisted by | 7 |
| Conversations | 5 |
| Meetings this month | 3 |
| Data room visitors | 4 |

## B3. Sections

### Needs your reply
Prioritized list: new messages, intro requests, access requests, meeting invitations, offers awaiting a response. Each row: investor, request type, time waiting, **Open**. Items older than 3 days show a warning chip.

### Interested investors
Cards or rows (A5) for investors who viewed, shortlisted or contacted the startup, sorted by latest activity. Filters: status, type, stage focus. Investors only appear if they opted to be visible to startups.

### Interest trend
Line chart of views and shortlists over time (ink and gold), with annotations for events such as "Investment Ready badge earned" and "Data room opened."

### Side column
- **Round snapshot:** target raise, committed so far (gold progress bar), investors in talks, closing target date. Link to `/startup/rounds`.
- **Upcoming meetings:** next three with **Join** or **Prepare**.
- **Readiness:** investment-ready status and any outdated items that could hurt investor confidence, for example "Financial projections last updated 5 months ago."

## B4. Prepare mode (not yet investment ready or profile private)
Replaces the main content with a checklist card:
1. Earn the **Investment Ready** badge (progress from `/startup/readiness`)
2. Complete the public profile (progress from `/startup/profile`)
3. Complete the data room (progress from `/startup/data-room`)
4. Choose visibility (Mentors only, or Mentors and investors)

Primary button: **Continue preparing**. Secondary: **Show me anyway**, which opens the hub read-only so founders can look around but cannot contact investors until the steps are done (or an Owner confirms they want to proceed).

## B5. States
- **No investor activity yet:** "No views yet. Make sure your profile is visible and your pitch summary is complete." with **Manage visibility** and **Improve profile**.
- **Investor passed:** card moves to Past with their stated reason (if shared).
- **Blocked or reported investor:** removed from lists; visible in Settings under Blocked.

---

# Part C. Find Investors: `/startup/investors/discover`

## C1. Layout
Filters on the left (280px), results in the center, preview drawer on the right.

## C2. Filters
Investor type (angel, angel group, fund), stage focus, sector focus, ticket size range, location or region, "Active recently," "Has invested in similar startups," "Verified only" (always on). Sort: Best fit, Recently active, Ticket size.

Not offered: age, gender, religion, caste, nationality of individuals.

## C3. Results
Investor cards (A5) with a **Why this fit** expander: matched criteria (stage, sector, ticket) in plain words. A **Recommended** row at the top (up to 5) uses the startup's stage, sector, raise size and readiness score.

Actions: **Request intro**, **Save**, **Hide**.

## C4. Request intro (modal)
- Short message (required, up to 500 characters) with a suggested outline: what you do, traction, what you are raising, why this investor.
- What the investor can see: toggles for profile, traction numbers, deck (view-only), with the default set from visibility settings.
- Optional: attach one-page summary from the vault.
- Daily limit counter ("You have 5 intro requests left today") to keep outreach respectful and limit spam.
- **Send request** (primary). The investor decides whether to accept, so there is no auto-sharing of the data room.

## C5. States
- **Not investment ready:** discovery is browse-only and **Request intro** is disabled with an explanation and a link to readiness.
- **No results:** suggestions to widen filters.
- **Limit reached:** message with reset time.
- **Investor not accepting new startups:** disabled button with explanation.

---

# Part D. Investor Profile: `/startup/investors/:investorId`

## D1. Layout
Left main column (8 col), right sticky panel (4 col).

### Header
Avatar or logo, name, firm, **Verified investor** pill with verification level, location, type, focus chips (stages, sectors), ticket range.

### Main sections
1. **About:** investment thesis and what they look for, in the investor's words.
2. **Portfolio and track record:** companies invested in (names shown only if the investor allows), number of deals, typical stage, any follow-on activity. Items are labeled "Self-reported" or "Verified."
3. **Activity on your startup:** timeline of what they viewed (profile, deck, data room folders), shortlisted, messaged. Only items the founder's settings allow the investor to have accessed.
4. **Conversation:** embedded thread (messages, shared links, meetings) with a composer. Opens the full Messages page for long threads.
5. **Notes (private):** the startup's own notes about this investor; never visible to the investor.

### Right sticky panel
- Status chip and pipeline stage with a dropdown to change it.
- **Message**, **Schedule meeting**, **Grant data room access**, **Mark as passed**.
- Access summary: what this investor can see and a **Manage access** link.
- Next step reminder: date and note.
- **Block** and **Report** in the overflow menu.

## D2. States
- **Intro requested, awaiting reply:** panel shows "Waiting for response" with the date; **Withdraw** option.
- **Investor passed:** banner with the reason (if provided), and an option to ask for feedback (optional for the investor).
- **Access revoked:** banner showing when and by whom.

---

# Part E. Investor Pipeline: `/startup/investors/pipeline`

## E1. Views
Board (default on desktop), Table, and Funnel summary. Toolbar: search, filters (status, owner, last activity, ticket size, type), **+ Add investor** (record an investor met outside the platform; such records are private and flagged "Manual entry").

## E2. Board
Columns: **Interested** → **Intro / Talking** → **Meeting held** → **Data room** → **Offer** → **Committed**, plus a collapsible **Passed / Declined** column.

Cards: investor name and firm, ticket range, status chip, last activity, owner (team member), next step date, small icons (notes, meeting, data room, messages). Drag to move; moving to **Data room** prompts access settings; moving to **Offer** prompts linking to a round and entering the amount; moving to **Passed** asks for an optional reason. Keyboard alternative via **Move to…**.

## E3. Table
Columns: investor, status, last activity, owner, ticket, expected amount, next step, probability (founder-entered), notes preview. CSV export (Owners and Admins).

## E4. Funnel summary
Funnel: Interested → Talking → Meeting → Data room → Offer → Committed with counts, conversion percentages and average days at each stage. A small expected-raise bar: committed (ink), probable (gold), possible (stone-400), against the target.

## E5. States
- **Empty:** "Your pipeline will fill as investors show interest. You can also add investors you've met." with **+ Add investor**.
- **Stale investors:** cards with no activity for 14 days show a warning chip and **Follow up** suggestion.

---

# Part F. Data Room: `/startup/data-room`

## F1. Layout
Left: folder tree (Corporate, Financials, Legal, Product, Team, Customers, Pitch). Center: file list. Right: details and access panel.

### Top bar
Completeness meter (gold fill) tied to the readiness checklist, **Upload**, **New folder**, **Preview as investor**, **Settings** (watermark, download policy, NDA template).

## F2. File list
Columns: name, type icon, size, updated, uploaded by, **access level** chip (`Public to approved investors`, `Per investor`, `Private`), views count. Row actions: Preview, Replace (keeps version history), Change access, Rename, Delete (admin).

- Checklist overlay: expected documents appear as dashed placeholders ("Cap table: missing") that link to upload.
- Version history per file with restore.
- Virus scan status on upload.

## F3. Access panel
- **Investors with access:** list with name, firm, access scope (folders), NDA status (Signed, Pending), last viewed, **Edit**, **Revoke**.
- **Default access:** which folders are visible to any approved investor.
- **NDA:** template selection or upload of the startup's own; shows who signed and when; investors cannot open files until signed.
- **Download policy:** View only (default), Allow download for specific investors, Watermark on or off (recommended on).
- **Expiry:** optional access expiry date per investor.

## F4. Audit trail tab
Table: investor, document, action (viewed, downloaded, printed attempt), time, duration, IP region. Filters by investor, folder, date. Export for the Owner. Summary chart: views by document (top 5) to show what investors care about.

## F5. States
- **Empty:** the checklist placeholders with **Upload** actions and a short guide ("Start with your pitch deck and cap table").
- **Upload error or blocked file:** message with the reason (type, size, virus scan).
- **Revoked:** access removed immediately, and the investor sees "Access ended."
- **Incomplete data room:** a warning chip on the hub and readiness pages: "3 items missing."

---

# Part G. Access Requests: `/startup/data-room/requests`

## G1. Layout
Tabs: **Pending** · **Approved** · **Declined**. Rows: investor (card summary with verification), requested scope, message, date, NDA status.

## G2. Review drawer
- Investor summary and Fit chip, their message and reason for access.
- **Approve with scope:** choose folders, download policy, expiry. If an NDA is required, it is sent automatically.
- **Decline** (optional message) or **Ask a question**.
- Recent activity of this investor on your startup.

## G3. States
- **Auto-approval rules** (optional): approve verified investors from your shortlist for the Pitch folder only.
- **Pending over 3 days:** reminder; investors see "Waiting for the founder to respond."

---

# Part H. Messages: `/startup/messages` (investor view)

Shared with other roles. For investor conversations:

- Left: conversation list with filters (Investors, Mentors, Candidates, Unread), search, investor name and status chip.
- Center: thread with messages, shared files (from the vault), meeting invites, and system events ("Investor signed the NDA", "Data room access granted").
- Right: investor mini profile, status dropdown, quick actions (**Schedule meeting**, **Share file**, **Grant access**, **Mark as passed**).

Composer: rich text, attachments from the vault or upload, templates ("Thanks for your interest", "Share deck"), and a note "Messages are secure and logged for audit."

Rules: no off-platform payment or investment solicitation in messages (flagged to moderation); investors can see only message content, never your private notes.

**States:** unread counters, typing indicators, failed send with **Retry**, blocked sender message, and a daily limit notice for cold outreach.

---

# Part I. Meetings: `/startup/meetings`

## I1. Layout
Tabs: **Upcoming** · **Requests** · **Past** · **Calendar**. **+ Schedule meeting**.

## I2. Upcoming
Cards: date and time (time zone shown, default Asia/Kolkata), investor, type (Intro call, Pitch, Diligence, Follow-up), duration, attendees, status (`Scheduled`, `Confirmed`, `Reschedule requested`, `Cancelled`), **Join** (appears 10 minutes before; platform video), **Reschedule**, **Add to calendar**, **Prepare** (agenda and materials).

## I3. Requests
Incoming meeting requests from investors with their proposed times and agenda. **Accept**, **Propose another time**, **Decline**. Founders can set availability windows and a daily cap so meeting requests stay manageable.

## I4. Schedule meeting (modal)
- Investor (prefilled), meeting type
- Pick from your availability or send a scheduling link
- Attendees (team members), duration (15/30/45/60)
- Agenda and materials to attach (view-only links from the vault)
- Message
- **Send invite** (primary)

## I5. Meeting detail
Agenda, attendees, shared materials, notes (private to the startup by default, with an option to share a summary), action items (**Create task**), follow-up template, and **Update pipeline stage** shortcut. Recording only with both sides' consent and off by default.

## I6. Past
Table: date, investor, type, outcome (Positive, Neutral, Not a fit, set by the founder), next step, notes link.

## I7. States
- **No meetings:** "No meetings yet." with **Set availability**.
- **Time clash:** warning when two meetings overlap.
- **Investor no-show:** record and offer to reschedule.

---

# Part J. Fundraising Rounds: `/startup/rounds`

## J1. Layout
List of rounds with a status chip: `Planning`, `Open`, `Closing`, `Closed`, `Cancelled`. **+ New round**. Summary cards for the active round: target, committed, remaining, investors count, days open.

## J2. Create or edit round (drawer or page)
- Round name and type (Pre-seed, Seed, Series A, Bridge, Other)
- Target raise, minimum raise to close, maximum raise (optional)
- Instrument (Equity, SAFE, Convertible note, Other), valuation or cap and discount terms
- Minimum ticket, expected closing date
- Use of funds (percent split by category, linked to the profile)
- Round visibility (Visible on profile, or private)
- Lead investor (optional)

A note: "Terms and instruments have legal consequences. Review them with a lawyer."

## J3. States
- **First round:** guide card with steps (set target, prepare data room, reach investors, record offers, close).
- **No active round:** summary replaced by **Start a round**; the profile shows "Not currently raising."

---

# Part K. Round Detail: `/startup/rounds/:roundId`

## K1. Header
Round name, status chip, target and committed progress bar (gold on stone-200), closing date, **Edit round**, **Close round**, **Export summary**. Tabs: **Overview** · **Offers and commitments** · **Term sheets** · **Cap table impact** · **Documents** · **Activity**.

## K2. Overview
Key numbers (raised, remaining, number of investors, average ticket), a commitments-by-investor bar, and the round timeline (milestones: round opened, first commitment, lead found, term sheet signed, closing).

## K3. Offers and commitments
Table: investor, offer type, amount, instrument and terms, status (`Offer received`, `Under review`, `Accepted`, `Declined`, `Committed`, `Funds received`), date, notes.
- **Record offer:** investor offers appear automatically; founders can also add offers made outside the platform (marked "Manual entry").
- Offer drawer: terms, comparison to your target terms (differences highlighted with gold-tint), conversation, **Accept**, **Counter**, **Decline** (Owners only). Accepting asks for a confirmation with the legal reminder.
- Commitment tracker: amount committed vs funds received per investor with expected date.

## K4. Term sheets
- Upload or create term sheet entries per investor with version history and a side-by-side comparison of key terms (valuation, amount, instrument, board seat, liquidation preference, pro-rata, option pool).
- Status: Draft, Shared, Signed. Signed documents are stored in the vault and the data room.
- Plain-language definitions for each term in tooltips; a note that this is for information, not legal advice.

## K5. Cap table impact
- Pre-round and post-round ownership table and a stacked bar (founders, employees or ESOP, existing investors, new investors).
- Scenario toggle: Current offers, Target raise, Custom. Dilution shown per holder.
- **Update cap table** when the round closes: preview changes, Owner confirms, and the Finance and cap table tool is updated with an audit entry.
- Label: "Estimates. Confirm with your lawyer or finance adviser."

## K6. Documents
Round documents (term sheets, side letters, board consents, closing checklist) with status and signers.

## K7. Activity
Audit log of offers, status changes, term sheet versions and cap table updates.

## K8. Closing a round
Checklist before closing: minimum raise met, term sheet signed, legal documents signed, funds received, cap table updated, investor update drafted. **Close round** (Owner) sets the round to Closed, updates the profile ("Raised ₹X in Seed"), and prompts to send a thank-you update to investors.

## K9. States
- **Below minimum at closing date:** warning banner with options to extend or adjust.
- **Offer expiring:** warning chip and reminder.
- **Cancelled round:** read-only history; investors are notified.

---

# Part L. Investor Visibility Settings: `/startup/investors/settings`

## L1. Sections
1. **Who can see my startup**
   - Private (only my team), Mentors only, Mentors and verified investors. Plain language under each choice. Changes apply immediately.
2. **What investors can see**
   - Toggles: profile summary, traction numbers (choose which), team details, funding details, round information, readiness score and badge.
   - **Preview as investor** button.
3. **Investor controls**
   - Blocked investors list with **Unblock**, hidden-from list (for example, competitors or conflicts), preferred investor types and ticket range (used for recommendations).
4. **Data room defaults**
   - Default NDA, download policy, watermark, access expiry.
5. **Notifications**
   - Alerts for views, shortlists, messages, access requests, offers; digest frequency.
6. **Pause investor visibility**
   - Temporarily hide the profile (for example, during a closed round) without deleting data. Banner shown on all investor pages while paused.

## L2. States
- **Not investment ready:** investor-visible options are locked with the reason and a link to readiness (an Owner can override with a warning if the platform policy allows).
- **Change saved:** toast with **Undo**.

---

# Part M. Notifications for investors

| Event | Who is notified | Channel |
|---|---|---|
| Investor views profile or shortlists | Owners, Admins | In-app, daily digest |
| New message or intro request | Owners, Admins | In-app, email, push |
| Data room access request | Owners, Admins | In-app, email |
| NDA signed | Owners, Admins | In-app |
| Meeting requested, confirmed or changed | Attendees | Email, in-app |
| Offer received | Owners | In-app, email, push |
| Offer expiring in 48 hours | Owners | In-app, email |
| Round milestone reached | Team | In-app |

Users can mute, filter or set digests in Settings.

---

# Part N. Data and validation

| Field | Rule |
|---|---|
| Intro message | Required, 50–500 characters; links to external payment pages are blocked |
| Target raise | Required, greater than zero; minimum raise not above target |
| Valuation or cap | Required for equity and SAFE rounds |
| Ticket size | Minimum less than maximum |
| Files | PDF, DOCX, PPTX, XLSX, up to 50 MB, virus scanned |
| NDA | Required before folder access is activated |
| Access expiry | Optional; must be in the future |
| Round dates | Closing date after opening date |
| Intro requests | Daily limit per plan |

**Audit log:** access grants and revocations, document views and downloads, offers, term sheet changes, cap table updates, visibility changes, each with user and time. Retained per the platform policy and available to Owners.

---

# Part O. Data connections

| Feature | Connected to |
|---|---|
| Investor verification and profiles | Admin console (KYC), investor module |
| Investment Ready badge and readiness score | Mentor module (`/startup/readiness`) |
| Public profile and visibility | Startup profile (`/startup/profile`) |
| Traction numbers | Business analytics and KPI tracker |
| Data room | Document vault, Mature stage data room tool |
| Cap table | Finance and cap table tool |
| Meetings and video | Managed video API, calendar |
| Messages | ERP chat service |
| Funnel metrics | Analytics (Journey tab, investor funnel) |
| Tasks from meetings | Tasks (`/startup/tasks`) |
| Notifications | ERP notification service |

---

# Part P. CSS tokens

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

# Part Q. Build order (suggested)

1. Shared components: investor card, status chips, visibility banner, disclaimer.
2. **Investor Visibility Settings** (everything depends on it).
3. **Data Room** with NDA, access control and audit trail, and **Access Requests**.
4. **Investor Hub** with Prepare mode.
5. **Find Investors**, **Investor Profile** and the intro request flow.
6. **Messages** (investor view) and **Meetings**.
7. **Investor Pipeline**.
8. **Fundraising Rounds** and **Round Detail**, with cap table impact.
9. Notifications, auto-approval rules, scenario tools.
10. Empty, loading and error states, then mobile layouts.

**Suggested first release:** items 1–5 and basic messaging, with a manual pipeline. Your proposal flags the chicken-and-egg risk and recommends launching with startups and mentors first and recruiting a small set of anchor investors, so build these pages after the mentor module and open them up as anchor investors join. Get legal advice on whether the investor module needs registration before launch.
