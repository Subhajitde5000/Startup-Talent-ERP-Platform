# Job Seeker: AI Resume Maker Pages Design

The pages where a job seeker builds a clean, job-specific resume in minutes. They follow the six steps in your proposal: **input** (answer prompts, import an existing resume, or link a profile), **AI drafting** (turn duties into achievement-style bullets and suggest missing skills), **job tailoring** (rewrite keywords and ordering to fit a job), **ATS check** (readability for applicant-tracking systems), **templates and export** (several layouts, PDF and Word, one-click apply), and **versions** (one resume per target role, all linked to the candidate profile). It uses the same visual language as the other pages: ink, ivory, one gold accent.

> **Reminder: these pages are role-based.**
> Every page in this file belongs to the **Job seeker role** only. The project owner will add the role and permission logic, so build each page assuming the signed-in user is acting in the `job seeker` role. Resumes contain personal data: the server must return only the signed-in candidate's own resumes. Details are in **Part A9**. Do not show these pages to startups, mentors, investors or employers.

> **Reminder: the AI only reshapes the candidate's own facts.**
> The AI never invents experience, skills, dates, employers, degrees or numbers. It rewrites and reorders what the candidate provided, flags any claim it can't support, and labels everything it suggests. The candidate reviews and approves every change. This is a requirement from your proposal and it shapes every page below.

## Pages in this spec

| # | Page | Route | Purpose |
|---|---|---|---|
| 1 | My Resumes | `/jobseeker/resumes` | One resume per target role, versions, status, export and apply |
| 2 | Resume Builder | `/jobseeker/resumes/new` | Start from a guided conversation, an uploaded resume or the profile |
| 3 | Resume Editor | `/jobseeker/resumes/:resumeId` | Edit content, AI drafting of bullets, templates, preview, export to PDF and Word |
| 4 | Job Tailoring | `/jobseeker/resumes/:resumeId/tailor` | Pick a job and let the AI adjust keywords and ordering to fit it |
| 5 | ATS Check | `/jobseeker/resumes/:resumeId/ats` | Readability score for applicant-tracking systems and flagged issues |

Related pages: Apply (`jobseeker-find-apply-design.md`) uses these resumes at the "choose a resume" step. The Dashboard (`jobseeker-dashboard-design.md`) shows resume status and ATS score. The profile the resume links to is at `/jobseeker/profile`. The employer sees only the resume version the candidate submits (`startup-hiring-design.md`, Candidate Profile).

---

# Part A. Shared foundations

## A1. Design principles

- **Fast to a good first draft:** a candidate should have a usable resume within minutes, even starting from nothing.
- **Honest by design:** the AI turns real duties into stronger wording. It never adds what the candidate didn't do, and it flags weak or unsupported claims for the candidate to confirm or remove.
- **Candidate in control:** every AI suggestion is shown as a change the candidate accepts, edits or rejects. Nothing is applied silently.
- **One truth, many versions:** facts live in the profile; each resume is a selection and wording of those facts for a target role. Changing a fact updates the profile and offers to update linked resumes.
- **Plain and readable output:** clean layouts that people and applicant-tracking systems can read. No gimmicks.
- **Fair by default:** templates leave out photos, age, gender, marital status, religion, caste and similar details unless the candidate chooses otherwise, with guidance on why leaving them out is usually better.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, primary chart series |
| `--ink-soft` | `#1C2B42` | Hover / pressed, sidebar active |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards, resume paper |
| `--gold` | `#B8955A` | Progress fill, highlights, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | AI suggestion backgrounds, highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Passed checks, accepted |
| `--warning` | `#B7791F` | Needs a look, unsupported claim |
| `--error` | `#B42318` | Errors, failed checks |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`.
- **Resume output fonts** (in templates, not the app UI): ATS-safe options such as `Inter`, `Source Sans`, `Georgia` and `Calibri`-equivalent system fonts, 10–11pt body, with clear heading hierarchy. Templates avoid text in images, text boxes and tables for core content so ATS can read them.

## A4. Shared layout

Desktop (≥ 1200px): the job seeker sidebar and top bar from the dashboard, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. The editor and tailoring pages use wider split layouts (Part D, E). Tablet: side panels become drawers, sidebar becomes an icon rail. Mobile: single column, bottom tab bar, the editor shows one panel at a time (Edit, Preview, AI) with a segmented control.

## A5. Shared components

### Resume card
A small page preview (thumbnail of the first page), resume name, target role, linked job (if tailored), template name, last updated, **ATS score** chip (for example `ATS 74`), status chip, and actions: **Open**, **Tailor**, **Export**, **Use to apply**, overflow (Rename, Duplicate, Set as primary, Archive, Delete).

### Resume status chips
`Draft` (stone outline), `Ready` (success tint), `Primary` (gold-tint with star), `Tailored for {Job}` (ink outline), `Needs review` (warning tint, after profile facts changed), `Archived` (stone).

### AI suggestion block
A suggestion appears as a card with `--gold-tint` background, an `AI suggestion` pill (with a sparkle icon), the proposed text, a short **Why** line ("Adds a measurable result you mentioned in your notes"), and three buttons: **Accept**, **Edit**, **Reject**. Accepted text is inserted with a subtle gold-tint highlight that fades after 3 seconds. The original text can always be restored from version history.

### Fact flag (unsupported claim)
A small warning chip `Needs a fact` (warning tint) next to wording the AI can't support. Example: "Increased sales by 40%" with the message "I can't confirm this number from your profile. Add the figure or remove it." The AI never fills in a number on its own. A resume with open flags shows a banner at the top of the Editor and blocks **Export** until the candidate resolves or explicitly confirms them ("I confirm these are accurate").

### Source tag
Small tag beside a section or bullet showing where the fact came from: `Profile`, `Imported resume`, `You typed`, `AI-reworded from your text`. Tooltip shows the original wording.

### Score meter
A thin horizontal bar (gold on stone-200) with the number, used for ATS score and completeness.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Destructive: white with error text. Inputs 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton cards and a resume-shaped skeleton in the preview |
| Empty | One-line prompt and one action, no filler illustrations |
| Save | Autosave every few seconds with "Saved · just now"; version snapshots on major actions |
| Error | Inline message with **Retry**; local draft is kept |
| AI unavailable | Banner "AI suggestions are unavailable right now. You can keep editing." The editor, templates and export keep working without AI |
| AI limit reached | Message with the reset time and the plan upgrade link (premium resume features); manual editing and export of existing resumes still work |
| Offline | Edits save locally and sync later; AI and export are disabled until reconnected |
| Account paused or suspended | Read-only pages with a banner and **Contact support** |

## A7. Motion and accessibility

- 150–200ms ease-out for hover and focus; the accepted-suggestion highlight fades over 3 seconds. Respect `prefers-reduced-motion` (no fades, instant changes).
- WCAG 2.1 AA; gold text uses `--gold-dark`. Flags and statuses use text and icon, never color alone.
- The editor is fully keyboard operable: move between sections, reorder with keyboard shortcuts or **Move up / Move down** buttons, accept or reject suggestions with keys; focus returns to the edited item.
- The preview is rendered text (not an image) so screen readers can read it, and a **View as plain text** option shows exactly what an ATS would read.
- Drag and drop always has a button alternative. Touch targets at least 44×44px. Modals and drawers trap focus and return it to the trigger on close.

## A8. AI, privacy and conduct rules

- **Facts only:** the AI works from the profile, the candidate's imported text and what the candidate types in the guided questions. It must not add jobs, employers, dates, degrees, certifications, skills, tools or numbers that the candidate didn't provide.
- **Skill suggestions are suggestions:** "Suggested skills" are skills commonly paired with the candidate's experience, shown as options the candidate may add **only if true for them**. Each shows the evidence it was inferred from ("You mention building dashboards") or "General suggestion" when there is none, and nothing is added without a click. A reminder appears: "Only add skills you can talk about in an interview."
- **Flagging:** the AI flags exaggerated or unverifiable claims, gaps in dates, and vague wording, and asks the candidate to confirm or fix them.
- **Labeled and reversible:** all AI-generated or AI-reworded text is labeled until the candidate accepts it; after accepting, the source tag keeps showing "AI-reworded from your text." Every change is undoable and recorded in version history.
- **Bias and fairness:** the AI is bias-tested. It doesn't suggest photos, age, gender, marital status, religion, caste, nationality or family details. If the candidate adds such details, a gentle note explains they are usually not needed and may lead to bias; the choice stays with the candidate and local norms are respected. The AI never rewrites resumes to hide or change protected characteristics.
- **No hiring decisions:** the AI is a writing aid. ATS scores describe readability, not the candidate's worth. The employer makes the hiring decision.
- **Privacy:** resumes and profile data are private to the candidate until the candidate submits one in an application or makes the profile discoverable. Resume content and candidate data aren't used to train third-party models. Uploaded files are virus scanned and stored encrypted. The candidate can delete a resume at any time; resumes already submitted stay with the employer according to their retention rules (the candidate can request deletion from that employer).
- **Honesty with employers:** the platform reminds candidates that employers may verify information. A short note appears on export: "Make sure everything here is true and you can back it up."
- **Data handling:** data is encrypted in transit and at rest and follows the platform's privacy policy and applicable law (for example, India's DPDP Act).

## A9. Role-based access (to be implemented by the project owner)

These pages are **role-based**. The project owner will add the role and permission logic, so the pages should be written to expect it.

| Rule | Expected behavior |
|---|---|
| **Allowed role** | Only users acting in the `job seeker` role can open `/jobseeker/resumes/...` routes |
| **Not signed in** | Redirect to `/login`, then back to the requested page |
| **Other roles** | Startup, mentor, investor and employer users see a 403 page ("This page is for job seekers") with a link to their own home; no resume data is fetched or rendered |
| **Multi-role users** | A founder, mentor or investor who is also a job seeker switches roles via the role switcher. Resumes belong to the job seeker role and are never shown in other roles |
| **Own data only** | Resumes, versions, uploads, tailoring jobs and ATS results are returned only for the signed-in user; the server filters by user ID, never trusting an ID in the URL. Any other `:resumeId` shows 404 |
| **Employer access** | Employers see a resume only if the candidate submitted it with an application or made the profile discoverable with that field visible; the server enforces this, and submitted resumes are immutable snapshots (later edits don't change what the employer already received) |
| **AI processing** | Resume text sent to AI services is limited to what the feature needs, isn't stored by third parties for training, and is processed under the platform's data-processing terms; the server checks the user's consent and plan limits before calling the AI |
| **Plan limits** | Premium resume features (more templates, unlimited tailoring, advanced ATS checks, more versions) are enforced on the server from the plan, not only in the UI |
| **File handling** | Uploads and exports are scanned, size-limited and served through expiring, user-scoped links |
| **Admin view** | Admins can view these pages read-only for support, with an "Admin view" banner; resume content is hidden unless a dispute or safety case allows access and is logged |

Keep permission checks in one place (a guard component or middleware) so the pages themselves stay simple.

---

# Part B. My Resumes: `/jobseeker/resumes`

## B1. Purpose
A home for all resumes: one per target role, with versions, clear status and quick actions. This is the list the Apply flow and Dashboard link to.

## B2. Layout
Header with title, a short line ("One resume per kind of role works best."), and **+ New resume** (primary). Summary strip, toolbar, then a card grid (3 across on desktop) or a list view.

### Summary strip
| Stat | Example |
|---|---|
| Resumes | 4 |
| Primary resume | Product Designer (ATS 81) |
| Needs review | 1 (warning tint when above zero) |
| Used in applications | 6 |

### Toolbar
Search, filters (target role, status, tailored or general, template), sort (Last updated, Name, ATS score), view toggle (Cards or List).

## B3. Resume cards
Use the resume card (A5). The **Primary** resume is pinned first with a star. Tailored resumes show their linked job title and employer and are grouped under their parent resume (a small "3 tailored versions" expander).

### Card actions
- **Open** (Resume Editor)
- **Tailor** (opens Job Tailoring)
- **ATS check** (opens ATS Check)
- **Export** (menu: PDF, Word)
- **Use to apply** (pick a job, opens Apply with this resume selected)
- Overflow: **Rename**, **Duplicate**, **Set as primary**, **Archive**, **Delete**

### Versions
Each resume has a version history (Part D8). On the list, a small "v5 · edited 2 days ago" text opens a **Versions** drawer with restore and compare.

## B4. Profile link and sync
A banner area explains the link: "Your resumes are built from your profile. If you update a fact in your profile, we'll let you know which resumes to refresh." When profile facts change, affected resumes get a `Needs review` chip and a **Review changes** button that shows what changed (for example, a new job title) with **Update resume** or **Keep as is**. Nothing updates without the candidate's choice.

## B5. New resume entry
**+ New resume** opens the Resume Builder (Part C), with the three starting paths. If the candidate already has the maximum number of resumes for the plan, a message explains the limit with an upgrade link.

## B6. Templates quick view
A collapsible row of template previews (4–6 thumbnails) with **Browse templates**; selecting one starts a new resume with that layout.

## B7. States
- **Empty (no resumes):** a friendly start card: "Let's build your first resume. It takes about 10 minutes." with the three paths (**Answer a few questions**, **Import a resume**, **Use my profile**).
- **No results:** "No resumes match." with **Clear filters**.
- **Limit reached:** message and upgrade link; existing resumes stay usable.
- **Needs review:** chip and banner with **Review changes**.
- **Export in progress:** toast and a progress indicator; the file downloads when ready.
- **Deleted resume used in a submitted application:** the application keeps its snapshot; the list shows a confirmation note before deletion ("This resume was used in 2 applications. Those applications keep their copy.").
- **Loading error:** inline **Retry**.

---

# Part C. Resume Builder: `/jobseeker/resumes/new`

## C1. Purpose
Get from nothing, an old file or a profile to a solid first draft quickly. It implements the "Input" step of your proposal: answer prompts, import an existing resume, or link a profile.

## C2. Layout
A focused wizard: a slim header with **Save and exit**, a step indicator, the step content (max width 720px), and a right preview panel on desktop that shows the resume taking shape. On mobile the preview is a separate tab.

### Starting choice (first screen)
Three cards:
1. **Answer a few questions** (guided conversation, about 10 minutes)
2. **Import an existing resume** (upload PDF or DOCX, or paste text)
3. **Use my profile** (build from the facts already in the profile)

Below: "Not sure? Start with your profile. You can add more later."

A target-role selector appears at the top of every path: **What kind of role is this resume for?** (title or category, optional but recommended), used for wording and ordering suggestions.

## C3. Path 1: Guided conversation
A friendly, step-by-step Q and A, one topic per screen, with progress ("Step 3 of 8") and **Skip** on every optional question.

| Step | Prompts |
|---|---|
| **1. Basics** | Name, email, phone, city, links (LinkedIn, portfolio, GitHub). No photo, age, gender, marital status or similar prompts by default |
| **2. Target** | Roles you're aiming for, industry preferences, experience level |
| **3. Experience** | For each job: title, employer, dates, what you did (plain language, bullet notes are fine), and results if you remember any (numbers are optional) |
| **4. Education** | Degree, institution, dates, highlights |
| **5. Skills** | Skills and tools you use, with proficiency (optional) |
| **6. Projects and extras** | Projects, certifications, languages, volunteering, awards |
| **7. Summary** | A short professional summary, or **Let AI draft one from what you wrote** (`AI suggestion`) |
| **8. Review** | Preview and next step |

- For each experience, a prompt helps: "What were you responsible for? What changed because of your work?" with examples, and a **Prompt me** button that asks follow-up questions one by one ("Roughly how many users? What tools did you use?"). Follow-ups are optional; skipping them is fine.
- **AI drafting (inline):** after the candidate types duties, an `AI suggestion` block proposes achievement-style bullets using only their words and any numbers they gave. Bullets without supporting facts are flagged `Needs a fact`.
- The conversation saves after every step; the candidate can leave and come back.

## C4. Path 2: Import an existing resume
1. **Upload or paste:** PDF or DOCX up to 10 MB (virus scanned), or paste text. A privacy note says what happens to the file.
2. **Parsing:** a progress indicator. The parsed content appears in sections.
3. **Review the import:** a two-column view: the original on the left, the parsed fields on the right. Each field shows its source tag `Imported resume`. Parsing errors can be fixed inline (for example, dates, job titles). Low-confidence fields show a warning chip.
4. **Gaps and tips:** the AI points out gaps (missing dates, no summary, no skills section) as optional prompts, not demands.
5. **Choose what to bring in:** checkboxes to import each section (experience, education, skills, projects). An option to **Also update my profile** from the imported data (off by default; the candidate chooses which facts go into the profile).
6. **Continue** to the editor.

## C5. Path 3: Use my profile
- A selection screen listing profile sections with checkboxes: summary, experience, education, skills, projects, certifications, languages. All selected by default.
- Choose the **target role** so the AI can suggest an order and wording emphasis.
- **Create resume** builds the first draft instantly. If the profile is thin, a card shows missing parts and **Add to profile** links; the candidate can proceed anyway.

## C6. Template and finish
- After content, the candidate picks a **template** (A2 fonts, ATS-safe), accent color (ink, a neutral, or gold-tint highlight), and page length goal (one page, two pages, no limit).
- A short **Review summary** lists what the resume contains and any open `Needs a fact` flags.
- **Open in editor** (primary).

## C7. Right preview panel
Live preview as rendered text with the chosen template (not an image), updating after each step, with a **View as plain text (ATS view)** toggle. A small "Sections: 5 of 8 complete" meter.

## C8. States
- **File parse failed:** "We couldn't read this file. Try a PDF or paste the text." with **Paste text** and **Try another file**.
- **Scanned image PDF:** "This looks like a scanned image. We can try to read it, but results may need more fixing." with **Read with OCR** and **Cancel**.
- **Little information:** gentle prompt with example answers; the candidate can still proceed with a short resume.
- **AI unavailable:** the guided conversation continues without AI; the candidate types bullets and uses templates normally.
- **Exit and resume later:** drafts saved for 30 days, with a **Continue building** card on My Resumes and the Dashboard.
- **Duplicate import:** if a very similar resume exists, a note "You already have a similar resume" with **Open it** or **Continue anyway**.
- **Plan limit reached:** message with the upgrade link before starting.
- **Sensitive data detected:** if the text includes ID numbers, bank details or similar, a warning asks the candidate to remove them (resumes don't need them), with **Remove** and **Keep**.

---

# Part D. Resume Editor: `/jobseeker/resumes/:resumeId`

## D1. Purpose
The main workspace: edit content, review AI suggestions, change the template, preview and export. It covers the "AI drafting," "templates and export" and "versions" steps of your proposal.

## D2. Layout (desktop)
```
┌────────────────────────────────────────────────────────────┐
│ Header: name · status · saved · Tailor · ATS · Export      │
├───────────────┬──────────────────────────┬─────────────────┤
│ Sections      │ Edit panel               │ Live preview    │
│ outline       │ (fields, bullets,        │ (page view /    │
│ (220px)       │  AI suggestions)         │  plain text)    │
└───────────────┴──────────────────────────┴─────────────────┘
```
- On tablet, the outline collapses into a drawer and the preview opens as a drawer or tab. On mobile, a segmented control switches between **Edit**, **Preview** and **AI**.

### Header
Resume name (editable in place), status chip, target role, "Saved · just now," **Tailor to a job**, **ATS check** (shows the score chip), **Export** (menu: PDF, Word, plain text), **Use to apply**, overflow (**Rename**, **Duplicate**, **Version history**, **Set as primary**, **Archive**, **Delete**).

A **banner** appears when there are open `Needs a fact` flags: "3 claims need your confirmation before you can export." with **Review flags**.

## D3. Sections outline (left)
Ordered list of sections with drag handles and **Move up / Move down** buttons: Contact, Summary, Experience, Education, Skills, Projects, Certifications, Languages, Awards, Volunteering, Custom. Each has a visibility toggle (hide without deleting), a completeness dot, and flag counts. **+ Add section** offers the list and a custom section.

## D4. Edit panel (center)
Edits one section at a time, with the preview scrolling to match.

### Contact
Name, email, phone, city and region, links. A note: "Photos, age, marital status and similar details aren't needed. Leaving them out is usually best." The candidate can still add what they want.

### Summary
Text area (up to 500 characters) with character count. **AI draft** button (`AI suggestion`): proposes a summary using only the resume's facts, with a **Why** line; **Accept / Edit / Reject**. Alternate tones: **Concise**, **Confident**, **Friendly**, each only reshaping the same facts.

### Experience
- Entries as collapsible cards: job title, employer, location, dates (month and year, with "Present"), employment type, bullets. Reorder entries and bullets.
- **Bullets:** each bullet is a line with its source tag. Buttons per bullet: **Improve with AI**, **Add a result**, **Shorten**, **Delete**. **+ Add bullet**.
- **Improve with AI** shows a suggestion block (A5) with the rewritten bullet in achievement style (action, what, result), using the same facts. Example: original "Handled customer emails" → suggestion "Resolved customer email queries daily, keeping responses within your team's response-time goal" only if the goal is in the candidate's text; otherwise the suggestion is cleaned wording with a `Needs a fact` flag asking "How many emails per day, or what response time?" The AI never adds a number.
- **Add a result** opens a small helper with prompts: "How many?", "How often?", "How much faster or cheaper?", "Who benefited?" The candidate types the answer; the AI then phrases it.
- **Weak wording hints:** passive or vague phrases ("responsible for", "helped with") show a gentle underline with a suggestion, never forced.
- **Gap hints:** a gap of more than 6 months between jobs shows a neutral note "Optional: add a brief explanation (study, caregiving, freelance)." The candidate decides.

### Education
Entries with degree, institution, location, dates, grade (optional; "Show grade" toggle), and highlights.

### Skills
- A list of skill chips grouped by category (Technical, Tools, Languages, Soft skills). Add by typing with suggestions from the candidate's profile and experience.
- **Suggested skills** panel (`AI suggestion`): skills commonly linked to the candidate's roles, each with its evidence ("Mentioned: 'built dashboards in Tableau'") or "General suggestion." **Add** only if true. Rejected suggestions are remembered.
- Optional proficiency indicator (Beginner, Intermediate, Advanced) with a note that it's helpful but not required.

### Projects, certifications, languages, awards, volunteering
Entry forms with title, organization or link, dates and description; certifications include credential ID or link (optional); languages have levels.

### Custom sections
Title and free-form bullets.

## D5. AI panel (right drawer or tab)
A persistent panel with tabs:
- **Suggestions:** the list of open suggestions for the current section (accept, edit, reject; **Accept all safe edits** applies only wording changes that don't add facts, never flagged items).
- **Flags:** all `Needs a fact` items with a jump link and fields to add the missing fact or remove the claim. A **Confirm accurate** checkbox appears for claims the candidate wants to keep as written.
- **Consistency:** checks for inconsistent dates, tense, spelling, repeated words, different date formats, and missing links, with one-click fixes the candidate can review.
- **Length and layout:** shows page count and suggests trimming options (shorter bullets, hide older roles) without deleting anything.
- **Ask the AI:** a small command box ("Make the summary shorter", "Reorder experience by relevance to a data role"). Responses always appear as suggestions, never as direct changes.

## D6. Templates and design
A **Design** drawer:
- **Template gallery:** 4–8 ATS-safe templates (for example, Classic, Modern, Compact, Two-column-light) with previews. Premium templates are labeled if the plan limits them. Switching templates keeps content and shows a before-and-after preview.
- **Typography:** font choice from ATS-safe options, size (10, 10.5, 11pt), line spacing.
- **Layout:** margins, section spacing, date alignment, one or two page target, "Fit to one page" suggestion (reduces spacing and suggests trims, never shrinks text below readable size).
- **Accent color:** ink (default), stone, or a muted gold; headers only.
- **Section order and headings:** rename headings (for example, "Work Experience" or "Professional Experience") and reorder.
- A note: "Simple layouts get read correctly by more applicant-tracking systems."

## D7. Live preview (right)
- Shows the resume as paper (white, subtle border), real text with the chosen template; page breaks are visible. Zoom controls and page navigation.
- **View as plain text (ATS view):** shows the text order an ATS would read, so the candidate can see problems.
- Clicking a section in the preview scrolls the edit panel to it.
- A thin ATS score chip and **Open ATS check**.

## D8. Versions and history
- **Autosave** with a version snapshot after significant actions (accepting AI suggestions, template change, import, tailoring) and every 10 minutes of editing.
- **Version history drawer:** list with date, who or what made the change ("You", "AI suggestion accepted"), a short description, and **Preview**, **Restore**, **Compare** (side by side with changes highlighted). Restoring creates a new version.
- **Named versions:** the candidate can name a version ("Sent to Acme") and **Lock** it. Resumes submitted with an application are automatically stored as locked snapshots linked to that application.
- Duplicate a resume to start a new target role from the same facts.

## D9. Export
**Export** menu (opens a short confirmation drawer):
- **PDF** (text-based, selectable, ATS-friendly) and **Word (.docx)** (editable), and **Plain text**.
- File name suggestion: `Name_Role_Resume.pdf`.
- Choices: include or omit links, include a footer with "Updated {date}" (off by default).
- If there are open flags: export is blocked until they are resolved or confirmed.
- A final check: "Make sure everything here is true and you can back it up."
- Exports are generated on the server and delivered through an expiring link; the export is logged.
- **Use to apply:** pick a job and open Apply with this resume (and version) selected.

## D10. States
- **Autosave failure:** warning chip "Not saved. Retrying." with local draft kept; **Retry now**.
- **Conflict (edited in two tabs):** banner with **Keep this version**, **Load the other version** or **Compare**.
- **Open flags:** banner and blocked export (D2).
- **Resume too long:** hint "This is 3 pages. Many employers prefer 1–2." with trimming options.
- **Too short or thin:** hint to add a project or skills; no blocking.
- **Template change breaks layout:** preview warns "A long section may split across pages" with a fix suggestion.
- **AI unavailable or limit reached:** see A6; editing and export continue.
- **Profile facts changed:** `Needs review` chip with **Review changes** (as in B4).
- **Deleted or archived:** archived resumes are read-only until restored.
- **Large paste or import:** progress indicator and safe handling of formatting.
- **Locked version:** read-only with **Duplicate to edit**.

---

# Part E. Job Tailoring: `/jobseeker/resumes/:resumeId/tailor`

## E1. Purpose
Adjust a resume to fit a specific job: reflect the job's keywords and priorities by rewording and reordering the candidate's real experience. It implements the "Job tailoring" step of your proposal: paste or pick a job from the Jobs module, and the AI rewrites keywords and ordering to fit it.

## E2. Layout
A guided, three-step page with a stepper: **1. Choose a job** → **2. Review the match** → **3. Review and save changes**. A side-by-side layout on desktop: left, the job; right, the resume with proposed changes.

## E3. Step 1: Choose a job
Options (tabs):
- **Pick from the Jobs module:** search and select from saved jobs, applications in draft, recommended jobs, or search by title; the job card shows employer, title and key requirements.
- **Paste a job description:** a large text area (up to 10,000 characters) with fields for job title and company (optional). A note that pasted text stays private to the candidate.
- **Paste a job link:** for supported public job pages; if the page can't be read, the page asks the candidate to paste the text.

After choosing, the page extracts **requirements**: must-have skills, nice-to-have skills, responsibilities, seniority, keywords, and tools. The extracted list is editable so the candidate can correct it.

## E4. Step 2: Review the match
- **Match summary** (`AI suggestion`): "Your resume covers 6 of 9 key requirements." with a list:
  - **Covered:** requirement, and where it appears in the resume (section and bullet).
  - **Related but not stated:** experience the candidate has that could be phrased to match (for example, "You managed a team of 4; this job asks for 'team leadership'"). The AI proposes wording using only the candidate's facts and asks the candidate to confirm.
  - **Not on your resume:** requirements with no supporting facts. These are shown neutrally with options: **I have this** (candidate adds the fact, with a prompt for details), **Not for me**, or **Ignore**. The AI never adds them on its own.
- **Keyword view:** a simple chart or list of job keywords vs the resume, with each keyword's context so the candidate sees why it matters. No keyword stuffing: the AI limits repeats and warns against hidden text.
- **Priorities:** the AI notes what the job emphasizes (for example, "Product analytics and stakeholder communication") to guide ordering.

## E5. Step 3: Review and save changes
The proposed changes appear as a tracked diff against the current resume, section by section:
- **Reordering:** experience bullets and skills ordered by relevance (shown as moves, with **Accept** or **Keep original order**).
- **Rewording:** bullets reworded to mirror the job's language where true, as suggestion blocks with **Why** lines.
- **Summary:** a tailored summary draft.
- **Skills:** relevant skills from the candidate's own list brought forward; suggested additions only if the candidate confirmed in Step 2.
- **Hidden or de-emphasized items:** optional collapse of less relevant bullets or roles (never deleted).
- **Fact flags:** any claim without support is flagged (`Needs a fact`) and blocks saving until resolved or removed.
- **Accept all safe edits** applies only reordering and wording that adds no facts; every other change needs individual acceptance.

At the bottom: a name for the new version ("Product Designer · Acme"), and the choice of **Save as new tailored version** (default; keeps the original unchanged) or **Apply to this resume** (changes the base resume; with a warning). **Save and continue** opens the tailored resume in the Editor.

## E6. After saving
A success card: "Tailored resume saved." with the new ATS score (the check runs automatically), a comparison of match coverage before and after, and next steps: **Open in editor**, **Run ATS check**, **Apply to {Job}** (opens Apply with this version selected), **Practice for this job** (opens the interview trainer with the posting).

## E7. Rules
- Tailoring can't be used to misrepresent. If the candidate marks "I have this" for a requirement they don't have, the AI can't verify it; a reminder says: "Only add what's true. Employers may check, and you'll be asked about it in interviews."
- The tailored version links to the job and employer. It is a separate version: the original is never overwritten unless the candidate chooses to.
- The AI doesn't use personal characteristics or the employer's brand details beyond the public job text.
- Keyword stuffing, hidden text, and copying requirement lines verbatim are discouraged and flagged.

## E8. States
- **No resume content:** "Add some experience first." with **Open editor**.
- **Job text too short or unclear:** "We couldn't find enough detail." with **Paste more text**.
- **Link can't be read:** message and **Paste the text instead**.
- **Very low match:** a neutral message: "This job asks for skills that aren't on your resume yet. You can still apply, or see jobs closer to your experience." with **Similar jobs** and **Add skills I have**; never discouraging.
- **Job closed:** banner "This job has closed." Tailoring still works for practice; **Apply** is disabled.
- **AI unavailable or limit reached:** as in A6; the candidate can paste a job and review a manual keyword list without AI.
- **Tailoring limit (plan):** message with reset or upgrade link; previously tailored versions remain.
- **Flags unresolved:** **Save** disabled with a list of what to resolve.
- **Original resume has open flags:** the page asks to resolve them first or confirm them as accurate.

---

# Part F. ATS Check: `/jobseeker/resumes/:resumeId/ats`

## F1. Purpose
Shows how readable the resume is to applicant-tracking systems and flags fixable issues. It implements the "ATS check" step of your proposal: scores readability and flags issues. The score describes readability, not how good the candidate is.

## F2. Layout
Header with the resume name, version, the check date, and **Re-run check**. Left main column (8 col), right panel (4 col). Mobile stacks everything.

### Optional target
A selector at the top: **Check against a job** (pick or paste one) for a keyword match score, or **General check**. The two scores are kept separate.

## F3. Score summary
- **ATS readability score** (0–100) as a large serif number with a gold arc or bar, a label (for example, "Good"), and a note: "A guide to readability, not a measure of your ability."
- **Breakdown** with mini bars: **Format and structure**, **Section headings**, **Contact details**, **Dates and consistency**, **Readability of text**, **Length**, and (if a job was chosen) **Keyword match**.
- **Change since last check:** "▲ 8 since your last check."

## F4. Issues list
Grouped by severity with counts: **Fix first**, **Worth fixing**, **Optional**. Each issue is a card with:
- Title and plain-language explanation ("Your contact details are inside a header, which some systems skip.")
- Where it is (section and highlighted in the preview)
- **Why it matters** (one line)
- **Suggested fix** with **Fix for me** where it's safe and automatic (for example, change heading names, reformat dates, remove a table), **Edit manually**, or **Ignore**. Fixes that change meaning are shown as suggestion blocks.

Typical checks:
- Text in images, text boxes, tables or columns that may not be read in order
- Unusual fonts or special characters and symbols
- Headings that aren't standard (for example, "My journey" instead of "Experience")
- Missing contact details, missing dates, inconsistent date formats
- Overly long bullets or dense paragraphs; very long or very short resume
- Missing sections commonly expected (Experience, Education, Skills)
- File type problems for the exported file (scanned image, protected PDF)
- Keyword gaps relative to a chosen job (neutral: "This job mentions 'SQL'. If you have this skill, add it.")
- Possible unsupported claims flagged by the AI (links to the fact flags)

## F5. Plain-text and parse view
A tab **How an ATS reads your resume**: shows the extracted text in reading order, and the parsed fields (name, contact, jobs with titles, employers and dates, education, skills) as a typical system would detect them, with mismatches highlighted ("Job title not detected for 'Acme'"). The caption says that different systems read resumes differently and this is a guide.

## F6. Right panel
- **Next steps:** the top three actions, each with a button.
- **Tips:** short, specific tips with examples, labeled `AI suggestion` only when personalized.
- **Compare versions:** ATS scores across the candidate's resumes in a small list.
- **Export check:** a button to test the exported PDF and Word files, confirming text is selectable and fonts are embedded.
- **Honest note:** "ATS systems don't make hiring decisions. People usually do. A readable resume helps people find your experience."

## F7. Rules
- The score is deterministic and explained. The same resume gets the same score with the same inputs, and the rules are published on a "How we check" page. It isn't used to rank candidates and isn't shared with employers unless the candidate chooses to show it.
- Checks run on the candidate's own resume only. The candidate controls whether results are saved to the resume's history.
- No score uses personal characteristics or penalizes career gaps or non-linear careers.
- The AI explains issues but doesn't change meaning without the candidate's approval.

## F8. States
- **First check running:** progress indicator, usually a few seconds.
- **Great score:** a calm confirmation with optional tips; no confetti.
- **Low score:** neutral, constructive message "A few quick fixes will help." with the top three fixes.
- **Check failed:** inline **Retry**; the last successful result stays visible.
- **No changes since the last check:** "Nothing has changed since your last check."
- **Job chosen is closed or removed:** the keyword check stays available using the saved text.
- **Locked version:** read-only check; **Duplicate to fix**.
- **Plan limit (advanced checks):** basic readability stays free; keyword match and detailed parse view show a locked card with the plan needed.
- **AI unavailable:** the format and structure checks still run; AI explanations are replaced by standard text.

---

# Part G. Notifications for these pages

| Event | Channel |
|---|---|
| Resume draft not finished for 3 days (once) | In-app |
| Profile fact changed, resume needs review | In-app |
| Tailored resume ready or saved | In-app |
| ATS score changed significantly after an edit | In-app |
| Export ready (large or queued exports) | In-app |
| Saved job closing soon, with a tailored resume ready | In-app, email |
| Plan limit reached for resumes, tailoring or AI | In-app |
| Reminder to update the resume (every 6 months, optional) | In-app, email |

Candidates can mute, filter or set digests in Settings. Notifications never include resume text.

---

# Part H. Data and validation

| Field | Rule |
|---|---|
| Resume name | Required, 3–60 characters, unique per user |
| Resumes | Limit per plan; drafts count |
| Import file | PDF or DOCX, up to 10 MB, virus scanned; pasted text up to 20,000 characters |
| Contact details | Name, email required; phone format validated; links must be valid URLs |
| Dates | Month and year; end date after start date; "Present" allowed for the current role |
| Summary | Up to 500 characters |
| Bullets | Up to 250 characters each; up to 8 per role (soft limit with a hint) |
| Skills | Up to 40 skills; each up to 40 characters |
| Job description for tailoring | Up to 10,000 characters |
| AI requests | Limits per plan and per day; text sent is limited to what's needed |
| Fact flags | Must be resolved or confirmed before export, saving a tailored version or applying with this resume |
| Versions | Kept for 12 months; locked application snapshots are kept as long as the application exists |
| Export | PDF and DOCX generated server-side; links expire; filename sanitized |

**Audit log:** resume creation, imports, AI suggestions accepted or rejected (summary only, not full text), tailoring runs, exports, version restores, deletions and consent changes, each with user and time. Candidates can download their resume data from Settings.

---

# Part I. Data connections

| Feature | Connected to |
|---|---|
| Profile facts and sync | Job seeker profile (`/jobseeker/profile`) |
| Jobs for tailoring | Jobs module (`/jobseeker/jobs`, saved jobs, applications, recommendations) |
| Apply with a resume | Apply (`/jobseeker/jobs/:jobId/apply`) |
| Employer's view of a submitted resume | Employer Candidate Profile (`/startup/hiring/:jobId/applicants/:applicantId`), immutable snapshot |
| Practice for a tailored job | AI interview trainer (`/jobseeker/practice/new`) |
| AI drafting, tailoring and explanations | Hosted LLM API under the platform's data-processing terms |
| ATS rules and parsing | ATS check service (deterministic rules plus parser) |
| File storage and export | Object storage, document conversion service (PDF and DOCX) |
| Plan limits and premium features | Membership and Billing (`/jobseeker/billing`) |
| Notifications | ERP notification service |
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

1. Role guard and job seeker shell (Part A9), including plan limits and the AI consent and data-processing rules.
2. Resume data model: profile-linked sections, versions, locked application snapshots, source tags, fact flags.
3. **Resume Editor** without AI (sections, templates, live preview, plain-text view, export to PDF and Word). This is useful on its own.
4. **My Resumes** (list, duplicate, primary, versions).
5. **Resume Builder** with the three paths: Use my profile first, then Import, then Guided conversation.
6. **AI drafting** in the editor (summary and bullet suggestions, fact flags, suggested skills), with the "facts only" checks.
7. **ATS Check** (deterministic rules first, then job keyword match and the parse view).
8. **Job Tailoring**, once Jobs and ATS exist.
9. Notifications, plan limits, exports polish.
10. Empty, loading and error states, then mobile layouts.

**Suggested first release:** Editor with templates and export, My Resumes, Builder from the profile or an import, and a basic ATS Check. Add AI drafting and Job Tailoring next, once the fact-checking rules are in place and tested. These two are the heart of the feature, and your proposal's guardrails (never invent experience, flag unsupported claims, bias testing) must be built and checked before they go live.

**Reminder for the build:** every route above is job-seeker-only and role-based. Add the guard first, filter resumes on the server by the signed-in user, keep submitted resumes as immutable snapshots, enforce the "facts only" rule and the fact-flag export block in the AI service (not only in the UI), send the AI only what each feature needs under the platform's data-processing terms, never use candidate data to train third-party models, test the AI for bias, and label every AI suggestion with a reason. Get legal advice on resume data handling and retention before launch.
