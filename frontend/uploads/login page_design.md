# Login Page Design: Startup & Talent ERP Platform

A single sign-in for founders, mentors, investors, job seekers, employers and admins. The page should feel calm, trustworthy and premium: lots of whitespace, one accent color, no visual noise.

## 1. Design principles

- **Simple:** one primary action per screen. Nothing competes with "Sign in".
- **Premium:** deep ink + warm ivory + a single muted gold accent. No gradients, no neon.
- **Trustworthy:** the audience includes investors and founders handling confidential data, so the page looks quiet, precise and secure.
- **One account, many roles:** the login does not ask for a role. Role routing happens after sign-in (a founder can also be a mentor).

## 2. Color palette

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Brand panel background, primary text, primary button |
| `--ink-soft` | `#1C2B42` | Hover/pressed state for ink surfaces |
| `--ivory` | `#FAF8F4` | Page / form panel background |
| `--white` | `#FFFFFF` | Input background, cards |
| `--gold` | `#B8955A` | Single accent: links, focus ring, active underline |
| `--gold-dark` | `#9A7A45` | Accent hover; gold text on ivory (better contrast) |
| `--stone-700` | `#4A5568` | Secondary text, labels |
| `--stone-400` | `#A0A7B4` | Placeholder text, disabled |
| `--stone-200` | `#E5E1D8` | Borders, dividers |
| `--error` | `#B42318` | Error text and borders |
| `--success` | `#2E7D5B` | Success confirmation |

**Rules**
- Gold is used sparingly: links, focus ring, one small brand detail. Never for large fills or the main button.
- Primary button is ink on ivory, white text. This keeps it high contrast and calm.
- Text contrast: ink on ivory is about 15:1; use `--gold-dark` (not `--gold`) for gold text on light backgrounds.

### Dark mode (optional)
Swap surfaces: background `#0B1422`, card `#142033`, text `#F2EFE8`, borders `#26364D`. Keep gold at `#C9A66B`.

## 3. Typography

- **Headings:** `Playfair Display` or `Fraunces` (serif), weight 600. Gives the premium, editorial feel.
- **UI / body:** `Inter`, weights 400/500/600.
- Fallback stack: `Georgia, serif` for headings; `system-ui, -apple-system, Segoe UI, sans-serif` for body.

| Element | Size / weight | Color |
|---|---|---|
| Page title ("Welcome back") | 32px / 600 serif | `--ink` |
| Subtitle | 16px / 400 | `--stone-700` |
| Label | 14px / 500 | `--ink` |
| Input text | 16px / 400 | `--ink` |
| Helper / error | 13px / 400 | `--stone-700` / `--error` |
| Button | 16px / 600 | `--white` |

Base line height 1.5. Inputs are 16px minimum to prevent iOS zoom.

## 4. Layout

### Desktop (≥ 1024px): split screen
- **Left, 45%: brand panel** on `--ink`.
  - Logo (ivory) top-left.
  - Serif headline in ivory: *"From first idea to funded company, and the team that builds it."*
  - Small gold rule (48px × 2px) above the headline.
  - Footer line in `--stone-400`: "Mentors · Investors · Talent · Startups".
- **Right, 55%: form panel** on `--ivory`, content vertically centered, max width 400px.

### Tablet / mobile (< 1024px)
- Brand panel collapses; show only the logo at the top of the form on `--ivory`.
- Single column, 24px side padding, form fills the width.

### Spacing scale
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px. Gap between fields 20px; gap between form sections 32px.

## 5. Form structure (top to bottom)

1. **Title:** "Welcome back"
2. **Subtitle:** "Sign in to continue to your workspace."
3. **Single sign-on buttons** (Google, Microsoft, LinkedIn): outlined, white background, `--stone-200` border, 48px tall.
4. **Divider:** "or sign in with email" (lines in `--stone-200`).
5. **Email field**
6. **Password field** with show/hide toggle; "Forgot password?" link aligned right above the field in `--gold-dark`.
7. **"Keep me signed in"** checkbox (accent `--ink`).
8. **Primary button:** "Sign in" (full width, 48px, `--ink`, radius 10px).
9. **Footer text:** "New here? **Create an account**" (link in `--gold-dark`).
10. **Fine print:** "By continuing you agree to our Terms and Privacy Policy." 12px, `--stone-700`.

### Account creation entry
"Create an account" goes to a sign-up page that asks "How will you use the platform?" (Startup, Mentor, Investor, Job seeker, Employer). This choice is only for onboarding; it does not appear on the login page.

## 6. Components

**Input**
- Height 48px, radius 10px, 1px `--stone-200` border, `--white` background, 16px horizontal padding.
- Hover: border `--stone-400`.
- Focus: border `--gold`, plus 3px ring `rgba(184,149,90,0.25)`.
- Error: border `--error`, message below with a small icon.

**Primary button**
- Background `--ink`, text `--white`, radius 10px, no shadow.
- Hover: `--ink-soft`. Pressed: scale 0.99.
- Loading: spinner replaces label; width stays fixed.
- Disabled: `--stone-200` background, `--stone-400` text.

**SSO button**
- White, 1px `--stone-200` border, provider icon at left, label centered. Hover: background `#F4F1EA`.

**Links**
- `--gold-dark`, no underline by default; underline on hover and focus.

## 7. States and messages

| State | Behavior / copy |
|---|---|
| Empty field | "Enter your email address." / "Enter your password." |
| Invalid email | "That doesn't look like a valid email." |
| Wrong credentials | "Email or password is incorrect." (never say which one) |
| Too many attempts | "Too many attempts. Try again in 15 minutes or reset your password." |
| Unverified email | "Please verify your email. Resend link" |
| Account under review | "Your account is awaiting verification. We'll email you once approved." (investors, mentors, employers) |
| Success | Brief spinner, then redirect to role-based home |

- Validate on blur, not on every keystroke.
- Show errors inline under the field; focus moves to the first invalid field on submit.
- Multi-role users: after sign-in, show a quiet role switcher ("Continue as Founder / Mentor") only if they have more than one role.

## 8. Motion

- Transitions 150–200ms, `ease-out`: focus ring, hover, button states.
- Page load: form fades and rises 8px over 300ms. No looping or decorative animation.
- Respect `prefers-reduced-motion`: disable the rise and fade.

## 9. Accessibility

- WCAG 2.1 AA contrast on all text and controls.
- Visible focus ring on every interactive element (gold ring, never removed).
- Labels always visible (no placeholder-only fields); placeholders are examples only.
- Proper `autocomplete` values: `email`, `current-password`.
- Password toggle is a real button with `aria-label="Show password"` / "Hide password".
- Errors use `aria-live="polite"` and are linked via `aria-describedby`.
- Touch targets at least 44×44px. Full keyboard navigation in logical order.

## 10. Security cues (visible, not noisy)

- Small lock icon and "Secure sign-in" text near the button, in `--stone-700`.
- Two-factor step uses the same card style: six-digit code inputs, 48px squares, same focus treatment.
- No password rules on the login page; those belong on sign-up and reset.
- Support SSO and password managers; do not block paste.

## 11. Assets

- Logo: wordmark in ivory (on ink) and ink (on ivory).
- Icons: thin-line (1.5px stroke) set, such as Lucide.
- No stock photography. If imagery is added later, use a subtle ink-tinted pattern at 5% opacity on the brand panel.

## 12. Implementation notes

```css
:root {
  --ink: #0F1B2D;
  --ink-soft: #1C2B42;
  --ivory: #FAF8F4;
  --white: #FFFFFF;
  --gold: #B8955A;
  --gold-dark: #9A7A45;
  --stone-700: #4A5568;
  --stone-400: #A0A7B4;
  --stone-200: #E5E1D8;
  --error: #B42318;
  --success: #2E7D5B;
  --radius: 10px;
}
```

- Build mobile-first; use CSS variables so dark mode and future theming are a token swap.
- Reuse the same tokens for sign-up, password reset and the rest of the platform so the login page sets the visual language for every module.
