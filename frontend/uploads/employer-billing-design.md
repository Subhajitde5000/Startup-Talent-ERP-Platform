# Employer Billing and Plan Design: `/employer/billing`

The page where a company sees its plan, buys job posts and extras, tracks usage, manages seats and spending, and downloads invoices. It implements the **Job postings** revenue stream in your proposal: a per-post fee or a subscription, plus featured listings. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: this page is role-based.**
> This page belongs to the **Employer role** only, in a company account, and is limited by **team role**. The project owner will add the role and permission logic. Only the **Owner** can change plans, payment methods and billing details; **Admins** can view plan, usage and invoices; a **Billing contact** (an optional finance member) can view invoices and download tax documents only; Recruiters, Hiring managers, Interviewers and Viewers don't see this page. Billing data is financial: the server must filter everything by company and team role. Details are in **Part A9**. Do not show this page to startups (who use `/startup/billing`), mentors, investors or job seekers (each role has its own billing page).

> **Reminder: candidates never pay, and money never buys hiring outcomes.**
> Employers pay for posting jobs and for tools. Candidates are never charged to apply, interview or be hired. Paying doesn't change who is verified, how candidates are treated, or whether a job passes the platform's fairness and safety rules. A featured listing is labeled as featured. The page must never present a payment as a way to get around verification, moderation or reply-time expectations.

## 1. Design principles

- **Plain pricing:** price, what it includes, what happens at the limit, and how to cancel are all visible before purchase. No hidden fees, no fake discounts, no countdown timers.
- **Pay for what you use:** a small company hiring once should be able to buy a single post without a subscription. A busy company should find a plan that makes sense.
- **Nothing consumed until it works:** a job post credit is used only when a job is actually published, and is returned if the platform removes the post because of a platform error.
- **Clear ownership and control:** who can buy, who can see invoices, and what needs approval are explicit, with spending limits and re-authentication for sensitive changes.
- **Built for finance teams:** GST invoices, purchase order numbers, billing contacts, tax documents and downloadable statements, without needing a support ticket.
- **Calm tone:** no pressure upsells. Suggestions are rare, explained and dismissible.

## 2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Current plan, usage fill, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Current-plan highlight, badges, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Paid, active |
| `--warning` | `#B7791F` | Limit near, payment problem, expiring |
| `--error` | `#B42318` | Failed payment, over limit, errors |

## 3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for prices and counts.

| Element | Size / weight |
|---|---|
| Page title | 28px serif 600 |
| Price | 32px serif 600 |
| Card title | 16px Inter 600 |
| Body | 14px Inter 400 |
| Caption / meta | 12px Inter 400, `--stone-700` |

Currency is ₹ with Indian grouping by default (for example, ₹4,999), configurable in company settings. Prices always show the period or "one-time" and whether tax is included or added (for example, "₹4,999 + 18% GST").

## 4. Layout

### Desktop (≥ 1200px)
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Billing and plan"    [Current plan]    │
│          ├────────────────────────────────────────────────┤
│          │  Summary strip (4 cards)                       │
│          ├────────────────────────────────────────────────┤
│          │  Tabs: Plan · Job posts and add-ons · Usage ·  │
│          │  Seats · Invoices · Payment methods ·          │
│          │  Billing details · Spending controls           │
│          ├───────────────────────────────┬────────────────┤
│          │  Tab content (8 col)          │ Side (4 col)   │
│          │                               │ Next charge    │
│          │                               │ Help           │
└──────────┴───────────────────────────────┴────────────────┘
```
- 12-column grid, 24px gutters, max content width 1200px, page padding 32px.
- Cards: white, 1px `--stone-200` border, radius 12px, padding 24px.

### Tablet
Side column drops below the tab content. Plan cards go to two across.

### Mobile
Single column. Tabs become a scrollable segmented control. Plan cards stack with the current plan first. Tables become cards. A sticky bottom button shows the main action (for example, **Buy a job post**). Owner-only actions are hidden for other roles.

## 5. Page header and summary

- Title: "Billing and plan." Subtitle: "Pay for the jobs and tools you use. Candidates are never charged."
- **Current plan chip** (for example, `Pay as you go`, `Growth`, `Scale`) in `--gold-tint`, with the renewal date for subscriptions.
- A **verification note** when the company is not yet verified: "You can buy now. Credits are used only when you publish, and publishing needs verification." with **Finish verification**.

### Summary strip
| Card | Example |
|---|---|
| Plan | Growth (annual) |
| Next charge | ₹59,880 on 1 Mar 2027 |
| Active job posts | 3 of 5 |
| Seats used | 6 of 8 |

On pay-as-you-go: `Pay as you go`, "No recurring charge," "2 job post credits left," "4 seats (included)."

## 6. Tabs

### 6.1 Plan tab (Owner can change; Admin views)

#### Current plan card
Plan name, price and period, renewal date, status chip, a short list of what's included, **Change plan**, **Cancel plan** (subscriptions; Owner only). On trial: days left and what happens at the end (no charge unless the company added a payment method and agreed).

#### Plan comparison
Cards side by side (3 across on desktop), with the current plan marked in `--gold-tint`. A toggle switches monthly and annual billing, showing annual savings in rupees (no inflated "was" prices). Names, limits and prices are set after market research, as your proposal notes, so keep them configurable. Example structure:

| Feature | Pay as you go | Growth | Scale |
|---|---|---|---|
| **Job post pricing** | Per post (see Packs), each post live for 30 days | Included active posts (for example, 5 at a time) | Included active posts (for example, 20 at a time) |
| **Company page and verified badge** | Included | Included | Included |
| **Applicant pipeline, scorecards, interviews, offers** | Included | Included | Included |
| **Team seats** | 3 included | 8 included | 25 included, more available |
| **Templates and scorecards** | Starter set | Full library | Full library, approvals |
| **Talent search and invitations** | Not included (add-on) | 50 invitations per month | 300 invitations per month |
| **Featured listings** | Add-on | 2 per month | 8 per month |
| **Hiring analytics** | Basic | Full | Full, saved views and scheduled reports |
| **Hires and onboarding** | Checklist | Checklist and documents | Checklist, documents and exports |
| **Support** | Standard | Standard | Priority |

- Every limit is a number, not "more." A **Compare in detail** link opens the full table.
- A line under the table: "Paying doesn't change verification, moderation or fairness rules. Featured listings are labeled."
- Annual billing, volume pricing for staffing agencies or large employers, and nonprofit or early-stage startup discounts (if offered) appear as clearly labeled options with a simple eligibility check. Promo codes can be entered in a field below the cards.
- An **Enterprise or custom** card offers **Talk to us** (a contact form) for custom contracts, invoicing terms and integrations.

#### Change plan (modal, Owner only)
1. Choose a plan and period.
2. Review the change: what's added or lost, proration for the current period (calculated and explained), the new price and the next charge date. Downgrades list what will stop and what happens to live jobs ("Jobs above your new limit stay live until their end date. You can't publish new ones until you're under the limit.").
3. **Confirm change** (primary) with re-authentication.

#### Cancel plan (modal, Owner only)
Two clear steps:
1. **What happens next:** access continues to the end of the paid period; live jobs stay live until their end date; the company moves to Pay as you go; candidate data, pipelines, templates and records stay available; extra seats become read-only; documents and exports remain downloadable for the retention period.
2. **Optional reason** (chips: Too expensive, Not hiring right now, Hired enough, Missing features, Other) and, if offered, **Pause instead** (skip billing for 1–3 months). **Confirm cancellation** (destructive) with re-authentication.
No guilt messages and no loops that block cancelling. A **Cancelled. Access until {date}.** confirmation follows, with **Resume plan** available.

### 6.2 Job posts and add-ons tab

#### Job post packs (pay as you go)
Cards with name, what's included, validity and price (tax shown):

| Pack | Includes | Valid for |
|---|---|---|
| **Single job post** | 1 post live for 30 days | Credit valid 90 days |
| **3-post pack** | 3 posts, each live for 30 days | Credit valid 180 days |
| **10-post pack** | 10 posts, each live for 30 days | Credit valid 12 months |

- A credit is used only when a job is **published**, not when a draft is saved.
- A post can be extended (**Extend 30 days**, priced) or renewed; closing a job early doesn't refund the remaining days (stated plainly).
- If the platform removes a post because of a platform error, the credit is restored. If it is removed for a policy violation, it is not.
- No auto-renewal on packs. "One-time purchase. No automatic renewal."

#### Add-ons
| Add-on | What it adds | Notes |
|---|---|---|
| **Featured listing** | Highlights a job in search and the Startups Hiring page for 7 or 14 days, labeled "Featured" | Doesn't change moderation or ranking by candidate fit; limited slots per search to avoid crowding; refunded if the job is removed for a platform error |
| **Invitation pack (Talent Search)** | 25, 100 or 250 invitations | Candidates can decline or block; unused invitations expire after 90 days; daily limits still apply |
| **Extra seats** | Additional team members | Prorated; removing a member frees a seat at the next billing date |
| **Extra posts above plan limit** | Single posts beyond the plan's active limit | Charged per post |
| **Document and onboarding exports** | Export packs for onboarding documents (if offered) | Optional |
| **Priority support** | Faster response times | Optional |

#### My credits and add-ons
A list of purchased items: name, purchased date, quantity used and left, expiry date, status (`Active`, `Used up`, `Expired`), **Use now** (opens the job editor or Talent Search), **Receipt**.

#### Purchase flow (drawer)
1. Item summary and what it includes, with the expiry date.
2. Price breakdown: price, GST, total; purchase order number (optional).
3. Payment method (saved or new: card, UPI, net banking, or invoice for eligible companies).
4. Optional promo code.
5. **Pay ₹{amount}** (primary). Confirmation shows a receipt and what was added.
Purchases above the company's **spending limit** need approval (6.8). Re-authentication is required when adding a new payment method or for purchases above a set amount.

### 6.3 Usage tab

Meters against plan and credit allowances, each with a bar (gold fill; warning tint near the limit; error tint at the limit) and a plain note on what happens at the limit:
- Active job posts
- Featured listings used
- Talent Search invitations (this month and today)
- Team seats
- Storage for onboarding documents (if limited)
- Exports this month

Each meter says what resets and when ("Resets on 1 Dec") and links to **Buy more** or **Change plan** where relevant. A usage chart (ink line, gold current point) shows the last 6 months with a **View as table** toggle. Notes: "Reaching a limit never affects candidates already in your pipelines or your access to existing records."

When a limit is reached, the related feature explains it and shows the options (wait, buy, upgrade) while the rest of the product keeps working.

### 6.4 Seats tab (Owner and Admin)

A summary of seats used and available, a table of members (name, team role, status, last active, seat type) and actions (**Invite member**, **Change role**, **Remove**) that link to Team and Permissions. Removing a member frees the seat at the next billing date. Read-only roles such as Viewers and Billing contact may be free or count as lower-cost seats if the plan defines it, and the page says so. A note explains that interviewers added for a single hire can be marked **Guest interviewer** (limited access, may be free).

### 6.5 Invoices tab (Owner, Admin and Billing contact)

Table: invoice number, date, period, description (plan, pack or add-on), amount, GST, total, status chip (`Paid`, `Pending`, `Failed`, `Refunded`, `Credit note`), purchase order number, **Download PDF**. Filters: period, type, status. Each invoice shows who issued it, the company's GSTIN and the platform's tax details, and the payment method (masked).

- **Download all (ZIP)** for a chosen financial year.
- **Credit notes** for refunds appear alongside invoices.
- **Tax documents:** area for the company to upload **TDS certificates** (where the company deducts tax at source) and for the platform to attach statements and annual summaries; clearly labeled and downloadable.
- **Request a correction** (wrong company name, GSTIN or address) and **Report a charge I don't recognize** open a support ticket with the invoice attached. Corrections create a new invoice or credit note, not an edit to the old one.
- A **Statement** view lists charges and payments over a period for reconciliation.

### 6.6 Payment methods tab (Owner)

List of saved methods (card, UPI ID, net banking where supported, or "Invoice billing" if approved) with masked details (for example, "Visa •••• 4417," "UPI name@bank"), expiry, default marker and status. **Add payment method**, **Make default**, **Remove**. Adding or changing a method requires re-authentication and sends a security email to the Owner and Admins. Card details are handled by the payment provider; the platform never stores full card numbers.

- **Invoice billing (bank transfer):** available to eligible companies for annual or larger purchases: a request form (company details, expected spend) reviewed by the platform; payment terms (for example, 15 days), bank details for transfer, and a reminder to quote the invoice number. Purchases are activated when payment is received or per approved terms.
- **Failed payment:** a banner explains the reason in plain words and shows **Update method** and **Retry**; the plan continues during a grace period (for example, 7 days) before moving to Pay as you go. Live jobs stay live until their end dates; nothing is deleted.
- **Autopay consent:** an explicit, recorded agreement ("I agree to be charged ₹4,990 monthly until I cancel") with the date, advance notice before each recurring charge as required, and a link to manage it.

### 6.7 Billing details tab (Owner)

Legal company name, billing address, GSTIN (format validated, and checked against the verified company details where possible), PAN (masked after saving), billing contact name and email (receipts and invoices), additional invoice recipients (for example, accounts team), purchase order reference (optional default), invoice language and currency. Changes apply to future invoices. If the legal name differs from the verified company name, a note explains that verification may be re-checked.

### 6.8 Spending controls tab (Owner)

Controls that keep spending predictable and safe:
- **Who can buy:** Owner only (default) or Owner and Admin up to a limit.
- **Approval threshold:** purchases above a set amount need approval from an Owner other than the purchaser where the company has more than one Owner, or a confirmation step with re-authentication where there is one Owner.
- **Monthly spending cap** (optional): purchases beyond the cap are blocked with a clear message and an Owner can raise it.
- **Auto-purchase rules** (optional, off by default): for example, "Buy a single post when I publish with no credits left," up to a monthly limit; always shown before purchase with a confirmation email.
- **Notifications:** thresholds for usage and spend alerts.
- **Audit:** every change to these settings is logged and visible in Activity.

## 7. Side column

- **Next charge:** date, amount, method (masked), **Preview invoice**. For packs: "No upcoming charges."
- **This month's usage:** a mini summary of posts, invitations and seats with **View usage**.
- **Gentle suggestion** (`AI suggestion`, at most once a month, dismissible, off if the Owner turns suggestions off): for example, "You bought 3 single posts in 60 days. A 10-post pack would cost less," with the arithmetic shown. Never shown during a purchase or limit moment, never uses fear, and never pushes featured listings.
- **Help:** billing help, refund policy and **Contact support**; for custom needs, **Talk to us**.

## 8. Refunds, trials and promotions

- **Refund policy:** shown in plain language: for example, unused post credits and invitation packs can be refunded within 7 days of purchase if none were used; plan charges can be refunded within a stated period if the service wasn't used; credits are restored automatically for platform errors; posts removed for policy violations aren't refunded. The exact rules are set by the platform after legal review and linked from the page.
- **Request a refund** on eligible invoices with a short reason and an expected timeline; status tracked in the invoice drawer. Refunds create credit notes.
- **Trials:** an optional free trial of a paid plan. No payment method is required to start unless the platform decides otherwise, and the page states what happens at the end (moves to Pay as you go by default).
- **Promo codes and referrals:** a field for codes with validation messages; referral credits (if offered) appear in My credits with expiry dates.
- **No dark patterns:** no pre-ticked add-ons, no countdown timers, no fake scarcity, no confusing double-negatives, no auto-upgrades, no featured-listing nags during job creation.

## 9. States

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| New company | Short explainer of plans vs packs ("Plans renew. Packs are one-time.") and the first job post is clearly priced; if the platform offers a free first post, it is highlighted calmly |
| Not verified | Purchasing works; a note says credits are used only when publishing, and publishing needs verification |
| Purchase success | Success card with receipt, what was added and **Post a job** or **Open Talent Search** |
| Purchase failed | Inline error with the reason (card declined, UPI timeout) and **Try again** or **Use another method**; no credits added, no charge repeated without confirmation |
| Payment pending (UPI or bank delay) | Banner "Payment pending. We'll update this when it's confirmed." with the reference; credits arrive on confirmation |
| Invoice billing pending | "Waiting for payment" with due date; purchases activate per approved terms |
| Trial ending | Warning banner 3 days before with the end date and what happens next |
| Past due | Warning banner with the amount, grace period end and **Update payment method**; new posts are blocked after the grace period; live jobs and data stay |
| Plan cancelling | Warning chip with the end date and **Resume plan** |
| Credits expiring in 7 days | Warning chip in My credits and a notification |
| Limit reached | Meter in error tint with options; existing jobs and pipelines keep working |
| Over the active-post limit after a downgrade | Banner explaining that live jobs continue until their end date and new posts need a higher plan or a pack |
| Refund issued | Chip on the invoice and a note with amount and timing; credit note available |
| Duplicate charge detected | Banner with **Request a refund** and **Contact support** prefilled |
| Spending cap reached | Message with the cap and **Ask an Owner to raise it** |
| Approval pending | Chip "Waiting for approval from {Owner}" with **Remind** |
| Company paused or suspended | Read-only billing history with a banner and **Contact support** |
| Non-Owner viewer | Plan, usage and invoices visible read-only for Admins; Billing contact sees invoices only; others don't see the page |
| Offline | Cached history; purchases and changes disabled until reconnected |
| Loading error | Inline message with **Retry**; other tabs stay usable |

## 10. Role-based behavior (team roles)

| Team role | What the page shows |
|---|---|
| **Owner** | Everything: plan, packs and add-ons, usage, seats, invoices, payment methods, billing details, spending controls; can buy, change and cancel |
| **Admin** | Plan, packs, usage, seats and invoices, read-only; may buy within the limit the Owner set (if allowed); cannot change plans, payment methods, billing details or spending controls |
| **Billing contact** (optional finance member) | Invoices, statements, tax documents and billing details (read-only); no access to hiring data or candidates |
| **Recruiter, Hiring manager, Interviewer, Viewer** | No access to the page; inside the product they see only plain limit messages ("Ask an Owner or Admin") |

- **Multi-role users:** a founder, mentor, investor or job seeker who is also an employer has a separate billing page for each role (`/startup/billing`, `/mentor/earnings`, `/investor/billing`, `/jobseeker/billing`, `/employer/billing`). Plans, usage and invoices never mix across roles, and the role switcher shows which role's billing is open.
- **Startups on the platform:** a startup's own plan, packs and job-posting fees live under `/startup/billing`; a company account that is also a startup on the platform sees them in the role switcher. Posts aren't charged twice.
- **Other roles:** startup (without an employer account), mentor, investor and job seeker users get a 403 page ("This page is for employers") with a link to their own home.

## 11. Motion

- 150–200ms ease-out for hover and focus; usage bars animate once on load (600ms). Prices and counts never animate as counters.
- Respect `prefers-reduced-motion` (no animations, instant render).

## 12. Accessibility

- WCAG 2.1 AA; gold text uses `--gold-dark` on light backgrounds.
- The plan comparison is a real table with proper headers; the current plan is marked in text ("Current plan"), not only by color.
- Usage meters show numbers as well as bars; every chart has a text summary and a **View as table** toggle.
- Prices, taxes and billing periods are announced in a consistent order ("₹4,999 per post, plus 18% GST").
- The monthly or annual toggle and the plan cards are keyboard operable; modals and drawers trap focus and return it to the trigger on close.
- Payment forms support autofill, clear error messages and password-manager use. Touch targets at least 44×44px.

## 13. Privacy, fairness and conduct rules

- **Payment data:** handled by the payment provider; the platform stores only masked details, tokens and billing records, encrypted in transit and at rest. Billing records follow the platform's retention policy and applicable tax law.
- **Billing never reaches candidates or other roles:** a company's plan, spend and invoices are not shown to candidates, investors, mentors or other employers.
- **Payment never changes the rules:** verification, moderation, posting rules, candidate fairness and reply-time expectations apply to every company regardless of plan. Featured listings are clearly labeled and can't be bought for jobs that are flagged or paused.
- **No fees to candidates:** the page states this and the Trust and Safety rules reinforce it; any attempt to charge candidates is a violation.
- **Taxes and invoices:** the platform shows tax (for example, GST), generates tax invoices and supports TDS certificate uploads; it doesn't give tax advice.
- **Consent for recurring charges:** autopay requires an explicit, recorded agreement; reminders arrive before renewal; cancelling stops future charges immediately.
- **Fraud and account takeover protection:** payment method changes, billing detail changes and large purchases require re-authentication, send security emails to Owners and Admins, and may be held for review if unusual. Invoice-billing requests are verified before approval.
- **Data handling:** follows the platform's privacy policy and applicable law (for example, India's DPDP Act). Companies can download their billing history and request deletion of data not required for tax and legal records.

## 14. Data and validation

| Field | Rule |
|---|---|
| Plan change | Takes effect per the shown proration; downgrades list what stops; re-authentication required (Owner) |
| Cancellation | Re-authentication; access continues to the end of the paid period |
| Pack purchase | One-time; credits added only after confirmed payment; expiry shown before paying |
| Job post credit | Used on publish only; restored on platform error; not restored for policy removal |
| Featured listing | Only for open, compliant jobs; labeled; limited slots; start date in the future or immediate |
| Invitation packs | Unused invitations expire after 90 days; daily limits still apply |
| Promo code | Validated on entry; one code per purchase; shows what it changes before paying |
| Payment method | Validated by the payment provider; masked after saving; re-authentication to add or change |
| Autopay | Explicit recorded consent; advance notice before each recurring charge as required by law |
| Billing details | Legal name, address and email required; GSTIN format validated and cross-checked; PAN masked after saving |
| Purchase order number | Optional; up to 40 characters; printed on invoices |
| Spending cap and threshold | Positive amounts; changes logged; Owner only |
| Refund request | Reason required; within the policy window; one request per charge |
| TDS certificate upload | PDF, up to 10 MB, virus scanned; linked to an invoice period |
| Exports | Only the company's own invoices and usage; Billing contact limited to financial documents |

**Audit log:** plan changes, purchases, payment method changes, billing detail changes, spending control changes, refund requests, TDS uploads, invoice downloads and exports, each with user and time (visible in `/employer/activity`).

## 15. Notifications for this page

| Event | Who is notified | Channel |
|---|---|---|
| Purchase receipt (plan, pack or add-on) | Owner, billing contacts | Email, in-app |
| Plan renewal in 7 days and 1 day | Owner, billing contacts | Email, in-app |
| Payment failed or retried | Owner, billing contacts | Email, in-app |
| Trial ending in 3 days | Owner | In-app, email |
| Plan changed, paused or cancelled | Owner, Admins | Email |
| Credits low (80 percent used) or expiring in 7 days | Owner, Admins | In-app |
| Active-post or invitation limit reached | Owner, Admins, job owner | In-app |
| Approval needed for a purchase | Approving Owner | In-app, email |
| Spending cap reached | Owner | In-app, email |
| Invoice available | Owner, billing contacts | Email |
| Refund issued or declined | Owner, billing contacts | Email, in-app |
| Payment method or billing details changed | Owner, Admins | Email (security alert) |
| Invoice billing approved or declined | Owner | Email, in-app |

Owners and Admins can mute usage notifications in Settings. Billing receipts, failures and security alerts cannot be muted. Notification text never includes full card details.

## 16. Data connections

| Feature | Connected to |
|---|---|
| Plans, packs, add-ons, invoices, payment methods | ERP billing, payment provider, tax settings |
| Plan and pack entitlements | Entitlements service (plan-based), enforced for active jobs, featured listings, invitations, seats, templates, analytics and exports |
| Job post credits | Job Editor publish step (`/employer/jobs/new`, `/employer/jobs/:jobId/edit`) |
| Featured listings | Candidate Job Search and Startups Hiring (`/jobseeker/jobs`, `/jobseeker/startups`), moderation checks |
| Invitations | Talent Search and Shortlists (`/employer/talent`) |
| Seats | Team and Permissions (`/employer/team`) |
| Verification status | Admin console, employer verification (`/employer/verification`) |
| Receipts and notifications | ERP notification service |
| Refunds, disputes, support tickets | Admin console, support system |
| Promo codes and referrals | Marketing and referral service |
| Audit log | Activity and Audit Log (`/employer/activity`) |
| Role and permissions | Identity and access (role-based and team-role-based, set up by the project owner) |

## 17. CSS tokens

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

## 18. Build order (suggested)

1. Role guard and team-role checks (Part A9), plus the entitlements service, so limits are enforced on the server from the start.
2. **Plan tab** with Pay as you go and a read-only plan comparison, then **Usage** meters.
3. **Payment methods** and the payment provider integration, including re-authentication, failure handling and security emails.
4. **Job posts and add-ons:** single post and packs first (credits consumed on publish), then featured listings and invitation packs.
5. **Invoices** with GST details, credit notes and PDF downloads, then **Billing details** and TDS uploads.
6. **Plan changes and cancellation** with proration and the grace period (subscriptions).
7. **Seats**, **Spending controls**, and invoice billing for eligible companies.
8. Refunds, promo codes, trials and referrals.
9. Notifications, empty, loading and error states, then mobile layouts.

**Suggested first release:** Pay as you go with the single post and 3-post packs, Usage, Invoices and Payment methods. Packs are easier to launch than subscriptions because they avoid recurring-charge rules and cancellation flows; add Growth and Scale subscriptions, featured listings and invitation packs once the first employers are hiring. Your proposal recommends recruiting a small set of anchor employers early, so consider a free or discounted first post. Plan names, limits and prices should be configurable, not hard-coded, because your proposal says prices are set after market research.

**Reminder for the build:** this page is employer-only and role-based, limited by team role. Add the guard and entitlement checks first, restrict plan, payment and billing changes to the Owner, filter all billing data on the server by company and team role, require re-authentication for plan changes, cancellation, payment methods and large purchases, never store full card numbers, never show billing to candidates, keep credits unused until a job is published, never let payment bypass verification or moderation, and write every plan, purchase, refund and payment-method change to the audit log. Get legal and tax advice on recurring-payment rules, refunds, GST and TDS handling, invoice billing and consumer or business-protection requirements before launch.

## Part A9. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `employer` role, as a member of a company account, can open `/employer/billing` |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup (without an employer account), mentor, investor and job seeker users see a 403 page ("This page is for employers") with a link to their own home; no billing data is fetched or rendered |
| **Multi-role users** | The role switcher changes the billing page and data; plans, usage and invoices never mix across roles |
| **Company scope** | All data is filtered by the company the user belongs to; the server checks membership on every request |
| **Team-role access** | **Owner:** full access and all changes. **Admin:** read-only on plan, usage, seats and invoices; may buy within the limit the Owner set. **Billing contact:** invoices, statements, tax documents and billing details read-only. **Recruiter, Hiring manager, Interviewer, Viewer:** no access to the page. Enforced by the server on every request |
| **Entitlements** | Feature limits (active jobs, featured listings, invitations, seats, templates, analytics depth, exports) are enforced on the server from the plan and credits, not only in the UI |
| **Sensitive actions** | Changing plan, cancelling, adding or changing a payment method, changing billing details or spending controls, and purchases above the approval threshold require re-authentication; a security email goes to Owners and Admins |
| **Separation of duties** | Where there are multiple Owners, purchases above the threshold need approval from an Owner other than the purchaser |
| **Verification** | Purchases are allowed before verification, but publishing consumes credits only after verification; the server enforces both |
| **Candidate and other-role visibility** | Billing, plan and spend are never returned in any candidate-facing or other-role response |
| **Admin view** | Platform admins can view this page read-only for support or disputes, with an "Admin view" banner; payment details are masked and access is logged |

Keep permission checks in one place (a guard component or middleware) so the page itself stays simple.
