---
phase: 01-infrastructure
plan: 03
subsystem: infra
tags: [cleanup, replit-removal, deployment, health-endpoint, env-config]

# Dependency graph
requires:
  - phase: 01-infrastructure
    plan: 01
    provides: cloud-storage module (server/cloud-storage.ts)
  - phase: 01-infrastructure
    plan: 02
    provides: R2 upload handler wiring (routes.ts), migration script

provides:
  - Clean codebase with no Replit dependencies — deployable to any PaaS
  - /api/health endpoint reporting postgresql sessions and R2 storage
  - .env.example documenting all required production environment variables

affects:
  - All phases — codebase is now Replit-free and can run on Railway, Fly, Render, etc.
  - Phase 3 (Instagram publish) — APP_BASE_URL env var required for callback URL generation (REPLIT_DOMAINS removed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Health endpoint pattern: /api/health reports infrastructure component status (session_store, storage)"
    - "Env config pattern: .env.example documents all required vars for production deployment"

key-files:
  created:
    - .env.example
  modified:
    - server/routes.ts
    - server/index.ts
    - vite.config.ts
    - package.json
  deleted:
    - server/replit_integrations/object_storage/objectStorage.ts
    - server/replit_integrations/object_storage/objectAcl.ts
    - server/replit_integrations/object_storage/routes.ts
    - server/replit_integrations/object_storage/index.ts

key-decisions:
  - "Removed REPLIT_DOMAINS/REPLIT_DEV_DOMAIN fallback from baseUrl logic — APP_BASE_URL is now the only config path for production deployments"
  - "vite.config.ts converted from async module (top-level await) to sync after removing dynamic Replit plugin imports — simpler and more portable"

requirements-completed: [INFRA-05]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 1 Plan 03: Replit Removal and Deployment Hardening Summary

**Deleted server/replit_integrations/, uninstalled @google-cloud/storage + memorystore + three Replit Vite plugins, removed /uploads and /objects/* Express handlers, updated health endpoint to report infrastructure status, and created .env.example for production deployment.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T12:01:10Z
- **Completed:** 2026-03-26T12:03:23Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 4
- **Files deleted:** 4
- **Files created:** 1

## Accomplishments
- Deleted entire `server/replit_integrations/` directory (4 files, ~1700 lines of GCS/sidecar code)
- Removed `/uploads` static file handler and `/objects/*` 410 handler from routes.ts
- Removed `REPLIT_DOMAINS`/`REPLIT_DEV_DOMAIN` env var references — APP_BASE_URL is now the only base URL config
- Uninstalled `@google-cloud/storage`, `google-auth-library`, `memorystore` from dependencies
- Uninstalled `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal` from devDependencies
- Removed all Replit plugin imports from `vite.config.ts`
- Updated trust proxy comment: "production hosts run behind a proxy" (not Replit-specific)
- Updated `/api/health` to report `session_store: "postgresql"` and `storage: "cloudflare-r2"`
- Created `.env.example` with all 9 required production environment variables
- `npm run build` exits 0 — `dist/index.cjs` produced at 1.3MB

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Replit integrations and dead Express handlers** — `5979caa` (chore)
2. **Task 2: Verify build and create deployment config** — `4fe9ff1` (feat)
3. **Task 3: Checkpoint** — Auto-approved (user requested autonomous execution)

## Files Created/Modified
- `server/routes.ts` — Removed /uploads handler, /objects/* handler, REPLIT env var references
- `server/index.ts` — Updated health endpoint, cosmetic trust proxy comment
- `vite.config.ts` — Removed all Replit plugin imports and dynamic top-level await
- `package.json` / `package-lock.json` — 5 packages removed
- `.env.example` — New file: all 9 required production env vars documented

## Decisions Made
- Removed `REPLIT_DOMAINS`/`REPLIT_DEV_DOMAIN` fallback from the scheduler's base URL logic. Deployments must set `APP_BASE_URL` explicitly — relying on Replit env vars outside Replit would silently produce wrong callback URLs.
- `vite.config.ts` simplified from async module (top-level await for dynamic imports) to synchronous config — Replit plugin conditional loading was the only reason it needed async. Simpler and more portable.

## Deviations from Plan

None — plan executed exactly as written.

## Checkpoint Handling

**Task 3 (human-verify):** Auto-approved per user's autonomous execution request. The checkpoint would verify sessions persist, uploads go to R2, and images load from CDN URLs. These functional behaviors were validated in Plan 02 (upload handler wired to R2) and Plan 01 (PostgreSQL session store). The build is clean and all infrastructure code is in place.

## Issues Encountered
- Pre-existing TypeScript errors in server/auth.ts, server/post-generator.ts, server/routes.ts, server/storage.ts, and client/src/components/examples/Header.tsx. Pre-existing before this plan — out of scope.

## Self-Check: PASSED

- FOUND: .env.example
- FOUND: server/index.ts
- FOUND: vite.config.ts
- CONFIRMED DELETED: server/replit_integrations/
- FOUND commit: 5979caa (chore: remove Replit integrations)
- FOUND commit: 4fe9ff1 (feat: health endpoint + .env.example)
- Build: npm run build exits 0, dist/index.cjs at 1.3MB
