# Stage Pages Design: `/startup/stage` and the four stage toolkits

| Page | Route | Purpose |
|---|---|---|
| Stage Overview | `/startup/stage` | See the current stage, the roadmap across all four stages, exit criteria and the upgrade request |
| Idea Toolkit | `/startup/stage/idea` | Validate the problem and market |
| Prototype Toolkit | `/startup/stage/prototype` | Build and test an MVP |
| Early Revenue Toolkit | `/startup/stage/early-revenue` | Prove traction |
| Mature Toolkit | `/startup/stage/mature` | Scale and raise growth capital |

These pages use the same visual language as the login page, dashboard, profile and team pages: ink, ivory, one gold accent.

---

# Part A. Shared foundations

## A1. Design principles

- **One stage at a time:** the active toolkit is the focus. Past stages are viewable (read-only record); future stages are previewed but locked.
- **Exit criteria are the spine:** every toolkit page opens with "what you need to finish this stage", because moving up is the main goal.
- **Tools, not forms:** each tool is a small workspace card that opens into a full-screen view, so a startup can work without leaving the stage context.
- **Mentor-aware:** criteria a mentor or admin must review show their review status clearly.

## A2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, completed steps |
| `--ink-soft` | `#1C2B42` | Hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Current stage, progress fill, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Current-stage background, highlights |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Locked / disabled |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Met criteria, approved |
| `--warning` | `#B7791F` | In review, due soon |
| `--error` | `#B42318` | Changes requested, errors |

## A3. Typography

- **Titles and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.
- Page title 28px serif; card title 16px Inter 600; body 14px; caption 12px `--stone-700`.

## A4. Shared layout

Desktop (≥ 1200px): sidebar (same as other pages), top bar, then a 12-column grid with 24px gutters and a max content width of 1200px. Cards are white, 1px `--stone-200` border, radius 12px, padding 24px. On tablet the side column drops below; on mobile everything is a single column and the stage stepper becomes horizontally scrollable.

## A5. Shared components

### Stage stepper
Four steps: Idea → Prototype → Early revenue → Mature.
- **Completed:** ink circle with white check.
- **Current:** gold ring, `--gold-tint` background, label in ink 600.
- **Locked:** stone-200 circle, stone-400 label, lock icon.
- Connectors: 2px line, ink for completed, stone-200 for the rest. Clicking a step goes to its page (locked stages open a preview, not the tools).

### Exit criteria card
- Title: "Exit criteria for {Stage}" and a progress bar (gold on stone-200) with "3 of 5 met".
- Each criterion row: status icon, title, one-line description, evidence link, reviewer.
- Status chips:
  - `Not started` (stone)
  - `In progress` (ink outline)
  - `Submitted` (warning tint) — waiting for a mentor or admin
  - `Approved` (success tint, check)
  - `Changes requested` (error tint) with the reviewer's note expandable
- Each row has **Add evidence** (link, file, tool entry) and **Submit for review**.

### Tool card (the "toolkit tile")
- 12-column grid of tiles (3 per row on desktop). Each tile: icon, tool name, one-line purpose, a progress hint ("4 interviews logged"), and an **Open** button.
- Hover: border `--stone-400`, soft shadow `0 4px 16px rgba(15,27,45,0.06)`.
- A gold dot marks a tool that is required for an exit criterion.

### Mentor panel (side column)
Assigned mentor avatar, next session, items awaiting review, **Message mentor**. If none: **Find a mentor**.

### Resources card (side column)
Short, curated links (templates, guides, upcoming programmes) relevant to the stage. No more than five.

### Buttons and inputs
Primary: ink, white text, radius 10px, 40px high. Secondary: white with stone border. Link: `--gold-dark`. Inputs: 44px high, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.

## A6. Shared states

| State | Behavior |
|---|---|
| Loading | Skeleton tiles and rows |
| Empty tool | Dashed `--stone-200` border card with a one-line prompt and a single action |
| Save | Autosave with "Saved · just now" caption |
| Submitted for review | Row turns warning tint; toast: "Sent to your mentor." |
| Approved | Success chip; brief gold-tint highlight on the row |
| Changes requested | Error chip, reviewer note shown inline, **Resubmit** button |
| Stage completed | Full-width gold-tint banner: "You've completed the Idea stage." with **Move to Prototype** |
| No permission | Controls hidden or disabled with tooltip: "Ask an Owner or Admin." |

## A7. Role-based views

- **Owner / Admin:** all tools, submit for review, request stage change.
- **Member:** work in tools, add evidence; cannot request stage change.
- **Viewer:** read-only.
- **Mentor (viewing the startup):** read-only plus **Approve**, **Request changes** and a note on each criterion.

## A8. Motion and accessibility

- 150–200ms ease-out for hover and focus; progress bars animate once (600ms). Respect `prefers-reduced-motion`.
- WCAG 2.1 AA; gold text uses `--gold-dark`. Status is always text plus icon, never color alone.
- Stepper uses `nav` with `aria-current="step"`; locked steps announce "locked".
- Tool full-screen views trap focus and close with Esc.
- Touch targets at least 44×44px.

---

# Part B. Stage Overview: `/startup/stage`

## B1. Purpose

A single page that shows the whole four-stage journey, where the startup stands and exactly what is needed to move up.

## B2. Layout

```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Your stage"          [Request stage    │
│          │                               change]          │
│          ├────────────────────────────────────────────────┤
│          │  Stage stepper (full width)                    │
│          ├───────────────────────────────┬────────────────┤
│          │  Current stage summary        │ Mentor panel   │
│          │  Exit criteria card           │ Readiness card │
│          │  Tools for this stage         │ Resources      │
│          ├───────────────────────────────┴────────────────┤
│          │  Journey roadmap (all four stages)             │
│          │  Stage history                                 │
└──────────┴────────────────────────────────────────────────┘
```

## B3. Sections

### Header
- Title: "Your stage". Subtitle: "Where you are and what it takes to move up."
- **Request stage change** (primary): enabled only when all exit criteria are `Approved`, otherwise disabled with the tooltip "Complete all exit criteria first." Admins can also request a stage change with a reason (for example, startups joining mid-journey); a mentor or admin reviews.

### Stage stepper
Full width, as in A5, with the current stage's name and start date beneath it ("Prototype · since 12 Sep").

### Current stage summary (hero card)
- Gold-tint background, serif stage name, focus sentence ("Build and test an MVP").
- Three inline stats: criteria met, tools used, days in stage.
- Primary button: **Open {Stage} toolkit**.

### Exit criteria card
Component from A5. Shows the current stage's criteria with statuses.

### Tools for this stage
A compact 2×2 preview of the stage's tool tiles with **Open toolkit** link. Full tiles live on the toolkit page.

### Journey roadmap
A horizontal four-column comparison (stacked on mobile):

| Column | Content |
|---|---|
| Stage name and focus | e.g. "3. Early revenue · Prove traction" |
| Key tools | Short list (3–4) |
| Exit criteria | One line |
| Status | Completed / Current / Locked |

Locked stages are readable but dimmed, so founders know what comes next.

### Stage history
Timeline list: stage started, criteria approved, who reviewed, date. Past stage toolkits are linked as **View record**.

### Side column
Mentor panel, **Readiness score** mini-gauge (0–100) with link to `/startup/readiness`, and the Resources card.

## B4. Specific states

- **New startup, no stage chosen:** onboarding-style card: "Choose your starting stage" with four selectable cards and a short description each; a note that a mentor or admin may adjust it.
- **Stage change pending:** banner "Your request to move to Prototype is under review." with a **Cancel request** link.
- **Stage change declined:** banner with the reviewer's note and the criteria that need work.
- **Mature stage:** no "next stage"; the request button is replaced by "You're in the final stage. Keep your data room and reports current."

---

# Part C. Idea toolkit: `/startup/stage/idea`

**Focus:** Validate the problem and market.
**Exit to next stage:** Validated problem and a defined target customer.

## C1. Layout
Header with the stepper (Idea highlighted), exit criteria card at the top of the main column, tool tiles below, side column with the mentor panel and resources.

## C2. Exit criteria (default list)
1. Problem statement written and reviewed by a mentor.
2. At least 10 customer interviews logged, with insights summarized.
3. Target customer profile defined.
4. Market size estimated with sources.
5. Mentor confirms the problem is validated.

## C3. Tools

### 1. Idea canvas
- A one-page canvas with nine blocks: Problem, Customer segments, Unique value, Solution, Channels, Revenue idea, Cost structure, Key metrics, Unfair advantage.
- Block cards in a 3×3 grid with short text and sticky-note style editing. Autosave; version history.
- Button: **Share with mentor**.

### 2. Problem and customer interviews tracker
- Table: person, segment, date, status (Planned, Done), key insight, link to notes.
- Top summary: interviews done vs target (progress bar), top three recurring problems (auto-tagged by the team).
- **+ Log interview** opens a drawer: interviewee details, questions asked, quotes, pain-level rating (1–5), next steps.
- Insight board view: tag pains as themes, count of mentions per theme.

### 3. Market sizing template
- Guided steps: TAM → SAM → SOM, with inputs (population, price, adoption rate) and a calculation shown plainly.
- Output bar: three nested horizontal bars (ink, gold, stone-400) with values.
- Required field for each number: source. **Add source** link.

### 4. Co-founder search
- Profile of what you need (skills, commitment, location) and a browsable list of platform members who opted in as co-founder candidates.
- Card: avatar, skills chips, commitment, **Message**.
- Safeguards note: "Share only what you are comfortable sharing. Agree on equity in writing."

### 5. Customer persona (optional tile)
Simple persona card builder feeding the "target customer defined" criterion.

---

# Part D. Prototype toolkit: `/startup/stage/prototype`

**Focus:** Build and test an MVP.
**Exit to next stage:** A working MVP with first test users.

## D1. Exit criteria (default list)
1. MVP scope defined and prioritized.
2. Working prototype released to test users.
3. At least 5 test users have tried it and given feedback.
4. Feedback reviewed and next iterations planned.
5. Mentor confirms the MVP is functional.

## D2. Tools

### 1. Roadmap and sprint board
- Two views: **Roadmap** (timeline by month with themes) and **Sprint board** (columns: Backlog, In progress, In review, Done).
- Cards: title, assignee avatar, priority chip, due date, labels.
- Sprint header: sprint name, dates, burn-up bar (gold fill) and completed points.
- Drag and drop with a keyboard alternative (move buttons).

### 2. Prototype and feedback log
- Left: list of prototype versions (v0.1, v0.2…) with date, summary and link (demo URL, Figma, build).
- Right: feedback items for the selected version, with source (user, mentor, team), type (Bug, Idea, Usability), severity chip, status (New, Planned, Fixed).
- **+ Add feedback** button; convert a feedback item into a sprint card with one click.

### 3. User-testing tracker
- Table of testers: name, segment, date, session type, outcome, satisfaction score (1–5).
- Summary tiles: testers recruited, sessions done, average satisfaction (big serif numbers).
- Consent checkbox per tester (required before notes are stored). Recordings private by default.

### 4. Grant and incubator listings
- Searchable list: name, type (Grant, Incubator, Accelerator), amount or benefit, deadline, eligibility, **Save** and **Apply** (external link).
- Filters: sector, location, stage fit, deadline soon. Deadline within 14 days shows a warning chip.
- Saved items appear in a "My applications" tab with status (Saved, Applied, Shortlisted, Won, Declined).
- Listings are curated by admins; each shows a "Last updated" date.

---

# Part E. Early revenue toolkit: `/startup/stage/early-revenue`

**Focus:** Prove traction.
**Exit to next stage:** Recurring revenue and a repeatable sales motion.

## E1. Exit criteria (default list)
1. Paying customers onboarded (target set by the startup and confirmed by the mentor).
2. Recurring revenue recorded for at least 3 consecutive months.
3. Sales process documented and repeatable.
4. Unit economics (CAC, payback) calculated.
5. Mentor confirms traction.

## E2. Tools

### 1. Customer and sales pipeline
- Kanban: Lead → Contacted → Demo/Trial → Proposal → Won / Lost.
- Card: company, contact, deal value, probability, next step date.
- Header metrics: pipeline value, win rate, average deal size, average cycle length.
- Table view toggle and CSV import. Won deals can feed the revenue dashboard.

### 2. Revenue and burn dashboard
- Top KPI cards: MRR, growth month over month, cash balance, monthly burn, runway (months).
- Charts (max three colors): MRR trend (ink line, gold current point), revenue vs burn (ink and stone-400 bars), runway projection (dashed line).
- Manual entry or import; an "Add this month" quick form.
- Caption under each chart states how the number is calculated.

### 3. KPI tracker
- Customizable KPI list (for example, activation, churn, CAC, LTV, NPS) with target, current value, trend chip and owner.
- Weekly check-in view: update values in one screen; history sparkline per KPI.
- KPIs marked "shown to investors" feed the public profile traction tiles.

### 4. Hiring requests
- Open and draft hiring requests with role, urgency, headcount and status.
- **+ New hiring request** opens a form (role, skills, budget range, remote or on-site) and a **Publish to Jobs** button, linking to the Jobs module and the applicant pipeline (`/startup/hiring`).
- Applicant counts per request shown on each card.

---

# Part F. Mature toolkit: `/startup/stage/mature`

**Focus:** Scale and raise growth capital.
**Exit:** Ongoing: growth, funding rounds, exits (no further stage; criteria act as a health checklist).

## F1. Health checklist (replaces exit criteria)
Same component as A5, titled "Growth readiness". Default items: audited or reviewed financials, up-to-date cap table, board reporting cadence, complete data room, hiring plan for the next 12 months. Status is a rolling check, not a gate.

## F2. Tools

### 1. Finance and cap table
- **Finance:** P&L summary, cash flow, budget vs actual (simple tables and charts), expense categories.
- **Cap table:** table of holders (founders, employees, investors, ESOP pool) with shares, percentage and class; a bar showing ownership split (ink, gold, stone shades).
- **Round modeler:** enter a new round (amount, pre-money valuation) and preview dilution before and after, with a clear "estimate only, not legal advice" note.
- Export to CSV and PDF. Edit access limited to Owners and Admins; every change is logged.

### 2. HR and payroll basics
- Employee directory (links to Team page), roles, start dates, contract type.
- Leave tracker and simple approval flow.
- Payroll summary (monthly total, headcount cost) and export for the accountant. States clearly that it does not run payroll unless a payroll partner is integrated.
- ESOP grants list with vesting schedule view.

### 3. Board and investor reporting
- Report builder: choose a period, auto-fill KPIs, financial highlights and milestones, then add commentary.
- Template for monthly investor update and quarterly board pack; export to PDF or share inside the platform.
- Meeting log: agenda, minutes, action items assigned to team members.
- Sent reports list with who opened them.

### 4. Data room
- Folder structure: Corporate, Financials, Legal, Product, Team, Customers.
- Completeness meter (gold fill) tied to the investment-readiness checklist.
- Access control per investor (view only, no download), confidentiality agreement required before entry, audit trail of document views.
- Link to the full data room page at `/startup/data-room`.

---

# Part G. Page-level data needs

| Page / tool | Source |
|---|---|
| Stage, criteria, review status | Startup module and mentor sign-offs |
| Readiness mini-gauge | Readiness score service |
| Mentor panel | Mentor module |
| Interviews, personas, canvas | Idea toolkit data |
| Sprint board, feedback, testers | Prototype toolkit data |
| Pipeline, revenue, KPIs | Early revenue toolkit data |
| Cap table, HR, reports | Mature toolkit data |
| Hiring requests | Jobs module |
| Grant and incubator listings | Admin-curated content |
| History and approvals | Audit log |

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
}
```

# Part I. Build order (suggested)

1. Shared components: stage stepper, exit criteria card, tool tile, mentor panel.
2. Stage Overview page, including the stage change request flow.
3. Idea toolkit (canvas and interviews tracker first).
4. Prototype toolkit (sprint board and feedback log first).
5. Early revenue toolkit (pipeline and revenue dashboard first).
6. Mature toolkit (cap table and data room first).
7. Mentor review actions (approve, request changes), then empty, loading and error states and the mobile layouts.

Tip: since only one toolkit is active at a time, build the four toolkit pages on one shared template and swap in each stage's tools and criteria.
