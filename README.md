# Meridian — Startup & Talent ERP (frontend demo)

A role-based Next.js 15 App Router frontend for founders, mentors and investors. Every screen is
populated with fictional demo records; no backend or external service is required.

## Run locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

For the production experience:

```bash
cd frontend
npm run build
npm run start
```

## Quality checks

```bash
cd frontend
npm run typecheck   # tsc --noEmit
npm run lint        # alias for typecheck (deterministic, no interactive prompt)
npm run format      # Prettier write
npm run format:check
```

## Workspaces

| Role | Entry point |
|---|---|
| Founder | `/startup/dashboard` |
| Mentor | `/mentor/dashboard` |
| Investor | `/investor/dashboard` |

Shared routes (`/help`, `/notifications`, `/help/tickets`) accept `?role=startup|mentor|investor`.

## Demo data

- All records live in `frontend/src/data/*DemoData.ts`, `frontend/src/config/*`, and React contexts.
- Local edits are stored in `localStorage`; the key registry is `frontend/src/config/demoStorage.ts`.
- **Settings → Privacy & data → Restore all demo data** clears every local edit and reloads the
  original fixtures.
- **Sign out** also clears local demo edits and returns to `/login`.
- Fonts are self-hosted in `frontend/src/assets/fonts` so `next build` never contacts Google Fonts.

## Optional developer preview

The login state-machine preview widget is hidden by default. To inspect it in a development build:

```bash
NEXT_PUBLIC_SHOW_STATE_PREVIEW=1 npm run dev
```

## Audit

`frontend-review-report.md` contains the filled user/developer audit, all original defect IDs,
newly found issues, fixes, and the final verification results.
