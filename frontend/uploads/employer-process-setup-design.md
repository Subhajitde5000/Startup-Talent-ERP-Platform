# Employer Process Setup and After-Hiring Pages Design

The pages that make hiring consistent before it starts and smooth after it ends: reusable templates and scorecards that keep every hire fair and quick to set up, and a hand-off page that carries accepted offers through to a person's first day. They support your proposal's goals of shortening time-to-hire and giving employers a hiring pipeline with ready candidates, and they connect the Jobs module to the rest of the platform (for startups on the platform, to the Team directory). It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Both pages belong to the **Employer role** only, in a company account. The project owner will add the role and permission logic, so build each page assuming the signed-in user is acting in the `employer` role and belongs to a **verified** company. What each person can do also depends on their **team role** (Owner, Admin, Recruiter, Hiring manager, Interviewer, Viewer). New-hire information is personal and sensitive: the server must filter everything by company and team role. Details are in **Part A9**. Do not show these pages to startups (who use `/startup/hiring/...` and `/startup/team`), mentors, investors or job seekers.

> **Reminder: this is not an HR system.**
> The Hires and Onboarding page covers the hand-off from offer to first day (and light check-ins afterwards). It doesn't replace payroll, contracts management, benefits administration or a full HRIS, and it doesn't give legal advice. Templates are samples that the company must review with its own advisers. Hiring and onboarding must follow applicable employment, anti-discrimination and data-protection law.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Templates and Scorecards | `/employer/templates` | Pipeline templates, scorecards, screening question banks, message templates, interview guides, job and offer templates |
| 2 | Hires and Onboarding | `/employer/hires` | Accepted offers, start dates, onboarding checklist, documents, hand-off to the team |

Related files: `employer-hiring-design.md` (Job Editor, Pipeline, Candidate Profile, Interviews, Offers) uses these templates and feeds this hand-off. The employer dashboard is in `employer-dashboard-design.md`. For startups on the platform, accepted hires continue to the Team directory (`startup-team-design.md`). The candidate's side of an accepted offer is in `jobseeker-applications-offers-design.md`.

---

# Part A. Shared foundations

## A1. Design principles

- **Set up once, use every time:** good templates make each new job a five-minute task and make every candidate get the same fair process.
- **Fair by construction:** templates carry the fairness rules with them. Banned questions are blocked everywhere, scorecards use the same criteria for every candidate, and message templates are polite and specific.
- **Safe defaults, easy edits:** the platform provides sensible, reviewed starting templates. Companies copy and adapt them, and changes are versioned.
- **A hire isn't done at "accepted":** the page keeps the new hire warm and the handover tidy, so offers don't fall through between acceptance and day one.
- **Minimal personal data:** collect only what is needed, when it is needed, through the platform's document tools, and never through chat.
- **Calm and practical:** checklists, owners and dates. No gamification, no pressure.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, completed items |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Progress fill, highlights, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | AI labels, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Done, started, approved |
| `--warning` | `#B7791F` | Due soon, waiting, needs review |
| `--error` | `#B42318` | Overdue, blocked, errors |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`. Dates show the time zone where relevant (default Asia/Kolkata).

## A4. Shared layout

Desktop (≥ 1200px): the employer sidebar and top bar from the dashboard, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar, tables become cards, sticky bottom action button.

## A5. Shared components

### Template status chips
`Draft` (stone outline), `In use` (success tint), `Needs review` (warning tint, after a policy or rubric change), `Archived` (stone), `Platform default` (gold-tint, read-only, can be copied), `Company` (ink outline), `Personal` (stone outline).

### Scope chip
`Company-wide` (everyone can use), `Team` (named team), `Personal` (only the author), shown on every template.

### Onboarding status chips
`Offer accepted` (gold-tint), `Documents pending` (warning tint), `Checks in progress` (warning outline), `Ready to start` (success tint), `Started` (ink fill), `Deferred` (stone outline), `Did not join` (error outline).

### Checklist item
Checkbox, title, owner (avatar and name), due date (relative to the start date, for example "−5 days" or "+7 days"), status (`To do`, `In progress`, `Done`, `Blocked`), a short note, and a link to the related document, task or message.

### AI suggestion label
A small `AI suggestion` pill (gold-tint with a sparkle icon) with a **Why?** link. Used for template drafting help and language checks. Suggestions are optional, explained, and never applied without a click.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave drafts, "Saved · just now"; version snapshot on publish |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner: "Verify your company to publish jobs and contact candidates." Templates can be created and edited; onboarding of candidates is disabled until there are accepted offers |
| No permission | Controls hidden or disabled with a tooltip: "Ask an Owner or Admin." |
| Company paused or suspended | Read-only pages with a banner and **Contact support** |
| Offline | Cached content with a banner; publishing and sending are disabled until reconnected |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms; progress bars animate once. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Drag-and-drop ordering (stages, criteria, checklist items) always has **Move up / Move down** buttons.
- Rich-text editors are keyboard operable; modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Fairness, privacy and conduct rules (apply to both pages)

- **Same process for every candidate:** pipeline templates and scorecards set the stages and criteria once per job; changing them after interviews begin shows a warning and is logged.
- **Blocked content everywhere:** screening questions, interview guides and message templates can't ask about or use age, gender, religion, caste, nationality, marital status, family plans, health, photos or similar characteristics. The editor blocks them with a reason and a suggested alternative. The blocklist is maintained by the platform and applies to platform defaults and company templates alike.
- **Language checks:** job and message templates are checked for biased, exclusionary or manipulative wording ("rockstar", "young team", fake urgency). Suggestions are labeled `AI suggestion`, explained and optional.
- **No fees or off-platform asks:** templates can't contain requests for payment from candidates, or personal contact details and payment links; the editor blocks them.
- **Kind and specific candidate messages:** the platform's default rejection, update and decline templates are respectful and specific. Companies are encouraged to answer every applicant within 14 days.
- **Scorecards describe the job, not the person:** criteria must relate to the role. The editor warns on vague or personal criteria (for example, "culture fit", "energy") and suggests behavioral, job-related ones.
- **Minimum personal data in onboarding:** collect only what is needed for the start of employment. Sensitive documents (ID numbers, bank details) are requested only after acceptance, only through the platform's document tools, with clear purpose and retention, and never through chat. The page shows what each document is for.
- **Consent for checks:** background, reference or education checks need the candidate's explicit consent and must follow applicable law; the page records the consent and the result status only (not the underlying details unless the company's process requires it).
- **Retention and deletion:** onboarding documents and records are kept for a company-set period and then deleted or handed to the company's HR system. Candidates who didn't join can ask for deletion.
- **Legal:** templates (offer letters, policies, checklists) are samples, not legal advice. Companies must review them with their own advisers.
- **Data handling:** encrypted in transit and at rest; follows the platform's privacy policy and applicable law (for example, India's DPDP Act).

## A9. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `employer` role, as a member of a company account, can open `/employer/...` routes |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup (without an employer account), mentor, investor and job seeker users see a 403 page ("This page is for employers") with a link to their own home; no company or candidate data is fetched or rendered |
| **Multi-role users** | The role switcher changes the sidebar and routes between `/employer/...`, `/startup/...`, `/mentor/...`, `/investor/...` and `/jobseeker/...`. Data never mixes across roles |
| **Company scope** | All data is filtered by the company the user belongs to; the server checks membership on every request |
| **Templates and Scorecards** | **Owner and Admin:** create, edit, publish and archive company-wide templates; manage the blocklist overrides request (they can't override platform blocks). **Recruiter:** create personal and team templates, use company templates, propose company-wide templates for approval. **Hiring manager:** create personal scorecards and interview guides for their jobs, use company templates. **Interviewer:** read-only access to the scorecards and guides for rounds they are assigned to. **Viewer:** no access |
| **Hires and Onboarding** | **Owner and Admin:** everything. **Recruiter:** hires for their jobs, checklist and messages, no compensation details unless granted. **Hiring manager:** hires on their team, checklist items assigned to them, compensation visible only for their own team's hires. **Interviewer and Viewer:** no access. The server enforces this |
| **Compensation and sensitive data** | Compensation, documents and check results are visible only to roles with explicit permission, and are masked for everyone else |
| **Candidate data and consent** | A new hire's data is visible to the employer only for accepted offers or where the candidate shared it; check results and documents are limited to what the process needs |
| **Sensitive actions** | Publishing a company-wide template, changing the blocklist-related settings requests, requesting sensitive documents, recording check results, exporting hire data, deleting hires' records and changing team roles require confirmation; exporting and deleting also require re-authentication |
| **Separation of duties** | Company-wide templates that touch compensation or legal text need approval from an Owner or Admin other than the author |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner; personal data and documents are masked unless a dispute or safety case allows access and is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Templates and Scorecards: `/employer/templates`

## B1. Purpose
One library for everything reusable in hiring: how a job is set up, how candidates are screened and scored, how interviews run, and what messages are sent. It keeps hiring fast and consistent, and it carries the platform's fairness rules into every job.

## B2. Layout
Header with title, a short line ("Set it up once. Use it for every hire."), and **+ New template** (primary, with a type menu). Summary strip, tabs, toolbar, then the list with a preview drawer. A side column on desktop with guidance.

### Summary strip
| Stat | Example |
|---|---|
| Templates | 24 |
| In use | 17 |
| Needs review | 2 (warning tint when above zero) |
| Last updated | 3 days ago |

### Tabs
**Job posts** · **Pipelines** · **Scorecards** · **Screening questions** · **Interview guides** · **Messages** · **Offers** · **All**.

### Toolbar
Search, filters (type, status, scope, owner, role category), sort (Recently used, Last updated, Name, Most used). View toggle (Cards or Table).

## B3. Template card or row
Name, type chip, scope chip, status chip, short description, role category (for example, Engineering, Sales), used in N jobs, last updated and by whom, version ("v3"), and actions: **Use**, **Preview**, **Edit**, overflow (**Duplicate**, **Share scope**, **Archive**, **Version history**, **Delete (if unused)**). Platform defaults show **Copy to my templates** instead of Edit.

## B4. Template types

### B4.1 Job post templates
Reusable structures for job posts: About the role, What you'll do, What we're looking for, Nice to have, What we offer, default benefits, salary display preference, hiring process text, default screening questions and default pipeline. Created from an existing job (**Save as template**) or from scratch. Platform defaults by role category are provided. **Language check** runs on save (B6).

### B4.2 Pipeline templates
Stage sets for a job: names and order of stages (Applied, Shortlisted, Interview rounds, Offer, Hired), which rounds exist (for example, Screening call, Technical, Founder chat), the scorecard for each round, default interviewers or interviewer groups, expected time per stage, auto-acknowledgement message, reply-time promise, and whether blind review applies at screening. Stages can be renamed and reordered; **Applied, Offer and Hired** are system stages and can't be removed. Reordering after a job has candidates shows a warning.

### B4.3 Scorecards
- **Scorecard builder:** criteria list (up to 8) with name, description, weight (optional; shown but not used to auto-rank), a 1–4 scale with written anchors for each level ("1 = Could not give an example; 4 = Gave a specific example with measurable outcome"), required comment on low and high scores, and an overall recommendation scale (Strong yes, Yes, No, Strong no).
- **Criteria library:** job-related criteria by role (for example, Problem solving, Communication, Role skills, Ownership, Collaboration). The editor warns on vague or personal criteria and suggests job-related alternatives (`AI suggestion` with a reason).
- **Round-specific scorecards:** a different set per round (for example, technical vs. founder chat).
- **Secrecy rule:** interviewers can't see colleagues' scores until they submit their own; this is built into every scorecard.
- **Calibration helper:** optional example answers per criterion and level, so interviewers score consistently; shown to interviewers while scoring.
- **Fairness checks:** warnings if a scorecard has criteria unrelated to the job, if weights are missing for a "must-have" skill, or if anchors are missing.

### B4.4 Screening question banks
Question sets by role category: short text, long text, yes or no, multiple choice, file upload; required or optional; maximum 8 per job. Platform defaults cover common needs (relevant experience, availability, notice period, work mode preference, a short work sample). **Blocked questions** (protected characteristics, family plans, health, photo requests, and so on) can't be saved; the editor explains why and suggests a job-related alternative ("Instead of asking about marital status, ask about availability to travel if travel is a real job requirement."). **No knockout questions** (auto-reject on an answer) are supported. Where a question is a legal necessity (for example, work authorization), it can be marked "legal requirement" and used for process only, never for ranking, with a note that the company is responsible for lawful use.

### B4.5 Interview guides
Structured guides per round: purpose, suggested time split, a list of questions mapped to scorecard criteria, follow-up prompts, "good answer" notes, and topics to avoid (shown prominently: protected characteristics, personal life, anything not job-related). Guides can be generated as a draft (`AI suggestion`) from the job post and scorecard, with reasons, and are always reviewed by a person. Interviewers see the guide in the interview prep drawer.

### B4.5a Message templates
Reusable messages, each with variables ({CandidateName}, {JobTitle}, {CompanyName}, {NextStep}, {InterviewTime}, {RecruiterName}) and a preview:
- **Application received** (auto-acknowledgement)
- **Shortlisted and next steps**
- **Interview invitation** (with time slots and agenda)
- **Interview reminder**
- **Request for more information or a work sample**
- **Polite update** ("Still reviewing, here is when you'll hear from us")
- **Kind rejection** (by reason: Skills mismatch, Experience, Role filled, Timing, Compensation; each optionally with brief, job-related feedback)
- **Offer cover note**
- **Offer follow-up** and **Offer expiring**
- **Decline acknowledgement** (candidate declined)
- **Welcome and next steps** (after acceptance)
- **Not hired, thank you and talent pool invitation** (only for candidates who agreed to a talent pool)
Platform defaults are provided and written in a respectful, specific tone. Edits are checked for tone and blocked content. A message is never sent without a person's click, and bulk sends show a count and a preview.

### B4.6 Offer templates (samples)
Offer letter structures and offer cover notes: compensation sections, equity and vesting blocks, benefits, conditions, expiry wording. Clearly labeled **"Sample. Not legal advice. Have your lawyer review it."** Company-specific legal text can be uploaded and approved by an Owner or Admin before use. Offer templates touching compensation or legal wording need approval from an Owner or Admin other than the author (A9).

## B5. Template editor
Opens as a full page (or wide drawer) with the editor on the left and a live preview or sample on the right.
- **Header:** name, type, scope, status chip, version, **Save draft**, **Publish** (company-wide templates may require approval), overflow (Version history, Duplicate, Archive).
- **Body:** type-specific editor (as above) with variables, blocks and a **Test it** panel showing the template filled with sample data.
- **Checks panel** (right or bottom): live results of the fairness and language checks, each with a short explanation and a suggested fix:
  - Blocked questions or phrases (error: can't publish)
  - Biased or exclusionary wording (warning)
  - Missing job-related anchors in scorecards (warning)
  - Contact details or payment links in text (error)
  - Overly long or unclear questions (suggestion)
- **Approval flow** (company-wide, compensation or legal templates): **Submit for approval**, approver comments, and status chips; a changed template restarts approval.
- **Version history:** each version with date, author and a plain-language change summary, with **Compare** and **Restore** (a restore creates a new version). Jobs that already use a template keep their copy; the page asks whether to update active jobs when a template changes ("Apply to open jobs? Candidates already in progress keep the old version.").

## B6. Language and fairness checks
- **Biased-term detection:** a maintained list plus AI-assisted checks, with explanations and neutral alternatives. Suggestions never change text without the author's click.
- **Reading level and clarity:** simple hints for long sentences and jargon.
- **Pay transparency prompt:** a reminder to include a salary range where it's required or recommended.
- **Accessibility prompt:** a reminder to state adjustments available in interviews and to avoid unnecessary requirements (for example, a driving licence where not needed).
- Platform checks can't be turned off for blocked content; warnings can be dismissed with a recorded reason.

## B6a. Use and usage tracking
- **Use** opens the relevant creation flow with the template applied (for example, the Job Editor with a job template, or an interview round with a scorecard).
- **Used in:** each template lists the jobs using it (with a count) and the last used date.
- **Template performance (optional, descriptive):** for scorecards and pipelines, time per stage and completion rates of scorecards on time. It describes the process, not people, and is shown to Owners, Admins and the template author.

## B7. Side column
- **Starter set:** if the company has few templates, a short guide recommending a starter set (one job template, one pipeline, one scorecard, standard messages) with **Add the starter set** (copies platform defaults).
- **Fairness quick tips:** three short reminders ("Ask every candidate the same questions", "Score against the job, not the person", "Reply to every applicant").
- **Needs review:** templates affected by recent policy or rubric changes, each with **Review**.
- **Approval queue** (Owners and Admins): templates awaiting approval with **Review**.

## B8. States
- **Empty (new company):** "Start with the starter set." with **Add the starter set** and **+ New template**.
- **No results:** "No templates match." with **Clear filters**.
- **Blocked content found:** the template can't be published, with the exact lines flagged and suggestions.
- **Needs review:** chip and banner with the reason (for example, the platform updated its blocklist or scorecard guidance).
- **Pending approval:** chip with the approver and **Remind**.
- **Archived:** read-only; **Restore** available.
- **Template in use by open jobs:** deleting is disabled; archiving keeps existing jobs unchanged.
- **Scope conflict:** if a personal template is shared company-wide, a confirmation shows who will see it.
- **Not verified:** templates work; publishing jobs from them is blocked until verification.
- **Limit reached (plan):** message with the plan upgrade link; existing templates stay usable.
- **No permission:** controls hidden or disabled as in A9.

---

# Part C. Hires and Onboarding: `/employer/hires`

## C1. Purpose
Once a candidate accepts an offer, this page carries the hire from "yes" to "first day" (and a few light check-ins after): the checklist, documents, messages to the new hire, and the hand-off to the team. For startups on the platform, it ends with adding the person to the Team directory. It reduces the common risk of offers falling through between acceptance and the start date.

## C2. Layout
Header with title and a short line ("From offer accepted to first day."). Summary strip, tabs, toolbar, then the list with a side column on desktop.

### Summary strip
| Stat | Example |
|---|---|
| Upcoming starts (30 days) | 4 |
| Documents pending | 3 (warning tint when above zero) |
| Checks in progress | 2 |
| Offer-to-start drop-off (last 12 months) | 1 of 14 did not join (descriptive) |

### Tabs
**Upcoming starts** · **Needs action** · **Started** · **Deferred or did not join** · **Templates** (links to Onboarding checklists in the Templates page).

### Toolbar
Search, filters (job, department, hiring manager, start date range, status), sort (Start date, Recently accepted, Name).

## C3. Hire list
Cards or table rows: new hire (name, role; photo only if the candidate shared one), job, department, manager, start date (with a countdown), onboarding status chip (A5), checklist progress (gold bar "6 of 10 done"), documents status ("2 of 4 received"), owner (recruiter or coordinator), last activity, and actions (**Open**, **Message**). Compensation is shown only to roles allowed to see it.

## C4. Hire detail: `/employer/hires/:hireId`
Opens as a full page on desktop with a left main column (8 col) and a right panel (4 col).

### Header
New hire name and role, status chip, start date, manager, owner, **Message**, overflow (**Change start date**, **Mark as deferred**, **Mark as did not join**, **Add note**). A short summary line ("Offer accepted on 12 Nov · starts 2 Dec").

### Tabs

#### 1. Overview
- **Timeline:** Offer accepted → Documents → Checks (if any) → Pre-boarding → First day → 30-day check-in, with the current step highlighted in gold and dates.
- **Next steps:** the next three actions with owners and due dates.
- **Offer summary:** link to Offer Detail; key terms visible to permitted roles; start date and probation.
- **Risks:** gentle flags such as "No contact from the new hire in 10 days" or "Start date in 7 days and documents are missing," with suggested actions (never accusatory).

#### 2. Checklist
Onboarding checklist from a template (default or company), grouped by timing:
- **Before day one:** welcome message sent, laptop and accounts ordered, workspace or desk arranged, manager assigned, buddy assigned, first-week plan prepared, calendar invites created, policies shared.
- **Day one:** welcome meeting, team introductions, tools access confirmed, first tasks assigned.
- **First week and first month:** goals set, 1-to-1 meetings scheduled, training completed, 30-day check-in.
Each item: owner, due date (relative to the start date), status, note, and link. Items can be assigned to team members (who get notifications and a task), reordered, added or removed, and saved as a template (**Save as company checklist**).

#### 3. Documents
- **What we need and why:** a list of required documents, each with a purpose line ("Bank details: to set up payroll"), a due date, status (`Not requested`, `Requested`, `Received`, `Verified`, `Rejected with reason`), who can see it, and retention.
- **Requesting:** **Request document** sends a request to the new hire through the platform's document tool (upload only; no sensitive documents by chat). Documents are requested only after acceptance. Allowed document sets are configured by the company and reviewed by an Owner or Admin; the platform blocks requests that look unrelated to employment.
- **Viewing:** documents open in a view-only viewer with a watermark and an audit trail; downloading needs permission. Sensitive fields (ID numbers, bank details) are masked by default and revealed only to roles with permission, with the reveal logged.
- **E-signature** (if integrated): employment agreement, policies, NDAs, with signing status. Templates are samples that the company must review with its lawyers.
- **Handing off:** **Export to HR system** (file or integration where supported, with re-authentication) and a clear note on retention after the hand-off.

#### 4. Checks (optional)
Only shown if the company uses checks:
- Types (reference, education, employment, identity, background), status (`Consent requested`, `In progress`, `Clear`, `Needs discussion`, `Not applicable`), the provider or method, and the date.
- **Consent first:** no check starts without the candidate's explicit consent, recorded with date and scope. The page states what is being checked and why.
- Results show status only (for example, "Clear") unless the company's process requires more; detailed reports stay with the provider or the HR system and are visible only to permitted roles.
- **Not used for discrimination:** a reminder that checks must be job-related, applied consistently and handled under applicable law; a flagged result goes to a conversation with the candidate (the candidate can respond) before any decision.

#### 5. Messages
Secure thread with the new hire, using the Welcome and next steps templates. System events appear inline ("Documents requested", "Start date confirmed"). Messages stay on the platform; requests for money and off-platform payment links are blocked.

#### 6. Notes and activity
Shared team notes with `@mentions`, private notes, and an audit log (checklist changes, documents requested or viewed, start date changes, messages, exports), each with user and time.

### Right panel
- **Key dates:** offer accepted, start date, probation end, next check-in.
- **People:** hiring manager, recruiter or coordinator, buddy, with **Message**.
- **Hand-off:**
  - **For startups on the platform:** **Add to team** (sends a team invite with a role and department from the offer; the new hire's startup account is created or linked), plus access to stage-plan tasks if relevant.
  - **For other companies:** **Mark as handed off to HR** with a destination note, and **Close onboarding**.
- **Candidate experience:** after the first week, **Send a short feedback survey** (optional, anonymous option) about the hiring process, with a 3-question template.
- **Help:** link to onboarding guidance and **Contact support**.

## C5. Start date, deferral and drop-out
- **Change start date:** both sides are notified; the checklist due dates shift; changes beyond the offer's flexibility ask the Owner or Admin to confirm.
- **Mark as deferred:** reason (Notice period, Visa or paperwork, Personal reasons, Company delay, Other) and the new expected date.
- **Mark as did not join:** reason (Accepted another job, Personal reasons, Company withdrew, Unresponsive, Other); prompts to reopen the job or move the next candidate forward, and a polite closing message; the record is retained per policy. A note says: "Use this record to improve the process, not to blame anyone."
- **Company withdrew after acceptance:** requires an Owner or Admin, a clear reason and an immediate polite message; the page reminds the employer that offers have legal and reputational weight, and that they should seek legal advice if an agreement was signed.

## C6. After the first day
- **First day marked:** the manager or coordinator marks **Started** on or after the start date; the hire moves to the Started tab.
- **Check-ins:** optional 7-day, 30-day, 60-day and 90-day check-in tasks for the manager with short question templates ("How is the new hire settling in?"). The notes are internal and describe onboarding, not performance reviews.
- **Close onboarding:** completes the checklist, archives documents per retention rules, and closes the loop in the hiring analytics ("time to productive start" if the company enables it).
- **Talent and referrals:** optional prompt to ask the new hire to refer others (company-set), with no incentives mandated by the platform.

## C7. States
- **Empty:** "No new hires yet. When a candidate accepts an offer, they'll appear here."
- **Offer just accepted:** gold-tint banner "{Name} accepted your offer." with **Start onboarding** (applies the default checklist).
- **Documents overdue:** warning chips on the list and on the hire page, with a gentle reminder message template.
- **Start date within 7 days with blockers:** warning banner listing what's missing.
- **New hire unresponsive for 7 days:** gentle prompt to call or message, with the suggestion not to assume bad intent.
- **Candidate requested data deletion before starting:** banner explaining what will be removed and what must be retained; the onboarding record is anonymized per policy.
- **Hire is also a user of the platform (job seeker role):** their job seeker profile and the application remain separate; the page doesn't show their job seeker data beyond the application and offer.
- **Multiple openings and multiple hires for one job:** each hire has its own record; the job closes when all openings are filled.
- **Not verified or limits reached:** onboarding works for accepted offers; creating new jobs follows the plan rules.
- **No permission:** sections masked or hidden as in A9.
- **Loading error:** inline **Retry**.

---

# Part D. Notifications for these pages

| Event | Who is notified | Channel |
|---|---|---|
| Template submitted for approval, approved or rejected | Author, approvers | In-app, email |
| Template needs review after a platform policy change | Template owner, Owners, Admins | In-app, email |
| Blocked content found when saving or publishing a template | Author | In-app (inline) |
| Offer accepted | Recruiter, hiring manager, Owners | In-app, email |
| Onboarding checklist item assigned or due soon | Owner of the item | In-app, email |
| Documents received or overdue | Coordinator, recruiter | In-app |
| Candidate consent for a check received | Coordinator | In-app |
| Start date changed or hire deferred | Manager, recruiter, new hire | In-app, email |
| Start date within 7 days with blockers | Coordinator, manager | In-app, email |
| New hire marked Started | Recruiter, hiring manager | In-app |
| 30-day check-in due | Manager | In-app |
| Hire marked did not join | Recruiter, Owners | In-app |
| Hire data deletion request | Owners, Admins | In-app, email |

Users can mute or set digests in Settings. Security and policy alerts cannot be muted. Notification text never includes compensation or document contents.

---

# Part E. Data and validation

| Field | Rule |
|---|---|
| Template name | Required, 3–60 characters, unique per scope |
| Scorecard | 3–8 criteria, each with written anchors for each level; required comments on low and high scores |
| Screening questions per job | Up to 8; each up to 300 characters; protected-characteristic questions blocked |
| Message template | Up to 3,000 characters; variables from the allowed list; no payment links or personal contact details; tone and content checks |
| Pipeline template | System stages (Applied, Offer, Hired) can't be removed; at most 8 interview rounds |
| Company-wide publish | Compensation or legal templates need approval from an Owner or Admin other than the author |
| Template versions | Kept for 24 months; jobs keep the version they started with |
| Onboarding checklist | Up to 60 items; each with an owner and a relative due date |
| Document requests | Only from the company's approved list; purpose line required; due date in the future |
| Check consent | Explicit, recorded with date and scope before any check begins |
| Start date | In the future when set; changes notify both sides |
| Messages | Up to 5,000 characters; attachments up to 10 MB, virus scanned |
| Exports | Owner and Admin (and Recruiter where granted), with re-authentication; fields masked by role |
| Retention | Onboarding documents and hire records kept for a company-set period (default 12 months after the start date or non-join), then deleted or handed to the company's HR system |

**Audit log:** template creation, edits, approvals, publishing and archiving; checklist changes; document requests, views, downloads and reveals of masked fields; consent records; start date changes; hand-off actions; exports and deletions, each with user and time (visible in `/employer/activity`).

---

# Part F. Data connections

| Feature | Connected to |
|---|---|
| Job post, pipeline and screening templates | Job Editor (`/employer/jobs/new`, `/employer/jobs/:jobId/edit`) |
| Scorecards and interview guides | Candidate Profile, Interviews (`/employer/interviews`), Job Detail (Team and scorecards tab) |
| Message templates | Candidate Profile messages, Interviews, Offers, Hires and Onboarding |
| Offer templates and approvals | Offers and Offer Detail (`/employer/offers`) |
| Accepted offers and hire records | Offers (on acceptance), candidate's Offers page (`/jobseeker/offers`) |
| Hand-off for startups | Team directory (`/startup/team`), startup tasks |
| Hand-off for other companies | HR system export or manual hand-off note |
| Documents and e-signature | Document service, e-signature integration (if used) |
| Background and reference checks | Third-party check provider (if used), consent records |
| Candidate experience feedback | Hiring Analytics (`/employer/analytics`) |
| Language and fairness checks | Hiring content service (blocklist, bias and tone checks), AI service for suggestions |
| Notifications | ERP notification service |
| Role and permissions | Identity and access (role-based and team-role-based, set up by the project owner) |

---

# Part G. CSS tokens

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

# Part H. Build order (suggested)

1. Role guard, company and team-role checks, verification awareness and the employer shell (Part A9).
2. **The platform blocklist and fairness checks** (blocked questions, biased terms, fee and contact-detail rules) as a shared service. Both the Job Editor and the Templates page depend on it.
3. **Templates and Scorecards:** Scorecards and Screening questions first (they power every job), then Pipeline and Message templates, then Job post templates; Interview guides and Offer templates next.
4. Template versions, approvals and the starter set of platform defaults.
5. **Hires and Onboarding:** hire records created automatically on offer acceptance, the Checklist and Messages first, then Documents, then Checks (only if you use them).
6. Hand-off: **Add to team** for startups on the platform, and the HR export for others.
7. Check-ins, candidate experience survey, descriptive analytics.
8. Notifications, exports with re-authentication, retention jobs.
9. Empty, loading and error states, then mobile layouts.

**Suggested first release:** Templates and Scorecards (scorecards, screening questions, message templates and the starter set), and a simple Hires page with the checklist, start date and messages. Add document collection, checks and HR exports later; they carry the most privacy and legal weight, so launch them only after legal review. Your proposal emphasizes shortening time-to-hire, so templates deliver value early, while onboarding is most useful once employers are completing real hires.

**Reminder for the build:** both pages are employer-only and role-based, and what each person can do depends on their team role. Add the guard first, enforce the blocklist and fairness checks on the server (not only in the UI), keep scorecard secrecy and blind review rules intact, mask compensation and sensitive documents by role, collect sensitive documents only after acceptance and only through the platform's tools, record explicit consent before any check, require re-authentication for exports and deletions, and write every template change, document access and hand-off to the audit log. Get legal advice on onboarding documents, background checks, data retention, offer and agreement templates, and hiring and anti-discrimination law before launch.
