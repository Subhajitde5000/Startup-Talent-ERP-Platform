# Investor Diligence and Pipeline Pages Design

The pages where a verified investor moves from interest to informed decision: tracking every startup through a pipeline, getting data room access under confidentiality, reviewing documents, doing structured diligence, comparing startups and meeting founders. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Investor role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user has the `investor` role and a **KYC-verified** investor account. Data room documents and startup data are confidential: access must be checked on the server for every request. Details are in **Part A9**. Do not show these pages to startups, mentors, job seekers or employers.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Deal Pipeline | `/investor/pipeline` | Board and table of every startup from interested to committed or passed |
| 2 | Data Room Access | `/investor/data-rooms` | Startups that granted access, NDA status, requests, expiry |
| 3 | Data Room Viewer | `/investor/data-rooms/:startupId` | View-only documents with watermark, folders and notes |
| 4 | NDA Signing | `/investor/data-rooms/:startupId/nda` | Review and sign the confidentiality agreement |
| 5 | Diligence Workspace | `/investor/startups/:startupId/diligence` | Checklist, private notes, questions to the startup, risks, scorecard |
| 6 | Compare Startups | `/investor/compare` | Side-by-side view of up to 4 startups on the same criteria |
| 7 | Meetings | `/investor/meetings` | Scheduler, calendar, requests, notes and follow-ups |

Related pages: the startup's side is in `startup-investor-design.md` (Investor Pipeline, Data Room, Access Requests, Meetings). The investor pages here are the other side of the same shared records. Discovery and intro pages are in `investor-deal-flow-design.md`.

---

# Part A. Shared foundations

## A1. Design principles

- **Confidential by default:** every document view is watermarked and logged. Confidentiality rules are stated plainly, not buried.
- **Structured decisions:** diligence uses the same checklist and scorecard for every startup, so comparisons are fair and decisions are recorded.
- **Private to the investor:** notes, scores, pass reasons and pipeline stages are never shown to the startup unless the investor chooses to share feedback.
- **One pipeline, many views:** board, table, funnel and calendar all read from the same records.
- **Neutral tone:** the platform introduces parties. Scores and comparisons are the investor's own tools, not recommendations from the platform.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, current stage, Investment Ready accent, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Badges, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, gridlines |
| `--success` | `#2E7D5B` | Signed, granted, passed checks |
| `--warning` | `#B7791F` | Waiting, expiring, open risks |
| `--error` | `#B42318` | Declined, revoked, red flags |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Currency in ₹ with Indian grouping by default, configurable.

## A4. Shared layout

Desktop (≥ 1200px): the investor sidebar and top bar from the deal flow pages, then a 12-column grid with 24px gutters and a max content width of 1280px (the pipeline board scrolls horizontally). Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar, the pipeline shows one stage at a time, filters in a bottom sheet.

## A5. Shared components

### Pipeline stages
`Interested` → `Intro / Talking` → `Meeting held` → `Data room` → `Diligence` → `Offer` → `Committed`, plus `Passed` and `On hold` (collapsible). Stage colors: neutral stone for early stages, gold for Diligence, ink for Offer and Committed, stone-400 for Passed and On hold. Each stage has a short definition tooltip.

### Startup mini-card
Logo (40px), startup name, stage pill, **Investment Ready** badge (gold-tint with check), readiness score, round info (target and percent committed), owner (team member), next step and date, last activity, small icons for notes, meeting, documents and messages.

### Data room status chips
`Not requested` (stone), `Requested` (warning tint), `NDA pending` (warning outline), `Access granted` (success tint), `Expiring soon` (warning tint), `Expired` (stone outline), `Revoked` (error tint), `Declined` (error outline).

### Diligence status chips
`Not started` (stone), `In progress` (ink outline), `Needs info` (warning tint), `Clear` (success tint), `Concern` (error tint), `Not applicable` (stone outline).

### Meeting status chips
`Requested` (warning tint), `Scheduled` (stone), `Confirmed` (success tint), `Live` (gold fill), `Completed` (ink outline), `Reschedule requested` (warning tint), `Cancelled` (error tint), `No-show` (error outline).

### Privacy indicator
A lock icon with caption: "Private to you and your team" on notes, scores and pass reasons.

### Platform disclaimer
Small caption with an info icon on deal pages: "The platform introduces startups and investors. It is not a broker or adviser unless licensed. Do your own due diligence and take independent advice." Link: **Learn more**.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for notes, scores and drafts, "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner: "Your investor account is under review. Data rooms and meetings open after approval." Pipeline is visible but contact actions are disabled |
| Verification expired or action needed | Banner with the reason and **Update verification**; data room access is paused |
| Suspended | Read-only pages with a banner and **Contact support** |
| Offline | Notes keep saving locally; documents cannot be opened offline |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Pipeline drag and drop has a keyboard alternative (**Move to…**); moves are announced to screen readers.
- The document viewer supports keyboard navigation, zoom, and screen reader text where documents allow it; a "View as text" option is offered for accessible files.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Confidentiality, security and conduct rules

- **NDA first:** no document opens until the confidentiality agreement is signed and the startup has granted access.
- **View-only by default:** downloads, printing and copy are off unless the startup allows them for this investor. Where allowed, the file is watermarked.
- **Watermark and logging:** every page shows the investor's name, organization and time. Views, downloads and print attempts are logged and visible to the startup.
- **No sharing:** documents cannot be forwarded from the platform. Sharing with team members works only through the organization's permissions (the colleague needs their own verified account and a signed NDA if the startup requires it).
- **Screen capture:** the platform can't fully prevent screenshots, and the viewer says so honestly: "Access is logged. Your NDA applies to everything you view."
- **Access can end:** the startup can revoke or expire access at any time; open documents close and the viewer shows "Access ended."
- **Private notes:** notes, scores, risks and pass reasons are visible only to the investor's organization based on each note's visibility setting.
- **Conflicts and fairness:** investors declare conflicts of interest where relevant. Scorecards use the same criteria across startups.
- **Data handling:** documents are encrypted in transit and at rest; data handling follows the platform's privacy policy and applicable law (for example, India's DPDP Act).
- **Regulatory note:** confirm with counsel whether investor eligibility rules apply (for example, accredited or qualified investor requirements) and whether the investor module needs registration. Pages avoid wording that recommends investments or promises returns.

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users with the `investor` role can open any `/investor/...` route |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, job seeker, employer users see a 403 page ("This page is for investors") with a link to their own home; no investor data is fetched or rendered |
| **Multi-role users** | A founder or mentor who is also an investor sees the role switcher; switching changes the sidebar and routes between `/startup/...`, `/mentor/...` and `/investor/...` |
| **Investor not yet verified** | Pipeline and notes are visible but data room, NDA signing, meetings with startups and offers are disabled |
| **KYC level** | The server checks the verification level before allowing data room access and NDA signing |
| **Data room access** | Every document request checks: the investor's role and verification, an `Access granted` record from the startup for that folder or file, a signed NDA, and an unexpired, unrevoked grant. Anything else returns 403 and is logged |
| **Download and print** | Allowed only where the startup enabled it for this investor; otherwise the server refuses, not just the UI |
| **Organization access** | For funds and angel groups, members see pipeline, notes, scorecards and data rooms per their organization role (Owner, Admin, Analyst, Viewer). Each member signs the NDA individually where the startup requires it. Private notes follow the note's visibility setting |
| **Own data only** | Pipeline, notes, scorecards, comparisons and meeting records are returned for the signed-in investor or their organization only |
| **Startup visibility** | If a startup hides its profile, blocks the investor, or revokes access, the data is no longer returned; the investor sees a neutral "No longer available" |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner. Document contents are not shown to admins unless a dispute or safety case allows it and is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Deal Pipeline: `/investor/pipeline`

## B1. Purpose
Every startup the investor is tracking, by stage, with owners and next steps. It reflects the startup's side of the same relationship, but the stages, notes and probabilities are the investor's own.

## B2. Layout
Header with title, **+ Add startup** (add a startup met outside the platform; marked "Manual entry"), view toggle (**Board**, **Table**, **Funnel**), and a summary strip. Below: toolbar, then the main view.

### Summary strip
| Stat | Example |
|---|---|
| In pipeline | 14 |
| Meetings this week | 3 |
| Data rooms open | 4 |
| Expected commitments | ₹1.2 Cr (committed, probable, possible) |
| Needs follow-up | 5 (warning tint when above zero) |

### Toolbar
Search, filters (stage, sector, owner, last activity, readiness, round, tags, list), sort (Last activity, Next step date, Name, Ticket), **Group by** (Stage, Owner, Sector).

## B3. Board view (default on desktop)
Columns: **Interested** → **Intro / Talking** → **Meeting held** → **Data room** → **Diligence** → **Offer** → **Committed**, plus a collapsible **Passed / On hold** column.

- Cards use the startup mini-card (A5). Column header shows name, count and total expected ticket.
- Drag to move; on drop the app asks for what the stage needs:
  - to **Data room:** offers to **Request data room access** if none exists
  - to **Diligence:** opens the Diligence Workspace for the startup if not started
  - to **Offer:** links to **Offers and Term Sheets** and asks for the amount
  - to **Passed:** asks for an optional reason chip and private note (Out of scope, Too early, Too late, Terms, Concerns from diligence, Not a fit, Other), and a toggle "Share feedback with the startup" (default off)
- Keyboard alternative: card menu with **Move to…**; each move is announced.
- WIP hint (optional): a column header turns warning tint when it exceeds a limit the investor sets.

## B4. Table view
Columns: startup, stage, sector, readiness, round and percent committed, expected ticket, probability (investor-entered), owner, last activity, next step and date, diligence status, data room status, tags. Inline editing for stage, owner, probability, next step, tags. CSV export (own data only).

## B5. Funnel view
Funnel chart from Interested to Committed with counts, conversion percentages and average days at each stage; a bar for expected raise (committed in ink, probable in gold, possible in stone-400). A table below lists stalled startups (no activity for 14+ days).

## B6. Startup detail drawer (520px)
Opens from a card:
- **Summary:** profile snapshot (shared fields only), stage, readiness, round info.
- **Relationship:** pipeline stage dropdown, owner, probability, expected ticket, next step and date.
- **Quick links:** **Open profile**, **Message**, **Schedule meeting**, **Data room**, **Diligence**, **Add to compare**.
- **Activity:** timeline (saved, intro, messages, meetings, data room views, notes).
- **Private notes** (A5 privacy indicator).
- **Pass** and **Put on hold** actions.

## B7. Bulk actions
Select multiple: **Change stage**, **Assign owner**, **Add tag**, **Add to compare** (up to 4), **Export**.

## B8. States
- **Empty:** "Your pipeline is empty. Save startups from Discover or add one you've met." with **Discover startups** and **+ Add startup**.
- **Stale startups:** cards with no activity for 14 days show a warning chip and a suggested next step ("Follow up").
- **Startup closed its round or hid its profile:** card shows "Round closed" or "No longer visible"; your notes are kept.
- **Stage mismatch with the startup's record:** if the startup's side shows a later stage (for example, they granted data room access), a gold-tint hint suggests moving the card.
- **Manual entry:** startups added manually show a "Manual entry" tag and have no shared platform data.
- **Not verified:** cards visible, move to Data room and later stages disabled with the banner (A6).

---

# Part C. Data Room Access: `/investor/data-rooms`

## C1. Purpose
Shows every startup's data room the investor has requested or been granted, with NDA status, scope and expiry.

## C2. Layout
Tabs: **Access granted** · **Requested** · **NDA pending** · **Expired and revoked**. Toolbar: search, filters (stage, sector, scope, expiring soon), sort (Last viewed, Expiry, Name). A summary strip: rooms open, NDAs to sign, expiring in 7 days, documents added since last visit.

## C3. List
Rows or cards:
- Startup mini-card summary
- Data room status chip (A5)
- **Scope:** folders you can open (Corporate, Financials, Legal, Product, Team, Customers, Pitch), with counts
- NDA status and date signed
- Access expiry ("Ends 30 Nov") with a warning chip within 7 days
- Download policy (View only, Download allowed)
- "New since last visit" chip with document count
- Last viewed
- Actions: **Open data room**, **Sign NDA**, **Request more access**, **Remove from list** (past access)

## C4. Request more access (modal)
- Folders or documents wanted, reason (up to 300 characters), and a note if you need download access (the startup decides).
- Confirmation: "You agree to keep information confidential under the signed NDA."
- **Send request** (primary).

## C5. Team access (organizations)
For each room: team members with access, each member's NDA status, and **Request access for a colleague** (the startup approves each person). Members without an NDA see the room as locked.

## C6. States
- **Empty:** "No data rooms yet. Request access from a startup profile after an intro." with **View shortlist**.
- **Request pending over 3 days:** reminder and **Follow up** (once).
- **Expiring soon:** warning chip and **Request extension**.
- **Revoked:** error chip with the date; documents close immediately. No reason is shown unless the startup shares one.
- **Declined:** reason if provided; option to **Ask a question** in Messages.
- **Not verified:** requests disabled with the banner (A6).

---

# Part D. Data Room Viewer: `/investor/data-rooms/:startupId`

## D1. Purpose
A secure, view-only place to read a startup's documents, with notes tied to each document.

## D2. Layout
Three panes on desktop: **folder tree** (left, 260px), **document list** (center-left), **viewer** (right, main area). On tablet the tree collapses to a drawer; on mobile it becomes a stacked list and full-screen viewer.

### Top bar
Startup name and logo, status chip, **Completeness** (how complete the startup's data room is, as the startup shows it), **Search in data room**, **Ask a question** (opens the Diligence Workspace question thread), **Back to data rooms**. A permanent confidentiality banner under it: "Confidential. Subject to your NDA. Your name and the time are shown on every page. Access is logged."

## D3. Folder tree
Folders: Corporate, Financials, Legal, Product, Team, Customers, Pitch (as the startup organized them). Each folder shows document count and a dot for new or updated items. Locked folders (not in your scope) show a lock and **Request access**.

## D4. Document list
Columns: name, type icon, size, updated, status (`New`, `Updated`, `Viewed`), your notes count. Sort by name, updated, unread. Filters: new or updated, viewed or unviewed, type. Items the startup marked as missing in the checklist appear as dashed placeholders ("Cap table: not provided yet") with **Ask for this**.

## D5. Viewer
- Document rendering (PDF, slides, spreadsheets as read-only tables), page thumbnails, zoom, fit to width, full screen, page jump.
- **Watermark** across the document with name, organization and time; it can't be turned off.
- Download and print buttons appear only if the startup allowed them for this investor (A8). Otherwise they are hidden, with a tooltip on the toolbar: "Download isn't enabled for this document."
- **Version history:** if the startup replaced the file, a version selector with "What changed" (where available); versions you viewed are marked.
- **Document notes (private):** panel beside the viewer with notes tied to a page or a highlighted region; autosaved; marked "Private to you and your team." Notes can be turned into diligence checklist findings with **Add to diligence**.
- **Ask about this page:** creates a question in the Diligence Workspace linked to the document and page; the startup sees only the question text and the document reference.
- **Mark as reviewed:** checkbox to track progress; progress bar at the top of the folder.

## D6. Search
Search within names, and within document text where available (the server returns only documents the investor can access). Results show document, page and a short snippet, with the folder shown.

## D7. Audit and fairness
- Every open, page view duration, download and print attempt is logged and shown to the startup in their audit trail.
- A small "Your activity" link shows the investor their own access log.
- Reading time and views are not used to rank or score investors.

## D8. States
- **Loading document:** skeleton viewer with progress.
- **No access:** full-page message "You don't have access to this folder" with **Request access** (if allowed).
- **NDA not signed:** redirect to the NDA Signing page (Part E) with a message.
- **Access ended or revoked:** viewer closes with "Access ended." Notes you wrote remain in your private notes (text only; the document is gone).
- **Document removed by the startup:** "This document is no longer available." Your notes are kept.
- **File can't be previewed:** message and a request for a view-friendly version.
- **Scan or load failure:** **Retry** and **Report a problem**.
- **Idle session:** after 10 minutes of inactivity the viewer locks and asks you to confirm you are still there (shorter if the startup set stricter security).
- **Multiple sessions:** if the same account opens a room on another device, the older session is closed with a notice.

---

# Part E. NDA Signing: `/investor/data-rooms/:startupId/nda`

## E1. Purpose
A clear, plain-language signing step before any confidential document can be opened.

## E2. Layout
Centered content, max width 760px. A step indicator at the top: **Review** → **Confirm identity** → **Sign** → **Done**.

## E3. Steps

### 1. Review
- **Key points summary** card (plain language, so the reader gets the gist): what counts as confidential, how long the duty lasts, who can see the information (you and named colleagues only), what is not covered (public information), what happens if it is breached, which law and courts apply.
- **Full agreement** in a scrollable viewer with a **Download copy** option (this one is allowed so the investor keeps their own signed copy).
- Parties shown clearly: the startup's legal name and the investor (individual or entity, with the signing person's role).
- Version and date of the NDA template (either the platform's template or the startup's own).
- Caption: "This is a legal agreement. Read it, and take your own legal advice if needed. The platform does not give legal advice."

### 2. Confirm identity
- Shows your verified name and entity from KYC; confirms the authority to sign for the entity (for funds and groups: "I am authorized to sign for {Entity}").
- Re-authentication (password or second factor) before signing.

### 3. Sign
- Checkboxes: "I have read and agree to the NDA," "I will keep information confidential and use it only to evaluate a possible investment," "I will not share data room content except with colleagues covered by this NDA."
- Signature method: typed name with a drawn or generated signature, plus an electronic signature record (timestamp, IP region, device) as supported by applicable law.
- **Sign and continue** (primary), **Decline** (secondary).

### 4. Done
- Confirmation card with date, version and a **Download signed copy** button.
- Next step: **Open data room** (if the startup already granted access) or "Waiting for {Startup} to grant access."
- The startup is notified that the NDA is signed.

## E4. Organization signing
- For funds and angel groups, the entity can sign once for named team members, or each member signs individually, depending on what the startup requires. The page shows who is covered and who still needs to sign.
- **Add a colleague:** requests the startup's approval and shows each person's NDA status.

## E5. States
- **Already signed:** page shows the signed copy and status; **Open data room**.
- **NDA changed by the startup:** banner "{Startup} updated the NDA. Please review and sign the new version." Access to new documents waits until you sign; access to previously viewed documents follows the startup's policy.
- **Declined:** the page explains the effect: no access. A polite message goes to the startup only if you choose to send one.
- **Expired:** NDA past its term shows `Expired`, with **Renew** if the startup allows.
- **Identity check failed or verification expired:** blocked with a link to update verification.
- **Not verified:** signing disabled with the banner (A6).
- **Signature error:** inline message and **Retry**; the progress is kept.

## E6. Legal and conduct notes
- Keep the signing record (version, signer, time, IP region, device) in the audit log and available to both parties.
- Do not allow signing on behalf of someone else.
- Confirm with counsel that the signing method and record meet the applicable e-signature law.

---

# Part F. Diligence Workspace: `/investor/startups/:startupId/diligence`

## F1. Purpose
A structured place for the investor's own due diligence: what has been checked, what is open, what the investor thinks, and what to ask next. All content is private to the investor's organization unless the investor chooses to send a question to the startup.

## F2. Layout
Header with the startup mini-card, pipeline stage, overall diligence status and progress bar. Tabs: **Overview** · **Checklist** · **Questions** · **Findings and risks** · **Scorecard** · **Notes** · **Documents**. A privacy indicator on every tab: "Private to you and your team."

## F3. Overview tab
- **Progress:** areas completed (for example, 5 of 8) with a gold progress bar.
- **Status by area:** Business, Market, Product, Team, Financials, Legal, Traction, Round terms, each with a diligence chip (A5).
- **Open items:** count of questions awaiting the startup, unresolved risks, missing documents.
- **Next steps:** the next three actions with due dates (**Schedule call with CTO**, **Review cap table**).
- **Readiness context** (from the startup's shared data): readiness score, signed-off items and mentors, each labeled by source. Caption: "Mentor sign-off is context, not a substitute for your own diligence."

## F4. Checklist tab
Template checklists by area, editable per investor or organization:

| Area | Example items |
|---|---|
| **Business** | Business model understood, pricing, customer references |
| **Market** | Market size assumptions checked, competitors reviewed |
| **Product** | Demo seen, roadmap, technical review |
| **Team** | Founder background checks, references, key hires |
| **Financials** | Financial statements, burn and runway, projections and use of funds |
| **Legal** | Company registration, cap table, contracts, IP ownership, litigation |
| **Traction** | Metrics verified against source, retention, concentration of customers |
| **Round terms** | Valuation, instrument, rights, existing investors |

Each item: title, status chip, owner (team member), due date, evidence (linked documents, notes, calls), comment thread, and **Mark clear / Needs info / Concern / Not applicable**. Progress per area and overall. **Add item**, **Use template**, **Save as my template**.

## F5. Questions tab
A thread of questions to the startup, grouped by area and status (`Draft`, `Sent`, `Answered`, `Follow-up needed`, `Closed`).

- **Compose question:** area, question (up to 1,000 characters), linked document and page (optional), priority, due date. Questions go through Messages and appear to the startup as a diligence request ("Investor question") without your scorecard or notes.
- Answers appear inline with timestamps and attachments; **Accept answer** (closes) or **Follow up**.
- **Question bundles:** send several questions at once to avoid back-and-forth; the page encourages concise lists.
- A daily limit counter prevents flooding founders.

## F6. Findings and risks tab
A register of findings:
- Type: Strength, Risk, Red flag, Open question.
- Area, description, severity (Low, Medium, High), source (document and page, call, answer), status (Open, Mitigated, Accepted, Dismissed), owner, mitigation or next step.
- A simple risk summary bar (counts by severity) and a filter. Red flags show an `error` tint, and the page makes plain that this is the investor's own assessment.

## F7. Scorecard tab
- Criteria with weights set by the investor or the organization (for example, Team 25%, Market 20%, Product 20%, Traction 20%, Terms 15%). Weights can be changed and are saved as a template.
- Each criterion: score 1–5 with written anchors for each level, short rationale (required), and evidence links.
- **Overall score** with a breakdown chart (ink bars, gold for the overall). Caption: "Your own assessment. Not a platform recommendation."
- Multiple reviewers (organizations): each team member scores independently; scores stay hidden from colleagues until submitted; the page then shows the spread and average, and flags large disagreements for discussion.
- **Decision box:** Proceed, Need more info, Pass, with a note. Linked to the pipeline stage.
- Fairness note: criteria must not use personal characteristics of founders (age, gender, religion, caste, nationality, marital status).

## F8. Notes tab
- Notes by area and call (rich text), with tags and attachments.
- Visibility per note: Private to me, Shared with my team. Both are hidden from the startup.
- **Call notes template:** attendees, topics, key takeaways, follow-ups; converts follow-ups into checklist items or questions.
- Search and filter across notes.

## F9. Documents tab
List of documents from the startup's data room (only those you can access) with your review status, notes count and open questions linked to each. **Open** goes to the viewer. A separate section for documents you uploaded (for example, your own analysis); these are private to your team.

## F10. Final decision and export
When ready: **Record decision** (Proceed to offer, Pass, Put on hold) with a summary note. Proceeding opens **Offers and Term Sheets**; Passing offers a feedback option (a short, optional message to the startup that you can edit). **Export diligence memo (PDF):** auto-generates a summary of checklist, findings, scorecard and notes for the investor's own committee; the PDF is watermarked and excludes startup confidential documents' contents.

## F11. States
- **New:** "Start your diligence" with **Use a template**, **Build from scratch**, and a hint to request data room access if not yet granted.
- **Waiting on the startup:** open questions highlighted; reminder button after 5 days (limited).
- **Startup updated documents:** banner "3 documents changed since your last review" with **Review changes**.
- **Concerns raised:** summary card with unresolved red flags before moving to Offer.
- **Startup closed its round or paused visibility:** read-only banner; your notes, scores and findings remain.
- **Team disagreement:** scorecard shows a warning chip when reviewers differ by 2 or more points on a criterion.
- **Not verified:** workspace available for notes, but questions and data room links are disabled with the banner (A6).

---

# Part G. Compare Startups: `/investor/compare`

## G1. Purpose
A side-by-side view of up to four startups on the same criteria, to help the investor decide where to spend time. It uses only fields each startup shared, and the investor's own scorecards.

## G2. Layout
Header with title, a selector chip row ("Compare: {A} · {B} · {C} · **+ Add**"), a saved-comparison menu, and **Share with my team** and **Export PDF**. Below: a sticky header row with startup logos and names, then the comparison table.

### Adding startups
**+ Add** opens a picker from the shortlist, pipeline or search (up to 4). Comparison is also started from Discover or Shortlist via **Add to compare**.

## G3. Comparison table
Rows in grouped, collapsible sections; the same labels in the same order for every startup:

| Section | Rows |
|---|---|
| **Overview** | Stage, sector, location, founded, team size, one-liner |
| **Readiness** | Investment Ready badge and date, readiness score, signed-off items, mentors |
| **Traction** | MRR, growth MoM, customers, churn, runway, unit economics (as shared, with source labels) |
| **Round** | Raise, instrument, valuation or cap, minimum ticket, percent committed, lead investor, closing date |
| **Team** | Founders, key roles filled, hiring status |
| **Market** | Market size (with source and confidence), competitors count |
| **Documents and diligence** | Data room access status, diligence progress, open risks, your scorecard score (if scored) |
| **Your pipeline** | Stage, owner, next step, probability |

- Missing data shows "Not shared" in `--stone-400`. Source chips appear on each number.
- **Highlight differences** toggle: shows which cells differ most; **Highlight best per row** toggle uses a subtle gold-tint behind the leading value (for numeric rows where "better" is clear, such as growth, and never for subjective rows). A small caption says the highlight shows the highest value, not a recommendation.
- **Normalize view:** toggle to show growth, churn and similar metrics per period and unit so startups of different sizes are comparable, with the formula in a tooltip.
- **Weighted view:** apply the investor's scorecard weights to produce a simple weighted comparison (requires scorecards); labeled "Your weights, your scores."

## G4. Charts
A compact chart strip above or below the table: MRR over time (lines in ink, gold, stone-400 and stone-700 for the four startups), growth rate bars, and runway bars. Direct labels on the lines in addition to color; **View as table** toggle.

## G5. Actions per startup
Column header menu: **Open profile**, **Open diligence**, **Message**, **Request intro**, **Move to pipeline stage**, **Remove from comparison**.

## G6. Saved comparisons
Name and save a comparison; list in a drawer ("Seed fintech shortlist, 3 startups"); the saved version updates automatically when startups update their data, with an "Updated" chip and the date.

## G7. States
- **Empty:** "Pick startups to compare." with **Add from shortlist** and **Add from pipeline**.
- **One startup only:** hint "Add at least one more startup."
- **Over the limit:** message "You can compare up to 4 startups" with a way to swap one.
- **Different stages:** warning chip "These startups are at different stages. Some metrics may not be comparable."
- **Data hidden or no longer shared:** column shows "No longer available" and keeps your own notes and scores.
- **Few shared fields:** the page shows how many rows are comparable ("9 of 24 rows have data for all startups") with **Hide rows with missing data**.
- **Not verified:** comparison works on public fields; pipeline and diligence links are disabled with the banner (A6).

---

# Part H. Meetings: `/investor/meetings`

## H1. Purpose
Schedule, run and follow up on meetings with founders: intro calls, pitches, diligence calls and follow-ups. It is the investor's side of the startup's Meetings page.

## H2. Layout
Tabs: **Upcoming** · **Requests** · **Needs notes** · **Past** · **Calendar**. Toolbar: search, filters (startup, type, status, date), **+ Schedule meeting**. A summary strip: meetings this week, requests waiting, meetings without notes, average days between meetings and decision.

## H3. Upcoming
Cards grouped by day: date and time (time zone shown; default Asia/Kolkata), startup mini-card, type (Intro call, Pitch, Diligence call, Follow-up), duration, attendees (avatars), status chip, agenda preview. Actions: **Join** (appears 10 minutes before; platform video), **Prepare** (opens a prep drawer), **Reschedule**, **Cancel**, **Add to calendar**.

### Prep drawer
- Startup snapshot, last meeting notes, open diligence questions and risks, documents to review, suggested question list (from the checklist), and the agenda. A **Mark prepared** checkbox.

## H4. Requests
Meeting requests from startups (and your own pending ones): proposed times, agenda, attachments (view-only links to their materials). Actions: **Accept**, **Propose another time**, **Decline** (reason chips; message optional). Availability windows and a daily cap (set in Settings) keep requests manageable.

## H5. Schedule meeting (modal)
1. **Startup** (prefilled from the pipeline or profile) and meeting type
2. **Time:** pick from the startup's available slots when they've set them, or propose 3–5 times; duration (15, 30, 45, 60)
3. **Attendees:** your team members (with a note that colleagues must be covered by the NDA if sensitive material will be discussed), founder attendees
4. **Agenda and materials:** agenda items, optional documents from the data room (links remain view-only)
5. **Message** to the startup
6. **Send invite** (primary). The startup confirms or proposes another time.

## H6. Meeting detail drawer or page
- Header: startup, type, time, status chip, **Join**.
- Agenda (shared, editable by both before the meeting).
- **Your notes** (private; A5 privacy indicator): free-form or structured template (key takeaways, concerns, follow-ups, rating of the meeting 1–5).
- **Action items:** with owner and due date; **Create diligence question**, **Add to checklist**, **Create reminder**.
- **Follow-up:** a draft thank-you or next-steps message template; **Update pipeline stage** shortcut (for example, to Diligence).
- Recording: off by default; only possible if both sides consent before it starts. Recordings are private to participants and deletable by the startup on request.

## H7. Past
Table: date, startup, type, outcome (set by the investor: Positive, Neutral, Concerns, Not a fit), notes status (Added, Missing), next step, link to diligence. Filters and CSV export (own meetings).

## H8. Calendar
Week and month views with meetings as chips (ink), proposed times as hatched stone blocks, and your availability windows as faint stone. Clashes flagged with a warning icon. **Today** button, drag to propose a new time (sends a reschedule request, never silently moves it). A mini month picker.

## H9. States
- **No meetings:** "No meetings yet." with **Schedule meeting** and **Set availability**.
- **Request waiting over 3 days:** warning chip and reminder.
- **Starting soon:** gold-tint card with **Join** focused; **Prepare** if not yet prepared.
- **Needs notes:** meetings finished without notes appear in the tab after 24 hours, with **Add notes**.
- **Startup requested reschedule:** warning chip with **Accept** or **Propose another**.
- **No-show by the startup:** mark with a note; **Rebook**.
- **Time clash:** warning with the clashing items and **Propose new time**.
- **Connection problems:** reconnect hint and fallback options if the video service provides them.
- **Not verified:** scheduling disabled with the banner (A6).

---

# Part I. Notifications for these pages

| Event | Channel |
|---|---|
| Data room access granted, extended, revoked or expiring in 7 days | In-app, email |
| NDA ready to sign, NDA updated by the startup | In-app, email |
| New or updated documents in a data room | In-app, daily digest |
| Startup answered a diligence question | In-app, email |
| Question unanswered after 5 days (reminder to you) | In-app |
| Pipeline follow-up reminder due | In-app, email |
| Startup stage or round changed (opened, closed) | In-app, email |
| Meeting request received, confirmed, changed or cancelled | Email, in-app |
| Meeting starts in 1 hour and 10 minutes | In-app, push |
| Meeting notes missing after 24 hours | In-app |
| Saved comparison updated | In-app |
| Colleague shared a scorecard or comparison | In-app |

Investors can mute, filter or set digests in Settings. Security alerts cannot be muted.

---

# Part J. Data and validation

| Field | Rule |
|---|---|
| Pass reason | Optional chips and note; note up to 1,000 characters; feedback to the startup only if the investor opts in |
| Probability | 0–100 percent, investor-entered |
| Expected ticket | Greater than zero; currency required |
| Data room request reason | Up to 300 characters |
| NDA signature | Re-authentication, all checkboxes ticked, signer identity matches the verified account |
| Document notes | Up to 5,000 characters per note; private by default |
| Diligence question | Up to 1,000 characters; daily question limit per startup |
| Scorecard | Weights total 100 percent; each score 1–5 with a rationale of at least 20 characters |
| Finding | Type, area and severity required |
| Compare | Up to 4 startups |
| Meeting | At least 12 hours ahead (configurable by the startup's availability); no overlaps for the same investor |
| Meeting duration | 15, 30, 45 or 60 minutes |
| Meeting notes | Up to 10,000 characters; private by default |
| Exports | Only the investor's own data; no data room content in exports |

**Audit log:** pipeline stage changes, data room requests and access changes, NDA actions, document opens, downloads and print attempts, question activity, scorecard submissions, decisions, meetings and exports, each with user and time. Startups can see the logged views of their own documents.

---

# Part K. Data connections

| Feature | Connected to |
|---|---|
| Investor verification and KYC level | Admin console, investor application and verification |
| Pipeline records and startup relationship | Startup's Investor Pipeline (`/startup/investors/pipeline`) for shared stages, investor's private fields kept separate |
| Data room contents, access scope, NDA template, download policy | Startup Data Room (`/startup/data-room`), Access Requests |
| NDA records | NDA service, audit log |
| Startup profile, readiness, mentors, round | `/startup/profile`, `/startup/readiness`, `/startup/rounds` (shared fields only) |
| Traction numbers | Startup analytics (shared fields only) |
| Diligence questions and answers | ERP chat service, Messages |
| Meetings and video | Startup Meetings (`/startup/meetings`), managed video API, calendar |
| Offers | Offers and Term Sheets (`/investor/offers`) |
| Organization roles and sharing | Investor team and organization |
| Notifications | ERP notification service |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part L. CSS tokens

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
  --chart-4: var(--stone-700);
}
```

---

# Part M. Build order (suggested)

1. Role guard, KYC checks and investor shell (Part A9), including the verification banner and limited mode.
2. **Data room access control on the server** (grant, NDA, expiry, revoke, download policy, audit log). Build this before any viewer UI.
3. **NDA Signing**, then **Data Room Access** (list, requests, expiry).
4. **Data Room Viewer** with watermarking, notes and search.
5. **Deal Pipeline** (board and table first; funnel later).
6. **Meetings** (scheduling, prep, notes) and the video integration.
7. **Diligence Workspace:** checklist and notes first, then questions, findings, scorecard and memo export.
8. **Compare Startups** once the shared data fields and scorecards exist.
9. Notifications, organization sharing, exports.
10. Empty, loading and error states, then mobile layouts.

**Suggested first release:** pipeline, data room access, NDA signing and the viewer, plus basic meetings and a simple diligence checklist and notes. Add the full scorecard, compare and memo export after the first anchor investors are completing real diligence.

**Reminder for the build:** every route above is investor-only and role-based. Add the guard and KYC checks first, enforce data room access (role, grant, NDA, expiry, download policy) on the server for every file request, keep investor notes and scores private from startups, and write every document view and access change to the audit log. Get legal advice on the NDA template and e-signature method, on investor eligibility rules, and on whether the investor module needs registration before launch.
