# Step 7e A — scorecards and applicant comparison

Backend-only implementation of the approved **7e-first** split. This document records that batch; subsequent user approval authorized 7f/7g/7h backend work, now documented in `HIRING_WORKFLOWS.md`. No frontend edits, OpenAPI client regeneration, demo removal or frontend seed changes are included.

## Scope and reuse

Ten organization-scoped operations use the existing current-user dependency, compatible employer/startup hiring-role guards, active/verified account and organization membership checks, object-scoped application authorization, error envelopes, streaming metadata guard, activity writer and shared rate limiter. There is no second auth, permission, pagination or file system.

Owner/admin members manage organization templates and select/copy them into jobs. Eligible non-viewer hiring members can read scorecard definitions, just as they can read job definitions. Applicant scores and comparison additionally require the existing 7d **owned-job or assigned-application** scope. Eligible owners/admins can evaluate the organization's applicants. A member may submit ratings on a permitted application even when they cannot change its stage.

Applicants, viewers, outsiders, inactive/unverified accounts, revoked memberships/global roles and inactive organizations cannot use these APIs. Both employer and startup organizations are accepted under the existing compatible-role rules; holding both roles does not cause duplicate-row authorization errors. There is no global-admin bypass.

## API

All paths below are relative to `/api/v1/organizations/{org_id}`.

| Method | Path | Meaning |
|---|---|---|
| POST | `/scorecards` | Owner/admin creates an organization template with 1–20 criteria |
| GET | `/scorecards` | Paginated definitions; `kind=templates` by default, or `jobs`/`all` |
| GET | `/scorecards/{card_id}` | Read a live scorecard belonging to this organization |
| PATCH | `/scorecards/{card_id}` | Owner/admin edits name or atomically replaces criteria before scoring |
| DELETE | `/scorecards/{card_id}` | Owner/admin soft-archives an unscored card; repeat archive is safe |
| GET | `/jobs/{job_id}/scorecard` | Read the selected job-specific rubric; 404 if absent |
| PUT | `/jobs/{job_id}/scorecard` | Owner/admin selects an organization template; creates an independent copy |
| GET | `/jobs/{job_id}/applications/{application_id}/scores` | Own rating text plus anonymous numeric aggregates |
| PUT | `/jobs/{job_id}/applications/{application_id}/scores/me` | Replace only the authenticated reviewer's rating set |
| GET | `/jobs/{job_id}/compare` | Compare 2–5 distinct, explicitly selected and individually authorized applications |

Definition listing accepts `kind`, optional same-organization `job_id`, escaped literal-name search `q`, whitelisted `sort` (`newest`, `oldest`, `name`, `updated`), `limit` (default 20, max 100) and nonnegative `offset`. `kind` and `job_id` filters intersect. Responses include `total` and `has_more`; ties have stable UUID ordering.

Comparison uses repeated `application_ids` query parameters and preserves their order. A missing, deleted, foreign-job or inaccessible application rejects the **whole** comparison, not a partial result that could expose scope/count information. Comparison returns actual 7d applicant projections, preserving blind review, submitted snapshots and resume-access suppression. It does not reconstruct identity or consult live candidate profiles.

A selected template is copied with fresh criterion IDs. Editing or archiving the original template cannot change that job's rubric. Repeating selection of the same source template returns the existing copy, including after scoring; it does not recopy an edited source. A different template may replace an unscored copy, but not a locked rubric. Job-bound writes also respect closed/archived job read-only state.

### Inputs

```json
{
  "name": "Engineering rubric",
  "criteria": [
    {"name": "Technical depth", "weight": 3, "anchors": ["Basic", "Developing", "Capable", "Strong", "Exceptional"]},
    {"name": "Communication", "weight": 1, "anchors": []}
  ]
}
```

Select a template with `{"template_id": "<existing organization template UUID>"}`. A job-specific card cannot be supplied as a source template.

Own scores are a **replacement**, not a patch to another author's data:

```json
{
  "scores": [
    {"criterion_id": "<criterion UUID from the selected job rubric>", "score": 4, "note": "Private reviewer observation"}
  ]
}
```

Scores must be strict integers 1–5 (not booleans, floats or numeric strings). Each criterion may occur once and must belong to this exact job rubric, not the source template, another job, or another organization. Valid and invalid entries are never partially saved. `{"scores": []}` withdraws only the caller's scores through soft deletion; re-adding a score restores the same record. Identical retries do not duplicate ratings or audit events.

There is no writable reviewer/tenant identity, lifecycle state, display order, platform flag, timestamp, lock, aggregate, stage or arbitrary metadata. Separate input/read schemas forbid extra fields at every level. PATCH does not accept null or empty changes. Criterion names are unique case-insensitively within a card; names are bounded to 200 characters, weights 1–100, up to five nonblank anchors of 500 characters each, rating notes up to 2,000 characters, and at most 20 scores per request. All text is plain text.

Nested criteria, own ratings and aggregates are bounded by the fixed 20-criterion rubric, rather than being unbounded list endpoints. Comparison is bounded to five records. Metadata bodies are streaming-limited to **64 KiB** including chunked input by the existing `FileRoute` machinery.

## Privacy, aggregates and locking

- **Rating notes are author-private.** Even owners/admins cannot read peer notes. Numeric aggregates are visible only within authorized application scope. Peer author IDs, timestamps and individual rows are not returned. The aggregation query does not load peer note text.
- 7d application notes remain separate and untouched. Candidate-facing application/history APIs expose neither ratings nor rating notes.
- The first nonempty rating submission sets a server-owned permanent `locked_at` on the job rubric in the same transaction. Criteria, weights, name, archive and replacement become immutable. Withdrawing every rating does **not** unlock the rubric. Empty initial submissions do not lock it.
- Scoring does not reveal blind identity, move an application, create feedback or make a hiring decision. Closed/archived jobs and withdrawn/rejected/hired applications reject rating writes; authorized historical reads remain available. Paused jobs remain writable under existing 7d policy.
- Lock order follows existing job/application writes: job, application (for ratings), rubric. Template-only edits/copies lock their template. Locked ORM rows are refreshed after waiting, so concurrent changes are revalidated. A unique live-job index and per-application/criterion/reviewer uniqueness are also database-enforced.
- Missing scores are **not zero**. For each criterion, compute the mean from the sum/count of live numeric ratings; then calculate `sum(criterion_mean * weight) / sum(observed_criterion_weights)`. Return null when no criteria have ratings. Means and coverage are Decimal strings rounded half-up to three decimal places, not binary floating-point averages.
- Responses include per-criterion `rating_count`, `rated_criteria`, `total_criteria` and criterion-count `coverage_pct`. Review counts can differ by criterion. Coverage is not a confidence score. No ATS percentage, ranking, panel recommendation or AI result is fabricated.
- Author deletion can leave an anonymized historical numeric rating through the reference `SET NULL` author FK. Such a row remains in numeric aggregates, but its text cannot become another account's own note. Retention/erasure policy needs product/legal review; this batch does not invent one.

The existing hiring actor limits are intentionally shared with 7d: `APPLICANT_READ_LIMIT=120` and `APPLICANT_WRITE_LIMIT=60` per actor per minute. Each 7e operation consumes the appropriate existing budget once. This reuses the approved policy and avoids introducing a parallel limiter/configuration surface.

Sensitive definition/selection/rating mutations write generic organization activity events in the same transaction. Logs/audit summaries contain no rating notes, compensation, candidate identity or assessment payloads.

## Reference-schema differences

Migration **`0040_step7e_scorecards`** follows `0039`; it creates only the three 7e tables and no data.

- **`scorecards`** retains the reference name and fields. `org_id` is required and `is_platform` is constrained false because this approved phase has organization templates only; platform/admin catalogue management is deferred. `job_id` uses `ON DELETE CASCADE`, rather than `SET NULL`, so deleting a job cannot turn its private job rubric into an organization template. Add `source_scorecard_id` (self-FK, SET NULL) to identify a copied source and safely handle selection retries; `locked_at` persists the permanent freeze; `deleted_at` supports recoverable archives. Add source/job FK indexes, stable organization-page index and a partial unique live-job index.
- **`scorecard_criteria`** retains the reference FK/name/weight/anchors/order. Anchors are nonnull JSON lists with an empty-list default, not nullable PostgreSQL `text[]`, following repository portability conventions. Add missing `updated_at`, text/weight/order bounds, and uniqueness of `(scorecard_id, display_order)`; order 0–19 plus this unique index also caps a rubric at 20 criteria in the database. The API additionally checks anchor structure and unique names.
- **`application_scores`** retains the reference application/criterion/interviewer/score/note fields and unique reviewer key. Add missing `updated_at`, `deleted_at`, bounded nonblank notes, and FK indexes. Criterion deletion is **RESTRICT**, not CASCADE, to prevent silently erasing retained evaluations. API writes derive `interviewer_id` from the authenticated scorer, regardless of whether interview scheduling has been implemented. It is never client-controlled.
- All primary keys are UUIDs; no new role tables, approval tables, interview linkage, AI tables or alternate application snapshots are introduced. Cross-job/application/criterion associations are checked inside the authorized, locked service transaction; foreign keys also enforce row existence.

Downgrade drops only these three tables, **destroying all 7e definitions and ratings**. It preserves earlier jobs, applications, private application notes and stage history. Back up before any real rollback; this is not a data-preserving production rollback strategy.

## Running and verification

From the repository root, install the existing backend requirements in a virtual environment; then run from `backend/`:

```sh
../.venv/bin/ruff check app alembic
../.venv/bin/mypy app
../.venv/bin/pytest app/tests/test_scorecards.py -q
../.venv/bin/pytest app/tests/test_scorecards.py app/tests/test_applicant_pipeline.py app/tests/test_job_applications.py app/tests/test_jobs.py -q
```

For migration/runtime operation, configure the existing environment variables and run `alembic upgrade head`, then `uvicorn app.main:app --host 0.0.0.0 --port 8000`. No frontend regeneration or wiring is part of this phase.

### Mandatory Compose acceptance gate — still blocked

The sandbox has no Docker/Podman CLI or Docker socket. The required Compose PostgreSQL tests and migration cycle **have not run**. Native PostgreSQL results below are supplemental, not an inferred waiver. **7e A must remain unchecked** until this gate passes in a Compose-capable environment.

Use dedicated disposable databases. Existing pytest fixtures drop/recreate tables and must **never** target a developer/live database. For example, with the existing Compose stack from `backend/` (resolve host-port conflicts first):

```sh
docker compose -p forma-7e-verification up -d postgres redis mailpit
docker compose -p forma-7e-verification exec -T postgres createdb -U forma forma_7e_test
docker compose -p forma-7e-verification exec -T postgres createdb -U forma forma_7e_migrations
FORMA_TEST_DATABASE_URL=postgresql+asyncpg://forma:forma@127.0.0.1:5432/forma_7e_test ../.venv/bin/pytest app/tests/test_scorecards.py app/tests/test_applicant_pipeline.py app/tests/test_job_applications.py app/tests/test_jobs.py -q
DATABASE_URL=postgresql+asyncpg://forma:forma@127.0.0.1:5432/forma_7e_migrations ../.venv/bin/alembic upgrade head
DATABASE_URL=postgresql+asyncpg://forma:forma@127.0.0.1:5432/forma_7e_migrations ../.venv/bin/alembic downgrade -1
DATABASE_URL=postgresql+asyncpg://forma:forma@127.0.0.1:5432/forma_7e_migrations ../.venv/bin/alembic upgrade head
```

Also exercise create/copy/rate/freeze through the actual migrated schema and verify pre-7e job/application/history preservation across the cycle. Migration acceptance requires PostgreSQL; the historical full SQLite migration chain has existing unsupported ALTER operations.

### Sandbox verification record

- Initial new-feature SQLite suite: **65 passed / 2 PostgreSQL-only skips**. Six additional startup/deleted/blind/paused-job contract checks passed in isolation afterward.
- Initial new-feature native PostgreSQL suite: **67 passed / no skips**, including concurrent rating replacement and a waiting rubric writer observing a newly established permanent lock. This run preceded the six additional cases.
- Fresh disposable native PostgreSQL migration database: upgraded through existing `0039`, inserted a real job/application/history through authenticated APIs, upgraded to `0040`, exercised actual migrated create/copy/rate/aggregate/freeze, downgraded one revision with original data preserved, upgraded again and repeated the API/index checks: **pass**. This is **not Compose verification**.
- Ruff over `app`/`alembic`, format checks for the new modules/migration/tests, `mypy app` (249 files), and whitespace checks: **pass**.
- An initial full-repository SQLite run was stopped in favor of the affected hiring-domain regressions. It is **not a full-suite pass**. The first focused run had a withdrawn fixture missing its required withdrawal timestamp; the fixture was corrected and subsequent runs passed.
- Verification used the available Python 3.11 environment; Python 3.12 execution was not verified. Dependencies were installed from the existing requirements, with no dependency-file changes. Existing editable packaging lacks Hatch package selection, so installation used the requirements file rather than changing unrelated packaging configuration.

Final current-code affected-domain run (`test_scorecards.py`, `test_applicant_pipeline.py`, `test_job_applications.py`, `test_jobs.py`):

- **SQLite: 297 passed / 9 PostgreSQL-only skips**, exit zero, 270.72 seconds.
- **Native PostgreSQL: 306 passed / no skips**, exit zero, 657.45 seconds. Includes all six additional startup/deleted/blind/paused-job cases, earlier application/pipeline locking contracts and both new scorecard concurrency cases.

Sandbox-only logs: `/tmp/forma-7e-hiring-{sqlite,pg}.log`, `/tmp/forma-7e-sqlite.log`, `/tmp/forma-7e-pg.log`, `/tmp/forma-7e-extra.log`, `/tmp/forma-7e-migrations.log`, `/tmp/forma-7e-migrated-smoke.log`. The stopped full-repository attempt is `/tmp/forma-7e-full-sqlite.log` and is not a passing full-suite result. Migrated-schema API checks used `/tmp/forma-7e-migrated-smoke.py` and disposable `forma_7e_migrations`, never a development database.

## Subsequent authorization and remaining boundary

The original stop-before-7f checkpoint was superseded by the user's explicit approval to continue 7f, 7g and 7h backend work. Those implementations and their verification are recorded in `HIRING_WORKFLOWS.md`. Frontend wiring remains unauthorized; no scorecard demo records were migrated out of frontend stores. Docker Compose acceptance is still required. No commit or push is authorized.

## Approved frontend follow-up

The employer comparison/applicant evaluation surfaces and Scorecards template category are now connected through the shared generated-contract client. See [`frontend/HIRING_WORKFLOWS.md`](../frontend/HIRING_WORKFLOWS.md) for scope, auth non-persistence, seed/demo boundaries and focused verification. Startup wrappers and later-step dashboards are unchanged; the backend Compose acceptance gate remains open.
