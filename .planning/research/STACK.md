# Stack Research

**Domain:** Social media management SaaS — production milestone additions
**Researched:** 2026-03-26
**Confidence:** HIGH (Stripe, Sharp, session store), MEDIUM (Instagram API, R2), LOW (multi-platform beyond Instagram)

---

## Existing Stack (DO NOT RE-RESEARCH)

React 18 + Express 4 + Vite 5 + Drizzle ORM + PostgreSQL + OpenAI — validated, shipping.

---

## New Additions Required

### Payments — Stripe

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `stripe` | `^17.x` (pin to `17.x`, NOT `21.x`) | Server-side billing, subscriptions, webhooks | `stripe@21` just released with breaking type changes; `17.x` is the last stable series with the established API. Pin to avoid surprise breakage. Stripe's versioning is aggressive. |
| `@stripe/stripe-js` | `^5.x` | Client-side Stripe.js for payment element (Stripe-hosted iframe) | Never handle raw card data in your React app — always use Stripe Elements. |

**Why NOT `stripe@21.x`:** Released 2026-03-25 with breaking changes to TypeScript types and package structure. Let it stabilise for a month before adopting.

**Webhook setup constraint:** The webhook route must receive the **raw request body**, so register it before `express.json()` middleware. Use `express.raw({ type: 'application/json' })` scoped to that route only.

---

### Image Composition — Server-Side (sharp already installed)

`sharp@^0.34.5` is already in `package.json`. No new library needed.

sharp supports the full composition pipeline for duo/quadrant layouts:
- `composite([{ input, top, left }])` to position multiple images on a base canvas
- `create({ width, height, channels, background })` to make a blank canvas
- `.toBuffer()` to produce the composed image for storage

Use sharp on the **server** (Express route) to render the final composition. Do not use canvas or browser-side rendering for the output that gets uploaded to Instagram — Instagram requires a publicly accessible JPEG URL, and sharp produces that directly.

**No new server-side library needed for image composition.**

---

### Image Editing UI — react-konva

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-konva` | `18.2.10` | Interactive canvas editor for split/duo/quadrant preview and crop | react-konva 19.x requires React 19. This project uses React 18.3.x. Use `18.2.10` — last stable release on the React 18 peer dep series. |
| `konva` | `^9.x` | Konva core (peer dep of react-konva 18.2) | Required peer dep. |
| `use-image` | `^1.1.1` | Load image URLs into Konva Image nodes | Maintained by the konva org. Avoids manual Image() DOM boilerplate in React. |

**Install pinned version:**
```bash
npm install react-konva@18.2.10 konva@^9 use-image
```

**Why NOT the latest react-konva 19.x:** Requires React 19. Upgrading React mid-milestone introduces unrelated risk. Stay on 18.2.10 until React upgrade is planned separately.

---

### Cloud Storage — Cloudflare R2

`@google-cloud/storage@^7.18.0` is already in `package.json` (likely from Replit scaffold). However it has no configured bucket — replace with Cloudflare R2 for production.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@aws-sdk/client-s3` | `^3.x` | Upload/delete objects, generate presigned URLs | R2 is S3-compatible. Use the standard AWS SDK v3 — no R2-specific SDK exists or is needed. |
| `@aws-sdk/s3-request-presigner` | `^3.x` | Generate time-limited presigned GET URLs for private assets | Required for secure image serving without exposing storage credentials. |

**Why R2 over GCS (already in package.json):** R2 has zero egress fees — critical for a photo-heavy app. GCS charges per GB downloaded. For a photographer uploading hundreds of photos, egress costs on GCS would compound quickly. R2's S3 compatibility means no vendor-specific SDK needed.

**Why NOT S3 directly:** Same pricing structure as GCS (egress fees). R2 is the correct choice for media-heavy apps.

**Remove:** `@google-cloud/storage` and `google-auth-library` once R2 is wired up (check if google-auth-library is used elsewhere first).

---

### Session Store — connect-pg-simple

`memorystore` is already installed but is explicitly not production-safe (leaks memory, no horizontal scale).

`connect-pg-simple@^10.0.0` is already in `package.json`. It just needs to be **wired up** — replace the `memorystore` instantiation with `connectPgSimple(session)` using the existing `pg.Pool`. No new install required.

Run the session table migration once:
```sql
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

---

### Instagram Publishing

**Use the Instagram Platform API (Direct Login) — NOT the legacy Graph API via Facebook Page.**

Meta launched Direct Login in July 2024. It allows Instagram Business/Creator accounts to authorize directly without requiring a linked Facebook Page. This is the correct approach for a SaaS where users connect their own Instagram.

No npm wrapper library is needed. Direct REST calls with `axios` or the native `fetch` API are sufficient. The API is simple (2 calls to publish: create container → publish container).

| Endpoint | Purpose |
|----------|---------|
| `https://api.instagram.com/oauth/authorize` | OAuth 2.0 authorization URL |
| `https://api.instagram.com/oauth/access_token` | Exchange code for short-lived token |
| `https://graph.instagram.com/refresh_access_token` | Extend token (60-day long-lived tokens) |
| `https://graph.instagram.com/{ig_id}/media` | Create media container |
| `https://graph.instagram.com/{ig_id}/media_publish` | Publish container |

**Required OAuth scopes:** `instagram_business_basic`, `instagram_content_publish`

**Key constraint:** The image URL submitted to the container endpoint must be publicly accessible at call time. This means: upload to R2 first, generate a public (or presigned-public) URL, then call the Instagram API. Do not use local filesystem paths.

**Token storage:** Store long-lived tokens (60 days) encrypted in the existing `instagramCredentials` table. Add a `tokenExpiresAt` column. Refresh before expiry.

**Why NOT `passport-instagram`:** The jaredhanson/passport-instagram package targets the legacy Basic Display API (for personal accounts). It does not support the Direct Login API for Business/Creator publishing. Use a custom OAuth handler.

**Why NOT `instagram-private-api`:** Scrapes Instagram's internal web API. Violates ToS. Accounts will be banned.

---

### Landing Page

No new framework required. The existing React + Vite + Tailwind + shadcn/ui stack is sufficient for a marketing landing page.

Use Wouter (already installed) to add a public route at `/` that renders the landing page, with the app dashboard redirecting to `/app` (or gating behind auth middleware).

**Framer Motion** is already installed for animations. Use it for hero section entrance animations.

---

### Multi-Platform Social APIs (Twitter/X, LinkedIn, Pinterest)

**Defer to a future milestone.** Do not add these APIs in this milestone.

Rationale:
- Each platform has different OAuth flows, token models, media requirements, and rate limits
- Adding Twitter/X in the same milestone as Instagram doubles the auth complexity without delivering user value proportionally
- Instagram is the primary platform for photographers (the core persona)
- The webhook-based posting already works for other platforms as a fallback

When ready: use `twitter-api-v2` for Twitter (maintained, TypeScript-first), and direct REST for LinkedIn.

---

## Recommended Stack Summary (New Additions Only)

### Core Technologies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` | `^17.x` | Subscriptions, billing, webhooks | Pin below breaking v21, stable API |
| `@stripe/stripe-js` | `^5.x` | Payment Element (client) | PCI compliant, hosted card input |
| `react-konva` | `18.2.10` | Canvas image editor UI | React 18 compatible, actively maintained |
| `konva` | `^9.x` | Canvas engine (react-konva peer dep) | Required by react-konva |
| `use-image` | `^1.1.1` | Load URLs into Konva canvas | Konva org maintained |
| `@aws-sdk/client-s3` | `^3.x` | R2 object storage (upload, delete) | S3-compatible, no egress fees |
| `@aws-sdk/s3-request-presigner` | `^3.x` | Presigned URLs for private assets | Required for secure serving |

### No New Install Needed (Already Present, Just Wire Up)

| Package | Status | Action |
|---------|--------|--------|
| `sharp` | v0.34.5 installed | Use `composite()` for duo/quadrant server-side rendering |
| `connect-pg-simple` | v10 installed | Replace `memorystore` in session config |
| `@google-cloud/storage` | v7 installed | **Remove** — replace with R2 via AWS SDK |
| `passport`, `passport-local` | installed | Keep — add Instagram OAuth as a separate custom handler |

---

## Installation

```bash
# Payments
npm install stripe@^17 @stripe/stripe-js@^5

# Canvas editor (React 18 compatible)
npm install react-konva@18.2.10 konva@^9 use-image

# Cloud storage (R2 via S3-compatible SDK)
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Remove GCS (after migrating uploads)
npm uninstall @google-cloud/storage google-auth-library
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `stripe@^17` | `stripe@^21` | After 21.x stabilises (give it 4-6 weeks post-release) |
| `react-konva@18.2.10` | `react-konva@19.x` | When you upgrade React to v19 |
| `react-konva` (canvas) | `fabric.js` | fabric.js has broader text/SVG support; choose if editor needs text overlays or vector graphics |
| Cloudflare R2 | AWS S3 | If already on AWS and egress costs are acceptable (e.g. US-only, small volume) |
| Cloudflare R2 | Cloudinary | Cloudinary if you need on-the-fly image transforms via URL params; R2 if you own the transform pipeline (sharp) |
| Custom Instagram OAuth | `passport-instagram` | Never — passport-instagram targets the deprecated Basic Display API |
| Direct Instagram REST | `instagram-graph-api` npm | Only if you need a typed wrapper; the API is simple enough that direct fetch is cleaner |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `stripe@^21.x` now | Released 2026-03-25 with breaking type changes, not yet stable | `stripe@^17.x` — pin this range |
| `react-konva@^19.x` | Requires React 19, incompatible with this project's React 18 | `react-konva@18.2.10` |
| `memorystore` in production | Leaks memory, single-process only — already the app's known weakness | `connect-pg-simple` (already installed) |
| `instagram-private-api` | Scrapes internal API, violates ToS, accounts get banned | Instagram Platform API (Direct Login) |
| `passport-instagram` | Targets deprecated Basic Display API, not content publishing | Custom OAuth handler against `api.instagram.com` |
| `google-auth-library` + `@google-cloud/storage` | GCS has egress fees; replaces a paid problem with a free one | `@aws-sdk/client-s3` pointed at Cloudflare R2 |
| `canvas` (npm) | Requires native Cairo bindings, Docker build complexity, harder than sharp | `sharp` (already installed, no native build issues on modern Node) |

---

## Stack Patterns by Scenario

**If Stripe webhook route conflicts with `express.json()`:**
- Register `/api/stripe/webhook` with `express.raw({ type: 'application/json' })` BEFORE the global JSON body parser
- All other routes get `express.json()` as normal

**If Instagram image URL needs to be public for container creation:**
- Upload to R2 first → get the public URL → pass to Instagram API
- Do NOT use presigned (time-limited) URLs for Instagram — Meta's backend fetches the URL asynchronously and it may expire

**If React 18 → 19 upgrade is planned:**
- Upgrade `react-konva` to latest at that point (currently 19.2.3)
- No other canvas-related changes needed

**If multi-platform is added later:**
- Twitter/X: `twitter-api-v2` npm package (TypeScript-first, actively maintained)
- LinkedIn: Direct REST, no maintained npm wrapper worth using
- TikTok: Separate Content Posting API — very different auth flow, defer

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-konva@18.2.10` | `react@^18`, `konva@^9` | Do NOT use with react@19 — peer dep mismatch |
| `stripe@^17` | Node.js 18+ | Current LTS (Node 20+) recommended |
| `@aws-sdk/client-s3@^3` | Node.js 16+ | Modular SDK, install only s3 client not full SDK |
| `connect-pg-simple@^10` | `express-session@^1.18`, `pg@^8` | Both already installed |
| `sharp@0.34.5` | Node.js 18.17+ | Already installed, no change needed |

---

## Sources

- Stripe npm registry — `stripe@21.0.0` confirmed as 2026-03-25 release with breaking changes; `^17.x` recommended as stable
- [Stripe Subscriptions Docs](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — webhook-first fulfillment pattern (HIGH confidence)
- [Instagram Platform API — Content Publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing) — Direct Login API, JPEG-only, public URL required (HIGH confidence)
- [Instagram Direct Login GitHub Gist](https://gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc) — July 2024 launch, Node.js implementation reference (MEDIUM confidence)
- [react-konva npm](https://www.npmjs.com/package/react-konva) — `18.2.10` confirmed as React 18 compatible; `19.2.3` requires React 19 (HIGH confidence)
- [Cloudflare R2 AWS SDK v3 docs](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) — S3-compatible, `@aws-sdk/client-s3` configuration (HIGH confidence)
- [sharp compositing API](https://sharp.pixelplumbing.com/api-composite/) — `composite()` method for multi-image layouts (HIGH confidence)
- [connect-pg-simple GitHub](https://github.com/voxpelli/node-connect-pg-simple) — production PostgreSQL session store, replaces memorystore (HIGH confidence)
- [Stripe webhook best practices](https://docs.stripe.com/webhooks/quickstart?lang=node) — raw body requirement, signature verification (HIGH confidence)

---

*Stack research for: Social Media Manager — production milestone (landing page, billing, Instagram API, image editor, prod hardening)*
*Researched: 2026-03-26*
