# Job Seeker Dashboard Design: `/jobseeker/dashboard`

The home screen for a job seeker. It answers four questions at a glance: **What should I do next? Where do my applications stand? Which jobs fit me? Am I ready for interviews?** It pulls together the platform's job-seeker features from your proposal: the AI resume maker, job search and one-click apply, the application tracker with status alerts, AI job recommendations, and the AI interview trainer with its job-readiness score. It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: this page is role-based.**
> This page belongs to the **Job seeker role** only. The project owner will add the role and permission logic, so build the page assuming the signed-in user is acting in the `job seeker` role. All data must be filtered on the server by the signed-in user. Details are in **Part A9**. Do not show this page to startups, mentors, investors or employers.

## 1. Design principles

- **Next step first:** a job seeker is often anxious and short on time. The page opens with one clear next action, then the detail.
- **Honest and calm:** scores and recommendations are guidance, never judgments of the person. No countdown pressure and no "you're falling behind" language.
- **The candidate is in control:** what employers see (resume, practice scores, contact details) is decided by the candidate. The page always shows what is shared.
- **AI is labeled and explained:** every AI suggestion carries an `AI suggestion` label and a short reason. The AI never invents experience and never decides a hiring outcome.
- **Progress, not pressure:** show momentum (what was done this week) and small wins.

## 2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Progress fill, highlights, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | AI suggestion chips, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Offer, hired, positive change |
| `--warning` | `#B7791F` | Due soon, action needed |
| `--error` | `#B42318` | Rejected, errors |

## 3. Typography

- **Page title and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.

| Element | Size / weight |
|---|---|
| Page title | 28px serif 600 |
| Score / KPI number | 32px serif 600 |
| Card title | 16px Inter 600 |
| Body | 14px Inter 400 |
| Caption / meta | 12px Inter 400, `--stone-700` |

Salaries use the user's currency setting (₹ with Indian grouping by default, for example ₹8–12 LPA).

## 4. Layout

### Desktop (≥ 1200px)
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar: search jobs · notifications · profile│
│          ├────────────────────────────────────────────────┤
│          │  Greeting + next best action                   │
│          ├────────────────────────────────────────────────┤
│          │  KPI row (4 cards)                             │
│          ├───────────────────────────────┬────────────────┤
│          │  Recommended jobs (8 col)     │ Readiness score│
│          │  Application pipeline         │ Profile and    │
│          │  Upcoming interviews          │ resume status  │
│          │  Practice suggestions         │ Saved jobs     │
│          │  Alerts and updates           │ Tips           │
└──────────┴───────────────────────────────┴────────────────┘
```
- 12-column grid, 24px gutters, max content width 1200px, page padding 32px.
- Card: white, 1px `--stone-200` border, radius 12px, padding 24px. No heavy shadows.

### Tablet (768–1199px)
Sidebar collapses to a 72px icon rail. The side column drops below the main column. Cards go to two columns.

### Mobile (< 768px)
Single column. The sidebar becomes a bottom tab bar (Home, Jobs, Applications, Practice, More). KPI cards scroll horizontally. The pipeline becomes a horizontal stage selector. A sticky **Search jobs** button sits above the tab bar.

## 5. Navigation

### Sidebar (ink background, ivory text)
- Logo
- **Dashboard** (active: `--ink-soft` background, 3px gold bar at the left)
- Jobs (Search, Startups hiring)
- Saved jobs
- Applications (with count badge)
- Interviews
- Resumes
- Interview practice
- Messages (unread count)
- *Bottom:* Settings, Help, **role switcher** (for multi-role accounts, for example "Job seeker · Founder")

### Top bar
Quick job search field (role or keyword), notification bell (gold dot when unread), profile menu.

## 6. Sections and components

### 6.1 Greeting and next best action
- Greeting: "Good evening, {Name}" with a one-line status ("3 applications active · 1 interview this week").
- **Next best action** card (gold-tint background): a single recommended step chosen from the user's situation, with one primary button. Examples, in priority order:
  1. An interview tomorrow → **Prepare for your interview**
  2. An offer waiting → **Review your offer**
  3. A message or request from an employer → **Reply**
  4. Resume missing or incomplete → **Build your resume**
  5. Profile under 70% complete → **Finish your profile**
  6. No practice done yet → **Try a practice interview**
  7. Otherwise → **Browse new jobs for you**
- Labeled `Suggested`. A **Not now** link hides it for the day.

### 6.2 KPI row (4 cards)
| Card | Example |
|---|---|
| Active applications | 5, with "2 updated this week" |
| Interviews scheduled | 2, next: Thu 11:00 AM |
| Job-readiness score | 68 / 100, ▲ 6 this month |
| Profile strength | 82% complete |

Each card has a caption label, a big serif number, a change chip (arrow plus text) and a small sparkline where there is history. Tooltips show how each number is calculated. The readiness card links to the readiness page; the profile card links to the profile.

### 6.3 Recommended jobs (main card)
- Title: "Jobs picked for you", with the label `AI suggestion` and a small info link, "How recommendations work."
- Up to 6 job cards in a list or two-column grid. Each job card: employer logo, job title, company name with **Verified employer** pill (gold-tint with check), location and work mode (Remote, Hybrid, On-site), employment type, salary range (if the employer shows it), company stage pill for startups (for example `Seed`), posted date, **Why this fit** chip with plain-language reasons ("Matches 5 of your skills · Remote · Within your salary range"), and actions: **View**, **Save** (bookmark), **Apply** (one click if the profile and a resume are ready).
- **Not interested** (overflow) removes the job and improves future recommendations; an optional reason (Wrong role, Salary, Location, Company, Other).
- Footer: **View all recommendations** (links to Alerts and Recommendations) and **Search all jobs**.
- Recommendations never use personal characteristics such as age, gender, religion, caste, nationality or marital status.

### 6.4 Application pipeline
- Title: "Your applications". A horizontal stage strip with counts: **Applied** · **Shortlisted** · **Interview** · **Offer** · **Hired**, plus a small link for **Not selected** and **Withdrawn**.
- Below the strip: the 4 most recently updated applications as rows: employer logo, job title, company, status chip, last update ("Shortlisted · 2 days ago"), next step ("Interview on Thu"), and an **Open** link.
- Status chips: `Applied` (stone), `Shortlisted` (gold-tint), `Interview` (ink outline), `Offer` (success tint), `Hired` (ink fill), `Not selected` (error tint, with a polite note), `Withdrawn` (stone outline).
- Employers who haven't updated an application for over 14 days show a gentle "No update yet" chip, never blame.
- Footer: **View all applications**.

### 6.5 Upcoming interviews
- Title: "Interviews coming up".
- Rows or cards: date and time (time zone shown, default Asia/Kolkata), employer and role, interview type (Phone, Video, On-site, Technical, HR, Founder chat), duration, status chip (`Scheduled`, `Confirmed`, `Reschedule requested`), and actions: **Join** (appears 10 minutes before for platform video), **Prepare**, **Reschedule**.
- **Prepare** opens a prep drawer: the job description highlights, your resume version used, suggested practice session built from this job ("Practice for this interview"), and company notes.
- If an employer proposed time slots, an action card appears: "Choose a time for {Employer}" with the options and **Confirm**.
- Empty: "No interviews scheduled. Practice now so you're ready when one comes."

### 6.6 Practice suggestions (AI interview trainer)
- Title: "Practice", with the `AI suggestion` label.
- A card showing the recommended next practice session: role, interview type, estimated time, reason ("Your last answers lacked structure. Try a STAR-style behavioral round.") and **Start practice**.
- Recent practice: last 3 sessions with date, type and overall score, linking to the feedback report.
- **Weak areas** chips (for example, "Structure", "Confidence"), linking to drills.
- If an interview is booked, a shortcut: **Practice for {Employer}** (builds a session from the real job posting).
- Caption: "Practice results are private unless you choose to share them."

### 6.7 Alerts and updates
Chronological list of up to 6 recent items, each with icon, text, time and a link:
- Application status changes ("{Employer} shortlisted you")
- Employer messages
- New jobs matching saved searches
- Saved jobs expiring soon
- Interview reminders
- Offer expiring
- Resume tips ("Your resume scored 62 on the ATS check")
**View all** opens Notifications.

### 6.8 Side column

#### Job-readiness score card
- Gauge or large number (0–100) with a thin gold arc on a stone track, and the score in serif.
- Breakdown mini-list: Interview practice, Resume strength, Profile completeness, each with a small bar.
- A trend chip ("▲ 6 this month") and **View details** (opens the readiness page).
- Visibility line: "Shared with employers: **Off**" or "**On** for applications you choose," with a **Change** link to Preferences and Privacy. Employers see practice results only if the candidate allows.
- Caption: "A practice guide, not a hiring decision. Employers make their own decisions."

#### Profile and resume status
- Profile completeness bar (gold fill) and a checklist of the next 3 missing items ("Add skills", "Add work experience", "Add a profile photo (optional)"). Each is a link.
- Resume summary: number of resumes, the primary resume, last updated date, ATS score (for example 74 / 100), and **Open resumes**.
- **Tailor a resume** shortcut when saved jobs or recommended jobs exist.

#### Saved jobs
Up to 4 saved jobs with title, company, deadline or "closing soon" chip, and **Apply**. **View all saved jobs**.

#### Tips
One short, rotating tip ("Tailoring your resume to each job usually improves your match"). Dismissible; shown at most once a day.

## 7. Buttons and controls

- **Primary:** ink background, white text, radius 10px, 40px high.
- **Secondary:** white, 1px `--stone-200` border, ink text.
- **Tertiary / link:** `--gold-dark` text, underline on hover.
- **Icon buttons** (save, more): 44×44px hit area.
- **Chips:** radius 999px, 12px text; `AI suggestion` uses `--gold-tint` with `--gold-dark` text and a small sparkle icon.
- Focus: 3px ring `rgba(184,149,90,0.25)` and 1px `--gold` border.

## 8. States

| State | Behavior |
|---|---|
| Loading | Skeleton cards (stone-200 shimmer); no full-page spinner |
| New user (no profile yet) | Hero card "Let's set up your profile" with 3 steps: add your details or import a resume, set your job preferences, try a practice interview. Other cards show friendly empty states |
| No resume yet | Next best action is **Build your resume**; **Apply** buttons explain that a resume is needed and link to the builder |
| Profile incomplete | Recommendations still show but the **Why this fit** chip suggests adding skills to improve matches |
| No recommendations | "We need a bit more information to find good matches." with **Add skills** and **Edit job preferences** |
| No applications | "You haven't applied yet." with **Browse jobs**; the pipeline strip shows zeros |
| No interviews | Empty state with a practice link (6.5) |
| No practice done | Card invites a first session and explains what it is, how long it takes and that results are private |
| Offer received | Gold-tint banner at the top: "You have an offer from {Employer}." with **Review offer** |
| Offer expiring in 48 hours | Warning chip on the offer card and a reminder in alerts |
| Not selected | Application row shows `Not selected` with a kind line ("Thanks for applying. Here are similar roles.") and **Similar jobs**; never framed as failure |
| Employer silent over 14 days | Gentle "No update yet" chip and a **Send a polite follow-up** option |
| Error loading a card | Inline message in that card with **Retry**; other cards stay usable |
| Offline | Cached content with a banner "You're offline. Some information may be out of date." |
| Account paused or suspended | Read-only dashboard with a banner and **Contact support** |

## 9. Role-based behavior

- **Job seeker (signed in):** sees all sections above, with their own data only.
- **Multi-role users:** a founder or mentor who is also a job seeker sees this dashboard only after switching to the Job seeker role. Notifications and unread counts per role appear in the role switcher ("Job seeker 3 · Founder 1").
- **Founder hiring from the same account:** hiring actions stay in `/startup/hiring/...`; this page never mixes employer and candidate data.
- **Other roles:** startup, mentor, investor and employer users get a 403 page ("This page is for job seekers") with a link to their own home.

## 10. Motion

- 150–200ms ease-out for hover and focus; the readiness gauge and progress bars animate once on load (600ms).
- Cards fade in with an 8px rise, staggered 40ms. Score numbers don't count up.
- Respect `prefers-reduced-motion` (no animations, instant render).

## 11. Accessibility

- WCAG 2.1 AA; gold text uses `--gold-dark` on light backgrounds.
- Status and progress are never shown by color alone: always include text or numbers.
- The readiness gauge has a text alternative ("Job-readiness score 68 out of 100").
- Semantic landmarks (`nav`, `main`, `aside`), a skip-to-content link, and a logical tab order.
- The pipeline strip uses a labeled list; moving between stages is keyboard operable.
- Time zones are always shown on interview times; live regions announce new alerts.
- Touch targets at least 44×44px.

## 12. Privacy, fairness and AI rules

- **Candidate consent:** the dashboard shows what employers can see (resume, practice scores, contact details). Practice scores and recordings are shared with an employer only if the candidate allows it. Recordings are private by default and deletable on request.
- **AI labels and reasons:** every recommendation, practice suggestion and resume tip carries an `AI suggestion` label and a "Why" explanation.
- **No invented experience:** AI resume features only reshape facts the candidate provides and flag any claim they can't support.
- **Bias and fairness:** recommendations and scoring never use personal characteristics (age, gender, religion, caste, nationality, marital status, photo). Rubrics are published, and AI feedback is bias-tested. The AI is a practice tool, never a hiring decision-maker.
- **Data use:** candidate data isn't used to train third-party models.
- **No pressure or dark patterns:** no fake scarcity, no countdowns beyond real deadlines set by employers.
- **Safety:** job posts come from verified employers where shown; a **Report this job** option is on every job card for spam, fake postings or requests for fees. A short safety note appears on first use: "Never pay to apply or share bank details."

## 13. Data connections

| Section | Source |
|---|---|
| Profile completeness | Job seeker profile (`/jobseeker/profile`) |
| Resume status and ATS score | AI resume maker (`/jobseeker/resumes`) |
| Recommended jobs and reasons | Jobs module, recommendation service, profile and preferences |
| Application pipeline and status | Application tracker, employer pipelines (`/startup/hiring/:jobId` and employer pages) |
| Interviews | Employer interview scheduling (`/startup/hiring/interviews` and employer pages), calendar |
| Offers | Employer offers (`/startup/hiring/offers` and employer pages) |
| Practice, scores and weak areas | AI interview trainer (`/jobseeker/practice`, `/jobseeker/readiness`) |
| Readiness score | Practice results, resume strength, profile completeness |
| Saved jobs and alerts | Saved jobs, saved searches, notification service |
| Sharing consent | Preferences and Privacy (`/jobseeker/preferences`) |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

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
}
```

## 15. Build order (suggested)

1. Role guard and job seeker shell (sidebar, top bar), per Part A9 (see role-based table in section 9).
2. KPI cards and the application pipeline strip (they need only application data).
3. Recommended jobs card (start with simple skill and location matching, add reasons).
4. Upcoming interviews and alerts.
5. Profile and resume status card, saved jobs.
6. Next best action logic (a simple priority list to begin with).
7. Readiness score card and practice suggestions, once the interview trainer exists.
8. Empty, loading and error states, then mobile layouts.

**Suggested first release:** greeting and next best action, KPI row, recommended jobs, application pipeline and alerts. Add readiness and practice cards when the AI interview trainer ships.

**Reminder for the build:** this page is job-seeker-only and role-based. Add the guard first, filter all data on the server by the signed-in user, check consent before sharing any practice data with employers, and label every AI suggestion with a reason.

## Part A9. Role-based access (to be implemented by the project owner)

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `job seeker` role can open `/jobseeker/...` routes |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, investor and employer users see a 403 page ("This page is for job seekers") with a link to their own home; no candidate data is fetched or rendered |
| **Multi-role users** | The role switcher changes the sidebar and routes between `/jobseeker/...`, `/startup/...`, `/mentor/...` and `/investor/...`. Data never mixes across roles |
| **Own data only** | Applications, resumes, practice results, offers and preferences are returned only for the signed-in user; the server filters by user ID, never trusting an ID in the URL |
| **Employer visibility** | Employers see candidate data only for applications the candidate submitted, or fields the candidate chose to share; the server enforces consent, not just the UI |
| **Practice data** | Practice scores and recordings are private by default; sharing requires the candidate's explicit consent, checked on the server |
| **Admin view** | Admins can view this page read-only for support, with an "Admin view" banner; access is logged |

Keep permission checks in one place (a guard component or middleware) so the page itself stays simple.
