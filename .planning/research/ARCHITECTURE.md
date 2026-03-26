# Architecture Research

**Domain:** Social media management SaaS — production milestone
**Researched:** 2026-03-26
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER (React SPA)                     │
│                                                                    │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐  │
│  │ Landing   │  │  App SPA  │  │  Canvas   │  │  Billing UI   │  │
│  │  (wouter  │  │ (existing │  │  Editor   │  │  (Stripe.js)  │  │
│  │  route /) │  │   pages)  │  │  (Konva)  │  │               │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───────┬───────┘  │
│        └──────────────┴──────────────┴────────────────┘           │
│                              ↕ TanStack Query                     │
└──────────────────────────────────────────────────────────────────┘
                               ↕ HTTP / REST
┌──────────────────────────────────────────────────────────────────┐
│                     SERVER LAYER (Express)                        │
│                                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  Auth MW    │  │  Plan Gate   │  │  Stripe Webhook          │  │
│  │ (session +  │  │  Middleware  │  │  (raw body, sig verify)  │  │
│  │  pg-simple) │  │  (sub check) │  │                          │  │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘  │
│                                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  /api/auth  │  │  /api/posts  │  │  /api/billing           │  │
│  │  /api/user  │  │  /api/photos │  │  /api/stripe/webhook    │  │
│  │             │  │  /api/social │  │                          │  │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘  │
│                                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  Instagram  │  │  Scheduler   │  │  Storage Service        │  │
│  │  Graph API  │  │  (cron/poll) │  │  (Cloudflare R2)        │  │
│  │  module     │  │              │  │                          │  │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               ↕
┌──────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                   │
│                                                                    │
│  ┌─────────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │  PostgreSQL      │  │  Sessions   │  │  Cloudflare R2       │  │
│  │  (Drizzle ORM)   │  │  (pg-simple │  │  (image files,       │  │
│  │  users, posts,   │  │   store)    │  │   public CDN URLs)   │  │
│  │  photos, billing │  │             │  │                      │  │
│  └─────────────────┘  └─────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               ↕
┌──────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                               │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  Stripe API  │  │  Instagram   │  │  OpenAI API          │    │
│  │  (billing,   │  │  Graph API   │  │  (tagging, captions) │    │
│  │   webhooks)  │  │  v21.0       │  │                      │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|---------------|--------|
| Landing page | Public marketing, pricing, sign-up CTA | NEW — wouter route `/` |
| App SPA | All authenticated photographer workflow | EXISTING — keep as-is |
| Canvas editor | Image composition (single/duo/quadrant layouts) | NEW — Konva + react-konva |
| Billing UI | Stripe Checkout redirect, plan status display | NEW — thin client |
| Auth middleware | Session validation, requireAuth | MODIFY — swap memorystore → pg-simple |
| Plan gate middleware | Checks subscription status before protected routes | NEW — DB lookup |
| Stripe webhook handler | Syncs subscription events to DB | NEW — raw body route |
| Instagram module | Graph API OAuth + publish | EXISTING scaffold — complete |
| Storage service | Upload, URL generation, delete | MODIFY — replace local disk with R2 |
| Scheduler | Polls for due posts, triggers publish | EXISTING — extend for direct API |
| Drizzle schema | All DB tables | MODIFY — add billing tables |

---

## Recommended Project Structure

```
server/
├── index.ts              # Express bootstrap (MODIFY — add R2 env checks)
├── routes.ts             # All API routes (MODIFY — add billing, social routes)
├── auth.ts               # Auth helpers (MODIFY — swap session store)
├── storage.ts            # DB storage interface (MODIFY — add billing methods)
├── db.ts                 # Drizzle + pg connection (unchanged)
├── instagram.ts          # Instagram Graph API (MODIFY — complete integration)
├── stripe.ts             # NEW — Stripe client, webhook handler, plan gate MW
├── social/               # NEW — multi-platform publishing
│   ├── index.ts          #   Platform router (chooses provider per post)
│   ├── instagram.ts      #   Thin wrapper around existing instagram.ts
│   └── types.ts          #   Shared SocialPostResult interface
├── cloud-storage.ts      # NEW — Cloudflare R2 via aws-sdk v3 S3 client
├── openai.ts             # AI tagging (unchanged)
├── post-generator.ts     # Post content generation (unchanged)
├── similarity.ts         # Duplicate detection (unchanged)
└── static.ts             # Static file serving (unchanged)

shared/
└── schema.ts             # MODIFY — add subscriptions, platform_connections tables

client/src/
├── App.tsx               # MODIFY — add landing route, billing routes
├── pages/
│   ├── Landing.tsx       # NEW — public marketing page
│   ├── Pricing.tsx       # NEW — plan selector → Stripe Checkout
│   ├── BillingSuccess.tsx # NEW — post-checkout confirmation
│   ├── Dashboard.tsx     # EXISTING (unchanged)
│   ├── Account.tsx       # MODIFY — add connected platforms, billing status
│   ├── PostDetail.tsx    # MODIFY — add canvas editor
│   └── ...               # other existing pages unchanged
├── components/
│   ├── ImageEditor.tsx   # NEW — Konva canvas editor for post layouts
│   ├── PlatformConnect.tsx # NEW — OAuth connect buttons per platform
│   └── ...               # existing components unchanged
└── lib/
    ├── auth.tsx          # EXISTING auth context (unchanged)
    └── stripe.ts         # NEW — thin Stripe.js helper (redirect to Checkout)
```

### Structure Rationale

- **server/social/**: Isolates multi-platform logic so adding TikTok/Facebook later is a file addition, not a refactor of routes.ts
- **server/cloud-storage.ts**: Single abstraction over R2 so the rest of the codebase never imports aws-sdk directly
- **server/stripe.ts**: Keeps all Stripe logic out of routes.ts — the webhook handler needs `express.raw()` middleware which must be registered before `express.json()` on its route
- **client/pages/Landing.tsx**: Landing lives inside the same React SPA using wouter. The `/` route shows Landing to unauthenticated users and redirects to `/dashboard` for authenticated users — no separate deployment needed

---

## Architectural Patterns

### Pattern 1: Webhook-Before-JSON Middleware

**What:** Stripe's webhook endpoint must receive the raw request body (not JSON-parsed) so signature verification can work. Express's global `express.json()` middleware will break this.

**When to use:** Any Stripe webhook endpoint.

**Trade-offs:** Must register the raw-body route before the global json middleware, or use a route-specific override.

**Example:**
```typescript
// server/index.ts — register BEFORE app.use(express.json())
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// Then register global json parser
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
```

Note: The existing codebase already captures `rawBody` on the json middleware. The webhook route simply needs its own `express.raw()` applied first. Order in `index.ts` matters.

### Pattern 2: Plan Gate Middleware

**What:** A reusable Express middleware that reads the user's subscription status from the DB and rejects the request with 402 if they are not on an active paid plan.

**When to use:** Any route that requires a paid subscription (e.g., direct Instagram publishing, canvas export, bulk upload beyond free tier limits).

**Trade-offs:** DB lookup on every gated request — acceptable for this scale. Cache in session if needed later.

**Example:**
```typescript
// server/stripe.ts
export async function requireActivePlan(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const sub = await storage.getSubscription(userId);
  if (!sub || sub.status !== "active") {
    return res.status(402).json({ error: "Active subscription required" });
  }
  next();
}

// Usage in routes.ts
app.post("/api/social/publish", requireAuth, requireActivePlan, publishHandler);
```

### Pattern 3: Cloud Storage Abstraction

**What:** All file reads/writes go through a single `cloudStorage` module that exposes `upload(buffer, key)`, `getPublicUrl(key)`, and `delete(key)`. The rest of the codebase never knows whether files are on disk or R2.

**When to use:** During the storage migration phase, and permanently after.

**Trade-offs:** Small indirection overhead. Makes future storage provider swaps trivial.

**Example:**
```typescript
// server/cloud-storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, // https://<account>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  await r2.send(new PutObjectCommand({
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

R2 bucket must be configured with public access (custom domain or Cloudflare R2 public URL) so Instagram Graph API can fetch the image. Instagram requires images to be at a publicly accessible URL at publish time — pre-signed URLs with expiry are not reliable for this.

### Pattern 4: Landing Page as Wouter Route

**What:** The landing page lives at `/` inside the existing React SPA. `App.tsx` checks auth state — unauthenticated users see Landing, authenticated users are redirected to `/dashboard`.

**When to use:** When you want to avoid a separate static site deployment.

**Trade-offs:** Landing page and app share the same JS bundle. For a photographer tool this is acceptable (users who visit the landing will typically convert and become app users). If SEO is critical later, extract to a separate Next.js or Astro site.

**Example:**
```typescript
// client/src/App.tsx modification
function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  // Unauthenticated: show landing or login
  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/login" component={Login} />
        <Route component={Login} /> {/* fallback: redirect unknown public routes to login */}
      </Switch>
    );
  }

  return <AuthenticatedRoutes />;
}
```

### Pattern 5: Canvas Editor as Modal/Panel

**What:** The Konva canvas editor opens as a full-screen drawer or modal over the existing post detail view. It receives the post's image paths, renders them in the chosen layout (single/duo/quadrant), allows crop/filter/text overlay, then exports the composite as a new image that replaces the post's image list.

**When to use:** When the user clicks "Edit Layout" on a post.

**Trade-offs:** Konva adds ~150KB to the bundle. Use dynamic `import()` so it only loads when the editor opens. The existing `postLayoutValues` schema already supports single/duo/quadrant — the editor makes this schema real.

---

## Data Flow

### Stripe Subscription Flow

```
User clicks "Upgrade"
    ↓
POST /api/billing/create-checkout-session
    ↓ (server creates Stripe Checkout Session)
Client redirects to Stripe-hosted Checkout
    ↓ (user pays)
Stripe → POST /api/stripe/webhook (invoice.paid / customer.subscription.updated)
    ↓ (server upserts subscriptions table)
User lands on /billing/success
    ↓ (client refreshes auth/user → sees active plan)
```

### Instagram Direct Publish Flow

```
User clicks "Publish to Instagram"
    ↓
POST /api/social/publish { postId, platforms: ["instagram"] }
    → requireAuth → requireActivePlan
    ↓
Server fetches post + images from DB
Server generates public R2 URLs (already public, no signing needed)
    ↓
server/social/instagram.ts → postToInstagram(accessToken, igUserId, imageUrls, caption)
    ↓
Instagram Graph API creates media container → publishes
    ↓
Server updates post.status = "posted" in DB
```

### Image Upload Flow (Post-Migration)

```
Client selects files (Uppy dashboard)
    ↓
POST /api/photos/upload (multer reads file buffer into memory)
    ↓
server/cloud-storage.ts → uploadFile(key, buffer, mimeType) → R2
    ↓
R2 returns public CDN URL
    ↓
Server saves tagged_photos record with photoUrl = CDN URL
    ↓
Client receives photo object with permanent public URL
```

### Canvas Editor Export Flow

```
User edits composition in Konva canvas
    ↓
client: stage.toBlob() → FormData
    ↓
POST /api/photos/upload-composite
    ↓
server: buffer → R2 → CDN URL
    ↓
PATCH /api/posts/:id { images: [newCompositeUrl] }
    ↓
Post record updated, canvas editor closes
```

---

## Integration Points — New vs Modified

### What Changes in Existing Files

| File | Change Type | What Changes |
|------|------------|--------------|
| `server/index.ts` | MODIFY | Register `/api/stripe/webhook` with `express.raw()` BEFORE global json middleware |
| `server/routes.ts` | MODIFY | Add billing routes, social publish route, remove local disk upload logic |
| `server/auth.ts` | MODIFY | Swap `memorystore` for `connect-pg-simple` session store |
| `server/storage.ts` | MODIFY | Add `getSubscription`, `upsertSubscription` methods |
| `shared/schema.ts` | MODIFY | Add `subscriptions` table, `platform_connections` table |
| `client/src/App.tsx` | MODIFY | Add landing/pricing routes for unauthenticated users |
| `client/src/pages/Account.tsx` | MODIFY | Add platform connect/disconnect UI, billing status |
| `client/src/pages/PostDetail.tsx` | MODIFY | Add canvas editor trigger button |

### What Gets Added (New Files)

| File | Purpose |
|------|---------|
| `server/stripe.ts` | Stripe client, checkout session creator, webhook handler, `requireActivePlan` MW |
| `server/cloud-storage.ts` | R2 upload/URL/delete via aws-sdk S3 client |
| `server/social/index.ts` | Platform router — dispatches to instagram/future platforms |
| `server/social/types.ts` | `SocialPublishResult` interface shared across platforms |
| `client/src/pages/Landing.tsx` | Public marketing page |
| `client/src/pages/Pricing.tsx` | Plan selection → Stripe Checkout redirect |
| `client/src/pages/BillingSuccess.tsx` | Post-checkout confirmation |
| `client/src/components/ImageEditor.tsx` | Konva canvas editor for photo layouts |
| `client/src/components/PlatformConnect.tsx` | OAuth connect/disconnect per social platform |
| `client/src/lib/stripe.ts` | `redirectToCheckout(priceId)` helper |

### New Schema Tables

```typescript
// shared/schema.ts additions

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  status: text("status").notNull().default("inactive"), // "active" | "inactive" | "past_due" | "canceled"
  currentPeriodEnd: timestamp("current_period_end"),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const platformConnections = pgTable("platform_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  platform: text("platform").notNull(), // "instagram" | "facebook" | "tiktok"
  platformUserId: text("platform_user_id").notNull(),
  platformUsername: text("platform_username"),
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  connectedAt: timestamp("connected_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});
// Replaces the single-platform instagramCredentials table
```

Note: The existing `instagramCredentials` table is superseded by `platformConnections`. Migration script required to copy existing Instagram credentials rows into the new table format.

---

## External Service Integration

| Service | Integration Pattern | Key Constraint |
|---------|---------------------|----------------|
| Stripe | Server-side Checkout Sessions + webhook | Webhook route must use `express.raw()`, not parsed JSON |
| Instagram Graph API | Facebook OAuth → long-lived page access token | Images must be publicly accessible URLs at publish time |
| Cloudflare R2 | AWS SDK v3 S3Client pointing at R2 endpoint | Bucket needs public read OR custom domain for Instagram publishing |
| OpenAI | Existing `server/openai.ts` | Unchanged |
| Konva.js | React client-side canvas library | Load lazily via dynamic import — 150KB addition |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 users | Current monolith is fine. R2 handles file scale. pg-simple sessions are sufficient |
| 500–5K users | Add a job queue (BullMQ + Redis) for scheduled post publishing instead of polling loop. R2 stays cheap |
| 5K–50K users | Consider separating the scheduler into a separate worker process. Session store can stay pg-simple or move to Redis |
| 50K+ users | Extract social publishing into a microservice. This architecture doesn't need to plan for this |

### Scaling Priorities

1. **First bottleneck — scheduled post polling:** The current webhook-based publish model uses a poll/dispatch loop. Under load this hits the DB every minute for all users. Fix: BullMQ queue, one job per scheduled post.
2. **Second bottleneck — image processing at upload:** Sharp thumbnail generation is synchronous in the upload route. Fix: move to background job on a queue.

---

## Anti-Patterns

### Anti-Pattern 1: Storing Local Paths in photoUrl

**What people do:** Keep `uploads/uuid-file.jpg` as the `photoUrl` value in the DB after migrating to R2.
**Why it's wrong:** Instagram Graph API calls the URL to fetch the image. A relative local path is not a public URL.
**Do this instead:** Always store the full public CDN URL (e.g., `https://pub-xxx.r2.dev/uuid-file.jpg`) in `photoUrl` from the moment of upload. Update the upload handler to call `cloudStorage.uploadFile()` and save the returned CDN URL.

### Anti-Pattern 2: Trusting Stripe Webhooks Without Signature Verification

**What people do:** Accept all POST requests to `/api/stripe/webhook` as legitimate.
**Why it's wrong:** Anyone can POST fake subscription events and unlock paid features.
**Do this instead:** Always call `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`. Reject requests where this throws.

### Anti-Pattern 3: Persisting Instagram Access Tokens in the Frontend

**What people do:** Return the access token in the OAuth callback response and store in localStorage.
**Why it's wrong:** Access tokens in localStorage are exposed to XSS. Instagram tokens can be long-lived (60-day page tokens).
**Do this instead:** Store tokens server-side in `platform_connections` table. The client never sees the raw token — it only calls authenticated API routes.

### Anti-Pattern 4: Blocking the Event Loop for Image Export

**What people do:** Use a synchronous canvas-to-buffer operation on the server to generate composite images.
**Why it's wrong:** Blocks Express from handling other requests during the export.
**Do this instead:** Export canvas to Blob in the browser (Konva's `stage.toBlob()`), upload the result to the server as a file. All CPU-intensive work stays on the client.

### Anti-Pattern 5: One Big routes.ts File

**What people do:** Add all new billing + social + canvas upload routes directly to the existing `routes.ts`.
**Why it's wrong:** `routes.ts` is already large. Mixing Stripe webhook logic (which needs raw body middleware) with everything else causes middleware ordering bugs.
**Do this instead:** Keep `routes.ts` as the orchestrator that imports and mounts sub-routers: `app.use("/api/billing", billingRouter)`, `app.use("/api/social", socialRouter)`.

---

## Build Order (Dependency Graph)

The features have hard dependencies that determine the correct build sequence:

```
1. Auth hardening (pg-simple sessions)
   ↓ required for production deploy to work at all
2. Cloud storage (R2)
   ↓ required before Instagram direct posting (images need public URLs)
3. Schema additions (subscriptions + platform_connections tables)
   ↓ required before billing and social connect features
4. Stripe billing (checkout + webhook + plan gate)
   ↓ required before gating any paid features
5. Instagram direct publish (completes existing OAuth scaffold)
   ↓ depends on cloud storage (public URLs) + platform_connections schema
6. Canvas image editor (Konva)
   ↓ depends on cloud storage (composite upload) — can be built in parallel with #5
7. Landing page + pricing page
   ↓ depends on Stripe (pricing tiers must exist) — can be built in parallel with #5-6
8. Production deployment (Railway/Fly.io)
   ↓ all above must be complete; deploy depends on R2, pg, Stripe env vars
```

Phases 5, 6, and 7 can run in parallel once 1–4 are done.

---

## Sources

- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks) — raw body requirement, signature verification
- [Stripe Build Subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — subscription lifecycle events
- [Instagram Graph API Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/) — public URL requirement for media
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — R2 + AWS SDK v3 compatibility
- [connect-pg-simple](https://www.npmjs.com/package/connect-pg-simple) — PostgreSQL session store for Express
- [Konva React Getting Started](https://konvajs.org/docs/react/index.html) — React canvas integration
- [Railway Express Deploy Guide](https://docs.railway.com/guides/express) — production deployment target

---

*Architecture research for: Social media manager production milestone*
*Researched: 2026-03-26*
