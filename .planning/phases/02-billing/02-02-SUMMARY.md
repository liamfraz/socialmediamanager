---
phase: 02-billing
plan: 02
subsystem: payments
tags: [stripe, react, typescript, checkout, customer-portal, polling]

requires:
  - phase: 02-billing-plan-01
    provides: stripe client, billing schema (stripeCustomerId, subscriptionStatus, planTier, trialEndsAt), PLANS config

provides:
  - createCheckoutSession: creates Stripe Checkout Session with 14-day free trial and card required upfront
  - createPortalSession: opens Stripe Customer Portal for subscription management
  - POST /api/billing/checkout: authenticated endpoint returns checkout URL for redirect
  - POST /api/billing/portal: authenticated endpoint returns portal URL for redirect
  - GET /api/billing/status: authenticated endpoint returns subscriptionStatus, planTier, trialEndsAt
  - BillingSuccess page: polls status after checkout redirect, confirms subscription activation

affects: [03-instagram, pricing-page, account-page, subscription-gating]

tech-stack:
  added: []
  patterns:
    - "Stripe customer lazy-creation: create customer on first checkout, save ID to users table for reuse"
    - "Post-checkout polling: BillingSuccess polls /api/billing/status every 1s up to 10 attempts, falls back to 'processing' message"
    - "Portal-over-custom-UI: Stripe Customer Portal handles all subscription management — no custom upgrade/cancel UI needed"

key-files:
  created:
    - client/src/pages/BillingSuccess.tsx
  modified:
    - server/billing.ts
    - server/routes.ts
    - client/src/App.tsx

key-decisions:
  - "Lazy Stripe customer creation in createCheckoutSession — create customer on first checkout, not at registration"
  - "username used as Stripe customer email — consistent with rest of app auth model"
  - "BillingSuccess polls for up to 10 seconds then shows graceful timeout — webhook delivery is async, UI must tolerate delay"
  - "BillingSuccess placed inside AuthenticatedLayout (AuthenticatedRoutes) — requires login before reaching /billing/success"

requirements-completed: [BILL-01, BILL-04]

duration: 8min
completed: 2026-03-27
---

# Phase 2 Plan 02: Stripe Checkout, Portal, and BillingSuccess Summary

**Stripe Checkout (14-day trial, card required) and Customer Portal endpoints, plus a polling BillingSuccess page that confirms subscription activation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-27T00:00:00Z
- **Completed:** 2026-03-27T00:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Three billing API routes (`/api/billing/checkout`, `/api/billing/portal`, `/api/billing/status`) all behind `requireAuth`
- `createCheckoutSession` lazy-creates a Stripe customer if needed, then starts a trial checkout with `trial_period_days: 14` and `payment_method_collection: 'always'`
- `createPortalSession` wraps Stripe's Customer Portal — zero custom UI needed for subscription management
- `BillingSuccess` page polls `/api/billing/status` on mount, confirms `trialing`/`active` state, falls back to a "processing" message after 10 attempts

## Task Commits

1. **Task 1: Add checkout session, portal session, and billing status endpoints** - `f6d2a2a` (feat)
2. **Task 2: Create BillingSuccess page with polling** - `9bc5f26` (feat)

**Plan metadata:** (created after this summary)

## Files Created/Modified

- `server/billing.ts` - Added `createCheckoutSession` and `createPortalSession` (imports db/drizzle directly for user lookup and customer ID save)
- `server/routes.ts` - Added three `/api/billing/*` routes and imported billing functions
- `client/src/pages/BillingSuccess.tsx` - New page: polling logic, success state, timeout fallback
- `client/src/App.tsx` - Added import and `/billing/success` route inside AuthenticatedRoutes

## Decisions Made

- Lazy Stripe customer creation: a Stripe customer is created only when the user first clicks "Start Free Trial", not at registration. Keeps Stripe customer list clean — only paying/interested users.
- `username` used as Stripe customer email (consistent with rest of app's auth model — no separate email field on users table).
- BillingSuccess polls for up to 10 seconds, then shows a graceful "payment processing" fallback. Stripe webhook delivery is async — the DB status may not update instantly.
- `/billing/success` placed inside `AuthenticatedRoutes` — requires login, consistent with all other app pages.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compile check (`npx tsc --noEmit`) showed 5 pre-existing errors (unrelated files: `Header.tsx`, `post-generator.ts`, `storage.ts`, `routes.ts` pre-existing). No new errors introduced.

## User Setup Required

None - no external service configuration required beyond `APP_BASE_URL` (already required from Plan 01).

## Next Phase Readiness

- Billing checkout and portal endpoints ready for integration with a Pricing page (Phase 02-03 or equivalent)
- `GET /api/billing/status` ready for any subscription-gating logic in Phase 3+
- Stripe webhook handler (from Plan 01) already handles subscription state updates — the full flow is complete end-to-end

---
*Phase: 02-billing*
*Completed: 2026-03-27*
