# Admin Dashboard Design (production spec)

**App:** Platform admin console, served from its own subdomain (for example `admin.yourdomain.com`).
**Page:** Admin Dashboard, route `/dashboard` (the old `/admin/dashboard` prefix is no longer needed on the subdomain).
**Users:** the internal team only: verification reviewers, trust and safety moderators, support agents, finance, content and program managers, AI quality reviewers, compliance officers, analysts and super admins.

The dashboard is the internal team's home screen. It answers four questions in a few seconds: **What needs me now? What is about to breach a deadline? Is the platform healthy? Is anything unusual happening?** It supports the admin responsibilities in your proposal: verify, moderate, support and report, with approvals, dispute handling, content and template management, and audit logs. It keeps the product's visual language (ink, ivory, one gold accent) but is denser and faster, because staff use it all day.

> **Why there is no per-route role-based file for admin:** the admin console is a separate app on its own subdomain, so it doesn't share routes with the public product. Staff permissions still decide **what each person sees on this page** (for example, finance doesn't see verification queues), so this spec includes a short visibility table (Part 5). That is content scoping inside the app, not a route guard design. Section 12 lists what the subdomain itself must provide, because a separate address protects nothing on its own: it still needs sign-in, two-factor and server-side permission checks on every request.

---

## 1. Design principles

- **Work first, charts second:** queues, deadlines and alerts lead. Charts and trends sit below.
- **Time is the main signal:** every queue shows its oldest item and how close it is to its service target. People see what is aging before it is late.
- **Calm under pressure:** few colors, clear severity, no flashing or alarm sounds. A real incident is unmistakable but not frantic.
- **Counts and IDs, not personal data:** the dashboard shows numbers, categories and record IDs. Names, messages, documents and financial details live on the detail pages with masking and logged access.
- **Fair queues:** work is ordered by severity, deadline and age, never by personal characteristics of the people involved, and never auto-assigned in a way that hides items.
- **One person per item:** claiming an item locks it so two staff don't review the same case.
- **Honest data:** every number shows when it was last updated. Stale or missing data is labeled, never hidden or guessed.
- **Safe by design:** destructive actions don't exist on this page. It links to detail pages where confirmation, reasons and dual control apply.

---

## 2. Design tokens

Same palette as the product, plus a dark theme because the admin console is used for long sessions.

### Light theme (default)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Sidebar background, hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, focus ring, "your next item" |
| `--gold-dark` | `#9A7A45` | Gold text and links on light backgrounds |
| `--gold-tint` | `#F3EBDD` | Highlight backgrounds, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, tracks, gridlines |
| `--success` | `#2E7D5B` | Healthy, within target |
| `--warning` | `#B7791F` | Approaching target, degraded |
| `--error` | `#B42318` | Breached, outage, errors |
| `--info` | `#2F5D8A` | Neutral information, scheduled maintenance |

### Dark theme

| Token | Hex |
|---|---|
| `--bg` | `#0B1422` |
| `--surface` | `#142033` |
| `--surface-raised` | `#1A2A42` |
| `--text` | `#F2EFE8` |
| `--text-muted` | `#A9B2C1` |
| `--border` | `#26364D` |
| `--gold` | `#C9A66B` |
| `--success` / `--warning` / `--error` | `#4FB08A` / `#D9A441` / `#E5675C` |

The theme follows the system setting by default and can be set per user. Contrast meets WCAG AA in both themes (gold text uses `--gold-dark` on light).

### Typography

| Element | Font and size |
|---|---|
| Page title | `Fraunces` / `Playfair Display` 28px, 600 |
| KPI and queue numbers | `Fraunces` 32px, 600 (tabular figures) |
| Card title | `Inter` 15px, 600 |
| Body and table text | `Inter` 14px, 400 |
| Caption, meta, axis | `Inter` 12px, 400, `--stone-700` |
| IDs, hashes, timestamps | `JetBrains Mono` or system mono, 12–13px |

All timestamps use **Asia/Kolkata (IST) by default** with a visible time zone label and a user setting. Machine-readable ISO times are available on hover.

### Spacing and shape
8px base grid (4/8/12/16/24/32). Cards: white, 1px `--stone-200` border, radius 12px, padding 20px (dense) or 24px (default). Controls: radius 10px, 40px tall (36px in dense tables). Density toggle: **Comfortable** (default) and **Compact**.

---

## 3. Layout

### Desktop (≥ 1280px, primary target)
```
┌──────┬──────────────────────────────────────────────────────────┐
│      │ ENVIRONMENT STRIP (production)  ·  incident banner (if any)│
│ Side ├──────────────────────────────────────────────────────────┤
│ bar  │ Top bar: [⌘K Search / commands]  ·  status · alerts · you │
│ 232px├──────────────────────────────────────────────────────────┤
│      │ Title "Dashboard"  ·  last updated 14:32 IST  [Refresh]   │
│      ├──────────────────────────────────────────────────────────┤
│      │ NEXT UP (your suggested next item)                        │
│      ├──────────────────────────────────────────────────────────┤
│      │ QUEUES grid (cards: count · oldest · SLA status)          │
│      ├───────────────────────────────┬──────────────────────────┤
│      │ NEEDS ATTENTION (feed)        │ PLATFORM HEALTH          │
│      │ Alerts · breaches · expiring  │ Services · incidents     │
│      ├───────────────────────────────┼──────────────────────────┤
│      │ PLATFORM PULSE (charts)       │ DEADLINES & COMPLIANCE   │
│      │                               │ TEAM WORKLOAD · MY WORK  │
└──────┴───────────────────────────────┴──────────────────────────┘
```
- 12-column grid, 24px gutters, max content width 1600px, page padding 32px.
- The sidebar is fixed; the top bar is sticky; the environment strip is always visible.

### Tablet (768–1279px)
Sidebar collapses to a 72px icon rail. Right-hand cards move below. Queue grid becomes 2 across.

### Mobile (< 768px, limited by design)
Read-and-triage only: critical alerts, incident status, queue counts and "Next up" open in read-only form. Review and approval actions are disabled on phones with the message "Open on a computer to review." This keeps sensitive review work on managed devices.

### Sidebar (ink-soft background, ivory text)
Dashboard · Verifications · Moderation · Reports · Appeals · Disputes · Fraud · Support · Data requests · Users · Organizations · Content · Templates · Rubrics · Events · Billing · Analytics · Compliance · Audit · System · Configuration. Items a person can't use are hidden, not greyed out. Count badges appear on queue items (gold for approaching target, red for breached). Bottom: Settings, Runbooks, theme switch.

### Top bar
- **Global search and command palette** (`⌘K` or `Ctrl+K`, also `/`): search by user ID, email, organization name, job ID, ticket ID, offer ID or invoice number; run commands ("Go to moderation queue", "Open my claimed items"). Results show IDs, type and status only; opening a record applies the normal masking and logging rules.
- **System status dot** (green, amber, red) linking to the System page.
- **Alerts bell** with a count of unacknowledged high-severity alerts.
- **Profile menu:** your internal role, session timer, theme, density, sign out.

### Environment strip
A thin bar at the very top: `PRODUCTION` (ink background, ivory text) or `STAGING` (gold background, ink text) so staff never confuse environments. Staging never shows real user data.

---

## 4. Sections and components

### 4.1 Incident banner (conditional)
Appears under the environment strip when an incident is open or maintenance is scheduled within 24 hours.
- **Outage:** error-tint background, icon, one-line summary ("Payments are failing for some users"), start time, owner, **Open incident**.
- **Degraded:** warning tint.
- **Scheduled maintenance:** info tint with the window and affected services.
- Dismiss is per session for maintenance only; incident banners can't be dismissed while the incident is open.

### 4.2 Next up
A single card (gold-tint background, `Suggested` label) that proposes the most important item **this person can act on now**, using the ordering rule in 4.3. It shows: queue name, item ID, category, how long it has waited, its service target, and why it's first ("Breaches in 40 minutes"). Buttons: **Start** (claims the item and opens its detail page), **Skip** (moves to the next item and records a skip; skipped items remain visible in the queue), **View queue**.
- Claiming locks the item for 10 minutes (extended while active, released on leave or timeout), visible to others as "Being reviewed by {name}."
- If there is nothing to do: "You're all caught up. Nothing is waiting in your queues."
- The suggestion never hides items from the queue and never uses personal characteristics of anyone involved.

### 4.3 Queue cards (the core)
A responsive grid (4 across on wide screens). One card per queue the person's internal role can work. Each card:
- **Title** and icon (for example "Verifications · Startups").
- **Count** (large serif number): items waiting. Optional second number: "3 assigned to you."
- **Oldest item age** ("Oldest: 1d 6h").
- **SLA status chip:** `On track` (success tint), `At risk` (warning tint, over 75% of the target used by the oldest or by 10% of items), `Breached` (error tint, with the number of breached items).
- **Mini bar:** distribution of items by age band (under 25%, 25–75%, over 75%, breached of the service target).
- **Trend arrow** vs the same weekday last week (text and arrow, for example "▲ 6 vs last week").
- **Action:** **Open queue** (link); the whole card is also clickable.

Queues and default service targets (all configurable in Configuration, shown here as defaults):

| Queue | Route | Default first-response or decision target | Urgent rule |
|---|---|---|---|
| Verifications · Startups | `/verifications?type=startup` | 2 business days | Expiring access, re-verification triggers |
| Verifications · Mentors | `/verifications?type=mentor` | 3 business days | Conflict flags first |
| Verifications · Investors (KYC) | `/verifications?type=investor` | 2 business days | High-risk flags first |
| Verifications · Employers | `/verifications?type=employer` | 2 business days | Companies with live drafts waiting |
| Moderation | `/moderation` | 4 hours (normal), 1 hour (high severity) | Child safety, fraud and threats are always severity 1 |
| Reports | `/reports` | 24 hours | Fee requests and impersonation first |
| Appeals | `/appeals` | 5 business days | Restrictions that block hiring or funding |
| Disputes | `/disputes` | 5 business days | Held funds first |
| Support tickets | `/support` | 1 business day (normal), 2 hours (urgent) | Safety, fraud, payment, account security |
| Data rights requests | `/data-requests` | Legal due date, internal target half of it | Nearest legal deadline first |
| Fraud alerts | `/fraud` | 1 hour for high risk, 1 business day otherwise | Active payment or account takeover signals |
| AI quality reviews | `/ai-quality` | 5 business days | Requests tied to scores shared with employers |
| Payout and refund approvals | `/payouts` | 1 business day | Dual-control items waiting on a second approver |
| Re-verification and expiring | `/verifications/expiring` | Before expiry date | Expires within 7 days |

**Ordering rule (inside a queue and for "Next up"):** severity first, then time remaining to target (least first), then age. Ties break by oldest. Nothing else is used.

**Card states:** loading (skeleton), `On track`, `At risk`, `Breached`, empty ("Nothing waiting"), error (card-level message with **Retry**), stale (chip "Updated 6 min ago" in warning tint when data is older than 2 minutes).

### 4.4 Needs attention (feed)
A prioritized list (up to 8, **View all**) of items that need a human even if they aren't in a queue:
- SLA breaches ("12 support tickets breached target")
- Fraud or abuse spikes ("Fee-request reports up 40% in 1 hour")
- Verification expiring soon (counts by role)
- Data request deadlines within 7 days
- Held payments or failed payout batches
- Provider problems (KYC, payments, video, speech-to-text, email)
- Pending dual-control approvals waiting on you
Each row: severity icon (with text label), one-line description, count, age, and one button (**Open**). Rows are acknowledged with **Acknowledge** (records who and when; the row stays until resolved or until it ages out). High-severity rows ask for a note on acknowledgment.

### 4.5 Platform health
A compact status table of services, each with a status chip (`Operational`, `Degraded`, `Outage`, `Maintenance`), a one-line metric and a trend:
- Web and API (availability, p95 latency, error rate)
- Authentication and sign-in
- Payments and billing (success rate, failed payments in the last hour)
- Email and notifications (delivery rate, queue lag)
- Video sessions (join success rate)
- AI services: interviewer and feedback (queue lag, error rate), speech-to-text, resume AI
- Search and recommendations (index freshness)
- Verification providers (KYC, business checks)
- File storage and virus scanning (scan queue lag)
Each row links to the System page. Data comes from monitoring, not from user-reported issues. Below the table: **Open incidents** (count and links) and **Upcoming maintenance**.

### 4.6 Platform pulse (charts)
Descriptive, last 24 hours or 7 days (toggle). Charts use ink for the main series, gold for the highlight and stone-400 for comparison; direct labels; **View as table**.
- **New registrations by role** (stacked bars): startups, mentors, investors, job seekers, employers.
- **Verification funnel:** submitted → approved → rejected → needs changes, by role.
- **Active jobs and applications per day** (lines).
- **Sessions:** mentor sessions held, practice interviews completed, interviews scheduled.
- **Payments:** success rate and failed count; revenue today vs the same weekday last week (amounts shown only to roles that may see finance data).
- **Support volume** and first-response time.
Aggregates only. No chart shows an individual user, and groups under 10 are merged. Anything over the user's permission is hidden, not greyed.

### 4.7 Deadlines and compliance
- **Data rights requests due soonest:** count by due date bucket (Overdue, today, next 3 days, next 7 days), with the nearest legal date.
- **Legal holds and retention jobs:** count of holds, next scheduled retention run.
- **Policy and legal document updates pending:** versions awaiting publication.
- **Audit exports requested** (Compliance officers).
Each links to its page.

### 4.7a Team workload
A neutral view of how work is spread: for each queue, items unassigned, assigned and in review, and the number of people currently active. It shows **counts**, not rankings of people, and doesn't display personal productivity scores or per-person speed. A **Rebalance** action (supervisors only) opens the assignment tool on the queue page. The panel states: "Workload is shown to spot backlogs, not to rate individuals."

### 4.8 My work
A short list of items **claimed by the person** (with time since claimed, queue, ID and **Resume**), and items **returned to them** (for example, a verification awaiting the applicant's response, now updated). Items held over 24 hours show a gentle reminder to finish or release them.

### 4.9 Recent changes (optional, collapsed)
The person's last 5 actions with times and links (from the audit log) and recent platform changes that affect their work ("Posting rules updated 4 Nov", "Rubric v3 published"). Links to **Audit** and **Release notes**.

---

## 5. What each internal role sees (content scoping)

This is a view of the dashboard, not a route design. The server enforces permissions on every data request; the UI only reflects them.

| Internal role | Queues shown | Other sections |
|---|---|---|
| Super admin | All | All, including configuration changes and staff alerts |
| Verification reviewer | Verifications (all types), expiring | Health (summary), Deadlines (verification-related), My work |
| Trust and safety moderator | Moderation, Reports, Appeals, Fraud | Needs attention (safety and fraud), Health (summary), Pulse (safety counts), My work |
| Support agent | Support tickets, Data rights requests (assigned subset) | Needs attention (support), Health (summary), My work |
| Finance | Payout and refund approvals, Disputes (payment-related) | Payments pulse with amounts, billing alerts, Health (payments), My work |
| Content and program manager | None, or content review items | Pulse (content and events usage), pending content and policy updates |
| AI quality reviewer | AI quality reviews | AI service health, Pulse (practice sessions), My work |
| Compliance officer | Data rights requests, legal holds | Deadlines and compliance, audit export status |
| Analyst | None | Pulse (aggregated only), read-only |

A person with several internal roles sees the union of their roles. Hidden sections are removed from the page, not left as empty frames.

---

## 6. Interaction details

### Real-time and refresh
- Queue counts, alerts and health update **live** (server push), with a polling fallback every 30 seconds. Charts refresh every 5 minutes.
- The header shows "Updated 14:32:08 IST" and a **Refresh** button. If push is disconnected for over 60 seconds, a small banner reads "Live updates paused. Reconnecting…" and data is labeled as stale.
- New items increase counts without moving cards; a small "+3 new" chip appears on the card for 10 seconds.
- No sounds. Optional desktop notifications (off by default) for severity-1 alerts, with the title only, no personal data.

### Claiming and locks
Items are claimed from detail pages or **Next up**. A lock lasts 10 minutes and renews while the page is active. If someone abandons an item, it returns to the queue and shows "Released after 10 minutes of inactivity." Supervisors can release locks with a reason.

### Keyboard shortcuts
| Keys | Action |
|---|---|
| `⌘K` / `Ctrl+K` or `/` | Open search and command palette |
| `g` then `d` | Go to Dashboard |
| `g` then `v`, `m`, `r`, `s` | Go to Verifications, Moderation, Reports, Support |
| `j` / `k` | Move between items in a feed or list |
| `Enter` | Open the focused item |
| `a` | Acknowledge the focused alert |
| `n` | Start the **Next up** item |
| `?` | Show all shortcuts |
Shortcuts are disabled while typing in a field and can be switched off in Settings.

### Search and command palette behavior
- Recent items and suggested commands appear before typing.
- Search is across IDs and names the person may access. Results never preview message text, document contents or financial values.
- A result opens the record's page; sensitive fields remain masked until revealed with a reason (logged).

### Notifications to staff
High-severity alerts go to the bell and email/chat integration for on-call staff. Alert text uses IDs and categories only.

---

## 7. States

| State | Behavior |
|---|---|
| Initial load | Skeleton cards in the final layout; first meaningful content in under 1.5 seconds on a typical office connection |
| Empty queue | Card shows "Nothing waiting" with a check icon; the count reads 0 |
| All caught up | "Next up" shows the all-clear message |
| SLA at risk | Card chip `At risk`, sidebar badge turns gold; the feed gets a row |
| SLA breached | Card chip `Breached` with count; feed row; sidebar badge turns red; supervisors are notified |
| Card data failed | That card shows an inline error with **Retry**; other cards remain usable |
| Partial service outage | Cards depending on the failed service show "Data unavailable" with the reason and the last known value (labeled with its time); the health table highlights the service |
| Stale data | Warning chip "Updated 6 min ago" on affected cards |
| Live updates disconnected | Banner and stale labels; manual **Refresh** still works |
| Incident open | Banner under the environment strip; relevant cards annotated |
| Maintenance window | Info banner; actions that need the affected service are disabled with an explanation |
| Session about to expire | A banner 2 minutes before the idle timeout with **Stay signed in**; then the screen locks and asks for re-authentication (see section 12) |
| Permission change during session | If a person's access changes, the dashboard reloads with the new view and a notice; revoked access ends in-flight claims |
| No access to any queue | "You don't have any queues assigned. Ask a Super admin." with a link to Staff |
| Offline | Banner "You're offline." Cached read-only view; no actions |
| Staging | Strip shows STAGING; all data is synthetic and labeled |

---

## 8. Copy (production strings)

| Where | Text |
|---|---|
| Page title | Dashboard |
| Last updated | Updated {time} IST |
| Next up label | Suggested next item |
| Next up reason | Breaches in {duration} · Oldest in this queue · Legal deadline in {days} days |
| Start button | Start review |
| Skip button | Skip for now |
| Queue empty | Nothing waiting |
| SLA chips | On track · At risk · Breached |
| Live paused | Live updates paused. Reconnecting… |
| Stale | Updated {minutes} min ago |
| Mobile limit | Open on a computer to review. |
| Workload note | Workload is shown to spot backlogs, not to rate individuals. |
| Lock | Being reviewed by {name} |
| Acknowledge note prompt | Add a short note for the team (required for severity 1) |

All strings go through the internationalization layer (English first), with plural rules and IST-aware date formatting.

---

## 9. Accessibility

- WCAG 2.1 AA in light and dark themes.
- Status uses text and icons as well as color (for example `At risk` with a clock icon).
- Every chart has a text summary and a **View as table** toggle; series use labels or dash patterns as well as color.
- Fully keyboard operable, with a visible gold focus ring, a skip-to-content link and landmarks (`header`, `nav`, `main`, `aside`).
- Live regions announce important changes politely ("Support queue now at risk") without stealing focus.
- Reduced motion: no animations, instant updates. Targets at least 44×44px on touch devices; dense mode keeps at least 32px with adequate spacing.
- Screen reader names for queue cards include count, oldest age and SLA status ("Verifications, startups. 7 waiting. Oldest 1 day 6 hours. On track.").

---

## 10. Data contract (for the build)

The dashboard reads from a single aggregated endpoint plus a live channel, so each card isn't a separate slow query.

### `GET /api/dashboard`
Returns data scoped to the caller's internal roles (server-side). Example shape:

```json
{
  "generatedAt": "2026-11-06T09:02:08+05:30",
  "environment": "production",
  "nextUp": {
    "queue": "support",
    "itemId": "TCK-48213",
    "category": "payment",
    "severity": 2,
    "waitingSeconds": 5400,
    "targetSeconds": 7200,
    "reason": "breaches_in",
    "reasonValue": 1800
  },
  "queues": [
    {
      "key": "verifications_startup",
      "label": "Verifications · Startups",
      "count": 7,
      "assignedToMe": 1,
      "oldestSeconds": 108000,
      "targetSeconds": 172800,
      "atRiskCount": 2,
      "breachedCount": 0,
      "ageBands": { "lt25": 3, "25to75": 2, "gt75": 2, "breached": 0 },
      "weekdayTrend": 6,
      "updatedAt": "2026-11-06T09:02:05+05:30",
      "link": "/verifications?type=startup"
    }
  ],
  "attention": [
    { "id": "al_912", "severity": 1, "type": "sla_breach", "text": "12 support tickets breached target", "count": 12, "ageSeconds": 2400, "link": "/support?sla=breached", "acknowledged": false }
  ],
  "health": [
    { "service": "payments", "status": "degraded", "metric": "success_rate", "value": 0.962, "trend": "down", "link": "/system#payments" }
  ],
  "incidents": [{ "id": "inc_77", "status": "open", "severity": "minor", "title": "Payment retries delayed", "startedAt": "2026-11-06T08:41:00+05:30" }],
  "maintenance": [],
  "pulse": { "range": "24h", "registrationsByRole": [], "verificationFunnel": [], "payments": { "successRate": 0.981, "failed": 14 } },
  "deadlines": { "dataRequests": { "overdue": 0, "today": 1, "next3": 2, "next7": 5, "nearestDueAt": "2026-11-07T18:00:00+05:30" } },
  "workload": [{ "queue": "support", "unassigned": 9, "assigned": 14, "inReview": 5, "activeStaff": 6 }],
  "myWork": [{ "queue": "moderation", "itemId": "MOD-9981", "claimedSeconds": 900 }]
}
```

Rules:
- All numbers, IDs and categories only. No names, emails, message text, document names or amounts in this payload unless the caller's role may see the aggregate (finance amounts are aggregated and rounded).
- Every field the caller isn't allowed to see is omitted, not nulled.
- Times are ISO 8601 with offset; the UI formats them in the user's time zone (IST by default).
- Cache for 15 seconds; `ETag` supported. Live updates come over a WebSocket or server-sent events channel (`/api/dashboard/stream`) with the same shapes for deltas.

### Actions
- `POST /api/queues/{queue}/items/{id}/claim` returns a lock (`lockExpiresAt`) or a conflict with the current holder's display name.
- `POST /api/alerts/{id}/acknowledge` with `{ note }` (required for severity 1).
- `POST /api/queues/next/skip` with `{ itemId }` (recorded, doesn't remove the item).

### Computation notes
- **Service target time** counts business days and hours per the configured calendar (IST working hours and holidays); urgent targets use clock time.
- **At risk:** the oldest item has used 75% or more of its target, or at least 10% of items have.
- **Breached:** any item past its target.
- **Trend:** count compared with the same weekday and hour last week; hidden when fewer than 5 items either side.
- **Pulse minimum group size:** 10; smaller groups are merged into "Other."

---

## 11. Performance and reliability targets

| Metric | Target |
|---|---|
| First meaningful paint | Under 1.5 s (p75, office network) |
| Dashboard payload | Under 60 KB gzipped |
| API response (`/api/dashboard`) | p95 under 400 ms |
| Live update latency | Under 3 s from event to card |
| Availability | 99.9% (monthly) for the dashboard itself |
| Degraded mode | If aggregation fails, serve last good payload (labeled stale) for up to 15 minutes, then show per-card errors |
| Client memory | No leaks over an 8-hour session; stream reconnect with exponential backoff and jitter |
| Browser support | Latest two versions of Chrome, Edge, Firefox, Safari |

---

## 12. Security, privacy and operations (subdomain requirements)

A separate subdomain helps by isolating cookies and scripts, but it only works together with these controls.

**Access and sign-in**
- Dedicated admin identity: single sign-on through the company's identity provider, **mandatory two-factor** (hardware key or authenticator app, no SMS), no shared accounts, no sign-in with public-product credentials.
- Optional allowlist (company VPN or approved IP ranges) in addition to sign-in.
- **Session rules:** idle timeout of 15 minutes (lock screen, then re-authentication), absolute session length of 8 hours, one active session per person per device class, and sign-out everywhere on password reset.
- **Re-authentication** before sensitive actions on linked pages (revealing masked data, approving payouts, overriding verifications, changing configuration). **Dual control** where the other pages require it.
- Permissions are checked on the server for every request. The UI's hiding of sections is a convenience, not a control.

**Separation from the public app**
- Separate origin (`admin.yourdomain.com`), separate cookies scoped to that host only (`Secure`, `HttpOnly`, `SameSite=Strict`), no cookie sharing with the main domain.
- No links from the public product to the admin console, and the console is excluded from search engines (`noindex`, blocked by robots and headers).
- Strict Content Security Policy, no third-party scripts or trackers, subresource integrity for any external assets, CSRF protection and CORS limited to the admin origin.
- Separate deployment and secrets from the public app; admin APIs aren't reachable from the public API gateway.
- DNS and TLS: HSTS with preload eligibility, TLS 1.2 or higher, certificate monitoring; protection against subdomain takeover (no dangling DNS records).

**Privacy and data minimization**
- The dashboard shows counts, IDs and categories only. No personal data, message text, documents or exact financial amounts appear here.
- Pages the dashboard links to apply masking by default and log every reveal with a reason.
- Screenshots and exports of detail pages follow company policy. The dashboard carries a small footer: "Don't copy personal data out of this console."
- Admins never impersonate users. Support and review pages use read-only "Admin view" renders.

**Auditing**
- Every dashboard interaction that changes state (claim, skip, acknowledge, release) is written to the platform audit log with user, time, item ID and note. Opening the dashboard itself is logged at a session level.
- The audit log is append-only. Audit and monitoring access follow separate permissions.

**Operations**
- Feature flags for each card and the live channel, so a faulty component can be disabled without redeploying.
- Error tracking and performance monitoring without personal data in payloads.
- Runbooks linked from the Health card (restart, failover, provider contact) and from each alert type.
- Change management: queue targets, severity rules and calendars are edited only in Configuration, with versioning and an audit entry.

---

## 13. Analytics and telemetry (internal)

Track usage of the dashboard to improve it, never to rank people:
- Card click-through, time-to-first-action by queue (aggregated), use of **Next up**, skip rate, search and shortcut usage.
- Alert acknowledgment latency (aggregated by alert type).
- Errors and slow cards.
No per-person performance dashboards are built from this telemetry, and the policy is stated in the team handbook and in the workload panel.

---

## 14. Acceptance criteria and QA checklist

**Functional**
- [ ] Each internal role sees only its queues and sections; hidden sections are absent from the DOM and from the API response.
- [ ] Queue counts, oldest age and SLA status match the source queue pages within 5 seconds of a change.
- [ ] `At risk` and `Breached` thresholds follow the configured targets and business calendar (verify across a weekend and an Indian public holiday).
- [ ] **Next up** follows the ordering rule (severity, time to target, age) and respects locks; skipping records an event and doesn't hide the item.
- [ ] Claiming locks an item for others; lock expiry and release work; conflicts show the holder.
- [ ] Alerts can be acknowledged; severity 1 requires a note; acknowledgments appear in the audit log.
- [ ] Incident banner appears and clears with the incident; maintenance banner shows 24 hours ahead.
- [ ] Live updates work; disconnect shows the paused banner and stale labels; reconnect resumes without a full reload.

**Security and privacy**
- [ ] No personal data, message text, document names or exact amounts appear anywhere on the dashboard or in `/api/dashboard`.
- [ ] Idle timeout locks the screen at 15 minutes; re-authentication restores the session; absolute session limit enforced.
- [ ] Permissions are enforced on the server; tampering with the client doesn't reveal other roles' data.
- [ ] Cookies are host-scoped to the admin subdomain; CSP blocks inline and third-party scripts; the site is not indexable.
- [ ] Staging is visibly labeled and contains no real user data.

**Accessibility and quality**
- [ ] Keyboard-only use covers every action; focus order matches reading order; focus ring visible in both themes.
- [ ] Screen reader announces card name, count, oldest age and status; live regions don't steal focus.
- [ ] Contrast meets AA in light and dark themes; status isn't conveyed by color alone.
- [ ] Reduced motion honored; charts have text summaries and table views.
- [ ] Layout holds at 1280, 1440, 1920 px and at tablet width; mobile shows the read-only triage view.

**Performance and resilience**
- [ ] Targets in section 11 met on a typical office network; payload size within budget.
- [ ] Per-card failures don't break the page; aggregate failure falls back to the last good payload, labeled.
- [ ] 8-hour soak test shows no memory growth; stream reconnect works with backoff.

**Content**
- [ ] All strings come from the localization layer; plurals and IST formatting verified.
- [ ] Empty, loading, error, stale and offline states reviewed for every card.

---

## 15. Build order (suggested)

1. **Admin app foundation on the subdomain:** SSO, mandatory two-factor, session rules, environment strip, internal roles and server-side permission checks, platform audit log.
2. **Dashboard shell:** sidebar, top bar, theme and density, command palette (search by ID).
3. **Aggregation endpoint and queue cards**, starting with Verifications (startups and mentors), Support and Moderation, since those queues exist first. Add the other queues as their pages ship.
4. **Next up**, claiming and locks.
5. **Needs attention** feed with acknowledgment, then **Platform health** and the incident banner (fed by monitoring).
6. **Deadlines and compliance** (data rights requests) and **My work**.
7. **Platform pulse** charts and **Team workload**.
8. Live channel, dark theme polish, keyboard shortcuts, telemetry.
9. Accessibility, performance and security review against the checklist above, then a staged rollout (internal pilot with one team, then everyone).

**Suggested first release:** the foundation, queue cards for Verifications, Support and Moderation, Next up, Needs attention and Platform health. Charts and workload can follow once those queues have real traffic. Your proposal says to launch with startups and mentors first, so the first queues staff work will be startup and mentor verifications.

**Reminder for the build:** the subdomain is an isolation layer, not an access control. Keep mandatory two-factor, server-side permission checks, session limits, data minimization and the audit log in place from day one, and keep personal data off this page entirely. Get legal advice on staff access to personal data, KYC and data-protection obligations, and retention before launch.
