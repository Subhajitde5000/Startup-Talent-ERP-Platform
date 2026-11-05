# Employer Insights and Trust Pages Design

The pages that help an employer understand its hiring, keep it honest and safe, and prove what happened: descriptive hiring analytics, a trust and safety center, and a complete activity and audit log. They support your proposal's analytics (funnel, time-to-hire, usage) and its trust and quality tools for the Jobs module: employer verification, spam and fake-posting reports, and candidate consent for shared data. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Employer role** only, in a company account. The project owner will add the role and permission logic, so build each page assuming the signed-in user is acting in the `employer` role and belongs to a company. What each person can see also depends on their **team role** (Owner, Admin, Recruiter, Hiring manager, Interviewer, Viewer). These pages deal with candidate data, company standing and security records: the server must filter everything by company and team role. Details are in **Part A9**. Do not show these pages to startups (who use the same hiring tools under `/startup/hiring/...`), mentors, investors or job seekers.

> **Reminder: analytics describe the process, not people.**
> Hiring analytics measure how the company's process works (response times, stage conversion, source quality, offer acceptance). They never rank, score or profile individual candidates, never use personal characteristics, and never show data on groups too small to be anonymous. The audit log records actions for accountability, not surveillance of individuals. Hiring must follow applicable employment, anti-discrimination and data-protection law, and the platform doesn't give legal advice.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Hiring Analytics | `/employer/analytics` | Funnel, time to hire, sources, offer acceptance, drop-off, process quality |
| 2 | Trust and Safety | `/employer/trust` | Company standing, reports about your jobs, policy flags, posting rules, appeals, reporting tools |
| 3 | Activity and Audit Log | `/employer/activity` | Who viewed, moved, scored, sent or exported what, with security events |

Related files: `employer-dashboard-design.md` shows a small hiring snapshot that links here. `employer-hiring-design.md` and `employer-process-setup-design.md` produce the data these pages summarize and use the same audit log. The candidate-facing side of trust (reporting a job, scam safety) is in `jobseeker-shared-pages-design.md`. The startup version of the audit trail is in `startup-hiring-design.md`.

---

# Part A. Shared foundations

## A1. Design principles

- **Answers before charts:** each chart has a plain headline ("Median time to first response is 3 days, down from 5") so the point is clear without reading axes.
- **Honest about data:** every number shows its period, how it's calculated and how many records are behind it. Small samples are labeled or hidden, never dressed up.
- **Describe the process:** metrics are about stages, time and channels. They are never used to judge or rank individual candidates or interviewers.
- **Safe and fair by default:** trust tools protect candidates from scams and the company from abuse, and the same rules apply to every employer.
- **Accountable, not intrusive:** the audit log shows what happened and who did it, with access limited by role and an honest explanation of what is recorded.
- **Calm tone:** no scoring of the company's "trust" as a game, no shaming. Clear status, clear next steps.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, current period, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Insight callouts, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Comparison series, disabled |
| `--stone-200` | `#E5E1D8` | Borders, gridlines |
| `--success` | `#2E7D5B` | Good standing, positive change |
| `--warning` | `#B7791F` | Needs attention, warnings |
| `--error` | `#B42318` | Restricted, violations, errors |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.
- Page title 28px serif; KPI number 32px serif 600; card title 16px Inter 600; insight headline 14px Inter 500; body 14px; caption and axis text 12px `--stone-700`. Times show the time zone (default Asia/Kolkata).

## A4. Shared layout

Desktop (≥ 1200px): the employer sidebar and top bar from the dashboard, then a 12-column grid with 24px gutters and a max content width of 1280px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, tabs become a scrollable segmented control, charts simplify (fewer gridlines, tap for tooltips), tables become cards.

## A5. Shared components

### KPI card
Label (caption), big serif number, change chip (arrow plus text, for example "▲ 12%"), small sparkline (ink, last point gold). Tooltip shows the definition and formula. A target marker is optional.

### Chart card
Title, one-line **insight headline**, chart, footer with the source chip and "How is this calculated?" link. Chart types: line (trends), bar (comparisons), stacked bar (composition), funnel (conversion), table with inline bars (rankings of jobs or sources, never of people). Palette: ink for the main series, gold for the current period or highlight, stone-400 for comparison; direct labels as well as color; every chart has **View as table**. No more than three colors per chart.

### Sample-size chip
Shows "n = 38 applicants" or "Based on 12 hires." Below a minimum (for example, fewer than 10 records), the chart is replaced by "Not enough data yet" with the minimum needed. Differences between small groups are never highlighted.

### Source and freshness chip
`Calculated`, `From platform events`, `Candidate feedback (aggregated)`, with "Updated 2 hours ago."

### Status chips
- **Standing:** `Good standing` (success tint), `Needs attention` (warning tint), `Restricted` (error tint), `Under review` (ink outline).
- **Reports and flags:** `Open` (warning tint), `In review` (ink outline), `Resolved` (success tint), `Dismissed` (stone), `Appealed` (gold-tint).
- **Audit outcomes:** `Success` (stone), `Blocked` (warning tint), `Failed` (error tint).

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and chart placeholders |
| Empty | One-line prompt and one action; charts show a faint outline, never fake numbers |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Not verified | Banner: "Verify your company to publish jobs and contact candidates." Analytics and the audit log still show draft and setup activity; Trust and Safety shows the verification status prominently |
| No permission | Controls and tabs hidden or disabled with a tooltip: "Ask an Owner or Admin." |
| Company paused or suspended | Read-only pages with a banner and **Contact support**; appeals remain available |
| Offline | Cached content with a banner; exports and appeals are disabled until reconnected |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; charts animate once on load (600ms). Numbers don't count up. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status and trends use text and icons, never color alone.
- Every chart has a text summary and a **View as table** toggle; series are distinguished by labels, shapes or dash patterns as well as color.
- Tables use proper `th` and `scope`, sortable columns announce their sort state, and amounts and counts are right-aligned.
- Modals and drawers trap focus and return it to the trigger on close. Touch targets at least 44×44px.

## A8. Fairness, privacy and conduct rules (apply to all three pages)

- **No candidate-level scoring:** analytics never show a candidate "quality score" or rank people. Job-level and source-level views are fine; individual-level views live only in the Candidate Profile.
- **No personal characteristics:** no chart, filter or export uses age, gender, religion, caste, nationality, marital status, health, photos or similar characteristics. The platform doesn't collect them for hiring decisions.
- **Process fairness checks (optional):** aggregate checks on the process itself: whether the same stages, criteria and response times applied across jobs and sources, scorecard completion rates, and reviewer disagreement ranges. They help a company spot inconsistent process, not judge individuals.
- **Minimum group sizes:** any breakdown with fewer than 10 records is hidden or merged. Percentages show the counts behind them.
- **Candidate privacy:** analytics and logs show candidate names only to people who already have access to those candidates; blind review masks names where it applies. Exports carry only fields visible to the exporter.
- **Candidate feedback is aggregated:** reply-time and experience feedback from candidates appear only as aggregates with enough responses, and never identify who said what.
- **Transparency to candidates:** the company's reply-time performance may be shown in aggregate on its company page (for example, "Typically replies within 4 days"), and the Trust and Safety page tells employers this.
- **Audit log is append-only:** entries can't be edited or deleted by users; deletion requests keep what the law requires.
- **Data handling:** encrypted in transit and at rest; follows the platform's privacy policy and applicable law (for example, India's DPDP Act). Hiring practices must follow applicable employment and anti-discrimination law; the platform doesn't give legal advice.

## A9. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `employer` role, as a member of a company account, can open `/employer/...` routes |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup (without an employer account), mentor, investor and job seeker users see a 403 page ("This page is for employers") with a link to their own home; no company or candidate data is fetched or rendered |
| **Multi-role users** | The role switcher changes the sidebar and routes between `/employer/...`, `/startup/...`, `/mentor/...`, `/investor/...` and `/jobseeker/...`. Data never mixes across roles |
| **Company scope** | All data is filtered by the company the user belongs to; the server checks membership on every request |
| **Hiring Analytics** | **Owner and Admin:** all jobs and all tabs. **Recruiter and Hiring manager:** only their jobs and teams. **Interviewer and Viewer:** no access (Viewers may see the dashboard's high-level counts only). The server applies these scopes to every query |
| **Trust and Safety** | **Owner and Admin:** full access, including reports, flags, appeals and standing. **Recruiter and Hiring manager:** read-only on reports and flags for their own jobs, and may use the reporting tools. **Interviewer and Viewer:** no access |
| **Activity and Audit Log** | **Owner and Admin:** the whole company's log. **Recruiter and Hiring manager:** their own actions and actions on their jobs (without other people's security events). **Interviewer:** their own actions only. **Viewer:** no access. The server enforces scope; log entries can't be edited or deleted |
| **Report details** | Candidate identities in reports about the company are never shown to the employer; they see the category, the job and the status |
| **Candidate data and consent** | Candidate fields appear only where the viewer already has access to that candidate; blind review masks names; shared practice results are never part of analytics or logs beyond the fact that a consented view occurred |
| **Sensitive actions** | Exporting analytics or logs, filing or withdrawing an appeal, changing team roles and closing the company account require confirmation; exports also require re-authentication |
| **Admin view** | Platform admins can view these pages read-only for support, with an "Admin view" banner, and can act on reports and appeals; access is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Hiring Analytics: `/employer/analytics`

## B1. Purpose
Shows how the company's hiring process performs: how fast it responds, where candidates drop off, which channels work, and how offers go. It helps Owners, Admins, recruiters and hiring managers improve the process and keep candidates informed.

## B2. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Hiring analytics"  [Range][Compare]    │
│          │                            [Export]            │
│          ├────────────────────────────────────────────────┤
│          │  Tabs: Overview · Funnel · Speed · Sources ·   │
│          │        Offers · Process quality                │
│          ├────────────────────────────────────────────────┤
│          │  Filter bar: jobs · teams · locations          │
│          ├────────────────────────────────────────────────┤
│          │  Insight strip (2–3 insights)                  │
│          ├────────────────────────────────────────────────┤
│          │  KPI row                                       │
│          ├───────────────────────────────┬────────────────┤
│          │  Charts (8 col)               │ Side (4 col)   │
│          │                               │ Data notes     │
└──────────┴───────────────────────────────┴────────────────┘
```

## B3. Global controls
- **Date range:** Last 30 days, 90 days, This quarter, 12 months, Custom.
- **Compare to:** Previous period, Same period last year. Comparison series use `--stone-400`.
- **Filters:** jobs, departments, teams, locations, employment type, work mode. Team-role scope applies automatically.
- **Export:** CSV (data) and PDF (report with insights and the methodology note), Owners and Admins (and Recruiters for their jobs where granted), with re-authentication.
- **Share report:** creates a view-only link inside the company for named colleagues; never public.
- **Last updated** caption with **Refresh**.

## B4. Insight strip
Two or three cards with `--gold-tint` background, each with an icon, a headline ("Candidates wait 9 days for a first reply on Engineering jobs"), a one-line reason and **View details**. Labeled `Auto insight`. Never advice about people; only about process. Dismissible.

## B5. Tabs

### B5.1 Overview
KPI row:
| Card | Example |
|---|---|
| Applicants | 312 (▲ 14%) |
| Hires | 9 |
| Median time to first response | 3 days |
| Median time to hire | 28 days |

Charts: applicants over time (line, ink), funnel summary (bars), time to first response trend (line with a 14-day reference line), offers sent vs accepted (bars). A short "What's working and what to look at" panel with up to three facts.

### B5.2 Funnel
- **Funnel chart:** Applied → Shortlisted → Interview → Offer → Hired, with counts and conversion percentages between stages, for all jobs or a selected one.
- **Drop-off by stage:** where candidates leave (Rejected, Withdrawn, No response), as counts and percentages, with the stage definitions.
- **By job table:** job, applicants, shortlisted, interviewed, offers, hires, median time per stage, status. Sortable. Small jobs (under 10 applicants) show counts without percentages.
- **Withdrawals:** share of candidates who withdrew, by stage, with a note about common reasons the candidates chose to share (aggregated).
- Caption: "These numbers describe the process, not individual candidates."

### B5.3 Speed
- **Time to first response:** distribution (ranges) and median by job and team; the share answered within 3, 7 and 14 days, with the 14-day target highlighted (matching the platform's no-ghosting guidance).
- **Time in stage:** median days per stage; stages with unusually long waits are marked "Slow" with the reason.
- **Time to hire:** from published to hired, and from applied to hired, by job type.
- **Interview scheduling lag:** days from shortlisting to interview, and from interview to decision.
- **Feedback timeliness:** share of scorecards submitted within 24 hours (team-level, not person-level, unless an Owner or Admin chooses to see per-interviewer counts, which are labeled as process data and for coaching, not performance management).
- **Waiting candidates:** current number waiting over 14 days with **Reply with a template** (links to the pipeline).

### B5.4 Sources
- **Applicants by source:** Job search, Startups hiring, Invitations accepted, Recommendations, Direct link, Referrals. Bars with counts.
- **Source quality:** conversion from applied to interview and hire by source, with sample sizes; small groups are hidden.
- **Invitations (Talent Search):** invitations sent, viewed, accepted and declined; acceptance rate; daily limit usage.
- **Job post performance:** views, applications and apply rate per job; which job features correlate with more applicants (salary shown, length, work mode), labeled as correlation, with a sample-size note.
- Caption: "A source with few applicants may not tell you much yet."

### B5.5 Offers
- **Offers funnel:** created → approved → sent → viewed (if enabled) → accepted, declined, expired, withdrawn, with counts and rates.
- **Time from final interview to offer** and **time to acceptance**.
- **Decline reasons (aggregated):** only candidate-shared reasons, with the minimum sample rule.
- **Offer-to-start:** accepted offers that reached the start date vs. did not join (descriptive; links to Hires and Onboarding).
- **Counter-offers:** share of offers with change requests and how often terms were adjusted (counts only, no pay figures per person).
- A note says compensation details are not shown in analytics.

### B5.6 Process quality
The optional **process fairness checks** from A8, kept descriptive:
- **Consistency:** share of jobs using a published scorecard and a standard screening set; share of interviews with scorecards submitted; scorecard criteria used per round.
- **Reviewer agreement:** how widely interviewer scores differ on the same candidates, shown as ranges at the job level (to spot unclear criteria), never per person.
- **Blind review:** jobs using blind review, and how many candidates reached Interview from jobs with and without it (counts only, no claims).
- **Reply practices:** share of rejections that included a reason and a message; share of candidates who received an acknowledgement within a day.
- **Language checks:** number of job posts with biased-wording warnings fixed before publishing.
- **Candidate experience (aggregated):** average satisfaction from optional candidate surveys, shown only with enough responses.
Each check has "What it means" and a suggested improvement (for example, "Add anchors to the 'Communication' criterion"). No check ranks people.

## B6. Side column
- **Data notes:** what is included, the minimum group size, time zone, how stages are mapped, last refresh, known limits ("Hires recorded after 12 Oct only").
- **Definitions:** short list of metric definitions with formulas.
- **Saved views:** name and save a set of filters; share with named colleagues.
- **Report an issue with this data:** opens a support ticket.

## B7. Definitions (shown in tooltips)

| Metric | Definition |
|---|---|
| Applicants | Candidates who submitted an application in the period |
| Stage conversion | Candidates who reached the next stage ÷ candidates who reached this stage |
| Time to first response | From application to the first human action visible to the candidate (stage change or message), excluding the automatic acknowledgement |
| Time in stage | From entering to leaving a stage |
| Time to hire | From job published to the offer being accepted (or from application to acceptance, as labeled) |
| Offer acceptance rate | Accepted ÷ offers sent (excluding withdrawn by the employer) |
| Source quality | Conversion to interview or hire by source (with sample sizes) |
| Reviewer agreement range | Spread between highest and lowest score on the same criterion for the same candidate in the same round, averaged at job level |

## B8. States
- **No data (new company or no jobs):** "Your analytics will appear after your first applicants." with **Post a job**.
- **Not enough data:** per chart, "Not enough data yet" with the minimum needed (for example, 10 applicants).
- **Partial period:** dashed segment with a "Period in progress" caption.
- **Filters too narrow:** "Too few records for this filter" with a suggestion to broaden.
- **Stale data:** warning chip with the last update time.
- **Export in progress:** toast and progress; the file downloads or is delivered by notification.
- **Scope limited by role:** a note "Showing your jobs only."
- **Loading error:** inline **Retry**; other charts stay usable.

---

# Part C. Trust and Safety: `/employer/trust`

## C1. Purpose
The company's one place for trust: its verification and standing, reports about its jobs and messages, policy flags and appeals, the rules for posting, and tools to report problems (fake or abusive applicants, impersonation, spam). It supports your proposal's employer verification and its spam and fake-posting reports.

## C2. Layout
Header with the company's standing and a short line ("Keep hiring safe and fair for everyone."). Summary strip, tabs, then content with a side column on desktop. Tabs: **Overview** · **Reports and flags** · **Appeals** · **Posting rules** · **Report a problem** · **Blocked candidates**.

### Summary strip
| Stat | Example |
|---|---|
| Standing | Good standing |
| Verification | Verified · reviewed 12 Oct 2026 |
| Open reports | 1 (warning tint when above zero) |
| Jobs paused by policy | 0 |

## C3. Overview tab

### Company standing card
Status chip (`Good standing`, `Needs attention`, `Restricted`, `Under review`), what it means in plain words, and what it affects (for example, `Restricted`: new jobs need review before publishing, outreach limits reduced). If not in good standing: the reason, the steps to fix it, the earliest review date and **Contact support**. No numerical "trust score" is shown; the standing is a clear state with reasons.

### Verification card
Verified status, date of last review, what was checked (business registration, official email domain, website), what triggers a re-check (legal name change, new domain), and **Update verification details** (links to `/employer/verification`). If action is needed, an error-tint banner with the reason.

### Responsiveness card
The company's reply practices, in aggregate and descriptive: median time to first response, share replied within 14 days, share of rejections with a message. A line states these may appear on the company page in aggregate. **Improve this** links to the Speed tab in Analytics and the message templates.

### Recent trust events
A short timeline (up to 6): verification approved, job flagged, report resolved, appeal decided, outreach limit change. Each with a date and link.

### Safety reminders
Three short rules: "Never ask candidates for money," "Keep conversations on the platform," "Judge candidates against the job only." With **Read the posting rules**.

## C4. Reports and flags tab

### What appears here
- **Reports about your jobs or messages** made by candidates or others (categories: asks for fees, misleading pay or role, fake job, impersonation, discrimination, inappropriate questions, spam, off-platform contact). The reporter's identity is never shown; the employer sees the category, the job or message concerned, the date and the status.
- **Automated policy flags** from the platform's checks (for example, a post containing a payment request or contact details, or a screening question on a blocked topic).
- **Moderation actions** taken on the company's content (job paused, post edited, message removed, outreach limited) with the reason.

### List
Table: date, type (Report or Flag), category, related item (job or message), status chip, action taken, last update. Filters: status, category, job. Team-role scope: Recruiters and Hiring managers see only their own jobs.

### Detail drawer (560px)
1. **What was reported or flagged:** category, the job or message excerpt (only the relevant part), and the rule it relates to (linking to the posting rules).
2. **What happened:** actions taken and when (for example, "Job paused pending changes").
3. **What you can do:**
   - **Fix and resubmit** (opens the Job Editor with the issue highlighted)
   - **Respond** (a short explanation for the moderators, up to 1,000 characters)
   - **Appeal** (Part C5)
   - **Dismiss** (for flags that don't apply after you fixed the cause)
4. **History:** timeline of moderator notes (visible ones), changes and responses.
5. Reminder: "We never share who reported."

### States
- **No reports or flags:** "Nothing to review. Keep it up."
- **Job paused by policy:** error-tint banner with the reason and steps to fix; the job stays hidden from search but visible to applicants already in the pipeline.
- **Report resolved without action:** `Dismissed` chip with a short note.
- **Repeated violations:** warning card explaining escalation (limits, review of all new jobs, suspension) and the support contact.
- **Safety-critical report (for example, suspected fraud):** the company is told only what it needs to act and that moderation may restrict activity while reviewing.

## C5. Appeals tab

- **How appeals work:** a short explainer with expected timeline (for example, 5 business days) and what to include.
- **Start an appeal:** pick the decision (report outcome, job pause, restriction, verification decision), explain why (up to 2,000 characters), attach evidence (up to 5 files, 10 MB each), and confirm. The appeal is reviewed by someone other than the original moderator where possible.
- **Appeals list:** status (`Submitted`, `In review`, `Decision made`), date, outcome and the reason, with **View decision**.
- **Outcomes:** upheld (decision stays, with the reason), partly overturned or overturned (actions reversed, content restored). A second review is possible once if new evidence exists.
- During an appeal, restrictions stay unless the platform says otherwise, and the page says so.
- Only Owners and Admins can file or withdraw appeals.

## C6. Posting rules tab
A readable, searchable guide to the employer rules, with short examples and "Do" and "Don't" lists:
- **Verification:** only verified companies can publish and contact candidates.
- **Accurate jobs:** real openings, real pay ranges where shown, honest descriptions; no "evergreen" jobs that aren't hiring.
- **No fees:** never ask candidates for money for training, equipment, deposits or "processing."
- **No off-platform pressure:** no personal contact details or payment links in posts or messages until after acceptance and through the platform's tools.
- **Fair criteria:** no questions or requirements based on age, gender, religion, caste, nationality, marital status, family plans, health or photos; no knockout questions.
- **Respect:** reply to applicants, give reasons for rejections, and keep messages professional.
- **Data use:** use candidate data only for the job they applied to or an accepted invitation; honor withdrawals and deletion requests; keep data for the stated period.
- **Practice results:** treat shared interview practice results as optional, never as a hiring decision basis.
- **Honest advertising:** featured listings are labeled; no fake scarcity or applicant counts.
- **Consequences:** a short ladder (warning, job paused, outreach limits, restriction, suspension) with the appeal route.
The page includes the version date and a change log.

## C7. Report a problem tab
Tools for the company to report issues to the platform:
- **Report a candidate or application:** fake or duplicate profiles, spam applications, abusive messages, fraudulent documents, impersonation. The employer chooses the application or message, a category and a description; evidence can be attached.
- **Report a message or user:** harassment, requests for personal contact, scams targeting the company.
- **Report a platform issue:** wrong data, access problems.
- **Report a security concern:** suspected account compromise, suspicious logins (links to Settings → Security and the audit log).
- Reports are confidential and acknowledged; the candidate isn't told who reported unless the law requires it. A note says reports are reviewed for fairness: a report isn't a rejection reason, and candidates can respond.
- A **My reports** list shows the status and outcome of the company's reports.

## C8. Blocked candidates tab
- Candidates the company blocked (for example, after abusive behavior), with the date, the category and the person who blocked. Names and identities are shown to Owners and Admins only; others see counts.
- **Unblock** requires an Owner or Admin and a note.
- Blocking affects only this company's pipeline and invitations; it is not a platform-wide ban.
- A note reminds employers that blocking can't be used for discriminatory reasons and is logged.

## C9. Side column
- **Quick actions:** **Report a problem**, **View posting rules**, **Contact support**.
- **Security tips:** "Use two-factor authentication," "Review your team's access," with a link to Team and Settings.
- **Platform status** link and any incident banner.

## C10. States
- **New company, not verified:** the Overview leads with the verification checklist; Reports and flags show "Nothing here yet."
- **Suspended:** read-only with a banner; appeals and support remain available.
- **Under review:** banner "Your company is under review." with what is paused and the expected timeline.
- **Loading error:** inline **Retry**.
- **No permission:** tabs hidden or read-only as in A9.

---

# Part D. Activity and Audit Log: `/employer/activity`

## D1. Purpose
A readable, complete record of important actions in the company's hiring account: who viewed a candidate, moved a stage, scored, sent an offer, changed a template, exported data or signed in from a new device. It supports accountability, security, and answering questions from candidates or regulators.

## D2. Layout
Header with title, the note "This log can't be edited or deleted," **Export**, and a summary strip. Tabs: **All activity** · **Candidate data access** · **Hiring actions** · **Offers and hires** · **Team and settings** · **Security**. Toolbar with search, filters and date range, then the log table and a detail drawer.

### Summary strip
| Stat | Example |
|---|---|
| Events (last 30 days) | 1,248 |
| Candidate profile views | 410 |
| Exports | 3 |
| Security alerts | 0 |

### Toolbar
Date range (Today, 7 days, 30 days, Custom), category chips, member filter (Owners and Admins), job filter, outcome filter (Success, Blocked, Failed), search by action text or record ID.

## D3. Log table

| Column | Content |
|---|---|
| Time | Date and time with time zone |
| Who | Member name and team role (or "System" or "Candidate") |
| Category | Candidate data, Hiring, Offers, Team, Settings, Security, Billing |
| Action | Plain-language description ("Viewed candidate profile: Candidate #23 for Product Designer") |
| Target | Job, candidate (name or "Candidate #23" in blind review, only if the viewer can see that candidate), offer, template or setting |
| Outcome | Success, Blocked (for example, no permission), Failed |
| Context | Device type, approximate region, session ID (shortened) |

Row click opens a detail drawer with the full record: exact time, IP region, device and browser, session ID, before and after values for changes (for example, "Stage: Shortlisted → Interview"), and links to the related record when the viewer still has access.

## D4. Tab contents

### Candidate data access
Who opened which candidate profile, resume or document, downloaded or exported candidate data, viewed a shared practice result (only the fact that a consented view occurred, not the content), and used contact details. Per-candidate access history is also shown inside Candidate Profile (Activity tab). Helps answer candidate data-access questions ("Who saw my application?"). Owners and Admins see everyone; Recruiters and Hiring managers see their own jobs.

### Hiring actions
Job created, edited, published, paused or closed; stage moves; scorecards submitted (the fact of submission and time, not scores, unless the viewer may see them); messages sent; invitations; bulk actions; template changes.

### Offers and hires
Offer drafts, versions, approvals, sends, counters, acceptances, withdrawals; hire records, checklist changes, document requests and views, start date changes. Compensation values are masked unless the viewer has permission.

### Team and settings
Members invited, removed or role changed; permissions changed; company page edits; hiring preferences; verification changes; integrations connected.

### Security
Sign-ins (success and failed), new devices, two-factor changes, password changes, active sessions with **Sign out** for each (own sessions for everyone; others' sessions for Owners and Admins), unusual activity (for example, a login from a new country, many profile views in a short time, a large export) with a warning chip and **This wasn't me** (starts a security review and can sign the session out).

## D5. Export
- **Export CSV or PDF** of the filtered log, for the viewer's scope only. The PDF has a summary page, filters, a verification code and the generation time.
- Exports require re-authentication and are themselves logged ("Exported activity log, 1,248 rows").
- Large exports are prepared in the background and delivered by notification. One active export at a time.

## D6. Verification and disputes
- **Verify a record:** each record has a unique ID; **Request verification** asks support to confirm a record for a dispute or compliance check.
- **Report an entry:** if an entry looks wrong (for example, a session the person doesn't recognize), **Report** opens a ticket with the record attached.
- **Candidate data requests:** a short guide on handling a candidate's request to know who accessed their data or to delete it, with a link to the process (handled by Owners and Admins), and the entries needed to respond.

## D7. Alerts (optional)
Owners and Admins can set simple alerts: large exports, many profile views by one person in a day, access to a candidate by someone not assigned to their job, role changes, new device sign-ins. Alerts appear in-app and by email, and describe actions, not accusations ("Large export by a Recruiter").

## D8. Retention and privacy
- A note explains the retention period and what is kept: hiring and offer records follow the company's retention setting (default 12 months after a job closes) and applicable law; security and access logs are kept per policy.
- Candidate names in old log entries are anonymized when a candidate's data is deleted, keeping the action record.
- Logs are not used to rate or rank team members; the page says so.
- **Download my data** (own actions) is available to every member in Settings.

## D9. States
- **Empty (new account):** "Your activity will appear here as your team uses the platform."
- **No results:** "No entries match your filters." with **Clear filters**.
- **Loading:** skeleton rows.
- **Large result set:** pagination with a count and a prompt to narrow filters.
- **Delayed entries:** a small notice "Some entries can take a few minutes to appear."
- **Suspicious activity:** a warning banner at the top with **Review** and **Secure the account**.
- **Export ready or failed:** notification and banner with **Download** or **Retry**.
- **Entries involving a deleted candidate:** shown with "Candidate #deleted" and the action preserved.
- **Limited scope:** a note "Showing your actions and your jobs." for Recruiters, Hiring managers and Interviewers.
- **Loading error:** inline **Retry**.

---

# Part E. Notifications for these pages

| Event | Who is notified | Channel |
|---|---|---|
| Weekly or monthly hiring summary (optional) | Owners, Admins, job owners | Email |
| Insight: candidates waiting over 14 days | Recruiter, hiring manager, Owner | In-app, email |
| Insight: unusual drop in applicants for a job | Job owner | In-app |
| Report received about a job or message | Owners, Admins, job owner | In-app, email |
| Policy flag raised on a post | Author, job owner, Owners, Admins | In-app, email |
| Job paused by policy | Job owner, Owners, Admins | In-app, email |
| Appeal received, decided | Appeal filer, Owners | In-app, email |
| Standing changed (needs attention, restricted, restored) | Owners, Admins | In-app, email |
| Verification expiring or action needed | Owners, Admins | In-app, email |
| Candidate data request received | Owners, Admins | In-app, email |
| Large export, unusual access or new device sign-in | Owners, Admins, the user | In-app, email, push |
| Activity log export ready | Requester | In-app |

Users can mute or set digests in Settings. Security, policy and standing alerts cannot be muted. Notification text never includes candidate names, pay figures or report details in email subjects.

---

# Part F. Data and validation

| Field | Rule |
|---|---|
| Analytics date range | Up to 24 months; custom ranges validated |
| Minimum group size | Breakdowns with fewer than 10 records are hidden or merged; charts show "Not enough data yet" |
| Saved views | Name 3–60 characters; shared only with named colleagues inside the company |
| Analytics export | Owner and Admin (and Recruiter for their jobs where granted), re-authentication; includes methodology and filters; no personal characteristics fields exist to export |
| Report (company-filed) | Category and description required (20–2,000 characters); up to 5 attachments, 10 MB each |
| Response to a flag | Up to 1,000 characters |
| Appeal | Decision selected; explanation 50–2,000 characters; up to 5 files, 10 MB each; one appeal per decision plus one follow-up with new evidence |
| Block a candidate | Reason category required; logged; reversible by Owner or Admin with a note |
| Audit log | Append-only; entries can't be edited or deleted; exports one at a time |
| Alerts | Thresholds set within allowed ranges; sent to Owners and Admins |
| Retention | Hiring and offer records per company setting (default 12 months after a job closes); access and security logs per platform policy and law |

**Audit log:** analytics exports and shared views, report filings, appeals, block and unblock actions, alert settings and every action listed in Part D, each with user and time.

---

# Part G. Data connections

| Feature | Connected to |
|---|---|
| Funnel, speed and source data | Hiring pipeline events (`/employer/jobs/:jobId`), Interviews, Offers, Hires (`/employer/hires`) |
| Process quality checks | Templates and Scorecards (`/employer/templates`), Job Editor, scorecard submissions |
| Job post views and apply rate | Candidate Job Search and Job Detail (`/jobseeker/jobs`) |
| Candidate feedback (aggregated) | Candidate surveys and application records (`/jobseeker/applications`) |
| Verification and standing | Admin console, employer verification (`/employer/verification`) |
| Reports and flags | Candidate reports (`/jobseeker/shared Help`, Report a concern), moderation queue, automated policy checks |
| Appeals | Admin console, moderation review |
| Blocking | Talent Search and invitations, candidate blocklists |
| Audit log | Central audit service fed by all employer pages |
| Security events | Identity and access, session management |
| Notifications | ERP notification service |
| Role and permissions | Identity and access (role-based and team-role-based, set up by the project owner) |

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

  /* chart palette */
  --chart-1: var(--ink);
  --chart-2: var(--gold);
  --chart-3: var(--stone-400);
}
```

---

# Part I. Build order (suggested)

1. Role guard, company and team-role checks, and the shared audit service (Part A9). Every employer page writes to the audit service, so build it first.
2. **Activity and Audit Log** (append-only store, scoped queries, export with re-authentication), then Security alerts.
3. **Trust and Safety** basics: standing and verification card, Reports and flags (read-only), Posting rules. These connect to the candidate reporting flow and the platform's moderation queue.
4. **Appeals** and the company-side reporting tools; blocked candidates.
5. **Hiring Analytics:** Overview, Funnel and Speed first (they only need pipeline events), then Sources and Offers, then Process quality.
6. Minimum group size enforcement and the "not enough data" states on the server before any chart ships.
7. Saved views, exports, optional hiring summary emails and alerts.
8. Notifications, empty, loading and error states, then mobile layouts.

**Suggested first release:** the audit log, Trust and Safety (standing, reports, rules and appeals), and the Funnel and Speed analytics. Add Sources, Offers and Process quality once there are enough jobs and hires to avoid tiny samples. Your proposal's trust goals (employer verification, spam and fake-posting reports, candidate consent) depend on the audit log and the trust page being in place before employers publish jobs at scale.

**Reminder for the build:** every route above is employer-only and role-based, and what each person sees depends on their team role. Add the guard first and filter data on the server by company, team role and candidate access. Enforce minimum group sizes on the server, never expose reporter identity, never use or collect personal characteristics, keep the audit log append-only, require re-authentication for exports, and make sure analytics never rank candidates or individual interviewers. Get legal advice on hiring and anti-discrimination law, candidate data access and deletion, record retention and employer trust and safety processes before launch.
