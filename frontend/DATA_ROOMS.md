# Steps 9g / 9h — frontend wiring and verification

## Scope

Only these five routes are wired in this phase:

- `/startup/data-room`
- `/startup/data-room/requests`
- `/investor/data-rooms`
- `/investor/data-rooms/[startupId]`
- `/investor/data-rooms/[startupId]/nda`

Implementation is under `components/data-room/{startup,investor,shared}.tsx`. The shared startup investor app changes only its data-room/access branches; the three investor route components delegate to the real implementations. Other investor app branches and still-used exports in `app/investor/investor-data.js` retain their existing behavior. Shared shell/header/sidebar adjustments apply only in the data-room scope; PageHeader's default workspace label is unchanged for other callers. Tailwind's content scan explicitly includes the new data-room TSX directory so production builds generate the scoped layout/button styles (confirmed by final screenshot inspection).

`lib/api/schema.d.ts` is generated from the actual backend OpenAPI. `lib/api/client.ts` exposes generated-schema-typed room/access methods and supports successful binary responses through the **same** authentication, refresh, retry and JSON error-mapping pipeline. Components do not introduce another HTTP client. Uploads reuse Step 4's existing FileUploadControl and signed-upload pipeline.

The small backend API additions needed by these pages are authorized, read-only startup organization ID/name, requester name/firm and audit display projections, plus a UUID startup filter on the personal request list. File sizes come from the existing authorized Step 4 file metadata endpoint. There are no writable frontend-only fields or invented metrics.

## Implemented behavior

- Startup: room setup/settings, NDA policy PDF upload, folders/create/edit/move/delete, documents/private uploads/edit/move/visibility/delete, immutable version uploads/history/preview, real file sizes and paginated audit retrieval records.
- Owner/admin manage policy, folders, access decisions and audit records. Members can upload/edit permitted document metadata/versions but cannot change visibility/folder policy. Viewers read only. The backend still enforces authorization on each operation.
- Access requests: paginated status tabs, exact folder selection (no descendant inheritance), optional expiry, policy read-only in the approval dialog, approve/decline/revoke and backend validation errors.
- Investor: paginated **personal** requests, real discovery selection for new requests (without modifying discovery pages), UUID deep links, exact approved folders/documents, protected current content, and actual pinned NDA PDF/checksum with two acknowledgments/legal name/server evidence.
- Loading, empty, server/network error and retry states; no mock fallback on invalid IDs, absent room or denied access.
- Successful NDA acknowledgment is not represented as a certified e-signature. Byte retrieval is audited, not DRM: recipients can save/capture already delivered bytes. No watermark/download-prevention promises.
- Viewer unmount revokes Blob URLs; explicit reauthorization, returning to a visible tab, expiry and periodic authorization failure remove the confidential viewer. Already saved content cannot be recalled.
- Later-step extensions, questions, personal notes, completeness tracking, new-document/unread metrics and review durations are hidden or explicitly unavailable/not tracked. Count summaries are labeled as current-page counts, not global statistics; failed requests do not display invented zero totals.

## Development seed

`backend/scripts/seed_dev.py` adds `seed_step9_data_rooms` to the existing development seed. Run using the existing backend environment instructions, only against a disposable **development** database:

```bash
cd backend
# Configure the existing dev database, R2 bucket and FILE_SCANNER=dev_clean.
# ENVIRONMENT must literally be development; never run against production.
python -m scripts.seed_dev
```

The room seed requires configured development storage and the development clean scanner. It uses Step 4's actual upload/confirmation/validation processing and real PDF/XLSX sample bytes. It is fill-only/idempotent and does not reset terminal decisions, revive deleted documents or fabricate ready statuses, signatures, view counts, sizes or durations. It creates seven folders; private financial and approved-investor pitch/product documents; pending personal requests; an Acme no-NDA grant; and a GreenLedger grant awaiting real acknowledgment. OrbitPay's representative pending request is seed-only/non-discoverable. The sample NDA is explicitly development content, not legal advice. No migration contains seed records.

## Repeatable checks

With existing dependencies installed:

```bash
cd frontend
npm run typecheck
npm run build
node --test tests/data-room-client.test.cjs
npx next lint \
  --file lib/api/client.ts \
  --file tailwind.config.js \
  --file components/data-room/shared.tsx \
  --file components/data-room/startup.tsx \
  --file components/data-room/investor.tsx \
  --file components/investor-header.jsx \
  --file components/investor-shell.jsx \
  --file components/investor-sidebar.jsx \
  --file components/page-header.jsx \
  --file app/startup/investors/investor-app.jsx \
  --file app/investor/investor-data.js \
  --file app/investor/data-rooms/page.jsx \
  --file 'app/investor/data-rooms/[startupId]/page.jsx' \
  --file 'app/investor/data-rooms/[startupId]/nda/page.jsx'

cd ../backend
ruff check app alembic scripts
mypy app
pytest -q app/tests/test_data_rooms.py app/tests/test_data_room_access.py \
  app/tests/test_data_room_seed.py app/tests/test_file_seed.py
```

The Node tests transpile the actual shared TypeScript client in an isolated runtime with controlled HTTP responses. They cover binary 401/refresh/retry, shared concurrent refresh, binary JSON errors and mutation validation details. They do not assert a new cookie-based auth architecture.

## Observed verification — 2026-11-23

- Production build: passed. Typecheck: passed. Scoped lint above: no warnings/errors.
- Shared client regression tests: **4 passed**.
- Backend Step 9/seed regression command above: **105 passed**, 117.48 seconds (SQLite; not the PostgreSQL concurrency suite).
- New development gating/idempotence/real-file seed and authorized display/filter projection tests separately: **5 passed**, 4.25 seconds. These overlap the 105-test run, not 110 distinct tests.
- Backend Ruff passed; mypy passed, **220 source files**.

### Real browser verification (supplemental, not live R2)

Chromium 153 drove the production Next server through its normal `/api` proxy and normal backend JWT login. A **disposable native PostgreSQL database** had real migrations and development seeds. Only object storage/signed-upload transport was substituted with an in-memory implementation, and the development clean scanner was used. No frontend demo response layer was enabled. Additional disposable users had active startup admin/member memberships, a same-firm investor viewer membership and a startup role without a startup organization. Browser checks did not test real bucket CORS, live object retention or real malware scanning.

| Actor / scenario | Observed result |
| --- | --- |
| Startup owner | Real folders/docs/sizes; protected preview; create/delete empty folder; server error on empty approval scope; approve with explicit Pitch scope; approval and revoke appear in correct persisted tabs. |
| Startup administrator | Reads/previews; room and upload controls present; private upload through reservation/PUT/confirm/scanning; new version produces two immutable history entries; document delete removes the live row. |
| Startup member | Reads/previews and upload control; no room settings/folder/access-decision/audit management. Requests page explains owner/admin restriction. |
| Startup viewer | Reads/previews; no upload/settings/access management. |
| Outsider without startup membership | No startup workspace, no sample room; investor route rejected by RoleGuard. |
| Approved investor | Uses actual startup UUID links; only exact approved folders; excluded Financials folder stays absent; authorized current-byte preview succeeds. |
| Investor NDA | Actual pinned PDF opens; both acknowledgments and legal name submitted; immutable server acknowledgment is still displayed after reload. |
| Investor-firm viewer / colleague | Cannot create request; an unrelated colleague's personal room grant is not inherited. |
| Invalid room ID | Explicit API error and no protected iframe or demo fallback. |
| Network loss/recovery | Loaded cards disappear into error/retry state; restoring connection and Try again reloads real records. |
| Explicit access recheck | Existing preview unmounted; URL.revokeObjectURL observed; user must select a document again. |
| Mobile | List renders at 390×844 with responsive shell. |

Additional owner browser mutations verified room settings across reload, document rename, historical-version bytes and real audit entries with durations labeled Not tracked. Final scoped shell checks verified actual account identity, no fabricated verified-investor badge, no demo notifications, and disabled unsupported workspace search.

Browser scripts/screenshots/logs were temporary verification artifacts under `.cache/step9` and `/tmp/step9-*`; they are not production code or repository deliverables. To repeat the role matrix, provision the disposable memberships above through existing organization setup, seed fresh data, and follow the rows against the five routes. Run each destructive flow on fresh seed state; terminal approvals/revocations and immutable NDA evidence are intentionally not reset by re-seeding. Earlier harness event-loop and selector/timing problems were corrected before the successful checks; repeated mutation checks also exercised the real 429 limiter rather than disabling it.

## Gates still open — do not interpret wiring as release approval

1. **Token storage: NOT PASSED.** Browser inspection found both `forma.access_token` and `forma.refresh_token` in localStorage, neither in sessionStorage. The existing shared auth implementation is intentionally unchanged in this scoped phase. This does not satisfy a no-browser-token-storage gate.
2. **Live R2/scanner/Compose verification: NOT PASSED here.** Docker/Compose is unavailable. Supplemental native PostgreSQL and in-memory storage do not replace the required deployment checks. See `backend/DATA_ROOMS.md` for the earlier backend PostgreSQL/concurrency/migration evidence and exact remaining Compose gate.
3. No whole-backend-suite pass or complete cross-browser/accessibility certification is claimed. The browser checks exercised the enumerated paths, not every possible state transition or all 20+ row pagination boundaries.
4. NDA text/enforceability and legal evidence/file/IP retention still need the existing product/legal/privacy review.

Only the 9g/9h **B** progress descriptions were updated in this frontend phase. They remain unchecked to keep these open gates explicit. No commit or push was made.
