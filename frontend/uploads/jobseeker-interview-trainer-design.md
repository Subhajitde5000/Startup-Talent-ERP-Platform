# Job Seeker: AI Interview Trainer Pages Design

The pages where a job seeker practices interviews with an AI interviewer, gets specific feedback, and tracks progress toward being job-ready. They implement the AI interview training section of your proposal: role-based mock interviews (question sets by role, level and industry, plus a mode built from a real job posting), voice and video practice where the AI asks follow-up questions, answer feedback scored on clarity, structure, relevance and confidence with suggested better answers, opt-in delivery analysis (pace, filler words, eye contact, tone), several interview types (HR, behavioural STAR, technical, case, startup founder-fit), and progress tracking (session history, score trend, weak-area drills, and a readiness score shared with the Jobs module). It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Job seeker role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user is acting in the `job seeker` role. Practice sessions, recordings and scores are personal and sensitive: the server must return only the signed-in candidate's own data. Details are in **Part A9**. Do not show these pages to startups, mentors, investors or employers.

> **Reminder: the AI is a practice tool, never a hiring decision-maker.**
> This comes straight from your proposal's design notes and guardrails. Recordings are private by default and deletable on request. Scoring rubrics are published so candidates know how they are judged. Bias is tested. Candidate data isn't used to train third-party models. Everything the AI says is clearly labeled. Scores that reach an employer do so only with the candidate's consent, and employers are told the scores are practice results, not assessments to base a hiring decision on.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | Trainer Home | `/jobseeker/practice` | Start a session, see recent scores, get recommended practice |
| 2 | New Practice Setup | `/jobseeker/practice/new` | Choose role, level, industry and interview type, or build a session from a real job posting |
| 3 | Live Practice Session | `/jobseeker/practice/:sessionId` | Voice or video (or text) interview with an AI interviewer who asks follow-ups |
| 4 | Feedback Report | `/jobseeker/practice/:sessionId/report` | Scores on clarity, structure, relevance and confidence, suggested better answers, optional delivery analysis |
| 5 | Practice History and Recordings | `/jobseeker/practice/history` | Past sessions, recordings (private by default, deletable), transcripts |
| 6 | Progress and Readiness Score | `/jobseeker/readiness` | Score trend, strengths and weak areas, the job-readiness score shared with the Jobs module |
| 7 | Weak-Area Drills | `/jobseeker/practice/drills` | Short targeted practice on weak areas |
| 8 | Scoring Rubric and Privacy | `/jobseeker/practice/rubric` | Published rubrics, what is stored, who can see it, sharing consent, deletion |

Related pages: Dashboard (`jobseeker-dashboard-design.md`) shows practice suggestions and the readiness score. Job Detail and Interviews (`jobseeker-find-apply-design.md`, `jobseeker-applications-offers-design.md`) offer **Practice for this job**. Apply (`jobseeker-find-apply-design.md`) has the consent toggle to share the readiness score. The employer sees practice results only if shared (`startup-hiring-design.md`, Candidate Profile, Interview practice tab).

---

# Part A. Shared foundations

## A1. Design principles

- **Safe to fail:** this is practice. The tone is encouraging, specific and calm. No shaming, no countdown pressure, no "you failed".
- **Specific over scored:** a number is a starting point. The useful part is what to change and an example of a better answer.
- **Honest about limits:** the AI's feedback is a guide, not truth. Rubrics are published, and the page says what the AI can and can't judge.
- **Private by default:** recordings, transcripts and scores belong to the candidate. Sharing is opt-in, per use, and revocable.
- **Accessible to everyone:** voice, video and text modes all work. People can practice without a camera or microphone, and delivery analysis is optional and never required.
- **Fair:** feedback never judges accent, appearance, age, gender, disability, background or other personal characteristics. It doesn't infer emotions or personality.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active, live session background |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Progress fill, highlights, current point, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | AI suggestion backgrounds, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, comparison series |
| `--stone-200` | `#E5E1D8` | Borders, tracks, gridlines |
| `--success` | `#2E7D5B` | Improvement, strengths |
| `--warning` | `#B7791F` | Needs work, privacy attention |
| `--error` | `#B42318` | Errors, recording stopped, deletion |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`, tabular figures for scores.
- Page title 28px serif; score number 32px serif 600; card title 16px Inter 600; body 14–15px; caption 12px `--stone-700`. The live session uses larger 18px question text for readability.

## A4. Shared layout

Desktop (≥ 1200px): the job seeker sidebar and top bar from the dashboard, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. The live session uses a focused full-width layout (Part D). Tablet: side column drops below, sidebar becomes an icon rail. Mobile: single column, bottom tab bar (Home, Jobs, Applications, Practice, More); the live session is full-screen.

## A5. Shared components

### Interview type chips
`HR` · `Behavioral (STAR)` · `Technical` · `Case` · `Startup founder-fit` · `Role-based mix` (neutral stone chips with an icon). A `From a job posting` chip (gold-tint) marks sessions built from a real job.

### Score ring and bars
A thin ring or bar (gold on stone-200) with the number in serif, and a text label (`Needs work`, `Developing`, `Solid`, `Strong`). The four scored dimensions from your proposal are shown consistently: **Clarity**, **Structure**, **Relevance**, **Confidence**. Bands are described in text; color is never the only signal.

### AI label
A small `AI` pill (gold-tint with a sparkle icon) on everything the AI generates: interviewer questions, feedback, suggested answers, drill content. Tooltip: "Generated by AI as a practice aid. It can make mistakes. Your rubric is published." Link: **How scoring works** (opens Part I).

### Consent and privacy chips
`Private` (lock icon, stone) on recordings and transcripts; `Shared with {Employer}` (gold-tint) where the candidate has chosen to share a score; `Delivery analysis: Off / On`.

### Session card
Date, interview type chip, role and level, duration, overall score ring, one-line takeaway ("Strong structure; add measurable results"), and actions: **View report**, **Practice again**, overflow (**Rename**, **Delete session**).

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards; the report shows a progress state while scoring |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Sessions autosave answers and transcripts as they go; "Saved · just now" |
| Error | Inline message with **Retry**; the session can resume from the last saved answer |
| AI unavailable | Banner "The AI interviewer is unavailable right now." Past reports, history and the rubric page keep working; **Notify me** offers an alert when practice is back |
| Plan limit reached | Message with the reset time and the plan upgrade link (premium packs include more sessions and deeper feedback); the free tier keeps a basic number of sessions |
| Offline | History and reports readable from cache; starting or continuing a session is disabled until reconnected |
| Account paused or suspended | Read-only pages with a banner and **Contact support** |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; score rings animate once (600ms). Scores never count up as numbers. Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Scores and statuses use text and icons, never color alone; every chart has a text summary and a **View as table** toggle.
- **Multiple ways to practice:** text-only mode (type answers), voice mode (speak, with live captions), and video mode (camera on). Candidates who are deaf or hard of hearing get the interviewer's questions as text with captions; candidates who are blind or low vision get screen-reader-friendly pages and spoken questions; candidates with speech differences can choose text mode or extended thinking and speaking time. None of these modes lowers feedback quality or the readiness score, and delivery analysis is skipped where it doesn't apply.
- **Adjustable pace:** question reading speed, pause length, "repeat the question," and extended time options.
- Keyboard shortcuts in the live session (start or stop answering, repeat, skip, end), all with visible buttons. Touch targets at least 44×44px. Modals and drawers trap focus and return it to the trigger on close.

## A8. AI, fairness, privacy and conduct rules

- **Practice, not judgment:** the AI doesn't decide hiring outcomes. Employers who see shared practice results get a note that these are self-practice results that may not reflect real interviews and must not be the basis for a hiring decision.
- **Published rubrics:** every score dimension has a published rubric with band descriptions and examples (Part I). The report links to the rubric for each score.
- **Human review:** scoring that can affect people (the shared readiness score) is audited by humans: sampled sessions are reviewed against the rubric, the system is checked for drift and bias, and candidates can **Request a review** of a score (Part E8). A candidate-reported scoring problem goes to a reviewer, who can correct or remove the score.
- **Bias testing:** scoring and feedback are tested across groups, languages, accents and speaking styles. The system is not allowed to score accent, voice pitch, appearance, skin tone, age, gender, disability, background, or religion. It doesn't infer emotions, personality, health, or "culture fit." Delivery analysis is limited to observable, coachable behaviors the candidate opted into (pace, filler words, pauses, volume consistency, eye contact toward the camera, and clarity of speech as transcription confidence is not scored as "bad speech").
- **Delivery analysis is opt-in, per session:** off by default. Eye-contact analysis needs the camera and an explicit consent. It can be switched off at any time. When off, no video analysis happens.
- **Recordings are private by default** and are stored encrypted. They are used only to produce the candidate's own feedback and are deletable at any time. Deleted recordings are removed from storage within a stated period (for example, 30 days), and the transcript can be kept or deleted separately.
- **No training on candidate data:** audio, video, transcripts and answers aren't used to train third-party models. Any provider processing is limited to producing the candidate's feedback under the platform's data-processing terms.
- **Sharing is consent-based:** the candidate chooses whether to share the readiness score with employers, per application or in general, and can revoke consent for results not yet viewed. Recordings and transcripts are never shared with employers through this module.
- **Clear AI labels:** AI-generated questions, feedback, suggested answers and drills are labeled. Suggested better answers are **examples**, not scripts: they use the candidate's own facts and flag when facts are missing ("Add your actual result here"). The AI never invents experience for the candidate to claim.
- **Honest content:** question sets are reviewed for accuracy and bias; technical questions show source or difficulty notes. The AI says when it isn't sure.
- **Safe conduct:** the AI interviewer is professional and respectful. It doesn't ask illegal or inappropriate questions (for example, about age, marital status, religion, caste or health), and if the candidate asks it to simulate difficult or "stress" interviews, it keeps within respectful limits. Candidates can stop any session at any time.
- **Wellbeing:** the page uses calm language, offers breaks, and includes a note that practice can feel stressful, with an easy way to pause or switch to text mode. If a candidate shows signs of serious distress, the AI keeps a supportive tone and the page offers general wellbeing resources and **Contact support**; it doesn't diagnose or give mental-health advice.
- **Data handling:** data is encrypted in transit and at rest and follows the platform's privacy policy and applicable law (for example, India's DPDP Act). Camera and microphone permissions are requested only when needed and can be revoked in the browser at any time.

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `job seeker` role can open `/jobseeker/practice/...` and `/jobseeker/readiness` routes. The Scoring Rubric page may also be public (read-only) so employers and candidates can read how scoring works |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, investor and employer users see a 403 page ("This page is for job seekers") with a link to their own home; no practice data is fetched or rendered. Employers see only the shared score fields described below |
| **Multi-role users** | A founder, mentor or investor who is also a job seeker switches roles via the role switcher. Practice data belongs to the job seeker role and is never shown in other roles |
| **Own data only** | Sessions, recordings, transcripts, scores, drills and readiness data are returned only for the signed-in user; the server filters by user ID, never trusting an ID in the URL. Any other `:sessionId` shows 404 |
| **Recordings and transcripts** | Served only to the owner through expiring, user-scoped links; never returned to any employer or other role; admins can't view them unless a safety or dispute case allows it and is logged |
| **Employer access to scores** | An employer sees a candidate's job-readiness score (and, if the candidate chose, summary dimension scores) only for applications where the candidate consented, with a "practice result" label. The server checks the consent record on every request. Individual answers, transcripts, recordings and delivery analysis are never shared through this module |
| **Consent changes** | Revoking consent removes the score from employer views for applications where the employer hasn't viewed it; viewed scores follow the employer's retention rules, and the candidate can request deletion |
| **AI processing** | Audio, video and text sent to AI services are limited to what the feature needs, processed under the platform's data-processing terms, and not stored by third parties for training; the server checks consent for video and delivery analysis before sending anything |
| **Plan limits** | Session counts, advanced feedback, delivery analysis, video mode, drills and question packs are enforced on the server from the plan, not only in the UI |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner; recordings and answers are hidden unless a dispute or safety case allows access and is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. Trainer Home: `/jobseeker/practice`

## B1. Purpose
The front door to practice: start a session in a click, see recent progress, and get a sensible next suggestion.

## B2. Layout
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Interview practice"   [Start practice] │
│          ├────────────────────────────────────────────────┤
│          │  KPI row (4 cards)                             │
│          ├───────────────────────────────┬────────────────┤
│          │  Recommended next session     │ Readiness      │
│          │  Practice for your interviews │ score          │
│          │  Interview types              │ Weak areas     │
│          │  Recent sessions              │ Privacy        │
└──────────┴───────────────────────────────┴────────────────┘
```

## B3. Sections

### Header
Title, a short line ("Practice out loud, get specific feedback, and keep it private."), and **Start practice** (primary, opens New Practice Setup). A **Quick start** button begins a 10-minute session with the last used settings.

### KPI row (4 cards)
| Card | Example |
|---|---|
| Sessions this month | 6 |
| Average overall score | 68 (▲ 5 vs last month) |
| Practice time | 2 h 10 min |
| Readiness score | 68 / 100 |

Each card has a label, a big serif number, a change chip (arrow plus text) and a small sparkline where there is history. Tooltips explain the calculation. With no sessions yet, the cards show "Not yet" and the page leads with the first-session card.

### Recommended next session (`AI suggestion`)
A single card: role, interview type, estimated time, and the reason ("Your last two answers had good content but lacked structure. A STAR practice round can help."). Buttons: **Start this session**, **Choose something else**. A **Why this?** link explains how it was chosen (from recent scores, weak areas and upcoming interviews).

### Practice for your interviews
If the candidate has scheduled interviews, cards appear: "Interview with {Employer} on Thu 11:00 AM" with **Practice for this interview** (builds a session from the job posting and the interview type). Otherwise: "No interviews coming up. Practice for a saved job" with up to 3 saved jobs.

### Interview types
Six cards: **HR**, **Behavioral (STAR)**, **Technical**, **Case**, **Startup founder-fit**, **Role-based mix**. Each has a one-line description, an estimated length and **Start**. A small label shows how many times the candidate practiced that type.

### Recent sessions
The last 4 sessions as session cards (A5), with **View all history**.

### Side column
- **Readiness score card:** score ring, a short line ("Based on your last 5 sessions"), trend chip, **View progress**. A status line: "Shared with employers: **Off**" (or "On for chosen applications") with **Change**.
- **Weak areas:** up to 3 chips (for example, "Structure", "Measurable results", "Pace") with **Start a drill**.
- **Privacy summary:** "Recordings are private and can be deleted anytime." with **Manage privacy** and **How scoring works** links.
- **Tips:** one short, rotating tip ("Say your answer aloud once before you type it. It reveals gaps."). Dismissible.

## B4. First-time experience
A brief welcome card for new users: what practice is (3 short points), how long a first session takes (about 10 minutes), what is private, and a **Start your first session** button. A **Try a 3-question warm-up** option offers a very short taste.

## B5. States
- **No sessions:** hero card "Let's do a first practice. It takes about 10 minutes and it's private."
- **No upcoming interviews or saved jobs:** that card is hidden.
- **Streak and activity:** a gentle weekly activity indicator (days practiced), without penalties for gaps; can be turned off in Settings.
- **Plan limit reached:** message with the reset time and the upgrade link; reports and history stay available.
- **AI unavailable:** banner (A6) and disabled **Start practice**.
- **Loading error:** inline **Retry**; other cards stay usable.

---

# Part C. New Practice Setup: `/jobseeker/practice/new`

## C1. Purpose
Configure a session quickly: what role and type, how long, which mode, and whether to turn on optional features. It supports role-based question sets and the "build from a real job posting" mode from your proposal.

## C2. Layout
A focused setup page with a summary panel on the right ("Your session") and a **Start session** button that stays visible. The form uses a stepper on mobile; on desktop it's one page with collapsible sections.

## C3. Setup sections

### 1. Start from
Two cards (tabs):
- **Choose a role and type:** the standard setup.
- **Build from a job posting:** pick a saved job, an application in progress, a scheduled interview, a recommended job, or paste a job description (up to 10,000 characters). The AI extracts the role, requirements and likely questions, and shows a short summary the candidate can edit ("Product Designer at Acme · asks for user research, Figma, stakeholder communication"). Labeled `AI` with **How it works**.

### 2. Role and level
- **Role or role category:** search or choose (for example, Product Manager, Software Engineer, Marketing Manager, Customer Support, Data Analyst, Sales).
- **Level:** Entry, Mid, Senior, Lead or manager.
- **Industry:** optional (for example, Fintech, Health, Education, E-commerce).
- For job-posting mode, role and level are prefilled and editable.

### 3. Interview type
Cards (A5): **HR**, **Behavioral (STAR)**, **Technical**, **Case**, **Startup founder-fit**, **Role-based mix**. Each shows a short description and sample questions:
- **HR:** motivation, background, availability, strengths and weaknesses, culture questions.
- **Behavioral (STAR):** situation, task, action, result questions.
- **Technical:** role-specific questions (concepts, problem solving, scenarios); coding questions are text-based with a code box and aren't run, scored for reasoning and clarity.
- **Case:** structured business or product cases for roles that use them.
- **Startup founder-fit:** questions about ownership, ambiguity, speed, resourcefulness, equity and risk, and why an early-stage startup; no judgments on personal traits.
- **Role-based mix:** a balanced set from the above for the chosen role.

### 4. Length and difficulty
- **Length:** Quick (5 questions, about 10 min), Standard (8 questions, about 20 min), Full (12 questions, about 35 min).
- **Difficulty:** Gentle, Realistic (default), Challenging (tougher follow-ups, still respectful).
- **Follow-ups:** On (default) or Off.
- **Mode for the interviewer's pace:** normal, slower, or extra thinking time.

### 5. Mode
- **Text:** type answers, no microphone or camera.
- **Voice:** speak answers (with live captions and a transcript).
- **Video:** voice plus camera (recommended for in-person-style practice and eye-contact feedback).
Defaults to the last used mode. Permission prompts for microphone and camera appear only when the session starts, with a clear explanation of what is used.

### 6. Optional features (all off by default)
- **Delivery analysis:** pace, filler words, pauses, volume consistency, and (video mode only, with a separate consent) eye contact toward the camera. A short note lists exactly what is measured and what is not (no emotions, appearance or accent). The candidate can turn this on for this session only, or save it as a default.
- **Save the recording:** off by default; if on, the recording is private, stored encrypted and deletable. Without it, only the transcript and scores are saved (or nothing, if the candidate picks **Don't save anything**).
- **Keep transcript:** on by default so the report can show answers; can be turned off.
- **Show hints during the session:** shows a small structure reminder (for example, STAR) beside each question (default off).

### 7. Focus areas (optional)
Choose specific skills to emphasize (for example, leadership, conflict, prioritization, system design basics, product sense) or "Work on my weak areas" (uses recent results; labeled `AI suggestion`).

### 8. Review and start
A summary card with all choices, estimated time, and the privacy summary ("Recording: Off · Transcript: On · Delivery analysis: Off · Shared with employers: No"). **Start session** (primary), **Save setup as a preset** (name it, for example "Product interviews"), **Cancel**.

## C4. Device check (before starting, voice or video)
A short pre-flight page:
- Microphone test with a level meter and a **Record 5 seconds and play back** check.
- Camera preview (video mode) with the option to blur or hide the background if supported.
- Connection check and a note about a quiet space.
- Permissions status with **How to allow access** help if blocked.
- **I'm ready** (primary) and **Switch to text mode** at any point.

## C5. Presets and recents
A row of saved presets and recent setups ("Product Manager · Behavioral · Standard") for one-click start.

## C6. Rules
- Setup never asks for personal characteristics. The job-posting mode uses only the posting text and the candidate's chosen role and level.
- If the candidate has a scheduled interview with an employer, the session is built from the posting only; it doesn't claim to simulate that employer's actual interviewers or questions.
- The question source for each set is shown ("Reviewed question bank · updated {date}"). Candidates can report a question as unclear, inappropriate or inaccurate.
- The plan limit for sessions and features is checked when the session starts, not mid-session.

## C7. States
- **Job posting too short or unclear:** "We couldn't find enough detail." with **Paste more text**.
- **Job link can't be read:** "Paste the job description instead."
- **Camera or microphone blocked:** help text and **Switch to text mode**.
- **No microphone found:** text mode suggested.
- **Poor connection detected:** warning with **Continue anyway** or **Try later**; the session saves answers as it goes.
- **Plan feature locked (for example, video mode or delivery analysis):** locked option with the plan needed and **Upgrade**; other choices still work.
- **Session limit reached:** message and upgrade link before starting.
- **Unsaved setup:** leaving the page asks to save it as a preset.

---

# Part D. Live Practice Session: `/jobseeker/practice/:sessionId`

## D1. Purpose
The practice interview itself: the AI asks questions, listens or reads the candidate's answers, and follows up. It supports voice, video and text modes.

## D2. Layout (voice and video)
A calm, focused layout on `--ink-soft` (dark) background with ivory text for reduced distraction, high contrast, and a light option in Settings.
```
┌────────────────────────────────────────────────────────────┐
│ Header: role · type · question 3 of 8 · timer · [Pause][End]│
├─────────────────────────────────────┬──────────────────────┤
│ Interviewer area                    │ Side panel           │
│  • AI interviewer avatar/waveform   │  • Question text     │
│  • Question text (large)            │  • Live captions     │
│  • Your camera (small, video mode)  │  • Notes (private)   │
│                                     │  • Hint (if on)      │
├─────────────────────────────────────┴──────────────────────┤
│ Controls: [Mic] [Camera] [Start / Stop answering] [Repeat] │
│ [Skip] [Need a moment]                                     │
└────────────────────────────────────────────────────────────┘
```
On mobile the side panel becomes a bottom sheet and controls sit in a bottom bar.

### Header
Role and interview type, question counter ("Question 3 of 8"), an elapsed timer (can be hidden), recording and analysis indicators, **Pause** (breaks for up to 10 minutes), and **End session** (confirmation: "End now? We'll score the answers you've given.").

### Status indicators (always visible)
Small labeled chips in the header: `Recording: Off/On`, `Delivery analysis: Off/On`, `Camera: Off/On`, `Private`. They never hide; if the camera is on, a visible indicator shows. A **Change** link opens the privacy controls, which let the candidate turn recording or analysis off mid-session.

## D3. The interviewer (`AI`)
- **Presentation:** a neutral, simple avatar or abstract waveform (no photorealistic human faces, no gendered or ethnic presentation by default), with a clear `AI interviewer` label. The candidate can choose a voice style (several neutral voices and speeds) and turn spoken questions off to read only.
- **Behavior:**
  - Asks one question at a time, then waits. It doesn't interrupt; it waits for a pause or for the candidate to press **I'm done**.
  - Asks 0–2 follow-ups when enabled, based only on what the candidate said ("You mentioned a conflict with a teammate. What was the outcome?"). Follow-ups probe for specifics, structure and results.
  - Keeps a professional, friendly, respectful tone; never judges personal characteristics, and never asks illegal or inappropriate questions.
  - Adjusts difficulty gently if the candidate struggles (offers to rephrase or give a hint when the candidate asks) and escalates in "Challenging" mode within respectful limits.
- **Candidate controls:** **Repeat question**, **Rephrase**, **Need a moment** (adds thinking time and shows a calm timer), **Skip question**, and **I'd like a hint** (shows a structure reminder, scored the same way but noted in the report).

## D4. Answering
- **Voice and video:** the candidate presses **Start answering** (or just speaks; a voice-activity mode is optional), sees a live caption, and presses **I'm done** (or pauses for a few seconds if auto-detect is on). A suggested answer length shows as a soft guide (for example, "Aim for 1–2 minutes"), not a hard limit.
- **Text:** a text area with a word count, spellcheck, and **Submit answer**. Typing speed isn't scored.
- **Technical and case questions:** a text area (and a code box where relevant) with a whiteboard-style scratchpad for notes; code isn't executed, and the AI evaluates reasoning, correctness of approach and clarity. A note says this.
- **Private notes:** an optional scratch area for jotting down thoughts; not recorded or scored.
- **Re-do an answer:** after answering, the candidate can **Try this answer again** once (the first attempt stays in the history; the report compares the two). Re-dos can be turned off in Setup for a realistic one-take session.

## D5. During the session
- **Live captions:** on by default for voice and video; the transcript is built as the session goes. Corrections are possible after the session.
- **Pace and filler hints (only if delivery analysis is on):** subtle, non-distracting indicators (for example, a small pace dial) that can be hidden. No red alerts, no streaks of warnings.
- **No scoring display during the session:** scores and feedback appear in the report, so the candidate isn't distracted.
- **Breaks:** **Pause** freezes the timer and stops recording and analysis; **Resume** continues. A gentle prompt appears after 30 minutes.
- **Connection loss:** the session pauses, saves answers so far, and offers **Resume**, **Finish with what I've done** or **Come back later** (sessions can be resumed for 24 hours).
- **Switching modes:** the candidate can switch from video to voice or to text mid-session without losing progress; delivery analysis stops automatically if the camera or microphone is off.

## D6. Ending the session
- **End session** confirmation, or the session ends after the last question. A short closing line from the interviewer.
- **Wrap-up screen:** "Nice work." with a simple summary (questions answered, time), a **How did that feel?** optional quick check (Very hard, Hard, About right, Easy) used to tune difficulty, and **See my feedback** (primary). Scoring runs in the background; a progress state shows while the report is prepared, usually within a minute.
- **Recording and transcript choices:** a reminder of what was saved, with **Delete recording** and **Delete transcript** buttons available immediately.

## D7. Safety and conduct in session
- A visible **Stop** control always ends the session immediately.
- If the candidate expresses distress or says they want to stop, the AI responds kindly and offers to pause or end; it doesn't push.
- If the candidate enters inappropriate content or tries to use the AI for something unrelated, the session returns to the practice focus politely.
- Sessions can be reported (**Report a problem with this session**) for harmful or wrong AI behavior; reports go to review and the question set or behavior is corrected.

## D8. States
- **Loading the session:** skeleton interviewer area and a "Getting your questions ready" message.
- **Permissions blocked:** options to switch to text mode or fix permissions; the session never starts a camera or microphone without consent.
- **Microphone silent or too quiet:** gentle message "We can't hear you. Check your microphone or switch to text."
- **Poor audio or captions off:** caption accuracy note; the candidate can edit the transcript after the session.
- **AI delay or error:** "One moment." with **Retry**; the answer isn't lost. If the AI fails repeatedly, the session is saved as incomplete and can be resumed or scored with what's available.
- **Session paused over 24 hours:** archived as incomplete with **Resume** unavailable; the report scores answered questions only.
- **Plan limit reached mid-session:** the session finishes normally; the limit applies to starting new sessions.
- **Browser closed:** autosaved progress; **Continue session** appears on Trainer Home.
- **Offline:** the session pauses; answers so far are saved locally and uploaded when reconnected.

---

# Part E. Feedback Report: `/jobseeker/practice/:sessionId/report`

## E1. Purpose
Specific, usable feedback on each answer and the session overall. It implements your proposal's "answer feedback": scores on clarity, structure, relevance and confidence, with suggested better answers, plus optional delivery analysis.

## E2. Layout
Header with the session summary, then tabs. Left main column (8 col), right sticky panel (4 col). On mobile the panel moves above the tabs as a compact summary.

### Header
Session name (editable), date, role and level, interview type chip, mode (Text, Voice, Video), duration, questions answered, and the `AI` label with a **How scoring works** link. Actions: **Practice again**, **Practice weak areas**, **Share score** (opens consent controls, Part E9), overflow (**Download report (PDF)**, **Rename**, **Delete session**).

## E3. Overall summary
- **Overall score** (0–100) with the score ring and label (`Needs work`, `Developing`, `Solid`, `Strong`), and a trend chip versus the last similar session.
- **Four dimension scores** (A5): **Clarity**, **Structure**, **Relevance**, **Confidence**, each with a mini ring, a one-line plain-language summary, and a **Rubric** link. For example: "Structure · 62 · You gave the situation and action clearly, but results were missing."
- **Top strengths** (up to 3) and **Top things to work on** (up to 3), each linked to the answer where it appeared.
- **One thing to try next:** a single concrete action ("Add a measurable result to each answer") with **Start a drill** and **Practice again**.
- A line of honest framing: "This is practice feedback from an AI. It can be wrong. Use it as a guide." with a **Request a review** link (E8).

## E4. Tabs

### Answers
A list or carousel of each question with:
- **Question** and the interview type tag.
- **Your answer:** transcript (editable to correct transcription mistakes; edits don't change scores unless the candidate re-runs scoring) and, if recording was saved, a playback control with a transcript that follows the audio.
- **Scores:** the four dimensions for this answer, each with a short explanation and rubric band.
- **What worked:** specific points ("Clear example from your internship," "Good use of a result").
- **What to improve:** specific points with quotes from the answer ("You said 'we did a lot' without saying what you did").
- **Suggested better answer** (`AI`): a stronger version built **only from the candidate's own facts** in their answer and resume, with missing facts shown as placeholders ("[Add the result: how much improved?]"). A label says it's an example, not a script, and not to claim anything untrue. Buttons: **Copy**, **Practice this question again**, **Save to my answer bank** (private notes for reuse).
- **Follow-ups asked:** the follow-up questions and how the candidate handled them.
- **Compare attempts:** if the answer was re-done, a side-by-side of the two attempts.
- **Report a problem with this feedback:** flags an unfair, wrong or unclear score or explanation.

### Delivery (only if delivery analysis was on)
Observable, coachable measures with plain explanations and sample sizes:
- **Pace:** words per minute with a range (not a single "good" number), and a chart across the session.
- **Filler words:** count and rate per minute with the most common fillers, linked to transcript moments.
- **Pauses:** long pauses and how they were used (thinking vs. trailing off), neutral wording.
- **Volume consistency:** simple stability measure.
- **Eye contact toward the camera** (video mode and separate consent): percentage of time looking toward the camera with a note that looking at notes or the screen is normal.
- **Speaking time per answer** against suggested ranges.
Caption: "Delivery analysis is a coaching aid. It does not judge your accent, voice, appearance or personality, and it isn't used in your readiness score unless you chose to include it." (Whether delivery counts toward the readiness score is the candidate's setting; by default it doesn't.)

### Content breakdown
- **Structure map:** how the answers followed STAR or other structures, shown as simple bars per answer (Situation, Task, Action, Result present or missing).
- **Relevance:** which parts matched the question and which drifted.
- **Evidence:** how many answers included specifics (numbers, names of tools, outcomes) and where to add them.
- **Skills mentioned:** skills the candidate talked about, and, for job-posting sessions, how they line up with the job's requirements (neutral, with gaps shown as "Not mentioned" rather than failures).

### Transcript
Full transcript with timestamps, search, and the ability to correct transcription errors; downloadable as text. A **Delete transcript** button.

### Recording (if saved)
Private player with speed control, jump-to-question markers and **Delete recording**. A permanent label: `Private`. No sharing option exists for recordings.

## E5. Right sticky panel
- **Next steps:** up to three actions with buttons (for example, **Drill: add measurable results**, **Practice again at Standard length**, **Update my resume bullets** linking to the editor with the specific suggestions).
- **Compared with your last sessions:** a small trend line of overall and dimension scores, labeled as your own history only.
- **Readiness impact:** "This session updated your readiness score from 66 to 68." with **View progress**.
- **For your upcoming interview:** if a session was for a specific job or interview, a short checklist of what to focus on before the day, plus **Practice again for this job**.
- **Privacy summary:** what was saved (transcript, recording, scores), who can see it (only you), and **Manage**.

## E6. Scoring approach (summarized on the page, full rules on the Rubric page)
- Each dimension is scored from 0–100 against a published rubric with band descriptions and examples. The AI explains each score by pointing to specific parts of the answer.
- Scores combine per-answer scores with a session-level adjustment for consistency. The method is described in plain language.
- Scores are deterministic where possible (the same transcript gets very similar scores), and variability is reduced by using the rubric and multiple scoring passes. Differences between sessions can reflect different questions.
- **Not scored:** accent, voice quality, appearance, background, personality traits, anything personal.
- **Language support:** answers can be practiced in supported languages (shown in setup). The rubric is applied to meaning and structure, and the AI is tested for fairness across languages and speaking styles.

## E7. Rules
- Feedback must reference the candidate's actual answer, not generic text.
- The AI doesn't compare the candidate to other people and doesn't produce a percentile against others in this report. (Benchmark comparisons, if ever added, would be opt-in and aggregated.)
- Suggested answers must never add facts. Where facts are missing, they show placeholders.
- A **low score** is described constructively and always comes with at least one specific improvement and a drill.
- The report is saved until the candidate deletes it.

## E8. Request a review
- A **Request a review** link on the report and on each answer score. The form asks which score and why (it seems too low or high, misunderstood the answer, unfair, technical error) with an optional note.
- A human reviewer checks the answer against the rubric within a stated time (for example, 5 business days). The result: **score kept** with an explanation, **score corrected** (the report and the readiness score update), or **score removed** (if the session had a technical issue). The candidate is notified.
- The reviewer sees only the answer text and the score, not the candidate's name or profile where possible, and doesn't see recordings unless the candidate adds them to the review request.
- Review requests feed back into the system's quality and bias checks.

## E9. Share score with employers
A **Share score** panel (opens from the header or the readiness page):
- Shows exactly what would be shared: the readiness score and, if chosen, the four dimension scores (never answers, transcripts, recordings or delivery analysis).
- Choose: **Don't share**, **Share with specific applications** (pick from the list), or **Share with all my applications** (can be revoked).
- A note to the employer appears with the shared score: "Practice result provided by the candidate. Not an assessment to base a hiring decision on."
- **Revoke sharing** works for results not yet viewed; viewed results follow the employer's retention rules, and the candidate can request deletion.
- The consent record (date, what, who) is saved and shown on the Rubric and Privacy page.

## E10. States
- **Scoring in progress:** progress state, "Your feedback is being prepared. This usually takes under a minute." The page can be left and the report appears in History and notifications.
- **Incomplete session:** a banner "You answered 4 of 8 questions. Scores reflect these answers." with **Continue practice**.
- **Very short answers:** feedback notes the answers were too short to score reliably ("We need more detail to give specific feedback"), with a **Try again** button; short answers don't produce a punitive score.
- **Transcript low confidence:** a warning "Some words may be misheard. Check the transcript." with **Edit transcript** and **Re-run feedback**.
- **Delivery analysis off:** the Delivery tab explains what it is and offers to turn it on for next time; it isn't pushy.
- **Scoring failed:** inline **Retry**; the session and answers remain saved.
- **Report deleted or session deleted:** a confirmation and the effect on the readiness score ("Your readiness score will be recalculated.").
- **Review pending:** a chip on the score "Review requested" with the expected date; the score stays visible.
- **AI unavailable at feedback time:** report is queued and delivered when available, with a notification.

---

# Part F. Practice History and Recordings: `/jobseeker/practice/history`

## F1. Purpose
A private archive of every session: reports, transcripts and (if saved) recordings, with simple tools to find, compare and delete.

## F2. Layout
Header with title and a privacy line ("Only you can see this."). Summary strip, tabs (**Sessions**, **Recordings**, **Answer bank**), toolbar, then the list or table.

### Summary strip
| Stat | Example |
|---|---|
| Sessions | 18 |
| Recordings stored | 3 (1.2 GB) |
| Transcripts stored | 15 |
| Last practice | 2 days ago |

### Toolbar
Search (question text, role, notes), filters (interview type, role, level, mode, score range, date, for a specific job), sort (Newest, Highest score, Lowest score, Duration), view toggle (Cards or Table).

## F3. Sessions tab
Session cards (A5) or a table: date, name, role and level, type, mode, duration, overall score, dimension scores, practice-for (job or interview), data kept (Transcript, Recording, Delivery), actions (**View report**, **Practice again**, **Compare**, overflow **Rename**, **Delete**).

- **Compare:** pick two sessions to see scores and answers side by side, with a simple "what changed" summary (labeled `AI`). Useful for tracking progress on the same question set.
- **Bulk actions:** **Delete selected**, **Delete recordings only**, **Download selected reports (PDF)**.
- **Group by:** none, role, month, interview type.

## F4. Recordings tab
List of saved recordings: date, session, duration, size, status (`Private` chip), **Play**, **Download** (the candidate may download their own recording), **Delete**. A storage meter shows space used. A clear note: "Recordings are used only to give you feedback. They are never shared with employers and are not used to train third-party models."

- **Auto-delete:** setting to delete recordings after 7, 30 or 90 days (default: keep until deleted by the candidate, with a reminder after 90 days: "You have recordings older than 90 days. Delete them?").
- **Deleting a recording:** a confirmation; deleted files are removed from storage within the stated period, and the page says when. The transcript and scores stay unless also deleted.

## F5. Answer bank tab
A private notebook of answers the candidate saved: question, the candidate's own final answer (from suggested answers they edited or their own), tags (for example, "leadership", "conflict"), last practiced, and **Practice this question**. Items can be exported as text. The bank never includes the AI's invented facts, and every saved answer is stored as the candidate's own text. Optional link: **Use in resume** (suggests bullet ideas to the editor, subject to the fact-check rules).

## F6. Data and deletion controls
A section at the bottom (or Settings link) with:
- **Delete all recordings** and **Delete all practice data** (with a clear list of what is deleted and what is kept, such as anonymized, aggregated statistics that can't identify the candidate).
- **Download my practice data** (zip of reports, transcripts and answer bank).
- Retention note: "Reports are kept until you delete them. Deleted data is removed within 30 days, except records the law requires us to keep."

## F7. States
- **Empty:** "No sessions yet. Your practice history will show up here." with **Start practice**.
- **No results:** "No sessions match." with **Clear filters**.
- **Recording deleted:** the session card shows `Recording deleted` and keeps the report.
- **Storage limit reached (plan):** message and options (delete old recordings or upgrade); new recordings stop saving, but practice itself continues.
- **Failed deletion:** inline **Retry**; the page shows the status and support link if it persists.
- **Large download:** prepared in the background and delivered by notification.
- **Loading error:** inline **Retry**.

---

# Part G. Progress and Readiness Score: `/jobseeker/readiness`

## G1. Purpose
Shows how practice and preparation are progressing over time, and the **job-readiness score** that can be shared with the Jobs module (only with the candidate's consent). It's a mirror, not a grade.

## G2. Layout
Header with the score and a status line. Left main column (8 col), right panel (4 col).

### Header
The **Job-readiness score** (0–100) as a large serif number with a gold ring, a label (`Getting started`, `Developing`, `Solid`, `Strong`), the trend chip ("▲ 6 this month"), the "last updated" date, and the line: "A practice guide, not a hiring decision. Employers make their own decisions." Buttons: **Share settings**, **Start practice**.

## G3. What goes into the score
A clear, published breakdown (the same one shown on the Dashboard card), with each part visible and adjustable by the candidate's own activity:

| Component | What it is | Default weight |
|---|---|---|
| **Interview practice** | Recent session scores (clarity, structure, relevance, confidence), weighted toward the latest sessions and a variety of interview types | 60% |
| **Consistency** | Number of sessions over the last 30 days and breadth across question types (not penalizing gaps or rest) | 15% |
| **Resume strength** | ATS readability and completeness of the main resume | 15% |
| **Profile completeness** | Skills, experience and preferences filled in | 10% |

- Weights and the formula are published on the Rubric page. Delivery analysis is **not** included unless the candidate chooses to include it, with a clear toggle: "Include delivery results in my score (optional)."
- The score needs at least 3 sessions to show a stable number; before that, "Getting started" with a progress bar toward the first score.
- The score changes slowly (smoothed) so one bad session doesn't swing it.
- No personal characteristics are used.

## G4. Main column sections

### Score trend
Line chart (ink line, gold current point) of the readiness score over time, with a toggle for the four dimension trends. Annotations mark events ("First session", "Resume updated"). A **View as table** toggle and a text summary ("Up 12 points in 60 days").

### Dimension breakdown
Four dimension cards (Clarity, Structure, Relevance, Confidence): current level, trend, a one-line explanation, and the top improvement tip, each with **Practice this** (opens a drill).

### Strengths and weak areas
- **Strengths:** up to 3 (for example, "Clear examples", "Relevant to the question") with the sessions where they showed up.
- **Weak areas:** up to 3 (for example, "Measurable results", "Opening statements", "Handling follow-ups"), each with **Start a drill** and the evidence behind it (a few example answers).
Labeled `AI`, with a **Why?** link.

### Question-type coverage
A simple grid of interview types (HR, Behavioral, Technical, Case, Founder-fit) showing sessions per type, average dimension scores, and a gentle nudge for types with no practice ("You haven't tried a Case session yet").

### Practice activity
A calendar heatmap or simple weekly bar showing days practiced. It's gentle and descriptive; a rest day isn't "missed." Can be hidden in Settings.

### Goals
Optional: set a target (for example, "Be ready for interviews at {Employer} by 20 Nov") with a simple plan: suggested sessions per week and a checklist. The plan is labeled `AI suggestion`, can be edited, and has no penalties.

## G5. Right panel

### Sharing with employers
- Current status: "Not shared," "Shared with 2 applications," or "Shared with all applications."
- **What employers see:** the readiness score and (if chosen) dimension scores, with the "Practice result" note. Never answers, transcripts, recordings or delivery analysis.
- **Manage sharing:** per application list with **Revoke** (for results not yet viewed) and the date shared.
- A note: "Sharing is optional and never required to apply."

### Next steps
Top three actions (drill, session type, resume improvement), each with a button.

### Score history log
A list of what changed the score recently ("Session on 3 Nov: +2", "Resume ATS check: +1"), so the number is explainable.

### Help
Links to **How scoring works**, **Request a review** and **Contact support**.

## G6. Rules
- The readiness score isn't a rank and isn't compared with others.
- Employers can't request the score or see it without the candidate's consent. The Jobs module checks consent on the server each time.
- Deleting sessions recalculates the score. Deleting all practice data resets it to "Getting started."
- A candidate can hide the score on their own pages; the score still updates in the background unless they pause tracking in Settings.

## G7. States
- **No sessions:** hero card "Do your first practice to get a readiness score." with **Start practice**; components show their own progress.
- **Fewer than 3 sessions:** "Your score will appear after 3 sessions." with a progress bar.
- **Score drop:** a neutral message "Your score went down a bit. This often happens when you try harder question types." with **See why** and **Start a drill**; no alarm language.
- **Stale score (no practice for 30 days):** a gentle note "It's been a while. A quick session keeps your score current." The score isn't lowered by inactivity beyond the smoothing described above; it shows its date.
- **Review pending on a session:** the score shows "Based on reviewed results" with the pending item noted.
- **Sharing on but score hidden:** warning that employers can still see it with **Manage sharing**.
- **Loading error:** inline **Retry**.

---

# Part H. Weak-Area Drills: `/jobseeker/practice/drills`

## H1. Purpose
Short, focused practice on one skill, so improvement doesn't require a full mock interview. It implements "weak-area drills" from your proposal.

## H2. Layout
Header with title and a short line ("Short practice on one thing at a time. Most drills take 3 to 7 minutes."). Tabs: **Recommended** · **All drills** · **My drills**. A summary strip: drills done this month, current focus, time spent.

## H3. Recommended (`AI suggestion`)
Up to 3 drill cards chosen from the candidate's weak areas, each with: the skill, why it's recommended (with evidence, "In 3 recent answers, results were missing"), length, difficulty, and **Start drill**. A **Why this?** link explains the recommendation. **Not now** dismisses it.

## H4. All drills (library)
Grouped by skill, with search and filters (skill, interview type, length, difficulty, text or voice):

| Skill group | Example drills |
|---|---|
| **Structure** | Answer in STAR, Opening in 30 seconds, Summarize in one sentence, Signposting |
| **Evidence** | Add a number, Name the tools you used, Tell the result, Replace "we" with "I did" (when true) |
| **Relevance** | Answer the question asked, Trim the story, Link your answer to the role |
| **Clarity** | Plain words, Shorter sentences, Explain it to a non-expert |
| **Confidence and delivery** | Slow down, Reduce filler words (voice), Pause before answering, Own your achievements (language practice, not personality) |
| **Handling follow-ups** | Respond to "Tell me more", Respond to "Why?", Handle a challenge politely |
| **Technical reasoning** | Think aloud, Clarify the problem first, Explain trade-offs |
| **Case structure** | Frame the problem, Make assumptions explicit, Summarize a recommendation |
| **Founder-fit** | Talk about ambiguity, Ownership stories, Why an early-stage startup |
| **Tough questions** | Strengths and weaknesses, Gaps in experience, Salary expectations, Why are you leaving |

Each card: title, a one-line goal, length, difficulty, and whether delivery analysis applies. **Preview** shows an example of a strong answer pattern.

## H5. Drill player (`/jobseeker/practice/drills/:drillId`)
A compact version of the live session:
1. **Goal and tip:** a short explanation of the skill with a 20-second example (text or audio).
2. **Practice:** the AI asks 2–5 short prompts; the candidate answers (text or voice). Each prompt is a single focused question ("Describe a result from your last role with one number").
3. **Instant micro-feedback:** immediately after each answer, one or two lines on the drill's skill only ("You gave the result. Add how it compared to before.") and a **Try again** button; progress is tracked per attempt.
4. **Wrap-up:** a short summary of improvement across attempts ("Your answers now include a result 4 of 5 times"), a "keep or change" note for the answer bank, and the next suggestion.
- No full scores in drills; they show progress on the skill. Drill results do contribute to the readiness score's consistency and dimension trends in a light, published way (Part G3), never reducing the score for a poor drill.
- Recordings aren't saved by default; the candidate can opt in for a drill.

## H6. My drills
History of drills done with the date, skill, attempts and improvement note, plus **Repeat drill**. **Saved drills** (bookmarked by the candidate) and a **Plan**: an optional weekly list of 3 drills the candidate has picked.

## H7. Custom drill (optional)
**Make my own drill:** the candidate pastes a question they want to practice (for example, from a real interview) and picks a skill to focus on; the AI runs a short drill on that question only. Labeled `AI`. Questions the candidate types are private and aren't added to the shared question bank.

## H8. States
- **No weak areas yet:** "Do a practice session first, and we'll suggest drills based on your answers." with **Start practice**. All drills remain available.
- **Completed all recommended:** a calm message "You're up to date. Try a full session or a new skill."
- **Plan limit (drill count or advanced drills):** locked cards with the plan needed; basic drills stay free.
- **Microphone issues:** voice drills offer a text option.
- **AI unavailable:** drills that depend on the AI show a banner; static tips and examples remain readable.
- **Abandoned drill:** progress is saved; **Continue** appears on Trainer Home.
- **Loading error:** inline **Retry**.

---

# Part I. Scoring Rubric and Privacy: `/jobseeker/practice/rubric`

## I1. Purpose
Transparency in one place: how scores are produced, what the rubrics say, what the AI does and doesn't judge, what data is stored, who can see it, and how to control it. This page implements the proposal's note that scoring rubrics are published so candidates know how they are judged, and the privacy commitments (private recordings, deletion, no training on candidate data).

## I2. Layout
A readable, document-style page (max width 840px) with a sticky table of contents on desktop and an accordion on mobile. Sections: **How scoring works**, **The rubrics**, **What we don't score**, **Fairness and testing**, **Your data**, **Sharing with employers**, **Your controls**, **Review and corrections**, **Changes to this page**. It can also be viewed without signing in (read-only, general), with the **Your data** and **Your controls** sections requiring sign-in.

## I3. Sections

### How scoring works
- Plain-language overview: the AI compares each answer with a published rubric, scores four dimensions (Clarity, Structure, Relevance, Confidence), explains each score, and combines them into an overall score and a readiness score.
- A simple diagram: Answer → Rubric check → Dimension scores → Session score → Readiness score (the last only if enough sessions exist).
- Limits: "The AI can make mistakes. Scores are a guide for practice."

### The rubrics
For each dimension, a table with score bands and descriptions, "what this looks like" examples (short fictional examples) and common improvements:

| Dimension | What it measures |
|---|---|
| **Clarity** | Is the answer easy to follow? Plain language, logical flow, a clear main point, concise |
| **Structure** | Does it follow a helpful structure (for example STAR for behavioral, problem-approach-trade-off for technical, framework for case)? Clear start, middle and end |
| **Relevance** | Does it answer the question that was asked, with fitting examples and the right level of detail for the role and level? |
| **Confidence** | Does the language show ownership and conviction (clear statements, specific claims, owning one's part), without exaggeration? Based on wording, not on tone of voice, appearance or personality |

Band labels: `Needs work` (0–39), `Developing` (40–59), `Solid` (60–79), `Strong` (80–100), each with a description. Interview-type variants (HR, Behavioral, Technical, Case, Founder-fit) list the specific criteria used. The rubric version and date are shown, with a change log.

### Delivery analysis (optional)
A separate short rubric for opt-in measures: pace ranges, filler words, pauses, volume consistency, and eye contact toward the camera. It states: coachable behaviors only; no judgments of accent, voice, appearance, emotions or personality; not part of the readiness score unless the candidate includes it.

### What we don't score
A plain list: accent or pronunciation, voice pitch or tone as a personal trait, appearance, clothing, background, age, gender, disability, religion, caste, nationality, marital status, family details, health, emotions or personality, and "culture fit." The AI is also instructed not to ask about them.

### Fairness and testing
- How the system is checked: sampled human review against the rubric, tests across languages, accents, speaking styles and answer lengths, drift monitoring, and regular audits with results summarized here (for example, "Last audit: Oct 2026").
- Known limits: transcription errors, non-standard speech, noisy audio, and unusual accents may affect captions; the candidate can correct the transcript and request a review.
- How to report a problem: **Report a scoring issue** and **Request a review** links.

### Your data
A clear table of what is stored and for how long:

| Data | Stored by default? | Who can see it | How long | Delete |
|---|---|---|---|---|
| Scores and reports | Yes | Only you | Until you delete them | Yes |
| Transcripts | Yes (can be turned off) | Only you | Until you delete them | Yes |
| Recordings (audio or video) | No (opt-in) | Only you | Until you delete them, or auto-delete setting | Yes |
| Delivery analysis results | Only if turned on | Only you | With the session | Yes |
| Readiness score | Yes | Only you, and employers you choose | Until recalculated or deleted | Yes |
| Aggregated, anonymous statistics | Yes | The platform | Kept; can't identify you | Opt out in Settings |

- Recordings are stored encrypted, are used only to produce your feedback, are never shared with employers, and are not used to train third-party models.
- Providers that process audio or text do so under the platform's data-processing terms, only for producing your feedback.
- Data handling follows the platform's privacy policy and applicable law (for example, India's DPDP Act).

### Sharing with employers
- What can be shared: the readiness score and, if chosen, the dimension scores. Nothing else.
- When: only with the candidate's consent, per application or for all, and revocable before the employer views it.
- What employers are told: the score is a practice result provided by the candidate and not an assessment to base a hiring decision on.
- A **Consent history** table of what was shared, with whom and when, with **Revoke** where possible.

### Your controls
A panel (signed in) with toggles and buttons:
- Delivery analysis default (Off, per session, On)
- Save recordings by default (Off, On)
- Keep transcripts by default (On, Off)
- Auto-delete recordings after 7, 30 or 90 days, or never
- Include delivery results in the readiness score (Off by default)
- Share the readiness score with employers (Off, per application, all)
- Contribute anonymous statistics to improve the product (On, Off)
- **Delete all recordings**, **Delete all practice data**, **Download my practice data**
- **Pause practice tracking** (the readiness score stops updating)
Sensitive actions (delete all data, change sharing) show confirmations; deleting all practice data resets the readiness score.

### Review and corrections
How to request a human review, expected timelines and what happens next (E8), and how to report harmful AI behavior or inappropriate questions.

### Changes to this page
A dated change log of rubric and policy updates. Candidates are notified of significant changes, and sessions scored under older rubrics show the rubric version.

## I4. Public view
Signed-out visitors (for example, employers and prospective candidates) can read how scoring works, the rubrics, what's not scored, fairness and testing, sharing rules, and the change log. They can't see personal data or controls. The page is written in plain language and is searchable.

## I5. States
- **Controls failed to save:** inline error with **Retry**; the previous setting stays.
- **Deletion in progress:** a status chip ("Deleting. This can take up to 30 days to fully remove from backups.") and a notification when complete.
- **Rubric updated:** a banner "We updated the rubric on {date}. Read what changed." with a link.
- **Consent history empty:** "You haven't shared your score with anyone."
- **Pause tracking on:** banner and a **Resume** button.
- **Loading error:** inline **Retry**.

---

# Part J. Notifications for these pages

| Event | Channel |
|---|---|
| Feedback report ready | In-app, push |
| Practice suggested for an upcoming interview (24 hours before) | In-app |
| Practice reminder (optional, weekly, gentle) | In-app, email |
| A review request was resolved | In-app, email |
| Readiness score updated (significant change only) | In-app |
| Sharing consent used (an employer viewed your shared score) | In-app |
| Recordings older than 90 days (once) | In-app |
| Deletion completed | In-app, email |
| Rubric or policy updated | In-app |
| Plan limit reached or reset | In-app |
| AI practice available again after an outage (if subscribed) | In-app |

Candidates can mute, filter or set digests in Settings. Notifications never include answer text, scores in email subjects, or recording content ("Your feedback is ready" instead of the score).

---

# Part K. Data and validation

| Field | Rule |
|---|---|
| Session length | Quick (5 questions), Standard (8), Full (12); sessions stop after 60 minutes |
| Answer length | Voice and video: up to 5 minutes per answer; text: up to 3,000 characters |
| Job description for a session | Up to 10,000 characters |
| Recording | Opt-in; stored encrypted; size and plan limits apply; deletable at any time |
| Transcript edits | Allowed; a **Re-run feedback** button re-scores with the corrected transcript |
| Delivery analysis | Requires explicit consent per session or a saved default; eye contact analysis requires separate camera consent |
| Re-do of an answer | Once per answer (setting can turn it off) |
| Review requests | One per session score, within 30 days of the report |
| Sharing consent | Explicit, recorded with date and scope; revocable before the employer views it |
| Drills | Library plus custom; limits per plan |
| Answer bank | Up to 100 saved answers; each up to 3,000 characters |
| Exports | Only the candidate's own data |
| Session resume window | 24 hours |

**Audit log:** session creation and completion, consent changes (delivery analysis, recording, sharing), score sharing events, review requests and outcomes, deletions and exports, each with user and time. Candidates can download their consent history and practice data from the Rubric and Privacy page.

---

# Part L. Data connections

| Feature | Connected to |
|---|---|
| Role, level and job posting for sessions | Job seeker profile, Jobs module (`/jobseeker/jobs`, saved jobs, applications, scheduled interviews) |
| Practice for a job or interview | Job Detail, Interviews, Application Detail (`Practice for this job`) |
| Speech-to-text, AI interviewer, feedback and drills | Hosted LLM API and speech-to-text service under the platform's data-processing terms |
| Video and microphone | Browser media permissions, managed video API (WebRTC) where used |
| Readiness score components (resume strength, profile completeness) | AI resume maker (`/jobseeker/resumes`), job seeker profile (`/jobseeker/profile`) |
| Readiness score sharing | Jobs module consent record; employer's Candidate Profile, Interview practice tab (`/startup/hiring/:jobId/applicants/:applicantId`) |
| Resume suggestions from answers | Resume Editor (suggestions follow the fact-check rules) |
| Recording and file storage | Object storage with encryption and expiring links |
| Human review of scores | Admin console, review queue, quality and bias monitoring |
| Plan limits and premium packs | Membership and Billing (`/jobseeker/billing`) |
| Notifications | ERP notification service |
| Role and permissions | Identity and access (role-based, set up by the project owner) |

---

# Part M. CSS tokens

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
  --chart-4: var(--stone-700);
}
```

---

# Part N. Build order (suggested)

1. Role guard and job seeker shell (Part A9), including consent records, plan limits and the AI data-processing rules.
2. **Scoring Rubric and Privacy page** and the rubric itself. Publish the rubrics before any scoring goes live, since they define what the AI is allowed to judge.
3. **Text-mode practice end to end:** New Practice Setup (text only), Live Practice Session (text), Feedback Report (four dimensions, suggested answers from the candidate's own facts). This is the simplest, safest slice and works without microphone or camera.
4. **Practice History** (reports, transcripts, delete), then **Trainer Home**.
5. **Voice mode** (speech-to-text, captions, device check), then **video mode**.
6. **Progress and Readiness Score** (published formula, consent-based sharing), connected to the Jobs module's consent check.
7. **Weak-Area Drills.**
8. **Delivery analysis** (opt-in, per session), only after the fairness tests described in A8 pass.
9. **Review requests** and the human review queue, bias and drift monitoring.
10. Notifications, empty, loading and error states, then mobile layouts.

**Suggested first release:** Trainer Home, text-mode practice, Feedback Report, History and the Rubric and Privacy page. Add voice and video, the readiness score and drills next, and release delivery analysis last, after it has been tested for fairness across accents, languages and speaking styles. Your proposal says AI scoring that affects people needs human review, published rubrics and bias testing, so the review queue and the sharing consent check need to exist before the readiness score is visible to any employer.

**Reminder for the build:** every route above is job-seeker-only and role-based, except the read-only public rubric view. Add the guard first, filter all practice data on the server by the signed-in user, check consent on every employer-facing request for scores, never expose recordings, transcripts or delivery analysis to employers, require explicit consent before turning on the camera, delivery analysis or recording, never send candidate data to third-party training, test the system for bias before release, keep a human review path for scores, and label every AI output. Get legal advice on biometric and recording consent, data retention, and employer use of practice results before launch.
