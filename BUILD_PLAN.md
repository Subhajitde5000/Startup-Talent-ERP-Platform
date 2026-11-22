# Forma Backend: Detailed Build Plan (v3)

Stack: Python, FastAPI, async SQLAlchemy 2.0, Alembic, PostgreSQL.
Roles: startup member/founder, mentor, investor, job seeker, employer, admin.

## How to use this file

- Build one step at a time. Finish and test it before the next.
- Per step: migration, models, schemas, services, endpoints, tests, then check against the frontend.
- Table names below come from `database/schema.sql`. That file is a REFERENCE: read only the tables the step needs, write Alembic revisions for them, never run or paste the whole file.
- If a table is marked **GAP**, it is not in schema.sql. Tell me first, propose the table, then add it by migration.
- If the frontend and schema.sql disagree, tell me and propose a fix.
- Every step ends with "Done when". Tick it in PROGRESS.md.
- Size limit per agent session: about 5 tables, about 12 endpoints and about 3 frontend pages. If a step is bigger, it is split into sub-steps (Step 5 is already split into 5a to 5n). Give the agent one sub-step at a time. Steps 5, 7, 8, 9, 14 and 15 are already split into sub-steps. Steps 10 to 13 are still unsplit: ask for the same split (tables, endpoints, pages per sub-step) before starting any of them.

Standard for every step (from AGENTS.md): thin routers, logic in services, separate Create/Update/Read schemas, object-level permission checks, paginated lists, consistent error format, tests for happy path, validation, authentication failure and authorization failure.

## Frontend wiring happens per step

The frontend currently uses only demo data. For every step that has pages, do the work in two phases: (A) backend, tested and approved, then (B) wire that step's pages to the API, remove their demo data, and move the old demo records into a dev-only seed script. Step 16 is then only the final sweep for anything left over. Rules are in AGENTS.md section 0B.

## Decisions already made

UUID primary keys. Multi-role users (`user_roles`). Startups, employers and investor firms are all `organizations`. Cloudflare R2 for files. Resend in production, Gmail SMTP or Mailpit locally (`EMAIL_PROVIDER` + one `send_email()`). Own JWT auth. Redis (Upstash) for rate limiting. Messaging by polling first. PostgreSQL full-text search first.

AI layer: LangChain (`init_chat_model`) so the provider can be switched from `.env` (`LLM_PROVIDER`, `LLM_MODEL`). Gemini API for testing now, Claude API later if the results are good. Only the AI service layer (7v) talks to LangChain; routers and other services never import it. Provider keys stay on the server.

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

### Sub-step 3d: Team management completion (startup `/startup/team`; same API serves employer and investor teams)

Steps 3b and 5c wired the basics (member list, invites, role change, remove, public toggle, task count). The team page still has actions that only change local screen state or show a toast, so it is not finished. Do this as its own sub-step, backend first, then frontend. About 0 to 1 new tables, 7 endpoints, 1 page. If this is too large, split it into 3d-1 (items 1 to 5, 8) and 3d-2 (the rest).

Backend:
1. **Deactivate and reactivate access.** The page has "Deactivate access" (single and bulk) that only changes local state. `member_status` already has `deactivated`. Add `POST /organizations/{id}/members/{user_id}/deactivate` and `/reactivate`. A deactivated member loses access to the organization immediately (every org permission check must treat it as not a member), keeps their history, and counts as not active in the team size. The last active owner can never be deactivated or removed. Only owner and admin can do it, and an admin cannot deactivate an owner.
2. **Resend invite.** The page's "Resend invite" is only a toast. Add `POST /organizations/{id}/invites/{invite_id}/resend`: issue a new token (the old one stops working, tokens stay hashed and single use), extend the expiry, send the email through `send_email()`, rate-limit it per invite and per organization.
3. **Invite email and message.** Today the accept link is only copied to the clipboard. Send the invite email (`send_email()` in a background task). The invite form also has a personal message and a "public" toggle: there is no `message` column on `organization_invites` and `is_public` lives on the member. Propose a small nullable `message` column (length-limited) and carry `is_public` into the new member on accept, or drop those two fields. Tell me before building.
4. **Bulk actions.** Bulk deactivate and bulk remove run as one request each (`POST /organizations/{id}/members/bulk` with an action and a list of up to 50 user ids), in one transaction, all-or-nothing, each target checked against the same rules as the single actions (last owner, role hierarchy, same organization). Invites can be bulk revoked the same way.
5. **Last active.** Update `last_active_at` on the member row, throttled (for example at most once every few minutes per member) so it does not write on every request. The table's "Last active" column reads it.
6. **Open roles card.** The "Open roles 3" card is demo data. Return `open_jobs_count` from 7a once it exists; until then hide the card or show an empty state, not a fake number.
7. **Roles at a glance and permissions modal.** This is static content. Keep it static, but it must match the real rules in the code (owner, admin, member, viewer). Add one test that fails if the permission table in the code and the text on the page diverge, or put the permission matrix in one shared place.
8. **Audit.** Role change, deactivate, reactivate, remove, ownership transfer and invite resend write to the audit log. (If the audit table from 15b is not built yet, write to `activity_events` or log structured events and move them later; tell me which.)
9. **Team export.** The CSV export is built in the browser from the loaded list. That is fine for the visible list; for large teams add `GET /organizations/{id}/members/export` (admin and owner only, no private fields such as phone).
10. Members endpoint filters and sort: role, status, department, text search on name and email, sort by name, joined, last active; paginated. The page currently filters in the browser, which breaks above one page of results.

11. **Removing a member must unassign their tasks.** The remove dialog promises "Their tasks will be unassigned". Today the backend only counts tasks. In the same transaction as remove (and deactivate, decide which), set `tasks.assignee_id` to null for that organization's tasks, and add a test. Comments and history stay.
12. **Make owner and transfer ownership.** The page lets an owner pick "Owner" in the role dropdown and has no transfer button, but the backend moves ownership only through `POST /organizations/{id}/transfer-ownership`. Decide one flow: either the dropdown calls transfer (with a confirmation, owner only, and the old owner becomes admin), or "Owner" is removed from the dropdown and a "Transfer ownership" action is added. Tell me which before building. Role change must never create a second owner by accident.
13. **Member profile drawer data.** The drawer shows bio, LinkedIn, tasks assigned, last active, joined and "public" status. `users.linkedin_url` exists but is not in the members response, so the "LinkedIn profile is not connected" toast is fake. Return `linkedin_url` (only when the member is public or the caller is an org member) and wire the link. Check that no private user field (phone, email of non-members) leaks through the members response.
14. **Message button (card and drawer).** Both "Message" buttons only show a toast. Direct messages are Step 11. In 3d, hide the button or leave it disabled with a clear label; wire it in Step 11. Add that to Step 11's page list.
15. **Founder badge and invite acceptance.** `is_founder` is shown as a badge; only the organization creator can have it and no endpoint may set it. Inviting an email that already has an account, or that is already a member, must give a clear error code, not a duplicate.

Security tests: viewer and member cannot manage the team; cross-organization IDs are rejected; an admin cannot touch an owner; a deactivated member gets 403 or 404 on every organization endpoint; the last owner is protected on every path (deactivate, remove, role change, bulk); the old invite token fails after resend; mass-assignment cannot set `status`, `is_founder`, `joined_at` through a normal update.

Frontend: wire the page's deactivate, reactivate, resend, bulk actions, server-side filters and sorting, "Last active", and the open roles card. Remove the local-only state changes. Show errors from the API (for example "You cannot remove the last owner").

Coverage of `/startup/team` (one file, `team/team-directory.jsx`, about 1,070 lines). Every control and the item that owns it:

| Control on the page | Owner |
|---|---|
| Member list, table and card views, search | 3b done, item 10 for server-side filters |
| Filters (role, status, department), sort | item 10 |
| Invite dialog (emails, title, department, role, message, public toggle, max 20) | 3b done, items 3 and 15 |
| Pending invites list, revoke | 3b done |
| Resend invite (menu and pending card) | item 2 |
| Change access role (table and drawer) | 3b done, item 12 for Owner |
| Edit title and department | 3b done |
| Public on profile toggle | 3b done |
| Task count per member | 5c done |
| Last active, joined | item 5 |
| Deactivate and reactivate (menu, drawer, bulk) | item 1, item 4 |
| Remove (single, bulk) and task unassignment | 3b done for single, items 4 and 11 |
| Member drawer (bio, LinkedIn, activity) | item 13 |
| Message button | item 14, Step 11 |
| Export CSV | item 9 |
| Open roles card, "Need more people?" links | item 6 |
| Roles at a glance, permissions modal | item 7 |

Done when: every button on `/startup/team` calls the API, nothing on the page changes only in local state, and the tests above pass.

---

## STEP 4: Files and media

**Status: deferred.** Step 5 does not need Step 4, so Step 5 can be built first. Build Step 4 before anything that must store real files (hire documents in 7h, data room in 9g, and any resume file upload in 7c). When it is built, add a short follow-up that wires uploads into the places listed under "Waiting for Step 4" in Step 5.

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

## STEP 5: Startup workspace (split into 5a to 5n)

**Do not give the agent "Step 5" as one task. Give it one sub-step at a time ("Do Step 5c only").** The whole startup section of the frontend (`/startup/*`) is about six steps of work, not one, so this step covers only the startup's own workspace. The rest of the `/startup/*` routes belong to later steps (see the route map below).

Already done in Step 3 (do not redo): team directory basics (the rest is sub-step 3d), member and invite management, startup organization create/edit (name, summary, website, city, founded year), founder profile, account settings. The team directory uses `organization_members`; there is no separate startup members table.

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
| **5i** Stage criteria and progress | Exit criteria per stage on the stage pages, stage change history (for "time in stage"), rules for moving to the next stage; connect to readiness rows by stage | `readiness_criteria` stage rows (reference data), new `startup_stage_history` (GAP, propose first) | 6 | /startup/stage, /startup/stage/idea, /prototype, /early-revenue, /growth, /mature |
| **5j** Stage tools (GAP) | Track the 25 stage tools (5 per stage): status, progress, notes; one generic table instead of 25 tables | new `stage_tool_progress` (propose first) | 6 | tool panels on /startup/stage/* |
| **5k** Analytics: business tab (GAP) | MRR trend, customers and retention, sales funnel, unit economics, additional metrics; extend the allowed metric keys and decide where funnel stages live | extends `startup_metrics` keys (propose), maybe a funnel table | 6 | /startup/analytics (Business tab) |
| **5l** Analytics: market tab (GAP) | Market size (TAM, SAM, SOM) with sources and a competitor list | new market-size fields or table and `startup_competitors` (propose first) | 7 | /startup/analytics (Market tab: market size, competitors) |
| **5m** Analytics: journey tab and leftovers (build after Steps 7, 8, 9) | Stage progress and time in stage, readiness breakdown, mentor impact, investor and hiring funnels, workspace usage, peer benchmarks, investor landscape | none (aggregates) | 4 | /startup/analytics (Journey tab and remaining cards) |
| **5n** Step 5 test pass | End-to-end check of 5a to 5l (and 5m once it is built), remove leftover demo data | none | 0 | all pages above |

Order matters: 5a to 5l in order, then 5n. 5b comes before 5c because tasks link to milestones. 5f comes after 5c because it adds the foreign key from tasks to readiness items. 5i comes after 5f because the stage criteria use the readiness items. 5g reads everything else. **5m is the exception: build it after Steps 7, 8 and 9**, because its funnels and mentor numbers come from them.

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
- The analytics page shows much more than these 8 keys (the Business, Market and Journey tabs are 5k, 5l and 5m). Wire only the Overview and Journey tabs and the parts that map to these metrics.
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

#### 5i Stage criteria and progress

Backend:
1. The stage pages show about 5 exit criteria per stage (25 in total, for example "At least 10 customer interviews logged, with insights summarized"). The task board also links to these items. Decide in the plan whether they are `readiness_criteria` rows with a `stage` (the schema has that column) or are separate from the 6 readiness items on `/startup/readiness`. There must be one source of truth, not two lists. Bootstrap them with an idempotent command.
2. Status per criterion comes from `startup_readiness` (5f). The startup submits evidence; mentor sign-off is switched on in 8f.
3. Stage history: record every change of `startup_profiles.stage` (who, when) so "time in stage" works. Propose `startup_stage_history` first.
4. The UI says a stage change applies immediately and mentor review is tracked separately. Keep that, but a stage change must never change sign-offs, and the history must be written in the same transaction.
5. The `growth` and `mature` pages use different headings ("Growth readiness"); confirm the stage mapping from 5a.

Done when: every stage page shows its exit criteria with real status and a stage change is recorded in history.

#### 5j Stage tools (GAP)

The 5 stages have 5 tools each (for example Idea canvas, Interview tracker, Market sizing, Co-founder search, Customer persona). Today the UI shows every tool as "Available in your workspace" with a generic panel; none of it is saved.
1. Do not build 25 tools. Propose one generic `stage_tool_progress` table (organization, stage, tool key validated against a fixed list, status, progress 0 to 100, notes, small size-limited JSON data, updated by). Evidence file links wait for Step 4.
2. Tools that need real structure (interview tracker, market sizing, customer persona) are not built here. In the plan, say which ones the frontend really needs and propose one table per tool; each becomes its own later sub-step. Market sizing must share its data with 5l, not duplicate it.
3. Co-founder search is a people-matching feature (discovery and outreach). Leave it on demo data or hide it until the connections and search steps (6 and 13).

Done when: each tool shows its saved status and notes, and no tool invents numbers.

#### 5k Analytics: business tab (GAP)

The Business tab shows MRR trend, revenue vs burn, customers and retention, sales funnel, unit economics (CAC, LTV, payback) and additional metrics. 5e already stores 8 metric keys.
1. Propose the extra metric keys (for example churn, CAC, LTV, net revenue retention, conversion) as an additive change to the allowed keys, with the same source rules as 5e (verified sources are server-only).
2. Sales funnel: decide whether stage counts are metrics with keys per stage or a small funnel table. Propose before building.
3. Calculated values (LTV to CAC ratio, payback) are computed by the service, never entered by the client, and carry the source `calculated`.
4. The "Data completeness" and "Data sources" cards read which keys exist and their source.

Done when: the Business tab shows real entered and calculated numbers, and empty states for missing data.

#### 5l Analytics: market tab (GAP)

1. Market size (TAM, SAM, SOM) with sources and assumptions. `startup_profiles.tam_text` is only free text today; propose columns or a small table, shared with the Market sizing tool in 5j.
2. Competitor list (name, website, positioning, strengths, weaknesses, pricing note, last reviewed). Propose `startup_competitors`.
3. Visibility: market data follows the traction and summary visibility toggles from 5a.
4. Not here: industry signals (admin content, 15p, or leave static), peer benchmarks and investor landscape (5m).

Done when: a founder can save market size and competitors, and visibility toggles are enforced.

#### 5m Analytics: journey tab and leftovers (build after Steps 7, 8 and 9)

Read-only aggregates: stage progress and time in stage (5i), readiness breakdown (5f), mentor impact (Step 8), investor and hiring funnels (Steps 9 and 7), workspace usage, peer benchmarks, investor landscape.
- Peer benchmarks and investor landscape are anonymous aggregates only, with a minimum group size (for example 10 startups) so no single startup is identifiable. Propose the rule in the plan.
- Funnel numbers count only the startup's own data.
- Industry signals stay static or come from admin content (15p).

Done when: every card on the Journey tab has a real source or a clear empty state.

#### 5n Step 5 test pass

Log in as a founder, a team member, a viewer, a mentor and an investor, and click through every wired page from 5a to 5l (and 5m after it is built). Check there is no leftover demo data on wired pages, and that unwired cards are clearly empty or hidden.

### Route map: every `/startup/*` page and the sub-step that wires it

| Route group | File | Sub-step |
|---|---|---|
| `/startup/profile` | `startup-profile.jsx` | 5a |
| `/startup/stage` and `/startup/stage/{idea,prototype,early-revenue,growth,mature}` | `stage-page.jsx` | 5a (stage selector), 5i (criteria, history), 5j (tools) |
| `/startup/tasks` | `tasks-page.jsx` | 5b, 5c, 5d |
| `/startup/analytics` | `analytics-page.jsx` | 5e (Overview), 5k (Business), 5l (Market), 5m (Journey) |
| `/startup/readiness` | inside `mentors/mentor-app.jsx` | 5f (8f adds mentor sign-off) |
| `/startup/dashboard` | `startup-dashboard.jsx` | 5g |
| `/startup/team` | `team/team-directory.jsx` | basics done in 3b and 5c; the rest is 3d |
| `/startup/settings`, `/startup/user-profile` (and `/edit`), `/startup/founder-profile` | | done in Step 3 |
| `/startup/hiring`, `/startup/hiring/jobs/new`, `/startup/hiring/[jobId]`, `/startup/hiring/[jobId]/applicants/[applicantId]` | `hiring/hiring-app.jsx` | 7r |
| `/startup/hiring/interviews`, `/startup/hiring/offers` | `hiring/hiring-app.jsx` | 7s |
| `/startup/hiring/talent`, `/startup/hiring/requests/new`, `/startup/hiring/employer-page` | `hiring/hiring-app.jsx` | 7t |
| `/startup/mentors/find`, `/startup/mentors/find/[mentorId]` | `mentors/mentor-app.jsx` | 8a |
| `/startup/mentors/requests` | `mentors/mentor-app.jsx` | 8b |
| `/startup/sessions`, `/startup/sessions/[sessionId]` | `mentors/mentor-app.jsx` | 8d |
| `/startup/mentors` (overview), `/startup/mentors/[mentorshipId]` | `mentors/mentor-app.jsx` | 8j |
| `/startup/mentors/[mentorshipId]/billing` | `mentors/mentor-app.jsx` | 14h |
| `/startup/rounds`, `/startup/rounds/[roundId]` | `investors/investor-app.jsx` | 9a |
| `/startup/investors/discover`, `/startup/investors/[investorId]` | `investors/investor-app.jsx` | 9b |
| `/startup/investors/pipeline` | `investors/investor-app.jsx` | 9e |
| `/startup/meetings` | `investors/investor-app.jsx` | 9f |
| `/startup/data-room` | `investors/investor-app.jsx` | 9g (needs Step 4) |
| `/startup/data-room/requests` | `investors/investor-app.jsx` | 9h |
| `/startup/investors` (hub), `/startup/investors/settings` | `investors/investor-app.jsx` | 9m |
| `/startup/messages` | `investors/investor-app.jsx` | Step 11 |
| `/startup/community` | `community` | Step 10 |

The three big shared files (`mentor-app.jsx`, `investor-app.jsx`, `hiring-app.jsx`) hold several pages each. In each sub-step wire only that sub-step's pages and leave the others on demo data.

### Waiting for Step 4

Logo upload, pitch deck and documents list on the profile page, onboarding pitch deck upload, "share analytics report" export, evidence file links on stage tools and readiness. Keep these on demo data or hidden. When Step 4 is built, add a short "wire uploads" follow-up for these places.

### Still undecided

- Co-founder search (people matching) on the Idea stage: waits for the connections and search steps (6 and 13).
- Industry signals on the Market tab: static, or admin content (15p).
- Specialized stage tools (interview tracker, market sizing, customer persona): each needs its own table proposal in 5j; build one at a time and only if the frontend needs real data.

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

## STEP 7: Hiring: employer side and job seeker side (split into 7a to 7x)

Employer and job seeker pages share the same tables, so both sides are built together in the order a real hiring flow runs. **Do not give the agent "Step 7" as one task; give it one sub-step at a time.** Already done in Step 3: employer organization profile and settings, job seeker profile and settings, talent profile and skills, readiness score.

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), organization and ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **7a** Jobs (employer) | Create, edit, publish, pause, close and archive jobs; salary and equity ranges; job visibility. Jobs belong to an organization of type employer or startup (startups hire too) | `jobs`, `job_skills`, `job_benefits` | 10 | /employer/jobs/new, /employer/jobs/[jobId]/edit, /employer/jobs/[jobId] (job details), /employer/hiring |
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
| **7r** Startup hiring: jobs and applicants | Wire the startup hiring pages to the APIs from 7a and 7d: hiring overview, job editor, job detail with applicants, applicant detail. Mostly frontend; fix small API gaps only | none new (uses 7a, 7c, 7d) | 3 | /startup/hiring, /startup/hiring/jobs/new, /startup/hiring/[jobId], /startup/hiring/[jobId]/applicants/[applicantId] |
| **7s** Startup hiring: interviews and offers | Wire the startup interviews and offers pages to 7f and 7g | none new (uses 7f, 7g) | 2 | /startup/hiring/interviews, /startup/hiring/offers |
| **7t** Startup hiring: talent search, requests and employer page | Wire talent search (7j), hiring requests (7i) and the startup's public employer page (organization page plus its open jobs) | none new (uses 7i, 7j, Step 3 and 7b) | 3 | /startup/hiring/talent, /startup/hiring/requests/new, /startup/hiring/employer-page |
| **7u** Job seeker dashboard and Step 7 test pass | Job seeker dashboard from 7a to 7q, then a click-through of every employer, startup hiring and job seeker page above | none | 1 | /jobseeker/dashboard, then all pages from 7a to 7t |
| **7v** AI layer foundation | LangChain model factory driven by `.env`, Pydantic output schemas, prompt templates, one service layer (`app/ai`, `app/services`), per-user rate limits and usage metering, logging of AI calls without personal data in the logs, a small eval set (10 to 15 samples) to compare Gemini and Claude before switching. Used by 7w, 7x, 7o, 7p, 7q and Step 19 | `ai_usage_events` (propose first: user, feature, model, token counts, created_at) | 1 | none (admin usage view can come with 15o) |
| **7w** AI resume generation, profile first | Generate a resume from data already on the platform (user, talent profile, skills, experience from Step 3) and ask only for what is missing. One `REQUIRED_FIELDS` config decides what counts as missing; `GET /resumes/requirements` returns only the missing fields and a completeness percentage. Extra answers are saved back to the profile only if the user ticks a box. Optional pasted job description tailors wording. Editable preview and PDF export | none new (writes into the 7n resume tables; additive columns such as `source` and `perspective` by migration) | 5 | /jobseeker/resumes/new (generate flow), /jobseeker/resumes/[resumeId] (preview, export) |
| **7x** Company-perspective resume (GAP) | The employer or startup view of a candidate: a standard resume in the company's template, aligned to one job posting, with gaps listed separately instead of hidden. Only for candidates who applied to that job (7c) or who consented to share. Propose the model first (for example `perspective`, `job_id` and `application_id` on resumes, and a company resume template table) | propose first | 6 | /employer/jobs/[jobId]/applicants/[applicantId], /startup/hiring/[jobId]/applicants/[applicantId], /employer/templates (resume template part) |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **7a**: job status flow (`draft`, `open`, `paused`, `closed`) and who may publish (owner, admin, or a member with the hiring permission). Jobs of suspended or unverified organizations are not shown in search (verification arrives in 15d; until then use the organization status only).
- **7c**: attaching a resume file needs Step 4. Until then the applicant applies with the profile and, once 7n exists, a builder resume.
- **7d**: the applicant's private data (phone, email, salary expectation) is visible only to the job's organization members and only after the application exists. Blind-review mode hides name, photo and school.
- **7g and 7i**: the UI shows several approvers, but `hiring_requests` and offers have one `approver_id`. Propose a small approval table or settle on one approver, and wait for my answer.
- **7h**: needs Step 4 for documents. If Step 4 is not built yet, build the checklist part and leave documents for later.
- **7j**: only job seekers with `is_searchable` and `profile_public` appear. Respect `hide_current_employer`. Rate-limit contact and exports.
- **7o and 7q**: use rule-based scoring first. The provider decision is made (LangChain, Gemini for testing, Claude later, see 7v). Sending resume text or interview answers to an AI provider still needs cost approval and user consent (DPDP) before it is built, and every call goes through the 7v service layer.
- **7v**: build it before 7w and before any AI part of 7o, 7p, 7q or Step 19. Pin the LangChain versions. Use structured output (Pydantic) instead of parsing free text. Rate-limit every AI endpoint per user and meter usage so plan limits (Step 14b) can be applied later. User text goes only in the user message, never in the system prompt (prompt-injection rule). Cap input lengths (job description, answers, transcripts). Do not log full prompts that contain personal data.
- **7w**: the AI may use only facts from the profile and the user's answers; it must never invent employers, degrees or numbers. Show an editable preview before saving. The completeness check must never ask for something already on the profile. Empty optional sections (for example projects) are skipped unless the target job needs them. Saving answers to the profile is opt-in and goes through the same Step 3 profile validation.
- **7x**: confirm the meaning first. "Company perspective" is assumed to be the employer-side view of a candidate; if it means something else (for example a company profile document), change this sub-step before building. Candidate private data (phone, email, salary expectation) follows the 7d rules. Blind-review mode from 7d must also hide name, photo and school in the company resume. Every endpoint checks membership of the hiring organization (employer or startup) and the candidate's application or consent.
- **Startup hiring (7r to 7t):** the startup role has its own hiring pages (`/startup/hiring/*`, one 1,500-line file `startup/hiring/hiring-app.jsx` with inline demo jobs and candidates). They use the same API as the employer pages, because a startup is an organization. Wire only what those pages show; do not add the extra employer features (scorecards, hires, templates) to the startup UI. In 7a to 7j every hiring endpoint must accept both organization types (employer and startup) and check the caller's membership of that organization.
- Not part of Step 7: `/employer/billing` (Step 14), `/employer/trust` (15d), messages (Step 11), community (Step 10), profile and settings (done in Step 3).

---

## STEP 8: Mentors (split into 8a to 8k)

**Do not give the agent "Step 8" as one task; give it one sub-step at a time.** Already done in Step 3: mentor profile and settings.

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), organization and ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **8a** Mentor directory (startup view) | Search and filter mentors, public mentor page, mentor suggestions for a startup | none new (reads Step 3 mentor profiles) | 4 | /startup/mentors/find, /startup/mentors/find/[mentorId] |
| **8b** Mentorship requests | A startup requests a mentor, the mentor accepts or declines, one active mentorship per pair, end a mentorship | `mentorships` | 9 | /mentor/requests, /mentor/startups (list), /mentor/discover, /startup/mentors/requests |
| **8c** Availability slots (GAP, only if the UI needs it) | Mentor weekly availability with timezone, so sessions can be booked into free slots | new `mentor_availability` (propose first) | 6 | availability section in /mentor/profile/edit and the booking step in sessions |
| **8d** Sessions | Schedule, confirm, reschedule, cancel, complete with summary and action items, no-show; no double booking | `mentoring_sessions`, `session_attendees` | 11 | /mentor/sessions, /mentor/sessions/[sessionId], /startup/sessions, /startup/sessions/[sessionId] |
| **8e** Deliverables | Create, assign, submit and review deliverables with a status flow; link to readiness items | `mentor_deliverables` | 7 | /mentor/deliverables, deliverables in /startup/mentors |
| **8f** Mentor readiness sign-off | Switch on mentor sign-off for the readiness items from 5f; only a mentor with an active mentorship; revoke | none new (uses 5f and 8b) | 3 | /mentor/startups/[mentorshipId]/readiness, /startup/readiness (sign-off status) |
| **8g** Agreements | Terms (fee, equity, cadence), send, sign by each side, versions | `mentor_agreements` | 7 | /mentor/agreements, /mentor/agreements/[agreementId], agreement card in /startup/mentors/[mentorshipId] |
| **8h** Earnings records | Record per completed session (gross, commission, TDS, net) and summaries; payouts are paid in 14f | `mentor_earnings` | 4 | /mentor/earnings (read-only until 14f) |
| **8i** Reviews and ratings (GAP) | Participants review a session once, mentor rating is recomputed; propose the table first | new `session_reviews` (propose first) | 5 | review prompt after a session, rating on mentor cards |
| **8j** Mentor workspace, dashboard and impact | Mentorship workspace, health indicator, dashboard and derived impact numbers | none | 5 | /mentor/startups/[mentorshipId], /mentor/startups/[mentorshipId]/startup, /mentor/dashboard, /mentor/impact, /startup/mentors (overview), /startup/mentors/[mentorshipId] (workspace) |
| **8k** Step 8 test pass | Click through as a mentor, a founder, a team member and an outsider | none | 0 | all pages above |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **Shared file:** the startup-side mentor pages (`/startup/mentors/*`, `/startup/sessions/*`, `/startup/readiness`) live inside `startup/mentors/mentor-app.jsx` (about 1,400 lines). In each sub-step wire only the page that belongs to it and leave the rest on demo data.
- **8b**: confirm what `/mentor/discover` shows (startups looking for mentors is assumed) and reuse the 5h startup list instead of building a second one.
- **8c and 8i**: do not build until the plan shows the frontend really needs them. If slots are needed, build 8c before 8d.
- **8f**: only a mentor with an active mentorship in that startup can sign off; startup members never can. Cross-organization tests are mandatory.
- **8g**: money fields are `NUMERIC`, never float; amounts come from the session records, not from the client.
- **Startup-side mentor payments** (`/startup/mentors/[mentorshipId]/billing`: agreement, payments and receipts, session credits, payment method) belong to Step 14 (sub-step 14h), not here.
- Not part of Step 8: events (Step 10), messages (Step 11), profile and settings (done in Step 3), `/mentor/earnings` payout actions (14f).

---

## STEP 9: Investors, rounds and data room (split into 9a to 9n)

**Do not give the agent "Step 9" as one task; give it one sub-step at a time.** Already done in Step 3: investor organization profile and settings.

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), organization and ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **9a** Funding rounds (startup) | Create and edit a round (target, instrument, valuation, dates), status, progress against target | `funding_rounds` | 7 | /startup/rounds, /startup/rounds/[roundId] |
| **9b** Investor directory (startup view) | Startup searches and filters investors, public investor page; uses the investor organization profile and, once 9d exists, investor preferences | none new (reads Step 3 organizations, 9d) | 4 | /startup/investors/discover, /startup/investors/[investorId] |
| **9c** Startup discovery (investor view) | Search startups with filters, startup detail respecting visibility and round toggles; compare stays client-side | none new (reads 5h and 9a) | 4 | /investor/discover, /investor/startups/[startupId], /investor/compare |
| **9d** Preferences, saved searches and shortlist (GAP) | Investor preferences (sectors, stage, ticket size), saved searches, shortlist; propose tables first | new `investor_preferences`, `saved_searches` (propose first) | 10 | /investor/searches, /investor/shortlist, preferences in profile edit |
| **9e** Pipeline | Investor deal board with stages, probability, ticket size, next step, stage history, private notes; the startup sees its own investor list without private notes | `investor_deals` | 10 | /investor/pipeline, /startup/investors/pipeline |
| **9f** Requests, introductions and meetings (GAP) | Intro, meeting and information requests between investors and startups; propose the model first | propose first (maybe `investor_deals` stages plus messages) | 7 | /investor/requests, /investor/meetings, /startup/meetings |
| **9g** Data room core (needs Step 4) | Folders, documents stored as files, visibility level per document, versions | `data_rooms`, `data_room_folders`, `data_room_documents` (uses `files` from Step 4) | 12 | /startup/data-room |
| **9h** Data room access, NDA and audit | Access requests (approve, deny, revoke, expire), NDA tracking, every view logged | `data_room_access_requests`, `document_views` | 10 | /startup/data-room/requests, /investor/data-rooms, /investor/data-rooms/[startupId], /investor/data-rooms/[startupId]/nda |
| **9i** Offers | Offers with versions and counters; accept, decline, expire | `investor_offers` | 10 | /investor/offers, /investor/offers/new, /investor/offers/[offerId], offers shown to the startup |
| **9j** Commitments and portfolio | Commitments with status and funding progress; portfolio holdings | `commitments`, `portfolio_holdings` | 10 | /investor/commitments, /investor/commitments/[commitmentId], /investor/portfolio, /investor/portfolio/[startupId] |
| **9k** Diligence (GAP) | Diligence checklist and notes per startup; no table exists, propose first | new table or derive from data room and notes (propose first) | 6 | /investor/startups/[startupId]/diligence |
| **9l** Investor dashboard, insights and activity | Read-only aggregates and activity feed | `activity_events` | 4 | /investor/dashboard, /investor/insights, /investor/activity |
| **9m** Startup investor hub and visibility settings | Startup's investor overview (read-only aggregates from 9a to 9j) and the visibility settings page, which reuses the profile visibility API from 5a | none (uses 5a and 9a to 9j) | 4 | /startup/investors (hub), /startup/investors/settings |
| **9n** Step 9 test pass | Click through as an investor, a founder, a team member, an investor without access and an outsider | none | 0 | all pages above |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **Shared file:** the startup-side investor pages (`/startup/investors/*`, `/startup/rounds/*`, `/startup/data-room/*`, `/startup/meetings`, `/startup/messages`) live inside `startup/investors/investor-app.jsx` (about 1,650 lines). In each sub-step wire only the page that belongs to it.
- **Step 4 must be built before 9g.** Data room documents are files.
- **Confidentiality (every sub-step):** investor private notes and pipeline data are never visible to the startup. A startup's financials, round details and data room are visible only to investors it has approved. An investor without approved access can never read a data room file, with a test for it.
- **9d, 9f, 9k** have no tables in `schema.sql`. Do not invent tables; propose them in the plan and wait.
- **9i and 9j**: money fields are `NUMERIC` with a currency code. Statuses change only through the defined transitions, never by a free-form update.
- **9m**: the visibility settings page must call the same API as the profile page (5a), not a second copy of the settings.
- Not part of Step 9: events (Step 10), messages (Step 11, including `/startup/messages` and `/investor/messages`), billing (Step 14), profile and settings (done in Step 3).

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

> Pages to include when this step is split: the Message buttons on `/startup/team` (card and member drawer), left disabled in sub-step 3d.

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

## STEP 14: Billing, plans, payments and payouts (split into 14a to 14i)

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
| **14h** Mentorship payments (startup side, GAP) | The startup pays its mentor: agreement summary, payments and receipts, session credits, payment method. `schema.sql` has no link between a payment or invoice and a mentorship or session, so propose one (for example a `mentorship_id` or `session_id` on invoice lines) | a link column or table (propose first); uses `payments`, `credit_wallets`, `mentor_earnings` | 8 | /startup/mentors/[mentorshipId]/billing |
| **14i** Step 14 test pass | Buy a plan, pay, refund, run a payout batch with two different admins, pay a mentor from the startup side | none | 0 | all pages above |

Build the sub-steps in this order. A sub-step marked GAP has no table in `schema.sql`: propose the table in the plan and wait for my answer; do not invent it.

Notes:
- **Decision before 14c:** payment provider (Razorpay proposed). Verify the provider signature before processing any webhook, make handlers idempotent and store the raw event. Amounts and statuses come from the verified webhook, never from the client. Never store card numbers or CVV.
- **`webhook_events`** belongs to Step 15m in `schema.sql`, but 14c needs it. Create it in 14c; 15m only adds the admin screens.
- **14f**: the person who creates a payout batch can never approve it (maker/checker), with a test. Admin accounts must exist first (15a).
- **14h** needs 8g (earnings), 14c (payments) and 14e (credits) first. The platform must not hold or move a mentor's money outside the payout flow in 14f.
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

## STEP 19: Meeting summary and minutes (split into 19a to 19f)

After a meeting, one click produces a summary and formal minutes. It works on every kind of meeting the platform already has: mentoring sessions (8d), investor meetings (9f) and interviews (7f). **Give the agent one sub-step at a time.** Needs 7v (AI layer) first.

Rules from Step 5 apply to every sub-step here: the sizing rule (about 5 tables, 12 endpoints, 3 pages), ownership checks on every row, cross-organization reference tests, server-controlled fields that clients never write, mass-assignment tests, paginated lists, and demo records moved to the dev seed script. Backend phase A first, then I approve, then frontend phase B for that sub-step only.

Design:
- One generic model for all meeting types: each row points to its meeting with `source_type` (`mentoring_session`, `investor_meeting`, `interview`) and `source_id`. The service checks that the caller is an attendee or a permitted member of the right organization for that source type. Do not build three copies.
- Output (`MeetingMinutes`, structured): summary, agenda topics, discussion points, decisions, action items (task, owner, due date), open questions, attendees, date and duration.
- Long transcripts: split into chunks, summarize each, then merge, so nothing is cut off. Input length is capped.
- One current minutes per meeting; regenerating creates a new version and keeps the old one.
- The transcript is data, not instructions (prompt-injection rule from 7v).

| Sub-step | Scope | Tables | About endpoints | Frontend pages (phase B) |
|---|---|---|---|---|
| **19a** Transcript and notes | Attach a transcript or notes to a meeting (paste or text file), edit, delete; who may add and read; recording-consent flag per meeting | `meeting_transcripts` (source_type, source_id, source, text, created_by) | 6 | transcript and notes panel on the meeting pages below |
| **19b** One-click generation | "Generate summary and minutes" button: validates attendee and transcript, calls the 7v chain with chunking, saves a draft with status, handles failure and retry, regenerate as a new version | `meeting_minutes` (source_type, source_id, version, content JSON, status, generated_by, edited_by) | 5 | button and draft view on the meeting pages below |
| **19c** Edit, approve, share, export | Edit the draft, mark approved, share with attendees (notification in Step 12), PDF export; action items listed with owner and due date | `meeting_minutes_shares` (or reuse notifications; decide in the plan) | 6 | minutes view, share and export on the meeting pages below |
| **19d** Audio or video to transcript (needs Step 4) | Upload a recording, speech-to-text (Whisper, Deepgram or Gemini audio; decide the provider and cost first), result saved as a transcript; consent record required before processing | `meeting_recordings` (propose first) | 5 | upload and status on the meeting pages below |
| **19e** Action items to tasks | A button turns one action item into a task (5c) only when the owner is an active member of the startup; never automatic | none new (uses 5c) | 2 | action item list on the minutes view |
| **19f** Step 19 test pass | Click through as a mentor, founder, team member, investor, employer, interviewer, candidate and an outsider | none | 0 | all pages below |

Meeting pages that get the button and panels: /mentor/sessions/[sessionId], /startup/sessions/[sessionId] (8d), /investor/meetings, /startup/meetings (9f), /employer/interviews, /startup/hiring/interviews (7f).

Notes:
- **Order:** 19a to 19c can start with mentoring sessions as soon as 7v exists, because 8d is already built. Investor meetings wait for 9f, interviews wait for 7f; add each source type when its meeting model exists. 19d waits for Step 4.
- **Do not overwrite manual notes:** 8d sessions already have their own summary and action items. The AI draft lives in `meeting_minutes` and is copied into the session only when the user clicks to accept it.
- **Who can see minutes:** only attendees and permitted roles of that meeting. Interview minutes are visible to the employer-side interviewers only; sharing with the candidate is a separate, explicit action. Interview feedback and scorecards (7e, 7f) are never put into minutes automatically.
- **Consent (DPDP):** show a notice in the meeting UI before any recording or transcription; store who consented and when; no processing without it. Sending transcripts to an external AI provider needs the same consent and a retention rule (decide how long transcripts are kept).
- **Accuracy:** owners and due dates only if they were actually said in the meeting, otherwise left empty. The UI labels minutes as AI-generated drafts until approved.
- **Abuse and cost:** per-user and per-organization rate limits, input size cap, and usage metering through 7v. A meeting can have only one generation running at a time.
- **Tests:** outsider and non-attendee rejected for every endpoint, cross-organization source ids rejected, regenerate keeps the old version, a failed generation leaves no half-saved minutes, mass-assignment cannot set `status`, `generated_by` or `version`.

---

## Order summary and recommended build order

Step numbers: 0 Paper review, 1 Foundation, 2 Auth, 3 Profiles and organizations, 4 Files, 5 Startup workspace (5a to 5n), 6 Connections, 7 Hiring (7a to 7x), 8 Mentors (8a to 8k), 9 Investors and data room (9a to 9n), 10 Community and events, 11 Messaging, 12 Notifications, 13 Search, 14 Billing (14a to 14i), 15 Admin console (15a to 15r), 16 Frontend final sweep, 17 Hardening, 18 Deployment, 19 Meeting summary and minutes (19a to 19f).

Recommended build order, because of dependencies:
1. Steps 0 to 3 (3d team management still open) and Step 5 (5a to 5n, in progress).
2. **Admin core: 15a, 15b, 15c.** Admin accounts, the audit log, and user and organization management. Many later steps need an admin (readiness sign-off, verification, suspension), and every admin action must be audited from the start.
3. **Step 4 (files).** Needed by 7h (hire documents), 9g (data room) and uploads such as logos and decks.
4. **Step 7** (employer and job seeker hiring), then **Step 8** (mentors), then **Step 9** (investors). Within each, follow the sub-step order. 8f needs 5f; 9g needs Step 4.
5. Step 6 (connections) only if the frontend needs it, then Steps 10, 11, 12, 13 (split them first).
6. **Step 14** (billing), with the payment provider decided before 14c.
7. The rest of the admin console: 15d to 15r, once the data they manage exists.
8. Steps 16, 17, 18.

AI features: build **7v** (AI layer) early, any time after Step 3, because 7w, 7x, 7o to 7q and Step 19 all use it. **7w** comes after 7n and 7v. **7x** comes after 7c, 7d and 7w. **Step 19a to 19c** can start with mentoring sessions as soon as 7v exists (8d is built); add investor meetings after 9f and interviews after 7f; 19d needs Step 4.

Pause for a real frontend click-through at the end of each step (the "test pass" sub-step). Use the same two prompts for every sub-step: "Do <sub-step> backend phase only", then "Do <sub-step> frontend wiring".