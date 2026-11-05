# Mentor Shared Pages Design

The four pages every role uses, adapted with **mentor content**. The layouts, components and behavior come from the shared designs you already have. This file defines only what changes for a mentor: the sidebar entry, the content, the mentor-specific options and the role rules. Colors and typography are unchanged: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> The page shells are shared across roles, but the **content, options and data are mentor-specific**. The project owner will add the role and permission logic, so build each page to load mentor content when the signed-in user is acting in the `mentor` role. Details are in **Part A3**. A user who is also a founder or job seeker sees the same page with that role's content after switching roles.

## Pages in this spec

| # | Page | Route | Mentor content |
|---|---|---|---|
| 1 | Messages | `/mentor/messages` | Conversations with startups, sessions and sign-off threads, admin and support |
| 2 | Notifications | `/notifications` | Mentor events: requests, sessions, sign-offs, deliverables, payments, events |
| 3 | Settings | `/mentor/settings` | Account, security, notification and privacy preferences, mentor-specific controls |
| 4 | Help and Support | `/help` | Mentor help topics, contact, tickets, report a concern |

Related mentor files: `mentor-core-design.md`, `mentor-sessions-signoff-design.md`, `mentor-money-recognition-design.md`.

---

# Part A. Shared foundations

## A1. What stays the same (use your existing designs)

- Page shell: sidebar, top bar, 12-column grid, card style (white, 1px `--stone-200` border, radius 12px, padding 24px).
- Components: lists, filters, tabs, toggles, drawers, modals, toasts, empty states, skeleton loaders.
- Tokens: `--ink #0F1B2D`, `--ink-soft #1C2B42`, `--ivory #FAF8F4`, `--white #FFFFFF`, `--gold #B8955A`, `--gold-dark #9A7A45`, `--gold-tint #F3EBDD`, `--stone-700 #4A5568`, `--stone-400 #A0A7B4`, `--stone-200 #E5E1D8`, `--success #2E7D5B`, `--warning #B7791F`, `--error #B42318`.
- Typography: `Fraunces` / `Playfair Display` for titles, `Inter` for UI.
- Motion, accessibility and responsive rules from your other designs (WCAG 2.1 AA, keyboard operable, `prefers-reduced-motion`, 44×44px touch targets).

## A2. What changes for the mentor role

| Area | Mentor version |
|---|---|
| Sidebar | The mentor sidebar (Dashboard, Requests, Discover startups, My startups, Sessions, Deliverables, Earnings, Impact and reviews, Messages). Messages shows an unread count; Settings and Help sit at the bottom with the role switcher |
| Route prefix | `/mentor/...` for Messages and Settings; `/notifications` and `/help` are shared routes that load mentor content |
| Data scope | Only the mentor's own conversations, notifications and settings |
| Banners | The "Your mentor profile is under review" banner appears on all four pages until verified |
| Mentor sidebar highlight | Active item uses `--ink-soft` background with a 3px gold bar at the left |

## A3. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Active role** | Content is loaded for the role the user is currently acting in. In the `mentor` role, these pages show mentor content only |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **`/mentor/messages` and `/mentor/settings`** | Open only for users with the `mentor` role; others see a 403 page ("This page is for mentors") with a link to their own home |
| **`/notifications` and `/help`** | Open for any signed-in role; content and options depend on the active role. Never mix notifications or help topics from different roles in one view |
| **Multi-role users** | The role switcher changes the sidebar and the content of these pages. Notification badges per role appear in the switcher ("Mentor 3 · Founder 1") |
| **Mentor not yet approved** | Messages is limited to admin and support threads; Notifications and Help work normally; Settings allows profile-related and security options but not payout or availability changes |
| **Data scope** | Messages, notifications and settings are returned only for the signed-in user; the server filters by user ID, never by an ID in the URL |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner; message content is hidden unless a dispute or safety case allows access and is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Messages: `/mentor/messages`

Uses the shared inbox design (conversation list, thread, side panel). Mentor content below.

## B1. Layout
Left: conversation list (320px). Center: thread. Right: context panel (320px, collapsible).

## B2. Conversation list

**Filters (tabs or chips):** All · Startups · Sessions · Sign-offs · Admin and support · Unread · Archived.

Each row: avatar or startup logo, name, a one-line preview, time, unread dot, and small context chips:
- Startup conversations: stage pill, mentorship status (`Active`, `Paused`, `Past`).
- Request threads: `Request` chip (before you accept).
- Session threads: `Session` chip with the next session time.
- Sign-off threads: `Sign-off` chip with the item name.
- Admin and support: `Support` chip.

Search across names, messages and file names. **+ New message** offers only the people you can message: startups you have an active or past mentorship or a pending request with, and support. Mentors cannot start a conversation with startups they have no relationship with; invitations go through **Discover startups**.

## B3. Thread view

- Header: name, status chip, links (**Open workspace**, **View startup**, **Book session**).
- Messages with timestamps, read receipts, and system events inline ("Session booked for Thu 4:00 PM", "Deliverable submitted: Financial model v2", "You signed off: Business model").
- **Composer:** rich text, attachments (upload or from files shared in the mentorship), and **Insert** menu (Link a task, Link a deliverable, Link a session, Link a readiness item).
- **Templates** (mentor-specific): "Prep for our next session", "Following up on the deliverable", "Request a document", "Session summary shared", "Sign-off request needs changes".
- **Save as private note:** turn any message into a private mentor note (never shown to the startup).
- Messages are secure and logged for audit. A short caption under the composer: "Keep mentorship conversations on the platform."

## B4. Context panel (right)

- **Startup snapshot:** logo, name, stage, readiness score gauge, sign-off progress.
- **Mentorship:** status, next session, open deliverables, pending sign-offs, **Open workspace**.
- **Shared files:** the last 5 files shared in this thread.
- **Quick actions:** **Book session**, **Request a document**, **Add private note**, **Report** (overflow).

For admin and support threads, the panel shows the ticket reference and status instead.

## B5. Mentor-specific rules

- No requests for off-platform payment, equity promises or investment solicitation in messages. Such messages are flagged to moderation and the sender sees a gentle warning before sending.
- A mentor cannot message investors through this inbox. Introductions to investors go through the platform's investor and event flows.
- Group threads (for example, mentor and two founders) are allowed inside a mentorship; adding people outside the mentorship is not.
- Response-time hint: "Startups usually expect a reply within 2 days." It is guidance only, not a penalty.
- Ending or pausing a mentorship turns the thread read-only after a 14-day grace period; files stop being accessible per the sharing rules.

## B6. States

| State | Behavior |
|---|---|
| No conversations | "No messages yet. They'll appear when you accept a startup or reply to a request." with **View requests** |
| Unread | Bold name, gold dot, count in the sidebar |
| Failed send | Inline "Couldn't send" with **Retry**; message kept as a draft |
| Read-only thread | Banner: "This mentorship has ended. Messages are read-only." |
| Blocked or reported user | Thread locked with a note and a link to support |
| Not verified | Only admin and support threads available, banner shown |
| Offline | Drafts saved locally, sent when reconnected |

---

# Part C. Notifications: `/notifications`

Uses the shared notifications design (list, filters, mark read, preferences link). Mentor content below.

## C1. Layout
Header with title, **Mark all as read**, and **Preferences** (links to Settings → Notifications). Tabs: All · Unread · Requests · Sessions · Sign-offs · Money · Events · System. Grouped by day ("Today", "Yesterday", "This week").

## C2. Notification item
Icon (by category), one-line title, short detail, time, unread dot, and a primary action button or link. Clicking opens the related page and marks it read. Overflow menu: **Mark as read or unread**, **Mute this type**, **Mute this startup**.

## C3. Mentor notification types

| Category | Notification | Action target |
|---|---|---|
| **Requests** | New startup request or invitation reply | `/mentor/requests` |
| | Request waiting over 3 days | Request drawer |
| | Request withdrawn by startup | `/mentor/requests` |
| **Sessions** | Session booked, changed or cancelled | `/mentor/sessions/:sessionId` |
| | Reschedule requested | Session detail |
| | Session starts in 1 hour and in 10 minutes | Session detail (**Join**) |
| | Session summary overdue (24 hours) | Summary form |
| | Startup no-show | Session detail |
| **Sign-offs and deliverables** | Readiness item submitted for sign-off | Readiness page |
| | Startup resubmitted after changes requested | Readiness page |
| | Deliverable submitted | `/mentor/deliverables` |
| | Badge earned or paused for a startup you mentor | Readiness page |
| **Money** | Payment received or released | `/mentor/earnings` |
| | Payout sent, failed or delayed | Earnings, Payouts tab |
| | Tax document available | Earnings, Invoices and tax tab |
| | Agreement proposed, accepted, amended, ending or renewing | `/mentor/agreements/:agreementId` |
| | Payment dispute opened or resolved | Earnings, drawer |
| **Impact and events** | New review received | `/mentor/impact` |
| | Milestone badge earned | Impact page |
| | Startup withdrew public consent | Impact page |
| | Event opens for priority registration | `/mentor/events/:eventId` |
| | Event reminder (1 day, 1 hour) | Event detail |
| | Startup applied after your recommendation | Event detail |
| **System** | Mentor profile approved, changes requested or paused | `/mentor/profile` or application status |
| | Availability or capacity reached | `/mentor/availability` |
| | Security alerts (new login, payout details changed) | Settings → Security |
| | Policy and platform updates | Help or announcement page |
| **Messages** | New message (grouped per conversation) | `/mentor/messages` |

## C4. Priority and grouping

- **Urgent** (shown first with a gold-tint background): session starting soon, request waiting 3+ days, overdue summary, payout failed, security alerts.
- Messages from the same conversation are grouped ("3 new messages from {Startup}").
- Daily digest option collapses lower-priority items into one email.

## C5. States

| State | Behavior |
|---|---|
| Empty | "You're all caught up." with a short line about what will appear here |
| Loading | Skeleton rows |
| Muted category | Greyed row note: "You muted session reminders. Change in Preferences." |
| Failed to load | Inline **Retry** |
| Archived or old (90+ days) | Shown under "Earlier" with **Load more** |
| Not verified | Request and money notifications are paused; system and security notifications still arrive |

## C6. Mentor-specific rules

- Security alerts cannot be muted.
- Notifications never include sensitive financial details in email subjects or push text ("A payout was sent" instead of the amount).
- For multi-role users, each notification shows a small role chip (`Mentor`) and the role switcher shows unread counts per role.

---

# Part D. Settings: `/mentor/settings`

Uses the shared settings design (left section menu, content on the right). Mentor content below.

## D1. Sections

| Section | Content |
|---|---|
| **Account** | Name, email, phone, language, time zone (default Asia/Kolkata), date and time format, currency display |
| **Security** | Password, two-factor authentication, active sessions and devices, recent security activity, **Sign out everywhere** |
| **Notifications** | Per category and per channel preferences (below) |
| **Privacy and visibility** | Mentor profile visibility, public impact record, what startups see, blocked startups, data download and deletion |
| **Mentoring preferences** | Link cards to Profile, Availability and capacity, Pricing and agreement defaults |
| **Payments and payouts** | Link cards to payout method and tax details in Earnings (changes happen there, with re-authentication) |
| **Connected accounts** | Google or Microsoft sign-in, calendar connection (read-only sync for availability), LinkedIn |
| **Roles** | Roles on this account (Mentor, plus others if any), **Add a role**, and the default role at sign-in |
| **Help and legal** | Terms, privacy policy, mentor code of conduct, platform disclaimer |
| **Danger zone** | Pause mentoring, close mentor role, delete account |

## D2. Notifications section (mentor options)

A table with categories as rows and channels (In-app, Email, Push) as columns, using toggles:

| Category | Default |
|---|---|
| Startup requests and invitations | In-app, Email, Push |
| Sessions (booking, changes, reminders) | In-app, Email, Push |
| Session summary reminders | In-app, Email |
| Sign-off and deliverable submissions | In-app, Email |
| Messages | In-app, Push |
| Payments, payouts and tax documents | In-app, Email |
| Agreements | In-app, Email |
| Reviews and impact | In-app |
| Investor events | In-app, Email |
| Platform updates | In-app |
| Security alerts | In-app, Email, Push (locked on) |

Extras: **Digest** (Instant, Daily at a chosen time, Weekly), **Quiet hours** (for example, 9 PM to 8 AM, urgent security alerts excepted), **Mute a startup** (list with **Unmute**), and **Reminder timing** for sessions (10 minutes, 1 hour, 1 day).

## D3. Privacy and visibility section (mentor options)

- **Mentor profile visibility:** Visible to startups (default for approved mentors), Hidden (no new requests; active mentorships continue). A banner shows the effect.
- **Public impact record:** global toggle plus a link to per-item controls on `/mentor/impact`.
- **What startups see:** toggles for response time, number of startups mentored, rating, and past exits (verified items only).
- **Contact details:** never shown publicly; shared only inside a mentorship.
- **Blocked startups:** list with **Unblock**.
- **Data:** **Download my data** (export of profile, sessions, notes, sign-offs), **Delete my data** with a warning about records that must be kept (agreements, financial records, sign-off history) under platform policy and applicable law.
- **Analytics and benchmarks:** opt in or out of anonymized contribution to platform statistics.

## D4. Mentoring preferences (link cards)
Short cards with a summary and **Edit** link:
- **Profile:** headline, expertise, industries (→ `/mentor/profile`)
- **Availability and capacity:** weekly slots, maximum startups, status (→ `/mentor/availability`)
- **Pricing and defaults:** fee model, session length, default agreement template, cancellation rules (→ `/mentor/agreements`)

## D5. Danger zone

- **Pause mentoring:** hides the profile and stops new requests; optional return date; active mentorships continue unless paused individually.
- **Close the mentor role:** requires closing or transferring active mentorships first, completing pending sign-offs, and settling payouts. A checklist shows what is blocking.
- **Delete account:** re-authentication required; explains what is deleted and what is retained.

## D6. Behavior

- Changes save per section with a toast and **Undo** where safe; security and danger-zone changes need confirmation.
- Sensitive actions (password change, 2FA change, role closure, account deletion) require re-authentication.
- Unsaved changes prompt before leaving.

## D7. States

| State | Behavior |
|---|---|
| Not verified | Mentoring preferences, payouts and availability are read-only with the verification banner |
| Active mentorships block an action | Inline message listing what to resolve, with links |
| Save error | Inline message with **Retry** |
| 2FA not enabled | Gold-tint nudge in Security: "Add two-factor authentication to protect your account." |
| Calendar connection failed | Warning chip with **Reconnect** |

---

# Part E. Help and Support: `/help`

Uses the shared help design (search, topics, contact). Mentor content below.

## E1. Layout
Top: search bar ("Search help for mentors"). Below: topic cards, popular articles, and a contact panel. A role chip near the title shows the current role (`Mentor`), with a small link "Not a mentor question? Switch role."

## E2. Mentor help topics

| Topic | Example articles |
|---|---|
| **Getting started** | Mentor verification, completing your profile, setting availability and capacity |
| **Requests and startups** | Accepting, countering or declining a request, discovering startups, pausing or ending a mentorship |
| **Sessions** | Scheduling, rescheduling, session summaries, recording consent, video troubleshooting |
| **Sign-offs and readiness** | The six checklist items, what "done" means, how to request changes, the Investment Ready badge, badge maintenance |
| **Deliverables** | Adding deliverables, reviewing submissions |
| **Earnings and payouts** | How payments work, commission, payout schedule, adding a payout method, tax documents |
| **Agreements and equity** | Reading and proposing terms, equity or advisory shares, ending an agreement |
| **Impact and reviews** | How the impact record works, consent from startups, replying to reviews, reporting a review |
| **Investor events** | Priority access, registering, recommending a startup |
| **Safety and conduct** | Code of conduct, conflicts of interest, blocking and reporting, what the platform does not do (not a broker or adviser) |
| **Account and privacy** | Roles, security, data download, deleting data |

Each article follows one template: short answer first, steps, screenshots (optional), related articles, and a **Was this helpful?** control.

## E3. Contact and tickets: `/help/tickets`

- **Contact support** button opens a form: category (from the topics above), related item (startup, session, payment or agreement, chosen from the mentor's own records), description (20–2,000 characters), attachments (up to 5 files, 10 MB each), preferred contact method.
- **My tickets:** table with ID, subject, category, status (`Open`, `Waiting for you`, `In progress`, `Resolved`), last update. Ticket detail shows the thread with support, attachments and a **Reopen** option for 14 days after resolution.
- Expected response times are shown plainly (for example, "We usually reply within 1 business day").

## E4. Report a concern

A dedicated, prominent link. Options:
- **Report a startup** (misleading information, harassment, requests that break the rules)
- **Report a review** (links to the review moderation flow)
- **Report a payment or agreement issue** (opens a ticket tied to the payment or agreement)
- **Report a conflict of interest or sign-off concern**
- **Report a safety issue**

Reports can be confidential. The form explains what happens next and the expected timeline. Safety issues show urgent contact options first.

## E5. Other elements

- **Platform status** link and any active incident banner.
- **Release notes** for mentors.
- **Mentor guidelines** and **Code of conduct** (always one click away).
- **Disclaimer:** "The platform introduces startups, mentors and investors. It does not give legal, tax, financial or investment advice."
- **Contact on the page footer:** support email and, if offered, chat hours.

## E6. States

| State | Behavior |
|---|---|
| No search results | "No articles found." with suggested topics and **Contact support** |
| Offline | Cached articles when available; contact form saved as a draft |
| Ticket failed to send | Inline **Retry**; the draft is kept |
| Not verified | Verification topics highlighted at the top with **View application status** |
| Active incident | Banner with a link to the status page |

---

# Part F. Data and validation

| Field | Rule |
|---|---|
| Message | Up to 5,000 characters; attachments up to 25 MB each, virus scanned |
| Message content | No off-platform payment or investment solicitation (flagged and warned) |
| Notification preferences | Security alerts cannot be switched off |
| Quiet hours | Start and end times required; urgent security alerts excepted |
| Time zone and language | Chosen from supported lists |
| Phone number | Valid format, verified by a code before use for 2FA |
| Support ticket description | Required, 20–2,000 characters; up to 5 attachments, 10 MB each |
| Data export | One request per day; ready within the time shown on the page |
| Account deletion | Re-authentication and blocking checklist must be clear |

**Audit log:** security changes, role changes, privacy setting changes, data export and deletion requests, ticket creation and resolution, reports, each with user and time.

---

# Part G. Data connections

| Feature | Connected to |
|---|---|
| Conversations and attachments | ERP chat service, document vault (shared items only) |
| Notification events and delivery | ERP notification service (in-app, email, push) |
| Mentor requests, sessions, sign-offs, deliverables | Mentor module pages (core, sessions and sign-off) |
| Payments, payouts, agreements, reviews, events | Money and recognition pages |
| Account, security, roles | Identity and access |
| Verification status | Admin console |
| Calendar sync | External calendar (read-only) |
| Help articles and tickets | Support system, admin console |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part H. Build order (suggested)

1. Confirm the role guard and active-role switching (Part A3), so shared pages load the right content.
2. **Notifications** (the mentor notification types depend on events from the other mentor pages, so wire them as each page ships).
3. **Settings:** Account, Security and Notifications first; Privacy and the link cards next; Danger zone last.
4. **Messages:** conversation list and thread first, then the context panel, templates and moderation rules.
5. **Help and Support:** articles and search first, then tickets and Report a concern.
6. Empty, loading and error states, then mobile layouts.

**Reminder for the build:** the shells are shared, but each page must load mentor content by the active role. Filter all conversations, notifications and settings by the signed-in user on the server, and keep security alerts, re-authentication and audit logging in place.
