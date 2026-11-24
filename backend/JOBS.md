# Step 7a: organization jobs and employer frontend

## Scope and permissions

Jobs belong to an active organization of type `employer` or `startup`. The
existing active-membership helper is the authorization boundary, not the user's
primary platform role. Owner/admin may mutate; owner/admin/member/viewer may
read. Outsiders and deactivated members get 403. A foreign, missing or archived
job ID under an authorized organization gets 404. Unsupported, suspended or
deleted organizations get 404. There is no platform-admin bypass.

Delegated recruiter/hiring permissions do not exist yet: ordinary members are
read-only, not implicitly recruiters. Owner/admin can assign `owner_id` to an
active, non-viewer member of the same organization. Create defaults ownership to
the creator; PATCH can explicitly clear it. Global skill IDs come from the
existing skills catalogue (they are not organization-specific).

All routes are under `/api/v1/organizations/{org_id}/jobs`:

| Method | Suffix | Action |
|---|---|---|
| POST | (none) | Create draft, 201 |
| GET | (none) | Paginated management list |
| GET | `/summary` | Total live posts and counts by status |
| GET | `/{job_id}` | Internal job detail, including skills/benefits |
| PATCH | `/{job_id}` | Edit content/owner and replace supplied collections |
| POST | `/{job_id}/publish` | Publish draft or resume paused post |
| POST | `/{job_id}/pause` | Pause open post |
| POST | `/{job_id}/close` | Close open/paused post |
| POST | `/{job_id}/archive` | Soft-delete draft/closed post |

The list supports status, department, owner, location, work mode, employment
type and title (`q`) filters. Sorting: `created_at`, `updated_at`, `posted_at`
(newest first), or `title` (ascending), with UUID tie-breaking. It returns
`items`, `total`, `limit`, `offset`, `has_more`. Limit is 1–100, default 20.
Summary counts job posts, not the sum of their `openings`.

Status flow: `draft -> open -> paused -> open`; `open/paused -> closed`.
Closed is terminal. Archive sets `deleted_at`, retaining the record and children;
subsequent management reads/actions return 404. Repeated publish/pause/close
when already in the target state is a no-op (no duplicate audit event or reset
timestamp). First publication sets `posted_at`; closing sets `closed_at`.

Publishing requires title, description and requirements; onsite/hybrid jobs
also require location. Publication additionally requires `fair_hiring_confirmed=true`;
published/paused edits must retain all these requirements.
Organization verification is deliberately **not** a publishing gate yet, per
BUILD_PLAN's explicit 7a exception until 15d; active organization status is.
There is no invented verified badge.

## Security and input contract

- Separate Create/Update/Read schemas; unknown fields rejected with the existing
  `VALIDATION_ERROR` envelope. No raw request-to-ORM mass assignment.
- IDs, organization, creator, status, posting/closing/creation/update/deletion
  timestamps, featured placement and derived counts are server-controlled.
  Status actions accept an empty body or `{}`, rejecting extra fields.
- `owner_id` is an intentionally editable, same-organization reference, not
  evidence of permission. Ownership does not elevate the assigned person's role.
- Skill and benefit collections are replaced atomically when supplied; omission
  leaves them unchanged, `[]` clears them, and `null` is rejected. Skill inputs
  accept only `skill_id`/`is_required`; benefits are strings with server-generated
  IDs and ordering. Duplicate/unknown skills are rejected.
- Nullable scalar fields can be cleared. A merged-state validation prevents a
  one-sided PATCH from inverting a stored salary/equity/experience range.
- Salaries are Decimal/NUMERIC(14,2), nonnegative; the API accepts decimal strings
  or integers, not floating-point inputs. Equity is 0–100%, NUMERIC(5,2). Currency
  uses the repository's uppercased three-ASCII-letter code format, default INR.
- Title/location: 200 characters. Each of four text sections: 10,000 characters.
  At most 30 skills and 30 benefits, each benefit at most 100 characters. Title
  search: 100 characters. Years/openings fit their SMALLINT columns.
- Bounded streaming body guard reuses `FileRoute` with a 256 KiB job-specific
  limit (413); existing file endpoints retain their 8 KiB limit. Responses use
  `Cache-Control: no-store`.
- All mutations share the existing Redis-backed limiter, configurable with
  `JOB_WRITE_LIMIT=60`, `JOB_WRITE_WINDOW_SECONDS=60`, per user across organizations.
  Existing non-Redis fallback behavior is unchanged.
- Job row locks serialize lifecycle decisions, merged edits and child replacements
  on PostgreSQL. SQLite does not prove this concurrency guarantee.
- Successful mutations stage an existing `activity_events` entry in the same
  transaction. Description text and compensation are not copied into audit data.
- The existing team-summary endpoint now counts this organization's live open jobs.

Visibility (`public`, `platform_members`, `link_only`) and salary-public settings
are persisted now, but **no outsider/public job read is exposed in 7a**. Step 7b
must enforce discovery/detail visibility and salary redaction. Link-only means
unlisted, not a bearer-secret authorization mechanism.

## Approved differences from database/schema.sql

The reference was neither executed nor copied wholesale. Revision
`0035_step7a_jobs` follows `0034_step9h_data_room_access` and creates only `jobs`,
`job_skills`, `job_benefits`.

- Added `visibility`, `salary_period`, `show_salary_publicly` for existing UI/design
  controls. Added `responsibilities`, `requirements`, `what_we_offer` to preserve
  editor sections; `description` remains “About the role.”
- Deferred `request_id` and its FK to 7i, when `hiring_requests` will exist.
- Added `updated_at` to skill links and benefits. Kept the composite skill-link
  PK, following existing association-table conventions rather than adding a
  redundant UUID.
- Native enums become VARCHAR plus named checks; currency is VARCHAR(3), following
  existing migrations. Title/location and benefit labels have bounded lengths.
- Added defensive salary/equity/experience, title, benefit and enum checks.
- Preserved the reference's organization/status, open-feed and mode indexes.
  Added owner/creator FK indexes, reverse skill FK index and a live
  `(org_id, created_at, id)` index for stable organization pagination.
- PostgreSQL updated-at triggers use the existing `set_updated_at()` function.
  Downgrade removes only this revision's three tables.
- Added six string activity-event vocabulary entries; the existing audit table
  needs no migration.

No public search (7b), applications/candidate counts (7c/7d), screening questions,
blind review, practice-score consent, approval system, hiring requests, billing,
featured purchases, automatic closing, deadlines, notifications, AI, restore,
job duplication is included. Frontend wiring and development seeds are described
in the phase B section below.

Small existing-file quality fixes: reusable body-limit class attributes preserve
file behavior; pre-existing file-router import/exception-chaining lint issues and
two investor-offer `timezone.utc` aliases were mechanically corrected for a clean
repository-wide Ruff run. No investor workflow was changed.

## Run and verify with Docker Compose

From `backend/`, with the project's Python environment installed:

```sh
python -m pip install -r requirements.txt
docker compose up -d postgres redis mailpit
# Create these disposable databases once; never point the test suite at live data.
docker compose exec -T postgres createdb -U forma forma_jobs_test
docker compose exec -T postgres createdb -U forma forma_jobs_migrations

DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_migrations alembic upgrade head
DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_migrations alembic downgrade -1
DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_migrations alembic upgrade head

pytest -q
FORMA_TEST_DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_jobs_test pytest -q
ruff check .
mypy app
```

The existing test fixtures drop/recreate all model tables per test; the migration
verification database must be separate from the test database. To run only this
slice, append `app/tests/test_jobs.py` to pytest. To start the backend against a
development DB, set `DATABASE_URL`, run `alembic upgrade head`, then
`uvicorn app.main:app --host 0.0.0.0 --port 8000`; see `/docs` for request/response
schemas and errors. Frontend generation and startup are described below.

## Verification recorded in this session

- Full SQLite suite: **1,208 passed, 5 PostgreSQL-only skips**.
- Full PostgreSQL 16.2 suite, split into two isolated disposable databases:
  **550 + 663 = 1,213 passed**, no skips.
- Step 7a focused suite: **65 passed, 1 PostgreSQL-only skip** on SQLite;
  **66 passed** on PostgreSQL, including concurrent publication and child edits.
- PostgreSQL migrations: fresh `upgrade head`, `downgrade -1`, `upgrade head`
  all passed. Additional migrated-database smoke check verifies the new schema,
  constraints, timestamps, and create/publish/edit/close/archive service flow.
- `ruff check backend` and `mypy app` passed. Runtime: Python 3.11.2, matching
  the checkout's existing tooling configuration; Python 3.12+ was not available.
- **Remaining verification gate:** this sandbox has no Docker/Compose executable
  or daemon. PostgreSQL was run locally with temporary, environment-only
  `pgserver==0.1.4` tooling, not through Compose. That package is not an application
  dependency and no database artifacts belong in Git. These local results do
  not claim to satisfy the specifically requested Docker Compose run. The 7a A
  checkbox remains unchecked pending that run (or an explicit waiver).

## Phase B: employer job pages

Only `/employer/hiring`, `/employer/jobs/new`, `/employer/jobs/[jobId]/edit`, and
**job details** within `/employer/jobs/[jobId]` are wired. Shared workspace/form
components use the existing API client, auth context, RoleGuard and generated
OpenAPI types. Real-data header/sidebar/shell mode is opt-in for these routes.

- Active employer organizations come from `/organizations/mine`. Multiple
  memberships require explicit selection; job links preserve `org_id` and never
  mix organization data. Startup hiring (7r–7t) remains untouched.
- Owner/admin can write; member/viewer are read-only, including direct form URLs.
  The server independently enforces the organization membership boundary.
- Lists use server filtering/pagination. Loading/error/retry/empty states are
  explicit. Forms show field errors, send minimal PATCHes, and retain a saved
  draft after failed publication so retry never creates a duplicate. Salary
  input uses integer arithmetic to produce exact decimal strings.
- Requests, candidates/pipeline, comparison, sourcing, interviews and offers are
  unavailable or disabled, not fake metrics. Their later-step pages and shared
  `employer-data.js` remain because there are still importers.

### Approved supporting gaps

Migration `0036_step7a_fair_hiring` adds a non-null boolean confirmation, default
false (including old records), to create/update/read. Publishing requires true;
this is **not** a versioned legal-consent system. Existing merged-range,
owner-reference, unknown-skill and publish-completeness errors carry field
locations in the same envelope/status codes. OpenAPI was regenerated from the
running backend rather than filling missing fields with frontend demo data.

The existing shared auth client now keeps access/rotating refresh tokens **only
in module memory**. Legacy token keys are removed from both localStorage and
sessionStorage. Single-flight refresh works within the current tab. **Hard reload
and new tabs require sign-in.** This approved trade-off applies to every shared
client caller; no cookie-auth expansion or second client was added.

### Run and seed

With a migrated development database/backend environment configured:

```sh
# backend/
ENVIRONMENT=development python scripts/seed_dev.py
uvicorn app.main:app --host 0.0.0.0 --port 8000
# separate terminal, frontend/
npm ci
npm run gen:api
npm run typecheck
npm run test:jobs
npm run build
npm run start -- --port 3000
```

The existing dev seed adds four deterministic organization-scoped job IDs,
never overwriting edited/archived rows. Both the script entry point and job
helper require **literal** `ENVIRONMENT=development`; no seeds run in migrations.
Roles: `employer@forma.dev` owner, `hiring-admin@forma.dev`,
`hiring-member@forma.dev`, `hiring-viewer@forma.dev`, using the script's existing
development credential. Samples: Product Designer=open, Software Engineer=open
(old “Closing soon”), UX Researcher=open, Engineering Manager=draft (old “Pending
approval”). Sample confirmations are explicitly true, not inferred for existing
non-seed records. No sample candidates, benefits or skills are invented.

Open `/login?next=%2Femployer%2Fhiring` for direct access; seeded accounts otherwise
follow existing onboarding landing behavior. Browser API calls remain same-origin
`/api/v1`, proxied by Next, never a browser localhost backend URL.

### Phase B verification (2026-11-23)

- OpenAPI generation, standalone typecheck, 5 dependency-free client tests and
  production build pass. Existing Next config skips integrated lint/types, so
  standalone checks were explicitly run.
- All touched frontend JS/JSX/TS and new tests pass targeted ESLint. Full lint
  **fails: 67 errors / 10 warnings in untouched later-step pages**, primarily
  unescaped entities and existing hook/image warnings. Nothing was suppressed or
  fixed outside this scope.
- Jobs/wiring/seed/team regressions: SQLite **91 passed / 1 PostgreSQL-only skip**;
  local PostgreSQL **92 passed / no skips**. Earlier full-suite results above
  predate phase B. Ruff, mypy (227 files) and diff whitespace checks pass.
- Fresh PostgreSQL upgrade through 0036 → downgrade to 0035 → upgrade head passes.
- Actual headless Chromium against production Next + PostgreSQL API tested all
  four pages for owner/admin/member/viewer, direct-link denials, real create/edit,
  exact salary/equity/visibility settings, publication errors and single-draft
  retry, pause/resume/close/archive, search/filter, pagination over 21 temporary
  jobs, explicit multi-org selection/isolation, unknown org/missing job, delayed
  loading and injected outage followed by real-backend retry on workspace, list,
  detail and edit. Startup-only account is RoleGuard-redirected. Desktop and 390px
  mobile screenshots inspected; no uncaught browser exceptions.
- Browser localStorage/sessionStorage contain no tokens. Injected 401 invokes
  the **real** backend refresh endpoint and retries; reload requires login.
  Client unit tests additionally cover legacy cleanup, single-flight refresh,
  jobs method paths, field mapping and exact decimal parsing.
- Browser tooling was temporary/outside project; no application dependency added.
  Existing Next 14.2.31 vulnerability/deprecation warnings were previously
  disclosed; upgrading dependencies is outside this task.
- **A's Docker Compose gate remains open**. Local PostgreSQL and frontend tests
  are not represented as satisfying it.
