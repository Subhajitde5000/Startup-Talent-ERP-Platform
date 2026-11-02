# Meridian — Startup & Talent ERP Authentication & Onboarding (Next.js)

Calm, institutional single sign-in and five-stage onboarding built in Next.js (App Router + TypeScript) from `login page_design.md`.

## Running Locally

```bash
npm install
npm run dev
```

## Full Registration & Onboarding Workflow

1. **`/register` — Registration Page (Step 1 of 4)**
   Collects Full name, Email, and Password (with password rules) or SSO via Google, Microsoft, or LinkedIn.
2. **`/verify-email` — Email Verification (Step 2 of 4)**
   Confirms the email address via six `48px` square verification code inputs with paste and resend support.
3. **`/register/role` — Role Selection (Step 3 of 4)**
   Choose `Startup`, `Mentor`, `Investor`, `Job seeker`, or `Employer`.
4. **`/onboarding` — Role-Specific Onboarding (Step 4 of 4)**
   Dynamically adapts to collect profile and role-specific details for each of the 5 roles:
   - **Startup:** Company name, one-line overview, funding stage, team size, primary sector, immediate priorities, website
   - **Mentor:** Current role & organization, operating experience, monthly availability, mentorship areas, preferred stages, LinkedIn
   - **Investor:** Investor type, firm/entity name, check size, target stage, thesis sectors, firm website/LinkedIn
   - **Job seeker:** Target discipline/title, experience, work preference, core skills & stack, preferred startup stages, portfolio/GitHub/LinkedIn
   - **Employer:** Company name, hiring lead title, company size, hiring timeline, hiring functions, company website
5. **`/dashboard` — Dashboard**
   Opens the selected role's ERP workspace displaying the onboarded profile, role switcher, tailored metrics, and next-step workflows.

## Additional Routes

- `/` & `/login` — Split-screen Login page (SSO, email/password, blur validation, 2FA step, post-login multi-role switcher, and dark mode)
- `/signup` — Redirects cleanly to `/register`
- `/workspace` — Redirects cleanly to `/dashboard` (preserving query parameters)
- `/forgot-password` — Password reset request flow
- `/terms` & `/privacy` — Terms of Service and Privacy Policy
