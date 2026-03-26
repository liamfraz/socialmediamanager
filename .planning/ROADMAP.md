# Roadmap: Social Media Manager

## Overview

This milestone takes the existing Replit-scaffolded photographer workflow (bulk upload, AI tagging, post scheduling, approval) from a dev-only state to a production-ready SaaS. The path is: fix infrastructure blockers first (sessions, cloud storage), then unlock monetisation (Stripe billing), wire up Instagram publishing (the longest external dependency), add Facebook as an incremental platform extension, build the image composition editor, launch the public-facing landing and pricing pages, and finally harden the app for public traffic.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure** - Replace MemoryStore sessions with PostgreSQL-backed store and migrate local file storage to Cloudflare R2 (completed 2026-03-26)
- [ ] **Phase 2: Billing** - Add Stripe subscriptions, free trial, plan gating, and Customer Portal
- [ ] **Phase 3: Instagram Publishing** - Complete Instagram OAuth, token refresh, and direct Graph API publishing
- [ ] **Phase 4: Facebook Publishing** - Extend Meta integration to Facebook Pages using the shared Meta App
- [ ] **Phase 5: Image Composition** - Build Konva canvas editor for duo/quadrant layouts with export to R2
- [ ] **Phase 6: Landing and Pricing** - Public landing page, pricing tier comparison, and signup flow
- [ ] **Phase 7: Production Hardening** - Security headers, rate limiting, error handling, and deployment readiness

## Phase Details

### Phase 1: Infrastructure
**Goal**: The app is production-safe — sessions persist across deploys, uploads live in cloud storage with public URLs, and the codebase is deployable to a PaaS host
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. User can log in, close the browser, reopen the app, and still be logged in (session persists across server restarts)
  2. Uploaded photos are accessible via a permanent public URL (not a local filesystem path)
  3. Existing uploads from local storage are accessible after migration — no broken images in the UI
  4. App deploys and starts successfully on Railway or Fly.io with environment variables only (no local files required)
**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Wire PostgreSQL session store and create R2 cloud-storage module
- [ ] 01-02-PLAN.md — Replace upload handler with R2 and create migration script
- [ ] 01-03-PLAN.md — Remove Replit code, clean dependencies, verify deployment readiness

### Phase 2: Billing
**Goal**: Users can subscribe to a paid plan, manage their subscription, and paid features are gated behind an active subscription
**Depends on**: Phase 1
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06
**Success Criteria** (what must be TRUE):
  1. User can start a 14-day free trial with a card on file via Stripe Checkout
  2. User can see three pricing tiers (Free, Starter, Pro) with feature comparison before subscribing
  3. Subscription status updates in the app within seconds of a Stripe webhook event (upgrade, cancel, renewal)
  4. User can open Stripe Customer Portal from the app to upgrade, downgrade, or cancel their plan
  5. Attempting to use a paid feature on a free/expired account shows a clear upgrade prompt instead of an error
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — Schema migration, plan config, and webhook handler with idempotency
- [ ] 02-02-PLAN.md — Stripe Checkout session, Customer Portal, and billing success page
- [ ] 02-03-PLAN.md — Subscription gate middleware, pricing page, and upgrade prompt UI

### Phase 3: Instagram Publishing
**Goal**: Users can connect their Instagram Business account and have approved posts publish directly to Instagram via the Graph API
**Depends on**: Phase 1, Phase 2
**Requirements**: INSTA-01, INSTA-02, INSTA-03, INSTA-04, INSTA-05, INSTA-06
**Success Criteria** (what must be TRUE):
  1. User can connect their Instagram Business or Creator account by completing the OAuth flow without leaving the app
  2. User with a personal Instagram account sees a step-by-step guide to convert to Business/Creator before connecting
  3. An approved post publishes to Instagram at its scheduled time and appears in the user's Instagram feed
  4. Each post shows a publish status (pending, published, failed) and failed posts display the specific error message
  5. App does not exceed 50 posts per 24 hours for any connected account and queues excess posts for the next window
**Plans**: TBD

### Phase 4: Facebook Publishing
**Goal**: Users can connect a Facebook Page and publish approved posts to Facebook using the same Meta App established in Phase 3
**Depends on**: Phase 3
**Requirements**: FB-01, FB-02, FB-03
**Success Criteria** (what must be TRUE):
  1. User can connect a Facebook Page via the shared Meta OAuth flow without re-authorising their Instagram connection
  2. An approved post marked for Facebook publishes to the connected Facebook Page at its scheduled time
  3. When creating or editing a post, user can select Instagram only, Facebook only, or both platforms as the publish target
**Plans**: TBD

### Phase 5: Image Composition
**Goal**: Users can compose duo and quadrant image layouts in a canvas editor and export them as a single image ready for posting
**Depends on**: Phase 1
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05
**Success Criteria** (what must be TRUE):
  1. User can open the canvas editor for a post and arrange 2 photos side-by-side in a duo layout
  2. User can open the canvas editor for a post and arrange 4 photos in a quadrant grid layout
  3. User can drag, crop, or refit each individual photo within its layout slot before exporting
  4. User can export the composed layout as a single JPEG image that uploads to R2 and attaches to the post
  5. When the post publishes to Instagram or Facebook, the composed image is used as the post image
**Plans**: TBD

### Phase 6: Landing and Pricing
**Goal**: The app has a public front door — a landing page that converts visitors to free trials and a pricing page that clearly communicates what each plan includes
**Depends on**: Phase 2
**Requirements**: LAND-01, LAND-02, LAND-03, LAND-04
**Success Criteria** (what must be TRUE):
  1. An unauthenticated visitor to the root URL sees the landing page (not a login redirect)
  2. Visitor can read a pricing page that lists all three tiers with their features and prices side-by-side
  3. A clear call-to-action button on the landing page takes the visitor directly to signup or the free trial checkout
  4. Landing page explicitly calls out AI tagging and duplicate detection as differentiators from competing tools
**Plans**: TBD

### Phase 7: Production Hardening
**Goal**: The app handles real traffic safely — errors are graceful, secrets are never exposed, rate limits protect public endpoints, and all features work correctly after infrastructure changes
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6
**Requirements**: QA-01, QA-02, QA-03, QA-04
**Success Criteria** (what must be TRUE):
  1. All features that worked before Phase 1 infrastructure changes still work correctly after deployment (no regressions)
  2. Instagram, Stripe, and R2 API failures return a user-readable error message — the app never shows a raw stack trace or API error body
  3. Repeated failed login attempts and unauthenticated API calls are rate-limited and return a 429 before reaching the database
  4. API responses and client-side network tabs contain no access tokens, Stripe keys, or other credentials
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7
Note: Phase 5 (Image Composition) depends only on Phase 1 and can be executed in parallel with Phases 3-4 if working concurrently.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 3/3 | Complete    | 2026-03-26 |
| 2. Billing | 0/3 | Planned | - |
| 3. Instagram Publishing | 0/? | Not started | - |
| 4. Facebook Publishing | 0/? | Not started | - |
| 5. Image Composition | 0/? | Not started | - |
| 6. Landing and Pricing | 0/? | Not started | - |
| 7. Production Hardening | 0/? | Not started | - |
