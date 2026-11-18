# Forma — Startup & Talent ERP Platform

Full-stack app: **Next.js 14** (frontend) + **FastAPI** (backend) + **SQLAlchemy 2.0 async** + **Alembic**.

- `BUILD_PLAN.md` — step-by-step build spec
- `PROGRESS.md` — what's done (Step 3 complete)
- `AGENTS.md` — coding rules and conventions
- `database/` — **reference-only** SQL extracts (never run them; the live schema comes from Alembic)

## Prerequisites

- Python 3.11+ (project targets 3.12)
- Node.js 18+ (tested on 22) with npm
- Optional: Docker (for Postgres / Redis / Mailpit — see step 4)

## 1. Backend (API on port 8000)

```bash
# from the repo root
python3 -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

cd backend
cp .env.example .env                   # optional in dev — defaults already work
alembic upgrade head                   # creates ./forma.db (migrations 0001–0005)
uvicorn app.main:app --reload --port 8000

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Dev defaults (no `.env` needed): SQLite `backend/forma.db`, console email sink, dev JWT secret.
Copy `.env.example` → `.env` to override anything (never commit real secrets).

- Health: <http://localhost:8000/health>
- OpenAPI docs: <http://localhost:8000/docs>

## 2. Frontend (port 3000)

Second terminal:

```bash
cd frontend
npm ci                            # or: npm install
npm run dev
```

Open <http://localhost:3000>. The Next server proxies `/api/v1/*` to the backend
(`NEXT_PUBLIC_API_PROXY_TARGET`, default `http://127.0.0.1:8000`) — no other
frontend env is required for local dev.

## 3. Database

- **Dev default:** SQLite at `backend/forma.db`, managed only by Alembic:

  ```bash
  cd backend
  alembic upgrade head      # apply
  alembic downgrade -1      # revert one step
  ```

- `database/schema.sql` (full baseline) and `database/auth_schema.sql`
  (Step 2 extract) are **documentation references** — the backend never runs them.
- Real schema history: `backend/alembic/versions/` (0001 → 0005).

## 4. Optional production-shaped services

```bash
cd backend
docker compose up -d        # Postgres 16, Redis 7, Mailpit
```

Then in `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://forma:forma@localhost:5432/forma
REDIS_URL=redis://localhost:6379/0
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
```

Mailpit UI: <http://localhost:8025>. Without Redis the rate limiter falls back
to in-process memory (fine for dev/tests, not multi-instance production).

## 5. Seed demo data (dev only)

```bash
cd backend
ENVIRONMENT=dev python scripts/seed_dev.py
```

Idempotent; refuses to run outside `ENVIRONMENT=dev`. Creates demo accounts —
password for all of them: **`Forma-Dev-2026!`**

| Email | Role |
| --- | --- |
| `founder@forma.dev` | startup owner (org: Northstar Labs) |
| `employer@forma.dev` | employer (org: Northstar Health) |
| `investor@forma.dev` | investor (org: Zenith Capital) |
| `jobseeker@forma.dev` | job seeker (talent profile + skills) |
| `mentor@forma.dev` | mentor (mentor profile) |
| `pending@forma.dev` | unverified user (verify-email flow) |

## 6. Tests and quality gates

```bash
# backend (venv activated, from backend/)
pytest                     # 91 tests, SQLite in-memory, no external services
python -m ruff check .
python -m mypy app

# frontend (from frontend/)
npm run lint               # full repo (exit code honest)
npm run typecheck
npm run build
```

## 7. Regenerating API types

With the backend running, from `frontend/`:

```bash
npm run gen:api           # regenerates lib/api/schema.d.ts from /openapi.json
```

## Project layout

```
backend/          FastAPI app, Alembic migrations, pytest suite, dev seed
  app/{core,db,models,schemas,services,routers,tests}
  alembic/versions/      0001_foundation … 0005_step3b_orgs_profiles
  scripts/seed_dev.py    dev-only seed (never a migration)
frontend/         Next.js app (App Router)
  app/                   routes (role workspaces, onboarding, settings …)
  components/  lib/      UI kit + typed API client (lib/api/client.ts)
database/         reference SQL (schema.sql, auth_schema.sql) — never executed
docs/             admin user manual
reports/          per-role frontend audits
```
