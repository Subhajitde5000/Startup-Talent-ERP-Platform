# Job Seeker: Finding and Applying to Jobs Pages Design

The pages where a job seeker searches for jobs, reads about the employer, saves what looks interesting, gets alerts and AI recommendations, and applies with one click. They are the job seeker side of your proposal's Jobs module: search and filter by role, location, remote, salary and company stage; one-click apply; AI job recommendations; and direct access to hiring startups. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Most pages in this file belong to the **Job seeker role**. The project owner will add the role and permission logic, so build each page assuming the signed-in user is acting in the `job seeker` role. A few pages (Job Search, Job Detail, Company Page, Startups Hiring) can also be opened by signed-out visitors in a limited, public form so people can browse before registering; the public and signed-in rules are in **Part A9**. Do not show the signed-in features to startups, mentors, investors or employers.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Job Search | `/jobseeker/jobs` | Search and filter by role, location, remote, salary and company stage |
| 2 | Job Detail | `/jobseeker/jobs/:jobId` | Description, salary, screening questions, employer summary; save or apply |
| 3 | Company Page | `/jobseeker/companies/:companyId` | Employer or startup page with verified badge and open jobs |
| 4 | Startups Hiring | `/jobseeker/startups` | Direct access to hiring startups, filtered by stage and sector |
| 5 | Saved Jobs | `/jobseeker/saved` | Saved jobs and companies, with notes and reminders |
| 6 | Alerts and Recommendations | `/jobseeker/alerts` | Saved searches, alerts, and AI job recommendations with reasons |
| 7 | Apply | `/jobseeker/jobs/:jobId/apply` | One-click apply: choose a resume, answer screening questions, review, submit |

Related pages: the employer side is in `startup-hiring-design.md` (Hiring Overview, Job Editor, Job Detail and Applicant Pipeline, Candidate Profile, Employer Page and Verification). The pages here show the same job records from the candidate's point of view. The job seeker home is in `jobseeker-dashboard-design.md`.

---

# Part A. Shared foundations

## A1. Design principles

- **Find fast, understand fully:** a job seeker should know what the job is, what it pays, where it is and whether it fits in a few seconds.
- **Transparent and honest:** salary, location, work mode and company stage are shown clearly when the employer provides them. Missing information is shown as "Not provided," never guessed.
- **Trust first:** verified employers are marked, every job can be reported, and the page warns against paying to apply.
- **Candidate in control:** the candidate chooses which resume to send, what to share and when to apply. Nothing is shared with an employer before the candidate submits an application (except what the candidate has chosen to make discoverable).
- **AI is labeled and explained:** recommendations and fit hints carry an `AI suggestion` label with plain reasons. The AI never decides who gets hired.
- **Calm tone:** no fake urgency, no "X people are viewing this" pressure.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Highlights, progress fill, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | AI suggestion chips, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Verified, applied, positive |
| `--warning` | `#B7791F` | Closing soon, action needed |
| `--error` | `#B42318` | Errors, closed or removed |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.
- Page title 28px serif; job title (detail) 28px serif; card title 16px Inter 600; body 14–15px; caption 12px `--stone-700`. Salaries use the user's currency setting (₹ with Indian grouping by default, for example ₹8–12 LPA), and show the period (per year, per month).

## A4. Shared layout

Desktop (≥ 1200px): the job seeker sidebar and top bar from the dashboard, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar (Home, Jobs, Applications, Practice, More), filters in a bottom sheet, sticky bottom **Apply** or **Search** button.

### Public (signed-out) layout
A simple top bar with the logo, **Jobs**, **Startups hiring**, **Sign in** and **Create account**. No sidebar. The same page content appears with limits (see Part A9). Save, Apply and recommendations prompt sign-in.

## A5. Shared components

### Job card
Employer logo (48px), job title, company name with **Verified employer** pill (gold-tint with check), location and work mode (`Remote`, `Hybrid`, `On-site`), employment type (full-time, part-time, contract, internship), salary range (if shown), company stage pill for startups (for example `Seed`, `Early revenue`), posted date ("Posted 3 days ago"), applicants badge only if the employer enabled it, and a **Why this fit** chip when the user is signed in (with the `AI suggestion` label). Actions: **Save** (bookmark icon), **Apply**, **Not interested** (overflow), **Report**. Applied jobs show an `Applied` chip with the date instead of **Apply**.

### Company mini-card
Logo, name, **Verified employer** pill, industry, size, location, stage (for startups), number of open jobs, **View company**, **Follow**.

### Status chips
`Open` (success tint), `Closing soon` (warning tint, within 7 days of the deadline), `Closed` (stone), `Applied` (ink outline), `Saved` (gold-tint), `Draft application` (stone outline), `Removed by employer` (stone outline).

### AI suggestion label
A small `AI suggestion` pill (gold-tint with a sparkle icon) with a "Why?" link that opens a short explanation. Reasons are written in plain language and use only the candidate's job-related information (skills, experience, preferences).

### Salary and benefits display
Range with period, "Not shown" when hidden, and a small note when the employer shows equity ("Equity offered"). Never guesses a salary.

### Safety strip
A small notice on job pages: "Never pay to apply or share bank details. Report suspicious jobs." Link: **Safety tips**.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton job cards and detail blocks |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave for notes and application drafts, "Saved · just now" |
| Error | Inline message with **Retry**; the rest of the page stays usable |
| Offline | Cached results with a banner "You're offline. Some information may be out of date."; applying is disabled until reconnected |
| Account paused or suspended | Read-only pages with a banner and **Contact support**; applying disabled |
| Profile incomplete | Soft banner on job pages: "Complete your profile for better matches." with **Finish profile**; applying still works if a resume exists |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; drawers slide in over 200ms. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status always uses text and icon, not color alone.
- Filters, results and forms are fully keyboard operable; the filter panel is a labeled form with a clear **Reset** button.
- Save buttons are toggles with `aria-pressed`; results announce counts ("42 jobs found") in a live region.
- Time zones and deadlines are stated in text. Touch targets at least 44×44px. Modals and drawers trap focus and return it to the trigger on close.

## A8. Privacy, fairness and conduct rules

- **Nothing is sent before you apply.** Viewing, saving and searching don't share the candidate's identity with employers. (Employers may see anonymous aggregate view counts.)
- **Discoverability is opt-in.** The candidate decides in Preferences and Privacy whether employers can find them in talent search, and which fields are visible.
- **Resume and data sharing:** an application shares only the chosen resume, answers to screening questions and, if the candidate allows it, the job-readiness or practice scores. Contact details are shared only when the candidate applies or accepts an employer's invitation.
- **No discrimination:** search and recommendations never filter or rank by personal characteristics (age, gender, religion, caste, nationality, marital status, photo). Employers can't add such criteria, and screening questions that ask for them are blocked.
- **Fraud protection:** job posts come from employers verified before publishing. Posts asking for fees, off-platform contact details or payments are blocked or flagged; every job has **Report this job**.
- **Fair notice of AI:** recommendations and fit hints are suggestions, with reasons. Applying is always the candidate's choice, and the employer makes the hiring decision.
- **Data handling:** candidate data is encrypted in transit and at rest and follows the platform's privacy policy and applicable law (for example, India's DPDP Act). Candidate data isn't used to train third-party models.

## A9. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Signed-out visitors** | May open Job Search, Job Detail, Company Page and Startups Hiring in a limited public form: no personalized fit hints, no saved state, no screening questions shown beyond a count, and **Save** and **Apply** prompt sign-in. Public pages are search-engine friendly. The server returns only public job and company fields |
| **Allowed role (full features)** | Only users acting in the `job seeker` role can use Save, Apply, Saved Jobs, Alerts and Recommendations, and see personalized fit hints |
| **Not signed in on protected pages** | Saved Jobs, Alerts and Recommendations and Apply redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, investor and employer users see a 403 page ("This page is for job seekers") on protected pages, with a link to their own home. They may browse public job pages but can't apply or save |
| **Multi-role users** | A founder, mentor or investor who is also a job seeker switches roles via the role switcher; applying always happens in the Job seeker role. A founder can't apply to their own startup's job from the same account (the server blocks it and explains why) |
| **Own data only** | Saved jobs, alerts, drafts, applications and preferences are returned only for the signed-in user; the server filters by user ID, never trusting an ID in the URL |
| **Job visibility** | Draft, paused, closed or private-link jobs are returned only where the rules allow (link-only jobs open with the link; closed jobs show a "Closed" page with similar jobs). Unverified employers' jobs are not shown |
| **Application limits** | One active application per job per candidate; daily application limits per plan to prevent spam; blocked candidates can't apply to the employer that blocked them |
| **Employer visibility** | Employers see candidate data only for submitted applications or fields the candidate chose to make discoverable; the server enforces consent |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner; access is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Job Search: `/jobseeker/jobs`

## B1. Purpose
The main way to find jobs. Fast filters, clear results and quick actions, with startups and companies in one list.

## B2. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Search bar: role · location · [Search]        │
│          ├────────────────────────────────────────────────┤
│          │  Active filter chips · sort · save search      │
│          ├──────────┬────────────────────┬────────────────┤
│          │ Filters  │ Results list       │ Job preview    │
│          │ 280px    │ (cards)            │ drawer         │
└──────────┴──────────┴────────────────────┴────────────────┘
```
On tablet the preview opens as a drawer; on mobile each result opens Job Detail.

## B3. Search bar
- **What:** job title, skill or company (with suggestions as you type: recent searches, popular roles, skills).
- **Where:** city, region or "Remote" (suggestions for places; "Use my location" is optional and asks permission).
- **Search** button (primary). Pressing Enter also searches.
- Recent searches appear in a dropdown with **Clear**.

## B4. Filters (left panel, collapsible groups)

| Group | Options |
|---|---|
| **Job type** | Full-time, part-time, contract, internship, freelance |
| **Work mode** | Remote, hybrid, on-site |
| **Location** | City or region, distance from a place (for on-site and hybrid), time zone for remote |
| **Salary** | Range slider with period (per year or per month) and a toggle "Include jobs without a salary" (off by default) |
| **Experience level** | Entry (0–2 years), mid (2–5), senior (5+), lead or manager |
| **Role category** | Engineering, product, design, marketing, sales, operations, finance, HR, customer success, data, other |
| **Skills** | Multi-select with search; "Match all" or "Match any" toggle |
| **Company stage** | Idea, prototype, early revenue, mature startup; established company |
| **Company type** | Startup on the platform, outside company |
| **Industry** | Multi-select |
| **Company size** | 1–10, 11–50, 51–200, 200+ |
| **Employer** | Verified employers only (default on), companies I follow |
| **Posted** | Last 24 hours, 7 days, 30 days |
| **Benefits and equity** | Equity offered, health insurance, flexible hours, learning budget (as employers list them) |
| **Other** | Easy apply (one click with your resume), hasn't been applied to by me, hide jobs I've seen |

Not offered: any filter that depends on personal characteristics (age, gender, religion, caste, nationality, marital status). Employers can't set such criteria either.

A **Reset all** link and a live result count ("128 jobs") update as filters change. On mobile, filters open in a bottom sheet with **Show 128 jobs**.

## B5. Results
- **Sort:** Best match (signed-in users, labeled `AI suggestion`), Newest, Salary high to low, Closing soon.
- **View:** list of job cards (A5). Cards show a **Why this fit** chip for signed-in users.
- Mark startups clearly with the company stage pill and the **Verified employer** pill.
- Infinite scroll with a "Load more" fallback and a footer count ("Showing 40 of 128").
- Already applied jobs show the `Applied` chip; saved ones show a filled bookmark.
- A **Save this search** button creates an alert (Part G).

## B6. Preview drawer (520px, desktop)
Opens on card click: job title, company, key facts (location, mode, type, salary, posted), a short description, top required skills with those the user already has highlighted in gold-tint, **Why this fit** (signed in), and **View full job**, **Save**, **Apply**. Arrow keys move to the next or previous result.

## B7. States
- **First visit, no search yet:** a short hero with popular roles and "Jobs picked for you" if signed in with a profile; otherwise a prompt to search or browse startups.
- **No results:** "No jobs match your search." with suggestions to remove filters ("Remove 'Remote'"), similar roles, and **Create an alert** so the user is told when a match appears.
- **Too many results:** hint to narrow by location, role or salary.
- **Search failed:** inline **Retry** with filters kept.
- **Location denied:** the message "Location is off. Type a city instead."
- **Signed out:** results are visible; fit hints and Save prompt sign-in; banner "Sign in to save jobs and get recommendations."

---

# Part C. Job Detail: `/jobseeker/jobs/:jobId`

## C1. Purpose
Everything a candidate needs to decide whether to apply: the role, pay, requirements, what the employer is like, the screening questions and how the process works.

## C2. Layout
Left main column (8 col), right sticky panel (4 col). A breadcrumb ("Jobs / {Role}") and a **Back to results** link that keeps the search state.

### Header
Employer logo, job title (28px serif), company name (link to Company Page) with **Verified employer** pill, location and work mode, employment type, salary range, posted date, closing date ("Applications close 28 Nov" with a warning chip when within 7 days), company stage pill, and `Open` or `Closed` status chip. Actions: **Apply** (primary), **Save**, **Share** (copy link), overflow (**Report this job**, **Not interested**).

## C3. Main column sections
1. **About the role:** the employer's description.
2. **What you'll do:** responsibilities.
3. **What we're looking for:** requirements, split into **Must have** and **Nice to have**. Skills the candidate already has show a check in gold-tint (signed in), with a short summary "You match 6 of 8 must-haves" labeled `AI suggestion` with a **Why?** link. Missing skills are listed neutrally ("Not on your profile yet"), never as failings, with **Add to profile** and **See learning ideas** (optional).
4. **Compensation and benefits:** salary range and period, equity (if offered), benefits tags, and a note when the employer hides the salary ("Not shown by the employer").
5. **Hiring process:** the stages the employer set (for example, Screening call → Technical → Founder chat → Offer), expected timeline if provided, and whether interviews are remote. Shown so candidates know what to expect.
6. **Screening questions preview:** the number and type of questions (for example, "4 questions, 1 file upload") so the candidate can prepare. Full questions appear in the Apply flow.
7. **About the company:** short employer summary, size, location, industry, stage, funding stage (if shared), culture and values, team highlights, with a link to the Company Page. For startups on the platform: stage, **Investment Ready** badge if the startup chose to show it, and mentors (only if the startup shares them).
8. **Similar jobs:** up to 4 cards.

## C4. Right sticky panel
- **Apply card:** **Apply** (primary), **Save**, and a line "Applications close {date}." If the user has applied: `Applied on {date}` with **View application**.
- **Quick facts:** job type, mode, location, experience level, salary, openings, posted date, reference ID.
- **Your fit** (signed in): a compact summary of matched must-haves, preferences matched (location, mode, salary), and what's missing, labeled `AI suggestion` with **Why?**.
- **Tailor your resume:** a prompt "Tailor your resume to this job" opening the resume tailoring page for this job (shows only if a resume exists).
- **Practice for this job:** **Start a practice interview** built from this job posting.
- **Hiring team:** the hiring manager's name and role if the employer chooses to show it.
- **Safety strip:** A5, with **Report this job** link.

## C5. Public (signed-out) version
Shows header, about, requirements, compensation, hiring process, company summary and similar jobs. Hides your-fit, tailor and practice cards and replaces the apply card with "Sign in or create an account to apply." The page includes structured data for search engines and a clean share preview.

## C6. States
- **Closed job:** banner "This job is closed." with similar jobs and **Create an alert for this role**; Apply is removed.
- **Closing soon:** warning chip and the closing date.
- **Paused by the employer:** "This job is paused. You can save it and we'll tell you when it reopens." with **Save**.
- **Removed (policy or employer):** a neutral page "This job is no longer available." with similar jobs.
- **Already applied:** chip and **View application**; Apply replaced.
- **Draft application exists:** **Continue your application** with the saved progress.
- **Blocked by the employer:** the job doesn't appear in your results; direct links show "This job is no longer available."
- **Your own startup's job (founder account):** banner "This is your startup's job" with **Open in hiring**; applying disabled.
- **Not verified employer (should not occur):** the server hides it.
- **Loading error:** inline **Retry**.

---

# Part D. Company Page: `/jobseeker/companies/:companyId`

## D1. Purpose
Helps a candidate decide whether they want to work for an employer: who they are, what they do, how they hire and which jobs are open. It is the public face built in the employer's **Employer Page and Verification** settings.

## D2. Layout
Cover band (solid ink with a thin gold rule, or the employer's own cover), header, tabs, then content with a right side column. Tabs: **Overview** · **Jobs** · **Team and culture** · **Hiring process**.

### Header
Logo (96px, overlapping the cover), company name, tagline, **Verified employer** pill, industry, size, location(s), website link, founded year, stage pill (for startups), **Investment Ready** badge (if the startup chose to show it). Actions: **Follow**, **View open jobs**, overflow (**Share**, **Report**).

## D3. Tabs

### Overview
- **About us** and mission.
- **What we do:** product or service summary, customers or markets (as the employer wrote).
- **Highlights:** up to four tiles (for example, team size, founded, funding stage, locations), each only if the employer chose to show it.
- **For startups on the platform:** stage and a short "where we are" line, optional traction highlights the startup made public, and mentors or investors the startup chose to show.
- **Benefits and perks.**
- **Reviews or insights** (if the platform offers verified candidate feedback later): shown only with enough responses and clearly labeled.

### Jobs
List of open jobs (job cards) with filters (role, location, type) and a count. Closed jobs aren't listed. Empty: "No open jobs right now. Follow this company to be told when they hire."

### Team and culture
Founders and key people (only those the employer chose to show), team photos (optional), values, working style, remote policy, office locations, learning and growth, diversity and inclusion statements (as written by the employer).

### Hiring process
The employer's typical process and timeline, how they communicate, interview formats, and a note about candidate respect ("We reply to every applicant within 14 days"), if the employer set it. Candidates who applied previously may see "Typical response time" (aggregated, shown only with enough data).

## D4. Right side column
- **Open jobs:** top 3 with **View all**.
- **Follow** card: "Follow to get alerts when {Company} posts jobs."
- **Contact and links:** website and public social links; no personal contact details.
- **Verification:** what "Verified employer" means (business checks done by the platform), with the date of last verification.
- **Safety strip** and **Report this company**.

## D5. States
- **Unverified or suspended employer:** the page isn't shown; a neutral "This page isn't available."
- **Sparse page:** sections with no content are hidden, not left empty.
- **No open jobs:** message above plus **Follow**.
- **Following:** the button shows `Following` with an option to unfollow; alerts are controlled in Alerts and Recommendations.
- **Signed out:** **Follow** prompts sign-in.
- **Startup closed hiring or changed visibility:** page shows the profile but not jobs.

---

# Part E. Startups Hiring: `/jobseeker/startups`

## E1. Purpose
Direct access to hiring startups on the platform, as your proposal describes ("direct access to hiring startups"). It is for people who want to join early-stage companies and like to browse by stage and sector rather than by job title.

## E2. Layout
Filters on the left (280px), results in the center, a short intro banner at the top: "Startups on the platform that are hiring now. Each one is verified." A toggle at the top switches between **Startups** and **Jobs at startups**.

## E3. Filters
Stage (Idea, Prototype, Early revenue, Mature), sector, location and remote policy, team size, **Investment Ready** (a startup the mentors have verified as investment ready; labeled neutrally and explained), role categories they are hiring for, equity offered, "Hiring in the last 14 days," "Companies I follow."

## E4. Startup card
Logo, name, **Verified startup** pill, one-liner, stage pill, sector chips, location and remote policy, team size, **Investment Ready** badge (if shown), open roles count with the top 3 role titles, funding stage (if the startup chose to show it), and a **Why this fit** chip (signed in; `AI suggestion`) based on the candidate's skills, interests and preferences. Actions: **View startup** (opens Company Page), **View jobs**, **Follow**.

## E5. Learning about startup roles
A short collapsible guide: "What it's like to work at an early-stage startup" (broader responsibilities, equity, risk, pace), with a neutral tone. A **Questions to ask a startup** checklist (runway, mentors, funding plans, equity terms) helps candidates make informed decisions.

## E6. Sort
Best fit, Newest hiring, Most open roles, Stage (earliest to latest).

## E7. States
- **No startups hiring for filters:** suggestions to widen filters and **Create an alert**.
- **Startup stops hiring:** the card disappears from the list; followers are told only when jobs reopen.
- **Signed out:** browsing works; **Follow** and fit hints prompt sign-in.
- **Startup hid its profile:** not shown.
- **Loading error:** inline **Retry**.

---

# Part F. Saved Jobs: `/jobseeker/saved`

## F1. Purpose
The candidate's shortlist of jobs and companies to come back to, with private notes and reminders.

## F2. Layout
Header with title and counts. Tabs: **Jobs** · **Companies** · **Closed**. Toolbar: search, filters (status, closing soon, work mode, location, company), sort (Recently saved, Closing soon, Salary, Company). View toggle (Cards or Table).

## F3. Saved job item
Job card (A5) plus:
- Saved date and a status chip (`Open`, `Closing soon`, `Closed`, `Applied`)
- Private note (first line; click to edit; "Private to you")
- Reminder ("Apply by Fri") with a bell icon
- Tags (for example, "Dream job", "Backup") up to 5, editable
- Actions: **Apply**, **Tailor resume**, **Remove**, overflow (**Add reminder**, **Add tag**, **Share link**)

Table view columns: job, company, location, salary, closing date, status, tags, note, actions.

## F4. Saved companies
Company mini-cards with **Following** status, the number of open jobs and a "New jobs since your last visit" chip. Actions: **View company**, **Unfollow**.

## F5. Closed tab
Jobs that closed or were removed since being saved, with the closing date and similar open jobs. **Remove** and **Find similar** actions. Notes stay so the candidate keeps their thinking.

## F6. Bulk actions
Select multiple: **Add tag**, **Remove**, **Set reminder**, **Compare** (a simple side-by-side of up to 4 jobs on salary, location, mode, requirements and company stage).

## F7. States
- **Empty:** "You haven't saved any jobs yet. Tap the bookmark on a job to keep it here." with **Search jobs**.
- **Closing soon:** gold-tint banner with the count and **Apply to these first**.
- **Job closed:** the card shows `Closed` and is moved to the Closed tab after 3 days.
- **Reminder due:** notification and a chip on the card.
- **Limit reached:** if a plan limits saved jobs, a message with the upgrade link; existing items stay.
- **Applied:** the card shows `Applied` with **View application**.

---

# Part G. Alerts and Recommendations: `/jobseeker/alerts`

## G1. Purpose
Turn searches into alerts, manage which companies and roles the candidate follows, and see the AI job recommendations with clear reasons.

## G2. Layout
Tabs: **Recommended for you** · **Saved searches** · **Alerts feed** · **Following** · **Preferences**. A short note at the top: "Recommendations are suggestions based on your profile and preferences. You decide what to apply to."

## G3. Recommended for you
- A list of job cards (A5) ranked by fit, each with the `AI suggestion` label and a **Why this fit** expander: matched skills, matched preferences (location, mode, salary), experience level, and growth areas ("Asks for Kubernetes, which isn't on your profile").
- **Feedback on each card:** **Not interested** (with optional reason chips: Wrong role, Salary, Location, Company, Already applied elsewhere, Other) and **More like this**. Feedback is used to improve the next suggestions.
- **Transparency panel (collapsible):** "How recommendations work": uses your skills, experience, job preferences and the jobs you save or skip. It never uses personal characteristics. You can turn recommendations off in Preferences.
- **Refresh** button and "Updated today at 6:00 AM" caption.

## G4. Saved searches
- List of saved searches as cards: name (editable), criteria chips, new jobs since the last visit (gold chip), total matches, alert settings summary ("Daily email · In-app"), last run time. Actions: **View results**, **Edit**, **Pause alerts**, **Duplicate**, **Delete**.
- **+ New saved search** opens Job Search with the filters and a **Save search** button.
- **Create or edit saved search (drawer):** name, filters (same as Job Search), alerts (channels: In-app, Email, Push; frequency: Instant, Daily digest, Weekly digest; quiet hours from Settings).
- Limits: a number of saved searches per plan, with the count and an upgrade link when full.

## G5. Alerts feed
Chronological list of alerts across searches and followed companies: "{Company} posted '{Role}'", "5 new jobs match 'Remote product designer'", "A job you saved closes in 3 days". Each row: job mini-card or text, which search or follow caused it, time, **View**, **Save**, **Apply**, **Mute this search**. Grouped by day.

## G6. Following
- **Companies I follow:** company mini-cards with open jobs counts and **Unfollow**.
- **Roles I follow:** roles or skills the candidate tracks (for example, "UX researcher") with alert settings.
- **New from followed companies:** a short feed of new jobs.

## G7. Preferences (summary tab)
A summary of the job preferences feeding recommendations (target roles, locations, work mode, salary expectation, company stage preferences, industries, deal-breakers) with **Edit** (links to `/jobseeker/preferences`). A toggle **Use my practice results to suggest jobs** (off by default; uses interview practice insights only for the candidate's own suggestions, never shared with employers unless the candidate chooses). A toggle **Turn off recommendations**.

## G8. States
- **No recommendations yet:** "Add your skills and job preferences to get recommendations." with **Edit profile** and **Edit preferences**.
- **Few matches:** "We found only a few matches. Try widening your location or roles."
- **No saved searches:** "Save a search to get alerts when new jobs appear." with **Create saved search** and suggested searches based on the profile.
- **No alerts:** "No new alerts. We'll let you know when something matches."
- **Alert fatigue:** if there are more than 20 alerts a day, a prompt to switch to a daily digest.
- **Paused alerts:** chip and **Resume**.
- **Limit reached:** message with the plan upgrade link.
- **Recommendations off:** the tab explains and shows **Turn on**.

---

# Part H. Apply: `/jobseeker/jobs/:jobId/apply`

## H1. Purpose
A short, clear flow that lets a candidate apply with one click when everything is ready, or in a few simple steps when it isn't. The candidate always reviews what will be shared.

## H2. Layout
A focused page: a slim header with the job title and company, a step indicator, the step content (max width 720px), and a right summary panel on desktop ("Applying to {Role} at {Company}"). No distracting navigation; a **Cancel** link returns to the job and keeps a draft.

### Steps
**1. Resume** → **2. Details and questions** → **3. Review and submit** → **Done**. If everything is prefilled, the **Easy apply** path shows a single review screen with a **Submit application** button (one click after review).

## H3. Step 1: Resume
- Choose a resume from **My resumes** (cards with name, target role, last updated, ATS score). The **suggested resume** (best for this role) is preselected and labeled `AI suggestion` with the reason.
- **Tailor this resume for the job:** opens the tailoring flow and returns here with the new version.
- **Upload a different file:** PDF or DOCX (up to 10 MB), virus scanned.
- **Build a resume:** if none exists, a link to the resume builder.
- A preview of the selected resume (view-only) and the ATS score with any flagged issues ("Add a skills section").

## H4. Step 2: Details and questions
- **Contact details:** name, email, phone (prefilled from the profile; editable). Contact details are shared with the employer on submit.
- **Links:** LinkedIn, portfolio, GitHub (optional).
- **Screening questions:** the employer's questions (up to 8): short text, long text, yes or no, multiple choice, file upload. Required ones are marked. Character limits shown. **Save and continue later** keeps a draft.
- **Cover note (optional):** short note to the employer (up to 1,000 characters), with an `AI suggestion` option "Suggest a draft" that uses only facts from the profile and resume, and leaves the candidate in full control to edit.
- **Work authorization and notice period** (only where the employer asks): neutral fields, with the note that the platform doesn't use them to rank candidates.
- **Availability and salary expectation** (optional; only if the employer asks): the candidate decides what to enter.
- **Interview practice results:** a toggle "Share my job-readiness score with {Company}" (off by default), with a link to what would be shared and the rubric. Only the candidate's consent turns it on, per the proposal.
- **Blind review note** (if the employer uses blind review at screening): "Your name and photo may be hidden at first screening."

## H5. Step 3: Review and submit
- **What will be shared:** a clear list: resume (name and version), contact details, answers, cover note, links, and whether the readiness score is shared.
- **Edit** links next to each section.
- **Consent checkboxes:** "I confirm the information is accurate" and "I agree to share this information with {Company} for this application." Links to the privacy notice.
- **Your information stays private from other employers.**
- **Submit application** (primary).

## H6. Done
Confirmation card: "Application sent to {Company}." with the date and time, a copy of what was shared (**Download a summary**), what happens next (the employer's hiring process stages and typical response time if shown), and next actions: **View application**, **Practice for this job**, **Find similar jobs**. The application appears in the Application Tracker as `Applied`; the employer is notified. A confirmation email is sent.

## H7. Rules
- One active application per job. A withdrawn application can be re-submitted only if the employer allows it.
- The candidate can **Withdraw** later from the application page.
- A daily application limit per plan prevents bulk spam; the page shows the remaining count only when it is near the limit.
- The AI never fills answers for the candidate without showing them and requiring confirmation. It only suggests wording from facts the candidate provided and flags claims it can't support.
- Screening questions that ask for protected personal characteristics are blocked at job creation, so they should not appear; if one does, a **Report this question** link is shown.
- Applying through the platform is free. If the job or any message asks for a fee, the page shows a warning and **Report this job**.

## H8. States
- **No resume:** the page shows "You need a resume to apply." with **Build a resume**, **Upload a file** and **Import from my profile**.
- **Draft saved:** "Draft saved · just now"; **Continue your application** appears on the job page.
- **Missing required answers:** inline messages; the first missing field receives focus on submit.
- **Job closed while applying:** "This job closed. Your draft is saved." with similar jobs.
- **Duplicate application:** "You've already applied to this job." with **View application**.
- **Upload error:** message with the reason (type, size, virus scan) and **Retry**.
- **Submit failure:** inline error with **Retry**; the draft stays intact; no duplicate submission.
- **Daily limit reached:** message with the reset time and plan upgrade link.
- **Employer blocked you:** the apply page isn't available; the job doesn't appear.
- **Founder applying to own startup:** blocked with explanation (A9).
- **Offline:** drafts save locally; submit is disabled until reconnected.
- **Account incomplete (no verified email):** a prompt to verify the email before submitting.

---

# Part I. Notifications for these pages

| Event | Channel |
|---|---|
| New jobs matching a saved search (instant, daily or weekly) | In-app, email, push per alert settings |
| New job from a followed company | In-app, email |
| Saved job closing in 3 days and 1 day | In-app, email |
| Saved job closed or removed | In-app |
| Reminder due on a saved job | In-app, email |
| Application submitted (confirmation) | Email, in-app |
| Draft application not submitted for 3 days (once) | In-app |
| Daily recommendations summary | In-app, email (digest) |
| Followed company opens a new role | In-app |

Job seekers can mute, filter or set digests in Settings. Security alerts cannot be muted. Notification text never includes salary or personal details in email subjects.

---

# Part J. Data and validation

| Field | Rule |
|---|---|
| Search query | Up to 100 characters; special characters handled safely |
| Salary filter | Minimum less than maximum; period required; currency from settings |
| Saved searches | Name 3–60 characters, unique per user; limit per plan |
| Saved jobs | Limit per plan; note up to 2,000 characters; up to 5 tags of 30 characters each |
| Compare | Up to 4 jobs |
| Recommendation feedback | Optional reason chips; stored privately and used only to tune suggestions |
| Resume upload | PDF or DOCX, up to 10 MB, virus scanned |
| Contact details | Valid email; phone format validated; verified email required before first application |
| Screening answers | Required ones filled; per-question limits (short text 300 characters, long text 2,000, file up to 10 MB) |
| Cover note | Up to 1,000 characters |
| Application | One active per job; daily limit per plan; can't apply to a job the candidate's own startup posted |
| Readiness score sharing | Requires explicit consent for each application; revocable before the employer views it |

**Audit log:** applications (what was shared and when), consent changes, withdrawals, saved search changes and blocks, each with user and time. Candidates can download their application history from Settings.

---

# Part K. Data connections

| Feature | Connected to |
|---|---|
| Jobs, company pages, hiring stages, screening questions | Jobs module; employer's Job Editor and Employer Page (`/startup/hiring/jobs/...`, `/startup/hiring/employer-page`) |
| Verified employer badge | Admin console, employer verification |
| Startup stage, Investment Ready badge, mentors (if shared) | Startup profile and readiness (`/startup/profile`, `/startup/readiness`) |
| Search and filters | Search service (full-text plus embeddings) |
| Recommendations and fit reasons | Recommendation service, job seeker profile and preferences |
| Resume selection, tailoring and ATS score | AI resume maker (`/jobseeker/resumes`, tailoring, ATS check) |
| Practice for a job | AI interview trainer (`/jobseeker/practice/new`) |
| Applications | Application tracker; employer pipelines (`/startup/hiring/:jobId`) |
| Alerts, follows, digests | ERP notification service |
| Consent and sharing settings | Preferences and Privacy (`/jobseeker/preferences`) |
| Reports and safety | Admin console, moderation queue |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part L. CSS tokens

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

# Part M. Build order (suggested)

1. Role guard, public vs signed-in rules and job seeker shell (Part A9).
2. Shared components: job card, company mini-card, status chips, safety strip, AI suggestion label.
3. **Job Search** (full-text first; filters; then Best match) and **Job Detail**, including the public versions.
4. **Apply** (resume choice, screening questions, review and submit, consent) connected to the employer's pipeline. This is the core loop.
5. **Saved Jobs** and basic **saved searches with alerts**.
6. **Company Page**.
7. **Startups Hiring**, once enough startups are hiring.
8. **Recommendations** with reasons and feedback, then the transparency panel.
9. Notifications, compare, reminders, digests.
10. Empty, loading and error states, then mobile layouts.

**Suggested first release:** Job Search, Job Detail, Apply and Saved Jobs, with the Company Page and simple alerts. Add Startups Hiring and Recommendations once there are enough jobs and startups hiring. Your proposal recommends launching with startups and mentors first and recruiting a small set of anchor employers early, so make sure employer verification and the job editor ship before these pages open to candidates.

**Reminder for the build:** the protected pages are job-seeker-only and role-based, with a limited public version of Job Search, Job Detail, Company Page and Startups Hiring. Add the guard first, filter all personal data on the server by the signed-in user, check consent before sharing anything with an employer, block discriminatory criteria, label every AI suggestion with a reason, and keep the report and safety options on every job.
