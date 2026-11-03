# Team Directory Page Design: `/startup/team`

The place where a startup manages the people behind it: founders, members, advisors and pending invites, along with their roles and what each person can access. It uses the same visual language as the login page, dashboard and profile: ink, ivory, one gold accent.

## 1. Design principles

- **Clarity of access:** anyone should see at a glance who is on the team and what they can do.
- **Safe by default:** destructive or permission-changing actions are deliberate, with confirmations and clear wording.
- **Light and fast:** inviting a person takes under 20 seconds.
- **Feeds the profile:** the team shown here populates the public startup profile, and the page makes that link obvious.

## 2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons |
| `--ink-soft` | `#1C2B42` | Hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards, table rows |
| `--gold` | `#B8955A` | Focus ring, Owner/Founder accent |
| `--gold-dark` | `#9A7A45` | Gold text and links |
| `--gold-tint` | `#F3EBDD` | Founder badge background, selected row |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, dividers |
| `--success` | `#2E7D5B` | Active status |
| `--warning` | `#B7791F` | Pending invite |
| `--error` | `#B42318` | Remove, errors |

## 3. Typography

- **Page title and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.

| Element | Size / weight |
|---|---|
| Page title | 28px serif 600 |
| Card name (member) | 16px Inter 600 |
| Table text | 14px Inter 400 |
| Caption / meta | 12px Inter 400, `--stone-700` |

## 4. Layout

### Desktop (≥ 1200px)
```
┌──────────┬────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                       │
│          ├────────────────────────────────────────────────┤
│          │  Title "Team"        [+ Invite member]         │
│          ├────────────────────────────────────────────────┤
│          │  Summary strip: 8 members · 2 pending · 3 open │
│          │  roles                                         │
│          ├────────────────────────────────────────────────┤
│          │  Toolbar: search · filters · view toggle       │
│          ├───────────────────────────────┬────────────────┤
│          │  Member list (8 col)          │ Side (4 col)   │
│          │  Table or card grid           │ • Roles guide  │
│          │                               │ • Pending      │
│          │                               │ • Hiring       │
└──────────┴───────────────────────────────┴────────────────┘
```
- 12-column grid, 24px gutters, max content width 1200px.
- Cards: white, 1px `--stone-200` border, radius 12px, padding 24px.

### Tablet
Side column moves below the list. Sidebar becomes an icon rail.

### Mobile
Members show as stacked cards (no table). **Invite member** becomes a sticky bottom button. Filters open in a bottom sheet.

## 5. Page header

- Title: "Team"; subtitle: "Manage who can access your startup workspace."
- **+ Invite member** (primary, ink). Visible only to Owners and Admins.
- Secondary: **Export list** (CSV).

## 6. Summary strip

Three compact stats in a single card:

| Stat | Example |
|---|---|
| Members | 8 active |
| Pending invites | 2 (warning tint if any are older than 7 days) |
| Open hiring requests | 3, with a **View hiring** link |

## 7. Toolbar

- **Search** by name, email or role.
- **Filters:** Role (Owner, Admin, Member, Viewer), Status (Active, Pending, Deactivated), Department (Product, Engineering, Sales, Operations, Finance, Other).
- **View toggle:** Table / Cards (table is the default on desktop, cards on mobile).
- **Sort:** Name, Role, Joined date.

## 8. Member list

### Table view
| Column | Content |
|---|---|
| Member | 40px avatar, name, email |
| Title | e.g. "Co-founder & CEO" |
| Access role | Owner, Admin, Member, Viewer (dropdown for admins) |
| Department | Chip |
| Status | Active (green dot), Pending (amber), Deactivated (grey) |
| Joined | Date |
| Public | Toggle: "Show on public profile" |
| Actions | Overflow menu (⋯) |

- Row height 64px; hover background `#F4F1EA`; selected row `--gold-tint`.
- Founders show a small gold **Founder** pill beside their name.
- Bulk select (checkbox column) reveals a toolbar: Change role, Deactivate, Remove.

### Card view
- Avatar (64px), name, title, access role chip, department chip, status, bio snippet (2 lines), LinkedIn icon.
- Footer actions: **Message**, overflow menu.

### Row overflow menu
- View profile
- Edit title and department
- Change access role
- Resend invite (pending only)
- Deactivate access
- Remove from team (error color, requires confirmation)

## 9. Member detail drawer

Clicking a member opens a right-side drawer (420px) instead of a new page.

**Sections**
1. **Header:** avatar, name, title, status, **Message** button.
2. **About:** bio, skills, LinkedIn, location. Edit view for the member themselves and admins.
3. **Access:** current role and a plain-language summary of what it allows.
4. **Workspace activity:** tasks assigned, documents last edited, last active (not tracking details beyond that).
5. **Public profile:** toggle and optional public bio and photo.
6. **Danger zone (admins only):** Deactivate / Remove.

## 10. Invite member modal

**Fields**
- Email addresses (multi-entry chips; paste a comma-separated list)
- Title (optional)
- Department (optional)
- Access role (default: Member)
- Personal message (optional)
- Toggle: "Show on public startup profile"

**Buttons:** **Send invite** (primary), Cancel.

**Rules**
- Invited people sign in or register, then join the startup with the chosen role.
- A person with an existing account (for example, a mentor or job seeker) can join without a new registration; this supports multi-role accounts.
- Invites expire after 7 days; admins can resend or revoke.
- Domain check warning: "This email is outside your company domain. Continue?" (informational, not blocking).

## 11. Access roles (side column guide)

A compact card titled **Roles at a glance**, with each role described in one line:

| Role | Can do |
|---|---|
| **Owner** | Everything, including billing, visibility settings and removing admins. One or more founders. |
| **Admin** | Manage team, profile, documents and data room. No billing. |
| **Member** | Work on tasks, upload documents they have access to, use stage tools. |
| **Viewer** | Read-only access to selected areas. Suited to advisors and interns. |

Link: **See full permissions** opens a permissions matrix (modal) with rows for modules (Tasks, Documents, Data room, Investors, Billing, Hiring) and columns for roles, using check and dash icons.

## 12. Pending invites card (side)

- List of pending invitations: email, role, sent date, **Resend** and **Revoke** actions.
- Items older than 7 days show a warning chip: "Expired. Resend?"

## 13. Hiring link card (side)

- "Need more people?" with the count of open hiring requests from the stage plan.
- Buttons: **View hiring requests**, **Post a job**. Links to the Jobs module.
- Suggestion text based on stage (for example, at the prototype stage: "Teams at this stage often hire engineers and a designer").

## 14. Components

- **Avatar:** circle, initials fallback on `--gold-tint` with `--ink` text.
- **Chips:** radius 999px, 12px text. Role chips are neutral (stone-200 background); Founder pill uses gold-tint with gold-dark text.
- **Inputs:** 44px, radius 10px, 1px `--stone-200` border; focus uses `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.
- **Primary button:** ink background, white text, radius 10px. **Secondary:** white with stone border. **Destructive:** white with `--error` text and border; turns filled error on confirm.
- **Dropdowns:** white, radius 10px, soft shadow `0 8px 24px rgba(15,27,45,0.08)`.

## 15. States

| State | Behavior |
|---|---|
| Loading | Skeleton rows (stone-200 shimmer) |
| Empty (only the founder) | Illustration-free empty card: "Your team starts here. Invite co-founders, teammates and advisors." with **Invite member** |
| No search results | "No members match your filters." with **Clear filters** |
| Invite sent | Toast: "Invite sent to name@company.com." |
| Invite error | Inline message: "That email is already on your team." |
| Role changed | Toast with **Undo** for 8 seconds |
| Remove confirmation | Modal: "Remove {Name}? They will lose access immediately. Their tasks will be unassigned." Buttons: Cancel, **Remove** |
| Last owner | Role change and removal disabled with a tooltip: "A startup needs at least one Owner." |
| No permission | Actions hidden; banner: "Only Owners and Admins can manage the team." |

## 16. Role-based views

- **Owner:** full control, including transferring ownership.
- **Admin:** invite, edit roles up to Member or Viewer, deactivate. Cannot touch Owners.
- **Member / Viewer:** read-only directory (names, titles, departments); no emails unless the admin allows it. They can edit their own entry.
- **Mentor viewing the startup:** sees the team list read-only, without emails.

## 17. Motion

- 150–200ms ease-out for hover and dropdowns; drawer slides in over 200ms.
- Newly added rows fade in with a brief `--gold-tint` highlight that fades after 2 seconds.
- Respect `prefers-reduced-motion`.

## 18. Accessibility

- WCAG 2.1 AA; use `--gold-dark` for gold text on light backgrounds.
- Table uses proper `th` and `scope`, sortable columns announce sort state.
- Status is shown by text and color, never color alone.
- Overflow menus are keyboard-operable; the drawer and modals trap focus and close with Esc, returning focus to the trigger.
- Bulk selection announces counts ("3 members selected").
- Touch targets at least 44×44px.

## 19. Data and validation

| Field | Rule |
|---|---|
| Email | Valid format, unique within the startup |
| Title | Max 60 characters |
| Department | One of the preset list or custom (max 30 characters) |
| Bio | Max 280 characters |
| Photo | PNG/JPG, up to 2 MB, square crop |
| Invites per action | Up to 20 emails |

**Audit log:** record invites, role changes, deactivations and removals with who did it and when. Show recent entries in Settings or Analytics.

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

1. Page shell, header and summary strip.
2. Member table with search, filters and sorting.
3. Invite modal and pending invites card.
4. Member drawer and row actions (change role, deactivate, remove).
5. Roles guide and permissions matrix.
6. Card view, bulk actions, mobile layout.
7. Empty, loading and error states, then audit log.
