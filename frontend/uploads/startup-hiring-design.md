# Hiring Pages Design: `/startup/hiring` and related pages

The startup's side of the Jobs module. A startup turns a hiring need from its stage plan into a job post, finds and screens candidates, runs interviews and makes offers, all in one workspace. It uses the same visual language as the other pages: ink, ivory, one gold accent.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Hiring Overview | `/startup/hiring` | Hiring requests, live jobs and a hiring snapshot |
| 2 | New Hiring Request | `/startup/hiring/requests/new` | Capture a hiring need (from the stage plan or ad hoc) |
| 3 | Job Editor | `/startup/hiring/jobs/new` and `/startup/hiring/jobs/:jobId/edit` | Write, preview and publish a job post |
| 4 | Job Detail and Applicant Pipeline | `/startup/hiring/:jobId` | Track applicants through the stages |
| 5 | Candidate Profile | `/startup/hiring/:jobId/applicants/:applicantId` | Review one candidate, score, decide |
| 6 | Talent Search and Shortlist | `/startup/hiring/talent` | Find candidates proactively and keep shortlists |
| 7 | Interviews | `/startup/hiring/interviews` | Schedule, run and review interviews |
| 8 | Offers | `/startup/hiring/offers` | Create, send and track offers |
| 9 | Employer Page and Verification | `/startup/hiring/employer-page` | Company page candidates see, verified-employer badge |

---

# Part A. Shared foundations

## A1. Design principles

- **Pipeline first:** the main question is "who needs my attention today?" The pipeline and next actions lead every page.
- **Fair and transparent:** structured scorecards, published criteria, AI as a helper only. Decisions are always made by people.
- **Candidate consent respected:** shared candidate data (practice scores, resume versions, contact details) shows only what the candidate has allowed, and the page says so.
- **Connected to the startup's plan:** hiring requests link to the stage plan, the budget and the team directory.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, hired status |
| `--ink-soft` | `#1C2B42` | Hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, shortlisted, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlight and selected backgrounds |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Offer accepted, verified |
| `--warning` | `#B7791F` | Needs action, expiring |
| `--error` | `#B42318` | Rejected, errors |

## A3. Typography

- **Page titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`.

## A4. Shared layout

Desktop (≥ 1200px): same sidebar and top bar as other pages. The **Hiring** nav item expands to: Overview, Talent, Interviews, Offers, Employer page. 12-column grid, 24px gutters, max content width 1280px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. On tablet the side column drops below; on mobile everything is a single column and the pipeline becomes one stage at a time with a stage switcher.

## A5. Shared components

### Hiring status chips
`Draft` (stone), `Pending approval` (warning tint), `Open` (success tint), `Paused` (stone outline), `Closed` (ink outline), `Filled` (ink fill).

### Applicant stages
`Applied` → `Shortlisted` → `Interview` → `Offer` → `Hired`, plus `Rejected` and `Withdrawn`. Stage color: neutral stone for Applied, gold for Shortlisted, ink for later stages, error text for Rejected.

### Candidate card
Avatar, name, headline (current role), match chip (for example "Skills match: Strong", text-based, shown with the reasons), applied date, source, small icons (resume, interview score, notes), and a **quick actions** menu (Shortlist, Reject, Schedule interview, Message).

### Candidate consent badge
Small lock icon with a tooltip: "Shown with the candidate's permission." Fields the candidate has not shared appear as "Not shared" in stone-400.

### AI helper label
Any AI suggestion carries an `AI suggestion` pill (gold-tint). Suggestions never auto-reject, auto-rank into a final decision or change a stage. Copy: "AI suggestions help you review. You make the decision."

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | Short prompt with one action, no filler illustrations |
| Save | Autosave drafts with "Saved · just now" |
| Error | Inline message with **Retry**; rest of the page stays usable |
| No permission | Controls hidden or disabled with tooltip: "Ask an Owner or Admin." |

## A7. Role-based access

| Role | Can do |
|---|---|
| **Owner / Admin** | All hiring actions, approve and publish jobs, send offers, manage billing |
| **Hiring manager (Member with hiring access)** | Create requests, manage assigned jobs, score, schedule interviews, request offers |
| **Interviewer (Member)** | See assigned candidates, submit scorecards; cannot see other interviewers' scores until they submit theirs |
| **Viewer** | Read-only job list and pipeline counts; no candidate personal data |
| **Mentor** | Optional read-only access to job descriptions and hiring plan for advice, no candidate data |

## A8. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Pipeline drag and drop has a keyboard alternative (**Move to…** menu); moves are announced to screen readers.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A9. Fairness and privacy rules (apply to all pages)

- Scorecards use the same criteria for every candidate in a job.
- Name, photo and personal details can be hidden in a **blind review** mode for the first screening (toggle per job).
- Rejection reasons are chosen from a list and a short polite message is sent to the candidate; no silent ghosting (a reminder appears for applicants waiting over 14 days).
- Candidate data is used only for the job they applied to, unless they opt in to talent search. Data can be deleted on request; deletion removes it from pipelines.
- Interview recordings are private by default and are never used to train external models.
- AI never scores personal attributes (age, gender, religion, caste, nationality, marital status, photo). Show a note near any filter that could be misused; these filters are not offered.

---

# Part B. Hiring Overview: `/startup/hiring`

## B1. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Hiring"   [+ Hiring request] [+ Job]   │
│          ├────────────────────────────────────────────────┤
│          │  Summary strip (5 stats)                       │
│          ├────────────────────────────────────────────────┤
│          │  Tabs: Jobs · Requests · Needs attention       │
│          ├───────────────────────────────┬────────────────┤
│          │  List / cards (8 col)         │ Side (4 col)   │
│          │                               │ • Stage plan   │
│          │                               │ • Upcoming     │
│          │                               │ • Budget       │
└──────────┴───────────────────────────────┴────────────────┘
```

## B2. Summary strip
| Stat | Example |
|---|---|
| Open jobs | 3 |
| Total applicants | 86 |
| Interviews this week | 5 |
| Offers out | 2 |
| Avg time to hire | 28 days |

## B3. Tabs

### Jobs
Cards or table rows: title, status chip, location and type (remote, hybrid, on-site; full-time, part-time, contract), posted date, applicant count with a mini stage bar (segments for Applied, Shortlisted, Interview, Offer), new applicants badge ("+6 new"), owner, overflow menu (Edit, Pause, Duplicate, Close, View public page).

Filters: status, department, owner, location. Search by title.

### Requests
Hiring requests that are not yet posted. Columns: role, department, urgency (Low, Medium, High), headcount, requested by, target start date, budget range, linked stage criterion (for example "Prototype: working MVP"), status (Draft, Pending approval, Approved, Declined). Actions: **Create job post** (for approved requests), Edit, Cancel.

### Needs attention
A to-do list generated from the pipeline:
- New applicants unreviewed for over 3 days
- Interviews awaiting feedback
- Offers expiring in 48 hours
- Candidates waiting over 14 days without an update
- Jobs without applicants after 14 days (with a tip to edit the post)

Each item links to the exact page or drawer.

## B4. Side column
- **From your stage plan:** suggested roles for the current stage (for example, at the Prototype stage: engineers, designer) with **Add request** buttons. Labeled as suggestions.
- **Upcoming interviews:** next 3 with time, candidate and interviewers. Link to the Interviews page.
- **Hiring budget:** simple bar of budget used vs planned for the period (link to Finance in the Mature toolkit, or an editable number for earlier stages).
- **Plan and fees:** job posting plan (free post count, featured listing option) with a link to billing.

## B5. States
- **Empty (no requests or jobs):** "Plan your first hire." with **+ Hiring request** and **+ Job post**; a short note about stage-based suggestions.
- **Employer not verified:** banner "Verify your startup to publish jobs and show the verified badge." with **Verify now** (links to Employer page).
- **Plan limit reached:** inline upgrade message on **+ Job**; drafts can still be saved.

---

# Part C. New Hiring Request: `/startup/hiring/requests/new`

A short form (single column, max width 720px) used to record a need before writing a job post. Can also open as a drawer from the stage toolkit's Hiring requests tool.

**Fields**
- Role title (required)
- Department
- Headcount (1–20)
- Why now: dropdown (Stage plan, Growth, Replacement, Skill gap) plus a note
- Link to stage criterion or milestone (optional)
- Urgency
- Budget range (monthly or annual, currency set in Settings)
- Employment type and work mode
- Target start date
- Key skills and must-haves (chips, up to 10)
- Hiring manager (default: me) and approvers (Owners or Admins)

**Right panel (desktop):** "What this affects": runway impact preview (for example, "Adds ₹1.2L per month · runway 9 → 8.2 months") using the finance data when available, labeled as an estimate.

**Buttons:** **Submit request** (primary; goes to approval if the user is not an Owner or Admin), **Save draft**, Cancel.

**After submit:** toast and redirect to the Requests tab; approvers are notified.

---

# Part D. Job Editor: `/startup/hiring/jobs/new` and `/:jobId/edit`

A split layout: form on the left (7 col), live preview on the right (5 col, the page candidates will see). On mobile, a **Preview** toggle replaces the split.

## D1. Steps (stepper at the top; all steps are on one scrollable page on desktop)
1. **Basics**
   - Job title, department, employment type, work mode, location (city or remote regions), number of openings.
   - Link to hiring request (auto-filled if started from one).
2. **Description**
   - Rich text with sections: About the role, What you'll do, What we're looking for, Nice to have, What we offer.
   - **Improve with AI** (labeled `AI suggestion`): suggests clearer wording and flags biased or exclusionary terms (for example, "rockstar", "young team"). Founders accept or ignore each suggestion.
   - Startup context block pulled from the profile (stage, sector, team size) that can be toggled on.
3. **Requirements**
   - Skills (must have vs nice to have), experience range, education (optional and not mandatory by default), languages.
   - Note: "Requirements that aren't essential reduce your applicant pool. Keep must-haves to 5 or fewer."
4. **Compensation**
   - Salary range (min, max, period), currency, equity range (optional), benefits tags.
   - Toggle: Show salary publicly (recommended; improves applicant quality, and some regions require it).
5. **Screening questions**
   - Up to 8 questions: short text, long text, yes/no, multiple choice, file upload. Mark required or optional.
   - Knockout questions (auto-reject on a specific answer) are not offered; answers help reviewers, they do not decide.
   - Suggested questions by role.
6. **Hiring process**
   - Pipeline stages with names and a scorecard per interview stage. Default stages: Applied, Shortlisted, Interview, Offer, Hired. Add interview rounds (Screening call, Technical, Founder chat).
   - Choose interviewers per round and enable blind review (hide name and photo at screening).
   - **Allow candidates to share interview practice scores** toggle (they decide whether to share, per the Jobs module).
7. **Publish settings**
   - Visibility: Public on the Jobs marketplace, Platform members only, or Link only.
   - Application deadline (optional), close automatically when filled.
   - Featured listing option with price shown (per-post fee or subscription from billing).
   - Auto-acknowledgement message to applicants (editable).

## D2. Actions
- **Save draft** (autosave), **Preview**, **Submit for approval** (for non-admins) or **Publish** (for Owners and Admins).
- Publish checks: verified employer status, required fields, salary-range sanity, no contact details in the description (to stop off-platform spam), duplicate-post warning.

## D3. States
- **Validation:** inline messages; the stepper marks incomplete steps with a warning icon.
- **Published:** success banner with **View public page** and **Share link**.
- **Edit published job:** changes apply on save, with a warning if a change affects existing applicants (for example, removing a required question).
- **Policy flag:** if the post triggers a content check, show the reason and how to fix; the post stays in Draft.

---

# Part E. Job Detail and Applicant Pipeline: `/startup/hiring/:jobId`

The main working page for a job.

## E1. Header
- Job title, status chip, location and type, owner, posted date, days open.
- Actions: **Edit job**, **Pause**, **Close**, **Share**, overflow (Duplicate, View public page, Export applicants, Delete draft).
- Tabs: **Pipeline** · **Applicants** · **Job post** · **Team and scorecards** · **Insights**.

## E2. Pipeline tab (default)
- **Kanban board** with columns Applied, Shortlisted, Interview, Offer, Hired. Column header shows count; Rejected and Withdrawn are in a collapsible bar at the end.
- Candidate cards as in A5. Drag to move; moving to **Interview** prompts scheduling, moving to **Rejected** requires a reason and a message choice, moving to **Offer** opens the offer drawer.
- Bulk select: move, reject with a template message, add to a talent pool.
- Toolbar: search, filters (stage, source, match, rating, new only, unrated), sort (newest, rating, match), **blind review** toggle.
- Side summary on the right: conversion at each stage, average time per stage, applicants by source.

## E3. Applicants tab
- Table view of all applicants: name (or "Candidate #23" in blind review), current role, location, experience, match chip, rating (average scorecard), stage, applied date, source, actions.
- Saved filters, CSV export (admins only, with a consent reminder).

## E4. Job post tab
Read-only preview of the live post, with **Edit** and a link to the public view.

## E5. Team and scorecards tab
- Interviewers per round with their pending feedback count.
- Scorecard builder: criteria (for example, Problem solving, Communication, Role skills, Ownership), a 1–4 scale with written anchors for each level, and required comments.
- Rule: interviewers cannot see each other's scores until they submit their own.

## E6. Insights tab
- Funnel chart (Applied → Hired), time to hire, source performance (which channel brings the best candidates), drop-off by stage, offer acceptance rate. Uses the same chart styling as the Analytics page.

## E7. States
- **No applicants yet:** "Your job is live. Share it to get applicants." with share link, a tip list ("Add a salary range", "Shorten the description") and a **Find candidates** link to Talent search.
- **Job closed or filled:** banner; the pipeline becomes read-only; remaining candidates can be moved to a talent pool with consent and a thank-you message.
- **Paused:** banner "This job is paused and hidden from search."

---

# Part F. Candidate Profile: `/startup/hiring/:jobId/applicants/:applicantId`

Opens as a full page on desktop (and from the pipeline as a right drawer for quick review, 560px).

## F1. Layout
Left main column (8 col), right sticky panel (4 col).

### Header
Avatar, name, headline, location, applied date, source, stage chip, **match** chip with reasons. Actions: **Shortlist**, **Schedule interview**, **Message**, **Reject**, overflow (Move stage, Add to talent pool, Download resume, Report profile).

### Tabs
1. **Overview**
   - Summary: key experience, skills (chips; matched ones highlighted in gold-tint), education, links (LinkedIn, portfolio, GitHub).
   - **Match explanation:** list of matched and missing requirements with plain reasons (`AI suggestion`). Never shows a single hidden score.
   - Screening answers.
2. **Resume**
   - In-page viewer for the submitted resume (resume maker version shows an "Created with Resume maker" pill and the target job). Download for admins and hiring managers.
3. **Interview practice** (only if the candidate chose to share)
   - Job-readiness score and recent practice scores (clarity, structure, relevance, confidence) with the published rubric link.
   - Consent badge. If not shared: "The candidate has not shared practice results." Practice results are never required and not used for auto-decisions.
4. **Interviews and feedback**
   - Timeline of rounds with interviewer scorecards (hidden until you submit yours), comments and a recommendation (Strong yes, Yes, No, Strong no).
5. **Notes**
   - Shared team notes with `@mentions`, private notes toggle (visible only to the author).
6. **Messages**
   - Thread with the candidate (secure in-platform chat), templates, attachments.
7. **Activity**
   - Audit log (stage moves, views, messages, downloads).

### Right panel (sticky)
- **Decision box:** current stage, average rating, interviewer recommendations count, next step.
- **Quick scorecard:** for the signed-in interviewer, ratings per criterion with comments and **Submit feedback**.
- **Compare:** add to a comparison view (up to 4 candidates side by side with the same criteria).
- **Details:** contact info (shown only if shared or after shortlisting, per candidate consent), notice period, expected pay, work authorization, preferred work mode.

## F2. Rejection flow (modal)
- Reason (required): Skills mismatch, Experience, Role filled, Compensation, Withdrawn, Other.
- Message template (editable) with a polite, specific tone; option to give brief feedback.
- Option: **Add to talent pool** (only if the candidate agreed to be considered for future roles).

## F3. States
- **Blind review on:** name, photo, links and school names hidden until the candidate reaches Interview, with a banner explaining.
- **Withdrawn candidate:** banner and read-only profile.
- **Conflict of interest:** flag button for interviewers who know the candidate; the system excludes them from that candidate's scoring.

---

# Part G. Talent Search and Shortlist: `/startup/hiring/talent`

Proactively find candidates who opted in to be discoverable.

## G1. Layout
Filters on the left (280px), results in the center, selected candidate preview as a right drawer.

## G2. Filters
Role or keywords, skills, experience range, location and remote preference, availability (immediately, 1 month, 3 months), expected salary range, work mode, languages, "Interview-ready" (candidates who chose to share a practice score of at least a chosen level), "Recently active".

Not offered: age, gender, religion, caste, nationality, marital status, photo-based filters.

## G3. Results
Candidate cards (A5) with headline, top skills, availability and a **Why this match** expander (matched criteria). Sort: Relevance, Recently active, Experience.

Actions: **Save to shortlist**, **Invite to apply** (links to a job), **Message** (limited per plan, to prevent spam), **Hide**.

## G4. Shortlists tab
- Named lists (for example, "Backend 2026", "Design candidates") with candidate count and last updated.
- Inside a list: candidates, notes, status (Not contacted, Invited, Replied, Applied), **Invite all** (bulk invite with a template and a daily limit).

## G5. Outreach rules
- Messages must reference the role; templates provided. Candidates can report or block senders.
- Contact details remain hidden until the candidate replies or applies.
- Daily and monthly outreach limits shown with a counter.

## G6. States
- **No results:** suggestions to broaden filters ("Remove one skill requirement").
- **Limit reached:** "You've reached your outreach limit for today." with the reset time.
- **Not verified:** search results visible, messaging disabled until the employer is verified.

---

# Part H. Interviews: `/startup/hiring/interviews`

## H1. Layout
Tabs: **Upcoming** · **Needs feedback** · **Past** · **Calendar**. Toolbar: search, filter by job, interviewer, round; **+ Schedule interview**.

## H2. Upcoming
Cards or rows: date and time, candidate, job, round, format (Video, Phone, On-site), interviewers, status (Scheduled, Confirmed by candidate, Reschedule requested, Cancelled). Actions: **Join** (appears 10 minutes before for video using the platform's managed video), **Reschedule**, **Cancel**, **Open candidate**.

## H3. Schedule interview (modal or drawer)
- Candidate and job (prefilled when opened from the pipeline)
- Round and format, duration (15/30/45/60 minutes)
- Interviewers (multi-select; availability shown from connected calendars when available)
- **Offer time slots:** pick 3–5 slots; the candidate chooses one (or use a scheduling link).
- Candidate message (template, editable) and an agenda or prep note (can include a link to the interview scorecard criteria so the candidate knows what is assessed).
- Time zone shown on both sides (default Asia/Kolkata, configurable).
- **Send invite** (primary).

## H4. Needs feedback
Interviews finished without a submitted scorecard; sorted by oldest first; reminder button. Feedback is due within 24 hours (configurable).

## H5. Calendar
Week and month views, color-coded by job (ink shades and gold accent). Click an event to open details. Conflicts (double-booked interviewers) are flagged with a warning icon.

## H6. In-interview view (optional, during a video call)
Side-by-side: candidate summary, question guide (suggested questions by role and round), scorecard form, and a notes area. A subtle banner: "Recording is off." Recording can be enabled only if the candidate consents on the invite page.

## H7. States
- **Candidate requested reschedule:** warning chip with **Accept new time** or **Propose another**.
- **No-show:** mark and send a message; the candidate stays in the pipeline until the team decides.
- **Empty:** "No interviews scheduled." with **+ Schedule interview**.

---

# Part I. Offers: `/startup/hiring/offers`

## I1. Layout
Tabs: **Draft** · **Awaiting approval** · **Sent** · **Accepted** · **Declined / Expired**. Table: candidate, job, role title, compensation summary, start date, status, expiry date, owner, last activity.

## I2. Create or edit offer (drawer or full page)
- Candidate and job (prefilled)
- Job title, level, department, reporting manager
- Compensation: base pay, variable, equity (percentage or number of options with the vesting schedule: for example, 4 years with a 1-year cliff, customizable), joining bonus, benefits
- Start date, probation period, notice terms
- Offer expiry date
- Attachments: offer letter (generated from an editable template, PDF), other documents
- Approval chain (Owner or Admin must approve; shown as steps)
- Notes for the team (not sent)

**Compliance note:** "Review the offer letter and contract terms with legal counsel before sending." Templates are samples, not legal advice.

## I3. Offer actions
- **Send offer** (candidate receives an email and in-app notice with **Accept**, **Decline**, **Ask a question**, **Request changes**).
- **Revise** (new version; previous versions kept in history).
- **Withdraw** (reason required, message sent).
- **Mark accepted** (manual, if accepted outside the platform).
- On acceptance: candidate stage moves to **Hired**; prompts to **Add to team** (sends a team invite with the chosen role and department), start onboarding tasks (task templates: equipment, accounts, welcome), update headcount and budget, and close the job if all openings are filled.

## I4. States
- **Expiring in 48 hours:** warning chip and reminder to follow up.
- **Declined:** reason captured if the candidate shares one; option to move the next candidate in the pipeline.
- **Negotiation:** thread with offer versions side by side showing changes.
- **Empty:** "No offers yet. Offers you create from the pipeline will appear here."

---

# Part J. Employer Page and Verification: `/startup/hiring/employer-page`

## J1. Purpose
Controls how the startup appears to candidates and completes the verified-employer step.

## J2. Sections
1. **Verification**
   - Checklist: business registration details (from the startup profile), official email domain check, website, optional proof document upload.
   - Status: Not started, Under review (usually 1–2 business days), Verified (badge shown on jobs and the employer page), Action needed (with the reason).
   - Verification is required before publishing jobs or messaging candidates.
2. **Company page editor** (with live preview)
   - Logo and cover (solid ink band by default), tagline, about us, mission, culture and values, benefits, team photos (optional), office locations or remote policy, tech stack or tools, funding stage (optional and visible by choice), stage badge, **Investment Ready** badge if earned (only when the profile visibility allows).
   - Link to the startup profile for details; employer page content can be pulled from the profile and edited separately.
3. **Hiring preferences**
   - Default screening questions, default hiring process template, default acknowledgement message, blind review default, working hours and time zone, interview scheduling defaults.
4. **Trust and safety**
   - Report history (job reports, candidate reports), rules reminder (no fees from candidates, no off-platform payments, no discrimination), and a **Contact support** link.
5. **Public preview**
   - Opens the company page exactly as candidates see it, including open jobs.

## J3. States
- **Unverified:** banner and locked publishing.
- **Verification rejected:** reason and a resubmit option.
- **Changes after verification (for example, legal name):** triggers re-verification; the badge stays until the review finishes unless fraud is suspected.

---

# Part K. Notifications for hiring

| Event | Who is notified | Channel |
|---|---|---|
| New applicant | Hiring manager | In-app, daily digest email |
| Applicant waiting over 3 days | Hiring manager | In-app |
| Interview scheduled or changed | Interviewers, candidate | Email, in-app |
| Feedback overdue | Interviewer | In-app, email |
| Offer approved, sent, accepted, declined | Hiring manager, Owners | In-app, email |
| Request approved or declined | Requester | In-app, email |
| Job reported or flagged | Owners, Admins | In-app, email |

Users can mute or set digests in Settings.

---

# Part L. Data and validation

| Field | Rule |
|---|---|
| Job title | Required, 3–80 characters |
| Description | Required, 200–8,000 characters; contact details and external payment links are blocked |
| Salary | Minimum less than maximum; currency required if shown |
| Screening questions | Up to 8; each up to 300 characters |
| Interview slots | Must be in the future; no overlaps for the same interviewer |
| Offer | Base pay, start date and expiry required; expiry at least 2 days ahead |
| Resume files | PDF/DOCX, up to 10 MB, virus scanned |
| Bulk messages | Up to 50 candidates per action, daily outreach limit per plan |

**Retention:** applicant data is kept for a configurable period (default 12 months after the job closes) and deleted or anonymized afterwards unless the candidate opted in to a talent pool. Audit logs record stage moves, views, downloads, exports and offers with user and time.

---

# Part M. Data connections

| Feature | Connected to |
|---|---|
| Hiring requests and stage-plan suggestions | Stage toolkits (Early revenue hiring requests tool) |
| Candidate resume and profile | Jobs module, AI resume maker |
| Interview practice scores | AI interview trainer (only with candidate consent) |
| Job posting fees and featured listings | ERP billing |
| New hires to team | Team directory (`/startup/team`) |
| Budget and runway impact | Finance data (Business analytics) |
| Interview video | Managed video API |
| Employer verification | Admin console |
| Notifications and messaging | ERP notification and chat services |
| Funnel metrics | Analytics (`/startup/analytics`, Journey tab) |

---

# Part N. CSS tokens

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

# Part O. Build order (suggested)

1. **Shared components:** status chips, candidate card, stage chips, consent badge, AI label.
2. **Employer Page and Verification** (needed before publishing).
3. **Hiring Overview** with Requests, and **New Hiring Request**.
4. **Job Editor** and the public job page preview.
5. **Job Detail with Pipeline** and **Candidate Profile** (the core of the module).
6. **Interviews** (scheduling, scorecards, feedback).
7. **Offers**, with the hire-to-team handoff.
8. **Talent Search and Shortlists**.
9. Insights tab, notifications, blind review, bulk actions.
10. Empty, loading and error states, then mobile layouts.

**Suggested first release:** items 1–5 and basic scheduling. Add offers, talent search and insights after the first few hires have gone through the platform.
