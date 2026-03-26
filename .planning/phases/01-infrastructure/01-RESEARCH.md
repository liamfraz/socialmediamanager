# Phase 1: Infrastructure - Research

**Researched:** 2026-03-26
**Domain:** Express session hardening, Cloudflare R2 object storage, PaaS deployment (Railway/Fly.io)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | App uses PostgreSQL-backed session store instead of MemoryStore | connect-pg-simple v10 already installed; requires wiring in `server/index.ts` and running one DDL migration |
| INFRA-02 | User uploads are stored in Cloudflare R2 with public URLs | Replace Replit ObjectStorageService with `@aws-sdk/client-s3` pointed at R2 endpoint; bucket configured with public read |
| INFRA-03 | Existing local uploads are migrated to R2 on deployment | 128 files in `uploads/`; migration script reads each file, uploads to R2, updates `photoUrl` in DB |
| INFRA-04 | App serves uploaded images via R2 public URLs (not local filesystem path) | Upload handler and DB schema already use `photoUrl` field; replace ObjectStorageService reference in routes with cloud-storage module |
| INFRA-05 | App is deployable to production hosting (Railway/Fly.io) with environment variables only | App already has PORT/NODE_ENV handling; needs `start` script, env var list, and no Replit-specific sidecar dependencies at runtime |
</phase_requirements>

---

## Summary

This phase has no novel libraries to research — everything needed is either already installed or a straightforward migration. The work is three surgically scoped changes: (1) swap `memorystore` for `connect-pg-simple` in `server/index.ts`, (2) replace the Replit-specific `ObjectStorageService` (GCS via a sidecar at `http://127.0.0.1:1106`) with a new `server/cloud-storage.ts` module that uses `@aws-sdk/client-s3` pointed at Cloudflare R2, and (3) write a one-time migration script that uploads the 128 existing local files to R2 and updates their `photoUrl` DB records.

The single highest-risk item is the storage migration. The codebase has two storage paths in production: Replit's `objectStorageService` (returns `/objects/...` style paths) and a local disk fallback (returns `/uploads/filename` paths). Both are served by Express proxy handlers. After migration, both path formats must be rewritten to full `https://...r2.dev/...` CDN URLs in the `tagged_photos` and `photo_batch_items` tables. The migration script must handle both path formats when scanning for rows to update.

Once R2 is wired up and the session store is switched, the app has no more Replit runtime dependencies and can deploy to Railway or Fly.io with a standard `npm run build && npm start` flow.

**Primary recommendation:** Implement in dependency order — sessions first (isolated, zero risk), then cloud-storage module + upload handler, then migration script, then remove Replit integration code, then validate deployment config.

---

## Standard Stack

### Core (Phase 1 only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-s3` | `^3.x` | Upload objects to R2, generate public URLs | R2 is S3-compatible; this is the official SDK; no R2-specific package exists |
| `connect-pg-simple` | `10.0.0` (already installed) | PostgreSQL session store | Already in `package.json`; just needs wiring |

### Not Needed (Already Present)

| Package | Status | Action |
|---------|--------|--------|
| `connect-pg-simple` | v10 installed | Wire up only — no install needed |
| `pg` | v8 installed | Use existing `Pool` instance from `server/db.ts` |
| `@google-cloud/storage` | v7 installed | Remove after migration |
| `google-auth-library` | v10 installed | Remove after migration (check for other usages first) |

### Installation

```bash
npm install @aws-sdk/client-s3
# After R2 migration is verified:
npm uninstall @google-cloud/storage google-auth-library
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 additions only)

```
server/
├── index.ts              # MODIFY: swap memorystore → connect-pg-simple
├── routes.ts             # MODIFY: replace objectStorageService calls with cloudStorage
├── cloud-storage.ts      # NEW: R2 via @aws-sdk/client-s3
├── replit_integrations/  # DELETE after migration verified
└── db.ts                 # Unchanged — pg Pool lives here

script/
└── migrate-uploads-to-r2.ts   # NEW: one-time migration script
```

### Pattern 1: Session Store Swap

**What:** Replace the `memorystore` instantiation in `server/index.ts` with `connect-pg-simple`. The existing session config object stays identical; only the `store` property changes.

**Current state:** `server/index.ts` line 39 — `session({...})` has no `store` property set, so it silently uses MemoryStore.

**What to add:** Import `connectPgSimple` and the `pool` from `server/db.ts`, then pass `store: new PgSession({ pool, tableName: 'user_sessions' })`.

**DDL required (run once via `drizzle-kit push` or raw SQL):**
```sql
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
```

**Note on tableName:** The PITFALLS.md uses `user_sessions`. The connect-pg-simple default is `session`. Use `user_sessions` to avoid collision with any future `session` table.

**Code:**
```typescript
// server/index.ts
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';  // confirm pool export exists in db.ts

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({ pool, tableName: 'user_sessions' }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
```

**Confidence:** HIGH — connect-pg-simple v10 official docs + STACK.md

### Pattern 2: Cloud Storage Abstraction Module

**What:** `server/cloud-storage.ts` wraps `@aws-sdk/client-s3` to expose three functions: `uploadFile`, `getPublicUrl`, `deleteFile`. The rest of the codebase imports from this module only — never from `@aws-sdk` directly.

**Why this boundary matters:** The upload handler in `routes.ts` currently has two branches (object storage path and local fallback). After migration, there is one branch: `cloudStorage.uploadFile()`. The abstraction also makes a future provider swap (e.g., S3 → Cloudflare Images) a single-file change.

**R2 bucket public URL requirement:** For INFRA-04 (images served via public URL) and future Instagram publishing (Instagram's backend must fetch the image URL), the R2 bucket MUST be configured with public read access (either R2 public URL domain or custom domain). Presigned URLs with expiry MUST NOT be used for `photoUrl` storage — they will break at expiry.

```typescript
// server/cloud-storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,  // https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return getPublicUrl(key);
}

export function getPublicUrl(key: string): string {
  // R2_PUBLIC_URL = https://pub-xxx.r2.dev  OR custom domain
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  }));
}
```

**Source:** Cloudflare R2 AWS SDK v3 docs (HIGH confidence — STACK.md verified)

### Pattern 3: Upload Route Replacement

**What:** In `server/routes.ts`, replace all calls to `objectStorageService.uploadFile()` and the local fallback (`/uploads/${file.filename}`) with a single call to `cloudStorage.uploadFile()`.

**Key change:** The existing upload handler already reads the file buffer (`fs.readFileSync(filePath)`) and calls `objectStorageService.uploadFile(buffer, filename, mimetype)`. The new call is identical in shape — swap the import and function call, remove the try/catch fallback to local disk.

**The `/uploads` and `/objects` Express middleware can be removed** after migration is confirmed. These two proxy handlers (lines 1066-1087 in routes.ts) exist solely to serve local disk files and Replit object storage files. After migration they serve nothing.

### Pattern 4: Migration Script (One-Time)

**What:** A Node.js script at `script/migrate-uploads-to-r2.ts` that:
1. Queries all rows in `tagged_photos` and `photo_batch_items` where `photoUrl` does NOT start with `https://`
2. For each row, determines the local file path from `storagePath`
3. Reads the file, uploads to R2 using the same key format (`uuid-filename.jpg`)
4. Updates the DB record's `photoUrl` to the new R2 public URL

**Two path formats to handle:**
- `/uploads/uuid-filename.jpg` → file at `{cwd}/uploads/uuid-filename.jpg`
- `/objects/...` → Replit object storage path (these files are in the Replit GCS bucket, accessible via the `objectStorageService.downloadObject()` API — must be downloaded first, then re-uploaded to R2)

**Run order:** Run migration AFTER R2 is configured and tested (new uploads going to R2 first), then update legacy records.

```typescript
// script/migrate-uploads-to-r2.ts (outline)
// 1. Connect to DB via drizzle
// 2. SELECT * FROM tagged_photos WHERE photo_url NOT LIKE 'https://%'
// 3. SELECT * FROM photo_batch_items WHERE photo_url NOT LIKE 'https://%'
// 4. For each: read local file, upload to R2, UPDATE photo_url = new CDN URL
// 5. Log summary: X migrated, Y failed
```

**Confidence:** HIGH — the schema and file layout are confirmed from direct code inspection.

### Anti-Patterns to Avoid

- **Keeping the Replit sidecar dependency in production:** `server/replit_integrations/object_storage/objectStorage.ts` connects to `http://127.0.0.1:1106` which only exists on Replit. This will throw `ECONNREFUSED` immediately on Railway/Fly.io at startup if any import path reaches it. The `routes.ts` import of `ObjectStorageService` must be removed before production deploy (INFRA-05 is blocked on this).
- **Using presigned URLs for `photoUrl`:** Presigned URLs expire. They look like they work, then silently break 7 days later. Store permanent public CDN URLs only.
- **Running migration before R2 is tested:** Test that new uploads successfully land in R2 and the CDN URL returns HTTP 200 before migrating legacy records. Roll back path: local files still exist until migration deletes them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PostgreSQL session storage | Custom session table + TTL cleanup | `connect-pg-simple` (already installed) | Handles TTL pruning, table creation SQL, pooled connections, reconnect |
| S3-compatible object upload | Custom HTTP calls to R2 API | `@aws-sdk/client-s3` | Handles retries, multipart uploads, signing, error normalisation |
| Session cookie security | Manual cookie attribute setting | Express session config (`httpOnly`, `sameSite`, `secure`) | Already wired in current `server/index.ts` — just needs store swap |

**Key insight:** This phase is wiring and migration, not building. Every component exists; the work is connecting them correctly and removing dead code.

---

## Common Pitfalls

### Pitfall 1: `db.ts` May Not Export a `Pool`

**What goes wrong:** `connect-pg-simple` requires a `pg.Pool` instance, not a Drizzle client. If `server/db.ts` only exports the Drizzle `db` object and not the underlying `Pool`, the session store constructor will fail.

**How to avoid:** Inspect `server/db.ts` before writing the session store config. If no `pool` is exported, create one from `process.env.DATABASE_URL` and export it alongside `db`. Drizzle uses `pg.Pool` internally via `drizzle-orm/node-postgres` — the pool is typically created there and can be exported directly.

**Warning signs:** TypeScript error passing `db` to `PgSession({ pool: ... })`, or runtime error `pool.query is not a function`.

### Pitfall 2: Replit ObjectStorageService Called at Module Load

**What goes wrong:** `routes.ts` line 22: `const objectStorageService = new ObjectStorageService();` — this runs at module load time. On Railway/Fly.io, `ObjectStorageService` constructor may try to initialise the GCS client that connects to `127.0.0.1:1106`. Even if it doesn't immediately connect, the import path `./replit_integrations/object_storage` must be fully removed before deployment.

**How to avoid:** Remove the `objectStorageService` instantiation and all references in routes.ts as part of the upload handler replacement (INFRA-04 task). Do not leave dead import statements.

### Pitfall 3: `photoUrl` DB Values Mixed After Partial Migration

**What goes wrong:** If the migration script runs but some rows fail (file not found, GCS unavailable), the DB ends up with a mix of old-format paths and new R2 URLs. The app tries to render both. Old `/uploads/...` paths return 404 after the Express static handler is removed.

**How to avoid:** Run the migration script in a transaction per-batch. Log all failures. Do not remove the `/uploads` Express handler until the migration is confirmed 100% complete with zero failures. Keep local files in `uploads/` until CDN URLs are verified working.

### Pitfall 4: R2 Bucket Not Set to Public Read

**What goes wrong:** Uploads succeed, keys are stored, but every `https://pub-xxx.r2.dev/key.jpg` returns 403. This breaks image rendering in the app AND will block Instagram publishing in Phase 3.

**How to avoid:** After creating the R2 bucket, explicitly enable "Public bucket access" in the Cloudflare dashboard (Bucket > Settings > Public access). Verify with `curl -I https://<R2_PUBLIC_URL>/test-upload.jpg` returning 200 before wiring the upload handler.

### Pitfall 5: `sameSite: 'none'` Requires `secure: true`

**What goes wrong:** The current session config sets `sameSite: 'none'` in production (line 47 of index.ts). `sameSite: 'none'` is only valid when `secure: true`. Most production PaaS hosts use HTTPS by default, but if `NODE_ENV=production` is not set, `secure` defaults to `false` and the browser silently drops the cookie.

**How to avoid:** Confirm `NODE_ENV=production` is set as an environment variable in the Railway/Fly.io config. The existing code already conditionally sets `secure: true` when `NODE_ENV === 'production'` — the env var is the only missing piece.

---

## Code Examples

### Session Store Wire-Up (Verified Pattern)

```typescript
// server/index.ts — replace existing session() call
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';  // must confirm this export exists

const PgSession = connectPgSimple(session);
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error('SESSION_SECRET environment variable is required');

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: true,  // auto-creates table on first run
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
```

Note: `createTableIfMissing: true` is a connect-pg-simple v10 option that runs the DDL automatically. Use this to avoid a separate migration step.

**Source:** connect-pg-simple v10 README (HIGH confidence)

### R2 Client Initialisation

```typescript
// server/cloud-storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  const ext = path.extname(originalFilename).toLowerCase();
  const key = `${crypto.randomUUID()}${ext}`;
  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return getPublicUrl(key);
}

export function getPublicUrl(key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
```

**Source:** Cloudflare R2 + AWS SDK v3 docs (HIGH confidence — referenced in STACK.md and ARCHITECTURE.md)

---

## Environment Variables Required

These must be set in Railway/Fly.io before the app starts:

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | Railway Postgres plugin / Fly.io Postgres |
| `SESSION_SECRET` | Express session signing key | Generate: `openssl rand -base64 32` |
| `R2_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` | Cloudflare dashboard > R2 > bucket |
| `R2_ACCESS_KEY_ID` | R2 API token access key | Cloudflare dashboard > R2 > API Tokens |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | Cloudflare dashboard > R2 > API Tokens |
| `R2_BUCKET_NAME` | R2 bucket name | Chosen when creating bucket |
| `R2_PUBLIC_URL` | `https://pub-xxx.r2.dev` or custom domain | Cloudflare dashboard > R2 > bucket > Public Access |
| `NODE_ENV` | Must be `production` | Set explicitly in deployment config |
| `OPENAI_API_KEY` | AI tagging (existing) | OpenAI dashboard |

Variables NOT needed for Phase 1 (remove from app startup checks if present):
- `PUBLIC_OBJECT_SEARCH_PATHS` (Replit-only)
- Any GCS credentials

---

## Deployment Config

### Railway

The `package.json` already has the required scripts:
- `build`: `tsx script/build.ts`
- `start`: `NODE_ENV=production node dist/index.cjs`

Railway auto-detects Node.js projects. Set all env vars in Railway dashboard. No `Dockerfile` or `railway.json` required for basic deploy.

The app listens on `process.env.PORT` (default 5000) — Railway injects `PORT` automatically.

### Fly.io

Fly.io requires a `Dockerfile` or `fly.toml`. The existing `npm run build && npm start` pattern maps cleanly to a multi-stage Dockerfile.

**Minimum `fly.toml`:**
```toml
[build]
  [build.args]
    NODE_VERSION = "20"

[http_service]
  internal_port = 5000
  force_https = true
```

**Confidence:** MEDIUM — based on ARCHITECTURE.md references + general PaaS patterns. Verify Railway auto-detection works by checking if a `nixpacks.toml` is needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Replit ObjectStorageService (GCS sidecar) | Cloudflare R2 via AWS SDK v3 | This phase | Zero egress fees, public URLs, PaaS portable |
| MemoryStore (express-session default) | connect-pg-simple | This phase | Sessions survive restarts and scale across instances |
| Local `uploads/` directory | R2 CDN URLs | This phase | Ephemeral filesystem → permanent public storage |

**Deprecated by this phase:**
- `server/replit_integrations/` directory: GCS sidecar client — Replit-only, must be removed
- `uploads/` directory: ephemeral local storage — migrated to R2 then directory can be .gitignored
- `/uploads` and `/objects` Express static handlers in `routes.ts`

---

## Open Questions

1. **Does `server/db.ts` export a `pg.Pool`?**
   - What we know: Drizzle is configured there with a PostgreSQL connection
   - What's unclear: Whether a raw `Pool` is exported (connect-pg-simple requires it)
   - Recommendation: Planner should add a task to inspect `db.ts` and add pool export if missing

2. **Are any Replit object storage paths (`/objects/...`) currently in the DB?**
   - What we know: The upload handler attempts `objectStorageService.uploadFile()` first, with local fallback
   - What's unclear: Whether any successfully uploaded to Replit GCS and have `/objects/...` paths stored
   - Recommendation: Migration script must query for BOTH `/uploads/...` and `/objects/...` path prefixes, and handle GCS download for the latter

3. **Railway vs Fly.io — which to target?**
   - What we know: Both are listed as options in INFRA-05; the app is already Railway-compatible in structure
   - What's unclear: User's preference; Railway is simpler (no Dockerfile needed)
   - Recommendation: Target Railway as primary; add Fly.io notes as alternative in deployment task

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test runner installed |
| Config file | None |
| Quick run command | N/A — Wave 0 must install |
| Full suite command | N/A — Wave 0 must install |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Session persists across server restart | integration | Smoke test: login, restart server, verify session still valid | Wave 0 |
| INFRA-02 | Upload returns R2 public URL (https://) | integration | POST /api/photos/upload-and-tag → assert photoUrl starts with R2_PUBLIC_URL | Wave 0 |
| INFRA-03 | Existing local photos accessible after migration | smoke | Run migration script, query DB, curl each photoUrl, assert HTTP 200 | Wave 0 |
| INFRA-04 | No local filesystem paths in photoUrl column | integration | SELECT count(*) FROM tagged_photos WHERE photo_url NOT LIKE 'https://%' = 0 | Wave 0 |
| INFRA-05 | App starts with only env vars | smoke | NODE_ENV=production npm start with no Replit env vars present | Wave 0 |

### Sampling Rate
- **Per task commit:** Manual smoke test (login persistence check, upload URL check)
- **Per wave merge:** Full integration suite once test framework is installed
- **Phase gate:** INFRA-01 through INFRA-05 all green before marking phase complete

### Wave 0 Gaps
- [ ] `tests/` directory — does not exist, must be created
- [ ] Test runner — recommend `vitest` (compatible with the existing ESM/TypeScript setup via `tsx`)
- [ ] Framework install: `npm install -D vitest` — if test automation is desired
- [ ] Alternatively: Phase 1 can be verified with manual/script-based smoke tests given its infrastructure nature

---

## Sources

### Primary (HIGH confidence)
- `server/index.ts` (direct inspection) — session config, middleware order, PORT handling
- `server/routes.ts` (direct inspection) — upload handler, objectStorageService usage, /uploads and /objects middleware
- `shared/schema.ts` (direct inspection) — `photoUrl`, `storagePath` fields in `taggedPhotos` and `photoBatchItems`
- `package.json` (direct inspection) — confirmed: connect-pg-simple v10, pg v8, @google-cloud/storage v7, no @aws-sdk installed
- `server/replit_integrations/object_storage/objectStorage.ts` (direct inspection) — confirmed GCS sidecar at 127.0.0.1:1106
- `.planning/research/STACK.md` — R2 via @aws-sdk/client-s3 pattern, connect-pg-simple wiring SQL
- `.planning/research/ARCHITECTURE.md` — cloud-storage.ts module pattern, session store pattern
- `.planning/research/PITFALLS.md` — MemoryStore pitfall, local uploads pitfall, session cookie flags
- connect-pg-simple v10 (installed, `createTableIfMissing` option confirmed)

### Secondary (MEDIUM confidence)
- Cloudflare R2 AWS SDK v3 compatibility (referenced in STACK.md, confirmed in ARCHITECTURE.md code examples)
- Railway Node.js deployment (referenced in ARCHITECTURE.md sources)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both libraries confirmed installed/verified from source
- Architecture: HIGH — all patterns derived from direct codebase inspection, not assumption
- Pitfalls: HIGH — derived from actual code paths in routes.ts and index.ts
- Deployment: MEDIUM — Railway/Fly.io specifics based on prior research, not live verification

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable libraries; R2/Railway APIs are stable)
