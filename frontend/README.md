# Meridian — Startup & Talent ERP Authentication (Next.js)

Calm, institutional single sign-in and three-step registration built in Next.js (App Router + TypeScript) from `login page_design.md`.

## Running Locally

```bash
npm install
npm run dev
```

## Recommended Registration Flow

1. `/register` — **Step 1 of 3:** Account registration (`name`, `email`, `password` with password rules, or SSO via Google / Microsoft / LinkedIn)
2. `/verify-email` — **Step 2 of 3:** Confirm the email address (`48px` six-digit verification code squares with paste & resend support)
3. `/register/role` — **Step 3 of 3:** Onboarding role selection (`"How will you use the platform?"`: Startup, Mentor, Investor, Job seeker, Employer)

## Additional Routes

- `/` & `/login` — Split-screen Login page (SSO, email/password, blur validation, 2FA step, post-login multi-role switcher, and dark mode)
- `/signup` — Redirects cleanly to `/register`
- `/register/verify-email` — Redirects cleanly to `/verify-email`
- `/forgot-password` — Password reset request flow
- `/workspace` — Role-routed workspace destination
- `/terms` & `/privacy` — Terms of Service and Privacy Policy

## Testing Design States

Use the subtle **States** / **Theme** pill in the bottom-right corner on `/` to preview any login state in one click, or test organically:

- **3-step registration:** `/register` -> `/verify-email` (enter or paste any 6 digits, e.g. `123456`; `000000` tests invalid code) -> `/register/role` -> `/workspace`
- **Duplicate email on `/register`:** Register with `existing@meridian.io`
- **Wrong credentials on `/`:** Enter password `wrong` (5 consecutive attempts triggers rate-limit lock)
- **Unverified email on `/`:** Sign in with `unverified@meridian.io`
- **Account under review on `/`:** Sign in with `review@meridian.io`
- **Two-factor verification (2FA) on `/`:** Sign in with `2fa@meridian.io`
- **Multi-role switcher (Founder + Mentor) on `/`:** Sign in with `claire@northstar.bio` or any SSO button
