---
phase: 02-billing
plan: 03
subsystem: payments
tags: [stripe, react, express, middleware, subscription-gating]

# Dependency graph
requires:
  - phase: 02-billing-01
    provides: PLANS config in shared/plans.ts, subscriptionStatus/planTier schema fields
  - phase: 02-billing-02
    provides: /api/billing/checkout, /api/billing/status, /api/billing/portal endpoints

provides:
  - requireSubscription Express middleware returning 402 with upgrade prompt data
  - Pricing page with Free/Starter/Pro tier cards and subscribe buttons
  - UpgradePrompt reusable component for 402 responses
  - useSubscription hook returning planTier, subscriptionStatus, isActive
  - /pricing public route accessible to authenticated and unauthenticated users
  - Checkout endpoint updated to accept tier name instead of raw priceId

affects: [03-instagram, 04-ai, any feature that adds gated routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - requireSubscription middleware: check subscriptionStatus in DB, return 402 with upgradeUrl + currentPlan
    - Client-safe plan config: omit priceIds from client-facing config, resolve server-side via tier name
    - useSubscription hook: react-query fetch of /api/billing/status with isActive derived field

key-files:
  created:
    - server/middleware/requireSubscription.ts
    - client/src/pages/Pricing.tsx
    - client/src/components/UpgradePrompt.tsx
    - client/src/hooks/useSubscription.ts
  modified:
    - server/routes.ts
    - client/src/App.tsx

key-decisions:
  - "Checkout endpoint accepts { tier } not { priceId } — keeps Stripe price IDs server-side only, never exposed to client"
  - "Pricing page uses client-safe plan config (no priceIds) — avoids process.env exposure to browser bundle"
  - "/pricing route added at both AppContent level (public) and inside AuthenticatedRoutes (authenticated navigation)"

patterns-established:
  - "Gated routes: add requireSubscription before handler, comment // Gated: requires active subscription above route"
  - "402 response shape: { error, upgradeUrl, currentPlan } — consumed by UpgradePrompt component"

requirements-completed: [BILL-05]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 02 Plan 03: Subscription Gate, Pricing Page, and Upgrade Prompt Summary

**Express requireSubscription middleware gates AI generation and bulk upload behind active Stripe subscription, with a 3-tier Pricing page and reusable UpgradePrompt component for 402 responses**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T14:16:11Z
- **Completed:** 2026-03-26T14:19:30Z
- **Tasks:** 2 auto (+ 1 checkpoint auto-approved)
- **Files modified:** 6

## Accomplishments
- requireSubscription middleware returns 402 with `{ error, upgradeUrl, currentPlan }` for free/expired users, calls `next()` for trialing/active
- Applied to `/api/generate-posts` (AI post generation) and `/api/photos/batch-upload` (bulk upload)
- Pricing page renders Free ($0), Starter ($19/mo), Pro ($49/mo) with feature lists and contextual CTA buttons
- UpgradePrompt component displays on 402 responses with "View Plans" link to /pricing
- Checkout endpoint updated to accept `{ tier: 'starter' | 'pro' }` — priceId resolved server-side from PLANS config

## Task Commits

Each task was committed atomically:

1. **Task 1: Create requireSubscription middleware and apply to gated routes** - `747007d` (feat)
2. **Task 2: Create Pricing page, UpgradePrompt component, and useSubscription hook** - `3f9586d` (feat)
3. **Task 3: Verify billing UI and feature gating** - Auto-approved (checkpoint: user requested autonomous execution)

## Files Created/Modified
- `server/middleware/requireSubscription.ts` - Express middleware gating routes behind active subscription
- `client/src/pages/Pricing.tsx` - 3-tier pricing page with feature comparison and subscribe buttons (164 lines)
- `client/src/components/UpgradePrompt.tsx` - Reusable 402 upgrade prompt card linking to /pricing (38 lines)
- `client/src/hooks/useSubscription.ts` - React Query hook for billing status with isActive derived field
- `server/routes.ts` - Added requireSubscription to gated routes, updated checkout to accept tier name, imported PLANS
- `client/src/App.tsx` - Added /pricing as public route and inside AuthenticatedRoutes

## Decisions Made
- Checkout endpoint now accepts `{ tier }` not `{ priceId }` — keeps Stripe price IDs server-side only, never exposed to the browser bundle
- Client-safe plan config omits priceIds (avoids process.env exposure in browser bundle) — tier name is sent to server, server resolves priceId from PLANS config
- /pricing added at both AppContent level (window.location.pathname check, for unauthenticated) and inside AuthenticatedRoutes (for wouter SPA navigation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in server/storage.ts, server/post-generator.ts, and client/src/components/examples/Header.tsx were present before this plan. Verified via git stash. Not introduced by this plan's changes — logged as out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Billing phase (02) fully complete: schema, Stripe integration, webhooks, checkout, portal, gating, and UI
- Ready for Phase 03 (Instagram OAuth) — requireSubscription is available for any future paid feature routes
- UpgradePrompt can be dropped into any component that receives a 402 response

---
*Phase: 02-billing*
*Completed: 2026-03-26*
