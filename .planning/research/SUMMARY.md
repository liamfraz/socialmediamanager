# Project Research Summary

**Project:** Social Media Manager — Photographer SaaS Production Launch
**Domain:** Social media management SaaS (photographer-focused), adding billing, Instagram API, image editor, and production hardening to an existing Express + React app
**Researched:** 2026-03-26
**Confidence:** HIGH (Stripe, sessions, R2, sharp), MEDIUM (Instagram Graph API), LOW (multi-platform beyond Instagram)

## Executive Summary

This is a production launch milestone for an existing React 18 + Express 4 + Drizzle ORM + PostgreSQL app that was scaffolded on Replit and already has the core photographer workflow (bulk upload, AI tagging, post scheduling, drag-and-drop calendar, approval workflow) working. The milestone adds the missing production requirements: a public landing/pricing page, Stripe subscriptions, Instagram direct publishing via the Graph API, cloud file storage migration, a canvas image composition editor, and infrastructure hardening. Research confirms the existing technology choices are sound — no architectural pivot is required.

The recommended approach is to address infrastructure blockers first (session store, cloud storage), then unlock monetisation (Stripe billing), then wire up the Instagram publishing pipeline (which has a hard 2-8 week external dependency on Meta App Review that must start immediately). Image composition UI and the landing/pricing pages can be built in parallel with Instagram integration once the infrastructure layer is solid. The existing stack additions are minimal: `stripe@17`, `react-konva@18.2.10`, and `@aws-sdk/client-s3` pointed at Cloudflare R2. Most required packages (`sharp`, `connect-pg-simple`, Framer Motion, `passport`) are already installed and just need to be wired up correctly.

The three highest-severity risks — all preventable — are: (1) the Meta App Review timeline blocking public launch if not started on day one of the Instagram integration phase; (2) Instagram long-lived tokens expiring silently at 60 days if no refresh job is built; and (3) Stripe webhooks silently failing if the raw-body middleware order in Express is wrong. Each of these has a clear mitigation documented in PITFALLS.md. The overall risk profile is manageable given that the core architecture is already proven in production conditions.

## Key Findings

### Recommended Stack

The existing stack (React 18, Express 4, Vite 5, Drizzle ORM, PostgreSQL, OpenAI) requires no changes. New additions are narrow: pin Stripe SDK to `^17.x` (v21 shipped 2026-03-25 with breaking TypeScript changes), use `react-konva@18.2.10` (v19 requires React 19 — do not upgrade mid-milestone), and use AWS SDK v3 S3 client pointed at Cloudflare R2 for object storage (zero egress fees vs GCS which is already in package.json but unconfigured). `sharp` for server-side image composition, `connect-pg-simple` for production sessions, and `framer-motion` for landing page animations are all already installed and just need to be activated. Instagram publishing requires a custom OAuth handler — `passport-instagram` targets the deprecated Basic Display API and must not be used.

**Core technologies (new additions only):**
- `stripe@^17.x` — subscriptions, webhooks — pin below breaking v21, last stable series
- `@stripe/stripe-js@^5.x` — Stripe Elements (client) — PCI-compliant hosted card input, never touch raw card data
- `react-konva@18.2.10` — canvas image editor UI — pinned for React 18 peer dep compatibility
- `konva@^9.x` + `use-image@^1.1.1` — Konva engine and image loader (peer deps, maintained by Konva org)
- `@aws-sdk/client-s3@^3.x` + `@aws-sdk/s3-request-presigner@^3.x` — Cloudflare R2 via S3-compatible API
- Instagram Graph API — Direct Login OAuth + container publish — no npm wrapper, use native fetch

**Remove after migration:** `@google-cloud/storage`, `google-auth-library` — replace with R2.

### Expected Features

Research confirms this milestone targets seven P1 features required for any public launch. The product already has several genuine differentiators built (AI tagging, bulk upload, duplicate detection, drag-and-drop calendar, approval workflow) that must be foregrounded on the landing page — they are unique vs Later, Planoly, and Buffer.

**Must have for v1.0 (table stakes):**
- Public landing page + pricing page — no conversions without a front door
- Stripe billing with 14-day free trial (collect card upfront — 2-3x better conversion for professional SaaS)
- Production session store (connect-pg-simple) — MemoryStore is a live crash risk
- Cloud storage migration to Cloudflare R2 — prerequisite for Instagram publishing and containerized deployment
- Instagram OAuth completion (token storage, refresh, scope validation)
- Instagram Graph API direct publishing — three-step container flow with container status polling
- Image composition UI for single/duo/quadrant layouts — makes the existing schema real for users

**Should have post-validation (v1.x):**
- Facebook Pages publishing — shares Meta App with Instagram, low incremental cost
- Basic post analytics — requires additional App Review scope, keep separate to reduce initial review surface

**Defer to v2+:**
- X/Twitter — $200/month minimum API cost makes per-user economics unworkable at launch scale
- TikTok — separate audit process with demo video requirement; video-primary platform vs photographer use case
- Full Canva-like image editor — months of work, not a differentiator (Canva exists)
- Engagement analytics dashboard — full read permissions pipeline, separate product work

### Architecture Approach

The architecture extends the existing monolith cleanly without refactoring. The Express server gains three new modules (`server/stripe.ts`, `server/cloud-storage.ts`, `server/social/`) plus modifications to `auth.ts`, `storage.ts`, and `routes.ts`. The React SPA gains a public landing/pricing route at `/` via wouter, a Konva canvas editor loaded lazily (150KB, dynamic import), and a platform connect component. The critical structural pattern is registering the Stripe webhook route with `express.raw()` before the global `express.json()` middleware in `server/index.ts` — order matters. The `instagramCredentials` table is superseded by a new `platform_connections` table enabling multi-platform support without future schema changes.

**Major components:**
1. **Auth middleware** — swap MemoryStore for `connect-pg-simple`; session persists across deploys
2. **Cloud storage module** — single abstraction (`uploadFile`, `getPublicUrl`, `delete`) over R2; rest of codebase never imports aws-sdk directly
3. **Stripe module** — checkout session creator, webhook handler (raw body, signature verify, idempotency table), `requireActivePlan` middleware
4. **Social publish router** — `server/social/index.ts` dispatches to platform handlers; Instagram first, extensible for Facebook/TikTok
5. **Canvas editor** — Konva-based layout renderer in `client/components/ImageEditor.tsx`; exports via `stage.toBlob()` to server upload (never block server-side event loop)
6. **Landing + Pricing pages** — wouter route `/` in existing SPA; no separate deployment needed at this scale

### Critical Pitfalls

1. **Stripe raw body destruction** — register `/api/stripe/webhook` with `express.raw({ type: 'application/json' })` before `app.use(express.json())`. Failure = all webhooks return 400, subscriptions never provision.
2. **Instagram App Review blocking launch** — submit Meta App Review on day 1 of the Instagram phase. Approval takes 1-8 weeks and cannot be parallelised. A live privacy policy URL is required before submission.
3. **Instagram token silent expiry at day 60** — store `token_expires_at` in `platform_connections`, run a cron job to refresh at day 50. Without this, all publishing breaks silently two months after launch.
4. **Instagram two-step publish timing** — after `POST /{id}/media` creates a container, poll `status_code` until `FINISHED` (typically 5-30 seconds) before calling `media_publish`. Immediate publish = sporadic `MEDIA_NOT_READY` failures.
5. **Stripe webhook idempotency** — check `stripe_event_id` against a processed events table before acting. Stripe retries on network blips; without idempotency, subscriptions provision twice.
6. **Local uploads wiped on deployment** — migrate to R2 before deploying to any PaaS/container (Railway, Fly.io). Local `uploads/` is ephemeral and cannot serve as a public URL for Instagram's media fetch.

## Implications for Roadmap

Based on the dependency graph from ARCHITECTURE.md, the build order has hard constraints: sessions and storage must precede everything else; billing schema must exist before billing features; Instagram publishing depends on both R2 (public URLs) and platform_connections schema. Phases 5-7 can run in parallel once the infrastructure foundation (phases 1-4) is solid.

### Phase 1: Infrastructure Foundation
**Rationale:** MemoryStore is a production crash risk today and local disk uploads block Instagram publishing. These are blocking defects, not feature work — fix them first before adding anything new.
**Delivers:** Production-safe sessions, R2 cloud storage with public URLs, schema additions for billing and social connections, removal of GCS dependency
**Addresses:** Production session store (P1 feature), cloud storage migration (P1 feature, prerequisite for Instagram)
**Avoids:** MemoryStore OOM crash (Pitfall 4), local uploads wiped on deploy (Pitfall 5), local paths stored in photoUrl (Architecture anti-pattern 1)
**Research flag:** Standard patterns — well-documented migrations, skip research-phase

### Phase 2: Stripe Billing
**Rationale:** Monetisation infrastructure must be in place before public traffic. The `requireActivePlan` middleware also gates Instagram publishing (paid feature), so billing ships before publishing.
**Delivers:** Stripe Checkout sessions, subscription lifecycle webhooks, plan gate middleware, Stripe Customer Portal, pricing page backend
**Uses:** `stripe@^17.x`, `@stripe/stripe-js@^5.x`, `subscriptions` schema table
**Implements:** Stripe webhook handler (raw body + signature verify + idempotency table), `requireActivePlan` middleware
**Avoids:** Raw body destruction (Pitfall 1), webhook idempotency failure (Pitfall 6)
**Research flag:** Standard patterns — official Stripe docs are HIGH confidence, skip research-phase

### Phase 3: Instagram Publishing
**Rationale:** The most complex feature with an external time gate (Meta App Review). Submit review on day 1 of this phase; build implementation in parallel. Instagram is the primary platform for photographers.
**Delivers:** Complete Instagram OAuth flow (token storage, refresh job, scope validation), three-step container publish with status polling, `platform_connections` migration from `instagramCredentials`
**Uses:** Instagram Platform API Direct Login (custom OAuth, no passport-instagram), R2 public URLs for media fetch
**Implements:** Token refresh cron at day 50, container poll loop (exponential backoff, 3 attempts), `SocialPublishResult` interface for future platforms
**Avoids:** Token silent expiry (Pitfall 2), App Review blocking launch (Pitfall 3), two-step publish timing failure (Pitfall 7)
**Research flag:** Needs deeper research-phase — Instagram API has version-specific behaviour, rate limits, and App Review requirements that change frequently. Confirm current Direct Login scopes and container status polling timing before implementation.

### Phase 4: Image Composition Editor
**Rationale:** Makes the existing single/duo/quadrant schema real for users. Can run in parallel with Phase 3 once R2 is available (composite images upload to R2). Scoped to layout rendering only — not a full Canva replacement.
**Delivers:** Konva canvas editor for single/duo/quadrant layouts, crop/fit controls, composite export to R2 via `stage.toBlob()`, updated post images with composed URL
**Uses:** `react-konva@18.2.10`, `konva@^9`, `use-image@^1.1.1`, dynamic import (150KB lazy load), existing `sharp` for server-side fallback
**Implements:** `client/components/ImageEditor.tsx` as modal over PostDetail, `/api/photos/upload-composite` endpoint
**Avoids:** Blocking server event loop with canvas export (Architecture anti-pattern 4), loading Konva eagerly on every page
**Research flag:** Standard patterns — Konva documentation is HIGH confidence, skip research-phase

### Phase 5: Landing Page and Pricing
**Rationale:** Public-facing front door. Can run in parallel with Phases 3-4 once Stripe price IDs exist (Phase 2). No new framework — existing React/Tailwind/shadcn/Framer Motion stack handles this.
**Delivers:** Public landing page at `/` (wouter route), pricing page with 3-tier plan comparison, post-checkout billing success page, auth-gate redirecting logged-in users to `/dashboard`
**Uses:** Existing React + Tailwind + shadcn/ui + Framer Motion, wouter (already installed), Stripe Customer Portal link
**Implements:** `Landing.tsx`, `Pricing.tsx`, `BillingSuccess.tsx`, auth-conditional routing in `App.tsx`
**Avoids:** Pricing page making live Stripe API calls on every load (cache prices with 1-hour TTL), checkout redirect leaving user on stale free-plan state (poll subscription status 10s post-redirect)
**Research flag:** Standard patterns — well-documented React page work, skip research-phase

### Phase 6: Production Deployment and Hardening
**Rationale:** All features complete; harden for public traffic before directing users. Security, rate limiting, error handling, and environment hygiene.
**Delivers:** `helmet()` + `x-powered-by` disabled, `express-rate-limit` on auth endpoints, file type validation on upload, `NODE_ENV=production`, `secure: true` session cookies, Stripe webhook registered in Dashboard for production URL
**Avoids:** All security mistakes listed in PITFALLS.md (session cookie hardening, secret exposure, file upload validation), missing NODE_ENV
**Research flag:** Standard patterns — Express security checklist is well-documented, skip research-phase

### Phase Ordering Rationale

- **Infrastructure before features:** R2 and pg-simple sessions are blocking defects. Nothing built on top of them is trustworthy until they are fixed.
- **Billing before publishing:** `requireActivePlan` middleware is applied to Instagram publishing routes. Schema and middleware must exist first.
- **App Review parallel with Instagram build:** The 1-8 week external dependency on Meta is the project's longest lead time. Starting App Review after building the integration feature is a project management mistake.
- **Canvas and landing page after infrastructure, parallel with Instagram:** Both depend only on R2 being available (Phase 1) and Stripe prices existing (Phase 2). They do not depend on Instagram completing.
- **Hardening last:** Security hardening and deployment configuration is the final gate before public traffic, not an afterthought but not a prerequisite for building features.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Instagram Publishing):** Instagram Direct Login API scope requirements, container polling timing, App Review submission requirements, and token refresh endpoint behaviour all change with Meta platform updates. Run a research-phase sub-task at the start of Phase 3 planning to confirm current API state.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Infrastructure):** connect-pg-simple migration and S3-compatible R2 uploads are textbook patterns with official documentation.
- **Phase 2 (Stripe Billing):** Stripe's subscription + webhook + customer portal pattern is extremely well-documented.
- **Phase 4 (Canvas Editor):** Konva + react-konva patterns are stable and well-documented.
- **Phase 5 (Landing Page):** Standard React page work with existing stack.
- **Phase 6 (Hardening):** Express security checklist is straightforward.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations backed by official npm registry, official framework docs, and Cloudflare R2 docs. Version pins (stripe@17, react-konva@18.2.10) are verified against npm release history. |
| Features | HIGH | Instagram Graph API constraints (JPEG only, public URL, 50 posts/day) verified against official Meta docs. Stripe free trial patterns from official Stripe docs. Competitor pricing from current live pricing pages. |
| Architecture | HIGH | All architectural patterns derived from official Stripe, Instagram, Cloudflare, and Express documentation. Build order dependency graph verified against feature dependency analysis. |
| Pitfalls | HIGH (Stripe, sessions, R2) / MEDIUM (Instagram API) | Stripe, Express session, and file storage pitfalls verified against official docs and confirmed in production issue reports. Instagram API behaviour (polling timing, token expiry) based on official docs + community reports — treat as MEDIUM confidence and verify during Phase 3 research-phase. |

**Overall confidence:** HIGH

### Gaps to Address

- **Instagram App Review timing:** The 1-8 week estimate is based on community reports from 2024-2025. Meta's review queue times change. Validate current typical timing when submitting the review and flag as a project milestone risk.
- **Instagram Direct Login for Business accounts without a Facebook Page:** Research notes that Direct Login removes the Facebook Page requirement, but there are reported edge cases where certain Business account types still require a Page link. Validate with a real test account at the start of Phase 3.
- **R2 public URL vs presigned URL for Instagram:** Research is clear that Instagram requires a permanent public URL (not time-limited presigned). Confirm R2 bucket public domain configuration works correctly with Instagram's async image fetch before wiring up the full publish flow.
- **stripe@17 long-term support window:** v21 shipped 2026-03-25. If v22+ continues to ship, v17 will age further. Plan an SDK upgrade in the backlog within 6-8 weeks of initial launch.

## Sources

### Primary (HIGH confidence)
- [Stripe Subscriptions Docs](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — subscription lifecycle, webhook fulfillment
- [Stripe Webhooks + Signature Verification](https://docs.stripe.com/webhooks/signature) — raw body requirement, constructEvent
- [Stripe Free Trials](https://docs.stripe.com/payments/checkout/free-trials) — trial_period_days, payment_method_collection options
- [Instagram Platform Content Publishing — Meta](https://developers.facebook.com/docs/instagram-platform/content-publishing/) — container flow, public URL requirement, scopes
- [Instagram Direct Login — Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing) — Direct Login API, July 2024 launch
- [Cloudflare R2 AWS SDK v3 docs](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) — S3-compatible configuration
- [sharp compositing API](https://sharp.pixelplumbing.com/api-composite/) — composite() method
- [connect-pg-simple GitHub](https://github.com/voxpelli/node-connect-pg-simple) — production session store
- [react-konva npm](https://www.npmjs.com/package/react-konva) — version compatibility matrix
- [Konva React Getting Started](https://konvajs.org/docs/react/index.html) — React canvas integration
- [Express.js security best practices](https://expressjs.com/en/advanced/best-practice-security.html) — helmet, rate limiting, cookie flags

### Secondary (MEDIUM confidence)
- [Instagram Direct Login GitHub Gist](https://gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc) — Node.js Direct Login implementation reference
- [Instagram Graph API 2026 Guide — Elfsight](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/) — current API state summary
- [Troubleshooting Instagram API — Phyllo](https://www.getphyllo.com/post/troubleshooting-common-issues-with-instagram-api) — common failure modes
- [Instagram connection reauthorization 60 days — Make Community](https://community.make.com/t/instagram-connection-has-to-be-reauthorized-every-60-days/41109) — token expiry confirmation
- [SaaS Free Trial Best Practices 2026 — Encharge](https://encharge.io/saas-free-trial-best-practices/) — card-upfront conversion benchmarks
- [Fabric.js vs Konva vs PixiJS 2026 — PkgPulse](https://www.pkgpulse.com/blog/fabricjs-vs-konva-vs-pixijs-canvas-2d-graphics-libraries-2026) — canvas library comparison

### Tertiary (LOW confidence)
- [X API Pricing 2026 — Zernio](https://zernio.com/blog/twitter-api-pricing) — $200/month minimum; pricing tiers may change
- [TikTok Content Posting API — TikTok Developers](https://developers.tiktok.com/products/content-posting-api/) — photo posting support, audit requirements

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
