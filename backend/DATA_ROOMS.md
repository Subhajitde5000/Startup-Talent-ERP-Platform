# Step 9g / 9h — backend contract and verification

Backend only. Frontend wiring, demo-store removal and seed migration belong to phase B and have not been started. The approved implementation is split into two batches: 9g has four tables / twelve endpoints; 9h has two tables / twelve endpoints. This exceeds the combined sizing guideline and was explicitly approved before implementation.

## API

All paths below have the `/api/v1` prefix. `S` means `/organizations/{org_id}/data-room`; `R` means `/investors/data-room-access-requests`.

| Method | Path | Caller / purpose |
| --- | --- | --- |
| GET | S | Startup member: room metadata (404 before first configuration) |
| PUT | S | Startup owner/admin: create or update room settings |
| GET | S/folders | Startup member: paginated folders |
| POST | S/folders | Startup owner/admin: create folder |
| PATCH | S/folders/{folder_id} | Startup owner/admin: rename, order or move folder |
| DELETE | S/folders/{folder_id} | Startup owner/admin: soft-delete an empty folder |
| GET | S/documents | Startup member: current document metadata; optional folder filter |
| POST | S/documents | Startup owner/admin/member: attach an existing ready organization file; only owner/admin may set investor visibility |
| PATCH | S/documents/{document_id} | Startup owner/admin/member: rename; moving or changing visibility requires owner/admin |
| DELETE | S/documents/{document_id} | Startup owner/admin: soft-delete document |
| GET | S/documents/{document_id}/versions | Startup member: paginated immutable version metadata |
| POST | S/documents/{document_id}/versions | Startup owner/admin/member: append a version using a ready organization file |
| POST | R | Investor with writable investor-firm membership: request personal access |
| GET | R | Investor: paginated own requests, optional status filter |
| GET | R/{request_id} | Investor: own request and pinned NDA identity only |
| GET | S/access-requests | Startup owner/admin: paginated requests, optional status filter |
| POST | S/access-requests/{request_id}/decisions | Startup owner/admin: approve, deny, revoke |
| GET | R/{request_id}/nda-content | Approved personal requester: authenticated pinned NDA bytes (before acknowledgment allowed) |
| POST | R/{request_id}/nda-acceptances | Approved personal requester with writable firm membership: acknowledge exact pinned NDA |
| GET | /investors/data-rooms/{startup_org_id} | Effective personal grantee: minimal room summary |
| GET | /investors/data-rooms/{startup_org_id}/folders | Effective personal grantee: paginated exact approved folders |
| GET | /investors/data-rooms/{startup_org_id}/documents | Effective personal grantee: paginated current investor-visible documents; optional approved-folder filter |
| GET | /data-room-documents/{document_id}/content | Startup member or effective scoped personal grantee: authorized bytes; optional `version_id` for startup history only |
| GET | S/document-views | Startup owner/admin: paginated retrieval audit, optional same-room document filter |

Every route requires authentication. Existing verified-user, organization, membership, error, request-size and limiter infrastructure is reused. Startup reads are available to owner/admin/member/viewer. Viewers cannot mutate. A platform admin is not automatically a data-room member. No authority comes from deals, pipeline stages, meeting requests or diligence checklists.

Lists use deterministic ordering, `limit` 1–100 (default 20), nonnegative `offset`, and `{items,total,limit,offset}`. OpenAPI documents the request/read schemas and common failure statuses.

### Typical flow

1. Startup owner/admin `PUT S` to configure a room. NDA protection defaults on; approval is blocked until an appropriate NDA is configured. Set `nda_required: false` explicitly for a room not requiring an NDA.
2. Use existing Step 4 upload reservation → upload → confirm/scan flow. Only ready, clean, same-organization files can become documents, versions or NDA policies. Personal and foreign-organization file IDs are rejected.
3. Create folders/documents. Documents default to `private`. Only `private` and `approved_investors` can be written through this API; `public` receives 422.
4. Investor `POST R` with `startup_org_id` and optional `message`. Requester identity and firm are server-resolved. A retry while a request is pending/approved returns the existing personal request, not a second record.
5. Startup `POST S/access-requests/{id}/decisions` with `{"action":"approve","scope":["folder-uuid"],"expires_at":"timezone-aware-ISO-timestamp"}`. Expiry is optional, default 30 days, at most 365 days in the future. Scope requires 1–50 distinct folders from this room, **without descendant inheritance**. Deny/revoke take only `action`.
6. For NDA-protected grants, investor retrieves `nda-content` and posts `nda_file_id`, `nda_checksum`, `legal_name`, and strict boolean `agreed: true`, `purpose_agreed: true`. Identical retries preserve the original timestamp; evidence cannot be renamed or supplied with client timestamps.
7. Investor browses minimal current metadata and retrieves bytes through the authenticated content endpoint. Startup can revoke an approved request at any time. Denied/revoked/expired requests cannot be reopened; a new application starts with fresh evidence.

## Approved decisions and reference-schema differences

`database/schema.sql` was inspected as a reference, not executed or copied wholesale. Revisions `0033_step9g_data_rooms` and `0034_step9h_data_room_access` create only these batches' tables and indexes; existing historical migrations remain unchanged.

- **D1: durable versions.** Reference documents had only a mutable `version` label. Add `data_room_document_versions` with unique `(document_id, version_number)`, file reference, uploader and timestamps. Documents gain `name` (needed by the UI) and server-owned `version_number`; existing `version` stays as the derived `vN` label. Current `file_id` remains for compatibility. Investors cannot select old versions; startup members can. Same-current-file version retries return the current version. Room locking serializes numbering.
- **D2: no public file sharing.** Keep reference visibility values in the DB constraint (including `public`) but reject public API writes and never authorize anonymous content. Use bounded strings plus check constraints for visibility/status instead of introducing shared PostgreSQL enum types, matching existing backend portability patterns.
- **D3: personal grants.** `requester_org` remains the reference column name. The existing investor-firm resolver chooses the caller's earliest active firm membership; this task adds no new firm selector/onboarding flow. Continued active firm membership plus an unrevoked investor platform role are checked at retrieval, not just approval. Approval is not inherited by colleagues.
- **D4: explicit scope and expiry.** Reference `scope text` becomes a JSON array of exact folder UUID strings, validated against the target room. Add bounded request `message`; extend status with `revoked`, preserve the partial unique-open index and use lazy transactional expiry. Pending requests expire after 30 days. No scheduled worker or background mechanism was introduced. Decision/expiry actions are activity-audited.
- **D5: pinned NDA evidence.** Rooms gain `nda_required` and `nda_file_id` policy fields. Approval snapshots these, with the exact file SHA-256. Requests gain `nda_required`, checksum, legal name and the two acknowledgments; server sets `nda_signed_at`. A changed room policy does not rewrite an existing grant. NDA file deletion is `RESTRICT`, not reference `SET NULL`, to retain evidence. Only ready, clean `legal` PDFs owned by the startup may be configured. This is an acknowledgment trail, **not certified electronic signature** or a claim of legal enforceability.
- **D6: authenticated bytes.** No investor R2 signed URLs are issued. Reads use the existing storage adapter, verify byte count, MIME and SHA-256, and fail closed on integrity/storage/audit failure. `document_views` gains exact `version_id`; ID remains bigint generated-always identity on PostgreSQL (SQLite integer variant). INET values normalize from asyncpg address objects to API strings. The immutable log retains reference `viewed_at` and `created_at` without an update timestamp.
- Folder/document names are bounded to 200 characters; display order is an integer checked within 0–32767. Folders gain soft deletion. Parent and document-folder FKs use `RESTRICT` instead of reference cascade, preventing accidental destruction of retained versions/audit. Only empty folders can be removed; document deletion retains versions and view evidence.
- Keep reference table names and major index names, including `data_rooms_org_key`, `data_room_folders_room_idx`, `data_room_docs_folder_idx`, `dradr_status_idx`, `dradr_unique_open`, `document_views_doc_idx`. Add supporting FK/requester/expiry indexes and check constraints for names, counts, statuses, approval and NDA evidence. UUIDs are generated by the application, as in the existing backend, rather than relying on a new extension/server UUID default.
- Generic file deletion now returns `FILE_IN_USE` (409) for version, current room NDA-policy or pinned NDA references, including soft-deleted documents and terminal grants. Bytes therefore cannot be purged through generic soft deletion while these records retain them.

## Security, concurrency and limits

- Route organization IDs are never assigned into an input object. Room/folder/document/version/request IDs are resolved under their owning room, not merely by UUID existence. Cross-org/missing references share 404 or an input-field 422; wrong roles within an accessible organization receive 403.
- Inputs forbid extra fields. Ownership, requester/firm, counters, file pointers on document updates, versions, status, timestamps and NDA evidence are server-owned. Status changes only through decisions/expiry. Only `VersionCreate.file_id` may replace the current file by appending an immutable version.
- First room creation locks the organization. Mutations, approvals, expiry, content/audit and revocations serialize on the room row. File assignment takes the existing file row lock against generic deletion. SQLite tests cannot establish PostgreSQL locking guarantees; separate PostgreSQL-only concurrency tests cover version append, duplicate requests/approval and in-flight content vs revoke.
- Content authorization also rejects inactive rooms and suspended/deleted organizations, deleted documents/folders, unready or unclean files, stale NDA files/checksums, expired/revoked grants and unapproved folders. API metadata does not confer file access through the generic Step 4 file endpoints.
- Investor document metadata excludes raw file IDs, updater IDs and view totals; folder metadata excludes potentially unapproved parent IDs. Startup-only audit access includes deleted documents' trails without allowing cross-room filtering.
- Every successful document-byte retrieval, including startup/history retrieval, commits `document_views` plus the counter **before** returning bytes. A failed transfer after server commit may still count; this is a retrieval audit, not proof that a human viewed every page. NDA retrieval is recorded as an activity event instead of a document view.
- IP comes from the ASGI client address, not a caller-supplied forwarded header. Deployments must configure their trusted proxy chain correctly. User agent is truncated to 512 characters. Audit metadata does not copy request messages, legal names or file bytes into the activity feed.
- All metadata bodies use the existing 8 KiB `FileRoute` limit and no-store responses. Content has private/no-store, nosniff, sandbox CSP and no-referrer headers. Inline disposition is only a presentation hint. Authorized recipients can save bytes, photograph screens or take screenshots: **no DRM/no-download guarantee** is claimed.
- Maximum 500 active folders and eight hierarchy levels; cycle/depth checks include moved subtrees. A content response is bounded by the existing file processing maximum, 25 MiB, and buffered to validate integrity before release.
- Configurable shared Redis limiter values are in `.env.example`: user writes 60 / five minutes; org writes 300 / five minutes; access requests 10 / hour; NDA acceptance 10 / five minutes; content 120 / five minutes. Document bytes additionally consume the existing file-download budget. The existing shared limiter falls back to per-process memory if Redis is unavailable; this task does not redesign that policy. Production must configure/monitor Redis because fallback is not a globally enforced budget. Tests use the existing memory limiter.

## Run and verify

From `backend/`, with the existing backend environment/dependencies installed:

```bash
ruff check app alembic scripts
mypy app
pytest -q app/tests/test_data_rooms.py app/tests/test_data_room_access.py \
  app/tests/test_data_room_concurrency.py app/tests/test_files.py \
  app/tests/test_file_selections.py
```

PostgreSQL is mandatory for row-lock and migration verification. Use **separate disposable databases** for tests and migrations: the test fixture drops/recreates ORM tables per test and must never target development/production data or a migration-verification database.

Required Compose verification (still an open gate in this workspace):

```bash
# backend/; start the existing dependencies
# These createdb commands assume the disposable databases do not yet exist.
docker compose up -d postgres redis mailpit
docker compose exec -T postgres createdb -U forma forma_test_step9
docker compose exec -T postgres createdb -U forma forma_migrations_step9

FORMA_TEST_DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_test_step9 \
  pytest -q app/tests/test_data_rooms.py app/tests/test_data_room_access.py \
    app/tests/test_data_room_concurrency.py app/tests/test_files.py app/tests/test_file_selections.py

export DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_migrations_step9
alembic upgrade head
alembic downgrade -1
alembic upgrade head
# Also exercises the 9g rollback, not just the 9h rollback:
alembic downgrade 0032_step4_org_file_selections
alembic upgrade head
```

### Verification status (2026-11-23)

- Targeted SQLite suite above: **200 passed, 3 skipped** (the three PostgreSQL-only concurrency tests), 160.28 seconds.
- Same targeted suite on supplemental native PostgreSQL **16.2**: **203 passed**, 426.14 seconds. This includes file lifecycle/selections regressions and all three concurrency tests.
- Final own-request-list expiry-query refinement was additionally rechecked with four happy-path/lifecycle cases on each database: **4 passed SQLite + 4 passed PostgreSQL**.
- `ruff check app alembic scripts`: passed. Formatting checks for all new Python files: passed. `mypy app`: passed, **219 source files**.
- On a fresh separate native PostgreSQL migration database: `upgrade head`, `downgrade -1`, `upgrade head`, downgrade through both new revisions to `0032_step4_org_file_selections`, and `upgrade head`: passed. Alembic comparison of the six new migrated tables against ORM metadata: **no differences**.
- OpenAPI generation succeeded: **24 operations across 17 paths**.
- An exploratory whole-backend SQLite run was stopped before completion to focus on the final scoped suites; no full-suite pass is claimed.

Docker/Compose and `/var/run/docker.sock` are absent here; `docker compose -f backend/docker-compose.yml version` exits 127 (`docker: command not found`). Supplemental native PostgreSQL results **do not satisfy** the requested Docker Compose gate. The 9g/9h A progress entries remain unchecked until that gate is completed. No frontend progress entry has been changed.

Open deployment/product items: real R2/scanner integration remains the Step 4 gate; NDA wording/enforceability and retention/erasure of legal evidence, viewer IP/user agent and retained files need legal/privacy review. No new retention worker, certified e-sign provider, payments, messaging, offers, diligence, analytics, public sharing or frontend changes are included.
