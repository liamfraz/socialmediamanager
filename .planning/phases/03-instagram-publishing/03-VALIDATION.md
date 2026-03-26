---
phase: 3
slug: instagram-publishing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compile + integration checks |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must pass
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | INSTA-01 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | INSTA-02 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 2 | INSTA-03,04 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 3-02-02 | 02 | 2 | INSTA-05 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 3-03-01 | 03 | 3 | INSTA-06 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Meta Developer App created with Instagram Business Login product
- [ ] `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` in `.env`
- [ ] R2 bucket serving permanent public URLs (from Phase 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Instagram OAuth connect flow | INSTA-01 | Requires browser + Instagram test account | Click connect, authorize, verify token stored |
| Post publishes to Instagram feed | INSTA-03 | Requires live API + approved App Review | Schedule post, wait for publish time, check Instagram |
| Token refresh works | INSTA-02 | Requires 60-day wait or token manipulation | Call refresh endpoint manually, verify new token stored |
| Personal account guidance | INSTA-06 | Requires UI interaction | Connect personal account, verify guide displays |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
