/**
 * One-time migration script: migrate existing local photo URLs to R2 CDN URLs.
 *
 * Tables migrated:
 *   - tagged_photos   (photo_url, storage_path)
 *   - photo_batch_items (photo_url, storage_path)
 *
 * Usage:
 *   npx tsx script/migrate-uploads-to-r2.ts
 *   npx tsx script/migrate-uploads-to-r2.ts --dry-run
 *
 * Required env vars:
 *   DATABASE_URL, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL
 */

import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { uploadFile } from "../server/cloud-storage";

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Database connection — standalone pool (not importing server/db.ts)
// ---------------------------------------------------------------------------
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// MIME type helper
// ---------------------------------------------------------------------------
function mimeTypeFromExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

// ---------------------------------------------------------------------------
// Resolve local file path from DB record
// ---------------------------------------------------------------------------
function resolveLocalPath(photoUrl: string, storagePath: string | null): string | null {
  const candidate = storagePath || photoUrl;

  if (candidate.startsWith("/uploads/")) {
    const filename = path.basename(candidate);
    return path.join(process.cwd(), "uploads", filename);
  }

  // Absolute path on disk (legacy multer temp kept in uploads/)
  if (candidate.startsWith("/") && !candidate.startsWith("/objects/")) {
    return candidate;
  }

  return null; // cannot resolve
}

// ---------------------------------------------------------------------------
// Migrate a single table
// ---------------------------------------------------------------------------
interface MigrationRow {
  id: string;
  photo_url: string;
  storage_path: string | null;
}

async function migrateTable(
  tableName: string,
  stats: { succeeded: number; failed: number; skippedGcs: number; alreadyMigrated: number }
): Promise<void> {
  const result = await pool.query<MigrationRow>(
    `SELECT id, photo_url, storage_path FROM ${tableName} WHERE photo_url NOT LIKE 'https://%'`
  );

  console.log(`\n[${tableName}] Found ${result.rows.length} rows needing migration`);

  for (const row of result.rows) {
    const { id, photo_url, storage_path } = row;

    // Skip GCS /objects/ paths — Replit GCS sidecar not available outside Replit
    if (storage_path?.startsWith("/objects/") || photo_url.startsWith("/objects/")) {
      console.warn(`  SKIP (GCS) id=${id} path=${storage_path || photo_url}`);
      stats.skippedGcs++;
      continue;
    }

    const localPath = resolveLocalPath(photo_url, storage_path);
    if (!localPath) {
      console.warn(`  SKIP (unresolvable) id=${id} photo_url=${photo_url}`);
      stats.failed++;
      continue;
    }

    if (!fs.existsSync(localPath)) {
      console.warn(`  SKIP (file missing) id=${id} path=${localPath}`);
      stats.failed++;
      continue;
    }

    const filename = path.basename(localPath);
    const mimeType = mimeTypeFromExtension(filename);

    if (DRY_RUN) {
      console.log(`  DRY-RUN: would upload ${filename} (${mimeType})`);
      stats.succeeded++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(localPath);
      const newUrl = await uploadFile(buffer, filename, mimeType);
      console.log(`  Migrating: ${filename} -> ${newUrl}`);

      await pool.query(
        `UPDATE ${tableName} SET photo_url = $1, storage_path = $1 WHERE id = $2`,
        [newUrl, id]
      );
      stats.succeeded++;
    } catch (err) {
      console.error(`  FAILED id=${id} path=${localPath}:`, err);
      stats.failed++;
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  if (DRY_RUN) {
    console.log("=== DRY RUN MODE — no changes will be made ===\n");
  }

  // Validate required env vars
  const required = [
    "DATABASE_URL",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("Missing required env vars:", missing.join(", "));
    process.exit(1);
  }

  const stats = { succeeded: 0, failed: 0, skippedGcs: 0, alreadyMigrated: 0 };

  await migrateTable("tagged_photos", stats);
  await migrateTable("photo_batch_items", stats);

  console.log(`\n=== Migration ${DRY_RUN ? "(dry run) " : ""}complete ===`);
  console.log(`  Succeeded : ${stats.succeeded}`);
  console.log(`  Failed    : ${stats.failed}`);
  console.log(`  Skipped (GCS paths, not recoverable outside Replit): ${stats.skippedGcs}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
