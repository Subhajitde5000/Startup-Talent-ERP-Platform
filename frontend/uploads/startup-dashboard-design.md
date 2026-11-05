# Startup Dashboard Design: `/startup/dashboard`

The home screen for a startup founder or team member. It answers three questions at a glance: **Where are we? What should we do next? Who is helping or watching?** It uses the same visual language as the login page (ink, ivory, one gold accent).

## 1. Design principles

- **Calm and scannable:** a founder opens this daily. Show progress and next actions first, details second.
- **Stage-aware:** the dashboard changes with the startup's stage (Idea, Prototype, Early revenue, Mature), per the proposal.
- **One accent:** gold marks progress and "current" only. Everything else is ink, stone and ivory.
- **Action over decoration:** every card ends in a clear next step or link.

## 2. Color tokens (shared with login)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Sidebar, headings, primary buttons |
| `--ink-soft` | `#1C2B42` | Sidebar hover / active background |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards |
| `--gold` | `#B8955A` | Progress fills, current stage, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links on light backgrounds |
| `--gold-tint` | `#F3EBDD` | Soft highlight behind current stage / badges |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, dividers |
| `--success` | `#2E7D5B` | Completed, positive trend |
| `--warning` | `#B7791F` | Due soon |
| `--error` | `#B42318` | Overdue, errors |

Charts use ink as the main line, gold as the highlight, and stone-400 for comparison. Never use more than three colors in one chart.

## 3. Typography

- **Headings and big numbers:** `Fraunces` or `Playfair Display` (serif), 600.
- **UI and body:** `Inter`, 400/500/600.

| Element | Size / weight |
|---|---|
| Page title | 28px serif 600 |
| Card title | 16px Inter 600 |
| KPI number | 32px serif 600 |
| Body | 14px Inter 400 |
| Caption / meta | 12px Inter 400, `--stone-700` |

## 4. Layout

### Desktop (≥ 1200px)
```
┌──────────┬───────────────────────────────────────────────┐
│          │  Top bar: search · notifications · profile    │
│ Sidebar  ├───────────────────────────────────────────────┤
│ 240px    │  Welcome + stage banner                       │
│          ├───────────────────────────────────────────────┤
│          │  KPI row (4 cards)                            │
│          ├──────────────────────────┬────────────────────┤
│          │  Stage checklist (8 col) │ Readiness (4 col)  │
│          ├──────────────────────────┼────────────────────┤
│          │  Tasks & milestones      │ Mentor             │
│          ├──────────────────────────┼────────────────────┤
│          │  Investor interest       │ Hiring requests    │
│          ├──────────────────────────┴────────────────────┤
│          │  Activity feed · Documents · Team             │
└──────────┴───────────────────────────────────────────────┘
```
- 12-column grid, 24px gutters, content max width 1280px, page padding 32px.
- Card: white, 1px `--stone-200` border, radius 12px, padding 24px, no heavy shadows (optional `0 1px 2px rgba(15,27,45,0.04)`).

### Tablet (768–1199px)
Sidebar collapses to a 72px icon rail. Cards go to two columns.

### Mobile (< 768px)
Sidebar becomes a bottom tab bar (Home, Tasks, Mentor, Investors, More). Cards stack in one column; KPI cards scroll horizontally.

## 5. Navigation

### Sidebar (ink background, ivory text)
- Logo (top)
- **Dashboard** (active: `--ink-soft` background, 3px gold bar at left)
- Stage Toolkit
- Tasks & Milestones
- Team
- Documents (vault and data room)
- Mentor
- Investors
- Hiring (links to Jobs module)
- Analytics
- *Bottom:* Settings, Help, **role switcher** (e.g. "Founder · Mentor") for multi-role accounts

### Top bar
Global search, notification bell (gold dot when unread), startup switcher (if the user belongs to more than one), profile menu.

## 6. Sections and components

### 6.1 Welcome and stage banner
- Greeting: "Good evening, {Name}" with startup name and logo.
- **Stage stepper:** four steps (Idea → Prototype → Early revenue → Mature). Completed steps are ink with a check, the current step has a gold ring and `--gold-tint` background, future steps are stone-200.
- Under the stepper: "Next stage: Prototype · 6 of 10 exit criteria met" and a button **View exit criteria**.

### 6.2 KPI row (4 cards)
Content adapts to stage. Example for Early revenue:

| Card | Value | Detail |
|---|---|---|
| Readiness score | 72 / 100 | +5 this month |
| MRR | ₹4.8L | +12% vs last month |
| Runway | 9 months | burn ₹3.1L / mo |
| Open tasks | 14 | 3 due this week |

Idea stage shows: interviews done, problems validated, market size drafted, tasks open. Prototype stage shows: sprint progress, test users, feedback items, tasks open.

Each card: label (caption), big serif number, small trend chip (green up, red down).

### 6.3 Stage checklist (main card)
- Title: "Stage checklist: Prototype".
- Progress bar (gold fill on stone-200 track) with percentage.
- List of checklist items with checkbox, title, owner avatar, due date. Completed items are struck through in stone-400.
- Footer: **Open stage toolkit →**.

### 6.4 Investment readiness (side card)
- Circular gauge (0–100), ink track, gold arc, score in center in serif.
- Breakdown mini-list: Checklist 80%, Traction 65%, Mentor feedback 70%.
- Badge: "Investment Ready" shown only when the mentor signs off everything (gold-tint pill with a small check). Otherwise: "3 items left for mentor sign-off".

### 6.5 Tasks and milestones
- Tabs: **My tasks** · **Team** · **Milestones**.
- Rows: checkbox, title, assignee avatar, due chip (warning when due soon, error when overdue).
- Milestones show as a slim horizontal timeline with the next milestone highlighted in gold.
- Button: **+ New task**.

### 6.6 Mentor card
- Mentor avatar, name, expertise, "Next session: Thu 4:00 PM" with **Join** button (appears 10 minutes before).
- Sign-off progress: "4 of 6 readiness items signed off".
- If no mentor: empty state with **Find a mentor**.

### 6.7 Investor interest
- Small stats: profile views, shortlists, messages.
- List of the last 3 interested investors (name, firm, status chip: Viewed / Shortlisted / In talks).
- Visible only if the founders opted in to the public profile; otherwise show a prompt: "Make your profile visible to investors" with a toggle.

### 6.8 Hiring requests
- Open requests from the stage plan (e.g. "Backend engineer · 12 applicants").
- Link to the Jobs module: **Post a job**, **Review applicants**.

### 6.9 Activity feed
Chronological list: "Mentor signed off Unit economics", "Priya uploaded Pitch deck v3", "Investor viewed your data room". Icon, text, relative time. Show 6, with **View all**.

### 6.10 Documents and team
- **Documents:** 4 recent files with type icon, name, updated time. Button **Open vault**.
- **Team:** avatar stack with roles, **Invite member** button.

## 7. Buttons and controls

- **Primary:** ink background, white text, radius 10px, 40px high.
- **Secondary:** white, 1px `--stone-200` border, ink text.
- **Tertiary / link:** `--gold-dark` text, underline on hover.
- Focus: 3px ring `rgba(184,149,90,0.25)` and 1px `--gold` border.
- Chips: radius 999px, 12px text; success / warning / error use tinted backgrounds with matching dark text.

## 8. States

| State | Behavior |
|---|---|
| Loading | Skeleton cards (stone-200 shimmer), no spinners on the whole page |
| Empty (new startup) | Friendly card per section with one clear action, e.g. "Add your first task" |
| Error | Inline card message with **Retry**; the rest of the page stays usable |
| No permission | Card hidden or shown locked with "Ask an admin for access" (role-based: founder, member, viewer) |
| Stage change | Gold confirmation banner: "You've moved to Prototype stage." The checklist and KPI cards swap to the new stage |

## 9. Role-based variations (within the same page)

- **Founder / admin:** sees everything, including billing, investor interest, team permissions.
- **Team member:** sees tasks, checklist, documents they have access to; no billing or investor details.
- **Mentor viewing a startup:** read-only view with the **Sign off** control on checklist items.

## 10. Motion

- 150–200ms ease-out for hover and focus.
- Progress bars and the readiness gauge animate once on load (600ms).
- Cards fade in with a slight 8px rise, staggered 40ms. Respect `prefers-reduced-motion`.

## 11. Accessibility

- WCAG 2.1 AA contrast; gold text uses `--gold-dark` on light backgrounds.
- Progress is never shown by color alone: always include numbers or labels.
- Semantic landmarks (`nav`, `main`, `aside`), a skip-to-content link, and logical tab order.
- The gauge and charts have text alternatives (e.g. "Readiness score 72 out of 100").
- Touch targets at least 44×44px. Live regions announce notifications and task updates.

## 12. Data needed per section (for the build)

| Section | Source |
|---|---|
| Stage and exit criteria | Startup module (stage config) |
| Readiness score | Checklist completion + traction + mentor feedback |
| KPIs | Revenue/burn dashboard, task counts |
| Mentor | Mentor module (sessions, sign-offs) |
| Investor interest | Investor module (views, shortlists) |
| Hiring requests | Jobs module |
| Activity feed | Audit log |

## 13. CSS tokens

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

## 14. Build order (suggested)

1. App shell: sidebar, top bar, grid.
2. Stage banner and KPI cards.
3. Stage checklist and readiness gauge.
4. Tasks, mentor, investor, hiring cards.
5. Activity feed, documents, team.
6. Empty, loading and error states, then mobile layout.
