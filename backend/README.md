# Forma backend

FastAPI + SQLAlchemy 2.0 (async) + Alembic. Steps 1–3 are implemented
(auth, profiles, organizations/invites, talent & mentor profiles — 91 tests);
see `../BUILD_PLAN.md` and `../PROGRESS.md`. Full setup guide: `../README.md`.

## Layout

```
app/
  core/       config, security (argon2/JWT/OTP), exceptions, logging, dependencies
  db/         Base + async engine/session (get_db)
  models/     users, user_roles, auth_sessions, email_verification_tokens,
              password_reset_tokens, login_attempts
  schemas/    Pydantic v2 request/response models
  services/   auth_service, user_service, email_service, rate_limiter
  routers/    thin HTTP layer (auth, users)
  tests/      pytest suite (SQLite in-memory)
alembic/      env.py + versions/0001_foundation.py, 0002_auth.py
```

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set JWT_SECRET before anything real
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Docs: <http://localhost:8000/docs> · liveness `/health` · readiness `/ready`.

Local Postgres / Redis / Mailpit (optional, for the production-shaped setup):

```bash
docker compose up -d
# then in .env:
# DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma
# REDIS_URL=redis://localhost:6379/0
# EMAIL_PROVIDER=smtp  SMTP_PORT=1025   (Mailpit UI on :8025)
```

Without `REDIS_URL` the rate limiter falls back to per-process memory — fine for
dev/tests, **not** for multi-instance production. Without SMTP/Resend credentials
(`EMAIL_PROVIDER=console`) emails are logged instead of sent.

## Tests, lint, types

```bash
pytest                 # 91 tests, SQLite in-memory, no external services
ruff check app alembic
ruff format --check app alembic
mypy app
```

Test settings use the memory email sink (`app.services.email_service.SENT_EMAILS`)
and a fresh in-memory database per test, so no Postgres/Redis is required.

## Auth endpoints (all under `/api/v1`)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | email, password, full_name, role (admin rejected) |
| POST | `/auth/login` | returns access + refresh tokens |
| POST | `/auth/refresh` | rotates the refresh token; reuse revokes the whole chain |
| POST | `/auth/logout` | revokes one session |
| POST | `/auth/logout-all` | revokes every session for the user |
| POST | `/auth/verify-email` | 6-digit OTP, single use |
| POST | `/auth/resend-verification` | 60 s cooldown |
| POST | `/auth/forgot-password` | generic 200 for unknown emails |
| POST | `/auth/reset-password` | revokes all sessions on success |
| POST | `/auth/change-password` | requires current password |
| POST | `/auth/change-email` | requires current password |
| POST | `/auth/add-role` | never grants `admin` |
| GET | `/users/me` | profile + roles |

## Notes / deviations

- Python 3.11 is the floor here (`AGENTS.md` mentions 3.12+); code avoids 3.12-only syntax.
- SQLite is the default for dev/tests; enums use `native_enum=False` (VARCHAR + CHECK) so
  the same models run on SQLite and Postgres.
- Password minimum is 12 characters (frontend label currently says 8 — fixed in phase B).
- Email verification is a 6-digit OTP (10 min, single use) matching the frontend flow.
- `user_mfa_factors` and `admin_members` are deferred to Step 15a.

## Step 4 — private files (backend + approved frontend batch 1)

Cloudflare **R2** is the production storage provider. There is no public bucket,
public CDN, local-disk fallback, or production in-memory storage implementation.
The test adapter exists only under `app/tests/test_files.py`.

### Configure and run

Install with `pip install -r requirements.txt`, copy `.env.example` to `.env`,
and set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
The S3-compatible endpoint is derived server-side as
`https://<account-id>.r2.cloudflarestorage.com`, with SigV4 and region `auto`.
Use a bucket-scoped object read/write credential (including list/delete). Never
put these values in `NEXT_PUBLIC_*`, Git, logs, or API request bodies.

Keep R2 public access **disabled** (both r2.dev and custom public domains).
Configure bucket CORS for your **exact** frontend origins, with methods
`PUT`, `GET`, `HEAD`, allowed header `Content-Type`, and optional exposed header
`ETag`. Do not use wildcard origins. R2 CORS is separate from FastAPI CORS.

```bash
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`FILE_SCANNER=unconfigured` is the safe default: it produces a retryable
`scan_status=failed` and **never** publishes a downloadable object. For local
manual testing only, explicitly set `FILE_SCANNER=dev_clean`. Production settings
reject that stub. A real malware scanner remains an intentionally unimplemented
hook (`Scanner.scan`); structural file validation is **not** antivirus protection.
Scanner calls have a 120-second timeout and unknown responses fail closed.

### API and flow

All routes require the existing JWT authentication and use the shared error
format. No endpoint accepts file bytes; metadata bodies are capped at 8 KiB.

| Method | `/api/v1` path | Permission |
| --- | --- | --- |
| POST | `/users/me/files/upload-requests` | Personal owner |
| POST | `/organizations/{org_id}/files/upload-requests` | Active owner/admin/member |
| GET | `/users/me/files` | Own personal files only |
| GET | `/organizations/{org_id}/files` | Any active org member, including viewer |
| GET | `/files/{file_id}` | Personal owner or active org reader |
| POST | `/files/{file_id}/confirm` | Personal owner; org owner/admin or uploading member |
| POST | `/files/{file_id}/download-url` | Authorized reader, ready + clean only |
| DELETE | `/files/{file_id}` | Personal owner; org owner/admin or uploading member |

Platform roles do not confer cross-user/org access or an admin bypass. Former,
deactivated, suspended-org and outside members cannot use the file. A null org
FK after organization deletion cannot turn an org upload into a personal file.

1. Request an upload with only `kind`, `file_name`, `mime_type`, `byte_size`.
   Example: `{"kind":"resume","file_name":"cv.pdf","mime_type":"application/pdf","byte_size":1234}`.
2. The response contains `file`, `upload_url`, `method`, required `headers`,
   and `expires_in`. PUT the bytes directly to the URL with **exactly** the
   returned content type. Do not send the platform Authorization header to R2.
3. POST `/files/{id}/confirm` with no body or `{}`. This is idempotent; arbitrary
   fields are rejected. Poll GET `/files/{id}` for the processing result.
4. Confirmation schedules a FastAPI background task. It takes a bounded byte
   snapshot, checks the actual size/type/container, computes SHA-256, calls the
   scanner, and creates image thumbnails. Only clean bytes are written to a fresh
   server-only final key. Reusing the staging PUT URL cannot overwrite them.
5. Request a download with `{}` (original) or `{"variant":"thumbnail"}`.
   URLs expire after 60 seconds by default; ownership/membership is rechecked
   on every issuance. Existing signed URLs remain usable until expiry even
   after deletion or membership revocation. Documents download as attachments;
   validated images may render inline. Responses carrying URLs are `no-store`.
6. DELETE denies API access immediately; maintenance physically removes bytes
   after the configured grace period.

Lists return `{items,total,limit,offset}`; `limit` is 1–100, `offset >= 0`, optional
`kind` filter, sorts `created_at`/`file_name`, directions `asc`/`desc`, and a UUID
tiebreaker. Metadata responses exclude all object keys, processing leases and
signed URLs. Server-owned ownership, checksum, lifecycle/scan state and timestamp
fields are rejected in input. File lifecycle mutations use `activity_events`.

| Kind | Formats | Maximum |
| --- | --- | --- |
| `image`, `logo` | PNG, JPEG, WebP | 5 MiB |
| `resume` | PDF, DOCX | 10 MiB |
| `pitch_deck` | PDF, PPTX | 25 MiB |
| `financial_model` | PDF, XLSX, CSV | 25 MiB |
| `legal` | PDF, DOCX | 25 MiB |
| `document`, `other` | PDF, DOCX, UTF-8 text | 25 MiB |

Personal avatars use the reference kind `image`; all reference kinds can be
reserved in either personal or authorized organization scope. Extension, MIME,
size, image decoder format or document signature/container must agree. Images
are single-frame and at most 20 megapixels. Thumbnails fit within 256 × 256,
are WebP and have metadata stripped. SVG/HTML/executables/arbitrary archives and
macro-enabled containers are not accepted. Office containers are limited to
2,000 entries and 50 MiB total expansion, with traversal/duplicate/encryption/
macro checks. PDF validation is a signature/EOF check, **not a full PDF parser**;
the scanner hook must provide malware detection before production use.

The shared Redis-backed limiter supplies configurable per-user upload (20/hour),
per-org upload (100/hour), action (60/5 minutes) and signing (120/5 minutes) caps.
There are at most 10 unfinished reservations per uploader. Upload URLs expire
in 5 minutes. Signed PUT cannot enforce a trustworthy pre-upload byte quota:
actual oversized objects are rejected during bounded processing, but abusive
upload bandwidth/storage costs are still possible. Bucket monitoring and
provider-side operational protections remain deployment responsibilities.

### Scheduling, retries and retention

The file row persists pending work; background tasks are not the durable queue.
The scheduled command recovers work after process restarts, including expired
10-minute processing leases. Each attempt uses unique keys and conditional
publication, so another worker, expired lease or deletion cannot republish a
file. Database transactions are not held open while reading/scanning/uploading.
Cleanup walks UUID-keyset batches and paginated object listings; provider
failures retain metadata for retry and make the command exit nonzero.

Configure deployment cron (not an in-process scheduler), for example:

```cron
*/15 * * * * cd /srv/forma/backend && PYTHONPATH=. /srv/forma/.venv/bin/python scripts/maintain_files.py --batch-size 100
```

Run manually from `backend/` with:

```bash
PYTHONPATH=. python scripts/maintain_files.py --batch-size 100
```

The command retries confirmed uploads, expires abandoned reservations after
upload expiry plus 24 hours, removes staging/crashed-attempt objects, and purges
soft-deleted files after a 24-hour grace. Ready final objects and thumbnails are
preserved. Orphaned org/user files are inaccessible and enter deletion cleanup.
`FILE_RETENTION_HOURS` configures the grace; it is an operational default, **not**
a legally approved retention policy. Metadata/audit retention, legal holds and
DPDP erasure/export policy require later compliance decisions. Do not install a
bucket-wide expiration policy that would delete ready objects.

### Schema differences

Revision `0031_step4_files` creates **only `files`**; it never runs `schema.sql`
and does not add file references to other domain tables. Reference column names,
file kinds, scan states (including `failed`), UUIDs and SET NULL FKs remain.
Differences are:

- Added `upload_status`, `upload_expires_at`, `confirmed_at` for reservation and
  confirmation state; `upload_storage_key` isolates reusable signed staging PUTs.
- Added `thumbnail_storage_key` for derived images.
- Added internal `processing_token`, `processing_expires_at` for crash-safe
  overlap protection, and `purged_at` to checkpoint successful physical cleanup.
- Bounded VARCHARs replace unbounded metadata text; SHA-256 uses VARCHAR(64)
  plus a length check instead of padded CHAR(64). API computes the actual hash.
- Added lifecycle, lease and length/size CHECKs; index uploader/time for personal
  lists, status/expiry for work, and purge/deletion for cleanup. Existing reference
  storage-key uniqueness and partial org/kind index remain.

No expiring signed URL is saved into existing `avatar_url`, `logo_url`, or
`pitch_deck_url`. Attachment/public-profile presentation, startup document wiring,
data rooms, hiring resumes, evidence links and all frontend work remain deferred.

### Verify (use disposable databases)

```bash
pytest -q
ruff check app alembic scripts
mypy app
```

**Required Docker Compose PostgreSQL verification** (DBs are scratch-only;
pytest drops/recreates their tables; never point it at user data):

```bash
docker compose up -d postgres redis mailpit
# Create once:
docker compose exec -T postgres psql -U forma -d forma -c 'CREATE DATABASE forma_step4_test'
docker compose exec -T postgres psql -U forma -d forma -c 'CREATE DATABASE forma_step4_migrations'

FORMA_TEST_DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_step4_test pytest -q

export DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_step4_migrations
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

R2 tests use fake objects and real local SigV4 signing; no Cloudflare credentials
are needed for pytest. A real private-bucket upload/confirm/download/CORS check
still needs execution in an environment with R2 network access. The repository's
existing editable-install packaging is incomplete; use the documented requirements
install rather than `pip install -e .` until that separately scoped issue is fixed.

Implementation-session verification (2026-11-23): PostgreSQL 16.2 was run using
an ephemeral native binary because Docker is absent in the sandbox. The migration
cycle passed there, but this **does not satisfy the Docker Compose gate** above.
The full PostgreSQL pytest command hit the tool timeout near the end without
failures; rerunning the final two test files completed 80 passing tests. Final
Step 4 reruns passed 88 tests on each database. The full SQLite regression run
passed 1,014 tests with 1 skip before the final two Step 4 tests were added.

Known pre-existing issues left outside this step: fresh SQLite Alembic upgrades
stop in revision `0014` on unsupported ALTER CONSTRAINT (use **PostgreSQL for
migrations**); repository-wide `ruff format --check` reports existing formatting
drift. The standard backend-directory `ruff check app alembic scripts` passes,
and all new Step 4 Python files pass formatting checks. Do not rewrite applied
historical migrations or reformat unrelated files as part of this step.


### Step 4 frontend batch 1 — startup files only

The existing shared client (`frontend/lib/api/client.ts`) now exposes generated
OpenAPI file contracts and file operations. Only the signed object PUT bypasses
its API bearer/refresh wrapper; it explicitly omits cookies and API credentials.
No second auth client was introduced. The user's explicit defer-auth decision
keeps the existing localStorage tokens unchanged: **the no-browser-token-storage
verification gate remains unmet**.

Apply `alembic upgrade head` before running this frontend. Revision
`0032_step4_org_file_selections` extends existing tables with nullable, indexed
`logo_file_id` / `pitch_deck_file_id` FKs (`ON DELETE SET NULL`), rather than
persisting expiring signed URLs or replacing the existing external URL fields.
Both private attachment IDs are excluded from public startup shapes. Selecting
requires a same-org, nondeleted, ready/clean file of the matching kind; soft
deleting a file also clears any selected references in the same transaction.
The named `use_alter` logo FK breaks the organizations/files DDL dependency cycle.
There are no new sharing, NDA or cover tables/fields.

- `/startup/profile`: real logo upload/thumbnail/unselect, deck selection and
  private paginated files with upload/status/download/delete/retry states.
  Owner/admin manage logo; members also upload/select decks and delete their own
  files; viewers only list/download. Public preview never renders private files.
- Startup onboarding's deck section explicitly saves/creates the startup before
  enabling upload. It saves the file ID immediately and preserves it at final
  submission; the external deck link remains independent.
- Cover editing is disabled honestly. Step 9 investor/data-room pages and shared
  non-file profile/onboarding sections retain their previous behavior/data.
  Other avatar/resume/profile inventory batches are not implemented by batch 1.

#### Development samples

From `backend/`, after configuring the existing `.env` for **PostgreSQL**:

```sh
ENVIRONMENT=development ../.venv/bin/python scripts/seed_dev.py
```

The entire seed now refuses every value except literal `development` (including
`dev`, `test` and `prod`). The three removed inline names, `Pitch deck v3.pdf`,
`Financial model.xlsx` and `Product brief.pdf`, are generated as valid sample
PDF/XLSX bytes. File seeding additionally needs configured private R2 and explicit
`FILE_SCANNER=dev_clean` opt-in; it writes actual objects and uses the normal
confirm/processor path. No direct `ready`/`clean` row fabrication. Existing ready
samples are skipped on rerun. Missing storage/scanner config prints a skip and
leaves the real empty-files UI; fabricated sizes/dates/Public/NDA labels are not
seeded. Never enable the development scanner in production.

#### Repeat verification

```sh
# backend/
../.venv/bin/ruff check app alembic scripts
../.venv/bin/mypy app scripts/maintain_files.py
../.venv/bin/pytest -q app/tests/test_files.py app/tests/test_file_selections.py app/tests/test_file_seed.py app/tests/test_startup_profile.py app/tests/test_organizations.py
# Repeat pytest with FORMA_TEST_DATABASE_URL set to an isolated PostgreSQL DB.
# Never use a development or production database for these destructive fixtures.

# frontend/
npm run build
npm run typecheck
npx next lint --file lib/api/client.ts --file components/files/FileUploadControl.tsx --file components/files/PrivateFileImage.tsx --file components/files/OrganizationFiles.tsx --file app/startup/profile/startup-profile.jsx --file app/onboarding/flows/StartupOnboarding.jsx
npm run lint  # honest full-repo gate; currently fails in untouched legacy pages
```

2026-11-23 results: targeted backend **150 passed on SQLite / 150 on native
PostgreSQL 16.2**, 0032 migration upgrade/downgrade/upgrade passed; frontend build,
separate typecheck and changed-file lint passed. Full lint fails on pre-existing
unescaped entities and other warnings in unrelated routes; those were not edited.
The installed existing Next.js 14.2.31 also reports a security advisory; upgrading
it is outside this wiring batch. The legacy seed script is runtime-tested here;
its unrelated existing typing errors are not part of the application's mypy gate.

Browser interaction checklist (executed with real auth/PostgreSQL and a temporary
in-memory storage adapter, **not** a live-R2/CORS test):

1. Owner: empty files, upload deck, select it, reload and verify selection; upload
   logo and verify thumbnail. Spoofed PDF is rejected, invalid extension gives
   field feedback, list outage is visible and retry reloads real records.
2. Viewer: no upload/delete/select/logo controls; ready-file download works.
3. Member: upload allowed, only own files offer delete; selecting/unselecting a
   ready organization deck works; no organization logo-edit control.
4. Organization admin: logo control available; deleting another member's file
   works. This is org membership, not a platform-admin authorization bypass.
5. New startup onboarding: missing name blocks explicit early save; save org,
   upload deck, verify durable selection after reload and final submission,
   alongside the independent external link.

Known pre-existing onboarding limitation exposed during this check: hard reload
can reset the current step to Fundamentals and lose unsaved non-file draft text.
Re-entering those fields returns to the uploaded deck, whose persisted selection
survives. The unrelated Step 5 draft/progress bootstrap was not rewritten.
Docker Compose and live private-R2 upload/download/CORS gates remain unverified;
native PostgreSQL and memory storage do not substitute for them.
