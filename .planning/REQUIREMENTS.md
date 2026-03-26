# Requirements: Social Media Manager

**Defined:** 2026-03-26
**Core Value:** Photographers can go from a raw photo dump to a fully scheduled, approved social media content calendar with minimal manual effort.

## v1.0 Requirements

Requirements for production launch. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: App uses PostgreSQL-backed session store instead of MemoryStore
- [x] **INFRA-02**: User uploads are stored in Cloudflare R2 with public URLs
- [ ] **INFRA-03**: Existing local uploads are migrated to R2 on deployment
- [ ] **INFRA-04**: App serves uploaded images via R2 public URLs (not local filesystem)
- [ ] **INFRA-05**: App is deployable to production hosting (Railway/Fly.io) with environment config

### Billing

- [ ] **BILL-01**: User can sign up for a 14-day free trial with card on file
- [ ] **BILL-02**: Three pricing tiers exist: Free (limited), Starter (~$19/mo), Pro (~$49/mo)
- [ ] **BILL-03**: User's subscription status is synced from Stripe webhooks to the database
- [ ] **BILL-04**: User can manage their subscription via Stripe Customer Portal (upgrade, downgrade, cancel)
- [ ] **BILL-05**: Paid features are gated by active subscription status
- [ ] **BILL-06**: Stripe webhook endpoint handles idempotent event processing (no duplicate actions on retry)

### Instagram

- [ ] **INSTA-01**: User can connect their Instagram Business/Creator account via OAuth
- [ ] **INSTA-02**: App stores and automatically refreshes Instagram access tokens before expiry
- [ ] **INSTA-03**: Approved posts publish directly to Instagram via Graph API container flow
- [ ] **INSTA-04**: User sees publish status (pending, published, failed) with error details
- [ ] **INSTA-05**: App respects Instagram rate limits (50 posts/24hr per account)
- [ ] **INSTA-06**: User is guided to convert to Business/Creator account if on personal account

### Facebook

- [ ] **FB-01**: User can connect their Facebook Page via the shared Meta OAuth flow
- [ ] **FB-02**: Approved posts can publish to connected Facebook Page
- [ ] **FB-03**: User can select which platforms (Instagram, Facebook, or both) per post

### Image Composition

- [ ] **IMG-01**: User can compose a "duo" layout (2 photos side-by-side) in a canvas editor
- [ ] **IMG-02**: User can compose a "quadrant" layout (4 photos in a grid) in a canvas editor
- [ ] **IMG-03**: User can crop/fit individual photos within their layout slot
- [ ] **IMG-04**: Composed image exports as a single JPEG ready for posting
- [ ] **IMG-05**: Composed images are used as the post image when publishing

### Landing & Marketing

- [ ] **LAND-01**: Public landing page showcases product features and differentiators
- [ ] **LAND-02**: Pricing page displays all tiers with feature comparison
- [ ] **LAND-03**: Landing page has clear call-to-action leading to signup/trial
- [ ] **LAND-04**: Landing page highlights AI tagging and duplicate detection as unique selling points

### Production QA

- [ ] **QA-01**: All existing features work correctly after infrastructure changes (regression)
- [ ] **QA-02**: Error handling covers API failures gracefully (Instagram, Stripe, R2)
- [ ] **QA-03**: App has proper rate limiting on public endpoints
- [ ] **QA-04**: Sensitive data (tokens, keys) are never exposed in client responses

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-Platform

- **MULTI-01**: User can connect X/Twitter account and publish posts
- **MULTI-02**: User can connect TikTok account and publish photo posts
- **MULTI-03**: User can connect LinkedIn account and publish posts

### Analytics

- **ANAL-01**: User can view post engagement metrics (likes, comments) per platform
- **ANAL-02**: User can see hashtag performance analytics
- **ANAL-03**: Dashboard shows posting frequency and engagement trends

### Team

- **TEAM-01**: Multiple users can collaborate on the same account
- **TEAM-02**: Role-based permissions (editor, viewer, admin)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full Canva-like image editor | Months of development, not a differentiator — Canva already exists. Layout composition only |
| Personal Instagram account support | Basic Display API retired Dec 2024. No official API for personal accounts |
| Facebook Groups posting | Facebook deprecated Groups API. Pages only |
| Real-time engagement feed | Requires separate webhook/polling pipeline. Not needed for v1 |
| Hashtag analytics | Adds scope to Meta App Review. Separate product work |
| X/Twitter at launch | $200/month minimum API cost. Economics don't work at early scale |
| TikTok at launch | Separate audit process with demo video required. Timeline risk |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete (01-01) |
| INFRA-02 | Phase 1 | Complete (01-01) |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| BILL-01 | Phase 2 | Pending |
| BILL-02 | Phase 2 | Pending |
| BILL-03 | Phase 2 | Pending |
| BILL-04 | Phase 2 | Pending |
| BILL-05 | Phase 2 | Pending |
| BILL-06 | Phase 2 | Pending |
| INSTA-01 | Phase 3 | Pending |
| INSTA-02 | Phase 3 | Pending |
| INSTA-03 | Phase 3 | Pending |
| INSTA-04 | Phase 3 | Pending |
| INSTA-05 | Phase 3 | Pending |
| INSTA-06 | Phase 3 | Pending |
| FB-01 | Phase 4 | Pending |
| FB-02 | Phase 4 | Pending |
| FB-03 | Phase 4 | Pending |
| IMG-01 | Phase 5 | Pending |
| IMG-02 | Phase 5 | Pending |
| IMG-03 | Phase 5 | Pending |
| IMG-04 | Phase 5 | Pending |
| IMG-05 | Phase 5 | Pending |
| LAND-01 | Phase 6 | Pending |
| LAND-02 | Phase 6 | Pending |
| LAND-03 | Phase 6 | Pending |
| LAND-04 | Phase 6 | Pending |
| QA-01 | Phase 7 | Pending |
| QA-02 | Phase 7 | Pending |
| QA-03 | Phase 7 | Pending |
| QA-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
