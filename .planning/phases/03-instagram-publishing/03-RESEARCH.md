# Phase 3: Instagram Publishing - Research

**Researched:** 2026-03-27
**Domain:** Instagram Platform API (Direct Login / Business Login), Meta App Review, token lifecycle management
**Confidence:** HIGH (API endpoints, scopes, container flow), MEDIUM (App Review timeline), LOW (exact review duration)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INSTA-01 | User can connect Instagram Business/Creator account via OAuth | Existing OAuth scaffolding uses wrong flow (Facebook OAuth, not Instagram Direct Login). Must rewrite to use `https://api.instagram.com/oauth/authorize` with `instagram_business_basic,instagram_business_content_publish` |
| INSTA-02 | App stores and automatically refreshes Instagram access tokens before expiry | `tokenExpiresAt` column exists in schema. Missing: refresh logic using `GET graph.instagram.com/refresh_access_token`. Needs a scheduled job running alongside the existing `setInterval` scheduler |
| INSTA-03 | Approved posts publish directly to Instagram via Graph API container flow | Publish route exists (`/api/posts/:id/publish-instagram`) but uses wrong API base (`graph.facebook.com/v18.0` instead of `graph.instagram.com`). Missing: container status polling before publish |
| INSTA-04 | User sees publish status (pending, published, failed) with error details | Posts table has `status` field with `posted` but no `failed` state or `publishError` column. Schema needs `publishError text` column and a new status value |
| INSTA-05 | App respects Instagram rate limits (50 posts/24hr per account) | Rate limit is 100 posts/24hr per account (not 50 — earlier research was incorrect; confirmed 100 from official docs). Use `GET /{IG_ID}/content_publishing_limit?fields=quota_usage,config` to check before publishing |
| INSTA-06 | User is guided to convert to Business/Creator account if on personal account | No UI exists for this. Needs a component that detects when OAuth succeeds but no Business/Creator account is found, then shows step-by-step conversion guide |
</phase_requirements>

---

## Summary

The existing Instagram scaffolding (`server/instagram.ts` + routes in `server/routes.ts`) was built against the **wrong Meta API flow**. It uses Facebook OAuth (`https://www.facebook.com/v18.0/dialog/oauth`) and requires a linked Facebook Page to get an Instagram Business Account ID. This is the legacy "Facebook Login for Business" flow. The correct approach for Phase 3 is the **Instagram Business Login (Direct Login)** flow launched July 2024, which uses `https://api.instagram.com/oauth/authorize` and returns an Instagram User token directly — no Facebook Page required.

The existing code also uses `https://graph.facebook.com/v18.0` as the API base. The current version is v25.0 (confirmed from official docs, March 2026). Publishing endpoints must be migrated to `https://graph.instagram.com` (the Instagram-specific graph host), not the Facebook graph host. The Direct Login flow returns tokens that work against `graph.instagram.com` endpoints.

The publish flow in `server/instagram.ts` correctly implements the container → publish sequence but is missing the critical **container status polling** step. It calls `media_publish` immediately after `media` creation, which causes sporadic `MEDIA_NOT_READY` failures for larger images. The fix is to poll `GET /{container-id}?fields=status_code` until `FINISHED` (or `ERROR`) before calling `media_publish`.

**Primary recommendation:** Rewrite `server/instagram.ts` to use the Instagram Business Login OAuth flow (not Facebook OAuth), migrate all API calls to `graph.instagram.com`, add container polling, add token refresh scheduling, add a `publishError` column to the posts schema, and build a personal-account conversion guide UI component.

---

## Existing Code Audit

### What Exists (Scaffolded, Mostly Wrong)

| File | Status | Problem |
|------|--------|---------|
| `server/instagram.ts` | Partial, wrong flow | Uses Facebook OAuth + Page-based IG account lookup. Must be rewritten to Instagram Direct Login |
| `server/routes.ts` L2264-2489 | Partial | OAuth routes exist but point to wrong flow. Publish route exists but lacks polling |
| `shared/schema.ts` | Mostly correct | `instagramCredentials` table has all needed columns. `posts` table missing `publishError` and `failed` status |
| `server/storage.ts` | Correct | `getInstagramCredentials`, `saveInstagramCredentials`, `deleteInstagramCredentials` all work. Missing: `updateInstagramToken` for refresh |

### What Needs to Be Built

1. Rewrite `server/instagram.ts` — new OAuth URL, new token exchange endpoints, new API base
2. Add container status polling to `postSingleImage` and `postCarousel`
3. Add `updateInstagramCredentials` storage method (for token refresh)
4. Add token refresh job to the existing `setInterval` scheduler
5. Add `publishError` column to `posts` table (Drizzle migration)
6. Add `failed` to `postStatusValues` enum in schema
7. Build personal account conversion guide UI component (INSTA-06)
8. Update publish route to check rate limit before attempting publish

---

## Standard Stack

### Core (No New Installs Required)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `node-fetch` / native `fetch` | Built-in Node 18+ | All Instagram API calls | Already used throughout routes.ts |
| `drizzle-orm` | Already installed | Schema migration for `publishError` column | Already in stack |

No new npm packages are required for this phase. The Instagram API is a direct REST integration.

### Supporting

| Tool | Purpose |
|------|---------|
| Instagram Business Login API | OAuth authorization and token exchange |
| `graph.instagram.com` | Publishing, token refresh, rate limit check |
| `api.instagram.com/oauth` | OAuth authorization code flow |

### What NOT to Use

| Avoid | Why |
|-------|-----|
| `passport-instagram` | Targets deprecated Basic Display API (personal accounts) |
| `instagram-private-api` | Scrapes internal API, violates ToS, accounts banned |
| Any npm Instagram wrapper | API is simple enough for direct fetch; wrappers add outdated abstraction |
| `graph.facebook.com` for Instagram publishing | Wrong host — Instagram Business Login tokens work against `graph.instagram.com` |

---

## Architecture Patterns

### Recommended Project Structure Changes

```
server/
├── instagram.ts          # Full rewrite — Direct Login OAuth + publishing
├── instagram-scheduler.ts # NEW — token refresh scheduler (or add to routes.ts)
├── routes.ts             # Update Instagram route handlers to use new instagram.ts
shared/
└── schema.ts             # Add publishError column + failed status
```

### Pattern 1: Instagram Business Login OAuth Flow (REPLACES existing)

**What:** The correct Direct Login flow uses `api.instagram.com` (not `facebook.com`)
**When to use:** For all new Instagram OAuth connections in this app

```typescript
// Source: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
// Step 1: Authorization URL
const AUTH_URL = "https://api.instagram.com/oauth/authorize";
const params = new URLSearchParams({
  client_id: INSTAGRAM_APP_ID,
  redirect_uri: redirectUri,
  scope: "instagram_business_basic,instagram_business_content_publish",
  response_type: "code",
  state,
});
const authUrl = `${AUTH_URL}?${params.toString()}`;

// Step 2: Exchange code for short-lived token
const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  }),
});
const { access_token: shortToken, user_id } = await tokenRes.json();

// Step 3: Exchange short-lived for long-lived token (60 days)
const longRes = await fetch(
  `https://graph.instagram.com/access_token?` +
  new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: INSTAGRAM_APP_SECRET,
    access_token: shortToken,
  })
);
const { access_token, expires_in } = await longRes.json();
// Store access_token, user_id, tokenExpiresAt = now + expires_in seconds
```

**Key difference from existing code:** No Facebook Pages lookup required. The `user_id` returned from `api.instagram.com/oauth/access_token` IS the Instagram User ID — use it directly for all publishing calls.

### Pattern 2: Container-Based Publishing with Status Polling (FIX existing)

**What:** Create container, poll until FINISHED, then publish. The existing code skips polling.
**When to use:** Every single Instagram publish operation

```typescript
// Source: https://developers.facebook.com/docs/instagram-platform/content-publishing/
const GRAPH_IG = "https://graph.instagram.com";

// Step 1: Create container
const containerRes = await fetch(`${GRAPH_IG}/${igUserId}/media`, {
  method: "POST",
  body: new URLSearchParams({
    image_url: imageUrl,  // Must be HTTPS public URL (R2 public URL)
    caption,
    access_token: accessToken,
  }),
});
const { id: containerId } = await containerRes.json();

// Step 2: Poll status — recommended once per minute, max 5 minutes
// Source: "We recommend querying a container's status once per minute, for no more than 5 minutes"
async function pollContainerStatus(containerId: string, accessToken: string): Promise<"FINISHED" | "ERROR"> {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30s intervals
    const statusRes = await fetch(
      `${GRAPH_IG}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const { status_code } = await statusRes.json();
    if (status_code === "FINISHED") return "FINISHED";
    if (status_code === "ERROR" || status_code === "EXPIRED") return "ERROR";
    // IN_PROGRESS: keep polling
  }
  return "ERROR"; // Timed out
}

// Step 3: Publish only when FINISHED
const status = await pollContainerStatus(containerId, accessToken);
if (status !== "FINISHED") throw new Error("Container processing failed or timed out");

const publishRes = await fetch(`${GRAPH_IG}/${igUserId}/media_publish`, {
  method: "POST",
  body: new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  }),
});
```

**Note on image format:** JPEG is the only supported format. R2 URLs already serve JPEG for photographer uploads. If a PNG slips through, convert with sharp before uploading to R2 or reject at the publish step.

### Pattern 3: Token Refresh Scheduler

**What:** Refresh tokens at day 50 (10 days before the 60-day expiry)
**When to use:** Add as a secondary check in the existing `setInterval` loop in routes.ts

```typescript
// Source: https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/
// Requirement: Token must be at least 24 hours old but not expired
async function refreshInstagramTokenIfNeeded(credentials: InstagramCredentials): Promise<void> {
  if (!credentials.tokenExpiresAt) return;

  const msUntilExpiry = credentials.tokenExpiresAt.getTime() - Date.now();
  const tenDaysMs = 10 * 24 * 60 * 60 * 1000;

  if (msUntilExpiry > tenDaysMs) return; // Still fresh — no refresh needed

  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?` +
    new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: credentials.accessToken,
    })
  );

  if (!res.ok) {
    // Token cannot be refreshed — user must re-authenticate
    // Mark token as expired in DB so UI shows "Reconnect needed"
    await storage.markInstagramTokenExpired(credentials.userId);
    return;
  }

  const { access_token, expires_in } = await res.json();
  const newExpiresAt = new Date(Date.now() + expires_in * 1000);
  await storage.updateInstagramToken(credentials.userId, access_token, newExpiresAt);
}
```

### Pattern 4: Rate Limit Check Before Publish

**What:** Query `content_publishing_limit` to ensure the account hasn't hit 100 posts/24hr
**When to use:** Before every `media_publish` call (not every container creation)

```typescript
// Source: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/
async function checkRateLimit(igUserId: string, accessToken: string): Promise<{ allowed: boolean; used: number; total: number }> {
  const since = Math.floor((Date.now() - 86400000) / 1000); // 24 hours ago unix
  const res = await fetch(
    `https://graph.instagram.com/${igUserId}/content_publishing_limit?` +
    new URLSearchParams({
      fields: "quota_usage,config",
      since: String(since),
      access_token: accessToken,
    })
  );
  const data = await res.json();
  const item = data?.data?.[0];
  const used = item?.quota_usage ?? 0;
  const total = item?.config?.quota_total ?? 100; // Default 100 if endpoint unavailable
  return { allowed: used < total, used, total };
}
```

**Note:** Official docs confirm the limit is **100 API-published posts per 24-hour moving window** (not 50 — the REQUIREMENTS.md value of 50 appears to be a conservative estimate from an older source; the INSTA-05 requirement says "50 posts/24hr" but the API enforces 100. Implement as 100 but document the discrepancy for the user).

### Pattern 5: Personal Account Detection + Conversion Guide (INSTA-06)

**What:** During OAuth callback, if the account is detected as personal (the Direct Login flow still requires Business/Creator), show a step-by-step guide.
**When to use:** When Instagram OAuth fails with a permission error indicating personal account

The Instagram Business Login API only works with Business or Creator accounts. Detection happens implicitly: if `instagram_business_basic` scope is requested but the account is personal, Meta will show an error page before redirecting back to the callback, or the callback will receive an error code.

**Guide content to show in UI:**
1. Open Instagram → Profile → Edit Profile → Switch to Professional Account
2. Choose "Creator" (for individual photographers) or "Business" (with FB Page)
3. Select a category → Skip Facebook Page connection if desired
4. Return to app and reconnect

### Anti-Patterns to Avoid

- **Calling media_publish immediately after media creation:** Always poll status first. Images > 1MB routinely take 15-30 seconds to process.
- **Using `graph.facebook.com` for the Instagram Direct Login flow:** The Direct Login tokens work against `graph.instagram.com`. Using the Facebook Graph host requires a linked Facebook Page and is the legacy flow.
- **Presigned (time-limited) R2 URLs for Instagram:** Meta fetches the image URL asynchronously — presigned URLs may expire before the fetch. Always use permanent public R2 URLs.
- **Storing the OAuth `state` in a separate session key without cleanup:** The existing code does `req.session.instagramOAuthState` and `delete req.session.instagramOAuthState` — this is correct. Keep this pattern.
- **Refreshing a token that is less than 24 hours old:** The refresh endpoint rejects tokens younger than 24 hours. Always check age before refreshing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth PKCE / state verification | Custom crypto | `crypto.randomUUID()` for state (already in existing code) | CSRF protection via state param is sufficient for server-side OAuth |
| Container polling with backoff | Custom retry library | Simple `for` loop with `setTimeout` | API is simple; 5 attempts max per Meta's own recommendation |
| Token expiry tracking | Custom date math | Store `tokenExpiresAt` as DB timestamp (already in schema) | The `expires_in` from the API is in seconds — just `new Date(Date.now() + expires_in * 1000)` |
| Rate limit tracking | Local in-memory counter | `GET /{IG_ID}/content_publishing_limit` API | Instagram tracks this server-side; query it directly |

---

## Common Pitfalls

### Pitfall 1: Wrong OAuth Host (Existing Code Bug)

**What goes wrong:** Existing `getInstagramAuthUrl` uses `https://www.facebook.com/v18.0/dialog/oauth`. This is the Facebook Login for Business flow, which requires users to have a Facebook account and a linked Facebook Page. Photographers without a Facebook account cannot connect.

**How to avoid:** Use `https://api.instagram.com/oauth/authorize` — the Instagram Business Login flow. No Facebook account required.

**Warning signs:** OAuth errors about Facebook Pages not found. Users complaining they can't connect because they don't have Facebook.

### Pitfall 2: API Version Staleness (Existing Code Bug)

**What goes wrong:** `server/instagram.ts` uses `https://graph.facebook.com/v18.0`. Current API version is v25.0. Version 18 is past its 2-year deprecation window — Meta will forcibly upgrade old versions, which can break field names.

**How to avoid:** Migrate to `https://graph.instagram.com` (versionless for the Direct Login flow, or explicitly use current version). The Direct Login API uses `graph.instagram.com` as the host, which is separate from `graph.facebook.com`.

### Pitfall 3: Missing Container Polling (Existing Code Bug)

**What goes wrong:** Both `postSingleImage` and `postCarousel` in the existing code call `media_publish` immediately after `media` creation. For images > ~500KB this regularly returns `MEDIA_NOT_READY`.

**How to avoid:** Add the polling loop (see Pattern 2 above). Poll every 30 seconds, max 5 attempts.

**Warning signs:** `MEDIA_NOT_READY` errors in logs. Post failures correlated with larger image sizes.

### Pitfall 4: Token Scope Mismatch (Old Scopes Deprecated Jan 2025)

**What goes wrong:** Existing code requests `instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement`. The `instagram_basic` and `instagram_content_publish` scopes are the **Facebook Login** scopes (deprecated January 27, 2025 for new apps). The **Instagram Business Login** scopes are `instagram_business_basic` and `instagram_business_content_publish`.

**How to avoid:** Update the scope string to `instagram_business_basic,instagram_business_content_publish` when building the new OAuth URL.

**Warning signs:** Scope authorization errors. Meta displaying "invalid scope" in OAuth flow.

### Pitfall 5: Publish Silently Failing at Day 60

**What goes wrong:** No token refresh job exists. Tokens silently expire. Posts are marked "posted" in the app but never appear on Instagram (or publish calls return `OAuthException` code 190).

**How to avoid:** Add token refresh to the existing `setInterval(processDuePosts, 60000)` loop — check all connected users' tokens once per hour and refresh any that will expire within 10 days.

### Pitfall 6: App Review Blocks Real Users

**What goes wrong:** In Meta's development mode, only explicitly added test users can authorize the app. `instagram_business_content_publish` requires Advanced Access (App Review) before any non-developer users can connect.

**How to avoid:** Submit App Review on day 1 of this phase. Required: privacy policy URL, app icon, screencast of the full OAuth flow + publish flow, description of usage. Review takes up to 10 days (Meta's stated SLA; community reports 1-3 weeks typical).

**Required before submission:** Landing page deployed with a live privacy policy URL (Phase 6 is not yet done — submit App Review with a minimal `/privacy` route returning a basic text policy as a placeholder).

### Pitfall 7: Scheduler Hangs on Container Polling

**What goes wrong:** The existing `processDuePosts` scheduler runs synchronously in a loop. If container polling takes 2.5 minutes (5 attempts × 30s), the scheduler is blocked for the entire period and cannot process other due posts.

**How to avoid:** Run publish operations with `Promise.all` for concurrent posts, or fire-and-forget container polling into a non-blocking async job (update post status to `publishing` first, then update to `posted`/`failed` when done). A simple approach: add `publishing` to the post status enum and set it before polling; the scheduler skips posts already in `publishing` state.

---

## Code Examples

### Complete New instagram.ts Structure

```typescript
// Source: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID!;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;
const IG_AUTH_BASE = "https://api.instagram.com/oauth";
const IG_GRAPH_BASE = "https://graph.instagram.com";

// CORRECT authorization URL (not facebook.com)
export function getInstagramAuthUrl(redirectUri: string, state: string): string {
  return `${IG_AUTH_BASE}/authorize?` + new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: redirectUri,
    scope: "instagram_business_basic,instagram_business_content_publish",
    response_type: "code",
    state,
  });
}

// Token exchange: code → short-lived → long-lived
export async function exchangeCodeForToken(code: string, redirectUri: string) {
  // Short-lived token
  const shortRes = await fetch(`${IG_AUTH_BASE}/access_token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const { access_token: shortToken, user_id } = await shortRes.json();

  // Long-lived token (60 days)
  const longRes = await fetch(`${IG_GRAPH_BASE}/access_token?` + new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: INSTAGRAM_APP_SECRET,
    access_token: shortToken,
  }));
  const { access_token, expires_in } = await longRes.json();

  // Get username
  const profileRes = await fetch(`${IG_GRAPH_BASE}/me?fields=username&access_token=${access_token}`);
  const { username } = await profileRes.json();

  return { accessToken: access_token, instagramUserId: String(user_id), instagramUsername: username, expiresIn: expires_in };
}
```

### Schema Migration (posts table)

```typescript
// shared/schema.ts additions
export const postStatusValues = ["pending", "approved", "rejected", "draft", "publishing", "posted", "failed"] as const;

// In posts table:
publishError: text("publish_error"),  // Nullable — stores error message on failure
```

```sql
-- Drizzle migration SQL (generate with drizzle-kit generate)
ALTER TABLE posts ADD COLUMN publish_error text;
-- postStatusValues is stored as text, no constraint change needed for new enum values
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Facebook Login for Business (requires Facebook Page + Instagram Business) | Instagram Business Login (Direct Login — no Facebook Page required) | July 2024 | Removes dependency on Facebook account for photographers |
| `graph.facebook.com/v18.0` | `graph.instagram.com` (or `graph.facebook.com/v25.0`) | v18 deprecated | API version staleness risks silent breakage |
| `instagram_basic` + `instagram_content_publish` scopes | `instagram_business_basic` + `instagram_business_content_publish` | January 27, 2025 | Old scopes deprecated; must use new scopes |
| Manual token storage with no refresh | Automated refresh at day 50 (10 days before 60-day expiry) | Always required | Silent publish failures at day 60 |

**Deprecated/outdated in existing codebase:**
- `https://www.facebook.com/v18.0/dialog/oauth` auth URL — replaced by `https://api.instagram.com/oauth/authorize`
- Facebook Page-based IG account discovery (`/me/accounts` + `/{pageId}?fields=instagram_business_account`) — replaced by Direct Login (user_id comes directly from token exchange)
- Scopes `instagram_basic,instagram_content_publish` — replaced by `instagram_business_basic,instagram_business_content_publish`
- `GRAPH_API_BASE = "https://graph.facebook.com/v18.0"` — replaced by `"https://graph.instagram.com"`

---

## Schema Changes Required

The `posts` table needs two additions before this phase's functionality can be verified:

```
1. posts.publishError (text, nullable) — error message from failed publish attempts
2. postStatusValues — add "publishing" (in-flight) and "failed" (terminal failure)
```

The `instagramCredentials` table is complete as-is (`tokenExpiresAt` already exists).

The `storage.ts` layer needs one new method:
```typescript
updateInstagramToken(userId: string, accessToken: string, tokenExpiresAt: Date): Promise<void>
```

---

## Open Questions

1. **API Review submission timing**
   - What we know: Phase 3 starts without App Review approved. Development mode allows the developer account + up to 5 test users.
   - What's unclear: Whether to submit immediately (blocking Phase 3 completion on approval) or build first and submit when integration is testable.
   - Recommendation: Submit App Review as Wave 1 task (day 1). Build behind feature flag for test users while review processes. The screencast required by Meta can be recorded against the test environment.

2. **Privacy policy for App Review**
   - What we know: Meta requires a live privacy policy URL before App Review is approved. Phase 6 (Landing Page) hasn't shipped yet.
   - What's unclear: Whether a minimal `/privacy` placeholder route satisfies Meta's requirement.
   - Recommendation: Add a minimal `/privacy` static route to the Express app as part of Wave 1 (before submitting App Review). A simple text page with data collection disclosure is sufficient for the submission.

3. **Container polling in the scheduler context**
   - What we know: Current scheduler is synchronous. Polling blocks for up to 2.5 minutes per post.
   - What's unclear: Whether to implement async publish (fire-and-forget) or synchronous (block scheduler).
   - Recommendation: Introduce `publishing` status. Scheduler sets status to `publishing` and fires the publish job asynchronously. A separate check (on the next scheduler tick) confirms final status. This prevents blocking without requiring a job queue.

4. **Rate limit discrepancy**
   - What we know: INSTA-05 requirement says "50 posts/24hr per account" but the official API documentation says 100.
   - Recommendation: Implement against the API's actual limit of 100. The `content_publishing_limit` endpoint returns the actual `quota_total` — use that dynamically rather than hardcoding either number.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test files, no jest/vitest config |
| Config file | None — Wave 0 must create |
| Quick run command | `npx vitest run --reporter=verbose` (after Wave 0 setup) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INSTA-01 | OAuth URL uses `api.instagram.com/oauth/authorize` with correct scopes | unit | `npx vitest run tests/instagram.test.ts -t "auth url"` | ❌ Wave 0 |
| INSTA-01 | Token exchange stores userId directly (no FB Page lookup) | unit | `npx vitest run tests/instagram.test.ts -t "token exchange"` | ❌ Wave 0 |
| INSTA-02 | Token refresh triggers when expiry is within 10 days | unit | `npx vitest run tests/instagram.test.ts -t "token refresh"` | ❌ Wave 0 |
| INSTA-02 | `updateInstagramToken` updates DB correctly | unit | `npx vitest run tests/instagram.test.ts -t "update token"` | ❌ Wave 0 |
| INSTA-03 | Container polling retries on IN_PROGRESS and stops on FINISHED | unit | `npx vitest run tests/instagram.test.ts -t "container polling"` | ❌ Wave 0 |
| INSTA-03 | Publish sets post status to `posted` on success | integration | `npx vitest run tests/instagram.test.ts -t "publish success"` | ❌ Wave 0 |
| INSTA-04 | Failed publish sets status to `failed` with error text | unit | `npx vitest run tests/instagram.test.ts -t "publish failure"` | ❌ Wave 0 |
| INSTA-05 | Rate limit check blocks publish when quota_usage >= quota_total | unit | `npx vitest run tests/instagram.test.ts -t "rate limit"` | ❌ Wave 0 |
| INSTA-06 | Personal account error triggers conversion guide UI | manual | Manual browser test — OAuth error state triggers guide component | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/instagram.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/instagram.test.ts` — unit tests for instagram.ts module (mock fetch)
- [ ] `vitest.config.ts` — minimal config pointing at `tests/` dir
- [ ] Framework install: `npm install -D vitest` — if not present
- [ ] `tests/helpers/mockFetch.ts` — shared fetch mock for Instagram API responses

---

## Sources

### Primary (HIGH confidence)
- [Instagram Business Login — Meta Developer Docs](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login) — OAuth endpoints, scopes, token exchange flow
- [Instagram Content Publishing — Meta Developer Docs](https://developers.facebook.com/docs/instagram-platform/content-publishing/) — Container flow, image requirements, rate limits (100/24hr), polling guidance
- [Refresh Access Token — Meta Developer Docs](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/) — Refresh endpoint, 24-hour minimum age, 60-day validity
- [OAuth Authorize Reference — Meta Developer Docs](https://developers.facebook.com/docs/instagram-platform/reference/oauth-authorize/) — Authorization URL, required params, scope list
- [Content Publishing Limit — Meta Developer Docs](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/) — `quota_usage`, `config`, `quota_total` fields

### Secondary (MEDIUM confidence)
- [Instagram Direct Login Gist (PrenSJ2)](https://gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc) — Node.js implementation reference, confirmed July 2024 launch
- [App Review — Meta Developer Docs](https://developers.facebook.com/docs/instagram-platform/app-review/) — Advanced Access requirements, screencast requirements
- [Meta Graph API v22.0 Release Notes](https://web.swipeinsight.app/posts/facebook-launches-graph-api-v22-0-and-marketing-api-v22-0-for-developers-14179) — v22 current at time of research; v25 referenced in Meta docs examples

### Tertiary (LOW confidence, needs validation)
- App Review review time "up to 10 days" — official SLA. Community experience often reports 1-3 weeks; treat as LOW confidence for planning purposes.

---

## Metadata

**Confidence breakdown:**
- Standard stack (no new packages): HIGH — verified by reading existing codebase
- OAuth flow rewrite (Direct Login): HIGH — verified against official Meta docs
- Container polling fix: HIGH — official docs explicitly state "query once per minute, no more than 5 minutes"
- Token refresh pattern: HIGH — official refresh_access_token doc confirmed
- Rate limit (100/24hr): HIGH — confirmed from official content-publishing doc (supersedes earlier 50/24hr figure)
- App Review timeline: LOW — official SLA is 10 days; actual experience varies significantly

**Research date:** 2026-03-27
**Valid until:** 2026-06-27 (Meta API changes quarterly — re-verify scopes and endpoints before implementing if >30 days since research)
