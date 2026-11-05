# Mentor Money and Recognition Pages Design

The pages where a mentor gets paid, manages the terms of each mentorship, builds a public impact record, and gets priority access to investor events. These match the mentor incentives in your proposal: paid sessions, equity or advisory share where agreed, a public impact record, and priority access to investor events. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Mentor role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user has the `mentor` role and a verified mentor profile. Money pages carry extra protection: they show only the signed-in mentor's own financial data. Details are in **Part A9**. Do not show these pages to startups, investors, job seekers or employers.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Earnings and Payouts | `/mentor/earnings` | Session fees, commission, payout method, invoices, tax documents |
| 2 | Agreements | `/mentor/agreements` | Fee terms, equity or advisory shares, version history, accept or propose changes |
| 3 | Impact and Reviews | `/mentor/impact` | Public impact record: startups helped, stages reached, badges earned, reviews received |
| 4 | Investor Events | `/mentor/events` | Priority access to investor events, registration, upcoming and past |

Related pages already designed: Mentor Core (`mentor-core-design.md`) and Sessions and Sign-off (`mentor-sessions-signoff-design.md`). The startup's side of payments is in `startup-mentor-design.md` (Payments and Agreements); the pages here are the mentor's side of the same agreements and payment records.

---

# Part A. Shared foundations

## A1. Design principles

- **Money is plain and exact:** every amount shows what it is, how it was calculated and when it will arrive. No hidden deductions.
- **Terms in writing:** fees, commission and any equity or advisory share live in a recorded agreement with versions, not in chat.
- **Recognition is earned and verifiable:** impact numbers come from real mentorships, sign-offs and reviews, never self-reported claims.
- **Mentor controls what's public:** the public impact record shows only what the mentor and the startups agreed to show.
- **Calm tone:** no gamified pressure. Badges and rankings are factual, not competitive.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, current point, badges, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlights, badge backgrounds, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, gridlines |
| `--success` | `#2E7D5B` | Paid, accepted, active |
| `--warning` | `#B7791F` | Pending, action needed |
| `--error` | `#B42318` | Failed, disputed, errors |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, with tabular figures for amounts.
- Page title 28px serif; KPI number 32px serif 600; card title 16px Inter 600; body 14px; caption 12px `--stone-700`.
- Currency: ₹ with Indian grouping by default (for example, ₹36,000, ₹1.2L), configurable in Settings. Show the currency code when more than one currency exists.

## A4. Shared layout

Desktop (≥ 1200px): the mentor sidebar and top bar from the other mentor pages, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar, tables become cards, sticky bottom action button.

## A5. Shared components

### KPI card
Label (caption), big serif number, change chip ("▲ 12%"), small sparkline (ink, last point gold). Tooltip shows the definition and formula.

### Status chips
- **Payments:** `Pending` (warning tint), `Processing` (ink outline), `Paid` (success tint), `Failed` (error tint), `Refunded` (stone), `Disputed` (error outline), `On hold` (stone outline).
- **Agreements:** `Draft` (stone), `Proposed` (warning tint), `Active` (success tint), `Amended` (ink outline), `Ended` (stone outline), `Disputed` (error outline).
- **Events:** `Open` (success tint), `Invite only` (gold-tint), `Waitlist` (warning tint), `Registered` (ink fill), `Full` (stone), `Past` (stone outline).

### Amount breakdown
A small table used wherever money appears: Session fee, Platform commission (with percent), Taxes (if applicable), **Net to you** (bold). Each line has an info tooltip. Never show only a net amount.

### Data source chip
Small chip on cards and charts: `Calculated`, `From agreement`, `From payment provider`, with "Updated 2 hours ago."

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | "Saved · just now" on drafts; confirmation toast on changes |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner: "Your mentor profile is under review. Payments, agreements and events open after approval." Pages are visible but actions are disabled |
| Payout details missing | Banner on Earnings: "Add a payout method to receive payments." with **Add payout method** |
| Suspended | Read-only pages with a banner and **Contact support** |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; charts animate once on load (600ms). Money values never animate as counters. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Every chart has a text summary and a **View as table** toggle.
- Tables use proper `th` and `scope`; amounts are right-aligned and announced with their currency.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Privacy, finance and conduct rules

- A mentor sees only their own earnings, agreements and payouts. Nothing here exposes other mentors' data.
- Bank and payout details are encrypted, masked on screen (for example, "•••• 4417"), and never shown in full after saving. Changing payout details requires re-authentication and sends a security alert by email.
- The platform shows tax documents it generates, but it does **not** give tax, legal or accounting advice. Mentors should confirm their own obligations (for example, income tax and GST or TDS rules that apply to them) with an accountant.
- Equity or advisory shares are recorded as terms in an agreement. The platform records terms and does not give legal advice. Mentors and startups should review equity terms with a lawyer.
- Impact and review content is verified from platform records. Reviews can't be bought, edited by the mentor, or removed except through a moderation process.
- Investor events follow the platform's securities and introduction rules: the platform introduces parties and is not a broker or adviser unless licensed.

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users with the `mentor` role can open any `/mentor/...` route |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, investor, job seeker, employer users see a 403 page ("This page is for mentors") with a link to their own home; no mentor data is fetched or rendered |
| **Multi-role users** | A founder or job seeker who is also a mentor sees the role switcher; switching changes the sidebar and routes between `/startup/...` and `/mentor/...` |
| **Mentor not yet approved** | Pages open read-only with the verification banner; payout setup, agreement acceptance and event registration are disabled |
| **Financial data scope** | Earnings, payouts, invoices and tax documents are returned only for the signed-in mentor's own account; the server filters by mentor ID, never trusting an ID in the URL or request body |
| **Agreement access** | `/mentor/agreements` and agreement details open only for agreements where the mentor is a party; any other ID shows 404 |
| **Sensitive actions** | Changing payout details, accepting equity or advisory terms, and requesting a payout require re-authentication (password or second factor) |
| **Public impact page** | The public view of the impact record is the only part visible to other roles, and only with the mentor's consent and verified data |
| **Event eligibility** | Event access depends on mentor status (verified, impact tier, invite) and is checked on the server |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner, and can resolve payment and agreement disputes |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Earnings and Payouts: `/mentor/earnings`

## B1. Purpose
Shows what the mentor has earned, what is pending, what has been paid out and where the money goes. It also holds payout setup and tax documents.

## B2. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Earnings"     [Date range] [Export]    │
│          ├────────────────────────────────────────────────┤
│          │  Tabs: Overview · Payments · Payouts ·         │
│          │        Invoices and tax · Payout settings      │
│          ├────────────────────────────────────────────────┤
│          │  KPI row (4 cards)                             │
│          ├───────────────────────────────┬────────────────┤
│          │  Charts and tables (8 col)    │ Side (4 col)   │
│          │                               │ Next payout    │
│          │                               │ Alerts         │
└──────────┴───────────────────────────────┴────────────────┘
```

## B3. Global controls
- **Date range:** This month, Last 3 months, This financial year, Custom. The financial year start (April by default for India) is set in Settings.
- **Export:** CSV (payments), PDF (statement). Exports contain only the mentor's own data.
- **Last updated** caption.

## B4. Overview tab

### KPI row
| Card | Example |
|---|---|
| Earned this month | ₹36,000, ▲ 12% |
| Pending | ₹9,000 (sessions completed, payment not yet released) |
| Paid out (financial year) | ₹2.4L |
| Next payout | ₹27,000 on 10 Nov |

### Charts
1. **Earnings over time:** bars by month (ink), with the current month highlighted in gold; toggle Net / Gross.
2. **Earnings by startup:** ranked bars with a share percentage; useful for seeing concentration.
3. **Sessions vs earnings:** sessions held (ink line) vs net earnings (gold bars), to show the average earned per session.
4. **Fee type mix:** per-session fees, package credits, and other (stacked bar). Equity or advisory shares are shown in the Agreements page, not as income.

### Side column
- **Next payout card:** amount, date, destination (masked payout method), status, **View details**.
- **Needs your attention:** payout details missing, failed payout, dispute open, tax form needed, agreement awaiting acceptance.
- **How payouts work:** a short collapsible explanation (release timing, commission, minimum payout), with a link to the payout policy.

## B5. Payments tab
Table of every session or package payment:

| Column | Content |
|---|---|
| Date | Session date and payment date |
| Startup | Logo and name |
| Item | Session topic or package name |
| Gross | Fee charged to the startup |
| Commission | Platform commission with percent |
| Tax | If applicable |
| Net | Amount to the mentor |
| Status | Payment chip (A5) |
| Receipt | Download |

Row click opens a **drawer** with the amount breakdown (A5), the agreement the fee comes from, the session link, payment timeline (charged, held, released, paid out), and **Report an issue** (for example, a missing payment or an unexpected deduction). Filters: startup, status, date range, fee type. Totals row at the bottom.

## B6. Payouts tab
Table of payouts: payout ID, date, amount, method (masked), status, included payments count, reference number, statement download. A payout drawer lists the included payments and the date each was released.

**Request payout** (if the platform allows on-demand): shows the available balance, any minimum amount, the fee (if any) and the expected arrival date. Requires re-authentication.

Payout schedule: shown plainly (for example, "Payments are released 7 days after a completed session and paid out on the 10th and 25th"). The exact schedule is set by the platform.

## B7. Invoices and tax tab
- **Invoices:** list of invoices generated for the mentor's sessions and packages (number, date, startup, amount, tax, download PDF). The page states clearly who the invoice is issued by, depending on the platform's model.
- **Tax documents:** statements and certificates the platform generates, for example an annual earnings statement and any tax-deduction certificates, by financial year, with **Download**.
- **Tax details form:** legal name, PAN or tax ID, GST registration (if applicable), address. Required before the first payout. Stored encrypted; masked after saving.
- Disclaimer: "The platform provides records. It does not give tax advice. Confirm your obligations with an accountant."

## B8. Payout settings tab
- **Payout method:** bank account (account holder name, account number, IFSC or equivalent) or other supported method. Shows the masked current method and verification status (`Verified`, `Pending`, `Failed`). **Change payout method** requires re-authentication and triggers a security email.
- **Payout preferences:** schedule (if options exist), minimum payout threshold, notification preferences.
- **Currency:** default and display currency.
- **Verification:** a small penny-drop or document-based verification where supported; clear errors if the name does not match the verified mentor profile.

## B9. States
- **No earnings yet:** "No earnings yet. Your first paid session will appear here." with **View sessions** and **Edit pricing** (links to the profile).
- **Payout details missing:** banner and disabled payout actions.
- **Payment failed or startup dispute:** the payment shows an error or disputed chip; the amount is on hold; a dispute thread with admin appears in the drawer.
- **Refund issued:** the payment shows `Refunded`; net earnings update, with a note explaining the reversal.
- **Payout failed:** banner with the reason (for example, invalid account), **Update payout method** and **Retry**.
- **Free or pro bono mentorships:** appear in the list with "No fee" and are excluded from earnings totals.
- **Partial data:** if the payment provider has not synced, a chip shows "Syncing. Some payments may be missing."

---

# Part C. Agreements: `/mentor/agreements`

## C1. Purpose
Every mentorship runs on a recorded agreement. This page shows all of a mentor's agreements and lets them accept, propose changes, review versions and see what each agreement means in money and responsibilities.

## C2. Layout
Tabs: **Active** · **Awaiting you** · **Proposed by you** · **Ended** · **All**. Toolbar: search by startup, filters (type, status), sort (Latest activity, Startup name, Start date). **Create agreement template** (for default terms) in the header menu.

## C3. List
Table or cards: startup logo and name, agreement type, key terms summary (for example, "₹3,000 per session · fortnightly · 6 months"), equity or advisory share (if any), start date, end or renewal date, status chip, last updated, actions (**Open**, **Accept**, **Propose change**).

## C4. Agreement detail: `/mentor/agreements/:agreementId`
Opens as a full page on desktop, with a left main column (8 col) and a right panel (4 col).

### Header
Startup name, status chip, version (for example, "v3"), start date, linked mentorship (**Open workspace**), actions (**Accept**, **Propose change**, **Request to end**, **Download PDF**).

### Sections
1. **Summary:** plain-language card with the key terms in one place, so nothing is buried in the document.
2. **Fees and payments:**
   - Fee model: per session, package, monthly retainer, or free
   - Rate and currency, package sizes and expiry
   - Cancellation and no-show rules (for example, free cancellation up to 24 hours before)
   - Platform commission shown plainly (a read-only line with the percent)
   - Payment timing (when the mentor is paid after a session)
3. **Equity or advisory share (if any):**
   - Type (advisory shares, options, warrants, other), percentage or number, vesting schedule and cliff, conditions (for example, tied to specific sign-offs or milestones), exit and termination effects
   - Caption: "Equity terms have legal and tax consequences. Review them with a lawyer. The platform records terms and does not give legal advice."
   - A visual vesting timeline (ink bar with gold cliff marker)
4. **Scope and responsibilities:** focus areas, expected deliverables, session cadence, expected response times, what the startup must provide (access to documents, data).
5. **Confidentiality and conduct:** confidentiality commitments, conflict-of-interest declaration, no-sign-off-for-benefit rule, data-handling summary.
6. **Duration and ending:** start date, term, renewal, notice period, how either side can end it, what happens to files and open sign-offs.
7. **Signatures and acceptance:** who accepted, when, from which account, and an acceptance log.
8. **Version history:** each version with date, who proposed it, a plain-language change summary and a **Compare** view (side-by-side with changes in `--gold-tint`).

### Right panel
- **Status and next action:** for example, "Waiting for {Startup} to accept your proposal."
- **Key dates:** start, next review, end.
- **Linked records:** mentorship, sessions held, earnings under this agreement (link to Earnings filtered by this startup).
- **Need help:** link to the agreement guide and support.

## C5. Propose change (drawer)
- Choose which sections to change (fees, equity or advisory share, scope, duration).
- Editable fields with the current value shown beside the new one.
- Required reason (20–500 characters).
- Preview of the new summary and an automatically generated change list.
- **Send proposal** (primary). The agreement stays active under the current version until the other side accepts.

## C6. Accept (modal)
- Shows the final summary and any changes since the last accepted version.
- Checkbox: "I've read the agreement and understand the terms."
- For equity or advisory terms: second checkbox, "I understand I should get legal advice on these terms," and a re-authentication step.
- **Accept agreement** (primary).

## C7. Ending an agreement
**Request to end** opens a modal: reason (Completed, Not a fit, Capacity, Dispute, Other), proposed end date within the notice period, and a closing note. The other side confirms or discusses. Ending triggers: open sign-offs to be completed or handed over, files access removed, final payment summary, and an optional final review request.

## C8. Templates
A mentor can save default terms (fee model, cadence, standard scope) as a **template** that pre-fills new proposals. Templates are private to the mentor and never include startup-specific data.

## C9. States
- **No agreements yet:** "Agreements appear when you accept a startup." with **View requests**.
- **Awaiting you:** warning banner at the top and a count in the sidebar.
- **Proposed change pending:** both versions shown with a clear "Currently active" label.
- **Disputed:** chip and thread with admin; payments for disputed items can be placed on hold per the agreement.
- **Expired or auto-renewed:** banner with renewal terms and **Review renewal**.
- **Not verified:** actions disabled with the banner (A6).

---

# Part D. Impact and Reviews: `/mentor/impact`

## D1. Purpose
A verified record of the difference the mentor has made, and the public profile section built from it. It also holds reviews from startups.

## D2. Layout
Tabs: **My impact** · **Reviews** · **Public view**. A visibility banner at the top: "Public impact record: Visible" (or "Hidden") with **Manage**.

## D3. My impact tab

### KPI row
| Card | Example |
|---|---|
| Startups mentored | 14 (4 active) |
| Sessions delivered | 96 |
| Sign-offs granted | 38 |
| Investment Ready badges helped earn | 5 |

### Sections
1. **Startup outcomes:** table of startups mentored (only those that agreed to be shown, plus aggregated numbers for the rest): stage at start, stage now, readiness score change, badge earned (date), funding raised after mentoring (only if the startup chooses to share). A note explains that outcomes reflect many factors.
2. **Readiness progress chart:** average readiness score of mentored startups over time, before and after mentoring (paired line, ink and gold). Caption: "Correlation, not proof of cause."
3. **Stage progression:** how many startups moved up a stage during mentoring (stacked bar by stage).
4. **Time and responsiveness:** average response time, session attendance rate, summaries submitted on time, deliverable review time. Shown as facts, with simple green/neutral/warning text, not rankings.
5. **Expertise tags earned:** expertise areas backed by completed sign-offs and reviews (for example, "Unit economics: 12 sign-offs"). Tags are system-awarded, not self-declared.
6. **Milestone badges:** factual badges such as `First 10 sessions`, `5 Investment Ready startups`, `100 sessions`, `Top response time (last 90 days)`. Each shows the criterion and date. Gold-tint pill with a small icon; no ranking or leaderboard.
7. **Testimonials from startups** (opt-in by the startup): short quotes with startup name and date, each with a **Verified session** chip.

### Controls
- **Choose what appears publicly:** per startup outcome and per item toggles, defaulting to private until the startup consents.
- **Download impact summary (PDF)**, with a verification link that confirms the numbers are platform-generated.

## D4. Reviews tab

### Summary
Average rating (big serif number with stars), rating distribution (five horizontal bars), count of reviews, response rate to reviews.

### Review list
Each review: reviewer (startup name or "Anonymous startup", per the startup's choice), date, rating, written feedback, session or mentorship reference, **Verified session** chip, and the mentor's **public reply** (if any). Sort: Newest, Highest, Lowest. Filter: rating, startup, period.

- Reviews appear only after a completed session or mentorship; only one review per mentorship phase.
- **Reply publicly** (up to 500 characters; polite tone reminder). The mentor cannot edit or delete reviews.
- **Report a review:** for harassment, false claims, or personal data. Reported reviews go to moderation and stay visible until the decision unless they contain abusive or private content.
- **Private feedback** (optional, from startups): feedback only the mentor sees, shown in a separate section, never public.
- **Request a review:** a gentle button for completed mentorships where the startup hasn't reviewed (once, with a 14-day wait before a reminder). No incentives for positive reviews.

## D5. Public view tab
A preview of the public mentor impact section exactly as startups and investors see it on the mentor profile:
- Headline numbers (startups mentored, sessions delivered, badges helped earn)
- Selected startup outcomes (only consented ones)
- Expertise tags and milestone badges
- Rating and selected reviews
- A caption: "Verified by the platform. Data last updated {date}."

Buttons: **Edit visibility**, **Open public profile**.

## D6. States
- **New mentor, no data:** "Your impact record starts with your first mentorship." with **View requests**.
- **Few reviews:** "Ratings show after 3 reviews" to avoid unfair early swings (the individual reviews still show).
- **Low rating period:** private note with constructive guidance and a link to mentor resources, never public shaming.
- **Startup withdrew consent:** the outcome is removed from the public view, and aggregate numbers update.
- **Under moderation:** a review shows "Under review" to the mentor only.
- **Not verified:** page is visible with a banner; public view is off until approved.

---

# Part E. Investor Events: `/mentor/events`

## E1. Purpose
Mentors get priority access to events where startups meet investors, such as demo days, pitch evenings and investor office hours. The page lists events, handles registration, and shows what mentors can do at each.

## E2. Layout
Tabs: **Upcoming** · **My registrations** · **Invitations** · **Past**. Toolbar: search, filters (type, date range, location or online, sector, startup stage), sort (Soonest, Priority access first). A **featured event** card at the top for the next major one.

## E3. Event card
Cover band (solid ink with a thin gold rule, no stock photo), title, date and time (time zone shown), format (Online, In person, Hybrid) and location, host (platform, partner or investor group), sector and stage focus, number of startups and investors expected, access chip (`Priority access`, `Invite only`, `Open`, `Waitlist`, `Full`), registration status chip, actions (**View**, **Register**, **Add to calendar**).

**Priority access:** per your proposal, mentors get early registration and reserved places. The card shows a note such as "Mentors can register 3 days before general opening" and a countdown to when registration opens for them.

## E4. Event detail: `/mentor/events/:eventId`
Left main column (8 col), right sticky panel (4 col).

### Sections
1. **About:** description, agenda with times, speakers and investors attending (only those who agreed to be listed).
2. **Who's attending:** counts by type (startups, investors, mentors) and, where consented, a list of participating startups with stage and sector.
3. **Your startups at this event:** your mentored startups that applied or are invited, with their status (Applied, Selected, Presenting). Highlights those who are Investment Ready (badge shown).
4. **How mentors can take part:**
   - Attend and network
   - Join a mentor lounge or office hours
   - Pitch coaching slots (offer a 20-minute slot to a startup)
   - Recommend a startup (see E5)
5. **Logistics:** venue or link, joining instructions, accessibility notes, code of conduct, recording policy.
6. **Documents:** event brief, agenda PDF, participation guidelines.

### Right panel
- **Registration card:** status, **Register** or **Cancel registration**, plus-ones if allowed, and a registration deadline.
- **Seats:** "Mentor seats: 18 left" and, if applicable, waitlist position.
- **Add to calendar** and **Share with a startup**.
- **Contact organizer** and **Report a concern**.

## E5. Recommend a startup
Available for events with startup selection.
- Pick one of your active mentees who is Investment Ready (or near ready) and not already applied.
- Short endorsement (up to 280 characters; what stands out and what is verified, based on sign-offs).
- The recommendation is sent to the startup first; the startup decides whether to apply. If the event requires a mentor endorsement, the endorsement text is attached to their application.
- Limit: a few recommendations per event, to keep endorsements meaningful.
- Conflict check: "I have no financial interest in this startup beyond the recorded agreement" checkbox, with a note if unchecked.

## E6. Register (modal)
- Attendance type (Attend, Office hours, Pitch coaching)
- Dietary or accessibility needs (optional, only shown to organizers)
- Consent to share your name and expertise with attendees (optional)
- Confirmation of the code of conduct
- **Confirm registration** (primary)

Waitlist and cancellation: cancelling frees the seat; repeated no-shows can reduce priority access, and the page explains this in plain words before registering.

## E7. My registrations and Past
- **My registrations:** event, date, role (Attendee, Coach, Office hours), status, ticket or link, **Cancel**, **Add to calendar**.
- **Past:** attended events, your role, startups you supported, outcomes you chose to record (for example, "Introduced to two investors by the startup"), and any feedback form to complete. Certificates of participation can be downloaded where the organizer provides them.

## E8. Invitations tab
Invitations from the platform or organizers, with the reason ("Invited because 3 of your startups are Investment Ready"), deadline to respond, **Accept** or **Decline**.

## E9. States
- **No upcoming events:** "No events right now. We'll notify you when new ones open." with a notification toggle.
- **Priority window not open yet:** card shows the opening date and **Remind me**.
- **Full:** waitlist option with position and notification when a seat opens.
- **Not eligible:** a short reason ("Open to mentors with at least one Investment Ready startup") with the criteria; no negative language.
- **Event cancelled or changed:** warning banner, notification and a refund or rebooking note if tickets apply.
- **Online event starting soon:** a gold-tint banner with **Join** from 15 minutes before.
- **Not verified:** events visible, registration disabled with the banner (A6).

---

# Part F. Notifications for these pages

| Event | Who is notified | Channel |
|---|---|---|
| Payment received or released | Mentor | In-app, email |
| Payout sent, failed or delayed | Mentor | In-app, email |
| Payout details changed | Mentor | Email (security alert) |
| Tax document or statement available | Mentor | In-app, email |
| Agreement proposed, accepted, amended or ended | Both parties | In-app, email |
| Agreement renewal in 30 days | Both parties | In-app, email |
| Payment dispute opened or resolved | Mentor and startup | In-app, email |
| New review received | Mentor | In-app, email |
| Milestone badge earned | Mentor | In-app |
| Startup withdrew public consent | Mentor | In-app |
| Event opens for priority registration | Eligible mentors | In-app, email |
| Event reminder (1 day, 1 hour) | Registered mentors | In-app, email, push |
| Startup applied to an event after your recommendation | Mentor | In-app |

Mentors can mute, filter or set digests in Settings. Security alerts cannot be muted.

---

# Part G. Data and validation

| Field | Rule |
|---|---|
| Payout account | Account holder name must match the verified mentor name; account number and IFSC (or equivalent) validated before saving |
| Tax ID (PAN or equivalent) | Format validated; required before the first payout; stored encrypted |
| Minimum payout | Set by the platform; shown before requesting |
| Agreement fee | Greater than or equal to zero; currency required |
| Equity or advisory share | Percentage between 0 and the platform's allowed maximum; vesting schedule and cliff required if a share is included |
| Change proposal reason | Required, 20–500 characters |
| Agreement end | Notice period respected; end date after today |
| Review reply | Up to 500 characters; no contact details or promotional links |
| Public visibility | Startup outcomes appear only with the startup's consent |
| Event registration | Within the registration window; one registration per mentor per event |
| Recommendation | Up to 280 characters; startup must be an active mentee |
| Exports | Only the signed-in mentor's own data |

**Audit log:** payout method changes, tax detail changes, payout requests, agreement proposals, acceptances and endings, visibility changes, review replies and reports, and event registrations or cancellations, each with user and time. Financial records follow the platform's retention policy and applicable law.

---

# Part H. Data connections

| Feature | Connected to |
|---|---|
| Payments, commission, payouts | ERP billing, payment provider |
| Invoices and tax documents | ERP billing, tax and compliance settings |
| Mentor verification and tax details | Admin console, mentor profile |
| Agreements and terms | Mentor module, startup billing (`/startup/mentors/:mentorshipId/billing`) |
| Equity or advisory records | Startup cap table (updated by the startup when shares are granted) |
| Sessions and fees | Sessions module (`/mentor/sessions`) |
| Sign-offs and readiness data | Readiness module, startup profile |
| Reviews and ratings | Mentor module (verified sessions) |
| Public impact record | Mentor public profile, startup consent settings |
| Events and registrations | Admin console (events), calendar, notification service |
| Recommendations to startups | Startup notifications and event applications |
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

  /* chart palette */
  --chart-1: var(--ink);
  --chart-2: var(--gold);
  --chart-3: var(--stone-400);
}
```

---

# Part J. Build order (suggested)

1. Role guard and mentor shell (Part A9), including re-authentication for sensitive actions and the verification banner.
2. Shared components: KPI card, status chips, amount breakdown, data source chip.
3. **Agreements** first: payments and equity terms depend on a recorded agreement, and the startup side already needs it.
4. **Earnings and Payouts:** Payments and Payout settings first (so mentors can get paid), then Overview charts, Payouts and Invoices and tax.
5. **Impact and Reviews:** reviews first, then the impact numbers and the public view once enough sessions and sign-offs exist.
6. **Investor Events:** can come last; it only matters once anchor investors and real startups are on the platform.
7. Notifications, exports, dispute flows.
8. Empty, loading and error states, then mobile layouts.

**Suggested first release:** Agreements, Payments, Payout settings and Reviews. Add the full Impact record, tax documents and Investor Events after the first mentors have completed mentorships and your proposal's anchor investors have joined.

**Reminder for the build:** every route above is mentor-only and role-based. Add the guard first, filter all financial data on the server by the signed-in mentor, require re-authentication for payout and equity actions, and write every financial and agreement change to the audit log. Get legal and tax advice on how mentor payments, equity or advisory shares and invoices should work before launch.
