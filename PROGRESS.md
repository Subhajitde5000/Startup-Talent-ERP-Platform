# Backend Progress Map: Forma

Matches BUILD_PLAN.md v2 (step numbers are the same). For every step that has pages, two phases: (A) backend done and tested, (B) frontend wired, demo data removed, dev seed script updated. Tick both. Finish and test each step before the next. The agent ticks boxes after each finished step.

## Setup
- [x] AGENTS.md, BUILD_PLAN.md, PROGRESS.md in the project root
- [x] database/schema.sql and database/auth_schema.sql in place
- [x] Agent replied to AGENTS.md with a summary and questions, and I confirmed
- [x] Backend git branch created

## Step 0: Paper review
- [ ] docs/design.md written (entities, gaps vs schema.sql, permission matrix, lifecycles)
- [ ] I approved it

## Step 1: Foundation
- [x] Scaffold, config, `.env.example`
- [x] Docker Compose (Postgres, Redis, Mailpit)
- [x] Alembic first revision up and down
- [x] Error format, logging, health, CORS
- [x] `send_email()` with smtp and resend providers
- [x] Tests, lint, type check running

## Step 2: Authentication
- [x] Register and login, argon2
- [x] Access and refresh tokens, rotation and reuse detection
- [x] Logout and logout everywhere
- [x] Email verification
- [x] Password reset, change password and email
- [x] Multi-role support and role dependencies
- [x] Account states (suspended and so on)
- [x] Rate limiting and login attempts
- [x] Self-registration cannot grant the admin role (admin auth is Step 15a)
- [x] Auth tests pass (wrong role, expired, reused token, rate limit)

_Backend phase (A) complete: 32 tests pass, ruff + mypy clean, migrations up/down verified. Verification is a 6-digit OTP; password minimum is 12 characters (stricter than the frontend's current 8-character label) — frontend wiring and label fix come in phase (B)._

**Phase (B) frontend wiring:**
- [x] Typed API client generated from the backend OpenAPI schema (`lib/api/client.ts` + `lib/api/schema.d.ts`); one shared module only — base URL from `NEXT_PUBLIC_API_URL`, bearer header, single-flight token refresh with one retry, `{error:{code,message,details}}` mapping; no scattered raw `fetch`
- [x] Auth screens wired to the real API: register → role (one register call carries email+password+role) → verify (email + 6-digit code, resend works), login → `/users/me` → role landing, forgot → reset (`?token=` read from the URL); min-8 → min-12 password labels fixed; UI role labels mapped to API roles; pending email persisted across the signup steps
- [x] Loading, error and empty/deep-link states on every auth form (busy spinners, inline API errors, invalid/expired reset link and missing-draft redirects)
- [x] `AuthProvider` in the root layout; role guard in the five self-serve role shells (startup/mentor/investor/jobseeker/employer); Sign out wired to real logout in the five role headers
- [x] `next.config.js` proxies `/api/v1/*` to the backend; `lint` (`next/core-web-vitals`), `typecheck` (`tsc --noEmit`) and `gen:api` scripts added
- [x] Frontend build passes; typecheck passes; all Step 2 files lint clean; every wired page and API flow hand-tested against the running backend (register/verify/resend/login/refresh/logout/reset all confirmed through the proxy)
- [x] Dev-only seed script `backend/scripts/seed_dev.py` (6 accounts, refuses non-dev env, prints the shared dev password); no seed data in migrations
- [x] Frontend test pass
- Still demo/deferred: `/onboarding` stays on demo data until Step 3 (no profile API yet); SSO buttons remain inert (no backend SSO); `app/admin/login` untouched (Step 15a)

## Step 3: Profiles, organizations, onboarding
- [x] User profile and settings (backend 3a+gaps: PATCH /users/me incl. headline/bio/education/prior_role/din_number/founder_vision + profile_public/allow_outreach, readiness, delete request, skills GET — frontend Group A wired: founder user-profile view+edit, jobseeker readiness, mentor/investor settings, new startup+employer settings, jobseeker settings, onboarding progress persistence, dev seed script)
- [x] Organizations and members, invites (backend 3b: POST/PATCH/GET /organizations + /mine, members CRUD with roles owner/admin/member/viewer, invites create/list/revoke + POST /invites/{token}/accept, transfer-ownership, last-owner protection, outsider 403 — frontend: startup/employer/investor profile view+edit hydrate org via /organizations/mine, team directory live (members, invites, role change, remove, public toggle), new /invites/[token] accept page — verified live: create→accept→members list)
- [x] Job seeker profile and skills (3c: GET/PATCH /talent-profile/me incl. headline, summary, experience, location, preferred_mode, salary_expectation, is_searchable, hide_current_employer, skills replace-set — jobseeker profile view+edit and settings talent fields wired; skills search read-only from 3a)
- [x] Mentor profile (3c: GET/PATCH /mentor-profile/me incl. expertise/sectors/languages JSON, hourly_fee, cadence, accepting_requests — mentor profile view+edit wired)
- [x] Onboarding flow per role (all 5 flows PATCH users/me onboarding_step on step change and 'completed' on finish — verified live GET round-trip; org/talent/mentor finish data persists through the profile APIs above)
- [x] Public vs private views (separate Read schemas: public org GET /public/organizations/{slug}, public talent requires is_searchable AND users.profile_public else 404, public mentor respects profile_public — verified live)
- [x] Notification preferences stub (GET/PATCH /users/me/notification-preferences, PK user+category+channel — wired in investor/mentor notification tables + jobseeker email-alerts toggle)

## Step 4: Files (deferred, not needed for Step 5)
- [ ] R2 integration and signed upload URLs
- [ ] Validation and scan status
- [ ] Private signed downloads
- [ ] Avatar, logo, resume, deck uploads working
- [ ] Wire uploads into the places waiting for Step 4 (startup logo, pitch deck and documents list, onboarding deck upload)

## Step 5: Startup workspace (one sub-step at a time; A = backend, B = frontend wired)
Already done in Step 3: team directory, members and invites, startup organization create/edit, founder profile, account settings.

### 5a Startup profile and visibility
- [ ] A: `startup_profiles`, read/update, public read, visibility settings, stage mapping confirmed
- [ ] A: gaps decided (contacts toggle, onboarding revenue/funding/DPIIT fields)
- [ ] B: `/startup/profile`, startup onboarding flow, `/startup/stage` selector wired; demo data removed

### 5b Milestones
- [ ] A: `milestones` CRUD, cross-organization checks
- [ ] B: milestone panel wired

### 5c Tasks (core)
- [ ] A: `tasks` CRUD, move and reorder, filters, assignee and milestone validation, per-member task counts
- [ ] A: decision on the task "criterion" link
- [ ] B: `/startup/tasks` board wired

### 5d Task labels and comments
- [ ] A: labels, attach/detach, comments
- [ ] B: labels and comments wired on the board

### 5e Metrics
- [ ] A: `startup_metrics` upsert, latest, history, server-only verified sources
- [ ] B: `/startup/analytics` Overview and Journey tabs and dashboard metric cards wired

### 5f Readiness
- [ ] A: criteria bootstrap, evidence, submit, score, admin sign-off only, `tasks.readiness_id` foreign key
- [ ] B: `/startup/readiness` wired (mentor sign-off waits for Step 8)

### 5g Dashboard summary
- [ ] A: one read-only summary endpoint
- [ ] B: `/startup/dashboard` wired, unavailable cards empty or hidden

### 5h Discovery and public startup page
- [ ] A: startup list with filters, public read, visibility tests for each value

### 5i Step 5 test pass
- [ ] Click-through as founder, member, viewer, mentor, investor
- [ ] No leftover demo data on wired pages

## Step 6: Connections (only if the frontend needs it)
- [ ] Decision: needed or skipped
- [ ] Requests, accept, decline
- [ ] Blocks respected everywhere

## Step 7: Jobs and talent
- [ ] 7a Jobs and search
- [ ] 7b Applications and stages
- [ ] 7c Interviews, scorecards, offers, hires, onboarding
- [ ] 7d Saved jobs, alerts, resumes, ATS, practice
- [ ] 7e Hiring requests, shortlists, funnel
- [ ] Frontend test pass

## Step 8: Mentors
- [ ] Listing and search
- [ ] Mentorship requests
- [ ] Sessions without double booking
- [ ] Deliverables and agreements
- [ ] Earnings records
- [ ] Decision on availability slots and reviews (gaps)

## Step 9: Investors, rounds, data room
- [ ] Funding rounds
- [ ] Investor pipeline and notes
- [ ] Offers and commitments
- [ ] Portfolio
- [ ] Data room and access requests
- [ ] Document view logging
- [ ] Investor preferences and watchlist (gap decision)
- [ ] Frontend test pass

## Step 10: Community and events
- [ ] Spaces and access rules
- [ ] Posts and comments
- [ ] Reactions and counters
- [ ] Feed with cursor pagination
- [ ] Reports and moderation scans
- [ ] AMAs, events, registrations
- [ ] Frontend test pass

## Step 11: Messaging
- [ ] Threads and members
- [ ] Messages and attachments
- [ ] Read tracking, unread counts
- [ ] Polling endpoints
- [ ] Privacy tests (outsiders blocked)

## Step 12: Notifications and email
- [ ] In-app notifications
- [ ] Email notifications and templates
- [ ] Preferences
- [ ] Background processing with retries

## Step 13: Search
- [ ] Full-text indexes
- [ ] Unified search and filters
- [ ] Autocomplete
- [ ] Visibility respected in results

## Step 14: Billing and payments
- [ ] Payment provider confirmed
- [ ] Plans, entitlements, subscriptions
- [ ] Invoices and tax math
- [ ] Payments from verified webhooks
- [ ] Refunds and dunning
- [ ] Credits
- [ ] Mentor payouts with maker/checker
- [ ] Reconciliation

## Step 15: Admin console
- [ ] 15a Admin access, audit log, security alerts
- [ ] 15b Verifications, moderation, appeals, disputes, fraud
- [ ] 15c Support tickets and help centre
- [ ] 15d Data requests and compliance
- [ ] 15e Feature flags, integrations, system status, content

## Step 16: Connect the frontend
- [ ] Typed API client generated
- [ ] Auth wired
- [ ] Each role's pages on real API
- [ ] End-to-end check per role

## Step 17: Hardening
- [ ] Security review
- [ ] Performance and load test
- [ ] Authorization test sweep
- [ ] Backup and restore test
- [ ] Monitoring and error tracking

## Step 18: Deployment
- [ ] Dockerfile and environments
- [ ] Managed Postgres and backups
- [ ] CI/CD
- [ ] Domain, HTTPS, admin subdomain
- [ ] Domain email (SPF, DKIM, DMARC), provider switched to Resend
- [ ] Launch checklist and rollback plan