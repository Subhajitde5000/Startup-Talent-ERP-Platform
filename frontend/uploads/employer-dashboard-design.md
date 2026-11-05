# Employer Dashboard Design: `/employer/dashboard`

The home screen for an employer: a company or startup that posts jobs and hires candidates through the platform. It answers four questions at a glance: **What needs my attention today? Where does each open job stand? Who is interviewing and when? How is our hiring going?** It pulls together the employer features in your proposal: job posting, the applicant pipeline (applied, shortlisted, interview, offer, hired), candidate search and shortlist, the verified-employer badge, and trust and safety tools. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: this page is role-based.**
> This page belongs to the **Employer role** only. The project owner will add the role and permission logic, so build the page assuming the signed-in user is acting in the `employer` role in a company account. What each person sees also depends on their **team role** (Owner, Admin, Recruiter, Hiring manager, Interviewer, Viewer): see section 10 and **Part A9**. Candidate data is personal and sensitive: the server must filter everything by company and team role. Do not show this page to startups (who use `/startup/hiring/...` for the same hiring tools), mentors, investors or job seekers.

> **Reminder: AI helps, people decide.**
> Anything automated on this page (summaries, suggested next steps, match hints) is a labeled aid. It never ranks candidates into a decision, never rejects anyone automatically, and never uses personal characteristics such as age, gender, religion, caste, nationality or marital status. Hiring decisions are made by people.

## 1. Design principles

- **Action first:** a recruiter's day is a queue. The page opens with what needs a reply, a review or a decision, ordered by urgency.
- **Respect for candidates:** the page nudges employers to reply to every applicant, with a gentle reminder for applicants waiting over 14 days, in line with your proposal's trust and quality goals. No ghosting by design.
- **Fair and consistent:** the same criteria and scorecards for every candidate. Counts and funnels are descriptive; nothing ranks people by personal traits.
- **Candidate consent respected:** practice scores or other shared data appear only for candidates who allowed it, and are labeled "Practice result provided by the candidate."
- **Calm and scannable:** cards, short lists, clear numbers. Few colors: ink for the main series, gold for highlights, stone for comparison.
- **Team-aware:** what is shown follows each person's team role, so interviewers see their own tasks and recruiters see the whole pipeline.

## 2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, current item, progress fill, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlights, badges, selected state, AI labels |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, tracks, gridlines |
| `--success` | `#2E7D5B` | Verified, hired, positive change |
| `--warning` | `#B7791F` | Needs action, due soon, waiting |
| `--error` | `#B42318` | Overdue, errors, policy flags |

## 3. Typography

- **Page title and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for numbers.

| Element | Size / weight |
|---|---|
| Page title | 28px serif 600 |
| KPI number | 32px serif 600 |
| Card title | 16px Inter 600 |
| Body | 14px Inter 400 |
| Caption / meta | 12px Inter 400, `--stone-700` |

Times show the time zone (default Asia/Kolkata, configurable in Hiring Preferences). Currency follows the company setting (₹ with Indian grouping by default).

## 4. Layout

### Desktop (≥ 1200px)
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar: search · notifications · profile     │
│          ├────────────────────────────────────────────────┤
│          │  Greeting + company status                     │
│          ├────────────────────────────────────────────────┤
│          │  Next best action                              │
│          ├────────────────────────────────────────────────┤
│          │  KPI row (4 cards)                             │
│          ├───────────────────────────────┬────────────────┤
│          │  Needs your attention         │ Today          │
│          │  Open jobs and pipelines      │ Offers pending │
│          │  Candidates to review         │ Hiring plan    │
│          │  Hiring snapshot (charts)     │ Plan and usage │
│          │  Team activity                │ Trust and tips │
└──────────┴───────────────────────────────┴────────────────┘
```
- 12-column grid, 24px gutters, max content width 1280px, page padding 32px.
- Card: white, 1px `--stone-200` border, radius 12px, padding 24px. No heavy shadows.

### Tablet (768–1199px)
Sidebar collapses to a 72px icon rail. The side column drops below the main column. Cards go to two columns.

### Mobile (< 768px)
Single column. The sidebar becomes a bottom tab bar (Home, Jobs, Candidates, Interviews, More). KPI cards scroll horizontally. Pipelines become one stage at a time. A sticky **Post a job** button sits above the tab bar for roles that can post.

## 5. Navigation

### Sidebar (ink background, ivory text)
- Logo and company name (with a company switcher for people in more than one company)
- **Dashboard** (active: `--ink-soft` background, 3px gold bar at the left)
- Hiring (Overview, Jobs, Requests)
- Candidates (Talent search, Shortlists)
- Interviews
- Offers
- Hires
- Analytics
- Company page
- Team
- Messages (unread count)
- *Bottom:* Settings, Help, **role switcher** (for multi-role accounts, for example "Employer · Job seeker")

Items the team role can't use are hidden, not greyed out (for example, Billing for Recruiters).

### Top bar
Global search (jobs, candidates the user can access), notification bell (gold dot when unread), profile menu.

## 6. Sections and components

### 6.1 Greeting and company status
- Greeting: "Good morning, {Name}" with the company name and logo.
- **Status pills beside it:** `Verified employer` (success tint with check), `Verification pending` (warning tint), `Action needed` (error tint, with the reason), or `Paused`. Click opens the verification page.
- A one-line summary: "4 open jobs · 18 candidates waiting for review · 2 interviews today."

### 6.2 Next best action
A single suggested step (gold-tint card, `Suggested` label, **Not now** link that hides it for the day). Chosen by role and situation, in priority order:
1. Verification incomplete → **Finish verification** (jobs can't be published until verified)
2. An offer needs your approval or expires within 48 hours → **Review offer**
3. An interview starts within an hour → **Open interview prep**
4. Interview feedback overdue → **Submit your scorecard**
5. Candidates waiting over 14 days → **Reply to waiting candidates**
6. New applicants unreviewed over 3 days → **Review new applicants**
7. A job has no applicants after 14 days → **Improve this job post**
8. Otherwise → **Post a job** or **Search talent**

### 6.3 KPI row (4 cards)
| Card | Example |
|---|---|
| Open jobs | 4 (1 closing this week) |
| New applicants (7 days) | 26, ▲ 8 vs last week |
| Interviews this week | 9 |
| Offers out | 2 (1 expiring in 48 hours) |

Each card has a caption label, a big serif number, a change chip (arrow plus text) and a small sparkline. Clicking filters the matching page. Tooltips show how each number is calculated.

### 6.4 Needs your attention (main card)
A prioritized list, each row with an icon, one-line text, how long it has waited, and one button:
- **New applicants unreviewed** (count per job; warning chip over 3 days)
- **Candidates waiting over 14 days** (no-ghosting reminder; error tint over 21 days) → **Reply or reject kindly**
- **Interview feedback overdue** (scorecards not submitted after 24 hours)
- **Offers awaiting your approval** or **expiring within 48 hours**
- **Candidate replies to your messages**
- **Candidates asked for a different interview time**
- **Hiring requests awaiting approval** (Owner, Admin)
- **Jobs expiring soon** or **jobs with no applicants after 14 days**
- **Reports about a job** or **a policy flag** (Trust and Safety)
- **Verification or billing issues** (Owner, Admin)
Each team role sees only the items it can act on. Items can be snoozed for 24 hours ("Snooze") except overdue candidate replies, which can only be completed or reassigned.

### 6.5 Open jobs and pipelines
- Title: "Your open jobs", with **+ New job** and **View all jobs**.
- A table or card list (up to 6): job title, status chip (`Open`, `Closing soon`, `Paused`, `Pending approval`), location and work mode, days open, owner, applicant count with a **mini stage bar** (segments for Applied, Shortlisted, Interview, Offer), "+6 new" badge, and actions (**Open pipeline**, **Edit**, overflow: Pause, Duplicate, Close).
- Jobs without applicants after 14 days show a hint: "Try adding a salary range or shortening the description." (`AI suggestion` label with a reason).
- Jobs flagged by Trust and Safety show a `Needs attention` chip with the reason.

### 6.6 Candidates to review
- Title: "Candidates to review". A list of up to 6 applicants awaiting a first look, newest or longest waiting first (switchable).
- Each row: candidate name (or "Candidate #23" when blind review is on for that job), headline (current role), job applied for, applied date, source (Job search, Startups hiring, Invitation accepted, Recommendation), **skills match** hint (`AI suggestion` label with plain reasons such as "5 of 7 must-have skills on resume"), small icons (resume, screening answers, shared practice score if allowed), and quick actions: **Shortlist**, **Reject kindly**, **Open**.
- A **Review queue** button opens the pipeline in a focused review mode.
- No ranking by an AI score; the match hint is informational, sorting is by time, and the page says: "Match hints help you read faster. They don't decide."
- Candidate consent badge: "Practice result shown with the candidate's permission."

### 6.7 Hiring snapshot
A compact section with two or three charts (ink for the main series, gold for the current period, stone-400 for comparison; direct labels; **View as table** toggle):
- **Funnel:** Applied → Shortlisted → Interview → Offer → Hired with counts and conversion percentages, for the chosen period (last 30 days by default).
- **Time to hire:** median days from applied to hired and from applied to first response, with the trend.
- **Sources:** where applicants come from (Job search, Startups hiring, Invitations, Recommendations, Direct link).
- **Offer acceptance:** offers sent vs accepted, declined and expired.
Each chart has a headline sentence ("Median time to first response is 3 days, down from 5") and a link to Hiring Analytics. A caption says the numbers describe the hiring process, not individual candidates.

### 6.8 Team activity
A short feed of recent team actions (up to 6): "Priya moved Arjun to Interview", "Rahul submitted feedback for Sana", "Offer v2 approved by Meera." Each has a time and a link. Visible to Owners, Admins and Recruiters; interviewers see only items about candidates assigned to them.

### 6.9 Side column

#### Today
A timeline of today's interviews: time (with time zone), candidate (or "Candidate #23" in blind review), role, interviewers, format, **Join** (appears 10 minutes before for platform video), **Prepare**. If none: "No interviews today."

#### Offers pending
Cards for offers in progress: candidate, job, status chip (`Awaiting approval`, `Sent`, `Countered`, `Accepted`), expiry date (warning chip within 7 days), and **Open**. Offers countered by the candidate show a gold-tint banner: "Candidate requested changes."

#### Hiring plan (startups on the platform)
If the company is a startup using the platform's stage plan, a small card shows hiring requests from the stage plan and **Add request**. Outside companies see **Hiring requests awaiting approval** instead.

#### Plan and usage (Owner and Admin)
Current plan, open jobs used of limit ("3 of 5"), seats used, outreach messages left today, featured listings left, and **Manage plan**. A warning chip appears when a limit is near. Posting stays free of pressure messages; limits are stated plainly.

#### Trust and tips
- A short **Trust and safety** card: open reports (count), the company's verification status and last review date, and a link to the posting rules.
- One rotating tip, dismissible and shown at most once a day ("Jobs that show a salary range usually get more qualified applicants.").

## 7. Buttons and controls

- **Primary:** ink background, white text, radius 10px, 40px high.
- **Secondary:** white, 1px `--stone-200` border, ink text.
- **Destructive:** white with error text (for example, **Close job**).
- **Link:** `--gold-dark` text, underline on hover.
- **Chips:** radius 999px, 12px text; `AI suggestion` uses `--gold-tint` with `--gold-dark` text and a small sparkle icon.
- **Inputs:** 44px high, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.
- Touch targets at least 44×44px.

## 8. States

| State | Behavior |
|---|---|
| Loading | Skeleton cards (stone-200 shimmer); no full-page spinner |
| New company, not verified | Hero card "Let's get your company ready to hire" with 3 steps: complete verification, build your company page, post your first job. Hiring cards show friendly empty states; **Post a job** is disabled with the reason and a **Finish verification** button |
| Verification pending | Banner: "Your verification is under review (usually 1 to 2 business days). You can prepare job posts, but you can't publish yet." |
| Verification action needed | Error-tint banner with the reason and **Update verification** |
| Verified, no jobs | "Post your first job." with **New job** and **Use a template**; the funnel and sources cards show placeholders without fake numbers |
| Jobs but no applicants yet | The job card shows the share link and tips; the review list explains "Applicants will show up here." |
| Nothing needs attention | "You're all caught up. Nice work." |
| Candidates waiting over 14 days | Gold-tint banner above the list: "12 candidates are waiting for a reply. A short, kind response helps." with **Reply to all with a template** (opens a bulk rejection or update flow with required confirmation) |
| Offer expiring in 48 hours | Warning chip and banner |
| Plan limit reached | Warning card with the limit and **Manage plan**; drafts and existing jobs remain unaffected |
| Policy flag on a job | Error-tint card with the reason, how to fix it and **Appeal**; the job may be paused until reviewed |
| Not enough data for charts | "Not enough data yet" with the minimum (for example, 10 applicants); no empty fake charts |
| Error loading a card | Inline message in that card with **Retry**; other cards stay usable |
| Offline | Cached content with a banner "You're offline. Some information may be out of date." |
| Company paused or suspended | Read-only dashboard with a banner and **Contact support**; candidate-facing actions disabled |

## 9. Fairness, privacy and trust rules (apply to this page)

- **Candidate consent:** shared practice scores and other optional data appear only for candidates who allowed it, with the label "Practice result provided by the candidate. Not an assessment to base a hiring decision on." Recordings, transcripts and delivery analysis are never available to employers.
- **Blind review:** when a job uses blind review, names, photos and school names are hidden at the first screening step on every list on this page.
- **No ranking by AI:** match hints are explained and informational. The page never shows an overall AI score for a person and never auto-rejects.
- **No discriminatory filters or sorts:** nothing on this page sorts or filters by personal characteristics.
- **No ghosting:** reminders for applicants waiting over 14 days, and kind rejection templates, are part of the flow. Reply-time statistics describe the employer's own process and may be shown to candidates in aggregate on the company page.
- **Data minimization:** the dashboard shows only what the person's team role needs. Contact details appear only after a candidate applies or accepts an invitation.
- **Candidate data rights:** candidates can withdraw, ask for deletion and revoke sharing; the dashboard reflects withdrawn applications without showing their content.
- **Verified status matters:** only verified employers can publish jobs or message candidates, as your proposal requires. Verification is visible on every candidate-facing surface.
- **Data handling:** data is encrypted in transit and at rest and follows the platform's privacy policy and applicable law (for example, India's DPDP Act). Hiring practices must follow applicable employment and anti-discrimination law; the platform doesn't give legal advice.

## 10. Role-based behavior (team roles within a company)

| Team role | What the dashboard shows |
|---|---|
| **Owner** | Everything: hiring snapshot, billing and plan usage, verification and trust status, approvals, team activity |
| **Admin** | Same as Owner except billing changes; sees plan usage read-only if the Owner restricts it |
| **Recruiter** | All jobs assigned to them or their team: needs attention, open jobs, candidates to review, interviews, offers they prepare, hiring snapshot for their jobs |
| **Hiring manager** | Their jobs only: pipeline, candidates to review, interviews, offers awaiting their approval, hiring snapshot for their jobs |
| **Interviewer** | "My interviews" (today and upcoming), feedback due, and the candidates assigned to them; no hiring snapshot, no offers, no scores from colleagues until they submit their own |
| **Viewer** | Read-only counts and open jobs; no candidate names or personal data |

- **Multi-role users:** a founder, mentor, investor or job seeker who is also an employer sees this dashboard only after switching to the Employer role. Notification badges per role appear in the role switcher ("Employer 5 · Job seeker 1").
- **Startups on the platform:** the startup's hiring pages live under `/startup/hiring/...` and show the same records; the employer dashboard is for company accounts. A startup account that also has an employer account is shown both through the role switcher, and data isn't duplicated.
- **Other roles:** startup (without an employer account), mentor, investor and job seeker users get a 403 page ("This page is for employers") with a link to their own home.

## 11. Motion

- 150–200ms ease-out for hover and focus; charts and progress bars animate once on load (600ms).
- Cards fade in with an 8px rise, staggered 40ms. Numbers don't count up.
- Respect `prefers-reduced-motion` (no animations, instant render).

## 12. Accessibility

- WCAG 2.1 AA; gold text uses `--gold-dark` on light backgrounds.
- Status, priority and trends are never shown by color alone: always include text or icons.
- Every chart has a text summary and a **View as table** toggle; chart series use labels or dash patterns as well as color.
- Semantic landmarks (`nav`, `main`, `aside`), a skip-to-content link, and a logical tab order; lists of tasks and candidates are real lists with accessible names.
- Quick actions (Shortlist, Reject kindly) are keyboard operable and announce results ("Moved to Shortlisted") in a live region.
- Times always state the time zone. Touch targets at least 44×44px.

## 13. Data connections

| Section | Source |
|---|---|
| Verification and company status | Admin console, employer verification (`/employer/verification`, `/employer/application`) |
| Jobs and pipelines | Hiring Overview, Job Detail and Pipeline (`/employer/hiring`, `/employer/jobs/:jobId`); same hiring module as `/startup/hiring/...` |
| Candidates to review | Applicant pipelines, Candidate Profile (`/employer/jobs/:jobId/applicants/:applicantId`), candidate consent records |
| Match hints | Hiring service (skills and requirements comparison), clearly labeled |
| Interviews | Interviews (`/employer/interviews`), calendar, managed video API |
| Offers | Offers and Offer Detail (`/employer/offers`) |
| Hiring requests and approvals | New Hiring Request (`/employer/requests/new`), Team and Permissions |
| Snapshot charts | Hiring Analytics (`/employer/analytics`) |
| Team activity | Activity and Audit Log (`/employer/activity`) |
| Plan and usage | Billing and Plan (`/employer/billing`), entitlements service |
| Trust and Safety | Trust and Safety (`/employer/trust`), moderation queue |
| Notifications | ERP notification service |
| Role and permissions | Identity and access (role-based and team-role-based, set up by the project owner) |

## 14. CSS tokens

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

## 15. Build order (suggested)

1. Role guard, company and team-role checks, and the employer shell (sidebar, top bar), per Part A9.
2. Company status pills and the verification banners (nothing can publish until verified).
3. KPI cards and the Open jobs list (they need only job and applicant counts).
4. **Needs your attention** and **Candidates to review**, including the 14-day no-ghosting reminders and kind rejection templates.
5. Today's interviews and Offers pending.
6. Next best action logic (start with a simple priority list).
7. Hiring snapshot charts and Team activity, once analytics and the audit log exist.
8. Plan and usage and Trust and tips cards.
9. Empty, loading and error states, then mobile layouts.

**Suggested first release:** greeting and status, next best action, KPI row, Needs your attention, Open jobs and Candidates to review. Add the hiring snapshot, team activity and plan usage once analytics, the audit log and billing exist.

**Reminder for the build:** this page is employer-only and role-based, and what each person sees depends on their team role. Add the guard first, filter all candidate data on the server by company and team role, check consent before showing any optional candidate data, apply blind review everywhere names or photos would appear, keep match hints explained and informational, and never let the page auto-reject or rank by personal characteristics. Get legal advice on hiring, anti-discrimination, data retention and candidate privacy rules before launch.

## Part A9. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `employer` role, as a member of a company account, can open `/employer/...` routes |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup (without an employer account), mentor, investor and job seeker users see a 403 page ("This page is for employers") with a link to their own home; no company or candidate data is fetched or rendered |
| **Multi-role users** | The role switcher changes the sidebar and routes between `/employer/...`, `/startup/...`, `/mentor/...`, `/investor/...` and `/jobseeker/...`. Data never mixes across roles |
| **Company scope** | All data is filtered by the company the user belongs to; a user in more than one company switches companies explicitly, and the server checks membership on every request |
| **Team roles** | The server enforces Owner, Admin, Recruiter, Hiring manager, Interviewer and Viewer permissions on every request: jobs and candidates a person can see, who can send offers, and who sees billing. Interviewers can't see colleagues' scores until they submit their own |
| **Verification gate** | Unverified companies can prepare drafts but can't publish jobs, invite candidates or message candidates; the server enforces this |
| **Candidate data and consent** | Candidate fields are returned only for applications submitted to this company, accepted invitations, or fields the candidate chose to make discoverable; shared practice results require a valid consent record, checked on every request. Recordings, transcripts and delivery analysis are never returned |
| **Blind review** | When enabled for a job, names, photos and school names are removed from responses at the screening stage by the server, not only hidden in the UI |
| **Sensitive actions** | Sending or approving offers, exporting candidate data, changing billing and changing team roles require re-authentication |
| **Admin view** | Admins can view this page read-only for support, with an "Admin view" banner; candidate personal data is masked unless a dispute or safety case allows access and is logged |

Keep permission checks in one place (a guard component or middleware) so the page itself stays simple.
