-- Active: 1785483683689@@127.0.0.1@5432@startup_database
-- =============================================================================
--  FORMA — Startup & Talent ERP Platform
--  PostgreSQL 14+ database schema (baseline)
-- =============================================================================
--  Derived from the completed Next.js frontend in ../frontend:
--    * the 31 *-data.js mock stores (~474 seeded records)
--    * inline page data under app/startup/*, app/community/*, app/admin/*
--    * uploads/*-design.md
--
--  Conventions:
--    * UUID primary keys (gen_random_uuid()), timestamptz everywhere
--    * created_at / updated_at on every table; deleted_at for soft delete
--    * money = NUMERIC(14,2) + ISO-4217 currency column, never float
--    * stable fixed sets = native enums; admin-editable sets = lookup tables
--    * files are object-store keys (S3), never blobs in the database
--    * constraints live in the DB (NOT NULL / UNIQUE / CHECK / FK)
--
--  Each section names the frontend route(s) it serves.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

SET client_min_messages = warning;

-- -----------------------------------------------------------------------------
-- 0.  Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Every "score", "match %" and "readiness" in the UI is 0-100.
CREATE DOMAIN score_100 AS smallint CHECK (VALUE >= 0 AND VALUE <= 100);


-- =============================================================================
-- 1.  ENUMERATED DOMAINS
-- =============================================================================
-- Only stable sets become enums. Anything an admin can edit from the console
-- (policy categories, ticket categories, sectors) uses a lookup table.

CREATE TYPE user_role            AS ENUM ('startup','mentor','investor','jobseeker','employer','admin');
CREATE TYPE account_status       AS ENUM ('pending','active','suspended','deactivated','deleted');
CREATE TYPE review_state         AS ENUM ('unverified','pending','verified','rejected','expired');

CREATE TYPE org_type             AS ENUM ('startup','employer','investor_firm','agency','other');
CREATE TYPE org_role             AS ENUM ('owner','admin','member','viewer');
CREATE TYPE member_status        AS ENUM ('invited','active','deactivated');
CREATE TYPE department           AS ENUM ('engineering','product','design','sales','marketing','operations','finance','people','legal','support','other');

CREATE TYPE startup_stage        AS ENUM ('idea','prototype','early_revenue','growth','mature');
CREATE TYPE funding_round_type   AS ENUM ('pre_seed','seed','series_a','series_b','bridge','safe','other');
CREATE TYPE round_status         AS ENUM ('draft','open','paused','closed','cancelled');

CREATE TYPE task_status          AS ENUM ('todo','in_progress','in_review','blocked','done');
CREATE TYPE task_priority        AS ENUM ('low','medium','high','urgent');

CREATE TYPE doc_visibility       AS ENUM ('private','approved_investors','public');
CREATE TYPE access_request_status AS ENUM ('pending','approved','denied','expired','revoked');

CREATE TYPE pipeline_stage       AS ENUM ('interested','intro','meeting','data_room','offer','committed','passed','closed');
CREATE TYPE offer_status         AS ENUM ('draft','sent','countered','accepted','declined','expired','withdrawn');
CREATE TYPE instrument_type      AS ENUM ('equity','safe','convertible_note','ccd','ccps','debt','other');

CREATE TYPE job_status           AS ENUM ('draft','open','paused','closed');
CREATE TYPE work_mode            AS ENUM ('onsite','hybrid','remote');
CREATE TYPE employment_type      AS ENUM ('full_time','part_time','contract','internship','temporary');
CREATE TYPE application_stage    AS ENUM ('applied','review','shortlisted','interview','offered','hired','rejected','withdrawn');
CREATE TYPE application_source   AS ENUM ('platform','referral','marketplace','outreach','agency','other');
CREATE TYPE interview_format     AS ENUM ('video','phone','onsite','async');
CREATE TYPE interview_status     AS ENUM ('scheduled','confirmed','completed','cancelled','no_show','rescheduled');
CREATE TYPE availability_mode    AS ENUM ('immediate','two_weeks','one_month','flexible','not_looking');

CREATE TYPE mentorship_status   AS ENUM ('requested','active','paused','completed','declined','cancelled');
CREATE TYPE session_status       AS ENUM ('proposed','scheduled','confirmed','completed','cancelled','no_show');
CREATE TYPE deliverable_status   AS ENUM ('not_started','in_progress','submitted','changes_requested','accepted','overdue');
CREATE TYPE agreement_status     AS ENUM ('draft','sent','signed','active','expired','terminated');

CREATE TYPE space_category       AS ENUM ('discussion','question','showcase','announcement','ama','feedback');
CREATE TYPE post_type            AS ENUM ('discussion','question','showcase','announcement','poll','ama');
CREATE TYPE post_status          AS ENUM ('draft','published','flagged','hidden','removed');
CREATE TYPE reaction_kind        AS ENUM ('helpful','bookmark','insightful','celebrate');
CREATE TYPE thread_kind          AS ENUM ('direct','startup_investor','mentor','offer','support','system');

CREATE TYPE notification_channel AS ENUM ('in_app','email','push','sms');

CREATE TYPE support_channel      AS ENUM ('email','chat','phone','in_app','social');
CREATE TYPE ticket_priority      AS ENUM ('low','normal','high','urgent');
CREATE TYPE ticket_status        AS ENUM ('open','pending','on_hold','resolved','closed');

CREATE TYPE plan_audience        AS ENUM ('startup','employer','mentor','investor','jobseeker');
CREATE TYPE plan_cycle           AS ENUM ('monthly','annual','none');
CREATE TYPE plan_status          AS ENUM ('draft','active','retired');
CREATE TYPE subscription_status  AS ENUM ('trialing','active','past_due','cancelled','expired');
CREATE TYPE invoice_status       AS ENUM ('draft','issued','paid','void','refunded','overdue');
CREATE TYPE payment_status       AS ENUM ('pending','authorized','captured','failed','refunded');
CREATE TYPE payment_provider     AS ENUM ('razorpay','stripe','upi','netbanking','card','wallet','bank_transfer','manual');
CREATE TYPE refund_status        AS ENUM ('requested','approved','processing','completed','rejected');
CREATE TYPE payout_status        AS ENUM ('draft','pending_approval','approved','processing','paid','failed','held');
CREATE TYPE hold_status          AS ENUM ('active','released','expired','converted');

CREATE TYPE case_status          AS ENUM ('open','triaged','in_review','awaiting_info','resolved','escalated','closed');
CREATE TYPE case_priority        AS ENUM ('low','normal','high','urgent','critical');
CREATE TYPE severity_level       AS ENUM ('info','low','medium','high','critical');
CREATE TYPE risk_tier            AS ENUM ('low','medium','high','critical');
CREATE TYPE policy_action        AS ENUM ('allow','flag','hide','remove','restrict','suspend','escalate');
CREATE TYPE moderation_target    AS ENUM ('user','organization','job','application','post','comment','message','offer','document','review');
CREATE TYPE data_request_type    AS ENUM ('access','erasure','rectification','portability','restriction','objection');
CREATE TYPE data_request_status  AS ENUM ('received','verifying','in_progress','fulfilled','rejected','expired');

CREATE TYPE flag_kind            AS ENUM ('boolean','number','string','json');
CREATE TYPE service_status       AS ENUM ('operational','degraded','partial_outage','major_outage','maintenance');


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

CREATE TABLE user_mfa_factors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('totp','sms','webauthn','recovery_code')),
  label            text,
  secret_encrypted text,          -- encrypted at the application layer
  confirmed_at     timestamptz,
  last_used_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX user_mfa_user_idx ON user_mfa_factors (user_id) WHERE deleted_at IS NULL;

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

-- Admin console operators: stricter policy, own token lifetime.
-- frontend: /admin/login /admin/staff /admin/profile
CREATE TABLE admin_members (
  user_id          uuid PRIMARY KEY REFERENCES users (id) ON DELETE RESTRICT,
  permission_level text NOT NULL CHECK (permission_level IN ('analyst','support','manager','super_admin')),
  department       text,
  mfa_required     boolean NOT NULL DEFAULT true,
  ip_allowlist     inet[],
  session_ttl_min  smallint NOT NULL DEFAULT 30 CHECK (session_ttl_min BETWEEN 5 AND 480),
  emergency_phone  text,
  last_review_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz
);


-- =============================================================================
-- 3.  ORGANIZATIONS & MEMBERSHIP
-- =============================================================================
-- One table serves three surfaces: startup team directory (/startup/team),
-- employer company + seats (/employer/profile, /employer/billing), investor firm.
-- frontend: admin initialOrganizations

CREATE TABLE organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  slug          citext NOT NULL,
  type          org_type NOT NULL,
  status        account_status NOT NULL DEFAULT 'active',
  summary       text,
  logo_url      text,
  logo_initials varchar(3),
  website       text,
  city          text,
  region        text,
  country       text DEFAULT 'IN',
  founded_year  smallint CHECK (founded_year IS NULL OR founded_year BETWEEN 1900 AND 2100),
  verified_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX organizations_slug_key ON organizations (slug) WHERE deleted_at IS NULL;
CREATE INDEX organizations_type_idx ON organizations (type, status);
CREATE INDEX organizations_region_idx ON organizations (region);

CREATE TABLE organization_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role           org_role NOT NULL DEFAULT 'member',
  status         member_status NOT NULL DEFAULT 'invited',
  title          text,          -- 'Co-founder · Product', 'Engineering Lead'
  department     department,
  seat_type      text,          -- employer billing seat tier
  is_founder     boolean NOT NULL DEFAULT false,
  is_public      boolean NOT NULL DEFAULT true,
  bio            text,
  invited_by     uuid REFERENCES users (id) ON DELETE SET NULL,
  invited_email  citext,
  joined_at      timestamptz,
  last_active_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CONSTRAINT org_members_active_needs_join CHECK (status <> 'active' OR joined_at IS NOT NULL)
);
CREATE UNIQUE INDEX org_members_unique_user ON organization_members (org_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX org_members_user_idx ON organization_members (user_id) WHERE deleted_at IS NULL;
CREATE INDEX org_members_status_idx ON organization_members (org_id, status);

CREATE TABLE organization_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  email       citext NOT NULL,
  role        org_role NOT NULL DEFAULT 'member',
  title       text,
  department  department,
  token_hash  text NOT NULL,
  invited_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX org_invites_token_key ON organization_invites (token_hash);
CREATE INDEX org_invites_pending_idx ON organization_invites (org_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE skills (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       citext NOT NULL,
  category   text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX skills_name_key ON skills (name);


-- =============================================================================
-- 4.  STARTUP PROFILE, STAGE, TASKS & READINESS
-- =============================================================================
-- frontend: /startup/profile /startup/stage/* /startup/tasks /startup/readiness

CREATE TABLE startup_profiles (
  org_id             uuid PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
  tagline            text,
  stage              startup_stage NOT NULL DEFAULT 'idea',
  sector             text,
  business_model     text,
  problem            text,
  solution           text,
  traction_summary   text,
  tam_text           text,          -- '₹8,400 Cr · startup-reported'
  team_size          smallint CHECK (team_size >= 0),
  location           text,
  founded_on         date,
  mentor_verified    boolean NOT NULL DEFAULT false,
  readiness_score    score_100,
  profile_visibility text NOT NULL DEFAULT 'mentors_and_investors',
  summary_public     boolean NOT NULL DEFAULT true,
  traction_public    boolean NOT NULL DEFAULT true,
  team_public        boolean NOT NULL DEFAULT true,
  funding_public     boolean NOT NULL DEFAULT false,
  round_public       boolean NOT NULL DEFAULT false,
  readiness_public   boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT startup_visibility_valid
    CHECK (profile_visibility IN ('private','mentors','mentors_and_investors','public'))
);

-- Time series behind "MRR ₹4.8L · +12% MoM"; the UI reads the latest row.
CREATE TABLE startup_metrics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES startup_profiles (org_id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  value      numeric(18,4) NOT NULL,
  unit       text,
  currency   char(3),
  source     text NOT NULL DEFAULT 'startup_reported',
  period_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT startup_metric_key_valid
    CHECK (metric_key IN ('mrr','arr','customers','burn','runway_months','growth_mom','headcount','active_users')),
  CONSTRAINT startup_metric_source_valid
    CHECK (source IN ('startup_reported','calculated','mentor_verified','admin_verified'))
);
CREATE UNIQUE INDEX startup_metrics_key_period ON startup_metrics (org_id, metric_key, period_end);
CREATE INDEX startup_metrics_latest_idx ON startup_metrics (org_id, metric_key, period_end DESC);

-- The 6 readiness criteria rendered by /startup/readiness.
CREATE TABLE readiness_criteria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL,
  title         text NOT NULL,
  description   text,
  stage         startup_stage,
  weight        smallint NOT NULL DEFAULT 1 CHECK (weight > 0),
  display_order smallint NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX readiness_criteria_code_key ON readiness_criteria (code);

CREATE TABLE startup_readiness (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES startup_profiles (org_id) ON DELETE CASCADE,
  criterion_id  uuid NOT NULL REFERENCES readiness_criteria (id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'not_started',
  evidence      text,
  score         score_100,
  signed_off_by uuid REFERENCES users (id) ON DELETE SET NULL,
  signed_off_at timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT startup_readiness_status_valid
    CHECK (status IN ('not_started','in_progress','submitted','signed_off','rejected'))
);
CREATE UNIQUE INDEX startup_readiness_unique ON startup_readiness (org_id, criterion_id);
CREATE INDEX startup_readiness_status_idx ON startup_readiness (org_id, status);

CREATE TABLE milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name        text NOT NULL,
  target_date date,
  owner_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'on_track',
  progress    smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT milestone_status_valid
    CHECK (status IN ('on_track','at_risk','off_track','achieved','missed'))
);
CREATE INDEX milestones_org_idx ON milestones (org_id) WHERE deleted_at IS NULL;

CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(btrim(title)) > 0),
  description   text,
  status        task_status NOT NULL DEFAULT 'todo',
  priority      task_priority NOT NULL DEFAULT 'medium',
  milestone_id  uuid REFERENCES milestones (id) ON DELETE SET NULL,
  readiness_id  uuid REFERENCES startup_readiness (id) ON DELETE SET NULL,
  assignee_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  created_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  due_on        date,
  completed_at  timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX tasks_org_status_idx ON tasks (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX tasks_assignee_idx ON tasks (assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX tasks_due_idx ON tasks (org_id, due_on) WHERE deleted_at IS NULL;

CREATE TABLE task_labels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX task_labels_org_name_key ON task_labels (org_id, name);

CREATE TABLE task_label_links (
  task_id    uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  label_id   uuid NOT NULL REFERENCES task_labels (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE task_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX task_comments_task_idx ON task_comments (task_id, created_at) WHERE deleted_at IS NULL;


-- =============================================================================
-- 5.  FILES, DATA ROOM & ACCESS REQUESTS
-- =============================================================================
-- frontend: /startup/data-room /startup/data-room/requests /investor/data-rooms
-- Files live in object storage; the database keeps keys and metadata only.

CREATE TABLE files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_org_id   uuid REFERENCES organizations (id) ON DELETE SET NULL,
  uploaded_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  kind           text NOT NULL,
  file_name      text NOT NULL,
  storage_key    text NOT NULL,
  mime_type      text NOT NULL,
  byte_size      bigint NOT NULL CHECK (byte_size > 0),
  checksum_sha256 char(64),
  scan_status    text NOT NULL DEFAULT 'pending',
  scanned_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CONSTRAINT file_kind_valid
    CHECK (kind IN ('pitch_deck','financial_model','legal','resume','logo','document','image','other')),
  CONSTRAINT file_scan_status_valid
    CHECK (scan_status IN ('pending','clean','infected','failed'))
);
CREATE UNIQUE INDEX files_storage_key_key ON files (storage_key);
CREATE INDEX files_owner_org_idx ON files (owner_org_id, kind) WHERE deleted_at IS NULL;

CREATE TABLE data_rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'Data room',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX data_rooms_org_key ON data_rooms (org_id);

CREATE TABLE data_room_folders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_room_id  uuid NOT NULL REFERENCES data_rooms (id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES data_room_folders (id) ON DELETE CASCADE,
  name          text NOT NULL,          -- 'Pitch', 'Financials', 'Legal'
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX data_room_folders_room_idx ON data_room_folders (data_room_id, parent_id);

CREATE TABLE data_room_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid NOT NULL REFERENCES data_room_folders (id) ON DELETE CASCADE,
  file_id     uuid NOT NULL REFERENCES files (id) ON DELETE RESTRICT,
  visibility  doc_visibility NOT NULL DEFAULT 'private',
  version     text NOT NULL DEFAULT 'v1',
  view_count  integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  updated_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX data_room_docs_folder_idx ON data_room_documents (folder_id) WHERE deleted_at IS NULL;

CREATE TABLE data_room_access_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_room_id  uuid NOT NULL REFERENCES data_rooms (id) ON DELETE CASCADE,
  requester_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  requester_org uuid REFERENCES organizations (id) ON DELETE SET NULL,
  scope         text,
  status        access_request_status NOT NULL DEFAULT 'pending',
  nda_file_id   uuid REFERENCES files (id) ON DELETE SET NULL,
  nda_signed_at timestamptz,
  decided_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at    timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dradr_status_idx ON data_room_access_requests (data_room_id, status);
CREATE UNIQUE INDEX dradr_unique_open ON data_room_access_requests (data_room_id, requester_id)
  WHERE status IN ('pending','approved');

-- Every document view is auditable (investor diligence trail).
CREATE TABLE document_views (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES data_room_documents (id) ON DELETE CASCADE,
  viewer_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  ip          inet,
  user_agent  text,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_views_doc_idx ON document_views (document_id, viewed_at DESC);


-- =============================================================================
-- 6.  FUNDRAISING: ROUNDS, INVESTOR PIPELINE & OFFERS
-- =============================================================================
-- frontend: /startup/rounds /startup/investors/* /investor/pipeline
--           /investor/offers /investor/commitments /investor/portfolio

CREATE TABLE funding_rounds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name                text NOT NULL,
  round_type          funding_round_type NOT NULL,
  target_amount       numeric(14,2),
  committed_amount    numeric(14,2) NOT NULL DEFAULT 0,
  currency            char(3) NOT NULL DEFAULT 'INR',
  pre_money_valuation numeric(14,2),
  instrument          instrument_type,
  status              round_status NOT NULL DEFAULT 'draft',
  opens_on            date,
  closes_on           date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT round_amounts_non_negative
    CHECK ((target_amount IS NULL OR target_amount > 0) AND committed_amount >= 0)
);
CREATE INDEX funding_rounds_org_idx ON funding_rounds (org_id, status) WHERE deleted_at IS NULL;

-- An investor organization's view of a startup (the kanban board).
CREATE TABLE investor_deals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_org_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  startup_org_id   uuid NOT NULL REFERENCES startup_profiles (org_id) ON DELETE CASCADE,
  round_id         uuid REFERENCES funding_rounds (id) ON DELETE SET NULL,
  stage            pipeline_stage NOT NULL DEFAULT 'interested',
  probability      score_100,
  ticket_size      numeric(14,2),
  currency         char(3) NOT NULL DEFAULT 'INR',
  owner_id         uuid REFERENCES users (id) ON DELETE SET NULL,
  fit_note         text,
  next_step        text,
  next_step_on     date,
  last_activity_at timestamptz,
  passed_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT deal_distinct_parties CHECK (investor_org_id <> startup_org_id)
);
CREATE UNIQUE INDEX investor_deals_unique
  ON investor_deals (investor_org_id, startup_org_id) WHERE deleted_at IS NULL;
CREATE INDEX investor_deals_stage_idx ON investor_deals (investor_org_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX investor_deals_startup_idx ON investor_deals (startup_org_id) WHERE deleted_at IS NULL;

CREATE TABLE investor_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid NOT NULL REFERENCES funding_rounds (id) ON DELETE CASCADE,
  investor_org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  currency        char(3) NOT NULL DEFAULT 'INR',
  instrument      instrument_type NOT NULL,
  valuation_cap   numeric(14,2),
  discount_pct    numeric(5,2) CHECK (discount_pct IS NULL OR discount_pct BETWEEN 0 AND 100),
  version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
  parent_offer_id uuid REFERENCES investor_offers (id) ON DELETE SET NULL,
  status          offer_status NOT NULL DEFAULT 'draft',
  expires_on      date,
  owner_id        uuid REFERENCES users (id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX investor_offers_round_idx ON investor_offers (round_id, status) WHERE deleted_at IS NULL;
CREATE INDEX investor_offers_investor_idx ON investor_offers (investor_org_id, created_at DESC);

CREATE TABLE commitments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        uuid NOT NULL REFERENCES funding_rounds (id) ON DELETE CASCADE,
  offer_id        uuid REFERENCES investor_offers (id) ON DELETE SET NULL,
  investor_org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  currency        char(3) NOT NULL DEFAULT 'INR',
  status          text NOT NULL DEFAULT 'pledged',
  committed_on    date,
  funded_on       date,
  wired_at        timestamptz,
  reference       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commitment_status_valid
    CHECK (status IN ('pledged','documented','funded','cancelled'))
);
CREATE INDEX commitments_round_idx ON commitments (round_id, status);
CREATE INDEX commitments_investor_idx ON commitments (investor_org_id);

CREATE TABLE portfolio_holdings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  startup_org_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  commitment_id   uuid REFERENCES commitments (id) ON DELETE SET NULL,
  instrument      instrument_type NOT NULL,
  invested_amount numeric(14,2) NOT NULL CHECK (invested_amount >= 0),
  currency        char(3) NOT NULL DEFAULT 'INR',
  ownership_pct   numeric(6,4) CHECK (ownership_pct IS NULL OR ownership_pct BETWEEN 0 AND 100),
  invested_on     date,
  status          text NOT NULL DEFAULT 'active',
  exited_on       date,
  exit_value      numeric(14,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holding_distinct_parties CHECK (investor_org_id <> startup_org_id),
  CONSTRAINT holding_status_valid
    CHECK (status IN ('active','written_off','exited','partially_exited'))
);
CREATE INDEX portfolio_holdings_investor_idx ON portfolio_holdings (investor_org_id, status);


-- =============================================================================
-- 7.  HIRING: JOBS, APPLICATIONS, INTERVIEWS, OFFERS, HIRES
-- =============================================================================
-- Shared by /employer/* and /startup/hiring/*.

CREATE TABLE hiring_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  role_title    text NOT NULL,
  department    department,
  headcount     smallint NOT NULL DEFAULT 1 CHECK (headcount > 0),
  urgency       text NOT NULL DEFAULT 'normal',
  requested_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  approver_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  target_start  date,
  budget_amount numeric(14,2),
  currency      char(3) NOT NULL DEFAULT 'INR',
  status        text NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hiring_request_urgency_valid CHECK (urgency IN ('low','normal','high','urgent')),
  CONSTRAINT hiring_request_status_valid
    CHECK (status IN ('draft','pending','approved','rejected','fulfilled','cancelled'))
);
CREATE INDEX hiring_requests_org_idx ON hiring_requests (org_id, status);

CREATE TABLE jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  request_id         uuid REFERENCES hiring_requests (id) ON DELETE SET NULL,
  title              text NOT NULL CHECK (length(btrim(title)) > 0),
  description        text,
  department         department,
  location           text,
  work_mode          work_mode NOT NULL DEFAULT 'onsite',
  employment_type    employment_type NOT NULL DEFAULT 'full_time',
  status             job_status NOT NULL DEFAULT 'draft',
  salary_min         numeric(14,2),
  salary_max         numeric(14,2),
  currency           char(3) NOT NULL DEFAULT 'INR',
  equity_min_pct     numeric(5,2),
  equity_max_pct     numeric(5,2),
  experience_min_yrs smallint CHECK (experience_min_yrs >= 0),
  experience_max_yrs smallint,
  openings           smallint NOT NULL DEFAULT 1 CHECK (openings > 0),
  owner_id           uuid REFERENCES users (id) ON DELETE SET NULL,
  featured_until     timestamptz,
  posted_at          timestamptz,
  closed_at          timestamptz,
  created_by         uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  CONSTRAINT jobs_salary_range
    CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min),
  CONSTRAINT jobs_open_has_posted
    CHECK (status <> 'open' OR posted_at IS NOT NULL)
);
CREATE INDEX jobs_org_status_idx ON jobs (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX jobs_open_feed_idx ON jobs (posted_at DESC) WHERE status = 'open' AND deleted_at IS NULL;
CREATE INDEX jobs_mode_idx ON jobs (work_mode, employment_type) WHERE status = 'open';

CREATE TABLE job_skills (
  job_id      uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  skill_id    uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
  is_required boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE job_benefits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  label         text NOT NULL,
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_benefits_job_idx ON job_benefits (job_id);

-- /jobseeker/alerts
CREATE TABLE job_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title        text NOT NULL,
  criteria     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- keywords, location, mode, salary
  frequency    text NOT NULL DEFAULT 'daily',
  is_active    boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_alert_frequency_valid CHECK (frequency IN ('instant','daily','weekly'))
);
CREATE INDEX job_alerts_user_idx ON job_alerts (user_id) WHERE is_active;

CREATE TABLE saved_jobs (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id     uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

-- /employer/talent shortlists
CREATE TABLE talent_shortlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX talent_shortlists_org_idx ON talent_shortlists (org_id) WHERE deleted_at IS NULL;

CREATE TABLE talent_shortlist_members (
  shortlist_id uuid NOT NULL REFERENCES talent_shortlists (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  added_by     uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shortlist_id, user_id)
);

CREATE TABLE talent_profiles (
  user_id              uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  headline             text,
  summary              text,
  total_experience_yrs numeric(4,1) CHECK (total_experience_yrs >= 0),
  current_location     text,
  preferred_mode       work_mode,
  availability         availability_mode NOT NULL DEFAULT 'flexible',
  salary_expectation   numeric(14,2),
  currency             char(3) NOT NULL DEFAULT 'INR',
  open_to_relocate     boolean NOT NULL DEFAULT false,
  resume_id            uuid,          -- FK added in section 8
  is_searchable        boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX talent_profiles_searchable_idx ON talent_profiles (is_searchable) WHERE is_searchable;

CREATE TABLE talent_profile_skills (
  user_id    uuid NOT NULL REFERENCES talent_profiles (user_id) ON DELETE CASCADE,
  skill_id   uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
  years      numeric(4,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE job_applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  applicant_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  stage              application_stage NOT NULL DEFAULT 'applied',
  source             application_source NOT NULL DEFAULT 'platform',
  match_score        score_100,
  match_reason       text,
  is_blind           boolean NOT NULL DEFAULT false,
  resume_file_id     uuid REFERENCES files (id) ON DELETE SET NULL,
  cover_note         text,
  salary_expectation numeric(14,2),
  currency           char(3) NOT NULL DEFAULT 'INR',
  consent_share      boolean NOT NULL DEFAULT false,
  practice_verified  boolean NOT NULL DEFAULT false,
  assignee_id        uuid REFERENCES users (id) ON DELETE SET NULL,
  rating             numeric(2,1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  stage_changed_at   timestamptz,
  rejected_reason    text,
  rejected_at        timestamptz,
  withdrawn_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE UNIQUE INDEX job_applications_unique
  ON job_applications (job_id, applicant_id) WHERE deleted_at IS NULL;
CREATE INDEX job_applications_job_stage_idx ON job_applications (job_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX job_applications_applicant_idx ON job_applications (applicant_id, created_at DESC);

CREATE TABLE application_stage_events (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES job_applications (id) ON DELETE CASCADE,
  from_stage     application_stage,
  to_stage       application_stage NOT NULL,
  actor_id       uuid REFERENCES users (id) ON DELETE SET NULL,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_stage_events_app_idx ON application_stage_events (application_id, created_at DESC);

CREATE TABLE application_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES job_applications (id) ON DELETE CASCADE,
  author_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  body           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX application_notes_app_idx ON application_notes (application_id, created_at DESC);

-- Weighted scorecards (employer/templates scorecardCriteria).
CREATE TABLE scorecards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations (id) ON DELETE CASCADE,
  name        text NOT NULL,
  job_id      uuid REFERENCES jobs (id) ON DELETE SET NULL,
  is_platform boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scorecards_org_idx ON scorecards (org_id);

CREATE TABLE scorecard_criteria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id  uuid NOT NULL REFERENCES scorecards (id) ON DELETE CASCADE,
  name          text NOT NULL,
  weight        smallint NOT NULL DEFAULT 1 CHECK (weight > 0),
  anchors       text[],
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scorecard_criteria_card_idx ON scorecard_criteria (scorecard_id, display_order);

CREATE TABLE application_scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES job_applications (id) ON DELETE CASCADE,
  criterion_id   uuid NOT NULL REFERENCES scorecard_criteria (id) ON DELETE CASCADE,
  interviewer_id uuid REFERENCES users (id) ON DELETE SET NULL,
  score          smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX application_scores_unique
  ON application_scores (application_id, criterion_id, interviewer_id);

CREATE TABLE interviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   uuid NOT NULL REFERENCES job_applications (id) ON DELETE CASCADE,
  round_name       text,
  format           interview_format NOT NULL DEFAULT 'video',
  status           interview_status NOT NULL DEFAULT 'scheduled',
  scheduled_at     timestamptz NOT NULL,
  duration_min     smallint NOT NULL DEFAULT 45 CHECK (duration_min BETWEEN 5 AND 480),
  location         text,
  meeting_url      text,
  created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  cancelled_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interviews_app_idx ON interviews (application_id, scheduled_at DESC);
CREATE INDEX interviews_upcoming_idx ON interviews (scheduled_at)
  WHERE status IN ('scheduled','confirmed');

CREATE TABLE interview_participants (
  interview_id uuid NOT NULL REFERENCES interviews (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  side         text NOT NULL DEFAULT 'interviewer' CHECK (side IN ('interviewer','candidate','observer')),
  responded_at timestamptz,
  response     text CHECK (response IN ('accepted','declined','tentative')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, user_id)
);

CREATE TABLE interview_feedback (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id   uuid NOT NULL REFERENCES interviews (id) ON DELETE CASCADE,
  author_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  recommendation text CHECK (recommendation IN ('strong_yes','yes','no','strong_no')),
  summary        text,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_feedback_interview_idx ON interview_feedback (interview_id);

-- Employment offers (/employer/offers, /jobseeker/offers).
CREATE TABLE job_offers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    uuid NOT NULL REFERENCES job_applications (id) ON DELETE CASCADE,
  title             text NOT NULL,
  base_salary       numeric(14,2),
  bonus_amount      numeric(14,2),
  equity_pct        numeric(5,2),
  joining_bonus     numeric(14,2),
  currency          char(3) NOT NULL DEFAULT 'INR',
  start_date        date,
  expires_on        date,
  status            offer_status NOT NULL DEFAULT 'draft',
  owner_id          uuid REFERENCES users (id) ON DELETE SET NULL,
  document_file_id  uuid REFERENCES files (id) ON DELETE SET NULL,
  responded_at      timestamptz,
  decline_reason_id uuid,          -- FK added in section 13
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE INDEX job_offers_application_idx ON job_offers (application_id, created_at DESC);
CREATE INDEX job_offers_status_idx ON job_offers (status) WHERE deleted_at IS NULL;

CREATE TABLE hires (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES job_applications (id) ON DELETE RESTRICT,
  offer_id       uuid REFERENCES job_offers (id) ON DELETE SET NULL,
  org_id         uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  department     department,
  manager_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  owner_id       uuid REFERENCES users (id) ON DELETE SET NULL,
  start_date     date NOT NULL,
  status         text NOT NULL DEFAULT 'pending_onboarding',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hire_status_valid
    CHECK (status IN ('pending_onboarding','onboarding','active','no_show','cancelled'))
);
CREATE UNIQUE INDEX hires_application_key ON hires (application_id);
CREATE INDEX hires_org_idx ON hires (org_id, status);

CREATE TABLE onboarding_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations (id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_platform boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_template_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES onboarding_templates (id) ON DELETE CASCADE,
  section         text NOT NULL,
  title           text NOT NULL,
  owner_role      text,
  due_offset_days smallint,
  display_order   smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_template_items_tpl_idx ON onboarding_template_items (template_id, display_order);

CREATE TABLE hire_onboarding_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_id    uuid NOT NULL REFERENCES hires (id) ON DELETE CASCADE,
  section    text NOT NULL,
  title      text NOT NULL,
  owner_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  due_on     date,
  status     text NOT NULL DEFAULT 'pending',
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hire_onboarding_status_valid
    CHECK (status IN ('pending','in_progress','done','blocked','waived'))
);
CREATE INDEX hire_onboarding_hire_idx ON hire_onboarding_items (hire_id, status);

CREATE TABLE hire_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_id      uuid NOT NULL REFERENCES hires (id) ON DELETE CASCADE,
  file_id      uuid REFERENCES files (id) ON DELETE SET NULL,
  name         text NOT NULL,
  purpose      text,
  retention    text,
  status       text NOT NULL DEFAULT 'requested',
  due_on       date,
  requested_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hire_document_status_valid
    CHECK (status IN ('requested','received','verified','rejected','expired'))
);
CREATE INDEX hire_documents_hire_idx ON hire_documents (hire_id, status);

-- Reusable templates (/employer/templates, /admin/templates).
CREATE TABLE message_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid REFERENCES organizations (id) ON DELETE CASCADE,
  scope            text NOT NULL DEFAULT 'org',
  category         text NOT NULL,
  name             text NOT NULL,
  channel          notification_channel NOT NULL DEFAULT 'email',
  subject          text,
  body             text NOT NULL,
  version          integer NOT NULL DEFAULT 1,
  status           text NOT NULL DEFAULT 'draft',
  platform_managed boolean NOT NULL DEFAULT false,
  used_count       integer NOT NULL DEFAULT 0,
  updated_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT template_scope_valid CHECK (scope IN ('platform','org')),
  CONSTRAINT template_status_valid CHECK (status IN ('draft','active','archived')),
  CONSTRAINT template_scope_owner CHECK ((scope = 'platform') = platform_managed)
);
CREATE INDEX message_templates_scope_idx ON message_templates (scope, category) WHERE deleted_at IS NULL;


-- =============================================================================
-- 8.  JOB SEEKER: RESUMES, PRACTICE & READINESS
-- =============================================================================
-- frontend: /jobseeker/resumes/* /jobseeker/practice/* /jobseeker/readiness

CREATE TABLE resumes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title          text NOT NULL,
  target_role    text,
  summary        text,
  ats_score      score_100,
  is_default     boolean NOT NULL DEFAULT false,
  view_count     integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  download_count integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  file_id        uuid REFERENCES files (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE UNIQUE INDEX resumes_one_default ON resumes (user_id) WHERE is_default AND deleted_at IS NULL;
CREATE INDEX resumes_user_idx ON resumes (user_id) WHERE deleted_at IS NULL;

ALTER TABLE talent_profiles
  ADD CONSTRAINT talent_profiles_resume_fk
  FOREIGN KEY (resume_id) REFERENCES resumes (id) ON DELETE SET NULL;

CREATE TABLE resume_experiences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id     uuid NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
  role_title    text NOT NULL,
  company       text NOT NULL,
  period_label  text,          -- 'Jan 2022 – Present'; the UI shows free text
  started_on    date,
  ended_on      date,
  bullets       text[] NOT NULL DEFAULT '{}',
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resume_experiences_resume_idx ON resume_experiences (resume_id, display_order);

CREATE TABLE resume_education (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id     uuid NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
  degree        text NOT NULL,
  school        text NOT NULL,
  year_label    text,
  display_order smallint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resume_education_resume_idx ON resume_education (resume_id, display_order);

CREATE TABLE resume_skills (
  resume_id  uuid NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
  skill_id   uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resume_id, skill_id)
);

-- ATS analysis runs (/jobseeker/resumes/[resumeId]/ats).
CREATE TABLE resume_ats_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id        uuid NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
  job_id           uuid REFERENCES jobs (id) ON DELETE SET NULL,
  score            score_100,
  missing_keywords text[] NOT NULL DEFAULT '{}',
  matched_keywords text[] NOT NULL DEFAULT '{}',
  suggestions      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resume_ats_runs_resume_idx ON resume_ats_runs (resume_id, created_at DESC);

CREATE TABLE practice_drills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL,
  title        text NOT NULL,
  difficulty   text NOT NULL DEFAULT 'medium',
  duration_min smallint,
  description  text,
  prompts      text[] NOT NULL DEFAULT '{}',
  rubric       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_difficulty_valid CHECK (difficulty IN ('easy','medium','hard'))
);
CREATE INDEX practice_drills_category_idx ON practice_drills (category) WHERE is_active;

CREATE TABLE practice_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  drill_id        uuid REFERENCES practice_drills (id) ON DELETE SET NULL,
  title           text,
  status          text NOT NULL DEFAULT 'scheduled',
  score           score_100,
  duration_sec    integer CHECK (duration_sec IS NULL OR duration_sec >= 0),
  clarity         score_100,
  structure       score_100,
  empathy         score_100,
  technical_rigor score_100,
  feedback        text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_session_status_valid
    CHECK (status IN ('scheduled','in_progress','completed','abandoned'))
);
CREATE INDEX practice_sessions_user_idx ON practice_sessions (user_id, created_at DESC);

CREATE TABLE practice_transcript_turns (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES practice_sessions (id) ON DELETE CASCADE,
  speaker    text NOT NULL CHECK (speaker IN ('interviewer','candidate')),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX practice_turns_session_idx ON practice_transcript_turns (session_id, id);

CREATE TABLE user_readiness (
  user_id          uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  profile_complete score_100 NOT NULL DEFAULT 0,
  resume_score     score_100 NOT NULL DEFAULT 0,
  practice_score   score_100 NOT NULL DEFAULT 0,
  overall_score    score_100 NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 9.  MENTORSHIP
-- =============================================================================
-- frontend: /mentor/* and /startup/mentors/* (one model, two viewpoints)

CREATE TABLE mentor_profiles (
  user_id            uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  headline           text,
  bio                text,
  expertise          text[] NOT NULL DEFAULT '{}',
  sectors            text[] NOT NULL DEFAULT '{}',
  languages          text[] NOT NULL DEFAULT '{}',
  years_experience   smallint CHECK (years_experience >= 0),
  hourly_fee         numeric(14,2),
  currency           char(3) NOT NULL DEFAULT 'INR',
  cadence            text,
  max_startups       smallint NOT NULL DEFAULT 3 CHECK (max_startups > 0),
  accepting_requests boolean NOT NULL DEFAULT true,
  rating             numeric(3,2) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  sessions_completed integer NOT NULL DEFAULT 0,
  is_verified        boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mentor_profiles_accepting_idx ON mentor_profiles (accepting_requests)
  WHERE accepting_requests;

CREATE TABLE mentorships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  startup_org_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  status          mentorship_status NOT NULL DEFAULT 'requested',
  goal            text,
  needs           text[] NOT NULL DEFAULT '{}',
  cadence         text,
  terms           text,
  equity_pct      numeric(5,2) CHECK (equity_pct IS NULL OR equity_pct BETWEEN 0 AND 100),
  fee_amount      numeric(14,2),
  currency        char(3) NOT NULL DEFAULT 'INR',
  fit_score       score_100,
  health          text,
  started_on      date,
  ended_on        date,
  last_session_at timestamptz,
  next_session_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT mentorship_health_valid CHECK (health IS NULL OR health IN ('on_track','at_risk','stalled'))
);
CREATE UNIQUE INDEX mentorships_active_unique ON mentorships (mentor_id, startup_org_id)
  WHERE deleted_at IS NULL AND status IN ('requested','active','paused');
CREATE INDEX mentorships_mentor_idx ON mentorships (mentor_id, status) WHERE deleted_at IS NULL;
CREATE INDEX mentorships_startup_idx ON mentorships (startup_org_id, status) WHERE deleted_at IS NULL;

CREATE TABLE mentoring_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id    uuid NOT NULL REFERENCES mentorships (id) ON DELETE CASCADE,
  topic            text,
  session_type     text,
  status           session_status NOT NULL DEFAULT 'scheduled',
  scheduled_at     timestamptz NOT NULL,
  duration_min     smallint NOT NULL DEFAULT 45 CHECK (duration_min BETWEEN 5 AND 480),
  meeting_url      text,
  readiness_id     uuid REFERENCES startup_readiness (id) ON DELETE SET NULL,
  summary          text,
  action_items     text[] NOT NULL DEFAULT '{}',
  fee_amount       numeric(14,2),
  currency         char(3) NOT NULL DEFAULT 'INR',
  completed_at     timestamptz,
  cancelled_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mentoring_sessions_mentorship_idx ON mentoring_sessions (mentorship_id, scheduled_at DESC);
CREATE INDEX mentoring_sessions_upcoming_idx ON mentoring_sessions (scheduled_at)
  WHERE status IN ('scheduled','confirmed');

CREATE TABLE session_attendees (
  session_id uuid NOT NULL REFERENCES mentoring_sessions (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'startup' CHECK (role IN ('mentor','startup','observer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE mentor_deliverables (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id    uuid NOT NULL REFERENCES mentorships (id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  linked_criterion uuid REFERENCES readiness_criteria (id) ON DELETE SET NULL,
  owner_id         uuid REFERENCES users (id) ON DELETE SET NULL,
  due_on           date,
  status           deliverable_status NOT NULL DEFAULT 'not_started',
  file_id          uuid REFERENCES files (id) ON DELETE SET NULL,
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  evidence         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX mentor_deliverables_mentorship_idx ON mentor_deliverables (mentorship_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX mentor_deliverables_due_idx ON mentor_deliverables (due_on)
  WHERE deleted_at IS NULL AND status <> 'accepted';

CREATE TABLE mentor_agreements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id    uuid NOT NULL REFERENCES mentorships (id) ON DELETE CASCADE,
  agreement_type   text NOT NULL,
  terms            text,
  equity_pct       numeric(5,2) CHECK (equity_pct IS NULL OR equity_pct BETWEEN 0 AND 100),
  fee_amount       numeric(14,2),
  currency         char(3) NOT NULL DEFAULT 'INR',
  cadence          text,
  status           agreement_status NOT NULL DEFAULT 'draft',
  starts_on        date,
  ends_on          date,
  document_file_id uuid REFERENCES files (id) ON DELETE SET NULL,
  mentor_signed_at timestamptz,
  startup_signed_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mentor_agreements_mentorship_idx ON mentor_agreements (mentorship_id, status);

CREATE TABLE mentor_earnings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_id        uuid REFERENCES mentoring_sessions (id) ON DELETE SET NULL,
  gross_amount      numeric(14,2) NOT NULL CHECK (gross_amount >= 0),
  commission_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  tds_amount        numeric(14,2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),
  net_amount        numeric(14,2) NOT NULL,
  currency          char(3) NOT NULL DEFAULT 'INR',
  status            text NOT NULL DEFAULT 'pending',
  earned_on         date NOT NULL,
  payout_batch_id   uuid,          -- FK added in section 14
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_earning_math
    CHECK (net_amount = gross_amount - commission_amount - tds_amount),
  CONSTRAINT mentor_earning_status_valid
    CHECK (status IN ('pending','approved','in_payout','paid','held','reversed'))
);
CREATE INDEX mentor_earnings_mentor_idx ON mentor_earnings (mentor_id, earned_on DESC);
CREATE INDEX mentor_earnings_status_idx ON mentor_earnings (status)
  WHERE status IN ('pending','approved');


-- =============================================================================
-- 10.  MESSAGING & NOTIFICATIONS
-- =============================================================================
-- frontend: /*/messages /notifications (lib/notifications-data.js)

CREATE TABLE message_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            thread_kind NOT NULL DEFAULT 'direct',
  subject         text,
  org_id          uuid REFERENCES organizations (id) ON DELETE SET NULL,
  context_type    text,          -- 'offer','application','mentorship','deal'
  context_id      uuid,
  last_message_at timestamptz,
  created_by      uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX message_threads_recent_idx ON message_threads (last_message_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE TABLE message_thread_members (
  thread_id    uuid NOT NULL REFERENCES message_threads (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_read_at timestamptz,
  is_muted     boolean NOT NULL DEFAULT false,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  left_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX message_thread_members_user_idx ON message_thread_members (user_id) WHERE left_at IS NULL;

CREATE TABLE messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES message_threads (id) ON DELETE CASCADE,
  sender_id  uuid REFERENCES users (id) ON DELETE SET NULL,   -- NULL => system message
  kind       text NOT NULL DEFAULT 'text',
  body       text,
  file_id    uuid REFERENCES files (id) ON DELETE SET NULL,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz,
  deleted_at timestamptz,
  CONSTRAINT message_kind_valid CHECK (kind IN ('text','system','file','offer','card')),
  CONSTRAINT messages_have_content
    CHECK (body IS NOT NULL OR file_id IS NOT NULL OR kind = 'system')
);
CREATE INDEX messages_thread_idx ON messages (thread_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE message_receipts (
  message_id   uuid NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  read_at      timestamptz,
  delivered_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role         user_role,
  category     text NOT NULL,
  title        text NOT NULL,
  detail       text,
  icon         text,
  action_url   text,
  action_label text,
  is_urgent    boolean NOT NULL DEFAULT false,
  is_read      boolean NOT NULL DEFAULT false,
  read_at      timestamptz,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_inbox_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE NOT is_read;
CREATE INDEX notifications_urgent_idx ON notifications (user_id) WHERE is_urgent AND NOT is_read;

CREATE TABLE notification_preferences (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category   text NOT NULL,
  channel    notification_channel NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category, channel)
);

CREATE TABLE notification_deliveries (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id uuid REFERENCES notifications (id) ON DELETE CASCADE,
  channel         notification_channel NOT NULL,
  provider        text,
  status          text NOT NULL DEFAULT 'queued',
  attempts        smallint NOT NULL DEFAULT 0,
  error           text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_delivery_status_valid
    CHECK (status IN ('queued','sent','delivered','bounced','failed'))
);
CREATE INDEX notification_deliveries_status_idx ON notification_deliveries (status, created_at);


-- =============================================================================
-- 11.  COMMUNITY  (cross-role discussion space)
-- =============================================================================
-- frontend: /community /community/[role] /community/posts/[postId]
-- Cursor-paginated and time-indexed: this is the first table to reach 100k+ rows.

CREATE TABLE community_spaces (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               citext NOT NULL,
  name               text NOT NULL,
  category           space_category NOT NULL DEFAULT 'discussion',
  description        text,
  rules              text[] NOT NULL DEFAULT '{}',
  audience           text,
  allowed_roles      user_role[] NOT NULL DEFAULT '{}',   -- empty => every role
  allowed_post_types post_type[] NOT NULL DEFAULT '{discussion}',
  anonymous_allowed  boolean NOT NULL DEFAULT false,
  icon               text,
  member_count       integer NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  is_archived        boolean NOT NULL DEFAULT false,
  display_order      smallint NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX community_spaces_slug_key ON community_spaces (slug);
CREATE INDEX community_spaces_order_idx ON community_spaces (display_order) WHERE NOT is_archived;

CREATE TABLE community_space_members (
  space_id      uuid NOT NULL REFERENCES community_spaces (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_in_space text NOT NULL DEFAULT 'member',
  joined_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id),
  CONSTRAINT space_role_valid CHECK (role_in_space IN ('member','moderator','host'))
);
CREATE INDEX community_space_members_user_idx ON community_space_members (user_id);

CREATE TABLE community_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id            uuid NOT NULL REFERENCES community_spaces (id) ON DELETE CASCADE,
  author_id           uuid REFERENCES users (id) ON DELETE SET NULL,   -- NULL when anonymised
  is_anonymous        boolean NOT NULL DEFAULT false,
  post_type           post_type NOT NULL DEFAULT 'discussion',
  title               text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 300),
  content             text NOT NULL,
  tags                text[] NOT NULL DEFAULT '{}',
  stage_badge         text,
  status              post_status NOT NULL DEFAULT 'published',
  helpful_votes       integer NOT NULL DEFAULT 0 CHECK (helpful_votes >= 0),
  comment_count       integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  accepted_comment_id uuid,          -- FK added below (circular relation)
  pinned_at           timestamptz,
  locked_at           timestamptz,
  removed_reason      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX community_posts_feed_idx ON community_posts (space_id, created_at DESC, id)
  WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX community_posts_author_idx ON community_posts (author_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX community_posts_trending_idx ON community_posts (space_id, helpful_votes DESC)
  WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX community_posts_tags_idx ON community_posts USING gin (tags);
CREATE INDEX community_posts_search_idx ON community_posts
  USING gin (to_tsvector('english', title || ' ' || content));

CREATE TABLE community_comments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        uuid NOT NULL REFERENCES community_posts (id) ON DELETE CASCADE,
  parent_id      uuid REFERENCES community_comments (id) ON DELETE CASCADE,
  author_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  is_anonymous   boolean NOT NULL DEFAULT false,
  body           text NOT NULL CHECK (length(btrim(body)) > 0),
  helpful_votes  integer NOT NULL DEFAULT 0 CHECK (helpful_votes >= 0),
  is_accepted    boolean NOT NULL DEFAULT false,
  expert_label   text,
  is_expert      boolean NOT NULL DEFAULT false,
  status         post_status NOT NULL DEFAULT 'published',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX community_comments_post_idx ON community_comments (post_id, created_at)
  WHERE deleted_at IS NULL;
CREATE INDEX community_comments_parent_idx ON community_comments (parent_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX community_comments_one_accepted ON community_comments (post_id) WHERE is_accepted;

ALTER TABLE community_posts
  ADD CONSTRAINT community_posts_accepted_comment_fk
  FOREIGN KEY (accepted_comment_id) REFERENCES community_comments (id) ON DELETE SET NULL;

CREATE TABLE community_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id    uuid REFERENCES community_posts (id) ON DELETE CASCADE,
  comment_id uuid REFERENCES community_comments (id) ON DELETE CASCADE,
  kind       reaction_kind NOT NULL DEFAULT 'helpful',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reaction_target_exactly_one CHECK ((post_id IS NULL) <> (comment_id IS NULL))
);
CREATE UNIQUE INDEX community_reactions_unique ON community_reactions
  (user_id, kind, COALESCE(post_id, comment_id));
CREATE INDEX community_reactions_post_idx ON community_reactions (post_id, kind);

CREATE TABLE community_post_views (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id    uuid NOT NULL REFERENCES community_posts (id) ON DELETE CASCADE,
  viewer_id  uuid REFERENCES users (id) ON DELETE SET NULL,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_post_views_idx ON community_post_views (post_id, viewed_at DESC);

-- AMAs (UPCOMING_AMAS in the UI).
CREATE TABLE community_amas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  host_user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  topic            text,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz,
  attendee_count   integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_amas_upcoming_idx ON community_amas (starts_at);

CREATE TABLE community_rsvps (
  ama_id     uuid NOT NULL REFERENCES community_amas (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ama_id, user_id)
);

-- Pre-publication compliance scan (analyzePostCompliance in the UI).
CREATE TABLE moderation_scans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type   moderation_target NOT NULL,
  target_id     uuid NOT NULL,
  engine        text NOT NULL DEFAULT 'rules',
  risk_score    score_100,
  verdict       text NOT NULL,
  matched_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderation_scan_verdict_valid CHECK (verdict IN ('allow','flag','block'))
);
CREATE INDEX moderation_scans_target_idx ON moderation_scans (target_type, target_id, created_at DESC);


-- =============================================================================
-- 12.  EVENTS
-- =============================================================================
-- frontend: /mentor/events /investor/events /admin/events

CREATE TABLE events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_org_id    uuid REFERENCES organizations (id) ON DELETE SET NULL,
  host_user_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  name           text NOT NULL,
  description    text,
  format         text NOT NULL DEFAULT 'virtual',
  focus          text,
  access         text NOT NULL DEFAULT 'open',
  location       text,
  meeting_url    text,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz,
  capacity       smallint CHECK (capacity IS NULL OR capacity > 0),
  attendee_count integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'scheduled',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CONSTRAINT event_format_valid CHECK (format IN ('virtual','in_person','hybrid')),
  CONSTRAINT event_access_valid CHECK (access IN ('open','invite','paid','members')),
  CONSTRAINT event_status_valid CHECK (status IN ('scheduled','live','completed','cancelled')),
  CONSTRAINT events_time_order CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX events_upcoming_idx ON events (starts_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL;
CREATE INDEX events_host_org_idx ON events (host_org_id);

CREATE TABLE event_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'registered',
  registered_at timestamptz NOT NULL DEFAULT now(),
  attended_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_registration_status_valid
    CHECK (status IN ('registered','waitlisted','attended','cancelled','no_show'))
);
CREATE UNIQUE INDEX event_registrations_unique ON event_registrations (event_id, user_id);
CREATE INDEX event_registrations_user_idx ON event_registrations (user_id, registered_at DESC);


-- =============================================================================
-- 13.  TRUST & SAFETY / MODERATION
-- =============================================================================
-- frontend: /admin/moderation /admin/appeals /admin/disputes /admin/fraud
--           /admin/verifications /admin/policies

CREATE TABLE verifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id   uuid REFERENCES users (id) ON DELETE CASCADE,
  subject_org_id    uuid REFERENCES organizations (id) ON DELETE CASCADE,
  verification_type text NOT NULL,
  applicant_name    text,
  region            text,
  status            review_state NOT NULL DEFAULT 'pending',
  risk              risk_tier NOT NULL DEFAULT 'low',
  checks_summary    text,
  checks_passed     smallint NOT NULL DEFAULT 0,
  checks_total      smallint NOT NULL DEFAULT 0,
  sla_due_at        timestamptz,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_type_valid
    CHECK (verification_type IN ('identity','company','founder','investor','kyc','mentor','dpiit')),
  CONSTRAINT verification_has_one_subject
    CHECK ((subject_user_id IS NULL) <> (subject_org_id IS NULL))
);
CREATE INDEX verifications_queue_idx ON verifications (status, sla_due_at);
CREATE INDEX verifications_type_idx ON verifications (verification_type, status);
CREATE INDEX verifications_expiry_idx ON verifications (expires_at)
  WHERE status = 'verified' AND expires_at IS NOT NULL;

CREATE TABLE verification_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id  uuid NOT NULL REFERENCES verifications (id) ON DELETE CASCADE,
  check_name       text NOT NULL,
  provider         text,
  result           text NOT NULL DEFAULT 'pending',
  detail           text,
  evidence_file_id uuid REFERENCES files (id) ON DELETE SET NULL,
  checked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_check_result_valid
    CHECK (result IN ('pending','passed','failed','skipped'))
);
CREATE INDEX verification_checks_verification_idx ON verification_checks (verification_id);

-- Policy engine (/admin/policies).
CREATE TABLE trust_policies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  version        text NOT NULL DEFAULT '1.0',
  category       text NOT NULL,
  effective_date date,
  severity       severity_level NOT NULL DEFAULT 'medium',
  status         text NOT NULL DEFAULT 'draft',
  summary        text,
  surfaces       text[] NOT NULL DEFAULT '{}',
  actions        policy_action[] NOT NULL DEFAULT '{}',
  hit_count      integer NOT NULL DEFAULT 0,
  owner_id       uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trust_policy_status_valid CHECK (status IN ('draft','active','retired')),
  CONSTRAINT trust_policy_version_unique UNIQUE (title, version)
);
CREATE INDEX trust_policies_status_idx ON trust_policies (status, category);

CREATE TABLE policy_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id     uuid NOT NULL REFERENCES trust_policies (id) ON DELETE CASCADE,
  name          text NOT NULL,
  rule_type     text NOT NULL,
  surface       text,
  severity      severity_level NOT NULL DEFAULT 'medium',
  action        policy_action NOT NULL DEFAULT 'flag',
  state         text NOT NULL DEFAULT 'active',
  pattern       text,
  hits_30d      integer NOT NULL DEFAULT 0,
  precision_pct numeric(5,2) CHECK (precision_pct IS NULL OR precision_pct BETWEEN 0 AND 100),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT policy_rule_state_valid CHECK (state IN ('active','paused','draft'))
);
CREATE INDEX policy_rules_policy_idx ON policy_rules (policy_id, state);

CREATE TABLE policy_blocklists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  category     text NOT NULL,
  entry_count  integer NOT NULL DEFAULT 0,
  examples     text[] NOT NULL DEFAULT '{}',
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE moderation_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type     text NOT NULL,          -- content, user_report, appeal, dispute, fraud
  policy_id     uuid REFERENCES trust_policies (id) ON DELETE SET NULL,
  source        text,
  severity      severity_level NOT NULL DEFAULT 'medium',
  subject_type  moderation_target,
  subject_id    uuid,
  subject_label text,
  report_count  integer NOT NULL DEFAULT 0,
  status        case_status NOT NULL DEFAULT 'open',
  priority      case_priority NOT NULL DEFAULT 'normal',
  assigned_to   uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  sla_due_at    timestamptz,
  resolution    text,
  resolved_by   uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_cases_queue_idx ON moderation_cases (status, priority, sla_due_at);
CREATE INDEX moderation_cases_subject_idx ON moderation_cases (subject_type, subject_id);
CREATE INDEX moderation_cases_type_idx ON moderation_cases (case_type, status);

CREATE TABLE user_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users (id) ON DELETE SET NULL,
  target_type moderation_target NOT NULL,
  target_id   uuid NOT NULL,
  category    text NOT NULL,
  severity    severity_level NOT NULL DEFAULT 'medium',
  status      case_status NOT NULL DEFAULT 'open',
  description text,
  case_id     uuid REFERENCES moderation_cases (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_reports_queue_idx ON user_reports (status, severity, created_at);
CREATE INDEX user_reports_target_idx ON user_reports (target_type, target_id);

CREATE TABLE moderation_appeals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES users (id) ON DELETE SET NULL,
  original_case_id  uuid REFERENCES moderation_cases (id) ON DELETE SET NULL,
  original_decision text NOT NULL,
  reason            text NOT NULL,
  status            case_status NOT NULL DEFAULT 'open',
  priority          case_priority NOT NULL DEFAULT 'normal',
  outcome           text,
  assigned_to       uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  decided_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_appeals_queue_idx ON moderation_appeals (status, priority);

CREATE TABLE disputes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  parties       text,
  claimant_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  respondent_id uuid REFERENCES users (id) ON DELETE SET NULL,
  amount        numeric(14,2),
  currency      char(3) NOT NULL DEFAULT 'INR',
  escrow_status text,
  status        case_status NOT NULL DEFAULT 'open',
  reason        text,
  deadline      date,
  assigned_to   uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  resolution    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispute_escrow_valid
    CHECK (escrow_status IS NULL OR escrow_status IN ('none','held','released','refunded'))
);
CREATE INDEX disputes_queue_idx ON disputes (status, deadline);

CREATE TABLE fraud_detections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_type      text NOT NULL,
  target_type      moderation_target,
  target_id        uuid,
  target_label     text,
  risk_score       score_100,
  signals          text[] NOT NULL DEFAULT '{}',
  automated_action policy_action,
  status           case_status NOT NULL DEFAULT 'open',
  detected_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_by      uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fraud_detections_queue_idx ON fraud_detections (status, risk_score DESC);

-- Lookup so job_offers can reference a decline reason (declared in section 7).
CREATE TABLE offer_decline_reasons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL,
  label      text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX offer_decline_reasons_code_key ON offer_decline_reasons (code);

ALTER TABLE job_offers
  ADD CONSTRAINT job_offers_decline_reason_fk
  FOREIGN KEY (decline_reason_id) REFERENCES offer_decline_reasons (id) ON DELETE SET NULL;


-- =============================================================================
-- 14.  BILLING, PLANS, PAYMENTS & PAYOUTS
-- =============================================================================
-- frontend: /employer/billing /investor/billing /mentor/earnings
--           /admin/billing /admin/plans /admin/payouts

CREATE TABLE plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  role_audience    plan_audience NOT NULL,
  cycle            plan_cycle NOT NULL DEFAULT 'monthly',
  monthly_price    numeric(14,2),
  annual_price     numeric(14,2),
  currency         char(3) NOT NULL DEFAULT 'INR',
  status           plan_status NOT NULL DEFAULT 'draft',
  description      text,
  subscriber_count integer NOT NULL DEFAULT 0,
  trial_days       smallint NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plans_name_audience_key ON plans (name, role_audience);
CREATE INDEX plans_active_idx ON plans (role_audience) WHERE status = 'active';

CREATE TABLE entitlements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL,
  name        text NOT NULL,
  category    text,
  unit        text,          -- 'seats', 'job_posts', 'credits'
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX entitlements_key_key ON entitlements (key);

CREATE TABLE plan_entitlements (
  plan_id        uuid NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL REFERENCES entitlements (id) ON DELETE CASCADE,
  included_qty   integer NOT NULL DEFAULT 0 CHECK (included_qty >= 0),
  limit_qty      integer CHECK (limit_qty IS NULL OR limit_qty >= 0),   -- NULL = unlimited
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, entitlement_id)
);

CREATE TABLE subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid REFERENCES organizations (id) ON DELETE CASCADE,
  user_id              uuid REFERENCES users (id) ON DELETE CASCADE,
  plan_id              uuid NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  status               subscription_status NOT NULL DEFAULT 'trialing',
  seats                smallint NOT NULL DEFAULT 1 CHECK (seats > 0),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end   timestamptz NOT NULL,
  trial_ends_at        timestamptz,
  cancel_at            timestamptz,
  cancelled_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_has_one_owner CHECK ((org_id IS NULL) <> (user_id IS NULL))
);
CREATE INDEX subscriptions_org_idx ON subscriptions (org_id)
  WHERE status IN ('trialing','active','past_due');
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id)
  WHERE status IN ('trialing','active','past_due');

CREATE TABLE promotions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             citext NOT NULL,
  discount_pct     numeric(5,2) CHECK (discount_pct IS NULL OR discount_pct BETWEEN 0 AND 100),
  discount_amount  numeric(14,2),
  applicable_roles user_role[] NOT NULL DEFAULT '{}',
  valid_from       date,
  valid_until      date,
  usage_limit      integer,
  usage_count      integer NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotion_status_valid CHECK (status IN ('active','expired','disabled')),
  CONSTRAINT promotion_has_discount CHECK (discount_pct IS NOT NULL OR discount_amount IS NOT NULL)
);
CREATE UNIQUE INDEX promotions_code_key ON promotions (code);
CREATE INDEX promotions_live_idx ON promotions (valid_until) WHERE status = 'active';

-- One-off purchases: job packs, featured listings, invite packs, credit packs.
CREATE TABLE billing_products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           text NOT NULL,
  name          text NOT NULL,
  product_type  text NOT NULL,
  unit_quantity integer NOT NULL DEFAULT 1,
  validity_days smallint,
  price         numeric(14,2) NOT NULL CHECK (price >= 0),
  tax_pct       numeric(5,2) NOT NULL DEFAULT 18.00,
  currency      char(3) NOT NULL DEFAULT 'INR',
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_product_type_valid
    CHECK (product_type IN ('job_pack','featured_listing','invite_pack','credit_pack','seat','addon'))
);
CREATE UNIQUE INDEX billing_products_sku_key ON billing_products (sku);

CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  text NOT NULL,
  org_id          uuid REFERENCES organizations (id) ON DELETE SET NULL,
  user_id         uuid REFERENCES users (id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions (id) ON DELETE SET NULL,
  period_label    text,
  subtotal        numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(14,2) NOT NULL DEFAULT 0,
  total_amount    numeric(14,2) NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'INR',
  status          invoice_status NOT NULL DEFAULT 'draft',
  issued_on       date,
  due_on          date,
  paid_at         timestamptz,
  purchase_order  text,
  file_id         uuid REFERENCES files (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_total_math CHECK (total_amount = subtotal + tax_amount)
);
CREATE UNIQUE INDEX invoices_number_key ON invoices (invoice_number);
CREATE INDEX invoices_org_idx ON invoices (org_id, issued_on DESC);
CREATE INDEX invoices_open_idx ON invoices (status, due_on) WHERE status IN ('issued','overdue');

CREATE TABLE invoice_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    smallint NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  numeric(14,2) NOT NULL,
  line_total  numeric(14,2) NOT NULL,
  product_id  uuid REFERENCES billing_products (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_lines_invoice_idx ON invoice_lines (invoice_id);

CREATE TABLE payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid REFERENCES invoices (id) ON DELETE SET NULL,
  org_id         uuid REFERENCES organizations (id) ON DELETE SET NULL,
  user_id        uuid REFERENCES users (id) ON DELETE SET NULL,
  provider       payment_provider NOT NULL,
  provider_ref   text,
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  tax_amount     numeric(14,2) NOT NULL DEFAULT 0,
  currency       char(3) NOT NULL DEFAULT 'INR',
  status         payment_status NOT NULL DEFAULT 'pending',
  failure_reason text,
  captured_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_provider_ref_key ON payments (provider, provider_ref)
  WHERE provider_ref IS NOT NULL;
CREATE INDEX payments_created_idx ON payments (created_at DESC);
CREATE INDEX payments_status_idx ON payments (status)
  WHERE status IN ('pending','authorized','failed');

CREATE TABLE payment_methods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid REFERENCES organizations (id) ON DELETE CASCADE,
  user_id        uuid REFERENCES users (id) ON DELETE CASCADE,
  method_type    payment_provider NOT NULL,
  label          text,
  last4          varchar(4),
  expiry_month   smallint CHECK (expiry_month IS NULL OR expiry_month BETWEEN 1 AND 12),
  expiry_year    smallint,
  provider_token text,          -- vaulted token from the PSP, never a PAN
  is_default     boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CONSTRAINT payment_method_status_valid CHECK (status IN ('active','expired','removed'))
);
CREATE UNIQUE INDEX payment_methods_one_default ON payment_methods (org_id)
  WHERE is_default AND deleted_at IS NULL;
CREATE INDEX payment_methods_org_idx ON payment_methods (org_id) WHERE deleted_at IS NULL;

CREATE TABLE refunds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid REFERENCES payments (id) ON DELETE SET NULL,
  user_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  org_id       uuid REFERENCES organizations (id) ON DELETE SET NULL,
  amount       numeric(14,2) NOT NULL CHECK (amount > 0),
  currency     char(3) NOT NULL DEFAULT 'INR',
  reason       text,
  refund_type  text NOT NULL DEFAULT 'full',
  status       refund_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  provider_ref text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refund_type_valid CHECK (refund_type IN ('full','partial','goodwill'))
);
CREATE INDEX refunds_status_idx ON refunds (status, requested_at);

-- Metered credits (/employer/billing credit tracker).
CREATE TABLE credit_wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations (id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users (id) ON DELETE CASCADE,
  credit_type text NOT NULL,          -- 'invites', 'featured', 'job_posts'
  balance     integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_wallet_has_one_owner CHECK ((org_id IS NULL) <> (user_id IS NULL))
);
CREATE UNIQUE INDEX credit_wallets_unique
  ON credit_wallets (COALESCE(org_id, user_id), credit_type);

CREATE TABLE credit_transactions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id    uuid NOT NULL REFERENCES credit_wallets (id) ON DELETE CASCADE,
  delta        integer NOT NULL CHECK (delta <> 0),
  reason       text NOT NULL,
  reference_id uuid,
  expires_at   timestamptz,
  created_by   uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_transactions_wallet_idx ON credit_transactions (wallet_id, created_at DESC);

CREATE TABLE usage_meters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  meter_key   text NOT NULL,
  used_value  integer NOT NULL DEFAULT 0 CHECK (used_value >= 0),
  limit_value integer CHECK (limit_value IS NULL OR limit_value >= 0),
  reset_on    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usage_meters_unique ON usage_meters (org_id, meter_key);

-- Payout runs to mentors (maker/checker: AGENTS.md §4 admin controls).
CREATE TABLE payout_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code        text NOT NULL,
  run_date          date NOT NULL,
  status            payout_status NOT NULL DEFAULT 'draft',
  payee_count       integer NOT NULL DEFAULT 0,
  gross_amount      numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  tds_amount        numeric(14,2) NOT NULL DEFAULT 0,
  net_amount        numeric(14,2) NOT NULL DEFAULT 0,
  held_count        integer NOT NULL DEFAULT 0,
  maker_id          uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  checker_id        uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  provider          payment_provider,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_net_math CHECK (net_amount = gross_amount - commission_amount - tds_amount),
  CONSTRAINT payout_maker_checker CHECK (checker_id IS NULL OR checker_id <> maker_id)
);
CREATE UNIQUE INDEX payout_batches_code_key ON payout_batches (batch_code);
CREATE INDEX payout_batches_status_idx ON payout_batches (status, run_date DESC);

ALTER TABLE mentor_earnings
  ADD CONSTRAINT mentor_earnings_batch_fk
  FOREIGN KEY (payout_batch_id) REFERENCES payout_batches (id) ON DELETE SET NULL;

CREATE TABLE payout_holds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_id    uuid REFERENCES users (id) ON DELETE CASCADE,
  earning_id  uuid REFERENCES mentor_earnings (id) ON DELETE CASCADE,
  amount      numeric(14,2) NOT NULL CHECK (amount > 0),
  currency    char(3) NOT NULL DEFAULT 'INR',
  reason      text NOT NULL,
  status      hold_status NOT NULL DEFAULT 'active',
  hold_date   date NOT NULL DEFAULT CURRENT_DATE,
  expires_on  date,
  released_by uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payout_holds_active_idx ON payout_holds (status) WHERE status = 'active';

CREATE TABLE spending_controls (
  org_id             uuid PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
  who_can_buy        text NOT NULL DEFAULT 'owner',
  approval_threshold numeric(14,2),
  monthly_cap        numeric(14,2),
  auto_purchase      boolean NOT NULL DEFAULT false,
  notify_on_purchase boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spending_buyer_valid CHECK (who_can_buy IN ('owner','admins','all_members'))
);

CREATE TABLE reconciliation_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        payment_provider NOT NULL,
  settlement_date date NOT NULL,
  expected_amount numeric(14,2) NOT NULL,
  received_amount numeric(14,2) NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'INR',
  status          text NOT NULL DEFAULT 'matched',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconciliation_status_valid
    CHECK (status IN ('matched','shortfall','excess','pending'))
);
CREATE UNIQUE INDEX reconciliation_unique ON reconciliation_records (provider, settlement_date);
CREATE INDEX reconciliation_date_idx ON reconciliation_records (provider, settlement_date DESC);

CREATE TABLE dunning_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  attempt_no     smallint NOT NULL DEFAULT 1,
  stage          text NOT NULL,          -- 'retry_1', 'retry_2', 'final_notice'
  failure_reason text,
  next_action_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dunning_attempts_invoice_idx ON dunning_attempts (invoice_id, created_at DESC);


-- =============================================================================
-- 15.  COMPLIANCE, PRIVACY & DATA RIGHTS
-- =============================================================================
-- frontend: /admin/compliance /admin/data-requests

CREATE TABLE data_processing_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity      text NOT NULL,
  purpose       text,
  legal_basis   text,
  subject_types text,
  recipients    text,
  retention     text,
  region        text,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT processing_record_status_valid
    CHECK (status IN ('active','under_review','retired'))
);

CREATE TABLE compliance_vendors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor     text NOT NULL,
  service    text,
  region     text,
  terms      text,
  risk_tier  risk_tier NOT NULL DEFAULT 'low',
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_status_valid CHECK (status IN ('active','review_due','terminated'))
);

CREATE TABLE compliance_incidents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type          text NOT NULL,
  severity               severity_level NOT NULL DEFAULT 'medium',
  aware_at               timestamptz NOT NULL,
  status                 case_status NOT NULL DEFAULT 'open',
  subject_count          integer NOT NULL DEFAULT 0,
  notification_clock_due timestamptz,          -- 72-hour regulator clock
  summary                text,
  closed_at              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX compliance_incidents_open_idx ON compliance_incidents (status) WHERE status <> 'closed';

CREATE TABLE legal_holds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        text NOT NULL,
  reason       text NOT NULL,
  requested_by text,
  placed_by    uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'active',
  placed_at    timestamptz NOT NULL DEFAULT now(),
  released_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_hold_status_valid CHECK (status IN ('active','released','expired'))
);
CREATE INDEX legal_holds_active_idx ON legal_holds (status) WHERE status = 'active';

CREATE TABLE consent_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  version         text NOT NULL,
  language        text,
  opt_in_rate     numeric(5,2),
  status          text NOT NULL DEFAULT 'active',
  last_audited_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_status_valid CHECK (status IN ('draft','active','retired'))
);
CREATE UNIQUE INDEX consent_records_version_key ON consent_records (title, version, language);

-- Per-user acceptance is what makes the audit trail defensible.
CREATE TABLE user_consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  consent_id  uuid NOT NULL REFERENCES consent_records (id) ON DELETE CASCADE,
  accepted    boolean NOT NULL,
  ip          inet,
  user_agent  text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_consents_user_idx ON user_consents (user_id, accepted_at DESC);

CREATE TABLE dpia_assessments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name    text NOT NULL,
  risk_level     risk_tier NOT NULL DEFAULT 'medium',
  residual_risk  risk_tier,
  reviewer_id    uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'in_review',
  next_review_on date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dpia_status_valid CHECK (status IN ('draft','in_review','approved','rejected'))
);

CREATE TABLE compliance_trainings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  scope          text,
  completion_pct numeric(5,2),
  status         text NOT NULL DEFAULT 'active',
  renew_on       date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE compliance_calendar (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  due_date   date NOT NULL,
  title      text NOT NULL,
  item_type  text,
  owner_id   uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  status     text NOT NULL DEFAULT 'upcoming',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_calendar_status_valid
    CHECK (status IN ('upcoming','done','overdue','waived'))
);
CREATE INDEX compliance_calendar_due_idx ON compliance_calendar (due_date)
  WHERE status IN ('upcoming','overdue');

-- DPDP/GDPR rights requests (/admin/data-requests).
CREATE TABLE data_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type       data_request_type NOT NULL,
  authority          text,
  data_subject_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  data_subject_label text,
  scope              text,
  status             data_request_status NOT NULL DEFAULT 'received',
  priority           case_priority NOT NULL DEFAULT 'normal',
  records_identified integer NOT NULL DEFAULT 0,
  received_at        timestamptz NOT NULL DEFAULT now(),
  due_at             timestamptz NOT NULL,
  fulfilled_at       timestamptz,
  assigned_to        uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  rejection_reason   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX data_requests_queue_idx ON data_requests (status, due_at);
CREATE INDEX data_requests_subject_idx ON data_requests (data_subject_id);

CREATE TABLE compliance_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  period       text,
  format       text NOT NULL DEFAULT 'pdf',
  status       text NOT NULL DEFAULT 'generating',
  file_id      uuid REFERENCES files (id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_report_status_valid
    CHECK (status IN ('generating','ready','failed','expired'))
);


-- =============================================================================
-- 16.  ADMIN CONSOLE: FLAGS, INTEGRATIONS, SYSTEM, OPPORTUNITIES, SUPPORT
-- =============================================================================
-- frontend: /admin/config /admin/integrations /admin/system
--           /admin/opportunities /admin/support /admin/ai-quality /admin/matching

CREATE TABLE feature_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text NOT NULL,
  name         text NOT NULL,
  description  text,
  flag_type    flag_kind NOT NULL DEFAULT 'boolean',
  value        jsonb NOT NULL DEFAULT 'false'::jsonb,
  status       text NOT NULL DEFAULT 'off',
  environments text[] NOT NULL DEFAULT '{production}',
  rollout_pct  smallint NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  changed_by   uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feature_flag_status_valid CHECK (status IN ('off','on','staged','archived'))
);
CREATE UNIQUE INDEX feature_flags_key_key ON feature_flags (key);

CREATE TABLE platform_limits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_key  text NOT NULL,
  label      text NOT NULL,
  value_num  numeric(18,4),
  value_text text,
  unit       text,
  scope      text NOT NULL DEFAULT 'global',
  updated_by uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_limit_has_value CHECK (value_num IS NOT NULL OR value_text IS NOT NULL),
  CONSTRAINT platform_limit_scope_valid CHECK (scope IN ('global','org','user'))
);
CREATE UNIQUE INDEX platform_limits_key_key ON platform_limits (limit_key);

CREATE TABLE integration_providers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key     text NOT NULL,
  name             text NOT NULL,
  category         text NOT NULL,          -- payments, email, ai, storage, kyc
  status           text NOT NULL DEFAULT 'active',
  quota_text       text,
  rotation         text,
  fallback_enabled boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_status_valid
    CHECK (status IN ('active','degraded','disabled','failed'))
);
CREATE UNIQUE INDEX integration_providers_key_key ON integration_providers (provider_key);

CREATE TABLE webhook_endpoints (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       uuid NOT NULL REFERENCES integration_providers (id) ON DELETE CASCADE,
  endpoint_url      text NOT NULL,
  secret_ref        text,          -- secret-manager reference, never the secret
  delivery_rate_pct numeric(5,2),
  avg_latency_ms    integer,
  status            text NOT NULL DEFAULT 'active',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_endpoint_status_valid CHECK (status IN ('active','paused','disabled'))
);
CREATE INDEX webhook_endpoints_provider_idx ON webhook_endpoints (provider_id);

CREATE TABLE webhook_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id  uuid REFERENCES integration_providers (id) ON DELETE SET NULL,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_ok boolean,
  status       text NOT NULL DEFAULT 'received',
  attempts     smallint NOT NULL DEFAULT 0,
  error        text,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_event_status_valid
    CHECK (status IN ('received','processed','failed','retried'))
);
CREATE INDEX webhook_events_status_idx ON webhook_events (status, received_at);

CREATE TABLE system_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key    text NOT NULL,
  name           text NOT NULL,
  tier           smallint NOT NULL DEFAULT 1,
  status         service_status NOT NULL DEFAULT 'operational',
  slo_attainment numeric(5,2),
  p95_ms         integer,
  error_rate_pct numeric(5,3),
  owner          text,
  checked_at     timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX system_services_key_key ON system_services (service_key);

CREATE TABLE system_incidents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  severity    severity_level NOT NULL DEFAULT 'medium',
  state       text NOT NULL DEFAULT 'open',
  affected    text,
  impact      text,
  started_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_state_valid
    CHECK (state IN ('open','investigating','identified','monitoring','resolved'))
);
CREATE INDEX system_incidents_open_idx ON system_incidents (state) WHERE state <> 'resolved';

CREATE TABLE system_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid REFERENCES system_services (id) ON DELETE CASCADE,
  rule        text NOT NULL,
  severity    severity_level NOT NULL DEFAULT 'medium',
  state       text NOT NULL DEFAULT 'firing',
  incident_id uuid REFERENCES system_incidents (id) ON DELETE SET NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_state_valid CHECK (state IN ('firing','acknowledged','resolved'))
);
CREATE INDEX system_alerts_state_idx ON system_alerts (state, started_at DESC);

-- Grants and marketplace items surfaced to startups (/admin/opportunities).
CREATE TABLE opportunities (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  category           text NOT NULL,
  provider           text,
  grant_amount       numeric(14,2),
  currency           char(3) NOT NULL DEFAULT 'INR',
  stage              startup_stage,
  deadline           date,
  verification_state review_state NOT NULL DEFAULT 'pending',
  url                text,
  description        text,
  status             text NOT NULL DEFAULT 'draft',
  referred_count     integer NOT NULL DEFAULT 0,
  created_by         uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_status_valid CHECK (status IN ('draft','active','expired','archived'))
);
CREATE INDEX opportunities_live_idx ON opportunities (status, deadline) WHERE status = 'active';

CREATE TABLE opportunity_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  org_id         uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id        uuid REFERENCES users (id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'referred',
  referred_at    timestamptz NOT NULL DEFAULT now(),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_application_status_valid
    CHECK (status IN ('referred','submitted','shortlisted','awarded','rejected','withdrawn'))
);
CREATE UNIQUE INDEX opportunity_applications_unique ON opportunity_applications (opportunity_id, org_id);
CREATE INDEX opportunity_applications_status_idx ON opportunity_applications (opportunity_id, status);

-- Matching weights + fairness metrics (/admin/matching).
CREATE TABLE matching_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  surface        text NOT NULL,          -- 'jobs', 'investors', 'mentors'
  weight         numeric(6,3) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  status         text NOT NULL DEFAULT 'active',
  description    text,
  fairness_check text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matching_rule_status_valid CHECK (status IN ('active','paused','draft'))
);
CREATE INDEX matching_rules_surface_idx ON matching_rules (surface, status);

CREATE TABLE fairness_metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric      text NOT NULL,
  surface     text,
  status      text NOT NULL DEFAULT 'ok',
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fairness_status_valid CHECK (status IN ('ok','watch','breach'))
);
CREATE INDEX fairness_metrics_recent_idx ON fairness_metrics (measured_at DESC);

-- AI quality review queue (/admin/ai-quality).
CREATE TABLE ai_models (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name      text NOT NULL,
  surface         text NOT NULL,
  provider        text,
  last_audited_at timestamptz,
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_model_status_valid CHECK (status IN ('active','degraded','disabled','retired'))
);
CREATE UNIQUE INDEX ai_models_key ON ai_models (model_name, surface);

CREATE TABLE ai_reviews (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature            text NOT NULL,
  category           text,
  source             text,
  requested_by       uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  subject_type       moderation_target,
  subject_id         uuid,
  submitted_at       timestamptz NOT NULL DEFAULT now(),
  sla_deadline       timestamptz,
  status             case_status NOT NULL DEFAULT 'open',
  rubric_version     text,
  ai_score           score_100,
  disputed_dimension text,
  reviewer_id        uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  decision           text,
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_reviews_queue_idx ON ai_reviews (status, sla_deadline);

-- Content library (/admin/content, /admin/templates).
CREATE TABLE content_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type   text NOT NULL,
  title          text NOT NULL,
  audience       text,
  status         text NOT NULL DEFAULT 'draft',
  version        text NOT NULL DEFAULT 'v1',
  owner_id       uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  view_count     integer NOT NULL DEFAULT 0,
  feedback_score numeric(3,2),
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_item_status_valid
    CHECK (status IN ('draft','scheduled','published','archived'))
);
CREATE INDEX content_items_status_idx ON content_items (status, content_type);

CREATE TABLE content_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES content_items (id) ON DELETE CASCADE,
  version    text NOT NULL,
  body       text,
  file_id    uuid REFERENCES files (id) ON DELETE SET NULL,
  created_by uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_versions_content_idx ON content_versions (content_id, created_at DESC);

-- Help centre + support tickets (/help, /help/tickets/[ticketId], /admin/support).
CREATE TABLE help_articles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          citext NOT NULL,
  title         text NOT NULL,
  topic         text,
  audience      user_role,
  body          text,
  status        text NOT NULL DEFAULT 'published',
  view_count    integer NOT NULL DEFAULT 0,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT help_article_status_valid CHECK (status IN ('draft','published','archived'))
);
CREATE UNIQUE INDEX help_articles_slug_key ON help_articles (slug);

CREATE TABLE support_ticket_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL,
  label      text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX support_ticket_categories_key_key ON support_ticket_categories (key);

CREATE TABLE support_tickets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number     text NOT NULL,
  requester_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  requester_org     uuid REFERENCES organizations (id) ON DELETE SET NULL,
  requester_role    user_role,
  channel           support_channel NOT NULL DEFAULT 'in_app',
  subject           text NOT NULL,
  category_id       uuid REFERENCES support_ticket_categories (id) ON DELETE SET NULL,
  priority          ticket_priority NOT NULL DEFAULT 'normal',
  status            ticket_status NOT NULL DEFAULT 'open',
  assigned_to       uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  sla_target_at     timestamptz,
  sla_state         text NOT NULL DEFAULT 'on_track',
  first_response_at timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_sla_state_valid
    CHECK (sla_state IN ('on_track','at_risk','breached','met'))
);
CREATE UNIQUE INDEX support_tickets_number_key ON support_tickets (ticket_number);
CREATE INDEX support_tickets_queue_idx ON support_tickets (status, priority, sla_target_at);
CREATE INDEX support_tickets_requester_idx ON support_tickets (requester_id, created_at DESC);

CREATE TABLE support_ticket_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
  author_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  is_internal boolean NOT NULL DEFAULT false,       -- staff-only note
  body        text NOT NULL,
  file_id     uuid REFERENCES files (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_messages_idx ON support_ticket_messages (ticket_id, created_at);


-- =============================================================================
-- 17.  AUDIT & ACTIVITY
-- =============================================================================

-- Every admin action is written here (AGENTS.md §4 and §6).
CREATE TABLE audit_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_role   user_role,
  permission   text,
  category     text NOT NULL,
  action       text NOT NULL,
  target_type  moderation_target,
  target_id    uuid,
  target_field text,
  case_id      uuid,
  reason       text,
  outcome      text NOT NULL DEFAULT 'success',
  before_state jsonb,
  after_state  jsonb,
  ip           inet,
  device       text,
  session_id   uuid,
  region       text,
  source_app   text,
  source_route text,
  request_id   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_outcome_valid
    CHECK (outcome IN ('success','failure','partial','denied'))
);
CREATE INDEX audit_events_created_idx ON audit_events (created_at DESC);
CREATE INDEX audit_events_actor_idx ON audit_events (actor_id, created_at DESC);
CREATE INDEX audit_events_target_idx ON audit_events (target_type, target_id, created_at DESC);
CREATE INDEX audit_events_category_idx ON audit_events (category, created_at DESC);

CREATE TABLE audit_integrity_checks (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  verified_through bigint NOT NULL,
  status           text NOT NULL,
  gap_count        integer NOT NULL DEFAULT 0,
  checked_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_integrity_status_valid CHECK (status IN ('ok','gaps','failed'))
);

CREATE TABLE audit_export_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        text NOT NULL,
  purpose      text,
  requester_id uuid REFERENCES admin_members (user_id) ON DELETE SET NULL,
  format       text NOT NULL DEFAULT 'csv',
  status       text NOT NULL DEFAULT 'pending',
  file_id      uuid REFERENCES files (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  CONSTRAINT audit_export_status_valid
    CHECK (status IN ('pending','approved','processing','ready','expired','denied'))
);

CREATE TABLE security_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type  text NOT NULL,
  severity    severity_level NOT NULL DEFAULT 'medium',
  summary     text NOT NULL,
  detail      text,
  user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  ip          inet,
  status      text NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT security_alert_status_valid
    CHECK (status IN ('open','acknowledged','resolved','false_positive'))
);
CREATE INDEX security_alerts_open_idx ON security_alerts (status, severity)
  WHERE status <> 'resolved';

-- Engagement feed (/employer/activity, /investor/activity).
CREATE TABLE activity_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid REFERENCES organizations (id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  entity_type text,
  entity_id   uuid,
  summary     text NOT NULL,
  link_url    text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_org_idx ON activity_events (org_id, created_at DESC);
CREATE INDEX activity_events_user_idx ON activity_events (user_id, created_at DESC);

-- Queue for email/notification/webhook work (AGENTS.md §5: nothing slow in a request).
CREATE TABLE background_jobs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_type   text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  status     text NOT NULL DEFAULT 'queued',
  attempts   smallint NOT NULL DEFAULT 0,
  run_after  timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT background_job_status_valid
    CHECK (status IN ('queued','running','succeeded','failed','dead'))
);
CREATE INDEX background_jobs_ready_idx ON background_jobs (run_after) WHERE status = 'queued';


-- =============================================================================
-- 18.  TRIGGERS: updated_at maintenance
-- =============================================================================
-- Applied in a loop so a new table can never be forgotten.

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
     AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t);
  END LOOP;
END;
$$;


-- =============================================================================
-- 19.  DERIVED COUNTERS
-- =============================================================================
-- Counters the UI reads on every render are maintained here, not recomputed.

CREATE OR REPLACE FUNCTION sync_comment_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER community_comments_count_trg
AFTER INSERT OR DELETE ON community_comments
FOR EACH ROW EXECUTE FUNCTION sync_comment_count();

CREATE OR REPLACE FUNCTION sync_space_member_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_spaces SET member_count = member_count + 1 WHERE id = NEW.space_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_spaces SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.space_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER community_space_members_count_trg
AFTER INSERT OR DELETE ON community_space_members
FOR EACH ROW EXECUTE FUNCTION sync_space_member_count();

CREATE OR REPLACE FUNCTION sync_thread_last_message() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE message_threads SET last_message_at = NEW.created_at WHERE id = NEW.thread_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER messages_thread_bump_trg
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION sync_thread_last_message();

CREATE OR REPLACE FUNCTION sync_event_attendees() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'registered' THEN
    UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.event_id = OLD.event_id
        AND OLD.status = 'registered' AND NEW.status <> 'registered' THEN
    UPDATE events SET attendee_count = GREATEST(attendee_count - 1, 0) WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'registered' THEN
    UPDATE events SET attendee_count = GREATEST(attendee_count - 1, 0) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER event_registrations_count_trg
AFTER INSERT OR UPDATE OR DELETE ON event_registrations
FOR EACH ROW EXECUTE FUNCTION sync_event_attendees();


-- =============================================================================
-- 20.  REPORTING VIEWS
-- =============================================================================

-- Employer hiring funnel per job (jobsFunnel / funnelStages in the UI).
CREATE VIEW v_job_funnel AS
SELECT j.id AS job_id,
       j.org_id,
       j.title,
       j.status,
       count(a.id)                                        AS applicants,
       count(a.id) FILTER (WHERE a.stage = 'shortlisted')  AS shortlisted,
       count(a.id) FILTER (WHERE a.stage = 'interview')    AS interview,
       count(a.id) FILTER (WHERE a.stage = 'offered')      AS offered,
       count(a.id) FILTER (WHERE a.stage = 'hired')        AS hired,
       j.posted_at,
       EXTRACT(day FROM now() - j.posted_at)::int         AS days_open
FROM jobs j
LEFT JOIN job_applications a
       ON a.job_id = j.id
      AND a.deleted_at IS NULL
WHERE j.deleted_at IS NULL
GROUP BY j.id;

-- Startup readiness roll-up (the 0-100 "ready" number on profile cards).
CREATE VIEW v_startup_readiness AS
SELECT p.org_id,
       count(r.id)                                        AS criteria_total,
       count(r.id) FILTER (WHERE r.status = 'signed_off')  AS criteria_signed_off,
       round(100.0 * count(r.id) FILTER (WHERE r.status = 'signed_off')
             / NULLIF(count(r.id), 0))::int               AS readiness_pct
FROM startup_profiles p
LEFT JOIN startup_readiness r ON r.org_id = p.org_id
GROUP BY p.org_id;

-- Investor pipeline board, matching the kanban columns in /investor/pipeline.
CREATE VIEW v_investor_pipeline AS
SELECT d.investor_org_id,
       d.stage,
       count(*)                         AS deal_count,
       coalesce(sum(d.ticket_size), 0)   AS total_ticket,
       avg(d.probability)::numeric(5,2)  AS avg_probability
FROM investor_deals d
WHERE d.deleted_at IS NULL
GROUP BY d.investor_org_id, d.stage;

-- Round progress against target.
CREATE VIEW v_round_progress AS
SELECT r.id AS round_id,
       r.org_id,
       r.name,
       r.round_type,
       r.status,
       r.target_amount,
       coalesce(sum(c.amount) FILTER (WHERE c.status IN ('pledged','documented','funded')), 0)
         AS committed_amount,
       CASE WHEN r.target_amount > 0
            THEN round(100.0 * coalesce(sum(c.amount) FILTER
                        (WHERE c.status IN ('pledged','documented','funded')), 0)
                       / r.target_amount, 2)
       END AS committed_pct
FROM funding_rounds r
LEFT JOIN commitments c ON c.round_id = r.id
WHERE r.deleted_at IS NULL
GROUP BY r.id;

-- Unread notification badge in the header.
CREATE VIEW v_unread_notifications AS
SELECT user_id,
       count(*)                          AS unread_count,
       count(*) FILTER (WHERE is_urgent)  AS urgent_count
FROM notifications
WHERE NOT is_read
GROUP BY user_id;

COMMIT;

-- =============================================================================
--  End of baseline schema.
--  From here on, every change is an Alembic revision (one change per revision,
--  never edited after being applied).  Seed data lives in a separate dev-only
--  script and is never part of a migration.
-- =============================================================================
