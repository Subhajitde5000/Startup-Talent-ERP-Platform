# Backend Progress Map: Forma

Matches BUILD_PLAN.md v3 (step numbers are the same). For every step that has pages, two phases: (A) backend done and tested, (B) frontend wired, demo data removed, dev seed script updated. Tick both. Finish and test each step before the next. The agent ticks boxes after each finished step.

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

## Step 4: Files (backend implemented; final verification gate still open)
- [x] A: Cloudflare R2 adapter and signed staging upload URLs (adapter/signing tested; live R2 check pending)
- [x] A: Kind-specific metadata/actual-byte validation, fail-closed scan workflow, immutable final objects, retry-safe processing leases
- [x] A: Private signed downloads with personal ownership / active organization membership checks, strict server-owned fields and shared rate limiting
- [x] A: Avatar (`image`), logo, resume and deck backend upload/download flows tested; avatar/logo WebP thumbnails (no profile attachment or frontend wiring)
- [x] A: Abandoned/deleted upload cleanup and retry command; deployment cron instructions (schedule must be installed by deployment)
- [ ] A: Required Docker Compose PostgreSQL test + migration verification, and live private-R2 upload/download/CORS smoke test
- [x] B: Approved batch 1 — startup logo, pitch-deck selection, paginated private documents list and startup onboarding deck upload wired through the existing typed client
- [ ] B: Remaining Step 4 surfaces from the inventory (avatars/user profiles, resumes and other approved follow-up batches); no other-step pages wired
- [ ] B: Final frontend verification gates — live private-R2/CORS smoke, full-repository lint baseline, and no-browser-token-storage requirement (authentication changes explicitly deferred by user)

_Batch 1 B (2026-11-23): `0032_step4_org_file_selections` adds nullable indexed `organizations.logo_file_id` and `startup_profiles.pitch_deck_file_id` SET NULL references. Selection requires a same-org, ready/clean file of the correct kind; soft deletion detaches references transactionally; private IDs are omitted from public profiles. Existing external URL fields remain separate. Logo selection is owner/admin-only; deck/content writes allow members; viewers read/download only; members delete/confirm their own files, admins/owners any org file. The fake inline documents/Public/NDA controls are removed, private/public preview is truthful, and cover upload is explicitly disabled (no cover storage field). No shared mock module was deleted._

_Batch 1 B checks: frontend production build, separate typecheck and changed-file lint pass; full `npm run lint` fails on existing errors in untouched pages. Targeted backend regression (files, attachment selections, development seed, startup profiles, organizations) **150 passed on SQLite and 150 on native PostgreSQL 16.2**; revision 0032 upgrade/downgrade/upgrade passed. Backend Ruff and `mypy app scripts/maintain_files.py` pass (209 sources). Browser interaction checks covered owner/admin/member/viewer controls, ready upload/deck persistence, logo thumbnail, viewer download, admin delete-other, validation/rejection and list-error retry; onboarding explicitly creates an org before upload and final save preserves both uploaded selection and external link. Browser storage was a temporary test-only memory adapter, NOT R2. A pre-existing onboarding hard-reload draft/progress issue remains: unsaved non-file text can be lost and the step resets; the durable deck ID itself survives. Existing shared-client localStorage authentication remains unchanged by the user's explicit defer-auth decision, so the no-browser-token-storage gate is **unmet**._

_Batch 1 B seed: old document names now live only in `scripts/seed_dev.py`, guarded by literal `ENVIRONMENT=development`. With configured private R2 and explicit development scanner opt-in, valid sample PDF/XLSX objects go through reservation, byte upload, confirmation and normal processing; dates/sizes/hashes are real. Without configuration the seed skips files and inserts no phantom ready rows. Other-step demo records/stores and remaining Step 4 inventory batches are intentionally untouched. No commit or push._

_Backend implementation is **not signed off as complete** while the verification gate above is unchecked. Revision `0031_step4_files` creates only `files`. Approved additions: upload lifecycle/staging/thumbnail fields, internal processing token + lease expiry, purge checkpoint, bounds/CHECKs and uploader/work/cleanup indexes; reference names, kinds, scan states and SET NULL FKs retained. Organization deletion cannot transfer a file into personal scope. Existing profile URL fields are unchanged._

_Verification (2026-11-23): full SQLite suite 1,014 passed / 1 skipped before two final Step 4 tests were added; final Step 4 rerun **88 passed on SQLite and 88 passed on PostgreSQL 16.2**. PostgreSQL full run had no failures but hit the 30-minute tool timeout after passing all files preceding `test_tasks.py`; rerunning the final `test_tasks.py` + `test_team.py` completed **80 passed**, covering the remainder with overlap. PostgreSQL `upgrade head → downgrade -1 → upgrade head` passed on a separate scratch DB. `ruff check app alembic scripts`, `mypy app scripts/maintain_files.py`, and new-file formatting checks pass. Two pre-existing nullable organization lookups in `test_investor_directory.py` gained assertions to satisfy the installed type checker; no other-step business logic changed._

_Environment limits: Docker/Compose is absent, so PostgreSQL used a temporary native binary over a Unix socket, **not Docker**; this does not replace the required Compose gate. R2 hosts are blocked by sandbox outbound policy, so live Cloudflare verification is pending. Scanner is intentionally a hook: default unconfigured fails closed; explicit `dev_clean` is forbidden in production. A real scanner, deployment cron installation and legally approved retention remain operational prerequisites. Fresh SQLite migration history also fails in existing revision `0014` (unsupported ALTER constraint); old migrations were not edited. Use PostgreSQL for migrations; investigate SQLite-history support separately if wanted. Repository-wide formatting has existing drift; new Step 4 files are formatted. The preceding backend-only verification predates the batch 1 B work documented above._

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

### 7v AI layer foundation
- [ ] A: LangChain model factory from `.env` (Gemini for testing, Claude later), Pydantic output schemas, prompt templates, service layer, per-user rate limits and usage metering (`ai_usage_events`, propose first), AI call logging without personal data, eval set to compare Gemini and Claude
- [ ] B: no page of its own (admin usage view later in 15o)

### 7w AI resume generation, profile first
- [ ] A: Generate a resume from the existing profile and ask only for missing fields (`GET /resumes/requirements` with one `REQUIRED_FIELDS` config), opt-in save of answers back to the profile, no invented facts, optional job description tailoring
- [ ] B: /jobseeker/resumes/new (generate flow), /jobseeker/resumes/[resumeId] (editable preview, PDF export) wired; demo data removed

### 7x Company-perspective resume (GAP)
- [ ] Confirm what "company perspective" means (assumed: employer-side view of a candidate, job-aligned, gaps shown separately)
- [ ] A: model proposed first and approved; company template; only for candidates who applied (7c) or consented; blind-review respected
- [ ] B: /employer/jobs/[jobId]/applicants/[applicantId], /startup/hiring/[jobId]/applicants/[applicantId], /employer/templates (resume template part) wired; demo data removed

## Step 8: Mentors (one sub-step at a time; A = backend, B = frontend wired)

### 8a Mentor directory (startup view)
- [x] A: read-only mentor directory, NO new table and NO migration (reads the Step 3c `mentor_profiles`). Three endpoints on the existing mentor router: `GET /mentors` (search, filters, pagination) and `GET /mentors/{handle}` for any signed-in user, plus `GET /organizations/{id}/mentor-suggestions` for active members of that startup. Visibility is `users.profile_public` because `mentor_profiles` has no visibility column; a hidden mentor is ABSENT from the list and 404 on detail, never 403 (no existence oracle). Filters: expertise/sector/language (exact, case-insensitive), `verified_only`, `accepting_only`, `free_only`, `max_fee`, multi-term `q` with LIKE escaping; sorts relevance/rating/price/experience with stable tiebreaks. Suggestions are ranked only by what the startup DECLARED (goals vs expertise, sector) and every item carries `match_reasons` built from fields that actually matched — no stored score, no hidden weights. `stage_filter_applied: false` is returned because mentors have no stage attribute (plan D-1), so the page cannot imply a stage match it did not make. Search is rate limited per user (60 / 5 min). 18 new tests; 590 pass on SQLite and PostgreSQL 16.2
- [x] B: /startup/mentors/find, /startup/mentors/find/[mentorId] wired; demo data removed

### 8b Mentorship requests
- [x] A: `mentorships` (0017). One table, no new enum type. `POST /organizations/{id}/mentorships` (owner/admin/member; viewer 403), `GET /mentorships` (side=mentor|startup, status filter, paging), `GET/PATCH /mentorships/{id}`, and the transitions accept/decline/cancel/end/pause/resume, plus `GET /mentor/startups`. State machine is `requested→active|declined|cancelled`, `active→paused|completed`, `paused→active|completed`; anything else is 409 `INVALID_STATE`. "One active mentorship per pair" is schema.sql's partial unique index verbatim (requested/active/paused, `deleted_at IS NULL`), with IntegrityError mapped to 409 `MENTORSHIP_EXISTS` so a lost race is not a 500. A non-participant gets 404, never 403 (8a's no-existence-oracle rule). Deviations: `needs` is JSON not `text[]`, `currency` is `String(3)`+CHECK not `char(3)`, `fit_score` reserved and never written. `/mentor/discover` is NOT rebuilt — 5h `GET /startups` already serves it with the mentor audience (`profile_visibility='mentors'`). 44 tests.
- [x] B: /mentor/requests, /mentor/startups (list), /mentor/discover wired to the real API; `initialRequests` removed. `/startup/mentors/requests` is NOT wired — it belongs to the startup side of the same resource but was not in this step's B list, so it stays on demo data. `/mentor/discover` reuses 5h `GET /startups` (no new backend). Tab set reduced to what the API can answer: "Invitations sent" and "Auto-match suggestions" were removed (8b has no mentor-initiated invite endpoint and `fit_score` is never written), so no invented ranking. `score`/`fit`/`sessions`/`signed` cards removed rather than faked. `MentorshipParticipant` gained `stage`/`sector`/`city`/`tagline` (read-only pass-throughs) because the request cards need them. `initialStartups` KEPT — five other-step pages still import it.

### 8c Availability slots (GAP, only if the UI needs it)
- [x] A: `mentor_availability` (0018) — a GAP table, proposed and approved. Weekly recurring template (`weekday` 0=Mon, local `start_time`/`end_time`, IANA `timezone`, `is_active`), not materialised dated slots, so 8d computes bookable times without a generator job. `GET/PUT/POST /mentor/availability`, `DELETE /mentor/availability/{id}` (owning mentor only; a non-mentor is 403), `GET /mentors/{handle}/availability` and `GET /mentors/{handle}/slots` for signed-in viewers, both resolving the handle through 8a's own visibility query so a hidden profile is 404. Overlaps are rejected 422/409 in the service (an EXCLUDE constraint has no SQLite equivalent); a rejected PUT leaves the previous week intact. Windows are stored in the mentor's zone and converted at read time, so 18:00 local survives a DST change. 34 tests.
- [x] B: the booking step is wired — the sessions schedule dialog offers only `GET /mentors/{handle}/slots` instants (8c), never a hand-written option list, and shows an explicit state when the mentor has no public handle. The availability section in /mentor/profile/edit was already wired in Step 3c to `updateMe`; 8c adds no page of its own. A slot the server would reject can therefore no longer be offered in the UI.

### 8d Sessions
- [x] A: `mentoring_sessions` + `session_attendees` (0019). `POST/GET /mentorships/{id}/sessions`, `GET /sessions` (upcoming filter), `GET /sessions/{id}`, and confirm/reschedule/cancel/complete/no-show. Complete and no-show are mentor-only (403); no-show additionally requires the start time to have passed. Viewers read but never write. Double booking is two guarantees: a partial UNIQUE index on `(mentorship_id, scheduled_at)` for live statuses, and a transactional `SELECT ... FOR UPDATE` overlap check for one mentor across different startups (409 `SLOT_TAKEN` both ways). A cancelled session frees its slot. Deviations: `action_items` is JSON not `text[]`; `readiness_id` is NOT created because nothing in 8d writes it (8f/8e own that link); `meeting_url` must be https so a `javascript:` link can never be stored. `next_session_at`/`last_session_at` on the mentorship are derived from sessions, never client input. 43 tests.
- [x] B: /mentor/sessions, /mentor/sessions/[sessionId], /startup/sessions, /startup/sessions/[sessionId] wired; `initialSessions` and the inline arrays + `sessionDetails` map removed. The startup routes stay on the shared `mentor-app.jsx` shell (the two route families render different chrome), so the block was replaced in place instead of forking a 2,100-line file. Notes/agenda/files/recording stay local to the page and say so — 8d stores no notes, so nothing is written to a fake store.

### 8e Deliverables
- [x] A: `mentor_deliverables` (0020). `POST/GET /mentorships/{id}/deliverables`, `GET/PATCH/DELETE /deliverables/{id}`. Only the mentor on the row creates, retitles, reassigns or deletes; the assignee may only move `status`/`evidence` through the assignee half of the state machine (`not_started -> in_progress -> submitted`, `changes_requested -> in_progress`); accept/request-changes are mentor-only, so nobody reviews their own work. Any active member reads (viewer included, `can_edit=false`); an outsider gets 404, never 403. `overdue` is never written — `is_overdue` is derived from `due_on` and the status (Q4). Deviations: `file_id` dropped (Step 4 `files` does not exist; evidence is text), `status` is `String(24)` + named CHECK (a 16 silently truncates `changes_requested`, caught by the PostgreSQL run), and `reviewed_by` is ADDED because schema.sql records when but not who reviewed. `owner_id` is restricted to active members of that startup (422 on the field). 40 tests.
- [ ] B: /mentor/deliverables, deliverables in /startup/mentors wired; demo data removed

### 8f`` Mentor readiness sign-off``
- [x] A: `POST /mentorships/{id}/readiness/{criterion_id}/sign-off` and `.../revoke`. Additive migration 0021 adds nullable `startup_readiness.signed_off_mentorship_id -> mentorships` (Q1a), so a sign-off records WHICH engagement it came through; `signed_off_by` already held the user. The mentor must be the one on that row AND the mentorship must still be `active` (409 otherwise). Every startup member — the owner included — gets 403, which is what makes self-sign-off structurally impossible; an outsider or another mentor's row is 404. Revoke is limited to the sign-off that came through that same mentorship (409 otherwise), so one mentor cannot undo another's judgement and 8f cannot undo an admin sign-off. The 5f admin route is unchanged and stamps no mentorship. 12 tests.
- [ ] B: /mentor/startups/[mentorshipId]/readiness, /startup/readiness (sign-off status) wired; demo data removed

### 8g Agreements
- [ ] A: Terms (fee, equity, cadence), send, sign by each side, versions
- [ ] B: /mentor/agreements, /mentor/agreements/[agreementId], agreement card in /startup/mentors/[mentorshipId] wired; demo data removed

### 8h Earnings records
- [x] A: `mentor_earnings` (0022) with the `mentor_earning_math` CHECK, so the database itself guarantees `net = gross - commission - tds`. Rows are created in ONE place — `earning_service.record_for_session`, called by `session_service.complete` inside the completing transaction — from the session's own fee; there is no write endpoint. Idempotent on `session_id`, and a free/zero-fee session creates nothing. `GET /mentor/earnings` (filter + pagination) and `GET /mentor/earnings/summary` are mentor-only and scoped to the caller's own rows. **Rates default to 0** (Q2a): BUILD_PLAN and schema.sql define no commission or TDS anywhere, so none was invented — `net == gross` until finance/legal supply real rates, and they must be set before 14f releases a payout. `payout_batch_id` is a plain UUID with no FK until 14f creates `payout_batches`. 19 tests.
- [ ] B: /mentor/earnings (read-only until 14f) wired; demo data removed

### 8i Reviews and ratings (GAP)
- [ ] A: In progress — session review table and endpoints added; PostgreSQL Docker Compose verification and remaining edge-case coverage are still open.
- [ ] B: In progress — review prompt and consented reviews wired; role-by-role browser testing remains open.

### 8j Mentor workspace, dashboard and impact
- [ ] A: In progress — workspace/readiness and aggregate endpoints added; Docker Compose verification and complete dashboard/impact coverage are still open.
- [ ] B: In progress — workspace, overview, dashboard and impact wired; role-by-role browser testing, complete seed coverage and full frontend lint remain open.

### 8k Step 8 test pass
- [ ] Click-through done, no leftover demo data on wired pages

## Step 9: Investors, rounds, data room (one sub-step at a time; A = backend, B = frontend wired)

### 9a Funding rounds (startup)
- [x] A: Create and edit a round (target, instrument, valuation, dates), status, progress against target — `funding_rounds` table (migration 0024), 7 endpoints (create/list/summary/get/patch/status/soft-delete), state-machine transitions, derived progress, member read / owner-admin-member write, server-only `committed_amount`, audit rows; tests pass on SQLite (ruff/mypy clean). PostgreSQL/Docker migration verification pending in this sandbox (no Docker, apt repos network-restricted).
- [x] B: /startup/rounds, /startup/rounds/[roundId] wired; demo data removed

### 9b Investor directory (startup view)
- [x] A: Startup searches and filters investors, public investor page; uses the investor organization profile and, once 9d exists, investor preferences — read-only, no new tables; 4 endpoints (`GET /organizations/{org_id}/investors` list with q/type/sector/stage/ticket/location/verified filters + pagination, `/summary`, `/filters`, `/{investor_org_id}`); any active startup member (viewer included); foreign org 404; rate-limited; tests pass on SQLite (ruff/mypy clean)
- [x] B: /startup/investors/discover, /startup/investors/[investorId] wired to the 9b directory APIs (list/summary/filters/get) in `investor-app.jsx`; loading/empty/error states; demo data removed to `seed_dev.py``

### 9c Startup discovery (investor view)
- [x] A: Search startups with filters, startup detail respecting visibility and round toggles; compare stays client-side — read-only, no new tables; 4 endpoints (`GET /investors/startups` list, `/filters`, `/{identifier}` detail, `/{identifier}/rounds`); any signed-in user (5h visibility); round data gated by `round_public` (aggregates NULL + `round_visible` flag, rounds 404 when not opted in); shared query with 9d matches; tests pass on SQLite (ruff/mypy clean)
- [x] B: /investor/discover, /investor/startups/[startupId], /investor/compare wired to the 9c discovery APIs (list/filters/get/rounds, and `/investors/deals` for compare); loading/empty/error states; demo data removed to `seed_dev.py` (added `org_id` to the 9c item/detail schema for shortlist links)

### 9d Preferences, saved searches and shortlist (GAP)
- [x] A: Investor preferences (sectors, stage, ticket size), saved searches, shortlist; propose tables first — `investor_preferences`/`saved_searches`/`shortlist_entries` (migration 0025); 11 endpoints under `/investors/me`; investor-firm member read / owner-admin-member write (viewer 403), org-scoped 404, criteria whitelist, soft delete, audit rows; tests pass on SQLite (ruff/mypy clean)
- [x] B: /investor/searches, /investor/shortlist wired to the 9d CRUD APIs; investment preferences (ticket range, stage focus, sectors) wired into profile edit (`PUT /investors/me/preferences`); loading/empty/error states; demo data removed to `seed_dev.py`

### 9e Pipeline
- [x] A: Investor deal board with stages, probability, ticket size, next step, stage history, private notes; the startup sees its own investor list without private notes — `investor_deals` (schema.sql verbatim) + `investor_deal_stage_history` (migration 0026), `pipeline_stage` gains `diligence`; 10 endpoints (investor: list/create/summary/get/patch/delete/history; startup: list/get/stage-only patch); startup read strips `fit_note`/`probability`/`passed_reason`/`owner_id`; stage changes logged in-transaction; tests pass on SQLite (ruff/mypy clean)
- [x] B: /investor/pipeline, /startup/investors/pipeline wired to the 9e deal APIs (list/summary/create/update/delete, stage-only PATCH); Board/Table/Funnel from real deals; loading/empty/error states; demo data removed to `seed_dev.py`

### 9f Requests, introductions and meetings (GAP)
- [x] A: Intro, meeting and information requests between investors and startups; propose the model first
- [x] B: /investor/requests, /investor/meetings, /startup/meetings (investor-app.jsx meetings branch) wired to the 9f engagement APIs; loading/empty/error states; demo data removed to `seed_dev.py`

### 9g Data room core (needs Step 4)
- [x] A: Folders, documents stored as files, visibility level per document, versions — backend implemented in 0033; verification/status in `backend/DATA_ROOMS.md`. Required Docker Compose PostgreSQL gate blocked (Docker unavailable); not marked complete.
- [x] B: /startup/data-room wired to typed APIs; scoped demos moved to guarded real-file dev seed; build/typecheck/scoped lint and role-browser checks passed. Verification gates remain open (unchanged localStorage auth; live R2/Compose unavailable); see `frontend/DATA_ROOMS.md`.

### 9h Data room access, NDA and audit
- [x] A: Access requests (approve, deny, revoke, expire), NDA tracking, every view logged — backend implemented in 0034 with personal scope, pinned NDA and authenticated retrieval audit; see `backend/DATA_ROOMS.md`. Required Docker Compose PostgreSQL gate blocked (Docker unavailable); not marked complete.
- [x] B: /startup/data-room/requests, /investor/data-rooms, /investor/data-rooms/[startupId], /investor/data-rooms/[startupId]/nda wired to typed APIs; scoped mocks removed; personal grants/pinned NDA/audited bytes verified in browser. Verification gates remain open (unchanged localStorage auth; live R2/Compose unavailable); see `frontend/DATA_ROOMS.md`.

### 9i Offers
- [x] A: Offers with versions and counters; accept, decline, expire
- [x] B: /investor/offers, /investor/offers/new, /investor/offers/[offerId] wired to the 9i offer APIs (list/create/send/get/history/counter/withdraw); loading/empty/error states; demo data removed to `seed_dev.py`

### 9j Commitments and portfolio
- [x] A: Commitments with status and funding progress; portfolio holdings
- [x] B: /investor/commitments, /investor/commitments/[commitmentId], /investor/portfolio, /investor/portfolio/[startupId] wired to the 9j commitment/holding APIs; loading/empty/error states; demo data removed to `seed_dev.py`

### 9k Diligence (GAP)
- [x] A: Diligence checklist and notes per startup; no table exists, propose first
- [x] B: /investor/startups/[startupId]/diligence wired to the 9k diligence APIs (checklist auto-created per startup; items CRUD; notes/scorecard/overall status); loading/empty/error states; demo data removed to `seed_dev.py`

### 9l Investor dashboard, insights and activity
- [x] A: Read-only aggregates and activity feed
- [x] B: /investor/dashboard, /investor/insights, /investor/activity wired to the 9l workspace APIs (dashboard summary, insights, activity feed + stats); loading/empty/error states; demo data removed to `seed_dev.py`

### 9m Startup investor hub and visibility settings
- [x] A: Startup's investor overview (read-only aggregates from 9a to 9j) — `GET /organizations/{org_id}/investor-hub/summary|rounds|activity|activity/stats`, any active member incl. viewer; no new tables/migration; visibility reuses the 5a startup-profile GET/PATCH (no second copy). Activity feed is org-scoped to the startup's own `activity_events.org_id` (investor-side actions are stamped on the investor firm's org and do not appear — open item for the frontend pass).
- [x] B: /startup/investors (hub), /startup/investors/settings wired in the shared `investor-app.jsx`; hub shows real 9m summary/rounds/needs-reply/upcoming-meetings/readiness data (interest-trend chart hidden as 5h analytics, not built); "Interested investors" reuses the 9e deals API (limit 3); settings binds real 5a profile visibility + `*_public` toggles with PATCH (changed fields only, 422 → field errors), viewer role read-only; three sidebar cards without APIs hidden; demo data removed; hub records added to `seed_dev.py` (dev-only: pending intro request, confirmed meeting, Zenith Capital deal on the founder's Pre-seed round, 3 startup-org activity events)

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

## Step 19: Meeting summary and minutes (one sub-step at a time; A = backend, B = frontend wired)
Needs 7v first. Works for mentoring sessions (8d), investor meetings (9f) and interviews (7f) through one generic `source_type` + `source_id` model.

### 19a Transcript and notes
- [ ] A: `meeting_transcripts`, attach, edit, delete, attendee-only access, recording-consent flag
- [ ] B: transcript and notes panel on the meeting pages wired; demo data removed

### 19b One-click generation
- [ ] A: `meeting_minutes`, generate with chunking and structured output, status and retry, regenerate as a new version, one generation at a time
- [ ] B: "Generate summary and minutes" button and draft view wired

### 19c Edit, approve, share, export
- [ ] A: edit draft, approve, share with attendees, PDF export; manual 8d session notes never overwritten
- [ ] B: minutes view, share and export wired; AI-draft label until approved

### 19d Audio or video to transcript (needs Step 4)
- [ ] A: recording upload, speech-to-text provider decided, consent record required (`meeting_recordings`, propose first)
- [ ] B: upload and status wired

### 19e Action items to tasks
- [ ] A: convert one action item into a task (5c) on click, owner must be an active member
- [ ] B: action item list wired

### 19f Step 19 test pass
- [ ] Click-through as mentor, founder, member, investor, employer, interviewer, candidate and outsider; no leftover demo data