# Feature Research

**Domain:** SaaS social media management platform for photographers — production launch milestone
**Researched:** 2026-03-26
**Confidence:** HIGH (Instagram Graph API, Stripe), MEDIUM (multi-platform unified APIs, canvas editors), LOW (TikTok production timelines)

---

## Scope Note

This file covers ONLY the new features for the v1.0 milestone. The following are already built and excluded from analysis:

- User auth, bulk upload, AI tagging, similar photo detection, post creation/scheduling, drag-and-drop reorder, post approval workflow, webhook auto-publish, post history, posting settings, post layout types (single/duo/quadrant)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a paying SaaS user assumes exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Public landing page with feature overview | Any paid product needs a front door. Users will not sign up without seeing what they're paying for | LOW | React component, no backend needed. Hero, features, social proof, CTA |
| Pricing page with plan comparison | SaaS users shop on pricing pages. Missing = distrust or confusion | LOW | 3-tier layout (Free/Starter/Pro). Highlight recommended tier. Feature comparison table |
| Stripe billing with free trial | Industry standard entry model. Users expect to try before paying | MEDIUM | Stripe Checkout Sessions + webhook sync to DB. trial_period_days on subscription creation. Card collection is optional but recommended (2-3x better conversion) |
| Instagram direct publishing (Graph API) | Webhook publishing is invisible to photographers. They expect to see the post go live via their connected account | HIGH | Three-step container flow: create container → poll status → publish. Requires Meta App Review (2-8 week process). Business/Creator accounts only. JPEG only |
| OAuth connect flow for Instagram | Users need to link their Instagram account from within the app | MEDIUM | Instagram OAuth is already scaffolded. Needs full completion: token storage, refresh, scope management (instagram_content_publish required) |
| Account/subscription management page | Users need to see their plan, usage, billing history, and cancel | LOW-MEDIUM | Stripe Customer Portal via `stripe.billingPortal.sessions.create()` — offloads most UI work to Stripe |
| Basic image composition for post layouts | The schema already defines single/duo/quadrant — users expect the UI to render these as actual composed images | MEDIUM | Canvas-based composition using Fabric.js or Konva.js. Not a full design editor — just layout rendering with crop/fit controls |

### Differentiators (Competitive Advantage)

Features that set this product apart from Planoly, Later, and Buffer for photographers specifically.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI auto-tagging already built-in | Competitors charge extra or don't offer it. Photographers upload hundreds of images — auto-tagging is a massive time save | Already built | Lean into this on the landing page. It's a genuine differentiator |
| Similar photo detection + deduplication | No major competitor does this. Reduces "same sunset five times" embarrassment | Already built | Landing page feature. Unique selling point |
| Bulk upload to organized folders | Visual-first bulk workflow beats competitors like Buffer (single-file focused) | Already built | Photographers shoot in volume. This matters |
| Multi-platform posting (Facebook Pages first, X/TikTok later) | Photographers post to multiple platforms. One tool beats context-switching | HIGH (Facebook MEDIUM, X/TikTok HIGH) | Facebook Graph API shares auth flow with Instagram (same Meta app). X API now $200/month minimum for Basic tier — significant cost to pass to users. TikTok requires separate audit process |
| Drag-and-drop content calendar | Already built. Visual calendar view of scheduled posts | Already built | Differentiator vs simple list-based schedulers |
| Post approval workflow | Built-in review gate before publishing. Useful for photographers with a manager/editor | Already built | Frame as "team collaboration" on landing page |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full Canva-like image editor | Photographers want to edit photos within the tool | Months of dev to reach production quality. Fabric.js from scratch = 3-6 months minimum for polished UX. Not a differentiator — Canva already exists | Build layout composition only (crop/fit to single/duo/quadrant templates). Link out to Canva or Lightroom for actual editing |
| Twitter/X API posting at launch | Platforms want social proof across all channels | X Basic API is $200/month. This cost must be absorbed or passed through. At low user counts the economics don't work | Implement via unified API abstraction (Ayrshare or similar) so X can be enabled later without architecture changes |
| Personal Instagram account support | Users want to post to their personal profiles | Instagram Basic Display API was retired December 2024. Personal accounts are no longer supported by any official API. There is no workaround | Require users to convert to Business or Creator account. Document this clearly in onboarding |
| Hashtag analytics and post performance metrics | Users want to know what works | Requires read permissions (instagram_business_basic or equivalent) which adds scope to App Review. Separate API surface from publishing | Defer to v2. Scope the App Review submission for publishing permissions only — add analytics later |
| Group posting to Facebook Groups | Users want reach | Facebook deprecated Group posting API. Apps cannot post to groups in 2026 | Pages only. Document this limitation |
| Real-time post engagement feed | Dashboard showing likes/comments live | Requires webhook setup with Instagram, ongoing polling, separate data pipeline | Not needed for v1. Add to backlog |

---

## Feature Dependencies

```
Landing Page
    └──requires──> Stripe Billing (pricing page links to checkout)

Stripe Billing
    └──requires──> Subscription schema (users table needs plan/trial fields)
    └──requires──> Stripe Webhook endpoint (sync subscription state to DB)

Instagram Direct Publishing
    └──requires──> Instagram OAuth completion (tokens must be stored)
    └──requires──> Meta App Review approval (2-8 weeks, must start early)
    └──requires──> Cloud file storage (images must be publicly accessible at publish time — local uploads/ won't work)

Image Composition UI
    └──requires──> Post layout schema (already exists: single/duo/quadrant)
    └──enhances──> Instagram Direct Publishing (composed image = final publishable asset)

Multi-Platform Publishing
    └──requires──> Instagram Direct Publishing (proves the pattern)
    └──requires──> Per-platform OAuth flows
    └──Facebook──> Shares Meta App and OAuth flow with Instagram (lower additional cost)
    └──X/TikTok──> Separate apps, separate review processes, separate costs

Account/Subscription Management
    └──requires──> Stripe Billing (portal is meaningless without a subscription)
    └──requires──> Stripe Customer Portal (Stripe-hosted, minimal custom UI)
```

### Dependency Notes

- **Cloud storage is a hard prerequisite for Instagram publishing:** Instagram Graph API requires images to be at a publicly accessible URL at the time of the publish API call. Local `uploads/` directory will not work. S3 or equivalent must ship before or with Instagram publishing.
- **Meta App Review is a time-gated blocker:** Approval takes 2-8 weeks and is frequently rejected on first submission. This must start at the very beginning of the milestone, not at the end.
- **Facebook shares the Meta App with Instagram:** Pages API posting uses the same Facebook App, reducing the review surface for Facebook support. Ship Instagram first; Facebook can follow quickly.
- **X and TikTok are independent work streams:** X requires its own developer app and $200/month API subscription at minimum. TikTok requires a separate audit with demo video. Both should be post-v1.

---

## MVP Definition

### Launch With (v1.0)

- [ ] **Landing page + pricing page** — required before any public traffic. No landing page = no conversions.
- [ ] **Stripe billing with 14-day free trial** — collect card upfront (better conversion). 3 tiers: Free (limited posts/month), Starter (~$19/mo), Pro (~$49/mo). Stripe Customer Portal for self-service billing management.
- [ ] **Instagram OAuth completion** — fully connect Business/Creator accounts. The scaffolding exists; complete token storage, refresh, and scope validation.
- [ ] **Instagram Graph API direct publishing** — replace webhook fallback with direct API calls for connected accounts. Three-step container flow. JPEG composition required.
- [ ] **Cloud storage migration** — S3 or Cloudflare R2 for uploads. Prerequisite for Instagram publishing and production reliability generally.
- [ ] **Image composition for post layouts** — render single/duo/quadrant layouts as actual composed images ready for upload. Fabric.js recommended. Scope: layout composition only, not a full editor.
- [ ] **Production session store** — replace memorystore with Redis or PostgreSQL sessions. Required for any public launch.

### Add After Validation (v1.x)

- [ ] **Facebook Pages publishing** — shares Meta App with Instagram, low incremental cost once Instagram is live. Add when first users request multi-platform.
- [ ] **Basic post analytics** — requires adding read scopes to App Review. Submit separately to keep initial review surface small.
- [ ] **Team collaboration / multi-user per account** — relevant when photographer businesses grow.

### Future Consideration (v2+)

- [ ] **X/Twitter publishing** — $200/month minimum API cost makes per-user economics difficult at low scale. Revisit when user base justifies cost or use unified API (Ayrshare) to abstract the cost.
- [ ] **TikTok publishing** — video-primary platform. Requires separate TikTok developer app and production audit. TikTok does now support photo posts via Content Posting API but photographer use case is primarily still-image, and the audit process adds timeline risk.
- [ ] **Hashtag/engagement analytics dashboard** — full read permissions, separate API surface, separate product work.
- [ ] **LinkedIn publishing** — lower priority for photographers but straightforward via unified API.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Landing page + pricing | HIGH | LOW | P1 |
| Stripe billing + free trial | HIGH | MEDIUM | P1 |
| Cloud storage migration | HIGH (enabler) | MEDIUM | P1 |
| Instagram OAuth completion | HIGH | LOW-MEDIUM | P1 |
| Instagram Graph API publishing | HIGH | HIGH | P1 |
| Image composition (layout renderer) | MEDIUM-HIGH | MEDIUM | P1 |
| Production session store | HIGH (security) | LOW | P1 |
| Stripe Customer Portal | MEDIUM | LOW | P1 |
| Facebook Pages publishing | MEDIUM | MEDIUM | P2 |
| Post analytics | MEDIUM | MEDIUM | P2 |
| Multi-user/team features | LOW | HIGH | P3 |
| X/TikTok publishing | LOW (at v1 scale) | HIGH | P3 |

**Priority key:**
- P1: Must have for production launch
- P2: Add when first users request it
- P3: Future consideration after product-market fit

---

## Competitor Feature Analysis

| Feature | Later ($18-82/mo) | Planoly ($14+/mo) | Buffer ($5+/mo) | Our Approach |
|---------|-------------------|-------------------|-----------------|--------------|
| Visual content calendar | Yes | Yes (strong) | Limited | Already built |
| Instagram direct publish | Yes | Yes | Yes | Build in v1.0 |
| AI captions | Yes (AI suite) | Yes | Limited | Already built |
| Bulk upload | Limited | Limited | No | Already built — major differentiator |
| Duplicate photo detection | No | No | No | Already built — unique |
| Post approval workflow | Yes (higher tiers) | No | No | Already built |
| Facebook Pages | Yes | Yes | Yes | v1.x |
| X/TikTok | Yes | TikTok only | Yes | v2+ |
| Image editor | Basic | Basic (Canva integration) | No | Layout composition only |
| Free trial | 14 days | 7 days | Free tier (3 channels) | 14 days recommended |
| Pricing entry point | $18.75/mo | $14/mo | $5/mo | Target $14-19/mo Starter |

---

## Platform-Specific Technical Notes

### Instagram Graph API
- Container-based publish flow: `POST /{ig-user-id}/media` (create) → poll `status_code=FINISHED` → `POST /{ig-user-id}/media_publish`
- Requires `instagram_content_publish` scope
- JPEG only (no PNG, WEBP, HEIC)
- 50 published posts per 24 hours per account
- Images must be at a publicly accessible HTTPS URL at publish time
- Meta App Review: 2-8 weeks. Submit early. Require clear screencast demo.
- Business/Creator accounts only — document this for users in onboarding

### Facebook Pages API
- `pages_manage_posts` + `pages_read_engagement` permissions
- Page Access Token (not User token) required
- Shares Meta App with Instagram — minimal additional review overhead
- Groups posting is deprecated — Pages only

### X (Twitter) API
- Free tier: ~500 posts/month app-level (not per user — this is a hard blocker for multi-tenant SaaS)
- Basic: $200/month minimum
- Consider Ayrshare or similar unified API as cost abstraction layer for X support

### TikTok Content Posting API
- Photos now supported (not just video)
- OAuth flow: `video.publish` scope required
- All content private until production audit is passed
- Audit requires demo video, privacy policy, data handling description
- 15 posts/day/creator account hard cap

### Stripe Billing
- `trial_period_days` set at subscription creation
- `payment_method_collection: 'always'` for card-required trials (2-3x better conversion)
- `payment_method_collection: 'if_required'` for no-card trials (higher top-of-funnel conversion, lower end-of-trial conversion)
- Recommended: always collect card. Photographer SaaS users are professionals — friction is acceptable.
- Stripe Customer Portal handles plan changes, cancellations, invoice history — minimal custom UI needed
- Webhook events to handle: `customer.subscription.trial_will_end`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## Sources

- [Instagram Platform Content Publishing — Meta Developer Docs](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Instagram Graph API 2026 Complete Guide — Elfsight](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/)
- [After Basic Display EOL — Storrito](https://storrito.com/resources/Instagram-API-2026/)
- [Stripe Free Trials — Official Docs](https://docs.stripe.com/payments/checkout/free-trials)
- [Stripe SaaS Subscriptions — Official Docs](https://docs.stripe.com/get-started/use-cases/saas-subscriptions)
- [SaaS Free Trial Best Practices 2026 — Encharge](https://encharge.io/saas-free-trial-best-practices/)
- [X API Pricing 2026 — Zernio](https://zernio.com/blog/twitter-api-pricing)
- [TikTok Content Posting API — TikTok Developers](https://developers.tiktok.com/products/content-posting-api/)
- [TikTok API Guide 2026 — Zernio](https://zernio.com/blog/tiktok-api)
- [Fabric.js vs Konva vs PixiJS 2026 — PkgPulse](https://www.pkgpulse.com/blog/fabricjs-vs-konva-vs-pixijs-canvas-2d-graphics-libraries-2026)
- [Open Source Design Editor SDKs 2025 — IMG.LY](https://img.ly/blog/open-source-design-editor-sdks-a-developers-guide-to-choosing-the-right-solution/)
- [SaaS Pricing Page Best Practices 2026 — InfluenceFlow](https://influenceflow.io/resources/saas-pricing-page-best-practices-complete-guide-for-2026/)
- [Ayrshare Unified Social Media API](https://www.ayrshare.com/)
- [Facebook Pages API Permissions — Meta](https://developers.facebook.com/docs/pages/overview/permissions-features/)
- [Later Pricing and Features 2026](https://later.com/blog/social-media-scheduling-tools/)
- [Planoly vs Buffer 2026 — SocialRails](https://socialrails.com/blog/buffer-vs-planoly)

---

*Feature research for: Social Media Manager — photographer SaaS production launch (v1.0 milestone)*
*Researched: 2026-03-26*
