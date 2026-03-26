# Pitfalls Research

**Domain:** Social media management SaaS — adding Stripe billing, Instagram/multi-platform API, image editor, and production hardening to existing Express + React app migrated from Replit
**Researched:** 2026-03-26
**Confidence:** HIGH (Stripe, Express session, file storage — official docs verified) / MEDIUM (Instagram Graph API — official docs + community) / MEDIUM (canvas editor — community consensus)

---

## Critical Pitfalls

### Pitfall 1: Stripe Raw Body Destruction

**What goes wrong:**
`express.json()` middleware is registered globally before the Stripe webhook route. Express parses and re-serializes the JSON body, altering the exact byte sequence. Stripe's signature verification hashes the raw bytes, so the signature never matches and all webhook events are rejected with `400 Webhook signature verification failed`.

**Why it happens:**
Global middleware is the default Express setup pattern. The raw body requirement is a non-obvious exception. Developers add `express.json()` at the top of `server.ts` and assume it applies everywhere safely.

**How to avoid:**
Register `express.raw({ type: 'application/json' })` as the body parser on the `/stripe/webhook` route specifically, before `express.json()` is applied to it. The webhook route must receive the raw buffer.

```typescript
// WRONG — global json parser kills Stripe verification
app.use(express.json());
app.post('/stripe/webhook', stripeWebhookHandler);

// CORRECT — raw body only for the webhook route
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.use(express.json()); // other routes get json parsing
```

**Warning signs:**
`WebhookSignatureVerificationError` in logs. Stripe Dashboard shows webhook endpoint receiving 400 responses consistently across all event types.

**Phase to address:**
Phase: Stripe Billing — implement raw body middleware before wiring up any webhook handlers.

---

### Pitfall 2: Instagram Token Silently Expires and Breaks All Publishing

**What goes wrong:**
Instagram long-lived access tokens expire after 60 days. If no automated refresh job exists, all Instagram publishing silently fails at day 60. Users see no error — posts are marked "published" in the app but never appear on Instagram. This is especially insidious because the OAuth scaffolding from the Replit era stores a token but has no refresh loop.

**Why it happens:**
Short-lived tokens (1 hour) are exchanged for long-lived tokens (60 days) during the OAuth flow. Developers assume "long-lived" means permanent. Meta's documentation buries the refresh requirement. The existing Instagram credentials table in this codebase was scaffolded without a refresh job.

**How to avoid:**
1. Store token expiry timestamp alongside the access token in the `instagram_credentials` table.
2. Build a scheduled job (cron or setInterval) that refreshes tokens at day 50 (10 days before expiry).
3. Refresh endpoint: `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}`.
4. Alert the user via email/dashboard if refresh fails so they can re-authenticate before publishing breaks.

**Warning signs:**
Posts stop appearing on Instagram around the 60-day mark. `OAuthException` errors with code 190 in publish logs. Users report "posts published but not showing."

**Phase to address:**
Phase: Instagram API Integration — token refresh cron is not optional, build it before enabling live publishing.

---

### Pitfall 3: Instagram App Review Blocks Launch

**What goes wrong:**
The app is built and tested with a personal test account, then the team realizes the `instagram_content_publish` permission requires full Facebook App Review before it can be used with any non-developer account. App Review can take 1–2+ weeks and requires a privacy policy URL, video screencast of the OAuth flow, and a live demo environment. This gates the entire public launch.

**Why it happens:**
Instagram development mode allows the app owner and explicitly added testers to use the API. Everything works perfectly in development. The App Review requirement only surfaces when attempting to add real users.

**How to avoid:**
1. Start the App Review process at the beginning of the Instagram integration phase — not after building everything.
2. Have a landing page with a privacy policy URL deployed before submitting the review (Meta requires one).
3. Required permissions for this app: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`.
4. Prepare a screen-recorded walkthrough of the OAuth flow and post-publishing flow for the review submission.

**Warning signs:**
`#200 - The user hasn't authorized the application to perform this action` errors when non-test users attempt to connect Instagram. OAuth scope errors in production.

**Phase to address:**
Phase: Instagram API Integration — submit App Review on day 1 of this phase; build the integration in parallel while review processes.

---

### Pitfall 4: MemoryStore Session Crashes on Restart / Horizontal Scaling

**What goes wrong:**
The existing app uses `express-session` with the default MemoryStore. Every server restart (deployments, crashes, auto-scaling) logs out all active users. Under any concurrent load, memory usage grows unboundedly until the process is killed by OOM. On a multi-instance deployment, sessions created on instance A are unknown to instance B, causing random auth failures.

**Why it happens:**
MemoryStore is the `express-session` default — it works perfectly in development where restarts are rare and a single process handles all requests. The Replit-era app never needed multi-instance support.

**How to avoid:**
Migrate to `connect-pg-simple` (stores sessions in the existing PostgreSQL database) before deploying to production. This requires zero new infrastructure since PostgreSQL is already in the stack.

```typescript
import connectPgSimple from 'connect-pg-simple';
const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({ pool, tableName: 'user_sessions' }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
```

Run `connect-pg-simple`'s table creation SQL to initialize the `user_sessions` table.

**Warning signs:**
Users complain of being randomly logged out. Server logs show `MemoryStore is not designed for a production environment` warning on startup. Memory usage grows steadily over hours.

**Phase to address:**
Phase: Production Hardening — must be addressed before any public-facing deployment. This is the first infrastructure change to make.

---

### Pitfall 5: Local File Uploads Break in Production

**What goes wrong:**
The app writes uploaded photos to a local `uploads/` directory. In a containerized or PaaS environment (Railway, Render, Fly.io), the filesystem is ephemeral — files are wiped on every deployment. Even on a persistent VM, local storage prevents horizontal scaling, creates backup complexity, and means Instagram's two-step publish flow fails because the image URL must be publicly accessible for Meta's servers to fetch it.

**Why it happens:**
Local disk storage is the easiest setup for development (no AWS credentials, no S3 bucket, instant uploads). The Instagram Graph API requirement — that media must be hosted on a publicly accessible URL at publish time — makes this a hard blocker, not just a scaling concern.

**How to avoid:**
Migrate file uploads to S3-compatible object storage (AWS S3 or Cloudflare R2) using `multer-s3` before implementing Instagram publishing. All uploaded photos need a permanent public URL.

Migration strategy:
1. Add `@aws-sdk/client-s3` and `multer-s3` to the project.
2. Replace `DiskStorage` in multer config with `multer-s3` storage engine.
3. Store the S3 URL (not a local path) in the database from day one.
4. Existing local files need a one-time migration script to S3.

**Warning signs:**
Photos disappear after deployment. Instagram publish fails with `OAuthException: The image url is invalid`. App works locally but photos are missing in production.

**Phase to address:**
Phase: Production Hardening / Infrastructure — must be done before Instagram integration and before any production deployment.

---

### Pitfall 6: Stripe Webhook Idempotency Not Implemented

**What goes wrong:**
Stripe retries webhook delivery if the endpoint doesn't respond within 20 seconds or returns a non-2xx status. Without idempotency checks, retried events trigger duplicate actions: provisioning a subscription twice, sending duplicate welcome emails, or crediting a user's account multiple times. Stripe explicitly warns this is the most dangerous billing pitfall.

**Why it happens:**
Webhook handlers are written as simple "if event type matches, do action" logic. Network blips between the handler processing and the 200 response cause Stripe to retry, executing the action again.

**How to avoid:**
Check `stripe_event_id` against a processed events table before acting on any webhook. Insert the event ID as the first step; if it already exists, return 200 immediately.

```typescript
const processed = await db.select().from(stripeEvents).where(eq(stripeEvents.eventId, event.id));
if (processed.length > 0) return res.sendStatus(200); // already handled
await db.insert(stripeEvents).values({ eventId: event.id, type: event.type });
// ... handle event
```

**Warning signs:**
Duplicate subscription records. Users receive multiple welcome emails. Billing amounts doubled in Stripe Dashboard. The same `checkout.session.completed` event appears in handler logs twice.

**Phase to address:**
Phase: Stripe Billing — build idempotency table before writing any event handler logic.

---

### Pitfall 7: Instagram Two-Step Publish Timing Failure

**What goes wrong:**
Instagram's content publishing requires creating a media container first (`POST /{id}/media`), then immediately calling `POST /{id}/media_publish`. If the publish call is made before Meta has finished processing the container (image download + validation on their servers), it returns `MEDIA_NOT_READY` or a 400 error. The app marks the post as failed and no retry mechanism exists.

**Why it happens:**
Developers treat it as a synchronous two-step API. The container creation returns a container ID immediately, but processing on Meta's side is asynchronous and typically takes 5–30 seconds depending on image size.

**How to avoid:**
1. Poll the container status endpoint (`GET /{container-id}?fields=status_code`) until `status_code = FINISHED` before calling `media_publish`.
2. Implement a retry with exponential backoff capped at 3 attempts with 15-second delays.
3. Map `status_code` values: `FINISHED` (ready), `IN_PROGRESS` (wait), `ERROR` (permanent failure — log and alert).

**Warning signs:**
Sporadic publish failures with `MEDIA_NOT_READY` in logs. Success rate correlates with image file size (larger images fail more). Post scheduling works for small images but not large ones.

**Phase to address:**
Phase: Instagram API Integration — design the publish job with container polling from the start; do not treat it as synchronous.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| MemoryStore for sessions | No extra infrastructure | All sessions lost on restart; OOM under load | Never in production |
| Local `uploads/` directory | Zero config | Ephemeral in containers; Instagram publish blocked; no CDN | Local development only |
| Hardcoding plan prices in DB | Simple to build | Breaks when Stripe prices change; shows stale amounts | Never — always read from Stripe |
| Single Stripe webhook handler without idempotency | Fast to write | Duplicate charges, double provisioning on retry | Never in production |
| Skipping Instagram App Review until launch | Faster dev cycle | Blocks all real users from connecting Instagram | Never — start review early |
| Storing Instagram token without refresh job | Simpler token storage | Publishing breaks silently at day 60 | Never |
| No `NODE_ENV=production` set in deployment | Works without it | Dev middleware, unoptimized rendering, verbose errors exposed | Never in production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe webhooks | Global `express.json()` before webhook route | Route-level `express.raw({ type: 'application/json' })` on webhook endpoint only |
| Stripe webhooks | Using test webhook secret in production | Separate secrets per environment; validate `NODE_ENV` matches secret type |
| Stripe subscriptions | Trusting `checkout.session.completed` alone for provisioning | Also handle `customer.subscription.updated` and `invoice.payment_failed` for lifecycle |
| Instagram OAuth | Assuming token is permanent after OAuth flow | Store expiry, refresh at day 50, alert on refresh failure |
| Instagram publishing | Calling `media_publish` immediately after container creation | Poll `status_code` on container until `FINISHED`, then publish |
| Instagram publish | Serving images from localhost or private URL | Images must be publicly accessible HTTPS URLs; use S3/CDN |
| Instagram App | Building full integration before App Review approval | Submit review first, build in parallel; review takes 1–2 weeks |
| Multi-platform APIs | Treating rate limits as one-size-fits-all | Each platform has its own limit windows; track per-platform in separate queues |
| S3 file upload | Storing local file path in DB before migrating | Store S3 URL from day 1; migration script for existing records |
| Express session | Missing `secure: true` on session cookie | `secure: true` required for HTTPS; set `trust proxy: 1` if behind reverse proxy |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous photo processing (AI tagging) on upload request | Upload requests time out on large batches | Move AI tagging to a background job queue; respond 202 immediately | ~5 photos simultaneous upload |
| Polling Instagram container status synchronously in request | Publish endpoint hangs for 30+ seconds | Push publish jobs to a background queue; return job ID to client | Single publish |
| Loading all photos into memory for similar-photo detection | Server OOM on large photo libraries | Process in batches with streaming; use database-level pagination | ~500 photos |
| Session storage in PostgreSQL with no index on session ID | Auth middleware slows under concurrent users | Ensure `session_id` column has index (connect-pg-simple creates this automatically) | ~1,000 concurrent sessions |
| Stripe price fetched from Stripe API on every page load | Pricing page slow; rate limits hit | Cache Stripe prices in memory with 1-hour TTL | First production launch |
| Canvas image editor with all event listeners active on every shape | Editor sluggish with 10+ image layers | Set `listening: false` on static shapes; only listen on selected/interactive shapes | 10+ layers |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `X-Powered-By: Express` header exposed | Server fingerprinting aids targeted exploits | `app.disable('x-powered-by')` or use `helmet()` |
| Session secret hardcoded in source | Session forgery if repo exposed | Load from `process.env.SESSION_SECRET`; enforce non-empty at startup |
| Stripe webhook secret committed to repo | Attacker can craft fake webhook events | Environment variable only; different secret per environment |
| Instagram app secret in client-side code | App secret exposed; token refresh endpoint bypassed | Server-side only; never send to frontend |
| No file type validation on upload | Malicious file upload (scripts, executables) | Validate MIME type server-side + file extension whitelist; `multer` limits alone insufficient |
| Missing `httpOnly` + `sameSite` on session cookie | XSS can steal session; CSRF possible | `cookie: { httpOnly: true, sameSite: 'lax', secure: true }` in session config |
| Detailed error messages in production responses | Stack traces reveal internal structure | `NODE_ENV=production` suppresses Express error details; custom error handler returns generic messages |
| No rate limiting on auth endpoints | Brute-force password attacks | `express-rate-limit` on `/api/login` and `/api/register` |
| Instagram access token logged | Token in log aggregation tools (Datadog, etc.) | Redact token fields from all log output; mask in error handlers |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Stripe Checkout redirect with no return handling | User completes payment, returns to app still on free plan (webhook delay) | Show "payment processing" state; poll subscription status for 10s after redirect return |
| Instagram OAuth disconnect not handled gracefully | Publishing silently fails after token expires with no user-visible error | Dashboard status indicator: "Instagram Connected / Reconnect needed"; email alert on token expiry |
| No publish failure notification | Users think posts published; discover failure days later | Real-time status update on scheduled posts; email digest of publish failures |
| Landing page without free trial CTA | Photographers hesitant to pay before testing | Free trial (14 days, no card) or limited free tier reduces conversion friction |
| Image editor that requires upload before editing | Breaks expected workflow (edit then upload) | Allow editing post-upload; use existing uploaded photo as canvas source |
| Scheduling UI with UTC times | Photographers publish at wrong local times | Display times in user's local timezone; store in UTC but display in detected timezone |

---

## "Looks Done But Isn't" Checklist

- [ ] **Stripe billing:** Webhook endpoint registered in Stripe Dashboard for production URL (not just localhost) — verify in Stripe Dashboard under Webhooks
- [ ] **Stripe billing:** `invoice.payment_failed` handler implemented — verify subscription is downgraded/paused, not silently kept active
- [ ] **Instagram OAuth:** Token refresh job running — verify by checking token expiry date in DB and confirming cron is active
- [ ] **Instagram publishing:** App in Live mode (not Development mode) — verify in Meta App Dashboard; Development mode blocks non-test users
- [ ] **Instagram publishing:** App Review approved for `instagram_content_publish` — verify permission in Meta App Review tab
- [ ] **File storage:** All new uploads going to S3 (not local disk) — verify `uploads/` directory remains empty after a test upload in production
- [ ] **Sessions:** `connect-pg-simple` store active — verify `user_sessions` table exists in PostgreSQL and is populated after login
- [ ] **Sessions:** `secure: true` on session cookie — verify using browser devtools Network tab on production HTTPS
- [ ] **Production hardening:** `NODE_ENV=production` set in deployment environment — verify `process.env.NODE_ENV` logs `production` at startup
- [ ] **Webhook idempotency:** Processed events table exists and is checked — verify by replaying a test webhook event twice and confirming single execution
- [ ] **Instagram two-step publish:** Container polling implemented — verify by checking logs for `status_code` polling on a test publish

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stripe raw body destroyed (webhooks failing) | LOW | Move webhook route above `express.json()`; redeploy; replay missed events from Stripe Dashboard |
| Instagram token expired (publishing broken) | MEDIUM | User re-authenticates via OAuth flow; implement refresh job to prevent recurrence |
| Local uploads wiped on deployment | HIGH | One-time S3 migration script from backup; re-request users to re-upload if no backup exists |
| MemoryStore OOM crash in production | MEDIUM | Roll back deployment; migrate to `connect-pg-simple`; all sessions invalidated (users re-login) |
| Duplicate Stripe subscriptions from webhook retry | HIGH | Audit Stripe Customer objects; manually cancel duplicates; refund over-charges; add idempotency table |
| Instagram App not in Live mode at launch | MEDIUM | Submit App Review; estimated 1–2 week delay; no workaround for non-test users |
| Session cookie missing `secure` flag | LOW | Update session config; redeploy; existing sessions invalidated |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stripe raw body destruction | Stripe Billing | Replay webhook from Stripe Dashboard; confirm 200 response |
| Instagram token expiry | Instagram API Integration | Check DB for `token_expires_at`; confirm cron job fires |
| Instagram App Review blocking launch | Instagram API Integration (start of phase) | Meta App Dashboard shows `instagram_content_publish` approved |
| MemoryStore in production | Production Hardening | `user_sessions` table exists; no MemoryStore warning in logs |
| Local file uploads | Production Hardening / Infrastructure | `uploads/` empty after test upload; S3 URL stored in DB |
| Stripe webhook idempotency | Stripe Billing | Double-replay test event; single DB record created |
| Instagram two-step timing | Instagram API Integration | Large image publish succeeds; logs show polling |
| Hardcoded Stripe prices | Stripe Billing | Change price in Stripe; pricing page reflects without code change |
| Missing NODE_ENV | Production Hardening | `process.env.NODE_ENV` logs `production` at startup |
| No rate limiting on auth | Production Hardening | `express-rate-limit` blocks >5 login attempts per minute |
| File type validation missing | Production Hardening / File Upload | Upload a `.php` file; confirm rejection |
| Session cookie not `secure` | Production Hardening | Browser devtools shows `Secure` flag on session cookie |

---

## Sources

- [Stripe webhook signature verification — Official docs](https://docs.stripe.com/webhooks/signature)
- [Debugging Stripe webhook signature errors — DEV Community](https://dev.to/nerdincode/debugging-stripe-webhook-signature-verification-errors-in-production-1h7c)
- [Why Stripe webhooks fail — Dev Journal](https://earezki.com/ai-news/2026-03-20-why-your-stripe-webhooks-are-failing-and-how-to-fix-it/)
- [Stripe SaaS billing best practices — Stripe](https://stripe.com/resources/more/best-practices-for-saas-billing)
- [Instagram Graph API content publishing — Meta](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Instagram access token refresh — Meta](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/)
- [Instagram Graph API 2026 developer guide — Elfsight](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/)
- [Instagram API changes 2025 — Elfsight](https://elfsight.com/blog/instagram-graph-api-changes/)
- [Troubleshooting Instagram API — Phyllo](https://www.getphyllo.com/post/troubleshooting-common-issues-with-instagram-api)
- [Instagram connection reauthorization every 60 days — Make Community](https://community.make.com/t/instagram-connection-has-to-be-reauthorized-every-60-days/41109)
- [MemoryStore not designed for production — express-session GitHub](https://github.com/expressjs/session/issues/556)
- [Express session middleware docs — Express.js](https://expressjs.com/en/resources/middleware/session.html)
- [Express.js security best practices — Express.js official](https://expressjs.com/en/advanced/best-practice-security.html)
- [Common Express.js mistakes — Medium](https://medium.com/@uyanhewagetr/common-mistakes-in-express-js-from-real-projects-88ad586e6b77)
- [Node.js production readiness checklist — DEV Community](https://dev.to/axiom_agent_1dc642fa83651/the-nodejs-production-readiness-checklist-47-things-engineers-miss-before-shipping-5im)
- [File uploads to S3 with multer — DEV Community](https://dev.to/aws-builders/master-secure-file-uploads-to-aws-s3-in-nodejs-with-express-and-multer-4j3e)
- [Replit to cloud migration guide — DevDash Labs](https://devdashlabs.com/insights/replit-to-cloud-migration)
- [Konva vs Fabric.js comparison — DEV Community](https://dev.to/lico/react-comparison-of-js-canvas-libraries-konvajs-vs-fabricjs-1dan)
- [X API pricing 2026 — Zernio](https://zernio.com/blog/twitter-api-pricing)
- [Stripe idempotency — Stripe](https://docs.stripe.com/api/idempotent_requests)

---
*Pitfalls research for: Social media management SaaS — production launch with Stripe, Instagram Graph API, multi-platform publishing, image editor*
*Researched: 2026-03-26*
