---
phase: 01-infrastructure
plan: 01
subsystem: infra
tags: [postgres, session, connect-pg-simple, cloudflare-r2, aws-sdk-s3, express-session]

requires: []
provides:
  - PostgreSQL-backed session store wired into Express (connect-pg-simple, createTableIfMissing)
  - Cloud storage abstraction module (uploadFile, getPublicUrl, deleteFile) targeting Cloudflare R2
affects: [02-infrastructure, 03-instagram, all plans that use file uploads or session auth]

tech-stack:
  added:
    - "@aws-sdk/client-s3 ^3.1017.0 — S3-compatible client used for Cloudflare R2"
  patterns:
    - "S3Client configured with region: auto and custom R2 endpoint for Cloudflare R2"
    - "connect-pg-simple store with createTableIfMissing: true avoids separate DDL migration"
    - "Non-null assertions (!) on env vars — fast fail at startup if credentials missing"

key-files:
  created:
    - server/cloud-storage.ts
  modified:
    - server/index.ts
    - package.json

key-decisions:
  - "Use createTableIfMissing: true on PgSession to auto-create user_sessions table — no DDL migration needed"
  - "Use non-null assertions on R2 env vars (fail fast) rather than runtime guards that return empty strings"
  - "Do not remove memorystore from package.json yet — cleanup deferred to Plan 03"
  - "Do not wire cloud-storage into routes.ts yet — that happens in Plan 02"

patterns-established:
  - "Cloud storage: single S3Client instance per module, env vars for all credentials"
  - "Session store: pool imported from db.ts, not creating a new connection"

requirements-completed: [INFRA-01, INFRA-02]

duration: 8min
completed: 2026-03-26
---

# Phase 1 Plan 01: PostgreSQL Sessions and Cloudflare R2 Storage Module

**PostgreSQL-backed session store via connect-pg-simple and Cloudflare R2 cloud storage abstraction with uploadFile/getPublicUrl/deleteFile**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-26T11:51:50Z
- **Completed:** 2026-03-26T12:00:00Z
- **Tasks:** 2
- **Files modified:** 3 (server/index.ts, server/cloud-storage.ts created, package.json)

## Accomplishments
- Session store replaced: MemoryStore swapped for connect-pg-simple backed by existing pg pool — sessions now survive server restarts
- Cloud storage module created: `server/cloud-storage.ts` exports `uploadFile`, `getPublicUrl`, `deleteFile` targeting Cloudflare R2 via S3-compatible API
- `@aws-sdk/client-s3` installed and verified in package.json

## Task Commits

1. **Task 1: Swap MemoryStore for connect-pg-simple session store** - `4fffe16` (feat)
2. **Task 2: Create cloud-storage module and install @aws-sdk/client-s3** - `c8fe471` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `server/index.ts` - Added connect-pg-simple import, pool import from db.ts, PgSession store with createTableIfMissing: true
- `server/cloud-storage.ts` - New module: S3Client for R2, exports uploadFile/getPublicUrl/deleteFile
- `package.json` - Added @aws-sdk/client-s3 dependency

## Decisions Made
- `createTableIfMissing: true` on PgSession avoids needing a separate DDL migration for `user_sessions` table
- Non-null assertions (`!`) on all R2 env vars — app will throw at startup if credentials are missing (correct behavior)
- `memorystore` not removed from package.json (cleanup in Plan 03)
- `cloud-storage.ts` not wired into routes.ts yet (Plan 02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors exist in other files (`client/src/components/examples/Header.tsx`, `server/auth.ts`, `server/post-generator.ts`, `server/routes.ts`, `server/storage.ts`) but are out of scope for this plan. No errors introduced by this plan's changes.

## User Setup Required

Cloudflare R2 requires manual configuration before the upload flow (Plan 02) can function:

**Environment variables to add:**
- `R2_ENDPOINT` — Cloudflare dashboard > R2 > Overview > S3 API endpoint
- `R2_ACCESS_KEY_ID` — Cloudflare dashboard > R2 > Manage R2 API Tokens > Create API token
- `R2_SECRET_ACCESS_KEY` — Same API token creation as above
- `R2_BUCKET_NAME` — Name chosen when creating the R2 bucket
- `R2_PUBLIC_URL` — Cloudflare dashboard > R2 > Bucket > Settings > Public Access > enable public URL

**Dashboard configuration:**
1. Create R2 bucket: Cloudflare dashboard > R2 > Create bucket
2. Enable public access: Cloudflare dashboard > R2 > [bucket] > Settings > Public access

## Next Phase Readiness
- Plan 02 can now wire `server/cloud-storage.ts` into `server/routes.ts` upload handler
- Session store is production-ready — PostgreSQL persistence active
- R2 env vars must be configured before Plan 02 upload wiring is testable

---
*Phase: 01-infrastructure*
*Completed: 2026-03-26*
