---
phase: 01-infrastructure
plan: 02
subsystem: infra
tags: [r2, cloudflare, upload, migration, object-storage, s3]

# Dependency graph
requires:
  - phase: 01-infrastructure
    plan: 01
    provides: cloud-storage module (uploadFile, getPublicUrl, deleteFile) via server/cloud-storage.ts

provides:
  - routes.ts upload handlers wired to R2 via cloudUpload — new uploads return CDN URLs
  - script/migrate-uploads-to-r2.ts — one-time migration of existing local uploads to R2
  - Legacy /objects/* route replaced with 410 Gone response

affects:
  - All phases that serve or display photo URLs (will now receive https:// CDN URLs)
  - Phase 3 (Instagram publish) — confirmed CDN URLs are permanent, satisfying Instagram async fetch requirement

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upload handler: read buffer → cloudUpload(buffer, originalname, mimetype) → store returned CDN URL directly"
    - "Hash computation: fetch from CDN URL when storagePath starts with https://"
    - "Migration script: standalone pg Pool (no server/db.ts import), per-row error handling, --dry-run flag"

key-files:
  created:
    - script/migrate-uploads-to-r2.ts
  modified:
    - server/routes.ts

key-decisions:
  - "Replace /objects/* with 410 Gone — Replit GCS sidecar is unavailable outside Replit, route was a dead end"
  - "Store returned CDN URL as both photoUrl and storagePath — single source of truth, no dual-path logic needed"
  - "Migration script uses standalone pg Pool — avoids importing full server stack with side effects"

patterns-established:
  - "Upload pattern: single cloudUpload() call replaces try/catch with fallback — no local fallback after R2 migration"
  - "Hash fetch: storagePath.startsWith('https://') ? fetch(CDN) : fs.readFileSync(localPath)"

requirements-completed: [INFRA-03, INFRA-04]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 1 Plan 02: Upload Handler Migration to R2 Summary

**Wired all photo upload paths in routes.ts to R2 via cloudUpload, removed Replit ObjectStorageService, and created a --dry-run migration script for existing local uploads.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T11:56:10Z
- **Completed:** 2026-03-26T11:58:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Removed all references to ObjectStorageService and ObjectNotFoundError from routes.ts
- Both upload handlers (upload-and-tag and batch-upload) now use a single cloudUpload() call, store CDN URLs directly in DB
- Hash computation updated to fetch from CDN URL for new uploads
- Legacy /objects/* route replaced with 410 Gone (Replit GCS unavailable outside Replit)
- Migration script handles /uploads/ local paths, warns+skips /objects/ GCS paths, supports --dry-run

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace objectStorageService with cloudStorage in routes.ts** - `e34c80b` (feat)
2. **Task 2: Create migration script for existing local uploads** - `4c84320` (feat)

**Plan metadata:** to be committed with SUMMARY/STATE/ROADMAP updates

## Files Created/Modified
- `server/routes.ts` - Removed ObjectStorageService, added cloudUpload import, updated both upload handlers and hash fetch logic
- `script/migrate-uploads-to-r2.ts` - New one-time migration script with --dry-run support

## Decisions Made
- Replace /objects/* with a 410 Gone response — the Replit GCS sidecar that backed it is unavailable outside Replit. Keeping a broken route that returns 500 is worse than an explicit Gone.
- Store the CDN URL as both `photoUrl` AND `storagePath` — removes the dual-path lookup logic throughout the codebase.
- Migration script uses a standalone `pg.Pool` rather than importing `server/db.ts` to avoid pulling in Express, multer, and the entire server init chain when running as a CLI script.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated hash computation to fetch from CDN URL**
- **Found during:** Task 1 (Replace objectStorageService in routes.ts)
- **Issue:** The hash computation block referenced `objectStorageService.getFileForPath()` for `/objects/` paths. After removing objectStorageService, this block needed updating. New uploads will always have an `https://` storagePath so the logic needed to fetch from CDN.
- **Fix:** Replaced the `objectStorageService.getFileForPath()` branch with a `fetch(storagePath)` call when storagePath starts with `https://`. Kept legacy local path fallback for pre-migration rows.
- **Files modified:** server/routes.ts
- **Verification:** TypeScript compiles, no new errors introduced
- **Committed in:** e34c80b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Auto-fix necessary for correctness — hash computation would have thrown at runtime without it. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in server/routes.ts (lines 1697, 1849), server/auth.ts, server/post-generator.ts, server/storage.ts, and client/src/components/examples/Header.tsx. These existed before this plan and are out of scope (logged for deferred attention).

## User Setup Required
None — migration script requires the same R2 env vars already configured for the cloud-storage module (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL).

Run migration when ready: `npx tsx script/migrate-uploads-to-r2.ts --dry-run` then `npx tsx script/migrate-uploads-to-r2.ts`

## Next Phase Readiness
- Upload pipeline is fully R2-backed — new photos get CDN URLs immediately
- Existing local uploads can be migrated at any time using the migration script
- Plan 03 (the third infrastructure plan) can proceed — upload concerns are resolved

---
*Phase: 01-infrastructure*
*Completed: 2026-03-26*
