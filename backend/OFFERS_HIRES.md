# Step 7g + 7h — job offers and hires (backend phase A)

Combined batch per the approved plan (D1–D14). **Frontend wiring is deferred**, together with the frontend of 7a–7f; this document covers backend only. No commit or push is part of this task. `database/schema.sql` was read as a reference only; both tables ship in real Alembic revisions `0042_step7g_offers` (head `0041` → `0042`) and `0043_step7h_hires` (head `0042` → `0043`), consistent with the existing migration chain.

## API

All routes are under `/api/v1`. Shorthands below match OpenAPI exactly: `O` = `/organizations/{org_id}/offers` (org offer collection), `C` = `/applications/{application_id}/offers` (candidate scope), `R` = `/offers/{offer_id}` (offer root: read/edit/actions), `H` = `/hires/{hire_id}`, `Hs` = `/organizations/{org_id}/hires`, and `T` = `/organizations/{org_id}/onboarding-templates`. OpenAPI documents response schemas and common errors for all 26 operations.

### Step 7g — offers (12 routes)

| Method | Route | Contract |
|---|---|---|
| GET | `O` | Bounded org-scoped offer page; application/job/status filters; newest/oldest/amount ordering |
| POST | `/organizations/{org_id}/jobs/{job_id}/applications/{application_id}/offers` | Create one strict draft offer (201) |
| GET | `R` | Employer read with joined application/job data (owner/admin/member; drafts included) |
| PATCH | `R` | Draft-only edit; on `sent`/`countered`, only `expires_on` may move (`409 OFFER_FROZEN` otherwise) |
| POST | `R/send` | Draft → sent; stage → `offered` + stage event |
| POST | `R/withdraw` | Sent → withdrawn; stage `offered` → `interview` |
| GET | `C` | Candidate-side offers for one of their applications (list; drafts excluded — G3) |
| GET | `C/{offer_id}` | Candidate-side single offer detail (`404` on drafts — G3) |
| GET | `/offers/mine` | All of the seeker's received offers across applications (drafts excluded — G2) |
| POST | `R/accept` | Candidate accepts; stage stays `offered` |
| POST | `R/decline` | Candidate declines with a platform decline reason |
| GET | `/offer-decline-reasons` | Active platform decline reasons (code/label only) |

`POST` `send`/`withdraw`/`accept`/`decline` declare the existing empty strict body (`JobAction`, `extra="forbid"`), so a smuggled body field is `422`, never silently ignored.

### Step 7h — hires and onboarding (14 routes)

| Method | Route | Contract |
|---|---|---|
| POST | `R/hire` | Create the hire from an accepted offer; stage `offered` → `hired` |
| GET | `Hs` | Bounded hire page; status filters; newest/oldest/start-date ordering |
| GET | `H` | Hire read with derived candidate name/email |
| PATCH | `H` | Status/department/manager/owner/notes transitions |
| GET | `H/onboarding-items` | Copied checklist items ordered by `display_order` |
| PATCH | `H/onboarding-items/{item_id}` | Owner and/or `done` on one checklist item |
| POST | `H/documents` | Attach a ready org document (201, request `required` flag) |
| GET | `H/documents` | Hire's documents with safe file names and readiness flags |
| PATCH | `/documents/{document_id}` | Expiry-only on requested, status-only after receipt |
| POST | `/documents/{document_id}/download` | Short-lived signed download URL (no audit) |
| GET | `T` | Org onboarding templates (soft-delete filtered) |
| POST | `T` | Create a template (201) |
| GET | `T/{template_id}` | Template with ordered items |
| PATCH | `T/{template_id}` | Name/description edit; `items` is a full replace-set |

There is **no delete route for templates** (D9: no delete endpoints in this step) — the earlier `DELETE T/{template_id}` row was wrong; soft-delete columns exist only for future use.

Pagination follows the existing `items`, `total`, `limit`, `offset`, `has_more` pattern (default 20, maximum 100). `q` is a literal, case-insensitive, wildcard-escaped substring search. Amounts are `Decimal` (no floats), money columns are numeric and constrained `>= 0`, and `expires_on >= offered_at`.

## Offer lifecycle

- Statuses: `draft → sent → accepted | declined | expired | withdrawn`, with `countered` kept for schema compatibility but **unsettable** (D4: the counter endpoint is deferred to the messaging step). `JOB_OFFER_TRANSITIONS` enforces the graph; transitions are validated in service before any write.
- One live offer per application (D10): the partial unique index `job_offers_live_unique` covers `draft|sent|countered`; a second live offer answers `409 OFFER_EXISTS` (`IntegrityError` handled, no 500).
- **PATCH** (D3): drafts edit every field; `sent`/`countered` only move `expires_on`; terminal rows are `409 OFFER_NOT_EDITABLE`.
- **Send** requires stage `interview` and a non-past expiry; it writes the offer, the stage move (`interview → offered` with a stage event) and the audit atomically in one transaction. Stage moves use the pipeline's existing `job_application_service.move_stage`.
- **Withdraw** is employer-side, reverts `offered → interview`; expiry does not revert the stage (D11: only withdraw does).
- **Accept/decline** are candidate-side: ownership-first lookup (`404` for an offer outside your applications), then `require_seeker` (`403`), terminal application → `409 APPLICATION_READ_ONLY`, wrong status → `409 OFFER_INVALID_STATE`. Accept records `responded_at`; decline stores `decline_reason_id` and rejects unknown/inactive reasons with the field-located `422` (D5). Decline reasons are platform-seeded (`accepted_another_offer`, `compensation`, `role_fit`, `location`, `other`), inserted idempotently by `scripts/bootstrap_decline_reasons.py` (also run by `scripts/seed_dev.py`).
- **Lazy expiry** (7f pattern): any org/candidate read sweeps that scope first, commits expired rows, refreshes, then reads. `expires_on < now()` on `sent`/`countered` → `expired`, `responded_at = now()`, audit `offer_expired` with `actor_id = None`.
- Amounts, notes, signed URLs and candidate email addresses never appear in audit metadata; no email or notification is sent anywhere in 7g/7h.

## Hire lifecycle

- Hire creation (D12) requires an offer in `accepted`; otherwise `409 OFFER_NOT_ACCEPTED`. The payload may supply `template_id`, `start_date`, `department`, `manager_id`, `owner_id`; missing fields default: template copy from the org's default template (or no checklist), `start_date = offer.expires_on`, department from the job's department, owner = current user. An existing hire answers `409 HIRE_EXISTS` before any stage/state check; reference validation (`422`) runs before state checks so a bad `template_id` never masks as `409`.
- Statuses (D14): `pending_onboarding → onboarding | active | no_show | cancelled`, `onboarding → active | no_show | cancelled`, `active → cancelled`, terminal otherwise; illegal moves are `409 HIRE_INVALID_STATE`. A status change audits every time, even a no-op transition.
- **Onboarding checklist**: items are copied from the template at hire creation (display order preserved, `owner_id = NULL`, `due_on = start_date + offset_days`, null-safe). There is no item-create endpoint; the template is the only authoring surface. Item PATCH may set `owner_id` (active non-viewer member) and/or `done` (audited only when `done` flips). Owner-type references use the new `organization_service.require_owner_ref`: active member **and** not a viewer, else field-located `422` ("… cannot be a viewer.").
- **Documents** (D13): employer uploads an existing ready, clean, undeleted org file (`require_org_attachment` → `422` for foreign/missing file references, `409 FILE_NOT_READY` otherwise). `requested → received → verified | rejected`, `received → expired`, `verified | rejected → expired` (`DOCUMENT_TRANSITIONS`); expiry-only fields on `requested`, status-only afterwards. Cross-org document IDs are `404`. Download reuses the generic short-lived signed URL and is **not** audited (7c file contract); no delete endpoints exist (D9). `file_service.delete_file` now detaches `JobOffer.document_file_id` and `HireDocument.file_id` so file deletion is never blocked by these FKs.
- **Templates**: org-owned, soft-deleted (`deleted_at`), default templates not filtered out (D6), `is_platform` column exists but is always false — platform template seeding is deferred (15p). `PATCH items` is a full replace-set (insert new, update existing by id, delete absent). A duplicate nonblank name is `409 ONBOARDING_TEMPLATE_EXISTS`.

## Permissions and security

All reads and writes require an active member of an active employer/startup organization with the compatible global role; **only owner/admin may send/withdraw/hire** (`writable()`), while candidate accept/decline uses `require_seeker` and never `writable()`. Read routes need membership only, so ordinary members keep offer visibility (unlike pipeline writes).

| Action | Owner/admin | Member | Viewer / outsider |
|---|---|---|---|
| Offer list/detail/create/patch/send/withdraw | Yes | Read-only (403 on writes) | 403 org, or 404 bare-ID |
| Offer accept/decline | Own applications as seeker | Own applications as seeker | 403 wrong role |
| Hire create/patch, documents, templates | Yes | Read-only | 403 org, or 404 bare-ID |
| Onboarding item PATCH | Yes | Yes (checklist work) | 403 org |

Security contracts carried over unchanged: cross-org IDs on bare routes are `404` ("Offer not found." etc.), foreign org on an org-prefixed route is `403`, wrong role is `403`, cross-org payload references are field-located `422`, and server-controlled fields smuggled into strict bodies are `422`. Own rate-limit keys `job_offer_read` (120/min) and `job_offer_write` (30/60 s), plus `hire_read`/`hire_write` (120/min). Offer and hire-letter file routes use the existing `FileRoute` (32 KiB default) and never bypass `enforce_limit`. Lazy expiry runs on every org/candidate offer read; every mutating route (except downloads) writes an audit row.

## Schema and migration

- `0042_step7g_offers`: `offer_decline_reasons` first (FK order), then `job_offers` (FKs to applications/users/reasons/files, CHECKs for money `>= 0`, equity `0–100`, upper-cased currency, status set, `decline_reason_id` NULL-or-`declined`), indexes `job_offers_application_idx`, `job_offers_status_idx`, partial unique `job_offers_live_unique`. No `responded_at` CHECK (lazy expiry must be able to stamp it on read). `downgrade` drops `job_offers` then `offer_decline_reasons`.
- `0043_step7h_hires`: `hires` (FK `application_id` RESTRICT, unique `hires_application_key`, department/status CHECKs), `onboarding_templates` (org nullable for platform rows, `deleted_at`), `onboarding_template_items`, `hire_onboarding_items`, `hire_documents`; indexes `hires_org_idx`, `hires_org_start_idx`, `hire_documents_file_idx`. Reverse-order downgrade.
- Approved differences from `database/schema.sql`: named single-column indexes instead of inline `UNIQUE` on `hires.application_id`; `onboarding_templates.organization_id` nullable for the deferred platform rows; added CHECK/unique constraints above; `department` typed via the existing `Department` enum in the model while migrations stay text + CHECK (matching prior Step 7 revisions).

## Verification recorded in this session

- `ruff check .` → all checks passed; `mypy app` → success (264 files).
- SQLite suite: `1475 passed, 11 skipped, 1 failed` — the single failure is `test_applicant_wiring.py::test_7d_seed_idempotent_and_does_not_overwrite_or_resurrect`, **pre-existing on the base commit** (verified by stashing this work and re-running on `35b591e0`).
- New tests: `backend/app/tests/test_offers.py` (13) and `backend/app/tests/test_hires.py` (7) — lifecycle, validation, 401/403/404 wrong-role/org, cross-org references, mass-assignment, rate-limit paths, lazy expiry, file attach/detach/download, template replace-set, checklist copy — all green on SQLite **and on PostgreSQL** (20/20).
- PostgreSQL via Docker Compose was **not available in this sandbox** (`docker` missing); the equivalent cycle ran against a real PostgreSQL 16 started from the `pgserver` PyPI package: `alembic upgrade head` (43 revisions) → `downgrade -1` → `upgrade head`, plus a bonus `downgrade -1` twice (exercising 0042's downgrade) → `upgrade head` → `current = 0043_step7h_hires (head)`. `scripts/bootstrap_decline_reasons.py` inserted 5 rows, then 0 on re-run (idempotent).
- Frontend: not started (deferred with the rest of the Step 7 frontend).

## Deferred / stopping point

- Counter/revision negotiation endpoint and messaging (D4, Step 11); `countered` stays schema-only.
- Platform-seeded decline reasons are in place, but platform onboarding-template seeding and `is_platform` usage wait for 15p.
- Offer compare (D7) and candidate-side offer-letter download (D8) are frontend concerns; employer downloads reuse the generic file download.
- No offer/hire delete endpoints (D9); template deletion is soft only.
- Frontend wiring for 7a–7h, the B-phase of this step, and any commit/push.
