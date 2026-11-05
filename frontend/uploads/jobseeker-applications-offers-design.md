# Job Seeker: Applications and Offers Pages Design

The pages where a job seeker follows every application from "applied" to "hired," keeps track of interviews, and handles offers. They are the job seeker side of your proposal's Jobs module: the application tracker with status alerts, and the employer's pipeline of applied, shortlisted, interview, offer and hired. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Job seeker role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user is acting in the `job seeker` role. Applications, interviews and offers are private: the server must return only the signed-in candidate's own records. Details are in **Part A9**. Do not show these pages to startups, mentors, investors or employers.

> **Reminder: offers and legal limits.**
> The platform records offers and moves information between the candidate and the employer. It does not set the terms, give legal, tax or career advice, or guarantee that an offer becomes an employment contract. Offers shown here are the employer's proposal. The binding terms are in the signed employment agreement. Get legal advice if you need it before accepting.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Application Tracker | `/jobseeker/applications` | Every application in one place: applied, shortlisted, interview, offer, hired, with status alerts |
| 2 | Application Detail | `/jobseeker/applications/:applicationId` | Timeline, what was shared, messages, interview details, next steps, withdraw |
| 3 | Interviews | `/jobseeker/interviews` | Scheduled employer interviews: accept or propose times, prepare, join, follow up |
| 4 | Offers | `/jobseeker/offers` | Offers received: review, compare, ask questions, request changes, accept or decline |

Related pages: the employer side is in `startup-hiring-design.md` (Job Detail and Applicant Pipeline, Candidate Profile, Interviews, Offers). The pages here show the same records from the candidate's point of view, with the employer's internal notes and scores hidden. The job seeker home and job search pages are in `jobseeker-dashboard-design.md` and `jobseeker-find-apply-design.md`.

---

# Part A. Shared foundations

## A1. Design principles

- **Clarity and calm:** job hunting is stressful. Every page tells the candidate where things stand and what, if anything, they need to do next. No blame language, no pressure.
- **Respect for the candidate's time:** employers are expected to respond. The page gently shows how long an application has been quiet and offers a polite follow-up, never a complaint.
- **Honest about what's visible:** the candidate sees what the employer chose to share. The page never guesses internal decisions, scores or reasons that weren't shared.
- **Decisions are the candidate's:** accepting, declining, negotiating and withdrawing are deliberate steps with clear confirmations.
- **AI is labeled and optional:** AI helps with preparation and drafting, never decides outcomes, and always shows its reasons.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Current stage, highlights, changed terms, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | AI suggestion chips, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Offer, accepted, hired |
| `--warning` | `#B7791F` | Needs action, expiring |
| `--error` | `#B42318` | Not selected, declined, errors |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Salary uses the user's currency setting (₹ with Indian grouping by default, for example ₹10.5 LPA), always with the period.

## A4. Shared layout

Desktop (≥ 1200px): the job seeker sidebar and top bar from the dashboard, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar (Home, Jobs, Applications, Practice, More), tables become cards, sticky bottom action button.

## A5. Shared components

### Application stage and status chips
Stages follow the employer's pipeline: `Applied` (stone), `Shortlisted` (gold-tint), `Interview` (ink outline), `Offer` (success tint), `Hired` (ink fill). Exits: `Not selected` (error tint, polite wording), `Withdrawn` (stone outline), `Job closed` (stone outline). Draft: `Draft` (stone outline, not yet submitted).

### Application card
Employer logo (48px), job title, company name with **Verified employer** pill (gold-tint with check), location and work mode, applied date, stage chip, last update ("Shortlisted · 2 days ago"), next step ("Interview on Thu 11:00 AM"), and actions: **Open**, **Message**, overflow (Withdraw, Practice for this job, View job). A small "Waiting" chip appears after 14 days without an update.

### Stage timeline
A horizontal (desktop) or vertical (mobile) stepper: Applied → Shortlisted → Interview → Offer → Hired. Completed steps are ink with a check, the current step has a gold ring and `--gold-tint` background, upcoming steps are stone-200. Each step shows the date reached. If the employer's process has more rounds (for example, Technical, Founder chat), they appear as sub-steps under Interview.

### Interview card
Date and time (time zone shown, default Asia/Kolkata), employer and role, interview type (Phone, Video, On-site, Technical, HR, Case, Founder chat), duration, interviewers' names and roles (as the employer shares them), format and location or link, status chip (`Proposed times`, `Scheduled`, `Confirmed`, `Reschedule requested`, `Completed`, `Cancelled`), and actions: **Join**, **Prepare**, **Reschedule**, **Add to calendar**.

### Offer card
Employer logo, job title, company, **Offer** chip with version, headline numbers (base pay, bonus, equity if offered), start date, expiry date with a warning chip within 7 days, status chip, and **Open offer**.

### Offer status chips
`Received` (gold-tint), `Under review by you` (ink outline), `Question sent` (stone outline), `Changes requested` (warning tint), `Revised` (gold-tint), `Accepted` (success tint), `Declined` (stone), `Expired` (stone outline), `Withdrawn by employer` (error outline).

### AI suggestion label
A small `AI suggestion` pill (gold-tint with a sparkle icon) with a "Why?" link. Used for preparation tips, follow-up drafts and offer-comparison hints. Suggestions use only the candidate's own information and the employer's shared information.

### Platform notes
Small captions where relevant: "You see what the employer has chosen to share." and "Offers are proposals. Binding terms are in your employment agreement."

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for notes and drafts, "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Offline | Cached records with a banner "You're offline. Some information may be out of date."; sending, accepting and withdrawing are disabled until reconnected |
| Account paused or suspended | Read-only pages with a banner and **Contact support**; actions disabled |
| Email not verified | Banner "Verify your email to receive updates from employers." with **Resend email** |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms; the stage timeline animates once. Money values never animate as counters. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status and stage always use text and icon, not color alone.
- The timeline is a labeled ordered list with `aria-current="step"`; all lists, tables and calendars are keyboard operable.
- Interview times always state the time zone in text; live regions announce new status changes.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Privacy, fairness and conduct rules

- **The candidate sees only what is shared:** employer scorecards, internal notes, rankings, rejection discussions and other candidates' information are never shown. A rejection reason chip and polite message appear only if the employer chose to send them.
- **Shared data is visible:** the candidate can always see exactly what was shared with each employer (resume version, answers, contact details, readiness score if shared) on the Application Detail page.
- **Withdrawing is the candidate's right:** withdrawal removes the application from the employer's active pipeline and stops further sharing, subject to the employer's retention rules. The candidate can ask for their data to be deleted.
- **No ghosting by design:** employers see reminders for applicants waiting over 14 days. Candidates can send one polite follow-up per application after 14 days.
- **No discrimination:** the platform doesn't use personal characteristics to rank candidates. Questions about protected characteristics in screening or interviews should be reported with **Report a concern**.
- **Fraud protection:** employers are verified. Offers that ask for fees, deposits, equipment payments or off-platform bank details are flagged. The Offers page reminds candidates never to pay to start a job.
- **Practice results:** shared with an employer only if the candidate consented at application time or later; the candidate can revoke consent for results not yet viewed.
- **Data handling:** candidate data is encrypted in transit and at rest and follows the platform's privacy policy and applicable law (for example, India's DPDP Act). Interview recordings are private by default and deletable on request. Candidate data isn't used to train third-party models.
- **Legal:** the platform doesn't give legal, tax, immigration or career advice. Accepting an offer creates obligations only when the candidate and the employer sign the employment agreement.

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `job seeker` role can open `/jobseeker/...` routes |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, investor and employer users see a 403 page ("This page is for job seekers") with a link to their own home; no candidate data is fetched or rendered |
| **Multi-role users** | A founder, mentor or investor who is also a job seeker switches roles via the role switcher. Candidate records never mix with employer records in one view |
| **Own data only** | Applications, interviews, offers, messages and notes are returned only for the signed-in user; the server filters by user ID, never trusting an ID in the URL. Any other `:applicationId` or `:offerId` shows 404 |
| **Employer data filtering** | The server returns only the fields the employer made visible to candidates (stage, interview details, offer terms, messages). Internal scorecards, notes, ratings and other candidates' data are never returned |
| **Sensitive actions** | Accepting or declining an offer, withdrawing an application, changing contact details and deleting data require confirmation; accepting an offer also requires re-authentication |
| **Consent** | Sharing practice results or extra documents with an employer is checked against the candidate's recorded consent on the server |
| **Closed records** | Applications to jobs that were deleted by the employer remain visible to the candidate in a read-only form with whatever the candidate already received |
| **Admin view** | Admins can view these pages read-only for support or disputes, with an "Admin view" banner; access is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Application Tracker: `/jobseeker/applications`

## B1. Purpose
One place to see every application: where it stands, what changed, and what to do next. It is the candidate's view of the employer's pipeline.

## B2. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Applications"       [Browse jobs]      │
│          ├────────────────────────────────────────────────┤
│          │  Summary strip (stage counts)                  │
│          ├────────────────────────────────────────────────┤
│          │  Tabs: Board · List · Needs action             │
│          ├────────────────────────────────────────────────┤
│          │  Toolbar: search · filters · sort              │
│          ├───────────────────────────────┬────────────────┤
│          │  Applications (8–9 col)       │ Side (3–4 col) │
│          │                               │ Next steps     │
│          │                               │ Insights       │
└──────────┴───────────────────────────────┴────────────────┘
```

## B3. Summary strip
A strip of stage counts that also works as filters: **Active (7)** · **Applied (3)** · **Shortlisted (2)** · **Interview (1)** · **Offer (1)** · **Hired (0)** · **Not selected (4)** · **Withdrawn (1)**. Clicking a count filters the list.

## B4. Tabs

### Board (default on desktop)
Columns: **Applied**, **Shortlisted**, **Interview**, **Offer**, **Hired**, with a collapsible **Closed** column for Not selected, Withdrawn and Job closed. Cards use the application card (A5). Cards are not draggable, because stages come from the employer; the board is a read-only view. The column header shows the count.

### List
Table: employer and job, applied date, stage chip, last update, next step, source (Job search, Startups hiring, Recommendation, Invited), resume version used, actions. Sort by last update, applied date, company or stage. Bulk actions: **Withdraw** (with a confirmation), **Export my applications (CSV)**.

### Needs action
Items waiting for the candidate: choose interview times, confirm an interview, answer an employer question, respond to an offer, upload a requested document, review and sign (if the employer sends documents), follow up (applications quiet for 14+ days). Each row has a clear button (**Choose a time**, **Reply**, **Review offer**, **Upload**, **Follow up**).

## B5. Toolbar
Search by job, company or recruiter. Filters: stage, company stage (startup stage), work mode, location, applied date range, source, resume used, "Updated this week." Sort: Last update (default), Applied date, Company name, Next step date.

## B6. Side column
- **Next steps:** up to 4 prioritized actions (an interview tomorrow, an offer expiring, an employer question), each with a button.
- **Pipeline snapshot:** a small funnel (Applied → Shortlisted → Interview → Offer) with the candidate's own counts, and a plain line such as "2 of 8 applications moved to interviews." No comparison with other candidates, and no success prediction.
- **Insights** (labeled `AI suggestion`, optional, off if the user turns it off): neutral observations such as "Applications with a tailored resume got shortlisted more often for you." Based only on the candidate's own history, with sample sizes shown, and with a **Why?** link.
- **Quick actions:** **Browse jobs**, **Build a resume**, **Start a practice interview**.
- **Tips:** short, dismissible guidance for waiting periods ("Most employers reply within 2 weeks").

## B7. Status alerts
Status changes trigger in-app and optional email or push alerts: "Your application to {Role} at {Company} moved to Shortlisted." Alerts link to the Application Detail page. Alerts never include internal employer comments. A daily digest option appears in Settings. Rejection alerts are gentle and include similar jobs.

## B8. States
- **Empty:** "You haven't applied yet." with **Browse jobs** and **Get recommendations**.
- **Filter has no results:** "No applications match." with **Clear filters**.
- **Quiet application (14+ days):** gentle `Waiting` chip and **Send a polite follow-up**.
- **Job closed:** `Job closed` chip; the application stays in its last stage with a note: "The job is no longer open. Your application remains on file with {Company}."
- **Not selected:** `Not selected` chip with the employer's polite message (if sent) and **Similar jobs**; collapsed into Closed after 7 days.
- **Draft applications:** shown at the top as `Draft` cards with **Continue**; deleted after 30 days without activity (with a warning at day 25).
- **Duplicate or blocked:** applications to employers that later blocked the candidate show a neutral `Closed` status.
- **Loading error:** inline **Retry**.

---

# Part C. Application Detail: `/jobseeker/applications/:applicationId`

## C1. Purpose
Everything about one application: the job, the timeline, what the candidate shared, messages with the employer, interviews, and the next steps.

## C2. Layout
Header with the job and company, the stage timeline, then tabs. Left main column (8 col), right panel (4 col) on desktop.

### Header
Employer logo, job title, company name with **Verified employer** pill, location and work mode, stage chip, applied date and "Last update {date}". Actions: **View job**, **Message**, overflow (**Withdraw application**, **Practice for this job**, **Report a concern**, **Download summary (PDF)**).

### Stage timeline
The timeline (A5) with dates and, where the employer shared them, short notes ("Phone screening scheduled"). A line under it states plainly what happens next: "Next: Technical interview on Thu, 6 Nov, 11:00 AM IST."

## C3. Tabs

### Overview
- **Status summary:** current stage, what it means in plain words, and typical timing if the employer provided it.
- **Next steps for you:** actions with buttons (choose times, upload a document, answer a question).
- **What to expect:** the employer's hiring process stages and interview formats.
- **Key dates:** applied, shortlisted, interviews, offer expiry.
- **Contacts:** the hiring contact's name and role, as shared by the employer; contact details only after the employer chooses to share them.

### What I shared
A read-only record of what was sent:
- Resume (name, version, link to view the exact file as sent)
- Contact details
- Answers to screening questions
- Cover note
- Links
- Readiness score or practice results, only if shared, with the date and a **Revoke if not yet viewed** option (shown when the employer hasn't viewed them)
- Consent record (date and wording agreed)

### Messages
Secure thread with the employer (their recruiter or hiring manager). Candidates can reply, attach files (PDF, DOCX, up to 10 MB), and use templates ("Thank you and confirming my availability", "Asking about next steps", "Polite follow-up"). Messages are shared in the platform inbox at `/jobseeker/messages`. System events appear inline ("Shortlisted", "Interview scheduled"). Off-platform contact requests, payment requests and requests for sensitive documents unrelated to the job are flagged to the candidate with a warning and **Report**.

### Interviews
Interview cards (A5) for this application, with past and upcoming rounds, notes the employer shared (for example, agenda), and the candidate's **private notes** (see below).

### My notes
Private notes about this application (never shown to the employer), with tags and reminders ("Follow up on Fri"). Autosave; "Private to you."

### Offer
Appears when the employer sends an offer: a summary card linking to the full offer on the Offers page.

### Activity
A timeline of events: submitted, viewed by employer (if the employer enabled read receipts; otherwise not shown), stage changes, messages, interview changes, consent changes. Each entry has a date and time.

## C4. Right panel
- **Next step card:** the single most important next action with a button.
- **Prepare:** **Practice for this job** (builds a session from the posting), **Tailor my resume** (new resume version for similar roles; the submitted resume isn't changed), company and role notes, and `AI suggestion` prep tips with reasons.
- **Application facts:** reference ID, source, resume version, submitted date.
- **Employer response time:** the employer's typical response time (aggregated, shown only with enough data), and a neutral line if none.
- **Help:** **Report a concern**, **Safety tips**.

## C5. Withdraw application (modal)
- Plain explanation: "Withdrawing removes you from {Company}'s active hiring pipeline. You can apply again only if the employer allows it."
- Reason (optional, private to the platform unless the candidate chooses to share): Accepted another offer, Role isn't right, Salary, Location or mode, Company, Timing, Other.
- Optional short message to the employer (a polite template is offered).
- **Confirm withdrawal** (destructive) and **Keep application**.
- After withdrawal: status `Withdrawn`; shared data follows the employer's retention rules; a link to **Request deletion of my data from this employer**.

## C6. Follow-up (modal)
Available after 14 days with no update, once per application:
- A short polite message with an `AI suggestion` draft that the candidate edits; no pressure tactics.
- **Send follow-up** (primary). The employer is notified and the status shows "Follow-up sent on {date}."

## C7. States
- **Draft:** page shows the draft with **Continue application**.
- **Applied, no response yet:** neutral text "Your application has been received. {Company} usually replies within {X} days." or no estimate if unknown.
- **Shortlisted:** "{Company} is interested in learning more." with next steps if the employer provided them.
- **Interview scheduled or proposed:** timeline highlight and the interview card with **Choose a time** or **Confirm**.
- **Offer received:** gold-tint banner "You have an offer." with **Review offer**.
- **Hired:** celebratory but calm banner "You're hired at {Company}." with next steps (employer onboarding messages, **Update my profile**, **Archive other applications** suggestion with a one-click option to withdraw remaining active applications, never automatic).
- **Not selected:** polite message (if sent), **Similar jobs**, **Practice for similar roles**, and optional **Ask for feedback** (the employer may decline).
- **Withdrawn:** read-only record.
- **Job closed or removed by the employer:** read-only record with a neutral note.
- **Employer deleted or deactivated:** record stays with what the candidate had already received.
- **Blocked or reported:** read-only with **Contact support**.
- **Loading error:** inline **Retry**.

---

# Part D. Interviews: `/jobseeker/interviews`

## D1. Purpose
Manage every interview in one place: choose or confirm times, prepare, join and follow up. It is the candidate side of the employer's Interviews page.

## D2. Layout
Tabs: **Upcoming** · **Needs action** · **Past** · **Calendar**. A summary strip: interviews this week, times to choose, prep suggested. Toolbar: search, filters (employer, type, status, date), sort (Soonest, Latest).

## D3. Upcoming
Interview cards grouped by day ("Today", "Tomorrow", "Thu 6 Nov"). The next interview within 30 minutes is highlighted with `--gold-tint` and a countdown. Actions: **Join** (appears 10 minutes before for platform video), **Prepare**, **Reschedule**, **Add to calendar**, **Open application**.

## D4. Needs action
- **Choose a time:** the employer offered time slots; the candidate picks one (shown in their time zone and the employer's), or **Propose other times** (up to 3). Confirming sends the choice; the interview becomes `Scheduled`, then `Confirmed` when the employer accepts.
- **Confirm attendance:** for scheduled interviews, a gentle reminder to confirm 24 hours before.
- **Reschedule requested by the employer:** accept the new time or propose another.
- **Documents requested:** upload an ID, portfolio or assignment, with the deadline.
Each row shows the employer, role, deadline and a primary button.

## D5. Interview detail (drawer or page)
- **Header:** employer, role, type, date and time (time zone shown), duration, status chip, **Join**.
- **Agenda and format:** what the interview covers, interviewers (names and roles the employer shared), location or video link, and any assignment brief.
- **Prepare** (see D6).
- **Logistics:** time zone converter, add to calendar (ICS), directions for on-site interviews, accessibility needs (the candidate can request adjustments, shown to the employer), and a **Request a different format** option where the employer allows.
- **Your notes (private):** free text and a template (questions to ask, key points to mention), autosaved; never shown to the employer.
- **After the interview:** a short **Reflection** form (private): how it went, questions I couldn't answer, things to follow up on. A **Send thank-you** template (optional) opens a message to the employer.
- **Recording:** off by default. Recording is possible only if both sides consent before the interview starts; the candidate can decline without any effect on the application. Recordings are private and can be deleted on request.

## D6. Preparation helpers
- **Practice for this interview:** one click builds a practice session from the job posting and the interview type (for example, technical or HR), opening the AI interview trainer. Labeled `AI suggestion`.
- **Company and role brief:** summary of the employer's mission, stage and recent updates (from their public page and job), with source links; no speculation.
- **Question ideas:** common questions for this role and type, plus questions the candidate could ask the employer.
- **Resume reminder:** the resume version used, with the key points highlighted for talking.
- **Checklist:** device and connection test, quiet place, ID if needed, documents ready. Items can be ticked.
- All AI helpers show their reasons and are optional.

## D7. Calendar
Week and month views with interviews as chips (ink), proposed time slots as hatched stone blocks, and conflicts flagged with a warning icon. **Today** button, time zone selector, and an optional read-only sync with the candidate's external calendar to avoid clashes. Dragging does not move interviews; changes go through **Reschedule** so the employer is asked properly.

## D8. During the interview (video)
A minimal join page: camera and microphone test, network check, a link to **Technical help**, and a banner "Recording is off." Candidates can join from 10 minutes before. Platform video (WebRTC) is used, and a fallback "Use phone dial-in" appears when the video service provides one.

## D9. States
- **No interviews:** "No interviews yet. Practice now so you're ready when one comes." with **Start a practice interview** and **View applications**.
- **Starting soon:** gold-tint card with **Join** focused and a countdown.
- **Employer proposed times, waiting for you:** warning chip and a reminder after 48 hours.
- **Reschedule requested:** chip and actions **Accept** or **Propose another**.
- **Cancelled by the employer:** chip with the reason if shared and **Message employer**.
- **Missed interview:** neutral record with **Message employer** to explain; no penalty is shown by the platform.
- **Time clash:** warning with the clashing items and **Propose new time**.
- **Connection problems:** reconnect hint, fallback options, and **Message employer** shortcut.
- **Offline:** cached details; joining is disabled until reconnected.

---

# Part E. Offers: `/jobseeker/offers`

## E1. Purpose
Handle job offers with care: see the full terms, compare offers, ask questions, request changes, and accept or decline. It is the candidate side of the employer's Offers page.

## E2. Layout
Header with title and a summary strip: offers open, expiring in 7 days, accepted. Tabs: **Open** · **Accepted** · **Declined and expired** · **All**. Toolbar: search, filters (employer, status, expiry), sort (Expiry, Received date, Employer). A side column with guidance.

## E3. Offer list
Offer cards (A5), grouped by status. Expiring offers appear first with a warning chip and the exact date and time with time zone. A **Compare offers** button appears when two or more open offers exist (Part F).

## E4. Offer detail: `/jobseeker/offers/:offerId`
Opens as a full page. Left main column (8 col), right panel (4 col).

### Header
Employer logo and name with **Verified employer** pill, job title, **Offer** chip and version ("v2"), status chip, expiry date, sent date. Actions by state:
- Open: **Accept offer**, **Request changes**, **Ask a question**, **Decline**
- Revised: **Review changes**, then the same actions
- Accepted: **Download offer letter**, **View onboarding**
- Declined or expired: **Archive**, **Message employer**

### Tabs
1. **Terms**
   - **Compensation:** base pay (with period and currency), variable or bonus, joining bonus, equity (type, amount, vesting schedule, cliff), benefits (insurance, leave, learning budget, remote or equipment allowances).
   - **Role:** title, level, department, reporting manager, location and work mode, employment type.
   - **Dates:** proposed start date, probation period, notice period, offer expiry.
   - **Conditions:** background checks, reference checks, documents required, anything the offer depends on.
   - Each term has a short plain-language note on hover or tap (for example, "Vesting: how equity becomes yours over time").
   - **Estimated take-home:** an optional simple calculator that estimates monthly take-home from the offered pay using standard assumptions entered by the candidate, clearly labeled "Estimate only, not tax advice."
2. **Offer letter and documents**
   - The offer letter (PDF) generated by the employer, view and download, plus related documents (policies, equity plan summary, employment agreement draft). Signing status for any document that needs a signature.
   - Caption: "The offer letter and agreement are the employer's documents. Read them, and get your own legal advice if you need it."
3. **Compare** (only when there are several versions)
   - Version comparison: v1 and v2 side by side, with changed terms in `--gold-tint`.
4. **Conversation**
   - Messages about the offer with the employer, grouped by version; system events inline ("You requested changes", "{Company} sent v2"). **Schedule a call** opens a request to the employer.
5. **My notes (private)**
   - Pros and cons, questions to ask, decision notes. Never shown to the employer.
6. **History**
   - Timeline: offer received, viewed by you, questions, changes requested, revisions, accepted or declined, with dates.

### Right panel
- **Decision helper** (optional, labeled `AI suggestion`): a neutral checklist for decisions (compensation vs expectations, growth, location, stage and risk of the company, equity details), with the candidate's own preferences from their profile shown next to the offer terms. It never recommends accepting or declining.
- **Things to check:** reminders such as "Ask how the equity is valued and what happens if you leave," "Confirm the probation terms," "Check the notice period." Short and neutral.
- **Safety strip:** "Never pay to start a job. A real employer will not ask for fees, deposits or equipment payments." with **Report this offer**.
- **Key dates:** expiry, start date, response deadline.
- **Need help?** link to support and general guidance (not legal advice).

## E5. Actions and confirmations

| Action | Behavior |
|---|---|
| **Ask a question** | Opens a message with the offer attached; the employer is notified; the offer clock doesn't change unless the employer extends it |
| **Request changes** | A structured form: choose the terms (base pay, start date, equity, remote days, other), the requested value, and a short reason (up to 500 characters). Sent to the employer as a request; the employer can revise, decline or keep the terms. The candidate can send a limited number of change requests per offer (for example, 3) to keep negotiation respectful |
| **Accept offer** | A confirmation page showing the final terms, a checkbox "I understand this is my acceptance of the offer as stated," a reminder that a signed employment agreement may still be required, and re-authentication. After accepting: status `Accepted`, the employer is notified, the application moves to `Hired` on the employer's confirmation, and next steps appear (documents to sign, onboarding tasks, start date) |
| **Decline** | Optional reason chips (Accepted another offer, Compensation, Role, Location or mode, Company, Timing, Other) and a polite message template. The reason is shared with the employer only if the candidate chooses. **Confirm decline** (destructive) |
| **Extend request** | If the offer is about to expire, the candidate can ask the employer for more time with a short message |
| **Withdraw acceptance** | Allowed only if the employer's terms and the signed documents allow it; otherwise the page directs the candidate to the employer and support |

## E6. Accepting and other applications
After accepting, a prompt suggests withdrawing remaining active applications, listing them, with **Withdraw selected** (never automatic) and **Keep them active**. The candidate's profile can be set to "Not looking" with one click.

## E7. Onboarding after acceptance (light)
A simple checklist the employer can send: sign the employment agreement, submit documents, set up accounts, welcome call. Items open in the platform's messages or document view. The platform does not store sensitive identity documents unless the employer's process and the platform's policy allow it; the page warns against sending sensitive documents by chat.

## E8. States
- **Empty:** "No offers yet. Keep practicing and applying. We'll let you know as soon as one arrives." with **View applications** and **Start a practice interview**.
- **New offer:** gold-tint banner and notification with **Review offer**; first open marks it as viewed (the employer may see "Viewed" if they enabled read receipts).
- **Offer expiring in 48 hours:** warning chip, banner and reminder.
- **Expired:** `Expired` chip; **Ask {Company} to reopen** (message template); the record remains.
- **Revised by the employer:** `Revised` chip and **Review changes** with a diff.
- **Employer withdrew the offer:** `Withdrawn by employer` chip with the reason if shared and **Similar jobs**; the candidate's notes remain.
- **Multiple offers:** **Compare offers** button; the offer clocks are shown together so the candidate can plan.
- **Suspicious offer flagged by the platform:** warning banner with reasons (for example, asks for a fee) and **Report**; Accept is disabled until support reviews.
- **Offline:** read-only; accept and decline are disabled until reconnected.
- **Accepted:** success banner, next steps card and **Download summary**.

---

# Part F. Compare Offers: `/jobseeker/offers/compare`

A small sub-view of the Offers page (opened with **Compare offers**) that shows up to 3 open offers side by side.

## F1. Layout
Sticky header with employer logos and names, then a comparison table in grouped, collapsible sections; the same labels in the same order for every offer:

| Section | Rows |
|---|---|
| **Role** | Title, level, location, work mode, employment type, start date |
| **Compensation** | Base pay, variable, joining bonus, estimated yearly total, equity (type, amount, vesting) |
| **Benefits** | Insurance, leave, learning budget, allowances |
| **Company** | Stage (for startups), size, verified status, hiring process rating isn't shown |
| **Conditions** | Probation, notice period, expiry date |
| **Your preferences** | The candidate's own preferences (salary, mode, location, growth areas) with a check or dash for each offer |

- Missing data shows "Not provided" in `--stone-400`.
- A **Highlight highest value** toggle gives a subtle gold-tint behind the leading value in numeric rows, with a caption that it isn't a recommendation.
- **Your weights (optional):** the candidate sets how much each factor matters to them (for example, pay, growth, location, stability), producing a simple weighted view labeled "Your weights, your decision." The AI doesn't choose a winner.
- Equity rows include a note that startup equity is uncertain and its value depends on future events.

## F2. Actions
Each column has **Open offer**, **Ask a question**, **Request changes**, **Accept**, and **Remove from comparison**. Export to PDF is available (private).

## F3. States
- **Only one offer:** "Compare needs at least two offers."
- **Different currencies or periods:** values are shown with their units and a note "Not converted. Check exchange rates."
- **Offers expiring at different times:** a small timeline at the top shows each expiry date.

---

# Part G. Notifications for these pages

| Event | Channel |
|---|---|
| Application received by the employer (confirmation) | Email, in-app |
| Application shortlisted, moved to interview, offer, hired, not selected | In-app, email, push |
| Employer message received | In-app, email, push |
| Interview times proposed, interview scheduled, changed or cancelled | In-app, email, push |
| Interview starts in 1 hour and in 10 minutes | In-app, push |
| Documents requested by the employer | In-app, email |
| Application quiet for 14 days (prompt to follow up, once) | In-app |
| Draft application will expire in 5 days | In-app |
| Offer received | In-app, email, push |
| Offer revised, withdrawn or expiring in 7 days and 48 hours | In-app, email |
| Change request answered by the employer | In-app, email |
| Candidate accepted or declined an offer (confirmation) | Email |
| Practice suggested for an upcoming interview | In-app |

Candidates can mute, filter or set digests in Settings. Security alerts cannot be muted. Notification text and email subjects never include salary numbers or sensitive details ("You have a new offer from {Company}" instead of the figures).

---

# Part H. Data and validation

| Field | Rule |
|---|---|
| Withdraw reason | Optional; message to the employer up to 500 characters |
| Follow-up message | Once per application, only after 14 days of no update; up to 500 characters |
| Application notes | Up to 5,000 characters; private; up to 5 tags |
| Time slot choice | Must be one of the employer's offered slots, or up to 3 proposed times in the future |
| Interview documents | PDF, DOCX, images, up to 10 MB each, virus scanned |
| Interview notes | Up to 10,000 characters; private |
| Change request | Terms chosen from the offer's fields; reason up to 500 characters; limited number per offer |
| Accept offer | Re-authentication; confirmation checkbox; blocked while an unresolved safety flag exists |
| Decline reason | Optional chips; message up to 500 characters; shared with the employer only if chosen |
| Compare offers | Up to 3 offers |
| Export | Only the candidate's own data and fields visible to them |

**Audit log:** application submissions, what was shared, consent changes, withdrawals, follow-ups, interview confirmations, offer views, change requests, acceptances and declines, each with user and time. Candidates can download their application and offer history from Settings.

---

# Part I. Data connections

| Feature | Connected to |
|---|---|
| Application records and stages | Application tracker; employer's Job Detail and Applicant Pipeline (`/startup/hiring/:jobId`) and employer pages |
| What was shared with the employer | Apply flow (`/jobseeker/jobs/:jobId/apply`), resumes (`/jobseeker/resumes`), consent settings |
| Messages | ERP chat service, Messages (`/jobseeker/messages`) |
| Interviews and scheduling | Employer Interviews (`/startup/hiring/interviews`) and employer pages, calendar, managed video API |
| Practice and preparation | AI interview trainer (`/jobseeker/practice`) |
| Offers and documents | Employer Offers (`/startup/hiring/offers`) and employer pages; document service, e-signature integration (if used) |
| Hire handoff | Employer Team directory (`/startup/team`) and onboarding tasks (for startups on the platform) |
| Notifications and digests | ERP notification service |
| Verified employer status | Admin console, employer verification |
| Reports and safety flags | Admin console, moderation queue |
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
}
```

---

# Part K. Build order (suggested)

1. Role guard and job seeker shell (Part A9), including server-side filtering of employer fields visible to candidates.
2. Shared components: application card, stage timeline, interview card, offer card and status chips.
3. **Application Tracker** (List first, then Board) and status alerts, connected to the employer's pipeline.
4. **Application Detail** (Overview, What I shared, Messages, My notes), plus withdraw and follow-up.
5. **Interviews** (Needs action and choose-a-time first, then Upcoming, Calendar and preparation helpers).
6. **Offers** and Offer Detail (Terms, documents, conversation, accept and decline with re-authentication), then request-changes flow.
7. **Compare Offers**, offer notes and the optional decision helper.
8. Notifications, digests, exports.
9. Empty, loading and error states, then mobile layouts.

**Suggested first release:** Application Tracker, Application Detail and a simple Interviews page (choose a time, confirm, join). Add Offers once employers start sending offers through the platform, since your proposal's hiring pipeline reaches offers last. The Compare view and decision helper can follow.

**Reminder for the build:** every route above is job-seeker-only and role-based. Add the guard first, filter employer data on the server so candidates never see internal scorecards or notes, require re-authentication for accepting offers, check consent before sharing practice results, flag fee requests and off-platform payment attempts, and write every application, consent and offer action to the audit log. Get legal advice on offer and employment-agreement handling, e-signature, and data retention before launch.
