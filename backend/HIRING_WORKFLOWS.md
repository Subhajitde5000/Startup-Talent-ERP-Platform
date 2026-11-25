# Steps 7f–7h — backend hiring workflows

Backend only. Phase B/frontend pages, notifications/delivery, payroll, messaging,
AI, analytics and later hiring substeps are not implemented by this change.
The existing 7e implementation is documented separately in `SCORECARDS.md`.

**Acceptance status:** implementation and supplemental verification are recorded
below; the required Docker Compose PostgreSQL acceptance gate is still blocked
because this workspace has no Docker/Compose executable or container runtime.
Native PostgreSQL is not a waiver. The 7e–7h A progress boxes remain unchecked.

## Structure and migrations

- `app/models/hiring_workflow.py`: eleven workflow tables, scoped to existing
  applications/organizations/users/files; no parallel identity or storage system.
- `app/schemas/hiring_workflow.py`: extra-forbidden commands, separate staff and
  applicant offer reads, bounded metadata and lists, exact-money fields.
- `app/services/interview_service.py`: scheduling, panel grants, attendance,
  rescheduling, cancellation and author-private feedback.
- `app/services/job_offer_service.py`: versioned offers, independent approvals,
  send, applicant responses, comparison and domain-scoped document downloads.
- `app/services/onboarding_service.py`: organization templates, accepted-offer
  conversion, copied checklists, manual transitions and private document requests.
- `app/services/hiring_workflow_service.py`: shared audit, version/idempotency,
  applicant scope, private-file checks and application-closure integration.
- Three thin routers expose **48 operations**, in the approved batches:
  interviews 12; offers 12 staff workflow operations plus eight applicant/document
  operations; onboarding 12 template/hire/checklist operations plus four document
  operations.

Reversible, static Alembic revisions after 0040:

| Revision | Tables created |
| --- | --- |
| `0041_step7f_interviews` | `interviews`, `interview_participants`, `interview_feedback` |
| `0042_step7g_job_offers` | `offer_decline_reasons`, `job_offers`, `job_offer_approvals` |
| `0043_step7h_onboarding` | `onboarding_templates`, `onboarding_template_items`, `hires`, `hire_onboarding_items` |
| `0044_step7h_documents` | `hire_documents` |

`database/schema.sql` was read only as a reference, not executed or copied
wholesale. Migrations contain no application-model imports, demo applicants,
offers or hires. Revision 0042 installs the operational decline vocabulary from
`frontend/uploads/jobseeker-applications-offers-design.md`: Accepted another
offer, Compensation, Role, Location or mode, Company, Timing, Other. These have
stable UUIDs and are not the mock analytics counts from the frontend.

Downgrades destroy only the corresponding phase's workflow records, in reverse
FK order. They do not delete Step 4 file objects, jobs, applications, stage
history or scorecards, and do not rewind legitimate historical application stage
changes. Back up before rollback and deploy code matching the schema revision.
Do not run current workflow endpoints against a pre-workflow schema.

## Authorization, privacy and shared mechanics

- Existing active/verified user checks, active employer **or startup** organization,
  compatible non-revoked global roles, and active non-viewer membership apply.
  No viewer/global-admin bypass or candidate access to staff endpoints.
- Existing 7d manager/job-owner/assigned-application scope governs the pipeline
  operations. An invited active hiring member additionally receives access to
  that interview only: read, own attendance and (if an interviewer) own feedback.
  This never grants the underlying 7d profile, resume, scores or stage endpoint.
  Invited observers cannot submit interviewer feedback.
- Hire owners/managers receive onboarding scope without being blocked merely
  because conversion made the application `hired`. Task-only assignees can list
  their own tasks and update only their own status/note, never reassign, change
  due dates, waive, access applicant details or read private hire documents.
- Hire documents require an organization owner/admin or explicit hire owner/
  manager. Merely owning the job, being assigned the application or a checklist
  task does not grant private document access.
- Candidate interview responses expose only that candidate's attendance, not
  panel IDs/names/responses or feedback. Offer reads omit internal authors,
  owners, submission timestamps, approval notes/actors and raw file IDs/keys.
  Comparison checks ownership and sent visibility of **every** selected offer.
- Lists use limit/offset (`20` default, `100` maximum), deterministic ordering,
  totals and `has_more`. Interview filters: status/job/application; staff offers:
  status/application; hires: status. No arbitrary SQL sort/expression input.
- Existing shared actor limits: `APPLICANT_READ_LIMIT=120` and
  `APPLICANT_WRITE_LIMIT=60` per minute. Candidate offer responses/conversion also
  use a sensitive-action budget at the same configured write ceiling; file
  downloads retain the Step 4 signing limit. Interview attendance/feedback share
  the same hiring budgets. Body metadata is streaming-limited to 64 KiB.
- Sensitive creates use request UUIDs plus canonical fingerprints. Reusing a key
  for different input returns `409 IDEMPOTENCY_CONFLICT`. Hire conversion uses
  the accepted offer/application uniqueness and an input fingerprint; retries
  must preserve template/ownership/department choices, not silently change them.
- Mutating commands use `expected_version`; stale changes return
  `409 STALE_VERSION`. Identical safe retries return existing state without audit,
  timestamp or version churn. Terms are assigned explicitly, never from an
  unrestricted input dictionary. Separate schemas forbid server-owned fields.
- Lock order: job, application, workflow row (hire before task/document). User
  rows are locked in UUID order before interview overlap checks, serializing
  scheduling across different jobs/organizations. Locked rows and domain grants
  are re-read after waiting. DB uniqueness/checks supplement service validation.
- Generic activity entries commit atomically with mutations. Feedback, identity,
  salaries, meeting URLs, counters, decline text and document contents are not
  copied into activity summaries/data. Automatic cancellation of a still-blind
  applicant's draft offer also anonymizes the candidate actor in organization
  activity; the generic audit must not become an identity-reveal side channel.
  Signing a private document is audited.

Existing 7c withdrawal and 7d rejection now cancel scheduled/confirmed interviews
and withdraw draft/sent/countered offers in the same application transaction.
Accepted offer history is retained, but a subsequently withdrawn/rejected
application cannot be converted into a hire. Candidate responses and legitimate
onboarding remain possible after a vacancy is closed/archived; this deliberately
does not reuse the closed-job write ban for those workflows. New schedules,
reschedules, draft edits, submissions and sends still respect that write ban.

## 7f — interviews

Staff prefix: `/api/v1/organizations/{org_id}/interviews`.

| Method | Suffix | Purpose |
| --- | --- | --- |
| POST | (root) | Schedule with `application_id`, `request_id`, panel and schedule |
| GET | (root) | Paginated scoped interview list |
| GET | `/{id}` | Scoped interview detail |
| PATCH | `/{id}` | Replace schedule fields and reset attendance |
| PUT | `/{id}/participants` | Replace panel, retaining the candidate |
| POST | `/{id}/transitions` | `cancel`, `complete`, `no_show` |
| PUT | `/{id}/attendance/me` | Own `accepted`, `declined`, `tentative` response |
| GET | `/{id}/feedback` | Paginated **own-author** feedback only |
| PUT | `/{id}/feedback/me` | Upsert own completed-interview feedback |

Candidate prefix `/api/v1/interviews`: GET list, GET `/{id}` and PUT
`/{id}/attendance/me` (three operations).

Schedule example:

```json
{
  "application_id": "<application UUID>",
  "request_id": "<new request UUID>",
  "round_name": "Technical discussion",
  "format": "video",
  "scheduled_at": "2027-02-10T14:00:00+05:30",
  "duration_min": 45,
  "meeting_url": "https://meet.example.test/room",
  "participants": [{"user_id": "<active hiring member UUID>", "side": "interviewer"}]
}
```

Aware timestamps are required and emitted in UTC. Duration is a strict integer
5–480 minutes. Meeting links must be HTTPS without embedded credentials. Up to
ten distinct staff participants, including at least one interviewer; the
candidate is inserted server-side and cannot be supplied as a panel member.
Overlapping live interviews reserve the slot even for tentative/declined
attendance until the interview is cancelled or rescheduled; async format does
not bypass the scheduling conflict check.

Creating an interview advances an eligible application to `interview` and
permanently reveals blind identity using the existing history/audit policy.
Already offered or terminal applications cannot be moved backward by scheduling.
Rescheduling resets all attendance; panel replacement resets the interview to
scheduled. Every participant accepting confirms it. Only live interviews can be
rescheduled/cancelled/completed/no-show; completion/no-show require the scheduled
end to have passed. Closed vacancies can still have pending interviews cancelled
or attendance recorded. Feedback requires completion and a nonterminal
application; it is separate from 7e numeric rubric ratings and never aggregated
or disclosed to another reviewer, owner/admin or candidate.

## 7g — offers

Staff prefix: `/api/v1/organizations/{org_id}/job-offers`.

| Method | Suffix | Purpose |
| --- | --- | --- |
| POST / GET | (root) | Create draft / list scoped versions |
| GET / PATCH / DELETE | `/{id}` | Read / edit unsubmitted terms / archive unsubmitted draft |
| POST | `/{id}/submit` | Freeze terms and assign 1–5 independent approvers |
| GET | `/{id}/approvals` | Paginated approval records |
| PUT | `/{id}/approvals/me` | Own assigned approve/reject decision |
| POST | `/{id}/send` | Send only after all approvals |
| POST | `/{id}/withdraw` | Withdraw an actionable offer |
| POST | `/{id}/revisions` | Supersede with a new draft version |
| POST | `/{id}/expire` | Persist overdue sent/countered expiry |
| POST | `/{id}/document-download` | Domain-scoped clean document signing |

Applicant prefix `/api/v1/job-offers`: GET root, GET `/compare?offer_ids=...`
(two to five distinct IDs), GET `/decline-reasons`, GET `/{id}`, POST
`/{id}/respond`, POST `/{id}/counter`, POST `/{id}/document-download`.

Draft terms include required positive `base_salary`, `title`, `start_date`,
`expires_on`; optional nonnegative `bonus_amount`, `joining_bonus`, `equity_pct`
(0–100), `document_file_id`; currency defaults INR, salary period annual/monthly.
Money/equity accept decimal strings or integers, never floats or booleans, and
use NUMERIC storage/Decimal responses. Expiry is before start date; new terms
cannot already be expired and start in the past. Creation requires a shortlisted,
interview or offered application. There is one live nonsuperseded offer per
application, with monotonically increasing immutable `terms_version`.

Submission freezes terms/document/job snapshot. Approvers must be distinct
active owner/admin hiring accounts, excluding both author and submitter. Each
decision is immutable. Sending requires all approvals and revalidates approver
eligibility and document readiness. Changes (including extending expiry) require
a new draft revision and fresh approvals, not editing an approved/sent version.
Revisions retain sent historical versions and mark supersession explicitly.

Sending advances the application to `offered` and reveals blind identity.
Acceptance does **not** create a hire or move it to `hired`; conversion is 7h.
Countering preserves employer terms and records one applicant note (up to 500
characters) per version; a further negotiation round requires a new employer version. This is
not a messaging system or automated negotiation.

`expires_on` is inclusive through that UTC calendar day. Reads report overdue
sent/countered offers as expired without write-on-GET; acceptance/countering
always enforce expiry synchronously. The explicit expire action persists it.
No scheduler/delivery infrastructure is introduced.

Decline reasons and accompanying text are optional. Providing either requires
`share_decline_reason: true`; otherwise validation rejects the disclosure.
No hidden private reason is collected. Accept rejects decline fields entirely.
An example response is `{"expected_version": 4, "action": "accept"}`.

Offer documents must be the attaching actor's own ready, clean **personal**
legal/document files. Organization-owned files are rejected because the generic
file service grants org viewers broader access. Candidate signing is granted
only through their own sent/historical offer; draft documents remain invisible.
Signatures are short-lived Step 4 URLs; production R2 was not exercised here.

## 7h — hires, checklist and documents

Prefix `/api/v1/organizations/{org_id}`:

| Method | Path | Purpose |
| --- | --- | --- |
| POST / GET | `/onboarding-templates` | Owner/admin create / member list |
| GET / PUT / DELETE | `/onboarding-templates/{id}` | Read / replace / archive |
| POST / GET | `/hires` | Convert accepted offer / list scoped hires |
| GET / PATCH | `/hires/{id}` | Detail / explicit start or ownership changes |
| POST | `/hires/{id}/transitions` | `onboard`, `activate`, `no_show`, `cancel` |
| GET | `/hires/{id}/checklist` | Paginated authorized checklist |
| PATCH | `/hires/{id}/checklist/{task_id}` | Manager or limited own-assignee update |
| GET / POST | `/hires/{id}/documents` | Private list / idempotent document request |
| PATCH | `/hires/{id}/documents/{document_id}` | Attach / verify / reject / expire |
| POST | `/hires/{id}/documents/{document_id}/download` | Explicit private signing grant |

Templates contain at most 50 ordered items: section/title, optional `owner_role`
(`owner` or `manager`), due offset −365..365 days. Conversion copies titles,
sections, resolved owners and calculated dates into independent hire tasks.
Template edits/archive never rewrite those copies. Updating hire start/owners
also does not silently rewrite historical copied task assignments/dates.

A current accepted offer on an eligible `offered` application is required.
Application and offer are each uniquely convertible once. Conversion snapshots
the accepted start date, creates `pending_onboarding`, and writes the `hired`
application transition exactly once. There is no automatic employee/payroll
account creation. `onboard` begins onboarding. `activate` is manual, only from
onboarding, on/after start and with every checklist item done or explicitly
waived. Only hiring managers/hire or job owners may transition; no-show cannot
be marked before start. Active/no-show/cancelled onboarding is read-only.
Cancelling a hire retains the accepted offer/application history.

Document requests require name, purpose and retention text (plain-language
policy, **not** an invented statutory retention period), optional due date and
request UUID. Attach accepts only the caller's own clean ready personal legal/
document file on a requested/rejected request. Review requires received status
and rechecks file readiness. Verification/rejection record actor/time/reason;
rejection requires a reason. Expired/rejected documents cannot be downloaded
through the hire grant. Raw storage identifiers are never returned. Purpose,
retention, erasure and employment-document legal obligations still need product/
legal review; free-text policy does not implement an automated purge schedule.

## Reference-schema differences and rationale

- Add retry keys/fingerprints, positive optimistic versions, bounded text,
  lifecycle checks and indexes to support real API retries/concurrent writes.
  UUID primary keys are retained; interview participants retain the reference
  composite interview/user key, not a synthetic duplicate identity.
- `rescheduled` is an action, not a stranded terminal status: the same interview
  is scheduled again, versioned and audited. Participant timestamps and unique
  author feedback support safe updates; feedback author deletion SET NULL does
  not transfer private text to another user.
- Add the previously proposed `job_offer_approvals` table because the reference
  offer has no usable multiple-approver structure. Add submission/sent/
  supersession markers, immutable snapshot/version linkage, salary period and
  bounded decline/counter text. Use RESTRICT for referenced private files and
  prior offer versions; do not silently delete evidence on file/offer removal.
- Require complete offer dates/positive salary instead of nullable incomplete
  sent terms. Default INR and exact decimals follow the existing job schemas.
- Organization-only onboarding templates are soft-archived; no platform-template
  mutation or speculative platform seed/admin API. Resolved task owners are
  active compatible members; copied due dates are concrete.
- Accepted offers are required and unique for hires, not nullable SET NULL.
  Hire documents add review metadata, version/retry fields and required purpose/
  retention; references to attached files use RESTRICT rather than SET NULL.
- Existing 7d scope accepts an internal already-authorized member to avoid
  charging its actor guard twice during workflow lookups; HTTP callers cannot
  supply that argument. Existing withdrawal/rejection receive only the atomic
  cancellation hook. No unrelated 7a–7d behavior or frontend code is refactored.

## Verification and commands

Completed supplemental checks:

| Check | Result |
| --- | --- |
| Final 7f–7h workflow contracts, SQLite | **62 passed / 7 PostgreSQL-only skips**, 101.52 s |
| Final 7f–7h workflow contracts, native PostgreSQL | **69 passed / no skips**, 223.09 s |
| Broader affected hiring regression, SQLite | **356 passed / 14 PostgreSQL-only skips**, 393.59 s |
| Broader affected hiring regression, native PostgreSQL | **370 passed / no skips**, 948.29 s |
| Actual migrated PostgreSQL API smoke | Schedule → independent approval/send/accept → copied checklist/hire → document request: pass |
| Scoped model/migrated-schema comparison | No differences, including types/defaults/indexes/FKs |
| Populated head → downgrade one → head | Pass; earlier phase records preserved, only document metadata removed |
| Populated 0044 → 0040 → head | Pass; jobs/applications/history/scorecards preserved |
| Ruff / 20 new-module format checks / mypy app | Pass; mypy checked 259 files |
| Diff whitespace check | Pass |
| Required Docker Compose PostgreSQL gate | **Not run — runtime unavailable; acceptance remains open** |

The broader run covered `test_hiring_workflow.py`, `test_scorecards.py`,
`test_applicant_pipeline.py`, `test_job_applications.py` and `test_jobs.py`.
It completed before the last focused hardening changes; the final 69-case
workflow rerun includes the grant-revocation races, calendar overflow rollback
and blind-candidate audit side-channel regression. Counts are separate runs,
not additive counts of unique tests. No whole-repository test pass is claimed.

Coverage includes authentication/role/object/org denial, startup-compatible
roles, strict nested inputs and mass assignment, participant overlap and
attendance, author-private feedback, frozen terms and independent/revoked
approvers, candidate IDOR/compare, counters/expiry/revisions, response after
vacancy closure, accepted-history preservation after withdrawal, unique
conversion/copy isolation, manual activation/assignee restrictions, actual Step
4 clean-file processing with fake storage/scanner, signing/privacy/revalidation,
rate/body limits and PostgreSQL concurrency/lock-wait grant rechecks. Production
R2, email delivery and frontend/browser flows were not exercised.

Native PostgreSQL checks used **two dedicated disposable databases**, one for
metadata-fixture tests and another for actual Alembic migrations. Never run the
destructive test fixtures against a preview/live database. Sandbox-only logs:
`/tmp/forma-7fgh-hiring-{sqlite,pg}.log`, `/tmp/forma-7fgh-final-{sqlite,pg}.log`,
`/tmp/forma-7fgh-final-migrations.log`; the smoke harness was
`/tmp/forma-7fgh-migrated-smoke.py`. These `/tmp` files are not repository
artifacts or a replacement for the reproducible API tests/migrations.

Local quick run, from `backend/` with dependencies installed:

```sh
pytest -q app/tests/test_hiring_workflow.py
ruff check app alembic
mypy app
```

Required remaining Compose verification, on a Docker-capable machine (adapt
credentials/ports to the local Compose configuration):

```sh
cd backend
docker compose up -d postgres redis mailpit
# Dedicated scratch DBs; never point drop_all/create_all fixtures at the app DB.
docker compose exec -T postgres createdb -U forma forma_hiring_contracts
docker compose exec -T postgres createdb -U forma forma_hiring_migrations
FORMA_TEST_DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_hiring_contracts \
  pytest -q app/tests/test_hiring_workflow.py app/tests/test_scorecards.py \
  app/tests/test_applicant_pipeline.py app/tests/test_job_applications.py app/tests/test_jobs.py
export DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma_hiring_migrations
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

Also verify populated rollback preservation and the individual phase boundaries
before marking the gate complete. Migrations and tests must use separate scratch
databases; a passing native run must not be relabeled as a Compose run.

## Approved 7e–7h frontend wiring follow-up

The subsequently approved frontend batch is documented in [`frontend/HIRING_WORKFLOWS.md`](../frontend/HIRING_WORKFLOWS.md). It adds blind-safe presentation/capability fields, supported interview views/search/date filters and submitted-offer filtering, plus seven optional actual contractual term columns in `0045_step7g_offer_terms`. Candidate panel/feedback privacy and the original write boundaries are unchanged. The existing development-only seed now has a separately exact-environment-guarded, UUID-linked, fill-only 7e–7h helper. New tests cover filtering, capabilities, term persistence/validation, attachment preservation and seed guard/edit preservation. Native PG migration verification remains supplemental, not a Docker Compose waiver.
