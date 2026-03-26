# Social Media Manager

## What This Is

A social media management platform for photographers to bulk-upload photos, auto-tag them with AI, compose posts with scheduled dates, review and approve content, then publish via webhook or direct API. Built with React + Express + Vite + Drizzle + PostgreSQL.

## Core Value

Photographers can go from a raw photo dump to a fully scheduled, approved social media content calendar with minimal manual effort.

## Requirements

### Validated

<!-- Shipped and confirmed working from Replit-era codebase -->

- ✓ User can sign up and log in with username/password — v0
- ✓ User can upload photos in bulk to organized folders — v0
- ✓ Photos are auto-tagged with AI (OpenAI) on upload — v0
- ✓ Similar photo detection groups duplicates for review — v0
- ✓ User can review similar photos and keep/discard — v0
- ✓ User can create posts with content, images, and scheduled dates — v0
- ✓ User can reorder posts via drag-and-drop — v0
- ✓ User can review and approve/reject posts — v0
- ✓ Approved posts auto-publish via webhook at scheduled time — v0
- ✓ User can view posted history — v0
- ✓ User can configure posting settings (pause, webhook URL, default time) — v0
- ✓ Post layouts support single, duo, and quadrant image arrangements — v0
- ✓ AI-powered post content generation — v0
- ✓ Instagram credentials table exists (OAuth scaffolded) — v0

### Active

<!-- Current scope — v1.0 milestone -->

(Defined in REQUIREMENTS.md)

### Out of Scope

(None yet — will define during milestone scoping)

## Context

- Originally built on Replit, migrated to local dev
- Uses Express sessions (memorystore) for auth — not production-grade
- Instagram OAuth partially scaffolded but not connected
- Webhook-based posting (not direct API) is the current publish mechanism
- No landing page, pricing, or public-facing site exists
- Schema has `postLayoutValues = ["single", "duo", "quadrant"]` but image composition/editing not implemented
- Port 5000 conflicts with macOS AirPlay — using 5050 locally

## Constraints

- **Database**: PostgreSQL (local via Homebrew, production TBD)
- **Auth**: Currently basic username/password with express-session — needs upgrade for production
- **Storage**: Local file uploads to `uploads/` directory — needs cloud storage for production
- **APIs**: Instagram Graph API requires Facebook App Review for public access

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Express + Vite (not Next.js) | Inherited from Replit scaffold | — Pending |
| Drizzle ORM | Inherited from Replit scaffold, works well | ✓ Good |
| Local file storage | Quick dev setup | ⚠️ Revisit for production |
| Webhook-based posting | Simple integration, platform-agnostic | ⚠️ Revisit when adding direct API |

---
*Last updated: 2026-03-26 after initial GSD setup*
