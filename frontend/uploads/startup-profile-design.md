# Startup Profile Page Design: `/startup/profile`

The startup's identity page. It has two jobs:

1. **For the team:** one place to keep legal details, pitch summary and team information accurate.
2. **For mentors and investors:** a public-facing view (only if the founders choose) that builds confidence and shows the startup's readiness.

It uses the same visual language as the login page and dashboard: ink, ivory, one gold accent.

## 1. Design principles

- **Two views, one page:** an **Edit view** (founders and admins) and a **Public preview** (what mentors and investors see). Switching is one click, so founders always know what is visible.
- **Control first:** visibility and sharing settings are obvious, never buried.
- **Credible, not salesy:** facts, numbers and verified badges over adjectives.
- **Progressive completion:** a profile-completeness meter nudges founders to fill sections without blocking them.

## 2. Color tokens (shared)

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Headings, primary buttons, cover band |
| `--ink-soft` | `#1C2B42` | Hover / pressed |
| `--ivory` | `#FAF8F4` | Page background |
| `--white` | `#FFFFFF` | Cards, inputs |
| `--gold` | `#B8955A` | Progress, verified badge accent, focus ring |
| `--gold-dark` | `#9A7A45` | Gold text and links on light backgrounds |
| `--gold-tint` | `#F3EBDD` | Badge and highlight backgrounds |
| `--stone-700` | `#4A5568` | Secondary text |
| `--stone-400` | `#A0A7B4` | Placeholder, disabled |
| `--stone-200` | `#E5E1D8` | Borders, dividers |
| `--success` | `#2E7D5B` | Verified, saved |
| `--warning` | `#B7791F` | Needs attention |
| `--error` | `#B42318` | Errors |

## 3. Typography

- **Startup name and big numbers:** `Fraunces` / `Playfair Display`, 600.
- **UI and body:** `Inter`.

| Element | Size / weight |
|---|---|
| Startup name | 32px serif 600 |
| Tagline | 18px Inter 400, `--stone-700` |
| Section title | 20px serif 600 |
| Field label | 14px Inter 500 |
| Body | 15px Inter 400 |
| Caption | 12px Inter 400 |

## 4. Layout

### Desktop (≥ 1200px)
```
┌──────────┬────────────────────────────────────────────────────┐
│ Sidebar  │  Top bar                                           │
│ (same as ├────────────────────────────────────────────────────┤
│ dashboard│  Page header: [Edit | Public preview]  [Save]      │
│ )        ├────────────────────────────────────────────────────┤
│          │  Profile hero (cover band + logo + name + badges)  │
│          ├───────────────────────────────┬────────────────────┤
│          │  Main column (8 col)          │ Side column (4 col)│
│          │  • About / Pitch summary      │ • Completeness     │
│          │  • Problem & solution         │ • Visibility       │
│          │  • Traction highlights        │ • Key facts        │
│          │  • Team                       │ • Mentor           │
│          │  • Documents & data room      │ • Contact          │
│          │  • Funding & use of funds     │                    │
└──────────┴───────────────────────────────┴────────────────────┘
```
- 12-column grid, 24px gutters, max content width 1200px.
- Cards: white, 1px `--stone-200` border, radius 12px, padding 24px.

### Tablet
Side column moves below the main column. Sidebar collapses to an icon rail.

### Mobile
Single column. Hero stacks (logo above name). The Edit / Preview toggle becomes a sticky segmented control at the top. A sticky **Save** bar appears at the bottom when there are unsaved changes.

## 5. Page header

- Title: "Startup profile".
- **Segmented control:** `Edit` · `Public preview` (active segment: ink background, white text).
- **Save changes** (primary, enabled only when edited) and **Discard** (tertiary).
- Autosave drafts every 30 seconds; show "Saved · 2 min ago" in caption text.

## 6. Profile hero

- **Cover band:** solid `--ink`, 160px high, with a subtle gold rule at the bottom (2px). No stock photos. Optional custom cover upload (16:3).
- **Logo:** 96px square, white background, 4px white border, radius 16px, overlapping the cover band. Upload on hover in Edit view.
- **Name** (serif), **tagline** (one line, max 100 chars).
- **Meta row:** sector · city, country · founded year · team size.
- **Badges:**
  - `Stage: Prototype` (gold-tint pill, ink text)
  - `Verified startup` (success check, appears after admin business check)
  - `Investment Ready` (gold fill pill with check; only after mentor sign-off, per the proposal)
- **Actions (public view):** Request intro, Message, Save to shortlist (investors); Offer mentorship (mentors).

## 7. Sections

### 7.1 About and pitch summary
- 2–3 sentence **one-liner** and a **pitch summary** (rich text, max ~1,200 chars).
- Edit view: text area with character counter and an "Improve with AI" suggestion button (optional, clearly labeled as AI).

### 7.2 Problem, solution and market
Three compact blocks side by side (stack on mobile): **Problem**, **Solution**, **Target customer and market size**. Each has a title, 2–4 lines, and an optional supporting number (e.g. "TAM ₹1,200 Cr").

### 7.3 Traction highlights
- Up to 4 stat tiles with a big serif number and caption: MRR, customers, growth MoM, pilots.
- Optional small trend sparkline in ink with the last point in gold.
- Each number can carry a "Mentor verified" tick if confirmed.
- Founders choose which metrics are public.

### 7.4 Team
- Cards: avatar, name, role, short bio, LinkedIn link.
- Founders first, then key members. Edit view: drag to reorder, **Invite member**, permission dropdown (Admin, Member, Viewer).
- A "Hiring" chip appears on the team section if there are open roles, linking to the Jobs module.

### 7.5 Documents and data room
- List of files with type icon, name, size, updated time, and **access level** chip: `Public` · `Investors after NDA` · `Private`.
- Public view shows only permitted items; locked items show a lock and **Request access**.
- Note: "Investors must accept a confidentiality agreement before viewing the data room."

### 7.6 Funding and use of funds
- Round (e.g. Pre-seed), target raise, committed so far (progress bar: gold fill), minimum ticket.
- Use of funds as a simple horizontal stacked bar: Product, Hiring, Marketing, Operations (ink, gold, stone-700, stone-400).
- Visible to verified investors only.

### 7.7 Legal and company details (Edit view / admin only)
- Registered name, entity type, registration number, incorporation date, registered address, website.
- Verification status chip: `Verified` / `Under review` / `Action needed`.
- Never shown publicly except entity type and incorporation year.

## 8. Side column

### Profile completeness
- Progress bar (gold on stone-200) and percentage.
- Checklist of missing items, each a link that scrolls to the section: "Add a logo", "Add 2 team members", "Upload pitch deck".

### Visibility and sharing (most important control)
- Radio group with plain language:
  - **Private:** only my team
  - **Mentors only**
  - **Mentors and investors** (default recommended once complete)
- Below: toggles for what is shared (traction numbers, funding details, team contacts).
- Helper text: "Changes apply immediately. You can hide your profile at any time."
- A **Preview as investor** / **Preview as mentor** link opens the Public preview.

### Key facts
Small definition list: Stage, Readiness score (e.g. 72 / 100 with a mini gauge), Founded, Location, Sector, Business model.

### Mentor
Assigned mentor avatar and name, sign-off progress ("4 of 6 items"), link to the Mentor module.

### Contact
Primary contact, website, email, phone. In the public view, these are replaced by **Message** and **Request intro** so contact goes through the platform.

## 9. Components

- **Inputs:** 48px high, radius 10px, 1px `--stone-200` border; focus uses `--gold` border plus 3px ring `rgba(184,149,90,0.25)`.
- **Primary button:** ink, white text, radius 10px. **Secondary:** white with stone border. **Link:** `--gold-dark`.
- **Edit-in-place:** in Edit view, each section card has a pencil icon; clicking opens inline fields rather than a new page.
- **Pills and badges:** radius 999px, 12px text.
- **Modals:** white, radius 16px, used for logo crop, invite member and access requests.

## 10. States

| State | Behavior |
|---|---|
| New profile | Hero and sections show prompts ("Add your one-liner") with dashed `--stone-200` borders |
| Loading | Skeleton blocks |
| Unsaved changes | "Unsaved changes" chip in the header; confirm dialog when leaving |
| Save success | Toast: "Profile updated." |
| Validation error | Inline message under field, focus moves to first error |
| Under review | Banner: "Your business details are being verified. This usually takes 1–2 business days." |
| Hidden profile | Banner: "Your profile is private. Mentors and investors can't see it." with **Change visibility** |
| No permission | Fields read-only with a lock icon; "Ask an admin to edit." |

## 11. Role-based views

- **Founder / admin:** full edit, visibility, legal details.
- **Team member:** edit allowed sections (bio, tasks), no legal or visibility controls.
- **Mentor:** read-only plus sign-off shortcuts and a note box.
- **Investor:** public view only, with Request intro, Shortlist and Request data room access. Access is logged (audit trail of document views), and the page shows the disclaimer: "The platform introduces parties and is not a broker or adviser."

## 12. Motion

- 150–200ms ease-out for hover, focus and toggles.
- Sections fade in with an 8px rise, staggered 40ms. Progress bars animate once.
- Switching Edit ⇄ Preview crossfades (150ms). Respect `prefers-reduced-motion`.

## 13. Accessibility

- WCAG 2.1 AA; use `--gold-dark` for gold text on light backgrounds.
- Every input has a visible label; image uploads have required alt text for the logo.
- Badges include text, not just color or icon. Verified status is announced to screen readers.
- Segmented control uses proper `role="tablist"`; the visibility radio group has a `fieldset` and legend.
- Keyboard-reorderable team list (move up/down buttons as an alternative to drag).
- Touch targets at least 44×44px.

## 14. Data and validation

| Field | Rule |
|---|---|
| Name | Required, 2–60 characters |
| Tagline | Max 100 characters |
| One-liner | Max 160 characters |
| Pitch summary | Max 1,200 characters |
| Logo | PNG/JPG/SVG, up to 2 MB, square crop |
| Website | Valid URL |
| Registration number | Required for verification; format checked by country |
| Documents | PDF, PPTX, XLSX; up to 25 MB each; virus scan on upload |

Profile completeness is calculated from: logo, tagline, pitch summary, problem/solution, at least one traction metric, at least two team members, pitch deck uploaded, legal details verified.

## 15. CSS tokens

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

## 16. Build order (suggested)

1. Page shell, header and Edit / Preview toggle.
2. Hero with logo, badges and meta row.
3. About, problem/solution and traction sections.
4. Team and documents sections.
5. Side column: completeness, visibility settings, key facts.
6. Funding, legal details, role-based views.
7. Empty, loading, error states and mobile layout.
