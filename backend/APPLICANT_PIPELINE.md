# Step 7d — applicant pipeline (backend phase A)

This is the first batch of the approved 7d/7e split. **7e and all frontend wiring are not implemented in this batch.** Existing 7a/7b/7c work is preserved. No commit or push is part of this task.

## API

All routes are under `/api/v1`. Let `J` be `/organizations/{org_id}/jobs/{job_id}` and `A` be `J/applications/{application_id}`. UUIDs are application IDs, not candidate user IDs. OpenAPI documents response schemas and common errors for all nine operations.

| Method | Route | Contract |
|---|---|---|
| GET | `J/applications` | Bounded, scoped applicant page; stage/source/assignee/name filters; newest/oldest/stage-changed sorting |
| GET | `A` | Submitted materials with a server-side blind projection |
| PATCH | `A` | Explicit stage/rejection/assignee changes, atomic with history/audit |
| GET | `A/stage-events` | Paginated safe history, without internal notes or candidate actor IDs |
| GET | `A/notes` | Only the current author's live private notes |
| POST | `A/notes` | Create a private note (201); each POST creates a new note |
| DELETE | `A/notes/{note_id}` | Author-only soft deletion (204); repeated deletion is a no-op while writable |
| PATCH | `J/review-settings` | Owner/admin changes the blind setting before any application exists |
| POST | `A/resume-download` | Audited, short-lived original resume URL; empty strict body |

Pagination follows the existing `items`, `total`, `limit`, `offset`, `has_more` pattern (default 20, maximum 100). Applicant `stage_counts` respects authorization and all filters except the selected stage. Ordering uses an ID tie-breaker; creation timestamps may tie. Name search is literal, case-insensitive substring search with SQL wildcard escaping. Every nonblank identity search excludes **all** blind rows, including from counts, regardless of whether the hidden name matches.

`ApplicantRead` is a dedicated allowlist. It does not expose `applicant_id`, raw profile/job snapshots, resume IDs/storage keys, consent internals, fingerprints, or live candidate-profile data. `resume_available` is calculated from the attached file's current ownership/kind/readiness/cleanliness/deletion state, not just a non-null attachment ID. Missing data remains null.

### Stage/assignment inputs

```json
{"stage":"review","expected_stage":"applied"}
```

```json
{"stage":"rejected","expected_stage":"review","rejected_reason":"other","rejection_detail":"Role-specific internal reason"}
```

```json
{"assignee_id":"<eligible same-organization member UUID>"}
```

- Allowed human review stages: `applied`, `review`, `shortlisted`, `interview`; rejection is allowed from any nonterminal stage. `offered` may only be rejected here; offer workflows are not implemented.
- No creation of `offered`/`hired`, candidate withdrawal impersonation, or reopening terminal `rejected`/`withdrawn`/`hired` applications.
- A stage write requires `expected_stage`. Job then application row locks serialize changes; a stale stage returns `409 STALE_STAGE`. Retrying an old expected stage does not duplicate history. Writing the same current stage with the correct expected stage is a no-op.
- Submission/review/withdrawal history records use their post-lock mutation timestamp, matching `stage_changed_at`. PostgreSQL `now()` is the transaction start time, which could otherwise misorder a withdrawal transaction that began earlier but mutated later. A PostgreSQL regression covers both employer and applicant history projections.
- Rejection reasons: `skills_mismatch`, `experience`, `role_filled`, `compensation`, `timing`, `other`. `other` requires detail. The optional detail is stored with the reason in the reference `rejected_reason` text column, e.g. `other: Role-specific internal reason`.
- Rejection metadata stays employer-internal; it is not copied into applicant-visible history, audit metadata, or a candidate message. No email/notification/message is sent.
- Assignment can be cleared explicitly with null. Supplied users must be active, verified, non-viewer hiring members of the same organization with a non-revoked compatible global role.
- Stage, rejection, assignment, history and audit writes commit atomically. An invalid assignee cannot partially move a stage or reveal identity.
- Closed/archived jobs remain readable through pipeline routes but are not writable. Paused jobs remain reviewable. Terminal applications are read-only, including note changes.

## Permissions

Use the existing current-user, `require_role`, organization lookup/membership/reference, error, rate-limit and storage helpers. There is no new auth or organization system.

An active verified account and active membership of an active employer/startup organization are both required. Employer organizations require the `employer` global role; startup organizations accept `startup` or `employer`. Other roles and platform-admin status alone do not grant hiring access. Invite acceptance already grants an organization's compatible global role; tests explicitly revoke that role when exercising membership-without-role failures.

| Action | Owner/admin | Member | Viewer/nonmember |
|---|---|---|---|
| Applicant read/history | All organization job applicants | Job owner or application assignee | Denied |
| Applicant list/counts | All for the job | Only owned-job/assigned applications | Denied |
| Stage/rejection | Yes | Job owner only | Denied |
| Assignment/settings | Yes | No | Denied |
| Private notes | Own notes only | Own notes on accessible applicants | Denied |
| Resume download | Same applicant scope, not blind | Same applicant scope, not blind | Denied |

An unassigned ordinary member receives an empty scoped applicant list, not organization-wide counts. Wrong organization membership is 403; an existing job/application outside the authorized parent/scope is 404. Invalid assignee references produce the existing field-located 422 format. Revoked global roles, deactivated memberships and inactive organizations immediately fail fresh requests.

**Necessary shared-helper correction:** `require_role(*roles)` now limits its existence query to one result. A user holding both permitted startup and employer roles must not cause `scalar_one_or_none()` to raise. Existing single-role behavior and revocation checks remain unchanged.

## Blind review

- New `jobs.blind_review_enabled` defaults false. `PATCH J/review-settings` accepts only this strict boolean. Existing generic job writes cannot bypass it. Internal `JobRead` also reports the setting; public discovery projections are unchanged.
- The setting locks once any application exists, including soft-deleted applications. Same-value setting retries are safe, but cannot bypass a closed/archived job's read-only state.
- Submission already locks the job row; it now copies the setting into server-controlled application `is_blind`. A concurrent submission/settings change cannot produce a partially applied policy.
- Existing applications remain non-blind. There is no retroactive certification of anonymity.
- Identity remains hidden through applied/review/shortlisted. Entering interview permanently clears `is_blind`; moving backward does not make already-revealed identity secret again. Rejection or withdrawal before interview does not reveal it.
- Blind list/detail responses contain an application-based opaque label and limited structured fields. They suppress the entire profile/contact projection, links, headline/summary/location/skills text, cover note, free-text screening answers and resume access. Profile photos/schools are not in the existing submitted snapshot and no live profile is joined to fetch them.
- Only catalogue-validated boolean/choice screening answers survive blind projection; prompts/options are reconstructed from the server catalogue. Experience years, salary expectation and currency remain available as structured job-review information.
- Downloads are denied before file lookup/signing in blind mode. Suppressed file/profile identifiers cannot be used as a shortcut to personal resources. Generic personal-file permissions are unchanged.
- **This is not guaranteed anonymity.** Staff may already know a person or enter identifying text in their own notes/rejection detail. There is no automated PDF/text anonymizer, and no claim to remove identifying content from employer-authored text.

## Private notes, files, audits, limits

Notes are author-only, even against another owner/admin. Foreign-note deletion returns 404. Deleted authors leave inaccessible notes with nullable `author_id`, not notes shared with all staff. Team notes, editing, mentions and visibility toggles are deferred.

Resume access is an application-scoped grant only to that application's attached personal `resume`. The service rechecks candidate ownership, personal-key prefix, no organization ownership, ready/clean state, and absence of deletion/purge. It reuses `file_service.sign_ready_download`, the existing storage adapter/TTL and the existing per-user file-download quota. Generic file download first performs its unchanged ownership check; it now shares the same readiness/signing function. Provider-backed R2 was not exercised in this sandbox. Signed bearer URLs remain usable until their configured short expiry; later permission changes cannot revoke a URL already issued.

Activity records cover stage, assignment, note creation/deletion, settings changes and resume URL issuance. They use application/job entity IDs and generic summaries—no note text/note IDs, contact data, filenames, rejection detail or signed URLs in activity metadata. History deliberately reuses the applicant-safe schema.

Limits use the existing Redis limiter and its existing development in-memory fallback:

- `APPLICANT_READ_LIMIT=120` per authenticated actor per minute.
- `APPLICANT_WRITE_LIMIT=60` per actor per minute.
- Resume grants additionally consume `FILE_DOWNLOAD_LIMIT` per five minutes and use `FILE_DOWNLOAD_TTL_SECONDS`.
- 32 KiB streaming metadata guard, page size 1–100, nonnegative offsets, whitelisted enums/sorts, name query <=100 characters.
- Note bodies 1–5,000 nonblank characters; rejection detail <=1,000. Input schemas forbid extra fields, including ownership/timestamps/snapshots/blind flags/rating/file selectors. All text is plain text, not trusted HTML.

## Schema and migration

`0039_step7d_applicant_pipeline` follows `0038_step7c_applications`.

- New reference table `application_notes`: UUID/application/nullable author/body/created/deleted, plus **`updated_at`** per repository standards and a nonblank bounded-body check. The reference app/time index is extended with author and ID plus a live-row predicate to serve private paginated reads. Author FK is separately indexed.
- `jobs`: add **`blind_review_enabled`**, absent from the reference's job table, to persist the approved job-level setting.
- `job_applications`: add reference **`assignee_id`**, **`is_blind`**, **`rejected_reason`**, **`rejected_at`**, which the implemented 7c table did not yet have. Assignee FK is SET NULL and indexed. Add job/created/ID and job/assignee/created/ID indexes for scoped stable pagination.
- Rejection metadata must be absent as a pair or be a nonblank pair on a rejected record. Existing rejected rows, if any, retain unknown/null metadata; the migration does not invent reasons or times. New API rejections always populate both.
- No new manual `rating`, team-note visibility, scorecard tables, candidate history system, or hiring-role tables. Existing 7c snapshots/consent/money/constraints remain intact.
- Downgrade removes notes and 7d-only fields/indexes/constraints. It preserves pre-7d application/history data, but **does not preserve removed notes, assignments, rejection metadata or blind settings**. Back up before any real rollback; re-upgrade gives removed flags their documented defaults. Do not use a downgrade as a privacy-preserving production rollback.

## Verification and running

From `backend/`, after activating the repository's virtual environment:

```sh
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
ruff check app alembic
mypy app
pytest -q
```

The PostgreSQL fixture drops/recreates tables for every test. **Never point `FORMA_TEST_DATABASE_URL` at a development/live database.** Migration checks also need a separate disposable database, not the pytest database.

Required Compose verification, to run in an environment with Docker/Compose available (existing Compose services use port 5432; resolve local port conflicts first):

```sh
docker compose -p forma-7d-verification up -d postgres redis mailpit
docker compose -p forma-7d-verification exec -T postgres createdb -U forma forma_7d_test
docker compose -p forma-7d-verification exec -T postgres createdb -U forma forma_7d_migrations
FORMA_TEST_DATABASE_URL=postgresql+asyncpg://forma:forma@127.0.0.1:5432/forma_7d_test pytest -q
DATABASE_URL=postgresql+asyncpg://forma:forma@127.0.0.1:5432/forma_7d_migrations alembic upgrade head
DATABASE_URL=postgresql+asyncpg://forma:forma@127.0.0.1:5432/forma_7d_migrations alembic downgrade -1
DATABASE_URL=postgresql+asyncpg://forma:forma@127.0.0.1:5432/forma_7d_migrations alembic upgrade head
```

The Compose command assumes a fresh dedicated project/database; do not delete an existing volume to make reruns work. Wait for PostgreSQL readiness before creating databases. The credentials above are the existing Compose development defaults, not production credentials. This verifies PostgreSQL; separate production storage/Redis failover testing is still needed.

### Sandbox verification record

Docker/Compose and its socket are unavailable, so native PostgreSQL checks are **supplemental only** and the 7d A checkbox stays unchecked. No waiver was inferred from plan approval. Verification used the existing Python 3.11.2 environment and native PostgreSQL 16.2; Python 3.12 execution was not verified.

- Ruff over `app`/`alembic`, format checks for changed Python files, `mypy app` (243 files), and `git diff --check`: pass.
- Final current-code contracts (`test_applicant_pipeline.py`, `test_job_applications.py`, and the job-management OpenAPI test): **SQLite 162 passed / 6 PostgreSQL-only skips; native PostgreSQL 168 passed / no skips**, both commands exit zero.
- Earlier 421-case affected-domain regression (pipeline/jobs/discovery/application/wiring/auth/files): SQLite **414 passed / 6 skipped / 1 obsolete OpenAPI assertion failed**; native PostgreSQL **420 passed / the same assertion failed**. That assertion predated nested pipeline routes and counted 18 operations instead of the 9 management operations it intended to test. It now filters the existing `jobs` tag, preserving the exact management count. Its corrected isolated rerun passed on both databases and it is included in the final contract run. The subsequent timestamp-ordering change is covered by the final application contracts and a dedicated PostgreSQL transaction-time regression. These are not claims that the original 421-case commands exited zero.
- Initial dedicated 7d native PostgreSQL run: **80 passed**, including stage/settings/withdrawal row-lock races (before the final multirole and transaction-time regression additions).
- Fresh native PostgreSQL migration **upgrade head → downgrade -1 → upgrade head: pass**, with populated application/history preservation checks. API smoke against the actual migrated schema passed again after the final code changes: configure blind review, submit, inspect safe detail, create private note, reveal identity at interview, reject, paginate history, and verify indexes.
- Full-repository regression attempts were stopped in favor of the affected-domain runs above; no new full-repository pass is claimed.
- Logs in this sandbox: `/tmp/forma-7d-final-contracts-{sqlite,pg}.log`, `/tmp/forma-7d-focused-{sqlite,pg}.log`, `/tmp/forma-7d-pg-migrations.log`, `/tmp/forma-7d-final-migrated-smoke.log`.

A supplemental fresh SQLite migration attempt stops in pre-existing revision `0014_step5kl_analytics` (unsupported SQLite ALTER constraint); no historical migration was edited. PostgreSQL is the production/migration acceptance database; SQLite pytest uses the established metadata fixtures.

## Deferred / stopping point

- 7e backend/frontend and mixed-step templates remain deferred. The original backend-only stopping point was superseded by explicit approval for 7d frontend wiring, client regeneration and development seeding; see the 7d B record below.
- Fine-grained recruiter/hiring-manager/interviewer roles, round assignments, conflict-of-interest handling and compensation-specific grants.
- Team notes, note editing/sharing/mentions, exports and saved comparisons.
- Interviews, offers/hire transitions, messaging/rejection delivery, talent pools, AI/ATS/ranking, practice results and resume generation.
- Retention/legal policy and automatic deletion/anonymization workflows; subject to later product/legal decisions.

## Approved 7d B frontend wiring

### Scope and contracts

Only the Pipeline portion of `/employer/jobs/[jobId]` and the 7d portions of `/employer/jobs/[jobId]/applicants/[applicantId]` were wired. The existing 7a Job Details/editor/lifecycle is retained. Pipeline denial cannot replace an otherwise authorized 7a job read. Viewers see neither applicant records nor candidate totals. Members see only owned-job/assigned applications; only managers or the job owner can move stages, and only managers can assign or configure blind review. Private notes are **author-only**, not panel notes.

The shared `api.applicants` group adds the nine existing operations using the same bearer/rotating-refresh/error/abort conventions. `frontend/lib/api/schema.d.ts` was regenerated. There is no second client, raw page fetch, token persistence, cookie expansion or frontend reconstruction of blind identity.

The approved minimal API gap fix adds read-only `context` to `ApplicantRead` and `ApplicantPage`: job ID/title/status/archive state/owner, blind-review setting and immutable settings lock. The lock queries **any** submitted application, including deleted ones; it is never inferred from a filtered count. It exposes no applicant identity or new write permissions. Archived pipeline reads can therefore render safely despite the intentionally archive-excluding 7a job endpoint. No new migration was needed; the local development preview applied the already-existing `0039` revision on top of `0038` before browser verification.

The UI uses actual scoped search/filter/sort/count/pagination, immutable projected profile and catalogue screening answers, expected-stage concurrency checks, rejection reason/detail, permanent interview reveal, eligible assignee checks, author-private note creation/deletion, safe stage history and clean attached personal-resume grants. Salary expectation is shown as an amount with its ISO currency, **without inventing a period**. Rejection is explicitly internal and sends no message. Closed/archived jobs and terminal applications are read-only.

All inline applicant/profile/resume/ATS/practice/AI/interview/message/panel-score demo records were removed from these surfaces. Later-step sections now state that they are not connected; compare/scoring is unavailable rather than pointing into demo comparisons. `/employer/jobs/[jobId]/compare` and `/employer/templates` are untouched/deferred. `employer-data.js` remains because dashboard/talent/interviews/offers/other later-step pages still consume its exports. Nothing from those steps was deleted or represented as real API data.

### Development samples

`backend/scripts/seed_dev.py::seed_step7d_pipeline` is called for the existing dedicated employer sample organization after its 7a jobs/team seed. Both the whole script and the new function require **exact** `ENVIRONMENT=development`; `dev`, `test` and production values are rejected. Stable UUIDs and existing-record checks make the synthetic users/applications/job/private-note records fill-only. Existing job settings, edits, stage decisions, archived jobs and deleted applications are not overwritten or resurrected. Stage-event IDs retain the existing database-generated bigint convention.

The seed includes ordinary, blind and interview-stage samples and one admin-authored private note. It does not invent practice consent, interview rounds, ATS scores or messages. Personal sample PDFs are created only with the explicit `dev_clean` scanner, through the existing upload/storage/confirm/processor path; no ready/clean file rows or scan results are fabricated. Without that opt-in, samples have no resume. Production R2 was not exercised.

### Current verification

All commands below ran from the indicated directory and exited zero unless explicitly marked otherwise:

- `frontend/`: `npm run build`, `npm run typecheck`, targeted `next lint` on the two page files, pipeline/workspace components and shared client; **pass**. Build follows the existing repo configuration that skips embedded lint/type checks, so the separate checks were run explicitly.
- `frontend/`: `node --test tests/applicants-client.test.cjs tests/jobs-client.test.cjs tests/careers-client.test.cjs`: **14 passed**. Applicant tests cover all nine paths/payloads, cancellation, shared single-flight refresh/error mapping, signed-storage URL proxying and memory-only tokens. `npm run test:applicants` is available for the new client tests.
- `frontend/`: `npm run lint`: **exit 1, 58 errors / 10 warnings** in unrelated remaining pages/components. This is not a full-lint pass; the removed applicant demo eliminated seven of the previous 65 errors.
- `backend/`: `pytest app/tests/test_applicant_pipeline.py app/tests/test_applicant_wiring.py -q`: **84 passed / 4 PostgreSQL-only skips**. The six new context/seed cases also passed in a final isolated rerun. They cover strict read-only context, archive reads, filtered/deleted-application settings locks, exact development gating, idempotency and no overwritten/resurrected seed applications.
- `backend/`, dedicated disposable native PG database only: `pytest app/tests/test_applicant_pipeline.py app/tests/test_applicant_wiring.py app/tests/test_job_applications.py app/tests/test_jobs.py -q`: **239 passed / no skips**. Includes actual object/role boundaries and row-lock race contracts; not a new full-repository test run.
- `backend/`: `ruff check app scripts/seed_dev.py`, format checks for the changed context/service/test modules, `mypy app` (**244 files**) and `git diff --check`: **pass**.
- Additional `mypy scripts/seed_dev.py`: **exit 1, 104 legacy errors outside the new 7d function**. The application mypy gate above is clean; no unrelated seed typing cleanup was attempted.

Actual-backend Chromium checks against the production frontend build passed:

- Owner Pipeline/search/stage filters, scope counts, profile detail and unchanged 7a Job Details; real **20+1** Pipeline pagination and search resetting offset.
- Owner/admin private-note isolation, author creation/deletion, whitespace blocking; assigned members can add their own notes but cannot change stage/assignment, while a **job-owning** member can change its job's applicant stage but not assignment.
- Owner unassignment/reassignment persists and immediately removes assigned-only member access. Viewer Pipeline/direct-detail denial does not break authorized job reads or leak counts. Invalid/cross-job application IDs render denial without demo fallback.
- Blind search/identity/profile/free-text/resume suppression, locked policy after submission, permanent reveal at interview, identity remaining visible after moving backward, internal rejection reason/detail and terminal read-only state. Empty-job blind setting changes use the actual API.
- Actual stale-stage **409** with current-stage reload, archived Pipeline/detail/back-link reads with disabled writes, actual network-error/retry/empty states.
- Resume grant and signed same-origin development download returned actual PDF bytes. No production R2 claim.
- Snapshot screening free text renders verbatim (including case/underscores), with a false boolean rendered as “No”, verified against actual persisted development answers on the final build.
- Responsive applicant detail at 390px, no document overflow after layout settles, no browser runtime errors, and **no access/refresh tokens in localStorage or sessionStorage** across role sessions.

Sandbox evidence: `/tmp/forma-7d-wiring-{sqlite,pg}.log`, `/tmp/forma-7d-{browser,edge,validation}-results.json`, `/tmp/forma-7d-front-build-final.log`, `/tmp/forma-7d-full-lint-final.log`, `/tmp/forma-7d-seed-mypy.log`. Browser fixtures used only dedicated synthetic development records; pytest used only a disposable database, never the preview database. An initial browser launch needed the existing sandbox Chromium library path; PDF verification was corrected to inspect signed download bytes rather than assuming a headless PDF-viewer URL, and responsive checks wait for layout to settle. Final browser runs passed.

Only **7d B** is checked for this approved batch. Docker/Compose remains unavailable and the **7d A gate remains unchecked**; native PG is supplemental, not a waiver. **7e A/B remain unchecked**, templates remain untouched, and no commit or push was made.
