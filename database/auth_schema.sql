-- Active: 1791486193489@@127.0.0.1@5433@startup_database
-- =============================================================================
--  FORMA — Auth-only extract for Step 2 (REFERENCE ONLY, never run directly)
-- =============================================================================
--  Extracted from database/schema.sql section 2 (Step 2 subset).
--  The backend implements these tables via Alembic revisions in
--  backend/alembic/versions/0001_foundation.py and 0002_auth.py.
--  user_mfa_factors and admin_members are deferred to Step 15a.
--
--  Portability deviations in the implementation (see backend/app/models):
--  citext/inet -> VARCHAR, native ENUM -> VARCHAR+CHECK, partial unique
--  indexes -> unique constraints. Values and names match schema.sql.
-- =============================================================================

-- Enums used by Step 2 (schema.sql section 1)
CREATE TYPE user_role       AS ENUM ('startup','mentor','investor','jobseeker','employer','admin');
CREATE TYPE account_status  AS ENUM ('pending','active','suspended','deactivated','deleted');
CREATE TYPE review_state    AS ENUM ('unverified','pending','verified','rejected','expired');

-- Tables (see schema.sql section 2 for full DDL):
--   users, user_roles, auth_sessions,
--   email_verification_tokens, password_reset_tokens, login_attempts
--
-- Deferred to Step 15a (do NOT create in Step 2):
--   user_mfa_factors, admin_members
