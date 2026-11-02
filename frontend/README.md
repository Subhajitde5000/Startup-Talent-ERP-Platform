# Meridian — Startup & Talent ERP Authentication (Next.js)

Calm, institutional single sign-in built in Next.js (App Router + TypeScript) from `login page_design.md`.

## Running Locally

```bash
npm install
npm run dev
```

## Routes

- `/` & `/login` — Split-screen Login page (SSO, email/password, blur validation, 2FA step, post-login multi-role switcher, and dark mode)
- `/signup` — Onboarding account creation (`"How will you use the platform?"`: Startup, Mentor, Investor, Job seeker, Employer) with password rules
- `/forgot-password` — Password reset request flow
- `/workspace` — Role-routed workspace destination
- `/terms` & `/privacy` — Terms of Service and Privacy Policy

## Testing Design States

Use the subtle **States** / **Theme** pill in the bottom-right corner to preview any state in one click, or test organically via form input:

- **Blur validation:** Focus and blur empty fields or enter an invalid email
- **Wrong credentials:** Enter password `wrong` (5 consecutive attempts triggers rate-limit lock)
- **Unverified email:** Sign in with `unverified@meridian.io`
- **Account under review:** Sign in with `review@meridian.io`
- **Two-factor verification (2FA):** Sign in with `2fa@meridian.io` (supports pasting 6 digits; `000000` tests invalid code)
- **Multi-role switcher (Founder + Mentor):** Sign in with `claire@northstar.bio` or any SSO button
- **Single-role redirect:** Sign in with any other valid email and password
