# Phase 2: Billing - Research

**Researched:** 2026-03-26
**Domain:** Stripe subscriptions, trial management, webhooks, feature gating — Express + React SaaS
**Confidence:** HIGH

## Summary

Phase 2 adds Stripe-backed subscription billing to the social media manager app. The existing stack (Express 4, React 18, Drizzle ORM + PostgreSQL, Vite 5) is already well-suited — no new framework is needed, only `stripe@^17.x` and `@stripe/stripe-js@^5.x`. The core flow is: Stripe Checkout Session with a 14-day trial (card required) → webhook event syncs subscription status to the DB → middleware gates paid features against active subscription → Stripe Customer Portal handles all self-service plan management.

The most critical implementation constraint is the raw body requirement for webhook signature verification. The current `server/index.ts` already captures `rawBody` via the `verify` callback on `express.json()` — this is a valid approach, but the webhook handler MUST read `req.rawBody` (the Buffer captured at the verify stage), NOT re-parse the body. The idempotency table for webhook events must be built before any event handler logic is written, as Stripe will retry delivery and duplicate handling is the most damaging billing bug.

The users table currently has no billing columns. This phase requires a schema migration to add `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `planTier`, `trialEndsAt`, and a separate `stripe_events` table for idempotency. A `subscriptionGate` middleware function will protect paid-tier routes by checking `subscriptionStatus IN ('trialing', 'active')`.

**Primary recommendation:** Build in this order — (1) schema migration, (2) idempotency table, (3) webhook handler with full event set, (4) Checkout Session endpoint, (5) Customer Portal endpoint, (6) subscription gate middleware, (7) pricing UI. Never provision access before the webhook confirms it.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-01 | User can sign up for a 14-day free trial with card on file | Stripe Checkout Session with `subscription_data.trial_period_days: 14` and `payment_method_collection: 'always'`. Covered by Checkout Session pattern. |
| BILL-02 | Three pricing tiers: Free (limited), Starter (~$19/mo), Pro (~$49/mo) | Stripe Products + Prices created in Stripe Dashboard. Pricing page reads from hardcoded plan config (not live Stripe API per page load — cache risk). Feature comparison table in React. |
| BILL-03 | Subscription status synced from Stripe webhooks to DB | Webhook handler processes `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. DB column `subscriptionStatus` updated atomically per event. |
| BILL-04 | User can manage subscription via Stripe Customer Portal | `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url })` returns a redirect URL. One API call, no custom UI needed. |
| BILL-05 | Paid features gated by active subscription status | `requireSubscription` middleware checks `subscriptionStatus IN ('trialing', 'active')` before protected routes. Returns 402 with upgrade prompt data. |
| BILL-06 | Stripe webhook idempotent — no duplicate actions on retry | `stripe_events` table checked before processing. Insert event ID as first DB write; if duplicate → 200 immediately. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | `^17.x` (PINNED — do NOT use ^21) | Server-side: create Checkout Sessions, Customer Portal sessions, verify webhooks, sync subscription state | Industry standard. v21 released 2026-03-25 with breaking TypeScript changes. Pin to 17.x until it stabilises. |
| `@stripe/stripe-js` | `^5.x` | Client-side: load Stripe.js for Stripe-hosted Checkout redirect | PCI compliance — card data never touches your server. Redirect-based Checkout means minimal client-side code needed. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` | already installed | Schema migrations for billing columns, idempotency table queries | Use Drizzle's `pgTable` to define new tables; run via `drizzle-kit push` or migration file |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Checkout (hosted) | Stripe Payment Element (embedded) | Payment Element gives more UI control but requires PCI SAQ A-EP instead of SAQ A. For a SaaS trial flow, hosted Checkout is simpler and sufficient. |
| Stripe Customer Portal | Custom billing management UI | Portal handles cancellations, upgrades, invoice history with zero code. Building custom UI takes a sprint for parity. Never hand-roll this. |
| `stripe@^17` | `stripe@^21` | Use 21.x after it stabilises (~4-6 weeks post 2026-03-25 release). Until then, ^17 is the locked version per project decisions. |

**Installation:**
```bash
npm install stripe@^17 @stripe/stripe-js@^5
```

## Architecture Patterns

### Recommended Project Structure

```
server/
├── billing.ts          # All Stripe API calls (createCheckoutSession, createPortalSession, syncSubscription)
├── billing-webhook.ts  # Webhook handler with idempotency check + event dispatch
├── middleware/
│   └── requireSubscription.ts  # 402 gate for paid features
shared/
└── schema.ts           # Add billing columns to users + new stripe_events table
client/src/
├── pages/
│   └── Pricing.tsx     # Three-tier pricing page with feature comparison
├── components/
│   └── UpgradePrompt.tsx  # Reusable 402-state prompt for gated features
└── hooks/
    └── useSubscription.ts  # Current user's plan tier + status
```

### Pattern 1: Webhook Handler with Idempotency

**What:** Every incoming Stripe event is checked against a `stripe_events` table before processing. Event ID is inserted as the first write; duplicate → immediate 200.

**When to use:** All Stripe webhook events, no exceptions.

**Example:**
```typescript
// server/billing-webhook.ts
// Source: Stripe webhook docs + idempotency pattern
import Stripe from 'stripe';
import { db } from './db';
import { stripeEvents, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  // IMPORTANT: use req.rawBody (Buffer captured by express.json verify callback)
  const rawBody = (req as any).rawBody as Buffer;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  // Idempotency check — insert first, process after
  const existing = await db.select().from(stripeEvents).where(eq(stripeEvents.eventId, event.id));
  if (existing.length > 0) return res.sendStatus(200);
  await db.insert(stripeEvents).values({ eventId: event.id, type: event.type, processedAt: new Date() });

  // Dispatch by event type
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }

  res.sendStatus(200);
}
```

### Pattern 2: Checkout Session with Card-Required Trial

**What:** Creates a Stripe Checkout Session that starts a 14-day trial but requires a payment method upfront. On completion, Stripe sends `checkout.session.completed`.

**When to use:** New user subscription signup. Called from a "Start Free Trial" button click.

**Example:**
```typescript
// server/billing.ts
// Source: https://docs.stripe.com/billing/subscriptions/trials
export async function createCheckoutSession(userId: string, priceId: string, email: string) {
  // Ensure Stripe Customer exists
  let customer = await db.select().from(users).where(eq(users.id, userId));
  let stripeCustomerId = customer[0].stripeCustomerId;

  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({ email, metadata: { userId } });
    stripeCustomerId = stripeCustomer.id;
    await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId));
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_collection: 'always', // card required for trial (2-3x better conversion)
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { userId },
    },
    success_url: `${process.env.APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_BASE_URL}/pricing`,
  });

  return session.url;
}
```

### Pattern 3: Subscription Gate Middleware

**What:** Express middleware that checks `subscriptionStatus` in the DB. Returns 402 with upgrade data for unpaid users.

**When to use:** Wrap any route that requires an active paid subscription.

**Example:**
```typescript
// server/middleware/requireSubscription.ts
export function requireSubscription(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  db.select().from(users).where(eq(users.id, userId)).then(([user]) => {
    const active = ['trialing', 'active'].includes(user?.subscriptionStatus ?? '');
    if (!active) {
      return res.status(402).json({
        error: 'Subscription required',
        upgradeUrl: '/pricing',
        currentPlan: user?.planTier ?? 'free',
      });
    }
    next();
  });
}
```

### Pattern 4: Customer Portal Redirect

**What:** Creates a Stripe-hosted billing portal session and returns the redirect URL.

**When to use:** User clicks "Manage Billing" anywhere in the app.

**Example:**
```typescript
// server/billing.ts
export async function createPortalSession(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user.stripeCustomerId) throw new Error('No Stripe customer for user');

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.APP_BASE_URL}/dashboard`,
  });

  return session.url;
}
```

### Pattern 5: Checkout Success UX (Webhook Delay Handling)

**What:** After Stripe Checkout redirect returns the user to `/billing/success`, the webhook may not have fired yet. Poll subscription status for up to 10 seconds before showing confirmation.

**When to use:** The `/billing/success` page rendered immediately after Checkout redirect.

**Example:**
```typescript
// client/src/pages/BillingSuccess.tsx
// Poll GET /api/billing/status until subscriptionStatus === 'trialing' or 'active'
// Timeout after 10s — show "payment processing" message if still pending
useEffect(() => {
  let attempts = 0;
  const poll = setInterval(async () => {
    attempts++;
    const { data } = await api.get('/api/billing/status');
    if (['trialing', 'active'].includes(data.subscriptionStatus)) {
      clearInterval(poll);
      // redirect to dashboard
    }
    if (attempts >= 10) {
      clearInterval(poll);
      // show "processing" message
    }
  }, 1000);
  return () => clearInterval(poll);
}, []);
```

### Anti-Patterns to Avoid

- **Provisioning access on `checkout.session.completed` alone:** Also handle `customer.subscription.updated` and `invoice.payment_failed`. Trial-to-paid conversion and payment failures are only visible in subscription lifecycle events.
- **Fetching Stripe prices from the API on every page load:** Stripe's API has rate limits. Cache plan config in a static object in code; prices rarely change.
- **Storing plan tier as a price ID:** Store a human-readable tier (`free`, `starter`, `pro`) derived from the price ID. Decouples display logic from Stripe IDs.
- **Calling `media_publish` (or any paid feature) before checking subscription:** Gate at the route level with middleware, not inside feature logic.
- **Skipping the rawBody — constructing event from re-parsed body:** `stripe.webhooks.constructEvent` must receive the original raw bytes. The current `server/index.ts` captures this via the `verify` callback — use `(req as any).rawBody` in the webhook handler.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription plan management UI | Custom upgrade/downgrade/cancel/invoice UI | Stripe Customer Portal | Portal handles proration, plan changes, cancellations, invoice download — equivalent custom UI is 2-3 sprints of work. |
| Payment form with card input | Custom card fields using raw Stripe.js Elements | Stripe Checkout (hosted redirect) | Hosted Checkout handles PCI compliance, 3DS, ApplePay/GooglePay automatically. |
| Webhook retry handling / delivery guarantees | Custom retry queue | Stripe's built-in retry logic | Stripe retries for 72 hours with backoff. Your job is idempotency, not retry infrastructure. |
| Trial period countdown logic | Custom date arithmetic against `trialEndsAt` | `trial_end` field on the Stripe Subscription object | Use Stripe as source of truth; sync to DB via webhook. |

**Key insight:** Stripe's hosted tools (Checkout, Customer Portal) eliminate the most complex UI work. The entire billing UI is: a pricing page, a success page, and a "Manage Billing" button. Everything else lives in Stripe.

## Common Pitfalls

### Pitfall 1: Stripe Raw Body Mismatch

**What goes wrong:** Webhook signature verification fails with `WebhookSignatureVerificationError`. All webhooks return 400. Stripe Dashboard shows consistent failures.

**Why it happens:** `express.json()` parses the body and `req.rawBody` is not the original Buffer. The current `server/index.ts` does capture `rawBody` via the `verify` callback, but if the webhook handler reads from `req.body` instead of `(req as any).rawBody`, the signature check still fails.

**How to avoid:** In the webhook handler, always use the captured Buffer: `const rawBody = (req as any).rawBody as Buffer`. Do not use `JSON.stringify(req.body)` as a substitute.

**Warning signs:** `WebhookSignatureVerificationError` in logs. Every webhook event type returns 400.

### Pitfall 2: Duplicate Webhook Processing (Missing Idempotency)

**What goes wrong:** Network blip causes Stripe to retry a `checkout.session.completed` event. The user is provisioned twice. Duplicate subscription records appear.

**Why it happens:** Handler logic runs the full provisioning action on every delivery without checking if the event was already processed.

**How to avoid:** Build the `stripe_events` idempotency table before writing any handler logic. Check + insert as the very first DB operation in the handler.

**Warning signs:** Duplicate welcome emails. Users have two subscription records. Stripe Dashboard shows the same event delivered twice.

### Pitfall 3: Trusting Only `checkout.session.completed`

**What goes wrong:** User's trial ends, payment fails, but `subscriptionStatus` in the DB remains `trialing` forever. User retains paid access without a valid subscription.

**Why it happens:** `checkout.session.completed` fires once at signup. Subscription lifecycle changes (trial end, payment failure, cancellation) come through `customer.subscription.updated` and `customer.subscription.deleted` — missed if only the checkout event is handled.

**How to avoid:** Handle all four critical events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

**Warning signs:** Cancelled users still have paid-tier access. Payment failure doesn't restrict features.

### Pitfall 4: Checkout Success Page Shows Free Plan (Webhook Not Yet Fired)

**What goes wrong:** User completes Checkout and is redirected to `/billing/success`. The webhook hasn't fired yet (typically 1-5 second delay). The page queries `GET /api/billing/status`, sees `status: null`, and tells the user they're on the free plan.

**Why it happens:** Redirect from Stripe is faster than webhook delivery. The UI renders before the DB is updated.

**How to avoid:** Implement polling on the success page (up to 10 seconds, 1-second intervals) before showing plan status. Show a "processing payment..." state during polling.

**Warning signs:** Users report starting trial and immediately seeing "free plan" on the dashboard.

### Pitfall 5: Hardcoded Stripe Price IDs in Multiple Places

**What goes wrong:** Price IDs are scattered across frontend and backend. When a price is updated in Stripe, several files need updating and one gets missed.

**Why it happens:** Price IDs look like config, so they get inlined wherever needed.

**How to avoid:** Centralise plan config in one file: `shared/plans.ts` with a `PLANS` object mapping tier names to `{ priceId, name, price, features[] }`. Import everywhere from that single source.

**Warning signs:** Pricing page shows a different price than what Stripe actually charges.

## Code Examples

Verified patterns from official sources:

### Schema Migration — Billing Columns

```typescript
// shared/schema.ts additions
// Source: Drizzle ORM docs + Stripe subscription lifecycle

// Add to users table:
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  // Billing columns (Phase 2)
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  subscriptionStatus: text("subscription_status").default("free"),
  // Values: 'free' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
  planTier: text("plan_tier").default("free"),
  // Values: 'free' | 'starter' | 'pro'
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEndsAt: timestamp("current_period_ends_at"),
});

// New table for webhook idempotency
export const stripeEvents = pgTable("stripe_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull().unique(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at").notNull().default(sql`now()`),
});
```

### Plan Configuration (Single Source of Truth)

```typescript
// shared/plans.ts
export const PLANS = {
  free: {
    tier: 'free' as const,
    name: 'Free',
    price: 0,
    priceId: null,
    features: ['5 posts/month', '1 connected account', 'AI tagging'],
  },
  starter: {
    tier: 'starter' as const,
    name: 'Starter',
    price: 19,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!, // set in env
    features: ['50 posts/month', '2 connected accounts', 'AI tagging', 'Duplicate detection', 'Bulk upload'],
  },
  pro: {
    tier: 'pro' as const,
    name: 'Pro',
    price: 49,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    features: ['Unlimited posts', '5 connected accounts', 'All Starter features', 'Priority support'],
  },
} as const;

export type PlanTier = keyof typeof PLANS;
```

### Webhook Route Registration (Using Captured rawBody)

```typescript
// server/routes.ts (or server/index.ts)
// Source: Stripe webhook docs — raw body requirement
// IMPORTANT: The existing server/index.ts captures rawBody via express.json verify callback.
// The webhook route can use express.json() normally — rawBody is available on req.
// No need to register express.raw() separately; just read (req as any).rawBody in handler.

app.post('/api/stripe/webhook', async (req, res) => {
  await handleStripeWebhook(req, res);
});
// This route MUST be registered before other middleware might transform req in unexpected ways.
// Current setup in server/index.ts is already correct — rawBody is captured globally.
```

### Sync Subscription from Webhook

```typescript
// server/billing-webhook.ts
async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) return; // safety check

  const planTier = getPlanTierFromPriceId(subscription.items.data[0]?.price.id);

  await db.update(users)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status, // 'trialing' | 'active' | 'past_due' | 'canceled'
      planTier,
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      currentPeriodEndsAt: new Date(subscription.current_period_end * 1000),
    })
    .where(eq(users.id, userId));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Building custom card input UI | Stripe Checkout (hosted redirect) | 2020+ | PCI SAQ A instead of SAQ A-EP; no card data on your servers |
| Stripe.js v2 custom forms | Stripe Payment Elements + Checkout | 2021 | Hosted Checkout is now the recommended path for subscriptions |
| Manual subscription management UI | Stripe Customer Portal | 2020 | Eliminates 3-5 sprints of billing UI development |
| `stripe@21` | Use `stripe@^17.x` for this project | 2026-03-25 | v21 has breaking TypeScript changes; pin to 17.x until stable |

**Deprecated/outdated:**
- Stripe Charges API (non-subscription): Do not use for recurring billing — use the Subscriptions API.
- Stripe.js v2: Replaced by Stripe.js v3+ (currently v5). Never use the old CDN include approach.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | No test framework detected in project |
| Config file | none — Wave 0 must install |
| Quick run command | `npx vitest run --reporter=verbose` (after Wave 0 setup) |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Checkout Session created with trial_period_days=14 and payment_method_collection='always' | unit | `npx vitest run tests/billing.test.ts` | Wave 0 |
| BILL-02 | PLANS config has free/starter/pro with correct prices and feature lists | unit | `npx vitest run tests/plans.test.ts` | Wave 0 |
| BILL-03 | `customer.subscription.updated` event syncs status to DB correctly | unit (mocked Stripe event) | `npx vitest run tests/billing-webhook.test.ts` | Wave 0 |
| BILL-03 | Idempotent — same event ID processed twice does not double-update | unit | `npx vitest run tests/billing-webhook.test.ts` | Wave 0 |
| BILL-04 | Customer Portal session returns a URL | unit (mocked Stripe API) | `npx vitest run tests/billing.test.ts` | Wave 0 |
| BILL-05 | `requireSubscription` middleware returns 402 for free-tier user | unit | `npx vitest run tests/middleware.test.ts` | Wave 0 |
| BILL-05 | `requireSubscription` middleware calls next() for active subscriber | unit | `npx vitest run tests/middleware.test.ts` | Wave 0 |
| BILL-06 | Webhook handler returns 200 immediately on duplicate event ID | unit | `npx vitest run tests/billing-webhook.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/billing-webhook.test.ts tests/billing.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/billing.test.ts` — covers BILL-01, BILL-04
- [ ] `tests/billing-webhook.test.ts` — covers BILL-03, BILL-06
- [ ] `tests/plans.test.ts` — covers BILL-02
- [ ] `tests/middleware.test.ts` — covers BILL-05
- [ ] `vitest.config.ts` — vitest not yet installed
- [ ] Framework install: `npm install -D vitest @vitest/coverage-v8`
- [ ] Stripe mock: use `stripe-mock` or manual mock of `stripe` module

## Open Questions

1. **Stripe Product and Price IDs**
   - What we know: Stripe Products and Prices must be created in the Stripe Dashboard (or via API) before the checkout flow can be built.
   - What's unclear: Whether Starter and Pro products already exist in the Stripe account, or need to be created as part of Phase 2.
   - Recommendation: Wave 1 task should include "Create Stripe Products and Prices in Dashboard, add price IDs to .env as STRIPE_STARTER_PRICE_ID and STRIPE_PRO_PRICE_ID".

2. **Free Tier Feature Limits**
   - What we know: BILL-02 specifies Free tier as "limited". What is limited is not defined in requirements (posts per month? accounts? features?).
   - What's unclear: Exact limits for the free tier (e.g., 5 posts/month vs 10 posts/month).
   - Recommendation: Planner should define a concrete free tier limit and encode it in PLANS config. Suggested: 5 posts/month, 1 folder, no bulk upload.

3. **Webhook Endpoint URL for Stripe Dashboard Registration**
   - What we know: Webhook must be registered in Stripe Dashboard pointing at the production URL.
   - What's unclear: Whether the Railway/Fly.io production URL is known yet.
   - Recommendation: Wave N (final) task should include "Register webhook endpoint in Stripe Dashboard for production URL". Use Stripe CLI for local development: `stripe listen --forward-to localhost:5000/api/stripe/webhook`.

## Sources

### Primary (HIGH confidence)
- [Stripe Subscriptions + Free Trials](https://docs.stripe.com/billing/subscriptions/trials) — trial_period_days, payment_method_collection options
- [Stripe Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create) — session creation parameters
- [Stripe Webhook Quickstart (Node)](https://docs.stripe.com/webhooks/quickstart?lang=node) — constructEvent, rawBody requirement
- [Stripe Customer Portal](https://docs.stripe.com/customer-management) — billingPortal.sessions.create
- [Stripe Webhook Signature Verification](https://docs.stripe.com/webhooks/signature) — raw body critical requirement
- Project `server/index.ts` — confirmed rawBody capture via express.json verify callback (line 33-36)
- Project `shared/schema.ts` — confirmed users table has no billing columns; migration needed

### Secondary (MEDIUM confidence)
- STACK.md (project research) — stripe@^17.x pin confirmed, v21 breaking changes documented
- FEATURES.md (project research) — Stripe Customer Portal pattern confirmed, trial conversion data (card-required 2-3x better)
- PITFALLS.md (project research) — Pitfall 1 (raw body), Pitfall 6 (idempotency) both fully documented with code examples

### Tertiary (LOW confidence)
- None — all critical claims verified against official Stripe documentation or project source files.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Stripe ^17.x is confirmed via STACK.md + npm. @stripe/stripe-js ^5.x is current stable.
- Architecture: HIGH — Webhook handler, idempotency, Checkout Session, Customer Portal all verified against official Stripe docs.
- Pitfalls: HIGH — Raw body pitfall verified against project source (server/index.ts already has rawBody capture). Idempotency pitfall verified against Stripe docs. Webhook lifecycle pitfall verified against Stripe event reference.

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (Stripe APIs are stable; rawBody behaviour won't change. stripe@21 may stabilise within this window but don't upgrade mid-phase.)
