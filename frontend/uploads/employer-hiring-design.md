# Employer Hiring Pages Design

The pages where an employer turns a hiring need into a hire: recording the need, writing and publishing a job, working the applicant pipeline, reviewing and comparing candidates, finding talent proactively, interviewing, and making offers. They implement the employer side of your proposal's Jobs module: job posting with screening questions, an applicant pipeline (applied, shortlisted, interview, offer, hired), candidate search and shortlist with practice scores visible only if the candidate allows, the verified-employer badge, and trust and quality rules. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Employer role** only, in a company account. The project owner will add the role and permission logic, so build each page assuming the signed-in user is acting in the `employer` role and belongs to a **verified** company. What each person can do also depends on their **team role** (Owner, Admin, Recruiter, Hiring manager, Interviewer, Viewer). Candidate data is personal and sensitive: the server must filter everything by company, team role and candidate consent. Details are in **Part A9**. Do not show these pages to startups (who use the same hiring tools under `/startup/hiring/...`), mentors, investors or job seekers.

> **Reminder: AI helps, people decide, and the process must be fair.**
> AI suggestions (job-post wording, skills-match hints, interview question ideas, summaries) are labeled aids with reasons. The AI never rejects, ranks into a decision, or scores candidates on personal characteristics. Practice results appear only with the candidate's consent and with a "practice result" label. Hiring practices must follow applicable employment and anti-discrimination law. The platform doesn't give legal advice.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Hiring Overview | `/employer/hiring` | Jobs, internal hiring requests and a needs-attention list |
| 2 | New Hiring Request | `/employer/requests/new` | Record a hiring need and send it for internal approval |
| 3 | Job Editor | `/employer/jobs/new` and `/employer/jobs/:jobId/edit` | Write, preview and publish a job post with screening questions |
| 4 | Job Detail and Applicant Pipeline | `/employer/jobs/:jobId` | Applied, shortlisted, interview, offer, hired; scorecards; insights |
| 5 | Candidate Profile | `/employer/jobs/:jobId/applicants/:applicantId` | Resume, answers, shared practice result, notes, feedback, decision |
| 6 | Compare Candidates | `/employer/jobs/:jobId/compare` | Up to 4 candidates side by side on the same criteria |
| 7 | Talent Search and Shortlists | `/employer/talent` | Find opted-in candidates, shortlist, invite to apply, limited outreach |
| 8 | Interviews | `/employer/interviews` | Schedule, calendar, scorecards, feedback reminders |
| 9 | Offers | `/employer/offers` | Draft, approve, send and track offers |
| 10 | Offer Detail | `/employer/offers/:offerId` | Terms, versions, negotiation, documents, approvals |

Related files: `startup-hiring-design.md` covers the same hiring module for startups on the platform (Hiring Overview, New Hiring Request, Job Editor, Job Detail and Pipeline, Candidate Profile, Talent Search, Interviews, Offers, Employer Page). **Build the hiring module once and mount it under both `/startup/hiring/...` and `/employer/...`**; this file adds what the employer role needs on top (company accounts, team roles, internal approvals, templates, Compare Candidates and a separate Offer Detail page). The candidate's side is in `jobseeker-find-apply-design.md` and `jobseeker-applications-offers-design.md`. The employer dashboard is in `employer-dashboard-design.md`.

---

# Part A. Shared foundations

## A1. Design principles

- **Pipeline first:** the main question is "who needs my attention today?" The pipeline and next actions lead every page.
- **Fair and transparent:** the same criteria and scorecards for every candidate, published stage names, blind review as an option, structured rejection reasons, and AI as a helper only.
- **Respect for candidates:** reply to everyone. The product nudges employers to answer applicants within 14 days and gives kind templates. No ghosting by design.
- **Candidate consent respected:** optional data (practice results, extra documents, contact details) appears only if the candidate allowed it, and the page says so.
- **Team-friendly:** hiring is a team activity. Roles, assignments, internal comments and approvals are first-class.
- **Connected to the company's plan:** requests link to budgets and approvers; hires hand off to onboarding.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, hired status |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, shortlisted, changed terms, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlights, AI labels, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Offer accepted, verified, positive |
| `--warning` | `#B7791F` | Needs action, expiring, waiting |
| `--error` | `#B42318` | Rejected, overdue, errors, policy flags |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Times show the time zone (default Asia/Kolkata, set in Hiring Preferences). Currency follows the company setting (₹ with Indian grouping by default).

## A4. Shared layout

Desktop (≥ 1200px): the employer sidebar and top bar from the dashboard, then a 12-column grid with 24px gutters and a max content width of 1280px (the pipeline board scrolls horizontally). Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar (Home, Jobs, Candidates, Interviews, More), the pipeline shows one stage at a time, filters in a bottom sheet.

## A5. Shared components

### Job and request status chips
`Draft` (stone), `Pending approval` (warning tint), `Open` (success tint), `Closing soon` (warning tint), `Paused` (stone outline), `Closed` (ink outline), `Filled` (ink fill), `Needs attention` (error tint, policy flag). Requests: `Draft`, `Pending approval`, `Approved`, `Declined`.

### Applicant stages
`Applied` → `Shortlisted` → `Interview` → `Offer` → `Hired`, plus `Rejected` and `Withdrawn`. Interview can have rounds as sub-stages (Screening call, Technical, Founder chat, and so on). Stage colors: stone for Applied, gold-tint for Shortlisted, ink for later stages, error text for Rejected.

### Candidate card
Avatar (or initials; hidden in blind review), name (or "Candidate #23" in blind review), headline (current role), match hint chip (for example "Skills match: 5 of 7 must-haves", `AI suggestion` label with reasons), applied date, source (Job search, Startups hiring, Invitation accepted, Recommendation, Direct link), small icons (resume, answers, shared practice result, notes), assignee, and a **quick actions** menu (Shortlist, Reject kindly, Schedule interview, Message).

### Candidate consent badge
A small lock icon with the tooltip "Shown with the candidate's permission." Fields the candidate hasn't shared appear as "Not shared" in `--stone-400`.

### AI suggestion label
A small `AI suggestion` pill (gold-tint with a sparkle icon) and a **Why?** link. Everything labeled is optional, explained, and never changes a stage or a decision.

### Scorecard
Criteria with a 1–4 scale and written anchors, required comments, and a recommendation (Strong yes, Yes, No, Strong no). The same scorecard applies to every candidate in a job round.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave drafts and notes, "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner: "Verify your company to publish jobs and contact candidates." with **Finish verification**; drafts and internal tools still work |
| Plan limit reached | Message with the limit and **Manage plan**; drafts and existing jobs stay unaffected |
| No permission | Controls hidden or disabled with a tooltip: "Ask an Owner or Admin." |
| Company paused or suspended | Read-only pages with a banner and **Contact support**; candidate-facing actions disabled |
| Offline | Cached content with a banner; sending, publishing and deciding are disabled until reconnected |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Pipeline drag and drop has a keyboard alternative (**Move to…** menu); moves are announced to screen readers ("Moved to Shortlisted").
- Calendars, tables and forms are fully keyboard operable; modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Fairness, privacy and conduct rules (apply to all pages)

- **Same criteria for everyone:** scorecards and screening questions are set per job and applied to every candidate in that round. Changing them mid-process shows a warning and records the change.
- **Blind review (optional per job):** hides names, photos and school names at the first screening step; the server removes these fields, not only the UI.
- **No discriminatory criteria:** screening questions and filters can't ask about or use age, gender, religion, caste, nationality, marital status, family plans, health, photos or similar characteristics. The Job Editor blocks such questions, and Talent Search doesn't offer such filters.
- **No automated decisions:** nothing is auto-rejected, auto-ranked into an outcome or auto-advanced by AI. Match hints and summaries are explained suggestions.
- **Candidate consent:** practice results show only with consent, labeled "Practice result provided by the candidate. Not an assessment to base a hiring decision on." Recordings, transcripts and delivery analysis from the interview trainer are never available to employers.
- **Kind and clear rejections:** a reason from a list plus a polite message template; no silent ghosting. A reminder appears for candidates waiting over 14 days.
- **Respect for time:** interview scheduling shows the candidate's time zone, offers have real expiry dates, and employers can't create fake urgency.
- **No fees to candidates:** a job, message or offer that asks candidates for money (training, equipment, deposits, "processing") is blocked or flagged and can lead to suspension.
- **No off-platform pressure:** job posts and messages can't carry personal contact details or payment links; contact details are shared only after the candidate applies or accepts an invitation.
- **Data minimization and retention:** employers see only what is needed. Applicant data is kept for a configurable period (default 12 months after the job closes) and then deleted or anonymized unless the candidate opted into a talent pool. Candidates can withdraw and ask for deletion.
- **Legal:** hiring practices, offers and employment agreements must follow applicable law. The platform doesn't give legal advice. Offers shown in the platform are proposals; binding terms are in the signed employment agreement.
- **Data handling:** encrypted in transit and at rest; follows the platform's privacy policy and applicable law (for example, India's DPDP Act). Interview recordings are off by default and only with both sides' consent.

## A9. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `employer` role, as a member of a company account, can open `/employer/...` routes |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup (without an employer account), mentor, investor and job seeker users see a 403 page ("This page is for employers") with a link to their own home; no company or candidate data is fetched or rendered |
| **Multi-role users** | The role switcher changes the sidebar and routes between `/employer/...`, `/startup/...`, `/mentor/...`, `/investor/...` and `/jobseeker/...`. Data never mixes across roles |
| **Company scope** | All data is filtered by the company the user belongs to; the server checks membership on every request |
| **Verification gate** | Unverified companies can create drafts but can't publish jobs, invite candidates or message candidates |
| **Team roles** | **Owner:** everything, including billing, approvals and offers. **Admin:** all hiring actions, approvals and offers; no billing changes. **Recruiter:** create and manage assigned jobs, review and move candidates, schedule interviews, draft offers. **Hiring manager:** manage their own jobs, score, decide, approve offers for their jobs. **Interviewer:** see only assigned candidates and interviews and submit scorecards. **Viewer:** read-only counts and job lists, no candidate personal data. Enforced by the server on every request |
| **Scorecard secrecy** | An interviewer can't see colleagues' scores or comments until they submit their own; the server enforces this |
| **Job ownership** | Recruiters and hiring managers see only jobs assigned to them or their team unless an Owner or Admin widens access |
| **Candidate data and consent** | Candidate fields are returned only for applications submitted to this company, invitations the candidate accepted, or fields the candidate made discoverable; optional shared data (practice result) requires a valid consent record, checked on every request |
| **Blind review** | When enabled for a job, name, photo and school fields are removed from responses at the screening stage by the server |
| **Sensitive actions** | Publishing a job, sending an offer, approving an offer, exporting candidate data, bulk rejecting, changing team roles and deleting a job require confirmation; sending and approving offers and exporting also require re-authentication |
| **Separation of duties** | Offers above a company-set threshold need approval from someone other than the creator |
| **Rate limits** | Outreach and invitations are limited per day and per plan; the server enforces limits |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner; candidate personal data is masked unless a dispute or safety case allows access and is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Hiring Overview: `/employer/hiring`

## B1. Purpose
The hub for all hiring: live jobs, internal hiring requests and what needs attention.

## B2. Layout
Header with title and **+ Hiring request** and **+ Job**. Summary strip, tabs, then the list with a side column on desktop.

### Summary strip
| Stat | Example |
|---|---|
| Open jobs | 4 |
| Total applicants | 86 |
| Interviews this week | 9 |
| Offers out | 2 |
| Avg time to hire | 28 days |

## B3. Tabs

### Jobs
Cards or table rows: title, status chip, location and type (remote, hybrid, on-site; full-time, part-time, contract, internship), posted date, days open, owner, applicant count with a mini stage bar, "+6 new" badge, and actions (**Open pipeline**, **Edit**, overflow: Pause, Duplicate, Close, View public page). Filters: status, department, owner, location. Search by title. Team-role scope applies (Recruiters see their jobs).

### Requests
Internal hiring requests not yet posted: role, department, urgency, headcount, requested by, target start date, budget range, status (`Draft`, `Pending approval`, `Approved`, `Declined`), approver. Actions: **Create job post** (approved requests), Edit, Cancel. Approvers (Owner, Admin, or the people the company set) see **Approve** and **Decline** with a note.

### Needs attention
Generated list: new applicants unreviewed over 3 days; candidates waiting over 14 days; interviews awaiting feedback; offers awaiting approval or expiring within 48 hours; jobs without applicants after 14 days; jobs flagged by Trust and Safety. Each item links to the exact page or drawer.

## B4. Side column
- **Templates:** quick links to start from a job template or a previous job (**Duplicate a job**).
- **Upcoming interviews:** next 3 with time, candidate (or "Candidate #23") and interviewers.
- **Hiring budget and headcount:** plan vs filled, if the company set it.
- **Plan and fees:** open jobs used of limit, featured listings left, **Manage plan** (Owner and Admin).

## B5. States
- **Empty:** "Plan your first hire." with **+ Hiring request** and **+ Job**.
- **Not verified:** banner and **Finish verification**; **+ Job** can save drafts but not publish.
- **Plan limit reached:** inline message on **+ Job**; drafts can still be saved.
- **Requests pending too long (over 5 days):** gentle reminder to the approver.

---

# Part C. New Hiring Request: `/employer/requests/new`

A short form (single column, max width 720px) to record a need before writing a job post. It can also open as a drawer from the Hiring Overview.

**Fields**
- Role title (required)
- Department and team
- Headcount (1–20)
- Why now: dropdown (Growth, Replacement, New project, Skill gap, Other) plus a note
- Urgency (Low, Medium, High)
- Budget range (monthly or annual; currency from company settings)
- Employment type and work mode (remote, hybrid, on-site) and location
- Target start date
- Key skills and must-haves (chips, up to 10)
- Hiring manager (default: me) and approvers (Owners or Admins, or the company's approval chain)

**Right panel (desktop):** "What this affects": a simple cost estimate (annual cost of the budget range times headcount) labeled "Estimate", and the number of open jobs against the plan limit.

**Buttons:** **Submit request** (primary; goes to approval unless the user can approve their own within a company-set limit), **Save draft**, Cancel.

**After submit:** toast and redirect to the Requests tab; approvers are notified. Declined requests show the approver's note.

For startups on the platform, requests can also link to a stage criterion and the finance runway preview (see `startup-hiring-design.md`).

---

# Part D. Job Editor: `/employer/jobs/new` and `/employer/jobs/:jobId/edit`

A split layout: form on the left (7 col), live preview on the right (5 col, the page candidates will see). On mobile, a **Preview** toggle replaces the split.

## D1. Sections (stepper at the top; all sections scroll on one page on desktop)
1. **Basics:** job title, department, employment type, work mode, location (city or remote regions), number of openings, link to a hiring request (auto-filled if started from one), and **Start from a template** (Templates and Scorecards page).
2. **Description:** rich text with About the role, What you'll do, What we're looking for, Nice to have, What we offer. **Improve with AI** (`AI suggestion`): suggests clearer wording and flags biased or exclusionary terms ("rockstar", "young team"); the employer accepts or ignores each suggestion. A company context block from the Company Page can be toggled on.
3. **Requirements:** skills (must have vs nice to have), experience range, education (optional, not mandatory by default), languages. A hint: "Requirements that aren't essential reduce your applicant pool. Keep must-haves to 5 or fewer."
4. **Compensation:** salary range (min, max, period, currency), equity range (optional), benefits tags, **Show salary publicly** (recommended; some regions require it).
5. **Screening questions:** up to 8 (short text, long text, yes or no, multiple choice, file upload; required or optional), suggested questions by role, a question bank from Templates. **No knockout questions** (auto-reject on an answer) are offered. Questions about protected characteristics are blocked with an explanation.
6. **Hiring process:** pipeline stages with names and a scorecard per interview round, interviewers per round, **Blind review** toggle (hide names, photos and school names at screening), **Allow candidates to share interview practice results** (the candidate decides whether to share), expected timeline shown to candidates.
7. **Publish settings:** visibility (Public on the Jobs marketplace, Platform members only, Link only), application deadline, close automatically when filled, featured listing option with price shown, auto-acknowledgement message (editable), reply-time promise (for example, "We reply within 14 days") shown on the job and company page.

## D2. Actions
**Save draft** (autosave), **Preview**, **Submit for approval** (for roles without publish rights) or **Publish** (Owner, Admin, and others with publish permission). Publish checks:
- Company is verified
- Required fields filled and salary range sane
- No contact details or payment links in the description
- No fee requests or discriminatory wording (blocked with reasons)
- Duplicate-post warning
- Plan limit not exceeded

## D3. States
- **Validation:** inline messages; the stepper marks incomplete steps with a warning icon.
- **Published:** success banner with **View public page** and **Share link**.
- **Edit a published job:** changes apply on save; a warning appears if a change affects existing applicants (for example, removing a required question), and the change is logged.
- **Policy flag:** if the post triggers a content check, the reason and how to fix it appear; the post stays in Draft or is paused until fixed. **Appeal** is available.
- **Approval pending:** banner with the approver and **Remind**.
- **Not verified:** **Publish** disabled with the reason.

---

# Part E. Job Detail and Applicant Pipeline: `/employer/jobs/:jobId`

## E1. Header
Job title, status chip, location and type, owner, posted date, days open. Actions: **Edit job**, **Pause**, **Close**, **Share**, overflow (Duplicate, View public page, Export applicants (with re-authentication), Delete draft). Tabs: **Pipeline** · **Applicants** · **Job post** · **Team and scorecards** · **Insights**.

## E2. Pipeline tab (default)
- **Board** with columns Applied, Shortlisted, Interview (with sub-rounds), Offer, Hired. Rejected and Withdrawn sit in a collapsible bar at the end.
- Candidate cards (A5). Drag to move (keyboard alternative: **Move to…**). Moving to **Interview** prompts scheduling; moving to **Rejected** requires a reason and message choice (Part F6); moving to **Offer** opens the offer creation flow (Part J).
- **Review mode:** a focused full-screen queue to go through new applicants one by one with keyboard shortcuts (Shortlist, Reject kindly, Next), using the candidate summary and screening answers.
- Toolbar: search, filters (stage, source, match hint, rating, new only, unrated, assignee), sort (newest, rating, waiting longest), **Blind review** indicator and toggle (if enabled for the job, the toggle applies only to the first stage).
- **Bulk actions:** move, reject with a template message, assign, add to a talent pool (only for candidates who opted in).
- Side summary: conversion at each stage, average time per stage, applicants by source.

## E3. Applicants tab
Table of all applicants: name (or "Candidate #23"), current role, location (city or region), experience, match hint, average rating, stage, applied date, source, assignee, actions. Saved filters and CSV export (Owner and Admin, with re-authentication and a consent reminder).

## E4. Job post tab
Read-only preview of the live post with **Edit** and a link to the public view.

## E5. Team and scorecards tab
- Interviewers per round with their pending feedback counts.
- Scorecard builder: criteria with a 1–4 scale and written anchors, required comments; changing criteria after interviews started shows a warning.
- Rule: interviewers can't see each other's scores until they submit their own.
- **Hiring team:** members with their role on this job (hiring manager, recruiter, interviewer) and **Add member**.

## E6. Insights tab
Funnel (Applied to Hired), time to first response, time to hire, source performance, drop-off by stage, offer acceptance rate. Same chart style as the Analytics page; charts appear only with enough data. Descriptive only; no candidate rankings.

## E7. States
- **No applicants yet:** "Your job is live. Share it to get applicants." with a share link, tips ("Add a salary range", "Shorten the description"), and **Find candidates** (Talent Search).
- **Applicants waiting over 14 days:** a gold-tint banner "12 candidates are waiting for a reply." with **Reply with a template**.
- **Job closed or filled:** banner; the pipeline becomes read-only; remaining candidates can be moved to a talent pool (only with consent) and sent a thank-you message.
- **Paused:** banner "This job is paused and hidden from search."
- **Policy flag or report:** error-tint banner with the reason and **Appeal**.
- **Interviewer view:** only assigned candidates appear; a note explains this.

---

# Part F. Candidate Profile: `/employer/jobs/:jobId/applicants/:applicantId`

Opens as a full page on desktop and as a right drawer (560px) from the pipeline for quick review.

## F1. Layout
Left main column (8 col), right sticky panel (4 col).

### Header
Avatar (hidden in blind review), name (or "Candidate #23"), headline, location (city or region), applied date, source, stage chip, match hint chip with reasons (`AI suggestion`). Actions: **Shortlist**, **Schedule interview**, **Message**, **Reject kindly**, overflow (Move stage, Add to talent pool (only if the candidate opted in), Download resume (Recruiter and above), Report profile).

### Tabs
1. **Overview**
   - Summary: key experience, skills (matched skills highlighted in gold-tint), education (school names hidden in blind review at screening), links (LinkedIn, portfolio, GitHub) hidden in blind review at screening.
   - **Match explanation:** matched and missing requirements with plain reasons (`AI suggestion`); no hidden single score.
   - Screening answers.
2. **Resume:** in-page viewer of the exact resume submitted (an immutable snapshot); a pill "Created with the platform's resume maker" if applicable; download for allowed roles.
3. **Interview practice** (only if the candidate chose to share): job-readiness score and, if chosen, dimension scores (clarity, structure, relevance, confidence), with the published rubric link and the label "Practice result provided by the candidate. Not an assessment to base a hiring decision on." If not shared: "The candidate has not shared practice results." Sharing is never required, and the absence of results must not be treated negatively; the page says so.
4. **Interviews and feedback:** timeline of rounds with interviewer scorecards (hidden until you submit yours), comments and recommendations.
5. **Notes:** shared team notes with `@mentions`; a **private note** toggle (visible only to the author).
6. **Messages:** secure thread with the candidate, templates, attachments; messages stay on the platform.
7. **Activity:** audit log (stage moves, views, messages, downloads, exports).

### Right panel (sticky)
- **Decision box:** current stage, average rating, interviewer recommendations count, next step.
- **Quick scorecard** for the signed-in interviewer: ratings per criterion with comments and **Submit feedback**.
- **Compare:** add to a comparison (Part G).
- **Details:** contact info shown only if shared (after applying it is shared with the employer, per the candidate's consent), notice period, expected pay (if provided), work authorization (only if the employer asked, never used to rank), preferred work mode.
- **Fairness reminder:** a short note: "Judge against the job criteria. Don't consider age, gender, religion, caste, nationality, marital status or health."

## F6. Rejection flow (modal)
- **Reason (required):** Skills mismatch, Experience, Role filled, Compensation, Timing, Withdrawn, Other. Reasons are for the employer's records and for the candidate's polite message only if chosen.
- **Message template (editable):** a polite, specific tone; option to add brief feedback.
- **Add to talent pool:** only if the candidate agreed to be considered for future roles.
- The message is sent when the employer confirms; **Reject** requires confirmation.

## F7. States
- **Blind review on:** name, photo, links and school names hidden until the candidate reaches Interview, with a banner explaining.
- **Withdrawn candidate:** banner and read-only profile.
- **Conflict of interest:** interviewers can flag one; the system excludes them from that candidate's scoring and the Owner or Admin is notified.
- **Duplicate application (same person):** a note and link to the other application.
- **Data deletion requested:** banner "This candidate asked for their data to be deleted." The profile is removed according to policy and the pipeline shows an anonymized placeholder.
- **Not enough permissions:** sections hidden for Viewers and Interviewers according to Part A9.

---

# Part G. Compare Candidates: `/employer/jobs/:jobId/compare`

## G1. Purpose
A side-by-side view of up to 4 candidates for the same job on the same criteria, so a team can discuss fairly. It uses only information the candidate submitted or shared, and the team's own scorecards.

## G2. Layout
Header with the job title, a selector chip row ("Compare: {A} · {B} · {C} · **+ Add**"), a saved-comparison menu, **Share with the hiring team** and **Export PDF** (Owner, Admin, Recruiter, with re-authentication). Below: a sticky header with candidate names (or "Candidate #23" in blind review), then the comparison table.

## G3. Comparison table
Same labels in the same order for every candidate, in collapsible sections:

| Section | Rows |
|---|---|
| **Overview** | Current role, years of experience, location, availability, notice period, source |
| **Requirements** | Each must-have and nice-to-have: met, partly, not on resume (taken from the resume and answers, with a link to where it appears) |
| **Screening answers** | Each question with the candidate's answer (short answers inline, long answers expandable) |
| **Interview feedback** | Scorecard criteria averages per round, recommendations count, interviewer comments (visible only to those who submitted their own) |
| **Practice result** | Shown only for candidates who shared it, labeled as a practice result |
| **Process** | Stage, last activity, assignee, next step |

- Missing data shows "Not provided" or "Not shared" in `--stone-400`.
- **Highlight differences** toggle shows which cells differ most; there is no "best candidate" highlight and no overall AI score.
- **Blind review** continues to apply at the screening stage.
- Notes and decisions: a shared discussion area under the table with `@mentions` and a **Record decision** action for the hiring manager (Advance, Hold, Reject kindly), which updates the pipeline after confirmation.

## G4. States
- **Empty:** "Pick candidates to compare." with **Add from the pipeline**.
- **Over the limit:** "You can compare up to 4 candidates" with a way to swap one.
- **Candidates in different stages:** a note that feedback may not be available for everyone.
- **Interviewer view:** the page shows only candidates assigned to the interviewer and hides colleagues' feedback until the interviewer has submitted theirs.
- **Candidate withdrew or asked for deletion:** the column shows "No longer available."

---

# Part H. Talent Search and Shortlists: `/employer/talent`

## H1. Purpose
Proactively find candidates who opted in to be discoverable, keep shortlists, and invite them to apply. It is available only to verified companies and is limited to prevent spam.

## H2. Layout
Filters on the left (280px), results in the center, selected-candidate preview as a right drawer. Tabs at the top: **Search** · **Shortlists** · **Invitations**.

## H3. Filters
Role or keywords, skills, experience range, location and remote preference, availability (immediately, 1 month, 3 months), expected salary range, work mode, languages, "Interview-ready" (candidates who chose to share a practice result at or above a chosen level; a note says candidates without a shared result are equally valid and the filter is optional), "Recently active."

**Not offered:** age, gender, religion, caste, nationality, marital status, photo-based or similar filters.

## H4. Results
Candidate cards (A5) showing only what the candidate chose to make discoverable: headline, top skills, experience level, city or region, availability, expected salary range (if shared). Names, photos, exact location, current employer and contact details are hidden by default. A **Why this match** expander lists matched criteria (`AI suggestion`). Sort: Relevance, Recently active, Experience. Actions: **Save to shortlist**, **Invite to apply** (select a job), **Hide**.

## H5. Shortlists tab
Named lists (for example, "Backend 2026") with candidate count and last updated. Inside a list: candidates, notes, status (`Not contacted`, `Invited`, `Replied`, `Applied`, `Declined`), **Invite all** (bulk invitation with a template and the daily limit).

## H6. Invitations tab
Sent invitations with status (`Sent`, `Viewed`, `Accepted`, `Declined`, `Expired`), the job, date, and **Withdraw**. Accepted invitations open a message thread and the candidate's application flow; contact details are shared only after the candidate accepts.

## H7. Outreach rules
- An invitation must reference a real, open job, with a short personal message from a template; links to external payment pages and personal contact details are blocked.
- Daily and monthly limits per plan are shown with a counter.
- Candidates can decline, block and report; blocked employers disappear from that candidate's results.
- Repeated declines or reports can reduce outreach limits or suspend the feature.
- No messaging to candidates who haven't opted in.

## H8. States
- **No results:** suggestions to broaden filters ("Remove one skill requirement").
- **Limit reached:** "You've reached today's invitation limit." with the reset time and **Manage plan**.
- **Not verified:** search results visible but invitations disabled with the banner.
- **Candidate hid their profile:** removed from lists; saved entries show "No longer available."
- **Candidate declined or blocked:** shown as `Declined`; no further invitations.
- **Viewer role:** the page is hidden.

---

# Part I. Interviews: `/employer/interviews`

## I1. Layout
Tabs: **Upcoming** · **Needs feedback** · **Past** · **Calendar**. Toolbar: search, filters (job, interviewer, round, status, date), **+ Schedule interview**. Summary strip: interviews this week, awaiting candidate confirmation, feedback overdue, average days from interview to decision.

## I2. Upcoming
Cards grouped by day: date and time (with time zone), candidate (or "Candidate #23"), job, round, format (Video, Phone, On-site), duration, interviewers (avatars), status chip (`Scheduled`, `Confirmed by candidate`, `Reschedule requested`, `Cancelled`), actions: **Join** (appears 10 minutes before; platform video), **Prepare**, **Reschedule**, **Add to calendar**. Interviewers see only their own interviews.

### Prep drawer
Candidate summary (as allowed), resume, screening answers, scorecard criteria for the round, suggested questions by role and round (`AI suggestion`, optional, avoiding illegal or inappropriate topics), previous round notes (for those who may see them), and a **Mark prepared** checkbox.

## I3. Schedule interview (modal or drawer)
1. **Candidate and job** (prefilled from the pipeline)
2. **Round and format**, duration (15, 30, 45, 60 minutes)
3. **Interviewers** (multi-select with availability from connected calendars where available; conflict warnings)
4. **Offer time slots:** pick 3–5 slots; the candidate chooses one (or use a scheduling link)
5. **Candidate message** (template, editable) and an agenda or prep note (can include the scorecard criteria so candidates know what is assessed)
6. Time zone shown for both sides (default Asia/Kolkata, configurable)
7. **Send invite** (primary)

## I4. Needs feedback
Interviews finished without a submitted scorecard, oldest first, with a reminder button. Feedback is due within 24 hours (configurable). Scorecards are hidden from colleagues until each interviewer submits their own.

## I5. Calendar
Week and month views, color-coded by job using ink shades and gold accent. Clicking an event opens details. Conflicts (double-booked interviewers) are flagged with a warning icon. Optional read-only calendar sync.

## I6. In-interview view (optional, during a video call)
Side-by-side: candidate summary, question guide, scorecard form and notes. A subtle banner: "Recording is off." Recording only if both the candidate and the company enable it and the candidate consents on the invite page.

## I7. States
- **Candidate requested reschedule:** warning chip with **Accept new time** or **Propose another**.
- **Candidate hasn't picked a slot after 48 hours:** reminder and **Resend**.
- **No-show:** mark and send a message; the candidate stays in the pipeline until the team decides.
- **Candidate declined or withdrew:** chip and pipeline update.
- **Empty:** "No interviews scheduled." with **+ Schedule interview**.
- **Interviewer view:** only assigned interviews; no ability to schedule unless granted.

---

# Part J. Offers: `/employer/offers`

## J1. Layout
Tabs: **Draft** · **Awaiting approval** · **Sent** · **Countered** · **Accepted** · **Declined, expired and withdrawn**. Table: candidate, job, role title, compensation summary (hidden from roles without offer permissions), start date, status, expiry date, owner, last activity. Summary strip: offers out, awaiting approval, expiring in 7 days, accepted this month.

Roles: Owner and Admin see all offers; Recruiters and Hiring managers see offers for their jobs; Interviewers and Viewers don't see this page.

## J2. Create offer (drawer or full page)
Opened from a candidate in the Offer stage, the pipeline, or **+ New offer**.
- Candidate and job (prefilled)
- Job title, level, department, reporting manager, location and work mode
- Compensation: base pay, variable, equity (type, amount, vesting schedule, cliff), joining bonus, benefits
- Start date, probation period, notice terms
- Offer expiry date (at least 2 days ahead)
- Attachments: offer letter generated from an editable template (PDF), other documents
- **Approval chain:** approvers required by the company's rule (for example, anything above a threshold needs the Owner or Admin); the creator can't be the only approver
- Notes for the team (not sent)
- A **compliance note:** "Review the offer letter and contract terms with legal counsel before sending. Templates are samples, not legal advice."

## J3. Offer actions
- **Send offer** (re-authentication; the candidate receives an email and in-app notice with **Accept**, **Decline**, **Ask a question**, **Request changes**).
- **Revise** (creates a new version; previous versions kept in history).
- **Withdraw** (reason required; the candidate is notified politely).
- **Mark accepted** (manual, if the candidate accepted outside the platform).
- **On acceptance:** the candidate moves to **Hired**; prompts **Add to onboarding** (Hires and Onboarding page) and, for startups on the platform, **Add to team** (sends a team invite with a role); updates headcount and budget; closes the job when all openings are filled.

## J4. States
- **Empty:** "No offers yet. Offers you create from the pipeline will appear here."
- **Expiring in 48 hours:** warning chip and a reminder to follow up.
- **Countered by the candidate:** gold-tint banner with **Review request**.
- **Declined:** reason captured if the candidate shares one; option to move the next candidate in the pipeline forward.
- **Awaiting approval too long (over 2 days):** reminder to approvers.
- **Withdrawn:** read-only with the reason.
- **No permission:** actions hidden for roles that can't send offers.

---

# Part K. Offer Detail: `/employer/offers/:offerId`

## K1. Header
Candidate (or "Candidate #23" until the offer stage if blind review applies; after an offer, names are visible), job, offer amount summary (for permitted roles), status chip, version chip ("v2"), expiry date. Actions by state:
- Draft: **Edit**, **Submit for approval**, **Send offer**, **Delete draft**
- Awaiting approval: **Approve**, **Request changes**, **Reject** (approvers only)
- Sent or viewed: **Revise (new version)**, **Withdraw**, **Message**, **Extend expiry**
- Countered: **Review request**, **Accept changes**, **Make new version**, **Keep current terms**
- Accepted: **Add to onboarding**, **Download signed documents**
- Declined, expired or withdrawn: **Duplicate as new offer**, **Export summary (PDF)**

Tabs: **Terms** · **Approvals** · **Negotiation** · **Documents** · **History**. A note under the header: "Offers are proposals. Binding terms are in the signed employment agreement."

## K2. Terms tab
Grouped term rows: **Compensation** (base, variable, joining bonus, equity with vesting and cliff, benefits), **Role** (title, level, department, manager, location, mode, employment type), **Dates** (start date, probation, notice, offer expiry), **Conditions** (background checks, references, documents required). Each row shows the current value, the previous version value when changed (in `--gold-tint`), and a short plain-language definition tooltip. Equity rows carry a caution note.

## K3. Approvals tab
- Approval chain: required approvers, status (`Pending`, `Approved`, `Changes requested`, `Rejected`), date and comment.
- Thresholds set by the company. An approval is bound to a specific version; a changed version restarts it.
- Separation of duties: the creator can't be the only approver. **Request approval** and reminders.

## K4. Negotiation tab
- Thread with the candidate tied to this offer, grouped by version; system events inline ("You sent v1", "Candidate asked about vesting", "You sent v2").
- **Change request review:** when the candidate requests changes, a clear diff of their asks against the current terms with their reasons; **Accept**, **Counter** (new version) or **Keep terms** with a short note.
- **Internal discussion** (private to the company, never shown to the candidate).
- **Schedule a call** opens a meeting request.

## K5. Documents tab
- **Offer letter** (current version, PDF) with signature status per party.
- **Related documents:** employment agreement draft, policies, equity plan summary, onboarding forms. Status (`Not started`, `Drafting`, `In review`, `Signed`) and who is responsible.
- Upload and share documents (view and comment; signing through the signing method both sides choose, or an integrated e-signature tool).
- Version history for each document. Reminder: "Have your lawyer review these documents."
- Sensitive documents (ID numbers, bank details) are collected only after acceptance and through the platform's document tools, not through chat.

## K6. History tab
Audit-style timeline: created, edited, approved, sent, viewed by the candidate (if read receipts are enabled), questions, change requests, revisions, accepted, declined, withdrawn, extended, documents uploaded and signed. Each with user and time. **Export history (PDF)** for the company's records.

## K7. Actions and confirmations

| Action | Behavior |
|---|---|
| **Send offer** | Re-authentication; confirmation text about non-binding status; sends version 1 |
| **Edit after sending** | Creates a new version; the candidate is notified; earlier versions stay in history |
| **Withdraw** | Reason required (Position changed, Budget, Candidate unavailable, Other); optional polite message; the candidate is notified |
| **Extend expiry** | New date later than the current one; the candidate is notified |
| **Accept changes or counter** | New version created; approvers re-approve if thresholds apply |
| **After acceptance** | Candidate moves to Hired; prompts onboarding and (for startups on the platform) team invite |

## K8. States
- **Draft with missing fields:** inline checklist at the top ("Add an expiry date").
- **Candidate viewed:** `Viewed` chip with the date only if the candidate's settings and the company's read receipts allow it; no "read" pressure messages.
- **Candidate silent for 7 days:** gentle prompt to follow up by message or call.
- **Candidate accepted another offer (if they say so):** banner and **Close offer**.
- **Offer expired:** chip and **Revive as new version**.
- **Flagged by Trust and Safety (for example, asks for a fee):** the offer is blocked from sending, with the reason and **Appeal**.
- **Job closed or filled while an offer is open:** warning that other openings may remain.
- **No permission:** read-only or hidden for roles without offer rights.

---

# Part L. Notifications for hiring

| Event | Who is notified | Channel |
|---|---|---|
| New applicant | Recruiter, hiring manager | In-app, daily digest email |
| Applicant waiting over 3 days | Recruiter, hiring manager | In-app |
| Applicant waiting over 14 days | Recruiter, hiring manager, Owner | In-app, email |
| Interview scheduled, confirmed, changed or cancelled | Interviewers, candidate | Email, in-app |
| Candidate requested a different time | Recruiter | In-app, email |
| Feedback overdue (24 hours) | Interviewer | In-app, email |
| Offer approval requested, approved or rejected | Approvers, creator | In-app, email |
| Offer sent, viewed (if enabled), countered, accepted, declined, expired | Hiring manager, Owners | In-app, email |
| Offer expiring in 48 hours | Offer owner | In-app, email |
| Hiring request approved or declined | Requester | In-app, email |
| Candidate accepted an invitation or declined | Inviter | In-app |
| Job reported, flagged or paused | Owners, Admins, job owner | In-app, email |
| Candidate requested data deletion | Owners, Admins | In-app, email |

Users can mute or set digests in Settings. Security and policy alerts cannot be muted. Notification text never includes salary figures or candidate personal details in email subjects.

---

# Part M. Data and validation

| Field | Rule |
|---|---|
| Job title | Required, 3–80 characters |
| Description | Required, 200–8,000 characters; contact details and external payment links blocked |
| Salary | Minimum less than maximum; currency required if shown |
| Screening questions | Up to 8, each up to 300 characters; protected-characteristic questions blocked |
| Interview slots | In the future; no overlaps for the same interviewer |
| Offer | Base pay, start date and expiry required; expiry at least 2 days ahead; approvals complete before sending |
| Candidate message | Up to 5,000 characters; no fee requests or off-platform payment links |
| Resume files | PDF or DOCX, up to 10 MB, virus scanned |
| Bulk messages | Up to 50 candidates per action; daily outreach and invitation limits per plan |
| Compare | Up to 4 candidates |
| Exports | Owner and Admin (and Recruiter where the company allows), with re-authentication; include only fields visible to the exporter |
| Retention | Applicant data kept for a configurable period (default 12 months after the job closes), then deleted or anonymized unless the candidate opted into a talent pool |

**Audit log:** job creation and edits, publishing, stage moves, scorecards, notes, messages, exports, offers and approvals, invitations, role changes and deletions, each with user and time (visible in `/employer/activity`).

---

# Part N. Data connections

| Feature | Connected to |
|---|---|
| Company verification and badge | Admin console, Employer Application and Verification (`/employer/verification`) |
| Job posts on the marketplace | Jobs module, candidate Job Search and Job Detail (`/jobseeker/jobs`) |
| Applications and the candidate's view | Candidate's Apply, Application Tracker and Offers (`/jobseeker/...`) |
| Candidate resumes | AI resume maker (immutable snapshots of submitted resumes) |
| Shared practice results | AI interview trainer (consent-gated) |
| Interviews and video | Calendar, managed video API |
| Messages | ERP chat service, Messages (`/employer/messages`) |
| Templates and scorecards | Templates and Scorecards (`/employer/templates`) |
| Hires and onboarding | Hires and Onboarding (`/employer/hires`); for startups, Team (`/startup/team`) |
| Analytics | Hiring Analytics (`/employer/analytics`) |
| Billing and entitlements | Billing and Plan (`/employer/billing`) |
| Trust and Safety | Trust and Safety (`/employer/trust`), moderation queue |
| Notifications | ERP notification service |
| Role and permissions | Identity and access (role-based and team-role-based, set up by the project owner) |

---

# Part O. CSS tokens

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

# Part P. Build order (suggested)

1. Role guard, company and team-role checks, verification gate and the employer shell (Part A9).
2. Shared components: status chips, applicant stages, candidate card, consent badge, AI label, scorecard.
3. **Job Editor** and the public job post preview (with the blocked-question and fee checks), then **Hiring Overview**.
4. **Job Detail and Applicant Pipeline** and **Candidate Profile** (the core of the module), including blind review enforced on the server.
5. **Interviews** (scheduling, scorecards with secrecy until submitted, feedback reminders).
6. Rejection flow with kind templates and the 14-day reminders.
7. **Offers** and **Offer Detail**, with approvals, versions and the hire handoff.
8. **New Hiring Request** and approvals.
9. **Compare Candidates**.
10. **Talent Search and Shortlists** with outreach limits.
11. Notifications, bulk actions, exports with re-authentication.
12. Empty, loading and error states, then mobile layouts.

**Suggested first release:** items 1–6 and basic scheduling. Add offers, hiring requests and approvals next, and talent search and compare after the first few hires have gone through the platform. Your proposal recommends recruiting a small set of anchor employers early, so employer verification and the job editor must ship before candidates are invited in.

**Reminder for the build:** every route above is employer-only and role-based, and what each person can do depends on their team role. Add the guard first, enforce the verification gate, filter candidate data on the server by company, team role and consent, enforce blind review and scorecard secrecy on the server, block discriminatory questions and fee requests, keep AI suggestions explained and non-binding, require re-authentication for offers and exports, and write every stage move, score, offer and export to the audit log. Get legal advice on hiring and anti-discrimination law, data retention, offers and employment-agreement handling, and candidate privacy before launch.
