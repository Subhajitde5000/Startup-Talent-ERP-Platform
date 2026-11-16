# Forma Backend: Detailed Build Plan

Stack: Python, FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL.
Roles: startup member/founder, mentor, investor, job seeker, employer, admin.

How to use this file:
- Build one step at a time. Finish and test it before the next.
- For each step: tables, then migration, then service logic, then endpoints, then tests, then check against the frontend.
- Names of tables and fields below are suggestions. The agent must derive final fields from the frontend pages.
- Every step ends with its "Done when" checklist. Tick it in PROGRESS.md.

Standard for every step (from AGENTS.md): thin routers, logic in services, Pydantic Create/Update/Read schemas, object-level permission checks, paginated lists, consistent error format, tests for happy path, validation, authentication and authorization failures.

---

## STEP 0: Paper design (no code)

Parts:
1. **Entity list.** Every entity found in the frontend pages, grouped by role.
2. **Relationship map.** One-to-many and many-to-many links (for example startup to team members, job to applications, user to roles).
3. **Key decisions, written down and confirmed:**
   - One role or multiple roles per user
   - UUID or integer IDs
   - Soft delete policy (which tables)
   - Who owns each piece of data (founder owns startup, employer owns job, and so on)
   - Visibility rules (what each role can see of others)
   - File storage provider, email provider, realtime or polling
4. **Permission matrix.** A table of role vs action (create, read own, read others, update, delete) for each entity.
5. **Status lifecycles.** For example application: applied, shortlisted, interview, offered, hired, rejected, withdrawn. Connection: pending, accepted, declined, blocked.
6. **Naming and conventions.** Table names (plural snake_case), enum style, timestamp fields, API URL style.

Done when: entity list, relationship map, permission matrix and lifecycles are reviewed by you.

---

## STEP 1: Project foundation

Parts:
1. Backend folder structure and FastAPI app factory.
2. Config with pydantic-settings, `.env.example`, separate dev/test/prod settings.
3. Docker Compose with PostgreSQL (and Redis if planned for rate limiting or queues).
4. Async SQLAlchemy engine, session dependency, base model with `id`, `created_at`, `updated_at`.
5. Alembic configured for async, first migration runs up and down.
6. Common pieces: error format and exception handlers, request-ID middleware, structured JSON logging, CORS allow-list, health and readiness endpoints.
7. Test setup: pytest, test database, fixtures for client and DB session.
8. Lint and type checks (ruff, mypy), pre-commit hook.
9. API versioning under `/api/v1`.

Done when: app starts with one command, health endpoint works, tests run, migration applies and reverses.

---

## STEP 2: Authentication and account security

Tables: `users`, `roles` (or role enum), `user_roles` (if multi-role), `refresh_tokens`, `email_verification_tokens`, `password_reset_tokens`, `login_attempts` (or Redis), `user_sessions` (optional).

Parts:
1. **Registration.** Email, password, chosen role. Password strength rules. Duplicate email handling that does not leak whether an email exists.
2. **Password hashing.** argon2 (or bcrypt with proper cost).
3. **Login.** Verify credentials, issue access token (short-lived) and refresh token (long-lived, stored hashed).
4. **Refresh token rotation.** Each refresh issues a new token and invalidates the old one. Detect reuse of an old token and revoke the whole family.
5. **Logout and logout everywhere.**
6. **Email verification.** Single-use expiring token, resend with cooldown.
7. **Password reset.** Request, email, single-use expiring token, set new password, revoke all sessions.
8. **Change password and change email** (requires current password).
9. **Role dependencies.** `require_role(...)`, `get_current_user`, `get_current_active_user`, ownership helpers.
10. **Account states.** active, pending verification, suspended, deleted.
11. **Brute-force protection.** Rate limits per IP and per account, temporary lockout, generic error messages.
12. **Optional later:** OAuth login (Google, LinkedIn), MFA (required for admin).

Endpoints (examples): `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `GET /users/me`.

Tests: wrong password, expired token, reused refresh token, unverified user, suspended user, wrong role, rate limit hit.

Done when: a user can register, verify, log in, refresh, log out, reset password, and every protected route rejects wrong roles.

---

## STEP 3: Profiles and onboarding

Tables: `profiles` (base), `startup_member_profiles`, `mentor_profiles`, `investor_profiles`, `job_seeker_profiles`, `employer_profiles`, `skills`, `profile_skills`, `industries`, `locations` (or fields), `social_links`, `education`, `work_experience` (for job seekers and mentors).

Parts:
1. Base profile: name, headline, bio, photo, location, links, timezone, language.
2. Role-specific profile fields (derived from frontend forms).
3. Skills and industries as shared lookup tables, with search and suggestion endpoint.
4. Education and work experience (add, edit, delete, order).
5. Onboarding flow state: steps completed, profile completeness score.
6. Privacy settings: what is public, visible to connections only, or hidden.
7. Public profile view vs private edit view (separate Read schemas, never leak private fields).
8. Account settings: notification preferences, language, delete account request.

Endpoints (examples): `GET/PATCH /profiles/me`, `GET /profiles/{id}`, `PUT /profiles/me/skills`, `POST/PATCH/DELETE /profiles/me/experience`, `GET /skills?q=`.

Done when: every role can complete onboarding and edit its profile, and public views hide private fields.

---

## STEP 4: File uploads and media

Tables: `files` (owner, purpose, storage key, mime type, size, status, checksum), `file_access_grants` (for shared documents).

Parts:
1. Storage provider integration (S3-compatible, such as R2 or S3).
2. Upload flow: request upload (signed URL), upload directly to storage, confirm upload.
3. Validation: allowed types per purpose (image, PDF, DOCX), max size, safe generated file names.
4. Image handling: resize or thumbnail for avatars and logos.
5. Private downloads through short-lived signed URLs, permission check before signing.
6. Cleanup of orphaned or abandoned uploads (scheduled job).
7. Virus scanning hook (can be stubbed now, must be designed in).
8. Resume handling: parse metadata only at first, store versions.

Endpoints (examples): `POST /files/upload-url`, `POST /files/{id}/confirm`, `GET /files/{id}/download-url`, `DELETE /files/{id}`.

Done when: avatar, logo, resume and pitch deck upload and download work with permission checks.

---

## STEP 5: Startups

Tables: `startups`, `startup_members`, `startup_roles`, `startup_invites`, `startup_funding_rounds`, `startup_metrics`, `startup_documents`, `startup_updates` (progress posts).

Parts:
1. Create and edit a startup: name, logo, description, industry, stage, website, location, founded date.
2. Team members: invite by email, accept, roles inside the startup (founder, co-founder, member), remove.
3. Startup ownership and permissions (who can edit, who can only view).
4. Funding information: rounds, amounts, investors (careful with visibility).
5. Metrics and KPIs shown in the dashboard (users, revenue, growth), with history.
6. Startup updates and milestones.
7. Public startup page vs private dashboard data.
8. Verification flag set by admin.
9. Startup visibility: public, investors only, private.

Endpoints (examples): `POST /startups`, `GET/PATCH /startups/{id}`, `POST /startups/{id}/invites`, `GET /startups/{id}/members`, `POST /startups/{id}/metrics`, `GET /startups` (filters: stage, industry, location).

Done when: a founder can create a startup, invite a team, post metrics, and visibility rules are enforced.

---

## STEP 6: Connections and requests (shared system)

Tables: `connections`, `connection_requests`, `blocks`, `generic_requests` (optional shared request model with type and status).

Parts:
1. Send, accept, decline, cancel a connection request.
2. Who can connect with whom (rules per role pair).
3. Block and unblock users, and what blocking hides.
4. Connection list, mutual connections, request inbox and outbox.
5. Limits and abuse protection (daily request limit, duplicate request prevention).
6. Reusable status engine other features (mentor sessions, investor interest) can plug into.

Endpoints (examples): `POST /connections/requests`, `POST /connections/requests/{id}/accept`, `GET /connections`, `POST /blocks`.

Done when: connections work between allowed role pairs and blocks are respected everywhere.

---

## STEP 7: Jobs and talent (employers and job seekers)

Tables: `jobs`, `job_skills`, `job_applications`, `application_status_history`, `application_notes`, `saved_jobs`, `job_alerts`, `interviews`, `company_pages` (if separate from employer profile).

Parts:
1. Employer creates, edits, publishes, closes and archives jobs.
2. Job fields: title, description, type, location, remote option, salary range, skills, deadline.
3. Job search with filters (skills, location, type, salary, date), sorting, pagination.
4. Apply with resume, cover note, custom questions.
5. Application status pipeline with history (who changed what and when).
6. Employer applicant management: list, filter, shortlist, reject, add private notes.
7. Interview scheduling records.
8. Job seeker: saved jobs, application tracker, withdraw application.
9. Duplicate application prevention, application deadline enforcement.
10. Job alerts (saved searches) delivered by notifications later.
11. Visibility: employers see only their own applicants, job seekers see only their own applications.

Endpoints (examples): `POST /jobs`, `GET /jobs`, `POST /jobs/{id}/apply`, `GET /employers/me/jobs/{id}/applications`, `PATCH /applications/{id}/status`, `POST /jobs/{id}/save`.

Done when: full flow works: post job, search, apply, review, change status, and permissions hold.

---

## STEP 8: Mentors

Tables: `mentor_availability`, `mentor_sessions`, `session_requests`, `session_reviews`, `mentor_topics`, `mentorship_relationships`.

Parts:
1. Mentor listing and search (expertise, industry, availability, rating).
2. Availability slots with timezone handling.
3. Session request: startup member asks a mentor for a session.
4. Mentor accepts, declines or proposes another time.
5. Booking without double-booking (database-level protection).
6. Session details: link or location, agenda, notes, outcome.
7. Cancellation and rescheduling rules.
8. Reviews and ratings after a session (only participants can review, once).
9. Ongoing mentorship relationships and history.
10. Calendar integration later (design for it, do not build yet).

Endpoints (examples): `GET /mentors`, `PUT /mentors/me/availability`, `POST /mentors/{id}/session-requests`, `PATCH /session-requests/{id}`, `POST /sessions/{id}/reviews`.

Done when: a startup can request, a mentor can accept, double booking is impossible, and reviews work.

---

## STEP 9: Investors and deals

Tables: `investor_preferences`, `investor_interests` (watchlist), `pitch_requests`, `deal_pipeline_stages`, `deals`, `deal_notes`, `data_rooms`, `data_room_documents`, `data_room_access`, `introductions`.

Parts:
1. Investor profile: focus industries, stage, ticket size, geography.
2. Startup discovery for investors with filters and matching by preferences.
3. Watchlist and saved startups.
4. Express interest and pitch requests (startup to investor, investor to startup).
5. Deal pipeline with stages (sourced, contacted, meeting, due diligence, term sheet, closed, passed).
6. Private investor notes (never visible to startups).
7. Data room: startup shares documents with specific investors, view-only or download, expiry, revoke, access log.
8. Introductions through mutual connections.
9. Strict confidentiality rules: financial data visible only to granted investors.

Endpoints (examples): `GET /investors`, `GET /startups/discover`, `POST /pitch-requests`, `PATCH /deals/{id}/stage`, `POST /data-rooms/{id}/access`.

Done when: investors can discover, request, track deals, and data room permissions are airtight.

---

## STEP 10: Community

Tables: `community_spaces` (categories or channels), `posts`, `comments`, `reactions`, `post_tags`, `bookmarks`, `reports`, `moderation_actions`, `pinned_posts`.

Parts:
1. Spaces or categories (general, startups, hiring, investors, mentors), with role-based visibility.
2. Create, edit, delete posts (soft delete, edit history optional).
3. Comments with nesting depth limit, edit and delete.
4. Reactions and bookmarks.
5. Feed: latest, popular, by space, by tag, from connections. Cursor pagination only.
6. Mentions and tags.
7. Report content (reason, status) and moderation queue for admin.
8. Abuse controls: rate limits for posting, spam detection hook, banned or muted users.
9. Pinned and announcement posts by admin.
10. Counts (comments, reactions) stored or cached carefully to avoid slow queries.

Endpoints (examples): `GET /community/feed`, `POST /community/posts`, `POST /posts/{id}/comments`, `POST /posts/{id}/reactions`, `POST /reports`.

Done when: users can post, comment, react, report, and feeds stay fast with large data.

---

## STEP 11: Messaging

Tables: `conversations`, `conversation_participants`, `messages`, `message_reads`, `message_attachments`.

Parts:
1. Direct conversations between allowed users (respect blocks and role rules).
2. Optional group conversations (design now, build if needed).
3. Send, list (cursor pagination by time), mark as read, unread counts.
4. Attachments through the file system from Step 4.
5. Realtime delivery: WebSocket if confirmed, otherwise polling first. Authenticate sockets with the same token system.
6. Delete or hide messages, report a conversation.
7. Rate limits and spam protection.
8. Privacy: only participants can ever read a conversation, with tests proving it.

Endpoints (examples): `POST /conversations`, `GET /conversations`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`, `POST /conversations/{id}/read`, `WS /ws`.

Done when: two users can chat, unread counts are right, and outsiders cannot access any conversation.

---

## STEP 12: Notifications and email

Tables: `notifications`, `notification_preferences`, `email_logs`, `device_tokens` (if push is planned).

Parts:
1. Event system: services emit events (new application, connection request, message, reply, session booked, deal update).
2. In-app notifications: list, mark read, mark all read, unread count.
3. Email notifications through a provider, with templates.
4. User preferences per notification type and channel.
5. Background processing (task queue or background tasks) with retries.
6. Digest emails (daily or weekly) later.
7. Unsubscribe links and compliance basics.

Endpoints (examples): `GET /notifications`, `POST /notifications/{id}/read`, `GET/PUT /notification-preferences`.

Done when: key events create notifications and emails without slowing requests.

---

## STEP 13: Search and discovery

Parts:
1. PostgreSQL full-text search with indexes (GIN) for startups, jobs, mentors, investors, posts.
2. Unified search endpoint plus per-entity search with filters.
3. Ranking basics (relevance, recency, verified status).
4. Autocomplete for skills, industries, locations.
5. Respect visibility and privacy in every result.
6. Measure query speed, and only add a search engine if Postgres is not enough.

Done when: search is fast, relevant, and never returns data the user may not see.

---

## STEP 14: Admin console APIs

Tables: `admin_audit_logs`, `feature_flags`, `announcements`, `platform_settings`.

Parts:
1. Separate admin authentication policy: shorter tokens, MFA, IP or device controls, separate subdomain CORS origin.
2. Admin roles (super admin, moderator, support) with a permission matrix.
3. User management: search, view, verify, suspend, restore, force logout, delete.
4. Startup and job moderation: verify startups, remove content.
5. Community moderation queue: review reports, take action, notify users.
6. Platform dashboard: sign-ups, active users, jobs, applications, deals (aggregated queries, cached).
7. Announcements and platform settings.
8. Audit log written for every admin action (who, what, when, before and after).
9. Data export and deletion requests handling.

Done when: every admin action is permission-checked and logged, and nothing admin-related is reachable from normal user tokens.

---

## STEP 15: Connect the frontend

Parts:
1. Export the OpenAPI schema and generate a typed client for Next.js.
2. API client setup: base URL, token storage, automatic refresh, error handling.
3. Replace mock data role by role (start with auth, then one role at a time).
4. Handle loading, empty, and error states on every page.
5. Fix mismatches: missing fields, wrong names, permissions.
6. End-to-end test of each role's main flow.

Done when: every page uses the real API and each role's main journey works.

---

## STEP 16: Hardening and quality

Parts:
1. Security review: permissions on every endpoint (IDOR checks), upload safety, headers, dependency audit, secrets scan.
2. Performance: find slow queries (EXPLAIN), fix N+1, add or remove indexes, connection pool tuning.
3. Load test key endpoints (login, feed, search, messages).
4. Test coverage review, add missing authorization tests.
5. Data integrity review: constraints, cascades, orphaned records.
6. Backup and restore test.
7. Privacy: data export, account deletion, PII masking in logs.
8. Error tracking and monitoring (logs, metrics, alerts).

---

## STEP 17: Deployment

Parts:
1. Production Dockerfile (multi-stage, non-root).
2. Environments: dev, staging, production with separate secrets.
3. Managed PostgreSQL, automated backups, point-in-time recovery if available.
4. Run migrations safely in the release process.
5. CI pipeline: lint, type check, tests, build, deploy.
6. HTTPS, domains (main app and admin subdomain), CORS and cookie settings for production.
7. Monitoring, uptime checks, log aggregation.
8. Rollback plan and a launch checklist.

---

## Suggested order summary

0 Paper design, 1 Foundation, 2 Auth, 3 Profiles, 4 Files, 5 Startups, 6 Connections, 7 Jobs, 8 Mentors, 9 Investors, 10 Community, 11 Messaging, 12 Notifications, 13 Search, 14 Admin, 15 Frontend connection, 16 Hardening, 17 Deployment.

Flexibility: steps 7 to 13 can be reordered based on what your frontend needs most. Steps 0 to 6 should stay in this order because everything else depends on them.

After steps 5, 7 and 10, pause and test with real frontend screens before continuing.
