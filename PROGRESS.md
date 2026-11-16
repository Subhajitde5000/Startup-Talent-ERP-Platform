# Backend Progress Map: Forma

Matches BUILD_PLAN.md v2 (step numbers are the same). For every step that has pages, two phases: (A) backend done and tested, (B) frontend wired, demo data removed, dev seed script updated. Tick both. Finish and test each step before the next. The agent ticks boxes after each finished step.

## Setup
- [ ] AGENTS.md, BUILD_PLAN.md, PROGRESS.md in the project root
- [ ] database/schema.sql and database/auth_schema.sql in place
- [ ] Agent replied to AGENTS.md with a summary and questions, and I confirmed
- [ ] Backend git branch created

## Step 0: Paper review
- [ ] docs/design.md written (entities, gaps vs schema.sql, permission matrix, lifecycles)
- [ ] I approved it

## Step 1: Foundation
- [x] Scaffold, config, `.env.example`
- [x] Docker Compose (Postgres, Redis, Mailpit)
- [x] Alembic first revision up and down
- [x] Error format, logging, health, CORS
- [x] `send_email()` with smtp and resend providers
- [x] Tests, lint, type check running

## Step 2: Authentication
- [x] Register and login, argon2
- [x] Access and refresh tokens, rotation and reuse detection
- [x] Logout and logout everywhere
- [x] Email verification
- [x] Password reset, change password and email
- [x] Multi-role support and role dependencies
- [x] Account states (suspended and so on)
- [x] Rate limiting and login attempts
- [x] Self-registration cannot grant the admin role (admin auth is Step 15a)
- [x] Auth tests pass (wrong role, expired, reused token, rate limit)

## Step 3: Profiles, organizations, onboarding
- [ ] User profile and settings
- [ ] Organizations and members, invites
- [ ] Job seeker profile and skills
- [ ] Mentor profile
- [ ] Onboarding flow per role
- [ ] Public vs private views

## Step 4: Files
- [ ] R2 integration and signed upload URLs
- [ ] Validation and scan status
- [ ] Private signed downloads
- [ ] Avatar, logo, resume, deck uploads working

## Step 5: Startups
- [ ] Startup profile and visibility toggles
- [ ] Team directory
- [ ] Metrics
- [ ] Readiness and sign-off
- [ ] Milestones
- [ ] Tasks (board, labels, comments)
- [ ] Startup discovery list
- [ ] Frontend test pass

## Step 6: Connections (only if the frontend needs it)
- [ ] Decision: needed or skipped
- [ ] Requests, accept, decline
- [ ] Blocks respected everywhere

## Step 7: Jobs and talent
- [ ] 7a Jobs and search
- [ ] 7b Applications and stages
- [ ] 7c Interviews, scorecards, offers, hires, onboarding
- [ ] 7d Saved jobs, alerts, resumes, ATS, practice
- [ ] 7e Hiring requests, shortlists, funnel
- [ ] Frontend test pass

## Step 8: Mentors
- [ ] Listing and search
- [ ] Mentorship requests
- [ ] Sessions without double booking
- [ ] Deliverables and agreements
- [ ] Earnings records
- [ ] Decision on availability slots and reviews (gaps)

## Step 9: Investors, rounds, data room
- [ ] Funding rounds
- [ ] Investor pipeline and notes
- [ ] Offers and commitments
- [ ] Portfolio
- [ ] Data room and access requests
- [ ] Document view logging
- [ ] Investor preferences and watchlist (gap decision)
- [ ] Frontend test pass

## Step 10: Community and events
- [ ] Spaces and access rules
- [ ] Posts and comments
- [ ] Reactions and counters
- [ ] Feed with cursor pagination
- [ ] Reports and moderation scans
- [ ] AMAs, events, registrations
- [ ] Frontend test pass

## Step 11: Messaging
- [ ] Threads and members
- [ ] Messages and attachments
- [ ] Read tracking, unread counts
- [ ] Polling endpoints
- [ ] Privacy tests (outsiders blocked)

## Step 12: Notifications and email
- [ ] In-app notifications
- [ ] Email notifications and templates
- [ ] Preferences
- [ ] Background processing with retries

## Step 13: Search
- [ ] Full-text indexes
- [ ] Unified search and filters
- [ ] Autocomplete
- [ ] Visibility respected in results

## Step 14: Billing and payments
- [ ] Payment provider confirmed
- [ ] Plans, entitlements, subscriptions
- [ ] Invoices and tax math
- [ ] Payments from verified webhooks
- [ ] Refunds and dunning
- [ ] Credits
- [ ] Mentor payouts with maker/checker
- [ ] Reconciliation

## Step 15: Admin console
- [ ] 15a Admin access, audit log, security alerts
- [ ] 15b Verifications, moderation, appeals, disputes, fraud
- [ ] 15c Support tickets and help centre
- [ ] 15d Data requests and compliance
- [ ] 15e Feature flags, integrations, system status, content

## Step 16: Connect the frontend
- [ ] Typed API client generated
- [ ] Auth wired
- [ ] Each role's pages on real API
- [ ] End-to-end check per role

## Step 17: Hardening
- [ ] Security review
- [ ] Performance and load test
- [ ] Authorization test sweep
- [ ] Backup and restore test
- [ ] Monitoring and error tracking

## Step 18: Deployment
- [ ] Dockerfile and environments
- [ ] Managed Postgres and backups
- [ ] CI/CD
- [ ] Domain, HTTPS, admin subdomain
- [ ] Domain email (SPF, DKIM, DMARC), provider switched to Resend
- [ ] Launch checklist and rollback plan