# Job Seeker Shared Pages Design

The four pages every role uses, adapted with **job seeker content**. The layouts, components and behavior come from the shared designs you already have. This file defines only what changes for a job seeker: the sidebar entry, the content, the job-seeker-specific options and the role rules. Colors and typography are unchanged: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> The page shells are shared across roles, but the **content, options and data are job-seeker-specific**. The project owner will add the role and permission logic, so build each page to load job seeker content when the signed-in user is acting in the `job seeker` role. Details are in **Part A3**. A user who is also a founder, mentor or investor sees the same page with that role's content after switching roles.

> **Reminder: safety first for job seekers.**
> Job seekers are a common target for fake job offers, fee scams and phishing. Messages, notifications and help content must warn about these, keep deal steps on the platform, and make reporting easy. Candidates are never charged to apply, interview or be hired through the platform. The platform doesn't give legal, immigration or career advice.

## Pages in this spec

| # | Page | Route | Job seeker content |
|---|---|---|---|
| 1 | Messages | `/jobseeker/messages` | Conversations with employers and recruiters, interview and offer threads, support |
| 2 | Notifications | `/notifications` | Job seeker events: alerts, applications, interviews, offers, resumes, practice, billing |
| 3 | Settings | `/jobseeker/settings` | Account, security, privacy and discoverability, notification preferences, practice and resume data controls |
| 4 | Help and Support | `/help` | Job seeker help topics, contact, tickets, report a job or employer, scam safety |

Related job seeker files: `jobseeker-dashboard-design.md`, `jobseeker-find-apply-design.md`, `jobseeker-applications-offers-design.md`, `jobseeker-resume-maker-design.md`, `jobseeker-interview-trainer-design.md`, `jobseeker-membership-design.md`. Equivalent shared-page files: `mentor-shared-pages-design.md` and `investor-shared-pages-design.md`.

---

# Part A. Shared foundations

## A1. What stays the same (use your existing designs)

- Page shell: sidebar, top bar, 12-column grid, card style (white, 1px `--stone-200` border, radius 12px, padding 24px).
- Components: lists, filters, tabs, toggles, drawers, modals, toasts, empty states, skeleton loaders.
- Tokens: `--ink #0F1B2D`, `--ink-soft #1C2B42`, `--ivory #FAF8F4`, `--white #FFFFFF`, `--gold #B8955A`, `--gold-dark #9A7A45`, `--gold-tint #F3EBDD`, `--stone-700 #4A5568`, `--stone-400 #A0A7B4`, `--stone-200 #E5E1D8`, `--success #2E7D5B`, `--warning #B7791F`, `--error #B42318`.
- Typography: `Fraunces` / `Playfair Display` for titles, `Inter` for UI.
- Motion, accessibility and responsive rules from your other designs (WCAG 2.1 AA, keyboard operable, `prefers-reduced-motion`, 44×44px touch targets).

## A2. What changes for the job seeker role

| Area | Job seeker version |
|---|---|
| Sidebar | The job seeker sidebar (Dashboard, Jobs, Saved jobs, Applications, Interviews, Resumes, Interview practice, Messages). Messages shows an unread count; Settings and Help sit at the bottom with the role switcher |
| Route prefix | `/jobseeker/...` for Messages and Settings; `/notifications` and `/help` are shared routes that load job seeker content |
| Data scope | Only the candidate's own conversations, notifications and settings |
| Banners | A soft "Verify your email to hear from employers" banner appears on all four pages until the email is verified |
| Sidebar highlight | Active item uses `--ink-soft` background with a 3px gold bar at the left |
| Safety strip | A short scam-safety note appears in Messages and Help: "Never pay to apply or start a job. Report suspicious messages." |

## A3. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Active role** | Content is loaded for the role the user is currently acting in. In the `job seeker` role, these pages show job seeker content only |
| **Not signed in** | Redirect to `/login`, then back to the requested page. The Help page's general articles can also be read signed out |
| **`/jobseeker/messages` and `/jobseeker/settings`** | Open only for users acting as a job seeker; others see a 403 page ("This page is for job seekers") with a link to their own home |
| **`/notifications` and `/help`** | Open for any signed-in role; content and options depend on the active role. Never mix notifications or help topics from different roles in one view |
| **Multi-role users** | The role switcher changes the sidebar and the content of these pages. Notification badges per role appear in the switcher ("Job seeker 4 · Founder 1") |
| **Email not verified** | Messages are read-only for new employer conversations until the email is verified; Notifications, Settings and Help work normally |
| **Employer access to messages** | Employers can message a candidate only inside an application thread or after an invitation the candidate accepted (Part B5); the server enforces this |
| **Data scope** | Messages, notifications and settings are returned only for the signed-in user; the server filters by user ID, never by an ID in the URL |
| **Sensitive actions** | Changing password, two-factor, email, phone, discoverability to "visible," deleting data and closing the account require re-authentication |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner; message content is hidden unless a dispute, scam or safety case allows access and is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Messages: `/jobseeker/messages`

Uses the shared inbox design (conversation list, thread, side panel). Job seeker content below.

## B1. Layout
Left: conversation list (320px). Center: thread. Right: context panel (320px, collapsible).

## B2. Conversation list

**Filters (tabs or chips):** All · Employers · Interviews · Offers · Invitations · Admin and support · Unread · Archived.

Each row: employer logo, company name (with **Verified employer** pill), the job title, a one-line preview, time, unread dot, and small context chips:
- Application threads: stage chip (`Applied`, `Shortlisted`, `Interview`, `Offer`, `Hired`, `Not selected`).
- Interview threads: `Interview` chip with the next interview time.
- Offer threads: `Offer` chip with the offer status.
- Invitation threads: `Invitation` chip (before the candidate accepts, read-only for the employer's first message).
- Admin and support: `Support` chip.

Search across companies, job titles, messages and file names. **+ New message** is limited to threads the candidate can start: replying inside an existing application, writing to an employer about a job the candidate applied to, and writing to support. Candidates can't message an employer they haven't applied to, except through the job's **Ask a question** button, which sends a single question that the employer can answer in a thread (rate limited).

## B3. Thread view

- **Header:** company name and **Verified employer** pill, job title, stage chip, links (**View job**, **Open application**, **View company**), and (for interviews) **Join** or **Reschedule**.
- **Messages:** timestamps, read receipts (shown only if both sides enabled them), and system events inline ("You applied", "Shortlisted", "Interview scheduled for Thu 11:00 AM", "Offer v1 received").
- **Composer:** rich text, attachments (PDF, DOCX, images, up to 10 MB each, virus scanned), and an **Insert** menu (Link my resume, Link my portfolio, Share availability). Candidates choose which resume version to attach; the platform never attaches one automatically.
- **Templates** (candidate-specific): "Thank you and confirming my availability", "Asking about next steps", "Polite follow-up", "Requesting a different interview time", "Asking a question about the offer", "Politely declining". Templates can be edited before sending and are labeled as templates, not AI.
- **AI help (optional, `AI suggestion` label):** **Help me reply** suggests a short draft using only the thread and the candidate's own information, with a **Why** line; the candidate edits and sends. The AI never sends anything on its own and never makes up facts about the candidate.
- **Save as private note:** turn any message into a private note on the application (never shown to the employer).
- **Caption under the composer:** "Keep your conversation on the platform. Never pay money or share bank details with an employer."

## B4. Context panel (right)

- **Job and company:** title, location, work mode, salary range (if shown), company stage pill for startups, **Verified employer** pill, short summary.
- **Application:** stage timeline mini view, applied date, resume version used, next step and date.
- **Interview or offer:** the next interview card or the offer summary (headline terms and expiry) with **Open**.
- **Shared files:** the last 5 files in the thread.
- **Quick actions:** **Open application**, **Practice for this job**, **Add private note**, **Request to withdraw** (opens the withdraw flow), overflow (**Block employer**, **Report**).

For admin and support threads, the panel shows the ticket reference and status instead.

## B5. Employer-initiated contact (invitations)

- Employers can **invite** a candidate to apply or to talk only if the candidate has chosen to be discoverable in Settings (Part D3) and the employer is verified.
- An invitation appears as a card in Messages and in Notifications: employer, role, a short message, and what's visible about the candidate (only what they chose to share). Actions: **Accept and reply**, **Decline**, **Decline and block**, **Report**.
- Until the candidate accepts, the employer sees only that an invitation was sent; they can't see contact details or the full profile beyond what the candidate allowed.
- Invitations are rate limited per employer and per day, and the candidate can pause invitations in Settings.

## B6. Job-seeker-specific rules and scam protection

- **No fees, ever:** messages that ask the candidate to pay for training, equipment, background checks, security deposits, "processing" or any other money are blocked or flagged. The candidate sees a warning at the top of the message: "This message asks for money. Real employers don't ask you to pay to start a job. Report it." with **Report** and **Block**.
- **Off-platform contact:** requests to move to another app, to share a personal phone number early, or to send documents like ID and bank details are flagged with a safety note ("Keep conversations on the platform until you've verified the employer. Share ID documents only for a confirmed job.").
- **Sensitive documents:** the composer shows a reminder before attaching files named like ID, passport, bank statement or similar: "Only share this with a verified employer after you have an offer, and prefer the platform's document tools."
- **Impersonation:** verified badges appear only for platform-verified employers; messages that claim to be from the platform's staff are flagged, and a notice says "Platform staff never ask for passwords or payments in chat."
- **Discrimination and inappropriate questions:** messages that ask for personal characteristics (age, marital status, religion, caste, nationality, health) get a gentle prompt: "You don't have to answer this. You can report it." with **Report**.
- **Response-time hint:** "Employers usually reply within a few days." Guidance only, no penalty for the candidate.
- **Thread lifecycle:** when an application ends (not selected, withdrawn, job closed), the thread stays readable for the candidate for the retention period, with a closing system message. When the candidate blocks an employer, the thread locks.
- **Group threads:** employers may add colleagues to a thread (for example, a hiring manager); the candidate sees who is on the thread.
- **Read receipts:** candidates can turn off sending read receipts in Settings.
- **Language and translation:** a **Translate** option is available (labeled `AI`) for threads in other languages; the original text stays visible.

## B7. States

| State | Behavior |
|---|---|
| No conversations | "No messages yet. They'll appear when you apply or when an employer replies." with **Browse jobs** |
| Unread | Bold name, gold dot, count in the sidebar |
| Failed send | Inline "Couldn't send" with **Retry**; message kept as a draft |
| Invitation pending | Card at the top of the list with **Accept and reply** and **Decline** |
| Closed application | Banner: "This application is closed. Messages are read-only." |
| Blocked or reported employer | Thread locked with a note and a link to support |
| Flagged message | Warning at the top of the message; moderation notice if removed |
| Email not verified | New employer conversations are read-only; banner "Verify your email to reply." with **Resend email** |
| Rate-limited question | "You've asked 3 questions today. Try again tomorrow." |
| Offline | Drafts saved locally, sent when reconnected |

---

# Part C. Notifications: `/notifications`

Uses the shared notifications design (list, filters, mark read, preferences link). Job seeker content below.

## C1. Layout
Header with title, **Mark all as read**, and **Preferences** (links to Settings → Notifications). Tabs: All · Unread · Jobs · Applications · Interviews · Offers · Resume and practice · Account and billing · System. Grouped by day ("Today", "Yesterday", "This week").

## C2. Notification item
Icon (by category), one-line title, short detail, time, unread dot, and a primary action button or link. Clicking opens the related page and marks it read. Overflow menu: **Mark as read or unread**, **Mute this type**, **Mute this company**.

## C3. Job seeker notification types

| Category | Notification | Action target |
|---|---|---|
| **Jobs** | New jobs matching a saved search (instant, daily or weekly) | `/jobseeker/alerts` or Job Search |
| | New job from a followed company | Job Detail |
| | Daily recommendations summary (`AI suggestion`) | `/jobseeker/alerts` |
| | Saved job closing in 3 days and 1 day | Job Detail |
| | Saved job closed or removed | Saved Jobs |
| | Reminder due on a saved job | Saved Jobs |
| | Employer invitation to apply or talk | Messages, Invitations |
| **Applications** | Application received (confirmation) | Application Detail |
| | Application shortlisted, moved to interview, offer, hired, or not selected | Application Detail |
| | Employer message received | Messages |
| | Documents requested by the employer | Application Detail |
| | Application quiet for 14 days (prompt to follow up, once) | Application Detail |
| | Draft application not submitted for 3 days (once) | Apply |
| **Interviews** | Interview times proposed | Interviews, Needs action |
| | Interview scheduled, changed or cancelled | Interview detail |
| | Interview starts in 1 hour and in 10 minutes | Interview detail (**Join**) |
| | Practice suggested for an upcoming interview (24 hours before) | Practice setup |
| **Offers** | Offer received | Offer detail |
| | Offer revised or withdrawn | Offer detail |
| | Offer expiring in 7 days and 48 hours | Offer detail |
| | Employer answered your change request or question | Offer detail |
| **Resume and practice** | Resume needs review after a profile change | Resume Editor |
| | Tailored resume ready | Resume Editor |
| | Feedback report ready | Feedback Report |
| | Practice reminder (optional, weekly, gentle) | Trainer Home |
| | A review request about a practice score was resolved | Feedback Report |
| | Readiness score updated (significant change only) | Progress and Readiness |
| | An employer viewed your shared readiness score | Rubric and Privacy, Consent history |
| **Account and billing** | Purchase receipt, payment failed, plan renewing, trial ending | `/jobseeker/billing` |
| | Pack credits running low or expiring in 7 days | Billing, Usage |
| | Security alerts (new login, new device, password or payment method changed) | Settings → Security |
| | Email or phone verification needed | Settings → Account |
| **System** | Profile completeness tips (weekly, optional) | Profile |
| | Rubric or policy updates | Rubric page or announcement |
| | Safety alerts about scams affecting job seekers | Help → Safety center |
| **Messages** | New message (grouped per conversation) | `/jobseeker/messages` |

## C4. Priority and grouping

- **Urgent** (shown first with a gold-tint background): interview starting soon, times to choose, offer expiring in 48 hours, documents requested with a deadline, security alerts, safety alerts.
- Messages from the same conversation are grouped ("3 new messages from {Company}").
- Digest option collapses lower-priority items (job alerts, recommendations, tips, profile reminders) into one daily or weekly email.

## C5. States

| State | Behavior |
|---|---|
| Empty | "You're all caught up." with a short line about what will appear here |
| Loading | Skeleton rows |
| Muted category | Greyed row note: "You muted job alerts. Change in Preferences." |
| Failed to load | Inline **Retry** |
| Archived or old (90+ days) | Shown under "Earlier" with **Load more** |
| Email not verified | A banner at the top: "Verify your email to get alerts by email." In-app notifications still arrive |

## C6. Job-seeker-specific rules

- Security alerts, billing failures and scam or safety alerts cannot be muted.
- Notifications never include salary figures, offer amounts, resume text, practice scores or other sensitive details in email subjects or push text. Example: "You have a new offer from {Company}" instead of the figures; "Your feedback is ready" instead of the score.
- Notifications avoid pressure language (no "Hurry!" or fake urgency); real deadlines show the actual date and time with the time zone.
- Rejection notifications are gentle and include similar jobs ("Thanks for applying. Here are similar roles.").
- For multi-role users, each notification shows a small role chip (`Job seeker`), and the role switcher shows unread counts per role.
- Quiet hours (Settings) delay non-urgent notifications; interview reminders still follow the candidate's chosen reminder timing.

---

# Part D. Settings: `/jobseeker/settings`

Uses the shared settings design (left section menu, content on the right). Job seeker content below.

## D1. Sections

| Section | Content |
|---|---|
| **Account** | Name, email, phone, language, time zone (default Asia/Kolkata), date and time format, currency display |
| **Security** | Password, two-factor authentication, active sessions and devices, recent security activity, **Sign out everywhere** |
| **Profile and visibility** | Link card to the profile, plus discoverability and what employers can see (D3) |
| **Job preferences** | Link cards to target roles, locations, work mode, salary, company stage, and deal-breakers (`/jobseeker/preferences`) |
| **Notifications** | Per category and per channel preferences (D2) |
| **Applications and messages** | Read receipts, who can invite you, polite follow-up reminders, default resume for easy apply |
| **Resumes and AI** | AI features on or off, default template, what the AI may use (profile, imported resume), delete resume data |
| **Interview practice and data** | Delivery analysis default, save recordings default, transcript default, auto-delete, sharing the readiness score, delete practice data (links to the Rubric and Privacy page for the full controls) |
| **Membership and billing** | Link card to `/jobseeker/billing` (changes happen there, with re-authentication) |
| **Blocked and hidden** | Blocked employers, hidden companies (current employer, for example), jobs I marked "Not interested" |
| **Connected accounts** | Google or Microsoft sign-in, calendar connection (read-only sync for interviews), LinkedIn |
| **Roles** | Roles on this account (Job seeker, plus others if any), **Add a role**, default role at sign-in |
| **Data and privacy** | Download my data, delete my data, consent history, privacy policy |
| **Help and legal** | Terms, privacy policy, community guidelines, platform disclaimer |
| **Danger zone** | Pause my job search, close the job seeker role, delete account |

## D2. Notifications section (job seeker options)

A table with categories as rows and channels (In-app, Email, Push) as columns, using toggles:

| Category | Default |
|---|---|
| Saved search alerts and new jobs from followed companies | In-app, Email (digest) |
| Daily recommendations | In-app |
| Saved job reminders and closing soon | In-app, Email |
| Application updates (status changes) | In-app, Email, Push |
| Employer messages and invitations | In-app, Email, Push |
| Interviews (proposed times, changes, reminders) | In-app, Email, Push |
| Offers (received, revised, expiring) | In-app, Email, Push |
| Documents requested | In-app, Email |
| Resume tips and reminders | In-app |
| Interview practice (reports ready, suggestions, reminders) | In-app, Push (reminders off by default) |
| Billing and receipts | In-app, Email |
| Product updates and tips | In-app (email off by default) |
| Safety and scam alerts | In-app, Email, Push (locked on) |
| Security alerts | In-app, Email, Push (locked on) |

Extras: **Digest** (Instant, Daily at a chosen time, Weekly), **Quiet hours** (for example, 9 PM to 8 AM, urgent security and safety alerts excepted), **Mute a company** (list with **Unmute**), **Interview reminder timing** (10 minutes, 1 hour, 1 day, all selected by default), and **Alert limits** for saved searches (cap per day).

## D3. Profile and visibility section (job seeker options)

- **Discoverability:** three options:
  - **Not discoverable** (default): employers can see the candidate only after they apply.
  - **Discoverable by verified employers:** employers can find the profile in talent search using the fields the candidate selected.
  - **Open to invitations only:** not searchable, but verified employers the candidate has interacted with can invite them.
  A banner shows the effect of the chosen option in plain words.
- **What employers can see in search (when discoverable):** toggles for headline, skills, experience level, location (city or region only), expected salary range, work mode, availability, and a resume summary. **Hidden by default:** full name, photo, exact location, contact details, current employer, education institution names. The candidate can hide specific current employers or companies from search (for example, their own employer).
- **Contact details:** shared only when the candidate applies or accepts an invitation. Never shown publicly.
- **Blind review preference:** a note that some employers hide names and photos at the first screening step, and a toggle to **Remove my photo from my profile** (photos aren't required by default).
- **Practice results and readiness score:** a link to the sharing settings (per application or none); default: not shared.
- **Open to work status:** Not looking, Casually looking, Actively looking, with an optional "start date" field. Visible to employers only if discoverable.
- **Profile visibility to followed companies and the platform:** the platform uses the profile for recommendations and matching; a toggle **Use my profile and practice insights to suggest jobs** (default on for profile, off for practice insights, as in Alerts and Recommendations).
- **Pause invitations:** temporarily stop employer invitations with an optional return date.

## D4. Applications and messages section

- **Read receipts:** send or don't send "seen" status in message threads (default off).
- **Who can invite me:** All verified employers, Employers I've applied to or followed, No one.
- **Default resume for easy apply:** choose from My resumes (links to `/jobseeker/resumes`).
- **Default contact details:** the email and phone shared on applications (editable per application).
- **Follow-up reminders:** a reminder after 14 days without an application update (on by default).
- **Auto-save drafts:** on by default; drafts are deleted after 30 days of inactivity.
- **Withdraw reminders:** when an offer is accepted elsewhere, a prompt to withdraw remaining applications (never automatic).

## D5. Resumes and AI section

- **AI resume features:** on or off (drafting, tailoring, suggestions). Turning them off keeps manual editing and export working.
- **What the AI may use:** the profile, imported resumes and text typed into resume forms; a note that candidate data isn't used to train third-party models.
- **Default template and font** for new resumes.
- **Flags:** a reminder that the AI flags claims it can't support, with a toggle to show or hide gentle "weak wording" hints (the fact flags can't be turned off because they protect accuracy).
- **Delete resume data:** delete all resumes and versions (locked application snapshots remain with the employers according to their retention rules; the candidate can ask those employers to delete).

## D6. Interview practice and data section

Short controls with links to the full page (`/jobseeker/practice/rubric`):
- Delivery analysis default (Off, per session)
- Save recordings by default (Off, On)
- Keep transcripts by default (On, Off)
- Auto-delete recordings after 7, 30 or 90 days, or never
- Include delivery results in the readiness score (Off by default)
- Share the readiness score with employers (Off, per application, all)
- **Delete all recordings** and **Delete all practice data**
- **Pause practice tracking**

## D7. Data and privacy section

- **Download my data:** a zip with profile, resumes, applications (what was shared), messages, practice reports, answer bank and consent history. One request per day; delivered by notification.
- **Delete my data:** choose what to delete (practice data, resumes, applications and messages, everything), with a clear list of what is deleted and what is retained (for example, records the law requires, applications already received by employers per their retention rules, billing records). Re-authentication required.
- **Consent history:** a table of what was shared with whom and when (resume versions, practice scores), with **Revoke** where possible.
- **Ask an employer to delete my data:** a shortcut that opens a request for a chosen employer.
- **Anonymous statistics:** opt in or out of contributing anonymized data to platform statistics.

## D8. Roles section

- **Roles on this account:** Job seeker (and others if any), each with its status and a **Switch** button.
- **Add a role:** start the role setup (for example, mentor or founder), with a note that each role has separate data and billing.
- **Default role at sign-in:** choose the role to open after login.
- **Founder note:** a founder who is also a job seeker can't apply to their own startup's job from the same account (explained in a short note).

## D9. Danger zone

- **Pause my job search:** hides the profile and stops alerts and invitations; applications and offers continue; optional return date.
- **Close the job seeker role:** requires withdrawing or completing active applications and resolving open offers, with a checklist of blockers; resumes and practice data can be downloaded first.
- **Delete account:** re-authentication required; explains what is deleted and what is retained.

## D10. Behavior

- Changes save per section with a toast and **Undo** where safe; security, discoverability, data deletion and danger-zone changes need confirmation.
- Sensitive actions (password change, 2FA change, email or phone change, deleting data, making the profile discoverable, closing the role, account deletion) require re-authentication.
- Unsaved changes prompt before leaving.

## D11. States

| State | Behavior |
|---|---|
| Email not verified | Gold-tint banner in Account with **Resend email**; email-based settings are limited |
| Phone not verified | Phone-based 2FA disabled until verified |
| Active applications or offers block an action | Inline message listing what to resolve, with links |
| Save error | Inline message with **Retry** |
| 2FA not enabled | Gold-tint nudge in Security: "Add two-factor authentication to protect your account and your documents." |
| Calendar connection failed | Warning chip with **Reconnect** |
| Discoverable with an incomplete profile | Warning "Your profile is mostly empty. Add skills so the right employers can find you." |
| Account paused | Banner with **Resume job search** |
| Minor or underage account detected | Handled per the platform's age policy with a message and a link to support (the platform is for adults) |

---

# Part E. Help and Support: `/help`

Uses the shared help design (search, topics, contact). Job seeker content below.

## E1. Layout
Top: search bar ("Search help for job seekers"). Below: topic cards, popular articles, and a contact panel. A role chip near the title shows the current role (`Job seeker`), with a small link "Not a job seeker question? Switch role." A prominent **Report a scam or fake job** button sits near the top.

## E2. Job seeker help topics

| Topic | Example articles |
|---|---|
| **Getting started** | Setting up your profile, importing a resume, setting job preferences, verifying your email |
| **Finding jobs** | Using filters, saved searches and alerts, how recommendations work, startups hiring, understanding salary and equity |
| **Applying** | One-click apply, tailoring a resume to a job, screening questions, what the employer sees, withdrawing an application |
| **Applications and interviews** | Application stages explained, choosing interview times, preparing, what to do if an employer goes quiet, following up politely |
| **Offers** | Understanding an offer, asking questions, requesting changes, comparing offers, accepting or declining, what is binding |
| **Resumes and AI** | Building a resume, how the AI works (facts only), ATS checks, exporting, versions |
| **Interview practice** | Starting a session, modes (text, voice, video), feedback and scores, drills, the readiness score, privacy of recordings |
| **Privacy and sharing** | What employers can see, discoverability, sharing your readiness score, blocking an employer, deleting data |
| **Membership and billing** | Free vs paid, packs, plans, invoices, refunds, cancelling |
| **Safety and scams** | How to spot fake jobs, what employers can and can't ask, verified employers, reporting |
| **Fairness and conduct** | Questions employers shouldn't ask, how to report discrimination, community guidelines |
| **Account and security** | Roles, passwords, two-factor, data download, closing your account |

Each article follows one template: short answer first, steps, screenshots (optional), related articles and a **Was this helpful?** control. Articles on offers and employment include the disclaimer: "The platform doesn't give legal, immigration, tax or career advice. Read your agreement and get your own advice if you need it."

## E3. Contact and tickets: `/help/tickets`

- **Contact support** button opens a form: category (from the topics above), related item (a job, application, offer, interview, practice session or invoice, chosen from the candidate's own records), description (20–2,000 characters), attachments (up to 5 files, 10 MB each), preferred contact method, and urgency (Normal, Urgent for scams, safety, payments, account security).
- **My tickets:** table with ID, subject, category, status (`Open`, `Waiting for you`, `In progress`, `Resolved`), last update. Ticket detail shows the thread with support, attachments and a **Reopen** option for 14 days after resolution.
- Expected response times are shown plainly (for example, "We usually reply within 1 business day. Scam and safety reports are reviewed first.").
- **Priority support:** shown if the candidate's plan includes it.

## E4. Report a concern

A dedicated, prominent link and button. Options:
- **Report a job or employer** (fake job, fee requested, misleading pay or role, impersonation, spam)
- **Report a message** (asks for money, personal documents, off-platform contact, harassment, pressure)
- **Report a question or behavior in an interview** (asks about protected characteristics, inappropriate conduct, discrimination)
- **Report an offer issue** (terms changed, asks for payment, suspicious documents)
- **Report an AI problem** (wrong or unfair feedback, inappropriate AI behavior, scoring issue; links to the review process)
- **Report a privacy concern** (data shared without consent, unwanted contact)
- **Report a safety or security issue**

Reports can be confidential. The form explains what happens next and the expected timeline. Urgent reports (scam, safety, payment) show immediate steps first (stop contact, don't send money, keep records) and urgent contact options. Reports are linked to the relevant record when the candidate selects one, and the reported job or employer can be hidden immediately for the reporter.

## E5. Scam and safety center

A short page linked from Help, Messages and Offers:
- Real employers don't charge fees to apply, interview, train, onboard or issue equipment.
- Check the **Verified employer** badge and the employer's company page.
- Be careful with unrealistic salaries, very fast offers without an interview, vague job descriptions, and messages that push you to another app.
- Don't share ID numbers, bank details, passwords or one-time codes before a verified job offer, and never through chat.
- Verify offers by contacting the company through its official website, not through links in a message.
- What to do if you've been targeted: stop contact, don't pay, keep screenshots, report it, contact your bank if money was sent, and contact local authorities or a cybercrime helpline where appropriate.
- Links to **Report a scam or fake job** and **Contact support**.

## E6. Other elements

- **Platform status** link and any active incident banner.
- **Release notes** for job seekers.
- **Community guidelines** and **Code of conduct** (always one click away).
- **Accessibility help:** how to use text and voice modes, captions, extended time and keyboard shortcuts.
- **Disclaimer:** "The platform connects job seekers with employers. It doesn't guarantee jobs or interviews and doesn't give legal, immigration, tax or career advice."
- **Contact on the page footer:** support email and, if offered, chat hours.

## E7. States

| State | Behavior |
|---|---|
| No search results | "No articles found." with suggested topics and **Contact support** |
| Offline | Cached articles when available; contact form saved as a draft |
| Ticket failed to send | Inline **Retry**; the draft is kept |
| Email not verified | Verification topics highlighted at the top with **Resend email** |
| Active incident | Banner with a link to the status page |
| Urgent scam or safety report | Immediate safety steps shown before the form; the ticket is marked urgent automatically |
| Signed out | General articles and the Safety center are readable; tickets and personalized records require sign-in |

---

# Part F. Data and validation

| Field | Rule |
|---|---|
| Message | Up to 5,000 characters; attachments up to 10 MB each, virus scanned |
| Message content | No requests for fees, payments or off-platform deal steps; flagged and warned |
| Ask a question (before applying) | Up to 3 per day; up to 500 characters each |
| Employer invitations | Rate limited per employer and per day; candidate can pause invitations |
| Notification preferences | Security, safety and billing-failure alerts cannot be switched off |
| Quiet hours | Start and end times required; urgent security and safety alerts excepted |
| Time zone and language | Chosen from supported lists |
| Phone number | Valid format, verified by a code before use for 2FA |
| Discoverability | Changing to a more visible option requires re-authentication; hidden fields stay hidden |
| Support ticket description | Required, 20–2,000 characters; up to 5 attachments, 10 MB each |
| Data export | One request per day; ready within the time shown on the page |
| Account deletion | Re-authentication and blocking checklist must be clear |

**Audit log:** security changes, discoverability and consent changes, role changes, data export and deletion requests, ticket creation and resolution, reports, each with user and time (downloadable from Settings).

---

# Part G. Data connections

| Feature | Connected to |
|---|---|
| Conversations and attachments | ERP chat service; employer's Candidate Profile and Messages (`/startup/hiring/...`) |
| Invitations | Employer's Talent Search and Shortlist (`/startup/hiring/talent`) |
| Notification events and delivery | ERP notification service (in-app, email, push) |
| Jobs, applications, interviews, offers | Job seeker pages (find and apply, applications and offers) |
| Resumes and practice | AI resume maker and AI interview trainer pages |
| Billing | Membership and Billing (`/jobseeker/billing`) |
| Account, security, roles | Identity and access |
| Calendar sync | External calendar (read-only) |
| Scam and abuse detection, reports | Admin console, moderation queue |
| Help articles and tickets | Support system, admin console |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part H. CSS tokens

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

# Part I. Build order (suggested)

1. Confirm the role guard and active-role switching (Part A3), so shared pages load the right content.
2. **Notifications:** wire event types as each job seeker page ships; make security, safety and billing-failure alerts non-mutable from the start.
3. **Settings:** Account, Security and Profile and visibility (discoverability) first; Notifications and Data and privacy next; Resumes, practice controls and Danger zone last.
4. **Messages:** conversation list and thread first (application threads), then invitations, templates, the scam and sensitive-document warnings, and moderation rules.
5. **Help and Support:** articles and search first, then tickets, **Report a concern** and the Scam and safety center.
6. Empty, loading and error states, then mobile layouts.

**Reminder for the build:** the shells are shared, but each page must load job seeker content by the active role. Filter all conversations, notifications and settings by the signed-in user on the server, enforce that employers can contact a candidate only inside an application thread or after an accepted invitation, keep security and safety alerts non-mutable, require re-authentication for sensitive changes, and build the fee, off-platform and sensitive-document warnings into the messaging flow from the start. Get legal advice on candidate privacy, discoverability and data deletion, and on handling scam reports, before launch.
