# Steps 7b / 7c — backend and approved frontend wiring

## Original backend phase: scope and environment gate

7b reads existing job/organization/startup data. 7c adds self-service submitted
applications and applicant-visible stage history. No frontend changes, demo-store
removal, seeds, employer pipeline endpoints, or unrelated sub-step implementation.
The approved plan is two backend batches (8 discovery reads, 6 application routes).

**Docker Compose remains a required, unsatisfied verification gate in this sandbox.**
There is no Docker executable/daemon here. Native PostgreSQL verification is
supplemental, not a Compose run, and approval of the implementation plan was not
interpreted as a waiver. The 7b/7c A checkboxes remain unchecked with implementation
status recorded. Python available here is 3.11, as in the existing checkout tooling;
Python 3.12+ is not available.

## Endpoints and access

All paths are relative to `/api/v1`.

| Method | Path | Audience |
|---|---|---|
| GET | `/public/jobs` | Anonymous/public |
| GET | `/public/jobs/{job_id}` | Anonymous/public |
| GET | `/public/companies/{org_id}` | Anonymous/public hiring page |
| GET | `/public/hiring-startups` | Anonymous/public startup directory |
| GET | `/jobs` | Authenticated, audience-filtered |
| GET | `/jobs/{job_id}` | Authenticated, audience-filtered |
| GET | `/companies/{org_id}` | Authenticated, audience-filtered hiring page |
| GET | `/hiring-startups` | Authenticated, audience-filtered startup directory |
| GET | `/jobs/{job_id}/application-context` | Verified, active job seeker; self-only prefill |
| POST | `/jobs/{job_id}/applications` | Verified, active job seeker applying as self |
| GET | `/applications` | Verified, active job seeker; own submitted applications |
| GET | `/applications/{application_id}` | Owning applicant only |
| GET | `/applications/{application_id}/stage-events` | Owning applicant; safe history only |
| POST | `/applications/{application_id}/withdraw` | Owning applicant; guarded transition |

Public/authenticated discovery wrappers call one service, not parallel search
implementations. `get_current_user`, active role rows, organization membership
helpers, shared rate limiting, existing errors, body-size guard, activity writer
and established real-auth test fixtures are reused.

### Discovery policy

- Lists contain only live open jobs from active, non-deleted organizations of
  type employer/startup. Verification does **not** gate discovery until 15d,
  following BUILD_PLAN's explicit exception. Badge values come from persisted
  server-controlled organization verification, never a frontend/demo assumption.
- Anonymous and non-jobseeker roles see public jobs. Authenticated job seekers
  additionally see `platform_members`; `link_only` is absent from every list but
  available by direct job ID to signed-in job seekers. IDs are not bearer secrets.
- Direct paused/closed reads are allowed within the same audience with
  `can_apply=false`; draft, archived, foreign-audience and inactive-org reads are
  indistinguishable 404s. No automatic job closing is introduced.
- Management responses are never returned directly. Owner/creator identifiers,
  internal confirmation/configuration and audit fields do not enter discovery.
- Hidden salary values are null, marked `salary_visible=false`, and excluded
  from salary-filtered/salary-sorted queries, preventing a range-filter oracle.
  Currency/period must match; there is no silent FX or annualization conversion.
- Publishing a job exposes basic hiring-company identity, not private startup
  pitch sections. Startup profile audience and section visibility reuse the 5h/5a
  gates. Private profiles do not enter the hiring-startup directory. Section-gated
  pitch text is not searchable through this directory, preventing match/no-match
  leaks. Company pages require a visible open job and return a visible-job count;
  retrieve their jobs with the paginated `jobs?org_id=...` endpoint.
- Browsing/search does not create application records or share candidate identity
  with hiring organizations. Company counts do not include link-only/hidden jobs.

### Search and pagination

`jobs` accepts bounded `q`, `location`, `org_id`, `org_type`, `work_mode`,
`employment_type`, `department`, `stage`, `sector`, `experience_min/max`, repeated
`skill_ids` (up to 30, match all/any), `salary_min/max`, `currency` (INR default),
`salary_period`, `equity_only`, `posted_days`, `sort`, `limit`, and `offset`.
Unknown filters and invalid ranges are rejected, not silently ignored. Jobs can
be searched by title/content, company name and skill name. PostgreSQL uses full
text (`simple` configuration), with a partial GIN index on live open job text;
SQLite uses escaped substring predicates as the portable test fallback.
Whitelisted sorts: relevance (lexical, **not AI/personalized fit**), newest,
visible salary, and deadline; all have a stable UUID tie-breaker. Null dates/salary
sort last. A keyword-free relevance query has stable ID ordering, not an invented
fit score.

`hiring-startups` deliberately has its own narrower query schema: `q`, `location`
(city), `stage`, `sector`, `limit`, `offset`. Results are ordered by name/UUID and
only contain discoverable startups with audience-visible open jobs. It does not
accept unsupported job-specific filters.

All collection responses include `items`, `total`, `limit`, `offset`, `has_more`.
Limit is 1–100, default 20. Counts are computed before paging. Child job
skills/benefits, startup profiles and company counts use batched queries, not one
query per result.

## Application contract

A submission accepts only:

- Optional `contact`: bounded name/email/phone and HTTPS LinkedIn/portfolio/GitHub
  links, without embedded credentials. If omitted, own account contact is used.
  Overrides belong to this application; account/profile are never modified.
- Optional `resume_file_id`, `cover_note` (1,000 characters maximum),
  `salary_expectation` (nonnegative Decimal, up to NUMERIC(14,2)), ISO `currency`.
- At most 8 typed screening answers, each `key`/`value` only.
- Explicit strict booleans `accuracy_confirmed=true`, `consent_share=true`.

Applicant/job/org identity, source, stage, snapshots, fingerprints, scores,
ratings, assignees and all timestamps cannot be supplied. Extra fields are 422.
The hiring organization is derived solely from the referenced authorized job.
An active member of that organization cannot apply to its job, even with another
platform role. Searchability/profile-public preferences are not an application
prerequisite: deliberate submission is a separate explicit sharing action.

`application-context` returns own contact prefill, public-safe catalogue questions,
existing own application ID and a reason when ineligible. It shares nothing with
an employer and creates no application/draft record.

### Screening and deadline settings

Existing owner/admin job create/update APIs now accept:

- `application_deadline`: nullable timezone-aware timestamp; null means rolling.
  Submission checks it in UTC at the time of the transaction. A past deadline is
  allowed as configuration but prevents submissions; no worker changes job status.
- `screening_questions`: bounded replace-set of catalogue `key` and strict
  `required` flag. Omission preserves configuration, `[]` clears it, null/duplicate
  keys and arbitrary prompts are rejected. Existing roles still govern writes.

The approved initial catalogue has four keys: `notice_period` (choice: immediate,
30/60/90 days), `remote_comfort` (boolean), `relevant_experience` (text, 1–1,000
characters), and neutral `work_authorization` (boolean). No nationality/protected
characteristic is requested or used for ranking. `false` is a valid boolean
answer; numbers and strings are not coerced into booleans. Unknown questions,
duplicate answers, missing required answers and wrong answer types are 422.

Questions/prompts/options and submitted answers are snapshotted. Changing later
job settings cannot rewrite earlier submissions. Unrestricted custom prompts,
file screening answers and a moderation system are deliberately deferred; a
keyword blacklist is not represented as an adequate anti-discrimination policy.

### Files and snapshots

Resume attachment is optional because profile-first applications are supported.
Step 4 already exists: a supplied file must be the applicant's own personal
resume, ready/clean, not deleted/purged. Missing, foreign, organization-owned,
wrong-kind and non-ready file references share a field-located 422 error. The
existing file authorization check is reused; a row lock rechecks lifecycle state
against concurrent deletion. No storage URLs/keys or new employer download grants
are exposed. Builder-resume IDs wait for 7n. Original file ownership/deletion rules
remain unchanged; a historical application does not promise a permanent copy of
the resume bytes.

Snapshots contain only selected submission contact/profile fields (headline,
summary, experience, current location, skills), submitted questions/answers and
minimal job/company identity. No password/auth/account settings, hidden salary
expectation, unrelated organizations, or practice scores are copied. Snapshots
are immutable through this API. Applications/history remain readable by their
applicant after a job closes or is archived. Other applicants get 404; an employer
without job-seeker role gets 403, not a candidate-data bypass.

### Idempotency and lifecycle

- A job-row lock serializes submissions against close/archive/configuration edits.
  A partial unique `(job_id, applicant_id)` live index is the backstop; a conflict
  race is translated rather than returned as an internal server error.
- Identical canonical payload retries return 200 and the existing application;
  first submission is 201. Salary decimal representation and answer ordering are
  normalized for fingerprinting. Materially different duplicates return 409
  `APPLICATION_EXISTS`. The internal SHA-256 payload fingerprint is never returned.
- A committed identical retry still works after archive/configuration changes;
  it does not re-share data or create an event. It is not a fresh application.
- Withdraw changes the row and appends history atomically. Repeated withdrawal
  is a no-op. Hired/rejected are terminal and return 409 `INVALID_STATE`.
  Withdrawn rows remain inside the uniqueness boundary; no reapplication setting
  was introduced. Repeating the original submission returns the withdrawn record,
  never resubmits it.
- Source is server-controlled `platform`. No arbitrary stage-changing API exists.
  Applicant history excludes actor IDs and internal event notes. Employer-private
  rejection discussions/ratings are not exposed.

## Limits, auditing and caching

Configuration (existing shared limiter):

- `JOB_DISCOVERY_LIMIT=60` per 300 seconds, per user for signed routes, per client
  IP for public routes. Application code does not trust arbitrary forwarded-IP
  headers; production proxy trust configuration remains a deployment concern.
- `APPLICATION_SUBMIT_LIMIT=20` per day per applicant. Valid new submissions
  consume the allowance; identical committed retries do not. Tier-specific plan
  quotas are deferred to Step 14.
- `APPLICATION_WITHDRAW_LIMIT=30` per hour per applicant; repeated no-ops do not
  consume a second allowance.
- Application metadata body cap: 64 KiB using the existing streaming route guard.
  Application/discovery responses use `Cache-Control: no-store`.

Audit events use the existing transactional writer. They contain action/entity
identifiers, not contact details, answers or resume contents, and are not attached
to hiring-organization activity feeds before a candidate-reader privacy contract
exists. Stage events are inserted in the same transaction as stage changes.

## Migrations and differences from database/schema.sql

- `0037_step7b_job_search`: partial PostgreSQL GIN full-text index on existing jobs;
  no new table. PostgreSQL-specific index is intentionally absent on SQLite.
- `0038_step7c_applications`: `job_applications`, `application_stage_events`, plus
  nullable job deadline and JSON screening settings. No sample data in migrations.
- Kept reference table names, UUID application PK, bigint event identity, deliberate
  FK delete policies, partial uniqueness and applicant/job-stage indexes.
- Added explicit contact/profile/job/answer snapshots, consent/accuracy timestamps
  and an internal retry fingerprint because the reference cannot preserve what
  was submitted or distinguish safe retry from a different duplicate request.
- Added DB CHECKs for fixed stage/source vocabulary, consent, currency, nonnegative
  money and withdrawn timestamp; timestamp defaults/update trigger follow existing
  conventions. Event history has no `updated_at` because it is append-only, like
  the existing audit table. JSON is portable rather than PostgreSQL-only JSONB.
- Deferred unused reference fields `match_score`, `match_reason`, `is_blind`,
  `practice_verified`, `assignee_id`, `rating`, `rejected_reason`, `rejected_at`
  until their owning ranking/pipeline/practice steps. None is writable here;
  adding speculative unused columns now would not implement those features.
- No new org_id on applications: organization is obtained through the job FK,
  preventing inconsistent job/org references. Snapshot org ID is server-derived.

## Deliberately deferred

Frontend wiring and new demo seeds; saved jobs/follows/alerts; AI/personalized
matching; similar-job recommendations; employer applicant pipelines, notes,
scorecards and blind-review reads (7d/7e); interviews/offers/hires; application
server drafts/autosave; candidate-private notes; reapplication policy controls;
unrestricted screening and file screening answers; practice-score sharing;
notifications/emails, interview-cancellation side effects and retention automation;
plan/billing quotas; reporting/moderation/support-admin bypass. No fake metrics,
contacts, scores, notifications or states substitute for these missing contracts.

## Run and verify

From backend/ with dependencies installed and a disposable PostgreSQL database:

```sh
# Required verification environment (not available in this sandbox):
docker compose up -d postgres redis mailpit
docker compose exec -T postgres createdb -U forma forma_jobs_test
docker compose exec -T postgres createdb -U forma forma_jobs_migrations

DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_migrations alembic upgrade head
DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_migrations alembic downgrade -1
DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_migrations alembic upgrade head
# Also verifies the 7b index downgrade/upgrade:
DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_migrations alembic downgrade 0036_step7a_fair_hiring
DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_migrations alembic upgrade head

pytest -q
FORMA_TEST_DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_test pytest -q
ruff check .
mypy app
# Focused 7b/7c:
pytest -q app/tests/test_job_discovery.py app/tests/test_job_applications.py
```

Test fixtures drop/create all model tables; never point tests at live data.
Migrations are tested on a **separate** disposable database. For manual API
inspection, migrate the development database then start
`uvicorn app.main:app --host 0.0.0.0 --port 8000`; see `/docs` and `/openapi.json`.
Use existing registration/verification/login to get a job-seeker token. Submit
JSON `{"accuracy_confirmed":true,"consent_share":true}` for a profile-only
application to a visible eligible open job without required screening questions.
No frontend client/schema generation is performed in this backend-only phase.

## Verification recorded in this session

- Full SQLite suite: **1,349 passed, 7 PostgreSQL-only skips**.
- Full native PostgreSQL suite: **1,356 passed, no skips**, including submission /
  withdrawal races and concurrent close/submit. This took about 47 minutes; the
  command exceeded the initial tool wait, so its existing process was monitored
  to completion, not restarted or counted twice.
- Initial focused discovery/application PostgreSQL run before the final 10 edge
  cases: **126 passed**; the full run above includes all final tests.
- Fresh PostgreSQL migration history through 0038, `downgrade -1`, `upgrade head`,
  downgrade to 0036 (also removing the 7b index), then upgrade head: all passed.
- Migrated-database service smoke passed real create/publish/full-text query,
  submit, identical retry, withdrawal and two-event history. GIN index existence
  and planner usability were checked with unrelated disposable scratch rows, not
  production data; the optimizer correctly preferred a cheaper btree plan on a
  tiny table before the representative scratch rows were supplied.
- Repository-wide `ruff check backend`, `mypy app` (**237 files**) and
  `git diff --check` pass. New/changed step files are formatted; unrelated legacy
  formatting was not changed.
- OpenAPI routes/strict request schemas were inspected without generating or
  editing frontend artifacts. No frontend file changed during this task; existing
  Step 7a frontend changes were preserved.
- Tests include public/member/link-only visibility, hidden salary filter/sort
  protection, private startup sections, unknown/malformed filters, stable paging,
  role/ownership/organization checks, consent and snapshots, profile-only and file
  submissions, personal/org/foreign/pending/infected/deleted file references,
  server-controlled mass-assignment, screening/close/deadline gates, canonical
  retries, withdrawal terminality, rate/body limits, revoked/unverified/suspended
  applicants, startup hiring and owner/admin/member/viewer configuration writes.
- Docker Compose and Python 3.12+ were unavailable. Native PostgreSQL is not a
  substitute for the requested Compose gate. Live R2 was not exercised by this
  task; file reference authorization/scanner-state checks use existing metadata.


## Approved frontend phase (7b/7c B)

The later frontend task explicitly approved the inventory, the narrow public-route
exception, the following supporting API gaps, and development-only sample handling.
The earlier "backend-only" verification above is historical, not the final scope.

### Supporting contracts (no new tables or migrations)

- `JobSearch.work_modes`, `employment_types`, `stages`: bounded repeated query
  parameters, OR within each collection and AND with other filters. Existing
  singular filters remain compatible and additionally intersect when supplied.
- `verified_only`: filters on persisted organization verification only.
- Discovery jobs return `own_application_id` / `own_application_stage` only for
  the authenticated applicant. Public/other-role reads return null; queries are
  batched. Existing/withdrawn applications, unverified accounts, own-organization
  membership, deadlines and job status disable Apply; submission still rechecks.
- `GET /applications?q=...`: bounded, escaped search of the caller's immutable
  job/company snapshots. `stage_counts` is computed on all caller-owned,
  keyword-matching rows **before** the stage filter/pagination. Board columns are
  explicitly current-page rows, not invented full-dataset counts.
- Profile/job/answer snapshots now have explicit OpenAPI response schemas.
  Application context also returns the caller's current profile for final review;
  the server snapshots it again on submission, with submitted contact overrides.
- Hiring-startup keyword search includes the public company city, not private pitch
  sections. Startup lifecycle labels are not inferred from funding rounds.

### Frontend implementation and boundaries

Only these seven pages are wired: jobs, job detail, hiring company, hiring startups,
Apply, own applications, and own application detail. The original cards, two-column
layouts, company tabs, board/table views and four-step application wizard remain.
`components/career-data.tsx` supplies cancellable identity-bound resource state,
300 ms keyword debounce, shared pagination, formatting and real application actions.
All HTTP calls use generated contracts through the existing `lib/api/client.ts` and
existing auth context/automatic refresh; no second client or page-level fetch.

The four discovery routes permit public browsing via a limited shell. Apply and
Applications remain RoleGuard-protected; the API remains the authorization boundary.
The shared shell/header/sidebar/UI use **opt-in `liveData`**, leaving later-step
page behavior intact. Wired routes show actual identity, restrict role choices to
held roles, and omit fake readiness/notification/sidebar counts. Global search is
explicitly disabled there; the actual page search is wired.

Apply uses own personal ready/clean files, real context/contact and catalogue
questions (including false boolean answers), decimal strings, explicit independent
accuracy/sharing checkboxes and nested field errors. Continue never triggers Submit.
It shows a real committed application link on success or an existing application;
there are no fake drafts, autosaves, success timers or local stage changes. Withdrawal
uses the persisted result and refreshes applicant-safe history. Submitted resume
metadata/downloads use existing file authorization.

The existing signed-upload helper is reused for personal and organization scope.
Only the signed byte PUT bypasses bearer auth, with omitted credentials and no byte
retry. Signed **development local-storage** loopback URLs are converted to existing
same-origin `/api/v1/files/local-*` proxy paths for preview browsers; production R2
URLs are untouched. No access/refresh token is stored in localStorage/sessionStorage
or cookies. Reload/new-tab sign-in behavior is intentionally unchanged.

Unavailable on these pages: AI fits/readiness/ATS scoring, saves, follows, alerts,
report submission, investment readiness, company-wide culture/benefits and hiring
promises, hiring contacts/messages, interviews, private notes, builder resumes and
tailoring. Real job benefits, verification, counts and actual stage history remain.

### Demo removal and development samples

`jobseeker-data.js` remains because dashboard/saved/alerts/resume/interview/offer/
practice/message pages still import its exports. The now-unused `companies` export
was removed; jobs/applications/resumes/interviews and `defaultUser` remain only for
those other consumers. None of the seven wired pages imports that store/defaultUser.

`seed_step7bc_careers` in **the existing** `scripts/seed_dev.py` has its own literal
`ENVIRONMENT == "development"` gate, deterministic IDs and fill-only semantics.
It moves the four job records and company content plus four application examples,
adds missing OrbitPay/Lattice Works parents, preserves sample stage history, and
adds jobs to at most two already-public startup samples without changing visibility.
It does not infer lifecycle stage from Seed/Series A/B or invent resumes, interviews,
notes, ATS scores, private hiring feedback or recruiters. Existing edits/deletions
are never resurrected. The helper was run twice on the development DB successfully;
separate tests verify non-development refusal and edit-preserving idempotency.

### Frontend-phase verification

- Frontend production build, standalone TypeScript, targeted Next lint, and stronger
  no-undefined/no-unused-variable lint on the seven pages pass.
- Full frontend lint was run honestly: **65 errors / 10 warnings**, all in untouched
  pages; no suppression or unrelated cleanup was added for this task.
- Shared-client tests: **6 careers + 5 existing jobs tests pass**, including public
  no-auth requests, repeated filters, exact money/booleans, automatic refresh,
  nested error envelopes, private byte-upload credentials and signed local URLs.
- Focused SQLite jobs/discovery/applications/wiring/contracts: **215 passed / 3
  PostgreSQL-only skips**. Native PostgreSQL suite collected before the last profile
  preview case: **217 passed**, followed by **9 final contract tests passed** covering
  that case and the other contract extensions. These are focused frontend-supporting
  runs, not a claim that the entire backend suite was rerun in this phase.
- Repository Ruff, mypy (**238 files**) and `git diff --check` pass.
- Browser checks used actual Next/API/native PostgreSQL: all seven pages, guest and
  authenticated discovery, employer owner/admin/member/viewer read-only browsing,
  job seeker and multi-role user, own-organization denial, another applicant's 404,
  invalid IDs, real empty lists, configured screening/decimal/consent submission,
  immutable materials, persisted withdrawal/history, own applied/withdrawn badge,
  board/table and server search, and loading/error/retry on every page.
- Actual 20+1 application pagination and 20+11 job pagination were checked using
  deterministic temporary database fixtures, then **only those fixtures removed**.
  Their counts were not simulated in the frontend.
- Actual personal PDF upload, processing/clean-file selection, application attachment
  and original-byte signed download passed via the existing **development local
  storage** and same-origin proxy. Invalid file validation also passed. Production
  Cloudflare R2 credentials/CORS were not exercised here.
- Mobile final review was visually inspected with no horizontal overflow; Continue
  leaves the application unsubmitted. Browser storage contained no access/refresh
  tokens. Injected transport failures were used only to test UI loading/error/retry;
  page data and successful mutations came from the real backend.

Re-run frontend checks from `frontend/`:

```sh
npm run gen:api  # API_URL can select a running backend
npm run typecheck
npm run test:careers
npm run test:jobs
npm run lint    # known failures in untouched pages remain visible
npm run build
```

Re-run focused backend checks from `backend/`:

```sh
../.venv/bin/pytest -q app/tests/test_jobs.py app/tests/test_job_discovery.py app/tests/test_job_applications.py app/tests/test_job_wiring.py app/tests/test_career_wiring.py
# For native PG, set FORMA_TEST_DATABASE_URL to a disposable test database first.
```

Only 7b/7c B progress entries change for this frontend phase. The A Docker Compose
and Python-runtime gates above are unchanged. No commit or push was made.
