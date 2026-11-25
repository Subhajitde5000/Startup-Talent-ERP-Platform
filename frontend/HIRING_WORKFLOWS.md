# Steps 7e–7h frontend wiring

## Scope

Only the approved employer/jobseeker hiring surfaces are connected:

- **7e:** job comparison, the applicant evaluation panel, comparison entrypoints, and the Scorecards template category.
- **7f:** employer/jobseeker interview lists and detail dialogs, the existing applicant scheduling button and interview tab, scheduling/rescheduling/panel replacement, attendance, outcomes and permitted feedback.
- **7g:** employer and candidate offer lists/details, draft/edit/independent approval/send/revision/withdraw/expiry, private document attachment/download, candidate accept/decline/counter and offer comparison. Applicant offers link through the existing organization context.
- **7h:** hires list/detail, accepted-offer conversion, copied onboarding checklists, assignments/dates/status/notes, private document requests/attachments/reviews/downloads, and the Onboarding template category.

The existing shells, cards, controls and organization workspace are reused. The optional workspace active-navigation prop preserves the default for existing jobs pages. New workflow modules use `lib/api/client.ts`; request, response and query contracts reference the generated `schema.d.ts`, generated from the running backend with `npm run gen:api`. There is no second HTTP/auth client. Resources are abortable and keyed by user/organization/record/filter/page. Server capabilities gate record-specific actions; the API remains the authorization boundary. Conflict/error messages and field errors are surfaced; closing/reopening a dialog or refreshing the record loads the current version.

### Approved shared auth change

Access and rotating refresh tokens now exist **only in module memory**. Legacy `forma.access_token`/`forma.refresh_token` entries in both localStorage and sessionStorage are removed, never restored. Single-flight refresh and the existing error envelope remain in the single shared client. The login screen no longer promises persistent sign-in.

**Reloading or opening a new tab requires login.** This is the explicitly approved tradeoff, not a cookie-session redesign. Existing shared-client tests have been updated to assert non-persistence, including the data-room binary transport regression tests.

## Scoped backend additions

- Blind-safe applicant labels, interview company names, hire job references and object-level capability flags. Candidate panel/feedback privacy is unchanged.
- Server interview views (`upcoming`, `past`, `needs_feedback`, `needs_action`), escaped title/round/company search and timezone-aware inclusive-start/exclusive-end filters; submitted/unsubmitted staff offer filter. Pagination remains server-side.
- Nullable persisted offer fields: payment, bonus, probation, notice, vesting, exercise-price and joining-bonus terms. Revision **0045_step7g_offer_terms** adds only these columns; no contractual defaults or demo data.
- Editing terms without `document_file_id` preserves the existing attachment; explicit null removes it. A revision requires a new explicit attachment rather than silently borrowing another author's private file.

Missing contractual values display **Not provided**. Candidate notice period is not invented or added to the unrelated 7c profile. Money is sent as decimal strings; equity is a percentage, never an estimated cash valuation.

## Development samples and demo boundaries

Use the existing script, against a disposable development database:

```bash
cd backend
# Configure DATABASE_URL for your development PostgreSQL database first.
ENVIRONMENT=development ../.venv/bin/alembic upgrade head
ENVIRONMENT=development FILE_SCANNER=dev_clean ../.venv/bin/python scripts/seed_dev.py
```

`seed_step7eh_workflows` independently refuses every environment except the exact string `development`. It inserts stable UUID-linked synthetic jobs/applications, scorecard templates/copies/ratings, upcoming/completed interviews, draft/sent/accepted offers with sample approval history, onboarding templates, a hire/checklist and a purpose/retention-bound document request. Existing rows, edits, decisions, archived records and copied snapshots are not reset. Dates are computed only when inserting a new record, not advanced on every seed. Guard/idempotence/edit-preservation tests cover the helper. Development-only clean scanning must never be enabled in production.

Supported examples replace the old page-local/store records; unsupported fictional metrics/checks are deliberately not reproduced. Proven-unused employer `interviews`, `offers`, `hireKpis`, `scorecardCriteria`, `hires`, the old scorecard template entry, and jobseeker `interviews`/`offers` exports were removed. **Shared stores remain** because unrelated pages still import them.

Remaining demos are intentional: employer/jobseeker dashboards and other later-step pages, and other template categories (job posts, pipelines, screening, interview guides, offer-letter packages, etc.). These categories are not presented as the live Scorecards/Onboarding API. Startup hiring/interview/offer wrappers (7r/7s) are untouched. Old dashboard demo links with `off-1` or similar are not real UUIDs; the wired detail pages reject them rather than map them to another person's record.

ATS/ranking, inferred consensus, practice/AI results, messaging, reminders, background checks, letter generation, e-signing, payroll and fabricated file metadata are not simulated. Where relevant they are omitted or explicitly unavailable.

## Verification

Commands:

```bash
cd frontend
npm ci --no-audit --no-fund
npm run gen:api                     # API_URL defaults to http://127.0.0.1:8000
npm run typecheck
node --test tests/*.test.cjs
npm run lint                       # honest repository-wide result; see known failures below
npm run build

cd ../backend
../.venv/bin/ruff check app scripts/seed_dev.py alembic/versions/0045_step7g_offer_terms.py
../.venv/bin/mypy app
../.venv/bin/pytest -q app/tests/test_hiring_workflow.py app/tests/test_scorecards.py
# Optional supplemental native PostgreSQL contracts, only a disposable test DB:
FORMA_TEST_DATABASE_URL="$DISPOSABLE_TEST_DATABASE_URL" ../.venv/bin/pytest -q app/tests/test_hiring_workflow.py app/tests/test_scorecards.py
```

Never point pytest at the preview/development database: its fixtures drop/recreate tables. Native PostgreSQL does **not** waive the separately required Docker Compose acceptance gate.

Observed results for this wiring batch:

- Shared frontend client tests: **21 passed** (including three new hiring transport tests).
- Final combined SQLite scorecard/workflow contracts: **137 passed, 9 PostgreSQL-only skips**.
- Combined native PostgreSQL contracts: **145 passed**; the final four frontend-extension/seed/attachment contracts separately **4 passed** on PostgreSQL and SQLite after seed-guard hardening (all four are included in the combined SQLite count).
- Backend Ruff and `mypy app` (**259 source files**) pass. Whole legacy seed-script mypy still reports **104 errors outside the new helper**; it has not been refactored as part of this scope.
- Production build, generated client typecheck and affected-file lint pass. Repository-wide lint remains **50 errors / 10 warnings** in unrelated pages; no suppression or unrelated page edits were added. Next's pre-existing build config skips lint/type checks, so those checks are always run separately.
- Native PostgreSQL fresh migration to 0045, populated 0045 → 0044 → 0045 preservation and workflow model/schema parity pass. Rollback necessarily removes the optional terms columns, not offers/hires/interviews/scorecards/documents.

### Logged-in browser checks

Chromium was run against the real Next/API proxy and a separate, actually migrated PostgreSQL preview database (not mocked API responses). Existing development credentials were used; tokens were not written to test reports or browser storage.

Verified:

- Owner interview details/attendance controls, server search empty state, applicant scheduling button with a real create, and refreshed applicant interview list.
- Two-candidate server comparison; private applicant rating write and reread; scorecard/onboarding template creation through forms.
- Offer list/submitted filter, persisted optional term editing; owner submission locks terms; a different assigned admin approves; only then the owner sends.
- Candidate-only participant projection/attendance write; own offer comparison/counter; full reload returns to login; access/refresh keys absent from both browser stores.
- Candidate acceptance followed by accepted-offer hire conversion, a copied template task and explicit onboard transition, also exercised with the production build. Hire checklist status/note update and refreshed progress. Private text-file upload through local signed storage, dev scan, attach and verify; separate admin can read the private hire document surface.
- Viewer blocked from applicant records, unassigned member receives its scoped empty offer list, outsider organization denied/no active workspace. Backend contracts additionally cover IDOR/wrong-role/private-note/approval/document/task-assignee boundaries and stale versions.
- Mobile offer and hire detail at 390px have no horizontal overflow after the existing responsive margin transition settles; checked sessions had no page errors.

Repeated development sign-ins correctly hit the existing login rate limit during test iteration; production limits were not weakened. Browser tooling/binaries, screenshots, build output and test logs were kept out of Git.

## Open gates

Docker/Compose is absent in this environment. Backend **A** acceptance remains unchecked. The known unrelated repository-wide lint and legacy seed type failures remain open. No whole-backend/full-repository green claim, Python 3.12 verification, production storage/email exercise, commit or push is implied by the focused checks above.
