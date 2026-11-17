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
