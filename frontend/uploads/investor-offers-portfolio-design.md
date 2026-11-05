# Investor Offers and Portfolio Pages Design

The pages where a verified investor turns diligence into a deal and then follows the companies it funded: making and tracking offers and term sheets, negotiating with the startup, recording commitments and funds sent, and monitoring the portfolio. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Investor role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user has the `investor` role and a **KYC-verified** investor account with the right verification level for making offers. Offers, terms and portfolio data are confidential and legally significant: access must be checked on the server for every request. Details are in **Part A9**. Do not show these pages to startups (except the shared offer records described below), mentors, job seekers or employers.

> **Reminder: platform role and legal limits.**
> The platform introduces parties and **records** offers, term sheets and commitments. Unless it holds the right licenses, it does **not** broker the deal, hold funds, issue securities or give legal, tax or investment advice. The pages must say this plainly. Get legal advice before launch on how offers, term sheets, funds transfer and portfolio records should work (see Part A8).

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Offers and Term Sheets | `/investor/offers` | Create and track offers and term sheet versions across startups |
| 2 | Offer Detail | `/investor/offers/:offerId` | Terms, comparison with the startup's target terms, negotiation thread, documents, status |
| 3 | Commitments | `/investor/commitments` | Amounts committed, funds sent, closing checklist per round |
| 4 | Portfolio | `/investor/portfolio` | Startups funded through the platform, status and updates |
| 5 | Portfolio Company Page | `/investor/portfolio/:startupId` | Updates, KPIs, documents, board reports, cap table share for one company |

Related pages: the startup's side is in `startup-investor-design.md` (Fundraising Rounds, Round Detail, Messages). The investor pages here are the other side of the same shared offer and round records. Discovery, diligence and pipeline pages are in `investor-deal-flow-design.md` and `investor-diligence-pipeline-design.md`.

---

# Part A. Shared foundations

## A1. Design principles

- **Terms in plain language:** every term has a short definition and shows how it compares with the startup's target, so both sides know what they are agreeing to.
- **One record, two sides:** an offer is a shared record that both investor and startup see, with versions and a clear history. Private notes stay private.
- **No surprises with money:** amounts, ownership percentages and dilution are shown with the formula. Estimates are labeled as estimates.
- **Slow down the irreversible:** accepting terms, signing and recording funds are deliberate steps with confirmations and re-authentication.
- **After the deal, stay informed:** the portfolio page turns startup updates into a simple, regular picture without becoming a surveillance tool.
- **Neutral tone:** the platform never recommends an investment or predicts returns.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series, committed status |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, current stage, changed terms, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Badges, changed-term highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, gridlines |
| `--success` | `#2E7D5B` | Accepted, funds received, positive change |
| `--warning` | `#B7791F` | Waiting, expiring, overdue update |
| `--error` | `#B42318` | Declined, withdrawn, failed, negative change |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.
- Page title 28px serif; KPI number 32px serif 600; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Currency in ₹ with Indian grouping by default (for example, ₹50L, ₹2 Cr), configurable; show the currency code when more than one currency exists.

## A4. Shared layout

Desktop (≥ 1200px): the investor sidebar and top bar from the other investor pages, then a 12-column grid with 24px gutters and a max content width of 1280px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar, tables become cards, sticky bottom action button.

## A5. Shared components

### Offer status chips
`Draft` (stone), `Awaiting approval` (warning tint, internal sign-off in the organization), `Sent` (stone outline), `Viewed` (ink outline), `Under review` (ink outline), `Countered` (gold-tint), `Accepted` (success tint), `Committed` (ink fill), `Declined` (error tint), `Withdrawn` (stone), `Expired` (stone outline), `Closed` (ink outline).

### Commitment and funds chips
`Committed` (ink fill), `Docs in progress` (warning tint), `Signed` (success tint), `Funds pending` (warning outline), `Funds sent` (ink outline), `Funds received` (success tint), `Closed` (ink outline), `Failed` (error tint).

### Term row
Used wherever terms appear: label, your value, the startup's target value (if shared), a difference marker (`=` matches, `▲` more favorable to the startup, `▼` more favorable to the investor, "Not set"), a `--gold-tint` background when terms changed from the previous version, and an info tooltip with a plain-language definition. The marker describes direction only and is never a verdict.

### Ownership and dilution bar
Stacked horizontal bar showing ownership before and after the round (founders, ESOP, existing investors, this investor, other new investors) using ink, gold, stone-700 and stone-400, with direct labels and a **View as table** toggle. Labeled "Estimate. Confirm with the startup's lawyer."

### Version chip
`v3` with date and author. Clicking opens version history.

### Platform disclaimer
Visible on offer and commitment pages: "The platform records offers and introduces parties. It is not a broker or adviser unless licensed, and it does not hold or move funds. Get your own legal, tax and financial advice." Link: **Learn more**.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for drafts and notes, "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner: "Your investor account is under review. You can view your pipeline, but you can't make offers until you're verified." Offer actions disabled |
| Verification level too low | Banner: "Making offers needs full verification." with **Upgrade verification** |
| Verification expired | Banner with **Update verification**; open offers are paused |
| Suspended | Read-only pages with a banner and **Contact support** |
| Offline | Drafts save locally; sending, accepting and signing are disabled until reconnected |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms; charts animate once (600ms). Money values never animate as counters. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone; term differences use symbols and words as well as color.
- Tables use proper `th` and `scope`; amounts are right-aligned and announced with their currency.
- Every chart has a text summary and a **View as table** toggle.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Legal, security and conduct rules

- **Records, not brokerage:** the platform records offers, versions, acceptances and commitments. It does not set terms, hold funds, issue securities, or act as a broker or adviser unless licensed. Funds move between the parties outside the platform (or through a licensed partner if one is integrated); the platform tracks status that the parties confirm.
- **Not legally binding until signed:** an offer or term sheet in the platform is non-binding unless the signed documents say otherwise. The page states whether specific terms (for example, exclusivity or confidentiality) are binding, based on the document, and always says: "Review binding terms with your lawyer."
- **Confirmation by both sides:** a commitment is recorded only when the investor records it and the startup confirms it. Funds are "received" only when the startup confirms receipt.
- **Re-authentication:** sending or accepting an offer, recording a commitment, recording funds sent, and changing payment details require re-authentication.
- **Securities and eligibility:** confirm with counsel whether investor eligibility rules apply (for example, accredited or qualified investor requirements), whether the investor module needs registration, and what disclosures or filings each round needs. The pages avoid wording that recommends investments or promises returns.
- **Equity and cap table:** the investor's ownership shown is an estimate until the startup updates its cap table after closing. The cap table is the startup's record.
- **Confidentiality:** offers, term sheets and portfolio information are confidential. Data shared in a portfolio relationship is covered by the NDA and agreements already signed; the page repeats the reminder.
- **Fairness:** terms must not discriminate on personal characteristics of founders. No dark patterns: no countdown pressure beyond a real expiry date set by the parties.
- **Private notes and internal approvals:** internal notes, approvals and valuations stay within the investor's organization and are never shown to the startup.
- **Data handling:** documents are encrypted in transit and at rest; data handling follows the platform's privacy policy and applicable law (for example, India's DPDP Act).

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users with the `investor` role can open any `/investor/...` route |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, job seeker, employer users see a 403 page ("This page is for investors") with a link to their own home; no investor data is fetched or rendered. The startup sees its side of the same offers at `/startup/rounds/:roundId`, with only the shared fields |
| **Multi-role users** | A founder or mentor who is also an investor sees the role switcher; switching changes the sidebar and routes between `/startup/...`, `/mentor/...` and `/investor/...` |
| **Investor not yet verified** | View-only pages; creating, sending and accepting offers are disabled |
| **KYC and eligibility level** | The server checks the verification level and any eligibility status before allowing offers, commitments and portfolio linking |
| **Offer access** | `/investor/offers/:offerId` opens only if the signed-in investor (or their organization) made the offer. The startup receives a separate, filtered view. Any other ID shows 404 |
| **Organization roles** | For funds and angel groups: Owner and Admin can create and send offers; Analyst can draft and comment; Viewer is read-only. **Approvers** (set by the organization) must approve offers above a threshold before they can be sent. Separation of duties: the person who creates an offer cannot be the only approver |
| **Sensitive actions** | Sending, withdrawing and accepting offers, recording commitments and funds, and changing payment details require re-authentication |
| **Portfolio access** | `/investor/portfolio/:startupId` opens only for startups where the investor has a **Closed** commitment (or a manually added holding, marked as such). Startup data shown is limited to what the startup shares with its investors under the portfolio relationship |
| **Data scope** | Startup data is returned only for fields the startup shares with this investor; the server filters, not only the UI |
| **Own data only** | Offers, notes, approvals, commitments and portfolio records are returned for the signed-in investor or their organization only |
| **Admin view** | Admins can view these pages read-only for support or dispute resolution, with an "Admin view" banner; actions are logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Offers and Term Sheets: `/investor/offers`

## B1. Purpose
All the investor's offers and term sheets in one place: drafts, sent, countered, accepted and closed. It is the investor's side of the startup's Offers and commitments tab.

## B2. Layout
Header with title and **+ New offer**. Summary strip, tabs, toolbar, then the list. A side column on desktop with deadlines and reminders.

### Summary strip
| Stat | Example |
|---|---|
| Open offers | 3 |
| Awaiting startup response | 2 |
| Total offered (open) | ₹1.5 Cr |
| Expiring in 7 days | 1 (warning tint when above zero) |
| Accepted, awaiting documents | 1 |

### Tabs
**All** · **Drafts** · **Awaiting approval** · **Sent** · **Countered** · **Accepted** · **Closed and declined**.

### Toolbar
Search, filters (startup, round, status, instrument, amount, owner, expiry), sort (Last activity, Expiry, Amount, Startup name), view toggle (Table or Cards).

## B3. Table
| Column | Content |
|---|---|
| Startup | Mini-card with logo, name, stage pill, **Investment Ready** badge |
| Round | Round name and type, target raise and percent committed |
| Offer | Amount, instrument, valuation or cap |
| Version | Version chip |
| Status | Offer status chip (A5) |
| Last activity | Date and who acted |
| Expires | Date; warning chip within 7 days |
| Owner | Team member |
| Actions | **Open**, overflow (Duplicate, Withdraw, Archive) |

Row click opens Offer Detail. Bulk select: **Archive**, **Export**.

## B4. Side column
- **Needs attention:** counters to respond to, offers expiring soon, offers awaiting your internal approval, documents awaiting your signature.
- **Compare offers:** quick compare of your own offers for the same round (amount, valuation, key rights) with a link to the Compare page.
- **Guide:** short explanation of the steps (draft, approve, send, negotiate, accept, documents, commit, funds) with the platform disclaimer.

## B5. Create offer: `/investor/offers/new` (full page or drawer)
A step-by-step form with a live summary on the right:

1. **Startup and round**
   - Pick a startup from your pipeline (only startups with an open round and where you are at Diligence or later). The page shows the round's target terms if the startup shared them.
2. **Offer amount and instrument**
   - Amount, currency, instrument (Equity, SAFE, Convertible note, Other), whether this is a lead, co-lead or follow offer.
3. **Valuation and pricing**
   - Pre-money valuation or valuation cap, discount, interest rate and maturity (for notes), price per share (calculated or entered).
4. **Key terms**
   - Board seat or observer, liquidation preference, anti-dilution, pro-rata rights, information rights, option pool, vesting changes, protective provisions, exclusivity period, conditions to close.
   - Each term has a short, plain-language definition and a "Common range" hint labeled as general information, not advice.
5. **Conditions and timeline**
   - Due diligence conditions, legal documents needed, expected closing date, offer expiry date.
6. **Message to the startup**
   - A short cover note (up to 1,000 characters).
7. **Review and approvals**
   - Summary, estimated ownership and dilution (A5 bar), internal approver selection (organizations), and the disclaimer.
   - **Save draft**, **Submit for approval** (if required) or **Send offer** (primary).

Sending shows a confirmation: "This sends a non-binding offer record to {Startup}. Binding terms depend on the documents you sign." and requires re-authentication.

## B6. Term sheet documents
- **Generate from template:** a sample term sheet built from the entered terms, as an editable draft. The page states that templates are samples and need legal review.
- **Upload your own term sheet:** PDF or DOCX (up to 25 MB); the platform extracts nothing automatically, and the structured terms must be entered to enable comparison.
- Documents are versioned and linked to the offer.

## B7. States
- **Empty:** "No offers yet. Make an offer from a startup in your pipeline once diligence is done." with **Open pipeline**.
- **Startup has no open round:** **New offer** disabled for that startup with the reason.
- **Expiring offer:** warning chip and a reminder; **Extend** or **Withdraw** options.
- **Counter received:** gold-tint banner "You have a counter from {Startup}" with **Review counter**.
- **Awaiting internal approval:** shows approvers and who still needs to approve.
- **Limit reached:** plan limits on active offers, with an upgrade link.
- **Not verified or level too low:** offer creation disabled with the banner (A6).

---

# Part C. Offer Detail: `/investor/offers/:offerId`

## C1. Purpose
The working page for one offer: the terms, how they compare with the startup's target, the negotiation, the documents and the status. It is the investor's side of the shared offer record.

## C2. Header
Startup logo and name, round, offer amount, instrument, status chip, version chip, expiry date. Actions by state:
- Draft: **Edit**, **Submit for approval**, **Send offer**, **Delete draft**
- Sent or under review: **Edit terms (new version)**, **Withdraw**, **Message**, **Extend expiry**
- Countered: **Review counter**, **Accept counter**, **Make new version**, **Decline counter**
- Accepted: **Proceed to documents**, **Record commitment**
- Closed or declined: **Duplicate as new offer**, **Export summary (PDF)**

Tabs: **Terms** · **Comparison** · **Negotiation** · **Documents** · **Approvals** · **History**. The disclaimer (A5) appears under the header.

## C3. Terms tab
- Grouped term rows (A5): **Economics** (amount, instrument, valuation or cap, discount, interest), **Control** (board seat, protective provisions, information rights), **Protection** (liquidation preference, anti-dilution, pro-rata), **Structure** (option pool, vesting, conditions), **Process** (exclusivity, expiry, expected closing).
- Each row: your term, the startup's target (if shared), the difference marker, the previous version value when changed (in `--gold-tint`), and a definition tooltip.
- **Ownership and dilution:** the A5 bar for pre-round and post-round ownership, with a scenario toggle (Your offer only, Your offer plus other committed investors, Target raise). Label: "Estimate. Confirm with the startup's lawyer."
- **Binding or non-binding:** each term shows a small label (`Non-binding`, `Binding if signed`) based on the document; a caption points to the term sheet text.

## C4. Comparison tab
- **Your offer vs the startup's target terms** (if shared): table with differences marked, and a summary line ("5 terms match, 3 differ in the startup's favor, 2 differ in your favor").
- **Your offer vs other offers in the round:** only what the startup chooses to disclose; by default, nothing is shown about other investors' terms. If the startup shares anonymized round information (for example, the valuation range of the round), it appears here with a source label.
- **Version comparison:** pick two versions and see changes side by side.

## C4a. Terms the platform highlights as unusual
A small, neutral panel can flag items that are far from common ranges in the platform's aggregated, anonymized data (for example, a very high liquidation preference), labeled `General information, not advice`. Investors can hide the panel. It never changes the offer or blocks sending.

## C5. Negotiation tab
- **Thread:** messages tied to this offer, grouped by version; system events appear inline ("You sent v1", "{Startup} countered with v2", "You accepted v2").
- **Counter review:** when the startup counters, a clear diff of their changes against your last version, with **Accept**, **Counter back** (creates a new version with changes highlighted) and **Decline**.
- **Reasoning notes:** a short note on each change (required for counters; up to 500 characters) so both sides understand the why.
- **Meeting link:** **Schedule a call** goes to Meetings with this offer attached.
- **Internal discussion** (private): a separate thread visible only to your organization for deliberation; never shown to the startup.

## C6. Documents tab
- **Term sheet** (current version, PDF) with signature status per party.
- **Definitive documents:** investment agreement, shareholders' agreement, articles amendment, disclosure schedule, side letters, board consent, closing checklist. Each shows status (`Not started`, `Drafting`, `In review`, `Signed`), who is responsible and a due date.
- **Upload and share** documents with the startup (view and comment; signing happens through the signing method both parties choose, or an integrated e-signature tool).
- Version history for each document.
- Reminder: "Have your lawyer review these documents."

## C7. Approvals tab (organizations)
- Approval chain: required approvers, status (Pending, Approved, Rejected), date, comment.
- Thresholds: for example, offers above ₹X need two approvals, set by the organization.
- **Request approval** and **Reminders**. An approval is bound to a specific version, and a changed version restarts it.
- Separation of duties (A9): the creator cannot be the only approver.

## C8. History tab
Audit-style timeline: created, edited, approved, sent, viewed by the startup, countered, accepted, declined, withdrawn, extended, document uploaded and signed, commitment recorded. Each with user and time. **Export history (PDF)** for the investor's records.

## C9. Actions and confirmations

| Action | Behavior |
|---|---|
| **Send offer** | Re-authentication; confirmation text about non-binding status; sends version 1 |
| **Edit after sending** | Creates a new version; the startup is notified; the earlier version stays in history |
| **Withdraw** | Reason required (Changed plans, Diligence concerns, Terms not agreed, Other); optional message; the startup is notified; can't withdraw after both sides signed binding documents without following the document terms |
| **Extend expiry** | New date (must be later than the current one); the startup is notified |
| **Accept counter** | Re-authentication; confirmation of the final terms; status becomes `Accepted`; prompts for next steps |
| **Decline counter** | Optional message; offer stays open at your last version unless you also withdraw |
| **Record commitment** | Opens the commitment form (Part D) with terms prefilled |

## C10. States
- **Draft with missing fields:** inline checklist at the top ("Add an expiry date").
- **Startup viewed:** `Viewed` chip with date; no "read" pressure messages.
- **Startup silent for 7 days:** gentle prompt to follow up by message or call.
- **Round closed or startup paused visibility:** read-only banner "This round is closed" or "This startup paused visibility"; existing records stay.
- **Other offer accepted by the startup:** banner "{Startup} accepted another offer. Your offer is now closed." (shown if the startup shares this; otherwise `Closed`.)
- **Offer expired:** chip and **Revive as new version** (creates a fresh draft).
- **Conflict or restricted startup:** if the organization flagged a conflict, the page is read-only and sending is disabled.
- **Not verified or level too low:** actions disabled with the banner (A6).

---

# Part D. Commitments: `/investor/commitments`

## D1. Purpose
Tracks amounts the investor has committed, whether the documents are signed, whether funds have been sent and received, and what remains before each round closes. It replaces ad hoc spreadsheets.

## D2. Layout
Header with title and **+ Record commitment** (for deals made outside the platform; marked "Manual entry"). Summary strip, tabs, toolbar, table, and a side column.

### Summary strip
| Stat | Example |
|---|---|
| Total committed | ₹1.2 Cr |
| Funds sent | ₹70L |
| Funds pending | ₹50L |
| Rounds closing in 30 days | 2 |
| Documents awaiting you | 3 (warning tint when above zero) |

### Tabs
**Active** · **Awaiting funds** · **Closed** · **Cancelled**. Toolbar: search, filters (startup, round, status, date), sort (Closing date, Amount, Startup name).

## D3. Table
| Column | Content |
|---|---|
| Startup and round | Mini-card and round name |
| Amount | Committed amount, instrument |
| Linked offer | Offer ID and version (click to open) |
| Commitment status | Chip (A5) |
| Documents | Progress ("4 of 6 signed") |
| Funds | Sent, received, pending amounts, expected date |
| Closing date | Expected closing, with a warning chip when near and incomplete |
| Owner | Team member |
| Actions | **Open**, **Update status** |

## D4. Commitment detail drawer or page: `/investor/commitments/:commitmentId`

### Header
Startup, round, amount, instrument, status chip, linked offer, expected closing date. Actions: **Update funds status**, **Upload document**, **Message**, **Cancel commitment**.

### Sections
1. **Terms summary:** final terms from the accepted offer (read-only), ownership estimate (A5), valuation, key rights.
2. **Closing checklist:** shared with the startup, each item with owner and status:
   - Term sheet signed
   - Diligence completed (your confirmation)
   - Definitive documents signed
   - Corporate approvals and board consents
   - Regulatory filings and notices (owner: startup or both, per your lawyers)
   - Know-your-investor and anti-money-laundering checks completed
   - Payment instructions confirmed
   - Funds sent
   - Funds received (confirmed by the startup)
   - Share certificates or instrument issued
   - Cap table updated (by the startup)
   - Investor rights and information access set up
3. **Funds tracker:**
   - Tranches (if staged): amount, due date, status (`Pending`, `Sent`, `Received`, `Failed`).
   - **Mark funds sent:** amount, date, payment reference (masked), and an optional proof file; requires re-authentication; the startup is notified.
   - **Confirm receipt** is done by the startup; the status changes to `Received` only then.
   - Reminder: "The platform doesn't move or hold funds. Use the payment instructions agreed with the startup and your lawyers, and verify them through a second channel to avoid fraud."
4. **Documents:** signed and pending documents with signature status; links to Offer Detail documents.
5. **Conditions and milestones:** conditions precedent and any milestone-based tranches, each with a status and the evidence.
6. **Activity:** timeline of status changes, documents and messages.

## D5. Updating status
- **Record commitment:** from an accepted offer; amount and instrument prefilled; requires re-authentication; sends to the startup for confirmation. The status shows `Committed` after the startup confirms.
- **Cancel commitment:** reason required; follows the documents' terms; the startup is notified; opens a thread with support if funds were already sent.
- **Disputes:** **Report an issue** (for example, funds sent but not marked received) opens a ticket with the relevant records attached; the platform's role is to provide records, not to arbitrate legal disputes.

## D6. Side column
- **Closing calendar:** upcoming closings, signature deadlines and tranche dates.
- **Needs attention:** documents awaiting your signature, funds due, startup requests for information, rounds closing soon with incomplete items.
- **Fraud and safety tips:** short checklist (verify payment details by phone, never change bank details by email, report suspicious requests) with **Report a concern**.

## D7. States
- **Empty:** "No commitments yet. They appear after an offer is accepted." with **View offers**.
- **Funds overdue:** warning chip with a reminder and a suggested message to the startup.
- **Startup marks funds not received:** banner with **Update details** or **Contact support**.
- **Round closed:** summary with documents and a **Download closing summary (PDF)**; the commitment moves to Closed and the company is added to the Portfolio (Part E).
- **Manual entry:** records without platform links show a "Manual entry" tag and limited checks; they are not confirmed by a startup unless the startup is on the platform and confirms.
- **Not verified or level too low:** recording and fund actions disabled with the banner (A6).

---

# Part E. Portfolio: `/investor/portfolio`

## E1. Purpose
A simple, regular picture of the companies the investor funded through the platform (and any manually added holdings): status, latest updates, key numbers and what needs follow-up.

## E2. Layout
Header with title, **+ Add holding** (a startup funded outside the platform; marked "Manual entry"), view toggle (**Cards**, **Table**, **Performance**), and a summary strip. Toolbar with search and filters.

### Summary strip
| Stat | Example |
|---|---|
| Companies | 9 |
| Total invested | ₹3.4 Cr |
| Reported value (as reported by startups) | ₹4.1 Cr |
| Updates overdue | 2 (warning tint when above zero) |
| Follow-on opportunities | 1 |

The "reported value" is calculated from information the startups reported (for example, last round valuation and the investor's ownership). It is clearly labeled `Based on startup-reported data` with the method in a tooltip, and the page never presents it as a market value or a performance claim.

### Toolbar
Search, filters (stage, sector, status, update status, round year, owner), sort (Last update, Amount invested, Name, Next report due).

## E3. Cards view
Each company card:
- Logo, name, stage pill, sector, location
- Your investment: amount, instrument, date, estimated ownership
- Status chip: `Active`, `Follow-on open`, `Exited`, `Written off` (startup-reported or investor-marked), `Inactive` (no update for 6 months)
- Latest key numbers shared with investors (for example, MRR, runway, headcount) with source labels and dates
- Update freshness: "Updated 12 days ago" with a warning chip when overdue
- A one-line highlight from the latest investor update
- Actions: **Open**, **Message**, overflow (Add note, Mark as exited, Request update)

## E4. Table view
Columns: company, stage, invested, date, ownership (estimate), instrument, latest MRR, runway, last update, next report due, status, owner, actions. CSV export (own data only).

## E5. Performance view
- **Portfolio composition:** by stage, sector and year invested (bars; ink, gold, stone-400; no more than three colors in one chart).
- **Invested over time:** line or bars by year.
- **Reported value vs invested:** simple bars per company with the label "Startup-reported. Not a market valuation."
- **Update freshness:** a small grid of companies by last update age (Fresh, Aging, Overdue).
- **Concentration warning:** a neutral note when one company exceeds a share of the portfolio set by the investor (for example, 30%).
- Every chart has a source label, a text summary and a **View as table** toggle. No forecasts or return promises.

## E6. Updates feed
A chronological feed of investor updates across companies (new report, milestone, new round, key hire, issue raised), with company, summary, date, and **Open**. Filters by company and type. **Mark as read**. Daily or weekly digest option.

## E7. Follow-on opportunities
When a portfolio company opens a new round, a card appears with the round summary, whether pro-rata rights apply (from the signed terms) and **View round** (opens the startup profile or offer flow). Labeled "Opportunity from your portfolio," not a recommendation.

## E8. Exits and write-offs
- **Mark as exited:** date, type (Acquisition, Secondary sale, IPO, Other), amount received (optional), notes.
- **Mark as written off:** date, reason (optional).
- These are investor-recorded entries labeled "Recorded by you" until the startup confirms its side where relevant.

## E9. States
- **Empty:** "No portfolio companies yet. Companies appear here after a round closes with your commitment." with **View commitments** and **+ Add holding**.
- **Startup stopped sharing updates:** card shows "No updates in 6 months" with **Request update** (limited to once a month).
- **Startup closed or paused its profile:** card shows the last information you had and a note.
- **Manual holdings:** marked "Manual entry"; no startup-provided data; editable by the investor.
- **Not verified or suspended:** read-only view of existing holdings with the banner (A6).

---

# Part F. Portfolio Company Page: `/investor/portfolio/:startupId`

## F1. Purpose
One company's investor view after the deal: regular updates, key numbers, documents, board reports and the investor's holding. It is the investor's side of what the startup shares through its investor reporting.

## F2. Layout
Left main column (8 col), right sticky panel (4 col). A banner at the top: "Showing what {Startup} shares with its investors. Updated {date}." Tabs: **Overview** · **Updates and reports** · **Metrics** · **Round and cap table** · **Documents** · **Meetings and notes**.

### Header
Logo, name, tagline, stage pill, status chip, sector, location, your investment summary (amount, date, estimated ownership), **Message**, **Request update**, overflow (Add private note, Mark as exited, Report).

## F3. Tabs

### Overview
- **Latest update:** the most recent investor update, summarized (highlights, lowlights, asks), with date and **Read full update**.
- **Key numbers:** four tiles of metrics the startup shares with investors (for example, MRR, customers, runway, headcount) with change, source label and date.
- **Milestones:** timeline of milestones reached and upcoming ones from the startup's plan (only if shared).
- **Asks from the company:** requests from the founders (introductions, hiring help, advice). **Offer help** replies via Messages; this is voluntary and framed that way.
- **Your holding:** amount invested, instrument, valuation or cap at entry, estimated ownership, rights you hold (information rights, pro-rata, board seat or observer), with a link to the signed documents.

### Updates and reports
- **Investor updates** (monthly, quarterly) in a list; each opens a clean reader with sections (highlights, KPIs, challenges, plans, asks) and attachments. **Mark as read**, **Add private note**, **Reply** (to the startup).
- **Board and investor reports:** board packs and quarterly reports shared by the startup (view-only unless the startup allows download), with the same watermarking and logging as the data room.
- **Update cadence:** the startup's reporting schedule, the next expected date, and a chip for overdue updates. **Request update** (limited to once a month).

### Metrics
- Charts the startup shares with investors: MRR and growth, customers and churn, burn and runway, headcount. Each has a source label, a "View as table" toggle and a definition tooltip. Missing metrics show "Not shared".
- **Compare with your other portfolio companies:** optional overlay for like metrics (for example, growth), shown only for your own holdings and labeled "Your portfolio only."
- No forecasts or ratings generated by the platform.

### Round and cap table
- **Rounds:** list of rounds the company raised, with your participation, date, amount and instrument.
- **Cap table share:** only what the startup shares with investors (for example, your holding and fully diluted percentages, and aggregated groups: founders, ESOP, investors). Shown as the A5 bar plus a table. If the startup does not share the full cap table, the page says so. Estimates are labeled; the startup's cap table is the record.
- **Dilution view:** simple illustration of how a new round would change your percentage (investor-entered scenario), labeled "Illustration only."
- **Rights and obligations:** summary of your rights (pro-rata, information, board) and deadlines (for example, the window to exercise pro-rata) with reminders.

### Documents
Documents shared with investors: signed investment documents, board minutes, financial statements, certificates (view-only, watermarked, downloads only where allowed). Folders and "New since your last visit" chips. **Request a document** sends a request to the startup. Your own uploaded documents (private to your organization) are in a separate section.

### Meetings and notes
- **Meetings:** past and upcoming meetings with this company (from Meetings) and **Schedule meeting**.
- **Private notes:** your organization's notes on this company, with visibility settings (Private to me, Shared with my team); never shown to the startup.
- **Follow-ups:** reminders and tasks linked to the company.

## F4. Right sticky panel
- **Status:** company status, your relationship ("Investor since Nov 2026"), update freshness.
- **Next dates:** next update due, next board meeting (if shared), pro-rata window end.
- **Quick actions:** **Message**, **Schedule meeting**, **Offer help**, **Request update**.
- **Holding summary:** invested amount, ownership estimate, instrument, rights.
- **Contacts:** founders and the investor relations contact (only what the startup shares).
- **Disclaimer** (A5).

## F5. States
- **Limited sharing:** many "Not shared" labels with a gentle note: "Your rights may let you request more information. Check your agreement." with **Request update**.
- **Overdue updates:** warning banner "No update for 4 months." with **Request update**.
- **Startup paused sharing or restricted access:** read-only snapshot of what you already had; the page explains the change.
- **Round closing for the company:** card with round summary and pro-rata info (Part E7).
- **Exited or written off:** header shows the status; the page becomes a record with documents and final updates.
- **Manual holding:** no startup data; the page shows only your own records and notes, with a prompt to invite the startup to the platform if it isn't there.
- **Data load error:** per-section error cards with **Retry**; other sections remain usable.
- **Not verified or suspended:** read-only with the banner (A6).

---

# Part G. Notifications for these pages

| Event | Channel |
|---|---|
| Offer viewed, countered, accepted, declined or expired by the startup | In-app, email, push for counters and acceptance |
| Offer expiring in 7 days and 48 hours | In-app, email |
| Internal approval requested or completed | In-app, email |
| Document uploaded or awaiting signature | In-app, email |
| Commitment confirmed by the startup | In-app, email |
| Funds marked received by the startup | In-app, email |
| Closing date approaching with incomplete items | In-app, email |
| Round closed | In-app, email |
| New investor update, board report or document from a portfolio company | In-app, email, daily or weekly digest |
| Portfolio company update overdue | In-app |
| Portfolio company opens a new round (pro-rata window) | In-app, email |
| Pro-rata or other rights deadline in 14 days | In-app, email |
| Request for help from a portfolio company | In-app |

Investors can mute, filter or set digests in Settings. Security alerts cannot be muted. Notification text and email subjects never include amounts or valuations ("A new counter was received" instead of the figures).

---

# Part H. Data and validation

| Field | Rule |
|---|---|
| Offer amount | Greater than zero; currency required; not above the investor's configured limit without extra approval |
| Instrument terms | Valuation or cap required for equity and SAFE; interest and maturity required for notes |
| Offer expiry | At least 2 days ahead; not after the round's closing date unless extended |
| Cover note | Up to 1,000 characters; no external payment links or off-platform contact details |
| Counter reasoning | Required, up to 500 characters |
| Withdraw reason | Required; optional message |
| Approvals | Approver must be an authorized member; the creator can't be the only approver |
| Documents | PDF, DOCX, up to 25 MB each, virus scanned |
| Commitment amount | Cannot exceed the offer amount unless a new version is accepted |
| Funds sent | Amount, date and reference required; proof optional; re-authentication |
| Tranches | Sum equals the commitment; each has a date |
| Portfolio holding (manual) | Startup name, amount, date, instrument required |
| Request update | Limited to once a month per company |
| Exports | Only the investor's own data and fields visible to them |

**Audit log:** offer creation and every version, approvals, sends, views by the startup, counters, accepts and declines, withdrawals, document uploads and signatures, commitments, funds status changes, portfolio edits, exports, each with user and time. Records follow the platform's retention policy and applicable law, and are available to both parties for the shared parts of the record.

---

# Part I. Data connections

| Feature | Connected to |
|---|---|
| Investor verification, KYC level and eligibility | Admin console, investor application and verification |
| Pipeline stage and diligence | Deal Pipeline and Diligence Workspace |
| Startup's round, target terms, offers received | Startup Fundraising Rounds and Round Detail (`/startup/rounds`) |
| Offer messages and negotiation | ERP chat service, Messages |
| Documents and signatures | Document service, e-signature integration (if used) |
| Commitment confirmation and funds receipt | Startup Round Detail (commitments), startup confirms |
| Cap table | Startup Finance and cap table (updated by the startup when a round closes) |
| Portfolio updates, reports and metrics | Startup investor reporting (Mature stage board and investor reporting), startup analytics (shared fields only) |
| Meetings | Investor Meetings, startup Meetings |
| Notifications and digests | ERP notification service |
| Organization roles, approvals and sharing | Investor team and organization |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part J. CSS tokens

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

# Part K. Build order (suggested)

1. Role guard, KYC and eligibility checks, organization roles and approvals (Part A9), including the verification banners.
2. Shared components: offer and commitment chips, term row, ownership bar, version history.
3. **Offer data model and audit log** (versions, approvals, status transitions, re-authentication) before any UI.
4. **Offers and Term Sheets** and the create-offer flow.
5. **Offer Detail** (terms, negotiation, documents, approvals), connected to the startup's Round Detail so both sides see the same record.
6. **Commitments** with the closing checklist and funds tracker (startup confirmation required).
7. **Portfolio**, then **Portfolio Company Page**, once the startup's investor reporting exists.
8. Notifications, comparison panel, exports, disputes flow.
9. Empty, loading and error states, then mobile layouts.

**Suggested first release:** Offers and Term Sheets, Offer Detail (terms, negotiation, documents) and Commitments with a simple closing checklist. Add the full Portfolio and Portfolio Company pages after the first round closes and startups begin sending investor updates. Your proposal's success fee on rounds closed through the platform depends on these records, so build the offer and commitment audit trail carefully and have it reviewed by legal counsel.

**Reminder for the build:** every route above is investor-only and role-based. Add the guard, KYC and eligibility checks first. Require re-authentication for sending and accepting offers, recording commitments and funds. Require the startup's confirmation for commitments and receipt of funds. Keep notes, approvals and internal discussion private to the investor's organization, filter startup data on the server by what the startup shares, and write every offer, commitment and fund status change to the audit log. Get legal advice on investor eligibility rules, registration, term sheet and document templates, e-signature, funds handling and fee structures before launch.
