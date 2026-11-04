# Investor Shared Pages Design

The four pages every role uses, adapted with **investor content**. The layouts, components and behavior come from the shared designs you already have. This file defines only what changes for an investor: the sidebar entry, the content, the investor-specific options and the role rules. Colors and typography are unchanged: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> The page shells are shared across roles, but the **content, options and data are investor-specific**. The project owner will add the role and permission logic, so build each page to load investor content when the signed-in user is acting in the `investor` role. Details are in **Part A3**. A user who is also a founder or mentor sees the same page with that role's content after switching roles.

> **Reminder: platform role and legal limits.**
> The platform introduces parties and is not a broker or adviser unless licensed. Messages, notifications and help content for investors must never recommend an investment, promise returns or suggest moving money outside agreed processes. Get legal advice on investor eligibility, registration and communication rules before launch.

## Pages in this spec

| # | Page | Route | Investor content |
|---|---|---|---|
| 1 | Messages | `/investor/messages` | Conversations with startups, offer and diligence threads, colleagues, admin and support |
| 2 | Notifications | `/notifications` | Investor events: matches, intros, data rooms, diligence, meetings, offers, portfolio, billing |
| 3 | Settings | `/investor/settings` | Account, security, verification, organization, notification and privacy preferences, investor-specific controls |
| 4 | Help and Support | `/help` | Investor help topics, contact, tickets, report a concern, fraud and safety |

Related investor files: `investor-deal-flow-design.md`, `investor-diligence-pipeline-design.md`, `investor-offers-portfolio-design.md`, `investor-membership-events-insights-design.md`. The mentor equivalent is `mentor-shared-pages-design.md`.

---

# Part A. Shared foundations

## A1. What stays the same (use your existing designs)

- Page shell: sidebar, top bar, 12-column grid, card style (white, 1px `--stone-200` border, radius 12px, padding 24px).
- Components: lists, filters, tabs, toggles, drawers, modals, toasts, empty states, skeleton loaders.
- Tokens: `--ink #0F1B2D`, `--ink-soft #1C2B42`, `--ivory #FAF8F4`, `--white #FFFFFF`, `--gold #B8955A`, `--gold-dark #9A7A45`, `--gold-tint #F3EBDD`, `--stone-700 #4A5568`, `--stone-400 #A0A7B4`, `--stone-200 #E5E1D8`, `--success #2E7D5B`, `--warning #B7791F`, `--error #B42318`.
- Typography: `Fraunces` / `Playfair Display` for titles, `Inter` for UI.
- Motion, accessibility and responsive rules from your other designs (WCAG 2.1 AA, keyboard operable, `prefers-reduced-motion`, 44×44px touch targets).

## A2. What changes for the investor role

| Area | Investor version |
|---|---|
| Sidebar | The investor sidebar (Dashboard, Discover startups, Shortlist, Saved searches, Intro requests, Pipeline, Data rooms, Meetings, Offers, Portfolio, Messages). Messages shows an unread count; Settings and Help sit at the bottom with the role switcher |
| Route prefix | `/investor/...` for Messages and Settings; `/notifications` and `/help` are shared routes that load investor content |
| Data scope | Only the investor's own conversations, notifications and settings (and the organization's shared items per role) |
| Banners | The "Your investor account is under review" banner appears on all four pages until verified |
| Sidebar highlight | Active item uses `--ink-soft` background with a 3px gold bar at the left |
| Disclaimer | The platform disclaimer ("introduces parties, not a broker or adviser unless licensed") appears in Messages (deal threads) and Help |

## A3. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Active role** | Content is loaded for the role the user is currently acting in. In the `investor` role, these pages show investor content only |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **`/investor/messages` and `/investor/settings`** | Open only for users with the `investor` role; others see a 403 page ("This page is for investors") with a link to their own home |
| **`/notifications` and `/help`** | Open for any signed-in role; content and options depend on the active role. Never mix notifications or help topics from different roles in one view |
| **Multi-role users** | The role switcher changes the sidebar and the content of these pages. Notification badges per role appear in the switcher ("Investor 4 · Mentor 1") |
| **Investor not yet verified** | Messages limited to admin and support threads; Notifications and Help work normally; Settings allows profile, security and verification changes but not offer-related or data room settings |
| **Organization roles** | For funds and angel groups, Settings sections depend on the organization role (Owner, Admin, Analyst, Viewer). Only Owners and Admins can change organization, billing-linked and verification settings. Shared inbox access follows the same roles |
| **Data scope** | Messages, notifications and settings are returned only for the signed-in user (or organization where shared); the server filters by user and organization ID, never by an ID in the URL |
| **Sensitive actions** | Changing password, two-factor, payment-linked settings, verification details, roles and deleting data require re-authentication |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner; message content is hidden unless a dispute, fraud or safety case allows access and is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Messages: `/investor/messages`

Uses the shared inbox design (conversation list, thread, side panel). Investor content below.

## B1. Layout
Left: conversation list (320px). Center: thread. Right: context panel (320px, collapsible).

## B2. Conversation list

**Filters (tabs or chips):** All · Startups · Offers · Diligence · Team · Admin and support · Unread · Archived.

Each row: startup logo or avatar, name, one-line preview, time, unread dot, and small context chips:
- Startup conversations: stage pill, pipeline stage (`Talking`, `Data room`, `Diligence`, `Offer`).
- Intro threads: `Intro` chip (before acceptance, read-only until the startup accepts).
- Offer threads: `Offer` chip with the offer version and status.
- Diligence threads: `Diligence` chip with the number of open questions.
- Team threads (organizations): `Team` chip with colleagues' names.
- Admin and support: `Support` chip.

Search across names, messages and file names. **+ New message** offers only the people you can message: startups where an intro was accepted or the startup contacted you and you replied, colleagues in your organization, and support. Investors can't start a conversation with a startup that hasn't accepted an intro or contacted them; intros go through **Intro requests**.

## B3. Thread view

- Header: startup name, status chips, links (**Open profile**, **Open pipeline card**, **Data room**, **Diligence**, **Schedule meeting**).
- Messages with timestamps, read receipts and system events inline ("Intro accepted", "Data room access granted", "You signed the NDA", "You sent offer v1", "{Startup} answered 2 diligence questions").
- **Composer:** rich text, attachments (upload; documents from the data room can be referenced by link but not forwarded as files), and an **Insert** menu (Link an offer, Link a diligence question, Link a meeting, Link a document in the data room).
- **Templates** (investor-specific): "Thanks for the intro, here's what I'd like to see", "Requesting a data room folder", "Scheduling a diligence call", "Following up on my questions", "Polite pass with feedback".
- **Save as private note:** turn any message into a private note on the startup (never shown to the startup).
- **Diligence question mode:** a toggle that formats a message as a structured question (area, priority, linked document) and adds it to the Diligence Workspace.
- Caption under the composer: "Keep deal conversations on the platform. Messages are secure and logged for audit."

## B4. Context panel (right)

- **Startup snapshot:** logo, name, stage, readiness score, badges, round info (shared fields only).
- **Relationship:** pipeline stage dropdown, owner, next step and date.
- **Deal status:** data room status chip, NDA status, diligence progress, offer status, next meeting.
- **Shared files:** last 5 files linked in this thread.
- **Quick actions:** **Schedule meeting**, **Request data room access**, **Add private note**, **Move stage**, **Pass**, overflow (**Block**, **Report**).

For admin and support threads, the panel shows the ticket reference and status instead. For team threads, it shows colleagues and the startups discussed.

## B5. Investor-specific rules

- **No off-platform deal steps:** messages that ask or offer to move to another channel for payments, funds transfer, share purchases or bank details are flagged. The sender sees a warning before sending: "For your safety, keep payment details and deal steps on the platform. Verify any bank details by phone." Repeated cases go to moderation.
- **No promises:** the platform blocks and warns on messages that promise guaranteed returns or pressure for quick decisions.
- **No cold messages:** investors can't message startups without an accepted intro (or a startup-initiated contact). Outreach limits follow the plan.
- **No messaging mentors or other investors through this inbox** unless they are colleagues in the same organization. Introductions to mentors or co-investors go through the relevant platform flows.
- **Team sharing:** in organizations, a thread can be shared with colleagues (they see it in read-only or reply mode, as chosen). Startups see who is on the thread.
- **Response-time hint:** "Founders usually expect a reply within 3 days." Guidance only.
- **Confidential content:** the platform reminds users that content shared in deal threads is covered by their NDA.
- **Retention:** when a startup passes, an offer closes or a relationship ends, the thread stays readable for the investor for the retention period, with a closing system message. A blocked startup or investor locks the thread.

## B6. States

| State | Behavior |
|---|---|
| No conversations | "No messages yet. Conversations start after a startup accepts your intro." with **View intro requests** |
| Unread | Bold name, gold dot, count in the sidebar |
| Failed send | Inline "Couldn't send" with **Retry**; message kept as a draft |
| Intro pending | Thread shows the intro request and a read-only note until accepted |
| Closed relationship | Banner: "This conversation is closed. Messages are read-only." |
| Blocked or reported user | Thread locked with a note and a link to support |
| Flagged message | Warning before sending; after moderation, a neutral notice if blocked |
| Not verified | Only admin and support threads available, banner shown |
| Offline | Drafts saved locally, sent when reconnected |

---

# Part C. Notifications: `/notifications`

Uses the shared notifications design (list, filters, mark read, preferences link). Investor content below.

## C1. Layout
Header with title, **Mark all as read**, and **Preferences** (links to Settings → Notifications). Tabs: All · Unread · Deal flow · Diligence · Meetings · Offers and money · Portfolio · Events · System. Grouped by day ("Today", "Yesterday", "This week").

## C2. Notification item
Icon (by category), one-line title, short detail, time, unread dot, and a primary action button or link. Clicking opens the related page and marks it read. Overflow menu: **Mark as read or unread**, **Mute this type**, **Mute this startup**.

## C3. Investor notification types

| Category | Notification | Action target |
|---|---|---|
| **Deal flow** | New suggested matches for your criteria (daily summary) | `/investor/dashboard` or Discover |
| | Saved search alert: new matching startup | `/investor/searches` |
| | A shortlisted startup updated (new traction, badge earned, round opened or closed) | Startup profile |
| | Intro request received | `/investor/requests` |
| | Intro request waiting over 3 days | Request drawer |
| | Intro accepted, declined or expired | `/investor/requests` |
| | Follow-up reminder due | Shortlist item |
| **Diligence** | Data room access granted, extended, revoked or expiring in 7 days | `/investor/data-rooms` |
| | NDA ready to sign, or NDA updated by the startup | NDA signing page |
| | New or updated documents in a data room | Data room viewer |
| | Startup answered a diligence question | Diligence Workspace, Questions |
| | Question unanswered after 5 days | Diligence Workspace |
| | Saved comparison updated | `/investor/compare` |
| **Meetings** | Meeting request received, confirmed, changed or cancelled | `/investor/meetings` |
| | Meeting starts in 1 hour and in 10 minutes | Meeting detail (**Join**) |
| | Meeting notes missing after 24 hours | Meeting detail |
| **Offers and money** | Offer viewed, countered, accepted, declined or expired | `/investor/offers/:offerId` |
| | Offer expiring in 7 days and 48 hours | Offer detail |
| | Internal approval requested or completed | Offer detail, Approvals |
| | Document awaiting your signature | Offer detail, Documents |
| | Commitment confirmed, funds marked received, round closed | `/investor/commitments` |
| | Closing date approaching with incomplete items | Commitment detail |
| | Payment succeeded or failed, invoice available, plan renewing | `/investor/billing` |
| | Plan limit reached or near (80 percent) | Billing, Usage |
| **Portfolio** | New investor update, board report or document | Portfolio company page |
| | Portfolio company update overdue | Portfolio company page |
| | Portfolio company opens a new round (pro-rata window) | Portfolio company page, Round |
| | Rights deadline in 14 days (for example, pro-rata) | Portfolio company page |
| | Request for help from a portfolio company | Messages |
| **Events** | Event opens for priority registration | `/investor/events/:eventId` |
| | Event reminder (1 day, 1 hour); event changed or cancelled; waitlist seat available | Event detail |
| | Follow-up prompt after an event | Event detail |
| **System** | Verification approved, changes requested, expiring or paused | `/investor/verification` or application status |
| | Security alerts (new login, new device, payment details changed, role changed) | Settings → Security |
| | Monthly market insights digest | `/investor/insights` |
| | Policy and platform updates | Help or announcement page |
| **Messages** | New message (grouped per conversation) | `/investor/messages` |

## C4. Priority and grouping

- **Urgent** (shown first with a gold-tint background): meeting starting soon, offer counter received, offer expiring in 48 hours, document awaiting signature, funds due, access expiring in 7 days, security alerts.
- Messages from the same conversation are grouped ("3 new messages from {Startup}").
- Digest option collapses lower-priority items (matches, saved search alerts, portfolio updates, insights) into one email.

## C5. States

| State | Behavior |
|---|---|
| Empty | "You're all caught up." with a short line about what will appear here |
| Loading | Skeleton rows |
| Muted category | Greyed row note: "You muted saved search alerts. Change in Preferences." |
| Failed to load | Inline **Retry** |
| Archived or old (90+ days) | Shown under "Earlier" with **Load more** |
| Not verified | Deal flow, diligence and offer notifications are paused; system, billing and security notifications still arrive |

## C6. Investor-specific rules

- Security and billing-failure alerts cannot be muted.
- Notifications never include amounts, valuations, bank details or card details in email subjects or push text. Example: "A new counter was received" instead of the figures.
- Confidential startup details don't appear in notification previews on lock screens.
- For multi-role users, each notification shows a small role chip (`Investor`), and the role switcher shows unread counts per role.
- For organizations, members get notifications for items they own or follow; Owners and Admins can also subscribe to organization-wide alerts.

---

# Part D. Settings: `/investor/settings`

Uses the shared settings design (left section menu, content on the right). Investor content below.

## D1. Sections

| Section | Content |
|---|---|
| **Account** | Name, email, phone, language, time zone (default Asia/Kolkata), date and time format, currency display |
| **Security** | Password, two-factor authentication, active sessions and devices, recent security activity (links to Activity and Audit Log), **Sign out everywhere** |
| **Verification** | KYC status and level, documents on file (masked), expiry dates, **Update verification**, eligibility status where applicable |
| **Organization** | For funds and angel groups: organization name, members and roles, invites, approval rules and thresholds (links to the Team and Organization page) |
| **Notifications** | Per category and per channel preferences (below) |
| **Privacy and visibility** | Investor profile visibility, what startups see, blocked startups, data download and deletion |
| **Investing preferences** | Link cards to Profile, Investment Preferences (criteria), Saved searches, Pipeline defaults |
| **Data room and diligence defaults** | Default view settings, auto-watermark display name, diligence checklist and scorecard templates |
| **Membership and billing** | Link card to `/investor/billing` (changes happen there, with re-authentication) |
| **Connected accounts** | Google or Microsoft sign-in, calendar connection (read-only sync for meetings), LinkedIn |
| **Roles** | Roles on this account (Investor, plus others if any), **Add a role**, default role at sign-in |
| **Help and legal** | Terms, privacy policy, investor code of conduct, platform disclaimer |
| **Danger zone** | Pause investor profile, close investor role, delete account |

## D2. Notifications section (investor options)

A table with categories as rows and channels (In-app, Email, Push) as columns, using toggles:

| Category | Default |
|---|---|
| Suggested matches and saved search alerts | In-app, Email (digest) |
| Intro requests and replies | In-app, Email, Push |
| Shortlist updates | In-app, Email |
| Data room access, NDA and document changes | In-app, Email |
| Diligence answers and reminders | In-app, Email |
| Meetings (requests, changes, reminders) | In-app, Email, Push |
| Offers and negotiation | In-app, Email, Push |
| Commitments, funds and closing | In-app, Email |
| Portfolio updates and reports | In-app, Email (digest) |
| Portfolio rights deadlines | In-app, Email |
| Events | In-app, Email |
| Market insights digest | Email |
| Billing and invoices | In-app, Email |
| Messages | In-app, Push |
| Platform updates | In-app |
| Security alerts | In-app, Email, Push (locked on) |

Extras: **Digest** (Instant, Daily at a chosen time, Weekly), **Quiet hours** (for example, 9 PM to 8 AM, urgent security alerts excepted), **Mute a startup** (list with **Unmute**), **Reminder timing** for meetings (10 minutes, 1 hour, 1 day), and **Alert limits** for saved searches (cap of alerts per day to avoid overload).

## D3. Privacy and visibility section (investor options)

- **Investor profile visibility:** Visible to startups (default for verified investors), Visible only to startups I contacted or who contacted me, Hidden (no new inbound requests; existing relationships continue). A banner shows the effect.
- **What startups see about you:** toggles for name or firm only, investor type, stage and sector focus, ticket range, portfolio highlights (verified items only), response time. Startup-facing views always show the **Verified investor** badge when verified.
- **Contact details:** never shown publicly; shared only after a relationship exists.
- **Blocked startups:** list with **Unblock**; blocked startups no longer appear to you and can't see you.
- **Hidden startups and passes:** list of startups you passed or hid, with **Restore**.
- **Visibility of views to startups:** an information card explains that startups can see which verified investors viewed their profile or documents (per the startups' own settings). It is not a setting investors can switch off for data room access, as logging is part of the NDA process.
- **Data:** **Download my data** (profile, pipeline, notes, scorecards, offers, portfolio records, activity), **Delete my data** with a warning about records that must be kept (signed NDAs, offers, commitments, financial records) under platform policy and applicable law.
- **Analytics and benchmarks:** opt in or out of anonymized contribution to platform statistics (insights).

## D4. Investing preferences (link cards)
Short cards with a summary and **Edit** link:
- **Profile:** headline, thesis, investor type, track record (→ `/investor/profile`)
- **Investment criteria:** stages, sectors, regions, ticket size, readiness threshold, instruments (→ `/investor/preferences`)
- **Saved searches and alerts** (→ `/investor/searches`)
- **Pipeline defaults:** stage names, probabilities, owner assignment (→ `/investor/pipeline`)

## D5. Data room and diligence defaults

- **Watermark name:** how your name and organization appear on documents (cannot be hidden).
- **Viewer preferences:** default zoom, page layout, idle lock time within the startup's allowed range.
- **Templates:** diligence checklist templates, scorecard weights, call-notes template, question bundles; create, edit, set a default and share with the team.
- **Note visibility default:** Private to me or Shared with my team.
- **Memo export:** default sections and header for the diligence memo.

## D6. Organization section (funds and angel groups)

- **Members and roles:** Owner, Admin, Analyst, Viewer, with a short description of each (what they can see and do).
- **Invite member:** email, role, optional personal message; each member needs their own verified account and, where startups require it, their own NDA.
- **Approvals:** thresholds and approver lists for offers; separation of duties explained.
- **Shared items:** default visibility for pipeline, shortlists and notes.
- **Offboarding:** remove a member; their private items stay private to them but shared items stay with the organization; access to data rooms ends immediately.
- Only Owners and Admins can edit this section.

## D7. Danger zone

- **Pause investor profile:** hides the profile and stops new inbound requests and alerts; optional return date; existing offers and commitments continue.
- **Close the investor role:** requires closing or withdrawing open offers, completing or cancelling open commitments, and settling billing. A checklist shows what is blocking. Portfolio records and signed agreements stay available to the investor and the startups as required.
- **Delete account:** re-authentication required; explains what is deleted and what is retained.

## D8. Behavior

- Changes save per section with a toast and **Undo** where safe; security, verification and danger-zone changes need confirmation.
- Sensitive actions (password change, 2FA change, verification details, role closure, account deletion) require re-authentication.
- Unsaved changes prompt before leaving.

## D9. States

| State | Behavior |
|---|---|
| Not verified | Verification and Security editable; offer-related, data room and organization settings are read-only with the verification banner |
| Verification expiring | Gold-tint banner in Verification with the date and **Update verification** |
| Open offers or commitments block an action | Inline message listing what to resolve, with links |
| Save error | Inline message with **Retry** |
| 2FA not enabled | Gold-tint nudge in Security: "Add two-factor authentication to protect your account." Strongly recommended for investors because they handle confidential documents and funds |
| Calendar connection failed | Warning chip with **Reconnect** |
| Non-admin organization member | Organization, billing-linked and verification sections hidden or read-only: "Ask an Owner or Admin." |

---

# Part E. Help and Support: `/help`

Uses the shared help design (search, topics, contact). Investor content below.

## E1. Layout
Top: search bar ("Search help for investors"). Below: topic cards, popular articles, and a contact panel. A role chip near the title shows the current role (`Investor`), with a small link "Not an investor question? Switch role."

## E2. Investor help topics

| Topic | Example articles |
|---|---|
| **Getting started** | Applying as an investor, KYC and verification levels, setting your criteria, choosing a plan |
| **Discover and shortlist** | Using filters, what Investment Ready means, how Fit works, saved searches and alerts |
| **Intros and messaging** | Sending intros, accepting or declining, daily limits, keeping conversations on the platform |
| **Data rooms and NDAs** | Requesting access, signing the NDA, viewer rules, watermarking, what is logged |
| **Diligence** | Checklists, questions, findings, scorecards, comparing startups, exporting a memo |
| **Meetings** | Scheduling, notes, recording consent, video troubleshooting |
| **Offers and term sheets** | Creating an offer, terms explained, versions, approvals, accepting a counter, what is binding |
| **Commitments and funds** | Closing checklist, recording funds sent, startup confirmation, avoiding payment fraud |
| **Portfolio** | Investor updates, reports, rights and deadlines, adding a manual holding |
| **Membership and billing** | Plans and limits, invoices, tax details, changing or cancelling, fees |
| **Events and insights** | Registering for events, priority access, how insights are aggregated and anonymized |
| **Teams and organizations** | Members and roles, approvals, shared lists, NDAs for colleagues |
| **Safety and conduct** | Code of conduct, conflicts of interest, blocking and reporting, what the platform does not do (not a broker or adviser) |
| **Account and privacy** | Roles, security, data download, deleting data |

Each article follows one template: short answer first, steps, screenshots (optional), related articles and a **Was this helpful?** control. Articles on deals include the platform disclaimer and a reminder to take independent legal, tax and financial advice.

## E3. Contact and tickets: `/help/tickets`

- **Contact support** button opens a form: category (from the topics above), related item (startup, offer, commitment, data room, invoice or event, chosen from the investor's own records), description (20–2,000 characters), attachments (up to 5 files, 10 MB each), preferred contact method, and urgency (Normal, Urgent for payment, access or security issues).
- **My tickets:** table with ID, subject, category, status (`Open`, `Waiting for you`, `In progress`, `Resolved`), last update. Ticket detail shows the thread with support, attachments and a **Reopen** option for 14 days after resolution.
- Expected response times are shown plainly (for example, "We usually reply within 1 business day; urgent security and funds issues are prioritized").
- **Priority support:** shown if the investor's plan includes it, with its own response time.

## E4. Report a concern

A dedicated, prominent link. Options:
- **Report a startup** (misleading information, suspected fraud, fake traction, impersonation)
- **Report suspicious payment instructions or an attempt to move deal steps off the platform** (urgent path first)
- **Report a message or user** (harassment, pressure tactics, solicitation)
- **Report a data room or document issue** (wrongly shared confidential information, access problems)
- **Report an event concern**
- **Report a conflict of interest or compliance concern**
- **Report a safety or security issue**

Reports can be confidential. The form explains what happens next and the expected timeline. Urgent fraud and security reports show immediate steps first (stop contact, don't send funds, change passwords) and urgent contact options. Reports are logged and linked to the relevant record where the investor selects one.

## E5. Fraud and safety center

A short page linked from Help and the Commitments page:
- Verify payment details by a phone call to a number you found independently.
- The platform never asks you to send funds to an account over chat or email.
- Be wary of urgency, pressure and changes of bank details.
- Check that the startup is **Verified**, and read the **source labels** on numbers.
- Don't share your password, verification codes or documents outside the platform.
- What to do if you suspect fraud: stop, report, contact your bank, and keep records.
- Links to **Report a concern** and **Contact support**.

## E6. Other elements

- **Platform status** link and any active incident banner.
- **Release notes** for investors.
- **Investor guidelines** and **Code of conduct** (always one click away).
- **Disclaimer:** "The platform introduces startups and investors. It does not give legal, tax, financial or investment advice, and it is not a broker or adviser unless licensed."
- **Contact on the page footer:** support email and, if offered, chat hours.

## E7. States

| State | Behavior |
|---|---|
| No search results | "No articles found." with suggested topics and **Contact support** |
| Offline | Cached articles when available; contact form saved as a draft |
| Ticket failed to send | Inline **Retry**; the draft is kept |
| Not verified | Verification topics highlighted at the top with **View verification status** |
| Active incident | Banner with a link to the status page |
| Urgent fraud report | Immediate safety steps shown before the form; the ticket is marked urgent automatically |

---

# Part F. Data and validation

| Field | Rule |
|---|---|
| Message | Up to 5,000 characters; attachments up to 25 MB each, virus scanned |
| Message content | No off-platform payment or funds instructions, no promises of returns; flagged and warned |
| Diligence question message | Area and priority required; up to 1,000 characters |
| Notification preferences | Security alerts and billing failures cannot be switched off |
| Quiet hours | Start and end times required; urgent security alerts excepted |
| Time zone and language | Chosen from supported lists |
| Phone number | Valid format, verified by a code before use for 2FA |
| Organization member | Valid email, role required; seat availability checked against the plan |
| Support ticket description | Required, 20–2,000 characters; up to 5 attachments, 10 MB each |
| Data export | One request per day; ready within the time shown on the page |
| Account deletion | Re-authentication and blocking checklist must be clear |

**Audit log:** security changes, verification changes, role and organization changes, privacy setting changes, data export and deletion requests, ticket creation and resolution, reports, each with user and time (visible in `/investor/activity`).

---

# Part G. Data connections

| Feature | Connected to |
|---|---|
| Conversations and attachments | ERP chat service, document vault (data room documents are linked, not forwarded) |
| Notification events and delivery | ERP notification service (in-app, email, push) |
| Deal flow, diligence, meetings, offers, portfolio | Investor module pages (deal flow, diligence and pipeline, offers and portfolio) |
| Billing, events, insights, activity | Membership, events and insights pages |
| Account, security, roles | Identity and access |
| Verification status and level | Admin console, investor verification |
| Organization members and approvals | Investor team and organization |
| Calendar sync | External calendar (read-only) |
| Help articles and tickets | Support system, admin console |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part H. Build order (suggested)

1. Confirm the role guard and active-role switching (Part A3), including organization roles, so shared pages load the right content.
2. **Notifications:** wire event types as each investor page ships; make security and billing alerts non-mutable from the start.
3. **Settings:** Account, Security and Verification first; Notifications and Privacy next; Organization, defaults and Danger zone last.
4. **Messages:** conversation list and thread first, then the context panel, templates, diligence question mode and moderation rules (off-platform payment warnings).
5. **Help and Support:** articles and search first, then tickets, **Report a concern** and the Fraud and safety center.
6. Empty, loading and error states, then mobile layouts.

**Reminder for the build:** the shells are shared, but each page must load investor content by the active role. Filter all conversations, notifications and settings by the signed-in user (and organization role) on the server, keep security alerts, re-authentication and audit logging in place, and make the fraud-warning and off-platform-payment checks part of the messaging flow from the start. Get legal advice on investor communication rules, eligibility and registration before launch.
