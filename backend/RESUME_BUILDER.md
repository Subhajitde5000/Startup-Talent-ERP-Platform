# Resume Builder, ATS Check & AI Tailoring (Steps 7n & 7o — Backend)

## Overview
- **Step 7n (Resume Builder)**: Job-seeker owned resumes (`resumes`, `resume_experiences`, `resume_education`, `resume_skills`), ordered section replacement, single-primary partial unique index synced with `talent_profiles.resume_id`, deep duplication, KPI summary, and structured JSON export.
- **Step 7o (ATS Check & AI Tailor)**: Rule-based ATS compatibility scoring (`POST /resumes/{id}/ats-runs`) and LangGraph + Groq AI tailoring (`POST /resumes/{id}/tailor`) backed by `resume_ats_runs` (`run_type` discriminator: `ats` | `tailor`) and metered in `ai_usage_events`.

## Approved Differences from `database/schema.sql`
- `resumes` omits `file_id` (deferred to Step 4 wiring) and `view_count`/`download_count` (avoiding write-on-read counters).
- `resumes` adds nullable `template` (`VARCHAR(64)`) and `source` (`VARCHAR(16)`, default `'manual'`).
- `resume_experiences.bullets` and `resume_ats_runs` arrays use portable `JSON` for SQLite/PostgreSQL parity.
- `resume_ats_runs` adds `run_type` (`'ats' | 'tailor'`) so ATS checks and AI tailoring runs share one table.
- `ai_usage_events` added early (anticipates Step 7v) to meter token usage per user/feature/model.

## Configuration
- `GROQ_API_KEY`: server-side API key for Groq (empty = `503 AI_UNCONFIGURED` on `/tailor`).
- `GROQ_MODEL`: default `llama-3.3-70b-versatile`.
- Rate limits: `RESUME_READ_LIMIT` (120/60s), `RESUME_WRITE_LIMIT` (60/60s), `RESUME_ATS_WRITE_LIMIT` (30/60s), `AI_TAILOR_LIMIT` (10/3600s).

## Deferred / Open
- PDF export (client-side or later follow-up).
- Resume file import (`file_id`, needs Step 4).
- Full DPDP AI consent flow & 7v shared AI factory.
- Frontend wiring for `/jobseeker/resumes/*` (Phase B).
