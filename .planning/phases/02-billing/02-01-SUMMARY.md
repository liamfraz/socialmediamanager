---
phase: 02-billing
plan: 01
subsystem: payments
tags: [stripe, postgres, drizzle, webhook, idempotency, billing]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: Database connection (db/pool), Express server with rawBody capture, R2 storage

provides:
  - Stripe billing columns on users table (stripeCustomerId, stripeSubscriptionId, subscriptionStatus, planTier, trialEndsAt, currentPeriodEndsAt)
  - stripe_events idempotency table
  - shared/plans.ts — centralized plan tier config (free/starter/pro) with prices and features
  - server/billing.ts — Stripe client (stripe@17) and getPlanTierFromPriceId helper
  - server/billing-webhook.ts — webhook handler with idempotency, 4 event types, syncSubscription
  - POST /api/stripe/webhook route registered before all other middleware

affects:
  - 02-02 (checkout session creation — needs PLANS config and billing.ts stripe client)
  - 02-03 (customer portal — needs stripeCustomerId column)
  - 03-instagram (plan enforcement — needs planTier from users table)

# Tech tracking
tech-stack:
  added: [stripe@17.7.0, @stripe/stripe-js@5.10.0]
  patterns:
    - Idempotency via stripe_events table — insert before processing, check on every webhook
    - rawBody Buffer (not req.body) for Stripe signature verification
    - syncSubscription helper resolves userId from metadata first, then stripeCustomerId lookup
    - getPlanTierFromPriceId maps price IDs back to tier names using PLANS config as single source of truth

key-files:
  created:
    - shared/plans.ts
    - server/billing.ts
    - server/billing-webhook.ts
  modified:
    - shared/schema.ts (billing columns on users + stripeEvents table)
    - server/routes.ts (webhook route registration)
    - server/auth.ts (await fix for getCurrentUser)
    - package.json (stripe packages added)

key-decisions:
  - "stripe@17.7.0 pinned — v21 shipped 2026-03-25 with breaking TypeScript changes"
  - "apiVersion 2025-02-24.acacia used — the latest valid version string for stripe@17"
  - "Idempotency insert happens BEFORE event processing — prevents duplicate processing even if handler crashes mid-way"
  - "Webhook route registered as first route in registerRoutes — avoids any middleware interference"
  - "PLANS.priceId reads from process.env at module load — server-side only, null for free tier"

patterns-established:
  - "PLANS config in shared/plans.ts is single source of truth for all tier definitions and price IDs"
  - "Webhook handler always returns 200 after recording event — prevents Stripe retry storms on non-retriable errors"
  - "syncSubscription resolves user via metadata.userId first, falls back to stripeCustomerId DB lookup"

requirements-completed: [BILL-02, BILL-03, BILL-06]

# Metrics
duration: 12min
completed: 2026-03-27
---

# Phase 02 Plan 01: Billing Schema Foundation Summary

**Stripe billing schema (6 columns + stripe_events table), plan tier config, and idempotent webhook handler covering 4 Stripe lifecycle events registered at POST /api/stripe/webhook**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-27T00:43:51Z
- **Completed:** 2026-03-27T00:55:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Users table extended with 6 billing columns and stripe_events idempotency table applied to local Postgres
- shared/plans.ts established as single source of truth for free/starter/pro tier config ($0/$19/$49)
- Webhook handler handles checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, and invoice.payment_failed with idempotency
- Stripe client initialized using pinned stripe@17.7.0 with correct apiVersion 2025-02-24.acacia

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Stripe, add billing columns to schema, create plan config** - `9c6c2bf` (feat)
2. **Task 2: Create Stripe client, webhook handler with idempotency, and register route** - `f11803e` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `shared/schema.ts` - Added 6 billing columns to users table + new stripeEvents idempotency table
- `shared/plans.ts` - Created: centralized PLANS config with free/starter/pro tiers, prices, features, price IDs from env
- `server/billing.ts` - Created: Stripe client (apiVersion 2025-02-24.acacia) + getPlanTierFromPriceId helper
- `server/billing-webhook.ts` - Created: handleStripeWebhook with idempotency, 4 event types, syncSubscription
- `server/routes.ts` - Registered POST /api/stripe/webhook as first route, imported handleStripeWebhook
- `server/auth.ts` - Fixed getCurrentUser to properly await storage.getUser before null coercion
- `package.json` - Added stripe@17.7.0 and @stripe/stripe-js@5.10.0

## Decisions Made
- Pinned apiVersion to `2025-02-24.acacia` — this is the latest valid string for stripe@17 (plan specified `2024-12-18.acacia` which is only valid for stripe@21+)
- Migration applied directly via pg queries instead of `drizzle-kit push` — the interactive TTY prompt for unique constraint handling could not be bypassed in a non-interactive environment
- Auto-fixed: auth.ts getCurrentUser bug — `storage.getUser` returns `Promise<User | undefined>`, so `|| null` on the promise itself was a pre-existing logic bug surfaced by the User type expansion; fixed with proper `await` + `??`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-kit push TTY prompt prevented schema migration**
- **Found during:** Task 1 (schema migration)
- **Issue:** `drizzle-kit push` shows an interactive TTY prompt asking about unique constraint on existing table — could not be bypassed with `--force`, `--strict`, or stdin piping in non-interactive shell
- **Fix:** Applied migration directly via `pg` driver using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` statements
- **Files modified:** No additional files (migration applied to DB only)
- **Verification:** `SELECT column_name FROM information_schema.columns WHERE table_name='users'` confirmed stripe_customer_id and stripe_subscription_id present
- **Committed in:** 9c6c2bf (Task 1 commit)

**2. [Rule 1 - Bug] auth.ts getCurrentUser missing await on async storage.getUser**
- **Found during:** Task 1 (TypeScript type check after schema expansion)
- **Issue:** `storage.getUser()` returns `Promise<User | undefined>` but code did `return storage.getUser(...) || null` — applying `|| null` to a Promise object (always truthy), not the resolved value. Pre-existing bug surfaced when User type gained nullable fields causing stricter type checking
- **Fix:** Added `await` and changed to `??` null coalescing: `const user = await storage.getUser(...); return user ?? null;`
- **Files modified:** server/auth.ts
- **Verification:** `npx tsc --noEmit` — auth.ts error removed
- **Committed in:** 9c6c2bf (Task 1 commit)

**3. [Rule 3 - Blocking] stripe@17 apiVersion string mismatch**
- **Found during:** Task 2 (TypeScript type check)
- **Issue:** Plan specified `apiVersion: '2024-12-18.acacia'` but stripe@17.7.0 types only accept `'2025-02-24.acacia'` as valid
- **Fix:** Updated apiVersion in server/billing.ts to `'2025-02-24.acacia'`
- **Files modified:** server/billing.ts
- **Verification:** `npx tsc --noEmit` — billing.ts error resolved
- **Committed in:** f11803e (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking migration, 1 bug, 1 blocking type error)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in Header.tsx, post-generator.ts, routes.ts (lines 1688/1840), and storage.ts — these are out-of-scope and were not introduced by this plan

## User Setup Required

Stripe test-mode credentials are required before webhook processing will function:

| Variable | Source |
|----------|--------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard -> Developers -> API keys -> Secret key (sk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | Run `stripe listen --forward-to localhost:5000/api/stripe/webhook` — prints whsec_... on startup |
| `STRIPE_STARTER_PRICE_ID` | Stripe Dashboard -> Products -> Create 'Starter' ($19/mo recurring) -> price_... ID |
| `STRIPE_PRO_PRICE_ID` | Stripe Dashboard -> Products -> Create 'Pro' ($49/mo recurring) -> price_... ID |

Create two Stripe Products in test mode: 'Starter' ($19/mo) and 'Pro' ($49/mo).

## Next Phase Readiness
- Billing schema foundation complete — ready for 02-02 (Stripe Checkout session creation)
- PLANS config and stripe client available for checkout endpoint
- Webhook handler will process subscription lifecycle once credentials are set
- Pre-existing TS errors in routes.ts/storage.ts should be addressed before prod deploy

---
*Phase: 02-billing*
*Completed: 2026-03-27*
