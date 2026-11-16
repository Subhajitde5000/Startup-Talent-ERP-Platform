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

## STEP 5: Startups

Tables: `startup_profiles`, `startup_metrics`, `readiness_criteria`, `startup_readiness`, `milestones`, `tasks`, `task_labels`, `task_label_links`, `task_comments`. Team uses `organization_members` from Step 3.

Parts:
1. Startup profile: tagline, stage, sector, problem, solution, traction, location, founded date.
2. Visibility toggles (summary, traction, team, funding, round, readiness) and overall `profile_visibility`.
3. Team directory: titles, departments, public flag, founder flag.
4. Metrics time series (MRR, customers, burn, runway) with source labels; latest value for dashboards.
5. Readiness: criteria list, evidence, submit, mentor sign-off, score calculation (`v_startup_readiness`).
6. Milestones with progress and status.
7. Tasks: board columns, priority, assignee, due date, labels, comments, ordering.
8. Startup discovery list with filters (stage, sector, location), respecting visibility.
9. Mentor-verified and admin-verified flags.

Done when: a founder can create a startup, manage team, tasks and metrics, and visibility rules are enforced.

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

## STEP 7: Jobs and talent

Tables: `hiring_requests`, `jobs`, `job_skills`, `job_benefits`, `job_alerts`, `saved_jobs`, `talent_shortlists`, `talent_shortlist_members`, `job_applications`, `application_stage_events`, `application_notes`, `scorecards`, `scorecard_criteria`, `application_scores`, `interviews`, `interview_participants`, `interview_feedback`, `job_offers`, `offer_decline_reasons`, `hires`, `onboarding_templates`, `onboarding_template_items`, `hire_onboarding_items`, `hire_documents`, `message_templates`, and for job seekers `resumes`, `resume_experiences`, `resume_education`, `resume_skills`, `resume_ats_runs`, `practice_drills`, `practice_sessions`, `practice_transcript_turns`.

Build in sub-steps, each tested before the next:
- 7a Jobs: employer creates, publishes, pauses, closes; search and filters; salary and equity ranges.
- 7b Applications: apply with resume, duplicate prevention, stage pipeline with history, notes, withdraw.
- 7c Hiring workflow: scorecards, interviews and feedback, offers, hires, onboarding checklist and documents.
- 7d Job seeker tools: saved jobs, alerts, resumes, ATS runs, practice sessions.
- 7e Hiring requests and shortlists; funnel view (`v_job_funnel`).

Visibility: employers see only their own applicants; job seekers see only their own applications; blind-review mode hides identity fields.

Done when: post job, search, apply, review, interview, offer, hire all work and permissions hold.

---

## STEP 8: Mentors

Tables: `mentor_profiles`, `mentorships`, `mentoring_sessions`, `session_attendees`, `mentor_deliverables`, `mentor_agreements`, `mentor_earnings`.
**GAPs**: mentor availability slots and session reviews/ratings are not in schema.sql. Propose tables if the frontend needs them.

Parts:
1. Mentor listing and search (expertise, sector, accepting, rating).
2. Mentorship request from a startup, accept or decline, one active mentorship per pair.
3. Sessions: schedule, confirm, complete with summary and action items, cancel, no-show.
4. No double booking (database-level protection).
5. Deliverables with status flow and links to readiness criteria.
6. Agreements (fee, equity, cadence), signing status.
7. Earnings records (gross, commission, TDS, net); payouts are paid in Step 14.
8. Health indicator (on track, at risk, stalled).

Done when: request, accept, schedule, complete a session and record earnings; double booking is impossible.

---

## STEP 9: Investors, rounds and data room

Tables: `funding_rounds`, `investor_deals`, `investor_offers`, `commitments`, `portfolio_holdings`, `data_rooms`, `data_room_folders`, `data_room_documents`, `data_room_access_requests`, `document_views`.
**GAP**: investor preferences (focus sectors, stage, ticket size) and watchlist are not in schema.sql.

Parts:
1. Funding round setup and progress (`v_round_progress`).
2. Investor pipeline board: stages, probability, ticket size, next step, private notes (never visible to startups).
3. Startup discovery for investors, respecting startup visibility settings.
4. Offers with versions and counters; accept, decline, expire.
5. Commitments and funding status; portfolio holdings.
6. Data room: folders and documents, visibility levels, access requests, NDA tracking, approve, deny, revoke, expiry.
7. Every document view logged in `document_views`.
8. Confidentiality tests: an investor without approved access can never read data-room files.

Done when: pipeline, offers, commitments and data room access all work and access control is airtight.

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

## STEP 14: Billing, plans, payments and payouts

Tables: `plans`, `entitlements`, `plan_entitlements`, `subscriptions`, `promotions`, `billing_products`, `invoices`, `invoice_lines`, `payments`, `payment_methods`, `refunds`, `credit_wallets`, `credit_transactions`, `usage_meters`, `spending_controls`, `payout_batches`, `payout_holds`, `reconciliation_records`, `dunning_attempts`.

Parts:
1. Confirm payment provider with me first (Razorpay proposed).
2. Plans and entitlements; feature gating by plan and usage meters.
3. Subscriptions, trials, seats, cancel.
4. Checkout and invoices with GST/tax math, invoice numbering.
5. Payments from verified provider webhooks only; idempotent handling.
6. Refunds and failed-payment retries (dunning).
7. Credits for job posts, invites and featured listings.
8. Mentor payouts: batches, holds, maker/checker approval.
9. Reconciliation against provider settlements.

Done when: a paid plan can be bought, an invoice is issued, a webhook marks it paid, and a payout batch needs two different admins.

---

## STEP 15: Admin console, trust and safety, support, compliance

Tables:
- 15a Admin access and audit: `admin_members`, `audit_events`, `audit_integrity_checks`, `audit_export_requests`, `security_alerts`.
- 15b Trust and safety: `verifications`, `verification_checks`, `trust_policies`, `policy_rules`, `policy_blocklists`, `moderation_cases`, `user_reports`, `moderation_appeals`, `disputes`, `fraud_detections`.
- 15c Support: `help_articles`, `support_ticket_categories`, `support_tickets`, `support_ticket_messages`.
- 15d Compliance and data rights: `data_requests`, `consent_records`, `user_consents`, `data_processing_records`, `compliance_*`, `legal_holds`, `dpia_assessments`.
- 15e Platform operations: `feature_flags`, `platform_limits`, `integration_providers`, `webhook_endpoints`, `webhook_events`, `system_services`, `system_incidents`, `system_alerts`, `opportunities`, `opportunity_applications`, `matching_rules`, `fairness_metrics`, `ai_models`, `ai_reviews`, `content_items`, `content_versions`.

Build in this order and test each: 15a, 15b, 15c, 15d, 15e. Everything runs on the admin subdomain with the stricter auth policy from Step 2.

Parts:
1. Admin permission levels (analyst, support, manager, super admin) enforced per endpoint.
2. User management: search, verify, suspend, restore, force logout.
3. Moderation queues with SLA, assignment, resolution; appeals; disputes.
4. Verification review workflow.
5. Support tickets for users and a staff queue.
6. Data requests (access, erasure, and so on) with deadline tracking.
7. Feature flags, limits, integration health, system status.
8. Audit event written for every admin action (actor, target, before and after, reason).
9. Dashboards with aggregated, cached queries.

Done when: every admin action is permission-checked and audited, and nothing admin-related is reachable with a normal user token.

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

## Order summary

0 Paper review, 1 Foundation, 2 Auth, 3 Profiles and organizations, 4 Files, 5 Startups, 6 Connections, 7 Jobs, 8 Mentors, 9 Investors and data room, 10 Community and events, 11 Messaging, 12 Notifications, 13 Search, 14 Billing, 15 Admin, 16 Frontend connection, 17 Hardening, 18 Deployment.

Steps 0 to 5 keep this order. Steps 6 to 13 can be reordered by what the frontend needs most. Pause for a real frontend test after steps 5, 7, 9 and 10.