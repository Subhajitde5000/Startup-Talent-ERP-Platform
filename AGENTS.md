# MASTER INSTRUCTIONS: Backend for Startup & Talent ERP Platform (Forma)

Read this fully before doing anything. These are standing rules for the whole project. They are NOT a request to write code now.

## 0. How we work together (most important)

- Do NOT start coding from this file. After reading it, reply only with: (a) a short summary of your understanding, (b) a list of questions or assumptions you need confirmed.
- I will give you tasks one by one. Do exactly the task given, nothing more. No extra features, no unrelated refactors.
- Before each task, briefly state your plan (files to create or change, and why). After each task, list what you changed, how to run and test it, and what is still open.
- If something is ambiguous or risky, ask me. Never guess silently.
- Never invent requirements. Derive entities, fields and flows from the existing frontend (Next.js pages and design .md files in this repo). If the frontend and the backend design conflict, tell me and propose a fix.
- Work like a senior backend engineer building a real production system, not a demo.

## 1. Product context

- Forma is a Startup & Talent ERP platform. The Next.js frontend is complete; we are now building the backend (database + API).
- Roles: startup member/founder, mentor, investor, job seeker, employer, admin. Admin console runs on its own subdomain with a stricter security policy.
- Planned cross-role feature: a Community discussion space where all roles can communicate.
- Think about real-world use: many users, mixed roles, private data (profiles, applications, investor and startup information), messaging, and growth over time.

## 2. Tech stack (fixed unless I approve a change)

- Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic, PostgreSQL
- Async driver: asyncpg. Config via pydantic-settings and `.env` (never hard-code secrets)
- Tests: pytest, pytest-asyncio, httpx
- Lint/format/type-check: ruff, mypy (or pyright)
- Local dev: Docker Compose (Postgres, and later Redis if needed)

## 3. Project structure and code style

```
backend/
  app/
    main.py
    core/        # config, security, logging, exceptions, dependencies
    db/          # engine, session, base, migrations helpers
    models/      # SQLAlchemy models
    schemas/     # Pydantic request/response models
    routers/     # thin HTTP layer, grouped by domain/role
    services/    # business logic (no HTTP code here)
    repositories/# optional: DB access layer
    tests/
  alembic/
  docker-compose.yml
  .env.example
```

- Routers stay thin: validate input, call a service, return a schema. Business logic lives in services.
- Full type hints, small focused functions, clear names, docstrings only where they add value.
- No dead code, no commented-out code, no TODO left without telling me.
- Prefer boring, well-known patterns over clever ones.

## 4. Security (treat as mandatory, not optional)

- Passwords: hash with argon2 (or bcrypt with a proper cost). Never store or log plain text.
- Auth: short-lived JWT access tokens plus rotating refresh tokens that can be revoked (store hashed refresh tokens server-side). Support logout and "log out everywhere".
- Authorization: deny by default. Role-based access via reusable FastAPI dependencies, PLUS object-level checks (a user can only read or edit what they own or are allowed to see). Always guard against IDOR/BOLA.
- Admin: separate admin auth policy, stricter token lifetime, audit logging of every admin action. Plan for MFA.
- Validate everything with Pydantic. Use strict schemas; never accept raw dicts or mass-assign fields (separate Create/Update/Read schemas, never expose internal fields).
- SQL injection: use the ORM or parameterized queries only. Never build SQL with string formatting.
- Rate limiting and brute-force protection on login, register, password reset, and messaging endpoints.
- CORS: explicit allow-list of frontend origins only. Never `*` with credentials.
- Secrets only via environment variables. Provide `.env.example`; never commit real secrets.
- File uploads (resumes, logos, pitch decks): validate type and size, generate safe names, store outside the DB (S3-compatible storage), use signed URLs, and plan for malware scanning.
- Privacy: collect minimum personal data, never return sensitive fields (password hashes, tokens, internal IDs not needed), mask PII in logs. Design for deletion/export of a user's data.
- Add security headers, request size limits, and safe error messages (no stack traces or internals to clients).
- Email verification and secure password reset (single-use, expiring tokens).
- Keep dependencies pinned and minimal. Flag any known-vulnerable package.

## 5. API design standards

- REST, versioned under `/api/v1`. Consistent plural resource names, correct HTTP methods and status codes.
- Consistent response and error format, for example `{ "error": { "code": "...", "message": "...", "details": ... } }`, with stable machine-readable codes the frontend can rely on.
- Pagination on every list endpoint (cursor-based preferred for feeds like Community; limit/offset acceptable elsewhere), plus filtering and sorting with whitelisted fields.
- Idempotency for sensitive create operations where retries could duplicate data.
- Use `async` correctly: never block the event loop with sync I/O or heavy CPU work.
- Document every endpoint through OpenAPI (summary, description, response models, error responses). The OpenAPI schema should be good enough to generate a typed client for the Next.js frontend.
- Health and readiness endpoints. Request-ID middleware and structured (JSON) logging.
- Avoid N+1 queries; use eager loading deliberately.
- Background work (emails, notifications, indexing) goes through a task queue or background tasks, not inside request handlers.

## 6. Database design standards

- PostgreSQL, normalized to a sensible level (3NF); denormalize only with a stated reason.
- Every table: primary key (UUID, or bigint if I approve), `created_at`, `updated_at`; soft delete (`deleted_at`) where data must be recoverable or auditable.
- Constraints belong in the DB, not only in code: NOT NULL, UNIQUE, CHECK, foreign keys with deliberate ON DELETE behavior.
- Use enums or lookup tables for roles, statuses, and types. Do not use free-text for fixed sets.
- Roles: ask me whether one user can hold several roles before designing the user/role tables. Default assumption: a user has a base account plus separate role-profile tables.
- Add indexes for foreign keys, frequent filters, and sort columns. Use partial or composite indexes where justified. Explain each non-obvious index.
- Every schema change is an Alembic migration: reversible, reviewed, never edited after being applied. Never use `create_all` in production paths.
- Plan for growth: avoid designs that need rewrites at 100k+ users (for example, messages and community posts should be paginated and indexed by time).
- Use transactions properly; keep them short. Handle concurrent updates (optimistic locking where needed).
- Provide seed data scripts for development only, kept separate from migrations.
- Add an audit/activity log table for sensitive actions.

## 7. Testing and quality (definition of done for every task)

A task is done only when ALL of these are true:
1. Code runs, migrations apply cleanly (up and down), lint and type checks pass.
2. Tests exist for the happy path, validation errors, authentication failures, and authorization failures (wrong role and wrong owner).
3. No secrets, debug prints, or hard-coded values.
4. The endpoints appear correctly in OpenAPI docs.
5. You have told me how to run and verify it, and what remains.

## 8. Deployment and operations mindset

- 12-factor config, Dockerfile (multi-stage, non-root user), and a clear separation of dev, staging and production settings.
- Plan for: backups, connection pooling, graceful shutdown, monitoring, and error tracking. Mention them when relevant; do not build them until asked.

## 9. Planned order of work (for reference only, wait for my instruction on each)

1. Project scaffold, config, Docker Compose, database connection
2. Database schema and first migrations (derived from the frontend)
3. Authentication, refresh tokens, role dependencies
4. One role's endpoints end to end (I will choose which)
5. Remaining roles
6. Community discussions and messaging
7. Admin console APIs and audit logging
8. Hardening, load testing, and deployment

## 10. Your first reply to this file

Reply with only:
- A 5 to 8 line summary of what you understood.
- The questions and assumptions you need me to confirm (especially: single vs multiple roles per user, UUID vs integer IDs, file storage provider, email provider, and whether realtime features are needed for messaging).
- Do not write code, create files, or run commands in that reply.
