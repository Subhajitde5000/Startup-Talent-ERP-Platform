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
- [x] 3d Team management completion, A: backend (deactivate/reactivate + bulk all-or-nothing, resend invite with token rotation and rate limits, invite email via background task + message/is_public columns, last_active_at throttled, server-side filters/sort/pagination, activity_events audit log, CSV export, tasks unassigned on remove, owner transfer only via transfer-ownership (role=owner is 422), member drawer data with LinkedIn/bio gated by is_public, team summary with open_jobs_count null until 7a, permissions matrix at GET /organizations/permissions — migration 0015; 464 tests pass on SQLite and PostgreSQL 16)
- [x] 3d Team management completion, B: /startup/team wired — deactivate/reactivate (single, drawer, menu), resend invite with token rotation, revoke, bulk deactivate/remove/revoke (all-or-nothing), server-side filters/sort/search/pagination, real last_active_at, server CSV export, open-roles empty state (open_jobs_count null until 7a), permission matrix rendered from GET /organizations/permissions (Roles at a glance + modal + role capability text), drawer LinkedIn/bio gated by is_public, Message button disabled for Step 11, per-field 422 display on the invite form — verified live as owner/member/viewer

## Step 4: Files (deferred, not needed for Step 5)
- [ ] R2 integration and signed upload URLs
- [ ] Validation and scan status
- [ ] Private signed downloads
- [ ] Avatar, logo, resume, deck uploads working
- [ ] Wire uploads into the places waiting for Step 4 (startup logo, pitch deck and documents list, onboarding deck upload)

## Step 5: Startup workspace (one sub-step at a time; A = backend, B = frontend wired)
Already done in Step 3: team directory, members and invites, startup organization create/edit, founder profile, account settings.

### 5a Startup profile and visibility
- [x] A: `startup_profiles`, read/update, public read, visibility settings, stage mapping confirmed
- [x] A: gaps decided (contacts toggle, onboarding revenue/funding/DPIIT fields)
- [x] B: `/startup/profile`, startup onboarding flow, `/startup/stage` selector wired; demo data removed

### 5b Milestones
- [x] A: `milestones` CRUD, cross-organization checks
- [x] B: milestone panel wired

### 5c Tasks (core)
- [x] A: `tasks` CRUD, move and reorder, filters, assignee and milestone validation, per-member task counts
- [x] A: decision on the task "criterion" link: maps to a `startup_readiness` stage-checklist row (5f); `tasks.readiness_id` created now without its FK and kept out of every 5c schema
- [x] B: `/startup/tasks` board wired (board, list, calendar and milestone progress on real tasks; labels, comments and criterion links stay hidden until 5d/5f); team directory shows the real per-member `task_count`

### 5d Task labels and comments
- [x] A: `task_labels` / `task_label_links` / `task_comments` (migration 0016). Label CRUD is owner/admin (labels "managed by admins", D-7); attach/detach is one replace-set `PUT /tasks/{id}/labels` (member+), capped at 8 per task and validated same-org (422 on cross-org ids, never a 404 oracle). Names unique per org case-insensitively (functional unique index, D-1); labels hard-deleted so a name can be reused (D-4). Comments: flat, author edits only, author-or-owner/admin soft delete, rate-limited per actor, `author_id` never client-writable. `TaskRead.labels` loaded in ONE batched query per list; `GET /tasks?label_id=` filter. Create/delete comments write audit rows (D-9b) so the 5g feed has real content. 108 new tests; 572 pass on SQLite and PostgreSQL 16.2
- [x] B: labels and comments wired on the board. `/startup/tasks` gained the org label catalogue (read for every role, managed inline by owner/admin: create/rename/recolour/delete, `LABEL_NAME_TAKEN` and the 422 colour error shown on the field), per-task attach/detach through the replace-set `PUT`, and a flat comment thread with author-only edit plus author-or-owner delete (driven by the API's own `can_edit`/`can_delete`, never guessed from role). Pills render on board cards, in the list view's Labels column and in the task drawer. Errors: `403` for a viewer write, `409 LABEL_LIMIT_REACHED`, `429 RATE_LIMITED` all surface as messages. Eight client methods added to `@/lib/api/client` using the shared `apiRequest`/`ApiError`/auto-refresh path; `schema.d.ts` regenerated (additive, no lines removed)

### 5e Metrics
- [x] A: `startup_metrics` upsert, latest, history, server-only verified sources
- [x] B: `/startup/analytics` Overview and Journey tabs wired to real metrics (dashboard metric cards move to 5g, approved)

### 5f Readiness
- [x] A: criteria bootstrap, evidence, submit, score, admin sign-off only, `tasks.readiness_id` foreign key
- [x] B: `/startup/readiness` wired (mentor sign-off waits for Step 8)

### 5g Dashboard summary
- [x] A: one read-only `GET /organizations/{id}/dashboard-summary` (any active member). Reuses the 5i stage roll-up, the 5f readiness score and the 5e newest-per-key metrics rather than recomputing them; ~8 constant queries, no N+1. My-tasks counters are scoped to the caller. Absent metrics stay absent (never 0) and cards with no source are named in `unavailable` with the step that supplies them (mentor 8, investors 9, hiring 7, documents 4, readiness breakdown). Viewers get no money: keys withheld and named in `restricted` (D-8). Metric values are decimal strings, never floats
- [x] B: `/startup/dashboard` wired to the aggregate summary; unavailable cards hidden. KPI row, stage card, task/milestone list, readiness gauge, activity feed and team card all read real data. Stage checklist reads the real 5i exit criteria for the *current* stage (read-only — sign-off is owned by `/startup/stage`), replacing the six invented titles. Mentor (8), investor interest (9), hiring (7) and the document list (4) are hidden rather than stubbed; the server's `unavailable` reasons are still surfaced where they help. Readiness keeps its one real score — the Checklist/Traction/Mentor sub-bars are gone because only one score exists. Task cards are labelled "My open tasks" and the "Team" tab was dropped, because the summary's task section is scoped to the caller

### 5h Discovery and public startup page
- [x] A: startup list with filters, public read, visibility tests for each value

### 5i Stage criteria and progress
- [x] A: stage exit criteria source decided (readiness rows by stage), `startup_stage_history` proposed and built, stage change history written in the same transaction
- [x] B: /startup/stage and the five stage pages wired; demo data removed

### 5j Stage tools (GAP)
- [x] A: generic `stage_tool_progress` proposed and built; specialized tools listed with a decision for each
- [x] B: tool panels on the stage pages wired

### 5k Analytics: business tab (GAP)
- [x] A: extra metric keys and funnel model proposed and built; calculated values computed in the service
- [x] B: /startup/analytics Business tab wired

### 5l Analytics: market tab (GAP)
- [x] A: market size and competitors proposed and built, visibility toggles enforced
- [x] B: /startup/analytics Market tab (market size, competitors) wired

### 5m Analytics: journey tab and leftovers (build after Steps 7, 8, 9)
- [ ] A: aggregate endpoints, anonymous benchmark rule with a minimum group size
- [ ] B: /startup/analytics Journey tab and remaining cards wired

### 5n Step 5 test pass
- [ ] Click-through of 5a to 5l as founder, member, viewer, mentor, investor (repeat for 5m when built)
- [ ] No leftover demo data on wired pages

## Step 6: Connections (only if the frontend needs it)
- [ ] Decision: needed or skipped
- [ ] Requests, accept, decline
- [ ] Blocks respected everywhere

## Step 7: Hiring (one sub-step at a time; A = backend, B = frontend wired)

### 7a Jobs (employer)
- [ ] A: Create, edit, publish, pause, close and archive jobs; salary and equity ranges; job visibility. Jobs belong to an organization of type employer or startup (startups hire too)
- [ ] B: /employer/jobs/new, /employer/jobs/[jobId]/edit, /employer/jobs/[jobId] (job details), /employer/hiring wired; demo data removed

### 7b Job search and company pages (job seeker)
- [ ] A: Search with filters and pagination, job detail, company page, startups that are hiring
- [ ] B: /jobseeker/jobs, /jobseeker/jobs/[jobId], /jobseeker/companies/[companyId], /jobseeker/startups wired; demo data removed

### 7c Apply and my applications
- [ ] A: Apply with profile, cover note and screening answers; duplicate and deadline checks; withdraw; stage history visible to the applicant
- [ ] B: /jobseeker/jobs/[jobId]/apply, /jobseeker/applications, /jobseeker/applications/[applicationId] wired; demo data removed

### 7d Applicant pipeline (employer)
- [ ] A: Applicants per job with filters, applicant detail, stage changes with history, private notes, reject reasons, blind-review mode
- [ ] B: /employer/jobs/[jobId] (applicants), /employer/jobs/[jobId]/applicants/[applicantId] wired; demo data removed

### 7e Scorecards and compare
- [ ] A: Scorecard templates and criteria, scores per applicant, side-by-side compare
- [ ] B: /employer/jobs/[jobId]/compare, scoring panel on the applicant page wired; demo data removed

### 7f Interviews
- [ ] A: Schedule, participants, feedback, reschedule, cancel; applicant view
- [ ] B: /employer/interviews, /jobseeker/interviews wired; demo data removed

### 7g Offers
- [ ] A: Create and send offers, approval, accept, decline, expire, decline reasons, applicant compare
- [ ] B: /employer/offers, /employer/offers/[offerId], /jobseeker/offers, /jobseeker/offers/[offerId], /jobseeker/offers/compare wired; demo data removed

### 7h Hires and onboarding
- [ ] A: Turn an accepted offer into a hire; onboarding templates and checklist; hire documents (documents need Step 4)
- [ ] B: /employer/hires, /employer/hires/[hireId], /employer/templates (onboarding part) wired; demo data removed

### 7i Hiring requests and approvals
- [ ] A: Request a role, approve or reject, convert an approved request into a job
- [ ] B: /employer/requests/new, request list in /employer/hiring wired; demo data removed

### 7j Talent search and shortlists
- [ ] A: Search job seekers who opted in, filters, shortlists, privacy rules, outreach limits
- [ ] B: /employer/talent wired; demo data removed

### 7k Message templates
- [ ] A: Reusable messages (rejection, interview invite, offer follow-up)
- [ ] B: /employer/templates (message part) wired; demo data removed

### 7l Employer dashboard, analytics and activity
- [ ] A: Read-only: hiring funnel, time to hire, activity feed
- [ ] B: /employer/dashboard, /employer/analytics, /employer/activity wired; demo data removed

### 7m Saved jobs and alerts (job seeker)
- [ ] A: Save and unsave jobs, saved searches as alerts (delivery is Step 12)
- [ ] B: /jobseeker/saved, /jobseeker/alerts wired; demo data removed

### 7n Resume builder
- [ ] A: Resumes, sections, versions, ordering, duplicate and delete
- [ ] B: /jobseeker/resumes, /jobseeker/resumes/new, /jobseeker/resumes/[resumeId] wired; demo data removed

### 7o ATS check and tailor
- [ ] A: Score a resume against a job, tailoring suggestions
- [ ] B: /jobseeker/resumes/[resumeId]/ats, /jobseeker/resumes/[resumeId]/tailor wired; demo data removed

### 7p Practice interviews (core)
- [ ] A: Drill catalogue, sessions, transcript turns, history
- [ ] B: /jobseeker/practice, /new, /drills, /history, /[sessionId] wired; demo data removed

### 7q Practice scoring and report
- [ ] A: Scoring against the rubric and the session report
- [ ] B: /jobseeker/practice/[sessionId]/report, /jobseeker/practice/rubric wired; demo data removed

### 7r Startup hiring: jobs and applicants
- [ ] A: Wire the startup hiring pages to the APIs from 7a and 7d: hiring overview, job editor, job detail with applicants, applicant detail. Mostly frontend; fix small API gaps only
- [ ] B: /startup/hiring, /startup/hiring/jobs/new, /startup/hiring/[jobId], /startup/hiring/[jobId]/applicants/[applicantId] wired; demo data removed

### 7s Startup hiring: interviews and offers
- [ ] A: Wire the startup interviews and offers pages to 7f and 7g
- [ ] B: /startup/hiring/interviews, /startup/hiring/offers wired; demo data removed

### 7t Startup hiring: talent search, requests and employer page
- [ ] A: Wire talent search (7j), hiring requests (7i) and the startup's public employer page (organization page plus its open jobs)
- [ ] B: /startup/hiring/talent, /startup/hiring/requests/new, /startup/hiring/employer-page wired; demo data removed

### 7u Job seeker dashboard and Step 7 test pass
- [ ] A: Job seeker dashboard from 7a to 7q, then a click-through of every employer, startup hiring and job seeker page above
- [ ] B: /jobseeker/dashboard, then all pages from 7a to 7t wired; demo data removed

## Step 8: Mentors (one sub-step at a time; A = backend, B = frontend wired)

### 8a Mentor directory (startup view)
- [ ] A: Search and filter mentors, public mentor page, mentor suggestions for a startup
- [ ] B: /startup/mentors/find, /startup/mentors/find/[mentorId] wired; demo data removed

### 8b Mentorship requests
- [ ] A: A startup requests a mentor, the mentor accepts or declines, one active mentorship per pair, end a mentorship
- [ ] B: /mentor/requests, /mentor/startups (list), /mentor/discover, /startup/mentors/requests wired; demo data removed

### 8c Availability slots (GAP, only if the UI needs it)
- [ ] A: Mentor weekly availability with timezone, so sessions can be booked into free slots
- [ ] B: availability section in /mentor/profile/edit and the booking step in sessions wired; demo data removed

### 8d Sessions
- [ ] A: Schedule, confirm, reschedule, cancel, complete with summary and action items, no-show; no double booking
- [ ] B: /mentor/sessions, /mentor/sessions/[sessionId], /startup/sessions, /startup/sessions/[sessionId] wired; demo data removed

### 8e Deliverables
- [ ] A: Create, assign, submit and review deliverables with a status flow; link to readiness items
- [ ] B: /mentor/deliverables, deliverables in /startup/mentors wired; demo data removed

### 8f Mentor readiness sign-off
- [ ] A: Switch on mentor sign-off for the readiness items from 5f; only a mentor with an active mentorship; revoke
- [ ] B: /mentor/startups/[mentorshipId]/readiness, /startup/readiness (sign-off status) wired; demo data removed

### 8g Agreements
- [ ] A: Terms (fee, equity, cadence), send, sign by each side, versions
- [ ] B: /mentor/agreements, /mentor/agreements/[agreementId], agreement card in /startup/mentors/[mentorshipId] wired; demo data removed

### 8h Earnings records
- [ ] A: Record per completed session (gross, commission, TDS, net) and summaries; payouts are paid in 14f
- [ ] B: /mentor/earnings (read-only until 14f) wired; demo data removed

### 8i Reviews and ratings (GAP)
- [ ] A: Participants review a session once, mentor rating is recomputed; propose the table first
- [ ] B: review prompt after a session, rating on mentor cards wired; demo data removed

### 8j Mentor workspace, dashboard and impact
- [ ] A: Mentorship workspace, health indicator, dashboard and derived impact numbers
- [ ] B: /mentor/startups/[mentorshipId], /mentor/startups/[mentorshipId]/startup, /mentor/dashboard, /mentor/impact, /startup/mentors (overview), /startup/mentors/[mentorshipId] (workspace) wired; demo data removed

### 8k Step 8 test pass
- [ ] Click-through done, no leftover demo data on wired pages

## Step 9: Investors, rounds, data room (one sub-step at a time; A = backend, B = frontend wired)

### 9a Funding rounds (startup)
- [ ] A: Create and edit a round (target, instrument, valuation, dates), status, progress against target
- [ ] B: /startup/rounds, /startup/rounds/[roundId] wired; demo data removed

### 9b Investor directory (startup view)
- [ ] A: Startup searches and filters investors, public investor page; uses the investor organization profile and, once 9d exists, investor preferences
- [ ] B: /startup/investors/discover, /startup/investors/[investorId] wired; demo data removed

### 9c Startup discovery (investor view)
- [ ] A: Search startups with filters, startup detail respecting visibility and round toggles; compare stays client-side
- [ ] B: /investor/discover, /investor/startups/[startupId], /investor/compare wired; demo data removed

### 9d Preferences, saved searches and shortlist (GAP)
- [ ] A: Investor preferences (sectors, stage, ticket size), saved searches, shortlist; propose tables first
- [ ] B: /investor/searches, /investor/shortlist, preferences in profile edit wired; demo data removed

### 9e Pipeline
- [ ] A: Investor deal board with stages, probability, ticket size, next step, stage history, private notes; the startup sees its own investor list without private notes
- [ ] B: /investor/pipeline, /startup/investors/pipeline wired; demo data removed

### 9f Requests, introductions and meetings (GAP)
- [ ] A: Intro, meeting and information requests between investors and startups; propose the model first
- [ ] B: /investor/requests, /investor/meetings, /startup/meetings wired; demo data removed

### 9g Data room core (needs Step 4)
- [ ] A: Folders, documents stored as files, visibility level per document, versions
- [ ] B: /startup/data-room wired; demo data removed

### 9h Data room access, NDA and audit
- [ ] A: Access requests (approve, deny, revoke, expire), NDA tracking, every view logged
- [ ] B: /startup/data-room/requests, /investor/data-rooms, /investor/data-rooms/[startupId], /investor/data-rooms/[startupId]/nda wired; demo data removed

### 9i Offers
- [ ] A: Offers with versions and counters; accept, decline, expire
- [ ] B: /investor/offers, /investor/offers/new, /investor/offers/[offerId], offers shown to the startup wired; demo data removed

### 9j Commitments and portfolio
- [ ] A: Commitments with status and funding progress; portfolio holdings
- [ ] B: /investor/commitments, /investor/commitments/[commitmentId], /investor/portfolio, /investor/portfolio/[startupId] wired; demo data removed

### 9k Diligence (GAP)
- [ ] A: Diligence checklist and notes per startup; no table exists, propose first
- [ ] B: /investor/startups/[startupId]/diligence wired; demo data removed

### 9l Investor dashboard, insights and activity
- [ ] A: Read-only aggregates and activity feed
- [ ] B: /investor/dashboard, /investor/insights, /investor/activity wired; demo data removed

### 9m Startup investor hub and visibility settings
- [ ] A: Startup's investor overview (read-only aggregates from 9a to 9j) and the visibility settings page, which reuses the profile visibility API from 5a
- [ ] B: /startup/investors (hub), /startup/investors/settings wired; demo data removed

### 9n Step 9 test pass
- [ ] Click-through done, no leftover demo data on wired pages

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

## Step 14: Billing and payments (one sub-step at a time; A = backend, B = frontend wired)

### 14a Plans and entitlements (admin catalogue)
- [ ] A: Plans, entitlements per plan, promotions and billing products, managed by admin
- [ ] B: /admin/plans, /admin/plans/new, /admin/plans/[id] wired; demo data removed

### 14b Subscriptions and usage gating
- [ ] A: Subscribe, upgrade, cancel; usage meters; feature gating helper used by other steps
- [ ] B: plan and usage sections of /employer/billing and /investor/billing wired; demo data removed

### 14c Checkout, invoices and payments
- [ ] A: Create checkout, invoices with tax math and numbering, payments only from verified provider webhooks, saved payment methods (tokens only)
- [ ] B: checkout and invoice list in /employer/billing and /investor/billing wired; demo data removed

### 14d Refunds and dunning
- [ ] A: Refund requests and approval, failed-payment retries
- [ ] B: refund actions in /admin/billing wired; demo data removed

### 14e Credits and spending controls
- [ ] A: Credit wallets and transactions, spending limits
- [ ] B: credits sections in billing pages wired; demo data removed

### 14f Mentor payouts
- [ ] A: Payout batches and holds with maker/checker approval, linked to mentor earnings
- [ ] B: /admin/payouts, /admin/payouts/batches/[id], payout status in /mentor/earnings wired; demo data removed

### 14g Reconciliation and admin billing
- [ ] A: Match payments to provider settlements, admin billing overview
- [ ] B: /admin/billing wired; demo data removed

### 14h Mentorship payments (startup side, GAP)
- [ ] A: The startup pays its mentor: agreement summary, payments and receipts, session credits, payment method. `schema.sql` has no link between a payment or invoice and a mentorship or session, so propose one (for example a `mentorship_id` or `session_id` on invoice lines)
- [ ] B: /startup/mentors/[mentorshipId]/billing wired; demo data removed

### 14i Step 14 test pass
- [ ] Click-through done, no leftover demo data on wired pages

## Step 15: Admin console (one sub-step at a time; A = backend, B = frontend wired)

### 15a Admin accounts and access
- [ ] A: Admin login on the separate admin subdomain policy, MFA, IP allow-list, short sessions, permission levels, first-admin bootstrap command (no public sign-up)
- [ ] B: /admin/login, /admin/profile, /admin/profile/edit, /admin/staff wired; demo data removed

### 15b Audit log
- [ ] A: One audit helper used by every admin action (who, what, target, before and after, reason); audit list, export, integrity checks
- [ ] B: /admin/audit wired; demo data removed

### 15c Users and organizations
- [ ] A: Search, view, suspend, restore, force logout, verify, delete requests; organization list and detail
- [ ] B: /admin/users, /admin/users/[userId], /admin/organizations/[orgId] wired; demo data removed

### 15d Verifications
- [ ] A: Verification requests per user or organization, checks, approve, reject, expiry; user-facing submission
- [ ] B: /admin/verifications, /admin/verifications/[type]/[id], /admin/verifications/expiring, /employer/trust (submission) wired; demo data removed

### 15e Reports and moderation
- [ ] A: User reports, moderation cases with queue, assignment, SLA and resolution (content scans come from Step 10)
- [ ] B: /admin/moderation, /admin/moderation/[caseId], /admin/reports wired; demo data removed

### 15f Appeals and disputes
- [ ] A: User appeals of moderation decisions, disputes between parties
- [ ] B: /admin/appeals, /admin/disputes, appeal part of /employer/trust wired; demo data removed

### 15g Trust policies and fraud
- [ ] A: Policies, rules, blocklists, fraud detections, security alerts
- [ ] B: /admin/policies, /admin/fraud wired; demo data removed

### 15h Support and help centre
- [ ] A: Help articles, ticket categories, tickets and replies; user-facing ticket creation
- [ ] B: /admin/support, /admin/support/[ticketId], /admin/help, /help wired; demo data removed

### 15i Data requests and consent
- [ ] A: Access, correction and erasure requests with deadlines; consent records
- [ ] B: /admin/data-requests, /admin/data-requests/[id] wired; demo data removed

### 15j Compliance records
- [ ] A: Records of processing, vendors, DPIA assessments
- [ ] B: /admin/compliance (records tabs), /admin/compliance/[id] wired; demo data removed

### 15k Compliance operations
- [ ] A: Incidents, legal holds, trainings, calendar, compliance reports
- [ ] B: /admin/compliance (operations tabs) wired; demo data removed

### 15l Platform configuration
- [ ] A: Feature flags, platform limits, settings
- [ ] B: /admin/config, /admin/config/new, /admin/settings wired; demo data removed

### 15m Integrations, webhooks and system status
- [ ] A: Integration providers, webhook endpoints and events (admin screens), service status, incidents, alerts
- [ ] B: /admin/integrations, /admin/system wired; demo data removed

### 15n Opportunities and matching
- [ ] A: Opportunities (grants, programs), applications, matching rules, fairness metrics
- [ ] B: /admin/opportunities, /admin/opportunities/new, /admin/opportunities/[id], /admin/matching wired; demo data removed

### 15o AI quality
- [ ] A: AI models and review queue
- [ ] B: /admin/ai-quality, /admin/ai-quality/reviews/[id] wired; demo data removed

### 15p Content and templates
- [ ] A: Platform content with versions, platform templates
- [ ] B: /admin/content, /admin/templates, /admin/templates/new, /admin/templates/[id] wired; demo data removed

### 15q Admin dashboard, analytics and notifications
- [ ] A: Read-only aggregates from every earlier step, admin notifications
- [ ] B: /admin/dashboard, /admin/analytics, /admin/notifications wired; demo data removed

### 15r Step 15 test pass
- [ ] Click-through done, no leftover demo data on wired pages

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