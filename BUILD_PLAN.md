# Forma Backend: Detailed Build Plan (v2)

Stack: Python, FastAPI, async SQLAlchemy 2.0, Alembic, PostgreSQL.
Roles: startup member/founder, mentor, investor, job seeker, employer, admin.

## How to use this file

- Build one step at a time. Finish and test it before the next.
- Per step: migration, models, schemas, services, endpoints, tests, then check against the frontend.
- Table names below come from `database/schema.sql`. That file is a REFERENCE: read only the tables the step needs, write Alembic revisions for them, never run or paste the whole file.
- If a table is marked **GAP**, it is not in schema.sql. Tell me first, propose the table, then add it by migration.
- If the frontend and schema.sql disagree, tell me and propose a fix.
- Every step ends with "Done when". Tick it in PROGRESS.md.
- Size limit per agent session: about 5 tables, about 12 endpoints and about 3 frontend pages. If a step is bigger, it is split into sub-steps (Step 5 is already split into 5a to 5i). Give the agent one sub-step at a time. Steps 5, 7, 8, 9, 14 and 15 are already split into sub-steps. Steps 10 to 13 are still unsplit: ask for the same split (tables, endpoints, pages per sub-step) before starting any of them.

Standard for every step (from AGENTS.md): thin routers, logic in services, separate Create/Update/Read schemas, object-level permission checks, paginated lists, consistent error format, tests for happy path, validation, authentication failure and authorization failure.

## Frontend wiring happens per step

The frontend currently uses only demo data. For every step that has pages, do the work in two phases: (A) backend, tested and approved, then (B) wire that step's pages to the API, remove their demo data, and move the old demo records into a dev-only seed script. Step 16 is then only the final sweep for anything left over. Rules are in AGENTS.md section 0B.

## Decisions already made

UUID primary keys. Multi-role users (`user_roles`). Startups, employers and investor firms are all `organizations`. Cloudflare R2 for files. Resend in production, Gmail SMTP or Mailpit locally (`EMAIL_PROVIDER` + one `send_email()`). Own JWT auth. Redis (Upstash) for rate limiting. Messaging by polling first. PostgreSQL full-text search first.

Still open: payment provider (Razorpay proposed), background jobs (FastAPI BackgroundTasks first, worker later).

---

## STEP 0: Paper review (no code)

Parts:
1. List every entity found in the frontend pages, grouped by role.
2. Compare with `database/schema.sql`: what matches, what is missing, what is extra.
3. Known gaps to confirm (see below).
4. Permission matrix: role vs action (create, read own, read others, update, delete) for each entity.
5. Status lifecycles: application stages, offer states, mentorship states, deal stages, connection states.
6. Visibility rules: what each role can see of the others (startup profile toggles, data room, investor notes).
7. Output: `docs/design.md`.

Known gaps in schema.sql to decide on: connections and blocks (Step 6), mentor availability slots and session reviews (Step 8), investor preferences and watchlist (Step 9), report tables for community posts beyond `user_reports`.

Done when: `docs/design.md` is reviewed and approved by me.

---

## STEP 1: Project foundation

Parts:
1. Backend folder structure and FastAPI app factory, `/api/v1`.
2. Config with pydantic-settings, `.env.example`, dev/test/prod settings.
3. Docker Compose: PostgreSQL, Redis, Mailpit.
4. Async engine and session dependency, base model (`id`, `created_at`, `updated_at`).
5. Alembic for async; first revision creates extensions (`pgcrypto`, `citext`) and the `set_updated_at` function; runs up and down.
6. Error format, exception handlers, request-ID middleware, JSON logging, CORS allow-list, health and readiness endpoints.
7. Email service: `send_email()` with providers `smtp`, `resend`, selected by `EMAIL_PROVIDER`.
8. Test setup: pytest, test database, fixtures. Ruff and mypy, pre-commit.

Done when: app starts with one command, health works, tests run, migration applies and reverses, a test email shows in Mailpit.

---

## STEP 2: Authentication and account security

Tables (schema.sql section 2, extract in `database/auth_schema.sql`): `users`, `user_roles`, `auth_sessions`, `email_verification_tokens`, `password_reset_tokens`, `login_attempts`. (`user_mfa_factors` and `admin_members` are deferred to Step 15a; do not create them now.)

Parts:
1. Register: email, password, chosen role (creates `users` and `user_roles`). Strength rules. No leaking whether an email exists.
2. Password hashing with argon2.
3. Login: issue short-lived access token and refresh token (stored hashed in `auth_sessions`).
4. Refresh rotation: each refresh creates a new session row and links the old one through `replaced_by_session_id`. Reuse of a revoked token revokes the whole chain.
5. Logout and logout everywhere.
6. Email verification: single-use expiring token, resend with cooldown. Unverified users get limited access.
7. Password reset: request, email, single-use expiring token, new password, revoke all sessions.
8. Change password and change email (needs current password).
9. Roles: add a role later (`/register/role` says users can), primary role, role dependencies `require_role(...)`, `get_current_user`.
10. Account states: pending, active, suspended, deactivated, deleted. Suspended users are rejected everywhere.
11. Brute-force protection: Redis rate limits per IP and per account, record attempts in `login_attempts`, generic error messages.
12. Admin auth is NOT part of this step (it is Step 15a). Self-registration must never grant the `admin` role: `POST /auth/register` accepts only startup, mentor, investor, jobseeker or employer, and assigns it immediately as the primary role.
13. Later: OAuth login (Google, LinkedIn), TOTP MFA for all users.

Endpoints (examples): `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `/users/me/roles`, `GET /users/me`.

Tests: wrong password, expired token, reused refresh token, unverified user, suspended user, wrong role, rate limit hit, attempt to self-register as admin.

Done when: register, verify, login, refresh, logout and reset all work, and protected routes reject wrong roles.

---

## STEP 3: Profiles, organizations and onboarding

Tables: `users` (profile fields), `skills`, `organizations`, `organization_members`, `organization_invites`, `talent_profiles`, `talent_profile_skills`, `mentor_profiles`, `startup_profiles` (created in Step 5), `user_readiness`.
Note: schema.sql has no separate generic `profiles` table and no `investor_profiles` or `employer_profiles`; employers and investor firms are organizations. Investor preferences are a **GAP** (Step 9).

Parts:
1. Edit own profile: name, avatar, handle, phone, locale, timezone.
2. Organizations: create (startup, employer, investor firm), edit, logo, slug, verification status.
3. Members and invites: invite by email, accept, roles (owner, admin, member, viewer), remove, transfer ownership.
4. Job seeker profile: headline, summary, experience, availability, salary expectation, skills, searchable flag.
5. Mentor profile: expertise, sectors, languages, fee, capacity, accepting requests.
6. Skills lookup with search and suggestions.
7. Onboarding: steps per role (`onboarding_step`), completeness score.
8. Privacy settings, notification preferences stub, delete account request.
9. Public view vs private view (separate Read schemas).

Endpoints (examples): `GET/PATCH /users/me`, `POST /organizations`, `GET/PATCH /organizations/{id}`, `POST /organizations/{id}/invites`, `POST /invites/{token}/accept`, `GET/PATCH /talent-profile/me`, `GET/PATCH /mentor-profile/me`, `GET /skills?q=`.

Done when: every role can finish onboarding, orgs and invites work, and permission checks stop outsiders.

---

## STEP 4: Files and media

**Status: deferred.** Step 5 does not need Step 4, so Step 5 can be built first. Build Step 4 before anything that must store real files (hire documents in 7h, data room in 9f, and any resume file upload in 7c). When it is built, add a short follow-up that wires uploads into the places listed under "Waiting for Step 4" in Step 5.

Tables: `files`. (Data room tables come in Step 9.)

Parts:
1. R2 integration (S3-compatible).
2. Upload flow: request signed upload URL, upload direct, confirm.
3. Validation by `kind` (logo, resume, pitch deck, financial model, legal, image): type, size, safe key names.
4. Private downloads with short-lived signed URLs after a permission check.
5. `scan_status` workflow (pending, clean, infected); scanner hook can be stubbed.
6. Cleanup of abandoned uploads (scheduled).
7. Avatar and logo thumbnails.

Done when: avatar, logo, resume and pitch deck upload and download with permission checks.

---

## STEP 5: Startup workspace (split into 5a to 5i)

**Do not give the agent "Step 5" as one task. Give it one sub-step at a time ("Do Step 5c only").** The whole startup section of the frontend (`/startup/*`) is about six steps of work, not one, so this step covers only the startup's own workspace. The rest of the `/startup/*` routes belong to later steps (see the route map below).

Already done in Step 3 (do not redo): team directory, member and invite management, startup organization create/edit (name, summary, website, city, founded year), founder profile, account settings. The team directory uses `organization_members`; there is no separate startup members table.

Step 4 (files) is deferred and is **not a blocker** for Step 5. Anything that needs an upload (logo, pitch deck, documents list) stays on demo data or is hidden until Step 4 is built; see "Waiting for Step 4" below.

### Sizing rule for every sub-step

Per agent session: at most about 5 tables, about 12 endpoints, and about 3 frontend pages. Backend first (phase A), then I approve, then frontend wiring (phase B) for that sub-step only. If the agent's plan is bigger than this, ask it to split.

### Rules for every sub-step (security and correctness)

- Every row belongs to an organization (`org_id`). Every endpoint checks that the caller is an active member of that organization with a sufficient role: viewer reads only, member edits content, admin and owner manage.
- IDOR and cross-organization checks, with a test for each: a task's `milestone_id`, `assignee_id`, label and readiness item must belong to the same organization as the task. An assignee must be an active member. A label or milestone from another organization is rejected.
- Server-controlled fields are never writable by the startup: `mentor_verified`, `readiness_score`, `signed_off_by`, `signed_off_at`, metric `source` values `mentor_verified` and `admin_verified`. Add a mass-assignment test for each.
- Only the startup organization type can have a startup profile. Soft-deleted organizations and suspended organizations return 404.
- All list endpoints are paginated with whitelisted sort and filter fields. Free-text fields have length limits. Rate-limit comment and metric writes.
- Single source of truth: `organizations` already holds name, summary, website, city and founded year. Do not duplicate them in `startup_profiles` (the `location` and `founded_on` columns in `schema.sql` duplicate them; tell me and drop them from the migration unless you have a reason). Team size is computed from members, not stored.
- Reference data (readiness criteria, default labels) is created by an idempotent bootstrap command, not by guessing in migrations. Old demo records go into the dev seed script (`backend/scripts`), never into migrations.

### Sub-steps

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **5a** Startup profile and visibility | Startup profile, stage, visibility settings, public read | `startup_profiles` | 6 | `/startup/profile`, startup onboarding flow, `/startup/stage` (stage selector only) |
| **5b** Milestones | Create, edit, status, progress, soft delete | `milestones` | 5 | milestone panel inside tasks and dashboard |
| **5c** Tasks (core) | Board, columns, drag reorder, assignee, due date, priority, filters, task counts per member | `tasks` | 8 | `/startup/tasks` (labels and comments come in 5d) |
| **5d** Task labels and comments | Labels per organization, attach and detach, comments | `task_labels`, `task_label_links`, `task_comments` | 7 | `/startup/tasks` (labels, comments) |
| **5e** Metrics | Enter metrics, latest values, history, source labels | `startup_metrics` | 5 | `/startup/analytics` Overview and Journey tabs, dashboard metric cards |
| **5f** Readiness | Criteria, evidence, submit, score, sign-off | `readiness_criteria`, `startup_readiness` (+ foreign key from `tasks.readiness_id`) | 7 | `/startup/readiness` (this page lives inside `mentors/mentor-app.jsx`), dashboard readiness card |
| **5g** Dashboard summary | One read-only summary endpoint built from 5a to 5f | none (view or queries) | 1 | `/startup/dashboard` |
| **5h** Discovery and public startup page | Startup list with filters, public profile, respects visibility | none | 3 | consumers are wired in Steps 7, 8 and 9 |
| **5i** Step 5 test pass | End-to-end check of every wired page, remove leftover demo data | none | 0 | all pages above |

Order matters: 5a, 5b, 5c, 5d, 5e, 5f, 5g, 5h, 5i. 5b comes before 5c because tasks link to milestones. 5f comes after 5c because it adds the foreign key from tasks to readiness items. 5g reads everything else, so it is last of the build steps.

#### 5a Startup profile and visibility

Backend:
1. `startup_profiles` (primary key `org_id`): tagline, stage, sector, business model, problem, solution, traction summary, TAM text, visibility settings.
2. Create on demand for a startup organization. Endpoints for read and update by organization members, and a public read (`/public/startups/{slug}`) that returns only what the visibility settings allow.
3. Visibility values: `private`, `mentors`, `mentors_and_investors`, `public`, plus the per-section toggles (summary, traction, team, funding, round, readiness).
4. Stage mapping decision (tell me before building): the frontend uses idea, prototype, early-revenue, scaling and also has a `mature` page; the schema enum is idea, prototype, early_revenue, growth, mature. Map `scaling` to `growth`, and confirm.
5. Gaps to decide: the profile page share toggle "contacts" has no column (add `contacts_public` or drop the toggle). The onboarding flow collects revenue range, funding status, pitch deck, DPIIT recognition and ecosystem goals, which have no columns. Propose small nullable columns, or defer the ones that need files or are not needed yet.
6. The profile page "documents" list needs files: leave it on demo data until Step 4.

Done when: a founder can save the full startup profile, change visibility, and an outsider sees only what the toggles allow.

#### 5b Milestones

`milestones` with name, target date, owner (must be an org member), status (`on_track`, `at_risk`, `off_track`, `achieved`, `missed`), progress 0 to 100, soft delete. Progress is set manually now; it can be derived from tasks later (say so in the plan, do not build it silently).

Done when: milestones can be created, edited, listed and deleted by members, and cross-organization access is rejected.

#### 5c Tasks (core)

`tasks`: title, description, status, priority, milestone, assignee, due date, completion time, display order. UI has 4 columns (To do, In progress, In review, Done); the enum also has `blocked`, so keep it and map it.
1. CRUD, move between columns, reorder within a column (stable ordering, no full renumbering on every drag, handle concurrent moves).
2. Filters (assignee, status, priority, milestone, due this week, assigned to me) and pagination.
3. The team directory shows a task count per member: add that count to the members response here.
4. The `tasks.readiness_id` column is created now without its foreign key (added in 5f). The UI task has a "criterion" link that looks like stage checklist text (for example "Prototype: MVP scope defined"). Tell me how you plan to map it; do not invent it silently.

Done when: the task board works for members, assignees are validated, and cross-organization access is rejected.

#### 5d Task labels and comments

`task_labels`, `task_label_links`, `task_comments`: unique label name per organization, attach and detach, comment create, edit own, delete own, admins can delete any. Comments are soft-deleted. Rate-limit comments. Labels are per organization.

Done when: labels and comments work on the board, and a label from another organization cannot be attached.

#### 5e Metrics

`startup_metrics`: allowed keys are mrr, arr, customers, burn, runway_months, growth_mom, headcount, active_users. Unique per organization, key and period. Endpoints: upsert a metric value, latest value per key, history range, delete a mistaken entry.
- The `source` is `startup_reported` when the startup enters it. Verified sources are server-only.
- The analytics page shows much more than these 8 keys (see "Deferred" below). Wire only the Overview and Journey tabs and the parts that map to these metrics.
- The "Revenue vs burn" and "MRR trend" charts read from history.

Done when: a founder enters monthly metrics, the dashboard and analytics read the latest and history values, and verified sources cannot be set by the startup.

#### 5f Readiness

`readiness_criteria` (reference data, the 6 criteria the page shows) and `startup_readiness` (per organization and criterion: status, evidence, score, sign-off).
1. Bootstrap the criteria with an idempotent command.
2. Startup side: view criteria, add evidence, submit for review. Status flow: `not_started`, `in_progress`, `submitted`, `signed_off`, `rejected`.
3. Score: percent of signed-off criteria (the `v_startup_readiness` view or an equivalent query), cached into `startup_profiles.readiness_score` and recomputed on change.
4. Sign-off: only the platform admin for now (a user with the `admin` role created by the bootstrap command from 15a, or a dev-seeded admin until then; the full admin hardening arrives in 15a). **Mentor sign-off is switched on in Step 8**, because it needs the mentorship relationship. Do not let any startup member sign off.
5. Add the foreign key from `tasks.readiness_id` and wire the task link.
6. The `/startup/readiness` page is rendered inside `mentors/mentor-app.jsx`, which also contains mentor pages for Step 8. Wire only the readiness page and leave the rest on demo data.

Done when: evidence can be submitted, a sign-off changes the score, and a startup member cannot sign off or edit the score.

#### 5g Dashboard summary

One read-only endpoint for `/startup/dashboard`: my tasks (due, overdue), milestone progress, readiness score, latest metrics (MRR, burn, runway), recent activity from the startup's own data. Cards that depend on later steps (mentor feedback, investor interest, data room views, hiring) stay on demo data or are hidden until those steps (8, 9, 7).

Done when: the dashboard loads real data for the cards that have a source, and shows empty states (not fake numbers) for the rest.

#### 5h Discovery and public startup page

Startup list with filters (stage, sector, location, text search), pagination, and the public startup read. Respect `profile_visibility` and the per-section toggles: an outsider never sees private sections, and viewer role (mentor, investor, other) decides what is visible. This is the shared read used by job seeker, mentor and investor discovery later. The consumer pages (`jobseeker/startups`, mentor and investor startup lists) are wired in Steps 7, 8 and 9, not here.

Done when: discovery returns only what each caller may see, with tests for each visibility value.

#### 5i Step 5 test pass

Log in as a founder, a team member, a viewer, a mentor and an investor, and click through every wired page. Check there is no leftover demo data on wired pages, and that unwired cards are clearly empty or hidden.

### Route map: which `/startup/*` pages belong to which step

| Route group | File | Step |
|---|---|---|
| `/startup/profile`, `/startup/stage` | `startup-profile.jsx`, `stage-page.jsx` | 5a |
| `/startup/tasks` | `tasks-page.jsx` | 5b, 5c, 5d |
| `/startup/analytics` | `analytics-page.jsx` | 5e (Overview, Journey); other tabs deferred |
| `/startup/readiness` | inside `mentors/mentor-app.jsx` | 5f |
| `/startup/dashboard` | `startup-dashboard.jsx` | 5g |
| `/startup/team`, `/startup/settings`, `/startup/user-profile`, `/startup/founder-profile` | | done in Step 3 |
| `/startup/hiring/*` | `hiring/hiring-app.jsx` (about 1,500 lines) | Step 7 |
| `/startup/mentors/*`, `/startup/sessions/*` | `mentors/mentor-app.jsx` (about 1,400 lines) | Step 8 |
| `/startup/investors/*`, `/startup/rounds/*`, `/startup/data-room/*` | `investors/investor-app.jsx` (about 1,650 lines) | Step 9 |
| `/startup/meetings`, `/startup/messages` | inside `investor-app.jsx` | Step 11 (messages), Step 9 (investor meetings) |
| `/startup/community` | `community/community-shell` | Step 10 |

### Waiting for Step 4

Logo upload, pitch deck and documents list on the profile page, onboarding pitch deck upload, "share analytics report" export. Keep these on demo data or hidden. When Step 4 is built, add a short "wire uploads" follow-up for these places.

### Deferred (no table in `schema.sql`; decide later, do not build now)

- Stage tools on `/startup/stage/*`: idea canvas, interview tracker, market sizing, co-founder search, customer persona. The stage checklist text is static content and can stay as is.
- Analytics Business and Market tabs: unit economics, sales funnel, customers and retention, TAM/SAM/SOM, competitor landscape, goals tracker, peer benchmarks, industry signals, investor landscape. Some need data from other steps (investor funnel from Step 9, hiring funnel from Step 7); the rest need new tables and a proposal first.
- Mentor impact and workspace usage cards on analytics (Step 8 and later).

---

## STEP 6: Connections and blocks (**GAP**: not in schema.sql)

Build only if the frontend needs connections. Tell me first and propose tables.

Parts:
1. Send, accept, decline, cancel connection request.
2. Which role pairs may connect.
3. Block and unblock; what blocking hides (profiles, messages, community).
4. Inbox and outbox, mutual connections.
5. Daily limits and duplicate prevention.

Done when: connections work between allowed pairs and blocks are respected by profiles, messaging and community.

---

## STEP 7: Hiring: employer side and job seeker side (split into 7a to 7r)

Employer and job seeker pages share the same tables, so both sides are built together in the order a real hiring flow runs. **Do not give the agent "Step 7" as one task; give it one sub-step at a time.** Already done in Step 3: employer organization profile and settings, job seeker profile and settings, talent profile and skills, readiness score.

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), organization and ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **7a** Jobs (employer) | Create, edit, publish, pause, close and archive jobs; salary and equity ranges; job visibility | `jobs`, `job_skills`, `job_benefits` | 10 | /employer/jobs/new, /employer/jobs/[jobId]/edit, /employer/jobs/[jobId] (job details), /employer/hiring |
| **7b** Job search and company pages (job seeker) | Search with filters and pagination, job detail, company page, startups that are hiring | none new (reads 7a, Step 3 and 5h) | 5 | /jobseeker/jobs, /jobseeker/jobs/[jobId], /jobseeker/companies/[companyId], /jobseeker/startups |
| **7c** Apply and my applications | Apply with profile, cover note and screening answers; duplicate and deadline checks; withdraw; stage history visible to the applicant | `job_applications`, `application_stage_events` | 8 | /jobseeker/jobs/[jobId]/apply, /jobseeker/applications, /jobseeker/applications/[applicationId] |
| **7d** Applicant pipeline (employer) | Applicants per job with filters, applicant detail, stage changes with history, private notes, reject reasons, blind-review mode | `application_notes` (uses 7c tables) | 9 | /employer/jobs/[jobId] (applicants), /employer/jobs/[jobId]/applicants/[applicantId] |
| **7e** Scorecards and compare | Scorecard templates and criteria, scores per applicant, side-by-side compare | `scorecards`, `scorecard_criteria`, `application_scores` | 8 | /employer/jobs/[jobId]/compare, scoring panel on the applicant page |
| **7f** Interviews | Schedule, participants, feedback, reschedule, cancel; applicant view | `interviews`, `interview_participants`, `interview_feedback` | 10 | /employer/interviews, /jobseeker/interviews |
| **7g** Offers | Create and send offers, approval, accept, decline, expire, decline reasons, applicant compare | `job_offers`, `offer_decline_reasons` | 10 | /employer/offers, /employer/offers/[offerId], /jobseeker/offers, /jobseeker/offers/[offerId], /jobseeker/offers/compare |
| **7h** Hires and onboarding | Turn an accepted offer into a hire; onboarding templates and checklist; hire documents (documents need Step 4) | `hires`, `onboarding_templates`, `onboarding_template_items`, `hire_onboarding_items`, `hire_documents` | 12 | /employer/hires, /employer/hires/[hireId], /employer/templates (onboarding part) |
| **7i** Hiring requests and approvals | Request a role, approve or reject, convert an approved request into a job | `hiring_requests` | 6 | /employer/requests/new, request list in /employer/hiring |
| **7j** Talent search and shortlists | Search job seekers who opted in, filters, shortlists, privacy rules, outreach limits | `talent_shortlists`, `talent_shortlist_members` | 9 | /employer/talent |
| **7k** Message templates | Reusable messages (rejection, interview invite, offer follow-up) | `message_templates` | 5 | /employer/templates (message part) |
| **7l** Employer dashboard, analytics and activity | Read-only: hiring funnel, time to hire, activity feed | view `v_job_funnel`, `activity_events` | 5 | /employer/dashboard, /employer/analytics, /employer/activity |
| **7m** Saved jobs and alerts (job seeker) | Save and unsave jobs, saved searches as alerts (delivery is Step 12) | `saved_jobs`, `job_alerts` | 8 | /jobseeker/saved, /jobseeker/alerts |
| **7n** Resume builder | Resumes, sections, versions, ordering, duplicate and delete | `resumes`, `resume_experiences`, `resume_education`, `resume_skills` | 12 | /jobseeker/resumes, /jobseeker/resumes/new, /jobseeker/resumes/[resumeId] |
| **7o** ATS check and tailor | Score a resume against a job, tailoring suggestions | `resume_ats_runs` | 4 | /jobseeker/resumes/[resumeId]/ats, /jobseeker/resumes/[resumeId]/tailor |
| **7p** Practice interviews (core) | Drill catalogue, sessions, transcript turns, history | `practice_drills`, `practice_sessions`, `practice_transcript_turns` | 9 | /jobseeker/practice, /new, /drills, /history, /[sessionId] |
| **7q** Practice scoring and report | Scoring against the rubric and the session report | none new (uses 7p) | 3 | /jobseeker/practice/[sessionId]/report, /jobseeker/practice/rubric |
| **7r** Job seeker dashboard and Step 7 test pass | Dashboard from 7a to 7q, then a click-through of every employer and job seeker page above | none | 1 | /jobseeker/dashboard, then all pages from 7a to 7q |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **7a**: job status flow (`draft`, `open`, `paused`, `closed`) and who may publish (owner, admin, or a member with the hiring permission). Jobs of suspended or unverified organizations are not shown in search (verification arrives in 15d; until then use the organization status only).
- **7c**: attaching a resume file needs Step 4. Until then the applicant applies with the profile and, once 7n exists, a builder resume.
- **7d**: the applicant's private data (phone, email, salary expectation) is visible only to the job's organization members and only after the application exists. Blind-review mode hides name, photo and school.
- **7g and 7i**: the UI shows several approvers, but `hiring_requests` and offers have one `approver_id`. Propose a small approval table or settle on one approver, and wait for my answer.
- **7h**: needs Step 4 for documents. If Step 4 is not built yet, build the checklist part and leave documents for later.
- **7j**: only job seekers with `is_searchable` and `profile_public` appear. Respect `hide_current_employer`. Rate-limit contact and exports.
- **7o and 7q**: use rule-based scoring first. Sending resume text or interview answers to an AI provider needs a decision on provider, cost and user consent (DPDP) before it is built.
- Not part of Step 7: `/employer/billing` (Step 14), `/employer/trust` (15d), messages (Step 11), community (Step 10), profile and settings (done in Step 3).

---

## STEP 8: Mentors (split into 8a to 8k)

**Do not give the agent "Step 8" as one task; give it one sub-step at a time.** Already done in Step 3: mentor profile and settings.

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), organization and ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **8a** Mentor directory (startup view) | Search and filter mentors, public mentor page, mentor suggestions for a startup | none new (reads Step 3 mentor profiles) | 4 | /startup/mentors (discover), public mentor profile |
| **8b** Mentorship requests | A startup requests a mentor, the mentor accepts or declines, one active mentorship per pair, end a mentorship | `mentorships` | 9 | /mentor/requests, /mentor/startups (list), /mentor/discover, /startup/mentors (my mentors and requests) |
| **8c** Availability slots (GAP, only if the UI needs it) | Mentor weekly availability with timezone, so sessions can be booked into free slots | new `mentor_availability` (propose first) | 6 | availability section in /mentor/profile/edit and the booking step in sessions |
| **8d** Sessions | Schedule, confirm, reschedule, cancel, complete with summary and action items, no-show; no double booking | `mentoring_sessions`, `session_attendees` | 11 | /mentor/sessions, /mentor/sessions/[sessionId], /startup/sessions |
| **8e** Deliverables | Create, assign, submit and review deliverables with a status flow; link to readiness items | `mentor_deliverables` | 7 | /mentor/deliverables, deliverables in /startup/mentors |
| **8f** Mentor readiness sign-off | Switch on mentor sign-off for the readiness items from 5f; only a mentor with an active mentorship; revoke | none new (uses 5f and 8b) | 3 | /mentor/startups/[mentorshipId]/readiness |
| **8g** Agreements | Terms (fee, equity, cadence), send, sign by each side, versions | `mentor_agreements` | 7 | /mentor/agreements, /mentor/agreements/[agreementId], agreement view for the startup |
| **8h** Earnings records | Record per completed session (gross, commission, TDS, net) and summaries; payouts are paid in 14f | `mentor_earnings` | 4 | /mentor/earnings (read-only until 14f) |
| **8i** Reviews and ratings (GAP) | Participants review a session once, mentor rating is recomputed; propose the table first | new `session_reviews` (propose first) | 5 | review prompt after a session, rating on mentor cards |
| **8j** Mentor workspace, dashboard and impact | Mentorship workspace, health indicator, dashboard and derived impact numbers | none | 5 | /mentor/startups/[mentorshipId], /mentor/startups/[mentorshipId]/startup, /mentor/dashboard, /mentor/impact |
| **8k** Step 8 test pass | Click through as a mentor, a founder, a team member and an outsider | none | 0 | all pages above |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **Shared file:** the startup-side mentor pages (`/startup/mentors/*`, `/startup/sessions/*`, `/startup/readiness`) live inside `startup/mentors/mentor-app.jsx` (about 1,400 lines). In each sub-step wire only the page that belongs to it and leave the rest on demo data.
- **8b**: confirm what `/mentor/discover` shows (startups looking for mentors is assumed) and reuse the 5h startup list instead of building a second one.
- **8c and 8i**: do not build until the plan shows the frontend really needs them. If slots are needed, build 8c before 8d.
- **8f**: only a mentor with an active mentorship in that startup can sign off; startup members never can. Cross-organization tests are mandatory.
- **8g**: money fields are `NUMERIC`, never float; amounts come from the session records, not from the client.
- Not part of Step 8: events (Step 10), messages (Step 11), profile and settings (done in Step 3), `/mentor/earnings` payout actions (14f).

---

## STEP 9: Investors, rounds and data room (split into 9a to 9l)

**Do not give the agent "Step 9" as one task; give it one sub-step at a time.** Already done in Step 3: investor organization profile and settings.

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), organization and ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **9a** Funding rounds (startup) | Create and edit a round (target, instrument, valuation, dates), status, progress against target | `funding_rounds` | 7 | /startup/rounds, /startup/rounds/[roundId] |
| **9b** Investor discovery and startup detail | Search startups with filters, startup detail respecting visibility and the round visibility toggles; compare stays client-side | none new (reads 5h and 9a) | 4 | /investor/discover, /investor/startups/[startupId], /investor/compare |
| **9c** Preferences, saved searches and shortlist (GAP) | Investor preferences (sectors, stage, ticket size), saved searches, shortlist; propose tables first | new `investor_preferences`, `saved_searches` (propose first) | 10 | /investor/searches, /investor/shortlist, preferences in profile edit |
| **9d** Pipeline | Investor deal board with stages, probability, ticket size, next step, stage history, private notes; startup side sees its own investor list without private notes | `investor_deals` | 10 | /investor/pipeline, /startup/investors |
| **9e** Requests and introductions (GAP) | Intro, meeting and information requests between investors and startups; propose the model first | propose first (maybe `investor_deals` stages plus messages) | 7 | /investor/requests, /investor/meetings, investor requests in /startup/investors |
| **9f** Data room core (needs Step 4) | Folders, documents stored as files, visibility level per document, versions | `data_rooms`, `data_room_folders`, `data_room_documents` (uses `files` from Step 4) | 12 | /startup/data-room |
| **9g** Data room access, NDA and audit | Access requests (approve, deny, revoke, expire), NDA tracking, every view logged | `data_room_access_requests`, `document_views` | 10 | /startup/data-room/requests, /investor/data-rooms, /investor/data-rooms/[startupId], /investor/data-rooms/[startupId]/nda |
| **9h** Offers | Offers with versions and counters; accept, decline, expire | `investor_offers` | 10 | /investor/offers, /investor/offers/new, /investor/offers/[offerId], offers view for the startup |
| **9i** Commitments and portfolio | Commitments with status and funding progress; portfolio holdings | `commitments`, `portfolio_holdings` | 10 | /investor/commitments, /investor/commitments/[commitmentId], /investor/portfolio, /investor/portfolio/[startupId] |
| **9j** Diligence (GAP) | Diligence checklist and notes per startup; no table exists, propose first | new table or derive from data room and notes (propose first) | 6 | /investor/startups/[startupId]/diligence |
| **9k** Investor dashboard, insights and activity | Read-only aggregates and activity feed | `activity_events` | 4 | /investor/dashboard, /investor/insights, /investor/activity |
| **9l** Step 9 test pass | Click through as an investor, a founder, a team member, an investor without access and an outsider | none | 0 | all pages above |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **Shared file:** the startup-side investor pages (`/startup/investors/*`, `/startup/rounds/*`, `/startup/data-room/*`, `/startup/meetings`) live inside `startup/investors/investor-app.jsx` (about 1,650 lines). In each sub-step wire only the page that belongs to it.
- **Step 4 must be built before 9f.** Data room documents are files.
- **Confidentiality (every sub-step):** investor private notes and pipeline data are never visible to the startup. A startup's financials, round details and data room are visible only to investors it has approved. An investor without approved access can never read a data room file, with a test for it.
- **9c, 9e, 9j** have no tables in `schema.sql`. Do not invent tables; propose them in the plan and wait.
- **9h and 9i**: money fields are `NUMERIC` with a currency code. Statuses change only through the defined transitions, never by a free-form update.
- Not part of Step 9: events (Step 10), messages (Step 11), billing (Step 14), profile and settings (done in Step 3).

---

## STEP 10: Community and events

Tables: `community_spaces`, `community_space_members`, `community_posts`, `community_comments`, `community_reactions`, `community_post_views`, `community_amas`, `community_rsvps`, `moderation_scans`, `user_reports`, `events`, `event_registrations`.

Parts:
1. Spaces with role-based access (`allowed_roles`) and allowed post types.
2. Posts: create, edit, delete (soft), anonymous posting where the space allows it.
3. Comments with nesting, accepted answer, expert label.
4. Reactions and bookmarks, with counters.
5. Feed: latest, trending, by space, by tag. Cursor pagination only.
6. Pre-publication scan (`moderation_scans`) and reporting.
7. Pin, lock, hide, remove (moderators and admin).
8. AMAs and RSVPs; events and registrations with capacity.
9. Rate limits for posting, mute and ban hooks.

Done when: users post, comment, react and report; feeds stay fast with large data.

---

## STEP 11: Messaging

Tables: `message_threads`, `message_thread_members`, `messages`, `message_receipts`.

Parts:
1. Create thread (direct, startup-investor, mentor, offer, support, system) with context link.
2. Send and list messages (cursor pagination), attachments through Step 4.
3. Read tracking and unread counts.
4. Who may message whom (roles, blocks).
5. Polling endpoints first; WebSocket later.
6. System messages (sender null), mute, leave, report.
7. Rate limits and spam protection.

Done when: two users chat, unread counts are right, outsiders cannot read any thread.

---

## STEP 12: Notifications and email

Tables: `notifications`, `notification_preferences`, `notification_deliveries`, `background_jobs`.

Parts:
1. Event emission from services (application, offer, message, reply, session, deal, verification).
2. In-app notifications: list, read, read all, unread count (`v_unread_notifications`).
3. Email delivery through `send_email()` with templates (`message_templates`).
4. Preferences per category and channel.
5. Background processing with retries (decide approach with me).
6. Digests and unsubscribe later.

Done when: key events create notifications and emails without slowing requests.

---

## STEP 13: Search and discovery

Parts:
1. PostgreSQL full-text search with GIN indexes: startups, jobs, mentors, investors, posts.
2. Unified search plus per-entity filters.
3. Ranking: relevance, recency, verified status.
4. Autocomplete for skills and sectors.
5. Visibility and privacy respected in every result.
6. Measure speed before considering a search engine.

Done when: search is fast, relevant, and never returns data the user may not see.

---

## STEP 14: Billing, plans, payments and payouts (split into 14a to 14h)

Billing is large and risky, so it is built in small slices with the payment provider decided first. **Give the agent one sub-step at a time.**

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), organization and ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **14a** Plans and entitlements (admin catalogue) | Plans, entitlements per plan, promotions and billing products, managed by admin | `plans`, `entitlements`, `plan_entitlements`, `promotions`, `billing_products` | 14 | /admin/plans, /admin/plans/new, /admin/plans/[id] |
| **14b** Subscriptions and usage gating | Subscribe, upgrade, cancel; usage meters; feature gating helper used by other steps | `subscriptions`, `usage_meters` | 9 | plan and usage sections of /employer/billing and /investor/billing |
| **14c** Checkout, invoices and payments | Create checkout, invoices with tax math and numbering, payments only from verified provider webhooks, saved payment methods (tokens only) | `invoices`, `invoice_lines`, `payments`, `payment_methods` (+ `webhook_events`) | 12 | checkout and invoice list in /employer/billing and /investor/billing |
| **14d** Refunds and dunning | Refund requests and approval, failed-payment retries | `refunds`, `dunning_attempts` | 7 | refund actions in /admin/billing |
| **14e** Credits and spending controls | Credit wallets and transactions, spending limits | `credit_wallets`, `credit_transactions`, `spending_controls` | 9 | credits sections in billing pages |
| **14f** Mentor payouts | Payout batches and holds with maker/checker approval, linked to mentor earnings | `payout_batches`, `payout_holds` | 10 | /admin/payouts, /admin/payouts/batches/[id], payout status in /mentor/earnings |
| **14g** Reconciliation and admin billing | Match payments to provider settlements, admin billing overview | `reconciliation_records` | 5 | /admin/billing |
| **14h** Step 14 test pass | Buy a plan, pay, refund, run a payout batch with two different admins | none | 0 | all pages above |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **Decision before 14c:** payment provider (Razorpay proposed). Verify the provider signature before processing any webhook, make handlers idempotent and store the raw event. Amounts and statuses come from the verified webhook, never from the client. Never store card numbers or CVV.
- **`webhook_events`** belongs to Step 15m in `schema.sql`, but 14c needs it. Create it in 14c; 15m only adds the admin screens.
- **14f**: the person who creates a payout batch can never approve it (maker/checker), with a test. Admin accounts must exist first (15a).
- Admin pages `/admin/plans`, `/admin/billing` and `/admin/payouts` are covered here, not in Step 15.

---

## STEP 15: Admin console, trust and safety, support, compliance (split into 15a to 15r)

The admin console has about 57 route files, so it is split into 18 sub-steps. **Do not give the agent "Step 15" as one task; give it one sub-step at a time.** Everything runs on the admin subdomain with the stricter admin auth policy.

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), organization and ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **15a** Admin accounts and access | Admin login on the separate admin subdomain policy, MFA, IP allow-list, short sessions, permission levels, first-admin bootstrap command (no public sign-up) | `admin_members`, `user_mfa_factors` | 14 | /admin/login, /admin/profile, /admin/profile/edit, /admin/staff |
| **15b** Audit log | One audit helper used by every admin action (who, what, target, before and after, reason); audit list, export, integrity checks | `audit_events`, `audit_integrity_checks`, `audit_export_requests` | 8 | /admin/audit |
| **15c** Users and organizations | Search, view, suspend, restore, force logout, verify, delete requests; organization list and detail | none new | 12 | /admin/users, /admin/users/[userId], /admin/organizations/[orgId] |
| **15d** Verifications | Verification requests per user or organization, checks, approve, reject, expiry; user-facing submission | `verifications`, `verification_checks` | 12 | /admin/verifications, /admin/verifications/[type]/[id], /admin/verifications/expiring, /employer/trust (submission) |
| **15e** Reports and moderation | User reports, moderation cases with queue, assignment, SLA and resolution (content scans come from Step 10) | `moderation_cases`, `user_reports` | 12 | /admin/moderation, /admin/moderation/[caseId], /admin/reports |
| **15f** Appeals and disputes | User appeals of moderation decisions, disputes between parties | `moderation_appeals`, `disputes` | 10 | /admin/appeals, /admin/disputes, appeal part of /employer/trust |
| **15g** Trust policies and fraud | Policies, rules, blocklists, fraud detections, security alerts | `trust_policies`, `policy_rules`, `policy_blocklists`, `fraud_detections`, `security_alerts` | 14 | /admin/policies, /admin/fraud |
| **15h** Support and help centre | Help articles, ticket categories, tickets and replies; user-facing ticket creation | `help_articles`, `support_ticket_categories`, `support_tickets`, `support_ticket_messages` | 14 | /admin/support, /admin/support/[ticketId], /admin/help, /help |
| **15i** Data requests and consent | Access, correction and erasure requests with deadlines; consent records | `data_requests` (started in Step 3), `consent_records`, `user_consents` | 10 | /admin/data-requests, /admin/data-requests/[id] |
| **15j** Compliance records | Records of processing, vendors, DPIA assessments | `data_processing_records`, `compliance_vendors`, `dpia_assessments` | 10 | /admin/compliance (records tabs), /admin/compliance/[id] |
| **15k** Compliance operations | Incidents, legal holds, trainings, calendar, compliance reports | `compliance_incidents`, `legal_holds`, `compliance_trainings`, `compliance_calendar`, `compliance_reports` | 12 | /admin/compliance (operations tabs) |
| **15l** Platform configuration | Feature flags, platform limits, settings | `feature_flags`, `platform_limits` | 9 | /admin/config, /admin/config/new, /admin/settings |
| **15m** Integrations, webhooks and system status | Integration providers, webhook endpoints and events (admin screens), service status, incidents, alerts | `integration_providers`, `webhook_endpoints`, `system_services`, `system_incidents`, `system_alerts` (`webhook_events` from 14c) | 12 | /admin/integrations, /admin/system |
| **15n** Opportunities and matching | Opportunities (grants, programs), applications, matching rules, fairness metrics | `opportunities`, `opportunity_applications`, `matching_rules`, `fairness_metrics` | 14 | /admin/opportunities, /admin/opportunities/new, /admin/opportunities/[id], /admin/matching |
| **15o** AI quality | AI models and review queue | `ai_models`, `ai_reviews` | 8 | /admin/ai-quality, /admin/ai-quality/reviews/[id] |
| **15p** Content and templates | Platform content with versions, platform templates | `content_items`, `content_versions` | 10 | /admin/content, /admin/templates, /admin/templates/new, /admin/templates/[id] |
| **15q** Admin dashboard, analytics and notifications | Read-only aggregates from every earlier step, admin notifications | `activity_events` (if not yet created), views | 5 | /admin/dashboard, /admin/analytics, /admin/notifications |
| **15r** Step 15 test pass | Click through every admin page as each permission level; check that normal user tokens are rejected everywhere | none | 0 | all admin pages |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **Order:** build 15a, 15b and 15c early (right after Step 5, see the build order at the end) so admin sign-off, verification and suspension exist before other steps need them. 15d to 15q can wait until their data exists.
- **15a rules:** no public route can create an admin. The first admin comes from a bootstrap command. Admin tokens have a shorter lifetime, require MFA, and are rejected on normal user routes (and the reverse). Every later sub-step writes to the audit log from 15b.
- **Every admin sub-step:** permission level per endpoint (analyst, support, manager, super admin), an audit event for every write, and a test that a normal user token and a lower permission level are rejected.
- **Dependencies:** 15e needs content from Step 10, 15d needs Step 4 for document checks, 15m reuses the webhook table from 14c, 15q needs everything else.
- **Covered elsewhere:** `/admin/plans`, `/admin/billing`, `/admin/payouts` (Step 14), `/admin/community` and `/admin/events` (Step 10).
- **No backend needed:** `/admin/manual` is static documentation (about 850 lines plus a 2,800-line data file). `/admin/dashbord` is a typo route and can be removed. The five-line pages `/admin/configuration`, `/admin/events`, `/admin/organizations`, `/admin/rubrics` and `/admin/staff` are aliases; confirm in the plan what each re-exports.

---

## STEP 16: Connect the frontend (final sweep)

By now most pages are already wired step by step. This step catches what is left: remaining mock imports, unused demo files, mismatched fields, and a full end-to-end check.

Parts:
1. Export OpenAPI and generate a typed client for Next.js.
2. API client: base URL, token handling, automatic refresh, error mapping.
3. Replace mock data role by role (auth first).
4. Loading, empty and error states on every page.
5. Fix field and permission mismatches.
6. End-to-end check of each role's main journey.

Done when: every page uses the real API.

---

## STEP 17: Hardening and quality

Parts:
1. Security review: object-level permission on every endpoint, uploads, headers, dependency audit, secrets scan.
2. Performance: EXPLAIN slow queries, fix N+1, review indexes, pool tuning.
3. Load test login, feeds, search, messages.
4. Authorization test sweep (wrong role and wrong owner on every route).
5. Data integrity and retention review.
6. Backup and restore test.
7. Privacy: data export, deletion, PII masking in logs.
8. Error tracking (Sentry) and monitoring.

---

## STEP 18: Deployment

Parts:
1. Production Dockerfile (multi-stage, non-root).
2. dev, staging, production environments with separate secrets.
3. Managed PostgreSQL with backups.
4. Migrations in the release process.
5. CI: lint, type check, tests, build, deploy.
6. HTTPS, main domain and admin subdomain, CORS and cookie settings.
7. Domain email setup (SPF, DKIM, DMARC) and switch `EMAIL_PROVIDER` to Resend.
8. Monitoring, uptime checks, rollback plan, launch checklist.

---

## Order summary and recommended build order

Step numbers: 0 Paper review, 1 Foundation, 2 Auth, 3 Profiles and organizations, 4 Files, 5 Startup workspace (5a to 5i), 6 Connections, 7 Hiring (7a to 7r), 8 Mentors (8a to 8k), 9 Investors and data room (9a to 9l), 10 Community and events, 11 Messaging, 12 Notifications, 13 Search, 14 Billing (14a to 14h), 15 Admin console (15a to 15r), 16 Frontend final sweep, 17 Hardening, 18 Deployment.

Recommended build order, because of dependencies:
1. Steps 0 to 3 (done) and Step 5 (5a to 5i, in progress).
2. **Admin core: 15a, 15b, 15c.** Admin accounts, the audit log, and user and organization management. Many later steps need an admin (readiness sign-off, verification, suspension), and every admin action must be audited from the start.
3. **Step 4 (files).** Needed by 7h (hire documents), 9f (data room) and uploads such as logos and decks.
4. **Step 7** (employer and job seeker hiring), then **Step 8** (mentors), then **Step 9** (investors). Within each, follow the sub-step order. 8f needs 5f; 9f needs Step 4.
5. Step 6 (connections) only if the frontend needs it, then Steps 10, 11, 12, 13 (split them first).
6. **Step 14** (billing), with the payment provider decided before 14c.
7. The rest of the admin console: 15d to 15r, once the data they manage exists.
8. Steps 16, 17, 18.

Pause for a real frontend click-through at the end of each step (the "test pass" sub-step). Use the same two prompts for every sub-step: "Do <sub-step> backend phase only", then "Do <sub-step> frontend wiring".