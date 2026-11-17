-- Active: 1791486193489@@127.0.0.1@5433@startup_database
-- =============================================================================
--  FORMA — Auth extract for Step 2 (REFERENCE ONLY, never run directly)
-- =============================================================================
--  Verbatim extract from database/schema.sql (sections 1 + 2) with the Step 2
--  tables: users, user_roles, auth_sessions, email_verification_tokens,
--  password_reset_tokens, login_attempts.
--  The live schema is created by Alembic revisions backend/alembic/versions/
--  0001_foundation.py and 0002_auth.py — this file is documentation only.
--
--  NOT extracted (deferred to Step 15a, per BUILD_PLAN):
--    user_mfa_factors, admin_members
--
--  Portability deviations in the implementation (see backend/app/models):
--  citext/inet -> VARCHAR, native ENUM -> VARCHAR+CHECK, unique indexes ->
--  unique constraints. The three partial indexes user_roles_one_primary_idx,
--  auth_sessions_active_idx and login_attempts_fail_idx are not materialized
--  in the migrated DB (single-primary is handled app-side in
--  auth_service.add_role; the other two are query hints only).
--  Everything else — table/column/index names and values — matches
--  schema.sql exactly.
--
--  updated_at triggers: schema.sql's bootstrap loop attaches
--  <table>_set_updated_at to every table with an updated_at column; the
--  migrated database keeps updated_at current via SQLAlchemy onupdate.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

SET client_min_messages = warning;

-- Section 1 dependencies used by the auth tables
CREATE TYPE user_role            AS ENUM ('startup','mentor','investor','jobseeker','employer','admin');
CREATE TYPE account_status       AS ENUM ('pending','active','suspended','deactivated','deleted');
CREATE TYPE review_state         AS ENUM ('unverified','pending','verified','rejected','expired');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2.  IDENTITY & ACCESS
-- =============================================================================
-- frontend: /login /register /register/role /verify-email /reset-password
--           /onboarding  app/AuthScreen.jsx  admin initialUsers.roles[]

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email      citext NOT NULL CHECK (position('@' IN primary_email) > 1),
  email_verified_at  timestamptz,
  password_hash      text,                          -- NULL => SSO-only account
  display_name       text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  handle             citext,                        -- community @handle
  avatar_url         text,
  avatar_initials    varchar(3),                    -- UI renders initials when no image
  phone              text,
  locale             text NOT NULL DEFAULT 'en-IN',
  timezone           text NOT NULL DEFAULT 'Asia/Kolkata',
  status             account_status NOT NULL DEFAULT 'pending',
  verification       review_state NOT NULL DEFAULT 'unverified',
  region             text,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  onboarding_step    text,
  last_active_at     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE UNIQUE INDEX users_primary_email_key ON users (primary_email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_handle_key ON users (handle) WHERE handle IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX users_status_idx ON users (status);
CREATE INDEX users_last_active_idx ON users (last_active_at DESC NULLS LAST);

-- The frontend implies multiple roles per user: admin users.roles[] is an array,
-- and /register/role says "You can add other roles later".
CREATE TABLE user_roles (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
CREATE UNIQUE INDEX user_roles_one_primary_idx ON user_roles (user_id) WHERE is_primary;
CREATE INDEX user_roles_role_idx ON user_roles (role) WHERE revoked_at IS NULL;

-- Rotating refresh tokens are stored hashed, never raw.
CREATE TABLE auth_sessions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_token_hash     text NOT NULL,
  user_agent             text,
  ip                     inet,
  region                 text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  last_used_at           timestamptz,
  expires_at             timestamptz NOT NULL,
  revoked_at             timestamptz,
  revoked_reason         text,
  replaced_by_session_id uuid
);
CREATE UNIQUE INDEX auth_sessions_token_key ON auth_sessions (refresh_token_hash);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id, created_at DESC);
CREATE INDEX auth_sessions_active_idx ON auth_sessions (user_id) WHERE revoked_at IS NULL;
ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_replaced_by_fk
  FOREIGN KEY (replaced_by_session_id) REFERENCES auth_sessions (id) ON DELETE SET NULL;

CREATE TABLE email_verification_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  email       citext NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_verification_token_key ON email_verification_tokens (token_hash);
CREATE INDEX email_verification_user_idx ON email_verification_tokens (user_id, created_at DESC);

CREATE TABLE password_reset_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  requested_ip inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX password_reset_token_key ON password_reset_tokens (token_hash);
CREATE INDEX password_reset_user_idx ON password_reset_tokens (user_id, created_at DESC);

-- Brute-force / rate-limit evidence, also feeds admin security alerts.
CREATE TABLE login_attempts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          citext NOT NULL,
  user_id        uuid REFERENCES users (id) ON DELETE SET NULL,
  ip             inet,
  user_agent     text,
  succeeded      boolean NOT NULL,
  failure_reason text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts (email, created_at DESC);
CREATE INDEX login_attempts_ip_idx ON login_attempts (ip, created_at DESC);
CREATE INDEX login_attempts_fail_idx ON login_attempts (created_at DESC) WHERE NOT succeeded;


-- (section 18 bootstrap in schema.sql attaches <table>_set_updated_at
--  triggers to users/auth_sessions — see note in the header)

COMMIT;
