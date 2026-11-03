# Tasks and Milestones Page Design: `/startup/tasks`

The startup's work hub. It tracks day-to-day tasks and the larger milestones they roll up into, and it connects to the stage checklist, the readiness score and mentor deliverables. It uses the same visual language as the other pages: ink, ivory, one gold accent.

## 1. Design principles

- **Fast to capture:** adding a task takes one line and the Enter key.
- **Clear ownership:** every task has an owner and a due date, and both are visible at a glance.
- **Connected to the journey:** tasks can link to a stage exit criterion, a mentor deliverable or a milestone, so everyday work moves the stage forward.
- **Calm, not noisy:** overdue and due-soon are highlighted, but the page never turns into a wall of red.

## 2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, completed milestones |
| `--ink-soft` | `#1C2B42` | Hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards, board columns |
| `--gold` | `#B8955A` | Next milestone, progress fill, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Highlights, selected state |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled, done text |
| `--stone-200` | `#E5E1D8` | Borders, tracks |
| `--success` | `#2E7D5B` | Done |
| `--warning` | `#B7791F` | Due soon |
| `--error` | `#B42318` | Overdue |

## 3. Typography

- **Page title and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.

| Element | Size / weight |
|---|---|
| Page title | 28px serif 600 |
| Card / task title | 14–16px Inter 600 |
| Body | 14px Inter 400 |
| Caption / meta | 12px Inter 400, `--stone-700` |

## 4. Layout

### Desktop (≥ 1200px)
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Tasks"            [+ New task]         │
│          ├────────────────────────────────────────────────┤
│          │  Summary strip (4 stats)                       │
│          ├────────────────────────────────────────────────┤
│          │  Tabs: Board · List · Milestones · Calendar    │
│          ├────────────────────────────────────────────────┤
│          │  Toolbar: search · filters · group · sort      │
│          ├───────────────────────────────────┬────────────┤
│          │  Main view (8–9 col)              │ Side panel │
│          │  (board / list / milestones /     │ (3–4 col)  │
│          │   calendar)                       │            │
└──────────┴───────────────────────────────────┴────────────┘
```
- 12-column grid, 24px gutters, max content width 1280px (the board may scroll horizontally).
- Cards: white, 1px `--stone-200` border, radius 12px.

### Tablet
Side panel moves below the main view. Board columns scroll horizontally.

### Mobile
Default view is **List**. Board shows one column at a time with a column switcher. **+ New task** is a sticky bottom button. Filters open in a bottom sheet.

## 5. Page header

- Title: "Tasks"; subtitle: "Plan the work, track the milestones."
- **+ New task** (primary, ink). A **+** shortcut also appears in each board column and list group.
- Secondary: **Import CSV**, **Export**.

## 6. Summary strip

| Stat | Example |
|---|---|
| Open tasks | 24 |
| Due this week | 6 (warning tint when above zero) |
| Overdue | 2 (error text, link filters the list) |
| Completed this month | 31, with a small trend chip |

A progress bar beneath, "Sprint or month progress," uses gold on stone-200.

## 7. Tabs (views)

### 7.1 Board (default on desktop)
- Columns: **To do**, **In progress**, **In review**, **Done**. Optional custom columns (admin).
- Column header: name, count, **+** button. Column background `#F4F1EA`; cards are white.
- **Task card:** title (max 2 lines), labels, assignee avatar, due chip, priority marker, small icons for comments, attachments and subtasks (for example, "3/5").
- Drag and drop to move; keyboard alternative: card menu with **Move to…**.
- Done column collapses older items after 14 days ("Show 12 older").
- Work in progress limit (optional): a column header turns warning tint when exceeded.

### 7.2 List
- Table with columns: checkbox, Task, Assignee, Due date, Priority, Status, Linked to, Labels.
- Group by: None, Status, Assignee, Due date, Milestone, Stage criterion.
- Inline editing: click a cell to change it. Row height 48px; hover `#F4F1EA`.
- **Quick add** row at the top of each group: type a title and press Enter; `@name` assigns, `#label` tags, `/date` sets the due date (for example, "Send deck to mentor @priya /fri").
- Bulk select: change status, assignee, due date, delete.

### 7.3 Milestones
- A horizontal **timeline** of milestones by month. Completed: ink filled marker. Next milestone: gold ring with `--gold-tint` card. Future: stone-200.
- Under the timeline, a **milestone card list**:
  - Title, target date, owner, status chip (Not started, On track, At risk, Done).
  - Progress bar from linked tasks (gold fill) and "7 of 12 tasks done".
  - Links to the stage exit criterion it supports (for example, "Prototype: MVP released to test users").
  - Expand to see its tasks inline.
- **+ New milestone** opens a modal: title, description, target date, owner, linked criterion.
- Status "At risk" is suggested automatically when progress lags the schedule; a person confirms it.

### 7.4 Calendar
- Month and week views. Tasks appear on their due date as small chips; milestones as gold diamonds.
- Drag a task to another day to reschedule. **Today** button and a mini list of the selected day on the side.
- Optional: connect an external calendar (read-only sync) later.

## 8. Toolbar

- **Search** by title, label or assignee.
- **Filters:** Assignee, Status, Priority, Due (Overdue, Today, This week, No date), Label, Milestone, Linked to (Stage criterion, Mentor deliverable), "Assigned to me" quick toggle.
- **Group** and **Sort** menus. **Saved views** (for example, "My week") for Owners and Admins to share with the team.

## 9. Task detail drawer

Opens from the right (480px). On mobile it is a full-screen sheet.

**Sections**
1. **Title** (editable in place) and status dropdown.
2. **Fields:** assignee (multiple allowed), due date, priority (Low, Medium, High, Urgent), labels, milestone, estimate (optional).
3. **Linked to:** stage exit criterion, mentor deliverable, hiring request, or a document from the vault, each as a clickable chip.
4. **Description:** rich text with checklists.
5. **Subtasks:** list with progress ("3/5").
6. **Attachments:** upload or pick from the Document Vault.
7. **Comments:** threaded, with `@mentions` that notify the person, and mentor comments marked with a small **Mentor** pill.
8. **Activity:** change history ("Priya moved this to In review · 2h ago").
9. **Footer:** **Mark complete**, duplicate, delete (admin).

## 10. Side panel

### My focus
- "Today and overdue" list for the signed-in user, up to 5 items, with check boxes. **View all** applies the "Assigned to me" filter.

### Stage progress
- Mini card: current stage and criteria met, with the tasks that support each unmet criterion ("2 open tasks linked"). Link to `/startup/stage`.

### Mentor deliverables
- Tasks created from mentor sessions, with due dates and a **Submit for review** action when done. Shows the sign-off status.

### Workload
- Horizontal bars per team member showing open tasks (ink bar, warning tint over capacity). Helps spread work; it is not for surveillance, and it shows counts only.

## 11. Components

- **Task card / row** as above; completed items use stone-400 text with a line-through.
- **Due chip:** neutral stone; warning tint for due within 48 hours; error tint for overdue; "Today" in gold-tint.
- **Priority:** small icon plus label (Urgent uses the error color; others use ink or stone shades).
- **Labels:** pills, radius 999px, 12px text, neutral tints.
- **Avatar stack:** up to 3 avatars plus "+2".
- **Inputs:** 44px, radius 10px, focus `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.
- **Buttons:** primary ink; secondary white with stone border; destructive error text.

## 12. Creating a task (New task modal)

**Fields**
- Title (required)
- Assignee (default: me)
- Due date
- Priority (default: Medium)
- Milestone (optional)
- Link to stage criterion (optional dropdown showing unmet criteria for the current stage)
- Description (optional)

**Buttons:** **Create task** (primary), **Create and add another**, Cancel.

**Templates:** a **Use a template** link offers stage-based task bundles (for example, "Run 10 customer interviews" for the Idea stage), which an admin can accept or edit.

## 13. States

| State | Behavior |
|---|---|
| Loading | Skeleton cards and rows |
| Empty (no tasks) | Card: "Nothing here yet. Add your first task or start from a stage template." with **+ New task** and **Use a template** |
| No results | "No tasks match your filters." with **Clear filters** |
| Task created | Toast with **Undo** for 8 seconds |
| Task completed | Short check animation; item moves to Done; toast with **Undo** |
| Overdue | Error-tinted due chip; shown first in "My focus" |
| Milestone achieved | Brief gold-tint highlight and a toast: "Milestone reached: MVP released." |
| Offline / save failure | Inline "Couldn't save. Retry" on the card; changes kept locally |
| No permission | Controls disabled with tooltip: "Ask an Owner or Admin." |

## 14. Role-based behavior

- **Owner / Admin:** create and delete anything, manage milestones, custom columns and saved views.
- **Member:** create and edit tasks, edit their own comments, move cards; cannot delete milestones.
- **Viewer:** read-only.
- **Mentor (viewing the startup):** can view all, comment, and create **deliverable** tasks that appear with a Mentor pill. They can sign off completed deliverables.

## 15. Notifications

- Assigned to you, mentioned, due tomorrow, overdue, milestone at risk, mentor comment.
- Delivered in-app and by email; users can mute per task and set a daily digest in Settings.

## 16. Motion

- 150–200ms ease-out for hover and focus; drawer slides in over 200ms.
- Cards animate into new columns (150ms); milestone progress bars animate once.
- Respect `prefers-reduced-motion`.

## 17. Accessibility

- WCAG 2.1 AA; gold text uses `--gold-dark` on light backgrounds.
- Priority and status are shown with text or icon, never color alone.
- Board: each column is a labelled list; drag and drop has a keyboard alternative; moves are announced ("Moved to In review").
- Tabs follow `role="tablist"` pattern; drawer and modals trap focus and return it to the trigger on close.
- Quick-add syntax is optional and documented in a hint below the field.
- Touch targets at least 44×44px.

## 18. Data and validation

| Field | Rule |
|---|---|
| Title | Required, 1–140 characters |
| Description | Max 5,000 characters |
| Due date | Optional; past dates allowed with a warning |
| Assignees | Up to 5 per task, active team members only |
| Subtasks | Up to 50 per task |
| Attachments | Up to 10 per task, 25 MB each, virus scanned |
| Labels | Up to 8 per task; labels managed by admins |
| Milestone | Title required, target date required |

**Audit:** task creation, assignment, status changes and deletions are logged with user and time. Completed tasks are archived after 90 days but stay searchable.

## 19. Data connections

| Feature | Connected to |
|---|---|
| Link to stage criterion | Stage module (criteria status) |
| Mentor deliverables and sign-off | Mentor module |
| Document attachments | Document Vault |
| Hiring tasks | Jobs module (hiring requests) |
| Readiness score | Completed linked tasks feed the checklist progress |
| Notifications | Notification service |

## 20. CSS tokens

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

## 21. Build order (suggested)

1. Page shell, header, summary strip and tabs.
2. List view with quick add and inline editing (the fastest to a usable page).
3. Task detail drawer with comments and attachments.
4. Board view with drag and drop.
5. Milestones view and linking tasks to milestones and stage criteria.
6. Side panel (My focus, Stage progress, Mentor deliverables, Workload).
7. Calendar view, templates, notifications.
8. Empty, loading and error states, then mobile layouts.
