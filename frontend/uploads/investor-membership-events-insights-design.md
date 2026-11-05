# Investor Membership, Events and Insights Pages Design

The pages that support an investor's long-term use of the platform: the membership plan and billing, events where investors meet startups, aggregated market insights, and a complete record of the investor's own activity. These match your proposal's **investor membership** revenue stream (a subscription for deal-flow access and tools), the investor events that mentors also get priority for, and the audit trail promised for document views. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Investor role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user has the `investor` role and a **KYC-verified** investor account (billing and activity pages also open for an investor who is still being verified, in a limited form). Billing, activity and insight data must be filtered on the server by the signed-in investor or their organization. Details are in **Part A9**. Do not show these pages to startups, mentors, job seekers or employers.

> **Reminder: platform role and legal limits.**
> The platform introduces parties. Unless it holds the right licenses, it is not a broker or adviser. Market insights are aggregated, anonymized information, not investment advice or predictions. Membership fees and any success fee tied to rounds closed through the platform need legal review before launch (see Part A8).

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Membership and Billing | `/investor/billing` | Subscription plan, usage limits, invoices, payment method, success fee records |
| 2 | Investor Events | `/investor/events` | Demo days, pitch events, investor office hours; registration and follow-up |
| 3 | Market Insights | `/investor/insights` | Aggregated, anonymized deal flow and sector trends from platform data |
| 4 | Activity and Audit Log | `/investor/activity` | Everything the investor viewed, downloaded, signed, sent and changed |

Related pages: the startup side of events and billing is in `startup-investor-design.md` (Investor Visibility Settings, Rounds) and `startup-mentor-design.md` (Payments). Mentor events are in `mentor-money-recognition-design.md` (Investor Events); investors see the other side of the same events. Deal flow, diligence and offers pages are in `investor-deal-flow-design.md`, `investor-diligence-pipeline-design.md` and `investor-offers-portfolio-design.md`.

---

# Part A. Shared foundations

## A1. Design principles

- **Plain pricing:** the plan, its limits and what happens at the limit are visible before an investor commits. No hidden fees and no dark patterns.
- **Events that respect time:** clear agenda, who attends and what the investor can do there, with easy registration and easy cancellation.
- **Insights with honesty:** every figure shows its source, period and group size. The platform never predicts returns, rates startups or tells an investor what to do.
- **A record you can trust:** the activity log is complete, readable and exportable, so investors can prove what they accessed and startups can see the same trail for their own documents.
- **Calm and efficient:** investors have limited time. Important dates and actions come first.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, current plan, priority access, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Badges, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, gridlines |
| `--success` | `#2E7D5B` | Paid, registered, positive change |
| `--warning` | `#B7791F` | Due soon, limit near, action needed |
| `--error` | `#B42318` | Failed, over limit, errors |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.
- Page title 28px serif; KPI number 32px serif 600; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Currency in ₹ with Indian grouping by default, configurable; show the currency code when more than one currency exists.

## A4. Shared layout

Desktop (≥ 1200px): the investor sidebar and top bar from the other investor pages, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar, tables become cards, sticky bottom action button.

## A5. Shared components

### KPI card
Label (caption), big serif number, change chip ("▲ 12%"), small sparkline (ink, last point gold). Tooltip shows the definition and formula.

### Status chips
- **Billing:** `Active` (success tint), `Trial` (gold-tint), `Past due` (error tint), `Cancelling` (warning tint), `Cancelled` (stone), `Paused` (stone outline), `Paid` (success tint), `Pending` (warning tint), `Failed` (error tint), `Refunded` (stone).
- **Events:** `Open` (success tint), `Priority access` (gold-tint), `Invite only` (gold-tint), `Waitlist` (warning tint), `Registered` (ink fill), `Full` (stone), `Live` (gold fill), `Past` (stone outline), `Cancelled` (error tint).
- **Activity:** category chips (`Profile view`, `Data room`, `Document`, `NDA`, `Offer`, `Message`, `Meeting`, `Security`, `Settings`) in neutral stone.

### Source and sample-size chip
Used on every insight: `Platform data`, period (for example, "Last 90 days"), and "n = 24 startups" so readers see how much data sits behind a number.

### Platform disclaimer
Small caption with an info icon on insight and event pages: "The platform introduces startups and investors. It is not a broker or adviser unless licensed. Information shown is general and aggregated, not investment advice." Link: **Learn more**.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Confirmation toast on changes; "Saved · just now" on drafts |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner: "Your investor account is under review. Events registration and full insights open after approval." Billing and Activity remain available |
| Verification expired or action needed | Banner with the reason and **Update verification** |
| Suspended | Read-only pages with a banner and **Contact support** |
| Offline | Pages show cached data where available; payments and registrations are disabled until reconnected |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; charts animate once on load (600ms). Money values never animate as counters. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Every chart has a text summary and a **View as table** toggle; chart series are distinguished by labels, shapes or dash patterns as well as color.
- Tables use proper `th` and `scope`; amounts are right-aligned and announced with their currency.
- Calendars and lists are fully keyboard operable; an event card is always reachable as a list item too.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Legal, privacy and conduct rules

- **Billing:** the platform shows plans, taxes and invoices. It does not give tax or accounting advice. Investors should confirm their own tax obligations with an accountant. Plan terms, auto-renewal, refunds and cancellation follow the published terms, summarized plainly on the page.
- **Success fee:** your proposal lists an optional fee on rounds closed through the platform, subject to legal review. If enabled, the investor page shows it clearly, with the rule that applies, the amount and when it is charged. It must never be hidden in the plan or applied without disclosure. Confirm with counsel whether a success-based fee changes the platform's regulatory position (for example, as a broker).
- **Events and conduct:** events follow the platform's code of conduct and securities rules. The platform introduces parties; presentations at events are not recommendations to invest. Events that involve fundraising pitches may need legal review.
- **Insights are aggregated and anonymized:** no startup or investor can be identified from an insight. Groups smaller than a minimum size (for example, fewer than 10 startups) are hidden or merged. Startups opt in to contributing data; investors see only what is aggregated.
- **No predictions or ratings:** insights describe what happened. They never forecast returns, rank startups by likelihood of success, or recommend what to fund.
- **Activity log is for accountability:** it records the investor's own actions. Startups can see the logged views of their own documents and profiles, according to their own settings. The log is not used to profile or rank investors.
- **Retention:** logs and invoices are kept per the platform's retention policy and applicable law; investors can export their own records. Deletion requests keep what the law or agreements require (for example, signed NDAs and financial records).
- **Data handling:** data is encrypted in transit and at rest; handling follows the platform's privacy policy and applicable law (for example, India's DPDP Act).

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users with the `investor` role can open any `/investor/...` route |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, job seeker, employer users see a 403 page ("This page is for investors") with a link to their own home; no investor data is fetched or rendered |
| **Multi-role users** | A founder or mentor who is also an investor sees the role switcher; switching changes the sidebar and routes between `/startup/...`, `/mentor/...` and `/investor/...` |
| **Investor not yet verified** | Membership and Billing and Activity open normally (a plan can be chosen); Investor Events are visible but registration is disabled; Market Insights shows a limited summary |
| **Plan-based features** | Feature limits (for example, saved searches, intro requests per day, team seats, insight depth, event access) are enforced on the server from the plan, not only in the UI |
| **Billing access** | Only the Owner and Admin of an investor account or organization can see and change billing, payment methods and invoices; other members see the plan name and their own usage only |
| **Sensitive actions** | Changing plan, changing payment method, cancelling and changing billing details require re-authentication |
| **Event eligibility** | Access depends on verification, plan and invitations; the server checks eligibility before registration |
| **Insights data scope** | Insight queries return only aggregated, anonymized data above the minimum group size; the server enforces the minimum |
| **Activity log scope** | Each investor sees their own actions; organization Owners and Admins see the organization's actions with member names; other members see only their own. Entries cannot be edited or deleted by the investor |
| **Export** | Exports contain only the signed-in investor's or organization's own data |
| **Admin view** | Admins can view these pages read-only for support or dispute resolution, with an "Admin view" banner; access is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Membership and Billing: `/investor/billing`

## B1. Purpose
Shows the investor's plan, what it includes, how much of it is used, what has been billed and how to change or cancel it.

## B2. Layout
Header with title and the current plan chip. Tabs: **Plan** · **Usage** · **Invoices** · **Payment methods** · **Billing details** · **Fees**. A summary strip, then the tab content. A side column on desktop with the next charge and help.

### Summary strip
| Stat | Example |
|---|---|
| Current plan | Pro (annual) |
| Next charge | ₹49,000 on 1 Mar 2027 |
| Seats used | 3 of 5 |
| Intro requests today | 2 of 10 |

## B3. Plan tab

### Current plan card
Plan name, price and billing period, renewal date, status chip (A5), what is included (short list), **Change plan**, **Cancel plan**. If on trial: days left and what happens at the end.

### Plan comparison
Cards for each plan side by side (for example, Basic, Pro, Team or Fund), with the current plan marked in `--gold-tint`:

| Feature | Example differences |
|---|---|
| Discover and profile views | Browse limits or full access |
| Saved searches and alerts | Count and alert frequency |
| Intro requests per day | Daily limit |
| Shortlists and compare | Count and number of startups per comparison |
| Data room access | Number of active data rooms |
| Team seats and organization features | Seats, approvals, shared lists |
| Market insights | Basic or full, export |
| Events | Open access or priority access |
| Support | Standard or priority |

Prices are set after market research (as your proposal notes) and shown with tax details (for example, GST) before payment. A toggle switches between monthly and annual billing, with the savings stated in rupees. No hidden charges; every limit is visible in the table.

### Change plan (modal)
1. Choose a plan and period.
2. Review the change: what is added or lost, proration for the current period (calculated and explained), new price and next charge date. Downgrades list features that will stop and any data effects (for example, "Saved searches above 5 will be paused").
3. **Confirm change** (primary) with re-authentication.

### Cancel plan (modal)
Plain steps: reason (optional chips: Too expensive, Not enough deals, Not ready to invest, Switching, Other), what happens at the end of the period (access until the renewal date, then limited browsing), data retention (pipeline, notes and portfolio records stay; data room access follows each startup's settings), and a **Pause plan** alternative if offered. Cancelling takes two clicks, not a maze. **Confirm cancellation** requires re-authentication.

## B4. Usage tab
Meters against plan limits, each with a bar (ink fill; warning tint near the limit; error tint at the limit):
- Saved searches
- Intro requests today and this month
- Active data rooms
- Shortlist size
- Team seats
- Exports this month

Each meter has a plain note on what happens at the limit ("You can still view, but new requests wait until tomorrow") and an **Upgrade** link. A chart shows usage over time (ink line, gold current point) with a **View as table** toggle.

## B5. Invoices tab
Table: invoice number, date, period, description, amount, tax, total, status chip, **Download PDF**. Filters: period, status. Includes plan invoices and, if applicable, fee invoices. Each invoice states who issued it and the tax details. **Request a correction** opens a support ticket tied to the invoice.

## B6. Payment methods tab
List of saved methods (card, UPI, net banking, or invoice billing for organizations if offered): masked details (for example, "Visa •••• 4417"), expiry, default marker, status. **Add payment method**, **Make default**, **Remove**. Adding or changing a method requires re-authentication. Failed payment: banner with the reason, **Update method** and **Retry**, and the grace period before the plan pauses.

## B7. Billing details tab
Legal name, billing address, tax registration (for example, GST number), PAN or tax ID (masked after saving), billing contact email, purchase order reference (optional), invoice language and currency. Changes apply to future invoices. For organizations, only Owners and Admins can edit.

## B8. Fees tab
Shown only if the platform enables fees beyond the plan.
- **Success fee** (optional on rounds closed through the platform, subject to legal review): a plain explanation of what triggers it, the percent or amount, when it is charged, who pays (investor, startup or both) and how it is shown on invoices.
- **Fee records:** table of fees tied to closed commitments (startup, round, amount, status, invoice) linked to Commitments.
- **Dispute a fee:** opens a ticket with the commitment record attached.
- Caption: "Fees are described in the platform terms. Get your own legal and tax advice."

## B9. Side column
- **Next charge:** date, amount, method (masked), **View invoice preview**.
- **Plan tips:** a short suggestion if the investor often hits a limit ("You reached the intro limit on 6 days. Consider a higher plan."). It appears at most once a month and can be dismissed.
- **Help:** link to billing help and **Contact support**.

## B10. States
- **No plan (new investor):** "Choose a plan to start receiving deal flow." with the plan comparison; a free tier or trial if offered.
- **Trial ending:** warning banner with the end date and what happens next.
- **Past due:** error banner with the amount, the grace period and **Pay now**; features pause after the grace period; data stays safe.
- **Payment failed:** banner and chip with the reason and a **Retry** button.
- **Cancelling:** warning chip and the end date with **Resume plan**.
- **Seat limit reached:** message with **Add seats** or **Upgrade**.
- **Refund issued:** chip and a note explaining the amount and timing.
- **Not verified:** a plan can be chosen; features that need verification stay locked with a note.
- **Non-admin member:** sees plan name and own usage only; billing tabs hidden with "Ask an Owner or Admin."

---

# Part C. Investor Events: `/investor/events`

## C1. Purpose
Events where investors meet startups and mentors: demo days, pitch evenings, investor office hours and roundtables. The page handles discovery, registration and follow-up. It is the investor's side of the events mentors can access with priority.

## C2. Layout
Tabs: **Upcoming** · **My registrations** · **Invitations** · **Past**. Toolbar: search, filters (type, date range, format, sector, startup stage), sort (Soonest, Best match). A featured event card at the top for the next major one.

## C3. Event card
Cover band (solid ink with a thin gold rule, no stock photo), title, date and time (time zone shown, default Asia/Kolkata), format (Online, In person, Hybrid) and location, host (platform, partner or investor group), sector and stage focus, number of startups presenting, number of investors expected, access chip (`Open`, `Priority access`, `Invite only`, `Waitlist`, `Full`), registration status chip, and actions (**View**, **Register**, **Add to calendar**).

**Match hint:** "Matches your criteria: pre-seed, health tech" (based on the investor's saved preferences). Labeled `Suggested`.

## C4. Event detail: `/investor/events/:eventId`
Left main column (8 col), right sticky panel (4 col).

### Sections
1. **About:** description, purpose and format.
2. **Agenda:** times, speakers, panels and pitch slots.
3. **Presenting startups:** list of startups confirmed to present (only those that agreed to be listed), each with a startup card summary (stage, sector, readiness, **Investment Ready** badge, round info). **Save**, **View profile**, **Request intro** work as elsewhere. A **Prep list** toggle lets the investor mark startups they want to see, producing a personal schedule.
4. **Who's attending:** counts by type (startups, investors, mentors) and, where people consented, a short list with names and organizations.
5. **Ways to take part:** Attend, Pitch feedback, Office hours (investors can offer a 20-minute slot to startups), Roundtable discussion, Network. Each shows capacity and rules.
6. **Logistics:** venue or link, joining instructions, accessibility notes, code of conduct, recording policy, dress or entry rules.
7. **Documents:** event brief, agenda PDF, participation guidelines, disclaimer.

### Right sticky panel
- **Registration card:** status chip, **Register** or **Cancel registration**, a guest option if allowed, registration deadline.
- **Seats:** "Investor seats: 12 left" and waitlist position if applicable.
- **Access note:** for example, "Investors on the Pro plan get priority registration 3 days early" with the date registration opens for the investor.
- **Add to calendar** and **Share with a colleague** (colleagues must register themselves).
- **Contact organizer** and **Report a concern**.
- **Disclaimer** (A5).

## C5. Register (modal)
- Attendance type (Attend, Office hours, Roundtable)
- Interests (sectors and stages, used only to help organizers match; optional)
- Consent to share your name and organization with attendees (optional)
- Accessibility or dietary needs (optional, shown only to organizers)
- Confirmation of the code of conduct and the reminder: "Presentations aren't recommendations to invest."
- **Confirm registration** (primary)

Cancellation frees the seat. Repeated no-shows can reduce priority access, and the page explains this in plain words before registering.

## C6. Event day experience (online or hybrid)
- A gold-tint banner "Starting soon" with **Join** from 15 minutes before.
- During the event: agenda with the current session highlighted, **Presenting now** card with the startup mini-card and a **Save** button, a private notes panel ("Private to you and your team"), and a **Request intro** shortcut that queues the request until the event ends so the startup is not interrupted.
- Chat or Q&A where the event allows, moderated per the code of conduct.

## C7. My registrations and follow-up
- **My registrations:** event, date, role, status, ticket or link, **Cancel**, **Add to calendar**.
- **After the event:** a follow-up card lists startups you saved or noted ("You marked 4 startups"), with **Request intros** (daily limits apply), **Move to pipeline** and **Send feedback to organizer**. A short optional survey for the event.
- **Past events:** attended events, notes, startups you followed up with, certificates of participation where the organizer provides them.

## C8. Invitations
Invitations from the platform or organizers, with the reason ("Invited because you invest in pre-seed health tech") and the deadline to respond. **Accept** or **Decline**.

## C9. Host or co-host an event (if offered)
For funds and angel groups: **Propose an event** (purpose, format, date range, target audience, expected size) sends a request to admin. Approved events are listed with a `Hosted by {Investor}` label and follow the platform's rules. The platform keeps the right to review content for compliance.

## C10. States
- **No upcoming events:** "No events right now. We'll notify you when new ones open." with a notification toggle.
- **Priority window not open yet:** card shows the opening date and **Remind me**.
- **Full:** waitlist with position and notification when a seat opens.
- **Not eligible:** a short reason ("This event is for investors with a verified account") with the criteria; no negative language.
- **Event changed or cancelled:** warning banner, notification, and refund or rebooking notes if tickets apply.
- **Online event starting soon:** gold-tint banner with **Join**.
- **Not verified:** events visible; registration disabled with the banner (A6).

---

# Part D. Market Insights: `/investor/insights`

## D1. Purpose
Aggregated, anonymized views of what is happening on the platform: where startups are, what is being raised, how sectors move. The aim is to help investors see the shape of deal flow and decide where to look, without exposing any startup or investor and without predicting outcomes.

## D2. Layout
Header with title and a note: "Aggregated and anonymized platform data. Not investment advice." Controls: **Date range** (Last 30 days, 90 days, 12 months, Custom), **Compare to** (Previous period, Same period last year), **Export** (CSV, PDF). Tabs: **Overview** · **Deal flow** · **Sectors** · **Rounds and valuations** · **Readiness and mentoring** · **My activity vs platform**. A filter bar (stage, sector, region) under the tabs. A **Last updated** caption and a **Methodology** link.

## D3. Shared insight components
- **Insight card:** title, a plain-language headline ("Seed-stage fintech startups grew 18% in 90 days"), chart, source and sample-size chip (A5), and "How is this calculated?" link.
- **Chart types:** line (trends), bar (comparisons), stacked bar (composition), table with inline bars (rankings), heatmap for sector-by-stage counts. Chart palette uses ink, gold and stone-400 with direct labels; never more than three colors in one chart.
- **Minimum group size:** groups below the minimum (for example, fewer than 10 startups) are hidden or merged into "Other," with the note "Hidden to protect privacy."
- **Data freshness:** each card shows the last update date; stale data (older than the usual refresh) shows a warning chip.

## D4. Overview tab
KPI row (aggregated platform-level numbers):
| Card | Example |
|---|---|
| Opted-in startups | 1,240 |
| Investment Ready startups | 186 |
| New startups (period) | 94 |
| Active rounds | 112 |

Charts: opted-in startups over time (line), startups by stage (bar), top sectors by count (bars), Investment Ready share over time (line). Plus **What's new this month**: 3 short factual highlights generated from the data and labeled `Auto insight`.

## D5. Deal flow tab
- **New startups by week or month,** by stage and sector.
- **Funnel at platform level:** startups visible → shortlisted by at least one investor → intro accepted → data room opened → offer made (aggregated percentages; no names).
- **Time in stage:** median days from registering to Investment Ready, and from intro to data room access.
- **Regional distribution:** ranked bars by state or city (maps only if the data supports them).

## D6. Sectors tab
- **Sector heatmap:** counts by sector and stage; cells below the minimum size are blank.
- **Growth by sector:** number of startups and share of rounds opened, with the change versus the previous period.
- **Sector detail drawer:** for a chosen sector, a short snapshot (number of startups, stage mix, typical round size, median readiness score), with a link to Discover filtered by that sector.
- **Trending themes:** tags drawn from startup profiles that grew in frequency (for example, "climate tech," "B2B SaaS"), each with a count and period. Labeled "Frequency of mentions, not a recommendation."

## D7. Rounds and valuations tab
- **Round sizes:** distribution of target raise by round type (box-style range bars: 25th to 75th percentile with the median tick).
- **Percent committed:** distribution of how much rounds have raised against target.
- **Valuation ranges:** ranges by stage and sector, shown only where the group meets the minimum size and startups consented to share valuation data; otherwise "Not enough data."
- **Instrument mix:** share of equity, SAFE and convertible notes.
- **Time to close:** median days from round opening to closing.
- Caption: "Based on rounds and terms startups shared with the platform. Self-reported figures may differ from final terms."

## D8. Readiness and mentoring tab
- **Readiness distribution:** number of startups by readiness score band.
- **Mentor sign-off progress:** share of startups with all six items signed off, by stage.
- **Mentor involvement:** startups with an active mentor vs without; average sign-off time.
- **Investment Ready over time:** line with annotated platform changes (for example, new checklist version).
- Caption: "Readiness is a guide, not a recommendation."

## D9. My activity vs platform tab
The investor's own numbers next to platform aggregates, privately:
- **Your funnel vs platform funnel:** profile views, shortlists, intros, data rooms, offers (your counts in ink; platform medians in stone-400).
- **Your response time to intros** vs the typical platform response time.
- **Sectors you view vs sectors with most new startups:** a simple comparison to show where deal flow is concentrated.
- Private to the investor; no ranking of investors and no names. Labeled "Only you can see this."

## D10. Saved views and sharing
- **Save this view:** name and keep the filters for later.
- **Share with my team:** organization members only.
- **Export PDF report:** includes methodology, period, filters, charts, source chips and the disclaimer.
- **Email digest:** optional monthly digest of the saved views.

## D11. Methodology and data quality
A **Methodology** drawer explains: what data is included (opted-in startups, platform events), how it is aggregated, the minimum group size, how often it refreshes, how self-reported figures are treated, and known limits ("Startups join at different times, so early numbers may swing"). A **Report a data issue** link opens a ticket.

## D12. States
- **Loading:** skeleton charts.
- **Not enough data (early platform stage):** "We don't have enough data here yet." with the minimum group size and a link to methodology; the page doesn't invent numbers. A faint outline of the chart is shown without fake values.
- **Filters too narrow:** message "Too few startups for this filter" with a suggestion to broaden.
- **Partial period:** dashed segment on the chart with a "Period in progress" caption.
- **Stale data:** warning chip with the last update date.
- **Export in progress:** toast and progress; the file downloads when ready.
- **Plan limit:** advanced tabs (for example, Rounds and valuations) show a locked card with the plan needed and **Upgrade** if the plan limits insights.
- **Not verified:** limited summary (Overview only) with the banner (A6).

---

# Part E. Activity and Audit Log: `/investor/activity`

## E1. Purpose
A complete, readable record of what the investor (and, for organizations, the team) viewed, downloaded, signed, sent and changed on the platform. It supports accountability to startups under NDAs, internal compliance and the investor's own memory.

## E2. Layout
Header with title, the note "This log can't be edited or deleted," **Export**, and a summary strip. Tabs: **All activity** · **Data rooms and documents** · **Offers and commitments** · **Security** · **Team** (organizations only). Toolbar with search, filters and date range, then the log table and a detail drawer.

### Summary strip
| Stat | Example |
|---|---|
| Events (last 30 days) | 482 |
| Documents viewed | 63 |
| NDAs signed | 4 |
| Active sessions | 2 |

### Toolbar
Date range (Today, Last 7 days, Last 30 days, Custom), category chips (A5), startup filter, member filter (organizations), type filter (view, download, print attempt, sign, send, change, login), outcome filter (Success, Blocked, Failed), search.

## E3. Log table
| Column | Content |
|---|---|
| Time | Date and time with time zone |
| Who | Member name and role (organizations), or "You" |
| Category | Category chip |
| Action | Plain-language description ("Viewed document 'Cap table.pdf' in {Startup} data room") |
| Target | Startup and item, linked where access still exists |
| Outcome | Success, Blocked (for example, no access), Failed |
| Context | Device type, approximate region, session ID (shortened) |

Row click opens a detail drawer with the full record: exact time, IP region, device and browser, session ID, related offer or document, and (for data room items) page numbers viewed and time spent. Time spent and page views are shown to the investor themselves and to the startup as part of their own audit trail, and are not used to rank investors.

## E4. Tab contents

### Data rooms and documents
Every open, page view duration, download and print attempt per document, grouped by startup and folder. Totals per data room. **Print attempts and blocked downloads** are listed, with a reminder that access is logged and the NDA applies to everything viewed.

### Offers and commitments
Offer drafts, versions, approvals, sends, counters, acceptances, withdrawals, commitment records and funds status changes, each linked to the offer or commitment record.

### Security
Sign-ins (success and failed), new devices, two-factor changes, password changes, payment method changes, role and permission changes, active sessions with **Sign out** for each, and **Sign out everywhere**. Unusual activity (for example, a login from a new country) shows a warning chip and a **This wasn't me** button that starts a security review.

### Team (organizations)
Activity by member: counts by category, last active, and a table of notable actions (data room opens, offers sent, exports). Owners and Admins can filter by member. A note: "Team activity is visible to Owners and Admins. Members are told that activity is logged."

## E5. Export
- **Export CSV or PDF** of the filtered log (own or organization's data only). The PDF has a summary page, the filters applied, a verification code and the generation time.
- Exports are themselves logged ("Exported activity log, 482 rows").
- Limits: one export request at a time; large exports are prepared in the background and delivered by notification.

## E6. Verification and disputes
- **Verify a record:** each record has a unique ID; the investor can copy it or use **Request verification** to ask support to confirm the record for a dispute or compliance check.
- **Report an issue:** if the investor sees an entry that looks wrong (for example, a session they don't recognize), **Report** opens a ticket with the record attached.
- Startups see only the log entries about their own data and profile, in their own audit trail.

## E7. Retention and privacy
- A note explains the retention period and what is kept: records of NDAs, access, offers and commitments are kept per policy and law; login and session details may be shortened after a set period.
- **Download my data** and deletion requests are in Settings; deletion keeps legally required records.

## E8. States
- **Empty (new account):** "Your activity will appear here as you use the platform."
- **No results:** "No entries match your filters." with **Clear filters**.
- **Loading:** skeleton rows.
- **Large result set:** pagination with a count and a prompt to narrow the filters.
- **Delayed entries:** a small notice "Some entries can take a few minutes to appear."
- **Suspicious activity:** a warning banner at the top with **Review** and **Secure my account**.
- **Export ready or failed:** notification and banner with **Download** or **Retry**.
- **Non-admin member of an organization:** sees only their own entries; the Team tab is hidden.
- **Not verified:** the log works for the actions the investor can take; blocked attempts appear as `Blocked` entries.

---

# Part F. Notifications for these pages

| Event | Channel |
|---|---|
| Plan renewal in 7 days and 1 day | In-app, email |
| Payment succeeded, failed or retried | In-app, email |
| Invoice available | Email |
| Plan limit reached or close (80 percent) | In-app |
| Trial ending in 3 days | In-app, email |
| Plan changed or cancelled | Email |
| Payment method changed | Email (security alert) |
| Event opens for priority registration | In-app, email |
| Event reminder (1 day, 1 hour) | In-app, email, push |
| Event changed, cancelled or seat available from waitlist | In-app, email |
| Follow-up prompt after an event | In-app |
| New monthly insights digest | Email |
| Unusual sign-in or new device | In-app, email, push |
| Export of activity log ready | In-app |

Investors can mute, filter or set digests in Settings. Security and billing alerts cannot be muted. Notification text and email subjects don't include card details.

---

# Part G. Data and validation

| Field | Rule |
|---|---|
| Plan change | Takes effect per the shown proration; downgrades list lost features; re-authentication required |
| Cancellation | Re-authentication; access continues to the end of the paid period |
| Payment method | Validated by the payment provider; masked after saving; re-authentication to add or change |
| Billing details | Legal name and address required; tax ID format validated; masked after saving |
| Seats | Cannot go below the number of active members; removing a member frees a seat |
| Event registration | Within the registration window; one registration per investor per event; priority window per plan |
| Event interests | Optional; used only to help organizers |
| Insights filters | Minimum group size enforced on the server; results below it are hidden |
| Insights export | Only aggregated data; includes methodology and the disclaimer |
| Activity export | Only the signed-in investor's or organization's records; one active export at a time |
| Activity log | Append-only; entries can't be edited or deleted by users |

**Audit log:** plan changes, payment method changes, billing detail changes, event registrations and cancellations, export requests, insight exports, and security events, each with user and time.

---

# Part H. Data connections

| Feature | Connected to |
|---|---|
| Plans, invoices, payment methods, fees | ERP billing, payment provider, tax settings |
| Success fee records | Commitments (`/investor/commitments`), startup Round Detail |
| Feature limits and usage | Entitlements service (plan-based), Discover, Saved Searches, Intro Requests, Data Rooms |
| Verification and organization roles | Admin console, investor application and verification, investor team |
| Events and registrations | Admin console (events), calendar, notification service |
| Presenting startups at events | Startup profiles (opted in), Discover, Shortlist, Intro Requests |
| Insights data | Platform analytics warehouse (aggregated and anonymized, minimum group size enforced) |
| Startup contributions to insights | Startup consent settings (`/startup/investors/settings`) |
| Activity log | Central audit log service (data rooms, offers, commitments, sessions, settings) |
| Notifications and digests | ERP notification service |
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

1. Role guard, plan entitlements and organization roles (Part A9), so limits are enforced on the server from the start.
2. **Central audit log service** (append-only, one schema for data rooms, offers, sessions, settings), because every other investor page writes to it.
3. **Activity and Audit Log** page (it reads from the service above; export last).
4. **Membership and Billing:** Plan and Payment methods first, then Usage, Invoices, Billing details; add Fees only if the success fee is approved by legal review.
5. **Investor Events:** list, detail and registration first; event day experience and follow-up later, once real events exist.
6. **Market Insights:** Overview and Deal flow first, then the other tabs as data grows. Enforce the minimum group size before showing anything.
7. Notifications, exports, saved views and digests.
8. Empty, loading and error states, then mobile layouts.

**Suggested first release:** Membership and Billing (Plan, Payment methods, Invoices), Activity and Audit Log, and a basic Investor Events list. Add Market Insights once there is enough opted-in startup data to meet the minimum group size without exposing anyone. Your proposal flags the chicken-and-egg risk, so consider a free or discounted plan for anchor investors early on.

**Reminder for the build:** every route above is investor-only and role-based. Add the guard and plan entitlement checks first, restrict billing to Owners and Admins, require re-authentication for plan, payment and cancellation changes, enforce the minimum group size for insights on the server, keep the activity log append-only, and filter every export to the investor's own data. Get legal advice on the success fee, event content rules, investor eligibility and registration, and review tax handling for membership invoices before launch.
